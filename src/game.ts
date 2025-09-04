// Dynamically import all level files
const levelModules = import.meta.glob('./levels/*.json', { eager: true });

// --- Types ---
interface Point {
  x: number;
  y: number;
}

interface LevelSettings {
  targetColor: string;
  farColor: string;
  radius: number;
}

interface Level {
  id: number;
  displayName: string;
  target: Point;
  image?: string;
  feedback: "hotCold";
  settings: LevelSettings;
}

// --- Virtual Resolution ---
const VIRTUAL_WIDTH = 1440;
const VIRTUAL_HEIGHT = 810;

// --- Setup ---
const canvas = document.getElementById("tablet-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

const container = document.getElementById("game-container") as HTMLElement;
const sizeWarning = document.getElementById("size-warning") as HTMLElement;
const levelNameDisplay = document.getElementById("level-name") as HTMLElement;
const levelGrid = document.getElementById("level-grid") as HTMLElement;
container.style.width = `${VIRTUAL_WIDTH}px`;
container.style.height = `${VIRTUAL_HEIGHT}px`;

// Available levels - dynamically loaded from levels folder and sorted by ID
const levels: Level[] = Object.values(levelModules)
  .map(module => (module as any).default as Level)
  .sort((a, b) => a.id - b.id);
let currentLevel: Level = levels[0];
let mouse: Point = { x: 0, y: 0 };
let guess: Point = { x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2 };
let isDragging = false;
let committedGuess: Point = { x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2 };
let successStartMs: number | null = null;
let successMessageVisible = false;
let backgroundImage: HTMLImageElement | null = null;

// --- Level Management ---
function createLevelSelector() {
  levelGrid.innerHTML = "";
  
  levels.forEach((level, index) => {
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
  currentLevel = levels[levelIndex];
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
  guess = { x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2 };
  committedGuess = { x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2 };
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
function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const bigint = parseInt(hex.replace("#", ""), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function getHotColdColor(
  dist: number,
  maxDist: number,
  nearColor: string,
  farColor: string
): string {
  const t = Math.min(dist / maxDist, 1);

  function blendChannel(c1: number, c2: number): number {
    return Math.round(c1 + (c2 - c1) * t);
  }

  const n = hexToRgb(nearColor);
  const f = hexToRgb(farColor);

  return `rgb(${blendChannel(n.r, f.r)}, ${blendChannel(n.g, f.g)}, ${blendChannel(n.b, f.b)})`;
}

// --- Resize Handling ---
function resizeCanvas() {
  canvas.width = VIRTUAL_WIDTH;
  canvas.height = VIRTUAL_HEIGHT;

  // Calculate total game container height: level-name + tablet-canvas
  const levelNameHeight = 40; // Approximate height of level-name (padding + font + border)
  const totalGameHeight = levelNameHeight + VIRTUAL_HEIGHT;
  const totalGameWidth = VIRTUAL_WIDTH;

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
  ctx.scale(canvas.width / VIRTUAL_WIDTH, canvas.height / VIRTUAL_HEIGHT);

  // Convert percentage coordinates to pixel coordinates
  const target = {
    x: (currentLevel.target.x / 100) * VIRTUAL_WIDTH,
    y: (currentLevel.target.y / 100) * VIRTUAL_HEIGHT
  };
  const activePoint = isDragging ? guess : committedGuess;
  const dist = distance(activePoint, target);
  const maxDist = Math.sqrt(VIRTUAL_WIDTH ** 2 + VIRTUAL_HEIGHT ** 2);

  const t = Math.min(dist / maxDist, 1);
  const v = Math.round(255 * (1 - t));
  const color = `rgb(${v}, ${v}, ${v})`;

  // Draw background image if available
  if (backgroundImage && backgroundImage.complete) {
    ctx.drawImage(backgroundImage, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  } else {
    // Draw color background if no image
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
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
    ctx.fillText("You found it!", VIRTUAL_WIDTH / 2 - 100, VIRTUAL_HEIGHT / 2);
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
  const scaleX = VIRTUAL_WIDTH / rect.width;
  const scaleY = VIRTUAL_HEIGHT / rect.height;

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
    x: (currentLevel.target.x / 100) * VIRTUAL_WIDTH,
    y: (currentLevel.target.y / 100) * VIRTUAL_HEIGHT
  };
  const wasFound = distance(committedGuess, target) < currentLevel.settings.radius;
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