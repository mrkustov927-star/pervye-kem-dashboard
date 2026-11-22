import type {Plan, Team, Template} from './model';
import {forTeam, getTask, ref} from './model';

export type RelatedTask={teamId:string;taskKey:string};
export type TaskRelation={id:string;kind:'required'|'optional'|'excluded'|'before'|'after'|'event';title:string;detail:string;targets:RelatedTask[];eventId?:string};

export function taskRelations(plan:Plan,team:Team,task:Template):TaskRelation[]{
 const links:TaskRelation[]=[];
 const target=(tm:Team,t:Template):RelatedTask=>({teamId:tm.id,taskKey:t.key});
 const mentees=plan.teams.filter(t=>t.league==='lo'&&t.mentorId===team.id);
 const mentor=team.league==='lo'?plan.teams.find(t=>t.id===team.mentorId&&t.league==='pl'):undefined;
 if(task.key==='pl-15'){
  links.push({id:'shared-project',kind:'required',title:'Один совместный проект',detail:'Шеф и подшефная команда разрабатывают проект вместе. Первая лига сдаёт дорожную карту и видео; Лига открытий — паспорт проекта, пост и видео.',targets:mentees.flatMap(tm=>forTeam(tm).filter(t=>t.number===10).map(t=>target(tm,t)))});
  links.push({id:'joint-activities',kind:'optional',title:'Совместное выполнение можно включить в шефство',detail:'В дорожной карте нужны минимум четыре совместных мероприятия. В них может входить работа над заданиями подшефной команды, если подтверждены участие обеих команд и результат.',targets:mentees.flatMap(tm=>forTeam(tm).filter(t=>![2,3,10].includes(t.number)).map(t=>target(tm,t)))});
  links.push({id:'friendship-exception',kind:'excluded',title:'Для «Мостов дружбы» нужен другой партнёр',detail:'Шеф и подшефная команда не могут выбрать друг друга для задания № 3.',targets:[target(team,forTeam(team).find(t=>t.number===3)!),...mentees.flatMap(tm=>forTeam(tm).filter(t=>t.number===3).map(t=>target(tm,t)))]});
 }else if(task.key==='lo-10'&&mentor){
  links.push({id:'shared-project',kind:'required',title:'Один совместный проект с командой-шефом',detail:'Ваш паспорт по № 10 и дорожная карта шефа по № 15 отражают общий проект и роли обеих команд. Отчётные комплекты каждая команда отправляет отдельно.',targets:forTeam(mentor).filter(t=>t.key==='pl-15').map(t=>target(mentor,t))});
 }else if(mentor&&![2,3,10].includes(task.number)){
  links.push({id:'joint-activities',kind:'optional',title:'Совместное событие может войти в дорожную карту шефа',detail:'Если обе команды выполняют это задание вместе, мероприятие можно отразить в № 15 Первой лиги. Свяжите его с обеими командами в реестре событий.',targets:forTeam(mentor).filter(t=>t.key==='pl-15').map(t=>target(mentor,t))});
 }
 if(task.number===3&&(mentor||mentees.length)){
  const partners=mentor?[mentor]:mentees;
  links.push({id:'friendship-partner',kind:'excluded',title:'Шефская пара не подходит для № 3',detail:'Для «Мостов дружбы» выберите другое первичное отделение. Это ограничение касается выбора партнёра, а не очередности заданий.',targets:partners.flatMap(tm=>forTeam(tm).filter(t=>t.number===3).map(t=>target(tm,t)))});
 }
 const a=getTask(plan,team,task);
 const before=forTeam(team).filter(t=>a.dependencies.includes(t.key));
 const after=forTeam(team).filter(t=>getTask(plan,team,t).dependencies.includes(task.key));
 if(before.length)links.unshift({id:'before',kind:'before',title:'Сначала завершить эти задания',detail:'Эту последовательность установила ваша команда. Завершение предшественника должно укладываться до начала выбранного задания.',targets:before.map(t=>target(team,t))});
 if(after.length)links.push({id:'after',kind:'after',title:'После этого задания — следующие',detail:'Эти задания зависят от выбранного по вашему плану. Это связь команды, а не обязательная очередь по номерам.',targets:after.map(t=>target(team,t))});
 for(const event of plan.events.filter(e=>task.number===2?e.journalTeams.includes(team.id):e.taskRefs.includes(ref(team.id,task.key)))){
  const targets=event.taskRefs.filter(r=>r!==ref(team.id,task.key)).flatMap(r=>{const [teamId,taskKey]=r.split('/'),tm=plan.teams.find(t=>t.id===teamId);return tm&&forTeam(tm).some(t=>t.key===taskKey)?[{teamId,taskKey}]:[]});
  links.push({id:'event-'+event.id,kind:'event',title:event.title,detail:(event.held?'Проведено':'Запланировано')+' · '+event.date+'. '+(task.number===2?'Запись в журнале команды.':targets.length?'Задания связаны одним событием в вашем реестре.':'У события пока нет связи с другим заданием.'),targets,eventId:event.id});
 }
 return links;
}
