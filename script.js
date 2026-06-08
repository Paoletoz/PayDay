// ================================================================
// CONFIGURAZIONE FIREBASE
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
  maxRounds: 0,
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
      maxRounds: 0,
      host: playerId,
      players: {
        [playerId]: { name, round: 1, finalScore: null }
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
      showError('joinError', "Questa partita e' gia' terminata.");
      return;
    }

    const playerId = generatePlayerId();
    state.playerId = playerId;
    state.playerName = name;
    state.lobbyCode = code;
    state.isHost = false;

    await db.ref(`lobbies/${code}/players/${playerId}`).set({ name, round: 1, finalScore: null });

    if (data.status === 'playing') {
      enterGame();
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
    document.getElementById('maxRoundsSetup').classList.remove('d-none');
  } else {
    document.getElementById('hostControls').classList.add('d-none');
    document.getElementById('guestWaiting').classList.remove('d-none');
    document.getElementById('maxRoundsSetup').classList.add('d-none');
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
      enterGame();
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
  const maxRounds = parseInt(document.getElementById('maxRoundsInput').value) || 0;
  await db.ref(`lobbies/${state.lobbyCode}`).update({ status: 'playing', maxRounds });
});

// ================================================================
// GIOCO — schermata principale
// ================================================================
function enterGame() {
  clearListener();
  state.round = 1;
  state.maxRounds = 0;
  document.getElementById('roundDisplay').textContent = 1;
  document.getElementById('wrapper').innerHTML = '';
  document.getElementById('playerTag').textContent = `Giocatore: ${state.playerName}`;
  document.getElementById('maxRoundsLabel').textContent = '';
  document.getElementById('playersRoundsPanel').classList.add('d-none');

  if (state.isHost) {
    document.getElementById('endGameSection').classList.remove('d-none');
    document.getElementById('waitingEndGame').classList.add('d-none');
    document.getElementById('maxRoundsGameControl').classList.remove('d-none');
  } else {
    document.getElementById('endGameSection').classList.add('d-none');
    document.getElementById('waitingEndGame').classList.remove('d-none');
    document.getElementById('maxRoundsGameControl').classList.add('d-none');
  }

  showScreen('screen-game');

  const lobbyRef = db.ref(`lobbies/${state.lobbyCode}`);
  const onGameChange = (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();
    const players = data.players || {};
    const maxRounds = data.maxRounds || 0;
    state.maxRounds = maxRounds;

    // Sincronizza il campo giri max (host) con il valore Firebase
    if (state.isHost) {
      const input = document.getElementById('maxRoundsGameInput');
      if (document.activeElement !== input) {
        input.value = maxRounds;
      }
    }

    // Aggiorna il giro del giocatore corrente
    const myData = players[state.playerId];
    if (myData) {
      const myRound = myData.round || 1;
      if (myRound !== state.round) {
        state.round = myRound;
        document.getElementById('roundDisplay').textContent = myRound;
      }
      // Mostra etichetta giro massimo
      const label = document.getElementById('maxRoundsLabel');
      if (maxRounds > 0) {
        label.textContent = `di ${maxRounds}`;
        label.className = myRound >= maxRounds ? 'small text-danger fw-bold' : 'small text-muted';
      } else {
        label.textContent = '';
      }
    }

    // Aggiorna pannello giri di tutti
    updatePlayersRoundsPanel(players, maxRounds);

    // Aggiorna stato pulsante Fine Partita (solo host)
    if (state.isHost) {
      updateEndGameButton(players, maxRounds);

      // Auto-fine quando tutti hanno raggiunto il giro massimo
      if (maxRounds > 0) {
        const allAtMax = Object.values(players).every(p => (p.round || 1) >= maxRounds);
        if (allAtMax) {
          db.ref(`lobbies/${state.lobbyCode}`).update({ status: 'ended' });
          return;
        }
      }
    }

    if (data.status === 'ended') {
      clearListener();
      enterFinalInput();
    }
  };

  setListener(lobbyRef, onGameChange);
}

