/* SIM+EHR Student Edition — controller: routing, rendering, and every user action. */
(function () {
  const E = window.EHR, V = E.V, ui = E.ui;
  const $ = (s, root) => (root || document).querySelector(s);
  const $$ = (s, root) => [...(root || document).querySelectorAll(s)];
  const ACT_IDS = E.ACTS.map((a) => a[0]);
  let lastHash = null, pendingRender = false, bounce = null;

  /* ---------- routing & rendering ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, '').split('/');
    if (h[0] === 'pt' && E.pt(h[1])) return { view: 'chart', pid: h[1], act: ACT_IDS.includes(h[2]) ? h[2] : 'summary' };
    return { view: ['inbox', 'log', 'learning', 'missions'].includes(h[0]) ? h[0] : 'home' };
  }
  const curPt = () => { const r = route(); return r.pid ? E.pt(r.pid) : null; };

  function render() {
    pendingRender = false;
    const root = $('#root');
    if (E.music) E.music.scene(E.db.user ? null : 'login');   // the login music plays on the login screen only
    if (!E.db.user) { root.innerHTML = V.login(); $('#modal').innerHTML = ''; if (E.pal) E.pal.sync(null, false); return; }
    const r = route(), sc = $('#activity') || $('.main');
    const keep = sc && lastHash === location.hash ? sc.scrollTop : 0;
    root.innerHTML = V.shell(r, r.view === 'chart' ? V.chart(E.pt(r.pid), r.act) : V[r.view]());
    const sc2 = $('#activity') || $('.main');
    if (sc2) sc2.scrollTop = keep;
    lastHash = location.hash;
    document.title = (r.pid ? E.pt(r.pid).name + ' — ' : '') + 'SIM+EHR';
    $('#modal').innerHTML = ui.modal ? V.modal(ui.modal) : '';
    if (ui.modal) { const f = $('#modal input, #modal select, #modal button.primary'); if (f) f.focus(); }
    // The assistant in the corner takes its mood from the screen: worried by an advisory, thoughtful over a
    // risky change, waiting while a test is in process.
    if (E.pal) E.pal.sync(ui.modal ? ({ alerts: 'worry', allergyRemove: 'think', debrief: 'think', confirm: 'think' }[ui.modal.type] || null) : E.db.patients.some((p) => p.orders.some((o) => o.status === 'In process')) ? 'wait' : null, true);
    // Dock-style bounce for the toolbar item that was just chosen. The screen is redrawn on navigation,
    // so the bounce is re-applied to the new element and resumed where it was if another redraw follows.
    if (bounce) {
      const gone = Date.now() - bounce.at;
      if (gone > 760) bounce = null;
      else $('.tools .tool').filter((x) => (x.getAttribute('href') || x.dataset.act) === bounce.key).forEach((x) => { const gl = $('.gl', x); if (gl) { gl.style.animationDelay = -gone + 'ms'; gl.classList.add('bounce'); } });
    }
  }
  const commit = () => { E.save(); render(); };
  const modalErr = (t) => { const e = $('#modalErr'); if (e) e.textContent = t; };
  /** One-line confirmation in the information bar. Covers no control. */
  let statusTimer = null;
  function status(text) {
    ui.status = text;
    const e = $('#status'); if (e) e.textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { ui.status = ''; const s = $('#status'); if (s) s.textContent = ''; }, 6000);
  }
  /** Notification balloon dropping from the level widget. Reserved for things that arrive on their own:
      points, levels, badges and new results. A message with no title is a plain confirmation and goes to
      the status line instead. */
  function toast(text, title, glyph) {
    if (!title) return status(text);
    const box = $('#toast'), b = document.createElement('div');
    b.className = 'balloon';
    b.innerHTML = `${E.icon(glyph || 'info', 24)}<div><b>${E.esc(title)}</b><span>${E.esc(text)}</span></div>`;
    box.appendChild(b);
    while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => b.remove(), 7000);
  }
  /** Record a learning event. Tasks completed by the same action are announced together in one balloon,
      with any level-up or badge they earned. */
  let award = null;
  function track(ev) {
    if (!E.db.user) return;
    const before = award ? null : E.game(E.progress()), task = E.track(ev);
    if (!task) return;
    E.save();
    if (!award) { award = { before, tasks: [] }; setTimeout(flushAward, 40); }
    award.tasks.push(task.text);
  }
  function flushAward() {
    const aw = award; award = null;
    if (!aw || !E.db.user) return;
    const g = E.game(E.progress()), extra = [], n = aw.tasks.length;
    if (g.level > aw.before.level) extra.push(`Level up: you are now ${g.title}.`);
    g.earned.filter((id) => !aw.before.earned.includes(id)).forEach((id) => extra.push(`Badge earned: ${E.BADGES.find((x) => x.id === id).name}.`));
    toast((n === 1 ? aw.tasks[0] : aw.tasks.map((t) => '• ' + t).join('\n')) + (extra.length ? '\n' + extra.join(' ') : ''), `+${n * E.XP.task} XP · ${n === 1 ? 'Task complete' : n + ' tasks complete'}`, extra.length ? 'medal' : 'star');
    if (!busy()) render();
    const star = $('.lvl > .gl'); if (star) star.classList.add('bounce');
    if (E.pal) E.pal.pose('cheer', 2600);   // the level star hops when points land
  }

  /** Runs once per navigation: audit trail and learning events tied to viewing something. */
  function onRoute() {
    if (E.db.user) {
      const r = route();
      if (r.view === 'chart') {
        const p = E.pt(r.pid);
        if (!E.db.openTabs.includes(p.id)) { E.db.openTabs.push(p.id); E.audit('Opened chart', p.id); }
        E.audit('Viewed ' + E.ACTS.find((a) => a[0] === r.act)[1], p.id);
        const ev = { summary: 'summary.view', problems: 'allergy.review', mar: 'mar.view' }[r.act];
        if (ev) track(ev);
        if (r.act === 'orders' && p.codeStatus !== 'Full Code') track('code.review');
        if (r.act !== 'review') ui.crSel = null;
      } else if (r.view === 'log') track('log.view');
      if (E.pal) E.pal.context(r.view === 'chart' ? r.act : r.view);
      E.save();
    }
    render();
  }
  const go = (hash) => { if (location.hash === hash) onRoute(); else location.hash = hash; };

  /* ---------- loading screen: plays at boot and after login, leaves with a stepped dither dissolve ---------- */
  const noSplash = /[?&]splash=off/.test(location.search);
  function splash(kind) {
    if (noSplash) return;
    const el = $('#splash'), reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let over = false;
    el.innerHTML = V.splash(kind); el.className = 'show ' + kind; el.style.maskImage = el.style.webkitMaskImage = '';
    const clear = () => { el.className = ''; el.innerHTML = ''; el.style.maskImage = el.style.webkitMaskImage = ''; };
    const end = () => {
      if (over) return;
      over = true; clearTimeout(timer); el.removeEventListener('click', end); document.removeEventListener('keydown', end, true);
      if (reduce) return clear();
      const steps = [14, 12, 8, 4, 2];
      (function frame(i) { if (i >= steps.length) return clear(); el.style.maskImage = el.style.webkitMaskImage = E.ditherMask(steps[i]); setTimeout(() => frame(i + 1), 75); })(0);
    };
    const timer = setTimeout(end, reduce ? 900 : kind === 'boot' ? 2600 : 2000);
    el.addEventListener('click', end); document.addEventListener('keydown', end, true);
  }

  /* ---------- the flying pig: click it and it goes poof, oinks, and is worth one point ---------- */
  /** Two short nasal grunts, synthesised; there is no sound file. */
  function oink() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = oink.ctx || (oink.ctx = new AC()), t0 = ctx.currentTime;
      [0, 0.17].forEach((dt, i) => {
        const t = t0 + dt, osc = ctx.createOscillator(), rasp = ctx.createOscillator(), depth = ctx.createGain(), nose = ctx.createBiquadFilter(), vol = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(i ? 150 : 172, t); osc.frequency.exponentialRampToValueAtTime(i ? 92 : 118, t + 0.13);
        rasp.frequency.value = 46; depth.gain.value = 26; rasp.connect(depth); depth.connect(osc.frequency);
        nose.type = 'bandpass'; nose.Q.value = 4; nose.frequency.setValueAtTime(850, t); nose.frequency.linearRampToValueAtTime(1450, t + 0.05); nose.frequency.linearRampToValueAtTime(700, t + 0.13);
        vol.gain.setValueAtTime(0.0001, t); vol.gain.exponentialRampToValueAtTime(0.25, t + 0.02); vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        osc.connect(nose); nose.connect(vol); vol.connect(ctx.destination);
        osc.start(t); rasp.start(t); osc.stop(t + 0.16); rasp.stop(t + 0.16);
      });
    } catch (e) { /* no audio: the pig goes quietly */ }
  }
  function pigPop(d, el) {
    const r = el.getBoundingClientRect(), puff = document.createElement('div'), signedIn = !!E.db.user;
    puff.className = 'poof'; puff.style.left = r.left + r.width / 2 + 'px'; puff.style.top = r.top + r.height / 2 + 'px';
    const capped = signedIn && E.pigs(E.progress()) * E.XP.pig >= E.XP.pigMax;
    puff.innerHTML = '<i></i>' + (signedIn ? `<b>${capped ? 'Oink!' : '+' + E.XP.pig + ' XP'}</b>` : '');
    document.body.appendChild(puff); setTimeout(() => puff.remove(), 950);
    oink();
    (ui.popped || (ui.popped = {}))[d.key] = performance.now() / 1000 + Number(d.left);
    el.remove();
    if (!signedIn) return;
    const pr = E.progress(), before = E.game(pr);
    pr.pigs = E.pigs(pr) + 1; delete pr.bonus;
    E.audit('Caught a flying pig'); E.save();
    const g = E.game(pr), n = pr.pigs;
    if (capped) toast(`You have the maximum bonus from pigs (${E.XP.pigMax} XP), but you have caught ${n} so far.`, 'Oink! Pig caught', 'pig1');
    else toast('Oink! You caught a flying pig.' + (g.level > before.level ? ` Level up: you are now ${g.title}.` : ''), `+${E.XP.pig} XP · Bonus`, 'pig1');
    if (!busy()) render();
  }

  /* ---------- order signing ---------- */
  function finalize(p, removeIds, overrides) {
    const u = E.db.user, sign = E.can('order.sign');
    const list = p.drafts.filter((d) => !removeIds.includes(d.id));
    list.forEach((o) => {
      Object.assign(o, { by: u.name, byRole: u.role, ts: Date.now(), overrides: overrides[o.id] || [] });
      if (sign) E.activate(p, o, u.name); else o.status = 'Pended';
      p.orders.push(o);
      E.audit(`${sign ? 'Signed' : 'Pended'} order: ${o.name}${o.overrides.length ? ' (advisory overridden)' : ''}`, p.id);
    });
    p.drafts = [];
    ui.modal = null; ui.orderQuery = '';
    if (list.length) {
      track('order.submit');
      if (list.some((o) => o.type === 'lab')) track('lab.order');
      if (!sign) E.message({ type: 'Cosign Orders', roles: ['physician'], from: u.name, patientId: p.id, act: 'orders', subject: `${list.length} order(s) pended for cosign — ${p.name}`, body: list.map((o) => `${o.name} ${E.orderDetail(o)}`).join('\n') });
      toast(sign ? `${list.length} order(s) signed` : `${list.length} order(s) pended for physician cosign`);
    } else toast('No orders were signed');
    commit();
  }

  /* ---------- learner report ---------- */
  E.evidence = (pr) => ({
    notes: E.db.patients.flatMap((p) => p.notes.filter((n) => n.author === pr.name).map((n) => ({ patient: p.name, type: n.type, time: new Date(n.ts).toISOString(), status: n.status, cosignedBy: n.cosignedBy || null, text: n.text }))),
    orders: E.db.patients.flatMap((p) => p.orders.filter((o) => o.by === pr.name).map((o) => ({ patient: p.name, order: o.name, details: E.orderDetail(o), time: new Date(o.ts).toISOString(), status: o.status, advisoriesOverridden: (o.overrides || []).map((x) => `${x.title} — ${x.reason}`) }))),
  });
  function exportReport(pr) {
    const s = E.progressSummary(pr), ev = E.evidence(pr), g = E.game(pr);
    const report = {
      title: 'SIM+EHR Student Edition — learner report', framework: E.EPA_SOURCE, exportedAt: new Date().toISOString(),
      learner: { name: pr.name, role: E.roleLabel(pr.role) }, game: { xp: g.xp, flyingPigsCaught: E.pigs(pr), bonusXpFromFlyingPigs: Math.min(E.pigs(pr) * E.XP.pig, E.XP.pigMax), level: g.level, rank: g.title, badges: E.BADGES.filter((b) => g.earned.includes(b.id)).map((b) => b.name) }, missions: E.missionReport(pr), proficiencyCheck: E.examReport(pr), miniGames: E.GAMES.map((g) => { const r = (pr.games || {})[g.id] || {}; return { game: g.name, plays: r.plays || 0, bestPercent: r.best || 0, perfectRounds: r.perfect || 0 }; }), summary: { tasksCompleted: s.tasksDone, tasksTotal: s.tasks, quizCorrect: s.quizCorrect, quizAnswered: s.quizAnswered, quizTotal: s.quiz },
      objectives: E.LEARNING.map((lo) => ({
        epa: lo.epa, epaTitle: lo.epaTitle, objective: lo.objective,
        tasks: lo.tasks.map((t) => ({ task: t.text, completedAt: pr.events[t.event] ? new Date(pr.events[t.event]).toISOString() : null })),
        knowledgeCheck: lo.quiz.map((q) => ({ question: q.q, answered: pr.quiz[q.id] != null ? q.options[pr.quiz[q.id]] : null, correct: pr.quiz[q.id] != null ? pr.quiz[q.id] === q.answer : null })),
      })),
      evidence: ev,
      activityLog: E.db.audit.filter((a) => a.user === pr.name).map((a) => ({ time: new Date(a.ts).toISOString(), patient: a.patientId ? E.pt(a.patientId).name : null, action: a.action })),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    a.download = `ehr-sim-report-${pr.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const viewedLearner = () => (E.db.user.role === 'physician' && ui.learnWho && E.db.progress[ui.learnWho]) || E.progress();

  /** Select the next *** blank in the note so typing replaces it. */
  function nextBlank(t, say) {
    if (!t) return;
    let i = t.value.indexOf('***', t.selectionEnd);
    if (i < 0) i = t.value.indexOf('***');
    if (i >= 0) { t.focus(); t.setSelectionRange(i, i + 3); const line = t.value.slice(0, i).split('\n').length; t.scrollTop = Math.max(0, (line - 6) * 19); } else if (say) toast('Every blank is filled. You can sign.');
  }

  /* ---------- actions (data-act) ---------- */
  const A = {
    login() {
      const name = $('#loginName').value.trim(), role = ($('input[name=role]:checked') || {}).value;
      if (!name) { $('#loginErr').textContent = 'Enter your name to continue.'; $('#loginName').focus(); return; }
      E.db.user = { name, role };
      E.audit('Logged in');
      E.save(); go('#/home'); splash('login');
      if (E.pal) setTimeout(() => E.pal.greet(), noSplash ? 0 : 2300);
    },
    logout() { E.audit('Logged out'); E.db.user = null; E.db.openTabs = []; ui.modal = null; ui.learnWho = null; lastHash = null; E.save(); render(); },
    musicToggle() { if (E.music) E.music.toggle(); render(); },
    help() { ui.modal = { type: 'help' }; render(); },
    closeModal() { ui.modal = null; render(); },
    listFilter(d) { ui.listFilter = d.id; render(); },
    pigPop,
    paneToggle(d) { ui.collapsed[d.id] = !ui.collapsed[d.id]; render(); },
    openPt(d) { $('#ptSearchRes') && ($('#ptSearchRes').innerHTML = ''); go(`#/pt/${d.id}/summary`); },
    closeTab(d) {
      const p = E.pt(d.id), n = p ? p.drafts.length : 0;
      if (p && (n || p.noteDraft)) { ui.closing = d.id; ui.modal = { type: 'confirm', title: 'Unsigned work in this chart', text: `${p.name} has ${[n && `${n} unsigned order${n > 1 ? 's' : ''}`, p.noteDraft && 'a note that is not signed'].filter(Boolean).join(' and ')}. It is saved, but nothing takes effect until you sign it. Leaving orders unsigned is one of the commonest beginner mistakes.`, yes: 'closeTabDo', yesLabel: 'Close anyway' }; return render(); }
      A.closeTabDo(d);
    },
    closeTabDo(d) { d = d && d.id ? d : { id: ui.closing }; ui.closing = null; ui.modal = null; E.db.openTabs = E.db.openTabs.filter((id) => id !== d.id); E.save(); if (route().pid === d.id) go('#/home'); else render(); },
    resetAsk() { ui.modal = { type: 'confirm', title: 'Reset sim data?', text: 'All patients return to their starting state and the timeline is regenerated from the current time. Orders, notes and documentation entered by anyone on this device are erased. Learning progress is kept.', yes: 'resetDo', yesLabel: 'Reset', danger: true }; render(); },
    resetDo() { const act = E.progress().active; if (act && act.type === 'mission') delete E.progress().active; E.reset(); E.db.openTabs = []; Object.assign(ui, { modal: null, selLab: null, selVital: null, selReport: null, noteSel: null, crSel: null, inboxSel: null, marDay: 0 }); E.audit('Reset sim data'); E.save(); toast('Sim data reset'); go('#/home'); },

    /* video visit */
    callOpen() {
      const p = curPt() || E.pt(ui.modal && ui.modal.pid), ep = (E.CONFIG.videoVisit.endpoint || '').trim();
      const m = (ui.modal = { type: 'call', pid: p.id, state: ep ? 'connecting' : 'off' });
      E.audit(ep ? 'Started a video visit' : 'Opened the video visit window (not connected)', p.id); E.save(); render();
      if (!ep) return;
      const still = () => ui.modal === m;
      fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: p.id, patientName: p.name, context: E.personaBrief(p) }) })
        .then((r) => { if (!r.ok) throw new Error('The server answered with status ' + r.status + '.'); return r.json(); })
        .then((d) => {
          if (!still()) return;
          let u; try { u = new URL(d.conversation_url); } catch (e) { throw new Error('The server did not return a call address.'); }
          if (u.protocol !== 'https:' && u.hostname !== 'localhost') throw new Error('The call address must be a secure (https) link.');
          m.state = 'live'; m.url = u.href; render();
        })
        .catch((e) => { if (still()) { m.state = 'error'; m.msg = e.message === 'Failed to fetch' ? 'The video-visit server could not be reached.' : e.message; render(); } });
    },
    callAsk(d) { const m = ui.modal, i = Number(d.i); m.asked = m.asked || []; if (!m.asked.includes(i)) { m.asked.push(i); if (m.asked.length === 1) E.audit('Interviewed the patient (text)', m.pid); E.save(); } render(); const log = $('#talkLog'); if (log) log.scrollTop = log.scrollHeight; },
    callEnd() { const m = ui.modal; if (m && m.asked && m.asked.length) toast('Write up what the patient told you in Notes while it is fresh.', 'Interview ended', 'notes'); if (m && m.state === 'live') { E.audit('Ended a video visit', m.pid); E.save(); toast('Write up the encounter in Notes while it is fresh.', 'Video visit ended', 'notes'); } ui.modal = null; render(); },

    /* results / flowsheets / chart review */
    selLab(d) { ui.selLab = d.comp && ui.selLab !== d.comp ? d.comp : null; if (ui.selLab) track('results.trend'); render(); },
    selVital(d) { ui.selVital = d.k && ui.selVital !== d.k ? d.k : null; if (ui.selVital) track('vitals.trend'); render(); },
    selReport(d, el) { ui.selReport = el.tagName === 'A' || ui.selReport !== d.id ? d.id : null; if (ui.selReport) track('report.view'); render(); },
    crTab(d) { ui.crTab = d.id; ui.crSel = null; render(); },
    crSel(d) { ui.crSel = d.id; if (ui.crTab === 'img') track('report.view'); render(); },

    /* vitals */
    vitalsOpen() { ui.modal = { type: 'vitals', pid: curPt().id }; render(); },
    vitalsSave() {
      const p = curPt(), v = { ts: Date.now(), by: E.db.user.name };
      for (const el of $$('#modal [data-v]')) {
        const k = el.dataset.v;
        if (k === 'o2') { v.o2 = el.value; continue; }
        if (el.value === '') { if (k === 'pain') { v.pain = 0; continue; } return modalErr('Enter a value for every vital sign.'); }
        const n = Number(el.value);
        if (!isFinite(n) || n < Number(el.min) || n > Number(el.max)) { el.focus(); return modalErr(`${el.parentNode.firstChild.textContent} must be between ${el.min} and ${el.max}.`); }
        v[k] = n;
      }
      if (v.dbp >= v.sbp) return modalErr('Diastolic pressure must be lower than systolic.');
      p.vitals.push(v);
      E.audit('Recorded vitals', p.id); track('vitals.add');
      ui.modal = null; toast('Vitals filed'); commit();
    },

    /* MAR */
    marDay(d) { ui.marDay = Math.min(0, ui.marDay + Number(d.d)); render(); },
    marOpen(d) {
      if (!E.can('mar.document')) return toast('Only the Nurse role documents medication administration.');
      ui.modal = { type: 'mar', pid: curPt().id, orderId: d.order, due: d.due ? Number(d.due) : null }; render();
    },
    marScan(d, el) { el.classList.add('ok'); const t = el.querySelector('span'); t.textContent = t.textContent.replace(/^Scan /, 'Scanned: '); modalErr(''); },
    marSave() {
      const m = ui.modal, p = E.pt(m.pid), o = p.orders.find((x) => x.id === m.orderId);
      const action = $('#marAction').value, comment = $('#marComment').value.trim(), dose = $('#marDose').value.trim();
      if (action === 'Given' && $$('#modal .scan.ok').length < 2) return modalErr('Scan the patient wristband and the medication before giving.');
      if (action !== 'Given' && !comment) return modalErr(`Enter a reason the dose was ${action.toLowerCase()}.`);
      p.mar.push({ id: E.uid('ma'), orderId: o.id, dueTs: m.due, action, ts: Date.now(), by: E.db.user.name, dose, comment });
      if (o.freq === 'Once' && action === 'Given') o.status = 'Completed';
      E.audit(`MAR: ${action.toLowerCase()} ${o.name} ${dose}`, p.id); track('mar.give');
      ui.modal = null; toast(`Documented: ${action}`); commit();
    },

    /* notes */
    noteNew() {
      const p = curPt(), type = E.db.user.role === 'nurse' ? 'Nursing Note' : 'Progress Note';
      p.noteDraft = { type, text: E.expandTemplate(E.NOTE_TEMPLATES[type], p), pristine: true };
      track('note.template'); commit();
      const ta = $('#noteText'); if (ta) { ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; }
    },
    noteCancel() { ui.modal = { type: 'confirm', title: 'Discard this note?', text: 'The unsigned note will be deleted.', yes: 'noteCancelDo', yesLabel: 'Discard', danger: true }; render(); },
    noteCancelDo() { curPt().noteDraft = null; ui.modal = null; commit(); },
    noteSign() {
      const p = curPt(), d = p.noteDraft, u = E.db.user, text = d.text.trim();
      if (!text) return toast('The note is empty.');
      const left = (text.match(/\*\*\*/g) || []).length;
      if (left) { nextBlank($('#noteText')); return toast(`${left} blank${left > 1 ? 's' : ''} still to fill. Each *** is a placeholder the template left for you: type over it (the next one is selected for you), or delete it if it does not apply.`, 'Not signed yet'); }
      const student = u.role === 'student';
      const n = { id: E.uid('n'), ts: Date.now(), type: d.type, author: u.name, role: u.role, status: student ? 'Cosign needed' : 'Signed', text };
      if (d.source) n.source = d.source;   // started in a mini-game
      p.notes.push(n); p.noteDraft = null; ui.noteSel = n.id;
      E.audit(`Signed note: ${n.type}${n.source ? ` (started in ${n.source})` : ''}`, p.id);
      if (student) E.message({ type: 'Cosign Note', roles: ['physician'], from: u.name, patientId: p.id, act: 'notes', subject: `${n.type} needs cosign — ${p.name}`, body: `${u.name} (Medical Student) signed a ${n.type} that needs your review and cosignature.` });
      track('note.sign'); if (d.type.startsWith('Handoff')) track('note.handoff');
      toast(student ? 'Note signed and routed for cosign' : 'Note signed'); commit();
    },
    noteNext() { nextBlank($('#noteText'), true); },
    noteSel(d) { ui.noteSel = d.id; render(); },
    noteCosign(d) {
      const p = curPt(), n = p.notes.find((x) => x.id === d.id);
      Object.assign(n, { status: 'Signed', cosignedBy: E.db.user.name, cosignedTs: Date.now() });
      E.audit(`Cosigned note: ${n.type} by ${n.author}`, p.id); toast('Note cosigned'); commit();
    },

    /* orders */
    addDraft(d) { const p = curPt(); p.drafts.push(E.newOrder(d.cat)); ui.orderQuery = ''; commit(); const s = $('#orderSearch'); if (s) s.focus(); },
    removeDraft(d) { const p = curPt(); p.drafts = p.drafts.filter((x) => x.id !== d.id); commit(); },
    clearDrafts() { curPt().drafts = []; commit(); },
    setOpen(d) { ui.modal = { type: 'set', pid: curPt().id, id: d.id }; render(); },
    setAdd() {
      const p = curPt(), ids = $$('#modal input[type=checkbox]:checked').map((c) => c.value);
      if (!ids.length) return modalErr('Select at least one order.');
      ids.forEach((id) => p.drafts.push(E.newOrder(id)));
      E.audit(`Opened order set: ${E.ORDER_SETS.find((s) => s.id === ui.modal.id).name}`, p.id); track('order.set');
      ui.modal = null; commit();
    },
    signDrafts() {
      const p = curPt();
      if (!p.drafts.length) return;
      const alerts = p.drafts.flatMap((d) => E.checkDraft(p, d, p.drafts));
      if (alerts.length) { ui.modal = { type: 'alerts', pid: p.id, alerts }; render(); } else finalize(p, [], {});
    },
    alertsContinue() {
      const m = ui.modal, p = E.pt(m.pid), remove = [], over = {};
      for (const a of m.alerts) {
        const val = $(`#modal [data-alert="${a.id}"]`).value;
        if (!val) return modalErr('Choose an action for every advisory.');
        if (val === 'remove') { if (!remove.includes(a.orderId)) remove.push(a.orderId); } else (over[a.orderId] = over[a.orderId] || []).push({ title: a.title, reason: val });
      }
      m.alerts.forEach((a) => {
        const removed = remove.includes(a.orderId);
        E.audit(`Advisory "${a.title}" on ${a.orderName}: ${removed ? 'order removed' : 'overridden'}`, p.id);
        track(a.kind === 'Allergy' ? 'alert.allergy' : 'alert.other');
        if (removed && a.level === 'high') track('alert.removed');
      });
      finalize(p, remove, over);
    },
    orderCosign(d) { const p = curPt(), o = p.orders.find((x) => x.id === d.id); E.activate(p, o, E.db.user.name); E.audit(`Cosigned order: ${o.name} (entered by ${o.by})`, p.id); toast('Order signed'); commit(); },
    orderDecline(d) { const p = curPt(), o = p.orders.find((x) => x.id === d.id); o.status = 'Declined'; E.audit(`Declined pended order: ${o.name}`, p.id); commit(); },
    orderDc(d) { const p = curPt(), o = p.orders.find((x) => x.id === d.id); Object.assign(o, { status: 'Discontinued', dcTs: Date.now(), dcBy: E.db.user.name }); E.audit(`Discontinued order: ${o.name}`, p.id); toast('Order discontinued'); commit(); },
    toggleHistory() { ui.showHistory = !ui.showHistory; render(); },

    /* problems & allergies */
    allergyOpen() { ui.modal = { type: 'allergy', pid: curPt().id }; render(); },
    allergySave() {
      const p = curPt(), agent = $('#alAgent').value.trim(), reaction = $('#alReaction').value.trim();
      if (!agent || !reaction) return modalErr('Enter the agent and the reaction.');
      p.allergies.push({ id: E.uid('a'), agent, cls: $('#alCls').value, reaction, severity: $('#alSev').value, type: $('#alType').value, status: 'Active' });
      E.audit(`Added allergy: ${agent}`, p.id); track('chart.update'); ui.modal = null; commit();
    },
