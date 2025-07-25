const game = document.getElementById('game');
const player = document.getElementById('player');
const jerrycan = document.getElementById('water-level');

const lanes = [80, 160, 240];
let currentLane = 1;
let waterLevel = 0;

player.style.left = lanes[currentLane] + 'px';

let gameInterval = null;
let gamePaused = true;
const startPauseBtn = document.getElementById('start-pause-btn');
const restartBtn = document.getElementById('restart-btn');

// Track all active items and their intervals
let activeItems = [];

let timer = 60;
let timerInterval = null;
let timerStartTimestamp = null;
const timerDisplay = document.getElementById('timer') || document.getElementById('top-timer');
let finishLineActive = false;
let finishLineReleased = false;
let finishLineObj = null;
let finishLineLeadTime = null; // seconds before timer=0 to start finish line

function calculateFinishLineLeadTime() {
  // Distance from top of game to player
  const gameRect = game.getBoundingClientRect();
  const playerRect = player.getBoundingClientRect();
  // The finish line starts at -40px (its top), so distance is from -40 to playerRect.top relative to gameRect.top
  const finishLineStart = -40;
  const playerY = player.offsetTop; // relative to #game
  const distance = playerY - finishLineStart;
  const speed = 4; // px per frame
  const interval = 50; // ms per frame
  const frames = distance / speed;
  const seconds = (frames * interval) / 1000;
  return seconds;
}

function spawnItem() {
  if (finishLineActive || finishLineReleased) return;
  const settings = getDifficultySettings();
  const item = document.createElement('div');
  const lane = Math.floor(Math.random() * 3);
  // Weighted random for item type
  let type;
  const rand = Math.random();
  if (selectedDifficulty === 1) {
    // Easy mode: only clean and contaminated
    type = rand < 0.8 ? 'clean' : 'contaminated';
  } else {
    if (rand < settings.cleanChance) {
      type = 'clean';
    } else if (rand < settings.cleanChance + settings.obstacleChance) {
      type = 'obstacle';
    } else {
      type = 'contaminated';
    }
  }
  item.classList.add('item', type);
  item.style.left = lanes[lane] + 'px';
  // Set emoji for each type
  if (type === 'clean') {
    item.textContent = '💧';
  } else if (type === 'contaminated') {
    item.textContent = '🧪';
  } else if (type === 'obstacle') {
    item.textContent = '🪨';
  }
  item.style.fontSize = '1.6em';
  item.style.textAlign = 'center';
  item.style.lineHeight = '30px';
  game.appendChild(item);
  let position = 0;
  const speed = 4;
  function moveItem() {
    position += speed;
    item.style.top = position + 'px';
    const itemRect = item.getBoundingClientRect();
    const playerRect = player.getBoundingClientRect();
    const overlapping =
      itemRect.bottom >= playerRect.top &&
      itemRect.left === playerRect.left;
    if (overlapping) {
      handleCollision(item);
      clearInterval(interval);
      activeItems = activeItems.filter(obj => obj.item !== item);
      item.remove();
    }
    if (position > 600) {
      clearInterval(interval);
      activeItems = activeItems.filter(obj => obj.item !== item);
      item.remove();
    }
  }
  let interval = setInterval(moveItem, 50);
  activeItems.push({item, moveItem, position, interval, speed});
}

function spawnFinishLine() {
  if (finishLineReleased) return;
  finishLineActive = true;
  finishLineReleased = true;
  const finishLine = document.createElement('div');
  finishLine.className = 'finish-line-item';
  finishLine.textContent = 'FINISH';
  finishLine.style.top = '-40px';
  game.appendChild(finishLine);
  let position = -40;
  const speed = 4;
  let finished = false;
  function moveFinishLine() {
    if (finished) return;
    position += speed;
    finishLine.style.top = position + 'px';
    if (finishLineObj) finishLineObj.position = position;
    const finishRect = finishLine.getBoundingClientRect();
    const playerRect = player.getBoundingClientRect();
    const overlapping =
      finishRect.bottom >= playerRect.top &&
      finishRect.left < playerRect.right &&
      finishRect.right > playerRect.left;
    if (overlapping) {
      finished = true;
      if (finishLineObj && finishLineObj.interval) clearInterval(finishLineObj.interval);
      finishLine.remove();
      finishLineObj = null;
      stopGameCompletely();
      return;
    }
    if (position > 600) {
      finished = true;
      if (finishLineObj && finishLineObj.interval) clearInterval(finishLineObj.interval);
      finishLine.remove();
      finishLineObj = null;
      stopGameCompletely();
      return;
    }
  }
  let interval = setInterval(moveFinishLine, 50);
  finishLineObj = {elem: finishLine, position, speed, interval, move: moveFinishLine};
}

