"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BatteryCharging,
  Boxes,
  Cable,
  CheckCircle2,
  Gauge,
  HardHat,
  PackageSearch,
  Plus,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  SunMedium,
  Tags,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";

type CategoryId =
  | "generation"
  | "inverters"
  | "controllers"
  | "storage"
  | "protection"
  | "wiring"
  | "mounting"
  | "monitoring"
  | "tools";

type PickerPart = {
  id: string;
  slug?: string;
  category: CategoryId;
  subcategory: string;
  maker: string;
  name: string;
  price: number;
  rating: number;
  reviews: number;
  stock: string;
  specs: [string, string, string];
  watts?: number;
  capacityWh?: number;
  systemVoltage?: number;
  pvInputVoltage?: number;
};

type BuildEntry = { part: PickerPart; quantity: number };
type PickerBuild = Partial<Record<CategoryId, BuildEntry[]>>;

const categoryDefinitions: Array<{
  id: CategoryId;
  name: string;
  short: string;
  subcategories: string[];
}> = [
  { id: "generation", name: "Solar Generation", short: "PV modules", subcategories: ["Monofacial", "Bifacial", "Flexible / semi-flexible"] },
  { id: "inverters", name: "Inverters & Power Stations", short: "AC power conversion", subcategories: ["Grid-tie / string", "Microinverter", "Hybrid", "Off-grid", "All-in-one power station"] },
  { id: "controllers", name: "Charge Controllers", short: "PV-to-battery regulation", subcategories: ["MPPT", "PWM"] },
  { id: "storage", name: "Energy Storage", short: "Batteries and DIY components", subcategories: ["Rack / wall battery", "High-voltage battery", "LiFePO4 cells", "BMS / balancer", "Battery hardware"] },
  { id: "protection", name: "Electrical Protection", short: "Balance of system", subcategories: ["Disconnect", "Fuse / breaker", "Combiner box", "Surge protection", "Grounding"] },
  { id: "wiring", name: "Wiring & Terminations", short: "Conductors and connectors", subcategories: ["PV wire", "Battery cable", "AC wire", "Connectors / terminals", "Weatherproofing"] },
  { id: "mounting", name: "Mounting & Racking", short: "Roof and ground structures", subcategories: ["Roof mount", "Ground mount", "Clamps / hardware"] },
  { id: "monitoring", name: "Monitoring & Communications", short: "Meters, shunts and gateways", subcategories: ["System gateway", "Battery shunt", "Home energy monitor", "Communications cable"] },
  { id: "tools", name: "Tools & PPE", short: "Install and commissioning kit", subcategories: ["Crimping", "Testing", "Safety / PPE", "Solar-specific tools"] },
];

