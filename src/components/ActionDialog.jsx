import { useEffect, useRef } from "react";

function ActionDialog({
  title,
  message,
  primaryLabel,
  secondaryLabel,
  tone = "default",
  onPrimary,
  onSecondary,
  onClose,
}) {
  const primaryRef = useRef(null);

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const primaryClassName = tone === "danger"
    ? "bg-rose-600 hover:bg-rose-700"
    : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-dialog-title"
      >
        <h2 id="action-dialog-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onSecondary}
            className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {secondaryLabel}
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={onPrimary}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg text-white transition-colors ${primaryClassName}`}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ActionDialog };
