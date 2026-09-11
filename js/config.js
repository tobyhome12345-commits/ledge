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

    // Running: accelerate toward max speed rather than snapping to it.
    maxRunSpeed: 230,
    groundAccel: 1900,  // speeding up on the ground
    groundDecel: 2400,  // slowing down with no input (stops in ~11px)
    turnAccel: 3600,    // reversing direction on the ground - snappy turnarounds
    airAccel: 1300,     // steering in mid-air
    airDecel: 500,      // in the air you keep most of your momentum
    airTurnAccel: 2000,

    // Jumps are designed by height and time, and gravity is derived from them,
    // so you can say "jump 3.5 tiles high, taking 0.38s to peak" directly.
    jumpHeight: 112,      // px at the peak of a full (held) jump = 3.5 tiles
    jumpTimeToApex: 0.38, // seconds from take-off to the peak
    fallGravityMult: 1.55,   // fall faster than you rise: weighty, not floaty
    lowJumpGravityMult: 2.8, // extra gravity while rising with jump released -> tap = short hop
    apexThreshold: 70,       // |vy| below this counts as "the top of the jump"...
    apexGravityMult: 0.6,    // ...where gravity lightens while jump is held (a little hang time)
    maxFallSpeed: 720,

    // Forgiveness: these are what make a platformer feel fair.
    coyoteTime: 0.1,       // you can still jump this long after running off a ledge
    jumpBufferTime: 0.12,  // a jump pressed this long before landing still happens
    cornerCorrection: 6,   // px we slide around a ceiling corner instead of bonking

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