function pauseAllItems() {
  activeItems.forEach(obj => {
    clearInterval(obj.interval);
    obj.interval = null;
  });
  if (finishLineObj && finishLineObj.interval) {
    clearInterval(finishLineObj.interval);
    finishLineObj.interval = null;
  }
}

function resumeAllItems() {
  activeItems.forEach(obj => {
    if (!obj.interval) {
      obj.interval = setInterval(() => {
        obj.position += obj.speed;
        obj.item.style.top = obj.position + 'px';
        const itemRect = obj.item.getBoundingClientRect();
        const playerRect = player.getBoundingClientRect();
        const overlapping =
          itemRect.bottom >= playerRect.top &&
          itemRect.left === playerRect.left;
        if (overlapping) {
          handleCollision(obj.item);
          clearInterval(obj.interval);
          activeItems = activeItems.filter(o => o.item !== obj.item);
          obj.item.remove();
        }
        if (obj.position > 600) {
          clearInterval(obj.interval);
          activeItems = activeItems.filter(o => o.item !== obj.item);
          obj.item.remove();
        }
      }, 50);
    }
  });
  if (finishLineObj && !finishLineObj.interval) {
    finishLineObj.interval = setInterval(() => {
      finishLineObj.position += finishLineObj.speed;
      finishLineObj.elem.style.top = finishLineObj.position + 'px';
      const finishRect = finishLineObj.elem.getBoundingClientRect();
      const playerRect = player.getBoundingClientRect();
      const overlapping =
        finishRect.bottom >= playerRect.top &&
        finishRect.left < playerRect.right &&
        finishRect.right > playerRect.left;
      if (overlapping) {
        clearInterval(finishLineObj.interval);
        finishLineObj.elem.remove();
        finishLineObj = null;
        stopGameCompletely();
      }
      if (finishLineObj.position > 600) {
        clearInterval(finishLineObj.interval);
        finishLineObj.elem.remove();
        finishLineObj = null;
        stopGameCompletely();
      }
    }, 50);
  }
}

function disablePlayerMovement() {
  document.removeEventListener('keydown', playerMoveHandler);
}
function enablePlayerMovement() {
  document.addEventListener('keydown', playerMoveHandler);
}

function playerMoveHandler(e) {
  if (gamePaused) return;
  if (e.key === 'ArrowLeft' && currentLane > 0) {
    currentLane--;
    player.style.left = lanes[currentLane] + 'px';
  } else if (e.key === 'ArrowRight' && currentLane < 2) {
    currentLane++;
    player.style.left = lanes[currentLane] + 'px';
  }
}
disablePlayerMovement();

// Touch swipe support for mobile
let touchStartX = null;
let touchStartY = null;

game.addEventListener('touchstart', function(e) {
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
});
game.addEventListener('touchend', function(e) {
  if (touchStartX === null || touchStartY === null) return;
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
    // Horizontal swipe
    if (dx < 0 && currentLane > 0 && !gamePaused) {
      // Swipe left
      currentLane--;
      player.style.left = lanes[currentLane] + 'px';
    } else if (dx > 0 && currentLane < 2 && !gamePaused) {
      // Swipe right
      currentLane++;
      player.style.left = lanes[currentLane] + 'px';
    }
  }
  touchStartX = null;
  touchStartY = null;
});

