/* Staff data and mutations are always network-only. Cache only the public offline page. */
const CACHE='kinga-workspace-offline-v2';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/offline.html')));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('kinga-workspace-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{
 const request=event.request;
 const path=new URL(request.url).pathname;
 // The storefront now owns /. Only staff document navigation gets an offline fallback.
 if(!(path==='/login'||path==='/dashboard'||path.startsWith('/dashboard/')))return;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 if(request.mode==='navigate')event.respondWith(fetch(request).catch(async()=>await caches.match('/offline.html')||new Response('Reconnect to open Kinga Workspace.',{status:503,headers:{'Content-Type':'text/plain'}})));
});
