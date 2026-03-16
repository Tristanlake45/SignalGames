// app.js
(() => {
  const WORD_LENGTH = 5;
  const MAX_GUESSES = 6;

  const helpBtn = document.getElementById("helpBtn");
  const helpModal = document.getElementById("helpModal");
  const closeHelpBtn = document.getElementById("closeHelpBtn");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const helpTile0 = document.getElementById("helpTile0");
  const helpTile1 = document.getElementById("helpTile1");
  const helpTile2 = document.getElementById("helpTile2");

  // Vern Eide themed ANSWERS (solutions come from here only)
  const VERN_EIDE_WORDS_RAW = [
    "ACURA","ALIGN","APRON","AXIAL","BADGE","BELTS","BENCH","BOOST","BRAKE","BRAND",
    "BUYER","CABLE","CABIN","CATCH","CHAIN","CHART","CHECK","CIVIC","CLAMP","CLEAN",
    "CLEAR","COAST","COUPE","CRANK","CROSS","CYCLE","DAILY","DEBIT","DEGRE","DELAY",
    "DRIVE","DRIFT","DRILL","ENTRY","EQUIP","FIBER","FIELD","FINAL","FIXER","FLARE",
    "FLEET","FLOOR","FLUID","FORCE","FRAME","FRESH","FRONT","GAUGE","GEARS","GLASS",
    "GLOVE","GRADE","GRIND","GUIDE","GUARD","HONDA","HOIST","HORSE","HYDRO","IMAGE",
    "INNER","INPUT","JOINT","KNURL","LABEL","LATHE","LATCH","LEASE","LEVEL","LEVER",
    "LIFTS","LIGHT","LIMIT","LINER","LOBBY","LOCAL","LUBED","LUBES","METER","MODEL",
    "MONEY","MOTOR","MOUNT","MITSU","OFFER","OILED","ORDER","OWNER","PANEL","PATCH",
    "PEDAL","PHASE","PHONE","PILOT","PINON","PIVOT","PLAZA","POWER","PRESS","PRICE",
    "PRIME","PROOF","PROUD","PUMPS","PURGE","QUICK","QUOTE","RADAR","RADIO","RALLY",
    "RANGE","RATES","RATIO","READY","REBAR","RELAY","RENEW","REPAY","RIDER","RIDGE",
    "RIGID","RINSE","ROTOR","ROUTE","SAFER","SALES","SCALE","SCOPE","SCORE","SEALS",
    "SEATS","SERVE","SHAFT","SHIFT","SHINE","SHOCK","SHOPS","SHORE","SHORT","SLIDE",
    "SLICK","SMOKE","SOLID","SPEED","SPORT","STAFF","STAIN","STALL","STAMP","START",
    "STATE","STEEL","STEER","STOCK","STORE","STRIP","STYLE","SWEEP","SWING","TACKS",
    "TARPS","TEACH","TIGHT","TITLE","TOOLS","TORCH","TOTAL","TOUCH","TRACK","TRADE",
    "TRAIN","TREAD","TRIAL","TRUCK","TRUNK","TUNER","TURBO","TWIST","UNDER","UNION",
    "VALUE","VALVE","VAULT","VENDOR","VINYL","VISIT","VITAL","VOICE","WAGON",
    "WATER","WAXED","WHEEL","WINCH","WIRED","WIPER","WIRER","WORKS","YIELD"
  ];

  // --- Sanitization helpers (strict) ---
  const ONLY_AZ_5 = /^[A-Z]{5}$/;

  function sanitizeWordList(raw) {
    const cleaned = [];
    const seen = new Set();

    for (const item of raw) {
      const w = String(item).trim().toUpperCase();
      if (!ONLY_AZ_5.test(w)) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      cleaned.push(w);
    }

    return cleaned;
  }

  // Answers are themed + sanitized
  const ANSWER_WORDS = sanitizeWordList(VERN_EIDE_WORDS_RAW);

  // Valid guess set is loaded from file at runtime (required)
  let VALID_GUESS_SET = new Set();

  async function loadValidWordsTxtOrFail() {
    const res = await fetch("./valid-words.txt", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Missing valid-words.txt (HTTP ${res.status}). Put valid-words.txt next to app.js.`);
    }

    const text = await res.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const sanitized = sanitizeWordList(lines);
    const merged = sanitizeWordList([...sanitized, ...ANSWER_WORDS]);

    VALID_GUESS_SET = new Set(merged);

    console.log(`Loaded valid guesses: ${VALID_GUESS_SET.size} (includes answers=${ANSWER_WORDS.length})`);
  }

  // --- Deterministic word-of-the-day (local midnight) ---
  function getDayIndex() {
    const now = new Date();
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor(localMidnight.getTime() / (1000 * 60 * 60 * 24));
  }

  function getDailyWord() {
    return ANSWER_WORDS[getDayIndex() % ANSWER_WORDS.length];
  }

  // --- Storage keys ---
  const VERDLE_LAST_PLAYED_KEY = "verdleLastPlayedDay";
  const VERDLE_THEME_KEY = "verdleTheme";

  function hasPlayedToday() {
    const stored = localStorage.getItem(VERDLE_LAST_PLAYED_KEY);
    return stored !== null && Number(stored) === getDayIndex();
  }

  function markPlayedToday() {
    localStorage.setItem(VERDLE_LAST_PLAYED_KEY, String(getDayIndex()));
  }

  // --- DOM helpers ---
  const messageEl = document.getElementById("message");
  const keyboardEl = document.getElementById("keyboard");
  const themeToggleBtn = document.getElementById("themeToggle");
  const shareBtn = document.getElementById("shareBtn");

  function getTile(row, col) {
    return document.getElementById(`tile-${row}-${col}`);
  }

  function getRowEl(row) {
    return document.querySelectorAll(".row")[row];
  }

  function setMessage(msg) {
    messageEl.textContent = msg;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isHelpModalOpen() {
    return !!(helpModal && !helpModal.classList.contains("hidden"));
  }

  function openHelpModal() {
    if (!helpModal) return;
    helpModal.classList.remove("hidden");
    helpModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  
    animateHelpExample();
  }

  function closeHelpModal() {
    if (!helpModal) return;
    helpModal.classList.add("hidden");
    helpModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  async function animateHelpExample() {
    const tiles = [helpTile0, helpTile1, helpTile2];
    const classes = ["help-correct", "help-present", "help-absent"];
  
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (!tile) continue;
  
      // reset tile so animation can replay every time modal opens
      tile.classList.remove("flip", "help-correct", "help-present", "help-absent");
      tile.style.background = "";
      tile.style.borderColor = "";
  
      void tile.offsetWidth; // force reflow
      tile.classList.add("flip");
  
      setTimeout(() => {
        tile.classList.add(classes[i]);
      }, 300);
  
      await sleep(120);
    }
  }
  function restartAnimation(el, className) {
    el.classList.remove(className);
    void el.offsetWidth; // force reflow
    el.classList.add(className);
  }

  function animatePop(tile) {
    restartAnimation(tile, "pop");
  }

  function animateShakeRow(rowIndex) {
    const rowEl = getRowEl(rowIndex);
    if (!rowEl) return;

    restartAnimation(rowEl, "shake");
    rowEl.addEventListener(
      "animationend",
      () => rowEl.classList.remove("shake"),
      { once: true }
    );
  }

  async function animateRevealRow(rowIndex, result) {
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = getTile(rowIndex, c);
      tile.classList.add("flip");

      setTimeout(() => {
        tile.classList.remove("correct", "present", "absent");
        tile.classList.add(result[c]);
      }, 300);

      await sleep(120);
    }

    await sleep(650);
  }

  async function animateWinBounce(rowIndex) {
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = getTile(rowIndex, c);
      restartAnimation(tile, "bounce");
      setTimeout(() => tile.classList.remove("bounce"), 520);
      await sleep(100);
    }
  }

  // --- Game state ---
  let solution = "";
  let currentRow = 0;
  let currentCol = 0;
  let gameOver = false;

  // For sharing
  let resultsGrid = [];
  let guessesMade = [];

  // Keyboard coloring should never downgrade
  const keyRank = { none: 0, absent: 1, present: 2, correct: 3 };
  const keyboardStatus = new Map();

  function clearBoard() {
    for (let r = 0; r < MAX_GUESSES; r++) {
      for (let c = 0; c < WORD_LENGTH; c++) {
        const tile = getTile(r, c);
        tile.textContent = "";
        tile.className = "tile";
      }
    }
  }

  function clearKeyboardColors() {
    keyboardStatus.clear();
    const keys = keyboardEl.querySelectorAll(".key[data-key]");
    keys.forEach(btn => btn.classList.remove("correct", "present", "absent"));
  }

  function initGame() {
    if (ANSWER_WORDS.length === 0) {
      setMessage("Answer list is empty after filtering. Add valid 5-letter words.");
      gameOver = true;
      if (shareBtn) shareBtn.style.display = "none";
      return;
    }

    if (!VALID_GUESS_SET || VALID_GUESS_SET.size === 0) {
      setMessage("Valid word list not loaded. Check valid-words.txt.");
      gameOver = true;
      if (shareBtn) shareBtn.style.display = "none";
      return;
    }

    solution = getDailyWord();
    currentRow = 0;
    currentCol = 0;
    gameOver = false;

    resultsGrid = [];
    guessesMade = [];
    if (shareBtn) shareBtn.style.display = "none";

    clearBoard();
    clearKeyboardColors();

    if (hasPlayedToday()) {
      gameOver = true;
      setMessage("You already played VERDLE today. Come back tomorrow!");
    } else {
      setMessage("Type or tap letters. Enter to submit. Backspace clears.");
    }
  }

  // --- Keyboard builder ---
  function buildKeyboard() {
    keyboardEl.textContent = "";

    const rows = [
      ["Q","W","E","R","T","Y","U","I","O","P"],
      ["A","S","D","F","G","H","J","K","L"],
      ["ENTER","Z","X","C","V","B","N","M","BACKSPACE"]
    ];

    for (const row of rows) {
      const rowEl = document.createElement("div");
      rowEl.className = "krow";

      for (const key of row) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "key";
        btn.dataset.key = key;

        if (key === "ENTER" || key === "BACKSPACE") {
          btn.classList.add("wide");
        }

        btn.textContent = key === "BACKSPACE" ? "⌫" : key;
        btn.addEventListener("click", () => handleVirtualKey(key));
        rowEl.appendChild(btn);
      }

      keyboardEl.appendChild(rowEl);
    }
  }

  function paintKeyboardLetter(letter, status) {
    const current = keyboardStatus.get(letter) || "none";
    if (keyRank[status] <= keyRank[current]) return;

    keyboardStatus.set(letter, status);

    const btn = keyboardEl.querySelector(`.key[data-key="${letter}"]`);
    if (!btn) return;

    btn.classList.remove("correct", "present", "absent");
    btn.classList.add(status);
  }

  // --- Input handling ---
  function handleVirtualKey(key) {
    if (gameOver) return;
    if (isHelpModalOpen()) return;

    if (key === "ENTER") {
      if (currentCol === WORD_LENGTH) submitGuess();
      else {
        setMessage("Not enough letters.");
        animateShakeRow(currentRow);
      }
      return;
    }

    if (key === "BACKSPACE") {
      backspace();
      return;
    }

    if (/^[A-Z]$/.test(key)) {
      insertLetter(key);
    }
  }

  function insertLetter(letter) {
    if (currentCol >= WORD_LENGTH) return;

    const tile = getTile(currentRow, currentCol);
    tile.textContent = letter;
    tile.classList.add("filled");
    animatePop(tile);
    currentCol++;
  }

  function backspace() {
    if (currentCol <= 0) return;

    currentCol--;
    const tile = getTile(currentRow, currentCol);
    tile.textContent = "";
    tile.classList.remove("filled");
  }

  function handleKeyDown(e) {
    if (gameOver) return;
    if (isHelpModalOpen()) return;

    const key = e.key;

    if (key === "Enter") {
      if (currentCol === WORD_LENGTH) submitGuess();
      else {
        setMessage("Not enough letters.");
        animateShakeRow(currentRow);
      }
      return;
    }

    if (key === "Backspace") {
      backspace();
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (/^[a-zA-Z]$/.test(key)) {
      insertLetter(key.toUpperCase());
    }
  }

  // --- Guess logic ---
  function getCurrentGuess() {
    let guess = "";
    for (let c = 0; c < WORD_LENGTH; c++) {
      guess += getTile(currentRow, c).textContent;
    }
    return guess;
  }

  async function submitGuess() {
    const guess = getCurrentGuess();

    if (guess.length !== WORD_LENGTH) {
      setMessage("Not enough letters.");
      animateShakeRow(currentRow);
      return;
    }

    if (!VALID_GUESS_SET.has(guess)) {
      setMessage("Not in word list.");
      animateShakeRow(currentRow);
      return;
    }

    const result = evaluateGuess(guess, solution);

    guessesMade.push(guess);
    resultsGrid.push(result);

    gameOver = true;

    await animateRevealRow(currentRow, result);

    for (let c = 0; c < WORD_LENGTH; c++) {
      paintKeyboardLetter(guess[c], result[c]);
    }

    if (guess === solution) {
      setMessage("You got it! 🎉");
      await animateWinBounce(currentRow);
      gameOver = true;
      markPlayedToday();
      if (shareBtn) shareBtn.style.display = "inline-flex";
      return;
    }

    currentRow++;
    currentCol = 0;

    if (currentRow === MAX_GUESSES) {
      setMessage(`Out of guesses! The word was ${solution}.`);
      gameOver = true;
      markPlayedToday();
      if (shareBtn) shareBtn.style.display = "inline-flex";
    } else {
      setMessage("Keep going!");
      gameOver = false;
    }
  }

  function evaluateGuess(guess, sol) {
    const result = new Array(WORD_LENGTH).fill("absent");
    const remaining = {};

    for (let i = 0; i < WORD_LENGTH; i++) {
      const s = sol[i];
      const g = guess[i];
      if (g === s) {
        result[i] = "correct";
      } else {
        remaining[s] = (remaining[s] || 0) + 1;
      }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === "correct") continue;
      const g = guess[i];
      if (remaining[g] > 0) {
        result[i] = "present";
        remaining[g]--;
      }
    }

    return result;
  }

  // --- Share ---
  function resultToEmoji(status) {
    if (status === "correct") return "🟦";
    if (status === "present") return "🟧";
    return "⬛";
  }

  function buildShareText() {
    const won = guessesMade.length > 0 && guessesMade[guessesMade.length - 1] === solution;
    const tries = won ? resultsGrid.length : "X";
    const header = `VERDLE ${tries}/${MAX_GUESSES}`;

    const grid = resultsGrid
      .map(row => row.map(resultToEmoji).join(""))
      .join("\n");

    const link = "Play: vernei.de/verdle";

    return `${header}\n${grid}\n\n${link}`;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  // --- Theme ---
  function applyTheme(theme) {
    const safeTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", safeTheme);
    localStorage.setItem(VERDLE_THEME_KEY, safeTheme);
  }

  function initTheme() {
    const stored = localStorage.getItem(VERDLE_THEME_KEY);
    applyTheme(stored || "dark");
  }

  // --- Wire up ---
  async function init() {
    buildKeyboard();
    initTheme();

    try {
      await loadValidWordsTxtOrFail();
    } catch (err) {
      console.error(err);
      setMessage(String(err.message || err));
      document.addEventListener("keydown", (e) => e.preventDefault(), { capture: true });
      return;
    }

    initGame();

    if (helpBtn) {
      helpBtn.addEventListener("click", openHelpModal);
    }

    if (closeHelpBtn) {
      closeHelpBtn.addEventListener("click", closeHelpModal);
    }

    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", closeHelpModal);
    }

    document.addEventListener("keydown", (e) => {
      if (isHelpModalOpen()) {
        if (e.key === "Escape") {
          closeHelpModal();
        }
        return;
      }

      handleKeyDown(e);
    });

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme");
        applyTheme(current === "dark" ? "light" : "dark");
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        const text = buildShareText();
        try {
          await copyToClipboard(text);
          setMessage("Copied results to clipboard!");
        } catch {
          setMessage("Could not copy. Your browser may block clipboard access.");
        }
      });
    }

    console.log(`Answers: ${ANSWER_WORDS.length}, Valid guesses: ${VALID_GUESS_SET.size}`);
  }

  init();
})();