import path from 'node:path';
import type {NextConfig} from 'next';
const config:NextConfig={
  basePath:'/shop',
  // Both shared source and dependencies live above this service's root.
  outputFileTracingRoot:path.resolve(__dirname,'..'),
};
export default config;
