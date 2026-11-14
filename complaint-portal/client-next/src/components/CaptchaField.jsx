"use client";

import { useCallback, useEffect, useState } from "react";
import Turnstile from "./Turnstile.jsx";
import Icon from "./Icon.jsx";
import { t } from "../i18n/index.js";

/**
 * Single CAPTCHA field for every public form.
 * - mode "turnstile": real Cloudflare widget (used when keys are configured).
 * - mode "local": zero-setup signed arithmetic challenge from /api/captcha.
 * Reports { token, answer } upward; both go into the submit payload.
 */
export default function CaptchaField({ lang = "en", config, onSolved, resetKey = 0 }) {
  const mode = config?.mode || "local";

  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState("");
  const [loadError, setLoadError] = useState("");

  const loadChallenge = useCallback(() => {
    setChallenge(null);
    setAnswer("");
    setLoadError("");
    onSolved?.({ token: null, answer: "" });
    fetch("/api/captcha", { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("captcha unavailable");
        return response.json();
      })
      .then((data) => {
        setChallenge(data);
        onSolved?.({ token: data.token, answer: "" });
      })
      .catch(() => setLoadError(t(lang, "captchaMissing")));
  }, [lang, onSolved]);

  useEffect(() => {
    if (mode !== "local") return undefined;
    loadChallenge();
    return undefined;
    // resetKey badalne par naya challenge
  }, [mode, resetKey, loadChallenge]);

  if (!config) return <Spinner />;

  if (mode === "turnstile") {
    return <Turnstile lang={lang} config={config} onToken={(token) => onSolved?.({ token, answer: null })} resetKey={resetKey} />;
  }

  if (loadError) return <p className="error-text">{loadError}</p>;

  return (
    <div className="captcha-local">
      {challenge ? (
        <>
          <label className="field-label" htmlFor="captcha-answer">{challenge.question}</label>
          <div className="row">
            <input
              id="captcha-answer"
              className="input"
              inputMode="numeric"
              autoComplete="off"
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value);
                onSolved?.({ token: challenge.token, answer: event.target.value });
              }}
              placeholder={t(lang, "captchaAnswerPlaceholder")}
            />
            <button type="button" className="btn btn-ghost btn-small" onClick={loadChallenge} title={t(lang, "captchaNew")}>
              <Icon name="refresh" size={15} /> {t(lang, "captchaNew")}
            </button>
          </div>
        </>
      ) : (
        <p className="hint">{t(lang, "loading")}</p>
      )}
    </div>
  );
}

function Spinner() {
  return <p className="hint">Loading…</p>;
}
