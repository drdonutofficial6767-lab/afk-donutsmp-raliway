const mineflayer = require('mineflayer')
const fs = require('fs')
const path = require('path')

// Railway : monte un Volume sur /app/tokens pour la persistance
// En local (Raspberry Pi) : utilise le dossier tokens/ à côté du projet
const TOKENS_DIR = process.env.TOKENS_DIR || path.join(__dirname, 'tokens')
if (!fs.existsSync(TOKENS_DIR)) fs.mkdirSync(TOKENS_DIR, { recursive: true })

const bots = {}

// Slot du bouton "TP vers AFK libre" en bas au milieu de la GUI
const AFK_BUTTON_SLOT = 49

function getTokensDir() {
  return TOKENS_DIR
}

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
  const tokenFile = path.join(TOKENS_DIR, `${id}.json`)
  if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile)
}

function startBot(id) {
  if (!bots[id] || bots[id].bot) return
  if (bots[id].reconnectTimer) { clearTimeout(bots[id].reconnectTimer); bots[id].reconnectTimer = null }

  bots[id].status = 'connecting'
  addLog(id, '🔄 Connexion à DonutSMP...')

  bots[id].bot = mineflayer.createBot({
    host: 'donutsmp.net',
    port: 25565,
    version: '1.20.1',
    auth: 'microsoft',
    profilesFolder: TOKENS_DIR,
    username: id
  })

  bots[id].bot.on('spawn', () => {
    bots[id].status = 'connected'
    addLog(id, `✅ ${bots[id].name} connecté à DonutSMP !`)
    startAntiAFK(id)
  })

  // GUI ouverte — clique directement le bouton AFK libre
  bots[id].bot.on('windowOpen', (window) => {
    if (bots[id].afkStatus !== 'searching') return

    addLog(id, `📦 Menu AFK ouvert — clic sur le bouton TP...`)

    const button = window.slots[AFK_BUTTON_SLOT]
    if (!button) {
      addLog(id, `⚠️ Bouton introuvable au slot ${AFK_BUTTON_SLOT}`)
      bots[id].afkStatus = 'idle'
      try { bots[id].bot.closeWindow(window) } catch {}
      return
    }

    addLog(id, `🖱️ Bouton trouvé : [${button.name}] — clic...`)

    // Freeze immédiatement
    freezeBot(id)
    bots[id].afkStatus = 'teleporting'

    setTimeout(async () => {
      try {
        await bots[id].bot.simpleClick.leftMouse(AFK_BUTTON_SLOT)
        addLog(id, `⏳ Téléportation en cours — immobile pendant 6s...`)

        setTimeout(() => {
          if (bots[id] && bots[id].afkStatus === 'teleporting') {
            unfreezeBot(id)
            bots[id].afkStatus = 'idle'
            addLog(id, `✅ AFK actif !`)
          }
        }, 6000)

      } catch (e) {
        addLog(id, `⚠️ Erreur clic : ${e.message}`)
        unfreezeBot(id)
        bots[id].afkStatus = 'idle'
      }
    }, 500)
  })

  // Détecte si tous les AFK sont full malgré tout
  bots[id].bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString().toLowerCase()
    if (bots[id].afkStatus === 'teleporting' && (msg.includes('region is full') || msg.includes('area is full'))) {
      addLog(id, `❌ Tous les AFK sont full — réessaie plus tard.`)
      unfreezeBot(id)
      bots[id].afkStatus = 'idle'
    }
  })

  bots[id].bot.on('kicked', (reason) => {
    unfreezeBot(id)
    bots[id].status = 'disconnected'
    bots[id].afkStatus = 'idle'
    addLog(id, `❌ Kick : ${reason}`)
    bots[id].bot = null
    bots[id].reconnectTimer = setTimeout(() => startBot(id), 5000)
    addLog(id, '🔄 Reconnexion dans 5 secondes...')
  })

  bots[id].bot.on('error', (err) => {
    unfreezeBot(id)
    bots[id].status = 'disconnected'
    bots[id].afkStatus = 'idle'
    addLog(id, `⚠️ Erreur : ${err.message}`)
    bots[id].bot = null
    bots[id].reconnectTimer = setTimeout(() => startBot(id), 5000)
    addLog(id, '🔄 Reconnexion dans 5 secondes...')
  })

  bots[id].bot.on('end', () => {
    if (bots[id].status === 'stopped') return
    unfreezeBot(id)
    bots[id].status = 'disconnected'
    bots[id].afkStatus = 'idle'
    addLog(id, '🔌 Déconnecté')
    bots[id].bot = null
    bots[id].reconnectTimer = setTimeout(() => startBot(id), 5000)
    addLog(id, '🔄 Reconnexion dans 5 secondes...')
  })

  setInterval(() => {
    if (bots[id] && bots[id].status === 'connected') {
      addLog(id, '⏰ Bot toujours connecté')
    }
  }, 300000)
}

function stopBot(id) {
  if (!bots[id]) return
  if (bots[id].reconnectTimer) { clearTimeout(bots[id].reconnectTimer); bots[id].reconnectTimer = null }
  unfreezeBot(id)
  if (bots[id].bot) { bots[id].bot.quit(); bots[id].bot = null }
  bots[id].status = 'stopped'
  bots[id].afkStatus = 'idle'
  addLog(id, '🛑 Bot arrêté')
}

function startAntiAFK(id) {
  setInterval(() => {
    if (bots[id] && bots[id].bot && bots[id].status === 'connected' && bots[id].afkStatus === 'idle') {
      bots[id].bot.setControlState('jump', true)
      setTimeout(() => { if (bots[id] && bots[id].bot) bots[id].bot.setControlState('jump', false) }, 500)
    }
  }, 30000)

  setInterval(() => {
    if (bots[id] && bots[id].bot && bots[id].status === 'connected' && bots[id].afkStatus === 'idle') {
      bots[id].bot.look(bots[id].bot.entity.yaw + 0.5, 0)
    }
  }, 180000)
}

function freezeBot(id) {
  if (!bots[id] || !bots[id].bot) return
  const b = bots[id].bot
  ;['forward','back','left','right','jump','sneak','sprint'].forEach(s => b.setControlState(s, false))
}

function unfreezeBot(id) {
  if (!bots[id] || !bots[id].bot) return
  const b = bots[id].bot
  ;['forward','back','left','right','jump','sneak','sprint'].forEach(s => b.setControlState(s, false))
}

function findAfk(id) {
  if (!bots[id] || bots[id].status !== 'connected') return
  bots[id].afkStatus = 'searching'
  addLog(id, '🔍 Ouverture du menu AFK...')
  bots[id].bot.chat('/afk')
}

function goHome(id, num) {
  if (!bots[id] || !bots[id].bot || bots[id].status !== 'connected') return
  bots[id].bot.chat(`/home ${num}`)
  addLog(id, `🏠 /home ${num} envoyé`)
}

module.exports = { addAccount, removeAccount, startBot, stopBot, getAll, findAfk, goHome, getTokensDir }
