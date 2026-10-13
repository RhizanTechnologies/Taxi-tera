import { useEffect, useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export interface RotationController {
  getBearing: () => number;
  setBearing: (bearing: number, smooth?: boolean) => void;
  rotateBy: (delta: number) => void;
  resetNorth: () => void;
}

/** Smoothly animates map bearing using cubic ease-out */
function smoothRotate(map: L.Map, targetBearing: number, durationMs = 280) {
  const anyMap = map as unknown as { getBearing?: () => number; setBearing?: (b: number) => void };
  if (typeof anyMap.getBearing !== 'function' || typeof anyMap.setBearing !== 'function') {
    return;
  }

  const rawStart = anyMap.getBearing();
  const startBearing = (typeof rawStart === 'number' && Number.isFinite(rawStart)) ? rawStart : 0;
  let diff = ((targetBearing - startBearing) % 360 + 540) % 360 - 180;
  if (Math.abs(diff) < 0.5) {
    anyMap.setBearing(targetBearing);
    return;
  }

  const startTime = performance.now();
  function frame(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    // Ease-out cubic curve
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = (startBearing + diff * ease + 360) % 360;
    anyMap.setBearing?.(current);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      anyMap.setBearing?.(targetBearing);
    }
  }
  requestAnimationFrame(frame);
}

/**
 * MapRotationBridge
 * Sits inside <MapContainer> to hook into Leaflet instance, sync rotation,
 * and provide desktop Shift+Drag / Right-Click Drag rotation handlers.
 */
