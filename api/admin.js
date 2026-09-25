const crypto = require("crypto");

const OWNER = process.env.GITHUB_OWNER || "mrkustov927-star";
const REPO = process.env.GITHUB_REPO || "pervye-kem-dashboard";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const DATA_PATH = "data.js";
const ALLOWED_TYPES = new Set(["task","project","action","event","info"]);
const ALLOWED_PRIORITIES = new Set(["urgent","high","normal"]);
const ALLOWED_STATUSES = new Set(["draft","new","soon","upcoming","active","done"]);
const ALLOWED_CALENDAR_KINDS = new Set(["concept","task","event","registration"]);
const ALLOWED_FILE_EXTENSIONS = new Set(["pdf","doc","docx","xls","xlsx","ppt","pptx","png","jpg","jpeg","zip","rar","odt","ods"]);
const MAX_FILE_BYTES = 2621440;
const LOGIN_WINDOW = 10 * 60 * 1000;
const LOGIN_LOCK = 15 * 60 * 1000;
const LOGIN_LIMIT = 6;
const loginAttempts = new Map();

function json(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function configured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.GITHUB_TOKEN);
}
function signSession() {
  const payload = Buffer.from(JSON.stringify({exp: Date.now() + 8 * 60 * 60 * 1000})).toString("base64url");
  const sig = crypto.createHmac("sha256", process.env.ADMIN_PASSWORD).update(payload).digest("base64url");
  return payload + "." + sig;
}
function validSession(token) {
  if (!token || !process.env.ADMIN_PASSWORD) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", process.env.ADMIN_PASSWORD).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}
function checkPassword(input) {
  const expected = Buffer.from(String(process.env.ADMIN_PASSWORD || ""));
  const actual = Buffer.from(String(input || ""));
  return expected.length === actual.length && expected.length > 0 && crypto.timingSafeEqual(expected, actual);
}
function clientKey(req) {
  return String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown").split(",")[0].trim();
}
function loginGuard(req) {
  const key = clientKey(req);
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec) return {ok:true,key};
  if (rec.lockUntil && rec.lockUntil > now) return {ok:false,key,retryAfter:Math.ceil((rec.lockUntil-now)/1000)};
  if (now - rec.firstAt > LOGIN_WINDOW) {
    loginAttempts.delete(key);
    return {ok:true,key};
  }
  return {ok:true,key};
}
function loginFailed(key) {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  const next = !rec || now-rec.firstAt>LOGIN_WINDOW ? {count:1,firstAt:now,lockUntil:0} : {...rec,count:rec.count+1};
  if (next.count >= LOGIN_LIMIT) next.lockUntil = now + LOGIN_LOCK;
  loginAttempts.set(key,next);
}
function loginSucceeded(key) {
  loginAttempts.delete(key);
}
function cleanString(v, max=12000) {
  return typeof v === "string" ? v.trim().slice(0,max) : "";
}
function cleanStringArray(v, maxItems=80, maxLen=3000) {
  if (!Array.isArray(v)) return [];
  return v.map(x=>cleanString(x,maxLen)).filter(Boolean).slice(0,maxItems);
}
function cleanLinks(v) {
  if (!Array.isArray(v)) return [];
  return v.map(x=>({
    label: cleanString(x && x.label, 180),
    url: cleanString(x && x.url, 1600)
  })).filter(x=>x.label && /^https?:\/\//i.test(x.url)).slice(0,40);
}
function cleanAttachments(v) {
  if (!Array.isArray(v)) return [];
  return v.map(x=>({
    name: cleanString(x && x.name, 260),
    url: cleanString(x && x.url, 1800),
    path: cleanString(x && x.path, 1200),
    type: cleanString(x && x.type, 160),
    size: Number(x && x.size) || 0
  })).filter(x=>x.name && (x.url.startsWith("/files/") || /^https?:\/\//i.test(x.url))).slice(0,30);
}
function cleanFormatDetails(v) {
  if (!Array.isArray(v)) return [];
  return v.map(x=>({
    name: cleanString(x && x.name, 240),
    audience: cleanString(x && x.audience, 300),
    description: cleanString(x && x.description, 4000),
    actions: cleanStringArray(x && x.actions, 30, 1500),
    result: cleanString(x && x.result, 2500)
  })).filter(x=>x.name).slice(0,20);
}
function cleanPublication(v) {
  if (!v || typeof v !== "object") return undefined;
  const out = {
    deadline: cleanString(v.deadline, 300),
    where: cleanString(v.where, 500),
    report: cleanString(v.report, 1600),
    requirements: cleanStringArray(v.requirements, 30, 1500)
  };
  return Object.values(out).some(x=>Array.isArray(x)?x.length:Boolean(x)) ? out : undefined;
}
function cleanCalendarMap(v) {
  if (!v || typeof v !== "object") return undefined;
  const out = {};
  for (const key of ["start","deadline","eventDate","reportDeadline"]) {
    const val = cleanString(v[key], 40);
    out[key] = ALLOWED_CALENDAR_KINDS.has(val) ? val : "";
  }
  return out;
}
function cleanSettings(v) {
  const src = v && typeof v === "object" ? v : {};
  const keys = [
    "siteTitle","districtLabel","heroEyebrow","heroTitle","heroAccent","heroLead",
    "heroPrimary","heroSecondary","nowTitle","nowSubtitle","calendarTitle",
    "calendarSubtitle","projectsTitle","projectsSubtitle","docsTitle","docsSubtitle",
    "archiveTitle","footerSubtitle"
  ];
  const out = {};
  for (const key of keys) out[key] = cleanString(src[key], key === "heroLead" ? 1200 : 300);
  return out;
}
function safeId(v,prefix="item") {
  const current = cleanString(v,90).replace(/[^a-zA-Z0-9_-]/g,"");
  if (current && /[a-zA-Z0-9]/.test(current)) return current;
  return prefix+"-"+Date.now().toString(36)+"-"+crypto.randomBytes(3).toString("hex");
}
function cleanDocuments(v) {
  if (!Array.isArray(v)) return [];
  return v.map(raw=>{
    const url=cleanString(raw && raw.url,1600);
    const itemId=cleanString(raw && raw.itemId,90).replace(/[^a-zA-Z0-9_-]/g,"");
    return {
      id:safeId(raw && raw.id,"resource"),
      title:cleanString(raw && raw.title,240),
      description:cleanString(raw && raw.description,1200),
      kind:cleanString(raw && raw.kind,100) || "Ссылка",
      ...(itemId?{itemId}:{}),
      ...(!itemId && /^https?:\/\//i.test(url)?{url}:{})
    };
  }).filter(x=>x.title && (x.url||x.itemId)).slice(0,80);
}
function cleanItem(raw) {
  const type = ALLOWED_TYPES.has(raw && raw.type) ? raw.type : "task";
  const priority = ALLOWED_PRIORITIES.has(raw && raw.priority) ? raw.priority : "normal";
  const status = ALLOWED_STATUSES.has(raw && raw.status) ? raw.status : "active";
  const calendarKind = ALLOWED_CALENDAR_KINDS.has(raw && raw.calendarKind) ? raw.calendarKind : (type === "action" ? "concept" : type === "event" ? "event" : "task");
  const title = cleanString(raw && raw.title, 300);
  if (!title) throw new Error("Укажите название.");
  const item = {
    id: safeId(raw && raw.id,"item"),
    type,
    title,
    short: cleanString(raw.short, 1600),
    start: cleanString(raw.start, 10) || null,
    deadline: cleanString(raw.deadline, 10) || null,
    priority,
    calendarKind,
    calendarDisplayDate: cleanString(raw.calendarDisplayDate,10) || null,
    calendarDisplayKind: ALLOWED_CALENDAR_KINDS.has(raw.calendarDisplayKind) ? raw.calendarDisplayKind : "",
    calendarMap: cleanCalendarMap(raw.calendarMap),
    audience: cleanStringArray(raw.audience, 20, 100),
    status,
    category: cleanString(raw.category, 180) || "Другое",
    badges: cleanStringArray(raw.badges, 12, 100),
    source: cleanString(raw.source, 500),
    visible: raw.visible !== false
  };
  const optional = {
    eventDate: cleanString(raw.eventDate,10) || null,
    reportDeadline: cleanString(raw.reportDeadline,10) || null,
    steps: cleanStringArray(raw.steps,80,2500),
    completion: cleanStringArray(raw.completion,50,2500),
    deliverables: cleanStringArray(raw.deliverables,50,2500),
    formats: cleanStringArray(raw.formats,30,700),
    formatDetails: cleanFormatDetails(raw.formatDetails),
    hashtags: cleanStringArray(raw.hashtags,60,180),
    hashtagsByOrg: cleanStringArray(raw.hashtagsByOrg,80,600),
    notes: cleanStringArray(raw.notes,60,2500),
    links: cleanLinks(raw.links),
    materials: cleanLinks(raw.materials),
    attachments: cleanAttachments(raw.attachments),
    copyText: cleanString(raw.copyText,6000)
  };
  Object.entries(optional).forEach(([k,v])=>{
    if (Array.isArray(v) ? v.length : Boolean(v)) item[k]=v;
  });
  const publication = cleanPublication(raw.publication);
  if (publication) item.publication = publication;
  return item;
}
function stable(v) {
  return JSON.stringify(v ?? null);
}
function pushUpdate(data,title,text) {
  data.updates = Array.isArray(data.updates) ? data.updates : [];
  const entry={date:new Date().toISOString(),title:cleanString(title,260),text:cleanString(text,1200)};
  const first=data.updates[0];
  const firstTime=first&&first.date?new Date(first.date).getTime():0;
  if(first&&first.title===entry.title&&Date.now()-firstTime<10*60*1000) data.updates[0]=entry;
  else data.updates.unshift(entry);
  data.updates = data.updates.slice(0,30);
}
function describeChanges(before,after) {
  if (!before) return "Добавлена новая карточка с полной инструкцией.";
  const groups=[];
  if (stable([before.start,before.deadline,before.eventDate,before.reportDeadline])!==stable([after.start,after.deadline,after.eventDate,after.reportDeadline])) groups.push("сроки");
  if (stable([before.short,before.steps,before.completion,before.deliverables,before.formatDetails,before.formats,before.notes])!==stable([after.short,after.steps,after.completion,after.deliverables,after.formatDetails,after.formats,after.notes])) groups.push("инструкция");
  if (stable([before.publication,before.hashtags,before.hashtagsByOrg])!==stable([after.publication,after.hashtags,after.hashtagsByOrg])) groups.push("отчётность");
  if (stable([before.links,before.materials,before.attachments])!==stable([after.links,after.materials,after.attachments])) groups.push("ссылки и материалы");
  if (stable([before.calendarMap,before.calendarKind])!==stable([after.calendarMap,after.calendarKind])) groups.push("календарь");
  if (stable([before.status,before.visible,before.priority,before.audience,before.category,before.title])!==stable([after.status,after.visible,after.priority,after.audience,after.category,after.title])) groups.push("параметры карточки");
  return groups.length ? "Уточнены: "+groups.join(", ")+".":"Карточка обновлена.";
}
async function gh(path, options={}) {
  const r = await fetch("https://api.github.com/repos/"+OWNER+"/"+REPO+path, {
    ...options,
    headers: {
      "Accept":"application/vnd.github+json",
      "Authorization":"Bearer "+process.env.GITHUB_TOKEN,
      "X-GitHub-Api-Version":"2022-11-28",
      ...(options.headers||{})
    }
  });
  const text = await r.text();
  let body={};
  try { body = text ? JSON.parse(text) : {}; } catch { body={message:text}; }
  if (!r.ok) throw new Error(body.message || ("GitHub API: "+r.status));
  return body;
}
async function loadData() {
  const file = await gh("/contents/"+DATA_PATH+"?ref="+encodeURIComponent(BRANCH));
  const source = Buffer.from(String(file.content||"").replace(/\n/g,""),"base64").toString("utf8");
  const prefix = "window.DASHBOARD_DATA = ";
  const trimmed = source.trim();
  if (!trimmed.startsWith(prefix)) throw new Error("Не удалось прочитать data.js.");
  const jsonText = trimmed.slice(prefix.length).replace(/;\s*$/,"");
  return {data: JSON.parse(jsonText), sha:file.sha};
}
async function saveData(data, sha, message) {
  data.meta = data.meta || {};
  data.meta.updatedAt = new Date().toISOString();
  const source = "window.DASHBOARD_DATA = "+JSON.stringify(data,null,2)+";\n";
  return gh("/contents/"+DATA_PATH,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      message,
      content:Buffer.from(source,"utf8").toString("base64"),
      sha,
      branch:BRANCH
    })
  });
}

module.exports = async function handler(req,res) {
  if (req.method === "GET") return json(res,200,{ok:true,configured:configured()});
  if (req.method !== "POST") return json(res,405,{ok:false,error:"Метод не поддерживается."});
  if (!configured()) return json(res,503,{ok:false,code:"NOT_CONFIGURED",error:"Админ-панель ещё не настроена."});

  const body = req.body || {};
  if (body.action === "login") {
    const guard=loginGuard(req);
    if(!guard.ok){
      res.setHeader("Retry-After",String(guard.retryAfter||60));
      return json(res,429,{ok:false,error:"Слишком много попыток. Попробуйте немного позже."});
    }
    if (!checkPassword(body.password)) {
      loginFailed(guard.key);
      return json(res,401,{ok:false,error:"Неверный пароль."});
    }
    loginSucceeded(guard.key);
    return json(res,200,{ok:true,token:signSession()});
  }

  const auth = String(req.headers.authorization||"");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!validSession(token)) return json(res,401,{ok:false,error:"Сессия истекла. Войдите снова."});

  try {
    if (body.action === "upload-file") {
      const file = body.file && typeof body.file === "object" ? body.file : {};
      const originalName = cleanString(file.name,260);
      const mime = cleanString(file.type,160) || "application/octet-stream";
      const base64 = cleanString(file.data, 5000000).replace(/^data:[^;]+;base64,/i,"");
      const ext = originalName.includes(".") ? originalName.split(".").pop().toLowerCase() : "";
      if (!originalName || !ALLOWED_FILE_EXTENSIONS.has(ext)) throw new Error("Недопустимый тип файла.");
      if (!base64) throw new Error("Файл пуст.");
      const bytes = Buffer.from(base64,"base64");
      if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new Error("Файл должен быть не больше 2,5 МБ.");
      const itemId = safeId(body.itemId,"card");
      const suffix = crypto.randomBytes(6).toString("hex");
      const filePath = "files/"+itemId+"/"+Date.now()+"-"+suffix+"."+ext;
      const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
      await gh("/contents/"+encodedPath,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          message:"Добавить файл: "+originalName,
          content:bytes.toString("base64"),
          branch:BRANCH
        })
      });
      return json(res,200,{ok:true,attachment:{name:originalName,url:"/"+filePath,path:filePath,type:mime,size:bytes.length}});
    }

    if (body.action === "delete-file") {
      const path=cleanString(body.path,1200).replace(/^\/+/, "");
      if(!/^files\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(path)) throw new Error("Некорректный путь файла.");
      const encodedPath=path.split("/").map(encodeURIComponent).join("/");
      const file=await gh("/contents/"+encodedPath+"?ref="+encodeURIComponent(BRANCH));
      await gh("/contents/"+encodedPath,{
        method:"DELETE",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:"Удалить файл: "+path.split("/").pop(),sha:file.sha,branch:BRANCH})
      });
      return json(res,200,{ok:true});
    }

    if (body.action === "save-settings") {
      const incoming = cleanSettings(body.settings||{});
      const {data,sha} = await loadData();
      data.meta = data.meta || {};
      data.meta.site = incoming;
      if (incoming.siteTitle) data.meta.title = incoming.siteTitle;
      const result = await saveData(data,sha,"Обновить настройки сайта");
      return json(res,200,{ok:true,sha:result.commit && result.commit.sha,updatedAt:data.meta.updatedAt});
    }

    if (body.action === "save-documents") {
      const incoming=cleanDocuments(body.documents||[]);
      const {data,sha}=await loadData();
      data.documents=incoming;
      pushUpdate(data,"Обновлены ссылки и документы","Актуализирован раздел быстрых ресурсов и документов.");
      const result=await saveData(data,sha,"Обновить ссылки и документы");
      return json(res,200,{ok:true,sha:result.commit&&result.commit.sha,updatedAt:data.meta.updatedAt,documents:incoming});
    }

    if (body.action === "save-item") {
      const incoming = cleanItem(body.item||{});
      const {data,sha} = await loadData();
      data.items = Array.isArray(data.items) ? data.items : [];
      const idx = data.items.findIndex(x=>x.id===incoming.id);
      const before=idx>=0?data.items[idx]:null;
      if (idx >= 0) data.items[idx] = incoming;
      else data.items.push(incoming);
      if(incoming.visible!==false && incoming.status!=="draft"){
        pushUpdate(data,(idx>=0?"Обновлено: ":"Добавлено: ")+incoming.title,describeChanges(before,incoming));
      }
      const result = await saveData(data,sha,(idx>=0?"Обновить: ":"Добавить: ")+incoming.title);
      return json(res,200,{ok:true,mode:idx>=0?"updated":"created",item:incoming,sha:result.commit && result.commit.sha,updatedAt:data.meta.updatedAt});
    }

    if (body.action === "delete-item") {
      const id = cleanString(body.id,90).replace(/[^a-zA-Z0-9_-]/g,"");
      if (!id) throw new Error("Не указан ID.");
      const {data,sha} = await loadData();
      const before = Array.isArray(data.items)?data.items.length:0;
      data.items = (data.items||[]).filter(x=>x.id!==id);
      if (data.items.length===before) throw new Error("Карточка не найдена.");
      const result = await saveData(data,sha,"Удалить карточку: "+id);
      return json(res,200,{ok:true,sha:result.commit && result.commit.sha,updatedAt:data.meta.updatedAt});
    }

    return json(res,400,{ok:false,error:"Неизвестное действие."});
  } catch (e) {
    console.error(e);
    return json(res,500,{ok:false,error:e.message || "Ошибка сохранения."});
  }
};