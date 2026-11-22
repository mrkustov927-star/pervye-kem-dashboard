'use client';
import {useRef,useState} from 'react';
import {Ban, CalendarDays, FileText, Link2, Plus} from 'lucide-react';
import type {ViewProps} from './planner';
import {forTeam, getTask, leagues, statuses, variant, variantFields, ref, type Task, type Template, type Variant} from './model';
import {taskRelations, type TaskRelation} from './relations';
import {TaskChecklist} from './task-checklist';

const labels: Record<TaskRelation['kind'], string> = {
 required: 'Требование Порядка', optional: 'Возможность для команды', excluded: 'Ограничение выбора партнёра',
 before: 'По плану команды · сначала', after: 'По плану команды · затем', event: 'Событие команды',
};

function SelectedTask({p,task,state,current,readOnly,shown,onPreview}:{p:ViewProps;task:Template;state:Task;current:Variant;shown:Variant;onPreview:(id:string)=>void;readOnly:boolean}) {
 const {team}=p;
 const preview=shown.id!==current.id;
 const automatic=task.key==='lo-10';
 const patch=(fields:Partial<Task>)=>p.update(next=>{
  const key=ref(team.id,task.key);
  next.tasks[key]={...getTask(next,team,task),...fields};
 });
 return <>
  <div className="route-stop-head"><div><p className="eyebrow">Задание № {task.number} · до {task.points} баллов · {statuses[state.status]}</p>
   <h2>{shown.title}</h2></div>
   {!preview&&<button type="button" className="button secondary" onClick={()=>p.openTask(task.key,'plan')}><FileText size={16}/>План и сроки</button>}
  </div>
  {task.variants.length>1&&<fieldset className="map-variants"><legend>Варианты задания</legend>
   <div className="map-variant-options">{task.variants.map((v,i)=><label key={v.id}>
    <input type="radio" name="map-variant" checked={shown.id===v.id} onChange={()=>onPreview(v.id)}/>
    <span><small>Вариант {i+1}{v.id===current.id?' · в плане команды':''}</small><strong>{v.title}</strong></span>
   </label>)}</div>
   {automatic&&<p>Без шефа команда выполняет вариант 1, с шефом — вариант 2.</p>}
   {preview&&<div className="map-variant-preview"><p>Вы просматриваете чек-лист другого варианта.</p>
    {!automatic&&!readOnly&&<>{!!(state.steps.length||Object.keys(state.reports).length||Object.keys(state.metrics).length)&&<p>При смене варианта сбросятся его этапы, показатели и материалы отчёта.</p>}
     <button type="button" className="button primary" onClick={()=>patch(variantFields(shown))}>Выбрать для плана команды</button></>}
   </div>}
  </fieldset>}
  <TaskChecklist key={shown.id} leagueName={leagues[team.league]} task={preview?{...state,reports:{}}:state} template={task} variant={shown}
   readOnly={readOnly||preview} patch={patch} openReports={preview||readOnly?undefined:()=>p.openTask(task.key,'reports')}/>
 </>;
}

