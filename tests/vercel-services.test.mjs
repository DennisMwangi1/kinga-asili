import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadTs} from './load.mjs';
const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const {storefrontUrl}=await loadTs('../lib/urls.ts');
const {storefrontPath}=await loadTs('../storefront/lib/urls.ts');
const route=path=>config.rewrites.find(rule=>new RegExp('^'+rule.source+'$').test(path))?.destination.service;
test('the homepage and customer APIs use the storefront while staff pages, APIs and assets stay separate',()=>{
 for(const path of ['/','/api/catalogue','/api/requests','/_storefront/_next/static/chunk.js','/favicon.png'])assert.equal(route(path),'storefront',path);
 for(const path of ['/login','/dashboard','/dashboard/orders','/api/operations','/api/assistant','/api/assistant/conversations','/_next/static/chunk.js','/sw.js','/manifest.webmanifest','/icons/kinga-192.png','/images/botanical.jpg'])assert.equal(route(path),'app',path);
 assert.equal(config.rewrites.at(-1).destination.service,'storefront');
 assert.deepEqual(config.redirects,[{source:'/shop/:path*',destination:'/:path*',permanent:false}]);
});
test('independent services own their build commands and declare no unused bindings',()=>{
 assert.equal(config.services.app.root,'.');assert.equal(config.services.storefront.root,'storefront');
 for(const name of ['app','storefront']){assert.equal(config.services[name].framework,'nextjs');assert.ok(config.services[name].installCommand);assert.equal(config.services[name].buildCommand,'npm run build');assert.ok(!config.services[name].bindings?.length);}
 for(const key of ['framework','buildCommand','installCommand','functions','devCommand','ignoreCommand','outputDirectory'])assert.equal(config[key],undefined,key);
});
test('shop links use the public path and support explicit separate-server development URLs',()=>{
 const previous=process.env.NEXT_PUBLIC_STOREFRONT_URL;
 try{delete process.env.NEXT_PUBLIC_STOREFRONT_URL;assert.equal(storefrontUrl(),'/');process.env.NEXT_PUBLIC_STOREFRONT_URL='/shop';assert.equal(storefrontUrl(),'/');process.env.NEXT_PUBLIC_STOREFRONT_URL='http://localhost:3001';assert.equal(storefrontUrl(),'http://localhost:3001/');process.env.NEXT_PUBLIC_STOREFRONT_URL='https://example.test/shop/';assert.equal(storefrontUrl(),'https://example.test/');}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_STOREFRONT_URL;else process.env.NEXT_PUBLIC_STOREFRONT_URL=previous;}
 assert.equal(storefrontPath('api/catalogue'),'/api/catalogue');assert.equal(storefrontPath('/api/requests'),'/api/requests');assert.equal(storefrontPath(),'/');
});
