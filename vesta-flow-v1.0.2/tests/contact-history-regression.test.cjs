const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(r,p,m,o){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,m,o)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {historicalConversationAt,contactHistoryState}=require('../lib/policy/contact-history.ts');
const old='2026-10-28T12:00:00Z',reply='2026-10-29T12:00:00Z',recent='2026-11-10T12:00:00Z',now=Date.parse('2026-11-12T20:00:00Z');
const proof={contractVersion:'vesta-contact-history-v1',personId:'42',twoWayEngagementAt:reply,basis:'observed-event-pair'};
test('later unanswered outreach cannot erase retained verified historical conversation',()=>{
 const person={id:42,vestaContactHistory:proof};
 assert.equal(historicalConversationAt(person,[recent],[reply],now),reply);
 assert.equal(contactHistoryState({id:42,raw:person,brokerOutreachAt:recent,lastCommunicationAt:recent,lastCommunicationSource:'outbound-email'},now),'prior-conversation');
 assert.equal(historicalConversationAt({id:43,vestaContactHistory:proof},[recent],[reply],now),null);
});
test('all summary channels may prove an older pair without moving the latest outreach clock',()=>{
 assert.equal(historicalConversationAt({id:42},[recent,old],[reply],now),reply);
 assert.equal(historicalConversationAt({id:42},[recent],[reply],now),null);
 assert.equal(contactHistoryState({id:42,customerResponseAt:reply,lastCommunicationAt:recent,lastCommunicationSource:'outbound-email'},now),'needs-review');
 assert.equal(contactHistoryState({id:42,brokerOutreachAt:recent,lastCommunicationAt:recent,lastCommunicationSource:'outbound-email'},now),'no-conversation');
});
test('passive activity, derived nurture stage, future dates and inbound alone are not verified conversations',()=>{
 assert.equal(contactHistoryState({id:42,stage:'Lead',cadenceStage:'Nurture',lastActivityAt:recent},now),'no-conversation');
 assert.equal(historicalConversationAt({id:42,vestaContactHistory:{...proof,twoWayEngagementAt:'2099-01-01T00:00:00Z'}},[],[],now),null);
 assert.equal(historicalConversationAt({id:42},[],[reply],now),null);
 assert.equal(historicalConversationAt({id:42},['invalid'],[reply],now),null);
});
test('normalization carries lifetime proof through every product without mutating the source',()=>{
 const {normalizePersonBase,resolveCadenceCommunication}=require('../lib/fub/normalize.ts');
 const raw={id:42,name:'Synthetic Seller',stage:'Nurture',source:'Website',tags:['Seller'],created:old,lastEmailSentAt:recent,lastTextReceivedAt:reply,vestaContactHistory:proof};
 const before=JSON.stringify(raw),lead=normalizePersonBase(raw,new Map());
 assert.equal(lead.twoWayEngagementAt,reply);assert.equal(contactHistoryState(lead,now),'prior-conversation');assert.equal(JSON.stringify(raw),before);
 if(resolveCadenceCommunication){const c=resolveCadenceCommunication(raw);assert.equal(c.brokerOutreachAt,recent);assert.equal(c.at,recent);assert.equal(c.twoWayEngagementAt,reply)}
});

test('structured Shilo consultation evidence establishes history while arbitrary prose and canceled categories do not',()=>{
 const {communicationOutcome}=require('../lib/policy/contact-context.ts');
 const note={id:99,personId:42,systemName:'Shilo AI',isExternal:true,created:'2026-10-28T12:00:00Z',body:'Category: Initial Consultation\nSummary: Initial seller consultation; walkthrough to be confirmed.'};
 const result=communicationOutcome(note,now);
 assert.equal(result.contactEstablished,true);assert.equal(result.kind,'connected');assert.equal(result.contractVersion,'vesta-contact-context-v2');
 for(const patch of [{systemName:'Sisu'},{body:'An initial consultation may happen later.'},{body:'Category: Initial Consultation — canceled'}])assert.equal(communicationOutcome({...note,...patch},now),null);
});
