import React, { createContext, useContext, useMemo } from "react";
import { createTranslator } from "../../extension/i18n.js";

const I18nContext = createContext({ locale: "en", t: createTranslator("en") });

export function I18nProvider({ children, locale }) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
