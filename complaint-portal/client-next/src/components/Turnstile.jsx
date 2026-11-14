"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/index.js";

let scriptPromise = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-apthex-turnstile="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.apthexTurnstile = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function Turnstile({ lang, config, onToken, resetKey = 0 }) {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const callbackRef = useRef(onToken);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    callbackRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;
    // Sirf explicit reset par token clear karo — naye mount par user ka solved token uddna nahi chahiye
    if (resetKey > 0) callbackRef.current?.(null);
    if (!config) {
      setStatus("loading");
      return undefined;
    }
    if (config.devBypass) {
      setStatus("dev");
      callbackRef.current?.("dev-bypass");
      return undefined;
    }
    if (!config.siteKey) {
      setStatus("unavailable");
      callbackRef.current?.(null);
      return undefined;
    }

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetRef.current = window.turnstile.render(containerRef.current, {
          sitekey: config.siteKey,
          theme: "dark",
          size: "flexible", // 300px fixed widget chhoti screens se bahar na jaye
          language: lang === "hi" ? "hi" : lang === "mr" ? "mr" : "en",
          callback: (token) => {
            setStatus("ready");
            callbackRef.current?.(token);
          },
          "expired-callback": () => callbackRef.current?.(null),
          "error-callback": () => {
            setStatus("error");
            callbackRef.current?.(null);
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          callbackRef.current?.(null);
        }
      });

    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetRef.current);
        } catch {
          // Widget may already have been removed.
        }
        widgetRef.current = null;
      }
    };
  }, [config?.siteKey, config?.devBypass, lang, resetKey]);

  return (
    <div className="turnstile-block">
      <div ref={containerRef} className="turnstile-container" />
      {status === "dev" && <p className="hint">{t(lang, "captchaDev")}</p>}
      {status === "unavailable" && <p className="error-text" role="alert">{t(lang, "captchaMissing")}</p>}
      {status === "error" && <p className="error-text" role="alert">{t(lang, "captchaMissing")}</p>}
    </div>
  );
}
