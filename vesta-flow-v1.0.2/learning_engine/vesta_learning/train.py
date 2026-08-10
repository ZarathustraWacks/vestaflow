from __future__ import annotations
import argparse,json
from pathlib import Path
import numpy as np,torch
from torch import nn
from torch.utils.data import DataLoader,TensorDataset
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import average_precision_score,brier_score_loss,roc_auc_score
from .schemas import LeadPayload
from .features import structured,sequence_from_lead
from .model import LeadTransformer
TARGETS=['contact7d','appointment30d','client90d','closing180d','attrition30d','reactivation30d']

def fit_temperatures(logits:torch.Tensor,labels:torch.Tensor)->list[float]:
 out=[]
 for i in range(logits.shape[1]):
  temperature=torch.ones(1,requires_grad=True);opt=torch.optim.LBFGS([temperature],lr=.05,max_iter=50);lossfn=nn.BCEWithLogitsLoss()
  def closure():
   opt.zero_grad();loss=lossfn(logits[:,i]/temperature.clamp(.25,10),labels[:,i]);loss.backward();return loss
  opt.step(closure);out.append(float(temperature.detach().clamp(.25,10)))
 return out

def main():
 p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--out',default='models/registry/transformer-v1');p.add_argument('--epochs',type=int,default=12);p.add_argument('--batch-size',type=int,default=128);a=p.parse_args()
 rows=[json.loads(x) for x in open(a.data) if x.strip()];leads=[LeadPayload.model_validate(r['lead']) for r in rows];X=np.stack([structured(x) for x in leads]);Q=np.stack([sequence_from_lead(x) for x in leads]);Y=np.array([[float(r['labels'].get(t,0)) for t in TARGETS] for r in rows],dtype=np.float32);groups=np.array([str(x.id) for x in leads]);split=GroupShuffleSplit(n_splits=1,test_size=.2,random_state=42);tr,va=next(split.split(X,groups=groups))
 model=LeadTransformer();positive=Y[tr].sum(0);negative=len(tr)-positive;weights=np.clip(negative/np.clip(positive,1,None),1,30);lossfn=nn.BCEWithLogitsLoss(pos_weight=torch.tensor(weights,dtype=torch.float32));opt=torch.optim.AdamW(model.parameters(),lr=2e-4,weight_decay=1e-3);loader=DataLoader(TensorDataset(torch.tensor(Q[tr]),torch.tensor(X[tr]),torch.tensor(Y[tr])),batch_size=a.batch_size,shuffle=True)
 best=None;best_loss=float('inf')
 for epoch in range(a.epochs):
  model.train();total=0
  for q,x,y in loader:opt.zero_grad();loss=lossfn(model(q,x),y);loss.backward();nn.utils.clip_grad_norm_(model.parameters(),1.0);opt.step();total+=loss.item()*len(y)
  model.eval()
  with torch.no_grad():vlogits=model(torch.tensor(Q[va]),torch.tensor(X[va]));vloss=float(lossfn(vlogits,torch.tensor(Y[va])))
  if vloss<best_loss:best_loss=vloss;best={k:v.detach().cpu().clone() for k,v in model.state_dict().items()}
  print({'epoch':epoch+1,'train_loss':total/len(tr),'validation_loss':vloss})
 model.load_state_dict(best);model.eval()
 with torch.no_grad():logits=model(torch.tensor(Q[va]),torch.tensor(X[va]));temperatures=fit_temperatures(logits,torch.tensor(Y[va]));prob=torch.sigmoid(logits/torch.tensor(temperatures)).numpy()
 metrics={}
 for i,t in enumerate(TARGETS):
  m={'brier':float(brier_score_loss(Y[va,i],prob[:,i])),'positive_rate':float(Y[va,i].mean()),'temperature':temperatures[i]}
  if len(np.unique(Y[va,i]))>1:m.update({'roc_auc':float(roc_auc_score(Y[va,i],prob[:,i])),'average_precision':float(average_precision_score(Y[va,i],prob[:,i]))})
  metrics[t]=m
 out=Path(a.out);out.mkdir(parents=True,exist_ok=True);torch.save(model.state_dict(),out/'model.pt');metadata={'model_type':'temporal_transformer','version':out.name,'targets':TARGETS,'rows':len(rows),'people':len(set(groups)),'structured_dim':11,'sequence_length':128,'temperatures':temperatures,'metrics':metrics};(out/'metadata.json').write_text(json.dumps(metadata,indent=2));print(json.dumps(metadata,indent=2))
if __name__=='__main__':main()
