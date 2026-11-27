/* SIM+EHR Student Edition — the world outside the chart.

   Three things, all ambient: nothing here is needed to do the work, and each can be switched off in
   EHR.CONFIG.world (js/config.js).

   1. THE BANNER AS A PICTURE OF THE DAY. While a shift or a case is running, the empty middle of the banner
      shows the time: the sky changes through the day, the sun crosses, an hour ruler carries a pin for
      everything that has already happened. A small hospital shows the census and a red beacon while a patient
      is in a crisis; a small lab lights up while a test is in process; a pig flies each tube out and each
      result back. Arriving patients (on foot or by ambulance) come in from beyond the page's left edge, and a
      patient going home leaves that way, on a road that runs the whole width of the banner behind the lockup.
      It is driven by watching the data once a second for differences, so no other file has to tell it anything.

   2. THE CUTSCENE WINDOW. A dialog with a small stage, a caption typed out a letter at a time, and sound
      synthesised in the browser through the shared EHR.audio (js/audio.js) when it is loaded:
      EHR.world.scene({ kind, title, lines }). Kinds: arrive, page, night, rapid, home, dawn, dusk. A window asked
      for while the tab is hidden waits until the tab is visible again.

   3. CONSEQUENCES. When an action in the sim has a result worth showing (a patient harmed by an order, a
      rescue, a transfer to intensive care) the same window opens with an animated picture of that result, built
      by tools/build-scenes.js into assets/cut (counts in js/cuts.js). An entry without a built picture falls back
      to its `media` file, or a placeholder card with the art brief. See docs/cases-and-world-plan.md.

   The banner sprites are drawn in code at the screen's pixel ratio. They are placeholders until art is supplied. */
