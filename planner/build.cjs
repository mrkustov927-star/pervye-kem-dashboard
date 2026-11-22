const fs = require('node:fs');
const path = require('node:path');
const outdir = path.resolve(__dirname,'../public/planner');
fs.mkdirSync(outdir,{recursive:true});
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'entry.tsx')],outfile:path.join(outdir,'planner.js'),bundle:true,format:'iife',target:'es2022',jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"'}});
// Version the bootstrap, bundle and styles as one release, including local builds.
const crypto = require('node:crypto');
const login = fs.readFileSync(path.join(__dirname, 'login.js'), 'utf8');
const hash = crypto.createHash('sha256').update(login).update(fs.readFileSync(path.join(__dirname,'../connection.js')));
for (const file of ['planner.js', 'planner.css']) hash.update(fs.readFileSync(path.join(outdir, file)));
const version = hash.digest('hex').slice(0, 16);
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  .replace('../connection.js"', '../connection.js?v=' + version + '"')
  .replace('./planner.css"', './planner.css?v=' + version + '"')
  .replace('./login.js"', './login.js?v=' + version + '"');
fs.writeFileSync(path.join(outdir, 'index.html'), html);
fs.writeFileSync(path.join(outdir, 'login.js'), login.replace("'./planner.js'", "'./planner.js?v=" + version + "'"));

fs.writeFileSync(path.join(outdir,'connection.html'),fs.readFileSync(path.join(__dirname,'connection.html'),'utf8').replace('../connection.js"','../connection.js?v='+version+'"'));
fs.cpSync(path.join(__dirname,'guide'),path.join(outdir,'guide'),{recursive:true});
