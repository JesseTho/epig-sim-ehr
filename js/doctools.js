/* SIM+EHR Student Edition — documentation tools (EPA 5): the learner's own phrases, pick-lists in templates, and
   copying a progress note forward with a review of every section. Plan: docs/lo-improvements-plan.md, item B4.

   The note editor is a plain textarea (js/views.js V.notePane, js/app.js noteText and nextBlank). This file adds:
   - E.nextBlankAt: the next *** or pick-list, used by F2 and the arrow buttons;
   - V.blankBar: the line above the editor, which now also offers a pick-list's choices and the copied sections;
   - the phrase, pick and copy actions (E.docActions, merged into the app's actions). */
(function () {
  const E = window.EHR, V = E.V, esc = (s) => E.esc(s), icon = (n, s) => E.icon(n, s);

  /* ---------- blanks and pick-lists ---------- */
  // {stable|watcher|unstable}: two or more choices in single braces. {{name}} template links are already gone by then.
  const PICK = /\{([^{}|\n]+(?:\|[^{}|\n]+)+)\}/g;
  E.blanksIn = (t) => ({ stars: (String(t).match(/\*\*\*/g) || []).length, picks: (String(t).match(PICK) || []).length });
  /** Every blank in the text, in order: { i, len, options (null for ***) }. */
  const blanks = (t) => {
    const out = [];
    let m; const s = String(t), re = /\*\*\*/g;
    while ((m = re.exec(s))) out.push({ i: m.index, len: 3, options: null });
    PICK.lastIndex = 0;
    while ((m = PICK.exec(s))) out.push({ i: m.index, len: m[0].length, options: m[1].split('|').map((x) => x.trim()) });
    return out.sort((a, b) => a.i - b.i);
  };
  /** The next blank at or after `from` (the one before it when `back`), wrapping round; null when there is none. */
  E.nextBlankAt = (t, from, back) => {
    const all = blanks(t); if (!all.length) return null;
    if (back) { const before = all.filter((b) => b.i < from); return before.length ? before[before.length - 1] : all[all.length - 1]; }
    return all.find((b) => b.i >= from) || all[0];
  };

  /* ---------- the learner's own phrases ---------- */
  const MAX = 40, NAME = /^[a-z]{2,20}$/;
  const phrases = () => { const pr = E.progress(); if (!pr.phrases || typeof pr.phrases !== 'object') pr.phrases = {}; return pr.phrases; };
  /** A phrase of the learner's, with its {{links}} filled in for this patient; null if they have none by that name. */
  E.phraseFor = (name, p) => { const t = (E.progress().phrases || {})[String(name).toLowerCase()]; return t == null ? null : E.expandTemplate(t, p); };
  V.phraseOptions = () => { const names = Object.keys(E.progress().phrases || {}).sort(); return names.length ? `<optgroup label="My phrases">${names.map((k) => `<option value="my:${esc(k)}">.${esc(k)}</option>`).join('')}</optgroup>` : ''; };

  /* ---------- copy forward ---------- */
  const HEAD = /^([A-Z][A-Z0-9 &/()-]{0,40}):/;
  /** A note split at its capital-letter headings ("S:", "OBJECTIVE:", "A/P:"): [{ head, text }]. Text before the first
      heading has the head ''. */
  E.noteSections = (text) => {
    const out = []; let cur = { head: '', lines: [] };
    String(text).split('\n').forEach((l) => { const m = l.match(HEAD); if (m) { out.push(cur); cur = { head: m[1], lines: [l] }; } else cur.lines.push(l); });
    out.push(cur);
    return out.map((s) => ({ head: s.head, text: s.lines.join('\n').trim() })).filter((s) => s.head || s.text);
  };
  /** Copied sections still to review: not changed since they were copied and not confirmed. */
  E.copyLeft = (d) => {
    if (!d || !d.copied) return [];
    const now = E.noteSections(d.text);
    return d.copied.sections.filter((s) => { const c = now.find((x) => x.head === s.head); return !!c && c.text === s.text && !(d.copied.ok || []).includes(s.head); });
  };
  const lastProgress = (p) => p.notes.filter((n) => n.type === 'Progress Note' && n.status !== 'Draft').sort((a, b) => b.ts - a.ts)[0] || null;

  /* ---------- views ---------- */
  /** The line above the note editor: what is left to fill, a pick-list's choices, and copied sections to review. */
  V.blankBar = (text) => {
    const p = E.app && E.app.curPt ? E.app.curPt() : null, d = p && p.noteDraft, b = E.blanksIn(text);
    const left = d && d.copied ? E.copyLeft(Object.assign({}, d, { text })) : [];
    const pk = E.ui.pick, pickOn = pk && String(text).slice(pk.i, pk.i + pk.len) === `{${pk.options.join('|')}}`;
    const parts = [];
    if (b.stars) parts.push(`<span><b>${b.stars} blank${b.stars > 1 ? 's' : ''} to fill.</b> Each <code>***</code> is waiting for your words: jump to it, then type.</span>`);
    if (b.picks) parts.push(`<span><b>${b.picks} choice${b.picks > 1 ? 's' : ''} to make.</b></span>`);
    if (pickOn) parts.push(`<span class="pick-menu" role="group" aria-label="Choose one">${pk.options.map((o, k) => `<button class="btn xs" data-act="pickChoose" data-i="${k}">${esc(o)}</button>`).join('')}</span>`);
    if (left.length) parts.push(`<span class="copy-left"><b>Copied from ${esc(d.copied.author || 'an earlier note')}, ${E.fmtDT(d.copied.fromTs)}.</b> Still true?${left.map((s) => `<button class="btn xs" data-act="noteConfirm" data-head="${esc(s.head)}">${esc(s.head)}</button>`).join('')}</span>`);
    return parts.length ? parts.join(' ') : `${icon('check', 16)}<span><b>No blanks left.</b> Read it through once, then sign.</span>`;
  };
  /** Buttons under the note toolbar: save a phrase, manage phrases, copy the last progress note. */
  V.noteTools = (p, d) => {
    const last = lastProgress(p), canCopy = d.type === 'Progress Note' && last && !d.copied;
    return `<div class="np-more"><button class="btn xs" data-act="phraseSaveOpen" title="Save the selected text as a phrase of your own">${icon('save', 16)}Save as phrase</button><button class="btn xs" data-act="phrasesOpen">${icon('notes', 16)}My phrases</button>${canCopy ? `<button class="btn xs" data-act="noteCopyForward"${d.pristine ? '' : ' disabled title="Start a new progress note to copy the last one"'}>${icon('review', 16)}Copy last progress note</button>` : ''}</div>`;
  };
  V.modalExt = Object.assign(V.modalExt || {}, {
    phraseSave(m, modal, cancel) {
      return modal('Save as phrase', `<label class="sr-f">Name (letters only; you type it after a dot)<input id="phName" maxlength="20" autocomplete="off" value="${esc(m.name || '')}"></label>
        <label class="sr-f">Text (<code>{{vitals}}</code>, <code>***</code> and <code>{a|b}</code> work here too)<textarea id="phText" rows="6" maxlength="2000">${esc(m.text)}</textarea></label>`,
        `${cancel}<span id="modalErr" class="err"></span><button class="btn primary" data-act="phraseSave">Save</button>`);
    },
    phrases(m, modal, cancel) {
      const all = Object.entries(E.progress().phrases || {}).sort(([a], [b]) => a.localeCompare(b));
      return modal('My phrases', all.length ? all.map(([k, t]) => `<div class="ph-row"><label class="sr-f"><b>.${esc(k)}</b><textarea data-ph="${esc(k)}" rows="3" maxlength="2000">${esc(t)}</textarea></label><button class="btn xs" data-act="phraseDelete" data-id="${esc(k)}">Delete</button></div>`).join('')
        : '<p>No phrases yet. Select text in a note and choose Save as phrase.</p>',
        `${cancel}${all.length ? '<button class="btn primary" data-act="phrasesSave">Save changes</button>' : ''}`, 'lg');
    },
  });

  /* ---------- actions ---------- */
  const $ = (s) => document.querySelector(s);
  const err = (t) => { const el = document.getElementById('modalErr'); if (el) el.textContent = t; };
  const bar = (t) => { const b = document.getElementById('blankBar'); if (b && t) b.innerHTML = V.blankBar(t.value); };
  E.docActions = {
    phraseSaveOpen() {
      const t = $('#noteText'); if (!t) return;
      const sel = t.value.slice(t.selectionStart, t.selectionEnd).trim();
      if (!sel) return E.app.status('Select the text to save first.');
      E.ui.modal = { type: 'phraseSave', text: sel }; E.app.render();
      const n = document.getElementById('phName'); if (n) n.focus();
    },
    phraseSave() {
      const name = (document.getElementById('phName') || {}).value || '', text = ((document.getElementById('phText') || {}).value || '').trim(), k = name.trim().toLowerCase(), all = phrases();
      if (!NAME.test(k)) return err('Use 2 to 20 letters, no spaces.');
      if (E.DOT[k]) return err(`.${k} is a built-in phrase. Choose another name.`);
      if (!all[k] && Object.keys(all).length >= MAX) return err(`You have ${MAX} phrases. Delete one first.`);
      if (!text) return err('The phrase is empty.');
      all[k] = text.slice(0, 2000);
      E.audit(`Saved a personal phrase: .${k}`);
      E.ui.modal = null; E.app.status(`Saved. Type .${k} and a space to use it.`); E.app.commit();
    },
    phrasesOpen() { E.ui.modal = { type: 'phrases' }; E.app.render(); },
    phraseDelete(d) { const all = phrases(); delete all[d.id]; E.audit(`Deleted a personal phrase: .${d.id}`); E.app.commit(); },
    phrasesSave() {
      const all = phrases();
      document.querySelectorAll('textarea[data-ph]').forEach((t) => { const k = t.dataset.ph; if (k in all && t.value.trim()) all[k] = t.value.trim().slice(0, 2000); });
      E.ui.modal = null; E.app.status('Phrases saved.'); E.app.commit();
    },
    pickChoose(d) {
      const t = $('#noteText'), pk = E.ui.pick, o = pk && pk.options[Number(d.i)];
      if (!t || !o || t.value.slice(pk.i, pk.i + pk.len) !== `{${pk.options.join('|')}}`) { E.ui.pick = null; return bar(t); }
      t.value = t.value.slice(0, pk.i) + o + t.value.slice(pk.i + pk.len);
      t.focus(); t.setSelectionRange(pk.i + o.length, pk.i + o.length);
      E.ui.pick = null; E.app.track('note.picklist');
      t.dispatchEvent(new Event('input', { bubbles: true }));   // the editor's own handler saves it, keeps undo and redraws the bar
    },
    noteCopyForward() {
      const p = E.app.curPt(), d = p && p.noteDraft, n = p && lastProgress(p);
      if (!d || !n || d.copied) return;
      if (!d.pristine) return E.app.status('Start a new progress note to copy the last one.');
      Object.assign(d, { text: n.text, pristine: false, copied: { from: n.id, at: Date.now(), fromTs: n.ts, author: n.author, sections: E.noteSections(n.text).filter((s) => s.head), ok: [] } });
      if (E.ui.noteHist) delete E.ui.noteHist[p.id];
      E.audit(`Copied a progress note forward (${n.author}, ${E.fmtDT(n.ts)})`, p.id);
      E.app.commit();
    },
    noteConfirm(dd) {
      const p = E.app.curPt(), d = p && p.noteDraft; if (!d || !d.copied) return;
      if (Date.now() - d.copied.at < 1500) return;   // a section read in less time than that was not read
      if (!d.copied.ok.includes(dd.head)) d.copied.ok.push(dd.head);
      E.save(); bar($('#noteText'));
    },
  };
})();
