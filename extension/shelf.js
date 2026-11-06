const $ = s => document.querySelector(s);
const listEl = $('#list');
const searchEl = $('#search');
let groups = [];
let expanded = new Set();
let openMap = {};          // itemId -> tabId (tabs opened from the shelf)
let myTabId = null;
let undoSnapshot = null, toastTimer = null;
let editing = false;

const fmtDate = ms => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
  ', ' + new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const favicon = url => {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', url); u.searchParams.set('size', '32');
  return u.toString();
};

async function load() {
  groups = await getGroups();
  const s = await chrome.storage.local.get('expanded');
  expanded = new Set(s.expanded || groups.slice(0, 3).map(g => g.id));
  openMap = (await chrome.storage.session.get('openMap')).openMap || {};
  // forget tabs that were closed while the shelf wasn't open
  for (const [item, tab] of Object.entries(openMap)) {
    try { await chrome.tabs.get(tab); } catch { delete openMap[item]; }
  }
  await chrome.storage.session.set({ openMap });
  myTabId = (await chrome.tabs.getCurrent())?.id ?? null;
  render();
}

const saveExpanded = () => chrome.storage.local.set({ expanded: [...expanded] });
const saveOpenMap = () => chrome.storage.session.set({ openMap });

async function mutate(fn, toastMsg) {
  const fresh = await getGroups();
  undoSnapshot = JSON.parse(JSON.stringify(fresh));
  fn(fresh);
  await setGroups(fresh.filter(g => g.items.length || g.id === 'inbox'));
  if (toastMsg) toast(toastMsg, true);
}

function toast(msg, withUndo) {
  $('#toastMsg').textContent = msg;
  $('#undo').style.display = withUndo ? '' : 'none';
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').classList.remove('show'); undoSnapshot = null; }, 8000);
}
$('#undo').onclick = async () => {
  if (undoSnapshot) await setGroups(undoSnapshot);
  undoSnapshot = null;
  $('#toast').classList.remove('show');
};

function highlight(el, text, q) {
  el.textContent = '';
  if (!q) { el.textContent = text; return; }
  const lower = text.toLowerCase(); let i = 0, j;
  while ((j = lower.indexOf(q, i)) !== -1) {
    el.append(text.slice(i, j));
    const m = document.createElement('mark'); m.textContent = text.slice(j, j + q.length); el.append(m);
    i = j + q.length;
  }
  el.append(text.slice(i));
}

async function openItem(item, background) {
  const existing = openMap[item.id];
  if (existing != null) {
    try {
      const t = await chrome.tabs.get(existing);
      await chrome.tabs.update(t.id, { active: true });
      await chrome.windows.update(t.windowId, { focused: true });
      return;
    } catch { delete openMap[item.id]; }
  }
  const opts = { url: item.url, active: !background };
  if (myTabId != null) opts.openerTabId = myTabId;   // closing the tab brings you back here
  try {
    const t = await chrome.tabs.create(opts);
    openMap[item.id] = t.id;
    await saveOpenMap();
    render();
  } catch (e) {
    toast(item.url.startsWith('file:')
      ? 'Local files need "Allow access to file URLs" turned on for Tab Shelf in chrome://extensions.'
      : 'Chrome would not open that link: ' + e.message, false);
  }
}

async function closeItem(item) {
  const t = openMap[item.id];
  delete openMap[item.id];
  await saveOpenMap();
  try { await chrome.tabs.remove(t); } catch {}
  render();
}