function updatePlayersRoundsPanel(players, maxRounds) {
  const panel = document.getElementById('playersRoundsPanel');
  const list = document.getElementById('playersRoundsList');
  const entries = Object.entries(players);

  if (entries.length <= 1) {
    panel.classList.add('d-none');
    return;
  }

  panel.classList.remove('d-none');
  const maxRound = Math.max(...entries.map(([, p]) => p.round || 1));

  entries.sort((a, b) => (b[1].round || 1) - (a[1].round || 1));

  list.innerHTML = '';
  entries.forEach(([id, p]) => {
    const round = p.round || 1;
    const diff = maxRound - round;
    const isMe = id === state.playerId;
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center py-1';

    let badge;
    if (maxRounds > 0 && round >= maxRounds) {
      badge = `<span class="badge bg-danger">Giro ${round} — al limite</span>`;
    } else if (diff === 0) {
      badge = `<span class="badge bg-success">Giro ${round}</span>`;
    } else {
      badge = `<span class="badge bg-warning text-dark">Giro ${round} &mdash; indietro di ${diff}</span>`;
    }

    li.innerHTML = `<span>${isMe ? `<strong>${p.name} (tu)</strong>` : p.name}</span>${badge}`;
    list.appendChild(li);
  });
}

function updateEndGameButton(players, maxRounds) {
  const btn = document.getElementById('btnEndGame');
  const statusEl = document.getElementById('endGameStatus');
  const entries = Object.entries(players);
  const rounds = entries.map(([, p]) => p.round || 1);
  const allSame = rounds.every(r => r === rounds[0]);

  if (allSame) {
    btn.disabled = false;
    btn.className = 'btn btn-danger w-100';
    if (maxRounds > 0 && rounds[0] >= maxRounds) {
      statusEl.textContent = 'Tutti hanno raggiunto il giro massimo!';
      statusEl.className = 'small text-center mt-2 text-danger fw-bold';
    } else {
      statusEl.textContent = 'Tutti sono allo stesso giro';
      statusEl.className = 'small text-center mt-2 text-success';
    }
  } else {
    btn.disabled = true;
    btn.className = 'btn btn-outline-danger w-100';
    const maxRound = Math.max(...rounds);
    const behind = entries
      .filter(([, p]) => (p.round || 1) < maxRound)
      .map(([, p]) => {
        const diff = maxRound - (p.round || 1);
        return `${p.name}: manca${diff > 1 ? 'no' : ''} ${diff} giro${diff > 1 ? 'i' : ''}`;
      });
    statusEl.innerHTML = behind.join('<br>');
    statusEl.className = 'small text-center mt-2 text-warning';
  }
}

document.getElementById('btnUpdateMaxRounds').addEventListener('click', async () => {
  if (!state.isHost) return;
  const newMax = parseInt(document.getElementById('maxRoundsGameInput').value) || 0;
  await db.ref(`lobbies/${state.lobbyCode}/maxRounds`).set(newMax);
});

document.getElementById('btnRoundPlus').addEventListener('click', async () => {
  const newRound = state.round + 1;
  if (state.maxRounds > 0 && newRound > state.maxRounds) return;
  await db.ref(`lobbies/${state.lobbyCode}/players/${state.playerId}/round`).set(newRound);
});

document.getElementById('btnRoundMinus').addEventListener('click', async () => {
  if (state.round <= 1) return;
  await db.ref(`lobbies/${state.lobbyCode}/players/${state.playerId}/round`).set(state.round - 1);
});

