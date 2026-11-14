"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicShell from "../../components/PublicShell.jsx";
import Icon from "../../components/Icon.jsx";
import { useLang } from "../../lib/lang.js";
import { t } from "../../i18n/index.js";
import { getConfirmation } from "../../lib/session.js";

export default function ThankYouPage() {
  const [lang, setLang] = useLang();
  const [confirmation, setConfirmation] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    setConfirmation(getConfirmation());
  }, []);

  async function copyReference() {
    const refId = confirmation?.refId;
    if (!refId) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(refId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError("Copy failed. Select the reference ID and copy it manually.");
    }
  }

  if (!confirmation) {
    return (
      <div className="center-state" role="status" aria-live="polite">
        <span className="spinner" />
        <p>{t(lang, "loading")}</p>
      </div>
    );
  }

  const refId = confirmation.refId;

  return (
    <PublicShell lang={lang} setLang={setLang}>
      <div className="container page page-narrow">
        {!refId ? (
          <div className="card empty-state">
            <span className="icon-tile icon-tile-amber"><Icon name="alert" size={26} /></span>
            <h1>{t(lang, "missingRef")}</h1>
            <p>{t(lang, "missingRefText")}</p>
            <div className="stack">
              <Link href="/status" className="btn btn-primary btn-block">{t(lang, "goStatus")}</Link>
              <Link href="/" className="btn btn-ghost btn-block">{t(lang, "back")}</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="success-mark" aria-hidden="true">
              <Icon name="check" size={34} />
            </div>
            <header className="page-head centered">
              <p className="eyebrow"><Icon name="shield" size={15} /> {t(lang, "securePrivate")}</p>
              <h1>{t(lang, "thanksTitle")}</h1>
              <p className="page-subtitle">{t(lang, "thanksSubtitle")}</p>
            </header>

            <section className="card reference-card">
              <span className="mini-label">{t(lang, "refLabel")}</span>
              <div className="reference-code">{refId}</div>
              <button type="button" className="btn btn-secondary" onClick={copyReference}>
                <Icon name={copied ? "check" : "copy"} size={17} />
                {copied ? t(lang, "copied") : t(lang, "copyRef")}
              </button>
              {copyError && <p className="error-text" role="alert">{copyError}</p>}
              <p className="keep-safe"><Icon name="lock" size={15} /> {t(lang, "keepSafe")}</p>
            </section>

            <div className={`alert ${confirmation.acknowledgementEmail ? "alert-success" : "alert-info"}`}>
              <Icon name={confirmation.acknowledgementEmail ? "mail" : "eye"} size={18} />
              <span>{confirmation.acknowledgementEmail ? t(lang, "acknowledgementEmail") : t(lang, "acknowledgementNone")}</span>
            </div>

            <section className="card what-next">
              <h2>{t(lang, "whatNextTitle")}</h2>
              <ol className="numbered-list">
                <li>{t(lang, "whatNext1")}</li>
                <li>{t(lang, "whatNext2")}</li>
                <li>{t(lang, "whatNext3")}</li>
              </ol>
              <p className="small muted">{t(lang, "statusInstructions")}</p>
            </section>

            <div className="page-actions centered">
              <Link href="/status" className="btn btn-primary btn-large">{t(lang, "goStatus")}</Link>
              <Link href="/" className="btn btn-ghost btn-large">{t(lang, "reportAnother")}</Link>
            </div>
          </>
        )}
      </div>
    </PublicShell>
  );
}
