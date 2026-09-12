"use client";
import Link from "next/link";
import { useState, type RefObject } from "react";
import {
  Sun,
  Layers3,
  Box,
  Cable,
  Zap,
  Battery,
  Package,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  Trash2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import {
  shoppingGroups,
  type ShoppingGroup,
} from "../services/price-worker/classification.mjs";
import {
  equipmentTotals,
  equipmentCsv,
  formatMinor,
  parseUnitPrice,
  currencyDigits,
  type EquipmentList,
  type EquipmentItem,
} from "../lib/equipment";
import {
  BUILD_PREFS_KEY,
  emptyBuildPreferences,
  validateBuildPreferences,
  buildPurposes,
} from "../lib/builder";
import { useDeviceDocument, downloadFile } from "../lib/device-store";

const icons = {
  panels: Sun,
  mounting: Layers3,
  electrical: Box,
  wiring: Cable,
  inverters: Zap,
  batteries: Battery,
  bundles: Package,
  other: Plus,
};
type Props = {
  data: EquipmentList;
  ready: boolean;
  header: RefObject<HTMLHeadingElement | null>;
  itemGroup: (item: EquipmentItem) => ShoppingGroup;
  browse: (group: ShoppingGroup, subtype?: string) => void;
  replace: (item: EquipmentItem) => void;
  remove: (id: string) => void;
  commit: (change: (value: EquipmentList) => EquipmentList) => Promise<boolean>;
};

function Quantity({
  item,
  commit,
  ready,
}: {
  item: EquipmentItem;
  commit: Props["commit"];
  ready: boolean;
}) {
  const [value, setValue] = useState(String(item.quantity));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 10000) {
      setError("Use 1–10,000 whole units. Not saved.");
      return;
    }
    setError("");
    if (n === item.quantity) return;
    setBusy(true);
    const ok = await commit((c) => {
      if (!c.items.some((i) => i.id === item.id))
        throw new Error("This part was removed in another tab.");
      return {
        ...c,
        items: c.items.map((i) =>
          i.id === item.id ? { ...i, quantity: n } : i,
        ),
      };
    });
    if (!ok) setValue(String(item.quantity));
    setBusy(false);
  }
  return (
    <>
      <input
        aria-label={`Quantity for ${item.name}`}
        aria-invalid={!!error}
        aria-describedby={error ? `quantity-error-${item.id}` : undefined}
        type="number"
        min={1}
        max={10000}
        step={1}
        value={value}
        disabled={busy || !ready}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {error && (
        <small id={`quantity-error-${item.id}`} role="alert">
          {error}
        </small>
      )}
    </>
  );
}

