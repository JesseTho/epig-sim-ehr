/* SIM+EHR Student Edition — the world outside the chart.

   Three things, all ambient: nothing here is needed to do the work, and each can be switched off in
   EHR.CONFIG.world (js/config.js).

   1. THE BANNER AS A PICTURE OF THE DAY. While a shift or a case is running, the empty middle of the banner
      shows the time: the sky changes through the day, the sun crosses, an hour ruler carries a pin for
      everything that has already happened. A small hospital shows the census and a red beacon while a patient
      is in a crisis; a small lab lights up while a test is in process; a pig flies each tube out and each
      result back; an ambulance brings a new patient and a car takes one home.
      It is driven by watching the data once a second for differences, so no other file has to tell it anything.

   2. THE CUTSCENE WINDOW. A dialog with a small stage, a caption typed out a letter at a time, and sound
      synthesised in the browser: EHR.world.scene({ kind, title, lines }). Kinds: arrive, page, night, rapid, home.

   3. CONSEQUENCES. When an action in the sim has a result worth showing (a patient harmed by an order, a
      rescue, a transfer to intensive care) the same window opens with a picture of that result. Each one is an
      entry in EHR.CONSEQUENCES with a `media` slot: empty shows a placeholder card with the art brief; a path
      to an image or a video shows that instead. See docs/cases-and-world-plan.md.

   The sprites are drawn in code at the screen's pixel ratio. They are placeholders until art is supplied. */
