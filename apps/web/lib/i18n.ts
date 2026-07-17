/**
 * Instancia singleton de i18next para la web. Se importa (por su efecto
 * secundario de `init`) en cualquier componente cliente que use
 * `useTranslation()` — no requiere envolver el árbol en `I18nextProvider`,
 * react-i18next usa la instancia global por defecto si ya está inicializada.
 * Los diccionarios (`es`/`en`) viven en `@fitnotes/core` para compartirse con
 * mobile; el idioma elegido se persiste en `localStorage` (ver `readLanguage`
 * en `./settings.js`), igual que el resto de ajustes client-only de la web.
 */
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { es, en } from "@fitnotes/core";
import { readLanguage } from "./settings";

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources: { es, en },
    ns: ["common", "settings", "exercises", "exerciseCatalog", "progress"],
    defaultNS: "common",
    lng: readLanguage(),
    fallbackLng: "es",
    interpolation: { escapeValue: false },
  });
}

export default i18next;
