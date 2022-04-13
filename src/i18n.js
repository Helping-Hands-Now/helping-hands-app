import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-xhr-backend";
import locizeEditor from "locize-editor";

async function loadLocize(callback) {
  const dev = process.env.NODE_ENV === "development";

  if (dev) {
    let { LocizeConfig } = await import("./config/dev");
    callback(LocizeConfig);
  }
}

const detectionOptions = {
  // order and from where user language should be detected
  order: ["querystring", "cookie", "navigator", "htmlTag"],

  // keys or params to lookup language from
  lookupQuerystring: "lng",
  lookupCookie: "i18next",
  caches: ["cookie"],
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en-US",
    detection: detectionOptions,
    keySeparator: false, // we do not use keys in form messages.welcome

    debug: false,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

loadLocize((LocizeConfig) => {
  locizeEditor.init({
    lng: "en-US",
    defaultNS: "translations",
    projectId: LocizeConfig.projectId,
    referenceLng: "en-US",
  });
});

export default i18n;
