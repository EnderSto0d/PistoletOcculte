/* ============================================================
   ARCHIVES OCCULTES — Client Application
   All lore content, puzzle logic, navigation, and audio.
   ============================================================ */

// ─── Puzzle Solutions (hardcoded) ─────────────────────────────────────────────
const KANJI_SOLUTION  = ['\u6b7b', '\u546a', '\u8840', '\u9b42']; // 死, 呪, 血, 魂
const INCANTATION_SOL = 'neuf cordes. lumi\u00e8re polaris\u00e9e. corbeau et d\u00e9claration.';
const PATTERN_SOL     = [1, 4, 2, 5, 3, 6];

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
    user:        null,
    progress:    [],   // ['puzzle1', 'puzzle2', 'puzzle3']
    config:      {},
    currentPage: 'training-1',
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
        state.user     = data;
        state.progress = data.progress || [];
        state.config   = data.config   || {};
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

function isSolved(puzzleId)  { return state.progress.includes(puzzleId); }
function isEnabled(puzzleId) {
    const map = { puzzle1: state.config.puzzle1Enabled, puzzle2: state.config.puzzle2Enabled, puzzle3: state.config.puzzle3Enabled };
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

    const solved = state.progress.length;
    const badges = ['INITIÉ', 'PRATIQUANT', 'ÉVEILLÉ', 'MAÎTRE OCCULTE'];
    document.getElementById('user-badge').textContent = badges[Math.min(solved, 3)];
}

// ─── Navigation ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
    // Training
    { id: 'training-1', label: 'Chap. I — Introduction',    section: 'training', icon: '📜', req: null },
    { id: 'training-2', label: 'Chap. II — Énergie Occulte', section: 'training', icon: '✦',  req: null },
    { id: 'training-3', label: 'Chap. III — Serment',        section: 'training', icon: '✦',  req: null },
    { id: 'training-4', label: 'Chap. IV — Maîtrise',        section: 'training', icon: '✦',  req: null },
    // Journal
    { id: 'journal-1',  label: 'Entrée I — L\'Éveil',        section: 'journal',  icon: '📖', req: null },
    { id: 'journal-2',  label: 'Entrée II — La Forge',        section: 'journal',  icon: '📖', req: 'puzzle1' },
    { id: 'journal-3',  label: 'Entrée III — Les Reliques',   section: 'journal',  icon: '📖', req: 'puzzle2' },
    { id: 'journal-4',  label: 'Entrée IV — Le Grand Départ', section: 'journal',  icon: '📖', req: 'puzzle3' },
];

function renderNav() {
    const trainingList = document.getElementById('nav-training');
    const journalList  = document.getElementById('nav-journal');
    trainingList.innerHTML = '';
    journalList.innerHTML  = '';

    NAV_ITEMS.forEach(item => {
        const li = document.createElement('li');
        const unlocked = !item.req || isSolved(item.req);
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

        if (item.section === 'training') trainingList.appendChild(li);
        else                             journalList.appendChild(li);
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
}

// ─── API: Unlock Puzzle ───────────────────────────────────────────────────────
async function unlockPuzzle(puzzleId) {
    const res = await fetch('/api/unlock', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ puzzleId }),
    });
    const data = await res.json();
    if (data.success) {
        state.progress = data.progress;
        flashSuccess();
        await sleep(800);
        renderNav();
        navigateTo(state.currentPage);
    }
}

// ═══════════════════════════════════════════════════════════
//  PAGE CONTENT — TRAINING
// ═══════════════════════════════════════════════════════════

