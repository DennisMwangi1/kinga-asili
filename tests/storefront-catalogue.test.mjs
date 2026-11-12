import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './load.mjs';
const {catalogueBlends,catalogueChoices,requestLines}=await loadTs('../storefront/lib/catalogue.ts');
const products=[{id:'glt120',blend:'GLT',volume_ml:120,price:200},{id:'got60',blend:'GOT',volume_ml:60,price:100},{id:'glt60',blend:'GLT',volume_ml:60,price:100}];
const bundles=[{id:'pack',product_id:'glt60',name:'Weekly pack',quantity:7,price:650,active:true},{id:'inactive',product_id:'glt120',name:'Promotion',quantity:5,price:800,active:false}];
test('storefront choices use real catalogue prices and only active packs for the chosen blend',()=>{const choices=catalogueChoices(products,bundles,'GLT');assert.deepEqual(choices.map(choice=>choice.price),[100,200,650]);assert.deepEqual(choices.map(choice=>choice.label),['60 ml','120 ml','7 × 60 ml']);assert.equal(catalogueChoices(products,bundles,'GOT').length,1);assert.deepEqual(catalogueChoices([],bundles,'GLT'),[]);});
test('ordinary bottle quantities and repeated packs produce the server-supported request lines',()=>{const choices=catalogueChoices(products,bundles,'GLT');const cart=[{...choices[0],blend:'GLT',size:'60 ml',quantity:3},{...choices[2],blend:'GLT',size:'7 × 60 ml',quantity:2}];assert.deepEqual(requestLines(cart),[{product_id:'glt60',quantity:3},{product_id:'glt60',quantity:7,bundle_id:'pack'},{product_id:'glt60',quantity:7,bundle_id:'pack'}]);assert.ok(!('price' in requestLines(cart)[0]));});
test('empty, oversized and non-whole-bottle requests are rejected before submission',()=>{const choice=catalogueChoices(products,bundles,'GLT')[0],pack=catalogueChoices(products,bundles,'GLT')[2];assert.throws(()=>requestLines([]));for(const quantity of [0,1.5,101])assert.throws(()=>requestLines([{...choice,quantity}]));assert.throws(()=>requestLines([{...pack,quantity:21}]));});

test('public cards and options follow active database products, including added bottle sizes',()=>{
 const catalogue=[...products.map(p=>({...p,name:'Backend name',image:'/images/glt.jpg'})),{id:'glt250',blend:'GLT',volume_ml:250,price:390,name:'New bottle',image:'/images/new.jpg',note:'From the owner',description:'Catalogue copy'},{id:'hidden',blend:'GOT',volume_ml:450,price:700,active:false}];
 const groups=catalogueBlends(catalogue);const glt=groups.find(group=>group.id==='GLT');
 assert.deepEqual(glt.variants.map(p=>p.volume_ml),[60,120,250]);assert.equal(glt.variants.at(-1).name,'New bottle');assert.equal(glt.variants.at(-1).image,'/images/new.jpg');
 assert.ok(!groups.flatMap(group=>group.variants).some(p=>p.id==='hidden'));assert.ok(!catalogueChoices(catalogue,[],'GOT').some(p=>p.product_id==='hidden'));
 assert.deepEqual(catalogueBlends([{...catalogue[0],active:false}]),[]);
});
