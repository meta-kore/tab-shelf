(async () => {
  const win = await chrome.windows.getCurrent();
  const tabs = await chrome.tabs.query({ windowId: win.id });
  const n = tabs.filter(t => t.url && !t.url.startsWith(chrome.runtime.getURL('')) && t.url !== 'chrome://newtab/').length;
  document.getElementById('count').textContent = `${n} tab${n === 1 ? '' : 's'} in this window`;
  const msg = document.getElementById('msg');

  document.querySelectorAll('button[data-mode]').forEach(b => b.addEventListener('click', async () => {
    document.querySelectorAll('button').forEach(x => x.disabled = true);
    msg.textContent = 'Saving…';
    const res = await chrome.runtime.sendMessage({
      type: 'save', mode: b.dataset.mode, windowId: win.id,
      name: document.getElementById('name').value.trim()
    });
    msg.textContent = res?.msg || 'Done.';
    document.querySelectorAll('button').forEach(x => x.disabled = false);
    if (res?.ok && b.dataset.mode.endsWith('keep')) setTimeout(() => window.close(), 900);
  }));

  document.getElementById('open').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'openShelf', windowId: win.id });
    window.close();
  });
})();
