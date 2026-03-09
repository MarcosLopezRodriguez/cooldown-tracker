import { useMemo, useState } from "react";

import { hhmmss, hostnameFromUrl } from "../lib/sites";

function SiteCard({ item, now, onEdit, onDelete, onStart, onReset, onOpen }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const ready = !item.endAt || item.endAt <= now;
  const host = hostnameFromUrl(item.url);
  const status = ready ? "Listo" : hhmmss(Math.max(0, item.endAt - now));

  const progress = useMemo(() => {
    if (!item.endAt || !item.lastVisitedAt) return 0;
    const total = item.durationMs;
    const elapsed = Math.min(total, Math.max(0, now - item.lastVisitedAt));
    return Math.round((elapsed / total) * 100);
  }, [item.durationMs, item.endAt, item.lastVisitedAt, now]);

  return (
    <div className="group relative rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      <div className={`absolute top-0 left-0 w-1.5 h-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center overflow-hidden border border-slate-100">
            {item.favicon && !faviconFailed ? (
              <img
                src={item.favicon}
                alt=""
                className="w-6 h-6"
                onError={() => setFaviconFailed(true)}
              />
            ) : (
              <span className="text-xl text-slate-400">*</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg font-semibold text-slate-900 truncate">{item.label || host}</h3>
              <span className={`ml-2 text-xs px-2 py-1 rounded-full font-medium ${
                ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {ready ? "Listo" : "En cooldown"}
              </span>
              <span className="ml-auto text-sm font-mono tabular-nums text-slate-500">{status}</span>
            </div>

            <p className="mt-1 text-sm text-slate-500 truncate">
              {item.scope === "domain" ? host : item.url}
            </p>

            {!ready && (
              <div className="mt-3 space-y-1">
                <div className="text-xs text-slate-500 flex justify-between">
                  <span>Progreso</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      progress > 80 ? "bg-emerald-500" : "bg-blue-500"
                    } transition-all duration-300`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
          <button
            onClick={onOpen}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Abrir
          </button>

          <button
            onClick={onStart}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Marcar visitado
          </button>

          {!ready && (
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Reiniciar
            </button>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Editar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>

            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
              title="Eliminar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SiteCard };
