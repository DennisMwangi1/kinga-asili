'use client';
import { useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import remarkGfm from 'remark-gfm';
import { copyTable, copyText, safeMarkdownUrl } from '@/lib/assistant/clipboard';

// KooKoo's answer layout and copy-table behaviour, with a full safe GFM parser.
function MarkdownTable({children}:{children?:ReactNode}) {
 const table=useRef<HTMLTableElement>(null),[copied,setCopied]=useState<boolean|null>(null);
 async function copy(){
  const rows=Array.from(table.current?.rows||[]).map(row=>Array.from(row.cells).map(cell=>cell.textContent||''));
  setCopied(await copyTable(rows));
 }
 return <div className="kai-table-block"><div className="kai-table-wrap" role="region" aria-label="Answer table" tabIndex={0}><table className="kai-table" ref={table}>{children}</table></div><button type="button" className="kai-table-copy" onClick={()=>void copy()}>{copied===null?'Copy table':copied?'Copied ✓':'Could not copy · select the table instead'}</button><span className="sr-only" role="status">{copied===null?'':copied?'Table copied':'Clipboard unavailable'}</span></div>;
}
function CodeBlock({children}:{children?:ReactNode}) {
 const code=useRef<HTMLPreElement>(null),[copied,setCopied]=useState<boolean|null>(null);
 return <div className="kai-code-block"><pre ref={code}>{children}</pre><button className="kai-table-copy" type="button" onClick={async()=>setCopied(await copyText(code.current?.textContent||''))}>{copied===null?'Copy code':copied?'Copied ✓':'Could not copy'}</button></div>;
}
export function RichText({text,onNavigate}:{text:string;onNavigate?:()=>void}) {
 return <div className="kai-rich"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeMarkdownUrl} components={{
  table:MarkdownTable,pre:CodeBlock,
  a:({href,children})=>href?.startsWith('/')?<Link href={href} onClick={onNavigate}>{children}</Link>:href?<a href={href} target={/^https?:/i.test(href)?'_blank':undefined} rel="noopener noreferrer">{children}</a>:<span>{children}</span>,
  img:({alt})=><span className="kai-image-label">{alt||'Image'}</span>,
 }}>{text}</ReactMarkdown></div>;
}
