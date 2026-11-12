export function storefrontUrl() { const origin=(process.env.NEXT_PUBLIC_STOREFRONT_URL||'http://localhost:3001').replace(/\/$/,'');return origin+'/';}