document.getElementById('btni').addEventListener('click', async () => {
  const numVal = Number(document.getElementById('num').value) || 0;
  const posteVal = Number(document.getElementById('poste').value) || 0;

  const interest = numVal > 50 ? getInterest(numVal) : 0;
  const total = (interest + 1500) - posteVal;
  const currentRound = state.round;

  document.getElementById('wrapper').innerHTML = `
    <div class="container mt-3">
      <div class="row">
        <div class="col-12 mb-2">
          <p>La banca ti deve ${interest > 0 ? '<strong>' + interest + '€</strong> di interessi e ' : ''}<strong>1500€</strong> di stipendio${posteVal > 0 ? ' e devi pagare <strong>' + posteVal + '€</strong> di poste' : ''}</p>
        </div>
        <div class="col-12">
          <p class="bg-total p-2 rounded mb-2">Totale: <strong>${total}€</strong></p>
          ${posteVal > 0 ? `<p class="bg-tax p-2 rounded mb-2">Totale poste: ${posteVal}€</p>` : ''}
          <p class="bg-round p-2 rounded mb-2">Giro: ${currentRound}</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('num').value = '';
  document.getElementById('poste').value = '';

  // Auto-incrementa il giro ad ogni calcolo
  if (state.lobbyCode && state.playerId) {
    const newRound = state.maxRounds > 0
      ? Math.min(currentRound + 1, state.maxRounds)
      : currentRound + 1;
    if (newRound > currentRound) {
      await db.ref(`lobbies/${state.lobbyCode}/players/${state.playerId}/round`).set(newRound);
    }
  }
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
          ${hasScore ? '&#10003; ' + p.finalScore + '€' : 'in attesa...'}
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
// CLASSIFICA FINALE PARTITA
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

  // L'host registra la vittoria del primo classificato
  if (state.isHost && sorted.length > 0) {
    const winner = sorted[0];
    const key = winner.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'player';
    db.ref(`leaderboard/${key}`).transaction(current => {
      if (!current) return { name: winner.name, wins: 1 };
      return { name: current.name, wins: (current.wins || 0) + 1 };
    });
  }

  showScreen('screen-ranking');
}

document.getElementById('btnGoLeaderboard').addEventListener('click', () => showLeaderboard());

// ================================================================
// CLASSIFICA GENERALE (vittorie totali)
// ================================================================
async function showLeaderboard() {
  showScreen('screen-leaderboard');
  const list = document.getElementById('leaderboardList');
  list.innerHTML = '<p class="text-muted text-center">Caricamento...</p>';

  const snapshot = await db.ref('leaderboard').once('value');
  const entries = [];
  snapshot.forEach(child => entries.push(child.val()));
  entries.sort((a, b) => b.wins - a.wins);

  if (entries.length === 0) {
    list.innerHTML = '<p class="text-muted text-center">Nessuna partita ancora completata.</p>';
    return;
  }

  const classes = ['ranking-first', 'ranking-second', 'ranking-third', 'ranking-other'];
  const positions = ['1°', '2°', '3°'];
  list.innerHTML = '';
  entries.forEach((entry, i) => {
    const div = document.createElement('div');
    div.className = `ranking-item p-3 mb-2 rounded ${classes[Math.min(i, 3)]}`;
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <span class="fw-bold fs-5 me-2">${positions[i] || (i + 1) + '°'}</span>
          <span class="fs-5">${entry.name}</span>
        </div>
        <div class="fs-5 fw-bold">${entry.wins} vittori${entry.wins === 1 ? 'a' : 'e'}</div>
      </div>
    `;
    list.appendChild(div);
  });
}

document.getElementById('btnShowLeaderboard').addEventListener('click', () => showLeaderboard());
document.getElementById('btnBackLeaderboard').addEventListener('click', () => showScreen('screen-home'));

document.getElementById('btnNewGame').addEventListener('click', () => {
  clearListener();

  state = { playerId: null, playerName: null, lobbyCode: null, isHost: false, round: 1, maxRounds: 0 };

  document.getElementById('hostName').value = '';
  document.getElementById('joinName').value = '';
  document.getElementById('joinCode').value = '';
  document.getElementById('maxRoundsInput').value = '0';
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
