// Import level types and utilities
import type { Point } from './level';
import { Level, LevelManager, LevelRenderer } from './level';

// Import game parameters
import { TABLET_WIDTH, TABLET_HEIGHT, ART_WIDTH, ART_HEIGHT, PICKUP_RADIUS } from './gameParams';

// Import debug utilities
import { createCurveDistanceDisplay, createCoordinateDisplay, createTargetCircle, createMultiImageTargetCircles } from './game_debug';

// Import dialog manager
import { DialogManager } from './dialogManager';

import { Application, Container, Graphics, Text, Sprite, Assets } from "pixi.js";
import { showLevelSelector } from './gameParams_debug';

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
const mainGameArea = document.getElementById("main-game-area") as HTMLElement;
const artCollectionButton = document.getElementById("art-collection-button") as HTMLElement;
const sizeWarning = document.getElementById("size-warning") as HTMLElement;
const levelNameDisplay = document.getElementById("level-name") as HTMLElement;
const levelGrid = document.getElementById("level-grid") as HTMLElement;
const levelSelector = document.getElementById("level-selector") as HTMLElement;
container.style.width = `${TABLET_WIDTH}px`;
container.style.height = `${TABLET_HEIGHT}px`;

// Toggle level selector visibility based on debug flag
if (levelSelector) {
  levelSelector.style.display = showLevelSelector ? 'flex' : 'none';
}

// --- PIXI.js Setup ---
let app: Application;

const gameContainer = new Container();
const artContainer = new Container();
const imageContainer = new Container();
const uiContainer = new Container();
const dialogContainer = new Container();
const gradientContainer = new Container();

let levelRenderer: LevelRenderer;
let dialogManager: DialogManager;
let levelManager: LevelManager;
let tabletBackgroundSprite: Sprite | null = null;

