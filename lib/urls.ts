/** Unified deployments use /shop. An explicit origin supports separate local dev servers. */
export function storefrontUrl(){
 const configured=process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim();
 if(!configured)return '/shop/';
 const base=configured.replace(/\/+$/,'');
 return (base.endsWith('/shop')?base:base+'/shop')+'/';
}
