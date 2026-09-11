/**
 * Physics: collision between axis-aligned boxes and the tile grid.
 *
 * A body is any object with {x, y, w, h} (top-left corner + size, in world
 * pixels). Movement is resolved one axis at a time - move along X and push
 * out of walls, then move along Y and push out of floors/ceilings - which is
 * the classic, robust approach for tile platformers.
 *
 * Bodies must move less than one tile per step (32px at 60 Hz = 1920 px/s);
 * the speed caps in CONFIG keep us far below that, so nothing tunnels.
 */
const Physics = {
  EPS: 1e-4, // keeps a box touching a tile edge from counting as "inside" it

  /** Does the box overlap any solid tile? */
  boxHitsSolid(level, x, y, w, h) {
    const T = CONFIG.TILE;
    const x0 = Math.floor(x / T);
    const x1 = Math.floor((x + w - Physics.EPS) / T);
    const y0 = Math.floor(y / T);
    const y1 = Math.floor((y + h - Physics.EPS) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (level.isSolid(tx, ty)) return true;
      }
    }
    return false;
  },

  /**
   * Move a body horizontally, stopping flush against solid tiles.
   * @returns -1 / 1 if a wall on the left / right stopped it, otherwise 0
   */
  moveX(body, dx, level) {
    if (dx === 0) return 0;
    const T = CONFIG.TILE;
    const EPS = Physics.EPS;
    body.x += dx;
    const y0 = Math.floor(body.y / T);
    const y1 = Math.floor((body.y + body.h - EPS) / T);
    const tx = dx > 0 ? Math.floor((body.x + body.w - EPS) / T) : Math.floor(body.x / T);
    for (let ty = y0; ty <= y1; ty++) {
      if (level.isSolid(tx, ty)) {
        body.x = dx > 0 ? tx * T - body.w : (tx + 1) * T;
        return dx > 0 ? 1 : -1;
      }
    }
    return 0;
  },

  /**
   * Move a body vertically. It lands on solid tiles and on top of one-way
   * platforms (unless `dropThrough` is set), and bumps into ceilings.
   * @returns {{landed: boolean, bumped: boolean, ground: 'solid'|'oneway'|null}}
   */
  moveY(body, dy, level, dropThrough = false) {
    const result = { landed: false, bumped: false, ground: null };
    if (dy === 0) return result;
    const T = CONFIG.TILE;
    const EPS = Physics.EPS;
    const prevBottom = body.y + body.h;
    body.y += dy;
    const x0 = Math.floor(body.x / T);
    const x1 = Math.floor((body.x + body.w - EPS) / T);

    if (dy > 0) {
      const ty = Math.floor((body.y + body.h - EPS) / T);
      const top = ty * T;
      for (let tx = x0; tx <= x1; tx++) {
        if (level.isSolid(tx, ty)) { result.ground = 'solid'; break; }
        // One-way platforms only catch you if your feet were above them before this move.
        if (!dropThrough && level.isOneWay(tx, ty) && prevBottom <= top + EPS) result.ground = 'oneway';
      }
      if (result.ground) {
        body.y = top - body.h;
        result.landed = true;
      }
    } else {
      const ty = Math.floor(body.y / T);
      for (let tx = x0; tx <= x1; tx++) {
        if (level.isSolid(tx, ty)) {
          body.y = (ty + 1) * T;
          result.bumped = true;
          break;
        }
      }
    }
    return result;
  },
};
