/* =============================================
   Typing Master — script.js
   All application logic
   Bugs Fixed:
   1. Timer cleared properly before reset
   2. Infinite mode timer display stays ∞
   3. hiddenInput fully reset on resetTest()
   4. Streak resets correctly per keystroke
   5. handleTyping uses raw value (no double-split)
   6. finishTest guards against double-fire
   7. CPM added to result modal
   8. Leaderboard/Profile use real UI panels
   ============================================= */

(function () {
  'use strict';

  /* ── DOM References ────────────────────── */
  const textDisplayDiv  = document.getElementById('textDisplay');
  const hiddenInput     = document.getElementById('hiddenTyper');
  const wpmSpan         = document.getElementById('wpmVal');
  const accSpan         = document.getElementById('accVal');
  const cpmSpan         = document.getElementById('cpmVal');
  const mistakesSpan    = document.getElementById('mistakesVal');
  const streakSpan      = document.getElementById('streakVal');
  const timerDisplaySpan= document.getElementById('timerDisplay');
  const restartBtn      = document.getElementById('restartBtn');
  const modal           = document.getElementById('resultModal');
  const finalWpmSpan    = document.getElementById('finalWpm');
  const finalAccSpan    = document.getElementById('finalAcc');
  const finalMistakesSpan = document.getElementById('finalMistakes');
  const finalCpmSpan    = document.getElementById('finalCpm');
  const closeModalBtn   = document.getElementById('closeModalBtn');

  // Panels
  const practicePanel     = document.getElementById('practicePanel');
  const leaderboardPanel  = document.getElementById('leaderboardPanel');
  const profilePanel      = document.getElementById('profilePanel');
  const lbBody            = document.getElementById('lbBody');
  const lbEmpty           = document.getElementById('lbEmpty');
  const profileAvatar     = document.getElementById('profileAvatar');
  const profileNameInput  = document.getElementById('profileNameInput');
  const saveProfileBtn    = document.getElementById('saveProfileBtn');
  const pTests            = document.getElementById('pTests');
  const pBestWPM          = document.getElementById('pBestWPM');
  const pChars            = document.getElementById('pChars');

  /* ── State ─────────────────────────────── */
  let originalTextArr = [];
  let userInput       = '';        // single source of truth (string)
  let mistakesCount   = 0;
  let startTime       = null;
  let timerInterval   = null;
  let isActive        = false;
  let testFinished    = false;     // guard against double finishTest
  let selectedTimer   = 30;       // 0 = infinite
  let timeLeft        = 30;
  let difficulty      = 'easy';
  let currentStreak   = 0;

  /* ── Word Banks ─────────────────────────── */
  const POOLS = {
    easy: [
      "The quick brown fox jumps over the lazy dog near the riverbank. Typing is fun and fast. Practice daily to see improvement in your speed and accuracy.",
      "Practice makes perfect and consistency builds muscle memory for speed typing. Focus on accuracy first, then speed will follow naturally over time.",
      "A calm mind and steady fingers produce outstanding words per minute. Take your time to learn each key position on the keyboard.",
      "Learning to type faster requires regular practice and patience. Start slow and gradually increase your speed while maintaining accuracy."
    ],
    medium: [
      "Developers write elegant code that powers modern applications across the world. Typing skills accelerate workflow and productivity significantly in any profession.",
      "Mastering touch typing requires dedication and regular practice sessions. Use all ten fingers wisely to maximize your speed potential and reduce fatigue.",
      "The ability to type quickly without looking at the keyboard is a valuable skill. It frees your mind to focus on the content rather than the mechanics."
    ],
    hard: [
      "Sphinx of black quartz judge my vow: complex syntax challenges even experienced typists. Accuracy matters more than raw speed in professional environments where precision is critical.",
      "The five boxing wizards jump quickly. Cryptic and unpredictable passages improve reflexes and adaptability under pressure. Typing is an essential skill in the digital age.",
      "How vexingly quick daft zebras jump! Pack my box with five dozen liquor jugs. Waltz nymph, for quick jigs vex bud."
    ],
    code: [
      "function bubbleSort(arr) { let len = arr.length; for (let i = 0; i < len; i++) { for (let j = 0; j < len - i - 1; j++) { if (arr[j] > arr[j+1]) { [arr[j], arr[j+1]] = [arr[j+1], arr[j]]; } } } return arr; }",
      "const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);",
      "const debounce = (fn, delay) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };",
      "class Stack { constructor() { this.data = []; } push(val) { this.data.push(val); } pop() { return this.data.pop(); } peek() { return this.data[this.data.length - 1]; } }"
    ],
    symbols: [
      "!@#$%^&*()_+{}:<>?~`-=[]|;',./ Typing symbols & numbers 1234567890 increases dexterity for programming and data entry professionals.",
      "#include <stdio.h> int main() { printf(\"Hello World! @#$%^&*\"); return 0; } /* Complex symbols challenge for advanced typists */",
      "SELECT * FROM users WHERE age > 18 AND status = 'active' ORDER BY name ASC LIMIT 10; -- SQL with symbols: !, @, #, $, %, &"
    ]
  };

  /* ── LocalStorage ───────────────────────── */
  let leaderboard = [];
  let userProfile  = { name: 'Typer', totalTests: 0, bestWPM: 0, totalChars: 0 };

  function loadStorage() {
    try {
      leaderboard = JSON.parse(localStorage.getItem('typingLeaderboard')) || [];
      userProfile  = JSON.parse(localStorage.getItem('typingProfile'))    || userProfile;
    } catch (e) {
      leaderboard = [];
    }
  }

  function saveStorage() {
    try {
      localStorage.setItem('typingLeaderboard', JSON.stringify(leaderboard));
      localStorage.setItem('typingProfile', JSON.stringify(userProfile));
    } catch (e) { /* storage unavailable */ }
  }

  /* ── Helpers ────────────────────────────── */
  function getRandomParagraph() {
    const pool = POOLS[difficulty] || POOLS.easy;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function escapeChar(ch) {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    return ch;
  }

  /* ── Render ─────────────────────────────── */
  function renderHighlightedText() {
    let html = '';
    for (let i = 0; i < originalTextArr.length; i++) {
      const ch = originalTextArr[i];
      let cls = '';
      if (i < userInput.length) {
        cls = userInput[i] === ch ? 'char-correct' : 'char-incorrect';
      } else if (i === userInput.length) {
        cls = 'char-current';
      }
      html += `<span class="${cls}">${escapeChar(ch)}</span>`;
    }
    textDisplayDiv.innerHTML = html;

    // Scroll current char into view inside the display box
    const cur = textDisplayDiv.querySelector('.char-current');
    if (cur) {
      cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ── Stats ──────────────────────────────── */
  function calcStats() {
    if (!startTime) return { wpm: 0, cpm: 0, acc: 100, mistakes: mistakesCount };
    const elapsedMin = (Date.now() - startTime) / 60000;
    let correctChars = 0;
    for (let i = 0; i < userInput.length && i < originalTextArr.length; i++) {
      if (userInput[i] === originalTextArr[i]) correctChars++;
    }
    const total   = userInput.length;
    const acc     = total === 0 ? 100 : Math.floor((correctChars / total) * 100);
    const cpm     = Math.floor(total / Math.max(0.001, elapsedMin));
    const wpm     = Math.max(0, Math.floor((correctChars / 5) / Math.max(0.001, elapsedMin)));
    return { wpm, cpm, acc, mistakes: mistakesCount };
  }

  function updateStatsDisplay() {
    const s = calcStats();
    wpmSpan.innerText      = s.wpm;
    cpmSpan.innerText      = s.cpm;
    accSpan.innerText      = s.acc + '%';
    mistakesSpan.innerText = s.mistakes;
    streakSpan.innerText   = currentStreak;
  }

  function resetStatsDisplay() {
    wpmSpan.innerText      = '0';
    cpmSpan.innerText      = '0';
    accSpan.innerText      = '100%';
    mistakesSpan.innerText = '0';
    streakSpan.innerText   = '0';
  }

  /* ── Reset Test ─────────────────────────── */
  function resetTest() {
    // 1. Stop any running timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // 2. Reset flags
    isActive     = false;
    testFinished = false;
    startTime    = null;

    // 3. Reset counters
    mistakesCount  = 0;
    currentStreak  = 0;
    userInput      = '';

    // 4. Load new text
    const para   = getRandomParagraph();
    originalTextArr = para.split('');
    renderHighlightedText();

    // 5. Timer display
    if (selectedTimer === 0) {
      timeLeft = Infinity;
      timerDisplaySpan.innerText = '∞';
      timerDisplaySpan.classList.remove('warning');
    } else {
      timeLeft = selectedTimer;
      timerDisplaySpan.innerText = `${timeLeft}s`;
      timerDisplaySpan.classList.remove('warning');
    }

    // 6. Reset hidden input and focus
    hiddenInput.value = '';
    resetStatsDisplay();
    hiddenInput.focus();
  }

  /* ── Start Timer ────────────────────────── */
  function startTimer() {
    if (selectedTimer === 0) return; // infinite — no countdown

    timerInterval = setInterval(() => {
      if (!isActive) {
        clearInterval(timerInterval);
        timerInterval = null;
        return;
      }

      timeLeft--;

      if (timeLeft <= 5) {
        timerDisplaySpan.classList.add('warning');
      }

      if (timeLeft <= 0) {
        timerDisplaySpan.innerText = '0s';
        clearInterval(timerInterval);
        timerInterval = null;
        finishTest();
      } else {
        timerDisplaySpan.innerText = `${timeLeft}s`;
      }
    }, 1000);
  }

  /* ── Finish Test ────────────────────────── */
  function finishTest() {
    if (testFinished) return;  // guard double-fire
    testFinished = true;
    isActive     = false;

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    const s = calcStats();

    // Save to profile
    userProfile.totalTests++;
    if (s.wpm > userProfile.bestWPM) userProfile.bestWPM = s.wpm;
    userProfile.totalChars += userInput.length;

    // Save to leaderboard
    leaderboard.push({
      name: userProfile.name,
      wpm:  s.wpm,
      date: new Date().toISOString()
    });
    leaderboard.sort((a, b) => b.wpm - a.wpm);
    if (leaderboard.length > 15) leaderboard = leaderboard.slice(0, 15);

    saveStorage();

    // Show modal
    finalWpmSpan.innerText      = s.wpm;
    finalAccSpan.innerText      = s.acc + '%';
    finalMistakesSpan.innerText = s.mistakes;
    finalCpmSpan.innerText      = s.cpm;
    modal.classList.add('show');
  }

  /* ── Typing Handler ─────────────────────── */
  function handleTyping(e) {
    const rawValue = e.target.value;

    // Don't process if test is done
    if (testFinished) return;

    // Timer hasn't started yet — check if we should start
    if (!isActive && rawValue.length > 0 && startTime === null) {
      // Don't allow typing if timed test has expired
      if (selectedTimer !== 0 && timeLeft <= 0) {
        hiddenInput.value = '';
        return;
      }
      startTime = Date.now();
      isActive  = true;
      startTimer();
    }

    if (!isActive) return;

    // Prevent typing beyond text length
    if (rawValue.length > originalTextArr.length) {
      hiddenInput.value = rawValue.slice(0, originalTextArr.length);
      return;
    }

    userInput = rawValue;

    // Calculate mistakes and streak
    let mistakes = 0;
    let maxStreak = 0;
    let curRun = 0;
    for (let i = 0; i < userInput.length && i < originalTextArr.length; i++) {
      if (userInput[i] !== originalTextArr[i]) {
        mistakes++;
        curRun = 0;
      } else {
        curRun++;
        if (curRun > maxStreak) maxStreak = curRun;
      }
    }
    mistakesCount = mistakes;
    currentStreak = maxStreak;

    renderHighlightedText();
    updateStatsDisplay();

    // Check completion
    if (userInput.length >= originalTextArr.length && isActive) {
      finishTest();
    }
  }

  /* ── Leaderboard UI ─────────────────────── */
  function renderLeaderboard() {
    lbBody.innerHTML = '';
    if (leaderboard.length === 0) {
      lbEmpty.style.display = 'block';
      return;
    }
    lbEmpty.style.display = 'none';
    leaderboard.slice(0, 15).forEach((entry, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHtml(entry.name)}</td>
        <td>${entry.wpm} WPM</td>
        <td>${new Date(entry.date).toLocaleDateString()}</td>
      `;
      lbBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── Profile UI ─────────────────────────── */
  function renderProfile() {
    profileNameInput.value = userProfile.name;
    profileAvatar.innerText = userProfile.name.charAt(0).toUpperCase() || 'T';
    pTests.innerText   = userProfile.totalTests;
    pBestWPM.innerText = userProfile.bestWPM;
    pChars.innerText   = userProfile.totalChars.toLocaleString();
  }

  /* ── Navigation ─────────────────────────── */
  const navPanels = {
    practice:    practicePanel,
    leaderboard: leaderboardPanel,
    profile:     profilePanel
  };

  function showPanel(name) {
    Object.values(navPanels).forEach(p => p.classList.add('hidden'));
    navPanels[name].classList.remove('hidden');

    if (name === 'leaderboard') renderLeaderboard();
    if (name === 'profile')     renderProfile();

    // Re-focus hidden input when back on practice
    if (name === 'practice') hiddenInput.focus();
  }

  /* ── Event Listeners ────────────────────── */

  // Nav buttons
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-nav]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showPanel(btn.dataset.nav);
    });
  });

  // Timer chips
  document.querySelectorAll('[data-timer]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-timer]').forEach(b => b.classList.remove('active-mode'));
      el.classList.add('active-mode');
      selectedTimer = parseInt(el.dataset.timer, 10) || 0;
      resetTest();
    });
  });

  // Difficulty chips
  document.querySelectorAll('[data-diff]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('active-mode'));
      el.classList.add('active-mode');
      difficulty = el.dataset.diff;
      resetTest();
    });
  });

  // Restart button
  restartBtn.addEventListener('click', () => {
    resetTest();
  });

  // Close modal
  closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    resetTest();
  });

  // Close modal with Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      modal.classList.remove('show');
      resetTest();
    }
    // Tab key: restart
    if (e.key === 'Tab' && !modal.classList.contains('show')) {
      e.preventDefault();
      resetTest();
    }
  });

  // Typing input
  hiddenInput.addEventListener('input', handleTyping);

  // Click anywhere to focus
  document.body.addEventListener('click', e => {
    if (!modal.classList.contains('show')) hiddenInput.focus();
  });

  // Prevent paste
  hiddenInput.addEventListener('paste', e => e.preventDefault());

  // Save profile name
  saveProfileBtn.addEventListener('click', () => {
    const newName = profileNameInput.value.trim();
    if (newName) {
      userProfile.name = newName;
      saveStorage();
      profileAvatar.innerText = newName.charAt(0).toUpperCase();
    }
  });

  profileNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveProfileBtn.click();
  });

  /* ── Particles ──────────────────────────── */
  function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width  = w;
    canvas.height = h;

    const particles = Array.from({ length: 65 }, () => ({
      x:      Math.random() * w,
      y:      Math.random() * h,
      r:      Math.random() * 1.8 + 0.8,
      alpha:  Math.random() * 0.45 + 0.05,
      dx:     (Math.random() - 0.5) * 0.28,
      dy:     (Math.random() - 0.5) * 0.18
    }));

    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 155, 255, ${p.alpha})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      }
      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width  = w;
      canvas.height = h;
    });

    animate();
  }

  /* ── Init ───────────────────────────────── */
  loadStorage();
  initParticles();
  resetTest();

})();