require('dotenv').config();

const express   = require('express');
const cookieSession = require('cookie-session');
const passport  = require('passport');
const Discord   = require('passport-discord');
const axios     = require('axios');
const fs        = require('fs');
const path      = require('path');

const app        = express();
const PORT       = process.env.PORT || 3000;
const gameConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

// ─── Solutions (server-side only — never sent to client) ──────────────────────

const SOLUTIONS = {
    puzzle1: ['\u6b7b', '\u546a', '\u8840', '\u9b42'], // 死 呪 血 魂
    puzzle2: 'neuf cordes. lumi\u00e8re polaris\u00e9e. corbeau et d\u00e9claration.',
    puzzle3: [1, 4, 2, 5, 3, 6],
};

const MAX_ATTEMPTS      = 3;
const ATTEMPT_WINDOW    = 60 * 60 * 1000; // 1 heure en ms
const SUPERADMIN_ROLE_ID = '1487136331522900020';

// ─── Progress persistence ─────────────────────────────────────────────────────

const DATA_DIR     = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
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

function getRecentAttempts(userId, puzzleId) {
    const all    = loadAllProgress();
    const user   = all[userId] || {};
    const list   = ((user.attempts || {})[puzzleId]) || [];
    const cutoff = Date.now() - ATTEMPT_WINDOW;
    return list.filter(t => t > cutoff);
}

function recordAttempt(userId, puzzleId) {
    const all    = loadAllProgress();
    if (!all[userId])                    all[userId] = { solvedPuzzles: [] };
    if (!all[userId].attempts)           all[userId].attempts = {};
    if (!all[userId].attempts[puzzleId]) all[userId].attempts[puzzleId] = [];
    const cutoff = Date.now() - ATTEMPT_WINDOW;
    all[userId].attempts[puzzleId] = all[userId].attempts[puzzleId].filter(t => t > cutoff);
    all[userId].attempts[puzzleId].push(Date.now());
    saveAllProgress(all);
}

function attemptsLeft(userId, puzzleId) {
    return Math.max(0, MAX_ATTEMPTS - getRecentAttempts(userId, puzzleId).length);
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
            profile.isSuperAdmin    = member.roles.includes(SUPERADMIN_ROLE_ID);
            profile.hasRequiredRole = profile.isSuperAdmin || member.roles.includes(process.env.REQUIRED_ROLE_ID);
            profile.guildNick       = member.nick || profile.global_name || profile.username;
        } catch {
            // User is not in the guild, or bot token is misconfigured
            profile.isSuperAdmin    = false;
            profile.hasRequiredRole = false;
            profile.guildNick       = profile.global_name || profile.username;
        }
        return done(null, profile);
    }
));

// ─── Middleware ───────────────────────────────────────────────────────────────

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieSession({
    name:    'session',
    keys:    [process.env.SESSION_SECRET || 'delacroix-occult-archives-fallback'],
    maxAge:  7 * 24 * 60 * 60 * 1000,
    secure:  true,
    httpOnly: true,
    sameSite: 'lax',
}));

// Passport compatibility shim for cookie-session
app.use((req, res, next) => {
    if (req.session && !req.session.regenerate) req.session.regenerate = (cb) => cb();
    if (req.session && !req.session.save)       req.session.save       = (cb) => cb();
    next();
});

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
    const progress    = getUserProgress(req.user.id);
    const puzzles     = ['puzzle1', 'puzzle2', 'puzzle3'];
    const isSuperAdmin = req.user.isSuperAdmin === true;
    const attempts    = {};
    puzzles.forEach(p => {
        attempts[p] = isSuperAdmin ? 999 : attemptsLeft(req.user.id, p);
    });
    res.json({
        id:            req.user.id,
        username:      req.user.username,
        avatar:        req.user.avatar,
        guildNick:     req.user.guildNick,
        discriminator: req.user.discriminator,
        isSuperAdmin,
        progress:      progress.solvedPuzzles,
        attempts,
        config: {
            puzzle1Enabled: gameConfig.PUZZLE_1_ENABLED,
            puzzle2Enabled: gameConfig.PUZZLE_2_ENABLED,
            puzzle3Enabled: gameConfig.PUZZLE_3_ENABLED,
        },
    });
});

app.post('/api/attempt', requireAuth, requireRole, (req, res) => {
    const { puzzleId, answer } = req.body;
    const valid = ['puzzle1', 'puzzle2', 'puzzle3'];

    if (!valid.includes(puzzleId)) {
        return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
    }

    const enabledMap = {
        puzzle1: gameConfig.PUZZLE_1_ENABLED,
        puzzle2: gameConfig.PUZZLE_2_ENABLED,
        puzzle3: gameConfig.PUZZLE_3_ENABLED,
    };
    if (!enabledMap[puzzleId]) {
        return res.status(403).json({ success: false, error: 'Puzzle désactivé.' });
    }

    // Déjà résolu
    const progress = getUserProgress(req.user.id);
    if (progress.solvedPuzzles.includes(puzzleId)) {
        return res.json({ success: true, alreadySolved: true, progress: progress.solvedPuzzles });
    }

    // Rate limit (superadmin bypass)
    const isSuperAdmin = req.user.isSuperAdmin === true;
    if (!isSuperAdmin) {
        const recent = getRecentAttempts(req.user.id, puzzleId);
        if (recent.length >= MAX_ATTEMPTS) {
            const waitMs  = ATTEMPT_WINDOW - (Date.now() - recent[0]);
            const waitMin = Math.ceil(waitMs / 60000);
            return res.json({ success: false, rateLimit: true, waitMinutes: waitMin, attemptsLeft: 0 });
        }
        recordAttempt(req.user.id, puzzleId);
    }
    const left = isSuperAdmin ? 999 : attemptsLeft(req.user.id, puzzleId);

    // Validation
    let correct = false;
    const sol = SOLUTIONS[puzzleId];
    if (puzzleId === 'puzzle1' || puzzleId === 'puzzle3') {
        correct = Array.isArray(answer) &&
                  answer.length === sol.length &&
                  answer.every((v, i) => String(v) === String(sol[i]));
    } else if (puzzleId === 'puzzle2') {
        correct = typeof answer === 'string' && answer.trim().toLowerCase() === sol;
    }

    if (correct) {
        const updated = addSolvedPuzzle(req.user.id, puzzleId);
        return res.json({ success: true, progress: updated.solvedPuzzles, attemptsLeft: left });
    }

    return res.json({ success: false, attemptsLeft: left });
});

// ─── Start ────────────────────────────────────────────────────────────────────

module.exports = app;

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log('');
        console.log('  ╔══════════════════════════════════════════════════╗');
        console.log('  ║     ARCHIVES OCCULTES — INSPECTEUR DELACROIX     ║');
        console.log('  ║                  Serveur Actif                   ║');
        console.log(`  ║         http://localhost:${PORT}                    ║`);
        console.log('  ╚══════════════════════════════════════════════════╝');
        console.log('');
    });
}
