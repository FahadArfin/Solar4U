import {createHash} from 'node:crypto';
export const AGENT_PROFILE='https://raw.githubusercontent.com/FahadArfin/Solar4U/main/public/ucp-agent.json';
const safeText=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,500);
export function safeCatalogEndpoint(value,base){const u=new URL(value);const source=new URL(base);if(u.protocol!=='https:'||u.username||u.password||!(u.hostname===source.hostname||u.hostname.endsWith('.myshopify.com')||u.hostname==='www.wixapis.com')||!u.pathname.endsWith('/mcp'))throw new Error('Unapproved catalog endpoint');return u.href}
export function minorToMajor(amount,currency){if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Invalid minor-unit price');const places=new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;return amount/10**places}
function externalUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
export function normalizeCatalog(data,source,observedAt=new Date().toISOString()){
  const result=[];
  for(const p of data.products??[]){for(const v of p.variants??[]){const price=v.price;const currency=String(price?.currency??'').toUpperCase();if(!/^[A-Z]{3}$/.test(currency)||!Number.isSafeInteger(price?.amount)||price.amount<=0||!v.id)continue;
    let productUrl=externalUrl(v.url??p.url);if(!productUrl)continue;const shopifyId=String(v.id).match(/^gid:\/\/shopify\/ProductVariant\/(\d+)$/);if(shopifyId){const u=new URL(productUrl);u.searchParams.set('variant',shopifyId[1]);productUrl=u.href}
    const id=createHash('sha256').update(`${source.id}|${v.id}|${currency}`).digest('hex').slice(0,24);
    const title=safeText(p.title??p.name);const variant=safeText(v.title??v.name);const text=`${title} ${variant}`;
    const category=/battery|lifepo4|lithium|\bkwh\b/i.test(text)?'Battery':/inverter|power station/i.test(text)?'Inverter':/controller|mppt/i.test(text)?'Controller':/panel|module|bifacial/i.test(text)?'Solar panel':'Equipment';
    const wattsMatch=text.match(/(?:^|\s)(\d{2,4})\s*(?:w|watt)(?:\s|$)/i);
    result.push({id,variantId:String(v.id),sku:safeText(v.sku),name:title,variant,category,retailerId:source.id,retailer:source.name,price:minorToMajor(price.amount,currency),minorAmount:price.amount,currency,available:typeof v.availability?.available==='boolean'?v.availability.available:null,url:productUrl,image:externalUrl(p.media?.[0]?.url??p.images?.[0]?.url??v.media?.[0]?.url),watts:wattsMatch?Number(wattsMatch[1]):null,observedAt,method:'retailer_catalog',shippingIncluded:false});
  }}return result;
}
export async function catalogRequest(endpoint,query,{profile=AGENT_PROFILE,cursor,fetcher=fetch,limit=30,ids}={}){
  const request={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:ids?'lookup_catalog':'search_catalog',arguments:{meta:{'ucp-agent':{profile}},catalog:{...(ids?{ids}:{query,pagination:{limit,...(cursor?{cursor}:{})}}),context:{address_country:'US',currency:'USD'}}}}};
  const response=await fetcher(endpoint,{method:'POST',redirect:'error',headers:{'content-type':'application/json','accept':'application/json','user-agent':'Solar4UPriceResearch/1.0 (+https://github.com/FahadArfin/Solar4U)'},body:JSON.stringify(request),signal:AbortSignal.timeout(25000)});
  if(!response.ok){const error=new Error(`catalog_http_${response.status}`);error.retryAfter=response.headers.get('retry-after');throw error}
  const raw=await response.text();if(raw.length>6_000_000)throw new Error('Catalog response exceeded limit');const rpc=JSON.parse(raw);if(rpc.error||rpc.result?.isError)throw new Error(`catalog_error: ${safeText(JSON.stringify(rpc.error??rpc.result)).slice(0,200)}`);
  const data=rpc.result?.structuredContent??JSON.parse(rpc.result?.content?.find(c=>c.type==='text')?.text??'{}');if(data.ucp?.status&&data.ucp.status!=='success')throw new Error('Catalog UCP status was not success');if(!Array.isArray(data.products))throw new Error('Catalog returned no product collection');return data;
}
export function mergeObservations(previous,offers){const next={...previous};for(const offer of offers){const values=[...(next[offer.id]??[])];const day=offer.observedAt.slice(0,10);const index=values.findIndex(v=>v[0].slice(0,10)===day);const point=[offer.observedAt,offer.minorAmount,offer.available];if(index===-1)values.push(point);else values[index]=point;next[offer.id]=values.sort((a,b)=>a[0].localeCompare(b[0])).slice(-366)}return next}
