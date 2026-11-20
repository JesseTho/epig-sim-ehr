/* SIM+EHR Student Edition — seed data. Every patient, clinician and value here is FICTIONAL and
   written for teaching. Times are stored relative to "now" so the census always looks current. */
(function () {
  const E = window.EHR;

  E.buildSeed = () => {
    const now = Date.now();
    const T = (h) => Math.round((now + h * E.HOUR) / 60000) * 60000;
    const PARK = 'Park, Noelani MD', OYE = 'Oyelaran, Marcus MD', VAS = 'Vasquez, Elena MD';
    const RN1 = 'Reyes, Tomas RN', RN2 = 'Lindqvist, Hana RN';
    let seedN = 7;
    const rand = () => { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
    const jit = (v, amt) => v + (rand() - 0.5) * 2 * amt;
    const lerp = (a, b, f) => a + (b - a) * f;

    /** Vitals every stepH hours from admission to now, drifting from `a` (admission) to `b` (current). */
    const vitals = (admitH, stepH, a, b, rn) => {
      const out = [];
      for (let h = admitH; h <= -0.4; h += stepH) {
        const f = Math.min(1, (h - admitH) / Math.max(1, -admitH - stepH));
        out.push({
          ts: T(h), by: rn,
          temp: +jit(lerp(a.t, b.t, f), 0.15).toFixed(1), hr: Math.round(jit(lerp(a.hr, b.hr, f), 3)), rr: Math.round(jit(lerp(a.rr, b.rr, f), 1)),
          sbp: Math.round(jit(lerp(a.s, b.s, f), 4)), dbp: Math.round(jit(lerp(a.d, b.d, f), 3)), spo2: Math.round(jit(lerp(a.o, b.o, f), 0.7)),
          o2: f < 0.5 ? a.o2 : b.o2, pain: Math.round(lerp(a.p, b.p, f)),
        });
      }
      return out;
    };
    const labs = (rows) => rows.map(([h, name, values]) => ({ id: E.uid('l'), ts: T(h), name, values }));
    const rep = (h, kind, name, text, by) => ({ id: E.uid('r'), ts: T(h), kind, name, status: 'Final', text, by: by || 'Radiology' });
    const note = (h, type, author, role, text) => ({ id: E.uid('n'), ts: T(h), type, author, role, status: 'Signed', text });
    const enc = (days, type, dept, provider, dx) => ({ id: E.uid('e'), ts: T(-24 * days), type, dept, provider, dx });
    const al = (agent, cls, reaction, severity, type) => ({ id: E.uid('a'), agent, cls, reaction, severity, type: type || 'Drug allergy', status: 'Active', verified: true });
    const prob = (name, days) => ({ id: E.uid('pr'), name, noted: T(-24 * (days || 0)), status: 'Active' });

    const mk = (base, admitH, attending, orderSpecs) => {
      const p = Object.assign({ drafts: [], noteDraft: null, mar: [] }, base);
      p.admitTs = T(admitH);
      p.attending = attending;
      p.orders = orderSpecs.map(([catId, over]) => E.newOrder(catId, Object.assign({ status: 'Active', by: attending, byRole: 'physician', ts: T(admitH + 1), signedBy: attending, signedTs: T(admitH + 1) }, over || {})));
      return p;
    };

    const patients = [];

    /* 1 — heart failure */
    patients.push(mk({
      id: 'p1', mrn: '10048213', name: 'Akana, Keoni', dob: '1959-03-14', sex: 'M', unit: '5 West Medicine', bed: '5W-512A',
      cc: 'Shortness of breath, leg swelling', dx: 'Acute on chronic systolic heart failure', codeStatus: 'Full Code', isolation: '', height: 175, weight: 98.4, rn: RN1,
      allergies: [al('Lisinopril (ACE inhibitors)', 'acei', 'Angioedema', 'High'), al('Shellfish', '', 'Hives', 'Moderate', 'Food allergy')],
      problems: [prob('Acute on chronic systolic heart failure (EF 30%)', 2), prob('Chronic kidney disease, stage 3b', 900), prob('Type 2 diabetes mellitus', 2400), prob('Hypertension', 3000), prob('Hyperlipidemia', 3000), prob('Obstructive sleep apnea', 700)],
      vitals: vitals(-38, 4, { t: 36.8, hr: 98, rr: 24, s: 162, d: 96, o: 90, o2: '3 L NC', p: 0 }, { t: 36.7, hr: 80, rr: 18, s: 134, d: 82, o: 95, o2: '2 L NC', p: 0 }, RN1),
      labs: labs([
        [-37, 'BMP, CBC, BNP, Troponin, Mg', { Na: 133, K: 5.3, Cl: 98, CO2: 22, BUN: 44, Cr: 1.9, Glu: 212, Ca: 8.9, WBC: 8.1, Hgb: 11.8, Hct: 35.6, Plt: 198, BNP: 1840, Trop: 0.06, Mg: 1.7 }],
        [-31, 'Troponin I', { Trop: 0.05 }],
        [-14, 'BMP, Mg', { Na: 135, K: 4.6, Cl: 97, CO2: 25, BUN: 46, Cr: 2.0, Glu: 168, Ca: 8.8, Mg: 1.9 }],
        [-4, 'BMP, CBC, Mg', { Na: 136, K: 5.1, Cl: 96, CO2: 27, BUN: 48, Cr: 2.1, Glu: 154, Ca: 8.9, WBC: 7.6, Hgb: 11.5, Hct: 34.9, Plt: 204, Mg: 1.8 }],
      ]),
      reports: [
        rep(-37, 'Imaging', 'XR chest 2 views', 'FINDINGS: Enlarged cardiac silhouette. Pulmonary vascular congestion with interstitial edema. Small bilateral pleural effusions. No focal consolidation or pneumothorax.\n\nIMPRESSION: Cardiomegaly with pulmonary edema and small bilateral effusions, consistent with decompensated heart failure.'),
        rep(-37, 'Cardiology', 'ECG 12-lead', 'Sinus rhythm, rate 96. Left ventricular hypertrophy with repolarization abnormality. No acute ST-segment elevation. QTc 448 ms.\n\nIMPRESSION: Sinus rhythm with LVH. No acute ischemic changes.', 'Cardiology'),
        rep(-20, 'Cardiology', 'Echocardiogram, transthoracic (TTE)', 'Left ventricle moderately dilated with severely reduced systolic function, LVEF 30%. Global hypokinesis. Moderate mitral regurgitation. Estimated RVSP 48 mmHg. IVC dilated with reduced collapse.\n\nIMPRESSION: Severely reduced LV systolic function (EF 30%), moderate MR, elevated right-sided pressures.', 'Cardiology'),
      ],
      notes: [
        note(-36, 'H&P', PARK, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Shortness of breath and leg swelling for 5 days.\n\nHPI: 67 y.o. man with HFrEF (EF 35% in 2024), CKD 3b, T2DM and HTN presenting with progressive dyspnea on exertion, 3-pillow orthopnea and bilateral leg swelling. Reports a 6 kg weight gain over two weeks after running out of furosemide and eating restaurant food while traveling. No chest pain, fever or cough.\n\nPMH: as per problem list. Home medications: furosemide 40 mg daily (not taking x10 days), carvedilol 6.25 mg BID, atorvastatin 40 mg nightly, insulin glargine 18 units nightly.\nALLERGIES: Lisinopril (angioedema), shellfish (hives).\n\nEXAM: T 36.8, HR 98, BP 162/96, RR 24, SpO2 90% on room air, 94% on 3 L. JVP 12 cm. Bibasilar crackles. S3 present. 2+ pitting edema to the knees.\n\nDATA: BNP 1840. Cr 1.9 (baseline 1.6). K 5.3. Troponin 0.06. CXR with pulmonary edema.\n\nASSESSMENT & PLAN:\n1. Acute on chronic HFrEF, volume overloaded, due to medication nonadherence and dietary indiscretion. IV furosemide 40 mg BID, strict I&O, daily weights, 2 g sodium diet. Repeat echo.\n2. AKI on CKD 3b, likely cardiorenal. Trend BMP daily, avoid nephrotoxins. NO ACE inhibitor (angioedema).\n3. Hyperkalemia, mild. Hold potassium, recheck with diuresis.\n4. T2DM: glargine 18 units nightly plus sliding scale.\n5. VTE prophylaxis: heparin SQ.\nCode status: Full.'),
        note(-12, 'Nursing Note', RN1, 'nurse', 'NURSING NOTE\n\nPatient alert and oriented x4. Breathing easier this shift, remains on 2 L nasal cannula with SpO2 94-95%. Urine output 1.4 L over 12 hours after IV furosemide. Weight down 1.8 kg from admission. Edema 1+ to mid-shin. Reinforced fluid restriction and low sodium diet teaching; patient verbalized understanding. Call light within reach, fall precautions in place.'),
      ],
      encounters: [enc(96, 'Office Visit', 'Cardiology Clinic', 'Fontaine, Rhea MD', 'Chronic systolic heart failure'), enc(210, 'Hospital Encounter', '5 West Medicine', PARK, 'Heart failure exacerbation'), enc(340, 'Office Visit', 'Primary Care', 'Iwasaki, Glenn MD', 'Diabetes follow-up')],
    }, -38, PARK, [['code_full'], ['furosemide_iv'], ['carvedilol'], ['atorvastatin'], ['glargine', { dose: '18 units' }], ['lispro_ss'], ['heparin_sq'], ['acetaminophen'], ['tele'], ['io'], ['weight'], ['diet_cardiac', { comment: 'Fluid restriction 1.5 L/day' }]]));

    /* 2 — sepsis / pneumonia, penicillin anaphylaxis */
    patients.push(mk({
      id: 'p2', mrn: '10051877', name: 'Santos, Maria', dob: '1972-07-02', sex: 'F', unit: '5 West Medicine', bed: '5W-508', rn: RN2,
      cc: 'Fever, productive cough, shortness of breath', dx: 'Sepsis due to community-acquired pneumonia', codeStatus: 'Full Code', isolation: 'Droplet', height: 160, weight: 71.2,
      allergies: [al('Penicillins', 'penicillin', 'Anaphylaxis', 'High'), al('Codeine', 'opioid', 'Nausea and vomiting', 'Low', 'Intolerance')],
      problems: [prob('Sepsis due to right lower lobe pneumonia', 1), prob('Asthma, mild intermittent', 4000), prob('Hypothyroidism', 2000), prob('Tobacco use disorder', 5000)],
      vitals: vitals(-20, 4, { t: 39.1, hr: 118, rr: 24, s: 96, d: 58, o: 90, o2: '3 L NC', p: 4 }, { t: 37.8, hr: 96, rr: 20, s: 112, d: 68, o: 94, o2: '2 L NC', p: 2 }, RN2),
      labs: labs([
        [-19, 'CBC, BMP, Lactate, Procalcitonin', { WBC: 17.8, Hgb: 12.9, Hct: 38.8, Plt: 312, Na: 134, K: 3.6, Cl: 99, CO2: 21, BUN: 24, Cr: 1.1, Glu: 118, Ca: 8.6, Lactate: 2.9, PCT: 4.8 }],
        [-15, 'Lactate', { Lactate: 1.6 }],
        [-3, 'CBC, BMP', { WBC: 14.2, Hgb: 12.1, Hct: 36.4, Plt: 298, Na: 137, K: 3.3, Cl: 102, CO2: 23, BUN: 18, Cr: 0.9, Glu: 104, Ca: 8.4 }],
      ]),
      reports: [
        rep(-19, 'Imaging', 'XR chest 2 views', 'FINDINGS: Dense airspace consolidation in the right lower lobe with air bronchograms. Small right parapneumonic effusion. Left lung clear. Heart size normal.\n\nIMPRESSION: Right lower lobe pneumonia with small parapneumonic effusion.'),
        rep(-17, 'Microbiology / Other', 'Sputum Gram stain and culture', 'GRAM STAIN: Many polymorphonuclear cells. Many gram-positive diplococci.\nCULTURE: In progress.', 'Microbiology'),
        rep(-8, 'Microbiology / Other', 'Blood culture ×2', 'PRELIMINARY: No growth at 12 hours. Final report to follow.', 'Microbiology'),
      ],
      notes: [
        note(-18, 'H&P', PARK, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Fever and cough for 3 days.\n\nHPI: 54 y.o. woman with mild intermittent asthma, hypothyroidism and ongoing tobacco use presenting with 3 days of fever to 39.4, rigors, cough productive of rust-colored sputum and right-sided pleuritic chest pain. Progressive dyspnea today. No sick contacts or recent travel.\n\nALLERGIES: PENICILLIN - ANAPHYLAXIS (throat swelling and hypotension as a teenager, required epinephrine). Codeine causes nausea.\n\nEXAM: T 39.1, HR 118, BP 96/58, RR 24, SpO2 90% on room air. Ill-appearing, speaking in short sentences. Bronchial breath sounds and crackles at the right base. No wheeze.\n\nDATA: WBC 17.8, lactate 2.9, procalcitonin 4.8. CXR with RLL consolidation.\n\nASSESSMENT & PLAN:\n1. Sepsis due to community-acquired pneumonia (RLL). 30 mL/kg crystalloid given in the ED with improvement in blood pressure and lactate. Given anaphylaxis to penicillin, AVOID beta-lactams: levofloxacin 750 mg IV daily. Follow blood and sputum cultures.\n2. Acute hypoxic respiratory failure: supplemental oxygen, titrate to SpO2 92% or greater.\n3. Asthma: albuterol nebulizer as needed.\n4. Hypothyroidism: continue levothyroxine.\n5. Tobacco use: counseled, offer nicotine replacement.\n6. VTE prophylaxis: enoxaparin.\nDroplet precautions pending respiratory viral panel. Code status: Full.'),
        note(-6, 'Nursing Note', RN2, 'nurse', 'NURSING NOTE\n\nFebrile to 38.4 overnight, acetaminophen given with effect. Oxygen weaned from 3 L to 2 L, SpO2 93-94%. Productive cough continues, sputum sample sent. Encouraged incentive spirometry every hour while awake. Droplet precautions maintained. Allergy band verified: PENICILLIN.'),
      ],
      encounters: [enc(150, 'Office Visit', 'Primary Care', 'Iwasaki, Glenn MD', 'Hypothyroidism follow-up'), enc(420, 'Emergency', 'Emergency Department', 'Brandt, Colin MD', 'Asthma exacerbation')],
    }, -20, PARK, [['code_full'], ['levofloxacin'], ['lr'], ['acetaminophen'], ['albuterol'], ['levothyroxine'], ['enoxaparin'], ['o2'], ['vs_q4'], ['iso_droplet'], ['diet_reg']]));

    /* 3 — post-op hip, warfarin */
    patients.push(mk({
      id: 'p3', mrn: '10039562', name: 'Whitfield, James', dob: '1954-01-23', sex: 'M', unit: '4 East Orthopedics', bed: '4E-417', rn: RN1,
      cc: 'Elective right total hip arthroplasty', dx: 'Right hip osteoarthritis, s/p total hip arthroplasty (POD 1)', codeStatus: 'Full Code', isolation: '', height: 180, weight: 86.0,
      allergies: [],
      problems: [prob('Osteoarthritis of right hip, s/p total hip arthroplasty', 1), prob('Atrial fibrillation, on warfarin', 1500), prob('Hypertension', 3500), prob('Benign prostatic hyperplasia', 1200), prob('Gastroesophageal reflux disease', 2500)],
      vitals: vitals(-30, 4, { t: 36.6, hr: 84, rr: 16, s: 138, d: 80, o: 97, o2: 'Room air', p: 7 }, { t: 37.4, hr: 78, rr: 16, s: 128, d: 74, o: 96, o2: 'Room air', p: 4 }, RN1),
      labs: labs([
        [-34, 'CBC, BMP, PT/INR (pre-op)', { WBC: 6.8, Hgb: 13.4, Hct: 40.1, Plt: 214, Na: 140, K: 4.2, Cl: 104, CO2: 26, BUN: 17, Cr: 0.9, Glu: 102, Ca: 9.2, INR: 1.2 }],
        [-22, 'CBC', { WBC: 10.9, Hgb: 10.6, Hct: 31.8, Plt: 188 }],
        [-4, 'CBC, BMP, PT/INR', { WBC: 11.2, Hgb: 9.1, Hct: 27.5, Plt: 176, Na: 138, K: 4.0, Cl: 103, CO2: 25, BUN: 19, Cr: 1.0, Glu: 126, Ca: 8.3, INR: 1.6 }],
      ]),
      reports: [
        rep(-25, 'Imaging', 'XR pelvis and right hip, post-operative', 'FINDINGS: Status post right total hip arthroplasty. Femoral and acetabular components are well seated and aligned. No periprosthetic fracture. Expected postoperative soft tissue gas.\n\nIMPRESSION: Satisfactory postoperative appearance of right total hip arthroplasty.'),
        rep(-34, 'Cardiology', 'ECG 12-lead', 'Atrial fibrillation with controlled ventricular response, rate 78. No acute ST-T changes.\n\nIMPRESSION: Rate-controlled atrial fibrillation.', 'Cardiology'),
      ],
      notes: [
        note(-26, 'Procedure Note', OYE, 'physician', 'BRIEF OPERATIVE NOTE\n\nProcedure: Right total hip arthroplasty, posterior approach.\nSurgeon: Oyelaran. Anesthesia: spinal with sedation.\nEstimated blood loss: 350 mL. Fluids: 1,500 mL crystalloid. Complications: none.\nDisposition: PACU then 4 East in stable condition.\n\nPLAN: Weight bearing as tolerated with posterior hip precautions. Cefazolin x2 postoperative doses. Resume warfarin tonight for atrial fibrillation; warfarin also serves as VTE prophylaxis. AVOID NSAIDs while anticoagulated. PT/OT to see POD 1. Check CBC and INR in the morning.'),
        note(-5, 'Progress Note', OYE, 'physician', 'ORTHOPEDIC PROGRESS NOTE - POD 1\n\nS: Pain 4-6/10, controlled with oxycodone and scheduled acetaminophen. No chest pain or dyspnea. Tolerating diet.\nO: Afebrile, HR 78 irregular, BP 128/74. Dressing clean, dry and intact. Neurovascularly intact distally, calves soft.\nLabs: Hgb 9.1 (from 13.4 pre-op), INR 1.6.\nA/P: POD 1 right THA, doing well. Acute blood loss anemia, expected, asymptomatic: recheck CBC tomorrow. Continue warfarin, goal INR 2-3. PT/OT today. Anticipate discharge home POD 2-3.'),
      ],
      encounters: [enc(21, 'Office Visit', 'Orthopedic Clinic', OYE, 'Pre-operative visit, right hip OA'), enc(60, 'Anticoagulation Visit', 'Anticoagulation Clinic', 'Mbeki, Thandi PharmD', 'Warfarin management')],
    }, -30, OYE, [['code_full'], ['warfarin'], ['cefazolin'], ['oxycodone'], ['acetaminophen', { dose: '1,000 mg', freq: 'Q8H', prn: false }], ['metoprolol'], ['tamsulosin'], ['pantoprazole'], ['sennadocusate'], ['wbat', { comment: 'Posterior hip precautions' }], ['fall'], ['scd'], ['c_ptot'], ['diet_reg']]));

    /* 4 — DKA */
    patients.push(mk({
      id: 'p4', mrn: '10060334', name: 'Kahale, Leilani', dob: '1997-05-09', sex: 'F', unit: '5 West Medicine', bed: '5W-502 (step-down)', rn: RN2,
      cc: 'Nausea, vomiting, abdominal pain', dx: 'Diabetic ketoacidosis, type 1 diabetes', codeStatus: 'Full Code', isolation: '', height: 165, weight: 58.5,
      allergies: [al('Sulfonamide antibiotics', 'sulfa', 'Diffuse rash', 'Moderate')],
      problems: [prob('Diabetic ketoacidosis', 0), prob('Type 1 diabetes mellitus (insulin pump)', 5500), prob('Acute kidney injury, prerenal', 0)],
      vitals: vitals(-10, 2, { t: 37.0, hr: 124, rr: 28, s: 102, d: 62, o: 98, o2: 'Room air', p: 5 }, { t: 36.9, hr: 98, rr: 18, s: 114, d: 70, o: 99, o2: 'Room air', p: 2 }, RN2),
      labs: labs([
        [-9.5, 'BMP, VBG, BHB, CBC, Mg, Phos, A1c', { Na: 131, K: 5.6, Cl: 94, CO2: 11, AG: 26, BUN: 28, Cr: 1.4, Glu: 486, Ca: 9.4, pH: 7.18, pCO2: 26, HCO3: 10, BHB: 6.2, WBC: 15.1, Hgb: 14.8, Hct: 44.0, Plt: 340, Mg: 2.0, Phos: 2.4, A1c: 10.4 }],
        [-5.5, 'BMP', { Na: 135, K: 4.4, Cl: 102, CO2: 15, AG: 18, BUN: 22, Cr: 1.1, Glu: 298, Ca: 9.0 }],
        [-1.5, 'BMP, BHB', { Na: 137, K: 3.7, Cl: 105, CO2: 19, AG: 13, BUN: 17, Cr: 0.9, Glu: 214, Ca: 8.8, BHB: 1.8 }],
      ]),
      reports: [
        rep(-9.5, 'Microbiology / Other', 'Urinalysis with reflex microscopy', 'Specific gravity 1.030. Glucose 3+. Ketones 3+. Protein trace. Leukocyte esterase negative. Nitrite negative.\nUrine hCG: negative.', 'Laboratory'),
        rep(-9.5, 'Cardiology', 'ECG 12-lead', 'Sinus tachycardia, rate 122. Normal axis and intervals. No peaked T waves.\n\nIMPRESSION: Sinus tachycardia.', 'Cardiology'),
      ],
      notes: [
        note(-9, 'H&P', PARK, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Vomiting and abdominal pain since last night.\n\nHPI: 29 y.o. woman with type 1 diabetes on an insulin pump presenting with 18 hours of nausea, vomiting, diffuse abdominal pain, polyuria and polydipsia. Pump infusion site was found kinked this morning. No fever, dysuria or cough. Last A1c 9.8% six months ago.\n\nALLERGIES: Sulfonamide antibiotics (rash).\n\nEXAM: HR 124, BP 102/62, RR 28 with Kussmaul respirations, afebrile. Dry mucous membranes. Abdomen diffusely tender without guarding. Alert and oriented.\n\nDATA: Glucose 486, bicarbonate 11, anion gap 26, pH 7.18, beta-hydroxybutyrate 6.2, K 5.6, Cr 1.4.\n\nASSESSMENT & PLAN:\n1. DKA, moderate, from insulin pump failure. 2 L normal saline given. Insulin infusion per DKA protocol. BMP every 4 hours, POC glucose hourly. Add dextrose and potassium to fluids once glucose < 250 and K < 5.3. Transition to subcutaneous insulin when anion gap closes and patient is eating.\n2. Prerenal AKI: fluids, trend creatinine.\n3. Pump: remove, endocrinology and diabetes educator to see.\nNPO except ice chips. Code status: Full.'),
      ],
      encounters: [enc(180, 'Office Visit', 'Endocrinology Clinic', 'Deshmukh, Anika MD', 'Type 1 diabetes, pump management')],
    }, -10, PARK, [['code_full'], ['insulin_gtt'], ['d5halfns_k'], ['ondansetron'], ['enoxaparin'], ['npo', { comment: 'Ice chips allowed' }], ['io'], ['tele'], ['c_endo']]));

    /* 5 — GI bleed, DNR, contrast allergy */
    patients.push(mk({
      id: 'p5', mrn: '10027719', name: 'Chen, Robert', dob: '1945-09-30', sex: 'M', unit: '5 West Medicine', bed: '5W-515', rn: RN1,
      cc: 'Black stools, lightheadedness', dx: 'Upper GI bleed due to duodenal ulcer', codeStatus: 'DNR/DNI', isolation: '', height: 168, weight: 66.3,
      allergies: [al('Iodinated contrast media', 'contrast', 'Hives', 'Moderate')],
      problems: [prob('Upper GI bleed due to duodenal ulcer', 1), prob('Acute blood loss anemia', 1), prob('Coronary artery disease, stent 2019', 2600), prob('Hypertension', 6000), prob('Osteoarthritis of knees (chronic NSAID use)', 2000), prob('Mild cognitive impairment', 500)],
      vitals: vitals(-26, 4, { t: 36.6, hr: 108, rr: 20, s: 92, d: 54, o: 97, o2: 'Room air', p: 2 }, { t: 36.7, hr: 84, rr: 16, s: 118, d: 68, o: 97, o2: 'Room air', p: 0 }, RN1),
      labs: labs([
        [-25, 'CBC, BMP, PT/INR, Lactate, Troponin', { WBC: 9.8, Hgb: 6.9, Hct: 21.2, Plt: 232, Na: 139, K: 4.3, Cl: 105, CO2: 23, BUN: 52, Cr: 1.2, Glu: 110, Ca: 8.5, INR: 1.1, Lactate: 2.2, Trop: 0.01 }],
        [-18, 'CBC (post-transfusion)', { WBC: 9.1, Hgb: 8.4, Hct: 25.6, Plt: 221 }],
        [-10, 'CBC', { WBC: 8.8, Hgb: 8.1, Hct: 24.9, Plt: 215 }],
        [-3, 'CBC, BMP', { WBC: 8.4, Hgb: 8.3, Hct: 25.3, Plt: 210, Na: 140, K: 4.1, Cl: 106, CO2: 24, BUN: 31, Cr: 1.0, Glu: 98, Ca: 8.4 }],
      ]),
      reports: [
        rep(-20, 'Procedure', 'Esophagogastroduodenoscopy (EGD)', 'FINDINGS: Normal esophagus. Mild antral gastritis. 1.2 cm ulcer in the duodenal bulb with a non-bleeding visible vessel (Forrest IIa). Treated with epinephrine injection and placement of two hemostatic clips with good hemostasis. Antral biopsies obtained for H. pylori.\n\nIMPRESSION: Duodenal ulcer with high-risk stigmata, treated endoscopically.\nRECOMMENDATIONS: IV pantoprazole infusion for 72 hours. Clear liquids, advance as tolerated. Avoid NSAIDs. Hold aspirin for now and discuss timing with cardiology.', 'Gastroenterology'),
        rep(-25, 'Cardiology', 'ECG 12-lead', 'Sinus tachycardia, rate 106. No ST-segment deviation.\n\nIMPRESSION: Sinus tachycardia, no acute ischemic changes.', 'Cardiology'),
        rep(-25, 'Microbiology / Other', 'Type and screen', 'ABO/Rh: A positive.\nAntibody screen: negative.\n2 units packed red blood cells crossmatched and issued.', 'Blood Bank'),
      ],
      notes: [
        note(-24, 'H&P', VAS, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Black stools for 2 days, lightheaded on standing.\n\nHPI: 81 y.o. man with CAD (stent 2019, on aspirin), hypertension and knee osteoarthritis who has taken naproxen twice daily for the past month. Presents with 2 days of melena and orthostatic lightheadedness. No hematemesis, chest pain or abdominal pain.\n\nALLERGIES: Iodinated contrast (hives).\n\nEXAM: HR 108, BP 92/54, pale conjunctivae, abdomen soft and non-tender, melena on rectal exam.\n\nDATA: Hgb 6.9 (baseline 13), BUN 52, Cr 1.2, INR 1.1, troponin negative.\n\nASSESSMENT & PLAN:\n1. Upper GI bleed, likely NSAID-induced peptic ulcer. Two large-bore IVs, transfuse 2 units PRBC, IV pantoprazole, GI consulted for EGD today. STOP naproxen permanently.\n2. Acute blood loss anemia: CBC every 8 hours, transfuse for Hgb < 8 given CAD.\n3. CAD: hold aspirin and metoprolol while bleeding and hypotensive.\n4. Goals of care: patient confirms DNR/DNI with daughter (health care agent) at bedside. POLST on file.'),
        note(-8, 'Nursing Note', RN1, 'nurse', 'NURSING NOTE\n\nNo further melena this shift. Hemodynamically stable, HR 80s, BP 110s/60s. Pantoprazole infusion running. Tolerating clear liquids without nausea. Oriented to person and place, reoriented to date. Bed alarm on, daughter at bedside for most of the evening. DNR/DNI band in place.'),
      ],
      encounters: [enc(45, 'Office Visit', 'Primary Care', 'Iwasaki, Glenn MD', 'Knee pain'), enc(200, 'Office Visit', 'Cardiology Clinic', 'Fontaine, Rhea MD', 'Coronary artery disease follow-up')],
    }, -26, VAS, [['code_dnr'], ['pantoprazole_gtt'], ['ns'], ['atorvastatin'], ['diet_clear'], ['tele'], ['fall'], ['scd'], ['c_gi']]));

    /* 6 — COPD exacerbation */
    patients.push(mk({
      id: 'p6', mrn: '10055402', name: 'Kowalski, Diane', dob: '1963-11-11', sex: 'F', unit: '5 West Medicine', bed: '5W-520', rn: RN2,
      cc: 'Worsening shortness of breath and wheezing', dx: 'Acute exacerbation of COPD', codeStatus: 'Full Code', isolation: 'Droplet', height: 158, weight: 52.0,
      allergies: [al('Levofloxacin (fluoroquinolones)', 'fluoroquinolone', 'Achilles tendon pain', 'Moderate', 'Intolerance'), al('Latex', '', 'Contact dermatitis', 'Low', 'Environmental')],
      problems: [prob('Acute exacerbation of COPD (GOLD 3)', 1), prob('Chronic hypoxic respiratory failure, 2 L home oxygen', 800), prob('Tobacco use disorder', 12000), prob('Generalized anxiety disorder', 3000), prob('Osteoporosis', 1500)],
      vitals: vitals(-16, 4, { t: 37.2, hr: 104, rr: 26, s: 146, d: 86, o: 87, o2: '2 L NC', p: 0 }, { t: 37.0, hr: 92, rr: 20, s: 138, d: 80, o: 91, o2: '3 L NC', p: 0 }, RN2),
      labs: labs([
        [-15, 'VBG, CBC, BMP, BNP, Troponin', { pH: 7.33, pCO2: 58, HCO3: 30, WBC: 11.9, Hgb: 15.2, Hct: 46.0, Plt: 265, Na: 140, K: 4.2, Cl: 99, CO2: 31, BUN: 16, Cr: 0.7, Glu: 132, Ca: 9.1, BNP: 88, Trop: 0.01 }],
        [-2, 'BMP', { Na: 139, K: 3.9, Cl: 98, CO2: 32, BUN: 18, Cr: 0.7, Glu: 188, Ca: 9.0 }],
      ]),
      reports: [
        rep(-15, 'Imaging', 'XR chest 2 views', 'FINDINGS: Hyperinflated lungs with flattened hemidiaphragms. No focal consolidation, effusion or pneumothorax. Heart size normal.\n\nIMPRESSION: Emphysematous changes. No acute cardiopulmonary process.'),
        rep(-11, 'Microbiology / Other', 'Respiratory viral panel (PCR)', 'DETECTED: Rhinovirus/enterovirus.\nNot detected: influenza A/B, RSV, SARS-CoV-2, parainfluenza, adenovirus, human metapneumovirus.', 'Microbiology'),
      ],
      notes: [
        note(-14, 'H&P', VAS, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Shortness of breath for 2 days.\n\nHPI: 63 y.o. woman with GOLD 3 COPD on 2 L home oxygen and ongoing tobacco use (40 pack-years) presenting with 2 days of worsening dyspnea, wheeze and increased sputum volume and purulence after a cold. Using albuterol every 2 hours at home without relief. Two exacerbations in the past year, never intubated.\n\nALLERGIES: Levofloxacin (tendon pain), latex.\n\nEXAM: HR 104, BP 146/86, RR 26, SpO2 87% on 2 L. Pursed-lip breathing, accessory muscle use, diffuse expiratory wheeze with prolonged expiration.\n\nDATA: VBG 7.33/58, bicarbonate 30. WBC 11.9. CXR hyperinflation without infiltrate.\n\nASSESSMENT & PLAN:\n1. Acute COPD exacerbation, viral trigger likely. Scheduled ipratropium-albuterol nebulizers, prednisone 40 mg daily x5 days, azithromycin x5 days. Oxygen titrated to SpO2 88-92%; avoid over-oxygenation given chronic hypercapnia. Low threshold for BiPAP if rising pCO2 or fatigue.\n2. Tobacco use: nicotine patch, cessation counseling.\n3. VTE prophylaxis: enoxaparin.\nDroplet precautions. Code status: Full.'),
      ],
      encounters: [enc(75, 'Office Visit', 'Pulmonary Clinic', 'Aldana, Rafael MD', 'COPD follow-up'), enc(130, 'Hospital Encounter', '5 West Medicine', VAS, 'COPD exacerbation')],
    }, -16, VAS, [['code_full'], ['duoneb'], ['albuterol'], ['prednisone'], ['azithromycin'], ['enoxaparin'], ['nicotine'], ['o2', { comment: 'Target SpO2 88-92%' }], ['iso_droplet'], ['vs_q4'], ['diet_reg']]));

    /* 7 — cellulitis. A sound-alike for Santos, Maria: same surname, a first name one letter away, and a date
       of birth and MRN with two digits swapped. She has no drug allergies, so mixing the two charts up matters. */
    patients.push(mk({
      id: 'p7', mrn: '10051787', name: 'Santos, Marie', dob: '1972-02-07', sex: 'F', unit: '5 West Medicine', bed: '5W-506', rn: RN1, nameAlert: true,
      cc: 'Red, painful, swollen left lower leg', dx: 'Cellulitis of the left lower leg', codeStatus: 'Full Code', isolation: '', height: 163, weight: 82.5,
      allergies: [],
      problems: [prob('Cellulitis of the left lower leg', 1), prob('Type 2 diabetes mellitus', 2200), prob('Hypertension', 2800)],
      vitals: vitals(-28, 4, { t: 38.3, hr: 102, rr: 18, s: 142, d: 84, o: 98, o2: 'Room air', p: 6 }, { t: 37.3, hr: 84, rr: 16, s: 132, d: 78, o: 98, o2: 'Room air', p: 3 }, RN1),
      labs: labs([
        [-27, 'CBC, BMP, Lactate, A1c', { WBC: 13.4, Hgb: 13.1, Hct: 39.4, Plt: 286, Na: 138, K: 4.1, Cl: 102, CO2: 24, BUN: 15, Cr: 0.8, Glu: 186, Ca: 9.1, Lactate: 1.2, A1c: 7.9 }],
        [-4, 'CBC, BMP', { WBC: 11.8, Hgb: 12.8, Hct: 38.5, Plt: 279, Na: 139, K: 4.0, Cl: 103, CO2: 25, BUN: 14, Cr: 0.8, Glu: 162, Ca: 9.0 }],
      ]),
      reports: [
        rep(-26, 'Imaging', 'XR left tibia and fibula', 'FINDINGS: Soft tissue swelling of the lower leg. No fracture. No soft tissue gas. No radiopaque foreign body. No periosteal reaction.\n\nIMPRESSION: Soft tissue swelling without gas or bony abnormality.'),
        rep(-20, 'Microbiology / Other', 'Blood culture ×2', 'PRELIMINARY: No growth at 12 hours. Final report to follow.', 'Microbiology'),
      ],
      notes: [
        note(-26, 'H&P', PARK, 'physician', 'HISTORY & PHYSICAL\n\nCHIEF COMPLAINT: Red, painful left lower leg for 3 days.\n\nHPI: 54 y.o. woman with type 2 diabetes and hypertension presenting with 3 days of spreading redness, warmth and pain of the left lower leg after a scratch from gardening. Fever to 38.5 at home. No drainage. No chest pain or shortness of breath. No recent travel or immobility.\n\nALLERGIES: No known drug allergies. NOTE: another patient on this unit has a very similar name (Santos, Maria). Check two identifiers.\n\nEXAM: T 38.3, HR 102, BP 142/84, SpO2 98% on room air. Left lower leg: a warm, tender, red area from ankle to mid-shin with a clear border (marked with a pen). No fluctuance, crepitus or blistering. Pulses intact. Calf soft.\n\nDATA: WBC 13.4, lactate 1.2, glucose 186, A1c 7.9. X-ray: no gas, no bony change.\n\nASSESSMENT & PLAN:\n1. Cellulitis of the left lower leg without abscess, failed to improve at home: IV cefazolin. Elevate the leg. Mark the border and recheck daily. Blood cultures sent.\n2. Type 2 diabetes: continue metformin, consistent carbohydrate diet, glucose checks.\n3. Hypertension: continue amlodipine.\n4. VTE prophylaxis: enoxaparin.\nCode status: Full.'),
        note(-7, 'Nursing Note', RN1, 'nurse', 'NURSING NOTE\n\nAfebrile this shift. Redness has pulled back about 2 cm inside the pen line. Pain 3/10 with acetaminophen. Leg elevated on two pillows. Walking to the bathroom independently. Name-alert sticker on the chart and the door: SANTOS, MARIE and SANTOS, MARIA are both on 5 West. Two identifiers checked with every medication.'),
      ],
      encounters: [enc(120, 'Office Visit', 'Primary Care', 'Iwasaki, Glenn MD', 'Diabetes follow-up')],
    }, -28, PARK, [['code_full'], ['cefazolin'], ['acetaminophen'], ['metformin'], ['amlodipine'], ['enoxaparin'], ['poc_glu'], ['vs_q4'], ['diet_carb']]));
    patients.find((p) => p.id === 'p2').nameAlert = true;

    /* Back-fill the MAR: scheduled doses due before ~50 minutes ago were given by the assigned nurse. */
    patients.forEach((p) => {
      for (let day = E.dayStart(-3); day <= E.dayStart(0); day += 24 * E.HOUR) {
        p.orders.forEach((o) => E.dueTimes(o, day).forEach((due) => {
          if (due < now - 50 * 60000) p.mar.push({ id: E.uid('ma'), orderId: o.id, dueTs: due, action: 'Given', ts: due + Math.round(rand() * 12) * 60000, by: p.rn, dose: o.dose, comment: '' });
        }));
      }
      // one PRN dose each, a few hours back
      const prn = p.orders.find((o) => o.type === 'med' && o.prn);
      if (prn && p.admitTs < T(-5)) p.mar.push({ id: E.uid('ma'), orderId: prn.id, dueTs: null, action: 'Given', ts: T(-4.5), by: p.rn, dose: prn.dose, comment: '' });
    });

    const inbox = [
      { type: 'Staff Message', from: 'Sim Faculty', subject: 'Welcome to the training sim', patientId: null, act: null,
        body: 'Welcome! This is a practice EHR. Every patient is fictional, and nothing you do here reaches a real chart.\n\nStart with the Learning tab in the top toolbar. It lists the objectives for this sim, the practice tasks for each one, and a short knowledge check. Tasks are checked off automatically as you complete them in the charts.\n\nUse Help in the toolbar for a quick tour and a list of how sim features map to the names used in Epic.' },
      { type: 'Result', from: 'Laboratory', subject: 'CRITICAL: Hemoglobin 6.9 g/dL — Chen, Robert', patientId: 'p5', act: 'results', critical: true, ts: T(-24.8),
        body: 'Critical value called to and read back by the bedside nurse.\n\nHemoglobin 6.9 g/dL (reference 12.0-17.5).' },
      { type: 'Result', from: 'Laboratory', subject: 'Abnormal: Potassium 5.1 mmol/L — Akana, Keoni', patientId: 'p1', act: 'results', ts: T(-3.8),
        body: 'Potassium 5.1 mmol/L (reference 3.5-5.0).\nCreatinine 2.1 mg/dL (reference 0.6-1.3).' },
      { type: 'Staff Message', from: RN2, subject: 'Santos, Maria — potassium 3.3 this morning', patientId: 'p2', act: 'orders', ts: T(-2.5),
        body: 'Hi team, Ms. Santos has a potassium of 3.3 on morning labs. Would you like to replace it? She is tolerating oral intake. Thanks, Hana' },
      // a message a patient started, so the Inbox shows patient threads from the first visit
      { type: 'Patient Message', from: 'Whitfield, James (patient)', subject: 'Message from Whitfield, James', patientId: 'p3', act: 'summary', ts: T(-0.7), asked: [],
        body: 'Hello, this is James Whitfield in 417. Nobody has told me the plan for my blood thinner. I take it for my irregular heartbeat and I would like to know when I start it again. Thank you.',
        thread: [{ who: 'patient', ts: T(-0.7), text: 'Hello, this is James Whitfield in 417. Nobody has told me the plan for my blood thinner. I take it for my irregular heartbeat and I would like to know when I start it again. Thank you.' }] },
    ].map((m) => Object.assign({ id: E.uid('m'), ts: T(-1), read: false, roles: null }, m));

    return { version: E.SEED_VERSION, createdAt: now, user: null, openTabs: [], patients, inbox, audit: [], progress: {} };
  };
})();
