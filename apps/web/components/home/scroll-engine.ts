// One animation loop shared by everything on the landing page that moves
// with the scroll or the mouse. Each layer eases toward its own target, so
// motion glides instead of stepping with every wheel tick, and because
// they all update in the same frame the layers never drift out of step.
// The loop sleeps as soon as every layer has settled.

// A layer's update runs once per frame and returns true while it still has
// further to move.
type Update = () => boolean;

const layers = new Set<Update>();
let frame = 0;

function tick() {
  frame = 0;
  let moving = false;
  for (const update of layers) {
    if (update()) moving = true;
  }
  if (moving) frame = requestAnimationFrame(tick);
}

export function wake() {
  if (!frame) frame = requestAnimationFrame(tick);
}

export function addLayer(update: Update) {
  layers.add(update);
  if (layers.size === 1) {
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
  }
  wake();

  return () => {
    layers.delete(update);
    if (layers.size === 0) {
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

export const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

// Smooth ease-in-out across [from, to], 0 before and 1 after.
export function phase(p: number, from: number, to: number) {
  const k = clamp01((p - from) / (to - from));
  return k * k * (3 - 2 * k);
}

// Moves `current` a fraction of the way to `goal`; snaps when close enough.
export function ease(current: number, goal: number, rate = 0.1) {
  const next = current + (goal - current) * rate;
  return Math.abs(goal - next) < 0.0005 ? goal : next;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Scrolls the page to an element with an eased glide. The browser's own
// smooth scrolling takes about the same short time however far it has to
// go, so a long jump down the page looks instant; here the duration grows
// with the distance. Any wheel, touch or key press hands control straight
// back to the user.
let glide = 0;

export function smoothScrollToId(id: string, offset = 64) {
  const target = document.getElementById(id);
  if (!target) return false;

  const start = window.scrollY;
  const maxScroll =
    document.documentElement.scrollHeight - window.innerHeight;
  const end = Math.min(
    Math.max(target.getBoundingClientRect().top + start - offset, 0),
    maxScroll,
  );

  if (prefersReducedMotion()) {
    window.scrollTo(0, end);
    return true;
  }

  const distance = Math.abs(end - start);
  const duration = Math.min(Math.max(distance * 0.5, 700), 1900);
  const startedAt = performance.now();

  const stop = () => {
    cancelAnimationFrame(glide);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };
  stop();
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);

  const step = (now: number) => {
    const k = clamp01((now - startedAt) / duration);
    // Ease in and out: slow start, fast middle, slow landing.
    const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    window.scrollTo(0, start + (end - start) * eased);
    if (k < 1) glide = requestAnimationFrame(step);
    else stop();
  };
  glide = requestAnimationFrame(step);
  return true;
}
