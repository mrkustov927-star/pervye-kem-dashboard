import {mountChecklists, showVariant, leagueTasks} from './checklist-reader.js';
(()=>{
  const $=id=>document.getElementById(id);
  let data, tasks;
  function options(id,values){$(id).replaceChildren(...values.map(([value,label])=>new Option(label,value)));}
  function chooseLeague(){
    const league=$('league').value;
    tasks=leagueTasks(data.tasks,league);
    options('task',tasks.map(t=>[t.key,'№ '+t.number+' · '+t.title+(league==='pl'&&t.key==='lv-15'?' (замена по п. 16.4)':'')]));
    chooseTask();
  }
  function currentTask(){return tasks.find(t=>t.key===$('task').value);}
  function chooseTask(){options('variant',currentTask().variants.map((v,i)=>[v.id,(i+1)+'. '+v.title]));render();}
  function render(){
    const t=currentTask(),v=t.variants.find(v=>v.id===$('variant').value),r=data.checklists.find(r=>r.key===t.key&&r.variantId===v.id);
    showVariant($('detail'), $('league').value, t, v, r);
  }
  function switchSection() {
    const checklists = location.hash === '#checklists';
    $('assignments').hidden = checklists;
    $('checklists').hidden = !checklists;
    for(const link of $('sections').querySelectorAll('a')){
      if(link.hash === (checklists ? '#checklists' : '#assignments')) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
    $('pageTitle').textContent = checklists ? 'Чек-листы' : 'Задания общего зачёта';
    document.title = $('pageTitle').textContent + ' · Конкурс первичек';
  }
  window.addEventListener('hashchange', switchSection);
  switchSection();
  async function decode(password){
    const response=await fetch('./catalog-v1.txt');if(!response.ok)throw Error('Не удалось скачать материалы с GitHub. Обновите страницу.');
    const bytes=Uint8Array.from(atob(await response.text()),c=>c.charCodeAt(0));
    const enc=new TextEncoder(),keys=crypto.subtle;
    const material=await keys.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
    const key=await keys.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes.slice(0,16),iterations:600000},material,{name:'AES-GCM',length:256},false,['decrypt']);
    let plain;
    try{plain=await keys.decrypt({name:'AES-GCM',iv:bytes.slice(16,28),additionalData:enc.encode('kpo-guide-v1')},key,bytes.slice(28));}
    catch{throw Error('Пароль не подошёл. Проверьте его и попробуйте снова.');}
    const stream=new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).json();
  }
  document.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const btn=e.target.querySelector('button');btn.disabled=true;$('status').textContent='Открываем задания…';
    try{data=await decode($('password').value.trim());chooseLeague();mountChecklists($('checklists'),data,$('league').value);$('password').value='';$('gate').hidden=true;$('catalog').hidden=false;if(location.hash==='#checklists') $('checklists').querySelector('button').focus(); else $('league').focus();}
    catch(err){$('status').textContent=err.message||'Не удалось открыть материалы.';}
    finally{btn.disabled=false;}
  };
  $('league').onchange=chooseLeague;$('task').onchange=chooseTask;$('variant').onchange=render;
  $('leave').onclick=()=>location.reload();$('print').onclick=()=>window.print();
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
})();
