// ================================================================
// CONFIGURAZIONE FIREBASE — DA COMPLETARE PRIMA DI USARE
// ================================================================
//
// Come creare il progetto Firebase (gratis, 5 minuti):
//
// 1. Vai su https://console.firebase.google.com
//    → Clicca "Aggiungi progetto" → dai un nome (es. "giorno-di-paga")
//    → Disabilita Google Analytics se vuoi → Crea progetto
//
// 2. Nel menu a sinistra: "Build" → "Realtime Database"
//    → Clicca "Crea database"
//    → Scegli la posizione europea (europe-west1)
//    → Seleziona "Modalita' test" (regole aperte per 30 giorni)
//    → Clicca "Abilita"
//
// 3. Torna alla home del progetto (icona ingranaggio ⚙️ → "Impostazioni progetto")
//    → Scheda "Generale" → scorri fino a "Le tue app"
//    → Clicca sull'icona </> (Web)
//    → Dai un nickname all'app → "Registra app"
//    → Copia i valori di firebaseConfig qui sotto
//
// ================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDk0TAy1tpgxPja7AMGAgZbjuT5H-Y86kg",
    authDomain: "payday-c76ba.firebaseapp.com",
    databaseURL: "https://payday-c76ba-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "payday-c76ba",
    storageBucket: "payday-c76ba.firebasestorage.app",
    messagingSenderId: "925869451001",
    appId: "1:925869451001:web:ef9b94021ceb7636476428"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ================================================================
// STATO
// ================================================================
let state = {
  playerId: null,
  playerName: null,
  lobbyCode: null,
  isHost: false,
  round: 1,
};

let activeListener = null;
let activeListenerRef = null;

function clearListener() {
  if (activeListener && activeListenerRef) {
    activeListenerRef.off('value', activeListener);
    activeListener = null;
    activeListenerRef = null;
  }
}

function setListener(ref, callback) {
  clearListener();
  activeListenerRef = ref;
  activeListener = callback;
  ref.on('value', callback);
}

// ================================================================
// UTILITIES
// ================================================================
function generateCode() {
  // Caratteri senza ambiguità visiva (no O/0, I/1, ecc.)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePlayerId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('d-none'));
  document.getElementById(id).classList.remove('d-none');
  window.scrollTo(0, 0);
}

function getInterest(number) {
  const n = Number(number);
  if (n <= 50) return 0;
  const index = Math.ceil((n - 100) / 500);
  return 50 + (index * 50);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('d-none');
  setTimeout(() => el.classList.add('d-none'), 5000);
}

// ================================================================
// HOME — schermata iniziale
// ================================================================

// Se nell'URL c'è un hash con il codice lobby, pre-compila il form
window.addEventListener('load', () => {
  const hash = window.location.hash.slice(1).toUpperCase();
  if (hash.length === 6) {
    document.getElementById('joinCode').value = hash;
    document.getElementById('joinForm').classList.remove('d-none');
  }
});

document.getElementById('btnShowCreate').addEventListener('click', () => {
  document.getElementById('createForm').classList.remove('d-none');
  document.getElementById('joinForm').classList.add('d-none');
});

document.getElementById('btnShowJoin').addEventListener('click', () => {
  document.getElementById('joinForm').classList.remove('d-none');
  document.getElementById('createForm').classList.add('d-none');
});

document.getElementById('joinCode').addEventListener('input', function () {
  this.value = this.value.toUpperCase();
});

document.getElementById('btnCreate').addEventListener('click', async () => {
  const name = document.getElementById('hostName').value.trim();
  if (!name) { showError('createError', 'Inserisci il tuo nome'); return; }

  const code = generateCode();
  const playerId = generatePlayerId();

  state.playerId = playerId;
  state.playerName = name;
  state.lobbyCode = code;
  state.isHost = true;

  try {
    await db.ref(`lobbies/${code}`).set({
      status: 'waiting',
      round: 1,
      host: playerId,
      players: {
        [playerId]: { name, finalScore: null }
      }
    });
    window.location.hash = code;
    enterLobby();
  } catch (e) {
    showError('createError', 'Errore di connessione. Controlla la configurazione Firebase.');
  }
});

