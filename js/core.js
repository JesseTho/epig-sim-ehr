/* SIM+EHR Student Edition — core: namespace, formatting helpers, persistent store, roles.
   Everything lives on window.EHR so the app runs from file:// with no build step. */
(function () {
  const E = (window.EHR = {});
  const KEY = 'ome-ehr-sandbox';
  E.HOUR = 3600e3;
  E.SEED_VERSION = 2;

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
  E.save = () => { try { localStorage.setItem(KEY, JSON.stringify(E.db)); } catch (e) { /* storage unavailable: run in memory */ } };
  E.load = () => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && d.version === E.SEED_VERSION) E.db = d;
      else if (d && d.progress) { E.db = E.buildSeed(); E.db.progress = d.progress; E.db.user = d.user || null; }   // newer patient data: keep the learner
    } catch (e) { /* corrupt or unavailable: reseed */ }
    if (!E.db) E.db = E.buildSeed();
    E.save();
  };
  /** Restore the patients to their starting state. The learner and their progress are kept. */
  E.reset = () => { const { user, progress } = E.db; E.db = E.buildSeed(); E.db.user = user; E.db.progress = progress || {}; E.save(); };
  /** Allergies that are in force: everything not removed. An allergy with a pending removal request still counts. */
  E.allergiesOf = (p) => p.allergies.filter((a) => a.status !== 'Removed');
  E.pt = (id) => E.db.patients.find((p) => p.id === id);
  E.audit = (action, patientId) => {
    const u = E.db.user || { name: 'System', role: '' };
    E.db.audit.unshift({ ts: Date.now(), user: u.name, role: u.role, patientId: patientId || null, action });
    if (E.db.audit.length > 500) E.db.audit.length = 500;
  };
  E.message = (m) => E.db.inbox.unshift(Object.assign({ id: E.uid('m'), ts: Date.now(), read: false, roles: null, from: 'System' }, m));
})();
