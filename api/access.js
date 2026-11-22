const auth=require('../lib/viewer-access');
module.exports=async(req,res)=>{
  if(!auth.cors(req,res))return;
  if(req.method!=='POST')return auth.json(res,405,{ok:false,error:'Используйте форму входа.'});
  if(!process.env.VIEWER_PASSWORD)return auth.json(res,503,{ok:false,error:'Доступ ещё не настроен.'});
  const guard=auth.guard(req);
  if(!guard.ok){res.setHeader('Retry-After',String(guard.retryAfter));return auth.json(res,429,{ok:false,error:'Слишком много попыток. Попробуйте через 15 минут.'});}
  const body=req.body||{};
  if(!auth.passwordOK(body.password)){auth.failed(guard.key);return auth.json(res,401,{ok:false,error:'Неверный пароль.'});}
  auth.attempts.delete(guard.key);
  return auth.json(res,200,{ok:true,token:auth.signViewer(),expiresAt:Date.now()+auth.SESSION_TTL});
};
