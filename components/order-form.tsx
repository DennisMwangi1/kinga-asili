'use client';
import { useId, useState } from 'react';
import CustomerPicker from './customer-picker';
import {orderCustomerValues,orderAmount} from '@/lib/order-entry';
import { SheetFooter } from './sheet';
import { type Product, type RecordRow, type OrderLine, type Order, money, eatDate, lineTotal } from '@/lib/domain';
function Field({ label, name, type = 'text', value, required = true, min, step }: {
    label: string;
    name: string;
    type?: string;
    value?: string | number;
    required?: boolean;
    min?: number;
    step?: string;
}) { return <label>{label}<input name={name} type={type} defaultValue={value} required={required} min={min} step={step}/></label>; }
export function OrderForm({ products, customers, bundles, busy, onSave, publicShop = false, initial }: {
    products: Product[];
    customers: RecordRow[];
    bundles: RecordRow[];
    busy: boolean;
    onSave: (d: Record<string, unknown>) => Promise<void>;
    publicShop?: boolean;
    initial?: Order;
}) {
    const [lines, setLines] = useState<OrderLine[]>(initial?.lines || []), [blend, setBlend] = useState('GLT'), [fee, setFee] = useState(String(initial?.delivery_fee ?? 0)), [discount, setDiscount] = useState(String(initial?.discount ?? 0)), [customer, setCustomer] = useState<RecordRow | undefined>(orderCustomerValues(initial ? { id: initial.customer_id || '', name: initial.customer_name, phone: initial.phone, location: initial.location } : undefined)), [validation, setValidation] = useState('');
    const formId = useId();
    const [requestKey] = useState(() => crypto.randomUUID());
    const total = lines.length ? (() => { try {
        return lineTotal(lines, orderAmount(fee,'Delivery fee'), orderAmount(discount,'Order discount'));
    }
    catch {
        return 0;
    } })() : 0;
    const add = (p: Product) => setLines(old => { const found = old.find(l => l.product_id === p.id && !l.free_quantity); return found ? old.map(l => l === found ? { ...l, quantity: l.quantity + 1 } : l) : [...old, { product_id: p.id, quantity: 1, unit_price: p.price }]; });
    return <form id={formId} className="order-form" onSubmit={async (e) => { e.preventDefault(); setValidation(''); try {
        lineTotal(lines, orderAmount(fee,'Delivery fee'), orderAmount(discount,'Order discount'));
        const f = new FormData(e.currentTarget);
        await onSave({ ...Object.fromEntries(f.entries()), lines, idempotency_key: requestKey, delivery_fee: publicShop ? 0 : orderAmount(fee,'Delivery fee'), discount: publicShop ? 0 : orderAmount(discount,'Order discount') });
    }
    catch (e) {
        setValidation((e as Error).message);
    } }}><div className="order-main"><section className="panel"><span className="step-label">01 / THE CUSTOMER</span><h2>Who are we caring for?</h2>{!!customers.length && <CustomerPicker customers={customers} value={String(customer?.id||'new')} onChange={selected=>setCustomer(orderCustomerValues(selected))} disabled={busy}/>}<div className="form-grid"><label>Customer name<input name="customer_name" autoComplete="name" required minLength={2} maxLength={100} value={String(customer?.name||'')} onChange={event=>setCustomer(current=>({...current,name:event.target.value}))}/></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" required value={String(customer?.phone||'')} onChange={event=>setCustomer(current=>({...current,phone:event.target.value}))}/></label></div></section><section className="panel"><span className="step-label">02 / THE BLENDS</span><h2>A blend for their everyday.</h2><div className="blend-tabs">{['GLT', 'GOT'].map(b => <button type="button" key={b} className={blend === b ? 'selected' : ''} onClick={() => setBlend(b)}>{b === 'GLT' ? 'Lemon blend' : 'Orange blend'}</button>)}</div><div className="product-picker">{products.filter(p => p.blend === blend).map(p => <button type="button" className="pick-product" key={p.id} onClick={() => add(p)}><img src={p.image} alt={`${p.blend} bottle`}/><span><strong>{p.volume_ml} ml</strong><small>{p.volume_ml === 60 ? 'Daily shot' : p.volume_ml === 120 ? 'Double shot' : 'Everyday bottle'}</small><b>{money(p.price)}</b></span><i>＋</i></button>)}</div>{bundles.filter(b => b.active).map(b => <button className="bundle-choice" type="button" key={String(b.id)} onClick={() => setLines([...lines, { product_id: String(b.product_id), quantity: Number(b.quantity), free_quantity: Number(b.free_quantity), unit_price: Number(b.price) / (Number(b.quantity) - Number(b.free_quantity)), bundle_id: String(b.id) }])}>{String(b.name)} · {Number(b.quantity)} bottles · {money(Number(b.price))} ＋</button>)}</section><section className="panel"><span className="step-label">03 / THE DELIVERY</span><h2>The last little details.</h2><label>Delivery address<textarea name="location" rows={3} required minLength={5} maxLength={500} autoComplete="street-address" value={String(customer?.location||'')} onChange={event=>setCustomer(current=>({...current,location:event.target.value}))}/></label><Field label="Preferred delivery date" name="delivery_date" type="date" value={initial?.delivery_date || eatDate()}/><Field label="Order / delivery notes" name="notes" value={initial?.notes} required={false}/>{!publicShop && <div className="form-grid"><label>Delivery fee (KES)<input type="number" min="0" step="0.01" value={fee} onChange={e => setFee(e.target.value)}/></label><label>Order discount (KES)<input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}/></label></div>}<p className="form-help">{publicShop ? 'The team will confirm availability, your delivery fee and payment details. No payment is collected now.' : 'Saved as a request. Confirming the order reserves available, approved stock.'}</p></section></div><aside className="panel order-summary"><span className="eyebrow">A LITTLE GOODNESS</span><h2>Your order summary</h2>{lines.length ? lines.map((l, i) => { const p = products.find(p => p.id === l.product_id)!; return <div className="cart-line" key={i}><strong>{p.blend} · {p.volume_ml} ml</strong><button type="button" className="text-button" aria-label={`Remove ${p.blend} ${p.volume_ml} ml`} onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button><label>Bottles<input aria-label={`${p.blend} ${p.volume_ml} ml quantity`} type="number" min="1" step="1" readOnly={!!l.bundle_id} value={l.quantity} onChange={e => setLines(lines.map((v, j) => j === i ? { ...v, quantity: Number(e.target.value) } : v))}/></label>{publicShop ? <span>{money(l.unit_price)} / bottle</span> : <label>Price / bottle<input aria-label={`${p.blend} ${p.volume_ml} ml actual price`} type="number" min="0" step="0.01" value={l.unit_price} onChange={e => setLines(lines.map((v, j) => j === i ? { ...v, unit_price: Number(e.target.value) } : v))}/></label>}{!!l.free_quantity && <small>{l.free_quantity} free included</small>}</div>; }) : <p className="empty-cart">Choose a blend and size to start your order.</p>}<div className="total"><span>{publicShop ? 'Estimated subtotal' : 'Estimated total'}</span><strong>{money(total)}</strong></div><p className="form-help">{publicShop ? 'Delivery fee confirmed by the team. Prices subject to confirmation.' : 'Includes delivery fee and discount.'}</p>{validation && <p className="error" role="alert">{validation}</p>}<button className="primary" disabled={busy || !lines.length}>{busy ? 'Saving…' : publicShop ? 'Send order request →' : 'Save order request →'}</button><span className="secure-note">{publicShop ? 'No payment required at this step' : 'Stock is reserved after staff confirmation'}</span></aside><SheetFooter><div className="mobile-order-total"><span>Estimated total<strong>{money(total)}</strong></span><button form={formId} className="primary" disabled={busy || !lines.length}>{busy ? 'Saving…' : publicShop ? 'Send request →' : 'Save request →'}</button></div></SheetFooter></form>;
}
