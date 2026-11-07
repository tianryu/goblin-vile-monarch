import fs from 'node:fs';
import path from 'node:path';
import {ASSETS} from '../src/assets.js';

// Read-only inventory of source PNG dimensions. This is NOT a phone benchmark.
const mib=bytes=>Number((bytes/1048576).toFixed(3));
const names=new Set(Object.keys(ASSETS).map(name=>`${name}.png`));
const files=fs.readdirSync('assets').filter(name=>name.endsWith('.png')).map(name=>{
 const file=path.join('assets',name),fd=fs.openSync(file,'r'),header=Buffer.alloc(24);
 try{fs.readSync(fd,header,0,24,0);}finally{fs.closeSync(fd);}
 if(header.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error(`Not a PNG: ${file}`);
 const width=header.readUInt32BE(16),height=header.readUInt32BE(20);
 return {file,loadedByOldPrototype:names.has(name),width,height,encodedBytes:fs.statSync(file).size,estimatedRGBABytes:width*height*4};
});
const sum=items=>({files:items.length,encodedMiB:mib(items.reduce((n,f)=>n+f.encodedBytes,0)),estimatedRGBA_MiB:mib(items.reduce((n,f)=>n+f.estimatedRGBABytes,0))});
const report={recordedAt:new Date().toISOString(),scope:'Old prototype source assets, not redesigned game and not physical phone measurements',method:'PNG IHDR width × height × 4 bytes; single uncompressed RGBA copy only',exclusions:['Browser process, DOM and JS heap','GPU copies and texture allocation','Canvas backing buffers and ImageData','Advertising SDK and audio decoding'],allSources:sum(files),loadedByOldPrototype:sum(files.filter(f=>f.loadedByOldPrototype)),framebuffers:[{width:1774,height:887,rgbaMiB:mib(1774*887*4)},{width:512,height:256,rgbaMiB:mib(512*256*4)}],files};
fs.mkdirSync('qa',{recursive:true});
const output='qa/resource-baseline-2026-10-30.json';
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,allSources:report.allSources,loadedByOldPrototype:report.loadedByOldPrototype,framebuffers:report.framebuffers},null,2));
