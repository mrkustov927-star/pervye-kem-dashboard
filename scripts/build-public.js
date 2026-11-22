const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'public');
const files=['index.html','styles.css','app.js','access.js','favicon.svg','pervye-logo.svg','admin/index.html','admin/admin.css','admin/admin.js'];
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of files){const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
fs.writeFileSync(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(out,'.nojekyll'),'');
for(const file of ['data.js','files','api','lib','README.md'])if(fs.existsSync(path.join(out,file)))throw new Error('Private file in public output: '+file);
console.log('Public interface built; private data and attachments excluded.');
