(() => {
    const boardEl = document.getElementById("sudokuBoard");
    const checkInfoEl = document.getElementById("checkInfo");
    const checkBtn = document.getElementById("checkBtn");
    const clearBtn = document.getElementById("clearBtn");
    const cellPickerEl = document.getElementById("cellPicker");
    const difficultyButtons = document.querySelectorAll(".difficulty-btn");
    const themeToggleBtn = document.getElementById("themeToggle");
  
    const THEME_KEY = "verdleTheme";
  
    const DIFFICULTY_CLUES = {
      easy: 40,
      medium: 32,
      hard: 26
    };
  
    const DIFFICULTY_CHECKS = {
      easy: 1,
      medium: 2,
      hard: 3
    };
  
    let currentDifficulty = "easy";
    let currentPuzzle = [];
    let currentSolution = [];
    let selectedCell = null;
    let checksUsed = 0;
  
    function applyTheme(theme) {
      const safeTheme = theme === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", safeTheme);
      localStorage.setItem(THEME_KEY, safeTheme);
    }
  
    function initTheme() {
      const stored = localStorage.getItem(THEME_KEY);
      applyTheme(stored || "dark");
    }
  
    function getDaySeed() {
      const now = new Date();
      const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return Math.floor(localMidnight.getTime() / (1000 * 60 * 60 * 24));
    }
  
    function hashSeed(seed, difficulty) {
      let h = seed;
      for (const ch of difficulty) {
        h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      }
      return h >>> 0;
    }
  
    function createSeededRandom(seed) {
      let state = seed >>> 0;
      return function random() {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }
  
    function shuffle(arr, random) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }
  
    function emptyBoard() {
      return Array.from({ length: 9 }, () => Array(9).fill(0));
    }
  
    function cloneBoard(board) {
      return board.map(row => [...row]);
    }
  
    function isValid(board, row, col, num) {
      for (let i = 0; i < 9; i++) {
        if (board[row][i] === num) return false;
        if (board[i][col] === num) return false;
      }
  
      const boxRow = Math.floor(row / 3) * 3;
      const boxCol = Math.floor(col / 3) * 3;
  
      for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
          if (board[r][c] === num) return false;
        }
      }
  
      return true;
    }
  
    function solveBoard(board, random) {
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          if (board[row][col] === 0) {
            const nums = shuffle([1,2,3,4,5,6,7,8,9], random);
  
            for (const num of nums) {
              if (isValid(board, row, col, num)) {
                board[row][col] = num;
                if (solveBoard(board, random)) return true;
                board[row][col] = 0;
              }
            }
  
            return false;
          }
        }
      }
  
      return true;
    }
  
    function makePuzzle(solution, clueCount, random) {
      const puzzle = cloneBoard(solution);
      const cells = [];
  
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          cells.push([r, c]);
        }
      }
  
      const shuffled = shuffle(cells, random);
      const toRemove = 81 - clueCount;
  
      for (let i = 0; i < toRemove; i++) {
        const [r, c] = shuffled[i];
        puzzle[r][c] = 0;
      }
  
      return puzzle;
    }
  
    function generateDailySudoku(difficulty) {
      const seed = hashSeed(getDaySeed(), difficulty);
      const random = createSeededRandom(seed);
  
      const solution = emptyBoard();
      solveBoard(solution, random);
  
      const clueCount = DIFFICULTY_CLUES[difficulty];
      const puzzle = makePuzzle(solution, clueCount, random);
  
      return { puzzle, solution };
    }
  
    function updateMeta(extraMessage = "") {
      const totalChecks = DIFFICULTY_CHECKS[currentDifficulty];
      const checksLeft = Math.max(0, totalChecks - checksUsed);
  
      checkInfoEl.textContent = `Checks left: ${checksLeft}${extraMessage ? ` • ${extraMessage}` : ""}`;
      checkBtn.disabled = checksLeft <= 0;
    }
  
    function clearSelection() {
      boardEl.querySelectorAll(".sudoku-cell.selected").forEach(cell => {
        cell.classList.remove("selected");
      });
    }
  
    function hideCellPicker() {
      if (!cellPickerEl) return;
      cellPickerEl.classList.add("hidden");
    }
  
    function showCellPicker() {
      if (!cellPickerEl) return;
      if (!selectedCell || selectedCell.dataset.given === "true") {
        hideCellPicker();
        return;
      }
      cellPickerEl.classList.remove("hidden");
    }
  
    function selectCell(cell) {
      if (!cell || cell.dataset.given === "true") return;
  
      clearSelection();
      selectedCell = cell;
      selectedCell.classList.add("selected");
      selectedCell.focus();
      showCellPicker();
    }
  
    function moveSelection(deltaRow, deltaCol) {
      if (!selectedCell) return;
  
      let row = Number(selectedCell.dataset.row);
      let col = Number(selectedCell.dataset.col);
  
      while (true) {
        row += deltaRow;
        col += deltaCol;
  
        if (row < 0 || row > 8 || col < 0 || col > 8) return;
  
        const next = boardEl.querySelector(
          `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
        );
  
        if (next && next.dataset.given !== "true") {
          selectCell(next);
          return;
        }
      }
    }
  
    function renderBoard(board) {
      boardEl.innerHTML = "";
      selectedCell = null;
      hideCellPicker();
  
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = document.createElement("div");
          cell.className = "sudoku-cell";
          cell.dataset.row = String(r);
          cell.dataset.col = String(c);
  
          if ((c + 1) % 3 === 0 && c !== 8) cell.classList.add("border-right");
          if ((r + 1) % 3 === 0 && r !== 8) cell.classList.add("border-bottom");
  
          const value = board[r][c];
          const isGiven = value !== 0;
  
          cell.dataset.given = String(isGiven);
  
          if (isGiven) {
            cell.textContent = value;
            cell.classList.add("given");
            cell.tabIndex = -1;
          } else {
            cell.classList.add("user");
            cell.tabIndex = 0;
          }
  
          cell.addEventListener("click", () => selectCell(cell));
          cell.addEventListener("focus", () => {
            if (cell.dataset.given !== "true") {
              selectCell(cell);
            }
          });
  
          boardEl.appendChild(cell);
        }
      }
    }
  
    function renderCellPicker() {
      if (!cellPickerEl) return;
  
      cellPickerEl.innerHTML = "";
  
      for (let n = 1; n <= 9; n++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell-picker-btn";
        btn.textContent = String(n);
        btn.addEventListener("click", () => setSelectedValue(n));
        cellPickerEl.appendChild(btn);
      }
  
      const clearOneBtn = document.createElement("button");
      clearOneBtn.type = "button";
      clearOneBtn.className = "cell-picker-btn clear-one";
      clearOneBtn.textContent = "Clear Cell";
      clearOneBtn.addEventListener("click", clearSelectedValue);
      cellPickerEl.appendChild(clearOneBtn);
    }
  
    function setSelectedValue(value) {
      if (!selectedCell) return;
      if (selectedCell.dataset.given === "true") return;
  
      selectedCell.textContent = String(value);
      selectedCell.classList.remove("invalid");
    }
  
    function clearSelectedValue() {
      if (!selectedCell) return;
      if (selectedCell.dataset.given === "true") return;
  
      selectedCell.textContent = "";
      selectedCell.classList.remove("invalid");
    }
  
    function clearBoard() {
      const cells = boardEl.querySelectorAll(".sudoku-cell.user");
      cells.forEach(cell => {
        cell.textContent = "";
        cell.classList.remove("invalid");
      });
      updateMeta();
    }
  
    function checkBoard() {
      const totalChecks = DIFFICULTY_CHECKS[currentDifficulty];
      if (checksUsed >= totalChecks) return;
  
      checksUsed++;
  
      const cells = boardEl.querySelectorAll(".sudoku-cell");
      cells.forEach(cell => cell.classList.remove("invalid"));
  
      let hasErrors = false;
  
      cells.forEach(cell => {
        const r = Number(cell.dataset.row);
        const c = Number(cell.dataset.col);
        const value = cell.textContent.trim();
  
        if (!value) return;
        if (Number(value) !== currentSolution[r][c]) {
          cell.classList.add("invalid");
          hasErrors = true;
        }
      });
  
      updateMeta(hasErrors ? "Some entries are incorrect" : "No incorrect entries found");
    }
  
    function setDifficulty(difficulty) {
      currentDifficulty = difficulty;
      checksUsed = 0;
  
      difficultyButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.difficulty === difficulty);
      });
  
      const { puzzle, solution } = generateDailySudoku(difficulty);
      currentPuzzle = puzzle;
      currentSolution = solution;
  
      renderBoard(currentPuzzle);
      renderCellPicker();
      updateMeta();
    }
  
    difficultyButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        setDifficulty(btn.dataset.difficulty);
      });
    });
  
    document.addEventListener("keydown", (e) => {
      if (!selectedCell) return;
  
      if (e.key >= "1" && e.key <= "9") {
        setSelectedValue(Number(e.key));
        return;
      }
  
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        clearSelectedValue();
        return;
      }
  
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1, 0);
        return;
      }
  
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1, 0);
        return;
      }
  
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveSelection(0, -1);
        return;
      }
  
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(0, 1);
      }
    });
  
    checkBtn.addEventListener("click", checkBoard);
    clearBtn.addEventListener("click", clearBoard);
  
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme");
        applyTheme(current === "dark" ? "light" : "dark");
      });
    }
  
    initTheme();
    setDifficulty(currentDifficulty);
  })();