from __future__ import annotations
import argparse, json, math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from dateutil.parser import isoparse
import yaml

TARGETS=('contact7d','appointment30d','client90d','closing180d','attrition30d','reactivation30d')

def dt(value: Any) -> datetime | None:
    if not value: return None
    try:
        x=isoparse(str(value)); return x if x.tzinfo else x.replace(tzinfo=timezone.utc)
    except Exception: return None

def load_jsonl(path: Path) -> list[dict[str,Any]]:
    if not path.exists(): return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

def event_time(e:dict[str,Any])->datetime|None:
    return dt(e.get('created') or e.get('createdAt') or e.get('start') or e.get('startAt') or e.get('date') or e.get('occurredAt') or e.get('updated'))

def event_kind(e:dict[str,Any])->str:
    return str(e.get('type') or e.get('eventType') or e.get('name') or '').strip()

def person_id(row:dict[str,Any])->str:
    return str(row.get('personId') or row.get('person_id') or row.get('id') or '')

def snapshot_features(person:dict[str,Any], events:list[dict[str,Any]], tasks:list[dict[str,Any]], snapshot_at:datetime) -> dict[str,Any]:
    past=[e for e in events if (event_time(e) or datetime.min.replace(tzinfo=timezone.utc)) <= snapshot_at]
    past.sort(key=lambda e:event_time(e) or datetime.min.replace(tzinfo=timezone.utc))
    last=event_time(past[-1]) if past else None
    created=dt(person.get('created') or person.get('createdAt')) or snapshot_at
    person_updated=dt(person.get('updated') or person.get('updatedAt'))
    kinds=[event_kind(e).lower() for e in past]
    task_history=[t for t in tasks if not dt(t.get('created') or t.get('createdAt')) or dt(t.get('created') or t.get('createdAt'))<=snapshot_at]
    open_tasks=[t for t in task_history if not bool(t.get('isCompleted')) and (dt(t.get('dueDate') or t.get('dueAt')) or snapshot_at)>=snapshot_at]
    contact_events=[e for e in past if any(n in event_kind(e).lower() for n in ('call','text','email','note'))]
    last_contact=event_time(contact_events[-1]) if contact_events else None
    stage_events=[e for e in past if 'stage' in event_kind(e).lower()]
    assignment_events=[e for e in past if 'assign' in event_kind(e).lower()]
    latest_stage=stage_events[-1] if stage_events else None;latest_assignment=assignment_events[-1] if assignment_events else None
    stage=(latest_stage or {}).get('stage') or (latest_stage or {}).get('newStage') or (person.get('stage') if not person_updated or person_updated<=snapshot_at else 'Historical Unknown')
    assigned_name=(latest_assignment or {}).get('assignedTo') or (latest_assignment or {}).get('userName') or (person.get('assignedTo') if not person_updated or person_updated<=snapshot_at else 'Historical Unknown')
    assigned_id=(latest_assignment or {}).get('assignedUserId') or (person.get('assignedUserId') if not person_updated or person_updated<=snapshot_at else None)
    safe_current=not person_updated or person_updated<=snapshot_at
    lead={
      'id':str(person.get('id')),'name':str(person.get('name') or f"{person.get('firstName','')} {person.get('lastName','')}").strip(),
      'stage':str(stage or 'Historical Unknown'),'source':str(person.get('source') or 'Unknown'),
      'assignedUserId':assigned_id,'assignedUserName':str(assigned_name or 'Unassigned'),
      'createdAt':created.isoformat(),'lastActivityAt':last.isoformat() if last else None,'lastCommunicationAt':last_contact.isoformat() if last_contact else None,
      'nextTaskAt':min([dt(t.get('dueDate') or t.get('dueAt')) for t in open_tasks if dt(t.get('dueDate') or t.get('dueAt'))],default=None),
      'tags':[str(x.get('name') if isinstance(x,dict) else x) for x in (person.get('tags') or [])] if safe_current else [],
      'price':person.get('price') if safe_current else None,'ageDays':max(0,(snapshot_at-created).days),'eventCount':len(past),'openTaskCount':len(open_tasks),
      'callCount':sum('call' in k for k in kinds),'textCount':sum('text' in k for k in kinds),'emailCount':sum('email' in k for k in kinds),
      'propertyViewCount':sum('viewed property' in k or 'property view' in k for k in kinds),
      'events':[{'type':event_kind(e),'at':event_time(e).isoformat() if event_time(e) else None,'deltaHours':max(0,((snapshot_at-(event_time(e) or snapshot_at)).total_seconds()/3600))} for e in past[-128:]],
    }
    if isinstance(lead['nextTaskAt'],datetime): lead['nextTaskAt']=lead['nextTaskAt'].isoformat()
    return lead

