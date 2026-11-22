'use client';
import {useRef,useState} from 'react';
import {Check,Download,FileText} from 'lucide-react';
import type {Task,Template,Variant} from './model';
import {checklistFor,checkpointKey,isCheckpointDone} from './checklists';
import type {ChecklistItem} from './checklists';

function downloadChecklist(content:HTMLElement,title:string){
  const doc=document.implementation.createHTMLDocument(title);
  doc.documentElement.lang='ru';
  const meta=doc.createElement('meta');meta.setAttribute('charset','utf-8');doc.head.prepend(meta);
  const viewport=doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';doc.head.append(viewport);
  const css=doc.createElement('style');
  css.textContent='body{max-width:800px;margin:auto;padding:1.2rem;color:#18324b;font:16px/1.5 system-ui,sans-serif}h1{font-size:1.6rem}article,details{border:1px solid #ccd7df;border-radius:8px;padding:.8rem;margin:.75rem 0}summary,label{cursor:pointer;font-weight:600}th,td{vertical-align:top;text-align:left;padding:.4rem;border-bottom:1px solid #ddd}th{white-space:nowrap}input{width:18px;height:18px;margin-right:.6rem}svg{display:none}p{margin:.5rem 0}.checklist-item{border-top:1px solid #ddd;padding:.6rem 0}.checklist-item>div{display:inline}.checklist-section>summary small{display:none}@media print{details,article{break-inside:auto}h2,h3,summary{break-after:avoid}}';
  doc.head.append(css);
  const h=doc.createElement('h1');h.textContent=title;doc.body.append(h);
  const copy=content.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[data-screen-only],button,svg').forEach(el=>el.remove());
  copy.querySelectorAll('[hidden]').forEach(el=>el.removeAttribute('hidden'));
  copy.querySelectorAll('details').forEach(el=>el.open=true);
  copy.querySelectorAll('input').forEach(el=>{el.checked=false;el.removeAttribute('checked')});
  copy.querySelectorAll('.checked').forEach(el=>el.classList.remove('checked'));
  doc.body.append(copy);
  const url=URL.createObjectURL(new Blob(['<!doctype html>',doc.documentElement.outerHTML],{type:'text/html;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=title.replace(/[<>:"/\\|?*]/g,' ') + '.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

export function TaskChecklist({task,template,variant,leagueName,patch,openReports}:{task:Task;template:Template;variant:Variant;leagueName:string;patch:(value:Partial<Task>)=>void;openReports:()=>void}){
  const data=checklistFor(template,variant),[remaining,setRemaining]=useState(false),content=useRef<HTMLDivElement>(null);
  const all=data.sections.flatMap(s=>s.items);
  const done=(item:ChecklistItem)=>isCheckpointDone(task,variant.id,item);
  function toggle(item:ChecklistItem,checked:boolean){
    if(item.reportKey){patch({reports:{...task.reports,[item.reportKey]:{...task.reports[item.reportKey],checked}}});return}
    patch({checklist:{...task.checklist,[checkpointKey(variant.id,item.id)]:checked}});
  }
  return <div className="full-checklist" ref={content}>
    <section className="team-brief"><div className="checklist-overview"><h3>Что сделать</h3><button data-screen-only type="button" className="button secondary" onClick={()=>content.current&&downloadChecklist(content.current,leagueName+' · № '+template.number+' · '+variant.title)}><Download size={15}/>Скачать чек-лист</button></div>
      <p>{variant.specific}</p><h3>Что сдать</h3><ul>{variant.reports.map(r=><li key={r.key}>{r.label}</li>)}</ul>
      {data.alternative&&<details><summary>Вариант отчёта для организаций с АОП</summary><p>{data.alternative}</p></details>}
      {data.special&&<p className="note">{data.special}</p>}
    </section>
    <section className="grade-guide"><h3>За что начисляют баллы</h3><p>За задание можно получить до <strong>{template.points} баллов</strong>. Эксперт оценивает каждый критерий отдельно и складывает баллы.</p>
      {data.criteria.map(c=><article key={c.title}><div className="grade-title"><strong>{c.title}</strong><b>до {c.maxPoints} б.</b></div>
        <p><strong>{c.lower.length?'Для максимума':'Расчёт'}</strong> · {c.topLevel}</p>{c.lower.length>0?<details><summary>Шкала оценивания</summary><table><thead><tr><th scope="col">Баллы</th><th scope="col">Что подтверждают материалы команды</th></tr></thead><tbody>{[...c.lower,c.topLevel].map((label,i)=><tr key={i}><th scope="row">{i*5}</th><td>{label}</td></tr>)}</tbody></table></details>:<p className="note">Например, три зачтённых мероприятия дают 12 баллов по этому критерию. Одно мероприятие учитывается один раз в одной категории.</p>}
      </article>)}
      {template.key==='pl-15'&&<p className="note"><strong>Дополнительно за шефство — 20 баллов к итогу Общего зачёта.</strong> Подшефная первичка должна выполнить все 10 заданий Лиги открытий и получить по экспертной оценке не менее 5 баллов за каждое. Решение утверждает Оргкомитет по п. 2.7.</p>}
    </section>
    <div className="checklist-overview"><div><h3>Чек-лист команды</h3><p data-screen-only>Отмечено {all.filter(done).length} из {all.length}. Отметки помогают следить за подготовкой.</p></div><button data-screen-only type="button" className="button secondary" aria-pressed={remaining} onClick={()=>setRemaining(!remaining)}>{remaining?'Показать всё':'Только оставшиеся'}</button></div>
    <div className="checklist-sections">{data.sections.map(section=><details className="checklist-section" key={section.id} open={section===data.sections[0]}><summary><span>{section.title}</span><small>{section.items.filter(done).length} / {section.items.length}</small></summary>
      <div>{section.items.map(item=>{const id='checkpoint-'+template.key+'-'+variant.id+'-'+item.id;
        return <div hidden={remaining&&done(item)} className={'checklist-item '+(done(item)?'checked':'')} key={item.id}><input type="checkbox" id={id} checked={done(item)} onChange={e=>toggle(item,e.target.checked)}/><div><label htmlFor={id}>{item.label}</label><p>{item.detail}</p><p className="checkpoint-evidence"><span><b>Чем подтвердить</b> · {item.evidence}</span></p></div></div>})}
        {remaining&&section.items.every(done)&&<div data-screen-only className="checklist-finished"><Check size={16}/>В этом разделе всё отмечено</div>}
        {section.id==='submission'&&<button type="button" className="button secondary" onClick={openReports}><FileText size={16}/>Заполнить поля отчёта</button>}
      </div></details>)}</div>
    {data.pitfalls.length>0&&<details className="checklist-pitfalls"><summary>Перед отправкой проверьте</summary><ul>{data.pitfalls.map(t=><li key={t}>{t}</li>)}</ul></details>}
    <p className="checklist-source-note">Порядок выполнения заданий Общего зачёта · страницы {data.sourcePages.join(', ')}.</p>
  </div>;
}
