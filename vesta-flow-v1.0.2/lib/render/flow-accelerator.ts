/** Server-only delivery transport. Ledger, learner, coaching and FUB writes keep their own connections. */
import {getConfig} from '@/lib/fub/config';

export async function fetchFlowDelivery(path:string,cache:RequestCache='no-store'):Promise<Response>{
 if(!/^\/v1\/manager-delivery(?:\/assigned\/\d+|\/[-a-zA-Z0-9]+\/\d+)?$/.test(path))throw new Error('Invalid Flow delivery path');
 const legacy=getConfig();
 const candidates=[
  {url:process.env.VESTA_FLOW_ACCELERATOR_URL,key:process.env.VESTA_FLOW_ACCELERATOR_READ_KEY},
  {url:legacy.renderLearningUrl,key:legacy.renderLearningKey},
 ];
 for(const connection of candidates){
  const url=connection.url?.trim().replace(/\/$/,''),key=connection.key?.trim();
  if(!url||!key)continue;
  try{
   if(new URL(url).protocol!=='https:')continue;
   const response=await fetch(url+path,{headers:{authorization:`Bearer ${key}`},cache,redirect:'error',signal:AbortSignal.timeout(8000)});
   if(response.ok)return response;
  }catch{/* A failed optional accelerator must not break the established fallback. */}
 }
 throw new Error('Flow delivery is unavailable');
}

/** Called after durable completion, never used as proof that an action was saved. */
export async function enqueueFlowContactRefresh(personId:string){
 const url=process.env.VESTA_FLOW_ACCELERATOR_URL?.trim().replace(/\/$/,''),key=process.env.VESTA_FLOW_ACCELERATOR_REFRESH_KEY?.trim();
 if(!url||!key||!/^\d+$/.test(personId))return {queued:false};
 try{
  if(new URL(url).protocol!=='https:')return {queued:false};
  const response=await fetch(url+'/v1/refresh',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({scope:'contact',target:personId}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(1500)});
  return {queued:response.status===202};
 }catch{return {queued:false};}
}
