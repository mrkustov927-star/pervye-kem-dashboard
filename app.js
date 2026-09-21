(()=> {
  const D=window.DASHBOARD_DATA;
  const items=D.items;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const now=new Date(); now.setHours(12,0,0,0);
  const monthNames=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const monthShort=["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  let taskFilter="all";
  let projectFilter="all";
  let calendarMonth="2026-09";
  let lastFocused=null;

  const parseDate=d=>d?new Date(d+"T12:00:00+03:00"):null;
  const days=d=>Math.ceil((parseDate(d)-now)/86400000);
  const endDate=i=>{const ds=[i.start,i.deadline,i.eventDate,i.reportDeadline].map(parseDate).filter(Boolean);return ds.length?new Date(Math.max(...ds.map(d=>d.getTime()))):null;};
  const expired=i=>i.status==="done"||(endDate(i)&&endDate(i)<now);
  const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const fmt=d=>{const x=parseDate(d);return x?x.getDate()+" "+monthNames[x.getMonth()]:"Срок уточняется"};
  const fmtShort=d=>{const x=parseDate(d);return x?x.getDate()+" "+monthShort[x.getMonth()]:"—"};
  const typeLabel={task:"Задача",project:"Проект",action:"Акция",event:"Событие",info:"Информация"};

  function deadlineLabel(i){
    if(!i.deadline) return "Срок уточняется";
    const d=days(i.deadline);
    if(d===0) return "Сегодня";
    if(d===1) return "Завтра";
    return "До "+fmt(i.deadline);
  }

  function badgeMarkup(i){
    return (i.badges||[]).slice(0,2).map(b=>{
      let c="";
      if(/сроч/i.test(b)) c="urgent";
      else if(/нов/i.test(b)) c="new";
      else if(/отч/i.test(b)) c="report";
      else if(/идёт/i.test(b)) c="active";
      else if(i.priority==="high") c="high";
      return '<span class="badge '+c+'">'+esc(b)+'</span>';
    }).join("");
  }

  function renderHero(){
    const active=items.filter(i=>!expired(i)&&["task","project","action","event"].includes(i.type));
    const week=active.filter(i=>i.deadline&&days(i.deadline)>=0&&days(i.deadline)<=7).length;
    const reports=active.filter(i=>(i.deliverables||[]).length||(i.badges||[]).some(b=>/отч/i.test(b))).length;
    const october=active.filter(i=>(i.start||i.deadline||"").startsWith("2026-10")).length;
    $("#heroStats").innerHTML=
      '<div class="hero-stat"><b>'+week+'</b><span>дедлайнов на 7 дней</span></div>'+
      '<div class="hero-stat"><b>'+reports+'</b><span>задач с отчётностью</span></div>'+
      '<div class="hero-stat"><b>'+october+'</b><span>активностей октября</span></div>';
    const priorityRank={urgent:0,high:1,normal:2};
    const upcoming=active.filter(i=>i.deadline&&days(i.deadline)>=0)
      .sort((a,b)=>(priorityRank[a.priority]??2)-(priorityRank[b.priority]??2)||parseDate(a.deadline)-parseDate(b.deadline))
      .slice(0,3);
    const updated=new Date(D.meta.updatedAt);
    const updatedText="Обновлено "+updated.toLocaleDateString("ru-RU",{day:"numeric",month:"long"})+" в "+updated.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
    $("#updatedStamp").textContent=updatedText;
    $("#heroUpdated").textContent=updatedText+". Новые уточнения фиксируются в журнале изменений.";
    $("#heroMiniList").innerHTML=upcoming.map(i=>{
      const d=parseDate(i.deadline);
      return '<button class="hero-mini-card" data-open="'+i.id+'"><span class="mini-date '+(i.priority==="urgent"?"urgent":"")+'"><b>'+d.getDate()+'</b><small>'+monthShort[d.getMonth()]+'</small></span><span class="mini-info"><small>'+esc(i.category)+'</small><b>'+esc(i.title)+'</b><em>'+esc(deadlineLabel(i))+'</em></span><span class="mini-arrow">→</span></button>';
    }).join("");
  }

  function renderTasks(){
    const filters=[["all","Все"],["urgent","Срочно"],["high","Высокий приоритет"],["report","Нужен отчёт"],["schools","Для школ"]];
    $("#taskFilters").innerHTML=filters.map(f=>'<button class="filter-btn '+(taskFilter===f[0]?"active":"")+'" data-task-filter="'+f[0]+'">'+f[1]+'</button>').join("");
    let list=items.filter(i=>!expired(i)&&(i.type==="task"||(i.type==="project"&&(i.deadline||i.status==="active"||i.status==="new"))));
    if(taskFilter==="urgent") list=list.filter(i=>i.priority==="urgent");
    if(taskFilter==="high") list=list.filter(i=>["urgent","high"].includes(i.priority));
    if(taskFilter==="report") list=list.filter(i=>(i.deliverables||[]).length||(i.badges||[]).some(b=>/отч/i.test(b)));
    if(taskFilter==="schools") list=list.filter(i=>(i.audience||[]).includes("schools"));
    list.sort((a,b)=>(parseDate(a.deadline)||new Date(2100,0))-(parseDate(b.deadline)||new Date(2100,0)));
    $("#taskList").innerHTML=list.map(i=>{
      const d=i.deadline?parseDate(i.deadline):null;
      return '<button class="task-card '+(i.priority==="urgent"?"urgent":i.priority==="high"?"high":"")+'" data-open="'+i.id+'"><span class="task-top"><span class="task-date"><b>'+(d?d.getDate():"—")+'</b><small>'+(d?monthShort[d.getMonth()]:"срок")+'</small></span><span class="task-status">'+esc(deadlineLabel(i))+'</span></span><small class="task-category">'+esc(i.category)+'</small><h3>'+esc(i.title)+'</h3><p>'+esc(i.short)+'</p><span class="task-bottom"><span>'+esc(typeLabel[i.type])+'</span><strong>Подробнее →</strong></span></button>';
    }).join("")||'<div class="empty">В этой категории пока ничего нет.</div>';
  }

  function renderProjects(){
    const filters=[["all","Все"],["action","Акции"],["project","Проекты"],["event","События"],["upcoming","Скоро"],["active","Идёт сейчас"]];
    $("#projectFilters").innerHTML=filters.map(f=>'<button class="filter-btn '+(projectFilter===f[0]?"active":"")+'" data-project-filter="'+f[0]+'">'+f[1]+'</button>').join("");
    let list=items.filter(i=>!expired(i)&&["action","project","event","info"].includes(i.type));
    if(["action","project","event"].includes(projectFilter)) list=list.filter(i=>i.type===projectFilter);
    if(projectFilter==="upcoming") list=list.filter(i=>["upcoming","soon","new"].includes(i.status));
    if(projectFilter==="active") list=list.filter(i=>i.status==="active");
    list.sort((a,b)=>(parseDate(a.start||a.deadline)||new Date(2100,0))-(parseDate(b.start||b.deadline)||new Date(2100,0)));
    const icons={action:"✦",project:"◇",event:"◉",info:"i"};
    $("#projectList").innerHTML=list.map(i=>{
      const start=i.start?fmt(i.start):"";
      const end=i.deadline?fmt(i.deadline):"";
      const secondary=i.reportDeadline?"публикация до "+fmt(i.reportDeadline):(end&&end!==start?"до "+end:deadlineLabel(i));
      return '<button class="project-card '+i.type+'" data-open="'+i.id+'"><span class="project-kicker"><span class="project-icon">'+icons[i.type]+'</span><span class="project-dates">'+esc(start)+'<small>'+esc(secondary)+'</small></span></span><small class="project-category">'+esc(i.category)+'</small><h3>'+esc(i.title)+'</h3><p>'+esc(i.short)+'</p><span class="project-bottom"><span>'+esc(typeLabel[i.type])+'</span><strong>Подробнее →</strong></span></button>';
    }).join("")||'<div class="empty">Ничего не найдено.</div>';
  }

  function renderCalendar(){
    const months=[["2026-09","Сентябрь"],["2026-10","Октябрь"],["2026-11","Ноябрь"]];
    $("#calendarMonths").innerHTML=months.map(m=>'<button class="'+(calendarMonth===m[0]?"active":"")+'" data-month="'+m[0]+'">'+m[1]+'</button>').join("");
    const ym=calendarMonth.split("-").map(Number),y=ym[0],m=ym[1];
    const first=new Date(y,m-1,1);
    const start=(first.getDay()+6)%7;
    const events=[];
    items.forEach(i=>["start","deadline","eventDate","reportDeadline"].forEach(k=>{
      if(i[k]&&i[k].startsWith(calendarMonth)) events.push({date:i[k],item:i,kind:k});
    }));
    events.sort((a,b)=>parseDate(a.date)-parseDate(b.date));
    let html=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=>'<div class="calendar-weekday">'+x+'</div>').join("");
    for(let z=0;z<42;z++){
      const n=z-start+1;
      const d=new Date(y,m-1,n);
      const iso=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
      const outside=d.getMonth()!==m-1;
      const todayIso=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
      const dayEvents=events.filter(e=>e.date===iso).slice(0,3);
      html+='<div class="calendar-day '+(outside?"outside ":"")+(iso===todayIso?"today":"")+'"><span class="day-num">'+d.getDate()+'</span><div class="day-events">'+dayEvents.map(e=>{const label=e.kind==="deadline"?"Дедлайн":e.kind==="reportDeadline"?"Отчёт":e.kind==="eventDate"?"Событие":"Старт";return '<button class="day-event '+(e.kind==="deadline"||e.kind==="reportDeadline"?"urgent":e.kind==="eventDate"?"event":"start")+'" data-open="'+e.item.id+'"><span>'+label+'</span>'+esc(e.item.title)+'</button>'}).join("")+'</div></div>';
    }
    $("#calendarGrid").innerHTML=html;
    $("#calendarAgenda").innerHTML=events.map(e=>{
      const d=parseDate(e.date);
      return '<button class="agenda-mobile-card" data-open="'+e.item.id+'"><span class="agenda-mobile-date '+(e.kind==="deadline"||e.kind==="reportDeadline"?"urgent":"")+'"><b>'+d.getDate()+'</b><small>'+monthShort[d.getMonth()]+'</small></span><span class="agenda-mobile-copy"><small>'+esc(e.item.category)+'</small><b>'+esc(e.item.title)+'</b><span>'+esc(e.kind==="deadline"?"Дедлайн":e.kind==="reportDeadline"?"Отчёт":e.kind==="eventDate"?"Событие":"Старт")+'</span></span></button>';
    }).join("");
  }

  function renderDocs(){
    $("#docsList").innerHTML=D.documents.map(d=>'<article class="doc-card"><div class="doc-icon">'+(d.kind==="Курс"?"▶":d.kind==="Источник"?"PDF":"↗")+'</div><div><small>'+esc(d.kind)+'</small><h3>'+esc(d.title)+'</h3><p>'+esc(d.description)+'</p>'+(d.url?'<a href="'+d.url+'" target="_blank" rel="noopener">Открыть →</a>':'<button data-toast="Источник сохранён в рабочей базе.">Источник в базе</button>')+'</div></article>').join("");
  }

  function renderUpdates(selector,limit=99){
    $(selector).innerHTML=D.updates.slice(0,limit).map(u=>{
      const d=new Date(u.date);
      return '<div class="update-item"><div class="update-time">'+d.toLocaleDateString("ru-RU",{day:"numeric",month:"long"})+' · '+d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})+'</div><strong>'+esc(u.title)+'</strong><p>'+esc(u.text)+'</p></div>';
    }).join("");
  }

  function renderArchive(){
    const list=items.filter(expired).sort((a,b)=>(endDate(b)||parseDate(b.start))-(endDate(a)||parseDate(a.start)));
    $("#archiveList").innerHTML=list.map(i=>'<button class="archive-card" data-open="'+i.id+'"><b>'+esc(i.title)+'</b><span>'+esc(i.category)+' · '+esc(i.deadline?fmt(i.deadline):"завершено")+'</span></button>').join("")||'<div class="empty">Архив пока пуст.</div>';
  }

  function openModal(id){
    const i=items.find(x=>x.id===id); if(!i)return;
    let detail="";
    if(i.steps&&i.steps.length) detail+='<section class="detail-section"><h3>Что нужно сделать</h3><div class="steps">'+i.steps.map((s,n)=>'<div class="step"><b>'+(n+1)+'</b><p>'+esc(s)+'</p></div>').join("")+'</div></section>';
    if(i.formats&&i.formats.length) detail+='<section class="detail-section"><h3>Форматы участия</h3><div class="steps">'+i.formats.map((s,n)=>'<div class="step"><b>'+(n+1)+'</b><p>'+esc(s)+'</p></div>').join("")+'</div></section>';
    if(i.deliverables&&i.deliverables.length) detail+='<section class="detail-section"><h3>Что сдаём</h3>'+i.deliverables.map(x=>'<p>✓ '+esc(x)+'</p>').join("")+'</section>';
    if(i.hashtags&&i.hashtags.length) detail+='<section class="detail-section"><h3>Хештеги</h3><p>'+i.hashtags.map(esc).join(" ")+'</p><div class="detail-actions"><button data-copy-hashtags="'+i.id+'">Скопировать хештеги</button></div></section>';
    if(i.hashtagsByOrg&&i.hashtagsByOrg.length) detail+='<section class="detail-section"><h3>Хештеги первичек</h3>'+i.hashtagsByOrg.map(x=>'<p>'+esc(x)+'</p>').join("")+'<div class="detail-actions"><button data-copy-hashtags="'+i.id+'">Скопировать список</button></div></section>';
    if(i.notes&&i.notes.length) detail+='<section class="detail-section"><h3>Важно</h3>'+i.notes.map(x=>'<p>'+esc(x)+'</p>').join("")+'</section>';
    const links=[...(i.links||[]),...(i.materials||[])];
    if(links.length||i.copyText) detail+='<section class="detail-section"><h3>Действия</h3><div class="detail-actions">'+links.map((l,n)=>'<a class="'+(n===0?"primary":"")+'" href="'+l.url+'" target="_blank" rel="noopener">'+esc(l.label)+' ↗</a>').join("")+(i.copyText?'<button data-copy="'+i.id+'">Скопировать инструкцию</button>':"")+'</div></section>';
    detail+='<section class="detail-section"><h3>Источник</h3><p>'+esc(i.source||"Рабочие материалы")+'</p></section>';
    const dateTags='<span class="tag">'+esc(i.category)+'</span><span class="tag">'+esc(deadlineLabel(i))+'</span>'+(i.reportDeadline?'<span class="tag report-tag">Публикация до '+esc(fmt(i.reportDeadline))+'</span>':"");
    $("#modalContent").innerHTML='<div class="modal-kicker"><span class="badge">'+esc(typeLabel[i.type]||i.type)+'</span>'+badgeMarkup(i)+'</div><h2 id="modalTitle">'+esc(i.title)+'</h2><p class="modal-summary">'+esc(i.short)+'</p><div class="modal-kicker">'+dateTags+'</div>'+detail;
    lastFocused=document.activeElement;
    $("#detailModal").hidden=false;
    document.body.style.overflow="hidden";
    requestAnimationFrame(()=>$(".modal-close").focus());
  }

  function closeModal(){ const modal=$("#detailModal"); if(!modal.hidden){modal.hidden=true;document.body.style.overflow="";if(lastFocused&&lastFocused.focus)lastFocused.focus();} }
  function toast(t){ const el=$("#toast"); el.textContent=t; el.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),1800); }

  async function copyItem(id,hashtags=false){
    const i=items.find(x=>x.id===id); if(!i)return;
    const text=hashtags?(i.hashtagsByOrg||i.hashtags||[]).join(i.hashtagsByOrg?"\n":" "):(i.copyText||i.short||i.title);
    try{ await navigator.clipboard.writeText(text); toast("Скопировано"); }catch{ toast("Не удалось скопировать"); }
  }

  function doSearch(q){
    q=q.trim().toLowerCase();
    const panel=$("#searchPanel");
    if(!q){panel.hidden=true;panel.innerHTML="";return}
    const resItems=items.filter(i=>[i.title,i.short,i.category,i.source,...(i.steps||[]),...(i.hashtags||[])].join(" ").toLowerCase().includes(q)).slice(0,6);
    const resDocs=D.documents.filter(d=>[d.title,d.description,d.kind].join(" ").toLowerCase().includes(q)).slice(0,4);
    const itemHtml=resItems.map(i=>'<button class="search-result" data-open="'+i.id+'"><strong>'+esc(i.title)+'</strong><span>'+esc(i.category||typeLabel[i.type])+'</span></button>').join("");
    const docHtml=resDocs.map(d=>d.url?'<a class="search-result" href="'+d.url+'" target="_blank" rel="noopener"><strong>'+esc(d.title)+'</strong><span>'+esc(d.kind)+' · документ</span></a>':'<button class="search-result" data-toast="Документ сохранён в рабочей базе."><strong>'+esc(d.title)+'</strong><span>'+esc(d.kind)+' · источник</span></button>').join("");
    panel.innerHTML='<strong>Результаты поиска</strong><div class="search-results">'+(itemHtml+docHtml||'<span>Ничего не найдено</span>')+'</div>';
    panel.hidden=false;
  }

  document.addEventListener("click",e=>{
    let x=e.target.closest("[data-open]"); if(x){openModal(x.dataset.open);return}
    x=e.target.closest("[data-task-filter]"); if(x){taskFilter=x.dataset.taskFilter;renderTasks();return}
    x=e.target.closest("[data-project-filter]"); if(x){projectFilter=x.dataset.projectFilter;renderProjects();return}
    x=e.target.closest("[data-month]"); if(x){calendarMonth=x.dataset.month;renderCalendar();return}
    x=e.target.closest("[data-close-modal]"); if(x){closeModal();return}
    x=e.target.closest("[data-close-drawer]"); if(x){$("#updatesDrawer").hidden=true;document.body.style.overflow="";if(lastFocused&&lastFocused.focus)lastFocused.focus();return}
    x=e.target.closest("[data-copy-hashtags]"); if(x){copyItem(x.dataset.copyHashtags,true);return}
    x=e.target.closest("[data-copy]"); if(x){copyItem(x.dataset.copy);return}
    x=e.target.closest("[data-toast]"); if(x){toast(x.dataset.toast);return}
    if(!e.target.closest(".search-panel")&&!e.target.closest(".search-wrap")) $("#searchPanel").hidden=true;
  });

  const openUpdates=()=>{lastFocused=document.activeElement;renderUpdates("#drawerUpdates");$("#updatesDrawer").hidden=false;document.body.style.overflow="hidden";requestAnimationFrame(()=>$(".drawer-head button").focus())};
  $("#updatesButton").onclick=openUpdates;
  $("#openAllUpdates").onclick=openUpdates;
  $("#globalSearch").oninput=e=>doSearch(e.target.value);
  document.addEventListener("keydown",e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#globalSearch").focus()}
    if(e.key==="Escape"){closeModal();$("#updatesDrawer").hidden=true;$("#searchPanel").hidden=true;document.body.style.overflow=""}
  });

  renderHero();
  renderTasks();
  renderCalendar();
  renderProjects();
  renderDocs();
  renderUpdates("#updatesList",5);
  renderArchive();
})();