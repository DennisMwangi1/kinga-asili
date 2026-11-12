'use client';
import { useEffect, useState, useMemo, useCallback, useRef, Children, Fragment, isValidElement, cloneElement, type ReactNode, type FormEvent } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import Sheet from './sheet';
import {useWorkspaceToast} from './workspace-toasts';
import {workspaceError} from '@/lib/operation-errors';
import OrderDetail from './order-detail';
import WorkspaceIcon from './workspace-icon';
import { ActionFooter } from './ui/action-footer';
import { Button } from './ui/button';
import { useMobile } from '@/lib/use-mobile';
import Brand from './brand';
import KingaBot from './kinga-bot';
import MobileTabs from './mobile-tabs';
import { OrderForm } from './order-form';
import { storefrontUrl } from '@/lib/urls';
import OpeningStock from './opening-stock';
import CustomerForm from './customer-form';
import CustomerImport from './customer-import';
import {availableCreationActions,settingsSections} from '@/lib/workspace-navigation';
import {salesSeries,chartTicks} from '@/lib/sales-chart';
import QuantityLines from './quantity-lines';
import { browserDatabase } from '@/lib/supabase';
import { type Snapshot, type RecordRow, type Order, money, eatDate, navigation, weeklyMetrics, csv } from '@/lib/domain';
const reviewItems = ['Missing records checked', 'Stock and use-by alerts reviewed', 'Outstanding payments followed up', 'Wastage reviewed', 'Delivery exceptions resolved'];
function Badge({ children }: {
    children: React.ReactNode;
}) { return <span className={`badge ${['requested', 'draft', 'unpaid', 'Held'].includes(String(children)) ? 'amber' : ['cancelled', 'Expired', 'Overdue'].includes(String(children)) ? 'red' : ''}`}>{children}</span>; }
function flattenCells(children:ReactNode):ReactNode[]{return Children.toArray(children).flatMap(child=>isValidElement<{children?:ReactNode}>(child)&&child.type===Fragment?flattenCells(child.props.children):[child]);}
function nodeText(node: ReactNode): string {
    return Children.toArray(node).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{children?: ReactNode}>(child) ? nodeText(child.props.children) : '').join(' ').trim();
}
function rowActions(node: ReactNode): ReactNode[] {
    return Children.toArray(node).flatMap(child => !isValidElement<{children?: ReactNode}>(child) ? [] : child.type === 'button' || child.type === 'a' ? [child] : rowActions(child.props.children));
}
function withoutActions(node: ReactNode): ReactNode {
    return Children.map(node, child => !isValidElement<{children?: ReactNode}>(child) ? child : child.type === 'button' || child.type === 'a' ? null : cloneElement(child, {}, withoutActions(child.props.children)));
}
function Table({heads,children,desktopDetails=false,detailActions}:{heads:string[];children:ReactNode;desktopDetails?:boolean;detailActions?:(index:number)=>ReactNode}) {
    const mobile = useMobile();
    const [selected, setSelected] = useState<number | null>(null);
    const [open, setOpen] = useState(false);
    const [pendingAction,setPendingAction]=useState<(()=>void)|null>(null);
    const rows = Children.toArray(children).filter(isValidElement<{children?:ReactNode}>);
    const cellsOf = (row: typeof rows[number]) => flattenCells(row.props.children).filter(isValidElement<{children?:ReactNode;colSpan?:number}>);
    const current = selected === null ? [] : rows[selected] ? cellsOf(rows[selected]) : [];
    const actions = [...current.flatMap(cell => rowActions(cell.props.children)),...Children.toArray(selected===null?null:detailActions?.(selected))];
    const first = current[0]?.props.children;
    const primary = (node:ReactNode) => {
        const strong = Children.toArray(node).find(child => isValidElement(child) && child.type === 'strong');
        return nodeText(strong || node).slice(0,100);
    };
    return <>{mobile ? <>
      <div className="mobile-record-list">{rows.map((row,index) => {
        const cells = cellsOf(row);
        if (cells.length === 1 && cells[0].props.colSpan) return <p className="empty-records" key={row.key || index}>{cells[0].props.children}</p>;
        const summaries = cells.map((cell,i)=>({cell,i})).filter(({cell,i})=>i>0 && nodeText(withoutActions(cell.props.children))).slice(0,3);
        return <button type="button" className="mobile-unified-record" key={row.key || index} onClick={()=>{setSelected(index);setOpen(true);}}>
          <div className="record-card-title"><div>{withoutActions(cells[0]?.props.children)}</div><span aria-hidden="true">→</span></div>
          <div className="record-card-summary">{summaries.map(({cell,i})=><div key={i}><span>{heads[i].split(' / ')[0]}</span><div>{withoutActions(cell.props.children)}</div></div>)}</div>
        </button>;
      })}</div>
    </> : <div className="table-wrap"><table className="responsive-table"><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{desktopDetails?rows.map((row,index)=><tr key={row.key||index} className="clickable-order-row" tabIndex={0} aria-label={`Open ${primary(cellsOf(row)[0]?.props.children)} details`} onClick={()=>{setSelected(index);setOpen(true);}} onKeyDown={event=>{if(event.target!==event.currentTarget||!['Enter',' '].includes(event.key))return;event.preventDefault();setSelected(index);setOpen(true);}}>{row.props.children}</tr>):children}</tbody></table></div>}
      <Sheet open={open} title={primary(first)||'Record details'} onClose={()=>setOpen(false)} onOpenChangeComplete={next=>{if(!next){setSelected(null);setPendingAction(null);pendingAction?.();}}} footer={actions.length ? <ActionFooter>{actions.map((action,index)=>isValidElement<{onClick?:(event:React.MouseEvent)=>void}>(action)?cloneElement(action,{key:index,onClick:event=>{setPendingAction(()=>()=>action.props.onClick?.(event));setOpen(false);}}):action)}</ActionFooter> : undefined}>
        <dl className="record-detail-fields">{current.map((cell,i)=>nodeText(withoutActions(cell.props.children)) ? <div key={i}><dt>{heads[i]}</dt><dd>{withoutActions(cell.props.children)}</dd></div> : null)}</dl>
      </Sheet>
    </>;
}
function Field({ label, name, type = 'text', value, required = true, min, step }: {
    label: string;
    name: string;
    type?: string;
    value?: string | number;
    required?: boolean;
    min?: number;
    step?: string;
}) { return <label>{label}<input name={name} type={type} defaultValue={value} required={required} min={min} step={step}/></label>; }
function Select({ label, name, options, value, disabled=false }: {
    label: string;
    name: string;
    disabled?: boolean;
    options: {
        id: string;
        name: string;
    }[];
    value?: string;
}) { return <label>{label}<select name={name} defaultValue={value} required disabled={disabled}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>; }
const shortDate = (s: string) => s ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' }).format(new Date(s.length === 10 ? s + 'T12:00:00+03:00' : s)) : 'Missing';
function exportRows(rows: Record<string, unknown>[], name: string) { const u = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = u; a.download = `kinga-asili-${name}.csv`; a.click(); URL.revokeObjectURL(u); }
export default function Operations({ assistantRoles = ['admin'] }: {
    assistantRoles?: string[];
}) {
    const queryClient = useQueryClient();
    const {add:notify,close:closeToast}=useWorkspaceToast();
    const loaded=useRef(false);
    const path = usePathname(), router = useRouter(), mobile = useMobile(), base = '/dashboard';
    const page = path.split('/')[2] || 'overview';
    const tab = path.split('/')[3] || 'finished';
    const setTab = (value:string) => router.push('/dashboard/inventory/'+value);
    const settingsSection=path.split('/')[3]||'';
    const isNew = page === 'orders' && path.endsWith('/new');
    const newOrderSheet = isNew && mobile;
    const [data, setData] = useState<Snapshot | null>(null), [loadError, setLoadError] = useState(''), [busy, setBusy] = useState(false), [modal, setModalRecord] = useState<{
        kind: string;
        row?: RecordRow;
    } | null>(null), [filter, setFilter] = useState(''), [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return eatDate(d); }), [to, setTo] = useState(eatDate()), [checks, setChecks] = useState<string[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [purchaseKind,setPurchaseKind]=useState('purchase');
    const [purchaseMethod,setPurchaseMethod]=useState('Cash');
    const purchaseKey=useRef('');
    const batchKey=useRef('');
    const setModal = useCallback((value: {kind: string; row?: RecordRow} | null) => {
        if (value) { if(value.kind==='batch')batchKey.current=crypto.randomUUID();if(value.kind==='purchase'){setPurchaseKind(String(value.row?.kind||'purchase'));setPurchaseMethod('Cash');purchaseKey.current=crypto.randomUUID();} setModalRecord(value); setModalOpen(true); }
        else setModalOpen(false);
    }, []);
    const closeDialog = useCallback(() => setModalOpen(false), []);
    const db = useMemo(() => browserDatabase(), []);
    const getToken=useCallback(async()=>{const result=await db?.auth.getSession();return result?.data.session?.access_token;},[db]);
    const load = useCallback(async () => { try {
        if (!db)
            throw Error('Kinga database is not configured. Contact your administrator to complete setup.');
        const { data: { session } } = await db.auth.getSession();
        if (!session) {
            router.replace('/login');
            return;
        }
        const s = await queryClient.fetchQuery({
            queryKey: ['kinga-workspace', session.user.id],
            staleTime: 0,
            queryFn: async () => {
                const r = await fetch('/api/operations', { headers: { Authorization: `Bearer ${session.access_token}` } });
                const snapshot = await r.json();
                if (!r.ok) throw Error(snapshot.error);
                return snapshot as Snapshot;
            },
        });
        loaded.current=true;setLoadError('');closeToast('workspace-refresh-error');
        setData(s);
    }
    catch (e) {
        if(!loaded.current)setLoadError(workspaceError(e));
        else notify({id:'workspace-refresh-error',title:'Workspace could not refresh',description:workspaceError(e),type:'error',priority:'high',timeout:7000,data:{pathname:window.location.pathname}});
    } }, [db,router,queryClient,notify,closeToast]);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        if (path !== '/dashboard' || !data || data.role === 'admin') return;
        router.replace(data.role === 'stock_keeper' ? '/dashboard/inventory' : data.role === 'driver' ? '/dashboard/deliveries' : '/dashboard/orders');
    }, [path, data, router]);
    useEffect(()=>{if(page==='deliveries')router.replace('/dashboard/orders');},[page,router]);
    // Refresh live records when returning to the app, without blanking the shell.
    useEffect(() => {
        const refresh = () => { if (document.visibilityState === 'visible') void load(); };
        document.addEventListener('visibilitychange', refresh);
        const timer=window.setInterval(refresh,15000);
        return () => {window.clearInterval(timer);document.removeEventListener('visibilitychange', refresh);};
    }, [load]);
    async function act(action: string, d: Record<string, unknown>) { if(!navigator.onLine){notify({id:'workspace-operation-error',title:'Change not saved',description:'Reconnect before saving. Your form has not been submitted.',type:'error',priority:'high',timeout:7000,data:{pathname:path}});return false;}setBusy(true);closeToast('workspace-operation-error'); try {
            const { data: { session } } = await db!.auth.getSession();
            const r = await fetch('/api/operations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ action, data: d }) });
            const result = await r.json();
            if (!r.ok)
                throw Error(result.error);
            await load();
        setModal(null);
        const savedBatch=action==='save_batch'&&session?queryClient.getQueryData<Snapshot>(['kinga-workspace',session.user.id])?.batches.find(batch=>batch.id===result.result):undefined;
        notify({title:savedBatch?`Batch ${savedBatch.reference} saved`:'Saved successfully',type:'success',priority:'low'});
        return true;
    }
    catch (e) {
        notify({id:'workspace-operation-error',title:'Change not saved',description:workspaceError(e),type:'error',priority:'high',timeout:7000,data:{pathname:path}});
        return false;
    }
    finally {
        setBusy(false);
    } }
    const link = (url: string) => url.replace('/dashboard', base);
    if (!data)
        return <main className="setup"><Brand /><h1>{loadError ? 'Your workspace is waiting.' : 'Opening your workspace…'}</h1>{loadError && <><p role="alert">{loadError}</p><Link href="/login">Staff sign in</Link></>}</main>;
    const s = data;
    const allowed = navigation.find(n => n[1].split('/')[2] === page || page === 'overview' && n[0] === 'Overview');
    const permitted = !!allowed && (allowed[3] as readonly string[]).includes(s.role);
    const title = page==='settings' && settingsSection ? settingsSections.find(item=>item.href.endsWith('/'+settingsSection))?.label || 'Settings' : isNew && !newOrderSheet ? 'Create an order' : allowed?.[0] || 'Page not found';
    const m = weeklyMetrics(s, from, to);
    const today = eatDate();
    const low = s.products.filter(p => p.available < 20);
    const nearing = s.lots.filter(l => !l.held && Number(l.quantity) > Number(l.reserved) && String(l.use_by) >= today && String(l.use_by) <= eatDate(new Date(Date.now() + 3 * 86400000)));
    const exceptions = s.orders.filter(o => o.exception_reason || o.delivery_date < today && !['delivered', 'cancelled'].includes(o.status));
    const filterMatch = (o: unknown) => JSON.stringify(o).toLowerCase().includes(filter.toLowerCase());
    const productName = (id: string) => { const p = s.products.find(p => p.id === id); return p ? `${p.blend} · ${p.volume_ml} ml` : id; };
    async function submitModal(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const d = Object.fromEntries(f.entries()) as Record<string, unknown>;
        const kind = modal!.kind;
        for (const k of ['quantity', 'amount', 'price', 'threshold', 'wastage', 'free_quantity', 'delivery_fee'])
            if (k in d)
                d[k] = Number(d[k]);
        if (modal!.row)
            d.id = modal!.row.id;
        if (kind === 'batch') {
            d.idempotency_key=batchKey.current;
            d.outputs = JSON.parse(String(d.outputs_json));
            d.inputs = JSON.parse(String(d.inputs_json));
            delete d.outputs_json;
            delete d.inputs_json;
            await act('save_batch', d);
        }
        if (kind === 'purchase') {
            d.idempotency_key=purchaseKey.current;
            d.lines = d.kind === 'purchase' ? JSON.parse(String(d.inputs_json)) : [];
            delete d.inputs_json;
            await act('save_purchase', d);
        }
        if (kind === 'material')
            await act('save_material', d);
        if (kind === 'payment') {
            d.order_id = modal!.row!.id;
            delete d.id;
            await act('record_payment', d);
        }
        if (kind === 'delivery')
            await act('update_delivery', d);
        if (kind === 'product') {
            d.price_confirmed = d.price_confirmed === 'on';
            d.active = d.active === 'on';
            d.volume_ml = Number(d.volume_ml || modal?.row?.volume_ml);
            await act('save_product', d);
        }
        if (kind === 'bundle') {
            d.active = d.active === 'on';
            await act('save_bundle', d);
        }
        if (kind === 'opening')
            await act('opening_stock', d);
        if (kind === 'materialAdjust')
            await act('adjust_material', d);
        if (kind === 'adjust')
            await act('adjust_stock', d);
        if (kind === 'hold') {
            d.held = !modal!.row!.held;
            await act('hold_lot', d);
        }
    }
    const orderActions = (o: Order) => <div className="row-actions">{o.status === 'requested' && s.role !== 'driver' && <button disabled={busy} onClick={() => act('transition_order', { id: o.id, status: 'confirmed' })}>Confirm & reserve</button>}{o.status === 'confirmed' && s.role !== 'driver' && <button disabled={busy} onClick={() => act('transition_order', { id: o.id, status: 'packed' })}>Mark packed</button>}{o.status === 'packed' && <button disabled={busy} onClick={() => act('transition_order', { id: o.id, status: 'dispatched' })}>Hand to ride-share</button>}{o.status === 'dispatched' && <button disabled={busy} onClick={() => act('transition_order', { id: o.id, status: 'delivered' })}>Mark delivered</button>}{['admin', 'cashier'].includes(s.role) && !['requested', 'cancelled'].includes(o.status) && o.paid < o.total && <button onClick={() => setModal({ kind: 'payment', row: o as unknown as RecordRow })}>Payment</button>}{['requested', 'confirmed', 'packed'].includes(o.status) && s.role !== 'driver' && <button className="danger-text" disabled={busy} onClick={() => act('transition_order', { id: o.id, status: 'cancelled' })}>Cancel</button>}</div>;
    const orderRows = (orders: Order[], compact = false) => mobile ? <div className="mobile-record-list">{orders.length ? orders.map(o => <button type="button" className="mobile-order-record" key={o.id} onClick={() => setModal({kind:'order',row:o as unknown as RecordRow})}><span className="mobile-record-top"><strong>{o.customer_name}</strong><b>{money(o.total)}</b></span><span className="mobile-record-meta">{o.reference}{o.source==='web'&&' · Website request'} · {o.lines.reduce((sum,l)=>sum+l.quantity,0)} bottles</span><span className="mobile-record-bottom"><Badge>{o.status}</Badge><span>{shortDate(o.delivery_date)} <i aria-hidden="true">→</i></span></span></button>) : <p>No matching orders.</p>}</div> : <Table heads={compact ? ['Order / customer', 'Blend', 'Total', 'Status'] : ['Order / customer', 'Delivery', 'Total / balance', 'Status', 'Actions']}>{orders.length ? orders.map(o => <tr key={o.id} className="clickable-order-row" tabIndex={0} aria-label={`Open order ${o.reference} for ${o.customer_name}`} onClick={event=>{if((event.target as Element).closest('button,a,input,select,textarea,[role="button"]'))return;setModal({kind:'order',row:o as unknown as RecordRow});}} onKeyDown={event=>{if(event.target!==event.currentTarget||!['Enter',' '].includes(event.key))return;event.preventDefault();setModal({kind:'order',row:o as unknown as RecordRow});}}><td><button className="text-button" tabIndex={-1} onClick={() => setModal({ kind: 'order', row: o as unknown as RecordRow })}>{o.reference}</button><small>{o.customer_name}{o.source==='web'&&' · Website request'}</small></td>{compact ? <><td>{o.lines.map(l => `${l.quantity} × ${productName(l.product_id)}`).join(', ')}</td><td>{money(o.total)}</td><td><Badge>{o.status}</Badge></td></> : <><td>{shortDate(o.delivery_date)}<small>{o.location || 'Location missing'}</small></td><td>{money(o.total)}<small>{o.status === 'requested' ? 'Estimate · awaiting confirmation' : `${money(o.total - o.paid)} outstanding`}</small></td><td><Badge>{o.status}</Badge></td><td>{orderActions(o)}</td></>}</tr>) : <tr><td colSpan={5}>No matching orders.</td></tr>}</Table>;
    return <div className="workspace">
<MobileTabs onCreate={id=>{if(!availableCreationActions(s.role).some(action=>action.id===id))return;if(id==='order'){router.push('/dashboard/orders/new');return;}setModal(id==='expense'?{kind:'purchase',row:{kind:'expense'}}:{kind:id});}} role={s.role} name={s.name} onSignOut={async()=>{await db?.auth.signOut();queryClient.clear();router.replace('/login');}}/>{assistantRoles.includes(s.role)&&<KingaBot snapshot={s} getToken={getToken} onSaved={load}/>}<aside className="sidebar"><Link href={base}><Brand light/></Link><span className="sidebar-label">YOUR WORKSPACE</span><nav>{navigation.filter(n => (n[3] as readonly string[]).includes(s.role)).map(([label, url]) => <Link className={link(url) === (page === 'overview' ? base : base + '/' + page) ? 'active' : ''} key={url} href={link(url)}><span><WorkspaceIcon name={label}/></span>{label}{label === 'Orders' && <i>{s.orders.filter(o => o.status === 'requested').length}</i>}</Link>)}</nav><div className="sidebar-foot"><div className="care-note">Rooted in nature.<br /><em>Made with care.</em><span>✳</span></div><a href={storefrontUrl()}>Visit the shop ↗</a><button onClick={async () => { await db?.auth.signOut(); queryClient.clear(); router.replace('/login'); }}>Sign out</button></div></aside><div className="workspace-main"><header className="topbar"><Link className="mobile-brand" href="/dashboard"><Brand/></Link><span className="desktop-breadcrumb">Operations <b>/ {title}</b></span><div><span className="top-date">{shortDate(today)}, {today.slice(0, 4)}</span><span className="avatar">KA</span><span>{s.name}<small>{s.role === 'admin' ? 'Owner workspace' : s.role.replace('_', ' ')}</small></span></div></header><main className="content"><div className="page-heading"><div><span className="eyebrow">KINGA ASILI / {page === 'overview' ? 'YOUR DAILY PICTURE' : page.replaceAll('-', ' ')}</span><h1>{page === 'overview' ? 'A little clarity. A better day.' : title}</h1><p>{page === 'overview' ? 'The numbers that matter. The details that need your care.' : page === 'production' ? 'From fresh ingredients to every finished bottle.' : page === 'inventory' ? 'Know what is on hand, reserved and ready to go.' : page === 'orders' ? 'Every blend, every customer, every step.' : 'Thoughtful records for a business that grows with care.'}</p></div>{!isNew && ['overview', 'orders'].includes(page) && permitted && <Link className="primary page-create-action" href={base + '/orders/new'}>＋ New order</Link>}{page === 'production' && permitted && <button className="primary page-create-action" onClick={() => setModal({ kind: 'batch' })}>＋ Record a batch</button>}{page === 'purchases' && permitted && <button className="primary page-create-action" onClick={() => setModal({ kind: 'purchase' })}>＋ Purchase / expense</button>}{page === 'customers' && permitted && <button className="primary page-create-action" onClick={() => setModal({ kind: 'customer' })}>＋ Add customer</button>}</div>
 {!permitted ? <section className="panel"><h2>This page is outside your role.</h2><p>Your workspace menu shows the records available to you.</p></section> : isNew && !newOrderSheet ? <OrderForm products={s.products} customers={s.customers} bundles={s.bundles} busy={busy} onSave={async (d) => { if (await act('save_order', d))
            router.push(base + '/orders'); }}/> : page === 'overview' ? <>
 <div className="period"><span className="live-dot"/> Weekly overview <div><input aria-label="Period start" type="date" value={from} onChange={e => setFrom(e.target.value)}/><span>—</span><input aria-label="Period end" type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></div><Link href={base + '/reports'}>Open weekly review ↗</Link></div>
 <div className="stats">{[['Confirmed sales', money(m.sales), 'orders', 'Excludes requests and cancellations'], ['Cash collected', money(m.collected), 'orders', 'Payments received in this period'], ['Outstanding balance', money(m.outstanding), 'orders', 'Across all confirmed orders'], ['Bottles produced', String(m.production), 'production', 'Verified production this period']].map(([label, value, url, caption], i) => <Link className={'stat stat-' + i} key={label} href={base + '/' + url}><span>{label}<i>{['↗', '↙', '◷', '◉'][i]}</i></span><strong>{value}</strong><small>{caption}</small></Link>)}</div>
 <div className="overview-grid"><section className="panel chart-panel"><div className="section-title"><div><span className="eyebrow">A HEALTHY RHYTHM</span><h2>Sales through the week</h2></div><Badge>Confirmed sales · KES</Badge></div><SalesChart orders={s.orders} from={from} to={to}/><div className="chart-footer"><span><i className="legend-dot"/> Confirmed order value</span><strong>{m.bottles} bottles ordered</strong></div></section><section className="panel attention"><div className="section-title"><h2>A little attention</h2><span className="count">{low.length + exceptions.length + s.batches.filter(b => b.status === 'draft').length + nearing.length}</span></div><p>Small actions to keep things flowing.</p>{[[`${low.length} products running low`, 'Check stock before confirming orders.', 'inventory', 'amber'], [`${nearing.length} batches nearing use-by`, 'Review staff-approved dates.', 'inventory', 'amber'], [`${s.batches.filter(b => b.status === 'draft').length} batches to verify`, 'Check quantities and references.', 'production', 'green'], [`${exceptions.length} delivery exceptions`, 'Follow up with the ride-share service.', 'orders', 'red']].map(([label, note, url, tone]) => <Link href={base + '/' + url} className="attention-item" key={label}><span className={'alert-icon ' + tone}>!</span><span><strong>{label}</strong><small>{note}</small></span><b>↗</b></Link>)}</section></div>
 <div className="overview-bottom"><section className="panel"><div className="section-title"><h2>Orders in motion</h2><Link href={base + '/orders'}>View all orders →</Link></div>{orderRows(s.orders.filter(o => !['cancelled', 'delivered'].includes(o.status)).slice(0, 4), true)}</section><section className="blend-note"><span className="eyebrow">THE EVERYDAY BLENDS</span><h2>Good things,<br />bottled with care.</h2><p>Two thoughtful blends.<br />One shared standard.</p><div className="mini-products"><img src="/images/glt.jpg" alt="Kinga Asili lemon blend"/><img src="/images/got.jpg" alt="Kinga Asili orange blend"/></div><Link href={base + '/inventory'}>Explore your stock ↗</Link></section></div></> : page === 'orders' ? <section className="panel"><div className="section-title"><h2>All orders <span className="muted">{s.orders.length}</span></h2><input className="search" placeholder="Search customer, reference or status…" aria-label="Search orders" value={filter} onChange={e => setFilter(e.target.value)}/><button onClick={() => exportRows(s.orders.filter(filterMatch) as unknown as Record<string, unknown>[], 'orders')}>Export CSV ↓</button></div>{orderRows(s.orders.filter(filterMatch))}</section> : page === 'production' ? <><div className="info-strip">Use-by dates are entered from approved product controls. This system never calculates shelf life.</div><section className="panel"><div className="section-title"><h2>Production batches</h2><Badge>{s.batches.filter(b => b.status === 'draft').length} awaiting verification</Badge></div><Table heads={['Batch / blend', 'Production / approved use-by', 'Output / wastage', 'Status', 'Verification']}>{s.batches.map(b => <tr key={b.id}><td><strong>{b.reference}</strong><small>{b.blend}</small></td><td>{shortDate(b.production_date)}<small>Use by {shortDate(b.use_by)}</small></td><td>{b.outputs.reduce((n, o) => n + o.quantity, 0)} bottles<small>{b.wastage} wasted · {b.notes || 'No notes'}</small></td><td><Badge>{b.status}</Badge></td><td>{b.status === 'draft' ? <button disabled={busy} onClick={() => act('post_batch', { id: b.id })}>Verify & post</button> : <span className="muted">Posted · audit retained</span>}</td></tr>)}</Table></section></> : page === 'inventory' ? <><div className="inventory-summary"><div><span className="eyebrow">READY FOR EVERYDAY CARE</span><h2>{s.products.reduce((n, p) => n + p.available, 0)} <small>bottles available</small></h2><p>Sellable quantities exclude reservations, held and expired batches.</p><p className="stock-breakdown">{s.lots.reduce((sum,lot)=>sum+Number(lot.quantity),0)} bottles on hand · {s.lots.reduce((sum,lot)=>sum+Number(lot.reserved),0)} reserved · {s.lots.filter(lot=>lot.held).length} batches on hold</p></div><Link href={base + '/production'} className="secondary">View production →</Link></div>{s.role === 'admin' && <button className="secondary opening-button" onClick={() => setModal({ kind: 'opening' })}>＋ Reconcile opening stock</button>}<div className="tabs">{[['finished', 'Finished bottles'], ['ingredient', 'Ingredients'], ['packaging', 'Packaging'], ['lots', 'Batch stock'], ['movements', 'Movement history']].map(([v, label]) => <button className={tab === v ? 'selected' : ''} key={v} onClick={() => setTab(v)}>{label}</button>)}</div><section className="panel">{tab === 'finished' ? <><div className="section-title"><h2>Your blends, on hand</h2><button onClick={() => exportRows(s.products as unknown as Record<string, unknown>[], 'bottles')}>Export CSV ↓</button></div><Table heads={['Blend', 'Size', 'Available', 'Stock level', 'Retail price']}>{s.products.map(p => <tr key={p.id}><td><div className="product-cell"><img src={p.image} alt=""/><span><strong>{p.blend}</strong><small>{p.name}</small></span></div></td><td>{p.volume_ml} ml</td><td><strong>{p.available}</strong> bottles</td><td><Badge>{p.available < 20 ? 'Low stock' : 'Available'}</Badge></td><td>{money(p.price)}{!p.price_confirmed && <small>Indicative · confirm in Settings</small>}</td></tr>)}</Table></> : tab === 'lots' ? <><h2>Stock by production batch</h2><p>Bottles from the same production batch share one approved use-by date.</p><Table heads={['Batch', 'Product', 'Approved use-by', 'On hand / reserved', 'Control']}>{s.lots.map(l => <tr key={String(l.id)}><td>{String(l.batch_reference)}</td><td>{productName(String(l.product_id))}</td><td>{shortDate(String(l.use_by))}<small><Badge>{String(l.use_by) < today ? 'Expired' : l.held ? 'Held' : 'Available'}</Badge></small></td><td>{Number(l.quantity)} / {Number(l.reserved)}</td><td>{['admin', 'stock_keeper'].includes(s.role) && <><button onClick={() => setModal({ kind: 'hold', row: l })}>{l.held ? 'Release hold' : 'Hold batch stock'}</button><button onClick={() => setModal({ kind: 'adjust', row: l })}>Correct / waste</button></>}</td></tr>)}</Table></> : tab === 'movements' ? <><h2>Movement history</h2><DataTable rows={s.movements} columns={['item', 'quantity', 'reason', 'reference', 'created_at']}/></> : <><div className="section-title"><h2>{tab === 'ingredient' ? 'Fresh ingredients' : 'Packaging supplies'}</h2>{['admin', 'stock_keeper'].includes(s.role) && <button onClick={() => setModal({ kind: 'material' })}>＋ Add material</button>}</div><Table heads={['Material', 'On hand', 'Reorder level', 'Status', 'Correction']}>{s.materials.filter(m => m.kind === tab).map(m => <tr key={String(m.id)}><td><strong>{String(m.name)}</strong></td><td>{Number(m.quantity)} {String(m.unit)}</td><td>{Number(m.threshold)} {String(m.unit)}</td><td><Badge>{Number(m.quantity) < Number(m.threshold) ? 'Low stock' : 'Available'}</Badge></td><td>{['admin', 'stock_keeper'].includes(s.role) && <button onClick={() => setModal({ kind: 'materialAdjust', row: m })}>Correct / waste</button>}</td></tr>)}</Table></>}</section></> : page === 'purchases' ? <section className="panel"><div className="section-title"><h2>Purchases & expenses</h2><button onClick={() => exportRows(s.purchases, 'purchases')}>Export CSV ↓</button></div><Table heads={['Supplier / item', 'Date', 'Type', 'Payment', 'Amount', 'Status / action']}>{s.purchases.map(p => <tr key={String(p.id)}><td><strong>{String(p.supplier || 'Expense')}</strong><small>{String(p.description)}</small></td><td>{shortDate(String(p.date))}</td><td>{String(p.kind)}</td><td>{String(p.payment_method||'Not recorded')}<small>{String(p.reference||(p.payment_method==='Cash'?'No receipt reference':'Reference not recorded'))}</small></td><td>{money(Number(p.amount))}</td><td><Badge>{String(p.status)}</Badge>{p.status === 'draft' && <button disabled={busy} onClick={() => act('post_purchase', { id: p.id })}>Verify & post</button>}</td></tr>)}</Table></section> : page === 'customers' ? <section className="panel"><div className="section-title"><h2>Your customer relationships</h2>{s.role === 'admin' && <CustomerImport busy={busy} onImport={rows=>act('import_customers',{rows})}/>}<input placeholder="Search customers…" aria-label="Search customers" value={filter} onChange={e => setFilter(e.target.value)}/></div><Table desktopDetails detailActions={index=><button onClick={()=>setModal({kind:'customer',row:s.customers.filter(filterMatch)[index]})}>Edit customer</button>} heads={['Customer', 'Phone / location', 'Purchase history', 'Marketing', 'Notes']}>{s.customers.filter(filterMatch).map(c => <tr key={String(c.id)}><td>{String(c.name)}</td><td>{/^(?:254|0)[17]\d{8}$/.test(String(c.phone)) ? String(c.phone) : 'Phone not added'}<small>{String(c.location || 'Location missing')}</small></td><td>{s.orders.filter(o => (o.customer_id === c.id || o.phone === c.phone) && !['requested', 'cancelled'].includes(o.status)).length} confirmed orders</td><td>{c.marketing_opt_out ? 'Opted out' : 'Consented'}</td><td>{String(c.notes || '—')}</td></tr>)}</Table></section> : page === 'reports' ? <><div className="period"><strong>Weekly owner review</strong><input aria-label="Review start" type="date" value={from} onChange={e => setFrom(e.target.value)}/><input aria-label="Review end" type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/><button onClick={() => exportRows(s.orders.filter(o => o.created_at.slice(0, 10) >= from && o.created_at.slice(0, 10) <= to) as unknown as Record<string, unknown>[], 'weekly-orders')}>Export period orders ↓</button></div><div className="stats">{[['Sales', money(m.sales)], ['Collected', money(m.collected)], ['Expenses', money(m.expenses)], ['Wastage', `${m.wastage} bottles`]].map(([l, v]) => <Link href={base + (l === 'Expenses' ? '/purchases' : l === 'Wastage' ? '/production' : '/orders')} className="stat" key={l}><span>{l}</span><strong>{v}</strong><small>Open source records →</small></Link>)}</div><div className="overview-grid"><section className="panel"><h2>Close the week with care.</h2><p>Review source records, then sign off on each check.</p>{reviewItems.map(c => <label className="check" key={c}><input type="checkbox" checked={checks.includes(c)} onChange={e => setChecks(e.target.checked ? [...checks, c] : checks.filter(v => v !== c))}/>{c}</label>)}<button className="primary" disabled={checks.length !== reviewItems.length || busy || from > to} onClick={() => act('save_review', { from, to, checks })}>Complete weekly review</button></section><section className="panel"><h2>Review history</h2><DataTable rows={s.reviews} columns={['from', 'to', 'reviewer', 'created_at']}/><h3>Sales by blend and size</h3>{s.products.map(p => { const count = s.orders.filter(o => !['requested', 'cancelled'].includes(o.status) && o.created_at.slice(0, 10) >= from && o.created_at.slice(0, 10) <= to).flatMap(o => o.lines).filter(l => l.product_id === p.id).reduce((a, l) => a + l.quantity, 0); return <div className="report-row" key={p.id}><span>{p.blend} · {p.volume_ml} ml</span><strong>{count} bottles</strong></div>; })}</section></div></> : page === 'settings' ? <>{!settingsSection?<section className="panel"><h2>Manage your workspace</h2><p>Choose a section. On mobile, tap Settings in the bottom bar to switch sections.</p><nav className="settings-grid" aria-label="Settings sections">{settingsSections.map(item=><Link href={item.href} key={item.href}><WorkspaceIcon name={item.icon}/><strong>{item.label}</strong><span aria-hidden="true">→</span></Link>)}</nav></section>:<nav className="settings-subnav tabs" aria-label="Settings sections">{settingsSections.map(item=><Link key={item.href} href={item.href} aria-current={path===item.href?'page':undefined} className={path===item.href?'selected':''}>{item.label}</Link>)}</nav>}{settingsSection==='catalogue'&&(<section className="panel"><div className="section-title"><h2>Storefront catalogue</h2><button className="primary" onClick={() => setModal({kind:'product'})}>＋ Add product</button></div><p>Active products appear on the storefront. Save changes here to update names, photos, prices and bottle options.</p><Table heads={['Variant', 'Retail price', 'Storefront', 'Approval', 'Action']}>{s.products.map(p => <tr key={p.id}><td><strong>{p.name}</strong><small>{productName(p.id)}</small></td><td>{money(p.price)}</td><td><Badge>{p.active===false?'Hidden':'Published'}</Badge></td><td><Badge>{p.price_confirmed ? 'Confirmed' : 'Indicative'}</Badge></td><td><button onClick={() => setModal({ kind: 'product', row: p as unknown as RecordRow })}>Edit / confirm</button></td></tr>)}</Table></section>)}{settingsSection==='bundles'&&(<section className="panel"><div className="section-title"><h2>Configurable bundles</h2><button onClick={() => setModal({ kind: 'bundle' })}>＋ Add bundle</button></div><DataTable rows={s.bundles} columns={['name', 'quantity', 'free_quantity', 'price', 'active']}/><p>Bundle quantity includes free bottles. Physical stock is reserved for every bottle.</p></section>)}{settingsSection==='staff'&&(<section className="panel"><h2>Staff access</h2><DataTable rows={s.profiles} columns={['full_name', 'role']}/><p>Accounts are provisioned through Supabase Auth. Only the owner can grant roles.</p></section>)}{settingsSection==='audit'&&(<section className="panel"><h2>Audit trail</h2><DataTable rows={s.audit.slice(0, 50)} columns={['action', 'actor', 'created_at']}/></section>)}{settingsSection==='connections'&&(<section className="panel"><h2>Connections</h2><div className="connection-row"><strong>Database</strong><Badge>Connected</Badge></div><div className="connection-row"><strong>WhatsApp automation</strong><Badge>Not configured</Badge></div><div className="connection-row"><strong>Online payment collection</strong><Badge>Disabled</Badge></div><p>Staff confirm order requests and record payments. Automated sending requires approved credentials and templates.</p></section>)}</> : null}
 <footer className="page-footer"><span>KINGA ASILI <b>·</b> Thoughtful care, every day.</span><span>KES · Africa/Nairobi</span></footer></main></div>
 <Sheet open={newOrderSheet && permitted} title="New order" busy={busy} onClose={() => router.replace(base + '/orders')}><OrderForm products={s.products} customers={s.customers} bundles={s.bundles} busy={busy} onSave={async d => { if (await act('save_order', d)) router.replace(base + '/orders'); }}/></Sheet>
 <Sheet open={modalOpen && !!modal} onOpenChangeComplete={open => { if (!open) setModalRecord(null); }} title={modal ? ({ batch: 'Record a production batch', purchase: 'Purchase or expense', material: 'Add a material', customer: modal.row ? 'Edit customer' : 'Add a customer', payment: 'Record a payment', delivery: 'Delivery details', product: modal.row ? 'Edit product' : 'Add product', bundle: 'Create a bundle', order: String(modal.row?.reference), adjust: 'Stock correction / wastage', hold: 'Batch stock hold / release', editOrder: 'Edit customer request', opening: 'Reconcile opening stock', materialAdjust: 'Material correction / wastage' } as Record<string, string>)[modal.kind] : 'Record details'} onClose={closeDialog} busy={busy} footer={modal ? (modal.kind === 'order' ? <ActionFooter>{orderActions(modal.row as unknown as Order)}</ActionFooter> : modal.kind !== 'editOrder' ? <ActionFooter><Button variant="secondary" disabled={busy} onClick={closeDialog}>Close</Button><Button type="submit" form="workspace-record-form" busy={busy}>{busy ? 'Saving…' : modal.kind === 'batch' || modal.kind === 'purchase' ? 'Save draft for verification' : 'Save record'}</Button></ActionFooter> : undefined) : undefined}>{modal && <>{modal.kind === 'customer' ? <CustomerForm key={String(modal.row?.id||'new')} initial={modal.row} busy={busy} formId="workspace-record-form" onSave={d=>act(modal.row?'update_customer':'save_customer',d)}/> : modal.kind === 'editOrder' ? <OrderForm initial={modal.row as unknown as Order} products={s.products} customers={s.customers} bundles={s.bundles} busy={busy} onSave={async (d) => { await act('update_request', { ...d, id: modal.row!.id }); }}/> : modal.kind === 'order' ? <OrderDetail order={modal.row as unknown as Order} products={s.products} onEdit={s.role !== 'driver' ? () => setModal({kind:'editOrder',row:modal.row}) : undefined} onDelivery={() => setModal({kind:'delivery',row:modal.row})} onExport={() => exportRows([modal.row!], 'order-'+modal.row!.reference)}/> : <form id="workspace-record-form" onSubmit={submitModal}>
 {modal.kind === 'batch' && <><div className="info-strip"><strong>Reference generated on save</strong><p>Example: GLT-261112-01 · blend, production date, daily batch number. Shared across production and stock records.</p></div><Select label="Blend" name="blend" disabled={!!modal.row} options={['GLT', 'GOT'].map(id => ({ id, name: id }))}/><div className="form-grid"><Field label="Production date" name="production_date" type="date" value={today}/><Field label="Approved use-by date" name="use_by" type="date"/></div><p className="form-help">Enter the approved date from your validated controls. No date is suggested.</p><QuantityLines name="outputs_json" label="Bottled outputs (match selected blend)" options={s.products.map(p => ({ id: p.id, name: productName(p.id) }))} idKey="product_id" whole/><QuantityLines name="inputs_json" label="Ingredients and packaging consumed" options={s.materials.map(m => ({ id: String(m.id), name: `${m.name} (${m.unit})` }))} idKey="material_id"/><Field label="Bottles wasted" name="wastage" type="number" min={0} value={0}/><Field label="Verification / production notes" name="notes" required={false}/></>}
 {modal.kind === 'purchase' && <><label>Record type<select name="kind" value={purchaseKind} onChange={event=>setPurchaseKind(event.target.value)}><option value="purchase">Material receipt</option><option value="expense">Operating expense</option></select></label><Field label="Supplier / payee (optional)" name="supplier" required={false}/><label>Payment method<select name="payment_method" value={purchaseMethod} onChange={event=>setPurchaseMethod(event.target.value)}>{['Cash','M-PESA','Bank'].map(method=><option key={method}>{method}</option>)}</select></label><Field key={purchaseMethod} label={purchaseMethod==='Cash'?'Receipt reference (optional for cash)':purchaseMethod==='M-PESA'?'M-PESA transaction reference':'Bank payment reference'} name="reference" required={purchaseMethod!=='Cash'}/><Field label="Item / expense" name="description"/><Field label="Date" name="date" type="date" value={today}/><Field label="Amount (KES)" name="amount" type="number" min={0.01} step="0.01"/>{purchaseKind==='purchase'&&<QuantityLines name="inputs_json" label="Materials received" options={s.materials.map(m => ({ id: String(m.id), name: `${m.name} (${m.unit})` }))} idKey="material_id"/>}</>}
 {modal.kind === 'material' && <><Field label="Material name" name="name"/><Select label="Kind" name="kind" options={['ingredient', 'packaging'].map(id => ({ id, name: id }))}/><Select label="Unit" name="unit" options={['kg', 'litres', 'pieces'].map(id => ({ id, name: id }))}/><Field label="Reorder threshold" name="threshold" type="number" min={0} step="0.001" value={0}/><p>Receive opening stock through a material receipt. A reference is optional only for cash payments.</p></>}
 {modal.kind === 'payment' && <><p>Outstanding: <strong>{money(Number(modal.row!.total) - Number(modal.row!.paid))}</strong></p><Field label="Amount received (KES)" name="amount" type="number" min={0.01} step="0.01"/><Select label="Payment method" name="method" options={['M-PESA', 'Cash', 'Bank'].map(id => ({ id, name: id }))}/><Field label="Receipt / payment reference" name="reference"/></>}
 {modal.kind === 'delivery' && <><Field label="Promised delivery date" name="delivery_date" type="date" value={String(modal.row!.delivery_date)}/><Field label="Delivery fee (KES)" name="delivery_fee" type="number" min={0} step="0.01" value={Number(modal.row!.delivery_fee || 0)}/><Field label="Exception / follow-up reason" name="exception_reason" required={false} value={String(modal.row!.exception_reason || '')}/></>}
 {modal.kind === 'product' && <><Field label="Product name" name="name" value={String(modal.row?.name||'')}/><Select label="Blend" name="blend" disabled={!!modal.row} options={[{id:'GLT',name:'GLT · Lemon'},{id:'GOT',name:'GOT · Orange'}]} value={String(modal.row?.blend||'GLT')}/><label>Bottle size (ml)<input name="volume_ml" type="number" min="1" max="10000" step="1" required readOnly={!!modal.row} defaultValue={Number(modal.row?.volume_ml||60)}/></label>{modal.row&&<p className="form-help">Blend and size identify this variant and cannot be changed. Edit its name, imagery, price or visibility below.</p>}<Field label="Image URL or local image path" name="image" value={String(modal.row?.image||'/images/glt.jpg')}/><Field label="Short product note" name="note" required={false} value={String(modal.row?.note||'')}/><label>Description<textarea name="description" maxLength={2000} rows={3} defaultValue={String(modal.row?.description||'')}/></label><Field label="Retail price (KES)" name="price" type="number" min={0.01} step="0.01" value={modal.row?Number(modal.row.price):undefined}/><label className="check"><input name="active" type="checkbox" defaultChecked={modal.row?.active!==false}/>Publish on storefront</label><label className="check"><input name="price_confirmed" type="checkbox" defaultChecked={Boolean(modal.row?.price_confirmed)}/>Owner confirmed this price</label></>}
 {modal.kind === 'bundle' && <><Field label="Bundle name" name="name"/><Select label="Variant" name="product_id" options={s.products.map(p => ({ id: p.id, name: productName(p.id) }))}/><Field label="Total bottles including free bottles" name="quantity" type="number" min={1}/><Field label="Free bottles (included above)" name="free_quantity" type="number" min={0} value={0}/><Field label="Bundle total price (KES)" name="price" type="number" min={0} step="0.01"/><label className="check"><input name="active" type="checkbox"/>Activate for ordering</label></>}
 {modal.kind === 'hold' && <Field label="Reason for this hold / release" name="reason"/>}
 {modal.kind === 'opening' && <OpeningStock data={s}/>}
 {modal.kind === 'materialAdjust' && <><Field label="Quantity change (negative for wastage)" name="quantity" type="number" step="0.001"/><Field label="Reason / correction note" name="reason"/></>}
 {modal.kind === 'adjust' && <><Field label="Quantity change (negative for wastage)" name="quantity" type="number" step="1"/><Field label="Reason / correction note" name="reason"/><p>Reserved bottles cannot be removed. A correction always leaves a movement record.</p></>}
 </form>}</>}</Sheet>
 </div>;
}
function DataTable({ rows, columns }: {
    rows: RecordRow[];
    columns: string[];
}) { return <Table heads={columns.map(c => c.replaceAll('_', ' '))}>{rows.length ? rows.map((r, i) => <tr key={String(r.id || i)}>{columns.map(c => <td key={c}>{r[c] === null || r[c] === undefined ? 'Missing' : typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c])}</td>)}</tr>) : <tr><td colSpan={columns.length}>No records yet.</td></tr>}</Table>; }
function SalesChart({ orders, from, to }: {
    orders: Order[];
    from: string;
    to: string;
}) {
 const mobile=useMobile(),{points,labels}=salesSeries(orders,from,to),ticks=chartTicks(labels.length,mobile?4:7),max=Math.max(...points,1000);
 return <figure className="sales-chart"><div className="chart-body"><div className="chart-y"><span>{Math.ceil(max).toLocaleString()}</span><span>{Math.round(max/2).toLocaleString()}</span><span>0</span></div><div className="chart-plot"><svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label={`Confirmed sales in KES from ${from} to ${to}. Total ${points.reduce((a,b)=>a+b,0)} KES.`}><path d="M0 15H600 M0 90H600 M0 170H600" stroke="#e4e7dd" strokeDasharray="4 6" fill="none"/>{points.map((value,index)=><rect key={index} x={(index+.2)*600/points.length} y={170-value/max*150} width={600/points.length*.6} height={Math.max(2,value/max*150)} rx="5" fill={index===points.length-1?'#c6a549':'#617954'}><title>{labels[index]}: {money(value)}</title></rect>)}</svg><div className="chart-x" style={{gridTemplateColumns:`repeat(${labels.length||1},minmax(0,1fr))`}}>{ticks.map(index=><span key={index} style={{gridColumn:index+1}}><b>{Number(labels[index].slice(8))}</b><span>{new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(new Date(labels[index]+'T12:00:00Z'))}</span></span>)}</div></div></div><figcaption className="chart-caption">Daily sales · Africa/Nairobi{labels.length===31?' · First 31 days shown':''}</figcaption></figure>;
}