(function () {
  const E = window.EHR, V = E.V || (E.V = {}), esc = E.esc;
  const CFG = () => Object.assign({ banner: true, ruler: false, cutscenes: true, sound: true, consequences: true }, (E.CONFIG && E.CONFIG.world) || {});
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (h) => { const m = ((Math.round(h * 60) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const root = document.documentElement.style;

  /* =====================================================================================================
     1. SOUND: short effects, synthesised. One preference, remembered on this computer.
     ===================================================================================================== */
  const PREF = 'epig-sfx';
  let ac = null, sfxOn = (() => { try { return localStorage.getItem(PREF) !== '0'; } catch (e) { return true; } })();
  const ctx = () => { if (ac) return ac; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { ac = new AC(); } catch (e) { ac = null; } return ac; };
  /** One note: frequency (or [from, to] for a slide), start offset and length in seconds. */
  function tone(f, at, len, type, vol) {
    const c = ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at, [f0, f1] = [].concat(f);
    o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.008); g.gain.setValueAtTime(vol || 0.06, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + len + 0.02);
  }
  const SOUNDS = {
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
    get on() { return sfxOn && CFG().sound; },
    play(name) { if (!this.on || !SOUNDS[name]) return; const c = ctx(); if (!c) return; if (c.state === 'suspended') c.resume().catch(() => {}); try { SOUNDS[name](); } catch (e) { /* no sound */ } },
    toggle() { sfxOn = !sfxOn; try { localStorage.setItem(PREF, sfxOn ? '1' : '0'); } catch (e) { /* not remembered */ } return sfxOn; },
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
  }

  /* =====================================================================================================
     3. SPRITES, drawn on a canvas sized by the screen's pixel ratio with every rectangle snapped to whole
     pixels (the asset rule in DESIGN.md). Placeholders until art is supplied.
     ===================================================================================================== */
  function draw(w, h, fn, k) {
    const s = Math.max(1, window.devicePixelRatio || 1) * (k || 1), cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
    const x = cv.getContext('2d'), q = (v) => Math.round(v * s);
    const R = (c, a, b, ww, hh) => { x.fillStyle = c; x.fillRect(q(a), q(b), Math.max(1, q(a + ww) - q(a)), Math.max(1, q(b + hh) - q(b))); };
    const D = (c, a, b, ww, hh) => { x.fillStyle = c; for (let j = q(b); j < q(b + hh); j++) for (let i = q(a) + (j & 1); i < q(a + ww); i += 2) x.fillRect(i, j, 1, 1); };
    fn(R, D);
    return `url("${cv.toDataURL('image/png')}")`;
  }
  const LINE = '#8E2F55', WALL = '#F6B3C8', LIGHT = '#FBD3DF', SHADE = '#E58FAE', ROOF = '#C24F7C', GLASS = '#CFE8FF', INK = '#27324A';
  const van = (body, stripe, cross) => (R, D) => {
    R(INK, 1, 2, 22, 11); R(INK, 22, 5, 7, 8); R(body, 2, 3, 20, 9); R(body, 22, 6, 6, 6); D('#C9D3DE', 2, 9, 26, 3);
    R(GLASS, 22, 6, 4, 3); R('#FFFFFF', 22, 6, 1, 1); R(stripe, 2, 8, 26, 1);
    if (cross) { R('#1D8F3A', 9, 4, 2, 6); R('#1D8F3A', 7, 6, 6, 2); R('#E5372B', 10, 0, 4, 2); R('#FF9C8E', 10, 0, 2, 1); }
    [6, 21].forEach((cx) => { R(INK, cx - 1, 11, 5, 4); R(INK, cx, 10, 3, 6); R('#9AA3AD', cx, 12, 3, 2); });
  };
  /* skin, hair, shirt, legs */
  const PEOPLE = [['#F2C9A0', '#3B2A1E', '#3B7BC8', '#2F3A55'], ['#C68E5A', '#1E1A18', '#E5487A', '#3A3A3A'], ['#8D5A3A', '#1E1A18', '#F7C948', '#2F3A55'], ['#F7D9BE', '#B9B9B9', '#5DBB63', '#5A4A3A'], ['#DDA878', '#5A3A1E', '#8E6BD0', '#2F3A55'], ['#E8B98E', '#F2F2F2', '#2F9E9E', '#6B5B4B']];
  const who = (id) => [...String(id || '')].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PEOPLE.length;
  function sprites() {
    root.setProperty('--wl-hosp', draw(36, 32, (R, D) => {
      R(LINE, 0, 12, 36, 20); R(WALL, 1, 15, 34, 17); D(SHADE, 28, 15, 7, 17); R(ROOF, 1, 13, 34, 2);
      R(LINE, 11, 2, 14, 30); R(LIGHT, 12, 5, 12, 27); D(SHADE, 21, 5, 3, 27); R(ROOF, 12, 3, 12, 2);
      R('#FFFFFF', 14, 7, 8, 8); R('#3DAA2B', 17, 8, 2, 6); R('#3DAA2B', 15, 10, 6, 2);
      [3, 7, 27, 31].forEach((a) => [18, 24].forEach((b) => { R(LINE, a - 0.5, b - 0.5, 3, 4); R(GLASS, a, b, 2, 3); }));
      [18, 23].forEach((b) => [14, 20].forEach((a) => R(GLASS, a, b, 2, 3)));
      R(LINE, 15, 26, 6, 6); R('#7A2C4E', 16, 27, 4, 5);
    }));
    const lab = (lit) => (R, D) => {
      R('#1F5560', 0, 6, 30, 20); R('#8FD0D6', 1, 9, 28, 17); D('#5FA9B4', 22, 9, 7, 17); R('#2F7F8C', 1, 7, 28, 2); R('#1F5560', 20, 1, 4, 6); R('#CFE4E8', 21, 0, 2, 2);
      R('#FFFFFF', 3, 11, 9, 9); R('#2F7F8C', 6, 12, 3, 3); R('#2F7F8C', 5, 15, 5, 4); R(lit ? '#7CE06A' : '#B9E3E8', 6, 16, 3, 2);
      [15, 20, 25].forEach((a) => { R('#1F5560', a - 0.5, 11.5, 3, 5); R(lit ? '#FFE98A' : GLASS, a, 12, 2, 4); });
      R('#1F5560', 17, 19, 6, 7); R('#17434C', 18, 20, 4, 6);
    };
    root.setProperty('--wl-lab', draw(30, 26, lab(false))); root.setProperty('--wl-lab-on', draw(30, 26, lab(true)));
    root.setProperty('--wl-amb', draw(30, 16, van('#FFFFFF', '#E5372B', true))); root.setProperty('--wl-car', draw(30, 16, van('#F7C948', '#B8860B', false)));
    root.setProperty('--wl-amb2', draw(30, 16, van('#FFFFFF', '#E5372B', true), 2)); root.setProperty('--wl-car2', draw(30, 16, van('#F7C948', '#B8860B', false), 2));
    PEOPLE.forEach(([skin, hair, shirt, legs], i) => ['a', 'b'].forEach((f) => root.setProperty(`--wl-p${i}${f}`, draw(10, 18, (R) => {
      R(INK, 2, 0, 6, 6); R(hair, 3, 0, 4, 2); R(skin, 3, 2, 4, 3); R(INK, 6, 3, 1, 1);
      R(INK, 1, 6, 8, 7); R(shirt, 2, 6, 6, 6); R(skin, f === 'a' ? 1 : 2, 8, 1, 3); R(skin, f === 'a' ? 8 : 7, 8, 1, 3);
      if (f === 'a') { R(legs, 2, 12, 2, 5); R(legs, 6, 12, 2, 5); R(INK, 1, 17, 3, 1); R(INK, 6, 17, 3, 1); } else { R(legs, 3, 12, 2, 5); R(legs, 5, 12, 2, 5); R(INK, 3, 17, 5, 1); }
    }))));
    root.setProperty('--wl-tube', draw(5, 10, (R) => { R(INK, 0, 0, 5, 2); R('#B13A6B', 0, 0, 5, 1); R(INK, 0.5, 2, 4, 8); R('#F4F8FB', 1.5, 2, 2, 7); R('#D2323F', 1.5, 5, 2, 4); }));
    const sheet = (c) => (R) => { R(INK, 0, 0, 8, 10); R('#FFFFFF', 1, 1, 6, 8); [3, 5, 7].forEach((y) => R(c, 2, y, 4, 1)); };
    root.setProperty('--wl-sheet', draw(8, 10, sheet('#3B7BC8'))); root.setProperty('--wl-sheet-crit', draw(8, 10, sheet('#D2323F')));
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
  /* Everything crossing the stage moves at a steady speed, so on a wide screen the pig takes longer to reach the lab
     instead of streaking across it. Walkers have a fixed path (the left edge to the door). */
  const stageW = () => { const el = document.getElementById('wl'); return (el && el.clientWidth) || 900; };
  const lim = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const travel = (kind) => (kind === 'out' || kind === 'back' ? lim((stageW() - 130) / 210, 3, 9) : kind === 'amb' || kind === 'car' ? lim((stageW() - 100) / 260, 3.5, 9) : 5);
  const ARRIVE = { amb: 1, walk: 1 };                   // arrivals: their pins wait for them to reach the door
  const ends = (a) => a.t0 + a.dur * 1000;
  let bump = { hosp: -1e9, lab: -1e9 }, lastCensus = null;
  /** A one-shot animation that survives a redraw: the delay says how far into it we already are. */
  const once = (since, ms) => { const d = performance.now() - since; return d < ms ? `animation-delay:-${(d / 1000).toFixed(2)}s` : null; };
  /** A looping animation that survives a redraw: in step with the page clock rather than restarting. */
  const loop = (sec) => `animation-delay:-${((performance.now() / 1000) % sec).toFixed(2)}s`;
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
      shown(t).forEach((p) => { h += `<a class="wl-pin k-${p.kind}" style="left:${X(c, p.hour)}" ${p.href ? `href="${esc(p.href)}"` : ''} tabindex="-1" title="${esc(hhmm(p.hour) + ' · ' + p.title)}"></a>`; });
      h += `<b class="wl-now${c.paused ? ' paused' : ''}" style="left:${X(c, c.hour)}">${esc(c.text)}</b>`;
    }
    // a flag that has just been planted springs up out of the grass
    if (c && !CFG().ruler) shown(t).forEach((p) => { const s = once(p.show, 500); h += `<a class="wl-flag k-${p.kind}${s ? ' new' : ''}" style="left:${X(c, p.hour)}${s ? ';' + s : ''}" ${p.href ? `href="${esc(p.href)}"` : ''} tabindex="-1" title="${esc(hhmm(p.hour) + ' · ' + p.title)}"></a>`; });
    if (c) {
      const night = isNight(c.hour), day = Math.max(0, Math.min(1, (c.hour - 5.75) / 13.5)), alt = night ? 0.75 : Math.sin(Math.PI * day);
      const top = CFG().ruler ? Math.round(15 + (1 - alt) * 22) : Math.round(5 + (1 - alt) * 16);
      h += `<i class="wl-orb ${night ? 'moon' : 'sun'}" style="left:${X(c, c.hour)};top:${top}px"></i>`;
      if (!CFG().ruler) h += `<b class="wl-now free${c.paused ? ' paused' : ''}" style="left:${X(c, c.hour)};top:${top + 20}px">${esc(c.text)}</b>`;   // no ruler: the time rides under the sun
    }
    // THE HOSPITAL. The census counts a new patient when the ambulance or the walker reaches the door, not when they set off.
    const coming = still ? 0 : actors.filter((a) => a.adds).length, census = Math.max(0, st.census - coming);
    if (lastCensus != null && census !== lastCensus) bump.hosp = Math.max(bump.hosp, t);
    lastCensus = census;
    const hb = once(bump.hosp, 450), pop = once(bump.hosp, 600);
    const hHref = st.crisisPid ? `#/pt/${esc(st.crisisPid)}/orders` : '#/home';
    const hTitle = st.beacon ? 'A patient needs you now. Open the chart.' : `${census} patient${census === 1 ? '' : 's'} on your list. Open Patient Lists.`;
    h += `<a class="wl-hosp${st.beacon ? ' alarm' : ''}${hb ? ' got' : ''}" href="${hHref}" tabindex="-1" title="${esc(hTitle)}"${hb ? ` style="${hb}"` : ''}>${st.beacon ? `<i class="wl-beacon" style="${loop(0.6)}"></i>` : ''}<b class="${pop ? 'pop' : ''}"${pop ? ` style="${pop}"` : ''}>${census}</b></a>`;
    // THE LAB lights only once a tube has landed in it: a test whose pig is still flying is not in the lab yet.
    const flying = new Set(actors.filter((a) => a.kind === 'out' && !still).map((a) => a.oid)), inLab = st.labs.filter((o) => !flying.has(o.id));
    const lb = once(bump.lab, 450), lit = inLab.length > 0;
    const lTitle = lit ? `In the lab: ${inLab.slice(0, 4).map((o) => `${o.name} (${o.who})`).join(', ')}${inLab.length > 4 ? ` and ${inLab.length - 4} more` : ''}` : flying.size ? 'A tube is on its way to the lab' : 'Laboratory: nothing in process';
    const lStyle = lb || (lit ? loop(0.62) : '');
    h += `<a class="wl-lab${lit ? ' on' : ''}${lb ? ' got' : ''}"${lit && inLab[0].pid ? ` href="#/pt/${esc(inLab[0].pid)}/results"` : ''} tabindex="-1" title="${esc(lTitle)}"${lStyle ? ` style="${lStyle}"` : ''}>${lit && inLab.length > 1 ? `<b>${inLab.length}</b>` : ''}</a>`;
    if (!still) actors.forEach((a) => {
      const at = `animation-duration:${a.dur.toFixed(2)}s;animation-delay:-${((t - a.t0) / 1000).toFixed(2)}s`;
      const link = a.pid ? ` href="#/pt/${esc(a.pid)}/${a.kind === 'out' || a.kind === 'back' ? 'results' : 'summary'}" tabindex="-1"` : '', tip = a.label ? ` title="${esc(a.label)}"` : '';
      if (a.kind === 'out' || a.kind === 'back') h += `<a class="wl-act wl-pig ${a.kind}"${link}${tip} style="${at}">${E.icon('pig1', 24)}${E.icon('pig2', 24)}<i class="wl-load ${a.kind === 'out' ? 'tube' : a.crit ? 'sheet crit' : 'sheet'}"></i></a>`;
      else if (a.kind === 'walk' || a.kind === 'leave') h += `<a class="wl-act wl-person ${a.kind}"${link}${tip} style="${at}"><i style="background-image:var(--wl-p${a.v}a)"></i><i style="background-image:var(--wl-p${a.v}b)"></i></a>`;
      else h += `<a class="wl-act wl-van ${a.kind}"${link}${tip} style="${at}">${a.kind === 'amb' ? `<i class="wl-siren" style="${loop(0.4)}"></i>` : ''}</a>`;
    });
    return h;
  }
  /** Pins wait for whatever is carrying their news: a result's flag goes up when the pig lands, an admission's when the ambulance does. */
  const shown = (t) => pins.filter((p) => p.show <= t);
  /** Called by the shell for every redraw: the stage that sits in the banner's spacer. */
  W.banner = () => (CFG().banner ? `<span class="wl" id="wl" aria-hidden="true">${inner()}</span>` : '');
  function refresh(force) {
    const c = clock(), st = state();
    paintBanner(CFG().banner ? c : null);
    const el = document.getElementById('wl'); if (!el) return;
    const t = performance.now();
    const s = [c && c.text, c && c.paused, actors.filter((a) => t < ends(a)).map((a) => a.id).join(), shown(t).length, st.census, st.beacon, st.labs.map((o) => o.id).join()].join('|');
    if (s === sig && !force) return;
    sig = s; el.innerHTML = inner();
  }
  W.refresh = () => refresh(true);
  /* What happens when something reaches where it was going: the building it lands at gives a small squash. */
  function land(a) {
    if (a.kind === 'out') bump.lab = performance.now();
    if (a.kind === 'back') bump.hosp = performance.now();
    refresh(true);
    setTimeout(() => refresh(true), 650);   // once the squash and the census pop are over, back to the building's resting (or busy) state
  }
  /** Something happened in the world. kind: out | back (the pig courier), amb (an emergency arrival), walk | leave (a patient on foot, in from
      the left and out the same way), car, or pin (a mark on the ruler).
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
    if (W.demo) return refresh();
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
    const top = E.db.inbox.map((m) => m.id);
    if (seen.inbox && c && E.db.createdAt === seen.inboxAt) E.db.inbox.filter((m) => !seen.inbox.includes(m.id) && ['Page', 'Result', 'Staff Message', 'Safety'].includes(m.type)).forEach((m) => W.emit('pin', { pin: m.critical ? 'crit' : m.type === 'Result' ? 'result' : 'page', result: m.type === 'Result', title: m.subject, href: m.patientId ? `#/pt/${m.patientId}/${m.act || 'summary'}` : '#/inbox' }));
    seen.inbox = top; seen.inboxAt = E.db.createdAt;   // messages already waiting on a reset ward are not news
    // the safety record: harm, and rescue
    const ev = ((E.progress().safety || {}).events || []).map((e) => e.id + ':' + (e.outcome || ''));
    if (seen.safety) ((E.progress().safety || {}).events || []).forEach((e) => {
      const p = E.pt(e.pid); if (!p) return;
      if (e.kind !== 'harm') { if (!seen.safety.some((k) => k.startsWith(e.id + ':')) && !seen.near) { seen.near = true; consequence('nearmiss', { p, order: e.order }); } return; }   // the window for a near miss opens once a session; after that the balloon is enough
      if (!seen.safety.some((k) => k.startsWith(e.id + ':'))) consequence(e.rule, { p, order: e.order });
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
    // show the next waiting window once nothing else is open
    if (queue.length && !E.app.busy() && !(E.suspended && E.suspended())) W.scene(queue.shift());
    refresh();
  }

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
    queue.push({ kind: def.kind || 'result', cid: id, title: `${def.title} — ${p.name}`, lines: def.lines.map((l) => l.replace(/\{(\w+)\}/g, (m, k) => sub[k] || m)), go: id === 'icu' ? '' : `#/pt/${p.id}/orders`, hour: (clock() || {}).hour });
  }
  W.consequence = consequence; W.who = who;

  /* =====================================================================================================
     6. THE CUTSCENE WINDOW
     ===================================================================================================== */
  const KIND_SOUND = { arrive: 'siren', page: 'ring', night: 'tick', rapid: 'alarm', home: 'chime', dawn: 'chime', dusk: 'tick' };
  W.scenesOn = () => !!CFG().cutscenes;
  /** Open the window. { kind, title, lines, hour, cid } Returns true if it opened. */
  W.scene = (sc) => {
    if (!CFG().cutscenes) return false;
    const def = sc.cid && E.CONSEQUENCES[sc.cid];
    E.ui.modal = Object.assign({ type: 'scene', i: 0, t0: performance.now(), hour: 12 }, sc);
    if (E.ui.modal.hour == null) E.ui.modal.hour = 12;
    E.sfx.play((def && def.sound) || KIND_SOUND[sc.kind] || 'blip');
    if (E.app) E.app.render();
    return true;
  };
  const SPEED = 26;   // milliseconds a letter
  const mediaHtml = (m, def) => {
    const src = def && def.media;
    if (src && /\.(webm|mp4)$/i.test(src)) return `<video class="cut-media" src="${esc(src)}" autoplay playsinline ${E.sfx.on ? '' : 'muted'}></video>`;
    if (src) return `<img class="cut-media" src="${esc(src)}" alt="">`;
    return `<div class="cut-ph ${esc((def && def.tone) || '')}"><span class="cut-ph-g">${E.icon(def && def.tone === 'green' ? 'check' : def && def.tone === 'amber' ? 'warn' : 'alert', 96)}</span><b>${esc(def ? def.title : '')}</b><small>Placeholder picture${m.cid ? ` · ${esc(m.cid)}` : ''}</small>${def && def.art ? `<em>${esc(def.art)}</em>` : ''}</div>`;
  };
  const diorama = (m) => {
    const night = isNight(m.hour), cl = (shape, top, left) => `<i class="cl ${shape}" style="top:${top};animation:none;transform:translateX(${left})"></i>`;
    const extra = { arrive: '<i class="cut-van amb"></i>', home: '<i class="cut-van car"></i>', page: '<i class="cut-win"></i><span class="cut-pager">' + E.icon('inbox', 48) + '</span>', rapid: '<i class="cut-beacon"></i><i class="cut-flash"></i>', dawn: '<i class="cut-orb sun rise"></i>', dusk: '<i class="cut-orb sun set"></i>', night: `<i class="cut-dark" style="background-image:${skyUrl(1, 180)}"></i><i class="cut-orb sun"></i><i class="cut-orb moon"></i><i class="cut-stars"></i>` }[m.kind] || '';
    return `<div class="skyfx cut-sky" style="background-image:${skyUrl(m.kind === 'night' ? 17.5 : m.hour, 180)}">${night && m.kind !== 'night' ? '<i class="cut-stars on"></i>' : cl('a', '18px', '300px') + cl('e', '44px', '470px') + cl('b', '30px', '70px')}<i class="cut-land"></i><i class="cut-hosp"></i>${extra}<i class="cut-land near"></i></div>`;
  };
  V.modalExt = Object.assign(V.modalExt || {}, {
    scene(m) {
      const def = m.cid && E.CONSEQUENCES[m.cid], last = m.i >= m.lines.length - 1, result = m.kind === 'result';
      return `<div class="modal-bg"><div class="modal cut${result ? ' result ' + esc((def && def.tone) || '') : ''}" role="dialog" aria-modal="true" aria-label="${esc(m.title || '')}"><header class="modal-h">${E.icon('brand', 16)}<h3>${esc(m.title || '')}</h3><button class="cap" data-act="sfxToggle" title="${E.sfx.on ? 'Sound on' : 'Sound off'}" aria-label="${E.sfx.on ? 'Turn sound off' : 'Turn sound on'}" aria-pressed="${E.sfx.on}">${E.icon(E.sfx.on ? 'music' : 'mute', 16)}</button></header>
        <div class="modal-b cut-b"><div class="cut-stage ${esc(m.kind)}${reduce() ? ' still' : ''}">${result ? mediaHtml(m, def) : diorama(m)}</div>
        <div class="cut-box"><p id="cut-text" aria-live="polite" data-full="${esc(m.lines[m.i] || '')}">${reduce() ? esc(m.lines[m.i] || '') : ''}</p><span class="cut-n">${m.i + 1} / ${m.lines.length}</span></div></div>
        <footer class="modal-f"><span id="modalErr" class="err"></span>${last ? '' : '<button class="btn" data-act="sceneSkip">Skip</button>'}${last && m.go ? `<a class="btn" href="${esc(m.go)}" data-act="sceneSkip">Go to the patient</a>` : ''}<button class="btn primary" data-act="sceneNext">${last ? (result ? 'Close' : 'Continue') : 'Next'}</button></footer></div></div>`;
    },
  });
  /* The caption is typed by a timer that reads the modal's own start time, so a redraw does not restart it. */
  setInterval(() => {
    const m = E.ui && E.ui.modal; if (!m || m.type !== 'scene') return;
    const el = document.getElementById('cut-text'); if (!el) return;
    const full = m.lines[m.i] || '', n = reduce() ? full.length : Math.min(full.length, Math.floor((performance.now() - m.t0) / SPEED));
    if (el.textContent.length !== n) { el.textContent = full.slice(0, n); if (n < full.length && n % 3 === 0 && full[n - 1] !== ' ') E.sfx.play('blip'); }
    m.full = n >= full.length;
  }, 30);
  const close = () => { E.ui.modal = null; if (E.app) E.app.render(); };
  E.worldActions = {
    sceneNext() { const m = E.ui.modal; if (!m || m.type !== 'scene') return; if (!m.full) { m.t0 = -1e9; return; } if (m.i >= m.lines.length - 1) return close(); m.i++; m.t0 = performance.now(); m.full = false; E.app.render(); },
    sceneSkip() { close(); },
    sfxToggle() { E.sfx.toggle(); if (E.ui.modal && E.ui.modal.type === 'scene') { const t = E.ui.modal.t0; E.app.render(); E.ui.modal.t0 = t; } },
  };

  (E.glyphsReady || Promise.resolve()).then(() => { sprites(); setInterval(watch, 1000); });
})();
