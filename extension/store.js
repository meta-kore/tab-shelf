// Shared storage helpers (used by background, popup and shelf page).
const GROUPS_KEY = 'groups';
const INBOX_ID = 'inbox';

async function getGroups() {
  const r = await chrome.storage.local.get(GROUPS_KEY);
  return r[GROUPS_KEY] || [];
}
async function setGroups(groups) {
  await chrome.storage.local.set({ [GROUPS_KEY]: groups });
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const GENERIC = new Set(['Google', 'Youtube', 'Chrome', 'File', 'Localhost', 'Claude', '127']);
const SLD = new Set(['co', 'com', 'ac', 'or', 'go', 'gov', 'org', 'net']);

function labelOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return 'File';
    if (u.protocol === 'chrome:' || u.protocol === 'chrome-extension:') return 'Chrome';
    const parts = u.hostname.replace(/^www\./, '').split('.');
    let l = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (SLD.has(l) && parts.length >= 3) l = parts[parts.length - 3];
    if (l === 'x') return 'X';
    return l.charAt(0).toUpperCase() + l.slice(1);
  } catch { return ''; }
}

function autoName(items) {
  const count = new Map(), first = new Map();
  items.forEach((it, i) => {
    const l = labelOf(it.url);
    if (!l) return;
    count.set(l, (count.get(l) || 0) + 1);
    if (!first.has(l)) first.set(l, i);
  });
  const labels = [...count.keys()].sort((a, b) =>
    (GENERIC.has(a) - GENERIC.has(b)) || (count.get(b) - count.get(a)) || (first.get(a) - first.get(b)));
  const top = labels.slice(0, 3);
  if (!top.length) return 'Saved tabs';
  return top.join(', ') + (labels.length > 3 ? ` +${labels.length - 3} more` : '');
}

function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return 'Local file';
    return u.hostname.replace(/^www\./, '') || u.protocol.replace(':', '');
  } catch { return url; }
}

// Turn any supported backup format into shelf groups.
function normalizeImport(data) {
  let list;
  if (data && Array.isArray(data.groups)) list = data.groups;
  else if (Array.isArray(data)) list = data;
  else if (data && Array.isArray(data.items)) list = [data];
  else throw new Error('Unrecognised file');
  return list.filter(g => g && Array.isArray(g.items)).map(g => {
    const items = g.items.filter(i => i && i.url)
      .map(i => ({ id: uid(), title: i.title || i.url, url: i.url }));
    const idNum = Number(g.id);
    const created = g.created || g.createdAt || (idNum > 1e12 ? idNum : Date.now());
    const name = g.name || (g.title && g.title !== 'Untitled' ? g.title : autoName(items));
    return { id: String(g.id ?? uid()), name, created, items };
  }).filter(g => g.items.length);
}
