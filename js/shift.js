/* SIM+EHR Student Edition — shifts and consequences.

   A SHIFT is a whole day on the ward against a compressed clock: 07:00 to 19:00 hospital time in about
   16 real minutes. It has four phases (pre-rounds, rounds, day work, sign-out), scripted events that fire at
   set hospital times, and a list of scored expectations read from what the learner actually did in the
   charts, in the same way as a mission. The clock can be paused, pauses itself when the browser tab is
   hidden, and never runs outside a shift.

   CONSEQUENCES apply everywhere, in or out of a shift. A table of harm rules says which order, on a patient
   with which condition, hurts them. About 30 seconds after such an order takes effect the patient gets
   worse: new vital signs or a new lab, a page from the nurse, and a line on the learner's safety record.
   The right response stabilises the patient. No response within about three hospital hours means a rapid
   response and a transfer to intensive care (the worst outcome in this sim). An order stopped before it
   reaches the patient is a near miss, not harm.

   The SAFETY RECORD is kept per learner: one harm event is a page, two means a short debrief before more
   orders can be signed, three suspends privileges until a five-question remediation round is passed.

   FACULTY: the shifts, the harm rules and the remediation questions are data in this file and can be edited
   here. Timings are in EHR.CONFIG.shift (js/config.js). Clinical content is simplified for teaching.

   TIME: this file has its own hospital hour, minutes x 60 / (endHour - startHour) real seconds: 80 with the
   defaults. It runs the shift clock and every harm rescue timer, in a shift or out of one. A PBL case keeps a
   slower hour of its own (EHR.CONFIG.cases.hourSeconds, 240 by default) for its decision tree; a rescue timer
   that starts during a case still counts in this file's 80-second hours. Every one of these clocks stops while
   the learner has paused (EHR.pauseChecks), the tab is hidden, a question dialog is open or privileges are
   suspended. */
