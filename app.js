/* Forma — app personale allenamento / dieta / acqua */
'use strict';

/* ---------- utilità ---------- */
const KEY = 'forma.v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const today = () => dkey(new Date());
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const dow = k => parseKey(k).getDay();
const DOW = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const DOW3 = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MON = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const fmtDate = k => { const d = parseKey(k); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtShort = k => { const d = parseKey(k); return `${DOW3[d.getDay()]} ${d.getDate()}`; };
const relDay = k => { const n = daysBetween(today(), k); return n === 0 ? 'oggi' : n === 1 ? 'domani' : n === -1 ? 'ieri' : fmtShort(k).toLowerCase(); };
const r05 = x => Math.round(x * 2) / 2;
const r5 = x => Math.round(x / 5) * 5;
const fmtKg = x => (x == null || isNaN(x)) ? '–' : (Math.round(x * 10) / 10).toString().replace('.', ',');
const fmtL = ml => (ml / 1000).toFixed(ml % 1000 === 0 ? 0 : (ml % 100 === 0 ? 1 : 2)).replace('.', ',') + ' L';
const fmtRest = s => s >= 60 ? (s % 60 ? `${Math.floor(s / 60)}:${pad(s % 60)} min` : `${s / 60} min`) : `${s} s`;
const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? null : x; };

/* ---------- stato ---------- */
function withIds(diet) {
  const d = clone(diet);
  for (const k of Object.keys(d.days)) d.days[k].forEach(m => { m.id = m.id || uid(); m.items.forEach(i => { i.id = i.id || uid(); }); });
  return d;
}
function defaults() {
  return {
    v: 1,
    settings: { waterGoal: 3000, containers: clone(DEFAULT_CONTAINERS), judoDays: [2, 5], meetingEvery: 7, lastMeeting: null, startDate: today(), weightGoal: 80 },
    workouts: clone(DEFAULT_WORKOUTS),
    diet: withIds(DEFAULT_DIET),
    logs: { sessions: {}, overrides: {}, extras: {}, diet: {}, water: {}, weight: {}, meetings: [] },
  };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v) return s; } catch (e) { /* vuoto */ }
  return defaults();
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Errore nel salvataggio'); } }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const UI = { tab: 'today', view: null, dietDate: today(), waterHalf: false, editDietDay: null, progEx: null };

/* ---------- pianificazione allenamenti ---------- */
const wById = id => S.workouts.find(w => w.id === id);
const exById = id => { for (const w of S.workouts) { const e = w.ex.find(x => x.id === id); if (e) return { e, w }; } return null; };
const isJudo = k => S.settings.judoDays.includes(dow(k));

function planned(k) {
  const o = S.logs.overrides[k];
  if (o) { const w = wById(o.wid); if (w) return { w, mode: o.mode, from: o.from, override: true }; }
  const w = S.workouts.find(x => x.day === dow(k));
  return w ? { w, mode: 'normal' } : null;
}
/* c'è allenamento effettivo (non saltato) in quel giorno? */
function gymOn(k) {
  const p = planned(k); if (!p) return null;
  const s = S.logs.sessions[k]; if (s && s.status === 'skipped') return null;
  return p;
}

function sessionExercises(k) {
  const p = planned(k); const list = [];
  const sess = S.logs.sessions[k] || {};
  if (p) {
    let exs = p.w.ex.map(e => ({ ...e }));
    if (p.mode === 'express') exs = exs.slice(0, 3).map(e => ({ ...e, sets: Math.min(e.sets, 3) }));
    if (p.mode === 'reduced') exs = exs.map(e => ({ ...e, sets: Math.max(2, e.sets - 1) }));
    if (sess.fatigue && p.w.fatigue === 'sets') exs = exs.map(e => ({ ...e, sets: Math.max(1, e.sets - 1) }));
    exs.forEach(e => list.push({ e, w: p.w, weightFactor: (sess.fatigue && p.w.fatigue === 'weight') ? 0.925 : 1 }));
  }
  (S.logs.extras[k] || []).forEach(x => {
    const f = exById(x.exId); if (f) list.push({ e: { ...f.e, sets: x.sets }, w: f.w, extra: x.from, weightFactor: 1 });
  });
  return list;
}

function exHistory(exId, beforeK) {
  const out = [];
  for (const k of Object.keys(S.logs.sessions).sort().reverse()) {
    if (beforeK && k >= beforeK) continue;
    const s = S.logs.sessions[k];
    const sets = (s.sets && s.sets[exId] || []).filter(x => x && x.r > 0);
    if (sets.length) out.push({ k, sets });
  }
  return out;
}
const topW = sets => Math.max(...sets.map(s => s.w || 0));

function suggestion(e, k, factor = 1) {
  const hist = exHistory(e.id, k);
  const u = e.unit === 'sec' ? 's' : 'rip';
  if (!hist.length) return { w: null, kind: 'first', text: `Prima volta: scegli un carico con cui fai ${e.repMin} ${u} in tutte le serie, tenendo 2 rip. in riserva.` };
  const last = hist[0]; const w = topW(last.sets);
  const atW = last.sets.filter(s => (s.w || 0) === w);
  const allMax = last.sets.length >= 2 && last.sets.every(s => s.r >= e.repMax);
  let res;
  if (allMax) {
    res = { w: r05(w + e.inc), kind: 'up', text: `Ultima volta ${e.repMax} ${u} in tutte le serie: aumenta di ${fmtKg(e.inc)} kg.` };
  } else {
    res = { w, kind: 'same', text: `Stesso carico (${fmtKg(w)} kg): punta a ${e.repMax} ${u} in ogni serie.` };
    const h3 = hist.slice(0, 3);
    if (h3.length === 3 && h3.every(h => topW(h.sets) === w)) {
      const tot = h3.map(h => h.sets.reduce((a, s) => a + s.r, 0));
      if (tot[0] <= tot[2]) res = { w: r05(w * 0.9), kind: 'deload', text: `Stallo da 3 sedute a ${fmtKg(w)} kg: scarica del 10% e risali con la doppia progressione.` };
    }
  }
  if (factor !== 1 && res.w) { res.w = r05(res.w * factor); res.text += ' (pesi −7,5% per stanchezza)'; }
  res.last = last; res.atW = atW;
  return res;
}

/* opzioni di recupero quando si salta un allenamento */
function recoveryOptions(k) {
  const p = planned(k); if (!p) return [];
  const w = p.w; const t = today(); const opts = [];
  const start = k < t ? t : addDays(k, 1);
  for (let i = 0; i < 4; i++) {
    const d = addDays(start, i);
    if (daysBetween(k, d) > 4) break;
    if (planned(d) || isJudo(d)) continue;
    const warn = []; let mode = 'normal';
    if (w.legs && isJudo(addDays(d, 1))) { warn.push('domani hai judo'); mode = 'reduced'; }
    const prev = addDays(d, -1) === k ? null : gymOn(addDays(d, -1));
    if (w.legs && prev && prev.w.legs) { warn.push('il giorno prima alleni già le gambe'); mode = 'reduced'; }
    const next = gymOn(addDays(d, 1));
    if (w.legs && next && next.w.legs) { warn.push('il giorno dopo alleni già le gambe'); mode = 'reduced'; }
    opts.push({ type: 'move', date: d, mode, warn, score: i + (mode === 'reduced' ? 1.5 : 0) });
  }
  opts.sort((a, b) => a.score - b.score);
  const out = opts.slice(0, 2).map(o => ({
    ...o,
    title: `Spostalo a ${['oggi', 'domani'].includes(relDay(o.date)) ? `${relDay(o.date)} (${fmtShort(o.date)})` : DOW[dow(o.date)].toLowerCase() + ' ' + parseKey(o.date).getDate()}`,
    desc: o.mode === 'reduced' ? `Versione ridotta, una serie in meno per esercizio: ${o.warn.join(', ')}.` : 'Sessione completa in un giorno libero.',
  }));
  const free = opts.find(o => o.date === t || o.date === addDays(t, 1));
  if (free) out.push({ type: 'move', date: free.date, mode: 'express', title: `Express 40 min ${relDay(free.date)}`, desc: `Solo i primi 3 esercizi (i fondamentali), massimo 3 serie: ${w.ex.slice(0, 3).map(e => e.n).join(', ')}.` });
  for (let i = 1; i <= 6; i++) {
    const d = addDays(k, i); if (d < t) continue;
    const g = gymOn(d);
    if (g && g.w.id !== w.id) {
      const keys = w.ex.slice(0, 2);
      out.push({ type: 'merge', date: d, title: `Aggiungi i fondamentali a ${g.w.n} di ${relDay(d)}`, desc: `${keys.map(e => e.n).join(' e ')}: 2 serie ciascuno a fine seduta.` });
      break;
    }
  }
  out.push({ type: 'none', title: 'Lascia stare e riparti', desc: 'Salti questa sessione e riprendi dalla prossima come da scheda.' });
  return out;
}

function applyRecovery(k, o) {
  const p = planned(k);
  S.logs.sessions[k] = { ...(S.logs.sessions[k] || {}), wid: p.w.id, status: 'skipped', rec: o.type, recDate: o.date || null, sets: (S.logs.sessions[k] || {}).sets || {} };
  if (o.type === 'move') S.logs.overrides[o.date] = { wid: p.w.id, mode: o.mode, from: k };
  if (o.type === 'merge') {
    const arr = S.logs.extras[o.date] || (S.logs.extras[o.date] = []);
    p.w.ex.slice(0, 2).forEach(e => { if (!arr.some(x => x.exId === e.id)) arr.push({ exId: e.id, sets: 2, from: k }); });
  }
  save();
}

function pendingWorkouts() {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const k = addDays(today(), -i);
    if (k < S.settings.startDate) continue;
    const p = planned(k); const s = S.logs.sessions[k];
    if (p && !s) out.push(k);
  }
  return out;
}

/* ---------- dieta ---------- */
const dietDay = k => S.diet.days[dow(k)] || [];
const dlog = k => { const l = S.logs.diet[k] || (S.logs.diet[k] = { m: {}, c: {}, adj: {}, extra: [] }); l.m ||= {}; l.c ||= {}; l.adj ||= {}; l.extra ||= []; return l; };
const peekDlog = k => S.logs.diet[k] || { m: {}, c: {}, adj: {}, extra: [] };
const chosenOpt = (k, item) => item.o[Math.min((peekDlog(k).c || {})[item.id] || 0, item.o.length - 1)];

