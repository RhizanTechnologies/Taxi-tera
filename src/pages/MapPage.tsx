import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotate';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Minus, Crosshair, Compass, X, Footprints, Navigation, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  pickName,
  distanceMetres,
  formatDistance,
  ADDIS_WALKING_SPEED_MPS,
  URBAN_CIRCUITY_FACTOR,
} from '../lib/utils';
import { BottomSheet } from '../components/ui/index';
import { useAuth } from '../hooks/useAuth';
import { NearbySheet } from '../components/NearbySheet';
import { TopNavbar } from '../components/TopNavbar';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { DesktopJourneyPlanner } from '../components/DesktopJourneyPlanner';
import { StationDetailPanel } from '../components/StationDetailPanel';
import { hydrateJourneyWithRealRoads } from '../lib/transitRouter';
import { MapRotationBridge, type RotationController } from '../components/MapRotationControls';
import { LocationPickerModal, ADDIS_NEIGHBORHOODS } from '../components/LocationPickerModal';
import { REAL_STATIONS, REAL_LINES } from '../data/realStationsData';
import type { Station, Line, TransitJourney } from '../types';

// Fix Leaflet default icon path in Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Center on central Addis Ababa (Megenagna hub)
const ADDIS = { lat: 9.0215, lng: 38.8020 };

