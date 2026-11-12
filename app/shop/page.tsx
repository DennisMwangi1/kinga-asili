import {redirect} from 'next/navigation';
import {storefrontUrl} from '@/lib/urls';
export default function Page(){redirect(storefrontUrl());}
