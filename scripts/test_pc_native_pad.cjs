// Exercise compiled XInput conversion through the installed engine's actual native PAL.
// This is an ABI fixture test, not a physical controller test or mouse automation.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),engine=process.env.COCOS_ENGINE||'C:/Develop/Cocos/Creator/3.8.8/resources/resources/3d/engine';
const ts=require(process.env.TS_MODULE||'C:/Develop/Cocos/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const rows=fs.readFileSync(path.join(root,'artifacts/pc-controller-20261107/xinput-fixtures.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse);
class Vec2{constructor(x,y){this.x=x;this.y=y;}}
class EventTarget{constructor(){this.events={};}on(name,fn){(this.events[name]??=[]).push(fn);}emit(name,event){for(const fn of this.events[name]||[])fn(event);}}
const jsb={},load=(file,require)=>{
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,{module,exports:module.exports,require,jsb});return module.exports;
};
const core={Vec2,Vec3:{ZERO:{}},Quat:{IDENTITY:{}},js:{array:{fastRemoveAt:(a,i)=>{a[i]=a[a.length-1];a.pop();}}}};
const source=load(path.join(engine,'pal/input/input-source.ts'),()=>core);
const types={GAMEPAD_INPUT:'input',GAMEPAD_CHANGE:'change'};
const {GamepadInputDevice}=load(path.join(engine,'pal/input/native/gamepad-input.ts'),name=>{
 if(name==='pal/system-info')return{systemInfo:{hasFeature:()=>true}};
 if(name.endsWith('enum-type'))return{Feature:{EVENT_GAMEPAD:1}};
 if(name.endsWith('event-enum'))return{InputEventType:types};
 if(name.endsWith('event-target'))return{EventTarget};
 if(name.endsWith('/types'))return{EventGamepad:class{constructor(type,gamepad){this.type=type;this.gamepad=gamepad;}}};
 if(name.endsWith('input-source'))return source;
 if(name.endsWith('/core'))return core;
 throw Error('Unexpected PAL dependency '+name);
});
GamepadInputDevice._init();let pad;GamepadInputDevice._on(types.GAMEPAD_INPUT,e=>pad=e.gamepad);
const mapping={A:'buttonSouth',B:'buttonEast',X:'buttonWest',Y:'buttonNorth',LB:'buttonL1',Start:'buttonOptions',Back:'buttonShare',RT:'buttonR2'};
jsb.onControllerChange([0]);
for(const row of rows){
 jsb.onControllerInput([row]);assert(pad?.connected);
 for(const [name,property]of Object.entries(mapping))assert.equal(pad[property].getValue(),row.name===name?1:0,`${row.name} -> ${property}`);
 if(row.name==='axes'){assert.equal(pad.leftStick.getValue().x,-1);assert.equal(pad.leftStick.getValue().y,1);assert.equal(pad.dpad.getValue().x,1);assert.equal(pad.dpad.getValue().y,-1);}
}
jsb.onControllerChange([]);assert.equal(pad.connected,false);
fs.writeFileSync(path.join(root,'qa/pc/controller/native-pad.json'),JSON.stringify({passed:true,source:'Compiled XInput mapper through Cocos 3.8.8 native PAL',cases:rows.map(x=>x.name),disconnect:true,physicalControllerTested:false},null,2));
console.log('Native XInput / Cocos PAL mapping checks passed');
