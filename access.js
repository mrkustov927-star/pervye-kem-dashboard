(()=>{
  const base='https://pervye-kem-dashboard.vercel.app';
  const version=new URL(document.currentScript.src).searchParams.get('v')||'development';
  const message=document.querySelector('#curatorMessage');
  const gate=document.querySelector('#curatorAccess');
  async function request(path,options={}){
    const response=await fetch(base+path,{...options,cache:'no-store',credentials:'omit'});
    if(!response.ok){let details={};try{details=await response.clone().json()}catch{}
      throw Error(details.error||'Не удалось загрузить данные. Повторите попытку позже.');}
    return response;
  }
  async function download(path){
    if(!/^\/files\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(path))throw Error('Неверная ссылка на файл.');
    const response=await request('/api/content?file='+encodeURIComponent(path.slice(1)));
    const blob=await response.blob(),url=URL.createObjectURL(blob);
    const encoded=(response.headers.get('Content-Disposition')||'').match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    let name=path.split('/').pop();try{if(encoded)name=decodeURIComponent(encoded)}catch{}
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const goHome=()=>{location.hash='#home'};
  window.DASHBOARD_ACCESS={download,logout:goHome};
  async function open(){
    const response=await request('/api/content');
    const result=await response.json();
    if(!result.ok)throw Error(result.error||'Ошибка загрузки.');
    window.DASHBOARD_DATA=result.data;
    const script=document.createElement('script');script.src='./app.js?v='+encodeURIComponent(version);
    await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Не удалось открыть кабинет.'));document.body.append(script)});
    gate.hidden=true;
    document.querySelectorAll('[data-curator-logout]').forEach(button=>{button.textContent='Выбор раздела';button.addEventListener('click',goHome)});
    window.DASHBOARD_PORTAL.open();
  }
  open().catch(error=>{message.textContent=error.message||'Нет связи с сервером. Обновите страницу.'});
})();