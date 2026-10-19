import { useI18n } from "../i18n/context.js";

export default function EmptyState({ onAdd, extensionMode = false }) {
  const { t } = useI18n();
  return (
    <div
      className={`rounded-lg border border-dashed border-slate-300 bg-white px-6 text-center shadow-xs ${
        extensionMode ? "mt-3 py-8" : "mt-12 py-14"
      }`}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <HourglassIcon />
      </div>
      <h2 className={`${extensionMode ? "mt-4 text-lg" : "mt-6 text-2xl"} font-semibold text-slate-950`}>
        {t("noSites")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {t("noSitesDescription")}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        {t("addFirstSite")}
      </button>
    </div>
  );
}

function HourglassIcon() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6 2a1 1 0 000 2v1a4 4 0 001.43 3.07L9.59 10l-2.16 1.93A4 4 0 006 15v1a1 1 0 102 0v-1a2 2 0 01.72-1.53L11.08 11l-2.36-2.47A2 2 0 018 7V4a1 1 0 10-2 0V4h8v1a2 2 0 01-.72 1.53L10.92 9l2.36 2.47A2 2 0 0114 13v3a1 1 0 102 0v-3a4 4 0 00-1.43-3.07L12.41 8l2.16-1.93A4 4 0 0016 3V2a1 1 0 10-2 0H6z" />
    </svg>
  );
}
