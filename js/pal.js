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
  const POSES = ['flap-a', 'flap-b', 'wave', 'think', 'idea', 'wait', 'cheer', 'worry', 'unsure', 'gasp', 'yawn', 'smug', 'shy', 'sad', 'phew', 'wink'];   // rows 1 to 4 of the sheet; rows 5 and 6 are the blink and the glance

  /* Which practice tasks belong to which screen, so a tip is about what is in front of the learner. */
  const AREA = {
    summary: ['summary.view'], results: ['results.trend', 'report.view'], flowsheets: ['vitals.trend'], mar: ['mar.view'],
    notes: ['note.template', 'note.dot', 'note.picklist', 'note.sign', 'note.phrase', 'note.copyforward', 'note.handoff'], medrec: ['medrec.admit', 'rx.write'], orders: ['allergy.review', 'order.submit', 'order.set', 'lab.order', 'alert.allergy', 'alert.other', 'alert.removed', 'code.review'],
    problems: ['chart.update', 'allergy.process'], review: ['report.view'], inbox: ['result.read', 'critical.read', 'escalate.sbar'], log: ['log.view'],
  };
  const LABEL = { summary: 'the Summary', results: 'Results', flowsheets: 'Flowsheets', mar: 'the MAR', notes: 'Notes', orders: 'Orders', medrec: 'Med Rec', problems: 'Problems & Allergies', review: 'Chart Review', inbox: 'the Inbox', log: 'the Activity Log' };

  let root, back, timedPose = null, mood = null, poseTimer = null, bubbleTimer = null, area = null, signedIn = false, queued = false;
  let tucked = false;      // no clear spot on this screen: waiting in the corner tab
  let forced = false;      // the learner asked for it, so it may overlap until its balloon closes
  let unprompted = false;  // the open balloon was Truffle's idea, so it gives way before the pig does
  const seen = new Set();   // screens already introduced this session
  const prefs = () => E.db.prefs || (E.db.prefs = {});
  const $ = (s) => root.querySelector(s);

  // Reactions to something that just happened. For their few seconds they outrank 'wait', the screen's mood while
  // any test is in process: otherwise a pig reacting to harm or a rescue in a busy ward would never show it.
  const REACT = new Set(['gasp', 'worry', 'cheer', 'phew', 'sad', 'unsure']);
  function draw() {
    const pig = $('.pal-pig'), pose = timedPose && REACT.has(timedPose) && (!mood || mood === 'wait') ? timedPose : mood || timedPose;   // otherwise what the screen calls for outranks a passing gesture
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
  /* Both #pal and #pal-back are fixed to the bottom edge, so the box at a given `bottom` is known without moving
     it: same left, right and height, top = window height - bottom - height. One measurement, then arithmetic,
     instead of a layout per 28px step; the step order and the spot chosen are exactly as before. */
  function fits(el, taken) {
    const r = el.getBoundingClientRect(), vh = window.innerHeight;
    for (let bottom = 8; bottom < vh - 60; bottom += 28) {
      const p = { left: r.left, right: r.right, top: vh - bottom - r.height, bottom: vh - bottom };
      if (p.top < 0) break;
      if (!taken.some((t) => t.left < p.right && t.right > p.left && t.top < p.bottom && t.bottom > p.top)) { el.style.bottom = bottom + 'px'; return true; }
    }
    el.style.bottom = '';
    return false;
  }
  // What the last placement was worked out from. When none of it has changed, the pig is already where it belongs.
  let lastSig = '', colLeft = 0;
  function dodge() {
    queued = false;
    if (!root) return;
    const off = !!prefs().palOff;
    if (!signedIn) { lastSig = ''; root.hidden = back.hidden = true; return; }
    if (off) { lastSig = ''; root.hidden = true; back.hidden = false; back.style.bottom = ''; return; }
    if (forced) { lastSig = ''; tucked = false; root.hidden = false; back.hidden = true; root.style.bottom = '8px'; return; }
    const vw = window.innerWidth, bubbleOpen = !$('.pal-bubble').hidden;
    // Only controls in the right-hand column the pig and its balloon can occupy matter; the rest can scroll freely.
    const taken = [...document.querySelectorAll(TAKEN)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height && r.right > colLeft);
    const sigOf = () => [vw, window.innerHeight, !$('.pal-bubble').hidden, unprompted, tucked, root.hidden ? 0 : Math.round(root.getBoundingClientRect().height)].concat(taken.map((r) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`)).join('|');
    if (sigOf() === lastSig) return;
    root.hidden = false; back.hidden = true;
    let ok = fits(root, taken);
    if (!ok && unprompted && bubbleOpen) { $('.pal-bubble').hidden = true; clearTimeout(bubbleTimer); ok = fits(root, taken); }
    tucked = !ok;
    if (tucked) { $('.pal-bubble').hidden = true; root.hidden = true; back.hidden = false; if (!fits(back, taken)) back.style.bottom = ''; }
    else colLeft = Math.min(root.getBoundingClientRect().left, vw - 360);   // the column: the pig with its widest balloon, measured where it stands
    lastSig = sigOf();
  }
  /** At most once per animation frame, however many scroll and resize events arrive. */
  const dodgeSoon = () => { if (!queued) { queued = true; requestAnimationFrame(dodge); } };
  /** A scroll only matters if what scrolled reaches into the pig's column: a scrolled table on the left cannot move a control under it. */
  function onScroll(e) {
    const t = e.target;
    if (t && t.nodeType === 1 && t !== document.documentElement && t !== document.body && t.getBoundingClientRect && t.getBoundingClientRect().right <= colLeft) return;
    dodgeSoon();
  }
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
  /** A balloon that stays until a button in it is pressed: the walkthrough's (js/tour.js). The pig comes out for it
      even where it would overlap a control, and stands at the bottom of the right edge. */
  function guide(title, text, buttons) {
    if (!root || !signedIn) return;
    forced = true; unprompted = false; clearTimeout(bubbleTimer);
    const b = $('.pal-bubble');
    b.innerHTML = `<b>${E.esc(title)}</b><p>${E.esc(text)}</p><div class="pal-acts">${buttons.map(([id, label]) => `<button class="btn xs${id === 'skip' || id === 'close' ? '' : ' primary'}" data-pal="tour" data-id="${id}">${E.esc(label)}</button>`).join('')}</div>`;
    b.hidden = false;
    dodge();
  }

  E.pal = {
    name: NAME,
    poses: POSES,
    pose,
    say,
    guide,
    hush,
    /** Out of the corner and back on screen, for something the learner asked for. */
    wake() { prefs().palOff = false; E.save(); signedIn = true; place(); },
    /** Called after every redraw with the mood the screen calls for (or null), and whether anyone is signed in. */
    sync(nextMood, isSignedIn) {
      if (!root) return;
      signedIn = !!isSignedIn; mood = nextMood;
      place(); draw();
    },
    /** Called on navigation. The first time a screen with an open task is visited, the pig offers it. */
    context(a) {
      area = a;
      if (!root || !signedIn || prefs().palOff || !a || (E.tour && E.tour.active)) return;
      const t = taskFor(a);
      if (t && !seen.has(a)) { seen.add(a); pose('idea', 2600); say(`It looks like you're in ${LABEL[a]}. Want a challenge worth ${E.XP.task} XP? ${t.text}`, { auto: true }); }
    },
    greet() {
      if (!root) return;
      signedIn = true; place();
      if (prefs().palOff) return;
      pose('wave', 3200);
      if (E.tour && E.tour.offer()) return;   // a newcomer is offered the walkthrough instead of the hello
      say(`Hi ${E.db.user.name.split(' ')[0]}, I'm ${NAME}. Click me any time for a tip.`, { more: false, ms: 11000, auto: true });
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
      if (act === 'tour') E.tour.button(b.dataset.id);
      else if (act === 'toggle') { flutter(); if (E.tour && E.tour.active) return; if ($('.pal-bubble').hidden) tip(); else hush(); }
      else if (act === 'more') say(fact());
      else if (act === 'close') hush();
      else if (act === 'hide') E.pal.hide();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-pal="show"], #pal-back')) return;
      if (prefs().palOff) return E.pal.show();
      forced = true; dodge(); flutter(); tip();   // it had only stepped aside: come out for this one tip
    });
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', dodgeSoon);
  }
  mount();
})();
