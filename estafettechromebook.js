const SESSION_REF = db.collection('estafette_session').doc('current');

let myChromebookNumber = null;
let session = null;
let lastRenderedRound = -1;
let lastRenderedStatus = null;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get('cb');

    if (!cb) {
        document.body.innerHTML = '<h1>⚠️ Geen chromebook nummer opgegeven</h1><p style="padding:20px;color:#94a3b8;">Voeg <code>?cb=1</code> toe aan de URL.</p>';
        return;
    }
    myChromebookNumber = parseInt(cb);
    document.getElementById('cbNumber').textContent = myChromebookNumber;

    SESSION_REF.onSnapshot(doc => {
        if (!doc.exists) {
            session = null;
            updateUI();
            return;
        }
        session = doc.data();
        updateUI();
    });
});

function updateUI() {
    const statusEl = document.getElementById('status');
    const listEl = document.getElementById('playersList');

    if (!session) {
        statusEl.textContent = 'Wachten op spel...';
        listEl.innerHTML = '';
        lastRenderedRound = -1;
        lastRenderedStatus = null;
        return;
    }

    if (session.status === 'setup') {
        statusEl.textContent = 'Wachten op start...';
        listEl.innerHTML = '';
        lastRenderedRound = -1;
        lastRenderedStatus = 'setup';
        return;
    }

    if (session.status === 'between_rounds') {
        statusEl.textContent = 'Ronde afgelopen';
        listEl.innerHTML = '';
        lastRenderedRound = -1;
        lastRenderedStatus = 'between_rounds';
        return;
    }

    if (session.status === 'finished') {
        statusEl.textContent = '🏆 Spel afgelopen!';
        listEl.innerHTML = '';
        lastRenderedRound = -1;
        lastRenderedStatus = 'finished';
        return;
    }

    // Playing
    statusEl.textContent = `Ronde ${session.currentRoundIndex + 1} van ${session.config.numRounds}`;

    // Alleen opnieuw renderen als de ronde of status veranderd is
    const currentKey = session.status + '_' + session.currentRoundIndex;
    const lastKey = lastRenderedStatus + '_' + lastRenderedRound;
    if (currentKey === lastKey) return;

    lastRenderedStatus = session.status;
    lastRenderedRound = session.currentRoundIndex;

    const roundPlayers = session.players.filter(p => p.roundIndex === session.currentRoundIndex);

    listEl.innerHTML = roundPlayers.map(p => `
        <button class="player-btn ${p.finished ? 'finished' : ''}"
                data-name="${escapeHtml(p.naam)}"
                ${p.finished ? 'disabled' : ''}>
            ${escapeHtml(p.naam)}
            ${p.finished ? '<span class="checkmark">✅</span>' : ''}
        </button>
    `).join('');

    listEl.querySelectorAll('.player-btn').forEach(btn => {
        if (!btn.disabled) {
            btn.addEventListener('click', () => pressName(btn.dataset.name, btn));
        }
    });
}

async function pressName(playerName, btn) {
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 250);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(SESSION_REF);
            if (!doc.exists) return;
            const s = doc.data();
            if (s.status !== 'playing') return;

            const currentRound = s.currentRoundIndex;
            const playerIdx = s.players.findIndex(p =>
                p.naam === playerName && p.roundIndex === currentRound
            );
            if (playerIdx === -1) return;

            const player = s.players[playerIdx];
            if (player.finished) return;

            const expected = player.sequence[player.currentStep];
            if (expected !== myChromebookNumber) return; // Verkeerd: niets doen

            // Correct! Kopieer, update en schrijf terug
            const newPlayers = s.players.map(p => ({ ...p }));
            newPlayers[playerIdx].currentStep++;

            if (newPlayers[playerIdx].currentStep >= newPlayers[playerIdx].sequence.length) {
                newPlayers[playerIdx].finished = true;
                newPlayers[playerIdx].finishTime = Date.now() - s.roundStartTime;
            }

            transaction.update(SESSION_REF, { players: newPlayers });
        });
    } catch (err) {
        console.error('Press fout:', err);
    }
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
