import { useEffect, useState } from "react";

import { normalizeSettings } from "../lib/sites";

function SettingsPanel({
  settings,
  setSettings,
  notifSupported,
  permission,
  onExport,
  onImport,
  onToggleNotifications,
  onToast,
  onClose,
}) {
  const [showImportSuccess, setShowImportSuccess] = useState(false);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const imported = await onImport(file);
      if (imported) {
        setShowImportSuccess(true);
        setTimeout(() => setShowImportSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Error al importar datos:", error);
      onToast("Error al importar datos. El archivo no es valido.");
    } finally {
      event.target.value = "";
    }
  };

  const notificationLabel = !notifSupported
    ? "No disponible en este navegador"
    : permission === "granted"
      ? "Permiso concedido"
      : permission === "denied"
        ? "Permiso denegado"
        : "Permiso pendiente";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg transform transition-all duration-300 hover:shadow-xl">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Configuracion
        </h2>
      </div>

      <div className="divide-y divide-slate-100">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Notificaciones</h3>
              <p className="text-sm text-slate-500">Recibir notificaciones cuando un temporizador termine</p>
              <p className="mt-1 text-xs text-slate-400">{notificationLabel}</p>
            </div>
            <button
              type="button"
              className={`${
                settings.notificationsOn ? "bg-blue-600" : "bg-slate-200"
              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              onClick={onToggleNotifications}
            >
              <span className="sr-only">Activar notificaciones</span>
              <span
                className={`${
                  settings.notificationsOn ? "translate-x-5" : "translate-x-0"
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Sonido</h3>
              <p className="text-sm text-slate-500">Reproducir sonido al finalizar un temporizador</p>
            </div>
            <button
              type="button"
              className={`${
                settings.soundOn ? "bg-blue-600" : "bg-slate-200"
              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              onClick={() => setSettings((prev) => normalizeSettings({ ...prev, soundOn: !prev.soundOn }))}
            >
              <span className="sr-only">Activar sonido</span>
              <span
                className={`${
                  settings.soundOn ? "translate-x-5" : "translate-x-0"
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </button>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Datos</h3>
          <div className="space-y-3">
            <button
              type="button"
              onClick={onExport}
              className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar datos
            </button>

            <div>
              <label className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Importar datos
                <input type="file" className="hidden" onChange={handleImport} accept=".json" />
              </label>
              {showImportSuccess && (
                <p className="mt-2 text-sm text-green-600">Datos importados correctamente.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SettingsPanel };