allergyRemoveOpen(d) { ui.modal = { type: 'allergyRemove', pid: curPt().id, id: d.id }; render(); },
    allergyRemoveSave() {
      const m = ui.modal, p = E.pt(m.pid), al = p.allergies.find((x) => x.id === m.id), u = E.db.user;
      const reason = $('#rmReason').value, comment = $('#rmComment').value.trim();
      if (!reason) return modalErr('Choose a reason.');
      if (comment.length < 8) return modalErr('Say how you know, in a few words.');
      const direct = E.can('order.sign') || E.can('mar.document');
      al.removal = { by: u.name, role: u.role, ts: Date.now(), reason, comment };
      if (direct) { al.status = 'Removed'; al.removal.doneBy = u.name; al.removal.doneTs = Date.now(); E.audit(`Removed allergy: ${al.agent} (${reason})`, p.id); }
      else {
        al.status = 'Removal requested';
        E.audit(`Requested removal of allergy: ${al.agent} (${reason})`, p.id);
        E.message({ type: 'Cosign Orders', roles: ['physician'], from: u.name, patientId: p.id, act: 'problems', subject: `Allergy removal requested — ${p.name}`, body: `${u.name} (Medical Student) asks to remove ${al.agent} (${al.reaction}).\nReason: ${reason}\n${comment}\n\nThe allergy remains active until you approve or decline.` });
      }
      track('allergy.process');
      ui.modal = { type: 'debrief', pid: p.id, lines: E.allergyDebrief(p, al, direct ? 'removed' : 'requested') };
      commit();
    },
    allergyApprove(d) { const p = curPt(), al = p.allergies.find((x) => x.id === d.id); al.status = 'Removed'; al.removal.doneBy = E.db.user.name; al.removal.doneTs = Date.now(); E.audit(`Approved removal of allergy: ${al.agent} (requested by ${al.removal.by})`, p.id); ui.modal = { type: 'debrief', pid: p.id, lines: E.allergyDebrief(p, al, 'removed') }; commit(); },
    allergyKeep(d) { const p = curPt(), al = p.allergies.find((x) => x.id === d.id); E.audit(`Declined removal of allergy: ${al.agent} (requested by ${al.removal.by})`, p.id); al.status = 'Active'; delete al.removal; status('Allergy kept on the active list.'); commit(); },
    allergyRestore(d) { const p = curPt(), al = p.allergies.find((x) => x.id === d.id); al.status = 'Active'; delete al.removal; E.audit(`Restored allergy: ${al.agent}`, p.id); status('Allergy restored to the active list.'); commit(); },
        problemOpen() { ui.modal = { type: 'problem', pid: curPt().id }; render(); },
    problemSave() {
      const p = curPt(), name = $('#prName').value.trim();
      if (!name) return modalErr('Enter the problem.');
      p.problems.unshift({ id: E.uid('pr'), name, noted: Date.now(), status: 'Active' });
      E.audit(`Added problem: ${name}`, p.id); track('chart.update'); ui.modal = null; commit();
    },
    problemResolve(d) { const p = curPt(), x = p.problems.find((y) => y.id === d.id); x.status = 'Resolved'; E.audit(`Resolved problem: ${x.name}`, p.id); commit(); },

    /* inbox */
    inboxSel(d) { const m = E.db.inbox.find((x) => x.id === d.id); ui.inboxSel = m.id; if (!m.read) E.audit(`Read message: ${m.subject}`, m.patientId); m.read = true; if (m.critical) track('critical.read'); commit(); },
    inboxDone(d) { const m = E.db.inbox.find((x) => x.id === d.id); E.db.inbox = E.db.inbox.filter((x) => x !== m); ui.inboxSel = null; E.audit(`Marked message done: ${m.subject}`, m.patientId); commit(); },
    inboxChart(d) { const m = E.db.inbox.find((x) => x.id === d.id); if (m.type === 'Result') track('result.read'); go(`#/pt/${m.patientId}/${m.act || 'summary'}`); },

    /* learning */
    learnWho(d) { ui.learnWho = d.id; render(); },
    quizAnswer(d) {
      const pr = E.progress();
      if (pr.quiz[d.q] != null) return;
      const before = E.game(pr), q = E.LEARNING.flatMap((lo) => lo.quiz).find((x) => x.id === d.q), right = Number(d.i) === q.answer;
      pr.quiz[d.q] = Number(d.i);
      E.audit('Answered a knowledge-check question');
      const g = E.game(pr), extra = [];
      if (g.level > before.level) extra.push(`Level up: you are now ${g.title}.`);
      g.earned.filter((id) => !before.earned.includes(id)).forEach((id) => extra.push(`Badge earned: ${E.BADGES.find((x) => x.id === id).name}.`));
      toast((right ? 'Correct on the first try.' : 'Read the explanation, it will come up again on the wards.') + (extra.length ? ' ' + extra.join(' ') : ''), `+${right ? E.XP.quizRight : E.XP.quizTried} XP · Knowledge check`, extra.length ? 'medal' : right ? 'star' : 'info');
      commit();
    },
    progressAsk() { const g = E.game(E.progress()); ui.modal = { type: 'confirm', title: 'Reset your progress?', text: `This erases your ${g.xp} XP, your level, your badges, every completed practice task, all of your knowledge-check answers, your mission stars and your proficiency check results, so you can start over from Level 1. Notes and orders you entered in the charts are kept. This cannot be undone.`, yes: 'progressDo', yesLabel: 'Reset my progress', danger: true }; render(); },
    progressDo() { const pr = E.progress(); pr.events = {}; pr.quiz = {}; pr.pigs = 0; delete pr.bonus; delete pr.missions; delete pr.exam; delete pr.active; delete pr.games; award = null; ui.modal = null; E.audit('Reset own learning progress'); status('Progress reset. You are back at Level 1.'); commit(); },
    learnPrint() { window.print(); },
    learnExport() { exportReport(viewedLearner()); },
  };

  /* ---------- text inputs (data-input) and field changes (data-change) ---------- */
  const I = {
    ptSearch(el) {
      const q = el.value.trim().toLowerCase(), box = $('#ptSearchRes');
      const hits = q ? E.db.patients.filter((p) => p.name.toLowerCase().includes(q) || p.mrn.includes(q)) : [];
      box.innerHTML = q ? (hits.map((p) => `<button data-act="openPt" data-id="${p.id}"><b>${E.esc(p.name)}</b><span>${E.age(p.dob)} ${p.sex} · MRN ${p.mrn} · ${E.esc(p.bed)}</span></button>`).join('') || '<div class="empty">No matching patient</div>') : '';
    },
    orderSearch(el) { ui.orderQuery = el.value; $('#orderRes').innerHTML = V.orderResults(el.value); },
    noteText(el) {
      const p = curPt(), d = p.noteDraft;
      // expand ".phrase" when followed by whitespace
      const pos = el.selectionStart, m = el.value.slice(0, pos).match(/(^|\s)\.([a-z]+)(\s)$/i);
      if (m && E.DOT[m[2].toLowerCase()]) {
        const rep = E.DOT[m[2].toLowerCase()](p), start = pos - m[2].length - 2;
        el.value = el.value.slice(0, start) + rep + m[3] + el.value.slice(pos);
        el.setSelectionRange(start + rep.length + 1, start + rep.length + 1);
        track('note.dot');
      }
      d.text = el.value; d.pristine = false; E.save();
      const bar = $('#blankBar'); if (bar) bar.innerHTML = V.blankBar(el.value);
    },
  };
  const C = {
    draft(el) { const d = curPt().drafts.find((x) => x.id === el.dataset.id); if (d) { d[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value; E.save(); } },
    noteType(el) { const p = curPt(), d = p.noteDraft; d.type = el.value; if (d.pristine) d.text = E.expandTemplate(E.NOTE_TEMPLATES[d.type], p); commit(); },
  };

  /* ---------- event wiring ---------- */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search')) { const b = $('#ptSearchRes'); if (b) b.innerHTML = ''; }
    const nav = e.target.closest('.tools .tool');
    if (nav) { bounce = { key: nav.getAttribute('href') || nav.dataset.act, at: Date.now() }; const gl = $('.gl', nav); if (gl) gl.classList.add('bounce'); }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.act];
    if (fn) fn(el.dataset, el, e);
  });
  document.addEventListener('focusin', (e) => { if (e.target.id === 'ptSearch') $('#toast').innerHTML = ''; });   // never let a balloon sit over the patient search
  document.addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.input; if (k && I[k]) I[k](e.target); });
  document.addEventListener('change', (e) => { const k = e.target.dataset && e.target.dataset.change; if (k && C[k]) C[k](e.target); });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === 'Escape' && ui.modal) return A.closeModal();
    if (e.key === 'Enter' && t.id === 'loginName') return A.login();
    if (e.key === 'Enter' && t.matches && t.matches('tr[data-act]')) return t.click();
    if (e.key === 'F2' && t.id === 'noteText') { e.preventDefault(); nextBlank(t, true); }
  });
  window.addEventListener('hashchange', onRoute);

  /* Simulated lab/imaging turnaround. Never re-render underneath someone who is typing. */
  const busy = () => ui.modal || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
  setInterval(() => {
    if (!E.db || !E.db.user) return;
    if (E.missionsTick && E.missionsTick()) { E.save(); pendingRender = true; }
    const done = E.processResults();
    if (done.length) { E.save(); toast(done.map((x) => `${x.o.name} — ${x.p.name}`).join('; '), 'New result', 'results'); pendingRender = true; }
    const sim = E.simTick ? E.simTick() : [];
    if (sim.length) { E.save(); toast(sim.join('; '), 'While you were working', 'inbox'); pendingRender = true; }
    if (pendingRender && !busy()) render();
  }, 2000);

  // Missions and the proficiency check (js/missions.js) add their actions here and borrow a few helpers.
  E.app = { commit, render, toast, status, go, curPt };
  Object.assign(A, E.missionActions || {}, E.gameActions || {});

  // Glyph bitmaps are drawn first; the screen is built from them.
  (E.glyphsReady || Promise.resolve()).then(() => { E.load(); onRoute(); splash('boot'); });
})();
