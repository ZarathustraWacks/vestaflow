from __future__ import annotations
import json, shutil
from pathlib import Path

def promote(candidate:str, registry:str='models/registry', reason:str='manual promotion')->dict:
 root=Path(registry);src=root/candidate
 if not src.exists():raise FileNotFoundError(src)
 champion={'name':candidate,'path':str(src.resolve()),'reason':reason,'metadata':json.loads((src/'metadata.json').read_text())}
 (root/'champion.json').write_text(json.dumps(champion,indent=2));return champion
