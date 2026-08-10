from __future__ import annotations
from datetime import datetime,timezone
import hashlib
import numpy as np
EVENT_VOCAB={'PAD':0,'created':1,'assigned':2,'call':3,'text':4,'email':5,'task':6,'website':7,'property_view':8,'saved_property':9,'appointment':10,'stage_change':11,'note':12,'closing':13,'other':14}
def days(value):
    if not value:return 9999.
    try:return max(0.,(datetime.now(timezone.utc)-datetime.fromisoformat(value.replace('Z','+00:00'))).total_seconds()/86400)
    except:return 9999.
def h(text,buckets=128):return int(hashlib.sha256((text or '').encode()).hexdigest()[:8],16)%buckets
def structured(lead):
    age=float(getattr(lead,'ageDays',0) or days(lead.createdAt));
    return np.array([min(age,3650)/3650,min(days(lead.lastActivityAt),365)/365,min(days(lead.lastCommunicationAt),365)/365,1. if lead.nextTaskAt or getattr(lead,'openTaskCount',0) else 0.,1. if lead.assignedUserName!='Unassigned' else 0.,float(lead.governanceScore)/100,h(lead.source)/127,h(lead.stage)/127,min(len(lead.tags),20)/20,min(float(getattr(lead,'eventCount',0)),100)/100,min(float(getattr(lead,'propertyViewCount',0)),30)/30],dtype=np.float32)
def sequence_from_lead(lead,max_len=128):
    events=list(getattr(lead,'events',[]) or [])
    if not events and isinstance(lead.raw,dict):events=lead.raw.get('events') or []
    seq=[]
    for e in events[-max_len:]:
        typ=str(e.get('type','other') if isinstance(e,dict) else e.type).lower();token=next((v for k,v in EVENT_VOCAB.items() if k!='PAD' and k in typ),EVENT_VOCAB['other']);delta=float(e.get('deltaHours',0) if isinstance(e,dict) else e.deltaHours or 0);seq.append([token,min(max(delta,0),17520)/17520])
    if not seq:seq=[[EVENT_VOCAB['created'],0.],[EVENT_VOCAB['other'],min(days(lead.lastActivityAt),365)/365]]
    seq=seq[-max_len:];pad=[[0,0.]]*(max_len-len(seq));return np.array(pad+seq,dtype=np.float32)