function partMacros(part, extraG = 0) {
  const f = FOODS[part.f]; if (!f) return { k: 0, p: 0, c: 0, f: 0 };
  const g = (part.u === 'pz' ? part.g * (f.pz || 50) : part.g) + extraG;
  const r = g / 100;
  return { k: f.k * r, p: f.p * r, c: f.c * r, f: f.f * r };
}
const addM = (a, b) => ({ k: a.k + b.k, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f });
const ZERO = { k: 0, p: 0, c: 0, f: 0 };
function itemMacros(k, item, withAdj = true) {
  const opt = chosenOpt(k, item); const adj = withAdj ? (peekDlog(k).adj || {})[item.id] || 0 : 0;
  return opt.reduce((a, part, i) => addM(a, partMacros(part, i === 0 ? adj : 0)), ZERO);
}
const mealMacros = (k, m, withAdj = true) => m.items.reduce((a, it) => addM(a, itemMacros(k, it, withAdj)), ZERO);
function extraMacros(x) { return x.parts.reduce((a, pt) => addM(a, partMacros(pt)), ZERO); }
function dayTotals(k) {
  const l = peekDlog(k); let plan = ZERO, eaten = ZERO;
  dietDay(k).forEach(m => { plan = addM(plan, mealMacros(k, m, false)); if (l.m[m.id] === 'done') eaten = addM(eaten, mealMacros(k, m)); });
  (l.extra || []).forEach(x => { if (x.done) eaten = addM(eaten, extraMacros(x)); });
  return { plan, eaten };
}
const partLabel = pt => `${pt.n} ${pt.u === 'pz' ? pt.g + ' pz' : pt.g + ' ' + pt.u}`;
const optLabel = opt => opt.map(partLabel).join(' + ');
const foodCat = part => (FOODS[part.f] || {}).cat || '?';

function recoverMealOptions(k, mealId) {
  const meals = dietDay(k); const idx = meals.findIndex(m => m.id === mealId); if (idx < 0) return [];
  const missed = mealMacros(k, meals[idx]); const l = peekDlog(k);
  const remaining = meals.slice(idx + 1).filter(m => !l.m[m.id]);
  const isMain = m => mealMacros(k, m, false).k >= 350 && m.items.some(i => foodCat(chosenOpt(k, i)[0]) === 'P') && m.items.some(i => foodCat(chosenOpt(k, i)[0]) === 'C');
  const mains = remaining.filter(isMain);
  const out = [];
  if (mains.length) {
    const last = mains[mains.length - 1];
    out.push(boostPlan(k, [last], missed, `Aumenta ${last.n.toLowerCase()}`));
    if (mains.length > 1) out.push(boostPlan(k, mains, missed, `Dividi tra ${mains.map(m => m.n.toLowerCase()).join(' e ')}`));
  }
  const sn = snackPlan(missed, remaining.length ? 'più tardi' : 'prima di dormire');
  if (sn) out.push(sn);
  out.push({ type: 'none', title: 'Lascia stare', desc: 'Nessun recupero: domani riparti dal piano normale, senza compensare.', changes: [] });
  return out.filter(Boolean);
}

function boostPlan(k, targets, missed, title) {
  const share = 1 / targets.length; const changes = []; let uncovered = false;
  for (const m of targets) {
    const pick = cat => m.items.filter(i => foodCat(chosenOpt(k, i)[0]) === cat && FOODS[chosenOpt(k, i)[0].f])
      .sort((a, b) => itemMacros(k, b, false)[cat === 'P' ? 'p' : cat === 'C' ? 'c' : 'f'] - itemMacros(k, a, false)[cat === 'P' ? 'p' : cat === 'C' ? 'c' : 'f'])[0];
    const pI = pick('P'), cI = pick('C'), fI = pick('F');
    let need = { p: missed.p * share, c: missed.c * share, f: missed.f * share };
    const add = (item, macro) => {
      if (!item || need[macro] <= 0.5) return;
      const part = chosenOpt(k, item)[0]; const food = FOODS[part.f]; const per = food[macro] / 100; if (per <= 0) return;
      const base = part.u === 'pz' ? part.g * (food.pz || 50) : part.g;
      let g = need[macro] / per; const cap = Math.max(base * 0.8, 15);
      if (g > cap) { g = cap; uncovered = true; }
      g = macro === 'f' ? Math.max(5, r5(g)) : r5(g);
      if (g <= 0) return;
      const gained = partMacros({ ...part, u: 'g', g: 0 }, g);
      need = { p: need.p - gained.p, c: need.c - gained.c, f: need.f - gained.f };
      changes.push({ mealId: m.id, itemId: item.id, g, label: `${m.n}: ${part.n} +${g} ${part.u === 'ml' ? 'ml' : 'g'}`, from: base, unit: part.u === 'ml' ? 'ml' : 'g' });
    };
    add(pI, 'p'); add(cI, 'c'); if (need.f > 2) add(fI, 'f');
  }
  if (!changes.length) return null;
  return { type: 'boost', title, changes, desc: changes.map(c => `${c.label} (${c.from} → ${c.from + c.g} ${c.unit})`).join('<br>') + (uncovered ? '<br><span class="muted">Aumento limitato per non stravolgere il pasto.</span>' : '') };
}

function snackPlan(missed, when) {
  if (missed.k < 60) return null;
  const combos = [['yogurt0', 'frutta'], ['bresaola', 'pane'], ['yogurt0', 'fsecca'], ['latte', 'cereali_col'], ['grana', 'frutta']];
  let best = null;
  for (const [a, b] of combos) {
    const A = FOODS[a], B = FOODS[b];
    let ga = r5(Math.max(missed.p, 8) / (A.p / 100)); ga = Math.min(ga, a === 'grana' ? 40 : 300);
    const ka = A.k * ga / 100;
    let gb = r5(Math.max(0, missed.k - ka) / (B.k / 100)); gb = Math.min(gb, 300);
    const tot = ka + B.k * gb / 100; const pt = A.p * ga / 100 + B.p * gb / 100;
    const err = Math.abs(tot - missed.k) / missed.k + Math.abs(pt - missed.p) / Math.max(missed.p, 5) * 0.7;
    if (ga > 0 && (!best || err < best.err)) best = { err, parts: [{ n: A.n, f: a, g: ga, u: a === 'latte' ? 'ml' : 'g' }, ...(gb > 0 ? [{ n: B.n, f: b, g: gb, u: 'g' }] : [])] };
  }
  if (!best) return null;
  return { type: 'snack', title: `Spuntino di recupero ${when}`, parts: best.parts, desc: `${optLabel(best.parts)} · circa ${Math.round(missed.k)} kcal, ${Math.round(missed.p)} g di proteine.` };
}

function applyMealRecovery(k, mealId, o) {
  const l = dlog(k); l.m[mealId] = 'skip'; l.rec ||= {};
  l.rec[mealId] = o.title;
  if (o.type === 'boost') o.changes.forEach(c => { l.adj[c.itemId] = (l.adj[c.itemId] || 0) + c.g; });
  if (o.type === 'snack') l.extra.push({ id: uid(), n: 'Spuntino di recupero', parts: o.parts, done: false });
  save();
}

/* ---------- acqua / peso ---------- */
const waterTotal = k => (S.logs.water[k] || []).reduce((a, x) => a + x.ml, 0);

/* ---------- meeting with Claude ---------- */
function meetingDue() {
  const ref = S.settings.lastMeeting || S.settings.startDate;
  return daysBetween(ref, today()) >= S.settings.meetingEvery;
}
function buildReport() {
  const end = today(); const startRef = S.settings.lastMeeting || S.settings.startDate;
  const start = daysBetween(startRef, end) > 28 ? addDays(end, -28) : startRef;
  const days = []; for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  let gymPlanned = 0, gymDone = 0, gymSkipped = 0, recovered = 0; const skippedList = [];
  days.forEach(d => {
    const p = planned(d); const s = S.logs.sessions[d];
    if (p && d < end) { gymPlanned++; if (s && s.status === 'done') gymDone++; else if (s && s.status === 'skipped') { gymSkipped++; skippedList.push(`${fmtShort(d)} ${p.w.n} (${s.rec === 'move' ? 'spostato' : s.rec === 'merge' ? 'fuso' : 'non recuperato'})`); } }
    if (s && s.status === 'done' && S.logs.overrides[d] && S.logs.overrides[d].from !== d) recovered++;
  });
  const prog = [];
  S.workouts.forEach(w => w.ex.forEach(e => {
    const h = exHistory(e.id).filter(x => x.k >= start);
    if (h.length) { const a = h[h.length - 1], b = h[0]; prog.push(`- ${e.n}: ${fmtKg(topW(a.sets))} kg → ${fmtKg(topW(b.sets))} kg (ultime rip: ${b.sets.map(s => s.r).join('/')}, target ${e.repMin}-${e.repMax})`); }
  }));
  let mealsTot = 0, mealsDone = 0, mealsSkip = 0; const skipBy = {};
  days.forEach(d => { if (d === end) return; const l = peekDlog(d); dietDay(d).forEach(m => { mealsTot++; if (l.m[m.id] === 'done') mealsDone++; else { if (l.m[m.id] === 'skip') mealsSkip++; skipBy[m.n] = (skipBy[m.n] || 0) + 1; } }); });
  const worstMeal = Object.entries(skipBy).sort((a, b) => b[1] - a[1])[0];
  const wDays = days.filter(d => d < end); const wAvg = wDays.length ? wDays.reduce((a, d) => a + waterTotal(d), 0) / wDays.length : 0;
  const wDaysOk = wDays.filter(d => waterTotal(d) >= S.settings.waterGoal).length;
  const weights = Object.keys(S.logs.weight).sort();
  const wIn = weights.filter(k => k >= start);
  const wStart = wIn.length ? S.logs.weight[wIn[0]] : null, wEnd = wIn.length ? S.logs.weight[wIn[wIn.length - 1]] : null;
  const notes = days.map(d => S.logs.sessions[d] && S.logs.sessions[d].notes ? `- ${fmtShort(d)}: ${S.logs.sessions[d].notes}` : null).filter(Boolean);
  return `Ciao Claude, è il nostro "meeting" periodico sulla mia app Forma. Sono Riccardo, obiettivo aumento di massa muscolare (superare i ${S.settings.weightGoal} kg). Faccio judo il martedì e il venerdì e palestra secondo la scheda (${S.workouts.map(w => `${DOW[w.day]} ${w.n}`).join(', ')}). Seguo una dieta del nutrizionista.

REPORT ${fmtDate(start)} → ${fmtDate(end)}

Allenamenti: ${gymDone}/${gymPlanned} fatti, ${gymSkipped} saltati${recovered ? `, ${recovered} recuperati` : ''}.
${skippedList.length ? 'Saltati: ' + skippedList.join('; ') + '\n' : ''}
Progressione carichi:
${prog.length ? prog.join('\n') : '- nessun dato registrato'}

Dieta: ${mealsDone}/${mealsTot} pasti completati (${mealsTot ? Math.round(mealsDone / mealsTot * 100) : 0}%), ${mealsSkip} saltati.${worstMeal ? ` Il pasto che salto/dimentico di più: ${worstMeal[0]} (${worstMeal[1]} volte).` : ''}

Acqua: media ${fmtL(Math.round(wAvg / 50) * 50)} al giorno (obiettivo ${fmtL(S.settings.waterGoal)}), obiettivo raggiunto ${wDaysOk}/${wDays.length} giorni.

Peso: ${wStart != null ? `${fmtKg(wStart)} kg → ${fmtKg(wEnd)} kg` : 'non registrato'}.
${notes.length ? '\nNote sugli allenamenti:\n' + notes.join('\n') + '\n' : ''}
Parliamo di come è andata: cosa sta funzionando, cosa migliorare negli allenamenti e come essere più costante con dieta e acqua. Fammi anche 2-3 domande per capire meglio.`;
}

