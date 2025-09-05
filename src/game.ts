// Dynamically import all level files
const levelModules = import.meta.glob('./levels/*.json', { eager: true });

// Import level types and utilities
import type { Point, Level } from './level';
import { LevelManager } from './level';

import { Application, Sprite, Assets, Container, Graphics, Text, DisplacementFilter } from "pixi.js";

// --- Virtual Resolution ---
const TABLET_WIDTH = 1440;
const TABLET_HEIGHT = 810;

// --- Warp Effect Variables ---
let displacementFilter: DisplacementFilter | null = null;
let displacementSprite: Sprite | null = null;

// --- Setup ---
const canvas = document.getElementById("tablet-canvas") as HTMLCanvasElement;

const container = document.getElementById("game-container") as HTMLElement;
const sizeWarning = document.getElementById("size-warning") as HTMLElement;
const levelNameDisplay = document.getElementById("level-name") as HTMLElement;
const levelGrid = document.getElementById("level-grid") as HTMLElement;
container.style.width = `${TABLET_WIDTH}px`;
container.style.height = `${TABLET_HEIGHT}px`;

// --- PIXI.js Setup ---
const app = new Application();
await app.init({
  canvas: canvas,
  width: TABLET_WIDTH,
  height: TABLET_HEIGHT,
  backgroundColor: 0x000000,
  antialias: true
});

// Create main container
const gameContainer = new Container();
app.stage.addChild(gameContainer);

// Create background sprite container
const backgroundContainer = new Container();
gameContainer.addChild(backgroundContainer);

// Create UI container for crosshair and effects
const uiContainer = new Container();
gameContainer.addChild(uiContainer);

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
let backgroundSprite: Sprite | null = null;
let crosshairGraphics: Graphics | null = null;
let successText: Text | null = null;

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

