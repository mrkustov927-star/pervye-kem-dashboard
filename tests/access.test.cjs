const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
process.env.VIEWER_PASSWORD='test-viewer-password-not-a-real-secret';
process.env.ADMIN_PASSWORD='test-administrator-password-separate';
process.env.PRIVATE_GITHUB_TOKEN='test-repository-token';
const auth=require('../lib/viewer-access');
const repository=require('../lib/private-repository');
const login=require('../api/access');
const content=require('../api/content');
const admin=require('../api/admin');
function res(){return {statusCode:200,headers:{},status(n){this.statusCode=n;return this;},setHeader(k,v){this.headers[k]=v;},end(value=''){this.body=value;return this;},json(){return JSON.parse(this.body);}};}
function req(method='GET',body,token,origin='https://mrkustov927-star.github.io'){return {method,body,query:{},headers:{origin,host:'pervye-kem-dashboard.vercel.app','x-forwarded-for':'192.0.2.1',...(token?{authorization:'Bearer '+token}:{})}};}
function adminToken(){const payload=Buffer.from(JSON.stringify({exp:Date.now()+3600000})).toString('base64url');return payload+'.'+crypto.createHmac('sha256',process.env.ADMIN_PASSWORD).update(payload).digest('base64url');}
const data={meta:{title:'Fixture'},items:[
 {id:'visible',type:'project',title:'Visible',attachments:[{name:'Guide.pdf',path:'files/visible/guide.pdf',url:'/files/visible/guide.pdf'}]},
 {id:'completed',status:'done',title:'Completed'},
 {id:'hidden',visible:false,attachments:[{path:'files/hidden/secret.pdf'}]},
 {id:'draft',status:'draft'},{id:'manual-archive',archived:true}
],documents:[{itemId:'visible'},{itemId:'hidden'},{url:'https://example.com'}]};
test.beforeEach(()=>auth.attempts.clear());
test('access fails closed when a password has not been configured',async()=>{
 const saved=process.env.VIEWER_PASSWORD;delete process.env.VIEWER_PASSWORD;
 try{const response=res();await login(req('POST',{password:'anything'}),response);assert.equal(response.statusCode,503);assert.equal(auth.viewer(req('GET',null,'forged')),false);}finally{process.env.VIEWER_PASSWORD=saved;}
});
test('anonymous requests cannot read data or download attachments',async()=>{
 for(const file of [undefined,'files/visible/guide.pdf']){const request=req();request.query={file};const response=res();await content(request,response);assert.equal(response.statusCode,401);assert.ok(!String(response.body).includes('Visible'));}
});
test('wrong passwords fail and correct passwords issue a verifiable session',async()=>{
 let response=res();await login(req('POST',{password:'wrong'}),response);assert.equal(response.statusCode,401);
 response=res();await login(req('POST',{password:process.env.VIEWER_PASSWORD}),response);assert.equal(response.statusCode,200);assert.equal(auth.viewer(req('GET',null,response.json().token)),true);
 assert.equal(response.headers['Cache-Control'],'private, no-store');
});
test('changing the viewer password invalidates existing sessions',()=>{
 const token=auth.signViewer(),saved=process.env.VIEWER_PASSWORD;
 try{process.env.VIEWER_PASSWORD='replacement';assert.equal(auth.viewer(req('GET',null,token)),false);}finally{process.env.VIEWER_PASSWORD=saved;}
});
test('tampered, expired, wrong-audience and malformed sessions are rejected',()=>{
 const token=auth.signViewer();assert.equal(auth.viewer(req('GET',null,token+'x')),false);assert.equal(auth.viewer(req('GET',null,token+'.extra')),false);
 for(const payload of [{aud:'kpo-viewer-v1',exp:Date.now()-1},{aud:'other',exp:Date.now()+60000},{aud:'kpo-viewer-v1',exp:Date.now()+864000000}]){
  const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');const signed=encoded+'.'+crypto.createHmac('sha256',process.env.VIEWER_PASSWORD).update(encoded).digest('base64url');assert.equal(auth.viewer(req('GET',null,signed)),false);
 }
});
test('viewer sessions cannot authenticate to the administrative editor',async()=>{
 const response=res();await admin(req('POST',{action:'read-data'},auth.signViewer()),response);assert.equal(response.statusCode,401);
 assert.equal(auth.administrator(req('GET',null,auth.signViewer())),false);
});
test('untrusted origins are rejected and preflight is restricted to the site origin',async()=>{
 let response=res();await login(req('POST',{password:process.env.VIEWER_PASSWORD},null,'https://untrusted.example'),response);assert.equal(response.statusCode,403);assert.equal(response.headers['Access-Control-Allow-Origin'],undefined);
 response=res();await content(req('OPTIONS'),response);assert.equal(response.statusCode,204);assert.equal(response.headers['Access-Control-Allow-Origin'],'https://mrkustov927-star.github.io');
});
test('repeated failed login attempts are temporarily limited',async()=>{
 for(let n=0;n<6;n++){const response=res();await login(req('POST',{password:'wrong'}),response);assert.equal(response.statusCode,401);}
 const response=res();await login(req('POST',{password:process.env.VIEWER_PASSWORD}),response);assert.equal(response.statusCode,429);assert.ok(Number(response.headers['Retry-After'])>0);
});
test('viewer payload includes completed public cards while excluding hidden records',()=>{
 const visible=repository.publicData(data);assert.deepEqual(visible.items.map(i=>i.id),['visible','completed']);assert.equal(visible.documents.length,2);
});
test('path traversal, nested encodings and arbitrary repository paths are rejected',()=>{
 for(const file of ['../data.js','data.js','files/visible/../data.js','files/a/%2e%2e%2fsecret.pdf','files/a/a.pdf?x=1','files/a/a.pdf/extra'])assert.equal(repository.safeFile(file),false,file);
 assert.equal(repository.safeFile('files/visible/guide.pdf'),true);
});
test('only referenced public attachments can be downloaded by a viewer',async()=>{
 const beforeData=repository.loadData,beforeFile=repository.loadFile;
 try{
  repository.loadData=async()=>data;repository.loadFile=async()=>Buffer.from('fixture-pdf');
  const token=auth.signViewer();let request=req('GET',null,token);request.query.file='files/hidden/secret.pdf';let response=res();await content(request,response);assert.equal(response.statusCode,404);
  request=req('GET',null,token);request.query.file='files/visible/guide.pdf';response=res();await content(request,response);assert.equal(response.statusCode,200);assert.equal(response.body.toString(),'fixture-pdf');assert.match(response.headers['Content-Disposition'],/Guide.pdf/);
 }finally{repository.loadData=beforeData;repository.loadFile=beforeFile;}
});
test('the administrator can load private records using the existing separate password',async()=>{
 const saved=global.fetch;
 try{
  global.fetch=async(url)=>{assert.match(url,/KPO2026-2027\/contents\/data.js/);return {ok:true,text:async()=>JSON.stringify({sha:'fixture',content:Buffer.from('window.DASHBOARD_DATA = '+JSON.stringify(data)+';').toString('base64')})};};
  const response=res();await admin(req('POST',{action:'read-data'},adminToken()),response);assert.equal(response.statusCode,200);assert.equal(response.json().data.items.length,data.items.length);
 }finally{global.fetch=saved;}
});
test('the public build contains no data file, attachments, or server implementation',()=>{
 const result=spawnSync(process.execPath,[path.join(root,'scripts/build-public.js')],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 for(const name of ['data.js','files','api','lib'])assert.equal(fs.existsSync(path.join(root,'public',name)),false,name);
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');assert.doesNotMatch(html,/<script[^>]+src=["'][^"']*data\.js/);assert.match(html,/access\.js/);assert.match(html,/id="dashboard" hidden/);
});