export default function BuilderWorkbench({
  data,
  ready,
  header,
  itemGroup,
  browse,
  replace,
  remove,
  commit,
}: Props) {
  const prefs = useDeviceDocument(
    BUILD_PREFS_KEY,
    emptyBuildPreferences,
    validateBuildPreferences,
  );
  const [editingBudget, setEditingBudget] = useState(false),
    [budgetText, setBudgetText] = useState(""),
    [budgetError, setBudgetError] = useState("");
  const [renaming, setRenaming] = useState(false),
    [name, setName] = useState(data.name);
  const totals = equipmentTotals(data.items),
    selected = new Set(data.items.map(itemGroup));
  const core = shoppingGroups.filter(
    (g) => !["bundles", "other"].includes(g.id),
  );
  const next = core.find((g) => !selected.has(g.id));
  const purpose = buildPurposes.find((p) => p.id === prefs.data.purpose)!;
  const subtotal = totals[prefs.data.currency]?.minorAmount ?? 0;
  const balance =
    prefs.data.budget === null ? null : prefs.data.budget - subtotal;
  const sceneParts = [
    "panels",
    "inverters",
    "batteries",
    "electrical",
  ] as ShoppingGroup[];
  const canEditPrefs = prefs.ready && !prefs.needsRecovery;
  return (
    <>
      <div className="wb-project-bar">
        <div>
          <div className="s4-kicker">YOUR SOLAR WORKBENCH</div>
          {renaming ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  name.trim() &&
                  (await commit((c) => ({ ...c, name: name.trim() })))
                )
                  setRenaming(false);
              }}
            >
              <input
                autoFocus
                aria-label="Build name"
                value={name}
                maxLength={120}
                required
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit">Save name</button>
              <button type="button" onClick={() => setRenaming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <h2 ref={header} tabIndex={-1}>
              {data.name}
              <button
                disabled={!ready}
                aria-label="Rename build"
                onClick={() => {
                  setName(data.name);
                  setRenaming(true);
                }}
              >
                Rename
              </button>
            </h2>
          )}
        </div>
        <div className="wb-tools">
          <button
            disabled={!ready}
            onClick={() =>
              downloadFile("my-solar-build.json", JSON.stringify(data, null, 2))
            }
          >
            <Download size={14} /> Backup
          </button>
          <button
            disabled={!ready}
            onClick={() =>
              downloadFile(
                "my-solar-shopping-list.csv",
                equipmentCsv(data),
                "text/csv",
              )
            }
          >
            <Download size={14} /> Shopping list
          </button>
        </div>
      </div>
      <div className="wb-intentions" aria-label="Build purpose">
        {buildPurposes.map((p) => (
          <button
            key={p.id}
            aria-pressed={p.id === prefs.data.purpose}
            disabled={!canEditPrefs}
            onClick={() => void prefs.commit((c) => ({ ...c, purpose: p.id }))}
          >
            <span>
              {p.id === prefs.data.purpose ? (
                <Check size={15} />
              ) : (
                <Sun size={15} />
              )}
              {p.name}
            </span>
            <small>{p.description}</small>
          </button>
        ))}
      </div>
      <div className="wb-layout">
        <section className="wb-list" aria-label="Your component list">
          <div className="wb-list-heading">
            <span>
              <Layers3 size={17} /> Choose your parts
            </span>
            <small>
              {core.filter((g) => selected.has(g.id)).length} of 6 categories
              explored · use what your design needs
            </small>
          </div>
          <div className="wb-table-wrap">
            <table className="wb-parts-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Your selection</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>
                    <span className="wb-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shoppingGroups.flatMap((g) => {
                  const items = data.items.filter((i) => itemGroup(i) === g.id),
                    Icon = icons[g.id];
                  if (["bundles", "other"].includes(g.id) && !items.length)
                    return [];
                  return [
                    <tr
                      key={g.id}
                      className={`wb-slot-row ${items.length ? "wb-filled" : ""}`}
                    >
                      <th scope="row">
                        <Icon size={20} />
                        <span>{g.name}</span>
                        {items.length > 0 && <Check size={13} />}
                      </th>
                      <td colSpan={4}>
                        {items.length ? (
                          <button
                            className="wb-link-button"
                            onClick={() => browse(g.id)}
                          >
                            <Plus size={13} /> Add another{" "}
                            {g.id === "batteries" ? "battery" : "part"}
                          </button>
                        ) : (
                          <div className="wb-empty-slot">
                            <button onClick={() => browse(g.id)}>
                              <Plus size={15} /> Choose {g.name.toLowerCase()}
                            </button>
                            <span>
                              {g.id === "batteries" &&
                              prefs.data.purpose === "grid"
                                ? "Optional storage for later"
                                : g.description}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>,
                    ...items.map((i) => (
                      <tr key={i.id} className="wb-part-row">
                        <td className="wb-retailer">
                          {i.source ? (
                            <>
                              <b>{i.source.retailer}</b>
                              <small>
                                {i.source.imported ? "Imported · " : ""}
                                {new Date(
                                  i.source.observedAt,
                                ).toLocaleDateString()}
                              </small>
                              <small>
                                {i.source.available === true
                                  ? "Observed in stock"
                                  : i.source.available === false
                                    ? "Observed out of stock"
                                    : "Stock unknown"}
                              </small>
                            </>
                          ) : (
                            <small>Manual item / allowance</small>
                          )}
                        </td>
                        <td className="wb-part-title">
                          <strong>{i.name}</strong>
                          <small>
                            {i.source?.variant === "Default Title"
                              ? i.source.sku || "Listed variant"
                              : i.source?.variant}
                          </small>
                          {i.notes && <small>{i.notes}</small>}
                          <button
                            className="wb-link-button"
                            disabled={!ready}
                            onClick={() => replace(i)}
                          >
                            <RefreshCw size={12} /> Replace part
                          </button>
                        </td>
                        <td className="wb-quantity">
                          <Quantity
                            key={`${i.id}-${i.quantity}`}
                            item={i}
                            commit={commit}
                            ready={ready}
                          />
                        </td>
                        <td className="wb-line-price">
                          <strong>
                            {i.unitMinorAmount === null
                              ? "Unpriced"
                              : formatMinor(
                                  i.unitMinorAmount * i.quantity,
                                  i.currency,
                                )}
                          </strong>
                          <small>
                            {i.currency}
                            {i.unitMinorAmount !== null
                              ? ` · ${formatMinor(i.unitMinorAmount, i.currency)} each`
                              : " · excluded from subtotal"}
                          </small>
                          {i.source && (
                            <a
                              href={i.source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Shop <ArrowUpRight size={12} />
                            </a>
                          )}
                        </td>
                        <td>
                          <button
                            className="wb-remove"
                            aria-label={`Remove ${i.name} from build`}
                            disabled={!ready}
                            onClick={() => remove(i.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <div className="wb-list-footer">
            <button onClick={() => browse("bundles")}>
              <Package size={15} /> Explore complete kits
            </button>
            <Link href="/equipment">
              Add a custom part / quote <ArrowUpRight size={13} />
            </Link>
          </div>
          <p className="wb-footnote">
            Quantities count purchased variants or packages, not individual
            panels inside a bundle. Prices are saved observations; shipping and
            taxes are additional.
          </p>
          <details className="wb-guide">
            <summary>
              <Sun size={17} /> A good place to start <ChevronDown size={15} />
            </summary>
            <p>{purpose.tip}</p>
            <div>
              <Link href="/calculators">Size your system ↗</Link>
              <Link href="/guides">Learn the essentials ↗</Link>
              <Link href="/planner">Plan your layout ↗</Link>
            </div>
          </details>
          <details className="wb-guide">
            <summary>
              <Zap size={17} /> Compatibility review · not yet verified{" "}
              <ChevronDown size={15} />
            </summary>
            <p>
              A filled parts list is a shopping draft, not an approved
              electrical design. Matching voltage alone is not enough.
            </p>
            <ul>
              <li>
                Panel strings → MPPT: cold Voc, hot Vmp and input current
                limits.
              </li>
              <li>
                Battery → inverter: operating voltage, BMS protocol and charge
                limits.
              </li>
              <li>
                Panels → mounting: module dimensions, clamp zones and site
                loads.
              </li>
              <li>
                Wiring & protection: AC/DC ratings, fault current and
                installation conditions.
              </li>
            </ul>
            <Link href="/calculators?tool=controller">
              Open preliminary controller checks ↗
            </Link>
          </details>
        </section>
        <aside className="wb-summary">
          <div className="wb-scene">
            <div className="wb-scene-top">
              <span>A little more sun.</span>
              <Sun size={22} />
            </div>
            <svg
              viewBox="0 0 300 146"
              role="img"
              aria-label={`Illustration of a ${prefs.data.mounting === "ground" ? "ground-mounted" : "rooftop"} solar project; not a measured layout`}
            >
              <path
                d="M0 118 Q90 84 173 118 T300 110 V146 H0Z"
                fill="#d6dfbe"
              />
              <path d="M0 136 Q130 109 300 131 V146 H0Z" fill="#b8cba2" />
              <path d="M70 75 L129 31 L190 75 V126 H70Z" fill="#f8f2dd" />
              <path
                d="M60 76 L129 24 L201 76 L193 85 L129 39 L68 85Z"
                fill="#849579"
              />
              <path d="M120 90 H142 V126 H120Z" fill="#c8b68e" />
              <path
                d="M85 86 H106 V107 H85Z M156 86 H177 V107 H156Z"
                fill="#9bbaa9"
              />
              {prefs.data.mounting === "ground" ? (
                <g opacity={selected.has("panels") ? 1 : 0.35}>
                  <path
                    d="M206 109 V132 M265 109 V132"
                    stroke="#657764"
                    strokeWidth="4"
                  />
                  <path
                    d="M218 76 H278 L264 112 H204Z"
                    fill="#48685d"
                    stroke="#fbf7e8"
                    strokeWidth="2"
                  />
                  <path
                    d="M214 88 H273 M209 100 H268 M238 76 L224 112 M258 76 L244 112"
                    stroke="#a5c0ae"
                  />
                </g>
              ) : (
                <g opacity={selected.has("panels") ? 1 : 0.35}>
                  <path
                    d="M109 47 L132 30 L180 68 L155 83Z"
                    fill="#48685d"
                    stroke="#fbf7e8"
                    strokeWidth="2"
                  />
                  <path
                    d="M117 41 L165 77 M124 36 L173 72 M125 60 L148 43 M141 72 L163 55"
                    stroke="#a5c0ae"
                  />
                </g>
              )}
              {selected.has("batteries") && (
                <g>
                  <rect
                    x="185"
                    y="98"
                    width="15"
                    height="28"
                    rx="3"
                    fill="#f9f8ee"
                    stroke="#657764"
                  />
                  <path d="M190 103 H195 M190 109 H195" stroke="#91a97d" />
                </g>
              )}
              <path
                d="M30 123 V88 M20 106 L30 82 L40 106Z"
                fill="#849d6b"
                stroke="#849d6b"
                strokeWidth="3"
              />
            </svg>
            <div
              className="wb-mount-toggle"
              aria-label="Project illustration mounting"
            >
              <button
                aria-pressed={prefs.data.mounting === "roof"}
                disabled={!canEditPrefs}
                onClick={() =>
                  void prefs.commit((c) => ({ ...c, mounting: "roof" }))
                }
              >
                Roof
              </button>
              <button
                aria-pressed={prefs.data.mounting === "ground"}
                disabled={!canEditPrefs}
                onClick={() =>
                  void prefs.commit((c) => ({ ...c, mounting: "ground" }))
                }
              >
                Ground
              </button>
            </div>
            <small>Project illustration · plan dimensions in the studio</small>
          </div>
          <div className="wb-energy-path" aria-label="Selected parts overview">
            {sceneParts.map((g, n) => {
              const Icon = icons[g];
              return (
                <button
                  key={g}
                  aria-label={`Choose ${g}`}
                  data-selected={selected.has(g)}
                  onClick={() => browse(g)}
                >
                  <Icon size={20} />
                  <small>
                    {g === "electrical"
                      ? "Protection"
                      : g === "inverters"
                        ? "Inverter"
                        : g === "batteries"
                          ? "Storage"
                          : "Solar"}
                  </small>
                  {n < 3 && <ArrowRight className="wb-path-arrow" size={12} />}
                </button>
              );
            })}
          </div>
          <div className="wb-money">
            <div className="s4-kicker">YOUR PARTS BUDGET</div>
            {!Object.keys(totals).length && (
              <>
                <strong className="wb-big-price">
                  {formatMinor(0, prefs.data.currency)}
                </strong>
                <small>Your first part starts the story.</small>
              </>
            )}
            {Object.entries(totals).map(([c, t]) => (
              <div key={c} className="wb-subtotal">
                <strong className="wb-big-price">
                  {formatMinor(t.minorAmount, c)}
                </strong>
                <small>
                  {c} parts subtotal
                  {t.unknown > 0
                    ? ` · ${t.unknown} unpriced units excluded`
                    : ""}
                </small>
              </div>
            ))}
            {editingBudget ? (
              <form
                className="wb-budget-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const budget = parseUnitPrice(
                      budgetText,
                      prefs.data.currency,
                    );
                    if (await prefs.commit((c) => ({ ...c, budget }))) {
                      setEditingBudget(false);
                      setBudgetError("");
                    }
                  } catch (e) {
                    setBudgetError(
                      e instanceof Error ? e.message : "Invalid budget",
                    );
                  }
                }}
              >
                <label>
                  Target budget · {prefs.data.currency}
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={budgetText}
                    onChange={(e) => setBudgetText(e.target.value)}
                    placeholder="Leave blank to clear"
                  />
                </label>
                <button type="submit">Save target</button>
                <button type="button" onClick={() => setEditingBudget(false)}>
                  Cancel
                </button>
                {budgetError && <p role="alert">{budgetError}</p>}
              </form>
            ) : (
              <div className="wb-budget-target">
                <label>
                  Budget currency
                  <select
                    aria-label="Budget currency"
                    value={prefs.data.currency}
                    disabled={!canEditPrefs}
                    onChange={(e) =>
                      void prefs.commit((c) => ({
                        ...c,
                        currency: e.target.value,
                        budget: null,
                      }))
                    }
                  >
                    {["USD", "CAD", "AUD", "EUR", "GBP"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={!canEditPrefs}
                  onClick={() => {
                    setBudgetText(
                      prefs.data.budget === null
                        ? ""
                        : String(
                            prefs.data.budget /
                              10 ** currencyDigits(prefs.data.currency),
                          ),
                    );
                    setEditingBudget(true);
                  }}
                >
                  {prefs.data.budget === null
                    ? "+ Set a budget target"
                    : `Target ${formatMinor(prefs.data.budget, prefs.data.currency)} · Edit`}
                </button>
                {balance !== null && (
                  <>
                    <meter
                      min={0}
                      max={Math.max(1, prefs.data.budget!)}
                      value={subtotal}
                      aria-label="Known priced parts against target budget"
                    />
                    <small className={balance < 0 ? "wb-over-budget" : ""}>
                      {formatMinor(Math.abs(balance), prefs.data.currency)}{" "}
                      {balance < 0 ? "over target" : "remaining before extras"}
                    </small>
                  </>
                )}
                <small>
                  Applies to {prefs.data.currency} only. Changing currency
                  clears the target.
                </small>
              </div>
            )}
            <p>
              Shipping & tax added by retailers.
              <br />
              Different currencies stay separate.
            </p>
            <button
              className="wb-next"
              onClick={() =>
                next
                  ? browse(
                      next.id,
                      next.id === "mounting" ? prefs.data.mounting : "all",
                    )
                  : browse("other")
              }
            >
              {next
                ? `Next: ${next.name.toLowerCase()}`
                : "Explore finishing touches"}
              <ArrowRight size={16} />
            </button>
            <small>Selection progress is not a compatibility check.</small>
          </div>
          {prefs.error && (
            <p role="alert">
              {prefs.error}{" "}
              <button onClick={() => prefs.dismissError()}>Dismiss</button>
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
