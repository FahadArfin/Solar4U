"use client";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Check,
  ArrowUpRight,
  ChartNoAxesCombined,
  X,
} from "lucide-react";
import { formatMinor, type RetailOffer } from "../lib/equipment";
import { type Classification } from "../services/price-worker/classification.mjs";
import {
  parsePriceHistory,
  historySummary,
  type PricePoint,
} from "../lib/price-history";
import { type ComponentLibrary } from "../lib/component-library";
import { useAgentTools } from "./webmcp";

export type ComponentOffer = RetailOffer & { classification: Classification };
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const availability = (value: boolean | null) =>
  value === true
    ? "In stock"
    : value === false
      ? "Out of stock"
      : "Stock unknown";
type Props = {
  library: ComponentLibrary;
  libraryError: string;
  remember: (o: ComponentOffer, points?: PricePoint[]) => Promise<boolean>;
  forget: (o: ComponentOffer) => Promise<boolean>;
  saveError: string;
  rows: ComponentOffer[];
  panelMode: boolean;
  compare: string[];
  inBuild: Set<string>;
  quantities: Record<string, string>;
  disabled: boolean;
  replacing: boolean;
  setQuantity: (id: string, value: string) => void;
  toggleCompare: (id: string) => void;
  add: (offer: ComponentOffer) => Promise<void>;
  specText: (offer: ComponentOffer) => string;
  subName: (c: Classification) => string;
  unitWatts: (offer: ComponentOffer) => number | null;
  impact: (offer: ComponentOffer) => string | null;
  peers: (offer: ComponentOffer) => number;
  findPeers: (offer: ComponentOffer) => void;
};

