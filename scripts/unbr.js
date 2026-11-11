const fs=require('fs'),z=require('zlib'),path=require('path');
const d=process.argv[2]; const idx=JSON.parse(fs.readFileSync(path.join(d,'index.json')));
let ok=0,f=0;
for(const e of idx){ if(e.enc!=='br') continue; const p=path.join(d,e.file);
 try{ fs.writeFileSync(p,z.brotliDecompressSync(fs.readFileSync(p))); e.enc='br-decoded'; ok++;}catch(x){f++;}}
fs.writeFileSync(path.join(d,'index.json'),JSON.stringify(idx,null,1)); console.log('br ok',ok,'fail',f);
