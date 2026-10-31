/** Read-only legacy export. Run privately with the existing Vercel Redis settings. */
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export async function snapshot(redis,eventKey,prefix){
 const count=await redis(['LLEN',eventKey]);
 if(!Number.isSafeInteger(count)||count<0)throw new Error('Invalid legacy event count');
 const events=[];
 for(let start=0;start<count;start+=500){
  const page=await redis(['LRANGE',eventKey,start,Math.min(start+499,count-1)]);
  if(!Array.isArray(page)||page.length!==Math.min(500,count-start))throw new Error('Incomplete legacy event page');
  for(const raw of page){const event=JSON.parse(raw);if(!event||typeof event!=='object'||Array.isArray(event))throw new Error('Invalid legacy event');events.push(event)}
 }
 const keys=new Set();let cursor='0';const cursors=new Set();
 do{
  const page=await redis(['SCAN',cursor,'MATCH',`${prefix}:*`,'COUNT',500]);
  if(!Array.isArray(page)||page.length!==2||!Array.isArray(page[1]))throw new Error('Invalid legacy key scan');
  cursor=String(page[0]);if(!/^\d+$/.test(cursor)||cursor!=='0'&&cursors.has(cursor))throw new Error('Non-progressing legacy scan');
  cursors.add(cursor);for(const key of page[1])keys.add(String(key));
 }while(cursor!=='0');
 const runs=[],claims=[];
 for(const key of [...keys].sort()){
  if(!key.startsWith(`${prefix}:run:`)&&!key.startsWith(`${prefix}:claim:`))continue;
  const value=await redis(['GET',key]);if(value===null)throw new Error('Legacy dispatch key disappeared during export');
  if(key.startsWith(`${prefix}:run:`)){
   const run=JSON.parse(value);if(run.runKey!==key.slice(`${prefix}:run:`.length)||!run.completedAt)throw new Error('Invalid completed legacy run');runs.push(run);
  }else claims.push({runKey:key.slice(`${prefix}:claim:`.length),value});
 }
 const completed=new Set(runs.map(x=>x.runKey));
 const unresolvedClaims=claims.filter(x=>x.value!=='complete'||!completed.has(x.runKey));
 if(await redis(['LLEN',eventKey])!==count)throw new Error('Legacy history changed during export');
 return {events,runs,claims,unresolvedClaims};
}
export async function stableExport(redis,eventKey,prefix){
 const first=await snapshot(redis,eventKey,prefix),second=await snapshot(redis,eventKey,prefix);
 if(JSON.stringify(first)!==JSON.stringify(second))throw new Error('Legacy history changed between export passes');
 return {...first,exportedAt:new Date().toISOString(),eventKey,dispatchPrefix:prefix};
}
async function main(){
 const output=process.argv[2];
 if(!output||!process.argv.includes('--writers-frozen'))throw new Error('Require private output path and --writers-frozen after legacy writers are stopped');
 const url=new URL(process.env.UPSTASH_REDIS_REST_URL||'');
 if(url.protocol!=='https:'||!process.env.UPSTASH_REDIS_REST_TOKEN)throw new Error('Require existing HTTPS Redis endpoint and token');
 const redis=async command=>{
  const response=await fetch(url,{method:'POST',redirect:'error',headers:{authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,'content-type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Legacy storage HTTP ${response.status}`);
  const body=await response.json();if(body.error||!Object.hasOwn(body,'result'))throw new Error('Legacy storage command failed');return body.result;
 };
 const backup=await stableExport(redis,process.env.VESTA_FLOW_STORAGE_KEY||'vesta:flow:v1:events',process.env.VESTA_EMAIL_STORAGE_KEY||'vesta:critical-email:v1');
 const payload=JSON.stringify(backup);await writeFile(output,payload,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({eventRows:backup.events.length,completedRuns:backup.runs.length,unresolvedClaims:backup.unresolvedClaims.length,sha256:createHash('sha256').update(payload).digest('hex')}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Legacy export failed; no migration readiness should be enabled.');process.exitCode=1});
