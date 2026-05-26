const express = require('express')
const path = require('path')
const botManager = require('./botManager')
const authManager = require('./authManager')

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/bots', (req, res) => {
  res.json(botManager.getAll())
})

app.post('/api/bots', (req, res) => {
  const { id, name } = req.body
  if (!id || !name) return res.status(400).json({ error: 'Champs manquants' })
  botManager.addAccount(id, name)
  res.json({ success: true })
})

app.delete('/api/bots/:id', (req, res) => {
  botManager.removeAccount(req.params.id)
  res.json({ success: true })
})

app.post('/api/bots/:id/start', (req, res) => {
  botManager.startBot(req.params.id)
  res.json({ success: true })
})

app.post('/api/bots/:id/stop', (req, res) => {
  botManager.stopBot(req.params.id)
  res.json({ success: true })
})

// --- ROUTES POUR LES BOUTONS DU DASHBOARD ---

app.post('/api/bots/:id/home/:num', (req, res) => {
  botManager.goHome(req.params.id, req.params.num)
  res.json({ success: true })
})

app.post('/api/bots/:id/findafk', (req, res) => {
  botManager.findAfk(req.params.id)
  res.json({ success: true })
})

// Route universelle pour /team home ou le chat manuel
app.post('/api/bots/:id/cmd', (req, res) => {
  const { cmd } = req.body
  if (!cmd) return res.status(400).json({ error: 'Commande manquante' })
  botManager.sendCustomCommand(req.params.id, cmd)
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

app.listen(PORT, () => {
  console.log(`\n🌐 Dashboard disponible sur le port ${PORT}`)
  console.log(`📁 Tokens stockés dans : ${botManager.getTokensDir()}\n`)
})
