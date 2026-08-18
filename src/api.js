async function request(pathname, options = {}) {
  let res
  try {
    res = await fetch(`/api${pathname}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch (err) {
    throw new Error(`无法连接后端服务（${pathname}）: ${err.message}`)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = body.error || body.message || `HTTP ${res.status}`
    throw new Error(`请求失败 ${pathname}: ${detail}`)
  }
  return body
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
}

export function errorText(err) {
  return err && err.message ? err.message : '未知错误'
}