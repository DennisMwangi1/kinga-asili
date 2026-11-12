import ts from 'typescript';
import {readFile} from 'node:fs/promises';
export async function loadTs(path){const source=await readFile(new URL(path,import.meta.url),'utf8');const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));}
