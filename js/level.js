/**
 * Level: turns ASCII level data into a tile grid plus a list of entity spawns.
 *
 * Level data format (see levels/level1.js for a full example):
 *   {
 *     name: 'Green Ledge',
 *     theme: 'meadow',                // key into THEMES (js/themes.js)
 *     map: [                          // one string per row, one character per 32px tile
 *       '..........',
 *       '..P...o...',
 *       '##########',
 *     ],
 *     movers: [ ... ],                // moving platforms, see js/platforms.js
 *   }
 *
 * The level's left/right edges act as solid walls; falling below the bottom
 * row is a pit.
 */

/** Tile ids stored in the grid. */
const TILE = {
  EMPTY: 0,
  GROUND: 1,    // dirt with a grass top where exposed to the sky
  BRICK: 2,     // solid brick block
  ONEWAY: 3,    // wooden platform: jump up through it, land on top
  SPIKES: 4,    // hazard: costs a heart and sends you back to the checkpoint
  BACKDROP: 5,  // decorative cave wall behind the playfield (not solid)
};

/** Physical properties of each tile id. */
const TILE_PROPS = {
  [TILE.EMPTY]:    {},
  [TILE.GROUND]:   { solid: true },
  [TILE.BRICK]:    { solid: true },
  [TILE.ONEWAY]:   { oneWay: true },
  [TILE.SPIKES]:   { hazard: true },
  [TILE.BACKDROP]: {},
};

/**
 * Map characters -> what they create. An entry can set a `tile`, and/or
 * `spawn` an entity: spawn(world, tileX, tileY) is called when the level loads.
 * To add a new tile or entity type, add a character here.
 */
const LEGEND = {
  '.': {},
  ' ': {},
  '#': { tile: TILE.GROUND },
  'B': { tile: TILE.BRICK },
  '-': { tile: TILE.ONEWAY },
  '^': { tile: TILE.SPIKES },
  ':': { tile: TILE.BACKDROP },
  // Entities (their spawn functions are added as the entity types are built)
  'P': { spawn: (world, tx, ty) => world.setPlayerStart(tx, ty) },
  'o': { spawn: (world, tx, ty) => world.addItem(new Coin(tx, ty)) },
  '*': { tile: TILE.BACKDROP, spawn: (world, tx, ty) => world.addItem(new Coin(tx, ty)) }, // coin in a cave
  'e': { spawn: (world, tx, ty) => world.addEnemy(new Walker(tx, ty)) },
  'C': {},                        // checkpoint
  'G': {},                        // goal flag
};

class Level {
  constructor(data) {
    const T = CONFIG.TILE;
    this.name = data.name || 'Untitled';
    this.rows = data.map.length;
    this.cols = Math.max(...data.map.map((row) => row.length));
    this.width = this.cols * T;
    this.height = this.rows * T;
    this.tiles = new Uint8Array(this.cols * this.rows);
    this.spawns = []; // { tx, ty, spawn(world, tx, ty) }

    const unknown = new Set();
    for (let ty = 0; ty < this.rows; ty++) {
      const row = data.map[ty];
      for (let tx = 0; tx < this.cols; tx++) {
        const ch = row[tx] ?? '.'; // short rows are padded with empty space
        const entry = LEGEND[ch];
        if (!entry) { unknown.add(ch); continue; }
        if (entry.tile) this.tiles[ty * this.cols + tx] = entry.tile;
        if (entry.spawn) this.spawns.push({ tx, ty, spawn: entry.spawn });
      }
    }
    if (unknown.size) {
      console.warn(`Level "${this.name}": unknown map characters [${[...unknown].join('')}] treated as empty.`);
    }
  }

  /** Tile id at tile coords. Outside the level's columns counts as ground (side walls). */
  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.cols) return TILE.GROUND;
    if (ty < 0 || ty >= this.rows) return TILE.EMPTY;
    return this.tiles[ty * this.cols + tx];
  }

  setTile(tx, ty, id) {
    if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows) this.tiles[ty * this.cols + tx] = id;
  }

  isSolid(tx, ty) { return TILE_PROPS[this.tileAt(tx, ty)].solid === true; }
  isOneWay(tx, ty) { return TILE_PROPS[this.tileAt(tx, ty)].oneWay === true; }
  isHazard(tx, ty) { return TILE_PROPS[this.tileAt(tx, ty)].hazard === true; }
}
