// Level-related types and logic for the pinpoint game

import { Application, Sprite, Assets, Container, DisplacementFilter, Texture, Rectangle, Graphics, BlurFilter } from "pixi.js";
import { TwistFilter } from '@pixi/filter-twist';
import { showCurve } from './gameParams_debug';

// Debug: Check if TwistFilter is properly imported
console.log('TwistFilter import check:', TwistFilter);

export interface Point {
  x: number;
  y: number;
}

export interface MultiImageElement {
  image: string;
  target: Point;
}

export class Level {
  id: number;
  displayName: string;
  target: Point;
  targetRadius: number;
  image?: string;
  fixedImage?: string;
  multiImage?: MultiImageElement[];
  jigsawImage?: string;
  jigsawSlope?: number;
  curveImage?: string;
  curveCursor?: string;
  spiralEffect?: {
    centerX?: number; // 0-1, relative to image
    centerY?: number; // 0-1, relative to image
    strength?: number; // 0-1, how strong the spiral effect is
    rotation?: number; // rotation speed/amount
    spiralTightness?: number; // how tight the spiral is
  };

  constructor(levelData: any) {
    this.id = levelData.id;
    this.displayName = levelData.displayName;
    this.target = levelData.target;
    this.targetRadius = levelData.targetRadius;
    this.image = levelData.image;
    this.fixedImage = levelData.fixedImage;
    this.multiImage = levelData.multiImage;
    this.jigsawImage = levelData.jigsawImage;
    this.jigsawSlope = levelData.jigsawSlope;
    this.curveImage = levelData.curveImage;
    this.curveCursor = levelData.curveCursor;
    this.spiralEffect = levelData.spiralEffect;
  }

  shouldShowCrosshair(): boolean {
    return !this.jigsawImage && !this.curveCursor;
  }
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

  // Calculate distance from a point to a curve defined by an image
  // Returns distance value from 0-100 based on pixel color (black=0, white=100)
  static getCurveDistance(guess: Point, curveImage: HTMLImageElement): number {
    // Create a temporary canvas to sample the curve image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 50; // Default distance if canvas context fails

    // Set canvas size to match the curve image
    canvas.width = curveImage.width;
    canvas.height = curveImage.height;

    // Draw the curve image to the canvas
    ctx.drawImage(curveImage, 0, 0);

    // Convert guess coordinates from percentage to image pixel coordinates
    const imageX = (guess.x / 100) * canvas.width;
    const imageY = (guess.y / 100) * canvas.height;

    // Clamp coordinates to image bounds
    const clampedX = Math.max(0, Math.min(canvas.width - 1, Math.floor(imageX)));
    const clampedY = Math.max(0, Math.min(canvas.height - 1, Math.floor(imageY)));

    // Sample the pixel at the guess coordinates
    const imageData = ctx.getImageData(clampedX, clampedY, 1, 1);
    const [r, g, b] = imageData.data;

    // Convert RGB to distance (assuming grayscale: black=0, white=100)
    // Use average of RGB values for grayscale
    const grayscale = (r + g + b) / 3;
    const distance = (grayscale / 255) * 100;

    return distance;
  }
}

// A type to store each puzzle piece's data
interface PuzzlePiece {
  sprite: Sprite;
  trueX: number;
  trueY: number;
  offsetX: number;
  offsetY: number;
  border?: Graphics; // Optional border for target piece
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
  private jigsawSlope?: number;
  private targetPiece: PuzzlePiece | null = null;
  private targetPieceOffset: { x: number; y: number } = { x: 0, y: 0 };

