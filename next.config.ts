import type {NextConfig} from 'next';
const config:NextConfig={async headers(){return [{source:'/sw.js',headers:[{key:'Content-Type',value:'application/javascript; charset=utf-8'},{key:'Cache-Control',value:'no-cache, no-store, must-revalidate'},{key:'Service-Worker-Allowed',value:'/'}]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store'}]}];}};
export default config;
