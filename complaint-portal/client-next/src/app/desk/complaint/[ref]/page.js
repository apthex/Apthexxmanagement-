"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Protected, { useAuth } from "../../../../components/Protected.jsx";
import DeskShell from "../../../../components/DeskShell.jsx";
import Icon from "../../../../components/Icon.jsx";
import StatusBadge from "../../../../components/StatusBadge.jsx";
import { api } from "../../../../lib/api.js";
import { formatBytes, formatDateTime } from "../../../../lib/format.js";

const EVENT_LABELS = {
  note: "Internal note",
  reporter_followup: "Reporter follow-up",
  completed: "Case completed",
  reopened: "Case reopened",
  assigned: "Case assigned",
  unassigned: "Assignment removed",
  flagged_spam: "Flagged as spam",
  unflagged_spam: "Spam flag removed",
  escalated: "Escalated",
};

function ComplaintView() {
  const params = useParams();
  const ref = params.ref;
  const router = useRouter();
  const { member } = useAuth();
  const isOwner = member?.role === "owner";
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await api(`/api/complaints/${encodeURIComponent(ref)}`);
      setData(result);
    } catch (requestError) {
      if (requestError.status === 401) return;
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    load();
    // Assignment dropdown data is an owner-only concern.
    if (isOwner) {
      api("/api/staff/assignable")
        .then((result) => setMembers(result.members))
        .catch(() => {});
    }
  }, [load, isOwner]);

  async function patch(body, message) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/complaints/${encodeURIComponent(ref)}`, { method: "PATCH", json: body });
      setNotice(message);
      await load();
    } catch (requestError) {
      if (requestError.status === 401) {
        router.replace("/complaint-review-console");
        return;
      }
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!note.trim()) return;
    await patch({ note: note.trim() }, "Internal note added.");
    setNote("");
  }

  async function openAttachment(attachment) {
    setError("");
    const popup = window.open("about:blank", "_blank");
    try {
      const signed = await api(`/api/attachments/${attachment._id}/url`);
      if (popup) {
        popup.opener = null;
        popup.location.href = signed.url;
      } else {
        window.location.href = signed.url;
      }
    } catch (requestError) {
      popup?.close();
      setError(requestError.message);
    }
  }

  if (loading) {
    return (
      <DeskShell title="Loading case…">
        <div className="center-state center-state-inline"><span className="spinner" /><p>Opening the secure case record…</p></div>
      </DeskShell>
    );
  }

  if (!data) {
    return (
      <DeskShell title="Case unavailable">
        <div className="card empty-state">
          <span className="icon-tile icon-tile-amber"><Icon name="alert" size={26} /></span>
          <h2>This case could not be opened</h2>
          <p>{error || "The case may have been deleted under the retention policy."}</p>
          <Link href="/desk" className="btn btn-secondary">Back to cases</Link>
        </div>
      </DeskShell>
    );
  }

  const complaint = data.complaint;
  const completed = complaint.status === "completed";
  const spam = Boolean(complaint.flagged_spam);

  return (
    <DeskShell
      title={complaint.ref_id}
      subtitle={`${complaint.institute_code} · received ${formatDateTime(complaint.created_at)}`}
      actions={
        <Link href="/desk" className="btn btn-ghost btn-small">
          <Icon name="arrowLeft" size={16} /> All cases
        </Link>
      }
    >
      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={18} /> {error}</div>}
      {notice && <div className="alert alert-success" role="status"><Icon name="check" size={18} /> {notice}</div>}

      <div className="detail-grid">
        <div className="stack-lg">
          <section className="card case-summary">
            <div className="case-title-row">
              <div>
                <span className="mini-label">Reference</span>
                <h2 className="mono">{complaint.ref_id}</h2>
              </div>
              <StatusBadge status={complaint.status} urgent={complaint.urgent} spam={complaint.flagged_spam} />
            </div>

            {complaint.urgent && (
              <div className="alert alert-error">
                <Icon name="alert" size={18} />
                <span>Urgent safety concern. Follow the approved urgent-case escalation procedure.</span>
              </div>
            )}

            <dl className="meta-grid">
              <div><dt>Institute</dt><dd className="mono">{complaint.institute_code}</dd></div>
              <div><dt>Category</dt><dd>{complaint.category}</dd></div>
              <div><dt>Reporting mode</dt><dd className="capitalize">{complaint.mode}</dd></div>
              <div><dt>Class / course</dt><dd>{complaint.class_label || "—"}</dd></div>
              <div><dt>Received</dt><dd>{formatDateTime(complaint.created_at)}</dd></div>
              <div><dt>Completed</dt><dd>{formatDateTime(complaint.completed_at)}</dd></div>
              <div><dt>Escalated</dt><dd>{complaint.escalated ? "Yes" : "No"}</dd></div>
              <div><dt>Assigned to</dt><dd>{complaint.assigned_to?.name || "Unassigned"}</dd></div>
            </dl>

            <div className="description-block">
              <span className="mini-label">Complaint description</span>
              <p className="plain-text">{complaint.details_text}</p>
            </div>
          </section>

          <section className="card">
            <div className="card-heading between">
              <div>
                <h2>Reporter details</h2>
                <p>Stored separately from anonymous reports. Handle with care.</p>
              </div>
              <span className={complaint.mode === "anonymous" ? "badge badge-neutral" : "badge status-in_process"}>
                {complaint.mode === "anonymous" ? "Anonymous" : "Identified"}
              </span>
            </div>
            {data.contact ? (
              <dl className="contact-grid">
                <div><dt>Name</dt><dd>{data.contact.name}</dd></div>
                <div><dt>Roll number</dt><dd>{data.contact.roll_no || "—"}</dd></div>
                <div><dt>Mobile</dt><dd><a href={`tel:${data.contact.mobile}`}>{data.contact.mobile}</a></dd></div>
                <div><dt>Email</dt><dd><a href={`mailto:${data.contact.email}`}>{data.contact.email}</a></dd></div>
              </dl>
            ) : (
              <p className="muted">No identity or contact data is stored for this anonymous report.</p>
            )}
          </section>

          <section className="card">
            <div className="card-heading between">
              <div>
                <h2>Evidence</h2>
                <p>Private files. Opening a file issues a short-lived signed link and records an audit event.</p>
              </div>
              <span className="badge badge-neutral">{data.attachments.length} file(s)</span>
            </div>
            {data.attachments.length ? (
              <ul className="attachment-list">
                {data.attachments.map((attachment) => (
                  <li key={attachment._id}>
                    <span className="icon-tile icon-tile-small">
                      <Icon name={attachment.type === "image" ? "image" : attachment.type === "video" ? "play" : "mic"} size={18} />
                    </span>
                    <div>
                      <strong>{attachment.type === "image" ? "Image evidence" : attachment.type === "video" ? "Video evidence" : "Voice note"}</strong>
                      <span className="small muted">{attachment.mime} · {formatBytes(attachment.size_bytes)} · {formatDateTime(attachment.created_at)}</span>
                    </div>
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => openAttachment(attachment)}>
                      <Icon name="external" size={15} /> Open privately
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No evidence was attached to this report.</p>
            )}
          </section>

          <section className="card">
            <div className="card-heading">
              <h2>Case timeline</h2>
              <p>Internal actions and reporter follow-ups, in order.</p>
            </div>
            {data.events.length ? (
              <ol className="timeline">
                {data.events.map((event) => (
                  <li key={event.id}>
                    <span className="timeline-dot" aria-hidden="true" />
                    <div>
                      <div className="between timeline-head">
                        <strong>{EVENT_LABELS[event.event] || event.event}</strong>
                        <time dateTime={event.occurred_at}>{formatDateTime(event.occurred_at)}</time>
                      </div>
                      {event.note && <p className="plain-text">{event.note}</p>}
                      <span className="small muted">{event.member?.name ? `By ${event.member.name}` : "Public / system"}</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No case events yet.</p>
            )}
          </section>
        </div>

        <aside className="stack">
          {isOwner ? (
            <>
              <section className="card side-card">
                <h2>Case status</h2>
                <p className="small muted">
                  Completing a case starts the approved retention timer. The complaint and evidence are permanently deleted when it expires.
                </p>
            <button
              type="button"
              className={completed ? "btn btn-secondary btn-block" : "btn btn-primary btn-block"}
              disabled={saving}
              onClick={() => {
                if (!completed && !window.confirm("Mark this case complete? The retention deletion timer will start.")) return;
                patch({ completed: !completed }, completed ? "Case reopened." : "Case marked complete. Retention timer started.");
              }}
            >
              <Icon name={completed ? "refresh" : "check"} size={17} />
              {completed ? "Reopen case" : "Mark complete"}
            </button>
            {completed && complaint.delete_after && (
              <p className="alert alert-warning small">
                <Icon name="clock" size={16} /> Scheduled for deletion {formatDateTime(complaint.delete_after)}
              </p>
            )}
            <button
              type="button"
              className={`btn btn-block ${spam ? "btn-secondary" : "btn-ghost"}`}
              disabled={saving}
              onClick={() => patch({ flagged_spam: !spam }, spam ? "Spam flag removed." : "Case flagged as spam.")}
            >
              <Icon name="alert" size={16} /> {spam ? "Remove spam flag" : "Flag as spam"}
            </button>
          </section>

          <section className="card side-card">
            <h2>Assignment</h2>
            <label className="field">
              <span className="field-label">Assigned case-team member</span>
              <select
                className="select"
                value={complaint.assigned_to?.id || ""}
                disabled={saving}
                onChange={(event) => patch({ assigned_to: event.target.value || null }, event.target.value ? "Case assignment updated." : "Case unassigned.")}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="card side-card">
            <h2>Add internal note</h2>
            <form onSubmit={addNote} className="stack">
              <textarea
                className="textarea"
                rows={5}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={5000}
                placeholder="Record an action, call outcome or handover note. Never paste evidence contents here."
              />
              <button type="submit" className="btn btn-secondary btn-block" disabled={saving || !note.trim()}>
                <Icon name="file" size={16} /> Add note
              </button>
            </form>
          </section>
            </>
          ) : (
            <section className="card side-card">
              <h2>Read-only view</h2>
              <p className="small muted">
                You are viewing this case as a {member?.institute_code ? `teacher of ${member.institute_code}` : "teacher"}. Case status,
                assignment and internal notes are handled by the APTHEX admin team.
              </p>
            </section>
          )}

          <section className="card side-card">
            <h2>Privacy reminder</h2>
            <ul className="check-list compact">
              <li><Icon name="lock" size={15} /> Only authorised APTHEX staff may view this case.</li>
              <li><Icon name="lock" size={15} /> Do not share reference IDs or evidence externally.</li>
              <li><Icon name="lock" size={15} /> Institute staff have no access.</li>
            </ul>
          </section>
        </aside>
      </div>
    </DeskShell>
  );
}

export default function DeskComplaintPage() {
  return <Protected><ComplaintView /></Protected>;
}
