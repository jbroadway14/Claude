'use strict';

/* =====================================================================
   Hive Log — offline beehive & inspection tracker
   Plain JavaScript, no build step. Data lives in IndexedDB on the device
   and can be backed up / merged via JSON files.
   ===================================================================== */

/* ---------- Reference data ---------- */

const HIVE_TYPES = [
  ['national', 'National', 11],
  ['national1412', 'National 14×12', 11],
  ['langstroth', 'Langstroth 10-frame', 10],
  ['langstroth8', 'Langstroth 8-frame', 8],
  ['nuc-national', 'National nuc', 5],
  ['nuc-langstroth', 'Langstroth nuc', 5],
  ['other', 'Other', 11],
];

const YN = [['yes', 'Yes'], ['no', 'No']];
const LEVEL = [['low', 'Low'], ['ok', 'Adequate'], ['good', 'Plenty']];

// Index matches year % 5 (international queen marking colours).
const QUEEN_COLOURS = ['blue', 'white', 'yellow', 'red', 'green'];

const NOTIFIABLE = ['afb', 'efb', 'shb', 'vespa'];

const TREATMENTS = [
  ['apiguard', 'Apiguard (thymol)', 28],
  ['apilifevar', 'ApiLife Var (thymol)', 28],
  ['apivar', 'Apivar (amitraz strips)', 42],
  ['maqs', 'MAQS (formic acid)', 7],
  ['formicpro', 'Formic Pro (formic acid)', 14],
  ['bioxal-trickle', 'Api-Bioxal — trickle', 0],
  ['bioxal-vape', 'Api-Bioxal — sublimation', 0],
  ['oxuvar', 'Oxuvar (oxalic acid)', 0],
  ['varromed', 'VarroMed', 0],
  ['apistan', 'Apistan (tau-fluvalinate)', 42],
  ['other', 'Other', 0],
];

const HIVE_SECTIONS = [
  { title: 'Hive', fields: [
    { k: 'name', l: 'Hive name / number', t: 'text', req: true, ph: 'e.g. H1 or "Bluebell"' },
    { k: 'apiaryId', l: 'Apiary', t: 'select', req: true, o: () => state.apiaries.map(a => [a.id, a.name]) },
    { k: 'type', l: 'Hive type', t: 'chips', o: HIVE_TYPES },
    { k: 'broodConfig', l: 'Brood arrangement', t: 'chips', o: [['single', 'Single brood'], ['brood-half', 'Brood & a half'], ['double', 'Double brood']] },
    { k: 'floor', l: 'Floor', t: 'chips', o: [['mesh', 'Open mesh'], ['solid', 'Solid']] },
    { k: 'status', l: 'Status', t: 'chips', o: [['active', 'Active'], ['dead', 'Dead out'], ['united', 'United'], ['sold', 'Sold / given away'], ['archived', 'Archived']] },
    { k: 'established', l: 'Colony established', t: 'date' },
    { k: 'origin', l: 'Colony origin', t: 'chips', o: [['nuc', 'Bought nuc'], ['package', 'Package'], ['swarm', 'Caught swarm'], ['split', 'Split / nuc made'], ['as', 'Artificial swarm'], ['other', 'Other']] },
  ] },
  { title: 'Queen', fields: [
    { k: 'queenYear', l: 'Year queen emerged', t: 'num', min: 2000, max: 2100, start: new Date().getFullYear(), hint: 'Sets the marking colour automatically.' },
    { k: 'queenMarked', l: 'Marked', t: 'chips', o: YN },
    { k: 'queenClipped', l: 'Clipped', t: 'chips', o: YN },
    { k: 'queenSource', l: 'Queen source', t: 'chips', o: [['own', 'Own rearing'], ['bought', 'Bought'], ['swarm', 'Swarm'], ['supersedure', 'Supersedure'], ['emergency', 'Emergency'], ['unknown', 'Unknown']] },
    { k: 'queenStrain', l: 'Strain / breeder', t: 'text', ph: 'e.g. Buckfast, local mongrel, supplier' },
  ] },
  { title: 'Notes', fields: [
    { k: 'notes', l: 'Notes', t: 'textarea' },
  ] },
];

const APIARY_SECTIONS = [
  { title: 'Apiary', fields: [
    { k: 'name', l: 'Name', t: 'text', req: true, ph: 'e.g. Home, Allotment, Farm' },
    { k: 'location', l: 'Location', t: 'text', ph: 'Postcode, grid ref or what3words' },
    { k: 'notes', l: 'Notes', t: 'textarea', ph: 'Access, landowner contact, forage…' },
  ] },
];

