from __future__ import annotations
import json,os,sqlite3
from datetime import datetime,timezone
from pathlib import Path
from typing import Any
import joblib,numpy as np,pandas as pd,torch
from .schemas import LeadPayload
from .features import structured,sequence_from_lead
from .model import LeadTransformer
from fastapi import FastAPI,Header,HTTPException
from pydantic import BaseModel,Field
TARGETS=['contact7d','appointment30d','client90d','closing180d','attrition30d','reactivation30d']
CAT=['stage','source','assignedUserName'];NUM=['ageDays','eventCount','openTaskCount','callCount','textCount','emailCount','propertyViewCount','price']
app=FastAPI(title='Vesta Learning Engine',version='11.0.0')
REGISTRY=Path(os.getenv('VESTA_MODEL_REGISTRY','models/registry'));DB=Path(os.getenv('VESTA_FEEDBACK_DB','data/state/feedback.sqlite3'));KEY=os.getenv('VESTA_LEARNING_API_KEY')
class ScoreRequest(BaseModel): leads:list[dict[str,Any]]=Field(default_factory=list,max_length=500)
class Feedback(BaseModel):lead_id:str;prediction_id:str|None=None;useful:str;reason:str|None=None;action_taken:str|None=None;outcome:str|None=None;actor_id:str|None=None

def auth(authorization:str|None):
 if KEY and authorization!=f'Bearer {KEY}':raise HTTPException(401,'Invalid service key')
def champion():
 p=REGISTRY/'champion.json';return json.loads(p.read_text()) if p.exists() else None
def load_models():
 c=champion()
 if not c:return None,{}
 path=Path(c['path']);meta=c.get('metadata') or {}
 if meta.get('model_type')=='temporal_transformer':
  model=LeadTransformer();model.load_state_dict(torch.load(path/'model.pt',map_location='cpu'));model.eval();return c,{'transformer':model,'temperatures':meta.get('temperatures') or [1]*6}
 return c,{t:joblib.load(path/f'{t}.joblib') for t in TARGETS if (path/f'{t}.joblib').exists()}
def feature(lead:dict[str,Any]):
 return {k:lead.get(k) for k in CAT+NUM}
def fallback(lead):
 activity=min(1,float(lead.get('eventCount') or 0)/20);age=float(lead.get('ageDays') or 0);task=1 if lead.get('openTaskCount') else 0;appointment=max(0.03,min(.82,.12+.35*activity+.12*task-.0015*age));closing=max(.01,min(.55,appointment*.48));return {'contact7d':min(.9,appointment+.18),'appointment30d':appointment,'client90d':min(.75,appointment*.78),'closing180d':closing,'attrition30d':max(.05,min(.85,.52-.3*activity+.001*age)),'reactivation30d':max(.04,min(.7,.1+.2*activity))}
@app.get('/health')
def health(authorization:str|None=Header(default=None)):
 auth(authorization)
 c=champion();return {'ok':True,'version':'11.0.0','modelReady':bool(c),'champion':c,'feedbackDb':str(DB)}
@app.get('/v1/metrics')
def metrics(authorization:str|None=Header(default=None)):
 auth(authorization);c=champion();quality_path=Path(os.getenv('VESTA_DATA_QUALITY_REPORT','data/processed/quality.json'));quality=json.loads(quality_path.read_text()) if quality_path.exists() else None;blockers=[]
 if not quality:blockers.append('Historical data-quality report is missing')
 else:
  if quality.get('people',0)<200:blockers.append('Fewer than 200 people are available for grouped evaluation')
  for target,rate in (quality.get('positive_rates') or {}).items():
   if not rate:blockers.append(f'No positive labels for {target}')
 if not c:blockers.append('No explicitly promoted champion')
 return {'ok':True,'champion':c,'modelReady':bool(c) and not blockers,'trainingReady':not [x for x in blockers if x!='No explicitly promoted champion'],'quality':quality,'blockers':blockers,'promotion':'manual-only'}
@app.post('/v1/score')
def score(req:ScoreRequest,authorization:str|None=Header(default=None)):
 auth(authorization);c,models=load_models();result=[]
 for lead in req.leads:
  if models and 'transformer' in models:
   payload=LeadPayload.model_validate(lead);q=torch.tensor(sequence_from_lead(payload)[None,:,:]);x=torch.tensor(structured(payload)[None,:]);temps=torch.tensor(models['temperatures'])
   with torch.no_grad():prob=torch.sigmoid(models['transformer'](q,x)/temps).numpy()[0]
   out={t:float(prob[i]) for i,t in enumerate(TARGETS)}
  elif models:
   X=pd.DataFrame([feature(lead)]);out={t:float(models[t].predict_proba(X)[:,1][0]) for t in TARGETS if t in models}
  else:out=fallback(lead)
  intelligence=round(100*(.2*out['contact7d']+.25*out['appointment30d']+.2*out['client90d']+.25*out['closing180d']+.1*(1-out['attrition30d'])))
  action='Call today' if out['contact7d']>.65 else ('Schedule appointment' if out['appointment30d']>.55 else ('Recovery nurture' if out['reactivation30d']>.45 else 'Maintain cadence'))
  result.append({'leadId':str(lead.get('id')),'score':intelligence,'confidence':max(out.values())-min(out.values()),'mode':'trained' if models else 'baseline-fallback','modelVersion':c['name'] if c else 'fallback-11','outcomes':out,'recommendedAction':action,'positiveEvidence':['Observed activity and task signals influenced this score'],'negativeEvidence':['Model requires Vesta-trained champion' if not models else 'Review outcome-specific evidence in the web adapter']})
 return {'ok':True,'predictions':result,'model':c}
@app.post('/v1/feedback')
def feedback(item:Feedback,authorization:str|None=Header(default=None)):
 auth(authorization);DB.parent.mkdir(parents=True,exist_ok=True);con=sqlite3.connect(DB);con.execute('CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY,created_at TEXT,lead_id TEXT,prediction_id TEXT,useful TEXT,reason TEXT,action_taken TEXT,outcome TEXT,actor_id TEXT)');con.execute('INSERT INTO feedback(created_at,lead_id,prediction_id,useful,reason,action_taken,outcome,actor_id) VALUES(?,?,?,?,?,?,?,?)',(datetime.now(timezone.utc).isoformat(),item.lead_id,item.prediction_id,item.useful,item.reason,item.action_taken,item.outcome,item.actor_id));con.commit();con.close();return {'ok':True}
