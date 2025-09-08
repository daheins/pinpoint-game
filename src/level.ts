// Level-related types and logic for the pinpoint game

import { Application, Sprite, Assets, Container, DisplacementFilter, Texture, Rectangle } from "pixi.js";

export interface Point {
  x: number;
  y: number;
}

export interface LevelSettings {
  targetColor: string;
  farColor: string;
  radius: number;
}

export interface MultiImageElement {
  image: string;
  target: Point;
}

export interface Level {
  id: number;
  displayName: string;
  target: Point;
  image?: string;
  fixedImage?: string;
  multiImage?: MultiImageElement[];
  jigsawImage?: string;
  feedback: "hotCold";
  settings: LevelSettings;
}

// Level management utilities
export class LevelManager {
  private levels: Level[] = [];
  private currentLevelIndex: number = 0;

  constructor(levels: Level[]) {
    this.levels = levels.sort((a, b) => a.id - b.id);
  }

  getCurrentLevel(): Level {
    return this.levels[this.currentLevelIndex];
  }

  getAllLevels(): Level[] {
    return [...this.levels];
  }

  loadLevel(levelIndex: number): Level {
    if (levelIndex >= 0 && levelIndex < this.levels.length) {
      this.currentLevelIndex = levelIndex;
    }
    return this.getCurrentLevel();
  }

  getLevelCount(): number {
    return this.levels.length;
  }

  getCurrentLevelIndex(): number {
    return this.currentLevelIndex;
  }

  // Check if a guess is within the success radius
  isGuessSuccessful(guess: Point, target: Point, radius: number): boolean {
    const dist = LevelManager.distance(guess, target);
    return dist < radius;
  }

  // Calculate LevelManager.distance between two points
  static distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Convert percentage coordinates to pixel coordinates
  percentageToPixels(percentage: Point, canvasWidth: number, canvasHeight: number): Point {
    return {
      x: (percentage.x / 100) * canvasWidth,
      y: (percentage.y / 100) * canvasHeight
    };
  }

  // Convert pixel coordinates to percentage coordinates
  pixelsToPercentage(pixels: Point, canvasWidth: number, canvasHeight: number): Point {
    return {
      x: (pixels.x / canvasWidth) * 100,
      y: (pixels.y / canvasHeight) * 100
    };
  }
}

// A type to store each puzzle piece's data
interface PuzzlePiece {
  sprite: Sprite;
  trueX: number;
  trueY: number;
  offsetX: number;
  offsetY: number;
}

export class ScatterPuzzle {
  private container: Container;
  private pieces: PuzzlePiece[] = [];
  private image: Texture;
  private app: Application;
  private target: { x: number; y: number };
  private jigsawGridSize = 10; // 10x10 grid
  private currentGuess: { x: number; y: number } = { x: 0, y: 0 };
  private levelRadius: number;

  constructor(app: Application, image: Texture, target: { x: number; y: number }, parentContainer: Container, levelRadius: number) {
    this.app = app;
    this.image = image;
    this.target = target;
    this.levelRadius = levelRadius;
    this.container = new Container();
    parentContainer.addChild(this.container);

    this.createPieces();
    this.app.ticker.add(this.update);
  }

  private createPieces() {
    const width = this.app.renderer.width;
    const height = this.app.renderer.height;
    const pieceW = width / this.jigsawGridSize;
    const pieceH = height / this.jigsawGridSize;

    for (let row = 0; row < this.jigsawGridSize; row++) {
      for (let col = 0; col < this.jigsawGridSize; col++) {
        const frame = new Rectangle(col * pieceW, row * pieceH, pieceW, pieceH);
        const texture = new Texture({ source: this.image.source, frame });

        const sprite = new Sprite(texture);
        sprite.x = col * pieceW;
        sprite.y = row * pieceH;

        // Random offset direction (unit vector × random magnitude)
        const angle = Math.random() * Math.PI * 2;
        const magnitude = 200 + Math.random() * 600; // scatter distance
        const offsetX = Math.cos(angle) * magnitude;
        const offsetY = Math.sin(angle) * magnitude;

        this.container.addChild(sprite);
        this.pieces.push({
          sprite,
          trueX: col * pieceW,
          trueY: row * pieceH,
          offsetX,
          offsetY,
        });
      }
    }
  }

