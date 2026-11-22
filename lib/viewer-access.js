const crypto = require('node:crypto');
const SESSION_TTL = 12 * 60 * 60 * 1000;
const SITE_ORIGIN = 'https://mrkustov927-star.github.io';
const attempts = new Map();
function json(res,status,body){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.end(JSON.stringify(body));}
function cors(req,res){
  const origin=String(req.headers.origin||'');
  const self='https://'+String(req.headers.host||'');
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Origin');
  if(origin && origin!==SITE_ORIGIN && origin!==self){json(res,403,{ok:false,error:'Этот источник не разрешён.'});return false;}
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers','Content-Disposition');
  if(req.method==='OPTIONS'){res.status(204).end();return false;}
  return true;
}
function same(a,b){
  const digest=s=>crypto.createHash('sha256').update(String(s||'')).digest();
  return crypto.timingSafeEqual(digest(a),digest(b));
}
function signViewer(){
  if(!process.env.VIEWER_PASSWORD)throw new Error('Доступ не настроен.');
  const payload=Buffer.from(JSON.stringify({aud:'kpo-viewer-v1',exp:Date.now()+SESSION_TTL,nonce:crypto.randomBytes(12).toString('base64url')})).toString('base64url');
  const signature=crypto.createHmac('sha256',process.env.VIEWER_PASSWORD).update(payload).digest('base64url');
  return payload+'.'+signature;
}
function bearer(req){const auth=String(req.headers.authorization||'');return auth.startsWith('Bearer ')?auth.slice(7):'';}
function verify(token,secret,audience){
  if(!secret||typeof token!=='string'||token.length>1500)return false;
  const parts=token.split('.');if(parts.length!==2||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))return false;
  const [payload,signature]=parts;
  const expected=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
  if(!same(signature,expected))return false;
  try{const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return Number.isFinite(data.exp)&&data.exp>Date.now()&&data.exp<=Date.now()+SESSION_TTL+60000&&(!audience||data.aud===audience);}catch{return false;}
}
function viewer(req){return verify(bearer(req),process.env.VIEWER_PASSWORD,'kpo-viewer-v1');}
function administrator(req){return verify(bearer(req),process.env.ADMIN_PASSWORD);}
function passwordOK(value){return typeof value==='string'&&value.length<=300&&Boolean(process.env.VIEWER_PASSWORD)&&same(value,process.env.VIEWER_PASSWORD);}
function guard(req){
  const key=String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'unknown').split(',')[0].trim();
  const now=Date.now();
  for(const [id,r] of attempts)if(now-r.at>15*60*1000)attempts.delete(id);
  const rec=attempts.get(key);
  return {key,ok:!rec||rec.count<6,retryAfter:rec?Math.max(1,Math.ceil((rec.at+15*60*1000-now)/1000)):0};
}
function failed(key){const r=attempts.get(key)||{at:Date.now(),count:0};r.count++;attempts.set(key,r);if(attempts.size>5000)attempts.delete(attempts.keys().next().value);}
module.exports={json,cors,same,signViewer,bearer,verify,viewer,administrator,passwordOK,guard,failed,attempts,SESSION_TTL};
