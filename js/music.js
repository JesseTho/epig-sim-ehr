/* SIM+EHR Student Edition — the login screen's music.

   An original, unhurried loop in the manner of a 1990s simulation game's menu music: electric-piano chords,
   a walking bass, brushed drums and a soft square-wave melody, eight bars in F major at 96 beats a minute.
   It is synthesised in the browser with the Web Audio API, so there is no audio file.

   It is off until the learner turns it on with "Play music" on the login screen (owner's decision), and it plays
   on the login screen only. It goes through the one sound system (js/audio.js): its context, its music bus and
   its mute, so the banner's speaker button silences it like everything else. Whether it is wanted is remembered
   there (E.audio.music()). Browsers allow sound only after someone interacts with the page, so nothing starts
   before the first click or key press. */
(function () {
  const E = window.EHR;
  const BPM = 96, STEP = 60 / BPM / 4, BAR = 16;        // 16th-note grid

  /* ---------- the score: [bass root, chord voicing] per bar, then melody as [16th step, MIDI note, length] ---------- */
  const BARS = [
    [41, [57, 60, 64, 67]],   // Fmaj9
    [40, [55, 59, 62, 64]],   // Em7
    [38, [53, 57, 60, 64]],   // Dm9
    [43, [53, 57, 59, 62]],   // G9
    [46, [53, 57, 58, 62]],   // Bbmaj7
    [45, [55, 60, 64, 67]],   // Am7
    [43, [53, 57, 58, 62]],   // Gm9
    [48, [53, 58, 62, 64]],   // C9sus
  ];
  const MELODY = [
    [[0, 72, 4], [6, 69, 2], [8, 67, 4], [12, 69, 4]],
    [[0, 67, 6], [8, 64, 2], [10, 62, 2], [12, 64, 4]],
    [[0, 65, 4], [4, 69, 4], [8, 72, 6]],
    [[0, 74, 4], [6, 72, 2], [8, 71, 4], [12, 67, 4]],
    [[0, 70, 4], [4, 69, 2], [6, 65, 2], [8, 62, 8]],
    [[0, 64, 4], [4, 67, 4], [8, 72, 4], [12, 69, 4]],
    [[0, 70, 6], [8, 69, 2], [10, 67, 2], [12, 65, 4]],
    [[0, 64, 8], [10, 65, 2], [12, 67, 4]],
  ];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let ctx = null, out = null, noise = null, timer = null, next = 0, step = 0, on = false, touched = false;
  const wanted = () => !!(E.audio && E.audio.music());

  /** The loop's own little mixer, built once on the shared context and fed into the music bus. */
  function graph(o) {
    if (ctx === o.ctx && out) return true;
    ctx = o.ctx;
    out = ctx.createGain(); out.gain.value = 0.0001;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 7000;
    // a little room: a feedback echo mixed in quietly
    const echo = ctx.createDelay(1); echo.delayTime.value = STEP * 3; const fb = ctx.createGain(); fb.gain.value = 0.28; const wet = ctx.createGain(); wet.gain.value = 0.22;
    out.connect(tone); tone.connect(o.out); tone.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(o.out);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const env = (g, t, a, peak, dec, sus, rel, len) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + dec); g.gain.setValueAtTime(Math.max(0.0001, peak * sus), t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + rel); };

  /* ---------- instruments ---------- */
  function epiano(m, t, len) {
    const g = ctx.createGain(), trem = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    const body = ctx.createOscillator(), tine = ctx.createOscillator(), tg = ctx.createGain();
    body.type = 'sine'; body.frequency.value = hz(m);
    tine.type = 'sine'; tine.frequency.value = hz(m) * 4; tg.gain.setValueAtTime(0.35, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    lfo.frequency.value = 4.5; lg.gain.value = 0.18; lfo.connect(lg); lg.connect(trem.gain); trem.gain.value = 0.82;
    body.connect(g); tine.connect(tg); tg.connect(g); g.connect(trem); trem.connect(out);
    env(g, t, 0.008, 0.09, 0.5, 0.45, 0.4, len);
    [body, tine, lfo].forEach((o) => { o.start(t); o.stop(t + len + 0.5); });
  }
  function bass(m, t, len) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.value = 700;
    o.connect(f); f.connect(g); g.connect(out); env(g, t, 0.01, 0.32, 0.2, 0.6, 0.08, len);
    o.start(t); o.stop(t + len + 0.2);
  }
  function lead(m, t, len) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'square'; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.value = 1700;
    vib.frequency.value = 5.2; vg.gain.value = hz(m) * 0.006; vib.connect(vg); vg.connect(o.frequency);
    o.connect(f); f.connect(g); g.connect(out); env(g, t, 0.03, 0.045, 0.15, 0.7, 0.12, len);
    [o, vib].forEach((x) => { x.start(t); x.stop(t + len + 0.3); });
  }
  function hit(kind, t) {
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.14);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2); return;
    }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    if (kind === 'brush') { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); }
    else { f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); }
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.2);
  }

  /* ---------- the sequencer: schedules a little ahead of the clock, a 16th note at a time ---------- */
  function play(i, t) {
    const bar = Math.floor(i / BAR) % BARS.length, s = i % BAR, [root, chord] = BARS[bar], nextRoot = BARS[(bar + 1) % BARS.length][0];
    const swing = s % 2 === 1 ? STEP * 0.33 : 0;   // swung 16ths
    if (s === 0) chord.forEach((m) => epiano(m, t, STEP * 5));
    if (s === 6) chord.forEach((m) => epiano(m, t + swing, STEP * 3));
    if (s % 4 === 0) bass([root, root + 7, root + 12, nextRoot - 1][s / 4], t, STEP * 3.5);
    MELODY[bar].forEach(([at, m, len]) => { if (at === s) lead(m, t + swing, len * STEP); });
    if (s === 0 || s === 8) hit('kick', t);
    if (s === 4 || s === 12) hit('brush', t);
    if (s % 2 === 0) hit('hat', t + swing);
  }
  function tick() {
    while (next < ctx.currentTime + 0.12) { play(step, next); next += STEP; step++; }
  }
  function start() {
    if (on) return;
    const o = E.audio && E.audio.musicOut();   // null when muted, hidden or without Web Audio
    if (!o || !graph(o)) return;
    on = true; step = 0; next = ctx.currentTime + 0.08;
    out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 1.2);
    timer = setInterval(tick, 25); tick();
  }
  function stop() {
    if (!on) return;
    on = false; clearInterval(timer);
    const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  }

  let scene = null;
  /** Play exactly when it should: wanted, on the login screen, not muted, tab in view, and after a first click. */
  function sync() {
    const ok = touched && scene === 'login' && wanted() && E.audio && !E.audio.muted() && !E.audio.hidden;
    if (ok) start(); else stop();
  }
  E.music = {
    /** The choice remembered on this computer (off until turned on). */
    get wanted() { return wanted(); },
    get playing() { return on; },
    /** "Play music" on the login screen. Turning the music on also lifts the mute: a learner who asks for music
        should hear it. Turning it off leaves the effects alone. */
    toggle() {
      if (!E.audio) return;
      const w = E.audio.setMusic(!wanted());
      touched = true;
      if (w && E.audio.muted()) E.audio.setMuted(false); else sync();
    },
    /** Called on every redraw with the screen showing; music plays on the login screen only. */
    scene(name) { scene = name; sync(); },
  };
  if (E.audio) E.audio.onChange(sync);   // the mute, the volume and the tab being hidden all come through here
  // A browser allows sound only after the person interacts with the page: nothing is made before the first click or key.
  const kick = () => { touched = true; sync(); };
  document.addEventListener('pointerdown', kick); document.addEventListener('keydown', kick);
})();
