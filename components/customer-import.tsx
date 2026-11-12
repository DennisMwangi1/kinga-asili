'use client';
import {useRef,useState} from 'react';
import {Upload} from 'lucide-react';
import {parseCustomers} from '@/lib/import-csv';
import {validateCustomer} from '@/lib/customer-validation';
export default function CustomerImport({busy,onImport}:{busy:boolean;onImport:(customers:Record<string,unknown>[])=>Promise<boolean>}){
 const input=useRef<HTMLInputElement>(null),[error,setError]=useState(''),[reading,setReading]=useState(false);
 return <div className="customer-import"><button type="button" disabled={busy||reading} onClick={()=>input.current?.click()}><Upload size={18} aria-hidden="true"/>{reading?'Reading CSV…':'Import CSV'}</button><input ref={input} hidden type="file" accept=".csv,text/csv" aria-label="Choose customers CSV" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setError('');setReading(true);try{if(file.size>2*1024*1024)throw Error('Choose a CSV smaller than 2 MB.');const rows=parseCustomers(await file.text());if(!rows.length)throw Error('The CSV contains no customers.');const customers=rows.map((row,index)=>{const result=validateCustomer(row);const first=Object.values(result.errors)[0];if(first)throw Error(`Row ${index+2}: ${first}`);return {...result.value};});await onImport(customers);}catch(cause){setError((cause as Error).message);}finally{setReading(false);}}}/><small>CSV columns: name, phone, location, notes. Marketing stays opted out.</small>{error&&<span className="field-error" role="alert">{error}</span>}</div>;
}
