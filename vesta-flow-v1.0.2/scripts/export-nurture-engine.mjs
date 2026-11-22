import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [mode,destination]=process.argv.slice(2);if(!['--write','--check'].includes(mode)||!destination)throw Error('Use --write or --check followed by the Cadence live application folder.');
const target=resolve(destination);if(JSON.parse(readFileSync(resolve(target,'package.json'))).name!=='vesta-lead-intelligence-prototype-11')throw Error('Expected Cadence app.');
const files=['appointment/engine.ts','appointment/catalog.ts','appointment/playbook.ts','appointment/priority.ts','appointment/handoff.ts','appointment/nurture/engine.ts','appointment/nurture/connection.ts','appointment/nurture/catalog.json','policy/contact-history.ts'];
const manifest={canonicalRepository:'ZarathustraWacks/vestaflow',contract:'vesta-nurture-messaging-v1',catalogVersion:JSON.parse(readFileSync(resolve(root,'lib/appointment/nurture/catalog.json'))).version,propertyInsertionEnabled:false,files:{}};
for(const file of files){const contents=readFileSync(resolve(root,'lib',file)),dest=resolve(target,'lib/messaging/shared',file);manifest.files[file]=createHash('sha256').update(contents).digest('hex');if(mode==='--write'){mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,contents)}else if(!contents.equals(readFileSync(dest)))throw Error('Shared messaging drift: '+file);}
const dest=resolve(target,'lib/messaging/contract.json'),encoded=JSON.stringify(manifest,null,2)+'\n';if(mode==='--write')writeFileSync(dest,encoded);else if(readFileSync(dest,'utf8')!==encoded)throw Error('Messaging contract drift.');
console.log('Verified identical versioned messaging engine; no deployment.');
