import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface Toast { id: string; message: string; type: 'default' | 'success' | 'danger'; }
interface ToastCtx { show: (msg: string, type?: Toast['type']) => void; }

const ToastContext = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: Toast['type'] = 'default') => {
    const id = crypto.randomUUID();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type !== 'default' ? t.type : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ── Generic BottomSheet ──────────────────────────────────── */
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
}

export function BottomSheet({ open, onClose, children, className = '', overlayClassName = '' }: BottomSheetProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className={`bottom-sheet-overlay ${overlayClassName}`} onClick={onClose} aria-hidden />
      <div className={`bottom-sheet ${className}`} role="dialog" aria-modal>
        <div className="bottom-sheet-handle" aria-hidden />
        <div className="bottom-sheet-inner">{children}</div>
      </div>
    </>
  );
}

/* ── Spinner ─────────────────────────────────────────────── */
export function Spinner({ overlay = false }: { overlay?: boolean }) {
  if (overlay) return <div className="spinner-overlay"><div className="spinner" /></div>;
  return <div className="spinner" />;
}

/* ── EmptyState ──────────────────────────────────────────── */
interface EmptyStateProps {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}
export function EmptyState({ icon = '🗺️', title, body, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {body && <p className="empty-state-body">{body}</p>}
      {action}
    </div>
  );
}

/* ── TextField ───────────────────────────────────────────── */
interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}
export function TextField({ label, hint, error, id, className = '', ...props }: TextFieldProps) {
  const inputId = id ?? `field-${label}`;
  return (
    <div className="field">
      {label && <label className="field-label" htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        className={`input ${error ? 'has-error' : ''} ${className}`}
        {...props}
      />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

/* ── TextArea ────────────────────────────────────────────── */
interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}
export function TextArea({ label, hint, error, id, className = '', ...props }: TextAreaProps) {
  const inputId = id ?? `area-${label}`;
  return (
    <div className="field">
      {label && <label className="field-label" htmlFor={inputId}>{label}</label>}
      <textarea
        id={inputId}
        className={`input ${error ? 'has-error' : ''} ${className}`}
        {...props}
      />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

/* ── Tag ─────────────────────────────────────────────────── */
type TagVariant = 'pending' | 'approved' | 'rejected' | 'new' | 'edit' | 'report';
export function Tag({ variant, children }: { variant: TagVariant; children: React.ReactNode }) {
  return <span className={`tag tag-${variant}`}>{children}</span>;
}

/* ── Skeleton ────────────────────────────────────────────── */
export function Skeleton({ width, height, className = '' }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: width ?? '100%', height: height ?? '16px' }}
      aria-hidden
    />
  );
}

/* ── Upload progress bar ─────────────────────────────────── */
export function UploadBar({ progress }: { progress: number }) {
  return (
    <div className="upload-bar-wrap">
      <div className="upload-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}
