// PC 定向验收：本地化不改业务、坐骑交易守恒和重复购买，不依赖引擎或正式存档。
const fs=require('fs'),path=require('path'),assert=require('assert'),Module=require('module');
const root=path.resolve(__dirname,'..');
const ts=require(process.env.TS_MODULE||'C:/Develop/Cocos/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,file);
const {GameModel}=require(path.join(root,'cocos/assets/scripts/model/GameModel.ts'));
const locale=require(path.join(root,'cocos/assets/scripts/i18n/Locale.ts'));
const {DIALOGUES}=require(path.join(root,'cocos/assets/scripts/model/ChapterText.ts'));
const model=new GameModel();const before=JSON.stringify(model.state);
locale.setLanguage('en');
assert.equal(locale.translate('哥布林：卑劣君主'),'Goblin: Vile Monarch');
assert.equal(locale.translate('领取23金币'),'Claim 23 coins');
assert.equal(locale.translate('人口 12/20'),'Population 12/20');
for(const pages of Object.values(DIALOGUES))for(const page of pages)assert(!/[\u3400-\u9fff]/.test(locale.translate(page.text)),page.text);
locale.setLanguage('zh-CN');assert.equal(before,JSON.stringify(model.state));
assert.equal(locale.translate('哥布林：卑劣君主'),'哥布林：卑劣君主');
Object.assign(model.state.mountTrader,{phase:'trading',visitDay:2,offer:'lizard'});model.state.day=2;model.state.player.x=model.state.mountTrader.x;
model.state.gold=29;assert.equal(model.purchaseMount('lizard'),false);assert.equal(model.state.gold,29);
model.state.gold=40;assert.equal(model.purchaseMount('lizard'),true);assert.equal(model.state.gold,10);
assert.equal(model.purchaseMount('lizard'),false);assert.equal(model.state.gold,10);
assert.equal(model.state.unlockedMounts.filter(x=>x==='lizard').length,1);
assert.equal(model.purchaseMount('not-a-mount'),false);
model.pause('menu',true);assert.equal(model.purchaseMount('boar'),false);model.pause('menu',false);
// 静态显示文案覆盖：只核对正式显示模块，排除注释、规则状态与模板占位。
locale.setLanguage('en');
const files=['model/ChapterText.ts','model/Rules.ts','model/ChapterDirector.ts','view/GameView.ts','view/HangingMenu.ts','view/ChapterView.ts','view/Controls.ts'];
const literals=new Set();
for(const name of files){
 const file=path.join(root,'cocos/assets/scripts',name),ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const visit=node=>{if(ts.isStringLiteral(node)&&/[\u3400-\u9fff]/.test(node.text)&&node.text.length>1)literals.add(node.text);ts.forEachChild(node,visit);};visit(ast);
}
const missing=[...literals].filter(text=>/[\u3400-\u9fff]/.test(locale.translate(text)));
fs.mkdirSync(path.join(root,'qa/pc'),{recursive:true});
fs.writeFileSync(path.join(root,'qa/pc/locale-audit.json'),JSON.stringify({literals:literals.size,missing},null,2));
if(missing.length){console.log('Untranslated fragments:',missing);process.exitCode=1;}
else console.log('PC model and locale checks passed. Display literals:',literals.size);