(function () {
  const E = window.EHR, V = E.V, esc = E.esc, icon = E.icon;
  const CFG = () => Object.assign({ minutes: 16, startHour: 7, endHour: 19, rounds: 8.5, dayWork: 9.5, signOut: 17.5, harmDelay: 30, rescueHours: 3, strikes: 3, remediationQuestions: 5, remediationPass: 4 }, (E.CONFIG && E.CONFIG.shift) || {});
  /** Real milliseconds in one hospital hour. */
  const hourMs = () => (CFG().minutes * 60000) / (CFG().endHour - CFG().startHour);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hhmm = (h) => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const RN1 = 'Reyes, Tomas RN', RN2 = 'Lindqvist, Hana RN';
  const tagsOf = (o) => (E.cat(o.catId) || {}).tags || [];
  const mrms = (p) => (p.sex === 'M' ? 'Mr. ' : 'Ms. ') + p.name.split(', ')[0];
  const he = (p) => (p.sex === 'M' ? 'He' : 'She'), his = (p) => (p.sex === 'M' ? 'his' : 'her'), him = (p) => (p.sex === 'M' ? 'him' : 'her');
  const labOf = (p, k, d) => { const l = E.latestLab(p, k); return l ? l.value : d; };
  /* A new set is always stamped later than anything already filed, so "latest" means this one even when the
     sim files two sets in the same millisecond. */
  const after = (list) => Math.max(Date.now(), list.reduce((m, x) => Math.max(m, x.ts), 0) + 1);
  const pushLab = (p, name, values) => p.labs.push({ id: E.uid('l'), ts: after(p.labs), name, values });
  const pushVitals = (p, over, by) => { const b = Object.assign({ temp: 37, hr: 80, rr: 16, sbp: 120, dbp: 70, spo2: 97, o2: 'Room air', pain: 0 }, E.lastVitals(p) || {}); delete b.sim; p.vitals.push(Object.assign(b, { ts: after(p.vitals), by: by || p.rn }, over)); };
  const crises = () => E.db.crises || (E.db.crises = []);
  const shiftOf = (pr) => (pr && pr.active && pr.active.type === 'shift' ? pr.active : null);
  const myShift = () => (E.db && E.db.user ? shiftOf(E.progress()) : null);
  const say = (text, title, glyph) => { if (E.app) E.app.toast(text, title, glyph); };
  const pose = (name, ms) => { if (E.pal) E.pal.pose(name, ms || 4000); };
  const same = (a, b) => (E.sameUser ? E.sameUser(a, b) : a === b);
  /* The learner's own pause, for everyone who keeps a clock (js/core.js reads E.pauseChecks to hold lab results
     and simulated staff). A hidden tab pauses a shift too, so that is covered here as well. */
  (E.pauseChecks = E.pauseChecks || []).push(() => { const a = myShift(); return !!(a && a.paused && !a.over); });
  /** True while anything that registered a pause check says the learner has paused. A broken check never stops the clock. */
  const pausedAnywhere = () => (E.pauseChecks || []).some((f) => { try { return !!f(); } catch (e) { return false; } });
  /** Hospital time left on a crisis before the rapid response, such as "2 h 35 min". */
  const leftText = (c) => { const m = Math.ceil((Math.max(0, c.left || 0) / hourMs()) * 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`; };

  /* =====================================================================================================
     1. HARM RULES
     Each rule: when it applies, what happens to the patient, what the nurse says, and what puts it right.
     `need` is a list of groups; one order from each group, entered after the patient got worse, counts as
     the treatment. Drugs that are not in the order catalogue (epinephrine, naloxone, the hyperkalemia and
     hypoglycemia protocols) are given "per protocol" by the simulated nurse or resident, with no dose stated.
     ===================================================================================================== */
  E.HARM_RULES = [
    {
      id: 'allergy', title: 'Severe allergic reaction',
      hazard: 'A documented high-severity allergy to this drug class', where: 'The Allergies box in the chart sidebar, and the allergy advisory', response: 'Stop the drug and support breathing and blood pressure: oxygen or an IV fluid bolus',
      // a verified allergy still harms the patient even if someone has taken it off the list
      hit: (p, o) => p.allergies.find((a) => a.severity === 'High' && a.cls && tagsOf(o).includes(a.cls) && (a.status !== 'Removed' || a.verified)),
      why: (p, o) => { const a = E.HARM_RULES[0].hit(p, o); return `${p.name} has a documented reaction to ${a.agent}: ${a.reaction.toLowerCase()} (severity high). ${o.name} is in that class.`; },
      need: [['o2', 'ns_bolus']], needText: 'oxygen or an IV fluid bolus',
      onset(p, o) {
        const a = this.hit(p, o) || { agent: 'this drug', reaction: 'a severe reaction' }, bad = /anaphyl/i.test(a.reaction);
        const v = bad ? { hr: 128, rr: 28, sbp: 82, dbp: 46, spo2: 89 } : { hr: 112, rr: 24, spo2: 91 };
        pushVitals(p, v);
        const now = E.lastVitals(p);
        return { subject: 'severe reaction after a new drug', body: `${mrms(p)} is reacting to ${o.name}. This is the reaction on ${his(p)} allergy list for ${a.agent}: ${a.reaction.toLowerCase()}.\n\nHR ${now.hr}, BP ${now.sbp}/${now.dbp}, RR ${now.rr}, SpO2 ${now.spo2}%. The rapid response nurse is at the bedside and treating the reaction per protocol.\n\nPlease stop the drug now, and order oxygen or an IV fluid bolus.` };
      },
      settle(p) { pushVitals(p, { hr: 96, rr: 18, sbp: 112, dbp: 68, spo2: 96 }); return 'The drug is stopped and the reaction is settling. HR 96, BP 112/68, SpO2 96%. We will watch closely for the next few hours in case it comes back.'; },
    },
    {
      id: 'bleed', title: 'Bleeding made worse',
      hazard: 'An active GI bleed: NSAIDs and anticoagulants make bleeding worse', where: 'The problem list (an active GI bleed), and the advisory', response: 'Stop the drug, give IV fluids or blood, and follow the hemoglobin',
      hit: (p, o) => tagsOf(o).some((t) => ['nsaid', 'anticoag', 'anticoag-ppx'].includes(t)) && p.problems.some((x) => x.status === 'Active' && /GI bleed/i.test(x.name)),
      why: (p, o) => `${p.name} has an active GI bleed on the problem list. ${o.name} increases bleeding.`,
      need: [['ns_bolus', 'lr', 'prbc']], needText: 'IV fluids or blood',
      onset(p, o) {
        const was = labOf(p, 'Hgb', 9), hgb = +Math.max(5.8, was - 1.5).toFixed(1);
        pushVitals(p, { hr: 122, rr: 22, sbp: 84, dbp: 48, spo2: 95 });
        pushLab(p, 'CBC (STAT, drawn by nursing)', { Hgb: hgb, Hct: +(hgb * 3).toFixed(1) });
        return { subject: 'bleeding again, BP 84/48', body: `${mrms(p)} has passed a large black stool and nearly fainted. HR 122, BP 84/48. A STAT hemoglobin is ${hgb.toFixed(1)}, down from ${was.toFixed(1)}.\n\n${o.name} was started a short while ago, and ${he(p).toLowerCase()} has a bleeding ulcer.\n\nPlease stop it now. ${he(p)} needs IV fluids or blood.` };
      },
      settle(p) { pushVitals(p, { hr: 98, rr: 18, sbp: 106, dbp: 62, spo2: 97 }); return 'The drug is stopped and fluids are running. HR 98, BP 106/62. GI has been told. A repeat CBC after the fluids would be wise.'; },
    },
    {
      id: 'hyperk', title: 'Dangerous potassium',
      hazard: 'A potassium of 5.0 or more: this drug raises it further', where: 'Results: the latest potassium, and the advisory', response: 'Stop the potassium source, get an ECG and recheck the potassium',
      hit: (p, o) => tagsOf(o).includes('hyperk') && labOf(p, 'K', 0) >= 5.0,
      why: (p, o) => `The latest potassium for ${p.name} is ${labOf(p, 'K', 0).toFixed(1)} mmol/L. ${o.name} raises potassium.`,
      need: [['ecg', 'bmp', 'cmp']], needText: 'a 12-lead ECG or a repeat metabolic panel',
      onset(p, o) {
        const was = labOf(p, 'K', 5), k = +Math.min(6.8, Math.max(6.1, was + 0.9)).toFixed(1);
        pushLab(p, 'Potassium (STAT)', { K: k });
        return { subject: `critical potassium ${k.toFixed(1)}`, body: `The lab has called a critical potassium of ${k.toFixed(1)} for ${mrms(p)}. It was ${was.toFixed(1)}. ${he(p)} feels weak, and the monitor shows tall, peaked T waves.\n\n${o.name} raises potassium and was given a short while ago.\n\nPlease stop it, and order a 12-lead ECG or a repeat metabolic panel. The covering resident is bringing the hyperkalemia protocol.` };
      },
      settle(p) { pushLab(p, 'Potassium (repeat)', { K: 5.3 }); return 'The potassium source is stopped and the resident has treated the potassium per protocol. The repeat is 5.3 and the T waves are back to normal. Keep rechecking it.'; },
    },
    {
      id: 'opioid', title: 'Too much opioid',
      hazard: 'Another opioid was already active: together they slow breathing', where: 'Active medications on the Summary, and what was given on the MAR', response: 'Stop the extra opioid and give oxygen while the nurse reverses it',
      other: (p, o) => p.orders.find((x) => x !== o && x.id !== o.id && x.status === 'Active' && tagsOf(x).includes('opioid')),
      hit(p, o) { return tagsOf(o).includes('opioid') && !!this.other(p, o); },
      why(p, o) { return `${p.name} already has ${(this.other(p, o) || {}).name} active. Opioids add together and slow breathing.`; },
      need: [['o2']], needText: 'oxygen',
      onset(p, o) {
        const x = this.other(p, o);
        pushVitals(p, { hr: 58, rr: 8, sbp: 98, dbp: 56, spo2: 86, pain: 0 });
        return { subject: 'hard to wake, breathing 8 a minute', body: `${mrms(p)} is very drowsy and hard to wake. RR 8, SpO2 86%, pupils small. ${he(p)} had ${o.name}${x ? ' on top of ' + x.name : ''}.\n\nThe rapid response nurse is giving the opioid reversal drug per protocol.\n\nPlease stop the extra opioid and order oxygen.` };
      },
      settle(p) { pushVitals(p, { hr: 74, rr: 14, sbp: 118, dbp: 70, spo2: 95, o2: '2 L NC', pain: 3 }); return 'Awake and talking again. RR 14, SpO2 95% on 2 L. The reversal drug wears off before the opioid does, so we will keep checking breathing every 15 minutes.'; },
    },
    {
      id: 'insulin', title: 'Low blood glucose',
      hazard: 'A glucose under 100: insulin lowers it further', where: 'Results: the latest glucose', response: 'Stop the insulin and recheck the glucose while the nurse treats the low',
      hit: (p, o) => tagsOf(o).includes('insulin') && labOf(p, 'Glu', 999) < 100,
      why: (p, o) => `The latest glucose for ${p.name} is ${Math.round(labOf(p, 'Glu', 0))} mg/dL. ${o.name} will lower it further.`,
      need: [['poc_glu']], needText: 'point-of-care glucose checks',
      onset(p, o) {
        const was = Math.round(labOf(p, 'Glu', 95));
        pushLab(p, 'POC glucose', { Glu: 46 });
        pushVitals(p, { hr: 112 });
        return { subject: 'sweaty and confused, glucose 46', body: `${mrms(p)} is sweaty, shaky and confused. Point-of-care glucose is 46. ${he(p)} was given ${o.name}; the glucose before it was ${was}.\n\nI am treating the low glucose per the hypoglycemia protocol.\n\nPlease stop the insulin and order point-of-care glucose checks.` };
      },
      settle(p) { pushLab(p, 'POC glucose', { Glu: 118 }); pushVitals(p, { hr: 84 }); return 'Glucose is back to 118 and the confusion has cleared. We will recheck it every 15 minutes until it holds.'; },
    },
    {
      id: 'nephro', title: 'Kidney injury made worse',
      hazard: 'A creatinine of 2.0 or more: this drug is hard on the kidneys', where: 'Results: the latest creatinine, and the kidney advisory', response: 'Stop the drug and recheck kidney function, or ask nephrology to see the patient',
      hit: (p, o) => tagsOf(o).includes('nephrotoxic') && labOf(p, 'Cr', 0) >= 2.0,
      why: (p, o) => `The latest creatinine for ${p.name} is ${labOf(p, 'Cr', 0).toFixed(1)} mg/dL. ${o.name} can injure the kidneys further.`,
      need: [['bmp', 'cmp', 'c_neph']], needText: 'a repeat metabolic panel or a nephrology consult',
      onset(p, o) {
        const was = labOf(p, 'Cr', 2), cr = +(was + 0.9).toFixed(1);
        pushLab(p, 'Creatinine, BUN (STAT)', { Cr: cr, BUN: Math.round(labOf(p, 'BUN', 40) + 14) });
        return { subject: `very little urine, creatinine ${cr.toFixed(1)}`, body: `${mrms(p)} has passed very little urine since ${o.name}. A repeat creatinine is ${cr.toFixed(1)}, up from ${was.toFixed(1)}.\n\n${o.name} is hard on kidneys that are already struggling.\n\nPlease ${o.status === 'Active' ? 'stop it, and ' : ''}order a repeat metabolic panel or ask nephrology to see ${him(p)}.` };
      },
      settle() { return 'Noted. Everything hard on the kidneys is on hold and urine output is being measured hourly. The creatinine will need following every day.'; },
    },
  ];
  const ruleById = (id) => E.HARM_RULES.find((r) => r.id === id);
  /** The first harm rule this order would trigger on this patient, or null. */
  E.harmRule = (p, o) => E.HARM_RULES.find((r) => r.hit(p, o)) || null;

  /* =====================================================================================================
     2. THE SAFETY RECORD (per learner)
     ===================================================================================================== */
  const safety = (pr) => pr.safety || (pr.safety = { events: [], strikes: 0, debriefDue: null, debriefs: [], suspended: null, suspensions: [] });
  E.safety = () => safety(E.progress());
  E.suspended = () => !!(E.db && E.db.user && (E.progress().safety || {}).suspended);
  const counts = (s, from) => { const ev = s.events.filter((e) => !from || e.ts >= from); return { harm: ev.filter((e) => e.kind === 'harm').length, near: ev.filter((e) => e.kind !== 'harm').length }; };
  const record = (kind, p, o, title, extra) => {
    const a = myShift(), ev = Object.assign({ id: E.uid('se'), kind, ts: Date.now(), pid: p.id, patient: p.name, order: o ? o.name : '', title, shift: a ? a.id : null, hosp: a ? hhmm(hosp(a)) : null }, extra || {});
    E.safety().events.push(ev);
    return ev;
  };
  /** A harmful order was stopped before it reached the patient. Called by the simulated attending (js/sim.js). */
  E.nearMiss = (p, o, why, who) => {
    if (!E.db.user || !same(o.by, E.db.user.name)) return;
    record('nearmiss', p, o, why, { by: who, outcome: 'stopped' });
    E.audit(`Near miss recorded: ${o.name} stopped by ${who} (${why})`, p.id);
    say(`${who.split(',')[0]} stopped ${o.name} before it reached the patient. It goes on your safety record as a near miss, not as harm.`, `Near miss — ${p.name}`, 'warn');
    pose('unsure');
  };
  /** Orders cannot be entered on a patient who has been moved to intensive care. Returns the reason, or ''. */
  E.orderLock = (p) => (p && p.icu ? `${p.name} was transferred to intensive care at ${E.fmtTime(p.icu.ts)}. The ICU team writes the orders now. This chart takes no new orders until the sim data is reset.` : '');
  /** After a second harm event the attending wants a debrief before more orders are signed. Opens it; true if one is owed.
      The attending's own words are "look after the patient first", so orders for a patient who is in crisis right
      now (or the patient of a running case, whose course the case decides) go through; everything else waits. */
  E.safetyGate = (p) => {
    const s = E.safety();
    if (!s.debriefDue || (p && gateOpenFor(p))) return false;
    openDebrief();
    return true;
  };
  const gateOpenFor = (p) => {
    const me = E.db.user.name, act = E.progress().active;
    if (crises().some((c) => c.pid === p.id && c.state === 'open' && same(c.who, me))) return true;
    return !!(act && act.type === 'case' && E.CASES && (E.CASES.find((x) => x.id === act.id) || {}).pid === p.id);
  };

  /* ---------- escalation ---------- */
  function escalate(ev, p) {
    const s = E.safety(), max = CFG().strikes, att = p.attending;
    s.strikes++;
    if (s.strikes >= max) {
      s.suspended = { ts: Date.now(), eventId: ev.id };
      s.suspensions.push({ at: Date.now(), after: ev.title + ' — ' + ev.patient, unlockedAt: null, attempts: 0 });
      E.audit(`Ordering privileges suspended after ${s.strikes} harm events`);
      E.message({ type: 'Safety', from: att, patientId: p.id, act: 'orders', critical: true, subject: 'Privileges suspended', body: `That is ${s.strikes} patients harmed by your orders. Your ordering privileges are suspended and you have been reassigned to the gift shop until you pass a remediation round.\n\nThe suspension stays on your safety record.` });
      E.ui.lock = null; E.ui.modal = null;
      pose('sad', 6000);
    } else if (s.strikes === max - 1) {
      s.debriefDue = ev.id;
      // orders for this patient still go through while they are in crisis (E.safetyGate), so the advice can be followed
      E.message({ type: 'Safety', from: att, patientId: p.id, act: 'orders', critical: true, subject: `Debrief needed before you sign more orders — ${p.name}`, body: `This is the second time ${ev.source === 'case' ? 'a decision of yours' : 'one of your orders'} has harmed a patient. Look after ${mrms(p)} first${ev.source === 'case' ? '' : ': stop the order and treat what it caused'}. Orders for ${him(p)} still go through while ${he(p).toLowerCase()} needs you.\n\nThen, before you sign anything else, I need three questions answered about what went wrong. The debrief opens when you next try to sign orders for another patient, or from the notice in the chart.\n\nOne more harm event and your privileges are suspended.` });
    } else {
      E.message({ type: 'Safety', from: att, patientId: p.id, act: 'orders', critical: true, subject: `About ${p.name}`, body: ev.source === 'case'
        ? `I have been told that ${mrms(p)} was harmed: ${ev.title.toLowerCase()}.\n\nThis is on your safety record as one harm event. A second one means a debrief with me before you sign more orders. A third suspends your privileges.`
        : `I have been told that ${ev.order} harmed ${mrms(p)}: ${ev.title.toLowerCase()}.\n\nDeal with it now: the nurse's page says what ${he(p).toLowerCase()} needs. This is on your safety record as one harm event. A second one means a debrief with me before you sign more orders. A third suspends your privileges.` });
    }
  }

  /** A harm-graded step in a PBL case (js/cases.js calls this). It goes on the safety record and counts toward the
      page, debrief and suspension exactly like harm from a harm rule, but no rescue timer starts: the case tree
      already decides what happens to the patient next. Returns the event. */
  E.caseHarm = ({ pid, title, detail } = {}) => {
    if (!E.db || !E.db.user) return null;
    const p = E.pt(pid) || { id: pid, name: 'A case patient', sex: 'F', attending: 'Your attending' }, act = E.progress().active;
    const ev = record('harm', p, null, title || 'Harm in a case', { source: 'case', detail: detail || '', outcome: 'case', caseId: act && act.type === 'case' ? act.id : null });
    E.audit(`Harm event recorded in a case: ${ev.title}`, p.id);
    pose('gasp', 5000);
    escalate(ev, p);
    return ev;
  };

  /* ---------- the debrief after a second harm event: three questions about what went wrong ---------- */
  function openDebrief() {
    const s = E.safety(), ev = s.events.find((e) => e.id === s.debriefDue) || s.events.filter((e) => e.kind === 'harm').pop();
    if (!ev) return;
    let qs;
    if (ev.source === 'case') {
      // a case has no harm rule to ask about, so the questions are the general ones from the remediation bank
      qs = shuffle(E.REMEDIATION.filter((q) => !q.rule)).slice(0, 3).map((q) => { const options = shuffle(q.options); return { q: q.q, options, answer: options.indexOf(q.options[q.answer]), why: q.why, src: options.map(() => '') }; });
    } else {
      const r = ruleById(ev.rule) || E.HARM_RULES[0], others = shuffle(E.HARM_RULES.filter((x) => x !== r)).slice(0, 3);
      // each wrong option belongs to another harm rule; saying which one is the reason it is wrong here
      const mk = (q, key, why) => { const from = shuffle([r].concat(others)), options = from.map((x) => x[key]); return { q, options, answer: from.indexOf(r), why, src: from.map((x) => (x === r ? '' : x.title)) }; };
      qs = [
        mk(`What made ${ev.order} unsafe for ${ev.patient}?`, 'hazard', 'The hazard was in the chart before the order was signed.'),
        mk('Where could you have seen that before you signed?', 'where', 'Looking there first takes a few seconds.'),
        mk('Once the patient got worse, what came first?', 'response', 'Stop what is causing the harm, then treat what it caused.'),
      ];
    }
    E.ui.modal = { type: 'safetyDebrief', evId: ev.id, wrong: 0, picked: {}, missed: {}, qs };
    if (E.app) E.app.render();
  }

  /* ---------- remediation: the round that lifts a suspension ---------- */
  E.REMEDIATION = [
    { rule: 'bleed', q: 'A patient with a bleeding ulcer asks for ibuprofen for knee pain. What do you order?', options: ['Acetaminophen, and no NSAID', 'Ibuprofen at a lower dose', 'Ibuprofen, to be taken with food', 'Ketorolac, because it is given by vein'], answer: 0, why: 'NSAIDs cause ulcers and make them bleed, at any dose and by any route. Acetaminophen does not.' },
    { rule: 'bleed', q: 'A patient with an active GI bleed is due clot prevention. Which is appropriate while the bleeding is active?', options: ['Sequential compression devices', 'Enoxaparin under the skin', 'Heparin under the skin', 'Apixaban by mouth'], answer: 0, why: 'Anticoagulants are held during active bleeding. Compression devices prevent clots without making bleeding worse.' },
    { rule: 'hyperk', q: 'The latest potassium is 5.4. Potassium chloride is in your unsigned orders. What do you do?', options: ['Remove the order and recheck the potassium', 'Sign it, because it was already written', 'Halve the dose and sign it', 'Override the advisory and watch closely'], answer: 0, why: 'Potassium given on top of a high potassium can stop the heart. Replacement is for low values.' },
    { rule: 'allergy', q: 'An allergy advisory fires for a patient with penicillin anaphylaxis. What is the safe response?', options: ['Remove the order and choose a drug from another class with your supervisor', 'Override it, because advisories fire too often', 'Take the allergy off the list so the order goes through', 'Give half the dose and watch'], answer: 0, why: 'A high-severity allergy match is exactly what the advisory is for. Editing the allergy list to silence it removes the protection for everyone who comes after you.' },
    { rule: 'opioid', q: 'A patient with oxycodone ordered is still in pain. What do you check before adding another opioid?', options: ['What they have actually received on the MAR, and their breathing and alertness', 'Nothing: a different opioid does not add to the first', 'Only the blood pressure', 'The potassium'], answer: 0, why: 'Opioids add together. Two at once can slow breathing until it stops.' },
    { rule: 'insulin', q: 'Before ordering new insulin for a patient, what must you look at first?', options: ['The most recent glucose, and whether they are eating', 'The white cell count', 'Yesterday’s weight', 'Nothing, if the dose is small'], answer: 0, why: 'Insulin given on top of a low or falling glucose causes hypoglycemia.' },
    { rule: 'nephro', q: 'A creatinine has risen from 1.6 to 2.1. Which order needs a second thought?', options: ['Ketorolac for pain', 'Acetaminophen for pain', 'A daily weight', 'A repeat metabolic panel'], answer: 0, why: 'NSAIDs such as ketorolac reduce blood flow to the kidney and worsen a kidney injury.' },
    { q: 'When is it acceptable to override a high-risk advisory?', options: ['When there is a real clinical reason and your supervisor agrees', 'When you are busy', 'When the nurse is waiting for the order', 'Whenever the drug is commonly used'], answer: 0, why: 'An override is a decision you can defend out loud, with someone senior who agrees. It is never a way to save time.' },
    { q: 'A nurse pages you: the patient got worse minutes after a drug you ordered. What comes first?', options: ['Go to the patient, stop the drug and call for help', 'Finish the note you were writing', 'Wait to see whether it passes', 'Take the order out of the record'], answer: 0, why: 'Stop what is causing the harm and get help. The record is corrected honestly afterwards, never erased.' },
    { q: 'Your attending stops one of your orders before it reaches the patient. What is that, and what do you do with it?', options: ['A near miss: report it and find out what you missed', 'Nothing happened, so there is nothing to do', 'An adverse event, because the patient was harmed', 'A system problem, so not your concern'], answer: 0, why: 'A near miss is free information. The same gap will reach a patient one day if nobody looks at it.' },
    { q: 'Two patients on the unit have nearly the same name. How do you make sure you are in the right chart?', options: ['Check two identifiers, such as full name and date of birth', 'Check the room number', 'Ask "Are you Ms. Santos?" and wait for a nod', 'Use whichever chart is already open'], answer: 0, why: 'Rooms change and people nod. Two identifiers, read from the wristband or the chart, are what stop a wrong-patient error.' },
    { q: 'You realise an order you signed has harmed a patient. What do you do about the record?', options: ['Document what happened honestly and tell your supervisor', 'Discontinue the order and say nothing', 'Ask a classmate to tidy it up', 'Edit the chart so the order looks reasonable'], answer: 0, why: 'Honest documentation and disclosure are how the patient gets the right care next, and how the same error is prevented.' },
  ];
  function buildRemediation() {
    const s = E.safety(), mine = new Set(s.events.filter((e) => e.kind === 'harm').map((e) => e.rule)), n = CFG().remediationQuestions;
    const first = shuffle(E.REMEDIATION.filter((q) => q.rule && mine.has(q.rule))), rest = shuffle(E.REMEDIATION.filter((q) => !first.includes(q)));
    return shuffle(first.concat(rest).slice(0, n)).map((q) => { const options = shuffle(q.options); return { q: q.q, options, answer: options.indexOf(q.options[q.answer]), why: q.why }; });
  }

  /* =====================================================================================================
     3. CRISES: a patient who is getting worse, from a harmful order or from a scripted deterioration
     ===================================================================================================== */
  /** Look for the learner's orders that have just taken effect and check them against the harm rules. */
  function scan() {
    const u = E.db.user; let ch = false;
    E.db.patients.forEach((p) => p.orders.forEach((o) => {
      if (o.harmChk || !o.signedTs || o.signedTs < E.db.createdAt || !same(o.by, u.name) || !['Active', 'In process', 'Completed'].includes(o.status)) return;
      o.harmChk = true; ch = true;
      if (p.icu) return;
      const r = E.harmRule(p, o);
      if (r) crises().push({ id: E.uid('cr'), kind: 'harm', pid: p.id, orderId: o.id, rule: r.id, state: 'pending', wait: CFG().harmDelay * 1000, who: u.name, at: Date.now() });
    }));
    return ch;
  }
  const treated = (c, p, need) => need.every((g) => p.orders.some((x) => same(x.by, c.who) && x.ts >= c.onsetTs && g.includes(x.catId) && !['Declined', 'Discontinued', 'Draft'].includes(x.status)));
  function toIcu(c, p, why) {
    c.state = 'icu'; c.endTs = Date.now();
    crises().forEach((x) => { if (x !== c && x.pid === p.id && (x.state === 'open' || x.state === 'pending')) { x.state = 'icu'; x.endTs = Date.now(); const e2 = E.safety().events.find((e) => e.id === x.eventId); if (e2) e2.outcome = 'icu'; } });
    if (!p.icu) p.icu = { ts: Date.now(), why };
    pushVitals(p, {}, 'Rapid response team');
    E.db.audit.unshift({ ts: Date.now(), user: 'Rapid response team', role: 'sim', patientId: p.id, action: `Transferred to intensive care (${why})` });
    E.message({ type: 'Page', from: 'Rapid response team', patientId: p.id, act: 'summary', critical: true, subject: `${p.name} — transferred to intensive care`, body: `Nobody answered the page about ${mrms(p)} (${why.toLowerCase()}), so the nurse called a rapid response. ${he(p)} has been moved to intensive care.\n\nThe ICU team has taken over. The chart takes no new orders from you until the sim data is reset.` });
    say(`${p.name} has been transferred to intensive care.`, 'Rapid response', 'alert');
    pose('sad', 6000);
  }
  function crisisStep() {
    if (!E.db.user) return false;
    let ch = scan();
    const me = E.db.user.name;
    crises().forEach((c) => {
      if (!same(c.who, me) || !['pending', 'open'].includes(c.state)) return;
      const p = E.pt(c.pid), o = c.orderId && p.orders.find((x) => x.id === c.orderId), r = c.kind === 'harm' ? ruleById(c.rule) : null;
      if (c.state === 'pending') {
        if (c.wait > 0) return;
        ch = true;
        if (!o || ['Discontinued', 'Declined'].includes(o.status)) {   // stopped in time: it never reached the patient
          c.state = 'averted';
          record('nearmiss', p, o, r.title, { by: me, outcome: 'stopped', rule: r.id });
          E.audit(`Near miss recorded: ${o ? o.name : 'order'} stopped before it reached the patient`, p.id);
          say(`You stopped ${o ? o.name : 'the order'} before it reached the patient. That is a near miss, not harm.`, `Near miss — ${p.name}`, 'warn');
          pose('unsure');
          return;
        }
        const page = r.onset(p, o);
        c.state = 'open'; c.onsetTs = Date.now(); c.left = CFG().rescueHours * hourMs(); o.harm = c.id;
        const ev = record('harm', p, o, r.title, { rule: r.id, outcome: 'open' });
        c.eventId = ev.id;
        E.db.audit.unshift({ ts: Date.now(), user: p.rn, role: 'sim', patientId: p.id, action: `Paged the team: ${page.subject} after ${o.name}` });
        E.message({ type: 'Page', from: p.rn, patientId: p.id, act: 'orders', critical: true, subject: `${p.name} — ${page.subject}`, body: page.body + `\n\n${p.rn.split(',')[1].trim().split(' ')[0]}` });
        say(`${p.name} — ${page.subject}`, 'Page from nursing', 'alert');
        pose('gasp', 6000);
        escalate(ev, p);
        return;
      }
      // open: has the learner put it right?
      const sd = c.kind === 'det' ? eventDef(c) : null, need = r ? r.need : sd.crisis.need;
      const stopped = !r || !o || o.status !== 'Active';
      if (stopped && treated(c, p, need)) {
        ch = true; c.state = 'rescued'; c.endTs = Date.now();
        const body = r ? r.settle(p) : (pushVitals(p, sd.crisis.settle), sd.crisis.settleText);
        const ev = E.safety().events.find((e) => e.id === c.eventId); if (ev) { ev.outcome = 'rescued'; ev.resolvedTs = Date.now(); }
        E.message({ type: 'Page', from: p.rn, patientId: p.id, act: 'flowsheets', subject: `${p.name} — settling`, body });
        E.db.audit.unshift({ ts: Date.now(), user: p.rn, role: 'sim', patientId: p.id, action: 'Patient stabilised after the team responded' });
        say(`${p.name} is settling. Your response was in time.`, 'Stabilised', 'check');
        pose('phew', 5000);
      } else if (c.left <= 0) {
        ch = true;
        const ev = E.safety().events.find((e) => e.id === c.eventId); if (ev) { ev.outcome = 'icu'; ev.resolvedTs = Date.now(); }
        toIcu(c, p, r ? r.title : sd.crisis.title);
      }
    });
    return ch;
  }
  const eventDef = (c) => { const sh = E.SHIFTS.find((s) => s.id === c.shift); return sh && sh.events.find((e) => e.id === c.evId); };

  /* =====================================================================================================
     4. THE SHIFTS
     at: hospital time as a decimal hour (10.5 = 10:30). An event posts labs and vitals, sends a message, and
     may open a crisis (the one deterioration of the shift). expect: what a good day looks like; each test
     reads the learner's own audit lines, orders and notes for that patient from the moment the event fired
     (or from the start of the shift when `ev` is not given).
     ===================================================================================================== */
  const X = {
    ordered: (...ids) => (c) => c.orders.some((o) => ids.includes(o.catId)),
    viewed: (label) => (c) => c.seen || c.audit.some((a) => a.action === 'Viewed ' + label),
    read: (re) => (c) => c.all.some((a) => a.action.startsWith('Read message') && re.test(a.action)),
    rescued: (evId) => (c) => c.crises.some((x) => x.evId === evId && x.state === 'rescued'),
    /** Never tried to order anything with these tags for this patient during the shift (declined attempts count as trying). */
    avoided: (...tags) => (c) => !c.tried.some((o) => tagsOf(o).some((t) => tags.includes(t))),
    /** Of two pages that arrived together, the learner acted on this patient's (opened the chart, ordered, wrote)
        before acting on the other one, the `other` event. Reading both messages first is triage, not a choice, so
        reading does not count as acting. Never acting on this one fails; never acting on the other is fine. */
    first: (other) => (c) => {
      const acted = (pid, from) => { const t = c.all.filter((x) => x.patientId === pid && x.ts >= from && !/^Read message|^Marked message/.test(x.action)).map((x) => x.ts); return t.length ? Math.min(...t) : Infinity; };
      const mine = c.seen ? c.from : acted(c.pid, c.from), od = c.def(other), oFrom = od && c.fired[other];
      const theirs = oFrom ? (c.seenOf(other) ? oFrom : acted(od.pid, oFrom)) : Infinity;
      return mine < Infinity && mine <= theirs;
    },
  };
  const lv = (k) => (p) => { const l = E.latestLab(p, k), d = E.LABS[k]; return `${E.labVal(k, l.value)}${d.unit ? ' ' + d.unit : ''}`; };
  const older = (k) => (p) => { const d = E.LABS[k], vals = p.labs.filter((l) => k in l.values).sort((a, b) => b.ts - a.ts).slice(1).map((l) => l.values[k]); return vals.concat([vals[0] * 1.2, vals[0] * 0.8, vals[0] * 1.35]).map((v) => `${E.labVal(k, v)}${d.unit ? ' ' + d.unit : ''}`); };
  const MORNING_K = { pid: 'p1', lab: ['BMP (morning)', { Na: 136, K: 5.2, Cl: 96, CO2: 27, BUN: 50, Cr: 2.2, Glu: 148, Ca: 8.9 }] };
  const BCX = { type: 'result', pid: 'p2', from: 'Microbiology', subject: 'Preliminary: Blood culture ×2 — Santos, Maria', body: 'PRELIMINARY (Gram stain of positive bottle):\nBottle 1 of 2: gram-positive cocci in pairs.\nBottle 2 of 2: no growth to date.\n\nIdentification and susceptibilities to follow. Laboratory called the result to the unit.' };
  const GAP = { type: 'page', pid: 'p4', from: RN2, subject: 'Kahale, Leilani — gap closed, asking to eat', body: 'Ms. Kahale’s anion gap has been closed on two checks and she is hungry. She is still on the insulin drip. What is the plan for coming off it?\n\nHana' };
  const GAP_X = { ev: 'gap', pid: 'p4', text: 'Ordered long-acting insulin to overlap with Ms. Kahale’s drip', why: 'The drip stops only after long-acting insulin under the skin has had time to work. Stopping it first lets the ketoacidosis come back.', test: X.ordered('glargine') };

  E.SHIFTS = [
    {
      id: 'day1', n: 1, title: 'First day on 5 West', level: 'Gentle', glyph: 'patients', sickest: 'p6',
      brief: 'A steady day to learn the rhythm: read up, answer on rounds, deal with what comes, hand off. One patient will need you more than the others.',
      sickWhy: 'Ms. Kowalski retains carbon dioxide and became drowsy when her oxygen was turned up. She is the one the night team needs to watch.',
      debrief: 'Most of a shift is noticing. The potassium was in a message, the oxygen target was in an order comment, and the drowsy patient was in the flowsheet before anyone paged.',
      overnight: [
        MORNING_K,
        { msg: { type: 'Staff Message', from: RN2, patientId: 'p6', act: 'flowsheets', subject: 'Kowalski, Diane — overnight', body: 'Night report: wheezy at 04:00, an extra nebulizer helped. SpO2 90 to 91% on 3 L, which is inside her target of 88 to 92%. Please leave the oxygen where it is unless she drops below 88%.\n\nHana' } },
      ],
      preRead: [/Kowalski, Diane — overnight/, /Santos, Maria — potassium/],
      rounds: [
        { pid: 'p1', q: 'What is his potassium on this morning’s labs?', answer: lv('K'), pool: older('K'), where: 'Results: the newest column is on the left.' },
        { pid: 'p2', q: 'Which antibiotic class must she never be given, and what happened?', answer: 'Penicillins: anaphylaxis', pool: ['Fluoroquinolones: tendon pain', 'Sulfonamides: a diffuse rash', 'Cephalosporins: hives'], where: 'Allergies in the chart sidebar, and the H&P.' },
        { pid: 'p3', q: 'What was his hemoglobin before surgery, and what is the latest?', answer: '13.4 before, 9.1 now', pool: ['13.4 before, 10.6 now', '14.8 before, 9.1 now', '12.9 before, 12.1 now'], where: 'Results: read the hemoglobin row from right (oldest) to left (newest).' },
        { pid: 'p4', q: 'What is her most recent anion gap?', answer: lv('AG'), pool: older('AG'), where: 'Results, Chemistry group: anion gap.' },
        { pid: 'p5', q: 'What is his code status?', answer: 'DNR/DNI', pool: ['Full Code', 'DNR only, intubation allowed', 'Comfort care only'], where: 'Code Status at the top of the chart sidebar, and the matching order.' },
        { pid: 'p6', q: 'What oxygen saturation are we aiming for?', answer: '88 to 92%', pool: ['92% or higher', '95 to 100%', 'Whatever keeps her comfortable'], where: 'The comment on her oxygen order, and the H&P plan.' },
      ],
      events: [
        { id: 'pain', at: 10.5, type: 'page', pid: 'p5', from: RN1, subject: 'Chen, Robert — sore knees, asking for naproxen', body: 'Mr. Chen’s knees are sore. His daughter asks if he can have the naproxen he takes at home. He has nothing ordered for pain.\n\nTomas' },
        Object.assign({ id: 'bcx', at: 12 }, BCX),
        { id: 'glu', at: 13.5, type: 'problem', pid: 'p6', from: RN2, subject: 'Kowalski, Diane — glucose 268 before lunch', labs: ['POC glucose', { Glu: 268 }], body: 'Ms. Kowalski’s point-of-care glucose is 268 before lunch. She is on prednisone and has no insulin or glucose checks ordered. Would you like both?\n\nHana' },
        { id: 'co2', at: 15, type: 'det', pid: 'p6', from: RN2, subject: 'Kowalski, Diane — hard to wake', vitals: { hr: 88, rr: 10, sbp: 132, dbp: 78, spo2: 99, o2: '6 L NC' },
          body: 'Ms. Kowalski is hard to wake. A float nurse turned her oxygen up to 6 L when she looked short of breath. She is now 99% and breathing 10 a minute. I have turned the oxygen back down to 2 L.\n\nCan you come and see her? Do you want a blood gas?\n\nHana',
          crisis: { title: 'Drowsy from carbon dioxide retention', need: [['vbg']], needText: 'a venous blood gas', settle: { hr: 90, rr: 16, sbp: 136, dbp: 80, spo2: 90, o2: '2 L NC' }, settleText: 'More awake with the oxygen back at 2 L. SpO2 90%, breathing 16 a minute. The gas is on its way to the lab. I have put a sign on her oxygen: target 88 to 92%.' } },
      ],
      expect: [
        { pid: 'p2', text: 'Replaced Ms. Santos’s potassium', why: 'Her nurse asked about a potassium of 3.3 in a message waiting before rounds. Low potassium is replaced, then rechecked.', test: X.ordered('kcl_po') },
        { pid: 'p2', text: 'Ordered a metabolic panel to recheck it', why: 'A replacement nobody rechecks is half a plan.', test: X.ordered('bmp', 'cmp') },
        { ev: 'pain', pid: 'p5', text: 'Gave Mr. Chen acetaminophen for his knees', why: 'Acetaminophen treats the pain without touching the ulcer.', test: X.ordered('acetaminophen') },
        { ev: 'pain', pid: 'p5', text: 'Kept NSAIDs away from a bleeding ulcer', why: 'Naproxen caused his ulcer. Any NSAID can make it bleed again.', test: X.avoided('nsaid'), safety: true },
        { ev: 'bcx', pid: 'p2', text: 'Read the blood culture result', why: 'A positive blood culture is read the hour it arrives, even when the plan does not change.', test: X.read(/Blood culture/) },
        { ev: 'glu', pid: 'p6', text: 'Started glucose checks for Ms. Kowalski', why: 'Prednisone raises blood glucose. A single reading of 268 needs following.', test: X.ordered('poc_glu') },
        { ev: 'glu', pid: 'p6', text: 'Ordered sliding-scale insulin for a glucose of 268', why: 'Checks without a way to treat the number only document the problem.', test: X.ordered('lispro_ss') },
        { ev: 'co2', pid: 'p6', text: 'Got a blood gas when Ms. Kowalski became drowsy', why: 'Drowsiness after extra oxygen in COPD is carbon dioxide retention until a gas says otherwise.', test: X.rescued('co2') },
        { ev: 'co2', pid: 'p6', text: 'Looked at her vital signs in Flowsheets', why: 'The flowsheet showed the oxygen at 6 L and the breathing at 10 before anyone explained it.', test: X.viewed('Flowsheets') },
      ],
      handoffWords: [['88', 'co2', 'carbon dioxide', 'oxygen']],
    },
    {
      id: 'short', n: 2, title: 'Short-staffed', level: 'Steady', glyph: 'vitals', sickest: 'p2',
      brief: 'A critical result is waiting when you arrive, and the pages come closer together. Decide what cannot wait.',
      sickWhy: 'Ms. Santos became septic again in the afternoon: fever, a fast heart rate and a low blood pressure. She needs the closest watch overnight.',
      debrief: 'A critical value at 07:00 is the first job of the day, not something to bring up on rounds. In sepsis the first hour is a lactate, cultures and fluids, and the allergy list still applies when you are in a hurry.',
      overnight: [
        { pid: 'p3', lab: ['CBC, PT/INR (morning)', { WBC: 10.4, Hgb: 6.8, Hct: 20.6, Plt: 170, INR: 2.1 }], vitals: { hr: 96, sbp: 108, dbp: 62 } },
        { msg: { type: 'Result', from: 'Laboratory', patientId: 'p3', act: 'results', critical: true, subject: 'CRITICAL: Hemoglobin 6.8 g/dL — Whitfield, James', body: 'Critical value called to and read back by the bedside nurse.\n\nHemoglobin 6.8 g/dL (reference 12.0-17.5). Previous value 9.1.' } },
        { msg: { type: 'Staff Message', from: RN1, patientId: 'p3', act: 'flowsheets', subject: 'Whitfield, James — pale and tired this morning', body: 'Mr. Whitfield is pale and says he feels washed out. HR 96, BP 108/62. The hip dressing is dry, but the thigh is more swollen than yesterday. The lab called a hemoglobin of 6.8.\n\nTomas' } },
        { pid: 'p1', lab: ['BMP (morning)', { Na: 136, K: 5.4, Cl: 96, CO2: 27, BUN: 50, Cr: 2.2, Glu: 148, Ca: 8.9 }] },
        { pid: 'p4', lab: ['BMP, BHB (morning)', { Na: 138, K: 3.9, Cl: 106, CO2: 22, AG: 10, BUN: 14, Cr: 0.8, Glu: 164, Ca: 8.9, BHB: 0.4 }] },
      ],
      preRead: [/Hemoglobin 6\.8/, /Whitfield, James — pale/],
      rounds: [
        { pid: 'p1', q: 'Which way has his creatinine gone since admission?', answer: 'Up: 1.9, then 2.0, 2.1 and 2.2', pool: ['Down: 2.2, then 2.1, 2.0 and 1.9', 'Steady at 1.9', 'Up and back down: 1.9, 2.4, 1.6'], where: 'Results: select the creatinine row to see the trend.' },
        { pid: 'p2', q: 'What did her sputum Gram stain show?', answer: 'Gram-positive diplococci', pool: ['Gram-negative rods', 'No organisms seen', 'Gram-positive cocci in clusters'], where: 'Results: the reports list under the lab table.' },
        { pid: 'p3', q: 'What is his hemoglobin this morning, and what was it before surgery?', answer: '6.8 now, 13.4 before', pool: ['9.1 now, 13.4 before', '6.8 now, 10.6 before', '8.3 now, 12.9 before'], where: 'Results, and the critical result in your Inbox.' },
        { pid: 'p4', q: 'By the admission plan, when can she move from the insulin drip to insulin under the skin?', answer: 'When the anion gap has closed and she is eating', pool: ['As soon as her glucose is under 250', 'After 24 hours on the drip', 'When her urine ketones are negative'], where: 'The H&P, assessment and plan, item 1.' },
        { pid: 'p5', q: 'What did his endoscopy find?', answer: 'A duodenal ulcer with a visible vessel, treated with clips', pool: ['Esophageal varices, treated with bands', 'A stomach tumour, biopsied', 'Nothing abnormal'], where: 'Results: the EGD report.' },
        { pid: 'p6', q: 'Which virus was found on her respiratory panel?', answer: 'Rhinovirus/enterovirus', pool: ['Influenza A', 'RSV', 'SARS-CoV-2'], where: 'Results: the respiratory viral panel report.' },
      ],
      events: [
        Object.assign({ id: 'gap', at: 10 }, GAP),
        Object.assign({ id: 'bcx', at: 11.5 }, BCX),
        { id: 'cp', at: 13, type: 'problem', pid: 'p1', from: RN1, subject: 'Akana, Keoni — chest tightness for 20 minutes', vitals: { hr: 96, rr: 20, sbp: 150, dbp: 88, pain: 4 }, body: 'Mr. Akana has had tightness across his chest for 20 minutes. It started at rest. HR 96, BP 150/88, SpO2 95% on 2 L. He is not sweaty. This is new for him.\n\nTomas' },
        { id: 'asa', at: 14.5, type: 'page', pid: 'p5', from: RN1, subject: 'Chen, Robert — daughter asks about his aspirin', body: 'Mr. Chen’s daughter is worried that he has been off his aspirin since admission, because of his heart stent. She asks whether he can restart it today.\n\nTomas' },
        { id: 'sepsis', at: 15.5, type: 'det', pid: 'p2', from: RN2, subject: 'Santos, Maria — shaking chills, BP 86/50', vitals: { temp: 39.4, hr: 126, rr: 26, sbp: 86, dbp: 50, spo2: 91 },
          body: 'Ms. Santos has shaking chills and is more confused than this morning. T 39.4, HR 126, BP 86/50, RR 26, SpO2 91% on 2 L.\n\nShe looks septic again. Do you want a lactate, cultures and a fluid bolus?\n\nHana',
          crisis: { title: 'Sepsis getting worse', need: [['lactate'], ['ns_bolus']], needText: 'a lactate and an IV fluid bolus', settle: { temp: 38.6, hr: 104, rr: 20, sbp: 104, dbp: 62, spo2: 94 }, settleText: 'The bolus is in. HR 104, BP 104/62, and she knows where she is again. The lactate has gone to the lab.' } },
      ],
      expect: [
        { pid: 'p3', text: 'Ordered a transfusion for a hemoglobin of 6.8', why: 'A hemoglobin under 7 is transfused. He was 13.4 before surgery, and the critical result was waiting at 07:00.', test: X.ordered('prbc') },
        { pid: 'p3', text: 'Ordered a type and screen so the blood could be matched', why: 'Blood cannot be given until it is matched.', test: X.ordered('ts') },
        { pid: 'p3', text: 'Ordered a CBC to recheck after the blood', why: 'One unit is expected to raise the hemoglobin by about 1. The recheck shows whether he is still bleeding.', test: X.ordered('cbc') },
        GAP_X,
        { ev: 'bcx', pid: 'p2', text: 'Read the blood culture result', why: 'A positive blood culture is read the hour it arrives.', test: X.read(/Blood culture/) },
        { ev: 'cp', pid: 'p1', text: 'Ordered an ECG for new chest tightness', why: 'New chest pain gets an ECG within minutes.', test: X.ordered('ecg') },
        { ev: 'cp', pid: 'p1', text: 'Ordered a troponin', why: 'A normal ECG does not rule out heart injury. The troponin does the rest.', test: X.ordered('trop') },
        { ev: 'asa', pid: 'p5', text: 'Asked cardiology about the timing of Mr. Chen’s aspirin', why: 'The endoscopy report says to hold aspirin and discuss the timing with cardiology. That is a consult, not a guess.', test: X.ordered('c_cards') },
        { ev: 'asa', pid: 'p5', text: 'Did not restart aspirin on a fresh ulcer', why: 'Aspirin on a day-old clipped ulcer can make it bleed again.', test: X.avoided('nsaid'), safety: true },
        { ev: 'sepsis', pid: 'p2', text: 'Answered Ms. Santos’s sepsis with a lactate and a fluid bolus', why: 'Fever, a fast heart rate and a low blood pressure are sepsis until proven otherwise. A lactate and fluids come first.', test: X.rescued('sepsis') },
        { ev: 'sepsis', pid: 'p2', text: 'Sent blood cultures', why: 'Cultures before any change of antibiotic give the best chance of finding the organism.', test: X.ordered('bcx') },
        { ev: 'sepsis', pid: 'p2', text: 'Stayed away from penicillins', why: 'She had anaphylaxis to penicillin. Broadening her antibiotics in a hurry is exactly when that gets missed.', test: X.avoided('penicillin'), safety: true },
      ],
      handoffWords: [['sepsis', 'septic', 'lactate', 'pressure', 'fever']],
    },
    {
      id: 'storm', n: 3, title: 'Everything at once', level: 'Busy', glyph: 'code', sickest: 'p5',
      brief: 'Six patients, and two of them will page you in the same minute. You cannot be in two rooms. Go to the one who cannot wait.',
      sickWhy: 'Mr. Chen bled again in the afternoon, with a heart rate of 118 and a blood pressure of 88/50. He is DNR/DNI, which limits CPR and intubation and nothing else.',
      debrief: 'When two pages land together, the unstable patient goes first and the other is told when you will come. A falling hemoglobin in the morning was the warning for the afternoon.',
      overnight: [
        { pid: 'p5', lab: ['CBC (morning)', { WBC: 8.6, Hgb: 7.8, Hct: 23.8, Plt: 208 }], vitals: { hr: 92, sbp: 112, dbp: 64 } },
        { msg: { type: 'Staff Message', from: RN1, patientId: 'p5', act: 'results', subject: 'Chen, Robert — one dark stool at 03:00', body: 'Night report: one small dark stool at 03:00. HR 92, BP 112/64 afterwards. He says he feels the same. This morning’s hemoglobin is 7.8; it was 8.3.\n\nTomas' } },
        MORNING_K,
        { pid: 'p6', lab: ['VBG (morning)', { pH: 7.36, pCO2: 52, HCO3: 30 }] },
      ],
      preRead: [/Chen, Robert — one dark stool/, /Santos, Maria — potassium/],
      rounds: [
        { pid: 'p1', q: 'Why is he not on an ACE inhibitor?', answer: 'He had angioedema on lisinopril', pool: ['Lisinopril gave him a cough', 'His potassium is too low', 'He declined it'], where: 'Allergies in the chart sidebar, and the H&P plan.' },
        { pid: 'p2', q: 'How much oxygen is she on in the latest vital signs?', answer: (p) => E.lastVitals(p).o2, pool: ['Room air', '4 L NC', '6 L NC', 'Non-rebreather'], where: 'Last Vitals in the chart sidebar, or Flowsheets.' },
        { pid: 'p3', q: 'What INR are we aiming for on his warfarin?', answer: '2 to 3', pool: ['1.5 to 2', '2.5 to 3.5', 'Under 1.5'], where: 'The orthopedic progress note, assessment and plan.' },
        { pid: 'p4', q: 'What set off her ketoacidosis?', answer: 'A kinked insulin pump site', pool: ['A urinary infection', 'A new steroid', 'Missed clinic visits'], where: 'The H&P: history of present illness.' },
        { pid: 'p5', q: 'What is his hemoglobin this morning?', answer: lv('Hgb'), pool: older('Hgb'), where: 'Results: the newest column is on the left.' },
        { pid: 'p6', q: 'How much oxygen does she use at home?', answer: '2 L', pool: ['None', '4 L', 'Only at night'], where: 'The problem list and the H&P.' },
      ],
      events: [
        { id: 'sleep', at: 10, type: 'page', pid: 'p6', from: RN2, subject: 'Kowalski, Diane — cannot sleep, asks for "something strong"', body: 'Ms. Kowalski did not sleep and is anxious about tonight. She asks for "something strong, like the oxycodone my neighbour takes". She has nothing ordered for sleep.\n\nHana' },
        { id: 'k', at: 11, type: 'result', pid: 'p1', from: 'Laboratory', subject: 'Abnormal: Potassium 5.7 mmol/L — Akana, Keoni', labs: ['BMP', { Na: 135, K: 5.7, Cl: 97, CO2: 25, BUN: 52, Cr: 2.3, Glu: 150, Ca: 8.8 }], body: 'Abnormal values:\nPotassium 5.7 mmol/L (H)\nCreatinine 2.3 mg/dL (H)\nBUN 52 mg/dL (H)\n\nPotassium was 5.2 this morning.' },
        { id: 'af', at: 12.5, type: 'problem', pid: 'p3', from: RN1, subject: 'Whitfield, James — heart rate 138 and irregular', vitals: { hr: 138, rr: 20, sbp: 104, dbp: 60 }, body: 'Mr. Whitfield came back from physical therapy with palpitations. HR 138 and irregular, BP 104/60, SpO2 96%. He is awake, talking and has no chest pain.\n\nTomas' },
        { id: 'bleed', at: 14, type: 'det', pid: 'p5', from: RN1, subject: 'Chen, Robert — pale, dizzy, heart rate 118', vitals: { hr: 118, rr: 22, sbp: 88, dbp: 50, spo2: 95, pain: 3 },
          body: 'Mr. Chen just passed a large black stool and nearly fainted getting back to bed. He is pale and clammy. HR 118, BP 88/50.\n\nCan you come now? He will need a CBC, and fluids or blood.\n\nTomas',
          crisis: { title: 'Bleeding again', need: [['cbc'], ['ns_bolus', 'lr', 'prbc']], needText: 'a CBC, and IV fluids or blood', settle: { hr: 96, rr: 18, sbp: 106, dbp: 62, spo2: 97, pain: 1 }, settleText: 'Fluids are running and the CBC has gone. HR 96, BP 106/62 and his colour is better. GI has been called.' } },
        { id: 'visit', at: 14.1, type: 'page', pid: 'p2', from: RN2, subject: 'Santos, Maria — family asking about visiting hours', body: 'Ms. Santos’s sister would like to know whether the children can visit this evening while she is on droplet precautions, and what they would need to wear. No rush. She is comfortable.\n\nHana' },
        Object.assign({ id: 'gap', at: 16 }, GAP),
      ],
      expect: [
        { pid: 'p5', text: 'Ordered a CBC to follow Mr. Chen’s falling hemoglobin', why: 'The hemoglobin had drifted from 8.3 to 7.8 with a dark stool overnight. That needed following before the afternoon.', test: X.ordered('cbc') },
        { pid: 'p2', text: 'Replaced Ms. Santos’s potassium', why: 'Her nurse asked about a potassium of 3.3 in a message waiting before rounds.', test: X.ordered('kcl_po') },
        { ev: 'sleep', pid: 'p6', text: 'Ordered melatonin for sleep', why: 'Melatonin helps sleep without slowing breathing.', test: X.ordered('melatonin') },
        { ev: 'sleep', pid: 'p6', text: 'Kept opioids away from a patient who retains carbon dioxide', why: 'Opioids slow breathing. In someone who already retains carbon dioxide that can mean a ventilator.', test: X.avoided('opioid'), safety: true },
        { ev: 'k', pid: 'p1', text: 'Ordered an ECG for a potassium of 5.7', why: 'The ECG shows whether a high potassium is affecting the heart, which decides how fast it is treated.', test: X.ordered('ecg') },
        { ev: 'k', pid: 'p1', text: 'Ordered a repeat metabolic panel', why: 'A rising potassium is rechecked the same day.', test: X.ordered('bmp', 'cmp') },
        { ev: 'af', pid: 'p3', text: 'Ordered an ECG for a fast, irregular heart rate', why: 'An ECG confirms the rhythm before anything is done about it.', test: X.ordered('ecg') },
        { ev: 'af', pid: 'p3', text: 'Checked his electrolytes', why: 'Low potassium or magnesium makes a fast atrial fibrillation harder to control.', test: X.ordered('bmp', 'cmp', 'mg') },
        { ev: 'bleed', pid: 'p5', text: 'Answered Mr. Chen’s rebleed with a CBC and fluids or blood', why: 'A fast heart rate and a falling blood pressure after a GI bleed mean rebleeding until proven otherwise.', test: X.rescued('bleed') },
        { ev: 'bleed', pid: 'p5', text: 'Went to Mr. Chen before the page about visiting hours', why: 'Two pages arrived together. The unstable patient goes first; the other can be told when you will come.', test: X.first('visit') },
        { ev: 'bleed', pid: 'p5', text: 'Ordered a type and screen so blood would be ready', why: 'Blood cannot be given until it is matched. Ordering early saves time if he needs it.', test: X.ordered('ts') },
        GAP_X,
      ],
      handoffWords: [['bleed', 'hemoglobin', 'hgb', 'cbc', 'melena', 'stool']],
    },
  ];
  const shiftDef = (id) => E.SHIFTS.find((s) => s.id === id);
  const PHASES = [['pre', 'Pre-rounds', 'Overnight events and morning labs have posted. Read up on your patients before rounds.'], ['rounds', 'Rounds', 'The attending asks one question about each patient. The answers are in the charts.'], ['day', 'Day work', 'Pages and results arrive through the day. The attending is busy, so think before you override anything.'], ['signout', 'Sign-out', 'Write a Handoff (I-PASS) note on your sickest patient, then end the shift.'], ['over', 'Shift over', 'It is past 19:00 and the night team is waiting. Finish your handoff and end the shift.']];
  const phaseName = (id) => (PHASES.find((x) => x[0] === id) || PHASES[0])[1];
  /** Hospital time for this shift, as a decimal hour. */
  function hosp(a) { const c = CFG(); return Math.min(c.endHour, c.startHour + a.elapsed / hourMs()); }
  E.shiftClock = () => { const a = myShift(); return a ? { hour: hosp(a), text: hhmm(hosp(a)), phase: a.phase, paused: !!a.paused, over: !!a.over } : null; };
  /** True while the attending is too busy to review: the Day work phase of a running shift. */
  E.shiftRushed = () => { const a = myShift(); return !!a && a.phase === 'day' && !a.paused; };

  /* ---------- the clock ---------- */
  let last = Date.now();
  const holding = () => document.hidden || E.suspended() || (E.ui.modal && ['rounds', 'safetyDebrief', 'scene'].includes(E.ui.modal.type));   // 'scene': a cutscene or consequence window (js/world.js)
  /** Move sim time on by however long has passed since the last call. Time does not pass while the shift is
      paused, the tab is hidden, the attending is asking a question, or privileges are suspended. */
  function advance() {
    const now = Date.now(), dt = Math.max(0, Math.min(now - last, 5000));
    last = now;
    if (!dt || !E.db || !E.db.user) return;
    const a = myShift();
    if (holding() || (a && a.paused)) return;
    if (a && !a.over) a.elapsed += dt;
    crises().forEach((c) => { if (c.state === 'pending') c.wait -= dt; else if (c.state === 'open') c.left -= dt; });
  }
  function fire(a, sh, ev) {
    const p = E.pt(ev.pid);
    a.fired[ev.id] = Date.now();
    a.seen[ev.id] = location.hash.indexOf(`#/pt/${ev.pid}/`) === 0;
    if (p.icu) return;   // already with the ICU team: the ward nurse has nothing to page about
    if (ev.labs) pushLab(p, ev.labs[0], ev.labs[1]);
    if (ev.vitals) pushVitals(p, ev.vitals);
    const res = ev.type === 'result';
    E.message({ type: res ? 'Result' : 'Page', from: ev.from, patientId: ev.pid, act: res ? 'results' : ev.vitals ? 'flowsheets' : 'orders', critical: ev.type === 'det', subject: ev.subject, body: ev.body });
    if (ev.crisis) crises().push({ id: E.uid('cr'), kind: 'det', pid: ev.pid, shift: sh.id, evId: ev.id, state: 'open', onsetTs: Date.now(), left: CFG().rescueHours * hourMs(), who: E.db.user.name });
    say(ev.subject, res ? 'New result' : 'Page from nursing', ev.type === 'det' ? 'alert' : res ? 'results' : 'inbox');
    if (ev.type === 'det') pose('worry', 5000);
  }
  function shiftStep() {
    const a = myShift();
    if (!a) return false;
    const c = CFG(), sh = shiftDef(a.id), h = hosp(a);
    let ch = false;
    const ph = h >= c.endHour ? 'over' : h >= c.signOut ? 'signout' : h >= c.dayWork ? 'day' : h >= c.rounds ? 'rounds' : 'pre';
    if (ph !== a.phase) {
      a.phase = ph; a.phaseAt[ph] = Date.now(); ch = true;
      if (ph === 'rounds') a.roundsDue = true;
      if (ph === 'over') a.over = true;
      if (ph !== 'rounds' && E.ui.modal && E.ui.modal.type === 'rounds') E.ui.modal = null;
      say(PHASES.find((x) => x[0] === ph)[2], `${hhmm(h)} · ${phaseName(ph)}`, ph === 'over' ? 'warn' : 'info');
    }
    if (a.roundsDue && a.phase === 'rounds' && !(E.app && E.app.busy())) { a.roundsDue = false; E.ui.modal = { type: 'rounds', i: Math.max(0, a.answers.indexOf(null)) }; ch = true; }
    sh.events.forEach((ev) => { if (!a.fired[ev.id] && h >= ev.at) { fire(a, sh, ev); ch = true; } });
    return ch;
  }
  /** Called every two seconds by the app. Returns true if anything changed. */
  E.shiftTick = () => {
    if (!E.db || !E.db.user) return false;
    advance();
    if (E.suspended()) return false;
    const was = E.suspended();
    const ch = crisisStep() | shiftStep();
    if (!was && E.suspended() && E.app) { E.save(); E.app.render(); }
    return !!ch;
  };

  /* ---------- scoring ---------- */
  function evaluate(a) {
    const sh = shiftDef(a.id), me = E.db.user.name, now = Date.now(), items = [];
    const mine = E.db.audit.filter((x) => x.user === me && x.ts >= a.start);
    const ctx = (pid, from, evId) => {
      const p = E.pt(pid), all = mine.filter((x) => x.ts >= from);
      return { pid, from, fired: a.fired, def: (id) => sh.events.find((e) => e.id === id), seenOf: (id) => !!a.seen[id], seen: !!(evId && a.seen[evId]), all, audit: all.filter((x) => x.patientId === pid),
        orders: p.orders.filter((o) => o.by === me && o.ts >= from && !['Declined', 'Draft'].includes(o.status)),
        tried: p.orders.filter((o) => o.by === me && o.ts >= a.start),
        notes: p.notes.filter((n) => n.author === me && n.ts >= from), crises: crises().filter((x) => x.pid === pid && x.shift === a.id && x.onsetTs >= a.start) };
    };
    // pre-rounds
    const cut = a.phaseAt.rounds || now, readBy = (re) => mine.some((x) => x.ts <= cut && x.action.startsWith('Read message') && re.test(x.action));
    items.push({ phase: 'Pre-rounds', text: 'Read the overnight messages before rounds', done: sh.preRead.every(readBy), why: 'The Inbox is where overnight events are waiting. Reading it first tells you whom to see first.' });
    const pids = sh.rounds.map((q) => q.pid), looked = pids.filter((pid) => mine.some((x) => x.ts <= cut && x.patientId === pid && /^Viewed/.test(x.action))).length;
    items.push({ phase: 'Pre-rounds', text: `Looked at every patient before rounds (${looked} of ${pids.length})`, done: looked === pids.length, why: 'Pre-rounding means opening each chart: the overnight vitals, the morning labs, the new notes.' });
    // rounds
    a.qs.forEach((q, i) => { const p = E.pt(q.pid), picked = a.answers[i]; items.push({ phase: 'Rounds', pid: q.pid, text: `${p.name}: ${q.q}`, done: picked === q.answer, why: `${picked == null ? 'Not answered. ' : `You said “${q.options[picked]}”. `}The answer was “${q.options[q.answer]}”. ${q.where}`, reached: !!a.phaseAt.rounds }); });
    // day work
    sh.expect.forEach((x) => {
      const from = x.ev ? a.fired[x.ev] : a.start, reached = !!from;
      items.push({ phase: 'Day work', pid: x.pid, text: x.text, why: x.why, reached, safety: !!x.safety, done: reached && !!x.test(ctx(x.pid, from, x.ev)) });
    });
    // sign-out
    const so = a.phaseAt.signout, sick = E.pt(sh.sickest), hand = (p) => p.notes.filter((n) => n.author === me && /^Handoff/.test(n.type) && so && n.ts >= so);
    const right = hand(sick), other = E.db.patients.filter((p) => p !== sick && hand(p).length)[0];
    items.push({ phase: 'Sign-out', pid: sick.id, text: `Signed a handoff note on the sickest patient, ${sick.name}`, done: right.length > 0, reached: !!so, why: `${other ? `You handed off ${other.name}. ` : ''}${sh.sickWhy} A Handoff (I-PASS) note, signed during sign-out, is what the night team reads first.` });
    const txt = right.map((n) => n.text.toLowerCase()).join('\n');
    items.push({ phase: 'Sign-out', pid: sick.id, text: 'The handoff names the problem and says what to do if it happens again', done: right.length > 0 && /\bif\b/.test(txt.replace(/\(if \.\.\. then \.\.\.\)/g, '')) && sh.handoffWords.every((alts) => alts.some((w) => txt.includes(w))), reached: !!so, why: 'The part of a handoff most often missing is the contingency: "if this happens, do that".' });
    items.forEach((x) => { if (x.reached === undefined) x.reached = true; });

    const sf = E.safety(), evs = sf.events.filter((e) => e.ts >= a.start), harm = evs.filter((e) => e.kind === 'harm'), near = evs.filter((e) => e.kind !== 'harm');
    // orders that went through and should not have (the per-patient traps already written for the missions)
    const unsafe = [];
    E.db.patients.forEach((p) => { const m = (E.MISSIONS || []).find((x) => x.pid === p.id); if (!m) return; p.orders.filter((o) => o.by === me && o.ts >= a.start && !['Declined', 'Draft'].includes(o.status)).forEach((o) => { const t = m.traps.find((tr) => (tr.ids || []).includes(o.catId) || (tr.tags || []).some((g) => tagsOf(o).includes(g))); if (t) unsafe.push({ patient: p.name, order: o.name, why: t.why }); }); });
    // how each patient did
    const patients = pids.map((pid) => {
      const p = E.pt(pid), h = harm.filter((e) => e.pid === pid), det = crises().filter((x) => x.kind === 'det' && x.pid === pid && x.shift === a.id && x.onsetTs >= a.start)[0];
      const missed = items.filter((x) => x.pid === pid && x.phase === 'Day work' && x.reached && !x.done).length;
      let how, tone;
      if (p.icu) { how = `Transferred to intensive care (${p.icu.why.toLowerCase()})`; tone = 'red'; }
      else if (h.some((e) => e.outcome === 'open') || (det && det.state === 'open')) { how = 'Unstable and still waiting for you when the shift ended'; tone = 'red'; }
      else if (h.length) { how = `Harmed by an order (${h.map((e) => e.title.toLowerCase()).join('; ')}), then stabilised`; tone = 'amber'; }
      else if (det && det.state === 'rescued') { how = `Got worse in the afternoon; you answered and ${he(p).toLowerCase()} settled${missed ? `. ${missed} loose end${missed > 1 ? 's' : ''}` : ''}`; tone = missed ? 'amber' : 'green'; }
      else if (missed) { how = `Stable, with ${missed} thing${missed > 1 ? 's' : ''} left undone`; tone = 'amber'; }
      else { how = 'Stable. Nothing was missed'; tone = 'green'; }
      return { pid, name: p.name, how, tone };
    });
    const total = items.length, score = items.filter((x) => x.done).length, pct = Math.round((score / total) * 100);
    const grade = pct >= 90 && !harm.length ? 'Honors' : pct >= 70 ? 'Pass' : 'Not yet';
    return { id: sh.id, title: sh.title, at: now, start: a.start, endedAt: hhmm(hosp(a)), early: !a.over, items, score, total, pct, grade, patients, unsafe,
      harm: harm.map((e) => ({ patient: e.patient, order: e.order, title: e.title, outcome: e.outcome, at: e.hosp })), near: near.map((e) => ({ patient: e.patient, order: e.order, title: e.title, by: e.by, at: e.hosp })), debrief: sh.debrief };
  }
  E.shiftXp = (pr) => Object.values(pr.shifts || {}).reduce((n, r) => n + Math.round(E.XP.shift * (r.best || 0)), 0);
  E.shiftReport = (pr) => E.SHIFTS.map((sh) => {
    const r = (pr.shifts || {})[sh.id] || {}, l = r.last;
    return { shift: sh.title, plays: r.plays || 0, bestPercent: Math.round((r.best || 0) * 100), history: (r.history || []).map((h) => Object.assign({}, h, { at: new Date(h.at).toISOString() })),
      lastReport: l ? { at: new Date(l.at).toISOString(), endedAtHospitalTime: l.endedAt, endedEarly: l.early, score: `${l.score} of ${l.total}`, grade: l.grade, caught: l.items.filter((x) => x.done).map((x) => `${x.phase}: ${x.text}`), missed: l.items.filter((x) => !x.done).map((x) => `${x.phase}: ${x.text}${x.reached ? '' : ' (not reached)'}`), patients: l.patients.map((p) => `${p.name}: ${p.how}`), harmEvents: l.harm, nearMisses: l.near, unsafeOrders: l.unsafe } : null };
  });
  E.safetyReport = (pr) => {
    const s = pr.safety || { events: [], suspensions: [], debriefs: [], strikes: 0 }, iso = (t) => (t ? new Date(t).toISOString() : null);
    return { harmEvents: s.events.filter((e) => e.kind === 'harm').map((e) => ({ at: iso(e.ts), patient: e.patient, order: e.order, what: e.title, outcome: e.outcome === 'rescued' ? 'rescued' : e.outcome === 'icu' ? 'transferred to intensive care' : 'unresolved', duringShift: e.shift })),
      nearMisses: s.events.filter((e) => e.kind !== 'harm').map((e) => ({ at: iso(e.ts), patient: e.patient, order: e.order, what: e.title, stoppedBy: e.by })),
      debriefsCompleted: (s.debriefs || []).map((d) => ({ at: iso(d.at), wrongAnswersBeforeFinishing: d.wrong })),
      suspensions: (s.suspensions || []).map((x) => ({ at: iso(x.at), after: x.after, liftedAt: iso(x.unlockedAt), remediationAttempts: x.attempts })), currentlySuspended: !!s.suspended, debriefOwed: !!s.debriefDue };
  };
  function announce(before, text, title) {
    const g = E.game(E.progress()), extra = [], gained = g.xp - before.xp;
    if (g.level > before.level) extra.push(`Level up: you are now ${g.title}.`);
    if (!gained && !extra.length) return;
    say(text + (extra.length ? '\n' + extra.join(' ') : ''), (gained ? `+${gained} XP · ` : '') + title, extra.length ? 'medal' : 'star');
    pose('cheer', 2600);
  }

  /* =====================================================================================================
     5. VIEWS
     ===================================================================================================== */
  const MIN_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const MAX_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" fill="none" stroke="#fff" stroke-width="2"/></svg>';
  const chip = (t, cls) => `<span class="chip ${cls || ''}">${esc(t)}</span>`;

  /** The Shifts section at the top of the Missions page. */
  V.shiftShelf = () => {
    const pr = E.progress(), a = pr.active, canOrder = E.can('order.sign') || E.can('order.pend'), c = CFG();
    const cards = E.SHIFTS.map((sh) => {
      const rec = (pr.shifts || {})[sh.id] || {}, live = a && a.type === 'shift' && a.id === sh.id;
      const btn = live ? '<a class="btn primary" href="#/home">Back to the ward</a>' : `<button class="btn${rec.plays ? '' : ' primary'}" data-act="shiftAsk" data-id="${sh.id}"${a || !canOrder ? ' disabled' : ''}>${rec.plays ? 'Work it again' : 'Start shift'}</button>`;
      return `<article class="mission shift-card${live ? ' live' : ''}"><header>${icon(sh.glyph, 48)}<div><b>${esc(sh.title)}</b><span>Shift ${sh.n} · ${esc(sh.level)}</span></div></header>
        <p>${esc(sh.brief)}</p><footer>${rec.plays ? `<span class="shift-best"><b>${Math.round((rec.best || 0) * 100)}%</b> best</span>${rec.last ? `<button class="btn xs" data-act="shiftLast" data-id="${sh.id}">Last report</button>` : ''}` : '<span class="muted">Not worked yet</span>'}<span class="spacer"></span>${live ? chip('In progress', 'amber') + ' ' : ''}${btn}</footer></article>`;
    }).join('');
    return `<h3 class="shelf-h">${icon('patients', 32)}Shifts</h3>
      <p class="muted shelf-p">A shift is a whole day with all of your patients: ${hhmm(c.startHour)} to ${hhmm(c.endHour)} on the hospital clock, about ${c.minutes} minutes on yours, and you can pause it. Pre-rounds, rounds, day work, sign-out, then a report on what you caught and what you missed. Starting a shift resets the ward to its starting state. One shift or mission at a time.</p>
      ${a && a.type === 'shift' ? `<div class="notice info">${icon('info', 24)}<span>A shift is in progress. End it from the shift panel in the corner before starting a mission or another shift.</span></div>` : ''}
      <div class="mission-grid">${cards}</div><h3 class="shelf-h">${icon('trophy', 32)}Missions</h3>`;
  };

  /** The shift panel in the bottom-left corner. */
  V.shiftDock = (a) => {
    const sh = shiftDef(a.id), c = CFG(), h = hosp(a), min = !!E.ui.dockMin, s = E.safety(), n = counts(s, a.start);
    const pct = Math.round(((h - c.startHour) / (c.endHour - c.startHour)) * 100), ph = PHASES.find((x) => x[0] === a.phase) || PHASES[0];
    const order = ['pre', 'rounds', 'day', 'signout'], at = a.phase === 'over' ? 4 : order.indexOf(a.phase);
    const fired = sh.events.filter((e) => a.fired[e.id]).sort((x, y) => a.fired[y.id] - a.fired[x.id]).slice(0, 3);
    const open = crises().filter((x) => x.state === 'open' && x.who === E.db.user.name);
    const left = a.answers.filter((x) => x == null).length;
    // One or two things to do now, each a single short line, instead of a paragraph.
    const me = E.db.user.name, mine = E.db.audit.filter((x) => x.user === me && x.ts >= a.start);
    const todo = (done, html) => `<li class="${done ? 'done' : ''}"><i class="tick${done ? '1' : '0'}"></i><span>${html}</span></li>`;
    let now = '';
    if (a.phase === 'pre') {
      const read = sh.preRead.filter((re) => mine.some((x) => x.action.startsWith('Read message') && re.test(x.action))).length;
      const pids = sh.rounds.map((q) => q.pid), looked = pids.filter((pid) => mine.some((x) => x.patientId === pid && /^Viewed/.test(x.action))).length;
      now = todo(read === sh.preRead.length, `<a href="#/inbox">Read overnight Inbox</a> <b>${read}/${sh.preRead.length}</b>`) + todo(looked === pids.length, `<a href="#/home">Open each chart</a> <b>${looked}/${pids.length}</b>`);
    } else if (a.phase === 'rounds') now = todo(!left, `Answer the attending <b>${a.answers.length - left}/${a.answers.length}</b>`);
    else if (a.phase === 'day') now = todo(false, 'Answer pages as they arrive');
    else now = todo(false, 'Write a Handoff (I-PASS) note on your sickest patient') + todo(false, 'Then end the shift');
    const next = { pre: ['Rounds', c.rounds], rounds: ['Day work', c.dayWork], day: ['Sign-out', c.signOut], signout: ['Night team', c.endHour] }[a.phase];
    const body = `<span class="xpbar shift-bar" role="img" aria-label="${pct}% of the shift gone"><i id="shift-bar" style="width:${pct}%"></i></span>
      <p class="dock-next">${next ? `${esc(next[0])} at ${hhmm(next[1])}` : 'The night team is waiting'}</p>
      ${a.paused ? `<p class="shift-paused">${icon('info', 16)}<span>Paused. The ward is holding its breath.</span></p>` : ''}
      ${open.map((x) => { const p = E.pt(x.pid); return `<p class="shift-now">${icon('alert', 16)}<a href="#/pt/${p.id}/orders">${esc(p.name)} needs you now</a></p>`; }).join('')}
      ${s.debriefDue ? `<p class="shift-now">${icon('warn', 16)}<button class="linkish" data-act="debriefOpen">Debrief owed before you sign orders</button></p>` : ''}
      <ul class="dock-list dock-todo">${now}</ul>
      ${fired.length ? `<h5>New</h5><ul class="dock-list">${fired.map((e) => `<li>${icon(e.type === 'det' ? 'alert' : e.type === 'result' ? 'results' : 'inbox', 16)}<span><a href="#/pt/${e.pid}/${e.type === 'result' ? 'results' : e.vitals ? 'flowsheets' : 'orders'}">${esc(e.subject)}</a><small>${hhmm(e.at)}</small></span></li>`).join('')}</ul>` : ''}
      ${n.harm || n.near ? `<div class="dock-score">${n.harm ? chip(`${n.harm} harm`, 'red') : ''}${n.near ? chip(`${n.near} near miss${n.near === 1 ? '' : 'es'}`, 'amber') : ''}</div>` : ''}
      <div class="dock-acts">${a.over ? '' : `<button class="btn xs" data-act="shiftPause">${a.paused ? 'Resume' : 'Pause'}</button>`}${a.phase === 'rounds' && left ? `<button class="btn xs primary" data-act="shiftRounds">Rounds (${left})</button>` : ''}<button class="btn xs${a.over || a.phase === 'signout' ? ' primary' : ''}" data-act="shiftEnd">End shift</button></div>`;
    return `<aside class="dock${min ? ' min' : ''} dock-shift${a.paused ? ' paused' : ''}" aria-label="Shift: ${esc(sh.title)}"><header class="dock-h">${icon('log', 16)}<b>${esc(ph[1])}</b><span id="shift-clock" class="dock-timer">${hhmm(h)}</span><button class="cap" data-act="dockToggle" title="${min ? 'Show' : 'Minimize'}" aria-label="${min ? 'Show panel' : 'Minimize panel'}">${min ? MAX_SVG : MIN_SVG}</button></header><div class="dock-b">${body}</div></aside>`;
  };

  /** Notices at the top of a chart: intensive care, a patient who needs the learner now, a debrief owed. */
  V.chartBanner = (p) => {
    if (!E.db.user) return '';
    const out = [], me = E.db.user.name;
    if (p.icu) out.push(`<div class="notice harm">${icon('alert', 24)}<span><b>Transferred to intensive care at ${E.fmtTime(p.icu.ts)}.</b> ${esc(p.icu.why)}: nobody answered in time, so the nurse called a rapid response. The ICU team writes the orders now. This chart takes no new orders until the sim data is reset.</span></div>`);
    crises().filter((c) => c.pid === p.id && c.state === 'open' && c.who === me).forEach((c) => {
      const r = c.kind === 'harm' ? ruleById(c.rule) : null, d = r ? null : eventDef(c), o = c.orderId && p.orders.find((x) => x.id === c.orderId);
      const stop = r && o && o.status === 'Active';
      out.push(`<div class="notice harm">${icon('alert', 24)}<span><b>${esc(r ? r.title : d.crisis.title)}.</b> ${r ? `${esc(o ? o.name : 'An order')} has harmed ${esc(mrms(p))}. ` : ''}${he(p)} needs ${stop ? `that order stopped, and ` : ''}${esc(r ? r.needText : d.crisis.needText)}. The nurse’s page is in your Inbox. If nothing is done the nurse will call a rapid response.</span>${p.id && location.hash.indexOf('/orders') < 0 ? `<a class="btn xs" href="#/pt/${p.id}/orders">Go to Orders</a>` : ''}</div>`);
    });
    if (E.safety().debriefDue) out.push(`<div class="notice warn">${icon('warn', 24)}<span><b>Debrief owed.</b> Two of your orders have harmed patients. Your attending wants three questions answered before you sign more orders.</span><button class="btn xs" data-act="debriefOpen">Start the debrief</button></div>`);
    return out.join('');
  };
  /** A student cannot discontinue orders, but can always ask for one of their own harmful orders to be stopped. */
  V.orderExtra = (p, o) => {
    if (o.status !== 'Active' || E.can('order.dc') || o.by !== E.db.user.name) return '';
    const live = o.rushed || crises().some((c) => c.orderId === o.id && ['pending', 'open'].includes(c.state));
    return live ? `<button class="btn xs danger" data-act="harmStop" data-pid="${p.id}" data-id="${o.id}">Stop this order</button> ` : '';
  };

  /** Extra lines and a card on the Learning page: shifts worked and the safety record. */
  V.learnStats = (who) => {
    const s = who.safety, n = s ? counts(s) : { harm: 0, near: 0 }, worked = E.SHIFTS.filter((sh) => ((who.shifts || {})[sh.id] || {}).plays).length;
    return `<dt>Shifts</dt><dd>${worked} of ${E.SHIFTS.length} worked · ${E.shiftXp(who)} XP · <a href="#/missions">Shifts</a></dd><dt>Safety record</dt><dd>${n.harm} harm event${n.harm === 1 ? '' : 's'} · ${n.near} near miss${n.near === 1 ? '' : 'es'}${s && s.suspensions.length ? ` · ${s.suspensions.length} suspension${s.suspensions.length > 1 ? 's' : ''}` : ''}</dd>`;
  };
  V.learnCards = (who, own) => {
    const s = who.safety;
    if (!s || !(s.events.length || s.suspensions.length)) return '';
    const rows = [...s.events].sort((x, y) => y.ts - x.ts).map((e) => `<tr><td class="nowrap">${E.fmtDT(e.ts)}</td><td>${e.kind === 'harm' ? chip('Harm', 'red') : chip('Near miss', 'amber')}</td><td>${esc(e.patient)}</td><td><b>${esc(e.order)}</b><div class="muted">${esc(e.title)}</div></td><td>${e.kind === 'harm' ? (e.outcome === 'rescued' ? 'Stabilised after the learner responded' : e.outcome === 'icu' ? 'Transferred to intensive care' : 'Not yet resolved') : `Stopped by ${esc(e.by || '')} before it reached the patient`}</td></tr>`).join('');
    return `<section class="card"><header class="card-h"><h3>${icon('warn', 24)}Safety record</h3><span class="muted">${own ? 'Kept when progress is reset' : esc(who.name)}</span></header><div class="card-b">
      ${s.suspensions.map((x) => `<p class="notice warn">${icon('warn', 24)}<span><b>Privileges suspended ${E.fmtDT(x.at)}</b> after ${esc(x.after)}. ${x.unlockedAt && x.startedOver ? `Lifted ${E.fmtDT(x.unlockedAt)} by starting over, without remediation.` : x.unlockedAt ? `Lifted ${E.fmtDT(x.unlockedAt)} after ${x.attempts} remediation attempt${x.attempts === 1 ? '' : 's'}.` : 'Not yet lifted.'}</span></p>`).join('')}
      ${rows ? `<table class="tbl compact"><thead><tr><th>When</th><th>Kind</th><th>Patient</th><th>Order</th><th>Outcome</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
      <p class="fine">Harm events and near misses come from the sim’s harm rules (js/shift.js). Patients are fictional; the record is for teaching.</p></div></section>`;
  };

  /** The full-screen lockout while privileges are suspended. */
  V.lockout = () => {
    const s = E.safety(), c = CFG(), L = E.ui.lock, harm = s.events.filter((e) => e.kind === 'harm').slice(-c.strikes);
    let body;
    if (!L) {
      body = `<p class="lock-lead">You have been reassigned to the gift shop.</p>
        <p>${c.strikes} patients have been harmed by orders you signed, so your ordering privileges are suspended. The gift shop is short of someone to restock the balloons, and nobody there can be given the wrong one.</p>
        <table class="tbl compact"><thead><tr><th>Patient</th><th>Order</th><th>What happened</th></tr></thead><tbody>${harm.map((e) => `<tr><td>${esc(e.patient)}</td><td>${esc(e.order)}</td><td>${esc(e.title)}${e.outcome === 'icu' ? ' · intensive care' : ''}</td></tr>`).join('')}</tbody></table>
        <p>To get your badge back, pass the remediation round: ${c.remediationQuestions} questions, ${c.remediationPass} right. It is not timed, and you can take it as often as you need. The suspension stays on your safety record either way.</p>
        ${E.ui.lockOver ? `<p class="notice warn">${icon('warn', 24)}<span><b>Start over with a clean slate?</b> Everything of yours is erased: XP, level, badges, completed tasks and missions, shift reports and this safety record. Every patient goes back to how they were on admission. It cannot be undone.</span></p>
        <div class="lock-acts"><button class="btn" data-act="lockOverNo">Keep my place</button><button class="btn primary lg" data-act="lockOverDo">Start over</button></div>`
        : `<div class="lock-acts"><button class="btn" data-act="logout">Log off</button><button class="btn" data-act="lockOver">Start over</button><button class="btn primary lg" data-act="remStart">Start the remediation round</button></div>`}`;
    } else if (!L.done) {
      body = `<p class="lock-lead">Remediation round</p><p class="muted">${c.remediationPass} of ${L.qs.length} to pass. Not timed.</p>
        ${L.qs.map((q, i) => `<div class="quiz"><p><b>${i + 1}.</b> ${esc(q.q)}</p>${q.options.map((o, j) => `<button class="qopt${L.answers[i] === j ? ' picked' : ''}" data-act="remPick" data-q="${i}" data-i="${j}" aria-pressed="${L.answers[i] === j}">${esc(o)}</button>`).join('')}</div>`).join('')}
        <div class="lock-acts"><span id="lockErr" class="err"></span><button class="btn primary lg" data-act="remSubmit">Submit answers</button></div>`;
    } else {
      body = `<div class="result-head"><span class="result-score ${L.passed ? 'pass' : 'fail'}">${L.score}<small>of ${L.qs.length}</small></span><div><b>${L.passed ? 'Passed' : 'Not yet'}</b><span>${L.passed ? 'Your badge is at the front desk. The balloons will manage without you.' : `${c.remediationPass} right are needed. The gift shop is glad to keep you a little longer.`}</span></div></div>
        ${L.qs.map((q, i) => { const a = L.answers[i], ok = a === q.answer; return `<div class="quiz"><p><b>${i + 1}.</b> ${esc(q.q)}</p>${q.options.map((o, j) => `<button class="qopt${j === q.answer && (ok || L.passed) ? ' right' : ''}${j === a && !ok ? ' wrong' : ''}" disabled>${esc(o)}</button>`).join('')}<div class="why ${ok ? 'ok' : 'no'}"><b>${ok ? 'Correct.' : 'Not quite.'}</b> ${ok || L.passed ? esc(q.why) : 'Think again about what protects the patient here.'}</div></div>`; }).join('')}
        <div class="lock-acts">${L.passed ? '<button class="btn primary lg" data-act="remDone">Collect your badge</button>' : '<button class="btn" data-act="logout">Log off</button><button class="btn primary lg" data-act="remStart">Try again</button>'}</div>`;
    }
    return `<div class="lockout"><div class="lock-card"><header class="modal-h">${icon('brand', 16)}<h3>Privileges suspended</h3></header><div class="lock-b"><div class="lock-top">${icon('warn', 96)}<div><span class="boss-kick">Epig · Medical Staff Office</span><h2>Privileges suspended</h2><span class="muted">${esc(E.db.user.name)} · ${esc(E.roleLabel(E.db.user.role))} · since ${E.fmtDT(s.suspended.ts)}</span></div></div>${body}</div></div></div>`;
  };

  V.modalExt = Object.assign(V.modalExt || {}, {
    rounds(m, modal) {
      const a = myShift();
      if (!a) return '';
      const i = Math.max(0, Math.min(a.qs.length - 1, m.i)), q = a.qs[i], p = E.pt(q.pid), picked = a.answers[i], done = picked != null, left = a.answers.filter((x) => x == null).length;
      const next = a.answers.findIndex((x, j) => x == null && j > i), nx = next >= 0 ? next : a.answers.indexOf(null);
      return modal(`Rounds — Dr. ${p.attending.split(',')[0]} is asking`, `
        <div class="g-pt">${icon('user', 32)}<div><b>${esc(p.name)}</b> · ${E.age(p.dob)} ${p.sex} · ${esc(p.bed)}<span>${esc(p.dx)}</span></div></div>
        <p class="dock-qt rounds-q">“${esc(q.q)}”</p>
        ${q.options.map((o, j) => `<button class="qopt${done && j === q.answer ? ' right' : ''}${done && j === picked && picked !== q.answer ? ' wrong' : ''}" data-act="roundsPick" data-i="${j}"${done ? ' disabled' : ''}>${esc(o)}</button>`).join('')}
        ${done ? `<div class="why ${picked === q.answer ? 'ok' : 'no'}"><b>${picked === q.answer ? 'Right.' : 'No.'}</b> ${picked === q.answer ? 'On to the next bed.' : esc(q.where)}</div>` : '<p class="fine">The hospital clock waits while you are being asked. If you do not know, step out, look in the chart, and come back from the shift panel; the clock runs while you look.</p>'}
        <div class="dock-dots rounds-dots">${a.qs.map((x, j) => `<button class="${j === i ? 'on' : ''}${a.answers[j] != null ? ' ans' : ''}" data-act="roundsGo" data-i="${j}" aria-label="Patient ${j + 1}${a.answers[j] != null ? ', answered' : ''}">${j + 1}</button>`).join('')}</div>`,
        `<span class="muted">${a.qs.length - left} of ${a.qs.length} answered</span><button class="btn" data-act="closeModal">${left ? 'Step out to check a chart' : 'Close'}</button>${left && (done || nx !== i) ? `<button class="btn primary" data-act="roundsGo" data-i="${nx}">Next patient</button>` : !left ? '<button class="btn primary" data-act="closeModal">Rounds done</button>' : ''}`, 'lg');
    },
    safetyDebrief(m, modal) {
      const ev = E.safety().events.find((e) => e.id === m.evId) || {}, all = m.qs.every((q, i) => m.picked[i] === q.answer);
      return modal('Debrief with your attending', `
        <div class="advisory high"><div class="adv-h">${icon('alert', 32)}<b>${esc(ev.title || '')}</b> ${chip('Harm event', 'red')}</div><p>${esc(ev.order || '')} · ${esc(ev.patient || '')}</p></div>
        <p>Three questions about what went wrong. Nothing is marked down for a wrong answer here; you keep going until each one is right.</p>
        ${m.qs.map((q, i) => { const a = m.picked[i], ok = a === q.answer; return `<div class="quiz"><p><b>${i + 1}.</b> ${esc(q.q)}</p>${q.options.map((o, j) => `<button class="qopt${ok && j === a ? ' right' : ''}${!ok && j === a ? ' wrong' : ''}" data-act="debriefPick" data-q="${i}" data-i="${j}"${ok ? ' disabled' : ''}>${esc(o)}</button>`).join('')}${a != null ? `<div class="why ${ok ? 'ok' : 'no'}"><b>${ok ? 'Yes.' : 'Not that one.'}</b> ${ok ? esc(q.why) : 'Try again.'}</div>` : ''}</div>`; }).join('')}`,
        `<button class="btn" data-act="closeModal">Later</button><button class="btn primary" data-act="debriefDone"${all ? '' : ' disabled'}>Finish the debrief</button>`, 'lg');
    },
    shiftResult(m, modal) {
      const pr = E.progress(), r = ((pr.shifts || {})[m.id] || {}).last;
      if (!r) return '';
      const li = (x, ok) => `<li class="${ok ? 'done' : 'bad'}">${icon(ok ? 'check' : 'remove', 16)}<span><i class="ph-tag">${esc(x.phase)}</i> ${esc(x.text)}${ok ? '' : `<small>${x.reached ? '' : 'Not reached: the shift ended first. '}${esc(x.why)}</small>`}</span></li>`;
      const caught = r.items.filter((x) => x.done), missed = r.items.filter((x) => !x.done);
      return modal(`Shift report — ${r.title}`, `
        <div class="result-head"><span class="result-score ${r.grade === 'Not yet' ? 'fail' : 'pass'}">${r.pct}<small>percent</small></span><div><b>${esc(r.grade)}</b><span>${r.score} of ${r.total} caught · ended at ${r.endedAt}${r.early ? ' (early)' : ''}</span>${m.xp ? `<span class="xp">+${m.xp} XP</span>` : ''}</div></div>
        <p class="fine">Honors: 90% or more and nobody harmed. Pass: 70% or more. Your best result on each shift counts toward your level; points are never taken away.</p>
        <h4>How each patient did</h4><table class="tbl compact"><tbody>${r.patients.map((p) => `<tr><td class="nowrap"><b>${esc(p.name)}</b></td><td>${chip(p.tone === 'green' ? 'Well' : p.tone === 'amber' ? 'Mixed' : 'Badly', p.tone)}</td><td>${esc(p.how)}</td></tr>`).join('')}</tbody></table>
        <h4>Safety</h4><ul class="dock-list wide">${r.harm.map((e) => `<li class="bad">${icon('alert', 16)}<span><b>Harm: ${esc(e.patient)}</b> — ${esc(e.order)}<small>${esc(e.title)}. ${e.outcome === 'rescued' ? 'You responded and the patient stabilised.' : e.outcome === 'icu' ? 'Nobody responded in time: transferred to intensive care.' : 'Still unresolved when the shift ended.'}</small></span></li>`).join('')}
          ${r.near.map((e) => `<li>${icon('warn', 16)}<span><b>Near miss: ${esc(e.patient)}</b> — ${esc(e.order)}<small>${esc(e.title)}. Stopped by ${esc(e.by || 'someone else')} before it reached the patient.</small></span></li>`).join('')}
          ${r.unsafe.map((e) => `<li class="bad">${icon('warn', 16)}<span><b>Unsafe order: ${esc(e.patient)}</b> — ${esc(e.order)}<small>${esc(e.why)}</small></span></li>`).join('')}
          ${r.harm.length + r.near.length + r.unsafe.length ? '' : `<li class="done">${icon('check', 16)}<span>Nobody was harmed, and nothing you ordered had to be stopped.</span></li>`}</ul>
        <h4>Caught (${caught.length})</h4><ul class="dock-list wide">${caught.map((x) => li(x, true)).join('') || '<li class="hid"><i class="tick0"></i><span>Nothing yet.</span></li>'}</ul>
        <h4>Missed (${missed.length})</h4><ul class="dock-list wide">${missed.map((x) => li(x, false)).join('') || `<li class="done">${icon('check', 16)}<span>Nothing. A clean shift.</span></li>`}</ul>
        <div class="debrief shift-debrief">${icon('learning', 48)}<div><p>${esc(r.debrief)}</p></div></div>`,
        `<a class="btn" href="#/missions" data-act="closeModal">All shifts</a><button class="btn primary" data-act="closeModal">Close</button>`, 'lg');
    },
  });

  /* =====================================================================================================
     6. ACTIONS (merged into the app's action table by js/app.js)
     ===================================================================================================== */
  function buildRounds(sh) {
    return sh.rounds.map((r) => {
      const p = E.pt(r.pid), ans = typeof r.answer === 'function' ? r.answer(p) : r.answer;
      const pool = [...new Set((typeof r.pool === 'function' ? r.pool(p) : r.pool).filter((x) => x && x !== ans))].slice(0, 3), options = shuffle([ans].concat(pool));
      return { pid: r.pid, q: r.q, options, answer: options.indexOf(ans), where: r.where };
    });
  }
  E.shiftActions = {
    shiftAsk(d) {
      const pr = E.progress(), sh = shiftDef(d.id), c = CFG();
      if (pr.active) { E.app.status(`Finish ${pr.active.type === 'shift' ? 'your shift' : pr.active.type === 'exam' ? 'the proficiency check' : pr.active.type === 'case' ? 'your case' : 'your mission'} first.`); return; }
      if (!E.can('order.sign') && !E.can('order.pend')) return E.app.status('Shifts involve entering orders, so they are for the Medical Student and Physician roles.');
      E.ui.modal = { type: 'confirm', title: `Start shift ${sh.n}: ${sh.title}?`, text: `The ward is reset to its starting state first: every order, note and result entered on this device so far is erased. Your learning progress and safety record are kept. The hospital clock runs from ${hhmm(c.startHour)} to ${hhmm(c.endHour)} in about ${c.minutes} minutes. You can pause it, and it pauses itself if you switch to another tab.`, yes: 'shiftStart', yesLabel: 'Start the shift', id: sh.id };
      E.app.render();
    },
    shiftStart() {
      const id = E.ui.modal && E.ui.modal.id, sh = shiftDef(id), pr = E.progress();
      if (!sh || pr.active) return;
      E.reset(); E.db.openTabs = [];
      Object.assign(E.ui, { modal: null, selLab: null, selVital: null, selReport: null, noteSel: null, crSel: null, inboxSel: null, marDay: 0, dockMin: false });
      const t0 = Date.now() - 20 * 60000;
      sh.overnight.forEach((x) => {
        if (x.lab) E.pt(x.pid).labs.push({ id: E.uid('l'), ts: t0, name: x.lab[0], values: x.lab[1] });
        if (x.vitals) { const p = E.pt(x.pid); pushVitals(p, x.vitals); p.vitals[p.vitals.length - 1].ts = t0; }
        if (x.msg) { E.message(x.msg); E.db.inbox[0].ts = t0; }
      });
      const a = (pr.active = { type: 'shift', id, start: Date.now(), elapsed: 0, paused: false, over: false, phase: 'pre', phaseAt: { pre: Date.now() }, fired: {}, seen: {}, qs: [], answers: [] });
      a.qs = buildRounds(sh); a.answers = a.qs.map(() => null);
      last = Date.now();
      E.audit(`Started shift: ${sh.title}`); E.save();
      say(PHASES[0][2], `${hhmm(CFG().startHour)} · Pre-rounds`, 'info');
      E.app.go('#/inbox');
    },
    shiftPause() { const a = myShift(); if (!a) return; a.paused = !a.paused; last = Date.now(); E.audit(a.paused ? 'Paused the shift' : 'Resumed the shift'); E.app.commit(); },
    shiftRounds() { const a = myShift(); if (!a || a.phase !== 'rounds') return; E.ui.modal = { type: 'rounds', i: Math.max(0, a.answers.indexOf(null)) }; E.app.render(); },
    roundsPick(d) { const a = myShift(), m = E.ui.modal; if (!a || !m || a.answers[m.i] != null) return; a.answers[m.i] = Number(d.i); E.audit(`Answered on rounds: ${E.pt(a.qs[m.i].pid).name}`, a.qs[m.i].pid); E.app.commit(); },
    roundsGo(d) { const m = E.ui.modal; if (!m || m.type !== 'rounds') return; m.i = Number(d.i); E.app.render(); },
    shiftEnd() {
      const a = myShift(); if (!a) return;
      E.ui.modal = { type: 'confirm', title: a.over ? 'End the shift?' : 'End the shift early?', text: a.over ? 'The night team takes over and your shift report is written. Anything you have not signed stays unsigned.' : `It is ${hhmm(hosp(a))}. If you leave now, everything the day had not reached yet counts as missed, and anyone who is unstable stays that way on your report.`, yes: 'shiftEndDo', yesLabel: a.over ? 'End shift and see the report' : 'End early', danger: !a.over };
      E.app.render();
    },
    shiftEndDo() {
      const pr = E.progress(), a = shiftOf(pr); if (!a) return;
      const before = E.game(pr), r = evaluate(a);
      const rec = (pr.shifts = pr.shifts || {})[a.id] || { plays: 0, best: 0, history: [] };
      rec.plays++; rec.best = Math.max(rec.best || 0, r.score / r.total); rec.last = r;
      rec.history.push({ at: r.at, score: r.score, total: r.total, percent: r.pct, grade: r.grade, harm: r.harm.length, nearMisses: r.near.length, endedEarly: r.early });
      pr.shifts[a.id] = rec;
      crises().forEach((c) => { if (c.kind === 'det' && c.state === 'open') { c.state = 'ended'; c.endTs = Date.now(); } });   // the night team takes it from here
      delete pr.active;
      E.audit(`Finished shift: ${r.title} (${r.score} of ${r.total}, ${r.grade})`);
      E.ui.modal = { type: 'shiftResult', id: a.id, xp: E.game(pr).xp - before.xp };
      E.save();
      announce(before, `${r.grade} on “${r.title}”: ${r.score} of ${r.total}.`, 'Shift');
      E.app.render();
    },
    shiftLast(d) { E.ui.modal = { type: 'shiftResult', id: d.id }; E.app.render(); },

    /** Stop a harmful order. A physician discontinues it; a student asks, and the nurse holds it at once. */
    harmStop(d) {
      const p = E.pt(d.pid), o = p && p.orders.find((x) => x.id === d.id); if (!o || o.status !== 'Active') return;
      Object.assign(o, { status: 'Discontinued', dcTs: Date.now(), dcBy: E.can('order.dc') ? E.db.user.name : `${p.rn} (held at ${E.db.user.name}’s request)` });
      E.audit(`Stopped order: ${o.name}`, p.id);
      E.app.status(`${o.name} is stopped.`);
      E.app.commit();
    },
    debriefOpen() { if (E.safety().debriefDue) openDebrief(); },
    debriefPick(d) { const m = E.ui.modal; if (!m || m.type !== 'safetyDebrief') return; const q = m.qs[d.q]; m.picked[d.q] = Number(d.i); if (Number(d.i) !== q.answer) m.wrong++; E.app.render(); },
    debriefDone() {
      const m = E.ui.modal, s = E.safety(); if (!m || m.type !== 'safetyDebrief' || !m.qs.every((q, i) => m.picked[i] === q.answer)) return;
      s.debriefs.push({ at: Date.now(), eventId: m.evId, wrong: m.wrong }); s.debriefDue = null;
      E.audit('Completed a safety debrief with the attending');
      E.ui.modal = null; last = Date.now();
      E.app.status('Debrief done. You can sign orders again.');
      E.app.commit();
    },
    remStart() { const s = E.safety(); if (!s.suspended) return; const qs = buildRemediation(); E.ui.lock = { qs, answers: qs.map(() => null), done: false }; E.app.render(); const sc = document.querySelector('.lockout'); if (sc) sc.scrollTop = 0; },
    remPick(d) { const L = E.ui.lock; if (!L || L.done) return; L.answers[d.q] = Number(d.i); const sc = document.querySelector('.lockout'), y = sc ? sc.scrollTop : 0; E.app.render(); const s2 = document.querySelector('.lockout'); if (s2) s2.scrollTop = y; },
    remSubmit() {
      const L = E.ui.lock, s = E.safety(); if (!L || L.done) return;
      if (L.answers.some((x) => x == null)) { const e = document.getElementById('lockErr'); if (e) e.textContent = 'Answer every question first.'; return; }
      L.score = L.qs.filter((q, i) => L.answers[i] === q.answer).length; L.passed = L.score >= Math.min(CFG().remediationPass, L.qs.length); L.done = true;
      const cur = s.suspensions[s.suspensions.length - 1]; if (cur) cur.attempts++;
      E.audit(`Remediation round: ${L.score} of ${L.qs.length}${L.passed ? ', passed' : ''}`);
      E.save(); E.app.render();
      const sc = document.querySelector('.lockout'); if (sc) sc.scrollTop = 0;
    },
    lockOver() { E.ui.lockOver = true; E.app.render(); },
    lockOverNo() { E.ui.lockOver = false; E.app.render(); },
    /* Game over, new game: a clean slate. The learner's whole record is erased (XP, badges, tasks, missions,
       shift reports, safety record) and the ward is put back as it was. Only the name and role stay. */
    lockOverDo() {
      if (!E.suspended()) return;
      const pr = E.progress(), all = E.db.progress;
      Object.keys(all).forEach((k) => { if (all[k] === pr) delete all[k]; });
      E.ui.lock = null; E.ui.lockOver = false; last = Date.now();
      E.reset(); E.db.openTabs = [];
      E.audit('Started over with a clean slate after a suspension');
      E.save();
      if (location.hash !== '#/home') location.hash = '#/home'; else E.app.render();
      say('A fresh ward, a clean badge and a blank record. Welcome back to day one.', 'Clean slate', 'info');
    },
    remDone() {
      const L = E.ui.lock, s = E.safety(); if (!L || !L.passed || !s.suspended) return;
      const cur = s.suspensions[s.suspensions.length - 1]; if (cur) cur.unlockedAt = Date.now();
      s.suspended = null; s.strikes = 0; s.debriefDue = null; E.ui.lock = null; last = Date.now();
      E.audit('Ordering privileges restored after remediation');
      E.save();
      say('Welcome back. The suspension stays on your safety record; the count toward the next one starts again from zero.', 'Privileges restored', 'check');
      pose('phew', 4000);
      E.app.go('#/home');
    },
  };

  /* The shift clock, once a second. The numbers in the panel are updated in place; scripted events and
     consequences are fired by E.shiftTick from the app's own two-second loop. */
  let ticks = 0;
  setInterval(() => {
    if (!E.db || !E.db.user || !E.app) return;
    advance();
    const a = myShift();
    if (!a) return;
    const c = CFG(), h = hosp(a), el = document.getElementById('shift-clock'), bar = document.getElementById('shift-bar');
    if (el) el.textContent = hhmm(h);
    if (bar) bar.style.width = Math.round(((h - c.startHour) / (c.endHour - c.startHour)) * 100) + '%';
    if (++ticks % 10 === 0) E.save();
  }, 1000);
  /* Switching to another tab pauses the shift; the learner resumes it on purpose when they come back. */
  document.addEventListener('visibilitychange', () => {
    const a = myShift();
    if (document.hidden && a && !a.paused && !a.over) { a.paused = true; a.autoPaused = true; E.audit('Shift paused: the browser tab was hidden'); E.save(); if (E.app && !E.app.busy()) E.app.render(); }
    last = Date.now();
  });
})();
