import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
let tableClipboard, safeMarkdownUrl, RichText;
const render=text=>renderToStaticMarkup(React.createElement(RichText,{text}));
test.before(async()=>{
const clipboardSource=ts.transpileModule(await readFile(new URL('../lib/assistant/clipboard.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const clipboardUrl=moduleUrl(clipboardSource);
({tableClipboard,safeMarkdownUrl}=await import(clipboardUrl));
let richSource=ts.transpileModule(await readFile(new URL('../components/assistant/rich-text.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
richSource=richSource.replace(/from (["'])([^"']+)\1/g,(_,quote,name)=>`from ${JSON.stringify(name==='@/lib/assistant/clipboard'?clipboardUrl:pathToFileURL(require.resolve(name)).href)}`);
({RichText}=await import(moduleUrl(richSource)));



});

test('answers render headings, nested lists, emphasis and code as Markdown',()=>{
 const html=render('## Stock review\n\n**GLT** is ready.\n\n- First\n  - Nested\n\n1. Count bottles\n2. Verify stock\n\n`KA-1001`\n\n```txt\n<script>example</script>\n```');
 for(const part of ['<h2>Stock review</h2>','<strong>GLT</strong>','<ul>','<ol>','<li>Nested</li>','<code>KA-1001</code>','&lt;script&gt;example&lt;/script&gt;','Copy code'])assert.ok(html.includes(part),part);
 assert.ok(!html.includes('<script>'));
});
test('GFM reports render a scrollable table and copy action',()=>{
 const html=render('| Blend | Bottles |\n| --- | ---: |\n| GLT | 12 |\n| GOT | 9 |');
 for(const part of ['aria-label="Answer table"','<table','<th>Blend</th>','<td>GLT</td>','Copy table'])assert.ok(html.includes(part),part);
});
test('raw HTML, dangerous links and remote images do not execute or load',()=>{
 const html=render('<script>alert(1)</script>\n\n[Bad](javascript:alert%281%29)\n\n![Tracking](https://example.test/pixel.png)\n\n[Report](https://example.test/report)');
 assert.ok(!html.includes('<script'));
 assert.ok(!html.includes('javascript:'));
 assert.ok(!html.includes('<img'));
 assert.ok(html.includes('rel="noopener noreferrer"'));
});
test('copy table escapes HTML and protects spreadsheet formula cells',()=>{
 const output=tableClipboard([['Product','Notes'],['<GLT>','=HYPERLINK("https://invalid.test")'],['GOT','two\tlines\nonly']]);
 assert.ok(output.html.includes('&lt;GLT&gt;'));
 assert.ok(!output.html.includes('<GLT>'));
 assert.ok(output.text.includes("\t'=HYPERLINK"));
 assert.ok(output.text.includes('two lines only'));
});
test('Markdown links accept web, email and workspace paths only',()=>{
 for(const url of ['https://example.test','mailto:team@example.test','/dashboard/orders','#stock'])assert.equal(safeMarkdownUrl(url),url);
 for(const url of ['javascript:alert(1)','data:text/html,bad','//example.test','/\\example.test','java\nscript:bad'])assert.equal(safeMarkdownUrl(url),'');
});
