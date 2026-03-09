import { useEffect, useMemo, useRef, useState } from "react";

import { ActionDialog } from "./components/ActionDialog";
import { AddEditModal } from "./components/AddEditModal";
import { EmptyState } from "./components/EmptyState";
import { SettingsPanel } from "./components/SettingsPanel";
import { SiteCard } from "./components/SiteCard";
import { ToastViewport } from "./components/ToastViewport";
import { useNotificationCenter } from "./hooks/useNotificationCenter";
import { useToasts } from "./hooks/useToasts";
import {
  buildExportPayload,
  deriveVisibleSites,
  download,
  expireCooldowns,
  normalizeSite,
  normalizeUrl,
  parseImportPayload,
} from "./lib/sites";
import { loadSettings, loadState, saveSettings, saveState } from "./lib/storage";

export default function CooldownApp() {
  const [items, setItems] = useState(loadState);
  const [settings, setSettings] = useState(loadSettings);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dialogState, setDialogState] = useState(null);
  const { toasts, push } = useToasts();
  const { notifSupported, notifyItemReady, permission, toggleNotifications } = useNotificationCenter({
    notificationsOn: settings.notificationsOn,
    soundOn: settings.soundOn,
    setSettings,
    push,
  });
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    const intervalId = setInterval(() => {
      const tickNow = Date.now();
      setNow(tickNow);
      setItems((prev) => {
        const { changed, expired, next } = expireCooldowns(prev, tickNow);
        expired.forEach((item) => {
          const key = `${item.id}:${item.endAt}`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            notifyItemReady(item);
          }
        });
        if (changed) {
          saveState(next);
        }

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [notifyItemReady]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const shown = useMemo(() => {
    return deriveVisibleSites(items, { filter, now, query: q });
  }, [filter, items, now, q]);

  const upsertItem = (draft) => {
    const timestamp = Date.now();
    setItems((prev) => {
      const normalizedDraft = normalizeSite(draft);
      if (!normalizedDraft) return prev;

      const exists = prev.find((item) => item.id === normalizedDraft.id);
      const next = exists
        ? prev.map((item) => (
          item.id === normalizedDraft.id
            ? { ...item, ...normalizedDraft, updatedAt: timestamp }
            : item
        ))
        : [...prev, { ...normalizedDraft, createdAt: timestamp, updatedAt: timestamp }];

      saveState(next);
      return next;
    });
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveState(next);
      return next;
    });
  };

  const startCooldown = (id, fromOpen = false) => {
    const timestamp = Date.now();
    setItems((prev) => {
      const next = prev.map((item) => (
        item.id === id
          ? { ...item, lastVisitedAt: timestamp, endAt: timestamp + item.durationMs, updatedAt: timestamp }
          : item
      ));
      saveState(next);
      return next;
    });

    if (!fromOpen) {
      push("Cooldown iniciado");
    }
  };

  const resetCooldown = (id) => {
    const timestamp = Date.now();
    setItems((prev) => {
      const next = prev.map((item) => (
        item.id === id
          ? { ...item, endAt: timestamp + item.durationMs, updatedAt: timestamp }
          : item
      ));
      saveState(next);
      return next;
    });
    push("Reiniciado");
  };

  const openItem = async (item) => {
    const urlToOpen = normalizeUrl(item.url);
    if (!urlToOpen) {
      throw new Error("URL invalida o mal formada");
    }

    const chromeApi = typeof window !== "undefined" ? window.chrome : undefined;

    if (chromeApi?.tabs?.create) {
      await new Promise((resolve, reject) => {
        chromeApi.tabs.create({ url: urlToOpen, active: true }, () => {
          const runtimeError = chromeApi.runtime?.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }
          resolve();
        });
      });
    } else {
      const newWindow = window.open(urlToOpen, "_blank", "noopener,noreferrer");
      if (!newWindow) {
        throw new Error("No se pudo abrir la pagina. Verifica que los popups esten habilitados.");
      }
    }

    startCooldown(item.id, true);
  };

  const exportData = () => {
    const payload = buildExportPayload(items, settings);
    download("cooldown-data.json", JSON.stringify(payload, null, 2));
  };

  const importData = async (file) => {
    if (!file) return false;
    const text = await file.text();
    const parsed = parseImportPayload(JSON.parse(text));

    if (parsed.items.length > 0) {
      setItems(parsed.items);
      saveState(parsed.items);
    }
    if (parsed.settings) {
      setSettings(parsed.settings);
    }

    push("Datos importados");
    return true;
  };

  const closeDialog = () => setDialogState(null);

  const promptDeleteItem = (id) => {
    setDialogState({
      title: "Eliminar sitio",
      message: "Esta accion eliminara el sitio de la lista.",
      primaryLabel: "Eliminar",
      secondaryLabel: "Cancelar",
      tone: "danger",
      onPrimary: () => {
        removeItem(id);
        closeDialog();
      },
      onSecondary: closeDialog,
    });
  };

  const handleSaveItem = (payload) => {
    const existing = editing;
    if (existing && existing.endAt && payload.durationMs !== existing.durationMs) {
      setDialogState({
        title: "Cambiar duracion activa",
        message: "Puedes aplicar la nueva duracion ahora o dejarla para la proxima visita.",
        primaryLabel: "Aplicar ahora",
        secondaryLabel: "Proxima visita",
        onPrimary: () => {
          upsertItem({
            ...payload,
            endAt: existing.lastVisitedAt ? existing.lastVisitedAt + payload.durationMs : null,
          });
          closeDialog();
        },
        onSecondary: () => {
          upsertItem(payload);
          closeDialog();
        },
      });
      return;
    }

    upsertItem(payload);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 relative">
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 ease-in-out"
          onClick={() => setShowSettings(false)}
        />
      )}

      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-white/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                C
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Cooldown Tracker
              </h1>
            </div>

            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-white/80 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-slate-700 placeholder-slate-400"
                  placeholder="Buscar sitios..."
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </div>

              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {[
                  { value: "all", label: "Todos" },
                  { value: "active", label: "En cooldown" },
                  { value: "ready", label: "Listos" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setFilter(tab.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      filter === tab.value
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings((prev) => !prev)}
                  className={`p-2.5 rounded-xl border transition-all duration-300 ${
                    showSettings
                      ? "bg-blue-50 border-blue-200 text-blue-600"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900"
                  }`}
                  title={showSettings ? "Cerrar configuracion" : "Configuracion"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 transition-transform duration-300"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    style={{ transform: showSettings ? "rotate(30deg)" : "rotate(0)" }}
                  >
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  <span className="hidden sm:inline">Nuevo sitio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        <div className="w-full">
          <div
            className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${
              showSettings ? "translate-x-0" : "translate-x-full"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Configuracion"
          >
            <div className="h-full overflow-y-auto p-6">
              <button
                onClick={() => setShowSettings(false)}
                className="fixed top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors duration-200"
                aria-label="Cerrar configuracion"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <SettingsPanel
                settings={settings}
                setSettings={setSettings}
                notifSupported={notifSupported}
                permission={permission}
                onExport={exportData}
                onImport={importData}
                onToggleNotifications={toggleNotifications}
                onToast={push}
                onClose={() => setShowSettings(false)}
              />
            </div>
          </div>

          <div className="w-full">
            {shown.length === 0 ? (
              <EmptyState onAdd={() => setShowForm(true)} />
            ) : (
              <ul className="grid md:grid-cols-2 gap-4" aria-live="polite">
                {shown.map((item) => (
                  <li key={item.id}>
                    <SiteCard
                      item={item}
                      now={now}
                      onEdit={() => {
                        setEditing(item);
                        setShowForm(true);
                      }}
                      onDelete={() => promptDeleteItem(item.id)}
                      onStart={() => startCooldown(item.id)}
                      onReset={() => resetCooldown(item.id)}
                      onOpen={async () => {
                        try {
                          await openItem(item);
                        } catch (error) {
                          console.error("Error opening URL:", error);
                          push(`Error al abrir la URL: ${error.message || "URL invalida o bloqueada"}`);
                        }
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      {showForm && (
        <AddEditModal
          initial={editing}
          defaultDurationMs={settings.defaultDurationMs}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSaveItem}
        />
      )}

      {dialogState && (
        <ActionDialog
          title={dialogState.title}
          message={dialogState.message}
          primaryLabel={dialogState.primaryLabel}
          secondaryLabel={dialogState.secondaryLabel}
          tone={dialogState.tone}
          onPrimary={dialogState.onPrimary}
          onSecondary={dialogState.onSecondary}
          onClose={closeDialog}
        />
      )}

      <ToastViewport toasts={toasts} />

      <footer className="py-10 text-center text-xs text-slate-500">
        Nota: Las notificaciones mientras la pestana este cerrada pueden no llegar sin reabrir la app.
      </footer>
    </div>
  );
}
