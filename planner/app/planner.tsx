'use client';
import {useEffect,useRef,useState} from 'react';
import {ListChecks,Map,CalendarDays,Users,NotebookPen,ShieldCheck,Plus,Download,Upload,Cloud,LoaderCircle,Check,AlertTriangle,Printer,Undo2} from 'lucide-react';
import {Plan,Team,Template,Event,League,forTeam,getTask,variant,initialPlan,parsePlan,leagues,colors,allIssues,ref,seedDates,uid} from './model';
import {MapView,CalendarView,JournalView,TeamsView,RulesView} from './views';
import {TaskDialog,EventDialog,TeamDialog} from './dialogs';
import {ChecklistReader} from './checklist-reader';
export type Update=(fn:(p:Plan)=>void)=>void;
export type ViewProps={readOnly?:boolean;plan:Plan;team:Team;update:Update;openTask:(key:string,tab?:string)=>void;openEvent:(e?:Event,taskKey?:string,preset?:Partial<Event>)=>void;openTeam:(t?:Team)=>void;selectTeam:(id:string)=>void;focusTask:(teamId:string,key:string)=>void;showTeams:()=>void;selected:string;selectTask:(key:string)=>void};
const nav=[['map','Задания',Map],['checklists','Чек-листы',ListChecks],['calendar','Календарь',CalendarDays],['journal','Журнал',NotebookPen],['teams','Команды',Users],['rules','Условия и источники',ShieldCheck]] as const;
const CACHE='kpo-curators-shared-draft-v1';
export default function Planner(){
 const [plan,setPlan]=useState<Plan>(initialPlan),[teamId,setTeamId]=useState('team-main'),[view,setView]=useState('map'),[selected,setSelected]=useState('lv-1'),[loaded,setLoaded]=useState(false),[mode,setMode]=useState('saved'),[save,setSave]=useState('loading'),[saveError,setSaveError]=useState(''),[toast,setToast]=useState(''),[taskDialog,setTaskDialog]=useState<string|null>(null),[taskTab,setTaskTab]=useState('checklist'),[eventDialog,setEventDialog]=useState<{event?:Event;taskKey?:string;preset?:Partial<Event>}|null>(null),[teamDialog,setTeamDialog]=useState<{team?:Team}|null>(null),[backup,setBackup]=useState<Plan|null>(null),[exportMenu,setExportMenu]=useState(false);
 const [previewLeague,setPreviewLeague]=useState<League|null>(null);
 const revision=useRef(''),lastSaved=useRef(''),inFlight=useRef(false),queued=useRef<Plan|null>(null),conflict=useRef(false),undo=useRef<Plan|null>(null),importRef=useRef<HTMLInputElement>(null);
 const savedTeam=plan.teams.find(t=>t.id===teamId)??plan.teams[0];
 const team:Team=previewLeague?{...savedTeam,id:'preview-'+previewLeague,name:'Обзор номинации',league:previewLeague,mentorId:''}:savedTeam;
 const readOnly=mode==='readonly'||!!previewLeague;
 const list=forTeam(team),issues=allIssues(plan,team),finished=list.filter(t=>getTask(plan,team,t).status==='submitted').length;
 const errors=issues.filter(issue=>issue.level==='error');
 function notify(s:string){setToast(s);setTimeout(()=>setToast(''),4500)}
 const update:Update=(fn)=>{if(readOnly){notify('Изменения доступны только организатору.');return;}setPlan(prev=>{undo.current=prev;const next=structuredClone(prev);fn(next);next.updatedAt=new Date().toISOString();return next});};
 useEffect(()=>{let stopped=false;let cached:Plan|null=null;try{const s=localStorage.getItem(CACHE);if(s)cached=parsePlan(s)}catch{}(window as any).planRequest({cache:'no-store'}).then(async r=>{const j:any=await r.json();if(!r.ok)throw Error(j.error);if(stopped)return;revision.current=j.revision??'';setMode(j.mode);const next=j.state?parsePlan(JSON.stringify(j.state)):j.mode==='saved'&&cached?cached:initialPlan();setPlan(next);lastSaved.current=JSON.stringify(next);if(cached&&cached.updatedAt&&j.mode==='saved'&&(!j.state||JSON.stringify(cached)!==JSON.stringify(next))){try{localStorage.setItem('kpo-curators-pre-merge-backup-v1',JSON.stringify(cached))}catch{}setBackup(cached);}setSave(j.mode==='readonly'?'readonly':'saved');setLoaded(true)}).catch(e=>{if(stopped)return;if(cached)setPlan(cached);setMode('offline');setSave('error');setSaveError('План не загружен: '+e.message);setLoaded(true)});return()=>{stopped=true}},[]);
 async function persist(snapshot:Plan){if(conflict.current)return;if(inFlight.current){queued.current=snapshot;return}inFlight.current=true;setSave('saving');try{const r=await (window as any).planRequest({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot,revision:revision.current})});const j:any=await r.json();if(!r.ok){if(r.status===409)conflict.current=true;throw Error(j.error||'Не удалось сохранить')}revision.current=j.revision;lastSaved.current=JSON.stringify(snapshot);setSave('saved');setSaveError('')}catch(e:any){setSave('error');setSaveError(e.message)}finally{inFlight.current=false;const next=queued.current;queued.current=null;if(next&&JSON.stringify(next)!==lastSaved.current&&!conflict.current)persist(next)}}
 useEffect(()=>{if(!loaded)return;if(mode==='readonly')return;try{localStorage.setItem(CACHE,JSON.stringify(plan))}catch{}if(JSON.stringify(plan)===lastSaved.current)return;if(mode==='offline')return;const timer=setTimeout(()=>persist(plan),900);return()=>clearTimeout(timer)},[plan,loaded,mode]);
 useEffect(()=>{if(!list.some(t=>t.key===selected))setSelected(list[0].key)},[teamId,team.league]);
 function chooseTeam(id:string){setPreviewLeague(null);setTeamId(id);setTaskDialog(null)}
 function openTask(key:string,tab='checklist'){setSelected(key);setTaskTab(tab);setTaskDialog(key)}
 function chooseNomination(league:League){if(team.league===league)return;const existing=plan.teams.find(t=>t.league===league);if(existing){chooseTeam(existing.id);return}setPreviewLeague(league);setTaskDialog(null)}

 function focusTask(id:string,key:string){setPreviewLeague(null);setTeamId(id);setSelected(key);setTaskDialog(null);setView('map')}
 function download(type:'json'|'csv'){let value='',mime='',name='';if(type==='json'){value=JSON.stringify(plan,null,2);mime='application/json';name='plan-pervye.json'}else{const rows=[['Лига','Первичка','Задание','Вариант','Ответственный','Подготовка','Событие','Сдача','Статус'],...list.map(t=>{const a=getTask(plan,team,t),v=variant(t,a,team);return[leagues[team.league],team.name,'№ '+t.number,v.title,a.owner,a.start,a.end,a.submit,a.status]})];value='\uFEFF'+rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(';')).join('\r\n');mime='text/csv;charset=utf-8';name='plan-pervye.csv'}const url=URL.createObjectURL(new Blob([value],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setExportMenu(false)}
 async function importFile(file?:File){if(!file)return;try{if(file.size>1500000)throw Error('Файл слишком большой');const next=parsePlan(await file.text());undo.current=plan;next.updatedAt=new Date().toISOString();setPlan(next);setTeamId(next.teams[0].id);notify('План импортирован. Предыдущую версию можно вернуть кнопкой отмены.')}catch(e:any){notify(e.message)}if(importRef.current)importRef.current.value=''}

 function mergeLocalDraft(){
  if(!backup||mode!=='saved')return;
  const draft=backup;
  update(next=>{
   const idMap=new Map<string,string>();
   const normalize=(name:string)=>name.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g,' ');
   for(const t of draft.teams){
    const existing=next.teams.find(x=>x.id===t.id)||next.teams.find(x=>x.league===t.league&&normalize(x.name)===normalize(t.name));
    if(existing){idMap.set(t.id,existing.id);continue;}
    next.teams.push({...t,mentorId:''});idMap.set(t.id,t.id);
   }
   for(const t of draft.teams){
    const target=next.teams.find(x=>x.id===idMap.get(t.id));
    const mentor=idMap.get(t.mentorId);
    if(target&&target.league==='lo'&&!target.mentorId&&mentor&&next.teams.some(x=>x.id===mentor&&x.league==='pl'))target.mentorId=mentor;
   }
   for(const [key,task] of Object.entries(draft.tasks)){
    const n=key.indexOf('/');if(n<1)continue;
    const mapped=idMap.get(key.slice(0,n));if(!mapped)continue;
    const targetKey=mapped+key.slice(n);
    if(!(targetKey in next.tasks))next.tasks[targetKey]=task;
   }
   const existingEvents=new Set(next.events.map(e=>e.id));
   for(const e of draft.events){
    if(existingEvents.has(e.id))continue;
    const teamIds=[...new Set(e.teamIds.map(id=>idMap.get(id)).filter((id):id is string=>!!id))];
    if(!teamIds.length)continue;
    const journalTeams=[...new Set(e.journalTeams.map(id=>idMap.get(id)).filter((id):id is string=>!!id))];
    const taskRefs=e.taskRefs.map(r=>{const n=r.indexOf('/');if(n<0)return '';const mapped=idMap.get(r.slice(0,n));return mapped?mapped+r.slice(n):''}).filter(Boolean);
    next.events.push({...e,teamIds,journalTeams,taskRefs});
   }
  });
  setBackup(null);
  notify('Локальные команды и новые записи объединены с общим планом');
 }
 const props:ViewProps={readOnly,plan,team,update,openTask,openEvent:(event,taskKey,preset)=>setEventDialog(taskKey&&list.some(t=>t.key===taskKey&&t.number===2)?{event,preset:{category:'own',journalTeams:[team.id],...preset}}:{event,taskKey,preset}),openTeam:t=>readOnly?notify('Изменение команд доступно только организатору.'):setTeamDialog({team:t}),selectTeam:chooseTeam,focusTask,showTeams:()=>{setPreviewLeague(null);setView('teams')},selected,selectTask:setSelected};
 if(!loaded)return <div className="boot"><div className="brand-mark"><span/><span/><span/></div><h1>План работы первичек</h1><p><LoaderCircle className="spin" size={20}/> Открываем ваш план</p></div>;
 return <><div className="app-shell"><aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setView('map')}}><div className="brand-mark"><span/><span/><span/></div><div>ПЕРВИЧКА<span>План работы</span></div></a><div className="season-tag">КОНКУРС · СЕЗОН 4</div><nav>{nav.map(([key,title,Icon])=><button key={key} className={view===key?'nav-item active':'nav-item'} aria-current={view===key?'page':undefined} onClick={()=>{setView(key);if(key==='teams')setPreviewLeague(null)}}><Icon size={20}/>{title}</button>)}</nav><div className="sidebar-bottom"><div className="tiny-label">ОБЩИЙ ЗАЧЁТ</div><strong>23 ноя — 28 фев</strong><p>Капитан отправляет отчёты в личном кабинете конкурса.</p><div className="sidebar-foot">План команды · не кабинет конкурса</div></div></aside>
 <div className="main-shell"><header className="topbar"><div className="workspace-name">Работа первичных отделений<span>2026–2027</span></div><div className="top-actions"><span className={'save-state '+save} title={saveError}>{save==='saving'?<LoaderCircle size={16} className="spin"/>:save==='saved'?<Cloud size={16}/>:<AlertTriangle size={16}/>}<span>{save==='saving'?'Сохраняем':save==='saved'?'Сохранено':save==='readonly'?'Только просмотр':'Не сохранено'}</span></span><button className="icon-button" aria-label="Отменить последнее изменение" title="Отменить последнее изменение" disabled={!undo.current} onClick={()=>{if(undo.current){const previous=undo.current;undo.current=plan;setPlan({...previous,updatedAt:new Date().toISOString()});notify('Изменение отменено')}}}><Undo2 size={18}/></button><div className="export-wrap"><button className="button secondary compact" aria-label="Скачать или распечатать план" aria-expanded={exportMenu} onClick={()=>setExportMenu(!exportMenu)}><Download size={17}/><span>Скачать</span></button>{exportMenu&&<div className="export-menu"><button onClick={()=>download('json')}>Резервная копия всех команд (JSON)</button><button onClick={()=>download('csv')}>Таблица заданий команды (CSV)</button><button onClick={()=>{window.print();setExportMenu(false)}}><Printer size={16}/> Распечатать план команды</button>{mode==='saved'&&<button onClick={()=>importRef.current?.click()}><Upload size={16}/> Восстановить все команды из копии</button>}</div>}</div><input type="file" accept=".json,application/json" ref={importRef} hidden onChange={e=>importFile(e.target.files?.[0])}/></div></header>
 <main><div className="page-heading"><div><p className="eyebrow">{view==='checklists'?'ОБЩИЙ ЗАЧЁТ':view==='map'?'ЗАДАНИЯ, КОМАНДЫ И СРОКИ':view==='calendar'?'ВРЕМЯ И НАГРУЗКА':view==='journal'?'СОБЫТИЯ И ПОДТВЕРЖДЕНИЯ':view==='teams'?'ПЕРВИЧКИ И НАСТАВНИЧЕСТВО':view==='rules'?'ОСНОВАНИЯ ПЛАНА':'ЦЕЛИ И РЕЗУЛЬТАТЫ'}</p><h1>{view==='checklists'?'Чек-листы':view==='map'?'Задания и маршрут команды':view==='calendar'?'Календарь команды':view==='journal'?'Бортовой журнал':view==='teams'?'Команды и связи':view==='rules'?'Условия и источники':'Задания и план работы'}</h1><p className="page-description">{view==='checklists'?'Выберите лигу и откройте нужное задание.':view==='map'?'Выберите задание общего зачёта, сравните варианты и сверьте материалы с критериями оценки.':view==='calendar'?'Ваши даты и рекомендованные интервалы видны отдельно.':view==='journal'?'Собирайте самостоятельные события и проверяйте их место в зачёте.':view==='teams'?'Выберите своё отделение, чтобы увидеть его задания и шефские связи.':view==='rules'?'Официальные требования, тематические поводы и рабочие предложения.':'От конкретного действия до проверяемого результата и готового отчёта.'}</p></div>{view==='calendar'&&!readOnly&&<button className="button primary" onClick={()=>setEventDialog({})}><Plus size={18}/> Добавить событие</button>}</div>
 
 {save==='error'&&<div className="notice danger"><AlertTriangle size={19}/><div><b>Изменения пока не сохранены.</b> {saveError} {mode==='offline'?'Обновите страницу, когда связь восстановится.':'Повторите сохранение, прежде чем закрыть страницу.'}</div>{!conflict.current&&mode!=='offline'&&<button onClick={()=>persist(plan)}>Повторить</button>}</div>}

 {mode==='saved'&&backup&&<div className="notice"><Undo2 size={18}/><div><b>На этом устройстве найдены дополнительные записи.</b> Их можно добавить в общий план, не затрагивая уже сохранённые данные.</div><button onClick={mergeLocalDraft}>Добавить в общий план</button><button onClick={()=>setBackup(null)}>Позже</button></div>}
 {['map','calendar','journal'].includes(view)&&<><section className="nomination-section"  aria-label="Выбор номинации"><h2>Номинация конкурса</h2><div className="nomination-switch" role="group" aria-label="Номинация конкурса">{(Object.keys(leagues) as League[]).map(code=><button type="button" key={code} aria-pressed={team.league===code} className={'nomination-choice '+code+(team.league===code?' selected':'')} onClick={()=>chooseNomination(code)}><span className="nomination-choice-title">{leagues[code]}{team.league===code&&<Check size={18}/>}</span><span>{code==='lo'?'10 заданий · до 480 баллов':code==='pl'?'15 заданий · до 740 баллов и 20 за шефство':'15 заданий · до 740 баллов'}</span></button>)}</div></section>
 <div className="context-bar"><span className="context-caption">Первичка:</span>{previewLeague?<span>В этой номинации пока нет команд. Открыты условия заданий.</span>:<label className="team-picker"><span className="team-dot" style={{background:colors[team.league]}}/><select aria-label="Активная первичка" value={team.id} onChange={e=>chooseTeam(e.target.value)}>{plan.teams.filter(t=>t.league===team.league).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>}<span className="context-spacer"/><span className="context-stat"><Check size={16}/>{finished} из {list.length} сдач отмечено</span>{errors.length>0&&<details className="plan-problems"><summary><AlertTriangle size={16}/>Замечания к плану ({errors.length})</summary>
 {errors.map((issue,i)=><button className="text-button" key={i} onClick={()=>{
  if(issue.eventId)props.openEvent(plan.events.find(e=>e.id===issue.eventId));
  else if(issue.taskKey)openTask(issue.taskKey,issue.title.includes('комплект')?'reports':/зависим|Цикл/.test(issue.title)?'links':'plan');
 }}>{issue.taskKey?'№ '+list.find(t=>t.key===issue.taskKey)?.number+' · ':''}{issue.title} — {issue.detail}</button>)}</details>}</div></>}
 {view==='checklists'?<ChecklistReader league={team.league}/>:view==='map'?<MapView key={team.id} {...props}/>:view==='calendar'?<CalendarView {...props}/>:view==='journal'?<JournalView key={team.id} {...props}/>:view==='teams'?<TeamsView {...props}/>:<RulesView/>}
 <footer className="page-footer">Общий зачёт до 28 февраля 2027, 23:59 мск · Статусы в плане отмечает команда</footer></main></div></div>
 {taskDialog&&<TaskDialog key={team.id+'/'+taskDialog+'/'+taskTab} {...props} initialTab={taskTab} taskKey={taskDialog} close={()=>setTaskDialog(null)}/>}{eventDialog&&<EventDialog {...props} value={eventDialog.event} presetTask={eventDialog.taskKey} preset={eventDialog.preset} close={()=>setEventDialog(null)}/>}{teamDialog&&<TeamDialog {...props} value={teamDialog.team} close={()=>setTeamDialog(null)}/>}
 {toast&&<div className="toast" role="status"><Check size={18}/>{toast}</div>}
 <div className="print-sheet"><h1>План работы: {team.name}</h1><p>{leagues[team.league]} · Общий зачёт 23.11.2026–28.02.2027</p>{list.map(t=>{const a=getTask(plan,team,t),v=variant(t,a,team);return <section key={t.key}><h2>№ {t.number}. {v.title}</h2><p>{a.goal||v.specific}</p><p>Аудитория: {a.audience||'не указана'}; ответственный: {a.owner||'не назначен'}</p><p>Подготовка: {a.start||'уточнить'}; событие: {a.end||'уточнить'}; сдача: {a.submit||'уточнить'}</p><p>Измерители: {v.metrics.map(m=>m.label+': '+m.target+' '+m.unit).join('; ')}</p><p>Ресурсы: {a.resourcesText||v.resources.join(', ')}</p><p>Отчёт: {v.reports.map(r=>r.label).join('; ')}</p></section>})}<p>Рекомендации и рабочие интервалы не являются дополнительными конкурсными сроками.</p></div></>;
}
