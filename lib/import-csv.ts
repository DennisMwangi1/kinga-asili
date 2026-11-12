export function parseCustomers(source: string): Record<string, string>[] {
    const rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false;
    const text = source.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (quoted && text[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else
                quoted = !quoted;
        }
        else if (c === ',' && !quoted) {
            row.push(cell);
            cell = '';
        }
        else if ((c === '\n' || c === '\r') && !quoted) {
            if (c === '\r' && text[i + 1] === '\n')
                i++;
            row.push(cell);
            if (row.some(v => v.trim()))
                rows.push(row);
            row = [];
            cell = '';
        }
        else
            cell += c;
    }
    if (quoted)
        throw Error('CSV has an unclosed quoted cell.');
    row.push(cell);
    if (row.some(v => v.trim()))
        rows.push(row);
    const headers = rows.shift()?.map(v => v.trim().toLowerCase()) || [];
    if (!headers.includes('name') || !headers.includes('phone'))
        throw Error('CSV needs name and phone columns. Optional: location, notes.');
    if (rows.length > 1000)
        throw Error('Import up to 1000 customers at a time.');
    return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]?.trim() || ''])));
}
