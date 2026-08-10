"""Build leakage-safe training snapshots from exported FUB records.
Input JSONL: one normalized lead-history object per line with `snapshots` and future `events`.
Output JSONL: {lead: state_at_snapshot, labels: outcomes_after_snapshot}.
This intentionally does not infer labels from fields occurring before the prediction timestamp.
"""
import argparse,json
from datetime import datetime,timedelta
TARGETS={'contact7d':7,'appointment30d':30,'client90d':90,'closing180d':180,'attrition30d':30,'reactivation30d':30}
def dt(x):return datetime.fromisoformat(x.replace('Z','+00:00'))
def main():
 p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);a=p.parse_args();out=open(a.output,'w')
 for line in open(a.input):
  rec=json.loads(line);events=rec.get('events',[])
  for snap in rec.get('snapshots',[]):
   at=dt(snap['prediction_at']);future=[e for e in events if dt(e['occurred_at'])>at]
   labels={}
   for target,h in TARGETS.items():
    end=at+timedelta(days=h);labels[target]=int(any(e.get('label')==target and dt(e['occurred_at'])<=end for e in future))
   out.write(json.dumps({'lead':snap['lead'],'labels':labels,'prediction_at':snap['prediction_at']})+'\n')
if __name__=='__main__':main()
