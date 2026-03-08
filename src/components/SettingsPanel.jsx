import React, { useRef, useState } from "react";
import DialogShell from "./DialogShell.jsx";
import DurationInput from "./DurationInput.jsx";

export default function SettingsPanel({
  settings,
  setSettings,
  onClose,
  onExport,
  onImport,
  onToggleNotifications,
  notifSupported,
  permission,
}) {
  const closeButtonRef = useRef(null);
  const [importMessage, setImportMessage] = useState(null);

  const defaultMinutes = Math.max(1, Math.round(settings.defaultDurationMs / 60000));

  const handleImportChange = async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    try {
      await onImport(file);
      setImportMessage({
        tone: "success",
        text: "Datos importados correctamente.",
      });
    } catch (error) {
      setImportMessage({
        tone: "error",
        text: error.message || "No se pudo importar el archivo.",
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <DialogShell
      variant="side"
      titleId="settings-title"
      descriptionId="settings-description"
      onClose={onClose}
      initialFocusRef={closeButtonRef}
      panelClassName="max-w-lg"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 id="settings-title" className="text-xl font-semibold text-slate-900">
            Configuracion
          </h2>
          <p id="settings-description" className="mt-1 text-sm text-slate-500">
            Ajusta notificaciones, sonidos y la duracion por defecto de nuevos sitios.
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Cerrar configuracion"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
        <section className="space-y-4 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Duracion por defecto</h3>
            <p className="mt-1 text-sm text-slate-500">
              Se aplica a los sitios nuevos. Los existentes conservan su duracion actual.
            </p>
          </div>
          <DurationInput
            inputId="default-duration"
            minutes={defaultMinutes}
            onChangeMinutes={(minutes) =>
              setSettings((currentSettings) => ({
                ...currentSettings,
                defaultDurationMs: minutes * 60_000,
              }))
            }
          />
        </section>

        <section className="space-y-4 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Notificaciones</h3>
              <p className="mt-1 text-sm text-slate-500">
                Recibe avisos cuando un cooldown termina.
              </p>
            </div>
            <Toggle
              checked={settings.notificationsOn}
              disabled={!notifSupported}
              onClick={async () => {
                const nextValue = await onToggleNotifications();
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  notificationsOn: nextValue,
                }));
              }}
              srLabel="Activar notificaciones"
            />
          </div>
          <p className="text-xs text-slate-500">
            {!notifSupported
              ? "No disponibles en este navegador."
              : permission === "granted"
                ? "Permiso concedido."
                : permission === "denied"
                  ? "Permiso bloqueado en el navegador."
                  : "Se solicitara permiso al activarlas."}
          </p>
        </section>

        <section className="space-y-4 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Sonido</h3>
              <p className="mt-1 text-sm text-slate-500">
                Reproduce un aviso de audio cuando un cooldown termina.
              </p>
            </div>
            <Toggle
              checked={settings.soundOn}
              onClick={() =>
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  soundOn: !currentSettings.soundOn,
                }))
              }
              srLabel="Activar sonido"
            />
          </div>
        </section>

        <section className="space-y-4 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Datos</h3>
            <p className="mt-1 text-sm text-slate-500">
              Exporta un respaldo o importa datos guardados previamente.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onExport}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <DownloadIcon />
              Exportar datos
            </button>

            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <UploadIcon />
              Importar datos
              <input type="file" className="hidden" accept=".json" onChange={handleImportChange} />
            </label>

            {importMessage ? (
              <p
                className={`rounded-xl px-3 py-2 text-sm ${
                  importMessage.tone === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {importMessage.text}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </DialogShell>
  );
}

function Toggle({ checked, disabled = false, onClick, srLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition ${
        checked ? "bg-blue-600" : "bg-slate-200"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span className="sr-only">{srLabel}</span>
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
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

function DownloadIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}
