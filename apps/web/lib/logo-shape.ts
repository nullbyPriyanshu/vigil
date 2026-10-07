// The Vigil mark, as plain polygons on a 24 x 24 grid: two slanted bars
// that make a "V", and a diamond between them (the thing being watched).
// Kept as data so the SVG logo and the particle logo in the hero draw the
// exact same shape.
export const LOGO_SIZE = 24;

export const LOGO_POLYGONS: [number, number][][] = [
  [
    [1.5, 3],
    [7.3, 3],
    [14.6, 21],
    [8.8, 21],
  ],
  [
    [16.7, 3],
    [22.5, 3],
    [15.9, 19.3],
    [13, 12.1],
  ],
  [
    [12, 1.6],
    [14.3, 5.2],
    [12, 8.8],
    [9.7, 5.2],
  ],
];
