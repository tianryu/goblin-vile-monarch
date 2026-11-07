import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {ASSETS} from '../src/assets.js';
const require=createRequire(import.meta.url);let sharp;try{sharp=require('sharp')}catch{}
const root=fs.realpathSync('.'),out=path.resolve('dist');if(out!==path.join(root,'dist'))throw Error('Unexpected output directory');
if(fs.existsSync(out))fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'assets'),{recursive:true});
for(const p of ['index.html','src'])fs.cpSync(p,path.join(out,p),{recursive:true});
for(const name of Object.keys(ASSETS)){const input=`assets/${name}.png`;if(!fs.existsSync(input))throw Error('Missing generated asset: '+input);if(sharp)await sharp(input).webp({lossless:true,effort:6}).toFile(`dist/assets/${name}.webp`);else fs.copyFileSync(input,`dist/assets/${name}.png`);}
for(const p of ['src/main.js','src/assets.js','src/style.css']){let s=fs.readFileSync('dist/'+p,'utf8').replace('const DEVELOPMENT = true;','const DEVELOPMENT = false;');if(sharp)s=s.replaceAll('.png','.webp');fs.writeFileSync('dist/'+p,s);}
const files=fs.readdirSync(out,{recursive:true}).map(p=>path.join(out,p)).filter(p=>fs.statSync(p).isFile());const size=files.reduce((n,p)=>n+fs.statSync(p).size,0);console.log(JSON.stringify({output:'dist/index.html',files:files.length,bytes:size,megabytes:(size/1048576).toFixed(2),format:sharp?'lossless WebP (same generated pixels)':'PNG',developmentHooks:false},null,2));