/* ---------- icone ---------- */
const I = {
  today: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  gym: '<svg viewBox="0 0 24 24"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
  diet: '<svg viewBox="0 0 24 24"><path d="M7 3v8a2.5 2.5 0 0 0 2.5 2.5V21M12 3v8a2.5 2.5 0 0 1-2.5 2.5M9.5 3v6M17 21V3c-2 1.5-3 4-3 7v3h3"/></svg>',
  water: '<svg viewBox="0 0 24 24"><path d="M12 3s6.5 7.2 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10.2 12 3 12 3z"/></svg>',
  prog: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
  judo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><path d="M6 10l6-2 6 2M12 8v6l-3 7M12 14l3 7M8 15h8"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
};
const SPARK = `<svg class="spark" viewBox="0 0 24 24"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#64D2FF"/><stop offset="1" stop-color="#0A84FF"/></linearGradient></defs><path fill="url(#sg)" d="M12 1.5c.7 5.6 3.4 8.6 9 9.6v1.8c-5.6 1-8.3 4-9 9.6h-.1c-.8-5.6-3.4-8.6-9-9.6v-1.8c5.6-1 8.2-4 9-9.6z"/><circle cx="19.2" cy="4.6" r="1.4" fill="#64D2FF"/></svg>`;
const containerIcon = kind => ({
  glass: '<svg viewBox="0 0 32 32"><path d="M8 5h16l-2 22H10z"/><path class="fill" d="M9.2 14h13.6l-1.2 12H10.4z"/></svg>',
  cup: '<svg viewBox="0 0 32 32"><path d="M7 6h18l-2.5 21h-13z"/><path d="M8 10h16" /><path class="fill" d="M8.6 15h14.8l-1.4 11h-12z"/></svg>',
  bottle: '<svg viewBox="0 0 32 32"><path d="M13 3h6v3l2 3v19a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V9l2-3z"/><path class="fill" d="M12 15h8v12.5h-8z"/></svg>',
  bigbottle: '<svg viewBox="0 0 32 32"><path d="M13.5 2h5v3l3.5 4v20a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1V9l3.5-4z"/><path d="M10 15h12M10 21h12"/><path class="fill" d="M11 16h10v12.5H11z"/></svg>',
  flask: '<svg viewBox="0 0 32 32"><rect x="12" y="2.5" width="8" height="4" rx="1"/><rect x="9" y="6.5" width="14" height="22.5" rx="4"/><path class="fill" d="M10.5 15h11v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z"/></svg>',
}[kind] || '');

/* ---------- componenti ---------- */
function ring(val, max, size = 120, stroke = 11, color = 'var(--blue)', inner = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = Math.min(1, max ? val / max : 0);
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--fill)" stroke-width="${stroke}" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)"/></svg><div class="ring-in">${inner}</div></div>`;
}
function lineChart(points, { goal = null, unit = '', h = 150 } = {}) {
  if (points.length < 2) return `<div class="empty">Servono almeno 2 registrazioni per il grafico.</div>`;
  const W = 340, H = h, pl = 34, pr = 12, pt = 14, pb = 24;
  const ys = points.map(p => p.y).concat(goal != null ? [goal] : []);
  let lo = Math.min(...ys), hi = Math.max(...ys); if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const padY = (hi - lo) * 0.12; lo -= padY; hi += padY;
  const x0 = parseKey(points[0].x).getTime(), x1 = parseKey(points[points.length - 1].x).getTime() || x0 + 1;
  const X = k => pl + (W - pl - pr) * ((parseKey(k).getTime() - x0) / Math.max(1, x1 - x0));
  const Y = v => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${d}L${X(points[points.length - 1].x).toFixed(1)},${H - pb}L${pl},${H - pb}Z`;
  const ticks = [lo + padY, (lo + hi) / 2, hi - padY];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A84FF" stop-opacity=".35"/><stop offset="1" stop-color="#0A84FF" stop-opacity="0"/></linearGradient></defs>
  ${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}" class="grid"/><text x="${pl - 6}" y="${Y(t) + 4}" text-anchor="end" class="axis">${fmtKg(t)}</text>`).join('')}
  ${goal != null ? `<line x1="${pl}" x2="${W - pr}" y1="${Y(goal)}" y2="${Y(goal)}" class="goal"/><text x="${W - pr}" y="${Y(goal) - 5}" text-anchor="end" class="axis goal-t">obiettivo ${fmtKg(goal)}${unit}</text>` : ''}
  <path d="${area}" fill="url(#ag)"/><path d="${d}" class="line"/>
  ${points.map(p => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" class="dot"/>`).join('')}
  <text x="${pl}" y="${H - 6}" class="axis">${fmtShort(points[0].x)}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end" class="axis">${fmtShort(points[points.length - 1].x)}</text></svg>`;
}
const btn = (label, a, data = '', cls = '') => `<button class="btn ${cls}" data-a="${a}" ${data}>${label}</button>`;

/* ---------- viste ---------- */
function header(title, { back = false, right = '' } = {}) {
  return `<header class="hdr ${back ? 'sub' : ''}">${back ? `<button class="back" data-a="back">${I.back}<span>Indietro</span></button>` : ''}<h1>${title}</h1><div class="hdr-r">${right}</div></header>`;
}

function weekStrip() {
  const t = today(); const d0 = dow(t); const mon = addDays(t, -((d0 + 6) % 7));
  let h = '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const k = addDays(mon, i); const p = planned(k); const s = S.logs.sessions[k]; const j = isJudo(k);
    let st = 'off', ic = I.moon;
    if (p) { st = s && s.status === 'done' ? 'done' : s && s.status === 'skipped' ? 'skip' : (k < t ? (k < S.settings.startDate ? 'off' : 'miss') : 'plan'); ic = I.gym; }
    else if (j) { st = 'judo'; ic = I.judo; }
    h += `<div class="wd ${k === t ? 'now' : ''} ${st}"><span>${DOW3[dow(k)].slice(0, 1)}</span><b>${parseKey(k).getDate()}</b><i>${ic}</i></div>`;
  }
  return h + '</div>';
}

