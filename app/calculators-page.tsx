"use client";

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import Image from "next/image";

type Id = "pv"|"battery"|"voltage"|"fuse"|"array"|"controller"|"cable"|"tou"|"payback";
type PvResult = {provider:string;annualKwh:number;monthlyKwh:number[];yearlyBillValue:number;warnings?:string[]};
type ArraySection = {id:number;capacityKw:number;azimuth:number;tilt:number};
type ControllerArray = {id:number;useSharedSpecs:boolean;voc:number;vmp:number;isc:number;imp:number;series:number;parallel:number};
type LocationResult = {id:number;label:string;name:string;state:string;country:string;latitude:number;longitude:number};
const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const tools:{id:Id;icon:string;label:string}[]=[
  {id:"pv",icon:"☀",label:"PV production"},{id:"battery",icon:"▤",label:"Battery runtime"},
  {id:"voltage",icon:"↯",label:"Voltage drop"},{id:"fuse",icon:"⏚",label:"Fuse & breaker"},
  {id:"array",icon:"◇",label:"Array voltage"},{id:"controller",icon:"⌁",label:"Charge controller"},
  {id:"cable",icon:"≈",label:"Solar cable gauge"},
  {id:"tou",icon:"◷",label:"TOU battery"},{id:"payback",icon:"$",label:"Payback"},
];
const compassPoints=[
  {short:"N",label:"North",value:0,position:"north"},
  {short:"NE",label:"Northeast",value:45,position:"northeast"},
  {short:"E",label:"East",value:90,position:"east"},
  {short:"SE",label:"Southeast",value:135,position:"southeast"},
  {short:"S",label:"South",value:180,position:"south"},
  {short:"SW",label:"Southwest",value:225,position:"southwest"},
  {short:"W",label:"West",value:270,position:"west"},
  {short:"NW",label:"Northwest",value:315,position:"northwest"},
] as const;
const resistance:Record<string,{Copper:number;Aluminum:number}>={
  "14 AWG":{Copper:2.525,Aluminum:4.016},"12 AWG":{Copper:1.588,Aluminum:2.525},
  "10 AWG":{Copper:.999,Aluminum:1.588},"8 AWG":{Copper:.6282,Aluminum:.9987},
  "6 AWG":{Copper:.3951,Aluminum:.6282},"4 AWG":{Copper:.2485,Aluminum:.3951},
  "2 AWG":{Copper:.1563,Aluminum:.2485},"1/0 AWG":{Copper:.0983,Aluminum:.1563},
  "2/0 AWG":{Copper:.0779,Aluminum:.1239},"4/0 AWG":{Copper:.049,Aluminum:.0779},
};
const standards=[5,10,15,20,25,30,35,40,45,50,60,70,80,90,100,110,125,150,175,200,225,250,300,350,400];
const next=(value:number)=>standards.find(size=>size>=value)??Math.ceil(value/50)*50;
const cableCatalog=[
  ["16 AWG",4.016,6.385,10,8,.62,.44],["14 AWG",2.525,4.016,15,12,.78,.55],["12 AWG",1.588,2.525,20,15,1.02,.7],
  ["10 AWG",.999,1.588,30,25,1.42,.94],["8 AWG",.6282,.9987,40,35,2.05,1.28],["6 AWG",.3951,.6282,55,45,3.05,1.82],
  ["4 AWG",.2485,.3951,70,55,4.4,2.5],["2 AWG",.1563,.2485,95,75,6.5,3.55],["1/0 AWG",.0983,.1563,125,100,9.8,5.15],
  ["2/0 AWG",.0779,.1239,145,115,12.4,6.2],["4/0 AWG",.049,.0779,195,150,19.5,9.4],
] as const;
const controllerCatalog=[
  {brand:"Victron",model:"SmartSolar MPPT 150/45",maxPv:150,amps:45,batteries:[12,24,36,48]},
  {brand:"Victron",model:"SmartSolar MPPT 150/60",maxPv:150,amps:60,batteries:[12,24,48]},
  {brand:"Victron",model:"SmartSolar MPPT 150/70",maxPv:150,amps:70,batteries:[12,24,48]},
  {brand:"Victron",model:"SmartSolar MPPT 250/100",maxPv:250,amps:100,batteries:[12,24,48]},
  {brand:"MidNite Solar",model:"KID MPPT",maxPv:150,amps:30,batteries:[12,24,36,48]},
  {brand:"MidNite Solar",model:"Classic 150",maxPv:150,amps:96,batteries:[12,24,36,48]},
  {brand:"MidNite Solar",model:"Classic 200",maxPv:200,amps:79,batteries:[12,24,36,48]},
  {brand:"MidNite Solar",model:"Classic 250",maxPv:250,amps:63,batteries:[12,24,36,48]},
  {brand:"OutBack Power",model:"FLEXmax 60",maxPv:150,amps:60,batteries:[12,24,36,48]},
  {brand:"OutBack Power",model:"FLEXmax 80",maxPv:150,amps:80,batteries:[12,24,36,48]},
  {brand:"OutBack Power",model:"FLEXmax 100 AFCI",maxPv:300,amps:100,batteries:[24,36,48]},
  {brand:"Morningstar",model:"TriStar MPPT 150/45",maxPv:150,amps:45,batteries:[12,24,48]},
  {brand:"Morningstar",model:"TriStar MPPT 150/60",maxPv:150,amps:60,batteries:[12,24,48]},
  {brand:"Morningstar",model:"TriStar MPPT 600V/60",maxPv:600,amps:60,batteries:[48]},
  {brand:"Renogy",model:"Rover 60A MPPT",maxPv:140,amps:60,batteries:[12,24,36,48]},
  {brand:"EPEVER",model:"Tracer 5415AN",maxPv:150,amps:50,batteries:[12,24,36,48]},
  {brand:"EPEVER",model:"Tracer 6415AN",maxPv:150,amps:60,batteries:[12,24,36,48]},
  {brand:"EPEVER",model:"Tracer 10415AN",maxPv:150,amps:100,batteries:[12,24,36,48]},
  {brand:"PowMr",model:"POW-M60-PRO",maxPv:160,amps:60,batteries:[12,24,36,48]},
  {brand:"PowMr",model:"POW-M100-PRO",maxPv:160,amps:100,batteries:[12,24,36,48]},
  {brand:"ECO-WORTHY",model:"60A MPPT OLED",maxPv:150,amps:60,batteries:[12,24,36,48]},
] as const;

