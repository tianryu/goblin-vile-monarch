const fs = require('fs');
const path = require('path');
const ts = require('C:/Develop/Cocos/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'qa/cocos/model-build');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'package.json'), '{"type":"commonjs"}');
for (const name of ['Rules', 'State', 'WorldUpgrade', 'Progression','PrisonLayout','CampaignRules','CampaignUpgrade', 'GameModel']) {
  const source = fs.readFileSync(path.join(root, 'cocos/assets/scripts/model', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS } });
  fs.writeFileSync(path.join(out, name + '.js'), code.outputText);
}
console.log('Compiled engine-independent model for isolated tests.');