function renderTraining1() {
    return `
<div class="doc-paper">
    <div class="doc-header">
        <div class="doc-classification">DOSSIER CONFIDENTIEL — NIVEAU ABSOLU</div>
        <div class="doc-title">MANUEL D'ENTRAÎNEMENT</div>
        <div class="doc-subtitle">Chapitre I — Introduction aux Archives Occultes</div>
        <div class="doc-meta">
            <span>Rédigé par : Insp. H. DELACROIX</span>
            <span>Réf : DEL/1893/MAN/I</span>
        </div>
    </div>

    <div class="doc-body">
        <div class="doc-section">
            <div class="doc-section-title">AVERTISSEMENT PRÉLIMINAIRE</div>
            <p class="doc-p">
                Si ces mots vous parviennent, c'est que vous avez été jugé digne de connaître
                la vérité que la République préfère enterrer. Ne cherchez pas à la nier.
                Ne cherchez pas à la rationaliser. Acceptez simplement ce qui est.
            </p>
            <p class="doc-p">
                Ce manuel n'est pas un simple document. C'est un héritage. Le fruit de
                douze années de recherches menées dans le secret le plus absolu, au péril
                de ma raison et de ma vie.
            </p>
            <div class="doc-warning">
                ⚠ Ce que vous apprendrez ici est réel. Ce que vous verrez est réel.
                La douleur, le danger, le sacrifice — tout cela est réel.
            </div>
        </div>

        <hr class="doc-rule">

        <div class="doc-section">
            <div class="doc-section-title">COMMENT UTILISER CES ARCHIVES</div>
            <p class="doc-p">
                Les pages qui suivent sont organisées en quatre Chapitres Opérationnels.
                Chacun décrit une propriété spécifique de l'armement que vous avez reçu
                ou que vous vous apprêtez à recevoir. Ces propriétés semblent défier la
                physique ordinaire. Elles ne la défient pas — elles obéissent simplement
                à des lois que la science officielle refuse encore d'admettre.
            </p>
            <p class="doc-p">
                Les chapitres suivants sont protégés par des <strong>Sceaux de Connaissance</strong> —
                des verrous occultes qui ne s'ouvrent que lorsque l'esprit du lecteur est
                prêt à recevoir la vérité suivante. Chaque sceau prend une forme différente.
                Observez. Réfléchissez. Ne tentez pas de forcer ce qui doit venir naturellement.
            </p>
            <p class="doc-p">
                En parallèle à ce manuel, vous avez accès à mon <em>Journal Intime</em>.
                Ces entrées personnelles fournissent le contexte narratif et émotionnel
                que ce document technique ne peut pas vous donner. Je vous conseille de
                les lire dans l'ordre — chaque chapitre du manuel correspond à une
                période précise de mon journal.
            </p>
        </div>

        <hr class="doc-rule">

        <div class="doc-section">
            <div class="doc-section-title">PROPRIÉTÉS DE BASE DE L'ARMEMENT</div>
            <p class="doc-p">
                L'arme en votre possession est, en apparence, un revolver Modèle 1892
                de l'armée française. En apparence seulement. Sa fabrication réelle est
                décrite dans les chapitres suivants. Pour l'heure, sachez simplement ceci :
            </p>
            <ul class="doc-list">
                <li>Elle a l'apparence d'une arme ordinaire pour tout observateur non initié.</li>
                <li>Elle ne se comporte <strong>pas</strong> comme une arme ordinaire face aux Fléaux.</li>
                <li>Elle nécessite une préparation spéciale pour fonctionner pleinement.</li>
                <li>Son utilisation à pleine capacité a des limites précises et absolues.</li>
                <li>Ces limites ne sont pas des défauts. Elles sont intentionnelles. Elles vous protègent.</li>
            </ul>
        </div>

        <hr class="doc-rule">

        <div class="doc-section">
            <div class="doc-section-title">LES FLÉAUX — DÉFINITION OPÉRATIONNELLE</div>
            <p class="doc-p">
                Les entités que vous combattrez sont officiellement désignées dans mes
                archives sous le terme de <strong>Fléaux</strong> (<em>cursed spirits</em> dans la
                terminologie japonaise). Ce sont des manifestations de l'Énergie Maudite
                accumulée — émotions négatives humaines condensées en formes semi-conscientes.
            </p>
            <p class="doc-p">
                Leur degré de puissance varie. Les Fléaux de grades inférieurs sont
                abattables avec une munition correctement préparée. Les Fléaux de
                <strong>Grade 1 et au-delà</strong> requièrent une expertise complète de
                toutes les techniques décrites dans ce manuel.
            </p>
            <div class="doc-warning">
                ⚠ Ne jamais affronter un Fléau de Grade 1 sans avoir assimilé la
                totalité de ces archives. J'ai failli ne pas survivre à ma propre ignorance.
            </div>
        </div>

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
        <div class="doc-title">MANUEL D'ENTRAÎNEMENT</div>
        <div class="doc-subtitle">Chapitre II — Maîtrise de l'Énergie Occulte</div>
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
        Ce chapitre est scellé. Pour accéder à son contenu, vous devez activer le
        <strong>Sceau de Kanjis</strong> — quatre caractères occultes dissimulés parmi d'autres.
        Leur ordre est la clé.
    </p>
    <p class="doc-p" style="color:var(--ink-light); font-size:0.8rem;">
        Lisez le Journal Intime correspondant pour comprendre leur signification.
    </p>
</div>

<div class="puzzle-gate">
    <div class="puzzle-gate-title">LE SCEAU DE KANJIS</div>
    <div class="puzzle-gate-subtitle">VERROU I — ACTIVATION PAR SÉQUENCE</div>
    <div class="puzzle-divider"></div>
    ${renderKanjiGrid()}
</div>`;
}

