/** Public prefix matches next.config.ts and the Vercel service rewrites. */
export function storefrontPath(path=''){return '/shop'+(path?'/'+path.replace(/^\/+/, ''):'/');}
