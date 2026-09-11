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

  player: {
    width: 22,          // hitbox size (fits through 1-tile gaps)
    height: 30,
    maxRunSpeed: 230,

    // Jumps are designed by height and time, and gravity is derived from them,
    // so you can say "jump 3.5 tiles high, taking 0.38s to peak" directly.
    jumpHeight: 112,      // px at the peak of a full (held) jump = 3.5 tiles
    jumpTimeToApex: 0.38, // seconds from take-off to the peak
    maxFallSpeed: 720,

    get gravity() { return (2 * this.jumpHeight) / this.jumpTimeToApex ** 2; },
    get jumpVelocity() { return (2 * this.jumpHeight) / this.jumpTimeToApex; },
  },

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