const pickerParts: PickerPart[] = [
  { id:"panel-hyperion", category:"generation", subcategory:"Bifacial", maker:"Hyperion", name:"DH108P8 400 W Bifacial", price:112, rating:4.7, reviews:84, stock:"In stock", specs:["400 W · TOPCon","1722 × 1134 mm","22.0% efficiency"], watts:400 },
  { id:"panel-rec", category:"generation", subcategory:"Monofacial", maker:"REC", name:"Alpha Pure-RX 470 W", price:268, rating:4.9, reviews:41, stock:"Special order", specs:["470 W · HJT","1730 × 1205 mm","22.6% efficiency"], watts:470 },
  { id:"panel-rich", category:"generation", subcategory:"Flexible / semi-flexible", maker:"Rich Solar", name:"CIGS Flexible 200 W", price:429, rating:4.4, reviews:29, stock:"In stock", specs:["200 W · CIGS","2205 × 1080 mm","5.8 kg"], watts:200 },
  { id:"inv-eg4", category:"inverters", subcategory:"Hybrid", maker:"EG4", name:"18kPV Hybrid Inverter", price:4899, rating:4.8, reviews:173, stock:"In stock", specs:["12 kW AC output","18 kW PV input","48 V battery"], systemVoltage:48, pvInputVoltage:600 },
  { id:"inv-solark", category:"inverters", subcategory:"Hybrid", maker:"Sol-Ark", name:"15K-2P Hybrid Inverter", price:6995, rating:4.9, reviews:116, stock:"In stock", specs:["15 kW AC output","19.5 kW PV input","48 V battery"], systemVoltage:48, pvInputVoltage:500 },
  { id:"inv-victron", category:"inverters", subcategory:"Off-grid", maker:"Victron", name:"Quattro 48/10000/140-100/100", price:3388, rating:4.9, reviews:66, stock:"Low stock", specs:["8 kW continuous","120 V AC","48 V battery"], systemVoltage:48 },
  { id:"inv-pecron", category:"inverters", subcategory:"All-in-one power station", maker:"Pecron", name:"E3800LFP Power Station", price:2499, rating:4.5, reviews:92, stock:"In stock", specs:["3.6 kW output","3.84 kWh LFP","2.4 kW solar input"], capacityWh:3840 },
  { id:"ctrl-victron", category:"controllers", subcategory:"MPPT", maker:"Victron", name:"SmartSolar MPPT 250/100", price:546, rating:4.9, reviews:238, stock:"In stock", specs:["250 V PV maximum","100 A output","12 / 24 / 48 V"], systemVoltage:48, pvInputVoltage:250 },
  { id:"ctrl-midnite", category:"controllers", subcategory:"MPPT", maker:"MidNite Solar", name:"Classic 250 MPPT", price:829, rating:4.8, reviews:73, stock:"In stock", specs:["250 V PV maximum","63 A at 48 V","Arc-fault capable"], systemVoltage:48, pvInputVoltage:250 },
  { id:"ctrl-renogy", category:"controllers", subcategory:"PWM", maker:"Renogy", name:"Wanderer Li 30 A PWM", price:54, rating:4.3, reviews:945, stock:"In stock", specs:["25 V PV maximum","30 A output","12 / 24 V"], systemVoltage:24, pvInputVoltage:25 },
  { id:"bat-eg4", category:"storage", subcategory:"Rack / wall battery", maker:"EG4", name:"LifePower4 V2 5.12 kWh", price:1199, rating:4.8, reviews:315, stock:"In stock", specs:["51.2 V · 100 Ah","5.12 kWh LFP","100 A BMS"], capacityWh:5120, systemVoltage:48 },
  { id:"bat-ruixu", category:"storage", subcategory:"Rack / wall battery", maker:"RUiXU", name:"Lithi2-16 16 kWh", price:2899, rating:4.7, reviews:58, stock:"In stock", specs:["51.2 V · 314 Ah","16.1 kWh LFP","200 A BMS"], capacityWh:16077, systemVoltage:48 },
  { id:"bat-hv", category:"storage", subcategory:"High-voltage battery", maker:"Pytes", name:"HV48100 Battery Tower", price:7995, rating:4.6, reviews:19, stock:"Quote required", specs:["204.8 V nominal","20.48 kWh LFP","High-voltage BMS"], capacityWh:20480, systemVoltage:204 },
  { id:"protect-class-t", category:"protection", subcategory:"Fuse / breaker", maker:"Blue Sea", name:"Class T Fuse Block 225–400 A", price:89, rating:4.8, reviews:143, stock:"In stock", specs:["20 kA interrupt","160 V DC maximum","Tin-plated copper"] },
  { id:"protect-midnite", category:"protection", subcategory:"Combiner box", maker:"MidNite Solar", name:"MNPV6 Combiner", price:156, rating:4.8, reviews:77, stock:"In stock", specs:["6 string positions","150 V DC","NEMA 3R enclosure"] },
  { id:"protect-spd", category:"protection", subcategory:"Surge protection", maker:"MidNite Solar", name:"MNSPD-300-DC", price:104, rating:4.7, reviews:102, stock:"In stock", specs:["300 V DC","Type 1 / Type 2","Indoor / outdoor"] },
  { id:"wire-pv", category:"wiring", subcategory:"PV wire", maker:"WindyNation", name:"10 AWG PV Wire · 100 ft Pair", price:109, rating:4.7, reviews:421, stock:"In stock", specs:["10 AWG copper","2000 V rated","UV / wet rated"] },
  { id:"wire-battery", category:"wiring", subcategory:"Battery cable", maker:"TEMCo", name:"4/0 Welding Cable · 20 ft Pair", price:238, rating:4.9, reviews:811, stock:"In stock", specs:["4/0 AWG copper","600 V rated","EPDM jacket"] },
  { id:"wire-mc4", category:"wiring", subcategory:"Connectors / terminals", maker:"Staubli", name:"MC4-Evo 2 Connector Pair", price:12, rating:4.8, reviews:96, stock:"In stock", specs:["1500 V DC","45 A maximum","IP68 mated"] },
  { id:"mount-ironridge", category:"mounting", subcategory:"Roof mount", maker:"IronRidge", name:"XR100 Rail Kit · 4 Modules", price:386, rating:4.8, reviews:54, stock:"In stock", specs:["XR100 rail","FlashFoot2 attachments","Black clamps"] },
  { id:"mount-snapnrack", category:"mounting", subcategory:"Roof mount", maker:"SnapNrack", name:"Ultra Rail Composition Kit", price:419, rating:4.7, reviews:31, stock:"In stock", specs:["4-module kit","Mill finish rail","L-foot attachments"] },
  { id:"mount-ground", category:"mounting", subcategory:"Ground mount", maker:"IntegraRack", name:"IR-30 Ballasted Ground Mount", price:184, rating:4.5, reviews:39, stock:"In stock", specs:["30° fixed tilt","One module","No concrete required"] },
  { id:"monitor-cerbo", category:"monitoring", subcategory:"System gateway", maker:"Victron", name:"Cerbo GX MK2", price:326, rating:4.9, reviews:167, stock:"In stock", specs:["VE.Bus / VE.Can","Remote monitoring","Dual Ethernet"] },
  { id:"monitor-shunt", category:"monitoring", subcategory:"Battery shunt", maker:"Victron", name:"SmartShunt 500 A", price:126, rating:4.9, reviews:554, stock:"In stock", specs:["500 A continuous","Bluetooth","0.01% current resolution"] },
  { id:"monitor-emporia", category:"monitoring", subcategory:"Home energy monitor", maker:"Emporia", name:"Vue 3 · 16 Circuit Monitor", price:199, rating:4.7, reviews:2260, stock:"In stock", specs:["16 branch CTs","Wi-Fi gateway","±2% measurement"] },
  { id:"tool-fluke", category:"tools", subcategory:"Testing", maker:"Fluke", name:"393 FC Solar Clamp Meter", price:749, rating:4.9, reviews:128, stock:"In stock", specs:["1500 V DC CAT III","999.9 A DC","IP54 enclosure"] },
  { id:"tool-knipex", category:"tools", subcategory:"Crimping", maker:"Knipex", name:"97 43 200 Crimp System Pliers", price:229, rating:4.8, reviews:188, stock:"In stock", specs:["Interchangeable dies","Ratcheting action","MC4 die available"] },
  { id:"tool-ppe", category:"tools", subcategory:"Safety / PPE", maker:"Salisbury", name:"Class 0 Rubber Glove Kit", price:214, rating:4.8, reviews:71, stock:"In stock", specs:["1000 V AC use","Leather protectors","ASTM D120"] },
];

