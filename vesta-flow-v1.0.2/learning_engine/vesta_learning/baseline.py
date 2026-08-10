from __future__ import annotations
import argparse,json
from pathlib import Path
import joblib,numpy as np,pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import average_precision_score,brier_score_loss,roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder,StandardScaler
from sklearn.calibration import CalibratedClassifierCV
TARGETS=['contact7d','appointment30d','client90d','closing180d','attrition30d','reactivation30d']
CAT=['stage','source','assignedUserName'];NUM=['ageDays','eventCount','openTaskCount','callCount','textCount','emailCount','propertyViewCount','price']
def frame(rows):
 d=[]
 for r in rows:
  x=r['lead'];d.append({**{k:x.get(k) for k in CAT+NUM},'person_id':str(x.get('id')),'snapshot_at':r.get('snapshot_at'),**{t:int(r['labels'].get(t,0)) for t in TARGETS}})
 return pd.DataFrame(d)
def main():
 p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--out',default='models/registry/baseline-v1');a=p.parse_args();rows=[json.loads(x) for x in open(a.data) if x.strip()];df=frame(rows)
 splitter=GroupShuffleSplit(n_splits=1,test_size=.2,random_state=42);tr,va=next(splitter.split(df,groups=df.person_id));prep=ColumnTransformer([('cat',Pipeline([('imp',SimpleImputer(strategy='most_frequent')),('oh',OneHotEncoder(handle_unknown='ignore',sparse_output=False))]),CAT),('num',Pipeline([('imp',SimpleImputer(strategy='median')),('scale',StandardScaler())]),NUM)])
 out=Path(a.out);out.mkdir(parents=True,exist_ok=True);metrics={}
 for target in TARGETS:
  y=df[target].to_numpy();base=Pipeline([('prep',prep),('model',HistGradientBoostingClassifier(max_iter=150,learning_rate=.07,max_leaf_nodes=31,l2_regularization=1.0,random_state=42))])
  model=CalibratedClassifierCV(base,method='sigmoid',cv=3);model.fit(df.iloc[tr][CAT+NUM],y[tr]);prob=model.predict_proba(df.iloc[va][CAT+NUM])[:,1]
  m={'brier':float(brier_score_loss(y[va],prob)),'positive_rate':float(y[va].mean())}
  if len(np.unique(y[va]))>1:m.update({'roc_auc':float(roc_auc_score(y[va],prob)),'average_precision':float(average_precision_score(y[va],prob))})
  metrics[target]=m;joblib.dump(model,out/f'{target}.joblib')
 metadata={'model_type':'calibrated_hist_gradient_boosting','version':out.name,'rows':len(df),'people':int(df.person_id.nunique()),'features':{'categorical':CAT,'numeric':NUM},'metrics':metrics}
 (out/'metadata.json').write_text(json.dumps(metadata,indent=2));print(json.dumps(metadata,indent=2))
if __name__=='__main__':main()
