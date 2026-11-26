/* SIM+EHR Student Edition — PBL cases.

   A CASE is one new patient, a clock and a decision tree. The patient is not on the census until the case
   starts. Each node of the tree has a short story (what is happening now), things it puts in the chart when
   it is reached, and one way out:

     ask    a question from the attending or the nurse, with three or four options;
     paths  work in the chart: each path has a condition (ordered, resulted, viewed, wrote a note) and may
            have a time limit in hospital hours. The first path that is satisfied is taken;
     end    the case is over: 'well', 'rocky' or 'icu'.

   Every way out has a grade (best, ok, poor, late, harm) and a one-line reason. Grades are not shown while
   playing. The debrief shows the path taken, with learning issues to take to a group; the whole tree with its
   grades opens once the learner has reached a good ending on that case (owner's decision, 2026-11-24), so the
   map is a reward for solving the case and not a walkthrough for the next attempt.

   A case can also carry `interview`: questions the learner can ask the patient (appended to the standard list
   by E.interview below) with answers that hold facts the chart does not. W.asked(question) is true once the
   learner has asked one.

   A case patient carries `sim.labs` and `sim.reports`: what a test would show if it were ordered now. A node
   can change them (`enter.truth`), so the same ECG reads differently at 13:10 and at 15:30.

   FACULTY: the cases are data at the bottom of this file and can be edited here. Timings are in
   EHR.CONFIG.cases (js/config.js). Clinical content is simplified for teaching and needs faculty review. */
