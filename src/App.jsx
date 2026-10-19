import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ActionDialog from "./components/ActionDialog.jsx";
import AddEditModal from "./components/AddEditModal.jsx";
import EmptyState from "./components/EmptyState.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import SiteCard from "./components/SiteCard.jsx";
import ToastViewport from "./components/ToastViewport.jsx";
import PrivacyNotice from "./components/PrivacyNotice.jsx";
import ImportPreview from "./components/ImportPreview.jsx";
import { DEFAULT_SETTINGS, FILTER_OPTIONS, MAX_IMPORT_BYTES, SITE_MODES } from "./lib/constants.js";
import {
  buildExportPayload,
  clearCooldown,
  getVisibleSites,
  parseImportPayload,
  removeSite,
  resolveExpiredCooldowns,
  resetCooldown,
  setPermanentBlock,
  startCooldown,
  upsertSite,
} from "./lib/sites.js";
import {
  loadStoredState,
  saveStoredState,
  subscribeToExtensionState,
  usesExtensionStorage,
} from "./lib/storage.js";
import { downloadJsonFile, formatClock, hostnameFromUrl, isExtensionContext, normalizeUrl } from "./lib/utils.js";
import { useNotificationCenter } from "./hooks/useNotificationCenter.js";
import { useToasts } from "./hooks/useToasts.js";
import { createTranslator, resolveLocale } from "../extension/i18n.js";
import { I18nProvider } from "./i18n/I18nContext.jsx";
import { useI18n } from "./i18n/context.js";

