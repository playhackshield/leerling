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
        const data = snap
