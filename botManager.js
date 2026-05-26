const mineflayer = require('mineflayer')
const fs = require('fs')
const path = require('path')

const TOKENS_DIR = process.env.TOKENS_DIR || path.join(__dirname, 'tokens')
if (!fs.existsSync(TOKENS_DIR)) fs.mkdirSync(TOKENS_DIR, { recursive: true })

const bots = {}
const AFK_BUTTON_SLOT = 49

function getTokensDir() { return TOKENS_DIR }

function addLog(id, msg) {
  if (!bots[id]) return
  const time = new Date().toLocaleTimeString('fr-FR')
  const entry = `[${time}] ${msg}`
  bots[id].logs.push(entry)
  if (bots[id].logs.length > 100) bots[id].logs.shift()
  console.log(`[${id}] ${entry}`)
}

function getAll() {
  return Object.entries(bots).map(([id, b]) => ({
    id, name: b.name, status: b.status, logs: b.logs, afkStatus: b.afkStatus
  }))
}

function addAccount(id, name) {
  if (bots[id]) return
  bots[id] = { bot: null, status: 'stopped', logs: [], name, reconnectTimer: null, afkStatus: 'idle' }
}

function removeAccount(id) {
  stopBot(id)
  delete bots[id]
}

function startBot(id) {
  if (!bots[id] || bots[id].status === 'connected') return

  if (bots[id].reconnectTimer) {
    clearTimeout(bots[id].reconnectTimer)
    bots[id].reconnectTimer = null
  }

  bots[id].status = 'connecting'
  addLog(id, '🔄 Connexion à DonutSMP...')

  const tokenFile = path.join(TOKENS_DIR, `${id}.json`)
  let authOption = 'microsoft'

  if (fs.existsSync(tokenFile)) {
    try {
      const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'))
      authOption = {
        client_id: '00000000402b5328',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at
      }
      addLog(id, '🔑 Session Microsoft locale trouvée et chargée.')
    } catch (e) {
      addLog(id, '⚠️ Session corrompue, connexion classique requise.')
    }
  }

  const bot = mineflayer.createBot({
    host: 'donutsmp.net', 
    port: 25565,
    username: bots[id].name,
    auth: authOption,
    version: '1.20.2', // Forcé pour éviter les soucis de protocoles
    hideErrors: true
  })

  bots[id].bot = bot

  bot.on('login', () => {
    bots[id].status = 'connected'
    addLog(id, `✅ Connecté au serveur en tant que ${bot.username}`)
    startAntiAFK(id)
  })

  bot.on('end', (reason) => {
    bots[id].status = 'stopped'
    addLog(id, `❌ Déconnecté : ${reason}`)
    // Reconnexion auto après 15 secondes si pas stoppé à la main
    if (bots[id] && bots[id].status !== 'stopped') {
      addLog(id, '⏳ Tentative de reconnexion dans 15s...')
      bots[id].reconnectTimer = setTimeout(() => startBot(id), 15000)
    }
  })

  bot.on('error', (err) => {
    addLog(id, `⚠️ Erreur : ${err.message}`)
  })
}

function stopBot(id) {
  if (!bots[id] || !bots[id].bot) return
  
  if (bots[id].reconnectTimer) {
    clearTimeout(bots[id].reconnectTimer)
    bots[id].reconnectTimer = null
  }

  addLog(id, '🛑 Déconnexion propre demandée...')
  try {
    bots[id].bot.chat('/quit') // Quitte proprement si le serveur le gère
  } catch {}
  
  setTimeout(() => {
    if (bots[id] && bots[id].bot) {
      bots[id].bot.quit()
      bots[id].status = 'stopped'
      bots[id].afkStatus = 'idle'
      addLog(id, '🗑️ Session réseau fermée.')
    }
  }, 500)
}

function startAntiAFK(id) {
  // Saut toutes les 30s
  setInterval(() => {
    if (bots[id] && bots[id].bot && bots[id].status === 'connected' && bots[id].afkStatus === 'idle') {
      bots[id].bot.setControlState('jump', true)
      setTimeout(() => { if (bots[id] && bots[id].bot) bots[id].bot.setControlState('jump', false) }, 500)
    }
  }, 30000)

  // Mouvement de tête toutes les 3 min
  setInterval(() => {
    if (bots[id] && bots[id].bot && bots[id].status === 'connected' && bots[id].afkStatus === 'idle') {
      bots[id].bot.look(bots[id].bot.entity.yaw + 0.5, 0)
    }
  }, 180000)
}

function goHome(id, num) {
  if (!bots[id] || !bots[id].bot || bots[id].status !== 'connected') return
  bots[id].bot.chat(`/home ${num}`)
  addLog(id, `🏠 Commande envoyée : /home ${num}`)
}

// FIX DE LA SUBTILITÉ FIND AFK : On force l'ouverture
function findAfk(id) {
  if (!bots[id] || !bots[id].bot || bots[id].status !== 'connected') return
  
  addLog(id, "🔄 Activation du mode AFK (Ouverture du menu...)")
  bots[id].bot.chat('/afk') // Force l'ouverture du menu AFK de DonutSMP
  
  // On attend 1,5 seconde que le menu s'ouvre avant de cliquer sur le slot
  setTimeout(() => {
    if (bots[id] && bots[id].bot) {
      try {
        bots[id].bot.clickWindow(AFK_BUTTON_SLOT, 0, 0)
        addLog(id, "🎯 Clic sur 'TP vers AFK libre' effectué.")
      } catch (e) {
        addLog(id, "⚠️ Impossible de cliquer (Le menu ne s'est pas ouvert à temps)")
      }
    }
  }, 1500)
}

module.exports = { getTokensDir, getAll, addAccount, removeAccount, startBot, stopBot, goHome, findAfk }