function vToday() {
  const t = today(); const p = planned(t); const s = S.logs.sessions[t]; let h = header('Oggi', { right: `<button class="icon-btn" data-a="settings">${I.gear}</button>` });
  h += `<p class="date-sub">${fmtDate(t)}</p>` + weekStrip();
  if (meetingDue()) h += `<div class="card meet" data-a="meeting">${SPARK}<div><b>Meeting with Claude</b><span>È ora del punto periodico: com'è andata e cosa migliorare</span></div><i class="chev">${I.chev}</i></div>`;
  pendingWorkouts().forEach(k => {
    const pk = planned(k);
    h += `<div class="card warn"><div class="card-t"><b>${pk.w.n} di ${relDay(k)}</b><span>Non l'hai registrato. Com'è andata?</span></div><div class="row2">${btn('L\'ho fatto', 'openSession', `data-k="${k}"`, 'tinted')}${btn('L\'ho saltato', 'skipWorkout', `data-k="${k}"`, 'tinted red')}</div></div>`;
  });
  // allenamento
  if (p) {
    const st = s ? s.status : null; const exs = sessionExercises(t);
    const modeTag = p.mode === 'reduced' ? '<em class="tag">ridotta</em>' : p.mode === 'express' ? '<em class="tag">express</em>' : '';
    h += `<div class="card"><div class="card-h"><span class="pill blue">${I.gym}Allenamento</span>${p.override ? `<span class="muted sm">recupero di ${fmtShort(p.from)}</span>` : ''}</div>
      <h2>${esc(p.w.n)} ${modeTag}</h2><p class="muted">${exs.length} esercizi · ${exs.reduce((a, x) => a + x.e.sets, 0)} serie</p>
      ${st === 'done' ? `<div class="done-row">${I.check} Completato</div>${btn('Rivedi', 'openSession', `data-k="${t}"`, 'tinted full')}`
        : st === 'skipped' ? `<div class="muted">Saltato · ${s.rec === 'move' ? `spostato a ${relDay(s.recDate)}` : s.rec === 'merge' ? 'fuso con la prossima' : 'nessun recupero'}</div>`
          : `<div class="row2">${btn(s ? 'Continua' : 'Inizia', 'openSession', `data-k="${t}"`, 'primary')}${btn('Non riesco oggi', 'skipWorkout', `data-k="${t}"`, 'tinted')}</div>`}</div>`;
  } else if (isJudo(t)) {
    h += `<div class="card"><span class="pill orange">${I.judo}Judo</span><h2>Judo oggi</h2><p class="muted">Niente palestra. Bevi bene e cura la cena per il recupero.</p></div>`;
  } else {
    h += `<div class="card"><span class="pill gray">${I.moon}Riposo</span><h2>Giorno di recupero</h2><p class="muted">I muscoli crescono mentre riposi. Segui la dieta e l'acqua.</p></div>`;
  }
  if (isJudo(t) && p) h += `<div class="card slim"><span class="pill orange">${I.judo}Judo</span> <span class="muted">anche judo oggi</span></div>`;
  // dieta
  const meals = dietDay(t); const l = peekDlog(t); const next = meals.find(m => !l.m[m.id]); const doneN = meals.filter(m => l.m[m.id] === 'done').length;
  h += `<div class="card"><div class="card-h"><span class="pill green">${I.diet}Dieta</span><span class="muted sm">${doneN}/${meals.length} pasti</span></div>`;
  h += `<div class="bar"><i style="width:${meals.length ? doneN / meals.length * 100 : 0}%"></i></div>`;
  (l.extra || []).filter(x => !x.done).forEach(x => { h += `<div class="next-meal"><b>${esc(x.n)}</b><p>${esc(optLabel(x.parts))}</p><div class="row2">${btn('Fatto', 'extraDone', `data-k="${t}" data-id="${x.id}"`, 'primary sm')}</div></div>`; });
  if (next) {
    h += `<div class="next-meal"><b>Prossimo: ${esc(next.n)}</b><p>${next.items.map(i => esc(optLabel(chosenOpt(t, i)) + ((l.adj || {})[i.id] ? ` (+${l.adj[i.id]})` : ''))).join(' · ')}</p>
      <div class="row2">${btn('Fatto', 'mealDone', `data-k="${t}" data-m="${next.id}"`, 'primary sm')}${btn('Saltato', 'mealSkip', `data-k="${t}" data-m="${next.id}"`, 'tinted sm')}</div></div>`;
  } else if (meals.length) h += `<div class="done-row">${I.check} Tutti i pasti di oggi completati</div>`;
  h += `<button class="link" data-a="tab" data-t="diet">Vedi tutta la giornata ${I.chev}</button></div>`;
  // acqua
  const wt = waterTotal(t);
  h += `<div class="card water-mini"><div class="card-h"><span class="pill cyan">${I.water}Acqua</span><span class="muted sm">${fmtL(wt)} / ${fmtL(S.settings.waterGoal)}</span></div><div class="bar cyan"><i style="width:${Math.min(100, wt / S.settings.waterGoal * 100)}%"></i></div>
    <div class="quick">${S.settings.containers.slice(0, 4).map(c => `<button class="qc" data-a="drink" data-id="${c.id}">${containerIcon(c.kind)}<span>${esc(c.n.replace('Bicchiere di plastica', 'Plastica'))}</span></button>`).join('')}</div></div>`;
  return h;
}

/* ---- allenamento ---- */
function vGym() {
  let h = header('Allenamento');
  h += `<p class="section-t">La tua scheda</p>`;
  S.workouts.slice().sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)).forEach(w => {
    h += `<div class="card tap" data-a="openWorkout" data-id="${w.id}"><div class="card-h"><span class="pill blue">${DOW[w.day]}</span><i class="chev">${I.chev}</i></div><h2>${esc(w.n)}</h2><p class="muted">${w.ex.map(e => esc(e.n)).join(' · ')}</p></div>`;
  });
  h += `<div class="card slim"><span class="pill orange">${I.judo}Judo</span> <span class="muted">${S.settings.judoDays.map(d => DOW[d]).join(' e ')}</span></div>`;
  h += btn(`${I.plus} Nuovo allenamento`, 'newWorkout', '', 'tinted full');
  const hist = Object.keys(S.logs.sessions).sort().reverse().slice(0, 12);
  if (hist.length) {
    h += `<p class="section-t">Storico</p><div class="list">`;
    hist.forEach(k => { const s = S.logs.sessions[k]; const w = wById(s.wid); h += `<div class="li tap" data-a="openSession" data-k="${k}"><div><b>${esc(w ? w.n : 'Allenamento')}</b><span>${fmtDate(k)}</span></div><em class="st ${s.status}">${s.status === 'done' ? 'fatto' : s.status === 'skipped' ? 'saltato' : 'in corso'}</em></div>`; });
    h += `</div>`;
  }
  return h;
}

