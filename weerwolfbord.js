// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
    ONDERVRAAG_TIJD: 120,
    STEM_TIJD_EERSTE: 10,
    STEM_TIJD_VOLGENDE: 5,
};

const HACKER_ACTIES = [
    "Een virus geïnstalleerd op de schoolserver.",
    "Wachtwoorden van drie docenten gestolen.",
    "Een phishingmail verstuurd naar alle leerlingen.",
    "Het schoolsysteem platgelegd met een DDoS-aanval.",
    "Een backdoor in het cijfersysteem geplaatst.",
    "Alle wachtwoorden gereset naar '123456'.",
    "Een ransomware geplaatst op de docenten-laptops.",
    "De schoolwebsite gehackt en vervangen door een meme.",
    "Alle schoolfoto's gestolen en versleuteld.",
    "Een valse Wi-Fi-hotspot opgezet.",
    "De alarminstallatie uitgeschakeld.",
    "Het rooster aangepast zodat iedereen te laat komt.",
    "Een keylogger geïnstalleerd op de computers.",
    "De beveiligingscamera's uitgezet.",
    "Een nep-mail gestuurd namens de directeur.",
    "Alle leerling-gegevens gedownload.",
    "Het cijfersysteem geblokkeerd.",
    "Een worm verspreid via de school-app.",
    "De printer ingesteld op alleen maar emoji's printen.",
    "Het schoolnetwerk overbelast.",
    "Een vals bericht geplaatst op het schoolbord.",
    "De deurcodes gereset.",
    "Een screenshot gemaakt van alle openstaande tabbladen.",
    "Het geluid op alle computers uitgezet.",
    "Een nep-WhatsApp-groep aangemaakt met de klas.",
    "De schoolkalender gewist.",
    "Een virus op de mediatheek-pc's gezet.",
    "De WiFi-wachtwoorden gepubliceerd op internet.",
    "Het school-apparaatbeheer overgenomen.",
    "De school-app vervangen door een nepversie."
];

const BURGER_ACTIES = [
    "Rummikub gespeeld op de telefoon.",
    "Een kattenfilmpje op YouTube gekeken.",
    "Een TikTok-dansje geoefend.",
    "Met een vriend(in) gebeld over huiswerk.",
    "Een game gespeeld op de laptop.",
    "Een boek gelezen over ruimtevaart.",
    "Naar muziek geluisterd op Spotify.",
    "Een tekening gemaakt in Paint.",
    "Een rekenopdracht gemaakt.",
    "Een filmpje over dinosaurussen gekeken.",
    "Met de hond gespeeld (in gedachten).",
    "Een puzzel opgelost op de telefoon.",
    "Een verhaal geschreven in een notitieblok.",
    "Een foto gemaakt van de maan.",
    "Een smoothie recept bekeken.",
    "Een quiz gedaan over dieren.",
    "Een brief geschreven aan een penvriend.",
    "Een tekening ingekleurd op de tablet.",
    "Een instructievideo over LEGO gekeken.",
    "Een mop opgezocht op internet."
];

// ============================================================
// FIRESTORE
// ============================================================
const gameRef = db.collection('games').doc('currentGame');

// ============================================================
// STATE
// ============================================================
let state = {
    leerlingen: [],
    namen: [],
    timerInterval: null,
    lastStatus: null,
};

