(()=> {
  const D = window.DASHBOARD_DATA || {items:[],meta:{}};
  let items = Array.isArray(D.items) ? structuredClone(D.items) : [];
  let token = sessionStorage.getItem("pervyeAdminToken") || "";
  let editingOriginalId = null;
  let dirty = false;
  let activeEditor = "none";

  const rootNode = r => typeof r === "string" ? document.querySelector(r) : r;
  const $ = (s,r=document)=>rootNode(r).querySelector(s);
  const $$ = (s,r=document)=>[...rootNode(r).querySelectorAll(s)];
  const form = $("#itemForm");
  const settingsForm = $("#siteSettingsForm");
  const typeLabels = {task:"Задача",action:"Акция",project:"Проект",event:"Событие",info:"Информация"};

  const defaultSiteSettings = {
    siteTitle:"Первые · Кемский округ",
    districtLabel:"Кемский муниципальный округ",
    heroEyebrow:"Рабочий кабинет первичных организаций",
    heroTitle:"Всё важное",
    heroAccent:"в одном месте.",
    heroLead:"Сроки, задачи, акции и документы для первичных организаций Кемского округа.",
    heroPrimary:"Что сделать сейчас",
    heroSecondary:"Открыть календарь",
    nowTitle:"Что требует внимания",
    nowSubtitle:"Ближайшие задачи и дедлайны",
    calendarTitle:"Календарь Первых",
    calendarSubtitle:"Сентябрь — ноябрь 2026",
    projectsTitle:"Акции и проекты",
    projectsSubtitle:"Идёт сейчас и впереди",
    docsTitle:"Ссылки и документы",
    docsSubtitle:"Всё, что нужно открыть повторно",
    archiveTitle:"Архив завершённых задач и акций",
    footerSubtitle:"Рабочий информационный кабинет первичных организаций"
  };
  let siteSettings={...defaultSiteSettings,...((D.meta&&D.meta.site)||{})};

  function toast(text){
    const el=$("#toast");
    if(!el) return;
    el.textContent=text;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>el.classList.remove("show"),2200);
  }
  function lines(v){ return String(v||"").split("\n").map(x=>x.trim()).filter(Boolean); }
  function tags(v){ return String(v||"").split(/[\n,\s]+/).map(x=>x.trim()).filter(Boolean); }
  function badges(v){ return String(v||"").split(/[\n,]+/).map(x=>x.trim()).filter(Boolean); }
  function esc(s){ return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
  function fmtDate(d){
    if(!d) return "Без срока";
    return new Date(d+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short"});
  }
  function slugify(s){
    return String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-zа-яё0-9]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,70);
  }
  async function api(body){
    const r=await fetch("/api/admin",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        ...(token?{"Authorization":"Bearer "+token}:{})
      },
      body:JSON.stringify(body)
    });
    const data=await r.json().catch(()=>({ok:false,error:"Не удалось получить ответ сервера."}));
    if(r.status===401 && body.action!=="login"){
      token="";
      sessionStorage.removeItem("pervyeAdminToken");
      showLogin("Сессия завершена. Войдите снова.");
    }
    if(!r.ok) throw new Error(data.error||"Ошибка сохранения.");
    return data;
  }
  async function checkSetup(){
    try{
      const r=await fetch("/api/admin",{cache:"no-store"});
      const data=await r.json();
      return Boolean(data.configured);
    }catch{
      return false;
    }
  }

  function showLogin(message=""){
    $("#loginCard").hidden=false;
    $("#workspace").hidden=true;
    $("#adminHeader").hidden=true;
    $("#loginMessage").textContent=message;
    activeEditor="none";
  }
  function showWorkspace(){
    $("#loginCard").hidden=true;
    $("#workspace").hidden=false;
    $("#adminHeader").hidden=false;
    $("#logoutBtn").hidden=false;
    renderList();
  }

  function itemSort(a,b){
    const da=a.deadline||a.eventDate||a.start||"9999-12-31";
    const db=b.deadline||b.eventDate||b.start||"9999-12-31";
    const doneA=a.status==="done"?1:0, doneB=b.status==="done"?1:0;
    return doneA-doneB || da.localeCompare(db) || String(a.title).localeCompare(String(b.title),"ru");
  }
  function renderList(){
    const q=$("#itemSearch").value.trim().toLowerCase();
    const t=$("#itemTypeFilter").value;
    const list=items.filter(i=>{
      if(t!=="all"&&i.type!==t) return false;
      if(q && ![i.title,i.short,i.category].join(" ").toLowerCase().includes(q)) return false;
      return true;
    }).sort(itemSort);
    $("#itemList").innerHTML=list.map(i=>
      '<button class="item-row '+(activeEditor==="item"&&editingOriginalId===i.id?"active":"")+'" data-edit="'+esc(i.id)+'" type="button">'+
      '<span class="item-row-top"><span class="item-row-type">'+esc(typeLabels[i.type]||i.type)+(i.visible===false?" · скрыто":"")+'</span><span class="item-row-date">'+esc(fmtDate(i.deadline||i.eventDate||i.start))+'</span></span>'+
      '<strong>'+esc(i.title)+'</strong><p>'+esc(i.short||"Без краткого описания")+'</p></button>'
    ).join("") || '<div class="empty-repeater">Ничего не найдено.</div>';
  }

  function setVal(name,value){ const el=form.elements[name]; if(el) el.value=value??""; }
  function getVal(name){ const el=form.elements[name]; return el ? el.value.trim() : ""; }
  function resetRepeaters(){
    $("#formatsRepeater").innerHTML="";
    $("#linksRepeater").innerHTML="";
    $("#materialsRepeater").innerHTML="";
    updateRepeaterEmpty();
  }
  function updateRepeaterEmpty(){
    $("#formatsEmpty").hidden=Boolean($("#formatsRepeater").children.length);
    $("#linksEmpty").hidden=Boolean($("#linksRepeater").children.length);
    $("#materialsEmpty").hidden=Boolean($("#materialsRepeater").children.length);
  }
  function addFormat(data={}){
    const wrap=document.createElement("div");
    wrap.className="repeat-card format-card";
    wrap.innerHTML=
      '<div class="repeat-card-head"><strong>Формат участия</strong><button type="button" class="remove-repeat">Удалить</button></div>'+
      '<div class="field-grid two">'+
        '<label>Название<input class="f-name" value="'+esc(data.name||"")+'" placeholder="Название формата"></label>'+
        '<label>Для кого<input class="f-audience" value="'+esc(data.audience||"")+'" placeholder="Возраст / участники"></label>'+
      '</div>'+
      '<label>Описание<textarea class="f-description" rows="3" placeholder="В чём суть формата">'+esc(data.description||"")+'</textarea></label>'+
      '<label>Что сделать<textarea class="f-actions" rows="6" placeholder="Каждое действие с новой строки">'+esc((data.actions||[]).join("\n"))+'</textarea></label>'+
      '<label>Результат<textarea class="f-result" rows="2" placeholder="Что должно получиться">'+esc(data.result||"")+'</textarea></label>';
    $("#formatsRepeater").appendChild(wrap);
    updateRepeaterEmpty();
  }
  function addLink(kind,data={}){
    const parent=kind==="material"?$("#materialsRepeater"):$("#linksRepeater");
    const row=document.createElement("div");
    row.className="link-row";
    row.dataset.kind=kind;
    row.innerHTML=
      '<label>Подпись<input class="l-label" value="'+esc(data.label||"")+'" placeholder="Например: Регистрация"></label>'+
      '<label>URL<input class="l-url" type="url" value="'+esc(data.url||"")+'" placeholder="https://…"></label>'+
      '<button type="button" class="remove-repeat">Удалить</button>';
    parent.appendChild(row);
    updateRepeaterEmpty();
  }
  function collectFormats(){
    return $$(".format-card","#formatsRepeater").map(card=>({
      name:$(".f-name",card).value.trim(),
      audience:$(".f-audience",card).value.trim(),
      description:$(".f-description",card).value.trim(),
      actions:lines($(".f-actions",card).value),
      result:$(".f-result",card).value.trim()
    })).filter(x=>x.name);
  }
  function collectLinks(parent){
    return $$(".link-row",parent).map(row=>({
      label:$(".l-label",row).value.trim(),
      url:$(".l-url",row).value.trim()
    })).filter(x=>x.label&&x.url);
  }

  function hideEditors(){
    form.hidden=true;
    settingsForm.hidden=true;
    $("#editorEmpty").hidden=true;
  }
  function fillForm(item,isNew=false){
    hideEditors();
    form.reset();
    resetRepeaters();
    activeEditor="item";
    editingOriginalId=isNew?null:item.id;
    form.hidden=false;
    $("#editorMode").textContent=isNew?"Новая карточка":"Редактирование";
    $("#editorTitle").textContent=isNew?"Добавление":item.title;
    $("#deleteBtn").hidden=isNew;
    $("#duplicateBtn").hidden=isNew;
    setVal("id",isNew?"":item.id);
    form.elements.id.readOnly=!isNew;
    setVal("type",item.type||"task");
    setVal("category",item.category||"");
    setVal("title",item.title||"");
    setVal("short",item.short||"");
    setVal("start",item.start||"");
    setVal("deadline",item.deadline||"");
    setVal("eventDate",item.eventDate||"");
    setVal("reportDeadline",item.reportDeadline||"");
    setVal("priority",item.priority||"normal");
    setVal("calendarKind",item.calendarKind||(item.type==="action"?"concept":item.type==="event"?"event":"task"));
    const cm=item.calendarMap||{};
    setVal("calendarStartKind",cm.start!==undefined?cm.start:(item.type==="action"?"concept":""));
    setVal("calendarDeadlineKind",cm.deadline!==undefined?cm.deadline:(item.type==="action"?(item.reportDeadline?"":"report"):(item.type==="event"?"":"task")));
    setVal("calendarEventKind",cm.eventDate!==undefined?cm.eventDate:(item.eventDate?"event":""));
    setVal("calendarReportKind",cm.reportDeadline!==undefined?cm.reportDeadline:(item.reportDeadline?"report":""));
    setVal("status",item.status||"active");
    setVal("badges",(item.badges||[]).join(", "));
    setVal("source",item.source||"");
    setVal("steps",(item.steps||[]).join("\n"));
    setVal("completion",(Array.isArray(item.completion)?item.completion:(item.completion?[item.completion]:[])).join("\n"));
    setVal("deliverables",(item.deliverables||[]).join("\n"));
    setVal("notes",(item.notes||[]).join("\n"));
    setVal("copyText",item.copyText||"");
    setVal("publicationDeadline",item.publication&&item.publication.deadline||"");
    setVal("publicationWhere",item.publication&&item.publication.where||"");
    setVal("publicationReport",item.publication&&item.publication.report||"");
    setVal("publicationRequirements",item.publication&&item.publication.requirements?(item.publication.requirements||[]).join("\n"):"");
    setVal("hashtags",(item.hashtags||[]).join("\n"));
    setVal("hashtagsByOrg",(item.hashtagsByOrg||[]).join("\n"));
    $$('input[name="audience"]',form).forEach(x=>x.checked=(item.audience||[]).includes(x.value));
    form.elements.visible.checked=item.visible!==false;
    (item.formatDetails||[]).forEach(addFormat);
    if(!(item.formatDetails||[]).length && (item.formats||[]).length) item.formats.forEach(name=>addFormat({name}));
    (item.links||[]).forEach(x=>addLink("link",x));
    (item.materials||[]).forEach(x=>addLink("material",x));
    updateRepeaterEmpty();
    setDirty(false);
    renderList();
    switchTab("basic");
  }

  function readForm(){
    const title=getVal("title");
    const id=(getVal("id")||slugify(title)||("item-"+Date.now())).replace(/[^a-zA-Z0-9_-]/g,"");
    const formatDetails=collectFormats();
    const pub={
      deadline:getVal("publicationDeadline"),
      where:getVal("publicationWhere"),
      report:getVal("publicationReport"),
      requirements:lines(getVal("publicationRequirements"))
    };
    const hasPub=pub.deadline||pub.where||pub.report||pub.requirements.length;
    const status=getVal("status")||"active";
    return {
      id,type:getVal("type")||"task",title,short:getVal("short"),
      start:getVal("start")||null,deadline:getVal("deadline")||null,eventDate:getVal("eventDate")||null,reportDeadline:getVal("reportDeadline")||null,
      priority:getVal("priority")||"normal",
      calendarKind:getVal("calendarKind")||(getVal("type")==="action"?"concept":getVal("type")==="event"?"event":"task"),
      audience:$('input[name="audience"]:checked',form).map(x=>x.value),
      status,category:getVal("category")||"Другое",
      badges:badges(getVal("badges")),source:getVal("source"),
      visible:status==="draft"?false:form.elements.visible.checked,
      steps:lines(getVal("steps")),completion:lines(getVal("completion")),deliverables:lines(getVal("deliverables")),
      formats:formatDetails.map(x=>x.name),formatDetails,
      hashtags:tags(getVal("hashtags")),hashtagsByOrg:lines(getVal("hashtagsByOrg")),
      notes:lines(getVal("notes")),links:collectLinks($("#linksRepeater")),materials:collectLinks($("#materialsRepeater")),
      copyText:getVal("copyText"),...(hasPub?{publication:pub}:{})
    };
  }

  function setDirty(v=true){
    dirty=v;
    if(activeEditor==="item") $("#saveState").textContent=v?"Есть неопубликованные изменения":"Изменения сохранены";
    if(activeEditor==="settings") $("#settingsSaveState").textContent=v?"Есть несохранённые изменения":"Настройки сохранены";
  }
  function switchTab(name){
    $$(".form-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
    $$(".form-panel",form).forEach(p=>p.classList.toggle("active",p.dataset.panel===name));
  }

  function fillSettings(){
    hideEditors();
    activeEditor="settings";
    editingOriginalId=null;
    settingsForm.hidden=false;
    for(const [key,value] of Object.entries({...defaultSiteSettings,...siteSettings})){
      if(settingsForm.elements[key]) settingsForm.elements[key].value=value||"";
    }
    setDirty(false);
    renderList();
  }
  function readSettings(){
    const out={};
    for(const key of Object.keys(defaultSiteSettings)){
      const el=settingsForm.elements[key];
      out[key]=el?el.value.trim():"";
    }
    return out;
  }

  function openPreview(html){
    $("#previewContent").innerHTML=html;
    $("#previewModal").hidden=false;
    document.body.style.overflow="hidden";
  }
  function previewItem(){
    const i=readForm();
    if(!i.title){toast("Сначала укажите название.");return}
    const meta=[typeLabels[i.type]||i.type,i.category,i.deadline?("до "+fmtDate(i.deadline)):"",(i.audience||[]).join(", ")].filter(Boolean).map(x=>'<span class="preview-chip">'+esc(x)+'</span>').join("");
    const sections=[];
    if(i.completion.length) sections.push('<section class="preview-section"><h3>Когда считается выполненным</h3><ul>'+i.completion.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>');
    if(i.steps.length) sections.push('<section class="preview-section"><h3>Что нужно сделать</h3><ol>'+i.steps.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ol></section>');
    if(i.formatDetails.length) sections.push('<section class="preview-section"><h3>Форматы участия</h3>'+i.formatDetails.map((f,n)=>'<p><strong>'+(n+1)+'. '+esc(f.name)+'</strong>'+(f.audience?' — '+esc(f.audience):'')+'</p><p>'+esc(f.description)+'</p>'+(f.actions.length?'<ol>'+f.actions.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ol>':'')+(f.result?'<p><strong>Результат:</strong> '+esc(f.result)+'</p>':'')).join("")+'</section>');
    if(i.deliverables.length) sections.push('<section class="preview-section"><h3>Что сдаём</h3><ul>'+i.deliverables.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>');
    if(i.publication) sections.push('<section class="preview-section"><h3>Публикация и отчётность</h3><p><strong>'+esc(i.publication.deadline||"")+'</strong></p><p>'+esc(i.publication.where||"")+'</p><p>'+esc(i.publication.report||"")+'</p><ul>'+i.publication.requirements.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>');
    if(i.notes.length) sections.push('<section class="preview-section"><h3>Важно</h3>'+i.notes.map(x=>'<p>'+esc(x)+'</p>').join("")+'</section>');
    if(i.hashtags.length) sections.push('<section class="preview-section"><h3>Хештеги</h3><p>'+i.hashtags.map(esc).join(" ")+'</p></section>');
    openPreview('<div class="preview-meta">'+meta+'</div><h1 class="preview-title">'+esc(i.title)+'</h1><p class="preview-summary">'+esc(i.short)+'</p>'+sections.join(""));
  }
  function previewSettings(){
    const s=readSettings();
    openPreview(
      '<div class="preview-meta"><span class="preview-chip">Главная страница</span></div>'+
      '<p><strong>'+esc(s.heroEyebrow)+'</strong></p>'+
      '<h1 class="preview-title">'+esc(s.heroTitle)+' <span style="color:#D90912">'+esc(s.heroAccent)+'</span></h1>'+
      '<p class="preview-summary">'+esc(s.heroLead)+'</p>'+
      '<section class="preview-section"><h3>Разделы</h3>'+
      '<p><strong>01 · '+esc(s.nowTitle)+'</strong><br>'+esc(s.nowSubtitle)+'</p>'+
      '<p><strong>02 · '+esc(s.calendarTitle)+'</strong><br>'+esc(s.calendarSubtitle)+'</p>'+
      '<p><strong>03 · '+esc(s.projectsTitle)+'</strong><br>'+esc(s.projectsSubtitle)+'</p>'+
      '<p><strong>04 · '+esc(s.docsTitle)+'</strong><br>'+esc(s.docsSubtitle)+'</p></section>'
    );
  }

  async function publishItem(e){
    e.preventDefault();
    const item=readForm();
    if(!item.title){toast("Укажите название.");switchTab("basic");return}
    if(!item.short){toast("Добавьте краткое описание для главной.");switchTab("basic");return}
    if(!item.category){toast("Укажите категорию.");switchTab("basic");return}
    const buttons=$$('button[type="submit"]',form);
    const old=buttons.map(b=>b.textContent);
    buttons.forEach(b=>{b.disabled=true;b.textContent="Публикуем…"});
    $("#saveState").textContent="Сохраняем…";
    try{
      const result=await api({action:"save-item",item});
      const oldIdx=editingOriginalId?items.findIndex(x=>x.id===editingOriginalId):-1;
      const sameIdx=items.findIndex(x=>x.id===item.id);
      if(oldIdx>=0) items[oldIdx]=structuredClone(item);
      else if(sameIdx>=0) items[sameIdx]=structuredClone(item);
      else items.push(structuredClone(item));
      editingOriginalId=item.id;
      form.elements.id.value=item.id;
      form.elements.id.readOnly=true;
      $("#deleteBtn").hidden=false;
      $("#duplicateBtn").hidden=false;
      $("#editorMode").textContent="Редактирование";
      $("#editorTitle").textContent=item.title;
      setDirty(false);
      $("#saveState").textContent="Опубликовано. Сайт обновляется…";
      renderList();
      toast(result.mode==="created"?"Карточка добавлена":"Карточка обновлена");
    }catch(err){
      $("#saveState").textContent="Не удалось опубликовать";
      toast(err.message);
    }finally{
      buttons.forEach((b,i)=>{b.disabled=false;b.textContent=old[i]});
    }
  }
  async function saveSettings(e){
    e.preventDefault();
    const settings=readSettings();
    const buttons=$$('button[type="submit"]',settingsForm);
    const old=buttons.map(b=>b.textContent);
    buttons.forEach(b=>{b.disabled=true;b.textContent="Сохраняем…"});
    $("#settingsSaveState").textContent="Сохраняем…";
    try{
      await api({action:"save-settings",settings});
      siteSettings={...settings};
      dirty=false;
      $("#settingsSaveState").textContent="Сохранено. Сайт обновляется…";
      toast("Настройки сохранены");
    }catch(err){
      $("#settingsSaveState").textContent="Не удалось сохранить";
      toast(err.message);
    }finally{
      buttons.forEach((b,i)=>{b.disabled=false;b.textContent=old[i]});
    }
  }

  async function deleteCurrent(){
    if(!editingOriginalId) return;
    const item=items.find(x=>x.id===editingOriginalId);
    if(!confirm('Удалить карточку «'+(item?item.title:editingOriginalId)+'»?')) return;
    try{
      await api({action:"delete-item",id:editingOriginalId});
      items=items.filter(x=>x.id!==editingOriginalId);
      editingOriginalId=null;
      activeEditor="none";
      form.hidden=true;
      $("#editorEmpty").hidden=false;
      renderList();
      toast("Карточка удалена");
    }catch(err){ toast(err.message); }
  }
  function duplicateCurrent(){
    const item=readForm();
    item.id="";
    item.title=item.title+" — копия";
    fillForm(item,true);
    setDirty(true);
  }

  $("#loginForm").addEventListener("submit",async e=>{
    e.preventDefault();
    $("#loginMessage").textContent="";
    try{
      const result=await api({action:"login",password:$("#passwordInput").value});
      token=result.token;
      sessionStorage.setItem("pervyeAdminToken",token);
      $("#passwordInput").value="";
      showWorkspace();
    }catch(err){
      $("#loginMessage").textContent=err.message;
    }
  });
  $("#logoutBtn").addEventListener("click",()=>{
    token="";
    sessionStorage.removeItem("pervyeAdminToken");
    showLogin();
  });
  $("#newItemBtn").addEventListener("click",()=>{
    if(dirty && !confirm("Есть несохранённые изменения. Продолжить без сохранения?")) return;
    fillForm({type:"task",priority:"normal",status:"active",visible:true,audience:["schools"],category:"",title:"",short:""},true);
  });
  $("#siteSettingsBtn").addEventListener("click",()=>{
    if(dirty && !confirm("Есть несохранённые изменения. Перейти к настройкам без сохранения?")) return;
    fillSettings();
  });
  $("#itemList").addEventListener("click",e=>{
    const btn=e.target.closest("[data-edit]");
    if(!btn) return;
    if(dirty && !confirm("Есть несохранённые изменения. Перейти к другой карточке без сохранения?")) return;
    const item=items.find(x=>x.id===btn.dataset.edit);
    if(item) fillForm(structuredClone(item),false);
  });
  $("#itemSearch").addEventListener("input",renderList);
  $("#itemTypeFilter").addEventListener("change",renderList);
  $$(".form-tabs button").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("#addFormatBtn").addEventListener("click",()=>{addFormat();setDirty()});
  $("#addLinkBtn").addEventListener("click",()=>{addLink("link");setDirty()});
  $("#addMaterialBtn").addEventListener("click",()=>{addLink("material");setDirty()});
  document.addEventListener("click",e=>{
    const rm=e.target.closest(".remove-repeat");
    if(rm){rm.closest(".repeat-card,.link-row").remove();updateRepeaterEmpty();setDirty();return}
    if(e.target.closest("[data-close-preview]")){$("#previewModal").hidden=true;document.body.style.overflow="";}
  });
  form.addEventListener("input",()=>setDirty());
  form.addEventListener("change",()=>setDirty());
  settingsForm.addEventListener("input",()=>setDirty());
  settingsForm.addEventListener("change",()=>setDirty());
  form.addEventListener("submit",publishItem);
  settingsForm.addEventListener("submit",saveSettings);
  $("#previewBtn").addEventListener("click",previewItem);
  $("#settingsPreviewBtn").addEventListener("click",previewSettings);
  $("#deleteBtn").addEventListener("click",deleteCurrent);
  $("#duplicateBtn").addEventListener("click",duplicateCurrent);
  window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});

  (async()=>{
    const ready=await checkSetup();
    if(token&&ready) showWorkspace(); else showLogin(ready?"":"Вход временно недоступен.");
  })();
})();