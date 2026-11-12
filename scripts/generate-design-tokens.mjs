import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = new URL('../components/ui/theme/', import.meta.url);
function compile(name, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL(name + '.ts', source), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => dependencies[name] });
  return module.exports;
}
const tokens = compile('designTokens');
const { tokensCss } = compile('tokensCss', { './designTokens': tokens });
fs.writeFileSync(new URL('../components/ui/tokens.css', import.meta.url), tokensCss());
