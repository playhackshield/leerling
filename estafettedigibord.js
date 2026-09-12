const SESSION_REF = db.collection('estafette_session').doc('current');

let contestants = [];
let session = null;
let timerInterval = null;

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
    loadContestants();
    listenToSession();
    setupEventListeners();
});

// === CONTESTANTS LADEN ===
async function loadContestants() {
    try {
        const snapshot = await db.collection('contestants').limit(1).get();
        if (snapshot.empty) throw new Error('Geen contestants document gevonden');
        const data = snapshot.docs[0].data();
        contestants = (data.leerlingen || []).map(l => ({
            naam: l.naam,
            groep: (l.groep !== undefined && l.groep > 0) ? l.groep : 0
        }));
        renderContestants();
    } catch (err) {
        console.error(err);
        document.getElementById('setupError').textContent = 'Kon deelnemers niet laden: ' + err.message;
    }
}

function renderContestants() {
    document.getElementById('deelnemersCount').textContent = contestants.length;
    const list = document.getElementById('deelnemersList');
    list.innerHTML = contestants.map(c =>
        `<li>${escapeHtml(c.naam)}${c.groep > 0 ? `<span class="groep">Groep ${c.groep}</span>` : ''}</li>`
    ).join('');
}

// === SESSION LISTENER ===
function listenToSession() {
    SESSION_REF.onSnapshot(doc => {
        if (!doc.exists) {
            // Maak aan met setup-state
            SESSION_REF.set({
                status: 'setup',
                config: { numRounds: 2, numChromebooks: 4, numRuns: 3 },
                currentRoundIndex: 0,
                roundStartTime: null,
                players: []
            });
            return;
        }
        session = doc.data();
        updateScreen();

        // Auto-einde ronde check
        if (session.status === 'playing') {
            const roundPlayers = session.players.filter(p => p.roundIndex === session.currentRoundIndex);
            if (roundPlayers.length > 0 && roundPlayers.every(p => p.finished)) {
                SESSION_REF.update({ status: 'between_rounds' });
            }
        }
    });
}

// === UI UPDATEN ===
function updateScreen() {
    if (!session) return;
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));

    if (session.status === 'setup') {
        document.getElementById('setupScreen').classList.add('active');
        stopTimer();
        renderContestants();
    } else if (session.status === 'playing') {
        document.getElementById('playingScreen').classList.add('active');
        renderPlaying();
        startTimer();
    } else if (session.status === 'between_rounds') {
        document.getElementById('betweenScreen').classList.add('active');
        stopTimer();
        renderBetween();
    } else if (session.status === 'finished') {
        document.getElementById('finishedScreen').classList.add('active');
        stopTimer();
        renderFinished();
    }
}

function renderPlaying() {
    document.getElementById('roundNumber').textContent = session.currentRoundIndex + 1;
    document.getElementById('totalRounds').textContent = session.config.numRounds;

    const roundPlayers = session.players.filter(p => p.roundIndex === session.currentRoundIndex);
    const grid = document.getElementById('playersGrid');
    grid.innerHTML = roundPlayers.map(p => {
        if (p.finished) {
            return `
                <div class="player-card finished">
                    <div class="player-name">${escapeHtml(p.naam)}</div>
                    <div class="player-status">✅ Klaar in ${formatTime(p.finishTime)}</div>
                </div>`;
        }
        const target = p.sequence[p.currentStep];
        return `
            <div class="player-card">
                <div class="player-name">${escapeHtml(p.naam)}</div>
                <div class="player-target">→ Chromebook ${target}</div>
            </div>`;
    }).join('');
}

function renderBetween() {
    document.getElementById('betweenRoundNumber').textContent = session.currentRoundIndex + 1;

    const roundPlayers = session.players.filter(p => p.roundIndex === session.currentRoundIndex);
    const sorted = [...roundPlayers].sort((a, b) => {
        if (a.finishTime == null && b.finishTime == null) return 0;
        if (a.finishTime == null) return 1;
        if (b.finishTime == null) return -1;
        return a.finishTime - b.finishTime;
    });

    const table = document.getElementById('roundScoreboard');
    table.innerHTML = `
        <thead><tr><th>#</th><th>Naam</th><th>Tijd</th></tr></thead>
        <tbody>
            ${sorted.map((p, i) => `
                <tr class="${i === 0 && p.finishTime != null ? 'winner' : ''}">
                    <td>${i + 1}</td>
                    <td>${escapeHtml(p.naam)}</td>
                    <td>${p.finishTime != null ? formatTime(p.finishTime) : '—'}</td>
                </tr>`).join('')}
        </tbody>`;
}

function renderFinished() {
    // Alle spelers, gesorteerd op tijd (over alle rondes)
    const all = [...session.players].sort((a, b) => {
        if (a.finishTime == null && b.finishTime == null) return 0;
        if (a.finishTime == null) return 1;
        if (b.finishTime == null) return -1;
        return a.finishTime - b.finishTime;
    });

    const table = document.getElementById('finalScoreboard');
    table.innerHTML = `
        <thead><tr><th>#</th><th>Naam</th><th>Ronde</th><th>Tijd</th></tr></thead>
        <tbody>
            ${all.map((p, i) => `
                <tr class="${i === 0 && p.finishTime != null ? 'winner' : ''}">
                    <td>${i + 1}</td>
                    <td>${escapeHtml(p.naam)}</td>
                    <td>${p.roundIndex + 1}</td>
                    <td>${p.finishTime != null ? formatTime(p.finishTime) : '—'}</td>
                </tr>`).join('')}
        </tbody>`;
}

