import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_SETTINGS,
  hostnameFromUrl,
  normalizeScope,
  normalizeUrl,
  uid,
} from "../lib/sites";
import { DurationInput } from "./DurationInput";

function AddEditModal({ initial, defaultDurationMs, onClose, onSave }) {
  const [url, setUrl] = useState(initial?.url || "");
  const [label, setLabel] = useState(initial?.label || "");
  const [minutes, setMinutes] = useState(
    initial
      ? Math.round(initial.durationMs / 60000)
      : Math.max(1, Math.round((defaultDurationMs || DEFAULT_SETTINGS.defaultDurationMs) / 60000)),
  );
  const [scope, setScope] = useState(normalizeScope(initial?.scope));
  const [favicon, setFavicon] = useState(initial?.favicon || null);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [urlError, setUrlError] = useState("");
  const inputRef = useRef();

  useEffect(() => {
    inputRef.current?.focus();
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

  useEffect(() => {
    const normalized = normalizeUrl(url);
    const host = normalized ? hostnameFromUrl(normalized) : "";

    if (host) {
      setFavicon(`https://www.google.com/s2/favicons?domain=${host}&sz=64`);
      if (!label && !initial?.label) {
        setLabel(host);
      }
      setUrlError("");
    } else if (url.trim()) {
      setFavicon(null);
      setUrlError("Introduce una URL valida.");
    } else {
      setFavicon(null);
      setUrlError("");
    }

    setIsValid(!!normalized && minutes > 0);
  }, [initial, label, minutes, url]);

  const save = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const normalized = normalizeUrl(url);
      if (!normalized) {
        setUrlError("Introduce una URL valida.");
        return;
      }

      const host = hostnameFromUrl(normalized);
      const nextFavicon = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null;
      const now = Date.now();
      const durationMs = Math.max(60000, minutes * 60000);

      await onSave({
        id: initial?.id || uid(),
        url: normalized,
        label: label || host,
        scope,
        durationMs,
        endAt: initial?.endAt ?? null,
        lastVisitedAt: initial?.lastVisitedAt ?? null,
        favicon: nextFavicon,
        createdAt: initial?.createdAt || now,
        updatedAt: now,
      });
      onClose();
    } catch (error) {
      console.error("Error saving site:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl transform transition-all"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-modal-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 bg-white border-b border-slate-100 rounded-t-2xl">
          <div>
            <h2 id="site-modal-title" className="text-xl font-semibold text-slate-900">
              {initial ? "Editar sitio" : "Anadir nuevo sitio"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {initial ? "Actualiza los detalles del sitio" : "Configura un nuevo sitio para rastrear"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-500 transition-colors"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                {favicon && !faviconFailed ? (
                  <img
                    src={favicon}
                    alt=""
                    className="w-8 h-8"
                    onError={() => setFaviconFailed(true)}
                  />
                ) : (
                  <span className="text-2xl text-slate-300">*</span>
                )}
              </div>
              {url && (
                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-md border border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="url" className="block text-sm font-medium text-slate-700">
              URL del sitio
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 1 1 0 001.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                id="url"
                ref={inputRef}
                type="text"
                placeholder="https://ejemplo.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(event) => event.key === "Enter" && save()}
              />
            </div>
            {urlError && <p className="text-sm text-rose-600">{urlError}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="label" className="block text-sm font-medium text-slate-700">
              Nombre personalizado {label && <span className="text-slate-400 font-normal">({label.length}/30)</span>}
            </label>
            <div className="relative">
              <input
                id="label"
                type="text"
                placeholder="Mi sitio web"
                value={label}
                maxLength={30}
                onChange={(event) => setLabel(event.target.value)}
                className="block w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(event) => event.key === "Enter" && save()}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Tiempo de cooldown
            </label>
            <DurationInput minutes={minutes} onChangeMinutes={setMinutes} />
          </div>

          <div className="space-y-2 pt-2">
            <span className="block text-sm font-medium text-slate-700">Ambito de bloqueo</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScope("domain")}
                className={`p-3 text-left rounded-xl border-2 transition-all ${
                  scope === "domain"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    scope === "domain"
                      ? "border-blue-500 bg-blue-500"
                      : "border-slate-300 bg-white"
                  }`}>
                    {scope === "domain" && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-slate-800">Dominio completo</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 text-left pl-7">
                  Bloquear todo el dominio (ej: ejemplo.com/*)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setScope("exact")}
                className={`p-3 text-left rounded-xl border-2 transition-all ${
                  scope === "exact"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    scope === "exact"
                      ? "border-blue-500 bg-blue-500"
                      : "border-slate-300 bg-white"
                  }`}>
                    {scope === "exact" && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-slate-800">URL exacta</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 text-left pl-7">
                  Solo bloquear la URL especifica
                </p>
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 rounded-b-2xl">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!isValid || isSubmitting}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg text-white transition-colors ${
                !isValid || isSubmitting
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {initial ? "Guardando..." : "Anadiendo..."}
                </span>
              ) : initial ? (
                "Guardar cambios"
              ) : (
                "Anadir sitio"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AddEditModal };
