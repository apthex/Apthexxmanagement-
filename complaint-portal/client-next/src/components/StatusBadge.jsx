"use client";

export default function StatusBadge({ status, urgent = false, spam = false }) {
  return (
    <span className="badge-row">
      <span className={`badge status-${status}`}>{status === "completed" ? "Completed" : "In Process"}</span>
      {urgent && <span className="badge badge-urgent">Urgent</span>}
      {spam && <span className="badge badge-spam">Spam</span>}
    </span>
  );
}