function renderChapter2Content() {
    return `
<div class="puzzle-solved-banner">✦ SCEAU DE KANJIS — ACTIVÉ ✦ ACCÈS ACCORDÉ ✦</div>
<br>
<div class="doc-section">
    <div class="doc-section-title">MAÎTRISE DE L'ÉNERGIE OCCULTE — NIVEAU AVANCÉ</div>
    <p class="doc-p">
        La compétence <em>«&nbsp;Maîtrise de l'Énergie Occulte (Niveau Avancé)&nbsp;»</em>
        qui figure dans votre dossier de capacités n'est pas une compétence conventionnelle.
        Elle décrit votre aptitude à imprégner vos munitions d'Énergie Maudite concentrée
        avant de les charger dans l'arme.
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">POURQUOI EST-CE NÉCESSAIRE ?</div>
    <p class="doc-p">
        Le revolver Modèle 1892 que vous avez reçu est, sous son apparence ordinaire,
        un <strong>conduit</strong> — un canal pour l'Énergie Maudite. Les sceaux gravés
        sur son canon et son barillet (documentés dans le Journal Intime correspondant)
        servent d'amplificateurs. Mais un conduit sans matière à conduire est inutile.
    </p>
    <p class="doc-p">
        Une balle ordinaire, même tirée par cette arme, n'affectera pas un Fléau.
        Les Fléaux existent partiellement en dehors du plan physique standard. Seule
        une matière elle-même imprégnée d'Énergie Maudite peut les atteindre dans
        les deux plans simultanément.
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">LE PROCESSUS D'IMPRÉGNATION</div>
    <p class="doc-p">Avant de charger une balle dans le revolver :</p>
    <ul class="doc-list">
        <li>Tenez la balle dans votre paume fermée.</li>
        <li>Concentrez votre Énergie Maudite — sentez-la monter depuis le centre de votre thorax, descendre dans votre bras, dans votre main.</li>
        <li>Maintenez la concentration jusqu'à ce que la balle soit perceptiblement plus lourde dans votre main. Ce n'est pas de l'imagination — l'imprégnation augmente réellement la masse occulte de la munition.</li>
        <li>Chargez la balle ainsi traitée dans le barillet.</li>
    </ul>
    <div class="doc-warning">
        ⚠ Ce processus consomme de l'Énergie Maudite. Ne préparez pas plus de balles
        que nécessaire. La dépense inutile d'Énergie Maudite vous affaiblit — et sur
        le terrain, la faiblesse tue. La limite maximale de munitions simultanées
        est détaillée dans le Chapitre III.
    </div>
</div>
<div class="diary-final-line">— H. Delacroix, 1893</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

function renderTraining3() {
    if (!isEnabled('puzzle2')) return renderCorrupted();
    if (!isSolved('puzzle1'))  return renderLockedChapter('puzzle1', 'Chapitre II', 'training-2');

    const solved = isSolved('puzzle2');
    return `
<div class="doc-paper">
    <div class="doc-header">
        <div class="doc-classification">DOSSIER CONFIDENTIEL — OPÉRATEUR CONFIRMÉ</div>
        <div class="doc-title">MANUEL D'ENTRAÎNEMENT</div>
        <div class="doc-subtitle">Chapitre III — Le Serment d'Entrave</div>
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
        Ce chapitre est scellé par une <strong>Incantation de Reconnaissance</strong>.
        Les mots exacts que vous devez prononcer vous ont été transmis à travers
        les expériences documentées dans le Journal Intime.
    </p>
</div>
<div class="puzzle-gate">
    <div class="puzzle-gate-title">L'INCANTATION</div>
    <div class="puzzle-gate-subtitle">VERROU II — RECONNAISSANCE VOCALE OCCULTE</div>
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
    </div>
</div>`;
}

function renderChapter3Content() {
    return `
<div class="puzzle-solved-banner">✦ INCANTATION — RECONNUE ✦ ACCÈS ACCORDÉ ✦</div>
<br>
<div class="doc-section">
    <div class="doc-section-title">LIMITE DE CHARGEMENT — MAXIMUM 0/2</div>
    <p class="doc-p">
        Le barillet du revolver Modèle 1892 standard comporte six chambres.
        Vous constaterez que cette arme ne peut accepter que <strong>deux (2)</strong>
        balles imprégnées simultanément. Charger une troisième munition occulte —
        ou tenter de le faire — aura des conséquences immédiates et catastrophiques.
    </p>
    <p class="doc-p">
        Ce n'est pas un défaut de fabrication. C'est un
        <strong>Serment d'Entrave</strong> (<em>縛りの誓い — Shibari no Chikai</em>).
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">QU'EST-CE QU'UN SERMENT D'ENTRAVE ?</div>
    <p class="doc-p">
        Un Serment d'Entrave est un accord occulte par lequel le praticien renonce
        volontairement à une capacité en échange d'une puissance amplifiée dans
        un autre domaine. C'est un paradoxe fondamental de l'occultisme pratique :
        la contrainte crée la puissance.
    </p>
    <p class="doc-p">
        Dans le cas de ce revolver, le créateur de l'arme a volontairement lié
        la limite de deux munitions au système d'amplification des sceaux.
        En acceptant de ne jamais utiliser plus de deux balles simultanément,
        le circuit d'amplification devient exponentiellement plus puissant
        pour ces deux balles. <strong>Deux balles imprégnées et amplifiées par
        le Serment valent largement plus que six balles imprégnées ordinaires.</strong>
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">CONSÉQUENCES DE LA VIOLATION DU SERMENT</div>
    <p class="doc-p">Si une troisième balle imprégnée est introduite dans le barillet :</p>
    <ul class="doc-list">
        <li>Le circuit d'amplification entre en surcharge immédiate.</li>
        <li>L'Énergie Maudite cherche une sortie hors du circuit scellé.</li>
        <li>L'arme et le porteur constituent le chemin de moindre résistance.</li>
    </ul>
    <div class="doc-warning">
        ⚠ L'explosion qui en résulte est documentée. Je ne l'ai pas vécue moi-même —
        j'ai vu ce qu'il en restait. Cela suffit.<br>
        <strong>Ne chargez jamais plus de deux balles imprégnées. Jamais.</strong>
    </div>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">LES CHAMBRES RESTANTES</div>
    <p class="doc-p">
        Les quatre autres chambres du barillet peuvent contenir des balles ordinaires
        non imprégnées. Ces balles n'affecteront pas les Fléaux, mais elles restent
        utiles contre les menaces humaines — car il arrive, hélas, que nos ennemis
        aient un visage humain. Cela, j'en ai fait l'expérience.
    </p>
</div>
<div class="diary-final-line">— H. Delacroix, 1893</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

function renderTraining4() {
    if (!isEnabled('puzzle3')) return renderCorrupted();
    if (!isSolved('puzzle2'))  return renderLockedChapter('puzzle2', 'Chapitre III', 'training-3');

    const solved = isSolved('puzzle3');
    return `
<div class="doc-paper">
    <div class="doc-header">
        <div class="doc-classification">DOSSIER CONFIDENTIEL — OPÉRATEUR EXPERT</div>
        <div class="doc-title">MANUEL D'ENTRAÎNEMENT</div>
        <div class="doc-subtitle">Chapitre IV — Maîtrise des Armes à Distance & Posture du Pendu</div>
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
        Ce chapitre final est scellé par la <strong>Synchronisation du Barillet</strong>.
        La séquence exacte vous est connue si vous avez étudié la mécanique
        de l'arme et les visions documentées dans le Journal Intime.
    </p>
</div>
<div class="puzzle-gate">
    <div class="puzzle-gate-title">LA SYNCHRONISATION DU BARILLET</div>
    <div class="puzzle-gate-subtitle">VERROU III — ACTIVATION DU CYLINDRE OCCULTE</div>
    <div class="puzzle-divider"></div>
    <div class="pattern-wrap">
        <p class="pattern-lore">
            Six chambres. Six points de puissance.<br>
            Connectez-les dans le bon ordre pour synchroniser le barillet occulte.
        </p>
        ${renderPatternSVG()}
        <div class="pattern-sequence-display" id="pattern-display">— — — — — —</div>
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
    <div class="doc-section-title">MAÎTRISE DES ARMES À DISTANCE & SPÉCIALISATION EN ARME DE POING</div>
    <p class="doc-p">
        Ces deux compétences sont documentées ensemble parce qu'elles sont indissociables
        de la technique qui les génère : <strong>La Posture du Pendu</strong> — en référence
        au Tarot, non à l'instrument de mort, bien que la distinction soit parfois mince
        dans notre domaine.
    </p>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">POURQUOI UNE POSTURE EST-ELLE NÉCESSAIRE ?</div>
    <p class="doc-p">
        Tirer une balle imprégnée avec l'amplification des sceaux produit un
        <strong>recul spirituel</strong>. Pas le recul ordinaire d'une arme à feu —
        celui-là, vous le gérez comme tout tireur entraîné. Non : quand une balle
        imprégnée quitte le canon, une portion de votre Énergie Maudite est expulsée
        avec elle. Cette expulsion produit une onde inverse dans votre canal énergétique.
    </p>
    <p class="doc-p">Sans préparation, cette onde peut :</p>
    <ul class="doc-list">
        <li>Désorienter complètement votre perception des deux plans simultanément.</li>
        <li>Provoquer une fuite incontrôlée d'Énergie Maudite hors du canal.</li>
        <li>Dans les cas extrêmes, <strong>fracturer le canal énergétique de façon permanente</strong>.</li>
    </ul>
</div>
<hr class="doc-rule">
<div class="doc-section">
    <div class="doc-section-title">LA POSTURE DU PENDU — PROTOCOLE DÉTAILLÉ</div>
    <p class="doc-p">
        Mise au point au cours de ma deuxième année de pratique, après plusieurs
        fractures de canal douloureuses et instructives :
    </p>
    <ul class="doc-list">
        <li><strong>JAMBES :</strong> Légèrement écartées, genou avant légèrement fléchi. Le poids du corps est porté sur la jambe arrière, permettant un léger balancement vers l'arrière lors du tir pour absorber le recul physique.</li>
        <li><strong>TORSE :</strong> Légèrement incliné vers l'avant, comme si vous vous penchiez vers l'ombre d'un pendu imaginaire — d'où le nom.</li>
        <li><strong>BRAS :</strong> Tendu, mais pas rigide. Le coude doit pouvoir absorber le recul. Pensez « canal ouvert », pas « barrage fermé ».</li>
        <li><strong>ESPRIT :</strong> Au moment du tir, votre esprit doit être à la fois concentré sur la cible et ouvert au flux de l'Énergie qui revient. Ce n'est pas une contradiction — c'est le paradoxe central de toute pratique occulte avancée.</li>
    </ul>
    <div class="doc-warning">
        ⚠ Cette posture ne s'apprend pas en lisant. Elle s'apprend en tirant,
        en subissant les conséquences de l'échec, et en ajustant. Les premières
        fois seront désagréables. Mais vous apprendrez. Ou vous ne tirerez plus jamais.
        La sélection naturelle, dans notre domaine, est rigoureuse.
    </div>
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
    if (!isSolved('puzzle1')) return renderJournalLocked('Sceau de Kanjis', 'training-2');
    return `
<div class="doc-paper diary-wrap">
    <div class="doc-header">
        <div class="doc-classification">DOCUMENT PERSONNEL — STRICTEMENT PRIVÉ</div>
        <div class="doc-title">JOURNAL INTIME D'HENRI DELACROIX</div>
        <div class="doc-subtitle">Suite — Décembre 1892 à Mars 1893</div>
        <div class="doc-meta">
            <span>Déverrouillé par : Le Sceau de Kanjis</span>
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
        <p class="diary-line" style="text-align:center; font-size:1.4rem; letter-spacing:1rem; margin:1rem 0;">死 &nbsp; 呪 &nbsp; 血 &nbsp; 魂</p>
        <p class="diary-line"><strong>死</strong> — La Mort. Le rappel de ce que nous combattons.</p>
        <p class="diary-line"><strong>呪</strong> — La Malédiction. La nature de l'énergie que nous canalisons.</p>
        <p class="diary-line"><strong>血</strong> — Le Sang. Le prix qui a été et sera toujours payé.</p>
        <p class="diary-line"><strong>魂</strong> — L'Âme. Ce que nous protégeons. Ce pour quoi nous combattons.</p>
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
    if (!isSolved('puzzle2')) return renderJournalLocked('L\'Incantation', 'training-3');
    return `
<div class="doc-paper diary-wrap">
    <div class="doc-header">
        <div class="doc-classification">DOCUMENT PERSONNEL — STRICTEMENT PRIVÉ</div>
        <div class="doc-title">JOURNAL INTIME D'HENRI DELACROIX</div>
        <div class="doc-subtitle">Suite — Avril à Août 1893</div>
        <div class="doc-meta">
            <span>Déverrouillé par : L'Incantation</span>
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
        <p class="diary-line">J'ai tiré les deux balles imprégnées. Elles l'ont touché. Elles l'ont blessé — j'ai vu la réaction, une convulsion qui a fait vibrer les murs de la bibliothèque entière. Mais il m'en faudrait cent de plus pour l'arrêter complètement.</p>
        <p class="diary-line">Alors j'ai fait quelque chose de stupide.</p>
        <p class="diary-line">J'ai canalisé <strong>toute</strong> mon Énergie Maudite — absolument tout ce que je possédais — dans une seule balle ordinaire, et je l'ai tirée.</p>
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
        <p class="diary-line">Le Serment que j'ai prononcé : limiter à jamais la capacité de l'arme à deux munitions occultes simultanées, en échange d'une amplification maximale de ces deux munitions. Un serment d'entrave nécessite un témoin occulte. Liú était là.</p>
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
    if (!isSolved('puzzle3')) return renderJournalLocked('La Synchronisation du Barillet', 'training-4');
    return `
<div class="doc-paper diary-wrap">
    <div class="doc-header">
        <div class="doc-classification">DOCUMENT PERSONNEL — DERNIÈRES ENTRÉES</div>
        <div class="doc-title">JOURNAL INTIME D'HENRI DELACROIX</div>
        <div class="doc-subtitle">Entrées finales — Septembre 1893</div>
        <div class="doc-meta">
            <span>Déverrouillé par : La Synchronisation du Barillet</span>
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
        <p class="diary-line">Donc : je les cache. Séparément. À des endroits que seul quelqu'un de préparé pourrait trouver — quelqu'un qui aurait lu ce manuel jusqu'au bout.</p>
        <p class="diary-line"><strong>Si vous lisez ces lignes, vous êtes cette personne.</strong></p>
    </div>

    <div class="diary-separator">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

    <div class="diary-entry">
        <div class="diary-date">18 SEPTEMBRE 1893 — 23H47</div>
        <p class="diary-line">Je mets cette version complète du dossier à l'abri. Les coordonnées des armes elles-mêmes sont encodées dans les pages de garde de ce journal, en utilisant un chiffre que quiconque ayant complété le Manuel d'Entraînement devrait pouvoir reconstituer.</p>
        <p class="diary-line">Une dernière chose.</p>
        <p class="diary-line">Ces armes ont été forgées dans la douleur, dans le sang, dans la certitude de ma propre finitude. Elles ont protégé des innocents que la police officielle ne pouvait pas protéger. Elles ont vaincu des entités que la science ne peut même pas admettre.</p>
        <p class="diary-line">Mais elles ont un prix.</p>
        <p class="diary-line">Le Serment d'Entrave n'est pas juste une limite de munitions. C'est un rappel permanent que le pouvoir sans contrainte se retourne toujours contre celui qui le détient. La limite est la protection, pas l'ennemi.</p>
        <p class="diary-line">Ne cherchez jamais à briser le Serment. Ne le défiez jamais. Acceptez-le. <strong>C'est la seule leçon qui compte vraiment.</strong></p>
        <p class="diary-line">Je ne sais pas ce qui va se passer dans les prochains jours. Je ne sais pas si la silhouette reviendra. Je ne sais pas si je survivrai à ce qui m'attend.</p>
        <p class="diary-line">Mais ces armes, elles, survivront. Et elles attendront.</p>
        <p class="diary-line">Elles attendront quelqu'un comme vous.</p>
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
    '\u6b7b', '\u9b54', '\u706b', '\u5c71', '\u546a',   // 死 魔 火 山 呪
    '\u98a8', '\u6c34', '\u571f', '\u6728', '\u91d1',    // 風 水 土 木 金
    '\u8840', '\u547d', '\u529b', '\u5fc3', '\u5149',    // 血 命 力 心 光
    '\u9b42', '\u6708', '\u661f', '\u795e', '\u9b3c',    // 魂 月 星 神 鬼
];

function renderKanjiGrid() {
    const shuffled = [...ALL_KANJIS].sort(() => Math.random() - 0.5);
    const cells = shuffled.map(k => `
        <div class="kanji-cell" data-kanji="${k}">${k}</div>
    `).join('');

    return `
<div class="kanji-grid-wrap">
    <p class="kanji-progress" id="kanji-progress">Sélectionnez les quatre sceaux dans l'ordre correct...</p>
    <div class="kanji-grid" id="kanji-grid">${cells}</div>
    <button class="kanji-reset-btn" id="kanji-reset">Réinitialiser la sélection</button>
</div>`;
}

function initKanjiPuzzle() {
    if (isSolved('puzzle1')) return;

    const grid = document.getElementById('kanji-grid');
    if (!grid) return;

    let sequence = [];
    const progress = document.getElementById('kanji-progress');

    grid.addEventListener('click', e => {
        const cell = e.target.closest('.kanji-cell');
        if (!cell) return;

        const kanji = cell.dataset.kanji;
        const expected = KANJI_SOLUTION[sequence.length];

        if (kanji === expected) {
            sequence.push(kanji);
            cell.classList.add('selected');
            cell.dataset.order = sequence.length;

            const symbols = KANJI_SOLUTION.slice(0, sequence.length).join(' → ');
            progress.textContent = symbols;
            sound.playClick();

            if (sequence.length === KANJI_SOLUTION.length) {
                progress.textContent = '✦ Séquence correcte — Activation en cours... ✦';
                setTimeout(() => unlockPuzzle('puzzle1'), 800);
            }
        } else {
            // Wrong — flash red and reset
            cell.classList.add('wrong');
            setTimeout(() => {
                sequence = [];
                document.querySelectorAll('.kanji-cell.selected').forEach(c => {
                    c.classList.remove('selected');
                    delete c.dataset.order;
                });
                cell.classList.remove('wrong');
                progress.textContent = 'Séquence incorrecte — Recommencez...';
                setTimeout(() => { progress.textContent = 'Sélectionnez les quatre sceaux dans l\'ordre correct...'; }, 1500);
            }, 400);
            sound.playError();
        }
    });

    document.getElementById('kanji-reset')?.addEventListener('click', () => {
        sequence = [];
        document.querySelectorAll('.kanji-cell.selected').forEach(c => {
            c.classList.remove('selected');
            delete c.dataset.order;
        });
        progress.textContent = 'Sélection réinitialisée.';
        setTimeout(() => { progress.textContent = 'Sélectionnez les quatre sceaux dans l\'ordre correct...'; }, 1000);
    });
}

// ═══════════════════════════════════════════════════════════
//  PUZZLE 2 — INCANTATION
// ═══════════════════════════════════════════════════════════

function initIncantationPuzzle() {
    if (isSolved('puzzle2')) return;

    const input  = document.getElementById('incantation-input');
    const submit = document.getElementById('incantation-submit');
    if (!input || !submit) return;

    const checkIncantation = () => {
        const val = input.value.trim().toLowerCase();
        if (val === INCANTATION_SOL) {
            input.classList.remove('error');
            input.classList.add('success');
            sound.playClick();
            setTimeout(() => unlockPuzzle('puzzle2'), 600);
        } else {
            input.classList.remove('success');
            input.classList.add('error');
            sound.playError();
            setTimeout(() => input.classList.remove('error'), 800);
        }
    };

    submit.addEventListener('click', checkIncantation);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') checkIncantation(); });
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

    const svg   = document.getElementById('pattern-svg');
    const disp  = document.getElementById('pattern-display');
    const reset = document.getElementById('pattern-reset');
    if (!svg) return;

    let sequence = [];

    const linesGroup = document.getElementById('pattern-lines');

    function drawLine(fromDot, toDot, errored) {
        const from = DOT_POSITIONS[fromDot];
        const to   = DOT_POSITIONS[toDot];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);   line.setAttribute('y2', to.y);
        line.setAttribute('class', errored ? 'pattern-line error' : 'pattern-line');
        linesGroup.appendChild(line);
    }

    function resetPattern() {
        sequence = [];
        linesGroup.innerHTML = '';
        document.querySelectorAll('.pattern-dot').forEach(d => d.classList.remove('active', 'error'));
        disp.textContent = '— — — — — —';
    }

    svg.addEventListener('click', e => {
        const dot = e.target.closest('.pattern-dot');
        if (!dot) return;

        const num = parseInt(dot.dataset.dot, 10);
        if (sequence.includes(num)) return; // already used

        if (sequence.length > 0) {
            drawLine(sequence[sequence.length - 1], num, false);
        }

        sequence.push(num);
        dot.classList.add('active');
        disp.textContent = sequence.join(' → ');
        sound.playClick();

        if (sequence.length === 6) {
            const correct = PATTERN_SOL.every((v, i) => v === sequence[i]);
            if (correct) {
                disp.textContent = '✦ Synchronisation réussie ✦';
                setTimeout(() => unlockPuzzle('puzzle3'), 800);
            } else {
                // Flash error
                document.querySelectorAll('.pattern-dot.active').forEach(d => {
                    d.classList.add('error');
                    d.classList.remove('active');
                });
                document.querySelectorAll('.pattern-line').forEach(l => l.classList.add('error'));
                disp.textContent = 'Séquence incorrecte — Réinitialisez.';
                sound.playError();
                setTimeout(resetPattern, 1200);
            }
        }
    });

    reset?.addEventListener('click', resetPattern);
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
