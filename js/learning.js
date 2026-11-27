/* SIM+EHR Student Edition — learning objectives and assessment.

   FACULTY: this file is the curriculum. Edit it freely.
   Each objective is mapped to one of the AAMC Core Entrustable Professional Activities for
   Entering Residency (EPA number and title as published by the AAMC). The objective statements,
   practice tasks and knowledge-check questions are written for this sim; they are not AAMC
   text. Review them against your school's program objectives before using them for grading.

   A task is checked off when the app records its `event` for the logged-in learner
   (see EHR.track calls in app.js). */
(function () {
  const E = window.EHR;

  E.EPA_SOURCE = 'AAMC Core Entrustable Professional Activities for Entering Residency';

  E.LEARNING = [
    {
      id: 'lo1', epa: 'EPA 3', epaTitle: 'Recommend and interpret common diagnostic and screening tests',
      objective: 'Choose, find, trend and interpret laboratory and diagnostic results in the EHR.',
      scope: 'The EHR part of EPA 3: choosing, finding, trending and interpreting results in the inpatient record. Screening tests and the conversation with the patient are not covered.',
      tasks: [
        { event: 'results.trend', text: 'In Results, select a lab component to view its trend over time (try creatinine for Akana, Keoni).' },
        { event: 'report.view', text: 'Open an imaging or diagnostic report and read the impression.' },
        { event: 'lab.order', text: 'Order a lab test for a patient.' },
        { event: 'result.read', text: 'Open a result message in the Inbox and go to the chart from it.' },
      ],
      quiz: [
        { id: 'q1a', q: 'Leilani Kahale’s anion gap went from 26 to 18 to 13 over nine hours on an insulin infusion. What does the trend show?', options: ['Her ketoacidosis is resolving', 'She is developing lactic acidosis', 'The insulin infusion is not working', 'A lab error; anion gap cannot change that quickly'], answer: 0, why: 'A closing anion gap with rising bicarbonate is the marker of resolving DKA. The trend, not a single value, guides the transition off the insulin infusion.' },
        { id: 'q1b', q: 'A result is flagged “H” but is only slightly outside the reference range. What is the best first step?', options: ['Ignore it; mild flags never matter', 'Compare with the patient’s prior values and clinical picture', 'Repeat the test until it is normal', 'Treat immediately to bring it into range'], answer: 1, why: 'Flags mark values outside a population reference range. Interpretation depends on the patient’s baseline and context, which is why the EHR shows trends.' },
        // FACULTY: new item (2026-11-27), not yet reviewed.
        { id: 'q1c', q: 'A 46-year-old has severe upper abdominal pain and vomiting after heavy drinking. Which test do you order first?', options: ['Serum lipase', 'CT of the abdomen with contrast', 'Abdominal x-ray', 'Upper endoscopy'], answer: 0, why: 'A lipase over three times normal with typical pain makes the diagnosis of pancreatitis. CT adds radiation and contrast and is kept for an unclear diagnosis or a patient who is not improving.' },
      ],
    },
    {
      id: 'lo2', epa: 'EPA 4', epaTitle: 'Enter and discuss orders and prescriptions',
      objective: 'Enter safe, complete orders and respond appropriately to clinical decision support.',
      scope: 'Inpatient orders and decision support. Prescriptions and medication reconciliation are not yet covered.',
      tasks: [
        { event: 'allergy.review', text: 'Review a patient’s allergies in Problems & Allergies before ordering.' },
        { event: 'order.submit', text: 'Search for an order, adjust its details, and sign it (students: pend for cosign).' },
        { event: 'order.set', text: 'Use an order set to place several related orders at once.' },
        { event: 'alert.allergy', text: 'Trigger and respond to an allergy advisory (try a penicillin-class antibiotic for Santos, Maria).' },
        { event: 'alert.other', text: 'Trigger and respond to an interaction or lab-based advisory (try ibuprofen for Whitfield, James).' },
      ],
      quiz: [
        { id: 'q2a', q: 'You order piperacillin-tazobactam for a patient with documented penicillin anaphylaxis and an allergy advisory fires. What should you do?', options: ['Override it; advisories fire too often to be useful', 'Remove the order and choose a non-beta-lactam alternative, discussing with your supervisor', 'Delete the allergy from the chart so the order goes through', 'Sign it and ask the nurse to watch for a reaction'], answer: 1, why: 'A high-severity allergy match is exactly what the advisory exists to catch. Overriding needs a real clinical reason and a supervisor’s agreement; editing the allergy list to silence an alert is unsafe.' },
        { id: 'q2b', q: 'As a medical student you enter admission orders. Why do they show as “Pended”?', options: ['The system is slow', 'Student orders take effect only after a licensed provider reviews and signs them', 'Pharmacy has rejected them', 'Pended orders are active but hidden from nurses'], answer: 1, why: 'Students can enter orders for learning, but a supervising provider must review and sign before anything is carried out. Be ready to explain the reason for each order.' },
        // FACULTY: new item (2026-11-27), not yet reviewed.
        { id: 'q2c', q: 'On admission, the pharmacy fill list shows metformin and lisinopril. The patient says he also takes naproxen most days for his knees. What do you base the inpatient orders on?', options: ['The pharmacy list only, because it is objective', 'Both, reconciled: the patient’s account adds what no pharmacy records', 'The patient’s memory only', 'Whatever the last discharge summary says'], answer: 1, why: 'Over-the-counter drugs and pills taken now and then appear on no fill list. Medication reconciliation compares every source, including the patient, and decides for each drug whether to continue, hold or stop it.' },
      ],
    },
    {
      id: 'lo3', epa: 'EPA 5', epaTitle: 'Document a clinical encounter in the patient record',
      objective: 'Write accurate, timely documentation using templates and data links without copying errors forward.',
      scope: 'Written notes in the inpatient record. Personal phrases, pick-lists and copy-forward are not yet practised; copied errors are practised in the Note Doctor game.',
      tasks: [
        { event: 'note.template', text: 'Start a new note from a template.' },
        { event: 'note.dot', text: 'Type a dot phrase in a note (for example .vitals followed by a space).' },
        { event: 'note.sign', text: 'Complete every *** placeholder and sign the note.' },
        { event: 'chart.update', text: 'Add an entry to a patient’s problem list or allergy list.' },
      ],
      quiz: [
        { id: 'q3a', q: 'You pull yesterday’s progress note forward as the starting point for today’s. What is your responsibility?', options: ['None; the prior author is responsible for the content', 'Review and update every section so the note reflects today’s findings and your own assessment', 'Change only the date', 'Add “copied” at the bottom'], answer: 1, why: 'Whoever signs a note attests to all of it. Copy-forward spreads outdated or wrong information unless each section is verified and updated.' },
        { id: 'q3b', q: 'A dot phrase inserts the latest vitals into your note. Thirty minutes later the patient’s blood pressure drops. What does your signed note show?', options: ['The new blood pressure, updated automatically', 'The values at the time you inserted them', 'Nothing; the vitals are removed', 'An average of both'], answer: 1, why: 'Inserted data is a snapshot. Check that pulled-in values are still current and still support your assessment before you sign.' },
        // FACULTY: new item (2026-11-27), not yet reviewed.
        { id: 'q3c', q: 'You inserted the morning labs with a dot phrase at 07:00. A new potassium of 5.9 posts at 14:00 before you sign. What do you do?', options: ['Sign; the note was accurate when written', 'Update the data and the assessment and plan before signing', 'Add an addendum tomorrow', 'Delete the labs section'], answer: 1, why: 'A signed note says what you knew and planned when you signed it. A new critical value changes the plan, so the note has to say so.' },
      ],
    },
    {
      id: 'lo4', epa: 'EPA 8', epaTitle: 'Give or receive a patient handover to transition care responsibility',
      objective: 'Use the EHR to prepare a structured handoff for a patient.',
      scope: 'Giving a written I-PASS handoff. Receiving a handoff is in the knowledge check only; the verbal handoff is not covered.',
      tasks: [
        { event: 'summary.view', text: 'Review a patient’s Summary to gather the current picture.' },
        { event: 'note.handoff', text: 'Write and sign a Handoff (I-PASS) note for one patient.' },
      ],
      quiz: [
        { id: 'q4a', q: 'Which item belongs in the “Situation awareness and contingency planning” part of an I-PASS handoff?', options: ['The full past surgical history', '“If hemoglobin is below 8 on the 22:00 CBC, transfuse one unit and call GI”', 'The patient’s insurance status', 'A list of every lab since admission'], answer: 1, why: 'Contingency plans tell the receiving clinician what might happen and what to do about it. That is the part of a handoff most often missing.' },
        // FACULTY: new items (2026-11-27), not yet reviewed.
        { id: 'q4b', q: 'The night handoff you receive says your patient is Full Code. The chart sidebar and the order say DNR/DNI. What do you do?', options: ['Trust the handoff; it is more recent', 'Trust the chart and say nothing', 'Raise it with the person handing off now, and confirm with the patient or the primary team', 'Wait until the patient deteriorates to sort it out'], answer: 2, why: 'A receiver checks what they are told. A wrong code status is found and fixed before it matters, by asking the person handing off and confirming at the source.' },
        { id: 'q4c', q: 'Which read-back shows the receiver understood the handoff?', options: ['“Got it, thanks.”', '“Mrs. K, COPD, watcher. If she gets drowsy, oxygen back to 88 to 92% and a blood gas.”', '“I will read the chart if anything happens.”', '“Anything else?”'], answer: 1, why: 'Synthesis by the receiver repeats the patient, the severity and the contingency in their own words, which shows the plan was heard and lets errors surface.' },
      ],
    },
    {
      id: 'lo5', epa: 'EPA 10', epaTitle: 'Recognize a patient requiring urgent or emergent care and initiate evaluation and management',
      objective: 'Use vital-sign trends and critical results in the EHR to recognize a deteriorating patient.',
      scope: 'Recognising deterioration from the record and choosing the first steps. Bedside assessment and spoken escalation are not covered.',
      tasks: [
        { event: 'vitals.trend', text: 'In Flowsheets, select a vital sign to view its trend.' },
        { event: 'critical.read', text: 'Open a critical result message in the Inbox.' },
        { event: 'code.review', text: 'Find a patient’s code status in the chart sidebar and confirm the matching order in Orders (see Chen, Robert).' },
      ],
      quiz: [
        { id: 'q5a', q: 'Robert Chen’s heart rate rises from 84 to 112 and his blood pressure falls to 90/52 four hours after endoscopy for a bleeding ulcer. What is the most appropriate first action?', options: ['Recheck vitals in four hours as ordered', 'Assess the patient now, notify the supervising physician, and check a hemoglobin', 'Document the vitals and continue rounds', 'Order a routine CBC for tomorrow morning'], answer: 1, why: 'Tachycardia with hypotension after a GI bleed suggests rebleeding. The trend in the flowsheet is the trigger to go to the bedside and escalate immediately.' },
        { id: 'q5b', q: 'Mr. Chen’s chart shows a code status of DNR/DNI. What does that mean for the situation above?', options: ['No treatment should be given', 'He should still be evaluated and treated; DNR/DNI limits CPR and intubation, not other care', 'Only comfort measures are allowed', 'Code status does not apply on a medical ward'], answer: 1, why: 'DNR/DNI is specific to resuscitation and intubation. Transfusion, endoscopy and escalation of care remain appropriate unless the patient has chosen otherwise.' },
        // FACULTY: new item (2026-11-27), not yet reviewed.
        { id: 'q5c', q: 'You page the attending about a patient with a new heart rate of 124 and blood pressure of 88/50. Which closing line is most useful?', options: ['“Just wanted to let you know.”', '“I am worried she is bleeding. I have sent a CBC and started fluids. Can you come and see her in the next 15 minutes?”', '“What do you want to do?”', '“I will keep an eye on her.”'], answer: 1, why: 'The R in SBAR is a clear request with a time frame. It tells the attending what you think is happening, what you have done, and what you need from them.' },
      ],
    },
    {
      id: 'lo6', epa: 'EPA 13', epaTitle: 'Identify system failures and contribute to a culture of safety and improvement',
      objective: 'Use the EHR in a way that protects patient safety and privacy.',
      scope: 'Using the record safely and protecting privacy. Reporting safety events is in the knowledge check only; taking part in improvement is not covered.',
      tasks: [
        { event: 'alert.removed', text: 'When an advisory identifies a real risk, remove the order rather than overriding it.' },
        { event: 'log.view', text: 'Open the Activity Log and see how every chart access and action is recorded.' },
        { event: 'mar.view', text: 'Open a patient’s MAR and check whether scheduled doses were given, held or are overdue.' },
        { event: 'allergy.process', text: 'Start to remove an allergy the proper way: give a reason, then read what the record does with your request.' },
      ],
      quiz: [
        { id: 'q6a', q: 'A classmate is admitted to your hospital. You are not on their care team but are curious how they are doing. Opening their chart is:', options: ['Fine, as long as you do not tell anyone', 'Fine if you only look at the summary', 'A privacy violation; access is limited to patients you are caring for, and every access is logged', 'Allowed for students for educational purposes'], answer: 2, why: 'Chart access must be for treatment, payment or operations related to your role. EHRs record every access, and audits routinely find this kind of snooping.' },
        { id: 'q6b', q: 'You notice the allergy list says “penicillin - anaphylaxis” but the patient tells you they have taken amoxicillin since without a problem. What should you do?', options: ['Nothing; the list is someone else’s responsibility', 'Delete the allergy yourself right away', 'Tell your supervising physician and make sure the history is clarified and the record updated', 'Mention it in your note only'], answer: 2, why: 'Inaccurate allergy lists cause harm in both directions. Raising discrepancies so the record gets corrected through the proper process is part of contributing to safety.' },
        // FACULTY: new item (2026-11-27), not yet reviewed.
        { id: 'q6c', q: 'Pharmacy stopped an order you wrote for a drug the patient is allergic to. The patient was never exposed. Should it be reported as a safety event?', options: ['No, nothing happened', 'Yes; near misses show where the system almost failed, and they are the cheapest lessons to learn from', 'Only if the attending asks', 'Only if it happens twice'], answer: 1, why: 'Near misses and harm come from the same weak points. Reporting them lets the hospital fix the system before a patient is hurt.' },
      ],
    },
  ];

  /* The notice bar. One of these is shown per visit, always followed by the fixed rule
     "Never enter real patient information." Keep them light, and keep each one saying that the patients are not real. */
  E.QUIPS = [
    'No real patients were harmed, billed or charted in the making of this record.',
    'Every patient here is imaginary, which is why none of them has complained about the food.',
    'Everyone in this hospital is made up, including the attending who always answers pages.',
    'These patients are fictional. Their potassium, sadly, still will not fix itself.',
    'Pigs fly here, so you can assume the patients are not real either.',
    'Our patients are made of pixels and good intentions.',
    'No one in this hospital exists, so nobody will mind if you take your time.',
    'Every chart here is fiction. The handwriting, sadly, is realistic.',
  ];

  /* Shown on the loading screen. Each one is true of this sim and of EHRs generally. */
  E.FACTS = [
    'An EHR records every chart you open. Access is audited, so open only the charts of patients you are caring for.',
    'Allergy advisories are only as good as the allergy list. Keeping it accurate is part of the job.',
    'A dot phrase pulls data into your note as a snapshot. It does not update after you insert it.',
    'Orders entered by a student stay pended until a licensed provider reviews and signs them.',
    'A trend tells you more than a single value. Select any lab row in Results to graph it.',
    'On the MAR, the patient wristband and the medication are both scanned before a dose is given.',
  ];

  E.NOTE_TEMPLATES['Handoff (I-PASS)'] =
    'HANDOFF (I-PASS)\nPatient: {{name}}, {{age}} y.o. {{sex}}   MRN: {{mrn}}\nDate: {{date}}\n\n' +
    'I - ILLNESS SEVERITY (stable / watcher / unstable): ***\n\n' +
    'P - PATIENT SUMMARY:\n***\nActive problems:\n{{problems}}\nLatest vitals: {{vitals}}\n\n' +
    'A - ACTION LIST (to do this shift):\n- ***\n\n' +
    'S - SITUATION AWARENESS & CONTINGENCY PLANNING (if ... then ...):\n- ***\n\n' +
    'S - SYNTHESIS BY RECEIVER: ***\n\n{{me}}';

  /* ---------- per-learner progress ---------- */
  const key = (u) => (u.name.trim().toLowerCase() + '|' + u.role);
  E.progress = () => {
    const u = E.db.user;
    const all = E.db.progress || (E.db.progress = {});
    // rankHeld 0: a learner who starts under the rank rules below has no old title to keep
    return all[key(u)] || (all[key(u)] = { name: u.name, role: u.role, events: {}, quiz: {}, rankHeld: 0, levelsV: E.LEVELS_V });
  };
  /** Record that the current learner did something. Returns the practice task it completed, if any, the first time. */
  E.track = (event) => {
    if (!E.db.user) return null;
    const pr = E.progress();
    if (pr.events[event]) return null;
    pr.events[event] = Date.now();
    for (const lo of E.LEARNING) { const t = lo.tasks.find((x) => x.event === event); if (t) return t; }
    return null;
  };

  /* ---------- game layer: experience points, levels, badges ----------
     Points reward doing the work and getting the knowledge check right first time.
     Nothing is ever deducted, so there is no incentive to avoid trying. */
  E.XP = { task: 50, quizRight: 100, quizTried: 25, pig: 1, pigMax: 10, star: 50, exam: 300, game: 10, gameMax: 50, shift: 200, case: 60 };   // case: per star on a PBL case (best result on each case counts)     // shift: a full score on a shift (best result on each shift counts, in proportion)   // game: per perfect mini-game round, up to gameMax per game   // star: per mission star (best result counts); exam: passing the proficiency check   // pigMax: the most bonus points flying pigs can ever add
  /** How many flying pigs this learner has caught. Every catch is counted, even past the bonus limit.
      (The old pr.bonus field is moved to pr.pigs when a save is loaded: js/core.js, E.MIGRATIONS[1].) */
  E.pigs = (pr) => Number(pr.pigs) || 0;
  /* The top rank's XP is what every practice task, every knowledge-check question right first time and gold on every
     mission add up to (22 x 50 + 18 x 100 + 18 x 50 = 3800), so the demonstrations in E.RANK_NEEDS are what gate the
     upper ranks. The thresholds below it keep the same proportions. FACULTY: if you add tasks or questions, move the
     thresholds with them, raise E.LEVELS_V and copy the old thresholds into E.LEVELS_BEFORE, so nobody loses a rank. */
  E.LEVELS = [[0, 'New Arrival'], [500, 'Observer'], [1100, 'Clerk'], [1950, 'Sub-Intern'], [2950, 'Acting Intern'], [3800, 'Ready for the Wards']];
  E.LEVELS_V = 2;
  E.LEVELS_BEFORE = [0, 400, 900, 1600, 2400, 3100];   // version 1, until 2026-11-27 (11 questions)

  /* ---------- what the records say the learner has shown, read defensively (older saves lack fields) ---------- */
  const vals = (o) => (o && typeof o === 'object' ? Object.values(o).filter((x) => x && typeof x === 'object') : []);
  const plays = (r) => (Array.isArray(r.history) ? r.history : []).concat(r.last && typeof r.last === 'object' ? [r.last] : []);
  /** A shift finished with a pass: graded Pass or Honors (70% or more; js/shift.js). */
  E.shiftPassed = (pr) => vals(pr.shifts).some((r) => (r.best || 0) >= 0.7 || plays(r).some((h) => h.grade === 'Pass' || h.grade === 'Honors'));
  E.shiftHonors = (pr) => vals(pr.shifts).some((r) => plays(r).some((h) => h.grade === 'Honors'));
  /** A case finished with a good ending: the 'well' outcome, which always earns two or three stars (js/cases.js). */
  const caseGood = (r) => !!r && ((r.best || 0) >= 2 || plays(r).some((h) => h.outcome === 'well'));
  E.caseGood = (pr) => vals(pr.cases).some(caseGood);
  E.caseAllGood = (pr) => { const all = E.CASES || []; return all.length > 0 && all.every((cs) => caseGood((pr.cases || {})[cs.id])); };
  E.examPassed = (pr) => !!(pr.exam && pr.exam.passed);
  /** A patient harmed by the learner's order, then stabilised because the learner responded in time (js/shift.js). */
  E.harmRescued = (pr) => !!(pr.safety && Array.isArray(pr.safety.events) && pr.safety.events.some((e) => e && e.kind === 'harm' && e.outcome === 'rescued'));

  /* Ranks that mean something. Tasks, the knowledge check and mission stars alone add up to the top rank's XP, so
     each upper rank also asks for a demonstration. XP is never deducted and the bar still fills; a learner with the
     XP but not the demonstration is told exactly what is needed. Keyed by rank title so faculty can re-space
     E.LEVELS. A rank someone already held under the old XP-only rule is kept, with its requirement listed "to confirm". */
  E.RANK_NEEDS = {
    'Sub-Intern': { test: E.shiftPassed, todo: 'Pass one shift', done: 'one shift passed', short: 'Pass one shift' },
    'Acting Intern': { test: E.caseGood, todo: 'Finish one case with a good ending', done: 'one case with a good ending', short: 'Get a good case ending' },
    'Ready for the Wards': { test: E.examPassed, todo: 'Pass the proficiency check', done: 'the proficiency check passed', short: 'Pass the proficiency check' },
  };   // short: the level widget's line, where there is room for a few words only
  /** XP by source. The parts always add up to the total the level is worked out from. */
  E.xpParts = (pr) => {
    const s = E.progressSummary(pr), num = (f) => { const n = f ? Number(f(pr)) : 0; return isFinite(n) ? n : 0; };
    return {
      tasks: s.tasksDone * E.XP.task,
      quiz: s.quizCorrect * E.XP.quizRight + (s.quizAnswered - s.quizCorrect) * E.XP.quizTried,
      pigs: Math.min(E.pigs(pr) * E.XP.pig, E.XP.pigMax),   // flying pigs: a small bonus, capped
      missions: E.missionStars(pr) * E.XP.star,
      exam: E.examPassed(pr) ? E.XP.exam : 0,
      games: num(E.gameXp), shifts: num(E.shiftXp), cases: num(E.caseXp),
    };
  };
  E.BADGES = [
    { id: 'lo1', name: 'Results Detective', glyph: 'results', how: 'Finish every task and question for EPA 3.' },
    { id: 'lo2', name: 'Safe Orderer', glyph: 'orders', how: 'Finish every task and question for EPA 4.' },
    { id: 'lo3', name: 'Chart Scribe', glyph: 'notes', how: 'Finish every task and question for EPA 5.' },
    { id: 'lo4', name: 'Clean Handoff', glyph: 'patients', how: 'Finish every task and question for EPA 8.' },
    { id: 'lo5', name: 'Early Warning', glyph: 'code', how: 'Finish every task and question for EPA 10.' },
    { id: 'lo6', name: 'Safety Net', glyph: 'problems', how: 'Finish every task and question for EPA 13.' },
    { id: 'catch', name: 'Good Catch', glyph: 'warn', how: 'Remove an order after a high-risk advisory instead of overriding it.' },
    { id: 'scholar', name: 'Honor Roll', glyph: 'trophy', how: 'Get every knowledge-check question right, on the first try or on a retry.' },
    { id: 'mission', name: 'First Mission', glyph: 'star', how: 'Earn a star on any mission.' },
    { id: 'allstar', name: 'All-Star', glyph: 'medal', how: 'Earn gold on every mission.' },
    { id: 'responder', name: 'Rapid Responder', glyph: 'vitals', how: 'Notice a patient getting worse during a mission, and act.' },
    { id: 'proficient', name: 'Proficient', glyph: 'idcard', how: 'Pass the proficiency check.' },
    { id: 'shift', name: 'First Shift', glyph: 'log', how: 'Finish a shift with a pass.' },
    { id: 'honors', name: 'Honors', glyph: 'learning', how: 'Finish a shift with Honors.' },
    { id: 'case', name: 'Good Outcome', glyph: 'summary', how: 'Finish a case with a good ending.' },
    { id: 'allcases', name: 'Case Closed', glyph: 'review', how: 'Finish every case with a good ending.' },
    { id: 'rescue', name: 'Turned It Around', glyph: 'add', how: 'Stabilise a patient harmed by one of your orders, in time.' },
  ];
  /** Stars earned on missions: the best result on each one. */
  E.missionStars = (pr) => Object.values(pr.missions || {}).reduce((n, r) => n + (r.best || 0), 0);
  /** The knowledge check counts as clean when every question was right first time or on a retry (retries earn no XP). */
  E.quizClean = (pr) => E.LEARNING.every((lo) => lo.quiz.every((q) => pr.quiz[q.id] === q.answer || E.quizRetryRight(pr, q)));
  const BADGE_TEST = {
    catch: (pr) => !!pr.events['alert.removed'],
    scholar: E.quizClean,
    mission: (pr) => vals(pr.missions).some((r) => r.best > 0),
    allstar: (pr) => { const all = E.MISSIONS || []; return all.length > 0 && all.every((m) => ((pr.missions || {})[m.id] || {}).best === 3); },
    responder: (pr) => vals(pr.missions).some((r) => r.responded),
    proficient: E.examPassed, shift: E.shiftPassed, honors: E.shiftHonors, case: E.caseGood, allcases: E.caseAllGood, rescue: E.harmRescued,
  };
  /** Points, rank and badges. The rank is the highest whose XP is reached and whose demonstration is shown (or was
      already held). Returns, besides the old fields: need (what stands between the learner and the next rank they
      have the XP for, or the next rank's demonstration), confirm (ranks kept from the old rule, still to show). */
  E.game = (pr) => {
    const s = E.progressSummary(pr), parts = E.xpParts(pr);
    const xp = Object.values(parts).reduce((n, v) => n + v, 0);
    let byXp = 0;
    E.LEVELS.forEach(([min], i) => { if (xp >= min) byXp = i; });
    // When the thresholds rise, a learner seen for the first time since keeps the rank their XP had reached under the
    // old ones (pr.xpRankKept). It goes when they reset their progress, like any other kept title.
    if (pr.levelsV !== E.LEVELS_V) {
      let old = 0;
      E.LEVELS_BEFORE.forEach((min, i) => { if (xp >= min) old = i; });
      pr.xpRankKept = old > byXp ? old : 0; pr.levelsV = E.LEVELS_V;
    }
    const kept = Math.min(Number(pr.xpRankKept) || 0, E.LEVELS.length - 1);
    if (kept > byXp) byXp = kept;
    // The first time this code sees a learner, the rank they hold under the old rule is written down, so no title is
    // ever taken away. XP only falls when a learner resets their progress: then the old title goes with it.
    let held = Number(pr.rankHeld);
    if (!isFinite(held) || held < 0) held = pr.rankHeld = byXp;
    if (held > byXp) held = pr.rankHeld = byXp;
    let level = 0, need = null;
    const confirm = [];
    for (let i = 1; i < E.LEVELS.length; i++) {
      const title = E.LEVELS[i][1], rule = E.RANK_NEEDS[title], shown = !rule || rule.test(pr);
      if (i > byXp) { if (!need && rule && !shown) need = { title, todo: rule.todo, short: rule.short, xp: E.LEVELS[i][0], blocked: false, text: `${E.LEVELS[i][0]} XP and ${rule.done} to become ${title}` }; break; }
      if (shown) { level = i; continue; }
      if (i <= held) { level = i; confirm.push({ title, todo: rule.todo, text: `${rule.todo} to confirm ${title}` }); continue; }
      need = { title, todo: rule.todo, short: rule.short, xp: E.LEVELS[i][0], blocked: true, text: `${rule.todo} to become ${title}` };
      break;
    }
    const floor = E.LEVELS[level][0], next = E.LEVELS[level + 1] ? E.LEVELS[level + 1][0] : null;
    const earned = E.BADGES.filter((b) => {
      const lo = s.byLo.find((x) => x.id === b.id);
      if (lo) return lo.tasksDone === lo.tasks && lo.quizAnswered === lo.quiz;
      const t = BADGE_TEST[b.id];
      try { return t ? !!t(pr) : false; } catch (e) { return false; }   // a malformed old record never breaks the page
    }).map((b) => b.id);
    // The bar never goes backwards: held at a demonstration, it shows full rather than restarting.
    const pct = next ? Math.max(0, Math.min(100, Math.round(((xp - floor) / (next - floor)) * 100))) : 100;
    return { xp, parts, level: level + 1, title: E.LEVELS[level][1], floor, next, pct, earned, max: E.LEVELS[E.LEVELS.length - 1][0], need, confirm };
  };
  E.progressSummary = (pr) => {
    let tasks = 0, tasksDone = 0, q = 0, qDone = 0, qRight = 0;
    const byLo = E.LEARNING.map((lo) => {
      const td = lo.tasks.filter((t) => pr.events[t.event]).length;
      const qa = lo.quiz.filter((x) => pr.quiz[x.id] != null).length;
      const qr = lo.quiz.filter((x) => pr.quiz[x.id] === x.answer).length;
      tasks += lo.tasks.length; tasksDone += td; q += lo.quiz.length; qDone += qa; qRight += qr;
      return { id: lo.id, epa: lo.epa, tasks: lo.tasks.length, tasksDone: td, quiz: lo.quiz.length, quizAnswered: qa, quizCorrect: qr };
    });
    return { tasks, tasksDone, quiz: q, quizAnswered: qDone, quizCorrect: qRight, byLo };
  };

  /* ---------- the order the knowledge-check options are shown in ----------
     The questions are written with the answer near the top (positions 0, 1, 1, 1 …), which a learner learns to
     guess. Each learner sees each question's options in their own order, kept in their progress (pr.quizOrder) so
     it does not change on a reload. The order is seeded from the learner and the question, so a record that never
     got saved still comes back the same. The buttons always carry the ORIGINAL option index: the answer handler
     in js/app.js, the report and the stored answers all speak in original indexes. */
  const seeded = (str) => {   // FNV-1a into a small PRNG (mulberry32): the same string always gives the same sequence
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  const isPerm = (a, n) => Array.isArray(a) && a.length === n && a.every((x, i) => Number.isInteger(x) && x >= 0 && x < n && a.indexOf(x) === i);
  /** Display order for one question: an array of original option indexes, first shown first. */
  E.quizOrder = (pr, q) => {
    const n = q.options.length, store = pr.quizOrder && typeof pr.quizOrder === 'object' ? pr.quizOrder : (pr.quizOrder = {});
    if (isPerm(store[q.id], n)) return store[q.id];
    const rnd = seeded(`${String(pr.name || '').trim().toLowerCase()}|${pr.role}|${q.id}`), out = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return (store[q.id] = out);
  };
  /** A second try at a missed question, for the Honor Roll badge only: the first answer and its XP stand. */
  E.quizRetry = (pr, qid, i) => {
    const q = E.LEARNING.flatMap((lo) => lo.quiz).find((x) => x.id === qid);
    if (!q || pr.quiz[qid] == null || pr.quiz[qid] === q.answer) return null;
    const r = pr.quizRetry && typeof pr.quizRetry === 'object' ? pr.quizRetry : (pr.quizRetry = {});
    if (retryRight(pr, q)) return true;   // already put right
    r[qid] = { i: Number(i), first: pr.quiz[qid], at: Date.now() };
    return r[qid].i === q.answer;
  };
  /* A retry belongs to the first answer it followed. Reset my progress clears pr.quiz but (in js/app.js) not this,
     so a retry counts only for the same first answer and only if it came after the learner's last reset. */
  const lastReset = (pr) => (Array.isArray(pr.log) ? pr.log : []).reduce((t, l) => (l && l.action === 'Reset own learning progress' && l.ts > t ? l.ts : t), 0);
  function retryRight(pr, q) {
    const r = pr.quizRetry && pr.quizRetry[q.id];
    return !!r && typeof r === 'object' && r.i === q.answer && pr.quiz[q.id] != null && r.first === pr.quiz[q.id] && (r.at || 0) > lastReset(pr);
  }
  E.quizRetryRight = retryRight;
  /* ---------- faculty content review ----------
     FACULTY: when a reviewer accepts an item, add its id here with their initials and the date, for example
       'quiz.q1a': { by: 'JT', on: '2026-12-02' },
     Ids are listed in docs/content-review.html (made by: node tools/export-content.js). The printed learner report
     ends with how many items have been reviewed. Learners never see this. */
  E.CONTENT_REVIEWED = {
  };

  /** Every piece of clinical teaching content, flattened for review: { id, source, group, title, lines: [[label, text]] }.
      Read at call time, so the files loaded after this one (missions, shifts, cases) are included. Function-valued
      fields are worked out from the chart when they are used, so they are shown as such. */
  E.contentItems = () => {
    const out = [], txt = (v) => (typeof v === 'function' ? '(worked out from the chart when shown)' : v == null ? '' : String(v));
    const add = (id, source, group, title, lines) => out.push({ id, source, group, title: txt(title), lines: lines.filter((l) => l && l[1] !== '' && l[1] != null).map(([a, b]) => [a, txt(b)]) });
    const opts = (q) => q.options.map((o, i) => [i === q.answer ? 'Answer' : 'Option', o]);
    E.LEARNING.forEach((lo) => {
      add('obj.' + lo.id, 'js/learning.js', 'Objectives', `${lo.epa}: ${lo.objective}`, [['EPA', lo.epaTitle], ['Scope', lo.scope]].concat(lo.tasks.map((t) => ['Task', t.text])));
      lo.quiz.forEach((q) => add('quiz.' + q.id, 'js/learning.js', 'Knowledge check', q.q, opts(q).concat([['Why', q.why]])));
    });
    (E.HARM_RULES || []).forEach((r) => add('harm.' + r.id, 'js/shift.js', 'Harm rules', r.title, [['Hazard', r.hazard], ['Where to see it', r.where], ['Response', r.response]]));
    const nRule = {};
    (E.REMEDIATION || []).forEach((q) => { const n = (nRule[q.rule] = (nRule[q.rule] || 0) + 1); add(`remed.${q.rule}.${n}`, 'js/shift.js', 'Remediation round', q.q, opts(q).concat([['Why', q.why]])); });
    (E.OVERRIDE_OK || []).forEach((o) => add('override.' + o.id, 'js/sim.js', 'Accepted override reasons', o.label, [['Accepted', o.ok && o.ok.length === 0 ? o.ok() : o.ok], ['Not accepted', o.no && o.no.length === 0 ? o.no() : o.no]]));
    (E.SHIFTS || []).forEach((sh) => {
      const g = `Shift ${sh.n}: ${sh.title}`;
      add(`shift.${sh.id}`, 'js/shift.js', g, 'Brief and debrief', [['Brief', sh.brief], ['Sickest patient', sh.sickWhy], ['Debrief', sh.debrief]]);
      (sh.overnight || []).forEach((o, i) => o.msg && add(`shift.${sh.id}.overnight.${i + 1}`, 'js/shift.js', g, o.msg.subject, [['From', o.msg.from], ['Message', o.msg.body]]));
      (sh.rounds || []).forEach((r) => add(`shift.${sh.id}.rounds.${r.pid}`, 'js/shift.js', g, 'Rounds: ' + r.q, [['Answer', r.answer], ['Other options', Array.isArray(r.pool) ? r.pool.join(' · ') : r.pool], ['Where', r.where]]));
      (sh.events || []).forEach((e) => add(`shift.${sh.id}.event.${e.id}`, 'js/shift.js', g, `${String(Math.floor(e.at)).padStart(2, '0')}:${String(Math.round((e.at % 1) * 60)).padStart(2, '0')} ${e.subject}`, [['From', e.from], ['Message', e.body], e.crisis ? ['Deterioration', `${e.crisis.title}. Needs: ${e.crisis.needText}. ${e.crisis.settleText || ''}`] : null]));
      (sh.expect || []).forEach((x, i) => add(`shift.${sh.id}.expect.${i + 1}`, 'js/shift.js', g, 'Expected: ' + txt(x.text), [['Why', x.why], ['Counts as safety', x.safety ? 'yes' : '']]));
      add(`shift.${sh.id}.handoff`, 'js/shift.js', g, 'Words the sign-out must mention', [['Any of', (sh.handoffWords || []).map((w) => w.join(', ')).join(' / ')]]);
    });
    (E.MISSIONS || []).forEach((m) => add('mission.' + m.id, 'js/missions.js', 'Missions', m.title, [['Brief', m.brief]].concat((m.required || []).map((x) => ['Required', x.text]), (m.bonus || []).map((x) => ['Bonus', x.text]), [['Debrief', m.debrief]])));
    (E.CASES || []).forEach((cs) => {
      const g = `Case ${cs.n}: ${cs.title}`;
      add(`case.${cs.id}`, 'js/cases.js', g, 'Brief, debrief and learning issues', [['Brief', cs.brief], ['Debrief', cs.debrief]].concat((cs.issues || []).map((q) => ['Learning issue', q]), (cs.interview || []).map((x) => ['Patient interview', `${x.q} — ${x.a}`])));
      Object.entries(cs.nodes || {}).forEach(([k, n]) => {
        const ways = [];
        if (n.ask) { ways.push(['Question', `${n.ask.who}: ${n.ask.q}`]); n.ask.options.forEach((o) => ways.push([`Option (${o.grade}) → ${o.to}`, `${o.text}. ${txt(o.why)}`])); }
        (n.paths || []).forEach((w) => ways.push([`Path (${w.grade}) → ${w.to}${w.after != null ? `, after ${w.after} h` : ''}`, `${w.label}. ${txt(w.why)}`]));
        if (n.end) ways.push(['Ending', txt(n.end.outcome || n.end)]);
        add(`case.${cs.id}.${k}`, 'js/cases.js', g, `${k}: ${n.title || ''}`, [['Story', n.story]].concat(ways));
      });
    });
    return out;
  };
  /** How much of the content has been reviewed: { reviewed, total }. */
  E.contentReviewed = () => { const items = E.contentItems(), ok = items.filter((x) => E.CONTENT_REVIEWED[x.id]).length; return { reviewed: ok, total: items.length }; };
})();
