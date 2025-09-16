// Dialog Manager for handling in-game dialog display using PIXI

import { Container, Graphics, Text, Sprite, Assets } from "pixi.js";
import { TABLET_WIDTH, TABLET_HEIGHT } from './gameParams';

export class DialogManager {
  private uiContainer: Container;
  private dialogContainer: Container | null = null;
  private characterSprite: Sprite | null = null;
  private dialogText: Text | null = null;
  private backgroundGraphics: Graphics | null = null;
  private isVisible: boolean = false;
  private currentDialogIndex: number = 0;
  private dialogStrings: string[] = [];
  private onComplete?: () => void;

  constructor(uiContainer: Container) {
    this.uiContainer = uiContainer;
  }

  public async showDialog(dialogStrings: string[], characterImagePath?: string, position?: string, onComplete?: () => void): Promise<void> {
    if (!dialogStrings || dialogStrings.length === 0) {
      return;
    }
    
    // Clear any existing dialog first
    this.hideDialog();
    
    this.dialogStrings = dialogStrings;
    this.currentDialogIndex = 0;
    this.isVisible = true;
    this.onComplete = onComplete;

    // Create new dialog container
    this.dialogContainer = new Container();
    
    // Full-screen transparent overlay to capture clicks anywhere
    const overlayGraphics = new Graphics();
    overlayGraphics.rect(0, 0, TABLET_WIDTH, TABLET_HEIGHT);
    overlayGraphics.fill({ color: 0x000000, alpha: 0.001 });
    this.dialogContainer.addChild(overlayGraphics);

    // Load character image if provided
    if (characterImagePath) {
      try {
        const texture = await Assets.load(`${import.meta.env.BASE_URL}character/${characterImagePath}`);
        
        // Advanced texture quality options
        texture.source.scaleMode = 'nearest';
        texture.updateUvs();
        
        // Try different approaches for better quality
        this.characterSprite = new Sprite(texture);
        
        // Option 1: Use a less aggressive scaling (1/3 instead of 1/5)
        this.characterSprite.width = this.characterSprite.width / 5;
        this.characterSprite.height = this.characterSprite.height / 5;
        
        // Option 2: Try even less scaling (1/2)
        // this.characterSprite.width = this.characterSprite.width / 2;
        // this.characterSprite.height = this.characterSprite.height / 2;
        
        // Option 3: Use fixed pixel dimensions that might look better
        // this.characterSprite.width = 150;
        // this.characterSprite.height = 150;

        this.characterSprite.x = -70;
        this.characterSprite.y = -80;
      } catch (error) {
        console.error(`Failed to load character image: ${characterImagePath}`, error);
        this.characterSprite = null;
      }
    }

    // Create dialog text
    this.dialogText = new Text({
      text: dialogStrings[this.currentDialogIndex],
      style: {
        fontFamily: 'Chubbo, sans-serif',
        fontSize: 16,
        fill: 0xFFFFFF,
        align: 'left',
        wordWrap: true,
        wordWrapWidth: 450,
        fontWeight: '400',
        stroke: { color: 0x000000, width: 1 },
        dropShadow: {
          color: 0x000000,
          blur: 1,
          distance: 1,
          alpha: 0.5
        },
        letterSpacing: 1, // Add space between letters
        lineHeight: 24 // Add space between lines (50% more than fontSize)
      }
    });

    // Configure text rendering for maximum crispness
    this.dialogText.resolution = window.devicePixelRatio || 1;

    // Create background rectangle
    this.backgroundGraphics = new Graphics();
    const padding = 15;
    const characterWidth = this.characterSprite ? 75 : 0; // 60px + 15px margin
    const textWidth = Math.max(this.dialogText.width, 450); // Increased from 300
    const textHeight = this.dialogText.height;
    const bgWidth = characterWidth + textWidth + (padding * 2);
    const bgHeight = Math.max(textHeight, this.characterSprite ? 60 : 0) + (padding * 2);

    // Draw background with rounded corners
    this.backgroundGraphics.roundRect(0, 0, bgWidth, bgHeight, 10);
    this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.9 });
    this.backgroundGraphics.stroke({ width: 2, color: 0xADD8E6, alpha: 0.8 });
    
    this.dialogText.x = characterWidth + padding;
    this.dialogText.y = 8;

    // Create content container for dialog box
    const contentContainer = new Container();
    
    // Add elements to content container in correct draw order (background first, then content on top)
    contentContainer.addChild(this.backgroundGraphics);
    contentContainer.addChild(this.dialogText);
    
    // Add character sprite last so it appears on top
    if (this.characterSprite) {
      // Adjust character position for larger dialog box
      this.characterSprite.x = -80;
      this.characterSprite.y = -80;
      contentContainer.addChild(this.characterSprite);
    }

    let dialogX = (TABLET_WIDTH - bgWidth) / 2;
    let dialogY = (TABLET_HEIGHT - bgHeight) / 2;

    if (position === 'bottom') {
      dialogX = (TABLET_WIDTH - bgWidth) / 2;
      dialogY = TABLET_HEIGHT - bgHeight - 20;
    }

    // Position dialog content at target location; keep overlay at 0,0
    contentContainer.x = dialogX;
    contentContainer.y = dialogY;
    this.dialogContainer.addChild(contentContainer);

    // Make dialog interactive
    this.dialogContainer.interactive = true;
    this.dialogContainer.on('pointerup', () => {
      this.nextDialog();
    });

    // Add to UI container
    this.uiContainer.addChild(this.dialogContainer);
  }

  public hideDialog(): void {
    this.isVisible = false;
    this.dialogStrings = [];
    this.currentDialogIndex = 0;

    if (this.dialogContainer) {
      this.uiContainer.removeChild(this.dialogContainer);
      this.dialogContainer = null;
    }
    
    this.characterSprite = null;
    this.dialogText = null;
    this.backgroundGraphics = null;
    this.onComplete = undefined;
  }

  public isDialogVisible(): boolean {
    return this.isVisible;
  }

  public nextDialog(): void {
    if (this.currentDialogIndex < this.dialogStrings.length - 1) {
      this.currentDialogIndex++;
      if (this.dialogText) {
        this.dialogText.text = this.dialogStrings[this.currentDialogIndex];
      }
    } else {
      // Dialog finished - call completion callback if provided before hiding
      const completionCallback = this.onComplete;
      this.hideDialog();
      if (completionCallback) {
        completionCallback();
      }
    }
  }
}
