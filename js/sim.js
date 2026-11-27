/* SIM+EHR Student Edition — the simulated hospital around the learner.
   Everything here makes an action in the chart lead to a believable result:
     - study reports written for each patient (no generic placeholder results);
     - lab values and vital signs that respond to the orders that are active;
     - a simulated attending who reviews a student's pended orders and unsigned-for notes, with feedback;
     - consultants who answer a consult order with a note;
     - nurses who acknowledge and carry out nursing and diet orders;
     - a text interview with the patient when video visits are not connected.
   All of it is scripted and simplified for teaching. Timings are in EHR.CONFIG.sim (js/config.js). */
(function () {
  const E = window.EHR;
  const CFG = () => Object.assign({ attending: true, attendingDelay: 40, noteDelay: 60, consultDelay: 45, nursingDelay: 20, vitalsDelay: 30 }, (E.CONFIG && E.CONFIG.sim) || {});
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const first = (p) => p.name.split(', ')[1], last = (p) => p.name.split(', ')[0];
  const activeIds = (p) => p.orders.filter((o) => o.status === 'Active').map((o) => o.catId);
  const hasAny = (ids, list) => list.some((x) => ids.includes(x));
  /** An audit line written by a simulated colleague, not by the learner. */
  const auditAs = (who, action, pid) => E.db.audit.unshift({ ts: Date.now(), user: who, role: 'sim', patientId: pid || null, action });

  /* ================= 1. study reports, per patient ================= */
  const R = (findings, impression) => `FINDINGS:\n${findings}\n\nIMPRESSION:\n${impression}`;
  const CXR = {
    p1: R('Enlarged cardiac silhouette. Bilateral perihilar and basilar interstitial opacities with cephalization of the pulmonary vessels. Small bilateral pleural effusions. No pneumothorax.', '1. Cardiomegaly with pulmonary edema and small bilateral effusions, consistent with decompensated heart failure.\n2. No focal consolidation.'),
    p2: R('Dense airspace consolidation in the right lower lobe with air bronchograms. No pleural effusion. Heart size normal. No pneumothorax.', 'Right lower lobe pneumonia.'),
    p3: R('Lungs are clear. Heart size is at the upper limit of normal. No effusion or pneumothorax. Degenerative change of the thoracic spine.', 'No acute cardiopulmonary process.'),
    p4: R('Lungs are clear. Heart size normal. No effusion, pneumothorax or free air beneath the diaphragm.', 'No acute cardiopulmonary process.'),
    p5: R('Lungs are clear. Heart size normal. Coronary stent noted. No free intraperitoneal air beneath the diaphragm.', '1. No acute cardiopulmonary process.\n2. No free air.'),
    p7: R('Lungs are clear. Heart size normal. No effusion or pneumothorax.', 'No acute cardiopulmonary process.'),
    p6: R('Hyperinflated lungs with flattened hemidiaphragms and increased retrosternal air space. No focal consolidation. No pneumothorax. No effusion.', '1. Emphysematous changes of COPD.\n2. No pneumonia or pneumothorax.'),
  };
  const ECG = {
    p1: 'Sinus rhythm, rate 88. Left ventricular hypertrophy with secondary repolarization changes. Left atrial enlargement. QTc 452 ms.\n\nIMPRESSION: No acute ischemic changes. Unchanged from prior.',
    p2: 'Sinus tachycardia, rate 112. Normal axis and intervals. No ST-segment elevation or depression.\n\nIMPRESSION: Sinus tachycardia, otherwise normal ECG.',
    p3: 'Atrial fibrillation with controlled ventricular response, rate 78. Normal axis. No acute ST-T changes.\n\nIMPRESSION: Atrial fibrillation, rate controlled. No acute changes.',
    p4: 'Sinus tachycardia, rate 108. Normal intervals. T waves upright and not peaked.\n\nIMPRESSION: Sinus tachycardia. No changes of hyperkalemia.',
    p5: 'Sinus tachycardia, rate 104. Old inferior Q waves. No new ST-segment changes.\n\nIMPRESSION: Sinus tachycardia. Old inferior infarct. No acute ischemia.',
    p7: 'Sinus rhythm, rate 84. Normal axis and intervals. No ST-segment changes.\n\nIMPRESSION: Normal ECG.',
    p6: 'Sinus tachycardia, rate 106. Right axis deviation. Peaked P waves in lead II (P pulmonale). Low voltage.\n\nIMPRESSION: Sinus tachycardia with findings of chronic lung disease.',
  };
  const ECHO = {
    p1: R('Left ventricle moderately dilated with severe global hypokinesis; ejection fraction 30%. Grade II diastolic dysfunction with elevated filling pressures. Moderate functional mitral regurgitation. Right ventricular function mildly reduced. Estimated PA systolic pressure 48 mmHg. Inferior vena cava dilated with less than 50% collapse.', '1. Severe LV systolic dysfunction, EF 30%, unchanged.\n2. Moderate mitral regurgitation.\n3. Elevated right atrial pressure, consistent with volume overload.'),
    p5: R('Normal left ventricular size. Ejection fraction 55%. Mild inferior wall hypokinesis. No significant valvular disease. No pericardial effusion.', 'Preserved LV systolic function with a small inferior wall motion abnormality, consistent with prior infarct.'),
    '*': R('Normal left ventricular size and systolic function; ejection fraction 60%. Normal right ventricular size and function. No significant valvular disease. No pericardial effusion.', 'Normal transthoracic echocardiogram.'),
  };
  const OTHER = {
    cthead: { '*': R('No acute intracranial hemorrhage, mass effect or midline shift. Gray-white differentiation preserved. Ventricles and sulci appropriate for age.', 'No acute intracranial abnormality.') },
    ctpe: {
      p2: R('No filling defect in the pulmonary arteries to the segmental level. Right lower lobe consolidation with air bronchograms. No effusion.', '1. No pulmonary embolism.\n2. Right lower lobe pneumonia.'),
      p6: R('No filling defect in the pulmonary arteries. Moderate centrilobular emphysema, upper lobe predominant. Bronchial wall thickening. No consolidation.', '1. No pulmonary embolism.\n2. Emphysema with bronchial wall thickening.'),
      p5: 'NOTE FROM RADIOLOGY: This patient has a documented hives reaction to iodinated contrast. The study was performed after the ordering team confirmed premedication.\n\n' + R('No filling defect in the pulmonary arteries. Lungs clear.', 'No pulmonary embolism.'),
      '*': R('No filling defect in the pulmonary arteries to the segmental level. Lungs clear. No effusion.', 'No pulmonary embolism.'),
    },
    ctap: {
      p4: R('Liver, gallbladder, pancreas, spleen and kidneys are unremarkable. Appendix normal. No bowel obstruction, free fluid or free air.', 'No acute abdominal or pelvic abnormality. Abdominal pain is not explained by a surgical cause.'),
      p5: 'NOTE FROM RADIOLOGY: This patient has a documented hives reaction to iodinated contrast. The study was performed after the ordering team confirmed premedication.\n\n' + R('Wall thickening and mucosal hyperenhancement of the duodenal bulb. No active contrast extravasation. No free air or free fluid.', '1. Duodenal bulb inflammation consistent with the known ulcer.\n2. No active bleeding or perforation seen.'),
      '*': R('Solid organs unremarkable. No bowel obstruction, free fluid or free air.', 'No acute abdominal or pelvic abnormality.'),
    },
    usruq: { '*': R('Gallbladder is normal without stones, wall thickening or pericholecystic fluid. Common bile duct 3 mm. Liver echotexture normal.', 'Normal right upper quadrant ultrasound.') },
    bcx: {
      p2: 'PRELIMINARY (Gram stain of positive bottle):\nBottle 1 of 2: gram-positive cocci in pairs.\nBottle 2 of 2: no growth to date.\n\nIdentification and susceptibilities to follow. Laboratory called the result to the unit.',
      '*': 'PRELIMINARY: No growth to date in 2 of 2 bottles.\nFinal report to follow at 5 days.',
    },
    ua: {
      p4: 'Color: yellow. Clarity: clear.\nSpecific gravity 1.030, pH 5.0.\nGlucose: 3+. Ketones: 3+.\nProtein, blood: negative.\nLeukocyte esterase: negative. Nitrite: negative.',
      '*': 'Color: yellow. Clarity: clear.\nSpecific gravity 1.015, pH 6.0.\nProtein, glucose, ketones, blood: negative.\nLeukocyte esterase: negative. Nitrite: negative.',
    },
  };
  /** The report text for a study on this patient. */
  E.simReport = (p, c) => {
    const id = c.id, by = id === 'cxr1' || id === 'cxr2' ? CXR : id === 'ecg' ? ECG : id === 'echo' ? ECHO : OTHER[id];
    const body = (by && (by[p.id] || by['*'])) || String(c.report || 'Study completed. No acute findings.').replace(/SANDBOX AUTO-RESULT\n\n/, '').replace(/\n*\((This is a generic placeholder[^)]*|Sandbox auto-result\.)\)/i, '');
    return `${c.name.toUpperCase()}\nPatient: ${p.name} · MRN ${p.mrn}\nIndication: ${p.cc}\n\n${body}\n\n(Simulated report for training.)`;
  };

  /* ================= 2. labs respond to active orders ================= */
  // [component, order ids that move it, change, limit it moves toward, plain reason]
  const FURO = ['furosemide_iv', 'furosemide_po'], INS = ['insulin_gtt'], FLUID = ['ns_bolus', 'lr', 'ns', 'd5halfns_k'], ABX = ['ceftriaxone', 'azithromycin', 'levofloxacin', 'doxycycline', 'cefepime', 'piptazo', 'vancomycin', 'amoxclav', 'ampsulb', 'cefazolin'];
  const LAB_RULES = [
    ['K', ['kcl_po', 'd5halfns_k'], +0.4, 5.3, 'potassium replacement'], ['K', FURO, -0.3, 3.0, 'loop diuretic'], ['K', INS, -0.4, 3.1, 'insulin infusion'], ['K', ['spironolactone', 'lisinopril', 'losartan', 'tmpsmx'], +0.3, 5.8, 'a potassium-raising drug'],
    ['Cr', ['ibuprofen', 'ketorolac', 'vancomycin'], +0.3, 4.0, 'a nephrotoxic drug'], ['Cr', FURO, +0.1, 3.0, 'diuresis'],
    ['Glu', INS, -90, 150, 'insulin infusion'], ['Glu', ['lispro_ss', 'glargine'], -40, 120, 'insulin'], ['Glu', ['prednisone'], +50, 320, 'steroid'],
    ['AG', INS, -5, 10, 'insulin infusion'], ['BHB', INS, -1.5, 0.3, 'insulin infusion'], ['HCO3', INS, +4, 24, 'insulin infusion'], ['CO2', INS, +4, 24, 'insulin infusion'], ['pH', INS, +0.06, 7.4, 'insulin infusion'],
    ['Hgb', ['prbc'], +1.0, 11, 'red cell transfusion'], ['Hct', ['prbc'], +3, 33, 'red cell transfusion'],
    ['Mg', ['mag_iv'], +0.4, 2.3, 'magnesium replacement'], ['Lactate', FLUID, -0.8, 1.0, 'IV fluids'], ['BUN', FLUID, -4, 14, 'IV fluids'],
    ['BNP', FURO, -220, 300, 'diuresis'], ['WBC', ABX, -1.6, 8, 'antibiotics'], ['PCT', ABX, -0.6, 0.1, 'antibiotics'],
    ['INR', ['warfarin'], +0.3, 3.2, 'warfarin'],
  ];
  /** Next value of a lab component, moved by what is ordered. Returns { value, why[] }. */
  E.simLab = (p, k, base) => {
    const ids = activeIds(p).concat(p.orders.filter((o) => o.status === 'Completed' && o.signedTs > Date.now() - 6 * E.HOUR).map((o) => o.catId)), why = [];
    let v = base;
    LAB_RULES.forEach(([c, list, d, lim, reason]) => {
      if (c !== k || !hasAny(ids, list)) return;
      const nv = d > 0 ? Math.min(Math.max(v, lim), v + d) : Math.max(Math.min(v, lim), v + d);
      if (nv !== v) { v = nv; why.push(reason); }
    });
    // teaching interaction: an interacting antibiotic on top of warfarin sends the INR up
    if (k === 'INR' && ids.includes('warfarin') && hasAny(ids, ['tmpsmx', 'metronidazole'])) { v = Math.min(5.2, v + 1.2); why.push('warfarin with an interacting antibiotic'); }
    // prerenal kidney injury improves with fluids
    if (k === 'Cr' && p.problems.some((x) => /prerenal/i.test(x.name)) && hasAny(ids, FLUID) && v > 0.9) { v = Math.max(0.9, v - 0.3); why.push('IV fluids'); }
    return { value: v, why };
  };

  /* ================= 3. vital signs respond to orders ================= */
  const VIT_RULES = {
    o2: (v) => { v.spo2 = clamp(v.spo2 + 4, 0, 97); if (/room air/i.test(v.o2)) v.o2 = '2 L NC'; }, vs_q4: () => {}, tele: () => {},
    acetaminophen: (v) => { v.temp = +Math.max(37.0, v.temp - 0.8).toFixed(1); v.pain = Math.max(0, v.pain - 1); },
    oxycodone: (v) => { v.pain = Math.max(2, v.pain - 4); v.rr = Math.max(11, v.rr - 2); }, morphine: (v) => { v.pain = Math.max(1, v.pain - 5); v.rr = Math.max(10, v.rr - 3); },
    ibuprofen: (v) => { v.pain = Math.max(2, v.pain - 3); }, ketorolac: (v) => { v.pain = Math.max(2, v.pain - 4); },
    ns_bolus: (v) => { v.sbp = Math.min(Math.max(v.sbp, 128), v.sbp + 14); v.dbp = Math.min(Math.max(v.dbp, 78), v.dbp + 6); v.hr = Math.max(Math.min(v.hr, 72), v.hr - 12); },
    lr: (v) => { v.sbp = Math.min(Math.max(v.sbp, 124), v.sbp + 8); v.hr = Math.max(Math.min(v.hr, 74), v.hr - 8); },
    prbc: (v) => { v.sbp = Math.min(Math.max(v.sbp, 124), v.sbp + 10); v.hr = Math.max(Math.min(v.hr, 76), v.hr - 10); },
    metoprolol: (v) => { v.hr = Math.max(Math.min(v.hr, 60), v.hr - 12); v.sbp = Math.max(Math.min(v.sbp, 104), v.sbp - 8); }, carvedilol: (v) => { v.hr = Math.max(Math.min(v.hr, 60), v.hr - 10); v.sbp = Math.max(Math.min(v.sbp, 104), v.sbp - 10); },
    amlodipine: (v) => { v.sbp = Math.max(Math.min(v.sbp, 118), v.sbp - 12); v.dbp = Math.max(Math.min(v.dbp, 70), v.dbp - 6); }, losartan: (v) => { v.sbp = Math.max(Math.min(v.sbp, 118), v.sbp - 10); },
    furosemide_iv: (v) => { v.spo2 = Math.min(Math.max(v.spo2, 96), v.spo2 + 2); v.rr = Math.max(Math.min(v.rr, 16), v.rr - 3); v.sbp = Math.max(Math.min(v.sbp, 110), v.sbp - 6); },
    albuterol: (v) => { v.spo2 = Math.min(Math.max(v.spo2, 95), v.spo2 + 2); v.rr = Math.max(Math.min(v.rr, 16), v.rr - 3); v.hr = Math.min(118, v.hr + 6); },
    duoneb: (v) => { v.spo2 = Math.min(Math.max(v.spo2, 95), v.spo2 + 3); v.rr = Math.max(Math.min(v.rr, 16), v.rr - 4); v.hr = Math.min(118, v.hr + 4); },
  };
  const jit = (n, a) => Math.round(n + (Math.random() - 0.5) * a);
  function vitalsAfter(p, orders) {
    const b = E.lastVitals(p); if (!b) return null;
    const v = { ts: Date.now(), by: p.rn, temp: b.temp, hr: jit(b.hr, 3), rr: b.rr, sbp: jit(b.sbp, 4), dbp: jit(b.dbp, 3), spo2: b.spo2, o2: b.o2, pain: b.pain, sim: orders.map((o) => o.name).join(', ') };
    orders.forEach((o) => VIT_RULES[o.catId](v));
    if (v.dbp >= v.sbp) v.dbp = v.sbp - 20;
    p.vitals.push(v);
    return v;
  }

  /* ================= 4. consultants ================= */
  const CONSULT = {
    c_cards: ['Cardiology', 'Dr. Nakamura', (p) => `1. Continue IV loop diuretic; aim for net negative 1 to 2 L per day with daily weights and strict intake and output.\n2. Daily BMP and magnesium while diuresing; keep potassium above 4.0 and magnesium above 2.0.\n3. Continue beta blocker if blood pressure allows; do not start in frank decompensation.\n4. ${E.allergiesOf(p).some((a) => a.cls === 'acei') ? 'ACE inhibitor allergy (angioedema) noted: avoid ACE inhibitors; discuss alternatives as an outpatient.' : 'Review guideline-directed medical therapy before discharge.'}\n5. Telemetry.`],
    c_id: ['Infectious Diseases', 'Dr. Adeyemi', (p) => `1. ${E.allergiesOf(p).some((a) => a.cls === 'penicillin') ? 'Documented anaphylaxis to penicillins: avoid all penicillins. Use a respiratory fluoroquinolone, or a third-generation cephalosporin only after reviewing the reaction history with the team.' : 'Current empiric coverage is appropriate.'}\n2. Follow blood and sputum cultures; narrow therapy once susceptibilities return.\n3. Trend white cell count and procalcitonin; plan 5 to 7 days of total therapy if improving.\n4. Maintain isolation precautions as ordered.`],
    c_neph: ['Nephrology', 'Dr. Okafor', () => '1. Avoid nephrotoxins: no NSAIDs, and weigh the need for iodinated contrast.\n2. Dose all medications for current kidney function.\n3. Daily BMP, strict intake and output, daily weights.\n4. Hold potassium-raising drugs if potassium is 5.0 or higher.\n5. No indication for dialysis at this time.'],
    c_gi: ['Gastroenterology', 'Dr. Fernandez', (p) => `1. Keep NPO after midnight for upper endoscopy.\n2. Continue IV proton pump inhibitor.\n3. Hold all NSAIDs, aspirin and anticoagulants; ${p.codeStatus === 'Full Code' ? '' : 'code status reviewed and noted; '}two large-bore IVs.\n4. CBC every 6 to 8 hours; transfuse for hemoglobin below 7 g/dL (below 8 with coronary disease).\n5. Call GI for hemodynamic change or recurrent bleeding.`],
    c_endo: ['Endocrinology', 'Dr. Petrov', () => '1. Continue insulin infusion until the anion gap is closed on two checks and the patient is eating.\n2. Overlap subcutaneous basal insulin by 2 hours before stopping the infusion.\n3. Potassium replacement to keep potassium 4.0 to 5.0 while on insulin.\n4. Point-of-care glucose every hour on the infusion.\n5. Diabetes education before discharge.'],
    c_pulm: ['Pulmonology', 'Dr. Haddad', () => '1. Scheduled short-acting bronchodilators; systemic steroid for 5 days.\n2. Titrate oxygen to SpO2 88 to 92%; avoid over-oxygenation.\n3. Blood gas if drowsy or if work of breathing increases; low threshold for non-invasive ventilation.\n4. Smoking cessation counselling and nicotine replacement.\n5. Review inhaler technique before discharge.'],
    c_ptot: ['Physical and Occupational Therapy', 'Mele Kaneshiro, PT', () => '1. Evaluated at the bedside. Patient needs standby assistance for transfers and walks 30 m with a walker.\n2. Fall precautions; out of bed to chair three times a day.\n3. Daily therapy while admitted.\n4. Anticipate discharge home with outpatient therapy and a front-wheeled walker.'],
    c_neuro: ['Neurology', 'Dr. Lindgren', () => '1. Examined at the bedside; findings documented above.\n2. A bedside glucose belongs in the first minute of any sudden change in speech, strength or alertness.\n3. Neurological checks every hour for the next 12 hours.\n4. Call neurology at once for any new deficit.'],
    c_surg: ['General Surgery', 'Dr. Oyelaran', () => '1. Wound and abdomen examined; no sign of bleeding or leak.\n2. Surgery to be called before any anticoagulant is started or changed.\n3. Continue early walking and incentive spirometry.\n4. We will follow daily.'],
    c_sw: ['Social Work', 'Jordan Mahoe, MSW', () => '1. Met with the patient to review home supports and insurance.\n2. Lives with family who can help after discharge.\n3. No barriers to getting prescriptions.\n4. Will arrange equipment and follow-up appointments once the team sets a discharge date.'],
  };
  function consultNote(p, o) {
    const [svc, who, recs0] = CONSULT[o.catId], own = p.sim && p.sim.consults && p.sim.consults[o.catId], recs = own ? () => own : recs0;   // a case patient (js/cases.js) can carry its own recommendations
    const text = `${svc.toUpperCase()} CONSULT\n\nREASON FOR CONSULT: ${o.comment || p.dx}\nREQUESTING PROVIDER: ${o.signedBy || p.attending}\n\nHPI: ${E.age(p.dob)}-year-old ${p.sex === 'M' ? 'man' : 'woman'} admitted with ${p.cc.toLowerCase()}. Working diagnosis: ${p.dx}. Chart, medications and results reviewed; patient seen and examined.\n\nPERTINENT DATA:\nVitals: ${E.DOT.vitals(p)}\n${E.DOT.labs(p)}\nAllergies: ${E.DOT.allergies(p)}\nCode status: ${p.codeStatus}\n\nRECOMMENDATIONS:\n${recs(p)}\n\nThank you for this consult. We will follow.\n\n${who}, ${svc}\n${E.fmtDT(Date.now())}\n(Simulated consultant for training.)`;
    const n = { id: E.uid('n'), ts: Date.now(), type: 'Consult Note', author: `${who} (${svc})`, role: 'physician', status: 'Signed', text };
    p.notes.push(n); o.status = 'Completed'; o.resultTs = Date.now();
    auditAs(who, `Wrote consult note: ${svc}`, p.id);
    E.message({ type: 'Consult', from: `${who}, ${svc}`, patientId: p.id, act: 'notes', subject: `${svc} consult completed — ${p.name}`, body: `Recommendations:\n${recs(p)}\n\nThe full note is in the chart under Notes.` });
    return `${svc} consult — ${p.name}`;
  }

  /* ================= 5. nursing follow-through ================= */
  const NURSING = {
    vs_q4: () => 'Vital signs every 4 hours started. A fresh set is in Flowsheets.',
    tele: () => 'Telemetry applied. Monitor room notified. Current rhythm recorded on the strip.',
    io: (p) => `Strict intake and output started. Last 8 hours: in ${hasAny(activeIds(p), FLUID) ? '1,450' : '620'} mL, out ${hasAny(activeIds(p), FURO) ? '1,850' : '700'} mL.`,
    weight: (p) => { if (hasAny(activeIds(p), FURO)) p.weight = +(p.weight - 0.9).toFixed(1); return `Standing weight this morning: ${p.weight} kg${hasAny(activeIds(p), FURO) ? ' (down 0.9 kg since yesterday)' : ''}. Updated in the chart sidebar.`; },
    fall: () => 'Fall precautions in place: bed alarm on, call light in reach, non-slip socks, yellow wristband.',
    o2: () => 'Oxygen started and titrated. A fresh set of vital signs is in Flowsheets.',
    poc_glu: (p) => { const l = E.latestLab(p, 'Glu'), r = E.simLab(p, 'Glu', l ? l.value : 130), g = Math.round(r.value + (Math.random() - 0.5) * 14); p.labs.push({ id: E.uid('l'), ts: Date.now(), name: 'POC glucose', values: { Glu: g } }); return `Point-of-care glucose: ${g} mg/dL. Filed in Results.`; },
    scd: () => 'Sequential compression devices applied to both legs.',
    prbc: () => 'Type and screen confirmed. Consent on the chart. 1 unit of red cells started; vital signs taken at 15 minutes with no reaction. Recheck a CBC after the unit finishes.',
    iso_droplet: (p) => { p.isolation = 'Droplet'; return 'Droplet precautions started: sign on the door, masks at the entrance. The isolation flag now shows in the chart sidebar.'; },
    npo: () => 'Patient made NPO. Meal tray cancelled and a sign placed at the bedside. Oral medications held pending your instructions.',
    bedrest: () => 'Bed rest started. Turning schedule every 2 hours.', act_tol: () => 'Patient is up and walking in the hall as tolerated.', wbat: () => 'Weight bearing as tolerated; walked to the chair with the walker.',
    admit: () => 'Admission order received. Bed assigned and admission assessment under way.',
  };
  const nursingReply = (p, o) => (NURSING[o.catId] ? NURSING[o.catId](p) : o.group === 'Diet & Activity' ? `Diet changed to: ${o.name}. Kitchen notified for the next tray.` : `${o.name}: acknowledged and carried out.`);

  /* Orders that are harmless but make no sense. The nurse says so, drily, and nobody is marked down.
     Returns { subject, body } or null. */
  function sillyOrder(p, o) {
    const twin = p.orders.find((x) => x !== o && x.catId === o.catId && x.status === 'Active');
    const fn = p.name.split(', ').reverse().join(' ');
    if (/^diet_/.test(o.catId) && p.orders.some((x) => x.catId === 'npo' && x.status === 'Active'))
      return { subject: `Question: ${o.name} and NPO — ${p.name}`, body: `${fn} now has "${o.name}" and "NPO" active at the same time. I cannot feed someone and not feed them. Until I hear otherwise the NPO order wins, and the kitchen is sending a tray of nothing, which they do very well.\n\nIf you mean for the patient to eat, the NPO order has to be discontinued first. A physician can do that.` };
    if (o.catId === 'npo' && twin) return { subject: `Question: NPO, twice — ${p.name}`, body: `${fn} was already NPO. I have noted the second order. The patient cannot eat any less than nothing.` };
    if (twin && o.catId === 'vs_q4') return { subject: `Question: vital signs every 4 hours, twice — ${p.name}`, body: `${fn} already had vital signs every 4 hours ordered. I will keep taking them every 4 hours, once each time. Taking them twice does not make them better.\n\nOne of the two orders can be discontinued.` };
    if (twin && (o.group === 'Nursing' || o.group === 'Diet & Activity') && o.catId !== 'prbc' && o.catId !== 'poc_glu')
      return { subject: `Question: ${o.name}, twice — ${p.name}`, body: `"${o.name}" was already ordered for ${fn}, and it is already being done. I have filed the second order next to the first, where they can keep each other company.\n\nOne of the two can be discontinued.` };
    return null;
  }

  /* ================= 6a. overrides the attending agrees with =================
     Most advisories are right, and the safe answer is to remove the order. A few are not a reason to stop: an
     "allergy" that is really a side effect, a contrast reaction that a steroid beforehand covers, a duplicate that
     is a deliberate change of dose. Each entry names the advisory it answers (by the allergy behind it, or by the
     advisory's title), what a sound reason looks like, and what the attending says either way. The reason is the
     option chosen in the advisory box plus anything typed in the order's comment, so a learner can say why in
     their own words. An order that trips a harm rule (js/shift.js) or a high-severity advisory never reaches this
     list: those keep their hard stop. An overridden advisory with no entry here is cosigned as before.
     FACULTY: clinical content, not yet reviewed. Edit or add entries here.
       allergy  fields the patient's allergy must match (type, severity, cls); or title: a pattern for the advisory
       type     the order type it applies to; reasons: advisory-box options that count; words: a pattern for typed text
       needs    catalogue ids: any one of them live for this patient also counts (the premedication, say)
       replaces true: on cosign the older active order of the same drug is discontinued */
  E.OVERRIDE_OK = [
    { id: 'intolerance', label: 'A side effect recorded as an intolerance, not an allergy',
      allergy: { type: 'Intolerance', severity: 'Low' }, reasons: ['Benefit outweighs risk', 'Discussed with attending / pharmacy'],
      words: /intoleran|nause|vomit|side.?effect|not (an? )?(true )?allerg|antiemetic|ondansetron/i,
      ok: (p, o, a) => `Override accepted. ${a.agent} caused ${a.reaction.toLowerCase()}. That is an intolerance, a side effect, not an allergic reaction, and it does not rule out ${o.name}. Ask the nurse to offer something for nausea if it upsets the stomach.`,
      no: (p, o, a) => `${a.agent} is listed as an intolerance (${a.reaction.toLowerCase()}), so an override can be right here. Your reason does not say why. Say that it is a side effect and not an allergy, and how you will handle it: choose "Benefit outweighs risk", or write it in the order comment.` },
    { id: 'contrast-premed', label: 'Contrast after a steroid given beforehand',
      allergy: { cls: 'contrast', severity: 'Moderate' }, needs: ['prednisone'], words: /pre-?medicat|steroid|predniso/i,
      ok: () => 'Override accepted. A hives reaction to contrast is not a reason never to scan. With a steroid given beforehand, as you planned, the scan can go ahead. Make sure radiology knows about the reaction.',
      no: () => 'A hives reaction to contrast does not rule out the scan, but the usual answer is a steroid given beforehand. Order it, then override with that as your reason. "Benefit outweighs risk" on its own leaves the reaction unprotected.' },
    { id: 'dose-change', label: 'A deliberate change of dose, with the old order stopped',
      title: /^Duplicate order$/, type: 'med', replaces: true, words: /dose|increas|decreas|chang|replac|switch|instead|discontinu|stop the (old|other|first)/i,
      ok: (p, o) => `Override accepted. A new dose of ${o.name} is a change, not a duplicate. I have discontinued the old order, so only one is active.`,
      no: (p, o) => `${o.name} is already active. If you mean to change the dose, say so in the order comment and I will stop the old order when I sign the new one. Two active orders for one drug is how a patient gets a double dose.` },
  ];
  /** What the attending makes of this order's overridden advisories: null when no entry in E.OVERRIDE_OK applies,
      else { ok, ids, text }. ok is true only when every advisory that has an entry was given a sound reason. */
  E.overrideCheck = (p, o) => {
    if (!o.overrides || !o.overrides.length || (E.harmRule && E.harmRule(p, o))) return null;
    const live = (id) => p.orders.some((x) => x !== o && x.catId === id && ['Active', 'Pended', 'In process'].includes(x.status)), hits = [];
    o.overrides.forEach((ov) => {
      const a = E.allergiesOf(p).find((x) => `${x.type}: ${x.agent}` === ov.title), said = `${ov.reason || ''} ${o.comment || ''}`.trim();
      E.OVERRIDE_OK.forEach((r) => {
        if (r.allergy ? !(a && Object.keys(r.allergy).every((k) => a[k] === r.allergy[k])) : !(r.title && r.title.test(ov.title))) return;
        if (r.type && o.type !== r.type) return;
        const ok = !!said && ((r.reasons || []).includes(ov.reason) || !!(r.words && r.words.test(said)) || (r.needs || []).some(live));
        hits.push({ r, ok, text: (ok ? r.ok : r.no)(p, o, a) });
      });
    });
    return hits.length ? { ok: hits.every((h) => h.ok), ids: hits.map((h) => h.r.id), replaces: hits.some((h) => h.r.replaces), text: hits.map((h) => h.text).join(' ') } : null;
  };

  /* ================= 6. the attending reviews student work ================= */
  const RESIDENT = 'Covering resident (PGY-2)';
  function reviewOrders(p, list, out) {
    const ok = [], no = [], rushed = [], asked = [];
    list.forEach((o) => {
      const high = E.checkDraft(p, o, []).filter((a) => a.level === 'high');
      // an order that would harm this patient (js/shift.js) is stopped here too, and counted as a near miss
      const rule = E.harmRule ? E.harmRule(p, o) : null, stop = high[0] || (rule && { title: rule.title, detail: rule.why(p, o) });
      const v = stop ? null : E.overrideCheck(p, o);
      // during a shift's Day work the attending is busy: an order whose advisory the student overrode is
      // cosigned by a hurried resident and reaches the patient
      if (stop && o.overrides && o.overrides.length && E.shiftRushed && E.shiftRushed()) { E.activate(p, o, RESIDENT); o.rushed = true; o.feedback = 'Cosigned by the covering resident without the usual review, because the advisory was overridden.'; rushed.push(o); auditAs(RESIDENT, `Cosigned order without review: ${o.name} (entered by ${o.by}, advisory overridden)`, p.id); }
      else if (stop) { o.status = 'Declined'; o.declinedBy = p.attending; o.declineReason = stop.title; o.feedback = `${stop.title}. ${stop.detail}`; /* kept in the learner's evidence */ no.push({ o, a: stop }); auditAs(p.attending, `Declined pended order: ${o.name} (${stop.title})`, p.id); if (E.nearMiss) E.nearMiss(p, o, stop.title, p.attending); }
      // an override that can be right, but the reason does not say why: sent back, and not a near miss (nothing unsafe was about to happen)
      else if (v && !v.ok) { o.status = 'Declined'; o.declinedBy = p.attending; o.declineReason = 'Override reason does not address the advisory'; o.feedback = v.text; asked.push(o); auditAs(p.attending, `Declined pended order: ${o.name} (override reason does not address the advisory)`, p.id); }
      else {
        E.activate(p, o, p.attending); ok.push(o); auditAs(p.attending, `Cosigned order: ${o.name} (entered by ${o.by})${v ? ', override accepted' : ''}`, p.id);
        if (v) {
          o.sanctioned = v.ids; o.feedback = v.text;   // kept in the learner's evidence, and read by a shift's expectations
          if (v.replaces) p.orders.forEach((x) => { if (x !== o && x.catId === o.catId && x.status === 'Active') Object.assign(x, { status: 'Discontinued', dcTs: Date.now(), dcBy: p.attending }); });
        }
      }
    });
    const body = [
      ok.length ? `Cosigned and now active:\n${ok.map((o) => `- ${o.name} ${E.orderDetail(o)}${o.sanctioned ? `\n  ${o.feedback}` : ''}`).join('\n')}` : '',
      rushed.length ? `I am in a procedure. The covering resident cosigned these between pages, without the usual review, because you had overridden the advisory:\n${rushed.map((o) => `- ${o.name} ${E.orderDetail(o)}`).join('\n')}\nThey are active now. You own what happens next.` : '',
      no.length ? `Declined:\n${no.map(({ o, a }) => `- ${o.name}: ${a.title}. ${a.detail}${o.overrides && o.overrides.length ? ` You overrode this advisory ("${o.overrides[0].reason}"); it was a hard stop for me.` : ''}`).join('\n')}\n\nCome find me and we will pick a safer alternative together.` : '',
      asked.length ? `Not signed yet, because the reason for the override does not answer the advisory:\n${asked.map((o) => `- ${o.name}: ${o.feedback}`).join('\n')}\n\nEnter it again with a reason that does.` : '',
      ok.some((o) => o.type === 'lab' || o.type === 'img') ? 'Tests are in process. Watch your Inbox for the results and follow them up.' : '',
    ].filter(Boolean).join('\n\n');
    const nOk = ok.length + rushed.length, nNo = no.length + asked.length;
    E.message({ type: 'Attending review', from: p.attending, patientId: p.id, act: 'orders', critical: !!no.length && !nOk, subject: `${nNo ? (nOk ? 'Some orders declined' : 'Orders declined') : 'Orders cosigned'} — ${p.name}`, body });
    out.push(`${p.attending} reviewed your orders — ${p.name}`);
  }
  /** Does the note match the chart at the moment it is signed? Reads lab values written as "K 5.2" (the .labs dot
      phrase writes them this way, and so do most people) and blood pressures written as 128/76. A value counts as
      wrong only when the note never gives the current one, so a trend that ends on today's value ("Cr 1.9, now 2.1")
      is fine. Also catches "no known allergies" written for a patient who has some.
      history: true for a note that tells the story from admission (an H&P), where an older value is not an error.
      Returns { checked, wrong: [text] } for the attending's feedback and the learner's evidence. */
  E.noteAccuracy = (p, text, history) => {
    const t = String(text || ''), wrong = [], when = (ts) => E.fmtDT(ts), same = (a, b) => Math.abs(a - b) < 1e-6;
    let checked = 0;
    Object.keys(E.LABS).forEach((k) => {
      const latest = E.latestLab(p, k); if (!latest) return;
      const re = new RegExp(`(?:^|[^A-Za-z0-9])${k}\\s*(?:[:=]|was|is|of)?\\s*[<>]?(\\d+(?:\\.\\d+)?)`, 'g');
      const said = [...t.matchAll(re)].map((m) => Number(m[1]));
      if (!said.length) return;
      checked++;
      if (said.some((v) => same(v, Number(E.labVal(k, latest.value))))) return;
      const older = p.labs.some((l) => k in l.values && l.ts < latest.ts && said.some((v) => same(v, Number(E.labVal(k, l.values[k])))));
      if (older && history) return;
      const name = E.LABS[k].name.toLowerCase(), now = E.labVal(k, latest.value);
      wrong.push(older ? `You wrote ${k} ${said[0]}, which is an older value. The ${name} at ${when(latest.ts)} is ${now}.`
        : `You wrote ${k} ${said[0]}, but no ${name} in the chart has that value. The latest, at ${when(latest.ts)}, is ${now}.`);
    });
    const v = E.lastVitals(p);
    const bps = [...t.matchAll(/(?:^|\D)(\d{2,3})\/(\d{2,3})(?!\d)/g)].map((m) => [Number(m[1]), Number(m[2])]).filter(([s, d]) => s >= 50 && s <= 260 && d >= 20 && d <= 160 && s > d);
    if (v && bps.length) {
      checked++;
      if (!bps.some(([s, d]) => s === v.sbp && d === v.dbp)) {
        const older = p.vitals.some((x) => x.ts < v.ts && bps.some(([s, d]) => s === x.sbp && d === x.dbp));
        if (!(older && history)) wrong.push(`You wrote a blood pressure of ${bps[0][0]}/${bps[0][1]}${older ? ', an older reading' : ''}. The latest, at ${when(v.ts)}, is ${v.sbp}/${v.dbp}.`);
      }
    }
    const al = E.allergiesOf(p);
    if (/\b(NKDA|NKA|no known (drug )?allergies)\b/i.test(t)) { checked++; if (al.length) wrong.push(`You wrote no known allergies. The chart lists ${al.map((a) => `${a.agent} (${a.reaction.toLowerCase()})`).join(' and ')}.`); }
    return { checked, wrong };
  };
  function reviewNote(p, n, out) {
    const t = n.text, words = t.split(/\s+/).filter(Boolean).length, tips = [], acc = E.noteAccuracy(p, t, /H&P/.test(n.type));
    if (words < 60) tips.push('It is short. Give me enough of the story and the exam that I could present this patient from your note.');
    if (!/assessment|impression|plan/i.test(t)) tips.push('I could not find an assessment and plan. That is the part I read first.');
    if (!/\d{2,3}\/\d{2,3}/.test(t) && !/vitals?/i.test(t)) tips.push('Include today\'s vital signs (the .vitals dot phrase pulls them in).');
    const al = E.allergiesOf(p)[0];
    if (/H&P|Discharge/i.test(n.type) && al && !t.toLowerCase().includes(al.agent.split(' ')[0].toLowerCase())) tips.push(`This note type should list allergies; ${al.agent} is missing.`);
    // what does not match the chart comes first: it is the part that could hurt someone
    const list = (xs) => xs.map((x) => '- ' + x).join('\n');
    const copied = n.copiedForward ? 'You copied this note forward, and some of what you kept is out of date. ' : '';
    const fb = acc.wrong.length ? `Cosigned, but please correct this with an addendum. ${copied}Your note does not match the chart:\n${list(acc.wrong)}${tips.length ? `\n\nAlso, for next time:\n${list(tips)}` : ''}`
      : tips.length ? `Cosigned. For next time:\n${list(tips)}` : 'Cosigned. Clear and complete: story, data, assessment and plan are all there, and the numbers match the chart. Nice work.';
    Object.assign(n, { status: 'Signed', cosignedBy: p.attending, cosignedTs: Date.now(), feedback: fb, accuracy: { checked: acc.checked, wrong: acc.wrong } });   // feedback is kept in the learner's evidence
    auditAs(p.attending, `Cosigned note: ${n.type} by ${n.author}`, p.id);
    E.message({ type: 'Attending review', from: p.attending, patientId: p.id, act: 'notes', subject: `${n.type} cosigned — ${p.name}`, body: fb });
    out.push(`${p.attending} cosigned your note — ${p.name}`);
  }

  /* ================= the clock: called every 2 seconds by js/app.js ================= */
  /** Runs everything that is due. Returns short lines to show the learner. */
  /* The hold. While the learner has paused (E.simPaused), is logged out or is suspended, or the page was closed
     or asleep, the hospital holds still. When it moves again, every item still waiting gets the held time added
     to its own `simHold` (and a lab or study its `resultAt`, which is never shown), so it has the time it had
     left. The timestamps the learner sees are never changed. Kept in E.db so it survives a reload. */
  const FRESH = 15 * 60 * 1000, GAP = 90 * 1000;   // GAP: longer than any throttled timer in a background tab
  const age = (x, t) => Date.now() - t - (x.simHold || 0);
  /* Each item gets only the held time it existed for. An order pended in the middle of a long pause is owed the
     rest of that pause, not all of it: given all of it, its review would slip far past the moment play resumed
     (past the end of a shift's Day work, say) and be judged against a later state than the one the learner
     came back to. */
  function release(since, d) {
    const held = (t) => Math.max(0, Math.min(d, since + d - (t || 0)));
    E.db.patients.forEach((p) => {
      p.orders.forEach((o) => {
        if (o.status === 'In process' && o.resultAt) o.resultAt += held(o.signedTs || o.ts);
        else if (o.status === 'Pended') o.simHold = (o.simHold || 0) + held(o.ts);
        else if (o.status === 'Active' && o.signedTs && since - o.signedTs - (o.simHold || 0) < FRESH) o.simHold = (o.simHold || 0) + held(o.signedTs);
      });
      p.notes.forEach((n) => { if (n.status === 'Cosign needed') n.simHold = (n.simHold || 0) + held(n.ts); });
    });
  }
  /** Called every two seconds by js/app.js, even when nobody is logged in. Returns true while the hospital is held. */
  E.simClock = () => {
    const h = E.db.simHold || (E.db.simHold = { since: null, last: 0 }), now = Date.now();
    const held = !E.db.user || !!(E.suspended && E.suspended()) || E.simPaused();
    if (!h.since && h.last && now - h.last > GAP) h.since = h.last;   // the page was closed or asleep
    h.last = now;
    if (held) { if (!h.since) h.since = now; return true; }
    if (h.since) { release(h.since, Math.max(0, now - h.since)); h.since = null; }
    return false;
  };

  E.simTick = () => {
    if (E.simPaused()) return [];
    const c = CFG(), out = [], fresh = (o, s) => o.signedTs && age(o, o.signedTs) >= s * 1000 && age(o, o.signedTs) < FRESH;
    const solo = E.db.user && E.db.user.role === 'student';
    E.db.patients.forEach((p) => {
      if (c.attending && solo) {
        const pend = p.orders.filter((o) => o.status === 'Pended' && o.byRole === 'student' && age(o, o.ts) >= c.attendingDelay * 1000);
        if (pend.length) reviewOrders(p, pend, out);
        p.notes.filter((n) => n.status === 'Cosign needed' && n.role === 'student' && age(n, n.ts) >= c.noteDelay * 1000).forEach((n) => reviewNote(p, n, out));
      }
      const act = p.orders.filter((o) => o.status === 'Active');
      // an order that is harming the patient (js/shift.js) gets its vital signs from the harm rule, not from here
      const vit = act.filter((o) => VIT_RULES[o.catId] && !o.simVit && fresh(o, c.vitalsDelay) && !(E.db.crises || []).some((x) => x.orderId === o.id));
      if (vit.length) { vit.forEach((o) => { o.simVit = true; }); if (vitalsAfter(p, vit)) out.push(`New vital signs — ${p.name}`); }
      act.filter((o) => CONSULT[o.catId] && fresh(o, c.consultDelay)).forEach((o) => out.push(consultNote(p, o)));
      act.filter((o) => o.type === 'other' && !CONSULT[o.catId] && !o.simAck && o.group !== 'Code Status' && fresh(o, c.nursingDelay)).forEach((o) => {
        o.simAck = true;
        const silly = sillyOrder(p, o);
        if (silly) { E.message(Object.assign({ type: 'Nursing', from: p.rn, patientId: p.id, act: 'orders' }, silly)); auditAs(p.rn, `Questioned order: ${o.name}`, p.id); out.push(`${p.rn.split(',')[0]} RN has a question — ${p.name}`); return; }
        E.message({ type: 'Nursing', from: p.rn, patientId: p.id, act: o.catId === 'poc_glu' ? 'results' : o.catId === 'vs_q4' || o.catId === 'o2' ? 'flowsheets' : 'orders', subject: `Done: ${o.name} — ${p.name}`, body: nursingReply(p, o) });
        out.push(`${p.rn.split(',')[0]} RN: ${o.name} — ${p.name}`);
      });
    });
    return out;
  };

  /* ================= 7. text interview (when video visits are not connected) ================= */
  const STORY = {
    p1: ['I just could not catch my breath. It has been getting worse for about a week, and my legs swelled up so much my slippers stopped fitting. I have been sleeping in the recliner because lying flat makes it worse.', 'I live with my wife in Waipahu. I ran out of my water pill a couple of weeks ago and did not refill it. And I will be honest, we had a lot of saimin and Spam over the holidays.', 'I am worried my heart is getting weaker. My father died of heart trouble at about my age.'],
    p2: ['It started like a cold four days ago, then the fever and shaking chills came, and now I am coughing up thick green stuff. It hurts on the right side when I take a deep breath.', 'I live with my two teenagers and I work at a preschool, so I am around sick kids all day. I smoke about half a pack a day. I know, I know.', 'I am scared because the last time I had an antibiotic, a penicillin, my throat closed up and I ended up in the emergency room.'],
    p3: ['I am here for my new hip. They did the operation yesterday. The pain is there but I can manage it, mostly it hurts when I try to stand.', 'I live alone in a second-floor walk-up, which I am a bit worried about. My daughter can stay with me for the first week.', 'I want to know when I restart my blood thinner. I take it for my irregular heartbeat and nobody has told me the plan.'],
    p4: ['I have been throwing up since yesterday and my stomach really hurts. I am so thirsty and I keep peeing. My breathing feels fast and weird.', 'I am a nursing student, I live with roommates. My insulin pump site got kinked two days ago during finals and I did not notice until my sugars were sky high.', 'I am embarrassed. I should know better. Am I going to have to stay long? I have an exam on Friday.'],
    p5: ['My stools turned black, like tar, a few days ago. Then this morning I stood up and got so lightheaded I had to sit on the floor.', 'I live with my wife; she keeps my pills straight because my memory is not what it was. I have been taking ibuprofen every day for my knees, three or four of them.', 'I do not want any heroics. We talked about it with my doctor. But I would like to stop feeling so weak.'],
    p7: ['My leg. I scratched it gardening and a few days later it went red and hot and the red kept spreading. Then I got a fever.', 'I live with my husband. I do not smoke. I have sugar diabetes and I take a pill for it, and one for my blood pressure.', 'People here keep calling me Maria. That is the other lady down the hall. I am Marie. Please check my wristband.'],
    p6: ['My breathing got bad over three days. More wheezing, more coughing, and the phlegm changed colour. My inhaler stopped helping and I could not finish a sentence.', 'I live alone with my cat. I use oxygen at home, two litres. I still smoke a few a day, I am down from a pack. I get very anxious when I cannot breathe.', 'I am afraid of ending up on a breathing machine. And who is feeding my cat?'],
  };
  /** Questions a student can ask, with the patient's answers written from the chart in everyday words. */
  E.interview = (p) => {
    const s = STORY[p.id] || [`It is the ${p.cc.toLowerCase()}. That is why I came in.`, 'I live at home with family.', 'I just want to feel better and go home.'];
    const al = E.allergiesOf(p), meds = p.orders.filter((o) => o.type === 'med' && o.status === 'Active').slice(0, 3).map((o) => o.name.split(' ')[0].toLowerCase());
    const hx = p.problems.filter((x) => x.status === 'Active').slice(1, 4).map((x) => x.name.replace(/\s*\(.*?\)/g, '').replace(/,.*$/, '').toLowerCase());
    const list = [
      ['Can you tell me your full name and date of birth?', `${first(p)} ${last(p)}. ${E.fmtDob(p.dob)}.`],
      ['What brought you into the hospital?', s[0]],
      ['What medical problems do you have?', hx.length ? `Let me think. ${hx.join(', ')}. That is what my doctors tell me, anyway.` : 'Nothing much, I have been pretty healthy.'],
      ['Do you have any allergies? What happens?', al.length ? al.map((a) => `${a.agent.replace(/\s*\(.*?\)/, '')}: I get ${a.reaction.toLowerCase()}.`).join(' ') : 'None that I know of.'],
      ['What medicines are you taking?', meds.length ? `They are giving me ${meds.join(', ')} in here. At home I have a list in my wallet; my pharmacy would know better than I do.` : 'Nothing regular.'],
      ['Tell me about home. Who do you live with? Do you smoke or drink?', s[1]],
      ['If your heart were to stop, what would you want us to do?', p.codeStatus === 'Full Code' ? 'I would want you to do everything you can.' : 'No. I have decided I do not want CPR or a breathing tube. Keep me comfortable. My family knows.'],
      ['What worries you most right now?', s[2]],
    ].map(([q, a]) => ({ q, a }));
    // a PBL case patient (js/cases.js) has questions of its own, with answers the chart does not hold
    const cs = E.CASES && E.CASES.find((c) => c.pid === p.id);
    if (cs && cs.interview) list.push(...cs.interview.filter((x) => x && x.q && !list.some((y) => y.q === x.q)).map((x) => ({ q: x.q, a: x.a })));
    return list.map((x, i) => Object.assign(x, { i }));
  };
})();