function handleCollision(item) {
  const settings = getDifficultySettings();
  if (item.classList.contains('clean')) {
    waterLevel = Math.min(settings.winWater, waterLevel + 10);
  } else if (item.classList.contains('contaminated')) {
    waterLevel = Math.max(0, waterLevel - 10);
  }
  jerrycan.style.height = (waterLevel/settings.winWater*100) + '%';
  // Remove item from DOM immediately
  if (item.parentNode) {
    item.parentNode.removeChild(item);
  }
  if (waterLevel >= settings.winWater) {
    stopGameCompletely();
  }
}

function endGame() {
  spawnFinishLine();
}

function stopGameCompletely() {
  // Stop all item intervals
  activeItems.forEach(obj => {
    if (obj.interval) clearInterval(obj.interval);
    obj.item.remove();
  });
  activeItems = [];
  // Stop finish line interval if any
  if (typeof finishLineObj !== 'undefined' && finishLineObj && finishLineObj.interval) {
    clearInterval(finishLineObj.interval);
    if (finishLineObj.elem) finishLineObj.elem.remove();
    finishLineObj = null;
  }
  // Stop game logic
  pauseGame();
  stopTimer();
  finishLineActive = false;
  startPauseBtn.disabled = true;
  restartBtn.disabled = false;
  disablePlayerMovement();
  showEndModal();
}

function showEndModal() {
  const settings = getDifficultySettings();
  const modal = document.getElementById('end-modal');
  const message = document.getElementById('end-message');
  const nextLevelBtn = document.getElementById('next-level-btn');
  const returnHomeBtn = document.getElementById('return-home-btn');
  const charityLink = document.getElementById('charity-link');
  const failFlash = document.getElementById('fail-flash');
  const jerrycanImg = document.getElementById('end-jerrycan-img');
  jerrycanImg.style.display = 'block';
  jerrycanImg.style.margin = '0 auto 16px auto';
  jerrycanImg.style.display = 'block';
  jerrycanImg.style.width = '80px';

  if (waterLevel >= settings.winWater) {
    if (selectedDifficulty === 3) {
      message.innerHTML = '<strong>Congratulations! You’ve completed the game!</strong><br>Thank you for playing and supporting clean water. <br><a href="https://www.charitywater.org/" target="_blank" style="color:#FFC907;text-decoration:underline;">Learn more or support charity: water</a>';
      nextLevelBtn.style.display = 'none';
    } else {
      message.textContent = 'Well done! Clean water reached the village.';
      nextLevelBtn.style.display = '';
      nextLevelBtn.onclick = () => {
        let next = selectedDifficulty + 1;
        if (next > 3) next = 1;
        selectedDifficulty = next;
        modal.style.display = 'none';
        resetGame();
        startGame();
      };
    }
    if (window.confetti) {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 }
      });
    }
    setTimeout(() => {
      modal.style.display = 'flex';
    }, 2000);
  } else {
    message.textContent = 'Try again! The jerrycan was not full.';
    nextLevelBtn.style.display = 'none';
    if (failFlash) {
      failFlash.style.display = 'block';
      failFlash.style.animation = 'fail-flash 1.5s';
      setTimeout(() => {
        failFlash.style.display = 'none';
        failFlash.style.animation = 'none';
        modal.style.display = 'flex';
      }, 2000);
    } else {
      modal.style.display = 'flex';
    }
  }
  returnHomeBtn.onclick = () => {
    modal.style.display = 'none';
    showView('homepage-view');
  };
  charityLink.onclick = () => {
    window.open('https://www.charitywater.org/', '_blank');
  };
}

let selectedDifficulty = 2; // Default to Normal

function showView(viewId) {
  document.getElementById('homepage-view').classList.remove('active');
  document.getElementById('homepage-view').style.display = 'none';
  document.getElementById('game-view').classList.remove('active');
  document.getElementById('game-view').style.display = 'none';
  document.getElementById(viewId).classList.add('active');
  document.getElementById(viewId).style.display = '';
  // Update game title with village if showing game view
  if (viewId === 'game-view') {
    const gameTitle = document.querySelector('#game-view .game-title');
    let village = '';
    if (selectedDifficulty === 1) village = ' – Village 1';
    else if (selectedDifficulty === 2) village = ' – Village 2';
    else if (selectedDifficulty === 3) village = ' – Village 3';
    if (gameTitle) gameTitle.textContent = 'Water Run: The Clean Quest' + village;
  }
}

