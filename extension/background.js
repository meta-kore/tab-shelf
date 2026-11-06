importScripts('store.js');

const SHELF_URL = chrome.runtime.getURL('shelf.html');

// Show the (empty) shelf once after a fresh install so people know where it lives.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: SHELF_URL });
});
const isOurs = u => !!u && u.startsWith(chrome.runtime.getURL(''));
const skip = u => !u || isOurs(u) || u === 'chrome://newtab/' || u === 'about:blank';

async function openShelf(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  const ex = tabs.find(t => (t.url || t.pendingUrl || '').startsWith(SHELF_URL));
  if (ex) { await chrome.tabs.update(ex.id, { active: true }); return ex; }
  return chrome.tabs.create({ windowId, url: SHELF_URL, index: 0, active: true });
}

// Saves first, re-reads storage to confirm, and only then closes anything.
async function save({ mode, name, windowId }) {
  let tabs = mode.startsWith('tab')
    ? await chrome.tabs.query({ active: true, windowId })
    : await chrome.tabs.query({ windowId });
  tabs = tabs.filter(t => !skip(t.url));
  if (!tabs.length) return { ok: false, msg: 'Nothing to save here.' };

  const items = tabs.map(t => ({ id: uid(), title: t.title || t.url, url: t.url }));
  const groups = await getGroups();
  let gid;
  if (mode.startsWith('tab')) {
    let inbox = groups.find(g => g.id === INBOX_ID);
    if (!inbox) { inbox = { id: INBOX_ID, name: 'Single tabs', created: Date.now(), items: [] }; groups.unshift(inbox); }
    inbox.items.unshift(...items);
    inbox.created = Date.now();
    gid = INBOX_ID;
  } else {
    gid = uid();
    groups.unshift({ id: gid, name: name || autoName(items), created: Date.now(), items });
  }
  // keep the newest group on top
  groups.sort((a, b) => b.created - a.created);
  await setGroups(groups);

  const check = await getGroups();
  const g = check.find(x => x.id === gid);
  if (!g || !items.every(i => g.items.some(s => s.id === i.id))) {
    return { ok: false, msg: 'Could not confirm the save, so no tabs were closed.' };
  }

  if (mode.endsWith('close')) {
    const shelf = await openShelf(windowId);
    await chrome.tabs.remove(tabs.filter(t => t.id !== shelf.id).map(t => t.id));
  }
  return { ok: true, msg: `Saved ${items.length} tab${items.length > 1 ? 's' : ''}.` };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'save') { save(msg).then(reply, e => reply({ ok: false, msg: String(e) })); return true; }
  if (msg.type === 'openShelf') { openShelf(msg.windowId).then(() => reply({ ok: true })); return true; }
});