function vWorkout(id, edit) {
  const w = wById(id); if (!w) { UI.view = null; return vGym(); }
  let h = header(esc(w.n), { back: true, right: `<button class="txt-btn" data-a="toggleEditW" data-id="${id}">${edit ? 'Fine' : 'Modifica'}</button>` });
  if (!edit) {
    h += `<p class="date-sub">${DOW[w.day]}${w.legs ? ' · coinvolge le gambe' : ''}</p>`;
    if (w.note) h += `<div class="note">${esc(w.note)}</div>`;
    h += `<div class="list">`;
    w.ex.forEach(e => {
      const sg = suggestion(e, today());
      h += `<div class="li ex-li"><div><b>${esc(e.n)}</b><span>${e.sets} × ${e.repMin === e.repMax ? e.repMin : e.repMin + '-' + e.repMax}${e.unit === 'sec' ? ' s' : ''}${e.side ? ' per lato' : ''} · rec. ${fmtRest(e.rest)}</span>${sg.w != null ? `<span class="sg ${sg.kind}">Prossima: ${fmtKg(sg.w)} kg</span>` : ''}</div></div>`;
    });
    h += `</div>`;
    const nextK = (() => { for (let i = 0; i < 8; i++) { const k = addDays(today(), i); const p = planned(k); if (p && p.w.id === w.id) return k; } return null; })();
    h += `<div class="stack">${btn('Inizia adesso', 'startNow', `data-id="${id}"`, 'primary full')}</div>`;
    if (nextK) h += `<p class="muted center sm">Prossima in calendario: ${fmtDate(nextK)}</p>`;
    return h;
  }
  h += `<div class="card form">
    <label>Nome<input data-c="wName" data-id="${id}" value="${esc(w.n)}"></label>
    <label>Giorno<select data-c="wDay" data-id="${id}">${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}" ${w.day === d ? 'selected' : ''}>${DOW[d]}</option>`).join('')}</select></label>
    <label class="sw">Coinvolge le gambe<input type="checkbox" data-c="wLegs" data-id="${id}" ${w.legs ? 'checked' : ''}></label>
    <label>Se sono stanco<select data-c="wFat" data-id="${id}"><option value="none" ${w.fatigue === 'none' ? 'selected' : ''}>Nessun adattamento</option><option value="sets" ${w.fatigue === 'sets' ? 'selected' : ''}>Togli una serie</option><option value="weight" ${w.fatigue === 'weight' ? 'selected' : ''}>Pesi −7,5%</option></select></label>
    <label>Nota<textarea data-c="wNote" data-id="${id}" rows="2">${esc(w.note)}</textarea></label></div>`;
  w.ex.forEach((e, i) => {
    h += `<div class="card form ex-edit"><div class="ex-edit-h"><input class="ex-name" data-c="eF" data-f="n" data-id="${e.id}" value="${esc(e.n)}">
      <button class="icon-btn sm" data-a="moveEx" data-id="${e.id}" data-d="-1" ${i === 0 ? 'disabled' : ''}>${I.up}</button><button class="icon-btn sm" data-a="moveEx" data-id="${e.id}" data-d="1" ${i === w.ex.length - 1 ? 'disabled' : ''}>${I.down}</button><button class="icon-btn sm red" data-a="delEx" data-id="${e.id}">${I.trash}</button></div>
      <div class="grid4">
      <label>Serie<input inputmode="numeric" data-c="eF" data-f="sets" data-id="${e.id}" value="${e.sets}"></label>
      <label>Min<input inputmode="numeric" data-c="eF" data-f="repMin" data-id="${e.id}" value="${e.repMin}"></label>
      <label>Max<input inputmode="numeric" data-c="eF" data-f="repMax" data-id="${e.id}" value="${e.repMax}"></label>
      <label>Unità<select data-c="eF" data-f="unit" data-id="${e.id}"><option value="rip" ${e.unit === 'rip' ? 'selected' : ''}>rip</option><option value="sec" ${e.unit === 'sec' ? 'selected' : ''}>sec</option></select></label>
      <label>Recupero (s)<input inputmode="numeric" data-c="eF" data-f="rest" data-id="${e.id}" value="${e.rest}"></label>
      <label>+kg<input inputmode="decimal" data-c="eF" data-f="inc" data-id="${e.id}" value="${fmtKg(e.inc)}"></label>
      <label class="sw2">Per lato<input type="checkbox" data-c="eF" data-f="side" data-id="${e.id}" ${e.side ? 'checked' : ''}></label></div>
      <label>Nota<input data-c="eF" data-f="note" data-id="${e.id}" value="${esc(e.note)}"></label></div>`;
  });
  h += `<div class="stack">${btn(`${I.plus} Aggiungi esercizio`, 'addEx', `data-id="${id}"`, 'tinted full')}${btn('Elimina allenamento', 'delWorkout', `data-id="${id}"`, 'tinted red full')}</div>`;
  return h;
}

function vSession(k) {
  const p = planned(k); const s = S.logs.sessions[k] || {}; let exs = sessionExercises(k);
  if (!exs.length && s.sets) exs = Object.keys(s.sets).map(id => exById(id)).filter(Boolean).map(f => ({ e: f.e, w: f.w, weightFactor: 1 }));
  const w = p ? p.w : wById(s.wid);
  let h = header(esc(w ? w.n : 'Allenamento'), { back: true });
  h += `<p class="date-sub">${fmtDate(k)}${p && p.mode !== 'normal' ? ` · ${p.mode === 'reduced' ? 'versione ridotta' : 'express'}` : ''}</p>`;
  if (w && w.fatigue !== 'none') {
    h += `<label class="card slim sw fat">${w.fatigue === 'sets' ? 'Gambe stanche dal judo: togli una serie' : 'Stanco dal judo: pesi −7,5%'}<input type="checkbox" data-c="fatigue" data-k="${k}" ${s.fatigue ? 'checked' : ''}></label>`;
  }
  if (w && w.note) h += `<div class="note">${esc(w.note)}</div>`;
  exs.forEach(({ e, extra, weightFactor }) => {
    const sg = suggestion(e, k, weightFactor); const logged = (s.sets && s.sets[e.id]) || [];
    const u = e.unit === 'sec' ? 's' : 'rip';
    h += `<div class="card exc"><div class="exc-h"><div><b>${esc(e.n)}</b><span>${e.sets} × ${e.repMin === e.repMax ? e.repMin : e.repMin + '-' + e.repMax} ${u}${e.side ? ' per lato' : ''} · rec. ${fmtRest(e.rest)}</span>${extra ? `<span class="tag">recupero da ${fmtShort(extra)}</span>` : ''}</div></div>
      <div class="sg-box ${sg.kind}">${sg.kind === 'up' ? I.up : ''}${esc(sg.text)}${sg.last ? `<small>Ultima (${fmtShort(sg.last.k)}): ${sg.last.sets.map(x => `${fmtKg(x.w)}×${x.r}`).join(', ')}</small>` : ''}</div>
      ${e.note ? `<p class="muted sm">${esc(e.note)}</p>` : ''}
      <div class="sets"><div class="set-h"><span>Serie</span><span>kg</span><span>${u}</span><span></span></div>`;
    for (let i = 0; i < e.sets; i++) {
      const x = logged[i] || {}; const ok = x.r > 0;
      h += `<div class="set ${ok ? 'ok' : ''}"><span class="sn">${i + 1}</span>
        <input inputmode="decimal" placeholder="${sg.w != null ? fmtKg(sg.w) : 'kg'}" value="${x.w != null && x.w !== '' ? fmtKg(x.w) : ''}" data-c="setW" data-k="${k}" data-e="${e.id}" data-i="${i}">
        <input inputmode="numeric" placeholder="${e.repMax}" value="${x.r || ''}" data-c="setR" data-k="${k}" data-e="${e.id}" data-i="${i}">
        <button class="chk" data-a="setOk" data-k="${k}" data-e="${e.id}" data-i="${i}" data-rest="${e.rest}">${I.check}</button></div>`;
    }
    h += `</div></div>`;
  });
  h += `<div class="card form"><label>Note sulla seduta<textarea rows="2" data-c="sNotes" data-k="${k}" placeholder="Sensazioni, dolori, energia…">${esc(s.notes || '')}</textarea></label></div>`;
  if (s.status !== 'done') h += `<div class="stack">${btn('Completa allenamento', 'finishSession', `data-k="${k}"`, 'primary full')}${s.status !== 'skipped' && p ? btn('Segna come saltato', 'skipWorkout', `data-k="${k}"`, 'tinted red full') : ''}</div>`;
  else h += `<div class="done-row center">${I.check} Allenamento completato</div>${btn('Riapri', 'reopenSession', `data-k="${k}"`, 'tinted full')}`;
  return h;
}

/* ---- dieta ---- */
function vDiet() {
  const k = UI.dietDate; const meals = dietDay(k); const l = peekDlog(k); const tot = dayTotals(k);
  let h = header('Dieta', { right: `<button class="txt-btn" data-a="editDiet">Modifica</button>` });
  h += `<div class="daynav"><button class="icon-btn" data-a="dietDay" data-d="-1">${I.back}</button><div><b>${k === today() ? 'Oggi' : DOW[dow(k)]}</b><span>${fmtDate(k)}</span></div><button class="icon-btn" data-a="dietDay" data-d="1"><i class="flip">${I.back}</i></button></div>`;
  const pct = tot.plan.k ? tot.eaten.k / tot.plan.k : 0;
  h += `<div class="card macro-card">${ring(tot.eaten.k, tot.plan.k, 104, 10, 'var(--green)', `<b>${Math.round(tot.eaten.k)}</b><span>/${Math.round(tot.plan.k)} kcal</span>`)}
    <div class="macros">${[['Proteine', 'p', 'var(--blue)'], ['Carboidrati', 'c', 'var(--orange)'], ['Grassi', 'f', 'var(--pink)']].map(([n, m, c]) => `<div><span>${n}</span><div class="bar thin"><i style="width:${Math.min(100, tot.plan[m] ? tot.eaten[m] / tot.plan[m] * 100 : 0)}%;background:${c}"></i></div><small>${Math.round(tot.eaten[m])} / ${Math.round(tot.plan[m])} g</small></div>`).join('')}</div></div>`;
  h += `<p class="muted sm center">Valori nutrizionali indicativi, calcolati con medie standard degli alimenti.</p>`;
  meals.forEach(m => {
    const st = l.m[m.id]; const mm = mealMacros(k, m);
    h += `<div class="card meal ${st || ''}"><div class="meal-h"><div><b>${esc(m.n)}</b><span>${Math.round(mm.k)} kcal · ${Math.round(mm.p)} g prot.</span></div>
      <div class="meal-act">${st === 'done' ? `<button class="round ok" data-a="mealUndo" data-k="${k}" data-m="${m.id}">${I.check}</button>` : st === 'skip' ? `<button class="round sk" data-a="mealUndo" data-k="${k}" data-m="${m.id}">${I.x}</button>` : `<button class="round" data-a="mealSkip" data-k="${k}" data-m="${m.id}">${I.x}</button><button class="round go" data-a="mealDone" data-k="${k}" data-m="${m.id}">${I.check}</button>`}</div></div>`;
    if (st === 'skip' && l.rec && l.rec[m.id]) h += `<p class="rec-note">Saltato · ${esc(l.rec[m.id])}</p>`;
    h += `<div class="items">`;
    m.items.forEach(it => {
      const opt = chosenOpt(k, it); const adj = (l.adj || {})[it.id];
      h += `<button class="item" data-a="${it.o.length > 1 ? 'pickAlt' : ''}" data-k="${k}" data-m="${m.id}" data-i="${it.id}"><span>${esc(optLabel(opt))}${adj ? ` <em class="adj">+${adj} ${opt[0].u === 'ml' ? 'ml' : 'g'}</em>` : ''}</span>${it.o.length > 1 ? `<i class="alt">${it.o.length - 1} alternative ${I.chev}</i>` : ''}</button>`;
    });
    h += `</div></div>`;
  });
  (l.extra || []).forEach(x => {
    h += `<div class="card meal extra ${x.done ? 'done' : ''}"><div class="meal-h"><div><b>${esc(x.n)}</b><span>${Math.round(extraMacros(x).k)} kcal</span></div><div class="meal-act"><button class="round ${x.done ? 'ok' : 'go'}" data-a="extraDone" data-k="${k}" data-id="${x.id}">${I.check}</button><button class="round" data-a="extraDel" data-k="${k}" data-id="${x.id}">${I.trash}</button></div></div><div class="items"><div class="item"><span>${esc(optLabel(x.parts))}</span></div></div></div>`;
  });
  return h;
}

function vDietEdit() {
  const d = UI.editDietDay ?? 1;
  let h = header('Modifica dieta', { back: true });
  h += `<div class="seg">${[1, 2, 3, 4, 5, 6, 0].map(x => `<button class="${x === d ? 'on' : ''}" data-a="editDietDay" data-d="${x}">${DOW3[x]}</button>`).join('')}</div>`;
  h += `<div class="note">Tocca un alimento per modificarlo. Ogni riga è un'alternativa: la prima è quella principale. Per gli abbinamenti usa il <b>+</b> (es. <i>Carne di cavallo 190 + Grana 20</i>).</div>`;
  const meals = S.diet.days[d] || (S.diet.days[d] = []);
  meals.forEach((m, mi) => {
    h += `<div class="card form"><div class="ex-edit-h"><input class="ex-name" data-c="mealName" data-d="${d}" data-m="${m.id}" value="${esc(m.n)}">
      <button class="icon-btn sm" data-a="moveMeal" data-d="${d}" data-m="${m.id}" data-dir="-1" ${mi === 0 ? 'disabled' : ''}>${I.up}</button><button class="icon-btn sm" data-a="moveMeal" data-d="${d}" data-m="${m.id}" data-dir="1" ${mi === meals.length - 1 ? 'disabled' : ''}>${I.down}</button><button class="icon-btn sm red" data-a="delMeal" data-d="${d}" data-m="${m.id}">${I.trash}</button></div>
      <div class="items">${m.items.map(it => `<button class="item" data-a="editItem" data-d="${d}" data-m="${m.id}" data-i="${it.id}"><span>${esc(optLabel(it.o[0]))}${it.o.length > 1 ? `<small> · oppure ${it.o.slice(1).map(o => esc(optLabel(o))).join(' / ')}</small>` : ''}</span><i class="alt">${I.edit}</i></button>`).join('')}
      <button class="item add" data-a="addItem" data-d="${d}" data-m="${m.id}">${I.plus} Aggiungi alimento</button></div></div>`;
  });
  h += `<div class="stack">${btn(`${I.plus} Aggiungi pasto`, 'addMeal', `data-d="${d}"`, 'tinted full')}${btn('Copia questo giorno su…', 'copyDay', `data-d="${d}"`, 'tinted full')}</div>`;
  return h;
}

