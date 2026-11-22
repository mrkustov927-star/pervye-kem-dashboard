const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'public');
const files=['index.html','styles.css','app.js','access.js','favicon.svg','pervye-logo.svg','admin/index.html','admin/admin.css','admin/admin.js'];
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of files){const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
const version=process.env.GITHUB_SHA||process.env.VERCEL_GIT_COMMIT_SHA||'development';
for(const file of ['index.html','admin/index.html']){
  const target=path.join(out,file);
  let html=fs.readFileSync(target,'utf8').replace(/((?:src|href)="(?:\.\/)?(?:styles\.css|access\.js|app\.js|admin\.css|admin\.js))(?:\?[^"\s]*)?"/g,(_,prefix)=>prefix+'?v='+encodeURIComponent(version)+'"');
  if(file==='index.html') html=html.replace('href="./planner/"','href="./planner/?v='+encodeURIComponent(version)+'"');
  fs.writeFileSync(target,html);
}
fs.writeFileSync(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(out,'.nojekyll'),'');
for(const file of ['data.js','files','api','lib','README.md'])if(fs.existsSync(path.join(out,file)))throw new Error('Private file in public output: '+file);
console.log('Public interface built; private data and attachments excluded.');
