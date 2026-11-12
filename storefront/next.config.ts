import path from 'node:path';
import type {NextConfig} from 'next';
const config:NextConfig={
  // Keep this app's JS/CSS separate from the staff app's /_next assets.
  assetPrefix:'/_storefront',
  async rewrites(){return [{source:'/_storefront/_next/:path*',destination:'/_next/:path*'}];},
  // Both shared source and dependencies live above this service's root.
  outputFileTracingRoot:path.resolve(__dirname,'..'),
};
export default config;
