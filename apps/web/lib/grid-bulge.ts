// Geometry for the backdrop grid and the dome ("bulge") that rises under the
// cursor. Pure path-building, no DOM: the canvas layer calls addBulgedGrid()
// each frame and strokes whatever it returns.

const GRID_CELL = 56;

// Width of the dome in px. Everything below is tuned around this.
const SIGMA = 100;
// Past this distance the dome is under 0.2% of its peak, so lines are left
// perfectly straight (which also lets us skip sampling most of the grid).
const REACH = SIGMA * 3.6;
// At the peak, grid cells are this much larger (0.3 = 30%), like the surface
// is being pushed toward the viewer.
const MAGNIFY = 0.3;
// The peak is also nudged up by this many px. Magnification alone reads as a
// flat lens; the lift is what makes it look raised.
const LIFT = 12;
// Vertex spacing along a line while it's curving. Small enough that the
// straight segments between vertices read as a smooth curve.
const STEP = 7;

// Maps (x, y) onto the dome centered on (cx, cy). `strength` scales the whole
// dome from 0 (flat) to 1 (full height) so it can rise and settle. `bulge`
// additionally scales how pronounced the dome is (magnify + lift) without
// changing its width, so a page can ask for a subtler rise. The mapping
// stays monotonic (lines never cross or fold) for MAGNIFY * bulge < ~2.
function bend(
  x: number,
  y: number,
  cx: number,
  cy: number,
  strength: number,
  bulge: number,
): [number, number] {
  const rx = x - cx;
  const ry = y - cy;
  const height = Math.exp(-(rx * rx + ry * ry) / (2 * SIGMA * SIGMA)) * strength;
  const scale = 1 + MAGNIFY * bulge * height;
  return [cx + rx * scale, cy + ry * scale - LIFT * bulge * height];
}

// One grid line. `vertical` lines run along y at x = pos, horizontal ones
// along x at y = pos. Only the stretch within REACH of the cursor is sampled
// and bent; the rest is a single straight segment on each side.
function addLine(
  path: Path2D,
  vertical: boolean,
  pos: number,
  length: number,
  cx: number,
  cy: number,
  strength: number,
  bulge: number,
) {
  const flat = (t: number): [number, number] => (vertical ? [pos, t] : [t, pos]);
  const bent = (t: number) => bend(...flat(t), cx, cy, strength, bulge);

  const across = vertical ? cx : cy;
  const along = vertical ? cy : cx;
  const offset = Math.abs(pos - across);

  if (strength <= 0 || offset >= REACH) {
    path.moveTo(...flat(0));
    path.lineTo(...flat(length));
    return;
  }

  // Half-length of the stretch of this line that falls inside the dome.
  const half = Math.sqrt(REACH * REACH - offset * offset);
  const from = Math.max(0, Math.floor((along - half) / STEP) * STEP);
  const to = Math.min(length, Math.ceil((along + half) / STEP) * STEP);

  if (from > 0) {
    path.moveTo(...flat(0));
  } else {
    // Starting inside the dome: begin on the bent point, not the flat one,
    // or there'd be a stray segment between the two.
    path.moveTo(...bent(0));
  }
  for (let t = from > 0 ? from : STEP; t <= to; t += STEP) {
    path.lineTo(...bent(t));
  }
  if (to < length) path.lineTo(...flat(length));
}

// Adds the whole grid to `path`, with the dome centered on (cx, cy). `bulge`
// scales how pronounced the dome is (1 = full effect); defaults to 1 so
// existing callers are unaffected.
export function addBulgedGrid(
  path: Path2D,
  width: number,
  height: number,
  cx: number,
  cy: number,
  strength: number,
  bulge = 1,
) {
  // +0.5 puts each 1px line on a pixel boundary so it stays crisp. Lines run
  // one cell past the edge because the dome pushes lines outward.
  for (let x = 0; x <= width + GRID_CELL; x += GRID_CELL) {
    addLine(path, true, x + 0.5, height, cx, cy, strength, bulge);
  }
  for (let y = 0; y <= height + GRID_CELL; y += GRID_CELL) {
    addLine(path, false, y + 0.5, width, cx, cy, strength, bulge);
  }
}