document.getElementById('btnJoin').addEventListener('click', async () => {
  const name = document.getElementById('joinName').value.trim();
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!name) { showError('joinError', 'Inserisci il tuo nome'); return; }
  if (code.length !== 6) { showError('joinError', 'Il codice deve essere di 6 caratteri'); return; }

  try {
    const snapshot = await db.ref(`lobbies/${code}`).once('value');
    if (!snapshot.exists()) {
      showError('joinError', 'Lobby non trovata. Controlla il codice.');
      return;
    }
    const data = snapshot.val();
    if (data.status === 'ended') {
      showError('joinError', 'Questa partita e\' gia\' terminata.');
      return;
    }

    const playerId = generatePlayerId();
    state.playerId = playerId;
    state.playerName = name;
    state.lobbyCode = code;
    state.isHost = false;

    await db.ref(`lobbies/${code}/players/${playerId}`).set({ name, finalScore: null });

    if (data.status === 'playing') {
      enterGame(data.round || 1);
    } else {
      enterLobby();
    }
  } catch (e) {
    showError('joinError', 'Errore di connessione. Controlla la configurazione Firebase.');
  }
});

// ================================================================
// LOBBY — sala d'attesa
// ================================================================
function enterLobby() {
  document.getElementById('lobbyCodeDisplay').textContent = state.lobbyCode;

  if (state.isHost) {
    document.getElementById('hostControls').classList.remove('d-none');
    document.getElementById('guestWaiting').classList.add('d-none');
  } else {
    document.getElementById('hostControls').classList.add('d-none');
    document.getElementById('guestWaiting').classList.remove('d-none');
  }

  showScreen('screen-lobby');

  const lobbyRef = db.ref(`lobbies/${state.lobbyCode}`);
  const onLobbyChange = (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();

    const players = data.players || {};
    const listEl = document.getElementById('playerListLobby');
    listEl.innerHTML = '';
    Object.entries(players).forEach(([id, p]) => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.textContent = p.name;
      if (id === data.host) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary';
        badge.textContent = 'Host';
        li.appendChild(badge);
      }
      listEl.appendChild(li);
    });
    document.getElementById('playerCount').textContent = Object.keys(players).length;

    if (data.status === 'playing') {
      clearListener();
      enterGame(data.round || 1);
    }
  };

  setListener(lobbyRef, onLobbyChange);
}

document.getElementById('btnCopyCode').addEventListener('click', () => {
  navigator.clipboard.writeText(state.lobbyCode).then(() => {
    const btn = document.getElementById('btnCopyCode');
    const orig = btn.textContent;
    btn.textContent = 'Copiato!';
    btn.classList.add('btn-success');
    btn.classList.remove('btn-outline-secondary');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('btn-success');
      btn.classList.add('btn-outline-secondary');
    }, 2000);
  });
});

