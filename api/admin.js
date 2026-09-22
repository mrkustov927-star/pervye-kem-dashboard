const crypto = require("crypto");

const OWNER = process.env.GITHUB_OWNER || "mrkustov927-star";
const REPO = process.env.GITHUB_REPO || "pervye-kem-dashboard";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const DATA_PATH = "data.js";
const ALLOWED_TYPES = new Set(["task","project","action","event","info"]);
const ALLOWED_PRIORITIES = new Set(["urgent","high","normal"]);
const ALLOWED_STATUSES = new Set(["draft","new","soon","upcoming","active","done"]);

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
function slugify(s) {
  return cleanString(s,200).toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-zа-яё0-9]+/gi,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,70) || "item";
}
function cleanItem(raw) {
  const type = ALLOWED_TYPES.has(raw && raw.type) ? raw.type : "task";
  const priority = ALLOWED_PRIORITIES.has(raw && raw.priority) ? raw.priority : "normal";
  const status = ALLOWED_STATUSES.has(raw && raw.status) ? raw.status : "active";
  const title = cleanString(raw && raw.title, 300);
  if (!title) throw new Error("Укажите название.");
  const idBase = cleanString(raw && raw.id, 90).replace(/[^a-zA-Z0-9_-]/g,"") || slugify(title);
  const item = {
    id: idBase,
    type,
    title,
    short: cleanString(raw.short, 1600),
    start: cleanString(raw.start, 10) || null,
    deadline: cleanString(raw.deadline, 10) || null,
    priority,
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
    copyText: cleanString(raw.copyText,6000)
  };
  Object.entries(optional).forEach(([k,v])=>{
    if (Array.isArray(v) ? v.length : Boolean(v)) item[k]=v;
  });
  const publication = cleanPublication(raw.publication);
  if (publication) item.publication = publication;
  return item;
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
  if (req.method === "GET") {
    return json(res,200,{ok:true,configured:configured()});
  }
  if (req.method !== "POST") return json(res,405,{ok:false,error:"Метод не поддерживается."});
  if (!configured()) return json(res,503,{ok:false,code:"NOT_CONFIGURED",error:"Админ-панель ещё не настроена: нужны ADMIN_PASSWORD и GITHUB_TOKEN."});

  const body = req.body || {};
  if (body.action === "login") {
    if (!checkPassword(body.password)) return json(res,401,{ok:false,error:"Неверный пароль."});
    return json(res,200,{ok:true,token:signSession()});
  }

  const auth = String(req.headers.authorization||"");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!validSession(token)) return json(res,401,{ok:false,error:"Сессия истекла. Войдите снова."});

  try {
    if (body.action === "save-item") {
      const incoming = cleanItem(body.item||{});
      const {data,sha} = await loadData();
      data.items = Array.isArray(data.items) ? data.items : [];
      const idx = data.items.findIndex(x=>x.id===incoming.id);
      if (idx >= 0) data.items[idx] = incoming;
      else data.items.push(incoming);
      const result = await saveData(data,sha,(idx>=0?"Обновить: ":"Добавить: ")+incoming.title);
      return json(res,200,{ok:true,mode:idx>=0?"updated":"created",sha:result.commit && result.commit.sha});
    }
    if (body.action === "delete-item") {
      const id = cleanString(body.id,90).replace(/[^a-zA-Z0-9_-]/g,"");
      if (!id) throw new Error("Не указан ID.");
      const {data,sha} = await loadData();
      const before = Array.isArray(data.items)?data.items.length:0;
      data.items = (data.items||[]).filter(x=>x.id!==id);
      if (data.items.length===before) throw new Error("Карточка не найдена.");
      const result = await saveData(data,sha,"Удалить карточку: "+id);
      return json(res,200,{ok:true,sha:result.commit && result.commit.sha});
    }
    return json(res,400,{ok:false,error:"Неизвестное действие."});
  } catch (e) {
    console.error(e);
    return json(res,500,{ok:false,error:e.message || "Ошибка сохранения."});
  }
};