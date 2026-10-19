import { useMemo } from "react";
import { createTranslator } from "../../extension/i18n.js";
import { I18nContext } from "./context.js";

export function I18nProvider({ children, locale }) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
