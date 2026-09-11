/**
 * Visual themes: colour palettes for the sky, parallax layers and tiles.
 * A level picks one with `theme: 'meadow'`. Add a key here to make a new look.
 */
const THEMES = {
  meadow: {
    skyTop: '#4aa3df', skyBottom: '#c4e9f8',
    sun: '#fff6cf', sunGlow: 'rgba(255, 246, 207, 0.25)',
    cloud: '#ffffff',
    far: '#a3c6dc', farPeak: '#e9f4f9',   // distant mountains + snow caps
    mid: '#86bf93',                        // rolling hills
    near: '#67a974',                       // nearest hills
    dirt: '#8a5a36', dirtDark: '#71472a', dirtEdge: '#5c3920',
    grass: '#58b847', grassLight: '#8fdc5e',
    brick: '#d77a48', brickLight: '#f2a36f', brickDark: '#9c4f2a',
    plank: '#c99152', plankLight: '#e8b877', plankDark: '#7d5029',
    spike: '#e7ebf2', spikeShade: '#a9b2c3', spikeBase: '#59606e',
    cave: '#4f3421', caveDark: '#3e281a',
  },

  dusk: {
    skyTop: '#3b2d6b', skyBottom: '#f59f7a',
    sun: '#ffd9a0', sunGlow: 'rgba(255, 190, 120, 0.25)',
    cloud: '#ffc9b5',
    far: '#7a5a8f', farPeak: '#b58aa8',
    mid: '#5d4a7d',
    near: '#46396a',
    dirt: '#6b4a5a', dirtDark: '#573b49', dirtEdge: '#442d39',
    grass: '#d9855a', grassLight: '#f5b27e',
    brick: '#8a7fa8', brickLight: '#b3a9cf', brickDark: '#5f567d',
    plank: '#b07a4f', plankLight: '#d9a273', plankDark: '#6e4529',
    spike: '#f1e6f0', spikeShade: '#b9a5bd', spikeBase: '#4d3d57',
    cave: '#3d2b3a', caveDark: '#2f2130',
  },
};
