import React, { useEffect, useMemo, useRef, useState } from "react";
import DialogShell from "./DialogShell.jsx";
import DurationInput from "./DurationInput.jsx";
import FaviconBadge from "./FaviconBadge.jsx";
import { buildFaviconUrl, clampMinutes, hostnameFromUrl, normalizeUrl } from "../lib/utils.js";

export default function AddEditModal({ initial, defaultDurationMs, onClose, onSave }) {
  const inputRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [url, setUrl] = useState(initial?.url || "");
  const [label, setLabel] = useState(initial?.label || "");
  const [scope, setScope] = useState(initial?.scope || "domain");
  const [minutes, setMinutes] = useState(
    initial ? Math.round(initial.durationMs / 60_000) : Math.max(1, Math.round(defaultDurationMs / 60_000)),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const host = normalizedUrl ? hostnameFromUrl(normalizedUrl) : "";
  const favicon = normalizedUrl ? buildFaviconUrl(normalizedUrl) : null;
  const isValid = Boolean(normalizedUrl) && minutes > 0;

  useEffect(() => {
    if (!host) {
      return;
    }

    if (!initial?.label && !label) {
      setLabel(host);
    }
  }, [host, initial?.label, label]);

  const save = async () => {
    if (isSubmitting) {
      return;
    }

    const safeMinutes = clampMinutes(minutes, Math.max(1, Math.round(defaultDurationMs / 60_000)));
    const safeUrl = normalizeUrl(url);
    if (!safeUrl) {
      setFormError("Introduce una URL valida.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const hostName = hostnameFromUrl(safeUrl);
      const durationMs = Math.max(60_000, safeMinutes * 60_000);
      const now = Date.now();

      await onSave({
        id: initial?.id,
        url: safeUrl,
        label: (label || hostName).trim(),
        scope,
        durationMs,
        endAt: initial?.endAt ?? null,
        lastVisitedAt: initial?.lastVisitedAt ?? null,
        favicon: buildFaviconUrl(safeUrl),
        createdAt: initial?.createdAt ?? now,
      });
    } catch (error) {
      setFormError(error.message || "No se pudo guardar el sitio.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <DialogShell
      titleId="site-modal-title"
      descriptionId="site-modal-description"
      onClose={onClose}
      initialFocusRef={inputRef}
      panelClassName="overflow-hidden"
    >
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="site-modal-title" className="text-xl font-semibold text-slate-900">
              {initial ? "Editar sitio" : "Anadir nuevo sitio"}
            </h2>
            <p id="site-modal-description" className="mt-1 text-sm text-slate-500">
              {initial
                ? "Actualiza el sitio y su configuracion de cooldown."
                : "Define la URL, el nombre visible y la duracion del nuevo cooldown."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar formulario"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
        <div className="flex justify-center">
          <div className="relative">
            <FaviconBadge
              src={favicon}
              label={label || host}
              sizeClassName="h-16 w-16"
              imageClassName="h-8 w-8"
            />
            {normalizedUrl ? (
              <div className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-blue-500 text-white shadow-sm">
                <CheckIcon />
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="site-url" className="block text-sm font-medium text-slate-700">
            URL del sitio
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <LinkIcon />
            </div>
            <input
              id="site-url"
              ref={inputRef}
              type="text"
              placeholder="https://ejemplo.com"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setFormError("");
              }}
              className="block w-full rounded-2xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  save();
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="site-label" className="block text-sm font-medium text-slate-700">
            Nombre personalizado {label ? <span className="text-slate-400">({label.length}/30)</span> : null}
          </label>
          <input
            id="site-label"
            type="text"
            placeholder="Mi sitio web"
            maxLength={30}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="block w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                save();
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="site-duration" className="block text-sm font-medium text-slate-700">
            Tiempo de cooldown
          </label>
          <DurationInput inputId="site-duration" minutes={minutes} onChangeMinutes={setMinutes} />
        </div>

        <div className="space-y-3 pt-2">
          <span className="block text-sm font-medium text-slate-700">Ambito de bloqueo</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ScopeButton
              selected={scope === "domain"}
              title="Dominio completo"
              description="Bloquea cualquier pagina del dominio."
              onClick={() => setScope("domain")}
            />
            <ScopeButton
              selected={scope === "exact"}
              title="URL exacta"
              description="Solo aplica al enlace guardado."
              onClick={() => setScope("exact")}
            />
          </div>
        </div>

        {formError ? <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!isValid || isSubmitting}
          className={`rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition ${
            !isValid || isSubmitting ? "cursor-not-allowed bg-blue-300" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isSubmitting ? (initial ? "Guardando..." : "Anadiendo...") : initial ? "Guardar cambios" : "Anadir sitio"}
        </button>
      </div>
    </DialogShell>
  );
}

function ScopeButton({ selected, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-2 p-4 text-left transition ${
        selected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
            selected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent"
          }`}
        >
          <CheckIcon />
        </div>
        <span className="font-medium text-slate-800">{title}</span>
      </div>
      <p className="mt-2 pl-8 text-xs text-slate-500">{description}</p>
    </button>
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

function CheckIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 1 1 0 001.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
        clipRule="evenodd"
      />
    </svg>
  );
}