export function MapRotationBridge({
  onBearingChange,
  onControllerReady,
}: {
  onBearingChange: (bearing: number) => void;
  onControllerReady: (controller: RotationController) => void;
}) {
  const map = useMap();
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; startBearing: number }>({ x: 0, startBearing: 0 });

  // Expose controller to parent
  useEffect(() => {
    const anyMap = map as unknown as { getBearing?: () => number; setBearing?: (b: number) => void };
    const safeGetBearing = () => {
      if (typeof anyMap.getBearing === 'function') {
        const raw = anyMap.getBearing();
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          return (raw % 360 + 360) % 360;
        }
      }
      return 0;
    };

    const controller: RotationController = {
      getBearing: safeGetBearing,
      setBearing: (deg: number, smooth = true) => {
        const norm = (deg % 360 + 360) % 360;
        if (smooth) {
          smoothRotate(map, norm);
        } else {
          anyMap.setBearing?.(norm);
        }
      },
      rotateBy: (delta: number) => {
        const current = safeGetBearing();
        smoothRotate(map, (current + delta + 360) % 360);
      },
      resetNorth: () => {
        smoothRotate(map, 0);
      },
    };

    onControllerReady(controller);
  }, [map, onControllerReady]);

  // Listen to Leaflet 'rotate' event
  useEffect(() => {
    const anyMap = map as unknown as { getBearing?: () => number; setBearing?: (b: number) => void };
    const handleRotate = () => {
      if (typeof anyMap.getBearing === 'function') {
        const raw = anyMap.getBearing();
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          const b = (Math.round(raw) % 360 + 360) % 360;
          onBearingChange(b);
          return;
        }
      }
      onBearingChange(0);
    };

    map.on('rotate', handleRotate);
    handleRotate();

    return () => {
      map.off('rotate', handleRotate);
    };
  }, [map, onBearingChange]);

  // Desktop drag-to-rotate listener (Shift + Left Click Drag OR Right Click Drag)
  useEffect(() => {
    const container = map.getContainer();
    const anyMap = map as unknown as { getBearing?: () => number; setBearing?: (b: number) => void };

    const onMouseDown = (e: MouseEvent) => {
      const isShiftDrag = e.shiftKey && e.button === 0;
      const isRightDrag = e.button === 2;
      const isAltDrag = e.altKey && e.button === 0;

      if (!isShiftDrag && !isRightDrag && !isAltDrag) return;

      e.preventDefault();
      e.stopPropagation();

      const currentBearing = anyMap.getBearing ? anyMap.getBearing() : 0;
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        startBearing: currentBearing,
      };

      container.style.cursor = 'grabbing';

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        moveEvent.preventDefault();

        const dx = moveEvent.clientX - dragStartRef.current.x;
        // ~0.5 degree per pixel dragged horizontally
        const newBearing = ((dragStartRef.current.startBearing + dx * 0.5) % 360 + 360) % 360;
        anyMap.setBearing?.(newBearing);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        container.style.cursor = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (isRightDrag) {
          // Prevent standard context menu after dragging
          upEvent.preventDefault();
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const onContextMenu = (e: MouseEvent) => {
      // If user right-clicks while shift or just dragged, prevent context menu
      if (isDraggingRef.current || e.shiftKey || e.altKey) {
        e.preventDefault();
      }
    };

    // Keyboard rotation: Alt + ArrowLeft / Alt + ArrowRight or Shift + ArrowLeft / ArrowRight
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.shiftKey || e.altKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const delta = e.key === 'ArrowLeft' ? -15 : 15;
        const current = anyMap.getBearing ? (anyMap.getBearing() % 360 + 360) % 360 : 0;
        smoothRotate(map, (current + delta + 360) % 360);
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [map]);

  return null;
}

/**
 * Sleek Floating Compass & Map Rotation Control
 * Renders next to floating map action buttons.
 */
export function CompassRotationControl({
  bearing,
  controller,
  lang,
}: {
  bearing: number;
  controller: RotationController | null;
  lang: string;
}) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [sliderVal, setSliderVal] = useState(bearing);

  useEffect(() => {
    setSliderVal(bearing);
  }, [bearing]);

  const isRotated = Math.round(bearing) !== 0 && Math.round(bearing) !== 360;

  // Cardinal direction label
  const getCardinal = (deg: number) => {
    const d = (deg % 360 + 360) % 360;
    if (d >= 337.5 || d < 22.5) return 'N';
    if (d >= 22.5 && d < 67.5) return 'NE';
    if (d >= 67.5 && d < 112.5) return 'E';
    if (d >= 112.5 && d < 157.5) return 'SE';
    if (d >= 157.5 && d < 202.5) return 'S';
    if (d >= 202.5 && d < 247.5) return 'SW';
    if (d >= 247.5 && d < 292.5) return 'W';
    return 'NW';
  };

  const handleCompassClick = () => {
    if (!controller) return;
    if (isRotated) {
      // 1-tap reset to True North
      controller.resetNorth();
    } else {
      // Toggle rotation toolbar so user sees all rotation tools
      setShowToolbar(prev => !prev);
    }
  };

  return (
    <div className="compass-control-group" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {/* Expanded Quick Rotation Toolbar (appears on the left side of the compass) */}
      {showToolbar && (
        <div
          className="compass-toolbar-popover"
          style={{
            position: 'absolute',
            right: 'calc(100% + 10px)',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--clr-surface)',
            border: '1.5px solid var(--clr-border)',
            borderRadius: 100,
            padding: '4px 8px',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
            zIndex: 830,
            whiteSpace: 'nowrap',
          }}
        >
          {/* Rotate Left -45° */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              width: 32,
              height: 32,
              minWidth: 32,
              minHeight: 32,
              padding: 0,
              borderRadius: '50%',
              fontSize: '0.85rem',
              fontWeight: 800,
              color: 'var(--clr-ink)',
            }}
            onClick={() => controller?.rotateBy(-45)}
            title={lang === 'am' ? 'በግራ በኩል 45° አዙር' : 'Rotate -45° CCW'}
            aria-label="Rotate -45 degrees"
          >
            ⟲
          </button>

          {/* Reset North 0° */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              padding: '4px 8px',
              borderRadius: 12,
              fontSize: '0.75rem',
              fontWeight: 800,
              color: isRotated ? '#EF4444' : 'var(--clr-ink-muted)',
              background: isRotated ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
            }}
            onClick={() => controller?.resetNorth()}
            title={lang === 'am' ? 'ወደ ሰሜን መልስ (0°)' : 'Reset to True North (0°)'}
          >
            🧭 {Math.round(bearing)}° {getCardinal(bearing)}
          </button>

          {/* Rotate Right +45° */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              width: 32,
              height: 32,
              minWidth: 32,
              minHeight: 32,
              padding: 0,
              borderRadius: '50%',
              fontSize: '0.85rem',
              fontWeight: 800,
              color: 'var(--clr-ink)',
            }}
            onClick={() => controller?.rotateBy(45)}
            title={lang === 'am' ? 'በቀኝ በኩል 45° አዙር' : 'Rotate +45° CW'}
            aria-label="Rotate +45 degrees"
          >
            ⟳
          </button>

          {/* Smooth angle slider */}
          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={sliderVal}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSliderVal(val);
              controller?.setBearing(val, false);
            }}
            style={{ width: 60, accentColor: 'var(--clr-primary)', cursor: 'pointer' }}
            title={lang === 'am' ? 'የማዞሪያ አንግል (0° - 360°)' : 'Continuous Rotation Slider (0° - 360°)'}
          />

          {/* Close Toolbar */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              width: 24,
              height: 24,
              minWidth: 24,
              minHeight: 24,
              padding: 0,
              borderRadius: '50%',
              fontSize: '0.75rem',
              color: 'var(--clr-ink-muted)',
            }}
            onClick={() => setShowToolbar(false)}
            aria-label="Close rotation toolbar"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Floating Compass Action Button */}
      <button
        type="button"
        className={`side-fab-compass ${isRotated ? 'rotated-active' : ''}`}
        onClick={handleCompassClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowToolbar(prev => !prev);
        }}
        aria-label={
          isRotated
            ? lang === 'am' ? 'ወደ ሰሜን መልስ' : 'Reset North'
            : lang === 'am' ? 'ካርታውን አዙር' : 'Rotate Map'
        }
        title={
          isRotated
            ? `${lang === 'am' ? 'ወደ ሰሜን መልስ' : 'Reset North'} (${Math.round(bearing)}° ${getCardinal(bearing)})`
            : `${lang === 'am' ? 'ካርታውን አዙር (በሁለት ጣት ወይም Shift+ጎትት)' : 'Rotate Map (2 fingers on mobile, Shift+Drag on desktop)'}`
        }
        style={{
          position: 'relative',
          background: isRotated ? 'var(--clr-surface)' : '#0E7490',
          color: isRotated ? '#EF4444' : '#FFFFFF',
          border: isRotated ? '2px solid #EF4444' : 'none',
          boxShadow: isRotated
            ? '0 6px 20px rgba(239, 68, 68, 0.28)'
            : '0 8px 22px rgba(14, 116, 144, 0.4)',
        }}
      >
        {/* Dynamic Rotating Compass Needle */}
        <div
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotate(${-bearing}deg)`,
            transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            {/* North Pointing Needle (Red) */}
            <polygon points="12,2 8,12 12,9.5 16,12" fill={isRotated ? '#EF4444' : '#FFFFFF'} />
            {/* South Pointing Needle (Muted/Silver) */}
            <polygon points="12,22 8,12 12,9.5 16,12" fill={isRotated ? '#94A3B8' : 'rgba(255,255,255,0.45)'} />
            {/* Center Pivot Dot */}
            <circle cx="12" cy="11.5" r="1.8" fill={isRotated ? '#1E293B' : '#0E7490'} />
          </svg>
        </div>

        {/* Floating Degree Badge when Rotated */}
        {isRotated && (
          <div
            style={{
              position: 'absolute',
              bottom: -6,
              fontSize: '0.62rem',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: 100,
              background: '#EF4444',
              color: '#FFFFFF',
              lineHeight: 1.2,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          >
            {Math.round(bearing)}°
          </div>
        )}
      </button>
    </div>
  );
}
