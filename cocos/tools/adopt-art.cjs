// 将已经人工查看通过的独立生成素材复制到工程，源图与提示词留档。
const fs = require('fs'); const path = require('path');
const dir = path.resolve(__dirname, '../art/source');
const name = process.argv[2];
if (!/^[a-z0-9_]+$/.test(name || '')) throw new Error('Invalid asset identifier');
const spec = JSON.parse(fs.readFileSync(path.join(dir, name + '.source.json'), 'utf8'));
if (!spec.reviewed || spec.styleRejected || spec.styleApproved !== true || !spec.generatedPath || !spec.prompt) throw new Error('Asset needs structural and style review before adoption');
const generated = path.resolve(spec.generatedPath);
if (!generated.includes(path.join('.codex', 'generated_images'))) throw new Error('Unexpected image generation source');
const archive = path.join(dir, 'variants-style-20261102'); fs.mkdirSync(archive, { recursive: true });
for (const ext of ['.png', '.source.json']) {
 const old=path.join(dir,name+ext); if(fs.existsSync(old)) {
  const crypto=require('crypto');const hash=crypto.createHash('sha256').update(fs.readFileSync(old)).digest('hex').slice(0,12);
  const archived=path.join(archive,name+'-'+hash+ext);if(!fs.existsSync(archived))fs.copyFileSync(old,archived);
 }
}
fs.copyFileSync(generated, path.join(dir, name + '.png'));
const file = path.join(dir, 'manifest.json'); const manifest = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
manifest[name] = { file: name + '.png', edge: spec.edge || null, facing: spec.facing || 1, ...(typeof spec.pivot==='number'?{pivot:spec.pivot}:{}), trim: true, generator: 'builtin-imagegen', original: generated, review: spec.review, sourceRecord: name + '.source.json', styleApproved: true, styleRejected:false, reviewStatus:'approved-source-pending-engine' };
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
console.log('Adopted inspected image: ' + name);
