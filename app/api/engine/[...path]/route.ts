import { localEstimate } from "../../../../services/solar-engine/model.mjs";

type Context={params:Promise<{path:string[]}>};
function numeric(value:unknown,min:number,max:number,fallback:number){const n=value===undefined?fallback:Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`Value must be between ${min} and ${max}`);return n}
async function estimate(input:Record<string,unknown>){
  const values={capacityKw:numeric(input.capacityKw,0,1000,10),latitude:numeric(input.latitude,-66,66,40),longitude:numeric(input.longitude,-180,180,0),tilt:numeric(input.tilt,0,90,30),azimuth:numeric(input.azimuth,0,360,180),lossesPercent:numeric(input.lossesPercent,0,99,14),electricityRate:numeric(input.electricityRate,0,10,.19),incentivePercent:0};
  const base=localEstimate(values);
  if(input.provider!=="pvgis"||values.capacityKw===0)return base;
  const q=new URLSearchParams({lat:String(values.latitude),lon:String(values.longitude),peakpower:String(values.capacityKw),loss:String(values.lossesPercent),angle:String(values.tilt),aspect:String(values.azimuth-180),outputformat:"json"});
  try{
    const r=await fetch(`https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?${q}`,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error("Climate provider unavailable");const data=await r.json();
    const monthlyKwh=(data.outputs?.monthly?.fixed??[]).map((m:{E_m:number})=>Math.round(m.E_m));if(monthlyKwh.length!==12||monthlyKwh.some((n:number)=>!Number.isFinite(n)||n<0))throw new Error("Incomplete climate data");
    const annualKwh=monthlyKwh.reduce((a:number,b:number)=>a+b,0);let cumulative=-base.netCost;
    const cashFlow=Array.from({length:25},(_,i)=>{const productionKwh=Math.round(annualKwh*Math.pow(.995,i));const annualSavings=Math.round(productionKwh*values.electricityRate*Math.pow(1.025,i));cumulative+=annualSavings;return {year:i+1,productionKwh,annualSavings,cumulativeSavings:Math.round(cumulative)}});
    return {...base,provider:"EU JRC PVGIS 5.3",annualKwh,monthlyKwh,yearlyBillValue:Math.round(annualKwh*values.electricityRate),cashFlow,warnings:["Bill value assumes all generated energy receives the entered rate. Use the financial calculator for your actual export arrangement."],sourceUrl:"https://re.jrc.ec.europa.eu/pvg_tools/en/"};
  }catch{return {...base,warnings:["Live climate data is unavailable. Showing a seasonal planning estimate with explicit assumptions."]}}
}
export async function POST(request:Request,context:Context){try{const {path}=await context.params;const route=path.join("/");if(Number(request.headers.get("content-length"))>20000)return Response.json({error:"Request too large"},{status:413});const input=await request.json();if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Expected an object");
  if(route==="v1/solar/estimates"){
    if(Array.isArray(input.arrays)&&input.arrays.length){if(input.arrays.length>12)throw new Error("Use at most 12 arrays");const estimates=await Promise.all(input.arrays.map((a:Record<string,unknown>)=>estimate({...input,...a,arrays:undefined})));const monthlyKwh=Array.from({length:12},(_,i)=>estimates.reduce((sum,e)=>sum+e.monthlyKwh[i],0));const annualKwh=monthlyKwh.reduce((a,b)=>a+b,0);return Response.json({data:{provider:estimates.every(e=>e.provider==="EU JRC PVGIS 5.3")?"EU JRC PVGIS 5.3 · multiple arrays":"Mixed seasonal estimates",annualKwh,monthlyKwh,yearlyBillValue:Math.round(annualKwh*numeric(input.electricityRate,0,10,.19)),warnings:estimates.flatMap(e=>"warnings" in e?e.warnings:[])}})}
    return Response.json({data:await estimate(input)});
  }
  if(route==="v1/solar/roof-analysis")return Response.json({data:{provider:"manual",available:false,reason:"Use the measured design studio. Remote roof data requires a configured provider."}});
  return Response.json({error:"Unsupported engine operation"},{status:404});
}catch(e){return Response.json({error:e instanceof Error?e.message:"Invalid request"},{status:400})}}
export async function GET(request:Request,context:Context){const {path}=await context.params;const route=path.join("/");if(route==="v1/solar/capabilities")return Response.json({data:{googleSolar:false,googleGeocoding:false,googlePhotorealistic3d:false,roofVision:false,manual:true}});
  if(["v1/locations/search","v1/solar/geocode"].includes(route)){const q=new URL(request.url).searchParams.get("q")?.trim();if(!q||q.length<2||q.length>150)return Response.json({error:"Enter a city or postal code (2–150 characters)"},{status:400});try{const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error();const body=await r.json();return Response.json({data:(body.results??[]).map((v:{id:number;name:string;latitude:number;longitude:number;admin1?:string;country?:string})=>({...v,label:[v.name,v.admin1,v.country].filter(Boolean).join(", "),state:v.admin1,precision:"locality"})),attribution:"Open-Meteo / GeoNames. Locality matches are not measured building locations."})}catch{return Response.json({error:"Location service unavailable",data:[]},{status:503})}}
  return Response.json({error:"This imagery provider is not configured"},{status:503});
}
