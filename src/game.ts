// Function to dynamically load all level files from public directory
console.log('Game script loaded successfully!');

async function loadLevels(): Promise<Level[]> {
  console.log('Starting to load levels...');
  const levelFiles = [
    'level1.json',
    'level2.json', 
    'level3.json',
    'level4.json',
    'level5.json',
    'level6.json'
  ];
  
  const levels: Level[] = [];
  
  for (const filename of levelFiles) {
    try {
      const url = `${import.meta.env.BASE_URL}levels/${filename}`;
      console.log(`Fetching level: ${url}`);
      const response = await fetch(url);
      
      if (response.ok) {
        const levelData = await response.json();
        levels.push(levelData);
        console.log(`Successfully loaded level: ${filename}`);
      } else {
        console.warn(`Failed to load level: ${filename} - Status: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error loading level ${filename}:`, error);
    }
  }
  console.log(`Total levels loaded: ${levels.length}`);
  return levels;
}

// Import level types and utilities
import type { Point, Level } from './level';
import { LevelManager, LevelRenderer } from './level';

// Import game parameters
import { TABLET_WIDTH, TABLET_HEIGHT, showDebugTools } from './gameParams';

import { Application, Container, Graphics, Text } from "pixi.js";
// import { createMinimalFilter } from './multiImageFilter';

// --- Level Renderer ---
let levelRenderer: LevelRenderer;

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

// Initialize level renderer
levelRenderer = new LevelRenderer(app, backgroundContainer, TABLET_WIDTH, TABLET_HEIGHT);

// Available levels - dynamically loaded from levels folder and sorted by ID
let levels: Level[] = [];
let levelManager: LevelManager;
let currentLevel: Level;
let mouse: Point = { x: 0, y: 0 };
let guess: Point = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
let isDragging = false;
let isMouseButtonPressed = false;
let successStartMs: number | null = null;
let successMessageVisible = false;
let crosshairGraphics: Graphics | null = null;
let successText: Text | null = null;
let coordinateDisplay: Text | null = null;
let targetCircle: Graphics | null = null;

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
  
  // Load level using the renderer
  await levelRenderer.loadLevel(currentLevel);
  
  // Reset game state
  guess = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
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

function createCrosshair() {
  if (crosshairGraphics) {
    uiContainer.removeChild(crosshairGraphics);
  }
  
  crosshairGraphics = new Graphics();
  crosshairGraphics.setStrokeStyle({ width: 3, color: isDragging ? 0xffffff : 0x000000 });
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
  
  const text = new Text({
    text: "You found me!",
    style: {
      fontFamily: 'Arial',
      fontSize: 40,
      fill: 0xADD8E6,
      align: 'center'
    }
  });
  
  // Set anchor to center for proper centering
  text.anchor.set(0.5, 0.5);
  
  // Create background rectangle for better visibility
  const backgroundGraphics = new Graphics();
  const padding = 20;
  const bgWidth = text.width + (padding * 2);
  const bgHeight = text.height + (padding * 2);
  
  backgroundGraphics.rect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
  backgroundGraphics.fill({ color: 0x000000, alpha: 0.7 });
  backgroundGraphics.stroke({ width: 2, color: 0xADD8E6, alpha: 0.8 });
  
  // Add background to text container
  const textContainer = new Container();
  textContainer.addChild(backgroundGraphics);
  textContainer.addChild(text);
  textContainer.x = TABLET_WIDTH / 2;
  textContainer.y = TABLET_HEIGHT / 2;
  
  uiContainer.addChild(textContainer);
  
  // Store reference to the container
  successText = textContainer as any;
}

function createCoordinateDisplay() {
  if (coordinateDisplay) {
    uiContainer.removeChild(coordinateDisplay);
  }
  
  if (showDebugTools && currentLevel) {
    const activePercentageGuess = {
      x: (guess.x / TABLET_WIDTH) * 100,
      y: (guess.y / TABLET_HEIGHT) * 100,
    };
    
    const text = new Text({
      text: `(x: ${activePercentageGuess.x.toFixed(1)}, y: ${activePercentageGuess.y.toFixed(1)})`,
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xFFFFFF,
        align: 'right'
      }
    });
    
    // Create background rectangle
    const backgroundGraphics = new Graphics();
    const padding = 8;
    const bgWidth = text.width + (padding * 2);
    const bgHeight = text.height + (padding * 2);
    
    backgroundGraphics.rect(0, 0, bgWidth, bgHeight);
    backgroundGraphics.fill({ color: 0x000000, alpha: 0.7 });
    backgroundGraphics.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.5 });
    
    // Create container for background and text
    const coordinateContainer = new Container();
    coordinateContainer.addChild(backgroundGraphics);
    coordinateContainer.addChild(text);
    
    // Position text within the container
    text.x = padding;
    text.y = padding;
    
    // Position container in bottom right corner with some padding
    coordinateContainer.x = TABLET_WIDTH - bgWidth - 10;
    coordinateContainer.y = TABLET_HEIGHT - bgHeight - 10;
    
    uiContainer.addChild(coordinateContainer);
    coordinateDisplay = coordinateContainer as any;
  }
}

