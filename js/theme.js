/* SIM+EHR Student Edition — colour themes.
   Olive is the house colour the stylesheet is written in; Frutiger Aero is the default. Every other theme is
   made from olive by rule, not repainted by hand:
   - accent colours (the olive family: hue 62-130, with some colour in them) take the theme's hue, keeping their
     lightness, so every contrast pair in css/app.css keeps its contrast;
   - warm greys (the beige window faces and lines) can be tinted toward the theme's neutral hue;
   - the clinical colours (red, amber, the status green, blue, purple) are outside both bands and never change.
   css/themes.css holds the stylesheet side, generated from css/app.css by tools/build-themes.js (rerun it after
   editing app.css). The dithered ramps in js/glyphs.js are passed through EHRTheme.stops when they are drawn.
   This file loads in <head>, before the page paints, so a saved theme shows from the first frame. It also runs
   under Node for the build tool. */
(function (root) {
  const THEMES = [
    { id: 'olive', name: 'Olive', swatch: ['#55672D', '#BDCB9B', '#ECE9D8', '#E5972A'] },
    { id: 'blue', name: 'Luna Blue', swatch: ['#2D4F8F', '#9DB5E2', '#ECE9D8', '#E5972A'],
      accent: { hue: 218, sat: 1.25 } },
    { id: 'silver', name: 'Silver', swatch: ['#4D5566', '#B5BBC8', '#E6E7EC', '#E5972A'],
      accent: { hue: 225, sat: 0.3 }, neutral: { hue: 228, sat: 0.55 } },
    { id: 'vaporwave', name: 'Vaporwave', swatch: ['#8A2C9E', '#FF71CE', '#B8F4FF', '#01CDFE'],
      accent: { hue: 298, sat: 1.6 }, neutral: { hue: 285, sat: 1.3 },
      ramps: {
        '--g-banner': ['#FF8AD8', '#C9A4FF', '#A8F1FF'],
        '--g-hot': ['#E9FDFF', '#9BEFFF'],
        '--g-sticker': ['#B8FBFF', '#01CDFE'], '--g-sticker-30': ['#B8FBFF', '#01CDFE'],
        '--g-gold': ['#FFF4FD', '#FFD3F2'],
      },
      css: `--hot: #01A9D6; --hot-2: #7DF3FF; --note: #EFFDFF; --link: #6A1FB0;`,
      extra: (s) => `${s} h2 { text-shadow: 2px 2px 0 #9EF5FF; }
${s} .banner { border-bottom-color: #01CDFE; }` },
    { id: 'aero', name: 'Frutiger Aero', swatch: ['#0C6FAF', '#7FD3F5', '#EAF6FC', '#5FC93A'],
      accent: { hue: 199, sat: 1.55 }, neutral: { hue: 200, sat: 1.15 },
      ramps: {
        '--g-btn': ['#FFFFFF', '#F1FAFF', '#CDEBFB', '#E3F6FF'], '--g-btn-30': ['#FFFFFF', '#F1FAFF', '#CDEBFB', '#E3F6FF'],
        '--g-btn-40': ['#FFFFFF', '#F1FAFF', '#CDEBFB', '#E3F6FF'], '--g-down': ['#BFE3F7', '#E8F7FF'],
        '--g-bar': ['#5BC3EF', '#1D86C8', '#0C5E9E', '#1670AE'], '--g-band': ['#3FA9E0', '#0C5E9E'],
        '--g-tab': ['#FFFFFF', '#F0FAFF', '#DCF1FC'], '--g-tool': ['#FFFFFF', '#F2FAFE', '#DDF0FA'],
        '--g-cap': ['#B8E8FF', '#2C9AD8'],
      },
      css: `--hot: #1FA2E0; --hot-2: #9BE6FF;`,
      extra: (s) => `${s} .xpbar i, ${s} .xpbar.big i { background: linear-gradient(#B6F08F, #5FC93A 55%, #3FA923); }
${s} .btn, ${s} .snd-btn { border-radius: 5px; }` },
  ];
  const BY = Object.fromEntries(THEMES.map((t) => [t.id, t]));

  /* ---- colour arithmetic ---- */
  const toHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2, d = M - m;
    let h = 0, s = 0;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, s, l, d];
  };
  const toRgb = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r, g, b].map((v) => Math.round(Math.max(0, Math.min(1, v + m)) * 255));
  };
  /** The theme's version of one colour, as [r, g, b]; unchanged when it is outside both bands. */
  const mapRgb = (t, r, g, b) => {
    if (!t || (!t.accent && !t.neutral)) return [r, g, b];
    const [h, s, l, chroma] = toHsl(r, g, b);
    if (t.accent && h >= 62 && h <= 130 && chroma >= 0.06) return toRgb((t.accent.hue + h - 80 + 360) % 360, Math.min(1, s * t.accent.sat), l);
    if (t.neutral && h >= 25 && h < 62 && chroma > 0.01 && chroma < 0.1 && l > 0.35) return toRgb(t.neutral.hue, Math.min(1, s * t.neutral.sat), l);
    return [r, g, b];
  };
  const hex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
  const parseHex = (h) => { h = h.slice(1); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  /** Rewrite every #hex and rgb()/rgba() colour in a CSS value for theme t. */
  const same = (a, b) => a.every((v, i) => v === b[i]);
  const mapText = (t, text) => text
    .replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m) => { const o = parseHex(m), c = mapRgb(t, ...o); return same(o, c) ? m : '#' + c.map(hex).join(''); })
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)/g, (m, r, g, b, a) => { const c = mapRgb(t, +r, +g, +b); return same([+r, +g, +b], c) ? m : a ? `rgba(${c.join(', ')}${a})` : `rgb(${c.join(', ')})`; });

  const KEY = 'ome-ehr-theme', listeners = [];
  const DEFAULT = 'aero';
  let current = DEFAULT;
  const T = {
    THEMES, mapText,
    get: () => BY[current],
    /** Colour stops for a dithered ramp, in the current theme. */
    stops: (name, stops) => { const t = BY[current]; return (t.ramps && t.ramps[name]) || stops.map((c) => mapText(t, c)); },
    onChange: (fn) => listeners.push(fn),
    set(id) {
      if (!BY[id]) id = DEFAULT;
      current = id;
      if (root.document) root.document.documentElement.setAttribute('data-theme', id);
      try { root.localStorage.setItem(KEY, id); } catch (e) { /* not saved; the choice lasts this visit */ }
      listeners.forEach((f) => { try { f(id); } catch (e) { /* a repaint failed; the rest still run */ } });
    },
    next() { const i = THEMES.findIndex((t) => t.id === current); T.set(THEMES[(i + 1) % THEMES.length].id); },
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = T; return; }
  try { const saved = root.localStorage.getItem(KEY); if (BY[saved]) current = saved; } catch (e) { /* storage blocked: the default */ }
  if (root.document) root.document.documentElement.setAttribute('data-theme', current);
  root.EHRTheme = T;
})(typeof window !== 'undefined' ? window : globalThis);
