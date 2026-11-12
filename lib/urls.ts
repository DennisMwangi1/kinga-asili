/** Same-origin storefront by default; tolerate URLs from the former /shop mount. */
export function storefrontUrl(){
 const configured=process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim();
 if(!configured||configured==='/'||configured.replace(/\/+$/,'')==='/shop')return '/';
 const base=configured.replace(/\/+$/,'').replace(/\/shop$/,'');
 return base+'/';
}
