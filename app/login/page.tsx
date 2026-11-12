'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Brand from '@/components/brand';
import {InstallWorkspace} from '@/components/workspace-pwa';
import { storefrontUrl } from '@/lib/urls';
import { browserDatabase } from '@/lib/supabase';
export default function Login() { const router=useRouter(); const [error, setError] = useState(''), [busy, setBusy] = useState(false); return <main className="login"><div className="login-photo"><Brand light/><h1>Care in every blend.<br />Clarity in every day.</h1><p>Kinga Asili · Operations workspace</p></div><section><small className="eyebrow">WELCOME BACK</small><h2>A fresh start to your day.</h2><p>Sign in to your Kinga Asili workspace.</p><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); const f = new FormData(e.currentTarget); const db = browserDatabase(); if (!db) {
    setError('The Kinga database is not configured yet. Contact your administrator.');
    setBusy(false);
    return;
} const { error } = await db.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) }); if (error) {
    setError(error.message);
    setBusy(false);
}
else
    router.replace('/dashboard'); }}><label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required autoComplete="current-password"/></label>{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in →'}</button></form><a href={storefrontUrl()}>Back to the shop</a><div className="login-install"><InstallWorkspace/></div></section></main>; }