function localPv(v:Record<string,number>):PvResult{
  const days=[31,28,31,30,31,30,31,31,30,31,30,31],mid=[15,45,74,105,135,166,196,227,258,288,319,349];
  const phi=Math.abs(v.lat)*Math.PI/180,tilt=v.tilt*Math.PI/180;
  const raw=mid.map((day,index)=>{
    const declination=23.45*Math.sin(2*Math.PI*(284+day)/365)*Math.PI/180;
    const sunset=Math.acos(Math.max(-1,Math.min(1,-Math.tan(phi)*Math.tan(declination))));
    const daylight=24*sunset/Math.PI,elevation=Math.max(.04,Math.sin(Math.PI/2-Math.abs(phi-declination)));
    return days[index]*daylight*elevation*(.55+.45*Math.max(.08,Math.cos(Math.abs(phi-declination-tilt))));
  });
  const total=raw.reduce((a,b)=>a+b,0),ideal=v.lat>=0?180:0,diff=Math.abs(((v.azimuth-ideal+540)%360)-180);
  const annualKwh=Math.round(v.kw*v.sun*365*(1-v.loss/100)*Math.max(.54,1-diff/390)*Math.max(.76,1-Math.abs(v.tilt-Math.abs(v.lat)*.76)/175));
  const monthlyKwh=raw.map(x=>Math.round(annualKwh*x/total));
  monthlyKwh[11]+=annualKwh-monthlyKwh.reduce((a,b)=>a+b,0);
  return {provider:"Solar4U local seasonal model",annualKwh,monthlyKwh,yearlyBillValue:Math.round(annualKwh*v.rate)};
}
function paybackProjection(v:Record<string,number>){
  const net=v.cost*(1-v.incentive/100);
  const flows=Array.from({length:25}).reduce<number[]>((all,_,i)=>{
    const previous=i===0?-net:all[i-1];
    const savings=v.production*Math.pow(1-v.degradation/100,i)*v.rate*Math.pow(1+v.escalation/100,i)-v.maintenance;
    return [...all,previous+savings];
  },[]);
  const index=flows.findIndex(value=>value>=0);
  return {net,flows,payback:index<0?null:index+1};
}
function sizeCable(voltage:number,current:number,length:number,dropTarget:number,material:"Copper"|"Aluminum"){
  const required=current*1.25;
  const candidates=cableCatalog.map(row=>{
    const [gauge,copperOhms,aluminumOhms,copperAmpacity,aluminumAmpacity,copperCost,aluminumCost]=row;
    const ohms=material==="Copper"?copperOhms:aluminumOhms,ampacity=material==="Copper"?copperAmpacity:aluminumAmpacity;
    const dropVolts=2*length*current*ohms/1000;
    return {gauge,ampacity,dropVolts,dropPercent:dropVolts/Math.max(1,voltage)*100,costPerFt:material==="Copper"?copperCost:aluminumCost};
  });
  const result=candidates.find(x=>x.ampacity>=required&&x.dropPercent<=dropTarget)??candidates.at(-1)!;
  return {...result,required,cost:result.costPerFt*length*2,meets:result.ampacity>=required&&result.dropPercent<=dropTarget};
}

function Num({label,value,set,unit,min=0,max,step=1}:{label:string;value:number;set:(v:number)=>void;unit?:string;min?:number;max?:number;step?:number}){
  const [entry,setEntry]=useState({committed:value,draft:String(value)});
  const draft=entry.committed===value?entry.draft:String(value);
  const rangeMax=max??Math.max(10,Math.ceil(Math.max(value,1)*2));
  const commit=(raw:string)=>{
    const parsed=Number(raw);
    const bounded=Math.min(rangeMax,Math.max(min,Number.isFinite(parsed)?parsed:min));
    setEntry({committed:bounded,draft:String(bounded)});
    set(bounded);
  };
  return <label className="number-field"><span>{label}<strong>{value.toLocaleString()} {unit}</strong></span><div><input aria-label={`${label} typed value`} type="number" value={draft} min={min} max={rangeMax} step={step} onChange={e=>{const raw=e.target.value;const parsed=Number(raw);setEntry({committed:value,draft:raw});if(raw!==""&&Number.isFinite(parsed)&&parsed>=min&&parsed<=rangeMax){setEntry({committed:parsed,draft:raw});set(parsed)}}} onBlur={e=>commit(e.target.value)}/>{unit&&<b>{unit}</b>}</div><input aria-label={`${label} slider`} className="field-slider" type="range" value={Math.max(min,Math.min(rangeMax,value))} min={min} max={rangeMax} step={step} onChange={e=>commit(e.target.value)}/><small><i>{min.toLocaleString()}</i><i>{rangeMax.toLocaleString()}</i></small></label>;
}
function Select({label,value,set,options}:{label:string;value:string|number;set:(v:string)=>void;options:{label:string;value:string|number}[]}){
  return <label className="select-field"><span>{label}</span><select value={value} onChange={e=>set(e.target.value)}>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>;
}
function OrientationCompass({label,value,set}:{label:string;value:number;set:(v:number)=>void}){
  const [hovered,setHovered]=useState<number|null>(null);
  const preview=hovered??value;
  const closest=compassPoints.reduce((best,point)=>{
    const distance=Math.abs(((preview-point.value+540)%360)-180);
    const bestDistance=Math.abs(((preview-best.value+540)%360)-180);
    return distance<bestDistance?point:best;
  },compassPoints[0]);
  return <fieldset className="orientation-compass"><legend>{label}</legend><div className="compass-dial" onMouseLeave={()=>setHovered(null)}>
    <div className="compass-ring" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div className="compass-needle" aria-hidden="true" style={{transform:`rotate(${preview}deg)`}}><i></i></div>
    {compassPoints.map(point=><button type="button" key={point.short} className={`compass-point ${point.position} ${value===point.value?"active":""}`} aria-label={`Face panels ${point.label}, ${point.value} degrees`} onMouseEnter={()=>setHovered(point.value)} onFocus={()=>setHovered(point.value)} onBlur={()=>setHovered(null)} onClick={()=>set(point.value)}><b>{point.short}</b><span>{point.value}°</span></button>)}
    <label className="compass-center"><span>Exact heading</span><input aria-label={`${label} exact degrees`} type="number" min={0} max={359} step={1} value={value} onChange={event=>{if(event.target.value!=="")set(Math.min(359,Math.max(0,Number(event.target.value))))}}/><b>degrees</b></label>
  </div><output><b>{closest.label}</b><span>{preview.toFixed(preview%1===0?0:1)}° from north</span></output><small>Hover to preview · click to select</small></fieldset>;
}
function Discrete({label,value,set,values,unit}:{label:string;value:number;set:(v:number)=>void;values:number[];unit?:string}){
  const index=Math.max(0,values.indexOf(value));
  return <label className="number-field discrete-field"><span>{label}<strong>{value.toLocaleString()} {unit}</strong></span><output>{value} {unit}</output><input aria-label={`${label} stepped slider`} className="field-slider" type="range" min={0} max={values.length-1} step={1} value={index} onChange={event=>set(values[Number(event.target.value)])}/><small>{values.map(option=><button type="button" className={value===option?"active":""} key={option} onClick={()=>set(option)}>{option}</button>)}</small></label>;
}
function Results({items}:{items:[string,string,string?,boolean?][]}){
  return <div className="calc-results">{items.map(([label,value,unit,warn])=><div className={warn?"warn":""} key={label}><small>{label}</small><b>{value} {unit&&<em>{unit}</em>}</b></div>)}</div>;
}
function Intro({title,copy}:{title:string;copy:string}){return <div className="calculator-intro"><small>ACTIVE CALCULATOR</small><h2>{title}</h2><p>{copy}</p></div>}
function Note({children,warn=false}:{children:ReactNode;warn?:boolean}){return <p className={`calculation-status ${warn?"warn":"good"}`}>{children}</p>}