(function () {
  const E = window.EHR, V = E.V || (E.V = {}), esc = E.esc;
  const CFG = () => Object.assign({ banner: true, ruler: false, cutscenes: true, sound: true, consequences: true }, (E.CONFIG && E.CONFIG.world) || {});
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (h) => { const m = ((Math.round(h * 60) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const root = document.documentElement.style;

  /* =====================================================================================================
     1. SOUND: short effects, synthesised. With js/audio.js loaded (the normal case) every effect goes through
     its shared context, sfx bus, mute and volume: E.audio.sfx() is null when muted, when the tab is hidden or
     without Web Audio, and then nothing plays. Without it (an old page) the effects keep their own context and
     their own remembered switch, as before.
     ===================================================================================================== */
  const PREF = 'epig-sfx';
  let ac = null, sfxOn = (() => { try { return localStorage.getItem(PREF) !== '0'; } catch (e) { return true; } })();
  const ctx = () => { if (ac) return ac; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { ac = new AC(); } catch (e) { ac = null; } return ac; };
  /** Where a sound goes: { ctx, out } from the shared audio, or (fallback only) this file's own context. */
  function sink() {
    if (E.audio) return E.audio.sfx();
    const c = ctx(); if (!c) return null;
    if (c.state === 'suspended') c.resume().catch(() => {});
    return { ctx: c, out: c.destination };
  }
  let dest = null;   // the sink of the sound being played (set by E.sfx.play for the length of one effect)
  /** One note: frequency (or [from, to] for a slide), start offset and length in seconds. */
  function tone(f, at, len, type, vol) {
    const s = dest; if (!s) return;
    const c = s.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at, [f0, f1] = [].concat(f);
    o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.008); g.gain.setValueAtTime(vol || 0.06, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(s.out); o.start(t); o.stop(t + len + 0.02);
  }
  /* Levels: square waves at 0.05 or under, the softer triangle and sawtooth up to 0.07, so no effect stands out from the rest. */
  const SOUNDS = {
    pager: () => { [0, 0.14, 0.28].forEach((t) => tone(2093, t, 0.08, 'square', 0.035)); },                               // a page: three short high beeps
    critical: () => { [880, 880, 659].forEach((f, i) => tone(f, i * 0.2, 0.17, 'triangle', 0.065)); tone(523, 0.62, 0.3, 'triangle', 0.06); },   // a critical result: falling and insistent
    blip: () => tone(1250, 0, 0.022, 'square', 0.02),
    siren: () => { for (let i = 0; i < 6; i++) tone(i % 2 ? 620 : 830, i * 0.28, 0.27, 'triangle', 0.07); },
    ring: () => { for (let i = 0; i < 3; i++) { tone(1480, i * 0.42, 0.07, 'square', 0.05); tone(1480, i * 0.42 + 0.11, 0.07, 'square', 0.05); } },
    alarm: () => { for (let i = 0; i < 4; i++) tone(988, i * 0.3, 0.17, 'square', 0.06); },
    tick: () => { for (let i = 0; i < 6; i++) tone(i % 2 ? 900 : 1300, i * 0.33, 0.012, 'square', 0.05); },
    chime: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.32, 'triangle', 0.07)),
    low: () => [196, 165, 131].forEach((f, i) => tone(f, i * 0.3, 0.42, 'sawtooth', 0.045)),
    gasp: () => { tone([520, 180], 0, 0.5, 'sawtooth', 0.05); tone(185, 0.12, 0.6, 'square', 0.04); },
    phew: () => { tone([330, 494], 0, 0.3, 'triangle', 0.07); tone(659, 0.3, 0.4, 'triangle', 0.07); },
  };
  E.sfx = {
    /** Sound is wanted: the shared mute (or this file's own switch) is on, and the sim's config allows effects. */
    get on() { return (E.audio ? !E.audio.muted() : sfxOn) && CFG().sound; },
    play(name) {
      if (!this.on || !SOUNDS[name] || document.hidden) return;
      dest = sink(); if (!dest) return;
      try { SOUNDS[name](); } catch (e) { /* no sound */ } finally { dest = null; }
    },
    /** The one mute: the shared one when it exists. Returns whether sound is now on. */
    toggle() {
      if (E.audio) { E.audio.toggle(); return !E.audio.muted(); }
      sfxOn = !sfxOn; try { localStorage.setItem(PREF, sfxOn ? '1' : '0'); } catch (e) { /* not remembered */ } return sfxOn;
    },
  };

  /* =====================================================================================================
     2. THE SKY at each time of day: the same dithered ramp as the banner, re-painted in half-hour steps.
     ===================================================================================================== */
  const SKY = [[0, '#141C3C', '#27345E', '#4B5788'], [5, '#1B2550', '#3A4878', '#7A6E9C'], [6.5, '#6E7FC0', '#E3A6B4', '#FBD9B0'], [8, '#5596DC', '#9CC6EE', '#E3EFF9'], [12, '#5596DC', '#8DBDEC', '#D6E9F9'],
    [16.5, '#5A93D6', '#9DBFE6', '#F1E4CB'], [18.5, '#5B62B0', '#DE8E8E', '#FBC58E'], [19.75, '#2A3368', '#5A5890', '#A07C9C'], [21, '#141C3C', '#27345E', '#4B5788'], [24, '#141C3C', '#27345E', '#4B5788']];
  const mix = (a, b, f) => '#' + [1, 3, 5].map((i) => pad(Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - f) + parseInt(b.slice(i, i + 2), 16) * f).toString(16))).join('');
  function skyStops(hour) {
    const h = (((Math.round(hour * 2) / 2) % 24) + 24) % 24, i = Math.max(0, SKY.findIndex((k) => k[0] > h) - 1), a = SKY[i], b = SKY[i + 1] || a, f = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
    return [1, 2, 3].map((n) => mix(a[n], b[n], f));
  }
  const skyUrl = (hour, px) => (E.ramp ? `url('${E.ramp(skyStops(hour), px)}')` : 'none');
  const isNight = (h) => h < 5.75 || h >= 19.25;
  let skyKey = null, skyDefault = null;
  function paintBanner(c) {
    const key = c ? Math.round(c.hour * 2) : 'day';
    if (key === skyKey || !E.ramp) return;
    if (skyDefault == null) skyDefault = root.getPropertyValue('--g-banner');
    skyKey = key;
    root.setProperty('--g-banner', c ? skyUrl(c.hour, 72) : skyDefault);
    applyTone(c ? c.hour : null);
  }

  /* THE LIGHT everything else stands in. At each hour every colour in the banner is blended toward a tint by an amount:
     warm pink at dawn, nothing by day, gold then rose at sunset, deep blue at night. Same half-hour steps as the sky.
     - Sprites drawn here (buildings, vehicles, people, the courier's load) are redrawn with the blended colours, so they
       stay pixel-exact. A colour written '!#RRGGBB' is a light source (a lit window, a headlight, the ambulance's light)
       and is never toned; at night the hospital's windows and sign come on, and vehicles get headlights.
     - Image files (clouds, hills) and the hand-drawn pigs get the same blend through an SVG colour matrix, which is a
       per-pixel linear blend with no blur, and works when the page is opened from disk.
     Clouds have their own table: they catch the sunset and go grey-blue at night, rather than just darkening. */
  const TONE_LAND = [[0, '#16204A', 0.58], [5, '#1B2550', 0.52], [6.5, '#B86A86', 0.26], [8, '#FFFFFF', 0], [16.5, '#E8B070', 0.08], [18.5, '#B0506A', 0.28], [19.75, '#222C60', 0.48], [21, '#16204A', 0.58], [24, '#16204A', 0.58]];
  const TONE_CLOUD = [[0, '#3A4472', 0.62], [5, '#4A4F80', 0.55], [6.5, '#F4A6B6', 0.38], [8, '#FFFFFF', 0], [16.5, '#F6D9A8', 0.16], [18.5, '#F59A80', 0.46], [19.75, '#6A6496', 0.52], [21, '#3A4472', 0.62], [24, '#3A4472', 0.62]];
  const NO_TONE = ['#FFFFFF', 0];
  function toneAt(table, hour) {
    const h = (((Math.round(hour * 2) / 2) % 24) + 24) % 24, i = Math.max(0, table.findIndex((k) => k[0] > h) - 1), a = table[i], b = table[i + 1] || a, f = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
    return [mix(a[1], b[1], f), a[2] + (b[2] - a[2]) * f];
  }
  const lampsOn = (h) => h < 6.25 || h >= 18.75;   // lights come on a little before the sky goes dark
  const FILTERS = ['land', 'cloud', 'pig', 'cut-land', 'cut-cloud'];
  function filters() {
    if (document.getElementById('wl-tones') || !document.body) return;
    document.body.insertAdjacentHTML('beforeend', `<svg id="wl-tones" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${FILTERS.map((n) => `<filter id="wl-tone-${n}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter>`).join('')}</svg>`);
  }
  /** colour' = colour × (1 − amount) + tint × amount, for every pixel of whatever wears the filter. */
  function setFilter(name, [c, a]) {
    filters();
    const f = document.querySelector(`#wl-tone-${name} feColorMatrix`); if (!f) return;
    const [r, g, b] = [1, 3, 5].map((i) => (parseInt(c.slice(i, i + 2), 16) / 255) * a), k = (1 - a).toFixed(3);
    f.setAttribute('values', `${k} 0 0 0 ${r.toFixed(3)} 0 ${k} 0 0 ${g.toFixed(3)} 0 0 ${k} 0 ${b.toFixed(3)} 0 0 0 1 0`);
  }
  let toneKey = null;
  function applyTone(hour) {
    const key = hour == null ? 'day' : Math.round(hour * 2);
    if (key === toneKey) return;
    toneKey = key;
    const h = hour == null ? 12 : hour, land = hour == null ? NO_TONE : toneAt(TONE_LAND, h), cloud = hour == null ? NO_TONE : toneAt(TONE_CLOUD, h);
    setFilter('land', land); setFilter('cloud', cloud); setFilter('pig', [land[0], land[1] * 0.5]);   // the mascot dims only half as much, so it is always itself
    document.documentElement.classList.toggle('wl-toned', land[1] > 0.005 || cloud[1] > 0.005);
    if (spritesReady) toned(land, hour != null && lampsOn(h));
  }

  /* =====================================================================================================
     3. SPRITES, drawn on a canvas sized by the screen's pixel ratio with every rectangle snapped to whole
     pixels (the asset rule in DESIGN.md). Placeholders until art is supplied.
     ===================================================================================================== */
  const plain = (c) => (c[0] === '!' ? c.slice(1) : c);
  let ink = plain, spritesReady = false;   // ink: how a colour is painted (set by toned() while it redraws)
  function draw(w, h, fn, k) {
    const s = Math.max(1, window.devicePixelRatio || 1) * (k || 1), cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
    const x = cv.getContext('2d'), q = (v) => Math.round(v * s);
    const R = (c, a, b, ww, hh) => { x.fillStyle = ink(c); x.fillRect(q(a), q(b), Math.max(1, q(a + ww) - q(a)), Math.max(1, q(b + hh) - q(b))); };
    const D = (c, a, b, ww, hh) => { x.fillStyle = ink(c); for (let j = q(b); j < q(b + hh); j++) for (let i = q(a) + (j & 1); i < q(a + ww); i += 2) x.fillRect(i, j, 1, 1); };
    fn(R, D);
    return `url("${cv.toDataURL('image/png')}")`;
  }
  const LINE = '#8E2F55', WALL = '#F6B3C8', LIGHT = '#FBD3DF', SHADE = '#E58FAE', ROOF = '#C24F7C', GLASS = '#CFE8FF', INK = '#27324A', LAMP = '!#FFD86A';
  /* the ambulance's light is always a light; after dark both vehicles have a headlight and a tail light */
  const van = (body, stripe, cross, lamps) => (R, D) => {
    R(INK, 1, 2, 22, 11); R(INK, 22, 5, 7, 8); R(body, 2, 3, 20, 9); R(body, 22, 6, 6, 6); D('#C9D3DE', 2, 9, 26, 3);
    R(GLASS, 22, 6, 4, 3); R('#FFFFFF', 22, 6, 1, 1); R(stripe, 2, 8, 26, 1);
    if (cross) { R('#1D8F3A', 9, 4, 2, 6); R('#1D8F3A', 7, 6, 6, 2); R('!#E5372B', 10, 0, 4, 2); R('!#FF9C8E', 10, 0, 2, 1); }
    if (lamps) { R('!#FFF3B0', 28, 8, 1.5, 2); R('!#FF4A3A', 1, 9, 1, 2); }
    [6, 21].forEach((cx) => { R(INK, cx - 1, 11, 5, 4); R(INK, cx, 10, 3, 6); R('#9AA3AD', cx, 12, 3, 2); });
  };
  /* THE AMBULANCE: "Rescue Vehicles" by bart, opengameart.org/content/rescue-vehicles, CC0 (public domain), converted to
     pixel data with tools/png-sprite.js. It faces left, the way it drives in. Letters index AMB_PAL; '.' is clear.
     The corner lamps (a) and roof lights (b) are light sources, so they glow at night instead of being toned. */
  const AMB = ['............a..............a....', '...........abccccccccccccccba...', '...........acddddddddddddddc....', '..........abcddddddddddddddc....', '..........cccddedddddffffffc....',
    '.........cggcdeeedddfffffffc....', '........cgggcddedddfffdddddc....', '........cgggcdddddfffddddddc....', '.....ccchhhhcddddfffdddddddc....', '....cfffffffcffffffddffffffc....', '....cfffffffcfffffddfffffffc....',
    '...cddccddddcddddddfffdccddc....', '...cdciicdddcdddddfffdciicdc....', '..abciiiiccccccccccccciiiicba...', '...a.iiii.............iiii.a....', '......ii...............ii.......'];
  const AMB_PAL = ['!#FBF236', '!#D95763', '#9BADB7', '#FFFFFF', '#6ABE30', '#AC3232', '#696A6A', '#847E87', '#323C39'];
  const pix = (R, rows, pal) => rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') R(pal[row.charCodeAt(x) - 97], x, y, 1, 1); });
  const ambulance = (lamps) => (R) => { pix(R, AMB, AMB_PAL); if (lamps) { R('!#FFF3B0', 3, 10, 1, 2); R('!#FF4A3A', 27, 10, 1, 2); } };
  /* skin, hair, shirt, legs */
  const PEOPLE = [['#F2C9A0', '#3B2A1E', '#3B7BC8', '#2F3A55'], ['#C68E5A', '#1E1A18', '#E5487A', '#3A3A3A'], ['#8D5A3A', '#1E1A18', '#F7C948', '#2F3A55'], ['#F7D9BE', '#B9B9B9', '#5DBB63', '#5A4A3A'], ['#DDA878', '#5A3A1E', '#8E6BD0', '#2F3A55'], ['#E8B98E', '#F2F2F2', '#2F9E9E', '#6B5B4B']];
  const who = (id) => [...String(id || '')].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PEOPLE.length;
  /** Everything on the banner stage that stands in the day's light, drawn at that light. tone: [tint, amount]; lamps: after dark. */
  function toned([tint, amt], lamps) {
    ink = (c) => (c[0] === '!' ? c.slice(1) : amt > 0.005 ? mix(c, tint, amt) : c);
    try {
      // after dark most of the hospital's windows are lit (a fixed few stay dark, so it looks lived in) and the sign glows
      const pane = (a, b) => (lamps && (a * 7 + b * 3) % 5 !== 0 ? LAMP : GLASS);
      root.setProperty('--wl-hosp', draw(36, 32, (R, D) => {
        R(LINE, 0, 12, 36, 20); R(WALL, 1, 15, 34, 17); D(SHADE, 28, 15, 7, 17); R(ROOF, 1, 13, 34, 2);
        R(LINE, 11, 2, 14, 30); R(LIGHT, 12, 5, 12, 27); D(SHADE, 21, 5, 3, 27); R(ROOF, 12, 3, 12, 2);
        R(lamps ? '!#F4FFF2' : '#FFFFFF', 14, 7, 8, 8); R(lamps ? '!#3DDA3B' : '#3DAA2B', 17, 8, 2, 6); R(lamps ? '!#3DDA3B' : '#3DAA2B', 15, 10, 6, 2);
        [3, 7, 27, 31].forEach((a) => [18, 24].forEach((b) => { R(LINE, a - 0.5, b - 0.5, 3, 4); R(pane(a, b), a, b, 2, 3); }));
        [18, 23].forEach((b) => [14, 20].forEach((a) => R(pane(a, b), a, b, 2, 3)));
        R(LINE, 15, 26, 6, 6); R('#7A2C4E', 16, 27, 4, 5); if (lamps) R('!#FFC94A', 16, 27, 4, 1);
      }));
      // the lab's windows and screen light up only while it is working, which at night makes a busy lab easy to spot
      const lab = (lit) => (R, D) => {
        R('#1F5560', 0, 6, 30, 20); R('#8FD0D6', 1, 9, 28, 17); D('#5FA9B4', 22, 9, 7, 17); R('#2F7F8C', 1, 7, 28, 2); R('#1F5560', 20, 1, 4, 6); R(lamps ? '!#9FE8F0' : '#CFE4E8', 21, 0, 2, 2);
        R('#FFFFFF', 3, 11, 9, 9); R('#2F7F8C', 6, 12, 3, 3); R('#2F7F8C', 5, 15, 5, 4); R(lit ? '!#7CE06A' : '#B9E3E8', 6, 16, 3, 2);
        [15, 20, 25].forEach((a) => { R('#1F5560', a - 0.5, 11.5, 3, 5); R(lit ? '!#FFE98A' : GLASS, a, 12, 2, 4); });
        R('#1F5560', 17, 19, 6, 7); R('#17434C', 18, 20, 4, 6);
      };
      root.setProperty('--wl-lab', draw(30, 26, lab(false))); root.setProperty('--wl-lab-on', draw(30, 26, lab(true)));
      root.setProperty('--wl-amb', draw(32, 16, ambulance(lamps))); root.setProperty('--wl-car', draw(30, 16, van('#F7C948', '#B8860B', false, lamps)));
      PEOPLE.forEach(([skin, hair, shirt, legs], i) => ['a', 'b'].forEach((f) => root.setProperty(`--wl-p${i}${f}`, draw(10, 18, (R) => {
        R(INK, 2, 0, 6, 6); R(hair, 3, 0, 4, 2); R(skin, 3, 2, 4, 3); R(INK, 6, 3, 1, 1);
        R(INK, 1, 6, 8, 7); R(shirt, 2, 6, 6, 6); R(skin, f === 'a' ? 1 : 2, 8, 1, 3); R(skin, f === 'a' ? 8 : 7, 8, 1, 3);
        if (f === 'a') { R(legs, 2, 12, 2, 5); R(legs, 6, 12, 2, 5); R(INK, 1, 17, 3, 1); R(INK, 6, 17, 3, 1); } else { R(legs, 3, 12, 2, 5); R(legs, 5, 12, 2, 5); R(INK, 3, 17, 5, 1); }
      }))));
      // the courier's load is toned at half strength: it is small and has to stay readable (and a critical sheet stays red)
      const half = amt / 2;
      ink = (c) => (c[0] === '!' ? c.slice(1) : half > 0.005 ? mix(c, tint, half) : c);
      root.setProperty('--wl-tube', draw(5, 10, (R) => { R(INK, 0, 0, 5, 2); R('#B13A6B', 0, 0, 5, 1); R(INK, 0.5, 2, 4, 8); R('#F4F8FB', 1.5, 2, 2, 7); R('#D2323F', 1.5, 5, 2, 4); }));
      const sheet = (c) => (R) => { R(INK, 0, 0, 8, 10); R('#FFFFFF', 1, 1, 6, 8); [3, 5, 7].forEach((y) => R(c, 2, y, 4, 1)); };
      root.setProperty('--wl-sheet', draw(8, 10, sheet('#3B7BC8'))); root.setProperty('--wl-sheet-crit', draw(8, 10, sheet('!#D2323F')));
    } finally { ink = plain; }
  }
  function sprites() {
    toned(NO_TONE, false);
    // the cutscene's own vehicles, the sun and the moon are never toned: the cutscene tones its whole stage with a filter
    root.setProperty('--wl-amb2', draw(32, 16, ambulance(false), 2)); root.setProperty('--wl-car2', draw(30, 16, van('#F7C948', '#B8860B', false), 2));
    spritesReady = true; skyKey = null; toneKey = null;   // if the light was set before the sprites existed, set it again on the next tick
    /* what the pig carries into a consequence picture: drawn at the pictures' doubled size (js/cuts.js), never toned. Each
       is 11 to 16 art pixels across, so it reads at a glance at 2x (22 to 32 screen pixels) under a 48px pig. */
    const DIG = { 4: ['101', '101', '111', '001', '001'], 6: ['111', '100', '111', '101', '111'] };
    const digit = (R, d, x, y, c) => DIG[d].forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') R(c, x + i, y + j, 1, 1); }));
    const paper = (c, crit) => (R) => {
      R(INK, 0, 0, 11, 14); R('#FFFFFF', 1, 1, 9, 12); [3, 5, 7].forEach((y) => R(c, 2, y, 7, 1)); R(c, 2, 9, 4, 1);
      if (crit) { R('#D2323F', 7, 7, 3, 6); R('#FFFFFF', 8, 8, 1, 2); R('#FFFFFF', 8, 11, 1, 1); }   // a red "!" in the corner
    };
    const CARGO = {
      kit: [14, 12, (R) => { R(INK, 4, 0, 6, 1); R(INK, 4, 0, 1, 3); R(INK, 9, 0, 1, 3); R(INK, 0, 2, 14, 10); R('#E5372B', 1, 3, 12, 8); R('#F57A6E', 1, 3, 12, 1); R('#FFFFFF', 6, 4, 2, 6); R('#FFFFFF', 4, 6, 6, 2); }],
      blood: [11, 15, (R) => { R(INK, 4, 0, 3, 2); R(INK, 0, 2, 11, 12); R('#B0202C', 1, 3, 9, 10); R('#E5484A', 2, 4, 2, 4); R('#FFFFFF', 2, 9, 7, 3); R('#B0202C', 3, 10, 5, 1); R(INK, 5, 14, 1, 1); }],
      sheet: [11, 14, paper('#3B7BC8')],
      sheetCrit: [11, 14, paper('#D2323F', true)],
      o2: [7, 16, (R) => { R(INK, 2, 0, 3, 3); R('#C7CFDD', 3, 1, 1, 1); R(INK, 0, 3, 7, 13); R('#33B04B', 1, 4, 5, 3); R('#E8ECF0', 1, 7, 5, 8); R('#FFFFFF', 1, 7, 1, 8); R('#33B04B', 2, 10, 3, 2); }],
      meter: [11, 15, (R) => { R(INK, 0, 0, 11, 15); R('#5A6070', 1, 1, 9, 13); R('#BFE3C0', 1, 1, 9, 7); digit(R, 4, 2, 2, INK); digit(R, 6, 6, 2, INK); R('#E5372B', 4, 10, 3, 2); R(INK, 4, 14, 3, 1); }],   // the glucose meter reading 46
      chart: [12, 14, (R) => { R(INK, 0, 0, 12, 14); R('#FFFFFF', 1, 1, 10, 12); R('#5A6070', 2, 2, 1, 9); R('#5A6070', 2, 10, 8, 1); [[3, 8], [4, 8], [5, 7], [6, 6], [7, 5], [8, 3], [9, 2]].forEach(([x, y]) => R('#D2323F', x, y, 1, 2)); }],   // creatinine climbing
      stamp: [12, 14, (R) => { R(INK, 4, 0, 4, 6); R('#8A4836', 5, 1, 2, 4); R(INK, 1, 6, 10, 3); R('#5D2C28', 2, 6, 8, 2); R(INK, 0, 9, 12, 5); R('#E5372B', 1, 10, 10, 3); R('#FF8A80', 2, 10, 3, 1); }],
      ambu: [15, 11, (R) => { R(INK, 0, 3, 4, 6); R('#BDE8D4', 1, 4, 2, 4); R(INK, 4, 5, 2, 2); R(INK, 6, 1, 9, 10); R('#3A8CC8', 7, 2, 7, 8); R('#7CC0F0', 8, 3, 3, 3); R(INK, 10, 0, 2, 1); }],   // a bag-valve mask
      phew: [5, 7, (R) => { R('#5FB8F0', 1, 0, 3, 2); R('#5FB8F0', 0, 2, 5, 4); R('#CFEFFF', 1, 2, 1, 2); R('#3A8CC8', 1, 6, 3, 1); }],
      tube: [5, 10, (R) => { R(INK, 0, 0, 5, 2); R('#B13A6B', 0, 0, 5, 1); R(INK, 0.5, 2, 4, 8); R('#F4F8FB', 1.5, 2, 2, 7); R('#D2323F', 1.5, 5, 2, 4); }],
      mask: [10, 7, (R) => { R('#5A6A8A', 0, 2, 10, 1); R(INK, 2, 1, 6, 6); R('#BDE8D4', 3, 2, 4, 4); R('#7CCFAE', 3, 4, 4, 2); R('#FFFFFF', 3, 2, 1, 1); }],
    };
    Object.entries(CARGO).forEach(([k, [w, h, fn]]) => root.setProperty(`--cut-${k}`, draw(w, h, fn, 2)));
    W.cargoSize = (k) => (CARGO[k] ? [CARGO[k][0] * 2, CARGO[k][1] * 2] : [0, 0]);
    root.setProperty('--wl-sun', draw(17, 17, (R, D) => { R('#F7B500', 5, 3, 7, 11); R('#F7B500', 3, 5, 11, 7); R('#FFD84A', 5, 4, 7, 9); R('#FFD84A', 4, 5, 9, 7); R('#FFF3B0', 6, 5, 3, 3); [[8, 0], [8, 15], [0, 8], [15, 8]].forEach(([a, b]) => R('#F7B500', a, b, 1.5, 1.5)); D('#F7B500', 2, 2, 2, 2); D('#F7B500', 13, 2, 2, 2); D('#F7B500', 2, 13, 2, 2); D('#F7B500', 13, 13, 2, 2); }));
    root.setProperty('--wl-moon', draw(13, 13, (R, D) => { R('#E8ECF7', 3, 1, 7, 11); R('#E8ECF7', 1, 3, 11, 7); R('#FFFFFF', 3, 2, 5, 4); D('#B6BEDA', 7, 6, 4, 4); R('#B6BEDA', 4, 8, 2, 2); }));
  }

  /* =====================================================================================================
     4. THE BANNER STAGE
     ===================================================================================================== */
  const W = (E.world = { demo: null });
  let actors = [], pins = [], runKey = null, sig = '';
  /** The clock in force: a shift's, a case's, or the prototype page's. Null when nothing is running. */
  function clock() {
    if (W.demo) return Object.assign({ r0: 0, r1: 24, kind: 'demo', text: hhmm(W.demo.hour) }, W.demo);
    if (!E.db || !E.db.user) return null;
    const s = E.shiftClock && E.shiftClock(), sc = (E.CONFIG && E.CONFIG.shift) || {};
    if (s) return Object.assign({ r0: sc.startHour || 7, r1: sc.endHour || 19, kind: 'shift', bands: [[sc.rounds || 8.5, 'a'], [sc.dayWork || 9.5, 'b'], [sc.signOut || 17.5, 'c']] }, s);
    const c = E.caseClock && E.caseClock();
    return c ? Object.assign({ r0: 0, r1: 24 }, c) : null;
  }
  const F = (c, h) => Math.max(0, Math.min(1, (h - c.r0) / (c.r1 - c.r0)));
  const X = (c, h) => `calc(146px + (100% - 198px) * ${F(c, h).toFixed(4)})`;   // across the stage, clear of the two buildings
  const surname = (p) => String(p.name || '').split(',')[0];
  /** What the two buildings show. lab lists every test in process, so the lab can say what it is working on and link to it. */
  const state = () => {
    if (W.demo) return { census: W.demo.census == null ? 7 : W.demo.census, beacon: !!W.demo.beacon, labs: W.demo.lab ? [{ id: 'demo', name: 'CBC', who: 'Example' }] : [], crisisPid: null };
    if (!E.db || !E.db.user) return { census: 0, beacon: false, labs: [], crisisPid: null };
    const me = E.db.user.name, a = E.progress().active, cs = a && a.type === 'case' && E.CASES && E.CASES.find((x) => x.id === a.id);
    const crisis = (E.db.crises || []).find((x) => x.state === 'open' && x.who === me), labs = [];
    E.db.patients.forEach((p) => p.orders.forEach((o) => { if (o.status === 'In process') labs.push({ id: o.id, name: o.name, pid: p.id, who: surname(p) }); }));
    return { census: E.db.patients.filter((p) => !p.icu && !p.discharged).length, labs, crisisPid: crisis ? crisis.pid : null,
      beacon: !!crisis || !!(cs && !a.done && cs.nodes[a.node] && cs.nodes[a.node].urgent) };
  };
  /* Everything crossing the banner moves at a steady speed, so on a wide screen the pig takes longer to reach the lab
     instead of streaking across it.
     THE ROAD. Arrivals and departures do not use the stage: they travel between the hospital door and beyond the page's
     left edge (the side that is off the page), on a road laid inside the banner's own sky layer (.skyfx), which spans the
     whole banner and sits behind the lockup. So a walker or the ambulance passes behind the Epig lettering, never over it,
     and the road never takes a click (pointer-events none). The pig courier between hospital and lab stays on the stage. */
  const stageW = () => { const el = document.getElementById('wl'); return (el && el.clientWidth) || 900; };
  const lim = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ROAD = { walk: 1, leave: 1, amb: 1, car: 1 };
  let doorX = 0;   // the hospital door, in pixels from the banner's left edge (measured when the road is laid)
  /** Where the door is: the stage's left edge in the banner, plus the hospital's place on the stage (62px) and its door (18px in). */
  function measure() {
    const el = document.getElementById('wl'), bn = el && el.closest && el.closest('.banner');
    if (!bn || !el.getBoundingClientRect) return 0;
    const x = el.getBoundingClientRect().left - bn.getBoundingClientRect().left + 62 + 18;
    if (x > 0) doorX = Math.round(x);
    return doorX;
  }
  const roadW = () => doorX || measure() || 200;
  const travel = (kind) => (kind === 'out' || kind === 'back' ? lim((stageW() - 130) / 210, 3, 9) : kind === 'amb' || kind === 'car' ? lim(roadW() / 120, 3, 8) : lim(roadW() / 42, 4, 13));
  const ARRIVE = { amb: 1, walk: 1 };                   // arrivals: their pins wait for them to reach the door
  const ends = (a) => a.t0 + a.dur * 1000;
  let bump = { hosp: -1e9, lab: -1e9 }, lastCensus = null;
  /** A one-shot animation that survives a redraw: the delay says how far into it we already are. */
  const once = (since, ms) => { const d = performance.now() - since; return d < ms ? `animation-delay:-${(d / 1000).toFixed(2)}s` : null; };
  /** A looping animation that survives a redraw: in step with the page clock rather than restarting. */
  const loop = (sec) => `animation-delay:-${((performance.now() / 1000) % sec).toFixed(2)}s`;
  /* The stage is aria-hidden (it repeats what the chart says), so nothing in it may take focus: its "links" are spans
     with data-go, followed by one click handler (below) for the mouse. */
  const go = (href) => (href ? ` data-go="${esc(href)}"` : '');
  /** Where the sun (or moon) and the time chip under it stand. Updated in place every tick, without a rebuild. */
  function sunAt(c) {
    const night = isNight(c.hour), day = Math.max(0, Math.min(1, (c.hour - 5.75) / 13.5)), alt = night ? 0.75 : Math.sin(Math.PI * day);
    return { night, left: X(c, c.hour), top: CFG().ruler ? Math.round(15 + (1 - alt) * 22) : Math.round(5 + (1 - alt) * 16) };
  }
  function inner() {
    const c = clock(), st = state(), t = performance.now(), still = reduce();
    actors = actors.filter((a) => t < ends(a));
    let h = '';
    if (c && (c.hour < 6.25 || c.hour >= 19)) h += '<i class="wl-night"></i>';   // light lettering on a dark sky
    if (c && CFG().ruler) {
      h += '<i class="wl-rule"></i>';
      (c.bands || []).forEach(([from, cls], i, all) => { const to = all[i + 1] ? all[i + 1][0] : c.r1; h += `<i class="wl-band ${cls}" style="left:${X(c, from)};width:calc((100% - 198px) * ${(F(c, to) - F(c, from)).toFixed(4)})"></i>`; });
      const span = c.r1 - c.r0, major = span > 14 ? 6 : 3;
      for (let hr = Math.ceil(c.r0); hr <= c.r1; hr += span > 14 ? 2 : 1) h += `<i class="wl-tk${hr % major === 0 ? ' big' : ''}" style="left:${X(c, hr)}"></i>${hr % major === 0 ? `<b class="wl-hr" style="left:${X(c, hr)}">${pad(hr % 24)}</b>` : ''}`;
      shown(t).forEach((p) => { h += `<span class="wl-pin k-${p.kind}" style="left:${X(c, p.hour)}"${go(p.href)} title="${esc(hhmm(p.hour) + ' · ' + p.title)}"></span>`; });
      h += `<b class="wl-now${c.paused ? ' paused' : ''}" style="left:${X(c, c.hour)}">${esc(c.text)}</b>`;
    }
    // a flag that has just been planted springs up out of the grass
    if (c && !CFG().ruler) shown(t).forEach((p) => { const s = once(p.show, 500); h += `<span class="wl-flag k-${p.kind}${s ? ' new' : ''}" style="left:${X(c, p.hour)}${s ? ';' + s : ''}"${go(p.href)} title="${esc(hhmm(p.hour) + ' · ' + p.title)}"></span>`; });
    if (c) {
      const o = sunAt(c);
      h += `<i class="wl-orb ${o.night ? 'moon' : 'sun'}" style="left:${o.left};top:${o.top}px"></i>`;
      if (!CFG().ruler) h += `<b class="wl-now free${c.paused ? ' paused' : ''}" style="left:${o.left};top:${o.top + 20}px">${esc(c.text)}</b>`;   // no ruler: the time rides under the sun
    }
    // THE HOSPITAL. The census counts a new patient when the ambulance or the walker reaches the door, not when they set off.
    const coming = still ? 0 : actors.filter((a) => a.adds).length, census = Math.max(0, st.census - coming);
    if (lastCensus != null && census !== lastCensus) bump.hosp = Math.max(bump.hosp, t);
    lastCensus = census;
    const hb = once(bump.hosp, 450), pop = once(bump.hosp, 600);
    const hHref = st.crisisPid ? `#/pt/${st.crisisPid}/orders` : '#/home';
    const hTitle = st.beacon ? 'A patient needs you now. Open the chart.' : `${census} patient${census === 1 ? '' : 's'} on your list. Open Patient Lists.`;
    h += `<span class="wl-hosp${st.beacon ? ' alarm' : ''}${hb ? ' got' : ''}"${go(hHref)} title="${esc(hTitle)}"${hb ? ` style="${hb}"` : ''}>${st.beacon ? `<i class="wl-beacon" style="${loop(0.6)}"></i>` : ''}<b class="${pop ? 'pop' : ''}"${pop ? ` style="${pop}"` : ''}>${census}</b></span>`;
    // THE LAB lights only once a tube has landed in it: a test whose pig is still flying is not in the lab yet.
    const flying = new Set(actors.filter((a) => a.kind === 'out' && !still).map((a) => a.oid)), inLab = st.labs.filter((o) => !flying.has(o.id));
    const lb = once(bump.lab, 450), lit = inLab.length > 0;
    const lTitle = lit ? `In the lab: ${inLab.slice(0, 4).map((o) => `${o.name} (${o.who})`).join(', ')}${inLab.length > 4 ? ` and ${inLab.length - 4} more` : ''}` : flying.size ? 'A tube is on its way to the lab' : 'Laboratory: nothing in process';
    const lStyle = lb || (lit ? loop(0.62) : '');
    h += `<span class="wl-lab${lit ? ' on' : ''}${lb ? ' got' : ''}"${go(lit && inLab[0].pid ? `#/pt/${inLab[0].pid}/results` : '')} title="${esc(lTitle)}"${lStyle ? ` style="${lStyle}"` : ''}>${lit && inLab.length > 1 ? `<b>${inLab.length}</b>` : ''}</span>`;
    if (!still) actors.forEach((a) => {
      if (ROAD[a.kind]) return;   // on the road, not the stage
      const at = `animation-duration:${a.dur.toFixed(2)}s;animation-delay:-${((t - a.t0) / 1000).toFixed(2)}s`;
      h += `<span class="wl-act wl-pig ${a.kind}"${go(a.pid ? `#/pt/${a.pid}/results` : '')}${a.label ? ` title="${esc(a.label)}"` : ''} style="${at}">${E.icon('pig1', 24)}${E.icon('pig2', 24)}<i class="wl-load ${a.kind === 'out' ? 'tube' : a.crit ? 'sheet crit' : 'sheet'}"></i></span>`;
    });
    return h;
  }
  /** What is on the road: patients on foot, the ambulance, a car going home. Nothing here is clickable. */
  function roadHtml(onFoot) {
    if (reduce()) return '';
    const t = performance.now();
    return actors.filter((a) => ROAD[a.kind] && t < ends(a) && (!onFoot || a.kind === 'walk' || a.kind === 'leave')).map((a) => {
      const at = `animation-duration:${a.dur.toFixed(2)}s;animation-delay:-${((t - a.t0) / 1000).toFixed(2)}s`;
      if (a.kind === 'walk' || a.kind === 'leave') return `<i class="wl-act wl-person ${a.kind}" style="${at}"><i style="background-image:var(--wl-p${a.v}a)"></i><i style="background-image:var(--wl-p${a.v}b)"></i></i>`;
      return `<i class="wl-act wl-van ${a.kind}" style="${at}">${a.kind === 'amb' ? `<i class="wl-siren" style="${loop(0.4)}"></i>` : ''}</i>`;
    }).join('');
  }
  /** Lay the road in the banner's sky layer (made again by every redraw of the shell) and fill it. */
  function placeRoad() {
    const el = document.getElementById('wl'), bn = el && el.closest && el.closest('.banner');
    const sky = bn && bn.querySelector && bn.querySelector('.skyfx.bn'); if (!sky) return;
    let road = sky.querySelector('.wl-road');
    if (!road) { road = document.createElement('i'); road.className = 'wl-road'; sky.appendChild(road); }
    const visible = el.getClientRects ? el.getClientRects().length > 0 : true;   // the stage hides itself on a narrow banner; so does the road
    measure();
    road.style.width = `${doorX}px`;
    road.innerHTML = visible && doorX ? roadHtml() : '';
    // Whoever is on foot is drawn a second time on the stage, over the hospital, so they walk up to the door in front of
    // the building. The stage starts to the right of the lettering and clips, so they still pass behind the lockup.
    let front = el.querySelector('.wl-road.front');
    if (!front) { front = document.createElement('i'); front.className = 'wl-road front'; el.appendChild(front); }
    const off = el.getBoundingClientRect && bn.getBoundingClientRect ? el.getBoundingClientRect().left - bn.getBoundingClientRect().left : 0;
    front.style.left = `${-Math.round(off)}px`; front.style.width = `${doorX}px`;
    front.innerHTML = visible && doorX ? roadHtml(true) : '';
  }
  /** Pins wait for whatever is carrying their news: a result's flag goes up when the pig lands, an admission's when the ambulance does. */
  const shown = (t) => pins.filter((p) => p.show <= t);
  /** Called by the shell for every redraw: the stage that sits in the banner's spacer. The road is laid just after the shell
      has put this in the page (a microtask: before the browser paints). */
  W.banner = () => {
    if (!CFG().banner) return '';
    Promise.resolve().then(placeRoad);
    return `<span class="wl" id="wl" aria-hidden="true">${inner()}</span>`;
  };
  /** The sun, the moon and the time move every tick; that is done in place. The stage is rebuilt only when what is on it changes. */
  function tickClock(el, c) {
    if (!c) return;
    const o = sunAt(c), orb = el.querySelector('.wl-orb'), now = el.querySelector('.wl-now');
    if (orb) { orb.style.left = o.left; orb.style.top = `${o.top}px`; }
    if (now) { if (now.textContent !== c.text) now.textContent = c.text; now.style.left = X(c, c.hour); if (now.classList.contains('free')) now.style.top = `${o.top + 20}px`; }
  }
  function refresh(force) {
    const c = clock(), st = state();
    paintBanner(CFG().banner ? c : null);
    const el = document.getElementById('wl'); if (!el) return;
    const t = performance.now();
    const s = [c ? [c.kind, c.r0, c.r1, c.paused, isNight(c.hour), c.hour < 6.25 || c.hour >= 19, CFG().ruler].join() : '-', actors.filter((a) => t < ends(a)).map((a) => a.id).join(), shown(t).length, st.census, st.beacon, st.labs.map((o) => o.id).join()].join('|');
    if (s === sig && !force) return tickClock(el, c);
    sig = s; el.innerHTML = inner(); placeRoad();
  }
  W.refresh = () => refresh(true);
  /* What happens when something reaches where it was going: the building it lands at gives a small squash. */
  function land(a) {
    if (a.kind === 'out') bump.lab = performance.now();
    if (a.kind === 'back') bump.hosp = performance.now();
    refresh(true);
    setTimeout(() => refresh(true), 650);   // once the squash and the census pop are over, back to the building's resting (or busy) state
  }
  /** Something happened in the world. kind: out | back (the pig courier, on the stage), amb (an emergency arrival), walk | leave (a patient on
      foot), car (a patient driven home), or pin (a mark on the ruler). amb, walk, leave and car use the road: in from beyond the page's
      left edge to the hospital door, or out the same way.
      o: { oid, pid, label } say which order or patient it is, so the sprite can link to the chart; crit marks a critical result;
      adds: false for an arrival of a patient already on the list (an admission order), so the census does not count them twice;
      pin/title/href plant a pin, which waits until this arrival lands. */
  W.emit = (kind, o) => {
    o = o || {};
    const t = performance.now();
    let at = t;
    if (['out', 'back', 'amb', 'car', 'walk', 'leave'].includes(kind)) {
      const a = { id: Math.random().toString(36).slice(2, 8), kind, dur: travel(kind), crit: !!o.crit, v: o.v == null ? Math.floor(Math.random() * PEOPLE.length) : o.v, t0: t, oid: o.oid, pid: o.pid, label: o.label, adds: !!ARRIVE[kind] && o.adds !== false };   // adds: a new patient, counted when they reach the door
      actors.push(a); if (actors.length > 10) actors.shift();
      if (ARRIVE[kind] || kind === 'back') at = ends(a);   // news that is being carried is pinned on arrival
      if (!reduce()) setTimeout(() => land(a), a.dur * 1000 + 30);
      else at = t;
    }
    // a result pin waits for the last pig still carrying a result home
    if (kind === 'pin' && o.result && !reduce()) at = Math.max(at, ...actors.filter((a) => a.kind === 'back').map(ends));
    const c = clock();
    if (c && (kind === 'pin' || o.pin)) { pins.push({ hour: c.hour, show: at, kind: o.pin || o.tone || 'page', title: o.title || '', href: o.href || '' }); if (pins.length > 40) pins.shift(); }
    if (at > t) setTimeout(() => refresh(true), at - t + 30);
    refresh(true);
  };

  /* ---------- watching the data for differences, once a second ---------- */
  const seen = { orders: null, patients: null, inbox: null, safety: null, icu: null, home: null };
  const queue = [];
  function watch() {
    if (W.demo) { drain(); return refresh(); }
    if (!E.db || !E.db.user || !E.app) { paintBanner(null); return; }
    const c = clock(), a = E.progress().active, key = a && (a.type === 'shift' || a.type === 'case') ? a.type + a.id + a.start : null;
    if (key !== runKey) { runKey = key; pins = []; }
    // orders: a tube goes out when a test is signed, a result comes back when it posts
    const orders = {}, meta = {}; E.db.patients.forEach((p) => p.orders.forEach((o) => { if (o.type === 'lab' || o.type === 'img') { orders[o.id] = o.status; meta[o.id] = { oid: o.id, pid: p.id, name: o.name, who: surname(p) }; } }));
    if (seen.orders) Object.keys(orders).forEach((id) => {
      const was = seen.orders[id], now = orders[id], m = meta[id];
      if (now === 'In process' && was !== 'In process') W.emit('out', { oid: id, pid: m.pid, label: `${m.name} for ${m.who}, on its way to the lab` });
      if (now === 'Completed' && was === 'In process') {
        const crit = E.db.inbox.slice(0, 4).some((x) => x.type === 'Result' && x.critical && x.patientId === m.pid && Date.now() - x.ts < 4000);
        W.emit('back', { oid: id, pid: m.pid, crit, label: `${m.name} for ${m.who}: ${crit ? 'a critical result' : 'the result'} is coming back` });
      }
    });
    seen.orders = orders;
    // an admission order: when one is signed (or a student's is cosigned) for a patient already on the list, the patient comes
    // up to the ward. They are on the list already, so the census does not change; only the arrival plays.
    const admits = {}; E.db.patients.forEach((p) => p.orders.forEach((o) => { if (o.catId === 'admit') admits[o.id] = { status: o.status, p }; }));
    if (seen.admits && seen.patients && E.db.createdAt === seen.created) {
      const was = (p) => p.orders.some((o) => o.catId === 'admit' && seen.admits[o.id] && seen.admits[o.id].status === 'Active');
      const done = new Set();
      Object.keys(admits).forEach((id) => {
        const { status, p } = admits[id], before = seen.admits[id];
        if (status !== 'Active' || (before && before.status === 'Active') || !seen.patients.includes(p.id) || p.discharged || p.icu || was(p) || done.has(p.id)) return;
        done.add(p.id);
        W.emit(p.arrive === 'walk' ? 'walk' : 'amb', { v: who(p.id), pid: p.id, adds: false, label: `${p.name}, coming up to the ward`, pin: 'admit', title: `${p.name} admitted to the ward`, href: `#/pt/${p.id}/summary` });
      });
    }
    seen.admits = admits;
    // patients: arrivals, departures, intensive care
    const ids = E.db.patients.map((p) => p.id), icu = E.db.patients.filter((p) => p.icu).map((p) => p.id), home = E.db.patients.filter((p) => p.discharged).map((p) => p.id);
    if (seen.patients && E.db.createdAt === seen.created) {
      E.db.patients.forEach((p) => {
        if (!seen.patients.includes(p.id)) W.emit(p.arrive === 'walk' ? 'walk' : 'amb', { v: who(p.id), pid: p.id, label: `${p.name}, arriving`, pin: 'admit', title: `${p.name} admitted`, href: `#/pt/${p.id}/summary` });
        if (home.includes(p.id) && !seen.home.includes(p.id)) W.emit('leave', { v: who(p.id), label: `${p.name}, going home`, pin: 'admit', title: `${p.name} went home` });
        if (icu.includes(p.id) && !seen.icu.includes(p.id) && !(a && a.type === 'case')) consequence('icu', { p });   // a case plays its own ending
      });
    }
    Object.assign(seen, { patients: ids, icu, home, created: E.db.createdAt });
    // the inbox: every page and result that arrives while a clock is running leaves a pin
    const top = E.db.inbox.map((m) => m.id), fresh = seen.inbox && E.db.createdAt === seen.inboxAt ? E.db.inbox.filter((m) => !seen.inbox.includes(m.id)) : [];
    if (c) fresh.filter((m) => ['Page', 'Result', 'Staff Message', 'Safety'].includes(m.type)).forEach((m) => W.emit('pin', { pin: m.critical ? 'crit' : m.type === 'Result' ? 'result' : 'page', result: m.type === 'Result', title: m.subject, href: m.patientId ? `#/pt/${m.patientId}/${m.act || 'summary'}` : '#/inbox' }));
    // and it sounds: a pager tone for a page, a sharper one for anything critical. Only for unread messages meant for this
    // role (a mini-game's acknowledged pages arrive read), and not over a cutscene, which has its own sound.
    const mine = fresh.filter((m) => !m.read && (!m.roles || m.roles.includes(E.db.user.role)));
    if (mine.length && !(E.ui && E.ui.modal && E.ui.modal.type === 'scene')) {
      if (mine.some((m) => m.critical)) E.sfx.play('critical'); else if (mine.some((m) => m.type === 'Page')) E.sfx.play('pager');
    }
    seen.inbox = top; seen.inboxAt = E.db.createdAt;   // messages already waiting on a reset ward are not news
    // the safety record: harm, and rescue
    const ev = ((E.progress().safety || {}).events || []).map((e) => e.id + ':' + (e.outcome || ''));
    if (seen.safety) ((E.progress().safety || {}).events || []).forEach((e) => {
      const p = E.pt(e.pid); if (!p) return;
      if (e.kind !== 'harm') { if (!seen.safety.some((k) => k.startsWith(e.id + ':')) && !seen.near) { seen.near = true; consequence('nearmiss', { p, order: e.order, ev: e.id }); } return; }   // the window for a near miss opens once a session; after that the balloon is enough
      if (!seen.safety.some((k) => k.startsWith(e.id + ':'))) consequence(e.rule, { p, order: e.order, ev: e.id });
      else if (e.outcome === 'rescued' && seen.safety.includes(e.id + ':open')) consequence('rescued', { p, order: e.order });
    });
    seen.safety = ev;
    // a shift: the sun comes up when it starts, and goes down at sign-out
    const sh = E.shiftClock && E.shiftClock(), ph = sh ? key + sh.phase : null;
    if (seen.primed && ph !== seen.phase && sh && CFG().cutscenes) {
      if (sh.phase === 'pre') queue.push({ kind: 'dawn', hour: 6.75, title: '07:00 · A new day on 5 West', lines: ['07:00. The night team hands over a full ward and goes home to sleep.', 'Overnight events and the morning labs are waiting in your Inbox.', 'Rounds are at 08:30. Read up on your patients first.'] });
      if (sh.phase === 'signout') queue.push({ kind: 'dusk', hour: 18.25, title: '17:30 · Sign-out', lines: ['17:30. The light is going and the night team is on its way up.', 'Write a Handoff note on your sickest patient: what happened, and what to do if it happens again.'] });
    }
    seen.phase = ph; seen.primed = true;
    drain();
    refresh();
  }
  /** Show the next waiting window once nothing else is open and someone is looking at the tab. */
  function drain() {
    if (queue.length && !document.hidden && E.app && !E.app.busy() && !(E.suspended && E.suspended())) W.scene(queue.shift());
  }
  if (document.addEventListener) document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(drain, 400); });

  /* =====================================================================================================
     5. CONSEQUENCES: what the learner sees when an action has a result.
     media: null shows the placeholder card. Set it to a file to show that instead:
       media: 'assets/consequence/allergy.png'    a picture (png, jpg, gif, webp)
       media: 'assets/consequence/allergy.webm'   a video or animation (webm, mp4), played once, muted unless sound is on
     art: the brief for whoever makes the picture; it is printed on the placeholder.
     lines: what the caption says. ({ name, mrms, he, order }) are filled in.
     ===================================================================================================== */
  E.CONSEQUENCES = {
    allergy: { title: 'Severe allergic reaction', tone: 'red', sound: 'gasp', media: null, art: 'Hives climbing a forearm and neck; lips swelling; the monitor behind reads 82/46.', lines: ['{mrms} is reacting to {order}.', 'The allergy was on the chart before the order was signed.', 'Stop the drug. {he} needs oxygen or IV fluids now.'] },
    bleed: { title: 'Bleeding again', tone: 'red', sound: 'gasp', media: null, art: 'A pale patient gripping the bed rail; a nurse hanging a bag of blood; the pressure falling on the monitor.', lines: ['{mrms} is bleeding again after {order}.', 'There was an active bleed on the problem list.', 'Stop the drug. {he} needs IV fluids or blood.'] },
    hyperk: { title: 'Dangerous potassium', tone: 'red', sound: 'alarm', media: null, art: 'An ECG strip scrolling: the T waves grow tall and peaked, the trace widens.', lines: ['The lab is calling a critical potassium for {mrms}.', '{order} raised a potassium that was already high.', 'Stop it, and get an ECG or a repeat panel.'] },
    opioid: { title: 'Too much opioid', tone: 'red', sound: 'low', media: null, art: 'A sleeping patient, pinpoint pupils, the breathing trace on the monitor slowing to a crawl.', lines: ['{mrms} is hard to wake and breathing 8 times a minute.', '{order} went in on top of another opioid.', 'Stop the extra opioid and give oxygen.'] },
    insulin: { title: 'Low blood glucose', tone: 'red', sound: 'gasp', media: null, art: 'A sweating, shaking patient; a glucose meter in the foreground reading 46.', lines: ['{mrms} is sweaty, shaky and confused: glucose 46.', '{order} was given on a glucose that was already low.', 'Stop the insulin and order glucose checks.'] },
    nephro: { title: 'Kidney injury made worse', tone: 'red', sound: 'low', media: null, art: 'An almost empty urine bag at the bedside; a creatinine curve climbing on a chart.', lines: ['{mrms} has passed almost no urine since {order}.', 'The creatinine was already 2.0 or more.', 'Recheck kidney function, or ask nephrology to see {him}.'] },
    nearmiss: { title: 'Near miss', tone: 'amber', sound: 'phew', media: null, art: 'An order sheet with a red “declined” stamp and the attending’s hand still on it; behind, the patient asleep and unaware.', lines: ['{order} was stopped before it reached {mrms}.', 'It goes on your safety record as a near miss, not as harm.', 'The reason is in your Inbox. Find out what you missed.'] },
    rescued: { title: 'Stabilised', tone: 'green', sound: 'phew', media: null, art: 'The same room, calmer: the monitor numbers back in range, the nurse giving a thumbs-up, Truffle wiping its brow.', lines: ['{mrms} is settling.', 'You stopped the cause and treated what it did. That was in time.'] },
    icu: { title: 'Transferred to intensive care', tone: 'red', sound: 'low', kind: 'rapid', media: null, art: '', lines: ['Nobody answered the page about {mrms}.', 'The nurse called a rapid response. {he} has gone to intensive care.'] },
  };
  function consequence(id, o) {
    const def = E.CONSEQUENCES[id]; if (!def || !CFG().consequences || !CFG().cutscenes) return;
    const p = o.p, sub = { name: p.name, mrms: (p.sex === 'M' ? 'Mr. ' : 'Ms. ') + p.name.split(', ')[0], he: p.sex === 'M' ? 'He' : 'She', him: p.sex === 'M' ? 'him' : 'her', order: o.order || 'the order' };
    queue.push({ kind: def.kind || 'result', cid: id, evId: o.ev || null, title: `${def.title} — ${p.name}`, lines: fill(def.lines, sub), go: id === 'icu' ? '' : `#/pt/${p.id}/orders`, hour: (clock() || {}).hour });
  }
  /** The caption lines with the placeholders filled in. A line that starts with one ({order}: "the order", or an order
      name typed in lower case) still starts with a capital. */
  const fill = (lines, sub) => lines.map((l) => { const s = l.replace(/\{(\w+)\}/g, (m, k) => sub[k] || m); return s.charAt(0).toUpperCase() + s.slice(1); });
  W.consequence = consequence; W.who = who; W.fill = fill;

  /* =====================================================================================================
     6. THE CUTSCENE WINDOW
     ===================================================================================================== */
  const KIND_SOUND = { arrive: 'siren', page: 'ring', night: 'tick', rapid: 'alarm', home: 'chime', dawn: 'chime', dusk: 'tick' };
  W.scenesOn = () => !!CFG().cutscenes;
  /** Open the window. { kind, title, lines, hour, cid } Returns true if it opened. */
  W.scene = (sc) => {
    if (!CFG().cutscenes) return false;
    if (document.hidden) { queue.push(sc); return true; }   // nobody is looking: it opens (and sounds) when the tab is shown again
    const def = sc.cid && E.CONSEQUENCES[sc.cid];
    E.ui.modal = Object.assign({ type: 'scene', i: 0, t0: performance.now(), s0: performance.now(), hour: 12 }, sc);   // s0: the picture's clock; t0 restarts for each caption line
    if (E.ui.modal.hour == null) E.ui.modal.hour = 12;
    E.sfx.play((def && def.sound) || KIND_SOUND[sc.kind] || 'blip');
    if (E.app) E.app.render();
    return true;
  };
  const SPEED = 26;   // milliseconds a letter
  /* An animated consequence picture built by tools/build-scenes.js (js/cuts.js): the intro once, then the loop, shown at exactly
     twice its art size (the recorded exception to the asset rule for the bought Mucho Pixels packs). Its clock is the
     window's own opening time, so a redraw carries on instead of starting over. The pig is ours and is drawn live: it flies
     in from the right with what it is carrying and hovers there; its load hangs centred under it, and the near miss's
     stamp comes down on the order in step with the picture's loop.
     Under reduced motion (or m.still) nothing moves: the picture rests on the first frame of its loop, where the staff are
     already at the bed and the whole story is in view, and the pig is in its place. */
  const cutHtml = (m, id) => {
    const c = E.CUTS, s = c.scenes[id], fh = c.h * 2, ms = 1000 / c.fps, el = Math.round(performance.now() - (m.s0 || performance.now())), still = !!m.still || reduce();
    const anim = still ? 'none' : [s.intro ? `cut-intro ${s.intro * ms}ms steps(${s.intro}) ${-el}ms both` : '', `cut-loop ${s.loop * ms}ms steps(${s.loop}) ${s.intro * ms - el}ms infinite`].filter(Boolean).join(', ');
    const st = `width:${c.w * 2}px;height:${fh}px;background-image:url('assets/cut/${esc(id)}.png');background-size:${c.w * 2}px auto;background-position:0 ${-s.intro * fh}px;--i1:${-s.intro * fh}px;--l1:${-(s.intro + s.loop) * fh}px;animation:${anim}`;
    const p = s.pig, [cw, ch] = p ? W.cargoSize(p.carry) : [0, 0], k = p ? esc(p.carry) : '';
    const place = p && p.carry !== 'phew' ? `left:${24 - cw / 2}px;top:34px;` : '';
    const stamp = p && p.carry === 'stamp' && !still ? `;animation:cut-stamp ${s.loop * ms}ms ${s.intro * ms - el}ms infinite` : '';
    const pig = p ? `<span class="cut-pig${p.carry === 'phew' ? ' phew' : ''}" style="left:${p.at[0] * 2}px;top:${p.at[1] * 2}px;${still ? 'animation:none' : `animation-delay:${300 - el}ms, ${2100 - el}ms`}">${E.icon('pig1', 48)}${E.icon('pig2', 48)}<i class="cut-cargo ${k}" style="${place}width:${cw}px;height:${ch}px;background-image:var(--cut-${k})${stamp}"></i></span>` : '';
    return `<div class="cut-anim" style="${st}">${pig}</div>`;
  };
  W.cutHtml = cutHtml;   // the prototype page plays the same markup
  const mediaHtml = (m, def) => {
    if (m.cid && E.CUTS && E.CUTS.scenes[m.cid]) return cutHtml(m, m.cid);
    const src = def && def.media;
    if (src && /\.(webm|mp4)$/i.test(src)) return `<video class="cut-media" src="${esc(src)}" autoplay playsinline ${E.sfx.on ? '' : 'muted'}></video>`;
    if (src) return `<img class="cut-media" src="${esc(src)}" alt="">`;
    return `<div class="cut-ph ${esc((def && def.tone) || '')}"><span class="cut-ph-g">${E.icon(def && def.tone === 'green' ? 'check' : def && def.tone === 'amber' ? 'warn' : 'alert', 96)}</span><b>${esc(def ? def.title : '')}</b><small>Placeholder picture${m.cid ? ` · ${esc(m.cid)}` : ''}</small>${def && def.art ? `<em>${esc(def.art)}</em>` : ''}</div>`;
  };
  const diorama = (m) => {
    // the stage stands in the scene's own light; "night passes" animates through the whole day, so it is left untoned
    const lit = m.kind !== 'night';
    setFilter('cut-land', lit ? toneAt(TONE_LAND, m.hour) : NO_TONE); setFilter('cut-cloud', lit ? toneAt(TONE_CLOUD, m.hour) : NO_TONE);
    const night = isNight(m.hour), cl = (shape, top, left) => `<i class="cl ${shape}" style="top:${top};animation:none;transform:translateX(${left})"></i>`;
    const extra = { arrive: '<i class="cut-van amb"></i>', home: '<i class="cut-van car"></i>', page: '<i class="cut-win"></i><span class="cut-pager">' + E.icon('inbox', 48) + '</span>', rapid: '<i class="cut-beacon"></i><i class="cut-flash"></i>', dawn: '<i class="cut-orb sun rise"></i>', dusk: '<i class="cut-orb sun set"></i>', night: `<i class="cut-dark" style="background-image:${skyUrl(1, 180)}"></i><i class="cut-orb sun"></i><i class="cut-orb moon"></i><i class="cut-stars"></i>` }[m.kind] || '';
    return `<div class="skyfx cut-sky" style="background-image:${skyUrl(m.kind === 'night' ? 17.5 : m.hour, 180)}">${night && m.kind !== 'night' ? '<i class="cut-stars on"></i>' : cl('a', '18px', '300px') + cl('e', '44px', '470px') + cl('b', '30px', '70px')}<i class="cut-land"></i><i class="cut-hosp"></i>${extra}<i class="cut-land near"></i></div>`;
  };
  V.modalExt = Object.assign(V.modalExt || {}, {
    scene(m) {
      const def = m.cid && E.CONSEQUENCES[m.cid], last = m.i >= m.lines.length - 1, result = m.kind === 'result';
      // the typed caption is hidden from screen readers: the whole line is announced once, from #wl-say (see the typing timer)
      return `<div class="modal-bg"><div class="modal cut${result ? ' result ' + esc((def && def.tone) || '') : ''}" role="dialog" aria-modal="true" aria-label="${esc(m.title || '')}"><header class="modal-h">${E.icon('brand', 16)}<h3>${esc(m.title || '')}</h3>${soundButton()}</header>
        <div class="modal-b cut-b"><div class="cut-stage ${esc(m.kind)}${reduce() ? ' still' : ''}">${result ? mediaHtml(m, def) : diorama(m)}</div>
        <div class="cut-box"><p id="cut-text" aria-hidden="true" data-full="${esc(m.lines[m.i] || '')}">${reduce() ? esc(m.lines[m.i] || '') : ''}</p><span class="cut-n">${m.i + 1} / ${m.lines.length}</span></div></div>
        <footer class="modal-f">${sceneFoot(m)}</footer></div></div>`;
    },
  });
  function sceneFoot(m) {
    const last = m.i >= m.lines.length - 1, result = m.kind === 'result';
    return `<span id="modalErr" class="err"></span>${last ? '' : '<button class="btn" data-act="sceneSkip">Skip</button>'}${last && m.evId && E.V.reportButton ? E.V.reportButton(m.evId, '') : ''}${last && m.go ? `<a class="btn" href="${esc(m.go)}" data-act="sceneSkip">Go to the patient</a>` : ''}<button class="btn primary" data-act="sceneNext">${last ? (result ? 'Close' : 'Continue') : 'Next'}</button>`;
  }
  /* The next caption line is put into the open window in place. Drawing the whole window again would start its picture
     over: the ambulance would drive in once for every line. */
  function sceneLine(m) {
    const q = (sel) => document.querySelector && document.querySelector('.modal.cut ' + sel), t = q('#cut-text'), n = q('.cut-n'), f = q('.modal-f');
    if (!t || !n || !f) return false;
    t.setAttribute('data-full', m.lines[m.i] || ''); t.textContent = reduce() ? m.lines[m.i] || '' : '';
    n.textContent = `${m.i + 1} / ${m.lines.length}`; m.drawn = m.i;
    if (m.i >= m.lines.length - 1) { f.innerHTML = sceneFoot(m); const b = f.querySelector('[data-act="sceneNext"]'); if (b && b.focus) b.focus(); }
    return true;
  }
  /** The sound button in the window's title bar: the one shared mute (js/audio.js), shown as on or off. */
  function soundButton() {
    const on = E.sfx.on;
    return `<button class="cap" data-act="sfxToggle" title="${on ? 'Sound on' : 'Sound off'}" aria-label="Sound" aria-pressed="${on}">${E.icon(on ? 'music' : 'mute', 16)}</button>`;
  }
  /** Update just that button, in place (so it keeps the focus), when the mute changes from here or from anywhere else. */
  function syncSound() {
    const b = document.querySelector && document.querySelector('.modal.cut [data-act="sfxToggle"]'); if (!b) return;
    const on = E.sfx.on; b.title = on ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed', String(on)); b.innerHTML = E.icon(on ? 'music' : 'mute', 16);
  }
  /* What a screen reader hears: each caption line once, whole, from a visually hidden live region that stays in the page
     (a region created with its text already in it is not announced). */
  function say(text) {
    let el = document.getElementById('wl-say');
    if (!el && document.body && text) { document.body.insertAdjacentHTML('beforeend', '<div id="wl-say" aria-live="polite" style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0"></div>'); el = document.getElementById('wl-say'); }
    if (el && el.textContent !== text) el.textContent = text;
  }
  let said = '';
  /* The caption is typed by a timer that reads the modal's own start time, so a redraw does not restart it. */
  setInterval(() => {
    const m = E.ui && E.ui.modal;
    if (!m || m.type !== 'scene') { if (said) { said = ''; say(''); } return; }
    const full = m.lines[m.i] || '', key = `${m.s0}:${m.i}`;
    if (key !== said) { said = key; say(full); }
    const el = document.getElementById('cut-text'); if (!el) return;
    const n = reduce() ? full.length : Math.min(full.length, Math.floor((performance.now() - m.t0) / SPEED));
    if (el.textContent.length !== n) { el.textContent = full.slice(0, n); if (n < full.length && n % 3 === 0 && full[n - 1] !== ' ') E.sfx.play('blip'); }
    m.full = n >= full.length;
  }, 30);
  const close = () => { E.ui.modal = null; if (E.app) E.app.render(); };
  E.worldActions = {
    sceneNext() { const m = E.ui.modal; if (!m || m.type !== 'scene') return; if (!m.full) { m.t0 = -1e9; return; } if (m.i >= m.lines.length - 1) return close(); m.i++; m.t0 = performance.now(); m.full = false; if (!sceneLine(m)) E.app.render(); },
    sceneSkip() { close(); },
    sfxToggle() { E.sfx.toggle(); if (!E.audio) syncSound(); },   // with the shared audio, its onChange redraws the button
  };
  /* The stage's buildings, pins and couriers are spans (the stage is aria-hidden, so they must not take focus); a click on
     one follows its data-go like a link would. */
  if (document.addEventListener) document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest && e.target.closest('.wl [data-go]'); if (!t) return;
    e.preventDefault(); location.hash = t.getAttribute('data-go');
  });

  (E.glyphsReady || Promise.resolve()).then(() => { sprites(); if (E.audio) E.audio.onChange(syncSound); setInterval(watch, 1000); });
})();
