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
    { id: 'spot', name: 'Spot the Unsafe Order', glyph: 'warn', skill: 'Safe ordering · EPA 4', blurb: 'A patient and six orders. Decide which are safe and which to stop. Every stop shows the allergy, interaction or lab that makes it unsafe.' },
    { id: 'note', name: 'Note Doctor', glyph: 'notes', skill: 'Documentation · EPA 5', blurb: 'A progress note with mistakes in it: copied-forward vitals, a wrong allergy, another patient’s lab. Check it against the chart and click every line that is wrong.' },
  ];
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

  /* ---------- views ---------- */
  V.gameShelf = () => {
    const pr = E.progress();
    return `<h3 class="shelf-h">${icon('star', 32)}Mini-games</h3><div class="game-grid">${E.GAMES.map((g) => { const r = (pr.games || {})[g.id]; return `<article class="game">${icon(g.glyph, 48)}<div class="game-main"><b>${esc(g.name)}</b><span class="game-skill">${esc(g.skill)}</span><p>${esc(g.blurb)}</p></div><div class="game-side">${r && r.plays ? `<span>Best ${r.best}%</span><span>${r.perfect} perfect</span>` : '<span>Not played yet</span>'}<button class="btn primary" data-act="gameOpen" data-id="${g.id}">Play</button></div></article>`; }).join('')}</div>`;
  };

  V.modalExt = Object.assign(V.modalExt || {}, {
    game(m, modal, cancel) {
      const p = E.pt(m.s.pid), g = E.GAMES.find((x) => x.id === m.game), done = m.checked;
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
        return modal(g.name, `${ptCard}${facts}<p class="g-ask">${done ? `<b>${score} of ${s.cards.length} right.</b> ${score === s.cards.length ? 'Every unsafe order stopped, every safe one let through.' : 'Read why for the ones you missed.'}` : 'For each order: is it safe to give this patient? Take your time; this is not timed.'}</p><div class="g-cards">${cards}</div>`,
          done ? `<button class="btn" data-act="gameOpen" data-id="spot">Play again</button>${keep.length ? `<button class="btn" data-act="spotSend">Add the ${keep.length} order${keep.length > 1 ? 's' : ''} you marked Safe to ${esc(p.name)}’s unsigned orders</button>` : ''}<button class="btn primary" data-act="closeModal">Close</button>`
            : `${cancel}<button class="btn primary" data-act="gameCheck">Check my answers</button>`, 'xl');
      }
      const s = m.s, n = s.lines.filter((l) => l.err).length;
      const found = done ? s.lines.filter((l, i) => l.err && m.flags[i]).length : 0, falses = done ? s.lines.filter((l, i) => !l.err && m.flags[i]).length : 0;
      const lines = s.lines.map((l, i) => {
        const f = !!m.flags[i], cls = !done ? (f ? ' flagged' : '') : l.err ? (f ? ' found' : ' missed') : f ? ' false' : '';
        return `<li class="g-line${cls}">${done ? `<span class="g-l">${esc(l.t)}</span>${l.err ? `<p class="g-why">${icon(f ? 'check' : 'alert', 16)}<span><b>${f ? 'Caught.' : 'Missed.'}</b> ${esc(l.err.why)}</span></p>` : f ? `<p class="g-why">${icon('info', 16)}<span><b>This line was correct.</b></span></p>` : ''}`
          : `<button class="g-l" data-act="noteFlag" data-i="${i}" aria-pressed="${f}">${esc(l.t)}</button>`}</li>`;
      }).join('');
      const facts = `<dl class="kv g-facts">${s.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
      return modal(g.name, `${ptCard}<p class="g-ask">${done ? `<b>${found} of ${n} mistakes caught${falses ? `, ${falses} correct line${falses > 1 ? 's' : ''} flagged` : ''}.</b>` : `This note has <b>${n} mistakes</b>. Compare it with the chart and click every line that is wrong.`}</p>
        <div class="g-split"><ol class="g-note">${lines}</ol><aside><h4>${icon('summary', 24)}From the chart</h4>${facts}</aside></div>`,
        done ? `<button class="btn" data-act="gameOpen" data-id="note">Play again</button><button class="btn" data-act="noteSend">Open the corrected note in ${esc(p.name)}’s chart to finish and sign</button><button class="btn primary" data-act="closeModal">Close</button>`
          : `${cancel}<button class="btn primary" data-act="gameCheck">Check my answers</button>`, 'xl');
    },
  });

  /* ---------- actions ---------- */
  E.gameActions = {
    gameOpen(d) {
      const s = d.id === 'spot' ? buildSpot() : buildNote();
      if (!s) return E.app.status('No patient has enough risky orders for a round right now.');
      E.ui.modal = { type: 'game', game: d.id, s, marks: {}, flags: {}, checked: false };
      E.app.render();
    },
    spotMark(d) { const m = E.ui.modal; m.marks[d.i] = m.marks[d.i] === d.v ? undefined : d.v; E.app.render(); },
    noteFlag(d) { const m = E.ui.modal; m.flags[d.i] = !m.flags[d.i]; E.app.render(); },
    gameCheck() {
      const m = E.ui.modal, s = m.s, pr = E.progress(), before = E.game(pr);
      let pct, perfect;
      if (m.game === 'spot') {
        if (s.cards.some((c, i) => !m.marks[i])) { const e = document.getElementById('modalErr'); if (e) e.textContent = 'Mark every order Safe or Stop.'; return; }
        const right = s.cards.filter((c, i) => (m.marks[i] === 'stop') === c.unsafe).length;
        pct = Math.round((right / s.cards.length) * 100); perfect = right === s.cards.length;
      } else {
        const n = s.lines.filter((l) => l.err).length, found = s.lines.filter((l, i) => l.err && m.flags[i]).length, falses = s.lines.filter((l, i) => !l.err && m.flags[i]).length;
        pct = Math.max(0, Math.round(((found - falses) / n) * 100)); perfect = found === n && !falses;
      }
      const r = record(m.game); r.plays++; r.best = Math.max(r.best, pct); if (perfect) r.perfect++;
      m.checked = true;
      E.audit(`Played ${E.GAMES.find((g) => g.id === m.game).name}: ${pct}%`, s.pid);
      E.save();
      const g = E.game(pr), gained = g.xp - before.xp;
      if (gained) E.app.toast(perfect ? 'A perfect round.' : 'Round complete.', `+${gained} XP · Mini-game`, 'star');
      E.app.render();
    },
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
      p.noteDraft = { type: 'Progress Note', text, pristine: false, source: 'Note Doctor' };
      E.audit('Opened a corrected note from Note Doctor', p.id);
      E.ui.modal = null; E.save();
      E.app.status('The facts are corrected. Write the history, exam and plan yourself, then sign.');
      E.app.go(`#/pt/${p.id}/notes`);
    },
  };
})();
