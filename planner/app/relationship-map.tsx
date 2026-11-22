'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Ban,CalendarDays,Check,FileText,Info,Link2,Plus,Users} from 'lucide-react';
import type {ViewProps} from './planner';
import {dateLabel,forTeam,getTask,leagues,statuses,variant} from './model';
import {taskRelations,TaskRelation} from './relations';

const kindLabels:Record<TaskRelation['kind'],string>={required:'Требование Порядка',optional:'Можно совместить',excluded:'Учитывать отдельно',before:'Последовательность команды',after:'Последовательность команды',event:'Событие в вашем плане'};

export function MapView(p:ViewProps){
 const {plan,team,selected}=p,list=forTeam(team),task=list.find(t=>t.key===selected)??list.at(-1)!;
 const state=getTask(plan,team,task),v=variant(task,state,team),groups=taskRelations(plan,team,task);
 const flow=useRef<HTMLDivElement>(null),marker='relation-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const [edges,setEdges]=useState<{id:string;kind:TaskRelation['kind'];path:string}[]>([]);
 useEffect(()=>{
  const node=flow.current;if(!node)return;
  const measure=()=>{
   const source=node.querySelector<HTMLElement>('[data-source]');if(!source)return;
   const base=node.getBoundingClientRect(),a=source.getBoundingClientRect(),targets=Array.from(node.querySelectorAll<HTMLElement>('[data-relation]'));
   const next=groups.flatMap(group=>{const target=targets.find(t=>t.dataset.relation===group.id);if(!target)return [];const b=target.getBoundingClientRect(),x=a.right-base.left,y=a.top+a.height/2-base.top,tx=b.left-base.left,ty=b.top+b.height/2-base.top,m=x+(tx-x)/2;return [{id:group.id,kind:group.kind,path:`M ${x} ${y} C ${m} ${y}, ${m} ${ty}, ${tx} ${ty}`}];});
   setEdges(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
  };
  const observer=new ResizeObserver(measure);observer.observe(node);const timer=requestAnimationFrame(measure);
  return()=>{observer.disconnect();cancelAnimationFrame(timer)};
 },[team.id,task.key,plan.updatedAt,groups.length]);
 const nearby=new Set(groups.flatMap(g=>g.targets.filter(t=>t.teamId===team.id).map(t=>t.taskKey)));
 function targetButton(target:{teamId:string;taskKey:string}){
  const tm=plan.teams.find(t=>t.id===target.teamId);if(!tm)return null;
  const t=forTeam(tm).find(t=>t.key===target.taskKey);if(!t)return null;
  const vv=variant(t,getTask(plan,tm,t),tm);
  return <button type="button" className="related-task-button" key={target.teamId+'/'+target.taskKey} onClick={()=>p.focusTask(target.teamId,target.taskKey)}><span className="related-number">№ {t.number}</span><span><strong>{vv.title}</strong><small>{tm.name} · {leagues[tm.league]}</small></span></button>;
 }
 return <>
  <section className="panel relationship-picker" aria-label="Выбор задания для схемы">
   <div className="relationship-toolbar"><div><h2>Как связаны задания</h2><p>Выберите задание: у каждой линии указаны смысл и основание связи.</p></div><label>Задание на схеме<select aria-label="Задание на схеме" value={task.key} onChange={e=>p.selectTask(e.target.value)}>{list.map(t=><option key={t.key} value={t.key}>№ {t.number}. {variant(t,getTask(plan,team,t),team).title}</option>)}</select></label></div>
   <div className="task-quickpick" role="group" aria-label="Быстрый выбор задания">{list.map(t=><button type="button" key={t.key} aria-pressed={t.key===task.key} aria-label={'Задание № '+t.number+'. '+variant(t,getTask(plan,team,t),team).title} title={'№ '+t.number+'. '+variant(t,getTask(plan,team,t),team).title} className={(t.key===task.key?'selected ':'')+(nearby.has(t.key)?'has-relation':'')} onClick={()=>p.selectTask(t.key)}>{t.number}</button>)}{nearby.size>0&&<span>Выделены номера связанных заданий</span>}</div>
  </section>
  <section className="panel relations-panel" aria-label="Связи выбранного задания">
   <div className="relation-flow" ref={flow}>
    <svg className="relation-edges" aria-hidden="true"><defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke"/></marker></defs>{edges.map(e=><path key={e.id} d={e.path} className={'relation-edge '+e.kind} fill="none" markerEnd={e.kind==='before'||e.kind==='excluded'?undefined:'url(#'+marker+')'} markerStart={e.kind==='before'?'url(#'+marker+')':undefined}/>)}</svg>
    <article className="selected-task-node" data-source="true">
     <span className="eyebrow">ВЫБРАННОЕ ЗАДАНИЕ № {task.number}</span><h2>{v.title}</h2><p className="source-team"><Users size={17}/>{team.name}</p><span className={'league-badge '+team.league}>{leagues[team.league]}</span>
     <dl><div><dt>Ответственный</dt><dd>{state.owner||'Не назначен'}</dd></div><div><dt>Событие / завершение</dt><dd>{state.end?dateLabel(state.end,true):'Дата не назначена'}</dd></div><div><dt>Статус</dt><dd>{statuses[state.status]}</dd></div></dl>
     <button type="button" className="button primary" onClick={()=>p.openTask(task.key)}><FileText size={17}/>Карточка задания</button>
    </article>
    <div className="relation-groups" aria-live="polite">{task.number===2&&<article className="info-card"><h3>Что входит в бортовой журнал</h3><p>Задания Календаря Первых, всероссийские акции Дней единых действий и собственные мероприятия первички. Каждое мероприятие учитывается один раз. Мероприятия, проведённые в рамках других заданий конкурса, в журнал не включаются.</p></article>}{!groups.length&&task.number!==2&&<p className="note">Для этого задания в плане пока нет связей.</p>}{groups.map(group=><article className={'task-relation '+group.kind} data-relation={group.id} key={group.id}>
     <div className="relation-kind">{group.kind==='excluded'?<Ban size={16}/>:group.kind==='event'?<CalendarDays size={16}/>:<Link2 size={16}/>}<span>{group.id==='friendship-exception'||group.id==='friendship-partner'?'Ограничение выбора партнёра':kindLabels[group.kind]}</span></div>
     <h3>{group.title}</h3><p>{group.detail}</p>
     {group.targets.length>0&&(group.targets.length>4?<details className="related-targets-fold"><summary>{group.kind==='optional'?'Задания для совместной работы':'Связанные задания'}: {group.targets.length}</summary><div className="related-targets">{group.targets.map(targetButton)}</div></details>:<div className="related-targets">{group.targets.map(targetButton)}</div>)}
     {!group.targets.length&&group.kind==='required'&&<div className="relation-setup"><p>Подшефная команда не выбрана. В разделе «Команды» укажите для команды Лиги открытий её шефа.</p><button type="button" className="button secondary" onClick={p.showTeams}>Настроить команды</button></div>}
     {group.eventId&&<button type="button" className="text-button" onClick={()=>p.openEvent(plan.events.find(e=>e.id===group.eventId))}>Открыть событие</button>}
    </article>)}</div>
   </div>
   <div className="relation-legend"><span><i className="required"/>Требование Порядка</span><span><i className="optional"/>Возможное совмещение</span><span><i className="before"/>Ваш план</span><span><i className="excluded"/>Ограничение выбора партнёра</span></div>
  </section>
  <div className="relationship-actions"><button type="button" className="button secondary" onClick={()=>p.openTask(task.key,'links')}><Link2 size={17}/>Задать последовательность</button><button type="button" className="button secondary" onClick={()=>p.openEvent(undefined,task.key)}><Plus size={17}/>{task.number===2?'Добавить событие в журнал':'Указать совместное событие'}</button></div>
  <div className="note relationship-note"><Info size={18}/><span>Номера заданий не задают обязательную очередь. Стрелки «сначала / после» появляются из зависимостей, которые вы добавляете в свой план.</span></div>
 </>;
}
