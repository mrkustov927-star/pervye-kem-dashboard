(()=>{
  const version=new URL(document.currentScript.src).searchParams.get('v')||'development';
  const message=document.querySelector('#curatorMessage');
  const gate=document.querySelector('#curatorAccess');
  function isContest(){return location.hash==='#primary'||new URLSearchParams(location.search).get('card')==='primary-contest';}
  const contest=isContest();
  let session='';
  if(contest){try{session=sessionStorage.getItem('kpoPlannerSession:v1')||'';}catch{}}
  const goToLogin=()=>location.replace('./planner/');
  if(contest&&!session){goToLogin();return;}
  window.addEventListener('hashchange',()=>{if(contest!==isContest())location.reload();});
  window.addEventListener('pageshow',e=>{if(contest&&e.persisted)location.reload();});
  if(contest){
    try{
      const payload=JSON.parse(atob(session.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));
      setTimeout(goToLogin,Math.max(0,payload.exp-Date.now()));
    }catch{goToLogin();return;}
  }
  async function request(path,options={}){
    const response=await window.kpoConnection.request(path,{...options,headers:session?{Authorization:'Bearer '+session}:{}});
    if(contest&&response.status===401){goToLogin();throw Error();}
    if(!response.ok){let details={};try{details=await response.clone().json()}catch{}
      throw Error(details.error||'Не удалось загрузить данные. Повторите попытку позже.');}
    return response;
  }
  async function download(path){
    if(!/^\/files\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(path))throw Error('Неверная ссылка на файл.');
    const response=await request('/content?file='+encodeURIComponent(path.slice(1)));
    const blob=await response.blob(),url=URL.createObjectURL(blob);
    const encoded=(response.headers.get('Content-Disposition')||'').match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    let name=path.split('/').pop();try{if(encoded)name=decodeURIComponent(encoded)}catch{}
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const goHome=()=>{location.hash='#home'};
  window.DASHBOARD_ACCESS={download,logout:goHome};
  async function open(){
    const response=await request('/content');
    const result=await response.json();
    if(!result.ok)throw Error(result.error||'Ошибка загрузки.');
    window.DASHBOARD_DATA=result.data;
    const script=document.createElement('script');script.src='./app.js?v='+encodeURIComponent(version);
    await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Не удалось открыть кабинет.'));document.body.append(script)});
    gate.hidden=true;
    window.DASHBOARD_PORTAL.open();
  }
  const recovery=document.querySelector('#loadRecovery');
  function loadContent(){
    recovery.hidden=true;
    message.textContent='Загружаем опубликованные материалы.';
    return open().catch(()=>{message.textContent='Пока не удалось загрузить календарь и материалы.';recovery.hidden=false;});
  }
  document.querySelector('#retryContent').addEventListener('click',loadContent);
  const picker=document.querySelector('#workspacePicker');
  const isHome=()=>!new URLSearchParams(location.search).has('card')&&(!location.hash||location.hash==='#home');
  let pending=false;
  function navigate(){
    if(window.DASHBOARD_PORTAL)return;
    if(isHome()){gate.hidden=true;picker.hidden=false;return;}
    picker.hidden=true;gate.hidden=false;
    if(!pending){pending=true;loadContent().finally(()=>{pending=false;});}
  }
  window.addEventListener('hashchange',navigate);
  navigate();
})();