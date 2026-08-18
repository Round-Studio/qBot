async function request(pathname, options = {}) {
  const res = await fetch(`/api${pathname}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `请求失败 (${res.status})`);
  }
  return body;
}

export const api = {
  status: () => request('/status'),
  startBot: () => request('/bot/start', { method: 'POST' }),
  stopBot: () => request('/bot/stop', { method: 'POST' }),
  restartBot: () => request('/bot/restart', { method: 'POST' }),
  getConfig: () => request('/config'),
  saveConfig: config => request('/config', { method: 'PUT', body: JSON.stringify(config) }),
  configPath: () => request('/config/path'),
  preview: payload => request('/template/preview', { method: 'POST', body: JSON.stringify(payload) }),
  fetchRelease: (key, refresh = false) =>
    request(`/repos/${encodeURIComponent(key)}/fetch${refresh ? '?refresh=1' : ''}`, { method: 'POST' }),
};