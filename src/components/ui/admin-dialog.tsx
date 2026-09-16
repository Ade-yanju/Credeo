"use client";

import { useEffect, useRef, useState } from "react";

export interface AdminDialogProps {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Consistent in-app replacement for browser alert/confirm dialogs in admin. */
export function AdminDialog({
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
}: AdminDialogProps) {
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  async function confirm() {
    if (!onConfirm) return onClose();
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
        className="w-full max-w-md rounded-xl border border-[#334238] bg-[#111812] p-5 shadow-2xl"
      >
        <h2 id="admin-dialog-title" className="text-base font-semibold text-[#f2f7f2]">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#d5ddd6]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          {onConfirm && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-[#d5ddd6] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={confirm}
            disabled={busy}
            className="min-w-20 rounded-full border-2 border-[#54c979] bg-[#91e6a5] px-5 py-2 text-sm font-semibold text-[#102316] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.35)] transition-transform hover:scale-[1.02] disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Please wait…" : onConfirm ? confirmLabel : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
