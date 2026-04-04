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

    setTimeout(() => {
        area.innerHTML = renderer();
        area.style.opacity = '1';
        area.style.transition = 'opacity 0.4s ease';
        initPageHandlers(pageId);
    }, 200);
}

function initPageHandlers(pageId) {
    if (pageId === 'training-2') initKanjiPuzzle();
    if (pageId === 'training-3') initIncantationPuzzle();
    if (pageId === 'training-4') initPatternPuzzle();
    if (pageId === 'training-5') initLetterPuzzle();
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

    <div class="doc-body">
        ${solved ? renderChapter2Content() : renderPuzzle1Gate()}
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
    <p class="doc-p" style="color:var(--ink-light); font-size:0.8rem;">
        Ces symboles condensent la nature de l'arme. Si vous avez lu l'introduction avec attention,
        vous les connaissez déjà. Le Journal Intime confirme leur signification.
    </p>
</div>

<div class="puzzle-gate">
    <div class="puzzle-gate-title">LES QUATRE SCEAUX</div>
    <div class="puzzle-gate-subtitle">VERROU I — IDENTIFICATION PAR SÉQUENCE</div>
    <div class="puzzle-divider"></div>
    ${renderKanjiGrid()}
</div>`;
}

function renderChapter2Content() {
    return `
<div class="puzzle-solved-banner">✦ LES QUATRE SCEAUX — RECONNUS ✦ ACCÈS ACCORDÉ ✦</div>
<br>
<div class="doc-section">
    <div class="doc-section-title">PREMIÈRE MÉTHODE — FONDATION ET ANCRAGE</div>
    <p class="doc-p" style="font-style:italic; color:var(--ink-light);">
        Objectif : Préparer le canal énergétique et la posture pour accueillir l'arme.
    </p>
    <p class="doc-p">
        Le Pistolet Occulte n'est pas une simple arme à feu. La densité de l'énergie maudite qui
        imprègne son canon lui confère un poids surnaturel et asymétrique — un poids qui ne s'exerce
        pas uniquement sur vos muscles, mais sur votre canal énergétique tout entier. Les premiers
        jours où je le portais, mon bras gauche accusait une fatigue que six heures d'effort intense
        ne m'auraient pas infligée. Ce n'est pas que l'arme soit lourde au sens ordinaire. C'est
        qu'elle pèse sur deux plans simultanément.
    </p>
    <p class="doc-p">
        Cette Fondation se construit avant la remise de l'arme. C'est même préférable ainsi :
        un porteur dont le canal est déjà ouvert, la posture déjà stable, reçoit l'arme sans
        résistance. Elle ne le surprend pas. Elle le reconnaît.
    </p>
</div>
<div class="doc-diagram">
    <div class="doc-diagram-label">PROGRESSION DE LA FONDATION</div>
    <svg viewBox="0 0 560 98" width="100%" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="163" height="82" rx="1" fill="none" stroke="#8b6840" stroke-width="1.2"/>
        <line x1="8" y1="26" x2="171" y2="26" stroke="#8b6840" stroke-width="0.7"/>
        <text x="89" y="21" text-anchor="middle" font-family="'Cinzel',Georgia,serif" font-size="8" fill="#b89450" letter-spacing="1.5">EXERCICE I</text>
        <text x="89" y="44" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="11" fill="#2a180e">Port Statique</text>
        <text x="89" y="59" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8.5" fill="#7a5a40" font-style="italic">5 min → 1 heure</text>
        <text x="89" y="73" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#7a5a40" font-style="italic">Ouverture du canal</text>
        <line x1="173" y1="49" x2="191" y2="49" stroke="#8b6840" stroke-width="1.2"/>
        <polygon points="191,45.5 199,49 191,52.5" fill="#8b6840"/>
        <rect x="201" y="8" width="163" height="82" rx="1" fill="none" stroke="#8b6840" stroke-width="1.2"/>
        <line x1="201" y1="26" x2="364" y2="26" stroke="#8b6840" stroke-width="0.7"/>
        <text x="282" y="21" text-anchor="middle" font-family="'Cinzel',Georgia,serif" font-size="8" fill="#b89450" letter-spacing="1.5">EXERCICE II</text>
        <text x="282" y="44" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="11" fill="#2a180e">Port en Mouvement</text>
        <text x="282" y="59" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8.5" fill="#7a5a40" font-style="italic">Flux ininterrompu</text>
        <text x="282" y="73" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#7a5a40" font-style="italic">Ancrage dynamique</text>
        <line x1="366" y1="49" x2="384" y2="49" stroke="#8b6840" stroke-width="1.2"/>
        <polygon points="384,45.5 392,49 384,52.5" fill="#8b6840"/>
        <rect x="394" y="8" width="158" height="82" rx="1" fill="none" stroke="#b89450" stroke-width="1.8"/>
        <line x1="394" y1="26" x2="552" y2="26" stroke="#b89450" stroke-width="0.7"/>
        <text x="473" y="21" text-anchor="middle" font-family="'Cinzel',Georgia,serif" font-size="8" fill="#b89450" letter-spacing="1.5">EXERCICE III</text>
        <text x="473" y="44" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="11" fill="#2a180e">Synchronisation</text>
        <text x="473" y="60" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="14" fill="#2a180e">死 呪 血 魂</text>
        <text x="473" y="78" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#7a5a40" font-style="italic">Canal orienté vers l'arme</text>
    </svg>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">EXERCICE I — LE PORT STATIQUE</div>
    <p class="doc-p">
        Procurez-vous un objet de substitution — un cylindre lesté, une barre courte, tout ce qui
        peut être tenu en prise pistolet avec une masse proche de huit cents grammes. Tenez-le bras
        tendu en position de tir. Ne visez rien. Ne pensez pas à tirer. Existez simplement avec
        cet objet dans votre main, pendant des durées progressivement croissantes — cinq minutes
        d'abord, puis dix, puis une demi-heure, puis une heure complète.
    </p>
    <p class="doc-p">
        L'objectif n'est pas l'endurance physique : c'est la préparation du canal. Sentez le poids
        dans votre paume. Puis — à mesure que la concentration s'approfondit — imaginez un second
        poids sous le premier : dense, asymétrique, qui tire légèrement vers le bas et vers
        l'intérieur. Ce n'est pas de l'imagination. C'est ainsi que l'Énergie Maudite imprègne
        l'arme réelle. Votre bras doit apprendre à la porter avant même de la tenir.
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">EXERCICE II — LE PORT EN MOUVEMENT</div>
    <p class="doc-p">
        Répétez le port statique avec votre objet de substitution, mais en mouvement. Marchez.
        Courez. Traversez des espaces encombrés. Montez des escaliers. Changez de rythme
        brusquement. Si l'objet n'est pas disponible, adoptez la prise imaginaire — main dominante
        fermée en prise pistolet, pouce relevé, bras tendu vers l'avant.
    </p>
    <p class="doc-p">
        L'objectif est de maintenir un flux d'Énergie Maudite continu à travers votre bras malgré
        les changements de tempo. Au début, chaque mouvement brusque le rompt — vous sentirez
        votre énergie se disperser. L'entraînement corrige cela progressivement. Quand vous pouvez
        courir en maintenant ce flux ininterrompu, vous êtes prêt pour l'étape suivante.
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">EXERCICE III — LA SYNCHRONISATION</div>
    <p class="doc-p">
        L'étape finale de la Fondation. Ouvrez votre main dominante, doigts légèrement écartés.
        Visualisez les quatre sceaux — <strong>死 呪 血 魂</strong> — gravés dans l'air devant vous,
        à l'endroit exact où reposerait le canon. Concentrez délibérément votre Énergie Maudite
        dans votre paume, jusque dans vos doigts, vers ce point précis. Projetez-la.
    </p>
    <p class="doc-p">
        Ce que vous faites ici n'est pas encore une synchronisation complète — c'est son préalable.
        Vous ouvrez le chemin. Les sceaux réagissent au contact énergétique de leur porteur comme
        une serrure réagit à la bonne clé. Préparez la clé avant d'avoir la serrure. L'arme,
        lorsqu'elle vous sera remise, reconnaîtra un canal déjà orienté vers elle.
    </p>
    <div class="doc-warning">
        ⚠ Ne sautez aucune des trois étapes. Un porteur dont la Fondation est incomplète verra
        son énergie se disperser à chaque tir, réduisant l'efficacité de l'imprégnation à presque
        rien. La Fondation n'est pas un préambule. Elle est le socle de tout ce qui suit.
    </div>
</div>
<div class="diary-final-line">— H. Delacroix, 1893</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

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
    <div class="doc-body">
        ${solved ? renderChapter3Content() : renderPuzzle2Gate()}
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
    <p class="doc-p" style="color:var(--ink-light); font-size:0.8rem;">
        Les indices se trouvent dans les entrées du Journal Intime correspondant à cette période.
    </p>
</div>
<div class="puzzle-gate">
    <div class="puzzle-gate-title">L'INCANTATION DE FOCALISATION</div>
    <div class="puzzle-gate-subtitle">VERROU II — FORMULATION OCCULTE EXACTE</div>
    <div class="puzzle-divider"></div>
    <div class="incantation-wrap">
        <p class="incantation-lore">
            « Les neuf liens. La lumière qui traverse. L'oiseau et sa déclaration. »<br>
            Ces mots ont un sens précis. Vous le savez, si vous avez bien lu.
        </p>
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

function renderChapter3Content() {
    return `
<div class="puzzle-solved-banner">✦ INCANTATION DE FOCALISATION — RECONNUE ✦ ACCÈS ACCORDÉ ✦</div>
<br>
<div class="doc-section">
    <div class="doc-section-title">DEUXIÈME MÉTHODE — FOCALISATION ET PRÉCISION DE L'ÂME</div>
    <p class="doc-p" style="font-style:italic; color:var(--ink-light);">
        Objectif : Forger la perception occulte et le verrouillage de cible avant la remise de l'arme.
    </p>
    <p class="doc-p">
        Dans l'exorcisme, viser avec les yeux ne suffit pas. Les Fléaux — et particulièrement les
        Fléaux de grade élevé — n'occupent pas le plan physique de façon uniforme. Leur masse visible
        peut n'être qu'une projection, une excroissance superficielle de leur forme réelle. Leur centre
        vital — le nœud d'énergie qui les maintient en existence — peut se trouver à un emplacement
        radicalement différent de leur forme apparente.
    </p>
    <p class="doc-p">
        La précision occulte se construit d'abord dans l'esprit. Ces trois exercices ne nécessitent
        pas l'arme — ils en sont le préalable. Ce que vous forgez ici, c'est le canal de perception.
        L'arme ne fait qu'en amplifier la portée le moment venu.
    </p>
</div>
<div class="doc-diagram">
    <div class="doc-diagram-label">ANATOMIE D'UNE CIBLE OCCULTE</div>
    <svg viewBox="0 0 480 152" width="100%" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="160" cy="78" rx="128" ry="68" fill="none" stroke="#8b6840" stroke-width="1.2" stroke-dasharray="8 4"/>
        <text x="255" y="60" font-family="'Playfair Display',Georgia,serif" font-size="12" fill="#8b6840">①</text>
        <ellipse cx="152" cy="72" rx="82" ry="48" fill="rgba(124,58,237,0.07)" stroke="#7c3aed" stroke-width="1" stroke-dasharray="4 3" opacity="0.9"/>
        <text x="218" y="72" font-family="'Playfair Display',Georgia,serif" font-size="12" fill="#7c3aed" opacity="0.9">②</text>
        <circle cx="136" cy="65" r="22" fill="rgba(139,26,26,0.12)" stroke="#8b1a1a" stroke-width="1.4"/>
        <circle cx="136" cy="65" r="5" fill="#8b1a1a" opacity="0.65"/>
        <text x="150" y="91" font-family="'Playfair Display',Georgia,serif" font-size="12" fill="#8b1a1a">③</text>
        <line x1="300" y1="30" x2="300" y2="142" stroke="#8b6840" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.5"/>
        <text x="310" y="47" font-family="'Playfair Display',Georgia,serif" font-size="9" fill="#8b6840">① Forme physique apparente</text>
        <text x="310" y="59" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#7a5a40" font-style="italic">  Visible à l'œil nu — trompeuse</text>
        <text x="310" y="80" font-family="'Playfair Display',Georgia,serif" font-size="9" fill="#7c3aed" opacity="0.9">② Signature occulte</text>
        <text x="310" y="92" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#7a5a40" font-style="italic">  Détectable · Position instable</text>
        <text x="310" y="113" font-family="'Playfair Display',Georgia,serif" font-size="9" fill="#8b1a1a">③ Nœud d'existence</text>
        <text x="310" y="125" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#8b1a1a" font-style="italic">  Point de tir réel · Variable</text>
        <text x="160" y="148" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="7.5" fill="#7a5a40" font-style="italic">Fig. II — Anatomie d'une cible occulte (d'après les travaux du Prof. Liú, 1889)</text>
    </svg>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">EXERCICE I — LA PERCEPTION DES SIGNATURES</div>
    <p class="doc-p">
        Commencez par vous-même — fermez les yeux, posez votre attention sur votre main dominante
        et sentez le flux d'Énergie Maudite qui s'y concentre. Sa couleur, sa texture, son rythme.
        Puis exercez-vous à percevoir celle des objets autour de vous. Tout objet ayant été exposé
        à une énergie intense ou ancienne porte une trace. Apprenez à la distinguer du silence
        ordinaire.
    </p>
    <p class="doc-p">
        Cette capacité de perception est le préalable indispensable à toute précision occulte.
        Une fois l'arme en main, ses sceaux émettront une signature que vous apprendrez à reconnaître
        les yeux fermés — mais le sens de la perception, lui, se développe maintenant.
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">EXERCICE II — VERROUILLAGE SUR CIBLE INVISIBLE</div>
    <p class="doc-p">
        Le Professeur Liú utilisait des résidus occultes — fragments d'énergie maudite désincarnée —
        comme cibles d'entraînement. Ils n'ont pas de forme physique stable mais une présence
        occulte détectable. L'exercice consiste à localiser leur signature dans l'espace, à verrouiller
        mentalement cette localisation, puis à désigner ce point avec précision en ignorant
        délibérément les distractions visuelles.
    </p>
    <p class="doc-p">
        Tendez votre index vers la position verrouillée, bras en ligne de mire. L'index n'est pas
        l'arme : c'est le geste de focalisation. Ce que vous entraînez ici, c'est la précision du
        verrouillage mental. La cible que vous ne voyez pas est celle que vous devez apprendre à
        ne jamais manquer — avant même de tirer.
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">EXERCICE III — LE FLUX CONTINU</div>
    <p class="doc-p">
        Le danger de l'exercice précédent est la discontinuité : certains réussissent à percevoir
        la cible <em>ou</em> à maintenir un flux d'énergie stable, mais pas les deux simultanément.
        L'Exercice III travaille spécifiquement cette séparation. Adoptez la prise imaginaire —
        bras tendu, main fermée en prise pistolet. Maintenez un flux d'Énergie Maudite actif à
        travers votre canal tout en percevant la signature d'un point devant vous. L'un ne doit
        pas effacer l'autre.
    </p>
    <p class="doc-p">
        Si le flux s'interrompt dès que vous focalisez la perception, recommencez depuis le début.
        Ce parallélisme est la compétence centrale de cette méthode. Elle se développe avec la
        répétition, pas avec la force.
    </p>
    <div class="doc-warning">
        ⚠ C'est l'exercice le plus long et le plus exigeant de cette méthode. En concentrant toute
        mon attention sur la perception de la cible, j'ai une fois laissé mon canal se fermer
        partiellement au tir. Le reflux d'énergie a été brutal — douleur aiguë dans le bras, perte
        de conscience momentanée. Ne forcez pas la perception au point d'oublier le flux.
        Les deux doivent coexister.
    </div>
</div>
<div class="diary-final-line">— H. Delacroix, 1893</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

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
    <div class="doc-body">
        ${solved ? renderChapter4Content() : renderPuzzle3Gate()}
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
    <p class="doc-p" style="color:var(--ink-light); font-size:0.8rem;">
        Ce verrou mesure l'exactitude de vos mains. La synchronisation du barillet ne tolère
        aucune hésitation, aucune correction. Un seul faux mouvement révèle ce que cette méthode
        cherche à éliminer.
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

function renderChapter4Content() {
    return `
<div class="puzzle-solved-banner">✦ BARILLET SYNCHRONISÉ ✦ ACCÈS ACCORDÉ ✦</div>
<br>
<div class="doc-section">
    <div class="doc-section-title">TROISIÈME MÉTHODE — L'ART DU SANG-FROID</div>
    <p class="doc-p" style="font-style:italic; color:var(--ink-light);">
        Objectif : Ne jamais hésiter face à l'horreur pure ou au poids de la mort.
    </p>
    <p class="doc-p">
        « Vous avez donc atteint la 3ème méthode d'entraînement. L'art de maîtriser cet artefact
        repose avant tout sur la lucidité et le sang-froid. Les fléaux terrifiants que vous
        tenterez d'exorciser, ou bien les maîtres du fléau aux intentions malveillantes, useront
        de tout pour vous empêcher de tirer la balle fatale. La peur, le doute ou la pitié feront
        trembler votre canon, et chaque balle tirée peut signifier la fin de votre propre avenir
        ou de celui de votre cible. C'est pourquoi votre esprit doit être une mer d'huile. »
    </p>
    <p class="doc-p" style="text-align:right; font-size:0.85rem; color:var(--ink-light); font-style:italic;">
        — Professeur Liú, quatrième mois d'entraînement
    </p>
    <p class="doc-p">
        Le Sang-Froid est une discipline intérieure avant d'être une posture physique. Ces trois
        exercices s'effectuent sans l'arme — ce que vous forgez ici ne dépend pas d'elle.
        Il dépend de vous.
    </p>
</div>
<div class="doc-diagram">
    <div class="doc-diagram-label">PRINCIPE DU SANG-FROID</div>
    <svg viewBox="0 0 520 105" width="100%" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="12" width="145" height="80" rx="1" fill="rgba(139,26,26,0.05)" stroke="#8b1a1a" stroke-width="1" stroke-dasharray="5 3"/>
        <text x="80" y="27" text-anchor="middle" font-family="'Cinzel',Georgia,serif" font-size="8" fill="#8b1a1a" letter-spacing="1">PERTURBATION</text>
        <path d="M20 53 Q35 42 50 53 Q65 64 80 53 Q95 42 110 53 Q125 64 140 53" fill="none" stroke="#8b1a1a" stroke-width="1.5" opacity="0.7"/>
        <text x="80" y="74" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#8b1a1a" font-style="italic">Peur · Doute · Pitié</text>
        <text x="80" y="86" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="7.5" fill="#7a5a40" font-style="italic">(signal enregistré)</text>
        <line x1="155" y1="52" x2="175" y2="52" stroke="#8b6840" stroke-width="1.2"/>
        <polygon points="175,48.5 183,52 175,55.5" fill="#8b6840"/>
        <rect x="185" y="12" width="145" height="80" rx="1" fill="rgba(184,148,80,0.06)" stroke="#b89450" stroke-width="1.5"/>
        <text x="257" y="27" text-anchor="middle" font-family="'Cinzel',Georgia,serif" font-size="8" fill="#b89450" letter-spacing="1">SANG-FROID</text>
        <line x1="205" y1="52" x2="310" y2="52" stroke="#b89450" stroke-width="0.8" stroke-dasharray="4 3"/>
        <circle cx="257" cy="52" r="5" fill="none" stroke="#b89450" stroke-width="1"/>
        <text x="257" y="70" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#b89450" font-style="italic">Esprit actif,</text>
        <text x="257" y="82" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#b89450" font-style="italic">mer d'huile</text>
        <line x1="332" y1="52" x2="352" y2="52" stroke="#8b6840" stroke-width="1.2"/>
        <polygon points="352,48.5 360,52 352,55.5" fill="#8b6840"/>
        <rect x="362" y="12" width="145" height="80" rx="1" fill="rgba(22,101,52,0.06)" stroke="#166534" stroke-width="1.5"/>
        <text x="434" y="27" text-anchor="middle" font-family="'Cinzel',Georgia,serif" font-size="8" fill="#166534" letter-spacing="1">CORPS IMMOBILE</text>
        <line x1="380" y1="52" x2="490" y2="52" stroke="#166534" stroke-width="2" opacity="0.7"/>
        <text x="434" y="70" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#166534" font-style="italic">Zéro réaction</text>
        <text x="434" y="82" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#7a5a40" font-style="italic">musculaire</text>
    </svg>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">EXERCICE I — L'EXPOSITION PROGRESSIVE</div>
    <p class="doc-p">
        On ne forme pas l'impassibilité dans un environnement confortable. Adoptez la posture de
        tir — objet de substitution en main, ou prise imaginaire à mains nues. Exposez-vous
        délibérément à ce qui perturbe votre calme : une présence occulte, un environnement
        hostile, une pensée difficile. Imposez-vous de maintenir le bras tendu et le flux
        énergétique ouvert sans que la perturbation ne se traduise dans vos muscles.
    </p>
    <p class="doc-p">
        L'objectif n'est pas de ne pas ressentir la peur. L'objectif est de ne pas la laisser se
        traduire dans le corps. Sentez-la. Enregistrez-la. Et continuez à viser.
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">EXERCICE II — LE POIDS DES DÉCISIONS FATALES</div>
    <p class="doc-p">
        Un aspect que les textes techniques omettent systématiquement : le poids psychologique de
        tirer sur quelque chose — ou quelqu'un. Les Fléaux qui ont absorbé de la conscience
        humaine vous regarderont avec des yeux. Certains parleront. Certains supplieront.
    </p>
    <p class="doc-p">
        Placez-vous en situation simulée — réelle ou imaginée — face à une entité qui parle, qui
        vous regarde, qui cherche à vous ébranler. Maintenez la décision de tir : bras levé,
        intention verrouillée, sans vaciller. La résolution ne réside pas dans la gâchette.
        Elle réside dans la décision qui précède le geste. Sur le terrain, l'hésitation tue.
        C'est cette décision que vous entraînez maintenant.
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">EXERCICE III — LA MER D'HUILE</div>
    <p class="doc-p">
        La technique finale de la Troisième Méthode. Méditation active au bord du tir : posez
        votre paume ouverte sur votre genou, comme si l'arme y reposait, ou tenez votre objet
        de substitution. Entrez en état de conscience élargie — la peur, le doute et le jugement
        moral sont perçus comme des informations, mais ne commandent plus les actions. L'esprit
        n'est pas vide. Il est calme.
    </p>
    <p class="doc-p">
        Exposez-vous à une perturbation occulte ou émotionnelle. Trente minutes. Sans que le corps
        ne réagisse d'un millimètre. Quand vous réussissez cela sans l'arme, vous serez prêt
        à la tenir.
    </p>
    <div class="doc-warning">
        ⚠ La première fois que j'ai réussi l'Exercice III dans sa totalité, j'ai compris pour
        la première fois ce que le Professeur Liú entendait par « la mer d'huile ». C'est la
        chose la plus difficile que j'ai apprise. Et la plus utile.
    </div>
</div>
<div class="diary-final-line">— H. Delacroix, Inspecteur Principal, Paris, 1893</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

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

    <div class="doc-body">
        ${solved ? renderChapter5Content() : renderPuzzle4Gate()}
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
        un impact de cette magnitude. Ce qui suit vous y prépare — à condition de lire
        ce qui reste dans l'étui.
    </div>
</div>

<hr class="doc-rule">

<div class="puzzle-gate">
    <div class="puzzle-gate-title">LA LETTRE SCELLÉE</div>
    <div class="puzzle-gate-subtitle">VERROU IV — LE MOT DU PROFESSEUR LIÚ</div>
    <div class="puzzle-divider"></div>
    <div class="incantation-wrap">
        <p class="incantation-lore">
            <em>Vous trouverez ceci au fond de l'étui.</em><br><br>
            Je n'ai consigné dans le manuel que ce qui s'enseigne. Il existe une chose que
            le Professeur Liú m'a dite la nuit de la Balle Incendiaire — une chose qu'il
            n'a jamais répétée et que je n'ai jamais écrite, parce qu'elle ne s'explique
            pas. Elle se comprend ou elle ne se comprend pas.<br><br>
            Cette nuit-là, j'ai survécu parce que j'avais gardé ses mots dans ma tête au
            moment du tir. Je vous les laisse ici, mais dans le désordre. Si vous avez
            traversé les trois méthodes avec honnêteté, l'ordre vous sera évident.<br><br>
            <strong>à — l'âme — doit survivre — le corps</strong><br><br>
            <em>— H. Delacroix, Paris, 1893</em>
        </p>
        <input
            type="text"
            id="letter-input"
            class="incantation-input"
            placeholder="Remettez les mots dans l'ordre..."
            autocomplete="off"
            spellcheck="false"
        />
        <p class="incantation-hint">Respectez la ponctuation. La casse n'est pas importante.</p>
        <button class="btn-validate" id="letter-submit">Transmettre</button>
        <p class="puzzle-attempts" id="letter-attempts"></p>
    </div>
</div>`;
}

function renderChapter5Content() {
    return `
<div class="puzzle-solved-banner">✦ LETTRE LUE ✦ ACCÈS ACCORDÉ ✦</div>
<br>
<div class="doc-section">
    <div class="doc-section-title">CE QUI VOUS RESTE À APPRENDRE</div>
    <p class="doc-p">
        La Quatrième Méthode vise un objectif précis : renforcer votre enveloppe charnelle
        grâce à l'Énergie Occulte pour qu'elle survive à votre propre attaque. Il s'agit
        de la répartition d'impact — utiliser l'Énergie Maudite non comme projectile ou
        amplificateur, mais comme armure momentanée, un amortisseur interne qui redistribue
        l'onde de choc sur l'ensemble du corps plutôt qu'en un seul point.
    </p>
    <div class="doc-diagram">
        <div class="doc-diagram-label">REDISTRIBUTION DU CONTRECOUP</div>
        <svg viewBox="0 0 480 148" width="100%" xmlns="http://www.w3.org/2000/svg">
            <text x="102" y="15" text-anchor="middle" font-family="'Cinzel',Georgia,serif" font-size="7.5" fill="#8b1a1a" letter-spacing="1">SANS PRÉPARATION</text>
            <rect x="72" y="24" width="58" height="80" rx="28" fill="none" stroke="#8b6840" stroke-width="1" opacity="0.6"/>
            <line x1="14" y1="60" x2="68" y2="60" stroke="#8b1a1a" stroke-width="3"/>
            <polygon points="68,55.5 78,60 68,64.5" fill="#8b1a1a"/>
            <circle cx="80" cy="60" r="18" fill="rgba(139,26,26,0.18)" stroke="#8b1a1a" stroke-width="1.5"/>
            <circle cx="80" cy="60" r="4" fill="#8b1a1a" opacity="0.8"/>
            <line x1="72" y1="52" x2="63" y2="44" stroke="#8b1a1a" stroke-width="1" opacity="0.5"/>
            <line x1="72" y1="68" x2="63" y2="76" stroke="#8b1a1a" stroke-width="1" opacity="0.5"/>
            <text x="102" y="122" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#8b1a1a" font-style="italic">Impact concentré</text>
            <text x="102" y="134" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#8b1a1a" font-style="italic">→ fracture garantie</text>
            <line x1="220" y1="18" x2="220" y2="140" stroke="#8b6840" stroke-width="0.8" stroke-dasharray="5 4" opacity="0.6"/>
            <text x="220" y="15" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="10" fill="#8b6840" font-style="italic">vs</text>
            <text x="358" y="15" text-anchor="middle" font-family="'Cinzel',Georgia,serif" font-size="7.5" fill="#166534" letter-spacing="1">AVEC PRÉPARATION</text>
            <rect x="328" y="24" width="58" height="80" rx="28" fill="none" stroke="#8b6840" stroke-width="1" opacity="0.6"/>
            <line x1="270" y1="60" x2="324" y2="60" stroke="#166534" stroke-width="3" opacity="0.8"/>
            <polygon points="324,55.5 334,60 324,64.5" fill="#166534" opacity="0.8"/>
            <circle cx="336" cy="60" r="20" fill="rgba(22,101,52,0.1)" stroke="#166534" stroke-width="1" stroke-dasharray="3 2"/>
            <circle cx="336" cy="60" r="5" fill="#166534" opacity="0.5"/>
            <line x1="336" y1="40" x2="336" y2="26" stroke="#166534" stroke-width="1" stroke-dasharray="3 2" opacity="0.7"/>
            <line x1="336" y1="80" x2="336" y2="94" stroke="#166534" stroke-width="1" stroke-dasharray="3 2" opacity="0.7"/>
            <line x1="355" y1="52" x2="372" y2="45" stroke="#166534" stroke-width="1" stroke-dasharray="3 2" opacity="0.7"/>
            <line x1="355" y1="68" x2="372" y2="75" stroke="#166534" stroke-width="1" stroke-dasharray="3 2" opacity="0.7"/>
            <line x1="356" y1="60" x2="376" y2="60" stroke="#166534" stroke-width="1" stroke-dasharray="3 2" opacity="0.7"/>
            <text x="358" y="122" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#166534" font-style="italic">Impact redistribué</text>
            <text x="358" y="134" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="8" fill="#166534" font-style="italic">→ onde absorbée</text>
            <text x="240" y="147" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="7.5" fill="#7a5a40" font-style="italic">L'Énergie Maudite comme armure momentanée — redistribue, n'oppose pas.</text>
        </svg>
    </div>
    <ul class="doc-list">
        <li><strong>Exercice I — L'Amortisseur Passif :</strong> Apprendre à diffuser un impact reçu via l'Énergie Maudite plutôt que de l'absorber purement physiquement. S'exposer à des chocs cinétiques croissants — chutes, arrêts d'objets lourds, assauts d'adversaires puissants. La technique se développe progressivement.</li>
        <li><strong>Exercice II — L'Armure Momentanée :</strong> Activer délibérément l'amortisseur énergétique en <em>anticipation</em> d'un impact — pas en réaction, mais en préparation. La fenêtre d'activation est brève. Avec l'entraînement, elle devient instinctive.</li>
        <li><strong>Exercice III — La Répétition du Contrecoup :</strong> Simuler, à fraction de la puissance réelle, le type d'onde de choc que génère la Balle Incendiaire. Habituer le canal énergétique à ce retour brutal sans être déstabilisé. Ce n'est pas confortable. C'est nécessaire.</li>
    </ul>
    <div class="doc-warning">
        ⚠ Cette méthode se certifie sur le terrain, la première fois que vous tirez une
        Balle Incendiaire et que votre bras tient. <strong>Prenez votre temps.</strong>
    </div>
</div>

<hr class="doc-rule">

<div class="doc-section">
    <div class="doc-section-title">UN DERNIER MOT</div>
    <p class="doc-p">
        Vous êtes arrivé au terme de ce manuel. Ce que vous faites de cette arme et de
        ces connaissances vous appartient désormais. Je ne peux pas vous guider plus loin.
    </p>
    <p class="doc-p">
        Utilisez l'arme avec discernement. Le Serment d'Entrave n'est pas une limite
        imposée de l'extérieur — c'est un rappel permanent que la puissance sans
        contrainte se retourne toujours contre celui qui la détient. Ne le défiez jamais.
        <strong>C'est la seule leçon qui compte vraiment.</strong>
    </p>
    <p class="doc-p">
        Il y a des choses dans ce monde que personne d'autre que vous ne peut
        protéger désormais. Faites-le bien.
    </p>
</div>

<div class="diary-final-line">— H. Delacroix, Inspecteur Principal, Paris, 1893</div>`;
}

// ─── Helpers for locked/corrupted states ──────────────────────────────────────
function renderCorrupted() {
    return `
<div class="doc-paper">
    <div style="padding:2rem 0;">
        <div class="corrupted-block">
            <div class="corrupted-warning">
                ⚠ DONNÉES CORROMPUES ⚠<br>
                ACCÈS VERROUILLÉ PAR L'ADMINISTRATION<br>
                ─────────────────────────────────────<br>
                Ce dossier a été temporairement suspendu<br>
                par décision du Grand Maître des Archives.<br>
                ─────────────────────────────────────<br>
                — FICHIER INACCESSIBLE —
            </div>
        </div>
    </div>
</div>`;
}

function renderLockedChapter(reqPuzzle, chapterName, chapterPage) {
    return `
<div class="doc-paper">
    <div style="text-align:center; padding:3rem 0;">
        <div class="journal-locked">
            <span class="journal-lock-icon">🔒</span>
            <p class="journal-locked-msg">
                Ce chapitre est accessible uniquement après avoir<br>
                complété le <strong>${chapterName}</strong>.<br><br>
                Retournez dans le Manuel d'Entraînement et<br>
                franchissez le sceau précédent.
            </p>
        </div>
    </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════
//  PAGE CONTENT — JOURNAL INTIME
// ═══════════════════════════════════════════════════════════

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

function renderJournal2() {
    if (!isSolved('puzzle1') && !hasSecretAccess()) return renderJournalLocked('Sceau de Kanjis', 'training-2');
    const kanjisCrypted = !isSolved('puzzle1') && hasSecretAccess();
    return `
<div class="doc-paper diary-wrap">
    <div class="doc-header">
        <div class="doc-classification">DOCUMENT PERSONNEL — STRICTEMENT PRIVÉ</div>
        <div class="doc-title">JOURNAL INTIME D'HENRI DELACROIX</div>
        <div class="doc-subtitle">Suite — Décembre 1892 à Mars 1893</div>
        <div class="doc-meta">
            <span>${isSolved('puzzle1') ? 'Déverrouillé par : Le Sceau de Kanjis' : 'Accès accordé par H. Delacroix'}</span>
            <span>Entrée II — La Forge</span>
        </div>
    </div>
    <div class="doc-body">

    <div class="diary-entry">
        <div class="diary-date">8 DÉCEMBRE 1892</div>
        <p class="diary-line">Je lis tout ce que je peux trouver. Les bibliothèques habituelles d'abord — rien d'utile dans les rayons de science. Mais en cherchant parmi les ouvrages d'occultisme que j'avais toujours considérés avec mépris, j'ai commencé à trouver des pistes.</p>
        <p class="diary-line">Un terme revient dans les textes japonais que j'ai trouvés chez un libraire de la rue de Rivoli : 呪力 — « juuryoku » selon la phonétique latine approximative. Force maudite. Énergie des maudits.</p>
        <p class="diary-line">Je n'avais aucune formation en japonais. Mais j'ai trouvé un interprète — un ancien missionnaire, le Père Théodore, qui avait passé dix ans à Kyoto — et ensemble, nous avons déchiffré un texte d'époque Edo qui décrivait précisément ce que j'avais ressenti dans la ruelle.</p>
        <p class="diary-line">L'Énergie Maudite n'est pas surnaturelle, selon ces textes. Elle est naturelle — mais d'une nature que la physique occidentale n'a pas encore catégorisée. Tous les êtres humains en possèdent une quantité infime. Chez certains — suite à un traumatisme, une expérience proche de la mort, ou une exposition prolongée à un Fléau — cette énergie s'éveille et devient manipulable. J'avais eu le traumatisme. J'avais l'exposition. J'avais, apparemment, le profil.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">21 DÉCEMBRE 1892</div>
        <p class="diary-line">Le Père Théodore m'a orienté vers un homme qu'il a refusé de me nommer. Un « praticien », a-t-il dit. Quelqu'un qui avait vu des choses similaires en Extrême-Orient et qui vivait maintenant à Montmartre.</p>
        <p class="diary-line">Je l'ai trouvé. Un vieillard chinois — je ne connaîtrai jamais son vrai nom, il m'a dit de l'appeler Professeur Liú — qui habitait une chambre de bonne à l'odeur d'encens et de vieux papier au sommet d'un immeuble de la rue Lepic.</p>
        <p class="diary-line">Il m'a regardé entrer. Il a hoché la tête. « Vous avez vu un Onryō, » a-t-il dit en français parfait. « Et l'Énergie en vous s'est éveillée. Vous ne pouvez pas rentrer chez vous maintenant. Ce serait comme essayer de redevenir aveugle. »</p>
        <p class="diary-line">J'ai voulu lui poser vingt questions. Il m'a interrompu d'un geste. « D'abord, apprenez à respirer. »</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">JANVIER 1893 — ENTRÉES CONDENSÉES</div>
        <p class="diary-line"><em>[Note : J'ai réduit mes notes quotidiennes pour ne conserver que les moments importants. Le reste était répétitif — des heures d'exercices de concentration, de méditation, de frustration.]</em></p>
        <p class="diary-line">Le Professeur Liú m'a enseigné à sentir mon Énergie Maudite. Puis à la localiser. Puis à la faire circuler délibérément. C'est plus difficile à décrire qu'à faire — une fois qu'on y arrive, c'est aussi naturel que respirer. Avant, c'est incompréhensible.</p>
        <p class="diary-line">Il m'a dit quelque chose qui a tout changé : « Les balles ne font rien parce qu'elles appartiennent au plan physique. Un Fléau existe dans deux plans. Pour blesser quelque chose qui existe dans deux plans, votre munition doit elle aussi exister dans deux plans. »</p>
        <p class="diary-line">L'Imprégnation. Voilà comment j'ai compris ce processus, que je n'avais pas de mot pour décrire avant. Tenir la balle. Conduire l'Énergie jusqu'à elle. Attendre.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">17 FÉVRIER 1893</div>
        <p class="diary-line">Mes premières balles imprégnées. Je les ai testées — l'Énergie Maudite s'y sent clairement, comme une chaleur sous-cutanée dans le métal. Mais le Professeur Liú m'a regardé regarder mon revolver d'un certain regard.</p>
        <p class="diary-line">« Votre arme n'est pas adaptée, » a-t-il dit. J'ai demandé ce qu'il voulait dire.</p>
        <p class="diary-line">« Un Fléau ordinaire peut être blessé par une balle correctement imprégnée. Mais certains Fléaux ont des carapaces occultes. Votre énergie se dispersera avant d'atteindre l'intérieur. Il vous faut un conduit. Un amplificateur. »</p>
        <p class="diary-line">Il a montré mon revolver. « Ce pistolet peut devenir ce conduit. Mais il faudra le modifier. Pas mécaniquement. Spirituellement. »</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">5 MARS 1893 — LA GRAVURE</div>
        <p class="diary-line">Trois semaines de préparation. J'ai appris les quatre sceaux du Liú — quatre kanjis qui, gravés dans le métal d'une arme et activés par l'Énergie Maudite de son porteur, créent un circuit d'amplification.</p>
        ${kanjisCrypted ? `
        <div class="kanji-redacted-block">
            <p class="diary-line" style="text-align:center; font-size:1.4rem; letter-spacing:1rem; margin:1rem 0;">
                <span class="kanji-redact">■</span>&ensp;<span class="kanji-redact">■</span>&ensp;<span class="kanji-redact">■</span>&ensp;<span class="kanji-redact">■</span>
            </p>
            <p class="diary-line"><strong class="kanji-redact">■■■</strong> — <span class="kanji-redact-text">████████████████████████████████████████</span></p>
            <p class="diary-line"><strong class="kanji-redact">■■■</strong> — <span class="kanji-redact-text">████████████████████████████████████████████████████</span></p>
            <p class="diary-line"><strong class="kanji-redact">■■■</strong> — <span class="kanji-redact-text">████████████████████████████████████████</span></p>
            <p class="diary-line"><strong class="kanji-redact">■■■</strong> — <span class="kanji-redact-text">████████████████████████████████████████████████████████████</span></p>
            <p class="kanji-redact-hint">⚑ Ces inscriptions sont sous sceau. Identifiez les Quatre Sceaux dans l'ordre exact pour les révéler.</p>
        </div>` : `
        <p class="diary-line" style="text-align:center; font-size:1.4rem; letter-spacing:1rem; margin:1rem 0;">死 &nbsp; 呪 &nbsp; 血 &nbsp; 魂</p>
        <p class="diary-line"><strong>死</strong> — La Mort. Le rappel de ce que nous combattons.</p>
        <p class="diary-line"><strong>呪</strong> — La Malédiction. La nature de l'énergie que nous canalisons.</p>
        <p class="diary-line"><strong>血</strong> — Le Sang. Le prix qui a été et sera toujours payé.</p>
        <p class="diary-line"><strong>魂</strong> — L'Âme. Ce que nous protégeons. Ce pour quoi nous combattons.</p>`}
        <p class="diary-line">L'ordre de gravure est crucial. Pas l'ordre d'activation — l'ordre dans lequel ils ont été tracés pour la première fois conditionne le sens du circuit. J'ai gravé chaque kanji avec un burin que le Professeur Liú avait préparé en le trempant dans une solution dont il n'a pas voulu me donner la composition.</p>
        <p class="diary-line">Ça a pris neuf heures. Ma main tremblait. Je ne voulais pas faire d'erreur.</p>
        <p class="diary-line">Quand j'ai eu fini, et que j'ai tenu le revolver chargé d'une balle imprégnée, j'ai senti quelque chose que je n'avais jamais senti dans une arme : une réciprocité. Comme si l'arme répondait à ma main autant que ma main la tenait.</p>
        <p class="diary-line">« Bien, » a dit le Professeur Liú. « Maintenant il est à vous. »</p>
        <div class="diary-final-line">— H. Delacroix</div>
    </div>

    </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

function renderJournal3() {
    if (!isSolved('puzzle2') && !hasSecretAccess()) return renderJournalLocked('L\'Incantation', 'training-3');
    return `
<div class="doc-paper diary-wrap">
    <div class="doc-header">
        <div class="doc-classification">DOCUMENT PERSONNEL — STRICTEMENT PRIVÉ</div>
        <div class="doc-title">JOURNAL INTIME D'HENRI DELACROIX</div>
        <div class="doc-subtitle">Suite — Avril à Août 1893</div>
        <div class="doc-meta">
            <span>${isSolved('puzzle2') ? "Déverrouillé par : L'Incantation" : 'Accès accordé par H. Delacroix'}</span>
            <span>Entrée III — Les Reliques Jumelles</span>
        </div>
    </div>
    <div class="doc-body">

    <div class="diary-entry">
        <div class="diary-date">2 AVRIL 1893</div>
        <p class="diary-line">Il y a quelque chose dans Paris en ce moment. Quelque chose de plus grand que tout ce que j'ai rencontré jusqu'ici.</p>
        <p class="diary-line">Les rapports de la Préfecture parlent d'une « épidémie de fièvre nerveuse » dans le 5ème arrondissement. Vingt-trois cas en deux semaines. Tous les malades présentent les mêmes symptômes : yeux fixes, mutisme total, incapacité à se nourrir. Certains ont des engelures malgré la chaleur du printemps.</p>
        <p class="diary-line">Je connais ces symptômes. C'est l'exposition prolongée à un Fléau de grande puissance — la présence seule de la créature érode le psychisme humain comme l'eau érode la pierre.</p>
        <p class="diary-line">J'en ai parlé au Professeur Liú. « Un Fléau de Grade 1, » a-t-il dit, sans émotion particulière.</p>
        <p class="diary-line">« Qu'est-ce que cela signifie ? »</p>
        <p class="diary-line">« Cela signifie que votre revolver actuel ne sera pas suffisant. »</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">14 AVRIL 1893 — LA CONFRONTATION</div>
        <p class="diary-line">Je l'ai trouvé au sous-sol de la Bibliothèque Sainte-Geneviève. Comment un Fléau de cette puissance peut-il se trouver dans une bibliothèque universitaire ? Je n'ai pas eu le temps de me poser la question.</p>
        <p class="diary-line">Sa taille fluctuait, s'étendant jusqu'au plafond voûté et se contractant en une masse dense de la taille d'une voiture. Ses appendices traversaient les rayonnages sans les déplacer, purement incorporels dans le plan physique mais d'une matière solide dans le plan occulte.</p>
        <p class="diary-line">J'ai tiré cinq balles imprégnées, l'une après l'autre. Chaque impact le secouait — des convulsions qui faisaient vibrer les murs de la bibliothèque entière, une réaction que je n'avais jamais vue sur une créature. Mais même cinq coups directs ne suffisaient pas à l'arrêter.</p>
        <p class="diary-line">Alors j'ai fait quelque chose de stupide.</p>
        <p class="diary-line">J'ai canalisé <strong>toute</strong> mon Énergie Maudite — absolument tout ce que je possédais — dans la dernière balle qui me restait, et je l'ai tirée.</p>
        <p class="diary-line">Je me suis réveillé deux jours plus tard dans ma chambre. Le Professeur Liú était assis à mon chevet. Il avait l'air... presque inquiet.</p>
        <p class="diary-line">« Le Fléau est mort, » a-t-il dit. « Vous aussi, presque. »</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">20 AVRIL 1893 — LE NOYAU</div>
        <p class="diary-line">Liú est retourné sur le site de la confrontation. Il a trouvé quelque chose dans les décombres du sous-sol — là où le Fléau avait existé.</p>
        <p class="diary-line">Un noyau. De la taille d'un poing fermé. Cristallin, d'un noir absolu, légèrement chaud au toucher. « Le noyau maudit, » a expliqué Liú. « Le cœur d'un Fléau de Grade 1 ou plus. Extrêmement rare. Extrêmement précieux. »</p>
        <p class="diary-line">« Qu'est-ce qu'on peut en faire ? »</p>
        <p class="diary-line">Il a souri — la première fois que je lui voyais sourire. « On peut le forger. »</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">JUIN — JUILLET 1893 — LE PROCESSUS DE FORGE</div>
        <p class="diary-line">Je ne documenterai pas les détails précis du rituel de forge. Certaines connaissances ne doivent pas être consignées librement. Ce que je peux dire :</p>
        <p class="diary-line">Le processus a duré treize jours. Il a nécessité du métal spécifique — de l'acier de Tolède, forgé selon des méthodes anciennes. Il a nécessité du sang — le mien. Il a nécessité la prononciation d'un Serment d'Entrave devant le noyau maudit, qui... réagit aux serments. Il les enregistre. Il les fait respecter.</p>
        <p class="diary-line">Le Serment que j'ai prononcé : amplifier à son maximum chacune des six munitions que l'arme peut contenir, en échange d'une contrainte absolue gravée dans le métal lui-même — la Balle Incendiaire ne peut être déclenchée qu'une seule fois par chargeur complet, en ultime ressource, au prix de l'intégralité des réserves du canal énergétique. Tenter de la répéter avant rechargement complet est mortel. Un serment d'entrave nécessite un témoin occulte. Liú était là.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">2 AOÛT 1893 — UN PROBLÈME DE MATIÈRE</div>
        <p class="diary-line">La forge est terminée. Le premier revolver est devant moi — identique à l'ancien en apparence, mais d'une présence occulte incomparablement plus dense. Les sceaux brillent légèrement dans l'obscurité quand je le charge.</p>
        <p class="diary-line">Mais il y a un problème.</p>
        <p class="diary-line"><strong>Le noyau maudit a fourni assez de matière pour deux revolvers. Pas un. Pas trois. Exactement deux.</strong></p>
        <p class="diary-line">Je ne comprends pas si c'est une coïncidence ou si le noyau a... choisi. Liú suggère que les Fléaux de Grade 1 ont une forme de conscience résiduelle même dans la mort, et qu'un noyau maudit peut avoir une intention propre.</p>
        <p class="diary-line">Je ne sais pas si je dois trouver cela rassurant ou terrifiant.</p>
        <p class="diary-line">Le second revolver est identique au premier. Mêmes sceaux, dans le même ordre. Même Serment d'Entrave — les deux armes sont liées par le même accord occulte. Séparez-les, et le Serment tient quand même. Elles sont deux, mais elles ont la même origine, le même cœur.</p>
        <p class="diary-line">J'en garderai un. L'autre... je dois réfléchir à ce que j'en ferai.</p>
        <div class="diary-final-line">— H. Delacroix</div>
    </div>

    </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

function renderJournal4() {
    if (!isSolved('puzzle3') && !hasSecretAccess()) return renderJournalLocked('La Synchronisation du Barillet', 'training-4');
    return `
<div class="doc-paper diary-wrap">
    <div class="doc-header">
        <div class="doc-classification">DOCUMENT PERSONNEL — DERNIÈRES ENTRÉES</div>
        <div class="doc-title">JOURNAL INTIME D'HENRI DELACROIX</div>
        <div class="doc-subtitle">Entrées finales — Septembre 1893</div>
        <div class="doc-meta">
            <span>${isSolved('puzzle3') ? 'Déverrouillé par : La Synchronisation du Barillet' : 'Accès accordé par H. Delacroix'}</span>
            <span>Entrée IV — Le Grand Départ</span>
        </div>
    </div>
    <div class="doc-body">

    <div class="diary-entry">
        <div class="diary-date">5 SEPTEMBRE 1893</div>
        <p class="diary-line">Quelqu'un me suit depuis le 27 août.</p>
        <p class="diary-line">Je ne sais pas si c'est un humain ou un Fléau — la distinction, je l'ai appris, n'est pas toujours aussi nette qu'on pourrait le croire. Il existe des humains qui ont fait des pactes avec des Fléaux. Il existe des Fléaux qui ont absorbé assez de conscience humaine pour se comporter comme des personnes.</p>
        <p class="diary-line">Ce que je sais : j'ai vu son ombre trois fois. Devant le Palais de Justice. Devant chez moi, rue des Écoles. Une troisième fois, dans le reflet d'une vitrine, à Montmartre. La même silhouette. Toujours à distance. Toujours là.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">11 SEPTEMBRE 1893</div>
        <p class="diary-line">Le Professeur Liú a disparu. Sa chambre de la rue Lepic est vide. Pas de bagages laissés derrière. Pas de note. Le propriétaire dit qu'il est parti la nuit du 8, en payant ses arriérés de loyer en espèces.</p>
        <p class="diary-line">Je ne sais pas si c'est bon ou mauvais signe.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">15 SEPTEMBRE 1893 — DÉCISION</div>
        <p class="diary-line">J'ai décidé que je ne pouvais pas garder les revolvers avec moi.</p>
        <p class="diary-line">Ma logique est simple : si quelque chose me cherche, c'est probablement pour s'emparer des armes. Un Fléau de Grade 1 a été vaincu par elles. Un humain assez au fait de notre domaine pour me traquer sait ce qu'elles valent. Je ne peux pas les laisser être prises.</p>
        <p class="diary-line">J'ai pensé à les détruire. J'ai même essayé, brièvement. Le noyau maudit intégré dans le métal les rend pratiquement indestructibles par des moyens conventionnels, et les moyens occultes que je possède ne sont pas suffisants.</p>
        <p class="diary-line">Donc : je les sépare. Chacune part dans une direction opposée. L'une vers l'est — vers le pays d'où vient la connaissance qui a rendu leur forge possible. L'autre vers l'ouest — vers un continent assez vaste pour que même ceux qui me traquent aient du mal à la retrouver.</p>
        <p class="diary-line">Elles portent toutes deux ma marque. Gravée dans la culasse, sobre, définitive : <strong>H. Delacroix</strong>. C'est ainsi qu'on les reconnaîtra. C'est ainsi que vous saurez que ce que vous tenez est réel.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">16 SEPTEMBRE 1893 — LE PREMIER REVOLVER</div>
        <p class="diary-line">Pour celle que je destine au Japon, j'ai écrit à Arata Sōjun.</p>
        <p class="diary-line">Je l'ai rencontré en 1889, lors d'une conférence privée à Lyon — un des rares maîtres des sceaux funéraires japonais à avoir fait le voyage en Europe. Petit homme d'une soixantaine d'années, silencieux, dont les mains dessinaient des formes dans l'air lorsqu'il pensait. Nous avons passé trois nuits à parler, en français approximatif des deux côtés, de la nature des Fléaux, de la différence entre exorcisme occidental et pratique orientale. Il m'a dit que les Japonais travaillent sur ces questions depuis mille ans. Je l'ai cru.</p>
        <p class="diary-line">Je lui ai expédié le revolver par voie diplomatique, accompagné d'une lettre lui exposant la situation. Sa réponse est arrivée quinze jours plus tard, en trois idéogrammes : <em>je m'en charge</em>.</p>
        <p class="diary-line">Je sais, par son dernier courrier, qu'il a construit pour elle un tombeau scellé selon les rites de protection anciens — quelque part dans sa région d'origine, dans les terres du nord. Il a lié le verrou à la structure de ce manuel : seul quelqu'un ayant compris les armes jusqu'à leur fondement pourrait en suivre la trace. C'est lui qui a posé cette condition. Pas moi.</p>
        <p class="diary-line"><strong>Si vous lisez ces lignes, c'est que vous avez retrouvé ce tombeau. C'est que vous êtes cette personne.</strong></p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">17 SEPTEMBRE 1893 — LE SECOND REVOLVER</div>
        <p class="diary-line">L'autre, je l'ai confiée à un intermédiaire qui partait pour les États-Unis. Je ne nommerai pas son nom ici — il opère dans des milieux qu'il vaut mieux ne pas documenter.</p>
        <p class="diary-line">Ce que je sais : l'arme a traversé l'Atlantique. Elle est arrivée en Amérique. Quelqu'un l'a récupérée là-bas — je ne sais pas qui. Je ne sais pas où elle se trouve à présent. Un pays aussi immense garde ses secrets efficacement.</p>
        <p class="diary-line">Je n'ai aucune certitude quant à son détenteur actuel, ni quant à sa localisation. Peut-être est-elle en des mains sûres. Peut-être pas. C'est le risque que j'ai accepté en choisissant la distance comme protection.</p>
        <p class="diary-line">Si vous la cherchez : vous savez désormais ce qu'il faut reconnaître. <strong>H. Delacroix</strong>, gravé dans la culasse. C'est la seule piste que je puisse vous laisser.</p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">18 SEPTEMBRE 1893 — 23H47</div>
        <p class="diary-line">Je mets cette version complète du dossier à l'abri.</p>
        <p class="diary-line">Ces armes ont été forgées dans la douleur, dans le sang, dans la certitude de ma propre finitude. Elles ont protégé des innocents que la police officielle ne pouvait pas protéger. Elles ont vaincu des entités que la science ne peut même pas admettre.</p>
        <p class="diary-line">Mais elles ont un prix.</p>
        <p class="diary-line">Le Serment d'Entrave n'est pas juste une contrainte sur la Balle Incendiaire. C'est un rappel permanent que le pouvoir sans contrainte se retourne toujours contre celui qui le détient. La limite est la protection, pas l'ennemi.</p>
        <p class="diary-line">Ne cherchez jamais à briser le Serment. Ne le défiez jamais. Acceptez-le. <strong>C'est la seule leçon qui compte vraiment.</strong></p>
        <p class="diary-line">Je ne sais pas ce qui va se passer dans les prochains jours. Je ne sais pas si la silhouette reviendra. Je ne sais pas si je survivrai à ce qui m'attend.</p>
        <p class="diary-line">Mais ces armes, elles, survivront. Vous en tenez la preuve entre les mains.</p>
        <p class="diary-line">Faites bon usage de ce qu'Arata Sōjun a gardé pour vous.</p>
        <div class="diary-final-line">
            — Henri DELACROIX<br>
            Inspecteur Principal, Brigade Criminelle de Paris<br>
            18 septembre 1893, 23h47
        </div>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry" style="opacity:0.5; font-style:italic;">
        <p class="diary-line" style="text-align:center; font-size:0.75rem; letter-spacing:0.2rem;">
            [ La page suivante est vierge. Puis deux pages arrachées. Puis plus rien. ]
        </p>
    </div>

    </div>
</div>`;
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
    '\u6b7b', '\u798d', '\u706b', '\u9ab8', '\u546a',   // 死 禍 火 骸 呪
    '\u98a8', '\u6c34', '\u571f', '\u6728', '\u91d1',    // 風 水 土 木 金
    '\u8840', '\u95c7', '\u529b', '\u754c', '\u5149',    // 血 闇 力 界 光
    '\u9b42', '\u6708', '\u7159', '\u795e', '\u9b3c',    // 魂 月 煙 神 鬼
    '\u970a', '\u708e', '\u5df1', '\u5e7d', '\u51a5',    // 霊 炎 己 幽 冥
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
                        ? 'Lettre de Delacroix déjà reçue. Le verrou reste actif.'
                        : 'Le journal vous est ouvert. Le verrou reste actif.';
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
        <button class="letter-close-btn" id="letter-close-btn">Confirmer mon identité</button>
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
        window.location.href = '/auth/discord';
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
