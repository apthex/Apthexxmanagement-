"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import CaptchaField from "../../components/CaptchaField.jsx";
import Icon from "../../components/Icon.jsx";
import { submitComplaint } from "../../lib/api.js";
import { CATEGORY_META } from "../../i18n/index.js";

const MAX_PHOTOS = 5;
const PHOTO_LIMIT_BYTES = 10 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 50 * 1024 * 1024;
const DETAILS_MAX = 5000;

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

const EMPTY_FORM = {
  institute_code: "",
  name: "",
  class_label: "",
  roll_no: "",
  mobile: "",
  email: "",
  category: "",
  details_text: "",
};

const APTHEX_MARK = (
  <path
    fill="currentColor"
    d="M1030.9 1034.8C1015.3 1011.8 986.9 970.4 979.2 959.5C974.5 952.9 960.1 932.4 947.2 914.0C905.1 854.0 835.4 756.3 776.6 675.0C759.9 651.8 756.1 646.6 733.9 616.0C721.7 599.2 708.6 581.2 704.9 576.0C701.1 570.8 697.0 565.3 695.8 563.7L693.5 561.0L680.9 572.2C654.5 595.8 554.0 687.0 500.0 736.4C417.3 812.1 340.7 884.2 234.6 986.2C215.9 1004.2 200.4 1018.7 200.2 1018.6C199.6 1017.9 270.6 921.3 300.5 882.0C384.0 772.4 543.2 571.3 627.9 468.5C649.0 442.9 699.4 382.2 725.6 351.0C788.5 276.0 881.3 170.6 879.7 176.0C879.5 176.8 873.2 196.2 865.7 219.0C858.3 241.8 846.7 277.4 840.0 298.0C833.3 318.6 821.2 355.8 813.0 380.5C804.8 405.2 794.0 438.0 789.1 453.2L780.1 480.9L785.2 491.2C791.4 503.9 812.7 548.2 818.7 561.0C823.3 570.6 825.3 575.1 870.0 670.5C883.9 700.2 899.0 732.6 903.5 742.5C908.0 752.4 915.7 769.0 920.5 779.5C946.0 834.9 995.7 946.0 1018.5 998.5C1024.9 1013.4 1032.0 1029.5 1034.1 1034.4C1036.2 1039.3 1037.8 1043.5 1037.6 1043.7C1037.4 1043.9 1034.4 1039.9 1030.9 1034.8ZM850.0 913.4C804.4 892.3 764.7 875.8 703.6 852.4C691.4 847.7 679.5 842.0 677.0 842.0C674.5 841.0 664.1 837.0 653.8 833.1L635.2 826.1L610.3 834.1C531.9 859.4 416.1 899.1 381.8 912.5C377.1 914.3 381.6 909.7 399.2 894.2C441.1 857.7 515.8 793.9 557.2 759.4L589.9 732.1L638.2 732.7L686.6 733.3L692.2 719.9C695.3 712.5 699.3 702.8 701.1 698.2C702.9 693.7 704.6 690.0 704.9 690.0C705.2 690.0 708.3 694.0 711.7 698.8C715.1 703.6 723.0 714.5 729.2 723.1C742.6 741.6 771.1 781.2 786.5 802.5C792.5 811.0 807.0 831.0 818.6 847.2C854.5 896.9 872.0 921.5 872.0 922.2C872.0 923.5 871.2 923.2 850.0 913.4Z"
  />
);

function getDeviceId() {
  if (typeof window === "undefined") return "server";
  let id = sessionStorage.getItem("apthex_device_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("apthex_device_id", id);
  }
  return id;
}

