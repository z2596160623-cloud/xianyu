const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

const digest = async (value) => {
  const bytes = new TextEncoder().encode(value.trim().toUpperCase())
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const makeKey = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  const raw = [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
  return `XY-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`
}

const isoAfterDays = (days) => new Date(Date.now() + days * 86400000).toISOString()

async function activateOrVerify(request, env, activate) {
  const body = await request.json().catch(() => ({}))
  const licenseKey = String(body.license_key || '').trim().toUpperCase()
  const deviceId = String(body.device_id || '').trim().toUpperCase()
  if (!licenseKey || !deviceId) return json({ valid: false, message: '缺少激活码或设备码' }, 400)

  const keyHash = await digest(licenseKey)
  let row = await env.DB.prepare('SELECT * FROM licenses WHERE key_hash = ?').bind(keyHash).first()
  if (!row || row.revoked) return json({ valid: false, message: '激活码无效或已停用' })
  if (row.device_id && row.device_id !== deviceId) {
    return json({ valid: false, message: '该激活码已绑定其他电脑' })
  }
  if (activate && !row.device_id) {
    const now = new Date().toISOString()
    const expires = isoAfterDays(row.duration_days)
    await env.DB.prepare(
      'UPDATE licenses SET device_id = ?, activated_at = ?, expires_at = ? WHERE id = ?',
    ).bind(deviceId, now, expires, row.id).run()
    row = { ...row, device_id: deviceId, activated_at: now, expires_at: expires }
  }
  if (!row.device_id) return json({ valid: false, message: '请先激活' })
  const valid = Boolean(row.expires_at && Date.parse(row.expires_at) > Date.now())
  return json({ valid, expires_at: row.expires_at, plan: row.plan,
    message: valid ? '授权有效' : '授权已过期' })
}

async function createLicense(request, env) {
  if (request.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
    return json({ error: 'unauthorized' }, 401)
  }
  const body = await request.json().catch(() => ({}))
  const days = Math.max(1, Math.min(366, Number(body.duration_days || 30)))
  const key = makeKey()
  await env.DB.prepare(
    'INSERT INTO licenses (key_hash, plan, duration_days, created_at) VALUES (?, ?, ?, ?)',
  ).bind(await digest(key), String(body.plan || 'monthly'), days, new Date().toISOString()).run()
  return json({ license_key: key, duration_days: days, plan: body.plan || 'monthly' }, 201)
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname
    if (request.method === 'GET' && path === '/health') {
      return json({ ok: true, service: 'shisan-license' })
    }
    if (request.method !== 'POST') return json({ error: 'not found' }, 404)
    if (path === '/v1/activate') return activateOrVerify(request, env, true)
    if (path === '/v1/verify') return activateOrVerify(request, env, false)
    if (path === '/v1/admin/licenses') return createLicense(request, env)
    return json({ error: 'not found' }, 404)
  },
}
