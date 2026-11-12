import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load.mjs';
const {lineTotal,eatDate,csv,weeklyMetrics}=await loadTs('../shared/domain.ts');
test('free bottles consume quantity but do not inflate price',()=>{assert.equal(lineTotal([{product_id:'glt',quantity:5,free_quantity:1,unit_price:200}],200,100),900);});
test('invalid bottle quantities, excessive discounts and negative amounts fail',()=>{for(const line of [{quantity:1.5,unit_price:100},{quantity:0,unit_price:100},{quantity:1,unit_price:-1},{quantity:1,free_quantity:2,unit_price:100}])assert.throws(()=>lineTotal([{product_id:'glt',...line}]));assert.throws(()=>lineTotal([{product_id:'glt',quantity:1,unit_price:100}],0,101));assert.throws(()=>lineTotal([{product_id:'glt',quantity:1,unit_price:100}],NaN));});
test('date boundaries use Nairobi time',()=>{assert.equal(eatDate(new Date('2026-11-09T21:30:00Z')),'2026-11-10');});
test('CSV preserves quotes, newlines and protects spreadsheet formulas',()=>{const output=csv([{name:'=SUM(A1)',note:'a,"b"\nc'}]);assert.match(output,/"'=SUM\(A1\)"/);assert.match(output,/"a,""b""\nc"/);});
test('weekly review separates requests, sales, payments and balances using EAT boundaries',()=>{const s={orders:[{status:'confirmed',total:1000,paid:400,created_at:'2026-11-09T22:00:00Z',lines:[{quantity:5}]},{status:'requested',total:500,paid:0,created_at:'2026-11-10T00:00:00Z',lines:[{quantity:1}]}],payments:[{amount:400,created_at:'2026-11-09T22:00:00Z'}],purchases:[{amount:200,status:'posted',date:'2026-11-10'}],batches:[]};assert.deepEqual(weeklyMetrics(s,'2026-11-10','2026-11-10'),{sales:1000,collected:400,outstanding:600,expenses:200,bottles:5,production:0,wastage:0});});
