(()=> {
  const D = window.DASHBOARD_DATA || {items:[],meta:{}};
  let items = Array.isArray(D.items) ? structuredClone(D.items) : [];
  let documents = Array.isArray(D.documents) ? structuredClone(D.documents) : [];
  let token = sessionStorage.getItem("pervyeAdminToken") || "";
  let editingOriginalId = null;
  let dirty = false;
  let activeEditor = "none";
  let attachments = [];
  let pendingFiles = [];
  let deletedAttachments = [];

  const rootNode = r => typeof r === "string" ? document.querySelector(r) : r;
  const $ = (s,r=document)=>rootNode(r).querySelector(s);
  const $$ = (s,r=document)=>[...rootNode(r).querySelectorAll(s)];
  const form = $("#itemForm");
  const settingsForm = $("#siteSettingsForm");
  const resourcesForm = $("#resourcesForm");
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
  async function waitForLiveVersion(updatedAt,onState){
    if(!updatedAt) return false;
    const needle='"updatedAt": "'+updatedAt+'"';
    for(let n=0;n<30;n++){
      if(onState) onState(n);
      await new Promise(r=>setTimeout(r,n===0?1200:2000));
      try{
        const response=await fetch("/data.js?check="+Date.now(),{cache:"no-store"});
        const source=await response.text();
        if(response.ok&&source.includes(needle)) return true;
      }catch{}
    }
    return false;
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
    $("#workspace").classList.remove("mobile-editing");
    $("#adminHeader").hidden=true;
    $("#loginMessage").textContent=message;
    activeEditor="none";
  }
  function showWorkspace(){
    $("#loginCard").hidden=true;
    $("#workspace").hidden=false;
    $("#workspace").classList.remove("mobile-editing");
    $("#adminHeader").hidden=false;
    $("#logoutBtn").hidden=false;
    renderCategoryOptions();
    renderList();
  }

  function renderCategoryOptions(){
    const el=$("#categoryOptions");
    if(!el) return;
    const categories=[...new Set(items.map(i=>String(i.category||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
    el.innerHTML=categories.map(x=>'<option value="'+esc(x)+'"></option>').join("");
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
    const p=$("#itemPublishFilter").value;
    const list=items.filter(i=>{
      if(t!=="all"&&i.type!==t) return false;
      if(p==="published" && (i.status==="draft"||i.visible===false)) return false;
      if(p==="draft" && i.status!=="draft") return false;
      if(p==="hidden" && !(i.visible===false&&i.status!=="draft")) return false;
      if(q && ![i.title,i.short,i.category].join(" ").toLowerCase().includes(q)) return false;
      return true;
    }).sort(itemSort);
    $("#itemList").innerHTML=list.map(i=>{
      const publishState=i.status==="draft"?"Черновик":(i.visible===false?"Скрыта":"Опубликована");
      const stateClass=i.status==="draft"?"draft":(i.visible===false?"hidden":"published");
      return '<button class="item-row '+(activeEditor==="item"&&editingOriginalId===i.id?"active":"")+'" data-edit="'+esc(i.id)+'" type="button">'+
      '<span class="item-row-top"><span class="item-row-type">'+esc(typeLabels[i.type]||i.type)+'</span><span class="item-row-date">'+esc(fmtDate(i.deadline||i.eventDate||i.start))+'</span></span>'+
      '<span class="item-row-status '+stateClass+'">'+publishState+'</span>'+
      '<strong>'+esc(i.title)+'</strong><p>'+esc(i.short||"Без краткого описания")+'</p></button>';
    }).join("") || '<div class="empty-repeater">Ничего не найдено.</div>';
  }

  function setVal(name,value){ const el=form.elements[name]; if(el) el.value=value??""; }
  function getVal(name){ const el=form.elements[name]; return el ? el.value.trim() : ""; }
  function resetRepeaters(){
    $("#formatsRepeater").innerHTML="";
    $("#linksRepeater").innerHTML="";
    $("#materialsRepeater").innerHTML="";
    attachments=[];
    pendingFiles=[];
    deletedAttachments=[];
    if($("#fileInput")) $("#fileInput").value="";
    renderAttachments();
    updateRepeaterEmpty();
  }
  function updateRepeaterEmpty(){
    $("#formatsEmpty").hidden=Boolean($("#formatsRepeater").children.length);
    $("#linksEmpty").hidden=Boolean($("#linksRepeater").children.length);
    $("#materialsEmpty").hidden=Boolean($("#materialsRepeater").children.length);
    if($("#attachmentsEmpty")) $("#attachmentsEmpty").hidden=Boolean(attachments.length||pendingFiles.length);
  }
  function fileSize(bytes){
    const n=Number(bytes)||0;
    if(n<1024) return n+" Б";
    if(n<1048576) return Math.round(n/1024)+" КБ";
    return (n/1048576).toFixed(1).replace(".0","")+" МБ";
  }
  function renderAttachments(){
    const box=$("#attachmentsList");
    if(!box) return;
    const saved=attachments.map((a,n)=>
      '<div class="attachment-admin-row saved"><span class="attachment-file-icon">↓</span><div><strong>'+esc(a.name)+'</strong><small>'+esc(fileSize(a.size))+' · загружен</small></div><button type="button" class="remove-attachment" data-remove-attachment="'+n+'">Убрать</button></div>'
    ).join("");
    const pending=pendingFiles.map((f,n)=>
      '<div class="attachment-admin-row pending"><span class="attachment-file-icon">↑</span><div><strong>'+esc(f.name)+'</strong><small>'+esc(fileSize(f.size))+' · будет загружен при публикации</small></div><button type="button" class="remove-pending-file" data-remove-pending="'+n+'">Убрать</button></div>'
    ).join("");
    box.innerHTML=saved+pending;
    updateRepeaterEmpty();
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

  function publicationState(){
    if(activeEditor!=="item"||!form||form.hidden) return {text:"",cls:""};
    if(!editingOriginalId) return {text:dirty?"Новая · не опубликована":"Новая карточка",cls:"new"};
    const status=form.elements.status ? form.elements.status.value : "active";
    const visible=form.elements.visible ? form.elements.visible.checked : true;
    if(status==="draft") return {text:dirty?"Черновик · есть изменения":"Черновик · не опубликован",cls:"draft"};
    if(!visible) return {text:dirty?"Скрыта · есть изменения":"Скрыта с сайта",cls:"hidden"};
    return {text:dirty?"Опубликована · есть изменения":"Опубликована",cls:dirty?"dirty":"published"};
  }
  function updatePublishBadge(){
    const badge=$("#publishStateBadge");
    if(!badge) return;
    const state=publicationState();
    badge.textContent=state.text||"";
    badge.className="publish-state-badge "+(state.cls||"");
  }
  function enterMobileEditor(){
    $("#workspace").classList.add("mobile-editing");
    if(window.innerWidth<=760) window.scrollTo({top:0,behavior:"instant"});
  }
  function leaveMobileEditor(){
    $("#workspace").classList.remove("mobile-editing");
    if(window.innerWidth<=760) window.scrollTo({top:0,behavior:"instant"});
  }

  function hideEditors(){
    form.hidden=true;
    settingsForm.hidden=true;
    resourcesForm.hidden=true;
    $("#editorEmpty").hidden=true;
  }
  function fillForm(item,isNew=false){
    hideEditors();
    form.reset();
    resetRepeaters();
    activeEditor="item";
    editingOriginalId=isNew?null:item.id;
    form.hidden=false;
    enterMobileEditor();
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
    attachments=structuredClone(item.attachments||[]);
    pendingFiles=[];
    deletedAttachments=[];
    renderAttachments();
    updateRepeaterEmpty();
    setDirty(false);
    updatePublishBadge();
    renderList();
    switchTab("basic");
  }

  function readForm(){
    const title=getVal("title");
    const id=getVal("id")||("item-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7));
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
      calendarKind:(getVal("type")==="action"?"concept":getVal("type")==="event"?"event":"task"),
      calendarMap:{
        start:getVal("calendarStartKind"),
        deadline:getVal("calendarDeadlineKind"),
        eventDate:getVal("calendarEventKind"),
        reportDeadline:getVal("calendarReportKind")
      },
      audience:$$('input[name="audience"]:checked',form).map(x=>x.value),
      status,category:getVal("category")||"Другое",
      badges:badges(getVal("badges")),source:getVal("source"),
      visible:status==="draft"?false:form.elements.visible.checked,
      steps:lines(getVal("steps")),completion:lines(getVal("completion")),deliverables:lines(getVal("deliverables")),
      formats:formatDetails.map(x=>x.name),formatDetails,
      hashtags:tags(getVal("hashtags")),hashtagsByOrg:lines(getVal("hashtagsByOrg")),
      notes:lines(getVal("notes")),links:collectLinks($("#linksRepeater")),materials:collectLinks($("#materialsRepeater")),
      attachments:structuredClone(attachments),
      copyText:getVal("copyText"),...(hasPub?{publication:pub}:{})
    };
  }

  function setDirty(v=true){
    dirty=v;
    if(activeEditor==="item"){
      $("#saveState").textContent=v?"Есть неопубликованные изменения":"Изменения сохранены";
      updatePublishBadge();
    }
    if(activeEditor==="settings") $("#settingsSaveState").textContent=v?"Есть несохранённые изменения":"Настройки сохранены";
    if(activeEditor==="resources") $("#resourcesSaveState").textContent=v?"Есть несохранённые изменения":"Ресурсы сохранены";
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
    enterMobileEditor();
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

  function fileToBase64(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||"").split(",").pop()||"");
      reader.onerror=()=>reject(new Error("Не удалось прочитать файл "+file.name));
      reader.readAsDataURL(file);
    });
  }
  async function uploadPendingFiles(itemId){
    if(!pendingFiles.length) return [];
    const uploaded=[];
    for(let n=0;n<pendingFiles.length;n++){
      const file=pendingFiles[n];
      $("#saveState").textContent="Загружаем файл "+(n+1)+" из "+pendingFiles.length+": "+file.name;
      const data=await fileToBase64(file);
      const result=await api({action:"upload-file",itemId,file:{name:file.name,type:file.type,data}});
      uploaded.push(result.attachment);
    }
    attachments=[...attachments,...uploaded];
    pendingFiles=[];
    renderAttachments();
    return uploaded;
  }

  function resourceCardOptions(selected=""){
    return '<option value="">Выберите карточку…</option>'+items.map(i=>'<option value="'+esc(i.id)+'" '+(i.id===selected?"selected":"")+'>'+esc(i.title)+'</option>').join("");
  }
  function syncResourceTarget(row){
    const type=$(".r-target",row).value;
    $(".r-url-wrap",row).hidden=type!=="url";
    $(".r-item-wrap",row).hidden=type!=="item";
  }
  function addResource(data={}){
    const target=data.itemId?"item":"url";
    const row=document.createElement("div");
    row.className="resource-card";
    row.innerHTML=
      '<div class="resource-card-head"><strong>Ресурс</strong><div class="resource-order">'+
      '<button type="button" class="move-resource" data-dir="-1" aria-label="Переместить выше">↑</button>'+
      '<button type="button" class="move-resource" data-dir="1" aria-label="Переместить ниже">↓</button>'+
      '<button type="button" class="remove-resource">Удалить</button></div></div>'+
      '<div class="field-grid two">'+
      '<label>Тип / рубрика<input class="r-kind" value="'+esc(data.kind||"Ссылка")+'" placeholder="Курс, Проект, Сообщество…"></label>'+
      '<label>Что открывать<select class="r-target"><option value="url" '+(target==="url"?"selected":"")+'>Внешнюю ссылку</option><option value="item" '+(target==="item"?"selected":"")+'>Карточку сайта</option></select></label>'+
      '</div>'+
      '<label>Название<input class="r-title" value="'+esc(data.title||"")+'" placeholder="Название ресурса"></label>'+
      '<label>Краткое описание<textarea class="r-description" rows="2" placeholder="Что пользователь найдёт по этой ссылке">'+esc(data.description||"")+'</textarea></label>'+
      '<label class="r-url-wrap">Ссылка<input class="r-url" type="url" value="'+esc(data.url||"")+'" placeholder="https://…"></label>'+
      '<label class="r-item-wrap">Карточка<select class="r-item">'+resourceCardOptions(data.itemId||"")+'</select></label>';
    $("#resourcesRepeater").appendChild(row);
    syncResourceTarget(row);
    updateResourcesEmpty();
  }
  function updateResourcesEmpty(){
    $("#resourcesEmpty").hidden=Boolean($("#resourcesRepeater").children.length);
  }
  function collectResources(){
    return $(".resource-card","#resourcesRepeater").map((row,n)=>{
      const target=$(".r-target",row).value;
      return {
        id:(documents[n]&&documents[n].id)||("resource-"+Date.now().toString(36)+"-"+n),
        kind:$(".r-kind",row).value.trim()||"Ссылка",
        title:$(".r-title",row).value.trim(),
        description:$(".r-description",row).value.trim(),
        ...(target==="item"?{itemId:$(".r-item",row).value}:{url:$(".r-url",row).value.trim()})
      };
    }).filter(x=>x.title&&(x.url||x.itemId));
  }
  function fillResources(){
    hideEditors();
    activeEditor="resources";
    editingOriginalId=null;
    resourcesForm.hidden=false;
    enterMobileEditor();
    $("#resourcesRepeater").innerHTML="";
    documents.forEach(addResource);
    updateResourcesEmpty();
    setDirty(false);
    renderList();
  }
  async function saveResources(e){
    e.preventDefault();
    const next=collectResources();
    const buttons=$('button[type="submit"]',resourcesForm);
    const old=buttons.map(b=>b.textContent);
    buttons.forEach(b=>{b.disabled=true;b.textContent="Сохраняем…"});
    $("#resourcesSaveState").textContent="Сохраняем…";
    try{
      const result=await api({action:"save-documents",documents:next});
      documents=structuredClone(result.documents||next);
      dirty=false;
      $("#resourcesSaveState").textContent="Сохранено. Vercel обновляет сайт…";
      buttons.forEach((b,i)=>{b.disabled=false;b.textContent=old[i]});
      const live=await waitForLiveVersion(result.updatedAt,n=>{
        $("#resourcesSaveState").textContent=n<3?"Vercel публикует ресурсы…":"Проверяем опубликованную версию…";
      });
      $("#resourcesSaveState").textContent=live?"Ресурсы опубликованы на сайте":"Сохранено в GitHub. Публикация ещё обновляется…";
      toast(live?"Ресурсы уже на сайте":"Ресурсы сохранены");
    }catch(err){
      $("#resourcesSaveState").textContent="Не удалось сохранить";
      toast(err.message);
    }finally{
      buttons.forEach((b,i)=>{b.disabled=false;b.textContent=old[i]});
    }
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
    if((i.attachments||[]).length||pendingFiles.length) sections.push('<section class="preview-section"><h3>Файлы</h3><ul>'+[...(i.attachments||[]).map(x=>x.name),...pendingFiles.map(x=>x.name+" (ожидает загрузки)")].map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>');
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
      if(pendingFiles.length){
        await uploadPendingFiles(item.id);
        item.attachments=structuredClone(attachments);
      }
      const result=await api({action:"save-item",item});
      const savedItem=result.item||item;
      const oldIdx=editingOriginalId?items.findIndex(x=>x.id===editingOriginalId):-1;
      const sameIdx=items.findIndex(x=>x.id===savedItem.id);
      if(oldIdx>=0) items[oldIdx]=structuredClone(savedItem);
      else if(sameIdx>=0) items[sameIdx]=structuredClone(savedItem);
      else items.push(structuredClone(savedItem));
      editingOriginalId=savedItem.id;
      form.elements.id.value=savedItem.id;
      form.elements.id.readOnly=true;
      $("#deleteBtn").hidden=false;
      $("#duplicateBtn").hidden=false;
      $("#editorMode").textContent="Редактирование";
      $("#editorTitle").textContent=savedItem.title;
      if(deletedAttachments.length){
        const removal=[...deletedAttachments];
        deletedAttachments=[];
        for(const a of removal){
          if(!a.path) continue;
          try{await api({action:"delete-file",path:a.path})}catch{}
        }
      }
      renderCategoryOptions();
      setDirty(false);
      updatePublishBadge();
      $("#saveState").textContent="Сохранено. Vercel обновляет сайт…";
      renderList();
      toast(result.mode==="created"?"Карточка добавлена":"Карточка обновлена");
      buttons.forEach((b,i)=>{b.disabled=false;b.textContent=old[i]});
      const live=await waitForLiveVersion(result.updatedAt,n=>{
        $("#saveState").textContent=n<3?"Vercel публикует изменения…":"Проверяем опубликованную версию…";
      });
      $("#saveState").textContent=live?"Опубликовано на основном сайте":"Сохранено в GitHub. Публикация ещё обновляется…";
      if(live) toast("Изменения уже на сайте");
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
      const result=await api({action:"save-settings",settings});
      siteSettings={...settings};
      dirty=false;
      $("#settingsSaveState").textContent="Сохранено. Vercel обновляет сайт…";
      toast("Настройки сохранены");
      buttons.forEach((b,i)=>{b.disabled=false;b.textContent=old[i]});
      const live=await waitForLiveVersion(result.updatedAt,n=>{
        $("#settingsSaveState").textContent=n<3?"Vercel публикует настройки…":"Проверяем опубликованную версию…";
      });
      $("#settingsSaveState").textContent=live?"Настройки опубликованы на сайте":"Сохранено в GitHub. Публикация ещё обновляется…";
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
      leaveMobileEditor();
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
  $("#resourcesBtn").addEventListener("click",()=>{
    if(dirty && !confirm("Есть несохранённые изменения. Перейти к ресурсам без сохранения?")) return;
    fillResources();
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
  $("#backToListBtn").addEventListener("click",()=>{
    if(dirty && !confirm("Есть неопубликованные изменения. Вернуться к списку без сохранения?")) return;
    dirty=false;
    leaveMobileEditor();
    renderList();
  });
  $("#settingsBackToListBtn").addEventListener("click",()=>{
    if(dirty && !confirm("Есть несохранённые изменения. Вернуться к списку без сохранения?")) return;
    dirty=false;
    leaveMobileEditor();
    renderList();
  });
  $("#resourcesBackToListBtn").addEventListener("click",()=>{
    if(dirty && !confirm("Есть несохранённые изменения. Вернуться к списку без сохранения?")) return;
    dirty=false;
    leaveMobileEditor();
    renderList();
  });
  $("#addResourceBtn").addEventListener("click",()=>{addResource();setDirty()});
  $("#itemSearch").addEventListener("input",renderList);
  $("#itemTypeFilter").addEventListener("change",renderList);
  $("#itemPublishFilter").addEventListener("change",renderList);
  $$(".form-tabs button").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("#addFormatBtn").addEventListener("click",()=>{addFormat();setDirty()});
  $("#addLinkBtn").addEventListener("click",()=>{addLink("link");setDirty()});
  $("#addMaterialBtn").addEventListener("click",()=>{addLink("material");setDirty()});
  $("#fileInput").addEventListener("change",e=>{
    const allowed=["pdf","doc","docx","xls","xlsx","ppt","pptx","png","jpg","jpeg","zip","rar","odt","ods"];
    for(const file of [...e.target.files]){
      const ext=(file.name.split(".").pop()||"").toLowerCase();
      if(!allowed.includes(ext)){toast("Файл «"+file.name+"» не поддерживается");continue}
      if(file.size>2621440){toast("«"+file.name+"» больше 2,5 МБ");continue}
      pendingFiles.push(file);
    }
    e.target.value="";
    renderAttachments();
    setDirty();
  });
  document.addEventListener("click",e=>{
    const rm=e.target.closest(".remove-repeat");
    if(rm){rm.closest(".repeat-card,.link-row").remove();updateRepeaterEmpty();setDirty();return}
    const resourceRemove=e.target.closest(".remove-resource");
    if(resourceRemove){resourceRemove.closest(".resource-card").remove();updateResourcesEmpty();setDirty();return}
    const resourceMove=e.target.closest(".move-resource");
    if(resourceMove){
      const row=resourceMove.closest(".resource-card"), dir=Number(resourceMove.dataset.dir);
      if(dir<0&&row.previousElementSibling) row.parentNode.insertBefore(row,row.previousElementSibling);
      if(dir>0&&row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling,row);
      setDirty();return
    }
    const savedFile=e.target.closest("[data-remove-attachment]");
    if(savedFile){
      const removed=attachments.splice(Number(savedFile.dataset.removeAttachment),1)[0];
      if(removed&&removed.path) deletedAttachments.push(removed);
      renderAttachments();setDirty();return
    }
    const pendingFile=e.target.closest("[data-remove-pending]");
    if(pendingFile){pendingFiles.splice(Number(pendingFile.dataset.removePending),1);renderAttachments();setDirty();return}
    if(e.target.closest("[data-close-preview]")){$("#previewModal").hidden=true;document.body.style.overflow="";}
  });
  form.addEventListener("input",()=>setDirty());
  form.addEventListener("change",()=>setDirty());
  settingsForm.addEventListener("input",()=>setDirty());
  settingsForm.addEventListener("change",()=>setDirty());
  resourcesForm.addEventListener("input",()=>setDirty());
  resourcesForm.addEventListener("change",e=>{if(e.target.classList.contains("r-target"))syncResourceTarget(e.target.closest(".resource-card"));setDirty()});
  form.addEventListener("submit",publishItem);
  settingsForm.addEventListener("submit",saveSettings);
  resourcesForm.addEventListener("submit",saveResources);
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