const INSPECTION = [
  { title: 'Queen & brood', fields: [
    { k: 'queenSeen', l: 'Queen seen', t: 'chips', o: YN },
    { k: 'eggs', l: 'Eggs seen', t: 'chips', o: YN },
    { k: 'larvae', l: 'Open larvae', t: 'chips', o: YN },
    { k: 'capped', l: 'Capped brood', t: 'chips', o: YN },
    { k: 'broodPattern', l: 'Brood pattern', t: 'chips', o: [['good', 'Solid'], ['patchy', 'Patchy'], ['poor', 'Poor / pepper-pot'], ['none', 'No brood']] },
    { k: 'droneBrood', l: 'Drone brood', t: 'chips', o: [['none', 'None'], ['some', 'Some'], ['lots', 'Lots']] },
    { k: 'queenCells', l: 'Queen cells', t: 'chips', o: [['none', 'None'], ['cups', 'Empty cups'], ['charged', 'Charged (egg / larva)'], ['capped', 'Capped'], ['emerged', 'Emerged / torn down']] },
    { k: 'qcCount', l: 'Number of queen cells', t: 'num', min: 0, max: 99 },
    { k: 'qcPosition', l: 'Queen cell position', t: 'chips', o: [['swarm', 'Bottom edge (swarm)'], ['supersedure', 'Comb face (supersedure)'], ['emergency', 'Emergency']] },
  ] },
  { title: 'Colony', fields: [
    { k: 'framesBees', l: 'Frames covered with bees', t: 'num', min: 0, max: 40 },
    { k: 'framesBrood', l: 'Frames with brood', t: 'num', min: 0, max: 40 },
    { k: 'temper', l: 'Temper', t: 'chips', o: [['1', '1 Calm'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5 Aggressive']] },
    { k: 'onComb', l: 'On the comb', t: 'chips', o: [['steady', 'Steady'], ['runny', 'Runny'], ['followers', 'Followers']] },
    { k: 'stores', l: 'Honey stores', t: 'chips', o: LEVEL },
    { k: 'pollen', l: 'Pollen', t: 'chips', o: LEVEL },
    { k: 'space', l: 'Space', t: 'chips', o: [['ok', 'Plenty'], ['tight', 'Getting tight'], ['congested', 'Congested']] },
    { k: 'supers', l: 'Supers on', t: 'num', min: 0, max: 10 },
    { k: 'weight', l: 'Hefted weight', t: 'chips', o: [['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']] },
  ] },
  { title: 'Health', fields: [
    { k: 'varroaMethod', l: 'Varroa check', t: 'chips', o: [['drop', 'Tray drop'], ['sugar', 'Sugar roll'], ['alcohol', 'Alcohol wash'], ['drone', 'Drone uncapping']] },
    { k: 'varroaCount', l: 'Mites counted', t: 'num', min: 0, max: 9999, hint: 'Sugar roll / wash assumes about 300 bees (½ cup).' },
    { k: 'varroaDays', l: 'Days tray was in (tray drop)', t: 'num', min: 1, max: 60, start: 7 },
    { k: 'health', l: 'Signs seen', t: 'multi', o: [
      ['dwv', 'Deformed wings'], ['chalkbrood', 'Chalkbrood'], ['sacbrood', 'Sacbrood'], ['dysentery', 'Dysentery / nosema'],
      ['waxmoth', 'Wax moth'], ['wasps', 'Wasps / robbing'], ['dronelayer', 'Drone layer / laying workers'],
      ['afb', 'Suspected AFB'], ['efb', 'Suspected EFB'], ['shb', 'Suspected small hive beetle'], ['vespa', 'Asian hornet'],
    ] },
  ] },
  { title: 'Actions taken', fields: [
    { k: 'actions', l: '', csv: 'Actions taken', t: 'multi', o: [
      ['superAdded', 'Super added'], ['superRemoved', 'Super removed'], ['broodAdded', 'Brood box added'],
      ['foundation', 'Frames / foundation added'], ['qcRemoved', 'Queen cells removed'], ['artificialSwarm', 'Artificial swarm'],
      ['split', 'Split / nuc made'], ['united', 'United'], ['requeened', 'Re-queened'], ['queenMarked', 'Queen marked'],
      ['queenClipped', 'Queen clipped'], ['fed', 'Fed'], ['treated', 'Treated'], ['clearer', 'Clearer board on'],
      ['mouseguard', 'Mouse guard on'], ['entrance', 'Entrance reduced'],
    ] },
  ] },
  { title: 'Conditions & notes', fields: [
    { k: 'tempC', l: 'Temperature °C', t: 'num', min: -20, max: 45, start: 16 },
    { k: 'weather', l: 'Weather', t: 'chips', o: [['sunny', 'Sunny'], ['cloudy', 'Cloudy'], ['overcast', 'Overcast'], ['showers', 'Showers'], ['windy', 'Windy']] },
    { k: 'notes', l: 'Notes', t: 'textarea' },
    { k: 'nextDue', l: 'Next inspection due', t: 'date' },
  ] },
];

const TREATMENT = [
  { title: 'Medicine (VMD record)', fields: [
    { k: 'product', l: 'Product', t: 'select', o: TREATMENTS.map(t => [t[0], t[1]]), req: true },
    { k: 'productOther', l: 'Product name (if other)', t: 'text' },
    { k: 'batch', l: 'Batch number', t: 'text' },
    { k: 'expiry', l: 'Expiry date', t: 'date' },
    { k: 'dose', l: 'Quantity / dose', t: 'text', ph: 'e.g. 1 tray, 2 strips, 5 ml per seam' },
    { k: 'supplier', l: 'Supplier', t: 'text' },
    { k: 'endDate', l: 'Finish / removal date', t: 'date', hint: 'Suggested from the product — always follow the label.' },
    { k: 'withdrawal', l: 'Honey withdrawal / supers off until', t: 'text' },
    { k: 'done', l: 'Treatment finished / removed', t: 'toggle' },
  ] },
  { title: 'Notes', fields: [
    { k: 'notes', l: 'Notes', t: 'textarea' },
  ] },
];

const FEED = [
  { title: 'Feed', fields: [
    { k: 'feedType', l: 'Feed', t: 'chips', o: [['syrup1', '1:1 syrup (light)'], ['syrup2', '2:1 syrup (heavy)'], ['invert', 'Invert syrup'], ['fondant', 'Fondant'], ['pollen', 'Pollen substitute']] },
    { k: 'amount', l: 'Amount', t: 'num', min: 0, max: 100, stepSize: 0.5 },
    { k: 'unit', l: 'Unit', t: 'chips', o: [['l', 'litres'], ['kg', 'kg']] },
    { k: 'notes', l: 'Notes', t: 'textarea' },
  ] },
];

const HARVEST = [
  { title: 'Harvest', fields: [
    { k: 'supersTaken', l: 'Supers / frames taken', t: 'text', ph: 'e.g. 2 supers' },
    { k: 'weightKg', l: 'Honey weight (kg)', t: 'num', min: 0, max: 500, stepSize: 0.5 },
    { k: 'honeyType', l: 'Honey', t: 'chips', o: [['spring', 'Spring / OSR'], ['summer', 'Summer'], ['heather', 'Heather'], ['ivy', 'Ivy'], ['other', 'Other']] },
    { k: 'notes', l: 'Notes', t: 'textarea' },
  ] },
];

const NOTE = [
  { title: 'Note', fields: [{ k: 'notes', l: 'Note', t: 'textarea', req: true }] },
];

const KINDS = {
  inspection: { label: 'Inspection', icon: '🔍', sections: INSPECTION },
  treatment: { label: 'Treatment', icon: '💊', sections: TREATMENT },
  feed: { label: 'Feed', icon: '🍯', sections: FEED },
  harvest: { label: 'Harvest', icon: '🫙', sections: HARVEST },
  note: { label: 'Note', icon: '📝', sections: NOTE },
};

const fieldIndex = sections => Object.fromEntries(sections.flatMap(s => s.fields).map(f => [f.k, f]));
const FIELDS = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, fieldIndex(v.sections)]));
const HIVE_FIELDS = fieldIndex(HIVE_SECTIONS);

/* ---------- Small utilities ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const nowIso = () => new Date().toISOString();
const pad = n => String(n).padStart(2, '0');
const toYmd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toYmd(new Date());
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (ymd, n) => { const d = parseYmd(ymd); d.setDate(d.getDate() + n); return toYmd(d); };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const fmtDate = (ymd, opts) => ymd ? parseYmd(ymd).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtShort = ymd => fmtDate(ymd, { day: 'numeric', month: 'short' });
const isEmpty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

function optLabel(field, v) {
  if (!field || isEmpty(v)) return '';
  const opts = typeof field.o === 'function' ? field.o() : field.o;
  if (!opts) return String(v);
  const list = Array.isArray(v) ? v : [v];
  return list.map(x => (opts.find(o => o[0] === x) || [x, x])[1]).join(', ');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Storage ---------- */

const DB_NAME = 'hivelog';
const STORE = 'kv';
const KEY = 'state';
let dbHandle = null;

function blankState() {
  return {
    version: 1,
    apiaries: [],
    hives: [],
    logs: [],
    deleted: {},
    settings: { seasonInterval: 7, offInterval: 14, theme: 'auto' },
    meta: { lastBackup: null, created: nowIso() },
  };
}

