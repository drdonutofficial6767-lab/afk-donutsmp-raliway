const https = require('https')
const fs = require('fs')
const path = require('path')

const CLIENT_ID = '00000000402b5328'
const TOKENS_DIR = process.env.TOKENS_DIR || path.join(__dirname, 'tokens')

const pendingAuths = {}

function post(hostname, path, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(data).toString()
    const options = {
      hostname, path, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(options, res => {
      let raw = ''
      res.on('data', d => raw += d)
      res.on('end', () => {
        try { resolve(JSON.parse(raw)) }
        catch { resolve({}) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function startAuth(accountId) {
  if (pendingAuths[accountId]) cancelAuth(accountId)

  const deviceRes = await post('login.microsoftonline.com',
    '/consumers/oauth2/v2.0/devicecode', {
      client_id: CLIENT_ID,
      scope: 'XboxLive.signin offline_access'
    })

  if (!deviceRes.device_code) {
    throw new Error('Impossible de générer le code auprès de Microsoft.')
  }

  pendingAuths[accountId] = {
    status: 'pending',
    userCode: deviceRes.user_code,
    link: deviceRes.verification_uri,
    expiresAt: Date.now() + (deviceRes.expires_in * 1000),
    interval: null
  }

  pendingAuths[accountId].interval = setInterval(async () => {
    if (!pendingAuths[accountId] || Date.now() > pendingAuths[accountId].expiresAt) {
      if (pendingAuths[accountId]) pendingAuths[accountId].status = 'expired'
      clearInterval(pendingAuths[accountId]?.interval)
      return
    }

    try {
      const tokenRes = await post('login.microsoftonline.com',
        '/consumers/oauth2/v2.0/token', {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: CLIENT_ID,
          device_code: deviceRes.device_code
        })

      if (tokenRes.access_token) {
        pendingAuths[accountId].status = 'success'
        clearInterval(pendingAuths[accountId].interval)

        if (!fs.existsSync(TOKENS_DIR)) fs.mkdirSync(TOKENS_DIR, { recursive: true })

        const tokenFile = path.join(TOKENS_DIR, `${accountId}.json`)
        fs.writeFileSync(tokenFile, JSON.stringify({
          access_token: tokenRes.access_token,
          refresh_token: tokenRes.refresh_token,
          expires_at: Date.now() + (tokenRes.expires_in * 1000)
        }))

        // Conservé 60 secondes en mémoire au lieu de 10 pour laisser le temps au web d'être notifié
        setTimeout(() => { delete pendingAuths[accountId] }, 60000)
      }
    } catch {}
  }, 5000)

  return {
    code: deviceRes.user_code,
    link: pendingAuths[accountId].link,
    expiresIn: deviceRes.expires_in
  }
}

function getAuthStatus(accountId) {
  if (!pendingAuths[accountId]) return { status: 'none' }
  const p = pendingAuths[accountId]
  return {
    status: p.status,
    code: p.userCode,
    link: p.link,
    secondsLeft: Math.max(0, Math.floor((p.expiresAt - Date.now()) / 1000))
  }
}

function cancelAuth(accountId) {
  if (pendingAuths[accountId]) {
    clearInterval(pendingAuths[accountId].interval)
    delete pendingAuths[accountId]
  }
}

module.exports = { startAuth, getAuthStatus, cancelAuth }
