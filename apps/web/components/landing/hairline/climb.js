/**
 * Climb: a flight of five steps on a plinth, Applied at the foot and Hired on
 * the deeper landing, with a rail on posts along the far side and a pawn on
 * the first tread. The pointer picks a step; the pawn hops to it one tread at
 * a time on the 700ms curve, and that step's tread takes the bright edge. At
 * rest the pawn waits at the foot and the landing is bright. The slider is the
 * height of each hop.
 *
 * The pattern: discrete items at different heights. One tween for which step,
 * read as a position along the flight; a hit test that casts the pointer's
 * ray through each step's resting block, nearest first, so the pawn moving
 * can never change the choice.
 *
 * Drawn with the hairline-create skill: the bench source is
 * .scratch/landing/hairline/climb.js. Change it there, check it with the
 * skill's look.mjs, then copy the body here; only the import and the export
 * at the bottom differ.
 */
import HL from "./kernel.js";

const {
  Cam, circ, clamp, facing, fit, hull, lerp, poly, prism, proj, r2, ringAt, rings, unproj,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const N = 5, W = 64, D = 28, DL = 44, HS = 10, PT = 2.2, NOSE = 2.4, L = (N - 1) * D + DL;
const RAIL_X = 4, RAIL_H = 20, HOP_MAX = 16, PAWN_H = 29.3;
const STAGES = ["applied", "screening", "interview", "offer", "hired"];

/** Step i, from the foot (0) to the landing (N - 1): its back and front edges along y, its middle, and its tread's height. */
const y0 = (i) => (i < N - 1 ? L - (i + 1) * D : 0);
const y1 = (i) => (i < N - 1 ? L - i * D : DL);
const cy = (i) => (y0(i) + y1(i)) / 2;
const top = (i) => (i + 1) * HS;
const smooth = (t) => t * t * (3 - 2 * t);

/** The pawn's foot at s, a position along the flight in steps: it rises to the next tread's height in the first tenth, before its foot reaches the nosing, and arcs by `hop`. */
function pawnAt(s, hop) {
  const i = Math.min(Math.floor(s), N - 2), f = s - i;
  return [W / 2, lerp(cy(i), cy(i + 1), f), top(i) + HS * smooth(clamp(f / 0.1, 0, 1)) + hop * Math.sin(Math.PI * f)];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let hop = value;

  // The camera is fitted to the plinth, the rail's top and the pawn at the top of its highest hop.
  const C = Cam(45, 0.5, 1.55);
  const peak = pawnAt(N - 1.5, HOP_MAX);
  fit(C, [
    [-9, -9, -3], [W + 9, -9, -3], [-9, L + 16, -3], [W + 9, L + 16, -3],
    [RAIL_X, 8, top(N - 1) + RAIL_H + 2], [peak[0], peak[1], peak[2] + PAWN_H],
  ], 200, 166);
  const P = proj(C), front = facing(C);
  /** P moved to (x, y, z), for a part built round its own origin. */
  const off = (x, y, z) => (u, v, w) => P(x + u, y + v, z + w);
  const g = mk("g", {}, svg);

  // The plinth, then the steps from the landing down to the foot: a nearer step is lower, so it covers the one behind.
  const [br, bi] = rings(-9, -9, W + 9, L + 16, 9, 2);
  put(solid(g), prism(P, front, br, bi, -3, 0));
  const posts = (i) => (i < N - 1 ? [cy(i)] : [8, cy(N - 2) - D]);
  const treads = [];
  for (let i = N - 1; i >= 0; i--) {
    const [r0, c0] = rings(0, y0(i), W, y1(i), 3, 1.2);
    put(solid(g), prism(P, front, r0, c0, 0, top(i) - PT));
    // the tread: a thin plate whose nosing overhangs the riser below it
    const [r1, c1] = rings(-1, y0(i), W + 1, y1(i) + NOSE, 2.4, 1);
    treads[i] = solid(g);
    put(treads[i], prism(P, front, r1, c1, top(i) - PT, top(i)));
    for (const y of posts(i)) {
      const [r2p, c2p] = rings(RAIL_X - 1.3, y - 1.3, RAIL_X + 1.3, y + 1.3, 1.3, 0.5);
      put(solid(g), prism(P, front, r2p, c2p, top(i), top(i) + RAIL_H));
    }
  }

  // The rail rides the post tops: up the flight, then level along the landing. Each run is the hull of two small rings.
  const bead = circ(1.8, 12), railTop = top(N - 1) + RAIL_H;
  const tube = (a, b) => mk("path", { d: poly(hull(ringAt(off(...a), bead, 0).concat(ringAt(off(...b), bead, 0)))), class: "sil" }, g);
  tube([RAIL_X, 8, railTop], [RAIL_X, cy(N - 2) - D, railTop]);
  tube([RAIL_X, cy(N - 2) - D, railTop], [RAIL_X, cy(0), top(0) + RAIL_H]);

  // The pawn, painted last: it always stands on or above the treads, and every step nearer than it is lower.
  const pg = mk("g", {}, g);
  const foot = solid(pg), neck = mk("path", { class: "sil" }, pg), collar = solid(pg);
  const head = mk("ellipse", { class: "sil" }, pg);
  const FOOT = [circ(8.3, 24), circ(7.2, 24)], NECK = [circ(6, 24), circ(3, 24)], COLLAR = [circ(4.9, 20), circ(4, 20)];
  // a ball's outline is a circle whose radius is the screen length of a world unit across the view
  const o = P(0, 0, 0), e = P(Math.SQRT1_2, -Math.SQRT1_2, 0), HR = r2(5.7 * Math.hypot(e[0] - o[0], e[1] - o[1]));
  let drawnS = NaN, drawnHop = NaN;

  function drawPawn(s) {
    if (s === drawnS && hop === drawnHop) return;
    drawnS = s; drawnHop = hop;
    const Q = off(...pawnAt(s, hop));
    put(foot, prism(Q, front, FOOT[0], FOOT[1], 0, 3));
    neck.setAttribute("d", poly(hull(ringAt(Q, NECK[0], 3).concat(ringAt(Q, NECK[1], 16.9)))));
    put(collar, prism(Q, front, COLLAR[0], COLLAR[1], 16.9, 19));
    const c = Q(0, 0, 23.6);
    for (const [k, v] of [["cx", c[0]], ["cy", c[1]], ["rx", HR], ["ry", HR]]) head.setAttribute(k, r2(v));
  }

  const tw = tween(0);
  const B = register(stage, (_dt, now) => {
    drawPawn(tval(tw, now));
    return !tdone(tw, now);
  });
  bag.add(B.unregister);

  /** Whether the view ray through a screen point meets step i's resting block, between its tread and the ground. */
  function onStep(i, sx, sy) {
    const a = unproj(C, sx, sy, top(i)), b = unproj(C, sx, sy, 0);
    let t0 = 0, t1 = 1;
    for (const [k, lo, hi] of [[0, -1, W + 1], [1, y0(i), y1(i) + NOSE]]) {
      const d = b[k] - a[k];
      if (Math.abs(d) < 1e-9) { if (a[k] < lo || a[k] > hi) return false; continue; }
      const u = (lo - a[k]) / d, v = (hi - a[k]) / d;
      t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
    }
    return t0 <= t1;
  }
  /** The step under the point, nearest first, as the paint order stacks them; -1 off the flight. */
  const hit = ([sx, sy]) => { for (let i = 0; i < N; i++) if (onStep(i, sx, sy)) return i; return -1; };

  let act = null;
  /** Sends the pawn to step a (-1 sends it back to the foot); the bright edge goes to that step, or to the landing at rest. */
  function setActive(a) {
    if (a === act) return;
    act = a;
    tset(tw, Math.max(a, 0), performance.now(), 0);
    treads.forEach((t, i) => t.sil.classList.toggle("hi", i === (a < 0 ? N - 1 : a)));
    read.textContent = a < 0 ? "rest" : STAGES[a];
    B.wake();
  }
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { hop = v; B.wake(); },
    destroy: bag.dispose,
  };
}

/** The figure, as the skill declares it: what mount draws, its slider range, and the tour the page plays. */
export const climb = {
  name: "climb",
  means: "A flight of five steps from applied to hired: the pointer picks a step, and the pawn hops to it one tread at a time.",
  rules: [1, 5, 6, 8],
  range: [6, 10, 16],
  tour: [[164, 195], [226, 138], [265, 104], null],
  mount,
};
