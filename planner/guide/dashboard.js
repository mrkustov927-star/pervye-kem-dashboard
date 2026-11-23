import {tasks, meetings} from './dashboard-plan.js';
import {recommendations as actionDays} from './recommended-days.js?v=dashboard1';

const leagues = {lv:'Лига возможностей', pl:'Первая лига', lo:'Лига открытий'};
const all = Object.keys(leagues);
const labels = {fixed:'Точная дата', plan:'План округа', advice:'Рекомендация', team:'В плане команды'};
const months = ['2026-11','2026-12','2027-01','2027-02','2027-03','2027-04'];
const formatter = new Intl.DateTimeFormat('ru',{month:'long',year:'numeric',timeZone:'UTC'});
const short = new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',timeZone:'UTC'});
function format(date, fmt=short) { return fmt.format(new Date(date+'T12:00:00Z')); }
function node(tag,value,cls) {
  const n=document.createElement(tag);
  if(value) n.textContent=value;
  if(cls) n.className=cls;
  return n;
}
function action(text,fn) {
  const b=node('button',text);b.type='button';b.addEventListener('click',fn);return b;
}
function selector(label,values,fn) {
  const field=node('label',label);
  const select=node('select');
  for(const [value,title] of values) select.add(new Option(title,value));
  select.addEventListener('change',()=>fn(select.value));field.append(select);return field;
}
function entries(teamRows) {
  const out=[];
  function add(day,title,kind,groups,area,detail,source,alternative=false) {
    out.push({day,title,kind,leagues:groups,area,detail,source,alternative});
  }
  const rules='Положение, п. 6.2.2, с. 16–17';
  add('2026-11-23','Старт общего зачёта','fixed',all,'stage','С этого дня команды всех трёх лиг выполняют задания и могут размещать отчёты.',rules);
  add('2027-02-28','До 23:59 мск · Сдать задания общего зачёта','fixed',all,'stage','Капитан отправляет отчёты в личном кабинете конкурса. Один крайний срок для всех трёх лиг.',rules+' · Порядок, п. 1.4 и 2.1');
  for(const [day,title,groups,detail] of [
    ['2027-03-01','Начало финала',all,'У Лиги открытий окно для проекта — 1–16 марта. Для двух других лиг начинается первый игровой уровень.'],
    ['2027-03-16','До 23:59 мск · Финал Лиги открытий',['lo','pl'],'Завершается финал подшефной Лиги открытий. Шефу важно учесть эту дату для совместного проекта. Первый игровой уровень самой Первой лиги продолжается.'],
    ['2027-03-31','До 23:59 мск · Первый уровень финала',['lv','pl'],'Завершение первого игрового уровня для Лиги возможностей и Первой лиги.'],
    ['2027-04-01','Старт второго уровня финала',['lv','pl'],'Начало второго игрового уровня для Лиги возможностей и Первой лиги.'],
    ['2027-04-15','До 23:59 мск · Второй уровень финала',['lv','pl'],'Завершение второго игрового уровня для Лиги возможностей и Первой лиги.']
  ]) add(day,title,'fixed',groups,'stage',detail,rules);
  for (const t of tasks) {
    const prefix='№ '+t.n+' · '+t.title;
    const period=t.range?'Рабочий период: '+format(t.days[0])+' — '+format(t.days.at(-1))+'. ':'';
    const put=(day,caption,note='')=>add(day,caption+' · '+prefix,'plan',t.leagues,t.group||'task',period+t.brief+(note?' '+note:''),t.source,!!t.alternative);
    t.days.forEach((day,i)=>{
      let step=t.range?(i===0?'Начать':'Завершить'):'Провести';
      if(t.group==='bridge') step=t.days.length===1?'Встреча и игра':i===0?'Познакомиться и договориться':'Провести совместное дело';
      put(day,step);
    });
    if(t.announce) put(t.announce,'Опубликовать анонс','По п. 3.5.3 обязательный анонс публикуют минимум за один календарный день до события.');
    if(t.due && !(t.group==='mentor')) put(t.due,'Плановая сдача','До отправки проверьте материалы. Общий крайний срок — 28 февраля, 23:59 мск.');
  }
  for(const [day,title,detail] of meetings) add(day,title,'plan',['pl','lo'],'mentor','Первая лига № 15 + Лига открытий № 10 (при наличии шефа). '+detail,'Порядок · прил. 1, п. 16.1–16.2 · прил. 2, п. 10.2–10.3');
  add('2026-11-30','«Добрые лапы» · Помощь и публикация','advice',all,'task','Порядок рекомендует провести задание и опубликовать результат ко Всемирному дню домашних животных. Для старших лиг это вариант № 13, для Лиги открытий — № 8.','Порядок · прил. 1, № 13 · прил. 2, № 8');
  for(const day of ['2026-11-23','2026-12-31']) add(day,'«Атомный клуб» · Рекомендованный период','advice',['lv','pl'],'task','Порядок рекомендует ноябрь–декабрь для этого варианта № 8. В календаре показаны границы этого периода внутри общего зачёта.','Порядок · прил. 1, задание № 8');
  for(const a of actionDays) {
    add(a.date,a.title,a.confirmed?'fixed':'advice',all,'ded',a.period+'. '+a.detail,a.source);
    if(a.confirmed && a.date==='2026-11-25') add('2026-11-29','«Мамино сердце» · Завершить акцию и опубликовать итог','fixed',all,'ded','Последний день акции и публикации итогов. В бортовом журнале сохраните ссылку и число участников.','Рекомендации по всероссийским акциям на ноябрь 2026 г.');
  }
  return out.concat(teamRows).sort((a,b)=>a.day.localeCompare(b.day));
}

