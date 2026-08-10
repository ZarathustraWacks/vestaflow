import type { FlowEvent } from './types';
export async function sendManagementAlert(event:FlowEvent,lead:any,trigger:string){
 const url=process.env.VESTA_MANAGEMENT_ALERT_WEBHOOK?.trim();
 if(!url)return {configured:false,delivered:false,message:'Management webhook is not configured; the exception remains visible in the management queue.'};
 try{
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(process.env.VESTA_MANAGEMENT_ALERT_TOKEN?{authorization:`Bearer ${process.env.VESTA_MANAGEMENT_ALERT_TOKEN}`}:{})},body:JSON.stringify({type:'vesta-flow-management-alert',trigger,event,lead:{id:lead.id,name:lead.name,stage:lead.stage,source:lead.source,lane:lead.leadLane,assignedUserName:lead.assignedUserName,decision:lead.decision,governanceScore:lead.governanceScore,learningScore:lead.learningScore}}),cache:'no-store',signal:AbortSignal.timeout(10000)});
  return {configured:true,delivered:response.ok,message:response.ok?'Management alert delivered.':`Management webhook returned ${response.status}.`};
 }catch(error){return {configured:true,delivered:false,message:error instanceof Error?error.message:'Management alert failed.'};}
}
