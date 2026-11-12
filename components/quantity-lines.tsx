'use client';
import { useState } from 'react';
export default function QuantityLines({ name, label, options, idKey, whole = false }: {
    name: string;
    label: string;
    options: {
        id: string;
        name: string;
    }[];
    idKey: string;
    whole?: boolean;
}) {
    const [lines, setLines] = useState([{ key: 0, id: options[0]?.id || '', quantity: 1 }]);
    return <fieldset className="quantity-lines"><legend>{label}</legend><input type="hidden" name={name} value={JSON.stringify(lines.map(l => ({ [idKey]: l.id, quantity: l.quantity })))}/>{lines.map((l, i) => <div className="quantity-line" key={l.key}><label>Item<select value={l.id} required onChange={e => setLines(lines.map((v, j) => j === i ? { ...v, id: e.target.value } : v))}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>Quantity<input type="number" min={whole ? 1 : 0.001} step={whole ? '1' : '0.001'} required value={l.quantity} onChange={e => setLines(lines.map((v, j) => j === i ? { ...v, quantity: Number(e.target.value) } : v))}/></label><button type="button" disabled={lines.length === 1} aria-label={`Remove ${label} line ${i + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button></div>)}<button type="button" onClick={() => setLines([...lines, { key: Math.max(...lines.map(l => l.key)) + 1, id: options[0]?.id || '', quantity: 1 }])}>＋ Add another line</button></fieldset>;
}
