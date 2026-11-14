"use client";

import { useCallback, useEffect, useState } from "react";
import { languageMeta } from "../i18n/index.js";

const STORAGE_KEY = "apthex_lang";

export function useLang() {
  const [lang, setLangState] = useState("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && ["en", "hi", "mr"].includes(saved)) setLangState(saved);
    } catch {
      // Storage may be unavailable in private browsing; English remains the default.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage failures.
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (["en", "hi", "mr"].includes(next)) setLangState(next);
  }, []);

  return [lang, setLang];
}

export function useReadAloud(lang) {
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageMeta(lang).speech;
      utterance.rate = 0.95;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [lang]
  );

  useEffect(() => () => stop(), [stop]);

  return { speaking, speak, stop };
}
