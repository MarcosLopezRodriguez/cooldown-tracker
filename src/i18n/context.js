import { createContext, useContext } from "react";
import { createTranslator } from "../../extension/i18n.js";

export const I18nContext = createContext({ locale: "en", t: createTranslator("en") });

export function useI18n() {
  return useContext(I18nContext);
}
