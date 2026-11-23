(()=>{
  const version=new URL(document.currentScript.src).searchParams.get('v')||'development';
  const message=document.querySelector('#curatorMessage');
  const gate=document.querySelector('#curatorAccess');
  function followSection() {
    if(location.hash==='#home') {location.replace('./');return true;}
    if(location.hash==='#primary'||new URLSearchParams(location.search).get('card')==='primary-contest') {
      location.replace('./planner/guide/?v=open2');return true;
    }
    return false;
  }
  if(followSection()) return;
  window.addEventListener('hashchange',followSection);
  async function request(path,options={}){
    const response=await window.kpoConnection.request(path,options);
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
  const goHome=()=>location.assign('./');
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
  gate.hidden=false;
  loadContent();
})();
