import torch
from torch import nn
class LeadTransformer(nn.Module):
    def __init__(self,event_vocab=32,structured_dim=11,d_model=64,nhead=4,layers=3,outputs=6):
        super().__init__();self.event=nn.Embedding(event_vocab,d_model);self.time=nn.Linear(1,d_model);self.pos=nn.Embedding(256,d_model)
        layer=nn.TransformerEncoderLayer(d_model,nhead,dim_feedforward=192,dropout=.15,batch_first=True,norm_first=True);self.encoder=nn.TransformerEncoder(layer,layers)
        self.structured=nn.Sequential(nn.Linear(structured_dim,64),nn.ReLU(),nn.LayerNorm(64));self.head=nn.Sequential(nn.Linear(d_model+64,96),nn.ReLU(),nn.Dropout(.15),nn.Linear(96,outputs))
    def forward(self,seq,structured):
        ids=seq[:,:,0].long();times=seq[:,:,1:2];pos=torch.arange(seq.size(1),device=seq.device).unsqueeze(0);x=self.event(ids)+self.time(times)+self.pos(pos);mask=ids.eq(0);x=self.encoder(x,src_key_padding_mask=mask);valid=(~mask).float().unsqueeze(-1);pooled=(x*valid).sum(1)/valid.sum(1).clamp_min(1);return self.head(torch.cat([pooled,self.structured(structured)],1))
