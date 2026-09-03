/** Report listing-process integration readiness without returning credentials. */
const configured=(name:string)=>Boolean(process.env[name]?.trim());
const read=(raw:any,names:string[])=>names.map(name=>raw?.[name]??raw?.customFields?.[name]).find(value=>value!==undefined&&value!==null&&value!=='');
export function listingProcess(raw:any){
 const seller=Array.isArray(raw?.tags)&&raw.tags.some((tag:any)=>String(typeof tag==='string'?tag:tag?.name||'').toLowerCase()==='seller');
 const milestones=[
  ['seller-intelligence','Seller intelligence and property brief',read(raw,['customSellerIntelligenceComplete','customPropertyBrief'])],
  ['wow-package','WOW package sent',read(raw,['customWowPackageSent','customSellerWowEmail'])],
  ['appointment-kit','Listing appointment kit / CMA / net sheet',read(raw,['customListingAppointmentKit','customCmaReady','customNetSheetReady'])],
  ['request','Listing agreement request',read(raw,['customListingAgreementRequest','customLARequestDate'])],
  ['agreement-sent','Listing agreement sent',read(raw,['customListingAgreementSent','customLASentDate'])],
  ['agreement-signed','Listing agreement signed',read(raw,['customListingAgreementSigned','customLASignedDate'])],
  ['drive-folder','Property Drive folder',read(raw,['customDriveFolderUrl','customListingFolder'])],
  ['internal-kickoff','Operations-to-marketing kickoff',read(raw,['customMarketingKickoff','customOpsMarketingHandoff'])],
  ['buyer-persona','Buyer persona approved',read(raw,['customBuyerPersona','customBuyerPersonaApproved'])],
  ['marketing-plan','One-page marketing plan approved',read(raw,['customMarketingPlanApproved','customListingMarketingPlan'])],
  ['media','Media requested',read(raw,['customMediaRequestDate','customMediaStatus'])],
  ['property-sheet','Property sheet / HOA',read(raw,['customPropertySheet','customHOAStatus'])],
  ['mls-draft','MLS draft',read(raw,['customMlsDraft','customMLSStatus'])],
  ['coming-soon','Coming Soon page / QR / sign',read(raw,['customComingSoonUrl','customQrCode','customSignStatus'])],
  ['live','Listing live',read(raw,['customListDate','customMLSNumber'])],
  ['social','Social activation approved',read(raw,['customSocialApproved','customSocialStatus'])],
  ['open-house','Open-house assets ready',read(raw,['customOpenHouseAssets','customOpenHouseDate'])],
  ['performance','Channel performance tracking',read(raw,['customListingPerformanceReport','customMarketingMetrics'])],
 ].map(([key,label,value])=>({key,label,status:value?'complete':'unknown',value:value??null}));
 const expected=read(raw,['customExpectedListDate','customListDate'])??null,optOut=Boolean(read(raw,['customListingChaseOptOut'])),signed=milestones.find(item=>item.key==='agreement-signed')?.status==='complete';
 const expectedTime=expected?new Date(String(expected)).getTime():NaN,daysUntil=Number.isFinite(expectedTime)?Math.ceil((expectedTime-Date.now())/86400000):null;
 const chase=signed||optOut?{status:'not-required',intervalDays:null,reason:signed?'Listing agreement is signed.':'Agent opted out or is handling the chase.'}:daysUntil===null?{status:'blocked',intervalDays:null,reason:'Expected list date is missing.'}:daysUntil<=14?{status:'active',intervalDays:1,reason:'Expected list date is within two weeks.'}:{status:'active',intervalDays:3,reason:'Expected list date is more than two weeks away.'};
 const completion=Math.round(100*milestones.filter(item=>item.status==='complete').length/Math.max(1,milestones.length));
 return {applicable:seller,policyVersion:'vesta-listing-guidebook-2026-shadow-v1',completion,blockers:milestones.filter(item=>item.status!=='complete'),expectedListDate:expected,chaseOwner:read(raw,['customListingChaseOwner'])??'unconfigured',chaseOptOut:optOut,chase,milestones,connectors:{docusign:configured('DOCUSIGN_API_URL'),googleDrive:configured('GOOGLE_DRIVE_API_URL'),monday:configured('MONDAY_API_URL'),mls:configured('MLS_API_URL'),media:configured('MEDIA_API_URL')}};
}
