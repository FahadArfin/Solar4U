"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Calculator,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import {
  calculators,
  moduleDefaults,
  moduleFields,
  pvArrayFields,
  validateValues,
  type CalculatorId,
  type Values,
  type CalcField,
} from "../lib/calculator-config";
import {
  localEstimate,
  withProduction,
} from "../services/solar-engine/model.mjs";
import {
  batteryRuntime,
  voltageDrop,
  fuseBreaker,
  arrayVoltage,
  cableSizing,
  touBattery,
  payback,
} from "../services/solar-engine/calculators.mjs";
import { controllerShortlist } from "../services/solar-engine/controller-catalog.mjs";
import { objectInput, useAgentTools } from "./webmcp";
type Stat = { label: string; value: string; unit?: string; warn?: boolean };
type PvResult = {
  provider: string;
  annualKwh: number;
  monthlyKwh: number[];
  yearlyBillValue: number;
  energyOffsetPercent: number | null;
  warnings?: string[];
};
type Report = {
  stats: Stat[];
  raw: Record<string, unknown>;
  notice?: string;
  warn?: boolean;
  monthly?: number[];
  cash?: number[];
  controller?: ReturnType<typeof controllerShortlist>[];
  error?: string;
};
const fmt = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString(undefined, { maximumFractionDigits: d });
const stat = (
  label: string,
  value: number | null | undefined,
  unit = "",
  warn = false,
): Stat => ({ label, value: fmt(value), unit, warn });
function NumberInput({
  field,
  value,
  onChange,
}: {
  field: CalcField;
  value: number;
  onChange: (n: number) => void;
}) {
  const [entry, setEntry] = useState({ value, draft: String(value) }),
    [error, setError] = useState("");
  const draft = entry.value === value ? entry.draft : String(value);
  const valid = (n: number) =>
    Number.isFinite(n) &&
    n >= field.min &&
    n <= field.max &&
    (field.step !== 1 || Number.isInteger(n));
  function commit(raw: string, blur = false) {
    const n = Number(raw);
    if (raw.trim() !== "" && valid(n)) {
      setEntry({ value: n, draft: raw });
      setError("");
      if (n !== value) onChange(n);
    } else {
      setEntry({ value, draft: raw });
      if (blur)
        setError(
          `Enter ${field.step === 1 ? "a whole number" : "a number"} from ${field.min} to ${field.max}. This edit has not been applied.`,
        );
    }
  }
  return (
    <label className="s4-calc-field">
      <span>{field.label}</span>
      <div>
        {field.choices ? (
          <select
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          >
            {field.choices.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? "any"}
            value={draft}
            onChange={(e) => commit(e.target.value)}
            onBlur={(e) => commit(e.target.value, true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-invalid={!!error}
          />
        )}
        <small>{field.unit}</small>
      </div>
      {error && <em role="status">{error}</em>}
    </label>
  );
}
function validateArray(items: unknown, kind: "pv" | "controller"): Values[] {
  if (!Array.isArray(items) || !items.length || items.length > 12)
    throw new Error("Supply 1–12 complete independent arrays");
  const fields = kind === "pv" ? pvArrayFields : moduleFields;
  return items.map((item) => {
    const row = objectInput(item);
    if (Object.keys(row).some((k) => !fields.some((f) => f.key === k)))
      throw new Error("Unknown array field");
    for (const f of fields) {
      const n = row[f.key];
      if (
        typeof n !== "number" ||
        !Number.isFinite(n) ||
        n < f.min ||
        n > f.max ||
        (f.step === 1 && !Number.isInteger(n))
      )
        throw new Error(`Invalid array ${f.label}`);
    }
    return row as Values;
  });
}
function solarResult(
  values: Values,
  multiple: boolean,
  arrays: Values[],
): PvResult {
  if (!multiple) return localEstimate(values);
  const capacityKw = arrays.reduce((sum, a) => sum + a.capacityKw, 0);
  if (capacityKw > 1000)
    throw new Error("Keep total nameplate capacity at or below 1,000 kW");
  const rows = arrays.map((a) => localEstimate({ ...values, ...a })),
    monthly = Array.from({ length: 12 }, (_, m) =>
      rows.reduce((s, r) => s + r.monthlyKwh[m], 0),
    );
  return withProduction(
    { ...values, capacityKw },
    localEstimate({ ...values, capacityKw }),
    monthly,
    "Solar4U simplified seasonal model · multiple arrays",
  );
}
function calculate(
  id: CalculatorId,
  v: Values,
  pv: PvResult,
  material: string,
  controllerArrays: Values[],
): Report {
  if (id === "pv")
    return {
      raw: pv,
      monthly: pv.monthlyKwh,
      stats: [
        stat("Annual generation", pv.annualKwh, "kWh"),
        stat("Year-one energy value", pv.yearlyBillValue, "$"),
        stat("Annual energy-use offset", pv.energyOffsetPercent, "%"),
      ],
      notice: pv.provider,
    };
  if (id === "battery") {
    const r = batteryRuntime(v);
    return {
      raw: r,
      stats: [
        stat("Usable delivered energy", r.usableKwh, "kWh"),
        stat("Estimated runtime", r.runtimeHours, "hours"),
        stat("Equivalent runtime", r.runtimeDays, "days"),
      ],
      notice:
        r.runtimeHours === null
          ? "No running load is entered. Runtime is undefined for this case."
          : "Assumes a full starting charge and the steady load shown.",
    };
  }
  if (id === "voltage") {
    const r = voltageDrop(v);
    return {
      raw: r,
      stats: [
        stat("Conductor-pair drop", r.dropVolts, "V"),
        stat("Voltage drop", r.dropPercent, "%", r.dropPercent > 3),
        stat("Load-end voltage", r.endVoltage, "V"),
      ],
      notice:
        r.dropPercent <= 3
          ? "Within the 3% planning target. Ampacity still needs a separate check."
          : "Exceeds the 3% planning target. Reduce resistance, distance or current.",
      warn: r.dropPercent > 3,
    };
  }
  if (id === "fuse") {
    const r = fuseBreaker(v);
    return {
      raw: r,
      stats: [
        stat("125% planning minimum", r.minimumAmps, "A"),
        stat(
          "Next standard rating",
          r.recommendedAmps,
          "A",
          !r.conductorSuitable,
        ),
        stat("Entered conductor ampacity", v.conductorAmpacityA, "A"),
      ],
      notice:
        r.recommendedAmps === 0
          ? "No continuous load is entered. No protective-device size is recommended."
          : r.conductorSuitable
            ? "The entered ampacity covers this planning rating. Equipment and circuit-specific requirements remain."
            : "The next standard rating exceeds the entered conductor ampacity. No suitable combination is shown.",
      warn: !r.conductorSuitable,
    };
  }
  if (id === "array") {
    const r = arrayVoltage(v);
    return {
      raw: r,
      stats: [
        stat("Cold open-circuit voltage", r.coldVoc, "V"),
        stat("Operating array voltage", r.arrayVmp, "V"),
        stat("Short-circuit current", r.arrayIsc, "A"),
        stat("Operating current", r.arrayImp, "A"),
        stat("STC nameplate estimate", r.arrayWatts / 1000, "kW"),
      ],
      notice:
        "Series adds voltage. Parallel strings add current. Compare cold Voc with the exact equipment input rating.",
    };
  }
  if (id === "controller") {
    const rows = controllerArrays.map((a) =>
        controllerShortlist({ ...v, ...a }),
      ),
      watts = rows.reduce((s, r) => s + r.array.arrayWatts, 0);
    return {
      raw: { arrays: rows },
      controller: rows,
      stats: [
        stat("Combined module power", watts / 1000, "kW"),
        stat("Independent arrays", rows.length),
        stat("Battery charging voltage", v.batteryChargingVoltage, "V"),
      ],
      notice:
        "Each array is checked separately against one controller. No purchase quantity or automatic string sharing is inferred.",
    };
  }
  if (id === "cable") {
    const r = cableSizing({ ...v, material });
    return {
      raw: r,
      stats: [
        {
          label: "Smallest modeled conductor",
          value: r.gauge ?? "No modeled size",
          warn: !r.meetsDesignTarget,
        },
        stat("Required ampacity", r.requiredAmpacity, "A"),
        stat("Selected voltage drop", r.dropPercent, "%", !r.meetsDesignTarget),
        stat("Illustrative cable-only cost", r.estimatedCableCost, "$"),
      ],
      notice: r.meetsDesignTarget
        ? "Meets both entered planning constraints in this example conductor catalog."
        : "None of the modeled conductors meets both constraints. Increase the available conductor range or revise the design; the largest size is not automatically suitable.",
      warn: !r.meetsDesignTarget,
    };
  }
  if (id === "tou") {
    const r = touBattery(v);
    return {
      raw: r,
      stats: [
        stat("Daily energy shifted", r.shiftableKwh, "kWh"),
        stat("Capacity for rate shifting", r.touBatteryKwh, "kWh"),
        stat("Capacity for full-charge backup", r.emergencyBatteryKwh, "kWh"),
        stat(
          "Daily rate-shifting value",
          r.dailySavings,
          "$",
          r.dailySavings < 0,
        ),
        stat(
          "Annual rate-shifting value",
          r.annualSavings,
          "$",
          r.dailySavings < 0,
        ),
      ],
      notice: `Consumption shares: ${r.onPeakShare}% peak · ${r.midPeakShare}% mid · ${r.offPeakShare}% off. ${r.dailySavings < 0 ? "This rate-shifting case costs more than it saves." : "Value excludes battery wear, capital cost and utility demand charges."}`,
      warn: r.dailySavings < 0,
    };
  }
  const r = payback(v);
  return {
    raw: r,
    cash: r.cashFlow.map((f) => f.cumulativeSavings),
    stats: [
      stat("Net installed cost", r.netCost, "$"),
      stat("First-year savings", r.firstYearSavings, "$"),
      {
        label: "Simple payback",
        value:
          r.netCost === 0
            ? "No net upfront cost"
            : r.paybackYear === null
              ? "Not within 25 years"
              : String(r.paybackYear),
        unit: r.netCost === 0 || r.paybackYear === null ? "" : "years",
      },
      stat(
        "25-year net cash flow",
        r.twentyFiveYearNet,
        "$",
        r.twentyFiveYearNet < 0,
      ),
    ],
    notice:
      "This is an undiscounted what-if calculation. Useful generation and the blended rate should reflect the actual self-consumption and export agreement.",
  };
}
export default function CalculatorsPage() {
  const [active, setActive] = useState<CalculatorId>("pv"),
    [records, setRecords] = useState<Record<CalculatorId, Values>>(
      () =>
        Object.fromEntries(
          calculators.map((c) => [c.id, { ...c.defaults }]),
        ) as Record<CalculatorId, Values>,
    ),
    [multiple, setMultiple] = useState(false),
    [pvArrays, setPvArrays] = useState<Values[]>([
      { capacityKw: 5, tilt: 35, azimuth: 180 },
      { capacityKw: 5, tilt: 30, azimuth: 90 },
    ]),
    [controllerArrays, setControllerArrays] = useState<Values[]>([
      { ...moduleDefaults },
    ]),
    [material, setMaterial] = useState("copper"),
    [remote, setRemote] = useState<{
      signature: string;
      data: PvResult;
    } | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [locations, setLocations] = useState<
      { id: number; label: string; latitude: number; longitude: number }[]
    >([]),
    [searching, setSearching] = useState(false),
    [inputRevision, setInputRevision] = useState(0);
  const request = useRef<AbortController | null>(null),
    locationRequest = useRef<AbortController | null>(null);
  const definition = calculators.find((c) => c.id === active)!,
    v = records[active],
    signature = JSON.stringify([records.pv, multiple, pvArrays]);
  useEffect(() => {
    const t = setTimeout(() => {
      const id = new URLSearchParams(location.search).get("tool");
      if (calculators.some((c) => c.id === id)) setActive(id as CalculatorId);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(
    () => () => {
      request.current?.abort();
      locationRequest.current?.abort();
    },
    [],
  );
  const pv = useMemo(() => {
    try {
      return {
        data:
          remote?.signature === signature
            ? remote.data
            : solarResult(records.pv, multiple, pvArrays),
        error: "",
      };
    } catch (e) {
      return {
        data: null,
        error: e instanceof Error ? e.message : "Invalid solar inputs",
      };
    }
  }, [records.pv, multiple, pvArrays, remote, signature]);
  const report = useMemo<Report>(() => {
    try {
      if (active === "pv" && !pv.data) throw new Error(pv.error);
      return calculate(
        active,
        v,
        pv.data ?? localEstimate(records.pv),
        material,
        controllerArrays,
      );
    } catch (e) {
      return {
        raw: {},
        stats: [],
        error: e instanceof Error ? e.message : "Check the input values",
      };
    }
  }, [active, v, pv, material, controllerArrays, records.pv]);
  function choose(id: CalculatorId) {
    if (id !== "pv") {
      invalidatePv();
      locationRequest.current?.abort();
      setSearching(false);
    }
    setActive(id);
    setError("");
    history.replaceState(null, "", `/calculators?tool=${id}`);
  }
  function invalidatePv() {
    request.current?.abort();
    setLoading(false);
  }
  function update(id: CalculatorId, changes: Values) {
    validateValues(id, changes);
    const next = { ...records[id], ...changes };
    if (id === "tou") {
      next.midPeakSharePercent = Math.min(
        next.midPeakSharePercent,
        100 - next.onPeakSharePercent,
      );
    }
    if (
      id === "controller" &&
      changes.nominalBatteryVoltage !== undefined &&
      changes.batteryChargingVoltage === undefined
    )
      next.batteryChargingVoltage =
        Math.round(((changes.nominalBatteryVoltage * 56.8) / 48) * 10) / 10;
    if (id === "pv") invalidatePv();
    setRecords({ ...records, [id]: next });
    setError("");
  }
  function editArray(
    kind: "pv" | "controller",
    index: number,
    key: string,
    value: number,
  ) {
    if (kind === "pv") invalidatePv();
    const current = kind === "pv" ? pvArrays : controllerArrays,
      next = current.map((a, i) => (i === index ? { ...a, [key]: value } : a));
    validateArray(next, kind);
    if (kind === "pv") setPvArrays(next);
    else setControllerArrays(next);
  }
  async function climate() {
    if (!pv.data) return { error: pv.error ?? "Check the solar inputs" };
    invalidatePv();
    const c = new AbortController();
    request.current = c;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/engine/v1/solar/estimates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...records.pv,
            provider: "pvgis",
            ...(multiple ? { arrays: pvArrays } : {}),
          }),
          signal: c.signal,
        }),
        j = await response.json();
      if (!response.ok) throw new Error(j.error ?? "Climate request failed");
      const data = j.data as PvResult;
      if (
        !Array.isArray(data.monthlyKwh) ||
        data.monthlyKwh.length !== 12 ||
        data.monthlyKwh.some((n) => !Number.isFinite(n) || n < 0)
      )
        throw new Error("Incomplete climate response");
      if (!c.signal.aborted) {
        flushSync(() => setRemote({ signature, data }));
        return { status: "complete", data };
      }
      return { status: "cancelled" };
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "Climate request failed");
      return {
        status: c.signal.aborted ? "cancelled" : "failed",
        error: e instanceof Error ? e.message : "Climate request failed",
      };
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }
  async function findLocation() {
    locationRequest.current?.abort();
    const c = new AbortController();
    locationRequest.current = c;
    setSearching(true);
    setLocations([]);
    try {
      const r = await fetch(
          `/api/engine/v1/locations/search?q=${encodeURIComponent(query)}`,
          { signal: c.signal },
        ),
        j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Location search unavailable");
      if (!c.signal.aborted) {
        const supported = j.data.filter(
          (l: { latitude: number; longitude: number }) =>
            Number.isFinite(l.latitude) &&
            Math.abs(l.latitude) <= 66 &&
            Number.isFinite(l.longitude) &&
            Math.abs(l.longitude) <= 180,
        );
        setLocations(supported);
        setError("");
        if (!supported.length)
          setError(
            "No locality matched within the supported latitude range (66° south to 66° north). Enter coordinates directly.",
          );
      }
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "Search unavailable");
    } finally {
      if (!c.signal.aborted) setSearching(false);
    }
  }
  function exportResult() {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              application: "Solar4U",
              calculator: active,
              createdAt: new Date().toISOString(),
              inputs: v,
              ...(active === "pv"
                ? { multiple, arrays: multiple ? pvArrays : undefined }
                : {}),
              ...(active === "controller" ? { arrays: controllerArrays } : {}),
              ...(active === "cable" ? { material } : {}),
              results: report.raw,
              assumptions: definition.note,
              source: definition.source,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `solar4u-${active}-calculation.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  useAgentTools([
    {
      name: "solar4u_read_calculation",
      description:
        "Read the active calculator, applied inputs, actual results, source and assumptions. Draft invalid inputs are not applied.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async () => ({
        calculator: active,
        inputs: v,
        arrays:
          active === "controller"
            ? controllerArrays
            : active === "pv" && multiple
              ? pvArrays
              : undefined,
        results: report.raw,
        error: report.error || error,
        source: definition.source,
        assumptions: definition.note,
      }),
    },
    {
      name: "solar4u_configure_calculator",
      description:
        "Select a calculator and apply validated numeric input fields. For PV this selects the single-array mode. Values change in the visible tab; export makes a portable record.",
      inputSchema: {
        type: "object",
        properties: {
          calculator: { type: "string", enum: calculators.map((c) => c.id) },
          values: { type: "object", additionalProperties: { type: "number" } },
        },
        required: ["calculator", "values"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        const o = objectInput(input),
          id = o.calculator as CalculatorId;
        if (!calculators.some((c) => c.id === id))
          throw new Error("Unknown calculator");
        const changes = validateValues(id, objectInput(o.values));
        flushSync(() => {
          setInputRevision((n) => n + 1);
          update(id, changes);
          if (id === "pv") setMultiple(false);
          choose(id);
        });
        return { calculator: id, applied: changes };
      },
    },
    {
      name: "solar4u_set_calculator_arrays",
      description:
        "Set 1–12 complete independent PV arrays (capacityKw, tilt, azimuth) or controller arrays (panelVoc, panelVmp, panelIsc, panelImp, seriesCount, parallelCount). This changes the visible calculator.",
      inputSchema: {
        type: "object",
        properties: {
          calculator: { type: "string", enum: ["pv", "controller"] },
          arrays: {
            type: "array",
            minItems: 1,
            maxItems: 12,
            items: { type: "object", additionalProperties: { type: "number" } },
          },
        },
        required: ["calculator", "arrays"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        const o = objectInput(input);
        if (o.calculator !== "pv" && o.calculator !== "controller")
          throw new Error("Choose pv or controller");
        const rows = validateArray(o.arrays, o.calculator);
        if (
          o.calculator === "pv" &&
          rows.reduce((s, a) => s + a.capacityKw, 0) > 1000
        )
          throw new Error("Total capacity exceeds 1000 kW");
        flushSync(() => {
          setInputRevision((n) => n + 1);
          if (o.calculator === "pv") {
            invalidatePv();
            setPvArrays(rows);
            setMultiple(true);
          } else setControllerArrays(rows);
          choose(o.calculator as CalculatorId);
        });
        return { arrayCount: rows.length };
      },
    },
    {
      name: "solar4u_request_climate_estimate",
      description:
        "Request PVGIS climate data for the currently applied solar coordinates and array parameters. Sends those values to EU JRC and may return a clearly labeled seasonal fallback.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async () => {
        flushSync(() => choose("pv"));
        return await climate();
      },
    },
  ]);
  const fields = definition.fields.filter(
    (f) =>
      !(
        active === "pv" &&
        multiple &&
        pvArrayFields.some((a) => a.key === f.key)
      ),
  );
  const group = (kind: "pv" | "controller") => {
    const arrays = kind === "pv" ? pvArrays : controllerArrays,
      fs = kind === "pv" ? pvArrayFields : moduleFields;
    return (
      <section className="s4-array-groups">
        <div className="s4-calc-section-title">
          <h3>Independent arrays</h3>
          <button
            disabled={arrays.length >= 12}
            onClick={() => {
              const next = [
                ...arrays,
                kind === "pv"
                  ? { capacityKw: 5, tilt: 30, azimuth: 180 }
                  : { ...moduleDefaults },
              ];
              if (kind === "pv") {
                // This runs only in the button's click handler, never during render.
                // eslint-disable-next-line react-hooks/refs
                invalidatePv();
                setPvArrays(next);
              } else setControllerArrays(next);
            }}
          >
            <Plus size={14} /> Add array
          </button>
        </div>
        {arrays.map((row, i) => (
          <details open={i === 0} key={i}>
            <summary>
              Array {i + 1}
              {kind === "pv"
                ? ` · ${row.capacityKw} kW`
                : ` · ${row.seriesCount} series × ${row.parallelCount} parallel`}
            </summary>
            <div className="s4-calc-fields">
              {fs.map((f) => (
                <NumberInput
                  key={f.key}
                  field={f}
                  value={row[f.key]}
                  // Event callback; no ref is read while rendering this group.
                  // eslint-disable-next-line react-hooks/refs
                  onChange={(n) => editArray(kind, i, f.key, n)}
                />
              ))}
            </div>
            <button
              disabled={arrays.length === 1}
              onClick={() => {
                const next = arrays.filter((_, idx) => idx !== i);
                if (kind === "pv") {
                  invalidatePv();
                  setPvArrays(next);
                } else setControllerArrays(next);
              }}
            >
              <Trash2 size={14} /> Remove array {i + 1}
            </button>
          </details>
        ))}
      </section>
    );
  };
  return (
    <main className="s4-calculator">
      <header className="s4-calc-heading">
        <div>
          <div className="s4-kicker">
            <Calculator size={15} /> THE NUMBERS WORKSHOP
          </div>
          <h1>
            A good plan starts
            <br />
            <em>with a few good numbers.</em>
          </h1>
          <p>Change an assumption. See what follows.</p>
        </div>
        <Link href="/guides">
          Learn the fundamentals <ArrowUpRight size={17} />
        </Link>
      </header>
      <div className="s4-calc-layout">
        <nav className="s4-calc-nav" aria-label="Solar calculators">
          {calculators.map((c, i) => (
            <button
              key={c.id}
              aria-current={active === c.id ? "page" : undefined}
              onClick={() => choose(c.id)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {c.name}
            </button>
          ))}
        </nav>
        <section className="s4-calc-work">
          <div className="s4-calc-title">
            <div>
              <h2>{definition.name}</h2>
              <p>{definition.description}</p>
            </div>
            <button
              onClick={() => {
                invalidatePv();
                setInputRevision((n) => n + 1);
                setRecords({
                  ...records,
                  [active]: { ...definition.defaults },
                });
                if (active === "pv") {
                  setMultiple(false);
                  setRemote(null);
                  setPvArrays([{ capacityKw: 5, tilt: 30, azimuth: 180 }]);
                }
                if (active === "cable") setMaterial("copper");
                if (active === "controller")
                  setControllerArrays([{ ...moduleDefaults }]);
                setError("");
              }}
            >
              <RotateCcw size={15} /> Reset
            </button>
          </div>
          <div className="s4-calc-columns">
            <div className="s4-calc-inputs" key={`${active}-${inputRevision}`}>
              <h3>Your assumptions</h3>
              {active === "pv" && (
                <>
                  <form
                    className="s4-locality-search"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void findLocation();
                    }}
                  >
                    <label>
                      Find a city or postal code
                      <input
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setLocations([]);
                        }}
                        disabled={searching}
                        placeholder="City or postal code"
                      />
                    </label>
                    <button disabled={searching || query.trim().length < 2}>
                      {searching ? "Searching…" : "Find location"}
                    </button>
                  </form>
                  {locations.map((l) => (
                    <button
                      className="s4-locality-result"
                      key={l.id}
                      onClick={() => {
                        update("pv", {
                          latitude: l.latitude,
                          longitude: l.longitude,
                        });
                        setQuery(l.label);
                        setLocations([]);
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                  <p className="s4-calc-small">
                    Locality search uses Open-Meteo / GeoNames. Enter exact
                    coordinates below for a precise climate location.
                  </p>
                  <label className="s4-calc-switch">
                    <input
                      type="checkbox"
                      checked={multiple}
                      onChange={(e) => {
                        invalidatePv();
                        setMultiple(e.target.checked);
                      }}
                    />{" "}
                    Separate roof faces or arrays
                  </label>
                </>
              )}
              {active === "cable" && (
                <label className="s4-calc-field">
                  <span>Conductor material</span>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                  >
                    <option value="copper">Copper</option>
                    <option value="aluminum">Aluminum</option>
                  </select>
                </label>
              )}
              <div className="s4-calc-fields">
                {fields.map((f) => (
                  <NumberInput
                    key={`${active}-${f.key}`}
                    field={
                      active === "tou" && f.key === "midPeakSharePercent"
                        ? { ...f, max: 100 - v.onPeakSharePercent }
                        : f
                    }
                    value={v[f.key]}
                    onChange={(n) => update(active, { [f.key]: n })}
                  />
                ))}
              </div>
              {active === "pv" && multiple && group("pv")}
              {active === "controller" && group("controller")}
              <p className="s4-calc-small">
                Values remain in this tab. Export the result to keep a record.
              </p>
            </div>
            <section
              className="s4-calc-output"
              aria-label="Calculation results"
            >
              <div className="s4-calc-section-title">
                <h3>Your result</h3>
                <button disabled={!!report.error} onClick={exportResult}>
                  <Download size={15} /> Export
                </button>
              </div>
              {(error || report.error) && (
                <p className="s4-calc-error" role="alert">
                  {error || report.error}
                </p>
              )}
              <div className="s4-calc-stats" aria-live="polite">
                {report.stats.map((s) => (
                  <div className={s.warn ? "warning" : ""} key={s.label}>
                    <small>{s.label}</small>
                    <strong>
                      {s.value}
                      <em>{s.unit}</em>
                    </strong>
                  </div>
                ))}
              </div>
              {report.notice && (
                <p className={`s4-calc-notice ${report.warn ? "warning" : ""}`}>
                  {report.notice}
                </p>
              )}
              {active === "pv" && (
                <>
                  <button
                    className="s4-climate-button"
                    onClick={() => void climate()}
                    disabled={loading || !pv.data}
                  >
                    {loading
                      ? "Reading climate data…"
                      : "Get PVGIS climate estimate"}{" "}
                    <ArrowUpRight size={16} />
                  </button>
                  <p className="s4-calc-small">
                    Sends coordinates and array parameters to EU JRC. Editing an
                    input immediately replaces the old climate result with the
                    current local estimate.
                  </p>
                  {pv.data?.warnings?.map((w) => (
                    <p className="s4-calc-small" key={w}>
                      {w}
                    </p>
                  ))}
                </>
              )}
              {report.monthly && (
                <div
                  className="s4-monthly-chart"
                  aria-label="Monthly production in kilowatt-hours"
                >
                  {report.monthly.map((n, i) => (
                    <div key={i}>
                      <span>{fmt(n, 0)}</span>
                      <i
                        style={{
                          height: `${Math.max(...report.monthly!, 1) > 0 ? (n / Math.max(...report.monthly!, 1)) * 130 : 0}px`,
                        }}
                      />
                      <small>
                        {
                          [
                            "Jan",
                            "Feb",
                            "Mar",
                            "Apr",
                            "May",
                            "Jun",
                            "Jul",
                            "Aug",
                            "Sep",
                            "Oct",
                            "Nov",
                            "Dec",
                          ][i]
                        }
                      </small>
                    </div>
                  ))}
                </div>
              )}
              {active === "pv" && pv.data && (
                <button
                  className="s4-calc-transfer"
                  onClick={() => {
                    try {
                      update("payback", {
                        annualProductionKwh: pv.data!.annualKwh,
                        electricityRate: records.pv.electricityRate,
                      });
                      choose("payback");
                    } catch {
                      setError(
                        "This scenario exceeds the payback tool's supported range (1,000,000 kWh/year and $2/kWh). Open payback and enter a smaller project or rate directly.",
                      );
                    }
                  }}
                >
                  Use this generation in payback →
                </button>
              )}
              {report.cash && (
                <>
                  <div
                    className="s4-cash-chart"
                    aria-label="Cumulative 25-year undiscounted cash flow"
                  >
                    {report.cash.map((n, i) => (
                      <div key={i} title={`Year ${i + 1}: $${fmt(n, 0)}`}>
                        <i
                          className={n < 0 ? "negative" : ""}
                          style={{
                            height: `${(Math.abs(n) / Math.max(...report.cash!.map(Math.abs), 1)) * 120}px`,
                          }}
                        />
                        <small>{i === 0 || i % 5 === 4 ? i + 1 : ""}</small>
                      </div>
                    ))}
                  </div>
                  <details>
                    <summary>Year-by-year cash flow</summary>
                    <table>
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Net cash flow</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.cash.map((n, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>${fmt(n, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              )}
              {report.controller?.map((r, i) => (
                <section className="s4-controller-results" key={i}>
                  <h4>Array {i + 1} · preliminary shortlist</h4>
                  <p>
                    Cold Voc {fmt(r.array.coldVoc)} V · PV Isc{" "}
                    {fmt(r.array.arrayIsc)} A · hot Vmp {fmt(r.hotVmp)} V
                  </p>
                  {r.candidates.map((c) => (
                    <article
                      key={c.model}
                      className={c.preliminaryMatch ? "candidate" : "rejected"}
                    >
                      <div>
                        <strong>{c.model}</strong>
                        <span>
                          {c.preliminaryMatch
                            ? "Preliminary match"
                            : "Outside checked limits"}
                        </span>
                      </div>
                      <p>
                        {c.maxColdVocV} V absolute Voc · {c.maxPvIscA} A PV Isc
                        · {c.maxChargeCurrentA} A charge output
                      </p>
                      {c.failures.map((f) => (
                        <p className="s4-calc-small" key={f}>
                          {f}
                        </p>
                      ))}
                      {c.powerLimited && (
                        <p className="s4-calc-small">
                          Array power exceeds the{" "}
                          {c.nominalPower.toLocaleString()} W nominal rating at
                          this battery voltage; power limiting is expected.
                        </p>
                      )}
                      <a href={c.source} target="_blank" rel="noreferrer">
                        Manufacturer specifications ↗
                      </a>
                    </article>
                  ))}
                  <p className="s4-calc-small">
                    Hot Vmp is used as a conservative startup check against
                    charging voltage +5 V. 36 V requires manual battery
                    selection. On MC4 variants, verify the 30 A per-connector
                    limit. Connector pairs share one MPPT.
                  </p>
                </section>
              ))}
              <details className="s4-calc-method" open>
                <summary>Method & limits</summary>
                <p className="s4-calc-formula">{definition.formula}</p>
                <p>{definition.note}</p>
                <a href={definition.source} target="_blank" rel="noreferrer">
                  {definition.sourceName} ↗
                </a>
                <small>Sources reviewed September 7, 2026</small>
              </details>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
