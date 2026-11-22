const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const prefix=source.slice(source.indexOf('  const D='),source.indexOf('  const preferencesKey='));
const calendar=source.slice(source.indexOf('  function calendarLabel('),source.indexOf('  function setupSidebar(){'));
const exportHelpers=source.slice(source.indexOf('  function addDaysIso('),source.indexOf('  function googleCalendarUrl('));
const instant='2026-11-15T10:00:00Z';
function load(items,at=instant){
  class SelectedDate extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return Date.parse(at);}}
  const context={window:{DASHBOARD_DATA:{items,documents:data.documents},location:{search:''}},location:{origin:'https://example.com',pathname:'/'},Date:SelectedDate,Intl,URLSearchParams};
  vm.runInNewContext(prefix+calendar+exportHelpers+'\nthis.api={expired,endDate,nextDeadline,reportPending,calendarEntries,stagesInMonth,stagePeriod,isPublic,calendarEventFor,currentGroups,calendarViewEntries,calendarViewStages,canonicalSection};',context);
  return context.api;
}
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),context,{timeout:1000});
const data=context.window.DASHBOARD_DATA;
test('an event is archived after it took place, while a later report stays due',()=>{
  const item={id:'event',type:'event',eventDate:'2026-11-14',reportDeadline:'2026-11-20'};
  const api=load([item]);assert.equal(api.expired(item),true);assert.equal(api.reportPending(item),true);assert.equal(api.nextDeadline(item),'2026-11-20');
});
test('a future event is not archived when its registration has closed',()=>{
  const item={type:'event',deadline:'2026-11-01',eventDate:'2026-11-30'};assert.equal(load([item]).expired(item),false);
});
test('a campaign ends after its final day, not the holiday in the middle',()=>{
  const item={type:'action',eventDate:'2026-11-04',deadline:'2026-11-15'};
  const api=load([item]);assert.equal(api.expired(item),false);assert.equal(api.expired({...item,deadline:'2026-11-14'}),true);
});
test('a season remains current after registration when later stages exist',()=>{
  const item={type:'project',deadline:'2026-11-11',stages:[{title:'main',start:'2026-11-12',end:'2027-02-28',kind:'task'}]};
  const api=load([item]);assert.equal(api.expired(item),false);assert.equal(api.nextDeadline(item),'2027-02-28');
});
test('the primary competition and School Spring are still current',()=>{
  const api=load(data.items);for(const id of ['primary-contest','rshv-2026-2027','adventures-first-2026-kem'])assert.equal(api.expired(data.items.find(i=>i.id===id)),false,id);
});
test('completed first aid and October events are archived',()=>{
  const api=load(data.items);for(const id of ['first-aid-path','first-aid-municipal-2026-10-16','unity-in-action-forum-kem-2026','russia-family-families-2026'])assert.equal(api.expired(data.items.find(i=>i.id===id)),true,id);
});
test('a manual done status takes precedence over future dates',()=>{
  const item={type:'project',status:'done',deadline:'2027-11-30'};assert.equal(load([item]).expired(item),true);
});
test('a task with a future deadline is not ended by an earlier reporting date',()=>{
  const item={type:'task',deadline:'2026-11-20',reportDeadline:'2026-11-01'};assert.equal(load([item]).expired(item),false);
});
test('hidden, draft and manually archived items are not exposed by the calendar',()=>{
  const items=[{id:'hidden',visible:false},{id:'draft',status:'draft'},{id:'archived',archived:true}].map(i=>({...i,type:'task',deadline:'2026-11-16'}));assert.equal(load(items).calendarEntries().length,0);
});
test('report dates survive a calendar map that only includes the event',()=>{
  const item={id:'one',type:'event',eventDate:'2026-11-14',reportDeadline:'2026-11-20',calendarMap:{eventDate:'event'}};
  assert.equal(load([item]).calendarEntries().some(e=>e.date==='2026-11-20'&&e.kind==='report'),true);
});
test('date overrides remain available alongside a structured stage',()=>{
  const item={id:'one',type:'project',calendarDisplayDate:'2026-11-15',calendarDisplayKind:'registration',stages:[{id:'work',title:'Work',start:'2026-11-16',end:'2026-11-20',kind:'task'}]};
  assert.deepEqual(Array.from(load([item]).calendarEntries(),e=>e.date),['2026-11-15','2026-11-16','2026-11-20']);
});
test('different stages sharing one day remain separate',()=>{
  const item={id:'one',type:'project',stages:['first','second'].map(id=>({id,title:id,end:'2027-03-31',kind:'event'}))};assert.equal(load([item]).calendarEntries().length,2);
});
test('linked tasks and stage endpoints are deduplicated',()=>{
  const child={id:'child',type:'task',deadline:'2027-03-01',calendarKind:'registration'};
  const parent={id:'parent',type:'project',stages:[{id:'join',title:'Registration',end:'2027-03-01',kind:'registration',itemId:'child'}]};
  const points=load([parent,child]).calendarEntries();assert.equal(points.length,1);assert.equal(points[0].item.id,'child');
});
test('a month-only final is listed without inventing a calendar day',()=>{
  const item={id:'one',type:'project',stages:[{id:'final',title:'Final',monthStart:'2027-04',monthEnd:'2027-05',kind:'event'}]};
  const api=load([item]);assert.equal(api.calendarEntries().length,0);assert.equal(api.stagesInMonth('2027-04').length,1);assert.equal(api.stagesInMonth('2027-05').length,1);assert.equal(api.stagesInMonth('2027-06').length,0);
});
test('periods spanning months remain visible in an intermediate month',()=>{
  const item={id:'one',type:'project',stages:[{id:'work',title:'Work',start:'2026-11-12',end:'2027-02-28',kind:'task'}]};assert.equal(load([item]).stagesInMonth('2026-12').length,1);
});
test('the known season end is respected when its final is only specified by month',()=>{
  const item={id:'one',type:'project',deadline:'2027-06-07',stages:[{id:'final',title:'Final',monthStart:'2027-06'}]};assert.equal(load([item]).endDate(item).getDate(),7);
});
test('all source items and links have valid identities and no unsafe schemes',()=>{
  const ids=data.items.map(i=>i.id);assert.equal(new Set(ids).size,ids.length);
  for(const i of data.items){for(const s of i.stages||[]){assert.ok(s.start||s.end||s.monthStart||s.monthEnd,i.id);assert.ok(!s.itemId||ids.includes(s.itemId),s.itemId);if(s.start&&s.end)assert.ok(s.start<=s.end,s.id);}
    for(const l of [...(i.links||[]),...(i.materials||[])])assert.match(l.url,/^https?:\/\//,i.id);
  }
});
test('primary competition milestones and the updated document deadline are represented',()=>{
  const entries=load(data.items).calendarEntries();for(const date of ['2026-11-16','2026-11-23','2027-02-28','2027-03-16','2027-03-31','2027-04-15','2027-06-07','2027-11-30'])assert.ok(entries.some(e=>e.item.id==='primary-contest'&&e.date===date),date);
});
test('saving an ordinary admin form preserves stages, while explicit clearing remains possible',()=>{
  const code=fs.readFileSync(path.join(root,'api/admin.js'),'utf8');
  const context={require,process:{env:{}},module:{exports:{}},Buffer,URL,console};
  vm.runInNewContext(code+'\nthis.cleanItem=cleanItem;this.preserveStages=preserveStages;',context);
  const before=data.items.find(i=>i.id==='primary-contest');
  const raw={id:before.id,title:'Updated title',type:'project'};
  const saved=context.preserveStages(before,context.cleanItem(raw),raw);
  assert.equal(saved.stages.length,before.stages.length);
  assert.equal(saved.stages[0].label,before.stages[0].label);
  const explicit={...raw,stages:[]};
  assert.equal(context.preserveStages(before,context.cleanItem(explicit),explicit).stages.length,0);
});
test('calendar export uses the next actual deadline and preserves a pending report',()=>{
  const api=load(data.items);const primary=data.items.find(i=>i.id==='primary-contest');assert.equal(api.calendarEventFor(primary).date,'2026-11-23');
  const event={id:'event',type:'event',eventDate:'2026-11-14',reportDeadline:'2026-11-20'};assert.equal(load([event]).calendarEventFor(event).date,'2026-11-20');
});

test('the provisional moderation date retains its preliminary marker',()=>{
  const item=data.items.find(i=>i.id==='primary-contest');
  assert.equal(item.deadline,'2026-11-23');
  const moderation=item.stages.find(s=>s.id==='moderation');
  assert.equal(moderation.end,'2026-11-30');
  assert.equal(moderation.tentative,true);
  const api=load(data.items);
  const entry=api.calendarEntries().find(e=>e.stageId==='moderation');
  assert.equal(entry.date,'2026-11-30');
  assert.equal(entry.tentative,true);
  assert.equal(entry.label,'Модерация');
  assert.match(api.stagePeriod(moderation),/ориентировочно/);
});
test('event purpose distinguishes results, municipal and regional stages',()=>{
  const items=[
    {id:'results',title:'Подведение итогов конкурса'},
    {id:'municipal',title:'Муниципальный этап конкурса'},
    {id:'regional',title:'Региональный этап конкурса'}
  ].map(i=>({...i,type:'event',eventDate:'2027-03-01'}));
  const entries=load(items).calendarEntries();
  const labels=Object.fromEntries(entries.map(e=>[e.item.id,e.label]));
  assert.deepEqual(labels,{results:'Подведение итогов',municipal:'Муниципальные этапы',regional:'Региональные этапы'});
});
test('an announcement of a final is not mistaken for announcing results',()=>{
  const item={id:'final-announcement',type:'event',title:'Информация об итоговом событии',eventDate:'2027-05-15'};
  assert.equal(load([item]).calendarEntries()[0].label,'Информация о финале');
});


test('one current card owns each linked task even when tasks precede the project',()=>{
  const child={id:'child',type:'task',deadline:'2026-12-01'};
  const parent={id:'parent',type:'project',stages:[{id:'join',title:'Join',end:'2026-12-01',kind:'registration',itemId:'child'}]};
  const groups=load([child,parent]).currentGroups();
  assert.equal(groups.length,1);assert.equal(groups[0].item.id,'parent');assert.equal(groups[0].tasks[0].id,'child');
});
test('the current catalogue groups each active material exactly once on audit day',()=>{
  const api=load(data.items,'2026-11-22T10:00:00Z');const groups=api.currentGroups();
  const ids=groups.flatMap(g=>[g.item.id,...g.tasks.map(t=>t.id)]);
  const expected=data.items.filter(i=>api.isPublic(i)&&(!api.expired(i)||api.reportPending(i))&&i.type!=='info').map(i=>i.id);
  assert.equal(new Set(ids).size,ids.length);assert.deepEqual([...ids].sort(),Array.from(expected).sort());
  assert.ok(groups.every(g=>!api.expired(g.item)||api.reportPending(g.item)));
  assert.ok(!groups.some(g=>g.item.id==='school-classics-deadline-2026-12-15'));
  assert.ok(groups.find(g=>g.item.id==='school-classics-2026-2027').tasks.some(i=>i.id==='school-classics-deadline-2026-12-15'));
});
test('past dates and completed stages are absent from the default calendar',()=>{
  const api=load(data.items,'2026-11-22T10:00:00Z');
  assert.ok(api.calendarViewEntries().every(e=>e.date>='2026-11-22'));
  assert.ok(api.calendarViewEntries(true).some(e=>e.date<'2026-11-22'));
  assert.equal(api.calendarViewStages('2026-11').some(e=>e.stage.id==='creative-rating-snapshot'),false);
  assert.equal(api.calendarViewStages('2026-11',true).some(e=>e.stage.id==='creative-rating-snapshot'),true);
});
test('a closed event stays archived while its pending report is visible as a duty',()=>{
  const item={id:'one',type:'event',eventDate:'2026-11-14',reportDeadline:'2026-11-25'};
  const api=load([item],'2026-11-22T10:00:00Z');
  assert.equal(api.expired(item),true);assert.equal(api.currentGroups().length,1);
  assert.deepEqual(Array.from(api.calendarViewEntries(),e=>e.kind),['report']);
});
test('linking registration to a campaign preserves the campaign start and final day',()=>{
  const api=load(data.items);const points=api.calendarEntries();
  assert.ok(points.some(e=>e.item.id==='russian-kids-santa-2026-2027'&&e.date==='2026-12-01'));
  assert.ok(points.some(e=>e.item.id==='russian-kids-santa-2026-2027'&&e.date==='2027-01-14'));
  assert.equal(points.filter(e=>e.item.id==='russian-kids-santa-registration-2026'&&e.date==='2027-01-11').length,1);
});
test('bookmarks to removed duplicate sections lead to existing sections',()=>{
  const api=load([]);assert.equal(api.canonicalSection('#projects'),'#now');assert.equal(api.canonicalSection('#week'),'#calendar');assert.equal(api.canonicalSection('#archive'),'#archive');
});
test('a parent survives its registration deadline and disappears after the whole season',()=>{
  const item=data.items.find(i=>i.id==='primary-contest');
  assert.equal(load(data.items,'2026-11-24T10:00:00Z').expired(item),false);
  assert.equal(load(data.items,'2027-12-01T10:00:00Z').expired(item),true);
});
