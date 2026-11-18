export const palettes = [
 {id:'classic',name:'Vesta Classic',colors:['#ede7da','#bea477','#fff9ec','#877250']},
 {id:'white',name:'Gallery White',colors:['#ebedf0','#b9c3cd','#fffefa','#8c9aaa']},
 {id:'elm',name:'Elm',colors:['#e1e9d9','#8ea686','#f6f1dd','#4c7052']},
 {id:'pastel',name:'Pastel Bloom',colors:['#ece1f1','#b09ac9','#ffe8d7','#86628f']},
 {id:'coastal',name:'Coastal',colors:['#dfecef','#8bb4c3','#f3f2e6','#4b8193']},
 {id:'midnight',name:'Midnight',colors:['#bbc0c0','#6c7d7d','#d8c8ac','#425b5c']}
] as const;
export const treatments = ['architectural','botanical','atmospheric'] as const;
export type Appearance = {palette:typeof palettes[number]['id'];treatment:typeof treatments[number]};
// Preserve today's workspace until a broker explicitly saves a background.
export const originalAppearance={palette:'original',treatment:'architectural'} as const;
export type SavedAppearance=Appearance|typeof originalAppearance;
export function appearanceKey(brokerId:number|null):string|null{return Number.isSafeInteger(brokerId)&&Number(brokerId)>0?`vesta.flow.appearance.v1.broker.${brokerId}`:null;}
export function parseAppearance(raw:string|null):SavedAppearance{
 try{const value=JSON.parse(raw||'null');if(value?.version===1&&(value.palette==='original'||palettes.some(p=>p.id===value.palette))&&treatments.includes(value.treatment))return {palette:value.palette,treatment:value.treatment};}catch{}
 return originalAppearance;
}
export function serializeAppearance(value:SavedAppearance):string{return JSON.stringify({version:1,...value});}
