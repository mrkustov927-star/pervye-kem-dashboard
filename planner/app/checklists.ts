const raw = (window as any).planCatalog.checklists;
import type {Task,Template,Variant} from './model';
export type ChecklistItem={id:string;label:string;detail:string;evidence:string;kind:'requirement'|'quality';source:string;reportKey?:string};
export type ChecklistSection={id:string;title:string;items:ChecklistItem[]};
export type ChecklistRecord={key:string;variantId:string;sourcePages:number[];sections:ChecklistSection[];criteria:{title:string;maxPoints:number;topLevel:string;lower:string[]}[];pitfalls:string[];alternative?:string;special?:string};
export const checklistRecords=raw as ChecklistRecord[];
export const checkpointKey=(variantId:string,itemId:string)=>variantId+'/'+itemId;
export function isCheckpointDone(task:Task,variantId:string,item:ChecklistItem){return item.reportKey?!!task.reports[item.reportKey]?.checked:!!task.checklist?.[checkpointKey(variantId,item.id)]}
export function checklistFor(t:Template,v:Variant):ChecklistRecord{
 const content=checklistRecords.find(r=>r.key===t.key&&r.variantId===v.id);
 if(!content)throw Error('Для выбранного варианта не найден чек-лист.');
 const item=(id:string,label:string,detail:string,evidence:string,source:string):ChecklistItem=>({id:'_sys-'+id,label,detail,evidence,kind:'requirement',source});
 const reports:ChecklistItem[]=v.reports.map(r=>({...item('report-'+r.key,r.label,
  r.kind==='document'?'Подготовьте документ с содержанием, предусмотренным этим вариантом. Используйте установленную форму, если она указана.':r.kind==='count'?'Укажите фактическое число участников в соответствующем поле конкурсного отчёта. Для цикла действий проверьте данные по каждому событию.':r.kind==='photos'?'Подготовьте предусмотренное заданием количество фотографий, подтверждающих процесс, участников и результат.':r.kind==='address'?'Проверьте почтовый адрес организации, в которой создано первичное отделение.':r.kind==='announcement'?'В анонсе укажите место, время, формат или программу и условия присоединения. Публикация — минимум за один календарный день до события.':'Подготовьте материал именно для выбранного варианта и сохраните прямую ссылку для конкурсного кабинета.',
  r.kind==='document'?'Готовый файл или презентация.':r.kind==='count'?'Фактическая численность участников.':r.kind==='photos'?'Фотографии или коллаж в допустимом формате.':r.kind==='address'?'Проверенный адрес организации.':'Действующая прямая ссылка на материал.',
  'п.3.1–3.3; требования к отчёту выбранного задания'),reportKey:r.key}));
 const kinds=new Set(v.reports.map(r=>r.kind));
 if(kinds.has('post')||kinds.has('public_video')||kinds.has('announcement')){
  reports.push(item('official-page','Разместить публичные материалы в официальном сообществе','Используйте публичную страницу первички и/или организации во «ВКонтакте» или MAX. Личная страница участника или капитана для этих материалов не подходит.','Ссылка на публикацию в официальном сообществе.','п.3.4.1,3.4.7,3.5.1,3.5.5'));
  reports.push(item('hashtags','Проверить обязательные и дополнительные хештеги','В публикациях используйте #ПервичкаВДеле и #ДвижениеПервых; добавьте хештеги, прямо предусмотренные выбранным заданием.','Хештеги в опубликованном посте или описании видеоролика.','п.3.4.2,3.5.4'));
 }
 if(kinds.has('public_video'))reports.push(item('video-proof',content.alternative?'Показать процесс и результат в видео или разрешённой замене':'Показать в публичном видео процесс и результат','Участие команды и предусмотренных заданием категорий граждан должно быть подтверждено кадрами. Проверьте читаемость титров и специальные требования к формату и длительности этого варианта.','Видео, по которому эксперт может увидеть фактическую работу.','п.3.4.3–3.4.6'));
 if(kinds.has('closed_video'))reports.push(item('closed-format','Проверить закрытый доступ, российский сервис и лимит 180 секунд','Разместите видео непублично на RuTube, VK Видео или другом российском сервисе с доступом по прямой ссылке. Эксперту не должен требоваться запрос разрешения.','Закрытая ссылка, открывающая видео длительностью до 180 секунд.','п.3.8.1–3.8.4,3.9.2'));
 if(kinds.has('document'))reports.push(item('document-format','Проверить формат документа и заполнение обязательной формы','Если заданием не установлено иное: документ — PDF/DOCX, презентация — PPTX/PDF. Проверьте все обязательные разделы и читаемость материалов.','Файл в нужном формате, без пропущенных разделов.','п.3.7; специальные требования варианта'));
 if(kinds.has('photos'))reports.push(item('photo-proof','Подготовить достоверные фотографии процесса и результата','Фото — JPG/JPEG/PNG, коллаж — JPG/JPEG/PNG/PDF, если заданием не установлено иное. Обработка не должна искажать факты; генеративные фотографии не засчитываются.','Реальные фотографии, соответствующие выполненному заданию.','п.3.6.1–3.6.6'));
 if(kinds.has('post')||kinds.has('public_video')||kinds.has('closed_video')||kinds.has('announcement'))reports.push(item('links','Проверить каждую прямую ссылку без дополнительных разрешений','Ссылки должны вести на конкретные материалы, открываться проверяющему и сохранять доступность до окончания конкурса.','Проверенные адреса всех материалов.','п.3.9; п.4.5'));
 reports.push(item('rights','Проверить права на материалы и необходимые согласия','Убедитесь, что использование текстов, музыки, изображений и упоминаний соответствует Положению; получены необходимые согласия изображённых или упомянутых лиц.','Проверенные материалы и необходимые согласия.','п.4.3'));
 reports.push(item('final-review','Сверить весь комплект с номинацией, вариантом и сроком сдачи','Капитан проверяет соответствие именно своему заданию и полноту материалов перед отправкой. После направления отчёта на проверку изменение и повторное размещение не допускаются.','Полный комплект, готовый к отправке капитаном в кабинет конкурса.','п.2.1,2.6,4.2'));
 return {...content,sections:[...content.sections,{id:'submission',title:'Отчёт и отправка',items:reports}]};
}
