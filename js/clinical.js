/* SIM+EHR Student Edition — clinical logic: orders, decision-support advisories, MAR schedule,
   simulated resulting, dot phrases. Rules are simplified for teaching. */
(function () {
  const E = window.EHR;

  /* ---------- orders ---------- */
  E.newOrder = (catId, over) => {
    const c = E.cat(catId);
    return Object.assign({
      id: E.uid('o'), catId, type: c.type, group: c.group, name: c.name,
      dose: c.dose || '', route: c.route || '', freq: c.freq || '', prn: !!c.prn,
      priority: 'Routine', comment: '', status: 'Draft', by: '', byRole: '', ts: Date.now(), overrides: [],
    }, over || {});
  };
  E.orderDetail = (o) => {
    const parts = o.type === 'med' ? [o.dose, o.route, o.freq + (o.prn ? ' PRN' : '')] : [o.priority === 'STAT' ? 'STAT' : ''];
    if (o.comment) parts.push(o.comment);
    return parts.filter(Boolean).join(' · ');
  };
  const LIVE = ['Active', 'Pended', 'In process'];
  E.liveOrders = (p) => p.orders.filter((o) => LIVE.includes(o.status));

  /** Make a signed order take effect. */
  E.activate = (p, o, signer) => {
    const c = E.cat(o.catId);
    o.signedBy = signer; o.signedTs = Date.now(); o.status = 'Active';
    if (o.type === 'lab' || o.type === 'img') { o.status = 'In process'; o.resultAt = Date.now() + (o.type === 'lab' ? 15000 : 25000); }
    if (c.code) {
      p.codeStatus = c.code;
      p.orders.forEach((x) => { if (x !== o && x.group === 'Code Status' && x.status === 'Active') { x.status = 'Discontinued'; x.dcTs = Date.now(); x.dcBy = signer; } });
    }
  };

  /* ---------- labs ---------- */
  E.latestLab = (p, comp) => {
    let best = null;
    p.labs.forEach((l) => { if (comp in l.values && (!best || l.ts > best.ts)) best = { ts: l.ts, value: l.values[comp] }; });
    return best;
  };
  E.flag = (comp, v) => {
    const d = E.LABS[comp];
    if (!d) return '';
    if (d.critLo != null && v <= d.critLo) return 'LL';
    if (d.critHi != null && v >= d.critHi) return 'HH';
    return v < d.lo ? 'L' : v > d.hi ? 'H' : '';
  };
  E.labVal = (comp, v) => v.toFixed(E.LABS[comp].dec);

  /** Result every lab/imaging order whose simulated turnaround has elapsed. Returns what resulted. */
  E.processResults = () => {
    const now = Date.now(), done = [];
    if (E.simPaused && E.simPaused()) return done;   // paused: nothing posts (the hold is added back by E.simClock in js/sim.js)
    E.db.patients.forEach((p) => p.orders.forEach((o) => {
      if (o.status !== 'In process' || o.resultAt > now) return;
      const c = E.cat(o.catId);
      let abnormal = [], crit = false; const moved = [];
      if (c.comps) {
        const values = {};
        c.comps.forEach((k) => {
          const d = E.LABS[k], last = E.latestLab(p, k);
          const base = last ? last.value : d.lo + (d.hi - d.lo) * (0.3 + Math.random() * 0.4);
          const sim = E.simLab ? E.simLab(p, k, base * (1 + (Math.random() - 0.5) * 0.05)) : { value: base, why: [] };
          values[k] = +sim.value.toFixed(d.dec);
          if (last && sim.why.length && values[k] !== +last.value.toFixed(d.dec)) moved.push(`${d.name} ${E.labVal(k, last.value)} → ${E.labVal(k, values[k])} (${sim.why.join(', ')})`);
          const f = E.flag(k, values[k]);
          if (f) abnormal.push(`${d.name} ${E.labVal(k, values[k])} ${d.unit} (${f})`);
          if (f.length === 2) crit = true;
        });
        p.labs.push({ id: E.uid('l'), ts: now, name: c.name, values });
      } else {
        p.reports.push({ id: E.uid('r'), ts: now, kind: c.kind, name: c.name, status: o.catId === 'bcx' ? 'Preliminary' : 'Final', text: E.simReport ? E.simReport(p, c) : c.report, by: c.kind === 'Cardiology' ? 'Cardiology reading service' : o.type === 'lab' ? 'Laboratory' : 'Radiology' });
      }
      o.status = 'Completed'; o.resultTs = now;
      E.message({
        type: 'Result', from: o.type === 'lab' ? 'Laboratory' : 'Diagnostics', patientId: p.id, act: 'results', critical: crit,
        subject: `${crit ? 'CRITICAL: ' : abnormal.length ? 'Abnormal: ' : 'Result: '}${c.name} — ${p.name}`,
        body: c.comps ? (abnormal.length ? 'Abnormal values:\n' + abnormal.join('\n') : 'All components within reference range.') + (moved.length ? '\n\nChanged since the last result:\n' + moved.join('\n') : '') : p.reports[p.reports.length - 1].text,
      });
      done.push({ p, o, crit });
    }));
    return done;
  };

  /* ---------- decision support ---------- */
  /** Advisories for one unsigned order, given the patient's chart and the other unsigned orders. */
  E.checkDraft = (p, d, drafts) => {
    const tags = (E.cat(d.catId) || {}).tags || [], has = (t) => tags.includes(t), out = [];
    const add = (level, kind, title, detail) => out.push({ id: E.uid('al'), orderId: d.id, orderName: d.name, level, kind, title, detail });

    E.allergiesOf(p).forEach((a) => {
      if (a.cls && has(a.cls)) add(a.severity === 'High' ? 'high' : 'med', 'Allergy', `${a.type}: ${a.agent}`, `Documented reaction: ${a.reaction} (severity ${a.severity}). ${d.name} belongs to this class.`);
      else if (a.cls === 'penicillin' && has('cephalosporin')) add('med', 'Allergy', 'Possible cross-sensitivity with penicillin allergy', `Patient has a penicillin allergy (${a.reaction}). Cephalosporins carry a small risk of cross-reaction; weigh the reaction history before giving.`);
    });

    const others = E.liveOrders(p).concat(drafts.filter((x) => x !== d));
    if (others.some((o) => o.catId === d.catId)) add('med', 'Duplicate', 'Duplicate order', `${d.name} is already active, pended or in this unsigned list.`);

    const ctx = new Set(), src = {};
    others.forEach((o) => ((E.cat(o.catId) || {}).tags || []).forEach((t) => { ctx.add(t); src[t] = src[t] || o.name; }));
    if (has('nsaid') && ctx.has('anticoag')) add('high', 'Interaction', 'Bleeding risk: NSAID with anticoagulant', `Patient is on ${src.anticoag}. Adding an NSAID substantially increases the risk of serious bleeding.`);
    if (has('anticoag') && ctx.has('nsaid')) add('high', 'Interaction', 'Bleeding risk: anticoagulant with NSAID', `Patient is on ${src.nsaid}. Combining with an anticoagulant substantially increases the risk of serious bleeding.`);
    if (has('warfarin-interact') && ctx.has('warfarin')) add('high', 'Interaction', 'Interaction with warfarin', `${d.name} can markedly raise the INR in a patient taking warfarin. Choose an alternative or monitor INR closely.`);
    if (has('warfarin') && ctx.has('warfarin-interact')) add('high', 'Interaction', 'Interaction with warfarin', `Patient is on ${src['warfarin-interact']}, which can markedly raise the INR.`);
    const ac = (t) => t === 'anticoag' || t === 'anticoag-ppx';
    if (tags.some(ac) && (ctx.has('anticoag') || ctx.has('anticoag-ppx')) && !others.some((o) => o.catId === d.catId))
      add('med', 'Duplicate', 'Duplicate anticoagulation', `Patient already has ${src.anticoag || src['anticoag-ppx']} ordered.`);

    const K = E.latestLab(p, 'K'), Cr = E.latestLab(p, 'Cr');
    if (has('hyperk') && K && K.value >= 5.0) add('high', 'Lab', 'Hyperkalemia risk', `Most recent potassium is ${K.value.toFixed(1)} mmol/L (${E.fmtDT(K.ts)}). ${d.name} can raise potassium further.`);
    if ((has('nephrotoxic') || has('renal-caution')) && Cr && Cr.value >= 1.5) add('med', 'Lab', 'Reduced kidney function', `Most recent creatinine is ${Cr.value.toFixed(1)} mg/dL (${E.fmtDT(Cr.ts)}). ${d.name} may worsen kidney function or need a dose adjustment.`);

    if ((has('nsaid') || tags.some(ac)) && p.problems.some((pr) => pr.status === 'Active' && /GI bleed/i.test(pr.name)))
      add('high', 'Problem', 'Active gastrointestinal bleeding', `Problem list includes an active GI bleed. ${d.name} increases bleeding risk.`);
    // older adults: sedatives and anticholinergics (the Beers list), and a sedative on top of an opioid at any age
    const age = E.age(p.dob);
    if (age >= 65 && has('benzo')) add('med', 'Age', 'Benzodiazepine in a patient aged 65 or over', `${p.name} is ${age}. Benzodiazepines cause confusion, falls and slowed breathing in older adults and can bring on or worsen delirium. Look for the cause of the agitation or sleeplessness first.`);
    if (age >= 65 && has('anticholinergic')) add('med', 'Age', 'Anticholinergic in a patient aged 65 or over', `${p.name} is ${age}. ${d.name} can cause confusion and urinary retention in older adults, especially men with an enlarged prostate. Prefer a non-drug measure or a safer alternative.`);
    // home medicines (js/medrec.js): a nitrate after sildenafil, a home NSAID with an anticoagulant
    if (E.homeMedAdvisories) E.homeMedAdvisories(p, tags).forEach(([level, kind, title, detail]) => add(level, kind, title, detail));
    if ((has('benzo') && ctx.has('opioid')) || (has('opioid') && ctx.has('benzo'))) add('med', 'Interaction', 'Sedative with an opioid', `Patient is on ${src.opioid || src.benzo}. Together a benzodiazepine and an opioid slow breathing more than either alone. If both are needed, order monitoring of breathing and alertness.`);
    return out;
  };

  /* ---------- MAR ---------- */
  /** Timestamps at which a scheduled medication is due within the 24 h starting at dayStart. */
  E.dueTimes = (o, dayStart) => {
    if (o.type !== 'med' || o.prn || !o.signedTs || o.status === 'Pended' || o.status === 'Declined') return [];
    const end = o.dcTs || Infinity, dayEnd = dayStart + 24 * E.HOUR;
    if (o.freq === 'Once') return o.signedTs >= dayStart && o.signedTs < dayEnd ? [o.signedTs] : [];
    return (E.FREQ_HOURS[o.freq] || []).map((h) => dayStart + h * E.HOUR).filter((t) => t >= o.signedTs && t < end);
  };

  /* ---------- vitals ---------- */
  E.lastVitals = (p) => p.vitals.reduce((a, v) => (!a || v.ts > a.ts ? v : a), null);
  E.vitalAbn = (k, v) => {
    if (v == null || v === '') return false;
    return { temp: v >= 38 || v < 36, hr: v > 100 || v < 50, rr: v > 20 || v < 12, sbp: v < 90 || v > 160, dbp: v > 100 || v < 50, spo2: v < 92, pain: v >= 7 }[k] || false;
  };

  /* ---------- dot phrases (typed as .name in a note, or {{name}} in a template) ---------- */
  E.DOT = {
    name: (p) => p.name,
    age: (p) => String(E.age(p.dob)),
    sex: (p) => (p.sex === 'M' ? 'male' : 'female'),
    mrn: (p) => p.mrn,
    date: () => E.fmtDate(Date.now()),
    vitals: (p) => {
      const v = E.lastVitals(p);
      return v ? `T ${v.temp} °C, HR ${v.hr}, RR ${v.rr}, BP ${v.sbp}/${v.dbp}, SpO2 ${v.spo2}% on ${String(v.o2).toLowerCase()}, pain ${v.pain}/10 (${E.fmtDT(v.ts)})` : 'No vitals recorded';
    },
    labs: (p) => {
      const line = (keys) => keys.map((k) => { const l = E.latestLab(p, k); if (!l) return null; const f = E.flag(k, l.value); return `${k} ${E.labVal(k, l.value)}${f ? ' (' + f + ')' : ''}`; }).filter(Boolean).join(', ');
      return [line(['Na', 'K', 'Cl', 'CO2', 'BUN', 'Cr', 'Glu']), line(['WBC', 'Hgb', 'Hct', 'Plt'])].filter(Boolean).join('\n') || 'No recent labs';
    },
    meds: (p) => p.orders.filter((o) => o.type === 'med' && o.status === 'Active').map((o) => `- ${o.name} ${E.orderDetail(o)}`).join('\n') || 'No active medications',
    allergies: (p) => E.allergiesOf(p).map((a) => `${a.agent} (${a.reaction})`).join('; ') || 'No known allergies',
    problems: (p) => p.problems.filter((x) => x.status === 'Active').map((x) => `- ${x.name}`).join('\n') || 'None documented',
    me: () => `${E.db.user.name}, ${E.roleLabel(E.db.user.role)}\n${E.fmtDT(Date.now())}`,
  };
  /** What the simulated patient knows about themselves, written from the chart for a video persona.
      Lay terms only: a patient knows their symptoms, history, allergies and home life, not their lab values. */
  E.personaBrief = (p) => {
    const first = p.name.split(', ')[1], last = p.name.split(', ')[0];
    const hp = p.notes.find((n) => n.type === 'H&P');
    const hpi = hp ? (hp.text.match(/HPI:\s*([\s\S]*?)\n\n/) || [])[1] : '';
    return [
      `You are ${first} ${last}, a ${E.age(p.dob)}-year-old ${p.sex === 'M' ? 'man' : 'woman'} who is a patient in the hospital (bed ${p.bed}). You are speaking by video with a medical student who is practising taking a history. This is a training simulation.`,
      `Why you came in: ${p.cc}.`,
      hpi ? `Your story, which you tell in your own everyday words and only when asked: ${hpi}` : '',
      `Health problems you know you have: ${p.problems.map((x) => x.name.replace(/\s*\(.*?\)/g, '')).join('; ')}.`,
      `Allergies: ${E.allergiesOf(p).length ? E.allergiesOf(p).map((a) => `${a.agent} (${a.reaction.toLowerCase()})`).join('; ') : 'none that you know of'}.`,
      `Your wishes if your heart stopped: ${p.codeStatus === 'Full Code' ? 'you would want everything done' : 'you have decided against CPR and a breathing tube, and you can explain that calmly if asked'}.`,
      'Stay in character. Answer only what is asked, briefly, as a real patient would. You do not know medical terms, lab values or your diagnosis beyond what a doctor would have told you in plain words. If asked something the story does not cover, give a plausible ordinary answer consistent with it. Never give medical advice.',
    ].filter(Boolean).join('\n\n');
  };
  E.expandTemplate = (text, p) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (E.DOT[k] ? E.DOT[k](p) : m));
})();
