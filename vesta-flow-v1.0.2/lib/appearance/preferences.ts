export const palettes = [
 {id:'classic',name:'Vesta Classic',colors:['#ede7da','#bea477','#fff9ec','#877250'],ui:{surface:'#fffdf8',soft:'#eee9df',ink:'#292922',muted:'#62625a',border:'#c5c0b4',accent:'#315d5b',onAccent:'#ffffff',accentSoft:'#dcebe7',canvasInk:'#292922',sidebar:'#1d2928',sidebarText:'#f4eee0',sidebarMuted:'#bccbc5'}},
 {id:'white',name:'Gallery White',colors:['#ebedf0','#b9c3cd','#fffefa','#8c9aaa'],ui:{surface:'#fffdf8',soft:'#eeeae2',ink:'#253139',muted:'#596770',border:'#bfc8cc',accent:'#175770',onAccent:'#ffffff',accentSoft:'#dcecf0',canvasInk:'#253139',sidebar:'#172c38',sidebarText:'#f7f2e8',sidebarMuted:'#bfced5'}},
 {id:'elm',name:'Elm',colors:['#e1e9d9','#8ea686','#f6f1dd','#4c7052'],ui:{surface:'#fff9ec',soft:'#f0e7d5',ink:'#342e35',muted:'#6d5e68',border:'#cbbbba',accent:'#644264',onAccent:'#ffffff',accentSoft:'#eee1eb',canvasInk:'#343b30',sidebar:'#302536',sidebarText:'#fbf0e1',sidebarMuted:'#d0bdce'}},
 {id:'pastel',name:'Pastel Bloom',colors:['#ece1f1','#b09ac9','#ffe8d7','#86628f'],ui:{surface:'#fffaf0',soft:'#f3e7d5',ink:'#3b2d38',muted:'#715d6b',border:'#cfbaca',accent:'#713d5d',onAccent:'#ffffff',accentSoft:'#f0deea',canvasInk:'#3b2d38',sidebar:'#352435',sidebarText:'#fff0df',sidebarMuted:'#d6bfd0'}},
 {id:'coastal',name:'Coastal',colors:['#dfecef','#8bb4c3','#f3f2e6','#4b8193'],ui:{surface:'#fff9ee',soft:'#f2e6d7',ink:'#38352e',muted:'#706251',border:'#c9bdaa',accent:'#884829',onAccent:'#ffffff',accentSoft:'#f3e2d5',canvasInk:'#283d43',sidebar:'#352b28',sidebarText:'#fff1df',sidebarMuted:'#d8c3b7'}},
 {id:'midnight',name:'Midnight',colors:['#bbc0c0','#6c7d7d','#d8c8ac','#425b5c'],ui:{surface:'#263139',soft:'#303e47',ink:'#f5efe5',muted:'#c6c6c2',border:'#697a83',accent:'#e8ab80',onAccent:'#30251f',accentSoft:'#493a33',canvasInk:'#202e33',sidebar:'#18232c',sidebarText:'#fff0df',sidebarMuted:'#c7c4bf'}}
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
