import React, { useRef } from "react";
import DialogShell from "./DialogShell.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function PrivacyNotice({ onAccept }) {
  const { t } = useI18n();
  const acceptButtonRef = useRef(null);

  return (
    <DialogShell
      titleId="privacy-title"
      descriptionId="privacy-description"
      onClose={() => {}}
      closeOnBackdrop={false}
      initialFocusRef={acceptButtonRef}
      panelClassName="max-w-md overflow-hidden"
    >
      <div className="h-1.5 bg-emerald-400" />
      <div className="px-6 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <LockIcon />
        </div>
        <h2 id="privacy-title" className="mt-5 text-xl font-semibold text-slate-950">
          {t("privacyTitle")}
        </h2>
        <p id="privacy-description" className="mt-3 text-sm leading-6 text-slate-600">
          {t("privacyDescription")}
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t("privacyNoShare")}
        </div>
        <button
          ref={acceptButtonRef}
          type="button"
          onClick={onAccept}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {t("acceptAndActivate")}
        </button>
      </div>
    </DialogShell>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5 8V6a5 5 0 0110 0v2a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2zm8-2v2H7V6a3 3 0 116 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
