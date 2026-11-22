(()=>{
  const base=location.hostname.endsWith('github.io')?'https://pervye-kem-dashboard.vercel.app':location.origin;
  const status=document.querySelector('#status');
  window.planRequest=async(options={},query='')=>fetch(base+'/api/planner'+query,{...options,credentials:'omit',cache:'no-store',headers:{...(options.headers||{})}});
  async function open(){
    status.textContent='Загружаем задания трёх лиг…';
    const response=await window.planRequest({},'?catalog=1');
    if(!response.ok)throw Error('Не удалось загрузить каталог. Обновите страницу.');
    window.planCatalog=await response.json();
    const script=document.createElement('script');script.src='./planner.js';
    await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Не удалось загрузить планировщик.'));document.body.append(script)});
    document.querySelector('#gate').hidden=true;
    document.querySelector('#tools').hidden=false;
  }
  open().catch(error=>{status.textContent=error.message||'Ошибка загрузки.'});
})();