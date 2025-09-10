// ScatterPuzzle class for jigsaw puzzle levels

import { Application, Container, Graphics, Sprite, Texture, Rectangle } from "pixi.js";

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