let levels: Level[] = [];
let currentLevel: Level;
let mouse: Point = { x: 0, y: 0 };
let guess: Point = { x: TABLET_WIDTH / 2, y: TABLET_HEIGHT / 2 };
let isDragging = false;
let isMouseButtonPressed = false;
let successStartMs: number | null = null;
let successMessageVisible = false;
let crosshairContainer: Container | null = null;
let crosshairSprite: Sprite | null = null;
let curveCursorSprite: Sprite | null = null;
let successText: Text | null = null;
let hasPlayerInteractedInLevel = false;
let lastInteractionTime = 0;
let isJiggling = false;
let jiggleStartTime = 0;
let isArtCollectionMode = false;
const JIGGLE_INTERVAL = 3000; // 3 seconds
const JIGGLE_DURATION = 500; // 0.5 seconds
const JIGGLE_AMPLITUDE = 8; // pixels (vertical only)
const artOriginX = (TABLET_WIDTH - ART_WIDTH) / 2;
const artOriginY = (TABLET_HEIGHT - ART_HEIGHT) / 2;

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
  // Clear any existing dialog when loading a new level
  if (dialogManager) {
    dialogManager.hideDialog();
  }
  
  currentLevel = levelManager.loadLevel(levelIndex);
  levelNameDisplay.textContent = currentLevel.displayName;

  updateArtButtonReadout(isArtCollectionMode);
  
  if (currentLevel.hideCanvas) {
    gameContainer.visible = false;
    if (tabletBackgroundSprite) {
      tabletBackgroundSprite.visible = false;
    }
    artCollectionButton.style.display = 'none';
  } else {
    gameContainer.visible = true;
    if (tabletBackgroundSprite) {
      tabletBackgroundSprite.visible = true;
    }
    artCollectionButton.style.display = 'flex';
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
  
  // Reset game state - set initial guess to middle of the art viewport
  guess = { x: ART_WIDTH / 2, y: ART_HEIGHT / 2 };
  successStartMs = null;
  successMessageVisible = false;
  hasPlayerInteractedInLevel = false;
  lastInteractionTime = performance.now(); // Initialize idle timer for new level
  isJiggling = false; // Reset jiggle state when loading new level
  
  // Update jigsaw puzzle with initial guess position if this is a jigsaw level
  if (currentLevel && currentLevel.jigsawImage && levelRenderer) {
    const initialPercentageGuess = {
      x: (guess.x / ART_WIDTH) * 100,
      y: (guess.y / ART_HEIGHT) * 100,
    };
    levelRenderer.updateJigsawPuzzle(initialPercentageGuess);
  }
  
  if (successText) {
    uiContainer.removeChild(successText);
    successText = null;
  }
  
  // Show dialog if level has dialog text
  if (currentLevel.dialogText && currentLevel.dialogText.length > 0) {
    const isDialogOnly = !!currentLevel.hideCanvas || !!currentLevel.hideCrosshair;
    await dialogManager.showDialog(
      currentLevel.dialogText, 
      currentLevel.dialogCharacterImage, 
      currentLevel.dialogPosition,
      isDialogOnly ? () => {
        // Auto-advance to next level for dialog-only levels
        const nextIndex = levelManager.getCurrentLevelIndex() + 1;
        if (nextIndex < levelManager.getLevelCount()) {
          loadLevel(nextIndex);
        }
      } : undefined
    );
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

async function initializeCrosshair() {
  try {
    const texture = await Assets.load(`${import.meta.env.BASE_URL}images/crosshair.png`);
    crosshairSprite = new Sprite(texture);
    
    // Set size to 25x25 pixels
    crosshairSprite.width = 25;
    crosshairSprite.height = 25;
    
    // Center the crosshair sprite within its container
    crosshairSprite.anchor.set(0.5, 0.5);
    crosshairSprite.x = 0; // Centered in container
    crosshairSprite.y = 0; // Centered in container
    
    // Create container for crosshair
    crosshairContainer = new Container();
    crosshairContainer.visible = false; // Start hidden, will be shown when needed
    crosshairContainer.addChild(crosshairSprite);
    
    uiContainer.addChild(crosshairContainer);
  } catch (error) {
    console.error('Failed to load crosshair image:', error);
    // Fallback to graphics-based crosshair if image fails to load
    createFallbackCrosshair();
  }
}

function createFallbackCrosshair() {
  const crosshairGraphics = new Graphics();
  crosshairGraphics.lineStyle(3, 0x000000);
  crosshairGraphics.moveTo(-12, -12);
  crosshairGraphics.lineTo(12, 12);
  crosshairGraphics.moveTo(12, -12);
  crosshairGraphics.lineTo(-12, 12);
  
  // Position graphics at center of container
  crosshairGraphics.x = 0;
  crosshairGraphics.y = 0;
  
  // Create container for crosshair
  crosshairContainer = new Container();
  crosshairContainer.visible = false; // Start hidden
  crosshairContainer.addChild(crosshairGraphics);
  
  uiContainer.addChild(crosshairContainer);
  crosshairSprite = crosshairGraphics as any; // Type compatibility for cleanup
}

function updateCrosshair() {
  if (!crosshairContainer || !crosshairSprite) return;
  
  // Update container position to match guess position
  crosshairContainer.x = guess.x;
  crosshairContainer.y = guess.y;
  
  // Update color tint based on dragging state
  crosshairSprite.tint = isDragging ? 0xFFFFFF : 0x000000;
}

function startJiggleAnimation() {
  if (!crosshairSprite || isJiggling) return;
  
  isJiggling = true;
  jiggleStartTime = performance.now();
}

function updateJiggleAnimation() {
  if (!crosshairSprite || !isJiggling) return;
  
  const currentTime = performance.now();
  const elapsed = currentTime - jiggleStartTime;
  
  if (elapsed >= JIGGLE_DURATION) {
    // Jiggle animation finished - reset sprite to center of container
    isJiggling = false;
    crosshairSprite.x = 0;
    crosshairSprite.y = 0;
    return;
  }
  
  // Calculate vertical jiggle offset using a sine wave for smooth oscillation
  const progress = elapsed / JIGGLE_DURATION;
  const frequency = 5; // How many oscillations during the jiggle
  const jiggleY = Math.sin(progress * Math.PI * frequency) * JIGGLE_AMPLITUDE * (1 - progress);
  
  // Move sprite within container (container stays at guess position)
  // Only vertical movement, no horizontal
  crosshairSprite.x = 0;
  crosshairSprite.y = jiggleY;
}

function createSuccessText(level: Level) {
  if (successText) {
    uiContainer.removeChild(successText);
  }
  
  const successString = level.isArtLevel() ? "Art recovered!" : "Complete!"

  const text = new Text(successString, {
    fontFamily: 'Chubbo, sans-serif, bold',
    fontSize: 40,
    fill: 0xADD8E6,
    align: 'center',
    fontWeight: '400',
    stroke: 0x000000,
    strokeThickness: 2,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 2,
    dropShadowDistance: 2,
    dropShadowAlpha: 0.7
  });
  
  // Configure text rendering for maximum crispness
  text.resolution = window.devicePixelRatio || 1;
  
  // Set anchor to center for proper centering
  text.anchor.set(0.5, 0.5);
  
  // Create background rectangle for better visibility
  const backgroundGraphics = new Graphics();
  const padding = 20;
  const bgWidth = text.width + (padding * 2);
  const bgHeight = text.height + (padding * 2);
  
  backgroundGraphics.beginFill(0x000000, 0.7);
  backgroundGraphics.lineStyle(2, 0xADD8E6, 0.8);
  backgroundGraphics.drawRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
  backgroundGraphics.endFill();
  
  // Add background to text container
  const textContainer = new Container();
  textContainer.addChild(backgroundGraphics);
  textContainer.addChild(text);
  textContainer.x = ART_WIDTH / 2;
  textContainer.y = ART_HEIGHT / 2;
  
  uiContainer.addChild(textContainer);
  
  // Store reference to the container
  successText = textContainer as any;
}

// --- Resize Handling ---
function resizeCanvas() {
  // Calculate total game container height: level-name + tablet-canvas
  const levelNameHeight = 40; // Approximate height of level-name (padding + font + border)
  const totalGameHeight = levelNameHeight + TABLET_HEIGHT;
  
  // Get the button's actual width and the gap from CSS
  const buttonWidth = artCollectionButton.offsetWidth;
  const gapWidth = 20; // This matches the gap in #main-game-area CSS
  const totalGameWidth = TABLET_WIDTH + buttonWidth + gapWidth;

  const tooSmall = window.innerWidth < totalGameWidth || window.innerHeight < totalGameHeight;

  if (tooSmall) {
    mainGameArea.style.display = "none";
    sizeWarning.style.display = "block";
  } else {
    mainGameArea.style.display = "flex";
    sizeWarning.style.display = "none";
  }
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Initialize the game
async function initializeGame() {
  // Initialize PIXI.js (v7 constructor style - synchronous)
  app = new Application({
    view: canvas,
    width: TABLET_WIDTH,
    height: TABLET_HEIGHT,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    forceCanvas: false // Use WebGL for filter compatibility
  });
  
  // Set up PIXI containers
  app.stage.addChild(gameContainer);
  app.stage.addChild(dialogContainer);
  gameContainer.addChild(gradientContainer);
  // Centered art container holds all art and UI drawn in art space
  artContainer.x = artOriginX;
  artContainer.y = artOriginY;
  gameContainer.addChild(artContainer);
  artContainer.addChild(imageContainer);
  artContainer.addChild(uiContainer);
  
  // Load and add persistent tablet background behind all game content (start hidden)
  try {
    const texture = await Assets.load(`${import.meta.env.BASE_URL}images/tablet-canvas.png`);
    tabletBackgroundSprite = new Sprite(texture);
    // Size to canvas and position at origin so it's always fully covered
    tabletBackgroundSprite.x = 0;
    tabletBackgroundSprite.y = 0;
    tabletBackgroundSprite.width = TABLET_WIDTH;
    tabletBackgroundSprite.height = TABLET_HEIGHT;
    tabletBackgroundSprite.visible = false; // Start hidden
    // Ensure it renders below gradient/images/UI
    gradientContainer.addChildAt(tabletBackgroundSprite, 0);
  } catch (error) {
    console.error('Failed to load tablet background image:', error);
  }
  
  // Initialize level renderer
  levelRenderer = new LevelRenderer(app, imageContainer, gradientContainer, ART_WIDTH, ART_HEIGHT);
  
  // Initialize dialog manager
  dialogManager = new DialogManager(dialogContainer);
  
  // Initialize crosshair
  await initializeCrosshair();
  
  // Load levels
  levels = await loadLevels();
  levelManager = new LevelManager(levels);
  currentLevel = levelManager.getCurrentLevel();
  
  // Initialize level selector and display
  createLevelSelector();
  levelNameDisplay.textContent = currentLevel.displayName;
  
  // Update art button readout now that levelManager is available
  updateArtButtonReadout(false);

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
    x: (guess.x / ART_WIDTH) * 100,
    y: (guess.y / ART_HEIGHT) * 100,
  };

  // Update level-specific rendering
  levelRenderer.drawLevel(activePercentageGuess, currentLevel);

  // Update crosshair (only if level should show crosshair)
  if (currentLevel.shouldShowCrosshair()) {
    if (crosshairContainer) {
      crosshairContainer.visible = true;
      updateCrosshair();
      updateJiggleAnimation();
      
      // Check if we should start a jiggle animation
      if (!isDragging && !isJiggling && !successMessageVisible) {
        const target = {
          x: (currentLevel.target.x / 100) * ART_WIDTH,
          y: (currentLevel.target.y / 100) * ART_HEIGHT
        };
        const isInCorrectPosition = levelManager.isGuessSuccessful(guess, target, (currentLevel.targetRadius / 100) * ART_HEIGHT);
        
        if (!isInCorrectPosition) {
          const currentTime = performance.now();
          if (currentTime - lastInteractionTime >= JIGGLE_INTERVAL) {
            startJiggleAnimation();
            lastInteractionTime = currentTime; // Reset timer after jiggle starts
          }
        } else {
          // If in correct position, reset the timer to prevent jiggling
          lastInteractionTime = performance.now();
        }
      }
    }
  } else if (crosshairContainer) {
    // Hide crosshair if it exists but shouldn't be shown
    crosshairContainer.visible = false;
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
  createMultiImageTargetCircles(uiContainer, currentLevel);

  // Check for success only when mouse is not pressed and level interaction began
  if (!isMouseButtonPressed && successStartMs === null && currentLevel && hasPlayerInteractedInLevel) {
    const target = {
      x: (currentLevel.target.x / 100) * ART_WIDTH,
      y: (currentLevel.target.y / 100) * ART_HEIGHT
    };
    const wasFound = levelManager.isGuessSuccessful(guess, target, (currentLevel.targetRadius / 100) * ART_HEIGHT);
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
        pingGraphics.lineStyle(4 * (1 - t) + 1, 0xADD8E6, alpha);
        pingGraphics.drawCircle(guess.x, guess.y, radius);
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
    createSuccessText(currentLevel);
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

  // Map to canvas pixel space
  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;
  mouse.x = canvasX;
  mouse.y = canvasY;

  // Convert to art space and clamp
  const artX = Math.max(0, Math.min(ART_WIDTH, canvasX - artOriginX));
  const artY = Math.max(0, Math.min(ART_HEIGHT, canvasY - artOriginY));

  // Prevent canvas interactions when success message is visible
  if (successMessageVisible) {
    return;
  }

  if (isDragging) {
    guess.x = artX;
    guess.y = artY;
  }
});

canvas.addEventListener("mousedown", () => {
  if (dialogManager && dialogManager.isDialogVisible()) {
    return;
  }
  
  // Prevent canvas interactions when success message is visible, but don't advance yet
  if (successMessageVisible) {
    return;
  }
  
  // Convert mouse to art space and clamp
  const artX = Math.max(0, Math.min(ART_WIDTH, mouse.x - artOriginX));
  const artY = Math.max(0, Math.min(ART_HEIGHT, mouse.y - artOriginY));
  
  // Check pickup condition based on level type
  if (!currentLevel) return; // Safety check
  
  if (currentLevel.jigsawImage) {
    // For jigsaw levels, check if click is on the target piece
    if (!levelRenderer.isPointOnJigsawTargetPiece({ x: artX, y: artY })) {
      // Click is not on the target piece, don't start dragging
      return;
    }
  } else {
    // For regular levels, check if mouse is within pickup radius of current cursor position
    const mousePoint = { x: artX, y: artY };
    const distance = LevelManager.distance(mousePoint, guess);
    
    if (distance > PICKUP_RADIUS) {
      // Mouse is too far from cursor, don't start dragging
      return;
    }
  }
  
  isDragging = true;
  isMouseButtonPressed = true;
  successStartMs = null; // cancel any success animation while dragging
  successMessageVisible = false;
  hasPlayerInteractedInLevel = true;
  lastInteractionTime = performance.now(); // Reset idle timer when starting to drag
  isJiggling = false; // Stop any current jiggle when dragging starts
  
  // Set guess to mouse position
  guess.x = artX;
  guess.y = artY;
  
  // Hide cursor when dragging
  canvas.style.cursor = 'none';
});

canvas.addEventListener("mouseup", () => {
  if (dialogManager && dialogManager.isDialogVisible()) {
    return;
  }
  
  // If success message is visible, advance to next level on mouse up
  if (successMessageVisible) {
    const nextIndex = levelManager.getCurrentLevelIndex() + 1;
    if (nextIndex < levelManager.getLevelCount()) {
      loadLevel(nextIndex);
    }
    return;
  }
  
  isDragging = false;
  isMouseButtonPressed = false;
  lastInteractionTime = performance.now(); // Reset idle timer when releasing mouse
  
  // Show cursor again when not dragging
  canvas.style.cursor = 'default';
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
  
  // Show cursor again when mouse leaves canvas
  canvas.style.cursor = 'default';
});

canvas.addEventListener("mouseenter", () => {
  if (dialogManager && dialogManager.isDialogVisible()) {
    // Let the dialog container handle cursor - don't override it
    return;
  }
  
  // Prevent canvas interactions when success message is visible
  if (successMessageVisible) {
    return;
  }
  
  // If mouse button is still pressed when entering canvas, resume dragging
  if (isMouseButtonPressed) {
    // Convert last mouse to art space and clamp
    const artX = Math.max(0, Math.min(ART_WIDTH, mouse.x - artOriginX));
    const artY = Math.max(0, Math.min(ART_HEIGHT, mouse.y - artOriginY));
    
    // Check pickup condition based on level type
    let canPickup = false;
    if (currentLevel && currentLevel.jigsawImage) {
      // For jigsaw levels, check if click is on the target piece
      canPickup = levelRenderer.isPointOnJigsawTargetPiece({ x: artX, y: artY });
    } else if (currentLevel) {
      // For regular levels, check if mouse is within pickup radius of current cursor position
      canPickup = LevelManager.distance({ x: artX, y: artY }, guess) <= PICKUP_RADIUS;
    }
    
    if (canPickup) {
      isDragging = true;
      guess.x = artX;
      guess.y = artY;
      
      // Hide cursor if resuming drag
      canvas.style.cursor = 'none';
    } else {
      // Mouse is too far from cursor, don't resume dragging
      canvas.style.cursor = 'default';
    }
  } else {
    // Show cursor if not dragging
    canvas.style.cursor = 'default';
  }
});

// Global mouseup listener to catch mouse releases that happen off-canvas
document.addEventListener("mouseup", () => {
  isMouseButtonPressed = false;
  isDragging = false;
  lastInteractionTime = performance.now(); // Reset idle timer when releasing mouse anywhere
  
  // Show cursor again when mouse is released anywhere
  canvas.style.cursor = 'default';
});

function updateArtButtonReadout(isPaused: boolean) {
  const buttonText = artCollectionButton.querySelector('span') as HTMLElement;

  let text = 'Back to Game';

  if (!isPaused && levelManager) {
    const artLevels = levelManager.getArtLevels();
    const totalArtLevels = artLevels.length;
    
    // Count how many art levels have been completed (are at or before current level)
    const currentLevelIndex = levelManager.getCurrentLevelIndex();
    const completedArtLevels = artLevels.filter(artLevel => {
      const artLevelIndex = levels.findIndex(level => level.id === artLevel.id);
      return artLevelIndex < currentLevelIndex;
    }).length;

    text = `Art Recovered:\n${completedArtLevels} / ${totalArtLevels}`;
  }
  buttonText.textContent = text;
}

// --- Art Collection Toggle ---
function toggleArtCollection() {
  isArtCollectionMode = !isArtCollectionMode;
  
  if (isArtCollectionMode) {
    // Hide game-related UI elements
    levelNameDisplay.style.display = 'none';
    levelSelector.style.display = 'none';
    gameContainer.visible = false;
    
    // Hide any active dialogs
    // if (dialogManager) {
    //   dialogManager.hideDialog();
    // }
  } else {
    // Show game-related UI elements
    levelNameDisplay.style.display = 'block';
    if (showLevelSelector) {
      levelSelector.style.display = 'flex';
    }
    gameContainer.visible = true;
    
    // Show tablet background if current level doesn't hide canvas
    if (tabletBackgroundSprite && !currentLevel.hideCanvas) {
      tabletBackgroundSprite.visible = true;
    }
    
    // Restore dialog if current level has dialog text
    // if (currentLevel && currentLevel.dialogText && currentLevel.dialogText.length > 0) {
    //   const isDialogOnly = !!currentLevel.hideCanvas || !!currentLevel.hideCrosshair;
    //   dialogManager.showDialog(
    //     currentLevel.dialogText, 
    //     currentLevel.dialogCharacterImage, 
    //     currentLevel.dialogPosition,
    //     isDialogOnly ? () => {
    //       // Auto-advance to next level for dialog-only levels
    //       const nextIndex = levelManager.getCurrentLevelIndex() + 1;
    //       if (nextIndex < levelManager.getLevelCount()) {
    //         loadLevel(nextIndex);
    //       }
    //     } : undefined
    //   );
    // }
  }

  updateArtButtonReadout(isArtCollectionMode);
}

// Add click event listener to the Art Collection button
artCollectionButton.addEventListener('click', toggleArtCollection);