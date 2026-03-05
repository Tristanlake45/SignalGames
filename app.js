// app.js
(() => {
  const WORD_LENGTH = 5;
  const MAX_GUESSES = 6;

  // Vern Eide themed ANSWERS (solutions come from here only)
  const VERN_EIDE_WORDS_RAW = [
    "DRIVE","BRAKE","RIDES","MOTOR","GEARS","ALIGN","SPEED","QUICK","TOTAL","SPORT",
    "COUPE","SEDAN","TRUCK","AXLES","CABIN","PANEL","GUARD","TUNER","FLEET","LEASE",
    "LOANS","TITLE","TRADE","MODEL","VALUE","PRICE","QUOTE","OFFER","BONUS","SAVES",
    "DEALS","SALES","OWNER","POWER","FIXED","PARTS","PAINT","WELDS","TOOLS","TORCH",
    "METAL","FRAME","CLIPS","WIRES","HOSES","BELTS","PUMPS","CLEAN","SCRUB","TOWED",
    "TOWEL","WAXED","SHINE","BOATS","CANOE","KAYAK","OCEAN","RIVER","SHORE","BEACH",
    "HULLS","ROPES","CLEAT","WINCH","FLOAT","WATER","WAVES","TIDES","SWIMS","FISHY",
    "LURES","REELS","HOOKS","BAITS","CATCH","STERN","BOWED","DOCKS","WHARF","RIDER",
    "DUSTY","DUNES","TRAIL","TRACK","RALLY","CHAIN","GLOVE","HELMS","SUITS","ROLLS",
    "JUMPS","DAILY","CHECK","READY","MILES","ROADS","TRIPS","VISIT","LOCAL",
    "STOCK","ORDER","TAXES","FEES","COSTS","BUYER","RATES","TERMS","TRUST","SERVE",
    "CARES","GUIDE","MEETS","HAPPY","SMILE","HONOR","PROUD","SUNNY","CLOUD","STORM",
    "WINDS","RAINY","CLEAR","BRISK","CHILL","SNOWY","ICING","FROST","MOIST","HAZY",
    "GUSTS","HEATS","HUMID","ROUTE","NORTH","SOUTH","EASTS","WESTS","HILLS","RIDGE",
    "PLAZA","TOWNS","CITIES","RURAL","URBAN","METRO","STATE","PATHS","RANCH","VALVE",
    "SPARK","FIRES","TUNED","OILED","OILER","SHAFT","CRANK","FLUID","PIPES","LINES",
    "JOINT","LEVER","BOOST","TURBO","FUMES","SMOKE","BLADE","LAKES","PONDS","SAILS",
    "CREST","BOARD","SHIPS","COVE","HONDA","ACURA","MITSU","CIVIC","PILOT","FORCE",
    "RODEO","SHIFT","TIRES","GRIPS","RACES","DRAGS","STUNT","CHASE","DRIFT","THANK",
    "TEAMS","HELPS","FAIRS","BRITE","BRAVE","FUNDS","MONEY","CLAIM","APPLY","SCORE",
    "TESTS","RANGE"
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

  // --- Deterministic word-of-the-day (from ANSWER_WORDS only) ---
  function getDayIndex() {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor(Date.now() / msPerDay);
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
  function setMessage(msg) {
    messageEl.textContent = msg;
  }

  // --- Game state ---
  let solution = "";
  let currentRow = 0;
  let currentCol = 0;
  let gameOver = false;

  // For sharing
  let resultsGrid = []; // array of arrays of "correct"|"present"|"absent"
  let guessesMade = []; // array of guess strings

  // Keyboard coloring should never downgrade
  const keyRank = { none: 0, absent: 1, present: 2, correct: 3 };
  const keyboardStatus = new Map(); // letter -> status

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

    // reset share state
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

        if (key === "ENTER" || key === "BACKSPACE") btn.classList.add("wide");

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

    if (key === "ENTER") {
      if (currentCol === WORD_LENGTH) submitGuess();
      else setMessage("Not enough letters.");
      return;
    }

    if (key === "BACKSPACE") {
      backspace();
      return;
    }

    if (/^[A-Z]$/.test(key)) insertLetter(key);
  }

  function insertLetter(letter) {
    if (currentCol >= WORD_LENGTH) return;
    const tile = getTile(currentRow, currentCol);
    tile.textContent = letter;
    tile.classList.add("filled");
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

    const key = e.key;

    if (key === "Enter") {
      if (currentCol === WORD_LENGTH) submitGuess();
      else setMessage("Not enough letters.");
      return;
    }

    if (key === "Backspace") {
      backspace();
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (/^[a-zA-Z]$/.test(key)) insertLetter(key.toUpperCase());
  }

  // --- Guess logic ---
  function getCurrentGuess() {
    let guess = "";
    for (let c = 0; c < WORD_LENGTH; c++) guess += getTile(currentRow, c).textContent;
    return guess;
  }

  function submitGuess() {
    const guess = getCurrentGuess();

    if (guess.length !== WORD_LENGTH) {
      setMessage("Not enough letters.");
      return;
    }

    if (!VALID_GUESS_SET.has(guess)) {
      setMessage("Not in word list.");
      return;
    }

    const result = evaluateGuess(guess, solution);

    // store for share
    guessesMade.push(guess);
    resultsGrid.push(result);

    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = getTile(currentRow, c);
      tile.classList.remove("correct", "present", "absent");
      tile.classList.add(result[c]);
      paintKeyboardLetter(guess[c], result[c]);
    }

    if (guess === solution) {
      setMessage("You got it! 🎉");
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
    }
  }

  function evaluateGuess(guess, sol) {
    const result = new Array(WORD_LENGTH).fill("absent");
    const remaining = {};

    for (let i = 0; i < WORD_LENGTH; i++) {
      const s = sol[i];
      const g = guess[i];
      if (g === s) result[i] = "correct";
      else remaining[s] = (remaining[s] || 0) + 1;
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

    document.addEventListener("keydown", handleKeyDown);

    themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });

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