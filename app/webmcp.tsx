"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, CircleCheck, ArrowUpRight } from "lucide-react";

export type AgentTool={name:string;title?:string;description:string;inputSchema:object;annotations?:{readOnlyHint?:boolean;untrustedContentHint?:boolean};execute:(input:unknown)=>unknown|Promise<unknown>};
type ModelContext={registerTool:(tool:AgentTool,options?:{signal:AbortSignal})=>void|Promise<void>;unregisterTool?:(name:string)=>void};
function getContext(){return (document as Document&{modelContext?:ModelContext}).modelContext??(navigator as Navigator&{modelContext?:ModelContext}).modelContext}
export function objectInput(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Expected a JSON object");return value as Record<string,unknown>}
export function useAgentTools(tools:AgentTool[]){
  const ref=useRef(tools);
  useEffect(()=>{ref.current=tools},[tools]);
  const names=tools.map(t=>t.name).join(",");
  useEffect(()=>{
    const ctx=getContext();if(!ctx?.registerTool)return;
    const lifecycle=new AbortController();const registered:string[]=[];
    for(const tool of ref.current){try{void Promise.resolve(ctx.registerTool({...tool,execute:input=>{
      const current=ref.current.find(t=>t.name===tool.name);if(!current)throw new Error("Tool is no longer available");return current.execute(input);
    }},{signal:lifecycle.signal})).then(()=>registered.push(tool.name)).catch(()=>{console.warn(`Could not register ${tool.name}`)})}catch{console.warn(`Could not register ${tool.name}`)}}
    return ()=>{lifecycle.abort();for(const name of registered)try{ctx.unregisterTool?.(name)}catch{}};
  },[names]);
}
export function usePageTools(){
  useEffect(()=>{try{localStorage.removeItem("solar4u-display-mode");localStorage.removeItem("solar4u-community-display-mode")}catch{}},[]);
  useAgentTools([
  {name:"solar4u_read_page",title:"Read Solar4U page",description:"Read the current Solar4U page title, route, and available navigation. Does not expose local project contents or account data.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:input=>{objectInput(input);return {title:document.title,path:location.pathname,sections:["/planner","/products","/guides","/calculators","/dashboard","/diagnostics"]}}},
  {name:"solar4u_read_service_status",title:"Read service status",description:"Read hosted API availability and price source freshness to troubleshoot Solar4U. Does not change data.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async input=>{objectInput(input);const r=await fetch("/api/health");if(!r.ok)throw new Error(`Service check failed (${r.status})`);return r.json()}},
  {name:"solar4u_start_navigation",title:"Open a Solar4U workspace",description:"Start navigation to a known Solar4U section. This opens the requested workspace; it does not create or save a project.",inputSchema:{type:"object",properties:{section:{type:"string",enum:["planner","products","guides","calculators","dashboard","diagnostics"]}},required:["section"],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{const {section}=objectInput(input);if(typeof section!=="string"||!["planner","products","guides","calculators","dashboard","diagnostics"].includes(section))throw new Error("Unknown Solar4U section");window.setTimeout(()=>location.assign(`/${section}`),0);return {status:"navigation_requested",path:`/${section}`}}}
])}
export function DiagnosticsPage(){
  const [status,setStatus]=useState<Record<string,unknown>|null>(null);const [error,setError]=useState("");const [supported,setSupported]=useState(false);
  async function refresh(){setError("");try{const r=await fetch("/api/health");if(!r.ok)throw new Error(`Connection check returned ${r.status}`);setStatus(await r.json())}catch(e){setError(e instanceof Error?e.message:"Connection failed")}}
  useEffect(()=>{const timer=setTimeout(()=>{setSupported(!!getContext()?.registerTool);void refresh()},0);return()=>clearTimeout(timer)},[]);
  return <main className="s4-page"><div className="s4-kicker"><Activity size={14}/> CONNECTIONS & ASSUMPTIONS</div><h1>A clear view<br/><em>under the hood.</em></h1><p className="s4-lead">Check whether the tools are connected and understand how the site handles your work.</p><div className="s4-feature-grid"><div className="s4-panel"><CircleCheck/><h2>Browser tools</h2><p>{supported?"WebMCP is available in this browser. Solar4U exposes structured tools for supported workflows.":"This browser does not expose WebMCP. All visible controls still work."}</p><p className="s4-muted">Read page · service status · open workspace. Individual workspaces expose their own tools.</p></div><div className="s4-panel"><h2>Hosted services</h2>{error?<p className="s4-error" role="alert">{error}</p>:<pre style={{whiteSpace:"pre-wrap",fontSize:11}}>{status?JSON.stringify(status,null,2):"Checking connection…"}</pre>}<button className="s4-button s4-light" onClick={refresh}>Check again</button></div><div className="s4-panel"><h2>Your data</h2><p>Projects, learning progress and your watchlist are saved on this device. Export your project to keep a portable backup.</p><p className="s4-muted">Public price observations are shared research data. Addresses are sent to a provider only when you request a lookup.</p><a className="s4-text-link" href="https://github.com/FahadArfin/Solar4U" target="_blank" rel="noreferrer">Review the source <ArrowUpRight size={15}/></a></div></div></main>
}
