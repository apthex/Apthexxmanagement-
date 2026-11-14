"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicShell from "../../components/PublicShell.jsx";
import Icon from "../../components/Icon.jsx";
import Spinner from "../../components/Spinner.jsx";
import CaptchaField from "../../components/CaptchaField.jsx";
import { api } from "../../lib/api.js";
import { useLang } from "../../lib/lang.js";
import { t } from "../../i18n/index.js";
import { getDeviceId } from "../../lib/session.js";

const REF_PATTERN = /^APX-\d{4}-[2-9A-HJKMNP-Z]{6}$/;

export default function StatusPage() {
  const [lang, setLang] = useLang();
  const [refId, setRefId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const [config, setConfig] = useState(null);
  const [followup, setFollowup] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);

  function handleCaptchaSolved({ token, answer }) {
    setCaptchaToken(token);
    if (answer !== null && answer !== undefined) setCaptchaAnswer(answer);
  }
  const [followupError, setFollowupError] = useState("");
  const [followupSuccess, setFollowupSuccess] = useState("");
  const [sendingFollowup, setSendingFollowup] = useState(false);

  useEffect(() => {
    api("/api/config")
      .then(setConfig)
      .catch(() =>
        setConfig({ captcha: { configured: false, required: false, devBypass: false } })
      );
  }, []);

  async function lookup(event) {
    event?.preventDefault();
    const normalized = refId.trim().toUpperCase();
    setRefId(normalized);
    setError("");
    setResult(null);
    setFollowupSuccess("");
    setFollowupError("");
    if (!REF_PATTERN.test(normalized)) {
      setError(t(lang, "statusNotFound"));
      return;
    }
    setChecking(true);
    try {
      const data = await api("/api/status/lookup", {
        method: "POST",
        json: { ref_id: normalized },
      });
      setResult(data);
    } catch (requestError) {
      if (requestError.status === 404) setError(t(lang, "statusNotFound"));
      else if (requestError.status === 429) setError(t(lang, "statusRate"));
      else setError(requestError.message);
    } finally {
      setChecking(false);
    }
  }

  async function sendFollowup(event) {
    event.preventDefault();
    setFollowupError("");
    setFollowupSuccess("");
    if (followup.trim().length < 5) {
      setFollowupError(t(lang, "followupPlaceholder"));
      return;
    }
    if (config?.captcha?.required && !captchaToken) {
      setFollowupError(t(lang, "followupCaptcha"));
      return;
    }
    setSendingFollowup(true);
    try {
      await api("/api/status/followup", {
        method: "POST",
        json: {
          ref_id: refId,
          text: followup.trim(),
          captchaToken: captchaToken || "",
          captchaAnswer: captchaAnswer || "",
          deviceId: getDeviceId(),
        },
      });
      setFollowup("");
      setFollowupSuccess(t(lang, "followupSuccess"));
      setCaptchaToken(null);
      setCaptchaReset((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 429) setFollowupError(t(lang, "statusRate"));
      else if (requestError.data?.captchaFailed) {
        setFollowupError(t(lang, "errorCaptcha"));
        setCaptchaReset((value) => value + 1);
      } else setFollowupError(requestError.message);
    } finally {
      setSendingFollowup(false);
    }
  }

  const deleted = Boolean(result?.data_deleted);
  const completed = result?.status === "Completed";

  return (
    <PublicShell lang={lang} setLang={setLang}>
      <div className="container page page-medium">
        <header className="page-head">
          <p className="eyebrow"><Icon name="search" size={15} /> {t(lang, "statusPrivacy")}</p>
          <h1>{t(lang, "statusTitle")}</h1>
          <p className="page-subtitle">{t(lang, "statusHelp")}</p>
        </header>

        <div className="status-layout">
          <section className="card status-card">
            <form onSubmit={lookup} className="stack">
              <label className="field">
                <span className="field-label">{t(lang, "refLabel")}</span>
                <div className="input-action">
                  <input
                    className="input input-code"
                    value={refId}
                    onChange={(event) => setRefId(event.target.value.toUpperCase())}
                    placeholder={t(lang, "refPlaceholder")}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={16}
                    aria-describedby="status-help"
                  />
                  <button type="submit" className="btn btn-primary" disabled={checking || !refId.trim()}>
                    {checking ? t(lang, "checking") : t(lang, "checkStatus")}
                  </button>
                </div>
                <span className="field-hint" id="status-help">{t(lang, "statusInstructions")}</span>
              </label>
            </form>

            {checking && <Spinner label={t(lang, "checking")} />}

            {error && (
              <div className="alert alert-error" role="alert">
                <Icon name="alert" size={18} /> <span>{error}</span>
              </div>
            )}

            {result && (
              <div className={deleted ? "status-result deleted" : "status-result"} role="status" aria-live="polite">
                <span className={`status-orb ${completed ? "complete" : "process"}`}>
                  <Icon name={completed ? "check" : "clock"} size={28} />
                </span>
                <div>
                  <span className="mini-label">{refId}</span>
                  <h2>{deleted ? t(lang, "deletedTitle") : completed ? t(lang, "statusCompleted") : t(lang, "statusInProcess")}</h2>
                  <p>{deleted ? t(lang, "deletedMessage") : result.message || t(lang, "statusInstructions")}</p>
                </div>
              </div>
            )}
          </section>

          <aside className="stack">
            <div className="card side-card">
              <h2>{t(lang, "privacyDetails")}</h2>
              <ul className="check-list">
                <li><Icon name="check" size={16} /> {t(lang, "statusPrivacy")}</li>
                <li><Icon name="check" size={16} /> {t(lang, "footerPrivacy")}</li>
                <li><Icon name="check" size={16} /> {t(lang, "keepSafe")}</li>
              </ul>
              <Link href="/" className="btn btn-ghost btn-block">
                <Icon name="arrowLeft" size={16} /> {t(lang, "back")}
              </Link>
            </div>
          </aside>
        </div>

        {result && !deleted && (
          <section className="card followup-card">
            <div className="card-heading">
              <h2>{t(lang, "followupTitle")}</h2>
              <p>{t(lang, "followupHelp")}</p>
            </div>
            <form onSubmit={sendFollowup} className="stack">
              <textarea
                className="textarea"
                value={followup}
                onChange={(event) => setFollowup(event.target.value)}
                rows={4}
                maxLength={5000}
                placeholder={t(lang, "followupPlaceholder")}
              />
              {config && config.captcha?.required && !config.captcha?.devBypass && (
                <CaptchaField lang={lang} config={config.captcha} onSolved={handleCaptchaSolved} resetKey={captchaReset} />
              )}
              {followupError && <p className="error-text" role="alert">{followupError}</p>}
              {followupSuccess && <p className="alert alert-success" role="status">{followupSuccess}</p>}
              <div className="between">
                <span className="muted small">{t(lang, "privacyNote")}</span>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={sendingFollowup || (config?.captcha?.required && !captchaToken)}
                >
                  {sendingFollowup ? t(lang, "loading") : t(lang, "followupSubmit")}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </PublicShell>
  );
}
