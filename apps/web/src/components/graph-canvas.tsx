"use client";
/**
 * GRAFO — dueño: P2.
 * Layout en capas VERTICAL: la profundidad baja, los hermanos se reparten
 * el ancho de la fila. El DAG real llega a 6 niveles de profundidad, que en
 * horizontal no caben en el panel; en vertical cada nodo usa el ancho
 * completo y los labels largos del fixture se leen sin escalar nada.
 *
 * Aristas en SVG, nodos en divs absolutos encima: hover y transiciones son
 * HTML normal y se ven en cámara.
 *
 * Firma de props intacta (P1): GraphCanvas({ state }) y SavedHours({ state }).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  STATUS_COLOR,
  KIND_LABEL,
  type AppState,
  type Blocker,
} from "@/lib/graph-types";

const ROW_H = 88; // fila de un solo nodo: el label cabe en 2 líneas
const ROW_H_SPLIT = 108; // fila bifurcada: nodos angostos, 3 líneas
const ROW_GAP = 26;
const COL_GAP = 14;
const FALLBACK_W = 480;

type Placed = Blocker & {
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
};

/** Profundidad = fila. Relajación acotada; tolera ciclos sin colgarse. */
function layout(blockers: Blocker[], W: number) {
  const depth = new Map(blockers.map((b) => [b.id, 0]));
  for (let i = 0; i < blockers.length; i++) {
    for (const b of blockers) {
      const d = depth.get(b.id) ?? 0;
      for (const t of b.blocks) {
        if (depth.has(t) && (depth.get(t) ?? 0) < d + 1) depth.set(t, d + 1);
      }
    }
  }

  const rows: Blocker[][] = [];
  for (const b of blockers) (rows[depth.get(b.id) ?? 0] ||= []).push(b);

  // Una fila bifurcada parte el ancho, así que necesita más alto para que el
  // label no se corte. Alto por fila, no global.
  const placed: Placed[] = [];
  let y = 0;
  rows.forEach((row, ri) => {
    if (!row) return;
    const w = (W - (row.length - 1) * COL_GAP) / row.length;
    const h = row.length > 1 ? ROW_H_SPLIT : ROW_H;
    row.forEach((b, ci) => {
      placed.push({ ...b, x: ci * (w + COL_GAP), y, w, h, row: ri });
    });
    y += h + ROW_GAP;
  });

  return { placed, height: Math.max(0, y - ROW_GAP) };
}

export function GraphCanvas({ state }: { state: AppState }) {
  // El grafo se adapta al ancho medido: sin transform, sin texto diminuto.
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setBoxW(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = boxW || FALLBACK_W;
  const { placed, height } = layout(state.blockers, W);
  const byId = new Map(placed.map((p) => [p.id, p]));

  return (
    <div>
      <div className="rc-canvas" ref={boxRef} style={{ height }}>
        <svg className="rc-edges" width={W} height={height}>
          {placed.flatMap((from) =>
            from.blocks.map((id) => {
              const to = byId.get(id);
              if (!to) return null;
              const x1 = from.x + from.w / 2;
              const y1 = from.y + from.h;
              const x2 = to.x + to.w / 2;
              const y2 = to.y;
              const dy = Math.max(12, (y2 - y1) * 0.55);
              return (
                <g key={`${from.id}->${id}`}>
                  <path
                    className="rc-edge"
                    data-status={from.status}
                    d={`M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2 - 7}`}
                    style={{ stroke: STATUS_COLOR[from.status] }}
                  />
                  <path
                    className="rc-arrow"
                    d={`M${x2 - 4.5},${y2 - 8} L${x2},${y2} L${x2 + 4.5},${y2 - 8} Z`}
                    style={{ fill: STATUS_COLOR[from.status] }}
                  />
                </g>
              );
            }),
          )}
        </svg>

        {placed.map((b) => (
          <article
            key={b.id}
            className="rc-node"
            data-status={b.status}
            data-row={b.row}
            data-split={b.w < W ? "1" : undefined}
            tabIndex={0}
            style={
              {
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h,
                ["--node" as string]: STATUS_COLOR[b.status],
              } as React.CSSProperties
            }
          >
            <span className="rc-node-head">
              <i className="rc-dot" />
              <span className="rc-node-kind">
                {b.kind ? KIND_LABEL[b.kind] : "sin triar"}
              </span>
              <span className="rc-node-owner">{b.owner}</span>
              {b.status === "needs_meeting" && (
                <span className="rc-badge">reunión</span>
              )}
              {b.status === "resolved" && b.savedPersonHours > 0 && (
                <span className="rc-saved">+{b.savedPersonHours}h</span>
              )}
            </span>

            <h4 className="rc-node-label" title={b.label}>
              {b.label}
            </h4>

            {b.resolution && (
              <div className="rc-tip" role="note">
                <p>{b.resolution.summary}</p>
                {b.resolution.sources?.length ? (
                  <ul>
                    {b.resolution.sources.map((s) => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </article>
        ))}
      </div>

      <ul className="rc-legend">
        {(
          [
            ["pending", "sin tocar"],
            ["resolving", "resolviendo"],
            ["resolved", "resuelto async"],
            ["needs_meeting", "irreducible"],
          ] as const
        ).map(([s, label]) => (
          <li key={s} style={{ ["--node" as string]: STATUS_COLOR[s] }}>
            <i className="rc-dot" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El número grande del cierre del demo. Tweened para que se vea subir. */
export function SavedHours({ state }: { state: AppState }) {
  const totals = state.totals;
  const shown = useTween(totals.saved);
  const pct = totals.before ? (totals.saved / totals.before) * 100 : 0;

  return (
    <div className="rc-meter" data-live={totals.saved > 0 ? "yes" : "no"}>
      <div className="rc-meter-top">
        <strong className="rc-meter-num">{shown.toFixed(1)}</strong>
        <span className="rc-meter-unit">
          horas-persona
          <br />
          recuperadas
        </span>
      </div>
      <div className="rc-bar">
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="rc-meter-foot">
        de {totals.before.toFixed(1)} h de coordinación · quedan{" "}
        {totals.after.toFixed(1)} h
      </p>
    </div>
  );
}

function useTween(target: number) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const e = 1 - Math.pow(1 - t, 3);
      setV(a + (target - a) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
