/* SIM+EHR Student Edition — speaking up: receiving a handoff (EPA 8), reporting a safety event (EPA 13) and calling
   the attending about a deteriorating patient (EPA 10). Plan: docs/lo-improvements-plan.md, items B1, B2 and C1.

   FACULTY: the handoff texts, the safety factors and the Patient Safety replies are data at the top of this file.
   None of it has been reviewed yet. Nothing here explains to the learner how it is scored; the shift report and the
   learner report show what was done. */
(function () {
  const E = window.EHR;
  const esc = (s) => E.esc(s);
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const icon = (n, s) => E.icon(n, s);

  /* =====================================================================================================
     1. DATA
     ===================================================================================================== */
  const NIGHT = 'Kaimana, Lee MD (night intern)';
  /* The night intern's sign-out, waiting in the Inbox when a shift starts. Each has one line the chart disproves.
     The watch patient is the shift's sickest (E.SHIFTS[].sickest); a read-back names them and their problem. */
  const L = {
    p1: 'Akana, Keoni (5W-512A). Stable. Heart failure, on IV furosemide. Daily weight and a metabolic panel in the morning.',
    p2: 'Santos, Maria (5W-508). Watcher. Sepsis from pneumonia, improving on antibiotics. Penicillin allergy: anaphylaxis.',
    p3: 'Whitfield, James (4E-417). Stable. Day 1 after a right hip replacement. On warfarin; check the INR before the next dose.',
    p4: 'Kahale, Leilani (5W-502). Watcher. DKA on an insulin drip. The drip does not stop until long-acting insulin has had time to work.',
    p5: 'Chen, Robert (5W-515). Watcher. Bleeding duodenal ulcer. DNR/DNI. Watch his stools and hemoglobin.',
    p6: 'Kowalski, Diane (5W-520). Watcher. COPD flare. Oxygen target 88 to 92%; more oxygen is not better for her.',
  };
  const ORDER = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  E.NIGHT_HANDOFFS = {
    // FACULTY: not yet reviewed.
    day1: { wrong: 'p5', text: 'Chen, Robert (5W-515). Watcher. Bleeding duodenal ulcer. Full Code. Watch his stools and hemoglobin.',
      why: 'The chart sidebar and the code status order both say DNR/DNI.',
      reply: 'You are right, my mistake. He is DNR/DNI. It was confirmed with him and his daughter on admission. Thank you for checking.' },
    short: { wrong: 'p2', text: 'Santos, Maria (5W-508). Watcher. Sepsis from pneumonia, improving on antibiotics. No known allergies.',
      why: 'Her allergy list has penicillin, with anaphylaxis, at high severity.',
      reply: 'Good catch. She had anaphylaxis to penicillin. I nearly ordered piperacillin-tazobactam for her overnight. Thank you.' },
    storm: { wrong: 'p1', text: 'Akana, Keoni (5W-512A). Stable. Heart failure, on IV furosemide. If his blood pressure climbs, restart his home lisinopril.',
      why: 'His allergy list has lisinopril (ACE inhibitors), with angioedema, at high severity.',
      reply: 'Thank you. He had angioedema on lisinopril; it is on his allergy list. If his pressure needs treating, it will have to be something else.' },
  };
  const RIGHT_REPLY = 'I checked: that line is right.';

  /* Safety event report. Factors a learner can tick; for each harm rule, the factors a review would find and what the
     hospital changed afterwards (the reply from Patient Safety). A near miss stopped by the attending is handled
     like the rule its order would have broken. */
  E.SAFETY_FACTORS = [
    ['sound', 'Sound-alike or look-alike patient or drug'],
    ['advisory', 'An advisory overridden or not read'],
    ['missing', 'Information missing or hard to find'],
    ['handoff', 'A gap in a handoff'],
    ['pressure', 'Time pressure or interruptions'],
    ['default', 'An order set default'],
    ['knowledge', 'A gap in knowledge'],
    ['other', 'Something else'],
  ];
  const SAFETY_TEAM = 'Ng, Carol RN (Patient Safety)';
  E.SAFETY_REVIEW = {
    // FACULTY: not yet reviewed.
    allergy: { factors: ['advisory', 'missing'], fix: 'Pharmacy has made the high-severity allergy advisory a hard stop. It can now be released only by a pharmacist, after a call to the prescriber.' },
    bleed: { factors: ['advisory', 'knowledge', 'missing'], fix: 'An active GI bleed on the problem list now blocks NSAIDs and anticoagulants in the order screen, and the bleed is shown in the chart banner.' },
    hyperk: { factors: ['advisory', 'missing'], fix: 'Potassium orders now show the latest potassium and its time beside the dose, and an order is blocked when the latest value is 5.0 or more.' },
    opioid: { factors: ['knowledge', 'advisory'], fix: 'A second opioid now needs the prescriber to record what the first one has done, and the nurse is prompted to check sedation before giving it.' },
    insulin: { factors: ['missing', 'knowledge'], fix: 'Insulin orders now show the last three glucose values, and the order is held for a pharmacist when the latest is under 100.' },
    nephro: { factors: ['advisory', 'knowledge'], fix: 'The kidney advisory now lists the safer alternatives, and pharmacy reviews every nephrotoxic drug when the creatinine is 2.0 or more.' },
    other: { factors: ['advisory', 'knowledge'], fix: 'The review has been shared with the prescribing team, and the advisory that fired has been added to the next teaching session on decision support.' },
  };

  /* =====================================================================================================
     2. RECORDS (on the learner's progress, so a ward reset never loses them)
     ===================================================================================================== */
  const pr = () => E.progress();
  const list = (k) => { const p = pr(); if (!Array.isArray(p[k])) p[k] = []; return p[k]; };
  const shiftNow = () => { const a = E.db && E.db.user ? pr().active : null; return a && a.type === 'shift' ? a : null; };
  const later = (ms, msg) => list('speakQueue').push({ due: Date.now() + ms, msg });

  /** Replies due (Patient Safety, the attending) are posted from the app's tick. True when one was posted. */
  E.speakTick = () => {
    const q = E.db && E.db.user && pr().speakQueue; if (!q || !q.length) return false;
    const now = Date.now(), due = q.filter((x) => x.due <= now);
    if (!due.length) return false;
    pr().speakQueue = q.filter((x) => x.due > now);
    due.forEach((x) => E.message(x.msg));
    if (E.app) E.app.toast(due.map((x) => x.msg.subject).join('; '), 'New message', 'inbox');
    return true;
  };

  /* =====================================================================================================
     3. RECEIVING A HANDOFF
     ===================================================================================================== */
  /** Called by js/shift.js when a shift starts, after the overnight messages. */
  E.postNightHandoff = (sh, ts) => {
    const def = E.NIGHT_HANDOFFS[sh.id]; if (!def) return;
    const lines = ORDER.map((pid) => ({ pid, text: pid === def.wrong ? def.text : L[pid] }));
    E.message({ type: 'Handoff', from: NIGHT, subject: 'Night handoff — 5 West', body: lines.map((l) => l.text).join('\n'), handoff: { shift: sh.id, lines, asked: [] } });
    E.db.inbox[0].ts = ts;
  };
  const hoRecord = (a, sh) => {
    const recs = list('handoffsReceived'); let r = recs.find((x) => x.start === a.start);
    if (!r) recs.push((r = { start: a.start, shift: sh.id, title: sh.title, questioned: [], plantedFound: false, plantedAt: null, wrongQuestions: 0, readBack: '', readBackAt: null }));
    return r;
  };
  /** The shift report's handoff lines (js/shift.js evaluate). `cut` is when rounds began. */
  E.handoffItems = (a, sh, cut) => {
    const def = E.NIGHT_HANDOFFS[sh.id]; if (!def) return [];
    const r = list('handoffsReceived').find((x) => x.start === a.start) || { questioned: [], wrongQuestions: 0 };
    const sick = E.pt(sh.sickest), last = sick.name.split(',')[0].toLowerCase(), words = (sh.handoffWords || []).flat();
    const rb = String(r.readBack || '').toLowerCase();
    const named = !!r.readBackAt && r.readBackAt <= cut && rb.includes(last) && words.some((w) => rb.includes(w));
    return [
      { phase: 'Pre-rounds', pid: def.wrong, text: 'Questioned the line in the night handoff that the chart does not support', done: !!r.plantedAt && r.plantedAt <= cut, why: `${def.why} A handoff is checked against the chart, not taken on trust, and the time to ask is before the night intern goes home.` },
      { phase: 'Pre-rounds', text: 'Asked about the handoff only where the chart disagreed', done: (r.wrongQuestions || 0) <= 1, why: 'Check the chart first, then ask about what does not match. The night intern is leaving.' },
      { phase: 'Pre-rounds', pid: sick.id, text: `Read back the plan for the patient to watch, ${sick.name}`, done: named, why: `A read-back in your own words, naming the patient to watch and the problem, shows the plan was heard. ${sick.name} was the one to watch.` },
    ];
  };

  /* =====================================================================================================
     4. SAFETY EVENT REPORT
     ===================================================================================================== */
  const eventById = (id) => ((pr().safety || {}).events || []).find((e) => e.id === id);
  const reportOf = (id) => list('safetyReports').find((r) => r.evId === id);
  /** Can this event be reported (it exists, is the learner's, and has not been reported yet)? */
  E.canReport = (id) => { const e = eventById(id); return !!e && e.source !== 'case' && !reportOf(id); };
  E.reportedEvent = (id) => !!reportOf(id);
  const ruleOf = (e) => (e.rule && E.SAFETY_REVIEW[e.rule] ? e.rule : (() => {
    if (e.kind === 'harm') return e.rule || 'other';
    const t = String(e.title || '').toLowerCase();
    return /allerg/.test(t) ? 'allergy' : /bleed|nsaid|anticoag/.test(t) ? 'bleed' : /potassium/.test(t) ? 'hyperk' : /opioid|sedat/.test(t) ? 'opioid' : /insulin|glucose/.test(t) ? 'insulin' : /kidney|creatinine|nephro/.test(t) ? 'nephro' : 'other';
  })());

  /* =====================================================================================================
     5. CALLING THE ATTENDING (SBAR)
     ===================================================================================================== */
  /** Numbers the learner can see right now: the latest vitals and the latest value of every lab. */
  const currentNumbers = (p) => {
    const v = E.lastVitals(p), out = [];
    if (v) ['temp', 'hr', 'rr', 'sbp', 'dbp', 'spo2'].forEach((k) => v[k] != null && out.push(Number(v[k])));
    Object.keys(E.LABS).forEach((k) => { const l = E.latestLab(p, k); if (l) out.push(Number(E.labVal(k, l.value))); });
    return out;
  };
  const REQUEST = /\b(can you|could you|would you|please|come|see (him|her|them)|review|agree|need you|ok to|okay to|should i|may i|want me|do you want)\b|\?/i;
  E.sbarCheck = (p, f) => {
    const said = `${f.s || ''} ${f.a || ''}`.match(/\d+(?:\.\d+)?/g) || [], now = currentNumbers(p);
    return { citesValue: said.some((x) => now.some((v) => Math.abs(v - Number(x)) < 1e-6)), hasRequest: REQUEST.test(f.r || '') };
  };
  /** The shift report's escalation line: the learner called about the deterioration, with a request. */
  E.escalationItems = (a, sh) => {
    const det = sh.events.find((e) => e.type === 'det'); if (!det) return [];
    const fired = a.fired[det.id], p = E.pt(det.pid);
    const done = !!fired && list('escalations').some((x) => x.pid === det.pid && x.ts >= fired && x.ts >= a.start && x.hasRequest);
    return [{ phase: 'Day work', pid: det.pid, text: `Called the attending about ${p.name}, and said what you needed`, done, reached: !!fired && !(a.unreach || {})[det.id], why: 'A deteriorating patient is a call to the attending, not only orders. Situation, background, assessment, and a clear request.' }];
  };

  /* =====================================================================================================
     6. VIEWS
     ===================================================================================================== */
  const V = E.V;
  /** The handoff in the Inbox: each line can be questioned; replies appear beneath; a read-back closes it. */
  V.handoffRead = (m) => {
    const h = m.handoff, asked = h.asked || [];
    const lines = h.lines.map((l, i) => {
      const q = asked.find((x) => x.i === i);
      return `<li class="ho-line${q ? ' asked' : ''}"><span>${esc(l.text)}</span>${q ? `<div class="ho-reply">${icon('inbox', 16)}<span><b>${esc(NIGHT.split(' (')[0])}:</b> ${esc(q.reply)}</span></div>` : h.readBack ? '' : `<button class="btn xs" data-act="hoAsk" data-id="${m.id}" data-i="${i}">Question this</button>`}</li>`;
    }).join('');
    return `<div class="ho"><p class="muted">From ${esc(NIGHT)}, going off shift.</p><ol class="ho-lines">${lines}</ol>
      ${h.readBack ? `<div class="ho-rb"><b>Your read-back</b><p>${esc(h.readBack)}</p></div>`
        : `<label class="ho-rb">Read back<textarea id="hoReadBack" rows="2" maxlength="400" placeholder="The patient to watch, and what to do if…"></textarea></label><div><button class="btn primary" data-act="hoReadBack" data-id="${m.id}">Send read-back</button></div>`}</div>`;
  };
  /** Extra buttons in the Inbox reading bar. */
  V.ibExtra = (m) => (m.type === 'Page' && m.critical && m.patientId && E.pt(m.patientId) ? `<button class="btn xs" data-act="sbarOpen" data-id="${m.id}">${icon('help', 16)}Call attending</button>` : '');
  /** The Report button on a row of the safety record, and under a consequence picture. */
  V.reportButton = (id, cls) => (E.canReport(id) ? `<button class="btn ${cls || 'xs'}" data-act="safetyReportOpen" data-id="${esc(id)}">Report event</button>` : E.reportedEvent(id) ? '<span class="chip green">Reported</span>' : '');

  V.modalExt = Object.assign(V.modalExt || {}, {
    safetyReport(m, modal, cancel) {
      const e = eventById(m.id); if (!e) return '';
      const what = `${e.patient}: ${e.order || 'an order'} — ${e.title}${e.kind === 'harm' ? '' : `. Stopped by ${e.by || 'the team'} before it reached the patient.`}`;
      return modal('Safety event report', `
        <p class="muted">${esc(e.patient)} · ${E.fmtDT(e.ts)}</p>
        <label class="sr-f">What happened<textarea id="srWhat" rows="3" maxlength="600">${esc(what)}</textarea></label>
        <fieldset class="sr-f"><legend>Did it reach the patient?</legend>
          <label><input type="radio" name="srReach" value="no"> No (near miss)</label>
          <label><input type="radio" name="srReach" value="noharm"> Yes, no harm</label>
          <label><input type="radio" name="srReach" value="harm"> Yes, with harm</label></fieldset>
        <fieldset class="sr-f"><legend>What made it easier to happen?</legend>${E.SAFETY_FACTORS.map(([id, t]) => `<label><input type="checkbox" name="srFactor" value="${id}"> ${esc(t)}</label>`).join('')}</fieldset>
        <label class="sr-f">One change that would stop it happening again<textarea id="srChange" rows="2" maxlength="300"></textarea></label>`,
        `${cancel}<span id="modalErr" class="err"></span><button class="btn primary" data-act="safetyReportSend">Send report</button>`, 'lg');
    },
    sbar(m, modal, cancel) {
      const p = E.pt(m.pid); if (!p) return '';
      const f = (k, label, ph) => `<label class="sr-f"><span><b>${k}</b> ${label}</span><textarea id="sbar${k}" rows="2" maxlength="300" placeholder="${esc(ph)}"></textarea></label>`;
      return modal(`Call ${p.attending}`, `<p class="muted">About ${esc(p.name)} · ${esc(p.bed)}</p>
        ${f('S', 'Situation', 'What is happening now')}${f('B', 'Background', 'Why they are here, what matters')}${f('A', 'Assessment', 'What you think is going on, with the numbers')}${f('R', 'Request', 'What you need from the attending')}`,
        `${cancel}<span id="modalErr" class="err"></span><button class="btn primary" data-act="sbarSend">Call</button>`, 'lg');
    },
  });

  /* =====================================================================================================
     7. ACTIONS
     ===================================================================================================== */
  const msgById = (id) => E.db.inbox.find((x) => x.id === id);
  const err = (t) => { const el = document.getElementById('modalErr'); if (el) el.textContent = t; };
  E.speakActions = {
    hoAsk(d) {
      const m = msgById(d.id); if (!m || !m.handoff) return;
      const h = m.handoff, i = Number(d.i), line = h.lines[i]; if (!line || h.asked.some((x) => x.i === i)) return;
      const def = E.NIGHT_HANDOFFS[h.shift] || {}, planted = line.pid === def.wrong;
      h.asked.push({ i, ts: Date.now(), reply: planted ? def.reply : RIGHT_REPLY });
      E.audit(`Questioned a handoff line: ${line.text.split('.')[0]}`, line.pid);
      const a = shiftNow(), sh = a && E.SHIFTS.find((s) => s.id === a.id);
      if (a && sh && sh.id === h.shift) {
        const r = hoRecord(a, sh); r.questioned.push(i);
        if (planted && !r.plantedAt) { r.plantedFound = true; r.plantedAt = Date.now(); }
        if (!planted) r.wrongQuestions = (r.wrongQuestions || 0) + 1;
      }
      if (planted) E.app.track('handoff.receive');
      E.app.commit();
    },
    hoReadBack(d) {
      const m = msgById(d.id), el = document.getElementById('hoReadBack'); if (!m || !m.handoff || !el) return;
      const t = el.value.trim(); if (!t) return E.app.status('Write the read-back first.');
      m.handoff.readBack = t.slice(0, 400);
      E.audit('Sent a handoff read-back');
      const a = shiftNow(), sh = a && E.SHIFTS.find((s) => s.id === a.id);
      if (a && sh && sh.id === m.handoff.shift) { const r = hoRecord(a, sh); r.readBack = m.handoff.readBack; r.readBackAt = Date.now(); }
      E.app.commit();
    },
    safetyReportOpen(d) { if (!E.canReport(d.id)) return; E.ui.modal = { type: 'safetyReport', id: d.id }; E.app.render(); },
    safetyReportSend() {
      const m = E.ui.modal, e = m && eventById(m.id); if (!e || reportOf(e.id)) return;
      const reach = document.querySelector('input[name="srReach"]:checked'), factors = [...document.querySelectorAll('input[name="srFactor"]:checked')].map((x) => x.value);
      const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
      if (!reach) return err('Say whether it reached the patient.');
      if (!factors.length) return err('Tick at least one thing that made it easier to happen.');
      const rule = ruleOf(e), rev = E.SAFETY_REVIEW[rule] || E.SAFETY_REVIEW.other;
      const reachedRight = e.kind === 'harm' ? reach.value === 'harm' : reach.value === 'no';
      list('safetyReports').push({ evId: e.id, at: Date.now(), kind: e.kind, patient: e.patient, order: e.order || '', what: val('srWhat').slice(0, 600), reached: reach.value, reachedRight, factors, factorMatch: factors.some((f) => rev.factors.includes(f)), change: val('srChange').slice(0, 300) });
      const named = E.SAFETY_FACTORS.filter(([id]) => rev.factors.includes(id)).map(([, t]) => t.toLowerCase());
      later(50000, { type: 'Safety', from: SAFETY_TEAM, patientId: e.pid, act: 'orders', subject: `Your safety report — ${e.patient}`,
        body: `Thank you for reporting this. Reports like yours are how the hospital finds its weak points.\n\nThe review found: ${named.join('; ')}.\n\nWhat has changed: ${rev.fix}\n\nNobody is in trouble for a report. Keep them coming.\n\n${SAFETY_TEAM}` });
      E.audit(`Filed a safety event report: ${e.order || e.title}`, e.pid);
      E.ui.modal = null; E.app.track('safety.report'); E.app.status('Report sent to Patient Safety.'); E.app.commit();
    },
    sbarOpen(d) { const m = msgById(d.id); if (!m || !m.patientId) return; E.ui.modal = { type: 'sbar', pid: m.patientId, mid: m.id }; E.app.render(); },
    sbarSend() {
      const m = E.ui.modal, p = m && E.pt(m.pid); if (!p) return;
      const f = {}; ['S', 'B', 'A', 'R'].forEach((k) => { const el = document.getElementById('sbar' + k); f[k.toLowerCase()] = el ? el.value.trim().slice(0, 300) : ''; });
      if (!f.s || !f.r) return err('Say at least what is happening and what you need.');
      const c = E.sbarCheck(p, f);
      list('escalations').push(Object.assign({ ts: Date.now(), pid: p.id, patient: p.name }, f, c));
      const reply = c.hasRequest
        ? `${c.citesValue ? 'Thanks, that is clear.' : 'What are the numbers? Next time give me the vitals first.'} Yes to what you asked. Keep going with what you have started, and I am coming up to see ${p.sex === 'M' ? 'him' : 'her'} in ten minutes.`
        : `${c.citesValue ? 'Thanks for the numbers.' : 'I need the vitals when you call.'} What do you need from me? Tell me what you want me to do or decide.`;
      later(c.hasRequest ? 20000 : 15000, { type: 'Attending reply', from: p.attending, patientId: p.id, act: 'summary', subject: `Re: your call about ${p.name}`, body: reply });
      E.audit('Called the attending (SBAR)', p.id);
      E.ui.modal = null; E.app.track('escalate.sbar'); E.app.status(`Called ${p.attending}.`); E.app.commit();
    },
  };

  /* =====================================================================================================
     8. REPORT
     ===================================================================================================== */
  const iso = (t) => (t ? new Date(t).toISOString() : null);
  E.speakReport = (p) => ({
    handoffsReceived: (p.handoffsReceived || []).map((r) => ({ shift: r.title, at: iso(r.start), plantedFound: !!r.plantedAt, wrongQuestions: r.wrongQuestions || 0, readBack: r.readBack || '' })),
    safetyReports: (p.safetyReports || []).map((r) => ({ at: iso(r.at), patient: r.patient, order: r.order, kind: r.kind, what: r.what, reached: r.reached, reachedRight: r.reachedRight, factors: r.factors, factorMatch: r.factorMatch, change: r.change })),
    escalations: (p.escalations || []).map((x) => ({ at: iso(x.ts), patient: x.patient, s: x.s, b: x.b, a: x.a, r: x.r, citesValue: x.citesValue, hasRequest: x.hasRequest })),
  });
})();
