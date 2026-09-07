"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BatteryCharging,
  Bell,
  Box,
  CheckCircle2,
  ExternalLink,
  PackagePlus,
  ShieldCheck,
  SunMedium,
  Tags,
  Zap,
} from "lucide-react";
import { ProductSectionNav } from "./solar-part-picker";

type ProductOffer = {
  id: string;
  retailer: string;
  source_url: string;
  price: number | string;
  original_price?: number | string;
  shipping?: number | string;
  currency: string;
  in_stock: boolean;
  availability_text?: string;
  condition: string;
  last_observed_at: string;
};

type HistoryPoint = { date: string; retailer_id: string; retailer: string; price: number | string };

type ProductDetail = {
  id: string;
  slug?: string;
  name: string;
  brand?: string;
  model?: string;
  category: string;
  description?: string;
  watts?: number | string;
  capacity_wh?: number | string;
  voltage?: number | string;
  picker_category?: string;
  picker_subcategory?: string;
  taxonomy_confidence?: number | string;
  taxonomy_source?: string;
  specifications?: Record<string, string | number | null>;
  current_image_url?: string;
  current_price?: number | string;
  historical_low?: number | string;
  historical_high?: number | string;
  retailer_count?: number | string;
  last_observed_at?: string;
  offers: ProductOffer[];
  history: HistoryPoint[];
};

const fallback: ProductDetail = {
  id: "demo-product",
  name: "Catalog product",
  brand: "Solar4U catalog",
  category: "other",
  description: "Product details will appear after the catalog worker imports or observes this item.",
  offers: [],
  history: [],
};

function ProductGlyph({ category }: { category: string }) {
  if (category === "panel") return <SunMedium aria-hidden="true" />;
  if (category === "battery") return <BatteryCharging aria-hidden="true" />;
  if (category === "inverter" || category === "power_station") return <Zap aria-hidden="true" />;
  if (category === "electrical_protection") return <ShieldCheck aria-hidden="true" />;
  return <Box aria-hidden="true" />;
}

