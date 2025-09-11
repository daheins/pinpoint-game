// ScatterPuzzle class for jigsaw puzzle levels

import { Application, Container, Graphics, Sprite, Texture, Rectangle } from "pixi.js";
import { trueModulo } from "./helpers";

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
  private jigsawSlope?: number;
  private jigsawMovement?: number;
  private targetPiece: PuzzlePiece | null = null;
  private targetPieceOffset: { x: number; y: number } = { x: 0, y: 0 };

  constructor(app: Application, image: Texture, target: { x: number; y: number }, parentContainer: Container, jigsawSlope?: number, jigsawMovement?: number) {
    this.app = app;
    this.image = image;
    this.target = target;
    this.jigsawSlope = jigsawSlope;
    this.jigsawMovement = jigsawMovement;
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
      // Apply jigsawMovement factor to the scatter movement (default to 1 if not specified)
      const movementFactor = this.jigsawMovement !== undefined ? this.jigsawMovement : 1;
      let newX = piece.trueX + scatterFactor * piece.offsetX * movementFactor;
      let newY = piece.trueY + scatterFactor * piece.offsetY * movementFactor;
      
      // Calculate piece dimensions
      const pieceWidth = canvasWidth / this.jigsawGridSize;
      const pieceHeight = canvasHeight / this.jigsawGridSize;
      
      // Extended range allows pieces to go fully off screen before wrapping
      const extendedWidth = canvasWidth + 2 * pieceWidth;
      const extendedHeight = canvasHeight + 2 * pieceHeight;
      
      // Apply wrapping with extended range - all pieces can go off screen
      // Offset by pieceWidth/pieceHeight so wrapping starts from off-screen
      newX = trueModulo((newX + pieceWidth),  extendedWidth) - pieceWidth;
      newY = trueModulo((newY + pieceHeight), extendedHeight) - pieceHeight;
      
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
