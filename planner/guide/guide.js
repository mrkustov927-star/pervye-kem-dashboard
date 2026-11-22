(()=>{
  const $=id=>document.getElementById(id);
  let data, tasks;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const para=(node,text)=>{if(text)node.append(el('p',text));};
  function list(node,title,values){
    if(!values?.length)return;
    node.append(el('h3',title));const ul=el('ul');
    for(const value of values)ul.append(el('li',value));
    node.append(ul);
  }
  function options(id,values){$(id).replaceChildren(...values.map(([value,label])=>new Option(label,value)));}
  function chooseLeague(){
    const league=$('league').value;
    tasks=data.tasks.filter(t=>t.league===league || (league==='pl'&&t.league==='lv')).sort((a,b)=>a.number-b.number || (a.league==='pl'?-1:1));
    options('task',tasks.map(t=>[t.key,'№ '+t.number+' · '+t.title+(league==='pl'&&t.key==='lv-15'?' (замена по п. 16.4)':'')]));
    chooseTask();
  }
  function currentTask(){return tasks.find(t=>t.key===$('task').value);}
  function chooseTask(){options('variant',currentTask().variants.map((v,i)=>[v.id,(i+1)+'. '+v.title]));render();}
  function render(){
    const t=currentTask(),v=t.variants.find(v=>v.id===$('variant').value),r=data.checklists.find(r=>r.key===t.key&&r.variantId===v.id);
    const node=$('detail');node.replaceChildren();
    para(node,$('league').selectedOptions[0].text+' · Задание № '+t.number+' · До '+t.points+' баллов');
    node.append(el('h2',v.title));para(node,v.specific);
    const dates=el('p','Первичка ____________________   Начало __________   Завершение __________   Сдача __________');dates.className='print-fields';node.append(dates);
    if($('league').value==='pl'&&t.key==='lv-15')para(node,'Замена по п. 16.4 при отказе подшефной команды. Обоснуйте замену в комментарии к отчёту.');
    if(v.needsAnnouncement)para(node,'Опубликуйте анонс минимум за один календарный день до события.');
    para(node,r.special);para(node,r.alternative);
    for(const section of r.sections){
      node.append(el('h3',section.title));const ol=el('ol');
      for(const item of section.items){
        const li=el('li');li.append(el('strong',item.label));para(li,item.detail);para(li,item.method);
        if(item.evidence)para(li,'Что подготовить — '+item.evidence);ol.append(li);
      }node.append(ol);
    }
    list(node,'Что приложить к отчёту',v.reports.map(x=>x.label));
    if(v.tags?.length)para(node,v.tags.join(' '));
    list(node,'Что нужно для максимального балла',r.criteria.map(c=>c.title+' · до '+c.maxPoints+' б. '+c.topLevel));
    list(node,'За что можно потерять баллы',r.pitfalls);
    if(r.materials?.length){node.append(el('h3','Материалы к заданию'));for(const [title,url] of r.materials){if(!/^https:\/\//i.test(url))continue;const a=el('a',title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';const p=el('p');p.append(a);node.append(p);}}
    para(node,'Порядок выполнения заданий, с. '+r.sourcePages.join(', ')+'.');
  }
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
    try{data=await decode($('password').value.trim());chooseLeague();$('password').value='';$('gate').hidden=true;$('catalog').hidden=false;$('league').focus();}
    catch(err){$('status').textContent=err.message||'Не удалось открыть материалы.';}
    finally{btn.disabled=false;}
  };
  $('league').onchange=chooseLeague;$('task').onchange=chooseTask;$('variant').onchange=render;
  $('leave').onclick=()=>location.reload();$('print').onclick=()=>window.print();
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
})();