let state = blankState();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadState() {
  let saved = null;
  try {
    dbHandle = await openDb();
    saved = await new Promise((resolve, reject) => {
      const r = dbHandle.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch (e) {
    console.warn('IndexedDB unavailable, using localStorage', e);
    try { saved = JSON.parse(localStorage.getItem(DB_NAME) || 'null'); } catch (_) { saved = null; }
  }
  if (saved) {
    const base = blankState();
    state = { ...base, ...saved, settings: { ...base.settings, ...saved.settings }, meta: { ...base.meta, ...saved.meta } };
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeState, 50);
}

async function writeState() {
  const snapshot = JSON.parse(JSON.stringify(state));
  try {
    if (!dbHandle) throw new Error('no db');
    await new Promise((resolve, reject) => {
      const tx = dbHandle.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(snapshot, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    try { localStorage.setItem(DB_NAME, JSON.stringify(snapshot)); } catch (err) { toast('⚠️ Could not save — storage full?'); }
  }
  if (navigator.storage && navigator.storage.persist && !writeState.asked) {
    writeState.asked = true;
    navigator.storage.persist().catch(() => {});
  }
}

function upsert(coll, rec) {
  rec.updatedAt = nowIso();
  if (!rec.createdAt) rec.createdAt = rec.updatedAt;
  const arr = state[coll];
  const i = arr.findIndex(x => x.id === rec.id);
  if (i >= 0) arr[i] = rec; else arr.push(rec);
  save();
}

function removeRec(coll, id) {
  state[coll] = state[coll].filter(x => x.id !== id);
  state.deleted[id] = nowIso();
  save();
}

/* ---------- Domain helpers ---------- */

const apiaryById = id => state.apiaries.find(a => a.id === id);
const hiveById = id => state.hives.find(h => h.id === id);
const logById = id => state.logs.find(l => l.id === id);
const hiveType = h => HIVE_TYPES.find(t => t[0] === h.type);
const queenColour = year => (year ? QUEEN_COLOURS[Number(year) % 5] : null);
const isActive = h => !h.status || h.status === 'active';

function sortLogs(a, b) {
  return b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '');
}

function logsFor(hiveId, kind) {
  return state.logs.filter(l => l.hiveId === hiveId && (!kind || l.kind === kind)).sort(sortLogs);
}

const lastInspection = hiveId => logsFor(hiveId, 'inspection')[0];

function hiveLabel(h) {
  const a = apiaryById(h.apiaryId);
  return a ? `${h.name} (${a.name})` : h.name;
}

function intervalFor(ymd) {
  const m = Number(ymd.slice(5, 7));
  if (m >= 4 && m <= 7) return Number(state.settings.seasonInterval) || 7;
  if (m >= 11 || m <= 2) return null; // winter: don't nag
  return Number(state.settings.offInterval) || 14;
}

function nextInspectionDate(h) {
  const li = lastInspection(h.id);
  if (!li) return null;
  if (li.nextDue) return li.nextDue;
  const iv = intervalFor(li.date);
  return iv ? addDays(li.date, iv) : null;
}

function defaultNextDue(ymd) {
  return addDays(ymd, intervalFor(ymd) || 21);
}

function varroaResult(l) {
  if (!l.varroaMethod || isEmpty(l.varroaCount)) return null;
  const n = Number(l.varroaCount);
  if (l.varroaMethod === 'sugar' || l.varroaMethod === 'alcohol') {
    const pct = n / 3;
    const level = pct >= 3 ? 'red' : pct >= 2 ? 'amber' : 'green';
    return { text: `${pct.toFixed(1)}%`, level, value: pct, unit: '%' };
  }
  if (l.varroaMethod === 'drop') {
    const days = Number(l.varroaDays) || 1;
    const perDay = n / days;
    return { text: `${perDay.toFixed(1)} mites/day`, level: 'info', value: perDay, unit: '/day' };
  }
  return { text: `${n} mites (drone uncapping)`, level: 'info', value: n, unit: '' };
}

function treatmentName(l) {
  if (l.product === 'other' && l.productOther) return l.productOther;
  return optLabel(FIELDS.treatment.product, l.product) || 'Treatment';
}

function activeTreatments(hiveId) {
  return logsFor(hiveId, 'treatment').filter(l => !l.done);
}

function hiveFlags(h) {
  const flags = [];
  if (!isActive(h)) return [{ level: 'info', text: optLabel(HIVE_FIELDS.status, h.status) }];
  const t = today();
  const li = lastInspection(h.id);
  if (!li) {
    flags.push({ level: 'info', text: 'No inspections yet' });
  } else {
    const next = nextInspectionDate(h);
    if (next) {
      const d = daysBetween(t, next);
      if (d < 0) flags.push({ level: 'red', text: `Inspection overdue ${-d}d` });
      else if (d === 0) flags.push({ level: 'amber', text: 'Inspection due today' });
      else if (d <= 2) flags.push({ level: 'info', text: `Due ${fmtShort(next)}` });
    }
    if (li.queenCells === 'charged' || li.queenCells === 'capped') {
      flags.push({ level: 'red', text: `Queen cells ${li.queenCells}${li.qcCount ? ` (${li.qcCount})` : ''}` });
    } else if (li.queenCells === 'emerged') {
      flags.push({ level: 'amber', text: 'Queen emerged — check for eggs' });
    }
    if (li.eggs === 'no' && li.queenSeen !== 'yes') flags.push({ level: 'amber', text: 'No eggs seen — check queen' });
    const health = li.health || [];
    if (health.some(x => ['afb', 'efb', 'shb'].includes(x))) flags.push({ level: 'red', text: 'Suspected notifiable disease' });
    if (health.includes('vespa')) flags.push({ level: 'red', text: 'Asian hornet' });
    if (health.includes('dronelayer')) flags.push({ level: 'red', text: 'Drone layer' });
    const v = varroaResult(li);
    if (v && (v.level === 'red' || v.level === 'amber')) flags.push({ level: v.level, text: `Varroa ${v.text}` });
    if (li.space === 'congested') flags.push({ level: 'amber', text: 'Needs space' });
    if (li.stores === 'low') flags.push({ level: 'amber', text: 'Stores low' });
  }
  for (const tr of activeTreatments(h.id)) {
    if (tr.endDate && tr.endDate <= t) flags.push({ level: 'red', text: `Finish ${treatmentName(tr)}` });
    else flags.push({ level: 'info', text: `💊 ${treatmentName(tr)}${tr.endDate ? ' → ' + fmtShort(tr.endDate) : ''}` });
  }
  return flags;
}

function summarise(l) {
  const F = FIELDS[l.kind] || {};
  const bits = [];
  if (l.kind === 'inspection') {
    if (l.queenSeen === 'yes') bits.push('Queen ✓');
    if (l.eggs === 'yes') bits.push('Eggs ✓');
    if (l.eggs === 'no') bits.push('No eggs');
    if (!isEmpty(l.framesBees) || !isEmpty(l.framesBrood)) {
      bits.push([!isEmpty(l.framesBees) && `${l.framesBees} fr bees`, !isEmpty(l.framesBrood) && `${l.framesBrood} fr brood`].filter(Boolean).join(' / '));
    }
    if (l.queenCells && l.queenCells !== 'none') bits.push(`QC: ${optLabel(F.queenCells, l.queenCells)}${l.qcCount ? ` ×${l.qcCount}` : ''}`);
    if (l.temper) bits.push(`Temper ${l.temper}`);
    if (!isEmpty(l.supers)) bits.push(`${l.supers} super${l.supers == 1 ? '' : 's'}`);
    const v = varroaResult(l);
    if (v) bits.push(`Varroa ${v.text}`);
    if (!isEmpty(l.health)) bits.push(optLabel(F.health, l.health));
    if (!isEmpty(l.actions)) bits.push(optLabel(F.actions, l.actions));
  } else if (l.kind === 'treatment') {
    bits.push(treatmentName(l));
    if (l.dose) bits.push(l.dose);
    if (l.endDate) bits.push(`${l.done ? 'finished' : 'until'} ${fmtShort(l.endDate)}`);
    if (!l.done) bits.push('ACTIVE');
  } else if (l.kind === 'feed') {
    bits.push(optLabel(F.feedType, l.feedType));
    if (!isEmpty(l.amount)) bits.push(`${l.amount} ${optLabel(F.unit, l.unit || 'l')}`);
  } else if (l.kind === 'harvest') {
    if (l.supersTaken) bits.push(l.supersTaken);
    if (!isEmpty(l.weightKg)) bits.push(`${l.weightKg} kg`);
    if (l.honeyType) bits.push(optLabel(F.honeyType, l.honeyType));
  }
  if (l.notes) bits.push(l.notes.length > 90 ? l.notes.slice(0, 90) + '…' : l.notes);
  return bits.filter(Boolean).join(' · ');
}

/* ---------- Form rendering ---------- */

function renderField(f, value) {
  const id = `f-${f.k}`;
  const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '';
  const label = f.l ? `<label for="${id}">${esc(f.l)}</label>` : '';
  switch (f.t) {
    case 'chips':
    case 'multi': {
      const opts = typeof f.o === 'function' ? f.o() : f.o;
      const multi = f.t === 'multi';
      const selected = multi ? (value || []) : [value];
      const warnSet = f.k === 'health' ? NOTIFIABLE : [];
      const chips = opts.map(([v, l]) =>
        `<button type="button" class="chip${warnSet.includes(v) ? ' warn' : ''}" data-v="${esc(v)}" aria-pressed="${selected.includes(v)}">${esc(l)}</button>`).join('');
      const hidden = multi ? (value || []).join(',') : (value ?? '');
      return `<div class="field">${f.l ? `<span class="label" id="${id}-l">${esc(f.l)}</span>` : ''}
        <div class="chips" role="group" ${f.l ? `aria-labelledby="${id}-l"` : ''} data-chips="${f.k}" data-multi="${multi ? 1 : 0}">${chips}</div>
        <input type="hidden" name="${f.k}" value="${esc(hidden)}">${hint}</div>`;
    }
    case 'num':
      return `<div class="field">${label}<div class="stepper">
        <button type="button" class="btn" data-step="-1" data-target="${f.k}" aria-label="Decrease">−</button>
        <input id="${id}" type="number" inputmode="decimal" name="${f.k}" value="${esc(value ?? '')}"
          ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} step="${f.stepSize || 'any'}" data-stepsize="${f.stepSize || 1}" ${f.start !== undefined ? `data-start="${f.start}"` : ''}>
        <button type="button" class="btn" data-step="1" data-target="${f.k}" aria-label="Increase">+</button>
      </div>${hint}</div>`;
    case 'date':
      return `<div class="field">${label}<input id="${id}" type="date" name="${f.k}" value="${esc(value ?? '')}" ${f.req ? 'required' : ''}>${hint}</div>`;
    case 'textarea':
      return `<div class="field">${label}<textarea id="${id}" name="${f.k}" placeholder="${esc(f.ph || '')}" ${f.req ? 'required' : ''}>${esc(value ?? '')}</textarea>${hint}</div>`;
    case 'select': {
      const opts = typeof f.o === 'function' ? f.o() : f.o;
      return `<div class="field">${label}<select id="${id}" name="${f.k}" ${f.req ? 'required' : ''}>
        ${f.req ? '' : '<option value="">—</option>'}
        ${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>${hint}</div>`;
    }
    case 'toggle':
      return `<div class="field"><label class="toggle"><input type="checkbox" name="${f.k}" ${value ? 'checked' : ''}> ${esc(f.l)}</label>${hint}</div>`;
    default:
      return `<div class="field">${label}<input id="${id}" type="text" name="${f.k}" value="${esc(value ?? '')}" placeholder="${esc(f.ph || '')}" ${f.req ? 'required' : ''} autocomplete="off">${hint}</div>`;
  }
}

function renderSections(sections, rec) {
  return sections.map(s => `<fieldset class="section"><legend>${esc(s.title)}</legend>
    ${s.fields.map(f => renderField(f, rec[f.k])).join('')}</fieldset>`).join('');
}

function readForm(form, fields) {
  const fd = new FormData(form);
  const out = {};
  for (const f of Object.values(fields)) {
    const raw = fd.get(f.k);
    if (f.t === 'toggle') out[f.k] = raw === 'on';
    else if (f.t === 'multi') out[f.k] = raw ? String(raw).split(',').filter(Boolean) : [];
    else if (f.t === 'num') out[f.k] = raw === '' || raw === null ? '' : Number(raw);
    else out[f.k] = raw === null ? '' : String(raw).trim();
  }
  return out;
}

/* ---------- Views ---------- */

const main = () => $('#main');

function setView(html, tab) {
  main().innerHTML = html;
  $$('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  window.scrollTo(0, 0);
}

function flagHtml(flags) {
  if (!flags.length) return '<div class="flags"><span class="flag green">All good</span></div>';
  return `<div class="flags">${flags.map(f => `<span class="flag ${f.level}">${esc(f.text)}</span>`).join('')}</div>`;
}

function hiveCard(h) {
  const li = lastInspection(h.id);
  const col = queenColour(h.queenYear);
  const type = hiveType(h);
  const since = li ? daysBetween(li.date, today()) : null;
  return `<a class="card" href="#/hive/${h.id}">
    <div class="row between">
      <div class="row grow">
        ${col ? `<span class="qdot ${col}" title="${h.queenYear} queen (${col})"></span>` : ''}
        <span class="hive-name">${esc(h.name)}</span>
        <span class="muted small">${esc(type ? type[1] : '')}</span>
      </div>
      <span class="muted small">${li ? (since === 0 ? 'Today' : `${since}d ago`) : ''}</span>
    </div>
    ${li ? `<div class="small muted" style="margin-top:.35rem">${esc(summarise(li))}</div>` : ''}
    ${flagHtml(hiveFlags(h))}
  </a>`;
}

function viewHives() {
  if (!state.apiaries.length) {
    return setView(`<div class="empty">
      <div class="big">🐝</div>
      <h1>Welcome to Hive Log</h1>
      <p class="muted">Track your apiaries, hives, inspections, treatments and feeding — offline, on your phone, for free.</p>
      <p>Start by adding your first apiary (where your hives live).</p>
      <a class="btn primary" href="#/apiary/new">Add an apiary</a>
      <p class="small muted" style="margin-top:2rem">Moving from another device? <a href="#/settings">Restore a backup</a>.</p>
    </div>`, 'hives');
  }
  let html = '';
  const lb = state.meta.lastBackup;
  if (state.logs.length >= 5 && (!lb || daysBetween(lb.slice(0, 10), today()) > 30)) {
    html += `<div class="notice amber row between wrap"><span>Your records live only on this device. ${lb ? `Last backup ${fmtDate(lb.slice(0, 10))}.` : 'No backup yet.'}</span>
      <button class="btn small" data-action="export-json">Back up now</button></div>`;
  }
  for (const a of state.apiaries) {
    const hives = state.hives.filter(h => h.apiaryId === a.id);
    const active = hives.filter(isActive).sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
    const inactive = hives.filter(h => !isActive(h));
    html += `<div class="apiary-head"><h2>${esc(a.name)}</h2>
      <a class="small" href="#/apiary/${a.id}">Edit</a></div>`;
    html += active.length ? active.map(hiveCard).join('') : '<p class="muted small">No active hives here yet.</p>';
    if (inactive.length) {
      html += `<details class="small"><summary class="muted">${inactive.length} inactive hive${inactive.length > 1 ? 's' : ''}</summary>
        <div style="margin-top:.5rem">${inactive.map(hiveCard).join('')}</div></details>`;
    }
    html += `<a class="btn block" href="#/hive/new?apiary=${a.id}">+ Add hive to ${esc(a.name)}</a>`;
  }
  setView(html, 'hives');
}

function strengthChart(hiveId) {
  const pts = logsFor(hiveId, 'inspection').filter(l => !isEmpty(l.framesBees) || !isEmpty(l.framesBrood)).reverse().slice(-20);
  if (pts.length < 2) return '';
  const W = 360, H = 170, L = 26, R = 58, T = 10, B = 22;
  const t0 = parseYmd(pts[0].date).getTime();
  const t1 = Math.max(parseYmd(pts[pts.length - 1].date).getTime(), t0 + 86400000);
  const maxV = Math.max(5, ...pts.map(p => Math.max(Number(p.framesBees) || 0, Number(p.framesBrood) || 0)));
  const yMax = Math.ceil(maxV / 5) * 5;
  const x = d => L + (parseYmd(d).getTime() - t0) / (t1 - t0) * (W - L - R);
  const y = v => T + (1 - v / yMax) * (H - T - B);
  const ticks = [0, yMax / 2, yMax];
  const series = [['framesBees', 's1', 'd1', 'Bees'], ['framesBrood', 's2', 'd2', 'Brood']].map(([k, s, d, name]) => {
    const p = pts.filter(q => !isEmpty(q[k]));
    if (!p.length) return '';
    const line = p.map(q => `${x(q.date).toFixed(1)},${y(q[k]).toFixed(1)}`).join(' ');
    const last = p[p.length - 1];
    return `<polyline class="${s}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${line}"/>
      ${p.map(q => `<circle class="${d}" cx="${x(q.date).toFixed(1)}" cy="${y(q[k]).toFixed(1)}" r="4"><title>${fmtDate(q.date)}: ${q[k]} frames of ${name.toLowerCase()}</title></circle>`).join('')}
      <text class="lbl" x="${(x(last.date) + 8).toFixed(1)}" y="${(y(last[k]) + 4).toFixed(1)}">${name} ${last[k]}</text>`;
  }).join('');
  return `<h2>Colony strength</h2><div class="card">
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Frames of bees and brood over time">
      ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      <text class="axis" x="${L}" y="${H - 6}">${fmtShort(pts[0].date)}</text>
      <text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtShort(pts[pts.length - 1].date)}</text>
      ${series}
    </svg>
    <div class="legend"><span><i style="background:var(--series-1)"></i>Frames of bees</span><span><i style="background:var(--series-2)"></i>Frames of brood</span></div>
  </div>`;
}

function varroaTable(hiveId) {
  const rows = logsFor(hiveId, 'inspection').filter(l => varroaResult(l)).slice(0, 12);
  if (!rows.length) return '';
  return `<h2>Varroa checks</h2><div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Method</th><th>Count</th><th>Result</th></tr></thead>
    <tbody>${rows.map(l => {
      const v = varroaResult(l);
      return `<tr><td>${fmtDate(l.date)}</td><td>${esc(optLabel(FIELDS.inspection.varroaMethod, l.varroaMethod))}</td>
        <td>${esc(l.varroaCount)}${l.varroaMethod === 'drop' && l.varroaDays ? ` / ${esc(l.varroaDays)}d` : ''}</td>
        <td><span class="flag ${v.level}">${esc(v.text)}</span></td></tr>`;
    }).join('')}</tbody></table></div>
    <p class="small muted">Washes and sugar rolls assume ~300 bees. Over 2% is worth watching; 3%+ usually means treat. Always follow current NBU guidance.</p>`;
}

function viewHive(id) {
  const h = hiveById(id);
  if (!h) return viewNotFound();
  const a = apiaryById(h.apiaryId);
  const type = hiveType(h);
  const col = queenColour(h.queenYear);
  const logs = logsFor(h.id);
  const next = nextInspectionDate(h);
  const harvestKg = logsFor(h.id, 'harvest').reduce((s, l) => s + (Number(l.weightKg) || 0), 0);
  const kv = [
    ['Apiary', a ? a.name : '—'],
    ['Type', [type && type[1], optLabel(HIVE_FIELDS.broodConfig, h.broodConfig), optLabel(HIVE_FIELDS.floor, h.floor) && optLabel(HIVE_FIELDS.floor, h.floor) + ' floor'].filter(Boolean).join(' · ') || '—'],
    ['Queen', h.queenYear ? `<span class="qdot ${col}"></span> ${esc(h.queenYear)} · ${[h.queenMarked === 'yes' ? 'marked' : h.queenMarked === 'no' ? 'unmarked' : '', h.queenClipped === 'yes' ? 'clipped' : '', optLabel(HIVE_FIELDS.queenSource, h.queenSource), h.queenStrain].filter(Boolean).map(esc).join(', ')}` : '—', true],
    ['Established', h.established ? `${fmtDate(h.established)}${h.origin ? ' · ' + optLabel(HIVE_FIELDS.origin, h.origin) : ''}` : '—'],
    ['Next inspection', next ? fmtDate(next) : '—'],
  ];
  if (harvestKg) kv.push(['Honey harvested', `${harvestKg.toFixed(1)} kg`]);
  const html = `
    <div class="row between"><h1>${esc(h.name)}</h1><a class="btn small" href="#/hive/${h.id}/edit">Edit hive</a></div>
    ${flagHtml(hiveFlags(h))}
    <div class="btn-grid">
      <a class="btn primary" href="#/log/new/inspection?hive=${h.id}">🔍 Inspect</a>
      <a class="btn" href="#/log/new/treatment?hive=${h.id}">💊 Treatment</a>
      <a class="btn" href="#/log/new/feed?hive=${h.id}">🍯 Feed</a>
      <a class="btn" href="#/log/new/harvest?hive=${h.id}">🫙 Harvest</a>
      <a class="btn" href="#/log/new/note?hive=${h.id}">📝 Note</a>
    </div>
    <div class="card"><dl class="kv">${kv.map(([k, v, raw]) => `<dt>${k}</dt><dd>${raw ? v : esc(v)}</dd>`).join('')}</dl>
      ${h.notes ? `<p class="small" style="margin:.75rem 0 0;white-space:pre-wrap">${esc(h.notes)}</p>` : ''}</div>
    ${strengthChart(h.id)}
    ${varroaTable(h.id)}
    <h2>History</h2>
    ${logs.length ? `<div class="card"><ul class="timeline">${logs.map(l => `<li><a href="#/log/${l.id}">
      <span class="ico" aria-hidden="true">${KINDS[l.kind].icon}</span>
      <span><span class="when">${fmtDate(l.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <span class="what"> · ${KINDS[l.kind].label}</span>
      <div class="detail">${esc(summarise(l)) || '<span class="muted">No details</span>'}</div></span></a></li>`).join('')}</ul></div>`
      : '<p class="muted">Nothing recorded yet. Tap <b>Inspect</b> after your next visit.</p>'}
  `;
  setView(html, 'hives');
}

function viewHiveForm(id, q) {
  const existing = id ? hiveById(id) : null;
  if (id && !existing) return viewNotFound();
  if (!state.apiaries.length) { location.hash = '#/apiary/new'; return; }
  const rec = existing ? { ...existing } : {
    apiaryId: q.get('apiary') || state.apiaries[0].id,
    type: 'national', broodConfig: 'single', status: 'active', floor: 'mesh',
    name: suggestHiveName(),
  };
  setView(`<h1>${existing ? 'Edit hive' : 'New hive'}</h1>
    <form data-form="hive" data-id="${existing ? existing.id : ''}" novalidate>
      ${renderSections(HIVE_SECTIONS, rec)}
      <div class="actions-bar"><a class="btn" href="${existing ? `#/hive/${existing.id}` : '#/'}">Cancel</a><button class="btn primary" type="submit">Save hive</button></div>
      ${existing ? `<p class="small muted">Tip: rather than deleting a hive that died or was united, set its status so its history is kept.</p>
        <button type="button" class="btn danger block" data-action="delete-hive" data-id="${existing.id}">Delete hive and all its records</button>` : ''}
    </form>`, 'hives');
}

function suggestHiveName() {
  const nums = state.hives.map(h => (/^H(\d+)$/i.exec(h.name) || [])[1]).filter(Boolean).map(Number);
  return `H${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

function viewApiaryForm(id) {
  const existing = id ? apiaryById(id) : null;
  if (id && !existing) return viewNotFound();
  const rec = existing ? { ...existing } : {};
  const map = existing && existing.location ? `<p><a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(existing.location)}">Open in Maps</a></p>` : '';
  setView(`<h1>${existing ? 'Edit apiary' : 'New apiary'}</h1>
    <form data-form="apiary" data-id="${existing ? existing.id : ''}" novalidate>
      ${renderSections(APIARY_SECTIONS, rec)}
      ${map}
      <div class="actions-bar"><a class="btn" href="#/">Cancel</a><button class="btn primary" type="submit">Save apiary</button></div>
      ${existing ? `<button type="button" class="btn danger block" data-action="delete-apiary" data-id="${existing.id}">Delete apiary</button>` : ''}
    </form>`, 'hives');
}

const draftKey = (kind, hiveId) => `hivelog:draft:${kind}:${hiveId}`;

function viewLogForm(kind, id, q) {
  const existing = id ? logById(id) : null;
  if (id && !existing) return viewNotFound();
  kind = existing ? existing.kind : kind;
  const def = KINDS[kind];
  if (!def) return viewNotFound();
  const hiveId = existing ? existing.hiveId : q.get('hive');
  const hive = hiveById(hiveId);
  if (!hive) return viewNotFound();

  let rec;
  let draftNote = '';
  if (existing) {
    rec = { ...existing };
  } else {
    const d = today();
    rec = { date: d };
    if (kind === 'inspection') {
      const li = lastInspection(hive.id);
      if (li && !isEmpty(li.supers)) rec.supers = li.supers;
      rec.nextDue = defaultNextDue(d);
    }
    if (kind === 'feed') rec.unit = 'l';
    if (kind === 'treatment') {
      const prev = logsFor(hive.id, 'treatment')[0];
      if (prev) Object.assign(rec, { product: prev.product, productOther: prev.productOther, supplier: prev.supplier, batch: prev.batch, expiry: prev.expiry, dose: prev.dose });
      else rec.product = TREATMENTS[0][0];
      const days = (TREATMENTS.find(t => t[0] === rec.product) || [])[2] || 0;
      rec.endDate = addDays(d, days);
      rec.done = days === 0;
    }
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey(kind, hive.id)) || 'null');
      if (draft) {
        rec = { ...rec, ...draft };
        draftNote = `<div class="notice info row between wrap"><span>Unsaved draft restored.</span><button type="button" class="btn small" data-action="discard-draft">Discard draft</button></div>`;
      }
    } catch (_) { /* ignore */ }
  }

  const li = kind === 'inspection' && !existing ? lastInspection(hive.id) : null;
  const hiveOpts = state.hives.filter(h => isActive(h) || h.id === hive.id).map(h => [h.id, hiveLabel(h)]);
  const health = rec.health || [];
  const notifiableHtml = `<div id="notifiable" class="notice red" ${health.some(x => NOTIFIABLE.includes(x)) ? '' : 'hidden'}>
    <b>Notifiable in the UK.</b> AFB, EFB, small hive beetle and Tropilaelaps must be reported — don't move bees, frames or kit; contact the National Bee Unit or your Seasonal Bee Inspector.
    Report Asian hornet sightings with the <i>Asian Hornet Watch</i> app.
  </div>`;
  setView(`<h1>${def.icon} ${existing ? 'Edit' : 'New'} ${def.label.toLowerCase()}</h1>
    <p class="muted" style="margin-top:-.25rem">${esc(hiveLabel(hive))}</p>
    ${draftNote}
    ${li ? `<div class="notice info small"><b>Last inspection ${fmtDate(li.date)}:</b> ${esc(summarise(li))}</div>` : ''}
    <form data-form="log" data-kind="${kind}" data-id="${existing ? existing.id : ''}" data-hive="${hive.id}" ${existing ? '' : 'data-new="1"'} novalidate>
      <fieldset class="section"><legend>When &amp; where</legend>
        ${renderField({ k: 'date', l: 'Date', t: 'date', req: true }, rec.date)}
        ${renderField({ k: 'hiveId', l: 'Hive', t: 'select', o: hiveOpts, req: true }, hive.id)}
      </fieldset>
      ${def.sections.map(sec => renderSections([sec], rec) + (sec.title === 'Health' ? notifiableHtml : '')).join('')}
      <div class="actions-bar"><a class="btn" href="#/hive/${hive.id}">Cancel</a><button class="btn primary" type="submit">Save</button></div>
      ${existing ? `<button type="button" class="btn danger block" data-action="delete-log" data-id="${existing.id}">Delete this record</button>` : ''}
    </form>`, 'hives');
}

function dueItems() {
  const items = [];
  const t = today();
  for (const h of state.hives.filter(isActive)) {
    const next = nextInspectionDate(h);
    if (next) items.push({ date: next, hive: h, text: 'Inspection', kind: 'inspection', uid: `insp-${h.id}-${next}` });
    else if (!lastInspection(h.id)) items.push({ date: t, hive: h, text: 'First inspection', kind: 'inspection', uid: `insp-${h.id}-first` });
    for (const tr of activeTreatments(h.id)) {
      items.push({ date: tr.endDate || t, hive: h, text: `Finish / remove ${treatmentName(tr)}`, kind: 'treatment', log: tr, uid: `treat-${tr.id}` });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function viewDue() {
  const items = dueItems();
  const t = today();
  const row = it => {
    const d = daysBetween(t, it.date);
    const cls = d < 0 ? 'red' : d === 0 ? 'amber' : 'info';
    const when = d < 0 ? `${-d}d overdue` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d}d`;
    const href = it.kind === 'treatment' ? `#/log/${it.log.id}` : `#/log/new/inspection?hive=${it.hive.id}`;
    return `<a class="card" href="${href}"><div class="row between">
      <div class="grow"><div class="hive-name">${esc(it.text)}</div><div class="small muted">${esc(hiveLabel(it.hive))} · ${fmtDate(it.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div></div>
      <span class="flag ${cls}">${when}</span></div></a>`;
  };
  setView(`<div class="row between"><h1>Due</h1>${items.length ? '<button class="btn small" data-action="export-ics">📅 Add to calendar</button>' : ''}</div>
    ${items.length ? items.map(row).join('') : '<div class="empty"><div class="big">✅</div><p class="muted">Nothing due. Inspections get scheduled when you save one.</p></div>'}
    <p class="small muted">Default intervals: every ${esc(state.settings.seasonInterval)} days in swarm season (Apr–Jul), ${esc(state.settings.offInterval)} days in Mar &amp; Aug–Oct, none Nov–Feb unless you set a date. Change in More → Settings.</p>`, 'due');
}

function viewMedicines() {
  const logs = state.logs.filter(l => l.kind === 'treatment').sort(sortLogs);
  const rows = logs.map(l => {
    const h = hiveById(l.hiveId);
    return `<tr data-href="#/log/${l.id}">
      <td>${fmtDate(l.date)}</td><td>${esc(h ? hiveLabel(h) : '?')}</td><td>${esc(treatmentName(l))}</td>
      <td>${esc(l.batch)}</td><td>${fmtDate(l.expiry)}</td><td>${esc(l.dose)}</td><td>${esc(l.supplier)}</td>
      <td>${l.done ? fmtDate(l.endDate) || '✓' : '<span class="flag amber">Active</span>'}</td><td>${esc(l.withdrawal)}</td></tr>`;
  }).join('');
  setView(`<div class="row between"><h1>Medicines record</h1>${logs.length ? '<button class="btn small" data-action="export-csv" data-kind="treatment">Export CSV</button>' : ''}</div>
    <p class="small muted">UK beekeepers must keep a record of veterinary medicines given to their bees (product, batch, quantity, dates, supplier) and keep it for at least 5 years.</p>
    ${logs.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Started</th><th>Hive</th><th>Product</th><th>Batch</th><th>Expiry</th><th>Dose</th><th>Supplier</th><th>Finished</th><th>Withdrawal</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : '<div class="empty"><div class="big">💊</div><p class="muted">No treatments logged yet. Add one from a hive page.</p></div>'}`, 'medicines');
}

function viewSettings() {
  const s = state.settings;
  const counts = Object.keys(KINDS).map(k => [k, state.logs.filter(l => l.kind === k).length]);
  setView(`<h1>More</h1>
    <h2>Apiaries</h2>
    ${state.apiaries.map(a => `<a class="card row between" href="#/apiary/${a.id}"><span><b>${esc(a.name)}</b><br><span class="small muted">${esc(a.location || '')}</span></span>
      <span class="muted small">${state.hives.filter(h => h.apiaryId === a.id && isActive(h)).length} hives</span></a>`).join('')}
    <a class="btn block" href="#/apiary/new">+ Add apiary</a>

    <h2>Backup &amp; sync</h2>
    <div class="card stack">
      <p class="small" style="margin:0">Everything is stored only on this device. Download a backup regularly. Importing a backup <b>merges</b> it with what's here (newest edit wins), so you can copy records between your phone and computer.</p>
      <p class="small muted" style="margin:0">Last backup: ${state.meta.lastBackup ? fmtDate(state.meta.lastBackup.slice(0, 10)) : 'never'} · <span id="persist-status"></span></p>
      <div class="btn-grid" style="margin:0">
        <button class="btn primary" data-action="export-json">⬇️ Download backup</button>
        <label class="btn">⬆️ Import backup<input type="file" accept="application/json,.json" data-action="import-json" hidden></label>
      </div>
    </div>

    <h2>Export to spreadsheet (CSV)</h2>
    <div class="btn-grid">${counts.filter(([k]) => k !== 'note').map(([k, n]) => `<button class="btn" data-action="export-csv" data-kind="${k}" ${n ? '' : 'disabled'}>${KINDS[k].icon} ${KINDS[k].label}s (${n})</button>`).join('')}</div>

    <h2>Settings</h2>
    <form class="card" data-form="settings">
      ${renderField({ k: 'seasonInterval', l: 'Days between inspections, Apr–Jul', t: 'num', min: 3, max: 30 }, s.seasonInterval)}
      ${renderField({ k: 'offInterval', l: 'Days between inspections, Mar & Aug–Oct', t: 'num', min: 3, max: 60 }, s.offInterval)}
      ${renderField({ k: 'theme', l: 'Appearance', t: 'chips', o: [['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']] }, s.theme)}
      <button class="btn primary" type="submit">Save settings</button>
    </form>

    <h2>About</h2>
    <div class="card small">
      <p style="margin-top:0"><b>Hive Log</b> — a free, open-source hive record book. Install it: on iPhone tap Share → <i>Add to Home Screen</i>; on Android tap ⋮ → <i>Install app</i>. Works without signal once opened.</p>
      <p>Varroa thresholds and treatment durations are rough guides only — always follow the product label and <a href="https://www.nationalbeeunit.com/" target="_blank" rel="noopener">National Bee Unit</a> advice.</p>
      <p style="margin-bottom:0" class="muted">${state.apiaries.length} apiaries · ${state.hives.length} hives · ${state.logs.length} records</p>
    </div>

    <h2>Danger zone</h2>
    <button class="btn danger block" data-action="wipe">Delete all data on this device</button>
  `, 'settings');
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then(p => { const el = $('#persist-status'); if (el) el.textContent = p ? 'storage protected from clean-up' : 'browser may clear storage if space runs low'; });
  }
}

function viewNotFound() {
  setView('<div class="empty"><div class="big">🤷</div><p>That record could not be found.</p><a class="btn" href="#/">Back to hives</a></div>', 'hives');
}

/* ---------- Router ---------- */

function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = hash.split('?');
  const q = new URLSearchParams(qs || '');
  const p = path.split('/').filter(Boolean);
  if (!p.length) return viewHives();
  if (p[0] === 'due') return viewDue();
  if (p[0] === 'medicines') return viewMedicines();
  if (p[0] === 'settings') return viewSettings();
  if (p[0] === 'apiary') return viewApiaryForm(p[1] === 'new' ? null : p[1]);
  if (p[0] === 'hive' && p[1] === 'new') return viewHiveForm(null, q);
  if (p[0] === 'hive' && p[2] === 'edit') return viewHiveForm(p[1], q);
  if (p[0] === 'hive') return viewHive(p[1]);
  if (p[0] === 'log' && p[1] === 'new') return viewLogForm(p[2], null, q);
  if (p[0] === 'log') return viewLogForm(null, p[1], q);
  viewNotFound();
}

const go = hash => location.replace(hash);

/* ---------- Form submission ---------- */

function submitApiary(form) {
  const data = readForm(form, fieldIndex(APIARY_SECTIONS));
  if (!data.name) return toast('Give the apiary a name');
  const id = form.dataset.id;
  const rec = id ? { ...apiaryById(id), ...data } : { id: uid(), ...data };
  upsert('apiaries', rec);
  toast('Apiary saved');
  go(id ? '#/' : (state.hives.length ? '#/' : `#/hive/new?apiary=${rec.id}`));
}

function submitHive(form) {
  const data = readForm(form, HIVE_FIELDS);
  if (!data.name) return toast('Give the hive a name');
  const id = form.dataset.id;
  const rec = id ? { ...hiveById(id), ...data } : { id: uid(), ...data };
  if (!rec.status) rec.status = 'active';
  upsert('hives', rec);
  toast('Hive saved');
  go(`#/hive/${rec.id}`);
}

function submitLog(form) {
  const kind = form.dataset.kind;
  const data = readForm(form, { ...FIELDS[kind], date: { k: 'date', t: 'date' }, hiveId: { k: 'hiveId', t: 'select' } });
  if (!data.date) return toast('Pick a date');
  if (kind === 'note' && !data.notes) return toast('Write a note first');
  const id = form.dataset.id;
  const rec = id ? { ...logById(id), ...data } : { id: uid(), kind, ...data };
  upsert('logs', rec);
  try { localStorage.removeItem(draftKey(kind, form.dataset.hive)); } catch (_) { /* ignore */ }
  toast(`${KINDS[kind].label} saved`);
  if (!id && kind === 'inspection' && (data.actions || []).includes('treated')) {
    toast('Now record the treatment for your medicines log');
    return go(`#/log/new/treatment?hive=${rec.hiveId}`);
  }
  if (!id && kind === 'inspection' && (data.actions || []).includes('fed')) {
    return go(`#/log/new/feed?hive=${rec.hiveId}`);
  }
  go(`#/hive/${rec.hiveId}`);
}

function submitSettings(form) {
  const data = readForm(form, {
    seasonInterval: { k: 'seasonInterval', t: 'num' },
    offInterval: { k: 'offInterval', t: 'num' },
    theme: { k: 'theme', t: 'chips' },
  });
  state.settings = { ...state.settings, ...data, theme: data.theme || 'auto' };
  save();
  applyTheme();
  toast('Settings saved');
}

function saveDraft(form) {
  if (!form || form.dataset.form !== 'log' || !form.dataset.new) return;
  const kind = form.dataset.kind;
  const data = readForm(form, { ...FIELDS[kind], date: { k: 'date', t: 'date' } });
  try { localStorage.setItem(draftKey(kind, form.dataset.hive), JSON.stringify(data)); } catch (_) { /* ignore */ }
}

/* ---------- Import / export ---------- */

function downloadFile(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  const iosStandalone = window.navigator.standalone === true;
  if (iosStandalone && navigator.canShare) {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(() => {});
      return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function exportJson() {
  state.meta.lastBackup = nowIso();
  save();
  downloadFile(`hive-log-backup-${today()}.json`, 'application/json', JSON.stringify(state, null, 2));
  toast('Backup downloaded');
}

function mergeState(inc) {
  if (!inc || typeof inc !== 'object' || !Array.isArray(inc.hives) || !Array.isArray(inc.logs) || !Array.isArray(inc.apiaries)) {
    throw new Error('This file is not a Hive Log backup.');
  }
  const deleted = { ...state.deleted };
  for (const [id, ts] of Object.entries(inc.deleted || {})) if (!deleted[id] || deleted[id] < ts) deleted[id] = ts;
  let added = 0;
  for (const coll of ['apiaries', 'hives', 'logs']) {
    const map = new Map(state[coll].map(r => [r.id, r]));
    for (const r of inc[coll]) {
      if (!r || !r.id) continue;
      const cur = map.get(r.id);
      if (!cur) { map.set(r.id, r); added++; } else if ((r.updatedAt || '') > (cur.updatedAt || '')) map.set(r.id, r);
    }
    state[coll] = [...map.values()].filter(r => !(deleted[r.id] && deleted[r.id] >= (r.updatedAt || '')));
  }
  state.deleted = deleted;
  save();
  return added;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(kind) {
  const fields = Object.values(FIELDS[kind]);
  const header = ['Date', 'Apiary', 'Hive', ...fields.map(f => f.l || f.csv || f.k)];
  if (kind === 'inspection') header.push('Varroa result');
  const rows = state.logs.filter(l => l.kind === kind).sort((a, b) => a.date.localeCompare(b.date)).map(l => {
    const h = hiveById(l.hiveId) || {};
    const a = apiaryById(h.apiaryId) || {};
    const vals = fields.map(f => {
      if (f.t === 'toggle') return l[f.k] ? 'Yes' : 'No';
      if (f.t === 'date') return l[f.k] || '';
      if (f.t === 'num' || f.t === 'text' || f.t === 'textarea') return l[f.k] ?? '';
      return optLabel(f, l[f.k]);
    });
    const row = [l.date, a.name || '', h.name || '', ...vals];
    if (kind === 'inspection') { const v = varroaResult(l); row.push(v ? v.text : ''); }
    return row;
  });
  const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  downloadFile(`hive-log-${kind}s-${today()}.csv`, 'text/csv', '﻿' + csv);
}

function exportIcs() {
  const stamp = nowIso().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const icsText = s => String(s).replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
  const events = dueItems().map(it => {
    const d = it.date.replace(/-/g, '');
    const end = addDays(it.date, 1).replace(/-/g, '');
    return ['BEGIN:VEVENT', `UID:${it.uid}@hivelog`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsText(`🐝 ${it.text} — ${hiveLabel(it.hive)}`)}`, 'END:VEVENT'].join('\r\n');
  });
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hive Log//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  downloadFile(`hive-log-due-${today()}.ics`, 'text/calendar', ics);
}

/* ---------- Events ---------- */

function onChipClick(btn) {
  const group = btn.closest('[data-chips]');
  const multi = group.dataset.multi === '1';
  const pressed = btn.getAttribute('aria-pressed') === 'true';
  if (!multi) $$('.chip', group).forEach(b => b.setAttribute('aria-pressed', 'false'));
  btn.setAttribute('aria-pressed', String(!pressed));
  const vals = $$('.chip[aria-pressed="true"]', group).map(b => b.dataset.v);
  const input = group.parentElement.querySelector(`input[name="${group.dataset.chips}"]`);
  input.value = vals.join(',');
  if (group.dataset.chips === 'health') {
    const warn = $('#notifiable');
    if (warn) warn.hidden = !vals.some(v => NOTIFIABLE.includes(v));
  }
  saveDraft(btn.closest('form'));
}

function onStep(btn) {
  const input = btn.closest('.stepper').querySelector('input');
  const step = Number(input.dataset.stepsize) || 1;
  const min = input.min !== '' ? Number(input.min) : -Infinity;
  const max = input.max !== '' ? Number(input.max) : Infinity;
  const dir = Number(btn.dataset.step);
  let v = input.value === ''
    ? Number(input.dataset.start || (dir > 0 ? Math.max(min, 0) + step : Math.max(min, 0)))
    : Number(input.value) + dir * step;
  v = Math.min(max, Math.max(min, v));
  input.value = Math.round(v * 100) / 100;
  saveDraft(btn.closest('form'));
}

document.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (chip) return onChipClick(chip);
  const step = e.target.closest('[data-step]');
  if (step) return onStep(step);
  const row = e.target.closest('tr[data-href]');
  if (row) { location.hash = row.dataset.href; return; }
  const act = e.target.closest('[data-action]');
  if (!act || act.tagName === 'INPUT') return;
  const id = act.dataset.id;
  switch (act.dataset.action) {
    case 'export-json': return exportJson();
    case 'export-csv': return exportCsv(act.dataset.kind);
    case 'export-ics': return exportIcs();
    case 'discard-draft': {
      const form = $('form[data-form="log"]');
      try { localStorage.removeItem(draftKey(form.dataset.kind, form.dataset.hive)); } catch (_) { /* ignore */ }
      return route();
    }
    case 'delete-log': {
      const l = logById(id);
      if (l && confirm(`Delete this ${KINDS[l.kind].label.toLowerCase()} from ${fmtDate(l.date)}?`)) {
        removeRec('logs', id); toast('Deleted'); go(`#/hive/${l.hiveId}`);
      }
      return;
    }
    case 'delete-hive': {
      const h = hiveById(id);
      const n = logsFor(id).length;
      if (h && confirm(`Delete ${h.name} and its ${n} record${n === 1 ? '' : 's'}? This can't be undone.`)) {
        logsFor(id).forEach(l => removeRec('logs', l.id));
        removeRec('hives', id); toast('Hive deleted'); go('#/');
      }
      return;
    }
    case 'delete-apiary': {
      const n = state.hives.filter(h => h.apiaryId === id).length;
      if (n) return alert(`Move or delete the ${n} hive${n === 1 ? '' : 's'} in this apiary first.`);
      if (confirm('Delete this apiary?')) { removeRec('apiaries', id); toast('Apiary deleted'); go('#/'); }
      return;
    }
    case 'wipe':
      if (confirm('Delete ALL apiaries, hives and records on this device?') && confirm('Really? Have you downloaded a backup?')) {
        state = blankState(); save(); toast('All data deleted'); go('#/');
      }
      return;
  }
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.matches('input[type=file][data-action="import-json"]')) {
    const file = t.files && t.files[0];
    if (!file) return;
    try {
      const added = mergeState(JSON.parse(await file.text()));
      toast(`Backup imported (${added} new item${added === 1 ? '' : 's'})`);
      route();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
    t.value = '';
    return;
  }
  const form = t.closest('form[data-form="log"]');
  if (form && form.dataset.kind === 'treatment' && (t.name === 'product' || t.name === 'date')) {
    const product = form.elements.product.value;
    const date = form.elements.date.value || today();
    const days = (TREATMENTS.find(x => x[0] === product) || [])[2] || 0;
    form.elements.endDate.value = addDays(date, days);
    form.elements.done.checked = days === 0;
  }
  if (form && form.dataset.kind === 'inspection' && t.name === 'date' && form.dataset.new && t.value) {
    form.elements.nextDue.value = defaultNextDue(t.value);
  }
  saveDraft(form);
});

document.addEventListener('input', e => saveDraft(e.target.closest('form')));

document.addEventListener('submit', e => {
  const form = e.target;
  e.preventDefault();
  switch (form.dataset.form) {
    case 'apiary': return submitApiary(form);
    case 'hive': return submitHive(form);
    case 'log': return submitLog(form);
    case 'settings': return submitSettings(form);
  }
});

window.addEventListener('hashchange', route);

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

/* ---------- Boot ---------- */

(async function boot() {
  await loadState();
  applyTheme();
  route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
  }
})();
