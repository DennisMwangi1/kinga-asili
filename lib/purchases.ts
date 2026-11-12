export function validatePurchase(input:Record<string,unknown>,requireKey=false){
 const payment_method=String(input.payment_method||'');
 if(!['Cash','M-PESA','Bank'].includes(payment_method))throw Error('Choose Cash, M-PESA or Bank as the payment method.');
 let reference=String(input.reference||'').trim();
 if(payment_method!=='Cash'&&reference.length<2)throw Error('A payment reference is required unless payment was cash.');
 if(payment_method==='M-PESA'){reference=reference.toUpperCase();if(!/^[A-Z0-9]{10}$/.test(reference))throw Error('Enter the 10-character M-PESA transaction reference.');}
 if(reference.length>200)throw Error('Keep the payment reference within 200 characters.');
 const amount=Number(input.amount),description=String(input.description||'').trim(),supplier=String(input.supplier||'').trim(),date=String(input.date||'');
 if(!Number.isFinite(amount)||amount<=0||amount>100000000)throw Error('Enter a valid positive amount.');
 if(description.length<2||description.length>2000)throw Error('Enter the item or expense, up to 2,000 characters.');
 if(supplier.length>200)throw Error('Keep the supplier or payee within 200 characters.');
 const parsed=new Date(date+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw Error('Enter a valid expense or purchase date.');
 if(!['purchase','expense'].includes(String(input.kind)))throw Error('Choose a material receipt or operating expense.');
 const lines=input.lines;
 if(!Array.isArray(lines)||input.kind==='purchase'&&!lines.length)throw Error('Record material quantities received.');
 if(input.kind==='expense'&&lines.length)throw Error('Operating expenses cannot add material stock.');
 for(const line of lines){if(!line||typeof line!=='object'||!Number.isFinite(Number(line.quantity))||Number(line.quantity)<=0||typeof line.material_id!=='string')throw Error('Enter valid material quantities.');}
 if((requireKey||input.idempotency_key)&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(input.idempotency_key||'')))throw Error('Reopen the purchase form and try again.');
 return {...input,payment_method,reference:reference||null,amount,description,supplier,date,lines};
}
/** Extract one outgoing payment only; balances, fees and incoming receipts are not expenses. */
export function parseMpesaPayment(text:string){
 const matches=[...text.matchAll(/\b([A-Z0-9]{10})\s+Confirmed\.?\s*(?:Ksh|KES)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:has been\s+)?(?:sent|paid)\s+to\s+([^\n]+?)\s+on\s+(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?=\s|\.)/gi)];
 if(matches.length!==1)return null;
 const [,reference,value,payee,day,month,year]=matches[0];const amount=Number(value.replaceAll(',',''));
 const date=`${year.length===2?'20'+year:year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
 const parsed=new Date(date+'T12:00:00Z');
 if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return null;
 return {payment_method:'M-PESA',reference:reference.toUpperCase(),amount,date,supplier:payee.replace(/\s+(?:\+?254|0)[17]\d{8}\s*$/,'').trim()};
}
