"use client";

export default function Spinner({ label = "Loading…" }) {
  return (
    <div className="inline-loading" role="status" aria-live="polite">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
