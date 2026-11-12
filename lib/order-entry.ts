import {customerPhone} from './customer-validation';
import type {RecordRow} from './domain';
export function orderCustomerValues(customer?:RecordRow){return customer?{...customer,name:String(customer.name||''),phone:customerPhone(String(customer.phone||''))||'',location:String(customer.location||'')} : undefined;}
export function customerMatches(customer:RecordRow,query:string){
 const search=query.trim().toLocaleLowerCase();
 const digits=/^[+\d\s().-]+$/.test(search)?search.replace(/\D/g,''):'';
 const phoneQuery=digits.startsWith('0')?'254'+digits.slice(1):digits;
 return !search||[customer.name,customer.location,customerPhone(String(customer.phone||''))||''].some(value=>String(value||'').toLocaleLowerCase().includes(search))||phoneQuery.length>=3&&!!customerPhone(String(customer.phone||''))?.includes(phoneQuery);
}
export function orderAmount(value:string,label:string){const amount=value.trim()===''?0:Number(value);if(!Number.isFinite(amount)||amount<0)throw Error(`${label} must be zero or a positive amount.`);return amount;}
