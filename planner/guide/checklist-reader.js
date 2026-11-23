import {taskMaterials} from './task-materials.js';
import {contestCards} from './checklist-cards.js';

const leagues = { lv: 'Лига возможностей', pl: 'Первая лига', lo: 'Лига открытий' };
const seasonTeams = {
  lv: ['Кривопорожская СОШ', 'Подужемская СОШ'],
  pl: ['Рабочеостровская СОШ', 'Кемская СОШ № 3', 'Кемская СОШ № 1'],
  lo: ['Дом творчества', 'Детский сад № 1 (Рабочеостровск)', 'Детский сад № 4 (Кемь)']
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(label, action, className) {
  const node = element('button', label, className);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

export function leagueTasks(tasks, league) {
  return tasks.filter(t => t.league === league || (league === 'pl' && t.league === 'lv'))
    .sort((a,b) => a.number - b.number || Number(b.league === 'pl') - Number(a.league === 'pl'));
}

const el = element;
const para=(node,text)=>{if(text)node.append(el('p',text));};
  function list(node,title,values){
    if(!values?.length)return;
    node.append(el('h3',title));const ul=el('ul');
    for(const value of values)ul.append(el('li',value));
    node.append(ul);
  }

function appendTaskMaterials(node, record) {
  const materials = taskMaterials(record);
  const hints = {
    journal: 'На сайте конкурса откройте «Полезные материалы» → «Календарь Первых». Перечень Дней единых действий находится в разделе «Акции».',
    spartak: 'Видеовызов футболистов ФК «Спартак-Москва» размещён в карточке задания на сайте конкурса.'
  };
  const hint = hints[record.variantId];
  if (!materials.length && !hint) return;
  const section = element('section', '', 'cl-materials');
  section.append(element('h3', 'Материалы из Порядка'));
  if (hint) para(section, hint);
  if (materials.length) {
    const links = element('ul');
    for (const [title, url] of materials) {
      if (!/^https:\/\//i.test(url)) continue;
      const link = element('a', title);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const item = element('li');
      item.append(link);
      links.append(item);
    }
    section.append(links);
  }
  node.append(section);
}

export function showVariant(node, league, t, v, r) {
    node.replaceChildren();
    para(node, leagues[league]+' · Задание № '+t.number+' · До '+t.points+' баллов');
    node.append(el('h2',v.title));para(node,v.specific);
    appendTaskMaterials(node, r);
    const dates=el('p','Первичка ____________________   Начало __________   Завершение __________   Сдача __________');dates.className='print-fields';node.append(dates);
    if(league==='pl'&&t.key==='lv-15')para(node,'Замена по п. 16.4 при отказе подшефной команды. Обоснуйте замену в комментарии к отчёту.');
    if(v.needsAnnouncement)para(node,'Опубликуйте анонс минимум за один календарный день до события.');
    para(node,r.special);para(node,r.alternative);
    for(const section of r.sections){
      node.append(el('h3',section.title));const ol=el('ol');
      for(const item of section.items){
        const li=el('li');li.append(el('strong',item.label));para(li,item.detail);para(li,item.method);
        if(item.evidence)para(li,'Что подготовить — '+item.evidence);ol.append(li);
      }node.append(ol);
    }
    list(node,'Что приложить к отчёту',v.reports.map(x=>x.label));
    if(v.tags?.length)para(node,v.tags.join(' '));
    list(node,'Что нужно для максимального балла',r.criteria.map(c=>c.title+' · до '+c.maxPoints+' б. '+c.topLevel));
    list(node,'За что можно потерять баллы',r.pitfalls);
    if(r.worksheet?.length){
      node.append(el('h3','Рабочий лист команды'));
      const table=el('table'), head=table.createTHead().insertRow();
      for(const title of r.worksheet){const cell=el('th',title);cell.scope='col';head.append(cell);}
      const body=table.createTBody();
      for(let i=0;i<(r.rows||3);i++){
        const row=body.insertRow();
        r.worksheet.forEach((_,j)=>row.insertCell().textContent=j===0?(i+1)+'.':'');
      }
      node.append(table);
    }
    para(node,'Порядок выполнения заданий, с. '+r.sourcePages.join(', ')+'.');
  }
  

function showChecklist(node, league, task, variant, record, root, marked) {
  const card = contestCards[task.key + '/' + variant.id] ?? contestCards[variant.id];
  if (!card) {
    node.replaceChildren(element('p', 'Чек-лист этого варианта пока недоступен.'));
    return;
  }
  node.replaceChildren(element('h2', variant.title), element('p', card.description, 'cl-description'));
  if (league === 'pl' && task.key === 'lv-15') {
    para(node, 'По п. 16.4 этот вариант доступен при отказе подшефной команды от дальнейшего участия и совместной работы. Укажите причину замены в комментарии к отчёту.');
  }
  if (task.key === 'pl-15') para(node, record.special);
  appendTaskMaterials(node, record);
  const stages = element('details', '', 'cl-fold cl-stages');
  stages.append(element('summary', 'Этапы выполнения'));
  const ordered = element('ol');
  for (const [, instruction] of card.steps) ordered.append(element('li', instruction));
  stages.append(ordered);
  node.append(stages, element('h3', 'Чек-лист выполнения'));

  const checks = element('ul', '', 'cl-checks');
  const labels = [...card.steps.map(([check]) => check), 'Отчёт отправлен в личном кабинете конкурса.'];
  labels.forEach((text, index) => {
    const id = [league, task.key, variant.id, index].join('/');
    const input = element('input');
    input.type = 'checkbox';
    input.dataset.check = id;
    input.checked = marked.has(id);
    input.addEventListener('change', () => {
      if (input.checked) marked.add(id);
      else marked.delete(id);
      for (const copy of root.querySelectorAll('.cl-checks input')) {
        if (copy.dataset.check === id) copy.checked = input.checked;
      }
    });
    const label = element('label');
    label.append(input, element('span', text));
    const item = element('li');
    item.append(label);
    checks.append(item);
  });
  node.append(checks);

  const reference = element('details', '', 'cl-fold cl-reference');
  reference.append(element('summary', 'Материалы для отчёта и баллы'));
  const reports = variant.reports.map(report => report.label.replace(/\s*\(по п\. 2\.3[^)]*\)/g, ''));
  list(reference, 'Что приложить', reports);
  if (variant.tags?.length) para(reference, variant.tags.join(' '));
  list(reference, 'Критерии оценки', record.criteria.map(c => c.title + ' · до ' + c.maxPoints + ' б. ' + c.topLevel));
  node.append(reference, element('p', 'Порядок выполнения заданий общего зачёта, с. ' + record.sourcePages.join(', ') + '.', 'cl-source'));
}

function printContent(node) {
  const closed = [...node.querySelectorAll('.cl-fold:not([open])')];
  for (const section of closed) section.open = true;
  node.classList.add('cl-print-target');
  document.body.classList.add('cl-printing');
  function clear() {
    for (const section of closed) section.open = false;
    node.classList.remove('cl-print-target');
    document.body.classList.remove('cl-printing');
    window.removeEventListener('afterprint', clear);
  }
  window.addEventListener('afterprint', clear, {once:true});
  try { window.print(); } catch (error) { clear(); throw error; }
}

export function mountChecklists(root, data, initialLeague = 'lv') {
  const marked = new Set();
  const titles = element('div', '', 'cl-leagues');
  titles.setAttribute('role', 'group');
  titles.setAttribute('aria-label', 'Выбор номинации');
  const contents = element('section', '', 'cl-contents');
  const startingLeague = leagues[initialLeague] ? initialLeague : 'lv';
  const buttons = new Map();
  for (const [code, name] of Object.entries(leagues)) {
    const choice = button('', () => choose(code), 'cl-league cl-' + code);
    const label = element('strong', name);
    const count = new Set(leagueTasks(data.tasks, code).map(t => t.number)).size;
    choice.append(label, element('span', count + ' заданий'));
    const teams = element('span', '', 'cl-teams');
    for (const team of seasonTeams[code]) teams.append(element('span', team));
    choice.append(teams);
    titles.append(choice);
    buttons.set(code, choice);
  }
  root.replaceChildren(titles, contents);

  function choose(code) {
    for (const [key, choice] of buttons) choice.setAttribute('aria-pressed', String(key === code));
    const heading = element('h2', leagues[code]);
    const list = element('div', '', 'cl-list');
    const toolbar = element('div', '', 'cl-toolbar');
    const book = element('div', '', 'cl-book');
    book.hidden = true;
    const toggle = button('Смотреть весь сборник', () => {
      if (book.hidden && !book.hasChildNodes()) {
        book.append(element('h2', leagues[code], 'cl-book-title'));
        for (const task of leagueTasks(data.tasks, code)) {
          for (const variant of task.variants) {
            const record = data.checklists.find(r => r.key === task.key && r.variantId === variant.id);
            if (!record) continue;
            const page = element('article', '', 'cl-article');
            showChecklist(page, code, task, variant, record, root, marked);
            book.append(page);
          }
        }
      }
      book.hidden = !book.hidden;
      list.hidden = !book.hidden;
      printBook.hidden = book.hidden;
      toggle.setAttribute('aria-expanded', String(!book.hidden));
      toggle.textContent = book.hidden ? 'Смотреть весь сборник' : 'К оглавлению';
    }, 'cl-print');
    toggle.setAttribute('aria-expanded','false');
    const printBook = button('Распечатать сборник', () => printContent(book), 'cl-print');
    printBook.hidden = true;
    toolbar.append(toggle,printBook);
    contents.replaceChildren(heading, toolbar, list, book);
    let opened;
    for (const task of leagueTasks(data.tasks, code)) {
      const row = element('details', '', 'cl-task');
      const summary = element('summary');
      const substitute = code === 'pl' && task.key === 'lv-15';
      const names = task.variants.map(v => v.title);
      const title = element('span', names.length === 1 ? names[0] : task.title, 'cl-name');
      if (substitute) title.prepend(element('small', 'Замена по п. 16.4'));
      if (names.length > 1 && !names.every(n => task.title.includes(n))) title.append(element('small', names.join(' / ')));
      summary.append(element('span','№ '+task.number,'cl-number'), title, element('span','до '+task.points+' б.','cl-points'));
      row.append(summary);
      row.addEventListener('toggle', () => {
        if (!row.open) return;
        if (opened && opened !== row) opened.open = false;
        opened = row;
        if (row.childElementCount > 1) return;
        const body = element('div', '', 'cl-body');
        const article = element('article', '', 'cl-article');
        const options = element('div', '', 'cl-options');
        options.setAttribute('role','group');
        options.setAttribute('aria-label','Вариант задания');
        const print = button('Распечатать вариант', () => printContent(article), 'cl-print');
        function select(v) {
          const record = data.checklists.find(r => r.key === task.key && r.variantId === v.id);
          if (record) showChecklist(article, code, task, v, record, root, marked);
          else article.replaceChildren(element('p', 'Чек-лист этого варианта пока недоступен.'));
          print.hidden = !record;
          for (const control of options.children) control.setAttribute('aria-pressed', String(control.dataset.id === v.id));
        }
        if (task.variants.length > 1) {
          for (const [i, variant] of task.variants.entries()) {
            const control = button('Вариант '+(i+1)+' · '+variant.title, () => select(variant));
            control.dataset.id = variant.id;
            options.append(control);
          }
          body.append(options);
        }
        body.append(print, article);
        row.append(body);
        select(task.variants[0]);
      });
      list.append(row);
    }
  }
  choose(startingLeague);
}
