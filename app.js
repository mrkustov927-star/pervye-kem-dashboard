(()=> {
  const D=(window.DASHBOARD_DATA&&typeof window.DASHBOARD_DATA==="object")
    ? window.DASHBOARD_DATA
    : {meta:{},items:[],documents:[],updates:[]};
  const items=Array.isArray(D.items)?D.items:[];
  const $=(s,r=document)=>r&&typeof r.querySelector==="function"?r.querySelector(s):null;
  const $$=(s,r=document)=>r&&typeof r.querySelectorAll==="function"?[...r.querySelectorAll(s)]:[];
  const run=(name,fn)=>{try{return fn()}catch(error){console.error("[dashboard] "+name,error);return null}};
  const todayMoscow=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const now=new Date(todayMoscow+"T12:00:00");
  const monthNames=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const monthShort=["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  let taskFilter="all";
  const rawMonth=new URLSearchParams(window.location.search).get("month");
  const requestedMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth||"")?rawMonth:null;
  let projectFilter="all";
  let archiveFilter=requestedMonth||"all";
  const currentYm=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  let calendarMonth=currentYm;
  let lastFocused=null;

  const parseDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||""))return null;const date=new Date(d+"T12:00:00");return Number.isNaN(date.getTime())?null:date};
  const days=d=>Math.round((parseDate(d)-now)/86400000);
  const monthEnd=m=>{if(!/^\d{4}-\d{2}$/.test(m||""))return null;const [y,n]=m.split("-").map(Number);return y+"-"+String(n).padStart(2,"0")+"-"+new Date(y,n,0).getDate()};
  const stagesFor=i=>Array.isArray(i.stages)?i.stages:[];
  const endDate=i=>{
    let raw=i.type==="event"?[i.eventDate||i.deadline||i.start]
      :i.type==="action"?[i.deadline||i.eventDate]
      :i.type==="task"?[i.deadline,i.reportDeadline,...(!i.deadline&&!i.reportDeadline?[i.eventDate]:[])]:[i.deadline,i.eventDate,i.reportDeadline];
    if(i.type==="project")stagesFor(i).forEach(s=>{
      const month=s.monthEnd||s.monthStart;
      raw.push(s.end||s.start||(month&&i.deadline?.startsWith(month)?i.deadline:monthEnd(month)));
    });
    const dates=raw.map(parseDate).filter(Boolean);return dates.length?new Date(Math.max(...dates.map(d=>d.getTime()))):null;
  };
  const expired=i=>i.status==="done"||(endDate(i)&&endDate(i)<now);
  const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const fmt=d=>{const x=parseDate(d);return x?x.getDate()+" "+monthNames[x.getMonth()]:"Срок уточняется"};
  const fmtShort=d=>{const x=parseDate(d);return x?x.getDate()+" "+monthShort[x.getMonth()]:"—"};
  const typeLabel={task:"Задача",project:"Проект",action:"Акция",event:"Событие",info:"Информация"};
  const isPublic=i=>i.visible!==false&&i.status!=="draft"&&i.archived!==true;
  const reportPending=i=>i.status!=="done"&&Boolean(parseDate(i.reportDeadline)&&days(i.reportDeadline)>=0);
  const nextDeadline=i=>{
    const dates=[i.deadline,i.reportDeadline,...stagesFor(i).filter(s=>["task","registration","report"].includes(s.kind)).map(s=>s.end||s.start)].filter(d=>parseDate(d)&&days(d)>=0).sort();
    return dates[0]||null;
  };
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

  const preferencesKey="pervye-kem-dashboard:preferences:v1";
  function readPreferences(){
    try{const value=JSON.parse(localStorage.getItem(preferencesKey)||"{}");return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}catch{return {}}
  }
  let preferences=readPreferences();
  let favorites=new Set(Array.isArray(preferences.favorites)?preferences.favorites.filter(x=>typeof x==="string"):[]);
  function savePreferences(){
    preferences.favorites=[...favorites];
    try{localStorage.setItem(preferencesKey,JSON.stringify(preferences))}catch{/* The page remains usable without storage. */}
  }

  // Keep separate disclosure preferences for phones and computers.
  const compactScreen=window.matchMedia("(max-width: 820px)");
  const sectionDisclosures=()=>$$('[data-section-disclosure]');
  function numberSections(){
    sectionDisclosures().forEach((section,index)=>{
      const badge=$(".section-number",section);
      if(badge)badge.textContent=String(index+1).padStart(2,"0");
    });
  }
  const disclosureMode=()=>compactScreen.matches?"mobile":"desktop";
  function disclosureId(el){return el.id||el.closest("section[id]")?.id}
  function rememberSections(){
    if(!preferences.sections||typeof preferences.sections!=="object"||Array.isArray(preferences.sections)) preferences.sections={};
    const state={};
    [...sectionDisclosures(),$("#heroDeadlines")].filter(Boolean).forEach(el=>{const id=disclosureId(el);if(id!=="archive")state[id]=el.open});
    preferences.sections[disclosureMode()]=state;
    savePreferences();
  }
  function revealSection(hash){
    if(!/^#[a-z-]+$/.test(hash)) return;
    const section=$(hash);
    const disclosure=section&&$("[data-section-disclosure]",section);
    if(disclosure) disclosure.open=true;
  }
  function adaptSections(){
    const state=preferences.sections?.[disclosureMode()]||{};
    [...sectionDisclosures(),$("#heroDeadlines")].filter(Boolean).forEach(el=>{
      const id=disclosureId(el);
      el.open=id==="archive"?false:typeof state[id]==="boolean"?state[id]:!compactScreen.matches&&id!=="favorites";
    });
    revealSection(location.hash);
    if(requestedMonth&&(!location.hash||location.hash==="#projects")){
      const url=new URL(location.href);url.hash="archive";history.replaceState(null,"",url);revealSection("#archive");
    }
  }
  function setSectionCount(id,count){
    const el=$('[data-section-count="'+id+'"]');
    if(el){el.textContent=count;el.setAttribute("aria-label","Количество записей: "+count)}
    $$('[data-nav-count="'+id+'"]').forEach(el=>{el.textContent=count});
  }
  run("responsive-sections",()=>{
    adaptSections();
    compactScreen.addEventListener("change",adaptSections);
    window.addEventListener("hashchange",()=>revealSection(location.hash));
    [...sectionDisclosures(),$("#heroDeadlines")].filter(Boolean).forEach(el=>el.addEventListener("toggle",rememberSections));
  });

  function applyView(){
    const list=preferences.view==="list";
    document.body.classList.toggle("list-view",list);
    $$('[data-view]').forEach(el=>el.setAttribute("aria-pressed",String(el.dataset.view===(list?"list":"cards"))));
  }
  const documentKey=d=>"doc:"+String(d.id||d.url||d.itemId||d.title);
  function favoriteButton(key,title){
    const active=favorites.has(key);
    const label=(active?"Убрать из избранного: ":"Добавить в избранное: ")+title;
    return '<button type="button" class="favorite-toggle" data-favorite="'+esc(key)+'" aria-pressed="'+active+'" aria-label="'+esc(label)+'" title="'+esc(label)+'">'+(active?"★":"☆")+'</button>';
  }
  function decorateCards(id){
    const root=$("#"+id);if(!root)return;
    $$(':scope > button[data-open]',root).forEach(button=>{
      const i=items.find(i=>i.id===button.dataset.open);if(!i)return;
      const shell=document.createElement("article");shell.className="saved-card-shell";
      button.before(shell);shell.append(button);
      shell.insertAdjacentHTML("beforeend",favoriteButton("item:"+i.id,i.title));
    });
  }
  function refreshFavoriteButtons(){
    $$('[data-favorite]').forEach(button=>{
      const active=favorites.has(button.dataset.favorite);
      const label=button.getAttribute("aria-label").replace(/^(Добавить в избранное|Убрать из избранного): /,"");
      button.setAttribute("aria-pressed",String(active));
      button.setAttribute("aria-label",(active?"Убрать из избранного: ":"Добавить в избранное: ")+label);
      button.title=button.getAttribute("aria-label");button.textContent=active?"★":"☆";
    });
  }
  function renderFavorites(){
    const cards=items.filter(i=>isPublic(i)&&favorites.has("item:"+i.id)).map(i=>{
      const key="item:"+i.id;
      return '<article class="saved-card-shell"><button class="saved-entry" data-open="'+esc(i.id)+'"><small>'+esc(typeLabel[i.type]||"Материал")+'</small><strong>'+esc(i.title)+'</strong><span>'+esc(i.short||i.category)+'</span><em>Открыть материал →</em></button>'+favoriteButton(key,i.title)+'</article>';
    });
    (D.documents||[]).filter(d=>favorites.has(documentKey(d))&&(d.url||(d.itemId&&items.some(i=>i.id===d.itemId&&isPublic(i))))).forEach(d=>{
      const action=d.itemId?'button data-open="'+esc(d.itemId)+'"':'a href="'+safeUrl(d.url)+'" target="_blank" rel="noopener"';
      const tag=d.itemId?"button":"a";
      cards.push('<article class="saved-card-shell"><'+action+' class="saved-entry"><small>'+esc(d.kind||"Документ")+'</small><strong>'+esc(d.title)+'</strong><span>'+esc(d.description)+'</span><em>Открыть документ ↗</em></'+tag+'>'+favoriteButton(documentKey(d),d.title)+'</article>');
    });
    setSectionCount("favorites",cards.length);
    $("#favoritesList").innerHTML=cards.join("")||'<div class="empty">Пока здесь пусто. Добавьте нужную карточку или документ звёздочкой ☆.</div>';
  }
  function calendarEntries(){
    const events=[];
    const labels={concept:"Концепция",task:"Задача",event:"Мероприятие",registration:"Регистрация",report:"Публикация / отчёт"};
    const push=(date,item,kind,extra={})=>{
      if(!parseDate(date)||!labels[kind])return;
      const entry={date,item,kind,label:labels[kind],title:item.title,...extra};
      const index=events.findIndex(e=>e.date===date&&e.item.id===item.id&&e.kind===kind&&(!e.stageId||!extra.stageId||e.stageId===extra.stageId));
      if(index<0)events.push(entry);else if(extra.stageId)events[index]=entry;
    };
    items.filter(isPublic).forEach(i=>{
      const kind=i.calendarKind||(i.type==="action"?"concept":i.type==="event"?"event":"task");
      if(i.calendarDisplayDate)push(i.calendarDisplayDate,i,i.calendarDisplayKind||kind);
      else if(stagesFor(i).length){/* Structured stages replace broad project markers. */}
      else if(i.calendarMap&&typeof i.calendarMap==="object"){
        ["start","deadline","eventDate","reportDeadline"].forEach(field=>push(i[field],i,i.calendarMap[field]));
      }else if(kind==="concept"){
        push(i.start,i,"concept");push(i.eventDate,i,"event");push(i.deadline,i,"task");
      }else if(kind==="registration"){
        push(i.deadline,i,"registration");push(i.eventDate,i,"event");
      }else if(kind==="event")push(i.eventDate||i.start||i.deadline,i,"event");
      else{push(i.deadline,i,"task");push(i.eventDate,i,"event")}
      // Reporting dates must not disappear when a calendar map is present.
      if(i.reportDeadline)push(i.reportDeadline,i,"report");
      stagesFor(i).forEach(stage=>{
        const linked=items.find(x=>x.id===stage.itemId&&isPublic(x));
        const target=linked||i;
        const extra={stageId:stage.id,stageOwner:i.id,title:stage.title,tentative:stage.tentative===true};
        if(stage.start)push(stage.start,target,stage.kind||"event",{...extra,title:stage.title+(stage.end&&stage.end!==stage.start?" — начало":"")});
        if(stage.end&&stage.end!==stage.start)push(stage.end,target,stage.kind||"event",{...extra,title:stage.title+(stage.start?" — завершение":"")});
      });
    });
    return events.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"ru"));
  }
  function stagePeriod(stage){
    let text="";
    if(stage.start&&stage.end&&stage.start!==stage.end)text=fmt(stage.start)+(stage.start.slice(0,4)!==stage.end.slice(0,4)?" "+stage.start.slice(0,4):"")+" — "+fmt(stage.end)+" "+stage.end.slice(0,4);
    else if(stage.start||stage.end)text=(stage.start?"":"до ")+fmt(stage.start||stage.end)+" "+(stage.start||stage.end).slice(0,4);
    else{
      const f=m=>parseDate(m+"-01")?.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})||"";
      const first=stage.monthStart||stage.monthEnd;
      text=f(first)+(stage.monthEnd&&stage.monthEnd!==first?" — "+f(stage.monthEnd):"")+" · точные даты уточняются";
    }
    return text+(stage.tentative?" · ориентировочно":"");
  }
  function stagesInMonth(month){
    return items.filter(isPublic).flatMap(item=>stagesFor(item).filter(stage=>{
      const from=(stage.start||stage.end||stage.monthStart||stage.monthEnd||"").slice(0,7);
      const to=(stage.end||stage.start||stage.monthEnd||stage.monthStart||"").slice(0,7);
      return from&&from<=month&&to>=month;
    }).map(stage=>({item,stage}))).sort((a,b)=>(a.stage.start||a.stage.end||a.stage.monthStart).localeCompare(b.stage.start||b.stage.end||b.stage.monthStart));
  }
  function renderWeek(){
    const entries=[];
    const labels={concept:"Начало акции",task:"Срок выполнения",event:"Мероприятие",registration:"Регистрация",report:"Публикация / отчёт"};
    const push=(i,date,kind)=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date||""))return;
      const left=days(date);if(left<0||left>6)return;
      if(!entries.some(e=>e.item.id===i.id&&e.date===date&&e.kind===kind&&e.item.title===i.title))entries.push({item:i,date,kind,left});
    };
    calendarEntries().filter(e=>e.item.status!=="done").forEach(e=>push({...e.item,title:e.title},e.date,e.kind));
    entries.sort((a,b)=>a.left-b.left||a.item.title.localeCompare(b.item.title,"ru"));
    const last=addDaysIso(todayMoscow,6);
    $("#weekRange").textContent=fmt(todayMoscow)+" — "+fmt(last)+" · ближайшие 7 дней";
    setSectionCount("week",entries.length);
    $("#weekList").innerHTML=entries.map(e=>'<button class="week-entry" data-open="'+esc(e.item.id)+'"><span class="week-date">'+esc(fmtShort(e.date))+'</span><span class="week-copy"><small>'+esc(labels[e.kind]||"Задача")+'</small><strong>'+esc(e.item.title)+'</strong></span><span class="week-countdown '+(e.left<=1?"soon":"")+'">'+(e.left===0?"Сегодня":e.left===1?"Завтра":"Через "+e.left+" дн.")+'</span><span class="week-arrow" aria-hidden="true">→</span></button>').join("")||'<div class="empty">На ближайшие 7 дней в календаре пока нет событий и сроков. Все материалы доступны в разделах ниже.</div>';
  }
  function setupSidebar(){
    const sections=$$("main > section[id]").filter(el=>el.id!=="top");
    const update=()=>{
      let active="";
      sections.forEach(el=>{if(el.getBoundingClientRect().top<=150)active=el.id});
      $$(".desktop-sidebar a").forEach(a=>{
        const current=a.hash==="#"+active;
        if(current)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current");
      });
    };
    let queued=false;
    window.addEventListener("scroll",()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;update()})}},{passive:true});
    window.addEventListener("resize",update);
    document.addEventListener("toggle",update,true);update();
  }

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
    const legacyArchiveTitle=/^Прошедшие задания и мероприятия(?:\s*\(.*\))?$/i;
    put("#archiveTitle",s.archiveTitle&&!legacyArchiveTitle.test(s.archiveTitle)?s.archiveTitle:"Архив мероприятий");
    put("#footerSubtitle",s.footerSubtitle);
    const banner=$("#kindnessBanner");
    if(banner){
      const enabled=s.announcementEnabled!=="false";
      banner.hidden=!enabled;
      put("#announcementTitle",s.announcementTitle);
      put("#announcementText",s.announcementText);
      const link=$("#announcementLink");
      if(link){
        const target=String(s.announcementUrl||"").trim();
        const hasUrl=/^https?:\/\//i.test(target);
        if(hasUrl) link.href=target; else link.removeAttribute("href");
        link.hidden=!hasUrl;
        link.style.display=hasUrl?"":"none";
        if(s.announcementButton) link.textContent=s.announcementButton+" ↗";
      }
    }
  }

  function deadlineLabel(i){
    const date=i.taskDeadline||nextDeadline(i)||i.deadline;
    if(!date) return "Срок уточняется";
    const d=days(date);
    if(d===0) return "Сегодня";
    if(d===1) return "Завтра";
    return d<0?"Срок завершён "+fmt(date):"До "+fmt(date);
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
    const active=items.filter(i=>isPublic(i)&&(!expired(i)||reportPending(i))&&["task","project","action","event"].includes(i.type)).map(i=>({...i,taskDeadline:nextDeadline(i)}));
    const priorityRank={urgent:0,high:1,normal:2};
    const upcoming=active.filter(i=>i.taskDeadline)
      .sort((a,b)=>parseDate(a.taskDeadline)-parseDate(b.taskDeadline)||(priorityRank[a.priority]??2)-(priorityRank[b.priority]??2))
      .slice(0,3);
    $("#heroMiniList").innerHTML=upcoming.map(i=>{
      const d=parseDate(i.taskDeadline);
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
    let list=items.filter(i=>isPublic(i)&&((!expired(i)&&(i.type==="task"||(i.type==="project"&&nextDeadline(i))))||reportPending(i))).map(i=>({...i,taskDeadline:nextDeadline(i),taskTitle:expired(i)&&reportPending(i)?"Публикация / отчёт: "+i.title:i.title}));
    if(taskFilter==="urgent") list=list.filter(i=>i.priority==="urgent");
    if(taskFilter==="high") list=list.filter(i=>["urgent","high"].includes(i.priority));
    if(taskFilter==="report") list=list.filter(i=>(i.deliverables||[]).length||i.publication||i.reportDeadline||(i.badges||[]).some(b=>/отч/i.test(b)));
    if(taskFilter==="schools") list=list.filter(i=>(i.audience||[]).includes("schools"));
    list.sort((a,b)=>(parseDate(a.taskDeadline)||new Date(2100,0))-(parseDate(b.taskDeadline)||new Date(2100,0)));
    setSectionCount("now",list.length);

    $("#taskList").innerHTML=list.map(i=>{
      const d=parseDate(i.taskDeadline);
      const report=((i.deliverables||[]).length||i.publication)?'<span class="compact-chip report">Есть отчётность</span>':"";
      const aud=audienceText(i)?'<span class="compact-chip">'+esc(audienceText(i).replace("Кому: ",""))+'</span>':"";
      return '<button class="task-card-compact '+(i.priority==="urgent"?"urgent":i.priority==="high"?"high":"")+'" data-open="'+i.id+'">'
        +'<span class="compact-top"><span class="task-date"><b>'+(d?d.getDate():"—")+'</b><small>'+(d?monthShort[d.getMonth()]:"срок")+'</small></span><span class="compact-status">'+esc(deadlineLabel(i))+'</span></span>'
        +'<span class="compact-category">'+esc(i.category)+'</span>'
        +'<strong class="compact-title">'+esc(i.taskTitle)+'</strong>'
        +'<span class="compact-summary">'+esc(i.short)+'</span>'
        +'<span class="compact-meta">'+aud+report+'</span>'
        +'<span class="compact-open">Открыть инструкцию →</span>'
        +'</button>';
    }).join("")||'<div class="empty">В этой категории пока ничего нет.</div>';
    decorateCards("taskList");
  }

  function renderProjects(){
    const filters=[["all","Все актуальные"],["action","Акции"],["project","Проекты"],["event","События"],["upcoming","Скоро"],["active","Идёт сейчас"]];
    $("#projectFilters").innerHTML=filters.map(f=>'<button class="filter-btn '+(projectFilter===f[0]?"active":"")+'" data-project-filter="'+f[0]+'">'+f[1]+'</button>').join("");
    let list=items.filter(i=>isPublic(i)&&!expired(i)&&["action","project","event"].includes(i.type));
    if(["action","project","event"].includes(projectFilter)) list=list.filter(i=>i.type===projectFilter&&!expired(i));
    if(projectFilter==="upcoming") list=list.filter(i=>!expired(i)&&(startsInFuture(i)||(!i.start&&["upcoming","soon"].includes(i.status))));
    if(projectFilter==="active") list=list.filter(i=>!expired(i)&&isOngoing(i)&&!startsInFuture(i));
    if(projectFilter==="past") list=list.filter(i=>expired(i));
    list.sort((a,b)=>{
      const aPast=Boolean(expired(a)),bPast=Boolean(expired(b));
      if(aPast!==bPast) return Number(aPast)-Number(bPast);
      if(aPast) return (endDate(b)||parseDate(b.start))-(endDate(a)||parseDate(a.start));
      return (parseDate(a.start||a.deadline)||new Date(2100,0))-(parseDate(b.start||b.deadline)||new Date(2100,0));
    });
    const icons={action:"✦",project:"◇",event:"◉",task:"✓"};
    setSectionCount("projects",list.length);

    $("#projectList").innerHTML=list.map(i=>{
      const start=i.start?fmt(i.start):"";
      const next=nextDeadline(i);
      const secondary=next?"Ближайший срок: "+fmt(next):deadlineLabel(i);
      const past=Boolean(expired(i));
      const extra=past?"Завершено · материалы доступны":((i.formats||[]).length?i.formats.length+" формата участия":((i.steps||[]).length?i.steps.length+" шагов":""));
      return '<button class="project-card-compact '+i.type+(past?" is-past":"")+'" data-open="'+i.id+'">'
        +'<span class="project-kicker"><span class="project-icon">'+icons[i.type]+'</span><span class="project-dates">'+esc(start)+'<small>'+esc(secondary)+'</small></span></span>'
        +'<span class="project-category">'+esc(i.category)+'</span>'
        +'<strong class="project-compact-title">'+esc(i.title)+'</strong>'
        +'<span class="project-compact-summary">'+esc(i.short)+'</span>'
        +(extra?'<span class="project-compact-hint">'+esc(extra)+'</span>':"")
        +'<span class="compact-open">Полная инструкция →</span>'
        +'</button>';
    }).join("")||'<div class="empty">Ничего не найдено.</div>';
    decorateCards("projectList");
  }

  function renderCalendar(){
    const monthNom=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    const allEvents=calendarEntries();
    const monthSet=new Set([currentYm]);
    allEvents.forEach(e=>{if(e.date.slice(0,7)>="2026-09")monthSet.add(e.date.slice(0,7))});
    items.filter(isPublic).forEach(i=>stagesFor(i).forEach(stage=>{
      const from=(stage.start||stage.end||stage.monthStart||stage.monthEnd||"").slice(0,7);
      const to=(stage.end||stage.start||stage.monthEnd||stage.monthStart||"").slice(0,7);
      if(!from||!to)return;
      let [y,m]=from.split("-").map(Number);
      for(let n=0;n<60;n++){
        const key=y+"-"+String(m).padStart(2,"0");if(key>to)break;
        if(key>="2026-09")monthSet.add(key);
        if(++m>12){m=1;y++}
      }
    }));
    const monthKeys=[...monthSet].sort();
    if(!monthKeys.includes(calendarMonth))calendarMonth=currentYm;
    const years=new Set(monthKeys.map(m=>m.slice(0,4)));
    $("#calendarMonths").innerHTML=monthKeys.map(key=>{
      const [y,m]=key.split("-").map(Number);
      return '<button class="'+(calendarMonth===key?"active":"")+'" data-month="'+key+'" aria-pressed="'+(calendarMonth===key)+'">'+monthNom[m-1]+(years.size>1?" "+y:"")+'</button>';
    }).join("");
    if(!(D.meta?.site?.calendarSubtitle)&&monthKeys.length){
      const from=monthKeys[0],to=monthKeys[monthKeys.length-1];
      $("#calendarSubtitle").textContent=monthNom[Number(from.slice(5))-1]+" "+from.slice(0,4)+(from!==to?" — "+monthNom[Number(to.slice(5))-1]+" "+to.slice(0,4):"");
    }
    const [y,m]=calendarMonth.split("-").map(Number);
    const start=(new Date(y,m-1,1).getDay()+6)%7;
    const events=allEvents.filter(e=>e.date.startsWith(calendarMonth));
    setSectionCount("calendar",events.length);
    const eventButton=e=>'<button class="day-event calendar-'+e.kind+(e.date<todayMoscow?' is-past':'')+'" data-open="'+esc(e.item.id)+'" title="'+esc(e.title)+'"><span>'+esc(e.label)+(e.tentative?' · ориентировочно':'')+'</span>'+esc(e.title)+'</button>';
    let markup=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(day=>'<div class="calendar-weekday">'+day+'</div>').join("");
    for(let z=0;z<42;z++){
      const date=new Date(y,m-1,z-start+1);
      const iso=date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
      const dayEvents=allEvents.filter(e=>e.date===iso);
      markup+='<div class="calendar-day '+(date.getMonth()!==m-1?'outside ':'')+(iso===todayMoscow?'today':'')+'"><span class="day-num">'+date.getDate()+'</span><div class="day-events">'+dayEvents.slice(0,3).map(eventButton).join("")+(dayEvents.length>3?'<details class="day-more"><summary>Ещё '+(dayEvents.length-3)+'</summary>'+dayEvents.slice(3).map(eventButton).join("")+'</details>':'')+'</div></div>';
    }
    $("#calendarGrid").innerHTML=markup;
    $("#calendarAgenda").innerHTML=events.map(e=>{
      const date=parseDate(e.date);
      return '<button class="agenda-mobile-card" data-open="'+esc(e.item.id)+'"><span class="agenda-mobile-date calendar-'+e.kind+'"><b>'+date.getDate()+'</b><small>'+monthShort[date.getMonth()]+'</small></span><span class="agenda-mobile-copy"><small>'+esc(e.label)+(e.tentative?' · ориентировочно':'')+'</small><b>'+esc(e.title)+'</b><span>'+esc(e.item.category)+'</span></span></button>';
    }).join("")||'<div class="empty">В этом месяце нет событий с точной датой.</div>';
    const stages=stagesInMonth(calendarMonth);
    $("#calendarStageCount").textContent=stages.length;
    $("#calendarStages").innerHTML=stages.map(({item,stage})=>'<button class="calendar-stage-row" data-open="'+esc(item.id)+'"><span><b>'+esc(stage.title)+'</b><small>'+esc(item.title)+'</small></span><span>'+esc(stagePeriod(stage))+'</span></button>').join("")||'<div class="empty">Этапы с установленными сроками на этот месяц не указаны.</div>';
  }

  function renderDocs(){
    const docs=(D.documents||[]).filter(d=>d.url||(d.itemId&&items.some(i=>i.id===d.itemId&&isPublic(i))));
    setSectionCount("docs",docs.length);
    $("#docsList").innerHTML=docs.map(d=>{
      const action=d.itemId
        ? '<button data-open="'+d.itemId+'">Открыть →</button>'
        : '<a href="'+safeUrl(d.url)+'" target="_blank" rel="noopener">Открыть →</a>';
      return '<article class="doc-card saved-document"><div class="doc-icon">'+(d.kind==="Курс"?"▶":d.kind==="Справочник"?"#":"↗")+'</div><div><small>'+esc(d.kind)+'</small><h3>'+esc(d.title)+'</h3><p>'+esc(d.description)+'</p>'+action+'</div>'+favoriteButton(documentKey(d),d.title)+'</article>';
    }).join("");
  }

  function renderUpdates(){
    const list=Array.isArray(D.updates)?[...D.updates]:[];
    list.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
    setSectionCount("updates",Math.min(list.length,5));
    $("#updatesList").innerHTML=list.slice(0,5).map(u=>{
      const d=u.date?new Date(u.date):null;
      const date=d&&!Number.isNaN(d.getTime())?d.toLocaleDateString("ru-RU",{day:"numeric",month:"long",timeZone:"Europe/Moscow"}):"";
      return '<article class="update-card"><span>'+esc(date)+'</span><div><strong>'+esc(u.title)+'</strong><p>'+esc(u.text)+'</p></div></article>';
    }).join("")||'<div class="empty">Пока нет новых изменений.</div>';
  }

  function renderArchive(){
    const all=items.filter(i=>isPublic(i)&&expired(i)).sort((a,b)=>(endDate(b)||parseDate(b.start))-(endDate(a)||parseDate(a.start)));
    const itemDates=i=>[i.start,i.deadline,i.eventDate,i.reportDeadline,i.calendarDisplayDate].filter(d=>parseDate(d));
    const months=[...new Set(all.flatMap(i=>itemDates(i).map(d=>d.slice(0,7))))].sort().reverse();
    const label=m=>parseDate(m+"-01").toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
    const controls=$("#archiveFilters");
    if(controls)controls.innerHTML=[["all","Все завершённые"],...months.map(m=>[m,label(m)])].map(([id,title])=>'<button class="filter-btn '+(archiveFilter===id?"active":"")+'" data-archive-filter="'+id+'" aria-pressed="'+(archiveFilter===id)+'">'+esc(title)+'</button>').join("");
    const list=archiveFilter==="all"?all:all.filter(i=>itemDates(i).some(d=>d.startsWith(archiveFilter)));
    setSectionCount("archive",all.length);
    const dates=all.map(i=>endDate(i)||parseDate(i.start)).filter(Boolean).sort((a,b)=>a-b);
    const subtitle=$("#archiveSubtitle");
    if(subtitle){
      const label=dates.length?new Intl.DateTimeFormat("ru-RU",{month:"long",year:"numeric"}).formatRange(dates[0],dates[dates.length-1]):"Карточки и материалы завершённых событий";
      subtitle.textContent=label;
    }
    $("#archiveList").innerHTML=list.map(i=>{
      const date=endDate(i);const iso=date?date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0"):null;
      return '<button class="archive-card" data-open="'+i.id+'"><b>'+esc(i.title)+'</b><span>'+esc(i.category)+' · '+esc(iso?"завершено "+fmt(iso):"завершено")+'</span>'+(reportPending(i)?'<span class="archive-report">Публикация / отчёт до '+esc(fmt(i.reportDeadline))+'</span>':"")+'</button>';
    }).join("")||'<div class="empty">За выбранный месяц завершённых материалов нет.</div>';
    decorateCards("archiveList");
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
    if(stagesFor(i).length){
      detail+='<section class="detail-section"><details class="stage-timeline"><summary>Этапы и сроки конкурса ('+stagesFor(i).length+')</summary><ol>'+stagesFor(i).map(stage=>'<li><strong>'+esc(stage.title)+'</strong><span>'+esc(stagePeriod(stage))+'</span>'+(stage.note?'<small>'+esc(stage.note)+'</small>':"")+'</li>').join("")+'</ol></details></section>';
    }
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
    $("#modalContent").innerHTML='<div class="modal-kicker"><span class="badge">'+esc(typeLabel[i.type]||i.type)+'</span><span class="tag">'+esc(i.category)+'</span>'+badgeMarkup(i)+'</div><h2 id="modalTitle">'+esc(i.title)+'</h2><div class="modal-save">'+favoriteButton("item:"+i.id,i.title)+'<span>Сохранить в избранном</span></div><p class="modal-summary">'+esc(i.short)+'</p>'+overview+calendarActions+detail;
    lastFocused=document.activeElement;
    $("#searchPanel").hidden=true;
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
    const anchor=e.target.closest('a[href^="#"]');
    if(anchor) revealSection(anchor.getAttribute("href"));
    let x=e.target.closest("[data-favorite]");if(x){
      const key=x.dataset.favorite;
      const wasSaved=favorites.has(key);
      const inFavorites=Boolean(x.closest("#favoritesList"));
      if(wasSaved)favorites.delete(key);else favorites.add(key);
      savePreferences();refreshFavoriteButtons();renderFavorites();
      if(inFavorites){const target=$("#favoritesList [data-favorite]")||$("#favorites .section-summary");if(target)target.focus()}
      toast(wasSaved?"Убрано из избранного":"Добавлено в избранное");return;
    }
    x=e.target.closest("[data-sections]");if(x){
      const open=x.dataset.sections==="expand";
      [...sectionDisclosures(),$("#heroDeadlines")].filter(Boolean).forEach(el=>{el.open=open});rememberSections();return;
    }
    x=e.target.closest("[data-view]");if(x){preferences.view=x.dataset.view;savePreferences();applyView();return}
    x=e.target.closest("[data-open]"); if(x){openModal(x.dataset.open);return}
    x=e.target.closest("[data-task-filter]"); if(x){taskFilter=x.dataset.taskFilter;renderTasks();return}
    x=e.target.closest("[data-project-filter]"); if(x){projectFilter=x.dataset.projectFilter;renderProjects();return}
    x=e.target.closest("[data-archive-filter]");if(x){archiveFilter=x.dataset.archiveFilter;renderArchive();return}
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
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();const input=$("#globalSearch");if(input)input.focus()}
    if(e.key==="Escape"){closeModal();const panel=$("#searchPanel");if(panel)panel.hidden=true;document.body.style.overflow="";return}
    const modal=$("#detailModal");
    if(e.key==="Tab"&&modal&&!modal.hidden){
      const focusables=$$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary',modal).filter(x=>x.offsetParent!==null);
      if(!focusables.length)return;
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
  });

  const shortcut=$("#searchShortcut");
  if(shortcut) shortcut.textContent=/Mac|iPhone|iPad/i.test(navigator.platform||"")?"⌘ K":"Ctrl K";
  window.addEventListener("storage",e=>{
    if(e.key!==preferencesKey&&e.key!==null)return;
    preferences=readPreferences();favorites=new Set(Array.isArray(preferences.favorites)?preferences.favorites.filter(x=>typeof x==="string"):[]);
    applyView();refreshFavoriteButtons();renderFavorites();
  });
  run("view",applyView);
  run("section-numbers",numberSections);
  run("settings",applySiteSettings);
  run("freshness",renderFreshness);
  run("hero",renderHero);
  run("tasks",renderTasks);
  run("calendar",renderCalendar);
  run("projects",renderProjects);
  run("docs",renderDocs);
  run("updates",renderUpdates);
  run("archive",renderArchive);
  run("favorites",renderFavorites);
  run("week",renderWeek);
  run("sidebar",setupSidebar);
  run("deep-link",()=>{
    const deepLinkedCard=new URL(location.href).searchParams.get("card");
    if(deepLinkedCard)setTimeout(()=>openModal(deepLinkedCard),0);
  });
})();

