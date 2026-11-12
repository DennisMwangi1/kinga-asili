/** Plain-text / HTML table exports for pasting AI reports into spreadsheets. */
const escapeHtml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function tableClipboard(rows:string[][]) {
 const clean=rows.map(row=>row.map(cell=>cell.replace(/[\t\r\n]+/g,' ').trim()));
 // Keep answer text from becoming a formula when pasted into a spreadsheet.
 const safe=(cell:string)=>/^[=+@-]/.test(cell)?"'"+cell:cell;
 const [head=[],...body]=clean;
 return {
  text:clean.map(row=>row.map(safe).join('\t')).join('\n'),
  html:'<table><thead><tr>'+head.map(cell=>'<th>'+escapeHtml(safe(cell))+'</th>').join('')+'</tr></thead><tbody>'+body.map(row=>'<tr>'+row.map(cell=>'<td>'+escapeHtml(safe(cell))+'</td>').join('')+'</tr>').join('')+'</tbody></table>',
 };
}
export function safeMarkdownUrl(url:string) {
 const value=url.trim();
 if (/[\\\x00-\x20]/.test(value)) return ''; 
 return /^(https?:|mailto:)/i.test(value)||value.startsWith('#')||value.startsWith('/')&&!value.startsWith('//') ? value : '';
}
export async function copyText(text:string):Promise<boolean> {
 try {await navigator.clipboard.writeText(text);return true;} catch {return false;}
}
export async function copyTable(rows:string[][]):Promise<boolean> {
 const output=tableClipboard(rows);
 try {
  await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([output.html],{type:'text/html'}),'text/plain':new Blob([output.text],{type:'text/plain'})})]);
  return true;
 } catch {return copyText(output.text);}
}
