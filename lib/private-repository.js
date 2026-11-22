const OWNER=process.env.GITHUB_OWNER||'mrkustov927-star';
const REPO=process.env.PRIVATE_GITHUB_REPO||'KPO2026-2027';
const BRANCH=process.env.GITHUB_BRANCH||'main';
function encoded(path){return path.split('/').map(encodeURIComponent).join('/');}
async function request(path,raw=false){
  const token=process.env.PRIVATE_GITHUB_TOKEN||process.env.GITHUB_TOKEN;
  if(!token)throw new Error('Хранилище не настроено.');
  const response=await fetch('https://api.github.com/repos/'+OWNER+'/'+REPO+'/contents/'+encoded(path)+'?ref='+encodeURIComponent(BRANCH),{
    headers:{Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'},cache:'no-store'
  });
  if(!response.ok)throw new Error('Не удалось открыть приватное хранилище ('+response.status+').');
  return response;
}
async function loadData(){
  const file=await (await request('data.js')).json();
  const source=Buffer.from(file.content.replace(/\n/g,''),'base64').toString('utf8').trim();
  const prefix='window.DASHBOARD_DATA = ';
  if(!source.startsWith(prefix))throw new Error('Неверный формат данных.');
  return JSON.parse(source.slice(prefix.length).replace(/;\s*$/,''));
}
async function loadFile(path){return Buffer.from(await (await request(path,true)).arrayBuffer());}
const publicItem=i=>i.visible!==false&&i.status!=='draft'&&i.archived!==true;
function publicData(data){
  const items=(data.items||[]).filter(publicItem),ids=new Set(items.map(i=>i.id));
  return {...data,items,documents:(data.documents||[]).filter(d=>!d.itemId||ids.has(d.itemId))};
}
function safeFile(path){return typeof path==='string'&&/^files\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(path)&&!path.includes('..');}
module.exports={loadData,loadFile,publicData,publicItem,safeFile};
