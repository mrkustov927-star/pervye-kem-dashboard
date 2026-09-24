(()=> {
  const D=(window.DASHBOARD_DATA&&typeof window.DASHBOARD_DATA==="object")
    ? window.DASHBOARD_DATA
    : {meta:{},items:[],documents:[],updates:[]};
  const items=Array.isArray(D.items)?D.items:[];
  const $=(s,r=document)=>r&&typeof r.querySelector==="function"?r.querySelector(s):null;
  const $=(s,r=document)=>r&&typeof r.querySelectorAll==="function"?[...r.querySelectorAll(s)]:[];
  const run=(name,fn)=>{try{return fn()}catch(error){console.error("[dashboard] "+name,error);return null}};
  const now=new Date(new Date().toLocaleString("en-US",{timeZone:"Europe/Moscow"})); now.setHours(12,0,0,0);
  const monthNames=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const monthShort=["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  let taskFilter="all";
  let projectFilter="all";
  const currentYm=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  let calendarMonth=currentYm;
  let lastFocused=null;

  const parseDate=d=>d?new Date(d+"T12:00:00+03:00"):null;
  const days=d=>Math.ceil((parseDate(d)-now)/86400000);
  const endDate=i=>{const raw=[i.deadline,i.eventDate,i.reportDeadline];if(i.type==="event"&&!raw.some(Boolean)) raw.push(i.start);const ds=raw.map(parseDate).filter(Boolean);return ds.length?new Date(Math.max(...ds.map(d=>d.getTime()))):null;};
  const expired=i=>i.status==="done"||(endDate(i)&&endDate(i)<now);
  const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const fmt=d=>{const x=parseDate(d);return x?x.getDate()+" "+monthNames[x.getMonth()]:"Срок уточняется"};
  const fmtShort=d=>{const x=parseDate(d);return x?x.getDate()+" "+monthShort[x.getMonth()]:"—"};
  const typeLabel={task:"Задача",project:"Проект",action:"Акция",event:"Событие",info:"Информация"};
  const isPublic=i=>i.visible!==false&&i.status!=="draft";
  const safeUrl=u=>{
    const v=String(u||"").trim();
    return (/^https?:\/\//i.test(v)||/^\/files\//.test(v))?esc(v):"#";
  };
  const startsInFuture=i=>{const s=parseDate(i.start);return Boolean(s&&s>now)};
  const isOngoing=i=>{
    const s=parseDate(i.start),e=endDate(i);
    if(s&&s>now) return false;
    return !e||e>=now;
  };

  function renderFreshness(){
    const el=$("#siteUpdatedAt");
    if(!el) return;
    const raw=D.meta&&D.meta.updatedAt;
    if(!raw){el.textContent="";return}
    const d=new Date(raw);
    if(Number.isNaN(d.getTime())){el.textContent="";return}
    el.textContent="Обновлено "+d.toLocaleDateString("ru-RU",{day:"numeric",month:"long",timeZone:"Europe/Moscow"})+" · "+d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Moscow"});
  }

  function applySiteSettings(){
    const s=(D.meta&&D.meta.site)||{};
    const put=(selector,value)=>{const el=$(selector);if(el&&value)el.textContent=value};
    if(s.siteTitle){
      document.title=s.siteTitle+" — рабочий кабинет";
      put("#footerSiteTitle",s.siteTitle);
    }
    put("#districtLabel",s.districtLabel);
    put("#heroEyebrow",s.heroEyebrow);
    put("#heroTitle",s.heroTitle);
    put("#heroAccent",s.heroAccent);
    put("#heroLead",s.heroLead);
    put("#heroPrimary",s.heroPrimary);
    put("#heroSecondary",s.heroSecondary);
    put("#now-title",s.nowTitle);
    put("#nowSubtitle",s.nowSubtitle);
    put("#calendar-title",s.calendarTitle);
    put("#calendarSubtitle",s.calendarSubtitle);
    put("#projects-title",s.projectsTitle);
    put("#projectsSubtitle",s.projectsSubtitle);
    put("#docs-title",s.docsTitle);
    put("#docsSubtitle",s.docsSubtitle);
    put("#archiveTitle",s.archiveTitle);
    put("#footerSubtitle",s.footerSubtitle);
  }

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
    const active=items.filter(i=>isPublic(i)&&!expired(i)&&["task","project","action","event"].includes(i.type));
    const priorityRank={urgent:0,high:1,normal:2};
    const upcoming=active.filter(i=>i.deadline&&days(i.deadline)>=0)
      .sort((a,b)=>parseDate(a.deadline)-parseDate(b.deadline)||(priorityRank[a.priority]??2)-(priorityRank[b.priority]??2))
      .slice(0,3);
    $("#heroMiniList").innerHTML=upcoming.map(i=>{
      const d=parseDate(i.deadline);
      return '<button class="hero-mini-card" data-open="'+i.id+'"><span class="mini-date '+(i.priority==="urgent"?"urgent":"")+'"><b>'+d.getDate()+'</b><small>'+monthShort[d.getMonth()]+'</small></span><span class="mini-info"><small>'+esc(i.category)+'</small><b>'+esc(i.title)+'</b><em>'+esc(deadlineLabel(i))+'</em></span><span class="mini-arrow">→</span></button>';
    }).join("");
  }

  function audienceText(i){
    const map={schools:"школы",spo:"СПО",family:"семьи",mentors:"наставники",other:"другие организации"};
    const a=(i.audience||[]).map(x=>map[x]||x);
    return a.length?"Кому: "+a.join(", "):"";
  }

  function quickMeta(i){
    if((i.deliverables||[]).length) return "Результат: "+i.deliverables[0];
    if((i.formats||[]).length) return "Форматы участия: "+i.formats.length;
    if((i.steps||[]).length) return "Порядок действий: "+i.steps.length+" шагов";
    return "";
  }

  function renderTasks(){
    const filters=[["all","Все"],["urgent","Срочно"],["high","Высокий приоритет"],["report","Нужен отчёт"],["schools","Для школ"]];
    $("#taskFilters").innerHTML=filters.map(f=>'<button class="filter-btn '+(taskFilter===f[0]?"active":"")+'" data-task-filter="'+f[0]+'">'+f[1]+'</button>').join("");
    let list=items.filter(i=>isPublic(i)&&!expired(i)&&(i.type==="task"||(i.type==="project"&&(i.deadline||i.status==="active"||i.status==="new"))));
    if(taskFilter==="urgent") list=list.filter(i=>i.priority==="urgent");
    if(taskFilter==="high") list=list.filter(i=>["urgent","high"].includes(i.priority));
    if(taskFilter==="report") list=list.filter(i=>(i.deliverables||[]).length||i.publication||i.reportDeadline||(i.badges||[]).some(b=>/отч/i.test(b)));
    if(taskFilter==="schools") list=list.filter(i=>(i.audience||[]).includes("schools"));
    list.sort((a,b)=>(parseDate(a.deadline)||new Date(2100,0))-(parseDate(b.deadline)||new Date(2100,0)));

    $("#taskList").innerHTML=list.map(i=>{
      const d=i.deadline?parseDate(i.deadline):null;
      const report=((i.deliverables||[]).length||i.publication)?'<span class="compact-chip report">Есть отчётность</span>':"";
      const aud=audienceText(i)?'<span class="compact-chip">'+esc(audienceText(i).replace("Кому: ",""))+'</span>':"";
      return '<button class="task-card-compact '+(i.priority==="urgent"?"urgent":i.priority==="high"?"high":"")+'" data-open="'+i.id+'">'
        +'<span class="compact-top"><span class="task-date"><b>'+(d?d.getDate():"—")+'</b><small>'+(d?monthShort[d.getMonth()]:"срок")+'</small></span><span class="compact-status">'+esc(deadlineLabel(i))+'</span></span>'
        +'<span class="compact-category">'+esc(i.category)+'</span>'
        +'<strong class="compact-title">'+esc(i.title)+'</strong>'
        +'<span class="compact-summary">'+esc(i.short)+'</span>'
        +'<span class="compact-meta">'+aud+report+'</span>'
        +'<span class="compact-open">Открыть инструкцию →</span>'
        +'</button>';
    }).join("")||'<div class="empty">В этой категории пока ничего нет.</div>';
  }

  function renderProjects(){
    const filters=[["all","Все"],["action","Акции"],["project","Проекты"],["event","События"],["upcoming","Скоро"],["active","Идёт сейчас"]];
    $("#projectFilters").innerHTML=filters.map(f=>'<button class="filter-btn '+(projectFilter===f[0]?"active":"")+'" data-project-filter="'+f[0]+'">'+f[1]+'</button>').join("");
    let list=items.filter(i=>isPublic(i)&&!expired(i)&&["action","project","event"].includes(i.type));
    if(["action","project","event"].includes(projectFilter)) list=list.filter(i=>i.type===projectFilter);
    if(projectFilter==="upcoming") list=list.filter(i=>startsInFuture(i)||(!i.start&&["upcoming","soon"].includes(i.status)));
    if(projectFilter==="active") list=list.filter(i=>isOngoing(i)&&!startsInFuture(i));
    list.sort((a,b)=>(parseDate(a.start||a.deadline)||new Date(2100,0))-(parseDate(b.start||b.deadline)||new Date(2100,0)));
    const icons={action:"✦",project:"◇",event:"◉"};

    $("#projectList").innerHTML=list.map(i=>{
      const start=i.start?fmt(i.start):"";
      const end=i.deadline?fmt(i.deadline):"";
      const secondary=i.reportDeadline?"Публикация до "+fmt(i.reportDeadline):(end&&end!==start?"До "+end:deadlineLabel(i));
      const extra=(i.formats||[]).length?i.formats.length+" формата участия":((i.steps||[]).length?i.steps.length+" шагов":"");
      return '<button class="project-card-compact '+i.type+'" data-open="'+i.id+'">'
        +'<span class="project-kicker"><span class="project-icon">'+icons[i.type]+'</span><span class="project-dates">'+esc(start)+'<small>'+esc(secondary)+'</small></span></span>'
        +'<span class="project-category">'+esc(i.category)+'</span>'
        +'<strong class="project-compact-title">'+esc(i.title)+'</strong>'
        +'<span class="project-compact-summary">'+esc(i.short)+'</span>'
        +(extra?'<span class="project-compact-hint">'+esc(extra)+'</span>':"")
        +'<span class="compact-open">Полная инструкция →</span>'
        +'</button>';
    }).join("")||'<div class="empty">Ничего не найдено.</div>';
  }

  function renderCalendar(){
    const monthNom=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    const monthSet=new Set([currentYm]);
    items.filter(isPublic).forEach(i=>[i.start,i.deadline,i.eventDate].filter(Boolean).forEach(d=>{
      const key=d.slice(0,7);
      if(key>=currentYm) monthSet.add(key);
    }));
    const monthKeys=[...monthSet].sort();
    if(!monthKeys.includes(calendarMonth)) calendarMonth=monthKeys.find(x=>x>=currentYm)||monthKeys[0];
    const years=new Set(monthKeys.map(x=>x.slice(0,4)));
    const months=monthKeys.map(key=>{
      const [yy,mm]=key.split("-").map(Number);
      const label=monthNom[mm-1]+(years.size>1?" "+yy:"");
      return [key,label];
    });
    $("#calendarMonths").innerHTML=months.map(m=>'<button class="'+(calendarMonth===m[0]?"active":"")+'" data-month="'+m[0]+'">'+m[1]+'</button>').join("");
    if(!(D.meta&&D.meta.site&&D.meta.site.calendarSubtitle) && monthKeys.length){
      const firstKey=monthKeys[0].split("-").map(Number), lastKey=monthKeys[monthKeys.length-1].split("-").map(Number);
      const sameYear=firstKey[0]===lastKey[0];
      const label=monthNom[firstKey[1]-1]+(monthKeys.length>1?" — "+monthNom[lastKey[1]-1]:"")+(sameYear?" "+firstKey[0]:" "+firstKey[0]+" — "+lastKey[0]);
      const subtitle=$("#calendarSubtitle"); if(subtitle) subtitle.textContent=label;
    }
    const ym=calendarMonth.split("-").map(Number),y=ym[0],m=ym[1];
    const first=new Date(y,m-1,1);
    const start=(first.getDay()+6)%7;
    const events=[];
    const labels={concept:"Концепция",task:"Задача",event:"Мероприятие",registration:"Регистрация"};
    const defaultKind=i=>i.calendarKind||(i.type==="action"?"concept":i.type==="event"?"event":"task");
    const push=(date,item,kind)=>{
      if(!date||!kind||!date.startsWith(calendarMonth)) return;
      if(events.some(e=>e.date===date&&e.item.id===item.id&&e.kind===kind)) return;
      events.push({date,item,kind,label:labels[kind]||"Задача"});
    };

    items.filter(isPublic).forEach(i=>{
      if(i.calendarMap&&typeof i.calendarMap==="object"){
        push(i.start,i,i.calendarMap.start);
        push(i.deadline,i,i.calendarMap.deadline);
        push(i.eventDate,i,i.calendarMap.eventDate);
        return;
      }
      const kind=defaultKind(i);
      if(kind==="concept"){
        push(i.start,i,"concept");
        if(i.eventDate) push(i.eventDate,i,"event");
        return;
      }
      if(kind==="registration"){
        push(i.deadline,i,"registration");
        if(i.eventDate) push(i.eventDate,i,"event");
        return;
      }
      if(kind==="event"){
        push(i.eventDate||i.start||i.deadline,i,"event");
        return;
      }
      push(i.deadline,i,"task");
      if(i.eventDate) push(i.eventDate,i,"event");
    });

    const order={concept:0,registration:1,event:2,task:3};
    events.sort((a,b)=>parseDate(a.date)-parseDate(b.date)||(order[a.kind]??9)-(order[b.kind]??9));

    let html=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=>'<div class="calendar-weekday">'+x+'</div>').join("");
    for(let z=0;z<42;z++){
      const n=z-start+1;
      const d=new Date(y,m-1,n);
      const iso=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
      const outside=d.getMonth()!==m-1;
      const todayIso=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
      const allDayEvents=events.filter(e=>e.date===iso);
      const dayEvents=allDayEvents.slice(0,3);
      const more=allDayEvents.length>3?'<span class="day-more">+'+(allDayEvents.length-3)+' ещё</span>':"";
      html+='<div class="calendar-day '+(outside?"outside ":"")+(iso===todayIso?"today":"")+'"><span class="day-num">'+d.getDate()+'</span><div class="day-events">'+
        dayEvents.map(e=>'<button class="day-event calendar-'+e.kind+'" data-open="'+e.item.id+'"><span>'+esc(e.label)+'</span>'+esc(e.item.title)+'</button>').join("")+
        more+'</div></div>';
    }
    $("#calendarGrid").innerHTML=html;
    $("#calendarAgenda").innerHTML=events.map(e=>{
      const d=parseDate(e.date);
      return '<button class="agenda-mobile-card" data-open="'+e.item.id+'"><span class="agenda-mobile-date calendar-'+e.kind+'"><b>'+d.getDate()+'</b><small>'+monthShort[d.getMonth()]+'</small></span><span class="agenda-mobile-copy"><small>'+esc(e.label)+'</small><b>'+esc(e.item.title)+'</b><span>'+esc(e.item.category)+'</span></span></button>';
    }).join("");
  }

  function renderDocs(){
    const docs=(D.documents||[]).filter(d=>d.url||(d.itemId&&items.some(i=>i.id===d.itemId&&isPublic(i))));
    $("#docsList").innerHTML=docs.map(d=>{
      const action=d.itemId
        ? '<button data-open="'+d.itemId+'">Открыть →</button>'
        : '<a href="'+safeUrl(d.url)+'" target="_blank" rel="noopener">Открыть →</a>';
      return '<article class="doc-card"><div class="doc-icon">'+(d.kind==="Курс"?"▶":d.kind==="Справочник"?"#":"↗")+'</div><div><small>'+esc(d.kind)+'</small><h3>'+esc(d.title)+'</h3><p>'+esc(d.description)+'</p>'+action+'</div></article>';
    }).join("");
  }

  function renderUpdates(){
    const list=Array.isArray(D.updates)?[...D.updates]:[];
    list.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
    $("#updatesList").innerHTML=list.slice(0,5).map(u=>{
      const d=u.date?new Date(u.date):null;
      const date=d&&!Number.isNaN(d.getTime())?d.toLocaleDateString("ru-RU",{day:"numeric",month:"long",timeZone:"Europe/Moscow"}):"";
      return '<article class="update-card"><span>'+esc(date)+'</span><div><strong>'+esc(u.title)+'</strong><p>'+esc(u.text)+'</p></div></article>';
    }).join("")||'<div class="empty">Пока нет новых изменений.</div>';
  }

  function renderArchive(){
    const list=items.filter(i=>isPublic(i)&&expired(i)).sort((a,b)=>(endDate(b)||parseDate(b.start))-(endDate(a)||parseDate(a.start)));
    $("#archiveList").innerHTML=list.map(i=>'<button class="archive-card" data-open="'+i.id+'"><b>'+esc(i.title)+'</b><span>'+esc(i.category)+' · '+esc(i.deadline?fmt(i.deadline):"завершено")+'</span></button>').join("")||'<div class="empty">Архив пока пуст.</div>';
  }

  function addDaysIso(iso,days=1){
    const d=parseDate(iso); if(!d) return "";
    d.setDate(d.getDate()+days);
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function calendarEventFor(i){
    const date=i.eventDate||i.deadline||i.start;
    if(!date) return null;
    const kind=i.eventDate?"event":i.deadline?"deadline":"start";
    const title=kind==="deadline"?"Дедлайн: "+i.title:i.title;
    const cardUrl=location.origin+location.pathname+"?card="+encodeURIComponent(i.id);
    const external=(i.links&&i.links[0]&&/^https?:\/\//i.test(i.links[0].url||""))?i.links[0].url:"";
    const details=[
      i.short||"",
      i.category?("Раздел: "+i.category):"",
      kind==="deadline"?"Срок выполнения: "+fmt(date):"",
      "Карточка на сайте: "+cardUrl,
      external?("Рабочая ссылка: "+external):""
    ].filter(Boolean).join("\n\n");
    return {date,title,details,cardUrl};
  }
  function googleCalendarUrl(i){
    const ev=calendarEventFor(i); if(!ev) return "";
    const start=ev.date.replace(/-/g,"");
    const end=addDaysIso(ev.date,1).replaceAll("-","");
    const p=new URLSearchParams({
      action:"TEMPLATE",
      text:ev.title,
      dates:start+"/"+end,
      details:ev.details
    });
    return "https://calendar.google.com/calendar/render?"+p.toString();
  }
  function icsEscape(v){
    return String(v||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
  }
  function downloadIcs(i){
    const ev=calendarEventFor(i); if(!ev) return;
    const start=ev.date.replace(/-/g,"");
    const end=addDaysIso(ev.date,1).replaceAll("-","");
    const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
    const uid=i.id+"@pervye-kem-dashboard";
    const body=[
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pervye Kem//Dashboard//RU",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:"+icsEscape(uid),
      "DTSTAMP:"+stamp,
      "DTSTART;VALUE=DATE:"+start,
      "DTEND;VALUE=DATE:"+end,
      "SUMMARY:"+icsEscape(ev.title),
      "DESCRIPTION:"+icsEscape(ev.details),
      "URL:"+icsEscape(ev.cardUrl),
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const blob=new Blob([body],{type:"text/calendar;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=(i.title||"event").replace(/[\\/:*?"<>|]+/g," ").trim().slice(0,80)+".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function openModal(id){
    const i=items.find(x=>x.id===id); if(!i||!isPublic(i))return;
    let detail="";
    if(i.completion){
      const done=Array.isArray(i.completion)?i.completion:[i.completion];
      detail+='<section class="completion-box"><h3>Когда задача считается выполненной</h3>'+done.map(x=>'<p>✓ '+esc(x)+'</p>').join("")+'</section>';
    }
    if(i.steps&&i.steps.length) detail+='<section class="detail-section"><h3>Что нужно сделать</h3><div class="steps">'+i.steps.map((s,n)=>'<div class="step"><b>'+(n+1)+'</b><p>'+esc(s)+'</p></div>').join("")+'</div></section>';
    if(i.formatDetails&&i.formatDetails.length){
      detail+='<section class="detail-section"><h3>Форматы участия</h3><p class="section-help">Выберите подходящий формат — внутри указано, для кого он подходит и что конкретно нужно провести.</p><div class="format-details">'+i.formatDetails.map((f,n)=>'<details class="format-detail" '+(n===0?'open':'')+'><summary><span><b>'+(n+1)+'</b><strong>'+esc(f.name)+'</strong></span><em>'+esc(f.audience||'')+'</em></summary><div class="format-body">'+(f.description?'<p>'+esc(f.description)+'</p>':'')+((f.actions||[]).length?'<ol>'+f.actions.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol>':'')+(f.result?'<div class="format-result"><strong>Результат:</strong> '+esc(f.result)+'</div>':'')+'</div></details>').join('')+'</div></section>';
    } else if(i.formats&&i.formats.length){
      detail+='<section class="detail-section"><h3>Форматы участия</h3><div class="steps">'+i.formats.map((s,n)=>'<div class="step"><b>'+(n+1)+'</b><p>'+esc(s)+'</p></div>').join("")+'</div></section>';
    }
    if(i.deliverables&&i.deliverables.length) detail+='<section class="detail-section"><h3>Что сдаём</h3>'+i.deliverables.map(x=>'<p>✓ '+esc(x)+'</p>').join("")+'</section>';
    if(i.publication){
      const p=i.publication;
      detail+='<section class="detail-section publication-section"><h3>Публикация и отчётность</h3><div class="publication-grid">'
        +(p.deadline?'<div><span>Срок</span><strong>'+esc(p.deadline)+'</strong></div>':'')
        +(p.where?'<div><span>Где разместить</span><strong>'+esc(p.where)+'</strong></div>':'')
        +(p.report?'<div><span>Что приложить</span><strong>'+esc(p.report)+'</strong></div>':'')
        +'</div>'+((p.requirements||[]).length?'<ul class="publication-list">'+p.requirements.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+'</section>';
    }
    if(i.hashtags&&i.hashtags.length) detail+='<section class="detail-section"><h3>Хештеги</h3><p>'+i.hashtags.map(esc).join(" ")+'</p><div class="detail-actions"><button data-copy-hashtags="'+i.id+'">Скопировать хештеги</button></div></section>';
    if(i.hashtagsByOrg&&i.hashtagsByOrg.length) detail+='<section class="detail-section"><h3>Хештеги первичек</h3>'+i.hashtagsByOrg.map(x=>'<p>'+esc(x)+'</p>').join("")+'<div class="detail-actions"><button data-copy-hashtags="'+i.id+'">Скопировать список</button></div></section>';
    if(i.notes&&i.notes.length) detail+='<section class="detail-section"><h3>Важно</h3>'+i.notes.map(x=>'<p>'+esc(x)+'</p>').join("")+'</section>';
    if(i.attachments&&i.attachments.length){
      detail+='<section class="detail-section"><h3>Файлы для скачивания</h3><div class="attachment-list">'+i.attachments.map(a=>{
        const ext=(a.name||"").split(".").pop().toUpperCase();
        const size=a.size?(a.size<1048576?Math.round(a.size/1024)+" КБ":(a.size/1048576).toFixed(1).replace(".0","")+" МБ"):"";
        return '<a class="attachment-download" href="'+safeUrl(a.url)+'" download><span class="attachment-type">'+esc(ext||"ФАЙЛ")+'</span><span class="attachment-copy"><strong>'+esc(a.name)+'</strong><small>'+esc(size)+'</small></span><span class="attachment-arrow">Скачать ↓</span></a>';
      }).join("")+'</div></section>';
    }
    const links=[...(i.links||[]),...(i.materials||[])];
    if(links.length||i.copyText) detail+='<section class="detail-section"><h3>Действия</h3><div class="detail-actions">'+links.map((l,n)=>'<a class="'+(n===0?"primary":"")+'" href="'+safeUrl(l.url)+'" target="_blank" rel="noopener">'+esc(l.label)+' ↗</a>').join("")+(i.copyText?'<button data-copy="'+i.id+'">Скопировать инструкцию</button>':"")+'</div></section>';
    const audience=audienceText(i);
    const overview='<section class="detail-overview"><div><span>Срок</span><strong>'+esc(deadlineLabel(i))+'</strong></div>'+(i.eventDate?'<div><span>Дата события</span><strong>'+esc(fmt(i.eventDate))+'</strong></div>':"")+(i.reportDeadline?'<div><span>Публикация / отчёт</span><strong>до '+esc(fmt(i.reportDeadline))+'</strong></div>':"")+(audience?'<div><span>Для кого</span><strong>'+esc(audience.replace("Кому: ",""))+'</strong></div>':"")+'</section>';
    const cal=calendarEventFor(i);
    const calendarActions=cal?'<section class="calendar-add"><div><span>Не пропустить дату</span><strong>Добавить в свой календарь</strong></div><div class="calendar-add-actions"><a href="'+safeUrl(googleCalendarUrl(i))+'" target="_blank" rel="noopener" class="google-calendar-btn">Google Calendar ↗</a><button type="button" data-apple-calendar="'+i.id+'" class="apple-calendar-btn">Apple Calendar / .ics ↓</button></div></section>':"";
    $("#modalContent").innerHTML='<div class="modal-kicker"><span class="badge">'+esc(typeLabel[i.type]||i.type)+'</span><span class="tag">'+esc(i.category)+'</span>'+badgeMarkup(i)+'</div><h2 id="modalTitle">'+esc(i.title)+'</h2><p class="modal-summary">'+esc(i.short)+'</p>'+overview+calendarActions+detail;
    lastFocused=document.activeElement;
    $("#detailModal").hidden=false;
    document.body.style.overflow="hidden";
    const url=new URL(location.href);
    url.searchParams.set("card",i.id);
    history.replaceState(null,"",url);
    requestAnimationFrame(()=>{const closeBtn=$(".modal-close");if(closeBtn)closeBtn.focus()});
  }

  function closeModal(){ const modal=$("#detailModal"); if(!modal.hidden){modal.hidden=true;document.body.style.overflow="";const url=new URL(location.href);url.searchParams.delete("card");history.replaceState(null,"",url);if(lastFocused&&lastFocused.focus)lastFocused.focus();} }
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
    const resItems=items.filter(i=>isPublic(i)&&[
      i.title,i.short,i.category,
      ...(i.steps||[]),...(i.hashtags||[]),...(i.formats||[]),...(i.notes||[]),...(i.deliverables||[]),
      ...(i.links||[]).flatMap(x=>[x.label,x.url]),
      ...(i.materials||[]).flatMap(x=>[x.label,x.url]),
      ...(i.attachments||[]).map(x=>x.name)
    ].join(" ").toLowerCase().includes(q)).slice(0,7);
    const resDocs=(D.documents||[]).filter(d=>(d.url||(d.itemId&&items.some(i=>i.id===d.itemId&&isPublic(i))))&&[d.title,d.description,d.kind].join(" ").toLowerCase().includes(q)).slice(0,4);
    const itemHtml=resItems.map(i=>'<button class="search-result" data-open="'+i.id+'"><strong>'+esc(i.title)+'</strong><span>'+esc(i.category||typeLabel[i.type])+'</span></button>').join("");
    const docHtml=resDocs.map(d=>d.itemId
      ? '<button class="search-result" data-open="'+d.itemId+'"><strong>'+esc(d.title)+'</strong><span>'+esc(d.kind)+'</span></button>'
      : '<a class="search-result" href="'+safeUrl(d.url)+'" target="_blank" rel="noopener"><strong>'+esc(d.title)+'</strong><span>'+esc(d.kind)+'</span></a>').join("");
    panel.innerHTML='<strong>Результаты поиска</strong><div class="search-results">'+(itemHtml+docHtml||'<span>Ничего не найдено</span>')+'</div>';
    panel.hidden=false;
  }

  document.addEventListener("click",e=>{
    let x=e.target.closest("[data-open]"); if(x){openModal(x.dataset.open);return}
    x=e.target.closest("[data-task-filter]"); if(x){taskFilter=x.dataset.taskFilter;renderTasks();return}
    x=e.target.closest("[data-project-filter]"); if(x){projectFilter=x.dataset.projectFilter;renderProjects();return}
    x=e.target.closest("[data-month]"); if(x){calendarMonth=x.dataset.month;renderCalendar();return}
    x=e.target.closest("[data-close-modal]"); if(x){closeModal();return}
    x=e.target.closest("[data-copy-hashtags]"); if(x){copyItem(x.dataset.copyHashtags,true);return}
    x=e.target.closest("[data-apple-calendar]"); if(x){const item=items.find(i=>i.id===x.dataset.appleCalendar);if(item)downloadIcs(item);return}
    x=e.target.closest("[data-copy]"); if(x){copyItem(x.dataset.copy);return}
    x=e.target.closest("[data-toast]"); if(x){toast(x.dataset.toast);return}
    if(!e.target.closest(".search-panel")&&!e.target.closest(".search-wrap")){const panel=$("#searchPanel");if(panel)panel.hidden=true;}
  });

  const searchInput=$("#globalSearch");
  if(searchInput) searchInput.oninput=e=>doSearch(e.target.value);
  document.addEventListener("keydown",e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#globalSearch").focus()}
    if(e.key==="Escape"){closeModal();$("#searchPanel").hidden=true;document.body.style.overflow="";return}
    const modal=$("#detailModal");
    if(e.key==="Tab"&&modal&&!modal.hidden){
      const focusables=$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary',modal).filter(x=>x.offsetParent!==null);
      if(!focusables.length)return;
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
  });

  const shortcut=$("#searchShortcut");
  if(shortcut) shortcut.textContent=/Mac|iPhone|iPad/i.test(navigator.platform||"")?"⌘ K":"Ctrl K";
  run("settings",applySiteSettings);
  run("freshness",renderFreshness);
  run("hero",renderHero);
  run("tasks",renderTasks);
  run("calendar",renderCalendar);
  run("projects",renderProjects);
  run("docs",renderDocs);
  run("updates",renderUpdates);
  run("archive",renderArchive);
  run("deep-link",()=>{
    const deepLinkedCard=new URL(location.href).searchParams.get("card");
    if(deepLinkedCard)setTimeout(()=>openModal(deepLinkedCard),0);
  });
})();