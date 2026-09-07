"use client";
import { useState } from "react";
import { SiteHeader, SiteFooter, NewHome, WorkspacePage } from "./experience";
import InteractiveCalculatorsPage from "./calculators-page";
import InteractiveGuidesPage from "./guides-page";
import PriceTracker from "./price-tracker";
import PlannerPage from "./planner-page";
import { DiagnosticsPage, usePageTools } from "./webmcp";
type DiagramNode={id:number;type:string;x:number;y:number};
function DiagramsPage() {
  const [nodes,setNodes]=useState<DiagramNode[]>([{id:1,type:"PV array",x:80,y:100},{id:2,type:"Disconnect",x:310,y:100},{id:3,type:"Inverter",x:540,y:100},{id:4,type:"Battery",x:540,y:280},{id:5,type:"Main panel",x:760,y:100}]);
  const [selected,setSelected]=useState<number|null>(null);
  const add=(type:string)=>setNodes(n=>[...n,{id:Date.now(),type,x:100+(n.length%4)*190,y:380}]);
  return <main className="diagram-page"><div className="diagram-toolbar"><div><div className="eyebrow">ONE-LINE BUILDER</div><h1>System diagram</h1></div><div><button>↶ Undo</button><button>↷ Redo</button><button>Save locally</button><button className="primary-button">Export ▾</button></div></div><div className="diagram-shell"><aside><h3>Components</h3><input placeholder="Search components"/>{["PV array","Combiner","Disconnect","Breaker","Charge controller","Inverter","Battery","Busbar","Main panel","Ground"].map(x=><button key={x} onClick={()=>add(x)}><span>{x==="PV array"?"▦":x==="Battery"?"▤":"⌁"}</span>{x}<b>+</b></button>)}</aside><section className="canvas"><div className="canvas-grid"></div><svg className="wires"><line x1="170" y1="135" x2="350" y2="135"/><line x1="390" y1="135" x2="575" y2="135"/><line x1="620" y1="135" x2="795" y2="135"/><line className="negative" x1="575" y1="180" x2="575" y2="285"/></svg>{nodes.map(n=><button key={n.id} className={`diagram-node ${selected===n.id?"selected":""}`} style={{left:n.x,top:n.y}} onClick={()=>setSelected(n.id)}><span>{n.type==="PV array"?"▦":n.type==="Battery"?"▤":"⌁"}</span><b>{n.type}</b><small>{n.type==="PV array"?"10.4 kW":n.type==="Battery"?"51.2 V · 15 kWh":"Configured"}</small><i className="port left"></i><i className="port right"></i></button>)}</section><aside className="inspector"><h3>Design check</h3><div className="validation good"><b>✓ 6 checks passed</b><span>Voltage, polarity and controller input are within configured limits.</span></div><div className="validation warn"><b>△ Review conductor</b><span>Specify wire length and temperature rating to validate voltage drop.</span></div><h4>Selected component</h4><label>Label<input value={nodes.find(n=>n.id===selected)?.type||"Select a component"} readOnly/></label><label>System voltage<select defaultValue="48"><option>12 V</option><option>24 V</option><option>48 V</option></select></label><p className="disclaimer">Planning assistance only. A passing check is not engineering approval or proof of code compliance.</p></aside></div></main>;
}

export function SolarApp({ section, pickerSearch = "" }: { section: string; communityThreadId?: string; productId?: string; pickerSearch?: string; productReturnTo?: string }) {
  usePageTools();
  let content=<NewHome/>;
  if(["products","catalog","deals","recommendations","product-detail"].includes(section)) content=<PriceTracker/>;
  if(section==="solar-part-picker") content=<PriceTracker initialSearch={pickerSearch}/>;
  if(section==="guides") content=<InteractiveGuidesPage/>;
  if(section==="calculators") content=<InteractiveCalculatorsPage/>;
  if(section==="planner") content=<PlannerPage/>;
  if(section==="diagrams") content=<DiagramsPage/>;
  if(["dashboard","community","community-test"].includes(section)) content=<WorkspacePage/>;
  if(["admin","diagnostics"].includes(section)) content=<DiagnosticsPage/>;
  return <div className="s4-app"><a href="#main-content" className="s4-skip">Skip to content</a><SiteHeader section={section}/><div id="main-content" className={["guides","calculators","planner","diagrams"].includes(section)?"legacy-app":""}>{content}</div><SiteFooter/></div>;
}
