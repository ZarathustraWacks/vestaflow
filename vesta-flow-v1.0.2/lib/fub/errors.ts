export class FubError extends Error {
 constructor(message:string, public status:number, public details?:unknown, public retryAfter?:number){super(message);this.name='FubError';}
}