// === TIMER ===
function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
        if (!session || session.status !== 'playing' || !session.roundStartTime) return;
        const elapsed = Date.now() - session.roundStartTime;
        document.getElementById('timer').textContent = formatTime(elapsed);
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function formatTime(ms) {
    if (ms == null) return '—';
    const sec = ms / 1000;
    if (sec < 60) return sec.toFixed(1) + 's';
    const min = Math.floor(sec / 60);
    return min + ':' + (sec - min * 60).toFixed(1).padStart(4, '0');
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('nextRoundBtn').addEventListener('click', nextRound);
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('forceEndBtn').addEventListener('click', forceEndRound);
    document.getElementById('restartBtn').addEventListener('click', resetGame);
}

// === SPEL STARTEN ===
async function startGame() {
    const numRounds = parseInt(document.getElementById('numRounds').value);
    const numChromebooks = parseInt(document.getElementById('numChromebooks').value);
    const numRuns = parseInt(document.getElementById('numRuns').value);

    if (contestants.length === 0) { alert('Geen deelnemers geladen'); return; }
    if (numRounds < 1 || numRounds > contestants.length) {
        alert(`Aantal rondes moet tussen 1 en ${contestants.length} zijn`); return;
    }
    if (numChromebooks < 1 || numChromebooks > 6) { alert('Aantal Chromebooks moet 1-6 zijn'); return; }
    if (numRuns < 1) { alert('Aantal keer rennen moet minstens 1 zijn'); return; }

    // 1. Groepen automatisch toewijzen waar nodig
    const players = contestants.map(c => ({
        naam: c.naam,
        groep: c.groep > 0 ? c.groep : 0
    }));
    let nextGroup = 1;
    players.forEach(p => {
        if (p.groep === 0) {
            p.groep = nextGroup;
            nextGroup = nextGroup === 1 ? 2 : 1;
        }
    });

    // 2. Willekeurige volgorde
    shuffleArray(players);

    // 3. Rondes verdelen
    const N = players.length;
    const R = numRounds;
    const base = Math.floor(N / R);
    const rem = N % R;
    const roundSizes = [];
    for (let i = 0; i < R; i++) roundSizes.push(i < rem ? base + 1 : base);

    let idx = 0;
    const roundsAssignment = [];
    for (let r = 0; r < R; r++) {
        roundsAssignment.push(players.slice(idx, idx + roundSizes[r]));
        idx += roundSizes[r];
    }

    // 4. Unieke volgorde per speler binnen elke ronde
    roundsAssignment.forEach((roundPlayers, r) => {
        const used = new Set();
        roundPlayers.forEach(p => {
            let seq, attempts = 0;
            do {
                seq = generateSequence(numRuns, numChromebooks);
                attempts++;
            } while (used.has(seq.join(',')) && attempts < 100);
            used.add(seq.join(','));
            p.roundIndex = r;
            p.sequence = seq;
            p.currentStep = 0;
            p.finished = false;
            p.finishTime = null;
        });
    });

    // 5. Wegschrijven
    await SESSION_REF.set({
        status: 'playing',
        config: { numRounds, numChromebooks, numRuns },
        currentRoundIndex: 0,
        roundStartTime: Date.now(),
        players: players
    });
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function generateSequence(numRuns, numChromebooks) {
    const all = [];
    for (let i = 1; i <= numChromebooks; i++) all.push(i);

    if (numRuns <= numChromebooks) {
        const shuffled = [...all];
        shuffleArray(shuffled);
        return shuffled.slice(0, numRuns);
    } else {
        const seq = [...all];
        shuffleArray(seq);
        while (seq.length < numRuns) {
            const last = seq[seq.length - 1];
            const candidates = all.filter(c => c !== last);
            seq.push(candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : all[0]);
        }
        return seq;
    }
}

// === RONDE WISSELEN ===
async function nextRound() {
    const next = session.currentRoundIndex + 1;
    if (next >= session.config.numRounds) {
        await SESSION_REF.update({ status: 'finished' });
    } else {
        await SESSION_REF.update({
            status: 'playing',
            currentRoundIndex: next,
            roundStartTime: Date.now()
        });
    }
}

async function forceEndRound() {
    if (!session || session.status !== 'playing') return;
    if (!confirm('Weet je zeker dat je de ronde nu wilt beëindigen?')) return;
    await SESSION_REF.update({ status: 'between_rounds' });
}

async function resetGame() {
    if (!confirm('Weet je zeker dat je het spel opnieuw wilt starten? Alle voortgang gaat verloren.')) return;
    await SESSION_REF.set({
        status: 'setup',
        config: session ? session.config : { numRounds: 2, numChromebooks: 4, numRuns: 3 },
        currentRoundIndex: 0,
        roundStartTime: null,
        players: []
    });
    loadContestants();
}

// === HELPER ===
function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
