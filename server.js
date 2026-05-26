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

// Commandes en jeu
app.post('/api/bots/:id/home/:num', (req, res) => {
  botManager.goHome(req.params.id, req.params.num)
  res.json({ success: true })
})

app.post('/api/bots/:id/findafk', (req, res) => {
  botManager.findAfk(req.params.id)
  res.json({ success: true })
})

// --- SYNC AUTHENTIFICATION MICROSOFT ---

app.post('/api/bots/:id/auth/start', async (req, res) => {
  try {
    const data = await authManager.startAuth(req.params.id)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/bots/:id/auth/status', (req, res) => {
  // FIX: Utilise la bonne fonction exportée de authManager
  res.json(authManager.getAuthStatus(req.params.id))
})

// Lancement du serveur Web
app.listen(PORT, () => {
  console.log(`\n🌐 Dashboard disponible sur le port ${PORT}`)
  console.log(`📁 Tokens stockés dans : ${botManager.getTokensDir()}\n`)
})
