/* SIM+EHR Student Edition — views. Pure functions from state to HTML strings; all dynamic text goes through esc(). */
(function () {
  const E = window.EHR, esc = E.esc, H = E.HOUR;
  const V = (E.V = { act: {} });
  E.ui = { modal: null, orderQuery: '', selLab: null, selVital: null, selReport: null, noteSel: null, crTab: 'enc', crSel: null, marDay: 0, inboxSel: null, showHistory: false, listFilter: 'all', learnWho: null, collapsed: {}, quip: Math.floor(Math.random() * 1000) };   // quip: which notice-bar line this visit shows

  E.ACTS = [['summary', 'Summary'], ['review', 'Chart Review'], ['results', 'Results'], ['flowsheets', 'Flowsheets'], ['mar', 'MAR'], ['notes', 'Notes'], ['orders', 'Orders'], ['problems', 'Problems & Allergies']];

  const icon = E.icon;
  const ACT_GLYPH = { summary: 'summary', review: 'review', results: 'results', flowsheets: 'flowsheets', mar: 'mar', notes: 'notes', orders: 'orders', problems: 'problems' };
  /** Explorer-style task pane group; collapses from its header. */
  const pane = (id, title, body, cls) => { const shut = E.ui.collapsed[id]; return `<section class="tp ${cls || ''}${shut ? ' shut' : ''}"><button class="tp-h" data-act="paneToggle" data-id="${id}" aria-expanded="${!shut}"><span>${esc(title)}</span><i class="chev"></i></button>${shut ? '' : `<div class="tp-b">${body}</div>`}</section>`; };
  const chip = (t, cls) => `<span class="chip ${cls || ''}">${esc(t)}</span>`;
  const empty = (t) => `<div class="empty">${esc(t)}</div>`;
  const CARD_GLYPH = [['Latest vitals', 'vitals'], ['Vital signs', 'vitals'], ['Abnormal labs', 'results'], ['Laboratory', 'results'], ['Trend', 'flowsheets'], ['Imaging', 'review'], ['Problem list', 'problems'], ['Allergies', 'alert'], ['Active medications', 'mar'], ['Other active orders', 'orders'], ['Active orders', 'orders'], ['All orders', 'orders'], ['Pended', 'warn'], ['New orders', 'add'], ['Recent notes', 'notes'], ['Work samples', 'review']];
  const card = (title, body, extra) => { const cg = CARD_GLYPH.find(([k]) => title.startsWith(k)); return `<section class="card"><header class="card-h"><h3>${cg ? icon(cg[1], 24) : ''}${esc(title)}</h3>${extra || ''}</header><div class="card-b">${body}</div></section>`; };
  const statusChip = (s) => chip(s, { Active: 'green', Pended: 'amber', 'In process': 'blue', Completed: 'grey', Discontinued: 'grey', Declined: 'grey', Signed: 'green', 'Cosign needed': 'amber' }[s] || 'grey');
  const opts = (list, sel) => list.map((o) => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('');
  const allergyText = (p) => (E.allergiesOf(p).length ? E.allergiesOf(p).map((a) => a.agent).join(', ') : 'No known allergies');
  /* Abnormal vital signs carry a letter as well as the red, the way lab results show H and L, so the state does not
     depend on seeing colour. Which side of normal: compared with the middle of the range E.vitalAbn uses. */
  const VMID = { temp: 37, hr: 75, rr: 16, sbp: 125, dbp: 75, spo2: 96, pain: 3 };
  const vflag = (k, v) => (E.vitalAbn(k, v) ? (Number(v) >= VMID[k] ? 'H' : 'L') : '');
  /** Blood pressure is abnormal if either number is. */
  const vflagOf = (k, v) => (k === 'sbp' ? vflag('sbp', v.sbp) || vflag('dbp', v.dbp) : vflag(k, v[k]));
  const vmark = (f) => (f ? ` <b class="vflag" title="${f === 'H' ? 'Above' : 'Below'} the normal range">${f}</b>` : '');

  /* ================= login ================= */
  /* Login, laid out like a sign-in screen: on the left the product (SIM EHR among its icons), on the right a
     sign-in card with the Epig logo at the top, then name, role and Log in. */
  V.login = () => `
    <div class="welcome">
      <div class="w-band"></div>
      <div class="w-mid">${V.sky('lg')}
        <button class="music-btn" data-act="musicToggle" aria-pressed="${!!(E.music && E.music.wanted)}" title="${E.music && E.music.wanted ? 'The music is on. Press again to stop it.' : 'Music is off until you turn it on.'}">${icon(E.music && E.music.wanted ? 'music' : 'mute', 24)}<span>Play music</span></button>
        <div class="w-left">
          <div class="scene">
            <div class="collage" aria-hidden="true">${[['results', 'c1'], ['mar', 'c2'], ['summary', 'c3'], ['learning', 'c4'], ['code', 'c5']].map(([g, c]) => `<span class="${c}">${icon(g, 96)}</span>`).join('')}</div>
            <div class="scene-tag"><span class="tagset big">${E.simmark(40, 2)}<span class="sticker">Student Edition</span></span><p class="tagnote">an electronic health record sim</p></div>
          </div>
        </div>
        <div class="w-rule"></div>
        <div class="w-right">
          <div class="w-brand">${E.wordmark(88)}</div>
          <label class="field">Your name<input id="loginName" placeholder="e.g., Alex Kim" autocomplete="off" maxlength="60"></label>
          <div class="field" id="roleLabel">Role:</div>
          <div class="role-grid" role="radiogroup" aria-labelledby="roleLabel">
            ${Object.entries(E.ROLES).map(([id, r], i) => `<label class="role"><input type="radio" name="role" value="${id}"${i === 0 ? ' checked' : ''}><span class="tile">${icon({ student: 'learning', physician: 'idcard', nurse: 'mar' }[id], 48)}</span><span><b>${esc(r.label)}</b><small>${esc(r.desc)}</small></span></label>`).join('')}
          </div>
          <div id="loginErr" class="err"></div>
          <button class="btn primary lg" data-act="login">Log in</button>
        </div>
      </div>
      <div class="w-band foot">${esc(E.QUIPS[E.ui.quip % E.QUIPS.length])} <b>Never enter real patient information.</b></div>
    </div>`;

  /* ================= the sky: drifting clouds, flyers and the land in front of them =================
     The banner is redrawn whenever the screen changes, so every animation is given a negative delay from the
     page clock; a cloud carries on from where it was instead of jumping back to the start. */
  V.sky = (kind) => {
    const now = performance.now() / 1000, big = kind === 'lg', popped = E.ui.popped || (E.ui.popped = {});
    let n = 0;
    const at = (dur, offset) => `animation-duration:${dur}s;animation-delay:-${((now + offset) % dur).toFixed(2)}s`;
    const cl = (shape, top, dur, offset) => `<i class="cl ${shape}" style="top:${top};${at(dur, offset)}"></i>`;
    // A pig that has been caught stays away until its next flight would begin.
    const fly = (name, cls, size, top, dur, offset) => {
      const key = kind + n++, left = dur - ((now + offset) % dur);
      if (popped[key] > now) return '';
      return `<span class="fly ${cls}" data-act="pigPop" data-key="${key}" data-left="${left.toFixed(1)}" style="top:${top};width:${size}px;height:${size}px;${at(dur, offset)}">${icon(name + '1', size)}${icon(name + '2', size)}</span>`;   // the hand-drawn pig, wing up and wing down
    };
    // Back to front: clouds, the distant hills, the pigs, the nearest hill.
    const far = '<i class="land"></i>' + (big ? '<i class="hosp"></i>' : '');   // the pink hospital stands on the far hills, behind the pigs
    return `<div class="skyfx ${kind}" aria-hidden="true">${big
      ? cl('c', '9%', 210, 20) + cl('d', '15%', 300, 240) + cl('a', '20%', 150, 95) + cl('e', '6%', 120, 50) + cl('f', '31%', 260, 170) + cl('b', '26%', 180, 10) + cl('d', '38%', 340, 75) + cl('e', '42%', 230, 140) + far + fly('pig', 'rl', 48, '8%', 58, 40) + fly('pig', 'lr', 48, '34%', 74, 8) + fly('pig', 'lr', 48, '18%', 97, 66)
      : cl('a', '6px', 170, 60) + cl('d', '30px', 280, 205) + cl('e', '22px', 230, 150) + cl('b', '12px', 120, 20) + far + fly('pig', 'lr', 24, '8px', 140, 100) + fly('pig', 'rl', 24, '4px', 190, 30)}<i class="land near"></i></div>`;
  };

  /* The tag set: the SIM + EHR bitmap over the Student Edition sticker. The sticker stretches to the width of
     the lettering, so the two lines share their left and right edges. `big` is the doubled, login-size version. */
  const tagSet = (big) => `<span class="tagset${big ? ' big' : ''}">${E.simmark(big ? 34 : 19, big ? 2 : 1)}<span class="sticker">Student Edition</span></span>`;

  /* ================= loading screen ================= */
  V.splash = (kind) => {
    const fact = E.FACTS[Math.floor(Math.random() * E.FACTS.length)];
    const who = kind === 'login' && E.db.user ? E.db.user.name : '';
    // One column, top to bottom: the mark, what it is (or a welcome), what is inside, a fact, progress, the notice.
    return `${V.sky('lg')}<div class="sp-in">
      <h1>${E.wordmark(88)}</h1>
      ${who ? `<p class="sp-hello">Welcome, ${esc(who)}</p>` : `<div class="sp-tag">${tagSet(true)}</div>`}
      <p class="tagnote">${who ? 'Opening your simulated patient list' : 'an electronic health record simulation'}</p>
      <div class="sp-strip" aria-hidden="true">${['patients', 'summary', 'results', 'flowsheets', 'mar', 'notes', 'orders', 'learning'].map((n) => icon(n, 48)).join('')}</div>
      <div class="sp-fact">${icon('info', 48)}<div><b>Did you know?</b><span>${esc(fact)}</span></div></div>
      <div class="xpbar big sp-bar" role="progressbar" aria-label="Loading"><i></i></div>
      <p class="sp-skip">${esc(E.QUIPS[(E.ui.quip + 1) % E.QUIPS.length])} <b>Never enter real patient information.</b><br>Click anywhere or press a key to skip</p>
    </div>`;
  };

  /* ================= the one sound switch =================
     A speaker in the banner beside the level widget mutes every sound in the sim (js/audio.js): effects, the
     oink, cutscenes and the login music. It is a toggle button: pressed means muted. It does not need a redraw,
     so it is repainted in place whenever the mute changes, wherever the change came from. */
  V.soundBtn = () => {
    if (!E.audio) return '';
    const off = E.audio.muted();
    return `<button id="soundBtn" class="snd-btn" data-snd="toggle" aria-pressed="${off}" aria-label="Mute all sound" title="${off ? 'Sound is off. Click to turn it back on.' : 'Sound is on. Click to mute everything.'}">${icon(off ? 'mute' : 'music', 24)}</button>`;
  };
  if (E.audio) {
    document.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('[data-snd]'); if (b) E.audio.toggle(); });
    E.audio.onChange(() => { const b = document.getElementById('soundBtn'); if (b && b.outerHTML !== undefined) { const f = document.activeElement === b; b.outerHTML = V.soundBtn(); if (f) { const n = document.getElementById('soundBtn'); if (n) n.focus(); } } });
  }

  /* ================= shell ================= */
  E.myInbox = () => E.db.inbox.filter((m) => !m.roles || m.roles.includes(E.db.user.role));
  V.shell = (r, body) => {
    const db = E.db, unread = E.myInbox().filter((m) => !m.read).length, g = E.game(E.progress());
    const cur = r.pid && E.pt(r.pid);
    // The label stays in the link's name even where the stylesheet hides it at narrow widths (and the Inbox says how many are unread).
    const tool = (to, glyph, label, view, extra) => `<a class="tool${r.view === view ? ' on' : ''}${view === 'inbox' && unread ? ' unread' : ''}" href="${to}" aria-label="${label}${view === 'inbox' && unread ? `, ${unread} unread` : ''}" title="${label}">${icon(glyph, 32)}<span>${label}</span>${extra || ''}</a>`;
    // What stands between the learner and the next rank, and any rank kept from the old rule still to be shown.
    const need = g.need && g.need.blocked ? g.need : null, toGo = g.next && !need ? `${g.next - g.xp} XP to ${E.LEVELS[g.level][1]}` : '';
    const lvlTip = [`Open Learning: ${g.xp} XP, ${g.earned.length} of ${E.BADGES.length} badges`, need ? need.text : toGo, g.need && !g.need.blocked ? `Next: ${g.need.text}` : '', g.confirm.length ? `To confirm: ${g.confirm.map((c) => c.text).join('; ')}` : ''].filter(Boolean).join('. ') + '.';
    return `
    <div class="banner">${V.sky('bn')}
      <a class="bn-brand" href="#/home" title="Patient Lists">${E.wordmark(52)}</a>
      <span class="spacer">${E.world ? E.world.banner() : ''}</span>
      <span class="bn-tag">${tagSet()}</span>
      <a class="lvl${need ? ' held' : ''}" href="#/learning" title="${esc(lvlTip)}" aria-label="Level ${g.level}, ${esc(g.title)}. ${esc(lvlTip)}">${icon('star', 40)}<span class="lvl-t"><b>Level ${g.level} · ${esc(g.title)}</b><span class="xpbar" role="img" aria-label="${g.xp} experience points${toGo ? ', ' + toGo : ''}"><i style="width:${g.pct}%"></i></span>${need ? `<small class="lvl-need">${esc(need.short || need.todo)}</small>` : ''}</span><span class="lvl-n">${g.xp} XP<br>${icon('medal', 16)}${g.earned.length}/${E.BADGES.length}</span></a>
      ${V.soundBtn()}
      <span class="bn-user" title="The role you are playing. Log out to switch."><b>${esc(db.user.name)}</b>Playing: ${esc(E.roleLabel(db.user.role))}</span>
      <button class="cap" data-act="help" title="Help" aria-label="Help"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 6c0-3.600 5.600-3.600 5.600-.2 0 2.200-2.800 2.100-2.800 4.400" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="12.800" r="1.200" fill="#fff"/></svg></button>
      <button class="cap close" data-act="logout" title="Log off" aria-label="Log off"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg></button></div>
    <header class="toolbar">
      <nav class="tools">
        ${tool('#/home', 'patients', 'Patient Lists', 'home')}
        ${tool('#/inbox', 'inbox', 'Inbox', 'inbox', unread ? `<span class="badge">${unread}</span>` : '')}
        ${tool('#/learning', 'learning', 'Learning', 'learning')}
        ${tool('#/missions', 'trophy', 'Missions', 'missions')}
        ${tool('#/log', 'log', 'Activity Log', 'log')}
        <button class="tool" data-act="help" aria-label="Help" title="Help">${icon('help', 32)}<span>Help</span></button>
      </nav>
      <div class="spacer"></div>
      <div class="search"><label for="ptSearch">Find patient</label><span class="search-box">${icon('search', 16)}<input id="ptSearch" data-input="ptSearch" placeholder="Name or MRN" autocomplete="off" aria-label="Find patient by name or MRN"></span><div id="ptSearchRes" class="search-res"></div></div>
    </header>
    <div class="infobar">${icon('warn', 20)}<span><b>SIM+EHR.</b> ${esc(E.QUIPS[E.ui.quip % E.QUIPS.length])} <b>Never enter real patient information.</b></span><span id="status" class="status" role="status">${esc(E.ui.status || '')}</span></div>
    <div class="wstabs">
      <a class="wstab${r.pid ? '' : ' on'}" href="#/home">${icon('home', 20)}Home</a>
      ${db.openTabs.map((id) => { const p = E.pt(id); return p ? `<span class="wstab${r.pid === id ? ' on' : ''}"><a href="#/pt/${id}/summary">${icon('user', 20)}${esc(p.name)}</a><button data-act="closeTab" data-id="${id}" title="Close chart" aria-label="Close chart of ${esc(p.name)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.500 4.500l7 7M11.500 4.500l-7 7" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/></svg></button></span>` : ''; }).join('')}
    </div>
    ${V.dock ? V.dock() : ''}<main class="main">${body}</main>
`;
  };

  /* ================= home: patient lists ================= */
  V.home = () => {
    const db = E.db, f = E.ui.listFilter;
    const units = [...new Set(db.patients.map((p) => p.unit))];
    const rows = db.patients.filter((p) => f === 'all' || p.unit === f);
    const stale = Date.now() - db.createdAt > 18 * H;
    const li = (id, label, n) => `<button class="list-item${f === id ? ' on' : ''}" data-act="listFilter" data-id="${esc(id)}">${icon(id === 'all' ? 'patients' : 'review', 24)}<span>${esc(label)}</span><em>${n}</em></button>`;
    return `<div class="home">
      <aside class="taskpane">${pane('h-lists', 'My Lists', li('all', 'My Patients', db.patients.length))}${pane('h-units', 'Units', units.map((u) => li(u, u, db.patients.filter((p) => p.unit === u).length)).join(''))}${pane('h-tasks', 'Sim Tasks', `<a class="list-item" href="#/learning">${icon('learning', 24)}<span>Open my learning objectives</span></a><button class="list-item" data-act="help">${icon('help', 24)}<span>Take a quick tour</span></button><button class="list-item" data-act="resetAsk">${icon('reset', 24)}<span>Reset sim data</span></button>${(E.db.prefs || {}).palOff ? `<button class="list-item" data-pal="show">${icon('pig1', 24)}<span>Bring back ${esc(E.pal.name)} the guide</span></button>` : ''}`)}</aside>
      <section class="home-main">
        ${stale ? `<div class="notice warn">This sim's timeline was generated on ${E.fmtDT(db.createdAt)}. Reset the sim data to bring vitals, labs and the MAR back to "now". Learning progress is kept.</div>` : ''}
        ${V.nextCard ? V.nextCard() : ''}
        <h2>${icon('patients', 56)}${f === 'all' ? 'My Patients' : esc(f)} <span class="muted">(${rows.length})</span></h2>
        <table class="tbl hover"><thead><tr><th>Bed</th><th>Patient</th><th>Age / Sex</th><th>MRN</th><th>Attending</th><th>Principal problem</th><th>LOS</th><th>Code</th><th>Allergies</th><th>To do</th></tr></thead><tbody>
        ${rows.map((p) => {
          const pend = p.orders.filter((o) => o.status === 'Pended').length, cos = p.notes.filter((n) => n.status === 'Cosign needed').length;
          return `<tr data-act="openPt" data-id="${p.id}" tabindex="0"><td>${esc(p.bed)}</td><td><b>${esc(p.name)}</b>${p.nameAlert ? ' ' + chip('Name alert', 'purple') : ''}${p.isolation ? ' ' + chip(p.isolation, 'amber') : ''}${p.icu ? ' ' + chip('Intensive care', 'red') : ''}${p.isNew ? ' ' + chip('New', 'blue') : ''}${p.discharged ? ' ' + chip('Discharged', 'green') : ''}</td><td>${E.age(p.dob)} ${p.sex}</td><td>${p.mrn}</td><td>${esc(p.attending)}</td><td>${esc(p.dx)}</td><td class="nowrap">Day ${Math.max(1, Math.ceil((Date.now() - p.admitTs) / (24 * H)))}</td><td>${chip(p.codeStatus, p.codeStatus === 'Full Code' ? 'grey' : 'purple')}</td><td class="${E.allergiesOf(p).length ? 'allergy-cell' : 'muted'}">${esc(allergyText(p))}</td><td>${pend ? chip(pend + ' pended order' + (pend > 1 ? 's' : ''), 'amber') : ''} ${cos ? chip(cos + ' cosign', 'amber') : ''}</td></tr>`;
        }).join('')}
        </tbody></table>
      </section></div>`;
  };

  /* ================= chart frame ================= */
  V.sidebar = (p) => {
    const v = E.lastVitals(p), bmi = (p.weight / Math.pow(p.height / 100, 2)).toFixed(1);
    const vit = (k, label, val) => { const f = vflagOf(k, v); return `<div class="${f ? 'abn' : ''}"><span>${label}</span>${val}${vmark(f)}</div>`; };
    return `<aside class="taskpane sidebar">
      <div class="pt-head"><div class="avatar">${icon('user', 56)}</div><div><div class="pt-name">${esc(p.name)}</div><div>${E.age(p.dob)} y.o. ${p.sex === 'M' ? 'male' : 'female'}</div><div>MRN ${p.mrn}</div>${p.nameAlert ? `<div>${chip('Name alert', 'purple')}</div>` : ''}</div></div>
      <button class="btn call wide" data-act="callOpen">${icon('call', 28)}Call patient</button>
      <button class="btn wide msg-pt" data-act="msgOpen" data-id="${p.id}">${icon('inbox', 16)}Message patient</button>
      ${pane('s-code', 'Code Status', `<div class="sb-line">${icon('code', 28)}<b>${esc(p.codeStatus)}</b></div>`, p.codeStatus === 'Full Code' ? '' : 'limited')}
      ${pane('s-allergy', 'Allergies', E.allergiesOf(p).length ? E.allergiesOf(p).map((a) => `<div class="sb-line">${icon('alert', 24)}<span><b>${esc(a.agent)}</b><br>${esc(a.reaction)}</span></div>`).join('') : '<div>No known allergies</div>', E.allergiesOf(p).length ? 'danger' : '')}
      ${p.isolation ? pane('s-iso', 'Isolation', `<div class="sb-line">${icon('iso', 28)}<b>${esc(p.isolation)}</b></div>`, 'caution') : ''}
      ${v ? pane('s-vitals', 'Last Vitals', `<div class="sb-vitals">${vit('temp', 'T', v.temp)}${vit('hr', 'HR', v.hr)}${vit('rr', 'RR', v.rr)}${vit('sbp', 'BP', v.sbp + '/' + v.dbp)}${vit('spo2', 'SpO2', v.spo2 + '%')}${vit('pain', 'Pain', v.pain)}</div><div class="muted">${esc(v.o2)} · ${E.fmtDT(v.ts)}</div>`) : ''}
      ${pane('s-problems', 'Active Problems', `<ul>${p.problems.filter((x) => x.status === 'Active').map((x) => `<li>${esc(x.name)}</li>`).join('')}</ul>`)}
      ${pane('s-details', 'Details', `<dl class="kv"><dt>DOB</dt><dd>${E.fmtDob(p.dob)}</dd><dt>Bed</dt><dd>${esc(p.bed)}</dd><dt>Admitted</dt><dd>${E.fmtDate(p.admitTs)}</dd><dt>Attending</dt><dd>${esc(p.attending)}</dd><dt>Nurse</dt><dd>${esc(p.rn)}</dd><dt>Ht / Wt</dt><dd>${p.height} cm · ${p.weight} kg</dd><dt>BMI</dt><dd>${bmi}</dd></dl>`)}
    </aside>`;
  };
  V.chart = (p, act) => `<div class="chartwrap">${V.sidebar(p)}<section class="chart">
      <nav class="acts">${E.ACTS.map(([id, label]) => `<a href="#/pt/${p.id}/${id}" class="${id === act ? 'on' : ''}">${icon(ACT_GLYPH[id], 24)}${label}</a>`).join('')}</nav>
      <div class="activity" id="activity">${V.chartBanner ? V.chartBanner(p) : ''}${V.act[act](p)}</div></section>${V.notePane(p)}${V.chatFloat(p)}</div>`;

  /* ================= trend chart ================= */
  V.trend = (pts, lo, hi, dec) => {
    if (!pts.length) return '';
    const W = 640, Ht = 170, L = 46, R = 14, T = 12, B = 26;
    const vals = pts.map((p) => p.v).concat(lo != null ? [lo] : [], hi != null ? [hi] : []);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    const pad = (mx - mn || 1) * 0.12; mn -= pad; mx += pad;
    const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts;
    const x = (ts) => (t1 === t0 ? (L + W - R) / 2 : L + ((ts - t0) / (t1 - t0)) * (W - L - R));
    const y = (v) => T + (1 - (v - mn) / (mx - mn)) * (Ht - T - B);
    const out = (v) => (lo != null && v < lo) || (hi != null && v > hi);
    const band = lo != null && hi != null ? `<rect x="${L}" y="${y(hi)}" width="${W - L - R}" height="${y(lo) - y(hi)}" class="tr-band"/>` : '';
    const yl = (v) => `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="tr-ax">${(+v).toFixed(dec || 0)}</text>`;
    const step = Math.max(1, Math.ceil(pts.length / 7));
    return `<svg viewBox="0 0 ${W} ${Ht}" class="trend" role="img" aria-label="Trend chart">${band}
      <line x1="${L}" y1="${Ht - B}" x2="${W - R}" y2="${Ht - B}" class="tr-line"/>
      ${lo != null ? yl(lo) : yl(mn + pad)}${hi != null ? yl(hi) : yl(mx - pad)}
      <polyline fill="none" class="tr-path" points="${pts.map((p) => `${x(p.ts).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>
      ${pts.map((p, i) => `<circle cx="${x(p.ts).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" class="${out(p.v) ? 'tr-out' : 'tr-pt'}"><title>${(+p.v).toFixed(dec || 0)} at ${E.fmtDT(p.ts)}</title></circle><text x="${x(p.ts).toFixed(1)}" y="${(y(p.v) - 8).toFixed(1)}" text-anchor="middle" class="tr-val">${(+p.v).toFixed(dec || 0)}</text>${i % step === 0 || i === pts.length - 1 ? `<text x="${x(p.ts).toFixed(1)}" y="${Ht - 8}" text-anchor="middle" class="tr-ax">${E.fmtDT(p.ts)}</text>` : ''}`).join('')}
    </svg>`;
  };

  /* ================= Summary ================= */
  E.overdue = (p) => {
    const now = Date.now(), list = [];
    p.orders.forEach((o) => { if (o.status === 'Active') E.dueTimes(o, E.dayStart(0)).forEach((d) => { if (d < now - H && !p.mar.some((a) => a.orderId === o.id && a.dueTs === d)) list.push({ o, due: d }); }); });
    return list;
  };
  V.act.summary = (p) => {
    const v = E.lastVitals(p);
    const abn = Object.keys(E.LABS).map((k) => { const l = E.latestLab(p, k); const f = l && E.flag(k, l.value); return f ? { k, l, f } : null; }).filter(Boolean);
    const meds = p.orders.filter((o) => o.type === 'med' && o.status === 'Active');
    const other = p.orders.filter((o) => o.type !== 'med' && o.status === 'Active');
    const pend = p.orders.filter((o) => o.status === 'Pended'), proc = p.orders.filter((o) => o.status === 'In process');
    const cos = p.notes.filter((n) => n.status === 'Cosign needed'), od = E.overdue(p);
    const todo = [pend.length && `${pend.length} order(s) pended, awaiting cosign`, cos.length && `${cos.length} note(s) awaiting cosign`, od.length && `${od.length} medication dose(s) overdue`, proc.length && `${proc.length} test(s) in process`].filter(Boolean);
    const notes = [...p.notes].sort((a, b) => b.ts - a.ts).slice(0, 4), reps = [...p.reports].sort((a, b) => b.ts - a.ts).slice(0, 4);
    return `<div class="sum-head"><div><h2>${esc(p.dx)}</h2><div class="muted">Chief complaint: ${esc(p.cc)} · Hospital day ${Math.max(1, Math.ceil((Date.now() - p.admitTs) / (24 * H)))}</div></div></div>
      ${todo.length ? `<div class="notice info"><b>Needs attention:</b> ${todo.map(esc).join(' · ')}</div>` : ''}
      <div class="grid3">
        ${card('Latest vitals', v ? `<div class="vit-grid">${[['temp', 'Temp', v.temp + ' °C'], ['hr', 'HR', v.hr], ['rr', 'RR', v.rr], ['sbp', 'BP', v.sbp + '/' + v.dbp], ['spo2', 'SpO2', v.spo2 + '%'], ['pain', 'Pain', v.pain + '/10']].map(([k, l, val]) => { const f = vflagOf(k, v); return `<div class="${f ? 'abn' : ''}"><span>${l}</span><b>${val}</b>${vmark(f)}</div>`; }).join('')}</div><div class="muted">${esc(v.o2)} · ${E.fmtDT(v.ts)} · ${esc(v.by)}</div>` : empty('No vitals recorded'), `<a href="#/pt/${p.id}/flowsheets">Flowsheets</a>`)}
        ${card('Abnormal labs (most recent)', abn.length ? `<table class="tbl compact"><tbody>${abn.map(({ k, l, f }) => `<tr><td>${esc(E.LABS[k].name)}</td><td class="lab-${f}"><b>${E.labVal(k, l.value)}</b> ${f}</td><td class="muted">${E.LABS[k].lo}–${E.LABS[k].hi} ${esc(E.LABS[k].unit)}</td><td class="muted">${E.fmtDT(l.ts)}</td></tr>`).join('')}</tbody></table>` : empty('No abnormal values'), `<a href="#/pt/${p.id}/results">Results</a>`)}
        ${card('Problem list', `<ul class="plain">${p.problems.filter((x) => x.status === 'Active').map((x) => `<li>${esc(x.name)}</li>`).join('')}</ul>`, `<a href="#/pt/${p.id}/problems">Edit</a>`)}
        ${card('Active medications', meds.length ? `<ul class="plain">${meds.map((o) => `<li><b>${esc(o.name)}</b><div class="muted">${esc(E.orderDetail(o))}</div></li>`).join('')}</ul>` : empty('No active medications'), `<a href="#/pt/${p.id}/mar">MAR</a>`)}
        ${card('Other active orders', other.length ? `<ul class="plain">${other.map((o) => `<li>${esc(o.name)}${o.comment ? `<div class="muted">${esc(o.comment)}</div>` : ''}</li>`).join('')}</ul>` : empty('None'), `<a href="#/pt/${p.id}/orders">Orders</a>`)}
        ${card('Recent notes and reports', `<ul class="plain">${notes.map((n) => `<li><a href="#/pt/${p.id}/notes" data-act="noteSel" data-id="${n.id}">${esc(n.type)}</a> <span class="muted">${E.fmtDT(n.ts)} · ${esc(n.author)}</span></li>`).join('')}${reps.map((r) => `<li><a href="#/pt/${p.id}/results" data-act="selReport" data-id="${r.id}">${esc(r.name)}</a> <span class="muted">${E.fmtDT(r.ts)}</span></li>`).join('')}</ul>`)}
      </div>`;
  };

  /* ================= Results ================= */
  V.labTable = (p, cols) => {
    const comps = Object.keys(E.LABS).filter((c) => cols.some((l) => c in l.values));
    let last = '', body = '';
    comps.forEach((c) => {
      const d = E.LABS[c];
      if (d.group !== last) { body += `<tr class="grp"><th colspan="${cols.length + 2}">${esc(d.group)}</th></tr>`; last = d.group; }
      const sel = E.ui.selLab === c;
      body += `<tr class="${sel ? 'sel' : ''}" data-act="selLab" data-comp="${c}" tabindex="0" title="Show trend"><th>${esc(d.name)}</th><td class="muted">${d.lo}–${d.hi} ${esc(d.unit)}</td>${cols.map((l) => { const v = l.values[c]; if (v == null) return '<td></td>'; const f = E.flag(c, v); return `<td class="lab-${f}">${E.labVal(c, v)}${f ? ` <b>${f}</b>` : ''}</td>`; }).join('')}</tr>`;
    });
    return `<div class="scroll-x"><table class="tbl compact hover labs"><thead><tr><th>Component</th><th>Reference</th>${cols.map((l) => `<th>${E.fmtDT(l.ts)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  };
  V.reportList = (p) => {
    const reps = [...p.reports].sort((a, b) => b.ts - a.ts);
    if (!reps.length) return empty('No reports');
    return reps.map((r) => { const open = E.ui.selReport === r.id; return `<div class="report${open ? ' open' : ''}"><button class="report-h" data-act="selReport" data-id="${r.id}"><b>${esc(r.name)}</b><span>${chip(r.kind, 'blue')} ${E.fmtDT(r.ts)} · ${esc(r.by)} · ${esc(r.status)}</span></button>${open ? `<pre class="doc">${esc(r.text)}</pre>` : ''}</div>`; }).join('');
  };
  V.act.results = (p) => {
    const cols = [...p.labs].sort((a, b) => b.ts - a.ts).slice(0, 8);
    const c = E.ui.selLab, d = c && E.LABS[c];
    const pts = c ? p.labs.filter((l) => c in l.values).sort((a, b) => a.ts - b.ts).map((l) => ({ ts: l.ts, v: l.values[c] })) : [];
    const proc = p.orders.filter((o) => o.status === 'In process');
    return `${proc.length ? `<div class="notice info">In process: ${proc.map((o) => esc(o.name)).join(', ')}. Results post automatically in a few seconds.</div>` : ''}
      ${card('Laboratory results', (cols.length ? V.labTable(p, cols) : empty('No lab results')) + '<p class="fine">Newest on the left. H/L = outside reference range, HH/LL = critical. Select a row to trend it.</p>')}
      ${c && pts.length ? card(`Trend: ${d.name}${d.unit ? ' (' + d.unit + ')' : ''}`, V.trend(pts, d.lo, d.hi, d.dec) + '<p class="fine">Shaded band = reference range.</p>', `<button class="btn xs" data-act="selLab" data-comp="">Close</button>`) : ''}
      ${card('Imaging, cardiology, procedures and microbiology', V.reportList(p))}`;
  };

  /* ================= Flowsheets ================= */
  const VROWS = [['temp', 'Temp (°C)', 1], ['hr', 'Heart rate (bpm)', 0], ['rr', 'Resp rate', 0], ['sbp', 'Blood pressure', 0], ['spo2', 'SpO2 (%)', 0], ['o2', 'O2 delivery'], ['pain', 'Pain (0–10)', 0]];
  V.act.flowsheets = (p) => {
    const cols = [...p.vitals].sort((a, b) => a.ts - b.ts).slice(-14), k = E.ui.selVital;
    const row = VROWS.find((r) => r[0] === k);
    const rng = { temp: [36, 37.9], hr: [50, 100], rr: [12, 20], sbp: [90, 160], spo2: [92, 100], pain: [0, 6] }[k] || [];
    return `${card('Vital signs', `<div class="scroll-x"><table class="tbl compact hover labs"><thead><tr><th>Measure</th>${cols.map((v) => `<th>${E.fmtDT(v.ts)}</th>`).join('')}</tr></thead><tbody>
        ${VROWS.map(([key, label]) => `<tr class="${k === key ? 'sel' : ''}"${key !== 'o2' ? ` data-act="selVital" data-k="${key}" tabindex="0" title="Show trend"` : ''}><th>${label}</th>${cols.map((v) => { const f = key === 'o2' ? '' : vflagOf(key, v); return `<td class="${f ? 'lab-H' : ''}">${key === 'sbp' ? `${v.sbp}/${v.dbp}` : esc(v[key])}${f ? ` <b>${f}</b>` : ''}</td>`; }).join('')}</tr>`).join('')}
        <tr><th>Recorded by</th>${cols.map((v) => `<td class="muted">${esc(v.by.split(',')[0])}</td>`).join('')}</tr>
        </tbody></table></div><p class="fine">Oldest on the left. H/L = above or below the normal range. Select a row to trend it.</p>`, `<button class="btn xs" data-act="vitalsOpen">${icon('add', 16)}Record vitals</button>`)}
      ${row ? card(`Trend: ${row[1]}${k === 'sbp' ? ' — systolic' : ''}`, V.trend([...p.vitals].sort((a, b) => a.ts - b.ts).filter((v) => v[k] != null).map((v) => ({ ts: v.ts, v: v[k] })), rng[0], rng[1], row[2]), `<button class="btn xs" data-act="selVital" data-k="">Close</button>`) : ''}`;
  };

  /* ================= MAR ================= */
  /* Each dose state has a shape as well as a colour: overdue a "!", due now a pointer, scheduled a dashed outline
     (css/app.css), given a check. A chip's name says the state in words. */
  const MAR_STATE = { overdue: 'Overdue', due: 'Due now', future: 'Scheduled' };
  const marMark = (st) => (st === 'overdue' ? '<i class="mk" aria-hidden="true">!</i>' : st === 'due' ? '<i class="mk" aria-hidden="true">▸</i>' : '');
  V.act.mar = (p) => {
    const day = E.dayStart(E.ui.marDay), end = day + 24 * H, now = Date.now(), today = E.ui.marDay === 0, nowH = new Date().getHours();
    const meds = p.orders.filter((o) => o.type === 'med' && o.signedTs && !['Pended', 'Declined', 'Draft'].includes(o.status) && (o.status === 'Active' || (o.dcTs && o.dcTs > day) || p.mar.some((a) => a.orderId === o.id && a.ts >= day && a.ts < end)) && o.signedTs < end);
    const kind = (o) => (o.prn ? 'PRN' : o.freq === 'Continuous' ? 'Continuous infusions' : 'Scheduled');
    const hrs = [...Array(24).keys()];
    const mrow = (o) => {
      const dues = E.dueTimes(o, day), adm = p.mar.filter((a) => a.orderId === o.id && a.ts >= day - H && a.ts < end + H);
      const cells = hrs.map((h) => {
        const a0 = day + h * H, a1 = a0 + H, chips = [];
        dues.filter((d) => d >= a0 && d < a1).forEach((d) => {
          const a = adm.find((x) => x.dueTs === d);
          if (a) chips.push(`<span class="mchip ${a.action.toLowerCase()}" title="${esc(a.action)} ${E.fmtTime(a.ts)} by ${esc(a.by)}${a.comment ? ' — ' + esc(a.comment) : ''}">${a.action === 'Given' ? icon('check', 16) + E.fmtTime(a.ts) : esc(a.action)}</span>`);
          else if (o.status !== 'Active') chips.push(`<span class="mchip dc">D/C</span>`);
          else { const st = d < now - H ? 'overdue' : d <= now + H ? 'due' : 'future', lab = MAR_STATE[st]; chips.push(`<button class="mchip ${st}" data-act="marOpen" data-order="${o.id}" data-due="${d}" title="${lab}" aria-label="${lab}, ${E.fmtTime(d)}">${marMark(st)}${E.fmtTime(d)}</button>`); }
        });
        adm.filter((a) => a.dueTs == null && a.ts >= a0 && a.ts < a1).forEach((a) => chips.push(`<span class="mchip ${a.action.toLowerCase()}" title="${esc(a.action)} by ${esc(a.by)}${a.comment ? ' — ' + esc(a.comment) : ''}">${a.action === 'Given' ? icon('check', 16) + E.fmtTime(a.ts) : esc(a.action)}</span>`));
        return `<td class="${today && h === nowH ? 'nowcol' : ''}">${chips.join('')}</td>`;
      }).join('');
      const btn = o.status === 'Active' && today && (o.prn || o.freq === 'Continuous') ? `<button class="btn xs" data-act="marOpen" data-order="${o.id}" data-due="">${o.prn ? 'Give PRN dose' : 'Document rate check'}</button>` : '';
      return `<tr><th class="mar-med"><b>${esc(o.name)}</b><div class="muted">${esc(E.orderDetail(o))}${o.status !== 'Active' ? ' · ' + esc(o.status) : ''}</div>${btn}</th>${cells}</tr>`;
    };
    let body = '';
    ['Scheduled', 'Continuous infusions', 'PRN'].forEach((g) => { const list = meds.filter((o) => kind(o) === g); if (list.length) body += `<tr class="grp"><th colspan="25">${g}</th></tr>` + list.map(mrow).join(''); });
    return `${E.can('mar.document') ? '' : `<div class="notice info">View only. Doses are documented in the Nurse role.</div>`}
      <div class="toolbar"><button class="btn xs" data-act="marDay" data-d="-1">Previous day</button><b>${E.fmtDate(day)}${today ? ' (today)' : ''}</b><button class="btn xs" data-act="marDay" data-d="1"${today ? ' disabled' : ''}>Next day</button>
        <span class="legend"><span class="mchip given">${icon('check', 16)}Given</span><span class="mchip due">${marMark('due')}Due</span><span class="mchip overdue">${marMark('overdue')}Overdue</span><span class="mchip future">Scheduled</span><span class="mchip held">Held</span></span></div>
      ${body ? `<div class="scroll-x"><table class="tbl mar"><thead><tr><th class="mar-med">Medication</th>${hrs.map((h) => `<th class="${today && h === nowH ? 'nowcol' : ''}">${String(h).padStart(2, '0')}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>` : empty('No medications on the MAR for this day')}`;
  };

  /* ================= Notes ================= */
  V.noteDoc = (p, n) => `<div class="doc-h"><div><h3>${esc(n.type)}</h3><div class="muted">${E.fmtDT(n.ts)} · ${esc(n.author)} (${esc(E.roleLabel(n.role))})${n.cosignedBy ? ` · Cosigned by ${esc(n.cosignedBy)} ${E.fmtDT(n.cosignedTs)}` : ''}${n.source ? ` · ${chip('Started in ' + n.source, 'blue')}` : ''}</div></div><div>${statusChip(n.status)} ${n.status === 'Cosign needed' && E.can('note.cosign') ? `<button class="btn primary xs" data-act="noteCosign" data-id="${n.id}">Cosign</button>` : ''}</div></div><pre class="doc">${V.noteText(n.text)}</pre>`;
  /** A signed note's text. The editor's Bold, Italic and List buttons leave plain marks; they show as formatting here. */
  V.noteText = (t) => esc(t).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:)]|$)/gm, '$1<i>$2</i>').replace(/^- /gm, '\u2022 ');
  /** The fill-in-the-blanks line above the note editor. */
  V.blankBar = (text) => {
    const n = (String(text).match(/\*\*\*/g) || []).length;
    return n ? `<span><b>${n} blank${n > 1 ? 's' : ''} to fill.</b> Each <code>***</code> is waiting for your words: jump to it, then type.</span>`
      : `${icon('check', 16)}<span><b>No blanks left.</b> Read it through once, then sign.</span>`;
  };
  /* Open or shut. The learner's own choice wins: this visit's (E.ui.notePane), then the one remembered on this
     computer (E.db.prefs.notePane, stored by the notePane action in js/app.js). With no choice made, it opens when a
     note is in progress, or when the window is wide enough to leave the chart about 760px beside it: the pane takes
     clamp(420px, 37vw, 720px) and the patient sidebar 236px, so that is about 1580px and up. On a laptop it starts
     shut and the rail opens it. */
  const CHART_MIN = 760, SIDEBAR = 236;
  const roomy = () => { const w = window.innerWidth || 0, pane = Math.min(720, Math.max(420, w * 0.37)); return w - SIDEBAR - pane >= CHART_MIN; };
  const noteOpen = (p) => {
    if (E.ui.notePane != null) return !!E.ui.notePane;
    const saved = E.db && E.db.prefs && E.db.prefs.notePane;
    if (typeof saved === 'boolean') return saved;
    return !!(p && p.noteDraft) || roomy();
  };
  E.noteOpen = noteOpen;
  /* The note pane: a third column docked on the right of the chart, as in Epic, so a note can be written
     while the rest of the chart is read. It stays put as the learner moves between activities. */
  V.notePane = (p) => {
    const d = p.noteDraft;
    if (!noteOpen(p)) return `<aside class="notepane shut"><button data-act="notePane" title="Open the note pane" aria-label="Open the note pane">${icon('notes', 24)}<span>My Note</span>${d ? '<i class="np-dot" title="Unsigned note"></i>' : ''}</button></aside>`;
    const tool = (act, id, title, inner) => `<button class="np-t" data-act="${act}"${id ? ` data-id="${id}"` : ''} title="${title}" aria-label="${title}">${inner}</button>`;
    const mine = d ? `<div class="np-my"><b>Type</b><select data-change="noteType" aria-label="Note type">${opts(Object.keys(E.NOTE_TEMPLATES), d.type)}</select><span>unsigned · autosaved</span></div>
        <div class="np-tools" role="toolbar" aria-label="Note tools">${tool('noteFmt', 'b', 'Bold', '<b>B</b>')}${tool('noteFmt', 'i', 'Italic', '<i>I</i>')}${tool('noteFmt', 'l', 'Bulleted list', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h2v2H2zM6 4.500h8v1H6zM2 10h2v2H2zM6 10.500h8v1H6z" fill="currentColor"/></svg>')}
          ${tool('noteUndo', '', 'Undo (Ctrl+Z)', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3L2 7l4 4V8.500h3.500a2.500 2.500 0 0 1 0 5H7v1.500h2.500a4 4 0 0 0 0-8H6z" fill="#2F5E9E"/></svg>')}${tool('noteRedo', '', 'Redo (Ctrl+Y)', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3l4 4-4 4V8.500H6.500a2.500 2.500 0 0 0 0 5H9v1.500H6.500a4 4 0 0 1 0-8H10z" fill="#2F5E9E"/></svg>')}
          <select class="np-smart" data-change="noteInsert" aria-label="Insert SmartText"><option value="">Insert SmartText…</option>${Object.keys(E.DOT).map((k) => `<option value="${k}">.${k}</option>`).join('')}</select>
          ${tool('notePrev', '', 'Previous blank (Shift+F2)', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 3L3 8l6 5v-3h4V6H9z" fill="#C98A00" stroke="#7A5200"/></svg>')}${tool('noteNext', '', 'Next blank (F2)', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3l6 5-6 5v-3H3V6h4z" fill="#C98A00" stroke="#7A5200"/></svg>')}</div>
        <div class="blanks" id="blankBar" aria-live="polite">${V.blankBar(d.text)}</div>
        <textarea id="noteText" class="note-edit" data-input="noteText" spellcheck="true">${esc(d.text)}</textarea>
        <div class="np-foot"><button class="btn primary" data-act="noteSign">${icon('check', 16)}${E.db.user.role === 'student' ? 'Sign (requires cosign)' : 'Sign'}</button><button class="btn" data-act="noteCancel">Cancel note</button><span class="fine">SmartLinks: type <code>.vitals</code> <code>.labs</code> <code>.meds</code> then a space</span></div>`
      : `<div class="np-empty"><button class="btn" data-act="noteNew">${icon('add', 16)}Create Note</button><p>Signed notes are in the Notes activity.</p></div>`;
    // Reading and writing share the pane (owner's request): one tab for the chart's notes, one for the learner's own.
    const notes = [...p.notes].sort((a, b) => b.ts - a.ts), sel = notes.find((n) => n.id === E.ui.noteSel) || notes[0];
    const tab = E.ui.npTab === 'read' ? 'read' : 'mine';
    const read = notes.length ? `<div class="np-list">${notes.map((n) => `<button class="list-row${sel.id === n.id ? ' sel' : ''}" data-act="noteSel" data-id="${n.id}"><b>${esc(n.type)}</b><span class="muted">${E.fmtDT(n.ts)} · ${esc(n.author)}</span>${n.status !== 'Signed' ? statusChip(n.status) : ''}</button>`).join('')}</div><div class="np-doc">${V.noteDoc(p, sel)}</div>`
      : empty('No notes yet');
    const tb = (id, label) => `<button class="${tab === id ? 'on' : ''}" data-act="npTab" data-id="${id}" aria-pressed="${tab === id}">${label}</button>`;
    return `<aside class="notepane" aria-label="Notes"><nav class="np-tabs">${tb('read', `${icon('notes', 16)}Notes (${notes.length})`)}${tb('mine', `My Note${d ? ' <i class="np-dot" title="Unsigned note"></i>' : ''}`)}<span class="spacer"></span><button class="np-hide" data-act="notePane" title="Hide the note pane" aria-label="Hide the note pane"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l6 5-6 5z" fill="currentColor"/></svg></button></nav>
      <div class="np-b${tab === 'mine' && d ? ' edit' : ''}">${tab === 'read' ? read : mine}</div></aside>`;
  };
  V.act.notes = (p) => {
    const notes = [...p.notes].sort((a, b) => b.ts - a.ts), d = p.noteDraft;
    // An index only: a note opens in the note pane on the right, where it is read and written.
    const sel = E.ui.npTab === 'read' && noteOpen(p) ? (notes.find((n) => n.id === E.ui.noteSel) || notes[0]) : null;
    return `<div class="pane list"><div class="toolbar"><b>Notes (${notes.length})</b><span class="muted">Open one to read it in the note pane on the right.</span><span class="spacer"></span><button class="btn xs" data-act="noteNew"${d ? ' disabled' : ''}>${icon('add', 16)}New note</button></div>
        ${d ? `<button class="list-row draft" data-act="notePaneOpen"><b>Draft: ${esc(d.type)}</b><span class="muted">Unsigned · autosaved · open in the note pane on the right</span></button>` : ''}
        ${notes.map((n) => `<button class="list-row${sel && sel.id === n.id ? ' sel' : ''}" data-act="noteSel" data-id="${n.id}"><b>${esc(n.type)}</b><span class="muted">${E.fmtDT(n.ts)} · ${esc(n.author)}</span>${n.status !== 'Signed' ? statusChip(n.status) : ''}</button>`).join('') || empty('No notes yet')}</div>`;
  };

  /* ================= Orders ================= */
  V.orderResults = (q) => {
    q = q.trim().toLowerCase();
    if (q.length < 2) return '';
    const hits = E.CATALOG.filter((c) => (c.name + ' ' + c.group).toLowerCase().includes(q)).slice(0, 12);
    return hits.length ? hits.map((c) => `<button class="res" data-act="addDraft" data-cat="${c.id}"><span><b>${esc(c.name)}</b>${c.type === 'med' ? ` <span class="muted">${esc(c.dose)} ${esc(c.route)} ${esc(c.freq)}${c.prn ? ' PRN' : ''}</span>` : ''}</span>${chip(c.group, 'grey')}</button>`).join('') : `<div class="empty">No orderable matches "${esc(q)}"</div>`;
  };
  V.draft = (d) => {
    const c = E.cat(d.catId), f = (field) => `data-change="draft" data-id="${d.id}" data-field="${field}"`;
    return `<div class="draft"><div class="draft-h"><b>${esc(d.name)}</b><button class="btn xs" data-act="removeDraft" data-id="${d.id}">Remove</button></div><div class="draft-f">
      ${d.type === 'med' ? `<label>Dose<select ${f('dose')}>${opts(c.doses, d.dose)}</select></label><label>Route<select ${f('route')}>${opts(c.routes, d.route)}</select></label><label>Frequency<select ${f('freq')}>${opts(E.FREQS, d.freq)}</select></label><label class="chk"><input type="checkbox" ${f('prn')}${d.prn ? ' checked' : ''}> PRN</label>`
        : `<label>Priority<select ${f('priority')}>${opts(['Routine', 'STAT'], d.priority)}</select></label>`}
      <label class="grow">Comments / indication<input ${f('comment')} value="${esc(d.comment)}" maxlength="200"></label></div></div>`;
  };
  V.act.orders = (p) => {
    const canOrder = E.can('order.sign') || E.can('order.pend'), locked = E.orderLock ? E.orderLock(p) : '';
    const hist = E.ui.showHistory, list = p.orders.filter((o) => (hist ? true : ['Active', 'In process'].includes(o.status)));
    const pend = p.orders.filter((o) => o.status === 'Pended');
    const row = (o) => `<tr><td><b>${esc(o.name)}</b><div class="muted">${esc(E.orderDetail(o))}</div>${(o.overrides || []).map((x) => `<div class="fine">Advisory overridden: ${esc(x.title)} — ${esc(x.reason)}</div>`).join('')}</td><td>${statusChip(o.status)}</td><td class="muted">${esc(o.by)}<br>${E.fmtDT(o.ts)}</td><td>${V.orderExtra ? V.orderExtra(p, o) : ''}${o.status === 'Active' && E.can('order.dc') ? `<button class="btn xs" data-act="orderDc" data-id="${o.id}">Discontinue</button>` : ''}</td></tr>`;
    let active = '';
    E.GROUPS.forEach((g) => { const rows = list.filter((o) => o.group === g); if (rows.length) active += `<tr class="grp"><th colspan="4">${g}</th></tr>` + rows.map(row).join(''); });
    const left = `${pend.length ? card(`Pended — awaiting physician signature (${pend.length})`, `<table class="tbl compact"><tbody>${pend.map((o) => `<tr><td><b>${esc(o.name)}</b><div class="muted">${esc(E.orderDetail(o))}</div>${(o.overrides || []).map((x) => `<div class="fine">Advisory overridden: ${esc(x.title)} — ${esc(x.reason)}</div>`).join('')}</td><td class="muted">${esc(o.by)}<br>${E.fmtDT(o.ts)}</td><td class="nowrap">${E.can('order.sign') ? `<button class="btn primary xs" data-act="orderCosign" data-id="${o.id}">Sign</button> <button class="btn xs" data-act="orderDecline" data-id="${o.id}">Decline</button>` : chip('Pended', 'amber')}</td></tr>`).join('')}</tbody></table>`) : ''}
      ${card(hist ? 'All orders' : 'Active orders', active ? `<table class="tbl compact"><tbody>${active}</tbody></table>` : empty('No orders'), `<button class="btn xs" data-act="toggleHistory">${hist ? 'Show active only' : 'Show order history'}</button>`)}`;
    const right = locked ? `<div class="notice warn">${icon('warn', 24)}<span>${esc(locked)}</span></div>` : canOrder ? card('New orders', `<input id="orderSearch" class="wide" data-input="orderSearch" placeholder="Search medications, labs, imaging, nursing orders…" value="${esc(E.ui.orderQuery)}" autocomplete="off">
        <div id="orderRes" class="res-list">${V.orderResults(E.ui.orderQuery)}</div>
        <div class="sets"><span class="muted">Order sets:</span> ${E.ORDER_SETS.map((s) => `<button class="btn xs" data-act="setOpen" data-id="${s.id}">${icon('set', 16)}${esc(s.name)}</button>`).join(' ')}</div>
        <h4>Unsigned orders (${p.drafts.length})</h4>
        ${p.drafts.length ? p.drafts.map(V.draft).join('') + `<div class="toolbar"><span class="spacer"></span><button class="btn" data-act="clearDrafts">Remove all</button><button class="btn primary" data-act="signDrafts">${E.can('order.sign') ? 'Sign orders' : 'Pend orders for cosign'}</button></div>` : empty('Search above or open an order set to add orders.')}`)
      : `<div class="notice info">Order entry is not available to the ${esc(E.roleLabel(E.db.user.role))} role in this sim. Log in as a Medical Student or Physician to practice entering orders.</div>`;
    return `<div class="grid2 orders"><div>${left}</div><div>${right}</div></div>`;
  };

  /* ================= Problems & Allergies ================= */
  /* An allergy is never erased. Removing one needs a reason; a student's removal is only a request, and the
     allergy stays in force until a physician approves it. Removed entries stay listed underneath. */
  V.allergyCard = (p) => {
    const live = E.allergiesOf(p), gone = p.allergies.filter((a) => a.status === 'Removed');
    const sev = (a) => chip(a.severity, a.severity === 'High' ? 'red' : a.severity === 'Moderate' ? 'amber' : 'grey');
    const actions = (a) => a.status === 'Removal requested'
      ? (E.can('order.sign') ? `<button class="btn xs" data-act="allergyApprove" data-id="${a.id}">Approve removal</button> <button class="btn xs primary" data-act="allergyKeep" data-id="${a.id}">Keep allergy</button>` : chip('Removal requested', 'amber'))
      : `<button class="btn xs" data-act="allergyRemoveOpen" data-id="${a.id}">Remove…</button>`;
    return card('Allergies and intolerances', (live.length ? `<table class="tbl compact"><thead><tr><th>Agent</th><th>Reaction</th><th>Severity</th><th>Type</th><th></th></tr></thead><tbody>${live.map((a) => `<tr><td><b>${esc(a.agent)}</b>${a.status === 'Removal requested' ? `<div class="fine">Removal requested by ${esc(a.removal.by)}: ${esc(a.removal.reason)}. Still in force until a physician decides.</div>` : ''}</td><td>${esc(a.reaction)}</td><td>${sev(a)}</td><td>${esc(a.type)}</td><td class="nowrap">${actions(a)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No known allergies</div>') +
      (gone.length ? `<h4>Removed from the active list (${gone.length})</h4><table class="tbl compact"><tbody>${gone.map((a) => `<tr class="muted"><td><b>${esc(a.agent)}</b> — ${esc(a.reaction)}<div class="fine">Removed ${E.fmtDT(a.removal.doneTs)} by ${esc(a.removal.doneBy)}${a.removal.by !== a.removal.doneBy ? `, requested by ${esc(a.removal.by)}` : ''}. Reason: ${esc(a.removal.reason)}. ${esc(a.removal.comment)}</div></td><td class="nowrap"><button class="btn xs" data-act="allergyRestore" data-id="${a.id}">Restore</button></td></tr>`).join('')}</tbody></table><p class="fine">Removed entries stay here with who removed them and why.</p>` : ''),
      `<button class="btn xs" data-act="allergyOpen">${icon('add', 16)}Add allergy</button>`);
  };
  E.REMOVE_REASONS = ['Entered in error (wrong patient or wrong agent)', 'Patient has since tolerated this agent', 'Not a true allergy (an expected side effect)', 'Duplicate of another entry'];
  /** What the learner should take away from trying to remove this allergy. */
  E.allergyDebrief = (p, a, outcome) => {
    const cls = (E.ALLERGY_CLASSES.find(([id]) => id === a.cls) || [])[1], lines = [];
    lines.push(outcome === 'requested' ? `Your request is with the physicians. ${a.agent} is still on the active list and still triggers advisories, because a student's change to an allergy is not final until a licensed provider agrees.`
      : outcome === 'removed' ? `${a.agent} is off the active list.${a.cls ? ` Orders for ${cls.toLowerCase()} will no longer raise an allergy advisory for this patient.` : ''} The entry is kept under "Removed from the active list" with your name, the time and your reason.`
      : `${a.agent} stays on the active list.`);
    if (a.verified) lines.push(`Check the evidence before you rely on this change. This chart documents the reaction as ${a.reaction.toLowerCase()} (severity ${a.severity.toLowerCase()}), and the admitting H&P repeats it. ${a.severity === 'High' ? 'A reaction like that is not removed on a hunch: if it is wrong, the next dose could be the one that harms the patient.' : 'Even a mild reaction or intolerance belongs on the list; it changes what gets prescribed.'}`);
    lines.push('In a real record you would: ask the patient or family exactly what happened and when; look for later exposures in the medication history; talk to your supervising physician and, for drug allergies, pharmacy; then correct the entry (for example to an intolerance) rather than erase it.');
    lines.push('Why the record works this way: allergy lists are wrong in both directions, missing true allergies and carrying false ones. So changes need a reason, are attributed and audited, and are never silently deleted.');
    return lines;
  };

  V.act.problems = (p) => `<div class="grid2">
      ${V.allergyCard(p)}
      ${card('Problem list', `<table class="tbl compact"><thead><tr><th>Problem</th><th>Noted</th><th>Status</th><th></th></tr></thead><tbody>${p.problems.map((x) => `<tr class="${x.status === 'Active' ? '' : 'muted'}"><td>${esc(x.name)}</td><td>${E.fmtDate(x.noted)}</td><td>${chip(x.status, x.status === 'Active' ? 'green' : 'grey')}</td><td>${x.status === 'Active' ? `<button class="btn xs" data-act="problemResolve" data-id="${x.id}">Resolve</button>` : ''}</td></tr>`).join('')}</tbody></table>`, `<button class="btn xs" data-act="problemOpen">${icon('add', 16)}Add problem</button>`)}
    </div>`;

  /* ================= Chart Review ================= */
  V.act.review = (p) => {
    const tab = E.ui.crTab, sel = E.ui.crSel;
    const tabs = [['enc', 'Encounters'], ['notes', 'Notes'], ['labs', 'Labs'], ['img', 'Imaging & Procedures'], ['meds', 'Medications']];
    let rows = [], head = [], detail = '';
    const r = (id, cells) => rows.push(`<tr class="${sel === id ? 'sel' : ''}" data-act="crSel" data-id="${id}" tabindex="0">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`);
    if (tab === 'enc') {
      head = ['Date', 'Type', 'Department', 'Provider', 'Diagnosis'];
      const all = [{ id: 'cur', ts: p.admitTs, type: 'Hospital Encounter (current)', dept: p.unit, provider: p.attending, dx: p.dx }].concat(p.encounters);
      all.forEach((e) => r(e.id, [E.fmtDate(e.ts), esc(e.type), esc(e.dept), esc(e.provider), esc(e.dx)]));
      const e = all.find((x) => x.id === sel);
      if (e) detail = `<h3>${esc(e.type)}</h3><dl class="kv wide"><dt>Date</dt><dd>${E.fmtDate(e.ts)}</dd><dt>Department</dt><dd>${esc(e.dept)}</dd><dt>Provider</dt><dd>${esc(e.provider)}</dd><dt>Diagnosis</dt><dd>${esc(e.dx)}</dd></dl>${e.id === 'cur' ? '<p class="muted">Current admission. Use the activity tabs above to review it.</p>' : '<p class="muted">Outside this sim encounter. Only the visit summary is available.</p>'}`;
    } else if (tab === 'notes') {
      head = ['Date', 'Type', 'Author', 'Status'];
      [...p.notes].sort((a, b) => b.ts - a.ts).forEach((n) => r(n.id, [E.fmtDT(n.ts), esc(n.type), esc(n.author), statusChip(n.status)]));
      const n = p.notes.find((x) => x.id === sel); if (n) detail = V.noteDoc(p, n);
    } else if (tab === 'labs') {
      head = ['Collected', 'Tests', 'Abnormal'];
      [...p.labs].sort((a, b) => b.ts - a.ts).forEach((l) => { const ab = Object.keys(l.values).filter((k) => E.flag(k, l.values[k])).length; r(l.id, [E.fmtDT(l.ts), esc(l.name), ab ? chip(ab + ' abnormal', 'red') : '']); });
      const l = p.labs.find((x) => x.id === sel); if (l) detail = `<h3>${esc(l.name)}</h3><div class="muted">Collected ${E.fmtDT(l.ts)} · Final</div>${V.labTable(p, [l])}`;
    } else if (tab === 'img') {
      head = ['Date', 'Study', 'Category', 'Status'];
      [...p.reports].sort((a, b) => b.ts - a.ts).forEach((x) => r(x.id, [E.fmtDT(x.ts), esc(x.name), esc(x.kind), esc(x.status)]));
      const x = p.reports.find((y) => y.id === sel); if (x) detail = `<h3>${esc(x.name)}</h3><div class="muted">${E.fmtDT(x.ts)} · ${esc(x.by)} · ${esc(x.status)}</div><pre class="doc">${esc(x.text)}</pre>`;
    } else {
      head = ['Ordered', 'Medication', 'Details', 'Status'];
      p.orders.filter((o) => o.type === 'med').sort((a, b) => b.ts - a.ts).forEach((o) => r(o.id, [E.fmtDT(o.ts), esc(o.name), esc(E.orderDetail(o)), statusChip(o.status)]));
      const o = p.orders.find((x) => x.id === sel);
      if (o) { const adm = p.mar.filter((a) => a.orderId === o.id).sort((a, b) => b.ts - a.ts).slice(0, 12); detail = `<h3>${esc(o.name)}</h3><div class="muted">${esc(E.orderDetail(o))} · ordered by ${esc(o.by)}</div><h4>Recent administrations</h4>${adm.length ? `<table class="tbl compact"><tbody>${adm.map((a) => `<tr><td>${E.fmtDT(a.ts)}</td><td>${esc(a.action)}</td><td>${esc(a.dose || '')}</td><td class="muted">${esc(a.by)}</td></tr>`).join('')}</tbody></table>` : empty('None documented')}`; }
    }
    return `<div class="subtabs">${tabs.map(([id, l]) => `<button class="${tab === id ? 'on' : ''}" data-act="crTab" data-id="${id}">${l}</button>`).join('')}</div>
      <div class="split"><div class="pane"><table class="tbl compact hover"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="muted">Nothing to show</td></tr>`}</tbody></table></div>
      <div class="pane">${detail || empty('Select a row to preview it here.')}</div></div>`;
  };

  /* ================= Inbox ================= */
  /* The Inbox, laid out like Epic's In Basket: folders with unread counts on the left, the folder's messages
     as a table, and the open message underneath with its actions and the patient it is about. */
  const FOLDERS = [['all', 'All messages', () => true, 'inbox'], ['Page', 'Pages', (x) => x.type === 'Page', 'alert'], ['Result', 'Results', (x) => x.type === 'Result', 'results'],
    ['Cosign', 'Cosign', (x) => x.type.startsWith('Cosign'), 'orders'], ['Patient Message', 'Patient messages', (x) => x.type === 'Patient Message', 'user'],
    ['Staff', 'Staff messages', (x) => !['Page', 'Result', 'Patient Message'].includes(x.type) && !x.type.startsWith('Cosign'), 'notes']];
  V.inbox = () => {
    const all = E.myInbox().sort((a, b) => b.ts - a.ts), m = all.find((x) => x.id === E.ui.inboxSel);
    let f = FOLDERS.find((x) => x[0] === E.ui.inboxFolder) || FOLDERS[0];
    if (m && !f[2](m)) f = FOLDERS[0];   // a message opened from elsewhere is always shown
    const list = all.filter(f[2]), p = m && m.patientId && E.pt(m.patientId);
    const tone = (x) => (x.critical ? 'red' : x.type === 'Result' ? 'blue' : x.type === 'Patient Message' ? 'purple' : x.type.startsWith('Cosign') ? 'amber' : 'grey');
    const folders = FOLDERS.map(([id, label, test, g]) => { const mine = all.filter(test), un = mine.filter((x) => !x.read).length; return id !== 'all' && !mine.length ? '' : `<button class="ib-f${f[0] === id ? ' on' : ''}${un ? ' un' : ''}" data-act="inboxFolder" data-id="${id}">${icon(g, 16)}<span>${label}</span><i>${un ? un : mine.length}</i></button>`; }).join('');
    const rows = list.map((x) => { const q = x.patientId && E.pt(x.patientId); return `<button class="list-row ib-row${m && m.id === x.id ? ' sel' : ''}${x.read ? '' : ' unread'}" data-act="inboxSel" data-id="${x.id}"><i class="ib-dot" title="${x.read ? 'Read' : 'Unread'}"></i><span class="ib-type">${chip(x.type, tone(x))}</span><b>${x.critical ? '<em class="ib-crit" title="Critical">!</em>' : ''}${esc(x.subject)}</b><span class="ib-pt">${q ? esc(q.name) : ''}</span><span class="ib-from">${esc(x.from)}</span><span class="ib-ts">${E.fmtDT(x.ts)}</span></button>`; }).join('');
    const read = m ? `<div class="ib-bar"><button class="btn xs" data-act="inboxDone" data-id="${m.id}" title="Remove this message from your Inbox">${icon('check', 16)}Done</button>${p ? `<button class="btn primary xs" data-act="inboxChart" data-id="${m.id}">Open chart: ${esc(p.name)}</button>` : ''}${p && m.thread ? `<button class="btn xs" data-act="msgPop" data-id="${m.id}" title="Open the chart with this conversation in a window over it">Pop out over chart</button>` : ''}<span class="spacer"></span>${p ? `<span class="ib-who">${icon('user', 16)}<b>${esc(p.name)}</b> ${E.age(p.dob)} ${esc(p.sex)} · MRN ${esc(p.mrn)} · ${esc(p.bed)}</span>` : ''}</div>
        <div class="ib-msg"><div class="doc-h"><div><h3>${esc(m.subject)}</h3><div class="muted">${esc(m.type)} · from ${esc(m.from)} · ${E.fmtDT(m.ts)}</div></div></div>${m.thread ? V.thread(m, p) : `<pre class="doc">${esc(m.body)}</pre>`}</div>`
      : `<div class="ib-none">${icon('inbox', 48)}<p>${list.length ? 'Select a message.' : 'Nothing here. Enjoy it while it lasts.'}</p></div>`;
    return `<div class="page ib"><aside class="ib-folders"><h2>Inbox</h2><h5>My messages</h5>${folders}</aside>
      <section class="ib-main"><div class="ib-list"><div class="ib-head"><i></i><span>Type</span><span>Subject</span><span>Patient</span><span>From</span><span>Received</span></div>${rows || empty('No messages')}</div>
      <div class="ib-read">${read}</div></section>${p ? V.notePane(p) : ''}</div>`;
  };
  /* The patient conversation, as an instant-messenger window of the era: name-and-time lines in a log, a buddy
     icon, "is typing…" before each reply, and a reply box offering four numbered replies (keys 1 to 4). Replies
     are picked, not typed, because nothing here reads free text. */
  E.typeMs = (text) => Math.min(2600, 700 + String(text).length * 12);   // how long "is typing…" shows before a reply
  /** The conversation floating over a chart (opened with Message patient in the sidebar). Minimised, it is a tab. */
  V.chatFloat = (p) => {
    const c = E.ui.chat; if (!c || c.pid !== p.id) return '';
    const m = E.db.inbox.find((x) => x.type === 'Patient Message' && x.patientId === p.id && x.thread); if (!m) return '';
    const fn = p.name.split(', ')[1] || p.name, typing = E.ui.typing && E.ui.typing.mid === m.id;
    if (c.min) return `<button class="im-tab" data-act="chatMin" title="Show the conversation">${icon('inbox', 16)}${esc(fn)}${typing ? ' is typing…' : ''}</button>`;
    const pos = c.x != null ? ` style="left:${c.x}px;top:${c.y}px;bottom:auto"` : '';
    return `<div class="im-float"${pos} role="dialog" aria-label="Conversation with ${esc(fn)}">${V.thread(m, p, true)}</div>`;
  };
  V.thread = (m, p, float) => {
    const iv = E.interview(p), asked = m.asked || [], fn = p.name.split(', ')[1] || p.name, th = m.thread, last = th[th.length - 1];
    const ty = E.ui.typing && E.ui.typing.mid === m.id && last && last.who === 'patient' ? E.ui.typing : null;
    const waiting = !!ty && Date.now() - ty.start < E.typeMs(last.text), shown = waiting ? th.slice(0, -1) : th;
    const open = iv.filter((x) => !asked.includes(x.i)), pick = open.slice(0, 4).concat(iv.filter((x) => asked.includes(x.i)).slice(0, Math.max(0, 4 - open.length)));
    const initials = p.name.split(', ').reverse().map((s) => s[0]).join(''), seen = shown[shown.length - 1];
    const line = (t) => `<div class="im-line ${t.who === 'you' ? 'you' : 'pt'}"><span class="im-who">${t.who === 'you' ? 'You' : esc(fn)} <span class="im-ts">(${E.fmtTime(t.ts)})</span>:</span> ${esc(t.text)}</div>`;
    return `<div class="im">
        <div class="im-bar"${float ? ' title="Drag to move"' : ''}>${icon('inbox', 16)}<b>Conversation with ${esc(fn)} ${esc(p.name.split(', ')[0])}</b>${float ? '<span class="im-ctl"><button data-act="chatMin" title="Minimise" aria-label="Minimise">_</button><button class="x" data-act="chatClose" title="Close" aria-label="Close">×</button></span>' : '<span>Patient portal</span>'}</div>
        <div class="im-body">
          <div class="im-log" id="threadLog" data-act="typeSkip" aria-live="polite">${shown.length ? shown.map(line).join('') : `<div class="im-sys">${esc(fn)} has signed on. Choose a reply below to start the conversation.</div>`}</div>
          <aside class="im-buddy" aria-hidden="true"><div class="im-face">${esc(initials)}</div><b>${esc(fn)}</b><span class="im-on">Online</span></aside>
        </div>
        <div class="im-status">${waiting ? `<i class="im-pen"></i>${esc(fn)} is typing…` : seen ? `Last message received at ${E.fmtTime(seen.ts)}.` : '&nbsp;'}</div>
        <div class="im-compose"><div class="im-compose-h"><b>Choose a reply</b><span class="fine">${open.length ? `Press 1 to 4, or click · ${open.length} not yet asked` : 'You have asked everything. Write up what you learned in a note.'}</span></div>
          <ol class="im-opts" aria-label="Choose a reply">${pick.map((x, k) => { const was = asked.includes(x.i); return `<li><button class="im-opt${was ? ' asked' : ''}" data-act="msgAsk" data-id="${m.id}" data-i="${x.i}"${waiting ? ' disabled' : ''}><kbd>${k + 1}</kbd><span>${esc(x.q)}</span>${was ? icon('check', 16) : ''}</button></li>`; }).join('')}</ol></div>
      </div>${float ? '' : `
      <p class="fine">Simulated patient; any resemblance to a real person is a coincidence.</p>`}`;
  };

  /* ================= Activity log ================= */
  V.log = () => `<div class="page"><h2>Activity Log</h2><p class="muted">Like a real EHR, the sim records every chart you open and every action you take.</p>
      <table class="tbl compact"><thead><tr><th>Time</th><th>User</th><th>Role</th><th>Patient</th><th>Action</th></tr></thead><tbody>
      ${E.db.audit.slice(0, 200).map((a) => { const p = a.patientId && E.pt(a.patientId); return `<tr><td class="nowrap">${E.fmtDT(a.ts)}</td><td>${esc(a.user)}</td><td>${esc(E.roleLabel(a.role))}</td><td>${p ? esc(p.name) : ''}</td><td>${esc(a.action)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">No activity yet</td></tr>'}
      </tbody></table></div>`;

  /* ================= Learning ================= */
  /** One knowledge-check question. Options are shown in the learner's own stored order (E.quizOrder) but every
      button carries the ORIGINAL option index, which is what quizAnswer in js/app.js expects. A question missed on
      the first try can be answered again for the Honor Roll badge only; the first answer and its points stand. */
  V.quizItem = (who, q, own, n, of) => {
    const a = who.quiz[q.id], done = a != null, right = done && a === q.answer, order = E.quizOrder(who, q);
    const fixed = done && !right && E.quizRetryRight(who, q), retrying = own && done && !right && !fixed && E.ui.quizRetry === q.id;
    const last = who.quizRetry && who.quizRetry[q.id], triedAgain = done && !right && !fixed && last && typeof last === 'object' && last.first === a;
    const shown = retrying ? order.slice(1).concat(order.slice(0, 1)) : order;   // a retry is not answered by position
    const opt = (j) => (retrying
      ? `<button class="qopt" data-qretry="${q.id}" data-i="${j}">${esc(q.options[j])}</button>`
      : `<button class="qopt${done && j === q.answer ? ' right' : ''}${done && j === a && !right ? ' wrong' : ''}" data-act="quizAnswer" data-q="${q.id}" data-i="${j}"${done || !own ? ' disabled' : ''}>${done && j === q.answer ? '<i class="mk" aria-hidden="true">✓</i>' : done && j === a && !right ? '<i class="mk" aria-hidden="true">✗</i>' : ''}${esc(q.options[j])}${done && j === q.answer ? '<span class="sr"> (the right answer)</span>' : done && j === a && !right ? '<span class="sr"> (your answer)</span>' : ''}</button>`);
    const again = done && !right ? (fixed
      ? `<p class="retry ok">${icon('check', 16)}<span>Put right on a second try.</span></p>`
      : retrying ? ''
      : own ? `<p class="retry">${triedAgain ? '<span>Not right on the second try either.</span> ' : ''}<button class="btn xs" data-qretry-open="${q.id}" title="For the Honor Roll badge. The points for your first answer stay as they are.">Answer again</button></p>` : '') : '';
    const st = !done || retrying ? '' : right ? '<span class="chip green">Correct</span>' : fixed ? '<span class="chip green">Put right</span>' : '<span class="chip red">Missed</span>';
    return `<div class="quiz${done && !retrying ? (right ? ' is-right' : ' is-wrong') : ''}"><div class="quiz-h">${icon('learning', 16)}<b>${n ? `Question ${n} of ${of}` : 'Question'}</b>${st}</div><p class="quiz-q">${esc(q.q)}</p><div class="quiz-opts" role="group" aria-label="Answer choices">${shown.map(opt).join('')}</div>${done && !retrying ? `<div class="why ${right ? 'ok' : 'no'}"><b>${right ? 'Correct.' : 'Not quite.'}</b> ${esc(q.why)}</div>` : ''}${again}</div>`;
  };
  /* The retry buttons are this file's own (js/app.js has no action for them): open a retry, then answer it. */
  document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest && e.target.closest('[data-qretry], [data-qretry-open]');
    if (!t || t.disabled || !E.db || !E.db.user || !E.app) return;
    if (t.dataset.qretryOpen) { E.ui.quizRetry = t.dataset.qretryOpen; return E.app.render(); }
    const pr = E.progress(), before = E.game(pr), ok = E.quizRetry(pr, t.dataset.qretry, t.dataset.i);
    if (ok == null) return;
    E.ui.quizRetry = null;
    E.audit('Answered a knowledge-check question again, for the badge');
    const got = E.game(pr).earned.filter((id) => !before.earned.includes(id)).map((id) => E.BADGES.find((b) => b.id === id).name);
    if (got.length) {
      E.app.toast(`Right this time. ${got.map((n) => `Badge earned: ${n}.`).join(' ')}`, 'Badge earned', 'medal');
      const b = document.querySelector('#toast > .balloon:last-child'); if (b) b.classList.add('big');   // a milestone
    } else E.app.status(ok ? 'Right this time.' : 'Not right this time either. Read the explanation again.');
    E.app.commit();
  });
  V.learning = () => {
    const mine = E.progress(), all = Object.entries(E.db.progress), instructor = E.db.user.role === 'physician';
    const who = (instructor && E.ui.learnWho && E.db.progress[E.ui.learnWho]) || mine, own = who === mine;
    const s = E.progressSummary(who), g = E.game(who), xp = g.parts;
    const LO_GLYPH = { lo1: 'results', lo2: 'orders', lo3: 'notes', lo4: 'patients', lo5: 'code', lo6: 'problems' };
    // the facts behind the rank line and the XP rows (every row's XP adds up to the total)
    const objDone = s.byLo.filter((b) => b.tasksDone === b.tasks && b.quizAnswered === b.quiz).length;
    const casesGood = (E.CASES || []).filter((cs) => E.caseGood({ cases: { x: (who.cases || {})[cs.id] } })).length;
    const perfect = Object.values(who.games || {}).reduce((n, r) => n + ((r && r.perfect) || 0), 0);
    return `<div class="page learn">
      <div class="doc-h"><div><h2>Learning objectives${own ? '' : ` — ${esc(who.name)}`}</h2><p class="muted">Objectives are mapped to the ${esc(E.EPA_SOURCE)}. The objectives, tasks and questions were written for this sim and have not been reviewed or endorsed by the AAMC.</p></div>
        <div class="noprint"><button class="btn" data-act="learnPrint">${icon('print', 24)}Print report</button> <button class="btn" data-act="learnExport">${icon('save', 24)}Download report</button>${own ? ` <button class="btn" data-act="progressAsk">${icon('reset', 24)}Reset my progress</button>` : ''}</div></div>
      <div class="rank">
        <div class="rank-medal">${icon(g.next ? 'star' : 'trophy', 104)}</div>
        <div class="rank-main"><div class="rank-lv">Level ${g.level} of ${E.LEVELS.length}</div><div class="rank-title">${esc(g.title)}</div>
          <div class="xpbar big" role="img" aria-label="${g.xp} of ${g.max} experience points"><i style="width:${g.pct}%"></i></div>
          <div class="muted">${g.xp} XP${g.next ? (g.need && g.need.blocked ? ` · you have the points for ${esc(g.need.title)}` : ` · ${g.next - g.xp} XP to ${esc(E.LEVELS[g.level][1])}`) : ` · top rank · ${objDone === E.LEARNING.length ? 'every objective complete' : `${objDone} of ${E.LEARNING.length} objectives complete`}`}</div>
          ${g.need ? `<p class="rank-need">${icon(g.need.blocked ? 'warn' : 'info', 24)}<span>${g.need.blocked ? `<b>${esc(g.need.text)}.</b>` : `Next: ${esc(g.need.text)}.`}</span></p>` : ''}
          ${g.confirm.length ? `<p class="rank-need">${icon('info', 24)}<span><b>To confirm:</b> ${g.confirm.map((c) => `${esc(c.todo.toLowerCase())} (${esc(c.title)})`).join('; ')}.</span></p>` : ''}</div>
        <dl class="rank-stats"><dt>Learner</dt><dd>${esc(who.name)}, ${esc(E.roleLabel(who.role))}</dd><dt>Practice tasks</dt><dd>${s.tasksDone} of ${s.tasks} · ${xp.tasks} XP</dd><dt>Knowledge check</dt><dd>${s.quizCorrect} of ${s.quiz} correct · ${xp.quiz} XP</dd><dt>Missions</dt><dd>${E.missionStars(who)} of ${(E.MISSIONS || []).length * 3} stars · ${xp.missions} XP · <a href="#/missions">Missions</a></dd><dt>Proficiency check</dt><dd>${who.exam && who.exam.passed ? `passed, ${who.exam.passedScore} of ${E.EXAM.questions} · ${xp.exam} XP` : `${(who.exam || { attempts: [] }).attempts.length} of ${E.EXAM.attempts} attempts used`}${instructor && !own && who.exam && who.exam.attempts.length ? ` <button class="btn xs" data-act="examReset" data-id="${esc(E.ui.learnWho)}">Reset attempts</button>` : ''}</dd>${V.learnStats ? V.learnStats(who) : ''}
          <dt>Cases</dt><dd>${casesGood} of ${(E.CASES || []).length} with a good ending · ${xp.cases} XP · <a href="#/missions">Cases</a></dd>
          <dt>Mini-games</dt><dd>${perfect} perfect round${perfect === 1 ? '' : 's'} · ${xp.games} XP</dd>${E.pigs(who) ? `<dt>Flying pigs</dt><dd>${E.pigs(who)} caught · ${E.pigs(who) * E.XP.pig >= E.XP.pigMax ? 'maximum bonus reached' : E.pigs(who) * E.XP.pig + ' bonus XP'}</dd>` : ''}
          <dt>Total</dt><dd><b>${g.xp} XP</b></dd></dl>
      </div>
      <div class="badges">${E.BADGES.map((b) => { const got = g.earned.includes(b.id); return `<div class="badge-tile${got ? ' got' : ''}" title="${esc(b.how)}"><span class="badge-art">${icon(b.glyph, 64)}${got ? `<span class="badge-pin">${icon('medal', 32)}</span>` : ''}</span><b>${esc(b.name)}</b><small>${got ? 'Earned' : esc(b.how)}</small></div>`; }).join('')}</div>
      ${V.learnCards ? V.learnCards(who, own) : ''}
      ${instructor && all.length > 1 ? `<div class="card noprint"><header class="card-h"><h3>All learners on this device</h3></header><div class="card-b"><table class="tbl compact hover"><thead><tr><th>Learner</th><th>Role</th><th>Tasks</th><th>Knowledge check</th></tr></thead><tbody>${all.map(([k, pr]) => { const x = E.progressSummary(pr); return `<tr class="${pr === who ? 'sel' : ''}" data-act="learnWho" data-id="${esc(k)}" tabindex="0"><td><b>${esc(pr.name)}</b></td><td>${esc(E.roleLabel(pr.role))}</td><td>${x.tasksDone} / ${x.tasks}</td><td>${x.quizCorrect} / ${x.quiz}</td></tr>`; }).join('')}</tbody></table></div></div>` : ''}
      ${E.LEARNING.map((lo, i) => { const b = s.byLo[i]; return `<section class="card lo"><header class="card-h"><h3>${icon(LO_GLYPH[lo.id], 40)}${chip(lo.epa, 'blue')} ${esc(lo.epaTitle)}</h3><span class="muted">${b.tasksDone}/${b.tasks} tasks · ${b.quizCorrect}/${b.quiz} correct</span></header><div class="card-b">
        <p class="lo-obj">${esc(lo.objective)}</p>
        <ul class="tasks">${lo.tasks.map((t) => { const ts = who.events[t.event]; return `<li class="${ts ? 'done' : ''}"><span class="tick">${ts ? icon('check', 22) : ''}</span><span>${esc(t.text)}${ts ? ` <small class="muted">${E.fmtDT(ts)}</small>` : ''}</span></li>`; }).join('')}</ul>
        <h4 class="quiz-g">Knowledge check</h4>${lo.quiz.map((q, i) => V.quizItem(who, q, own, i + 1, lo.quiz.length)).join('')}
        <div class="rate printonly">Faculty rating and comments: ____________________________________________</div>
      </div></section>`; }).join('')}
      ${(() => { const ev = E.evidence(who); return card('Work samples for faculty review', `<p class="muted">Notes and orders ${own ? 'you have' : 'this learner has'} entered in the sim. Faculty can use these to assess documentation (EPA 5) and order entry (EPA 4).</p>
        <h4>Orders (${ev.orders.length})</h4>${ev.orders.length ? `<table class="tbl compact"><thead><tr><th>Patient</th><th>Order</th><th>Status</th><th>Advisories overridden</th></tr></thead><tbody>${ev.orders.map((o) => `<tr><td>${esc(o.patient)}</td><td><b>${esc(o.order)}</b><div class="muted">${esc(o.details)}</div>${o.attendingFeedback ? `<p class="fb"><b>Attending feedback${o.declinedBy ? ` (${esc(o.declinedBy)})` : ''}:</b> ${esc(o.attendingFeedback)}</p>` : ''}</td><td>${statusChip(o.status)}</td><td>${o.advisoriesOverridden.map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table>` : empty('No orders yet')}
        <h4>Notes (${ev.notes.length})</h4>${ev.notes.length ? ev.notes.map((n) => `<details class="ev-note"><summary><b>${esc(n.type)}</b> — ${esc(n.patient)} ${statusChip(n.status)}${n.attendingFeedback ? ' ' + chip('Feedback', 'blue') : ''}</summary>${n.attendingFeedback ? `<p class="fb"><b>Attending feedback${n.cosignedBy ? ` (${esc(n.cosignedBy)})` : ''}:</b> ${esc(n.attendingFeedback)}</p>` : ''}<pre class="doc">${esc(n.text)}</pre></details>`).join('') : empty('No notes yet')}`); })()}</div>`;
  };

  /* ================= modals ================= */
  const modal = (title, body, foot, cls) => `<div class="modal-bg"><div class="modal ${cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-h">${icon('brand', 16)}<h3>${esc(title)}</h3><button class="cap close" data-act="closeModal" aria-label="Close"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg></button></header><div class="modal-b">${body}</div><footer class="modal-f"><span id="modalErr" class="err"></span>${foot}</footer></div></div>`;
  const cancel = `<button class="btn" data-act="closeModal">Cancel</button>`;
  V.modal = (m) => {
    const p = m.pid && E.pt(m.pid);
    if (m.type === 'confirm') return modal(m.title, `<p>${esc(m.text)}</p>`, `${cancel}<button class="btn ${m.danger ? 'danger' : 'primary'}" data-act="${m.yes}">${esc(m.yesLabel || 'OK')}</button>`, 'sm');
    if (m.type === 'alerts') return modal('Advisories — review before signing', `<p class="muted">Decision support found ${m.alerts.length} issue${m.alerts.length > 1 ? 's' : ''} with the unsigned orders for <b>${esc(p.name)}</b>. Choose an action for each.</p>
        ${m.alerts.map((a) => `<div class="advisory ${a.level}"><div class="adv-h">${icon(a.level === 'high' ? 'alert' : 'warn', 32)}${chip(a.kind, a.level === 'high' ? 'red' : 'amber')}<b>${esc(a.title)}</b></div><div class="adv-o">Order: ${esc(a.orderName)}</div><p>${esc(a.detail)}</p>
          <label>Action <select data-alert="${a.id}"><option value="">— choose —</option><option value="remove">Remove this order</option>${E.OVERRIDE_REASONS.map((r) => `<option value="${esc(r)}">Override: ${esc(r)}</option>`).join('')}</select></label>
          <label class="grow">If you override, the reason in your own words <input data-alert-why="${a.id}" maxlength="200" autocomplete="off"></label></div>`).join('')}`,
      `${cancel}<button class="btn primary" data-act="alertsContinue">Continue</button>`, 'lg');
    if (m.type === 'set') { const s = E.ORDER_SETS.find((x) => x.id === m.id); return modal('Order set: ' + s.name, `<p class="muted">Select the orders to add.</p>${s.items.map(([id, on]) => { const c = E.cat(id); return `<label class="set-item"><input type="checkbox" value="${id}"${on ? ' checked' : ''}><span><b>${esc(c.name)}</b>${c.type === 'med' ? ` <span class="muted">${esc(c.dose)} ${esc(c.route)} ${esc(c.freq)}${c.prn ? ' PRN' : ''}</span>` : ''}</span>${chip(c.group, 'grey')}</label>`; }).join('')}`, `${cancel}<button class="btn primary" data-act="setAdd">Add selected orders</button>`); }
    if (m.type === 'mar') { const o = p.orders.find((x) => x.id === m.orderId); return modal('Medication administration', `<div class="mar-dlg"><b>${esc(o.name)}</b><div>${esc(E.orderDetail(o))}</div><div class="muted">${m.due ? 'Scheduled for ' + E.fmtDT(m.due) : o.prn ? 'PRN dose' : 'Infusion check'} · Patient: ${esc(p.name)} (MRN ${p.mrn})</div></div>
        ${E.allergiesOf(p).length ? `<div class="notice warn">Allergies: ${esc(E.allergiesOf(p).map((a) => a.agent + ' (' + a.reaction + ')').join('; '))}</div>` : ''}
        <div class="scans"><button class="btn scan" data-act="marScan"><i class="barcode"></i><span>Scan patient wristband</span></button><button class="btn scan" data-act="marScan"><i class="barcode"></i><span>Scan medication</span></button></div>
        <div class="fields"><label>Action<select id="marAction"><option>Given</option><option>Held</option><option>Refused</option></select></label><label>Dose<input id="marDose" value="${esc(o.dose)}"></label><label class="grow">Comment (required if held or refused)<input id="marComment" maxlength="200"></label></div>`, `${cancel}<button class="btn primary" data-act="marSave">Accept</button>`); }
    if (m.type === 'vitals') return modal('Record vitals — ' + p.name, `<div class="fields">${[['temp', 'Temp (°C)', 30, 43, 0.1], ['hr', 'Heart rate', 20, 250, 1], ['rr', 'Resp rate', 4, 60, 1], ['sbp', 'Systolic BP', 40, 280, 1], ['dbp', 'Diastolic BP', 20, 180, 1], ['spo2', 'SpO2 (%)', 50, 100, 1], ['pain', 'Pain (0–10)', 0, 10, 1]].map(([k, l, mn, mx, st]) => `<label>${l}<input type="number" data-v="${k}" min="${mn}" max="${mx}" step="${st}"></label>`).join('')}<label>O2 delivery<select data-v="o2">${opts(['Room air', '1 L NC', '2 L NC', '3 L NC', '4 L NC', '6 L NC', 'Venturi mask', 'Non-rebreather', 'High-flow NC', 'BiPAP'], 'Room air')}</select></label></div>`, `${cancel}<button class="btn primary" data-act="vitalsSave">File vitals</button>`);
    if (m.type === 'allergy') return modal('Add allergy — ' + p.name, `<div class="fields"><label class="grow">Agent<input id="alAgent" placeholder="e.g., Amoxicillin" maxlength="80"></label><label>Drug class (drives order checking)<select id="alCls">${E.ALLERGY_CLASSES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label><label class="grow">Reaction<input id="alReaction" placeholder="e.g., Hives" maxlength="80"></label><label>Severity<select id="alSev">${opts(['Low', 'Moderate', 'High'], 'Moderate')}</select></label><label>Type<select id="alType">${opts(['Drug allergy', 'Intolerance', 'Food allergy', 'Environmental'], 'Drug allergy')}</select></label></div>`, `${cancel}<button class="btn primary" data-act="allergySave">Add allergy</button>`);
    if (m.type === 'problem') return modal('Add problem — ' + p.name, `<div class="fields"><label class="grow">Problem<input id="prName" placeholder="e.g., Hypokalemia" maxlength="120"></label></div>`, `${cancel}<button class="btn primary" data-act="problemSave">Add problem</button>`, 'sm');
    if (m.type === 'allergyRemove') { const a = p.allergies.find((x) => x.id === m.id), student = !E.can('order.sign') && !E.can('mar.document'); return modal('Remove allergy — ' + p.name, `
        <div class="advisory ${a.severity === 'High' ? 'high' : ''}"><div class="adv-h">${icon(a.severity === 'High' ? 'alert' : 'warn', 32)}<b>${esc(a.agent)}</b> ${chip(a.severity + ' severity', a.severity === 'High' ? 'red' : 'amber')}</div><p>Documented reaction: ${esc(a.reaction)}. ${esc(a.type)}.</p></div>
        <p>${student ? 'As a student you can ask for this allergy to be removed. It stays active, and keeps protecting the patient, until a physician reviews your reason.' : 'Removing an allergy switches off its advisories for this patient. The entry is kept in the record with your name and reason.'}</p>
        <div class="fields"><label class="grow">Reason (required)<select id="rmReason"><option value="">— choose —</option>${E.REMOVE_REASONS.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>
        <label class="grow">How do you know? (required)<input id="rmComment" maxlength="200" placeholder="e.g., Patient reports taking amoxicillin in 2024 without a reaction"></label></div>`,
      `${cancel}<button class="btn danger" data-act="allergyRemoveSave">${student ? 'Request removal' : 'Remove allergy'}</button>`); }
    if (m.type === 'debrief') return modal('Learning moment', `<div class="debrief">${icon('learning', 48)}<div>${m.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div></div>`, '<button class="btn primary" data-act="closeModal">Got it</button>', 'lg');
    if (m.type === 'call') {
      const stage = m.state === 'live' ? `<iframe class="call-frame" src="${esc(m.url)}" title="Video visit with ${esc(p.name)}" allow="camera; microphone; autoplay; fullscreen; display-capture"></iframe>`
        : `<div class="call-wait"><span class="call-face">${icon('user', 120)}</span><b>${esc(p.name)}</b>${m.state === 'connecting' ? `<span>Calling…</span><div class="xpbar big call-bar" role="progressbar" aria-label="Connecting"><i></i></div>`
            : m.state === 'error' ? `<span class="call-msg">The call could not be connected. ${esc(m.msg)}</span>`
            : `<span class="call-msg">Video visits are not connected on this copy of the sim yet.</span>`}</div>`;
      const side = m.state === 'off' || m.state === 'error' ? `<div class="notice info">${icon('info', 24)}<span>${m.state === 'off' ? 'To turn this on, faculty set a video-visit server address in <code>js/config.js</code>. The file explains what the server needs to do.' : 'Check that the video-visit server in <code>js/config.js</code> is running and allows this page, then try again.'}</span></div>${m.state === 'off' ? `<div class="call-alt"><span>You can message this patient instead.</span><button class="btn" data-act="msgOpen" data-id="${p.id}">${icon('inbox', 16)}Message patient</button></div>` : ''}` : '';
      return modal('Video Visit — ' + p.name, `<div class="call-stage">${stage}</div>${side}
        ${E.db.user.role === 'physician' ? `<details class="call-brief"><summary>Faculty view: what this patient has been told to know (persona brief)</summary><pre class="doc">${esc(E.personaBrief(p))}</pre></details>` : ''}
        <p class="fine">Simulated patient. Any resemblance to a real person is a coincidence, and so is their patience with hold music.</p>`,
        `${m.state === 'error' ? '<button class="btn" data-act="callOpen">Try again</button>' : ''}<button class="btn ${m.state === 'live' || m.state === 'connecting' ? 'danger' : 'primary'}" data-act="callEnd">${m.state === 'live' || m.state === 'connecting' ? 'End call' : 'Close'}</button>`, 'call');
    }
    if (m.type === 'help') {
      // A classic help window: contents on the left (grouped, searchable), one topic on the right, Back / Next below.
      const T = V.helpTopics(), i = Math.max(0, T.findIndex((t) => t.id === m.topic)), t = T[i];
      let grp = '';
      const nav = T.map((x, j) => { const head = x.group !== grp ? `<div class="hp-grp">${esc((grp = x.group))}</div>` : ''; return `${head}<button class="hp-item${j === i ? ' on' : ''}" data-act="helpTopic" data-id="${x.id}" data-find="${esc((x.title + ' ' + x.body.replace(/<[^>]+>/g, ' ')).toLowerCase())}"${j === i ? ' aria-current="true"' : ''}>${esc(x.title)}</button>`; }).join('');
      return modal('Help — SIM+EHR', `<div class="hp"><nav class="hp-nav" aria-label="Help contents"><input class="hp-q" type="search" data-input="helpFind" placeholder="Search help" aria-label="Search help"><div class="hp-list">${nav}<p class="hp-none muted" hidden>No topics match.</p></div></nav>
        <article class="hp-doc" aria-live="polite"><div class="hp-crumb muted">${esc(t.group)}</div><h3>${esc(t.title)}</h3>${t.body}</article></div>`,
        `<span class="fine hp-pos">Topic ${i + 1} of ${T.length}</span><span class="spacer"></span><button class="btn" data-act="helpTopic" data-id="${(T[i - 1] || t).id}"${i ? '' : ' disabled'}>‹ Back</button><button class="btn" data-act="helpTopic" data-id="${(T[i + 1] || t).id}"${i < T.length - 1 ? '' : ' disabled'}>Next ›</button><button class="btn primary" data-act="closeModal">Close</button>`, 'xl');
    }
    if (V.modalExt && V.modalExt[m.type]) return V.modalExt[m.type](m, modal, cancel);
    return '';
  };
  /* ================= Help topics (the Help window reads these in order; group starts a new heading) ================= */
  V.helpTopics = () => {
    const pal = esc(E.pal.name);
    return [
      { id: 'about', group: 'Getting started', title: 'What this is', body: `<p><b>SIM+EHR</b> is the simulation. Inside it you work in <b>Epig</b>, a made-up hospital record (a parody of the systems you will meet on the wards), with ${pal} the flying pig as your guide.</p><p>Every patient is fictional. Nothing you do here reaches a real chart.</p><p class="fine">This sim is an independent teaching tool. It is not affiliated with or endorsed by Epic Systems Corporation, and it is not for clinical use.</p>` },
      { id: 'first', group: 'Getting started', title: 'Where to start', body: `<ol><li>Open <b>Learning</b> in the toolbar. It lists the objectives, the practice tasks for each one and a short knowledge check.</li><li>Open a patient from <b>Patient Lists</b> and work through the tasks. They are checked off on their own as you do them.</li><li>When you are ready, open <b>Missions</b> and follow the card at the top. It always points at the next thing to try: single-patient missions first, then mini-games, shifts, cases and the proficiency check.</li></ol>` },
      { id: 'roles', group: 'Getting started', title: 'Roles and logging in', body: `<ul>${Object.values(E.ROLES).map((r) => `<li><b>${esc(r.label)}:</b> ${esc(r.desc)}</li>`).join('')}</ul><p>Log out and back in to switch roles, for example to cosign your own student orders as a physician.</p>` },
      { id: 'lists', group: 'The chart', title: 'Patient lists and tabs', body: `<p><b>Patient Lists</b> shows the census. Select a patient to open the chart. Open charts stay as tabs under the toolbar, so you can move between patients.</p>` },
      { id: 'layout', group: 'The chart', title: 'Sidebar and activities', body: `<p>The left <b>sidebar</b> of a chart always shows identity, code status, allergies and the latest vitals.</p><p>The activity tabs across the top of the chart: Summary, Chart Review, Results, Flowsheets, MAR, Notes, Orders, and Problems &amp; Allergies.</p>` },
      { id: 'results', group: 'The chart', title: 'Results and the Inbox', body: `<p>Lab and imaging orders result on their own about 15 to 25 seconds after they are signed, and a message arrives in the <b>Inbox</b>. Critical results and pages are marked as urgent.</p><p><b>Message patient</b> in the chart sidebar opens a message thread with the patient in your Inbox. <b>Call patient</b> is for video visits.</p>` },
      { id: 'orders', group: 'Orders and notes', title: 'Placing orders', body: `<p>Search the catalog in <b>Orders</b>, or start from an order set, then sign. Advisories warn about allergies, interactions and doses; you can override one with a reason.</p><p>As a medical student your orders are <b>pended</b>: they take effect only after a physician reviews and cosigns them.</p>` },
      { id: 'notes', group: 'Orders and notes', title: 'Reading and writing notes', body: `<p>Notes are read and written in the <b>note pane</b> on the right of the chart. Its <b>Notes</b> tab shows the chart's notes; <b>My Note</b> is where you write. The pane stays open while you move around the chart, so you can write from what is in front of you.</p><p>The Notes activity lists every note: click one to open it in the pane.</p><p>Student notes need a cosign once signed.</p>` },
      { id: 'smart', group: 'Orders and notes', title: 'Dot phrases and blanks', body: `<p>Type a dot phrase followed by a space to pull data into a note: <code>.vitals</code>, <code>.labs</code>, <code>.meds</code>. The <b>Insert SmartText</b> list has them all.</p><p>Templates leave <code>***</code> blanks. Press <b>F2</b> to jump to the next one and <b>Shift+F2</b> for the previous. A note with blanks left cannot be signed.</p>` },
      { id: 'learning', group: 'Learning and missions', title: 'Learning, XP and badges', body: `<p><b>Learning</b> tracks your practice tasks, knowledge-check answers, XP, level and badges.</p><p>The upper ranks need more than points. Sub-Intern needs one shift passed, Acting Intern one case with a good ending, and Ready for the Wards the proficiency check. The level widget in the banner says what is missing. Points are never taken away, and your best result on each mission, shift and case is the one that counts.</p><p><b>Scoring.</b> Mission: bronze for every objective, silver for ordering nothing unsafe, gold for every bonus. Shift: Honors is 90% or more with nobody harmed, and a pass is 70%. Case: three stars is a good outcome with 85% or more of the points and no harm, two is a good outcome, one a rocky course. Mini-games and the remediation round are not timed.</p><p>A knowledge-check question missed on the first try can be answered again for the Honor Roll badge. The points for the first answer stay as they are.</p><p>The speaker button beside the level widget turns every sound in the sim off or on.</p><p><b>Reset your progress</b> on that page starts you over completely, including your safety record. The proficiency check record is kept.</p>` },
      { id: 'missions', group: 'Learning and missions', title: 'Shifts, missions and cases', body: `<p><b>Missions</b> is laid out easiest first: a card with your next step, the single-patient missions, the mini-games, the shifts (a whole day on the ward against a clock you can pause), the PBL cases and the proficiency check. One shift, mission or case runs at a time.</p><p>In a shift, pages arrive in groups: deal with the most urgent one first. Safety events that happen outside a shift, mission or case are marked as practice and are reported separately.</p>` },
      { id: 'safety', group: 'Learning and missions', title: 'Harm and the safety record', body: `<p>A harmful order that reaches a patient is a <b>harm event</b>; one stopped before it reaches them is a <b>near miss</b>. One harm event brings a page, two mean a short debrief before more orders, and three suspend your ordering privileges until you pass a remediation round.</p>` },
      { id: 'pal', group: 'Help and reference', title: `${pal} the guide`, body: `<ul><li>${pal} is the flying pig in the bottom-right corner. Click it for a tip about the screen you are on. It moves up the edge of the window when it would cover a button.</li><li>"Put ${pal} away" in its balloon hides it. A small <b>${pal}</b> tab stays in the corner: click that to bring it back.</li></ul>` },
      { id: 'keys', group: 'Help and reference', title: 'Keyboard shortcuts', body: `<table class="tbl compact"><tbody><tr><td><kbd>F2</kbd> / <kbd>Shift+F2</kbd></td><td>Next / previous *** blank in a note</td></tr><tr><td><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd></td><td>Undo / redo in a note</td></tr><tr><td><kbd>Esc</kbd></td><td>Close a dialog</td></tr><tr><td><kbd>Tab</kbd></td><td>Move between controls (it stays inside an open dialog)</td></tr><tr><td><kbd>Enter</kbd></td><td>Open the selected row in a list</td></tr></tbody></table>` },
      { id: 'epic', group: 'Help and reference', title: 'Sim terms and Epic terms', body: `<table class="tbl compact"><thead><tr><th>In this sim</th><th>Similar concept in Epic</th></tr></thead><tbody><tr><td>Chart sidebar</td><td>Storyboard</td></tr><tr><td>Dot phrases (.vitals)</td><td>SmartPhrases / SmartLinks</td></tr><tr><td>*** placeholders, F2</td><td>Wildcards, F2</td></tr><tr><td>Order sets</td><td>Order Sets / SmartSets</td></tr><tr><td>Advisories</td><td>Best Practice Advisories and medication warnings</td></tr><tr><td>Inbox</td><td>In Basket</td></tr><tr><td>Pended orders, cosign</td><td>Pended orders, cosign</td></tr><tr><td>Activity Log</td><td>Access audit trail</td></tr></tbody></table>` },
    ];
  };
  V.h = { card, chip, empty, pane };   // shared with js/missions.js
})();