function createTargetCircle() {
  if (targetCircle) {
    uiContainer.removeChild(targetCircle);
  }
  
  if (showDebugTools && currentLevel) {
    // Convert target percentage to pixel coordinates
    const targetX = (currentLevel.target.x / 100) * TABLET_WIDTH;
    const targetY = (currentLevel.target.y / 100) * TABLET_HEIGHT;
    const radius = currentLevel.settings.radius;
    
    const circle = new Graphics();
    circle.circle(targetX, targetY, radius);
    circle.stroke({ width: 2, color: 0x0080FF, alpha: 0.8 });
    circle.fill({ color: 0x0080FF, alpha: 0.2 });
    
    uiContainer.addChild(circle);
    targetCircle = circle;
  }
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

// Initialize the game
async function initializeGame() {
  console.log('Initializing game...');
  
  // Load levels
  levels = await loadLevels();
  levelManager = new LevelManager(levels);
  currentLevel = levelManager.getCurrentLevel();
  
  console.log('Game initialized successfully!');
  
  // Initialize level selector and display
  createLevelSelector();
  levelNameDisplay.textContent = currentLevel.displayName;

  // Load initial level
  await loadLevel(0);
}

// Start the game
initializeGame().catch(error => {
  console.error('Failed to initialize game:', error);
});

// --- Game Loop ---
function gameLoop() {
  // Don't run game loop until game is initialized
  if (!currentLevel || !levelManager) {
    return;
  }

  // Always use current guess position
  const activePercentageGuess = {
    x: (guess.x / TABLET_WIDTH) * 100,
    y: (guess.y / TABLET_HEIGHT) * 100,
  };

  // Update level-specific rendering
  levelRenderer.drawLevel(activePercentageGuess, currentLevel);

  // Update crosshair (use same logic as renderer)
  createCrosshair();
  
  // Update coordinate display
  createCoordinateDisplay();
  
  // Update target circle
  createTargetCircle();

  // Check for success only when mouse is not pressed
  if (!isMouseButtonPressed && successStartMs === null && currentLevel) {
    const target = {
      x: (currentLevel.target.x / 100) * TABLET_WIDTH,
      y: (currentLevel.target.y / 100) * TABLET_HEIGHT
    };
    const wasFound = levelManager.isGuessSuccessful(guess, target, currentLevel.settings.radius);
    if (wasFound) {
      successStartMs = performance.now();
    }
  }

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
        pingGraphics.circle(guess.x, guess.y, radius);
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
  isMouseButtonPressed = true;
  successStartMs = null; // cancel any success animation while dragging
  successMessageVisible = false;
  guess.x = mouse.x;
  guess.y = mouse.y;
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
  isMouseButtonPressed = false;
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

canvas.addEventListener("mouseenter", () => {
  // If mouse button is still pressed when entering canvas, resume dragging
  if (isMouseButtonPressed) {
    isDragging = true;
    guess.x = mouse.x;
    guess.y = mouse.y;
  }
});

// Global mouseup listener to catch mouse releases that happen off-canvas
document.addEventListener("mouseup", () => {
  isMouseButtonPressed = false;
  isDragging = false;
});