// Homepage Start Game buttons
const startVillageBtns = document.querySelectorAll('.start-village-btn');
startVillageBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    const village = btn.closest('.village');
    selectedDifficulty = parseInt(village.getAttribute('data-difficulty'));
    showView('game-view');
    resetGame();
    startGame();
  });
});

// Difficulty settings for game
function getDifficultySettings() {
  if (selectedDifficulty === 1) {
    // Easy: More clean water, fewer points to win, more time, fewer obstacles
    return {
      spawnRate: 900, // faster item spawn
      obstacleChance: 0.15, // fewer obstacles
      cleanChance: 0.7, // more clean water
      timer: 70, // more time
      winWater: 50 // fewer points to win
    };
  } else if (selectedDifficulty === 2) {
    // Normal: Default settings
    return {
      spawnRate: 1200,
      obstacleChance: 0.35,
      cleanChance: 0.5,
      timer: 45,
      winWater: 80
    };
  } else {
    // Hard: More obstacles, more points to win, less time, fewer clean water
    return {
      spawnRate: 800, // faster item spawn
      obstacleChance: 0.5, // more obstacles
      cleanChance: 0.3, // fewer clean water
      timer: 30, // less time
      winWater: 120 // more points to win
    };
  }
}

function startTimer() {
  timer = 60;
  timerStartTimestamp = Date.now();
  updateTimerDisplay(60 * 1000);
  if (timerInterval) clearInterval(timerInterval);
  finishLineLeadTime = calculateFinishLineLeadTime();
  let finishLineStarted = false;
  timerInterval = setInterval(() => {
    if (!gamePaused) {
      const elapsed = Date.now() - timerStartTimestamp;
      const remaining = Math.max(0, 60 * 1000 - elapsed);
      updateTimerDisplay(remaining);
      const secondsLeft = Math.ceil(remaining / 1000);
      if (!finishLineStarted && secondsLeft <= Math.ceil(finishLineLeadTime)) {
        finishLineStarted = true;
        spawnFinishLine();
      }
      if (remaining <= 0) {
        clearInterval(timerInterval);
      }
    }
  }, 33); // ~30fps for smooth ms
}

function updateTimerDisplay(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(2, '0')}`;
  if (timerDisplay) timerDisplay.textContent = formatted;
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function startGame() {
  const settings = getDifficultySettings();
  if (!gameInterval) {
    gameInterval = setInterval(spawnItem, settings.spawnRate);
  }
  gamePaused = false;
  startPauseBtn.textContent = 'Pause';
  resumeAllItems();
  enablePlayerMovement();
  timer = settings.timer;
  startTimer();
}

function pauseGame() {
  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }
  gamePaused = true;
  startPauseBtn.textContent = 'Start';
  pauseAllItems();
  disablePlayerMovement();
}

function resetGame() {
  activeItems.forEach(obj => {
    if (obj.interval) clearInterval(obj.interval);
    obj.item.remove();
  });
  activeItems = [];
  currentLane = 1;
  player.style.left = lanes[currentLane] + 'px';
  waterLevel = 0;
  jerrycan.style.height = waterLevel + '%';
  pauseGame();
  stopTimer();
  timerDisplay.textContent = 10;
  finishLineActive = false;
  finishLineReleased = false;
  startPauseBtn.disabled = false;
  restartBtn.disabled = false;
  if (finishLineObj && finishLineObj.interval) clearInterval(finishLineObj.interval);
  if (finishLineObj && finishLineObj.elem) finishLineObj.elem.remove();
  finishLineObj = null;
}

startPauseBtn.addEventListener('click', () => {
  if (gamePaused) {
    startGame();
  } else {
    pauseGame();
  }
});

restartBtn.addEventListener('click', () => {
  resetGame();
  startGame();
});