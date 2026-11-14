"use client";

import { t } from "../i18n/index.js";
import Icon from "./Icon.jsx";

export default function StepIndicator({ lang, current }) {
  const steps = [
    { number: 1, key: "stepWelcome" },
    { number: 2, key: "stepCategory" },
    { number: 3, key: "stepDetails" },
  ];
  return (
    <nav className="steps" aria-label={t(lang, "stepOf", { current, total: 3 })}>
      <ol>
        {steps.map((step) => {
          const state = step.number === current ? "current" : step.number < current ? "done" : "upcoming";
          return (
            <li key={step.number} className={`step ${state}`} aria-current={state === "current" ? "step" : undefined}>
              <span className="step-number">{state === "done" ? <Icon name="check" size={15} /> : step.number}</span>
              <span className="step-label">{t(lang, step.key)}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
