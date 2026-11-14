"use client";

import { languages, t } from "../i18n/index.js";

export default function LanguageSwitcher({ lang, setLang, compact = false }) {
  return (
    <div className={`lang-switcher ${compact ? "lang-switcher-compact" : ""}`} role="group" aria-label={t(lang, "language")}>
      {languages.map((language) => (
        <button
          key={language.code}
          type="button"
          className={lang === language.code ? "lang-button active" : "lang-button"}
          aria-pressed={lang === language.code}
          onClick={() => setLang(language.code)}
          lang={language.code}
        >
          {compact ? language.short : language.label}
        </button>
      ))}
    </div>
  );
}
