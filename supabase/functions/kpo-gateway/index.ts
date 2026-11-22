// The competition server remains authoritative for passwords, editor permissions and revisions.
const site = 'https://mrkustov927-star.github.io';
const server = 'https://pervye-kem-dashboard.vercel.app';
const cors = {
  'Access-Control-Allow-Origin': site,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Planner-Editor, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Disposition, Retry-After',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Origin',
};
function fail(status:number, error:string){
  return Response.json({error}, {status,headers:cors});
}
Deno.serve(async req=>{
  const origin=req.headers.get('Origin');
  if(origin && origin!==site)return fail(403,'Этот источник не разрешён.');
  const url=new URL(req.url);
  const match=/\/kpo-gateway\/(planner|content)$/.exec(url.pathname);
  if(!match)return fail(404,'Страница не найдена.');
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='GET' && !(req.method==='POST' && match[1]==='planner'))return fail(405,'Метод не поддерживается.');
  const target=new URL('/api/'+match[1],server);
  for(const [key,value] of url.searchParams){
    if(!['login','file','handout','catalog'].includes(key))return fail(400,'Неизвестный параметр.');
    target.searchParams.set(key,value);
  }
  const headers=new Headers({Origin:site});
  for(const key of ['Authorization','X-Planner-Editor','Content-Type']){
    const value=req.headers.get(key);if(value)headers.set(key,value);
  }
  try{
    const upstream=await fetch(target,{method:req.method,headers,body:req.method==='POST'?req.body:null,redirect:'error',signal:AbortSignal.timeout(25000)});
    const result=new Headers(cors);
    for(const key of ['Content-Type','Content-Disposition','Retry-After']){
      const value=upstream.headers.get(key);if(value)result.set(key,value);
    }
    return new Response(upstream.body,{status:upstream.status,headers:result});
  }catch{return fail(502,'Сервер временно недоступен. Повторите попытку.');}
});