export default function CalculatorsPage(){
  const [active,setActive]=useState<Id>("pv");
  const [v,setV]=useState<Record<string,number>>({kw:10,lat:42.9997,lon:-78.8658,sun:3.55,tilt:35,azimuth:180,loss:14,rate:.19,
    capacity:10,load:750,dod:90,eff:92,volts:48,current:30,length:40,ampacity:60,voc:49.5,vmp:41.7,isc:10.4,imp:9.6,series:8,parallel:2,minTemp:-15,coefficient:-.28,
    controllerVoc:49.5,controllerVmp:41.7,controllerIsc:10.4,controllerImp:9.6,
    batteryVolts:48,dailyUsage:30,onShare:35,midShare:30,peakRate:.38,midRate:.22,offRate:.12,reserve:20,autonomy:2,roundTrip:90,cableDrop:2,
    cost:30000,incentive:0,production:11000,escalation:2.5,maintenance:100,degradation:.5});
  const set=(key:string)=>(value:number)=>setV(old=>({...old,[key]:value}));
  const [gauge,setGauge]=useState("6 AWG"),[material,setMaterial]=useState<"Copper"|"Aluminum">("Copper");
  const [manualOverride,setManualOverride]=useState(false),[remote,setRemote]=useState<PvResult|null>(null),[loading,setLoading]=useState(false);
  const [advanced,setAdvanced]=useState(false),[arrays,setArrays]=useState<ArraySection[]>([{id:1,capacityKw:5,azimuth:180,tilt:35},{id:2,capacityKw:5,azimuth:90,tilt:30}]);
  const [advancedSettings,setAdvancedSettings]=useState(false),[overrideLabels,setOverrideLabels]=useState<string[]>([]);
  const [controllerAdvanced,setControllerAdvanced]=useState(false);
  const [controllerArrays,setControllerArrays]=useState<ControllerArray[]>([{id:1,useSharedSpecs:true,voc:49.5,vmp:41.7,isc:10.4,imp:9.6,series:8,parallel:2}]);
  const [locationQuery,setLocationQuery]=useState(""),[locationResults,setLocationResults]=useState<LocationResult[]>([]),[locationLoading,setLocationLoading]=useState(false);
  const local=useMemo(()=>{
    if(!advanced)return localPv(v);
    const pieces=arrays.map(array=>localPv({...v,kw:array.capacityKw,azimuth:array.azimuth,tilt:array.tilt}));
    const monthlyKwh=months.map((_,month)=>pieces.reduce((sum,piece)=>sum+piece.monthlyKwh[month],0));
    const annualKwh=monthlyKwh.reduce((sum,value)=>sum+value,0);
    return {provider:"Solar4U multi-array seasonal model",monthlyKwh,annualKwh,yearlyBillValue:Math.round(annualKwh*v.rate)};
  },[v,advanced,arrays]),pv=remote||local,maxMonth=Math.max(...pv.monthlyKwh,1);
  const field=(children:ReactNode)=><div className="calculator-fields">{children}</div>;
  const formula=(text:string)=><p className="formula">{text}</p>;

  async function updatePv(){
    setRemote(null); if(manualOverride)return; setLoading(true);
    try{
      const response=await fetch("/api/engine/v1/solar/estimates",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({provider:"pvgis",capacityKw:v.kw,latitude:v.lat,longitude:v.lon,tilt:v.tilt,azimuth:v.azimuth,lossesPercent:v.loss,electricityRate:v.rate,arrays:advanced?arrays:undefined})});
      if(!response.ok)throw new Error(); const payload=await response.json(); setRemote(payload.data);
    }catch{setRemote({...local,warnings:["Live PVGIS was unavailable, so this result uses the local seasonal model."]});}
    finally{setLoading(false)}
  }
  async function searchLocation(){
    if(locationQuery.trim().length<2)return; setLocationLoading(true);
    try{const response=await fetch(`/api/engine/v1/locations/search?q=${encodeURIComponent(locationQuery.trim())}`);const payload=await response.json();setLocationResults(payload.data||[])}catch{setLocationResults([])}finally{setLocationLoading(false)}
  }
  function chooseLocationResult(location:LocationResult){
    setV(old=>({...old,lat:location.latitude,lon:location.longitude}));setLocationQuery(location.label);setLocationResults([]);setRemote(null);setOverrideLabels(old=>old.filter(label=>label!=="latitude"&&label!=="longitude"));
  }
  function pickMap(event:MouseEvent<HTMLDivElement>){
    const box=event.currentTarget.getBoundingClientRect(),x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;
    setV(old=>({...old,lon:Number((x*360-180).toFixed(4)),lat:Number(Math.max(-66,Math.min(66,90-y*180)).toFixed(4))}));setRemote(null);setOverrideLabels(old=>old.filter(label=>label!=="latitude"&&label!=="longitude"));
  }
  function updateArray(id:number,key:keyof Omit<ArraySection,"id">,value:number){setArrays(old=>old.map(item=>item.id===id?{...item,[key]:value}:item));setRemote(null)}
  function updateControllerArray(id:number,changes:Partial<Omit<ControllerArray,"id">>){setControllerArrays(old=>old.map(item=>item.id===id?{...item,...changes}:item))}
  function overrideValue(key:string,label:string){return (value:number)=>{set(key)(value);setOverrideLabels(old=>old.includes(label)?old:[...old,label]);setRemote(null)}}
  function changeClimateSource(value:string){const manual=value==="manual";setManualOverride(manual);setRemote(null);setOverrideLabels(old=>manual?(old.includes("climate source")?old:[...old,"climate source"]):old.filter(label=>label!=="climate source"))}

  useEffect(()=>{void (async()=>{
    try{const response=await fetch("/api/engine/v1/solar/estimates",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({provider:"pvgis",capacityKw:10,latitude:42.9997,longitude:-78.8658,tilt:35,azimuth:180,lossesPercent:14,electricityRate:.19})});if(response.ok){const payload=await response.json();setRemote(payload.data)}}catch{/* The local seasonal preview remains available. */}
  })()},[]);

  let content:ReactNode;
  if(active==="pv")content=<>
    <section className="location-picker"><div className="world-map" role="button" tabIndex={0} aria-label="Pick a rough worldwide location" onClick={pickMap}><Image src="/world-map-equirectangular.png" alt="Equirectangular world map" fill sizes="(max-width: 680px) 100vw, 900px" priority/><span className="map-marker" style={{left:`${(v.lon+180)/360*100}%`,top:`${(90-v.lat)/180*100}%`}}>●</span><b>Click the map to choose a rough location</b><small>{v.lat.toFixed(3)}°, {v.lon.toFixed(3)}°</small></div>
      <div className="location-search"><label><span>Address, city or postal code</span><div><input value={locationQuery} onChange={e=>setLocationQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void searchLocation()}} placeholder="e.g. Tonawanda, Toronto, Berlin, 14150"/><button onClick={searchLocation}>{locationLoading?"Searching…":"Find location"}</button></div></label>{locationResults.length>0&&<div className="location-results">{locationResults.map(location=><button key={location.id} onClick={()=>chooseLocationResult(location)}><b>{location.name}</b><span>{[location.state,location.country].filter(Boolean).join(", ")}</span></button>)}</div>}<small>Worldwide locality and postal-code search by Open‑Meteo / GeoNames. Street-level addresses depend on the available locality data.</small></div>
    </section>
    <div className="mode-switch"><div><b>Array configuration</b><span>Use advanced mode for roof faces or ground mounts with different directions.</span></div><button className={!advanced?"active":""} onClick={()=>{setAdvanced(false);setRemote(null)}}>Single array</button><button className={advanced?"active":""} onClick={()=>{setAdvanced(true);setRemote(null)}}>Multiple arrays</button></div>
    {!advanced?<div className="single-array-configuration">{field(<><Num label="Array capacity" value={v.kw} set={set("kw")} unit="kW" max={50} step={.1}/><Num label="Panel tilt" value={v.tilt} set={set("tilt")} unit="°" max={90}/></>)}<OrientationCompass label="Panel orientation" value={v.azimuth} set={set("azimuth")}/></div>:<div className="array-sections">{arrays.map((array,index)=><article key={array.id}><header><b>Array {index+1}</b>{arrays.length>1&&<button onClick={()=>setArrays(old=>old.filter(item=>item.id!==array.id))}>Remove</button>}</header><Num label="Capacity" value={array.capacityKw} set={value=>updateArray(array.id,"capacityKw",value)} unit="kW" max={30} step={.1}/><Num label="Tilt" value={array.tilt} set={value=>updateArray(array.id,"tilt",value)} unit="°" max={90}/><OrientationCompass label={`Array ${index+1} orientation`} value={array.azimuth} set={value=>updateArray(array.id,"azimuth",value)}/></article>)}<button className="add-array" onClick={()=>setArrays(old=>[...old,{id:Date.now(),capacityKw:3,azimuth:180,tilt:30}])}>+ Add another roof face or ground array</button></div>}
    <section className={`advanced-settings ${advancedSettings?"open":""}`}><button className="advanced-settings-toggle" aria-expanded={advancedSettings} onClick={()=>setAdvancedSettings(open=>!open)}><span><b>Advanced settings</b><small>Coordinates, provider, losses and financial assumptions</small></span><i>⌄</i></button><div className="advanced-settings-content"><div className={`override-status ${overrideLabels.length?"active":""}`}>{overrideLabels.length?<><b>User-overridden variables</b><span>{overrideLabels.join(" · ")}</span></>:<><b>Live defaults active</b><span>Settings only become overrides after you change them manually.</span></>}</div>{field(<><Num label="Latitude" value={v.lat} set={overrideValue("lat","latitude")} min={-66} max={66} step={.0001}/><Num label="Longitude" value={v.lon} set={overrideValue("lon","longitude")} min={-180} max={180} step={.0001}/><Num label="System losses" value={v.loss} set={overrideValue("loss","system losses")} unit="%" max={40}/><Num label="Electricity rate" value={v.rate} set={overrideValue("rate","electricity rate")} unit="$/kWh" max={1} step={.01}/><Select label="Climate data source" value={manualOverride?"manual":"pvgis"} set={changeClimateSource} options={[{label:"Live PVGIS climate data (default)",value:"pvgis"},{label:"Manual seasonal model",value:"manual"}]}/>{manualOverride&&<Num label="Manual peak sun hours" value={v.sun} set={overrideValue("sun","peak sun hours")} unit="hr/day" max={8} step={.05}/>}</>)}</div></section>
    <button className="primary-button calculate-button" onClick={updatePv} disabled={loading}>{loading?"Calculating…":manualOverride?"Use manual estimate":"Refresh live PVGIS estimate"}</button>
    <Results items={[["Estimated production",pv.annualKwh.toLocaleString(),"kWh/yr"],["Estimated bill value",`$${pv.yearlyBillValue.toLocaleString()}`,"/yr"],["Strongest month",months[pv.monthlyKwh.indexOf(maxMonth)],`${maxMonth.toLocaleString()} kWh`]]}/>
    <section className="monthly-panel"><div><h3>Monthly production</h3><span>{pv.provider}</span></div><div className="monthly-chart">{pv.monthlyKwh.map((x,i)=><div className="month-column" key={months[i]}><b>{x.toLocaleString()}</b><i style={{height:`${Math.max(5,x/maxMonth*100)}%`}}></i><span>{months[i]}</span></div>)}</div></section>
    {pv.warnings?.map(x=><p className="calculator-warning" key={x}>{x}</p>)}{formula("Includes seasonal daylight and solar-angle effects. Shade, snow, clipping and equipment behavior can change actual production.")}</>;
  else if(active==="battery"){const usable=v.capacity*v.dod/100*v.eff/100,hours=usable*1000/Math.max(1,v.load);content=<><Intro title="Battery runtime" copy="Estimate duration after reserve and inverter losses."/>{field(<><Num label="Battery capacity" value={v.capacity} set={set("capacity")} unit="kWh" min={.1} max={10000} step={.1}/><Num label="Continuous load" value={v.load} set={set("load")} unit="W" min={1} max={1000000}/><Num label="Depth of discharge" value={v.dod} set={set("dod")} unit="%" max={100}/><Num label="Inverter efficiency" value={v.eff} set={set("eff")} unit="%" min={1} max={100}/></>)}<Results items={[["Usable energy",usable.toFixed(2),"kWh"],["Runtime",hours.toFixed(1),"hours"],["Duration",(hours/24).toFixed(2),"days"]]}/>{formula("capacity × depth of discharge × efficiency ÷ load")}</>}
  else if(active==="voltage"){const drop=2*v.length*v.current*resistance[gauge][material]/1000,percent=drop/v.volts*100;content=<><Intro title="Voltage drop" copy="Calculate round-trip conductor loss using standard DC resistance values."/>{field(<><Num label="System voltage" value={v.volts} set={set("volts")} unit="V" min={.1} max={1000} step={.1}/><Num label="Current" value={v.current} set={set("current")} unit="A" min={.1} max={1000} step={.1}/><Num label="One-way length" value={v.length} set={set("length")} unit="ft" min={.1} max={100} step={.1}/><Select label="Wire size" value={gauge} set={setGauge} options={Object.keys(resistance).map(x=>({label:x,value:x}))}/><Select label="Conductor" value={material} set={x=>setMaterial(x as "Copper"|"Aluminum")} options={["Copper","Aluminum"].map(x=>({label:x,value:x}))}/></>)}<Results items={[["Voltage drop",drop.toFixed(2),"V",percent>3],["Percent drop",percent.toFixed(2),"%",percent>3],["Voltage at load",Math.max(0,v.volts-drop).toFixed(2),"V"]]}/><Note warn={percent>3}>{percent<=3?"Within the common 3% design target.":"Review a larger conductor or shorter run; this exceeds the common 3% target."}</Note>{formula("2 × one-way length × current × conductor resistance ÷ 1,000")}</>}
  else if(active==="fuse"){const minimum=v.current*1.25,recommended=next(minimum),bad=v.ampacity<recommended;content=<><Intro title="Fuse & breaker sizing" copy="Apply a continuous-load factor and compare the next standard size with conductor ampacity."/>{field(<><Num label="Continuous current" value={v.current} set={set("current")} unit="A" min={.1} max={1000} step={.1}/><Num label="Adjusted conductor ampacity" value={v.ampacity} set={set("ampacity")} unit="A" min={.1} max={1000} step={.1}/></>)}<Results items={[["Calculated minimum",minimum.toFixed(1),"A"],["Standard device",String(recommended),"A",bad],["Conductor check",bad?"Too small":"Pass","",bad]]}/><Note warn={bad}>{bad?"Do not use this combination: protection exceeds the entered conductor ampacity.":"The entered conductor ampacity is not below the suggested protection rating."}</Note>{formula("continuous current × 125%, rounded up to a standard device size")}</>}
  else if(active==="array"){const multiplier=1+Math.abs(v.coefficient)/100*Math.max(0,25-v.minTemp),cold=v.voc*v.series*multiplier;content=<><Intro title="Array voltage & current" copy="Check cold-weather Voc and series/parallel operating values."/>{field(<><Num label="Panel Voc" value={v.voc} set={set("voc")} unit="V" min={.1} max={1000} step={.1}/><Num label="Panel Vmp" value={v.vmp} set={set("vmp")} unit="V" min={.1} max={1000} step={.1}/><Num label="Panel Isc" value={v.isc} set={set("isc")} unit="A" min={.1} max={1000} step={.1}/><Num label="Panel Imp" value={v.imp} set={set("imp")} unit="A" min={.1} max={1000} step={.1}/><Num label="Panels in series" value={v.series} set={set("series")} min={1} max={100}/><Num label="Parallel strings" value={v.parallel} set={set("parallel")} min={1} max={100}/><Num label="Minimum temperature" value={v.minTemp} set={set("minTemp")} unit="°C" min={-60} max={60}/><Num label="Voc temp coefficient" value={v.coefficient} set={set("coefficient")} unit="%/°C" min={-2} max={0} step={.01}/></>)}<Results items={[["Cold array Voc",cold.toFixed(1),"V"],["Array Vmp",(v.vmp*v.series).toFixed(1),"V"],["Array Isc",(v.isc*v.parallel).toFixed(1),"A"],["Nominal power",(v.vmp*v.imp*v.series*v.parallel/1000).toFixed(2),"kW"]]}/>{formula("cold Voc = panel Voc × series count × temperature correction")}</>}
  else if(active==="controller"){
    const arrayDetails=controllerArrays.map(array=>{
      const specs=array.useSharedSpecs?{voc:v.controllerVoc,vmp:v.controllerVmp,isc:v.controllerIsc,imp:v.controllerImp}:array;
      const temperatureMultiplier=1+Math.abs(v.coefficient)/100*Math.max(0,25-v.minTemp);
      return {...array,...specs,arrayWatts:specs.vmp*specs.imp*array.series*array.parallel,arrayVmp:specs.vmp*array.series,arrayIsc:specs.isc*array.parallel,arrayImp:specs.imp*array.parallel,coldVoc:specs.voc*array.series*temperatureMultiplier};
    });
    const arrayWatts=arrayDetails.reduce((sum,array)=>sum+array.arrayWatts,0);
    const arrayWithinLimit=arrayWatts<=100000;
    const amps=arrayWatts/v.batteryVolts*1.25;
    const suggested=next(amps);
    const cold=Math.max(...arrayDetails.map(array=>array.coldVoc),0);
    const nominalBatteryVoltage=v.batteryVolts===400?0:v.batteryVolts;
    const brands=[...new Set(controllerCatalog.map(product=>product.brand))];
    const recommendations=brands.map(brand=>({brand,product:arrayWithinLimit&&nominalBatteryVoltage?controllerCatalog.filter(product=>product.brand===brand&&product.maxPv>=cold*1.05&&(product.batteries as readonly number[]).includes(nominalBatteryVoltage)).sort((a,b)=>(Math.ceil(amps/a.amps)-Math.ceil(amps/b.amps))||((Math.ceil(amps/a.amps)*a.amps)-(Math.ceil(amps/b.amps)*b.amps)))[0]:undefined}));
    content=<><Intro title="Charge controller sizing" copy="Build the array from panel electrical specifications, series modules and parallel strings."/>
      <section className="panel-spec-section"><div><small>SHARED PANEL SPECIFICATION</small><p>These defaults can be reused by every array or replaced on an individual array.</p></div>{field(<><Num label="Panel Voc" value={v.controllerVoc} set={set("controllerVoc")} unit="V" min={.1} max={60} step={.1}/><Num label="Panel Vmp" value={v.controllerVmp} set={set("controllerVmp")} unit="V" min={.1} max={60} step={.1}/><Num label="Panel Isc" value={v.controllerIsc} set={set("controllerIsc")} unit="A" min={.1} max={25} step={.1}/><Num label="Panel Imp" value={v.controllerImp} set={set("controllerImp")} unit="A" min={.1} max={20} step={.1}/></>)}</section>
      <section className="controller-array-sections"><div className="section-heading"><div><small>ARRAY CONFIGURATION</small><h3>Series and parallel groups</h3></div><button onClick={()=>setControllerArrays(old=>[...old,{id:Date.now(),useSharedSpecs:true,voc:v.controllerVoc,vmp:v.controllerVmp,isc:v.controllerIsc,imp:v.controllerImp,series:8,parallel:1}])}>+ Add another array</button></div>{controllerArrays.map((array,index)=><article key={array.id}><header><div><b>Array {index+1}</b><span>{array.useSharedSpecs?"Shared panel specs":"Custom panel specs"}</span></div>{controllerArrays.length>1&&<button onClick={()=>setControllerArrays(old=>old.filter(item=>item.id!==array.id))}>Remove</button>}</header><Select label="Panel specification" value={array.useSharedSpecs?"shared":"custom"} set={value=>updateControllerArray(array.id,value==="shared"?{useSharedSpecs:true}:{useSharedSpecs:false,voc:v.controllerVoc,vmp:v.controllerVmp,isc:v.controllerIsc,imp:v.controllerImp})} options={[{label:"Use shared panel specs",value:"shared"},{label:"Use different panel specs",value:"custom"}]}/>{!array.useSharedSpecs&&field(<><Num label="Panel Voc" value={array.voc} set={value=>updateControllerArray(array.id,{voc:value})} unit="V" min={.1} max={60} step={.1}/><Num label="Panel Vmp" value={array.vmp} set={value=>updateControllerArray(array.id,{vmp:value})} unit="V" min={.1} max={60} step={.1}/><Num label="Panel Isc" value={array.isc} set={value=>updateControllerArray(array.id,{isc:value})} unit="A" min={.1} max={25} step={.1}/><Num label="Panel Imp" value={array.imp} set={value=>updateControllerArray(array.id,{imp:value})} unit="A" min={.1} max={20} step={.1}/></>)}{field(<><Num label="Panels in series" value={array.series} set={value=>updateControllerArray(array.id,{series:value})} min={1} max={100}/><Num label="Parallel strings" value={array.parallel} set={value=>updateControllerArray(array.id,{parallel:value})} min={1} max={100}/></>)}<div className="array-electrical-summary"><span><small>Operating voltage</small><b>{arrayDetails[index].arrayVmp.toFixed(1)} V</b></span><span><small>Operating current</small><b>{arrayDetails[index].arrayImp.toFixed(1)} A</b></span><span><small>Array power</small><b>{Math.round(arrayDetails[index].arrayWatts).toLocaleString()} W</b></span></div></article>)}</section>
      <Discrete label="Battery voltage" value={v.batteryVolts} set={set("batteryVolts")} values={[12,24,48,400]} unit="V"/>
      <section className={`advanced-settings ${controllerAdvanced?"open":""}`}><button className="advanced-settings-toggle" aria-expanded={controllerAdvanced} onClick={()=>setControllerAdvanced(open=>!open)}><span><b>Advanced settings</b><small>Cold-weather voltage correction</small></span><i>⌄</i></button><div className="advanced-settings-content">{field(<><Num label="Minimum temperature" value={v.minTemp} set={set("minTemp")} unit="°C" min={-60} max={60}/><Num label="Voc temperature coefficient" value={v.coefficient} set={set("coefficient")} unit="%/°C" min={-2} max={0} step={.01}/></>)}</div></section>
      <Results items={[["Calculated array power",arrayWatts.toLocaleString(undefined,{maximumFractionDigits:0}),"W",!arrayWithinLimit],["Highest operating voltage",Math.max(...arrayDetails.map(array=>array.arrayVmp),0).toFixed(1),"V"],["Combined short-circuit current",arrayDetails.reduce((sum,array)=>sum+array.arrayIsc,0).toFixed(1),"A"],["Minimum output",amps.toFixed(1),"A"],["Suggested current class",String(suggested),"A"],["Highest cold-array Voc",cold.toFixed(1),"V"],["PV input target",String(Math.ceil(cold*1.1/10)*10),"V or higher"]]}/>
      {!arrayWithinLimit&&<Note warn>Reduce the series count, parallel strings, or panel power. Charge-controller sizing is limited to 100,000 W of array power.</Note>}
    <section className="controller-recommendations"><div><h3>Recommended charge controllers</h3><p>Smallest catalog configuration from each brand that clears cold Voc, charge-current and nominal battery-voltage checks.</p></div><div className="controller-grid">{recommendations.map(({brand,product})=>{const quantity=product?Math.ceil(amps/product.amps):0;return <article className={product?"compatible":"unmatched"} key={brand}><header><b>{brand}</b><span>{product?"Compatible":"No catalog match"}</span></header>{product?<><h4>{quantity>1?`${quantity} × `:""}{product.model}</h4><div><span>PV input</span><b>{product.maxPv} V each</b></div><div><span>Total charge output</span><b>{product.amps*quantity} A</b></div><small>{Math.round(product.maxPv-cold)} V cold-headroom · {Math.round(product.amps*quantity-amps)} A combined current-headroom</small></>:<><h4>{v.batteryVolts>64?"High-voltage controller required":"Review a higher-voltage design"}</h4><small>{arrayWithinLimit?"No model in this starter catalog accepts the entered cold string voltage and nominal battery voltage.":"Bring the array below the 100,000 W calculator limit before matching products."}</small></>}</article>})}</div><p className="recommendation-caveat">Compatibility shortlist only. Multiple controllers require the parallel strings to be divided into suitable independent inputs. Confirm manufacturer PV power and input-current limits, MPPT operating window, battery profile, terminal size, temperature derating, warranty and listing before purchase.</p></section>
    {formula("panel Vmp × panel Imp × series modules × parallel strings = array watts; array watts ÷ battery voltage × 125% = minimum controller output")}</>}
  else if(active==="cable"){const cable=sizeCable(v.volts,v.current,v.length,v.cableDrop,material),bands=[5,10,15,20,30,40,50,60,70,80,90,100,120,150,200],lengths=[4,7,10,15,20,25,30];content=<><Intro title="Solar & battery cable gauge" copy="Choose a conductor using both continuous-current ampacity and voltage drop, then explore the dynamic current/length table."/>
    {field(<><Num label="System voltage" value={v.volts} set={set("volts")} unit="V" max={600}/><Num label="Continuous current" value={v.current} set={set("current")} unit="A" max={200}/><Num label="One-way cable length" value={v.length} set={set("length")} unit="ft" max={200}/><Num label="Maximum voltage drop" value={v.cableDrop} set={set("cableDrop")} unit="%" min={.5} max={5} step={.1}/><Select label="Conductor material" value={material} set={x=>setMaterial(x as "Copper"|"Aluminum")} options={["Copper","Aluminum"].map(x=>({label:x,value:x}))}/></>)}
    <Results items={[["Recommended gauge",cable.gauge],["Calculated drop",cable.dropPercent.toFixed(2),"%",!cable.meets],["Required ampacity",cable.required.toFixed(1),"A"],["Estimated cable",`$${cable.cost.toFixed(0)}`,`${v.length*2} conductor ft`]]}/>
    <Note warn={!cable.meets}>{cable.meets?`${cable.gauge} ${material.toLowerCase()} satisfies the entered ampacity and ${v.cableDrop}% voltage-drop targets in this planning model.`:"The largest modeled conductor does not meet these inputs. Seek an engineered parallel-conductor design."}</Note>
    <section className="cable-table-panel"><div><h3>Dynamic cable size chart</h3><span>{v.volts} V · {material} · {v.cableDrop}% maximum drop</span></div><div className="cable-table"><div className="corner">Amps ↓ / feet →</div>{lengths.map(length=><b key={length}>{length} ft</b>)}{bands.map((upper,row)=>{const lower=row===0?0:bands[row-1];return <div className="cable-row" key={upper}><b>{lower}–{upper} A</b>{lengths.map(length=>{const result=sizeCable(v.volts,upper,length,v.cableDrop,material),index=cableCatalog.findIndex(item=>item[0]===result.gauge);return <span className={`gauge-color g${index}`} key={length}>{result.gauge}</span>})}</div>})}</div></section>
    <section className="cable-diagram"><h3>Connection sketch</h3><div><article><i>▤</i><b>Battery / array</b><span>{v.volts} V source</span></article><em className="wire"><b>{cable.gauge} {material}</b><span>{v.length} ft one way</span></em><article className="fuse-node"><i>⏚</i><b>Protection</b><span>{next(v.current*1.25)} A class</span></article><em className="wire"><b>{cable.dropPercent.toFixed(2)}% drop</b><span>{(v.volts-cable.dropVolts).toFixed(1)} V at load</span></em><article><i>⌁</i><b>Controller / inverter</b><span>{v.current} A design load</span></article></div></section>
    {formula("The cost is a rough material-only model, not a retailer quote. Terminal ratings, insulation, bundling, ambient temperature, conduit fill, parallel conductors and local code still require review.")}</>}
  else if(active==="tou"){const usableFraction=v.roundTrip/100*(1-v.reserve/100),shiftable=v.dailyUsage*(v.onShare+v.midShare)/100,tou=shiftable/Math.max(.01,usableFraction),emergency=v.dailyUsage*v.autonomy/Math.max(.01,usableFraction),recommended=Math.max(tou,emergency),avoided=v.dailyUsage*(v.onShare/100*v.peakRate+v.midShare/100*v.midRate),dailySavings=Math.max(0,avoided-shiftable/(v.roundTrip/100)*v.offRate);content=<><Intro title="Time-of-use & emergency battery" copy="Enter all three tariff periods, average daily consumption, reserve, and the number of no-grid/no-solar days you want to cover."/>
    <section className="rate-periods"><article className="on"><div><b>On peak</b><span>Highest-price hours</span></div><Num label="Energy share" value={v.onShare} set={set("onShare")} unit="%" max={100}/><Num label="Electricity price" value={v.peakRate} set={set("peakRate")} unit="$/kWh" max={1} step={.01}/></article><article className="mid"><div><b>Mid peak</b><span>Shoulder hours</span></div><Num label="Energy share" value={v.midShare} set={set("midShare")} unit="%" max={100-v.onShare}/><Num label="Electricity price" value={v.midRate} set={set("midRate")} unit="$/kWh" max={1} step={.01}/></article><article className="off"><div><b>Off peak</b><span>Charging window · {Math.max(0,100-v.onShare-v.midShare)}% of daily use</span></div><Num label="Electricity price" value={v.offRate} set={set("offRate")} unit="$/kWh" max={1} step={.01}/></article></section>
    {field(<><Num label="Average daily consumption" value={v.dailyUsage} set={set("dailyUsage")} unit="kWh/day" max={150} step={.5}/><Num label="Backup reserve" value={v.reserve} set={set("reserve")} unit="%" max={80}/><Num label="No-grid / no-solar autonomy" value={v.autonomy} set={set("autonomy")} unit="days" min={0} max={10} step={.5}/><Num label="Battery round-trip efficiency" value={v.roundTrip} set={set("roundTrip")} unit="%" min={50} max={100}/></>)}
    <Results items={[["TOU shifting need",tou.toFixed(1),"kWh"],["Emergency autonomy need",emergency.toFixed(1),"kWh"],["Recommended nominal battery",recommended.toFixed(1),"kWh"],["Estimated annual TOU value",`$${Math.round(dailySavings*365).toLocaleString()}`,"/yr"]]}/>
    <div className="battery-recommendation"><div><span style={{width:`${Math.min(100,tou/recommended*100)}%`}}>TOU {tou.toFixed(1)} kWh</span></div><div><span style={{width:`${Math.min(100,emergency/recommended*100)}%`}}>Emergency {emergency.toFixed(1)} kWh</span></div><p>The larger requirement governs: <b>{emergency>=tou?"emergency autonomy":"time-of-use shifting"}</b>.</p></div>
    {formula("recommended nominal capacity = larger of TOU-shifting energy or emergency daily energy × autonomy days, adjusted for reserve and round-trip efficiency")}</>}
  else {const {net,flows,payback}=paybackProjection(v),max=Math.max(...flows.map(Math.abs),1);content=<><Intro title="Solar payback" copy="Model 25-year cash flow with escalation, degradation and maintenance."/>{field(<><Num label="Gross installed cost" value={v.cost} set={set("cost")} unit="$" max={250000}/><Num label="Incentives / credits" value={v.incentive} set={set("incentive")} unit="%" max={100}/><Num label="First-year production" value={v.production} set={set("production")} unit="kWh" max={1000000}/><Num label="Electricity rate" value={v.rate} set={set("rate")} unit="$/kWh" max={2} step={.01}/><Num label="Annual rate escalation" value={v.escalation} set={set("escalation")} unit="%" max={10} step={.1}/><Num label="Annual maintenance" value={v.maintenance} set={set("maintenance")} unit="$" max={10000}/><Num label="Panel degradation" value={v.degradation} set={set("degradation")} unit="%/yr" max={5} step={.1}/></>)}<Results items={[["Net upfront",`$${Math.round(net).toLocaleString()}`],["Simple payback",payback?`Year ${payback}`:"Beyond 25 years","",!payback],["25-year net",`$${Math.round(flows[24]).toLocaleString()}`,"",flows[24]<0]]}/><div className="cashflow-chart">{flows.map((x,i)=><div key={i}><i className={x>=0?"positive":""} style={{height:`${Math.max(3,Math.abs(x)/max*100)}%`}}></i><span>{i+1}</span></div>)}</div>{formula("cumulative savings begin at negative net cost; financing, replacements and export compensation excluded")}</>}

  return <main className="page-main"><div className="page-heading"><div className="eyebrow">CHECK THE MATH</div><h1>Solar calculators</h1><p>Fast answers with visible formulas, units, climate-aware production and conservative defaults.</p></div><div className="calculator-layout"><div className="calc-list" role="tablist">{tools.map(x=><button role="tab" aria-selected={active===x.id} className={active===x.id?"active":""} onClick={()=>setActive(x.id)} key={x.id}><span>{x.icon}</span>{x.label}</button>)}</div><section className="calculator-card" role="tabpanel">{content}</section></div><p className="safety-banner"><b>Planning assistance, not a final design.</b> Verify conductor ampacity, protection, equipment limits, structural assumptions, utility rules, permits and local code with qualified professionals.</p></main>;
}
