/* SIM+EHR Student Edition — one sound system for everything that makes a noise.

   Every sound in the sim is synthesised in the browser (Web Audio); there are no sound files. Before this file
   the login music, the cutscene effects and the pig's oink each made their own AudioContext and had their own
   switch. Now there is one context, one mute and one volume:

     sources ─► music gain ─┐
     sources ─► sfx gain ───┴─► master gain (volume, mute) ─► limiter ─► speakers

   E.audio.sfx() and E.audio.musicOut() return { ctx, out }: the shared context and the node to connect to,
   or null when sound is muted, the tab is hidden, or the browser has no Web Audio. Callers build their
   oscillators on ctx and connect them to out; they never touch ctx.destination.

   The context is created on the first click or key press (browsers allow sound only after the person interacts
   with the page) and resumed whenever it has been suspended. Muting ramps the master gain down, so a sound that
   is already scheduled stops too. While the tab is hidden the master is ramped down and the context suspended:
   nothing sounds in a tab nobody is looking at.

   Preferences, remembered on this computer: `epig-audio` = { muted, volume, music }. `muted` is the one switch
   (the banner's speaker button); `music` is whether the login music should play at all, off until the learner
   turns it on (owner's decision). The older switches are read once: `epig-sfx` off (the cutscene speaker) means
   muted; `epig-music` was a music-only switch, so '1' (turned on by hand) keeps the music on and '0' only keeps
   it off, which is now the default anyway: switching the music off never silenced the effects. */
(function () {
  const E = window.EHR;
  const KEY = 'epig-audio';
  const LEVEL = { music: 0.55, sfx: 1 };   // music sits under the effects; the limiter catches anything that piles up

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* not remembered */ } },
  };
  /** Read the one preference, migrating the two old switches the first time. */
  function readPrefs() {
    let p = null;
    try { p = JSON.parse(store.get(KEY) || 'null'); } catch (e) { p = null; }
    if (!p || typeof p !== 'object') {
      p = { muted: store.get('epig-sfx') === '0', volume: 0.8, music: store.get('epig-music') === '1' };
      store.set(KEY, JSON.stringify(p));
    }
    const v = Number(p.volume);
    return { muted: !!p.muted, volume: isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8, music: p.music === true };
  }
  const prefs = readPrefs();
  const save = () => store.set(KEY, JSON.stringify(prefs));

  let ctx = null, master = null, buses = null, failed = false;
  const hidden = () => typeof document !== 'undefined' && !!document.hidden;
  const level = () => (prefs.muted || hidden() ? 0 : prefs.volume * prefs.volume);   // squared: the slider feels even to the ear

  function build() {
    if (ctx || failed) return ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { failed = true; return null; }
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = level();
      // a limiter: a fast, hard compressor just under full scale, so stacked effects never clip
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.12;
      master.connect(lim); lim.connect(ctx.destination);
      buses = {};
      Object.keys(LEVEL).forEach((k) => { const g = ctx.createGain(); g.gain.value = LEVEL[k]; g.connect(master); buses[k] = g; });
    } catch (e) { ctx = null; failed = true; }
    return ctx;
  }
  /** Move the master to where the preferences and the tab say it should be. A short ramp, never a click. */
  function apply(fast) {
    if (!ctx) return;
    const t = ctx.currentTime, g = master.gain;
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(level(), t, fast ? 0.015 : 0.05); } catch (e) { g.value = level(); }
    if (hidden()) setTimeout(() => { if (ctx && hidden() && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 120);
    else if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  const listeners = [];
  const changed = () => listeners.slice().forEach((fn) => { try { fn(); } catch (e) { /* a listener's problem, not ours */ } });
  /** The context and the node to connect to, or null when nothing should sound. */
  function out(bus) {
    if (prefs.muted || hidden()) return null;
    if (!build()) return null;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return { ctx, out: buses[bus] };
  }

  E.audio = {
    /** For a sound effect: { ctx, out } or null. */
    sfx: () => out('sfx'),
    /** For the music: { ctx, out } or null. */
    musicOut: () => out('music'),
    /** The context itself, created if needed (null without Web Audio). For scheduling, not for deciding whether to play. */
    context: () => build(),
    muted: () => prefs.muted,
    /** The one switch for every sound in the sim. Remembered on this computer. */
    setMuted(b) { prefs.muted = !!b; save(); apply(true); changed(); return prefs.muted; },
    toggle() { return E.audio.setMuted(!prefs.muted); },
    /** Whether the login music is wanted. Off until the learner turns it on; the mute still silences it. */
    music: () => prefs.music,
    setMusic(b) { prefs.music = !!b; save(); changed(); return prefs.music; },
    /** True once the context exists and is running: a person has interacted with the page. */
    awake: () => !!ctx && ctx.state === 'running',
    volume: () => prefs.volume,
    setVolume(v) { v = Number(v); prefs.volume = isFinite(v) ? Math.max(0, Math.min(1, v)) : prefs.volume; save(); apply(); changed(); return prefs.volume; },
    /** Called when the mute or volume changes (the music stops itself, buttons redraw). */
    onChange(fn) { if (typeof fn === 'function') listeners.push(fn); },
    get hidden() { return hidden(); },
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    // A browser allows sound only after the person interacts with the page: make (or wake) the context then.
    const wake = () => { if (!prefs.muted && !hidden() && build() && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
    document.addEventListener('pointerdown', wake, true); document.addEventListener('keydown', wake, true);
    document.addEventListener('visibilitychange', () => { apply(true); changed(); });
  }
})();