function CategoryIcon({ id, size = 18 }: { id: CategoryId; size?: number }) {
  const props = { size, strokeWidth: 1.9, "aria-hidden": true } as const;
  if (id === "generation") return <SunMedium {...props} />;
  if (id === "inverters") return <Zap {...props} />;
  if (id === "controllers") return <Gauge {...props} />;
  if (id === "storage") return <BatteryCharging {...props} />;
  if (id === "protection") return <ShieldCheck {...props} />;
  if (id === "wiring") return <Cable {...props} />;
  if (id === "mounting") return <Wrench {...props} />;
  if (id === "monitoring") return <PackageSearch {...props} />;
  return <HardHat {...props} />;
}

export function ProductSectionNav({ active }: { active: "overview" | "deals" | "catalog" | "picker" }) {
  const items = [
    ["overview", "Products", "/products", Boxes],
    ["picker", "Solar Part Picker", "/solar-part-picker", SlidersHorizontal],
    ["catalog", "Catalog List", "/catalog", PackageSearch],
    ["deals", "Deals", "/deals", Tags],
  ] as const;
  return (
    <nav className="product-section-nav" aria-label="Product tools">
      {items.map(([id, label, href, Icon]) => (
        <Link className={active === id ? "active" : ""} href={href} key={id}>
          <Icon size={16} aria-hidden="true" /> {label}
        </Link>
      ))}
    </nav>
  );
}