  constructor(app: Application, image: Texture, target: { x: number; y: number }, parentContainer: Container, levelRadius: number, jigsawSlope?: number) {
    this.app = app;
    this.image = image;
    this.target = target;
    this.levelRadius = levelRadius;
    this.jigsawSlope = jigsawSlope;
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
        const piece: PuzzlePiece = {
          sprite,
          trueX: col * pieceW,
          trueY: row * pieceH,
          offsetX,
          offsetY,
        };
        this.pieces.push(piece);

        // Check if this piece contains the target
        if (this.target.x >= col * pieceW && this.target.x < (col + 1) * pieceW &&
            this.target.y >= row * pieceH && this.target.y < (row + 1) * pieceH) {
          this.targetPiece = piece;
          // Calculate offset from target to piece top-left corner (sprite position)
          this.targetPieceOffset = {
            x: this.target.x - (col * pieceW),
            y: this.target.y - (row * pieceH)
          };
          
          // Create a black border for the target piece
          const border = new Graphics();
          border.rect(0, 0, pieceW, pieceH);
          border.stroke({ width: 4, color: 0x000000 });
          
          // Add border to the piece and container
          piece.border = border;
          this.container.addChild(border);
        }
      }
    }
  }

  private update = () => {
    let dist: number;
    
    if (this.jigsawSlope !== undefined) {
      // Calculate distance from guess to the line defined by slope going through target
      // Line equation: y - target.y = slope * (x - target.x)
      // Standard form: slope * x - y + (target.y - slope * target.x) = 0
      // Distance formula: |slope * guess.x - guess.y + (target.y - slope * target.x)| / sqrt(slope² + 1)
      const m = -this.jigsawSlope;
      const numerator = m * this.currentGuess.x - this.currentGuess.y + (this.target.y - m * this.target.x);
      const denominator = Math.sqrt(m * m + 1);
      dist = numerator / denominator;
    } else {
      // Original distance calculation from guess to target point
      const dx = this.currentGuess.x - this.target.x;
      const dy = this.currentGuess.y - this.target.y;
      dist = Math.sqrt(dx * dx + dy * dy);
    }

    // scatter factor increases linearly with distance (no maximum limit)
    const scatterFactor = dist / 400; // adjust divisor for sensitivity

    const canvasWidth = this.app.renderer.width;
    const canvasHeight = this.app.renderer.height;

    for (const piece of this.pieces) {
      // Handle target piece differently - it follows the cursor
      if (piece === this.targetPiece) {
        // Position the target piece so that the target point on the piece aligns with the cursor
        // The offset represents where the target is relative to the piece's top-left corner
        piece.sprite.x = this.currentGuess.x - this.targetPieceOffset.x;
        piece.sprite.y = this.currentGuess.y - this.targetPieceOffset.y;
        
        // Move the border along with the piece
        if (piece.border) {
          piece.border.x = piece.sprite.x;
          piece.border.y = piece.sprite.y;
        }
        
        // Ensure target piece and its border are always on top
        this.container.setChildIndex(piece.sprite, this.container.children.length - 1);
        if (piece.border) {
          this.container.setChildIndex(piece.border, this.container.children.length - 1);
        }
        continue;
      }

      // Regular scatter logic for non-target pieces
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
    this.targetPiece = null;
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
  private spiralFilter: BlurFilter | null = null;
  private scatterPuzzle: ScatterPuzzle | null = null;
  private curveImage: HTMLImageElement | null = null;
  private curveDisplaySprite: Sprite | null = null;
  private curveCursorSprite: Sprite | null = null;
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
    
    // Clear previous curve image
    this.curveImage = null;
    
    // Clear previous curve display sprite
    if (this.curveDisplaySprite) {
      this.backgroundContainer.removeChild(this.curveDisplaySprite);
      this.curveDisplaySprite = null;
    }
    
    // Clear previous curve cursor sprite
    if (this.curveCursorSprite) {
      this.backgroundContainer.removeChild(this.curveCursorSprite);
      this.curveCursorSprite = null;
    }
    
    // Clear any existing filters on the container
    (this.backgroundContainer as any).filters = undefined;
    
    // Clear previous spiral filter
    this.spiralFilter = null;
    
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
        
        // Try a simple BlurFilter instead of TwistFilter
        console.log('Creating blur filter for testing');
        this.spiralFilter = new BlurFilter({
          strength: 20, // Blur strength
          quality: 10   // Blur quality
        });
        console.log('Created blur filter:', this.spiralFilter);
        
        // Apply filters to sprite (mutually exclusive - either displacement OR spiral, not both)
        const filters: any[] = [];
        
        if (level.spiralEffect) {
          // Use spiral filter if spiral effect is defined
          filters.push(this.spiralFilter);
        } else {
          // Use displacement filter if no spiral effect
          filters.push(this.displacementFilter);
        }
        
        this.backgroundSprite.filters = filters;
        console.log('Applied filters to background sprite:', filters.length, 'filters');
        console.log('Filter types:', filters.map(f => f.constructor.name));
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
        this.scatterPuzzle = new ScatterPuzzle(this.app, texture, target, this.backgroundContainer, level.targetRadius, level.jigsawSlope);
      } catch (error) {
        console.error(`Failed to load jigsaw image: ${import.meta.env.BASE_URL}images/${level.jigsawImage}`, error);
        this.scatterPuzzle = null;
      }
    }
    
    // Load curve image for curve-based levels
    if (level.curveImage) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Enable CORS for pixel sampling
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = `${import.meta.env.BASE_URL}images/${level.curveImage}`;
        });
        this.curveImage = img;
        
        // Create display sprite if showCurve debug option is enabled
        if (showCurve) {
          const texture = await Assets.load(`${import.meta.env.BASE_URL}images/${level.curveImage}`);
          this.curveDisplaySprite = new Sprite(texture);
          this.curveDisplaySprite.width = this.canvasWidth;
          this.curveDisplaySprite.height = this.canvasHeight;
          
          // Add curve display sprite on top of everything (like fixed image)
          this.backgroundContainer.addChild(this.curveDisplaySprite);
        }
      } catch (error) {
        console.error(`Failed to load curve image: ${import.meta.env.BASE_URL}images/${level.curveImage}`, error);
        this.curveImage = null;
        this.curveDisplaySprite = null;
      }
    }
    
    // Load curve cursor if level has one
    if (level.curveCursor) {
      try {
        const texture = await Assets.load(`${import.meta.env.BASE_URL}images/${level.curveCursor}`);
        this.curveCursorSprite = new Sprite(texture);
        
        // Set initial position to middle of canvas
        this.curveCursorSprite.x = this.canvasWidth / 2;
        this.curveCursorSprite.y = this.canvasHeight / 2;
        
        // Center the sprite anchor
        this.curveCursorSprite.anchor.set(0.5, 0.5);
        
        // Add curve cursor sprite to UI container (will be added to uiContainer in game.ts)
        // For now, add to background container, but we'll move it to UI container later
        this.backgroundContainer.addChild(this.curveCursorSprite);
      } catch (error) {
        console.error(`Failed to load curve cursor: ${import.meta.env.BASE_URL}images/${level.curveCursor}`, error);
        this.curveCursorSprite = null;
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

  updateSpiralFilter(playerX: number, playerY: number, level: Level): void {
    if (this.spiralFilter && level.spiralEffect) {
      // Calculate distance from player to target
      const distX = Math.abs(playerX - level.target.x);
      const distY = Math.abs(playerY - level.target.y);
      const distance = Math.sqrt(distX ** 2 + distY ** 2);
      
      // Calculate blur strength based on distance (closer = more blur)
      const maxDist = Math.sqrt(100 ** 2 + 100 ** 2);
      const normalizedDist = Math.min(distance / maxDist, 1);
      
      // Get spiral config (use level config if available, otherwise defaults)
      const spiralConfig = level.spiralEffect || {
        centerX: 0.5,
        centerY: 0.5,
        strength: 0.1,
        rotation: 0,
        spiralTightness: 1.0
      };
      
      // Invert so closer to target = more blur effect
      const blurStrength = (1 - normalizedDist) * (spiralConfig.strength ?? 0.1) * 10; // Scale up for blur
      
      // Update blur filter strength
      (this.spiralFilter as BlurFilter).strength = blurStrength;
      
      // Debug: Log the actual filter properties
      if (Math.random() < 0.01) { // Log occasionally to avoid spam
        console.log('BlurFilter properties:', {
          strength: (this.spiralFilter as BlurFilter).strength,
          quality: (this.spiralFilter as BlurFilter).quality
        });
      }
      
      // Debug logging (remove after testing)
      if (Math.random() < 0.01) { // Log occasionally to avoid spam
        console.log('Blur filter update:', {
          distance,
          blurStrength
        });
      }
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

  // Get curve distance for curve-based levels
  getCurveDistance(activePercentageGuess: Point): number | null {
    if (this.curveImage) {
      return LevelManager.getCurveDistance(activePercentageGuess, this.curveImage);
    }
    return null;
  }

  // Update curve cursor position
  updateCurveCursor(activePixelGuess: Point): void {
    if (this.curveCursorSprite) {
      this.curveCursorSprite.x = activePixelGuess.x;
      this.curveCursorSprite.y = activePixelGuess.y;
    }
  }

  // Get curve cursor sprite for UI container management
  getCurveCursorSprite(): Sprite | null {
    return this.curveCursorSprite;
  }


  drawLevel(activePercentageGuess: Point, level: Level): void {
    // Update warp filter for single image levels
    this.updateWarpFilter(activePercentageGuess.x, activePercentageGuess.y, level);
    
    // Update spiral filter for levels with spiral effects
    this.updateSpiralFilter(activePercentageGuess.x, activePercentageGuess.y, level);
    
    // Update multi-image alpha for multi-image levels
    this.updateMultiImageAlpha(activePercentageGuess, level);
    
    // Update jigsaw puzzle for jigsaw levels
    this.updateJigsawPuzzle(activePercentageGuess);
    
    // Update background color for levels without images
    this.updateBackgroundColor(activePercentageGuess, level);
    
    // Update curve cursor position for curve cursor levels
    if (level.curveCursor) {
      const activePixelGuess = {
        x: (activePercentageGuess.x / 100) * this.canvasWidth,
        y: (activePercentageGuess.y / 100) * this.canvasHeight
      };
      this.updateCurveCursor(activePixelGuess);
    }
  }
}
