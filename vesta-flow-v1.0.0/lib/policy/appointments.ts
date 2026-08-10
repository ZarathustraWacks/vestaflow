const present=(value:unknown)=>value!==undefined&&value!==null&&value!=='';
export function auditAppointments(items:any[]){
 const findings=items.map(item=>{
  const hasType=present(item?.appointmentTypeId)||present(item?.appointmentType?.id)||present(item?.type);
  const invitees=Array.isArray(item?.invitees)?item.invitees:Array.isArray(item?.people)?item.people:[];
  const hasClient=present(item?.personId)||present(item?.person?.id)||invitees.length>0;
  const reminders=Array.isArray(item?.reminders)?item.reminders:[];
  const reminderVisible=reminders.length>0||present(item?.reminder)||present(item?.reminderMinutes);
  const issues=[!hasType?'Appointment type is missing.':null,!hasClient?'No client invitee is visible.':null,!reminderVisible?'Reminder configuration is not visible in the API response.':null].filter(Boolean);
  return {id:item?.id??null,start:item?.start??item?.startAt??null,type:item?.type??item?.appointmentType?.name??null,hasClient,reminderVisible,status:issues.length?'review':'valid',issues};
 });
 return {total:findings.length,valid:findings.filter(item=>item.status==='valid').length,review:findings.filter(item=>item.status==='review').length,findings,limitation:'Follow Up Boss may restrict appointment visibility to the creator, calendar users, or appointments created in Follow Up Boss.'};
}
