// Level-related types and logic for the pinpoint game

export interface Point {
  x: number;
  y: number;
}

export interface LevelSettings {
  targetColor: string;
  farColor: string;
  radius: number;
}

export interface Level {
  id: number;
  displayName: string;
  target: Point;
  image?: string;
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
    const dist = this.distance(guess, target);
    return dist < radius;
  }

  // Calculate distance between two points
  distance(a: Point, b: Point): number {
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
