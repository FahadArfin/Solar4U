"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MapPin, ArrowLeft, Mountain, LocateFixed } from "lucide-react";
import {
  roofRadius,
  type RoofBuilding,
  type RoofMesh,
} from "../lib/roof-types";
import { objectInput, useAgentTools } from "./webmcp";
import type { createAerialScene } from "./aerial-scene";
type Match = {
  label: string;
  latitude: number;
  longitude: number;
  precision: string;
  partial: boolean;
};
type Loaded = { mesh: RoofMesh; texture?: ImageBitmap };
function AerialCanvas({
  building,
  loaded,
  count,
  selected,
  onPick,
}: {
  building: RoofBuilding;
  loaded: Loaded;
  count: number;
  selected: number;
  onPick: (n: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<ReturnType<typeof createAerialScene> | null>(null),
    latest = useRef({ count, selected, onPick, imagery: true });
  const [error, setError] = useState(""),
    [imagery, setImagery] = useState(true);
  useEffect(() => {
    latest.current = { count, selected, onPick, imagery };
    scene.current?.update(count, selected, imagery);
  }, [count, selected, onPick, imagery]);
  useEffect(() => {
    let cancelled = false;
    import("./aerial-scene")
      .then(({ createAerialScene }) => {
        if (cancelled || !canvas.current) return;
        try {
          setError("");
          scene.current = createAerialScene(
            canvas.current,
            building,
            loaded.mesh,
            loaded.texture,
            (i) => latest.current.onPick(i),
          );
          scene.current.update(
            latest.current.count,
            latest.current.selected,
            latest.current.imagery,
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "3D graphics unavailable");
        }
      })
      .catch(() =>
        setError("3D resources could not load. Reload to try again."),
      );
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [building, loaded]);
  return (
    <div className="s4-aerial-canvas">
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label="Measured aerial roof in 3D. Drag to orbit and select a proposed panel. Panel details are also available below."
      />
      {error && (
        <div role="alert" className="s4-canvas-loading">
          {error}
        </div>
      )}
      <div className="s4-canvas-toolbar">
        <button onClick={() => scene.current?.reset()}>Orbit view</button>
        <button onClick={() => scene.current?.top()}>Top view</button>
        <button aria-pressed={imagery} onClick={() => setImagery((v) => !v)}>
          {imagery ? "Show roof relief" : "Show aerial colour"}
        </button>
      </div>
      <div className="s4-google-credit">
        <strong>Google Maps</strong>
        <span>Source: Includes solar data from Google</span>
        <span>Includes data from Google Maps</span>
      </div>
    </div>
  );
}
export default function AerialRoof() {
  const [query, setQuery] = useState(""),
    [matches, setMatches] = useState<Match[]>([]),
    [latitude, setLatitude] = useState(""),
    [longitude, setLongitude] = useState(""),
    [building, setBuilding] = useState<RoofBuilding | null>(null),
    [loaded, setLoaded] = useState<Loaded | null>(null),
    [count, setCount] = useState(0),
    [selected, setSelected] = useState(-1),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [matchLabel, setMatchLabel] = useState("Exact coordinates"),
    [precision, setPrecision] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const request = useRef<AbortController | null>(null),
    worker = useRef<Worker | null>(null),
    loadedRef = useRef<Loaded | null>(null),
    generation = useRef(0);
  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);
  useEffect(() => {
    if (!building) return;
    const t = setInterval(() => {
      if (Date.now() > Date.parse(building.expiresAt)) {
        request.current?.abort();
        worker.current?.terminate();
        generation.current++;
        loadedRef.current?.texture?.close();
        setLoaded(null);
        setBuilding(null);
        setBusy("");
        setError(
          "The provider data has expired. Look up the property again for fresh coverage.",
        );
      }
    }, 60000);
    return () => clearInterval(t);
  }, [building]);
  useEffect(
    () => () => {
      request.current?.abort();
      worker.current?.terminate();
      loadedRef.current?.texture?.close();
    },
    [],
  );
  async function json(url: string, options?: RequestInit) {
    const r = await fetch(url, options),
      j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Provider request failed");
    return j;
  }
  function begin(label: string) {
    request.current?.abort();
    worker.current?.terminate();
    generation.current++;
    const c = new AbortController();
    request.current = c;
    setBusy(label);
    setError("");
    return c;
  }
  async function search() {
    const c = begin("Finding your address…");
    setMatches([]);
    try {
      const j = await json(
        `/api/roof?op=search&q=${encodeURIComponent(query)}`,
        { signal: c.signal },
      );
      if (c.signal.aborted) return;
      setMatches(j.results);
      if (!j.results.length)
        setError(
          "No address matched. Try a more complete address or enter exact coordinates.",
        );
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "Search unavailable");
    } finally {
      if (!c.signal.aborted) setBusy("");
    }
  }
  async function findRoof(
    lat = Number(latitude),
    lon = Number(longitude),
    label = "Exact coordinates",
    quality = "Coordinates entered by you",
  ) {
    if (
      (latitude.trim() === "" && label === "Exact coordinates") ||
      (longitude.trim() === "" && label === "Exact coordinates")
    ) {
      setError("Enter both coordinates");
      return;
    }
    if (
      !Number.isFinite(lat) ||
      Math.abs(lat) > 66 ||
      !Number.isFinite(lon) ||
      Math.abs(lon) > 180
    ) {
      setError("Enter valid latitude (−66 to 66) and longitude (−180 to 180).");
      return;
    }
    const c = begin("Finding the closest covered roof…");
    setBuilding(null);
    setLoaded(null);
    loadedRef.current?.texture?.close();
    setConfirmed(false);
    setSelected(-1);
    setPrecision(quality);
    setMatchLabel(label);
    setLatitude(String(lat));
    setLongitude(String(lon));
    try {
      const j = await json("/api/roof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
        signal: c.signal,
      });
      if (!c.signal.aborted) {
        setBuilding(j.data);
        setMatches([]);
        setCount(Math.min(j.data.solarPotential.solarPanels.length, 24));
      }
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "Roof lookup failed");
    } finally {
      if (!c.signal.aborted) setBusy("");
    }
  }
  function reconstruct() {
    if (!building || !confirmed) return;
    const radius = roofRadius(building);
    if (radius > 120) {
      setError(
        "This roof is larger than the supported residential view. Use the measured studio for a selected part of the property.",
      );
      return;
    }
    begin("Reading roof elevations and aerial imagery…");
    const g = generation.current,
      base = new URL("/api/roof", window.location.origin);
    base.search = new URLSearchParams({
      op: "layer",
      latitude: String(building.center.latitude),
      longitude: String(building.center.longitude),
      radius: String(radius),
    }).toString();
    const urls = Object.fromEntries(
      ["dsm", "mask", "rgb"].map((layer) => [
        layer,
        `${base.href}&layer=${layer}`,
      ]),
    );
    const w = new Worker(new URL("./roof-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => {
      if (g !== generation.current) {
        e.data.texture?.close();
        return;
      }
      setBusy("");
      if (e.data.error) setError(e.data.error);
      else {
        loadedRef.current?.texture?.close();
        setLoaded(e.data);
      }
      w.terminate();
      worker.current = null;
    };
    w.onerror = () => {
      if (g === generation.current) {
        setBusy("");
        setError(
          "The roof reconstruction worker could not start. Reload and try again.",
        );
      }
      w.terminate();
    };
    w.postMessage({ building, urls });
  }
  useAgentTools([
    {
      name: "solar4u_read_aerial_roof",
      description:
        "Read the explicitly loaded aerial building identity, imagery date, coverage, measured roof status and Google-proposed panel configuration. Coordinates are from the user-selected building.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async () =>
        building
          ? {
              name: building.name,
              center: building.center,
              imageryDate: building.imageryDate,
              imageryQuality: building.imageryQuality,
              roofImageryDate: loaded?.mesh.imageryDate,
              roofImageryQuality: loaded?.mesh.imageryQuality,
              provenance: "Google Solar building insights and DSM",
              reconstructed: !!loaded,
              selectedPanelCount: count,
              capacityKw:
                (count * building.solarPotential.panelCapacityWatts) / 1000,
              meshResolutionMeters: loaded?.mesh.resolutionMeters,
              warnings: loaded?.mesh.warnings,
            }
          : { loaded: false },
    },
    {
      name: "solar4u_set_aerial_panel_count",
      description:
        "Change the visible count of Google-proposed panels for the already loaded building, retaining the provider ordering. Does not modify the measured user-authored studio or save provider imagery.",
      inputSchema: {
        type: "object",
        properties: { count: { type: "integer", minimum: 0, maximum: 3000 } },
        required: ["count"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        const o = objectInput(input);
        if (
          !building ||
          !loaded ||
          !Number.isInteger(o.count) ||
          Number(o.count) < 0 ||
          Number(o.count) > building.solarPotential.solarPanels.length
        )
          throw new Error(
            "Load a roof and choose a count inside its proposed layout",
          );
        setCount(Number(o.count));
        setSelected(-1);
        return { panelCount: o.count };
      },
    },
  ]);
  const potential = building?.solarPotential,
    chosen = potential?.solarPanels.slice(0, count) ?? [],
    energy = chosen.reduce((s, p) => s + p.yearlyEnergyDcKwh, 0),
    panel = potential?.solarPanels[selected],
    distance = building?.distanceMeters ?? 0;
  return (
    <main className="s4-aerial">
      <header className="s4-aerial-head">
        <div>
          <Link href="/planner">
            <ArrowLeft size={15} /> Measured design studio
          </Link>
          <div className="s4-kicker">
            <Mountain size={15} /> AERIAL ROOF EXPLORER
          </div>
          <h1>A closer look at your roof.</h1>
          <p>
            Match a building, reconstruct its measured roof surface, and explore
            the provider’s proposed solar layout.
          </p>
        </div>
        <span className="s4-aerial-tag">Real elevations · 3D roof</span>
      </header>
      <div className="s4-aerial-layout">
        <aside className="s4-aerial-controls">
          <h2>
            <MapPin size={18} /> Find your property
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <label>
              Street address
              <input
                value={query}
                disabled={!!busy}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setMatches([]);
                }}
                placeholder="Street, city, postal code"
                autoComplete="street-address"
                maxLength={200}
              />
            </label>
            <button disabled={!!busy || query.trim().length < 5}>
              Search address
            </button>
          </form>
          <p className="s4-aerial-meta">
            Search sends the address to Google. Building and imagery requests
            send the selected coordinates.
          </p>
          {matches.map((m) => (
            <button
              className="s4-address-match"
              key={`${m.latitude},${m.longitude}`}
              onClick={() =>
                void findRoof(
                  m.latitude,
                  m.longitude,
                  m.label,
                  `${m.precision}${m.partial ? " · partial match" : ""}`,
                )
              }
            >
              {m.label}
              <small>
                {m.precision}
                {m.partial ? " · check partial match" : ""}
              </small>
            </button>
          ))}
          <details>
            <summary>
              <LocateFixed size={15} /> Enter exact coordinates
            </summary>
            <label>
              Latitude
              <input
                type="number"
                value={latitude}
                min={-66}
                max={66}
                step="any"
                disabled={!!busy}
                onChange={(e) => {
                  setLatitude(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                value={longitude}
                min={-180}
                max={180}
                step="any"
                disabled={!!busy}
                onChange={(e) => {
                  setLongitude(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <button disabled={!!busy} onClick={() => void findRoof()}>
              Find roof at coordinates
            </button>
          </details>
          {building && (
            <section className="s4-roof-match">
              <h3>Confirm the matched building</h3>
              <p>{matchLabel}</p>
              <p className="s4-aerial-meta">
                {precision}
                <br />
                Building centre is {Math.round(distance)} m from the searched
                point.
              </p>
              <a
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${building.center.latitude},${building.center.longitude}`}
              >
                Check this location in Google Maps ↗
              </a>
              <dl>
                <dt>Panel imagery</dt>
                <dd>
                  {building.imageryDate.year}-
                  {String(building.imageryDate.month).padStart(2, "0")}-
                  {String(building.imageryDate.day).padStart(2, "0")}
                </dd>
                <dt>Quality</dt>
                <dd>{building.imageryQuality.toLowerCase()}</dd>
                <dt>Proposed panels</dt>
                <dd>{potential!.solarPanels.length}</dd>
              </dl>
              <label className="s4-roof-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                I have checked the matched building location.
              </label>
              <button
                className="s4-aerial-primary"
                disabled={!confirmed || !!busy}
                onClick={reconstruct}
              >
                {loaded ? "Reload measured roof" : "Build the aerial 3D roof"}
              </button>
            </section>
          )}
        </aside>
        <section className="s4-aerial-result">
          {busy && (
            <div className="s4-aerial-progress" role="status">
              {busy}
            </div>
          )}
          {error && (
            <div className="s4-studio-error" role="alert">
              {error}
            </div>
          )}
          {building && loaded ? (
            <>
              <AerialCanvas
                building={building}
                loaded={loaded}
                count={count}
                selected={selected}
                onPick={setSelected}
              />
              <div className="s4-aerial-stats">
                <div>
                  <small>Provider layout</small>
                  <strong>{count} panels</strong>
                </div>
                <div>
                  <small>DC nameplate</small>
                  <strong>
                    {((count * potential!.panelCapacityWatts) / 1000).toFixed(
                      2,
                    )}{" "}
                    kW
                  </strong>
                </div>
                <div>
                  <small>Provider DC energy / year</small>
                  <strong>{Math.round(energy).toLocaleString()} kWh</strong>
                </div>
              </div>
              <label className="s4-aerial-count">
                Explore a system size
                <input
                  type="range"
                  min={0}
                  max={potential!.solarPanels.length}
                  value={count}
                  onChange={(e) => {
                    setCount(Number(e.target.value));
                    setSelected(-1);
                  }}
                />
              </label>
              <p>
                Uses the first {count} panels in Google’s proposed order, with{" "}
                {potential!.panelCapacityWatts} W modules measuring{" "}
                {potential!.panelWidthMeters.toFixed(2)} ×{" "}
                {potential!.panelHeightMeters.toFixed(2)} m. DC energy is a
                provider estimate before inverter conversion.
              </p>
              <details>
                <summary>Inspect an individual panel</summary>
                <label>
                  Proposed panel
                  <select
                    value={selected}
                    onChange={(e) => setSelected(Number(e.target.value))}
                  >
                    <option value={-1}>Choose a panel</option>
                    {chosen.map((_, i) => (
                      <option value={i} key={i}>
                        Panel {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                {panel && selected < count && (
                  <p>
                    Panel {selected + 1} · roof segment {panel.segmentIndex + 1}{" "}
                    · {panel.orientation.toLowerCase()} ·{" "}
                    {Math.round(panel.yearlyEnergyDcKwh)} kWh DC/year
                  </p>
                )}
              </details>
              <p className="s4-aerial-meta">
                Roof imagery:{" "}
                {loaded.mesh.imageryDate
                  ? `${loaded.mesh.imageryDate.year}-${loaded.mesh.imageryDate.month}-${loaded.mesh.imageryDate.day}`
                  : "Date unavailable"}{" "}
                ·{" "}
                {loaded.mesh.imageryQuality?.toLowerCase() ??
                  "quality unavailable"}
                . Roof mesh spacing: approximately{" "}
                {loaded.mesh.resolutionMeters.toFixed(2)} m. Imagery can predate
                alterations, trees or new obstacles. Check the real property
                before making an installation decision.
              </p>
              {loaded.mesh.warnings.map((w) => (
                <p className="s4-aerial-meta" key={w}>
                  {w}
                </p>
              ))}
            </>
          ) : (
            <div className="s4-aerial-empty">
              <Mountain size={44} />
              <h2>Your roof, from another angle.</h2>
              <p>
                Search your address or enter measured coordinates to find
                available aerial coverage. The measured studio remains available
                for every property.
              </p>
              <ul>
                <li>Georeferenced roof elevation and colour imagery</li>
                <li>Dimensioned provider panel positions</li>
                <li>Orbit, inspect and compare system sizes</li>
              </ul>
              <Link href="/planner">Build from your own measurements ↗</Link>
            </div>
          )}
          <div className="s4-aerial-notes">
            <h3>Keep the source clear.</h3>
            <p>
              The aerial view uses Google Solar data for feasibility planning.
              It does not infer walls or ground heights, certify setbacks, or
              turn panel envelopes into surveyed roof boundaries. Use the
              measured studio to edit reviewed boundaries and design ground
              mounts.
            </p>
            <p>
              Provider imagery stays in this open session and is not included in
              portable plan exports. Reload it when returning. User-authored
              measurements and layouts have their own device save.
            </p>
            <a
              href="https://developers.google.com/maps/documentation/solar/overview"
              target="_blank"
              rel="noreferrer"
            >
              About Google Solar data ↗
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
