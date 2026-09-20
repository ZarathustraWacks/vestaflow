import {NextRequest,NextResponse} from 'next/server';
const base=()=>(process.env.VESTA_LEARNING_API_URL||process.env.VESTA_RENDER_LEARNING_API_URL||'').replace(/\/$/,'');
const key=()=>process.env.VESTA_LEARNING_API_KEY||process.env.VESTA_RENDER_LEARNING_API_KEY||'';
const headers=()=>({Authorization:`Bearer ${key()}`,'Content-Type':'application/json'});
async function active(brokerId:string){return fetch(`${base()}/v1/pip/brokers/${encodeURIComponent(brokerId)}/active`,{headers:headers(),cache:'no-store'});}
function ready(){return process.env.VESTA_FLOW_PIP_ENABLED==='true'&&Boolean(base()&&key())}
export async function GET(request:NextRequest){
 if(!ready())return NextResponse.json({error:'Improvement plans are not enabled.'},{status:404});
 const brokerId=request.nextUrl.searchParams.get('brokerId')?.trim();if(!brokerId)return NextResponse.json({error:'A broker identity is required.'},{status:400});
 const response=await active(brokerId);return NextResponse.json(await response.json(),{status:response.status,headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:NextRequest){
 if(!ready())return NextResponse.json({error:'Improvement plans are not enabled.'},{status:404});
 const body=await request.json(),brokerId=String(body.brokerId||'').trim(),kind=String(body.kind||'');if(!brokerId)return NextResponse.json({error:'A broker identity is required.'},{status:400});
 const current=await active(brokerId),payload=await current.json();if(!current.ok||!payload.item)return NextResponse.json({error:'No active plan was found for this broker.'},{status:404});
 const planId=String(payload.item.id),path=kind==='dispute'?'disputes':'checkins',data=kind==='dispute'?{brokerId,metricKey:body.metricKey||null,snapshotId:body.snapshotId||null,note:String(body.note||'')}:{actorId:brokerId,actorRole:'broker',kind:'acknowledgement',note:String(body.note||'Reviewed and acknowledged')};
 const response=await fetch(`${base()}/v1/pip/plans/${encodeURIComponent(planId)}/${path}`,{method:'POST',headers:headers(),body:JSON.stringify(data),cache:'no-store'});return NextResponse.json(await response.json(),{status:response.status});
}
