// ============================================================
// CONFIGURATIE
// ============================================================
const CONFIG = {
    ONDERVRAAG_TIJD: 120,     // seconden
    STEM_TIJD_EERSTE: 10,    // seconden
    STEM_TIJD_VOLGENDE: 5,   // seconden
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
// FIRESTORE REFERENTIE
// ============================================================
const gameRef = db.collection('games').doc('currentGame');

// ============================================================
// STATE
// ============================================================
let state = {
    namen: [],
    huidigeIndex: 0,
    stemBeurtIndex: 0,
    isEersteStemmer: true,
    afvallers: [],
    overgebleven: [],
    stemmen: {},
    timerInterval: null,
    ondervraagTijd: CONFIG.ONDERVRAAG_TIJD,
};

// ============================================================
// SECTIE MANAGEMENT
// ============================================================
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function setStatus(text, className = 'status-naaminvoer') {
    const badge = document.getElementById('statusBadge');
    badge.textContent = text;
    badge.className = 'status-badge ' + className;
}

// ============================================================
// FIRESTORE LISTENER
// ============================================================
gameRef.onSnapshot((doc) => {
    if (!doc.exists) return;
    const data = doc.data();
    state.afvallers = data.afvallers || [];
    state.stemmen = data.stemmen || {};
    state.isEersteStemmer = data.isEersteStemmer !== false;
    state.stemBeurtIndex = data.stemBeurtIndex || 0;

    // Update UI op basis van status
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
        case 'uitslag':
            // Uitslag wordt lokaal getoond
            break;
        case 'einde':
            showWinnaar(data.winnaar);
            break;
        default:
            break;
    }
});

// ============================================================
// NAAM INVOER
// ============================================================
async function startSpel() {
    const input = document.getElementById('namenInput');
    const namen = input.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);

    if (namen.length < 4) {
        alert('Voer minimaal 4 namen in!');
        return;
    }

    // Reset Firestore document
    await gameRef.set({
        status: 'rolverdeling',
        namen: namen,
        rollen: {},
        acties: {},
        afvallers: [],
        stemmen: {},
        stemBeurtIndex: 0,
        isEersteStemmer: true,
        huidigeBeurt: '',
        winnaar: '',
        ronden: 0,
        config: {
            ondervraagTijd: CONFIG.ONDERVRAAG_TIJD,
            stemTijdEerste: CONFIG.STEM_TIJD_EERSTE,
            stemTijdVolgende: CONFIG.STEM_TIJD_VOLGENDE
        }
    });

    // Wijs rollen toe
    await assignRoles(namen);
}

async function assignRoles(namen) {
    // Schud namen
    const shuffled = [...namen];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const aantalHackers = Math.max(1, Math.floor(shuffled.length / 2));

    const rollen = {};
    const acties = {};
    let beschikbareHackerActies = [...HACKER_ACTIES];
    let beschikbareBurgerActies = [...BURGER_ACTIES];

    // Schud acties
    for (let i = beschikbareHackerActies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [beschikbareHackerActies[i], beschikbareHackerActies[j]] =
            [beschikbareHackerActies[j], beschikbareHackerActies[i]];
    }
    for (let i = beschikbareBurgerActies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [beschikbareBurgerActies[i], beschikbareBurgerActies[j]] =
            [beschikbareBurgerActies[j], beschikbareBurgerActies[i]];
    }

    let hackerIndex = 0;
    let burgerIndex = 0;

    shuffled.forEach((naam, index) => {
        if (index < aantalHackers) {
            rollen[naam] = 'hacker';
            acties[naam] = beschikbareHackerActies[hackerIndex % beschikbareHackerActies.length];
            hackerIndex++;
        } else {
            rollen[naam] = 'burger';
            acties[naam] = beschikbareBurgerActies[burgerIndex % beschikbareBurgerActies.length];
            burgerIndex++;
        }
    });

    await gameRef.update({
        namen: shuffled,
        rollen: rollen,
        acties: acties,
        huidigeBeurt: shuffled[0]
    });

    state.namen = shuffled;
    state.huidigeIndex = 0;
}

