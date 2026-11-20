(() => {
  const symbols = ['🌷', '🍓', '🌙', '🦋', '🍒', '🌈', '🍋', '🐝', '🌸', '🍉', '🪻', '⭐', '🐢', '🍍', '🧁', '🍀', '🐳', '🍄', '🧸', '🌻', '🐙', '🍇', '🦊', '🥑', '🎈', '🌼', '🐬'];
  const levelPairs = {
    easy: [2, 3, 4, 5, 6, 7, 8, 9],
    medium: [2, 6, 8, 10, 12, 14, 16, 18],
    hard: [2, 9, 12, 15, 18, 21, 24, 27]
  };
  const difficultyHints = {
    easy: 'Easy · two balanced rows',
    medium: 'Medium · four rows after Level 1',
    hard: 'Hard · six rows after Level 1'
  };
  const board = document.querySelector('#game-board');
  const boardWrap = document.querySelector('#board-wrap');
  const difficultyPicker = document.querySelector('#difficulty-picker');
  const difficultyTrigger = document.querySelector('#difficulty-trigger');
  const difficultyMenu = document.querySelector('#difficulty-menu');
  const difficultyCurrent = document.querySelector('#difficulty-current');
  let difficultyValue = 'medium';
  const movesEl = document.querySelector('#moves');
  const personalBestEl = document.querySelector('#personal-best');
  const matchedEl = document.querySelector('#matched');
  const totalEl = document.querySelector('.stat-total');
  const timerEl = document.querySelector('#timer');
  const accuracyEl = document.querySelector('#accuracy');
  const pauseButton = document.querySelector('#pause');
  const pauseOverlay = document.querySelector('#pause-overlay');
  const modal = document.querySelector('#win-modal');
  const soundButton = document.querySelector('.sound-toggle');
  const musicButton = document.querySelector('.music-toggle');
  const musicVolume = document.querySelector('.music-volume');

  let cards = [];
  let level = 1;
  let flipped = [];
  let moves = 0;
  let matched = 0;
  let seconds = 0;
  let interval = null;
  let started = false;
  let paused = false;
  let locked = false;
  let soundEnabled = true;
  let audioContext = null;
  let musicPlaying = false;
  let musicMaster = null;
  let noiseBuffer = null;
  let musicInterval = null;
  let beatStep = 0;
  let musicStarting = false;
  let mismatchTimeout = null;
  const beatDuration = 60 / 92 / 2;

  function getAudioContext() {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  // Use a small synthesized tone so sound works without external audio files.
  function playTone(kind) {
    if (!soundEnabled) return;
    try {
      const context = getAudioContext();
      if (context.state === 'suspended') context.resume();
      const settings = { flip: [460, .055, 'sine'], match: [720, .14, 'sine'], miss: [190, .13, 'triangle'], win: [880, .25, 'sine'] }[kind];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = settings[2];
      oscillator.frequency.value = settings[0];
      gain.gain.setValueAtTime(.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.075, context.currentTime + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + settings[1]);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + settings[1]);
    } catch (_) { /* Audio is optional; gameplay continues if unavailable. */ }
  }

  function musicLevel() {
    return Number(musicVolume.value) / 100 * 0.5;
  }

  function playKick(context, strength = 1) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(112, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(52, context.currentTime + 0.13);
    envelope.gain.setValueAtTime(0.0001, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.65 * strength, context.currentTime + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.19);
    oscillator.connect(envelope).connect(musicMaster);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  }

  function playNoiseHit(context, { cutoff, type, duration, volume }) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = type;
    filter.frequency.value = cutoff;
    envelope.gain.setValueAtTime(volume, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter).connect(envelope).connect(musicMaster);
    source.start();
    source.stop(context.currentTime + duration);
  }

  function playNextBeat() {
    if (!musicPlaying) return;
    const context = getAudioContext();
    // A soft syncopated kick, hand-clap backbeat, and gentle shaker keep it warm and upbeat.
    if ([0, 6, 8, 14].includes(beatStep)) playKick(context, beatStep === 0 || beatStep === 8 ? 1 : 0.72);
    if (beatStep === 4 || beatStep === 12) playNoiseHit(context, { cutoff: 1500, type: 'bandpass', duration: 0.12, volume: 0.25 });
    playNoiseHit(context, { cutoff: 6500, type: 'highpass', duration: 0.045, volume: beatStep % 2 === 0 ? 0.12 : 0.08 });
    beatStep = (beatStep + 1) % 16;
  }

  // Create a soft, upbeat percussion loop with no external audio assets.
  async function startMusic() {
    if (musicStarting || musicPlaying) return;
    musicStarting = true;
    try {
      const context = getAudioContext();
      if (context.state === 'suspended') await context.resume();
      if (context.state !== 'running') throw new Error('Audio playback is unavailable.');
      if (musicMaster) musicMaster.disconnect();
      musicMaster = context.createGain();
      musicMaster.gain.setValueAtTime(0, context.currentTime);
      musicMaster.gain.linearRampToValueAtTime(musicLevel(), context.currentTime + 0.18);
      musicMaster.connect(context.destination);
      noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const noise = noiseBuffer.getChannelData(0);
      for (let index = 0; index < noise.length; index += 1) noise[index] = Math.random() * 2 - 1;
      beatStep = 0;
      musicPlaying = true;
      playNextBeat();
      musicInterval = window.setInterval(playNextBeat, beatDuration * 1000);
      musicButton.setAttribute('aria-pressed', 'true');
      musicButton.setAttribute('aria-label', 'Pause upbeat music');
      musicButton.title = 'Pause upbeat music';
      musicButton.querySelector('span').textContent = 'Pause music';
      musicButton.classList.add('is-playing');
    } catch (_) {
      musicPlaying = false;
      musicButton.setAttribute('aria-pressed', 'false');
      musicButton.setAttribute('aria-label', 'Audio unavailable; try playing again');
      musicButton.title = 'Audio could not start. Click to retry.';
      musicButton.querySelector('span').textContent = 'Try again';
      musicButton.classList.remove('is-playing');
    } finally {
      musicStarting = false;
    }
  }

  function pauseMusic() {
    musicPlaying = false;
    window.clearInterval(musicInterval);
    musicInterval = null;
    if (musicMaster) musicMaster.disconnect();
    musicMaster = null;
    musicButton.setAttribute('aria-pressed', 'false');
    musicButton.setAttribute('aria-label', 'Play upbeat music');
    musicButton.title = 'Play upbeat music';
    musicButton.querySelector('span').textContent = 'Play music';
    musicButton.classList.remove('is-playing');
  }

  function formatTime(value) {
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  function updateStats() {
    movesEl.textContent = moves;
    matchedEl.textContent = matched;
    const accuracy = moves ? Math.round((matched / moves) * 100) : null;
    accuracyEl.textContent = accuracy === null ? '—' : `${accuracy}%`;
    timerEl.textContent = formatTime(seconds);
  }

  function pairsForLevel() {
    return levelPairs[difficultyValue][level - 1];
  }

  function bestScoreKey() {
    return `mindmatch:best:${difficultyValue}:${level}`;
  }

  function readPersonalBest() {
    try {
      const value = Number(window.localStorage.getItem(bestScoreKey()));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (_) {
      return null;
    }
  }

  function showPersonalBest() {
    const best = readPersonalBest();
    personalBestEl.textContent = best ? `BEST ${best} MOVES` : 'BEST —';
  }

  function savePersonalBest() {
    const previous = readPersonalBest();
    if (previous !== null && previous <= moves) return false;
    try {
      window.localStorage.setItem(bestScoreKey(), String(moves));
      showPersonalBest();
      return true;
    } catch (_) {
      return false;
    }
  }

  function columnsForLevel() {
    return Math.min(level + 1, 9);
  }

  function positionForCard(index, cardCount, columns) {
    const row = Math.floor(index / columns) + 1;
    const column = (index % columns) + 1;
    const remainder = cardCount % columns;
    const isLastPartialRow = remainder > 0 && row === Math.ceil(cardCount / columns);
    const centerOffset = isLastPartialRow ? Math.floor((columns - remainder) / 2) : 0;
    return { row, column: column + centerOffset };
  }

  function layoutBoard() {
    const columns = columnsForLevel();
    const rows = Math.ceil(cards.length / columns);
    const frameBounds = boardWrap.getBoundingClientRect();
    const boardStyles = window.getComputedStyle(board);
    const columnGap = Number.parseFloat(boardStyles.columnGap) || 0;
    const rowGap = Number.parseFloat(boardStyles.rowGap) || 0;
    const frameWidth = Math.min(frameBounds.width, 760);
    const cellWidth = (frameWidth - columnGap * (columns - 1)) / columns;
    const cellHeight = (frameBounds.height - rowGap * (rows - 1)) / rows;
    const cardWidth = cellWidth;
    const cardHeight = cellHeight;
    board.style.width = `${frameWidth}px`;
    board.style.height = `${frameBounds.height}px`;
    board.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    [...board.children].forEach((button, index) => {
      const position = positionForCard(index, cards.length, columns);
      button.style.gridRow = String(position.row);
      button.style.gridColumn = String(position.column);
      button.style.width = `${cardWidth}px`;
      button.style.height = `${cardHeight}px`;
    });
  }

  function shuffleDeck(deck) {
    // Fisher–Yates gives every card ordering an equal chance.
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
    return deck;
  }

  function startTimer() {
    if (interval || !started || paused || matched === pairsForLevel()) return;
    interval = window.setInterval(() => { seconds += 1; timerEl.textContent = formatTime(seconds); }, 1000);
  }

  function stopTimer() {
    window.clearInterval(interval);
    interval = null;
  }

  // Build and shuffle a fresh deck for the currently selected level.
  function createGame(resetProgress = false) {
    stopTimer();
    window.clearTimeout(mismatchTimeout);
    mismatchTimeout = null;
    if (resetProgress) level = 1;
    const pairCount = pairsForLevel();
    cards = shuffleDeck([...symbols.slice(0, pairCount), ...symbols.slice(0, pairCount)].map(symbol => ({ symbol })));
    flipped = [];
    moves = 0;
    matched = 0;
    seconds = 0;
    started = false;
    paused = false;
    locked = false;
    pauseButton.setAttribute('aria-pressed', 'false');
    pauseButton.querySelector('span').textContent = 'Pause';
    pauseOverlay.hidden = true;
    board.classList.remove('is-paused');
    board.dataset.difficulty = difficultyValue;
    board.replaceChildren();
    totalEl.textContent = ` / ${pairCount}`;
    document.querySelector('#level-badge').textContent = `LEVEL ${level}`;
    document.querySelector('#board-hint').textContent = `${cards.length} cards · ${pairCount} pairs · ${difficultyHints[difficultyValue]}.`;
    showPersonalBest();

    cards.forEach((card, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card';
      button.dataset.index = index;
      button.setAttribute('aria-label', `Card ${index + 1}, face down`);
      button.innerHTML = '<span class="card-inner"><span class="card-face card-back"></span><span class="card-face card-front" aria-hidden="true"></span></span>';
      button.addEventListener('click', () => revealCard(index));
      board.append(button);
    });
    layoutBoard();
    updateStats();
  }

  function revealCard(index) {
    if (paused || locked) return;
    const button = board.children[index];
    if (button.classList.contains('is-flipped') || button.classList.contains('is-matched')) return;
    if (!started) { started = true; startTimer(); }
    button.classList.add('is-flipped');
    const symbol = cards[index].symbol;
    button.setAttribute('aria-label', `Card ${index + 1}, ${symbol}`);
    button.querySelector('.card-front').textContent = symbol;
    flipped.push(index);
    playTone('flip');
    if (flipped.length < 2) return;

    moves += 1;
    updateStats();
    const [first, second] = flipped;
    if (cards[first].symbol === cards[second].symbol) {
      [first, second].forEach(i => {
        board.children[i].classList.add('is-matched');
        board.children[i].setAttribute('aria-label', `Matched ${cards[i].symbol}`);
        board.children[i].disabled = true;
      });
      matched += 1;
      flipped = [];
      updateStats();
      playTone('match');
      if (matched === pairsForLevel()) finishGame();
    } else {
      locked = true;
      playTone('miss');
      mismatchTimeout = window.setTimeout(() => {
        [first, second].forEach(i => {
          board.children[i].classList.remove('is-flipped');
          board.children[i].setAttribute('aria-label', `Card ${i + 1}, face down`);
        });
        flipped = [];
        locked = false;
        mismatchTimeout = null;
      }, 850);
    }
  }

  function finishGame() {
    stopTimer();
    playTone('win');
    const finalLevel = levelPairs[difficultyValue].length;
    const gameComplete = level === finalLevel;
    const newBest = savePersonalBest();
    document.querySelector('#win-eyebrow').textContent = gameComplete ? 'ALL LEVELS COMPLETE' : 'LEVEL COMPLETE';
    document.querySelector('#win-message').textContent = gameComplete
      ? 'Every pair found. What a lovely run!'
      : `Level ${level} cleared. Ready for a few more cards?`;
    if (newBest) document.querySelector('#win-message').textContent += ' New personal best!';
    document.querySelector('#final-level').textContent = `${level} / ${finalLevel}`;
    document.querySelector('#final-moves').textContent = moves;
    document.querySelector('#final-time').textContent = formatTime(seconds);
    document.querySelector('#final-accuracy').textContent = `${Math.round((matched / moves) * 100)}%`;
    document.querySelector('#play-again').innerHTML = gameComplete ? 'Play again <span>↗</span>' : 'Next level <span>↗</span>';
    modal.hidden = false;
    document.querySelector('#play-again').focus();
  }

  function setPaused(value) {
    if (modal.hidden === false) return;
    paused = value;
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.querySelector('span').textContent = paused ? 'Resume' : 'Pause';
    pauseOverlay.hidden = !paused;
    board.classList.toggle('is-paused', paused);
    if (paused) stopTimer(); else startTimer();
    if (paused) document.querySelector('#resume-overlay').focus();
    else pauseButton.focus();
  }

  document.querySelector('#new-game').addEventListener('click', () => createGame(true));
  document.querySelector('#restart').addEventListener('click', () => createGame(false));
  function setDifficulty(value) {
    difficultyValue = value;
    difficultyCurrent.textContent = value[0].toUpperCase() + value.slice(1);
    difficultyMenu.querySelectorAll('[data-difficulty-option]').forEach(option => {
      option.setAttribute('aria-selected', String(option.dataset.difficultyOption === value));
    });
    difficultyMenu.hidden = true;
    difficultyTrigger.setAttribute('aria-expanded', 'false');
    difficultyPicker.classList.remove('is-open');
    createGame(true);
  }

  function closeDifficultyMenu(returnFocus = false) {
    difficultyMenu.hidden = true;
    difficultyTrigger.setAttribute('aria-expanded', 'false');
    difficultyPicker.classList.remove('is-open');
    if (returnFocus) difficultyTrigger.focus();
  }

  function openDifficultyMenu() {
    difficultyMenu.hidden = false;
    difficultyTrigger.setAttribute('aria-expanded', 'true');
    difficultyPicker.classList.add('is-open');
    difficultyMenu.querySelector('[aria-selected="true"]')?.focus();
  }

  difficultyTrigger.addEventListener('click', () => {
    if (difficultyMenu.hidden) openDifficultyMenu();
    else closeDifficultyMenu();
  });
  difficultyPicker.addEventListener('focusout', event => {
    if (!difficultyPicker.contains(event.relatedTarget)) closeDifficultyMenu();
  });
  difficultyMenu.addEventListener('click', event => {
    const option = event.target.closest('[data-difficulty-option]');
    if (option) setDifficulty(option.dataset.difficultyOption);
  });
  difficultyMenu.addEventListener('keydown', event => {
    const options = [...difficultyMenu.querySelectorAll('[data-difficulty-option]')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length].focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      options[event.key === 'Home' ? 0 : options.length - 1].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeDifficultyMenu(true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!difficultyPicker.contains(event.target) && !difficultyMenu.hidden) closeDifficultyMenu();
  });
  pauseButton.addEventListener('click', () => setPaused(!paused));
  document.querySelector('#resume-overlay').addEventListener('click', () => setPaused(false));
  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.setAttribute('aria-label', soundEnabled ? 'Turn sound off' : 'Turn sound on');
    soundButton.title = soundEnabled ? 'Sound on' : 'Sound off';
  });
  musicButton.addEventListener('click', async () => {
    if (musicPlaying) pauseMusic(); else await startMusic();
  });
  musicVolume.addEventListener('input', () => {
    if (!musicMaster || !audioContext) return;
    musicMaster.gain.setTargetAtTime(musicPlaying ? musicLevel() : 0, audioContext.currentTime, 0.08);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && musicPlaying && audioContext?.state === 'suspended') audioContext.resume();
  });
  window.addEventListener('resize', layoutBoard);
  document.querySelector('#play-again').addEventListener('click', () => {
    const gameComplete = level === levelPairs[difficultyValue].length;
    level = gameComplete ? 1 : level + 1;
    modal.hidden = true;
    createGame();
  });
  document.querySelector('#close-modal').addEventListener('click', () => { modal.hidden = true; createGame(true); });
  modal.addEventListener('click', event => { if (event.target === modal) { modal.hidden = true; createGame(true); } });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) { modal.hidden = true; createGame(true); }
  });

  createGame();
})();
