import { useRef } from "react";
import DialogShell from "./DialogShell.jsx";
import { useI18n } from "../i18n/context.js";

export default function ImportPreview({ preview, currentCount, busy, error, onExport, onConfirm, onCancel }) {
  const { t } = useI18n();
  const cancelRef = useRef(null);
  const buttonClass = "rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50";
  return (
    <DialogShell onClose={onCancel} titleId="import-title" descriptionId="import-description" initialFocusRef={cancelRef} closeOnBackdrop={!busy} panelClassName="max-h-[90vh] overflow-y-auto p-5">
      <h2 id="import-title" className="text-lg font-semibold">{t("importPreviewTitle")}</h2>
      <p className="mt-2 break-all text-sm text-slate-500">{preview.filename}</p>
      <div id="import-description" className="my-4 space-y-3 text-sm text-slate-700">
        <p>{preview.hasItems ? t("importSummary", { incoming: preview.items.length, current: currentCount }) : t("importKeepSites")}</p>
        <p>{t(preview.settings ? "importReplaceSettings" : "importKeepSettings")}</p>
        {preview.hasItems && !preview.items.length ? <p className="rounded-lg bg-amber-50 p-3 text-amber-950">{t("importEmptyWarning")}</p> : null}
      </div>
      {error ? <p role="alert" className="mb-4 text-sm text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-3">
        <button className={buttonClass} disabled={busy} onClick={onExport}>{t("exportData")}</button>
        <button ref={cancelRef} className={buttonClass} disabled={busy} onClick={onCancel}>{t("cancel")}</button>
        <button className={`${buttonClass} bg-slate-950 text-white`} disabled={busy} onClick={onConfirm}>{t("confirmImport")}</button>
      </div>
    </DialogShell>
  );
}