export function MapView(p: ViewProps) {
 const {plan, team, readOnly} = p;
 const list = forTeam(team);
 const task = list.find(item => item.key === p.selected) ?? list[0];
 const state = getTask(plan, team, task);
 const v = variant(task, state, team);
 const groups = taskRelations(plan, team, task);
 const contest = groups.filter(g => ['required','optional','excluded'].includes(g.kind));
 const own = groups.filter(g => ['before','after','event'].includes(g.kind));
 const [query,setQuery]=useState('');
 const [statusFilter,setStatusFilter]=useState('');
 const [preview,setPreview]=useState<{scope:string;id:string}|null>(null);
 const scope=task.key+'/'+v.id;
 const shown=(preview?.scope===scope&&task.variants.find(option=>option.id===preview.id))||v;
 const matchingVariant=(item:Template)=>{
  const term=query.trim().toLocaleLowerCase('ru');
  const found=term?item.variants.filter(option=>option.title.toLocaleLowerCase('ru').includes(term)):[];
  return found.length===1?found[0]:undefined;
 };
 const stopPanel = useRef<HTMLElement>(null);
 const stops = list.map(item => {
  const progress = getTask(plan,team,item);
  return {item,title:variant(item,progress,team).title,status:progress.status};
 });
 const matches=stops.filter(({item,status})=>(!statusFilter||statusFilter===status)&&
  [String(item.number),item.title,...item.variants.map(option=>option.title),getTask(plan,team,item).owner].join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
 function selectStop(key:string) {
  const item=list.find(item=>item.key===key)!;
  const choice=matchingVariant(item);
  if(!matches.some(stop=>stop.item.key===key)){setQuery('');setStatusFilter('')}
  setPreview(choice?{scope:key+'/'+variant(item,getTask(plan,team,item),team).id,id:choice.id}:null);
  p.selectTask(key);
  if(window.matchMedia('(max-width:850px)').matches){
   requestAnimationFrame(()=>{stopPanel.current?.focus({preventScroll:true});stopPanel.current?.scrollIntoView({block:'start'})});
  }
 }
 function relation(group: TaskRelation) {
  const links = group.targets.map(target => {
   const tm = plan.teams.find(t => t.id === target.teamId);
   const item = tm && forTeam(tm).find(t => t.key === target.taskKey);
   if (!tm || !item) return null;
   return <button type="button" className="related-task-button" key={tm.id+'/'+item.key} onClick={() => p.focusTask(tm.id,item.key)}>
    <span className="related-number">№ {item.number}</span><span><strong>{variant(item,getTask(plan,tm,item),tm).title}</strong><small>{tm.name} · {leagues[tm.league]}</small></span>
   </button>;
  });
  return <article key={group.id} className={'task-relation '+group.kind}>
   <div className="relation-kind">{group.kind==='excluded'?<Ban size={16}/>:group.kind==='event'?<CalendarDays size={16}/>:<Link2 size={16}/>} {labels[group.kind]}</div>
   <h3>{group.title}</h3><p>{group.detail}</p>
   {links.length>4?<details className="related-targets-fold"><summary>Показать задания ({links.length})</summary><div className="related-targets">{links}</div></details>:links.length>0&&<div className="related-targets">{links}</div>}
   {group.kind==='required'&&!links.length&&<div className="relation-setup"><p>Для этой первички ещё не выбрана подшефная команда.</p><button className="button secondary" onClick={p.showTeams}>Открыть команды</button></div>}
   {group.eventId&&<button className="text-button" onClick={()=>p.openEvent(plan.events.find(e=>e.id===group.eventId))}>Посмотреть событие</button>}
  </article>;
 }
 return <div className="route-view">
  <section className="panel route-board" aria-label="Маршрут по статусам">
   <h2>Выбор задания</h2>
   <div className="task-lookup">
    <label>Задание<select aria-label="Задание" value={matches.some(({item})=>item.key===task.key)?task.key:''} onChange={e=>selectStop(e.target.value)}>
     <option value="" disabled>{matches.length?'Выберите из списка':'Задания не найдены'}</option>
     {matches.map(({item})=><option key={item.key} value={item.key}>№ {item.number}. {item.variants.map(option=>option.title).join(' / ')}</option>)}
    </select></label>
    <label>Поиск<input type="search" placeholder="Название, номер, ответственный" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label>Статус<select aria-label="Фильтр по статусу" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Все статусы</option>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   </div>
   {(query||statusFilter)&&<div className="task-matches" aria-live="polite">{matches.length?matches.map(({item,title})=><button type="button" className="button secondary" key={item.key} onClick={()=>selectStop(item.key)}>№ {item.number}. {matchingVariant(item)?.title??(item.variants.length>1?item.title:title)}</button>):<p>По этим условиям заданий нет.</p>}</div>}
   <details className="route-overview"><summary>Маршрут команды по статусам</summary>
   <ol className="route-stages">{Object.entries(statuses).map(([status,label])=>{
    const entries=stops.filter(stop=>stop.status===status);
    return <li key={status} className={'route-stage route-'+status}>
     <div className="route-station"><span aria-label={'Количество заданий: '+entries.length}>{entries.length}</span></div>
     <h3>{label}</h3>
     <div className="route-numbers">{entries.map(({item,title})=><button key={item.key} type="button"
       aria-controls="route-stop" aria-label={'Задание № '+item.number+'. '+title} title={title}
       aria-pressed={item.key===task.key} onClick={()=>selectStop(item.key)}>{item.number}</button>)}</div>
    </li>;
   })}</ol></details>
  </section>
  <section hidden={!matches.some(stop=>stop.item.key===task.key)} id="route-stop" className="panel route-stop" ref={stopPanel} tabIndex={-1} aria-label="Выбранное задание">
   <SelectedTask key={team.id+'/'+task.key+'/'+v.id} p={p} task={task} state={state} current={v} shown={shown} onPreview={id=>setPreview({scope,id})} readOnly={!!readOnly}/>
   {(task.number===2||contest.length>0)&&<section className="map-block"><h3>Что учесть по Порядку</h3>
    {task.number===2&&<p>В бортовой журнал входят события Календаря Первых, всероссийские акции Дней единых действий и собственные мероприятия первички. Каждое событие учитывается один раз. Мероприятия по другим конкурсным заданиям в журнал не включаются.</p>}
    {contest.map(relation)}
   </section>}
   <section className="map-block"><h3>Связи в плане команды</h3>
    {own.length?own.map(relation):<p>{readOnly?'Команда пока не добавила связей.':'Если команда выполняет задание отдельно, здесь ничего заполнять не нужно.'}</p>}
    {!readOnly&&<div className="map-actions"><button className="button secondary" onClick={()=>p.openTask(task.key,'links')}><Link2 size={16}/>Указать, что сделать сначала</button><button className="button secondary" onClick={()=>p.openEvent(undefined,task.key)}><Plus size={16}/>{task.number===2?'Добавить событие в журнал':'Запланировать событие'}</button></div>}
   </section>
  </section>
 </div>;
}
