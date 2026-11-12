export interface ProposalChange {action:string;data:Record<string,unknown>;summary:string;}
export interface Proposal extends ProposalChange {token:string;}
export type ApprovalMode='manual'|'auto';
export interface ExecutionItem {index:number;action:string;summary:string;status:'saved'|'already_applied'|'failed';recordId?:string;error?:string;}
export interface ExecutionResult {status:'complete'|'partial'|'failed';total:number;saved:number;alreadyApplied:number;failed:number;items:ExecutionItem[];message:string;}
