from __future__ import annotations
import argparse, json, os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from .fub_client import FubClient
from .fub_client import FubApiError

COLLECTIONS = {
    'people': ('people', 'people'),
    'users': ('users', 'users'),
    'tasks': ('tasks', 'tasks'),
    'events': ('events', 'events'),
    'calls': ('calls', 'calls'),
    'textMessages': ('textMessages', 'textMessages'),
    'notes': ('notes', 'notes'),
    'appointments': ('appointments', 'appointments'),
}
OPTIONAL_COLLECTIONS={'appointments'}

def write_jsonl(path: Path, rows: list[dict[str, Any]], append: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a' if append else 'w', encoding='utf-8') as f:
        for row in rows: f.write(json.dumps(row, default=str, separators=(',', ':')) + '\n')

def main() -> None:
    p=argparse.ArgumentParser(description='Extract historical Follow Up Boss data using cursor pagination.')
    p.add_argument('--out', default='data/raw'); p.add_argument('--max-pages', type=int, default=int(os.getenv('FUB_EXPORT_MAX_PAGES','10000')))
    p.add_argument('--collections', default='people,users,tasks,events,calls,textMessages,notes,appointments'); p.add_argument('--reset', action='store_true')
    args=p.parse_args(); out=Path(args.out); out.mkdir(parents=True, exist_ok=True); client=FubClient()
    manifest={'started_at':datetime.now(timezone.utc).isoformat(),'collections':{},'complete':False}
    selected=[x.strip() for x in args.collections.split(',') if x.strip()]
    for name in selected:
        endpoint, collection=COLLECTIONS[name]; path=out/f'{name}.jsonl'
        if args.reset and path.exists(): path.unlink()
        total=0; pages=0
        try:
            for rows, metadata, page in client.paginate(endpoint,collection,max_pages=args.max_pages):
                write_jsonl(path,rows,append=True); total+=len(rows); pages=page
                manifest['collections'][name]={'rows':total,'pages':pages,'metadata':metadata,'complete':True}
                (out/'manifest.json').write_text(json.dumps(manifest,indent=2,default=str))
                print(f'{name}: page {page}, rows {total}',flush=True)
        except FubApiError as exc:
            if name not in OPTIONAL_COLLECTIONS: raise
            manifest['collections'][name]={'rows':total,'pages':pages,'complete':False,'error':str(exc)}
            (out/'manifest.json').write_text(json.dumps(manifest,indent=2,default=str))
            print(f'{name}: unavailable ({exc})',flush=True)
    manifest['complete']=True; manifest['finished_at']=datetime.now(timezone.utc).isoformat()
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2,default=str))
if __name__=='__main__': main()
