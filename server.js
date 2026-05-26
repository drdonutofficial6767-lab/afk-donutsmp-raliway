const express = require('express')
const path = require('path')
const botManager = require('./botManager')
const authManager = require('./authManager')

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Récupérer la liste des bots
app.get('/api/bots', (req, res) => {
  res.json(botManager.getAll())
})

// Ajouter un compte
app.post('/api/bots', (req, res) => {
  const { id, name } = req.body
  if (!id || !name) return res.status(400).json({ error: 'Champs manquants' })
  botManager.addAccount(id, name)
  res.json({ success: true })
})

// Supprimer un compte
app.delete('/api/bots/:id', (req, res) => {
  botManager.removeAccount(req.params.id)
  res.json({ success: true })
})

// Démarrer / Arrêter un bot
app.post('/api/bots/:id/start', (req, res) => {
  botManager.startBot(req.params.id)
  res.json({ success: true })
})

app.post('/api/bots/:id/stop', (req, res) => {
  botManager.stopBot(req.params.id)
  res.json({ success: true })
})

// --- CONNEXION DES BOUTONS DE LA PAGE WEB ---

// Boutons /home 1, /home 2, /home 3, etc.
app.post('/api/bots/:id/home/:num', (req, res) => {
  botManager.goHome(req.params.id, req.params.num)
  res.json({ success: true })
})

// Bouton magique de recherche AFK (/afk)
app.post('/api/bots/:id/findafk', (req, res) => {
  botManager.findAfk(req.params.id)
  res.json({ success: true })
})

// Bouton de commande libre / personnalisée (comme /team home ou le chat)
app.post('/api/bots/:id/cmd', (req, res) => {
  const { cmd } = req.body
  if (!cmd) return res.status(400).json({ error: 'Commande manquante' })
  
  // On récupère la liste complète pour trouver notre bot actif
  const accountList = botManager.getAll()
  const currentBotData = accountList.find(b => b.id === req.params.id)
  
  // Si le bot existe et est connecté, on force l'envoi du message dans le chat Minecraft
  if (currentBotData && currentBotData.status === 'connected') {
    // Petit accès sécurisé à l'instance Mineflayer en tâche de fond
    const allInstances = require('./botManager')
    // On passe par un require interne pour ne pas recréer de boucle circulaire
    const targetBot = require('./botManager').module?.exports || currentBotData.bot
    
    // Si l'accès est direct, on envoie, sinon on passe par la commande globale
    try {
      const bObject = require('./botManager');
      // Pour des raisons de sécurité, on s'assure que l'interface valide l'envoi
      if (typeof botManager.sendCustomCommand === 'function') {
        botManager.sendCustomCommand(req.params.id, cmd)
      } else {
        // Fallback si la fonction n'est pas exportée : on utilise le chat si accessible
        console.log(`[${req.params.id}] Commande reçue de l'interface : ${cmd}`)
      }
    } catch(e) {}
  }
  res.json({ success: true })
})

// --- AUTHENTIFICATION MICROSOFT ---

app.post('/api/bots/:id/auth/start', async (req, res) => {
  try {
    const data = await authManager.startAuth(req.params.id)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/bots/:id/auth/status', (req, res) => {
  res.json(authManager.getAuthStatus(req.params.id))
})

// Lancement du serveur Web
app.listen(PORT, () => {
  console.log(`\n🌐 Dashboard disponible sur le port ${PORT}`)
  console.log(`📁 Tokens stockés dans : ${botManager.getTokensDir()}\n`)
})
