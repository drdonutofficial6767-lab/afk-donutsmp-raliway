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
  bots[id] = { bot: null, status: 'stopped', logs: [], name, reconnectTimer: null, afkStatus: 'idle', intervals: [] }
}

function removeAccount(id) {
  stopBot(id)
  delete bots[id]
  if (fs.existsSync(TOKENS_DIR)) {
    const files = fs.readdirSync(TOKENS_DIR)
    files.forEach(file => {
      if (file.toLowerCase().includes(id.toLowerCase())) {
        try { fs.unlinkSync(path.join(TOKENS_DIR, file)) } catch {}
      }
    })
  }
}

function startBot(id) {
  if (!bots[id] || bots[id].bot) return
  if (bots[id].reconnectTimer) { clearTimeout(bots[id].reconnectTimer); bots[id].reconnectTimer = null }

  bots[id].status = 'connecting'
  addLog(id, '🔄 Connexion à DonutSMP...')

  const authManager = require('./authManager')

  bots[id].bot = mineflayer.createBot({
    host: 'donutsmp.net',
    port: 25565,
    version: '1.20.2',
    auth: 'microsoft',
    profilesFolder: TOKENS_DIR,
    username: id,
    hideErrors: true,
    onMsaCode: (data) => {
      addLog(id, `🔑 [Auth Microsoft] Code requis : ${data.user_code}`)
      authManager.setPendingAuth(id, data)
    }
  })

  bots[id].bot.on('login', () => {
    bots[id].status = 'connected'
    addLog(id, `✅ ${bots[id].name} connecté avec succès !`)
    authManager.setAuthSuccess(id)
    startAntiAFK(id)
  })

  bots[id].bot.on('windowOpen', async (window) => {
    if (bots[id].afkStatus !== 'searching') return

    addLog(id, `📦 Menu AFK détecté (Slot ${AFK_BUTTON_SLOT}) — Clic...`)
    freezeBot(id)
    bots[id].afkStatus = 'teleporting'

    setTimeout(async () => {
      try {
        if (bots[id] && bots[id].bot) {
          await bots[id].bot.clickWindow(AFK_BUTTON_SLOT, 0, 0)
          addLog(id, `⏳ Téléportation lancée — Immobile pendant 6s...`)
        }
        setTimeout(() => {
          if (bots[id] && bots[id].afkStatus === 'teleporting') {
            unfreezeBot(id)
            bots[id].afkStatus = 'idle'
            addLog(id, `✅ Statut AFK synchronisé.`)
          }
        }, 6000)
      } catch (e) {
        addLog(id, `⚠️ Erreur lors du clic : ${e.message}`)
        unfreezeBot(id)
        bots[id].afkStatus = 'idle'
      }
    }, 500)
  })

  bots[id].bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString().toLowerCase()
    if (bots[id].afkStatus === 'teleporting' && (msg.includes('region is full') || msg.includes('area is full'))) {
      addLog(id, `❌ Zone AFK saturée.`)
      unfreezeBot(id)
      bots[id].afkStatus = 'idle'
    }
  })

  bots[id].bot.on('kicked', (reason) => {
    cleanBotResources(id)
    addLog(id, `❌ Expulsé : ${reason}`)
    handleReconnect(id)
  })

  bots[id].bot.on('error', (err) => {
    cleanBotResources(id)
    addLog(id, `⚠️ Erreur réseau : ${err.message}`)
    handleReconnect(id)
  })

  bots[id].bot.on('end', () => {
    if (bots[id] && bots[id].status === 'stopped') return
    cleanBotResources(id)
    addLog(id, '🔌 Connexion interrompue.')
    handleReconnect(id)
  })
}

function handleReconnect(id) {
  if (!bots[id] || bots[id].status === 'stopped') return
  bots[id].status = 'disconnected'
  bots[id].reconnectTimer = setTimeout(() => startBot(id), 10000)
  addLog(id, '🔄 Reconnexion automatique programmée dans 10s...')
}

function cleanBotResources(id) {
  if (!bots[id]) return
  if (bots[id].intervals) {
    bots[id].intervals.forEach(clearInterval)
    bots[id].intervals = []
  }
  bots[id].afkStatus = 'idle'
  bots[id].bot = null
}

function stopBot(id) {
  if (!bots[id]) return
  if (bots[id].reconnectTimer) { clearTimeout(bots[id].reconnectTimer); bots[id].reconnectTimer = null }
  bots[id].status = 'stopped'
  if (bots[id].bot) {
    try { bots[id].bot.quit() } catch {}
  }
  cleanBotResources(id)
  bots[id].status = 'stopped'
  addLog(id, '🛑 Bot mis à l\'arrêt.')
}

function startAntiAFK(id) {
  if (!bots[id]) return
  cleanBotResources(id)

  const jump = setInterval(() => {
    if (bots[id] && bots[id].bot && bots[id].status === 'connected' && bots[id].afkStatus === 'idle') {
      bots[id].bot.setControlState('jump', true)
      setTimeout(() => { if (bots[id] && bots[id].bot) bots[id].bot.setControlState('jump', false) }, 500)
    }
  }, 30000)

  const look = setInterval(() => {
    if (bots[id] && bots[id].bot && bots[id].status === 'connected' && bots[id].afkStatus === 'idle') {
      try { bots[id].bot.look(bots[id].bot.entity.yaw + 0.5, 0) } catch {}
    }
  }, 180000)

  bots[id].intervals.push(jump, look)
}

function freezeBot(id) {
  if (!bots[id] || !bots[id].bot) return
  const b = bots[id].bot
  ;['forward','back','left','right','jump','sneak','sprint'].forEach(s => { try { b.setControlState(s, false) } catch {} })
}

function unfreezeBot(id) { freezeBot(id) }

function findAfk(id) {
  if (!bots[id] || bots[id].status !== 'connected') return
  bots[id].afkStatus = 'searching'
  addLog(id, '🔍 Commande /afk envoyée...')
  bots[id].bot.chat('/afk')
}

function goHome(id, num) {
  if (!bots[id] || !bots[id].bot || bots[id].status !== 'connected') return
  bots[id].bot.chat(`/home ${num}`)
  addLog(id, `🏠 Commande envoyée : /home ${num}`)
}

// Fonction pour envoyer n'importe quelle commande depuis la page web
function sendCustomCommand(id, cmd) {
  if (bots[id] && bots[id].bot && bots[id].status === 'connected') {
    bots[id].bot.chat(cmd)
    addLog(id, `💬 Commande envoyée : ${cmd}`)
  }
}

module.exports = { addAccount, removeAccount, startBot, stopBot, getAll, findAfk, goHome, getTokensDir, sendCustomCommand }
