# Pistolet Occulte — ARG Web Application

Occult archives ARG for a Garry's Mod roleplay server. Discord OAuth2 login with role verification, persistent progress, and 3 cryptographic puzzle gates.

---

## Requirements

- **Node.js** v18+
- A **Discord Application** with a bot (developer portal)
- The bot must be **in your target guild**

---

## Setup

### 1. Discord Developer Portal

1. Go to https://discord.com/developers/applications
2. Create a New Application
3. Under **OAuth2 → General**, add a Redirect: `http://localhost:3000/auth/discord/callback`
4. Under **Bot**, enable the bot and copy the **Bot Token**
5. Invite the bot to your server with `bot` scope and at minimum **Read Members** permission

### 2. Install Dependencies

```bash
cd PistoletOcculte/PistoletOcculte
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DISCORD_CLIENT_ID` | Your app's Client ID (OAuth2 tab) |
| `DISCORD_CLIENT_SECRET` | Your app's Client Secret (OAuth2 tab) |
| `DISCORD_CALLBACK_URL` | `http://localhost:3000/auth/discord/callback` |
| `DISCORD_BOT_TOKEN` | Your bot's token (Bot tab) |
| `ENIGMA_FOUND_CHANNEL_ID` | Optional channel ID for solved enigma notifications (defaults to `1490141439194173541`) |
| `GUILD_ID` | Your Discord server ID (right-click server → Copy ID) |
| `REQUIRED_ROLE_ID` | The role ID required to access content |
| `SESSION_SECRET` | Any long random string |
| `PORT` | Optional, defaults to 3000 |

> **Enable Developer Mode** in Discord settings to access Copy ID options.

### 4. Game Master Controls

Edit `config.json` to enable/disable puzzles:

```json
{
  "PUZZLE_1_ENABLED": true,
  "PUZZLE_2_ENABLED": true,
  "PUZZLE_3_ENABLED": false
}
```

Setting a puzzle to `false` shows a corrupted-data error instead of the puzzle. Changes take effect on next server restart.

### 5. Run

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

Visit `http://localhost:3000`

---

## Puzzle Solutions (GM Reference)

| Lock | Name | Solution |
|---|---|---|
| Lock 1 | Le Sceau de Kanjis | Click in order: **死 → 呪 → 血 → 魂** |
| Lock 2 | L'Incantation | `Neuf cordes. Lumière polarisée. Corbeau et déclaration.` (case-insensitive) |
| Lock 3 | La Synchronisation du Barillet | Connect dots: **1 → 4 → 2 → 5 → 3 → 6** |

Each solved puzzle unlocks:
- The corresponding training chapter content
- The corresponding Journal Intime diary entry

---

## Player Progress

User progress is stored in `data/users_progress.json`. To reset a specific user, remove their entry from that file. The file is auto-created on first login.

---

## Project Structure

```
PistoletOcculte/
├── server.js           # Express server, Discord OAuth, API routes
├── config.json         # GM toggles for each puzzle
├── .env                # Secrets (never commit this)
├── data/
│   └── users_progress.json   # Auto-generated player save file
├── views/
│   ├── login.html      # Landing / login page
│   ├── denied.html     # Access denied (no required role)
│   └── dashboard.html  # Main app shell
└── public/
    ├── css/style.css   # All styles (sepia / occult noir theme)
    └── js/app.js       # All client logic, content, and puzzles
```
