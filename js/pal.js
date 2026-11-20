/* SIM+EHR Student Edition — Truffle, the desk assistant in the bottom-right corner.
   A flying pig that reacts to what the learner is doing and offers one tip at a time, in the manner of the
   office assistants of the late 1990s. It never blocks work: it stays still unless clicked, speaks only when
   there is something useful to say, steps aside when it would cover a control, and can be put away. When put
   away it leaves a small tab in the corner to bring it back.

   Artwork: assets/assistant/pig-sheet-48.png, a 4 x 2 sheet of 48px cells, rough-cut from artwork supplied by the
   project owner and shown doubled with hard pixels, matching the logo
   (pig-sheet-source.png is the file as received). The sheet faces right; the stylesheet mirrors it so the pig
   faces into the screen. Cells, left to right, top row then bottom row: */
(function () {
  const E = window.EHR;
  const NAME = 'Truffle';
  const POSES = ['flap-a', 'flap-b', 'wave', 'think', 'idea', 'wait', 'cheer', 'worry'];

  /* Which practice tasks belong to which screen, so a tip is about what is in front of the learner. */
  const AREA = {
    summary: ['summary.view'], results: ['results.trend', 'report.view'], flowsheets: ['vitals.trend'], mar: ['mar.view'],
    notes: ['note.template', 'note.dot', 'note.sign', 'note.handoff'], orders: ['allergy.review', 'order.submit', 'order.set', 'lab.order', 'alert.allergy', 'alert.other', 'alert.removed', 'code.review'],
    problems: ['chart.update', 'allergy.process'], review: ['report.view'], inbox: ['result.read', 'critical.read'], log: ['log.view'],
  };
  const LABEL = { summary: 'the Summary', results: 'Results', flowsheets: 'Flowsheets', mar: 'the MAR', notes: 'Notes', orders: 'Orders', problems: 'Problems & Allergies', review: 'Chart Review', inbox: 'the Inbox', log: 'the Activity Log' };

  let root, back, timedPose = null, mood = null, poseTimer = null, bubbleTimer = null, area = null, signedIn = false, queued = false;
  let tucked = false;      // no clear spot on this screen: waiting in the corner tab
  let forced = false;      // the learner asked for it, so it may overlap until its balloon closes
  let unprompted = false;  // the open balloon was Truffle's idea, so it gives way before the pig does
  const seen = new Set();   // screens already introduced this session
  const prefs = () => E.db.prefs || (E.db.prefs = {});
  const $ = (s) => root.querySelector(s);

  function draw() {
    const pig = $('.pal-pig'), pose = mood || timedPose;   // what the screen calls for outranks a passing gesture
    if (pose) pig.dataset.pose = pose; else delete pig.dataset.pose;
  }
  /** Hold a pose for a moment (a cheer, a wave), then go back to whatever the screen calls for. */
  function pose(name, ms) {
    if (!root) return;
    timedPose = name; draw();
    clearTimeout(poseTimer);
    poseTimer = setTimeout(() => { timedPose = null; draw(); }, ms || 2200);
  }
  /** Step aside. The pig and its balloon are placed where they cover no control: tried at the bottom of
      the right edge first, then higher. If an unprompted balloon will not fit, it closes. If the pig itself
      will not fit (a screen-filling note editor, say), it tucks into the corner tab until there is room.
      It is placed, never slid: nothing here animates on its own. */
  const TAKEN = '.banner a, .banner button, .toolbar a, .toolbar button, .toolbar input, .wstabs a, .wstabs button, .acts a, .main button, .main input, .main select, .main textarea, .main a[href], .modal';
  function fits(el, taken) {
    for (let bottom = 8; bottom < window.innerHeight - 60; bottom += 28) {
      el.style.bottom = bottom + 'px';
      const p = el.getBoundingClientRect();
      if (p.top < 0) break;
      if (!taken.some((r) => r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top)) return true;
    }
    el.style.bottom = '';
    return false;
  }
  function dodge() {
    queued = false;
    if (!root) return;
    const off = !!prefs().palOff;
    if (!signedIn) { root.hidden = back.hidden = true; return; }
    if (off) { root.hidden = true; back.hidden = false; back.style.bottom = ''; return; }
    if (forced) { tucked = false; root.hidden = false; back.hidden = true; root.style.bottom = '8px'; return; }
    const taken = [...document.querySelectorAll(TAKEN)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
    root.hidden = false; back.hidden = true;
    let ok = fits(root, taken);
    if (!ok && unprompted && !$('.pal-bubble').hidden) { $('.pal-bubble').hidden = true; clearTimeout(bubbleTimer); ok = fits(root, taken); }
    tucked = !ok;
    if (tucked) { $('.pal-bubble').hidden = true; root.hidden = true; back.hidden = false; if (!fits(back, taken)) back.style.bottom = ''; }
  }
  const dodgeSoon = () => { if (!queued) { queued = true; requestAnimationFrame(dodge); } };
  function hush() { if (root) { $('.pal-bubble').hidden = true; clearTimeout(bubbleTimer); forced = false; dodge(); } }
  /** Speak. One short message, a way to dismiss it, and a way to put the assistant away. */
  function say(text, opts) {
    if (!root || !signedIn || prefs().palOff) return;
    opts = opts || {};
    unprompted = !!opts.auto;
    if (tucked && unprompted) return;   // nowhere to stand: keep the thought for later
    const b = $('.pal-bubble');
    b.innerHTML = `<b>${E.esc(NAME)}</b><p>${E.esc(text)}</p><div class="pal-acts">${opts.more === false ? '' : '<button class="btn xs" data-pal="more">Another tip</button>'}<button class="btn xs primary" data-pal="close">Got it</button></div><button class="pal-hide" data-pal="hide">Put ${E.esc(NAME)} away</button>`;
    b.hidden = false;
    dodge();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(hush, opts.ms || 16000);
  }
  /** The next thing worth doing on this screen: the first unfinished practice task that belongs here. */
  function taskFor(a) {
    const done = E.progress().events, want = AREA[a] || [];
    for (const lo of E.LEARNING) for (const t of lo.tasks) if (want.includes(t.event) && !done[t.event]) return t;
    return null;
  }
  const fact = () => 'Did you know? ' + E.FACTS[Math.floor(Math.random() * E.FACTS.length)];
  function tip() {
    const t = area && taskFor(area);
    say(t ? `It looks like you're in ${LABEL[area]}. Want a challenge worth ${E.XP.task} XP? ${t.text}` : fact());
  }
  /** The only motion Truffle makes: a short flap and hop when clicked. */
  function flutter() {
    const pig = $('.pal-pig');
    pig.classList.remove('flutter'); void pig.offsetWidth; pig.classList.add('flutter');
    setTimeout(() => pig.classList.remove('flutter'), 1300);
  }
  const place = dodge;

  E.pal = {
    name: NAME,
    poses: POSES,
    pose,
    say,
    /** Called after every redraw with the mood the screen calls for (or null), and whether anyone is signed in. */
    sync(nextMood, isSignedIn) {
      if (!root) return;
      signedIn = !!isSignedIn; mood = nextMood;
      place(); draw();
    },
    /** Called on navigation. The first time a screen with an open task is visited, the pig offers it. */
    context(a) {
      area = a;
      if (!root || !signedIn || prefs().palOff || !a) return;
      const t = taskFor(a);
      if (t && !seen.has(a)) { seen.add(a); pose('idea', 2600); say(`It looks like you're in ${LABEL[a]}. Want a challenge worth ${E.XP.task} XP? ${t.text}`, { auto: true }); }
    },
    greet() {
      if (!root) return;
      signedIn = true; place();
      if (prefs().palOff) return;
      pose('wave', 3200);
      say(`Hi ${E.db.user.name.split(' ')[0]}, I'm ${NAME}. I'll point out things worth trying as you go. Click me any time for a tip.`, { more: false, ms: 11000, auto: true });
    },
    show() { prefs().palOff = false; E.save(); place(); pose('wave', 2600); say(`I'm back. Click me any time for a tip.`, { more: false, ms: 8000 }); },
    hide() { prefs().palOff = true; E.save(); place(); },
  };

  function mount() {
    root = document.getElementById('pal');
    back = document.getElementById('pal-back');
    if (!root || !back) return;
    root.hidden = back.hidden = true;
    root.innerHTML = `<div class="pal-bubble" role="status" hidden></div><button class="pal-pig" data-pal="toggle" aria-label="${NAME}, your SIM+EHR guide. Show a tip." title="${NAME}: click for a tip"><i></i></button>`;
    back.innerHTML = `<i></i><span>${NAME}</span>`;
    back.title = `${NAME}: click for a tip`;
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pal]');
      if (!b) return;
      const act = b.dataset.pal;
      if (act === 'toggle') { flutter(); if ($('.pal-bubble').hidden) tip(); else hush(); }
      else if (act === 'more') say(fact());
      else if (act === 'close') hush();
      else if (act === 'hide') E.pal.hide();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-pal="show"], #pal-back')) return;
      if (prefs().palOff) return E.pal.show();
      forced = true; dodge(); flutter(); tip();   // it had only stepped aside: come out for this one tip
    });
    document.addEventListener('scroll', dodgeSoon, true);
    window.addEventListener('resize', dodgeSoon);
  }
  mount();
})();
