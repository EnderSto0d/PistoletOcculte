/* ============================================================
   ARCHIVES OCCULTES — Client Application
   All lore content, puzzle logic, navigation, and audio.
   ============================================================ */


// ─── State ────────────────────────────────────────────────────────────────────
const state = {
    user:          null,
    progress:      [],   // ['puzzle1', 'puzzle2', 'puzzle3']
    config:        {},
    attempts:      {},   // { puzzle1: 3, puzzle2: 2, ... } essais restants
    currentPage:   'training-1',
    isSuperAdmin:  false,
    playerView:    false, // superadmin toggle: see site as normal player
    hasSecretRole: false, // combinaison secrète trouvée
};

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    // Animate loading bar
    const fill = document.getElementById('loadingFill');
    let pct = 0;
    const loadTimer = setInterval(() => {
        pct = Math.min(pct + Math.random() * 18, 85);
        fill.style.width = pct + '%';
    }, 200);

    try {
        const res = await fetch('/api/user');
        if (!res.ok) { window.location = '/'; return; }
        const data = await res.json();
        state.user        = data;
        state.progress    = data.progress    || [];
        state.config      = data.config      || {};
        state.attempts    = data.attempts    || { puzzle1: 3, puzzle2: 3, puzzle3: 3, puzzle4: 3 };
        state.isSuperAdmin  = data.isSuperAdmin  === true;
        state.hasSecretRole = data.hasSecretRole === true;
    } catch {
        window.location = '/';
        return;
    }

    clearInterval(loadTimer);
    fill.style.width = '100%';

    await sleep(400);

    const ls = document.getElementById('loading-screen');
    ls.style.opacity = '0';
    setTimeout(() => { ls.style.display = 'none'; }, 600);

    const appEl = document.getElementById('app');
    appEl.style.display = 'flex';

    renderUserPanel();
    renderNav();
    navigateTo('training-1');
    initSoundToggle();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isSuperAdminUnlocked() { return state.isSuperAdmin && !state.playerView; }
function isSolved(puzzleId)  { return isSuperAdminUnlocked() || state.progress.includes(puzzleId); }
function hasSecretAccess()   { return (state.hasSecretRole || isSuperAdminUnlocked()) && !state.playerView; }
function isEnabled(puzzleId) {
    if (isSuperAdminUnlocked()) return true;
    const map = { puzzle1: state.config.puzzle1Enabled, puzzle2: state.config.puzzle2Enabled, puzzle3: state.config.puzzle3Enabled, puzzle4: state.config.puzzle4Enabled };
    return map[puzzleId] !== false;
}

function flashSuccess() {
    const el = document.createElement('div');
    el.className = 'success-flash';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
    sound.playSuccess();
}

// ─── User Panel ───────────────────────────────────────────────────────────────
function renderUserPanel() {
    const { username, avatar, id, guildNick } = state.user;
    const avatarUrl = avatar
        ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;

    document.getElementById('user-avatar').src = avatarUrl;
    document.getElementById('user-name').textContent = guildNick || username;

    if (state.isSuperAdmin) {
        const badgeEl = document.getElementById('user-badge');
        badgeEl.textContent = state.playerView ? 'VUE JOUEUR' : 'SUPERADMIN';
        badgeEl.style.color = state.playerView ? '' : 'var(--gold)';

        let toggleBtn = document.getElementById('superadmin-toggle');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'superadmin-toggle';
            toggleBtn.style.cssText = 'margin-top:0.5rem;width:100%;font-size:0.7rem;padding:0.3rem 0.5rem;background:transparent;border:1px solid var(--gold);color:var(--gold);cursor:pointer;font-family:inherit;letter-spacing:0.05em;';
            document.getElementById('user-badge').insertAdjacentElement('afterend', toggleBtn);
            toggleBtn.addEventListener('click', () => {
                state.playerView = !state.playerView;
                renderUserPanel();
                renderNav();
                navigateTo(state.currentPage);
            });
        }
        toggleBtn.textContent = state.playerView ? '⚙ MODE SUPERADMIN' : '👁 VUE JOUEUR';

        let resetBtn = document.getElementById('superadmin-reset');
        if (!resetBtn) {
            resetBtn = document.createElement('button');
            resetBtn.id = 'superadmin-reset';
            resetBtn.style.cssText = 'margin-top:0.3rem;width:100%;font-size:0.7rem;padding:0.3rem 0.5rem;background:transparent;border:1px solid #8b1a1a;color:#8b1a1a;cursor:pointer;font-family:inherit;letter-spacing:0.05em;';
            toggleBtn.insertAdjacentElement('afterend', resetBtn);
            resetBtn.addEventListener('click', async () => {
                const userId = prompt('Discord User ID du joueur à réinitialiser :');
                if (!userId || !userId.trim()) return;
                if (!confirm(`Réinitialiser toute la progression de ${userId.trim()} ?`)) return;
                try {
                    const r = await fetch('/api/admin/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: userId.trim() }),
                    });
                    const data = await r.json();
                    if (data.success) {
                        alert('Progression réinitialisée.');
                    } else {
                        alert('Erreur : ' + (data.error || 'inconnue'));
                    }
                } catch {
                    alert('Erreur réseau.');
                }
            });
        }
        resetBtn.textContent = '↺ RÉINITIALISER PROGRESSION';
    } else {
        const solved = state.progress.length;
        const badges = ['INITIÉ', 'PRATIQUANT', 'ÉVEILLÉ', 'MAÎTRE OCCULTE'];
        document.getElementById('user-badge').textContent = badges[Math.min(solved, 3)];
    }
}

// ─── Navigation ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
    // Introduction
    { id: 'training-1', label: 'Introduction',                    section: 'intro',    icon: '📜', req: null },
    // Méthodes d'Entraînement
    { id: 'training-2', label: 'Méthode I — Fondation',           section: 'training', icon: '✦',  req: null },
    { id: 'training-3', label: 'Méthode II — Précision',          section: 'training', icon: '✦',  req: null },
    { id: 'training-4', label: 'Méthode III — Sang-Froid',        section: 'training', icon: '✦',  req: null },
    { id: 'training-5', label: 'Méthode IV — Contrecoup',         section: 'training', icon: '✦',  req: null },
    // Journal
    { id: 'journal-1',  label: 'Entrée I — L\'Éveil',             section: 'journal',  icon: '📖', req: null },
    { id: 'journal-2',  label: 'Entrée II — La Forge',            section: 'journal',  icon: '📖', req: 'puzzle1' },
    { id: 'journal-3',  label: 'Entrée III — Les Reliques',       section: 'journal',  icon: '📖', req: 'puzzle2' },
    { id: 'journal-4',  label: 'Entrée IV — Le Grand Départ',     section: 'journal',  icon: '📖', req: 'puzzle3' },
];

