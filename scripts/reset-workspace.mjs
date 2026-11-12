/** Explicit one-off reset. Read project credentials and replacement admin from stdin. */
import {createClient} from '@supabase/supabase-js';
import {writeFile,chmod,unlink} from 'node:fs/promises';
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const input=JSON.parse(raw);raw='';
if(input.confirm!=='CLEAR ALL KINGA DATA' || input.url!=='https://tbxokonhjeellhfcusui.supabase.co')throw Error('Explicit Kinga project reset confirmation required.');
if(!input.serviceRoleKey||!input.email||!input.password)throw Error('Project key and replacement admin credentials required.');
const db=createClient(input.url,input.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});delete input.serviceRoleKey;
const tables=['assistant_conversations','audit','reviews','movements','allocations','payments','orders','stock_lots','batches','purchases','bundles','customers','materials','products','profiles'];
// Preflight every table before deleting anything. Never log record contents or credentials.
for(const table of tables){const {error}=await db.from(table).select('id',{head:true,count:'exact'});if(error)throw Error(`Preflight ${table}: ${error.message}`);}
const accounts=[];
for(let page=1;;page++){const {data,error}=await db.auth.admin.listUsers({page,perPage:100});if(error)throw error;accounts.push(...data.users);if(data.users.length<100)break;}
let admin=accounts.find(user=>user.email?.toLowerCase()===input.email.toLowerCase());
const account=admin?await db.auth.admin.updateUserById(admin.id,{password:input.password,email_confirm:true}):await db.auth.admin.createUser({email:input.email,password:input.password,email_confirm:true,user_metadata:{full_name:'Kinga Admin'}});
if(account.error)throw Error(`Admin setup: ${account.error.message}`);admin=account.data.user;
for(const table of tables){const {error}=await db.from(table).delete().not('id','is',null);if(error)throw Error(`Reset stopped at ${table}: ${error.message}`);}
const {error:profileError}=await db.from('profiles').insert({id:admin.id,full_name:'Kinga Admin',role:'admin'});if(profileError)throw profileError;
for(const user of accounts){if(user.id===admin.id)continue;const {error}=await db.auth.admin.deleteUser(user.id);if(error)throw Error(`Account cleanup failed: ${error.message}`);}
for(const table of tables){const {count,error}=await db.from(table).select('id',{head:true,count:'exact'});if(error||count!==(table==='profiles'?1:0))throw Error(`Reset verification failed: ${table}`);}
const {data:remaining,error:listError}=await db.auth.admin.listUsers({page:1,perPage:100});if(listError||remaining.users.length!==1||remaining.users[0].id!==admin.id)throw Error('Admin-only verification failed.');
const entry={id:admin.id,name:'Kinga Admin',email:input.email,role:'admin',password:input.password,created_at:new Date().toISOString(),sign_in_url:'http://localhost:3000/login'};
await writeFile('.local/staff-access.json',JSON.stringify([entry],null,2)+'\n',{mode:0o600});await chmod('.local/staff-access.json',0o600);
await writeFile('.local/staff-access.md',`# Kinga admin access\n\nEmail: ${input.email}\nPassword: ${input.password}\nRole: admin\n`,{mode:0o600});await chmod('.local/staff-access.md',0o600);
await unlink('.local/demo-access.md').catch(error=>{if(error.code!=='ENOENT')throw error;});
const login=await db.auth.signInWithPassword({email:input.email,password:input.password});if(login.error)throw Error(`Admin sign-in failed: ${login.error.message}`);
await db.auth.signOut();
console.log(JSON.stringify({reset:true,business_tables_empty:true,staff_accounts:1,admin_email:input.email,admin_sign_in_verified:true}));