// ============================================================
// UTILS
// ============================================================
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function showSection(id) {
    const current = document.querySelector('.section.active');
    if (current && current.id === id) return;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function setStatus(text, className = 'status-naaminvoer') {
    const badge = document.getElementById('statusBadge');
    badge.textContent = text;
    badge.className = 'status-badge ' + className;
}

function showDebug(msg) {
    const el = document.getElementById('debug');
    if (el.classList.contains('visible')) {
        el.innerHTML += `\n[${new Date().toLocaleTimeString()}] ${msg}`;
        el.scrollTop = el.scrollHeight;
    }
}

function toggleDebug() {
    const el = document.getElementById('debug');
    el.classList.toggle('visible');
    if (el.classList.contains('visible')) el.textContent = '🐞 Debug log:\n';
}

// ============================================================
// LEERLINGEN LADEN
// ============================================================
async function laadLeerlingen() {
    try {
        const snap = await db.collection('contestants').limit(1).get();
        if (snap.empty) throw new Error('Geen document in collectie "contestants"');
        const data = snap.docs[0].data();
        state.leerlingen = data.leerlingen || [];
        displayLeerlingen();
        document.getElementById('laadStatus').textContent =
            `✅ ${state.leerlingen.length} leerlingen geladen.`;
    } catch (e) {
        console.error(e);
        document.getElementById('laadStatus').textContent = '❌ ' + e.message;
    }
}

function displayLeerlingen() {
    const lijst = document.getElementById('leerlingenLijst');
    if (state.leerlingen.length === 0) {
        lijst.innerHTML = '<p style="color:#8899bb;">Geen leerlingen gevonden.</p>';
        return;
    }

    lijst.innerHTML = state.leerlingen.map(l =>
        `<div class="speler-card">${l.naam}</div>`
    ).join('');
}

// ============================================================
// ROLVERDELING MET GROEPREGELS
// ============================================================
function assignRoles(leerlingen) {
    const groep0 = leerlingen.filter(l => l.groep === 0);
    const groep1 = leerlingen.filter(l => l.groep === 1);
    const groep2 = leerlingen.filter(l => l.groep === 2);

    const shuffledGroep0 = shuffle(groep0);

    // Groep 1 en groep 2 krijgen tegengestelde rollen
    const groep1Rol = Math.random() < 0.5 ? 'hacker' : 'burger';
    const groep2Rol = groep1Rol === 'hacker' ? 'burger' : 'hacker';

    const rollen = {};
    groep1.forEach(l => rollen[l.naam] = groep1Rol);
    groep2.forEach(l => rollen[l.naam] = groep2Rol);

    // Groep 0 verdeelt zich om zo gebalanceerd mogelijk te zijn
    let hackers = 0, burgers = 0;
    Object.values(rollen).forEach(r => r === 'hacker' ? hackers++ : burgers++);

    shuffledGroep0.forEach(l => {
        if (hackers <= burgers) {
            rollen[l.naam] = 'hacker'; hackers++;
        } else {
            rollen[l.naam] = 'burger'; burgers++;
        }
    });

    // Acties toewijzen (uniek)
    const acties = {};
    const hackerActies = shuffle(HACKER_ACTIES);
    const burgerActies = shuffle(BURGER_ACTIES);
    let hIdx = 0, bIdx = 0;

    // Schud de volgorde waarin we leerlingen verwerken, zodat acties niet
    // in dezelfde volgorde als namen worden toegewezen
    const shuffledLeerlingen = shuffle(leerlingen);
    shuffledLeerlingen.forEach(l => {
        if (rollen[l.naam] === 'hacker') {
            acties[l.naam] = hackerActies[hIdx % hackerActies.length];
            hIdx++;
        } else {
            acties[l.naam] = burgerActies[bIdx % burgerActies.length];
            bIdx++;
        }
    });

    return { rollen, acties };
}

// ============================================================
// SPEL STARTEN
// ============================================================
async function startSpel() {
    if (state.leerlingen.length < 4) {
        alert('Minimaal 4 leerlingen nodig!');
        return;
    }

    const namen = shuffle(state.leerlingen.map(l => l.naam));
    const { rollen, acties } = assignRoles(state.leerlingen);

    await gameRef.set({
        status: 'rolverdeling',
        leerlingen: state.leerlingen,
        namen: namen,
        rollen: rollen,
        acties: acties,
        afvallers: [],
        stemmen: {},
        stemStart: false,
        isEersteStemmer: true,
        huidigeBeurt: namen[0],
        winnaar: '',
        ronden: 0,
        config: {
            ondervraagTijd: CONFIG.ONDERVRAAG_TIJD,
            stemTijdEerste: CONFIG.STEM_TIJD_EERSTE,
            stemTijdVolgende: CONFIG.STEM_TIJD_VOLGENDE,
        }
    });
}

// ============================================================
// ROLVERDELING UI
// ============================================================
function updateRolverdelingUI(data) {
    const namen = data.namen || [];
    const huidigeBeurt = data.huidigeBeurt || '';
    const idx = namen.indexOf(huidigeBeurt);

    document.getElementById('rolBeurtNaam').textContent = huidigeBeurt || '—';
    document.getElementById('rolverdelingStatus').textContent =
        `Kind ${idx + 1} van ${namen.length} is aan de beurt.`;

    const lijst = document.getElementById('rolverdelingLijst');
    lijst.innerHTML = namen.map((naam, i) => {
        const isGedaan = i < idx;
        const isNu = i === idx;
        return `<div class="speler-card ${isGedaan ? 'afvaller' : ''}"
                    style="${isNu ? 'border-color:#00d4ff; box-shadow:0 0 20px rgba(0,212,255,0.4);' : ''}">
            ${naam}
            ${isGedaan ? ' <span style="color:#00c853;">✅</span>' : ''}
            ${isNu ? ' <span style="color:#00d4ff;">👈</span>' : ''}
        </div>`;
    }).join('');

    // Volgende-knop: uit als laatste kind aan de beurt is
    document.getElementById('volgendeKindBtn').disabled = idx >= namen.length - 1;
    // Klaar-knop: aan als laatste kind aan de beurt is
    document.getElementById('rolverdelingKlaarBtn').disabled = idx < namen.length - 1;
}

async function volgendeKind() {
    const data = (await gameRef.get()).data();
    if (!data) return;
    const namen = data.namen || [];
    const idx = namen.indexOf(data.huidigeBeurt);
    if (idx < namen.length - 1) {
        await gameRef.update({ huidigeBeurt: namen[idx + 1] });
    }
}

async function rolverdelingKlaar() {
    await gameRef.update({ status: 'ondervraging', huidigeBeurt: '' });
}

// ============================================================
// ONDERVRAAGRONDE
// ============================================================
function updateOndervraagUI(data) {
    const namen = data.namen || [];
    const afvallers = data.afvallers || [];
    const overgebleven = namen.filter(n => !afvallers.includes(n));

    const lijst = document.getElementById('ondervraagLijst');
    lijst.innerHTML = overgebleven.map(naam =>
        `<div class="speler-card">${naam}</div>`
    ).join('');

    if (!state.timerInterval) {
        startOndervraagTimer(data.config?.ondervraagTijd || CONFIG.ONDERVRAAG_TIJD);
    }
}

function startOndervraagTimer(tijd) {
    let resterend = tijd;
    const timerEl = document.getElementById('ondervraagTimer');
    timerEl.className = 'timer';

    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        resterend--;
        const min = Math.floor(resterend / 60);
        const sec = resterend % 60;
        timerEl.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
        if (resterend <= 10) timerEl.className = 'timer danger';
        else if (resterend <= 30) timerEl.className = 'timer warning';
        else timerEl.className = 'timer';

        if (resterend <= 0) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
            timerEl.textContent = '⏰ TIJD!';
        }
    }, 1000);
}

