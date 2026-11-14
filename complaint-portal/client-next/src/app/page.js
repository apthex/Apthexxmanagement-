"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicShell from "../components/PublicShell.jsx";
import RedactedFile from "../components/RedactedFile.jsx";
import Icon from "../components/Icon.jsx";
import { useLang, useReadAloud } from "../lib/lang.js";
import { t } from "../i18n/index.js";
import { api } from "../lib/api.js";

// Complaints are submitted only at /complaint (QR posters / direct link).
// The home page is informational — no complaint entry points here.
export default function WelcomePage() {
  const [lang, setLang] = useLang();
  const { speaking, speak, stop } = useReadAloud(lang);
  const [mainSiteUrl, setMainSiteUrl] = useState("");

  useEffect(() => {
    api("/api/config")
      .then((cfg) => setMainSiteUrl(cfg?.mainSiteUrl || ""))
      .catch(() => {});
  }, []);

  return (
    <PublicShell lang={lang} setLang={setLang}>
      <section className="welcome" aria-labelledby="welcome-headline">
        <div className="welcome-grid">
          <div className="welcome-copy">
            <p className="welcome-eyebrow" aria-hidden="true">{t(lang, "brandTagline")}</p>
            <h1 id="welcome-headline" className="welcome-headline">
              {t(lang, "welcomeTitle")}
            </h1>
            <p className="welcome-lede">{t(lang, "welcomeSubtitle")}</p>

            <p className="welcome-status">
              <Link href="/status">{t(lang, "navStatus")}</Link>
            </p>

            {mainSiteUrl ? (
              <p className="welcome-status welcome-status-alt">
                <a href={mainSiteUrl} target="_blank" rel="noreferrer">
                  {t(lang, "navMainSite")}
                  <Icon name="external" size={14} />
                </a>
              </p>
            ) : null}

            <button
              type="button"
              className="welcome-readaloud"
              aria-pressed={speaking}
              onClick={() => (speaking ? stop() : speak(t(lang, "welcomeReadAloud")))}
            >
              {speaking ? t(lang, "stopReading") : t(lang, "readAloud")}
            </button>

            <div className="welcome-emergency">
              <span className="welcome-emergency-label">{t(lang, "emergencyTitle")}</span>
              <div className="welcome-emergency-row">
                <a href="tel:112" className="welcome-emergency-number">
                  112
                </a>
                <span className="welcome-emergency-kind">{t(lang, "callEmergency")}</span>
              </div>
              <div className="welcome-emergency-row">
                <a href="tel:1930" className="welcome-emergency-number">
                  1930
                </a>
                <span className="welcome-emergency-kind">
                  {t(lang, "cyberHelplineLabel")}
                </span>
              </div>
            </div>
          </div>

          <div className="welcome-visual">
            <RedactedFile />
          </div>
        </div>

        <div className="welcome-points" role="list">
          <div className="welcome-point" role="listitem">
            <Icon name="lock" size={20} />
            <div>
              <strong>{t(lang, "noLoginTitle")}</strong>
              <p>{t(lang, "noLoginText")}</p>
            </div>
          </div>
          <div className="welcome-point" role="listitem">
            <Icon name="eye" size={20} />
            <div>
              <strong>{t(lang, "anonymousCardTitle")}</strong>
              <p>{t(lang, "anonymousCardText")}</p>
            </div>
          </div>
          <div className="welcome-point" role="listitem">
            <Icon name="shield" size={20} />
            <div>
              <strong>{t(lang, "privateEvidenceTitle")}</strong>
              <p>{t(lang, "privateEvidenceText")}</p>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