/* ---- acqua ---- */
function vWater() {
  const k = today(); const tot = waterTotal(k); const g = S.settings.waterGoal; const left = Math.max(0, g - tot);
  let h = header('Acqua');
  h += `<div class="water-hero">${ring(tot, g, 210, 16, 'url(#wg)', `<b>${fmtL(tot)}</b><span>di ${fmtL(g)}</span>`).replace('<svg ', '<svg ').replace('</svg>', '<defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#64D2FF"/><stop offset="1" stop-color="#0A84FF"/></linearGradient></defs></svg>')}
    <p class="muted center">${left ? `Ti mancano ${fmtL(left)}` : 'Obiettivo raggiunto 💧'}</p></div>`;
  h += `<div class="seg two"><button class="${!UI.waterHalf ? 'on' : ''}" data-a="waterHalf" data-v="0">Intero</button><button class="${UI.waterHalf ? 'on' : ''}" data-a="waterHalf" data-v="1">Metà</button></div>`;
  h += `<div class="containers">${S.settings.containers.map(c => `<button class="cont" data-a="drink" data-id="${c.id}">${containerIcon(c.kind)}<b>${esc(c.n)}</b><span>${UI.waterHalf ? '½ · ' + c.ml / 2 : c.ml} ml</span></button>`).join('')}</div>`;
  const entries = (S.logs.water[k] || []).slice().reverse();
  if (entries.length) {
    h += `<p class="section-t">Oggi</p><div class="list">${entries.map((x, i) => `<div class="li"><div><b>${esc(x.n)}</b><span>${x.t}</span></div><div class="li-r"><em>+${x.ml} ml</em><button class="icon-btn sm" data-a="undrink" data-idx="${entries.length - 1 - i}">${I.trash}</button></div></div>`).join('')}</div>`;
  }
  // settimana
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(k, -i));
  const mx = Math.max(g, ...days.map(waterTotal));
  h += `<p class="section-t">Ultimi 7 giorni</p><div class="card"><div class="bars">${days.map(d => { const v = waterTotal(d); return `<div class="bcol"><div class="btrack"><i style="height:${v / mx * 100}%" class="${v >= g ? 'ok' : ''}"></i><span class="gl" style="bottom:${g / mx * 100}%"></span></div><small>${DOW3[dow(d)].slice(0, 1)}</small></div>`; }).join('')}</div></div>`;
  return h;
}

/* ---- progressi ---- */
function vProg() {
  let h = header('Progressi');
  h += `<div class="card meet" data-a="meeting">${SPARK}<div><b>Meeting with Claude</b><span>${meetingDue() ? 'È il momento del punto periodico' : `Prossimo tra ${S.settings.meetingEvery - daysBetween(S.settings.lastMeeting || S.settings.startDate, today())} giorni · puoi aprirlo quando vuoi`}</span></div><i class="chev">${I.chev}</i></div>`;
  const wk = Object.keys(S.logs.weight).sort(); const last = wk.length ? S.logs.weight[wk[wk.length - 1]] : null;
  h += `<p class="section-t">Peso corporeo</p><div class="card">
    <div class="wt-row"><div><b class="big">${last != null ? fmtKg(last) : '–'}</b><span class="muted"> kg</span>${wk.length > 1 ? `<span class="delta ${last - S.logs.weight[wk[0]] >= 0 ? 'pos' : 'neg'}">${last - S.logs.weight[wk[0]] >= 0 ? '+' : ''}${fmtKg(last - S.logs.weight[wk[0]])} kg dall'inizio</span>` : ''}</div>
    <div class="wt-in"><input inputmode="decimal" id="wIn" placeholder="${S.logs.weight[today()] != null ? fmtKg(S.logs.weight[today()]) : 'kg oggi'}">${btn('Salva', 'saveWeight', '', 'primary sm')}</div></div>
    ${lineChart(wk.map(x => ({ x, y: S.logs.weight[x] })), { goal: S.settings.weightGoal, unit: ' kg' })}
    <p class="muted sm">Pesati sempre nelle stesse condizioni (mattina, a digiuno). Per la massa conta l'andamento sulle settimane, non il singolo giorno.</p></div>`;
  // esercizi
  const all = S.workouts.flatMap(w => w.ex.map(e => ({ e, w })));
  const sel = UI.progEx || (all[0] && all[0].e.id);
  const f = exById(sel);
  h += `<p class="section-t">Carichi per esercizio</p><div class="card"><select class="full-sel" data-c="progEx">${S.workouts.map(w => `<optgroup label="${esc(w.n)}">${w.ex.map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.n)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  if (f) {
    const hist = exHistory(sel).reverse();
    h += lineChart(hist.map(x => ({ x: x.k, y: topW(x.sets) })), { unit: ' kg' });
    if (hist.length) { const a = topW(hist[0].sets), b = topW(hist[hist.length - 1].sets); h += `<p class="muted sm">Da ${fmtKg(a)} a ${fmtKg(b)} kg in ${hist.length} sedute${b > a ? ` · <span class="pos">+${fmtKg(b - a)} kg</span>` : ''}.</p>`; }
  }
  h += `</div>`;
  // costanza
  const t = today(); let gp = 0, gd = 0, mt = 0, md = 0, wo = 0;
  for (let i = 1; i <= 28; i++) {
    const d = addDays(t, -i); if (d < S.settings.startDate) break;
    const p = planned(d); const s = S.logs.sessions[d]; if (p) { gp++; if (s && s.status === 'done') gd++; }
    const l = peekDlog(d); dietDay(d).forEach(m => { mt++; if (l.m[m.id] === 'done') md++; });
    if (waterTotal(d) >= S.settings.waterGoal) wo++;
  }
  const days = Math.min(28, Math.max(0, daysBetween(S.settings.startDate, t)));
  h += `<p class="section-t">Costanza (ultime 4 settimane)</p><div class="card stats">
    ${[['Allenamenti', gp ? gd / gp : 0, `${gd}/${gp}`, 'var(--blue)'], ['Pasti', mt ? md / mt : 0, `${md}/${mt}`, 'var(--green)'], ['Acqua ok', days ? wo / days : 0, `${wo}/${days} gg`, 'var(--cyan)']].map(([n, v, s, c]) => `<div>${ring(v, 1, 76, 8, c, `<b class="sm">${Math.round(v * 100)}%</b>`)}<span>${n}</span><small>${s}</small></div>`).join('')}</div>`;
  if (!days) h += `<p class="muted sm center">Le statistiche partono da domani: oggi è il tuo primo giorno con Forma.</p>`;
  return h;
}

function vMeeting() {
  let h = header('Meeting with Claude', { back: true });
  const rep = buildReport();
  h += `<div class="meet-hero">${SPARK}<h2>Il tuo punto periodico</h2><p class="muted">Ho preparato il report del periodo. Aprilo in Claude e parliamo di com'è andata, cosa migliorare e come essere più costante.</p></div>`;
  h += `<div class="stack">${btn('Copia report e apri Claude', 'openClaude', '', 'primary full')}${btn('Solo copia il report', 'copyReport', '', 'tinted full')}</div>`;
  h += `<p class="section-t">Anteprima report</p><pre class="report">${esc(rep)}</pre>`;
  h += `<div class="stack">${btn('Segna meeting come fatto', 'meetingDone', '', 'tinted full')}</div>`;
  return h;
}

