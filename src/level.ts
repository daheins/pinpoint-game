// Level-related types and logic for the pinpoint game

import { Application, Sprite, Assets, Container, DisplacementFilter, BlurFilter, NoiseFilter, Graphics } from "pixi.js";
import { TwistFilter } from '@pixi/filter-twist';
import { showCurve } from './gameParams_debug';
import { ART_WIDTH, ART_HEIGHT, TABLET_WIDTH, TABLET_HEIGHT } from './gameParams';
import { ScatterPuzzle } from './scatterPuzzle';

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
  imageFilterDist?: string;
  imageFilterX?: string;
  imageFilterY?: string;
  fixedImage?: string;
  multiImage?: MultiImageElement[];
  jigsawImage?: string;
  jigsawSlope?: number;
  jigsawMovement?: number;
  curveImage?: string;
  curveCursor?: string;
  dialogText?: string[];
  dialogCharacterImage?: string;
  dialogPosition?: string;
  hideCanvas?: boolean;
  hideCrosshair?: boolean;

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
    this.jigsawMovement = levelData.jigsawMovement;
    this.curveImage = levelData.curveImage;
    this.curveCursor = levelData.curveCursor;
    this.imageFilterDist = levelData.imageFilterDist;
    this.imageFilterX = levelData.imageFilterX;
    this.imageFilterY = levelData.imageFilterY;
    this.dialogText = levelData.dialogText;
    this.dialogCharacterImage = levelData.dialogCharacterImage;
    this.dialogPosition = levelData.dialogPosition;
    this.hideCanvas = levelData.hideCanvas;
    this.hideCrosshair = levelData.hideCrosshair;

    if (!this.target) this.target = { x: 50, y: 50 };
    if (!this.targetRadius) this.targetRadius = 0;
  }

  shouldShowCrosshair(): boolean {
    if (!!this.hideCrosshair) return false;

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


// Level renderer class to handle all visual rendering logic
export class LevelRenderer {
  private app: Application;
  private imageContainer: Container;
  private backgroundSprite: Sprite | null = null;
  private fixedImageSprite: Sprite | null = null;
  private backgroundSprites: Sprite[] = [];
  private displacementFilter: DisplacementFilter | null = null;
  private displacementSprite: Sprite | null = null;
  private blurFilter: BlurFilter | null = null;
  private noiseFilter: NoiseFilter | null = null;
  private scatterPuzzle: ScatterPuzzle | null = null;
  private curveImage: HTMLImageElement | null = null;
  private curveDisplaySprite: Sprite | null = null;
  private curveCursorSprite: Sprite | null = null;
  private canvasWidth: number;
  private canvasHeight: number;
  private gradientContainer: Container;
  private gradientGraphics: Graphics | null = null;

  constructor(app: Application, imageContainer: Container, gradientContainer: Container, canvasWidth: number, canvasHeight: number) {
    this.app = app;
    this.imageContainer = imageContainer;
    this.gradientContainer = gradientContainer;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  // Helper method to scale sprite to fit canvas while maintaining aspect ratio
  private scaleSpriteToFit(sprite: Sprite): void {
    const texture = sprite.texture;
    const imageWidth = texture.width;
    const imageHeight = texture.height;
    const canvasWidth = this.canvasWidth;
    const canvasHeight = this.canvasHeight;
    
    // Calculate scale factors to fit the image within the canvas
    const scaleX = canvasWidth / imageWidth;
    const scaleY = canvasHeight / imageHeight;
    
    // Use the smaller scale factor to ensure the image fits completely within the canvas
    const scale = Math.min(scaleX, scaleY);
    
    // Apply the scale
    sprite.scale.set(scale);
    
    // Center the sprite on the canvas
    sprite.x = (canvasWidth - imageWidth * scale) / 2;
    sprite.y = (canvasHeight - imageHeight * scale) / 2;
  }

  async loadLevel(level: Level): Promise<void> {
    // Clear previous background
    if (this.backgroundSprite) {
      this.imageContainer.removeChild(this.backgroundSprite);
      this.backgroundSprite = null;
    }
    
    // Clear previous fixed image
    if (this.fixedImageSprite) {
      this.imageContainer.removeChild(this.fixedImageSprite);
      this.fixedImageSprite = null;
    }
    
    // Clear previous multi-image backgrounds
    this.backgroundSprites.forEach(sprite => {
      this.imageContainer.removeChild(sprite);
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
      this.imageContainer.removeChild(this.curveDisplaySprite);
      this.curveDisplaySprite = null;
    }
    
    // Clear previous curve cursor sprite
    if (this.curveCursorSprite) {
      this.imageContainer.removeChild(this.curveCursorSprite);
      this.curveCursorSprite = null;
    }
    
    // Clear any existing filters on the container
    (this.imageContainer as any).filters = undefined;
    
    // Clear previous filters
    this.blurFilter = null;
    this.noiseFilter = null;
    
    // Load background image if level has one
    if (level.image) {
      try {
        const texture = await Assets.load(`${import.meta.env.BASE_URL}images/${level.image}`);
        this.backgroundSprite = new Sprite(texture);
        this.scaleSpriteToFit(this.backgroundSprite);
        
        // Create displacement texture for warping effect
        const displacementTexture = await Assets.load(`${import.meta.env.BASE_URL}images/${level.image}`);
        this.displacementSprite = new Sprite(displacementTexture);
        this.scaleSpriteToFit(this.displacementSprite);
        
        // Create displacement filter
        this.displacementFilter = new DisplacementFilter({
          sprite: this.displacementSprite,
          scale: 0
        });
        
        // Create blur filter for blur effects
        this.blurFilter = new BlurFilter({
          strength: 0, // Will be updated dynamically
          quality: 10
        });
        
        // Create noise filter for noise effects
        this.noiseFilter = new NoiseFilter({
          noise: 0, // Will be updated dynamically
          seed: Math.random() // Random seed for varied noise patterns
        });
        
        // Apply filters to sprite based on level configuration
        const filters: any[] = [];
        
        if (level.imageFilterDist === 'warp' || level.imageFilterX === 'warp' || level.imageFilterY === 'warp') {
          filters.push(this.displacementFilter);
        }
        
        if (level.imageFilterDist === 'blur' || level.imageFilterX === 'blur' || level.imageFilterY === 'blur') {
          filters.push(this.blurFilter);
        }
        
        if (level.imageFilterDist === 'noise' || level.imageFilterX === 'noise' || level.imageFilterY === 'noise') {
          filters.push(this.noiseFilter);
        }
        
        this.backgroundSprite.filters = filters;
        this.imageContainer.addChild(this.backgroundSprite);
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
          this.scaleSpriteToFit(sprite);
          this.backgroundSprites.push(sprite);
          this.imageContainer.addChild(sprite);
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
        this.scaleSpriteToFit(this.fixedImageSprite);
        this.imageContainer.addChild(this.fixedImageSprite);
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
        this.scatterPuzzle = new ScatterPuzzle(this.app, texture, target, this.imageContainer, level.jigsawSlope, level.jigsawMovement, this.canvasWidth, this.canvasHeight);
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
          this.scaleSpriteToFit(this.curveDisplaySprite);
          
          // Add curve display sprite on top of everything (like fixed image)
          this.imageContainer.addChild(this.curveDisplaySprite);
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
        this.curveCursorSprite.x = ART_WIDTH / 2;
        this.curveCursorSprite.y = ART_HEIGHT / 2;
        
        // Center the sprite anchor
        this.curveCursorSprite.anchor.set(0.5, 0.5);
        
        // Add curve cursor sprite to UI container (will be added to uiContainer in game.ts)
        // For now, add to image container, but we'll move it to UI container later
        this.imageContainer.addChild(this.curveCursorSprite);
      } catch (error) {
        console.error(`Failed to load curve cursor: ${import.meta.env.BASE_URL}images/${level.curveCursor}`, error);
        this.curveCursorSprite = null;
      }
    }
    
    // Clean up unused properties
    if (!level.image) {
      this.displacementFilter = null;
      this.displacementSprite = null;
      this.blurFilter = null;
      this.noiseFilter = null;
    }
  }

  updateDistanceFilter(playerX: number, playerY: number, level: Level): void {
    if (!level.imageFilterDist) return;
    
    // Calculate cartesian distance from player to target
    const distX = Math.abs(playerX - level.target.x);
    const distY = Math.abs(playerY - level.target.y);
    const distance = Math.sqrt(distX ** 2 + distY ** 2);
    
    if (level.imageFilterDist === 'warp' && this.displacementFilter) {
      // Scale displacement based on distance (farther = more warp)
      const warpStrength = distance * 6; // Linear scaling
      
      // Apply position-based warping
      const waveX = Math.sin(playerX * 0.02) * warpStrength * 0.5 +
                    Math.sin(playerY * 0.01) * warpStrength * 0.3;
      const waveY = Math.cos(playerY * 0.015) * warpStrength * 0.5 +
                    Math.cos(playerX * 0.012) * warpStrength * 0.3;
      
      this.displacementFilter.scale.x = waveX;
      this.displacementFilter.scale.y = waveY;
    }
    
    if (level.imageFilterDist === 'blur' && this.blurFilter) {
      // Scale blur based on distance (farther = more blur)
      const blurStrength = distance * 0.1; // Linear scaling
      this.blurFilter.strength = blurStrength;
    }
    
    if (level.imageFilterDist === 'noise' && this.noiseFilter) {
      // Scale noise based on distance (farther = more noise)
      const noiseStrength = distance * 0.01; // Linear scaling
      this.noiseFilter.noise = noiseStrength;
    }
  }

  updateXFilter(playerX: number, _playerY: number, level: Level): void {
    if (!level.imageFilterX) return;
    
    // Calculate signed X difference (guess.x - target.x)
    const xDiff = playerX - level.target.x;
    
    if (level.imageFilterX === 'warp' && this.displacementFilter) {
      // Scale displacement based on X difference
      const warpStrength = Math.abs(xDiff) * 6; // Linear scaling
      
      // Apply X-based warping
      const waveX = Math.sin(playerX * 0.02) * warpStrength * 0.5;
      const waveY = Math.cos(playerX * 0.012) * warpStrength * 0.3;
      
      this.displacementFilter.scale.x = waveX;
      this.displacementFilter.scale.y = waveY;
    }
    
    if (level.imageFilterX === 'blur' && this.blurFilter) {
      // Scale blur based on X difference
      const blurStrength = Math.abs(xDiff) * 0.1; // Linear scaling
      this.blurFilter.strength = blurStrength;
    }
    
    if (level.imageFilterX === 'noise' && this.noiseFilter) {
      // Scale noise based on X difference
      const noiseStrength = Math.abs(xDiff) * 0.06; // Linear scaling
      this.noiseFilter.noise = noiseStrength;
    }
  }

  updateYFilter(_playerX: number, playerY: number, level: Level): void {
    if (!level.imageFilterY) return;
    
    // Calculate signed Y difference (guess.y - target.y)
    const yDiff = playerY - level.target.y;
    
    if (level.imageFilterY === 'warp' && this.displacementFilter) {
      // Scale displacement based on Y difference
      const warpStrength = Math.abs(yDiff) * 6; // Linear scaling
      
      // Apply Y-based warping
      const waveX = Math.sin(playerY * 0.01) * warpStrength * 0.3;
      const waveY = Math.cos(playerY * 0.015) * warpStrength * 0.5;
      
      this.displacementFilter.scale.x = waveX;
      this.displacementFilter.scale.y = waveY;
    }
    
    if (level.imageFilterY === 'blur' && this.blurFilter) {
      // Scale blur based on Y difference
      const blurStrength = Math.abs(yDiff) * 0.1; // Linear scaling
      this.blurFilter.strength = blurStrength;
    }
    
    if (level.imageFilterY === 'noise' && this.noiseFilter) {
      // Scale noise based on Y difference
      const noiseStrength = Math.abs(yDiff) * 0.01; // Linear scaling
      this.noiseFilter.noise = noiseStrength;
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
      if (!this.gradientGraphics) {
        // Create new gradient graphics
        this.gradientGraphics = new Graphics();
        // Center within the tablet by offsetting to ART viewport origin
        const artOriginX = (TABLET_WIDTH - ART_WIDTH) / 2;
        const artOriginY = (TABLET_HEIGHT - ART_HEIGHT) / 2;
        this.gradientGraphics.x = artOriginX;
        this.gradientGraphics.y = artOriginY;
        this.gradientGraphics.rect(0, 0, this.canvasWidth, this.canvasHeight);
        this.gradientContainer.addChild(this.gradientGraphics);
      }
      
      const dist = LevelManager.distance(activePercentageGuess, level.target);
      const maxDist = Math.sqrt(100 ** 2 + 100 ** 2);
      const t = Math.min(dist / maxDist, 1);
      const v = Math.round(255 * (1 - t));
      const color = (v << 16) | (v << 8) | v; // Convert to hex
      
      // Clear and redraw with new color
      this.gradientGraphics.clear();
      this.gradientGraphics.rect(0, 0, this.canvasWidth, this.canvasHeight);
      this.gradientGraphics.fill({ color: color });
    } else {
      // Clear gradient graphics if there are images
      if (this.gradientGraphics) {
        this.gradientContainer.removeChild(this.gradientGraphics);
        this.gradientGraphics = null;
      }
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

  // Check if a point is on the target piece for jigsaw levels
  isPointOnJigsawTargetPiece(point: { x: number; y: number }): boolean {
    if (this.scatterPuzzle) {
      return this.scatterPuzzle.isPointOnTargetPiece(point);
    }
    return false;
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
    // Update filters for single image levels
    this.updateDistanceFilter(activePercentageGuess.x, activePercentageGuess.y, level);
    this.updateXFilter(activePercentageGuess.x, activePercentageGuess.y, level);
    this.updateYFilter(activePercentageGuess.x, activePercentageGuess.y, level);
    
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
