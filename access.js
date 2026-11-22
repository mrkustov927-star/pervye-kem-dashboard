(()=>{
  const base='https://pervye-kem-dashboard.vercel.app';
  const key='pervyeCuratorSession:v1';
  const version=new URL(document.currentScript.src).searchParams.get('v')||'development';
  const form=document.querySelector('#curatorLogin');
  const message=document.querySelector('#curatorMessage');
  const login=document.querySelector('#curatorAccess');
  const dashboard=document.querySelector('#dashboard');
  let token='';
  try{token=sessionStorage.getItem(key)||'';}catch{}
  const forget=()=>{try{sessionStorage.removeItem(key);}catch{}token='';};
  const exit=()=>{forget();location.reload();};
  async function request(path,options={}){
    const response=await fetch(base+path,{...options,cache:'no-store',credentials:'omit',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(options.headers||{})}});
    if(response.status===401){forget();if(!dashboard.hidden)location.reload();throw new Error('Войдите в кабинет заново.');}
    return response;
  }
  async function download(path){
    if(!/^\/files\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(path))throw new Error('Неверная ссылка на файл.');
    const response=await request('/api/content?file='+encodeURIComponent(path.slice(1)));
    if(!response.ok)throw new Error('Не удалось скачать файл. Попробуйте позже.');
    const blob=await response.blob(),url=URL.createObjectURL(blob);
    const disposition=response.headers.get('Content-Disposition')||'';
    const encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    let name=path.split('/').pop();try{if(encoded)name=decodeURIComponent(encoded);}catch{}
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  window.DASHBOARD_ACCESS={download,logout:exit};
  async function open(){
    const response=await request('/api/content');
    const result=await response.json();
    if(!response.ok||!result.ok)throw new Error(result.error||'Не удалось загрузить материалы.');
    window.DASHBOARD_DATA=result.data;
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./app.js?v='+encodeURIComponent(version);script.onload=resolve;script.onerror=()=>reject(new Error('Не удалось открыть кабинет. Обновите страницу.'));document.body.append(script);});
    login.hidden=true;dashboard.hidden=false;
    window.dispatchEvent(new Event("resize"));
    document.querySelector('#curatorLogout').addEventListener('click',exit);
    const hash=location.hash;if(/^#[a-z-]+$/.test(hash))document.querySelector(hash)?.scrollIntoView();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('button');button.disabled=true;message.textContent='Проверяем доступ…';
    try{
      const response=await fetch(base+'/api/access',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:form.elements.password.value})});
      const result=await response.json();
      if(!response.ok||!result.token)throw new Error(result.error||'Не удалось войти.');
      token=result.token;try{sessionStorage.setItem(key,token);}catch{}form.elements.password.value='';
      await open();
    }catch(error){message.textContent=error.message||'Не удалось связаться с сервером. Попробуйте ещё раз.';}finally{button.disabled=false;}
  });
  if(token){message.textContent='Открываем кабинет…';open().catch(error=>{message.textContent=error.message;});}
})();