def labels_for(person:dict[str,Any], events:list[dict[str,Any]], snapshot_at:datetime, cfg:dict[str,Any]) -> dict[str,int]:
    future=[e for e in events if event_time(e) and event_time(e)>snapshot_at]
    stage=str(person.get('stage') or '')
    stage_at=dt(person.get('updated') or person.get('updatedAt'))
    kinds=[(event_kind(e).lower(),event_time(e)) for e in future]
    horizons=cfg['horizons_days']
    def within(names:list[str], days:int)->bool:
        needles=[n.lower() for n in names]
        return any(any(n in kind for n in needles) and when<=snapshot_at+timedelta(days=days) for kind,when in kinds if when)
    return {
      'contact7d':int(within(cfg['contact_event_types'],horizons['contact7d'])),
      'appointment30d':int(within(cfg['appointment_event_types'],horizons['appointment30d']) or (stage in cfg['positive_stages']['appointment30d'] and stage_at and snapshot_at<stage_at<=snapshot_at+timedelta(days=horizons['appointment30d']))),
      'client90d':int(stage in cfg['positive_stages']['client90d'] and stage_at and snapshot_at<stage_at<=snapshot_at+timedelta(days=horizons['client90d'])),
      'closing180d':int(within(cfg['closing_event_types'],horizons['closing180d']) or (stage in cfg['positive_stages']['closing180d'] and stage_at and snapshot_at<stage_at<=snapshot_at+timedelta(days=horizons['closing180d']))),
      'attrition30d':int(stage in cfg['negative_stages']['attrition30d'] and stage_at and snapshot_at<stage_at<=snapshot_at+timedelta(days=horizons['attrition30d'])),
      'reactivation30d':int(within(cfg['reactivation_event_types'],horizons['reactivation30d'])),
    }

def main()->None:
    p=argparse.ArgumentParser();p.add_argument('--raw',default='data/raw');p.add_argument('--config',default='config/label_mapping.yml');p.add_argument('--out',default='data/processed/training.jsonl');p.add_argument('--report',default='data/processed/quality.json');a=p.parse_args()
    raw=Path(a.raw);cfg=yaml.safe_load(Path(a.config).read_text());people=load_jsonl(raw/'people.jsonl');events=load_jsonl(raw/'events.jsonl');tasks=load_jsonl(raw/'tasks.jsonl')
    for filename,kind in (('calls.jsonl','Call'),('textMessages.jsonl','Text Message'),('notes.jsonl','Note'),('appointments.jsonl','Appointment')):
      for item in load_jsonl(raw/filename):
        row=dict(item);row.setdefault('type',kind);events.append(row)
    ev=defaultdict(list);tk=defaultdict(list)
    for e in events: ev[str(e.get('personId') or '')].append(e)
    for t in tasks: tk[str(t.get('personId') or '')].append(t)
    out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);counts={t:0 for t in TARGETS};rows=0;skipped=0
    cutoff=datetime.now(timezone.utc);max_horizon=max(int(x) for x in cfg['horizons_days'].values())
    with out.open('w') as f:
      for person in people:
        pid=str(person.get('id') or '');created=dt(person.get('created') or person.get('createdAt'))
        if not pid or not created: skipped+=1;continue
        tags={str(x.get('name') if isinstance(x,dict) else x).lower() for x in (person.get('tags') or [])}
        source=str(person.get('source') or '').lower()
        if tags.intersection({str(x).lower() for x in cfg.get('invalid_tags',[])}) or source in {str(x).lower() for x in cfg.get('ignored_sources',[])}: skipped+=1;continue
        for day in cfg['snapshot_days_after_creation']:
          snap=created+timedelta(days=int(day))
          # Do not label a snapshot until every configured outcome horizon has
          # elapsed; otherwise recent snapshots become false negatives.
          if snap+timedelta(days=max_horizon)>cutoff: continue
          lead=snapshot_features(person,ev[pid],tk[pid],snap);labels=labels_for(person,ev[pid],snap,cfg)
          for k,v in labels.items():counts[k]+=v
          f.write(json.dumps({'lead':lead,'snapshot_at':snap.isoformat(),'labels':labels},default=str)+'\n');rows+=1
    report={'people':len(people),'events':len(events),'tasks':len(tasks),'snapshots':rows,'skipped_people':skipped,'positive_labels':counts,'positive_rates':{k:(counts[k]/rows if rows else 0) for k in TARGETS},'mapping_version':cfg.get('version')}
    Path(a.report).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if __name__=='__main__':main()
