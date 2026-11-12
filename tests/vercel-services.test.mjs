import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadTs} from './load.mjs';
const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const {storefrontUrl}=await loadTs('../lib/urls.ts');
const {storefrontPath}=await loadTs('../storefront/lib/urls.ts');
const route=path=>config.rewrites.find(rule=>new RegExp('^'+rule.source+'$').test(path))?.destination.service;
test('shop routes, APIs and Next assets are routed to the storefront before the app catch-all',()=>{
 for(const path of ['/shop','/shop/','/shop/api/catalogue','/shop/api/requests','/shop/_next/static/chunk.js','/shop/favicon.png'])assert.equal(route(path),'storefront',path);
 for(const path of ['/','/login','/dashboard','/dashboard/orders','/api/operations','/api/assistant','/_next/static/chunk.js','/sw.js','/shopper'])assert.equal(route(path),'app',path);
 assert.equal(config.rewrites.at(-1).source,'/(.*)');
});
test('independent services own their build commands and declare no unused bindings',()=>{
 assert.equal(config.services.app.root,'.');assert.equal(config.services.storefront.root,'storefront');
 for(const name of ['app','storefront']){assert.equal(config.services[name].framework,'nextjs');assert.ok(config.services[name].installCommand);assert.equal(config.services[name].buildCommand,'npm run build');assert.ok(!config.services[name].bindings?.length);}
 for(const key of ['framework','buildCommand','installCommand','functions','devCommand','ignoreCommand','outputDirectory'])assert.equal(config[key],undefined,key);
});
test('shop links use the public path and support explicit separate-server development URLs',()=>{
 const previous=process.env.NEXT_PUBLIC_STOREFRONT_URL;
 try{delete process.env.NEXT_PUBLIC_STOREFRONT_URL;assert.equal(storefrontUrl(),'/shop/');process.env.NEXT_PUBLIC_STOREFRONT_URL='/shop';assert.equal(storefrontUrl(),'/shop/');process.env.NEXT_PUBLIC_STOREFRONT_URL='http://localhost:3001';assert.equal(storefrontUrl(),'http://localhost:3001/shop/');process.env.NEXT_PUBLIC_STOREFRONT_URL='https://example.test/shop/';assert.equal(storefrontUrl(),'https://example.test/shop/');}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_STOREFRONT_URL;else process.env.NEXT_PUBLIC_STOREFRONT_URL=previous;}
 assert.equal(storefrontPath('api/catalogue'),'/shop/api/catalogue');assert.equal(storefrontPath('/api/requests'),'/shop/api/requests');assert.equal(storefrontPath(),'/shop/');
});
