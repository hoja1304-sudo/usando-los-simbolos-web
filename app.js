const FAMILY_FALLBACK = { min: 100, max: 999, label: "100 a 999" };

const state = {
  family: FAMILY_FALLBACK,
  rows: [],
  score: 0,
  correct: 0,
  attempts: 0,
  audio: true,
  dark: false,
  voice: null
};

const SYMBOLS = [
  { key: "gt", value: ">", label: "&gt;" },
  { key: "eq", value: "=", label: "=" },
  { key: "lt", value: "<", label: "&lt;" }
];

const els = {
  menuScreen: document.querySelector("#menuScreen"),
  playScreen: document.querySelector("#playScreen"),
  rounds: document.querySelector("#rounds"),
  familyLabel: document.querySelector("#familyLabel"),
  scoreLabel: document.querySelector("#scoreLabel"),
  feedback: document.querySelector("#feedback"),
  feedbackIcon: document.querySelector("#feedbackIcon"),
  feedbackText: document.querySelector("#feedbackText"),
  audioButtons: [document.querySelector("#audioButtonMenu"), document.querySelector("#audioButtonPlay")],
  themeButtons: [document.querySelector("#themeButtonMenu"), document.querySelector("#themeButtonPlay")]
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function symbolFor(left, right) {
  if (left > right) return ">";
  if (left < right) return "<";
  return "=";
}

function makePair() {
  const shouldEqual = Math.random() < 0.28;
  const left = randomInt(state.family.min, state.family.max);
  let right = shouldEqual ? left : randomInt(state.family.min, state.family.max);

  while (!shouldEqual && right === left) {
    right = randomInt(state.family.min, state.family.max);
  }

  return {
    left,
    right,
    answer: symbolFor(left, right),
    selected: null,
    locked: false
  };
}

function selectFamily(button) {
  const min = Number(button.dataset.min);
  const max = Number(button.dataset.max);
  state.family = { min, max, label: `${min} a ${max}` };
  state.score = 0;
  state.correct = 0;
  state.attempts = 0;
  showScreen("play");
  newRound();
  speak(`Familia de ${min} a ${max}. Compara los numeros con mayor que, igual que o menor que.`);
}

function showScreen(name) {
  const play = name === "play";
  els.menuScreen.classList.toggle("is-active", !play);
  els.playScreen.classList.toggle("is-active", play);
}

function newRound() {
  state.rows = [makePair(), makePair(), makePair()];
  renderRound();
  updateStatus();
  setFeedback("Selecciona el simbolo correcto en cada fila.", null);
}

function renderRound() {
  els.rounds.innerHTML = "";
  state.rows.forEach((row, index) => {
    const item = document.createElement("article");
    item.className = "round-row";
    const symbolButtons = SYMBOLS.map((symbol) => {
      return `<button class="symbol-choice" type="button" data-row="${index}" data-symbol="${symbol.key}">${symbol.label}</button>`;
    }).join("");
    item.innerHTML = `
      <div class="number">${row.left}</div>
      <div class="answer-box" id="answer-${index}">${row.selected || ""}</div>
      <div class="number">${row.right}</div>
      <div class="symbol-buttons" aria-label="Simbolos para la fila ${index + 1}">
        ${symbolButtons}
      </div>
    `;
    els.rounds.appendChild(item);
  });

  document.querySelectorAll(".symbol-choice").forEach((button) => {
    const symbol = SYMBOLS.find((item) => item.key === button.dataset.symbol)?.value;
    button.addEventListener("click", () => chooseSymbol(Number(button.dataset.row), symbol));
  });
}

function chooseSymbol(rowIndex, symbol) {
  const row = state.rows[rowIndex];
  if (!row || row.locked) return;

  row.selected = symbol;
  row.locked = true;
  state.attempts += 1;

  const answerBox = document.querySelector(`#answer-${rowIndex}`);
  const rowButtons = [...document.querySelectorAll(`.symbol-choice[data-row="${rowIndex}"]`)];
  const selectedKey = SYMBOLS.find((item) => item.value === symbol).key;
  const answerKey = SYMBOLS.find((item) => item.value === row.answer).key;
  const selectedButton = rowButtons.find((button) => button.dataset.symbol === selectedKey);
  const correctButton = rowButtons.find((button) => button.dataset.symbol === answerKey);
  const isCorrect = symbol === row.answer;

  answerBox.textContent = symbol;
  rowButtons.forEach((button) => {
    button.disabled = true;
  });

  if (isCorrect) {
    state.correct += 1;
    state.score += 10;
    selectedButton.classList.add("is-correct");
    setFeedback("Correcto.", "./assets/check.png");
    var spokenFeedback = speak("Correcto.");
  } else {
    selectedButton.classList.add("is-wrong");
    correctButton.classList.add("is-correct");
    const correction = `La respuesta correcta es ${row.answer}, ${symbolName(row.answer)}.`;
    setFeedback(correction, "./assets/equis.png");
    var spokenFeedback = speak(correction);
  }

  updateStatus();

  if (state.rows.every((item) => item.locked)) {
    spokenFeedback.then(() => {
      setFeedback("Ronda terminada. Presiona Reiniciar para otros valores.", null);
      speak("Ronda terminada. Toca el boton reiniciar para otros valores.", { cancel: false });
    });
  }
}

function updateStatus() {
  els.familyLabel.textContent = `Familia: ${state.family.label}`;
  els.scoreLabel.textContent = `Puntos: ${state.score}`;
}

function setFeedback(text, icon) {
  els.feedbackText.textContent = text;
  els.feedback.classList.toggle("has-icon", Boolean(icon));
  if (icon) {
    els.feedbackIcon.src = icon;
  } else {
    els.feedbackIcon.removeAttribute("src");
  }
}

function symbolName(symbol) {
  if (symbol === ">") return "mayor que";
  if (symbol === "<") return "menor que";
  return "igual que";
}

function chooseSpanishVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const neutralTags = ["es-US", "es-MX", "es-419", "es-CR", "es-CO", "es-PE", "es"];
  const byTag = voices.find((voice) => neutralTags.some((tag) => voice.lang.toLowerCase() === tag.toLowerCase()));
  if (byTag) return byTag;
  return voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) || null;
}

