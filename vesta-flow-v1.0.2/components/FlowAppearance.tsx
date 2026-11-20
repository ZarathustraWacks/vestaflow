'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {appearanceKey,originalAppearance,palettes,parseAppearance,serializeAppearance,treatments,type SavedAppearance} from '@/lib/appearance/preferences';
import styles from './flow-appearance.module.css';

const title=(value:string)=>value.charAt(0).toUpperCase()+value.slice(1);
export default function FlowAppearance({brokerId}:{brokerId:number|null}){
 const key=appearanceKey(brokerId),button=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const [state,setState]=useState<{key:string|null;saved:SavedAppearance;preview:SavedAppearance}>({key:null,saved:originalAppearance,preview:originalAppearance});
 const [open,setOpen]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const choice=state.key===key?state.preview:originalAppearance;
 useEffect(()=>{
  dialog.current?.close();setOpen(false);setError('');setNotice('');let saved:SavedAppearance=originalAppearance;
  if(key)try{saved=parseAppearance(localStorage.getItem(key));}catch{setError('This browser is blocking saved preferences. You can preview backgrounds, but saving may be unavailable.');}
  setState({key,saved,preview:saved});
 },[key]);
 useEffect(()=>{
  const shell=button.current?.closest<HTMLElement>('.flowShell');if(!shell)return;
  shell.dataset.flowPalette=choice.palette;shell.dataset.flowTreatment=choice.treatment;
  const palette=palettes.find(p=>p.id===choice.palette);['scene','pigment','light','deep'].forEach((token,index)=>{if(palette)shell.style.setProperty(`--flow-${token}`,palette.colors[index]);else shell.style.removeProperty(`--flow-${token}`);});
  const uiTokens=Object.keys(palettes[0].ui);uiTokens.forEach(token=>{if(palette)shell.style.setProperty(`--flow-ui-${token}`,palette.ui[token as keyof typeof palette.ui]);else shell.style.removeProperty(`--flow-ui-${token}`);});
  return()=>{delete shell.dataset.flowPalette;delete shell.dataset.flowTreatment;['scene','pigment','light','deep'].forEach(token=>shell.style.removeProperty(`--flow-${token}`));uiTokens.forEach(token=>shell.style.removeProperty(`--flow-ui-${token}`));};
 },[choice.palette,choice.treatment]);
 useEffect(()=>{
  if(!key)return;const sync=(event:StorageEvent)=>{if(event.key!==key)return;if(dialog.current?.open){setError('Your saved background changed in another tab. Save choice to keep this preview, or cancel to use the latest saved choice.');return;}const saved=parseAppearance(event.newValue);setState({key,saved,preview:saved});};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[key]);
 function close(){let saved=state.saved;if(key)try{saved=parseAppearance(localStorage.getItem(key));}catch{}setState({key,saved,preview:saved});setOpen(false);setError('');dialog.current?.close();button.current?.focus();}
 function show(){if(!key||state.key!==key)return;setNotice('');setOpen(true);dialog.current?.showModal();}
 function save(){if(!key||state.key!==key)return;try{localStorage.setItem(key,serializeAppearance(choice));setState({key,saved:choice,preview:choice});setError('');setOpen(false);dialog.current?.close();setNotice('Background saved in this browser.');button.current?.focus();}catch{setError('Your choice could not be saved. Allow browser storage and try again, or cancel to restore your saved background.');}}
 function preview(update:Partial<SavedAppearance>){setState(current=>({...current,preview:{...current.preview,...update} as SavedAppearance}));}
 return <div className={styles.control}>
  <button ref={button} type="button" className={styles.trigger} disabled={!key||state.key!==key} onClick={show} aria-haspopup="dialog" aria-expanded={open} aria-controls="flow-appearance-dialog"><span className={styles.icon} aria-hidden="true">◐</span><span>Appearance</span><small>Change background</small></button>
  <span className={styles.savedNotice} role="status">{notice}</span>
  <dialog ref={dialog} id="flow-appearance-dialog" className={styles.dialog} aria-labelledby="flow-appearance-heading" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===dialog.current){const rect=dialog.current.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}}>
   <header><div><small>MAKE FLOW YOURS</small><h2 id="flow-appearance-heading">Choose your background</h2></div><button type="button" onClick={close} className={styles.close} aria-label="Cancel background changes">×</button></header>
   <p>Preview coordinated backgrounds, cards and highlights. Your layout and work stay the same.</p>
   <div className={styles.palettes} role="group" aria-label="Background palette">
    {palettes.map(p=><button type="button" key={p.id} className={styles.palette} aria-pressed={choice.palette===p.id} onClick={()=>preview({palette:p.id})}><span className={`${styles.swatch} ${styles[choice.treatment]}`} style={{'--swatch-scene':p.colors[0],'--swatch-pigment':p.colors[1],'--swatch-light':p.colors[2],'--swatch-card':p.ui.surface,'--swatch-accent':p.ui.accent,'--swatch-sidebar':p.ui.sidebar} as CSSProperties} aria-hidden="true"><i/><i/><i/></span><span>{p.name}</span>{choice.palette===p.id&&<b aria-hidden="true">✓</b>}</button>)}
   </div>
   <h3>Background finish</h3><div className={styles.finishes} role="group" aria-label="Background finish">{treatments.map(t=><button type="button" key={t} disabled={choice.palette==='original'} aria-pressed={choice.palette!=='original'&&choice.treatment===t} onClick={()=>preview({treatment:t})}>{title(t)}</button>)}</div>
   <button type="button" className={styles.original} aria-pressed={choice.palette==='original'} onClick={()=>preview(originalAppearance)}>Use original Flow background</button>
   <div className={styles.feedback} role="alert">{error}</div><footer><span>Remembered for this broker in this browser.</span><div><button type="button" onClick={close}>Cancel</button><button type="button" className={styles.save} onClick={save}>Save choice</button></div></footer>
  </dialog>
 </div>;
}
