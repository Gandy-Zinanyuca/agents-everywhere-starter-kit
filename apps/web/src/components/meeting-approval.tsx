"use client";
/**
 * APPROVAL CARD — owner: P4.
 * None of this calls any external provider: it's the minimum viable meeting
 * that build_meeting() proposed, and a human decides whether to confirm it.
 * Approve/Cancel is local state — the frozen scope does not include a real
 * Calendar integration.
 */
import { useState } from "react";
import type { Meeting } from "@/lib/graph-types";

export function MeetingApproval({ meeting }: { meeting: Meeting }) {
  const [status, setStatus] = useState<"pending" | "approved" | "cancelled">(
    "pending",
  );
  const [editing, setEditing] = useState(false);
  const [slot, setSlot] = useState(meeting.slot);

  if (status === "cancelled") {
    return (
      <section className="ck-approval" aria-label="Meeting cancelled">
        <h3>Minimum viable meeting — cancelled</h3>
        <p className="ck-local-note">
          The blockers that needed it are still needs_meeting.
        </p>
      </section>
    );
  }

  return (
    <section className="ck-approval" aria-label="Approve meeting">
      <h3>Minimum viable meeting</h3>
      <p style={{ fontSize: ".88rem", opacity: 0.8 }}>
        {meeting.minutes} min ·{" "}
        {editing ? (
          <input
            value={slot}
            onChange={(event) => setSlot(event.target.value)}
            style={{ font: "inherit", width: "auto" }}
          />
        ) : (
          slot
        )}{" "}
        · {meeting.attendees.join(", ")}
      </p>
      <ol style={{ fontSize: ".9rem" }}>
        {meeting.agenda.map((item) => (
          <li key={item.topic}>
            <strong>{item.topic}</strong> — {item.owner} · {item.minutes} min
            <br />
            <span style={{ opacity: 0.75 }}>
              Expected decision: {item.decision}
            </span>
          </li>
        ))}
      </ol>

      {status === "approved" ? (
        <p role="status" className="ck-notice">
          Meeting approved for {slot}. Nobody was invited without a human
          confirming it.
        </p>
      ) : (
        <div className="ck-approval-actions">
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            onClick={() => setStatus("approved")}
          >
            Approve
          </button>
          <button type="button" className="ck-btn" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Edit"}
          </button>
          <button
            type="button"
            className="ck-btn"
            onClick={() => setStatus("cancelled")}
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
