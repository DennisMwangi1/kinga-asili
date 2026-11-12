'use client';
import { useState } from 'react';
import { type Product, type RecordRow, type OrderLine, money, eatDate, lineTotal } from '@shared/domain';
type Props = {
    products: Product[];
    bundles: RecordRow[];
    busy: boolean;
    onSave: (data: Record<string, unknown>) => Promise<void>;
};
export function OrderForm({ products, bundles, busy, onSave }: Props) {
    const [lines, setLines] = useState<OrderLine[]>([]);
    const [blend, setBlend] = useState('GLT');
    const [validation, setValidation] = useState('');
    const [requestKey] = useState(() => crypto.randomUUID());
    let total = 0;
    try {
        if (lines.length)
            total = lineTotal(lines);
    }
    catch { }
    function add(product: Product) {
        setLines(current => { const existing = current.find(l => l.product_id === product.id && !l.bundle_id); return existing ? current.map(l => l === existing ? { ...l, quantity: l.quantity + 1 } : l) : [...current, { product_id: product.id, quantity: 1, unit_price: product.price }]; });
    }
    return <form className="order-form" onSubmit={async (event) => {
            event.preventDefault();
            setValidation('');
            try {
                lineTotal(lines);
                const fields = new FormData(event.currentTarget);
                await onSave({ ...Object.fromEntries(fields.entries()), lines, idempotency_key: requestKey });
            }
            catch (error) {
                setValidation((error as Error).message);
            }
        }}>
  <div className="order-main">
   <section className="panel">
    <span className="step-label">01 / YOUR DETAILS</span><h2>Who are we caring for?</h2>
    <div className="form-grid">
     <label>Your name<input name="customer_name" required autoComplete="name"/></label>
     <label>Phone number<input name="phone" type="tel" required autoComplete="tel"/></label>
    </div>
   </section>
   <section className="panel">
    <span className="step-label">02 / YOUR BLENDS</span><h2>A blend for your everyday.</h2>
    <div className="blend-tabs">{['GLT', 'GOT'].map(value => <button type="button" key={value} className={blend === value ? 'selected' : ''} onClick={() => setBlend(value)}>{value === 'GLT' ? 'Lemon blend' : 'Orange blend'}</button>)}</div>
    <div className="product-picker">{products.filter(p => p.blend === blend).map(product => <button type="button" className="pick-product" key={product.id} onClick={() => add(product)}>
     <img src={product.image} alt={`${product.blend} bottle`}/>
     <span><strong>{product.volume_ml} ml</strong><small>{product.volume_ml === 60 ? 'Daily shot' : product.volume_ml === 120 ? 'Double shot' : 'Everyday bottle'}</small><b>{money(product.price)}</b></span><i>＋</i>
    </button>)}</div>
    {bundles.filter(bundle => bundle.active).map(bundle => <button type="button" className="bundle-choice" key={String(bundle.id)} onClick={() => setLines([...lines, { product_id: String(bundle.product_id), quantity: Number(bundle.quantity), free_quantity: Number(bundle.free_quantity), unit_price: Number(bundle.price) / (Number(bundle.quantity) - Number(bundle.free_quantity)), bundle_id: String(bundle.id) }])}>{String(bundle.name)} · {Number(bundle.quantity)} bottles · {money(Number(bundle.price))} ＋</button>)}
   </section>
   <section className="panel">
    <span className="step-label">03 / YOUR DELIVERY</span><h2>The last little details.</h2>
    <label>Delivery location<input name="location" required autoComplete="street-address"/></label>
    <label>Preferred delivery date<input name="delivery_date" type="date" min={eatDate()} defaultValue={eatDate()} required/></label>
    <label>Order / delivery notes<input name="notes"/></label>
    <p className="form-help">The team will confirm availability, your delivery fee and payment details. No payment is collected now.</p>
   </section>
  </div>
  <aside className="panel order-summary">
   <span className="eyebrow">A LITTLE GOODNESS</span><h2>Your order summary</h2>
   {lines.length ? lines.map((line, index) => {
            const product = products.find(p => p.id === line.product_id)!;
            return <div className="cart-line" key={index}>
    <strong>{product.blend} · {product.volume_ml} ml</strong>
    <button type="button" className="text-button" aria-label={`Remove ${product.blend} ${product.volume_ml} ml`} onClick={() => setLines(lines.filter((_, i) => i !== index))}>Remove</button>
    <label>Bottles<input aria-label={`${product.blend} ${product.volume_ml} ml quantity`} type="number" min="1" step="1" readOnly={!!line.bundle_id} value={line.quantity} onChange={event => setLines(lines.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))}/></label>
    <span>{money(line.unit_price)} / bottle</span>
    {!!line.free_quantity && <small>{line.free_quantity} free included</small>}
   </div>;
        }) : <p className="empty-cart">Choose a blend and size to start your order.</p>}
   <div className="total"><span>Estimated subtotal</span><strong>{money(total)}</strong></div>
   <p className="form-help">Delivery fee confirmed by the team. Prices subject to confirmation.</p>
   {validation && <p role="alert" className="error">{validation}</p>}
   <button className="primary" disabled={busy || !lines.length}>{busy ? 'Sending…' : 'Send order request →'}</button>
   <span className="secure-note">No payment required at this step</span>
  </aside>
  <div className="mobile-order-total"><span>Estimated subtotal<strong>{money(total)}</strong></span><button className="primary" disabled={busy || !lines.length}>{busy ? 'Sending…' : 'Send request →'}</button></div>
 </form>;
}
