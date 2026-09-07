"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Moon, Sun } from "lucide-react";
import InteractiveCalculatorsPage from "./calculators-page";
import CommunityPage from "./community-page";
import InteractiveGuidesPage from "./guides-page";
import SolarPartPicker, { ProductHubPage, ProductSectionNav } from "./solar-part-picker";
import ProductDetailPage from "./product-detail-page";
import AdminPage from "./admin-page";
import PlannerPage from "./planner-page";

type Product = {
  id: string;
  slug?: string;
  name: string;
  maker: string;
  type: string;
  spec: string;
  price: number;
  oldPrice: number;
  retailer: string;
  score: number;
  status: string;
  spark: number[];
};

const products: Product[] = [
  { id:"eg4-lifepower4-v2", name: "EG4 LifePower4 V2", maker: "EG4", type: "Battery", spec: "48 V · 100 Ah · 5.12 kWh", price: 1199, oldPrice: 1499, retailer: "Signature Solar", score: 92, status: "In stock", spark: [1499,1450,1399,1399,1299,1249,1199] },
  { id:"ruixu-lithi2-16", name: "Ruixu Lithi2-16", maker: "RUiXU", type: "Battery", spec: "51.2 V · 314 Ah · 16 kWh", price: 2899, oldPrice: 3299, retailer: "Current Connected", score: 90, status: "In stock", spark: [3299,3299,3199,3099,2999,2999,2899] },
  { id:"eg4-flexboss21", name: "FlexBOSS21", maker: "EG4", type: "Inverter", spec: "21 kW PV · 16 kW output", price: 4099, oldPrice: 4499, retailer: "Signature Solar", score: 95, status: "Low stock", spark: [4499,4399,4399,4299,4199,4099,4099] },
  { id:"hyperion-400", name: "Hyperion 400W Bifacial", maker: "Hyperion", type: "Solar panel", spec: "400 W · 21.3% efficiency", price: 112, oldPrice: 145, retailer: "SanTan Solar", score: 88, status: "Pallet + singles", spark: [145,139,129,129,119,112,112] },
  { id:"victron-250-100", name: "Victron SmartSolar 250/100", maker: "Victron", type: "Charge controller", spec: "250 V · 100 A · Bluetooth", price: 546, oldPrice: 614, retailer: "Inverters R Us", score: 97, status: "In stock", spark: [614,605,599,579,569,559,546] },
  { id:"anker-solix-f3800", name: "Anker SOLIX F3800", maker: "Anker", type: "Power station", spec: "3.84 kWh · 6 kW output", price: 2399, oldPrice: 3199, retailer: "Anker Solix", score: 86, status: "Sale", spark: [3199,2999,2899,2699,2599,2499,2399] },
];

