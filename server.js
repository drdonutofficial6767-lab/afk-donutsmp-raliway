const express = require('express')
const path = require('path')
const botManager = require('./botManager')
const authManager = require('./authManager')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/bots', (req, res) => res.json(botManager.getAll()))

app.post('/api/bots', (req, res) => {
  const { id, name } = req.body
  if (!id || !name) return res.status(400).json({ error: 'id et name requis' })
  botManager.addAccount(id, name)
  res.json({ ok: true })
})

app.delete('/api/bots/:id', (req, res) => {
  botManager.removeAccount(req.params.id)
  res.json({ ok: true })
})

app.post('/api/bots/:id/start', (req, res) => {
  botManager.startBot(req.params.id)
  res.json({ ok: true })
})

app.post('/api/bots/:id/stop', (req, res) => {
  botManager.stopBot(req.params.id)
  res.json({ ok: true })
})

// Commandes prédéfinies uniquement
app.post('/api/bots/:id/home/:num', (req, res) => {
  const num = parseInt(req.params.num)
  if (num !== 1 && num !== 2) return res.status(400).json({ error: 'home 1 ou 2 seulement' })
  botManager.goHome(req.params.id, num)
  res.json({ ok: true })
})

app.post('/api/bots/:id/findafk', (req, res) => {
  botManager.findAfk(req.params.id)
  res.json({ ok: true })
})

// Auth Microsoft
app.post('/api/bots/:id/auth/start', async (req, res) => {
  try { res.json(await authManager.startAuth(req.params.id)) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/bots/:id/auth/status', (req, res) => {
  res.json(authManager.getAuthStatus(req.params.id))
})

app.post('/api/bots/:id/auth/cancel', (req, res) => {
  authManager.cancelAuth(req.params.id)
  res.json({ ok: true })
})

app.get('/api/bots/:id/auth/hastoken', (req, res) => {
  res.json({ hasToken: authManager.hasToken(req.params.id) })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 Dashboard disponible sur le port ${PORT}\n`)
  console.log(`📁 Tokens stockés dans : ${require('./botManager').getTokensDir()}\n`)
})