function loadVoices() {
  state.voice = chooseSpanishVoice();
}

function speak(text, options = {}) {
  const shouldCancel = options.cancel !== false;
  if (!state.audio || !("speechSynthesis" in window)) return Promise.resolve();
  if (!state.voice) loadVoices();
  if (shouldCancel) window.speechSynthesis.cancel();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.voice?.lang || "es-US";
    utterance.rate = 0.88;
    utterance.pitch = 1;
    if (state.voice) utterance.voice = state.voice;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
}

function toggleAudio() {
  state.audio = !state.audio;
  if (!state.audio && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  syncUtilityButtons();
  if (state.audio) speak("Audio activo.");
}

function toggleTheme() {
  state.dark = !state.dark;
  document.body.classList.toggle("theme-dark", state.dark);
  syncUtilityButtons();
}

function syncUtilityButtons() {
  els.audioButtons.forEach((button) => {
    const label = state.audio ? "Audio activo" : "Audio apagado";
    button.innerHTML = `<span aria-hidden="true">${state.audio ? "&#9834;" : "&times;"}</span> ${label}`;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(state.audio));
  });
  els.themeButtons.forEach((button) => {
    const label = state.dark ? "Claro" : "Claro oscuro";
    button.innerHTML = `<span aria-hidden="true">${state.dark ? "&#9728;" : "&#9680;"}</span> ${label}`;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(state.dark));
  });
}

document.querySelectorAll(".family-button").forEach((button) => {
  button.addEventListener("click", () => selectFamily(button));
});

document.querySelector("#resetButton").addEventListener("click", () => {
  newRound();
  speak("Nueva ronda.");
});

document.querySelector("#menuButton").addEventListener("click", () => {
  showScreen("menu");
  setFeedback("Selecciona el simbolo correcto en cada fila.", null);
});

document.querySelector("#exitButton").addEventListener("click", () => {
  window.close();
  if (!window.closed) showScreen("menu");
});

els.audioButtons.forEach((button) => button.addEventListener("click", toggleAudio));
els.themeButtons.forEach((button) => button.addEventListener("click", toggleTheme));

if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

syncUtilityButtons();