export default function CooldownApp() {
  const [initialNow] = useState(() => Date.now());
  const extensionMode = isExtensionContext();
  const [now, setNow] = useState(initialNow);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS }));
  const locale = useMemo(() => resolveLocale(settings.language), [settings.language]);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [storageStatus, setStorageStatus] = useState("loading");
  const storageReady = storageStatus === "ready";
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [storageError, setStorageError] = useState(null);
  const [writeError, setWriteError] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [syncTick, setSyncTick] = useState(0);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState(null);
  const [queriedTab, setActiveTab] = useState(null);
  const activeTab = storageReady && extensionMode && settings.privacyAccepted ? queriedTab : null;
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [durationDecision, setDurationDecision] = useState(null);
  const { toasts, push } = useToasts();
  const { supported, permission, toggleNotifications, notifyReady } = useNotificationCenter({
    notificationsOn: settings.notificationsOn,
    soundOn: settings.soundOn,
    push,
    t,
  });
  const notifiedRef = useRef(new Set());
  const itemsRef = useRef(items);
  const settingsRef = useRef(settings);
  const tRef = useRef(t);
  const persistenceWarningShownRef = useRef(false);
  const savedStateRef = useRef(null);
  const lastQueuedStateRef = useRef(null);
  const importBusyRef = useRef(false);
  const stateVersionRef = useRef(0);
  const pendingSavesRef = useRef(0);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    loadStoredState()
      .then((state) => {
        if (cancelled || !state) {
          return;
        }

        savedStateRef.current = JSON.stringify(state);
        lastQueuedStateRef.current = state;
        setItems(state.items);
        setSettings(state.settings);
        setStorageError(null);
        setStorageStatus("ready");
      })
      .catch((error) => {
        if (!cancelled) {
          setStorageError(error);
          setStorageStatus("error");
          push(tRef.current("storageLoadError"), "error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, push]);

  useEffect(() => {
    if (!storageReady || !usesExtensionStorage()) {
      return undefined;
    }

    let cancelled = false;
    let request = 0;
    const refresh = () => {
      const version = stateVersionRef.current;
      if (importBusyRef.current || pendingSavesRef.current) return;
      const currentRequest = ++request;
      loadStoredState()
        .then((state) => {
          if (cancelled || currentRequest !== request || !state || importBusyRef.current || pendingSavesRef.current || version !== stateVersionRef.current) {
            return;
          }
          savedStateRef.current = JSON.stringify(state);
          lastQueuedStateRef.current = state;
          if (JSON.stringify(state.items) !== JSON.stringify(itemsRef.current)) {
            setItems(state.items);
          }
          if (JSON.stringify(state.settings) !== JSON.stringify(settingsRef.current)) {
            setSettings(state.settings);
          }
        })
        .catch((error) => {
          if (cancelled || currentRequest !== request || importBusyRef.current || version !== stateVersionRef.current) return;
          setStorageError(error);
          setStorageStatus("error");
        });
    };
    const unsubscribe = subscribeToExtensionState(refresh);
    if (syncTick) refresh();
    return () => { cancelled = true; unsubscribe(); };
  }, [storageReady, syncTick]);

  useEffect(() => {
    if (!storageReady || !extensionMode || !settings.privacyAccepted || !globalThis.chrome?.tabs?.query) {
      return;
    }

    globalThis.chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (globalThis.chrome.runtime.lastError) {
        return;
      }

      const tab = Array.isArray(tabs) ? tabs[0] : null;
      const url = normalizeUrl(tab?.url);
      if (!url || !/^https?:\/\//i.test(url)) {
        setActiveTab(null);
        return;
      }

      setActiveTab({
        title: typeof tab.title === "string" ? tab.title : "",
        url,
      });
    });
  }, [extensionMode, settings.privacyAccepted, storageReady]);

  useEffect(() => {
    if (!storageReady || pendingImport || (extensionMode && !settings.privacyAccepted)) return;
    const timerId = window.setInterval(() => {
      const stamp = Date.now();
      setNow(stamp);
      const { items: nextItems, completed } = resolveExpiredCooldowns(itemsRef.current, stamp);
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
        if (!extensionMode || settingsRef.current.privacyAccepted) notifyReady(item);
        push(t("readyToast", { name: item.label || hostnameFromUrl(item.url) }), "success");
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [extensionMode, notifyReady, pendingImport, push, settings.privacyAccepted, storageReady, t]);

  useEffect(() => {
    const state = { items, settings };
    const fingerprint = JSON.stringify(state);
    if (!storageReady || importBusyRef.current || (!pendingSavesRef.current && savedStateRef.current === fingerprint)) {
      return;
    }

    const previous = lastQueuedStateRef.current;
    const changed = {
      items: JSON.stringify(previous?.items) !== JSON.stringify(items),
      settings: JSON.stringify(previous?.settings) !== JSON.stringify(settings),
    };
    if (!changed.items && !changed.settings) return;
    lastQueuedStateRef.current = state;
    pendingSavesRef.current += 1;
    stateVersionRef.current += 1;
    let succeeded = false;
    void saveStoredState(state, changed)
      .then((saved) => {
        if (!saved) throw new Error("storageSaveError");
        savedStateRef.current = fingerprint;
        succeeded = true;
        setWriteError(null);
      })
      .catch((error) => {
        setWriteError(error);
        if (!persistenceWarningShownRef.current) {
          persistenceWarningShownRef.current = true;
          push(t("storageSaveError"), "error");
        }
      }).finally(() => {
        pendingSavesRef.current -= 1;
        if (succeeded && !pendingSavesRef.current) setSyncTick(tick => tick + 1);
      });
  }, [items, push, settings, storageReady, t]);

  const visibleItems = useMemo(
    () =>
      getVisibleSites(items, {
        filter,
        query,
        now,
      }),
    [items, filter, query, now],
  );

  const activeTabSite = useMemo(() => {
    if (!activeTab?.url) {
      return null;
    }

    const activeHost = hostnameFromUrl(activeTab.url);
    return (
      items.find((item) => item.url === activeTab.url) ||
      items.find((item) => item.scope === "domain" && hostnameFromUrl(item.url) === activeHost) ||
      null
    );
  }, [activeTab, items]);

  const summary = useMemo(() => {
    const blockedItems = items.filter((item) => item.mode === SITE_MODES.ALWAYS || (item.endAt && item.endAt > now));
    const timedItems = items.filter((item) => item.mode !== SITE_MODES.ALWAYS && item.endAt && item.endAt > now);
    const readyCount = items.length - blockedItems.length;
    const nextReady = timedItems.reduce((closest, item) => {
      if (!closest || item.endAt < closest.endAt) {
        return item;
      }

      return closest;
    }, null);

    return {
      total: items.length,
      active: blockedItems.length,
      ready: readyCount,
      nextReady,
      nextReadyRemaining: nextReady ? Math.max(0, nextReady.endAt - now) : 0,
    };
  }, [items, now]);

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const commitItem = (payload, message, stamp = Date.now()) => {
    setNow(stamp);
    setItems((currentItems) => upsertSite(currentItems, payload, stamp));
    push(message, "success");
  };

  const handleSaveItem = async (payload) => {
    const existing = items.find((item) => item.id === payload.id) || editing;
    const isEditing = Boolean(existing);

    if (existing && existing.mode !== SITE_MODES.ALWAYS && existing.endAt && payload.durationMs !== existing.durationMs) {
      setDurationDecision({ payload, existing });
      closeForm();
      return;
    }

    if (!isEditing && extensionMode && payload.mode === SITE_MODES.COOLDOWN) {
      const stamp = Date.now();
      commitItem(
        {
          ...payload,
          lastVisitedAt: stamp,
          endAt: stamp + payload.durationMs,
        },
        t("siteAddedBlocked"),
        stamp,
      );
      closeForm();
      return;
    }

    commitItem(
      payload,
      isEditing
        ? t("siteUpdated")
        : payload.mode === SITE_MODES.ALWAYS
          ? t("siteAddedPermanent")
          : t("siteAdded"),
    );
    closeForm();
  };

  const handleDeleteConfirmed = () => {
    if (!deleteTarget) {
      return;
    }

    setItems((currentItems) => removeSite(currentItems, deleteTarget.id));
    push(t("siteDeleted", { name: deleteTarget.label || hostnameFromUrl(deleteTarget.url) }), "success");
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

    commitItem(nextPayload, t("durationUpdated"));
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

  const handleCooldownAction = useCallback((action, id, message) => {
    const stamp = Date.now();
    setNow(stamp);
    setItems((currentItems) => action(currentItems, id, stamp));
    if (message) {
      push(message, "success");
    }
  }, [push]);

  const handleOpenSite = (item, event) => {
    if (isExtensionContext()) {
      event.preventDefault();
      globalThis.chrome.runtime.sendMessage({ type: "open-site", siteId: item.id }, (response) => {
        if (globalThis.chrome.runtime.lastError || !response?.ok) {
          push(t("openError", { name: item.label || hostnameFromUrl(item.url) }), "error");
        }
      });
      return;
    }

    handleCooldownAction(startCooldown, item.id);
  };

  const handleBlockActiveTab = () => {
    if (!activeTab?.url) {
      push(t("noTabError"), "error");
      return;
    }

    const stamp = Date.now();
    const host = hostnameFromUrl(activeTab.url);
    setNow(stamp);
    setItems((currentItems) => {
      const existing =
        currentItems.find((item) => item.url === activeTab.url) ||
        currentItems.find((item) => item.scope === "domain" && hostnameFromUrl(item.url) === host);

      return upsertSite(
        currentItems,
        {
          id: existing?.id,
          url: existing?.url || activeTab.url,
          label: existing?.label || host,
          scope: existing?.scope || "domain",
          mode: SITE_MODES.ALWAYS,
          durationMs: existing?.durationMs || settingsRef.current.defaultDurationMs,
          endAt: null,
          lastVisitedAt: null,
          createdAt: existing?.createdAt || stamp,
        },
        stamp,
      );
    });
    push(t("permanentlyBlockedToast", { name: host }), "success");
  };

  const handleExport = () => {
    const payload = buildExportPayload(items, settings);
    downloadJsonFile("cooldown-data.json", JSON.stringify(payload, null, 2));
    push(t("exported"), "success");
  };

  const handleImport = async (file) => {
    if (!file) {
      return;
    }

    if (!storageReady) throw new Error(t("storageNotReady"));
    if (file.size > MAX_IMPORT_BYTES) throw new Error(t("fileTooLarge"));
    const text = await file.text();
    const parsed = parseImportPayload(text, {
      now: Date.now(),
      fallbackSettings: settings,
      translate: t,
    });

    setImportError("");
    setPendingImport({ ...parsed, filename: file.name });
    setShowSettings(false);
  };

  const handleConfirmImport = async () => {
    if (!pendingImport || importBusyRef.current) return;
    if (!storageReady) {
      setImportError(t("storageNotReady"));
      return;
    }
    importBusyRef.current = true;
    stateVersionRef.current += 1;
    setImportBusy(true);
    setImportError("");
    const state = {
      items: pendingImport.hasItems ? pendingImport.items : itemsRef.current,
      settings: pendingImport.settings
        ? { ...pendingImport.settings, privacyAccepted: settingsRef.current.privacyAccepted }
        : settingsRef.current,
    };
    try {
      if (!await saveStoredState(state)) throw new Error("storageSaveError");
      savedStateRef.current = JSON.stringify(state);
      lastQueuedStateRef.current = state;
      setItems(state.items);
      setSettings(state.settings);
      setWriteError(null);
      setPendingImport(null);
      push(t("imported"), "success");
    } catch (error) {
      setWriteError(error);
      setImportError(t("storageSaveError"));
    } finally {
      importBusyRef.current = false;
      setImportBusy(false);
    }
  };

  const handleRetryStorage = async () => {
    if (!storageReady) {
      stateVersionRef.current += 1;
      setStorageStatus("loading");
      setLoadAttempt(attempt => attempt + 1);
      return;
    }
    try {
      const state = { items: itemsRef.current, settings: settingsRef.current };
      if (!await saveStoredState(state)) throw new Error("storageSaveError");
      savedStateRef.current = JSON.stringify(state);
      lastQueuedStateRef.current = state;
      setWriteError(null);
    } catch (error) {
      setWriteError(error);
    }
  };

  return (
    <I18nProvider locale={locale}>
      <div
        className={`cooldown-app min-h-screen bg-[#f4f7f6] text-slate-950 ${extensionMode ? "extension-shell" : ""}`}
      >
      {storageStatus === "loading" ? <p role="status" className="p-4 text-sm">{t("storageLoading")}</p> : null}
      {storageError || writeError ? (
        <section role="alert" className="border-b border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p>{t(storageError ? "storageRecovery" : "storageSaveError")}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button className="rounded-lg border px-3 py-2" onClick={handleRetryStorage}>{t("retry")}</button>
            <button className="rounded-lg border px-3 py-2" onClick={handleExport}>{t("exportScreen")}</button>
            {(storageError?.backup || writeError?.backup) ? (
              <button className="rounded-lg border px-3 py-2" onClick={() => downloadJsonFile("cooldown-recovery.json", storageError?.backup || writeError.backup)}>{t("exportOriginal")}</button>
            ) : null}
          </div>
        </section>
      ) : null}
      <header inert={storageStatus === "loading"} className="app-header sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div
          className={`mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 sm:px-6 ${
            extensionMode ? "" : "lg:flex-row lg:items-center lg:justify-between"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-xs">
              <BrandMark />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold text-slate-950">Cooldown Tracker</h1>
              <p className="truncate text-xs text-slate-500">{t("appTagline")}</p>
            </div>

            {extensionMode ? (
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                  title={t("settings")}
                  aria-label={t("openSettings")}
                >
                  <SettingsIcon />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setShowForm(true);
                  }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  <PlusIcon />
                  <span>{t("newSite")}</span>
                </button>
              </div>
            ) : null}
          </div>

          <div
            className={`flex w-full flex-col gap-2 ${extensionMode ? "" : "lg:w-auto lg:flex-row lg:items-center"}`}
          >
            <div className={`relative w-full ${extensionMode ? "" : "lg:w-72"}`}>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <SearchIcon />
              </div>
              <input
                type="search"
                className="block h-10 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-700 transition focus:border-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-200"
                placeholder={t("searchSites")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="inline-flex min-h-10 rounded-lg bg-slate-100 p-1">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={filter === option.value}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    filter === option.value
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t(option.value === "all" ? "filterAll" : option.value === "active" ? "filterBlocked" : "filterFree")}
                </button>
              ))}
            </div>

            {!extensionMode ? <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                title={t("settings")}
                aria-label={t("openSettings")}
              >
                <SettingsIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <PlusIcon />
                <span>{t("newSite")}</span>
              </button>
            </div> : null}
          </div>
        </div>
      </header>

      <main inert={storageStatus === "loading"} className={`mx-auto max-w-7xl px-4 ${extensionMode ? "py-4" : "py-6 sm:px-6"}`}>
        {extensionMode ? (
          <ActiveTabQuickBlock activeTab={activeTab} existingSite={activeTabSite} onBlock={handleBlockActiveTab} />
        ) : null}

        {extensionMode ? (
          <ExtensionSummary summary={summary} />
        ) : (
          <section className="mb-5 grid gap-3 md:grid-cols-4">
            <SummaryTile label={t("savedSites")} value={summary.total} tone="slate" />
            <SummaryTile label={t("filterBlocked")} value={summary.active} tone="amber" />
            <SummaryTile label={t("available")} value={summary.ready} tone="emerald" />
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("nextAvailable")}</p>
              {summary.nextReady ? (
                <>
                  <p className="mt-2 truncate text-base font-semibold text-slate-950">
                    {summary.nextReady.label || hostnameFromUrl(summary.nextReady.url)}
                  </p>
                  <p className="mt-1 font-mono text-sm tabular-nums text-slate-500">
                    {formatClock(summary.nextReadyRemaining)}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-base font-semibold text-slate-950">{t("noWait")}</p>
                  <p className="mt-1 text-sm text-slate-500">{t("allReady")}</p>
                </>
              )}
            </div>
          </section>
        )}

        {visibleItems.length === 0 ? (
          <EmptyState extensionMode={extensionMode} onAdd={() => setShowForm(true)} />
        ) : (
          <ul
            className={`grid gap-3 ${extensionMode ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-3"}`}
            aria-live="polite"
          >
            {visibleItems.map((item) => (
              <li key={item.id}>
                <SiteCard
                  item={item}
                  now={now}
                  extensionMode={extensionMode}
                  onOpen={(event) => handleOpenSite(item, event)}
                  onStart={() =>
                    handleCooldownAction(
                      startCooldown,
                      item.id,
                      extensionMode ? t("blockActivated") : t("cooldownStarted"),
                    )
                  }
                  onReset={() => handleCooldownAction(resetCooldown, item.id, t("cooldownRestarted"))}
                  onClear={() =>
                    handleCooldownAction(
                      clearCooldown,
                      item.id,
                      item.mode === SITE_MODES.ALWAYS ? t("blockReleased") : t("cooldownReleased"),
                    )
                  }
                  onMakePermanent={() => handleCooldownAction(setPermanentBlock, item.id, t("permanentActivated"))}
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

      <footer className={`px-4 text-center text-xs text-slate-500 sm:px-6 ${extensionMode ? "pb-5" : "pb-10"}`}>
        {extensionMode ? (
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${storageReady && settings.privacyAccepted ? "bg-emerald-500" : "bg-slate-400"}`} />
            {t(!storageReady ? "protectionUnknown" : settings.privacyAccepted ? "protectionActive" : "protectionPaused")}
          </span>
        ) : (
          t("webPushNote")
        )}
      </footer>

      <ToastViewport toasts={toasts} />

      {extensionMode && storageReady && !settings.privacyAccepted ? (
        <PrivacyNotice
          onAccept={() =>
            setSettings((currentSettings) => ({
              ...currentSettings,
              privacyAccepted: true,
            }))
          }
        />
      ) : null}

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

      {pendingImport ? (
        <ImportPreview
          preview={pendingImport}
          currentCount={items.length}
          busy={importBusy}
          error={importError}
          onExport={handleExport}
          onConfirm={handleConfirmImport}
          onCancel={() => {
            if (importBusyRef.current) return;
            setPendingImport(null);
            setShowSettings(true);
          }}
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
          title={t("deleteSite")}
          description={t("deleteDescription", { name: deleteTarget.label || hostnameFromUrl(deleteTarget.url) })}
          onClose={() => setDeleteTarget(null)}
          actions={[
            {
              label: t("cancel"),
              tone: "secondary",
              onSelect: () => setDeleteTarget(null),
            },
            {
              label: t("delete"),
              tone: "danger",
              onSelect: handleDeleteConfirmed,
            },
          ]}
        />
      ) : null}

      {durationDecision ? (
        <ActionDialog
          title={t("durationTitle")}
          description={t("durationDescription")}
          onClose={handleReopenDurationEdit}
          actions={[
            {
              label: t("keepEditing"),
              tone: "secondary",
              onSelect: handleReopenDurationEdit,
            },
            {
              label: t("nextVisit"),
              tone: "secondary",
              onSelect: () => handleDurationDecision("next"),
            },
            {
              label: t("applyNow"),
              tone: "primary",
              onSelect: () => handleDurationDecision("now"),
            },
          ]}
        />
      ) : null}
      </div>
    </I18nProvider>
  );
}

function ActiveTabQuickBlock({ activeTab, existingSite, onBlock }) {
  const { t } = useI18n();
  const host = activeTab?.url ? hostnameFromUrl(activeTab.url) : "";
  const alreadyPermanent = existingSite?.mode === SITE_MODES.ALWAYS;

  return (
    <section className="active-tab-panel mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center gap-3 p-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <GlobeIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase text-slate-500">{t("activeTab")}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">
            {host || t("noActiveTab")}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {activeTab?.title || activeTab?.url || t("activeTabHint")}
          </p>
        </div>

        <button
          type="button"
          onClick={onBlock}
          disabled={!activeTab?.url || alreadyPermanent}
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
            !activeTab?.url || alreadyPermanent
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-[#e65054] text-white shadow-xs hover:bg-[#d94146]"
          }`}
        >
          <ShieldIcon />
          {alreadyPermanent ? t("alreadyBlocked") : t("blockTab")}
        </button>
      </div>
    </section>
  );
}

function ExtensionSummary({ summary }) {
  const { t } = useI18n();
  return (
    <section className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        <CompactMetric label={t("savedSites")} value={summary.total} />
        <CompactMetric label={t("filterBlocked")} value={summary.active} tone="rose" />
        <CompactMetric label={t("available")} value={summary.ready} tone="emerald" />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-slate-500">{t("nextAvailable")}</p>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
            {summary.nextReady
              ? summary.nextReady.label || hostnameFromUrl(summary.nextReady.url)
              : t("allReady")}
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-slate-800">
          {summary.nextReady ? formatClock(summary.nextReadyRemaining) : t("noWait")}
        </span>
      </div>
    </section>
  );
}

function CompactMetric({ label, value, tone = "slate" }) {
  const valueClassName =
    tone === "rose" ? "text-[#d94146]" : tone === "emerald" ? "text-emerald-600" : "text-slate-900";

  return (
    <div className="px-3 py-3 text-center">
      <p className={`text-xl font-semibold ${valueClassName}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase text-slate-500">{label}</p>
    </div>
  );
}

function SummaryTile({ label, value, tone }) {
  const toneClassName =
    tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
        : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ring-4 ${toneClassName}`} />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 2.25c.24 0 .48.052.7.156l5 2.36A1.25 1.25 0 0116.42 5.9v3.54c0 3.44-2.06 6.55-5.23 7.89l-.7.296a1.25 1.25 0 01-.98 0l-.7-.296C5.64 15.99 3.58 12.88 3.58 9.44V5.9c0-.484.28-.924.72-1.133l5-2.36c.22-.104.46-.156.7-.156zm3.03 6.72a.75.75 0 00-1.06-1.06L9.25 10.63 8.03 9.41a.75.75 0 00-1.06 1.06l1.75 1.75c.293.293.767.293 1.06 0l3.25-3.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BrandMark() {
  return (
    <svg className="h-full w-full" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="brand-tile" x1="5" y1="4" x2="35" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#19233A" />
          <stop offset="1" stopColor="#101827" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="30" height="30" rx="8.125" fill="url(#brand-tile)" />
      <path d="M10.7813 10.1563H29.2188C29.2188 14.6875 25.8594 17.3438 21.7188 20C25.8594 22.6563 29.2188 25.3125 29.2188 29.8438H10.7813C10.7813 25.3125 14.1406 22.6563 18.2813 20C14.1406 17.3438 10.7813 14.6875 10.7813 10.1563Z" stroke="#F8FAFC" strokeWidth="2.34375" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.0469 12.5H26.9531C26.25 15 23.4375 17.1094 20 19.375C16.5625 17.1094 13.75 15 13.0469 12.5Z" fill="#5EEAD4" />
      <path d="M20 20.625C23.4375 22.8906 26.25 25 26.9531 27.5H13.0469C13.75 25 16.5625 22.8906 20 20.625Z" fill="#5EEAD4" />
      <path d="M20 19.2188C19.4531 19.8438 19.5313 20.2344 20 20.625C20.4688 20.2344 20.5469 19.8438 20 19.2188Z" fill="#F16468" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm4.9 5h-2.08a12 12 0 00-.72-2.64A6.04 6.04 0 0114.9 7zM10 3.55c.58.73 1.12 1.86 1.47 3.45H8.53C8.88 5.41 9.42 4.28 10 3.55zM7.9 4.36A12 12 0 007.18 7H5.1a6.04 6.04 0 012.8-2.64zM4.33 9h2.54a15.72 15.72 0 000 2H4.33a6.12 6.12 0 010-2zm.77 4h2.08c.16.96.41 1.85.72 2.64A6.04 6.04 0 015.1 13zM10 16.45c-.58-.73-1.12-1.86-1.47-3.45h2.94c-.35 1.59-.89 2.72-1.47 3.45zm1.79-5.45H8.21a13.28 13.28 0 010-2h3.58a13.28 13.28 0 010 2zm.31 4.64c.31-.79.56-1.68.72-2.64h2.08a6.04 6.04 0 01-2.8 2.64zM13.13 11a15.72 15.72 0 000-2h2.54a6.12 6.12 0 010 2h-2.54z" />
    </svg>
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
