// Published calendar dates and preparation notes for the 2026–2027 season.
export const recommendations = [
  {
    "date": "2026-11-25",
    "period": "25–29 ноября 2026",
    "title": "Мамино сердце",
    "confirmed": true,
    "status": "В плане · условия опубликованы",
    "detail": "Выберите один из четырёх форматов акции. Проведите семейный завтрак, подготовьте «Сердце маме», запишите стихи или расскажите о маме на работе. Итоговую публикацию разместите до 29 ноября включительно. Хештеги сверьте с условиями своего формата.",
    "source": "Рекомендации на ноябрь 2026",
    "url": "https://kmtt32.ru/bank/vospitatelnaja-rabotv/dvizhenie-pervyh/_1210_vserossijskie_akcii_nojabr_2026__-1.pdf"
  },
  {
    "date": "2026-12-05",
    "period": "5 декабря 2026",
    "title": "День добровольца",
    "confirmed": false,
    "status": "Резерв декабря",
    "detail": "Для подготовки можно обсудить с волонтёрами, кому в округе нужна помощь. Перед выбором события найдите карточку декабрьской акции и проверьте даты проведения и публикации.",
    "source": "Перечень мероприятий на учебный год",
    "url": "https://base.garant.ru/414918108/"
  },
  {
    "date": "2026-12-09",
    "period": "9 декабря 2026",
    "title": "День Героев Отечества",
    "confirmed": false,
    "status": "Основной ориентир декабря",
    "detail": "Можно заранее подобрать материалы о героях Карелии вместе с музеем или библиотекой. Когда выйдут условия декабрьской акции, уточните формат участия и срок публикации.",
    "source": "Пример акции 2025 года",
    "url": "https://id.pervye.ru/download/MTQyMg%3D%3D/ZG9jdW1lbnRz/ZmlsZQ%3D%3D/"
  },
  {
    "date": "2027-01-27",
    "period": "27 января 2027",
    "title": "День полного освобождения Ленинграда от фашистской блокады",
    "confirmed": false,
    "status": "Основной ориентир января",
    "detail": "Обсудите с библиотекой подбор писем, воспоминаний или книг о блокаде. Конкретный формат и сроки участия уточните по рекомендациям на январь 2027 года.",
    "source": "Акции Движения Первых",
    "url": "https://xn--80aqag4d.xn--90acagbhgpca7c8c7f.xn--p1ai/"
  },
  {
    "date": "2027-02-08",
    "period": "8 февраля 2027",
    "title": "День российской науки",
    "confirmed": false,
    "status": "Основной ориентир февраля",
    "detail": "Можно пригласить учителя или местного специалиста на встречу с ребятами. Возраст участников, формат и даты проверьте по условиям акции на февраль 2027 года.",
    "source": "Акции Движения Первых",
    "url": "https://xn--80aqag4d.xn--90acagbhgpca7c8c7f.xn--p1ai/"
  },
  {
    "date": "2027-02-23",
    "period": "23 февраля 2027",
    "title": "День защитника Отечества",
    "confirmed": false,
    "status": "Резерв февраля",
    "detail": "Заранее оставьте время на итоговый пост до окончания общего зачёта. Период акции и срок публикации уточните по февральским рекомендациям.",
    "source": "Материалы февраля 2026 года",
    "url": "https://xn--d1abknlude.xn--p1ai/files/pervye-sobytiya-fevral-mart-2026/"
  }
];

const months = [
  ['2026-11', 'Ноябрь', '2026'],
  ['2026-12', 'Декабрь', '2026'],
  ['2027-01', 'Январь', '2027'],
  ['2027-02', 'Февраль', '2027']
];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(label, url) {
  const anchor = element('a', label);
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

export function mountRecommendedDays(root, dates = recommendations) {
  const filters = element('div', '', 'ded-months');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Месяц проведения');
  const results = element('section', '', 'ded-results');
  const updated = element('p', 'Подборка на 23 ноября 2026 года. Для зачёта в бортовом журнале проверьте условия конкретной акции в ', 'ded-source');
  updated.append(link('проектном модуле Движения Первых', 'https://projects.pervye.ru/'), '.');
  const controls = [];
  for (const [key, month, year] of months) {
    const button = element('button');
    button.type = 'button';
    button.append(element('strong', month), element('span', year));
    button.addEventListener('click', () => select(key));
    controls.push([key,button]);
    filters.append(button);
  }
  root.replaceChildren(filters, results, updated);

  function select(key) {
    for (const [month, button] of controls) button.setAttribute('aria-pressed', String(month === key));
    const [,month,year] = months.find(row => row[0] === key);
    results.replaceChildren(element('h2', month + ' ' + year));
    const actions = dates.filter(action => action.date.startsWith(key)).sort((a,b) => a.date.localeCompare(b.date));
    if (!actions.length) results.append(element('p', 'Для этого месяца рекомендации пока не добавлены.'));
    for (const action of actions) {
      const card = element('article', '', 'ded-card');
      const date = element('time', action.period);
      date.dateTime = action.date;
      const status = element('span', action.confirmed ? 'Условия опубликованы' : 'Ориентир · условия ожидаются', 'ded-status');
      if (action.confirmed) status.classList.add('confirmed');
      const meta = element('div', '', 'ded-meta');
      meta.append(date, status);
      if (/резерв/i.test(action.status)) meta.append(element('span', 'Резерв', 'ded-reserve'));
      card.append(meta, element('h3', action.title), element('p', action.detail));
      if (action.url && /^https:\/\//i.test(action.url)) card.append(link(action.source, action.url));
      results.append(card);
    }
  }
  const today = new Date();
  const currentMonth = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit'}).format(today);
  select(months.find(([key]) => key === currentMonth)?.[0] || (currentMonth < months[0][0] ? months[0][0] : months[months.length-1][0]));
}
