/* SIM+EHR Student Edition — core: namespace, formatting helpers, persistent store, roles.
   Everything lives on window.EHR so the app runs from file:// with no build step. */
(function () {
  const E = (window.EHR = {});
  const KEY = 'ome-ehr-sandbox', BAK = KEY + '-backup', BAD = KEY + '-damaged';
  E.STORE_KEYS = { main: KEY, backup: BAK, damaged: BAD };
  E.HOUR = 3600e3;
  /* Two version numbers, because they mean different things.
     SEED_VERSION: the patient data changed. A save with another number keeps its learners and gets a fresh ward.
     SAVE_VERSION: the shape of what is saved (progress records above all) changed. An older save is brought
     forward one step at a time by E.MIGRATIONS; a newer one is refused, so an old copy of the app never
     half-reads a newer learner's record and then writes over it. */
  E.SEED_VERSION = 3;
  E.SAVE_VERSION = 2;
  const LOG_MAX = 400, NOTES_MAX = 60, ORDERS_MAX = 300, TEXT_MAX = 6000, BACKUP_EVERY = 3 * 60e3;

  /** Pause: shift.js and cases.js push functions that return true while the learner has paused their activity.
      While any says so, the simulated hospital holds still (js/sim.js E.simClock). */
  E.pauseChecks = [];
  E.simPaused = () => E.pauseChecks.some((f) => { try { return f(); } catch (e) { return false; } });
  /** One learner or two? Progress is keyed on the trimmed, lower-cased name, so every comparison uses the same rule. */
  const nameOf = (x) => String(x && typeof x === 'object' ? x.name : x == null ? '' : x).trim().toLowerCase();
  E.sameUser = (a, b) => !!nameOf(a) && nameOf(a) === nameOf(b);
  E.userKey = (name, role) => nameOf(name) + '|' + role;

  E.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  E.uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 10);

  const p2 = (n) => String(n).padStart(2, '0');
  E.fmtDate = (ts) => { const d = new Date(ts); return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${d.getFullYear()}`; };
  E.fmtTime = (ts) => { const d = new Date(ts); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  E.fmtDT = (ts) => { const d = new Date(ts); return `${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${E.fmtTime(ts)}`; };
  E.fmtDob = (dob) => { const [y, m, d] = dob.split('-'); return `${m}/${d}/${y}`; };
  E.age = (dob) => {
    const [y, m, d] = dob.split('-').map(Number);
    const n = new Date();
    let a = n.getFullYear() - y;
    if (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d)) a--;
    return a;
  };
  /** Midnight of today (+ offset days), local time. */
  E.dayStart = (offsetDays) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (offsetDays || 0)); return d.getTime(); };

  /* ---------- roles ---------- */
  E.ROLES = {
    student: { label: 'Medical Student', desc: 'Write notes and pend orders. Both need a physician cosign.', perms: ['order.pend', 'note.write'] },
    physician: { label: 'Physician', desc: 'Sign orders, cosign student work, discontinue orders.', perms: ['order.sign', 'order.dc', 'note.write', 'note.cosign'] },
    nurse: { label: 'Nurse', desc: 'Document medication administration, vitals and nursing notes.', perms: ['mar.document', 'note.write'] },
  };
  E.can = (perm) => !!E.db.user && E.ROLES[E.db.user.role].perms.includes(perm);
  E.roleLabel = (role) => (E.ROLES[role] ? E.ROLES[role].label : role);

  /* ---------- store ---------- */
  E.db = null;
  /* Saving. E.save returns false when the work did not reach storage. The first failure in a run calls
     E.onSaveFail(reason) once (js/app.js shows a notice); it is not repeated on every tick. A copy of the
     previous good save is kept under a second key at most every few minutes, not on every keystroke: the
     blob can be a few hundred KB and the browser allows about 5 MB. */
  let bakAt = 0, failing = false, readOnly = false;
  E.saveStatus = { ok: true, reason: null };
  E.onSaveFail = null;
  E.loadNotice = null;
  const isQuota = (e) => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(e.message || ''));
  function saveFailed(e) {
    const reason = readOnly ? 'newer' : isQuota(e) ? 'full' : 'blocked';
    E.saveStatus = { ok: false, reason, error: e ? e.message : '' };
    if (!failing) { failing = true; console.error('SIM+EHR: work could not be saved (' + reason + ')', e); if (E.onSaveFail) try { E.onSaveFail(reason, e); } catch (x) { console.error(x); } }
    return false;
  }
  /** Parse a stored value; null unless it looks like a save. */
  function parseSave(raw) {
    if (raw == null || raw === '') return null;
    try { const d = JSON.parse(raw); return d && typeof d === 'object' && !Array.isArray(d) && (d.progress || d.patients) ? d : null; } catch (e) { return null; }
  }
  E.save = () => {
    if (!E.db || readOnly) return false;   // readOnly: a newer version's save is in storage and must not be overwritten
    try { E.evidenceSync(); } catch (e) { console.error('SIM+EHR: evidence copy failed', e); }
    let s;
    try { s = JSON.stringify(E.db); } catch (e) { return saveFailed(e); }
    const now = Date.now();
    if (now - bakAt >= BACKUP_EVERY) {
      bakAt = now;
      try { const old = localStorage.getItem(KEY); if (old && old !== s && parseSave(old)) localStorage.setItem(BAK, old); }
      catch (e) { try { localStorage.removeItem(BAK); } catch (x) { /* nothing to free */ } }   // no room for two copies: the live one matters more
    }
    try { localStorage.setItem(KEY, s); }
    catch (e) {
      let ok = false;
      if (isQuota(e)) { try { localStorage.removeItem(BAK); localStorage.setItem(KEY, s); ok = true; } catch (x) { e = x; } }   // full: give up the backup and try once more
      if (!ok) return saveFailed(e);
    }
    failing = false; E.saveStatus = { ok: true, reason: null };
    return true;
  };

  /* Ordered migrations of the saved shape: E.MIGRATIONS[n] turns a version-n save into version n+1. */
  E.MIGRATIONS = {
    // 1 -> 2: flying pigs were counted in pr.bonus and are now pr.pigs. Each learner also gets their own activity
    // log, started from the shared one, so their report no longer depends on the 500-line ward log.
    1: (d) => {
      const prs = d.progress && typeof d.progress === 'object' ? Object.values(d.progress) : [], audit = Array.isArray(d.audit) ? d.audit : [];
      const ptName = (id) => { const p = id && Array.isArray(d.patients) && d.patients.find((x) => x && x.id === id); return p ? p.name : null; };
      prs.forEach((pr) => {
        if (!pr || typeof pr !== 'object') return;
        if (pr.bonus != null) { pr.pigs = Math.max(Number(pr.pigs) || 0, Number(pr.bonus) || 0); delete pr.bonus; }
        if (!Array.isArray(pr.log)) pr.log = audit.filter((a) => a && E.sameUser(a.user, pr.name) && (!a.role || a.role === pr.role)).slice(0, LOG_MAX).map((a) => ({ ts: a.ts, pid: a.patientId || null, patient: ptName(a.patientId), action: a.action }));
      });
    },
  };
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  /** Mend what can be mended in a loaded save so nothing throws later. Returns false if the ward itself is unusable. */
  function repair(d) {
    ['inbox', 'audit', 'openTabs'].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
    if (d.crises != null && !Array.isArray(d.crises)) delete d.crises;
    if (!isObj(d.progress)) d.progress = {};
    Object.keys(d.progress).forEach((k) => {
      const pr = d.progress[k];
      if (!isObj(pr)) return delete d.progress[k];
      const bar = k.lastIndexOf('|');
      if (!E.ROLES[pr.role]) pr.role = k.slice(bar + 1);
      if (typeof pr.name !== 'string' || !pr.name.trim()) pr.name = k.slice(0, bar);
      if (!E.ROLES[pr.role] || !pr.name) return delete d.progress[k];
      if (!isObj(pr.events)) pr.events = {};
      if (!isObj(pr.quiz)) pr.quiz = {};
      if (pr.log != null && !Array.isArray(pr.log)) pr.log = [];
      if (pr.evidence != null && !isObj(pr.evidence)) delete pr.evidence;
    });
    if (d.user && (!isObj(d.user) || typeof d.user.name !== 'string' || !d.user.name.trim() || !E.ROLES[d.user.role])) d.user = null;
    return Array.isArray(d.patients) && d.patients.length > 0 && d.patients.every((p) => isObj(p) && typeof p.id === 'string' && ['orders', 'notes', 'labs', 'vitals', 'allergies', 'problems', 'mar', 'reports', 'drafts'].every((k) => Array.isArray(p[k])));
  }
  const keepDamaged = (raw) => { try { localStorage.setItem(BAD, raw); return true; } catch (e) { return false; } };
  E.load = () => {
    E.loadNotice = null; readOnly = false;
    let raw = null, d = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { saveFailed(e); }
    if (raw != null && raw !== '' && raw !== 'null') {
      d = parseSave(raw);
      if (!d) {
        let bak = null; try { bak = parseSave(localStorage.getItem(BAK)); } catch (e) { /* no backup either */ }
        const kept = keepDamaged(raw);
        if (bak) { d = bak; E.loadNotice = 'Your saved work on this device could not be read, so the last backup was used instead. Work from the last few minutes before that may be missing.'; }
        else E.loadNotice = 'Your saved work on this device could not be read and there was no usable backup, so the sim started fresh.' + (kept ? ' The damaged data was kept on this device in case faculty can recover it.' : '');
      }
    }
    if (d) {
      const sv = Number(d.saveVersion) || 1;
      if (sv > E.SAVE_VERSION) {
        readOnly = true; E.db = E.buildSeed();
        E.loadNotice = 'The work saved on this device comes from a newer version of SIM+EHR. Open that version to carry on. Nothing was changed, and nothing you do in this copy will be saved.';
        return;
      }
      try {
        for (let v = sv; v < E.SAVE_VERSION; v++) E.MIGRATIONS[v](d);
        d.saveVersion = E.SAVE_VERSION;
        const wardOk = repair(d);
        E.db = d;
        if (!wardOk || d.version !== E.SEED_VERSION) rebuildWard(wardOk);   // newer patient data (or a broken ward): keep the learners
      } catch (e) {
        console.error('SIM+EHR: the save could not be brought up to date', e);
        keepDamaged(raw); E.db = null;
        E.loadNotice = 'Your saved work on this device could not be brought up to date, so the sim started fresh. The old data was kept on this device in case faculty can recover it.';
      }
    }
    if (!E.db) E.db = E.buildSeed();
    E.save();
  };
  /** Put the patients back to their starting state, keeping the learners. Activities tied to the old ward end. */
  function rebuildWard(sync) {
    const old = E.db || {};
    if (sync !== false) try { E.evidenceSync(); } catch (e) { console.error('SIM+EHR: evidence copy failed', e); }   // the learners' work outlives the ward
    const d = E.buildSeed();
    d.user = old.user || null; d.progress = old.progress || {}; if (old.prefs) d.prefs = old.prefs;
    E.db = d;
    E.endStaleActivities();
  }
  /** A mission, shift or case runs on patients that no longer exist after a rebuild. End it, for every learner on
      this device, without a result, and say so in the Inbox (which cannot be addressed to one learner). */
  E.endStaleActivities = () => {
    const ended = [];
    Object.values(E.db.progress || {}).forEach((pr) => {
      const a = pr && pr.active;
      if (a && ['mission', 'shift', 'case'].includes(a.type)) { delete pr.active; ended.push(`${pr.name}: ${a.type}`); }
    });
    if (ended.length) E.message({ type: 'Staff Message', from: 'System', subject: 'The ward was reset: activities in progress ended', body: `The patients on this device went back to their starting state, so these could not go on:\n${ended.map((x) => '- ' + x).join('\n')}\n\nThey ended without counting. No result was recorded and nothing was taken off anyone's score. Start them again from Missions.` });
    return ended.length;
  };
  /** Restore the patients to their starting state. The learners and their progress are kept. */
  E.reset = () => { rebuildWard(); E.save(); };
  /** Allergies that are in force: everything not removed. An allergy with a pending removal request still counts. */
  E.allergiesOf = (p) => p.allergies.filter((a) => a.status !== 'Removed');
  E.pt = (id) => E.db.patients.find((p) => p.id === id);
  E.audit = (action, patientId) => {
    const u = E.db.user || { name: 'System', role: '' }, ts = Date.now();
    E.db.audit.unshift({ ts, user: u.name, role: u.role, patientId: patientId || null, action });
    if (E.db.audit.length > 500) E.db.audit.length = 500;
    // the learner's own copy, which a ward reset does not clear: their report reads this one
    if (E.db.user && E.progress) {
      const pr = E.progress(), p = patientId && E.pt(patientId), log = Array.isArray(pr.log) ? pr.log : (pr.log = []);
      log.unshift({ ts, pid: patientId || null, patient: p ? p.name : null, action });
      if (log.length > LOG_MAX) log.length = LOG_MAX;
    }
  };
  /** The activity log for a learner's report, newest first. Names are stored with each line, so a patient who has
      left the ward does not break it. */
  E.activityLog = (pr) => {
    const iso = (t) => new Date(t).toISOString();
    if (Array.isArray(pr.log)) return pr.log.map((a) => ({ time: iso(a.ts), patient: a.patient || null, action: a.action }));
    return E.db.audit.filter((a) => E.sameUser(a.user, pr.name) && a.role === pr.role).map((a) => { const p = a.patientId && E.pt(a.patientId); return { time: iso(a.ts), patient: p ? p.name : null, action: a.action }; });
  };

  /* ---------- durable evidence ----------
     Each learner's signed and pended orders and signed notes are copied into their progress record
     (pr.evidence), and the copy follows later status changes (cosigned, declined, resulted, with any attending
     feedback). A ward reset rebuilds the patients but not these copies, so a report is never emptied. The copy is
     refreshed on every save, so any file that changes an order or note is covered without its own hook. */
  const evOf = (pr) => { const e = isObj(pr.evidence) ? pr.evidence : (pr.evidence = {}); if (!Array.isArray(e.notes)) e.notes = []; if (!Array.isArray(e.orders)) e.orders = []; return e; };
  const orderCopy = (p, o) => ({ id: o.id, pid: p.id, patient: p.name, order: o.name, details: E.orderDetail ? E.orderDetail(o) : '', ts: o.ts, status: o.status, overrides: (o.overrides || []).map((x) => `${x.title} — ${x.reason}`), signedBy: o.signedBy || null, declinedBy: o.declinedBy || null, feedback: o.feedback || null });
  const noteCopy = (p, n) => { const t = String(n.text || ''); return { id: n.id, pid: p.id, patient: p.name, type: n.type, ts: n.ts, status: n.status, cosignedBy: n.cosignedBy || null, text: t.length > TEXT_MAX ? t.slice(0, TEXT_MAX) + '\n[shortened for storage]' : t, feedback: n.feedback || null, source: n.source || null }; };
  E.evidenceSync = () => {
    const db = E.db; if (!db || !isObj(db.progress) || !Array.isArray(db.patients)) return;
    const slots = new Map();
    const slot = (by, role) => {
      const pr = by && db.progress[E.userKey(by, role)]; if (!pr) return null;
      let s = slots.get(pr);
      if (!s) { const ev = evOf(pr); s = { ev, notes: new Map(ev.notes.map((x) => [x.id, x])), orders: new Map(ev.orders.map((x) => [x.id, x])), grew: false }; slots.set(pr, s); }
      return s;
    };
    const put = (s, k, c, max) => {
      const have = s[k].get(c.id); if (have) return Object.assign(have, c);
      const list = s.ev[k];
      if (list.length >= max && c.ts < list[0].ts) return;   // older than everything kept: it was dropped to make room
      list.push(c); s[k].set(c.id, c); s.grew = true;
    };
    db.patients.forEach((p) => {
      if (!p) return;
      (p.orders || []).forEach((o) => { if (!o || !o.id || o.status === 'Draft') return; const s = slot(o.by, o.byRole); if (s) put(s, 'orders', orderCopy(p, o), ORDERS_MAX); });
      (p.notes || []).forEach((n) => { if (!n || !n.id) return; const s = slot(n.author, n.role); if (s) put(s, 'notes', noteCopy(p, n), NOTES_MAX); });
    });
    const trim = (list, max) => { list.sort((a, b) => a.ts - b.ts); if (list.length > max) list.splice(0, list.length - max); };
    slots.forEach((s) => { if (s.grew) { trim(s.ev.notes, NOTES_MAX); trim(s.ev.orders, ORDERS_MAX); } });
  };
  /** Work samples for the Learning page and the report. Field names are those the report has always used. */
  E.evidence = (pr) => {
    try { E.evidenceSync(); } catch (e) { console.error('SIM+EHR: evidence copy failed', e); }
    const ev = isObj(pr.evidence) ? pr.evidence : {}, iso = (t) => new Date(t).toISOString(), byTs = (a, b) => a.ts - b.ts;
    return {
      notes: (ev.notes || []).slice().sort(byTs).map((n) => ({ patient: n.patient, type: n.type, time: iso(n.ts), status: n.status, cosignedBy: n.cosignedBy || null, text: n.text, attendingFeedback: n.feedback || null, startedIn: n.source || null })),
      orders: (ev.orders || []).slice().sort(byTs).map((o) => ({ patient: o.patient, order: o.order, details: o.details, time: iso(o.ts), status: o.status, advisoriesOverridden: o.overrides || [], signedBy: o.signedBy || null, declinedBy: o.declinedBy || null, attendingFeedback: o.feedback || null })),
    };
  };
  E.message = (m) => E.db.inbox.unshift(Object.assign({ id: E.uid('m'), ts: Date.now(), read: false, roles: null, from: 'System' }, m));
})();