  private update = () => {
    const dx = this.currentGuess.x - this.target.x;
    const dy = this.currentGuess.y - this.target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // scatter factor increases linearly with distance (no maximum limit)
    const scatterFactor = dist / 400; // adjust divisor for sensitivity

    const canvasWidth = this.app.renderer.width;
    const canvasHeight = this.app.renderer.height;

    for (const piece of this.pieces) {
      let newX = piece.trueX + scatterFactor * piece.offsetX;
      let newY = piece.trueY + scatterFactor * piece.offsetY;
      
      // Only apply wrapping when we're outside the level radius
      // This allows pieces to be at their exact true positions when close to target
      if (dist > this.levelRadius) {
        // Special handling for edge pieces (trueX = 0 or trueY = 0)
        // Allow them to have slightly negative positions to avoid wrapping
        if (piece.trueX === 0 && newX < 0) {
          // Keep left edge pieces at negative X when scattered left
          newX = newX;
        } else {
          // Apply wrapping using modulo operations for non-edge pieces
          newX = ((newX % canvasWidth) + canvasWidth) % canvasWidth;
        }
        
        if (piece.trueY === 0 && newY < 0) {
          // Keep top edge pieces at negative Y when scattered up
          newY = newY;
        } else {
          // Apply wrapping using modulo operations for non-edge pieces
          newY = ((newY % canvasHeight) + canvasHeight) % canvasHeight;
        }
      }
      
      piece.sprite.x = newX;
      piece.sprite.y = newY;
    }
  };

  updateGuess(guess: { x: number; y: number }) {
    this.currentGuess = guess;
  }

  destroy() {
    this.app.ticker.remove(this.update);
    this.container.destroy({ children: true });
    this.pieces = [];
  }
}

