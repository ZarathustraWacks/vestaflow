type Entry<T>={value:T;expires:number};
const store=new Map<string,Entry<unknown>>();
export async function cached<T>(key:string,ttlSeconds:number,loader:()=>Promise<T>):Promise<{value:T;cache:'hit'|'miss'}>{
 const now=Date.now(); const existing=store.get(key) as Entry<T>|undefined;
 if(existing && existing.expires>now) return {value:existing.value,cache:'hit'};
 const value=await loader(); store.set(key,{value,expires:now+ttlSeconds*1000}); return {value,cache:'miss'};
}
export function clearCache(){store.clear();}
