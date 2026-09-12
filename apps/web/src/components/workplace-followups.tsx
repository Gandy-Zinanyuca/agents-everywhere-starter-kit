"use client";
/**
 * REGISTRO DE RESOLUCIONES — dueño: P4.
 * Heredado del starter kit tal cual: propose/approve/deny/refresh contra
 * Ambiguous (la frontera de escritura de src/lib/server/*, que nadie toca).
 * Adaptado para Ruta Crítica: esto registra resoluciones de bloqueos
 * aprobadas por un humano, no follow-ups de un incidente de ejemplo.
 * `propose_resolution` (app-control.tsx, dueño P1) escribe aquí.
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
          : "No se pudo preparar la propuesta.",
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
          : "No se pudo refrescar el registro desde Ambiguous.",
      );
    }
  }

  return (
    <section className="ck-followups" aria-labelledby="followup-title">
      <header className="ck-followups-header">
        <div>
          <h2 id="followup-title">Resoluciones registradas</h2>
          <p className="ck-local-note">
            Una resolución solo se guarda tras la aprobación en esta página.
            Refrescar vuelve a leer el proveedor.
          </p>
        </div>
        <span className="ck-tag">Ambiguous</span>
      </header>

      {status?.status === "unconfigured" ? (
        <div className="ck-setup-note">
          <strong>Conecta un workspace para guardar resoluciones</strong>
          <p>{status.message}</p>
          <p>
            El resto del flujo (grafo, triage, pre-reads, reunión) sigue
            funcionando sin esto. No se crea ningún registro local como
            reemplazo.
          </p>
        </div>
      ) : status?.status === "connected" ? (
        <p className="ck-local-note">
          Leído de Ambiguous como {status.identityName}. Workspace{" "}
          <code>{status.workspaceId}</code>.
        </p>
      ) : (
        <p className="ck-local-note">
          {workplace.error
            ? "Conexión con el workspace no disponible."
            : "Conectando con Ambiguous…"}
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
                    Abrir registro en Ambiguous
                  </a>
                ) : (
                  <span className="ck-muted">
                    Ambiguous no devolvió un link. Usa este ID en el
                    workspace.
                  </span>
                )}
                <details>
                  <summary>Detalle guardado</summary>
                  <p className="ck-preserve-lines">{task.description}</p>
                </details>
              </div>
            </li>
          ))}
        </ul>
      ) : status?.status === "connected" ? (
        <p className="ck-empty">Sin resoluciones guardadas para este proyecto.</p>
      ) : null}

      <button
        type="button"
        className="ck-btn"
        disabled={busy}
        onClick={refresh}
      >
        Refrescar desde Ambiguous
      </button>

      <form onSubmit={submit} className="ck-task-form ck-task-form--stacked">
        <label className="ck-sr-only" htmlFor="task-title">
          Registrar una resolución manualmente
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="Título de la resolución…"
          required
        />
        <label className="ck-sr-only" htmlFor="task-details">
          Detalle de la resolución
        </label>
        <textarea
          id="task-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={4000}
          placeholder="Qué se decidió o resolvió, y por qué"
          required
          rows={3}
        />
        <button
          className="ck-btn ck-btn--primary"
          disabled={status?.status !== "connected" || preparing || busy}
          type="submit"
        >
          {preparing ? "Preparando…" : "Revisar"}
        </button>
      </form>

      {proposal && (
        <section className="ck-approval" aria-label="Aprobar registro en Ambiguous">
          <h3>Aprobar este registro en Ambiguous</h3>
          <p>
            Se guarda como {proposal.identityName} en el workspace{" "}
            <code>{proposal.workspaceId}</code>. Expira{" "}
            {new Date(proposal.expiresAt).toLocaleTimeString()}.
          </p>
          <strong>{proposal.title}</strong>
          <p className="ck-preserve-lines">{proposal.description}</p>
          <p>Esto es una escritura real. Revisa los campos exactos arriba.</p>
          <div className="ck-approval-actions">
            <button
              type="button"
              className="ck-btn ck-btn--primary"
              disabled={busy}
              onClick={workplace.approve}
            >
              {busy ? "Guardando…" : "Aprobar y guardar en Ambiguous"}
            </button>
            <button
              type="button"
              className="ck-btn"
              disabled={busy}
              onClick={workplace.deny}
            >
              Rechazar
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
