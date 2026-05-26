const fs = require('fs')
const path = require('path')

const TOKENS_DIR = process.env.TOKENS_DIR || path.join(__dirname, 'tokens')
const authStates = {}

function setPendingAuth(id, data) {
  authStates[id] = {
    status: 'pending',
    code: data.user_code,
    link: data.verification_uri || 'https://microsoft.com/link',
    expiresAt: Date.now() + (data.expires_in * 1000)
  }
}

function setAuthSuccess(id) { 
  authStates[id] = { status: 'success' } 
}

function setAuthFailed(id, reason) { 
  authStates[id] = { status: 'error', error: reason } 
}

async function startAuth(accountId) {
  const botManager = require('./botManager')
  
  authStates[accountId] = { status: 'connecting' }
  botManager.startBot(accountId)
  
  // Petite attente pour laisser Mineflayer générer le code
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  const current = authStates[accountId]
  if (current && current.status === 'pending') {
    return {
      code: current.code,
      link: current.link,
      expiresIn: Math.max(0, Math.floor((current.expiresAt - Date.now()) / 1000))
    }
  }
  return { code: current?.code || null, link: 'https://microsoft.com/link', expiresIn: 300 }
}

function getAuthStatus(accountId) {
  const p = authStates[accountId]
  if (!p) {
    if (hasToken(accountId)) return { status: 'success' }
    return { status: 'none' }
  }
  if (p.status === 'pending' && Date.now() > p.expiresAt) p.status = 'expired'
  
  return {
    status: p.status,
    code: p.code,
    link: p.link,
    secondsLeft: p.expiresAt ? Math.max(0, Math.floor((p.expiresAt - Date.now()) / 1000)) : 0
  }
}

function cancelAuth(accountId) {
  delete authStates[accountId]
  require('./botManager').stopBot(accountId)
}

function hasToken(accountId) {
  if (!fs.existsSync(TOKENS_DIR)) return false
  const files = fs.readdirSync(TOKENS_DIR)
  return files.some(file => file.toLowerCase().includes(accountId.toLowerCase()))
}

module.exports = { 
  startAuth, 
  getAuthStatus, 
  cancelAuth, 
  hasToken, 
  setPendingAuth, 
  setAuthSuccess, 
  setAuthFailed 
}
