const https = require('https')
const fs = require('fs')
const path = require('path')

const CLIENT_ID = '00000000402b5328' // Client ID officiel Minecraft
const TOKENS_DIR = process.env.TOKENS_DIR || path.join(__dirname, 'tokens')

const pendingAuths = {} // { accountId: { code, link, expiresAt, interval } }

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
  // Annule une auth en cours si elle existe
  if (pendingAuths[accountId]) cancelAuth(accountId)

  // Étape 1 : demande un device code à Microsoft
  const deviceRes = await post('login.microsoftonline.com',
    '/consumers/oauth2/v2.0/devicecode', {
      client_id: CLIENT_ID,
      scope: 'XboxLive.signin offline_access'
    })

  if (!deviceRes.device_code) throw new Error('Impossible de contacter Microsoft')

  const expiresAt = Date.now() + (deviceRes.expires_in * 1000)

  pendingAuths[accountId] = {
    deviceCode: deviceRes.device_code,
    userCode: deviceRes.user_code,
    link: deviceRes.verification_uri || 'https://microsoft.com/devicelogin',
    expiresAt,
    interval: null,
    status: 'pending',
    token: null
  }

  // Étape 2 : polling toutes les 5 secondes
  pendingAuths[accountId].interval = setInterval(async () => {
    if (!pendingAuths[accountId]) return

    // Vérifie si expiré
    if (Date.now() > pendingAuths[accountId].expiresAt) {
      pendingAuths[accountId].status = 'expired'
      cancelAuth(accountId)
      return
    }

    try {
      const tokenRes = await post('login.microsoftonline.com',
        '/consumers/oauth2/v2.0/token', {
          client_id: CLIENT_ID,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: pendingAuths[accountId].deviceCode
        })

      if (tokenRes.access_token) {
        // Authentifié ! Sauvegarde le token
        pendingAuths[accountId].status = 'success'
        clearInterval(pendingAuths[accountId].interval)

        // S'assure que le dossier existe (important sur Railway)
        if (!fs.existsSync(TOKENS_DIR)) fs.mkdirSync(TOKENS_DIR, { recursive: true })

        const tokenFile = path.join(TOKENS_DIR, `${accountId}.json`)
        fs.writeFileSync(tokenFile, JSON.stringify({
          access_token: tokenRes.access_token,
          refresh_token: tokenRes.refresh_token,
          expires_at: Date.now() + (tokenRes.expires_in * 1000)
        }))

        setTimeout(() => { delete pendingAuths[accountId] }, 10000)
      }
      // Si authorization_pending, on continue de poller
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

function hasToken(accountId) {
  const tokenFile = path.join(TOKENS_DIR, `${accountId}.json`)
  return fs.existsSync(tokenFile)
}

module.exports = { startAuth, getAuthStatus, cancelAuth, hasToken }
