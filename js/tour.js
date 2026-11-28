/* SIM+EHR Student Edition — the first-visit walkthrough, led by Truffle (js/pal.js).
   One real task, five steps: open a chart, open Results, trend the creatinine, start a note, use a dot phrase.
   Each step moves on when the learner does it, never on a Next button, so the tour is practice, not a slideshow.
   A ring marks the control to use; the rest of the screen stays live. It is offered once at first sign-in, can be
   skipped at any step, and can be run again from Help ("Where to start"). It explains the record, not the scoring:
   XP and badges stay in Help. */
(function () {
  const E = window.EHR;
  const PID = 'p1';
  const on = (re) => () => re.test(location.hash);
  const draft = () => { const p = E.pt(PID); return !!(p && p.noteDraft); };
  const STEPS = [
    { text: 'First, a patient. Click Akana, Keoni on the list.', target: () => (location.hash === '#/home' ? `tr[data-act="openPt"][data-id="${PID}"]` : 'a.tool[href="#/home"]'), done: on(/^#\/pt\/p1\//) },
    { text: 'His chart. The sidebar on the left always shows his allergies and code status. Now open Results.', target: () => `.acts a[href="#/pt/${PID}/results"]`, done: on(/^#\/pt\/p1\/results/) },
    { text: 'Click Creatinine to see how it has changed over his stay.', target: () => 'tr[data-act="selLab"][data-comp="Cr"]', done: () => saw.has('results.trend') },
    { text: 'It is rising, which belongs in a note. Click Create Note.', target: () => '.notepane [data-act="noteNew"], .notepane.shut > button, .notes-page [data-act="noteNew"]', done: draft },
    { text: 'Your note starts from a template. Click at the end of a line, type .labs and then a space.', target: () => '#noteText', done: () => saw.has('note.dot') },
  ];

  let step = -1, timer = null, ring = null, shown = -1;
  const saw = new Set();
  const pr = () => E.progress();
  // every learning event passes through E.track (js/learning.js); the tour watches it without changing it
  const base = E.track;
  E.track = (ev) => { if (step >= 0) saw.add(ev); return base(ev); };

  function mark(sel) {
    if (!ring) { ring = document.createElement('div'); ring.id = 'tour-ring'; ring.setAttribute('aria-hidden', 'true'); document.body.appendChild(ring); }
    const el = sel && [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length);
    if (!el || (E.ui && E.ui.modal)) { ring.hidden = true; return; }
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) el.scrollIntoView({ block: 'center' });
    const q = el.getBoundingClientRect();
    Object.assign(ring.style, { left: q.left - 5 + 'px', top: q.top - 5 + 'px', width: q.width + 10 + 'px', height: q.height + 10 + 'px' });
    ring.hidden = false;
  }
  function speak() {
    shown = step;
    E.pal.guide(`Step ${step + 1} of ${STEPS.length}`, STEPS[step].text, [['skip', 'Skip the tour']]);
  }
  function tick() {
    if (step < 0) return;
    if (!E.db || !E.db.user) return stop();
    const s = STEPS[step];
    if (s.done()) {
      step += 1;
      if (step >= STEPS.length) return finish();
      E.pal.pose('cheer', 1600);
    }
    if (shown !== step) speak();
    mark(STEPS[step].target());
  }
  function stop() {
    step = -1; shown = -1; clearInterval(timer); timer = null;
    if (ring) ring.hidden = true;
  }
  function finish() {
    stop();
    pr().tour = 'done'; E.save();
    E.pal.pose('cheer', 3000);
    E.pal.guide('Tour done', 'That is the record: a chart, its results, and a note. Sign the note when you are ready, or leave it as a draft. Missions has your next step.', [['missions', 'Go to Missions'], ['close', 'Done']]);
  }

  E.tour = {
    /** At first sign-in: offer once, to a learner who has not done much yet. True when the offer was made. */
    offer() {
      const p = pr();
      if (p.tour || !E.pt(PID) || Object.keys(p.events || {}).length > 2) return false;
      p.tour = 'offered'; E.save();
      E.pal.guide(`Hi ${E.db.user.name.split(' ')[0]}, I'm ${E.pal.name}`, 'Want me to show you around? It takes about two minutes, on a real patient.', [['start', 'Show me'], ['skip', 'I’ll explore']]);
      return true;
    },
    start() {
      if (!E.pt(PID)) return E.app.status('The tour needs the ward patients. Reset the ward from Missions first.');
      E.ui.modal = null; saw.clear(); step = 0; shown = -1;
      E.pal.wake();
      if (!/^#\/home/.test(location.hash) && !/^#\/pt\/p1\//.test(location.hash)) E.app.go('#/home'); else E.app.render();
      clearInterval(timer); timer = setInterval(tick, 300); tick();
    },
    /** A button in Truffle's balloon while the tour (or its offer) is showing. */
    button(id) {
      if (id === 'start') return E.tour.start();
      if (id === 'missions') { E.pal.hush(); return E.app.go('#/missions'); }
      if (id === 'skip') { const was = step >= 0; stop(); if (pr().tour !== 'done') pr().tour = 'skipped'; E.save(); E.pal.guide('No problem', was ? 'You can run the tour again any time from Help, under Where to start.' : 'Click me any time for a tip. The tour is in Help, under Where to start.', [['close', 'Got it']]); return; }
      E.pal.hush();
    },
    get active() { return step >= 0; },
    /** One check of the current step (run every 300 ms while the tour is on; called directly by tests/tour-test.js). */
    tick,
  };
  // the Help window's "Show me around" button
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-tour="start"]')) E.tour.start(); });
})();
