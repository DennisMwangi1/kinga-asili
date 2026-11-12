export type CustomerField='name'|'phone'|'location'|'notes';
export interface CustomerInput {name:string;phone:string;location:string;notes:string;marketing_opt_out:boolean;}
export function customerPhone(value:string):string|null {
 if(!/^[+\d\s().-]+$/.test(value.trim()))return null;
 let digits=value.replace(/\D/g,'');if(/^0[17]\d{8}$/.test(digits))digits='254'+digits.slice(1);
 return /^254[17]\d{8}$/.test(digits)?digits:null;
}
export function validateCustomer(input:Record<string,unknown>){
 const value:CustomerInput={name:String(input.name??'').trim().replace(/\s+/g,' '),phone:String(input.phone??'').trim(),location:String(input.location??'').trim(),notes:String(input.notes??'').trim(),marketing_opt_out:input.marketing_opt_out!==false};
 const errors:Partial<Record<CustomerField,string>>={};
 if(value.name.length<2||value.name.length>100)errors.name='Enter a customer name between 2 and 100 characters.';
 const phone=customerPhone(value.phone);if(!phone)errors.phone='Enter a valid Kenyan mobile number, such as 07XXXXXXXX or +2547XXXXXXXX.';else value.phone=phone;
 if(value.location.length>500||value.location.length>0&&value.location.length<5)errors.location='Enter at least 5 characters for the address, up to 500.';
 if(value.notes.length>2000)errors.notes='Keep notes within 2,000 characters.';
 return {value,errors};
}
