import { useEffect } from 'react';

type Props = {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  destructive = true,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') onConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 np-anim"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-panel rounded-3xl p-6 w-full max-w-md"
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              destructive
                ? 'bg-red-500/15 text-red-300'
                : 'bg-white/10 text-white/80'
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              {destructive ? (
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              ) : (
                <path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM11 9h2V7h-2v2z" />
              )}
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight">{title}</h2>
            {message && (
              <div className="text-sm text-white/65 mt-2 leading-relaxed">
                {message}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="glass-button"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={destructive ? 'danger-button' : 'primary-button'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
