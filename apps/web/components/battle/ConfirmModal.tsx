'use client';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = 'cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-lg border border-border-subtle bg-bg-panel overflow-hidden shadow-lg">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated px-3 py-1.5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[10px] text-text-muted ml-1">{title}</span>
          </div>
        </div>
        {/* Content */}
        <div className="p-4 font-mono text-sm">
          <p className="text-text-primary mb-4">
            <span className="text-error">$</span> {message}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              className="flex-1 rounded border border-error/30 bg-error/10 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/20"
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 rounded border border-border-medium bg-transparent px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-white/[0.04]"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
