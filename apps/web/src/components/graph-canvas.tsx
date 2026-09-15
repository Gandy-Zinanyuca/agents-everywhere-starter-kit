"use client";
/**
 * GRAPH — owner: P2.
 * VERTICAL layered layout: depth goes down, siblings split the row's width.
 * The real DAG reaches 6 levels of depth, which don't fit the panel
 * horizontally; vertically each node uses the full width and the fixture's
 * long labels read fine without scaling anything down.
 *
 * Edges in SVG, nodes in absolute divs on top: hover and transitions are
 * plain HTML and read well on camera.
 *
 * Props signature intact (P1): GraphCanvas({ state }) and SavedHours({ state }).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  STATUS_COLOR,
  KIND_LABEL,
  type AppState,
  type Blocker,
} from "@/lib/graph-types";

const ROW_H = 88; // single-node row: the label fits in 2 lines
const ROW_H_SPLIT = 108; // split row: narrow nodes, 3 lines
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

/** Depth = row. Bounded relaxation; tolerates cycles without hanging. */
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

  // A split row divides the width, so it needs more height so the label
  // doesn't get cut off. Height per row, not global.
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
  // The graph adapts to the measured width: no transform, no tiny text.
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
                {b.kind ? KIND_LABEL[b.kind] : "not triaged"}
              </span>
              <span className="rc-node-owner">{b.owner}</span>
              {b.status === "needs_meeting" && (
                <span className="rc-badge">meeting</span>
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
            ["pending", "untouched"],
            ["resolving", "resolving"],
            ["resolved", "resolved async"],
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

/** The big number that closes the demo. Tweened so it looks like it's rising. */
export function SavedHours({ state }: { state: AppState }) {
  const totals = state.totals;
  const shown = useTween(totals.saved);
  const pct = totals.before ? (totals.saved / totals.before) * 100 : 0;

  return (
    <div className="rc-meter" data-live={totals.saved > 0 ? "yes" : "no"}>
      <div className="rc-meter-top">
        <strong className="rc-meter-num">{shown.toFixed(1)}</strong>
        <span className="rc-meter-unit">
          person-hours
          <br />
          recovered
        </span>
      </div>
      <div className="rc-bar">
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="rc-meter-foot">
        of {totals.before.toFixed(1)}h coordination · {totals.after.toFixed(1)}h{" "}
        remaining
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
