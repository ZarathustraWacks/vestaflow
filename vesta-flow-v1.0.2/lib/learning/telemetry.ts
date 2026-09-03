const base=()=>process.env.VESTA_RENDER_LEARNING_API_URL?.replace(/\/$/,'')||'';
const enabled=()=>process.env.VESTA_RENDER_FLOW_TELEMETRY_ENABLED==='true';
export async function sendFlowTelemetry(payload:Record<string,unknown>){
 if(!enabled()||!base())return {enabled:false,delivered:false};
 try{const response=await fetch(`${base()}/v1/decisions`,{method:'POST',headers:{'content-type':'application/json',...(process.env.VESTA_RENDER_LEARNING_API_KEY?{authorization:`Bearer ${process.env.VESTA_RENDER_LEARNING_API_KEY}`}:{})},body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(1200)});return {enabled:true,delivered:response.ok,status:response.status}}
 catch{return {enabled:true,delivered:false}}
}
