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
      objective: 'Find, trend and interpret laboratory and diagnostic results in the EHR.',
      tasks: [
        { event: 'results.trend', text: 'In Results, select a lab component to view its trend over time (try creatinine for Akana, Keoni).' },
        { event: 'report.view', text: 'Open an imaging or diagnostic report and read the impression.' },
        { event: 'lab.order', text: 'Order a lab test for a patient.' },
        { event: 'result.read', text: 'Open a result message in the Inbox and go to the chart from it.' },
      ],
      quiz: [
        { id: 'q1a', q: 'Leilani Kahale’s anion gap went from 26 to 18 to 13 over nine hours on an insulin infusion. What does the trend show?', options: ['Her ketoacidosis is resolving', 'She is developing lactic acidosis', 'The insulin infusion is not working', 'A lab error; anion gap cannot change that quickly'], answer: 0, why: 'A closing anion gap with rising bicarbonate is the marker of resolving DKA. The trend, not a single value, guides the transition off the insulin infusion.' },
        { id: 'q1b', q: 'A result is flagged “H” but is only slightly outside the reference range. What is the best first step?', options: ['Ignore it; mild flags never matter', 'Compare with the patient’s prior values and clinical picture', 'Repeat the test until it is normal', 'Treat immediately to bring it into range'], answer: 1, why: 'Flags mark values outside a population reference range. Interpretation depends on the patient’s baseline and context, which is why the EHR shows trends.' },
      ],
    },
    {
      id: 'lo2', epa: 'EPA 4', epaTitle: 'Enter and discuss orders and prescriptions',
      objective: 'Enter safe, complete orders and respond appropriately to clinical decision support.',
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
      ],
    },
    {
      id: 'lo3', epa: 'EPA 5', epaTitle: 'Document a clinical encounter in the patient record',
      objective: 'Write accurate, timely documentation using templates and data links without copying errors forward.',
      tasks: [
        { event: 'note.template', text: 'Start a new note from a template.' },
        { event: 'note.dot', text: 'Type a dot phrase in a note (for example .vitals followed by a space).' },
        { event: 'note.sign', text: 'Complete every *** placeholder and sign the note.' },
        { event: 'chart.update', text: 'Add an entry to a patient’s problem list or allergy list.' },
      ],
      quiz: [
        { id: 'q3a', q: 'You pull yesterday’s progress note forward as the starting point for today’s. What is your responsibility?', options: ['None; the prior author is responsible for the content', 'Review and update every section so the note reflects today’s findings and your own assessment', 'Change only the date', 'Add “copied” at the bottom'], answer: 1, why: 'Whoever signs a note attests to all of it. Copy-forward spreads outdated or wrong information unless each section is verified and updated.' },
        { id: 'q3b', q: 'A dot phrase inserts the latest vitals into your note. Thirty minutes later the patient’s blood pressure drops. What does your signed note show?', options: ['The new blood pressure, updated automatically', 'The values at the time you inserted them', 'Nothing; the vitals are removed', 'An average of both'], answer: 1, why: 'Inserted data is a snapshot. Check that pulled-in values are still current and still support your assessment before you sign.' },
      ],
    },
    {
      id: 'lo4', epa: 'EPA 8', epaTitle: 'Give or receive a patient handover to transition care responsibility',
      objective: 'Use the EHR to prepare a structured handoff for a patient.',
      tasks: [
        { event: 'summary.view', text: 'Review a patient’s Summary to gather the current picture.' },
        { event: 'note.handoff', text: 'Write and sign a Handoff (I-PASS) note for one patient.' },
      ],
      quiz: [
        { id: 'q4a', q: 'Which item belongs in the “Situation awareness and contingency planning” part of an I-PASS handoff?', options: ['The full past surgical history', '“If hemoglobin is below 8 on the 22:00 CBC, transfuse one unit and call GI”', 'The patient’s insurance status', 'A list of every lab since admission'], answer: 1, why: 'Contingency plans tell the receiving clinician what might happen and what to do about it. That is the part of a handoff most often missing.' },
      ],
    },
    {
      id: 'lo5', epa: 'EPA 10', epaTitle: 'Recognize a patient requiring urgent or emergent care and initiate evaluation and management',
      objective: 'Use vital-sign trends and critical results in the EHR to recognize a deteriorating patient.',
      tasks: [
        { event: 'vitals.trend', text: 'In Flowsheets, select a vital sign to view its trend.' },
        { event: 'critical.read', text: 'Open a critical result message in the Inbox.' },
        { event: 'code.review', text: 'Find a patient’s code status in the chart sidebar and confirm the matching order in Orders (see Chen, Robert).' },
      ],
      quiz: [
        { id: 'q5a', q: 'Robert Chen’s heart rate rises from 84 to 112 and his blood pressure falls to 90/52 four hours after endoscopy for a bleeding ulcer. What is the most appropriate first action?', options: ['Recheck vitals in four hours as ordered', 'Assess the patient now, notify the supervising physician, and check a hemoglobin', 'Document the vitals and continue rounds', 'Order a routine CBC for tomorrow morning'], answer: 1, why: 'Tachycardia with hypotension after a GI bleed suggests rebleeding. The trend in the flowsheet is the trigger to go to the bedside and escalate immediately.' },
        { id: 'q5b', q: 'Mr. Chen’s chart shows a code status of DNR/DNI. What does that mean for the situation above?', options: ['No treatment should be given', 'He should still be evaluated and treated; DNR/DNI limits CPR and intubation, not other care', 'Only comfort measures are allowed', 'Code status does not apply on a medical ward'], answer: 1, why: 'DNR/DNI is specific to resuscitation and intubation. Transfusion, endoscopy and escalation of care remain appropriate unless the patient has chosen otherwise.' },
      ],
    },
    {
      id: 'lo6', epa: 'EPA 13', epaTitle: 'Identify system failures and contribute to a culture of safety and improvement',
      objective: 'Use the EHR in a way that protects patient safety and privacy.',
      tasks: [
        { event: 'alert.removed', text: 'When an advisory identifies a real risk, remove the order rather than overriding it.' },
        { event: 'log.view', text: 'Open the Activity Log and see how every chart access and action is recorded.' },
        { event: 'mar.view', text: 'Open a patient’s MAR and check whether scheduled doses were given, held or are overdue.' },
        { event: 'allergy.process', text: 'Start to remove an allergy the proper way: give a reason, then read what the record does with your request.' },
      ],
      quiz: [
        { id: 'q6a', q: 'A classmate is admitted to your hospital. You are not on their care team but are curious how they are doing. Opening their chart is:', options: ['Fine, as long as you do not tell anyone', 'Fine if you only look at the summary', 'A privacy violation; access is limited to patients you are caring for, and every access is logged', 'Allowed for students for educational purposes'], answer: 2, why: 'Chart access must be for treatment, payment or operations related to your role. EHRs record every access, and audits routinely find this kind of snooping.' },
        { id: 'q6b', q: 'You notice the allergy list says “penicillin - anaphylaxis” but the patient tells you they have taken amoxicillin since without a problem. What should you do?', options: ['Nothing; the list is someone else’s responsibility', 'Delete the allergy yourself right away', 'Tell your supervising physician and make sure the history is clarified and the record updated', 'Mention it in your note only'], answer: 2, why: 'Inaccurate allergy lists cause harm in both directions. Raising discrepancies so the record gets corrected through the proper process is part of contributing to safety.' },
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
    return all[key(u)] || (all[key(u)] = { name: u.name, role: u.role, events: {}, quiz: {} });
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
  E.XP = { task: 50, quizRight: 100, quizTried: 25, pig: 1, pigMax: 10, star: 50, exam: 300, game: 10, gameMax: 50 };   // game: per perfect mini-game round, up to gameMax per game   // star: per mission star (best result counts); exam: passing the proficiency check   // pigMax: the most bonus points flying pigs can ever add
  /** How many flying pigs this learner has caught. Every catch is counted, even past the bonus limit. */
  E.pigs = (pr) => pr.pigs || pr.bonus || 0;
  E.LEVELS = [[0, 'New Arrival'], [400, 'Observer'], [900, 'Clerk'], [1600, 'Sub-Intern'], [2400, 'Acting Intern'], [3100, 'Ready for the Wards']];
  E.BADGES = [
    { id: 'lo1', name: 'Results Detective', glyph: 'results', how: 'Finish every task and question for EPA 3.' },
    { id: 'lo2', name: 'Safe Orderer', glyph: 'orders', how: 'Finish every task and question for EPA 4.' },
    { id: 'lo3', name: 'Chart Scribe', glyph: 'notes', how: 'Finish every task and question for EPA 5.' },
    { id: 'lo4', name: 'Clean Handoff', glyph: 'patients', how: 'Finish every task and question for EPA 8.' },
    { id: 'lo5', name: 'Early Warning', glyph: 'code', how: 'Finish every task and question for EPA 10.' },
    { id: 'lo6', name: 'Safety Net', glyph: 'problems', how: 'Finish every task and question for EPA 13.' },
    { id: 'catch', name: 'Good Catch', glyph: 'warn', how: 'Remove an order after a high-risk advisory instead of overriding it.' },
    { id: 'scholar', name: 'Honor Roll', glyph: 'trophy', how: 'Answer every knowledge-check question correctly on the first try.' },
    { id: 'mission', name: 'First Mission', glyph: 'star', how: 'Earn a star on any mission.' },
    { id: 'allstar', name: 'All-Star', glyph: 'medal', how: 'Earn gold on every mission.' },
    { id: 'responder', name: 'Rapid Responder', glyph: 'vitals', how: 'Notice a patient getting worse during a mission, and act.' },
    { id: 'proficient', name: 'Proficient', glyph: 'idcard', how: 'Pass the proficiency check.' },
  ];
  /** Stars earned on missions: the best result on each one. */
  E.missionStars = (pr) => Object.values(pr.missions || {}).reduce((n, r) => n + (r.best || 0), 0);
  E.game = (pr) => {
    const s = E.progressSummary(pr);
    const xp = s.tasksDone * E.XP.task + s.quizCorrect * E.XP.quizRight + (s.quizAnswered - s.quizCorrect) * E.XP.quizTried + Math.min(E.pigs(pr) * E.XP.pig, E.XP.pigMax)   // flying pigs: a small bonus, capped
      + E.missionStars(pr) * E.XP.star + (pr.exam && pr.exam.passed ? E.XP.exam : 0) + (E.gameXp ? E.gameXp(pr) : 0);
    let level = 0;
    E.LEVELS.forEach(([min], i) => { if (xp >= min) level = i; });
    const floor = E.LEVELS[level][0], next = E.LEVELS[level + 1] ? E.LEVELS[level + 1][0] : null;
    const earned = E.BADGES.filter((b) => {
      const lo = s.byLo.find((x) => x.id === b.id);
      if (lo) return lo.tasksDone === lo.tasks && lo.quizAnswered === lo.quiz;
      const ms = Object.values(pr.missions || {}), all = E.MISSIONS || [];
      if (b.id === 'mission') return ms.some((r) => r.best > 0);
      if (b.id === 'allstar') return all.length > 0 && all.every((m) => ((pr.missions || {})[m.id] || {}).best === 3);
      if (b.id === 'responder') return ms.some((r) => r.responded);
      if (b.id === 'proficient') return !!(pr.exam && pr.exam.passed);
      return b.id === 'catch' ? !!pr.events['alert.removed'] : s.quizCorrect === s.quiz;
    }).map((b) => b.id);
    return { xp, level: level + 1, title: E.LEVELS[level][1], floor, next, pct: next ? Math.round(((xp - floor) / (next - floor)) * 100) : 100, earned, max: E.LEVELS[E.LEVELS.length - 1][0] };
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
})();
