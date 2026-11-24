import {useEffect,useRef,useState} from 'react';
import {createDecemberNotice} from '../guide/december-guidance.js';
import {mountRecommendedDays} from '../guide/recommended-days.js';
import '../guide/recommended-days.css';
import type {ViewProps} from './planner';
const dates = (window as any).planCatalog.ded;

export {dates as dedDates};

export function DecemberNotice() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) root.current.replaceChildren(createDecemberNotice());
  }, []);
  return <div ref={root}/>;
}

export function RecommendedDays() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) mountRecommendedDays(root.current);
  }, []);
  return <div ref={root}/>;
}

export function DedPlan({plan,team,openEvent,readOnly}:ViewProps) {
  const [error,setError]=useState('');
  async function download(){
    setError('');
    try{
      const r=await (window as any).planRequest({},'?handout=1');
      if(!r.ok)throw Error();
      const url=URL.createObjectURL(await r.blob());
      const a=document.createElement('a');a.href=url;a.download='План-ДЕД.html';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{setError('Не удалось скачать план. Попробуйте ещё раз.');}
  }
  return <section className="panel" aria-labelledby="ded-heading">
    <div className="panel-title"><h2 id="ded-heading">План дней единых действий</h2><button className="button secondary" onClick={download}>Скачать для первичек</button></div>{error&&<p role="alert">{error}</p>}
    <p>Для полного объёма журнала каждой команде нужны четыре разных ДЕД. В общий план включены «Мамино сердце» и по одному ориентиру на декабрь, январь и февраль. Ещё две даты предложены в резерв. Сведения на 22 ноября 2026 года.</p>
    <div className="anchor-grid">{dates.map(action=>{
      const existing=plan.events.find(e=>e.teamIds.includes(team.id)&&e.category==='ded'&&(e.dedId===action.date||e.title===action.title));
      return <article key={action.date} className="anchor-card">
        <time dateTime={action.date}>{action.period}</time><strong>{action.title}</strong>
        <span className={'micro-tag'+(action.confirmed?'':' amber')}>{action.status}</span>
        {!action.confirmed&&<small>Ожидаем условия акции</small>}<p>{action.detail}</p>
        <a href={action.url} target="_blank" rel="noreferrer">{action.source}</a>
        {(existing||!readOnly)&&<button className="text-button" onClick={()=>existing?openEvent(existing):openEvent(undefined,undefined,{
          title:action.title,date:action.date,dedId:action.date,category:'ded',officialConfirmed:action.confirmed,
          sourceUrl:action.confirmed?action.url:'',journalTeams:[team.id]
        })}>{existing?'Открыть событие команды':action.confirmed?'Выбрать дату участия':'Запланировать предварительно'}</button>}
      </article>
    })}</div>
    <p>Перед проведением уточните возраст участников, сроки, формат и хештеги в разделе «Акции». <a href="https://projects.pervye.ru/" target="_blank" rel="noreferrer">Проектный модуль Движения Первых</a></p>
  </section>
}

