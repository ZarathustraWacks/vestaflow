/** One durable submission per obligation; ambiguous sends permit read-only recovery. */
import {actionEventId,claimAction,markActionSending,finishActionClaim} from './action-claim';
import {appendFlowEvent} from './store';
import {findCompletionInFub,syncCompletionToFub} from '../fub/writeback';
import type {FlowEvent} from './types';
export async function completeObligation(actionId:string,event:FlowEvent,input:any,mode:'demo'|'live',dependencies={claimAction,markActionSending,finishActionClaim,appendFlowEvent,findCompletionInFub,syncCompletionToFub}){
 const draft={contractVersion:'vesta-next-action-submission-v2',event:{...event,id:actionEventId(actionId)},input:{...input,actionId},mode};
 const claim=await dependencies.claimAction(actionId,draft),saved=claim.draft;
 if(!saved||saved.contractVersion!==draft.contractVersion||saved.input?.actionId!==actionId||saved.event?.leadId!==event.leadId||saved.event?.actorUserId!==event.actorUserId||saved.mode!==mode)throw Error('The saved action does not match this contact and broker. Reload before trying again.');
 const token=claim.token||claim.recoveryToken;if(!token)throw Error('This action is already processing. Refresh its saved result before retrying.');
 let sync;
 if(claim.token){await dependencies.markActionSending(claim.runKey,token);sync=await dependencies.syncCompletionToFub(saved.input,mode);}
 else{sync=await dependencies.findCompletionInFub(saved.input);if(!sync)throw Error('The previous sync is not yet confirmed in FUB. No second note was sent. Refresh or ask management to reconcile this action.');}
 if(!sync.delivered||mode==='live'&&(sync.simulated||!sync.resourceId))throw Error('FUB has not confirmed this action.');
 const persisted:FlowEvent={...saved.event,verificationStatus:'reported-note-readback',metadata:{...saved.event.metadata,fubSync:{delivered:sync.delivered,simulated:sync.simulated,resource:sync.resource,resourceId:sync.resourceId}}};
 await dependencies.appendFlowEvent(persisted);
 await dependencies.finishActionClaim(claim.runKey,token,{event:persisted});
 return {event:persisted,sync};
}
