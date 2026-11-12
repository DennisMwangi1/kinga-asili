/** Provision explicitly supplied staff identities. Credentials enter through stdin only. */
import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import path from 'node:path';

let raw='';for await (const chunk of process.stdin)raw+=chunk;
const input=JSON.parse(raw);raw='';
const url='https://tbxokonhjeellhfcusui.supabase.co';
if(typeof input.serviceRoleKey!=='string'||!Array.isArray(input.users)||!input.users.length)throw Error('Supply serviceRoleKey and an explicit users array through stdin.');
const roles=new Set(['admin','sales','cashier','stock_keeper']);
for(const user of input.users){
 if(typeof user.name!=='string'||user.name.trim().length<2||typeof user.email!=='string'||!/^\S+@\S+\.\S+$/.test(user.email)||!roles.has(user.role))throw Error('Every user requires a name, email and supported role.');
}
if(new Set(input.users.map(u=>u.email.trim().toLowerCase())).size!==input.users.length)throw Error('Duplicate staff email in provisioning request.');
const db=createClient(url,input.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});delete input.serviceRoleKey;
const existing=[];
for(let page=1;;page++){const {data,error}=await db.auth.admin.listUsers({page,perPage:100});if(error)throw Error(error.message);existing.push(...data.users);if(data.users.length<100)break;}
const directory=path.resolve('.local');await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
const accessFile=path.join(directory,'staff-access.json');let access=[];
try{access=JSON.parse(await readFile(accessFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const summary=[];
for(const staff of input.users){
 const email=staff.email.trim().toLowerCase();let user=existing.find(u=>u.email?.toLowerCase()===email);let created=false;
 if(!user){
  const password='Ka!'+randomBytes(24).toString('base64url');
  const result=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:staff.name.trim()}});
  if(result.error)throw Error(`Could not create ${email}: ${result.error.message}`);
  user=result.data.user;existing.push(user);created=true;
  access.push({id:user.id,name:staff.name.trim(),email,role:staff.role,password,created_at:new Date().toISOString(),sign_in_url:'http://localhost:3000/login'});
  // Save each generated password immediately; never print it to the terminal.
  await writeFile(accessFile,JSON.stringify(access,null,2)+'\n',{mode:0o600});await chmod(accessFile,0o600);
 }
 const {error}=await db.from('profiles').upsert({id:user.id,full_name:staff.name.trim(),role:staff.role},{onConflict:'id'});
 if(error)throw Error(`Auth account exists for ${email}, but profile provisioning failed: ${error.message}. Retry the same request; existing passwords are retained.`);
 summary.push({id:user.id,name:staff.name.trim(),email,role:staff.role,created,password_reset:false});
}
console.log(JSON.stringify({users:summary,credential_file:access.length?accessFile:null,invitation_emails_sent:false},null,2));
