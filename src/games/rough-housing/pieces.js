/*
 * Foam piece dimensions shared by the arena and the random-fort layouts.
 * Kept free of DOM/three imports so the layout generator can be tested in Node.
 */
export const PIECE_DEFS = {
  base: { label: 'Base', total: 10, mass: 9, size: [6.6, 0.875, 3.3] },
  cushion: { label: 'Cushion', total: 10, mass: 6, panel: [3.3, 0.55, 3.3], defaultFold: Math.PI / 3 },
  bent: { label: 'Bent base', total: 4, mass: 10, panel: [3.3, 0.875, 3.3], defaultFold: Math.PI / 2 },
  triangle: { label: 'Triangle', total: 20, mass: 2.4, size: [2.6, 1.4, 2.4] },
};
