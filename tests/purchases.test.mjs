import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load.mjs';
const {validatePurchase,parseMpesaPayment}=await loadTs('../lib/purchases.ts');
const expense={kind:'expense',payment_method:'Cash',description:'Market supplies',date:'2026-11-12',amount:1250,lines:[]};
test('only cash may omit a reference; noncash methods reject missing or invalid references',()=>{
 assert.equal(validatePurchase(expense).reference,null);assert.equal(validatePurchase({...expense,reference:'Receipt 12'}).reference,'Receipt 12');
 for(const payment_method of ['M-PESA','Bank','unknown',''])assert.throws(()=>validatePurchase({...expense,payment_method}));
 assert.equal(validatePurchase({...expense,payment_method:'M-PESA',reference:'qkl1234567'}).reference,'QKL1234567');
 assert.equal(validatePurchase({...expense,payment_method:'Bank',reference:'BANK-100'}).reference,'BANK-100');
});
test('cash expenses still require valid item, amount, date and submission keys',()=>{
 for(const amount of [0,-1,NaN,Infinity])assert.throws(()=>validatePurchase({...expense,amount}));
 for(const date of ['','2026-02-30'])assert.throws(()=>validatePurchase({...expense,date}));
 assert.throws(()=>validatePurchase({...expense,description:''}));assert.throws(()=>validatePurchase(expense,true));
 assert.ok(validatePurchase({...expense,idempotency_key:'00000000-0000-4000-8000-000000000001'},true));
 assert.throws(()=>validatePurchase({...expense,lines:[{material_id:'ginger',quantity:1}]}));
 assert.throws(()=>validatePurchase({...expense,kind:'purchase'}));
});
test('M-PESA extraction uses the principal, reference and payment date, excluding fees and balance',()=>{
 const payment=parseMpesaPayment('QKL1234567 Confirmed. Ksh1,250.00 sent to MARKET SUPPLIES 0712345678 on 12/11/26 at 10:30 AM. New M-PESA balance is Ksh8,000.00. Transaction cost, Ksh23.00.');
 assert.deepEqual(payment,{payment_method:'M-PESA',reference:'QKL1234567',amount:1250,date:'2026-11-12',supplier:'MARKET SUPPLIES'});
 const paid=parseMpesaPayment('QKL1234568 Confirmed. Ksh200.00 paid to PACKAGING SHOP on 1/11/2026 at 9:00 AM.');assert.equal(paid.amount,200);assert.equal(paid.date,'2026-11-01');
});
test('incoming receipts, invalid dates and multiple outgoing payments are not collapsed into one expense',()=>{
 assert.equal(parseMpesaPayment('QKL1234567 Confirmed. You have received Ksh1,250.00 from SOMEONE on 12/11/26.'),null);
 assert.equal(parseMpesaPayment('QKL1234567 Confirmed. Ksh100.00 paid to SHOP on 30/2/26 at 9 AM.'),null);
 const sms='QKL1234567 Confirmed. Ksh100.00 paid to SHOP on 12/11/26 at 9 AM.';assert.equal(parseMpesaPayment(sms+'\n'+sms),null);
});