// Level renderer class to handle all visual rendering logic
export class LevelRenderer {
  private app: Application;
  private backgroundContainer: Container;
  private backgroundSprite: Sprite | null = null;
  private fixedImageSprite: Sprite | null = null;
  private backgroundSprites: Sprite[] = [];
  private displacementFilter: DisplacementFilter | null = null;
  private displacementSprite: Sprite | null = null;
  private scatterPuzzle: ScatterPuzzle | null = null;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(app: Application, backgroundContainer: Container, canvasWidth: number, canvasHeight: number) {
    this.app = app;
    this.backgroundContainer = backgroundContainer;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  async loadLevel(level: Level): Promise<void> {
    // Clear previous background
    if (this.backgroundSprite) {
      this.backgroundContainer.removeChild(this.backgroundSprite);
      this.backgroundSprite = null;
    }
    
    // Clear previous fixed image
    if (this.fixedImageSprite) {
      this.backgroundContainer.removeChild(this.fixedImageSprite);
      this.fixedImageSprite = null;
    }
    
    // Clear previous multi-image backgrounds
    this.backgroundSprites.forEach(sprite => {
      this.backgroundContainer.removeChild(sprite);
    });
    this.backgroundSprites = [];
    
    // Clear previous jigsaw puzzle
    if (this.scatterPuzzle) {
      this.scatterPuzzle.destroy();
      this.scatterPuzzle = null;
    }
    
    // Clear any existing filters on the container
    (this.backgroundContainer as any).filters = undefined;
    
    // Load background image if level has one
    if (level.image) {
      try {
        const texture = await Assets.load(`${import.meta.env.BASE_URL}images/${level.image}`);
        this.backgroundSprite = new Sprite(texture);
        this.backgroundSprite.width = this.canvasWidth;
        this.backgroundSprite.height = this.canvasHeight;
        
        // Create displacement texture for warping effect
        const displacementTexture = await Assets.load(`${import.meta.env.BASE_URL}images/${level.image}`);
        this.displacementSprite = new Sprite(displacementTexture);
        this.displacementSprite.width = this.canvasWidth;
        this.displacementSprite.height = this.canvasHeight;
        
        // Create displacement filter
        this.displacementFilter = new DisplacementFilter({
          sprite: this.displacementSprite,
          scale: 0
        });
        
        this.backgroundSprite.filters = [this.displacementFilter];
        this.backgroundContainer.addChild(this.backgroundSprite);
      } catch (error) {
        console.error(`Failed to load image: ${import.meta.env.BASE_URL}images/${level.image}`, error);
        this.backgroundSprite = null;
      }
    }

    // Load multi-image elements if level has them
    if (level.multiImage) {
      try {
        // Load all images and create sprites
        for (const imageElement of level.multiImage) {
          const texture = await Assets.load(`${import.meta.env.BASE_URL}images/${imageElement.image}`);
          const sprite = new Sprite(texture);
          sprite.width = this.canvasWidth;
          sprite.height = this.canvasHeight;
          this.backgroundSprites.push(sprite);
          this.backgroundContainer.addChild(sprite);
        }
      } catch (error) {
        console.error(`Failed to load multi-image level:`, error);
      }
    }
    
    // Load fixed image if level has one (no displacement filter, static rendering)
    if (level.fixedImage) {
      try {
        const texture = await Assets.load(`${import.meta.env.BASE_URL}images/${level.fixedImage}`);
        this.fixedImageSprite = new Sprite(texture);
        this.fixedImageSprite.width = this.canvasWidth;
        this.fixedImageSprite.height = this.canvasHeight;
        this.backgroundContainer.addChild(this.fixedImageSprite);
      } catch (error) {
        console.error(`Failed to load fixed image: ${import.meta.env.BASE_URL}images/${level.fixedImage}`, error);
        this.fixedImageSprite = null;
      }
    }
    
    // Handle jigsaw puzzle levels (only if no other image types)
    if (level.jigsawImage && !level.image && !level.multiImage) {
      try {
        const texture = await Assets.load(`${import.meta.env.BASE_URL}images/${level.jigsawImage}`);
        const target = {
          x: (level.target.x / 100) * this.canvasWidth,
          y: (level.target.y / 100) * this.canvasHeight
        };
        this.scatterPuzzle = new ScatterPuzzle(this.app, texture, target, this.backgroundContainer, level.settings.radius);
      } catch (error) {
        console.error(`Failed to load jigsaw image: ${import.meta.env.BASE_URL}images/${level.jigsawImage}`, error);
        this.scatterPuzzle = null;
      }
    }
    
    // Clean up unused properties
    if (!level.image) {
      this.displacementFilter = null;
      this.displacementSprite = null;
    }
  }

  updateWarpFilter(playerX: number, playerY: number, level: Level): void {
    if (this.displacementFilter && this.displacementSprite) {
      // Calculate LevelManager.distance from player to target
      const distX = Math.abs(playerX - level.target.x);
      const distY = Math.abs(playerY - level.target.y);
      
      // Calculate warp strength based on LevelManager.distance (farther = more warp)
      const maxDist = Math.sqrt(100 ** 2 + 100 ** 2);
      const normalizedDist = Math.min(Math.sqrt(distX ** 2 + distY ** 2) / maxDist, 1);
      
      // Scale displacement based on LevelManager.distance (farther = more warp)
      const warpStrength = normalizedDist * 600; // Max displacement of 600 pixels
      
      // Apply position-based warping only
      const waveX = Math.sin(playerX * 0.02) * warpStrength * 0.5 +
                    Math.sin(playerY * 0.01) * warpStrength * 0.3;
      const waveY = Math.cos(playerY * 0.015) * warpStrength * 0.5 +
                    Math.cos(playerX * 0.012) * warpStrength * 0.3;
      
      // Update displacement filter
      this.displacementFilter.scale.x = waveX;
      this.displacementFilter.scale.y = waveY;
    }
  }

  updateMultiImageAlpha(activePercentageGuess: Point, level: Level): void {
    // Multi-image alpha reveal: nearer to a sprite's target -> higher alpha
    if (level.multiImage && this.backgroundSprites.length === level.multiImage.length) {
      for (let i = 0; i < this.backgroundSprites.length; i++) {
        const sprite = this.backgroundSprites[i];
        const t = level.multiImage[i].target; // 0..100
        const dx = (activePercentageGuess.x - t.x);
        const dy = (activePercentageGuess.y - t.y);
        const d = Math.sqrt(dx * dx + dy * dy); // 0..~141
        // Map LevelManager.distance to focus in 0..1 (closer = 1). Tunable falloff.
        const focus = Math.max(0, 1 - (d / 30));
        // Base alpha when far: low but non-zero to still see stacks
        const minAlpha = 0.2;
        sprite.alpha = minAlpha + (1 - minAlpha) * focus;
      }
    }
  }

  updateBackgroundColor(activePercentageGuess: Point, level: Level): void {
    // Set background color if no image
    if (!this.backgroundSprite && !this.fixedImageSprite && this.backgroundSprites.length === 0 && !this.scatterPuzzle) {
      const dist = LevelManager.distance(activePercentageGuess, level.target);
      const maxDist = Math.sqrt(100 ** 2 + 100 ** 2);
      const t = Math.min(dist / maxDist, 1);
      const v = Math.round(255 * (1 - t));
      this.app.renderer.background.color = (v << 16) | (v << 8) | v; // Convert to hex
    }
  }

  updateJigsawPuzzle(activePercentageGuess: Point): void {
    // Update jigsaw puzzle with current active guess position
    if (this.scatterPuzzle) {
      const pixelGuess = {
        x: (activePercentageGuess.x / 100) * this.canvasWidth,
        y: (activePercentageGuess.y / 100) * this.canvasHeight
      };
      this.scatterPuzzle.updateGuess(pixelGuess);
    }
  }

  drawLevel(activePercentageGuess: Point, level: Level): void {
    // Update warp filter for single image levels
    this.updateWarpFilter(activePercentageGuess.x, activePercentageGuess.y, level);
    
    // Update multi-image alpha for multi-image levels
    this.updateMultiImageAlpha(activePercentageGuess, level);
    
    // Update jigsaw puzzle for jigsaw levels
    this.updateJigsawPuzzle(activePercentageGuess);
    
    // Update background color for levels without images
    this.updateBackgroundColor(activePercentageGuess, level);
  }
}
