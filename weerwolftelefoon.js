// ============================================================
// FIRESTORE
// ============================================================
const gameRef = db.collection('games').doc('currentGame');

// ============================================================
// STATE
// ============================================================
let state = {
    naam: '',
    rol: '',
    actie: '',
    gekozenStem: null,
    timerInterval: null,
    stemTijd: 0,
    localLastBeurt: '',
    roleShown: false,
    stemUIStarted: false,
};

// ============================================================
// SECTIE MANAGEMENT
// ============================================================
function showSection(id) {
    const current = document.querySelector('.section.active');
    if (current && current.id === id) return;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ============================================================
// FIRESTORE LISTENER
// ============================================================
gameRef.onSnapshot((doc) => {
    if (!doc.exists) {
        showSection('sectionWait');
        return;
    }
    const data = doc.data();
    const status = data.status;
    const huidigeBeurt = data.huidigeBeurt || '';
    const stemmen = data.stemmen || {};

    // ---- ROLVERDELING ----
    if (status === 'rolverdeling' && huidigeBeurt) {
        if (huidigeBeurt !== state.localLastBeurt) {
            state.localLastBeurt = huidigeBeurt;
            state.naam = huidigeBeurt;
            state.roleShown = false;
            state.stemUIStarted = false;
            document.getElementById('revealNaam').textContent = huidigeBeurt;
            showSection('sectionReveal');
        }
        return;
    }

    // ---- STEMMING ----
    if (status === 'stemming' && huidigeBeurt) {
        // Als deze speler al heeft gestemd → bedankt
        if (stemmen[huidigeBeurt] !== undefined) {
            document.getElementById('bedanktMsg').textContent = 'Je stem is opgeslagen. Geef de telefoon terug.';
            stopStemTimer();
            showSection('sectionBedankt');
            return;
        }

        // Als timer nog niet is gestart → wachten
        if (!data.stemStart) {
            stopStemTimer();
            state.stemUIStarted = false;
            state.localLastBeurt = huidigeBeurt;
            showSection('sectionWachtStart');
            return;
        }

        // Timer loopt → toon stem-UI (alleen eerste keer opzetten)
        if (!state.stemUIStarted || state.localLastBeurt !== huidigeBeurt) {
            state.localLastBeurt = huidigeBeurt;
            state.stemUIStarted = true;
            startStemUI(huidigeBeurt, data);
        }
        return;
    }

    // ---- OVERIGE STATUSSEN ----
    stopStemTimer();
    state.stemUIStarted = false;
    showSection('sectionWait');
    document.getElementById('waitMsg').textContent = 'Wacht op de spelleider...';
});

// ============================================================
// ROL TONEN
// ============================================================
async function toonRol() {
    try {
        const snap = await gameRef.get();
        const data = snap.data();
        const naam = data.huidigeBeurt;
        const rol = data.rollen[naam];
        const actie = data.acties[naam] || 'Geen actie';

        state.naam = naam;
        state.rol = rol;
        state.actie = actie;

        const icon = document.getElementById('rolIcon');
        const naamEl = document.getElementById('rolNaam');
        const actieEl = document.getElementById('rolActie');

        if (rol === 'hacker') {
            icon.textContent = '🔴';
            naamEl.textContent = 'HACKER';
            naamEl.className = 'rol-naam hacker';
        } else {
            icon.textContent = '🟢';
            naamEl.textContent = 'BURGER';
            naamEl.className = 'rol-naam burger';
        }
        actieEl.textContent = `Deze nacht heb je: ${actie}`;
        showSection('sectionRol');
    } catch (e) {
        console.error(e);
    }
}

function rolGezien() {
    document.getElementById('bedanktMsg').textContent = 'Geef de telefoon terug aan de spelleider.';
    showSection('sectionBedankt');
}

// ============================================================
// STEMMEN
// ============================================================
function startStemUI(naam, data) {
    const namen = data.namen || [];
    const afvallers = data.afvallers || [];
    const beschikbaar = namen.filter(n => n !== naam && !afvallers.includes(n));

    const lijstEl = document.getElementById('stemLijst');
    lijstEl.innerHTML = beschikbaar.map(n =>
        `<div class="stem-optie" onclick="kiesStem('${n}')">${n}</div>`
    ).join('');

    state.naam = naam;
    state.gekozenStem = null;
    document.getElementById('stemBevestigBtn').disabled = true;

    const isEerste = data.isEersteStemmer !== false;
    const config = data.config || {};
    const tijd = isEerste ? (config.stemTijdEerste || 10) : (config.stemTijdVolgende || 5);
    state.stemTijd = tijd;

    showSection('sectionStem');
    document.getElementById('stemTimerText').textContent =
        `Je hebt ${tijd} seconden${isEerste ? ' (eerste stemmer)' : ''}...`;
    startStemTimer(tijd);
}

function kiesStem(naam) {
    state.gekozenStem = naam;
    document.querySelectorAll('.stem-optie').forEach(el => {
        el.classList.remove('geselecteerd');
        if (el.textContent === naam) el.classList.add('geselecteerd');
    });
    document.getElementById('stemBevestigBtn').disabled = false;
}

function startStemTimer(seconden) {
    stopStemTimer();
    const timerEl = document.getElementById('stemTimer');
    let tijd = seconden;
    timerEl.textContent = tijd;
    timerEl.className = 'timer';

    state.timerInterval = setInterval(() => {
        tijd--;
        timerEl.textContent = tijd;
        if (tijd <= 3) timerEl.className = 'timer danger';
        else if (tijd <= 5) timerEl.className = 'timer warning';
        else timerEl.className = 'timer';

        if (tijd <= 0) {
            stopStemTimer();
            timerEl.textContent = '⏰';
            if (state.gekozenStem) {
                bevestigStem();
            } else {
                const opties = document.querySelectorAll('.stem-optie');
                if (opties.length > 0) {
                    const randomIndex = Math.floor(Math.random() * opties.length);
                    kiesStem(opties[randomIndex].textContent);
                    setTimeout(bevestigStem, 300);
                }
            }
        }
    }, 1000);
}

function stopStemTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

async function bevestigStem() {
    if (!state.gekozenStem) return;
    stopStemTimer();

    try {
        await gameRef.update({
            [`stemmen.${state.naam}`]: state.gekozenStem
        });
        document.getElementById('bedanktMsg').textContent = 'Je stem is opgeslagen. Geef de telefoon terug.';
        showSection('sectionBedankt');
    } catch (e) {
        console.error(e);
    }
}

console.log('📱 Hackers versus Burgers - Telefoon geladen!');
