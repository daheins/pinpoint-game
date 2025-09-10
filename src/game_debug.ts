// Debug utilities for the pinpoint game

import { Container, Graphics, Text } from "pixi.js";
import { Level, LevelRenderer } from './level';
import type { Point } from './level';
import { TABLET_WIDTH, TABLET_HEIGHT } from './gameParams';
import { showDebugTools } from './gameParams_debug';

// Debug display elements
let coordinateDisplay: Text | null = null;
let curveDistanceDisplay: Text | null = null;
let targetCircle: Graphics | null = null;

export function createCurveDistanceDisplay(
  uiContainer: Container,
  currentLevel: Level | null,
  guess: Point,
  levelRenderer: LevelRenderer
): void {
  if (curveDistanceDisplay) {
    uiContainer.removeChild(curveDistanceDisplay);
  }
  
  if (showDebugTools && currentLevel && currentLevel.curveImage) {
    const activePercentageGuess = {
      x: (guess.x / TABLET_WIDTH) * 100,
      y: (guess.y / TABLET_HEIGHT) * 100,
    };
    
    const curveDistance = levelRenderer.getCurveDistance(activePercentageGuess);
    const distanceText = curveDistance !== null ? curveDistance.toFixed(1) : 'N/A';
    
    const text = new Text({
      text: `Curve Distance: ${distanceText}`,
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xFFFFFF,
        align: 'right'
      }
    });
    
    // Create background rectangle
    const backgroundGraphics = new Graphics();
    const padding = 8;
    const bgWidth = text.width + (padding * 2);
    const bgHeight = text.height + (padding * 2);
    
    backgroundGraphics.rect(0, 0, bgWidth, bgHeight);
    backgroundGraphics.fill({ color: 0x000000, alpha: 0.7 });
    backgroundGraphics.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.5 });
    
    // Create container for background and text
    const curveDistanceContainer = new Container();
    curveDistanceContainer.addChild(backgroundGraphics);
    curveDistanceContainer.addChild(text);
    
    // Position text within the container
    text.x = padding;
    text.y = padding;
    
    // Position container in bottom right corner, above the coordinate display
    curveDistanceContainer.x = TABLET_WIDTH - bgWidth - 10;
    curveDistanceContainer.y = TABLET_HEIGHT - (bgHeight * 2) - 20;
    
    uiContainer.addChild(curveDistanceContainer);
    curveDistanceDisplay = curveDistanceContainer as any;
  }
}

export function createCoordinateDisplay(
  uiContainer: Container,
  currentLevel: Level | null,
  guess: Point
): void {
  if (coordinateDisplay) {
    uiContainer.removeChild(coordinateDisplay);
  }
  
  if (showDebugTools && currentLevel) {
    const activePercentageGuess = {
      x: (guess.x / TABLET_WIDTH) * 100,
      y: (guess.y / TABLET_HEIGHT) * 100,
    };
    
    const text = new Text({
      text: `(x: ${activePercentageGuess.x.toFixed(1)}, y: ${activePercentageGuess.y.toFixed(1)})`,
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xFFFFFF,
        align: 'right'
      }
    });
    
    // Create background rectangle
    const backgroundGraphics = new Graphics();
    const padding = 8;
    const bgWidth = text.width + (padding * 2);
    const bgHeight = text.height + (padding * 2);
    
    backgroundGraphics.rect(0, 0, bgWidth, bgHeight);
    backgroundGraphics.fill({ color: 0x000000, alpha: 0.7 });
    backgroundGraphics.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.5 });
    
    // Create container for background and text
    const coordinateContainer = new Container();
    coordinateContainer.addChild(backgroundGraphics);
    coordinateContainer.addChild(text);
    
    // Position text within the container
    text.x = padding;
    text.y = padding;
    
    // Position container in bottom right corner with some padding
    coordinateContainer.x = TABLET_WIDTH - bgWidth - 10;
    coordinateContainer.y = TABLET_HEIGHT - bgHeight - 10;
    
    uiContainer.addChild(coordinateContainer);
    coordinateDisplay = coordinateContainer as any;
  }
}

export function createTargetCircle(
  uiContainer: Container,
  currentLevel: Level | null
): void {
  if (targetCircle) {
    uiContainer.removeChild(targetCircle);
  }
  
  if (showDebugTools && currentLevel) {
    // Convert target percentage to pixel coordinates
    const targetX = (currentLevel.target.x / 100) * TABLET_WIDTH;
    const targetY = (currentLevel.target.y / 100) * TABLET_HEIGHT;
    const radius = currentLevel.targetRadius;
    
    const circle = new Graphics();
    circle.circle(targetX, targetY, radius);
    circle.stroke({ width: 2, color: 0x0080FF, alpha: 0.8 });
    circle.fill({ color: 0x0080FF, alpha: 0.2 });
    
    uiContainer.addChild(circle);
    targetCircle = circle;
  }
}

// Function to clear all debug displays
export function clearDebugDisplays(uiContainer: Container): void {
  if (coordinateDisplay) {
    uiContainer.removeChild(coordinateDisplay);
    coordinateDisplay = null;
  }
  if (curveDistanceDisplay) {
    uiContainer.removeChild(curveDistanceDisplay);
    curveDistanceDisplay = null;
  }
  if (targetCircle) {
    uiContainer.removeChild(targetCircle);
    targetCircle = null;
  }
}