(function () {
  const E = window.EHR, V = E.V, esc = E.esc, icon = E.icon;
  const CFG = () => Object.assign({ hourSeconds: 240, settle: 6 }, (E.CONFIG && E.CONFIG.cases) || {});
  const hourMs = () => CFG().hourSeconds * 1000;
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (h) => { const m = ((Math.round(h * 60) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const PARK = 'Park, Noelani MD', VAS = 'Vasquez, Elena MD', TAN = 'Tanaka, Miriam MD', RES = 'Covering resident (PGY-2)';
  const RN1 = 'Reyes, Tomas RN', RN2 = 'Lindqvist, Hana RN';
  const myCase = () => { if (!E.db || !E.db.user) return null; const a = E.progress().active; return a && a.type === 'case' && !orphan(a) ? a : null; };
  const def = (id) => E.CASES.find((c) => c.id === id);
  /** The case patient can vanish under a running case: another learner reset the ward, or new patient data
      replaced it after an update. The case cannot go on without them, so it ends here unscored (no play is
      counted) and the learner is told once, by the next case tick. Returns true if the case was ended. */
  function orphan(a) {
    const cs = def(a.id);
    if (cs && (a.node == null || cs.nodes[a.node]) && E.pt(cs.pid)) return false;   // node is null only inside caseStart, before the first enter()
    const pr = E.progress();
    if (pr.active === a) delete pr.active;
    pr.caseGone = cs ? cs.title : 'Your case';
    const m = E.ui && E.ui.modal;
    if (m && (m.type === 'caseAsk' || (m.type === 'confirm' && ['caseSkipDo', 'caseLeaveDo'].includes(m.yes)))) E.ui.modal = null;
    E.audit(`Case ended without a score: the patient was no longer on the ward (${pr.caseGone})`);
    E.save();
    return true;
  }
  const say = (text, title, glyph, tone) => { if (E.app) E.app.toast(text, title, glyph, tone); };
  const pose = (name, ms) => { if (E.pal) E.pal.pose(name, ms || 4000); };
  /** Hospital time for a running case, in hours since midnight of its first day (so it can pass 24). */
  const hosp = (a) => a.startHour + a.elapsed / hourMs();
  E.caseClock = () => { const a = myCase(); return a ? { hour: hosp(a) % 24, text: hhmm(hosp(a)), paused: !!a.paused, over: !!a.done, start: a.startHour, kind: 'case' } : null; };

  /* =====================================================================================================
     1. TESTS TELL THE TRUTH OF THE NODE
     These wrap the simulated lab, report and interview (js/sim.js) so a case patient answers from `p.sim`.
     ===================================================================================================== */
  const lab0 = E.simLab, rep0 = E.simReport, int0 = E.interview;
  E.simLab = (p, k, base) => { const t = p.sim && p.sim.labs; return t && t[k] != null ? { value: t[k], why: [] } : lab0(p, k, base); };
  E.simReport = (p, c) => {
    const own = p.sim && p.sim.reports && p.sim.reports[c.id];
    return own ? `${c.name.toUpperCase()}\nPatient: ${p.name} · MRN ${p.mrn}\nIndication: ${p.cc}\n\n${own}\n\n(Simulated report for training.)` : rep0(p, c);
  };
  /* A case patient's own questions go third, straight after "What brought you in", because the conversation
     window offers only the first four not yet asked: at the end of the list they would stay hidden until the
     learner had asked five others. js/sim.js may append them too; they are matched by text, so they are never
     listed twice. The list is renumbered, so `i` (what the Inbox thread stores) is always the position. */
  E.interview = (p) => {
    let qs = int0(p);
    const s = p.sim && p.sim.story, cs = (E.CASES || []).find((c) => c.pid === p.id), own = (cs && cs.interview) || [];
    if (s) [1, 5, 7].forEach((i, n) => { if (qs[i] && s[n]) qs[i].a = s[n]; });
    if (own.length) { qs = qs.filter((x) => !own.some((o) => o.q === x.q)); qs.splice(Math.min(2, qs.length), 0, ...own.map((o) => ({ q: o.q, a: o.a }))); }
    return qs.map((x, i) => Object.assign({}, x, { i }));
  };

  /* =====================================================================================================
     2. CONDITIONS a path can wait for. Each reads what the learner did in this patient's chart since the
     case started; wrap one in W.now(...) to count only what was done since the current node began.
     ===================================================================================================== */
  const live = (o) => !['Declined', 'Draft', 'Discontinued'].includes(o.status);
  /* Each condition carries the catalogue ids it was built with: `ids` for every order it looks at, `wait` for the
     ones it needs to reach the patient (not W.tried). The validator, the focused work-up credit and the harm
     bookkeeping read them, so nothing has to be listed twice by hand. */
  const tag = (f, ids, wait, asks) => Object.assign(f, { ids: ids || [], wait: wait || [], asks: asks || [] });
  const kids = (fs, k) => [].concat(...fs.map((f) => f[k] || []));
  const norm = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const W = {
    /** Entered an order for any of these (a student's pended order counts: it shows intent). */
    ordered: (...ids) => tag((c) => c.orders.some((o) => o.ts >= c.from && ids.includes(o.catId) && live(o)), ids, ids),
    /** One of these orders has been signed or cosigned and reached the patient. */
    active: (...ids) => tag((c) => c.orders.some((o) => o.ts >= c.from && ids.includes(o.catId) && ['Active', 'In process', 'Completed'].includes(o.status)), ids, ids),
    /** A test of the learner's has come back. */
    resulted: (...ids) => tag((c) => c.orders.some((o) => o.ts >= c.from && ids.includes(o.catId) && o.status === 'Completed' && o.resultTs), ids, ids),
    /** Tried to order one of these, even if the attending declined it or the case stopped it. For an order the
        harm rules block for a student: the attempt is the decision, and waiting for it to reach the patient
        would draw a road in the debrief that a student can never travel. */
    tried: (...ids) => tag((c) => c.orders.some((o) => o.ts >= c.from && ids.includes(o.catId) && o.status !== 'Draft'), ids),
    viewed: (label) => tag((c) => c.audit.some((x) => x.ts >= c.from && x.action === 'Viewed ' + label)),
    note: (...words) => tag((c) => c.notes.some((n) => n.ts >= c.from && words.every((w) => [].concat(w).some((alt) => n.text.toLowerCase().includes(alt))))),
    /** Asked the patient this question in the message thread (js/app.js msgAsk stores each one as
        { who: 'you', text }). Matched on the question's text, so it must be one of the case's `interview` questions;
        E.caseCheck says so if it is not. The thread is the patient's, not the learner's, but it is cleared when a
        case starts and only the learner on the case talks to that patient. */
    asked: (text) => tag((c) => (E.db.inbox || []).some((m) => m.patientId === c.p.id && (m.thread || []).some((t) => t.who === 'you' && (t.ts == null || t.ts >= c.from) && norm(t.text) === norm(text))), [], [], [text]),
    all: (...fs) => tag((c) => fs.every((f) => f(c)), kids(fs, 'ids'), kids(fs, 'wait'), kids(fs, 'asks')),
    any: (...fs) => tag((c) => fs.some((f) => f(c)), kids(fs, 'ids'), kids(fs, 'wait'), kids(fs, 'asks')),
    now: (f) => tag((c) => f(Object.assign({}, c, { from: c.nodeAt })), f.ids, f.wait, f.asks),
  };
  /** Every comparison of a name with the learner's (orders, notes, the audit trail, harm events) goes through the
      one rule in js/core.js, so " Ana" and "ana" are the same learner here as they are for progress. */
  const same = (x, y) => E.sameUser(x, y);
  /** What the learner has done in the case patient's chart. Null when the patient is gone (see orphan()). */
  function context(a) {
    const cs = def(a.id), p = cs && E.pt(cs.pid), me = E.db.user.name;
    if (!p) return null;
    return { p, from: a.start, nodeAt: a.nodeAt, orders: p.orders.filter((o) => same(o.by, me)), notes: p.notes.filter((n) => same(n.author, me)),
      audit: E.db.audit.filter((x) => same(x.user, me) && x.patientId === p.id && x.ts >= a.start) };
  }
  /* The learner's own pause holds the rest of the hospital too (results, the simulated attending and nurses:
     js/core.js E.simPaused). Read straight from the record, not through myCase(), because myCase() can end an
     orphaned case and a pause check must have no side effects. */
  (E.pauseChecks = E.pauseChecks || []).push(() => { const a = E.db && E.db.user && E.progress().active; return !!(a && a.type === 'case' && a.paused && !a.done); });

  /* =====================================================================================================
     3. THE ENGINE
     ===================================================================================================== */
  const after = (list) => Math.max(Date.now(), list.reduce((m, x) => Math.max(m, x.ts), 0) + 1);
  const pushVitals = (p, over) => { const b = Object.assign({ temp: 37, hr: 80, rr: 16, sbp: 120, dbp: 70, spo2: 97, o2: 'Room air', pain: 0 }, E.lastVitals(p) || {}); delete b.sim; p.vitals.push(Object.assign(b, { ts: after(p.vitals), by: p.rn }, over)); };
  const each = (x, fn) => { if (!x) return; (Array.isArray(x[0]) ? x : [x]).forEach(fn); };
  /** Put a node's findings in the chart. */
  function apply(a, p, en) {
    if (en.jump != null) a.elapsed += ((((en.jump - (hosp(a) % 24)) % 24) + 24) % 24) * hourMs();   // on to the next time the clock reads this hour
    if (en.set) Object.assign(p, en.set);
    if (en.vitals) pushVitals(p, en.vitals);
    each(en.labs, ([name, values]) => p.labs.push({ id: E.uid('l'), ts: after(p.labs), name, values }));
    each(en.reports, ([kind, name, text, by]) => p.reports.push({ id: E.uid('r'), ts: after(p.reports), kind, name, status: 'Final', text, by: by || 'Radiology' }));
    each(en.notes, ([type, author, role, text]) => p.notes.push({ id: E.uid('n'), ts: after(p.notes), type, author, role, status: 'Signed', text }));
    (en.problems || []).forEach((name) => p.problems.unshift({ id: E.uid('pr'), name, noted: Date.now(), status: 'Active' }));
    if (en.truth) { p.sim = p.sim || {}; ['labs', 'reports', 'consults'].forEach((k) => { if (en.truth[k]) p.sim[k] = Object.assign({}, p.sim[k], en.truth[k]); }); }
    // a test still 'In process' is cancelled too, before it results (the contrast CT in "breath"); a pended order is left for the attending to decline
    (en.stop || []).forEach((id) => p.orders.forEach((o) => { if (o.catId === id && ['Active', 'In process'].includes(o.status)) Object.assign(o, { status: 'Discontinued', dcTs: Date.now(), dcBy: p.attending }); }));
    (en.orders || []).forEach(([id, over]) => { const o = E.newOrder(id, Object.assign({ by: p.attending, byRole: 'physician' }, over || {})); E.activate(p, o, p.attending); if (o.status === 'In process') o.status = 'Active'; p.orders.push(o); });
    if (en.msg) E.message(Object.assign({ type: 'Page', from: p.rn, patientId: p.id, act: 'flowsheets' }, en.msg));
    if (en.icu && !p.icu) p.icu = { ts: Date.now(), why: en.icu };
    if (en.home) p.discharged = { ts: Date.now() };
  }
  /** The ways out of a node, each with a stable id: `<node>:a<option index>` for a question, `<node>:p<path index>`
      for chart work, or an explicit `id` on the option or path. The debrief matches the learner's road by this id
      (by label only for plays stored before ids existed), so a label can be reworded without breaking old
      debriefs. Reordering options or paths changes a derived id: give the edge an explicit `id` first. */
  const edgesOf = (n, key) => (n.ask ? n.ask.options.map((o, i) => ({ id: o.id || `${key}:a${i}`, label: o.text, to: o.to, grade: o.grade, why: o.why, ids: [], wait: [], asks: [] }))
    : (n.paths || []).map((x, i) => ({ id: x.id || `${key}:p${i}`, label: x.label, to: x.to, grade: x.grade, why: x.why, after: x.after, ids: (x.when && x.when.ids) || [], wait: (x.when && x.when.wait) || [], asks: (x.when && x.when.asks) || [] })));
  /** The hours after which a node's timed exits open, smallest first. */
  const timesOf = (n) => [...new Set((n.paths || []).filter((x) => x.after != null).map((x) => x.after))].sort((x, y) => x - y);
  /** A step graded harm goes on the learner's safety record (owner's decision: harm inside a case counts toward the
      three strikes), unless a global harm rule (js/shift.js) is already counting the same order: one act, one strike. */
  function harmed(p, e) {
    if (!E.caseHarm) return;
    const me = E.db.user.name, ord = (id) => (p.orders.find((o) => o.id === id) || {}).catId;
    if ((E.db.crises || []).some((x) => x.kind === 'harm' && x.pid === p.id && same(x.who, me) && e.ids.includes(ord(x.orderId)))) return;
    E.caseHarm({ pid: p.id, title: e.label, detail: e.why || '' });
  }
  /** Move the case to a node. `e` is the way out (from edgesOf) that led here. */
  function enter(a, key, e) {
    const cs = def(a.id), n = cs.nodes[key], p = E.pt(cs.pid);
    if (e) a.path.push({ from: a.node, to: key, edge: e.id, label: e.label, grade: e.grade, why: e.why || '', at: hhmm(hosp(a)) });
    if (e && e.grade === 'harm') harmed(p, e);
    Object.assign(a, { node: key, nodeAt: Date.now(), nodeEl: a.elapsed, asked: false, opts: null, skip: false });
    apply(a, p, n.enter || {});
    E.db.audit.unshift({ ts: Date.now(), user: 'Case', role: 'sim', patientId: p.id, action: `${cs.title}: ${n.title}` });
    if (n.end) a.done = { outcome: n.end, at: Date.now() };
    const sc = n.scene && Object.assign({ hour: hosp(a) % 24, title: `${hhmm(hosp(a))} · ${n.title}` }, n.scene);
    if (sc && E.world && E.world.scenesOn && E.world.scenesOn()) a.scene = sc;
    else say(n.story, `${hhmm(hosp(a))} · ${n.title}`, n.end === 'icu' || n.urgent ? 'alert' : n.end ? 'check' : 'info');
    pose(n.end === 'icu' ? 'sad' : n.end === 'well' ? 'cheer' : n.urgent ? 'worry' : 'think', 4000);
  }

  /** The order the current question's options are shown in, as original indices. The data lists the best answer
      first, so the options are shuffled the first time a question is shown, and the order is kept on the activity
      so a reload or a reopened dialog shows the same order. The choice is still recorded by original index (the
      edge id `<node>:a<i>`), so the debrief and stored history do not depend on the display order. */
  function optOrder(a, n) {
    const k = n.ask.options.length, o = a.opts;
    if (o && o.node === a.node && Array.isArray(o.idx) && o.idx.length === k && o.idx.slice().sort((x, y) => x - y).every((v, i) => v === i)) return o.idx;
    const idx = [...Array(k).keys()];
    for (let i = k - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (k > 1 && idx[0] === 0) idx.push(idx.shift());   // never the source order's first: that is always the best answer
    a.opts = { node: a.node, idx };
    return idx;
  }

  /* ---------- the clock ---------- */
  let last = Date.now();
  const WAIT = ['caseAsk', 'scene', 'safetyDebrief', 'caseResult'];
  function advance() {
    const now = Date.now(), dt = Math.max(0, Math.min(now - last, 5000));
    last = now;
    const a = myCase();
    if (!a || !dt || a.paused || a.done || a.scene || document.hidden || (E.suspended && E.suspended()) || (E.ui.modal && WAIT.includes(E.ui.modal.type))) return;
    a.elapsed += dt;
  }
  /** Called every two seconds by the app. Returns true if anything changed. */
  E.caseTick = () => {
    const a = myCase();
    if (!a) return false;
    advance();
    // a learner's pause freezes the case completely: no path is taken, no question or scene opens, no timer runs.
    // Orders entered while paused are still in the chart when the case resumes, and count then.
    if (a.paused && !a.done) return false;
    const cs = def(a.id), n = cs.nodes[a.node], free = !(E.app && E.app.busy());
    if (a.scene) { if (free) { const sc = a.scene; a.scene = null; E.world.scene(sc); return true; } return false; }
    if (E.ui.modal && WAIT.includes(E.ui.modal.type)) return false;
    if (a.done) { if (free) finish(); return free; }
    if (n.ask) { if (!a.asked && free) { a.asked = true; optOrder(a, n); E.ui.modal = { type: 'caseAsk' }; E.app.render(); return true; } return false; }
    if (Date.now() - a.nodeAt < CFG().settle * 1000) return false;
    const c = context(a), gone = (a.elapsed - a.nodeEl) / hourMs();
    const take = (h) => (n.paths || []).findIndex((x) => (!x.when || x.when(c)) && (x.after == null || h >= x.after));
    let i = take(gone);
    // "I have done what I can" (caseWait): nothing fires now, so run the clock on to the first timed exit that
    // would fire, exactly as waiting would have. A condition that is already met has fired above, before this.
    if (i < 0 && a.skip) { for (const h of timesOf(n).filter((t) => t > gone)) { i = take(h); if (i >= 0) { a.elapsed = a.nodeEl + h * hourMs(); break; } } }
    a.skip = false;
    if (i < 0) return false;
    const e = edgesOf(n, a.node)[i]; enter(a, e.to, e);
    return true;
  };
  /** The learner's own orders this node looks at that are still on their way (pended for the attending, or a test
      in process). Skipping the clock past them would take a timed exit that waiting would not have. */
  const onTheWay = (a, n) => { const c = context(a), ids = new Set([].concat(...edgesOf(n, a.node).map((e) => e.ids))); return c ? c.orders.filter((o) => o.ts >= a.start && ids.has(o.catId) && ['Pended', 'In process'].includes(o.status)) : []; };
  /** Who is waiting at a chart-work node: neutral, so it names people and never the answer. */
  const waitLine = (n, p) => {
    if (n.waiting) return n.waiting;
    const rn = String(p.rn || '').split(', ')[1];
    return `Dr. ${String(p.attending || 'Attending').split(',')[0]} and ${rn ? `${rn.split(' ')[0]}, ${p.sex === 'M' ? 'his' : 'her'} nurse,` : 'the nurse'} are waiting to see what you do in the chart.`;
  };

  /* ---------- scoring ---------- */
  const PTS = { best: 2, ok: 1 };
  const memo = (fn) => { const m = new Map(); return (cs) => (m.has(cs) ? m.get(cs) : (m.set(cs, fn(cs)), m.get(cs))); };
  /** Every catalogue id any way out or loose end of the case looks at. A lab or imaging order outside this set
      is one no path in the case ever needed (the "Focused work-up" credit). */
  const relevant = memo((cs) => new Set([].concat(...Object.entries(cs.nodes).map(([k, n]) => [].concat(...edgesOf(n, k).map((e) => e.ids)))).concat(...(cs.credits || []).map((x) => (x.test && x.test.ids) || []))));
  const unneeded = (c, cs) => (c ? c.orders.filter((o) => o.ts >= c.from && ['lab', 'img'].includes(o.type) && o.status !== 'Draft' && !relevant(cs).has(o.catId)).length : 0);
  /* A cost for ordering everything, as a credit, because points are never taken away: up to two extra tests is
     curiosity or a reasonable hedge; more is a scattergun. `always` shows the reason even when the credit is earned. */
  const FOCUS = { text: 'Focused work-up', always: true, test: (c, cs) => unneeded(c, cs) <= 2,
    why: (c, cs) => { const k = unneeded(c, cs); return k === 0 ? 'No tests were ordered that this case did not need.' : k <= 2 ? `${k} test${k > 1 ? 's' : ''} ordered that this case did not need. Up to two is fine.` : `${k} tests ordered that this case did not need. Each one is a needle, a wait or a dose of radiation for the patient; order what will change what you do.`; } };
  const creditsOf = (cs) => (cs.credits || []).concat(FOCUS);
  /** The points a perfect play earns on the path: the most a clean road (only best or reasonable decisions) from
      the start to a good ending can score. The old denominator was the learner's own path length times two, so a
      short road to a bad ending had a small denominator and could show a higher percentage than a long good one.
      A fixed number per case, taken from the data, means 100% is the best play the case allows. Clean, because a
      road through a harm and its rescue has more steps and so more points to collect (in "chest", 9 against 8);
      counting it would put 100% out of reach of the learner who never harmed anyone. Such a road is capped at
      100%, and harm already rules out three stars. If a case had no clean road the best of any road is used. It
      only feeds the percentage, and stars are best-of (finish() keeps rec.best), so nothing earned goes down. */
  const bestRoad = memo((cs) => {
    const go = (k, on, clean) => {
      const n = cs.nodes[k]; if (!n) return -Infinity;
      if (n.end) return n.end === 'well' ? 0 : -Infinity;
      if (on.has(k)) return -Infinity;
      on.add(k); const v = Math.max(-Infinity, ...edgesOf(n, k).filter((e) => !clean || PTS[e.grade]).map((e) => (PTS[e.grade] || 0) + go(e.to, on, clean))); on.delete(k);
      return v;
    };
    const v = go(cs.start, new Set(), true);
    return Math.max(0, v > -Infinity ? v : go(cs.start, new Set(), false));
  });
  function result(a, abandoned) {
    const cs = def(a.id), n = cs.nodes[a.node], c = context(a);
    const credits = creditsOf(cs).map((x) => ({ text: x.text, why: typeof x.why === 'function' ? x.why(c, cs) : x.why, done: !!x.test(c, cs), always: !!x.always }));
    const score = a.path.reduce((s, x) => s + (PTS[x.grade] || 0), 0) + credits.filter((x) => x.done).length, total = bestRoad(cs) + credits.length;
    const pct = total ? Math.min(100, Math.round((score / total) * 100)) : 0, harm = a.path.filter((x) => x.grade === 'harm').length, outcome = abandoned ? 'left' : n.end;
    const stars = outcome === 'well' ? (pct >= 85 && !harm ? 3 : 2) : outcome === 'rocky' ? 1 : 0;
    return { id: cs.id, title: cs.title, patient: E.pt(cs.pid).name, at: Date.now(), endedAt: hhmm(hosp(a)), outcome, ending: n.title, endText: n.story, steps: a.path, credits, score, total, pct, stars, harm };
  }
  function finish() {
    const pr = E.progress(), a = myCase(); if (!a) return;
    const before = E.game(pr), r = result(a), cs = def(a.id);
    const rec = (pr.cases = pr.cases || {})[a.id] || { plays: 0, best: 0, history: [] };
    rec.plays++; rec.best = Math.max(rec.best || 0, r.stars); rec.last = r;
    rec.history.push({ at: r.at, stars: r.stars, outcome: r.outcome, percent: r.pct, path: r.steps.map((s) => s.label) });
    pr.cases[a.id] = rec;
    const p = E.pt(cs.pid); if (p) delete p.isNew;
    delete pr.active;
    E.audit(`Finished case: ${cs.title} (${OUT[r.outcome][0]}, ${r.stars} of 3 stars)`, cs.pid);
    const xp = E.game(pr).xp - before.xp;
    E.ui.modal = { type: 'caseResult', id: cs.id, xp };
    E.save();
    if (xp) { say(`${OUT[r.outcome][0]} on “${cs.title}”.`, `+${xp} XP · Case`, 'star', r.outcome === 'well' ? 'big' : undefined); pose('cheer', 2600); }
    E.app.render();
  }
  E.caseXp = (pr) => Object.values(pr.cases || {}).reduce((n, r) => n + (r.best || 0), 0) * ((E.XP && E.XP.case) || 0);
  E.caseReport = (pr) => E.CASES.map((cs) => {
    const r = (pr.cases || {})[cs.id] || {}, l = r.last;
    return { case: cs.title, plays: r.plays || 0, bestStars: r.best || 0, history: (r.history || []).map((h) => Object.assign({}, h, { at: new Date(h.at).toISOString() })),
      lastPlay: l ? { at: new Date(l.at).toISOString(), outcome: OUT[l.outcome][0], ending: l.ending, score: `${l.score} of ${l.total}`, decisions: l.steps.map((s) => `${s.at} ${s.label} (${GRADE[s.grade][0].toLowerCase()})`), looseEndsTied: l.credits.filter((x) => x.done).map((x) => x.text), looseEndsLeft: l.credits.filter((x) => !x.done).map((x) => x.text), learningIssues: cs.issues } : null };
  });

  /* =====================================================================================================
     4. VIEWS
     ===================================================================================================== */
  const chip = (t, cls) => `<span class="chip ${cls || ''}">${esc(t)}</span>`;
  const stars = (n, size) => `<span class="stars" role="img" aria-label="${n} of 3 stars">${[1, 2, 3].map((i) => `<span class="${i <= n ? 'on' : 'off'}">${icon('star', size || 24)}</span>`).join('')}</span>`;
  const OUT = { well: ['Did well', 'green'], rocky: ['A rocky course', 'amber'], icu: ['Intensive care', 'red'], left: ['Left early', 'grey'] };
  const GRADE = { best: ['Best', 'green'], ok: ['Reasonable', 'amber'], poor: ['Poor', 'red'], late: ['Too slow', 'amber'], harm: ['Harm', 'red'] };
  const MIN_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const MAX_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" fill="none" stroke="#fff" stroke-width="2"/></svg>';

  /** The Cases section at the top of the Missions page. */
  V.caseShelf = () => {
    const pr = E.progress(), a = pr.active, canOrder = E.can('order.sign') || E.can('order.pend');
    const cards = E.CASES.map((cs) => {
      const rec = (pr.cases || {})[cs.id] || {}, on = a && a.type === 'case' && a.id === cs.id;
      const btn = on ? `<a class="btn primary" href="#/pt/${cs.pid}/summary">Back to the patient</a>` : `<button class="btn${rec.plays ? '' : ' primary'}" data-act="caseAsk" data-id="${cs.id}"${a || !canOrder ? ' disabled' : ''}>${rec.plays ? 'Play again' : 'Start case'}</button>`;
      return `<article class="mission case-card${on ? ' live' : ''}${rec.best === 3 ? ' gold' : ''}"><header>${icon(cs.glyph, 48)}<div><b>${esc(cs.title)}</b><span>Case ${cs.n} · ${esc(cs.level)} · ${hhmm(cs.startHour)}</span></div></header>
        <p>${esc(cs.brief)}</p><footer>${stars(rec.best || 0)}${rec.last ? `<button class="btn xs" data-act="caseLast" data-id="${cs.id}">Last debrief</button>` : ''}<span class="spacer"></span>${on ? chip('In progress', 'amber') + ' ' : ''}${btn}</footer></article>`;
    }).join('');
    return `<h3 class="shelf-h">${icon('learning', 32)}Cases</h3>
      <p class="muted shelf-p">A new patient whose course depends on what you decide.</p>
      ${a && a.type === 'case' ? `<div class="notice info">${icon('info', 24)}<span>A case is in progress. Finish or leave it from the case bar under the toolbar before starting anything else.</span></div>` : ''}
      <div class="mission-grid">${cards}</div>`;
  };

  /** The case strip under the toolbar (V.dockStrip, js/missions.js). It shows what is happening and what has happened, never the tree. */
  V.caseDock = (a) => {
    if (orphan(a)) return '';   // the patient is gone: the case has just been ended, and the next tick says so
    const cs = def(a.id), n = cs.nodes[a.node], p = E.pt(cs.pid);
    const sum = `<p class="dock-pt">${icon('user', 16)}<a href="#/pt/${p.id}/summary">${esc(p.name)}</a></p>
      ${a.paused ? `<p class="shift-paused">${icon('info', 16)}<span>Paused. Nothing changes until you resume.</span></p>` : ''}
      <span class="dock-story" title="${esc(n.story)}"><b>Now · ${esc(n.title)}.</b> ${esc(n.story)}</span>
      ${n.urgent && !a.done ? `<p class="shift-now">${icon('alert', 16)}<a href="#/pt/${p.id}/orders">${p.sex === 'M' ? 'He' : 'She'} needs you now</a></p>` : ''}
      ${n.ask && !a.done ? `<p class="shift-now">${icon('help', 16)}<button class="linkish" data-act="caseAskOpen">${esc(n.ask.who || 'The attending')} is waiting for your answer</button></p>` : ''}`;
    const body = `<h5>Now · ${esc(n.title)}</h5><p class="dock-brief case-now">${esc(n.story)}</p>
      ${n.paths && !a.done ? `<p class="dock-brief">${esc(waitLine(n, p))}</p>` : ''}
      ${a.path.length ? `<h5>So far</h5><ul class="dock-list">${a.path.map((s) => `<li class="done"><i class="tick1"></i><span>${esc(s.label)}<small>${s.at}</small></span></li>`).join('')}</ul>` : ''}`;
    const acts = `${a.done ? '<button class="btn xs primary" data-act="caseDebrief">See the debrief</button>' : `${n.paths && !a.paused && timesOf(n).length ? '<button class="btn xs" data-act="caseWait" title="Moves the case clock on to the next point where something happens, as if you had waited">I have done what I can for now</button>' : ''}${V.pauseBtn('casePause', a.paused, 'case')}<button class="btn xs" data-act="caseLeave">Leave case</button>`}`;
    return V.dockStrip({ type: 'case', cls: `dock-shift dock-case${a.paused ? ' paused' : ''}`, label: `Case: ${cs.title}`, glyph: 'learning', title: cs.title, timer: `<span id="case-clock" class="dock-timer">${hhmm(hosp(a))}</span>`, sum, acts, body, more: 'The story so far' });
  };

  /** The whole tree as nested lists, with the learner's own path marked. */
  function tree(cs, key, took, seen) {
    const n = cs.nodes[key], on = took.nodes.has(key);
    if (seen.has(key)) return `<span class="tr-node ref">joins “${esc(n.title)}”</span>`;
    seen.add(key);
    const head = `<span class="tr-node${on ? ' on' : ''}">${n.end ? chip(OUT[n.end][0], OUT[n.end][1]) + ' ' : ''}<b>${esc(n.title)}</b>${n.ask ? `<small>${esc(n.ask.who || 'The attending')} asks: ${esc(n.ask.q)}</small>` : ''}</span>`;
    const edges = edgesOf(n, key);
    return head + (edges.length ? `<ul>${edges.map((e) => { const mine = took.edges.has(e.id) || took.edges.has(`${key}>${e.to}|${e.label}`); const joins = !mine && took.nodes.has(e.to) && !seen.has(e.to);   // your road draws this node; here it is only named
      return `<li class="${mine ? 'on' : ''}"><span class="tr-edge">${chip(GRADE[e.grade][0], GRADE[e.grade][1])} ${esc(e.label)}${mine ? ' <b class="tr-you">your choice</b>' : ''}</span>${joins ? `<span class="tr-node ref">joins “${esc(cs.nodes[e.to].title)}”</span>` : tree(cs, e.to, took, seen)}</li>`; }).join('')}</ul>` : '');
  }

  V.modalExt = Object.assign(V.modalExt || {}, {
    caseAsk(m, modal) {
      const a = myCase(); if (!a) return '';
      const cs = def(a.id), n = cs.nodes[a.node], p = E.pt(cs.pid); if (!n.ask) return '';
      return modal(`${n.ask.who || 'The attending'} is asking`, `
        <div class="g-pt">${icon('user', 32)}<div><b>${esc(p.name)}</b> · ${E.age(p.dob)} ${p.sex} · ${esc(p.bed)}<span>${esc(n.story)}</span></div></div>
        <p class="dock-qt rounds-q">“${esc(n.ask.q)}”</p>
        ${optOrder(a, n).map((i) => `<button class="qopt" data-act="casePick" data-i="${i}">${esc(n.ask.options[i].text)}</button>`).join('')}
        <p class="fine">The clock is paused while you answer. An answer is final.</p>`,
        '<button class="btn" data-act="closeModal">Step out to check the chart</button>', 'lg');
    },
    caseResult(m, modal) {
      const pr = E.progress(), rec = (pr.cases || {})[m.id] || {}, r = rec.last, cs = def(m.id); if (!r || !cs) return '';
      // the road is matched on the stored edge id; a play stored before edge ids existed falls back to its label
      const took = { nodes: new Set([cs.start].concat(r.steps.map((s) => s.to))), edges: new Set(r.steps.map((s) => s.edge || `${s.from}>${s.to}|${s.label}`)) };
      // the whole tree, with every grade, only once this learner has reached a good ending on this case (stars are
      // best-of, and only a good ending earns two or more)
      const open = (rec.history || []).some((h) => h.outcome === 'well') || (rec.best || 0) >= 2;
      return modal(`Case debrief — ${cs.title}`, `
        <div class="result-head">${stars(r.stars, 48)}<div><b>${esc(OUT[r.outcome][0])}</b><span>${esc(r.patient)} · ${esc(r.ending)} · ${r.endedAt}</span><span>${r.score} of ${r.total} points${m.xp ? ` <span class="xp">+${m.xp} XP</span>` : ''}</span></div></div>
        <p class="case-end">${esc(r.endText)}</p>
        <h4>Your path</h4><ol class="case-path">${r.steps.map((s) => `<li><span class="nowrap">${s.at}</span><div><b>${esc(s.label)}</b> ${chip(GRADE[s.grade][0], GRADE[s.grade][1])}<small>${esc(s.why)}</small></div></li>`).join('') || '<li><span></span><div>No decisions were made.</div></li>'}</ol>
        ${r.credits.length ? `<h4>Loose ends</h4><ul class="dock-list wide">${r.credits.map((x) => `<li class="${x.done ? 'done' : 'bad'}">${icon(x.done ? 'check' : 'remove', 16)}<span>${esc(x.text)}${x.done && !x.always ? '' : `<small>${esc(x.why)}</small>`}</span></li>`).join('')}</ul>` : ''}
        ${open ? `<h4>The whole tree</h4><p class="fine">Every road this case could have taken. Yours is marked.</p><div class="tree"><ul><li class="on">${tree(cs, cs.start, took, new Set())}</li></ul></div>` : ''}
        <h4>Learning issues for your group</h4><ol class="case-issues">${cs.issues.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
        ${open ? `<div class="debrief shift-debrief">${icon('learning', 48)}<div><p>${esc(cs.debrief)}</p></div></div>` : `<p class="fine case-map-locked">The full map of this case opens after a good ending.</p>`}`,
        `${r.stars < 3 ? `<button class="btn" data-act="caseAsk" data-id="${cs.id}">Play again</button>` : ''}<a class="btn" href="#/missions" data-act="closeModal">All cases</a><button class="btn primary" data-act="closeModal">Close</button>`, 'xl');
    },
  });

  /* =====================================================================================================
     5. ACTIONS (merged into the app's action table by js/app.js)
     ===================================================================================================== */
  E.caseActions = {
    caseAsk(d) {
      const pr = E.progress(), cs = def(d.id);
      if (pr.active) { E.ui.modal = null; E.app.status(`Finish ${pr.active.type === 'shift' ? 'your shift' : pr.active.type === 'exam' ? 'the proficiency check' : pr.active.type === 'case' ? 'your case' : 'your mission'} first.`); return E.app.render(); }
      if (!E.can('order.sign') && !E.can('order.pend')) return E.app.status('Cases involve entering orders, so they are for the Medical Student and Physician roles.');
      E.ui.modal = { type: 'confirm', title: `Start case ${cs.n}: ${cs.title}?`, text: `${cs.brief} The patient joins your list when the case starts. The hospital clock starts at ${hhmm(cs.startHour)}; one hospital hour is about ${Math.round(CFG().hourSeconds / 60)} minutes of yours. You can pause it, and it waits whenever you are asked a question.`, yes: 'caseStart', yesLabel: 'Start the case', id: cs.id };
      E.app.render();
    },
    caseStart() {
      const id = E.ui.modal && E.ui.modal.id, cs = def(id), pr = E.progress();
      if (!cs || pr.active) return;
      E.db.patients = E.db.patients.filter((p) => p.id !== cs.pid);
      E.db.openTabs = E.db.openTabs.filter((x) => x !== cs.pid);
      E.db.inbox = E.db.inbox.filter((m) => m.patientId !== cs.pid);
      (E.db.crises || []).forEach((c) => { if (c.pid === cs.pid && ['pending', 'open'].includes(c.state)) c.state = 'ended'; });
      const p = buildPatient(cs); p.isNew = true; p.arrive = (cs.nodes[cs.start].scene || {}).kind === 'arrive' ? 'amb' : 'walk';   // by ambulance, or on foot (js/world.js)
      E.db.patients.push(p);
      const a = (pr.active = { type: 'case', id, start: Date.now(), startHour: cs.startHour, elapsed: 0, paused: false, path: [], node: null });
      Object.assign(E.ui, { modal: null, dockMin: false, dockOpen: false });
      last = Date.now();
      E.audit(`Started case: ${cs.title}`, cs.pid);
      enter(a, cs.start, null);
      E.save();
      E.app.go(`#/pt/${cs.pid}/summary`);
    },
    caseAskOpen() { const a = myCase(), n = a && def(a.id).nodes[a.node]; if (!n || !n.ask) return; optOrder(a, n); E.ui.modal = { type: 'caseAsk' }; E.save(); E.app.render(); },
    /** "I have done what I can for now": the learner says they are finished with this node, so the clock runs on
        to its next timed exit (caseTick does it, after the usual settle, and only if no condition exit fires first). */
    caseWait() {
      const a = myCase(); if (!a || a.done || a.paused) return;
      const cs = def(a.id), n = cs.nodes[a.node]; if (!n.paths || !timesOf(n).length) return;
      const busy = onTheWay(a, n);
      if (busy.length) return E.app.status(`${busy[0].name} is still on its way. The case waits for it, as it would if you waited.`);
      a.skip = true;
      E.audit('Said they had done what they could for now (case clock moved on)', cs.pid);
      E.caseTick();
      E.app.commit();
    },
    casePick(d) {
      const a = myCase(); if (!a) return;
      const n = def(a.id).nodes[a.node], o = n.ask && n.ask.options[Number(d.i)]; if (!o) return;
      E.ui.modal = null; last = Date.now();
      E.audit(`Answered ${n.ask.who || 'the attending'}: ${o.text}`, def(a.id).pid);
      const e = edgesOf(n, a.node)[Number(d.i)]; enter(a, e.to, e);
      E.app.commit();
    },
    casePause() { const a = myCase(); if (!a) return; a.paused = !a.paused; last = Date.now(); E.audit(a.paused ? 'Paused the case' : 'Resumed the case'); E.app.commit(); },
    caseDebrief() { if (myCase() && myCase().done) finish(); },
    caseLeave() { E.ui.modal = { type: 'confirm', title: 'Leave this case?', text: 'The case stops where it is and no stars are awarded. The patient stays on your list, and anything you ordered or wrote stays in the chart. You can start the case again at any time; it begins from the beginning with a fresh chart.', yes: 'caseLeaveDo', yesLabel: 'Leave the case', danger: true }; E.app.render(); },
    caseLeaveDo() { const pr = E.progress(), a = myCase(); if (!a) return; const cs = def(a.id), p = E.pt(cs.pid); if (p) delete p.isNew; delete pr.active; E.ui.modal = null; E.audit(`Left case: ${cs.title}`, cs.pid); E.app.commit(); },
    caseLast(d) { E.ui.modal = { type: 'caseResult', id: d.id }; E.app.render(); },
  };

  /* The case clock, once a second, updated in place. */
  let ticks = 0;
  setInterval(() => {
    if (!E.db || !E.db.user || !E.app) return;
    advance();
    const a = myCase(); if (!a) return;
    const el = document.getElementById('case-clock'); if (el) el.textContent = hhmm(hosp(a));
    if (++ticks % 10 === 0) E.save();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    const a = myCase();
    if (document.hidden && a && !a.paused && !a.done) { a.paused = true; E.audit('Case paused: the browser tab was hidden'); E.save(); if (E.app && !E.app.busy()) E.app.render(); }
    last = Date.now();
  });

  /* =====================================================================================================
     6. BUILDING A CASE PATIENT (times are relative to now, as in js/seed.js)
     ===================================================================================================== */
  function buildPatient(cs) {
    const now = Date.now(), T = (h) => Math.round((now + h * E.HOUR) / 60000) * 60000;
    const K = {
      T,
      vit: (rows, rn) => rows.map(([h, temp, hr, rr, sbp, dbp, spo2, o2, pain]) => ({ ts: T(h), by: rn, temp, hr, rr, sbp, dbp, spo2, o2, pain })),
      labs: (rows) => rows.map(([h, name, values]) => ({ id: E.uid('l'), ts: T(h), name, values })),
      rep: (h, kind, name, text, by) => ({ id: E.uid('r'), ts: T(h), kind, name, status: 'Final', text, by: by || 'Radiology' }),
      note: (h, type, author, role, text) => ({ id: E.uid('n'), ts: T(h), type, author, role, status: 'Signed', text }),
      enc: (days, type, dept, provider, dx) => ({ id: E.uid('e'), ts: T(-24 * days), type, dept, provider, dx }),
      al: (agent, cls, reaction, severity, type) => ({ id: E.uid('a'), agent, cls, reaction, severity, type: type || 'Drug allergy', status: 'Active', verified: true }),
      prob: (name, days) => ({ id: E.uid('pr'), name, noted: T(-24 * (days || 0)), status: 'Active' }),
    };
    const spec = cs.patient(K), admitH = spec.admitH;
    const p = Object.assign({ drafts: [], noteDraft: null, mar: [], isolation: '', codeStatus: 'Full Code', allergies: [], encounters: [], reports: [] }, spec.chart);
    p.id = cs.pid; p.admitTs = T(admitH); p.attending = spec.attending;
    p.orders = spec.orders.map(([catId, over]) => E.newOrder(catId, Object.assign({ status: 'Active', by: spec.attending, byRole: 'physician', ts: T(admitH + 0.5), signedBy: spec.attending, signedTs: T(admitH + 0.5) }, over || {})));
    // the MAR: scheduled doses due before now were given by the nurse, plus any PRN doses the case names
    for (let day = E.dayStart(-3); day <= E.dayStart(0); day += 24 * E.HOUR)
      p.orders.forEach((o) => E.dueTimes(o, day).forEach((due) => { if (due < now - 50 * 60000) p.mar.push({ id: E.uid('ma'), orderId: o.id, dueTs: due, action: 'Given', ts: due + 4 * 60000, by: p.rn, dose: o.dose, comment: '' }); }));
    (spec.given || []).forEach(([catId, h, comment]) => { const o = p.orders.find((x) => x.catId === catId); if (o) p.mar.push({ id: E.uid('ma'), orderId: o.id, dueTs: null, action: 'Given', ts: T(h), by: p.rn, dose: o.dose, comment: comment || '' }); });
    return p;
  }

  /* =====================================================================================================
     7. THE CASES
     ===================================================================================================== */
  const BMP = (Na, K, Cl, CO2, BUN, Cr, Glu, Ca) => ({ Na, K, Cl, CO2, BUN, Cr, Glu, Ca });
  const CBC = (WBC, Hgb, Hct, Plt) => ({ WBC, Hgb, Hct, Plt });
  const STEMI = 'Sinus rhythm, rate 102. 3 mm ST-segment elevation in II, III and aVF with reciprocal ST depression in I and aVL. Compared with the earlier tracing these changes are new.\n\nIMPRESSION: ACUTE INFERIOR ST-ELEVATION MYOCARDIAL INFARCTION. The ordering team was called.';
  /* FACULTY: the sildenafil is no longer in the H&P (2026-11-24). It is on no list; he says so when asked about
     pills he takes now and then (the chest case's `interview`), and erectile dysfunction is on his problem list as
     the clue. Asking the patient is the reliable way to learn it before the nitroglycerin decision. */
  const ASK_PRN = 'Do you take anything else, even pills you only take now and then?';
  const NITRO = { when: W.active('nitro_sl'), to: 'nitro', grade: 'harm', label: 'Nitroglycerin given', why: 'He took sildenafil last night. It was on no medication list, but he says so when asked about pills he takes now and then, and erectile dysfunction is on his problem list. A nitrate within 24 hours of sildenafil can drop the blood pressure dangerously.' };
  const ACS_TX = [
    { when: W.all(W.ordered('heparin_gtt'), W.ordered('c_cards')), to: 'evolve', grade: 'best', label: 'Heparin infusion and a cardiology consult ordered', why: 'Anticoagulation and early cardiology input are the treatment for an NSTEMI. He had his aspirin in the emergency department.' },
    { when: W.any(W.ordered('heparin_gtt'), W.ordered('c_cards')), after: 0.75, to: 'evolve', grade: 'ok', label: 'Only half the plan was ordered', why: 'The plan had two parts: heparin and cardiology. A plan that is agreed but only half entered is half a plan.' },
    { after: 1.25, to: 'missed', grade: 'late', label: 'The plan was agreed but never ordered', why: 'Nothing reaches the patient until it is an order. An hour passed with no anticoagulant and no cardiologist.' },
  ];
  const DEX = (grade, label, why) => ({ when: W.ordered('dextrose50'), to: 'awake', grade, label, why });
  /* The contrast CT is decided by the attempt (W.tried), not the result. At a creatinine of 2.3 the kidney harm rule
     (js/shift.js) makes the simulated attending decline it for a student, so a road that waited for its result could
     never be travelled by one; and a physician's signed CT would start the global harm crisis as well as the case's.
     The attempt takes the poor road to "ctstop", where Dr. Tanaka stops the CT before it is done (for a physician,
     inside the harm rule's delay, so it counts as stopped in time) and the V/Q scan is still needed. */
  const PE_TEST = [
    { when: W.resulted('vq'), to: 'pe', grade: 'best', label: 'V/Q lung scan', why: 'With a creatinine of 2.3 the contrast for a CT angiogram risks the kidneys. A V/Q scan answers the same question without contrast.' },
    { when: W.tried('ctpe'), to: 'ctstop', grade: 'poor', label: 'CT angiogram with contrast, at a creatinine of 2.3', why: 'Contrast risks kidney function she cannot spare, and the creatinine was in Results before the order was entered. Dr. Tanaka stopped it, and time went by before the right test.' },
  ];

  E.CASES = [
    /* ---------------------------------------------------------------------------------------------- */
    {
      id: 'chest', n: 1, pid: 'p8', title: 'Pressure in the chest', level: 'Time-critical', glyph: 'vitals', startHour: 13,
      brief: 'A 58-year-old man comes up from the emergency department with two hours of chest pressure. His ECG was “nonspecific” and the first troponin was normal.',
      debrief: 'One normal troponin early in chest pain rules out nothing: the story, a repeat ECG and a second troponin do the work. And the medication history is a safety check, not paperwork: one pill he takes now and then, on no list, made a routine drug dangerous. Only he could tell you about it.',
      issues: [
        'How do unstable angina, NSTEMI and STEMI differ on the ECG and the troponin, and why does the difference change how fast you act?',
        'How soon after the start of chest pain can a troponin be normal in a heart attack? What does “serial” mean in practice?',
        'Why are nitrates dangerous after sildenafil or tadalafil, and for how long after each?',
        'What is the target time from recognising a STEMI to opening the artery, and what is lost with each half hour?',
        'Where does the home medication list live in the record, who is responsible for it, and how would you check it with the patient?',
      ],
      credits: [
        { text: 'Opened the H&P before treating him', why: 'The H&P holds his risk factors and the plan the team agreed: repeat the ECG and the troponin.', test: W.viewed('Notes') },
        { text: 'Signed a note about the event', why: 'A change of diagnosis from “rule out” to a heart attack needs a note the next team can find.', test: W.note(['troponin', 'stemi', 'nstemi', 'ecg', 'infarct']) },
        { text: 'Asked the patient about pills he takes now and then', why: 'He took sildenafil last night and it was on no list. Asking him is how you learn it before anyone reaches for nitroglycerin.', test: W.asked(ASK_PRN) },
      ],
      interview: [
        { q: ASK_PRN, a: 'Just the blood pressure one and the diabetes ones. Oh. And the blue pill, the Viagra, from the urology doctor. I took one last night, about ten. Does that matter?' },
        { q: 'Have you ever had pain like this before?', a: 'Never like this. Sometimes a tightness on the hill to the bus stop these last few weeks, but it went when I stopped.' },
      ],
      patient: (K) => ({
        admitH: -2.2, attending: PARK,
        chart: {
          mrn: '10063391', name: 'Kealoha, Daniel', dob: '1968-04-02', sex: 'M', unit: '5 West Medicine', bed: '5W-510', rn: RN2, height: 178, weight: 96.0,
          cc: 'Chest pressure', dx: 'Chest pain, rule out acute coronary syndrome',
          problems: [K.prob('Chest pain, rule out acute coronary syndrome', 0), K.prob('Hypertension', 2500), K.prob('Type 2 diabetes mellitus', 1800), K.prob('Hyperlipidemia', 1800), K.prob('Tobacco use disorder', 9000), K.prob('Erectile dysfunction', 400)],
          vitals: K.vit([[-2.1, 36.8, 96, 20, 158, 94, 96, 'Room air', 7], [-1.2, 36.8, 90, 18, 150, 90, 97, '2 L NC', 6], [-0.2, 36.7, 88, 18, 146, 88, 97, '2 L NC', 6]], RN2),
          labs: K.labs([[-2, 'CBC, BMP, Troponin (emergency department)', Object.assign(CBC(8.9, 14.6, 43.8, 248), BMP(139, 4.1, 102, 24, 18, 1.0, 172, 9.3), { Trop: 0.03 })]]),
          reports: [
            K.rep(-2, 'Cardiology', 'ECG 12-lead', 'Sinus rhythm, rate 94. Nonspecific T-wave flattening in the lateral leads. No ST-segment elevation.\n\nIMPRESSION: Nonspecific T-wave changes. Repeat if symptoms persist.', 'Cardiology'),
            K.rep(-1.8, 'Imaging', 'XR chest 1 view, portable', 'FINDINGS: Lungs clear. Heart size normal. The mediastinum is not widened. No pneumothorax.\n\nIMPRESSION: No acute cardiopulmonary process.'),
          ],
          notes: [K.note(-0.8, 'H&P', PARK, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Chest pressure for 2 hours.\n\nHPI: 58 y.o. man with hypertension, type 2 diabetes, high cholesterol and a 30 pack-year smoking history. While carrying groceries up the stairs he developed a heavy pressure behind the breastbone, spreading to the left jaw, with sweating and nausea. It eased when he sat down and has not gone. Now 6/10. No tearing pain, no pain on breathing in, no leg swelling. His father had a heart attack at 54.\n\nHOME MEDICATIONS (from the emergency department triage list, not yet checked with the patient): amlodipine 10 mg daily; metformin 1,000 mg twice daily; atorvastatin 40 mg nightly.\nALLERGIES: none known.\n\nEXAM: HR 96, BP 158/94 (equal in both arms), RR 20, SpO2 96% on room air. Uncomfortable, sweaty. Heart sounds normal, no murmur. Lungs clear. No leg swelling.\n\nDATA: ECG in the emergency department: nonspecific T-wave flattening. First troponin 0.03 (normal), drawn 2 hours after onset. Chest X-ray clear, mediastinum normal. Aspirin 325 mg chewed in the emergency department.\n\nASSESSMENT & PLAN:\n1. Chest pain, concerning for acute coronary syndrome: several risk factors and a typical story. One normal troponin at 2 hours does not rule it out. Telemetry. Repeat ECG and troponin on arrival to the floor and with any change in pain.\n2. Hypertension, diabetes: continue home medications.\n3. Tobacco use: counselled.\nCode status: Full.')],
          encounters: [K.enc(60, 'Office Visit', 'Primary Care', 'Iwasaki, Glenn MD', 'Hypertension follow-up'), K.enc(400, 'Office Visit', 'Urology Clinic', 'Brandt, Colin MD', 'Erectile dysfunction')],
          sim: {
            labs: { Trop: 0.86 },
            reports: { ecg: 'Sinus rhythm, rate 90. New 1 mm horizontal ST-segment depression in V4 to V6 with T-wave inversion. These changes were not present on the emergency department tracing.\n\nIMPRESSION: New lateral ST depression, consistent with myocardial ischemia. Serial troponins advised.' },
            consults: { c_cards: '1. NSTEMI. Agree with aspirin and a heparin infusion.\n2. NO NITRATES for 24 hours: sildenafil taken last night.\n3. High-intensity statin. Beta blocker once it is clear he is not in heart failure.\n4. Coronary angiography within 24 hours; AT ONCE if the pain returns or the ST segments rise.\n5. Repeat the ECG with any change in pain and call us with it.' },
            story: ['It is like someone is sitting on my chest. It started on the stairs with the groceries and it has not really gone away. I got sweaty and felt sick.', 'I live with my wife in Kalihi. I drive a delivery truck. I smoke about a pack a day, have done since I was twenty. A couple of beers on the weekend.', 'My dad died of a heart attack at fifty-four. I keep thinking about that.'],
          },
        },
        orders: [['code_full'], ['admit'], ['tele'], ['o2'], ['amlodipine', { dose: '10 mg' }], ['metformin', { dose: '1,000 mg' }], ['atorvastatin'], ['acetaminophen'], ['vs_q4'], ['diet_cardiac']],
      }),
      start: 'arrive',
      nodes: {
        arrive: {
          title: 'Up from the emergency department',
          scene: { kind: 'arrive', lines: ['Mr. Kealoha, 58, comes up to 5 West with two hours of pressure in his chest.', 'The emergency department ECG was “nonspecific”. The first troponin was normal.', 'He still has pain. He is yours now.'] },
          story: 'He still has 6/10 chest pressure. The emergency department ECG was nonspecific and the first troponin, at 2 hours, was normal. Read the H&P and talk to him, then decide what he needs.',
          paths: [NITRO,
            { when: W.all(W.resulted('ecg'), W.resulted('trop')), to: 'nstemi', grade: 'best', label: 'Repeated the ECG and the troponin', why: 'Ongoing pain earns a repeat ECG and a second troponin. One normal troponin two hours in rules out nothing.' },
            { when: W.any(W.resulted('ecg'), W.resulted('trop')), after: 0.75, to: 'nstemi', grade: 'ok', label: 'Repeated one of the two', why: 'The ECG shows ischemia now; the troponin shows injury over hours. They answer different questions and he needed both.' },
            { after: 2, to: 'missed', grade: 'late', label: 'No repeat ECG or troponin for two hours', why: 'He was admitted to “rule out” a heart attack, and nothing was done to rule it in or out.' }],
        },
        nstemi: {
          title: 'The second troponin',
          enter: { vitals: { hr: 92, sbp: 148, dbp: 90, pain: 5 } },
          story: 'The repeat troponin is 0.86, up from 0.03, and the new ECG shows ST depression in V4 to V6. This is an NSTEMI. He still has 5/10 pressure.',
          ask: { who: 'Dr. Park', q: 'That troponin makes it a heart attack. What do you want to start?', options: [
            { text: 'A heparin infusion, and call cardiology now', to: 'tx', grade: 'best', why: 'Anticoagulation and early cardiology input are the treatment. Aspirin was already given.' },
            { text: 'Nitroglycerin under the tongue for the pain, then reassess', to: 'nitro', grade: 'harm', why: NITRO.why },
            { text: 'Ibuprofen for the pain, and repeat the troponin in the morning', to: 'missed', grade: 'poor', why: 'NSAIDs are harmful in a heart attack, and a rising troponin with ECG changes is not something to look at again tomorrow.' },
            { text: 'A CT angiogram to rule out a pulmonary embolism first', to: 'missed', grade: 'poor', why: 'The story, the ECG and the troponin already agree. Another test for another diagnosis only delays treatment.' }] },
        },
        tx: { title: 'Treating the NSTEMI', story: 'Dr. Park agrees: a heparin infusion and cardiology, now. He had aspirin in the emergency department. Enter the orders.', paths: [NITRO].concat(ACS_TX) },
        nitro: {
          title: 'Blood pressure 74/40', urgent: true,
          enter: { vitals: { hr: 118, rr: 22, sbp: 74, dbp: 40, spo2: 94, pain: 6 }, msg: { critical: true, subject: 'Kealoha, Daniel — BP 74/40 after nitroglycerin', body: 'Mr. Kealoha went grey and sweaty a few minutes after the nitroglycerin. BP 74/40, HR 118. He is lying flat with his legs up.\n\nHis wife says he took his “blue pill” last night.\n\nHe needs IV fluids. Can you order them now?\n\nHana' } },
          story: 'Minutes after the nitroglycerin his blood pressure is 74/40. He is grey and sweating. His wife says he took sildenafil last night.',
          paths: [
            { when: W.now(W.ordered('ns_bolus', 'lr')), to: 'rescued', grade: 'ok', label: 'IV fluids for the low blood pressure', why: 'Fluids and lying flat are the treatment for nitrate-induced hypotension. The fall in pressure should not have happened.' },
            { after: 0.6, to: 'icu', grade: 'harm', label: 'Nobody treated the low blood pressure', why: 'A heart that is short of blood cannot tolerate a pressure of 74/40 for long.' }],
        },
        rescued: { title: 'Pressure restored', enter: { vitals: { hr: 98, rr: 18, sbp: 104, dbp: 62, pain: 5 } }, story: 'After the fluids his pressure is 104/62. Dr. Park: “No nitrates for 24 hours after sildenafil. Now treat the heart attack: heparin infusion and cardiology.” Enter the orders.', paths: ACS_TX },
        evolve: {
          title: 'The pain comes back', urgent: true,
          enter: { vitals: { hr: 102, rr: 22, sbp: 132, dbp: 84, spo2: 95, pain: 9 }, truth: { labs: { Trop: 3.4 }, reports: { ecg: STEMI } }, reports: ['Cardiology', 'ECG 12-lead (ordered by nursing for chest pain)', STEMI, 'Cardiology'], msg: { critical: true, act: 'results', subject: 'Kealoha, Daniel — pain 9/10, new ECG', body: 'Mr. Kealoha’s pain is suddenly 9/10 and he is sweating again. I ran an ECG: it is in Results. It looks different from the last one, the bottom leads are up.\n\nPlease come now.\n\nHana' } },
          story: 'Forty minutes on, his pain is suddenly 9/10. The nurse has run a new ECG: ST elevation in II, III and aVF.',
          ask: { who: 'Hana, his nurse', q: 'The ECG has changed and he looks awful. What do you want to do?', options: [
            { text: 'This is a STEMI: call cardiology now to open the cath lab', to: 'cath', grade: 'best', why: 'New ST elevation with pain is an artery that has closed. The treatment is opening it, and every half hour costs heart muscle.' },
            { text: 'Morphine for the pain and repeat the troponin in three hours', to: 'cath_late', grade: 'poor', why: 'ST elevation is diagnosed on the ECG. Waiting for a troponin to confirm it spends heart muscle to buy nothing.' },
            { text: 'Start a beta blocker and recheck the ECG in an hour', to: 'cath_late', grade: 'poor', why: 'A beta blocker does not open a closed artery, and an hour is the difference between a small infarct and a large one.' }] },
        },
        missed: {
          title: 'Found at the bedside', urgent: true,
          enter: { vitals: { hr: 108, rr: 24, sbp: 126, dbp: 80, spo2: 94, pain: 9 }, truth: { labs: { Trop: 4.2 }, reports: { ecg: STEMI } }, reports: ['Cardiology', 'ECG 12-lead (ordered by nursing for chest pain)', STEMI, 'Cardiology'], msg: { critical: true, act: 'results', subject: 'Kealoha, Daniel — pain 9/10, ST elevation', body: 'Mr. Kealoha’s pain is 9/10 and he is vomiting. Nobody had repeated his ECG, so I did: it is in Results and the reading says ST elevation.\n\nPlease come now.\n\nHana' } },
          story: 'His pain is 9/10 and he is vomiting. The nurse ran an ECG on her own: ST elevation in II, III and aVF. Time has already been lost.',
          ask: { who: 'Hana, his nurse', q: 'It says ST elevation. What do you want?', options: [
            { text: 'Call cardiology now to open the cath lab', to: 'cath_late', grade: 'ok', why: 'The right call, later than it could have been made.' },
            { text: 'Repeat the troponin first to be sure', to: 'icu', grade: 'poor', why: 'ST elevation is diagnosed on the ECG. He had already waited too long.' },
            { text: 'Give him something for the nausea and reassess', to: 'icu', grade: 'poor', why: 'The vomiting was the heart attack.' }] },
        },
        cath: { title: 'Cath lab in 40 minutes', end: 'well', scene: { kind: 'home', lines: ['Cardiology answers on the second ring. The cath lab is open in forty minutes.', 'A stent goes into his right coronary artery. The ST segments settle on the table.', 'That evening he is pain-free, and asking whether he can still drive the truck.'] },
          enter: { set: { dx: 'Inferior STEMI, stent to the right coronary artery', bed: 'CCU-3 (step-down)' }, vitals: { hr: 76, rr: 16, sbp: 118, dbp: 72, spo2: 98, pain: 0 }, reports: ['Cardiology', 'Coronary angiography and intervention', 'FINDINGS: Right coronary artery: 100% thrombotic occlusion of the mid segment. Left anterior descending: 40% stenosis. Circumflex: no significant disease.\nINTERVENTION: One drug-eluting stent to the mid right coronary artery with normal flow restored.\n\nIMPRESSION: Inferior STEMI treated with a stent to the right coronary artery. Time from ECG to open artery: 41 minutes.', 'Cardiology'] },
          story: 'The cath lab opened his right coronary artery 41 minutes after the ECG changed. He is pain-free in the step-down unit, with an ejection fraction of 55%.' },
        cath_late: { title: 'Cath lab, two and a half hours late', end: 'rocky',
          enter: { set: { dx: 'Inferior STEMI, stent to the right coronary artery; new heart failure', bed: 'CCU-3 (step-down)' }, vitals: { hr: 92, rr: 20, sbp: 104, dbp: 64, spo2: 95, o2: '2 L NC', pain: 1 }, problems: ['Ischemic cardiomyopathy, EF 35%'] },
          story: 'The artery was opened two and a half hours after it closed. He has a stent and is alive, with an ejection fraction of 35% and a new diagnosis of heart failure. Time is muscle.' },
        icu: { title: 'Cardiac arrest', end: 'icu', scene: { kind: 'rapid', lines: ['The monitor alarms. Ventricular fibrillation.', 'One shock brings him back. The rapid response team takes him to intensive care.'] },
          enter: { icu: 'Cardiac arrest during an untreated heart attack', vitals: { hr: 124, rr: 26, sbp: 84, dbp: 50, spo2: 90, o2: 'Non-rebreather', pain: 0 } },
          story: 'He went into ventricular fibrillation on the ward and was shocked once. He is in intensive care on a ventilator, waiting for the cath lab.' },
      },
    },

    /* ---------------------------------------------------------------------------------------------- */
    {
      id: 'sugar', n: 2, pid: 'p9', title: 'She is not making sense', level: 'Think first', glyph: 'results', startHour: 10.5,
      brief: 'A 71-year-old woman, two days into treatment for a kidney infection, suddenly has slurred speech and a weak right arm. Her nurse is calling.',
      debrief: 'Sudden weakness and slurred speech is a stroke until proven otherwise, and the first thing that proves otherwise takes ten seconds at the bedside. The cause was in the record all along: the MAR showed every dose given, on two days of almost no food and failing kidneys.',
      issues: [
        'Which conditions mimic a stroke, and which of them can be excluded at the bedside in under a minute?',
        'Why does hypoglycemia from a sulfonylurea last longer than hypoglycemia from insulin, and what does kidney function have to do with it?',
        'How should a diabetes regimen change in hospital when a patient is eating little or nothing?',
        'What does the MAR tell you that the order list does not? Give an example from this case.',
        'Why is aspirin held until the head has been imaged in a suspected stroke?',
      ],
      credits: [
        { text: 'Ordered glucose checks to follow her', why: 'A sulfonylurea keeps working for a day or more. One normal glucose after dextrose is not the end of it.', test: W.ordered('poc_glu') },
        { text: 'Signed a note about the event', why: 'The night team needs to know she was hypoglycemic, why, and what to do if it happens again.', test: W.note(['glucose', 'hypoglyc', 'glipizide']) },
        { text: 'Asked the patient about low spells at home', why: 'She had two shaky, sweaty spells before lunch last week. The glipizide was already too much before she was admitted, so it needs to stop for good, not only for today.', test: W.asked('Have you felt shaky or sweaty like this before, at home?') },
      ],
      interview: [
        { q: 'Have you felt shaky or sweaty like this before, at home?', a: 'Yes. Twice last week, before lunch. I went shaky and sweaty and my heart was racing. A cookie fixed it, so I did not tell anyone.' },
        { q: 'What have you had to eat today?', a: 'Nothing. A few bites of dinner last night. Nothing tastes right. I still took my pills this morning, like always.' },
      ],
      patient: (K) => ({
        admitH: -50, attending: VAS, given: [['acetaminophen', -7]],
        chart: {
          mrn: '10058826', name: 'Nakoa, Lani', dob: '1955-06-18', sex: 'F', unit: '5 West Medicine', bed: '5W-504', rn: RN1, height: 157, weight: 63.5,
          cc: 'Fever, flank pain, vomiting', dx: 'Acute pyelonephritis',
          allergies: [K.al('Ciprofloxacin (fluoroquinolones)', 'fluoroquinolone', 'Confusion', 'Moderate', 'Intolerance')],
          problems: [K.prob('Acute pyelonephritis, E. coli', 2), K.prob('Acute kidney injury on chronic kidney disease, stage 3a', 2), K.prob('Type 2 diabetes mellitus', 5200), K.prob('Hypertension', 6000), K.prob('Osteoarthritis', 3000)],
          vitals: K.vit([[-49, 39.0, 112, 22, 104, 60, 96, 'Room air', 7], [-36, 38.2, 100, 20, 112, 64, 97, 'Room air', 5], [-24, 37.6, 92, 18, 124, 70, 97, 'Room air', 3], [-12, 37.2, 84, 16, 132, 74, 98, 'Room air', 2], [-2.5, 37.0, 82, 16, 136, 78, 98, 'Room air', 1]], RN1),
          labs: K.labs([
            [-49, 'CBC, BMP, Lactate, A1c', Object.assign(CBC(16.8, 12.2, 36.8, 302), BMP(134, 4.6, 100, 21, 34, 1.6, 248, 9.0), { Lactate: 2.1, A1c: 8.4 })],
            [-26, 'CBC, BMP', Object.assign(CBC(12.1, 11.8, 35.6, 288), BMP(137, 4.5, 103, 22, 38, 1.9, 132, 8.8))],
            [-14, 'POC glucose', { Glu: 96 }],
            [-3, 'CBC, BMP', Object.assign(CBC(9.8, 11.6, 35.0, 280), BMP(138, 4.4, 104, 23, 36, 1.9, 88, 8.8))],
          ]),
          reports: [
            K.rep(-48, 'Microbiology / Other', 'Urinalysis with reflex microscopy', 'Cloudy. Leukocyte esterase 3+. Nitrite positive. White cells over 50 per high-power field with white cell casts. Glucose 2+.', 'Laboratory'),
            K.rep(-22, 'Microbiology / Other', 'Urine culture', 'FINAL: Escherichia coli, more than 100,000 colonies/mL.\nSusceptible: ceftriaxone, gentamicin, nitrofurantoin. Resistant: ampicillin, trimethoprim-sulfamethoxazole.', 'Microbiology'),
            K.rep(-46, 'Imaging', 'US kidneys and bladder', 'FINDINGS: Right kidney mildly enlarged with reduced definition of the cortex. No hydronephrosis, stone or abscess. Left kidney normal. Bladder normal.\n\nIMPRESSION: Findings consistent with right pyelonephritis. No obstruction or abscess.'),
          ],
          notes: [
            K.note(-48, 'H&P', VAS, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Fever, right flank pain and vomiting for 2 days.\n\nHPI: 71 y.o. woman with type 2 diabetes, hypertension and stage 3a chronic kidney disease (baseline creatinine 1.2) presenting with fever to 39.2, rigors, right flank pain, burning on passing urine and vomiting. Eating and drinking very little for 2 days.\n\nHOME MEDICATIONS: insulin glargine 24 units nightly; glipizide 10 mg twice daily; lisinopril 20 mg daily; acetaminophen as needed.\nALLERGIES: ciprofloxacin (confusion).\n\nEXAM: T 39.0, HR 112, BP 104/60. Dry mouth. Right flank tender to percussion. Alert and oriented, speech clear, strength 5/5 in all limbs.\n\nDATA: WBC 16.8, creatinine 1.6 (baseline 1.2), glucose 248, A1c 8.4. Urinalysis with white cell casts.\n\nASSESSMENT & PLAN:\n1. Acute pyelonephritis: ceftriaxone 1 g IV daily, IV fluids, follow the culture.\n2. Acute kidney injury on chronic kidney disease, likely from dehydration: fluids, hold lisinopril, trend creatinine.\n3. Type 2 diabetes, glucose 248: continue home glargine and glipizide, consistent carbohydrate diet.\n4. VTE prophylaxis: enoxaparin.\nCode status: Full.'),
            K.note(-13, 'Nursing Note', RN2, 'nurse', 'NURSING NOTE\n\nAfebrile this shift, flank pain 2/10. Still nauseated: ate two bites of dinner and refused the rest, drank about 200 mL. Evening glucose 96. Glargine 24 units given at 21:00 as ordered. Daughter visited and says her mother “has hardly eaten since Tuesday”.'),
            K.note(-2.4, 'Nursing Note', RN1, 'nurse', 'NURSING NOTE\n\nSlept well. Declined breakfast: “nothing tastes right”. Took morning medicines with sips of water, including glipizide. Speech clear, walking to the bathroom independently at 08:00. Creatinine 1.9 again this morning; team aware.'),
          ],
          encounters: [K.enc(90, 'Office Visit', 'Primary Care', 'Iwasaki, Glenn MD', 'Diabetes follow-up'), K.enc(300, 'Office Visit', 'Nephrology Clinic', 'Okafor, Chidi MD', 'Chronic kidney disease')],
          sim: {
            labs: { Glu: 38 },
            reports: { cthead: 'FINDINGS:\nNo acute intracranial hemorrhage, mass effect or midline shift. Gray-white differentiation is preserved. Mild age-appropriate volume loss.\n\nIMPRESSION:\nNo acute intracranial abnormality. A normal CT does not exclude an early stroke: correlate with the bedside glucose and the examination.' },
            consults: { c_neuro: '1. Seen for sudden slurred speech and right arm weakness. The deficit resolved completely within minutes of IV dextrose.\n2. Diagnosis: hypoglycemia presenting as a stroke mimic. No stroke work-up needed if she stays at baseline.\n3. A bedside glucose belongs in the first minute of any sudden neurological change.\n4. Call again for any deficit that persists with a normal glucose.' },
            story: ['I came in with a fever and a pain in my side, and I was throwing up. That is better now. But nothing tastes right and I have not been eating.', 'I live with my daughter and her family in Waimanalo. I do not smoke or drink. I take my sugar pills and my night-time insulin, I never miss.', 'I felt strange this morning, shaky, and then I could not get my words out. Is it a stroke? My sister had a stroke.'],
          },
        },
        orders: [['code_full'], ['ceftriaxone'], ['ns'], ['glargine', { dose: '24 units' }], ['glipizide'], ['acetaminophen'], ['enoxaparin'], ['diet_carb'], ['vs_q4'], ['fall']],
      }),
      start: 'call',
      nodes: {
        call: {
          title: 'The nurse calls', urgent: true,
          scene: { kind: 'page', lines: ['Your pager goes off. It is Tomas, from 5 West.', '“Ms. Nakoa in 504. She is slurring her words and her right arm keeps drifting down. She was fine at eight.”', '“She is sweaty, and she is not making sense. Can you come now?”'] },
          enter: { vitals: { hr: 108, rr: 18, sbp: 162, dbp: 90, spo2: 97, pain: 0 }, msg: { critical: true, subject: 'Nakoa, Lani — slurred speech, right arm weak', body: 'Ms. Nakoa is slurring her words and her right arm drifts down when she holds it out. She is sweaty and not making sense. She was talking and walking normally at 08:00.\n\nHR 108, BP 162/90. Please come now.\n\nTomas' } },
          story: 'Ms. Nakoa has sudden slurred speech and a drifting right arm. She is sweaty and confused. She was normal at 08:00.',
          ask: { who: 'Tomas, her nurse', q: 'I am at the bedside. What do you want first?', options: [
            { text: 'A fingerstick glucose, right now', to: 'low', grade: 'best', why: 'It takes ten seconds and it finds the commonest stroke mimic. Every stroke protocol starts with it.' },
            { text: 'A STAT CT of the head, and call a stroke alert', to: 'ct', grade: 'ok', why: 'A reasonable reflex and the right next step for a stroke, but the glucose comes first: it is faster than the scanner and it changes everything.' },
            { text: 'Aspirin 325 mg now, in case it is a stroke', to: 'found', grade: 'poor', why: 'Aspirin is held until the head has been imaged, because a bleed looks the same at the bedside. And nobody had checked a glucose.' },
            { text: 'It is probably the infection. Repeat her labs and I will see her after rounds', to: 'found', grade: 'poor', why: 'A sudden focal change is an emergency whatever the admitting diagnosis. It is not explained by an infection that is getting better.' }] },
        },
        low: {
          title: 'Glucose 38', urgent: true,
          enter: { labs: ['POC glucose', { Glu: 38 }], msg: { critical: true, act: 'results', subject: 'Nakoa, Lani — fingerstick glucose 38', body: 'Fingerstick glucose is 38. She cannot swallow safely like this. She has a working IV.\n\nWhat would you like to give?\n\nTomas' } },
          story: 'Her fingerstick glucose is 38. She cannot swallow safely. She has an IV. The nurse is waiting for an order.',
          paths: [DEX('best', 'Dextrose 50% by vein for a glucose of 38', 'IV dextrose is the treatment when a hypoglycemic patient cannot swallow safely.'),
            { after: 0.4, to: 'seizure', grade: 'late', label: 'No treatment ordered for a glucose of 38', why: 'The brain runs on glucose. Twenty minutes at 38 is long enough to seize.' }],
        },
        ct: {
          title: 'Back from the scanner', urgent: true,
          enter: { reports: ['Imaging', 'CT head without contrast', 'FINDINGS: No acute intracranial hemorrhage, mass effect or midline shift.\n\nIMPRESSION: No acute intracranial abnormality.'], labs: ['POC glucose', { Glu: 34 }], vitals: { hr: 116, sbp: 168, dbp: 92 }, msg: { critical: true, act: 'results', subject: 'Nakoa, Lani — CT normal, glucose 34', body: 'She is back from CT: no bleed. The stroke nurse asked whether anyone had checked a glucose, so I did. It is 34.\n\nShe is drowsier now. She has an IV. What would you like to give?\n\nTomas' } },
          story: 'The CT shows no bleed, and forty minutes have gone. The stroke nurse asked for a glucose: 34. She is drowsier.',
          paths: [DEX('ok', 'Dextrose 50%, forty minutes late', 'The right treatment. She spent forty minutes hypoglycemic in a scanner first.'),
            { after: 0.4, to: 'seizure', grade: 'late', label: 'No treatment ordered for a glucose of 34', why: 'A normal CT did not explain her, and the number that did was not acted on.' }],
        },
        found: {
          title: 'Unresponsive', urgent: true,
          enter: { labs: ['POC glucose', { Glu: 29 }], vitals: { hr: 122, rr: 20, sbp: 166, dbp: 94, spo2: 95 }, msg: { critical: true, act: 'results', subject: 'Nakoa, Lani — unresponsive, glucose 29', body: 'Ms. Nakoa will not wake up. She is soaked in sweat. I checked a fingerstick on my own: 29.\n\nShe has an IV. I need an order NOW.\n\nTomas' } },
          story: 'Twenty minutes later she will not wake up and is soaked in sweat. The nurse checked a glucose without being asked: 29.',
          paths: [DEX('ok', 'Dextrose 50% once the nurse found the glucose', 'The right treatment, found by the nurse and not by the team.'),
            { after: 0.3, to: 'seizure', grade: 'late', label: 'No treatment ordered for a glucose of 29', why: 'There was a number, an IV and a nurse asking for an order.' }],
        },
        awake: {
          title: 'Awake again',
          enter: { labs: ['POC glucose', { Glu: 142 }], vitals: { hr: 88, rr: 16, sbp: 138, dbp: 78, spo2: 98 }, truth: { labs: { Glu: 104 } }, msg: { act: 'results', subject: 'Nakoa, Lani — awake, glucose 142', body: 'Two minutes after the dextrose she is talking normally and her arm is strong. Glucose 142. She wants to know what happened.\n\nSo do I. She has had every dose that was ordered.\n\nTomas' } },
          story: 'Two minutes after the dextrose she is talking normally and her arm is strong. Glucose 142. Now find out why this happened: look at what she has actually been given.',
          paths: [
            { when: W.viewed('MAR'), to: 'why', grade: 'best', label: 'Opened the MAR to see what she had been given', why: 'Orders say what was intended. The MAR says what went in: every dose of glargine and glipizide, through two days of almost no food.' },
            { after: 1, to: 'again', grade: 'late', label: 'Nobody asked why it happened', why: 'Dextrose lasts minutes. Glipizide lasts a day, and longer when the kidneys are failing.' }],
        },
        why: {
          title: 'The cause',
          story: 'The MAR shows glargine 24 units every night and glipizide twice a day, all given. The nursing notes say she has hardly eaten for two days. Her creatinine is 1.9, up from 1.2.',
          ask: { who: 'Dr. Vasquez', q: 'So that is the why. What do you want to change?', options: [
            { text: 'Stop the glipizide, cut the glargine, run dextrose, and check her glucose every hour', to: 'safe', grade: 'best', why: 'The sulfonylurea is the dangerous one: it keeps releasing insulin for a day or more, longer with failing kidneys. Dextrose and hourly checks cover that tail.' },
            { text: 'Hold tonight’s glargine and leave the rest', to: 'again', grade: 'ok', why: 'Half right. The glargine was too much, but the glipizide she took this morning is still working.' },
            { text: 'Nothing: she has had dextrose and she is back to normal', to: 'again', grade: 'poor', why: 'Nothing that caused the low has changed, and the dextrose has already worn off.' }] },
        },
        safe: {
          title: 'A safer regimen',
          enter: { stop: ['glipizide', 'glargine'], orders: [['glargine', { dose: '10 units', comment: 'Reduced: eating poorly, creatinine 1.9' }]] },
          story: 'Dr. Vasquez has stopped the glipizide, cut the glargine to 10 units and started dextrose. She wants glucose checks ordered so the nurses follow it.',
          paths: [
            { when: W.ordered('poc_glu'), to: 'end_well', grade: 'best', label: 'Glucose checks ordered', why: 'The sulfonylurea is still on board. Monitoring is how a second low is caught at 70 and not at 40.' },
            { after: 1, to: 'end_well', grade: 'ok', label: 'No glucose checks ordered', why: 'The regimen is safer, but nobody was asked to watch. Her nurse checked anyway.' }],
        },
        again: {
          title: 'It happens again', urgent: true,
          enter: { jump: 16, labs: ['POC glucose', { Glu: 44 }], vitals: { hr: 104, sbp: 150, dbp: 86 }, msg: { critical: true, act: 'results', subject: 'Nakoa, Lani — glucose 44 again', body: 'Ms. Nakoa is sweaty and muddled again. Glucose 44. I have given her juice; she could swallow this time.\n\nThis is the second low today. What is the plan?\n\nTomas' } },
          story: 'At 16:00 she is sweaty and muddled again: glucose 44. The glipizide from this morning is still working.',
          ask: { who: 'Tomas, her nurse', q: 'Second time today. What is the plan?', options: [
            { text: 'Stop the glipizide, cut the glargine, run dextrose, and check her every hour', to: 'end_rocky', grade: 'ok', why: 'The right plan, one hypoglycemic episode later than it was needed.' },
            { text: 'More juice and recheck in the morning', to: 'seizure', grade: 'poor', why: 'Twice in one day is a pattern with a cause, and the cause was still being given.' }] },
        },
        end_well: { title: 'Steady overnight', end: 'well', enter: { labs: ['POC glucose', { Glu: 126 }], set: { dx: 'Acute pyelonephritis; hypoglycemia from sulfonylurea, resolved' }, problems: ['Hypoglycemia due to sulfonylurea with poor intake and kidney injury'] },
          story: 'Her glucose stayed between 110 and 160 overnight on dextrose with hourly checks. She is eating a little. The glipizide is stopped for good while her kidneys recover.' },
        end_rocky: { title: 'A second low', end: 'rocky', enter: { labs: ['POC glucose', { Glu: 118 }], problems: ['Recurrent hypoglycemia due to sulfonylurea'] },
          story: 'She had two episodes of hypoglycemia in one day before the regimen was changed. She is steady now, frightened, and staying two extra days.' },
        seizure: { title: 'Seizure', end: 'icu', scene: { kind: 'rapid', lines: ['Her arms stiffen and she begins to shake.', 'The rapid response team gives dextrose and takes her to intensive care.'] },
          enter: { icu: 'Seizure from untreated hypoglycemia', labs: ['POC glucose', { Glu: 22 }] },
          story: 'She had a seizure with a glucose of 22. She is in intensive care on a dextrose infusion. Whether she recovers fully will not be known for days.' },
      },
    },

    /* ---------------------------------------------------------------------------------------------- */
    {
      id: 'belly', n: 3, pid: 'p10', title: 'Pain after the party', level: 'Two days', glyph: 'flowsheets', startHour: 9,
      brief: 'A 46-year-old man is admitted with severe upper abdominal pain and vomiting. The first day is about the diagnosis and the fluids. The second morning is about something else.',
      debrief: 'Pancreatitis is treated in the first hours with fluid, and the test that makes the diagnosis is a blood test, not a scanner. Then the history comes due: a man who drinks every night and has been in hospital for a day and a half is on a timetable, and the treatment for withdrawal is a benzodiazepine, not an antipsychotic.',
      issues: [
        'What are the three criteria for acute pancreatitis, and how many are needed? When does a CT add anything?',
        'Why lactated Ringer’s, how much, and how do you know when it is enough or too much?',
        'What is the timetable of alcohol withdrawal: tremor, seizures, delirium tremens?',
        'Why do benzodiazepines treat withdrawal when haloperidol does not, and what does haloperidol do to the seizure threshold?',
        'How would you take an alcohol history so that the amount is believable? Where would you record it?',
      ],
      credits: [
        { text: 'Looked for the cause with an ultrasound', why: 'Gallstones and alcohol cause most pancreatitis. An ultrasound tells them apart and a gallstone changes the plan.', test: W.ordered('usruq') },
        { text: 'Ordered withdrawal scoring before he needed it', why: 'A man who drinks every night should be scored for withdrawal from admission, so the first tremor is treated and not the first seizure.', test: W.ordered('ciwa') },
        { text: 'Asked the patient about past withdrawal', why: 'He had a withdrawal seizure two years ago and it was on no list. A past seizure is the strongest warning that the next withdrawal will be severe.', test: W.asked('Have you ever had the shakes, or a fit, when you stopped drinking?') },
      ],
      interview: [
        { q: 'Have you ever had the shakes, or a fit, when you stopped drinking?', a: 'Once. Two years ago I tried to quit cold. The second day my hands would not stop shaking, and my girlfriend says I had a fit on the kitchen floor. I never saw a doctor about it.' },
      ],
      patient: (K) => ({
        admitH: -2.5, attending: VAS,
        chart: {
          mrn: '10064107', name: 'Makana, Joseph', dob: '1980-08-25', sex: 'M', unit: '5 West Medicine', bed: '5W-518', rn: RN1, height: 183, weight: 88.0,
          cc: 'Severe upper abdominal pain and vomiting', dx: 'Abdominal pain, cause to be determined',
          allergies: [K.al('Amoxicillin (penicillins)', 'penicillin', 'Rash', 'Moderate')],
          problems: [K.prob('Abdominal pain, cause to be determined', 0), K.prob('Alcohol use, daily', 3000), K.prob('Hypertriglyceridemia', 900), K.prob('Tobacco use disorder', 7000)],
          vitals: K.vit([[-2.4, 37.6, 116, 22, 132, 84, 97, 'Room air', 9], [-1.2, 37.5, 112, 20, 128, 80, 97, 'Room air', 8], [-0.2, 37.5, 114, 20, 124, 78, 97, 'Room air', 8]], RN1),
          labs: K.labs([[-2.2, 'CBC, CMP (emergency department)', Object.assign(CBC(14.1, 16.9, 50.2, 232), BMP(136, 3.8, 99, 21, 28, 1.3, 164, 8.1), { AST: 142, ALT: 68, ALP: 110, TBili: 1.4, Alb: 3.9 })]]),
          reports: [K.rep(-2.1, 'Cardiology', 'ECG 12-lead', 'Sinus tachycardia, rate 114. Normal axis and intervals. No ST-segment changes.\n\nIMPRESSION: Sinus tachycardia.', 'Cardiology')],
          notes: [K.note(-1, 'H&P', VAS, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Upper abdominal pain and vomiting since last night.\n\nHPI: 46 y.o. man with no regular medical care presenting with 12 hours of severe, constant pain in the upper abdomen going through to the back, worse lying flat and eased a little by leaning forward. Vomited six times. The pain began a few hours after his cousin’s wedding party.\n\nSOCIAL: Drinks “a six-pack most nights, more at the weekend” for about 15 years; last drink about midnight. Smokes half a pack a day.\nHOME MEDICATIONS: none. ALLERGIES: amoxicillin (rash).\n\nEXAM: T 37.6, HR 116, BP 132/84, RR 22. Lying still, knees drawn up. Dry mouth. Marked tenderness in the upper abdomen with guarding, no rigidity. Bowel sounds reduced. No jaundice.\n\nDATA: WBC 14.1, hemoglobin 16.9, BUN 28, creatinine 1.3, calcium 8.1, AST 142, ALT 68, bilirubin 1.4. ECG sinus tachycardia. Lipase and imaging not yet done.\n\nASSESSMENT & PLAN:\n1. Acute upper abdominal pain. Differential: pancreatitis, biliary disease, perforated ulcer, heart attack (ECG reassuring). The team is to complete the work-up and start treatment this morning.\n2. He is dry: hemoglobin and BUN both high. Maintenance fluids running from the emergency department; reassess.\n3. Daily alcohol use: watch for withdrawal.\nNPO for now. Code status: Full.')],
          encounters: [K.enc(700, 'Emergency', 'Emergency Department', 'Brandt, Colin MD', 'Laceration of the hand')],
          sim: {
            labs: { Lipase: 1840, AST: 138, ALT: 66, ALP: 112, TBili: 1.3, Ca: 7.9 },
            reports: {
              usruq: 'FINDINGS:\nGallbladder normal: no stones, no wall thickening. Common bile duct 4 mm. The pancreas is partly hidden by bowel gas; the head and body that can be seen are enlarged.\n\nIMPRESSION:\n1. No gallstones and no bile duct dilatation.\n2. Enlarged pancreas, consistent with acute pancreatitis.',
              ctap: 'FINDINGS:\nThe pancreas is diffusely enlarged with stranding of the surrounding fat. It enhances throughout: no necrosis. No fluid collection. No gallstones. No free air.\n\nIMPRESSION:\nAcute interstitial pancreatitis without complication. (This study adds little to a lipase of three times normal with a typical history.)',
              cxr1: 'FINDINGS:\nLungs clear. No free air under the diaphragm. Heart size normal.\n\nIMPRESSION:\nNo acute cardiopulmonary process. No free air.',
            },
            story: ['It is right here, under my ribs, and it goes straight through to my back. It started the night of my cousin’s wedding. I cannot keep anything down.', 'I live with my girlfriend in Kaneohe. I do construction. I drink, yeah. A six-pack most nights, more on the weekend. I had my last one around midnight.', 'I have never been in a hospital before. How long is this going to take? I cannot miss work.'],
          },
        },
        orders: [['code_full'], ['admit'], ['ns', { dose: '75 mL/hr' }], ['ondansetron'], ['npo'], ['vs_q4'], ['io']],
      }),
      start: 'arrive',
      nodes: {
        arrive: {
          title: 'Admitted with abdominal pain',
          scene: { kind: 'arrive', lines: ['Mr. Makana, 46, comes in doubled over, a day after his cousin’s wedding.', 'The pain goes straight through to his back. He has vomited six times.', 'The emergency department sent basic labs and an ECG. The rest is yours.'] },
          story: 'He has 9/10 upper abdominal pain through to the back, and he is dry. Basic labs and an ECG are done. Make the diagnosis: order the test that will tell you what this is.',
          paths: [
            { when: W.resulted('lipase'), to: 'panc', grade: 'best', label: 'Lipase', why: 'Typical pain plus a lipase over three times normal makes the diagnosis. No scanner needed.' },
            { when: W.resulted('ctap'), to: 'panc', grade: 'ok', label: 'CT of the abdomen before a lipase', why: 'It made the diagnosis, with radiation and contrast that a blood test would have spared him. CT is for doubt or for a patient who is not improving.' },
            { after: 2, to: 'dry', grade: 'late', label: 'No diagnostic test for two hours', why: 'He sat with a differential and maintenance fluids while the first hours of treatment went by.' }],
        },
        panc: {
          title: 'Lipase 1,840',
          enter: { set: { dx: 'Acute pancreatitis' }, problems: ['Acute pancreatitis'], vitals: { hr: 118, rr: 22, sbp: 118, dbp: 74, pain: 9 } },
          story: 'It is acute pancreatitis. His heart rate is 118, his mouth is dry, his BUN is 28 and his hemoglobin is high because he is short of fluid.',
          ask: { who: 'Dr. Vasquez', q: 'Pancreatitis. The first six hours matter most. What does he need?', options: [
            { text: 'Lactated Ringer’s at a generous rate, real pain relief, and food as soon as he wants it', to: 'fluids', grade: 'best', why: 'Early fluid is the one treatment shown to matter. Pain control is not optional, and early feeding beats prolonged fasting.' },
            { text: 'Keep him NPO for several days, with fluids at 75 mL an hour', to: 'dry', grade: 'poor', why: 'Maintenance fluid does not replace what he has lost into his abdomen, and prolonged fasting helps nobody.' },
            { text: 'Broad-spectrum antibiotics, to prevent infection of the pancreas', to: 'dry', grade: 'poor', why: 'Antibiotics do not prevent infection in pancreatitis. What he was short of was fluid.' },
            { text: 'A CT now, to see how severe it is', to: 'dry', grade: 'poor', why: 'A CT on day one underestimates severity and changes nothing. The time went on a scanner and not on fluids.' }] },
        },
        fluids: {
          title: 'The first six hours',
          story: 'Dr. Vasquez agrees. Enter the orders: lactated Ringer’s, and something that will actually control 9/10 pain.',
          paths: [
            { when: W.all(W.ordered('lr'), W.ordered('morphine', 'oxycodone')), to: 'night', grade: 'best', label: 'Lactated Ringer’s and an opioid ordered', why: 'Fluid and pain control, both entered, within the window that matters.' },
            { when: W.ordered('lr'), after: 0.75, to: 'night', grade: 'ok', label: 'Fluids, but nothing for the pain', why: 'The fluids were right. He spent the day at 9/10 with acetaminophen he could not swallow.' },
            { after: 1.25, to: 'dry', grade: 'late', label: 'The fluids were agreed but never ordered', why: 'He stayed on 75 mL an hour.' }],
        },
        dry: {
          title: 'Dry and getting worse', urgent: true,
          enter: { jump: 15, vitals: { hr: 128, rr: 24, sbp: 92, dbp: 58, spo2: 95, pain: 9 }, labs: ['BMP (afternoon)', BMP(134, 4.4, 98, 18, 38, 2.0, 148, 7.6)], msg: { critical: true, subject: 'Makana, Joseph — HR 128, BP 92/58, 60 mL of urine since morning', body: 'Mr. Makana’s heart rate is 128 and his pressure is 92/58. He has passed 60 mL of urine since this morning. The afternoon creatinine is 2.0; it was 1.3.\n\nHe is still on 75 mL an hour. He needs more fluid than that.\n\nTomas' } },
          story: 'By mid-afternoon his heart rate is 128, his pressure is 92/58 and he has passed 60 mL of urine all day. Creatinine 2.0, up from 1.3. He is still on 75 mL an hour.',
          paths: [
            { when: W.now(W.ordered('ns_bolus', 'lr')), to: 'night', grade: 'ok', label: 'Fluid resuscitation, six hours late', why: 'The right treatment. His kidneys paid for the delay.' },
            { after: 0.75, to: 'icu', grade: 'harm', label: 'Still no fluid resuscitation', why: 'Pancreatitis with a falling pressure and no urine is shock.' }],
        },
        night: {
          title: 'The second morning', urgent: true,
          scene: { kind: 'night', lines: ['The fluids run. The pain eases. The afternoon passes, and the night.', 'It is 06:00. Thirty hours since his last drink.', 'The night nurse is at his door, and she is not smiling.'] },
          enter: { jump: 6, vitals: { temp: 37.9, hr: 124, rr: 22, sbp: 168, dbp: 100, spo2: 97, pain: 4 }, labs: ['BMP (morning)', BMP(137, 3.4, 102, 23, 16, 1.0, 118, 8.2)], msg: { critical: true, subject: 'Makana, Joseph — shaking, sweating, seeing things', body: 'Mr. Makana has not slept. His hands are shaking, he is drenched in sweat, and he keeps brushing at “ants” on the blanket. HR 124, BP 168/100, T 37.9. He tried to climb out of bed to go to work.\n\nHis belly is better: pain 4/10.\n\nHana (nights)' } },
          story: 'It is 06:00, thirty hours after his last drink. He is shaking, sweating, seeing ants on the blanket and trying to climb out of bed. HR 124, BP 168/100. His abdomen is better.',
          ask: { who: 'Hana, the night nurse', q: 'He is going to hurt himself. What is this, and what do you want?', options: [
            { text: 'Alcohol withdrawal: lorazepam by symptom score, thiamine, and a quiet, lit room', to: 'ciwa', grade: 'best', why: 'Thirty hours, tremor, sweating, a fast pulse and hallucinations is withdrawal. Benzodiazepines treat it and prevent the seizure that comes next.' },
            { text: 'Haloperidol for the agitation, and soft restraints', to: 'dt', grade: 'poor', why: 'Haloperidol quiets the patient without treating withdrawal, and it lowers the seizure threshold.' },
            { text: 'It is pain: increase the morphine', to: 'dt', grade: 'poor', why: 'His pain was 4/10 and better. The tremor, sweating and hallucinations were the story.' },
            { text: 'It is infection: blood cultures and antibiotics', to: 'dt', grade: 'poor', why: 'A temperature of 37.9 with a tremor and hallucinations thirty hours after the last drink has a likelier explanation.' }] },
        },
        ciwa: {
          title: 'Treating withdrawal', urgent: true,
          story: 'The nurse agrees. Enter the orders: lorazepam, and thiamine.',
          paths: [
            { when: W.all(W.ordered('lorazepam'), W.ordered('thiamine')), to: 'end_well', grade: 'best', label: 'Lorazepam and thiamine ordered', why: 'The benzodiazepine treats the withdrawal. Thiamine protects a brain that has been short of it for years.' },
            { when: W.ordered('lorazepam'), after: 0.5, to: 'end_well', grade: 'ok', label: 'Lorazepam, but no thiamine', why: 'The withdrawal was treated. Thiamine costs nothing and prevents Wernicke encephalopathy; it was missed.' },
            { after: 1, to: 'dt', grade: 'late', label: 'Withdrawal named but not treated', why: 'Naming it is not treating it.' }],
        },
        dt: {
          title: 'A seizure', urgent: true,
          enter: { vitals: { temp: 38.2, hr: 136, rr: 24, sbp: 176, dbp: 104, spo2: 93 }, msg: { critical: true, subject: 'Makana, Joseph — seizure', body: 'Mr. Makana has just had a seizure, about a minute, the whole body. He is breathing and coming round. HR 136.\n\nThis is withdrawal. He needs a benzodiazepine now.\n\nHana (nights)' } },
          story: 'At 07:10 he has a generalised seizure lasting a minute. He is breathing and coming round. This is alcohol withdrawal, untreated.',
          paths: [
            { when: W.now(W.ordered('lorazepam')), to: 'end_rocky', grade: 'ok', label: 'Lorazepam after the seizure', why: 'The right drug, one seizure late.' },
            { after: 0.5, to: 'icu', grade: 'harm', label: 'Still no benzodiazepine', why: 'Withdrawal seizures come in clusters, and delirium tremens follows.' }],
        },
        end_well: { title: 'Home on day four', end: 'well', scene: { kind: 'home', lines: ['The lorazepam settles him within the hour. He sleeps for most of a day.', 'By day four he is eating, pain-free, and has talked to the social worker twice.', 'He walks out with his girlfriend, an appointment, and a plan.'] },
          enter: { home: true, vitals: { temp: 36.9, hr: 78, rr: 16, sbp: 126, dbp: 78, spo2: 98, pain: 1 }, set: { dx: 'Acute alcohol-related pancreatitis, resolved; alcohol withdrawal, treated' } },
          story: 'He settled within the hour on lorazepam and went home on day four, eating, with a follow-up appointment and a referral for alcohol treatment that he asked for himself.' },
        end_rocky: { title: 'A longer stay', end: 'rocky', enter: { vitals: { temp: 37.4, hr: 96, rr: 18, sbp: 138, dbp: 84, spo2: 97, pain: 2 }, problems: ['Alcohol withdrawal seizure'] },
          story: 'He had no further seizures once he was treated. He stayed eight days, bit his tongue badly, and does not remember two of them.' },
        icu: { title: 'Intensive care', end: 'icu', scene: { kind: 'rapid', lines: ['The call goes out overhead: rapid response, 5 West.', 'He leaves the ward on a stretcher with four people around him.'] },
          enter: { icu: 'Shock or seizures from pancreatitis and alcohol withdrawal that were not treated in time' },
          story: 'He was transferred to intensive care. What he needed was ordinary, and it was needed hours earlier.' },
      },
    },

    /* ---------------------------------------------------------------------------------------------- */
    {
      id: 'breath', n: 4, pid: 'p11', title: 'Day two after surgery', level: 'Choose the test', glyph: 'code', startHour: 14.25,
      brief: 'A 64-year-old woman, two days after bowel surgery for cancer, becomes suddenly short of breath on the way to the bathroom.',
      debrief: 'The diagnosis was likely from the door: cancer, surgery, two days without a blood thinner. The decisions were about the patient in front of you: which test her kidneys could afford, which anticoagulant can be switched off if she bleeds, and who has to agree before it starts.',
      issues: [
        'Which features of this patient raise the probability of a pulmonary embolism before any test is done?',
        'Why is a D-dimer unhelpful two days after surgery?',
        'How do you choose between a CT angiogram and a V/Q scan? What does each need from the patient?',
        'Why is an intravenous heparin infusion preferred to enoxaparin or an oral anticoagulant in a patient who has just had surgery and has poor kidney function?',
        'Why are sedatives and diuretics dangerous in an acute pulmonary embolism?',
      ],
      credits: [
        { text: 'Asked the surgeons to see her', why: 'Anticoagulating a two-day-old bowel join is the surgeon’s risk as much as yours. They need to hear it from you.', test: W.ordered('c_surg') },
        { text: 'Ordered a CBC to watch for bleeding on heparin', why: 'A fresh wound on a heparin infusion is watched with a daily hemoglobin and platelet count.', test: W.ordered('cbc') },
        { text: 'Asked the patient about her legs', why: 'Her right calf has ached since yesterday and she told nobody. A painful calf two days after surgery makes a clot the likeliest cause of her breathlessness.', test: W.asked('Have you had any pain or swelling in your legs?') },
      ],
      interview: [
        { q: 'Have you had any pain or swelling in your legs?', a: 'My right calf has ached since yesterday, like a cramp that will not go away. I thought it was from lying in bed, so I did not say anything.' },
        { q: 'Has anyone in your family had a blood clot?', a: 'My mother had one in her lung, after she broke her hip. She was in the hospital a long time.' },
      ],
      patient: (K) => ({
        admitH: -54, attending: TAN, given: [['oxycodone', -9], ['oxycodone', -4]],
        chart: {
          mrn: '10061950', name: 'Tavares, Grace', dob: '1962-02-11', sex: 'F', unit: '4 East Surgery', bed: '4E-409', rn: RN2, height: 160, weight: 87.0,
          cc: 'Right hemicolectomy for colon cancer', dx: 'Adenocarcinoma of the cecum, s/p right hemicolectomy (POD 2)',
          problems: [K.prob('Adenocarcinoma of the cecum, s/p right hemicolectomy', 2), K.prob('Chronic kidney disease, stage 3b', 1500), K.prob('Hypertension', 5000), K.prob('Obesity, BMI 34', 4000), K.prob('Iron deficiency anemia', 200)],
          vitals: K.vit([[-48, 36.9, 84, 16, 134, 80, 97, '2 L NC', 5], [-36, 37.3, 88, 16, 128, 76, 96, 'Room air', 4], [-24, 37.5, 90, 18, 130, 78, 96, 'Room air', 4], [-12, 37.2, 86, 16, 132, 78, 96, 'Room air', 3], [-3, 37.1, 88, 16, 134, 80, 96, 'Room air', 3]], RN2),
          labs: K.labs([
            [-58, 'CBC, BMP, PT/INR (pre-op)', Object.assign(CBC(7.2, 11.4, 34.6, 310), BMP(140, 4.4, 104, 24, 30, 1.8, 104, 9.2), { INR: 1.0 })],
            [-30, 'CBC, BMP', Object.assign(CBC(12.4, 10.1, 30.8, 292), BMP(138, 4.5, 104, 23, 34, 2.0, 132, 8.6))],
            [-6, 'CBC, BMP', Object.assign(CBC(11.6, 9.8, 29.9, 301), BMP(138, 4.6, 103, 22, 38, 2.3, 118, 8.5))],
          ]),
          reports: [K.rep(-50, 'Procedure', 'Pathology, frozen section', 'Right colon: invasive adenocarcinoma. Proximal and distal margins free of tumour. Final report to follow.', 'Pathology')],
          notes: [
            K.note(-51, 'Procedure Note', TAN, 'physician', 'BRIEF OPERATIVE NOTE\n\nProcedure: Laparoscopic converted to open right hemicolectomy with primary anastomosis.\nSurgeon: Tanaka. Anesthesia: general.\nFindings: 4 cm mass of the cecum, no liver or peritoneal disease.\nEstimated blood loss: 400 mL. Operating time 3 hours 40 minutes.\n\nPLAN: Clear liquids, advance as tolerated. Out of bed tomorrow. Persistent oozing at the anastomosis at closure: HOLD pharmacologic VTE prophylaxis for 48 hours; sequential compression devices only. Reassess for heparin on POD 2. Chronic kidney disease: avoid NSAIDs and contrast where possible.'),
            K.note(-5, 'Progress Note', TAN, 'physician', 'SURGERY PROGRESS NOTE - POD 2\n\nS: Pain controlled. Passing flatus. Has been reluctant to walk: “it pulls”. Sat in the chair once yesterday.\nO: Afebrile, HR 88, BP 134/80, SpO2 96% on room air. Abdomen soft, incision clean and dry, no ooze since yesterday. Calves soft; the right is slightly larger than the left.\nLabs: hemoglobin 9.8 (stable), creatinine 2.3 (baseline 1.8).\nA/P: POD 2 right hemicolectomy, progressing. Creatinine up: push oral fluids, avoid contrast and NSAIDs. Oozing has stopped: plan to start heparin prophylaxis this evening. Must walk today.'),
          ],
          encounters: [K.enc(20, 'Office Visit', 'Surgery Clinic', TAN, 'Pre-operative visit, cecal mass'), K.enc(35, 'Procedure', 'Endoscopy', 'Fernandez, Luis MD', 'Colonoscopy: cecal mass')],
          sim: {
            labs: { Ddimer: 4.8, Trop: 0.06, BNP: 310, pH: 7.46, pCO2: 33, HCO3: 23, Lactate: 1.9 },
            reports: {
              ecg: 'Sinus tachycardia, rate 118. S wave in lead I, Q wave and inverted T wave in lead III. Incomplete right bundle branch block, new since the pre-operative tracing.\n\nIMPRESSION: Sinus tachycardia with signs of right heart strain. Consider pulmonary embolism.',
              cxr1: 'FINDINGS:\nLow lung volumes with a little atelectasis at both bases. No consolidation, effusion or pneumothorax. Heart size normal.\n\nIMPRESSION:\nBibasilar atelectasis. Nothing here to explain marked hypoxia.',
              cxr2: 'FINDINGS:\nLow lung volumes with a little atelectasis at both bases. No consolidation, effusion or pneumothorax.\n\nIMPRESSION:\nBibasilar atelectasis. Nothing here to explain marked hypoxia.',
              vq: 'FINDINGS:\nVentilation is uniform. Perfusion images show several large segmental defects in the right lower lobe and the left upper lobe, with normal ventilation in the same regions.\n\nIMPRESSION:\nHIGH PROBABILITY for pulmonary embolism.',
              ctpe: 'FINDINGS:\nFilling defects in the right lower lobe and left upper lobe segmental pulmonary arteries. The right ventricle is mildly enlarged (RV to LV ratio 1.1). No infarct.\n\nIMPRESSION:\nBilateral segmental pulmonary emboli with mild right heart strain.\nNOTE FROM RADIOLOGY: creatinine was 2.3 at the time of this contrast study. Recheck kidney function tomorrow.',
            },
            consults: { c_surg: '1. Seen for pulmonary embolism on POD 2. Incision dry, abdomen soft, no sign of a leak or bleeding.\n2. We agree to anticoagulation with an INTRAVENOUS HEPARIN INFUSION: it can be stopped and reversed within hours if she bleeds.\n3. No enoxaparin at this kidney function and no oral anticoagulant until she is eating reliably.\n4. Daily CBC. Call surgery at once for a falling hemoglobin, abdominal pain or a wet dressing.' },
            story: ['I had the operation on my bowel two days ago, for the cancer. I was doing all right. Then I got up for the bathroom and suddenly I could not get my breath, and it hurts on the right when I breathe in.', 'I live with my husband in Pearl City. I taught third grade for thirty years. I have never smoked.', 'I did not want to walk because it pulled on the stitches. Did I do this to myself?'],
          },
        },
        orders: [['code_full'], ['lr', { dose: '75 mL/hr' }], ['acetaminophen', { dose: '1,000 mg', freq: 'Q8H', prn: false }], ['oxycodone'], ['ondansetron'], ['pantoprazole'], ['scd'], ['diet_clear'], ['vs_q4'], ['io'], ['fall']],
      }),
      start: 'call',
      nodes: {
        call: {
          title: 'Suddenly short of breath', urgent: true,
          scene: { kind: 'page', lines: ['4 East Surgery. Hana’s voice is tight.', '“Ms. Tavares, 409, day two after her bowel resection. She got up to the bathroom and now she cannot catch her breath.”', '“Sats are 88 on room air. Heart rate 122. Please come.”'] },
          enter: { vitals: { hr: 122, rr: 28, sbp: 124, dbp: 78, spo2: 88, o2: 'Room air', pain: 6 }, msg: { critical: true, subject: 'Tavares, Grace — SpO2 88%, HR 122, short of breath', body: 'Ms. Tavares became suddenly short of breath walking to the bathroom. She has sharp pain on the right when she breathes in. SpO2 88% on room air, HR 122, RR 28, BP 124/78. She is frightened.\n\nPlease come now.\n\nHana' } },
          story: 'Two days after bowel surgery she is suddenly short of breath with pain on breathing in. SpO2 88% on room air, heart rate 122. She is frightened.',
          ask: { who: 'Hana, her nurse', q: 'She is 88% and scared. What do you want first?', options: [
            { text: 'Oxygen now, then an ECG and a chest X-ray while I work out whether this is a clot', to: 'workup', grade: 'best', why: 'Treat the hypoxia, then look for the cause. Sudden breathlessness after cancer surgery is a pulmonary embolism until shown otherwise.' },
            { text: 'Lorazepam: she is having a panic attack', to: 'drowsy', grade: 'harm', why: 'Anxiety does not drop the oxygen to 88%. A sedative took away the breathing effort that was keeping her going.' },
            { text: 'Furosemide: she has had a lot of IV fluid since surgery', to: 'worse', grade: 'poor', why: 'Her lungs were clear and her right heart was straining against a clot. It needed filling, and furosemide took it away.' },
            { text: 'It is atelectasis: incentive spirometry, and I will see her in an hour', to: 'late', grade: 'poor', why: 'Atelectasis does not arrive in a minute on the way to the bathroom with pain on breathing in and a heart rate of 122.' }] },
        },
        workup: {
          title: 'Looking for the clot', urgent: true,
          enter: { orders: [['o2', { comment: 'Titrate to SpO2 92% or more' }]], vitals: { hr: 116, rr: 24, sbp: 122, dbp: 76, spo2: 93, o2: '4 L NC', pain: 5 },
            reports: [['Cardiology', 'ECG 12-lead', 'Sinus tachycardia, rate 118. S wave in lead I, Q wave and inverted T wave in lead III. Incomplete right bundle branch block, new since the pre-operative tracing.\n\nIMPRESSION: Sinus tachycardia with signs of right heart strain. Consider pulmonary embolism.', 'Cardiology'], ['Imaging', 'XR chest 1 view, portable', 'FINDINGS: Low lung volumes with a little atelectasis at both bases. No consolidation, effusion or pneumothorax.\n\nIMPRESSION: Bibasilar atelectasis. Nothing here to explain marked hypoxia.']] },
          story: 'On 4 L she is 93%. The ECG shows right heart strain and the chest X-ray is nearly clear. You need a test that shows a clot. Look at her kidney function before you choose it.',
          paths: PE_TEST.concat([
            { when: W.resulted('ddimer'), to: 'dd', grade: 'poor', label: 'D-dimer', why: 'Nearly everyone has a raised D-dimer two days after surgery. A positive result cannot tell you anything, and she is too likely to have a clot for a negative one to reassure.' },
            { after: 1.5, to: 'crash', grade: 'late', label: 'No test for a clot in ninety minutes', why: 'A likely pulmonary embolism sat on oxygen with no diagnosis and no treatment.' }]),
        },
        ctstop: {
          title: 'The CT is stopped', urgent: true,
          enter: { stop: ['ctpe'], msg: { from: TAN, subject: 'Tavares, Grace — CT angiogram stopped', body: 'I have stopped the CT angiogram. Her creatinine is 2.3, up from 1.8, and the contrast could push her kidneys into failure.\n\nShe still needs a test that shows a clot. A V/Q scan answers the same question without contrast.\n\nMiriam Tanaka' } },
          story: 'Dr. Tanaka has stopped the contrast CT: at a creatinine of 2.3 it could push her kidneys into failure. She still needs a test that shows a clot.',
          paths: [
            { when: W.resulted('vq'), to: 'pe', grade: 'ok', label: 'V/Q scan, once the CT was stopped', why: 'The right test in the end, after time spent on one her kidneys could not afford.' },
            { after: 1, to: 'crash', grade: 'late', label: 'No test for a clot after the CT was stopped', why: 'Stopping the wrong test is not the same as ordering the right one.' }],
        },
        dd: {
          title: 'A D-dimer of 4.8', urgent: true,
          story: 'The D-dimer is 4.8: raised, as it would be in anyone two days after an operation. It has told you nothing. She still needs a test that shows a clot.',
          paths: PE_TEST.concat([{ after: 1, to: 'crash', grade: 'late', label: 'No imaging after the D-dimer', why: 'A positive D-dimer is not a diagnosis.' }]),
        },
        late: {
          title: 'An hour later', urgent: true,
          enter: { vitals: { hr: 128, rr: 30, sbp: 112, dbp: 70, spo2: 86, o2: '6 L NC', pain: 6 }, msg: { critical: true, subject: 'Tavares, Grace — worse: 86% on 6 L', body: 'Ms. Tavares is worse. I started oxygen on my own: she is 86% on 6 L, HR 128. The spirometer is on the floor; she cannot use it.\n\nThis is not atelectasis. What test do you want?\n\nHana' } },
          story: 'An hour later she is 86% on 6 L with a heart rate of 128. The nurse started oxygen herself. She needs a test that shows a clot, chosen for her kidneys.',
          paths: PE_TEST.concat([{ after: 1, to: 'crash', grade: 'late', label: 'Still no test for a clot', why: 'She was getting worse in front of everyone.' }]),
        },
        worse: {
          title: 'Blood pressure 84/50', urgent: true,
          enter: { vitals: { hr: 134, rr: 30, sbp: 84, dbp: 50, spo2: 87, o2: '4 L NC' }, msg: { critical: true, subject: 'Tavares, Grace — BP 84/50 after furosemide', body: 'Twenty minutes after the furosemide Ms. Tavares is light-headed. BP 84/50, HR 134, SpO2 87% on 4 L that I started. Her lungs sound clear to me.\n\nShe needs fluid back. Can you order it?\n\nHana' } },
          story: 'Twenty minutes after the furosemide her pressure is 84/50 and her heart rate 134. Her lungs are clear. Her right heart needed that fluid.',
          paths: [
            { when: W.now(W.ordered('ns_bolus', 'lr')), to: 'workup', grade: 'ok', label: 'IV fluid to restore the pressure', why: 'A strained right ventricle depends on its filling. Giving the fluid back was right.' },
            { after: 0.5, to: 'crash', grade: 'harm', label: 'Nobody restored the blood pressure', why: 'A pulmonary embolism with a falling pressure is the one that kills.' }],
        },
        drowsy: {
          title: 'Drowsy, 82%', urgent: true,
          enter: { vitals: { hr: 112, rr: 12, sbp: 108, dbp: 64, spo2: 82, o2: 'Room air' }, msg: { critical: true, subject: 'Tavares, Grace — drowsy, SpO2 82%', body: 'Ms. Tavares is calm now because she is barely awake. RR 12, SpO2 82% on room air. This was not panic.\n\nShe needs oxygen. Can you order it?\n\nHana' } },
          story: 'After the lorazepam she is calm because she is barely awake: breathing 12 a minute, SpO2 82% on room air.',
          paths: [
            { when: W.now(W.ordered('o2')), to: 'workup', grade: 'ok', label: 'Oxygen, and a proper look for the cause', why: 'Oxygen first, as it should have been at the start.' },
            { after: 0.5, to: 'crash', grade: 'harm', label: 'Sedated and hypoxic, with no oxygen ordered', why: 'She was left at 82%.' }],
        },
        pe: {
          title: 'Pulmonary embolism',
          enter: { set: { dx: 'Acute pulmonary embolism, POD 2 after right hemicolectomy' }, problems: ['Acute pulmonary embolism with right heart strain'] },
          story: 'The scan shows pulmonary emboli in both lungs. Her pressure is holding. She is two days out from a bowel resection with a join that was oozing, and her creatinine is 2.3.',
          ask: { who: 'Dr. Tanaka, her surgeon', q: 'I have seen the scan. That anastomosis is two days old. What are you proposing?', options: [
            { text: 'A heparin infusion: it can be turned off and reversed within hours if she bleeds', to: 'anticoag', grade: 'best', why: 'She needs anticoagulation, and a fresh wound and poor kidneys both argue for the drug that is easiest to stop.' },
            { text: 'Treatment-dose enoxaparin under the skin', to: 'end_rocky', grade: 'ok', why: 'It treats the clot, but enoxaparin is cleared by the kidneys: at a creatinine of 2.3 it builds up, and it cannot be switched off.' },
            { text: 'A clot-busting drug, to clear it quickly', to: 'bleed', grade: 'harm', why: 'Thrombolysis is for a pulmonary embolism with shock. Two days after surgery, with a stable pressure, it bought a catastrophic bleed.' },
            { text: 'No anticoagulation until day 7: the bleeding risk is too high', to: 'crash', grade: 'poor', why: 'An untreated pulmonary embolism with right heart strain has a high chance of a second, larger clot. The risk of bleeding is managed, not avoided.' }] },
        },
        anticoag: {
          title: 'Starting heparin', story: 'Dr. Tanaka agrees to a heparin infusion and wants a daily blood count. Enter the order.',
          paths: [
            { when: W.ordered('heparin_gtt'), to: 'end_well', grade: 'best', label: 'Heparin infusion ordered', why: 'Agreed with the surgeon, then entered.' },
            { after: 1, to: 'crash', grade: 'late', label: 'Heparin agreed but never ordered', why: 'An hour after everyone agreed, nothing was running.' }],
        },
        end_well: { title: 'Breathing easier', end: 'well', enter: { vitals: { hr: 92, rr: 18, sbp: 126, dbp: 78, spo2: 96, o2: '2 L NC', pain: 2 }, labs: ['CBC (next morning)', CBC(10.9, 9.6, 29.2, 288)] },
          story: 'On heparin her heart rate settled overnight and she is on 2 L of oxygen. Her hemoglobin is steady and the wound is dry. She walked to the door and back this morning.' },
        end_rocky: { title: 'A wound bleed on day four', end: 'rocky', enter: { vitals: { hr: 104, rr: 20, sbp: 108, dbp: 66, spo2: 95, o2: '2 L NC', pain: 5 }, labs: ['CBC (day 4)', CBC(12.2, 7.4, 22.6, 270)], problems: ['Wound hematoma on enoxaparin'] },
          story: 'The clot was treated. On day four the enoxaparin, building up with her kidney function, bled into the wound: hemoglobin 7.4, two units of blood and a return to theatre.' },
        bleed: { title: 'Bleeding into the abdomen', end: 'icu', scene: { kind: 'rapid', lines: ['Forty minutes after the infusion her abdomen is tight and her pressure is gone.', 'She goes back to theatre, and from there to intensive care.'] },
          enter: { icu: 'Major bleeding after thrombolysis two days after surgery', vitals: { hr: 140, rr: 28, sbp: 70, dbp: 40, spo2: 92 } },
          story: 'She bled into her abdomen after thrombolysis and went back to theatre. She is in intensive care on a ventilator.' },
        crash: { title: 'Collapse', end: 'icu', scene: { kind: 'rapid', lines: ['She stands up, says “I feel strange”, and goes down.', 'A second, larger clot. The team gets a pulse back and takes her to intensive care.'] },
          enter: { icu: 'Massive pulmonary embolism', vitals: { hr: 138, rr: 32, sbp: 76, dbp: 44, spo2: 80, o2: 'Non-rebreather' } },
          story: 'A second, larger clot stopped her heart for two minutes. She is in intensive care.' },
      },
    },

    /* ---------------------------------------------------------------------------------------------- */
    {
      id: 'sundown', n: 5, pid: 'p12', title: 'Sundown', level: 'Look before you treat', glyph: 'notes', startHour: 17.5,
      brief: 'An 84-year-old man, getting better from pneumonia, becomes agitated at dusk and starts pulling at his IV. The nurse wants something to calm him down.',
      debrief: 'Delirium is a symptom with a cause, and in an older patient the cause is usually ordinary: a full bladder, a new medicine, pain, the dark. The chart held two of them. Sedation treats the staff’s problem and makes the patient’s worse.',
      issues: [
        'How do you tell delirium from dementia at the bedside? What does the Confusion Assessment Method ask?',
        'List the common precipitants of delirium in hospital. Which can be found from the record alone?',
        'Which medicines on the Beers list are most often to blame, and why is diphenhydramine one of them?',
        'Why do benzodiazepines and restraints make delirium worse? When is a low dose of an antipsychotic justified?',
        'What non-drug measures prevent delirium, and whose job is each one?',
      ],
      credits: [
        { text: 'Checked the MAR for new medicines', why: 'Diphenhydramine was started last night and given twice. It causes both confusion and urinary retention in older men.', test: W.viewed('MAR') },
        { text: 'Sent a urinalysis', why: 'Infection is one of the common causes, and a retained bladder is a set-up for one.', test: W.ordered('ua') },
        { text: 'Asked the patient about passing water', why: 'He needed to go and could not, and his lower belly hurt. In an older man with a large prostate that is retention until a scan says otherwise.', test: W.asked('When did you last pass water? Does anything hurt?') },
      ],
      interview: [
        { q: 'When did you last pass water? Does anything hurt?', a: 'I need to go and nothing comes. It hurts, down here, low down. Since this morning. Nobody will let me go.' },
        { q: 'Did they give you anything new to help you sleep?', a: 'A little pink pill. Last night, and again today. My mouth is so dry I can hardly talk.' },
      ],
      patient: (K) => ({
        admitH: -68, attending: VAS, given: [['diphenhydramine', -19.5, 'For sleep'], ['oxycodone', -18], ['oxycodone', -7], ['diphenhydramine', -2.5, 'Restless, asking to go home']],
        chart: {
          mrn: '10047283', name: 'Ito, Harold', dob: '1942-09-03', sex: 'M', unit: '5 West Medicine', bed: '5W-514', rn: RN2, height: 165, weight: 61.0,
          cc: 'Cough, fever and weakness', dx: 'Community-acquired pneumonia, improving',
          allergies: [K.al('Sulfonamide antibiotics', 'sulfa', 'Rash', 'Moderate')],
          problems: [K.prob('Community-acquired pneumonia, left lower lobe', 3), K.prob('Mild dementia (Alzheimer type)', 900), K.prob('Benign prostatic hyperplasia', 2500), K.prob('Hearing loss, wears hearing aids', 3000), K.prob('Chronic low back pain', 4000), K.prob('Hypertension', 7000)],
          vitals: K.vit([[-67, 38.6, 104, 24, 118, 66, 90, '2 L NC', 3], [-48, 37.9, 96, 20, 124, 70, 93, '2 L NC', 3], [-30, 37.3, 88, 18, 130, 74, 94, '1 L NC', 4], [-12, 37.0, 80, 16, 134, 76, 95, 'Room air', 4], [-4, 37.1, 84, 16, 138, 78, 95, 'Room air', 5]], RN2),
          labs: K.labs([
            [-67, 'CBC, BMP, Lactate, Procalcitonin', Object.assign(CBC(15.6, 13.1, 39.4, 244), BMP(133, 4.2, 99, 23, 26, 1.1, 124, 8.9), { Lactate: 1.8, PCT: 2.1 })],
            [-28, 'CBC, BMP', Object.assign(CBC(11.2, 12.8, 38.6, 252), BMP(136, 4.0, 101, 24, 20, 1.0, 108, 8.8))],
            [-5, 'CBC, BMP', Object.assign(CBC(9.4, 12.6, 38.0, 260), BMP(137, 4.1, 102, 25, 22, 1.2, 102, 8.9))],
          ]),
          reports: [K.rep(-66, 'Imaging', 'XR chest 2 views', 'FINDINGS: Airspace opacity in the left lower lobe. No effusion. Heart size normal.\n\nIMPRESSION: Left lower lobe pneumonia.')],
          notes: [
            K.note(-66, 'H&P', VAS, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Cough, fever and weakness for 3 days.\n\nHPI: 84 y.o. man with mild dementia, an enlarged prostate and hearing loss, brought in by his daughter with 3 days of cough, fever and weakness. At home he dresses and feeds himself, knows his family, and walks with a cane. He is usually calm and pleasant.\n\nHOME MEDICATIONS: tamsulosin 0.4 mg nightly; amlodipine 5 mg daily; acetaminophen as needed. His daughter keeps his pills.\nALLERGIES: sulfonamide antibiotics (rash).\n\nEXAM: T 38.6, HR 104, RR 24, SpO2 90% on room air. Thin, pleasant, oriented to person and place. Crackles at the left base. Abdomen soft.\n\nDATA: WBC 15.6, procalcitonin 2.1. Chest X-ray: left lower lobe pneumonia.\n\nASSESSMENT & PLAN:\n1. Community-acquired pneumonia: ceftriaxone and azithromycin, oxygen.\n2. Mild dementia, HIGH RISK OF DELIRIUM: hearing aids and glasses on, up in the chair for meals, lights on by day, family at the bedside when possible. AVOID sedatives and anticholinergic medicines.\n3. Enlarged prostate: continue tamsulosin.\nCode status: Full, confirmed with the patient and his daughter.'),
            K.note(-19, 'Progress Note', RES, 'physician', 'NIGHT FLOAT NOTE\n\nCalled at 22:00: patient awake, calling out, asking for his wife (deceased). Not sleeping. Back pain 6/10.\nOrdered diphenhydramine 25 mg by mouth every 6 hours as needed for sleep, and oxycodone 2.5 mg as needed for pain. First doses given. Settled by 23:30.'),
            K.note(-3, 'Nursing Note', RN2, 'nurse', 'NURSING NOTE\n\nPneumonia improving: afebrile, off oxygen since this morning. Ate half of lunch. More restless since about 14:00; diphenhydramine given at 15:30 for restlessness. His hearing aids and glasses went home with his daughter on Tuesday. He last passed urine at about 08:00, a small amount. Daughter due to visit after work.'),
          ],
          encounters: [K.enc(40, 'Office Visit', 'Geriatrics Clinic', 'Aldana, Rafael MD', 'Memory follow-up'), K.enc(200, 'Office Visit', 'Urology Clinic', 'Brandt, Colin MD', 'Benign prostatic hyperplasia')],
          sim: {
            labs: { WBC: 9.1, Na: 137, Glu: 104, Cr: 1.4, BUN: 28, Ca: 8.9 },
            reports: {
              bladder: 'Post-void residual volume: 940 mL (normal is under 100 mL).\nThe bladder can be felt to the level of the navel.',
              ua: 'Color: yellow. Clarity: clear.\nSpecific gravity 1.020, pH 6.0.\nProtein, glucose, ketones, blood: negative.\nLeukocyte esterase: negative. Nitrite: negative.',
              cthead: 'FINDINGS:\nNo acute intracranial hemorrhage or mass effect. Volume loss in keeping with age and known dementia.\n\nIMPRESSION:\nNo acute intracranial abnormality.',
            },
            story: ['Where is Mariko? I have to catch the bus. Who are you? I cannot hear you. Something is wrong down here, I need to go, I need to go.', 'I live with my daughter. She is at work. I was a bus mechanic for forty years.', 'I need to go to the bathroom and nobody will let me.'],
          },
        },
        orders: [['code_full'], ['ceftriaxone'], ['azithromycin'], ['tamsulosin'], ['amlodipine'], ['acetaminophen'], ['oxycodone', { dose: '2.5 mg', by: RES, signedBy: RES }], ['diphenhydramine', { freq: 'Q6H', comment: 'For sleep', by: RES, signedBy: RES }], ['enoxaparin'], ['diet_reg'], ['fall'], ['vs_q4']],
      }),
      start: 'call',
      nodes: {
        call: {
          title: 'Agitated at dusk', urgent: true,
          scene: { kind: 'page', lines: ['17:30. The light is going on 5 West.', '“Mr. Ito in 514 is trying to pull his IV out. He is shouting for someone called Mariko and he has one leg over the rail.”', '“He was fine this morning. Can I have something to calm him down?”'] },
          enter: { msg: { critical: true, subject: 'Ito, Harold — agitated, pulling at his IV', body: 'Mr. Ito is trying to pull his IV out and has one leg over the bed rail. He is shouting for Mariko (his late wife) and says he has to catch the bus. He does not know where he is. This morning he was calm and knew me.\n\nCan I have something to calm him down?\n\nHana' } },
          story: 'Mr. Ito, 84, is agitated at dusk: pulling at his IV, one leg over the rail, calling for his late wife. This morning he was calm and oriented.',
          ask: { who: 'Hana, his nurse', q: 'Can I have something to calm him down?', options: [
            { text: 'Not yet. I am coming to look at him: vital signs, and tell me what has changed today', to: 'assess', grade: 'best', why: 'A sudden change in an older patient is delirium until shown otherwise, and delirium has a cause. Looking comes before sedating.' },
            { text: 'Lorazepam 1 mg by vein, so he does not hurt himself', to: 'sedated', grade: 'harm', why: 'Benzodiazepines cause and worsen delirium in older people, and at 84 a milligram is a large dose.' },
            { text: 'Soft wrist restraints and a bed alarm', to: 'restrained', grade: 'poor', why: 'Restraints make an agitated, frightened man more agitated, and they treat nothing.' },
            { text: 'This is his dementia. Sundowning. Keep an eye on him', to: 'fall', grade: 'poor', why: 'Dementia does not change in an afternoon. A sudden change is delirium, and it was not looked for.' }] },
        },
        assess: {
          title: 'At the bedside',
          enter: { vitals: { temp: 37.2, hr: 98, rr: 18, sbp: 152, dbp: 84, spo2: 95, o2: 'Room air', pain: 6 } },
          story: 'He is afebrile and his oxygen is fine. He cannot hear you. He keeps tugging at his gown over his lower belly, which is firm and tender. He last passed urine at 08:00. Find the cause: there is a bedside test for this.',
          paths: [
            { when: W.resulted('bladder'), to: 'retention', grade: 'best', label: 'Bladder scan', why: 'A firm lower abdomen, no urine since morning, a large prostate and a new anticholinergic: a scan takes a minute and finds a litre.' },
            { when: W.ordered('foley'), after: 0.3, to: 'retention', grade: 'ok', label: 'A catheter without a scan', why: 'It drained the bladder, and it was right this time. A scan first avoids a catheter in a man who does not need one.' },
            { after: 1.25, to: 'fall', grade: 'late', label: 'No cause found in over an hour', why: 'He was examined and then left with a full bladder.' }],
        },
        restrained: {
          title: 'In restraints', urgent: true,
          enter: { vitals: { temp: 37.3, hr: 124, rr: 22, sbp: 172, dbp: 96, spo2: 95, pain: 7 }, msg: { subject: 'Ito, Harold — fighting the restraints', body: 'Mr. Ito is fighting the restraints and his wrists are red. HR 124. His daughter has just arrived and is very upset to find him tied down.\n\nHe keeps saying he needs to go. His lower belly looks swollen. He has not passed urine since 08:00.\n\nHana' } },
          story: 'In restraints he fights harder: heart rate 124, wrists red. His daughter has arrived and is upset. He keeps saying he needs to go, and his lower belly is swollen.',
          paths: [
            { when: W.resulted('bladder'), to: 'retention', grade: 'ok', label: 'Bladder scan, after the restraints', why: 'The cause was found. He spent half an hour tied down with a full bladder first.' },
            { after: 1, to: 'fall', grade: 'late', label: 'Left in restraints with no cause sought', why: 'Restraints were the whole plan.' }],
        },
        sedated: {
          title: 'Too drowsy', urgent: true,
          enter: { vitals: { hr: 86, rr: 10, sbp: 104, dbp: 60, spo2: 87, o2: 'Room air', pain: 0 }, msg: { critical: true, subject: 'Ito, Harold — hard to wake, SpO2 87%', body: 'After the lorazepam Mr. Ito slept for ten minutes. Now he is hard to wake, breathing 10 a minute, SpO2 87% on room air. He had oxycodone and diphenhydramine today as well.\n\nHe needs oxygen. Can you order it?\n\nHana' } },
          story: 'After the lorazepam he is hard to wake, breathing 10 a minute, SpO2 87%. He had oxycodone and diphenhydramine today as well.',
          paths: [
            { when: W.now(W.ordered('o2')), to: 'assess', grade: 'ok', label: 'Oxygen, then a proper assessment', why: 'Oxygen was the right response to the harm. The assessment should have come before the sedative.' },
            { after: 0.5, to: 'icu', grade: 'harm', label: 'Sedated and hypoxic, with no oxygen ordered', why: 'Three sedating drugs in an 84-year-old, and nobody watching his breathing.' }],
        },
        retention: {
          title: '940 mL',
          enter: { problems: ['Acute urinary retention'] },
          story: 'The bladder holds 940 mL. He has an enlarged prostate, and since last night he has had two doses of diphenhydramine and two of oxycodone. His hearing aids and glasses are at home.',
          ask: { who: 'Dr. Vasquez', q: 'Nearly a litre. What do you want to do about it, and about why it happened?', options: [
            { text: 'Drain the bladder with a catheter; stop the diphenhydramine and review the oxycodone; get his hearing aids, glasses and daughter to the bedside', to: 'calm', grade: 'best', why: 'Relieve the retention, remove the drug that caused it, and give him back his senses. That treats the delirium and its causes.' },
            { text: 'A catheter, and leave his medicines as they are', to: 'again', grade: 'ok', why: 'The bladder was drained, and the anticholinergic that filled it is still ordered.' },
            { text: 'Give tonight’s tamsulosin early and rescan in the morning', to: 'fall', grade: 'poor', why: 'Tamsulosin works over days. He had a litre of urine in his bladder now.' }] },
        },
        calm: {
          title: 'Fixing the cause',
          enter: { stop: ['diphenhydramine'] },
          story: 'Dr. Vasquez has stopped the diphenhydramine and his daughter is bringing the hearing aids. Enter the order for the catheter.',
          paths: [
            { when: W.ordered('foley'), to: 'end_well', grade: 'best', label: 'Urinary catheter ordered', why: 'With the bladder drained he had no more reason to climb out of bed.' },
            { after: 1, to: 'fall', grade: 'late', label: 'The catheter was agreed but never ordered', why: 'The cause was known and still in place.' }],
        },
        again: { title: 'The same thing at 02:00', end: 'rocky', enter: { jump: 2, vitals: { hr: 108, sbp: 158, dbp: 88, pain: 5 }, problems: ['Delirium, recurrent'] },
          story: 'He settled once the bladder was drained. At 02:00 the night nurse gave diphenhydramine for sleep, as ordered, and he was confused again until noon. He stayed three extra days.' },
        fall: { title: 'A fall', end: 'rocky', enter: { jump: 19.25, vitals: { hr: 112, sbp: 160, dbp: 90, pain: 8 }, reports: [['Imaging', 'CT head without contrast', 'FINDINGS: No acute intracranial hemorrhage. Scalp swelling over the left forehead.\n\nIMPRESSION: No acute intracranial abnormality.'], ['Imaging', 'XR left wrist', 'FINDINGS: Fracture of the distal radius with slight dorsal angulation.\n\nIMPRESSION: Distal radius fracture.']], problems: ['Fall in hospital with fracture of the left wrist'] },
          story: 'At 19:15 he climbed over the rail to reach the bathroom and fell. The head CT is clear. His left wrist is broken. His bladder held a litre.' },
        end_well: { title: 'Calm within the hour', end: 'well', scene: { kind: 'home', lines: ['A litre of urine drains. His shoulders come down from around his ears.', 'His daughter arrives with his hearing aids and puts them in. “Dad. It is me.”', '“Emi,” he says. “Did I miss the bus?”'] },
          enter: { vitals: { temp: 37.0, hr: 78, rr: 16, sbp: 134, dbp: 76, spo2: 96, pain: 2 }, set: { dx: 'Community-acquired pneumonia, improving; delirium from urinary retention and medication, resolved' } },
          story: 'With the bladder drained, the diphenhydramine stopped and his hearing aids in, he was calm within the hour and knew his daughter. He went home two days later.' },
        icu: { title: 'Intensive care', end: 'icu', scene: { kind: 'rapid', lines: ['His breathing slows, then stops.', 'The rapid response team bags him and takes him to intensive care.'] },
          enter: { icu: 'Respiratory depression after sedation' },
          story: 'He stopped breathing after three sedating drugs and was taken to intensive care. His daughter arrived as the team was leaving the room.' },
      },
    },
    /* ---------------------------------------------------------------------------------------------- */
    {
      id: 'unit', n: 6, pid: 'p13', title: 'The second unit', level: 'Stop, then think', glyph: 'mar', startHour: 15,
      brief: 'A 67-year-old man is being transfused for a hemoglobin of 6.4. The first unit went in without trouble. Fifteen minutes into the second, his nurse calls.',
      debrief: 'In any reaction during a transfusion the first act is the same: stop the blood and keep the vein. Everything else can wait thirty seconds. And when the cause is a mix-up, there is a second patient in the story: the one whose blood this was.',
      issues: [
        'How do a febrile non-hemolytic reaction, an allergic reaction and an acute hemolytic reaction differ in the first fifteen minutes? Why is the first step the same for all three?',
        'What does the blood bank need back after a suspected reaction, and what do the repeat tests show in hemolysis?',
        'Why does free hemoglobin injure the kidneys, and what protects them?',
        'At which steps between the sample and the bedside can a transfusion go to the wrong patient? Which checks catch each one?',
        'This unit has two patients with nearly the same name. What does the record do to help, and what does it leave to people?',
      ],
      credits: [
        { text: 'Rechecked his potassium and kidney function', why: 'Burst red cells release potassium, and free hemoglobin injures the kidney. Both need a number today.', test: W.ordered('bmp', 'cmp') },
        { text: 'Signed a note about the reaction', why: 'A transfusion reaction is documented the same day: what was seen, what was stopped, what was sent.', test: W.note(['transfusion', 'hemoly', 'reaction']) },
        { text: 'Asked the patient how the bag was checked', why: 'Only his surname was checked before the second unit. That points to the wrong blood before any test comes back, and to another patient.', test: W.asked('Did the nurse check your name band before this bag?') },
      ],
      interview: [
        { q: 'Did the nurse check your name band before this bag?', a: 'The nurse with this one just said “Mr. Fonoti?” and I said yes. She did not look at my band. The first nurse read out my birthday and checked my band twice.' },
      ],
      patient: (K) => ({
        admitH: -9, attending: PARK,
        chart: {
          mrn: '10066418', name: 'Fonoti, Sione', dob: '1959-07-21', sex: 'M', unit: '5 West Medicine', bed: '5W-507', rn: RN1, height: 180, weight: 104.0, nameAlert: true,
          cc: 'Weakness and breathlessness on the stairs', dx: 'Symptomatic iron deficiency anemia',
          problems: [K.prob('Symptomatic iron deficiency anemia, hemoglobin 6.4', 0), K.prob('Colon polyps, colonoscopy due', 300), K.prob('Hypertension', 4000), K.prob('Gout', 2000)],
          vitals: K.vit([[-8.8, 36.7, 104, 20, 118, 70, 96, 'Room air', 0], [-5, 36.8, 96, 18, 122, 72, 97, 'Room air', 0], [-1.5, 36.9, 88, 16, 126, 76, 98, 'Room air', 0], [-0.4, 37.0, 86, 16, 128, 76, 98, 'Room air', 0]], RN1),
          labs: K.labs([[-8.5, 'CBC, BMP, Iron studies', Object.assign(CBC(6.9, 6.4, 21.0, 410), BMP(139, 4.2, 104, 24, 18, 1.0, 104, 9.0))], [-1.2, 'CBC (after unit 1)', CBC(7.0, 7.3, 23.4, 398)]]),
          reports: [K.rep(-8, 'Microbiology / Other', 'Type and screen', 'ABO/Rh: O positive.\nAntibody screen: negative.\n2 units packed red blood cells crossmatched.', 'Blood Bank')],
          notes: [
            K.note(-8, 'H&P', PARK, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Three weeks of weakness, and breathlessness on the stairs.\n\nHPI: 67 y.o. man with hypertension and gout, sent in by his primary care doctor for a hemoglobin of 6.4. He has noticed dark red blood mixed with his stool on and off for two months. A colonoscopy three years ago found polyps; he missed the follow-up. No chest pain. No black stools.\n\nHOME MEDICATIONS: amlodipine 5 mg daily; allopurinol 300 mg daily.\nALLERGIES: none known. He has never had a transfusion.\n\nEXAM: HR 104, BP 118/70. Pale. Heart sounds normal with a soft flow murmur. Abdomen soft. Brown stool, positive for blood.\n\nDATA: hemoglobin 6.4, MCV 68, ferritin 4. Blood group O positive.\n\nASSESSMENT & PLAN:\n1. Symptomatic iron deficiency anemia from chronic bowel blood loss: transfuse 2 units of red cells today, recheck after each. IV iron tomorrow. GI consulted for colonoscopy.\n2. NAME ALERT: another patient on 5 West is Fonoti, Siaosi (5W-509). Two identifiers at every step.\nCode status: Full.'),
            K.note(-1, 'Nursing Note', RN1, 'nurse', 'NURSING NOTE\n\nUnit 1 of red cells finished at 13:40 with no reaction; vital signs stable throughout. Hemoglobin 7.3 afterwards. Unit 2 collected from the blood bank at 14:35 by the float nurse during the lunch handover and started at 14:45.'),
          ],
          encounters: [K.enc(2, 'Office Visit', 'Primary Care', 'Iwasaki, Glenn MD', 'Fatigue; hemoglobin 6.4'), K.enc(1100, 'Procedure', 'Endoscopy', 'Fernandez, Luis MD', 'Colonoscopy: three polyps removed')],
          sim: {
            labs: { Hgb: 7.0, Hct: 22.1, K: 5.4, Cr: 1.4, BUN: 24, TBili: 3.4, Lactate: 2.6, AST: 88 },
            reports: {
              ts: 'POST-TRANSFUSION SAMPLE\nPatient ABO/Rh: O positive (confirmed on a new sample).\nReturned unit: A positive, labelled for FONOTI, SIAOSI, MRN 10066481.\nDirect antiglobulin test: POSITIVE. Plasma is pink (free hemoglobin).\n\nINTERPRETATION: ABO-INCOMPATIBLE TRANSFUSION. Acute hemolytic transfusion reaction. The blood bank medical director has been called. The other patient’s crossmatched units are on hold.',
              ua: 'Color: red-brown. Clarity: clear.\nBlood: 3+ on dipstick. Microscopy: NO red cells seen.\n\nCOMMENT: Blood on the dipstick without red cells means free hemoglobin in the urine.',
            },
            story: ['I have been so tired I could hardly get up the stairs. They said my blood was very low. The first bag was fine. This one, my back started to hurt, and I feel cold and shaky and frightened.', 'I live with my wife and my son’s family in Waianae. I drove a tour bus until last year. I do not smoke.', 'Something is wrong. I can feel it. Please do not leave.'],
          },
        },
        orders: [['code_full'], ['admit'], ['prbc', { comment: '2 units; recheck CBC after each' }], ['amlodipine'], ['acetaminophen'], ['scd'], ['vs_q4'], ['diet_reg'], ['c_gi']],
      }),
      start: 'call',
      nodes: {
        call: {
          title: 'Fifteen minutes into the unit', urgent: true,
          scene: { kind: 'page', lines: ['It is Tomas, and he is talking fast.', '“Mr. Fonoti in 507. Fifteen minutes into his second unit. He has rigors, a temperature of 38.9, and he says his back is killing him.”', '“Pressure was 128 before we started. It is 98 now.”'] },
          enter: { vitals: { temp: 38.9, hr: 118, rr: 24, sbp: 98, dbp: 58, spo2: 95, pain: 7 }, msg: { critical: true, subject: 'Fonoti, Sione — rigors and back pain during transfusion', body: 'Mr. Fonoti is 15 minutes into his second unit of red cells. Rigors, T 38.9, severe pain in his lower back, HR 118, BP 98/58 (128/76 before). He says he feels that something terrible is happening.\n\nWhat do you want me to do?\n\nTomas' } },
          story: 'Fifteen minutes into his second unit he has rigors, a temperature of 38.9, severe back pain and a falling blood pressure.',
          ask: { who: 'Tomas, his nurse', q: 'The blood is still running. What do you want me to do?', options: [
            { text: 'Stop the transfusion now. Keep the IV open with saline. I am on my way', to: 'stopped', grade: 'best', why: 'Every transfusion reaction starts the same way: stop the blood, keep the vein. The harm depends on how much goes in.' },
            { text: 'Give acetaminophen and slow the rate: fevers are common with blood', to: 'worse', grade: 'poor', why: 'A simple fever does not come with back pain and a falling pressure. Slowing the rate kept incompatible blood running.' },
            { text: 'Diphenhydramine: this is an allergic reaction', to: 'worse', grade: 'poor', why: 'An allergic reaction is itching and hives. Fever, rigors, back pain and a falling pressure are something else, and the blood was still running.' },
            { text: 'He needs the blood. Let it finish and I will see him afterwards', to: 'shock', grade: 'harm', why: 'The whole unit of incompatible blood went in.' }] },
        },
        stopped: {
          title: 'The blood is stopped', urgent: true,
          enter: { stop: ['prbc'], vitals: { temp: 38.8, hr: 114, rr: 22, sbp: 102, dbp: 60, spo2: 96, pain: 6 }, msg: { subject: 'Fonoti, Sione — transfusion stopped, red urine', body: 'Transfusion stopped with about 60 mL in. Saline is running. I have kept the bag and the tubing.\n\nHis urine is red-brown.\n\nThe blood bank wants a fresh sample from him. What tests do you want?\n\nTomas' } },
          story: 'The transfusion is stopped with about 60 mL in. His urine is red-brown. The bag and tubing are kept. Find out what kind of reaction this is: the blood bank needs a fresh sample from him.',
          paths: [
            { when: W.resulted('ts'), to: 'clerical', grade: 'best', label: 'Repeat type and screen on a fresh sample', why: 'A new sample, with the bag returned, is how the blood bank tells an incompatible unit from everything else.' },
            { when: W.resulted('ua'), after: 0.5, to: 'clerical', grade: 'ok', label: 'Urinalysis, but no sample for the blood bank', why: 'The urine showed free hemoglobin, which says hemolysis. Only the blood bank can say why, and they were left waiting.' },
            { after: 1.25, to: 'aki', grade: 'late', label: 'No work-up of the reaction', why: 'The blood was stopped and then nothing was sent. Hemolysis went untreated.' }],
        },
        worse: {
          title: 'Blood pressure 84/50', urgent: true,
          enter: { stop: ['prbc'], vitals: { temp: 39.4, hr: 128, rr: 26, sbp: 84, dbp: 50, spo2: 94, pain: 9 }, msg: { critical: true, subject: 'Fonoti, Sione — BP 84/50, red urine. I have stopped the blood', body: 'Mr. Fonoti is worse: T 39.4, HR 128, BP 84/50, and his urine is the colour of cola. I have stopped the transfusion myself; about half the unit is in.\n\nHe needs fluid. Can you order it?\n\nTomas' } },
          story: 'Ten minutes later his pressure is 84/50 and his urine is the colour of cola. The nurse stopped the transfusion on his own, with half the unit in.',
          paths: [
            { when: W.now(W.ordered('ns_bolus', 'lr')), to: 'stopped', grade: 'ok', label: 'IV fluids for the falling pressure', why: 'Fluids support the pressure and protect the kidneys. He got twice the dose of incompatible blood first.' },
            { after: 0.5, to: 'shock', grade: 'harm', label: 'Nobody treated the falling pressure', why: 'Hemolysis with shock was left to run.' }],
        },
        clerical: {
          title: 'The wrong unit',
          enter: { set: { dx: 'Acute hemolytic transfusion reaction (ABO-incompatible unit)' }, problems: ['Acute hemolytic transfusion reaction'] },
          story: 'The blood bank calls. Mr. Fonoti is group O. The unit was group A, crossmatched for Fonoti, Siaosi in 509. It was collected during the lunch handover and the bedside check matched the surname only.',
          ask: { who: 'Dr. Park', q: 'An ABO mismatch. What does he need now, and who else needs to know?', options: [
            { text: 'Generous IV fluids and hourly urine output to protect his kidneys. And call 509 now: his unit may be hanging on someone else', to: 'safe', grade: 'best', why: 'Fluids keep the urine flowing and wash the hemoglobin through. A unit that went to the wrong patient means another patient’s unit is unaccounted for.' },
            { text: 'Generous IV fluids and hourly urine output. The incident report can wait for tomorrow', to: 'safe', grade: 'ok', why: 'Right for this patient. The other Mr. Fonoti was due his own unit within the hour, and nobody had been told.' },
            { text: 'Furosemide to flush the kidneys, and restrict his fluids', to: 'aki', grade: 'poor', why: 'A diuretic without fluid dries out kidneys that are already being injured.' }] },
        },
        safe: {
          title: 'Protecting the kidneys',
          story: 'Dr. Park agrees. Enter the orders: IV fluids at a generous rate, and strict intake and output so his urine is measured every hour.',
          paths: [
            { when: W.all(W.ordered('lr', 'ns_bolus', 'ns'), W.ordered('io')), to: 'end_well', grade: 'best', label: 'IV fluids and strict intake and output ordered', why: 'Fluid in, and a measure of what comes out.' },
            { when: W.ordered('lr', 'ns_bolus', 'ns'), after: 0.5, to: 'end_well', grade: 'ok', label: 'IV fluids, but nobody measuring the urine', why: 'The fluid was right. Without urine output measured hourly, nobody would know if the kidneys were failing.' },
            { after: 1, to: 'aki', grade: 'late', label: 'Fluids agreed but never ordered', why: 'His kidneys had an hour of free hemoglobin and no help.' }],
        },
        end_well: { title: 'Kidneys spared', end: 'well', enter: { vitals: { temp: 37.4, hr: 90, rr: 18, sbp: 122, dbp: 74, spo2: 97, pain: 2 }, labs: ['BMP (next morning)', BMP(139, 4.6, 104, 24, 22, 1.2, 100, 8.9)], truth: { labs: { K: 4.6, Cr: 1.2 } } },
          story: 'His urine cleared overnight and the creatinine peaked at 1.4. He was told exactly what happened and why. The other Mr. Fonoti’s transfusion was stopped at the door. The unit now requires two nurses and a scanned wristband for every bag.' },
        aki: { title: 'Dialysis', end: 'rocky', enter: { vitals: { temp: 37.8, hr: 100, rr: 20, sbp: 138, dbp: 84, spo2: 95, pain: 3 }, labs: ['BMP (day 3)', BMP(134, 6.1, 100, 16, 78, 5.2, 110, 8.0)], problems: ['Acute kidney injury from hemolysis, on dialysis'], truth: { labs: { K: 6.1, Cr: 5.2 } } },
          story: 'He passed almost no urine for two days. Creatinine 5.2, potassium 6.1. He needed dialysis three times before his kidneys began to recover.' },
        shock: { title: 'Shock', end: 'icu', scene: { kind: 'rapid', lines: ['His pressure cannot be found. He is bleeding from the IV site.', 'The rapid response team takes him to intensive care.'] },
          enter: { stop: ['prbc'], icu: 'Shock and bleeding from an incompatible transfusion', vitals: { temp: 39.8, hr: 140, rr: 30, sbp: 68, dbp: 38, spo2: 90, o2: 'Non-rebreather' } },
          story: 'He went into shock and began to bleed from every puncture site. He is in intensive care on blood pressure support and dialysis.' },
      },
    },

    /* ---------------------------------------------------------------------------------------------- */
    {
      id: 'flutter', n: 7, pid: 'p14', title: 'A fast, irregular pulse', level: 'Stable or not', glyph: 'summary', startHour: 11,
      brief: 'A 76-year-old woman admitted with vomiting and dehydration is found with a heart rate of 148. She feels a fluttering in her chest but is otherwise comfortable.',
      debrief: 'A fast rhythm asks two questions in order: is she stable, and what is the rhythm? Stable means there is time to confirm it, slow it, and fix what set it off. The last decision is the one that matters in six months: whether she leaves protected against a stroke.',
      issues: [
        'What makes a fast heart rhythm “unstable”, and how does that change what you do in the next five minutes?',
        'Which reversible triggers of atrial fibrillation would you look for in a hospital patient, and where is each one in the record?',
        'Why replace potassium and magnesium before, or alongside, a rate-controlling drug?',
        'How is stroke risk in atrial fibrillation estimated, and why is aspirin not a substitute for an anticoagulant?',
        'How would you explain a new anticoagulant to this patient? What would you document about the conversation?',
      ],
      credits: [
        { text: 'Checked her thyroid', why: 'An overactive thyroid is a treatable cause of new atrial fibrillation and is easy to miss in an older patient.', test: W.ordered('tsh') },
        { text: 'Kept her on telemetry', why: 'A new fast rhythm on a rate-controlling drug is watched on a monitor.', test: W.ordered('tele') },
        { text: 'Asked the patient about falls and bleeding', why: 'She walks every day, has not fallen and has never bled badly. That is the bedside half of deciding an anticoagulant is safe for her.', test: W.asked('Have you had a fall, or any bleeding, in the last year?') },
      ],
      interview: [
        { q: 'Have you had a fall, or any bleeding, in the last year?', a: 'No falls. I walk to the market every morning. No bleeding either, apart from my gums now and then when I floss.' },
        { q: 'Has your heart raced like this before?', a: 'Never. Not once in seventy-six years. That is why it frightened me.' },
      ],
      patient: (K) => ({
        admitH: -22, attending: VAS,
        chart: {
          mrn: '10059174', name: 'Alapai, Ruth', dob: '1950-03-30', sex: 'F', unit: '5 West Medicine', bed: '5W-516', rn: RN2, height: 155, weight: 58.0,
          cc: 'Vomiting and diarrhea for 3 days', dx: 'Gastroenteritis with dehydration and acute kidney injury',
          allergies: [K.al('Codeine', 'opioid', 'Nausea and vomiting', 'Low', 'Intolerance')],
          problems: [K.prob('Viral gastroenteritis with dehydration', 1), K.prob('Acute kidney injury, prerenal', 1), K.prob('Hypokalemia', 1), K.prob('Hypertension', 5500), K.prob('Osteoporosis', 2500)],
          vitals: K.vit([[-21.5, 37.4, 102, 18, 98, 58, 97, 'Room air', 2], [-14, 37.2, 92, 16, 110, 64, 97, 'Room air', 1], [-6, 37.0, 84, 16, 122, 70, 98, 'Room air', 0], [-1.5, 37.0, 86, 16, 124, 72, 98, 'Room air', 0]], RN2),
          labs: K.labs([
            [-21, 'CBC, BMP, Mg', Object.assign(CBC(9.6, 14.8, 44.2, 288), BMP(133, 3.0, 96, 20, 42, 1.6, 98, 9.4), { Mg: 1.5 })],
            [-4, 'BMP', BMP(137, 3.1, 102, 23, 26, 1.1, 94, 8.9)],
          ]),
          reports: [K.rep(-21, 'Cardiology', 'ECG 12-lead', 'Sinus rhythm, rate 100. Normal axis and intervals. Flattened T waves with small U waves.\n\nIMPRESSION: Sinus rhythm. T-wave changes consistent with low potassium.', 'Cardiology')],
          notes: [
            K.note(-20, 'H&P', VAS, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Vomiting and diarrhea for 3 days.\n\nHPI: 76 y.o. woman with hypertension, living alone and independent, with 3 days of vomiting and watery diarrhea after a family gathering where several people fell ill. Drinking very little. Light-headed on standing. No blood in the stool, no fever.\n\nHOME MEDICATIONS: hydrochlorothiazide 25 mg daily; alendronate weekly; calcium and vitamin D.\nALLERGIES: codeine (nausea).\n\nEXAM: HR 102 and regular, BP 98/58, dry mouth, abdomen soft with mild diffuse tenderness.\n\nDATA: potassium 3.0, magnesium 1.5, creatinine 1.6 (baseline 0.9), BUN 42. ECG: sinus rhythm with changes of low potassium.\n\nASSESSMENT & PLAN:\n1. Gastroenteritis with dehydration: IV fluids, anti-nausea medicine, advance diet.\n2. Prerenal kidney injury: fluids, hold hydrochlorothiazide.\n3. Low potassium and magnesium: replace and recheck. (Replacement ordered in the emergency department; please confirm it was given.)\n4. VTE prophylaxis: compression devices.\nCode status: Full.'),
            K.note(-3, 'Nursing Note', RN2, 'nurse', 'NURSING NOTE\n\nNo vomiting since midnight. Tolerating clear liquids. Potassium 3.1 this morning. I cannot find a potassium or magnesium order on the MAR: the replacement from the emergency department does not appear to have been continued. Team paged at 08:10, awaiting reply.'),
          ],
          encounters: [K.enc(150, 'Office Visit', 'Primary Care', 'Iwasaki, Glenn MD', 'Hypertension follow-up')],
          sim: {
            labs: { K: 3.1, Mg: 1.4, TSH: 1.8, Trop: 0.02, Cr: 1.1 },
            reports: {
              ecg: 'Irregularly irregular rhythm with no P waves, ventricular rate 146. Narrow QRS. No ST-segment elevation.\n\nIMPRESSION: ATRIAL FIBRILLATION WITH A RAPID VENTRICULAR RESPONSE. New compared with the admission tracing.',
              echo: 'FINDINGS:\nNormal left ventricular size and function, ejection fraction 60%. Left atrium mildly enlarged. No significant valve disease. No clot seen.\n\nIMPRESSION:\nNormal ventricular function. Mild left atrial enlargement.',
            },
            consults: { c_cards: '1. New atrial fibrillation with a fast rate, stable. Likely set off by low potassium and magnesium and dehydration.\n2. Rate control with a beta blocker; keep potassium above 4.0 and magnesium above 2.0.\n3. No need for cardioversion while she is stable.\n4. Stroke risk score 4 (age 75 or over, female, hypertension): anticoagulation is recommended. Apixaban is suitable at her kidney function.\n5. Echocardiogram and thyroid test. Clinic follow-up in 4 weeks.' },
            story: ['I had that stomach bug that went through the whole family. I am much better. But since this morning my heart feels like a bird flapping in my chest.', 'I live alone in Manoa, and I manage very well, thank you. I taught piano. I do not smoke and I have a small sherry on Sundays.', 'My friend Dorothy had a stroke from her heart rhythm. Is that going to happen to me?'],
          },
        },
        orders: [['code_full'], ['lr', { dose: '100 mL/hr' }], ['ondansetron'], ['acetaminophen'], ['scd'], ['diet_clear'], ['vs_q4'], ['io'], ['fall']],
      }),
      start: 'call',
      nodes: {
        call: {
          title: 'Heart rate 148', urgent: true,
          scene: { kind: 'page', lines: ['Hana, from 5 West.', '“Mrs. Alapai in 516. I went to do her vitals and her pulse is 148 and all over the place.”', '“Pressure is 118 over 70. She is sitting up reading. She says it feels like a bird in her chest.”'] },
          enter: { vitals: { hr: 148, rr: 18, sbp: 118, dbp: 70, spo2: 97, pain: 0 }, msg: { critical: true, subject: 'Alapai, Ruth — HR 148 and irregular', body: 'Mrs. Alapai’s pulse is 148 and irregular. BP 118/70, SpO2 97%. No chest pain, not short of breath, alert and chatting. She feels a fluttering.\n\nShe is not on a monitor. What would you like?\n\nHana' } },
          story: 'Her pulse is 148 and irregular, with a blood pressure of 118/70. She is comfortable and alert. Nobody yet knows what the rhythm is.',
          paths: [
            { when: W.resulted('ecg'), to: 'af', grade: 'best', label: 'ECG to confirm the rhythm', why: 'She is stable, so there is time to know what you are treating. An ECG takes two minutes.' },
            { when: W.active('metoprolol'), to: 'af', grade: 'poor', label: 'A beta blocker before anyone had seen the rhythm', why: 'It happened to be the right drug. Slowing a fast rhythm without an ECG is a guess, and some fast rhythms are made worse by it.' },
            { after: 1.5, to: 'unstable', grade: 'late', label: 'No ECG for ninety minutes', why: 'A heart cannot run at 148 indefinitely at 76.' }],
        },
        af: {
          title: 'Atrial fibrillation',
          enter: { reports: ['Cardiology', 'ECG 12-lead', 'Irregularly irregular rhythm with no P waves, ventricular rate 146. Narrow QRS. No ST-segment elevation.\n\nIMPRESSION: ATRIAL FIBRILLATION WITH A RAPID VENTRICULAR RESPONSE. New compared with the admission tracing.', 'Cardiology'], set: { dx: 'New atrial fibrillation with a rapid rate; gastroenteritis, resolving' }, problems: ['Atrial fibrillation with rapid ventricular response, new'] },
          story: 'It is atrial fibrillation at 146, new since admission. Her pressure is holding. This morning’s potassium was 3.1 and the nursing note says the replacement was never continued.',
          ask: { who: 'Dr. Vasquez', q: 'New atrial fibrillation at 146, pressure fine. What is your plan?', options: [
            { text: 'Slow the rate with a beta blocker, replace her potassium and magnesium, and look for what set it off', to: 'rate', grade: 'best', why: 'Stable means rate control and fixing the trigger. Low potassium and magnesium were sitting in the chart.' },
            { text: 'Shock her back to a normal rhythm now', to: 'rate', grade: 'poor', why: 'Cardioversion is for the unstable patient. She was reading a book. Dr. Vasquez declined and asked for rate control.' },
            { text: 'Watch and wait: it may settle as she rehydrates', to: 'unstable', grade: 'poor', why: 'A rate of 146 with an untreated trigger does not settle by being watched.' }] },
        },
        rate: {
          title: 'Slowing the rate',
          story: 'Dr. Vasquez agrees. Enter the orders: a beta blocker for the rate, potassium replacement, and magnesium (a level, or replacement).',
          paths: [
            { when: W.all(W.ordered('metoprolol'), W.ordered('kcl_po'), W.ordered('mg', 'mag_iv')), to: 'slowed', grade: 'best', label: 'Beta blocker, potassium and magnesium ordered', why: 'The rate, and the two electrolytes that keep it from coming back.' },
            { when: W.ordered('metoprolol'), after: 0.6, to: 'slowed', grade: 'ok', label: 'Beta blocker, but the electrolytes left low', why: 'The rate came down. With a potassium of 3.1 and a magnesium of 1.4 it will be harder to keep down.' },
            { after: 1.25, to: 'unstable', grade: 'late', label: 'Rate control agreed but never ordered', why: 'Nothing was given.' }],
        },
        slowed: {
          title: 'Rate 92',
          enter: { vitals: { hr: 92, rr: 16, sbp: 116, dbp: 68, spo2: 98 } },
          story: 'Two hours later her rate is 92, still irregular. She feels well. She is 76, a woman, with hypertension: a stroke risk score of 4.',
          ask: { who: 'Dr. Vasquez', q: 'She is still in atrial fibrillation. What about her risk of a stroke?', options: [
            { text: 'Offer an anticoagulant such as apixaban, check it against her kidney function and bleeding risk, and explain it to her', to: 'end_well', grade: 'best', why: 'A score of 4 is about a 5% risk of stroke a year. An anticoagulant cuts that by about two thirds.' },
            { text: 'Aspirin is enough at her age', to: 'stroke', grade: 'poor', why: 'Aspirin does little to prevent stroke in atrial fibrillation and still causes bleeding. It is not a gentler anticoagulant.' },
            { text: 'Nothing, unless it is still there in a month', to: 'stroke', grade: 'poor', why: 'Stroke risk does not wait for the rhythm to prove itself. Even atrial fibrillation that comes and goes carries it.' }] },
        },
        unstable: {
          title: 'Chest pain, pressure 82/50', urgent: true,
          enter: { vitals: { hr: 168, rr: 26, sbp: 82, dbp: 50, spo2: 93, pain: 6 }, msg: { critical: true, subject: 'Alapai, Ruth — HR 168, BP 82/50, chest pain', body: 'Mrs. Alapai is grey and clammy. HR 168, BP 82/50. She has chest pain and says she is going to faint.\n\nPlease come NOW.\n\nHana' } },
          story: 'Her rate is 168, her pressure 82/50, and she has chest pain and is about to faint. She is no longer stable.',
          ask: { who: 'Hana, her nurse', q: 'She is going grey. What do you want?', options: [
            { text: 'Call the rapid response team: she needs synchronized cardioversion', to: 'shocked', grade: 'ok', why: 'Unstable with a fast rhythm means electricity, now. It should not have come to this.' },
            { text: 'Metoprolol by vein, and see if the rate comes down', to: 'icu', grade: 'harm', why: 'A beta blocker lowers a blood pressure that was already 82/50.' },
            { text: 'A litre of saline, fast, and recheck', to: 'icu', grade: 'poor', why: 'Fluid does not fix a heart beating too fast to fill.' }] },
        },
        shocked: { title: 'Cardioverted', end: 'rocky', enter: { vitals: { hr: 78, rr: 18, sbp: 108, dbp: 64, spo2: 97, pain: 1 }, problems: ['Unstable atrial fibrillation, cardioverted'] },
          story: 'One shock under sedation put her back in a normal rhythm. She has a burn on her chest, a frightened family, and three more days in hospital.' },
        stroke: { title: 'Four months later', end: 'rocky', enter: { vitals: { hr: 84, sbp: 124, dbp: 72 } },
          story: 'She went home well, in atrial fibrillation, without an anticoagulant. Four months later her daughter finds her unable to speak or lift her right arm.' },
        end_well: { title: 'Home, protected', end: 'well', scene: { kind: 'home', lines: ['Her rate holds in the eighties. Potassium 4.2, magnesium 2.1.', 'She asks three sharp questions about the blood thinner and writes the answers in a notebook.', 'She goes home on the second day, to a piano that needs tuning.'] },
          enter: { home: true, vitals: { hr: 82, rr: 16, sbp: 122, dbp: 72, spo2: 98, pain: 0 }, labs: ['BMP, Mg (discharge)', Object.assign(BMP(139, 4.2, 103, 25, 16, 0.9, 96, 9.1), { Mg: 2.1 })], truth: { labs: { K: 4.2, Mg: 2.1 } } },
          story: 'Her rate stayed in the eighties with her potassium and magnesium replaced. She went home on apixaban and a beta blocker, with a clinic visit booked and the reason for each tablet written in her notebook.' },
        icu: { title: 'Collapse', end: 'icu', scene: { kind: 'rapid', lines: ['Her eyes roll back. No pulse at the wrist.', 'The rapid response team shocks her and takes her to intensive care.'] },
          enter: { icu: 'Unstable atrial fibrillation that was not cardioverted in time', vitals: { hr: 172, rr: 28, sbp: 64, dbp: 36, spo2: 88, o2: 'Non-rebreather' } },
          story: 'She lost her pulse and was shocked by the rapid response team. She is in intensive care.' },
      },
    },
  ];

  /** The case patient's starting chart, read from the case data without building the real patient (no ids, no
      MAR, nothing put on the ward): enough for the advisories and harm rules to judge an order against. */
  function specOf(cs) {
    const K = { T: (h) => h, vit: () => [], rep: () => ({}), note: () => ({}), enc: () => ({}),
      labs: (rows) => rows.map(([h, name, values]) => ({ id: 'l' + h, ts: h, name, values })),
      al: (agent, cls, reaction, severity, type) => ({ agent, cls, reaction, severity, type: type || 'Drug allergy', status: 'Active', verified: true }),
      prob: (name) => ({ name, status: 'Active' }) };
    return cs.patient(K);
  }
  /* A check for faculty editing the trees: every destination exists, every node can be reached, every node has
     one way out, every catalogue id exists, every question W.asked looks for is one the patient can be asked, and
     no path waits on an order the simulated attending would decline for this patient (a high advisory or a harm
     rule): a student could never travel that road; use W.tried for it. The chart it judges against is the
     patient's starting chart plus the labs the node itself files, which is close enough for the creatinine and
     potassium the harm rules read. Run EHR.caseCheck() in the browser console; it returns a list of problems
     (empty when sound). It also runs once at load and warns in the console, never to learners. */
  E.caseCheck = () => {
    const out = [];
    E.CASES.forEach((cs) => {
      let spec = null;
      try { spec = specOf(cs); } catch (err) { out.push(`${cs.id}: the patient could not be read (${err.message})`); }
      const cat = (id, where) => { if (!E.cat(id)) out.push(`${cs.id}: ${where} uses "${id}", which is not in the order catalogue`); };
      const qs = (cs.interview || []).map((x) => norm(x.q));
      (cs.interview || []).forEach((x, i) => { if (!x.q || !x.a) out.push(`${cs.id}: interview question ${i + 1} needs both q and a`); });
      const asks = (f, where) => ((f && f.asks) || []).forEach((t) => { if (!qs.includes(norm(t))) out.push(`${cs.id}: ${where} waits for the question “${t}”, which is not in the case's interview`); });
      (cs.credits || []).forEach((x) => { ((x.test && x.test.ids) || []).forEach((id) => cat(id, `credit “${x.text}”`)); asks(x.test, `credit “${x.text}”`); });
      if (spec) {
        spec.orders.forEach(([id]) => cat(id, 'the starting orders'));
        (spec.given || []).forEach(([id]) => cat(id, 'the MAR'));
        const sim = (spec.chart && spec.chart.sim) || {};
        Object.keys(sim.reports || {}).concat(Object.keys(sim.consults || {})).forEach((id) => cat(id, 'sim'));
      }
      Object.entries(cs.nodes).forEach(([k, n]) => {
        const en = n.enter || {};
        (en.orders || []).forEach(([id]) => cat(id, `node "${k}" (enter.orders)`));
        (en.stop || []).forEach((id) => cat(id, `node "${k}" (enter.stop)`));
        Object.keys((en.truth && en.truth.reports) || {}).forEach((id) => cat(id, `node "${k}" (enter.truth)`));
        (n.paths || []).forEach((x, i) => { asks(x.when, `node "${k}" path ${i + 1}`); ((x.when && x.when.ids) || []).forEach((id) => cat(id, `node "${k}" path ${i + 1}`)); });
        if (!spec || !n.paths || !E.checkDraft) return;
        const own = !en.labs ? [] : Array.isArray(en.labs[0]) ? en.labs : [en.labs];
        const p = Object.assign({ allergies: [], problems: [], dob: '1950-01-01' }, spec.chart, { id: cs.pid, attending: spec.attending,
          labs: (spec.chart.labs || []).concat(own.map(([name, values], j) => ({ id: 'n' + j, ts: 1e6 + j, name, values }))),
          orders: spec.orders.map(([catId]) => ({ id: 'o_' + catId, catId, status: 'Active', type: (E.cat(catId) || {}).type })) });
        (n.paths || []).forEach((x, i) => ((x.when && x.when.wait) || []).forEach((id) => {
          if (!E.cat(id)) return;
          const o = E.newOrder(id, { by: 'caseCheck', byRole: 'student', status: 'Pended' });
          const high = E.checkDraft(p, o, []).find((al) => al.level === 'high'), rule = E.harmRule && E.harmRule(p, o);
          if (high || rule) out.push(`${cs.id}: node "${k}" path ${i + 1} (“${x.label}”) waits on ${id}, which the attending declines for a student here (${(rule && rule.title) || high.title}). Use W.tried.`);
        }));
      });
      const seen = new Set(), walk = (k) => { if (seen.has(k)) return; seen.add(k); const n = cs.nodes[k]; if (!n) { out.push(`${cs.id}: no node called "${k}"`); return; } edgesOf(n, k).forEach((e) => walk(e.to)); };
      walk(cs.start);
      Object.entries(cs.nodes).forEach(([k, n]) => {
        if (!seen.has(k)) out.push(`${cs.id}: node "${k}" cannot be reached`);
        if ([n.ask, n.paths, n.end].filter(Boolean).length !== 1) out.push(`${cs.id}: node "${k}" needs exactly one of ask, paths, end`);
        if (n.paths && !n.paths.some((x) => !x.when && x.after != null)) out.push(`${cs.id}: node "${k}" has no time limit, so a learner could wait there for ever`);
        edgesOf(n, k).forEach((e) => { if (!GRADE[e.grade]) out.push(`${cs.id}: "${k}" has a way out with no grade`); if (!e.label) out.push(`${cs.id}: "${k}" has a way out with no label`); });
      });
    });
    return out;
  };
  // once at load, for whoever edits the data: a console warning, never an error and never shown to learners
  try { const bad = E.caseCheck(); if (bad.length && window.console) console.warn(`SIM+EHR cases: ${bad.length} problem(s) in the case data\n- ${bad.join('\n- ')}`); }
  catch (err) { if (window.console) console.warn('SIM+EHR cases: the case check could not run', err); }
})();