async function startStemronde() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    const data = (await gameRef.get()).data();
    const afvallers = data.afvallers || [];
    const overgebleven = data.namen.filter(n => !afvallers.includes(n));

    await gameRef.update({
        status: 'stemming',
        stemmen: {},
        stemStart: false,
        isEersteStemmer: true,
        huidigeBeurt: overgebleven[0],
    });
}

// ============================================================
// STEMRONDE
// ============================================================
function updateStemUI(data) {
    const namen = data.namen || [];
    const afvallers = data.afvallers || [];
    const overgebleven = namen.filter(n => !afvallers.includes(n));
    const huidigeBeurt = data.huidigeBeurt || '';
    const stemmen = data.stemmen || {};
    const stemStart = data.stemStart === true;

    const idx = overgebleven.indexOf(huidigeBeurt);
    const heeftGestemd = huidigeBeurt && stemmen[huidigeBeurt] !== undefined;
    const totaalGestemd = Object.keys(stemmen).filter(k => overgebleven.includes(k)).length;
    const alleGestemd = totaalGestemd >= overgebleven.length;

    // Beurt-box
    document.getElementById('stemBeurtNaam').textContent = huidigeBeurt || '—';
    let instructie;
    if (heeftGestemd) {
        instructie = '✅ Stem is uitgebracht!';
    } else if (stemStart) {
        instructie = '⏳ Timer loopt op de telefoon...';
    } else {
        instructie = 'Geef de telefoon aan deze leerling en klik op "Start timer".';
    }
    document.getElementById('stemBeurtInstructie').textContent = instructie;

    // Lijst
    const lijst = document.getElementById('stemLijst');
    lijst.innerHTML = overgebleven.map(naam =>
        `<div class="speler-card"
              style="${naam === huidigeBeurt ? 'border-color:#00d4ff; box-shadow:0 0 20px rgba(0,212,255,0.4);' : ''}">
            ${naam}
            ${naam === huidigeBeurt ? ' <span style="color:#00d4ff;">👈</span>' : ''}
            ${stemmen[naam] !== undefined ? ' <span style="color:#00c853;">🗳️</span>' : ''}
        </div>`
    ).join('');

    // Knoppen
    document.getElementById('startTimerBtn').disabled = stemStart || heeftGestemd || !huidigeBeurt;
    document.getElementById('vorigeStemmerBtn').disabled = idx <= 0;
    document.getElementById('volgendeStemmerBtn').disabled = !heeftGestemd && !alleGestemd;
    document.getElementById('toonUitslagBtn').disabled = !alleGestemd;

    document.getElementById('stemInfo').textContent =
        `Er zijn ${totaalGestemd} van ${overgebleven.length} stemmen uitgebracht.`;
}

