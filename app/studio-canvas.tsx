"use client";
import { useEffect, useRef, useState } from "react";
import type { StudioPlan } from "../lib/studio";
import type { createStudioScene } from "./studio-scene";
type Handle = ReturnType<typeof createStudioScene>;
export default function StudioCanvas({
  plan,
  selected,
  onSelect,
}: {
  plan: StudioPlan;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<Handle | null>(null),
    latest = useRef({ plan, selected, onSelect });
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [sun, setSun] = useState(40);
  useEffect(() => {
    latest.current = { plan, selected, onSelect };
    scene.current?.update(plan, selected);
  }, [plan, selected, onSelect]);
  useEffect(() => {
    let closed = false;
    import("./studio-scene")
      .then(({ createStudioScene }) => {
        if (closed || !canvas.current) return;
        try {
          scene.current = createStudioScene(canvas.current, (id) =>
            latest.current.onSelect(id),
          );
          scene.current.update(latest.current.plan, latest.current.selected);
          scene.current.setSun(40, 180);
          setReady(true);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "3D graphics could not start",
          );
        }
      })
      .catch(() =>
        setError("3D files could not load. Reload or use the surface plan."),
      );
    return () => {
      closed = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  return (
    <div className="s4-canvas-frame">
      <canvas
        ref={canvas}
        aria-label="Interactive 3D solar property. Drag to orbit, scroll to zoom, and select panels. The surface plan provides keyboard editing."
        tabIndex={0}
      />
      {!ready && !error && (
        <div className="s4-canvas-loading">Building your perspective…</div>
      )}
      {error && (
        <div role="alert" className="s4-canvas-loading">
          {error}
          <br />
          Use Surface plan to continue designing.
        </div>
      )}
      <div className="s4-canvas-toolbar">
        <button onClick={() => scene.current?.reset()} disabled={!ready}>
          Reset view
        </button>
        <button
          disabled={!ready}
          onClick={() => {
            const url = scene.current?.capture();
            if (url) {
              const a = document.createElement("a");
              a.href = url;
              a.download = "solar4u-3d-concept.png";
              a.click();
            }
          }}
        >
          Save image
        </button>
        <label>
          Preview sun {sun}°
          <input
            aria-label="Preview sun altitude"
            type="range"
            min={10}
            max={80}
            value={sun}
            onChange={(e) => {
              setSun(Number(e.target.value));
              scene.current?.setSun(Number(e.target.value), 180);
            }}
          />
        </label>
      </div>
      <span className="s4-canvas-note">
        Drag to orbit · Scroll to zoom · Click a panel to edit
        <br />
        Lighting study at south azimuth; not an annual shading analysis
      </span>
    </div>
  );
}