const retailers = ["All retailers", "Signature Solar", "Current Connected", "ShopSolar", "Rich Solar", "SanTan Solar"];
const categories = ["All products", "Battery", "Inverter", "Solar panel", "Charge controller", "Power station"];

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / Math.max(1, max - min)) * 30}`).join(" ");
  return <svg className="spark" viewBox="0 0 100 40" aria-label="Falling price history"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>;
}

type DisplayMode = "light" | "dark";

function Header({
  showDisplayMode = false,
  displayMode = "light",
  onDisplayMode,
}: {
  showDisplayMode?: boolean;
  displayMode?: DisplayMode;
  onDisplayMode?: (mode: DisplayMode) => void;
}) {
  const [menu, setMenu] = useState(false);
  const nav = [["Plan a system","/planner"],["Calculators","/calculators"],["Learn","/guides"],["Community","/community"]];
  return (
    <>
      <div className="notice"><span>LOCAL LAB</span> Solar4U is running privately on your machine. Live provider keys are optional.</div>
      <header className="site-header">
        <Link className="brand" href="/"><span className="sun-mark">☀</span><span>Solar<span>4U</span></span></Link>
        <button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Toggle navigation">☰</button>
        <nav className={menu ? "open" : ""}>
          <div className="site-nav-products">
            <Link href="/products">Products</Link>
            <button type="button" aria-label="Open product tools"><ChevronDown size={14} aria-hidden="true" /></button>
            <div className="site-nav-product-menu">
              <Link href="/solar-part-picker"><b>Solar Part Picker</b><small>Build a compatible PV system</small></Link>
              <Link href="/catalog"><b>Catalog List</b><small>Browse equipment and specifications</small></Link>
              <Link href="/deals"><b>Deals</b><small>Review verified price drops</small></Link>
            </div>
          </div>
          {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="header-account-tools">
          <Link className="admin-nav-link" href="/admin">Admin</Link>
          {showDisplayMode && (
            <button
              className="site-theme-toggle"
              type="button"
              aria-label={`Switch to ${displayMode === "dark" ? "light" : "dark"} mode`}
              aria-pressed={displayMode === "dark"}
              onClick={() => onDisplayMode?.(displayMode === "dark" ? "light" : "dark")}
            >
              <span className="site-theme-toggle-thumb" aria-hidden="true" />
              <Sun className="site-theme-icon site-theme-icon-sun" size={14} strokeWidth={2.2} aria-hidden="true" />
              <Moon className="site-theme-icon site-theme-icon-moon" size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
          <Link className="account-button" href="/dashboard">Local profile <span>FH</span></Link>
        </div>
      </header>
    </>
  );
}

function Footer() {
  return (
    <footer>
      <div><div className="brand footer-brand"><span className="sun-mark">☀</span><span>Solar<span>4U</span></span></div><p>Independent tools for people building their own energy future.</p></div>
      <div><strong>Build</strong><Link href="/planner">System planner</Link><Link href="/diagrams">Wiring diagrams</Link><Link href="/calculators">Calculators</Link></div>
      <div><strong>Research</strong><Link href="/products">Price tracker</Link><Link href="/recommendations">Recommendations</Link><Link href="/guides">DIY guides</Link></div>
      <div><strong>Important</strong><p>Planning information only. Verify every design with qualified local professionals and your authority having jurisdiction.</p></div>
    </footer>
  );
}

function PriceTable({ dealOnly = false }: { dealOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [retailer, setRetailer] = useState(retailers[0]);
  const [catalog, setCatalog] = useState(products);
  useEffect(() => {
    fetch("http://localhost:4000/v1/products?limit=500")
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => {
        const normalized = (payload.data || []).slice(0, 100).map((item: Record<string, unknown>, index: number) => {
          const price = Number(item.current_price || 0);
          const historicalHigh = Number(item.historical_high || price);
          const typeMap: Record<string, string> = { panel: "Solar panel", battery: "Battery", inverter: "Inverter", charge_controller: "Charge controller", power_station: "Power station" };
          return {
            id: String(item.id || `catalog-${index}`),
            slug: item.slug ? String(item.slug) : undefined,
            name: String(item.name || "Unnamed product"),
            maker: String(item.brand || "Solar equipment"),
            type: typeMap[String(item.category)] || "Solar equipment",
            spec: [item.model, item.watts ? `${item.watts} W` : null, item.capacity_wh ? `${item.capacity_wh} Wh` : null].filter(Boolean).join(" · ") || "Specifications pending review",
            price,
            oldPrice: Math.max(price, historicalHigh),
            retailer: String(item.retailer || "Tracked source"),
            score: 78 + (index % 19),
            status: `${Number(item.retailer_count || 1)} retailer${Number(item.retailer_count || 1) === 1 ? "" : "s"} · tracked daily`,
            spark: [historicalHigh,historicalHigh,(historicalHigh+price)/2,(historicalHigh+price)/2,price,price,price],
          } satisfies Product;
        }).filter((item: Product) => item.price > 0);
        if (normalized.length) setCatalog(normalized);
      })
      .catch(() => {});
  }, []);
  const visible = useMemo(() => catalog.filter(p =>
    (!dealOnly || p.oldPrice - p.price > 100) &&
    (category === "All products" || p.type === category) &&
    (retailer === "All retailers" || p.retailer === retailer) &&
    `${p.name} ${p.maker} ${p.spec}`.toLowerCase().includes(query.toLowerCase())
  ), [query, category, retailer, dealOnly, catalog]);
  return (
    <>
      <div className="filters">
        <label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products, model or specification" /></label>
        <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select>
        <select aria-label="Retailer" value={retailer} onChange={e => setRetailer(e.target.value)}>{retailers.map(x => <option key={x}>{x}</option>)}</select>
      </div>
      <div className="data-table">
        <div className="table-head"><span>Product</span><span>90-day history</span><span>Best price</span><span>Score</span><span></span></div>
        {visible.map(p => {
          const savings = p.oldPrice - p.price;
          return <div className="product-row" key={p.name}>
            <div className="product-cell"><div className="product-icon">{p.type === "Battery" ? "▤" : p.type === "Solar panel" ? "▦" : "⌁"}</div><div><Link href={`/products/${encodeURIComponent(p.slug || p.id)}`}><b>{p.name}</b></Link><small>{p.maker} · {p.spec}</small><em>{p.status}</em></div></div>
            <div><Sparkline values={p.spark} /><small className="down">↓ {Math.round((savings / p.oldPrice) * 100)}% in 90 days</small></div>
            <div className="price"><b>${p.price.toLocaleString()}</b><s>${p.oldPrice.toLocaleString()}</s><small>{p.retailer}</small></div>
            <div className="score"><span style={{"--score": `${p.score}%`} as React.CSSProperties}>{p.score}</span></div>
            <button className="ghost-button">Compare</button>
          </div>;
        })}
        {!visible.length && <div className="empty-state">No products match those filters.</div>}
      </div>
    </>
  );
}

function HomePage() {
  return (
    <>
      <main>
        <section className="hero">
          <div className="eyebrow">DIY SOLAR, WITHOUT THE GUESSWORK</div>
          <h1>Plan smarter.<br/><span>Build with confidence.</span></h1>
          <p>Compare real equipment prices, model your property, validate a wiring plan, and learn from builders who have done it.</p>
          <div className="hero-actions"><Link className="primary-button" href="/planner">Plan my system <span>→</span></Link><Link className="secondary-button" href="/deals">Explore price drops</Link></div>
          <div className="trust-row"><span>✓ Transparent price history</span><span>✓ Independent recommendations</span><span>✓ Local-first privacy</span></div>
        </section>
        <section className="pulse-card">
          <div className="pulse-head"><div><span className="live-dot"></span> MARKET PULSE</div><small>Updated daily · 36 retailers configured</small></div>
          <div className="pulse-grid">
            <div><small>Tracked products</small><b>18,420</b><em>across 6 categories</em></div>
            <div><small>Price drops today</small><b className="green">126</b><em>↓ 14% average</em></div>
            <div><small>Best panel price</small><b>$0.28<small>/W</small></b><em>SanTan Solar</em></div>
            <div><small>Historical records</small><b>1.2M</b><em>since Jun 2024</em></div>
          </div>
        </section>
        <section className="section-block">
          <div className="section-title"><div><div className="eyebrow">TODAY’S OPPORTUNITIES</div><h2>Deals worth a closer look</h2></div><Link href="/deals">View all price drops →</Link></div>
          <div className="deal-grid">{products.slice(0,3).map(p => <article className="deal-card" key={p.name}><div className="deal-top"><span>{p.type}</span><span className="discount">-{Math.round((p.oldPrice-p.price)/p.oldPrice*100)}%</span></div><div className="product-art">{p.type === "Battery" ? "▤" : p.type === "Inverter" ? "⌁" : "▦"}</div><small>{p.maker}</small><h3>{p.name}</h3><p>{p.spec}</p><Sparkline values={p.spark}/><div className="deal-price"><div><b>${p.price.toLocaleString()}</b><s>${p.oldPrice.toLocaleString()}</s></div><span>{p.retailer}</span></div></article>)}</div>
        </section>
        <section className="journey">
          <div><div className="eyebrow">ONE PROJECT, ONE WORKSPACE</div><h2>Your solar journey,<br/>connected end to end.</h2><p>Start with your energy needs and property. Solar4U carries the assumptions into your estimates, component list and wiring diagram.</p><Link className="primary-button" href="/planner">Start with your property →</Link></div>
          <div className="journey-steps">{[["01","Map your site","Roof or ground mount with a manual fallback."],["02","Model production","Monthly energy, shade, losses and savings."],["03","Choose equipment","A compatible, price-aware bill of materials."],["04","Wire it safely","Build and validate a one-line diagram."]].map(([n,t,d]) => <div key={n}><span>{n}</span><b>{t}</b><p>{d}</p></div>)}</div>
        </section>
      </main>
    </>
  );
}

function ProductsPage({ deals = false }: { deals?: boolean }) {
  return <main className="page-main"><ProductSectionNav active={deals ? "deals" : "catalog"} /><div className="page-heading"><div className="eyebrow">{deals ? "FRESHLY VERIFIED" : "EQUIPMENT INTELLIGENCE"}</div><h1>{deals ? "Today’s solar price drops" : "Catalog List"}</h1><p>{deals ? "Meaningful discounts from independently tracked retailers, updated once daily." : "Search equipment specifications, availability, normalized unit prices and real price history."}</p></div><PriceTable dealOnly={deals}/></main>;
}

function RecommendationsPage() {
  const recs = [
    ["Best value 48 V battery","EG4 LifePower4 V2","Excellent ecosystem support and a strong $/kWh price.","$234 / kWh"],
    ["Best premium controller","Victron SmartSolar 250/100","Mature monitoring, flexible configuration and strong documentation.","97 / 100"],
    ["Best whole-home hybrid","EG4 FlexBOSS21","High PV input and integrated architecture for large residential systems.","Editor pick"],
    ["Best budget panel","Hyperion 400W Bifacial","Competitive efficiency with unusually low single-panel pricing.","$0.28 / W"],
  ];
  return <main className="page-main"><div className="page-heading"><div className="eyebrow">INDEPENDENT SHORTLISTS</div><h1>Equipment we’d build with</h1><p>Selections balance electrical fit, documentation, serviceability, warranty, community experience and live pricing.</p></div><div className="recommend-grid">{recs.map(([tag,name,copy,metric],i)=><article key={name}><span>0{i+1}</span><small>{tag}</small><h2>{name}</h2><p>{copy}</p><div><b>{metric}</b><button className="ghost-button">See evidence →</button></div></article>)}</div><div className="method-note"><b>No pay-to-win rankings.</b><span>Affiliate status never changes product scores. Every recommendation includes selection criteria, known tradeoffs and last-reviewed date.</span></div></main>;
}

// Kept temporarily while the new calculator workspace is stabilized.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CalculatorsPage() {
  const [systemKw,setSystemKw]=useState(10);
  const [sun,setSun]=useState(3.8);
  const [rate,setRate]=useState(.19);
  const annual=Math.round(systemKw*sun*365*.82);
  const savings=Math.round(annual*rate);
  return <main className="page-main"><div className="page-heading"><div className="eyebrow">CHECK THE MATH</div><h1>Solar calculators</h1><p>Fast answers with visible formulas, units and conservative defaults.</p></div><div className="calculator-layout"><div className="calc-list">{["PV production","Battery runtime","Voltage drop","Fuse & breaker","Array voltage","Charge controller","TOU battery","Payback"].map((x,i)=><button className={i===0?"active":""} key={x}><span>{["☀","▤","↯","⏚","▦","⌁","◷","$"][i]}</span>{x}</button>)}</div><section className="calculator-card"><div><small>ACTIVE CALCULATOR</small><h2>PV production quick estimate</h2><p>Uses a transparent derate model locally. Connect PVWatts for site-specific weather.</p></div><div className="control-grid"><label>Array capacity <b>{systemKw.toFixed(1)} kW</b><input type="range" min="1" max="30" step=".5" value={systemKw} onChange={e=>setSystemKw(+e.target.value)}/><span><i>1 kW</i><i>30 kW</i></span></label><label>Peak sun hours <b>{sun.toFixed(1)} hrs/day</b><input type="range" min="2" max="6.5" step=".1" value={sun} onChange={e=>setSun(+e.target.value)}/><span><i>2 hr</i><i>6.5 hr</i></span></label><label>Electricity rate <b>${rate.toFixed(2)} / kWh</b><input type="range" min=".08" max=".55" step=".01" value={rate} onChange={e=>setRate(+e.target.value)}/><span><i>$0.08</i><i>$0.55</i></span></label></div><div className="calc-results"><div><small>Estimated production</small><b>{annual.toLocaleString()} <em>kWh/yr</em></b></div><div><small>Estimated bill value</small><b>${savings.toLocaleString()} <em>/yr</em></b></div><div><small>Assumed losses</small><b>18 <em>%</em></b></div></div><p className="formula">system kW × peak sun hours × 365 × 0.82 derate</p></section></div></main>;
}

type DiagramNode={id:number;type:string;x:number;y:number};
function DiagramsPage() {
  const [nodes,setNodes]=useState<DiagramNode[]>([{id:1,type:"PV array",x:80,y:100},{id:2,type:"Disconnect",x:310,y:100},{id:3,type:"Inverter",x:540,y:100},{id:4,type:"Battery",x:540,y:280},{id:5,type:"Main panel",x:760,y:100}]);
  const [selected,setSelected]=useState<number|null>(null);
  const add=(type:string)=>setNodes(n=>[...n,{id:Date.now(),type,x:100+(n.length%4)*190,y:380}]);
  return <main className="diagram-page"><div className="diagram-toolbar"><div><div className="eyebrow">ONE-LINE BUILDER</div><h1>System diagram</h1></div><div><button>↶ Undo</button><button>↷ Redo</button><button>Save locally</button><button className="primary-button">Export ▾</button></div></div><div className="diagram-shell"><aside><h3>Components</h3><input placeholder="Search components"/>{["PV array","Combiner","Disconnect","Breaker","Charge controller","Inverter","Battery","Busbar","Main panel","Ground"].map(x=><button key={x} onClick={()=>add(x)}><span>{x==="PV array"?"▦":x==="Battery"?"▤":"⌁"}</span>{x}<b>+</b></button>)}</aside><section className="canvas"><div className="canvas-grid"></div><svg className="wires"><line x1="170" y1="135" x2="350" y2="135"/><line x1="390" y1="135" x2="575" y2="135"/><line x1="620" y1="135" x2="795" y2="135"/><line className="negative" x1="575" y1="180" x2="575" y2="285"/></svg>{nodes.map(n=><button key={n.id} className={`diagram-node ${selected===n.id?"selected":""}`} style={{left:n.x,top:n.y}} onClick={()=>setSelected(n.id)}><span>{n.type==="PV array"?"▦":n.type==="Battery"?"▤":"⌁"}</span><b>{n.type}</b><small>{n.type==="PV array"?"10.4 kW":n.type==="Battery"?"51.2 V · 15 kWh":"Configured"}</small><i className="port left"></i><i className="port right"></i></button>)}</section><aside className="inspector"><h3>Design check</h3><div className="validation good"><b>✓ 6 checks passed</b><span>Voltage, polarity and controller input are within configured limits.</span></div><div className="validation warn"><b>△ Review conductor</b><span>Specify wire length and temperature rating to validate voltage drop.</span></div><h4>Selected component</h4><label>Label<input value={nodes.find(n=>n.id===selected)?.type||"Select a component"} readOnly/></label><label>System voltage<select defaultValue="48"><option>12 V</option><option>24 V</option><option>48 V</option></select></label><p className="disclaimer">Planning assistance only. A passing check is not engineering approval or proof of code compliance.</p></aside></div></main>;
}

function DashboardPage() {
  return <main className="page-main"><div className="dashboard-head"><div><small>GOOD EVENING</small><h1>Welcome back, Fahad.</h1><p>Your local profile is active. Google sign-in will replace it before public launch.</p></div><Link className="primary-button" href="/planner">+ New solar project</Link></div><div className="dashboard-grid"><article className="project-card"><div><span className="status-pill">DRAFT</span><small>Updated today</small></div><h2>Tonawanda home solar</h2><p>Roof mount · 9.6 kW · 24 panels</p><div className="project-metrics"><div><small>Annual output</small><b>10,483 kWh</b></div><div><small>Bill offset</small><b>100%</b></div><div><small>Storage</small><b>15 kWh</b></div></div><div><button className="primary-button">Continue planning</button><button className="ghost-button">•••</button></div></article><article className="watch-card"><div className="card-title"><h2>Price watch</h2><Link href="/products">Manage →</Link></div>{products.slice(0,3).map(p=><div key={p.name}><span>{p.type==="Battery"?"▤":"⌁"}</span><div><b>{p.name}</b><small>{p.retailer}</small></div><div><b>${p.price.toLocaleString()}</b><small className="down">↓ ${p.oldPrice-p.price}</small></div></div>)}</article><article className="activity-card"><div className="card-title"><h2>Recent activity</h2></div>{[["▦","Array changed to 24 panels","Today, 8:42 PM"],["⌁","Diagram validation completed","Yesterday"],["↓","EG4 battery crossed your alert","Jul 28"],["★","Bookmarked wiring guide","Jul 27"]].map(([i,t,d])=><div key={t}><span>{i}</span><p><b>{t}</b><small>{d}</small></p></div>)}</article></div></main>;
}

export function SolarApp({ section, communityThreadId = "", productId = "", pickerSearch = "", productReturnTo = "/catalog" }: { section: string; communityThreadId?: string; productId?: string; pickerSearch?: string; productReturnTo?: string }) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("light");
  useEffect(() => {
    const savedMode = window.localStorage.getItem("solar4u-display-mode")
      || window.localStorage.getItem("solar4u-community-display-mode");
    if (savedMode !== "light" && savedMode !== "dark") return;
    const restoreMode = window.setTimeout(() => setDisplayMode(savedMode), 0);
    return () => window.clearTimeout(restoreMode);
  }, []);
  const updateDisplayMode = (mode: DisplayMode) => {
    setDisplayMode(mode);
    window.localStorage.setItem("solar4u-display-mode", mode);
    window.localStorage.setItem("solar4u-community-display-mode", mode);
  };
  let content=<HomePage/>;
  if(section==="products") content=<ProductHubPage/>;
  if(section==="catalog") content=<ProductsPage/>;
  if(section==="deals") content=<ProductsPage deals/>;
  if(section==="solar-part-picker") content=<SolarPartPicker initialSearch={pickerSearch}/>;
  if(section==="product-detail") content=<ProductDetailPage productId={productId} returnTo={productReturnTo}/>;
  if(section==="recommendations") content=<RecommendationsPage/>;
  if(section==="guides") content=<InteractiveGuidesPage/>;
  if(section==="calculators") content=<InteractiveCalculatorsPage/>;
  if(section==="planner") content=<PlannerPage/>;
  if(section==="diagrams") content=<DiagramsPage/>;
  if(section==="community") content=<CommunityPage initialThreadId={communityThreadId}/>;
  if(section==="community-test") content=<CommunityPage designLab testMode={displayMode}/>;
  if(section==="dashboard") content=<DashboardPage/>;
  if(section==="admin") content=<AdminPage/>;
  return (
    <div className={`app site-editorial-theme mode-${displayMode} ${section === "community-test" ? "community-test-app" : ""}`}>
      <Header
        showDisplayMode
        displayMode={displayMode}
        onDisplayMode={updateDisplayMode}
      />
      {content}
      <Footer/>
    </div>
  );
}
