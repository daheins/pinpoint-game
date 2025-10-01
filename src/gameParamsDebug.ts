// Debug configuration parameters
// Default values - committed to repo
// Local overrides can be placed in gameParams_debug.ts (gitignored)

// Default debug parameters
export let showDebugTools = false;
export let showCurve = false;
export let showLevelSelector = false;
export let includeTestLevels = false;

// Try to load local overrides if they exist
try {
  const localOverrides = await import('./gameParams_debug.js');
  if (localOverrides.showDebugTools !== undefined) showDebugTools = localOverrides.showDebugTools;
  if (localOverrides.showCurve !== undefined) showCurve = localOverrides.showCurve;
  if (localOverrides.showLevelSelector !== undefined) showLevelSelector = localOverrides.showLevelSelector;
  if (localOverrides.includeTestLevels !== undefined) includeTestLevels = localOverrides.includeTestLevels;
} catch {
  // No local overrides file - use defaults
  // This is expected for fresh clones of the repo
}