function renderNav() {
    const introList    = document.getElementById('nav-intro');
    const trainingList = document.getElementById('nav-training');
    const journalList  = document.getElementById('nav-journal');
    introList.innerHTML    = '';
    trainingList.innerHTML = '';
    journalList.innerHTML  = '';

    NAV_ITEMS.forEach(item => {
        const li = document.createElement('li');
        const unlocked = !item.req || isSolved(item.req) || (item.section === 'journal' && hasSecretAccess());
        const disabled = item.req && !isEnabled(item.req) && !unlocked;

        let cls = 'nav-item';
        let statusIcon = '';

        if (state.currentPage === item.id) cls += ' active';

        if (disabled) {
            cls += ' nav-item--disabled';
            statusIcon = '✖';
        } else if (!unlocked) {
            cls += ' nav-item--locked';
            statusIcon = '🔒';
        } else {
            statusIcon = item.section === 'journal' ? '✦' : '';
        }

        li.className = cls;
        li.innerHTML = `
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
            <span class="nav-status">${statusIcon}</span>
        `;

        if (unlocked && !disabled) {
            li.addEventListener('click', () => navigateTo(item.id));
        }

        if (item.section === 'intro')         introList.appendChild(li);
        else if (item.section === 'training') trainingList.appendChild(li);
        else                                  journalList.appendChild(li);
    });
}

function navigateTo(pageId) {
    state.currentPage = pageId;
    renderNav();

    const area = document.getElementById('content-area');
    area.style.opacity = '0';

    const PAGE_RENDERERS = {
        'training-1': renderTraining1,
        'training-2': renderTraining2,
        'training-3': renderTraining3,
        'training-4': renderTraining4,
        'training-5': renderTraining5,
        'journal-1':  renderJournal1,
        'journal-2':  renderJournal2,
        'journal-3':  renderJournal3,
        'journal-4':  renderJournal4,
    };

    const renderer = PAGE_RENDERERS[pageId] || (() => '<p>Page introuvable.</p>');

    setTimeout(async () => {
        const result = renderer();
        area.innerHTML = result instanceof Promise ? await result : result;
        area.style.opacity = '1';
        area.style.transition = 'opacity 0.4s ease';
        initPageHandlers(pageId);
    }, 200);
}

function initPageHandlers(pageId) {
    if (pageId === 'training-2') {
        if (isSolved('puzzle1')) {
            fetchProtectedContent('chapter2').then(html => {
                const el = document.getElementById('training2-body');
                if (el && html) el.innerHTML = html;
            });
        } else {
            initKanjiPuzzle();
        }
    }
    if (pageId === 'training-3') {
        if (isSolved('puzzle2')) {
            fetchProtectedContent('chapter3').then(html => {
                const el = document.getElementById('training3-body');
                if (el && html) el.innerHTML = html;
            });
        } else {
            initIncantationPuzzle();
        }
    }
    if (pageId === 'training-4') {
        if (isSolved('puzzle3')) {
            fetchProtectedContent('chapter4').then(html => {
                const el = document.getElementById('training4-body');
                if (el && html) el.innerHTML = html;
            });
        } else {
            initPatternPuzzle();
        }
    }
    if (pageId === 'training-5') {
        if (isSolved('puzzle4')) {
            fetchProtectedContent('chapter5').then(html => {
                const el = document.getElementById('training5-body');
                if (el && html) el.innerHTML = html;
            });
        } else {
            initLetterPuzzle();
        }
    }
}

// ─── API: Attempt Puzzle ──────────────────────────────────────────────────────
function getAttemptsLeft(puzzleId) {
    if (state.isSuperAdmin) return 999;
    return state.attempts[puzzleId] ?? 3;
}

async function attemptPuzzle(puzzleId, answer) {
    const res  = await fetch('/api/attempt', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ puzzleId, answer }),
    });
    const data = await res.json();
    if (data.success && !data.alreadySolved) {
        state.progress             = data.progress;
        state.attempts[puzzleId]   = data.attemptsLeft ?? 0;
        flashSuccess();
        await sleep(800);
        renderNav();
        navigateTo(state.currentPage);
    } else if (!data.success && data.attemptsLeft !== undefined) {
        state.attempts[puzzleId] = data.attemptsLeft;
    }
    return data;
}

