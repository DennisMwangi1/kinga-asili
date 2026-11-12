/** Refresh only the known seeded records. Preserve quantities, payments, allocations and unrelated records. */
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {createInterface} from 'node:readline';
const reader=createInterface({input:process.stdin});let input;for await(const line of reader){input=JSON.parse(line);break;}
if(!input?.serviceRoleKey)throw Error('Supply the service-role key through stdin.');
const db=createClient('https://tbxokonhjeellhfcusui.supabase.co',input.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});input=null;
// Stable namespace preserves links to the original fixture records.
const id=name=>{const h=createHash('sha256').update('kinga-demonstration-v1:'+name).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
async function update(table,key,values){const {data,error}=await db.from(table).update(values).eq('id',key).select('id');if(error)throw Error(`${table}: ${error.message}`);return data.length;}
async function select(table){const {data,error}=await db.from(table).select('*');if(error)throw error;return data;}
const access=JSON.parse(await readFile('.local/staff-access.json','utf8'));
const names={admin:'Kinga Owner',sales:'Sales Team',cashier:'Cashier',stock_keeper:'Stock Keeper',driver:'Delivery Rider'};
for(const account of access.filter(a=>a.email.endsWith('@kingaasili.test'))){const name=names[account.role];if(!name)continue;await update('profiles',account.id,{full_name:name});const {data,error}=await db.auth.admin.getUserById(account.id);if(error)throw error;const metadata={...data.user.user_metadata,full_name:name,is_demo:null};const result=await db.auth.admin.updateUserById(account.id,{user_metadata:metadata});if(result.error)throw result.error;account.name=name;}
const customers=['Amina Hassan','Brian Otieno','Njeri Mwangi','Wanjiku Kamau','Peter Kariuki','Grace Wambui'];
for(let i=0;i<customers.length;i++)await update('customers',id('customer-'+i),{name:customers[i],phone:`KA-C${String(i+1).padStart(4,'0')}`,notes:''});
const orders=await select('orders');let orderCount=0;
for(let i=0;i<8;i++){const record=orders.find(o=>o.id===id('order-'+i));if(!record)continue;const customerIndex=i%customers.length;orderCount+=await update('orders',record.id,{reference:`KA-${1001+i}`,customer_name:customers[customerIndex],phone:`KA-C${String(customerIndex+1).padStart(4,'0')}`,notes:i===4?'Leave with the reception desk.':i===5?'Call before arrival.':'',exception_reason:record.exception_reason?.replace(/^Sample exception:\s*/,'')||''});}
for(const blend of ['GLT','GOT']){
 const reference=`${blend}-261104-01`;
 await update('batches',id('batch-'+blend),{reference,notes:'Opening stock reconciliation. Awaiting stock-control review.'});
 for(const size of [60,120,450])await update('stock_lots',id(`lot-${blend}-${size}`),{batch_reference:reference});
}
await update('batches',id('draft-batch'),{reference:'GLT-261110-01',notes:'Bottling record awaiting quantity and date verification.'});
const seededOrders=orders.filter(o=>Array.from({length:8},(_,i)=>id('order-'+i)).includes(o.id));
const payments=await select('payments');let paymentCount=0;
for(const p of payments.filter(p=>seededOrders.some(o=>o.id===p.order_id))){if(!p.reference.startsWith('DEMO-PAY-'))continue;paymentCount+=await update('payments',p.id,{reference:p.reference.replace('DEMO-PAY-','RCPT-2611-')});}
await update('purchases',id('purchase-1'),{reference:'GRN-2611-001',supplier:'Nairobi Fresh Produce',description:'Ginger and lemons received for the weekly production run.'});
await update('purchases',id('purchase-2'),{reference:'EXP-2611-001',supplier:'City Dispatch',description:'Rider delivery charges.'});
await update('purchases',id('purchase-3'),{reference:'GRN-2611-002',supplier:'Eastlands Packaging',description:'120 ml glass bottles awaiting receipt verification.'});
for(const movement of await select('movements')){
 const knownMaterial=movement.material_id&&movement.id===id('material-opening-'+movement.material_id);
 const knownBottles=movement.lot_id&&movement.id===id('lot-opening-'+movement.lot_id);
 if(!knownMaterial&&!knownBottles)continue;
 await update('movements',movement.id,{item:knownBottles?'Finished bottles':movement.item,reason:'Opening stock reconciliation',reference:knownMaterial?'OPEN-2611-001':movement.reference.replace('DEMO-GLT-OPENING','GLT-261104-01').replace('DEMO-GOT-OPENING','GOT-261104-01')});
}
await update('bundles',id('bundle-1'),{name:'Seven daily shots'});await update('bundles',id('bundle-2'),{name:'Four double shots'});
await update('audit',id('seed-audit'),{action:'workspace_initialized'});
await writeFile('.local/staff-access.json',JSON.stringify(access,null,2),{mode:0o600});await chmod('.local/staff-access.json',0o600);
const lines=['# Kinga Asili staff access','','Sign in at http://localhost:3000/login.','',...access.flatMap(a=>[`## ${a.name}`,`Email: ${a.email}`,`Role: ${a.role}`,`Password: ${a.password}`,''])];
await writeFile('.local/staff-access.md',lines.join('\n'),{mode:0o600});await chmod('.local/staff-access.md',0o600);
await writeFile('.local/demo-access.md',lines.join('\n'),{mode:0o600});
const tables=['profiles','customers','orders','batches','stock_lots','payments','purchases','movements','bundles','audit'];const remaining={};
for(const table of tables){const rows=await select(table);const displayFields=['full_name','name','reference','batch_reference','supplier','description','item','reason','notes','action'];remaining[table]=rows.filter(r=>displayFields.some(key=>typeof r[key]==='string'&&/\b(?:demo|sample|demonstration)\b/i.test(r[key]))).length;}
console.log(JSON.stringify({customers:customers.length,orders:orderCount,payments:paymentCount,remaining_labels:remaining,preserved_stock_and_payments:true,credentials_file:'.local/staff-access.md'}));
