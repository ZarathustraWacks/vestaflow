const positiveInt=(value:string|undefined,fallback:number,max:number)=>{
 const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?Math.min(parsed,max):fallback;
};
export function getConfig(){
 const apiKey=process.env.FUB_API_KEY?.trim()||'';
 const forceDemo=(process.env.FUB_DEMO_MODE||'').trim().toLowerCase()==='true';
 return {apiKey,systemName:process.env.FUB_SYSTEM_NAME?.trim()||'',systemKey:process.env.FUB_SYSTEM_KEY?.trim()||'',forceDemo,cacheTtl:positiveInt(process.env.FUB_CACHE_TTL_SECONDS,60,3600),maxPages:positiveInt(process.env.FUB_MAX_PAGES,1000,10000),baseUrl:'https://api.followupboss.com/v1'};
}
// Demo data must be explicitly enabled. A missing credential is a configuration
// error, not permission to silently substitute synthetic brokerage data.
export function shouldUseDemo(){return getConfig().forceDemo;}
