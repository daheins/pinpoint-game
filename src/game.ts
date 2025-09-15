// Import level types and utilities
import type { Point } from './level';
import { Level, LevelManager, LevelRenderer } from './level';

// Import game parameters
import { TABLET_WIDTH, TABLET_HEIGHT } from './gameParams';

// Import debug utilities
import { createCurveDistanceDisplay, createCoordinateDisplay, createTargetCircle } from './game_debug';

// Import dialog manager
import { DialogManager } from './dialogManager';

import { Application, Container, Graphics, Text, Sprite } from "pixi.js";

// Function to load all levels from consolidated levels file
async function loadLevels(): Promise<Level[]> {
  try {
    const url = `${import.meta.env.BASE_URL}levels.json`;
    const response = await fetch(url);
    
    if (response.ok) {
      const levelsData = await response.json();
      const levels: Level[] = [];
      
      // Convert the object to an array of levels, sorted by key
      const sortedKeys = Object.keys(levelsData).sort((a, b) => parseInt(a) - parseInt(b));
      
      for (const key of sortedKeys) {
        const levelData = levelsData[key];
        // Add the id from the key
        levelData.id = parseInt(key);
        levels.push(new Level(levelData));
      }
      
      return levels;
    } else {
      console.error(`Failed to load levels: ${response.status}`);
      return [];
    }
  } catch (error) {
    console.error('Error loading levels:', error);
    return [];
  }
}

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

const gameContainer = new Container();
const imageContainer = new Container();
const uiContainer = new Container();
const dialogContainer = new Container();
const gradientContainer = new Container();

let levelRenderer: LevelRenderer;
let dialogManager: DialogManager;
let levelManager: LevelManager;

let levels: Level[] = [];
let currentLevel: Level;
let mouse: Point = { x: 0, y: 0 };
let guess: Point = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
let isDragging = false;
let isMouseButtonPressed = false;
let successStartMs: number | null = null;
let successMessageVisible = false;
let crosshairGraphics: Graphics | null = null;
let curveCursorSprite: Sprite | null = null;
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
  
  if (currentLevel.hideCanvas) {
    gameContainer.visible = false;
  } else {
    gameContainer.visible = true;
  }
  
  // Clear previous curve cursor sprite from UI container
  if (curveCursorSprite) {
    uiContainer.removeChild(curveCursorSprite);
    curveCursorSprite = null;
  }
  
  // Load level using the renderer
  await levelRenderer.loadLevel(currentLevel);
  
  // Move curve cursor sprite from background container to UI container if it exists
  const newCurveCursorSprite = levelRenderer.getCurveCursorSprite();
  if (newCurveCursorSprite) {
    // Remove from image container and add to UI container
    imageContainer.removeChild(newCurveCursorSprite);
    uiContainer.addChild(newCurveCursorSprite);
    curveCursorSprite = newCurveCursorSprite;
  }
  
  // Reset game state - set initial guess to middle for curve cursor levels
  if (currentLevel.curveCursor) {
    guess = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
  } else {
    guess = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
  }
  successStartMs = null;
  successMessageVisible = false;
  
  // Show dialog if level has dialog text
  if (currentLevel.dialogText && currentLevel.dialogText.length > 0) {
    await dialogManager.showDialog(currentLevel.dialogText, currentLevel.dialogCharacterImage);
  }
  
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
  // Initialize PIXI.js
  await app.init({
    canvas: canvas,
    width: TABLET_WIDTH,
    height: TABLET_HEIGHT,
    backgroundAlpha: 0,
    antialias: true
  });
  
  // Set up PIXI containers
  app.stage.addChild(gameContainer);
  app.stage.addChild(dialogContainer);
  gameContainer.addChild(gradientContainer);
  gameContainer.addChild(imageContainer);
  gameContainer.addChild(uiContainer);
  
  // Initialize level renderer
  levelRenderer = new LevelRenderer(app, imageContainer, gradientContainer, TABLET_WIDTH, TABLET_HEIGHT);
  
  // Initialize dialog manager
  dialogManager = new DialogManager(dialogContainer);
  
  // Load levels
  levels = await loadLevels();
  levelManager = new LevelManager(levels);
  currentLevel = levelManager.getCurrentLevel();
  
  // Initialize level selector and display
  createLevelSelector();
  levelNameDisplay.textContent = currentLevel.displayName;

  // Load initial level
  await loadLevel(0);
  
  // Start PIXI.js ticker after everything is initialized
  app.ticker.add(gameLoop);
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

  // Update crosshair (only if level should show crosshair)
  if (currentLevel.shouldShowCrosshair()) {
    createCrosshair();
  } else if (crosshairGraphics) {
    // Remove crosshair if it exists but shouldn't be shown
    uiContainer.removeChild(crosshairGraphics);
    crosshairGraphics = null;
  }
  
  // Update curve cursor (only if level has curve cursor)
  if (currentLevel.curveCursor && curveCursorSprite) {
    // Curve cursor position is updated in levelRenderer.drawLevel()
    // No additional action needed here
  } else if (curveCursorSprite) {
    // Remove curve cursor if it exists but shouldn't be shown
    uiContainer.removeChild(curveCursorSprite);
    curveCursorSprite = null;
  }
  
  // Update debug displays
  createCurveDistanceDisplay(uiContainer, currentLevel, guess, levelRenderer);
  createCoordinateDisplay(uiContainer, currentLevel, guess);
  createTargetCircle(uiContainer, currentLevel);

  // Check for success only when mouse is not pressed
  if (!isMouseButtonPressed && successStartMs === null && currentLevel) {
    const target = {
      x: (currentLevel.target.x / 100) * TABLET_WIDTH,
      y: (currentLevel.target.y / 100) * TABLET_HEIGHT
    };
    const wasFound = levelManager.isGuessSuccessful(guess, target, currentLevel.targetRadius);
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
  
  // Hide cursor when dragging
  canvas.style.cursor = 'none';
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
  isMouseButtonPressed = false;
  
  // Show cursor again when not dragging
  canvas.style.cursor = 'default';
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
  
  // Show cursor again when mouse leaves canvas
  canvas.style.cursor = 'default';
});

canvas.addEventListener("mouseenter", () => {
  // If mouse button is still pressed when entering canvas, resume dragging
  if (isMouseButtonPressed) {
    isDragging = true;
    guess.x = mouse.x;
    guess.y = mouse.y;
    
    // Hide cursor if resuming drag
    canvas.style.cursor = 'none';
  } else {
    // Show cursor if not dragging
    canvas.style.cursor = 'default';
  }
});

// Global mouseup listener to catch mouse releases that happen off-canvas
document.addEventListener("mouseup", () => {
  isMouseButtonPressed = false;
  isDragging = false;
  
  // Show cursor again when mouse is released anywhere
  canvas.style.cursor = 'default';
});