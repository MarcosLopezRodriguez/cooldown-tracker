import React from "react";
import FaviconBadge from "./FaviconBadge.jsx";
import { formatClock } from "../lib/utils.js";
import { getSiteView } from "../lib/sites.js";

export default function SiteCard({ item, now, onOpen, onStart, onReset, onClear, onEdit, onDelete }) {
  const view = getSiteView(item, now);
  const statusText = view.ready ? "Listo" : formatClock(view.remaining);

  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${view.ready ? "bg-emerald-500" : "bg-amber-500"}`} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          <FaviconBadge src={item.favicon} label={item.label || view.host} />

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold text-slate-900">{item.label || view.host}</h3>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {item.scope === "domain" ? view.host : item.url}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    view.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {view.ready ? "Listo" : "En cooldown"}
                </span>
                <div className="mt-2 font-mono text-sm tabular-nums text-slate-500">{statusText}</div>
              </div>
            </div>

            {!view.ready ? (
              <div className="mt-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progreso</span>
                  <span>{view.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${view.progress > 80 ? "bg-emerald-500" : "bg-blue-500"}`}
                    style={{ width: `${view.progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            <PlayIcon />
            Abrir
          </button>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ClockIcon />
            Marcar visitado
          </button>

          {!view.ready ? (
            <>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshIcon />
                Reiniciar
              </button>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Limpiar
              </button>
            </>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              title="Editar"
              aria-label="Editar sitio"
            >
              <EditIcon />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
              title="Eliminar"
              aria-label="Eliminar sitio"
            >
              <DeleteIcon />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}
