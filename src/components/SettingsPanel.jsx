import React, { useRef, useState } from "react";
import DialogShell from "./DialogShell.jsx";
import DurationInput from "./DurationInput.jsx";
import { LANGUAGE_OPTIONS } from "../../extension/i18n.js";
import { useI18n } from "../i18n/I18nContext.jsx";

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
  const { t } = useI18n();
  const closeButtonRef = useRef(null);
  const [importMessage, setImportMessage] = useState(null);

  const defaultMinutes = Math.max(1, Math.round(settings.defaultDurationMs / 60000));

  const handleImportChange = async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setImportMessage({
        tone: "error",
        text: t("fileTooLarge"),
      });
      event.target.value = "";
      return;
    }

    try {
      await onImport(file);
      setImportMessage({
        tone: "success",
        text: t("importSuccess"),
      });
    } catch (error) {
      setImportMessage({
        tone: "error",
        text: error.message || t("importError"),
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
            {t("settings")}
          </h2>
          <p id="settings-description" className="mt-1 text-sm text-slate-500">
            {t("settingsDescription")}
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label={t("closeSettings")}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
        <section className="space-y-3 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t("language")}</h3>
            <p className="mt-1 text-sm text-slate-500">{t("languageDescription")}</p>
          </div>
          <div className="relative">
            <select
              value={settings.language}
              onChange={(event) =>
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  language: event.target.value,
                }))
              }
              className="block h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm font-medium text-slate-800 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              aria-label={t("language")}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.flag} {option.value === "auto" ? t("automatic") : option.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
              <ChevronIcon />
            </span>
          </div>
        </section>

        <section className="space-y-4 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t("defaultDuration")}</h3>
            <p className="mt-1 text-sm text-slate-500">{t("defaultDurationDescription")}</p>
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
              <h3 className="text-sm font-semibold text-slate-900">{t("notifications")}</h3>
              <p className="mt-1 text-sm text-slate-500">{t("notificationsDescription")}</p>
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
              srLabel={t("enableNotifications")}
            />
          </div>
          <p className="text-xs text-slate-500">
            {!notifSupported
              ? t("notificationsUnavailable")
              : permission === "granted"
                ? t("permissionGranted")
                : permission === "denied"
                  ? t("permissionDenied")
                  : t("permissionPrompt")}
          </p>
        </section>

        <section className="space-y-4 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{t("sound")}</h3>
              <p className="mt-1 text-sm text-slate-500">{t("soundDescription")}</p>
            </div>
            <Toggle
              checked={settings.soundOn}
              onClick={() =>
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  soundOn: !currentSettings.soundOn,
                }))
              }
              srLabel={t("enableSound")}
            />
          </div>
        </section>

        <section className="space-y-4 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t("data")}</h3>
            <p className="mt-1 text-sm text-slate-500">{t("dataDescription")}</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onExport}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <DownloadIcon />
              {t("exportData")}
            </button>

            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <UploadIcon />
              {t("importData")}
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
        checked ? "bg-emerald-600" : "bg-slate-200"
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

function ChevronIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.09 1.03l-4.25 4.5a.75.75 0 01-1.09 0l-4.25-4.5a.75.75 0 01.02-1.05z"
        clipRule="evenodd"
      />
    </svg>
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