export function mountDashboard(root, teamRows=[]) {
  const events=entries(teamRows);
  const now=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date());
  let month=months.indexOf(now.slice(0,7));if(month<0)month=now<months[0]?0:months.length-1;
  let selected='', league='', area='', kind='', alternatives=false;
  const filters=node('div','','db-filters');
  function change(fn){return value=>{fn(value);selected='';draw();};}
  filters.append(
    selector('Лига',[['','Все три лиги'],...Object.entries(leagues)],change(v=>league=v)),
    selector('С кем работаем',[['','Все задания и события'],['joint','Вся совместная работа'],['mentor','Шеф и подшефная команда'],['bridge','Другие первички · Мосты дружбы']],change(v=>area=v)),
    selector('Какие даты',[['','Все даты'],['fixed','Точные даты'],['plan','План округа'],['advice','Рекомендации'],...(teamRows.length?[['team','В плане команды']]:[])],change(v=>kind=v))
  );
  const optional=node('label','','db-opt'),box=node('input');box.type='checkbox';optional.append(box,'Показать другие варианты заданий');
  box.onchange=()=>{alternatives=box.checked;selected='';draw();};
  const frame=node('div','','db-frame'),cal=node('section','','db-cal'),list=node('section','','db-agenda');
  const head=node('div','','db-head'),title=node('h2');title.setAttribute('aria-live','polite');
  const prev=action('‹',()=>move(-1)),next=action('›',()=>move(1));
  prev.setAttribute('aria-label','Предыдущий месяц');next.setAttribute('aria-label','Следующий месяц');head.append(prev,title,next);
  const weekdays=node('div','','db-week');weekdays.setAttribute('aria-hidden','true');
  for(const w of ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'])weekdays.append(node('span',w));
  const grid=node('div','','db-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Дни месяца');
  const legend=node('div','','db-legend');for(const [k,name] of Object.entries(labels))if(k!=='team'||teamRows.length)legend.append(node('span',name,'db-key '+k));
  cal.append(head,weekdays,grid,legend);
  const titleBar=node('div','','db-agenda-head'),listTitle=node('h3'),reset=action('Весь месяц',()=>{selected='';draw();});
  titleBar.append(listTitle,reset);const cards=node('div','','db-rows');list.append(titleBar,cards);frame.append(cal,list);
  const context=node('details','','db-help');context.append(node('summary','Как читать сроки и выбирать партнёра'),
    node('p','План округа показывает один предложенный вариант каждого задания и даты начала, встреч и сдачи. У вариативных заданий выбирают один вариант. Точные границы общего зачёта установлены п. 6.2.2 Положения.'),
    node('p','Шефство: Первая лига № 15 и Лига открытий № 10 разрабатывают общий проект. В дорожной карте шефа — не менее четырёх совместных мероприятий. Предложенные даты стороны согласуют между собой.'),
    node('p','Для № 3 «Мосты дружбы» Первая лига выбирает другую первичку, кроме своей подшефной. Лига открытий при наличии шефа выбирает партнёра, кроме своего шефа. События других конкурсных заданий повторно в бортовой журнал не вносят.'));
  const highlights=node('div','','db-highlights');
  function jump(day,group,category){
    month=months.indexOf(day.slice(0,7));selected=day;area=group;kind=category;league='';
    const selects=filters.querySelectorAll('select');
    selects[0].value='';selects[1].value=area;selects[2].value=kind;draw();
  }
  const deadline=action('',()=>jump('2027-02-28','','fixed'));
  deadline.append(node('small','Крайний срок общего зачёта'),node('strong','28 февраля · 23:59 мск'));
  highlights.append(deadline);
  const nextMeeting=meetings.slice(0,4).find(([day])=>day>=now);
  if(nextMeeting){
    const meeting=action('',()=>jump(nextMeeting[0],'mentor','plan'));
    meeting.append(node('small','Ближайшая встреча по плану шефства'),node('strong',format(nextMeeting[0])+' · '+nextMeeting[1].split(' · ')[1]));
    highlights.append(meeting);
  }
  root.replaceChildren(highlights,filters,optional,frame,context);
  function move(n){month+=n;selected='';draw();}
  function draw(){
    const ym=months[month],first=new Date(ym+'-01T12:00:00Z');
    const monthName=format(ym+'-01',formatter).replace(/ г\.$/,'');
    title.textContent=monthName;prev.disabled=month===0;next.disabled=month===months.length-1;
    const rows=events.filter(e=>e.day.startsWith(ym)&&(!league||e.leagues.includes(league))&&(!kind||e.kind===kind)&&(!e.alternative||alternatives)&&(!area||(area==='joint'?['mentor','bridge','joint-event'].includes(e.area):area===e.area)));
    grid.replaceChildren();
    for(let i=0;i<(first.getUTCDay()+6)%7;i++)grid.append(node('span'));
    const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    for(let i=1;i<=last;i++){
      const day=ym+'-'+String(i).padStart(2,'0'),matches=rows.filter(e=>e.day===day);
      const b=action('',()=>{selected=selected===day?'':day;draw();grid.querySelector('[data-day="'+day+'"]').focus({preventScroll:true});});
      b.dataset.day=day;b.setAttribute('aria-pressed',String(selected===day));if(day===now)b.setAttribute('aria-current','date');
      b.setAttribute('aria-label',format(day)+', записей: '+matches.length);b.append(node('span',String(i)));
      const dots=node('span','','db-dots');dots.setAttribute('aria-hidden','true');
      for(const k of new Set(matches.map(e=>e.kind)))dots.append(node('i','','db-dot '+k));
      b.append(dots);grid.append(b);
    }
    listTitle.textContent=selected?format(selected):'События месяца';reset.hidden=!selected;
    cards.replaceChildren();let lastDay='';
    for(const e of rows.filter(e=>!selected||e.day===selected)){
      if(lastDay!==e.day){cards.append(node('h4',format(e.day)));lastDay=e.day;}
      const card=node('details','','db-entry '+e.kind);
      const s=node('summary');s.append(node('small',labels[e.kind]+(e.alternative?' · другой вариант':'')),node('strong',e.title),node('span',e.leagues.length===3?'Все три лиги':e.leagues.map(c=>leagues[c]).join(' · '),'db-who'));
      card.append(s,node('p',e.detail),node('small',e.source,'db-cite'));cards.append(card);
    }
    if(!cards.childElementCount)cards.append(node('p',selected?'На этот день по выбранным условиям записей нет.':'В этом месяце по выбранным условиям записей нет.','db-empty'));
    cards.scrollTop=0;
  }
  draw();
}
