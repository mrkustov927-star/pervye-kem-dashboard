const fs = require('node:fs');
const path = require('node:path');
const outdir = path.resolve(__dirname,'../public/planner');
fs.mkdirSync(outdir,{recursive:true});
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'entry.tsx')],outfile:path.join(outdir,'planner.js'),bundle:true,format:'iife',target:'es2022',jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"'}});
for (const file of ['index.html','login.js','ded-plan.html']) fs.copyFileSync(path.join(__dirname,file),path.join(outdir,file));
