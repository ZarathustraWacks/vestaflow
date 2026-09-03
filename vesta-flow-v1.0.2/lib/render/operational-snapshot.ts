/** Authenticated transport for Render's completed operational mirror snapshot. */
export const OPERATIONAL_SNAPSHOT_CONTRACT='vesta-operational-source-v1';

export type SnapshotCheckpoint={collection:string;updatedAt:string;completedCycles:number;stillPaging:boolean};
export type OperationalSnapshot={
 snapshotId:string;
 syncRunId:string;
 generatedAt:string;
 sourceSyncedAt:string;
 contractVersion:string;
 completeness:'complete'|'partial';
 counts:Record<string,number>;
 checkpoints:SnapshotCheckpoint[];
 collections:{people:unknown[];users:unknown[];tasks:unknown[];appointments:unknown[]};
};
export type OperationalSnapshotMeta=Omit<OperationalSnapshot,'collections'>;

const base=()=>process.env.VESTA_LEARNING_API_URL?.replace(/\/$/,'')||'';
const key=()=>process.env.VESTA_LEARNING_API_KEY?.trim()||'';
export const operationalSnapshotEnabled=()=>process.env.VESTA_OPERATIONAL_SNAPSHOT_ENABLED?.trim().toLowerCase()==='true'&&Boolean(base()&&key());
export const snapshotRevalidateSeconds=()=>{const parsed=Number(process.env.VESTA_OPERATIONAL_SNAPSHOT_REVALIDATE_SECONDS);return Number.isInteger(parsed)&&parsed>=60?Math.min(parsed,3600):300};

function validate(payload:unknown):OperationalSnapshot{
 if(!payload||typeof payload!=='object')throw new Error('Render returned an invalid operational snapshot');
 const item=payload as Partial<OperationalSnapshot>,collections=item.collections as OperationalSnapshot['collections']|undefined;
 if(item.contractVersion!==OPERATIONAL_SNAPSHOT_CONTRACT)throw new Error(`Unsupported Render snapshot contract: ${item.contractVersion||'missing'}`);
 if(!item.snapshotId||!item.sourceSyncedAt||!collections||!Array.isArray(collections.people)||!Array.isArray(collections.users)||!Array.isArray(collections.tasks)||!Array.isArray(collections.appointments))throw new Error('Render operational snapshot is incomplete');
 return item as OperationalSnapshot;
}

export async function fetchOperationalSnapshot():Promise<OperationalSnapshot>{
 if(!operationalSnapshotEnabled())throw new Error('Render operational snapshots are not enabled');
 const response=await fetch(`${base()}/v1/operational-snapshot`,{headers:{authorization:`Bearer ${key()}`},cache:'no-store',signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw new Error(`Render operational snapshot request failed (${response.status})`);
 return validate(await response.json());
}

export async function fetchOperationalSnapshotMeta():Promise<OperationalSnapshotMeta>{
 if(!operationalSnapshotEnabled())throw new Error('Render operational snapshots are not enabled');
 const response=await fetch(`${base()}/v1/operational-snapshot/meta`,{headers:{authorization:`Bearer ${key()}`},cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error(`Render snapshot metadata request failed (${response.status})`);
 const body=await response.json() as {snapshot?:OperationalSnapshotMeta};
 if(!body.snapshot?.snapshotId||body.snapshot.contractVersion!==OPERATIONAL_SNAPSHOT_CONTRACT)throw new Error('Render snapshot metadata is invalid');
 return body.snapshot;
}