// ============================================================
// ROLVERDELING UI
// ============================================================
function updateRolverdelingUI(data) {
    const namen = data.namen || [];
    const huidigeBeurt = data.huidigeBeurt || '';
    const totaal = namen.length;
    const gedaan = namen.indexOf(huidigeBeurt);
    const statusText = document.getElementById('rolverdelingStatus');
    statusText.textContent = `Nog ${totaal - gedaan} van ${totaal} kinderen aan de beurt.`;

    const lijst = document.getElementById('rolverdelingLijst');
    lijst.innerHTML = namen.map((naam, i) => {
        const isGedaan = i < gedaan;
        return `<div class="speler-card ${isGedaan ? 'afvaller' : ''}">
            ${naam}
            ${isGedaan ? '<span style="color:#00c853;"> ✅</span>' : ''}
        </div>`;
    }).join('');

    const klaarBtn = document.getElementById('rolverdelingKlaarBtn');
    klaarBtn.disabled = gedaan < totaal - 1;
}

async function volgendeKind() {
    const data = (await gameRef.get()).data();
    const namen = data.namen || [];
    const huidigeBeurt = data.huidigeBeurt || '';
    const huidigeIndex = namen.indexOf(huidigeBeurt);
    if (huidigeIndex < namen.length - 1) {
        const volgende = namen[huidigeIndex + 1];
        await gameRef.update({ huidigeBeurt: volgende });
    } else {
        alert('Alle kinderen zijn geweest!');
    }
}

async function rolverdelingKlaar() {
    await gameRef.update({
        status: 'ondervraging',
        huidigeBeurt: ''
    });
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
    const namen = data.namen || [];
    const afvallers = data.afvallers || [];
    const overgebleven = namen.filter(n => !afvallers.includes(n));

    await gameRef.update({
        status: 'stemming',
        stemmen: {},
        stemBeurtIndex: 0,
        isEersteStemmer: true,
        huidigeBeurt: overgebleven[0]
    });
}

// ============================================================
// STEMRONDE UI
// ============================================================
function updateStemUI(data) {
    const namen = data.namen || [];
    const afvallers = data.afvallers || [];
    const overgebleven = namen.filter(n => !afvallers.includes(n));
    const huidigeBeurt = data.huidigeBeurt || '';
    const stemmen = data.stemmen || {};

    document.getElementById('stemStatus').textContent =
        huidigeBeurt ? `📱 ${huidigeBeurt} is aan de beurt om te stemmen` : 'Wacht op stemmen...';

    const lijst = document.getElementById('stemLijst');
    lijst.innerHTML = overgebleven.map(naam =>
        `<div class="speler-card ${afvallers.includes(naam) ? 'afvaller' : ''}">
            ${naam}
            ${afvallers.includes(naam) ? ' ❌' : ''}
        </div>`
    ).join('');

    // Tel aantal stemmen
    const totaalStemmen = Object.keys(stemmen).length;
    const nodig = overgebleven.length;

    // Update info
    document.getElementById('stemInfo').textContent =
        `Er zijn ${totaalStemmen} van ${nodig} stemmen uitgebracht.`;

    // Enable/disable "Toon uitslag"
    const toonUitslagBtn = document.getElementById('toonUitslagBtn');
    const alleGestemd = totaalStemmen >= nodig;
    toonUitslagBtn.disabled = !alleGestemd;

    // Debug log
    showDebug(`Stemmen: ${totaalStemmen}/${nodig}, knop ${alleGestemd ? 'enabled' : 'disabled'}`);
}

async function volgendeStemmer() {
    const data = (await gameRef.get()).data();
    const namen = data.namen || [];
    const afvallers = data.afvallers || [];
    const overgebleven = namen.filter(n => !afvallers.includes(n));
    const huidigeBeurt = data.huidigeBeurt || '';
    const huidigeIndex = overgebleven.indexOf(huidigeBeurt);

    if (huidigeIndex < overgebleven.length - 1) {
        const volgende = overgebleven[huidigeIndex + 1];
        await gameRef.update({
            huidigeBeurt: volgende,
            isEersteStemmer: false
        });
    } else {
        // Laatste speler was al aan de beurt; check of iedereen heeft gestemd
        const stemmen = data.stemmen || {};
        const totaalStemmen = Object.keys(stemmen).length;
        if (totaalStemmen >= overgebleven.length) {
            document.getElementById('toonUitslagBtn').disabled = false;
            document.getElementById('stemInfo').textContent = 'Alle stemmen zijn binnen! Klik op "Toon uitslag".';
        } else {
            alert('Alle spelers zijn aan de beurt geweest, maar nog niet iedereen heeft gestemd!');
        }
    }
}

