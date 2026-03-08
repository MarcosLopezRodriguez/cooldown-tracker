import React from "react";
import DialogShell from "./DialogShell.jsx";

function toneClassName(tone) {
  switch (tone) {
    case "danger":
      return "bg-rose-600 text-white hover:bg-rose-700";
    case "primary":
      return "bg-blue-600 text-white hover:bg-blue-700";
    default:
      return "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  }
}

export default function ActionDialog({ title, description, actions, onClose }) {
  return (
    <DialogShell titleId="action-dialog-title" descriptionId="action-dialog-description" onClose={onClose}>
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="action-dialog-title" className="text-xl font-semibold text-slate-900">
              {title}
            </h2>
            <p id="action-dialog-description" className="mt-2 text-sm text-slate-500">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar dialogo"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3 px-6 py-5">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onSelect}
            className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${toneClassName(action.tone)}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </DialogShell>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}