function PriceHistoryChart({ history }: { history: HistoryPoint[] }) {
  const retailers = Array.from(new Set(history.map(point => point.retailer)));
  const dates = Array.from(new Set(history.map(point => point.date))).sort();
  const prices = history.map(point => Number(point.price)).filter(Number.isFinite);
  if (dates.length < 2 || !prices.length) {
    return <div className="product-history-empty">Daily price observations will build this chart as the worker runs.</div>;
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(1, max - min);
  const colors = ["#315c8c", "#caa45a", "#b66c43", "#769877", "#8f6ba6", "#a84f4a"];
  const point = (date: string, price: number) => {
    const x = 44 + (dates.indexOf(date) / Math.max(1, dates.length - 1)) * 806;
    const y = 210 - ((price - min) / range) * 165;
    return [x, y];
  };
  return (
    <div className="product-history-chart">
      <div className="product-history-legend">
        {retailers.map((retailer, index) => <span key={retailer}><i style={{ background: colors[index % colors.length] }} />{retailer}</span>)}
      </div>
      <svg viewBox="0 0 880 245" role="img" aria-label="Retailer price history">
        {[0, 1, 2, 3].map(index => {
          const y = 45 + index * 55;
          return <line key={index} x1="44" x2="850" y1={y} y2={y} className="history-grid-line" />;
        })}
        {retailers.map((retailer, retailerIndex) => {
          const retailerPoints = history.filter(item => item.retailer === retailer).sort((a, b) => a.date.localeCompare(b.date));
          const points = retailerPoints.map(item => point(item.date, Number(item.price)).join(",")).join(" ");
          return <polyline key={retailer} points={points} fill="none" stroke={colors[retailerIndex % colors.length]} strokeWidth="3" vectorEffect="non-scaling-stroke" />;
        })}
        <text x="4" y="48">${max.toFixed(0)}</text>
        <text x="4" y="213">${min.toFixed(0)}</text>
        <text x="44" y="235">{dates[0]}</text>
        <text x="850" y="235" textAnchor="end">{dates.at(-1)}</text>
      </svg>
    </div>
  );
}

export default function ProductDetailPage({ productId, returnTo = "/catalog" }: { productId: string; returnTo?: string }) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [added, setAdded] = useState(false);
  const [historyRange, setHistoryRange] = useState<"30d" | "120d" | "1y" | "2y">("120d");
  const [categoryVote, setCategoryVote] = useState("");
  const [voteStatus, setVoteStatus] = useState("");

  useEffect(() => {
    fetch(`http://localhost:4000/v1/products/${encodeURIComponent(productId)}`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => setProduct(payload.data))
      .catch(() => setProduct({ ...fallback, id: productId }))
      .finally(() => setLoading(false));
  }, [productId]);

  const current = product || fallback;
  const specifications = useMemo(() => {
    const raw = current.specifications || {};
    const panelRows = current.picker_category === "generation" ? [
      ["Module type", raw.moduleType || current.picker_subcategory || "Not published by retailer"],
      ["Cell technology", raw.cellTechnology || "Not published by retailer"],
      ["Dimensions", raw.dimensionsIn || (raw.lengthMm && raw.widthMm ? `${raw.lengthMm} × ${raw.widthMm}${raw.thicknessMm ? ` × ${raw.thicknessMm}` : ""} mm` : "Not published by retailer")],
      ["Open-circuit voltage (Voc)", raw.voc ? `${raw.voc} V` : "Not published by retailer"],
      ["Maximum-power voltage (Vmp)", raw.vmp ? `${raw.vmp} V` : "Not published by retailer"],
      ["Short-circuit current (Isc)", raw.isc ? `${raw.isc} A` : "Not published by retailer"],
      ["Maximum-power current (Imp)", raw.imp ? `${raw.imp} A` : "Not published by retailer"],
      ["Module efficiency", raw.efficiencyPercent ? `${raw.efficiencyPercent}%` : "Not published by retailer"],
      ["Maximum system voltage", raw.maxSystemVoltage ? `${raw.maxSystemVoltage} V` : "Not published by retailer"],
    ] : [];
    const requiredKeys = new Set(["moduleType","cellTechnology","dimensionsIn","lengthMm","widthMm","thicknessMm","voc","vmp","isc","imp","efficiencyPercent","maxSystemVoltage"]);
    return [
    ["Brand", current.brand],
    ["Model", current.model],
    ["Category", current.picker_subcategory || current.category],
    ["Rated power", current.watts ? `${Number(current.watts).toLocaleString()} W` : null],
    ["Capacity", current.capacity_wh ? `${(Number(current.capacity_wh) / 1000).toFixed(2)} kWh` : null],
    ["Nominal voltage", current.voltage ? `${current.voltage} V` : null],
    ...panelRows,
    ...Object.entries(raw).filter(([key]) => !requiredKeys.has(key)).map(([key, value]) => [key.replace(/([A-Z])/g, " $1"), value] as [string, unknown]),
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  }, [current]);

  const visibleHistory = useMemo(() => {
    if (!current.history.length) return [];
    const newest = Math.max(...current.history.map(point => new Date(point.date).getTime()));
    const days = historyRange === "30d" ? 30 : historyRange === "120d" ? 120 : historyRange === "1y" ? 365 : 730;
    const cutoff = newest - days * 86400000;
    return current.history.filter(point => new Date(point.date).getTime() >= cutoff);
  }, [current.history, historyRange]);

  const addToBuild = () => {
    window.localStorage.setItem("solar4u-part-picker-pending", JSON.stringify({
      id: current.id,
      category: current.picker_category,
    }));
    setAdded(true);
  };

  const submitCategoryVote = async () => {
    if (!categoryVote) return;
    setVoteStatus("Saving…");
    const response = await fetch(`http://localhost:4000/v1/products/${encodeURIComponent(current.id)}/classification-votes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pickerCategory: categoryVote }),
    });
    setVoteStatus(response.ok ? "Thanks — queued for catalog review." : "Could not save that confirmation.");
  };

  return (
    <main className="product-detail-page">
      <ProductSectionNav active="catalog" />
      <div className="product-detail-breadcrumb">
        <Link href={returnTo}><ArrowLeft size={15} aria-hidden="true" /> {returnTo.startsWith("/solar-part-picker") ? "Back to Solar Part Picker" : "Catalog List"}</Link>
        <span>/</span><span>{current.brand || "Product"}</span><span>/</span><b>{current.name}</b>
      </div>
      <header className="product-detail-header">
        <div>
          <div className="eyebrow">{current.picker_subcategory || current.category}</div>
          <h1>{loading ? "Loading product…" : current.name}</h1>
          <p>{current.brand}{current.model ? ` · ${current.model}` : ""}</p>
        </div>
        <div className="product-detail-price">
          <small>Best current price</small>
          <b>{current.current_price ? `$${Number(current.current_price).toLocaleString()}` : "No live offer"}</b>
          <span>{Number(current.retailer_count || current.offers.length)} tracked retailer{Number(current.retailer_count || current.offers.length) === 1 ? "" : "s"}</span>
        </div>
      </header>

      <div className="product-detail-tabs" role="tablist">
        <button className={activeTab === "details" ? "active" : ""} onClick={() => setActiveTab("details")} role="tab">Details & prices</button>
        <button className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")} role="tab">Price history</button>
      </div>

      <div className="product-detail-layout">
        <aside className="product-detail-sidebar">
          <div className="product-detail-image">
            {current.current_image_url
              // The catalog contains retailer-hosted URLs from many domains, so a fixed Next Image allow-list is not viable locally.
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={current.current_image_url} alt={current.name} loading="lazy" referrerPolicy="no-referrer" />
              : <div><ProductGlyph category={current.category} /><span>Catalog image unavailable</span></div>}
          </div>
          <div className="product-detail-actions">
            <button className="primary-button" onClick={addToBuild}><PackagePlus size={17} /> {added ? "Ready in Part Picker" : "Add to PV build"}</button>
            {added && <Link href="/solar-part-picker">Open Solar Part Picker →</Link>}
            <button className="secondary-button"><Bell size={16} /> Set price alert</button>
          </div>
          <div className="product-detail-range">
            <span><small>Historical low</small><b>{current.historical_low ? `$${Number(current.historical_low).toLocaleString()}` : "—"}</b></span>
            <span><small>Historical high</small><b>{current.historical_high ? `$${Number(current.historical_high).toLocaleString()}` : "—"}</b></span>
          </div>
        </aside>

        <section className="product-detail-content">
          {activeTab === "details" ? (
            <>
              <section className="product-offers-panel">
                <div className="product-detail-section-title"><div><div className="eyebrow">CURRENT OFFERS</div><h2>Prices</h2></div><small>Sorted by delivered price when shipping is known</small></div>
                <div className="product-offers-table">
                  <div className="product-offer-head"><span>Merchant</span><span>Base</span><span>Shipping</span><span>Condition</span><span>Availability</span><span>Total</span><span /></div>
                  {current.offers.map(offer => {
                    const price = Number(offer.price);
                    const shipping = Number(offer.shipping || 0);
                    return (
                      <div className="product-offer-row" key={offer.id}>
                        <b>{offer.retailer}</b>
                        <span>${price.toLocaleString()}</span>
                        <span>{offer.shipping === null || offer.shipping === undefined ? "Check store" : shipping === 0 ? "Free" : `$${shipping.toLocaleString()}`}</span>
                        <span>{offer.condition}</span>
                        <span className={offer.in_stock ? "in-stock" : "out-stock"}>{offer.in_stock ? <CheckCircle2 size={14} /> : null}{offer.in_stock ? "In stock" : "Unavailable"}</span>
                        <b>${(price + shipping).toLocaleString()}</b>
                        <a href={offer.source_url} target="_blank" rel="noopener noreferrer">Buy <ExternalLink size={13} /></a>
                      </div>
                    );
                  })}
                  {!current.offers.length && <div className="product-offers-empty">No current retailer offer has been observed yet.</div>}
                </div>
              </section>
              <section className="product-spec-panel">
                <div className="product-detail-section-title"><div><div className="eyebrow">NORMALIZED CATALOG</div><h2>Specifications</h2></div></div>
                <p>{current.description || "Description pending the next catalog observation."}</p>
                <dl>{specifications.map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{String(value)}</dd></div>)}</dl>
              </section>
              <section className="product-category-review">
                <div><Tags size={18} /><span><b>Help verify this product</b><small>Automatic category: {current.picker_category?.replaceAll("_", " ") || "needs review"} · {Math.round(Number(current.taxonomy_confidence || 0) * 100)}% confidence</small></span></div>
                <div><select aria-label="Confirm product category" value={categoryVote} onChange={event => setCategoryVote(event.target.value)}><option value="">Choose the best category…</option><option value="generation">Solar Generation</option><option value="inverters">Inverters & Power Stations</option><option value="controllers">Charge Controllers</option><option value="storage">Energy Storage</option><option value="protection">Electrical Protection</option><option value="wiring">Wiring & Terminations</option><option value="mounting">Mounting & Racking</option><option value="monitoring">Monitoring & Communications</option><option value="tools">Tools & PPE</option></select><button className="secondary-button" onClick={submitCategoryVote} disabled={!categoryVote}>Submit confirmation</button></div>
                {voteStatus && <p>{voteStatus}</p>}
              </section>
            </>
          ) : (
            <section className="product-history-panel">
              <div className="product-detail-section-title"><div><div className="eyebrow">DAILY OBSERVATIONS</div><h2>Price history</h2></div><div className="product-history-controls"><small>{visibleHistory.length} retailer-day records</small><label>History<select value={historyRange} onChange={event => setHistoryRange(event.target.value as typeof historyRange)}><option value="30d">30 days</option><option value="120d">120 days</option><option value="1y">1 year</option><option value="2y">2 years</option></select></label></div></div>
              <PriceHistoryChart history={visibleHistory} />
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
