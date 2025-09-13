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

  constructor(uiContainer: Container) {
    this.uiContainer = uiContainer;
  }

  public async showDialog(dialogStrings: string[], characterImagePath?: string): Promise<void> {
    if (!dialogStrings || dialogStrings.length === 0) {
      return;
    }
    
    // Clear any existing dialog first
    this.hideDialog();
    
    this.dialogStrings = dialogStrings;
    this.currentDialogIndex = 0;
    this.isVisible = true;

    // Create new dialog container
    this.dialogContainer = new Container();

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
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xFFFFFF,
        align: 'left',
        wordWrap: true,
        wordWrapWidth: 300
      }
    });

    // Create background rectangle
    this.backgroundGraphics = new Graphics();
    const padding = 15;
    const characterWidth = this.characterSprite ? 75 : 0; // 60px + 15px margin
    const textWidth = Math.max(this.dialogText.width, 300);
    const textHeight = this.dialogText.height;
    const bgWidth = characterWidth + textWidth + (padding * 2);
    const bgHeight = Math.max(textHeight, this.characterSprite ? 60 : 0) + (padding * 2);

    // Draw background with rounded corners
    this.backgroundGraphics.roundRect(0, 0, bgWidth, bgHeight, 10);
    this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.9 });
    this.backgroundGraphics.stroke({ width: 2, color: 0xADD8E6, alpha: 0.8 });
    
    this.dialogText.x = characterWidth + padding;
    this.dialogText.y = padding;

    // Add elements to container in correct draw order (background first, then content on top)
    this.dialogContainer.addChild(this.backgroundGraphics);
    this.dialogContainer.addChild(this.dialogText);
    
    // Add character sprite last so it appears on top
    if (this.characterSprite) {
      this.dialogContainer.addChild(this.characterSprite);
    }

    // Position dialog container at bottom center of screen
    this.dialogContainer.x = (TABLET_WIDTH - bgWidth) / 2;
    this.dialogContainer.y = TABLET_HEIGHT - bgHeight - 20;

    // Make dialog interactive
    this.dialogContainer.interactive = true;
    this.dialogContainer.cursor = 'pointer';
    this.dialogContainer.on('pointerdown', () => {
      this.hideDialog();
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
      this.hideDialog();
    }
  }
}