/* ── Urban Pin Marker Generator (Section 6) ──────────────── */
function makeUrbanPin(station: Station, isSelected = false, lang = 'am') {
  const name = pickName(station.name_am, station.name_en, lang);

  if (isSelected) {
    return L.divIcon({
      html: `
        <div class="urban-marker-selected-wrap">
          <div class="urban-marker-selected-label">${name}</div>
          <div class="urban-marker-selected-pin">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10Z"/>
              <circle cx="7.5" cy="14.5" r="1.5" fill="#D9F56D"/>
              <circle cx="16.5" cy="14.5" r="1.5" fill="#D9F56D"/>
            </svg>
          </div>
        </div>
      `,
      className: '',
      iconSize: [140, 68],
      iconAnchor: [70, 58],
      popupAnchor: [0, -50],
    });
  }

  return L.divIcon({
    html: `
      <div class="urban-marker-default" title="${name}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10Z"/>
          <circle cx="7.5" cy="14.5" r="1" fill="#FFFFFF"/>
          <circle cx="16.5" cy="14.5" r="1" fill="#FFFFFF"/>
        </svg>
      </div>
    `,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

/* ── User Location Radar Pin (Section 6) ─────────────────── */
function UserDot({
  pos,
  onMove,
  onOpenPicker,
  lang,
}: {
  pos: [number, number];
  onMove?: (p: [number, number]) => void;
  onOpenPicker?: () => void;
  lang: string;
}) {
  const userIcon = L.divIcon({
    html: `
      <div class="urban-user-pin-wrap" title="Drag to adjust your location">
        <div class="urban-user-pin-halo"></div>
        <div class="urban-user-pin-center"></div>
      </div>
    `,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

  return (
    <Marker
      position={pos}
      icon={userIcon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const latlng = e.target.getLatLng();
          if (onMove) onMove([latlng.lat, latlng.lng]);
        },
      }}
    >
      <Popup offset={[0, -14]} closeButton={true}>
        <div style={{ textAlign: 'center', padding: '4px', minWidth: 150 }}>
          <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#102A43', marginBottom: 2 }}>
            📍 {lang === 'am' ? 'የአሁኑ መገኛህ' : 'Your Location'}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#627D98', marginBottom: 8, lineHeight: 1.3 }}>
            {lang === 'am' ? 'ይህንን ነጥብ ጎትተህ ወይም ከታች ተጭነህ ሰፈር ቀይር' : 'Drag this pin or pick your neighborhood below'}
          </div>
          {onOpenPicker && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', fontSize: '0.75rem', height: 26 }}
              onClick={onOpenPicker}
            >
              {lang === 'am' ? 'ሰፈር ምረጥ' : 'Change Location'}
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

/* ── Interactive Map Click Handler for Direct Pin Dropping ─ */
function MapClickHandler({
  isPicking,
  onPick,
}: {
  isPicking: boolean;
  onPick: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      if (isPicking) {
        onPick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

/* ── Safe FlyTo Helper ───────────────────────────────────── */
function FlyTo({ pos, zoom }: { pos: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    try {
      if (map && map.getContainer()) {
        map.flyTo(pos, zoom, { duration: 0.9 });
      }
    } catch (err) {
      console.warn('FlyTo ignored:', err);
    }
  }, [pos, zoom, map]);
  return null;
}

/* ── Map Controller for Zoom and Controls ────────────────── */
function MapControllerBridge({
  onRegister,
}: {
  onRegister: (controls: { zoomIn: () => void; zoomOut: () => void }) => void;
}) {
  const map = useMap();
  useEffect(() => {
    onRegister({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
    });
  }, [map, onRegister]);
  return null;
}

/* ── Category Chips Filter Definition ────────────────────── */
const CATEGORY_CHIPS = [
  { id: 'all', name: 'ሁሉም', en: 'All' },
  { id: 'meg', name: 'መገናኛ', en: 'Megenagna', lat: 9.0215, lng: 38.8020, keywords: ['megenagna', 'መገናኛ', 'lem', 'ሌም', 'shola', 'ሾላ'] },
  { id: 'mex', name: 'ሜክሲኮ', en: 'Mexico', lat: 9.0110, lng: 38.7450, keywords: ['mexico', 'ሜክሲኮ', 'lebu', 'ለቡ'] },
  { id: 'bol', name: 'ቦሌ', en: 'Bole', lat: 8.9950, lng: 38.7885, keywords: ['bole', 'ቦሌ', 'medhanialem', 'መድሃኒዓለም', 'atlas', 'አትላስ', 'brass', 'ብራስ', 'bulbula', 'ቡልቡላ'] },
  { id: 'pia', name: 'ፒያሳ', en: 'Piassa', lat: 9.0345, lng: 38.7525, keywords: ['piassa', 'ፒያሳ', 'giorgis', 'ጊዮርጊስ'] },
  { id: '4k',  name: '4 ኪሎ', en: '4 Kilo', lat: 9.0340, lng: 38.7660, keywords: ['4 kilo', '4 ኪሎ', 'arat kilo', 'አራት ኪሎ', '6 kilo', '6 ኪሎ', 'shiromeda', 'ሽሮሜዳ'] },
  { id: 'sar', name: 'ሳሪስ/ቃሊቲ', en: 'Saris / Kality', lat: 8.9550, lng: 38.7650, keywords: ['saris', 'ሳሪስ', 'kality', 'ቃሊቲ', 'abo', 'አቦ', 'maseltegna', 'ማሰልጠኛ', 'adey', 'አደይ'] },
  { id: 'tor', name: 'ጦር ኃይሎች/አየር ጤና', en: 'Tor Hailoch / Ayer Tena', lat: 9.0050, lng: 38.7150, keywords: ['tor', 'ጦር', 'ayer', 'አየር', 'bethel', 'ቤቴል', 'zenebework', 'ዘነበወርቅ'] },
  { id: 'cmc', name: 'ሲኤምሲ/አያት', en: 'CMC / Ayat', lat: 9.0250, lng: 38.8450, keywords: ['cmc', 'ሲኤምሲ', 'ayat', 'አያት', 'semit', 'ሰሚት', 'goro', 'ጎሮ', 'abado', 'አባዶ'] },
];

/* ── Main MapPage Component ──────────────────────────────── */
export default function MapPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Core data state initialized with 100 authentic stations from map.et
  const [stations, setStations] = useState<Station[]>(REAL_STATIONS);
  const [lines, setLines] = useState<Line[]>(REAL_LINES);
  // Selection & Route state
  const [selected, setSelected] = useState<Station | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [flyTo, setFlyTo] = useState<{ pos: [number, number]; zoom: number } | null>(null);
  const [locError, setLocError] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isPickingLocationOnMap, setIsPickingLocationOnMap] = useState(false);
  const [locationToast, setLocationToast] = useState('');
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [permissionChecking, setPermissionChecking] = useState(false);

  // Navigation & panels
  const [activeTab, setActiveTab] = useState<'map' | 'planner' | 'saved' | 'contribute' | 'profile'>('map');
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [activeTransitJourney, setActiveTransitJourney] = useState<TransitJourney | null>(null);
  const [plannerTargetStation, setPlannerTargetStation] = useState<Station | null>(null);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Filtering
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Walking route
  const [walkingRoute, setWalkingRoute] = useState<{
    station: Station;
    points: [number, number][];
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);

  // Map controls & orientation
  const [mapBearing, setMapBearing] = useState(0);
  const [rotationController, setRotationController] = useState<RotationController | null>(null);
  const mapControlsRef = useRef<{ zoomIn: () => void; zoomOut: () => void } | null>(null);

  // Data fetching: replaces old sample data with real map.et dataset and merges any verified user submissions
  const load = useCallback(async () => {
    try {
      const [{ data: st }, { data: li }] = await Promise.all([
        supabase.from('stations').select('*').in('status', ['active', 'closed']),
        supabase.from('lines').select('*'),
      ]);

      const realIds = new Set(REAL_STATIONS.map(s => s.id));
      const hasRealSeedInDb = st && st.some(s => realIds.has(s.id));

      if (hasRealSeedInDb) {
        setStations(st);
        setLines(li ?? []);
      } else {
        // Discard old mock sample stations; only keep user-created community contributions
        const userContributions = (st ?? []).filter(s => s.created_by != null);
        const userLines = (li ?? []).filter(l => userContributions.some(u => u.id === l.station_id));
        setStations([...REAL_STATIONS, ...userContributions]);
        setLines([...REAL_LINES, ...userLines]);
      }
    } catch (err) {
      console.warn('Failed loading remote stations, using local verified dataset', err);
      setStations(REAL_STATIONS);
      setLines(REAL_LINES);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Periodic background refresh every 5 min
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const updateUserLocation = useCallback((p: [number, number]) => {
    setUserPos(p);
    localStorage.setItem('tt-user-pos', JSON.stringify(p));
  }, []);

  // Compute readable name for the current location
  const userLocationName = useMemo(() => {
    if (!userPos) return '';
    // Check if within 1000m of an Addis neighborhood
    const closeNh = ADDIS_NEIGHBORHOODS.find(n =>
      distanceMetres(userPos[0], userPos[1], n.coords[0], n.coords[1]) < 1000
    );
    if (closeNh) {
      return i18n.language === 'am' ? closeNh.name_am : closeNh.name_en;
    }
    // Check closest station
    if (stations.length > 0) {
      let closest = stations[0];
      let minDist = Infinity;
      for (const s of stations) {
        const d = distanceMetres(userPos[0], userPos[1], s.lat, s.lng);
        if (d < minDist) { minDist = d; closest = s; }
      }
      if (minDist < 1200) {
        return pickName(closest.name_am, closest.name_en, i18n.language);
      }
    }
    return i18n.language === 'am' ? 'የአሁኑ መገኛ' : 'My Location';
  }, [userPos, stations, i18n.language]);

  // Request GPS Device Geolocation with robust high-accuracy and standard fallback
  const requestGPSLocation = useCallback((isManualClick = true) => {
    if (!navigator.geolocation) {
      setLocError(i18n.language === 'am' ? 'በዚህ ብሮውዘር ላይ ጂፒኤስ አይደገፍም' : 'Geolocation is not supported by your browser');
      setShowLocationPicker(true);
      return;
    }

    setPermissionChecking(true);
    setLocError('');

    const handleSuccess = (pos: GeolocationPosition) => {
      setPermissionChecking(false);
      setShowPermissionPrompt(false);
      const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];

      updateUserLocation(p);
      localStorage.setItem('tt-location-mode', 'auto');
      setFlyTo({ pos: p, zoom: 16.5 });

      const inEthiopia = p[0] >= 3.4 && p[0] <= 15.0 && p[1] >= 33.0 && p[1] <= 48.0;
      if (inEthiopia) {
        setLocationToast(i18n.language === 'am' ? 'መገኛህ በጂፒኤስ ተገኝቷል! 📍' : 'Location detected via GPS! 📍');
      } else {
        setLocationToast(i18n.language === 'am' ? 'ጂፒኤስ ተገኝቷል 📍' : 'GPS Location detected 📍');
      }
      setTimeout(() => setLocationToast(''), 4500);
    };

    const handleFinalError = (err?: GeolocationPositionError) => {
      setPermissionChecking(false);
      setShowPermissionPrompt(false);

      if (isManualClick) {
        let errorMsg = '';
        if (err?.code === 1) {
          // PERMISSION_DENIED
          errorMsg = i18n.language === 'am'
            ? 'የቦታ ፈቃድ በብሮውዘርዎ ተከልክሏል። እባክዎ በአድራሻ ማስገቢያው አጠገብ (🔒) ፈቃድ ይስጡ ወይም ሰፈርዎን ከታች ይምረጡ።'
            : 'Location access was denied in browser settings. Please click the lock icon (🔒) in your address bar to allow, or select your neighborhood below.';
        } else if (err?.code === 3) {
          // TIMEOUT
          errorMsg = i18n.language === 'am'
            ? 'የቦታ መፈለጊያ ጥያቄው ጊዜ አልቋል። እባክዎ ሰፈርዎን ወይም ካርታውን በእጅ ይምረጡ!'
            : 'Location request timed out. Please select your neighborhood or click on the map!';
        } else {
          errorMsg = i18n.language === 'am'
            ? 'የመሣሪያ ጂፒኤስ አልተገኘም። እባክዎ ሰፈርዎን ወይም ካርታውን በእጅ ይምረጡ!'
            : 'Device location unavailable. Please pick your neighborhood or click on the map!';
        }

        setLocError(errorMsg);
        setShowLocationPicker(true);
      }
    };

    // Stage 1: Attempt high accuracy (hardware GPS on mobile)
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        // If explicitly denied by user, do not retry
        if (err.code === 1) {
          handleFinalError(err);
          return;
        }
        // Stage 2: Automatic fallback to standard accuracy (Wi-Fi/IP location for laptops & desktops)
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (err2) => handleFinalError(err2),
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
  }, [i18n.language, updateUserLocation]);

  // Initial location load & permission query
  useEffect(() => {
    const saved = localStorage.getItem('tt-user-pos');
    const savedMode = localStorage.getItem('tt-location-mode'); // 'auto' | 'manual' | 'dismissed'

    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (Array.isArray(p) && p.length === 2 && typeof p[0] === 'number') {
          setUserPos([p[0], p[1]]);
          if (savedMode === 'manual') {
            return; // User explicitly selected manual location; keep it and don't prompt
          }
        }
      } catch {}
    } else {
      // Default to Megenagna / Signal hub
      setUserPos([ADDIS.lat, ADDIS.lng]);
    }

    // If permission has never been decided and geolocation is available
    if (navigator.geolocation && savedMode !== 'manual' && savedMode !== 'dismissed') {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then((status) => {
            if (status.state === 'granted') {
              requestGPSLocation(false);
            } else if (status.state === 'prompt') {
              setShowPermissionPrompt(true);
            }

            status.onchange = () => {
              if (status.state === 'granted') {
                requestGPSLocation(false);
                setShowPermissionPrompt(false);
              }
            };
          })
          .catch(() => {
            if (!saved) setShowPermissionPrompt(true);
          });
      } else {
        if (!saved) setShowPermissionPrompt(true);
      }
    }
  }, [requestGPSLocation]);

  // Center on transit journey when chosen
  useEffect(() => {
    if (activeTransitJourney && activeTransitJourney.geometrySegments.length > 0) {
      const allCoords: [number, number][] = [];
      activeTransitJourney.geometrySegments.forEach(seg => {
        seg.coordinates.forEach(c => allCoords.push(c));
      });
      if (allCoords.length > 0) {
        const minLat = Math.min(...allCoords.map(c => c[0]));
        const maxLat = Math.max(...allCoords.map(c => c[0]));
        const minLng = Math.min(...allCoords.map(c => c[1]));
        const maxLng = Math.max(...allCoords.map(c => c[1]));
        setFlyTo({ pos: [(minLat + maxLat) / 2, (minLng + maxLng) / 2], zoom: 13.8 });
      }
    }
  }, [activeTransitJourney]);

  // Hydrate real asphalt corridors for selected transit journey
  useEffect(() => {
    if (!activeTransitJourney) return;
    const needsRoadGeometry = activeTransitJourney.geometrySegments.some(s => s.coordinates.length <= 2);
    if (needsRoadGeometry) {
      let cancelled = false;
      hydrateJourneyWithRealRoads(activeTransitJourney).then(hydrated => {
        if (!cancelled) {
          setActiveTransitJourney(hydrated);
        }
      });
      return () => { cancelled = true; };
    }
  }, [activeTransitJourney]);

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      const target = userPos || [ADDIS.lat, ADDIS.lng];
      setFlyTo({ pos: target, zoom: 16 });
      setLocError(i18n.language === 'am' ? 'በኮምፒውተር ላይ ጂፒኤስ የለም፤ ሰማያዊውን ምልክት 📍 ወደምትፈልገው ቦታ ጎትተው!' : 'Using PC? Drag the blue pin 📍 to your exact location!');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setLocError('');
        updateUserLocation(p);
        setFlyTo({ pos: p, zoom: 16 });
      },
      () => {
        const target = userPos || [ADDIS.lat, ADDIS.lng];
        updateUserLocation(target);
        setFlyTo({ pos: target, zoom: 15.5 });
        setLocError(i18n.language === 'am'
          ? 'በኮምፒውተር ላይ ትክክለኛ ጂፒኤስ አይገኝም። ሰማያዊውን ምልክት 📍 ወደምትፈልገው ቦታ ጎትተው!'
          : 'Using PC/laptop? Drag the blue pin 📍 to your exact neighborhood!'
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  // Pedestrian Navigation
  const startWalkingNavigation = useCallback(async (originPos: [number, number], targetStation: Station) => {
    setSelected(null);
    setNearbyOpen(false);

    try {
      let url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${originPos[1]},${originPos[0]};${targetStation.lng},${targetStation.lat}?overview=full&geometries=geojson`;
      let res = await fetch(url).catch(() => null);

      if (!res || !res.ok) {
        url = `https://router.project-osrm.org/route/v1/walking/${originPos[1]},${originPos[0]};${targetStation.lng},${targetStation.lat}?overview=full&geometries=geojson`;
        res = await fetch(url).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const points: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          const streetDistance = Math.round(route.distance);
          const durationSeconds = Math.round(streetDistance / ADDIS_WALKING_SPEED_MPS);

          setWalkingRoute({
            station: targetStation,
            points,
            distanceMeters: streetDistance,
            durationSeconds,
          });
          setFlyTo({ pos: [(originPos[0] + targetStation.lat) / 2, (originPos[1] + targetStation.lng) / 2], zoom: 15.5 });
          return;
        }
      }
    } catch (err) {
      console.warn('Walking routing fallback applied', err);
    }

    const dist = Math.round(distanceMetres(originPos[0], originPos[1], targetStation.lat, targetStation.lng));
    const estimatedStreetMeters = Math.round(dist * URBAN_CIRCUITY_FACTOR);
    const durationSeconds = Math.round(estimatedStreetMeters / ADDIS_WALKING_SPEED_MPS);
    setWalkingRoute({
      station: targetStation,
      points: [originPos, [targetStation.lat, targetStation.lng]],
      distanceMeters: estimatedStreetMeters,
      durationSeconds,
    });
    setFlyTo({ pos: [(originPos[0] + targetStation.lat) / 2, (originPos[1] + targetStation.lng) / 2], zoom: 15.5 });
  }, []);

  const handleWalkMeThere = useCallback((targetStation: Station) => {
    if (userPos) {
      startWalkingNavigation(userPos, targetStation);
    } else {
      const fallbackOrigin: [number, number] = [ADDIS.lat, ADDIS.lng];
      updateUserLocation(fallbackOrigin);
      startWalkingNavigation(fallbackOrigin, targetStation);
    }
  }, [userPos, updateUserLocation, startWalkingNavigation]);

  // Handle URL "?walkTo=<id>"
  useEffect(() => {
    const walkToId = searchParams.get('walkTo');
    if (walkToId && stations.length > 0) {
      const target = stations.find(s => s.id === walkToId);
      if (target) {
        handleWalkMeThere(target);
        searchParams.delete('walkTo');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, stations, handleWalkMeThere, setSearchParams]);

  // Filter stations based on category and criteria
  const activeChip = CATEGORY_CHIPS.find(c => c.id === activeCategory);
  const filteredStations = useMemo(() => {
    return stations.filter(s => {
      if (activeChip && activeChip.id !== 'all') {
        const matchKeywords = activeChip.keywords || [];
        const sText = `${s.name_en ?? ''} ${s.name_am ?? ''} ${s.landmark_en ?? ''} ${s.landmark_am ?? ''}`.toLowerCase();
        const nameMatch = matchKeywords.some(k => sText.includes(k.toLowerCase()));
        const distMatch = activeChip.lat && activeChip.lng
          ? distanceMetres(activeChip.lat, activeChip.lng, s.lat, s.lng) < 3200
          : false;
        if (!nameMatch && !distMatch) return false;
      }
      return true;
    });
  }, [stations, activeChip]);

  // Mobile navigation tab handler
  const handleMobileTabSelect = (tab: 'map' | 'planner' | 'saved' | 'contribute' | 'profile') => {
    setActiveTab(tab);
    if (tab === 'map') {
      setSelected(null);
      setWalkingRoute(null);
      setActiveTransitJourney(null);
      setPlannerOpen(false);
      setNearbyOpen(false);
    } else if (tab === 'planner') {
      setSelected(null);
      setPlannerOpen(true);
    } else if (tab === 'saved') {
      setNearbyOpen(true);
    } else if (tab === 'contribute') {
      navigate('/add');
    } else if (tab === 'profile') {
      setShowProfile(true);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* ── 1. Top Navigation Bar ────────────────────────────── */}
      <TopNavbar
        stations={stations}
        lines={lines}
        lang={i18n.language}
        onSelectStation={(st) => {
          setSelected(st);
          setFlyTo({ pos: [st.lat, st.lng], zoom: 17 });
        }}
        onOpenPlanner={() => {
          setPlannerTargetStation(null);
          setPlannerOpen(true);
        }}
        onOpenAdd={() => navigate('/add')}
        user={user}
        profile={profile}
        onOpenProfile={() => setShowProfile(true)}
        locationName={userLocationName}
        onOpenLocationPicker={() => setShowLocationPicker(true)}
      />

      {/* ── 2. Split Workspace Layout (Urban Intelligence) ───── */}
      <div className="urban-app-layout">
        {/* Left Desktop Sidebar: Journey Planner or Selected Station Details */}
        <aside className="urban-desktop-sidebar">
          {selected && !activeTransitJourney ? (
            <StationDetailPanel
              station={selected}
              lines={lines}
              lang={i18n.language}
              userPos={userPos}
              onClose={() => setSelected(null)}
              onWalkMeThere={handleWalkMeThere}
              onPlanFromStation={(st) => {
                setSelected(null);
                setPlannerTargetStation(st);
                setPlannerOpen(true);
              }}
            />
          ) : (
            <DesktopJourneyPlanner
              userPos={userPos}
              stations={stations}
              lines={lines}
              lang={i18n.language}
              onSelectJourney={(j) => setActiveTransitJourney(j)}
              activeJourney={activeTransitJourney}
              initialDestinationStation={plannerTargetStation}
              onOpenLocationPicker={() => setShowLocationPicker(true)}
              onRequestGPS={() => requestGPSLocation(true)}
              permissionChecking={permissionChecking}
            />
          )}
        </aside>

        {/* Primary Map Canvas Viewport */}
        <main className="urban-map-viewport">
          {/* Subtle Category Chips Bar overlay on Map */}
          <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 820, maxWidth: 'calc(100% - 32px)' }}>
            <div className="urban-chips-bar">
              {CATEGORY_CHIPS.map(chip => (
                <button
                  key={chip.id}
                  type="button"
                  className={`urban-chip ${activeCategory === chip.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory(chip.id);
                    setSelected(null);
                    if (chip.lat && chip.lng) {
                      setFlyTo({ pos: [chip.lat, chip.lng], zoom: 15.5 });
                    } else {
                      setFlyTo({ pos: [ADDIS.lat, ADDIS.lng], zoom: 14 });
                    }
                  }}
                >
                  {i18n.language === 'am' ? chip.name : chip.en}
                </button>
              ))}
            </div>
          </div>

          {/* Active Route Dismissal Top Banner (Walking or Transit) */}
          {walkingRoute && (
            <div style={{
              position: 'absolute', top: 56, left: 16, right: 16, maxWidth: 460, margin: '0 auto', zIndex: 840,
              backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', padding: '10px 16px',
              border: '1px solid var(--color-primary)', boxShadow: 'var(--shadow-floating)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Footprints size={18} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)' }}>
                  {pickName(walkingRoute.station.name_am, walkingRoute.station.name_en, i18n.language)}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                  {formatDistance(walkingRoute.distanceMeters)}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: 28, height: 28, minHeight: 28, padding: 0 }}
                onClick={() => setWalkingRoute(null)}
                aria-label="Exit walking route"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {activeTransitJourney && (
            <div style={{
              position: 'absolute', top: 56, left: 16, right: 16, maxWidth: 520, margin: '0 auto', zIndex: 840,
              backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', padding: '10px 16px',
              border: '1px solid var(--color-primary)', boxShadow: 'var(--shadow-floating)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '1.2rem' }}>🔀</span>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i18n.language === 'am' ? activeTransitJourney.summaryTitle_am : activeTransitJourney.summaryTitle_en}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                    {activeTransitJourney.totalFareBirr} birr · ~{activeTransitJourney.totalDurationMinutes} min
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: 28, height: 28, minHeight: 28, padding: 0 }}
                onClick={() => {
                  setActiveTransitJourney(null);
                  setPlannerTargetStation(null);
                }}
                aria-label="Exit transit journey"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Permission Request Banner (Ask Location & Figure Out) */}
          {showPermissionPrompt && (
            <div className="location-permission-banner">
              <div className="location-permission-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(8, 126, 139, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary)',
                      flexShrink: 0,
                    }}
                  >
                    <Navigation size={16} />
                  </div>
                  <div className="location-permission-text">
                    <strong>{i18n.language === 'am' ? 'ያለህበትን ቦታ እንወቅ?' : 'Allow Location?'}</strong>
                    <span>
                      {i18n.language === 'am'
                        ? 'በአቅራቢያ ያሉ ታክሲ ተራዎችን ለማሳየት'
                        : 'To show nearby taxi teras & fares'}
                    </span>
                  </div>
                </div>

                <div className="location-permission-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ height: 32, fontSize: '0.78rem', padding: '0 12px' }}
                    onClick={() => requestGPSLocation(true)}
                    disabled={permissionChecking}
                  >
                    <Navigation size={13} />
                    {permissionChecking
                      ? (i18n.language === 'am' ? 'በመፈለግ...' : 'Finding...')
                      : (i18n.language === 'am' ? 'ጂፒኤስ (GPS)' : 'Use GPS')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ height: 32, fontSize: '0.78rem', padding: '0 10px' }}
                    onClick={() => {
                      setShowPermissionPrompt(false);
                      setShowLocationPicker(true);
                    }}
                  >
                    <MapPin size={13} />
                    {i18n.language === 'am' ? 'በእጅ ምረጥ' : 'Manual'}
                  </button>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px' }}
                    onClick={() => {
                      setShowPermissionPrompt(false);
                      localStorage.setItem('tt-location-mode', 'dismissed');
                    }}
                    aria-label="Dismiss"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
          {locError && (
            <div
              className="location-helper-pill"
              style={{
                position: 'absolute', bottom: 84, left: 16, right: 16, maxWidth: 440, margin: '0 auto',
                padding: '12px 16px', zIndex: 830, display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  💡 {locError}
                </span>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                  onClick={() => setLocError('')}
                >
                  <X size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Quick jump:</span>
                {[
                  { name: 'መገናኛ', en: 'Megenagna', coords: [9.0215, 38.8020] as [number, number] },
                  { name: 'ሜክሲኮ', en: 'Mexico', coords: [9.0110, 38.7450] as [number, number] },
                  { name: 'ቦሌ', en: 'Bole', coords: [8.9950, 38.7885] as [number, number] },
                  { name: 'ፒያሳ', en: 'Piassa', coords: [9.0345, 38.7525] as [number, number] },
                ].map(hub => (
                  <button
                    key={hub.en}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ height: 26, minHeight: 26, fontSize: '0.74rem', padding: '0 8px' }}
                    onClick={() => {
                      updateUserLocation(hub.coords);
                      setFlyTo({ pos: hub.coords, zoom: 16 });
                      setLocError('');
                    }}
                  >
                    {i18n.language === 'am' ? hub.name : hub.en}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ height: 26, minHeight: 26, fontSize: '0.74rem', padding: '0 8px' }}
                  onClick={() => {
                    setShowLocationPicker(true);
                    setLocError('');
                  }}
                >
                  {i18n.language === 'am' ? 'ሌሎች ሰፈሮች...' : 'All Hubs...'}
                </button>
              </div>
            </div>
          )}

          {/* Map Pin Pick Mode Banner */}
          {isPickingLocationOnMap && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 850,
                background: '#102A43',
                color: '#FFFFFF',
                padding: '10px 18px',
                borderRadius: 30,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                fontSize: '0.86rem',
                fontWeight: 600,
              }}
            >
              <span>📍 {i18n.language === 'am' ? 'ካርታው ላይ ያለህበትን ቦታ ጠቁም/ንካ' : 'Click anywhere on map to drop your pin'}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ height: 26, fontSize: '0.74rem', padding: '0 8px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}
                onClick={() => setIsPickingLocationOnMap(false)}
              >
                {i18n.language === 'am' ? 'ሰርዝ' : 'Cancel'}
              </button>
            </div>
          )}

          {/* Location Toast Notification */}
          {locationToast && (
            <div
              style={{
                position: 'absolute',
                bottom: 84,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 850,
                background: '#087E8B',
                color: '#FFFFFF',
                padding: '8px 18px',
                borderRadius: 20,
                fontSize: '0.84rem',
                fontWeight: 700,
                boxShadow: '0 6px 20px rgba(8,126,139,0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{locationToast}</span>
            </div>
          )}

          {/* Leaflet Map Canvas */}
          <MapContainer
            center={[ADDIS.lat, ADDIS.lng]}
            zoom={14}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
            {...({ rotate: true, touchRotate: true } as Record<string, unknown>)}
          >
            {/* OpenStreetMap Curated Low-Saturation Tiles with ODbL & map.et attribution */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &middot; Data: <a href="https://map.et" target="_blank" rel="noopener">map.et</a> / OpenPlaceGuide'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Map Rotation Support */}
            <MapRotationBridge
              onBearingChange={setMapBearing}
              onControllerReady={setRotationController}
            />

            {/* Controls Bridge for Zoom In/Out */}
            <MapControllerBridge
              onRegister={(controls) => {
                mapControlsRef.current = controls;
              }}
            />

            {/* Map Click for direct Pin Drop */}
            <MapClickHandler
              isPicking={isPickingLocationOnMap}
              onPick={(coords) => {
                updateUserLocation(coords);
                localStorage.setItem('tt-location-mode', 'manual');
                setIsPickingLocationOnMap(false);
                setFlyTo({ pos: coords, zoom: 16.5 });
                setLocationToast(i18n.language === 'am' ? 'መገኛህ ተስተካክሏል! 📍' : 'Location updated on map! 📍');
                setTimeout(() => setLocationToast(''), 4000);
              }}
            />

            {flyTo && <FlyTo pos={flyTo.pos} zoom={flyTo.zoom} />}

            {/* User Location Radar Pin */}
            {userPos && (
              <UserDot
                pos={userPos}
                onMove={(newPos) => {
                  updateUserLocation(newPos);
                  setLocationToast(i18n.language === 'am' ? 'ቦታህ ተስተካክሏል 📍' : 'Location pin updated 📍');
                  setTimeout(() => setLocationToast(''), 3000);
                }}
                onOpenPicker={() => setShowLocationPicker(true)}
                lang={i18n.language}
              />
            )}

            {/* Walking Navigation Polyline */}
            {walkingRoute && (
              <Polyline
                positions={walkingRoute.points}
                pathOptions={{
                  color: '#087E8B',
                  weight: 5,
                  opacity: 0.95,
                  dashArray: '6, 8',
                }}
              />
            )}

            {/* Transit Journey Polylines */}
            {activeTransitJourney && activeTransitJourney.geometrySegments.map((seg, idx) => (
              <Polyline
                key={`journey-seg-${idx}`}
                positions={seg.coordinates}
                pathOptions={{
                  color: seg.type === 'walk' ? '#102A43' : '#087E8B',
                  weight: seg.type === 'walk' ? 4 : 5.5,
                  opacity: seg.type === 'walk' ? 0.8 : 0.95,
                  dashArray: seg.type === 'walk' ? '4, 8' : undefined,
                }}
              />
            ))}

            {/* Stations Pins */}
            {filteredStations.map(s => {
              const isSelected = selected?.id === s.id;
              const pin = makeUrbanPin(s, isSelected, i18n.language);

              return (
                <Marker
                  key={s.id}
                  position={[s.lat, s.lng]}
                  icon={pin}
                  eventHandlers={{
                    click: () => {
                      setSelected(s);
                      setFlyTo({ pos: [s.lat, s.lng], zoom: 17 });
                    },
                  }}
                />
              );
            })}
          </MapContainer>

          {/* Grouped Map Controls Stack (Section 6) */}
          <div className="urban-map-controls-stack">
            {Boolean(Number.isFinite(mapBearing) && Math.abs(mapBearing) > 1) && (
              <button
                type="button"
                className="urban-map-control-btn"
                onClick={() => {
                  rotationController?.setBearing(0);
                  setMapBearing(0);
                }}
                title={i18n.language === 'am' ? 'ሰሜንን አስተካክል (0°)' : 'Reset North orientation'}
                aria-label="Reset North orientation"
              >
                <Compass size={19} color="var(--color-primary)" style={{ transform: `rotate(${-mapBearing}deg)` }} />
              </button>
            )}
            <button
              type="button"
              className="urban-map-control-btn"
              onClick={() => requestGPSLocation(true)}
              title={i18n.language === 'am' ? 'የአሁኑ መገኛዬን ፈልግ / ቀይር' : 'Find My Location / Change'}
              aria-label="Find My Location"
            >
              <Crosshair size={19} color="var(--color-primary)" />
            </button>
            <button
              type="button"
              className="urban-map-control-btn"
              onClick={() => mapControlsRef.current?.zoomIn()}
              title="Zoom In"
              aria-label="Zoom In"
            >
              <Plus size={19} />
            </button>
            <button
              type="button"
              className="urban-map-control-btn"
              onClick={() => mapControlsRef.current?.zoomOut()}
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <Minus size={19} />
            </button>
          </div>
        </main>
      </div>

      {/* ── 3. Mobile Floating Bottom Sheets (Mobile Only) ──── */}
      {/* Station Details Sheet on Mobile */}
      {selected && !activeTransitJourney && (
        <BottomSheet open={!!selected} onClose={() => setSelected(null)} className="mobile-only-bottom-sheet">
          <StationDetailPanel
            station={selected}
            lines={lines}
            lang={i18n.language}
            userPos={userPos}
            onClose={() => setSelected(null)}
            onWalkMeThere={handleWalkMeThere}
            onPlanFromStation={(st) => {
              setSelected(null);
              setPlannerTargetStation(st);
              setPlannerOpen(true);
            }}
          />
        </BottomSheet>
      )}

      {/* Mobile Journey Planner Sheet */}
      {plannerOpen && (
        <BottomSheet open={plannerOpen} onClose={() => setPlannerOpen(false)} className="mobile-only-bottom-sheet">
          <DesktopJourneyPlanner
            userPos={userPos}
            stations={stations}
            lines={lines}
            lang={i18n.language}
            onSelectJourney={(j) => {
              setActiveTransitJourney(j);
              if (j) setPlannerOpen(false);
            }}
            activeJourney={activeTransitJourney}
            initialDestinationStation={plannerTargetStation}
            onClose={() => setPlannerOpen(false)}
          />
        </BottomSheet>
      )}

      {/* Nearby Stations Sheet */}
      <NearbySheet
        open={nearbyOpen}
        onClose={() => setNearbyOpen(false)}
        userPos={userPos}
        stations={stations}
        lines={lines}
        lang={i18n.language}
        onSelectStation={(s) => {
          setSelected(s);
          setFlyTo({ pos: [s.lat, s.lng], zoom: 17 });
          setNearbyOpen(false);
        }}
        onWalkMeThere={handleWalkMeThere}
        onRequestLoc={handleNearMe}
      />

      {/* Profile & Contributor Bottom Sheet */}
      {showProfile && (
        <BottomSheet open={showProfile} onClose={() => setShowProfile(false)}>
          <div style={{ padding: '8px 4px 16px 4px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 4 }}>
              {profile?.display_name || user?.email || (i18n.language === 'am' ? 'የተጠቃሚ መለያ' : 'User Account')}
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
              {profile?.role === 'admin' ? '⭐ Admin' : profile?.role === 'trusted' ? '✓ Trusted contributor' : 'Contributor'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={() => {
                  setShowProfile(false);
                  navigate('/me');
                }}
              >
                📋 {t('myContributions')}
              </button>

              {profile?.role === 'admin' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-full"
                  onClick={() => {
                    setShowProfile(false);
                    navigate('/admin');
                  }}
                >
                  🛡️ Admin Moderation Queue
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={() => {
                  setShowProfile(false);
                  navigate('/about');
                }}
              >
                ℹ️ About Taxi Tera
              </button>

              {user ? (
                <button
                  type="button"
                  className="btn btn-danger btn-full"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setShowProfile(false);
                  }}
                >
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setShowProfile(false);
                    navigate('/login');
                  }}
                >
                  Sign In / Register
                </button>
              )}
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ── 4. Mobile Bottom Navigation Bar (Section 12) ────── */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleMobileTabSelect}
        lang={i18n.language}
      />

      {/* ── 5. Location Correction & Picker Modal ─────────────── */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        lang={i18n.language}
        currentPos={userPos}
        stations={stations}
        lines={lines}
        onSelectCoords={(coords, label) => {
          updateUserLocation(coords);
          localStorage.setItem('tt-location-mode', 'manual');
          setFlyTo({ pos: coords, zoom: 16.5 });
          setLocError('');
          setShowPermissionPrompt(false);
          if (label) {
            setLocationToast(i18n.language === 'am' ? `መገኛህ ወደ ${label} ተቀይሯል! 📍` : `Location set to ${label}! 📍`);
            setTimeout(() => setLocationToast(''), 4000);
          }
        }}
        onStartMapPick={() => {
          setIsPickingLocationOnMap(true);
        }}
        onRequestDeviceGPS={() => requestGPSLocation(true)}
      />
    </div>
  );
}
