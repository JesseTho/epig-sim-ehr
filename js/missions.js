/* EPIG Student Edition — missions and the proficiency check.

   MISSIONS are short cases, one per patient. Each has objectives (all needed for a bronze star), a safety rule
   (nothing ordered that puts the patient at risk, for silver) and bonus objectives (all of them, for gold).
   Progress is read from what the learner actually did in the chart after starting: the activity log, the
   orders they entered and the notes they signed. One mission has a live event: partway through, the patient
   gets worse and the learner has to notice and respond.

   The PROFICIENCY CHECK is a timed chart hunt: questions answered by finding things in the patients' charts,
   with a pass mark, a limited number of attempts and a printable certificate. Questions are built from the
   chart data when the check starts.

   FACULTY: missions and the check's settings are defined below and can be edited here. */
(function () {
  const E = window.EHR, V = E.V, esc = E.esc, icon = E.icon;

  /* ---------- reading what the learner did ---------- */
  const H = {
    viewed: (label) => (c) => c.audit.some((a) => a.ts >= c.from && a.action === 'Viewed ' + label) || (label === 'Flowsheets' && c.seenAtFire),
    ordered: (ids, opt) => (c) => c.orders.some((o) => o.ts >= c.from && ids.includes(o.catId) && (!opt || !opt.stat || o.priority === 'STAT')),
    note: (...words) => (c) => c.notes.some((n) => n.ts >= c.from && words.every((w) => [].concat(w).some((alt) => n.text.toLowerCase().includes(alt)))),
    read: (re) => (c) => c.audit.some((a) => a.ts >= c.from && a.action.startsWith('Read message') && re.test(a.action)),
  };
  const RN = 'Reyes, Tomas RN';

  E.MISSIONS = [
    {
      id: 'akana', pid: 'p1', glyph: 'code', title: 'Diurese him safely',
      brief: 'Mr. Akana came in fluid-overloaded and is on IV furosemide. This morning his potassium is 5.1 and his creatinine has crept up to 2.1. Review the trends, order follow-up labs and write today’s progress note.',
      required: [
        { text: 'Review his lab trends in Results', test: H.viewed('Results') },
        { text: 'Check his vitals and weights in Flowsheets', test: H.viewed('Flowsheets') },
        { text: 'Order a metabolic panel to recheck potassium and creatinine', test: H.ordered(['bmp', 'cmp']) },
        { text: 'Sign a progress note', test: H.note() },
      ],
      bonus: [
        { text: 'Order a magnesium level (diuretics waste magnesium)', why: 'Loop diuretics lower magnesium, and low magnesium makes the heart irritable.', test: H.ordered(['mg']) },
        { text: 'Your note addresses both the potassium and the kidney function', why: 'The plan for diuresis depends on both numbers, so the note should name both.', test: H.note(['potassium', 'hyperkal'], ['creatinine', 'kidney', 'renal', 'aki']) },
      ],
      traps: [
        { tags: ['acei'], why: 'He had angioedema on lisinopril. ACE inhibitors are contraindicated.' },
        { tags: ['hyperk'], why: 'His potassium is already 5.1, and this would push it higher.' },
        { tags: ['nsaid'], why: 'NSAIDs hold on to fluid and worsen kidney function in heart failure.' },
      ],
      debrief: 'Diuresis is a balance: enough to relieve congestion, not so much that the kidneys or the potassium go wrong. Daily labs and weights are how you see the balance.',
    },
    {
      id: 'santos', pid: 'p2', glyph: 'mar', title: 'Answer the nurse',
      brief: 'Ms. Santos’s nurse has sent you a message about this morning’s labs. Find it, act on it, and make sure your fix is safe for a patient with penicillin anaphylaxis.',
      required: [
        { text: 'Read the nurse’s message in the Inbox', test: H.read(/Santos/) },
        { text: 'Order potassium replacement', test: H.ordered(['kcl_po']) },
        { text: 'Order a metabolic panel to recheck it', test: H.ordered(['bmp', 'cmp']) },
      ],
      bonus: [
        { text: 'Check her magnesium too', why: 'Potassium will not stay up while magnesium is low, so the two are checked together.', test: H.ordered(['mg']) },
        { text: 'Document the plan in a progress note', why: 'A replacement with no documented plan leaves the next team guessing whether it was rechecked.', test: H.note(['potassium', 'kcl', 'hypokal']) },
      ],
      traps: [
        { tags: ['penicillin'], why: 'She had anaphylaxis to penicillin.' },
        { tags: ['cephalosporin'], why: 'After penicillin anaphylaxis a cephalosporin carries a small cross-reaction risk, and she is already covered with levofloxacin.' },
      ],
      debrief: 'Potassium is replaced, then rechecked. Nurses raise these by message because they are easy to miss in a busy list; answering promptly closes the loop.',
    },
    {
      id: 'whitfield', pid: 'p3', glyph: 'orders', title: 'Bleeding or clotting?',
      brief: 'Mr. Whitfield is a day out from a hip replacement and is restarting warfarin for atrial fibrillation. His hemoglobin has dropped and his INR is rising. Check what matters before you change anything.',
      required: [
        { text: 'Review his hemoglobin and INR in Results', test: H.viewed('Results') },
        { text: 'Order a PT/INR to follow the warfarin', test: H.ordered(['inr']) },
        { text: 'Order a CBC to follow the hemoglobin', test: H.ordered(['cbc']) },
        { text: 'Sign a progress note', test: H.note() },
      ],
      bonus: [
        { text: 'Check the MAR to see which pain medicines he has actually had', why: 'What was ordered and what was given are not the same thing; the MAR shows what he actually received.', test: H.viewed('MAR') },
        { text: 'Your note states the INR goal', why: 'Writing the target (2 to 3) tells the next clinician when to change the dose.', test: H.note(['inr']) },
      ],
      traps: [
        { tags: ['nsaid'], why: 'An NSAID with warfarin, the day after surgery, sharply raises the risk of bleeding.' },
        { tags: ['warfarin-interact'], why: 'This drug can push his INR up sharply.' },
        { ids: ['enoxaparin', 'heparin_sq', 'apixaban'], why: 'He is already anticoagulated with warfarin; a second anticoagulant doubles the bleeding risk.' },
      ],
      debrief: 'After surgery, bleeding and clotting pull in opposite directions. Following the INR and hemoglobin, and choosing pain relief that does not affect bleeding, keeps both under control.',
    },
    {
      id: 'kahale', pid: 'p4', glyph: 'results', title: 'Close the gap',
      brief: 'Ms. Kahale came in with diabetic ketoacidosis and is on an insulin infusion. Her anion gap is narrowing. Confirm it, keep checking, and plan the safe switch to insulin under the skin.',
      required: [
        { text: 'Trend her anion gap or bicarbonate in Results', test: H.viewed('Results') },
        { text: 'Order a repeat metabolic panel', test: H.ordered(['bmp', 'cmp']) },
        { text: 'Order long-acting insulin to overlap with the drip', test: H.ordered(['glargine']) },
      ],
      bonus: [
        { text: 'Recheck her ketones', why: 'Beta-hydroxybutyrate shows the acidosis clearing more directly than glucose does.', test: H.ordered(['bhb']) },
        { text: 'Start a diet now that she can eat', why: 'Eating is one of the conditions for coming off the drip.', test: H.ordered(['diet_carb', 'diet_reg', 'diet_clear']) },
        { text: 'Your note mentions the anion gap', why: 'The gap is the number that decides when the drip stops, so it belongs in the note.', test: H.note(['gap']) },
      ],
      traps: [{ tags: ['sulfa'], why: 'She has a sulfonamide allergy (rash).' }],
      debrief: 'The insulin drip stops only after long-acting insulin has had time to work. Stopping it first lets the ketoacidosis come straight back.',
    },
    {
      id: 'chen', pid: 'p5', glyph: 'vitals', title: 'Watch for a rebleed',
      brief: 'Mr. Chen had a bleeding ulcer treated by endoscopy yesterday. He looks stable for now. Review him, set up the right monitoring, and keep an eye on him.',
      required: [
        { text: 'Confirm his code status and the matching order', test: H.viewed('Orders') },
        { text: 'Review his hemoglobin trend in Results', test: H.viewed('Results') },
        { text: 'Order a CBC to follow his hemoglobin', test: H.ordered(['cbc']) },
        { stage: 'event', text: 'Look at his new vitals in Flowsheets', test: H.viewed('Flowsheets') },
        { stage: 'event', text: 'Order a STAT CBC', test: H.ordered(['cbc'], { stat: true }) },
        { stage: 'event', text: 'Start IV fluids or blood', test: H.ordered(['ns_bolus', 'lr', 'prbc']) },
      ],
      bonus: [
        { stage: 'event', text: 'Order a type and screen so blood is ready', why: 'Blood cannot be given until it is matched; ordering early saves time if he needs it.', test: H.ordered(['ts']) },
        { text: 'Your note mentions his code status', why: 'DNR/DNI shapes what escalation looks like, so the team needs it written down.', test: H.note(['dnr', 'code status']) },
      ],
      traps: [
        { tags: ['nsaid'], why: 'NSAIDs caused his ulcer and would make it bleed again.' },
        { tags: ['anticoag', 'anticoag-ppx'], why: 'Anticoagulants are held while an ulcer is actively bleeding.' },
        { tags: ['contrast'], why: 'He is allergic to iodinated contrast.' },
      ],
      event: {
        after: 45,   // seconds after the mission starts
        vitals: { temp: 36.5, hr: 118, rr: 22, sbp: 88, dbp: 50, spo2: 95, o2: 'Room air', pain: 3 },
        message: { from: RN, subject: 'Chen, Robert — pale, dizzy, heart rate 118', body: 'Mr. Chen just passed a large black stool and nearly fainted getting back to bed. He is pale and clammy. HR 118, BP 88/50. Vitals are in the flowsheet. Can you come and see him?\n\nTomas' },
      },
      debrief: 'A fast heart rate and a falling blood pressure after a GI bleed mean rebleeding until proven otherwise. DNR/DNI limits CPR and intubation; it does not limit fluids, blood or a call to GI.',
    },
    {
      id: 'kowalski', pid: 'p6', glyph: 'flowsheets', title: 'Breathe easy',
      brief: 'Ms. Kowalski is in with a COPD flare and gets drowsy when her oxygen runs high. She is on prednisone. Check her gas and her oxygen, and look after the side effects of her treatment.',
      required: [
        { text: 'Review her blood gas in Results', test: H.viewed('Results') },
        { text: 'Check her oxygen saturation in Flowsheets', test: H.viewed('Flowsheets') },
        { text: 'Sign a progress note', test: H.note() },
      ],
      bonus: [
        { text: 'Order glucose checks', why: 'Prednisone raises blood sugar; her last glucose was 188.', test: H.ordered(['poc_glu']) },
        { text: 'Your note gives her oxygen target', why: 'In CO2 retention the target is 88 to 92%, and the nurses need to see that number.', test: H.note(['88']) },
        { text: 'Ask physical and occupational therapy to see her', why: 'Getting her moving early shortens the stay and lowers the chance of coming back.', test: H.ordered(['c_ptot']) },
      ],
      traps: [
        { tags: ['fluoroquinolone'], why: 'She had Achilles tendon pain on levofloxacin.' },
        { tags: ['opioid'], why: 'Opioids slow breathing in a patient who already retains carbon dioxide.' },
      ],
      debrief: 'In chronic CO2 retention the oxygen target is 88 to 92%: enough to protect the organs without blunting the drive to breathe.',
    },
  ];
  const mission = (id) => E.MISSIONS.find((m) => m.id === id);
  E.STARS = ['No star yet', 'Bronze', 'Silver', 'Gold'];

  /** Score a mission in progress from the chart: which objectives are done, what unsafe orders were placed. */
  function evaluate(m, act) {
    const me = E.db.user.name, p = E.pt(m.pid);
    const c = {
      from: act.start, seenAtFire: !!act.seenAtFire,
      audit: E.db.audit.filter((a) => a.user === me && a.patientId === m.pid && a.ts >= act.start),
      orders: p.orders.filter((o) => o.by === me && o.ts >= act.start && !['Declined', 'Discontinued'].includes(o.status)),
      notes: p.notes.filter((n) => n.author === me && n.ts >= act.start),
    };
    const run = (x) => {
      if (x.stage === 'event' && !act.firedAt) return { text: x.text, why: x.why, done: false, hidden: true };
      return { text: x.text, why: x.why, done: !!x.test(x.stage === 'event' ? Object.assign({}, c, { from: act.firedAt }) : c), isNew: x.stage === 'event' };
    };
    const required = m.required.map(run), bonus = m.bonus.map(run);
    const hits = [];
    c.orders.forEach((o) => {
      const tags = (E.cat(o.catId) || {}).tags || [];
      const t = m.traps.find((tr) => (tr.ids || []).includes(o.catId) || (tr.tags || []).some((x) => tags.includes(x)));
      if (t) hits.push({ order: o.name, why: t.why });
    });
    const allReq = required.every((x) => x.done), allBonus = bonus.every((x) => x.done);
    const stars = !allReq ? 0 : hits.length ? 1 : allBonus ? 3 : 2;
    const responded = !!m.event && !!act.firedAt && required.filter((x) => x.isNew).every((x) => x.done);
    return { required, bonus, hits, stars, responded };
  }

  /* ---------- the live event ---------- */
  /** Called every couple of seconds by the app. Fires a mission's event when its time comes. Returns true if anything changed. */
  E.missionsTick = () => {
    if (!E.db || !E.db.user) return false;
    const a = E.progress().active;
    if (!a || a.type !== 'mission' || a.firedAt) return false;
    const m = mission(a.id);
    if (!m || !m.event || Date.now() - a.start < m.event.after * 1000) return false;
    const p = E.pt(m.pid), ev = m.event;
    a.firedAt = Date.now();
    a.seenAtFire = location.hash === `#/pt/${m.pid}/flowsheets`;
    p.vitals.push(Object.assign({ ts: Date.now(), by: ev.message.from }, ev.vitals));
    E.message(Object.assign({ type: 'Staff Message', patientId: m.pid, act: 'flowsheets' }, ev.message));
    if (E.app) E.app.toast(ev.message.subject, 'Page from nursing', 'alert');
    if (E.pal) E.pal.pose('worry', 4000);
    return true;
  };

  /* ---------- the proficiency check ---------- */
  E.EXAM = { questions: 10, pass: 0.8, attempts: 2, minutes: 15, perPatient: 2, perKind: 3 };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uniq = (a) => [...new Set(a)];
  /** Four options: the answer and three distractors, shuffled. Returns null if there are not enough distractors. */
  const mc = (pid, kind, q, answer, pool, where) => {
    const d = shuffle(uniq(pool.filter((x) => x && x !== answer))).slice(0, 3);
    if (d.length < 3) return null;
    const options = shuffle([answer].concat(d));
    return { pid, kind, q, options, answer: options.indexOf(answer), where };
  };
  const impression = (r) => { const m = /IMPRESSION:\s*([^\n]+)/.exec(r.text); return m ? m[1].split(/(?<=\.)\s/)[0].trim() : null; };

  /** Build a fresh set of questions from the charts as they stand. */
  E.buildExam = () => {
    const P = E.db.patients, bank = [];
    const LAB_PREF = ['K', 'Cr', 'Hgb', 'WBC', 'Glu', 'BNP', 'Lactate', 'INR', 'pCO2', 'BHB', 'Na', 'Plt'];
    P.forEach((p) => {
      // first recorded lab values
      const first = [...p.labs].sort((x, y) => x.ts - y.ts)[0];
      if (first) shuffle(LAB_PREF.filter((k) => k in first.values)).slice(0, 2).forEach((k) => {
        const d = E.LABS[k], v = first.values[k], fmt = (n) => `${E.labVal(k, n)}${d.unit ? ' ' + d.unit : ''}`;
        const pool = [0.62, 0.78, 1.25, 1.45, 0.9, 1.12].map((f) => fmt(v * f));
        bank.push(mc(p.id, 'lab', `What was the first ${d.name.toLowerCase()} recorded for ${p.name} this admission?`, fmt(v), pool, 'Results: the lab table runs newest on the left, so the first value is the right-hand column. Chart Review → Labs also lists every set.'));
      });
      // allergies
      const al = E.allergiesOf(p);
      if (al.length) { const a = al[0]; bank.push(mc(p.id, 'allergy', `What reaction is documented for ${p.name}’s allergy to ${a.agent}?`, a.reaction, P.flatMap((x) => x.allergies.map((y) => y.reaction)).concat(['Hives', 'Anaphylaxis', 'Diffuse rash', 'Nausea and vomiting', 'Angioedema']), 'The Allergies group in the patient sidebar, or Problems & Allergies.')); }
      else bank.push(mc(p.id, 'allergy', `What does the chart record about ${p.name}’s allergies?`, 'No known allergies', P.flatMap((x) => x.allergies.map((y) => y.agent)), 'The Allergies group in the patient sidebar, or the Allergies column on the patient list.'));
      // code status
      bank.push(mc(p.id, 'code', `What is ${p.name}’s code status?`, p.codeStatus, ['Full Code', 'DNR/DNI', 'DNR only, intubation allowed', 'Comfort care only'], 'The Code Status group at the top of the patient sidebar, and the matching order under Orders.'));
      // attending
      bank.push(mc(p.id, 'attending', `Who is ${p.name}’s attending physician?`, p.attending, uniq(P.map((x) => x.attending)).concat(['Fontaine, Rhea MD', 'Iwasaki, Glenn MD', 'Aldana, Rafael MD']), 'Details in the patient sidebar, or the Attending column on the patient list.'));
      // a report impression
      const rep = p.reports.find((r) => impression(r));
      if (rep) bank.push(mc(p.id, 'report', `What was the impression of ${p.name}’s ${rep.name}?`, impression(rep), P.flatMap((x) => x.reports.map(impression)), 'Results: the reports list under the lab table. Chart Review → Imaging & Procedures shows them too.'));
      // a medication dose
      const med = p.orders.find((o) => o.type === 'med' && o.status === 'Active' && (E.cat(o.catId).doses || []).length >= 4);
      if (med) bank.push(mc(p.id, 'dose', `What dose of ${med.name} is ${p.name} ordered?`, med.dose, E.cat(med.catId).doses, 'Summary → Active medications, or Orders, or the MAR.'));
      // problem list
      const mine = p.problems.filter((x) => x.status === 'Active').map((x) => x.name), other = P.filter((x) => x !== p).flatMap((x) => x.problems.map((y) => y.name)).filter((n) => !mine.some((mn) => mn.split(/[ ,(]/)[0] === n.split(/[ ,(]/)[0]));
      if (mine.length > 1) bank.push(mc(p.id, 'problem', `Which of these is on ${p.name}’s active problem list?`, mine[1 + Math.floor(Math.random() * (mine.length - 1))], other, 'Summary → Problem list, or Active Problems in the patient sidebar.'));
    });
    const picked = [], perPt = {}, perKind = {};
    for (const q of shuffle(bank.filter(Boolean))) {
      if (picked.length === E.EXAM.questions) break;
      if ((perPt[q.pid] || 0) >= E.EXAM.perPatient || (perKind[q.kind] || 0) >= E.EXAM.perKind) continue;
      picked.push(q); perPt[q.pid] = (perPt[q.pid] || 0) + 1; perKind[q.kind] = (perKind[q.kind] || 0) + 1;
    }
    return picked;
  };
  const examState = (pr) => pr.exam || (pr.exam = { attempts: [] });
  const examLeft = (a) => Math.max(0, a.start + E.EXAM.minutes * 60e3 - Date.now());
  const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function submitExam(timeUp) {
    const pr = E.progress(), a = pr.active;
    if (!a || a.type !== 'exam') return;
    const ex = examState(pr), before = E.game(pr);
    const review = a.qs.map((q, i) => ({ q: q.q, chosen: a.answers[i] == null ? null : q.options[a.answers[i]], answer: q.options[q.answer], right: a.answers[i] === q.answer, where: q.where }));
    const score = review.filter((r) => r.right).length, passed = score >= Math.ceil(E.EXAM.pass * a.qs.length);
    ex.attempts.push({ start: a.start, end: Date.now(), score, total: a.qs.length, passed, timeUp: !!timeUp, review });
    if (passed && !ex.passed) { ex.passed = true; ex.passedAt = Date.now(); ex.passedScore = score; }
    delete pr.active;
    E.audit(`Finished the proficiency check: ${score} of ${a.qs.length}${passed ? ', passed' : ''}${timeUp ? ' (time ran out)' : ''}`);
    E.ui.modal = { type: 'examResult', n: ex.attempts.length - 1 };
    E.save();
    if (passed) announce(before, `You passed the proficiency check with ${score} of ${a.qs.length}.`, 'Proficiency check passed');
    E.app.render();
  }
  /** Points, level-ups and badges after a mission or the check, in one balloon. */
  function announce(before, text, title) {
    const g = E.game(E.progress()), extra = [];
    if (g.level > before.level) extra.push(`Level up: you are now ${g.title}.`);
    g.earned.filter((id) => !before.earned.includes(id)).forEach((id) => extra.push(`Badge earned: ${E.BADGES.find((x) => x.id === id).name}.`));
    const gained = g.xp - before.xp;
    if (!gained && !extra.length) return;
    E.app.toast(text + (extra.length ? '\n' + extra.join(' ') : ''), (gained ? `+${gained} XP · ` : '') + title, extra.length ? 'medal' : 'star');
    if (E.pal) E.pal.pose('cheer', 2600);
  }

  /* ---------- reports ---------- */
  E.missionReport = (pr) => E.MISSIONS.map((m) => { const r = (pr.missions || {})[m.id] || {}; return { mission: m.title, patient: E.pt(m.pid).name, bestStars: r.best || 0, medal: E.STARS[r.best || 0], plays: r.plays || 0, respondedToEvent: m.event ? !!r.responded : undefined }; });
  E.examReport = (pr) => { const ex = pr.exam || { attempts: [] }; return { passed: !!ex.passed, passedAt: ex.passedAt ? new Date(ex.passedAt).toISOString() : null, passMark: `${Math.ceil(E.EXAM.pass * E.EXAM.questions)} of ${E.EXAM.questions}`, attempts: ex.attempts.map((t) => ({ at: new Date(t.start).toISOString(), score: `${t.score} of ${t.total}`, passed: t.passed, timeRanOut: t.timeUp })) }; };

  /* ---------- views ---------- */
  const stars = (n, size) => `<span class="stars" role="img" aria-label="${n} of 3 stars">${[1, 2, 3].map((i) => `<span class="${i <= n ? 'on' : 'off'}">${icon('star', size || 24)}</span>`).join('')}</span>`;
  const MIN_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const MAX_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" fill="none" stroke="#fff" stroke-width="2"/></svg>';
  const item = (x) => `<li class="${x.done ? 'done' : ''}">${x.done ? icon('check', 16) : '<i class="tick0"></i>'}<span>${esc(x.text)}${x.isNew && !x.done ? ' <b class="chip red">New</b>' : ''}</span></li>`;

  V.missions = () => {
    const { chip } = V.h, pr = E.progress(), a = pr.active, canOrder = E.can('order.sign') || E.can('order.pend');
    const total = E.MISSIONS.reduce((n, m) => n + (((pr.missions || {})[m.id] || {}).best || 0), 0);
    const cards = E.MISSIONS.map((m) => {
      const p = E.pt(m.pid), rec = (pr.missions || {})[m.id] || {}, live = a && a.type === 'mission' && a.id === m.id;
      const btn = live ? `<a class="btn primary" href="#/pt/${m.pid}/summary">Resume</a>`
        : `<button class="btn${rec.best ? '' : ' primary'}" data-act="missionStart" data-id="${m.id}"${a || !canOrder ? ' disabled' : ''}>${rec.plays ? 'Play again' : 'Start mission'}</button>`;
      return `<article class="mission${live ? ' live' : ''}${rec.best === 3 ? ' gold' : ''}"><header>${icon(m.glyph, 48)}<div><b>${esc(m.title)}</b><span>${esc(p.name)} · ${esc(p.bed)}</span></div></header>
        <p>${esc(m.brief)}</p><footer>${stars(rec.best || 0)}${m.event ? chip('Live event', 'red') : ''}<span class="spacer"></span>${live ? chip('In progress', 'amber') + ' ' : ''}${btn}</footer></article>`;
    }).join('');
    const ex = examState(pr), used = ex.attempts.length, best = used ? Math.max(...ex.attempts.map((t) => t.score)) : null, locked = !ex.passed && used >= E.EXAM.attempts, inExam = a && a.type === 'exam';
    const need = Math.ceil(E.EXAM.pass * E.EXAM.questions);
    const action = ex.passed ? `<button class="btn primary" data-act="certPrint">${icon('print', 24)}Print certificate</button>`
      : inExam ? `<button class="btn" data-act="dockToggle">Show the question panel</button>`
      : locked ? '' : `<button class="btn primary" data-act="examAsk"${a ? ' disabled' : ''}>${used ? 'Try again' : 'Start the check'}</button>`;
    const boss = `<section class="boss"><div class="boss-art">${icon(ex.passed ? 'trophy' : 'idcard', 96)}</div><div class="boss-main">
        <span class="boss-kick">Final challenge</span><h3>Proficiency check</h3>
        <p>${E.EXAM.questions} questions in ${E.EXAM.minutes} minutes, answered by finding information in the patients’ charts. The question panel stays open in the corner while you move around the record. ${need} correct to pass; ${E.EXAM.attempts} attempts, after which a faculty member can reset them.</p>
        <dl class="kv"><dt>Status</dt><dd>${ex.passed ? `${chip('Passed', 'green')} ${ex.passedScore} of ${E.EXAM.questions}, ${E.fmtDate(ex.passedAt)}` : inExam ? chip('In progress', 'amber') : locked ? chip('Attempts used', 'red') : 'Not passed yet'}</dd><dt>Attempts</dt><dd>${used} of ${E.EXAM.attempts}${best != null ? ` · best ${best} of ${E.EXAM.questions}` : ''}</dd></dl>
        ${locked ? '<p class="notice warn">Both attempts are used. A faculty member logged in as Physician can reset them from the Learning page.</p>' : ''}
        <div class="boss-act">${action}</div></div></section>`;
    return `<div class="page missions"><div class="doc-h"><div><h2>${icon('trophy', 56)}Missions</h2>
        <p class="muted">Each mission is a short case on one of your patients. Finish every objective for a bronze star, order nothing unsafe for silver, and complete every bonus for gold. Your best result on each mission counts toward your level.</p></div>
        <div class="mission-total">${stars(Math.round((total / (E.MISSIONS.length * 3)) * 3), 32)}<b>${total} of ${E.MISSIONS.length * 3} stars</b></div></div>
      ${canOrder ? '' : `<div class="notice info">${icon('info', 24)}<span>Missions involve entering orders, so they are written for the Medical Student and Physician roles. The proficiency check below is open to every role.</span></div>`}
      ${a && a.type === 'mission' ? `<div class="notice info">${icon('info', 24)}<span>A mission is in progress. Finish or abandon it from the mission panel in the corner before starting another.</span></div>` : ''}
      <div class="mission-grid">${cards}</div>${boss}</div>`;
  };

  /** The panel in the bottom-left corner while a mission or the proficiency check is under way. */
  V.dock = () => {
    if (!E.db.user) return '';
    const pr = E.progress(), a = pr.active;
    if (!a) return '';
    const min = !!E.ui.dockMin;
    let title, body, timer = '', glyph;
    if (a.type === 'mission') {
      const m = mission(a.id), p = E.pt(m.pid), r = evaluate(m, a);
      const hiddenReq = r.required.some((x) => x.hidden);
      glyph = 'trophy'; title = m.title;
      body = `<p class="dock-pt">${icon('user', 16)}<a href="#/pt/${p.id}/summary">${esc(p.name)}</a></p><p class="dock-brief">${esc(m.brief)}</p>
        <h5>Objectives</h5><ul class="dock-list">${r.required.filter((x) => !x.hidden).map(item).join('')}${hiddenReq ? '<li class="hid"><i class="tick0"></i><span>Keep an eye on him. Things may change.</span></li>' : ''}
        <li class="${r.hits.length ? 'bad' : 'done'}">${icon(r.hits.length ? 'remove' : 'check', 16)}<span>Order nothing that puts the patient at risk</span></li></ul>
        <h5>Bonus</h5><ul class="dock-list">${r.bonus.filter((x) => !x.hidden).map(item).join('')}</ul>
        <div class="dock-score">${stars(r.stars, 16)}<span>${E.STARS[r.stars]} so far</span></div>
        <div class="dock-acts"><button class="btn xs" data-act="missionAbandon">Abandon</button><button class="btn xs primary" data-act="missionFinish">Finish mission</button></div>`;
    } else {
      const q = a.qs[a.idx];
      glyph = 'idcard'; title = 'Proficiency check';
      timer = `<span id="dock-timer" class="dock-timer">${mmss(examLeft(a))}</span>`;
      body = `<p class="dock-q"><b>Question ${a.idx + 1} of ${a.qs.length}</b></p><p class="dock-qt">${esc(q.q)}</p>
        ${q.options.map((o, i) => `<button class="qopt${a.answers[a.idx] === i ? ' picked' : ''}" data-act="examPick" data-i="${i}" aria-pressed="${a.answers[a.idx] === i}">${esc(o)}</button>`).join('')}
        <div class="dock-dots">${a.qs.map((_, i) => `<button class="${i === a.idx ? 'on' : ''}${a.answers[i] != null ? ' ans' : ''}" data-act="examGo" data-i="${i}" aria-label="Question ${i + 1}${a.answers[i] != null ? ', answered' : ''}">${i + 1}</button>`).join('')}</div>
        <div class="dock-acts"><button class="btn xs" data-act="examGo" data-i="${a.idx - 1}"${a.idx === 0 ? ' disabled' : ''}>Previous</button><button class="btn xs" data-act="examGo" data-i="${a.idx + 1}"${a.idx === a.qs.length - 1 ? ' disabled' : ''}>Next</button><span class="spacer"></span><button class="btn xs primary" data-act="examSubmitAsk">Submit</button></div>`;
    }
    return `<aside class="dock${min ? ' min' : ''} dock-${a.type}" aria-label="${esc(title)}"><header class="dock-h">${icon(glyph, 16)}<b>${esc(title)}</b>${timer}<button class="cap" data-act="dockToggle" title="${min ? 'Show' : 'Minimize'}" aria-label="${min ? 'Show panel' : 'Minimize panel'}">${min ? MAX_SVG : MIN_SVG}</button></header><div class="dock-b">${body}</div></aside>`;
  };

  V.modalExt = Object.assign(V.modalExt || {}, {
    missionResult(m, modal) {
      const ms = mission(m.id), r = m.r, p = E.pt(ms.pid);
      const list = (xs) => `<ul class="dock-list wide">${xs.map((x) => `<li class="${x.done ? 'done' : 'bad'}">${icon(x.done ? 'check' : 'remove', 16)}<span>${esc(x.text)}${!x.done && x.why ? `<small>${esc(x.why)}</small>` : ''}</span></li>`).join('')}</ul>`;
      return modal(`Mission ${r.stars ? 'complete' : 'ended'} — ${ms.title}`, `
        <div class="result-head">${stars(r.stars, 48)}<div><b>${E.STARS[r.stars]}</b><span>${esc(ms.title)} · ${esc(p.name)}</span>${m.xp ? `<span class="xp">+${m.xp} XP</span>` : ''}</div></div>
        <p class="fine">Bronze: every objective done. Silver: and nothing unsafe ordered. Gold: and every bonus.</p>
        <h4>Objectives</h4>${list(r.required.filter((x) => !x.hidden))}${r.required.some((x) => x.hidden) ? '<p class="fine">You finished before his condition changed, so the rest of this mission never started.</p>' : ''}
        <h4>Safety</h4>${r.hits.length ? `<ul class="dock-list wide">${r.hits.map((h) => `<li class="bad">${icon('alert', 16)}<span><b>${esc(h.order)}</b><small>${esc(h.why)}</small></span></li>`).join('')}</ul>` : `<ul class="dock-list wide"><li class="done">${icon('check', 16)}<span>Nothing you ordered put the patient at risk.</span></li></ul>`}
        <h4>Bonus</h4>${list(r.bonus.filter((x) => !x.hidden))}
        <div class="debrief">${icon('learning', 48)}<div><p>${esc(ms.debrief)}</p></div></div>`,
        `${r.stars < 3 ? `<button class="btn" data-act="missionStart" data-id="${ms.id}">Try again</button>` : ''}<a class="btn" href="#/missions" data-act="closeModal">All missions</a><button class="btn primary" data-act="closeModal">Close</button>`, 'lg');
    },
    examResult(m, modal) {
      const pr = E.progress(), ex = examState(pr), t = ex.attempts[m.n], need = Math.ceil(E.EXAM.pass * t.total), left = E.EXAM.attempts - ex.attempts.length;
      return modal('Proficiency check — results', `
        <div class="result-head"><span class="result-score ${t.passed ? 'pass' : 'fail'}">${t.score}<small>of ${t.total}</small></span><div><b>${t.passed ? 'Passed' : 'Not passed yet'}</b><span>${need} correct needed to pass${t.timeUp ? ' · time ran out' : ''}</span><span>${t.passed ? 'Your certificate is ready to print.' : left > 0 ? `${left} attempt${left > 1 ? 's' : ''} left. Each attempt draws new questions.` : 'No attempts left. A faculty member can reset them from the Learning page.'}</span></div></div>
        <h4>Your answers</h4><ol class="exam-review">${t.review.map((r) => `<li class="${r.right ? 'done' : 'bad'}">${icon(r.right ? 'check' : 'remove', 16)}<div><b>${esc(r.q)}</b>${r.right ? `<span>${esc(r.answer)}</span>` : `<span>Your answer: ${esc(r.chosen || 'none')}</span><span>Correct: <b>${esc(r.answer)}</b></span><small>Where to find it: ${esc(r.where)}</small>`}</div></li>`).join('')}</ol>`,
        `${t.passed ? `<button class="btn" data-act="certPrint">${icon('print', 16)}Print certificate</button>` : left > 0 ? '<button class="btn" data-act="examAsk">Try again</button>' : ''}<button class="btn primary" data-act="closeModal">Close</button>`, 'lg');
    },
  });

  /* ---------- actions (merged into the app's action table by js/app.js) ---------- */
  const busyWith = (pr) => pr.active && (pr.active.type === 'exam' ? 'the proficiency check' : 'a mission');
  E.missionActions = {
    missionStart(d) {
      const pr = E.progress(), m = mission(d.id);
      if (pr.active) { if (pr.active.type === 'mission' && pr.active.id === m.id) return E.app.go(`#/pt/${m.pid}/summary`); E.ui.modal = null; E.app.status(`Finish ${busyWith(pr)} first.`); return E.app.render(); }
      pr.active = { type: 'mission', id: m.id, start: Date.now(), firedAt: null };
      pr.missions = pr.missions || {};
      E.ui.modal = null; E.ui.dockMin = false;
      E.audit(`Started mission: ${m.title}`, m.pid); E.save();
      E.app.go(`#/pt/${m.pid}/summary`);
    },
    missionFinish() {
      const pr = E.progress(), a = pr.active, m = mission(a.id), r = evaluate(m, a), before = E.game(pr);
      const rec = (pr.missions = pr.missions || {})[m.id] || { best: 0, plays: 0 };
      rec.plays++; rec.last = r.stars; rec.at = Date.now();
      if (r.stars > rec.best) rec.best = r.stars;
      if (r.responded) rec.responded = true;
      pr.missions[m.id] = rec;
      delete pr.active;
      E.audit(`Finished mission: ${m.title} (${E.STARS[r.stars]})`, m.pid);
      E.ui.modal = { type: 'missionResult', id: m.id, r, xp: E.game(pr).xp - before.xp };
      E.save();
      announce(before, `${E.STARS[r.stars]} on “${m.title}”.`, 'Mission');
      E.app.render();
    },
    missionAbandon() { E.ui.modal = { type: 'confirm', title: 'Abandon this mission?', text: 'Your progress on this mission is dropped and no stars are awarded. Anything you ordered or wrote stays in the chart. You can start it again any time.', yes: 'missionAbandonDo', yesLabel: 'Abandon mission', danger: true }; E.app.render(); },
    missionAbandonDo() { const pr = E.progress(), m = mission(pr.active.id); delete pr.active; E.ui.modal = null; E.audit(`Abandoned mission: ${m.title}`, m.pid); E.app.commit(); },
    dockToggle() { E.ui.dockMin = !E.ui.dockMin; E.app.render(); },

    examAsk() {
      const pr = E.progress(), ex = examState(pr), n = ex.attempts.length + 1;
      if (pr.active) { E.ui.modal = null; E.app.status(`Finish ${busyWith(pr)} first.`); return E.app.render(); }
      if (!ex.passed && ex.attempts.length >= E.EXAM.attempts) return E.app.status('Both attempts are used.');
      E.ui.modal = { type: 'confirm', title: 'Start the proficiency check?', text: `${E.EXAM.questions} questions, ${E.EXAM.minutes} minutes. Each one is answered by finding something in a patient’s chart, so move around the record freely; the question panel stays open in the bottom-left corner and the clock keeps running. ${Math.ceil(E.EXAM.pass * E.EXAM.questions)} correct to pass. This is attempt ${n} of ${E.EXAM.attempts}.`, yes: 'examStart', yesLabel: 'Start the clock' };
      E.app.render();
    },
    examStart() {
      const pr = E.progress();
      pr.active = { type: 'exam', start: Date.now(), qs: E.buildExam(), answers: [], idx: 0 };
      pr.active.answers = pr.active.qs.map(() => null);
      E.ui.modal = null; E.ui.dockMin = false;
      E.audit('Started the proficiency check'); E.save();
      E.app.go('#/home');
    },
    examPick(d) { const a = E.progress().active; if (!a || a.type !== 'exam') return; a.answers[a.idx] = Number(d.i); E.app.commit(); },
    examGo(d) { const a = E.progress().active; if (!a || a.type !== 'exam') return; a.idx = Math.max(0, Math.min(a.qs.length - 1, Number(d.i))); E.app.commit(); },
    examSubmitAsk() {
      const a = E.progress().active, blank = a.answers.filter((x) => x == null).length;
      E.ui.modal = { type: 'confirm', title: 'Submit your answers?', text: blank ? `You have ${blank} unanswered question${blank > 1 ? 's' : ''}. Unanswered questions count as wrong.` : 'You have answered every question. Once you submit, this attempt is scored.', yes: 'examSubmit', yesLabel: 'Submit' };
      E.app.render();
    },
    examSubmit() { submitExam(false); },
    examReset(d) {
      if (E.db.user.role !== 'physician') return;
      const pr = E.db.progress[d.id]; if (!pr) return;
      pr.exam = { attempts: [], passed: !!(pr.exam && pr.exam.passed), passedAt: pr.exam && pr.exam.passedAt, passedScore: pr.exam && pr.exam.passedScore };
      E.audit(`Reset proficiency check attempts for ${pr.name}`);
      E.app.status(`Attempts reset for ${pr.name}.`); E.app.commit();
    },
    certPrint() {
      const pr = E.progress(), ex = examState(pr);
      if (!ex.passed) return;
      const tot = E.MISSIONS.reduce((n, m) => n + (((pr.missions || {})[m.id] || {}).best || 0), 0), g = E.game(pr);
      const old = document.getElementById('cert'); if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', `<div id="cert"><div class="cert-in">
        <div class="cert-brand">${icon('logo', 96)}${E.wordmark(72)}</div>
        <p class="cert-kick">Certificate of Proficiency</p>
        <p>This certifies that</p><p class="cert-name">${esc(pr.name)}</p>
        <p>passed the EPIG SIM EHR proficiency check, finding information across simulated inpatient charts, with a score of <b>${ex.passedScore} of ${E.EXAM.questions}</b> on ${E.fmtDate(ex.passedAt)}.</p>
        <p class="cert-stats">${esc(E.roleLabel(pr.role))} · Level ${g.level}, ${esc(g.title)} · ${tot} of ${E.MISSIONS.length * 3} mission stars · ${g.earned.length} of ${E.BADGES.length} badges</p>
        <div class="cert-sign"><span>Faculty signature</span><span>Date</span></div>
        <p class="cert-fine">This certificate records practice in a training simulation with fictional patients. It does not grant access to any real health record system.</p></div></div>`);
      document.body.classList.add('print-cert');
      E.audit('Printed proficiency certificate');
      setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('print-cert'), 500); }, 60);
    },
  };

  /* the exam clock, once a second; time running out submits the attempt */
  setInterval(() => {
    if (!E.db || !E.db.user || !E.app) return;
    const a = E.progress().active;
    if (!a || a.type !== 'exam') return;
    const left = examLeft(a), el = document.getElementById('dock-timer');
    if (el) { el.textContent = mmss(left); el.classList.toggle('low', left < 120e3); }
    if (left <= 0) submitExam(true);
  }, 1000);
})();
