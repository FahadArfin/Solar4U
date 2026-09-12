"use client";

import Link from "next/link";

import BuilderWorkbench from "./builder-workbench";

import { replaceBuildOffer } from "../lib/builder";

import { useEffect, useMemo, useRef, useState } from "react";

import { flushSync } from "react-dom";

import {
  Sun,
  Layers3,
  Box,
  Cable,
  Zap,
  Battery,
  Package,
  Plus,
  Search,
  ArrowUpRight,
  Scale,
  Check,
  ClipboardList,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

import {
  shoppingGroups,
  classifyOffer,
  type ShoppingGroup,
  type Classification,
} from "../services/price-worker/classification.mjs";

import {
  EQUIPMENT_KEY,
  emptyEquipment,
  validateEquipment,
  equipmentTotals,
  formatMinor,
  currencyDigits,
  addOffer,
  type EquipmentItem,
  type RetailOffer,
} from "../lib/equipment";

import { useDeviceDocument } from "../lib/device-store";

import { objectInput, useAgentTools } from "./webmcp";

type Choice = RetailOffer & { classification: Classification };

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

const groupName = (id: string) =>
  shoppingGroups.find((g) => g.id === id)?.name ?? "Other equipment";

const subName = (c: Classification) =>
  shoppingGroups

    .find((g) => g.id === c.group)

    ?.subtypes.find(([id]) => id === c.subtype)?.[1] ?? "Unspecified";

const stock = (a: boolean | null) =>
  a === null ? "Stock unknown" : a ? "In stock" : "Out of stock";

function itemGroup(item: EquipmentItem): ShoppingGroup {
  const c = classifyOffer({ name: item.name, variant: item.source?.variant });

  if (shoppingGroups.find((g) => g.id === c.group)?.category === item.category)
    return c.group;

  return (
    shoppingGroups.find(
      (g) => g.category === item.category && g.id !== "bundles",
    )?.id ?? (item.category === "Controller" ? "inverters" : "other")
  );
}

function unitWatts(o: Choice) {
  const s = o.classification.specs;

  return s.watts !== null && s.packCount !== null && s.packCount > 0
    ? s.watts * s.packCount
    : null;
}

function specText(o: Choice) {
  const s = o.classification.specs;

  return (
    [
      s.watts === null ? null : `${s.watts} W module`,

      s.powerW === null ? null : `${s.powerW} W mentioned`,

      s.nominalVoltage === null ? null : `${s.nominalVoltage} V mentioned`,

      s.energyKwh === null ? null : `${s.energyKwh} kWh mentioned`,

      s.capacityAh === null ? null : `${s.capacityAh} Ah`,

      s.currentA === null ? null : `${s.currentA} A mentioned`,

      s.crossSectionMm2 === null ? null : `${s.crossSectionMm2} mm²`,

      s.lengthM === null ? null : `${Number(s.lengthM.toFixed(3))} m`,
    ]

      .filter(Boolean)

      .join(" · ") || "Technical values not identified in the title"
  );
}

export default function SolarBuilder() {
  const store = useDeviceDocument(
      EQUIPMENT_KEY,

      emptyEquipment,

      validateEquipment,
    ),
    [view, setView] = useState<"build" | "browse" | "compare">("build"),
    [group, setGroup] = useState<ShoppingGroup>("panels"),
    [subtype, setSubtype] = useState("all"),
    [query, setQuery] = useState(""),
    [retailer, setRetailer] = useState("all"),
    [currency, setCurrency] = useState("USD"),
    [stockFilter, setStockFilter] = useState("all"),
    [voltage, setVoltage] = useState("all"),
    [condition, setCondition] = useState("all"),
    [sort, setSort] = useState("price"),
    [minWatts, setMinWatts] = useState(""),
    [maxPrice, setMaxPrice] = useState("");

  const [offers, setOffers] = useState<Choice[]>([]),
    [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [generatedAt, setGeneratedAt] = useState(""),
    [sources, setSources] = useState<
      { id: string; name: string; observations: number; status: string }[]
    >([]),
    [compare, setCompare] = useState<string[]>([]),
    [quantities, setQuantities] = useState<Record<string, string>>({}),
    [adding, setAdding] = useState(false),
    [shown, setShown] = useState(40);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const header = useRef<HTMLHeadingElement>(null);

  const buildHeader = useRef<HTMLHeadingElement>(null),
    compareHeader = useRef<HTMLHeadingElement>(null);

  function changeView(next: typeof view) {
    setView(next);

    if (next === "build") {
      setReplacing(null);
      history.replaceState(null, "", "/solar-part-picker");
    }

    setTimeout(
      () =>
        (next === "build"
          ? buildHeader
          : next === "compare"
            ? compareHeader
            : header
        ).current?.focus(),

      0,
    );
  }

  const [replacing, setReplacing] = useState<EquipmentItem | null>(null);

  const [removed, setRemoved] = useState<EquipmentItem | null>(null);

  useEffect(() => {
    const c = new AbortController();

    const t = setTimeout(() => {
      const q = new URLSearchParams(location.search),
        g = q.get("group");

      if (shoppingGroups.some((v) => v.id === g)) {
        setGroup(g as ShoppingGroup);

        setView("browse");
      }

      if (q.get("q")) setQuery(q.get("q")!.slice(0, 200));

      void load(c.signal);
    }, 0);

    return () => {
      clearTimeout(t);

      c.abort();
    };
  }, []);

  async function load(signal?: AbortSignal) {
    setLoading(true);

    setError("");

    try {
      const r = await fetch("/api/prices", { signal }),
        j = await r.json();

      if (!r.ok)
        throw new Error(j.error ?? "Retailer observations unavailable");

      const accepted: Choice[] = [];

      for (const o of j.offers) {
        try {
          addOffer(emptyEquipment, o);

          accepted.push({ ...o, classification: classifyOffer(o) });
        } catch {}
      }

      if (signal?.aborted) return;

      setOffers(accepted);

      setGeneratedAt(j.generatedAt);

      setSources(j.sources);

      setLoaded(true);
    } catch (e) {
      if (!signal?.aborted)
        setError(e instanceof Error ? e.message : "Could not load offers");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  function chooseGroup(id: ShoppingGroup, sub = "all") {
    setReplacing(null);

    resetFilters();

    setGroup(id);

    setSubtype(sub);

    setShown(40);

    setVoltage("all");

    setMinWatts("");

    setView("browse");

    setMessage("");

    history.replaceState(null, "", `/solar-part-picker?group=${id}`);

    setTimeout(() => header.current?.focus(), 0);
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    return offers

      .filter((o) => {
        const c = o.classification,
          s = c.specs;

        return (
          c.group === group &&
          (subtype === "all" || c.subtype === subtype) &&
          o.currency === currency &&
          (retailer === "all" || o.retailerId === retailer) &&
          (stockFilter === "all" ||
            (stockFilter === "in"
              ? o.available === true
              : o.available === null)) &&
          (condition === "all" || s.condition === condition) &&
          (voltage === "all" || s.voltageClass === voltage) &&
          (!q ||
            `${o.name} ${o.variant} ${o.sku} ${o.retailer}`

              .toLowerCase()

              .includes(q)) &&
          (!minWatts || (s.watts !== null && s.watts >= Number(minWatts))) &&
          (!maxPrice ||
            o.minorAmount / 10 ** currencyDigits(o.currency) <=
              Number(maxPrice))
        );
      })

      .sort((a, b) =>
        sort === "price"
          ? a.minorAmount - b.minorAmount
          : sort === "price-desc"
            ? b.minorAmount - a.minorAmount
            : sort === "name"
              ? a.name.localeCompare(b.name)
              : sort === "newest"
                ? b.observedAt.localeCompare(a.observedAt)
                : (unitWatts(a) ? a.minorAmount / unitWatts(a)! : Infinity) -
                  (unitWatts(b) ? b.minorAmount / unitWatts(b)! : Infinity),
      );
  }, [
    offers,

    group,

    subtype,

    currency,

    retailer,

    stockFilter,

    condition,

    voltage,

    query,

    minWatts,

    maxPrice,

    sort,
  ]);

  const activeGroup = shoppingGroups.find((g) => g.id === group)!,
    totals = equipmentTotals(store.data.items),
    comparison = compare

      .map((id) => offers.find((o) => o.id === id))

      .filter((o): o is Choice => !!o),
    inBuild = new Set(
      store.data.items.flatMap((i) => (i.source ? [i.source.offerId] : [])),
    );

  const retailers = [
    ...new Map(
      offers

        .filter((o) => o.classification.group === group)

        .map((o) => [o.retailerId, { id: o.retailerId, name: o.retailer }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  async function addSelection(
    offer: Choice,
    quantity?: number,
    replacement?: EquipmentItem | null,
  ) {
    const n = quantity ?? Number(quantities[offer.id] ?? 1);

    if (!Number.isInteger(n) || n < 1 || n > 10000) {
      setMessage(
        "Choose a whole quantity from 1 to 10,000. Quantities count purchased variants or packages.",
      );

      return false;
    }

    setAdding(true);

    try {
      const category =
        offer.classification.subtype === "controller"
          ? "Controller"
          : shoppingGroups.find((g) => g.id === offer.classification.group)!
              .category;

      const saved = await store.commit((c) => {
        if (replacement)
          return replaceBuildOffer(c, replacement, { ...offer, category }, n);

        const next = addOffer(c, { ...offer, category }),
          line = next.items.find(
            (i) =>
              i.source?.offerId === offer.id &&
              i.currency === offer.currency &&
              i.unitMinorAmount === offer.minorAmount &&
              Date.parse(i.source.observedAt) === Date.parse(offer.observedAt),
          );

        if (!line) throw new Error("Could not identify the selected snapshot");

        line.quantity += n - 1;

        return validateEquipment(next);
      });

      if (saved)
        setMessage(
          `Added ${n} × ${offer.name}. Saved in your build on this device.`,
        );

      return saved;
    } finally {
      setAdding(false);
    }
  }

  async function pickSelection(offer: Choice, quantity?: number) {
    if (await addSelection(offer, quantity, replacing)) changeView("build");
  }

  function toggleCompare(id: string) {
    if (compare.includes(id)) {
      setCompare(compare.filter((v) => v !== id));

      if (view === "compare")
        setTimeout(() => compareHeader.current?.focus(), 0);
    } else if (compare.length < 4) setCompare([...compare, id]);
    else
      setMessage(
        "Compare up to four offers at once. Remove one to add another.",
      );
  }

  async function removeItem(id: string) {
    let snapshot: EquipmentItem | undefined;

    const saved = await store.commit((c) => {
      snapshot = c.items.find((i) => i.id === id);

      if (!snapshot)
        throw new Error("This item was already removed in another tab.");

      return { ...c, items: c.items.filter((i) => i.id !== id) };
    });

    if (saved && snapshot) {
      setRemoved(snapshot);

      setMessage(`Removed ${snapshot.name}. You can undo this removal.`);
    }
  }

  async function undoRemove() {
    if (!removed) return;

    const saved = await store.commit((c) => {
      if (c.items.some((i) => i.id === removed.id))
        throw new Error("This item is already in your build.");

      return { ...c, items: [...c.items, removed] };
    });

    if (saved) {
      setRemoved(null);

      setMessage(
        "Restored the item with its original price, quantity and notes.",
      );
    }
  }

  function resetFilters() {
    setQuery("");

    setRetailer("all");

    setStockFilter("all");

    setVoltage("all");

    setCondition("all");

    setMinWatts("");

    setMaxPrice("");

    setSubtype("all");

    setSort("price");

    setShown(40);
  }

  useAgentTools([
    {
      name: "solar4u_set_build_quantity",

      description:
        "Set the whole purchased quantity of an existing build row, using the same device-local saving as the visible quantity field. Does not purchase equipment.",

      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          quantity: { type: "integer", minimum: 1, maximum: 10000 },
        },
        required: ["itemId", "quantity"],
        additionalProperties: false,
      },

      annotations: { readOnlyHint: false },

      execute: async (input) => {
        const o = objectInput(input);

        if (
          typeof o.itemId !== "string" ||
          !Number.isInteger(o.quantity) ||
          Number(o.quantity) < 1 ||
          Number(o.quantity) > 10000
        )
          throw new Error(
            "Choose an existing item and a whole quantity from 1 to 10,000",
          );

        const saved = await store.commit((c) => {
          if (!c.items.some((i) => i.id === o.itemId))
            throw new Error("That item is no longer in this build");

          return {
            ...c,
            items: c.items.map((i) =>
              i.id === o.itemId ? { ...i, quantity: Number(o.quantity) } : i,
            ),
          };
        });

        return { saved, itemId: o.itemId, quantity: o.quantity };
      },
    },

    {
      name: "solar4u_read_solar_build",

      description:
        "Read this browser’s selected equipment grouped into solar component slots, separate currency subtotals, and missing compatibility evidence. No purchases are made.",

      inputSchema: {
        type: "object",

        properties: {},

        additionalProperties: false,
      },

      annotations: { readOnlyHint: true, untrustedContentHint: true },

      execute: async () => ({
        ready: store.ready,

        name: store.data.name,

        groups: shoppingGroups.map((g) => ({
          id: g.id,

          name: g.name,

          items: store.data.items.filter((i) => itemGroup(i) === g.id),
        })),

        totals,

        shipping: "Unknown; retailer checkout or freight quote required",

        tax: "Not estimated",

        compatibility: "Not verified; manufacturer and site data required",

        status: store.status,

        error: store.error,
      }),
    },

    {
      name: "solar4u_browse_component_slot",

      description:
        "Open a solar component category and optionally search within its observed retailer offers. Category and specification clues come from titles and need verification.",

      inputSchema: {
        type: "object",

        properties: {
          group: { type: "string", enum: shoppingGroups.map((g) => g.id) },

          query: { type: "string", maxLength: 200 },
        },

        required: ["group"],

        additionalProperties: false,
      },

      annotations: { readOnlyHint: false },

      execute: async (input) => {
        const o = objectInput(input);

        if (
          !shoppingGroups.some((g) => g.id === o.group) ||
          (o.query !== undefined &&
            (typeof o.query !== "string" || o.query.length > 200))
        )
          throw new Error("Unknown group or invalid search");

        flushSync(() => {
          resetFilters();

          chooseGroup(o.group as ShoppingGroup);

          setQuery(String(o.query ?? ""));
        });

        return {
          group: o.group,

          availableOffers: offers.filter(
            (v) => v.classification.group === o.group,
          ).length,
        };
      },
    },

    {
      name: "solar4u_read_component_offers",

      description:
        "Read current filtered shopping results with exact variant, price, stock and title-derived classification. Shipping, compatibility and cross-retailer product equivalence are not verified.",

      inputSchema: {
        type: "object",

        properties: {},

        additionalProperties: false,
      },

      annotations: { readOnlyHint: true, untrustedContentHint: true },

      execute: async () => ({
        generatedAt,

        group,

        matching: filtered.length,

        offers: filtered.slice(0, 50),

        error,
      }),
    },

    {
      name: "solar4u_add_component_to_build",

      description:
        "Add an exact loaded retailer offer and a whole purchase quantity to the device-local solar build. Does not buy equipment or certify compatibility.",

      inputSchema: {
        type: "object",

        properties: {
          offerId: { type: "string" },

          quantity: { type: "integer", minimum: 1, maximum: 10000 },
        },

        required: ["offerId", "quantity"],

        additionalProperties: false,
      },

      annotations: { readOnlyHint: false },

      execute: async (input) => {
        const o = objectInput(input),
          offer = offers.find((v) => v.id === o.offerId);

        if (
          !offer ||
          !Number.isInteger(o.quantity) ||
          Number(o.quantity) < 1 ||
          Number(o.quantity) > 10000
        )
          throw new Error("Choose a loaded offer and a whole quantity");

        return {
          saved: await addSelection(offer, Number(o.quantity)),

          offerId: offer.id,

          quantity: o.quantity,
        };
      },
    },
  ]);

  const browseRows = filtered.slice(0, shown);

  return (
    <main className="s4-builder">
      <header className="s4-build-heading">
        <div>
          <div className="s4-kicker">
            <Layers3 size={15} /> BUILD YOUR SOLAR SYSTEM
          </div>

          <h1>
            Build your own <em>sunshine.</em>
          </h1>

          <p>Pick your parts. Find your price. Make it yours.</p>
        </div>

        <Link className="s4-button s4-light" href="/equipment">
          <ClipboardList size={16} /> Equipment notebook{" "}
          <ArrowUpRight size={16} />
        </Link>
      </header>

      <nav className="s4-builder-tabs" aria-label="Solar builder views">
        {[
          ["build", `Your build (${store.data.items.length})`],

          ["browse", "Browse components"],

          ["compare", `Compare offers (${compare.length})`],
        ].map(([id, name]) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => changeView(id as typeof view)}
          >
            {name}
          </button>
        ))}

        <span role="status">{store.status}</span>
      </nav>

      {error && (
        <div role="alert" className="s4-banner">
          {error} <button onClick={() => void load()}>Refresh prices</button>
        </div>
      )}

      {store.error && (
        <div role="alert" className="s4-banner">
          {store.error}{" "}
          {store.needsRecovery ? (
            <Link href="/equipment">Open notebook recovery →</Link>
          ) : (
            <button onClick={() => store.dismissError()}>
              Dismiss — then reapply your edit
            </button>
          )}
        </div>
      )}

      {message && (
        <p className="s4-builder-message" role="status">
          {message}{" "}
          <button aria-label="Dismiss update" onClick={() => setMessage("")}>
            ×
          </button>
        </p>
      )}

      {removed && (
        <p className="s4-builder-message">
          <span>Removed: {removed.name}</span>

          <button onClick={() => void undoRemove()}>Undo removal</button>
        </p>
      )}

      {replacing && (
        <div className="s4-builder-message" role="status">
          <span>
            <b>Replacing: {replacing.name}</b>
            <br />
            Current quantity: {replacing.quantity}. Choose the purchase quantity
            for your new variant; package sizes may differ. The original stays
            until you select a replacement.
          </span>
          <button onClick={() => setReplacing(null)}>Cancel replacement</button>
        </div>
      )}

      {view === "build" ? (
        <BuilderWorkbench
          data={store.data}
          ready={store.ready && !store.needsRecovery}
          header={buildHeader}
          itemGroup={itemGroup}
          browse={chooseGroup}
          commit={store.commit}
          remove={(id) => void removeItem(id)}
          replace={(item) => {
            chooseGroup(itemGroup(item));
            setReplacing(item);
          }}
        />
      ) : view === "browse" ? (
        <section>
          <div
            className="s4-builder-category-strip"
            aria-label="Component categories"
          >
            {shoppingGroups.map((g) => {
              const Icon = icons[g.id];

              return (
                <button
                  key={g.id}
                  aria-pressed={group === g.id}
                  onClick={() => chooseGroup(g.id)}
                >
                  <Icon size={18} />

                  {g.name}

                  <small>
                    {loaded
                      ? offers.filter((o) => o.classification.group === g.id)
                          .length
                      : "—"}
                  </small>
                </button>
              );
            })}
          </div>

          <div className="s4-build-section-title">
            <div>
              <h2 ref={header} tabIndex={-1}>
                {activeGroup.name}
              </h2>

              <p>{activeGroup.description}</p>
            </div>

            <button onClick={() => changeView("build")}>
              <ArrowLeft size={15} /> Return to build
            </button>
          </div>

          <div className="s4-builder-subtypes">
            {[["all", "All types"], ...activeGroup.subtypes].map(
              ([id, label]) => (
                <button
                  key={id}
                  aria-pressed={subtype === id}
                  onClick={() => {
                    setSubtype(id);

                    setShown(40);
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <div className="wb-browse-budget">
            <span>
              <b>{store.data.items.length} selected parts</b> ·{" "}
              {formatMinor(totals[currency]?.minorAmount ?? 0, currency)}{" "}
              {currency} saved subtotal
            </span>
            <button onClick={() => changeView("build")}>
              Your build <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="s4-shopping-layout">
            <aside className="s4-shopping-filters">
              <button
                className="wb-filter-toggle"
                aria-expanded={filtersOpen}
                aria-controls="builder-filters"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <Search size={15} /> Search & filters {filtersOpen ? "-" : "+"}
              </button>
              <div
                id="builder-filters"
                className="wb-filter-body"
                data-open={filtersOpen}
              >
                <h3>Find the right fit</h3>

                <label>
                  <Search size={14} /> Search this category
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);

                      setShown(40);
                    }}
                    maxLength={200}
                    placeholder="Model, SKU or a useful detail"
                  />
                </label>

                <label>
                  Retailer
                  <select
                    value={retailer}
                    onChange={(e) => setRetailer(e.target.value)}
                  >
                    <option value="all">All retailers</option>

                    {retailers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Currency
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {[...new Set(["USD", ...offers.map((o) => o.currency)])]

                      .sort()

                      .map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                  </select>
                </label>

                <label>
                  Availability
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                  >
                    <option value="all">Any availability</option>

                    <option value="in">In stock only</option>

                    <option value="unknown">Stock unknown</option>
                  </select>
                </label>

                <label>
                  Condition in title
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                  >
                    <option value="all">Any / unspecified</option>

                    <option value="new">Explicitly new</option>

                    <option value="used">Used</option>

                    <option value="refurbished">Refurbished</option>

                    <option value="unknown">Unspecified</option>
                  </select>
                </label>

                {group === "batteries" && (
                  <label>
                    Battery voltage class
                    <select
                      value={voltage}
                      onChange={(e) => setVoltage(e.target.value)}
                    >
                      <option value="all">All voltage classes</option>

                      <option value="low">Low / typical ≤60 V class</option>

                      <option value="high">High / above 60 V class</option>

                      <option value="unknown">Not identified</option>
                    </select>
                    <small>
                      Battery-system categories, not electrical safety
                      classifications. Check actual operating ranges.
                    </small>
                  </label>
                )}

                {group === "panels" && (
                  <label>
                    Minimum module watts
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={minWatts}
                      onChange={(e) => setMinWatts(e.target.value)}
                      placeholder="Any"
                    />
                    <small>
                      Excludes offers whose module wattage is unclear.
                    </small>
                  </label>
                )}

                <label>
                  Maximum listed price · {currency}
                  <input
                    type="number"
                    min={0}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Any"
                  />
                </label>

                <button onClick={resetFilters}>Reset filters</button>

                <p>
                  Types and technical clues are extracted from the product title
                  and selected variant. Confirm the datasheet, package contents
                  and ratings before choosing.
                </p>

                <Link href="/products">Review retailer coverage ↗</Link>
              </div>
            </aside>

            <div>
              <div className="s4-shopping-results">
                <span>
                  {loading
                    ? "Loading observations…"
                    : `${filtered.length.toLocaleString()} matching offers`}
                </span>

                <label>
                  Sort
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="price">Listed price · low to high</option>

                    <option value="price-desc">
                      Listed price · high to low
                    </option>

                    <option value="name">Product name · A to Z</option>

                    <option value="newest">Newest observation</option>

                    {group === "panels" && (
                      <option value="watts">Cost / stated package watts</option>
                    )}
                  </select>
                </label>

                <button
                  disabled={comparison.length < 2}
                  onClick={() => changeView("compare")}
                >
                  <Scale size={15} /> Compare ({compare.length})
                </button>
              </div>

              <p className="s4-shopping-provenance">
                {generatedAt
                  ? `Collection ${new Date(generatedAt).toLocaleString()} · ${sources.filter((s) => s.observations > 0).length}/${sources.length} sources with prices.`
                  : "Awaiting collection data."}{" "}
                Prices exclude tax and shipping. Lower-priced variants may
                differ in quantity, condition or included equipment.
              </p>

              <div className="s4-shopping-offers">
                {browseRows.map((o) => {
                  const c = o.classification,
                    skuPeers =
                      o.sku.length >= 4
                        ? offers.filter(
                            (v) =>
                              v.sku === o.sku &&
                              v.retailerId !== o.retailerId &&
                              v.classification.group === group &&
                              v.currency === currency,
                          ).length
                        : 0;

                  return (
                    <article key={o.id} className="s4-shopping-offer">
                      <label className="s4-compare-choice">
                        <input
                          type="checkbox"
                          checked={compare.includes(o.id)}
                          onChange={() => toggleCompare(o.id)}
                          aria-label={`Compare ${o.name}, ${o.variant}, from ${o.retailer}`}
                        />

                        <span>Compare</span>
                      </label>

                      <div className="s4-shopping-offer-main">
                        <div className="s4-kicker">
                          {subName(c)} · {o.retailer}
                        </div>

                        <h3>
                          <a href={o.url} target="_blank" rel="noreferrer">
                            {o.name}

                            <ArrowUpRight size={15} />
                          </a>
                        </h3>

                        <p>
                          {o.variant && o.variant !== "Default Title"
                            ? o.variant
                            : "Listed variant"}

                          {o.sku ? ` · SKU ${o.sku}` : ""}
                        </p>

                        <div className="s4-shopping-specs">{specText(o)}</div>

                        <small>{c.packageNote}</small>

                        {skuPeers > 0 && (
                          <button
                            className="s4-sku-link"
                            onClick={() => {
                              resetFilters();

                              setQuery(o.sku);

                              setRetailer("all");

                              setSubtype("all");
                            }}
                          >
                            {skuPeers} other retailer offer
                            {skuPeers === 1 ? "" : "s"} in this category and
                            currency share this SKU · verify variant ↗
                          </button>
                        )}
                      </div>

                      <div className="s4-shopping-price">
                        <strong>
                          {formatMinor(o.minorAmount, o.currency)}
                        </strong>

                        <span>{o.currency} / listed variant</span>

                        {unitWatts(o) !== null && (
                          <small>
                            {formatMinor(
                              Math.round(o.minorAmount / unitWatts(o)!),

                              o.currency,
                            )}{" "}
                            / stated W
                          </small>
                        )}

                        <span
                          className={o.available === true ? "s4-stock-in" : ""}
                        >
                          {stock(o.available)}
                        </span>

                        <small>
                          Observed {new Date(o.observedAt).toLocaleDateString()}
                        </small>

                        <label>
                          Purchase quantity
                          <input
                            type="number"
                            aria-label={`Purchase quantity for ${o.name}, ${o.variant}, from ${o.retailer}`}
                            min={1}
                            max={10000}
                            step={1}
                            value={quantities[o.id] ?? "1"}
                            onChange={(e) =>
                              setQuantities({
                                ...quantities,

                                [o.id]: e.target.value,
                              })
                            }
                          />
                        </label>

                        <button
                          className="s4-add-component"
                          aria-label={`${replacing ? "Replace with" : "Add"} ${o.name}, ${o.variant}, from ${o.retailer} to build`}
                          disabled={
                            adding || !store.ready || store.needsRecovery
                          }
                          onClick={() => void pickSelection(o)}
                        >
                          {inBuild.has(o.id) ? (
                            <Check size={15} />
                          ) : (
                            <Plus size={15} />
                          )}{" "}
                          {replacing
                            ? "Use this replacement"
                            : inBuild.has(o.id)
                              ? "Add another"
                              : "Add to build"}
                        </button>

                        {Number.isInteger(Number(quantities[o.id] ?? 1)) &&
                          Number(quantities[o.id] ?? 1) >= 1 &&
                          Number(quantities[o.id] ?? 1) <= 10000 && (
                            <small className="wb-offer-impact">
                              {formatMinor(
                                (totals[o.currency]?.minorAmount ?? 0) -
                                  (replacing?.currency === o.currency
                                    ? (replacing.unitMinorAmount ?? 0) *
                                      replacing.quantity
                                    : 0) +
                                  o.minorAmount * Number(quantities[o.id] ?? 1),
                                o.currency,
                              )}{" "}
                              {o.currency} build subtotal with this choice ·
                              excludes unpriced parts
                            </small>
                          )}

                        <a href={o.url} target="_blank" rel="noreferrer">
                          Shop retailer ↗
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>

              {!filtered.length && (
                <div className="s4-shopping-empty">
                  <Search size={30} />

                  <h3>
                    {loading
                      ? "Reading current observations…"
                      : "No matching observations yet"}
                  </h3>

                  <p>
                    {loaded
                      ? "This category or filter has no matching offer in the current bounded collection. Try wider filters, or record an unpriced/manual item while obtaining a retailer quote."
                      : "Retailer observations are not available yet. Your saved build remains on this device."}
                  </p>

                  <button onClick={resetFilters}>Clear filters</button>

                  <Link href="/equipment">Add a manual item ↗</Link>
                </div>
              )}

              {filtered.length > shown && (
                <button
                  className="s4-load-more"
                  onClick={() => setShown((s) => s + 40)}
                >
                  Show 40 more offers · {filtered.length - shown} remaining
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="s4-offer-comparison">
          <div className="s4-build-section-title">
            <div>
              <h2 ref={compareHeader} tabIndex={-1}>
                Compare the actual offers.
              </h2>

              <p>
                These are separate retailer variants. A shared SKU or similar
                name is a comparison clue, not verified product equivalence.
              </p>
            </div>

            <button onClick={() => changeView("browse")}>
              Back to components
            </button>
          </div>

          {comparison.length === 0 ? (
            <div className="s4-shopping-empty">
              <Scale size={35} />

              <h3>Select two to four offers.</h3>

              <p>Use the comparison checkboxes while browsing components.</p>

              <button onClick={() => changeView("browse")}>
                Browse components
              </button>
            </div>
          ) : (
            <div className="s4-comparison-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Details to compare</th>

                    {comparison.map((o) => (
                      <th key={o.id}>
                        <span>{o.retailer}</span>

                        <h3>{o.name}</h3>

                        <button
                          aria-label={`Remove ${o.name}, ${o.variant}, from ${o.retailer} from comparison`}
                          onClick={() => toggleCompare(o.id)}
                        >
                          Remove
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {[
                    [
                      "Exact variant",

                      (o: Choice) =>
                        o.variant === "Default Title"
                          ? "Listed variant"
                          : o.variant,
                    ],

                    [
                      "Observed price",

                      (o: Choice) => formatMinor(o.minorAmount, o.currency),
                    ],

                    ["Currency", (o: Choice) => o.currency],

                    [
                      "Observation date",

                      (o: Choice) => new Date(o.observedAt).toLocaleString(),
                    ],

                    ["Stock", (o: Choice) => stock(o.available)],

                    ["SKU", (o: Choice) => o.sku || "Not provided"],

                    [
                      "Component type",

                      (o: Choice) =>
                        `${groupName(o.classification.group)} · ${subName(o.classification)}`,
                    ],

                    ["Title / variant clues", (o: Choice) => specText(o)],

                    [
                      "Battery voltage class",

                      (o: Choice) => o.classification.specs.voltageClass,
                    ],

                    [
                      "Package context",

                      (o: Choice) => o.classification.packageNote,
                    ],

                    [
                      "Condition in title",

                      (o: Choice) => o.classification.specs.condition,
                    ],

                    ["Shipping / freight", () => "Not quoted"],

                    ["Compatibility", () => "Needs manufacturer and site data"],
                  ].map(([label, value]) => (
                    <tr key={String(label)}>
                      <th>{String(label)}</th>

                      {comparison.map((o) => (
                        <td key={o.id}>
                          {(value as (o: Choice) => string)(o)}
                        </td>
                      ))}
                    </tr>
                  ))}

                  <tr>
                    <th>Choose an offer</th>

                    {comparison.map((o) => (
                      <td key={o.id}>
                        <button
                          disabled={
                            adding || !store.ready || store.needsRecovery
                          }
                          onClick={() => void pickSelection(o, 1)}
                        >
                          {replacing
                            ? "Replace with one listed variant"
                            : "Add one listed variant"}
                        </button>

                        <a href={o.url} target="_blank" rel="noreferrer">
                          Check retailer listing ↗
                        </a>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {view === "browse" && compare.length > 0 && (
        <div
          className="wb-compare-tray"
          role="region"
          aria-label="Compare selected offers"
        >
          <span>
            <Scale size={17} /> {compare.length} of 4 offers selected
          </span>
          <button onClick={() => setCompare([])}>Clear</button>
          <button onClick={() => changeView("compare")}>
            Compare details <ArrowRight size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
