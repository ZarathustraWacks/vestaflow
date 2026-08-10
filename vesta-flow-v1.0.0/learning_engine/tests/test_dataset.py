from datetime import datetime,timezone,timedelta
from vesta_learning.dataset import snapshot_features

def test_snapshot_does_not_include_future_events():
 now=datetime(2025,1,1,tzinfo=timezone.utc);p={'id':1,'created':now.isoformat(),'stage':'Lead'}
 events=[{'personId':1,'type':'Call','created':(now-timedelta(hours=1)).isoformat()},{'personId':1,'type':'Closed','created':(now+timedelta(days=10)).isoformat()}]
 snap=snapshot_features(p,events,[],now)
 assert snap['eventCount']==1
 assert snap['events'][0]['type']=='Call'