async function startTimer() {
    await gameRef.update({ stemStart: true });
}

async function vorigeStemmer() {
    const data = (await gameRef.get()).data();
    const namen = data.namen || [];
    const afvallers = data.afvallers || [];
    const overgebleven = namen.filter(n => !afvallers.includes(n));
    const idx = overgebleven.indexOf(data.huidigeBeurt);

    if (idx <= 0) return;
    const vorige = overgebleven[idx - 1];

    // Verwijder hun oude stem
    const update = {
        huidigeBeurt: vorige,
        stemStart: false,
        isEersteStemmer: (idx - 1 === 0),
    };
    if (data.stemmen && data.stemmen[vorige] !== undefined) {
        update[`stemmen.${vorige}`] = firebase.firestore.FieldValue.delete();
    }
    await gameRef.update(update);
}

async function volgendeStemmer() {
    const data = (await gameRef.get()).data();
    const namen = data.namen || [];
    const afvallers = data.afvallers || [];
    const overgebleven = namen.filter(n => !afvallers.includes(n));
    const idx = overgebleven.indexOf(data.huidigeBeurt);
    const stemmen = data.stemmen || {};

    // Als alle stemmen binnen zijn, hoef je niet verder
    const totaalGestemd = Object.keys(stemmen).filter(k => overgebleven.includes(k)).length;
    if (totaalGestemd >= overgebleven.length) {
        document.getElementById('stemInfo').textContent = 'Alle stemmen zijn binnen! Klik op "Toon uitslag".';
        return;
    }

    if (idx < overgebleven.length - 1) {
        await gameRef.update({
            huidigeBeurt: overgebleven[idx + 1],
            stemStart: false,
            isEersteStemmer: false,
        });
    }
}

// ============================================================
// UITSLAG
// ============================================================
async function toonUitslag() {
    const data = (await gameRef.get()).data();
    const stemmen = data.stemmen || {};
    const afvallers = data.afvallers || [];

    const telling = {};
    Object.values(stemmen).forEach(target => {
        if (!afvallers.includes(target)) {
            telling[target] = (telling[target] || 0) + 1;
        }
    });

    let maxStemmen = 0;
    let winnaars = [];
    for (const [naam, aantal] of Object.entries(telling)) {
        if (aantal > maxStemmen) { maxStemmen = aantal; winnaars = [naam]; }
        else if (aantal === maxStemmen) winnaars.push(naam);
    }

    showSection('sectionUitslag');
    setStatus('📊 Uitslag', 'status-uitslag');

    const content = document.getElementById('uitslagContent');
    let html = '<div style="margin-bottom:20px;">';
    for (const [naam, aantal] of Object.entries(telling)) {
        const max = Math.max(1, maxStemmen);
        const perc = (aantal / max) * 100;
        html += `<div class="stem-resultaat">
            <div><span class="naam">${naam}</span>
            <span class="aantal">${aantal} stem${aantal !== 1 ? 'men' : ''}</span></div>
            <div class="stem-balk"><div class="vulling" style="width:${perc}%;"></div></div>
        </div>`;
    }
    html += '</div>';

    if (winnaars.length === 0) {
        html += '<p style="color:#ff6b35; font-size:1.3rem;">⚠️ Niemand heeft gestemd?!</p>';
    } else if (winnaars.length === 1) {
        html += `<h3 style="color:#00d4ff;">🏆 ${winnaars[0]} wordt weggestemd met ${maxStemmen} stemmen!</h3>`;
        html += `<button class="btn btn-danger" onclick="elimineer('${winnaars[0]}')">❌ Stem ${winnaars[0]} weg</button>`;
    } else {
        html += `<h3 style="color:#f7c948;">⚖️ Gelijkspel tussen ${winnaars.join(', ')}!</h3>`;
        html += `<p style="color:#8899bb;">Klik op de speler die je wilt wegstemmen:</p>`;
        html += `<div class="gelijke-stem">`;
        winnaars.forEach(naam => {
            html += `<div class="optie" onclick="elimineer('${naam}')">${naam}</div>`;
        });
        html += `</div>`;
    }
    content.innerHTML = html;
}