function vSettings() {
  const st = S.settings;
  let h = header('Impostazioni', { back: true });
  h += `<p class="section-t">Acqua</p><div class="card form"><label>Obiettivo giornaliero (ml)<input inputmode="numeric" data-c="setGoal" value="${st.waterGoal}"></label></div>`;
  h += `<div class="card form">${st.containers.map(c => `<div class="cont-edit"><input data-c="contN" data-id="${c.id}" value="${esc(c.n)}"><input inputmode="numeric" data-c="contMl" data-id="${c.id}" value="${c.ml}"><span>ml</span><button class="icon-btn sm red" data-a="delCont" data-id="${c.id}">${I.trash}</button></div>`).join('')}${btn(`${I.plus} Aggiungi contenitore`, 'addCont', '', 'tinted full')}</div>`;
  h += `<p class="section-t">Judo e obiettivi</p><div class="card form"><div class="seg">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="${st.judoDays.includes(d) ? 'on' : ''}" data-a="toggleJudo" data-d="${d}">${DOW3[d]}</button>`).join('')}</div>
    <label>Peso obiettivo (kg)<input inputmode="decimal" data-c="setWGoal" value="${fmtKg(st.weightGoal)}"></label>
    <label>Meeting with Claude ogni (giorni)<input inputmode="numeric" data-c="setMeet" value="${st.meetingEvery}"></label></div>`;
  h += `<p class="section-t">Dati</p><div class="card form stack">
    ${btn('Esporta backup (.json)', 'exportAll', '', 'tinted full')}
    <label class="btn tinted full file">Importa backup<input type="file" accept=".json,application/json" data-c="importAll" hidden></label>
    <label class="btn tinted full file">Importa nuovo piano dieta<input type="file" accept=".json,application/json" data-c="importDiet" hidden></label>
    <p class="muted sm">Il piano dieta attuale: <b>${esc(S.diet.name || '')}</b>. I nuovi piani del nutrizionista: mandali a Claude e ricevi un file da importare qui.</p>
    ${btn('Ripristina scheda originale', 'resetWorkouts', '', 'tinted red full')}
    ${btn('Cancella tutti i dati', 'resetAll', '', 'tinted red full')}</div>
    <p class="muted sm center">Forma · dati salvati solo su questo iPhone</p>`;
  return h;
}

/* ---------- render ---------- */
function render() {
  const main = $('#main'); let h = '';
  const v = UI.view;
  if (v) {
    if (v.t === 'session') h = vSession(v.k);
    else if (v.t === 'workout') h = vWorkout(v.id, v.edit);
    else if (v.t === 'dietEdit') h = vDietEdit();
    else if (v.t === 'meeting') h = vMeeting();
    else if (v.t === 'settings') h = vSettings();
  } else {
    h = { today: vToday, gym: vGym, diet: vDiet, water: vWater, prog: vProg }[UI.tab]();
  }
  main.innerHTML = h;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === UI.tab));
}
function go(view) { UI.view = view; render(); window.scrollTo(0, 0); }

/* ---------- sheet / toast ---------- */
function sheet(html) {
  const s = $('#sheet'); s.querySelector('.sheet-body').innerHTML = html;
  s.classList.add('open'); document.body.classList.add('noscroll');
}
function closeSheet() { const s = $('#sheet'); s.classList.remove('open'); document.body.classList.remove('noscroll'); setTimeout(() => { if (!s.classList.contains('open')) s.querySelector('.sheet-body').innerHTML = ''; }, 400); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

/* timer recupero */
let restT = null, restEnd = 0;
function startRest(sec) {
  clearInterval(restT); restEnd = Date.now() + sec * 1000; const el = $('#rest'); el.classList.add('show');
  const tick = () => {
    const left = Math.max(0, Math.round((restEnd - Date.now()) / 1000));
    el.querySelector('b').textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
    el.querySelector('i').style.width = `${(left / sec) * 100}%`;
    if (!left) { clearInterval(restT); el.querySelector('b').textContent = 'Vai!'; if (navigator.vibrate) navigator.vibrate(300); setTimeout(() => el.classList.remove('show'), 2500); }
  };
  tick(); restT = setInterval(tick, 500);
}

/* ---------- parsing testo alimenti ---------- */
function matchFood(name) {
  const s = name.toLowerCase(); let best = null, bl = 0;
  for (const [key, f] of Object.entries(FOODS)) for (const a of f.a) if (s.includes(a) && a.length > bl) { best = key; bl = a.length; }
  return best;
}
function parsePart(txt) {
  const t = txt.trim().replace(/\s+/g, ' '); if (!t) return null;
  let m = t.match(/^(.*?)\s*\(?(\d+(?:[.,]\d+)?)\s*(grammi|gr|g|ml|pz|uova)?\b\)?\s*(.*)$/i);
  let name, g, u = 'g';
  const first = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:(grammi|gr|g|ml|pz)\b)?\s*(?:di\s+)?(.+)$/i);
  if (first) { g = num(first[1]); u = (first[2] || '').toLowerCase(); name = first[3]; if (!u) u = /uov/i.test(name) ? 'pz' : 'g'; }
  else if (m && m[1]) { name = (m[1] + ' ' + (m[4] || '')).trim(); g = num(m[2]); u = (m[3] || 'g').toLowerCase(); }
  else { name = t; g = 0; }
  if (u === 'gr' || u === 'grammi') u = 'g'; if (u === 'uova') u = 'pz';
  name = name.replace(/\s*-\s*$/, '').trim();
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return { n: name, f: matchFood(name), g: g || 0, u };
}
const parseOptLine = line => line.split('+').map(parsePart).filter(Boolean);
const optToLine = opt => opt.map(pt => `${pt.n} ${pt.g}${pt.u === 'g' ? '' : ' ' + pt.u}`).join(' + ');

/* ---------- azioni ---------- */
function findMeal(d, mid) { return (S.diet.days[d] || []).find(m => m.id === mid); }
function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* niente */ } ta.remove(); return ok;
  }
}
let pendingRecovery = null;

const A = {
  tab: el => { UI.tab = el.dataset.t; UI.view = null; if (UI.tab === 'diet') UI.dietDate = today(); render(); window.scrollTo(0, 0); },
  back: () => { const v = UI.view; if (v && v.t === 'workout' && v.edit) { v.edit = false; render(); return; } go(null); },
  settings: () => go({ t: 'settings' }),
  meeting: () => go({ t: 'meeting' }),
  openSession: el => go({ t: 'session', k: el.dataset.k }),
  openWorkout: el => go({ t: 'workout', id: el.dataset.id, edit: false }),
  toggleEditW: el => { UI.view.edit = !UI.view.edit; render(); },
  startNow: el => {
    const t = today(); const p = planned(t); const id = el.dataset.id;
    if (p && p.w.id !== id && S.logs.sessions[t] && S.logs.sessions[t].status === 'done') { toast('Oggi hai già completato un allenamento'); return; }
    if (!p || p.w.id !== id) S.logs.overrides[t] = { wid: id, mode: 'normal', from: t };
    save(); go({ t: 'session', k: t });
  },
  skipWorkout: el => {
    const k = el.dataset.k; const opts = recoveryOptions(k); pendingRecovery = { k, opts };
    const p = planned(k);
    sheet(`<h3>Hai saltato ${esc(p.w.n)}</h3><p class="muted">Nessun problema. Ecco come recuperarlo, tenendo conto del judo e dei muscoli già allenati:</p>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-a="pickRecovery" data-i="${i}"><b>${esc(o.title)}</b><span>${o.desc}</span></button>`).join('')}</div>`);
  },
  pickRecovery: el => {
    const { k, opts } = pendingRecovery; const o = opts[+el.dataset.i];
    applyRecovery(k, o); closeSheet();
    toast(o.type === 'move' ? `Spostato a ${relDay(o.date)}` : o.type === 'merge' ? 'Aggiunto alla prossima seduta' : 'Ok, si riparte dalla prossima');
    if (UI.view && UI.view.t === 'session') go(null); else render();
  },
  setOk: el => {
    const { k, e, i } = el.dataset; const s = S.logs.sessions[k] || (S.logs.sessions[k] = { wid: (planned(k) || {}).w?.id, status: 'progress', sets: {} });
    s.sets ||= {}; const arr = s.sets[e] || (s.sets[e] = []); const idx = +i; const cur = arr[idx] || {};
    if (cur.r > 0) { arr[idx] = { w: cur.w, r: 0 }; save(); render(); return; }
    const row = el.closest('.set'); const wIn = row.querySelectorAll('input')[0], rIn = row.querySelectorAll('input')[1];
    const prev = arr[idx - 1] || {};
    const w = num(wIn.value) ?? prev.w ?? num(wIn.placeholder) ?? 0; const r = num(rIn.value) ?? prev.r ?? num(rIn.placeholder);
    arr[idx] = { w, r }; if (s.status !== 'done') s.status = 'progress'; save();
    const y = window.scrollY; render(); window.scrollTo(0, y); startRest(+el.dataset.rest || 90);
  },
  finishSession: el => {
    const k = el.dataset.k; const s = S.logs.sessions[k] || (S.logs.sessions[k] = { sets: {} });
    const p = planned(k); s.wid = s.wid || (p && p.w.id); s.status = 'done'; save();
    const ups = sessionExercises(k).map(({ e }) => ({ e, sg: suggestion(e, addDays(k, 1)) })).filter(x => x.sg.kind === 'up');
    go(null);
    sheet(`<h3>Allenamento completato 💪</h3>${ups.length ? `<p class="muted">La prossima volta aumenti su:</p><div class="list">${ups.map(x => `<div class="li"><b>${esc(x.e.n)}</b><em class="pos">${fmtKg(x.sg.w)} kg</em></div>`).join('')}</div>` : '<p class="muted">Registrato. Continua così: la costanza è ciò che fa crescere.</p>'}${btn('Chiudi', 'closeSheet', '', 'primary full')}`);
  },
  reopenSession: el => { const s = S.logs.sessions[el.dataset.k]; if (s) s.status = 'progress'; save(); render(); },
  closeSheet: () => closeSheet(),

  newWorkout: () => {
    const used = S.workouts.map(w => w.day); const day = [4, 0, 1, 2, 3, 5, 6].find(d => !used.includes(d) && !S.settings.judoDays.includes(d)) ?? 0;
    const w = { id: uid(), n: 'Nuovo allenamento', day, legs: false, fatigue: 'none', note: '', ex: [] }; S.workouts.push(w); save(); go({ t: 'workout', id: w.id, edit: true });
  },
  addEx: el => { const w = wById(el.dataset.id); w.ex.push({ id: uid(), n: 'Nuovo esercizio', sets: 3, repMin: 8, repMax: 12, rest: 90, inc: 2.5, unit: 'rip', side: false, note: '' }); save(); render(); },
  delEx: el => { const f = exById(el.dataset.id); if (f && confirm(`Eliminare ${f.e.n}?`)) { f.w.ex = f.w.ex.filter(e => e.id !== f.e.id); save(); render(); } },
  moveEx: el => { const f = exById(el.dataset.id); const a = f.w.ex; const i = a.indexOf(f.e); const j = i + +el.dataset.d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(); render(); },
  delWorkout: el => { const w = wById(el.dataset.id); if (confirm(`Eliminare ${w.n}? Lo storico resta.`)) { S.workouts = S.workouts.filter(x => x.id !== w.id); save(); go(null); } },

  mealDone: el => { const l = dlog(el.dataset.k); l.m[el.dataset.m] = 'done'; save(); render(); },
  mealUndo: el => { const l = dlog(el.dataset.k); delete l.m[el.dataset.m]; if (l.rec) delete l.rec[el.dataset.m]; save(); render(); },
  mealSkip: el => {
    const k = el.dataset.k, mid = el.dataset.m; const m = dietDay(k).find(x => x.id === mid); const mm = mealMacros(k, m);
    const opts = recoverMealOptions(k, mid); pendingRecovery = { k, mid, opts };
    sheet(`<h3>Hai saltato ${esc(m.n.toLowerCase())}</h3><p class="muted">Ti mancano circa <b>${Math.round(mm.k)} kcal</b> e <b>${Math.round(mm.p)} g di proteine</b>. Per la massa conviene recuperarle:</p>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-a="pickMealRec" data-i="${i}"><b>${esc(o.title)}</b><span>${o.desc}</span></button>`).join('')}</div>
      <p class="muted sm">Proposte calcolate su valori medi: se il nutrizionista ti ha dato regole per i pasti saltati, valgono le sue.</p>`);
  },
  pickMealRec: el => { const { k, mid, opts } = pendingRecovery; const o = opts[+el.dataset.i]; applyMealRecovery(k, mid, o); closeSheet(); toast(o.type === 'none' ? 'Segnato come saltato' : 'Piano aggiornato'); render(); },
  extraDone: el => { const l = dlog(el.dataset.k); const x = l.extra.find(e => e.id === el.dataset.id); if (x) x.done = !x.done; save(); render(); },
  extraDel: el => { const l = dlog(el.dataset.k); l.extra = l.extra.filter(e => e.id !== el.dataset.id); save(); render(); },
  pickAlt: el => {
    const { k, m, i } = el.dataset; const item = dietDay(k).find(x => x.id === m).items.find(x => x.id === i); const cur = (peekDlog(k).c || {})[i] || 0;
    sheet(`<h3>Scegli l'alternativa</h3><div class="opts">${item.o.map((o, idx) => { const mm = o.reduce((a, pt) => addM(a, partMacros(pt)), ZERO); return `<button class="opt ${idx === cur ? 'sel' : ''}" data-a="setAlt" data-k="${k}" data-i="${i}" data-idx="${idx}"><b>${esc(optLabel(o))}</b><span>${Math.round(mm.k)} kcal · ${Math.round(mm.p)} g prot.${idx === 0 ? ' · principale' : ''}</span></button>`; }).join('')}</div>`);
  },
  setAlt: el => { const l = dlog(el.dataset.k); l.c[el.dataset.i] = +el.dataset.idx; save(); closeSheet(); render(); },
  dietDay: el => { UI.dietDate = addDays(UI.dietDate, +el.dataset.d); render(); },
  editDiet: () => { UI.editDietDay = dow(UI.dietDate); go({ t: 'dietEdit' }); },
  editDietDay: el => { UI.editDietDay = +el.dataset.d; render(); },
  editItem: el => {
    const { d, m, i } = el.dataset; const item = findMeal(d, m).items.find(x => x.id === i);
    sheet(`<h3>Modifica alimento</h3><p class="muted sm">Una riga per alternativa: nome e grammi. Prima riga = principale.</p>
      <textarea id="itemTxt" rows="6">${esc(item.o.map(optToLine).join('\n'))}</textarea>
      <div class="row2">${btn('Elimina', 'delItem', `data-d="${d}" data-m="${m}" data-i="${i}"`, 'tinted red')}${btn('Salva', 'saveItem', `data-d="${d}" data-m="${m}" data-i="${i}"`, 'primary')}</div>`);
  },
  addItem: el => {
    const { d, m } = el.dataset; const meal = findMeal(d, m); const item = { id: uid(), o: [[{ n: 'Nuovo alimento', f: null, g: 100, u: 'g' }]] }; meal.items.push(item); save();
    A.editItem({ dataset: { d, m, i: item.id } }); setTimeout(() => { const t = $('#itemTxt'); if (t) { t.value = ''; t.focus(); } }, 50);
  },
  saveItem: el => {
    const { d, m, i } = el.dataset; const meal = findMeal(d, m); const item = meal.items.find(x => x.id === i);
    const opts = $('#itemTxt').value.split('\n').map(parseOptLine).filter(o => o.length);
    if (!opts.length) { meal.items = meal.items.filter(x => x.id !== i); } else item.o = opts;
    const unknown = opts.flat().filter(pt => !pt.f).map(pt => pt.n);
    save(); closeSheet(); render(); if (unknown.length) toast(`Valori non noti per: ${unknown.join(', ')}`);
  },
  delItem: el => { const { d, m, i } = el.dataset; const meal = findMeal(d, m); meal.items = meal.items.filter(x => x.id !== i); save(); closeSheet(); render(); },
  addMeal: el => { const d = el.dataset.d; (S.diet.days[d] ||= []).push({ id: uid(), n: 'Nuovo pasto', items: [] }); save(); render(); },
  delMeal: el => { const { d, m } = el.dataset; if (confirm('Eliminare il pasto?')) { S.diet.days[d] = S.diet.days[d].filter(x => x.id !== m); save(); render(); } },
  moveMeal: el => { const { d, m, dir } = el.dataset; const a = S.diet.days[d]; const i = a.findIndex(x => x.id === m); const j = i + +dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(); render(); },
  copyDay: el => {
    const d = +el.dataset.d;
    sheet(`<h3>Copia ${DOW[d]} su…</h3><div class="opts">${[1, 2, 3, 4, 5, 6, 0].filter(x => x !== d).map(x => `<button class="opt" data-a="doCopyDay" data-from="${d}" data-to="${x}"><b>${DOW[x]}</b><span>sostituisce i pasti di ${DOW[x].toLowerCase()}</span></button>`).join('')}</div>`);
  },
  doCopyDay: el => { const { from, to } = el.dataset; S.diet.days[to] = withIds({ days: { x: clone(S.diet.days[from]).map(m => ({ ...m, id: null, items: m.items.map(i => ({ ...i, id: null })) })) } }).days.x; save(); closeSheet(); toast(`Copiato su ${DOW[to]}`); },

  waterHalf: el => { UI.waterHalf = el.dataset.v === '1'; render(); },
  drink: el => {
    const c = S.settings.containers.find(x => x.id === el.dataset.id); const half = UI.tab === 'water' && UI.waterHalf;
    const k = today(); const now = new Date(); (S.logs.water[k] ||= []).push({ ml: half ? c.ml / 2 : c.ml, n: half ? `½ ${c.n}` : c.n, t: `${pad(now.getHours())}:${pad(now.getMinutes())}` });
    save(); render(); const tot = waterTotal(k);
    toast(tot >= S.settings.waterGoal ? 'Obiettivo acqua raggiunto 💧' : `+${half ? c.ml / 2 : c.ml} ml · totale ${fmtL(tot)}`);
  },
  undrink: el => { const k = today(); S.logs.water[k].splice(+el.dataset.idx, 1); save(); render(); },

  saveWeight: () => { const v = num($('#wIn').value); if (v == null || v < 30 || v > 250) { toast('Inserisci un peso valido'); return; } S.logs.weight[today()] = v; save(); render(); toast('Peso salvato'); },

  openClaude: async () => {
    const rep = buildReport(); await copyText(rep);
    toast('Report copiato'); window.open('https://claude.ai/new?q=' + encodeURIComponent(rep), '_blank');
  },
  copyReport: async () => { toast((await copyText(buildReport())) ? 'Report copiato: incollalo in Claude' : 'Copia non riuscita'); },
  meetingDone: () => { S.settings.lastMeeting = today(); S.logs.meetings.push(today()); save(); go(null); toast('Meeting segnato. Al prossimo!'); },

  toggleJudo: el => { const d = +el.dataset.d; const j = S.settings.judoDays; S.settings.judoDays = j.includes(d) ? j.filter(x => x !== d) : [...j, d]; save(); render(); },
  addCont: () => { S.settings.containers.push({ id: uid(), n: 'Contenitore', ml: 330, kind: 'bottle' }); save(); render(); },
  delCont: el => { S.settings.containers = S.settings.containers.filter(c => c.id !== el.dataset.id); save(); render(); },
  exportAll: () => download(`forma-backup-${today()}.json`, JSON.stringify(S, null, 1)),
  resetWorkouts: () => { if (confirm('Ripristinare la scheda originale? Lo storico resta.')) { S.workouts = clone(DEFAULT_WORKOUTS); save(); toast('Scheda ripristinata'); } },
  resetAll: () => { if (confirm('Cancellare TUTTI i dati? Esporta prima un backup.') && confirm('Sicuro? Non si può annullare.')) { S = defaults(); save(); go(null); } },
};