// ============================================================
// UITSLAG
// ============================================================
async function toonUitslag() {
    const data = (await gameRef.get()).data();
    const stemmen = data.stemmen || {};
    const namen = data.namen || [];
    const afvallers = data.afvallers || [];

    // Tel stemmen
    const telling = {};
    Object.values(stemmen).forEach(target => {
        if (!afvallers.includes(target)) {
            telling[target] = (telling[target] || 0) + 1;
        }
    });

    let maxStemmen = 0;
    let winnaars = [];
    for (const [naam, aantal] of Object.entries(telling)) {
        if (aantal > maxStemmen) {
            maxStemmen = aantal;
            winnaars = [naam];
        } else if (aantal === maxStemmen) {
            winnaars.push(naam);
        }
    }

    showSection('sectionUitslag');
    setStatus('📊 Uitslag', 'status-uitslag');

    const content = document.getElementById('uitslagContent');
    let html = '<div style="margin-bottom:20px;">';
    for (const [naam, aantal] of Object.entries(telling)) {
        const max = Math.max(1, maxStemmen);
        const percentage = (aantal / max) * 100;
        html += `
            <div class="stem-resultaat">
                <div>
                    <span class="naam">${naam}</span>
                    <span class="aantal">${aantal} stem${aantal !== 1 ? 'men' : ''}</span>
                </div>
                <div class="stem-balk">
                    <div class="vulling" style="width:${percentage}%;"></div>
                </div>
            </div>
        `;
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

    const updateData = {
        afvallers: nieuweAfvallers,
        stemmen: {},
        stemBeurtIndex: 0,
        isEersteStemmer: true,
        huidigeBeurt: '',
        ronden: (data.ronden || 0) + 1
    };

    if (winnaar) {
        updateData.winnaar = winnaar;
        updateData.status = 'einde';
    } else {
        updateData.status = 'ondervraging';
    }

    await gameRef.update(updateData);

    // Toon onthulling
    const content = document.getElementById('uitslagContent');
    const rol = rollen[naam] === 'hacker' ? '🔴 HACKER' : '🟢 BURGER';
    const kleur = rollen[naam] === 'hacker' ? '#ff1744' : '#00c853';

    content.innerHTML = `
        <div style="text-align:center; padding:30px 0;">
            <h2 style="color:${kleur}; font-size:3rem;">${naam} was een ${rol}!</h2>
            <p style="color:#8899bb; font-size:1.2rem;">Deze speler is nu afgevallen en mag niet meer meestemmen.</p>
            <br>
            <button class="btn btn-primary" onclick="gaNaarVolgendeRonde()">⏭️ Ga naar volgende ronde</button>
        </div>
    `;
}

// ============================================================
// VOLGENDE RONDE
// ============================================================
async function gaNaarVolgendeRonde() {
    const data = (await gameRef.get()).data();
    if (data.winnaar) {
        showWinnaar(data.winnaar);
        return;
    }
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
    if (confirm('Weet je zeker dat je het spel wilt resetten?')) {
        await gameRef.set({
            status: 'naaminvoer',
            namen: [],
            rollen: {},
            acties: {},
            afvallers: [],
            stemmen: {},
            stemBeurtIndex: 0,
            isEersteStemmer: true,
            huidigeBeurt: '',
            winnaar: '',
            ronden: 0,
            config: {
                ondervraagTijd: CONFIG.ONDERVRAAG_TIJD,
                stemTijdEerste: CONFIG.STEM_TIJD_EERSTE,
                stemTijdVolgende: CONFIG.STEM_TIJD_VOLGENDE
            }
        });
        state = {
            namen: [],
            huidigeIndex: 0,
            stemBeurtIndex: 0,
            isEersteStemmer: true,
            afvallers: [],
            overgebleven: [],
            stemmen: {},
            timerInterval: null,
            ondervraagTijd: CONFIG.ONDERVRAAG_TIJD,
        };
        document.getElementById('namenInput').value = '';
        showSection('sectionNaamInvoer');
        setStatus('📋 Naam invoer', 'status-naaminvoer');
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }
}

// ============================================================
// DEBUG
// ============================================================
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
    if (el.classList.contains('visible')) {
        el.textContent = '🐞 Debug log:\n';
    }
}

console.log('🔐 Hackers versus Burgers - Digibord geladen!');