async function loadLevel(levelIndex: number) {
  currentLevel = levelManager.loadLevel(levelIndex);
  levelNameDisplay.textContent = currentLevel.displayName;
  
  // Clear previous background
  if (backgroundSprite) {
    backgroundContainer.removeChild(backgroundSprite);
    backgroundSprite = null;
  }
  
  // Load background image if level has one
  if (currentLevel.image) {
    try {
      const texture = await Assets.load(`/images/${currentLevel.image}`);
      backgroundSprite = new Sprite(texture);
      backgroundSprite.width = TABLET_WIDTH;
      backgroundSprite.height = TABLET_HEIGHT;
      
      // Create displacement texture for warping effect
      const displacementTexture = await Assets.load(`/images/${currentLevel.image}`);
      displacementSprite = new Sprite(displacementTexture);
      displacementSprite.width = TABLET_WIDTH;
      displacementSprite.height = TABLET_HEIGHT;
      
      // Create displacement filter
      displacementFilter = new DisplacementFilter({
        sprite: displacementSprite,
        scale: 0
      });
      
      backgroundSprite.filters = [displacementFilter];
      backgroundContainer.addChild(backgroundSprite);
    } catch (error) {
      console.error(`Failed to load image: /images/${currentLevel.image}`, error);
      backgroundSprite = null;
    }
  } else {
    backgroundSprite = null;
    displacementFilter = null;
    displacementSprite = null;
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
function updateWarpFilter(playerX: number, playerY: number) {
  if (displacementFilter && displacementSprite) {
    // Calculate distance from player to target
    const distX = Math.abs(playerX - currentLevel.target.x);
    const distY = Math.abs(playerY - currentLevel.target.y);
    
    // Calculate warp strength based on distance (farther = more warp)
    const maxDist = Math.sqrt(100 ** 2 + 100 ** 2);
    const normalizedDist = Math.min(Math.sqrt(distX ** 2 + distY ** 2) / maxDist, 1);
    
    // Scale displacement based on distance (farther = more warp)
    const warpStrength = normalizedDist * 600; // Max displacement of 600 pixels
    
    // Apply position-based warping only
    const waveX = Math.sin(playerX * 0.02) * warpStrength * 0.5 +
                  Math.sin(playerY * 0.01) * warpStrength * 0.3;
    const waveY = Math.cos(playerY * 0.015) * warpStrength * 0.5 +
                  Math.cos(playerX * 0.012) * warpStrength * 0.3;
    
    // Update displacement filter
    displacementFilter.scale.x = waveX;
    displacementFilter.scale.y = waveY;
  }
}

function createCrosshair() {
  if (crosshairGraphics) {
    uiContainer.removeChild(crosshairGraphics);
  }
  
  crosshairGraphics = new Graphics();
  crosshairGraphics.lineStyle(3, isDragging ? 0xffffff : 0x000000);
  crosshairGraphics.moveTo(guess.x - 12, guess.y - 12);
  crosshairGraphics.lineTo(guess.x + 12, guess.y + 12);
  crosshairGraphics.moveTo(guess.x + 12, guess.y - 12);
  crosshairGraphics.lineTo(guess.x - 12, guess.y + 12);
  crosshairGraphics.stroke();
  
  uiContainer.addChild(crosshairGraphics);
}

function createSuccessText() {
  if (successText) {
    uiContainer.removeChild(successText);
  }
  
  successText = new Text({
    text: "You found me!",
    style: {
      fontFamily: 'Arial',
      fontSize: 40,
      fill: 0xADD8E6,
      align: 'center'
    }
  });
  successText.x = TABLET_WIDTH / 2;
  successText.y = TABLET_HEIGHT / 2;
  
  uiContainer.addChild(successText);
}

// --- Resize Handling ---
function resizeCanvas() {
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

// Load initial level
await loadLevel(0);

// --- Game Loop ---
function gameLoop() {
  const activeGuess = isDragging ? guess : committedGuess;
  const activePercentageGuess = {
    x: (activeGuess.x / TABLET_WIDTH) * 100,
    y: (activeGuess.y / TABLET_HEIGHT) * 100,
  };

  // Update warp filter with current player position
  updateWarpFilter(activePercentageGuess.x, activePercentageGuess.y);

  // Set background color if no image
  if (!backgroundSprite) {
    const dist = levelManager.distance(activePercentageGuess, currentLevel.target);
    const maxDist = Math.sqrt(100 ** 2 + 100 ** 2);
    const t = Math.min(dist / maxDist, 1);
    const v = Math.round(255 * (1 - t));
    app.renderer.background.color = (v << 16) | (v << 8) | v; // Convert to hex
  }

  // Update crosshair
  createCrosshair();

  // Handle success animation
  if (successStartMs !== null) {
    const now = performance.now();
    const elapsed = now - successStartMs;

    // Three pulses: small, medium, big (final uses current size)
    const pulses = [
      { start: 0, duration: 500, maxR: 15 },
      { start: 1000, duration: 500, maxR: 30 },
      { start: 2000, duration: 500, maxR: 50 },
    ];

    // Draw ping effects
    for (const p of pulses) {
      if (elapsed >= p.start && elapsed <= p.start + p.duration) {
        const t = Math.min((elapsed - p.start) / p.duration, 1);
        const radius = 10 + t * p.maxR;
        const alpha = 1 - t;
        
        const pingGraphics = new Graphics();
        pingGraphics.circle(committedGuess.x, committedGuess.y, radius);
        pingGraphics.stroke({ width: 4 * (1 - t) + 1, color: 0xADD8E6, alpha: alpha });
        uiContainer.addChild(pingGraphics);
        
        // Remove ping after animation
        setTimeout(() => {
          if (uiContainer.children.includes(pingGraphics)) {
            uiContainer.removeChild(pingGraphics);
          }
        }, p.duration);
      }
    }

    if (elapsed > pulses[pulses.length - 1].start + pulses[pulses.length - 1].duration) {
      successMessageVisible = true;
    }
  }

  // Show success text
  if (successMessageVisible && !successText) {
    createSuccessText();
  } else if (!successMessageVisible && successText) {
    uiContainer.removeChild(successText);
    successText = null;
  }
}

// Start PIXI.js ticker
app.ticker.add(gameLoop);

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

canvas.addEventListener("mousedown", () => {
  // mouse is already mapped to virtual space via mousemove
  isDragging = true;
  successStartMs = null; // cancel any success animation while dragging
  successMessageVisible = false;
  guess.x = mouse.x;
  guess.y = mouse.y;
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