export default function ComplaintPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState("identified");
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState(null);
  const [captcha, setCaptcha] = useState({ token: null, answer: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [video, setVideo] = useState(null);
  const [fileNotice, setFileNotice] = useState("");
  // Optional voice dictation: a mic button converts speech to text in the
  // description box (Web Speech API — no upload, nothing is recorded server-side).
  const [dictation, setDictation] = useState({ supported: false, listening: false, interim: "", error: "" });
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);

  useEffect(() => {
    // Deep link support: /complaint?anon=1 opens the form in anonymous mode.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("anon") === "1") {
      setMode("anonymous");
    }
    fetch("/api/config", { headers: { Accept: "application/json" } })
      .then((response) => response.json())
      .then(setConfig)
      .catch(() => setConfig({ captcha: { required: false } }));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return; // Voice typing stays hidden on unsupported browsers.
    setDictation((current) => ({ ...current, supported: true }));
    return () => {
      // Leaving the page must always stop the microphone session.
      listeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Recognition already ended.
      }
    };
  }, []);

  function stopDictation() {
    listeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // Recognition already ended.
    }
    setDictation((current) => ({ ...current, listening: false, interim: "" }));
  }

  function startDictation() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    setDictation({ supported: true, listening: true, interim: "", error: "" });
    listeningRef.current = true;

    const recognition = new Recognition();
    recognition.lang = "en-IN"; // handles English + Hindi/Hinglish speech well
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (finalText.trim()) {
        setForm((current) => {
          const existing = current.details_text.trimEnd();
          const merged = existing ? `${existing} ${finalText.trim()}` : finalText.trim();
          return { ...current, details_text: merged.slice(0, DETAILS_MAX) };
        });
        setFieldErrors((current) => ({ ...current, details_text: undefined }));
      }
      setDictation((current) => ({ ...current, interim }));
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        listeningRef.current = false;
        setDictation({
          supported: true,
          listening: false,
          interim: "",
          error: "Microphone access was blocked. Allow the mic in your browser settings, or type instead.",
        });
      } else if (event.error === "no-speech") {
        setDictation((current) => ({ ...current, error: "", interim: "" }));
      }
    };

    recognition.onend = () => {
      // Chrome ends the session periodically; restart while the user still
      // wants dictation so a long complaint is not cut off.
      if (listeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Already restarting.
        }
      }
      setDictation((current) => ({ ...current, listening: false, interim: "" }));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      setDictation((current) => ({ ...current, listening: false }));
    }
  }

  function toggleDictation() {
    if (dictation.listening) stopDictation();
    else startDictation();
  }

  const captchaRequired = Boolean(config?.captcha?.required);

  function setField(key) {
    return (event) => {
      // The college reference code is always stored uppercase, like a ref ID.
      const value = key === "institute_code" ? event.target.value.toUpperCase() : event.target.value;
      setForm((current) => ({ ...current, [key]: value }));
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    };
  }

  function switchMode(next) {
    if (next === mode) return;
    setMode(next);
    // Personal fields never carry across modes: anonymous mode must not retain
    // (or send) any of them, and identified mode starts clean.
    setForm((current) => ({ ...current, name: "", class_label: "", roll_no: "", mobile: "", email: "" }));
    setFieldErrors({});
  }

  async function copyRefId() {
    if (!result?.refId) return;
    try {
      await navigator.clipboard.writeText(result.refId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the ID stays visible for manual copying.
    }
  }

  function addPhotos(fileList) {
    setFileNotice("");
    const rejected = [];
    const accepted = [];
    for (const file of Array.from(fileList || [])) {
      if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
        rejected.push(`${file.name}: image type not supported (JPG/PNG/WebP/GIF)`);
        continue;
      }
      if (file.size > PHOTO_LIMIT_BYTES) {
        rejected.push(`${file.name}: larger than ${formatBytes(PHOTO_LIMIT_BYTES)}`);
        continue;
      }
      accepted.push(file);
    }
    const merged = [...photos];
    let dropped = false;
    for (const file of accepted) {
      if (merged.length >= MAX_PHOTOS) {
        dropped = true;
        break;
      }
      merged.push(file);
    }
    setPhotos(merged);
    if (rejected.length) setFileNotice(rejected.join(" · "));
    else if (dropped) setFileNotice(`Maximum ${MAX_PHOTOS} photos are allowed.`);
  }

  function removePhoto(index) {
    setPhotos((current) => current.filter((_, i) => i !== index));
    setFileNotice("");
  }

  function addVideo(file) {
    setFileNotice("");
    if (!file) return;
    if (!/^video\//i.test(file.type)) {
      setFileNotice("Please choose an MP4 or WebM video file.");
      return;
    }
    if (file.size > VIDEO_LIMIT_BYTES) {
      setFileNotice(`Video is larger than ${formatBytes(VIDEO_LIMIT_BYTES)}.`);
      return;
    }
    setVideo(file);
  }

  function buildFormData() {
    const data = new FormData();
    data.set("institute_code", form.institute_code);
    data.set("category", form.category);
    data.set("details_text", form.details_text);
    data.set("mode", mode);
    // Anonymous reports never include personal fields — the API rejects any
    // personal data in anonymous mode, so it is simply not sent.
    if (mode === "identified") {
      data.set("name", form.name);
      data.set("class_label", form.class_label);
      data.set("roll_no", form.roll_no);
      data.set("mobile", form.mobile);
      data.set("email", form.email);
    }
    data.set("deviceId", getDeviceId());
    if (captchaRequired && captcha.token) {
      data.set("captchaToken", captcha.token);
      if (captcha.answer !== null && captcha.answer !== undefined) data.set("captchaAnswer", captcha.answer);
    }
    photos.forEach((file) => data.append("images", file, file.name));
    if (video) data.append("videos", video, video.name);
    return data;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      const data = await submitComplaint(buildFormData());
      setResult({
        refId: data.ref_id,
        email: mode === "identified" ? form.email.trim() : "",
        anonymous: mode === "anonymous",
      });
    } catch (requestError) {
      const details = requestError.fields || {};
      if (Object.keys(details).length) {
        setFieldErrors(details);
        setError("Please fix the highlighted fields and try again.");
      } else if (requestError.status === 409) {
        setError("A very similar complaint was just submitted. If this is a new issue, try again in a few minutes.");
      } else if (requestError.status === 429) {
        setError("Too many submissions from this device. Please try again later.");
      } else {
        setError(requestError.message || "Submission failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (key) => fieldErrors[key] || fieldErrors[`contact.${key}`] || (key === "details_text" ? fieldErrors.details_text : null);

  return (
    <div className="quick-shell">
      <div className="quick-scene" aria-hidden="true">
        <span className="scene-glow" />
        <span className="scene-bars" />
        <span className="scene-eclipse" />
        <span className="scene-arc scene-arc-a" />
        <span className="scene-arc scene-arc-b" />
        <span className="scene-podium" />
        <span className="scene-floor" />
        <i className="scene-mote mote-1" />
        <i className="scene-mote mote-2" />
        <i className="scene-mote mote-3" />
        <i className="scene-mote mote-4" />
        <i className="scene-mote mote-5" />
      </div>
      <header className="quick-top">
        <svg viewBox="192 167 853 884" aria-hidden="true">{APTHEX_MARK}</svg>
        <b>APTHEX</b>
        <span>Student Help Portal</span>
      </header>

      <main className="quick-main">
        {result ? (
          <div className="card quick-success" role="status">
            <span className="icon-tile icon-tile-green">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg>
            </span>
            <h1 className="quick-title">Complaint registered.</h1>
            {result.anonymous ? (
              <>
                <p className="quick-sub">
                  You reported this anonymously — no name, email or mobile was collected or stored.
                </p>
                <span className="quick-ref">{result.refId}</span>
                <button type="button" className="btn btn-secondary btn-small" onClick={copyRefId}>
                  <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "Copied" : "Copy reference ID"}
                </button>
                <p className="quick-sub">
                  <strong>Save this reference ID now.</strong> It is the only way to check the status
                  or add follow-up details later — no email will be sent for this report.
                </p>
                <Link className="btn btn-secondary btn-small" href="/status">Check status / add follow-up</Link>
              </>
            ) : (
              <>
                <p className="quick-sub">Save this reference ID — it stays fully confidential.</p>
                <span className="quick-ref">{result.refId}</span>
                <p className="quick-sub">
                  A confirmation has been sent from our side to <strong>{result.email}</strong>.
                </p>
              </>
            )}
            <p className="quick-help-line">
              Any question about this case? <a href="tel:+919421161446">94211 61446</a> ·{" "}
              <a href="mailto:help@apthex.com">help@apthex.com</a>
            </p>
          </div>
        ) : (
          <form className="card quick-form" onSubmit={handleSubmit} noValidate>
            <h1 className="quick-title">Report a complaint</h1>
            {mode === "identified" ? (
              <p className="quick-sub">
                Fill this once. Your details stay confidential, and you get an email confirmation from APTHEX.
              </p>
            ) : (
              <p className="quick-sub">
                No name, no email, no mobile — only your college code and what happened.
              </p>
            )}

            {mode === "anonymous" && (
              <p className="anon-note" role="note">
                <Icon name="lock" size={14} />
                <span>
                  Your identity is never collected. <strong>Save the reference ID you receive</strong> —
                  it is the only way to follow up on this report.
                </span>
              </p>
            )}

            {error && <p className="alert alert-error" role="alert">{error}</p>}

            <div className="form-grid">
              <div className="field field-wide">
                <label className="field-label" htmlFor="qf-college">College code <i aria-hidden="true">*</i></label>
                <input
                  id="qf-college"
                  className="input input-mono"
                  value={form.institute_code}
                  onChange={setField("institute_code")}
                  placeholder="e.g. APS001"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={32}
                  required
                />
                <p className="field-hint">Type the reference code alloted to your college (e.g. on the notice your college shared).</p>
                {fieldError("institute_code") && <p className="error-text">{fieldError("institute_code")}</p>}
              </div>

              {mode === "identified" && (
                <>
                  <div className="field field-wide">
                    <label className="field-label" htmlFor="qf-name">Your name <i aria-hidden="true">*</i></label>
                    <input id="qf-name" className="input" value={form.name} onChange={setField("name")} autoComplete="name" required />
                    {fieldError("name") && <p className="error-text">{fieldError("name")}</p>}
                  </div>

                  <div className="field field-wide">
                    <label className="field-label" htmlFor="qf-class">Class / Department / Team / Division <span className="label-optional">(optional)</span></label>
                    <input id="qf-class" className="input" value={form.class_label} onChange={setField("class_label")} placeholder="e.g. FY-BSc / Computer Dept / A Team" maxLength={100} />
                    {fieldError("class_label") && <p className="error-text">{fieldError("class_label")}</p>}
                  </div>

                  <div className="field field-wide">
                    <label className="field-label" htmlFor="qf-roll">Roll number / Employee ID <span className="label-optional">(optional)</span></label>
                    <input id="qf-roll" className="input input-mono" value={form.roll_no} onChange={setField("roll_no")} placeholder="e.g. R-2024-1187" maxLength={50} />
                    {fieldError("roll_no") && <p className="error-text">{fieldError("roll_no")}</p>}
                  </div>

                  <div className="field field-wide">
                    <label className="field-label" htmlFor="qf-mobile">Mobile number <i aria-hidden="true">*</i></label>
                    <input id="qf-mobile" className="input" type="tel" value={form.mobile} onChange={setField("mobile")} autoComplete="tel" placeholder="+91 98765 43210" required />
                    {fieldError("mobile") && <p className="error-text">{fieldError("mobile")}</p>}
                  </div>

                  <div className="field field-wide">
                    <label className="field-label" htmlFor="qf-email">Email <i aria-hidden="true">*</i></label>
                    <input id="qf-email" className="input" type="email" value={form.email} onChange={setField("email")} autoComplete="email" placeholder="you@example.com" required />
                    <p className="field-hint">The “your complaint is registered” confirmation goes to this email.</p>
                    {fieldError("email") && <p className="error-text">{fieldError("email")}</p>}
                  </div>
                </>
              )}

              <div className="field field-wide">
                <label className="field-label" htmlFor="qf-category">What is the complaint about? <i aria-hidden="true">*</i></label>
                <select id="qf-category" className="select" value={form.category} onChange={setField("category")} required>
                  <option value="" disabled>Select a category</option>
                  {CATEGORY_META.map((category) => (
                    <option key={category.value} value={category.value}>{category.value}</option>
                  ))}
                </select>
                {fieldError("category") && <p className="error-text">{fieldError("category")}</p>}
              </div>

              <div className="field field-wide">
                <div className="between dictate-label-row">
                  <label className="field-label" htmlFor="qf-details">Describe the complaint <i aria-hidden="true">*</i></label>
                  {dictation.supported && (
                    <button
                      type="button"
                      className={`btn btn-ghost btn-small dictate-btn${dictation.listening ? " dictate-listening" : ""}`}
                      onClick={toggleDictation}
                      aria-pressed={dictation.listening}
                      aria-label={dictation.listening ? "Stop voice typing" : "Start voice typing"}
                    >
                      <Icon name={dictation.listening ? "stop" : "mic"} size={15} />
                      {dictation.listening ? "Stop voice typing" : "Speak instead"}
                    </button>
                  )}
                </div>
                <textarea
                  id="qf-details"
                  className="textarea"
                  value={form.details_text}
                  onChange={setField("details_text")}
                  minLength={10}
                  maxLength={DETAILS_MAX}
                  rows={6}
                  placeholder="What happened, where, and who is involved. Type it — or tap “Speak instead” and just say it."
                  required
                />
                {dictation.error && <p className="error-text">{dictation.error}</p>}
                {fieldError("details_text") && <p className="error-text">{fieldError("details_text")}</p>}
                <p className="field-hint">
                  {dictation.supported
                    ? "Voice typing is optional — speak in English or Hindi and edit the text before submitting. Nothing is recorded or stored."
                    : "You can type here. Voice typing needs Chrome, Edge or Safari on this device."}
                </p>
              </div>

              <div className="field field-wide">
                <span className="field-label">Photos &amp; video (optional)</span>
                <div className="row-wrap quick-uploads">
                  <label className="btn btn-secondary btn-small quick-upload">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      hidden
                      onChange={(event) => {
                        addPhotos(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <Icon name="image" size={16} /> Add photos
                  </label>
                  <label className="btn btn-secondary btn-small quick-upload">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,.mp4,.webm,.mov"
                      hidden
                      onChange={(event) => {
                        addVideo(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    <Icon name="play" size={16} /> Add video
                  </label>
                </div>
                {(photos.length > 0 || video) && (
                  <ul className="quick-files">
                    {photos.map((file, index) => (
                      <li className="file-chip" key={`${file.name}-${index}`}>
                        <Icon name="image" size={14} />
                        <span>{file.name}</span>
                        <small>{formatBytes(file.size)}</small>
                        <button type="button" onClick={() => removePhoto(index)} aria-label={`Remove ${file.name}`}>
                          <Icon name="close" size={13} />
                        </button>
                      </li>
                    ))}
                    {video && (
                      <li className="file-chip">
                        <Icon name="play" size={14} />
                        <span>{video.name}</span>
                        <small>{formatBytes(video.size)}</small>
                        <button type="button" onClick={() => setVideo(null)} aria-label={`Remove ${video.name}`}>
                          <Icon name="close" size={13} />
                        </button>
                      </li>
                    )}
                  </ul>
                )}
                {fileNotice && <p className="error-text">{fileNotice}</p>}
                <p className="field-hint">Up to 5 photos (10 MB each) and one video (50 MB). Evidence helps the college act faster.</p>
              </div>

              {captchaRequired && (
                <div className="field field-wide">
                  <span className="field-label">Security check</span>
                  <CaptchaField lang="en" config={config?.captcha} onSolved={setCaptcha} />
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-large btn-block" disabled={submitting}>
              {submitting ? "Registering…" : mode === "anonymous" ? "Submit anonymous report" : "Register complaint"}
            </button>

            <button
              type="button"
              className="anon-switch"
              onClick={() => switchMode(mode === "identified" ? "anonymous" : "identified")}
            >
              {mode === "identified" ? "Prefer to stay anonymous?" : "Prefer to share your details?"}
            </button>

            <p className="quick-help-line">
              Need help? <a href="tel:+919421161446">+91 94211 61446</a> ·{" "}
              <a href="mailto:help@apthex.com">help@apthex.com</a>
            </p>

            <p className="field-hint quick-consent">
              {mode === "anonymous"
                ? "By submitting you confirm the details are true. No identity data is collected; APTHEX shares the report only with the authorised college contact."
                : "By submitting you confirm the details are true. APTHEX shares the complaint only with the authorised college contact."}
            </p>
          </form>
        )}
      </main>

      <footer className="quick-footer">
        <p className="quick-help">
          Need help? <a href="tel:+919421161446">Call 94211 61446</a> ·{" "}
          <a href="mailto:help@apthex.com">help@apthex.com</a>
        </p>
        Powered by APTHEX · Student Help Portal
      </footer>
    </div>
  );
}
