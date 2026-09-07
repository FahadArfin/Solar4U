const DATA='https://raw.githubusercontent.com/FahadArfin/Solar4U/price-data';
export async function GET(request:Request){
  const q=new URL(request.url).searchParams;const source=q.get('source');const id=q.get('id');
  if((source&&!/^[a-z0-9-]{2,60}$/.test(source))||(id&&!/^[a-f0-9]{24}$/.test(id)))return Response.json({error:'Invalid history identifier'},{status:400});
  try{const response=await fetch(`${DATA}/${source&&id?`history/${source}.json`:'latest.json'}`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Price observations are not available yet');const body=await response.json();
    if(source&&id)return Response.json({id,source,points:body[id]??[],note:'Only successful dated observations are shown. Missing days are not prices.'},{headers:{'cache-control':'public, max-age=300'}});
    return Response.json(body,{headers:{'cache-control':'public, max-age=300'}});
  }catch{return Response.json({error:'The latest retailer observation file could not be loaded. Please try again.',offers:[],sources:[]},{status:503,headers:{'cache-control':'no-store'}})}
}
