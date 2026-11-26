/* SIM+EHR Student Edition — mini-games.

   Short rounds that drill one skill, built from the sim's own patients. When a game produces something a
   clinician would put in a chart, the learner can send it to the chart, where it goes through exactly the
   same route as work done on the real screens: orders land in the unsigned list and are signed (or pended)
   with the usual advisories; a note opens in the editor and is signed with the usual cosign rules. Nothing
   is written without the learner choosing to, and anything that started in a game is labelled as such.

   Rules: mistakes are explained, never penalised; safety decisions are never timed; points are capped. */
(function () {
  const E = window.EHR, V = E.V, esc = E.esc, icon = E.icon;
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  E.GAMES = [
    { id: 'spot', name: 'Spot the Unsafe Order', glyph: 'warn', skill: 'Safe ordering · EPA 4', blurb: 'A patient and six orders. Decide which are safe and which to stop.' },
    { id: 'triage', name: 'Triage the Pages', glyph: 'inbox', skill: 'Prioritising · EPA 10', blurb: 'Five pages arrive in the same minute. Put them in the order you would answer them.' },
    { id: 'right', name: 'Right Patient', glyph: 'idcard', skill: 'Patient identification · EPA 13', blurb: 'Two patients on the list have nearly the same name. Each request names a patient by two identifiers. Open the right chart.' },
    { id: 'note', name: 'Note Doctor', glyph: 'notes', skill: 'Documentation · EPA 5', blurb: 'A progress note with mistakes in it: copied-forward vitals, a wrong allergy, another patient’s lab. Click every line that is wrong.' },
  ];
  /** Games are not played while a clock is running elsewhere: a shift or case clock keeps going behind the dialog,
      the proficiency check's clock does too (and the games show chart facts), and a mission's live event would land
      unseen. Returns the one-line reason, or '' when a game can start. */
  E.gameBlock = () => {
    const a = E.db && E.db.user ? E.progress().active : null;
    if (!a) return '';
    return a.type === 'shift' ? 'Mini-games wait until your shift ends.'
      : a.type === 'case' ? 'Mini-games wait until your case ends.'
      : a.type === 'exam' ? 'Mini-games wait until the proficiency check is submitted.'
      : 'Mini-games wait until your mission ends.';
  };
  /** Triage score: every pair of pages counts once, right when the more urgent one is answered first. One swap of
      neighbours costs one pair, not two places. `ranks` is the urgency rank of each page in the order given (0 = most urgent). */
  E.triageScore = (ranks) => {
    let right = 0, total = 0;
    for (let i = 0; i < ranks.length; i++) for (let j = i + 1; j < ranks.length; j++) { total++; if (ranks[i] < ranks[j]) right++; }
    return { right, total };
  };
  E.gameXp = (pr) => Object.values(pr.games || {}).reduce((n, g) => n + Math.min((g.perfect || 0) * E.XP.game, E.XP.gameMax), 0);
  const record = (id) => { const pr = E.progress(); pr.games = pr.games || {}; return pr.games[id] || (pr.games[id] = { plays: 0, perfect: 0, best: 0 }); };

  /* ---------- patient facts used by both games ---------- */
  const latest = (p, k) => { const l = E.latestLab(p, k); return l ? `${k} ${E.labVal(k, l.value)}${E.flag(k, l.value) ? ' (' + E.flag(k, l.value) + ')' : ''}` : null; };
  const vitalsLine = (v) => `T ${v.temp}, HR ${v.hr}, RR ${v.rr}, BP ${v.sbp}/${v.dbp}, SpO2 ${v.spo2}% on ${String(v.o2).toLowerCase()} (${E.fmtDT(v.ts)})`;
  const allergyLine = (p) => E.allergiesOf(p).map((a) => `${a.agent} (${a.reaction.toLowerCase()})`).join('; ') || 'No known allergies';

  /* ---------- Spot the Unsafe Order ---------- */
  const SAFE_POOL = ['acetaminophen', 'ondansetron', 'melatonin', 'sennadocusate', 'pantoprazole', 'albuterol', 'bmp', 'cbc', 'mg', 'ecg', 'cxr1', 'tsh', 'phos'];
  function buildSpot() {
    for (const p of shuffle(E.db.patients)) {
      const live = E.liveOrders(p).map((o) => o.catId), unsafe = [], safe = [];
      E.CATALOG.forEach((c) => {
        if (live.includes(c.id) || !(c.type === 'med' || c.type === 'img' || SAFE_POOL.includes(c.id))) return;
        const al = E.checkDraft(p, E.newOrder(c.id), []);
        if (al.some((a) => a.kind === 'Duplicate')) return;
        const risky = al.filter((a) => a.level === 'high' || a.kind === 'Allergy');
        if (risky.length) unsafe.push({ c, why: `${risky[0].title}. ${risky[0].detail}` });
        else if (!al.length && SAFE_POOL.includes(c.id)) safe.push({ c, why: 'No conflict with this patient’s allergies, medicines, labs or problems.' });
      });
      if (unsafe.length < 2 || safe.length < 3) continue;
      const n = Math.min(3, unsafe.length), cards = shuffle(shuffle(unsafe).slice(0, n).map((x) => Object.assign(x, { unsafe: true })).concat(shuffle(safe).slice(0, 6 - n).map((x) => Object.assign(x, { unsafe: false }))));
      return { pid: p.id, cards: cards.map((x) => ({ catId: x.c.id, name: x.c.name, detail: E.orderDetail(E.newOrder(x.c.id)), unsafe: x.unsafe, why: x.why })) };
    }
    return null;
  }

  /* ---------- Note Doctor ---------- */
  function buildNote() {
    const P = E.db.patients, p = pick(P), others = P.filter((x) => x !== p);
    const vs = [...p.vitals].sort((a, b) => a.ts - b.ts), v = vs[vs.length - 1], old = vs[0];
    const labs = ['Na', 'K', 'Cr', 'Glu', 'WBC', 'Hgb'].map((k) => latest(p, k)).filter(Boolean).join(', ');
    const line = (key, t) => ({ key, t, good: t });
    const lines = [
      line('head', `PROGRESS NOTE — ${p.name}, ${E.age(p.dob)} y.o. ${p.sex === 'M' ? 'male' : 'female'}`),
      line('mrn', `MRN ${p.mrn} · Bed ${p.bed} · Date of service ${E.fmtDate(Date.now())}`),
      line('allergy', `Allergies: ${allergyLine(p)}`),
      line('code', `Code status: ${p.codeStatus}`),
      line('subj', 'S: Feels a little better than yesterday. No new complaints overnight.'),
      line('vitals', `Vitals: ${vitalsLine(v)}`),
      line('exam', 'Exam: Alert and oriented, in no distress.'),
      line('labs', `Labs: ${labs || 'none recent'}`),
      line('problems', `Active problems: ${p.problems.filter((x) => x.status === 'Active').slice(0, 3).map((x) => x.name).join('; ')}`),
      line('plan', 'Plan: Continue current management. Recheck labs in the morning.'),
    ];
    const L = (k) => lines.find((x) => x.key === k), errors = [];
    // each possible mistake, with what is wrong and where the truth is
    const kinds = [];
    if (vs.length > 1 && old.ts < v.ts - 6 * E.HOUR) kinds.push(() => { L('vitals').t = `Vitals: ${vitalsLine(old)}`; return { key: 'vitals', why: `These are the admission vitals, copied forward from an old note. The latest set was taken ${E.fmtDT(v.ts)}.` }; });
    if (E.allergiesOf(p).length) kinds.push(() => { L('allergy').t = 'Allergies: No known allergies'; return { key: 'allergy', why: `The chart lists ${allergyLine(p)}. A missing allergy in a note is how the wrong drug gets ordered.` }; });
    else { const o = others.find((x) => E.allergiesOf(x).length); if (o) kinds.push(() => { L('allergy').t = `Allergies: ${allergyLine(o)}`; return { key: 'allergy', why: `This patient has no known allergies. That allergy belongs to ${o.name}.` }; }); }
    kinds.push(() => { const wrong = p.codeStatus === 'Full Code' ? 'DNR/DNI' : 'Full Code'; L('code').t = `Code status: ${wrong}`; return { key: 'code', why: `The chart and the code status order say ${p.codeStatus}. Getting this wrong decides whether someone is resuscitated.` }; });
    const kp = E.latestLab(p, 'K'), ko = others.map((x) => E.latestLab(x, 'K')).find((x) => x && kp && Math.abs(x.value - kp.value) >= 0.4);
    if (kp && ko) kinds.push(() => { L('labs').t = L('labs').t.replace(latest(p, 'K'), `K ${E.labVal('K', ko.value)}`); return { key: 'labs', why: `The potassium here belongs to another patient. ${p.name}’s latest is ${E.labVal('K', kp.value)}.` }; });
    kinds.push(() => { L('exam').t = 'Exam: ***'; return { key: 'exam', why: 'A template placeholder was left in. A note with *** in it cannot be signed and says nothing about the exam.' }; });
    const o2 = pick(others);
    kinds.push(() => { L('mrn').t = L('mrn').t.replace(p.mrn, o2.mrn); return { key: 'mrn', why: `That MRN is ${o2.name}’s. ${p.name}’s is ${p.mrn}. A wrong identifier can file the note in the wrong chart.` }; });
    shuffle(kinds).slice(0, 3).forEach((f) => errors.push(f()));
    return { pid: p.id, lines: lines.map((x) => ({ key: x.key, t: x.t, good: x.good, err: errors.find((e) => e.key === x.key) || null })),
      facts: [['MRN', p.mrn], ['Allergies', allergyLine(p)], ['Code status', p.codeStatus], ['Latest vitals', vitalsLine(v)], ['Latest labs', labs || 'none recent']] };
  }

  /* ---------- Triage the Pages ----------
     Five tiers, most urgent first. A round takes one page from each tier, so the right order is never a
     coin toss between two pages of the same urgency. FACULTY: the pages and reasons can be edited here. */
  const TIERS = [
    ['Now: airway, breathing or circulation is failing', [
      ['p5', 'Chen, Robert has vomited bright red blood. HR 124, BP 82/48.', 'Active bleeding with a low blood pressure: circulation is failing now.'],
      ['p2', 'Santos, Maria: lips swelling and wheezing two minutes after a new antibiotic was hung.', 'A reaction that threatens the airway. Minutes matter.'],
      ['p6', 'Kowalski, Diane is hard to wake and breathing 8 a minute. SpO2 84%.', 'She is not breathing enough. This becomes an arrest if nobody comes.'],
    ]],
    ['Next: could become unstable within minutes', [
      ['p1', 'Akana, Keoni has had chest pressure for 15 minutes and is sweaty. HR 102, BP 148/90.', 'Possible heart attack: he needs an ECG within minutes, but his blood pressure is holding.'],
      ['p4', 'Kahale, Leilani: point-of-care glucose 52. Shaky, awake and talking.', 'A low glucose is treated within minutes. She is awake, so it comes after a failing airway, breathing or circulation.'],
      ['p3', 'Whitfield, James: new heart rate of 142, irregular. BP 110/64. He feels palpitations.', 'A fast rhythm with a holding blood pressure: urgent, not yet unstable.'],
    ]],
    ['Soon: needs a plan within the hour', [
      ['p1', 'Lab calling: Akana, Keoni potassium 5.9. No symptoms, on telemetry.', 'A high potassium needs an ECG and a plan within the hour. Nothing is happening to him this minute.'],
      ['p2', 'Santos, Maria: temperature 38.9. HR 104, BP 118/70. Already on antibiotics.', 'A fever with steady vital signs in a patient already on treatment: see her soon, after the unstable ones.'],
      ['p3', 'Whitfield, James: hip pain 8 out of 10. Vital signs normal.', 'Uncontrolled pain should not wait long, but nothing is unstable.'],
    ]],
    ['Later today: routine clinical work', [
      ['p6', 'Kowalski, Diane would like something to help her sleep tonight.', 'A routine request. Safe to do once the urgent calls are answered.'],
      ['p3', 'Pharmacy asks you to confirm the dose on Whitfield, James’s senna-docusate.', 'A clarification on a bowel medicine can wait until the sick patients are seen.'],
      ['p7', 'Santos, Marie: the pen line around her cellulitis needs re-marking before evening.', 'Useful and not urgent. It only needs doing today.'],
    ]],
    ['Last: paperwork and messages', [
      ['p3', 'Unit clerk: Whitfield, James’s daughter would like a call this afternoon about going home.', 'Important to the family and not time-critical. Tell the clerk when you will ring.'],
      ['p6', 'Case management: the home oxygen form for Kowalski, Diane needs a signature by tomorrow.', 'Paperwork with a deadline of tomorrow goes last.'],
      ['p1', 'Medical records: yesterday’s note on Akana, Keoni is waiting for a cosign request.', 'An administrative reminder. Nobody is harmed if it waits an hour.'],
    ]],
  ];
  E.TRIAGE_TIERS = TIERS.map((t) => t[0]);
  function buildTriage() {
    const used = new Set();
    const pages = TIERS.map(([tier, list], rank) => {
      const opts = shuffle(list), x = opts.find((o) => !used.has(o[0])) || opts[0];
      used.add(x[0]);
      return { rank, tier, pid: x[0], text: x[1], why: x[2] };
    });
    let order = shuffle(pages);
    while (order.every((p, i) => p.rank === i)) order = shuffle(pages);   // never deal a hand that is already sorted
    return { pages: order };
  }

  /* ---------- Right Patient ---------- */
  function buildRight() {
    const P = E.db.patients, twins = P.filter((p) => p.nameAlert);
    if (twins.length < 2) return null;
    const others = shuffle(P.filter((p) => !p.nameAlert)).slice(0, 2), last = (p) => p.name.split(', ')[0];
    const ask = [
      (p) => [`Pharmacy on the phone: “I have a question about the antibiotic for ${last(p)}, date of birth ${E.fmtDob(p.dob)}.”`, 'surname and date of birth'],
      (p) => [`The lab calls with a result for ${p.name}, MRN ${p.mrn}.`, 'full name and MRN'],
      (p) => [`A nurse stops you in the hall: “Can you look at ${last(p)}? Date of birth ${E.fmtDob(p.dob)}, MRN ending ${p.mrn.slice(-4)}.”`, 'date of birth and the end of the MRN'],
      (p) => [`Radiology is ready for ${p.name}, born ${E.fmtDob(p.dob)}.`, 'full name and date of birth'],
    ];
    const forms = shuffle(ask);
    const reqs = shuffle([twins[0], twins[1]].concat(others)).map((p, i) => { const [text, ids] = forms[i % forms.length](p); return { pid: p.id, text, ids }; });
    return { reqs, rows: shuffle(P).map((p) => p.id) };
  }

  /* ---------- views ---------- */
  V.gameShelf = () => {
    const pr = E.progress(), block = E.gameBlock();
    return `<h3 class="shelf-h">${icon('star', 32)}Mini-games</h3>
      ${block ? `<div class="notice info">${icon('info', 24)}<span>${esc(block)}</span></div>` : ''}
      <div class="game-grid">${E.GAMES.map((g) => { const r = (pr.games || {})[g.id]; return `<article class="game">${icon(g.glyph, 48)}<div class="game-main"><b>${esc(g.name)}</b><span class="game-skill">${esc(g.skill)}</span><p>${esc(g.blurb)}</p></div><div class="game-side">${r && r.plays ? `<span>Best ${r.best}%</span><span>${r.perfect} perfect</span>` : '<span>Not played yet</span>'}<button class="btn primary" data-act="gameOpen" data-id="${g.id}"${block ? ' disabled' : ''}>Play</button></div></article>`; }).join('')}</div>`;
  };

  V.modalExt = Object.assign(V.modalExt || {}, {
    game(m, modal, cancel) {
      const g = E.GAMES.find((x) => x.id === m.game), done = m.checked;
      if (m.game === 'triage') {
        const s = m.s, sc = E.triageScore(s.pages.map((x) => x.rank));
        const rows = s.pages.map((x, i) => { const p = E.pt(x.pid), ok = done && x.rank === i; return `<li class="tr-page${done ? (ok ? ' right' : ' wrong') : ''}"><span class="tr-n">${i + 1}</span><div class="tr-main"><b>${esc(x.text)}</b><span class="muted">${p ? esc(p.bed) : ''}</span>${done ? `<p class="g-why">${icon(ok ? 'check' : 'alert', 16)}<span><b>${ok ? 'Right place.' : `Belongs at number ${x.rank + 1}.`}</b> ${esc(x.tier)}. ${esc(x.why)}</span></p>` : ''}</div>${done ? '' : `<span class="tr-move"><button class="btn xs" data-act="triageMove" data-i="${i}" data-d="-1" aria-label="Move page ${i + 1} up"${i === 0 ? ' disabled' : ''}>Up</button><button class="btn xs" data-act="triageMove" data-i="${i}" data-d="1" aria-label="Move page ${i + 1} down"${i === s.pages.length - 1 ? ' disabled' : ''}>Down</button></span>`}</li>`; }).join('');
        return modal(g.name, `<p class="g-ask">${done ? `<b>${sc.right} of ${sc.total} pairs in the right order.</b> ${sc.right === sc.total ? 'That is the order a senior resident would answer them in.' : 'Each pair of pages counts once: right when the more urgent one comes first. Read why for the ones that moved.'}` : 'Five pages have arrived in the same minute. Put the one you would answer first at the top. This is not timed.'}</p><ol class="tr-list">${rows}</ol>${done ? '<p class="fine">The rule underneath: airway, breathing and circulation first; then whatever could become unstable soon; then time-sensitive results; then routine work; paperwork last.</p>' : ''}`,
          done ? `<button class="btn" data-act="gameOpen" data-id="triage">Play again</button><button class="btn" data-act="triageSend">File these as acknowledged pages in the Inbox</button><button class="btn primary" data-act="closeModal">Close</button>` : `${cancel}<button class="btn primary" data-act="gameCheck">Check my order</button>`, 'lg');
      }
      if (m.game === 'right') {
        const s = m.s, n = s.reqs.length, cur = s.reqs[m.step], rightN = s.reqs.filter((r, i) => m.picks[i] === r.pid).length;
        const mine = m.picks[m.step];
        const table = (pickable) => `<table class="tbl compact${pickable ? ' hover' : ''} rp-list"><thead><tr><th>Patient</th><th>Date of birth</th><th>MRN</th><th>Bed</th></tr></thead><tbody>${s.rows.map((id) => { const p = E.pt(id), on = pickable && mine === id; return `<tr${pickable ? ` data-act="rightPick" data-id="${id}" tabindex="0" aria-selected="${on}"` : ''}><td><b>${esc(p.name)}</b>${on ? ' <span class="chip green">Your pick</span>' : ''}</td><td>${E.fmtDob(p.dob)}</td><td>${p.mrn}</td><td>${esc(p.bed)}</td></tr>`; }).join('')}</tbody></table>`;
        // Picking moves on to the next request; after the last one comes a review where any pick can be changed. Nothing is scored until "Check my picks".
        if (!done && m.step < n) return modal(g.name, `<p class="g-ask">Request ${m.step + 1} of ${n}. Select the chart you would open.</p><div class="rp-req">${icon('inbox', 32)}<p>${esc(cur.text)}</p></div>${table(true)}<p class="fine">Two patients here have nearly the same name. A room number is not an identifier.</p>`,
          `${cancel}${m.step > 0 ? `<button class="btn" data-act="rightGo" data-i="${m.step - 1}">Previous request</button>` : ''}${s.reqs.every((r, i) => m.picks[i]) ? `<button class="btn" data-act="rightGo" data-i="${n}">Review my picks</button>` : ''}`, 'lg');
        if (!done) return modal(g.name, `<p class="g-ask"><b>Your picks.</b> Check each one against the request before they are scored. Change any that do not match on two identifiers.</p>
          <ul class="dock-list wide">${s.reqs.map((r, i) => { const got = E.pt(m.picks[i]); return `<li><i class="tick0"></i><span>${esc(r.text)}<small>You picked <b>${got ? esc(got.name) : 'nobody'}</b>${got ? `, born ${E.fmtDob(got.dob)}, MRN ${got.mrn}` : ''}.</small></span><button class="btn xs" data-act="rightGo" data-i="${i}">Change</button></li>`; }).join('')}</ul>`,
          `${cancel}<button class="btn primary" data-act="gameCheck">Check my picks</button>`, 'lg');
        return modal(g.name, `<p class="g-ask"><b>${rightN} of ${n} right charts.</b> ${rightN === n ? 'Every chart matched on two identifiers.' : 'A wrong chart is how an order reaches the wrong patient.'}</p>
          <ul class="dock-list wide">${s.reqs.map((r, i) => { const p = E.pt(r.pid), got = E.pt(m.picks[i]), ok = got === p; return `<li class="${ok ? 'done' : 'bad'}">${icon(ok ? 'check' : 'remove', 16)}<span>${esc(r.text)}<small><b>${esc(p.name)}</b>, born ${E.fmtDob(p.dob)}, MRN ${p.mrn}. Matched on ${esc(r.ids)}.${ok || !got ? '' : ` You opened ${esc(got.name)} (born ${E.fmtDob(got.dob)}, MRN ${got.mrn}).`}</small></span></li>`; }).join('')}</ul>${table(false)}`,
          `<button class="btn" data-act="gameOpen" data-id="right">Play again</button><button class="btn" data-act="rightSend">Open ${esc(E.pt(s.reqs[n - 1].pid).name)}’s chart</button><button class="btn primary" data-act="closeModal">Close</button>`, 'lg');
      }
      const p = E.pt(m.s.pid);
      const ptCard = `<div class="g-pt">${icon('user', 32)}<div><b>${esc(p.name)}</b> · ${E.age(p.dob)} ${p.sex} · ${esc(p.bed)}<span>${esc(p.dx)}</span></div></div>`;
      if (m.game === 'spot') {
        const s = m.s, meds = E.liveOrders(p).filter((o) => o.type === 'med').map((o) => o.name.replace(/\s*\(.*$/, '')).join(', ');
        const facts = `<dl class="kv g-facts"><dt>Allergies</dt><dd>${esc(allergyLine(p))}</dd><dt>On</dt><dd>${esc(meds || 'no medicines')}</dd><dt>Latest labs</dt><dd>${esc(['K', 'Cr', 'Hgb', 'INR'].map((k) => latest(p, k)).filter(Boolean).join(', '))}</dd><dt>Problems</dt><dd>${esc(p.problems.filter((x) => x.status === 'Active').map((x) => x.name).join('; '))}</dd></dl>`;
        const cards = s.cards.map((c, i) => {
          const mark = m.marks[i], right = done && (mark === 'stop') === c.unsafe;
          return `<div class="g-card${done ? (right ? ' right' : ' wrong') : ''}"><div class="g-card-h"><b>${esc(c.name)}</b><span>${esc(c.detail)}</span></div>
            ${done ? `<p class="g-why">${icon(c.unsafe ? 'alert' : 'check', 16)}<span><b>${c.unsafe ? 'Unsafe.' : 'Safe.'}</b> ${esc(c.why)}${!right ? ` <b>You marked it ${mark === 'stop' ? 'Stop' : mark === 'safe' ? 'Safe' : 'nothing'}.</b>` : ''}</span></p>`
              : `<div class="g-btns"><button class="btn xs${mark === 'safe' ? ' on' : ''}" data-act="spotMark" data-i="${i}" data-v="safe" aria-pressed="${mark === 'safe'}">${icon('check', 16)}Safe</button><button class="btn xs${mark === 'stop' ? ' on stop' : ''}" data-act="spotMark" data-i="${i}" data-v="stop" aria-pressed="${mark === 'stop'}">${icon('remove', 16)}Stop</button></div>`}</div>`;
        }).join('');
        const keep = s.cards.filter((c, i) => m.marks[i] === 'safe');
        const score = done ? s.cards.filter((c, i) => (m.marks[i] === 'stop') === c.unsafe).length : 0;
        return modal(g.name, `${ptCard}${facts}<p class="g-ask">${done ? `<b>${score} of ${s.cards.length} right.</b> ${score === s.cards.length ? 'Every unsafe order stopped, every safe one let through.' : 'Read why for the ones you missed.'}` : 'For each order: is it safe to give this patient?'}</p><div class="g-cards">${cards}</div>`,
          done ? `<button class="btn" data-act="gameOpen" data-id="spot">Play again</button>${keep.length ? `<button class="btn" data-act="spotSend">Add the ${keep.length} order${keep.length > 1 ? 's' : ''} you marked Safe to ${esc(p.name)}’s unsigned orders</button>` : ''}<button class="btn primary" data-act="closeModal">Close</button>`
            : `${cancel}<button class="btn primary" data-act="gameCheck">Check my answers</button>`, 'xl');
      }
      const s = m.s, n = s.lines.filter((l) => l.err).length, flagged = s.lines.filter((l, i) => m.flags[i]).length;
      const found = done ? s.lines.filter((l, i) => l.err && m.flags[i]).length : 0, falses = done ? s.lines.filter((l, i) => !l.err && m.flags[i]).length : 0;
      const lines = s.lines.map((l, i) => {
        const f = !!m.flags[i], cls = !done ? (f ? ' flagged' : '') : l.err ? (f ? ' found' : ' missed') : f ? ' false' : '';
        return `<li class="g-line${cls}">${done ? `<span class="g-l">${esc(l.t)}</span>${l.err ? `<p class="g-why">${icon(f ? 'check' : 'alert', 16)}<span><b>${f ? 'Caught.' : 'Missed.'}</b> ${esc(l.err.why)}</span></p>` : f ? `<p class="g-why">${icon('info', 16)}<span><b>This line was correct.</b></span></p>` : ''}`
          : `<button class="g-l" data-act="noteFlag" data-i="${i}" aria-pressed="${f}">${esc(l.t)}</button>`}</li>`;
      }).join('');
      const facts = `<dl class="kv g-facts">${s.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
      return modal(g.name, `${ptCard}<p class="g-ask">${done ? `<b>${found} of ${n} mistakes caught${falses ? `, ${falses} correct line${falses > 1 ? 's' : ''} flagged` : ''}.</b>` : `This note has <b>${n} mistakes</b>. Compare each line with the facts from the chart beside it, and click every line that is wrong.`}</p>
        <div class="g-split"><ol class="g-note">${lines}</ol><aside><h4>${icon('summary', 24)}From the chart</h4>${facts}</aside></div>`,
        done ? `<button class="btn" data-act="gameOpen" data-id="note">Play again</button><button class="btn" data-act="noteSend">Open the corrected note in ${esc(p.name)}’s chart to finish and sign</button><button class="btn primary" data-act="closeModal">Close</button>`
          // fewer lines flagged than there are mistakes: ask before scoring, so a stray Enter cannot end the round
          : m.askLow ? `<span class="fine">You have flagged ${flagged} line${flagged === 1 ? '' : 's'}, and the note has ${n} mistakes. Check anyway?</span><button class="btn" data-act="noteKeep">Keep looking</button><button class="btn primary" data-act="gameCheck" data-force="1">Check anyway</button>`
          : `${cancel}<button class="btn primary" data-act="gameCheck">Check my answers</button>`, 'xl');
    },
  });

  /* ---------- actions ---------- */
  E.gameActions = {
    gameOpen(d) {
      const block = E.gameBlock();
      if (block) { if (E.ui.modal && E.ui.modal.type === 'game') E.ui.modal = null; E.app.status(block); return E.app.render(); }
      const s = d.id === 'spot' ? buildSpot() : d.id === 'triage' ? buildTriage() : d.id === 'right' ? buildRight() : buildNote();
      if (!s) return E.app.status(d.id === 'right' ? 'This round needs the two sound-alike patients. Reset the sim data to bring them back.' : 'No patient has enough risky orders for a round right now.');
      E.ui.modal = { type: 'game', game: d.id, s, marks: {}, flags: {}, picks: [], step: 0, checked: false };
      E.app.render();
    },
    spotMark(d) { const m = E.ui.modal; if (!m || m.type !== 'game' || m.checked) return; m.marks[d.i] = m.marks[d.i] === d.v ? undefined : d.v; E.app.render(); },
    noteFlag(d) { const m = E.ui.modal; if (!m || m.type !== 'game' || m.checked) return; m.flags[d.i] = !m.flags[d.i]; m.askLow = false; E.app.render(); },
    noteKeep() { const m = E.ui.modal; if (!m || m.type !== 'game') return; m.askLow = false; E.app.render(); },
    /** Score a round. Only a round that is open, not yet checked and complete is scored, so a round left midway
        (closed, replaced by another window, or a stray click after it closed) never writes a record or awards XP. */
    gameCheck(d) {
      const m = E.ui.modal;
      if (!m || m.type !== 'game' || m.checked || !m.s) return;
      const s = m.s, pr = E.progress(), before = E.game(pr), err = (t) => { const e = document.getElementById('modalErr'); if (e) e.textContent = t; };
      if (m.game === 'right' && s.reqs.some((r, i) => !m.picks[i])) return err('Pick a chart for every request first.');
      if (m.game === 'note' && !(d && d.force)) {
        const n = s.lines.filter((l) => l.err).length, flagged = s.lines.filter((l, i) => m.flags[i]).length;
        if (flagged < n) { m.askLow = true; return E.app.render(); }
      }
      let pct, perfect;
      if (m.game === 'triage') {
        const sc = E.triageScore(s.pages.map((x) => x.rank));
        pct = Math.round((sc.right / sc.total) * 100); perfect = sc.right === sc.total;
      } else if (m.game === 'right') {
        const right = s.reqs.filter((r, i) => m.picks[i] === r.pid).length;
        pct = Math.round((right / s.reqs.length) * 100); perfect = right === s.reqs.length;
      } else if (m.game === 'spot') {
        if (s.cards.some((c, i) => !m.marks[i])) return err('Mark every order Safe or Stop.');
        const right = s.cards.filter((c, i) => (m.marks[i] === 'stop') === c.unsafe).length;
        pct = Math.round((right / s.cards.length) * 100); perfect = right === s.cards.length;
      } else {
        const n = s.lines.filter((l) => l.err).length, found = s.lines.filter((l, i) => l.err && m.flags[i]).length, falses = s.lines.filter((l, i) => !l.err && m.flags[i]).length;
        pct = Math.max(0, Math.round(((found - falses) / n) * 100)); perfect = found === n && !falses;
      }
      const r = record(m.game); r.plays++; r.best = Math.max(r.best, pct); if (perfect) r.perfect++;
      m.checked = true;
      E.audit(`Played ${E.GAMES.find((g) => g.id === m.game).name}: ${pct}%`, s.pid || null);
      E.save();
      const g = E.game(pr), gained = g.xp - before.xp;
      if (gained) E.app.toast(perfect ? 'A perfect round.' : 'Round complete.', `+${gained} XP · Mini-game`, 'star');
      E.app.render();
    },
    triageMove(d) { const m = E.ui.modal, a = m.s.pages, i = Number(d.i), j = i + Number(d.d); if (m.checked || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; E.app.render(); const b = document.querySelector(`#modal [data-act=triageMove][data-i="${j}"][data-d="${d.d}"]:not(:disabled)`) || document.querySelector(`#modal [data-act=triageMove][data-i="${j}"]:not(:disabled)`); if (b) b.focus(); },
    /** Write the round into the record: one acknowledged page per patient in the Inbox, and a line in the activity log. */
    triageSend() {
      const m = E.ui.modal, key = [...m.s.pages].sort((a, b) => a.rank - b.rank);
      key.forEach((x, i) => {
        E.message({ type: 'Page', from: 'Triage the Pages (mini-game)', patientId: x.pid, act: 'summary', read: true, subject: `Acknowledged page ${i + 1} of ${key.length} — ${E.pt(x.pid).name}`, body: `${x.text}\n\nAnswered ${['first', 'second', 'third', 'fourth', 'last'][i]}: ${x.tier.toLowerCase()}. ${x.why}\n\nThis page was part of a practice round in Triage the Pages. Nothing in it happened to the patient in the sim.` });
        E.audit(`Acknowledged page (Triage the Pages): ${x.text}`, x.pid);
      });
      E.ui.modal = null; E.save();
      E.app.status(`${key.length} pages filed in your Inbox as acknowledged.`);
      E.app.go('#/inbox');
    },
    /** A pick moves on to the next request without a pick, or to the review once every request has one. Never scores. */
    rightPick(d) {
      const m = E.ui.modal; if (!m || m.type !== 'game' || m.game !== 'right' || m.checked) return;
      const n = m.s.reqs.length; if (!(m.step < n)) return;
      m.picks[m.step] = d.id;
      const after = m.s.reqs.findIndex((r, i) => i > m.step && !m.picks[i]), any = m.s.reqs.findIndex((r, i) => !m.picks[i]);
      m.step = after >= 0 ? after : any >= 0 ? any : n;
      E.app.render();
    },
    /** Go to one request to change its pick (0..n-1), or to the review (n). */
    rightGo(d) { const m = E.ui.modal; if (!m || m.type !== 'game' || m.game !== 'right' || m.checked) return; m.step = Math.max(0, Math.min(m.s.reqs.length, Number(d.i))); E.app.render(); },
    rightSend() { const m = E.ui.modal, p = E.pt(m.s.reqs[m.s.reqs.length - 1].pid); E.audit('Opened the chart named in Right Patient, after checking two identifiers', p.id); E.ui.modal = null; E.save(); E.app.go(`#/pt/${p.id}/summary`); },
    spotSend() {
      const m = E.ui.modal, p = E.pt(m.s.pid);
      if (!E.can('order.sign') && !E.can('order.pend')) return E.app.status('Your role cannot enter orders.');
      const keep = m.s.cards.filter((c, i) => m.marks[i] === 'safe');
      keep.forEach((c) => p.drafts.push(E.newOrder(c.catId, { comment: 'Started in Spot the Unsafe Order' })));
      E.audit(`Sent ${keep.length} order(s) from Spot the Unsafe Order to the unsigned orders`, p.id);
      E.ui.modal = null; E.save();
      E.app.status(`${keep.length} order${keep.length > 1 ? 's are' : ' is'} waiting in the unsigned list. Review and sign them as usual.`);
      E.app.go(`#/pt/${p.id}/orders`);
    },
    noteSend() {
      const m = E.ui.modal, p = E.pt(m.s.pid);
      if (p.noteDraft) { E.ui.modal = null; E.app.status(`${p.name} already has an unsigned note. Finish or discard it first.`); return E.app.go(`#/pt/${p.id}/notes`); }
      // the checked facts are kept; the clinical judgement (history, exam, plan) is left for the learner to write
      const text = m.s.lines.map((l) => (['subj', 'exam', 'plan'].includes(l.key) ? l.good.replace(/:.*/, ': ***') : l.good)).join('\n') + `\n\n${E.db.user.name}, ${E.roleLabel(E.db.user.role)}`;
      p.noteDraft = { type: 'Progress Note', text, pristine: false, source: 'Note Doctor' }; E.ui.notePane = true; E.ui.npTab = 'mine';
      E.audit('Opened a corrected note from Note Doctor', p.id);
      E.ui.modal = null; E.save();
      E.app.status('The facts are corrected. Write the history, exam and plan yourself, then sign.');
      E.app.go(`#/pt/${p.id}/notes`);
    },
  };
})();
