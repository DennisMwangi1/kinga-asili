'use client';
import {useId,useState,type FormEvent} from 'react';
import {validateCustomer,customerPhone,type CustomerField} from '@/lib/customer-validation';
import type {RecordRow} from '@/lib/domain';
export default function CustomerForm({initial,busy,formId,onSave}:{initial?:RecordRow;busy:boolean;formId:string;onSave:(data:Record<string,unknown>)=>Promise<boolean>}){
 const id=useId();
 const [values,setValues]=useState({name:String(initial?.name||''),phone:customerPhone(String(initial?.phone||''))||'',location:String(initial?.location||''),notes:String(initial?.notes||''),marketing_opt_out:initial?.marketing_opt_out!==false});
 const [errors,setErrors]=useState<Partial<Record<CustomerField,string>>>({});
 const change=(field:CustomerField,value:string)=>{const next={...values,[field]:value};setValues(next);if(errors[field])setErrors(current=>({...current,[field]:validateCustomer(next).errors[field]}));};
 const blur=(field:CustomerField)=>setErrors(current=>({...current,[field]:validateCustomer(values).errors[field]}));
 const inputProps=(field:CustomerField)=>({id:id+'-'+field,name:field,value:values[field],onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>change(field,e.target.value),onBlur:()=>blur(field),'aria-invalid':!!errors[field],'aria-describedby':errors[field]?id+'-'+field+'-error':undefined,disabled:busy});
 const fieldError=(field:CustomerField)=>errors[field]&&<span className="field-error" role="alert" id={id+'-'+field+'-error'}>{errors[field]}</span>;
 async function submit(event:FormEvent){event.preventDefault();const result=validateCustomer(values);setErrors(result.errors);if(Object.keys(result.errors).length){document.getElementById(id+'-'+Object.keys(result.errors)[0])?.focus();return;}await onSave({...result.value,...(initial?.id?{id:initial.id}:{})});}
 return <form id={formId} className="customer-form" onSubmit={submit} noValidate>
  <label htmlFor={id+'-name'}>Customer name<input {...inputProps('name')} autoComplete="name" required minLength={2} maxLength={100}/>{fieldError('name')}</label>
  <label htmlFor={id+'-phone'}>Mobile number<input {...inputProps('phone')} type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} placeholder="07XXXXXXXX or +2547XXXXXXXX"/>{fieldError('phone')}</label>
  <label htmlFor={id+'-location'}>Delivery address <span className="optional-label">(optional)</span><textarea {...inputProps('location')} autoComplete="street-address" rows={3} minLength={5} maxLength={500} placeholder="Building, street, area and delivery directions"/>{fieldError('location')}<small className="form-help">Use multiple lines for an address and directions.</small></label>
  <label htmlFor={id+'-notes'}>Customer notes <span className="optional-label">(optional)</span><textarea {...inputProps('notes')} rows={3} maxLength={2000}/>{fieldError('notes')}</label>
  <label className="check"><input type="checkbox" checked={!values.marketing_opt_out} disabled={busy} onChange={event=>setValues(current=>({...current,marketing_opt_out:!event.target.checked}))}/>Customer explicitly consented to marketing</label>
 </form>;
}