document.getElementById('btnShareLink').addEventListener('click', () => {
  const url = `${location.origin}${location.pathname}#${state.lobbyCode}`;
  if (navigator.share) {
    navigator.share({ title: 'Giorno di Paga', text: 'Unisciti alla mia lobby!', url });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('btnShareLink');
      const orig = btn.textContent;
      btn.textContent = 'Link copiato!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  }
});

document.getElementById('btnStartGame').addEventListener('click', async () => {
  if (!state.isHost) return;
  await db.ref(`lobbies/${state.lobbyCode}`).update({ status: 'playing', round: 1 });
});

// ================================================================
// GIOCO — schermata principale
// ================================================================
function enterGame(initialRound) {
  clearListener();
  state.round = initialRound;
  document.getElementById('roundDisplay').textContent = state.round;
  document.getElementById('wrapper').innerHTML = '';
  document.getElementById('playerTag').textContent = `Giocatore: ${state.playerName}`;

  if (state.isHost) {
    document.getElementById('endGameSection').classList.remove('d-none');
    document.getElementById('waitingEndGame').classList.add('d-none');
  } else {
    document.getElementById('endGameSection').classList.add('d-none');
    document.getElementById('waitingEndGame').classList.remove('d-none');
  }

  showScreen('screen-game');

  const lobbyRef = db.ref(`lobbies/${state.lobbyCode}`);
  const onGameChange = (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();

    if (data.round !== state.round) {
      state.round = data.round;
      document.getElementById('roundDisplay').textContent = state.round;
    }

    if (data.status === 'ended') {
      clearListener();
      enterFinalInput();
    }
  };

  setListener(lobbyRef, onGameChange);
}

document.getElementById('btnRoundPlus').addEventListener('click', async () => {
  await db.ref(`lobbies/${state.lobbyCode}/round`).set(state.round + 1);
});

document.getElementById('btnRoundMinus').addEventListener('click', async () => {
  if (state.round <= 1) return;
  await db.ref(`lobbies/${state.lobbyCode}/round`).set(state.round - 1);
});

document.getElementById('btni').addEventListener('click', () => {
  const numVal = Number(document.getElementById('num').value) || 0;
  const posteVal = Number(document.getElementById('poste').value) || 0;

  const interest = numVal > 50 ? getInterest(numVal) : 0;
  const total = (interest + 1500) - posteVal;

  document.getElementById('wrapper').innerHTML = `
    <div class="container mt-3">
      <div class="row">
        <div class="col-12 mb-2">
          <p>La banca ti deve ${interest > 0 ? '<strong>' + interest + '€</strong> di interessi e ' : ''}<strong>1500€</strong> di stipendio${posteVal > 0 ? ' e devi pagare <strong>' + posteVal + '€</strong> di poste' : ''}</p>
        </div>
        <div class="col-12">
          <p class="bg-total p-2 rounded mb-2">Totale: <strong>${total}€</strong></p>
          ${posteVal > 0 ? `<p class="bg-tax p-2 rounded mb-2">Totale poste: ${posteVal}€</p>` : ''}
          <p class="bg-round p-2 rounded mb-2">Giro: ${state.round}</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('num').value = '';
  document.getElementById('poste').value = '';
});

document.getElementById('btnEndGame').addEventListener('click', async () => {
  if (!state.isHost) return;
  if (!confirm('Sei sicuro di voler terminare la partita?')) return;
  await db.ref(`lobbies/${state.lobbyCode}`).update({ status: 'ended' });
});

// ================================================================
// PUNTEGGIO FINALE
// ================================================================
function enterFinalInput() {
  clearListener();
  document.getElementById('finalInputSection').classList.remove('d-none');
  document.getElementById('waitingOthers').classList.add('d-none');
  document.getElementById('finalScore').value = '';

  showScreen('screen-final');

  const lobbyRef = db.ref(`lobbies/${state.lobbyCode}`);
  const onFinalChange = (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();
    const players = data.players || {};
    const allPlayers = Object.values(players);
    const submitted = allPlayers.filter(p => p.finalScore !== null && p.finalScore !== undefined);

    const waitList = document.getElementById('finalWaitList');
    waitList.innerHTML = '';
    allPlayers.forEach(p => {
      const hasScore = p.finalScore !== null && p.finalScore !== undefined;
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `
        <span>${p.name}</span>
        <span class="${hasScore ? 'text-success' : 'text-muted'}">
          ${hasScore ? '✓ ' + p.finalScore + '€' : 'in attesa...'}
        </span>
      `;
      waitList.appendChild(li);
    });

    if (submitted.length === allPlayers.length && allPlayers.length > 0) {
      clearListener();
      showRanking(players);
    }
  };

  setListener(lobbyRef, onFinalChange);
}

document.getElementById('btnSubmitFinal').addEventListener('click', async () => {
  const score = document.getElementById('finalScore').value;
  if (score === '' || score === null) {
    alert('Inserisci il totale dei tuoi soldi');
    return;
  }
  await db.ref(`lobbies/${state.lobbyCode}/players/${state.playerId}/finalScore`).set(Number(score));
  document.getElementById('finalInputSection').classList.add('d-none');
  document.getElementById('waitingOthers').classList.remove('d-none');
});

// ================================================================
// CLASSIFICA FINALE
// ================================================================
function showRanking(players) {
  const sorted = Object.values(players).sort((a, b) => b.finalScore - a.finalScore);

  const rankingList = document.getElementById('rankingList');
  rankingList.innerHTML = '';

  sorted.forEach((player, i) => {
    const positions = ['1°', '2°', '3°'];
    const classes = ['ranking-first', 'ranking-second', 'ranking-third', 'ranking-other'];
    const div = document.createElement('div');
    div.className = `ranking-item p-3 mb-2 rounded ${classes[Math.min(i, 3)]}`;
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <span class="fw-bold fs-5 me-2">${positions[i] || (i + 1) + '°'}</span>
          <span class="fs-5">${player.name}</span>
          ${player.name === state.playerName ? '<span class="badge bg-secondary ms-2">Tu</span>' : ''}
        </div>
        <div class="fs-4 fw-bold">${player.finalScore.toLocaleString('it-IT')}€</div>
      </div>
    `;
    rankingList.appendChild(div);
  });

  showScreen('screen-ranking');
}

document.getElementById('btnNewGame').addEventListener('click', () => {
  clearListener();

  state = { playerId: null, playerName: null, lobbyCode: null, isHost: false, round: 1 };

  document.getElementById('hostName').value = '';
  document.getElementById('joinName').value = '';
  document.getElementById('joinCode').value = '';
  document.getElementById('createForm').classList.add('d-none');
  document.getElementById('joinForm').classList.add('d-none');
  document.getElementById('wrapper').innerHTML = '';
  document.getElementById('num').value = '';
  document.getElementById('poste').value = '';
  document.getElementById('finalScore').value = '';
  document.getElementById('finalInputSection').classList.remove('d-none');
  document.getElementById('waitingOthers').classList.add('d-none');

  window.location.hash = '';
  showScreen('screen-home');
});
