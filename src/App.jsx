import React, { useEffect, useMemo, useRef, useState } from "react";
import ActionDialog from "./components/ActionDialog.jsx";
import AddEditModal from "./components/AddEditModal.jsx";
import EmptyState from "./components/EmptyState.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import SiteCard from "./components/SiteCard.jsx";
import ToastViewport from "./components/ToastViewport.jsx";
import { FILTER_OPTIONS } from "./lib/constants.js";
import {
  buildExportPayload,
  clearCooldown,
  getVisibleSites,
  parseImportPayload,
  removeSite,
  resolveExpiredCooldowns,
  resetCooldown,
  startCooldown,
  upsertSite,
} from "./lib/sites.js";
import { loadStoredItems, loadStoredSettings, saveStoredItems, saveStoredSettings } from "./lib/storage.js";
import { downloadJsonFile, hostnameFromUrl } from "./lib/utils.js";
import { useNotificationCenter } from "./hooks/useNotificationCenter.js";
import { useToasts } from "./hooks/useToasts.js";

export default function CooldownApp() {
  const initialNow = Date.now();
  const [now, setNow] = useState(initialNow);
  const [items, setItems] = useState(() => loadStoredItems(initialNow));
  const [settings, setSettings] = useState(() => loadStoredSettings());
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [durationDecision, setDurationDecision] = useState(null);
  const { toasts, push } = useToasts();
  const { supported, permission, toggleNotifications, notifyReady } = useNotificationCenter({
    notificationsOn: settings.notificationsOn,
    soundOn: settings.soundOn,
    push,
  });
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    saveStoredItems(items);
  }, [items]);

  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  useEffect(() => {
    const { items: nextItems, completed } = resolveExpiredCooldowns(items, now);
    if (!completed.length) {
      return;
    }

    setItems(nextItems);
    completed.forEach((item) => {
      const key = `${item.id}:${item.endAt}`;
      if (notifiedRef.current.has(key)) {
        return;
      }

      notifiedRef.current.add(key);
      notifyReady(item);
      push(`"${item.label || hostnameFromUrl(item.url)}" ya se puede visitar.`, "success");
    });
  }, [items, now, notifyReady, push]);

  const visibleItems = useMemo(
    () =>
      getVisibleSites(items, {
        filter,
        query,
        now,
      }),
    [items, filter, query, now],
  );

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const commitItem = (payload, message) => {
    const stamp = Date.now();
    setNow(stamp);
    setItems((currentItems) => upsertSite(currentItems, payload, stamp));
    push(message, "success");
  };

  const handleSaveItem = async (payload) => {
    const existing = items.find((item) => item.id === payload.id) || editing;
    const isEditing = Boolean(existing);

    if (existing && existing.endAt && payload.durationMs !== existing.durationMs) {
      setDurationDecision({ payload, existing });
      closeForm();
      return;
    }

    commitItem(payload, isEditing ? "Sitio actualizado." : "Sitio anadido.");
    closeForm();
  };

  const handleDeleteConfirmed = () => {
    if (!deleteTarget) {
      return;
    }

    setItems((currentItems) => removeSite(currentItems, deleteTarget.id));
    push(`"${deleteTarget.label || hostnameFromUrl(deleteTarget.url)}" eliminado.`, "success");
    setDeleteTarget(null);
  };

  const handleDurationDecision = (mode) => {
    if (!durationDecision) {
      return;
    }

    const { payload, existing } = durationDecision;
    const nextPayload =
      mode === "now"
        ? {
            ...payload,
            endAt: existing.lastVisitedAt ? existing.lastVisitedAt + payload.durationMs : payload.endAt,
          }
        : payload;

    commitItem(nextPayload, "Duracion actualizada.");
    setDurationDecision(null);
  };

  const handleReopenDurationEdit = () => {
    if (!durationDecision) {
      return;
    }

    setEditing(durationDecision.payload);
    setShowForm(true);
    setDurationDecision(null);
  };

  const runCooldownAction = (action, id, message) => {
    const stamp = Date.now();
    setNow(stamp);
    setItems((currentItems) => action(currentItems, id, stamp));
    if (message) {
      push(message, "success");
    }
  };

  const handleOpenSite = (item) => {
    const displayName = item.label || hostnameFromUrl(item.url);
    const chromeApi = typeof window !== "undefined" ? window.chrome : undefined;

    try {
      if (chromeApi?.tabs?.create) {
        chromeApi.tabs.create({ url: item.url, active: true }, () => {
          if (chromeApi.runtime?.lastError) {
            push(`No se pudo abrir "${displayName}".`, "error");
            return;
          }
          runCooldownAction(startCooldown, item.id);
        });
        return;
      }

      const newWindow = window.open(item.url, "_blank", "noopener,noreferrer");
      if (!newWindow) {
        throw new Error("No se pudo abrir la pagina. Revisa los popups.");
      }

      runCooldownAction(startCooldown, item.id);
    } catch (error) {
      push(error.message || `No se pudo abrir "${displayName}".`, "error");
    }
  };

  const handleExport = () => {
    const payload = buildExportPayload(items, settings);
    downloadJsonFile("cooldown-data.json", JSON.stringify(payload, null, 2));
    push("Datos exportados.", "success");
  };

  const handleImport = async (file) => {
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = parseImportPayload(text, {
      now,
      fallbackSettings: settings,
    });

    if (parsed.hasItems) {
      setItems(parsed.items);
    }

    if (parsed.settings) {
      setSettings(parsed.settings);
    }

    push("Datos importados.", "success");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-semibold text-white shadow-sm">
              C
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cooldown Tracker</h1>
              <p className="text-sm text-slate-500">Gestiona pausas entre visitas y evita volver antes de tiempo.</p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
            <div className="relative w-full lg:w-80">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <SearchIcon />
              </div>
              <input
                type="search"
                className="block w-full rounded-2xl border border-slate-200 bg-white/90 py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Buscar sitios..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="inline-flex rounded-2xl bg-slate-100 p-1">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    filter === option.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                title="Configuracion"
                aria-label="Abrir configuracion"
              >
                <SettingsIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700"
              >
                <PlusIcon />
                <span>Nuevo sitio</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {visibleItems.length === 0 ? (
          <EmptyState onAdd={() => setShowForm(true)} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2" aria-live="polite">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <SiteCard
                  item={item}
                  now={now}
                  onOpen={() => handleOpenSite(item)}
                  onStart={() => runCooldownAction(startCooldown, item.id, "Cooldown iniciado.")}
                  onReset={() => runCooldownAction(resetCooldown, item.id, "Cooldown reiniciado.")}
                  onClear={() => runCooldownAction(clearCooldown, item.id, "Cooldown limpiado.")}
                  onEdit={() => {
                    setEditing(item);
                    setShowForm(true);
                  }}
                  onDelete={() => setDeleteTarget(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="px-4 pb-10 text-center text-xs text-slate-500 sm:px-6">
        Las notificaciones con la pestana totalmente cerrada requieren Web Push o un backend.
      </footer>

      <ToastViewport toasts={toasts} />

      {showSettings ? (
        <SettingsPanel
          settings={settings}
          setSettings={setSettings}
          onClose={() => setShowSettings(false)}
          onExport={handleExport}
          onImport={handleImport}
          onToggleNotifications={toggleNotifications}
          notifSupported={supported}
          permission={permission}
        />
      ) : null}

      {showForm ? (
        <AddEditModal
          initial={editing}
          defaultDurationMs={settings.defaultDurationMs}
          onClose={closeForm}
          onSave={handleSaveItem}
        />
      ) : null}

      {deleteTarget ? (
        <ActionDialog
          title="Eliminar sitio"
          description={`Se eliminara "${deleteTarget.label || hostnameFromUrl(deleteTarget.url)}" y su estado de cooldown.`}
          onClose={() => setDeleteTarget(null)}
          actions={[
            {
              label: "Cancelar",
              tone: "secondary",
              onSelect: () => setDeleteTarget(null),
            },
            {
              label: "Eliminar",
              tone: "danger",
              onSelect: handleDeleteConfirmed,
            },
          ]}
        />
      ) : null}

      {durationDecision ? (
        <ActionDialog
          title="Aplicar nueva duracion"
          description="El sitio sigue en cooldown. Elige si la nueva duracion debe afectar al temporizador actual o solo a visitas futuras."
          onClose={handleReopenDurationEdit}
          actions={[
            {
              label: "Seguir editando",
              tone: "secondary",
              onSelect: handleReopenDurationEdit,
            },
            {
              label: "Proxima visita",
              tone: "secondary",
              onSelect: () => handleDurationDecision("next"),
            },
            {
              label: "Aplicar ahora",
              tone: "primary",
              onSelect: () => handleDurationDecision("now"),
            },
          ]}
        />
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}
