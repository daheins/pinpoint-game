import level1 from "./levels/level1.json";

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
  target: Point;
  feedback: "hotCold";
  settings: LevelSettings;
}

// --- Virtual Resolution ---
const VIRTUAL_WIDTH = 1280;
const VIRTUAL_HEIGHT = 800;

// --- Setup ---
const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

const container = document.getElementById("game-container") as HTMLElement;
const sizeWarning = document.getElementById("size-warning") as HTMLElement;
container.style.width = `${VIRTUAL_WIDTH}px`;
container.style.height = `${VIRTUAL_HEIGHT}px`;

let currentLevel: Level = level1 as Level;
let mouse: Point = { x: 0, y: 0 };
let guess: Point = { x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2 };
let isDragging = false;

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

  const tooSmall = window.innerWidth < VIRTUAL_WIDTH || window.innerHeight < VIRTUAL_HEIGHT;

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

// --- Game Loop ---
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // scale drawing so virtual space fits canvas
  ctx.save();
  ctx.scale(canvas.width / VIRTUAL_WIDTH, canvas.height / VIRTUAL_HEIGHT);

  const target = currentLevel.target;
  const dist = distance(guess, target);
  const maxDist = Math.sqrt(VIRTUAL_WIDTH ** 2 + VIRTUAL_HEIGHT ** 2);

  const color = getHotColdColor(
    dist,
    maxDist,
    currentLevel.settings.targetColor,
    currentLevel.settings.farColor
  );

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  // draw guess X
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(guess.x - 10, guess.y - 10);
  ctx.lineTo(guess.x + 10, guess.y + 10);
  ctx.moveTo(guess.x + 10, guess.y - 10);
  ctx.lineTo(guess.x - 10, guess.y + 10);
  ctx.stroke();

  if (dist < currentLevel.settings.radius) {
    ctx.fillStyle = "white";
    ctx.font = "40px sans-serif";
    ctx.fillText("You found it!", VIRTUAL_WIDTH / 2 - 100, VIRTUAL_HEIGHT / 2);
  }

  ctx.restore();
  requestAnimationFrame(loop);
}

loop();

// update guess only on mousedown
canvas.addEventListener("mousedown", () => {
  // mouse is already mapped to virtual space via mousemove
  isDragging = true;
  guess.x = mouse.x;
  guess.y = mouse.y;
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});