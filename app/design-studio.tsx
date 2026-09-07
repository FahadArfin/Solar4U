"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Download,
  Layers3,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import StudioCanvas from "./studio-canvas";
import {
  canPlace,
  createPlan,
  decodePlan,
  groundSpacing,
  makeSurfaces,
  refill,
  rect,
  type Settings,
  type StudioPlan,
  type Surface,
} from "../lib/studio";
import { validateRegion, type Point } from "../lib/placement.mjs";
import { objectInput, useAgentTools } from "./webmcp";
const KEY = "solar4u-studio-v1";
function NumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void | boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    const t = setTimeout(() => setDraft(String(value)), 0);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <label className="s4-number-field">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft !== "" && Number.isFinite(n) && n >= min && n <= max) {
            if (n !== value && onChange(n) === false) setDraft(String(value));
          } else setDraft(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
function SurfacePlan({
  surface,
  plan,
  selected,
  onSelect,
  onBoundary,
}: {
  surface: Surface;
  plan: StudioPlan;
  selected: string;
  onSelect: (id: string) => void;
  onBoundary: (points: Point[]) => void;
}) {
  const [drawing, setDrawing] = useState(false),
    [draft, setDraft] = useState<Point[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const xs = surface.outer.map((p) => p[0]),
    ys = surface.outer.map((p) => p[1]);
  const minX = Math.min(...xs),
    minY = Math.min(...ys),
    w = Math.max(...xs) - minX,
    d = Math.max(...ys) - minY;
  const path = [surface.outer, ...surface.holes]
    .map((r) => "M" + r.map((p) => p.join(",")).join("L") + "Z")
    .join(" ");
  return (
    <div className="s4-plan-frame">
      <div className="s4-plan-tools">
        <button
          onClick={() => {
            setDrawing(!drawing);
            setDraft([]);
          }}
        >
          {drawing ? "Cancel drawing" : "Draw boundary"}
        </button>
        {drawing && (
          <button
            disabled={draft.length < 3}
            onClick={() => {
              onBoundary(draft);
              setDrawing(false);
              setDraft([]);
            }}
          >
            Finish boundary ({draft.length} points)
          </button>
        )}
        <span>
          {drawing
            ? "Click vertices in order. Finish to apply."
            : "Roof coordinates follow the slope. Ground coordinates follow the level site."}
        </span>
      </div>
      <svg
        ref={svg}
        viewBox={`${minX - 1} ${minY - 1} ${w + 2} ${d + 2}`}
        aria-label={`${surface.label} measured surface layout`}
        onClick={(e) => {
          if (!drawing || !svg.current) return;
          const p = svg.current.createSVGPoint();
          p.x = e.clientX;
          p.y = e.clientY;
          const matrix = svg.current.getScreenCTM();
          if (!matrix) return;
          const q = p.matrixTransform(matrix.inverse());
          setDraft((v) => [
            ...v,
            [Math.round(q.x * 100) / 100, Math.round(q.y * 100) / 100],
          ]);
        }}
        style={{ cursor: drawing ? "crosshair" : "default" }}
      >
        <defs>
          <pattern
            id="metre-grid"
            width="1"
            height="1"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 1 0 L 0 0 0 1"
              fill="none"
              stroke="#9caa8b"
              strokeWidth=".012"
            />
          </pattern>
          <pattern
            id="panel-grid"
            width=".18"
            height=".18"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M .18 0 L 0 0 0 .18"
              fill="none"
              stroke="#92a8ae"
              strokeWidth=".005"
            />
          </pattern>
        </defs>
        <path
          d={path}
          fill="#dbe5cb"
          fillRule="evenodd"
          stroke="#7f9270"
          strokeWidth=".035"
        />
        <path d={path} fill="url(#metre-grid)" fillRule="evenodd" />
        {surface.holes.map((r, i) => (
          <polygon
            key={i}
            points={r.map((p) => p.join(",")).join(" ")}
            fill="#ddcdae"
            stroke="#ac8759"
            strokeDasharray=".1 .07"
            strokeWidth=".035"
          />
        ))}
        {plan.panels
          .filter((p) => p.surfaceId === surface.id)
          .map((p, i) => (
            <g
              key={p.id}
              role="button"
              tabIndex={drawing ? -1 : 0}
              aria-label={`Panel ${i + 1}, ${p.watts} watts, ${p.orientation}`}
              onClick={(e) => {
                if (!drawing) {
                  e.stopPropagation();
                  onSelect(p.id);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(p.id);
                }
              }}
            >
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.depth}
                fill={selected === p.id ? "#c7b05f" : "#304955"}
                stroke={selected === p.id ? "#9d7b21" : "#798c8b"}
                strokeWidth=".025"
              />
              <rect
                x={p.x + 0.02}
                y={p.y + 0.02}
                width={p.width - 0.04}
                height={p.depth - 0.04}
                fill="url(#panel-grid)"
                pointerEvents="none"
              />
            </g>
          ))}
        {draft.length > 0 && (
          <>
            <polyline
              points={draft.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke="#a87414"
              strokeWidth=".06"
            />
            {draft.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r=".09" fill="#a87414" />
            ))}
          </>
        )}
        <text
          x={minX + w / 2}
          y={minY - 0.4}
          textAnchor="middle"
          fill="#566d47"
          fontSize=".22"
        >
          {w.toFixed(2)} m
        </text>
        <text x={minX + 0.12} y={minY + d + 0.6} fill="#566d47" fontSize=".2">
          1 square = 1 m × 1 m ·{" "}
          {surface.kind === "roof"
            ? "slope dimensions"
            : "level-ground dimensions"}
        </text>
      </svg>
      <div className="s4-canvas-note">
        Select a panel to move or remove it. Exclusions are shown in sand.
      </div>
    </div>
  );
}
export default function DesignStudio() {
  const [plan, setPlan] = useState<StudioPlan>(() => createPlan()),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState("Loading device workspace…"),
    [recoveryRaw, setRecoveryRaw] = useState<string | null>(null),
    [error, setError] = useState(""),
    [past, setPast] = useState<StudioPlan[]>([]),
    [future, setFuture] = useState<StudioPlan[]>([]),
    [view, setView] = useState<"3d" | "plan">("3d"),
    [surfaceId, setSurfaceId] = useState("roof-front"),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState("property"),
    [boundaryText, setBoundaryText] = useState(""),
    [exclusion, setExclusion] = useState({ x: 2, y: 1, width: 1, depth: 1 }),
    [estimate, setEstimate] = useState<{
      annualKwh: number;
      monthlyKwh: number[];
      provider: string;
      warnings?: string[];
      signature: string;
    } | null>(null),
    [estimating, setEstimating] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { latitude: lat, longitude: lon } = plan.location;
  const surface =
      plan.surfaces.find((s) => s.id === surfaceId) ?? plan.surfaces[0],
    panel = plan.panels.find((p) => p.id === selected),
    capacity = plan.panels.reduce((sum, p) => sum + p.watts, 0) / 1000;
  const estimateSignature = JSON.stringify([
    plan.panels.map((p) => [p.surfaceId, p.watts]),
    plan.surfaces.map((s) => [s.id, s.tilt, s.azimuth]),
    lat,
    lon,
  ]);
  const latestEstimate =
    estimate?.signature === estimateSignature ? estimate : null;
  const estimateRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(KEY);
        if (raw) setPlan(decodePlan(raw));
        setSaved(
          raw
            ? "Restored from this device"
            : "Illustrative starter plan · not yet saved",
        );
      } catch (e) {
        setRecoveryRaw(raw ?? "");
        setSaved("Autosave paused · existing data preserved");
        setError(
          e instanceof Error
            ? `Saved plan could not be restored: ${e.message}`
            : "Storage unavailable",
        );
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => () => estimateRequest.current?.abort(), []);
  function persist(next: StudioPlan) {
    if (!ready || recoveryRaw !== null) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setSaved(
        `Autosaved on this device · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      );
    } catch {
      setSaved("Device save failed. Export a backup to keep your work.");
    }
  }
  function replace(next: StudioPlan) {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    setPlan(updated);
    persist(updated);
  }
  function commit(next: StudioPlan) {
    if (!ready) throw new Error("The device workspace is still loading");
    setError("");
    setPast((p) => [...p, plan].slice(-20));
    setFuture([]);
    replace(next);
    setSelected("");
  }
  function configure(changes: Partial<Settings>) {
    const s = { ...plan.settings, ...changes },
      previousDefaults = makeSurfaces(plan.settings),
      surfaces = makeSurfaces(s).map((next) => {
        const prior = plan.surfaces.find((p) => p.id === next.id);
        if (!prior) return next;
        const wasCustom =
          JSON.stringify(prior.outer) !==
          JSON.stringify(
            previousDefaults.find((p) => p.id === prior.id)?.outer,
          );
        const result = {
          ...next,
          outer: wasCustom ? prior.outer : next.outer,
          holes: prior.holes,
          enabled: prior.enabled,
        };
        validateRegion(result);
        if (
          result.outer.some(
            ([x, y]) =>
              x < 0 ||
              y < 0 ||
              x > Math.max(...next.outer.map((p) => p[0])) ||
              y > Math.max(...next.outer.map((p) => p[1])),
          )
        )
          throw new Error(
            "The new dimensions would cut through your custom boundary. Resize the boundary first.",
          );
        return result;
      });
    const next = { ...plan, settings: s, surfaces };
    commit(refill(next));
  }
  function safeConfigure(changes: Partial<Settings>) {
    try {
      configure(changes);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid setting");
      return false;
    }
  }
  function updateRegion(region: Partial<Surface>) {
    try {
      const next = { ...surface, ...region };
      validateRegion(next);
      const extent = makeSurfaces(plan.settings).find(
        (s) => s.id === surface.id,
      )!;
      if (
        next.outer.some(
          ([x, y]) =>
            x < 0 ||
            y < 0 ||
            x > Math.max(...extent.outer.map((p) => p[0])) ||
            y > Math.max(...extent.outer.map((p) => p[1])),
        )
      )
        throw new Error(
          "Boundary points must stay within this measured surface. Increase property dimensions first.",
        );
      const updated = {
        ...plan,
        surfaces: plan.surfaces.map((s) => (s.id === surface.id ? next : s)),
      };
      commit(refill(updated, surface.id));
      setBoundaryText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid boundary");
    }
  }
  function addExclusion() {
    const r = rect(exclusion.width, exclusion.depth).map(([x, y]): Point => [
      x + exclusion.x,
      y + exclusion.y,
    ]);
    updateRegion({ holes: [...surface.holes, r] });
  }
  function pick(id: string) {
    setSelected(id);
    const p = plan.panels.find((p) => p.id === id);
    if (p) setSurfaceId(p.surfaceId);
  }
  function move(dx: number, dy: number) {
    if (!panel) return;
    const next = { ...panel, x: panel.x + dx, y: panel.y + dy };
    if (!canPlace(plan, next)) {
      setError(
        "That move would cross a boundary, exclusion, panel, or required spacing.",
      );
      return;
    }
    commit({
      ...plan,
      panels: plan.panels.map((p) => (p.id === panel.id ? next : p)),
    });
    setSelected(panel.id);
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [plan, ...f]);
    replace(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setSelected("");
    setError("");
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, plan]);
    replace(future[0]);
    setFuture((f) => f.slice(1));
    setSelected("");
    setError("");
  }
  function downloadJson(raw: string, name: string) {
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportPlan() {
    downloadJson(JSON.stringify(plan, null, 2), "solar4u-plan.json");
  }
  function saveRecoveredPlan() {
    try {
      if (recoveryRaw !== null)
        localStorage.setItem(`${KEY}.recovery.${Date.now()}`, recoveryRaw);
      localStorage.setItem(KEY, JSON.stringify(plan));
      setRecoveryRaw(null);
      setSaved("Saved on this device · original data backed up");
      setError("");
    } catch {
      setError(
        "Save failed. Download the original data and export your current plan.",
      );
    }
  }
  async function importFile(f: File) {
    try {
      if (f.size > 2_000_000)
        throw new Error("Choose a plan smaller than 2 MB");
      commit(decodePlan(await f.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import plan");
    }
  }
  async function production() {
    estimateRequest.current?.abort();
    const c = new AbortController();
    estimateRequest.current = c;
    setEstimating(true);
    setError("");
    try {
      const arrays = plan.surfaces
        .filter((s) => s.enabled)
        .map((s) => ({
          capacityKw:
            plan.panels
              .filter((p) => p.surfaceId === s.id)
              .reduce((n, p) => n + p.watts, 0) / 1000,
          tilt: s.tilt,
          azimuth: s.azimuth,
        }))
        .filter((a) => a.capacityKw > 0);
      if (!arrays.length)
        throw new Error("Place panels before estimating production");
      const r = await fetch("/api/engine/v1/solar/estimates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "pvgis",
          latitude: lat,
          longitude: lon,
          lossesPercent: 14,
          arrays,
        }),
        signal: c.signal,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setEstimate({ ...data.data, signature: estimateSignature });
    } catch (e) {
      if (!c.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Could not estimate production",
        );
    } finally {
      if (!c.signal.aborted) setEstimating(false);
    }
  }
  useAgentTools([
    {
      name: "solar4u_read_design",
      description:
        "Read the current device-local measured solar plan, actual panel placements, settings and exclusions. Geometry is in metres; this does not imply a remotely measured building.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: (i) => {
        objectInput(i);
        return {
          ...plan,
          capacityKw: capacity,
          selectedPanel: selected,
          storage: saved,
        };
      },
    },
    {
      name: "solar4u_configure_design",
      description:
        "Change measured property/module parameters and recalculate panel placements. This changes the visible plan and device autosave; Undo restores the prior plan.",
      inputSchema: {
        type: "object",
        properties: {
          width: { type: "number", minimum: 3, maximum: 40 },
          depth: { type: "number", minimum: 3, maximum: 40 },
          pitch: { type: "number", minimum: 0, maximum: 60 },
          azimuth: { type: "number", minimum: 0, maximum: 360 },
          groundWidth: { type: "number", minimum: 3, maximum: 50 },
          groundDepth: { type: "number", minimum: 3, maximum: 50 },
          groundTilt: { type: "number", minimum: 0, maximum: 60 },
          setback: { type: "number", minimum: 0, maximum: 5 },
          orientation: {
            type: "string",
            enum: ["best", "portrait", "landscape"],
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (i) => {
        const values = objectInput(i),
          allowed = [
            "width",
            "depth",
            "pitch",
            "azimuth",
            "groundWidth",
            "groundDepth",
            "groundTilt",
            "setback",
            "orientation",
          ];
        if (Object.keys(values).some((k) => !allowed.includes(k)))
          throw new Error("Unsupported design setting");
        flushSync(() => configure(values));
        return { status: "design_recalculated", settings: values };
      },
    },
    {
      name: "solar4u_auto_place_panels",
      description:
        "Recalculate roof and ground panel layouts inside measured boundaries and exclusions. Uses a bounded grid comparison, not a guarantee of the mathematically optimal layout. Replaces manual panel edits; Undo is available.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (i) => {
        objectInput(i);
        const next = refill(plan);
        flushSync(() => commit(next));
        return {
          panelCount: next.panels.length,
          capacityKw: next.panels.reduce((s, p) => s + p.watts, 0) / 1000,
        };
      },
    },
    {
      name: "solar4u_remove_panel",
      description:
        "Remove one known panel from this device-local design. Updates 3D and surface views and the capacity total; Undo restores it.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (i) => {
        const { id } = objectInput(i);
        if (typeof id !== "string" || !plan.panels.some((p) => p.id === id))
          throw new Error("Unknown panel");
        const next = {
          ...plan,
          panels: plan.panels.filter((p) => p.id !== id),
        };
        flushSync(() => commit(next));
        return { removed: id, panelCount: next.panels.length };
      },
    },
  ]);
  const number = (
    key: keyof Settings,
    label: string,
    min: number,
    max: number,
    step = 0.1,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={plan.settings[key] as number}
      min={min}
      max={max}
      step={step}
      onChange={(n) => safeConfigure({ [key]: n })}
    />
  );
  return (
    <main className="s4-studio">
      <div className="s4-studio-title">
        <div>
          <div className="s4-kicker">
            <Layers3 size={14} /> THE SOLAR DESIGN STUDIO
          </div>
          <input
            aria-label="Project name"
            value={plan.name}
            maxLength={100}
            disabled={!ready}
            onChange={(e) => replace({ ...plan, name: e.target.value })}
          />
          <p role="status">{saved}</p>
        </div>
        <div className="s4-studio-actions">
          <button
            title="Undo"
            aria-label="Undo design change"
            onClick={undo}
            disabled={!past.length}
          >
            <Undo2 size={17} />
          </button>
          <button
            title="Redo"
            aria-label="Redo design change"
            onClick={redo}
            disabled={!future.length}
          >
            <Redo2 size={17} />
          </button>
          <button
            disabled={!ready || recoveryRaw !== null}
            onClick={() => persist(plan)}
          >
            <Save size={15} />
            Save
          </button>
          <button onClick={exportPlan}>
            <Download size={15} />
            Export
          </button>
          <button onClick={() => file.current?.click()}>
            <Upload size={15} />
            Import
          </button>
          <input
            hidden
            ref={file}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {recoveryRaw !== null && (
        <div className="s4-studio-disclosure" role="status">
          Your previous data is preserved. Autosave is paused while you review
          this workspace.
          <button
            onClick={() =>
              downloadJson(recoveryRaw, "solar4u-original-data.json")
            }
          >
            Download original data
          </button>
          <button onClick={saveRecoveredPlan}>
            Back up original & save this plan
          </button>
        </div>
      )}
      <div className="s4-studio-disclosure">
        <Link href="/roof-analysis">Explore your actual roof with aerial 3D data ↗</Link><br/>
        A home model from your dimensions. The starter dimensions are
        illustrative—confirm your property measurements, clearances, and
        obstacles before relying on a layout.
      </div>
      {error && (
        <div role="alert" className="s4-studio-error">
          {error}
          <button aria-label="Dismiss message" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      <div className="s4-studio-layout">
        <aside className="s4-studio-controls">
          <div className="s4-control-tabs">
            {["property", "panels", "exclusions"].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="s4-active-surface">
            Active surface
            <select
              value={surface.id}
              onChange={(e) => {
                setSurfaceId(e.target.value);
                setSelected("");
                setBoundaryText("");
              }}
            >
              {plan.surfaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="s4-surface-enabled">
            <input
              type="checkbox"
              checked={surface.enabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                commit(
                  refill(
                    {
                      ...plan,
                      surfaces: plan.surfaces.map((s) =>
                        s.id === surface.id ? { ...s, enabled } : s,
                      ),
                    },
                    surface.id,
                  ),
                );
              }}
            />{" "}
            Include {surface.label.toLowerCase()} in layout
          </label>
          {tab === "property" ? (
            <>
              <div className="s4-controls-heading">
                <h2>Make the house yours.</h2>
                <p>
                  Dimensions in metres. Editing geometry recalculates the panel
                  layout.
                </p>
              </div>
              <label className="s4-select-field">
                Roof shape
                <select
                  value={plan.settings.roof}
                  onChange={(e) =>
                    safeConfigure({ roof: e.target.value as Settings["roof"] })
                  }
                >
                  <option value="gable">Gable · two slopes</option>
                  <option value="mono">Single slope</option>
                  <option value="flat">Flat roof</option>
                </select>
              </label>
              <div className="s4-control-grid">
                {number("width", "House width (m)", 3, 40)}
                {number("depth", "House depth (m)", 3, 40)}
                {number("eaves", "Eaves height (m)", 1, 12)}
                {number("pitch", "Roof pitch (°)", 0, 60, 1)}
                {number("azimuth", "Main roof azimuth (°)", 0, 360, 1)}
              </div>
              <p className="s4-fine">
                Azimuth: 0° north · 90° east · 180° south · 270° west. Flat-roof
                modules are flush in this model.
              </p>
              <div className="s4-controls-heading">
                <h2>Room on the ground.</h2>
                <p>A separate, level mounting zone beside the house.</p>
              </div>
              <div className="s4-control-grid">
                {number("groundWidth", "Ground width (m)", 3, 50)}
                {number("groundDepth", "Ground depth (m)", 3, 50)}
                {number("groundTilt", "Array tilt (°)", 0, 60, 1)}
                {number("groundAzimuth", "Array azimuth (°)", 0, 360, 1)}
                {number("sunAltitude", "Design sun altitude (°)", 5, 80, 1)}
                {number("serviceGap", "Minimum clear gap (m)", 0, 10)}
              </div>
              <p className="s4-fine">
                Ground spacing uses the larger of the service gap and rise ÷
                tan(design sun altitude). Assumes level ground and sunlight
                perpendicular to rows.
              </p>
            </>
          ) : tab === "panels" ? (
            <>
              <div className="s4-controls-heading">
                <h2>One module. Every view.</h2>
                <p>Enter dimensions from the exact product datasheet.</p>
              </div>
              <div className="s4-control-grid">
                {number("moduleWidth", "Module width (m)", 0.4, 2.5, 0.001)}
                {number("moduleLength", "Module length (m)", 0.5, 3.5, 0.001)}
                {number("moduleWatts", "Rated power (W)", 1, 1000, 1)}
                {number("gap", "Module gap (m)", 0, 0.5, 0.005)}
                {number("setback", "Boundary setback (m)", 0, 5, 0.05)}
                {number("clearance", "Exclusion clearance (m)", 0, 5, 0.05)}
              </div>
              <label className="s4-select-field">
                Module orientation
                <select
                  value={plan.settings.orientation}
                  onChange={(e) =>
                    safeConfigure({
                      orientation: e.target.value as Settings["orientation"],
                    })
                  }
                >
                  <option value="best">Compare portrait & landscape</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <div className="s4-banner">
                Setbacks are planning inputs, not code defaults. The layout
                checks full panel edges against boundaries and exclusions.
              </div>
              <h3>Selected panel</h3>
              {panel ? (
                <div className="s4-selected-panel">
                  <p>{panel.id}</p>
                  <strong>
                    {panel.watts} W · {panel.orientation}
                  </strong>
                  <small>
                    {panel.x.toFixed(2)}, {panel.y.toFixed(2)} m ·{" "}
                    {panel.width.toFixed(3)} × {panel.depth.toFixed(3)} m
                    footprint
                  </small>
                  <div className="s4-nudge">
                    <button
                      aria-label="Move panel up 10 cm"
                      onClick={() => move(0, -0.1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      aria-label="Move panel left 10 cm"
                      onClick={() => move(-0.1, 0)}
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <button
                      aria-label="Move panel right 10 cm"
                      onClick={() => move(0.1, 0)}
                    >
                      <ArrowRight size={16} />
                    </button>
                    <button
                      aria-label="Move panel down 10 cm"
                      onClick={() => move(0, 0.1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button
                    className="s4-button s4-light"
                    onClick={() =>
                      commit({
                        ...plan,
                        panels: plan.panels.filter((p) => p.id !== selected),
                      })
                    }
                  >
                    <Trash2 size={14} />
                    Remove panel
                  </button>
                </div>
              ) : (
                <p className="s4-fine">
                  Choose a panel in either view to edit its placement.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="s4-controls-heading">
                <h2>Leave the right space.</h2>
                <p>
                  Add measured exclusion areas for skylights, access routes, or
                  obstructions.
                </p>
              </div>
              <div className="s4-control-grid">
                {(["x", "y", "width", "depth"] as const).map((k) => (
                  <NumberField
                    key={k}
                    label={`${k === "width" ? "Width" : k === "depth" ? "Depth" : k.toUpperCase()} (m)`}
                    value={exclusion[k]}
                    min={k === "x" || k === "y" ? 0 : 0.1}
                    max={100}
                    onChange={(n) => setExclusion({ ...exclusion, [k]: n })}
                  />
                ))}
              </div>
              <button className="s4-button s4-light" onClick={addExclusion}>
                Add exclusion
              </button>
              <div className="s4-exclusion-list">
                {surface.holes.map((_, i) => (
                  <div key={i}>
                    <span>Exclusion {i + 1}</span>
                    <button
                      aria-label={`Remove exclusion ${i + 1}`}
                      onClick={() =>
                        updateRegion({
                          holes: surface.holes.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <details>
                <summary>Measured boundary coordinates</summary>
                <p className="s4-fine">
                  Enter a simple polygon as [[x,y],…] in metres on this surface,
                  or draw it in Surface plan. Exclusions must stay fully inside.
                </p>
                <textarea
                  aria-label="Boundary metre coordinates"
                  rows={6}
                  value={boundaryText || JSON.stringify(surface.outer)}
                  onChange={(e) => setBoundaryText(e.target.value)}
                />
                <button
                  className="s4-button s4-light"
                  onClick={() => {
                    try {
                      updateRegion({
                        outer: JSON.parse(
                          boundaryText || JSON.stringify(surface.outer),
                        ),
                      });
                    } catch {
                      setError(
                        "Enter a valid JSON array of metre coordinate pairs",
                      );
                    }
                  }}
                >
                  Apply measured boundary
                </button>
              </details>
              <button
                className="s4-text-link"
                onClick={() => {
                  const original = makeSurfaces(plan.settings).find(
                    (s) => s.id === surface.id,
                  );
                  if (original)
                    updateRegion({ outer: original.outer, holes: [] });
                }}
              >
                Reset this surface boundary <RotateCcw size={13} />
              </button>
            </>
          )}
        </aside>
        <section className="s4-studio-work">
          <div className="s4-stage-toolbar">
            <div>
              <button
                aria-pressed={view === "3d"}
                onClick={() => setView("3d")}
              >
                <Box size={15} />
                3D property
              </button>
              <button
                aria-pressed={view === "plan"}
                onClick={() => setView("plan")}
              >
                <Layers3 size={15} />
                Surface plan
              </button>
            </div>
            <button
              className="s4-auto-place"
              onClick={() => {
                try {
                  commit(refill(plan));
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Placement failed");
                }
              }}
            >
              <Sparkles size={15} />
              Auto-place panels
            </button>
          </div>
          {view === "3d" ? (
            <StudioCanvas
              plan={plan}
              selected={selected}
              onSelect={(id) => {
                pick(id);
                setTab("panels");
              }}
            />
          ) : (
            <SurfacePlan
              key={surface.id}
              surface={surface}
              plan={plan}
              selected={selected}
              onSelect={(id) => {
                pick(id);
                setTab("panels");
              }}
              onBoundary={(outer) => updateRegion({ outer })}
            />
          )}
          <div className="s4-studio-totals">
            <div>
              <span>Actual placements</span>
              <b>
                {plan.panels.length}
                <small> panels</small>
              </b>
            </div>
            <div>
              <span>DC nameplate</span>
              <b>
                {capacity.toFixed(2)}
                <small> kW</small>
              </b>
            </div>
            <div>
              <span>{surface.label}</span>
              <b>
                {plan.panels.filter((p) => p.surfaceId === surface.id).length}
                <small> panels</small>
              </b>
            </div>
            <div>
              <span>Ground clear gap</span>
              <b>
                {groundSpacing(
                  plan.panels.find((p) => p.surfaceId === "ground")
                    ?.slopeLength ?? plan.settings.moduleLength,
                  plan.settings.groundTilt,
                  plan.settings.sunAltitude,
                  plan.settings.serviceGap,
                ).gap.toFixed(2)}
                <small> m</small>
              </b>
            </div>
          </div>
          <div className="s4-design-summary">
            <div>
              <h2>What this plan knows.</h2>
              <p>
                Module dimensions, surface geometry, clearances, exclusion
                zones, and the exact panels visible above. Portrait and
                landscape grids are compared for fit, up to 400 panels per
                surface.
              </p>
            </div>
            <div>
              <h2>What needs a site check.</h2>
              <p>
                Structure, foundations, roof condition, fire access, drainage,
                property limits, surrounding shade, electrical compatibility,
                and local approvals.
              </p>
              <Link href="/guides#site-survey">
                Read the site survey guide <ArrowRight size={13} />
              </Link>
            </div>
          </div>
          <section className="s4-production">
            <div className="s4-title-row">
              <div>
                <div className="s4-kicker">FROM PLACEMENT TO PRODUCTION</div>
                <h2>Put the sunlight in context.</h2>
              </div>
              <button
                className="s4-button s4-dark"
                disabled={estimating || capacity === 0}
                onClick={production}
              >
                {estimating ? "Reading climate data…" : "Estimate production"}
                <ArrowRight size={15} />
              </button>
            </div>
            <p className="s4-fine">
              Enter your location. This request sends coordinates and array
              parameters to EU JRC PVGIS; provider outages fall back to a
              labeled seasonal model. Nearby shade is not modeled.
            </p>
            <div className="s4-control-grid">
              <NumberField
                label="Latitude (°)"
                value={lat}
                min={-66}
                max={66}
                step={0.0001}
                onChange={(latitude) =>
                  commit({ ...plan, location: { ...plan.location, latitude } })
                }
              />
              <NumberField
                label="Longitude (°)"
                value={lon}
                min={-180}
                max={180}
                step={0.0001}
                onChange={(longitude) =>
                  commit({ ...plan, location: { ...plan.location, longitude } })
                }
              />
            </div>
            {latestEstimate ? (
              <div className="s4-energy-result">
                <strong>
                  {Math.round(latestEstimate.annualKwh).toLocaleString()}{" "}
                  <small>kWh / year</small>
                </strong>
                <p>{latestEstimate.provider} · 14% modeled losses</p>
                <div
                  className="s4-month-bars"
                  aria-label="Monthly modeled solar production"
                >
                  {latestEstimate.monthlyKwh.map((v, i) => (
                    <div key={i}>
                      <span
                        style={{
                          height:
                            Math.max(
                              0,
                              (v / Math.max(1, ...latestEstimate.monthlyKwh)) *
                                100,
                            ) + "%",
                        }}
                        title={`${v} kWh`}
                      />
                      <small>
                        {
                          [
                            "J",
                            "F",
                            "M",
                            "A",
                            "M",
                            "J",
                            "J",
                            "A",
                            "S",
                            "O",
                            "N",
                            "D",
                          ][i]
                        }
                      </small>
                      <b>{Math.round(v)}</b>
                    </div>
                  ))}
                </div>
                {latestEstimate.warnings?.map((w) => (
                  <p className="s4-fine" key={w}>
                    {w}
                  </p>
                ))}
              </div>
            ) : (
              <p className="s4-fine">
                {estimate
                  ? "The design or location changed. Recalculate to see a matching estimate."
                  : "A result will appear after you request an estimate."}
              </p>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