function History({
  offer,
  close,
  specText,
  subName,
  add,
  disabled,
  replacing,
  quantity,
  setQuantity,
  impact,
  saveError,
  cached,
  remember,
  libraryError,
  forget,
}: {
  cached?: ComponentLibrary["records"][number];
  remember: Props["remember"];
  forget: Props["forget"];
  libraryError: string;
  saveError: string;
  offer: ComponentOffer;
  close: () => void;
  specText: Props["specText"];
  subName: Props["subName"];
  add: Props["add"];
  disabled: boolean;
  replacing: boolean;
  quantity: string;
  setQuantity: (value: string) => void;
  impact: string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [points, setPoints] = useState<PricePoint[]>(
      cached?.points ?? [
        [offer.observedAt, offer.minorAmount, offer.available],
      ],
    ),
    [status, setStatus] = useState("Loading recorded prices…"),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0),
    [range, setRange] = useState(0);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => {
      el?.close();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void remember(offer);
    fetch(
      `/api/prices?source=${encodeURIComponent(offer.retailerId)}&id=${offer.id}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "Price history could not be loaded. Your saved build is unchanged.",
          );
        const result = await r.json();
        return parsePriceHistory(result.points);
      })
      .then((p) => {
        if (controller.signal.aborted) return;
        setPoints(
          parsePriceHistory([
            ...(cached?.points ?? []),
            ...p,
            [offer.observedAt, offer.minorAmount, offer.available],
          ]),
        );
        void remember(offer, p);
        setError(false);
        setStatus(
          p.length
            ? `${p.length} recorded observations. Missing days are not estimated.`
            : "No earlier records returned yet. The dated listing observation is shown.",
        );
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(true);
          setStatus(
            (e instanceof Error ? e.message : "History unavailable") +
              " Showing the saved listing and available device history.",
          );
        }
      });
    return () => controller.abort();
    // The selected snapshot and initial cache stay fixed for this dialog session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.id, offer.retailerId, attempt]);
  const [openedAt] = useState(Date.now);
  const filtered = range
    ? points.filter((p) => Date.parse(p[0]) >= openedAt - range * 86400000)
    : points;
  const summary = historySummary(filtered);
  const firstTime = filtered.length ? Date.parse(filtered[0][0]) : 0,
    lastTime = filtered.length
      ? Date.parse(filtered[filtered.length - 1][0])
      : 0;
  const low = summary?.low ?? 0,
    high = summary?.high ?? 0,
    padding = Math.max((high - low) * 0.2, high * 0.02, 1);
  const yLow = Math.max(0, low - padding),
    yHigh = high + padding;
  const x = (p: PricePoint) =>
    firstTime === lastTime
      ? 340
      : 74 + ((Date.parse(p[0]) - firstTime) / (lastTime - firstTime)) * 546;
  const y = (p: PricePoint) => 170 - ((p[1] - yLow) / (yHigh - yLow)) * 120;
  useAgentTools([
    {
      name: "solar4u_read_component_history",
      description:
        "Read the exact retailer variant and recorded price history currently visible in the component detail dialog. Values are integer minor currency units; missing days are not inferred.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => ({
        offerId: offer.id,
        retailer: offer.retailer,
        currency: offer.currency,
        points: filtered,
        summary,
        status,
        error,
      }),
    },
  ]);
  return (
    <dialog
      ref={dialog}
      className="co-dialog"
      aria-labelledby="component-detail-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header className="co-detail-heading">
        <span>COMPONENT DETAILS & PRICE HISTORY</span>
        <button autoFocus aria-label="Close component details" onClick={close}>
          <X size={18} />
        </button>
      </header>
      <div className="co-detail-content">
        <div className="s4-kicker">
          {subName(offer.classification)} · {offer.retailer}
        </div>
        <h2 id="component-detail-title">{offer.name}</h2>
        <p className="co-variant">
          {offer.variant === "Default Title" ? "Listed variant" : offer.variant}
          {offer.sku ? ` · SKU ${offer.sku}` : ""}
        </p>
        <div className="co-current">
          <div>
            <strong>{formatMinor(offer.minorAmount, offer.currency)}</strong>
            <span>{offer.currency} / listed variant</span>
          </div>
          <p>
            {availability(offer.available)}
            <small>Observed {date(offer.observedAt)}</small>
          </p>
          <a href={offer.url} target="_blank" rel="noreferrer">
            Visit retailer <ArrowUpRight size={14} />
          </a>
        </div>
        <dl className="co-spec-grid">
          <div>
            <dt>Title / variant specs</dt>
            <dd>{specText(offer)}</dd>
          </div>
          <div>
            <dt>Package</dt>
            <dd>
              {offer.classification.specs.packCount === null
                ? "Unit count not confirmed"
                : `${offer.classification.specs.packCount} units stated in package`}
            </dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{subName(offer.classification)}</dd>
          </div>
          <div>
            <dt>Condition in title</dt>
            <dd>
              {offer.classification.specs.condition === "unknown"
                ? "Not specified"
                : offer.classification.specs.condition}
            </dd>
          </div>
        </dl>
        <p className="co-note" role="status">
          {libraryError ||
            (cached
              ? "Product record and specification clues saved on this device."
              : "Saving product record on this device…")}
        </p>
        <p className="co-note">
          Specs are title-derived clues; confirm the datasheet and package
          contents. {offer.classification.packageNote}
        </p>
        <div className="co-history-heading">
          <h3>Recorded prices</h3>
          <div aria-label="Price history period">
            {[
              [30, "30 days"],
              [90, "90 days"],
              [0, "All history"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={range === value}
                onClick={() => setRange(Number(value))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {summary && (
          <div className="co-history-stats">
            <div>
              <small>Period low</small>
              <strong>{formatMinor(summary.low, offer.currency)}</strong>
            </div>
            <div>
              <small>Period high</small>
              <strong>{formatMinor(summary.high, offer.currency)}</strong>
            </div>
            <div>
              <small>First → latest record</small>
              <strong>
                {filtered.length < 2
                  ? "One observation"
                  : summary.change === 0
                    ? "No price change"
                    : `${summary.change > 0 ? "+" : "−"}${formatMinor(Math.abs(summary.change), offer.currency)}`}
              </strong>
            </div>
          </div>
        )}
        {filtered.length > 0 && (
          <figure className="co-chart">
            <svg
              viewBox="0 0 650 210"
              role="img"
              aria-label={`Recorded ${offer.currency} prices for this exact variant. ${filtered.length} observations. Price range ${formatMinor(low, offer.currency)} to ${formatMinor(high, offer.currency)}. Full dated values follow below.`}
            >
              {[0, 0.5, 1].map((n) => (
                <g key={n}>
                  <line
                    x1="74"
                    x2="620"
                    y1={50 + n * 120}
                    y2={50 + n * 120}
                    stroke="#d9dfce"
                    strokeDasharray="4 5"
                  />
                  <text x="66" y={54 + n * 120} textAnchor="end">
                    {formatMinor(
                      Math.round(yHigh - (yHigh - yLow) * n),
                      offer.currency,
                    )}
                  </text>
                </g>
              ))}
              {filtered.map((p, i) => (
                <g key={p[0]}>
                  {i > 0 &&
                    Date.parse(p[0]) - Date.parse(filtered[i - 1][0]) <=
                      36 * 3600000 && (
                      <line
                        x1={x(filtered[i - 1])}
                        y1={y(filtered[i - 1])}
                        x2={x(p)}
                        y2={y(p)}
                        stroke="#789456"
                        strokeWidth="2"
                      />
                    )}
                  <circle cx={x(p)} cy={y(p)} r="3.5" fill="#3d6144">
                    <title>
                      {date(p[0])}: {formatMinor(p[1], offer.currency)} ·{" "}
                      {availability(p[2])}
                    </title>
                  </circle>
                </g>
              ))}
              <text x="74" y="198">
                {date(filtered[0][0])}
              </text>
              {filtered.length > 1 && (
                <text x="620" y="198" textAnchor="end">
                  {date(filtered[filtered.length - 1][0])}
                </text>
              )}
            </svg>
            <figcaption>
              Each dot is a recorded price. Longer collection gaps break the
              line. The vertical scale focuses on the observed price range.
            </figcaption>
          </figure>
        )}
        <p role={error ? "alert" : "status"} className="co-note">
          {status}
          {!error &&
            points.length > 0 &&
            !filtered.length &&
            " No observations fall in this period."}
        </p>
        {error && (
          <button
            onClick={() => {
              setError(false);
              setStatus("Loading recorded prices…");
              setAttempt((a) => a + 1);
            }}
          >
            Retry history
          </button>
        )}
        {filtered.length > 0 && (
          <details className="co-records">
            <summary>View {filtered.length} dated observations</summary>
            <div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Price · {offer.currency}</th>
                    <th>Observed availability</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered].reverse().map((p) => (
                    <tr key={p[0]}>
                      <th scope="row">{date(p[0])}</th>
                      <td>{formatMinor(p[1], offer.currency)}</td>
                      <td>{availability(p[2])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
        <button
          onClick={async () => {
            if (await forget(offer)) close();
          }}
        >
          Remove from device catalog
        </button>
        <p className="co-note">
          History belongs to this retailer and exact variant. Prices exclude tax
          and shipping. Similar names or shared SKUs do not guarantee the same
          product.
        </p>
      </div>
      <footer className="co-detail-actions">
        {saveError && <p role="alert">{saveError}</p>}
        <label>
          Purchase quantity
          <input
            type="number"
            required
            min={1}
            max={10000}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <button
          className="co-add"
          disabled={disabled}
          onClick={() => {
            if (dialog.current?.querySelector("input")?.reportValidity())
              void add(offer);
          }}
        >
          <Plus size={15} />
          {replacing ? "Use replacement" : "Add to build"}
        </button>
        {impact && (
          <small>{impact} build subtotal · excludes unpriced parts</small>
        )}
      </footer>
    </dialog>
  );
}

export default function ComponentOffers(p: Props) {
  const [selected, setSelected] = useState<ComponentOffer | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  function close() {
    setSelected(null);
    requestAnimationFrame(() => opener.current?.focus());
  }
  function open(o: ComponentOffer, element: HTMLElement) {
    opener.current = element;
    setSelected(o);
  }
  return (
    <>
      <p className="co-list-hint">
        <ChartNoAxesCombined size={15} /> Click a product name for specs and
        recorded price history.
      </p>
      <div
        className="co-table-scroll"
        role="region"
        aria-label="Component offers table"
        tabIndex={0}
      >
        <table className="co-table">
          <thead>
            <tr>
              <th>
                <span className="wb-sr-only">Compare</span>
              </th>
              <th>Component / retailer</th>
              <th>{p.panelMode ? "Module" : "Key specs"}</th>
              <th>Package</th>
              <th>Listed price</th>
              <th>Availability</th>
              <th>Qty</th>
              <th>
                <span className="wb-sr-only">Add to build</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((o) => {
              const s = o.classification.specs,
                watts = p.unitWatts(o),
                peers = p.peers(o);
              return (
                <tr key={o.id} data-selected={p.inBuild.has(o.id)}>
                  <td>
                    <input
                      type="checkbox"
                      checked={p.compare.includes(o.id)}
                      onChange={() => p.toggleCompare(o.id)}
                      aria-label={`Compare ${o.name}, ${o.variant}, from ${o.retailer}`}
                    />
                  </td>
                  <td className="co-product">
                    <button onClick={(e) => open(o, e.currentTarget)}>
                      {o.name}
                    </button>
                    <small>
                      {o.variant && o.variant !== "Default Title"
                        ? o.variant
                        : o.sku || "Listed variant"}
                    </small>
                    <span>
                      {o.retailer} · {p.subName(o.classification)}
                    </span>
                    {peers > 0 && (
                      <button
                        className="co-peers"
                        onClick={() => p.findPeers(o)}
                      >
                        {peers} other retailer offer{peers === 1 ? "" : "s"}{" "}
                        with this SKU · verify variant
                      </button>
                    )}
                  </td>
                  <td className="co-spec">
                    {p.panelMode ? (
                      <>
                        <strong>
                          {s.watts === null ? "—" : `${s.watts} W`}
                        </strong>
                        <small>Title rating</small>
                      </>
                    ) : (
                      <small>{p.specText(o)}</small>
                    )}
                  </td>
                  <td>
                    <strong>
                      {s.packCount === null
                        ? "Not stated"
                        : `${s.packCount} units`}
                    </strong>
                    <small>
                      {s.condition === "unknown"
                        ? "Condition unspecified"
                        : s.condition}
                    </small>
                  </td>
                  <td className="co-price">
                    <strong>{formatMinor(o.minorAmount, o.currency)}</strong>
                    <small>{o.currency} / variant</small>
                    {watts !== null && (
                      <small>
                        {formatMinor(
                          Math.round(o.minorAmount / watts),
                          o.currency,
                        )}{" "}
                        / stated W
                      </small>
                    )}
                    <button
                      className="co-history-link"
                      aria-label={`Price history for ${o.name}, ${o.variant}, from ${o.retailer}`}
                      onClick={(e) => open(o, e.currentTarget)}
                    >
                      <ChartNoAxesCombined size={13} /> History
                    </button>
                  </td>
                  <td>
                    <span className={o.available ? "co-in-stock" : ""}>
                      {availability(o.available)}
                    </span>
                    <small>{date(o.observedAt)}</small>
                  </td>
                  <td>
                    <input
                      className="co-qty"
                      type="number"
                      aria-label={`Purchase quantity for ${o.name}, ${o.variant}, from ${o.retailer}`}
                      min={1}
                      max={10000}
                      step={1}
                      value={p.quantities[o.id] ?? "1"}
                      onChange={(e) => p.setQuantity(o.id, e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      className="co-add"
                      title={
                        p.impact(o)
                          ? `${p.impact(o)} build subtotal with this choice; excludes unpriced items`
                          : undefined
                      }
                      aria-label={`${p.replacing ? "Replace with" : "Add"} ${o.name}, ${o.variant}, from ${o.retailer} to build`}
                      disabled={p.disabled}
                      onClick={() => void p.add(o)}
                    >
                      {p.inBuild.has(o.id) ? (
                        <Check size={14} />
                      ) : (
                        <Plus size={14} />
                      )}
                      {p.replacing ? "Use" : "Add"}
                    </button>
                    <a href={o.url} target="_blank" rel="noreferrer">
                      Shop <ArrowUpRight size={12} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected && (
        <History
          key={selected.id}
          cached={p.library.records.find(
            (r) =>
              r.offer.id === selected.id &&
              r.offer.currency === selected.currency,
          )}
          libraryError={p.libraryError}
          remember={p.remember}
          forget={p.forget}
          saveError={p.saveError}
          offer={selected}
          close={close}
          specText={p.specText}
          subName={p.subName}
          add={p.add}
          disabled={p.disabled}
          replacing={p.replacing}
          quantity={p.quantities[selected.id] ?? "1"}
          setQuantity={(value) => p.setQuantity(selected.id, value)}
          impact={p.impact(selected)}
        />
      )}
    </>
  );
}
