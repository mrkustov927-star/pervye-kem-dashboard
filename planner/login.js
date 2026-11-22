(()=>{
  const sessionKey='kpoPlannerSession:v1', editorKey='kpoPlannerEditorLink:v1';
  const form=document.querySelector('#plannerLogin'), status=document.querySelector('#status');
  const actions=document.querySelector('#retryActions'), input=form.querySelector('input');
  let session='', editor='', started=false;
  function remember(key,value){try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key);}catch{}}
  try{session=sessionStorage.getItem(sessionKey)||'';editor=sessionStorage.getItem(editorKey)||'';}catch{}
  if(/^#edit=[A-Za-z0-9_-]{32,200}$/.test(location.hash)){
    editor=location.hash.slice(6);remember(editorKey,editor);
    history.replaceState(null,'',location.pathname+location.search);
  }
  const checkLink=document.querySelector('#checkLink');
  function ask(message){
    session='';remember(sessionKey,'');form.hidden=false;actions.hidden=true;status.textContent=message;
    if(started){document.querySelector('#planner').replaceChildren();location.reload();}else input.focus();
  }
  window.planRequest=async(options={},query='')=>{
    const headers=new Headers(options.headers);
    if(session)headers.set('Authorization','Bearer '+session);
    if(editor)headers.set('X-Planner-Editor',editor);
    const r=await window.kpoConnection.request('/planner'+query,{...options,headers,credentials:'omit',cache:'no-store'});
    if(r.status===401)ask('Для продолжения введите пароль конкурса.');
    return r;
  };
  async function open(){
    form.hidden=true;actions.hidden=true;status.textContent='Открываем план…';
    try{
      const r=await window.planRequest({},'?catalog=1');
      if(r.status===401)return;
      if(!r.ok)throw Error();
      window.planCatalog=await r.json();
      const script=document.createElement('script');script.src='./planner.js';
      await new Promise((ok,fail)=>{script.onload=ok;script.onerror=fail;document.body.append(script);});
      started=true;
      document.querySelector('#gate').hidden=true;document.querySelector('#tools').hidden=false;
      const payload=JSON.parse(atob(session.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));
      setTimeout(()=>ask('Срок входа истёк.'),Math.max(0,payload.exp-Date.now()));
    }catch{checkLink.hidden=false;status.textContent='Не удалось загрузить задания. Проверьте соединение.';actions.hidden=false;}
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();const btn=form.querySelector('button');btn.disabled=true;status.textContent='Проверяем пароль…';
    try{
      const r=await window.kpoConnection.request('/planner?login=1',{method:'POST',credentials:'omit',cache:'no-store',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({password:input.value})});
      const j=await r.json();
      if(!r.ok){checkLink.hidden=r.status<500;status.textContent=j.error||'Вход временно недоступен.';input.select();return;}
      session=j.token;remember(sessionKey,session);input.value='';await open();
    }catch{checkLink.hidden=false;status.textContent='Телефон не получил ответ при входе. Проверьте соединение по ссылке ниже.';}
    finally{btn.disabled=false;}
  });
  document.querySelector('#plannerLogout').onclick=()=>{remember(editorKey,'');ask('Вы вышли.');};
  document.querySelector('#retryPlanner').onclick=open;
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  if(session)open();else ask('');
})();
