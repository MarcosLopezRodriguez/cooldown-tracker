import React from "react";

export default function EmptyState({ onAdd }) {
  return (
    <div className="mt-20 rounded-[2rem] border border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
        <HourglassIcon />
      </div>
      <h2 className="mt-6 text-2xl font-semibold text-slate-900">Aun no hay sitios</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
        Anade webs que visitas con frecuencia para crear cooldowns personalizados y decidir cuando puedes volver.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Anadir primer sitio
      </button>
    </div>
  );
}

function HourglassIcon() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6 2a1 1 0 000 2v1a4 4 0 001.43 3.07L9.59 10l-2.16 1.93A4 4 0 006 15v1a1 1 0 102 0v-1a2 2 0 01.72-1.53L11.08 11l-2.36-2.47A2 2 0 018 7V4a1 1 0 10-2 0V4h8v1a2 2 0 01-.72 1.53L10.92 9l2.36 2.47A2 2 0 0114 13v3a1 1 0 102 0v-3a4 4 0 00-1.43-3.07L12.41 8l2.16-1.93A4 4 0 0016 3V2a1 1 0 10-2 0H6z" />
    </svg>
  );
}
