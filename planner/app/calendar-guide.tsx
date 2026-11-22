'use client';
import {Check,ChevronRight,CalendarDays} from 'lucide-react';
import type {ViewProps} from './planner';
import {forTeam,getTask,variant,dateLabel} from './model';
import {checklistFor,isCheckpointDone} from './checklists';

const stages=[
  {key:'plan',title:'Планируем'},
  {key:'prepare',title:'Готовим'},
  {key:'do',title:'Проводим'},
  {key:'evidence',title:'Отчитываемся'}
] as const;

export function CalendarGuide(p:ViewProps){
  const entries=forTeam(p.team).map(template=>{
    const task=getTask(p.plan,p.team,template);
    const choice=variant(template,task,p.team);
    const checklist=checklistFor(template,choice);
    const pending=(id:string)=>checklist.sections.find(s=>s.id===id)?.items.find(item=>!isCheckpointDone(task,choice.id,item));
    const completed=(id:string)=>{
      const items=checklist.sections.find(s=>s.id===id)?.items??[];
      return items.length>0&&items.every(item=>isCheckpointDone(task,choice.id,item));
    };
    const ready=!!task.owner.trim()&&!!task.start&&!!task.end&&!!task.submit;
    const done=task.status==='submitted';
    const phaseDone=[
      ready,
      completed('prepare')||done,
      completed('do')||['completed','submitted'].includes(task.status),
      done
    ];
    const current=phaseDone.findIndex(x=>!x);
    let instruction='Открыть задание';
    if(!task.owner.trim())instruction='Назначить ответственного';
    else if(!task.start||!task.end||!task.submit)instruction='Определить даты подготовки, выполнения и отчёта';
    else if(pending('prepare'))instruction=pending('prepare')!.label;
    else if(pending('do'))instruction=pending('do')!.label;
    else if(pending('evidence'))instruction=pending('evidence')!.label;
    else if(!done)instruction='Проверить отчёт и отметить сдачу';
    const deadline=task.end||choice.recommended.end;
    return {template,task,choice,current,phaseDone,instruction,deadline,planned:!!task.end};
  }).filter(x=>x.current!==-1).sort((a,b)=>
    a.deadline.localeCompare(b.deadline)||a.template.number-b.template.number
  );
  const nearest=entries.slice(0,3);
  return <section className="panel calendar-guide" aria-labelledby="calendar-guide-title">
    <div className="calendar-guide-head">
      <div>
        <p className="eyebrow">ПОНЯТНЫЙ МАРШРУТ</p>
        <h2 id="calendar-guide-title">Маленькими шагами — к результату</h2>
        <p>Для первички «{p.team.name}». Начните с ближайшего дела, остальное подождёт.</p>
      </div>
    </div>
    <div className="calendar-guide-phases" aria-label="Этапы работы над каждым заданием">
      {stages.map((stage,i)=><div className="calendar-guide-phase" key={stage.key}>
        <span className="calendar-guide-phase-number">{i+1}</span>
        <strong>{stage.title}</strong>
      </div>)}
    </div>
    <div className="calendar-guide-heading">
      <h3>Ближайшие действия</h3>
      <span>Показываем только три</span>
    </div>
    {nearest.length?<div className="calendar-guide-list">
      {nearest.map(entry=><article className="calendar-guide-task" key={entry.template.key}>
        <div className="calendar-guide-item-top">
          <div><span className="calendar-guide-number">Задание № {entry.template.number}</span><h3>{entry.choice.title}</h3></div>
          <span className="calendar-guide-date">{entry.planned?'По вашему плану':'Ориентир'}: {dateLabel(entry.deadline)}</span>
        </div>
        <p className="calendar-guide-next"><span>Следующий шаг</span>{entry.instruction}</p>
        <div className="calendar-guide-item-bottom">
          <div className="calendar-guide-progress" aria-label="Этапы выполнения задания">
            {stages.map((stage,i)=><span key={stage.key} className={'calendar-guide-progress-step '+(entry.phaseDone[i]?'done':i===entry.current?'current':'')} title={stage.title+(entry.phaseDone[i]?' — выполнен':i===entry.current?' — следующий':' — впереди')}>
              {entry.phaseDone[i]?<Check size={12}/>:i+1}
              <span>{stage.title}</span>
            </span>)}
          </div>
          <button className="button secondary" type="button" onClick={()=>p.openTask(entry.template.key)}>Открыть задание <ChevronRight size={15}/></button>
        </div>
      </article>)}
    </div>:<div className="calendar-guide-empty"><Check size={20}/>Все конкурсные задания отмечены как сданные. Можно проверить журнал мероприятий и документы.</div>}
    <p className="calendar-guide-foot"><CalendarDays size={15}/>Даты без вашего плана — лишь рекомендации. Полные шаги, требования и отчёты находятся внутри карточки задания.</p>
  </section>;
}
