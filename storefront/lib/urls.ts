/** Public website and request API are mounted at the domain root. */
export function storefrontPath(path=''){return '/'+path.replace(/^\/+/, '');}
