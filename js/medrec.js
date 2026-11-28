/* SIM+EHR Student Edition — medication reconciliation and discharge prescriptions (EPA 4). Plan:
   docs/lo-improvements-plan.md, item B3.

   Each patient has a home medication list, from the pharmacy fill record and from what the patient or family say.
   The Med Rec activity has two modes:
   - Admission: a decision for every home medicine (continue, hold, stop, change). Continue puts the inpatient order
     in the learner's unsigned orders, where the usual advisories run.
   - Discharge: a decision for every home medicine and every active inpatient medicine, and prescriptions, each with
     a dispense quantity, refills and instructions in plain words.
   The simulated attending reviews a reconciliation against the key below; a simulated outpatient pharmacist calls
   back about a prescription that is incomplete.

   FACULTY: the home medicine lists and their keys are data at the top of this file, not yet reviewed. `ok` lists
   the decisions a reviewer would accept; `why` is what the attending says when a different one was made. */
(function () {
  const E = window.EHR, V = E.V, esc = (s) => E.esc(s), icon = (n, s) => E.icon(n, s);
  const chip = (t, cls) => `<span class="chip ${cls || ''}">${esc(t)}</span>`;

  /* =====================================================================================================
     1. HOME MEDICINES
     ===================================================================================================== */
  const PHARM = 'Pharmacy fill record', PT = 'Patient report';
  /** Asked in the patient's message thread (js/sim.js E.interview). Over-the-counter medicines are on no pharmacy list. */
  E.OTC_QUESTION = 'Do you take anything over the counter, or anything you only take now and then?';
  const OTC = E.OTC_QUESTION;
  const hm = (id, name, dose, route, freq, source, ok, why, more) => Object.assign({ id, name, dose, route, freq, source, ok, why }, more || {});
  E.HOME_MEDS = {
    p1: [   // Akana: heart failure, CKD 3b (Cr 2.1), K 5.1, ACE inhibitor angioedema
      hm('a1', 'furosemide tablet', '40 mg', 'PO', 'Daily', PHARM, ['hold', 'change'], 'He is on IV furosemide now. The tablet waits until he goes back to it.', { catId: 'furosemide_po' }),
      hm('a2', 'spironolactone tablet', '25 mg', 'PO', 'Daily', PHARM, ['hold', 'stop'], 'His potassium is 5.1 and his creatinine 2.1. Spironolactone raises potassium.', { catId: 'spironolactone' }),
      hm('a3', 'carvedilol tablet', '12.5 mg', 'PO', 'BID', PHARM, ['continue'], 'A beta blocker in stable heart failure is continued unless he is in shock or very slow.', { catId: 'carvedilol' }),
      hm('a4', 'metformin tablet', '1,000 mg', 'PO', 'BID', PHARM, ['hold'], 'With a creatinine of 2.1 and an acute illness, metformin is held in hospital.', { catId: 'metformin' }),
      hm('a5', 'atorvastatin tablet', '40 mg', 'PO', 'Daily', PHARM, ['continue'], 'Nothing about this admission is a reason to stop his statin.', { catId: 'atorvastatin' }),
    ],
    p2: [   // Santos: sepsis from pneumonia, BP soft, penicillin anaphylaxis
      hm('s1', 'lisinopril tablet', '10 mg', 'PO', 'Daily', PHARM, ['hold'], 'In sepsis, with a blood pressure around 100, blood pressure medicines are held.', { catId: 'lisinopril' }),
      hm('s2', 'albuterol inhaler', '2 puffs', 'Inhaled', 'Q4H PRN', PHARM, ['continue', 'change'], 'A rescue inhaler is continued; a nebulizer is a reasonable change while she is breathless.'),
      hm('s3', 'ibuprofen tablet (over the counter)', '400 mg', 'PO', 'PRN', PT, ['hold', 'stop'], 'An NSAID in sepsis risks the kidneys. She told you about it; the pharmacy list never would have.', { tags: ['nsaid'], askedBy: OTC, answer: 'Ibuprofen, two of the little brown ones, when my back aches. Most days this last week, with the fever.' }),
      hm('s4', 'sertraline tablet', '50 mg', 'PO', 'Daily', PHARM, ['continue'], 'Stopping an antidepressant abruptly causes withdrawal. It is continued.'),
    ],
    p3: [   // Whitfield: day 1 after hip replacement, on warfarin
      hm('w1', 'warfarin tablet', '5 mg', 'PO', 'Daily', PHARM, ['continue', 'change'], 'Warfarin continues after surgery, with the dose set by the INR.', { catId: 'warfarin' }),
      hm('w2', 'amlodipine tablet', '5 mg', 'PO', 'Daily', PHARM, ['continue', 'hold'], 'Continue if his blood pressure allows; hold if it is low after the blood loss.', { catId: 'amlodipine' }),
      hm('w3', 'naproxen tablet (over the counter)', '220 mg', 'PO', 'BID', PT, ['stop'], 'Naproxen with warfarin, two days after surgery, is a bleeding risk. It stops.', { tags: ['nsaid'], askedBy: OTC, answer: 'Aleve, for the hip, morning and night. It was the only thing that let me sleep before the operation.' }),
    ],
    p4: [   // Kahale: DKA, type 1 diabetes; the two sources disagree on her long-acting insulin
      hm('k1', 'insulin glargine', '18 units (pharmacy) — she says 22 units', 'SUBQ', 'Nightly', `${PHARM} and ${PT}`, ['change'], 'The sources disagree. Confirm the dose she really takes, then restart long-acting insulin at that dose before the drip stops.', { catId: 'glargine' }),
      hm('k2', 'insulin lispro', 'about 6 units with meals', 'SUBQ', 'TID with meals', PHARM, ['hold', 'change'], 'Mealtime insulin waits while she is on the drip and not eating; it restarts with meals.'),
    ],
    p5: [   // Chen: bleeding duodenal ulcer, DNR/DNI
      hm('c1', 'naproxen tablet (over the counter)', '220 mg', 'PO', 'BID', 'Patient’s daughter', ['stop'], 'Naproxen caused his ulcer. It stops, for good, and he needs to be told why.', { tags: ['nsaid'], askedBy: OTC, answer: 'My daughter buys me the naproxen for my knees. Two a day, for months now. Is that a problem?' }),
      hm('c2', 'omeprazole capsule', '20 mg', 'PO', 'Daily', PHARM, ['change', 'hold', 'stop'], 'He is on IV pantoprazole now; the tablet is replaced, not doubled.'),
      hm('c3', 'amlodipine tablet', '5 mg', 'PO', 'Daily', PHARM, ['hold'], 'His blood pressure was low after the bleed. It is held until he is stable.', { catId: 'amlodipine' }),
    ],
    p6: [   // Kowalski: COPD exacerbation, on prednisone
      hm('o1', 'tiotropium inhaler', '18 mcg', 'Inhaled', 'Daily', PHARM, ['continue'], 'Her long-acting inhaler continues alongside the nebulizers.'),
      hm('o2', 'fluticasone-salmeterol inhaler', '250/50 mcg', 'Inhaled', 'BID', PHARM, ['continue', 'hold'], 'Usually continued; some teams hold it while on scheduled nebulizers and steroids.'),
      hm('o3', 'prednisone tablet (long-term)', '5 mg', 'PO', 'Daily', PHARM, ['change'], 'She is on 40 mg for the flare. Her usual 5 mg is replaced by the higher dose, not added to it, and must not simply stop.', { catId: 'prednisone' }),
    ],
    p8: [   // Kealoha (chest pain case): one pill on no list, found only by asking
      hm('e1', 'amlodipine tablet', '10 mg', 'PO', 'Daily', 'Emergency department triage list', ['continue', 'hold'], 'Continued if the blood pressure allows; a beta blocker is the drug a heart attack needs.', { catId: 'amlodipine' }),
      hm('e4', 'atorvastatin tablet', '40 mg', 'PO', 'Nightly', 'Emergency department triage list', ['continue', 'change'], 'Continued, or raised to 80 mg: a heart attack calls for a high-intensity statin.', { catId: 'atorvastatin' }),
      hm('e2', 'metformin tablet', '1,000 mg', 'PO', 'BID', 'Emergency department triage list', ['hold'], 'Held before a likely angiogram with contrast.', { catId: 'metformin' }),
      hm('e3', 'sildenafil tablet', '50 mg (took one last night)', 'PO', 'PRN', 'Patient, when asked', ['hold', 'stop'], 'No nitrates for 24 hours after sildenafil. It must be on the list so the advisory can protect him.', { tags: ['pde5'], askedBy: 'Do you take anything else, even pills you only take now and then?' }),
    ],
    p9: [   // Nakoa: low glucose on a sulfonylurea, not eating, kidneys worse (case: She is not making sense)
      hm('n1', 'insulin glargine', '24 units', 'SUBQ', 'Nightly', PHARM, ['change', 'hold'], 'She is barely eating and her kidneys are worse. The full dose of long-acting insulin is too much now.', { catId: 'glargine' }),
      hm('n2', 'glipizide tablet', '10 mg', 'PO', 'BID', PHARM, ['stop', 'hold'], 'Glipizide with no food and failing kidneys is the cause of the low glucose. It does not continue.'),
      hm('n3', 'lisinopril tablet', '20 mg', 'PO', 'Daily', PHARM, ['hold'], 'Her creatinine is up and her blood pressure is 104/60. It is held.', { catId: 'lisinopril' }),
      hm('n4', 'acetaminophen tablet', '650 mg', 'PO', 'PRN', PHARM, ['continue'], 'Safe to continue as needed.', { catId: 'acetaminophen' }),
    ],
    p11: [   // Tavares: two days after bowel surgery, a pulmonary embolism, creatinine 2.3 (case: Day two after surgery)
      hm('t1', 'estradiol tablet (hormone replacement)', '1 mg', 'PO', 'Daily', PT, ['stop', 'hold'], 'Oral estrogen raises the risk of clots. After surgery, and now with a clot, it stops.'),
      hm('t2', 'amlodipine tablet', '5 mg', 'PO', 'Daily', PHARM, ['continue', 'hold'], 'Continue if her blood pressure allows.', { catId: 'amlodipine' }),
      hm('t3', 'omeprazole capsule', '20 mg', 'PO', 'Daily', PHARM, ['continue', 'change'], 'Continued, or given as pantoprazole while she cannot take tablets.'),
    ],
    p12: [   // Ito: delirium from a full bladder and a new anticholinergic (case: Sundown)
      hm('i1', 'tamsulosin capsule', '0.4 mg', 'PO', 'Nightly', 'His daughter, who keeps his pills', ['continue'], 'His prostate is the reason he cannot pass water. Stopping tamsulosin in hospital makes retention more likely.'),
      hm('i2', 'amlodipine tablet', '5 mg', 'PO', 'Daily', PHARM, ['continue', 'hold'], 'Continue if his blood pressure allows; hold while he is septic and dry.', { catId: 'amlodipine' }),
      hm('i3', 'acetaminophen tablet', '650 mg', 'PO', 'PRN', PHARM, ['continue'], 'Pain is a cause of delirium. Regular acetaminophen helps.', { catId: 'acetaminophen' }),
    ],
    p13: [   // Fonoti: iron deficiency anemia, transfusion (case: The second unit)
      hm('f1', 'amlodipine tablet', '5 mg', 'PO', 'Daily', PHARM, ['continue', 'hold'], 'Continue if his blood pressure allows.', { catId: 'amlodipine' }),
      hm('f2', 'allopurinol tablet', '300 mg', 'PO', 'Daily', PHARM, ['continue'], 'Nothing in this admission is a reason to stop it.'),
    ],
    p14: [   // Alapai: vomiting, low potassium, kidney injury, atrial fibrillation (case: A fast, irregular pulse)
      hm('l1', 'hydrochlorothiazide tablet', '25 mg', 'PO', 'Daily', PHARM, ['hold', 'stop'], 'A thiazide lowered her potassium and her kidneys are dry. It is held.'),
      hm('l2', 'alendronate tablet', '70 mg', 'PO', 'Weekly', PHARM, ['continue', 'hold'], 'Continue, or hold while she is vomiting: it has to be taken upright with water.'),
      hm('l3', 'calcium and vitamin D tablet', '1 tablet', 'PO', 'Daily', PT, ['continue'], 'Safe to continue.'),
    ],
  };
  /* What a discharge from each patient's admission should leave her with (only Kahale is sent home in this build). */
  const DISCHARGE_KEY = {
    p4: { stop: [/insulin regular|insulin infusion|insulin drip|insulin_gtt/i], rx: [[/glargine|lantus/i, 'long-acting insulin'], [/lispro|humalog/i, 'mealtime insulin'], [/needle/i, 'pen needles'], [/strip|meter|glucometer|lancet/i, 'glucose test strips']] },
  };

  const asked = (p, text) => (E.db.inbox || []).some((m) => m.patientId === p.id && (m.thread || []).some((t) => t.who === 'you' && String(t.text).trim().toLowerCase() === String(text).trim().toLowerCase()));
  /** The home medicines the record knows about now. One heard only by asking appears once the learner has asked. */
  E.homeMeds = (p) => (p && E.HOME_MEDS[p.id] ? E.HOME_MEDS[p.id].filter((h) => !h.askedBy || asked(p, h.askedBy)) : []);

  /* The advisory a home medicine makes possible: a nitrate after a PDE-5 inhibitor. Called by E.checkDraft (js/clinical.js). */
  E.homeMedAdvisories = (p, tags) => {
    const out = [], home = E.homeMeds(p);   // a medicine taken last night still counts, whatever the plan for it now
    const pde5 = home.find((h) => (h.tags || []).includes('pde5'));
    if (tags.includes('nitrate') && pde5) out.push(['high', 'Interaction', 'Nitrate after a PDE-5 inhibitor', `Home medicines include ${pde5.name} (${pde5.dose}). A nitrate within 24 hours of sildenafil (48 hours of tadalafil) can drop the blood pressure dangerously.`]);
    const nsaid = home.find((h) => (h.tags || []).includes('nsaid'));
    if (nsaid && (tags.includes('anticoag') || tags.includes('warfarin'))) out.push(['med', 'Interaction', 'Home NSAID with an anticoagulant', `Home medicines include ${nsaid.name}. Make sure it is stopped before anticoagulation continues.`]);
    return out;
  };

  /* =====================================================================================================
     2. STATE (on the patient, while the ward lasts; a finished reconciliation is copied to the learner's record)
     ===================================================================================================== */
  const mr = (p) => p.medrec || (p.medrec = { admit: { choices: {} }, discharge: { choices: {}, rx: [] } });
  const pr = () => E.progress();
  const recList = (k) => { const x = pr(); if (!Array.isArray(x[k])) x[k] = []; return x[k]; };
  const CHOICES = { admit: [['continue', 'Continue'], ['hold', 'Hold'], ['stop', 'Stop'], ['change', 'Change']], dischargeHome: [['resume', 'Resume'], ['stop', 'Stop'], ['change', 'Change (prescribe)']], dischargeInpt: [['stop', 'Stop at discharge'], ['prescribe', 'Prescribe']] };
  const inptMeds = (p) => p.orders.filter((o) => o.type === 'med' && o.status === 'Active');
  /** Words a prescription must not use (the Joint Commission's "do not use" list, in short). */
  const BAD = [[/\bq\.?d\.?\b/i, 'Write "daily", not QD.'], [/\bq\.?o\.?d\.?\b/i, 'Write "every other day", not QOD.'], [/\d\s*[uU]\b|\bIU\b/, 'Write "units" in full.'], [/\d\.0\b/, 'No trailing zero: write 1 mg, not 1.0 mg.'], [/(^|[^\d])\.\d/, 'Put a zero before a decimal point: 0.5, not .5.']];
  E.rxProblems = (rx) => {
    const text = [rx.drug, rx.dose, rx.freq, rx.sig].join(' ');
    const unsafe = BAD.filter(([re]) => re.test(text)).map(([, t]) => t);
    const incomplete = [];
    if (!rx.drug) incomplete.push('the drug');
    if (!rx.dose) incomplete.push('the dose');
    if (!rx.quantity) incomplete.push('a dispense quantity');
    if (rx.refills === '' || rx.refills == null) incomplete.push('the number of refills');
    if (!rx.sig || rx.sig.trim().split(/\s+/).length < 4 || /as directed/i.test(rx.sig)) incomplete.push('instructions the patient can follow (not "as directed")');
    return { unsafe, incomplete };
  };

  /* =====================================================================================================
     3. VIEW: the Med Rec activity
     ===================================================================================================== */
  const sel = (name, list, val, attrs) => `<select data-change="mrChoice" ${attrs}><option value="">— choose —</option>${list.map(([v, t]) => `<option value="${v}"${v === val ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  V.act.medrec = (p) => {
    const st = mr(p), home = E.homeMeds(p), mode = E.ui.mrMode === 'discharge' ? 'discharge' : 'admit';
    const tabs = `<div class="subtabs" role="tablist">${[['admit', 'Admission'], ['discharge', 'Discharge']].map(([id, t]) => `<button role="tab" aria-selected="${mode === id}" class="${mode === id ? 'on' : ''}" data-act="mrMode" data-id="${id}">${t}${st[id].done ? ' ' + chip('Done', 'green') : ''}</button>`).join('')}</div>`;
    if (!home.length && mode === 'admit') return `<div class="pane">${tabs}<p class="muted">No home medicines are recorded for ${esc(p.name)}.</p></div>`;
    if (mode === 'admit') {
      const done = st.admit.done;
      const rows = home.map((h) => { const c = st.admit.choices[h.id] || {}; return `<tr><td><b>${esc(h.name)}</b><div class="muted">${esc(h.dose)} · ${esc(h.route)} · ${esc(h.freq)}</div></td><td>${esc(h.source)}</td>
        <td>${done ? esc((CHOICES.admit.find((x) => x[0] === c.choice) || [, ''])[1]) + (c.choice === 'continue' || c.choice === 'change' ? onMar(p, h) : '') : sel('mrChoice', CHOICES.admit, c.choice, `data-mode="admit" data-id="${h.id}" aria-label="Decision for ${esc(h.name)}"`)}</td>
        <td>${done ? esc(c.why || '') : `<input data-input="mrWhy" data-mode="admit" data-id="${h.id}" value="${esc(c.why || '')}" maxlength="160" aria-label="Reason for ${esc(h.name)}"${c.choice && c.choice !== 'continue' ? '' : ' placeholder="Reason, if not continued"'}>`}</td></tr>`; }).join('');
      return `<div class="pane">${tabs}<div class="toolbar"><b>Home medicines on admission</b><span class="muted">${esc(p.name)}</span><span class="spacer"></span>${done ? `${chip(`Reviewed by ${done.by}`, 'green')}` : `<button class="btn primary xs" data-act="mrSubmit" data-mode="admit">Mark reviewed</button>`}</div>
        <table class="tbl mr"><thead><tr><th>Medicine</th><th>Source</th><th>Decision</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table>
        ${done && done.feedback ? `<p class="fb"><b>${esc(p.attending)}:</b> ${esc(done.feedback)}</p>` : ''}</div>`;
    }
    const done = st.discharge.done, dc = st.discharge;
    const row = (kind, id, name, how, list) => { const c = dc.choices[id] || {}; return `<tr><td><b>${esc(name)}</b><div class="muted">${esc(how)}</div></td><td>${kind}</td><td>${done ? esc((list.find((x) => x[0] === c.choice) || [, ''])[1]) : sel('mrChoice', list, c.choice, `data-mode="discharge" data-id="${esc(id)}" aria-label="Decision for ${esc(name)}"`)}</td></tr>`; };
    const rows = home.map((h) => row('Home', h.id, h.name, `${h.dose} · ${h.route} · ${h.freq}`, CHOICES.dischargeHome)).join('') + inptMeds(p).map((o) => row('Inpatient', o.id, o.name, E.orderDetail(o), CHOICES.dischargeInpt)).join('');
    const f = (rx, k, label, w) => `<label class="rx-f"${w ? ` style="grid-column:span ${w}"` : ''}>${label}<input data-input="rxField" data-i="${rx.i}" data-k="${k}" value="${esc(rx[k] == null ? '' : rx[k])}" maxlength="${k === 'sig' ? 200 : 60}"${done ? ' disabled' : ''}></label>`;
    const rxs = dc.rx.map((rx, i) => Object.assign({ i }, rx)).map((rx) => `<fieldset class="rx"><legend>Prescription ${rx.i + 1}${done ? '' : ` <button class="btn xs" data-act="rxRemove" data-i="${rx.i}">Remove</button>`}</legend>
      ${f(rx, 'drug', 'Drug', 2)}${f(rx, 'dose', 'Dose')}${f(rx, 'route', 'Route')}${f(rx, 'freq', 'How often')}${f(rx, 'quantity', 'Dispense')}${f(rx, 'refills', 'Refills')}${f(rx, 'sig', 'Instructions for the patient', 4)}</fieldset>`).join('');
    return `<div class="pane">${tabs}<div class="toolbar"><b>Discharge medicines</b><span class="muted">${esc(p.name)}</span><span class="spacer"></span>${done ? chip(`Reviewed by ${done.by}`, 'green') : `<button class="btn primary xs" data-act="mrSubmit" data-mode="discharge">Complete discharge reconciliation</button>`}</div>
      <table class="tbl mr"><thead><tr><th>Medicine</th><th>From</th><th>At discharge</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="muted">No medicines</td></tr>'}</tbody></table>
      <h4>Prescriptions</h4>${rxs || '<p class="muted">None yet.</p>'}${done ? '' : `<button class="btn xs" data-act="rxAdd">${icon('add', 16)}Add a prescription</button>`}
      <div id="modalErr" class="err" role="alert"></div>
      ${done && done.feedback ? `<p class="fb"><b>${esc(p.attending)}:</b> ${esc(done.feedback)}</p>` : ''}</div>`;
  };

  /* =====================================================================================================
     4. INPUTS AND ACTIONS
     ===================================================================================================== */
  /* Med Rec and the MAR point at each other. While the admission reconciliation is not done, the MAR and Orders say
     so, as Epic does; a continued home medicine links to its line on the MAR; and once discharge decisions are made,
     each inpatient medicine on the MAR shows what happens to it at discharge. */
  E.medrecPending = (p) => !!(p && E.homeMeds(p).length && !mr(p).admit.done);
  const pendingBar = (p) => (E.medrecPending(p) ? `<div class="notice info mr-due">${icon('mar', 24)}<span>Home medicines have not been reconciled for this admission.</span><a class="btn xs" href="#/pt/${p.id}/medrec" data-act="mrMode" data-id="admit">Go to Med Rec</a></div>` : '');
  ['mar', 'orders'].forEach((a) => { const base = V.act[a]; V.act[a] = (p) => pendingBar(p) + base(p); });
  V.marTag = (p, o) => {
    const c = p.medrec && p.medrec.discharge.choices[o.id], t = c && (CHOICES.dischargeInpt.find((x) => x[0] === c.choice) || [])[1];
    return t ? `<div><a class="chip ${c.choice === 'stop' ? 'grey' : 'blue'}" href="#/pt/${p.id}/medrec" data-act="mrMode" data-id="discharge">Discharge: ${esc(t)}</a></div>` : '';
  };
  const onMar = (p, h) => {
    if (!h.catId) return '';
    if (E.liveOrders(p).some((o) => o.catId === h.catId)) return ` <a href="#/pt/${p.id}/mar">See on MAR</a>`;
    return p.drafts.some((o) => o.catId === h.catId) ? ` <a href="#/pt/${p.id}/orders">Unsigned order: sign it in Orders</a>` : '';
  };
  const cur = () => E.app.curPt();
  E.changeExt = Object.assign(E.changeExt || {}, {
    mrChoice(el) {
      const p = cur(), st = mr(p), mode = el.dataset.mode, id = el.dataset.id, c = st[mode].choices[id] || (st[mode].choices[id] = {});
      c.choice = el.value;
      // a discharge "change" or "prescribe" starts a prescription from the medicine, to be completed
      if (mode === 'discharge' && (el.value === 'change' || el.value === 'prescribe') && !st.discharge.rx.some((r) => r.from === id)) {
        const h = E.homeMeds(p).find((x) => x.id === id), o = p.orders.find((x) => x.id === id), src = h || o;
        st.discharge.rx.push({ from: id, drug: src ? src.name.replace(/\s*\(.*?\)\s*/g, ' ').trim() : '', dose: o ? o.dose : '', route: src ? src.route : '', freq: o ? o.freq : (h ? h.freq : ''), quantity: '', refills: '', sig: '' });
      }
      E.save(); E.app.render();
    },
  });
  E.inputExt = Object.assign(E.inputExt || {}, {
    mrWhy(el) { const st = mr(cur()), c = st[el.dataset.mode].choices[el.dataset.id] || (st[el.dataset.mode].choices[el.dataset.id] = {}); c.why = el.value.slice(0, 160); E.save(); },
    rxField(el) { const rx = mr(cur()).discharge.rx[Number(el.dataset.i)]; if (rx) { rx[el.dataset.k] = el.value; E.save(); } },
  });
  const err = (t) => { const el = document.getElementById('modalErr'); if (el) el.textContent = t; };
  const later = (ms, msg) => recList('speakQueue').push({ due: Date.now() + ms, msg });
  E.medrecActions = {
    mrMode(d) { E.ui.mrMode = d.id; E.app.render(); },
    rxAdd() { mr(cur()).discharge.rx.push({ drug: '', dose: '', route: 'PO', freq: '', quantity: '', refills: '0', sig: '' }); E.save(); E.app.render(); },
    rxRemove(d) { const st = mr(cur()); st.discharge.rx.splice(Number(d.i), 1); E.save(); E.app.render(); },
    mrSubmit(d) {
      const p = cur(), st = mr(p), mode = d.mode === 'discharge' ? 'discharge' : 'admit', u = E.db.user;
      if (st[mode].done) return;
      if (mode === 'admit') {
        const home = E.homeMeds(p), none = home.filter((h) => !(st.admit.choices[h.id] || {}).choice);
        if (none.length) return E.app.status(`Choose a decision for ${none.map((h) => h.name).join(', ')}.`);
        const noWhy = home.filter((h) => { const c = st.admit.choices[h.id]; return c.choice !== 'continue' && !(c.why || '').trim(); });
        if (noWhy.length) return E.app.status(`Give a reason for ${noWhy.map((h) => h.name).join(', ')}.`);
        // continued medicines become unsigned inpatient orders, unless one is already live
        let added = 0;
        home.forEach((h) => { const c = st.admit.choices[h.id]; if ((c.choice === 'continue' || c.choice === 'change') && h.catId && E.cat(h.catId) && !E.liveOrders(p).some((o) => o.catId === h.catId) && !p.drafts.some((o) => o.catId === h.catId)) { p.drafts.push(E.newOrder(h.catId)); added++; } });
        const missed = home.filter((h) => !h.ok.includes(st.admit.choices[h.id].choice));
        const feedback = missed.length ? `Reviewed. I would change ${missed.length === 1 ? 'one decision' : `${missed.length} decisions`}: ${missed.map((h) => `${h.name}: ${h.why}`).join(' ')}` : 'Reviewed. Every home medicine has a decision I agree with, and a reason where it was not continued.';
        st.admit.done = { by: E.CONFIG && E.CONFIG.sim && E.CONFIG.sim.attending === false ? u.name : p.attending, at: Date.now(), feedback };
        recList('medRec').push({ at: Date.now(), patient: p.name, pid: p.id, kind: 'admit', decisions: home.map((h) => ({ med: h.name, source: h.source, choice: st.admit.choices[h.id].choice, reason: st.admit.choices[h.id].why || '' })), missed: missed.map((h) => `${h.name}: ${h.why}`) });
        E.audit('Completed admission medication reconciliation', p.id);
        E.app.track('medrec.admit');
        E.app.status(added ? `Reconciliation saved. ${added} continued medicine${added > 1 ? 's are' : ' is'} in your unsigned orders.` : 'Reconciliation saved.');
        return E.app.commit();
      }
      // discharge
      const rows = E.homeMeds(p).map((h) => ({ id: h.id, name: h.name })).concat(inptMeds(p).map((o) => ({ id: o.id, name: o.name })));
      const none = rows.filter((r) => !(st.discharge.choices[r.id] || {}).choice);
      if (none.length) return E.app.status(`Choose what happens at discharge to ${none.map((r) => r.name).join(', ')}.`);
      const bad = st.discharge.rx.map((rx, i) => ({ i, pb: E.rxProblems(rx) })).filter((x) => x.pb.unsafe.length);
      if (bad.length) return err(bad.map((x) => `Prescription ${x.i + 1}: ${x.pb.unsafe.join(' ')}`).join(' '));
      const key = DISCHARGE_KEY[p.id], missed = [];
      if (key) {
        key.rx.forEach(([re, what]) => { if (!st.discharge.rx.some((rx) => re.test(rx.drug))) missed.push(`No prescription for ${what}.`); });
        inptMeds(p).forEach((o) => { if (key.stop.some((re) => re.test(o.name) || re.test(o.catId)) && st.discharge.choices[o.id].choice !== 'stop') missed.push(`${o.name} cannot go home with her.`); });
      }
      const feedback = missed.length ? `Reviewed. Before she goes: ${missed.join(' ')}` : 'Reviewed. The list she goes home with matches what she needs.';
      st.discharge.done = { by: p.attending, at: Date.now(), feedback };
      const rxRec = st.discharge.rx.map((rx) => { const pb = E.rxProblems(rx); return Object.assign({ at: Date.now(), patient: p.name, complete: !pb.incomplete.length, missing: pb.incomplete }, rx); });
      rxRec.forEach((r) => recList('prescriptions').push(r));
      recList('medRec').push({ at: Date.now(), patient: p.name, pid: p.id, kind: 'discharge', decisions: rows.map((r) => ({ med: r.name, choice: st.discharge.choices[r.id].choice })), missed });
      // the outpatient pharmacist calls back about anything a pharmacy could not fill as written
      rxRec.filter((r) => !r.complete).forEach((r, k) => later(30000 + k * 5000, { type: 'Staff Message', from: 'Lum, Grace PharmD (Kahala Pharmacy)', patientId: p.id, act: 'medrec', subject: `Prescription question — ${p.name}`, body: `Hello, this is Kahala Pharmacy about ${p.name}'s prescription for ${r.drug || 'a medicine'}.\n\nI cannot fill it as written: it is missing ${r.missing.join(', ')}.\n\nPlease send a corrected prescription. The patient is waiting at the counter.` }));
      E.audit(`Completed discharge medication reconciliation (${st.discharge.rx.length} prescription${st.discharge.rx.length === 1 ? '' : 's'})`, p.id);
      st.discharge.rx.forEach((rx) => E.audit(`Prescribed: ${rx.drug || 'unnamed'} ${rx.dose || ''}`.trim(), p.id));
      E.app.track('medrec.discharge');
      if (rxRec.some((r) => r.complete)) E.app.track('rx.write');
      E.app.status('Discharge reconciliation saved.');
      E.app.commit();
    },
  };

  /* A dot phrase for the discharge summary: what the patient goes home on. */
  E.DOT.dischargemeds = (p) => {
    const st = p.medrec && p.medrec.discharge; if (!st) return 'Discharge reconciliation not yet done';
    const home = E.homeMeds(p), lines = [];
    home.forEach((h) => { const c = (st.choices[h.id] || {}).choice; if (c === 'resume') lines.push(`- Continue ${h.name} ${h.dose} ${h.freq}`); if (c === 'stop') lines.push(`- STOP ${h.name}`); });
    st.rx.forEach((rx) => lines.push(`- NEW: ${rx.drug} ${rx.dose} ${rx.route} ${rx.freq}. ${rx.sig}`.trim()));
    return lines.join('\n') || 'No medicines';
  };

  /* =====================================================================================================
     5. REPORT
     ===================================================================================================== */
  const iso = (t) => (t ? new Date(t).toISOString() : null);
  E.medrecReport = (p) => ({
    medRec: (p.medRec || []).map((r) => ({ at: iso(r.at), patient: r.patient, kind: r.kind, decisions: r.decisions, missed: r.missed })),
    prescriptions: (p.prescriptions || []).map((r) => ({ at: iso(r.at), patient: r.patient, drug: r.drug, dose: r.dose, route: r.route, freq: r.freq, quantity: r.quantity, refills: r.refills, sig: r.sig, complete: r.complete })),
  });
})();
