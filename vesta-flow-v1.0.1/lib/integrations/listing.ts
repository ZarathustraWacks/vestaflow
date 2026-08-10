const configured=(name:string)=>Boolean(process.env[name]?.trim());
const read=(raw:any,names:string[])=>names.map(name=>raw?.[name]??raw?.customFields?.[name]).find(value=>value!==undefined&&value!==null&&value!=='');
export function listingProcess(raw:any){
 const seller=Array.isArray(raw?.tags)&&raw.tags.some((tag:any)=>String(typeof tag==='string'?tag:tag?.name||'').toLowerCase()==='seller');
 const milestones=[
  ['request','Listing agreement request',read(raw,['customListingAgreementRequest','customLARequestDate'])],
  ['agreement-sent','Listing agreement sent',read(raw,['customListingAgreementSent','customLASentDate'])],
  ['agreement-signed','Listing agreement signed',read(raw,['customListingAgreementSigned','customLASignedDate'])],
  ['drive-folder','Property Drive folder',read(raw,['customDriveFolderUrl','customListingFolder'])],
  ['media','Media requested',read(raw,['customMediaRequestDate','customMediaStatus'])],
  ['property-sheet','Property sheet / HOA',read(raw,['customPropertySheet','customHOAStatus'])],
  ['mls-draft','MLS draft',read(raw,['customMlsDraft','customMLSStatus'])],
  ['live','Listing live',read(raw,['customListDate','customMLSNumber'])],
 ].map(([key,label,value])=>({key,label,status:value?'complete':'unknown',value:value??null}));
 const expected=read(raw,['customExpectedListDate','customListDate'])??null,optOut=Boolean(read(raw,['customListingChaseOptOut'])),signed=milestones.find(item=>item.key==='agreement-signed')?.status==='complete';
 const expectedTime=expected?new Date(String(expected)).getTime():NaN,daysUntil=Number.isFinite(expectedTime)?Math.ceil((expectedTime-Date.now())/86400000):null;
 const chase=signed||optOut?{status:'not-required',intervalDays:null,reason:signed?'Listing agreement is signed.':'Agent opted out or is handling the chase.'}:daysUntil===null?{status:'blocked',intervalDays:null,reason:'Expected list date is missing.'}:daysUntil<=14?{status:'active',intervalDays:1,reason:'Expected list date is within two weeks.'}:{status:'active',intervalDays:3,reason:'Expected list date is more than two weeks away.'};
 return {applicable:seller,expectedListDate:expected,chaseOwner:read(raw,['customListingChaseOwner'])??'unconfigured',chaseOptOut:optOut,chase,milestones,connectors:{docusign:configured('DOCUSIGN_API_URL'),googleDrive:configured('GOOGLE_DRIVE_API_URL'),monday:configured('MONDAY_API_URL'),mls:configured('MLS_API_URL'),media:configured('MEDIA_API_URL')}};
}
