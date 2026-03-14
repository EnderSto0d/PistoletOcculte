require('dotenv').config();

const express   = require('express');
const session   = require('express-session');
const passport  = require('passport');
const Discord   = require('passport-discord');
const axios     = require('axios');
const fs        = require('fs');
const path      = require('path');

const app        = express();
const PORT       = process.env.PORT || 3000;
const gameConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

// ─── Progress persistence ─────────────────────────────────────────────────────

const DATA_DIR     = path.join(__dirname, 'data');
const PROGRESS_FILE = path.join(DATA_DIR, 'users_progress.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR))     fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(PROGRESS_FILE)) fs.writeFileSync(PROGRESS_FILE, '{}', 'utf-8');
}

function loadAllProgress() {
    ensureDataDir();
    try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')); }
    catch { return {}; }
}

function saveAllProgress(data) {
    ensureDataDir();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getUserProgress(userId) {
    const all = loadAllProgress();
    if (!all[userId]) {
        all[userId] = { solvedPuzzles: [], firstLogin: new Date().toISOString() };
        saveAllProgress(all);
    }
    return all[userId];
}

function addSolvedPuzzle(userId, puzzleId) {
    const all = loadAllProgress();
    if (!all[userId]) all[userId] = { solvedPuzzles: [] };
    if (!all[userId].solvedPuzzles.includes(puzzleId)) {
        all[userId].solvedPuzzles.push(puzzleId);
    }
    all[userId].lastUpdated = new Date().toISOString();
    saveAllProgress(all);
    return all[userId];
}

// ─── Discord OAuth2 ───────────────────────────────────────────────────────────

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done)  => done(null, obj));

passport.use(new Discord.Strategy(
    {
        clientID:     process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL:  process.env.DISCORD_CALLBACK_URL,
        scope:        ['identify'],
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Use bot token to query guild member data (roles, nick, etc.)
            const memberRes = await axios.get(
                `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${profile.id}`,
                {
                    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
                    timeout: 5000,
                }
            );
            const member = memberRes.data;
            profile.hasRequiredRole = member.roles.includes(process.env.REQUIRED_ROLE_ID);
            profile.guildNick       = member.nick || profile.global_name || profile.username;
        } catch {
            // User is not in the guild, or bot token is misconfigured
            profile.hasRequiredRole = false;
            profile.guildNick       = profile.global_name || profile.username;
        }
        return done(null, profile);
    }
));

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret:            process.env.SESSION_SECRET || 'delacroix-occult-archives-fallback',
    resave:            false,
    saveUninitialized: false,
    cookie:            { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true },
}));

app.use(passport.initialize());
app.use(passport.session());

// ─── Auth guards ──────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect('/');
    next();
}

function requireRole(req, res, next) {
    if (!req.user?.hasRequiredRole) return res.redirect('/denied');
    next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return req.user.hasRequiredRole ? res.redirect('/dashboard') : res.redirect('/denied');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/auth/discord',
    passport.authenticate('discord')
);

app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/?error=auth_failed' }),
    (req, res) => {
        if (!req.user.hasRequiredRole) return res.redirect('/denied');
        res.redirect('/dashboard');
    }
);

app.get('/denied', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'denied.html'));
});

app.get('/dashboard', requireAuth, requireRole, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

// ─── API ──────────────────────────────────────────────────────────────────────

app.get('/api/user', requireAuth, requireRole, (req, res) => {
    const progress = getUserProgress(req.user.id);
    res.json({
        id:            req.user.id,
        username:      req.user.username,
        avatar:        req.user.avatar,
        guildNick:     req.user.guildNick,
        discriminator: req.user.discriminator,
        progress:      progress.solvedPuzzles,
        config: {
            puzzle1Enabled: gameConfig.PUZZLE_1_ENABLED,
            puzzle2Enabled: gameConfig.PUZZLE_2_ENABLED,
            puzzle3Enabled: gameConfig.PUZZLE_3_ENABLED,
        },
    });
});

app.post('/api/unlock', requireAuth, requireRole, (req, res) => {
    const { puzzleId } = req.body;
    const valid = ['puzzle1', 'puzzle2', 'puzzle3'];

    if (!valid.includes(puzzleId)) {
        return res.status(400).json({ success: false, error: 'Invalid puzzle identifier.' });
    }

    const enabledMap = {
        puzzle1: gameConfig.PUZZLE_1_ENABLED,
        puzzle2: gameConfig.PUZZLE_2_ENABLED,
        puzzle3: gameConfig.PUZZLE_3_ENABLED,
    };

    if (!enabledMap[puzzleId]) {
        return res.status(403).json({ success: false, error: 'Puzzle disabled by administrator.' });
    }

    const updated = addSolvedPuzzle(req.user.id, puzzleId);
    return res.json({ success: true, progress: updated.solvedPuzzles });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║     ARCHIVES OCCULTES — INSPECTEUR DELACROIX     ║');
    console.log('  ║                  Serveur Actif                   ║');
    console.log(`  ║         http://localhost:${PORT}                    ║`);
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log('');
});
