import {mountDashboard} from './dashboard.js';
import {mountRecommendedDays} from './recommended-days.js?v=dashboard1';
import {mountChecklists, showVariant, leagueTasks} from './checklist-reader.js?v=order3';
(()=>{
  const $=id=>document.getElementById(id);
  let data, tasks;
  function options(id,values){$(id).replaceChildren(...values.map(([value,label])=>new Option(label,value)));}
  function chooseLeague(){
    const league=$('league').value;
    tasks=leagueTasks(data.tasks,league);
    options('task',tasks.map(t=>[t.key,'№ '+t.number+' · '+t.title+(league==='pl'&&t.key==='lv-15'?' (замена по п. 16.4)':'')]));
    chooseTask();
  }
  function currentTask(){return tasks.find(t=>t.key===$('task').value);}
  function chooseTask(){options('variant',currentTask().variants.map((v,i)=>[v.id,(i+1)+'. '+v.title]));render();}
  function render(){
    const t=currentTask(),v=t.variants.find(v=>v.id===$('variant').value),r=data.checklists.find(r=>r.key===t.key&&r.variantId===v.id);
    showVariant($('detail'), $('league').value, t, v, r);
  }
  function switchSection() {
    const titles = {assignments:'Задания общего зачёта', checklists:'Чек-листы', ded:'Рекомендованные ДЕД', dashboard:'Календарь конкурса'};
    const requested = location.hash.slice(1);
    const active = Object.hasOwn(titles, requested) ? requested : 'assignments';
    for (const id of Object.keys(titles)) $(id).hidden = id !== active || (!['ded','dashboard'].includes(id) && !data);
    $('loading').hidden = Boolean(data) || ['ded','dashboard'].includes(active);
    for (const link of $('sections').querySelectorAll('a')) {
      if (link.hash === '#' + active) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
    $('pageTitle').textContent = titles[active];
    document.title = $('pageTitle').textContent + ' · Конкурс первичек';
  }
  window.addEventListener('hashchange', switchSection);
  switchSection();
  async function loadCatalog() {
    $('retry').hidden=true;
    $('status').textContent='Загружаем задания…';
    try {
      const response=await fetch('./catalog.json');
      if (!response.ok) throw new Error();
      data=await response.json();
      chooseLeague();
      mountChecklists($('checklists'),data,$('league').value);
      switchSection();
    } catch {
      data=undefined;
      switchSection();
      $('status').textContent='Не удалось загрузить задания. Проверьте соединение и попробуйте ещё раз.';
      $('retry').hidden=false;
    }
  }
  mountDashboard($('dashboard'));
  mountRecommendedDays($('ded'));
  $('retry').addEventListener('click',loadCatalog);
  loadCatalog();
  $('league').onchange=chooseLeague;$('task').onchange=chooseTask;$('variant').onchange=render;
  $('print').onclick=()=>window.print();
})();
