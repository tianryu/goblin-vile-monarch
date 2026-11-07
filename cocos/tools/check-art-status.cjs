// 结构正确不等于画风通过，发行前禁止混入被否决或尚无风格结论的新素材。
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'art/source/manifest.json'),'utf8'));
const rejected=[],pending=[];
for(const [name,spec] of Object.entries(manifest)){
 if(spec.styleRejected)rejected.push(name);
 else if(spec.styleApproved!==true)pending.push(name);
}
console.log(JSON.stringify({rejected,pending,releaseReady:!rejected.length&&!pending.length},null,2));
if(rejected.length||pending.length)process.exitCode=1;
