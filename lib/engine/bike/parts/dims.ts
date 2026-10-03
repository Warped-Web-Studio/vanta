import { Vector3 } from "three";

// Hard points of the R1, in meters. Wheelbase 1,428 mm, rake 24.1°, trail 100 mm.
export const RAKE = (24.1 * Math.PI) / 180;
export const FORK_OFFSET = 0.03;

export const D = {
  rearAxle: new Vector3(-0.714, 0.315, 0),
  frontAxle: new Vector3(0.714, 0.3, 0),
  rearR: 0.315,
  frontR: 0.3,
  rimR: 0.2159,
  crank: new Vector3(0.07, 0.4, 0),
  pivot: new Vector3(-0.13, 0.44, 0),
  forkZ: 0.105,
  /** front bank 42° above horizontal, rear bank 90° behind it */
  bankF: (42 * Math.PI) / 180,
  bankR: (132 * Math.PI) / 180,
};

/** unit vector up the steering axis */
export const AXIS = new Vector3(-Math.sin(RAKE), Math.cos(RAKE), 0);
/** forward normal to the steering axis */
export const AXIS_N = new Vector3(Math.cos(RAKE), Math.sin(RAKE), 0);

/** point on a fork leg line, s meters up from the axle */
export const legPt = (s: number, z = 0) =>
  new Vector3(D.frontAxle.x + AXIS.x * s, D.frontAxle.y + AXIS.y * s, z);

/** point on the steering axis, s meters up from the axle's projection */
export const axisPt = (s: number, z = 0) => {
  const a0 = D.frontAxle.clone().addScaledVector(AXIS_N, -FORK_OFFSET);
  return new Vector3(a0.x + AXIS.x * s, a0.y + AXIS.y * s, z);
};

export const bankDir = (a: number) => new Vector3(Math.cos(a), Math.sin(a), 0);
