/**
 * Level registry. Each file in /levels pushes its level data onto LEVELS and
 * the game plays them in order.
 *
 * To add a level:
 *   1. Copy levels/level1.js to levels/level3.js (or whatever) and edit the map.
 *   2. Add <script src="levels/level3.js"></script> to index.html, after this file.
 * No engine code needs to change. The map legend lives in js/level.js (LEGEND).
 */
const LEVELS = [];
