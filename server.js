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
    puzzle4: 'le corps doit survivre \u00e0 l\'\u00e2me.',
};

const MAX_ATTEMPTS       = 3;
const ATTEMPT_WINDOW     = 60 * 60 * 1000; // 1 heure en ms
const SUPERADMIN_ROLE_ID = '1487136331522900020';
const SECRET_ROLE_ID     = '1490112515827568710';
const ENIGMA_FOUND_CHANNEL_ID = process.env.ENIGMA_FOUND_CHANNEL_ID || '1490141439194173541';
const SECRET_SOLUTION    = ['\u9b3c', '\u970a', '\u708e', '\u5df1']; // 鬼 霊 炎 己

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

function hasSecretCombo(userId) {
    const all = loadAllProgress();
    return !!(all[userId]?.secretCombo);
}

function setSecretCombo(userId) {
    const all = loadAllProgress();
    if (!all[userId]) all[userId] = { solvedPuzzles: [] };
    all[userId].secretCombo  = true;
    all[userId].lastUpdated  = new Date().toISOString();
    saveAllProgress(all);
}

async function notifyEnigmaSolved({ userId, guildNick, username, puzzleId }) {
    if (!process.env.DISCORD_BOT_TOKEN) {
        console.error('Discord notification skipped: DISCORD_BOT_TOKEN is missing.');
        return;
    }

    if (!ENIGMA_FOUND_CHANNEL_ID) {
        console.error('Discord notification skipped: ENIGMA_FOUND_CHANNEL_ID is missing.');
        return;
    }

    const puzzleLabels = {
        puzzle1: 'Énigme 1',
        puzzle2: 'Énigme 2',
        puzzle3: 'Énigme 3',
        puzzle4: 'Énigme 4',
    };

    const displayName = guildNick || username || `Utilisateur ${userId}`;
    const puzzleLabel = puzzleLabels[puzzleId] || puzzleId;
    const content = `✅ ${displayName} (<@${userId}>) a trouvé ${puzzleLabel}.`;

    try {
        await axios.post(
            `https://discord.com/api/v10/channels/${ENIGMA_FOUND_CHANNEL_ID}/messages`,
            { content },
            {
                headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
                timeout: 5000,
            }
        );
    } catch (err) {
        const status = err?.response?.status || 'n/a';
        const reason = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'unknown error';
        console.error(`Discord notification failed for solved enigma (channel ${ENIGMA_FOUND_CHANNEL_ID}, user ${userId}): status=${status}, reason=${reason}`);
    }
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

            // Before the deadline, all guild members are allowed in
            const LOGIN_REWARD_ROLE_ID = '1482417191168118794';
            const deadline = new Date('2026-04-05T18:00:00+02:00');
            const beforeDeadline = Date.now() < deadline.getTime();
            profile.hasRequiredRole = profile.isSuperAdmin || beforeDeadline || member.roles.includes(process.env.REQUIRED_ROLE_ID);
            profile.guildNick       = member.nick || profile.global_name || profile.username;

            // Assign login reward role automatically — only before deadline
            if (beforeDeadline && !member.roles.includes(LOGIN_REWARD_ROLE_ID)) {
                await axios.put(
                    `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${profile.id}/roles/${LOGIN_REWARD_ROLE_ID}`,
                    null,
                    {
                        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
                        timeout: 5000,
                    }
                ).catch(() => {}); // silently ignore if bot lacks permission
            }
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
    const puzzles     = ['puzzle1', 'puzzle2', 'puzzle3', 'puzzle4'];
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
        hasSecretRole: hasSecretCombo(req.user.id),
        progress:      progress.solvedPuzzles,
        attempts,
        config: {
            puzzle1Enabled: gameConfig.PUZZLE_1_ENABLED,
            puzzle2Enabled: gameConfig.PUZZLE_2_ENABLED,
            puzzle3Enabled: gameConfig.PUZZLE_3_ENABLED,
            puzzle4Enabled: gameConfig.PUZZLE_4_ENABLED,
        },
    });
});

app.post('/api/attempt', requireAuth, requireRole, async (req, res) => {
    const { puzzleId, answer } = req.body;
    const valid = ['puzzle1', 'puzzle2', 'puzzle3', 'puzzle4'];

    if (!valid.includes(puzzleId)) {
        return res.status(400).json({ success: false, error: 'Identifiant invalide.' });
    }

    const enabledMap = {
        puzzle1: gameConfig.PUZZLE_1_ENABLED,
        puzzle2: gameConfig.PUZZLE_2_ENABLED,
        puzzle3: gameConfig.PUZZLE_3_ENABLED,
        puzzle4: gameConfig.PUZZLE_4_ENABLED,
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
    } else if (puzzleId === 'puzzle2' || puzzleId === 'puzzle4') {
        const norm = s => s.trim().toLowerCase().replace(/\u2019/g, "'");
        correct = typeof answer === 'string' && norm(answer) === norm(sol);
    }

    if (correct) {
        const updated = addSolvedPuzzle(req.user.id, puzzleId);
        await notifyEnigmaSolved({
            userId: req.user.id,
            guildNick: req.user.guildNick,
            username: req.user.username,
            puzzleId,
        });
        return res.json({ success: true, progress: updated.solvedPuzzles, attemptsLeft: left });
    }

    return res.json({ success: false, attemptsLeft: left });
});

// ─── Secret combination ───────────────────────────────────────────────────────

app.post('/api/secret-combo', requireAuth, requireRole, async (req, res) => {
    const { answer } = req.body;

    const correct = Array.isArray(answer) &&
                    answer.length === SECRET_SOLUTION.length &&
                    answer.every((v, i) => String(v) === String(SECRET_SOLUTION[i]));

    if (!correct) return res.json({ success: false });

    if (hasSecretCombo(req.user.id)) {
        return res.json({ success: true, alreadyUnlocked: true });
    }

    // Assign Discord role — silently ignore if bot lacks permission
    try {
        await axios.put(
            `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${req.user.id}/roles/${SECRET_ROLE_ID}`,
            null,
            { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }, timeout: 5000 }
        );
    } catch { /* ignore */ }

    setSecretCombo(req.user.id);
    return res.json({ success: true });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

app.post('/api/admin/reset', requireAuth, requireRole, (req, res) => {
    if (!req.user.isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'Accès refusé.' });
    }

    const { userId } = req.body;
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ success: false, error: 'userId manquant.' });
    }

    const all = loadAllProgress();
    if (!all[userId]) {
        return res.status(404).json({ success: false, error: 'Joueur introuvable.' });
    }

    all[userId].solvedPuzzles = [];
    all[userId].attempts      = {};
    all[userId].lastUpdated   = new Date().toISOString();
    saveAllProgress(all);

    return res.json({ success: true });
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
