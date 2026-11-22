'use client';
import {useState} from 'react';
import {Ban, CalendarDays, Check, FileText, Link2, Plus} from 'lucide-react';
import type {ViewProps} from './planner';
import {dateLabel, forTeam, getTask, leagues, statuses, variant, variantFields, ref, type Variant} from './model';
import {taskRelations, type TaskRelation} from './relations';

const labels: Record<TaskRelation['kind'], string> = {
 required: 'Требование Порядка', optional: 'Возможность для команды', excluded: 'Ограничение выбора партнёра',
 before: 'По плану команды · сначала', after: 'По плану команды · затем', event: 'Событие команды',
};

function VariantPicker({variants,current,automatic,readOnly,hasProgress,onSave}:{
 variants:Variant[];current:Variant;automatic:boolean;readOnly:boolean;hasProgress:boolean;onSave:(v:Variant)=>void
}) {
 const [candidate,setCandidate]=useState(current.id);
 const shown=variants.find(v=>v.id===candidate)??current;
 const preview=shown.id!==current.id;
 return <fieldset className="map-variants"><legend>{automatic?'Вариант по статусу шефства':'Варианты задания'}</legend>
  <div className="map-variant-options">{variants.map((v,i)=><label key={v.id}>
   <input type="radio" name="map-variant" checked={shown.id===v.id} onChange={()=>setCandidate(v.id)}/>
   <span><small>Вариант {i+1}{v.id===current.id?' · в плане команды':''}</small><strong>{v.title}</strong></span>
  </label>)}</div>
  {automatic&&<p>Без шефа команда выполняет вариант 1, с шефом — вариант 2.</p>}
  {preview&&<div className="map-variant-preview" aria-live="polite"><h3>{shown.title}</h3><p>{shown.specific}</p>
   <details><summary>Шаги и материалы для отчёта</summary><ol>{shown.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
    <strong>Что подготовить к сдаче</strong><ul>{shown.reports.map(r=><li key={r.key}>{r.label}</li>)}</ul></details>
   {automatic||readOnly?<p>{automatic?'Вы просматриваете условия другого варианта.':'Режим просмотра. Сохранить выбор команды можно по ссылке для редактирования.'}</p>:
    <>{hasProgress&&<p>При смене варианта будут сброшены его этапы, показатели и материалы отчёта.</p>}<button className="button primary" onClick={()=>onSave(shown)}>Выбрать для плана команды</button></>}
  </div>}
 </fieldset>;
}

export function MapView(p: ViewProps & {readOnly?: boolean}) {
 const {plan, team, readOnly} = p;
 const list = forTeam(team);
 const task = list.find(item => item.key === p.selected) ?? list[0];
 const state = getTask(plan, team, task);
 const v = variant(task, state, team);
 const groups = taskRelations(plan, team, task);
 const contest = groups.filter(g => ['required','optional','excluded'].includes(g.kind));
 const own = groups.filter(g => ['before','after','event'].includes(g.kind));
 const choices = list.map(item => {
  const progress = getTask(plan, team, item);
  return {item, title: variant(item, progress, team).title, multiple:item.variants.length>1, sent: progress.status === 'submitted'};
 });
 const nextStep = v.steps.find((_, index) => !state.steps.includes(index));
 const submitted = state.status === 'submitted';
 const needsReport = state.status === 'completed' || !nextStep;
 const needsPlan = !state.owner.trim() || !state.end;
 const next = submitted ? 'Отправка отчёта отмечена. Можно выбрать другое задание.'
  : needsReport ? 'Сверьте комплект отчёта перед отправкой в личном кабинете конкурса.'
  : !state.owner.trim() ? 'Договоритесь, кто отвечает за задание, и укажите его в плане.'
  : !state.end ? 'Выберите дату выполнения задания вместе с командой.' : nextStep;
 const tab = submitted || needsReport ? 'reports' : needsPlan ? 'plan' : 'steps';
 const action = tab === 'reports' ? 'Открыть отчёт' : tab === 'steps' ? 'Открыть этапы' : readOnly ? 'Посмотреть план' : 'Открыть план работы';

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
 return <div className="task-map">
  <nav className="panel task-directory" aria-label="Задания общего зачёта">
   <h2>Задания общего зачёта</h2>
   <div className="task-directory-list">{choices.map(({item,title,sent,multiple})=><button type="button" key={item.key} aria-pressed={item.key===task.key} onClick={()=>p.selectTask(item.key)}>
    <span className="task-index">{item.number}</span><span>{title}{multiple&&<small className="map-option-count">2 варианта</small>}</span>{sent&&<Check size={16} aria-label="Отправка отчёта отмечена"/>}
   </button>)}</div>
   <label className="task-directory-mobile">Выберите задание<select value={task.key} onChange={e=>p.selectTask(e.target.value)}>{choices.map(({item,title,sent,multiple})=><option key={item.key} value={item.key}>№ {item.number}. {title}{multiple?' · 2 варианта':''}{sent?' · отчёт отправлен':''}</option>)}</select></label>
  </nav>
  <section key={team.id+'/'+task.key} className="panel map-task" aria-label="Выбранное задание">
   <p className="eyebrow">Задание № {task.number} · до {task.points} баллов</p><h2>{v.title}</h2><p>{v.specific}</p>
   {task.variants.length>1&&<VariantPicker key={team.id+'/'+task.key+'/'+v.id} variants={task.variants} current={v}
    automatic={task.key==='lo-10'} readOnly={!!readOnly} hasProgress={!!(state.steps.length||Object.keys(state.reports).length||Object.keys(state.metrics).length)}
    onSave={choice=>p.update(next=>{const key=ref(team.id,task.key);next.tasks[key]={...getTask(next,team,task),...variantFields(choice)}})}/>}
   <div className="map-next"><div><h3>{submitted?'Задание сдано':'Ближайший шаг'}</h3><p>{next}</p></div><button className="button primary" onClick={()=>p.openTask(task.key,tab)}>{action}</button></div>
   <dl className="map-facts"><div><dt>Ответственный</dt><dd>{state.owner||'Не назначен'}</dd></div><div><dt>Дата выполнения</dt><dd>{state.end?dateLabel(state.end,true):'Не назначена'}</dd></div><div><dt>Статус</dt><dd>{statuses[state.status]}</dd></div></dl>
   <button className="button secondary" onClick={()=>p.openTask(task.key,'checklist')}><FileText size={17}/>Чек-лист и материалы задания</button>
   <section className="map-block"><h3>Что учесть при выполнении</h3>
    {task.number===2&&<p>В бортовой журнал входят события Календаря Первых, всероссийские акции Дней единых действий и собственные мероприятия первички. Каждое событие учитывается один раз. Мероприятия по другим конкурсным заданиям в журнал не включаются.</p>}
    {!contest.length&&task.number!==2&&<p>Это задание можно планировать отдельно.</p>}
    {contest.map(relation)}
   </section>
   <section className="map-block"><h3>Связи в плане команды</h3>
    {own.length?own.map(relation):<p>{readOnly?'Команда пока не добавила связей.':'Если команда выполняет задание отдельно, здесь ничего заполнять не нужно.'}</p>}
    {!readOnly&&<div className="map-actions"><button className="button secondary" onClick={()=>p.openTask(task.key,'links')}><Link2 size={16}/>Указать, что сделать сначала</button><button className="button secondary" onClick={()=>p.openEvent(undefined,task.key)}><Plus size={16}/>{task.number===2?'Добавить событие в журнал':'Запланировать событие'}</button></div>}
   </section>
  </section>
 </div>;
}