function render() {
  if (editing) return;
  const q = searchEl.value.trim().toLowerCase();
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const nOpen = Object.keys(openMap).length;
  $('#stats').textContent = `${groups.length} window${groups.length === 1 ? "" : "s"} · ${total.toLocaleString()} tabs` + (nOpen ? ` · ${nOpen} open now` : '');
  listEl.textContent = '';
  let shown = 0;

  for (const g of groups) {
    const items = q ? g.items.filter(i => (i.title + ' ' + i.url).toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) : g.items;
    if (q && !items.length) continue;
    shown++;
    const isOpen = q ? true : expanded.has(g.id);
    const sec = document.createElement('section');
    sec.className = 'group' + (isOpen ? '' : ' collapsed');

    const head = document.createElement('div'); head.className = 'ghead';
    const chev = document.createElement('button'); chev.className = 'chev'; chev.textContent = '▼'; chev.title = 'Show / hide';
    const title = document.createElement('div'); title.className = 'gtitle';
    const name = document.createElement('div'); name.className = 'gname'; name.title = 'Double-click to rename';
    highlight(name, g.name, q);
    const meta = document.createElement('div'); meta.className = 'gmeta';
    meta.textContent = `${g.items.length} tab${g.items.length === 1 ? '' : 's'} · ${fmtDate(g.created)}` + (q ? ` · ${items.length} match${items.length === 1 ? '' : 'es'}` : '');
    title.append(name, meta);

    const toggle = () => {
      if (q) return;
      expanded.has(g.id) ? expanded.delete(g.id) : expanded.add(g.id);
      saveExpanded(); sec.classList.toggle('collapsed');
    };
    chev.onclick = toggle;
    title.onclick = e => { if (name.isContentEditable) return; if (e.detail === 1) setTimeout(() => { if (!name.isContentEditable) toggle(); }, 220); };
    name.ondblclick = e => {
      e.stopPropagation(); editing = true;
      name.textContent = g.name; name.contentEditable = 'true'; name.focus();
      document.getSelection().selectAllChildren(name);
      const finish = async (keep) => {
        name.contentEditable = 'false'; editing = false;
        const v = name.textContent.trim();
        if (keep && v && v !== g.name) await mutate(gs => { gs.find(x => x.id === g.id).name = v; });
        else render();
      };
      name.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); name.blur(); } if (ev.key === 'Escape') { name.onblur = null; finish(false); } };
      name.onblur = () => finish(true);
    };

    const actions = document.createElement('div'); actions.className = 'gactions';
    const openAll = document.createElement('button'); openAll.textContent = `Open all ${g.items.length}`;
    openAll.onclick = async () => { for (const it of g.items) await openItem(it, true); };
    const del = document.createElement('button'); del.textContent = 'Delete'; del.className = 'ghost';
    del.onclick = async () => {
      if (!del.dataset.armed) {
        del.dataset.armed = '1'; del.textContent = 'Confirm delete'; del.className = 'danger';
        setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = 'Delete'; del.className = 'ghost'; } }, 4000);
        return;
      }
      await mutate(gs => { const k = gs.findIndex(x => x.id === g.id); if (k > -1) gs.splice(k, 1); }, `Deleted “${g.name}”`);
    };
    actions.append(openAll, del);
    head.append(chev, title, actions);

    const ol = document.createElement('ol');
    for (const it of items) ol.append(row(g, it, q));

    sec.append(head, ol);
    listEl.append(sec);
  }

  if (!shown) {
    const p = document.createElement('div'); p.className = 'empty';
    p.textContent = q ? 'No saved tabs match that search.' : 'Your shelf is empty. Click the Tab Shelf button in the toolbar to save a window.';
    listEl.append(p);
  } else if (!q) {
    const p = document.createElement('p'); p.className = 'hint';
    p.textContent = 'Click a tab to open it; it stays on the shelf. Ctrl-click opens it in the background. Close it here or in Chrome when you’re done.';
    listEl.append(p);
  }
}

function row(g, it, q) {
  const li = document.createElement('li');
  const isOpen = openMap[it.id] != null;
  if (isOpen) li.className = 'open';
  const img = document.createElement('img'); img.loading = 'lazy'; img.alt = ''; img.src = favicon(it.url);
  const txt = document.createElement('div'); txt.className = 'ltext';
  const a = document.createElement('a'); a.href = it.url; highlight(a, it.title || it.url, q);
  a.onclick = e => { e.preventDefault(); openItem(it, e.ctrlKey || e.metaKey || e.shiftKey); };
  a.onauxclick = e => { if (e.button === 1) { e.preventDefault(); openItem(it, true); } };
  const sub = document.createElement('span'); highlight(sub, hostOf(it.url), q);
  txt.append(a, sub);
  li.append(img, txt);
  if (isOpen) {
    const b = document.createElement('span'); b.className = 'badge'; b.textContent = 'open';
    const c = document.createElement('button'); c.className = 'ibtn'; c.textContent = 'Close tab'; c.onclick = () => closeItem(it);
    li.append(b, c);
  }
  const rm = document.createElement('button'); rm.className = 'ibtn'; rm.textContent = 'Remove'; rm.title = 'Remove from shelf';
  rm.onclick = () => mutate(gs => { const G = gs.find(x => x.id === g.id); G.items = G.items.filter(x => x.id !== it.id); }, 'Removed 1 tab');
  li.append(rm);
  return li;
}

// keep in sync with saves from the toolbar button and tabs closed in Chrome
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && ch.groups) {
    const known = new Set(groups.map(g => g.id));
    groups = ch.groups.newValue || [];
    // newly saved windows show up expanded
    let changed = false;
    for (const g of groups) if (!known.has(g.id)) { expanded.add(g.id); changed = true; }
    if (changed) saveExpanded();
    render();
  }
});
chrome.tabs.onRemoved.addListener(tabId => {
  const k = Object.keys(openMap).find(k => openMap[k] === tabId);
  if (k) { delete openMap[k]; saveOpenMap(); render(); }
});

let st; searchEl.oninput = () => { clearTimeout(st); st = setTimeout(render, 120); };
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== searchEl && !editing) { e.preventDefault(); searchEl.focus(); }
  if (e.key === 'Escape' && document.activeElement === searchEl) { searchEl.value = ''; render(); }
});
$('#expandAll').onclick = () => { expanded = new Set(groups.map(g => g.id)); saveExpanded(); render(); };
$('#collapseAll').onclick = () => { expanded = new Set(); saveExpanded(); render(); };

$('#export').onclick = async () => {
  const data = { app: 'tab-shelf', version: 1, exported: new Date().toISOString(), groups: await getGroups() };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = `tab-shelf-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const incoming = normalizeImport(JSON.parse(await f.text()));
    let added = 0;
    await mutate(gs => {
      const ids = new Set(gs.map(g => g.id));
      for (const g of incoming) if (!ids.has(g.id)) { gs.push(g); added++; }
      gs.sort((a, b) => b.created - a.created);
    });
    toast(added ? `Imported ${added} window${added === 1 ? '' : 's'}` : 'Nothing new — those windows are already on your shelf', !!added);
  } catch (err) { toast('Could not read that file: ' + err.message, false); }
};

load();
