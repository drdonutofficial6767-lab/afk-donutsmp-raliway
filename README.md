# AFK Bot DonutSMP v2.0 — Railway Edition

Bot AFK multi-comptes pour DonutSMP avec dashboard web.
Compatible Raspberry Pi **et** Railway.

---

## 🚂 Déploiement sur Railway

### 1. Crée le projet Railway
- Va sur [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
- Ou installe Railway CLI : `npm i -g @railway/cli` puis `railway init`

### 2. Configure un Volume (OBLIGATOIRE pour garder les tokens)
Dans le dashboard Railway :
- Ton service → **Volumes** → **Add Volume**
- Mount Path : `/app/tokens`
- Ça évite de perdre les tokens Microsoft à chaque redeploy

### 3. Déploie
```bash
railway up
# ou via GitHub : push sur main = déploiement auto
```

### 4. Accède au dashboard
Railway génère une URL publique automatiquement (ex: `https://afk-bot-xxx.railway.app`)

### 5. Ajoute un compte et authentifie
- Clique "➕ Ajouter un compte"
- Clique 🔑 pour l'auth Microsoft
- Suis les instructions dans le dashboard
- Clique ▶ Start

---

## 🍓 Déploiement sur Raspberry Pi (inchangé)

### 1. Copie les fichiers sur le Pi
```bash
scp -r ./afk-bot-donutsmp pi@192.168.1.XX:~/afk-bot
```

### 2. Installe les dépendances
```bash
ssh pi@192.168.1.XX
cd ~/afk-bot
npm install
```

### 3. Lance le serveur
```bash
node server.js
```

### 4. Ouvre le dashboard
```
http://[IP-DU-PI]:3000
```

### Lancement permanent
```bash
sudo apt install screen -y
screen -S afkbot
cd ~/afk-bot && node server.js
# Détache : Ctrl+A puis D
```

### Autostart après coupure de courant
```bash
crontab -e
# Ajoute :
@reboot cd ~/afk-bot && node server.js >> ~/afk-bot/logs.txt 2>&1
```

---

## Variables d'environnement (optionnel)

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Injecté auto par Railway |
| `TOKENS_DIR` | `./tokens` | Chemin du dossier tokens |

---

## Structure
```
afk-bot/
├── server.js        ← serveur web Express
├── botManager.js    ← gestion des bots
├── authManager.js   ← auth Microsoft
├── railway.json     ← config Railway
├── package.json
├── .gitignore
├── tokens/          ← tokens Microsoft (Volume Railway ou dossier local)
└── public/
    └── index.html   ← dashboard web
```
