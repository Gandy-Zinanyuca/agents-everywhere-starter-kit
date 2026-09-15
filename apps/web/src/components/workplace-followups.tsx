"use client";
/**
 * RESOLUTION RECORD — owner: P4.
 * Inherited from the starter kit as-is: propose/approve/deny/refresh against
 * Ambiguous (the write boundary in src/lib/server/*, which nobody touches).
 * Adapted for Critical Path: this records blocker resolutions approved by a
 * human, not follow-ups on a sample incident.
 * `propose_resolution` (app-control.tsx, owner P1) writes here.
 */
import { useState, type FormEvent } from "react";
import type { WorkplaceControls } from "@/lib/use-workplace";

export function WorkplaceFollowups({
  incidentId,
  workplace,
}: {
  incidentId: string;
  workplace: WorkplaceControls;
}) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const { status, proposal, busy, notice } = workplace;
  const tasks = status?.status === "connected" ? status.tasks : [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreparing(true);
    setError("");
    try {
      await workplace.propose({ incidentId, title, details });
      setTitle("");
      setDetails("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not prepare the proposal.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function refresh() {
    setError("");
    try {
      await workplace.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not refresh the record from Ambiguous.",
      );
    }
  }

  return (
    <section className="ck-followups" aria-labelledby="followup-title">
      <header className="ck-followups-header">
        <div>
          <h2 id="followup-title">Recorded resolutions</h2>
          <p className="ck-local-note">
            A resolution is only saved after approval on this page.
            Refreshing reads the provider again.
          </p>
        </div>
        <span className="ck-tag">Ambiguous</span>
      </header>

      {status?.status === "unconfigured" ? (
        <div className="ck-setup-note">
          <strong>Connect a workspace to save resolutions</strong>
          <p>{status.message}</p>
          <p>
            The rest of the flow (graph, triage, pre-reads, meeting) keeps
            working without this. No local record is created as a
            replacement.
          </p>
        </div>
      ) : status?.status === "connected" ? (
        <p className="ck-local-note">
          Read from Ambiguous as {status.identityName}. Workspace{" "}
          <code>{status.workspaceId}</code>.
        </p>
      ) : (
        <p className="ck-local-note">
          {workplace.error
            ? "Connection to the workspace is unavailable."
            : "Connecting to Ambiguous…"}
        </p>
      )}

      {tasks.length ? (
        <ul className="ck-task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <span aria-hidden="true">○</span>
              <div>
                <strong>{task.title}</strong>
                <code className="ck-record-id">{task.id}</code>
                {task.url ? (
                  <a href={task.url} target="_blank" rel="noreferrer">
                    Open record in Ambiguous
                  </a>
                ) : (
                  <span className="ck-muted">
                    Ambiguous did not return a link. Use this ID in the
                    workspace.
                  </span>
                )}
                <details>
                  <summary>Saved detail</summary>
                  <p className="ck-preserve-lines">{task.description}</p>
                </details>
              </div>
            </li>
          ))}
        </ul>
      ) : status?.status === "connected" ? (
        <p className="ck-empty">No resolutions saved for this project.</p>
      ) : null}

      <button
        type="button"
        className="ck-btn"
        disabled={busy}
        onClick={refresh}
      >
        Refresh from Ambiguous
      </button>

      <form onSubmit={submit} className="ck-task-form ck-task-form--stacked">
        <label className="ck-sr-only" htmlFor="task-title">
          Manually record a resolution
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="Resolution title…"
          required
        />
        <label className="ck-sr-only" htmlFor="task-details">
          Resolution detail
        </label>
        <textarea
          id="task-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={4000}
          placeholder="What was decided or resolved, and why"
          required
          rows={3}
        />
        <button
          className="ck-btn ck-btn--primary"
          disabled={status?.status !== "connected" || preparing || busy}
          type="submit"
        >
          {preparing ? "Preparing…" : "Review"}
        </button>
      </form>

      {proposal && (
        <section className="ck-approval" aria-label="Approve record in Ambiguous">
          <h3>Approve this record in Ambiguous</h3>
          <p>
            Saved as {proposal.identityName} in workspace{" "}
            <code>{proposal.workspaceId}</code>. Expires{" "}
            {new Date(proposal.expiresAt).toLocaleTimeString()}.
          </p>
          <strong>{proposal.title}</strong>
          <p className="ck-preserve-lines">{proposal.description}</p>
          <p>This is a real write. Review the exact fields above.</p>
          <div className="ck-approval-actions">
            <button
              type="button"
              className="ck-btn ck-btn--primary"
              disabled={busy}
              onClick={workplace.approve}
            >
              {busy ? "Saving…" : "Approve and save to Ambiguous"}
            </button>
            <button
              type="button"
              className="ck-btn"
              disabled={busy}
              onClick={workplace.deny}
            >
              Reject
            </button>
          </div>
        </section>
      )}

      {(error || workplace.error) && (
        <p role="alert" className="ck-error">
          {error || workplace.error}
        </p>
      )}
      <p role="status" className="ck-notice">
        {notice}
      </p>
    </section>
  );
}
