/**
 * Ledge — global configuration.
 *
 * Every "feel" number lives here so the game can be tuned without digging
 * through engine code. Units are world pixels and seconds unless noted.
 */
const CONFIG = {
  TILE: 32,         // tile size in world pixels
  VIEW_W: 960,      // logical screen size: how much of the world is visible
  VIEW_H: 540,
  STEP: 1 / 60,     // fixed physics timestep (physics always runs at 60 Hz)
  MAX_FRAME: 0.25,  // longest frame we simulate (avoids a "spiral of death" after tab switches)

  camera: {
    followRate: 6,     // horizontal easing speed (higher = snappier)
    followRateY: 5,    // vertical easing speed
    lookAhead: 80,     // how far ahead of the player (in the facing direction) to look
    lookRate: 2.5,     // how quickly the look-ahead swings when turning around
    focusRatio: 0.62,  // where the player's feet sit vertically (0 = top, 1 = bottom)
    deadZoneUp: 120,   // while airborne, only follow upward after rising this far (> jump height)
    deadZoneDown: 24,  // ...and follow downward after falling this far
  },
};
