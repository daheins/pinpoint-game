// Dynamically import all level files
const levelModules = import.meta.glob('./levels/*.json', { eager: true });

// Import level types and utilities
import type { Point, Level } from './level';
import { LevelManager } from './level';

// --- Virtual Resolution ---
const TABLET_WIDTH = 1440;
const TABLET_HEIGHT = 810;

// --- Setup ---
const canvas = document.getElementById("tablet-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

const container = document.getElementById("game-container") as HTMLElement;
const sizeWarning = document.getElementById("size-warning") as HTMLElement;
const levelNameDisplay = document.getElementById("level-name") as HTMLElement;
const levelGrid = document.getElementById("level-grid") as HTMLElement;
container.style.width = `${TABLET_WIDTH}px`;
container.style.height = `${TABLET_HEIGHT}px`;

// Available levels - dynamically loaded from levels folder and sorted by ID
const levels: Level[] = Object.values(levelModules)
  .map(module => (module as any).default as Level);
const levelManager = new LevelManager(levels);
let currentLevel: Level = levelManager.getCurrentLevel();
let mouse: Point = { x: 0, y: 0 };
let guess: Point = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
let isDragging = false;
let committedGuess: Point = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
let successStartMs: number | null = null;
let successMessageVisible = false;
let backgroundImage: HTMLImageElement | null = null;

// --- Level Management ---
function createLevelSelector() {
  levelGrid.innerHTML = "";
  
  levelManager.getAllLevels().forEach((level, index) => {
    const levelBox = document.createElement("div");
    levelBox.className = "level-box";
    levelBox.textContent = level.id.toString();
    levelBox.addEventListener("click", () => loadLevel(index));
    
    if (level.id === currentLevel.id) {
      levelBox.classList.add("active");
    }
    
    levelGrid.appendChild(levelBox);
  });
}

function loadLevel(levelIndex: number) {
  currentLevel = levelManager.loadLevel(levelIndex);
  levelNameDisplay.textContent = currentLevel.displayName;
  
  // Load background image if level has one
  if (currentLevel.image) {
    backgroundImage = new Image();
    backgroundImage.onload = () => {
      // Image loaded successfully
    };
    backgroundImage.onerror = () => {
      console.error(`Failed to load image: /images/${currentLevel.image}`);
      backgroundImage = null;
    };
    backgroundImage.src = `/images/${currentLevel.image}`;
  } else {
    backgroundImage = null;
  }
  
  // Reset game state
  guess = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
  committedGuess = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
  successStartMs = null;
  successMessageVisible = false;
  
  // Update active level in selector
  document.querySelectorAll(".level-box").forEach((box, index) => {
    if (index === levelIndex) {
      box.classList.add("active");
    } else {
      box.classList.remove("active");
    }
  });
}

// --- Helpers ---
function drawWarpedImage(targetX: number, targetY: number, playerX: number, playerY: number) {
  if (!backgroundImage || !backgroundImage.complete) return;

  // console.log(`target: ${targetX}, ${targetY}, player: ${playerX}, ${playerY}`);

  const dx = Math.abs(playerX - targetX);
  const dy = Math.abs(playerY - targetY);

  // Scale warp strength — tweak these numbers to taste
  const wavelength = 5;      // controls frequency of waves
  const ampX = dx / 10; // stronger warp if farther away
  const ampY = dy / 10;

  // // --- Horizontal wave (slice image into horizontal strips) ---
  // const sliceHeight = 4; // thinner = smoother but more CPU
  // for (let y = 0; y < TABLET_HEIGHT; y += sliceHeight) {
  //   const offsetX = ampX * Math.sin(y / wavelength);
  //   ctx.drawImage(
  //     backgroundImage,
  //     0, y, TABLET_WIDTH, sliceHeight,   // source slice
  //     offsetX, y, TABLET_HEIGHT, sliceHeight // destination shifted slice
  //   );
  // }

  // // --- Vertical wave (slice image into vertical strips) ---
  // const sliceWidth = 20;
  // for (let x = 0; x < TABLET_WIDTH; x += sliceWidth) {
  //   const offsetY = ampY * Math.sin(x / wavelength);
  //   ctx.drawImage(
  //     backgroundImage,
  //     x, 0, sliceWidth, TABLET_HEIGHT,   // source slice
  //     x, offsetY, sliceWidth, TABLET_HEIGHT // destination shifted slice
  //   );
  // }
  
  // --- Combined warp (slice by rows) ---
  const sliceHeight = 4;
  for (let y = 0; y < TABLET_HEIGHT; y += sliceHeight) {
    // Horizontal offset depends on Y
    const offsetX = ampX * Math.sin(y / wavelength);

    // Vertical offset depends on X distance — but we only have y here
    // Trick: add a secondary sine to vary vertical shift by row
    const offsetY = ampY * Math.sin((y + playerX) / wavelength);

    ctx.drawImage(
      backgroundImage,
      0, y, TABLET_WIDTH, sliceHeight,          // source slice
      offsetX, y + offsetY, TABLET_WIDTH, sliceHeight // destination
    );
  }
}

// --- Resize Handling ---
function resizeCanvas() {
  canvas.width = TABLET_WIDTH;
  canvas.height = TABLET_HEIGHT;

  // Calculate total game container height: level-name + tablet-canvas
  const levelNameHeight = 40; // Approximate height of level-name (padding + font + border)
  const totalGameHeight = levelNameHeight + TABLET_HEIGHT;
  const totalGameWidth = TABLET_WIDTH;

  const tooSmall = window.innerWidth < totalGameWidth || window.innerHeight < totalGameHeight;

  if (tooSmall) {
    container.style.display = "none";
    sizeWarning.style.display = "block";
  } else {
    container.style.display = "flex";
    sizeWarning.style.display = "none";
  }
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Initialize level selector and display
createLevelSelector();
levelNameDisplay.textContent = currentLevel.displayName;

// --- Game Loop ---
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // scale drawing so virtual space fits canvas
  ctx.save();
  ctx.scale(canvas.width / TABLET_WIDTH, canvas.height / TABLET_HEIGHT);

  const activeGuess = isDragging ? guess : committedGuess;
  const activePercentageGuess = {
    x: (activeGuess.x / TABLET_WIDTH) * 100,
    y: (activeGuess.y / TABLET_HEIGHT) * 100,
  }
  const dist = levelManager.distance(activePercentageGuess, currentLevel.target);
  const maxDist = Math.sqrt(100 ** 2 + 100 ** 2);

  const t = Math.min(dist / maxDist, 1);
  const v = Math.round(255 * (1 - t));
  const color = `rgb(${v}, ${v}, ${v})`;

  // Draw background image if available
  if (backgroundImage && backgroundImage.complete) {
    drawWarpedImage(currentLevel.target.x, currentLevel.target.y, activePercentageGuess.x, activePercentageGuess.y);
  } else {
    // Draw color background if no image
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, TABLET_WIDTH, TABLET_HEIGHT);
  }

  // draw guess X (white while dragging, black when dropped)
  ctx.strokeStyle = isDragging ? "white" : "black";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(guess.x - 12, guess.y - 12);
  ctx.lineTo(guess.x + 12, guess.y + 12);
  ctx.moveTo(guess.x + 12, guess.y - 12);
  ctx.lineTo(guess.x - 12, guess.y + 12);
  ctx.stroke();

  // success feedback: two quick pings, then show text
  if (successStartMs !== null) {
    const now = performance.now();
    const elapsed = now - successStartMs;

    // Three pulses: small, medium, big (final uses current size)
    const pulses = [
      { start: 0, duration: 500, maxR: 15 },
      { start: 1000, duration: 500, maxR: 30 },
      { start: 2000, duration: 500, maxR: 50 },
    ];

    const drawPing = (tStart: number, duration: number, maxR: number) => {
      const t = Math.min((elapsed - tStart) / duration, 1);
      const radius = 10 + t * maxR;
      const alpha = 1 - t;
      ctx.save();
      ctx.strokeStyle = `rgba(173,216,230,${alpha.toFixed(3)})`;
      ctx.lineWidth = 4 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(committedGuess.x, committedGuess.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    for (const p of pulses) {
      if (elapsed >= p.start && elapsed <= p.start + p.duration) {
        drawPing(p.start, p.duration, p.maxR);
      }
    }

    if (elapsed > pulses[pulses.length - 1].start + pulses[pulses.length - 1].duration) {
      successMessageVisible = true;
    }
  }

  if (successMessageVisible) {
    ctx.fillStyle = "rgb(173, 216, 230)";
    ctx.font = "40px sans-serif";
    ctx.fillText("You found me!", TABLET_WIDTH / 2 - 100, TABLET_HEIGHT / 2);
  }

  ctx.restore();
  requestAnimationFrame(loop);
}

loop();

// update guess only on mousedown and support drag-to-move
canvas.addEventListener("mousedown", () => {
  // mouse is already mapped to virtual space via mousemove
  isDragging = true;
  successStartMs = null; // cancel any success animation while dragging
  successMessageVisible = false;
  guess.x = mouse.x;
  guess.y = mouse.y;
});

// --- Input (map to virtual space) ---
canvas.addEventListener("mousemove", (e: MouseEvent) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = TABLET_WIDTH / rect.width;
  const scaleY = TABLET_HEIGHT / rect.height;

  mouse.x = (e.clientX - rect.left) * scaleX;
  mouse.y = (e.clientY - rect.top) * scaleY;

  if (isDragging) {
    guess.x = mouse.x;
    guess.y = mouse.y;
  }
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
  committedGuess.x = guess.x;
  committedGuess.y = guess.y;

  // Check success only on drop
  const target = {
    x: (currentLevel.target.x / 100) * TABLET_WIDTH,
    y: (currentLevel.target.y / 100) * TABLET_HEIGHT
  };
  const wasFound = levelManager.isGuessSuccessful(committedGuess, target, currentLevel.settings.radius);
  if (wasFound) {
    successStartMs = performance.now();
  } else {
    successStartMs = null;
    successMessageVisible = false;
  }
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});