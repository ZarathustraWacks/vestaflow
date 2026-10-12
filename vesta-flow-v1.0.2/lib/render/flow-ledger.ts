/** Server-to-server persistence on the existing Render API; never expose its key to browsers. */
export function ledgerConfigured(){return Boolean(process.env.VESTA_LEARNING_API_URL&&process.env.VESTA_LEARNING_API_KEY&&/^[A-Za-z0-9_-]{1,80}$/.test(process.env.VESTA_FLOW_LEDGER_NAMESPACE||''))}
export function ledgerReady(){return ledgerConfigured()&&process.env.VESTA_FLOW_HISTORY_VERIFIED==='true'}
export async function ledger<T>(path:string,body?:unknown):Promise<T>{
 if(!ledgerReady())throw new Error('Render Flow ledger is not configured or historical reconciliation is pending.');
 const base=process.env.VESTA_LEARNING_API_URL!.replace(/\/$/,'');
 const url=new URL(`${base}/v1/flow-ledger/${process.env.VESTA_FLOW_LEDGER_NAMESPACE}${path}`);
 if(url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Flow ledger requires HTTPS.');
 const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${process.env.VESTA_LEARNING_API_KEY}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Flow ledger unavailable (${response.status}).`);
 const value=await response.json();if(value.ok!==true)throw new Error('Invalid Flow ledger response.');return value as T;
}