// ============================================================
// ELIMINEREN
// ============================================================
async function elimineer(naam) {
    const data = (await gameRef.get()).data();
    const rollen = data.rollen || {};
    const afvallers = data.afvallers || [];
    if (afvallers.includes(naam)) return;

    const nieuweAfvallers = [...afvallers, naam];
    const overgebleven = data.namen.filter(n => !nieuweAfvallers.includes(n));
    const hackerOver = overgebleven.some(n => rollen[n] === 'hacker');
    const burgerOver = overgebleven.some(n => rollen[n] === 'burger');

    let winnaar = '';
    if (!hackerOver) winnaar = 'burgers';
    else if (!burgerOver) winnaar = 'hackers';

    const update = {
        afvallers: nieuweAfvallers,
        stemmen: {},
        stemStart: false,
        isEersteStemmer: true,
        huidigeBeurt: '',
        ronden: (data.ronden || 0) + 1,
    };

    if (winnaar) {
        update.winnaar = winnaar;
        update.status = 'einde';
    } else {
        update.status = 'ondervraging';
    }
    await gameRef.update(update);

    const content = document.getElementById('uitslagContent');
    const rol = rollen[naam] === 'hacker' ? '🔴 HACKER' : '🟢 BURGER';
    const kleur = rollen[naam] === 'hacker' ? '#ff1744' : '#00c853';

    content.innerHTML = `
        <div style="text-align:center; padding:30px 0;">
            <h2 style="color:${kleur}; font-size:3rem;">${naam} was een ${rol}!</h2>
            <p style="color:#8899bb; font-size:1.2rem;">Deze speler valt af en mag niet meer meestemmen.</p>
            <br>
            <button class="btn btn-primary" onclick="gaNaarVolgendeRonde()">⏭️ Ga naar volgende ronde</button>
        </div>
    `;
}

async function gaNaarVolgendeRonde() {
    // Status is al 'ondervraging' (of 'einde')
    state.timerInterval = null;
}

// ============================================================
// WINNAAR
// ============================================================
function showWinnaar(winnaar) {
    showSection('sectionEinde');
    setStatus('🏆 Einde', 'status-einde');
    const titel = document.getElementById('winnaarTitel');
    const sub = document.getElementById('winnaarSub');
    const emoji = document.querySelector('.emoji-groot');

    if (winnaar === 'hackers') {
        titel.className = 'hackers-win';
        titel.textContent = '🔴 DE HACKERS WINNEN!';
        sub.textContent = 'Ze hebben alle burgers uitgeschakeld!';
        emoji.textContent = '💻';
    } else {
        titel.className = 'burgers-win';
        titel.textContent = '🟢 DE BURGERS WINNEN!';
        sub.textContent = 'Ze hebben alle hackers ontmaskerd!';
        emoji.textContent = '🛡️';
    }
}

// ============================================================
// RESET
// ============================================================
async function resetSpel() {
    if (!confirm('Weet je zeker dat je het spel wilt resetten?')) return;

    await gameRef.set({
        status: 'naaminvoer',
        leerlingen: state.leerlingen,
        namen: [],
        rollen: {},
        acties: {},
        afvallers: [],
        stemmen: {},
        stemStart: false,
        isEersteStemmer: true,
        huidigeBeurt: '',
        winnaar: '',
        ronden: 0,
        config: {
            ondervraagTijd: CONFIG.ONDERVRAAG_TIJD,
            stemTijdEerste: CONFIG.STEM_TIJD_EERSTE,
            stemTijdVolgende: CONFIG.STEM_TIJD_VOLGENDE,
        }
    });
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

// ============================================================
// FIRESTORE LISTENER
// ============================================================
gameRef.onSnapshot((doc) => {
    if (!doc.exists) return;
    const data = doc.data();

    // Stop timer als we niet in ondervraging zijn
    if (data.status !== 'ondervraging' && state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    switch (data.status) {
        case 'naaminvoer':
            showSection('sectionNaamInvoer');
            setStatus('📋 Naam invoer', 'status-naaminvoer');
            break;
        case 'rolverdeling':
            showSection('sectionRolverdeling');
            setStatus('🔄 Rolverdeling', 'status-rolverdeling');
            updateRolverdelingUI(data);
            break;
        case 'ondervraging':
            showSection('sectionOndervraging');
            setStatus('💬 Ondervraging', 'status-ondervraging');
            updateOndervraagUI(data);
            break;
        case 'stemming':
            showSection('sectionStemming');
            setStatus('🗳️ Stemming', 'status-stemming');
            updateStemUI(data);
            break;
        case 'einde':
            showWinnaar(data.winnaar);
            break;
    }
    state.lastStatus = data.status;
});

// ============================================================
// INIT
// ============================================================
console.log('🔐 Hackers versus Burgers - Digibord geladen!');
laadLeerlingen();
