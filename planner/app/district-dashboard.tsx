import {useEffect,useRef} from 'react';
import {Plan,League,templates,ref} from './model';
import {mountDashboard} from '../guide/dashboard.js';
import '../guide/dashboard.css';

type Row={day:string;title:string;kind:'team';leagues:League[];area:string;detail:string;source:string};
export function DistrictDashboard({plan}:{plan:Plan}) {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!root.current)return;
    const rows:Row[]=[];
    for(const team of plan.teams){
      for(const t of templates){
        const a=plan.tasks[ref(team.id,t.key)];
        if(!a)continue;
        const title=t.variants.find(v=>v.id===a.variantId)?.title??t.title;
        const area=t.number===3?'bridge':(t.key==='pl-15'||(t.key==='lo-10'&&team.mentorId))?'mentor':'task';
        for(const [day,phase] of [[a.start,'Начать'],[a.announcement,'Анонс'],[a.end,'Завершить'],[a.submit,'Сдать отчёт']]){
          if(day)rows.push({day,title:phase+' · № '+t.number+' · '+title,kind:'team',leagues:[team.league],area,detail:team.name,source:'Дата из рабочего плана команды'});
        }
      }
    }
    for(const e of plan.events){
      const partners=plan.teams.filter(t=>e.teamIds.includes(t.id));
      if(!e.date||!partners.length)continue;
      const keys=e.taskRefs.map(r=>r.split('/')[1]);
      const area=keys.some(k=>k==='lv-3'||k==='lo-3')?'bridge':
        partners.some(t=>t.mentorId&&partners.some(p=>p.id===t.mentorId))||keys.includes('pl-15')?'mentor':partners.length>1?'joint-event':'task';
      rows.push({day:e.date,title:e.title,kind:'team',leagues:[...new Set(partners.map(t=>t.league))],area,detail:partners.map(t=>t.name).join(' · '),source:e.held?'Отмечено как проведённое':'Событие из рабочего плана'});
    }
    mountDashboard(root.current,rows);
  },[plan]);
  return <div ref={root}/>;
}
