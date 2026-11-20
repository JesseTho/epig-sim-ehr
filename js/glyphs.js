/* SIM+EHR Student Edition — glyph set and dithered artwork.
   Original drawings in the early-2000s desktop style: a dark outline tinted from the fill, a dithered
   ramp for the fill, pixel-dot highlights on the upper left, and a contact shadow. Drawn on a 32px grid
   (the logo on 64) with 1.5px outlines so they hold at 16px. Use EHR.icon(name, size). See DESIGN.md. */
(function () {
  const E = window.EHR;
  /* Limited colour depth, done properly: each ramp is rendered to a tiny bitmap, quantised to BITS per
     channel, with an 8x8 ordered (Bayer) dither deciding between neighbouring levels pixel by pixel.
     From a distance the ramp is smooth; up close it is dots. No flat bands. */
  const BITS = 4;
  const BAYER8 = (() => { let m = [[0]]; for (let n = 0; n < 3; n++) { const z = m.length, o = [...Array(z * 2)].map(() => Array(z * 2)); for (let y = 0; y < z; y++) for (let x = 0; x < z; x++) { const v = m[y][x] * 4; o[y][x] = v; o[y][x + z] = v + 2; o[y + z][x] = v + 3; o[y + z][x + z] = v + 1; } m = o; } return m; })();
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lerp = (cols, t) => { const u = Math.max(0, Math.min(1, t)) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(u)), f = u - i; return [0, 1, 2].map((c) => cols[i][c] * (1 - f) + cols[i + 1][c] * f); };
  /** Paint a w x h bitmap. fn(x, y) returns [r, g, b] (0-255, unquantised) or null for transparent. */
  const paint = (w, h, fn) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), max = (1 << BITS) - 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = fn(x, y, (BAYER8[y % 8][x % 8] + 0.5) / 64), p = (y * w + x) * 4;
      if (!col) continue;
      const th = (BAYER8[y % 8][x % 8] + 0.5) / 64;
      for (let c = 0; c < 3; c++) { const v = (col[c] / 255) * max, lo = Math.floor(v); img.data[p + c] = Math.round(((v - lo > th ? lo + 1 : lo) / max) * 255); }
      img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  };
  const cache = {};
  /** Dithered ramp through colour stops: 8px wide and len tall, or len wide and 8px tall when across is set. */
  const ramp = (stops, len, across) => {
    const key = stops.join() + len + (across ? 'h' : 'v');
    if (!cache[key]) { const cols = stops.map(rgb); cache[key] = across ? paint(len, 8, (x) => lerp(cols, x / (len - 1))) : paint(8, len, (x, y) => lerp(cols, len === 1 ? 0 : y / (len - 1))); }
    return cache[key];
  };
  E.ramp = ramp;   // used by js/world.js for the sky at each time of day
  const prng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
  /** A cumulus cloud: a row of overlapping puffs on a flat base, white on top and shaded blue-grey
      underneath, with a one-pixel dithered edge. The seed picks the arrangement of puffs. */
  const cloud = (w, h, seed) => {
    const rnd = prng(seed), n = Math.max(4, Math.round(w / h) + 2), base = h * 0.8, cap = h * 0.11, puffs = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), mid = 1 - Math.abs(t - 0.5) * 1.5, r = h * (0.17 + 0.2 * mid + 0.1 * rnd());
      puffs.push([w * (0.13 + 0.74 * t) + (rnd() - 0.5) * h * 0.3, base - cap - r * 0.55, r]);
    }
    const x0 = w * 0.09, x1 = w * 0.91, top = Math.min(...puffs.map((p) => p[1] - p[2]));
    const shade = [rgb('#FFFFFF'), rgb('#F2F8FE'), rgb('#C9DDF3')];
    return paint(w, h, (x, y, th) => {
      let d = Math.hypot(Math.max(x0 - x, 0, x - x1), y - (base - cap)) - cap;          // the flat base, a capsule
      for (const [cx, cy, r] of puffs) d = Math.min(d, Math.hypot(x - cx, y - cy) - r);
      if (d > 0 || (d > -1.3 && -d / 1.3 < th)) return null;
      return lerp(shade, Math.pow(Math.max(0, (y - top) / (base - top)), 1.7));
    });
  };
  /** Rolling countryside: ridgelines from back to front, each a sum of sine waves. A ridge has a sunlit
      rim along its crest and darkens down its slope; far ridges are hazier and bluer. `env` (0..1 across
      the width) can lower the land, for example to keep it clear of the wordmark. */
  const land = (w, h, layers, env) => {
    const ridges = layers.map((L) => { const a = new Float32Array(w); for (let x = 0; x < w; x++) { let s = 0; for (const [cyc, ph, wt] of L.waves) s += wt * Math.sin((x / w) * cyc * 2 * Math.PI + ph); a[x] = h - (L.base * h + L.amp * s) * (env ? env(x / w) : 1); } return a; });
    const cols = layers.map((L) => [rgb(L.rim), rgb(L.top), rgb(L.bottom)]);
    return paint(w, h, (x, y) => {
      for (let i = layers.length - 1; i >= 0; i--) { const d = y - ridges[i][x]; if (d >= 0) return lerp(cols[i], d < 2 ? d / 8 : 0.25 + 0.75 * Math.min(1, d / Math.max(10, h * layers[i].base))); }
      return null;
    });
  };
  const RIDGES = [
    { base: 0.78, amp: 0.13, waves: [[3, 0.5, 1], [7, 1.9, 0.5], [13, 4, 0.22]], rim: '#C4DFD0', top: '#A3CBB4', bottom: '#8ABB9B' },   // far, hazy
    { base: 0.54, amp: 0.12, waves: [[4, 2.2, 1], [9, 0.3, 0.5], [17, 1, 0.2]], rim: '#D2EC9C', top: '#A5D468', bottom: '#78AE3E' },      // middle
    { base: 0.3, amp: 0.09, waves: [[5, 4.1, 1], [11, 2.6, 0.45], [23, 0.7, 0.15]], rim: '#A9D465', top: '#79B53E', bottom: '#4C8A28' },  // near
  ];
  /** The ridge table scaled to a strip h pixels tall. `k` stretches the wave count for a wider strip. */
  const ridges = (h, k) => RIDGES.map((L) => Object.assign({}, L, { amp: L.amp * h, waves: L.waves.map(([cyc, ph, wt]) => [cyc * (k || 1), ph, wt]) }));
  const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  /** Dot rectangles for a 4-wide tile whose rows step down through the given densities (out of 16). */
  const dots = (densities, rowsEach, color) => densities.map((d, b) => [...Array(rowsEach * 4)].map((_, i) => { const x = i % 4, y = Math.floor(i / 4); return BAYER[y % 4][x] < d ? `<rect x="${x}" y="${b * rowsEach + y}" width="1" height="1" fill="${color}"/>` : ''; }).join('')).join('');

  /* Glyph fills. To add a fill colour, add a ramp here and use f('name') or url(#g-name) in a drawing. */
  const RAMPS = {
    paper: ['#FFFFFF', '#DDE3EE'], olive: ['#CFDBA8', '#7C9150'], green: ['#A6E86A', '#2E8B1E'], blue: ['#9CCBF8', '#2759B0'], red: ['#FFA184', '#C0241A'],
    gold: ['#FFEE96', '#DE9C14'], steel: ['#F4F6F9', '#98A2AE'], orange: ['#FFCB78', '#E2750B'], purple: ['#CDB8F4', '#6540B0'], skin: ['#FFE3BF', '#E6AC74'],
    manila: ['#FBE39A', '#D2A040'], cream: ['#FFF6E8', '#EFCFA8'], pink: ['#FFD0DB', '#EE8BA6'], wood: ['#D6A866', '#8B5A2A'], pad: ['#FFF9C4', '#F0D860'], glass: ['#F1FAFF', '#B9DCF2'], sky: ['#5E9FE0', '#DDEEFB'], hill: ['#A6CF62', '#4F8F2A'],
  };
  /** Pattern defs for a drawing on `grid` units shown at `size` px. The ramp is rendered with one row per
      screen pixel and the pattern cell sized to match, so a dither dot is always exactly one pixel. */
  const defsFor = (grid, size, sfx) => {
    const u = grid / size;
    return Object.entries(RAMPS).map(([id, stops]) => `<pattern id="g-${id}${sfx}" width="${8 * u}" height="${grid}" patternUnits="userSpaceOnUse"><image href="${ramp(stops, size)}" width="${8 * u}" height="${grid}" preserveAspectRatio="none" style="image-rendering:pixelated"/></pattern>`).join('') +
      `<pattern id="p-d50${sfx}" width="${4 * u}" height="${4 * u}" patternUnits="userSpaceOnUse"><g transform="scale(${u})">${dots([8], 4, '#fff')}</g></pattern>`;
  };

  // outline tints
  const O = { cream: '#963A56', pink: '#963A56', paper: '#55647F', olive: '#485B24', green: '#1D5F12', blue: '#1A3C80', red: '#851810', gold: '#8F6206', steel: '#56606C', wood: '#5F3F18', purple: '#422878' };
  const sh = (rx) => `<ellipse cx="16" cy="29.2" rx="${rx || 10}" ry="1.8" fill="#000" opacity=".2"/>`;
  const f = (g, o, extra) => `fill="url(#g-${g})" stroke="${O[o || g]}" stroke-width="1.5" stroke-linejoin="round"${extra ? ' ' + extra : ''}`;
  const line = (d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w || 1.5}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ball = (g, mark) => `${sh(9)}<circle cx="16" cy="15.5" r="11.5" ${f(g)}/><path d="M7 12.5C8.5 6.5 23.5 6.5 25 12.5 21 10.3 11 10.3 7 12.5z" fill="url(#p-d50)"/>${mark}`;
  const sheet = (x, y, w, h) => `<path d="M${x} ${y}h${w - 5}l5 5v${h - 5}h-${w}z" ${f('paper')}/><path d="M${x + w - 5} ${y}v5h5" fill="#C9D2E2" stroke="${O.paper}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const rules = (x, y, w, n, c) => [...Array(n)].map((_, i) => line(`M${x} ${y + i * 3.5}h${w}`, c || '#8C9BB5', 1.3)).join('');
  const board = `<rect x="5.5" y="5" width="21" height="23.5" rx="2.5" ${f('wood')}/><rect x="8.5" y="8" width="15" height="18" ${f('paper')}/><rect x="11.5" y="2.8" width="9" height="5.4" rx="1.6" ${f('steel')}/>`;

  const G = {
    brand: `${sh(11)}<rect x="3" y="2.5" width="26" height="25.5" rx="6.5" ${f('green')}/><path d="M13 7.5h6v5h5v6h-5v5h-6v-5H8v-6h5z" fill="#fff" stroke="${O.green}" stroke-width="1"/><path d="M5.2 10c0-3.6 2.4-5.4 5.6-5.4h10.4c3.2 0 5.6 1.8 5.6 5.4-6-2.2-15.6-2.2-21.6 0z" fill="url(#p-d50)"/>`,
    patients: `${sh()}${board}<circle cx="12" cy="13" r="1.8" fill="url(#g-blue)" stroke="${O.blue}"/><circle cx="12" cy="18" r="1.8" fill="url(#g-green)" stroke="${O.green}"/><circle cx="12" cy="23" r="1.8" fill="url(#g-orange)" stroke="${O.gold}"/>${line('M15.5 13h6M15.5 18h6M15.5 23h6', '#6E7E9A')}`,
    inbox: `${sh(12)}<rect x="3.5" y="8" width="25" height="17" rx="1.8" ${f('paper')}/>${line('M4.5 9.5l11.5 9 11.5-9', O.paper)}${line('M4.5 24l8-7M27.5 24l-8-7', '#9AA8C0', 1.2)}`,
    learning: `${sh(11)}<path d="M9 15.5v6.2c3.6 3.4 10.4 3.4 14 0v-6.2z" ${f('blue')}/><path d="M16 5.5l13.5 6.5L16 18.5 2.5 12z" ${f('blue')}/><path d="M16 7.4l9.6 4.6H6.4z" fill="url(#p-d50)"/>${line('M27 12.8v7.6', O.gold, 1.6)}<circle cx="27" cy="22" r="2" ${f('gold')}/>`,
    log: `${sh()}${sheet(5, 3, 18, 24)}${rules(8.5, 10, 9, 4)}<circle cx="22" cy="21" r="6.8" fill="#fff" stroke="${O.blue}" stroke-width="2"/>${line('M22 17v4.2l3 1.8', O.blue, 1.6)}`,
    help: ball('blue', `${line('M11.8 12.4c0-5.6 8.6-5.6 8.6-.4 0 3.4-4.2 3.3-4.2 6.8', '#fff', 3)}<circle cx="16.2" cy="23.2" r="1.9" fill="#fff"/>`),
    info: ball('blue', `<circle cx="16" cy="9.6" r="2.1" fill="#fff"/><rect x="14.1" y="13.2" width="3.8" height="10.4" rx="1.3" fill="#fff"/>`),
    check: ball('green', line('M10 16l4.2 4.4L22.5 11', '#fff', 3.2)),
    remove: ball('red', line('M11 10.5l10 10M21 10.5l-10 10', '#fff', 3.2)),
    add: ball('green', line('M16 9v13M9.5 15.5h13', '#fff', 3.2)),
    warn: `${sh(11)}<path d="M16 3.5L29.5 27h-27z" ${f('gold')}/><path d="M16 6.8l3.6 6.4h-7.2z" fill="url(#p-d50)"/><rect x="14.4" y="11.5" width="3.2" height="8.5" rx="1.5" fill="#3A2A00"/><circle cx="16" cy="23.3" r="1.8" fill="#3A2A00"/>`,
    alert: `${sh(11)}<path d="M16 3.5L29.5 27h-27z" ${f('red')}/><path d="M16 6.8l3.6 6.4h-7.2z" fill="url(#p-d50)"/><rect x="14.4" y="11.5" width="3.2" height="8.5" rx="1.5" fill="#fff"/><circle cx="16" cy="23.3" r="1.8" fill="#fff"/>`,
    logout: `${sh()}<path d="M7 4.5h13v23H7z" ${f('wood')}/><path d="M9.5 7l8 2.5v17l-8-2.5z" fill="#F0C98C" stroke="${O.wood}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="15.3" cy="17" r="1.2" fill="${O.wood}"/><path d="M19 13.5h5.5V10l6 6-6 6v-3.5H19z" ${f('green')}/>`,
    call: `${sh(11)}<rect x="3" y="8" width="18.500" height="16" rx="3" ${f('blue')}/><path d="M21.500 13.500l7.500-4.500v14l-7.500-4.500z" ${f('steel')}/><path d="M5 12c0-1.600 1-2.400 2.400-2.400h9.800c1.400 0 2.400.8 2.400 2.400z" fill="url(#p-d50)"/><circle cx="8" cy="19.500" r="2.200" ${f('green')}/>`,
    music: `${sh(10)}<path d="M4.500 12h5l7-6.500v21l-7-6.500h-5z" ${f('steel')}/><path d="M6 13.500h3.500" stroke="#fff" stroke-width="1.500" stroke-linecap="round" opacity=".8"/>${line('M20 11c2 2.800 2 7.200 0 10M23.500 8c4 4.800 4 11.200 0 16', O.blue, 2.200)}`,
    mute: `${sh(10)}<path d="M4.500 12h5l7-6.500v21l-7-6.500h-5z" ${f('steel')}/><path d="M6 13.500h3.500" stroke="#fff" stroke-width="1.500" stroke-linecap="round" opacity=".8"/>${line('M20.500 11.500l7 9M27.500 11.500l-7 9', '#C0241A', 2.600)}`,
    search: `${sh(9)}<path d="M19.5 19.5l8 8" stroke="${O.wood}" stroke-width="5.5" stroke-linecap="round"/><path d="M19.5 19.5l8 8" stroke="#C99555" stroke-width="2.8" stroke-linecap="round"/><circle cx="13" cy="13" r="8.8" fill="url(#g-glass)" stroke="${O.steel}" stroke-width="2.4"/><path d="M7.5 11.5c1-4 6-5.6 9-3.6-3.4.2-6.6 1.4-9 3.6z" fill="url(#p-d50)"/>`,
    summary: `${sh()}${board}<path d="M16 23.5c-5-3.6-6.4-6.4-5-8.6 1.3-2 3.8-1.6 5 .4 1.2-2 3.7-2.4 5-.4 1.4 2.2 0 5-5 8.6z" ${f('red')}/>`,
    review: `${sh(12)}<path d="M3.5 8.5a1.5 1.5 0 0 1 1.5-1.5h7l2.5 3h12a1.5 1.5 0 0 1 1.5 1.5V26H3.5z" ${f('manila', 'gold')}/><path d="M9 6h13v10H9z" ${f('paper')}/>${line('M11.5 9.5h8M11.5 12.5h8', '#8C9BB5', 1.2)}<path d="M2.5 14h22.5l3.5 12H5.5z" ${f('manila', 'gold')}/>`,
    results: `${sh(10)}<path d="M13 4h6v8.5l7 12.8a2 2 0 0 1-1.8 3H7.8a2 2 0 0 1-1.8-3L13 12.5z" fill="url(#g-glass)" stroke="${O.steel}" stroke-width="1.5" stroke-linejoin="round"/><path d="M10.4 18.5h11.2l3.6 6.6a1.2 1.2 0 0 1-1 1.8H7.8a1.2 1.2 0 0 1-1-1.8z" fill="url(#g-green)"/><rect x="11.5" y="2.6" width="9" height="2.8" rx="1.2" ${f('steel')}/><circle cx="13.5" cy="22.5" r="1.3" fill="#fff" opacity=".8"/><circle cx="18" cy="24.5" r=".9" fill="#fff" opacity=".8"/>`,
    flowsheets: `${sh(11)}<rect x="3.5" y="4.5" width="25" height="23" rx="1.8" ${f('paper')}/>${line('M3.5 12h25M3.5 19.5h25M11.5 4.5v23M20 4.5v23', '#B7C3D8', 1)}${line('M6 22l5.5-6 5 3.5 4.5-9 5 4', '#C0241A', 2.2)}<circle cx="21" cy="10.5" r="2.2" ${f('red')}/>`,
    mar: `${sh(10)}<g transform="rotate(-40 16 15.5)"><rect x="3.5" y="9.5" width="25" height="12" rx="6" ${f('paper')}/><path d="M16 9.5h6.5a6 6 0 0 1 0 12H16z" ${f('red')}/><path d="M7.5 12.2h16.5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".75"/></g>`,
    notes: `${sh()}<rect x="5" y="5" width="18" height="23" rx="1.5" ${f('pad', 'gold')}/><rect x="5" y="5" width="18" height="4.5" rx="1.5" ${f('red')}/>${rules(8, 14, 12, 4, '#B89A2A')}<g transform="rotate(38 23 17)"><rect x="20.5" y="5" width="5" height="18" ${f('orange', 'gold')}/><path d="M20.5 23h5L23 28.5z" fill="#F3D6A6" stroke="${O.wood}" stroke-width="1.2" stroke-linejoin="round"/><rect x="20.5" y="3" width="5" height="3" rx="1" ${f('red')}/></g>`,
    orders: `${sh()}${sheet(5, 3, 19, 24)}${rules(8.5, 10, 9, 3)}<circle cx="21.5" cy="21.5" r="7" ${f('green')}/>${line('M18 21.6l2.6 2.7 4.6-5.4', '#fff', 2.4)}`,
    problems: `${sh(12)}<path d="M12 9V6.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 20 6.5V9" fill="none" stroke="${O.steel}" stroke-width="2.4"/><rect x="3.5" y="9" width="25" height="18.5" rx="3" ${f('red')}/><path d="M14 12.5h4v3.5h3.5v4H18v3.5h-4V20h-3.5v-4H14z" fill="#fff"/><path d="M5.5 13c0-1.6 1-2.4 2.4-2.4h16.2c1.4 0 2.4.8 2.4 2.4z" fill="url(#p-d50)" opacity=".7"/>`,
    code: `${sh(10)}<path d="M16 27C6 20 3.5 14.5 6 10c2.3-4 7.5-3.4 10 .8 2.5-4.2 7.7-4.8 10-.8 2.5 4.5 0 10-10 17z" ${f('red')}/>${line('M5.5 16h5l2-4 3 8 2.5-5.5 1.3 1.5h7', '#fff', 1.9)}`,
    iso: `${sh(8)}<path d="M16 3.5c5 7 8.5 11 8.5 15.5a8.5 8.5 0 0 1-17 0C7.5 14.5 11 10.500 16 3.5z" ${f('blue')}/><path d="M12 14c-1.8 3-1.5 6 .5 8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>`,
    vitals: `${sh(7)}<rect x="12.5" y="3" width="7" height="18" rx="3.5" ${f('steel')}/><rect x="14.8" y="9" width="2.4" height="12" fill="#D63A2A"/><circle cx="16" cy="23" r="5.2" ${f('red')}/>${line('M21.5 7h3M21.5 11h3M21.5 15h3', O.steel, 1.3)}`,
    user: `${sh(10)}<path d="M5 28c0-6.5 4.5-10 11-10s11 3.500 11 10z" ${f('blue')}/><circle cx="16" cy="11" r="6.6" ${f('skin', 'wood')}/><path d="M11.5 8.5c1.500-2.600 7.500-2.600 9 0-3-1-6-1-9 0z" fill="url(#p-d50)"/>`,
    idcard: `${sh(12)}<rect x="3" y="6.5" width="26" height="19.500" rx="2.200" ${f('paper')}/><path d="M3.800 7.300h24.400v4.200H3.800z" fill="url(#g-olive)"/><circle cx="10.500" cy="17" r="2.600" ${f('skin', 'wood')}/><path d="M6.500 23.500c0-2.800 1.700-4 4-4s4 1.200 4 4z" fill="url(#g-blue)" stroke="${O.blue}"/>${line('M17.500 16h8M17.500 19.500h8M17.500 23h5', '#7C8BA6', 1.3)}`,
    reset: `${sh(9)}<path d="M25 16a9 9 0 1 1-3.200-6.900" fill="none" stroke="${O.green}" stroke-width="6" stroke-linecap="round"/><path d="M25 16a9 9 0 1 1-3.200-6.900" fill="none" stroke="#6FCB3F" stroke-width="3.200" stroke-linecap="round"/><path d="M18.500 3.500l8.500 1-2.500 8z" ${f('green')}/>`,
    print: `${sh(12)}<path d="M9 3.500h14V13H9z" ${f('paper')}/><rect x="3.500" y="11.500" width="25" height="11.500" rx="2.200" ${f('steel')}/><path d="M8.500 19h15v8.500h-15z" ${f('paper')}/>${line('M11 22.500h10M11 25h7', '#8C9BB5', 1.2)}<circle cx="24.500" cy="15" r="1.400" fill="#5FD23A" stroke="${O.green}" stroke-width=".8"/>`,
    save: `${sh(11)}<path d="M4.500 4.500h20l3 3v20h-23z" ${f('blue')}/><rect x="9" y="4.500" width="12.500" height="8" ${f('steel')}/><rect x="17" y="6" width="2.800" height="5" fill="${O.steel}"/><rect x="8" y="16.500" width="16" height="11" ${f('paper')}/>${line('M10.500 20h11M10.500 23.500h11', '#8C9BB5', 1.2)}`,
    set: `${sh()}<path d="M10 3.500h14v19H10z" ${f('paper')}/><path d="M7.500 6.500h14v19h-14z" ${f('paper')}/><path d="M5 9.500h14v19H5z" ${f('paper')}/>${rules(8, 14, 8, 3)}<circle cx="23" cy="22.500" r="5.500" ${f('green')}/>${line('M23 19.500v6M20 22.500h6', '#fff', 2)}`,
    home: `${sh(11)}<path d="M7 14.500h18V27H7z" ${f('paper')}/><path d="M16 4L2.500 16h27z" ${f('red')}/><path d="M16 6.800l6.500 5.800h-13z" fill="url(#p-d50)" opacity=".8"/><rect x="13.500" y="19" width="5" height="8" ${f('wood')}/>`,
    medal: `${sh(8)}<path d="M9 2.500h5.500L16 12l1.500-9.500H23L19.500 15h-7z" ${f('blue')}/><path d="M12 2.500h2.500L16 12l1.500-9.500H20" fill="none" stroke="#fff" stroke-width="1.200" opacity=".7"/><circle cx="16" cy="20" r="8" ${f('gold')}/><circle cx="16" cy="20" r="5.400" fill="none" stroke="#FFF6C4" stroke-width="1.200"/><path d="M16 15.800l1.300 2.700 3 .4-2.200 2 .6 2.900L16 22.400l-2.700 1.400.6-2.900-2.200-2 3-.4z" fill="#fff" stroke="${O.gold}" stroke-width=".8" stroke-linejoin="round"/>`,
    star: `${sh(9)}<path d="M16 3l3.900 8.200 9 1.200-6.600 6.200 1.700 8.900L16 23.100l-8 4.400 1.700-8.900L3.100 12.400l9-1.200z" ${f('gold')}/><path d="M16 5.800l2.600 5.600H13.400z" fill="url(#p-d50)"/>`,
    trophy: `${sh(8)}<path d="M9 5H5.500c0 5 1.500 7.500 5 8M23 5h3.500c0 5-1.500 7.500-5 8" fill="none" stroke="${O.gold}" stroke-width="2.200"/><path d="M9 3.500h14c0 9-2.500 13.500-7 13.500S9 12.500 9 3.500z" ${f('gold')}/><path d="M11 5h4c0 5-.5 8-1.500 10C12 13 11 9.500 11 5z" fill="url(#p-d50)"/><rect x="14.300" y="17" width="3.400" height="5" fill="url(#g-gold)" stroke="${O.gold}"/><rect x="9.500" y="22" width="13" height="5.500" rx="1.200" ${f('wood')}/>`,
  };

  /* The mascot: a winged pig, heading right, in two frames (wing up, wing down) that the stylesheet
     alternates to make it flap as it flies through the sky. An original drawing. */
  const WING_UP = `<path d="M12.500 14c-2.200-7.500 2.800-11 7.500-9.800-1.500 3-2.300 6.300-2.800 9.800z" ${f('cream')}/>${line('M15 7.500c-.300 2 0 4 .500 6M17.500 6c-.800 2.500-.800 5-.500 7.500', '#C79A70', 1)}`;
  const pig = (wing) => `${line('M5.800 17.500c-2.800-.800-2.800-4.200 0-3.800', O.pink, 1.600)}<rect x="9.500" y="23" width="3" height="5" rx="1.200" ${f('pink')}/><rect x="16.500" y="23.500" width="3" height="5" rx="1.200" ${f('pink')}/>
    <ellipse cx="14.500" cy="18" rx="9.800" ry="7.200" ${f('pink')}/><path d="M7 15c1-3.500 5-5 8.500-4.600-3 .6-6 2-8.500 4.600z" fill="url(#p-d50)"/>
    <path d="M20.500 10.500l1.200-4.300 3.300 3.300z" ${f('pink')}/><circle cx="24" cy="15" r="5.600" ${f('pink')}/><ellipse cx="28.600" cy="16.200" rx="2.300" ry="2.700" fill="#F7A3B8" stroke="${O.pink}" stroke-width="1.200"/>
    <circle cx="28" cy="15.600" r=".550" fill="${O.pink}"/><circle cx="29.400" cy="16.800" r=".550" fill="${O.pink}"/><circle cx="24.400" cy="13.300" r="1" fill="#2B1A20"/>${wing}`;
  G.pig1 = pig(WING_UP);
  G.pig2 = pig(`<path d="M12 15c-5.500 1.500-8 6.500-5.500 10.500 2.500-3 6-5.500 10-7.500z" ${f('cream')}/>${line('M9.500 19c.800 1 2.500 1.500 4 1M8 22c1.300.500 3 .300 4.500-.700', '#C79A70', 1)}`);
  /* The EPIG logo is Truffle: the first cell of the assistant's sprite sheet, cropped close, in the sheet's own
     direction (facing right, toward the wordmark), so the logo and the corner assistant are plainly the same pig.
     Files: assets/logo/epig-*.png. The assistant in the corner is the same sheet mirrored.
     EHR.icon('logo', size) shows the 48px bitmap, doubled with hard pixels above 56px, and the 32px one below 40px. */
  /* The logo is Truffle, rough-cut from the original sprite art with hard edges (owner's choice "B"): at every
     size it uses a cut made for the screen's real pixels (48 to 192px), so it keeps its pixel-art edges but is
     never stretched, blurred or blown up into big blocks. */
  const LOGO_CUTS = [48, 60, 72, 96, 120, 144, 192];
  const cutFor = (cuts, css) => { const want = css * Math.max(1, window.devicePixelRatio || 1); return cuts.find((x) => x >= want - 0.5) || cuts[cuts.length - 1]; };
  const logoImg = (d, label) => `<img class="gl" src="assets/logo/epig-${cutFor(LOGO_CUTS, d)}.png" width="${d}" height="${d}" ${label ? `alt="${E.esc(label)}"` : 'alt="" aria-hidden="true"'} draggable="false">`;
  /* Truffle's sprite sheet, cut the same way: cells made for a 96px pig at the screen's real pixels. */
  // an absolute address: a url() held in a CSS variable resolves against the stylesheet that uses it, not this page
  document.documentElement.style.setProperty('--pal-sheet', `url("${new URL(`assets/assistant/truffle-v3-${cutFor([96, 120, 144, 192], 96)}.png`, document.baseURI).href}")`);
  const GRID = {};   // glyphs drawn on a grid other than 32 (none at present)
  E.GLYPHS = Object.keys(G);

  /* Resolution (owner's decision): Windows XP icon quality. Each glyph is a bitmap at the size it is shown
     (16, 24, 32, 48, 64 or 96px), with soft edges, like XP's full-colour icons: neither enlarged pixels nor
     screen-boosted detail. EHR.icon(name, size) snaps to the nearest of these sizes. */
  const DPR = Math.max(1, window.devicePixelRatio || 1), SIZES = [16, 24, 32, 48, 64, 96];
  const snapSize = (size) => SIZES.reduce((b, s) => (Math.abs(s - size) < Math.abs(b - size) ? s : b), SIZES[0]);
  const NATIVE = SIZES;
  const BMP = {};
  /** A self-contained SVG of one glyph at px pixels, carrying only the fills it uses, dithered for that size. */
  const svgFor = (name, px) => {
    const grid = GRID[name] || 32, u = grid / px, body = G[name], used = new Set();
    body.replace(/url\(#g-([a-z0-9]+)\)/g, (m, id) => used.add(id));
    const defs = [...used].map((id) => `<pattern id="g-${id}" width="${8 * u}" height="${grid}" patternUnits="userSpaceOnUse"><image href="${ramp(RAMPS[id], px)}" width="${8 * u}" height="${grid}" preserveAspectRatio="none" style="image-rendering:pixelated"/></pattern>`).join('') +
      `<pattern id="p-d50" width="${4 * u}" height="${4 * u}" patternUnits="userSpaceOnUse"><g transform="scale(${u})">${dots([8], 4, '#fff')}</g></pattern>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${grid} ${grid}"><defs>${defs}</defs>${body}</svg>`;
  };
  const raster = (name, px) => new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = cv.height = px;
        cv.getContext('2d').drawImage(img, 0, 0, px, px);
        (BMP[name] = BMP[name] || {})[px] = cv.toDataURL('image/png');
      } catch (e) { BMP.failed = true; }
      done();
    };
    img.onerror = () => { BMP.failed = true; done(); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgFor(name, px));
  });
  /** Resolves when every bitmap is ready. js/app.js waits for it before drawing the first screen. */
  E.glyphsReady = Promise.all(E.GLYPHS.flatMap((n) => NATIVE.map((px) => raster(n, px))));

  /** A glyph as markup. Decorative by default; pass a label to expose it to assistive technology.
      If the browser cannot rasterise (BMP.failed), it falls back to drawing the vector directly. */
  E.icon = (name, size, label) => {
    const d = snapSize(size || 16), px = d; if (name === 'logo') return logoImg(d, label);
    const src = !BMP.failed && BMP[name] && BMP[name][px];

    if (src) return `<img class="gl" src="${src}" width="${d}" height="${d}" ${label ? `alt="${E.esc(label)}"` : 'alt="" aria-hidden="true"'} draggable="false">`;
    return `<svg class="gl" width="${d}" height="${d}" viewBox="0 0 ${GRID[name] || 32} ${GRID[name] || 32}" ${label ? `role="img" aria-label="${E.esc(label)}"` : 'aria-hidden="true"'} focusable="false">${svgFor(name, d).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/id="([gpc]-[a-z0-9]+)"/g, `id="$1-${name}-${d}"`).replace(/url\(#([gpc]-[a-z0-9]+)\)/g, `url(#$1-${name}-${d})`)}</svg>`;
  };

  /* The wordmark: "Epig" in heavy, wide, slanted letters, capital E and lower-case pig, a nod to the kind of
     logo it parodies. It is deliberately pig pink, never red, with a curly tail off the g, so it reads as a
     joke and not as the real company's mark. Drawn by hand (no font): three flat bands of pink inside a thick
     plum outline. Like the glyphs it is a bitmap, rasterised at half size and shown doubled with hard pixels on the login and loading screens; in the
     banner, where it is small, it is rasterised at its own size so the letters stay open. */
  const WM = [
    [0, 'M0 0h25v7.5H10.5v4.5H22.5v6H10.5v4.5H25V30H0z'],                                                                                 // E
    [29, 'M0 8h17a9 9 0 0 1 9 9v4a9 9 0 0 1-9 9H9.5v10H0zM9.5 13.5v11h7a3 3 0 0 0 3-3v-5a3 3 0 0 0-3-3z'],               // p
    [59, 'M0 8h9.5v22H0zM0 1.2a3.2 3.2 0 0 1 3.2-3.2h3.1a3.2 3.2 0 0 1 3.2 3.2v.6a3.2 3.2 0 0 1-3.2 3.2H3.2A3.2 3.2 0 0 1 0 1.8z'],  // i and its dot
    [72.5, 'M26 8v26.5a9 9 0 0 1-9 9H3v-7h12.5a1.5 1.5 0 0 0 1.5-1.5V30H9a9 9 0 0 1-9-9v-4a9 9 0 0 1 9-9zM6.5 16.5a3 3 0 0 1 3-3h7v11h-7a3 3 0 0 1-3-3z'], // g
  ];
  const WM_BOX = [-13, -5, 132, 52];   // x, y, width, height of the drawing
  const wordmarkSvg = (h) => {
    const letters = WM.map(([x, d]) => `<path transform="translate(${x} 0)" d="${d}" fill-rule="evenodd" clip-rule="evenodd"/>`).join('');
    const tail = 'M97 33c5.5 1.5 9.5-.5 11.5-3.5 2.5-4-1.5-8.5-5.5-6-2.8 1.800-1.5 5.5 1.5 4.5';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round((h * WM_BOX[2]) / WM_BOX[3])}" height="${h}" viewBox="${WM_BOX.join(' ')}">
      <defs><clipPath id="wmc">${letters}</clipPath></defs>
      <g transform="skewX(-13)"><g transform="translate(3 0)">
        <path d="${tail}" fill="none" stroke="#5E0F38" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>
        <g fill="#5E0F38" stroke="#5E0F38" stroke-width="3" stroke-linejoin="round">${letters}</g>
        <g clip-path="url(#wmc)"><rect x="-20" y="-6" width="160" height="16.5" fill="#FBB2CF"/><rect x="-20" y="10.5" width="160" height="17" fill="#F7609A"/><rect x="-20" y="27.5" width="160" height="20" fill="#E0488A"/></g>
        <path d="${tail}" fill="none" stroke="#E0488A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      </g></g></svg>`;
  };
  const WMB = {};
  /* The wordmark matches the rough-cut pig logo beside it: one art pixel per real screen pixel (the pig's
     density), a hard-cut edge, and its three pinks blended with the fine ordered dither used across the app. */
  const wmRaster = (h) => new Promise((done) => {
    const dpr = Math.max(1, window.devicePixelRatio || 1), n = Math.round(h * dpr), w = Math.round((n * WM_BOX[2]) / WM_BOX[3]), u = WM_BOX[3] / n;   // u: viewBox units per pixel
    const fill = ramp(['#FBB2CF', '#F7609A', '#E0488A'], Math.round(36 / u));
    const svg = wordmarkSvg(n).replace(/<g clip-path="url\(#wmc\)">[\s\S]*?<\/g>/, '<g clip-path="url(#wmc)"><rect x="-20" y="-3" width="160" height="36" fill="url(#wmd)"/><rect x="-20" y="32.9" width="160" height="14" fill="#E0488A"/></g>')
      .replace('<defs>', `<defs><pattern id="wmd" patternUnits="userSpaceOnUse" x="-20" y="-3" width="${8 * u}" height="36"><image href="${fill}" width="${8 * u}" height="36" preserveAspectRatio="none" style="image-rendering:pixelated"/></pattern>`);
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = n;
        const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, n);
        const id = ctx.getImageData(0, 0, w, n); for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] >= 128 ? 255 : 0; ctx.putImageData(id, 0, 0);
        WMB[h] = { src: cv.toDataURL('image/png'), w: w / dpr, h: n / dpr };
      } catch (e) { /* fall back to the SVG */ }
      done();
    };
    img.onerror = done;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  E.glyphsReady = Promise.all([E.glyphsReady, wmRaster(52), wmRaster(72), wmRaster(88)]);
  /** The wordmark at 52px (banner), 88px (login and loading screens, where it stands alone) or 72px (certificate, beside the pig). */
  E.wordmark = (h) => (WMB[h] ? `<img class="wm smooth" src="${WMB[h].src}" style="width:${WMB[h].w}px;height:${WMB[h].h}px" alt="Epig" draggable="false">` : wordmarkSvg(h).replace('<svg ', '<svg class="wm" role="img" aria-label="Epig" '));

  /* "SIM + EHR": the descriptor that stands over the Student Edition sticker. Book-face capitals, upright,
     navy, with a green cross between the two words. It is a bitmap at the same pixel density as the Epig
     wordmark: drawn at its own size for the banner and, like Epig, at half size and doubled with hard pixels
     on the login and loading screens. The bitmap is cropped to the ink of the letters, so its edges are the
     edges of the S and the R and its top is the top of the capitals; nothing needs nudging in the stylesheet. */
  const SIMB = {};
  E.simmark = (capHeight, scale) => {
    // scale 2: drawn small and doubled, like the Epig wordmark beside it on the login screen.
    // scale 1: drawn at the screen's real resolution and shown smooth, so it stays sharp on scaled displays.
    const r = Math.max(1, window.devicePixelRatio || 1), k = 1 / r, key = capHeight + 'x' + r;
    if (!SIMB[key]) {
      const cap = capHeight / k, face = '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
      const probe = document.createElement('canvas').getContext('2d');
      let size = Math.round(cap / 0.69);
      probe.font = `700 ${size}px ${face}`;
      size = Math.round((size * cap) / probe.measureText('H').actualBoundingBoxAscent);          // make the capitals exactly `cap` pixels tall
      probe.font = `700 ${size}px ${face}`;
      const a = probe.measureText('SIM'), b = probe.measureText('EHR');
      const inkA = a.actualBoundingBoxLeft + a.actualBoundingBoxRight, inkB = b.actualBoundingBoxLeft + b.actualBoundingBoxRight;
      const plus = Math.max(5, Math.round(cap * 0.62)), gap = Math.max(2, Math.round(cap * 0.2)), top = Math.ceil(probe.measureText('SEHR').actualBoundingBoxAscent);
      const w = Math.ceil(inkA + gap + plus + gap + inkB), h = top + Math.round(r);                             // one extra row for the light edge under the letters
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.font = `700 ${size}px ${face}`; ctx.textBaseline = 'alphabetic';
      const xA = a.actualBoundingBoxLeft, xB = inkA + gap + plus + gap + b.actualBoundingBoxLeft;
      ctx.fillStyle = 'rgba(255, 255, 255, .45)'; ctx.fillText('SIM', xA, top + Math.round(r)); ctx.fillText('EHR', xB, top + Math.round(r));
      ctx.fillStyle = '#12233F'; ctx.fillText('SIM', xA, top); ctx.fillText('EHR', xB, top);
      // the cross: a dark green outline one pixel thick around a lighter green plus, centred on the capitals
      const px = Math.round(inkA + gap), py = Math.round((top - plus) / 2), arm = Math.max(1, Math.round(plus / 3)), mid = Math.round((plus - arm) / 2);
      const o = Math.round(r); ctx.fillStyle = '#1D5F12'; ctx.fillRect(px + mid - o, py - o, arm + 2 * o, plus + 2 * o); ctx.fillRect(px - o, py + mid - o, plus + 2 * o, arm + 2 * o);
      ctx.fillStyle = '#3DAA2B'; ctx.fillRect(px + mid, py, arm, plus); ctx.fillRect(px, py + mid, plus, arm);
      SIMB[key] = { src: cv.toDataURL('image/png'), w: Math.round(w * k), h: Math.round(h * k), smooth: true };
    }
    return `<img class="sm${SIMB[key].smooth ? ' smooth' : ''}" src="${SIMB[key].src}" width="${SIMB[key].w}" height="${SIMB[key].h}" alt="SIM plus EHR" draggable="false">`;
  };

  /** Ordered-dither mask at a density out of 16; used for the loading screen's stepped dissolve. */
  E.ditherMask = (density) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" shape-rendering="crispEdges">${dots([density], 4, '#000')}</svg>`)}")`;

  /* Dithered artwork for the stylesheet, exposed as CSS variables. Every bitmap is drawn at the exact pixel
     size it is used at (css/app.css repeats that size in background-size), so one bitmap pixel is one
     screen pixel. To add one: add a line here, then use it with image-rendering: pixelated. */
  const root = document.documentElement.style;
  const set = (name, url) => root.setProperty(name, `url("${url}")`);
  const v = (name, stops, h) => set(name, ramp(stops, h));          // vertical ramp, 8px wide
  const hz = (name, stops, w) => set(name, ramp(stops, w, true));   // horizontal ramp, 8px tall
  v('--g-banner', ['#5596DC', '#8DBDEC', '#D6E9F9'], 72);
  v('--g-sky', ['#4F92DA', '#8DBDEC', '#E3F1FC'], 640);
  v('--g-rank', ['#84B8EA', '#E0EFFB'], 150);
  v('--g-bar', ['#647A3A', '#506428', '#36441A'], 28);
  v('--g-band', ['#667B38', '#3A4A1B'], 64);
  v('--g-pane', ['#E6EED2', '#C9D8AC'], 640);
  v('--g-tool', ['#FDFCF7', '#E4E1CD'], 64);
  v('--g-card', ['#F8FAEF', '#D8E1BD'], 32);
  v('--g-lo', ['#F8FAEF', '#D8E1BD'], 48);
  v('--g-btn', ['#FFFFFF', '#F2F1E8', '#D6D4C2'], 23);
  v('--g-down', ['#D2D0BE', '#F2F1E8'], 23);
  v('--g-btn-30', ['#FFFFFF', '#F2F1E8', '#D6D4C2'], 30);
  v('--g-btn-40', ['#FFFFFF', '#F2F1E8', '#D6D4C2'], 40);
  v('--g-sticker-30', ['#FFF3A8', '#E6A61C'], 30);
  v('--g-tab', ['#FFFFFF', '#ECEADB'], 26);
  v('--g-th', ['#FDFCF8', '#E9E7D7'], 26);
  v('--g-tile', ['#A4D0F4', '#E8F4FD'], 64);
  v('--g-hot', ['#FFF6DA', '#FFD98A'], 64);
  v('--g-lvl', ['#FFFFFF', '#EBEADD'], 56);
  v('--g-cap', ['#C6D3A3', '#6F8449'], 21);
  v('--g-cap-x', ['#F0A084', '#C03A22'], 21);
  v('--g-gold', ['#FFFEF4', '#FFF0B8'], 170);
  v('--g-sticker', ['#FFF3A8', '#E6A61C'], 22);
  hz('--g-tp', ['#FFFFFF', '#DAE3C1'], 232);
  hz('--g-tp-danger', ['#FFFFFF', '#F7C3BB'], 232);
  hz('--g-tp-caution', ['#FFFFFF', '#F8DE96'], 232);
  hz('--g-tp-limited', ['#FFFFFF', '#D6C8F1'], 232);
  set('--cloud-a', cloud(180, 40, 11)); set('--cloud-b', cloud(120, 28, 29)); set('--cloud-c', cloud(260, 54, 47));
  // Countryside. In the banner it stays low at the left, behind the wordmark, and rises to the right.
  // Each strip is drawn twice: the far and middle ridges, and the near ridge on its own. Flying pigs are
  // layered between the two, so a pig passes in front of the distant hills and behind the nearest one.
  const low = (t) => 0.3 + 0.7 * smooth(0.025, 0.15, t);
  set('--land-banner', land(4800, 44, ridges(44, 2).slice(0, 2), low));   // wider than any window
  set('--land-banner-near', land(4800, 44, ridges(44, 2).slice(2), low));
  // --land has whole numbers of waves across its width, so it tiles left and right without a seam.
  set('--land', land(2400, 210, ridges(210).slice(0, 2)));
  set('--land-near', land(2400, 210, ridges(210).slice(2)));
  /* Scenery artwork (assets/scene): supplied art, one cut per screen scaling so one art pixel is one real pixel
     (the asset rule in DESIGN.md). These replace the scenery drawn above; the drawn versions remain as the
     fallback while a file loads. Addresses are absolute because a url() in a CSS variable resolves against
     the stylesheet that uses it. */
  const scene = (v, name, cuts, w) => set(v, new URL(`assets/scene/${name}-${cutFor(cuts, w)}.png`, document.baseURI).href);
  scene('--cloud-a', 'cloud-a', [180, 225, 270, 360], 180); scene('--cloud-b', 'cloud-b', [120, 150, 180, 240], 120); scene('--cloud-c', 'cloud-c', [260, 325, 390, 520], 260);
  scene('--cloud-d', 'cloud-d', [200, 250, 300, 400], 200); scene('--cloud-e', 'cloud-e', [84, 105, 126, 168], 84); scene('--cloud-f', 'cloud-f', [220, 275, 330, 440], 220);   // d wisp, e small puff, f broken bank; all six are built by tools/make-clouds.py
  scene('--land', 'hills-far', [2400, 3000, 3600, 4800], 2400); scene('--land-near', 'hills-near', [2400, 3000, 3600, 4800], 2400);
  scene('--land-banner', 'hills-banner-far', [4800, 6000, 7200, 9600], 4800); scene('--land-banner-near', 'hills-banner-near', [4800, 6000, 7200, 9600], 4800);
  // end scenery artwork



  /* The hospital on the hill. ASSET RULE (see DESIGN.md): one art pixel is one real screen pixel, hard edges,
     never shown enlarged. So it is drawn on a 144 x 112 grid scaled by the screen's pixel ratio, with every
     rectangle snapped to whole pixels, and its shading is a one-pixel ordered dither. No image file. */
  set('--hospital', (() => {
    const s = Math.max(1, window.devicePixelRatio || 1), cv = document.createElement('canvas'); cv.width = Math.round(144 * s); cv.height = Math.round(112 * s);
    const x = cv.getContext('2d'), q = (v) => Math.round(v * s);
    const R = (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(q(a), q(b), Math.max(1, q(a + w) - q(a)), Math.max(1, q(b + h) - q(b))); };
    const dith = (c, a, b, w, h) => { x.fillStyle = c; for (let j = q(b); j < q(b + h); j++) for (let i = q(a) + (j & 1); i < q(a + w); i += 2) x.fillRect(i, j, 1, 1); };   // 50% checker, one real pixel
    const LINE = '#8E2F55', WALL = '#F6B3C8', LIGHT = '#FBD3DF', SHADE = '#E58FAE', ROOF = '#C24F7C', ROOFHI = '#DB7AA0', GLASS = '#CFE8FF', DOOR = '#7A2C4E';
    // wings
    R(LINE, 14, 34, 116, 78); R(WALL, 15, 41, 114, 71); R(SHADE, 120, 41, 9, 71); dith(SHADE, 112, 41, 8, 71); dith(LIGHT, 15, 41, 6, 71);
    R(ROOF, 15, 35, 114, 6); R(ROOFHI, 15, 35, 114, 1); dith(LINE, 15, 40, 114, 1);
    // tower
    R(LINE, 50, 10, 44, 102); R(LIGHT, 51, 17, 42, 95); R(SHADE, 88, 17, 5, 95); dith(SHADE, 83, 17, 5, 95); dith('#FFFFFF', 51, 17, 4, 95);
    R(ROOF, 51, 11, 42, 6); R(ROOFHI, 51, 11, 42, 1); dith(LINE, 51, 16, 42, 1);
    // flag
    R(LINE, 72, 0, 1, 11); R('#E5487A', 73, 0, 9, 6); R('#F58BB0', 73, 0, 9, 1); R('#B93565', 73, 5, 9, 1);
    // the sign: white plate, green cross
    R(LINE, 60, 20, 24, 24); R('#FFFFFF', 61, 21, 22, 22); dith('#E4EEF7', 61, 37, 22, 6);
    R('#1D5F12', 68, 24, 8, 16); R('#1D5F12', 64, 28, 16, 8); R('#3DAA2B', 69, 25, 6, 14); R('#3DAA2B', 65, 29, 14, 6); R('#7FD46A', 69, 25, 6, 1); R('#7FD46A', 65, 29, 4, 1);
    // windows: frame, glass, sky reflection, mullion, sill
    const win = (a, b) => { R(LINE, a - 1, b - 1, 8, 11); R(GLASS, a, b, 6, 9); dith('#8FC0EC', a, b + 5, 6, 4); R('#FFFFFF', a, b, 2, 2); R(LINE, a + 3, b, 0.6, 9); R('#FFFFFF', a - 2, b + 10, 10, 1); };
    [48, 64, 80].forEach((y) => [20, 30, 40, 98, 108, 118].forEach((xx) => win(xx, y)));
    [50, 66].forEach((y) => [58, 80].forEach((xx) => win(xx, y)));
    // door, striped awning, step
    R(LINE, 59, 83, 26, 6); R(ROOF, 60, 84, 24, 4); [60, 68, 76].forEach((xx) => R('#FFFFFF', xx, 84, 4, 4));
    R(LINE, 62, 89, 20, 23); R(DOOR, 63, 90, 18, 22); R(GLASS, 65, 92, 6, 10); R(GLASS, 73, 92, 6, 10); R('#FFFFFF', 65, 92, 2, 2); R('#FFFFFF', 73, 92, 2, 2); R('#F2C94C', 71, 101, 1, 2);
    return cv.toDataURL('image/png');
  })());
  scene('--hospital', 'hospital', [144], 144);   // only the 1x cut exists so far; add 180, 216, 288 here when they arrive   // supplied art; the drawn one above is the fallback
})();