export function ProductHubPage() {
  return (
    <main className="page-main product-hub-page">
      <ProductSectionNav active="overview" />
      <div className="page-heading compact">
        <div className="eyebrow">PRODUCT RESEARCH</div>
        <h1>Choose equipment with the whole system in view.</h1>
        <p>Build a compatible parts list, inspect the catalog, or go directly to verified price drops.</p>
      </div>
      <div className="product-hub-grid">
        <Link href="/solar-part-picker" className="product-hub-card featured">
          <span><SlidersHorizontal aria-hidden="true" /></span>
          <small>BUILD WORKSPACE</small>
          <h2>Solar Part Picker</h2>
          <p>Assemble a complete PV system category by category, compare specifications, and catch basic voltage conflicts as you build.</p>
          <b>Start a new PV build →</b>
        </Link>
        <Link href="/catalog" className="product-hub-card">
          <span><PackageSearch aria-hidden="true" /></span>
          <small>EQUIPMENT DATABASE</small>
          <h2>Catalog List</h2>
          <p>Search normalized product records, specifications, retailer availability, and price history.</p>
          <b>Browse catalog →</b>
        </Link>
        <Link href="/deals" className="product-hub-card">
          <span><Tags aria-hidden="true" /></span>
          <small>PRICE TRACKER</small>
          <h2>Deals</h2>
          <p>Review meaningful daily price drops and compare current pricing with recent history.</p>
          <b>View deals →</b>
        </Link>
      </div>
    </main>
  );
}

