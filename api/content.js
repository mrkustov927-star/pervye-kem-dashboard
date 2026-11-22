const auth=require('../lib/viewer-access');
const repository=require('../lib/private-repository');
module.exports=async(req,res)=>{
  if(!auth.cors(req,res))return;
  if(req.method!=='GET')return auth.json(res,405,{ok:false,error:'Метод не поддерживается.'});
  const admin=auth.administrator(req);
  if(!admin&&!auth.viewer(req))return auth.json(res,401,{ok:false,error:'Войдите в кабинет.'});
  try{
    const data=await repository.loadData();
    const file=req.query?.file;
    if(file!==undefined){
      if(!repository.safeFile(file))return auth.json(res,400,{ok:false,error:'Неверный путь файла.'});
      const allowed=(admin?data.items||[]:(data.items||[]).filter(repository.publicItem)).flatMap(i=>i.attachments||[]);
      const attachment=allowed.find(a=>a.path===file||a.url==='/'+file);
      if(!attachment)return auth.json(res,404,{ok:false,error:'Файл не найден.'});
      const bytes=await repository.loadFile(file);
      res.setHeader('Content-Type','application/octet-stream');
      res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(attachment.name||file.split('/').pop()));
      res.status(200).end(bytes);return;
    }
    return auth.json(res,200,{ok:true,data:repository.publicData(data)});
  }catch(error){console.error('[private-content]',error.message);return auth.json(res,503,{ok:false,error:'Материалы временно недоступны. Попробуйте позже.'});}
};