// ─── API: Fetch protected content ─────────────────────────────────────────────
async function fetchProtectedContent(pageId) {
    try {
        const res = await fetch(`/api/content/${pageId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.html || null;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════
//  PAGE CONTENT — TRAINING
// ═══════════════════════════════════════════════════════════

function renderTraining1() {
    return `
<div class="doc-paper">
    <div class="doc-header">
        <div class="doc-classification">ACCÈS RESTREINT — EN ATTENTE DE CONFIRMATION</div>
        <div class="doc-title">MANUEL D'ENTRAÎNEMENT AU PISTOLET OCCULTE</div>
        <div class="doc-subtitle">Introduction — Lettre au Successeur</div>
        <div class="doc-meta">
            <span>Rédigé par : Insp. H. DELACROIX</span>
            <span>Réf : DEL/1893/MAN/I</span>
        </div>
    </div>

    <div class="doc-body">
        <div class="doc-section">
            <div class="doc-section-title">À CELUI OU CELLE QUI TIENT CES PAGES</div>
            <p class="doc-p">
                Si ce dossier est entre vos mains, c'est que quelqu'un a jugé que vous méritez de connaître
                la vérité. Ou que la vérité, impatiente, a décidé de vous trouver elle-même.
            </p>
            <p class="doc-p">
                Je suis Henri Delacroix, Inspecteur Principal de la Brigade Criminelle de Paris.
                Ce manuel documente ce qu'il faut savoir pour maîtriser l'arme qui vous a été — ou
                vous sera — confiée. Il ne vous sera pas remis d'un coup. Il se déverrouille
                à mesure que vous progressez.
            </p>
            <p class="doc-p">
                Ce que vous tenez en ce moment n'est que l'entrée. La suite appartient à ceux qui
                auront prouvé qu'ils méritent de la lire.
            </p>
            <div class="doc-warning">
                ⚠ Ce dossier est protégé par des épreuves successives. Chaque section ne s'ouvre
                qu'une fois la précédente maîtrisée. Ces épreuves ne jugent pas votre courage —
                elles jugent votre préparation. Un successeur non préparé est plus dangereux
                qu'un ennemi déclaré.
            </div>
        </div>

        <hr class="doc-rule">

        <div class="diary-final-line">— H. Delacroix, Inspecteur Principal, Paris, 1893</div>
    </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

function renderTraining2() {
    if (!isEnabled('puzzle1')) return renderCorrupted();

    const solved = isSolved('puzzle1');

    return `
<div class="doc-paper">
    <div class="doc-header">
        <div class="doc-classification">DOSSIER CONFIDENTIEL — INITIÉ CONFIRMÉ</div>
        <div class="doc-title">MANUEL D'ENTRAÎNEMENT AU PISTOLET OCCULTE</div>
        <div class="doc-subtitle">Première Méthode — Fondation et Ancrage</div>
        <div class="doc-meta">
            <span>Rédigé par : Insp. H. DELACROIX</span>
            <span>Réf : DEL/1893/MAN/II</span>
        </div>
    </div>

    <div class="doc-body" id="training2-body">
        ${solved ? '<div class="content-loading">Consultation des archives...</div>' : renderPuzzle1Gate()}
    </div>
</div>`;
}

function renderPuzzle1Gate() {
    return `
<div style="text-align:center; margin-bottom:1.5rem;">
    <p class="doc-p" style="font-style:italic;">
        Cette méthode est scellée par les <strong>Quatre Sceaux du Pistolet Occulte</strong>.
        Avant de porter l'arme, prouvez que vous en connaissez l'âme : identifiez les quatre
        kanjis gravés sur son canon, dans leur ordre exact de gravure.
    </p>
</div>

<div class="puzzle-gate">
    <div class="puzzle-gate-title">LES QUATRE SCEAUX</div>
    <div class="puzzle-gate-subtitle">VERROU I — IDENTIFICATION PAR SÉQUENCE</div>
    <div class="puzzle-divider"></div>
    ${renderKanjiGrid()}
</div>`;
}

function renderTraining3() {
    if (!isEnabled('puzzle2')) return renderCorrupted();
    if (!isSolved('puzzle1'))  return renderLockedChapter('puzzle1', 'Méthode I', 'training-2');

    const solved = isSolved('puzzle2');
    return `
<div class="doc-paper">
    <div class="doc-header">
        <div class="doc-classification">DOSSIER CONFIDENTIEL — OPÉRATEUR CONFIRMÉ</div>
        <div class="doc-title">MANUEL D'ENTRAÎNEMENT AU PISTOLET OCCULTE</div>
        <div class="doc-subtitle">Deuxième Méthode — Focalisation et Précision de l'Âme</div>
        <div class="doc-meta">
            <span>Rédigé par : Insp. H. DELACROIX</span>
            <span>Réf : DEL/1893/MAN/III</span>
        </div>
    </div>
    <div class="doc-body" id="training3-body">
        ${solved ? '<div class="content-loading">Consultation des archives...</div>' : renderPuzzle2Gate()}
    </div>
</div>`;
}

function renderPuzzle2Gate() {
    return `
<div style="text-align:center; margin-bottom:1.5rem;">
    <p class="doc-p" style="font-style:italic;">
        La précision requiert une clarté d'expression totale. Ce verrou prend la forme d'une
        <strong>incantation</strong> — les mots exacts qui ancrent le tireur dans l'espace
        occulte au moment de viser. Prononcer cette phrase sans hésitation ni approximation
        est en soi un acte de précision.
    </p>
</div>
<div class="puzzle-gate">
    <div class="puzzle-gate-title">L'INCANTATION DE FOCALISATION</div>
    <div class="puzzle-gate-subtitle">VERROU II — FORMULATION OCCULTE EXACTE</div>
    <div class="puzzle-divider"></div>
    <div class="incantation-wrap">
        <input
            type="text"
            id="incantation-input"
            class="incantation-input"
            placeholder="Prononcez l'incantation..."
            autocomplete="off"
            spellcheck="false"
        />
        <p class="incantation-hint">Respectez la ponctuation. La casse n'est pas importante.</p>
        <button class="btn-validate" id="incantation-submit">Invoquer</button>
        <p class="puzzle-attempts" id="incantation-attempts"></p>
    </div>
</div>`;
}

function renderTraining4() {
    if (!isEnabled('puzzle3')) return renderCorrupted();
    if (!isSolved('puzzle2'))  return renderLockedChapter('puzzle2', 'Méthode II', 'training-3');

    const solved = isSolved('puzzle3');
    return `
<div class="doc-paper">
    <div class="doc-header">
        <div class="doc-classification">DOSSIER CONFIDENTIEL — OPÉRATEUR EXPERT</div>
        <div class="doc-title">MANUEL D'ENTRAÎNEMENT AU PISTOLET OCCULTE</div>
        <div class="doc-subtitle">Troisième Méthode — L'Art du Sang-Froid</div>
        <div class="doc-meta">
            <span>Rédigé par : Insp. H. DELACROIX</span>
            <span>Réf : DEL/1893/MAN/IV</span>
        </div>
    </div>
    <div class="doc-body" id="training4-body">
        ${solved ? '<div class="content-loading">Consultation des archives...</div>' : renderPuzzle3Gate()}
    </div>
</div>`;
}

function renderPuzzle3Gate() {
    return `
<div style="text-align:center; margin-bottom:1.5rem;">
    <p class="doc-p" style="font-style:italic;">
        Vous avez atteint la Troisième Méthode. L'art de maîtriser cet artefact repose avant tout
        sur la lucidité et le sang-froid. Les Fléaux que vous affronterez useront de tout pour
        vous empêcher de tirer. La peur, le doute, la pitié feront trembler votre canon.
        <strong>Votre esprit doit être une mer d'huile.</strong>
    </p>
</div>
<div class="puzzle-gate">
    <div class="puzzle-gate-title">LA SYNCHRONISATION DU BARILLET</div>
    <div class="puzzle-gate-subtitle">VERROU III — MAINS ASSURÉES, SÉQUENCE EXACTE</div>
    <div class="puzzle-divider"></div>
    <div class="pattern-wrap">
        <p class="pattern-lore">
            Six chambres. Six points de puissance.<br>
            Connectez-les dans le bon ordre, sans trembler.
        </p>
        ${renderPatternSVG()}
        <p class="puzzle-attempts" id="pattern-attempts"></p>
        <div class="pattern-sequence-display" id="pattern-display">○ ○ ○ ○ ○ ○</div>
        <button class="pattern-reset-btn" id="pattern-reset">Réinitialiser</button>
    </div>
</div>`;
}

function renderPatternSVG() {
    // 6 dots in a circle (revolver cylinder), r=100, center=130,130
    const cx = 130, cy = 130, r = 100;
    const dots = [];
    for (let i = 0; i < 6; i++) {
        const angleDeg = -90 + i * 60;
        const angleRad = angleDeg * Math.PI / 180;
        dots.push({
            n: i + 1,
            x: Math.round(cx + r * Math.cos(angleRad)),
            y: Math.round(cy + r * Math.sin(angleRad)),
        });
    }

    const dotsSVG = dots.map(d => `
        <circle class="pattern-dot" data-dot="${d.n}" cx="${d.x}" cy="${d.y}" r="18"/>
        <text class="pattern-num" x="${d.x}" y="${d.y}">${d.n}</text>
    `).join('');

    return `
<svg id="pattern-svg" viewBox="0 0 260 260" width="260" height="260">
    <g id="pattern-lines"></g>
    ${dotsSVG}
</svg>`;
}

function renderTraining5() {
    if (!isEnabled('puzzle3')) return renderCorrupted();
    if (!isSolved('puzzle3'))  return renderLockedChapter('puzzle3', 'Méthode III', 'training-4');
    if (!isEnabled('puzzle4')) return renderCorrupted();

    const solved = isSolved('puzzle4');
    return `
<div class="doc-paper">
    <div class="doc-header">
        <div class="doc-classification">DOSSIER CONFIDENTIEL — MAÎTRE CONFIRMÉ</div>
        <div class="doc-title">MANUEL D'ENTRAÎNEMENT AU PISTOLET OCCULTE</div>
        <div class="doc-subtitle">Quatrième Méthode — L'Encaissement du Contrecoup</div>
        <div class="doc-meta">
            <span>Rédigé par : Insp. H. DELACROIX</span>
            <span>Réf : DEL/1893/MAN/V</span>
        </div>
    </div>

    <div class="doc-body" id="training5-body">
        ${solved ? '<div class="content-loading">Consultation des archives...</div>' : renderPuzzle4Gate()}
    </div>
</div>`;
}

function renderPuzzle4Gate() {
    return `
<div class="doc-section">
    <div class="doc-section-title">VOUS RECEVEZ L'ARME</div>
    <p class="doc-p">
        Si vous lisez ces lignes, vous avez franchi les trois premiers verrous. Votre
        Fondation est établie. Votre Précision est formée. Votre Sang-Froid est forgé.
        L'arme vous est maintenant remise — non plus comme un concept décrit dans ces
        pages, mais comme un outil concret dans votre main.
    </p>
    <p class="doc-p">
        Prenez-en soin. Ne la confiez à personne qui n'ait pas assimilé l'intégralité
        de ce manuel. Ne la laissez jamais hors de portée dans un environnement à risque.
        Et ne tirez jamais plus de deux balles imprégnées simultanément.
        <strong>Jamais.</strong>
    </p>
</div>

<hr class="doc-rule">

<div class="doc-section">
    <div class="doc-section-title">LA BALLE INCENDIAIRE — AVERTISSEMENT</div>
    <p class="doc-p">
        Le Pistolet Occulte recèle une technique destructrice que je n'ai utilisée qu'une
        seule fois — et qui m'a valu deux jours d'inconscience. Je l'appelle la
        <strong>Balle Incendiaire</strong> : une concentration maximale d'Énergie Maudite,
        compressée dans une seule munition jusqu'à saturation complète du circuit des sceaux,
        puis libérée en une fraction de seconde.
    </p>
    <p class="doc-p">
        L'effet sur la cible est décisif. Sur le tireur, en l'absence de préparation
        adéquate, il est dévastateur. Le recul généré n'est pas celui d'un pistolet.
        C'est celui d'un corps qui concentre l'énergie d'un canal occulte complet en un
        seul point de contact. Un bras non préparé, une épaule non préparée, des côtes
        non préparées — tout cela se fracasse instantanément.
    </p>
    <div class="doc-warning">
        ⚠ La Balle Incendiaire n'est pas accessible à ce stade de votre entraînement.
        Votre corps et votre canal énergétique doivent d'abord être préparés à absorber
        un impact de cette magnitude. Ce qui suit vous y prépare — à condition d'entendre
        ce que le Tombeau murmure, puis de l'éprouver en terrain.
    </div>
</div>

<hr class="doc-rule">

<div class="puzzle-gate">
    <div class="puzzle-gate-title">LA LETTRE SCELLÉE</div>
    <div class="puzzle-gate-subtitle">VERROU IV — LE MOT DU PROFESSEUR LIÚ</div>
    <div class="puzzle-divider"></div>
    <div class="incantation-wrap">
        <p class="incantation-lore">
            Je n'ai consigné dans le manuel que ce qui s'enseigne. Il existe une chose que
            le Professeur Liú m'a dite la nuit de la Balle Incendiaire — une chose qu'il
            n'a jamais répétée et que je n'ai jamais écrite, parce qu'elle ne s'explique
            pas. Elle se comprend ou elle ne se comprend pas.<br><br>
            Cette nuit-là, j'ai survécu parce que j'avais gardé ses mots dans ma tête au
            moment du tir. Si vous avez traversé les trois méthodes avec honnêteté,
            vous savez ce que ces mots signifient.<br><br>
            <em>— H. Delacroix, Paris, 1893</em>
        </p>
        <input
            type="text"
            id="letter-input"
            class="incantation-input"
            placeholder="Saisissez les mots du Professeur Liú..."
            autocomplete="off"
            spellcheck="false"
        />
        <p class="incantation-hint">Respectez la ponctuation. La casse n'est pas importante.</p>
        <button class="btn-validate" id="letter-submit">Transmettre</button>
        <p class="puzzle-attempts" id="letter-attempts"></p>
    </div>
</div>`;
}

function renderJournal1() {
    return `
<div class="doc-paper diary-wrap">
    <div class="doc-header">
        <div class="doc-classification">DOCUMENT PERSONNEL — STRICTEMENT PRIVÉ</div>
        <div class="doc-title">JOURNAL INTIME D'HENRI DELACROIX</div>
        <div class="doc-subtitle">Inspecteur Principal, Brigade Criminelle de Paris</div>
        <div class="doc-meta">
            <span>Commencé le 14 octobre 1892</span>
            <span>Entrée I — L'Éveil</span>
        </div>
    </div>

    <div class="doc-body">

    <div class="diary-entry">
        <div class="diary-date">14 OCTOBRE 1892 — PARIS, 13ème ARRONDISSEMENT</div>
        <p class="diary-line">Je commence ce journal parce que je ne sais plus à qui parler. Bertrand, mon partenaire depuis huit ans, m'a regardé ce matin comme si j'avais perdu la raison. Peut-être l'ai-je perdu. Mais si c'est le cas, alors la folie est bien plus structurée que je ne le croyais.</p>
        <p class="diary-line">L'affaire a commencé le 7 octobre. Trois corps retrouvés en cinq jours, tous dans le même secteur de la Butte-aux-Cailles. Pas de blessures apparentes. Pas de traces de violence. Les yeux ouverts — grand ouverts, avec une expression que je n'ai vue sur aucun visage humain de toute ma carrière. Pas de la peur. Quelque chose de plus... absolu.</p>
        <p class="diary-line">Le médecin légiste a parlé d'« arrêt cardiaque massif de cause indéterminée. » J'ai vu des arrêts cardiaques. Cela ne ressemble pas à ça.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">22 OCTOBRE 1892 — NOTE DE TERRAIN</div>
        <p class="diary-line">J'ai passé trois nuits dans ce quartier. La quatrième victime : le vieux Marchais, cordonnier rue Bobillot. Retrouvé par sa femme au lever du soleil. Même expression. Même cause « indéterminée ».</p>
        <p class="diary-line">Cette nuit-là, j'étais à cent mètres. Je n'ai rien entendu. Mais j'ai ressenti quelque chose.</p>
        <p class="diary-line">Il y a des mots pour décrire cette sensation. Je les ai évités pendant des semaines parce qu'ils me semblaient appartenir au vocabulaire des hystériques et des mystiques. Mais la précision exige que je les emploie maintenant.</p>
        <p class="diary-line">C'était une <em>pression</em>. Une présence. Quelque chose qui n'occupait pas exactement l'espace physique, mais qui en occupait... un autre. Superposé. Comme une page de texte transparente posée sur une autre.</p>
        <p class="diary-line">Je me suis dit que c'était la fatigue.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">3 NOVEMBRE 1892 — LE SOIR. JE TREMBLE ENCORE EN ÉCRIVANT.</div>
        <p class="diary-line">Ce soir, je l'ai VU.</p>
        <p class="diary-line">Pas avec les yeux, d'abord. La pression, encore — mais cent fois plus intense, dans la ruelle derrière l'impasse Nationale. Et puis quelque chose a changé dans ma vision. Pas un évanouissement. Pas une hallucination comme j'en ai lues dans les traités de médecine. Plutôt... une superposition. Une seconde couche de réalité qui devenait visible, comme si mes yeux avaient appris à lire un second alphabet sans que je leur aie demandé.</p>
        <p class="diary-line">C'était une forme.</p>
        <p class="diary-line">Je suis inspecteur depuis seize ans. J'ai vu des hommes tués, des corps en décomposition, des scènes de violence auxquelles la plume résiste à mettre un nom. Mais ce que j'ai vu dans cette ruelle m'a approché de l'effondrement mental total comme aucune de ces expériences ne l'avait fait.</p>
        <p class="diary-line">Une masse. De la taille d'un cheval, peut-être. Sans forme fixe — elle s'étendait et se contractait, comme quelque chose qui respire mais qui n'est pas vivant. De la couleur, difficile à dire, parce que ce n'était pas vraiment de la couleur — plutôt l'absence de toute lumière réelle, un noir qui semblait avaler l'espace autour de lui. Et des filaments sombres, comme du goudron, comme des veines arrachées à un corps géant, qui s'étiraient dans l'air.</p>
        <p class="diary-line">Elle était penchée sur quelqu'un. Une femme, âgée, effondrée contre le mur. Encore vivante — je pouvais voir son souffle.</p>
        <p class="diary-line">J'ai fait ce que tout policier fait. J'ai dégainé mon revolver.</p>
        <p class="diary-line"><strong>J'ai tiré six fois.</strong></p>
        <p class="diary-line">Six balles dans la masse. Chacune est passée au travers comme à travers du brouillard. Elle n'a pas bougé. Elle s'est tournée vers moi.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">4 NOVEMBRE 1892 — LA NUIT SUIVANTE. J'ÉCRIS À LA BOUGIE.</div>
        <p class="diary-line">Je dois documenter ce qui s'est passé ensuite avec la plus grande précision possible, parce que c'est là que se trouve la clé de tout.</p>
        <p class="diary-line">Elle s'est tournée vers moi. Et le regard — il n'y avait pas d'yeux, pas de visage, mais il y avait un regard, une attention, un focus — a pesé sur moi comme une presse d'imprimerie. J'ai senti mes genoux céder.</p>
        <p class="diary-line">Et alors — et c'est là que ma capacité à décrire les choses atteint ses limites — quelque chose en moi s'est brisé. Non. Pas brisé. <em>Ouvert.</em></p>
        <p class="diary-line">Dans le moment de terreur absolue, dans la certitude de ma mort imminente, une énergie que je n'avais jamais remarquée a jailli de quelque part dans ma poitrine. Noire. Dense. Chaude comme de la braise et froide comme une crypte en même temps. Elle a monté dans mes bras, dans mes mains, a envahi le métal de mon revolver — et la créature a reculé.</p>
        <p class="diary-line">Pas d'une balle. Juste de ma présence. De ce que j'étais en train de devenir dans cet instant.</p>
        <p class="diary-line">Elle a disparu. Fondue dans le mur comme si elle n'avait jamais été là.</p>
        <p class="diary-line">La vieille femme s'est réveillée. Elle ne se souvenait de rien. Je lui ai dit qu'elle avait fait un malaise. Je l'ai raccompagnée jusqu'à sa porte.</p>
        <p class="diary-line">Puis je suis rentré chez moi et j'ai vomi pendant une heure.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">12 NOVEMBRE 1892 — RÉFLEXION À TÊTE REPOSÉE</div>
        <p class="diary-line">Une semaine a passé. Je n'ai pas dormi normalement depuis. Mais ma raison — cette bonne vieille raison d'inspecteur que j'ai toujours cultivée comme d'autres cultivent leurs roses — a survécu. Et elle a des questions.</p>
        <p class="diary-line">Question 1 : Qu'est-ce que cette créature ?</p>
        <p class="diary-line">Question 2 : Pourquoi les balles n'ont-elles aucun effet sur elle ?</p>
        <p class="diary-line">Question 3 : Qu'est-ce qui a eu un effet sur elle ?</p>
        <p class="diary-line">Question 4 : D'où venait cette énergie en moi ?</p>
        <p class="diary-line">Je n'ai pas encore les réponses. Mais je suis inspecteur. Je vais trouver.</p>
        <div class="diary-final-line">— H. Delacroix</div>
    </div>

    </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

async function renderJournal2() {
    if (!isSolved('puzzle1') && !hasSecretAccess()) return renderJournalLocked('Sceau de Kanjis', 'training-2');
    const html = await fetchProtectedContent('journal2');
    if (!html) return renderJournalLocked('Sceau de Kanjis', 'training-2');
    return html;
}

async function renderJournal3() {
    if (!isSolved('puzzle2') && !hasSecretAccess()) return renderJournalLocked("L'Incantation", 'training-3');
    const html = await fetchProtectedContent('journal3');
    if (!html) return renderJournalLocked("L'Incantation", 'training-3');
    return html;
}

async function renderJournal4() {
    if (!isSolved('puzzle3') && !hasSecretAccess()) return renderJournalLocked('La Synchronisation du Barillet', 'training-4');
    const html = await fetchProtectedContent('journal4');
    if (!html) return renderJournalLocked('La Synchronisation du Barillet', 'training-4');
    return html;
}

function renderJournalLocked(puzzleName, trainingPage) {
    return `
<div class="doc-paper">
    <div style="text-align:center; padding:3rem 1rem;">
        <div class="journal-locked">
            <span class="journal-lock-icon">🔒</span>
            <p class="journal-locked-msg">
                Cette entrée du Journal Intime est verrouillée.<br><br>
                Elle sera accessible après avoir franchi<br>
                le verrou <strong>« ${puzzleName} »</strong><br>
                dans le Manuel d'Entraînement.<br><br>
                <span style="font-size:0.7rem; opacity:0.6;">
                    Completez d'abord le puzzle correspondant.
                </span>
            </p>
        </div>
    </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════
//  PUZZLE 1 — KANJI GRID
// ═══════════════════════════════════════════════════════════

const ALL_KANJIS = [
    '\u6b7b', '\u798d', '\u706b', '\u9ab8', '\u546a',
    '\u98a8', '\u6c34', '\u571f', '\u6728', '\u91d1',
    '\u8840', '\u95c7', '\u529b', '\u754c', '\u5149',
    '\u9b42', '\u6708', '\u7159', '\u795e', '\u9b3c',
    '\u970a', '\u708e', '\u5df1', '\u5e7d', '\u51a5',
];

function renderKanjiGrid() {
    const shuffled = [...ALL_KANJIS].sort(() => Math.random() - 0.5);
    const cells    = shuffled.map(k => `
        <div class="kanji-cell" data-kanji="${k}">${k}</div>
    `).join('');
    const left         = getAttemptsLeft('puzzle1');
    const attemptsHtml = left > 0
        ? `<p class="puzzle-attempts">${left} essai(s) restant(s) cette heure</p>`
        : `<p class="puzzle-attempts puzzle-attempts--blocked">⛔ Aucun essai restant — réessayez dans moins d'une heure</p>`;

    return `
<div class="kanji-grid-wrap">
    ${attemptsHtml}
    <p class="kanji-progress" id="kanji-progress">Sélectionnez les quatre sceaux dans l'ordre correct...</p>
    <div class="kanji-grid" id="kanji-grid" ${left === 0 ? 'style="pointer-events:none;opacity:0.5;"' : ''}>${cells}</div>
    <button class="kanji-reset-btn" id="kanji-reset">Réinitialiser la sélection</button>
</div>`;
}

function initKanjiPuzzle() {
    if (isSolved('puzzle1')) return;
    const grid     = document.getElementById('kanji-grid');
    const progress = document.getElementById('kanji-progress');
    if (!grid || !progress) return;

    let sequence = [];

    function resetKanjiUI() {
        document.querySelectorAll('.kanji-cell.selected, .kanji-cell.wrong').forEach(c => {
            c.classList.remove('selected', 'wrong');
            delete c.dataset.order;
        });
    }

    grid.addEventListener('click', async e => {
        const cell = e.target.closest('.kanji-cell');
        if (!cell || cell.classList.contains('selected') || sequence.length >= 4) return;

        sequence.push(cell.dataset.kanji);
        cell.classList.add('selected');
        cell.dataset.order = sequence.length;
        sound.playClick();
        progress.textContent = `${sequence.length} / 4 sceaux activés`;

        if (sequence.length === 4) {
            grid.style.pointerEvents = 'none';
            progress.textContent = 'Activation en cours...';

            // Vérifier la combinaison secrète en premier (sans consommer d'essai)
            const secretRes  = await fetch('/api/secret-combo', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ answer: [...sequence] }),
            });
            const secretData = await secretRes.json();

            if (secretData.success) {
                if (!secretData.alreadyUnlocked) {
                    state.hasSecretRole = true;
                    renderNav();
                    await sleep(300);
                    showDelacroixLetter();
                }
                setTimeout(() => {
                    resetKanjiUI();
                    sequence = [];
                    grid.style.pointerEvents = getAttemptsLeft('puzzle1') > 0 ? '' : 'none';
                    progress.textContent = secretData.alreadyUnlocked
                        ? 'Le sceau secret a déjà parlé. Le verrou principal demeure.'
                        : 'Les archives de Delacroix s\'ouvrent à vous. Le verrou principal demeure.';
                }, secretData.alreadyUnlocked ? 0 : 800);
                return;
            }

            // Combinaison ordinaire — essai sur puzzle1
            const result = await attemptPuzzle('puzzle1', [...sequence]);
            if (result.success) return;

            document.querySelectorAll('.kanji-cell.selected').forEach(c => c.classList.add('wrong'));
            sound.playError();

            const msg = result.rateLimit
                ? `⛔ Accès verrouillé — réessayez dans ${result.waitMinutes} min`
                : result.attemptsLeft > 0
                    ? `Séquence incorrecte — ${result.attemptsLeft} essai(s) restant(s)`
                    : '⛔ Aucun essai restant cette heure';

            setTimeout(() => {
                resetKanjiUI();
                sequence = [];
                grid.style.pointerEvents = (result.attemptsLeft > 0 && !result.rateLimit) ? '' : 'none';
                progress.textContent = msg;
            }, 1000);
        }
    });

    document.getElementById('kanji-reset')?.addEventListener('click', () => {
        if (sequence.length >= 4) return;
        resetKanjiUI();
        sequence = [];
        progress.textContent = 'Sélection réinitialisée.';
        setTimeout(() => { progress.textContent = 'Sélectionnez les quatre sceaux dans l\'ordre correct...'; }, 800);
    });
}

// ═══════════════════════════════════════════════════════════
//  LETTRE SECRÈTE — H. DELACROIX
// ═══════════════════════════════════════════════════════════

function showDelacroixLetter() {
    const existing = document.getElementById('delacroix-letter-overlay');
    if (existing) { existing.style.display = 'flex'; return; }

    const overlay = document.createElement('div');
    overlay.id        = 'delacroix-letter-overlay';
    overlay.className = 'letter-overlay';
    overlay.innerHTML = `

<div class="envelope-scene" id="envelope-scene">
    <div class="envelope-container">
        <div class="envelope" id="letter-envelope">
            <div class="envelope-flap"></div>
            <div class="envelope-body">
                <div class="envelope-seal">✦</div>
                <div class="envelope-addressee">H. Delacroix</div>
                <div class="envelope-label">Personnel &amp; Confidentiel</div>
            </div>
        </div>
    </div>
    <button class="envelope-open-btn" id="envelope-open-btn">— Briser le sceau —</button>
</div>

<div class="letter-modal-wrap" id="letter-modal-wrap" style="display:none; opacity:0;">
    <div class="letter-paper">
        <div class="letter-wax-seal">✦</div>
        <div class="letter-date">Paris, le 3 avril 1894</div>
        <div class="letter-salutation">À celui qui a pris le temps de comprendre,</div>
        <div class="letter-body-text">
            <p>Je ne sais pas votre nom. Je ne saurai jamais qui vous êtes, ni à quelle époque vous lirez ces lignes. Mais si vous tenez cette lettre entre les mains, c'est que vous avez fait quelque chose que peu ont la patience ou la lucidité de faire : vous avez lu entre les questions, pas entre les lignes.</p>
            <p>Vous avez compris ce qu'était la créature — non pas un monstre au sens ordinaire du terme, mais quelque chose qui appartient à un plan que nos mots peinent à nommer. Vous avez compris pourquoi mes balles n'ont servi à rien ce soir-là, et pourquoi ce n'était pas ma lâcheté qui les avait rendues inutiles. Vous avez compris ce qui l'avait repoussée. Et peut-être — je l'espère — vous avez compris d'où venait cette chose en moi, cette énergie que j'ai mis des mois à accepter comme une part de moi-même plutôt que comme une malédiction étrangère.</p>
            <p>Vous méritez de connaître le reste de mon histoire.</p>
            <p>Non pas parce que vous avez trouvé la bonne combinaison dans le bon ordre — n'importe quel esprit méthodique peut y parvenir par persévérance. Mais parce que vous avez compris le <em>pourquoi</em>. Et le pourquoi, c'est tout ce qui m'a manqué pendant si longtemps.</p>
            <p>J'ai écrit ce journal dans l'obscurité, sans être certain que quiconque le lirait jamais. Je l'ai écrit pour moi, d'abord — pour mettre de l'ordre dans quelque chose d'inordonnable. Mais je l'ai laissé ici, accessible, parce qu'une partie de moi espérait qu'un jour quelqu'un comprendrait.</p>
            <p>Vous avez compris. Alors je vous ouvre ce qui reste.</p>
            <p>Prenez soin de ce que vous lirez. Ce n'est pas de la fiction. Ce sont les pages d'une vie qui a basculé en quelques secondes dans une ruelle de novembre, et qui ne s'en est jamais tout à fait remise — ni tout à fait regretté d'avoir basculé.</p>
        </div>
        <div class="letter-closing">Bonne lecture, ami inconnu. Vous l'avez mérité.</div>
        <div class="letter-signature">
            Henri Delacroix
            <span class="letter-sig-subtitle">Inspecteur. Ou ce qu'il en reste.</span>
        </div>
        <button class="letter-close-btn" id="letter-close-btn">Accéder au journal</button>
    </div>
</div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('letter-overlay--visible'));

    document.getElementById('envelope-open-btn').addEventListener('click', () => {
        const btn      = document.getElementById('envelope-open-btn');
        const envelope = document.getElementById('letter-envelope');
        const scene    = document.getElementById('envelope-scene');
        const modal    = document.getElementById('letter-modal-wrap');

        btn.disabled = true;
        envelope.classList.add('envelope--opening');

        setTimeout(() => {
            scene.style.transition = 'opacity 0.4s ease';
            scene.style.opacity    = '0';
        }, 650);

        setTimeout(() => {
            scene.style.display    = 'none';
            modal.style.display    = 'block';
            requestAnimationFrame(() => {
                modal.style.transition = 'opacity 0.5s ease';
                modal.style.opacity    = '1';
            });
        }, 1050);
    });

    document.getElementById('letter-close-btn').addEventListener('click', () => {
        overlay.classList.remove('letter-overlay--visible');
        setTimeout(() => { overlay.remove(); navigateTo('journal-2'); }, 600);
    });
}

// ═══════════════════════════════════════════════════════════
//  PUZZLE 2 — INCANTATION
// ═══════════════════════════════════════════════════════════

function initIncantationPuzzle() {
    if (isSolved('puzzle2')) return;

    const input    = document.getElementById('incantation-input');
    const submit   = document.getElementById('incantation-submit');
    const attDisp  = document.getElementById('incantation-attempts');
    if (!input || !submit) return;

    const left = getAttemptsLeft('puzzle2');
    if (attDisp) attDisp.textContent = left > 0
        ? `${left} essai(s) restant(s) cette heure`
        : '⛔ Aucun essai restant — réessayez dans moins d\'une heure';
    if (left <= 0) { submit.disabled = true; input.disabled = true; }

    const checkIncantation = async () => {
        const val = input.value.trim();
        if (!val || submit.disabled) return;
        submit.disabled = true;
        input.disabled  = true;

        const result = await attemptPuzzle('puzzle2', val);
        if (result.success) return;

        input.classList.add('error');
        sound.playError();
        setTimeout(() => input.classList.remove('error'), 800);

        if (result.rateLimit) {
            if (attDisp) attDisp.textContent = `⛔ Accès verrouillé — réessayez dans ${result.waitMinutes} min`;
            submit.textContent = '⛔ Bloqué';
        } else {
            const rem = result.attemptsLeft;
            if (attDisp) attDisp.textContent = rem > 0
                ? `${rem} essai(s) restant(s) cette heure`
                : '⛔ Aucun essai restant — réessayez dans moins d\'une heure';
            if (rem > 0) {
                submit.disabled = false;
                input.disabled  = false;
            } else {
                submit.textContent = '⛔ Bloqué';
            }
        }
    };

    submit.addEventListener('click', checkIncantation);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') checkIncantation(); });
}

// ═══════════════════════════════════════════════════════════
//  PUZZLE 4 — LETTRE SCELLÉE
// ═══════════════════════════════════════════════════════════

function initLetterPuzzle() {
    if (isSolved('puzzle4')) return;

    const input   = document.getElementById('letter-input');
    const submit  = document.getElementById('letter-submit');
    const attDisp = document.getElementById('letter-attempts');
    if (!input || !submit) return;

    const left = getAttemptsLeft('puzzle4');
    if (attDisp) attDisp.textContent = left > 0
        ? `${left} essai(s) restant(s) cette heure`
        : '⛔ Aucun essai restant — réessayez dans moins d\'une heure';
    if (left <= 0) { submit.disabled = true; input.disabled = true; }

    const checkLetter = async () => {
        const val = input.value.trim();
        if (!val || submit.disabled) return;
        submit.disabled = true;
        input.disabled  = true;

        const result = await attemptPuzzle('puzzle4', val);
        if (result.success) return;

        input.classList.add('error');
        sound.playError();
        setTimeout(() => input.classList.remove('error'), 800);

        if (result.rateLimit) {
            if (attDisp) attDisp.textContent = `⛔ Accès verrouillé — réessayez dans ${result.waitMinutes} min`;
            submit.textContent = '⛔ Bloqué';
        } else {
            const rem = result.attemptsLeft;
            if (attDisp) attDisp.textContent = rem > 0
                ? `${rem} essai(s) restant(s) cette heure`
                : '⛔ Aucun essai restant — réessayez dans moins d\'une heure';
            if (rem > 0) {
                submit.disabled = false;
                input.disabled  = false;
            } else {
                submit.textContent = '⛔ Bloqué';
            }
        }
    };

    submit.addEventListener('click', checkLetter);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') checkLetter(); });
}

// ═══════════════════════════════════════════════════════════
//  PUZZLE 3 — PATTERN LOCK
// ═══════════════════════════════════════════════════════════

// Dot positions for 6-dot cylinder (r=100, center=130,130)
const DOT_POSITIONS = {};
for (let i = 1; i <= 6; i++) {
    const angleDeg = -90 + (i - 1) * 60;
    const angleRad = angleDeg * Math.PI / 180;
    DOT_POSITIONS[i] = {
        x: Math.round(130 + 100 * Math.cos(angleRad)),
        y: Math.round(130 + 100 * Math.sin(angleRad)),
    };
}

function initPatternPuzzle() {
    if (isSolved('puzzle3')) return;

    const svg      = document.getElementById('pattern-svg');
    const disp     = document.getElementById('pattern-display');
    const reset    = document.getElementById('pattern-reset');
    const attDisp  = document.getElementById('pattern-attempts');
    if (!svg) return;

    const left = getAttemptsLeft('puzzle3');
    if (attDisp) attDisp.textContent = left > 0
        ? `${left} essai(s) restant(s) cette heure`
        : '⛔ Aucun essai restant — réessayez dans moins d\'une heure';
    if (left <= 0) svg.style.pointerEvents = 'none';

    let sequence = [];
    const linesGroup = document.getElementById('pattern-lines');

    function drawLine(fromDot, toDot) {
        const from = DOT_POSITIONS[fromDot];
        const to   = DOT_POSITIONS[toDot];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);   line.setAttribute('y2', to.y);
        line.setAttribute('class', 'pattern-line');
        linesGroup.appendChild(line);
    }

    function resetPattern() {
        sequence = [];
        linesGroup.innerHTML = '';
        document.querySelectorAll('.pattern-dot').forEach(d => d.classList.remove('active', 'error'));
        disp.textContent = '○ ○ ○ ○ ○ ○';
    }

    svg.addEventListener('click', async e => {
        const dot = e.target.closest('.pattern-dot');
        if (!dot || sequence.length >= 6) return;
        const num = parseInt(dot.dataset.dot, 10);
        if (sequence.includes(num)) return;

        if (sequence.length > 0) drawLine(sequence[sequence.length - 1], num);
        sequence.push(num);
        dot.classList.add('active');
        disp.textContent = Array(sequence.length).fill('●').join(' ') +
                           Array(6 - sequence.length).fill('○').join(sequence.length < 6 ? ' ' : '');
        sound.playClick();

        if (sequence.length === 6) {
            svg.style.pointerEvents = 'none';
            disp.textContent = 'Synchronisation en cours...';

            const result = await attemptPuzzle('puzzle3', [...sequence]);
            if (result.success) return;

            document.querySelectorAll('.pattern-dot.active').forEach(d => d.classList.add('error'));
            sound.playError();

            const msg = result.rateLimit
                ? `⛔ Accès verrouillé — réessayez dans ${result.waitMinutes} min`
                : result.attemptsLeft > 0
                    ? `Séquence incorrecte — ${result.attemptsLeft} essai(s) restant(s)`
                    : '⛔ Aucun essai restant cette heure';

            if (attDisp) attDisp.textContent = result.rateLimit
                ? `⛔ Accès verrouillé — réessayez dans ${result.waitMinutes} min`
                : result.attemptsLeft > 0
                    ? `${result.attemptsLeft} essai(s) restant(s) cette heure`
                    : '⛔ Aucun essai restant — réessayez dans moins d\'une heure';

            setTimeout(() => {
                resetPattern();
                svg.style.pointerEvents = (result.attemptsLeft > 0 && !result.rateLimit) ? '' : 'none';
                disp.textContent = msg;
            }, 1200);
        }
    });

    reset?.addEventListener('click', () => {
        if (sequence.length >= 6) return;
        resetPattern();
    });
}

// ═══════════════════════════════════════════════════════════
//  AMBIENT SOUND SYSTEM (Web Audio API — no files needed)
// ═══════════════════════════════════════════════════════════

const sound = {
    ctx:       null,
    masterGain: null,
    noiseNode:  null,
    droneOsc:   null,
    active:     false,

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.ctx.destination);
    },

    start() {
        this.init();
        if (this.active) return;
        this.active = true;

        // Brown noise
        const bufferSize = 4096;
        this.noiseNode = this.ctx.createScriptProcessor(bufferSize, 1, 1);
        let lastOut = 0;
        this.noiseNode.onaudioprocess = e => {
            const out = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                out[i] = (lastOut + 0.02 * white) / 1.02;
                lastOut = out[i];
                out[i] *= 3.5;
            }
        };
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.04;
        this.noiseNode.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        // Low drone 55 Hz
        this.droneOsc = this.ctx.createOscillator();
        this.droneOsc.type = 'sine';
        this.droneOsc.frequency.value = 55;
        const droneGain = this.ctx.createGain();
        droneGain.gain.value = 0.03;
        this.droneOsc.connect(droneGain);
        droneGain.connect(this.masterGain);
        this.droneOsc.start();

        // Fade in
        this.masterGain.gain.setTargetAtTime(1, this.ctx.currentTime, 1.5);
    },

    stop() {
        if (!this.active) return;
        this.active = false;
        this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
    },

    playClick() {
        if (!this.ctx) return;
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    },

    playError() {
        if (!this.ctx) return;
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
    },

    playSuccess() {
        if (!this.ctx) return;
        [523, 659, 784, 1047].forEach((freq, i) => {
            const osc  = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = this.ctx.currentTime + i * 0.12;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.5);
        });
    },
};

function initSoundToggle() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
        sound.init();
        if (sound.active) {
            sound.stop();
            btn.classList.remove('active');
            btn.textContent = '♪ Ambiance';
        } else {
            sound.start();
            btn.classList.add('active');
            btn.textContent = '♪ Ambiance (actif)';
        }
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
