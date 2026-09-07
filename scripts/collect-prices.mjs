import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalogRequest,normalizeCatalog,safeCatalogEndpoint,mergeObservations,AGENT_PROFILE} from '../services/price-worker/catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sources=JSON.parse(await readFile(resolve(root,'services/price-worker/retailers.config.json'),'utf8'));
const output=resolve(process.env.PRICE_DATA_DIR??resolve(root,'tmp/price-data'));
await mkdir(resolve(output,'history'),{recursive:true});await mkdir(resolve(output,'runs'),{recursive:true});
const read=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}};
const old=await read(resolve(output,'latest.json'),{offers:[]});const at=new Date().toISOString();const day=at.slice(0,10);const run={id:`${day}-${Date.now()}`,startedAt:at,finishedAt:null,schedule:'Daily at 07:17 UTC',sources:[],observations:0};
const saved=new Map(old.offers.map(o=>[o.id,o]));const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function collect(source){let endpoint;const record={id:source.id,name:source.name,url:source.baseUrl,status:'checking',reason:'',checkedAt:new Date().toISOString(),observations:0,pages:0,coverage:'Bounded catalog search: solar, battery and inverter. This is not a complete store inventory.'};
try{
  const r=await fetch(`${new URL(source.baseUrl).origin}/.well-known/ucp`,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error(`discovery_http_${r.status}`);const raw=await r.text();if(raw.length>1_000_000)throw new Error('Discovery too large');let discovery;try{discovery=JSON.parse(raw)}catch{throw new Error('catalog_not_advertised')}
  const capabilities=discovery.ucp?.capabilities??{};if(!capabilities['dev.ucp.shopping.catalog.search'])throw new Error('catalog_not_advertised');
  // Read endpoints only from a reviewed source origin; redirects are disabled.
  const services=discovery.ucp?.services?.['dev.ucp.shopping'];const candidates=(Array.isArray(services)?services:Object.values(services??{})).filter(s=>s.transport==='mcp').map(s=>s.endpoint);endpoint=candidates.find(value=>{try{return !!safeCatalogEndpoint(value,source.baseUrl)}catch{return false}});if(!endpoint)throw new Error('catalog_endpoint_unavailable');endpoint=safeCatalogEndpoint(endpoint,source.baseUrl);
  const unique=new Map();let partial=false;
  const prior=old.offers.filter(o=>o.retailerId===source.id).slice(0,500);
  let stopped=false;
  if(capabilities['dev.ucp.shopping.catalog.lookup'])for(let i=0;i<prior.length;i+=10){
    await delay(1500);try{const data=await catalogRequest(endpoint,'',{ids:prior.slice(i,i+10).map(o=>o.variantId),profile:process.env.UCP_AGENT_PROFILE_URL??AGENT_PROFILE});record.pages++;for(const offer of normalizeCatalog(data,source))unique.set(offer.id,offer)}catch(e){partial=true;record.reason=e.message;if(/catalog_http_(429|401|403)/.test(e.message)){stopped=true;record.reason+='; deferred to next daily run';break}}
  }
  searches: for(const query of stopped?[]:['solar','battery','inverter']){let cursor;for(let page=0;page<2;page++){
    await delay(1500);
    let data;try{data=await catalogRequest(endpoint,query,{cursor,profile:process.env.UCP_AGENT_PROFILE_URL??AGENT_PROFILE})}catch(e){partial=true;record.reason=e.message;if(/catalog_http_(429|401|403)/.test(e.message)){record.reason+='; deferred to next daily run';break searches}continue}
    record.pages++;for(const offer of normalizeCatalog(data,source))unique.set(offer.id,offer);
    if(unique.size>=500){partial=true;break}if(!data.pagination?.has_next_page)break;cursor=data.pagination.cursor;if(!cursor)break;if(page===1)partial=true;
  }if(unique.size>=500)break}
  const offers=[...unique.values()].slice(0,500);for(const offer of offers)saved.set(offer.id,offer);
  const path=resolve(output,'history',`${source.id}.json`);const history=await read(path,{});await writeFile(path,JSON.stringify(mergeObservations(history,offers)));
  record.observations=offers.length;record.status=offers.length?(partial?'partial':'observed'):'no_observations';if(!record.reason)record.reason=offers.length?(partial?'Catalog pages limited; observed variants recorded.':'Public retailer catalog returned prices.'):'No priced solar variants returned.';run.observations+=offers.length;
}catch(e){record.status=String(e.message).includes('catalog_not')?'catalog_not_available':'unavailable';record.reason=e.message;}
record.checkedAt=new Date().toISOString();run.sources.push(record);console.log(`${record.id}: ${record.status}, ${record.observations} observations`)}
const queue=[...sources];await Promise.all(Array.from({length:4},async()=>{while(queue.length)await collect(queue.shift())}));
run.sources.sort((a,b)=>a.id.localeCompare(b.id));run.finishedAt=new Date().toISOString();
const latest={schemaVersion:1,generatedAt:run.finishedAt,schedule:run.schedule,dayTimezone:'UTC',runId:run.id,sources:run.sources,offers:[...saved.values()].filter(o=>Date.now()-Date.parse(o.observedAt)<90*86400000)};
await writeFile(resolve(output,'latest.json'),JSON.stringify(latest));await writeFile(resolve(output,'runs',`${day}.json`),JSON.stringify(run,null,2));
console.log(`Recorded ${run.observations} observations; ${run.sources.filter(s=>s.observations).length}/${sources.length} retailers returned prices.`);
if(!run.observations)process.exitCode=2;