export default function SolarPartPicker({ initialSearch = "" }: { initialSearch?: string }) {
  const initialParams = new URLSearchParams(initialSearch);
  const initialCategory = initialParams.get("category");
  const requestedMax = Number(initialParams.get("max"));
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(
    categoryDefinitions.some(item => item.id === initialCategory) ? initialCategory as CategoryId : null,
  );
  const [build, setBuild] = useState<PickerBuild>({});
  const [catalogParts, setCatalogParts] = useState<PickerPart[]>(pickerParts);
  const [query, setQuery] = useState(initialParams.get("q") || "");
  const [subcategory, setSubcategory] = useState(initialParams.get("type") || "All types");
  const [maker, setMaker] = useState(initialParams.get("maker") || "All manufacturers");
  const [maxPrice, setMaxPrice] = useState(Number.isFinite(requestedMax) && requestedMax >= 50 && requestedMax <= 8000 ? requestedMax : 8000);
  const [compatibilityOnly, setCompatibilityOnly] = useState(initialParams.get("compatible") !== "0");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);
    if (query) params.set("q", query);
    if (subcategory !== "All types") params.set("type", subcategory);
    if (maker !== "All manufacturers") params.set("maker", maker);
    if (maxPrice !== 8000) params.set("max", String(maxPrice));
    if (!compatibilityOnly) params.set("compatible", "0");
    const queryString = params.toString();
    window.history.replaceState(
      { ...(window.history.state || {}), solarPartPicker: true },
      "",
      `/solar-part-picker${queryString ? `?${queryString}` : ""}`,
    );
  }, [activeCategory, compatibilityOnly, maker, maxPrice, query, subcategory]);

  useEffect(() => {
    const hydrate = (available: PickerPart[]) => {
      try {
        const stored = window.localStorage.getItem("solar4u-part-picker-build");
        const parsed = stored ? JSON.parse(stored) as Record<string, { id: string; quantity: number } | Array<{ id: string; quantity: number }>> : {};
        const restored: PickerBuild = {};
        Object.entries(parsed).forEach(([category, storedEntries]) => {
          const entries = Array.isArray(storedEntries) ? storedEntries : [storedEntries];
          const categoryEntries = entries.flatMap(entry => {
            const part = available.find(item => item.id === entry.id);
            return part ? [{ part, quantity: Math.max(1, Number(entry.quantity) || 1) }] : [];
          });
          if (categoryEntries.length) restored[category as CategoryId] = categoryEntries;
        });
        const pendingRaw = window.localStorage.getItem("solar4u-part-picker-pending");
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw) as { id: string; category?: CategoryId };
          const part = available.find(item => item.id === pending.id);
          if (part) {
            const categoryEntries = restored[part.category] || [];
            const existing = categoryEntries.find(entry => entry.part.id === part.id);
            restored[part.category] = existing
              ? categoryEntries.map(entry => entry.part.id === part.id ? { ...entry, quantity: entry.quantity + 1 } : entry)
              : [...categoryEntries, { part, quantity: 1 }];
            window.localStorage.removeItem("solar4u-part-picker-pending");
          }
        }
        setBuild(current => Object.keys(restored).length ? { ...current, ...restored } : current);
      } catch {
        window.localStorage.removeItem("solar4u-part-picker-build");
        window.localStorage.removeItem("solar4u-part-picker-pending");
      }
    };
    hydrate(pickerParts);
    Promise.all(categoryDefinitions.map(category =>
      fetch(`/api/platform/v1/products?pickerCategory=${encodeURIComponent(category.id)}&limit=300`)
        .then(response => response.ok ? response.json() : Promise.reject()),
    ))
      .then(payloads => {
        const payload = { data: payloads.flatMap(item => item.data || []) };
        const allowedCategories = new Set(categoryDefinitions.map(item => item.id));
        const categoryMap: Record<string, CategoryId> = {
          panel: "generation",
          inverter: "inverters",
          power_station: "inverters",
          charge_controller: "controllers",
          battery: "storage",
          electrical_protection: "protection",
          wire: "wiring",
          mounting: "mounting",
          monitoring: "monitoring",
          tools: "tools",
        };
        const imported = (payload.data || []).map((item: Record<string, unknown>, index: number) => {
          const rawCategory = String(item.picker_category || "");
          const category = allowedCategories.has(rawCategory as CategoryId)
            ? rawCategory as CategoryId
            : categoryMap[String(item.category)] || null;
          const price = Number(item.current_price || 0);
          if (!category || !price) return null;
          const specs = item.specifications && typeof item.specifications === "object"
            ? item.specifications as Record<string, unknown>
            : {};
          return {
            id: String(item.id),
            slug: item.slug ? String(item.slug) : undefined,
            category,
            subcategory: String(item.picker_subcategory || "Other"),
            maker: String(item.brand || "Catalog source"),
            name: String(item.name || "Unnamed equipment"),
            price,
            rating: 4.2 + (index % 7) / 10,
            reviews: 0,
            stock: "Tracked offer",
            specs: [
              [item.watts ? `${item.watts} W` : null, item.capacity_wh ? `${(Number(item.capacity_wh) / 1000).toFixed(2)} kWh` : null, item.voltage ? `${item.voltage} V` : null].filter(Boolean).join(" · ") || String(item.model || item.category),
              [specs.widthMm ? `${specs.widthMm} mm wide` : null, specs.heightMm ? `${specs.heightMm} mm high` : null, specs.cellTechnology].filter(Boolean).join(" · ") || String(item.picker_subcategory || "Normalized catalog record"),
              `${Number(item.retailer_count || 1)} retailer${Number(item.retailer_count || 1) === 1 ? "" : "s"} tracked`,
            ] as [string, string, string],
            watts: item.watts ? Number(item.watts) : undefined,
            capacityWh: item.capacity_wh ? Number(item.capacity_wh) : undefined,
            systemVoltage: item.voltage ? Number(item.voltage) : undefined,
          } satisfies PickerPart;
        }).filter(Boolean) as PickerPart[];
        if (imported.length) {
          const merged = [...imported, ...pickerParts.filter(item => !imported.some(candidate => candidate.id === item.id))];
          setCatalogParts(merged);
          hydrate(merged);
        }
      })
      .catch(() => {});
  }, []);

  const saveBuild = () => {
    const serializable = Object.fromEntries(
      Object.entries(build).map(([category, entries]) => [
        category,
        (entries || []).map(entry => ({ id: entry.part.id, quantity: entry.quantity })),
      ]),
    );
    window.localStorage.setItem("solar4u-part-picker-build", JSON.stringify(serializable));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const selectedDefinition = categoryDefinitions.find(category => category.id === activeCategory);
  const categoryParts = useMemo(
    () => catalogParts.filter(part => part.category === activeCategory),
    [activeCategory, catalogParts],
  );
  const makers = useMemo(
    () => ["All manufacturers", ...Array.from(new Set(categoryParts.map(part => part.maker))).sort()],
    [categoryParts],
  );

  const inverterVoltages = useMemo(
    () => (build.inverters || []).flatMap(entry => entry.part.systemVoltage ? [entry.part.systemVoltage] : []),
    [build.inverters],
  );
  const storageVoltages = useMemo(
    () => (build.storage || []).flatMap(entry => entry.part.systemVoltage ? [entry.part.systemVoltage] : []),
    [build.storage],
  );
  const referenceVoltages = useMemo(() => activeCategory === "storage"
    ? inverterVoltages
    : activeCategory === "inverters"
      ? storageVoltages
      : [...storageVoltages, ...inverterVoltages], [activeCategory, inverterVoltages, storageVoltages]);
  const visibleParts = useMemo(() => categoryParts.filter(part => {
    const matchesQuery = `${part.name} ${part.maker} ${part.subcategory} ${part.specs.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesSubtype = subcategory === "All types" || part.subcategory === subcategory;
    const matchesMaker = maker === "All manufacturers" || part.maker === maker;
    const matchesPrice = part.price <= maxPrice;
    const matchesCompatibility = !compatibilityOnly
      || !referenceVoltages.length
      || !part.systemVoltage
      || referenceVoltages.includes(part.systemVoltage);
    return matchesQuery && matchesSubtype && matchesMaker && matchesPrice && matchesCompatibility;
  }), [categoryParts, compatibilityOnly, maker, maxPrice, query, referenceVoltages, subcategory]);
  const selectedPartIds = new Set((activeCategory ? build[activeCategory] : [])?.map(entry => entry.part.id) || []);

  const entries = Object.values(build).flatMap(categoryEntries => categoryEntries || []);
  const selectedCategoryCount = Object.values(build).filter(categoryEntries => categoryEntries?.length).length;
  const total = entries.reduce((sum, entry) => sum + entry.part.price * entry.quantity, 0);
  const arrayWatts = entries.reduce((sum, entry) => sum + (entry.part.watts ?? 0) * entry.quantity, 0);
  const storageWh = entries.reduce((sum, entry) => sum + (entry.part.capacityWh ?? 0) * entry.quantity, 0);
  const voltageConflict = storageVoltages.length > 0
    && inverterVoltages.length > 0
    && new Set([...storageVoltages, ...inverterVoltages]).size > 1;

  const chooseCategory = (id: CategoryId) => {
    setActiveCategory(id);
    setQuery("");
    setSubcategory("All types");
    setMaker("All manufacturers");
    window.scrollTo({ top: 100, behavior: "smooth" });
  };

  const addPart = (part: PickerPart) => {
    setBuild(current => {
      const categoryEntries = current[part.category] || [];
      const existing = categoryEntries.find(entry => entry.part.id === part.id);
      return {
        ...current,
        [part.category]: existing
          ? categoryEntries.map(entry => entry.part.id === part.id ? { ...entry, quantity: entry.quantity + 1 } : entry)
          : [...categoryEntries, { part, quantity: 1 }],
      };
    });
    setActiveCategory(null);
    setQuery("");
    setSubcategory("All types");
    setMaker("All manufacturers");
  };

  const backToBuild = () => {
    setActiveCategory(null);
    setQuery("");
    setSubcategory("All types");
    setMaker("All manufacturers");
  };

  const pickerReturnHref = useMemo(() => {
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);
    if (query) params.set("q", query);
    if (subcategory !== "All types") params.set("type", subcategory);
    if (maker !== "All manufacturers") params.set("maker", maker);
    if (maxPrice !== 8000) params.set("max", String(maxPrice));
    if (!compatibilityOnly) params.set("compatible", "0");
    const queryString = params.toString();
    return `/solar-part-picker${queryString ? `?${queryString}` : ""}`;
  }, [activeCategory, compatibilityOnly, maker, maxPrice, query, subcategory]);

  const updateQuantity = (category: CategoryId, partId: string, quantity: number) => {
    setBuild(current => {
      const categoryEntries = current[category];
      if (!categoryEntries) return current;
      return {
        ...current,
        [category]: categoryEntries.map(entry => entry.part.id === partId
          ? { ...entry, quantity: Math.max(1, Math.min(999, quantity)) }
          : entry),
      };
    });
  };

  const removePart = (category: CategoryId, partId: string) => {
    setBuild(current => {
      const remaining = (current[category] || []).filter(entry => entry.part.id !== partId);
      return { ...current, [category]: remaining.length ? remaining : undefined };
    });
  };

  return (
    <main className="part-picker-page">
      <ProductSectionNav active="picker" />
      <header className="picker-titlebar">
        <div>
          <div className="eyebrow">SYSTEM BUILDER</div>
          <h1>{activeCategory ? `Choose ${selectedDefinition?.name}` : "Solar Part Picker"}</h1>
          <p>{activeCategory ? "Filter compatible equipment and add a selection to your active PV build." : "Build a complete solar system one category at a time."}</p>
        </div>
        <div className="picker-title-actions">
          {activeCategory && <button className="secondary-button" onClick={backToBuild}>← Back to build</button>}
          <button className="primary-button" onClick={saveBuild}><Save size={16} aria-hidden="true" /> {saved ? "Saved locally" : "Save build"}</button>
        </div>
      </header>

      {!activeCategory ? (
        <div className="picker-build-layout">
          <section className="picker-build-main">
            <div className={`compatibility-banner ${voltageConflict ? "warning" : "good"}`}>
              {voltageConflict ? <AlertTriangle size={20} aria-hidden="true" /> : <CheckCircle2 size={20} aria-hidden="true" />}
              <div>
                <b>{voltageConflict ? "Battery and inverter voltage conflict" : "Compatibility check active"}</b>
                <span>{voltageConflict ? "Choose components with matching nominal battery voltage before ordering." : "No basic voltage conflicts found in the selected equipment."}</span>
              </div>
            </div>
            <div className="picker-build-table">
              <div className="picker-build-head">
                <span>Component</span><span>Selection</span><span>Base</span><span>Qty</span><span>Price</span><span />
              </div>
              {categoryDefinitions.flatMap(category => {
                const categoryEntries = build[category.id] || [];
                if (!categoryEntries.length) {
                  return [(
                    <div className="picker-build-row" key={category.id}>
                      <button className="picker-category-link" onClick={() => chooseCategory(category.id)}>
                        <CategoryIcon id={category.id} />
                        <span><b>{category.name}</b><small>{category.short}</small></span>
                      </button>
                      <button className="picker-choose-button" onClick={() => chooseCategory(category.id)}><Plus size={16} aria-hidden="true" /> Choose {category.name}</button>
                      <span /><span /><span /><span />
                    </div>
                  )];
                }
                return categoryEntries.map((entry, index) => (
                  <div className={`picker-build-row ${index ? "continuation" : ""}`} key={`${category.id}-${entry.part.id}`}>
                    {index === 0 ? (
                      <button className="picker-category-link" onClick={() => chooseCategory(category.id)}>
                        <CategoryIcon id={category.id} />
                        <span><b>{category.name}</b><small>{categoryEntries.length} item{categoryEntries.length === 1 ? "" : "s"} · add another</small></span>
                      </button>
                    ) : (
                      <span className="picker-category-continuation" aria-hidden="true" />
                    )}
                        <div className="picker-selection-cell">
                          <button className="picker-selection" onClick={() => chooseCategory(category.id)}>
                            <b>{entry.part.name}</b>
                            <small>{entry.part.maker} · {entry.part.specs[0]}</small>
                          </button>
                          {index === categoryEntries.length - 1 && <button className="picker-add-additional" onClick={() => chooseCategory(category.id)}><Plus size={13} aria-hidden="true" /> Add Additional {category.name}</button>}
                        </div>
                        <span className="picker-base-price">${entry.part.price.toLocaleString()}</span>
                        <label className="picker-quantity">
                          <span className="sr-only">Quantity</span>
                          <input aria-label={`Quantity for ${entry.part.name}`} type="number" min="1" max="999" value={entry.quantity} onChange={event => updateQuantity(category.id, entry.part.id, Number(event.target.value))} />
                        </label>
                        <b className="picker-row-total">${(entry.part.price * entry.quantity).toLocaleString()}</b>
                        <button className="picker-remove" aria-label={`Remove ${entry.part.name}`} onClick={() => removePart(category.id, entry.part.id)}><Trash2 size={16} /></button>
                  </div>
                ));
              })}
            </div>
          </section>
          <aside className="picker-summary">
            <div className="picker-summary-title"><Boxes size={20} aria-hidden="true" /><div><b>PV Build</b><span>Local draft</span></div></div>
            <dl>
              <div><dt>Product lines</dt><dd>{entries.length}</dd></div>
              <div><dt>Categories covered</dt><dd>{selectedCategoryCount} / {categoryDefinitions.length}</dd></div>
              <div><dt>Estimated total</dt><dd>${total.toLocaleString()}</dd></div>
              <div><dt>PV nameplate</dt><dd>{arrayWatts ? `${(arrayWatts / 1000).toFixed(2)} kW` : "—"}</dd></div>
              <div><dt>Storage</dt><dd>{storageWh ? `${(storageWh / 1000).toFixed(1)} kWh` : "—"}</dd></div>
            </dl>
            <div className="picker-completion">
              <span><i style={{ width: `${selectedCategoryCount / categoryDefinitions.length * 100}%` }} /></span>
              <small>{Math.round(selectedCategoryCount / categoryDefinitions.length * 100)}% of categories selected</small>
            </div>
            <button className="primary-button" onClick={saveBuild}><Save size={16} /> Save build locally</button>
            <p>Compatibility checks are planning aids. Verify manufacturer manuals, ratings, conductor protection, and local code before purchasing.</p>
          </aside>
        </div>
      ) : (
        <div className="picker-products-layout">
          <aside className="picker-filters">
            <div className="picker-mini-summary">
              <Boxes size={18} aria-hidden="true" />
              <span><b>{entries.length} parts</b><small>${total.toLocaleString()} total</small></span>
            </div>
            <label className="picker-check">
              <input type="checkbox" checked={compatibilityOnly} onChange={event => setCompatibilityOnly(event.target.checked)} />
              <span><b>Compatibility filter</b><small>Hide obvious voltage conflicts</small></span>
            </label>
            <div className="picker-filter-group">
              <h3>Product type</h3>
              <select value={subcategory} onChange={event => setSubcategory(event.target.value)}>
                <option>All types</option>
                {selectedDefinition?.subcategories.map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="picker-filter-group">
              <h3>Manufacturer</h3>
              {makers.map(item => (
                <label key={item}><input type="radio" name="maker" checked={maker === item} onChange={() => setMaker(item)} /> {item}</label>
              ))}
            </div>
            <div className="picker-filter-group">
              <h3>Maximum price</h3>
              <b>${maxPrice.toLocaleString()}</b>
              <input type="range" min="50" max="8000" step="50" value={maxPrice} onChange={event => setMaxPrice(Number(event.target.value))} />
              <div><span>$50</span><span>$8,000</span></div>
            </div>
          </aside>
          <section className="picker-product-results">
            <div className="picker-results-toolbar">
              <div><b>{visibleParts.length} compatible products</b><span>{categoryParts.length} in this category</span></div>
              <label><Search size={16} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${selectedDefinition?.name.toLowerCase()}`} /></label>
            </div>
            <div className="picker-product-table">
              <div className="picker-product-head"><span>Name</span><span>Key specification</span><span>Electrical / physical</span><span>Rating</span><span>Price</span><span /></div>
              {visibleParts.map(part => (
                <article className="picker-product-row" key={part.id}>
                  <div className="picker-product-name">
                    <span><CategoryIcon id={part.category} size={23} /></span>
                    <div><small>{part.maker} · {part.subcategory}</small><Link href={`/products/${encodeURIComponent(part.slug || part.id)}?returnTo=${encodeURIComponent(pickerReturnHref)}`}><b>{part.name}</b></Link><em>{part.stock}</em></div>
                  </div>
                  <span>{part.specs[0]}</span>
                  <span>{part.specs[1]}<small>{part.specs[2]}</small></span>
                  <span className="picker-rating"><b>{part.rating.toFixed(1)}</b><small>{part.reviews} reviews</small></span>
                  <b className="picker-product-price">${part.price.toLocaleString()}</b>
                  <button className="picker-add-button" onClick={() => addPart(part)}>{selectedPartIds.has(part.id) ? "Add 1 more" : "Add"}</button>
                </article>
              ))}
              {!visibleParts.length && <div className="picker-no-results">No equipment matches these filters. Expand the price or compatibility settings.</div>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