const C = {
  setW: el => setField(el, 'w', num(el.value)),
  setR: el => setField(el, 'r', num(el.value)),
  fatigue: el => { const k = el.dataset.k; const s = S.logs.sessions[k] || (S.logs.sessions[k] = { wid: planned(k).w.id, status: 'progress', sets: {} }); s.fatigue = el.checked; save(); render(); },
  sNotes: el => { const k = el.dataset.k; const s = S.logs.sessions[k] || (S.logs.sessions[k] = { wid: (planned(k) || {}).w?.id, status: 'progress', sets: {} }); s.notes = el.value; save(); },
  wName: el => { wById(el.dataset.id).n = el.value || 'Allenamento'; save(); },
  wDay: el => {
    const w = wById(el.dataset.id); const d = +el.value; const other = S.workouts.find(x => x.day === d && x.id !== w.id);
    if (other) { other.day = w.day; toast(`${other.n} spostato a ${DOW[w.day]}`); } w.day = d; save();
  },
  wLegs: el => { wById(el.dataset.id).legs = el.checked; save(); },
  wFat: el => { wById(el.dataset.id).fatigue = el.value; save(); },
  wNote: el => { wById(el.dataset.id).note = el.value; save(); },
  eF: el => {
    const f = exById(el.dataset.id); const k = el.dataset.f; let v;
    if (k === 'side') v = el.checked; else if (k === 'n' || k === 'note' || k === 'unit') v = el.value; else v = num(el.value) ?? f.e[k];
    f.e[k] = v; if (f.e.repMin > f.e.repMax) f.e.repMax = f.e.repMin; save();
  },
  mealName: el => { findMeal(el.dataset.d, el.dataset.m).n = el.value || 'Pasto'; save(); },
  progEx: el => { UI.progEx = el.value; render(); },
  setGoal: el => { const v = num(el.value); if (v) { S.settings.waterGoal = v; save(); } },
  setWGoal: el => { const v = num(el.value); if (v) { S.settings.weightGoal = v; save(); } },
  setMeet: el => { const v = num(el.value); if (v) { S.settings.meetingEvery = Math.max(1, Math.round(v)); save(); } },
  contN: el => { S.settings.containers.find(c => c.id === el.dataset.id).n = el.value; save(); },
  contMl: el => { const v = num(el.value); if (v) { S.settings.containers.find(c => c.id === el.dataset.id).ml = v; save(); } },
  importAll: el => readJson(el, d => { if (!d.v || !d.logs) throw new Error('file non valido'); if (confirm('Sostituire tutti i dati con il backup?')) { S = d; save(); go(null); toast('Backup importato'); } }),
  importDiet: el => readJson(el, d => {
    const diet = d.days ? d : d.diet; if (!diet || !diet.days) throw new Error('piano non valido');
    if (confirm(`Importare "${diet.name || 'nuovo piano'}"? Sostituisce il piano attuale (lo storico resta).`)) { S.diet = withIds(diet); save(); render(); toast('Nuovo piano dieta importato'); }
  }),
};
function setField(el, f, v) {
  const { k, e, i } = el.dataset; const s = S.logs.sessions[k] || (S.logs.sessions[k] = { wid: (planned(k) || {}).w?.id, status: 'progress', sets: {} });
  s.sets ||= {}; const arr = s.sets[e] || (s.sets[e] = []); arr[+i] = { ...(arr[+i] || {}), [f]: v };
  if (s.status !== 'done') s.status = 'progress'; save();
  el.closest('.set').classList.toggle('ok', arr[+i].r > 0);
}
function readJson(el, fn) {
  const file = el.files[0]; if (!file) return; const r = new FileReader();
  r.onload = () => { try { fn(JSON.parse(r.result)); } catch (e) { toast('Errore: ' + e.message); } el.value = ''; };
  r.readAsText(file);
}

/* ---------- eventi ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const a = el.dataset.a; if (!a || !A[a]) return;
  e.preventDefault(); A[a](el);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-c]'); if (el && C[el.dataset.c]) C[el.dataset.c](el); });
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
$('#rest').addEventListener('click', () => { clearInterval(restT); $('#rest').classList.remove('show'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !UI.view) render(); });

render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
