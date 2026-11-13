'use client';
import React,{useEffect,useMemo,useState} from 'react';
import {paths,outcomes,research} from '@/lib/appointment/catalog';
import {approve,assemble,contextFor,contextKey,edit,emptyWorkspace,exportReview,gate,hold,recordResult,restore,simulate,step,type Context,type Workspace} from '@/lib/appointment/engine';
import styles from './appointment-messages.module.css';

const samples=[{id:'sample-buyer',name:'Sample Buyer',stage:'Lead',source:'Website',leadLane:'buyer'},
 {id:'sample-seller',name:'Sample Seller',stage:'Nurture',source:'Referral',leadLane:'seller',contactContext:{condition:'Only if circumstances change next year'}}];
const uid=()=>crypto.randomUUID();
export default function AppointmentMessages({contacts=samples,scope='test',loadContact}:{contacts?:any[];scope?:string;loadContact?:(id:string)=>Promise<any>}){
 const [selected,setSelected]=useState(''),[context,setContext]=useState<Context>(()=>contextFor(null)),[workspace,setWorkspace]=useState<Workspace>(emptyWorkspace),[body,setBody]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[ready,setReady]=useState(false),[search,setSearch]=useState(''),[appointmentRef,setAppointmentRef]=useState(''),[evidenceLoading,setEvidenceLoading]=useState(false),[holdReason,setHoldReason]=useState('');
 const storageKey='vesta:appointment-messages:v1:'+scope;
 useEffect(()=>{setReady(false);setError('');try{const stored=localStorage.getItem(storageKey);setWorkspace(stored?restore(JSON.parse(stored)):emptyWorkspace());setReady(true)}catch{setError('Saved draft history could not be read. Generation is held to avoid repeating earlier messages.')}},[storageKey]);
 useEffect(()=>{if(!selected&&contacts.length)setSelected(String(contacts[0].id))},[contacts,selected]);
 const lead=contacts.find(item=>String(item.id)===selected);
 useEffect(()=>{let active=true;setBody('');setNotice('');setError('');setContext(contextFor(lead));if(lead&&loadContact){setEvidenceLoading(true);loadContact(selected).then(item=>{if(active)setContext(contextFor(item.lead||item))}).catch(()=>{if(active){setError('Current contact evidence could not be loaded. Draft generation is held.');setContext(contextFor(null))}}).finally(()=>{if(active)setEvidenceLoading(false)})}return()=>{active=false}},[selected,loadContact]);
 const draft=workspace.drafts.filter(item=>item.leadId===context.leadId).at(-1),dirty=Boolean(draft&&body!==draft.body),current=Boolean(draft&&draft.contextKey===contextKey(context));
 useEffect(()=>{setBody(draft?.body||'')},[draft?.id]);
 const update=(value:Partial<Context>)=>{setContext(old=>({...old,...value}));setNotice('Context changed. Generate and review a fresh message.')};
 const commit=(next:Workspace)=>{localStorage.setItem(storageKey,JSON.stringify(next));setWorkspace(next)};
 const act=(run:()=>Workspace)=>{setError('');try{commit(run())}catch(e){setError(e instanceof Error?e.message:'The draft could not be saved.')}};
 const generate=()=>act(()=>{if(!ready||evidenceLoading)throw new Error('Wait for saved history and contact evidence.');const next=assemble(workspace,context,uid());setBody(next.drafts.at(-1)!.body);setNotice('New wording assembled from the selected path. Review and edit it.');return next});
 const approveEdited=()=>act(()=>{if(!draft)throw new Error('Generate a draft first.');const changed=dirty?edit(workspace,draft.id,body,uid()):workspace;const next=approve(changed,context,draft.id);setNotice('Wording reviewed. You can copy it and send it yourself in FUB. Nothing has been sent or completed here.');return next});
 const holdEdited=()=>act(()=>{if(!draft)throw new Error('Generate a draft first.');const changed=dirty?edit(workspace,draft.id,body,uid()):workspace;const next=hold(changed,context,draft.id,holdReason,uid());setNotice('Held without sending. Edited wording and feedback saved in this browser for model review; not automatically added to training.');return next});
 const exportFile=()=>{const file=new Blob([JSON.stringify(exportReview(workspace,context),null,2)],{type:'application/json'}),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='vesta-appointment-message-review.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const filtered=useMemo(()=>contacts.filter(item=>!search||[item.name,item.stage,item.source].join(' ').toLowerCase().includes(search.toLowerCase())),[contacts,search]);
 const path=paths.find(item=>item.id===context.pathId),blocked=gate(context),tests=workspace.drafts.filter(item=>item.leadId===context.leadId&&item.status==='simulated-delivery');
 const fubUrl=/^[1-9]\d*$/.test(context.leadId)?`https://vestapreferred.followupboss.com/2/people/view/${context.leadId}`:null;
 const manualReady=ready&&!evidenceLoading&&Boolean(draft&&current&&!dirty&&draft.status==='approved'&&!blocked&&fubUrl);
 const copyReviewed=async()=>{setError('');try{if(!manualReady)throw new Error('Review the current wording and contact before copying.');await navigator.clipboard.writeText(body);setNotice('Message copied. Send it in FUB, confirm it appears on the contact timeline, then return to the matching Flow item to record the actual outcome.')}catch(e){setError(e instanceof Error?e.message:'Copy failed. Select and copy the reviewed message manually.')}};
 return <div className={styles.workspace}>
  <section className={styles.hero}><div><p>OUTCOME → NURTURE → APPOINTMENT</p><h2>Appointment messages</h2><span>Choose the next useful step. Shape the message in your own words.</span></div><b>Send manually in FUB</b></section>
  <p className={styles.notice}>You control every message. No texts, emails or appointments are sent or created here. Nothing changes the action queue, cadence clocks or daily goal.</p>
  <div className={styles.selectors}><label>Find a contact<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, stage or source"/></label><label>Selected contact<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a contact</option>{filtered.slice(0,200).map(item=><option key={item.id} value={String(item.id)}>{item.name} · {item.stage}</option>)}{lead&&!filtered.slice(0,200).some(item=>String(item.id)===selected)&&<option value={selected}>{lead.name}</option>}</select></label><button onClick={exportFile} disabled={!ready}>Export review + history</button></div>
  {contacts.length===0&&<p>No contacts are available in this broker view. Return to My action flow to load your contacts.</p>}
  {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className={styles.columns}>
   <section className={styles.panel}><h3>1. Outcome and nurture path</h3><p>{context.name||'Choose a contact'} · {context.stage||'No stage'} · {context.source||'No source'}</p>
    <label>Current outcome<select value={context.outcomeId} onChange={e=>update({outcomeId:e.target.value})}>{outcomes.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label>Nurture path<select value={context.pathId} onChange={e=>update({pathId:e.target.value})}>{paths.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label>Recorded condition<textarea value={context.condition} onChange={e=>update({condition:e.target.value,conditionCleared:false})} placeholder="For example: only if plans change next year"/></label>
    {context.condition&&<label className={styles.check}><input type="checkbox" checked={context.conditionCleared} onChange={e=>update({conditionCleared:e.target.checked})}/> Customer explicitly confirmed this condition has changed</label>}
    <label>Channel<select value={context.channel} onChange={e=>update({channel:e.target.value as Context['channel']})}><option value="sms">Text message</option><option value="email">Email</option></select></label>
    <label className={styles.check}><input type="checkbox" checked={context.identityVerified} onChange={e=>update({identityVerified:e.target.checked})}/> I reviewed the intended FUB contact</label>
    <label className={styles.check}><input type="checkbox" checked={context.consent} onChange={e=>update({consent:e.target.checked})}/> Permission for this channel is confirmed</label>
    <label className={styles.check}><input type="checkbox" disabled={context.sourceDnc} checked={context.dnc||context.sourceDnc} onChange={e=>update({dnc:e.target.checked})}/> Do not contact {context.sourceDnc?'· recorded in source':''}</label>
    <label>Manager direction / broker-fit reason<input value={context.managerReason} onChange={e=>update({managerReason:e.target.value})}/></label>
    <div className={styles.path}><b>{step(context)}</b><p>{path?.bridge}</p><small>{outcomes.find(item=>item.id===context.outcomeId)?.detail}</small></div>
   </section>
   <section className={styles.panel}><h3>2. Assemble, edit and review</h3><p>{blocked||'Ready to prepare a proposed message.'}{evidenceLoading?' Checking current contact evidence…':''}</p>
    <button className={styles.primary} disabled={!ready||evidenceLoading||Boolean(blocked)} onClick={generate}>{draft?'Generate another version':'Generate proposed message'}</button>
    <label>Your proposed message<textarea aria-label="Editable proposed message" rows={8} maxLength={1800} value={body} disabled={!draft||!current||!['draft','approved'].includes(draft.status)} onChange={e=>{setBody(e.target.value);setNotice('Edited wording needs a fresh approval.')}} placeholder="Generate a draft, then change any wording before approving it."/></label>
    <p>{dirty?'Unsaved edits · review required':draft?.status==='approved'?'Wording reviewed · not sent':draft?'Draft · not reviewed':'No draft yet'} · {body.length}/1800 characters</p>
    <button disabled={!ready||!draft||!current||!body.trim()||Boolean(blocked)||!['draft','approved'].includes(draft.status)} onClick={approveEdited}>Review and save this wording</button>
    <div className={styles.path}><h4>Send in FUB, then record the outcome</h4><p>While automated sending is being verified, you send the message yourself in FUB.</p>
     <ol><li>Review the contact, channel and message above. Save your final wording.</li><li>Copy the reviewed message and open this contact in FUB. Confirm the name and recipient, choose Text or Email, paste the message and send it. For email, review the subject too. For a call, use FUB's call control and record the actual result.</li><li>Confirm the message or call is recorded on this contact's FUB timeline. If sending fails or remains pending, do not mark the action done or send a duplicate.</li><li>Return to <b>My action flow</b> and find the same contact. Click <b>Done &amp; sync to FUB</b>, select the actual outcome, add useful context, then click <b>Done, sync &amp; next</b>. Wait for the sync confirmation.</li></ol>
     <div className={styles.buttons}><button disabled={!manualReady} onClick={copyReviewed}>Copy reviewed message</button>{fubUrl&&<a href={fubUrl} target="_blank" rel="noopener noreferrer">Open {context.name||'contact'} in FUB ↗</a>}</div>
     <p>A message sent without a reply is an outreach attempt, not a conversation or an appointment. Done &amp; sync records the outcome; it does not send the message again. If this contact has no matching action in My action flow, leave the activity in FUB and refresh Flow; do not complete a different contact's item.</p>
    </div>
    <div className={styles.buttons}><button disabled title="Awaiting verified FUB automation or delivery connection">Automatic send and sync — awaiting FUB</button></div>
    <p>Copying or opening FUB does not mark this draft sent, advance a timer or count toward the daily goal.</p>
    <label>Why hold this message?<textarea value={holdReason} maxLength={2000} onChange={e=>setHoldReason(e.target.value)} rows={2} placeholder="What should the wording or next step do differently?"/></label>
    <button disabled={!ready||!draft||draft.leadId!==context.leadId||!body.trim()||!holdReason.trim()||!['draft','approved'].includes(draft.status)} onClick={holdEdited}>Hold and save for training model</button>
    <p>{workspace.held.filter(item=>item.leadId===context.leadId).length} held for model review · browser saved · no automatic training</p>
    <div className={styles.buttons}><button disabled={!ready||!draft||!current||dirty||draft.status!=='approved'||Boolean(blocked)} onClick={()=>act(()=>simulate(workspace,context,draft!.id,true,uid()))}>Simulate delivery</button><button disabled={!ready||!draft||!current||dirty||draft.status!=='approved'||Boolean(blocked)} onClick={()=>act(()=>simulate(workspace,context,draft!.id,false,uid()))}>Simulate failure</button></div>
    <small>Distinct wording is checked against saved proposals and edits in this browser. If choices run out, generation stops. Cross-device delivery history is not connected.</small>
   </section>
  </div>
  <section className={styles.panel}><h3>3. Trace the result to its message</h3><p>A message is not an appointment. These test outcomes remain separate from verified CRM appointments and production learning.</p><label>Synthetic appointment evidence reference<input value={appointmentRef} onChange={e=>setAppointmentRef(e.target.value)} placeholder="Example: test-appointment-1"/></label>
   {tests.map(item=><article className={styles.result} key={item.id}><b>{item.body}</b><small>Decision {item.id} · revision {item.revision}</small><div className={styles.buttons}><button disabled={!ready} onClick={()=>act(()=>recordResult(workspace,item.id,'customer_response',uid()))}>Simulate customer reply</button><button disabled={!ready||!appointmentRef.trim()} onClick={()=>act(()=>recordResult(workspace,item.id,'appointment_set',uid(),appointmentRef))}>Simulate appointment set</button></div></article>)}
   {!tests.length&&<p>No successful simulated delivery for this contact yet.</p>}<p>{workspace.results.filter(r=>workspace.drafts.find(d=>d.id===r.decisionId)?.leadId===context.leadId&&r.kind==='appointment_set').length} simulated appointments · 0 verified appointments created here</p>
  </section>
  <section className={styles.panel}><h3>Outcome chart</h3><p>Eligible paths move toward a useful appointment; waiting and stop branches respect the customer's choice.</p><div className={styles.chart}><span>Current outcome</span><span>Need / condition</span><span>Permission + clarify</span><span>Offer consultation</span><span>Preferred window</span><span>Verified appointment set</span></div><table><thead><tr><th>Nurture outcome</th><th>Path toward an appointment</th></tr></thead><tbody>{paths.map(item=><tr key={item.id}><td>{item.label}</td><td>{item.bridge}</td></tr>)}</tbody></table><p className={styles.muted}>Research basis: {research.people.toLocaleString()} nurture contacts · {research.categories} historical categories · {research.generatedAt}. {research.limitation}</p></section>
 </div>;
}
