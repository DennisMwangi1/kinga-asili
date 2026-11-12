export type Role = 'admin' | 'sales' | 'cashier' | 'stock_keeper' | 'driver';
export type RecordRow = Record<string, string | number | boolean | null | unknown[]>;
export interface Product {
    id: string;
    name: string;
    blend: string;
    volume_ml: number;
    price: number;
    price_confirmed: boolean;
    image: string;
    available: number;
}
export interface OrderLine {
    product_id: string;
    quantity: number;
    unit_price: number;
    free_quantity?: number;
    bundle_id?: string;
}
export interface Order {
    customer_id?: string;
    id: string;
    reference: string;
    customer_name: string;
    phone: string;
    location: string;
    notes: string;
    lines: OrderLine[];
    status: string;
    total: number;
    paid: number;
    delivery_fee: number;
    discount: number;
    delivery_date: string;
    created_at: string;
    rider_id?: string;
    exception_reason?: string;
}
export interface Batch {
    id: string;
    reference: string;
    blend: string;
    production_date: string;
    use_by: string;
    status: string;
    outputs: {
        product_id: string;
        quantity: number;
    }[];
    inputs: {
        material_id: string;
        quantity: number;
    }[];
    wastage: number;
    notes: string;
    created_at: string;
}
export interface Snapshot {
    role: Role;
    name: string;
    products: Product[];
    orders: Order[];
    batches: Batch[];
    materials: RecordRow[];
    lots: RecordRow[];
    movements: RecordRow[];
    purchases: RecordRow[];
    customers: RecordRow[];
    payments: RecordRow[];
    reviews: RecordRow[];
    profiles: RecordRow[];
    bundles: RecordRow[];
    audit: RecordRow[];
}
export const money = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);
export const eatDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function lineTotal(lines: OrderLine[], fee = 0, discount = 0) {
    if (!lines.length || !Number.isFinite(fee) || fee < 0 || !Number.isFinite(discount) || discount < 0)
        throw new Error('Enter valid order amounts.');
    for (const l of lines)
        if (!Number.isInteger(l.quantity) || l.quantity <= 0 || !Number.isFinite(l.unit_price) || l.unit_price < 0 || !Number.isInteger(l.free_quantity || 0) || (l.free_quantity || 0) < 0 || (l.free_quantity || 0) > l.quantity)
            throw new Error('Use whole bottles and valid prices.');
    const subtotal = lines.reduce((s, l) => s + (l.quantity - (l.free_quantity || 0)) * l.unit_price, 0);
    if (discount > subtotal)
        throw new Error('Discount exceeds product subtotal.');
    return Math.round((subtotal + fee - discount) * 100) / 100;
}
export function csv(rows: Record<string, unknown>[]) {
    if (!rows.length)
        return '';
    const keys = Array.from(new Set(rows.flatMap(Object.keys)));
    const cell = (v: unknown) => { let s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''); if (/^[=+@\-\t\r]/.test(s))
        s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
    return '\uFEFF' + [keys.map(cell).join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\r\n');
}
export const navigation = [
    ['Overview', '/dashboard', '◫', ['admin']], ['Orders', '/dashboard/orders', '▤', ['admin', 'sales', 'cashier']], ['Production', '/dashboard/production', '◉', ['admin', 'stock_keeper']], ['Inventory', '/dashboard/inventory', '▦', ['admin', 'stock_keeper', 'cashier']], ['Purchases & Expenses', '/dashboard/purchases', '↗', ['admin', 'stock_keeper', 'cashier']], ['Customers', '/dashboard/customers', '♧', ['admin', 'sales', 'cashier']], ['Deliveries', '/dashboard/deliveries', '⇢', ['admin', 'driver']], ['Reports', '/dashboard/reports', '▥', ['admin']], ['Settings', '/dashboard/settings', '⚙', ['admin']]
] as const;
export function weeklyMetrics(s: Snapshot, from: string, to: string) {
    const within = (v: string) => { const day = v.length === 10 ? v : eatDate(new Date(v)); return day >= from && day <= to; };
    const sales = s.orders.filter(o => !['requested', 'cancelled'].includes(o.status) && within(o.created_at));
    const payments = s.payments.filter(p => within(String(p.created_at)));
    return { sales: sales.reduce((n, o) => n + o.total, 0), collected: payments.reduce((n, p) => n + Number(p.amount), 0), outstanding: s.orders.filter(o => !['requested', 'cancelled'].includes(o.status)).reduce((n, o) => n + Math.max(0, o.total - o.paid), 0), expenses: s.purchases.filter(p => p.status === 'posted' && within(String(p.date))).reduce((n, p) => n + Number(p.amount), 0), bottles: sales.reduce((n, o) => n + o.lines.reduce((a, l) => a + l.quantity, 0), 0), production: s.batches.filter(b => b.status === 'posted' && within(b.production_date)).reduce((n, b) => n + b.outputs.reduce((a, o) => a + o.quantity, 0), 0), wastage: s.batches.filter(b => b.status === 'posted' && within(b.production_date)).reduce((n, b) => n + b.wastage, 0) };
}
