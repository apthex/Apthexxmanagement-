"use client";

/**
 * RedactedFile — original interface element built entirely with CSS + SVG.
 *
 * An elegant anonymous complaint file: layered document surfaces, precise
 * hairlines, redacted identity fields, hidden personal information and a small
 * "IDENTITY HIDDEN" indicator. No images, no illustrations — pure code.
 *
 * Animations respect prefers-reduced-motion.
 */
export default function RedactedFile() {
  return (
    <div
      className="redacted-file"
      aria-label="Anonymous complaint file — reporter identity hidden"
      role="img"
    >
      <div className="redacted-file__stack">
        {/* Back document surface — deepest layer, offset down-right */}
        <div className="redacted-file__layer redacted-file__layer--back" aria-hidden="true" />
        {/* Mid document surface */}
        <div className="redacted-file__layer redacted-file__layer--mid" aria-hidden="true" />
        {/* Front document surface — the readable white report */}
        <div className="redacted-file__doc" aria-hidden="true">
          <svg
            className="redacted-file__svg"
            viewBox="0 0 340 480"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <style>{`
                .doc-label { fill: #8c8c9c; font: 600 10px "Space Grotesk", system-ui, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; }
                .doc-title { fill: #111319; font: 700 12px "Space Grotesk", system-ui, sans-serif; letter-spacing: 0.2em; text-transform: uppercase; }
                .doc-badge-text { fill: #0b0c0f; font: 700 8.5px "Space Grotesk", system-ui, sans-serif; letter-spacing: 0.16em; text-transform: uppercase; }
                .doc-note { fill: #8c8c9c; font: 400 8.5px "Space Grotesk", system-ui, sans-serif; letter-spacing: 0.08em; }
                .doc-rule { stroke: rgba(17,19,25,0.3); stroke-width: 0.6; }
                .doc-frame { fill: none; stroke: rgba(17,19,25,0.22); stroke-width: 0.8; }
              `}</style>
            </defs>

            {/* Paper surface */}
            <rect x="24" y="24" width="292" height="432" rx="3" className="doc-paper" fill="#FFFFFF" />
            <rect x="24" y="24" width="292" height="432" rx="3" className="doc-frame" fill="none" />

            {/* Header */}
            <text x="42" y="62" className="doc-title">Complaint file</text>
            <line x1="42" y1="78" x2="298" y2="78" className="doc-rule" />

            {/* Redacted identity fields */}
            <g className="doc-fields">
              {/* NAME */}
              <text x="42" y="112" className="doc-label">Name</text>
              <rect x="118" y="104" width="156" height="13" rx="1" className="doc-redact" />
              {/* ROLL NO */}
              <text x="42" y="146" className="doc-label">Roll no</text>
              <rect x="118" y="138" width="96" height="13" rx="1" className="doc-redact" />
              {/* MOBILE */}
              <text x="42" y="180" className="doc-label">Mobile</text>
              <rect x="118" y="172" width="104" height="13" rx="1" className="doc-redact" />
              {/* EMAIL */}
              <text x="42" y="214" className="doc-label">Email</text>
              <rect x="118" y="206" width="168" height="13" rx="1" className="doc-redact" />
              {/* INSTITUTE */}
              <text x="42" y="248" className="doc-label">Institute</text>
              <rect x="118" y="240" width="122" height="13" rx="1" className="doc-redact" />
              {/* REFERENCE */}
              <text x="42" y="282" className="doc-label">Reference</text>
              <rect x="118" y="274" width="84" height="13" rx="1" className="doc-redact" />
            </g>

            {/* IDENTITY HIDDEN indicator — small stamp */}
            <g className="doc-badge">
              <rect x="194" y="36" width="104" height="20" rx="10" className="doc-badge-bg" />
              <text x="246" y="49" textAnchor="middle" className="doc-badge-text">Identity hidden</text>
            </g>

            {/* Footer rule + protocol note */}
            <line x1="42" y1="414" x2="298" y2="414" className="doc-rule" />
            <text x="42" y="430" className="doc-note">Redacted per anonymity protocol · Personal data withheld</text>
          </svg>
        </div>
      </div>
    </div>
  );
}
