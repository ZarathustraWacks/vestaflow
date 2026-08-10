import argparse,json
from .registry import promote
p=argparse.ArgumentParser();p.add_argument('candidate');p.add_argument('--registry',default='models/registry');p.add_argument('--reason',default='manual promotion');a=p.parse_args();print(json.dumps(promote(a.candidate,a.registry,a.reason),indent=2))
