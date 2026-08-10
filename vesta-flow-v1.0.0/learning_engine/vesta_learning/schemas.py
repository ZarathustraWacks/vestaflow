from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict
class EventPayload(BaseModel):
    model_config=ConfigDict(extra='allow')
    type:str='other';at:str|None=None;deltaHours:float=0
class LeadPayload(BaseModel):
    model_config=ConfigDict(extra='allow')
    id:str|int;name:str='';stage:str='';source:str='';assignedUserName:str='Unassigned';createdAt:str|None=None;lastActivityAt:str|None=None;lastCommunicationAt:str|None=None;nextTaskAt:str|None=None;ageBand:str='';engagementBand:str='';governanceScore:float=0;tags:list[str]=Field(default_factory=list);price:float|None=None;ageDays:float=0;eventCount:float=0;openTaskCount:float=0;callCount:float=0;textCount:float=0;emailCount:float=0;propertyViewCount:float=0;events:list[EventPayload]=Field(default_factory=list);raw:Any=None
class BatchRequest(BaseModel):leads:list[LeadPayload]
class Feedback(BaseModel):lead_id:str;prediction_id:str|None=None;action_taken:str|None=None;useful:Literal['yes','partly','no']|None=None;outcome:str|None=None;outcome_at:str|None=None;metadata:dict[str,Any]=Field(default_factory=dict)
