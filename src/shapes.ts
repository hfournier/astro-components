// M3's shapes and the morphs between them, ported from AndroidX's graphics-shapes library and
// Compose Material 3's MaterialShapes, which Compose's loading indicator draws with:
// https://github.com/androidx/androidx/tree/androidx-main/graphics/graphics-shapes
// https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt
//
// Copyright 2022-2025 The Android Open Source Project
// Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0).
// Ported to TypeScript, keeping only what the loading indicator uses.
//
// A shape is a closed outline of cubic Béziers. A morph pairs the two shapes' cubics one to one,
// matching corners to the nearest corners, so blending each pair's points draws the shape
// between them.

type Point = { x: number; y: number };

const point = (x: number, y: number): Point => ({ x, y });
const plus = (a: Point, b: Point) => point(a.x + b.x, a.y + b.y);
const minus = (a: Point, b: Point) => point(a.x - b.x, a.y - b.y);
const times = (a: Point, n: number) => point(a.x * n, a.y * n);
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const length = (a: Point) => Math.hypot(a.x, a.y);
const rotate90 = (a: Point) => point(-a.y, a.x);
const direction = (a: Point) => {
  const d = length(a);
  if (!(d > 0)) throw new Error("Can't get the direction of a 0-length vector");
  return times(a, 1 / d);
};
const lerp = (start: number, stop: number, fraction: number) =>
  (1 - fraction) * start + fraction * stop;
const lerpPoint = (start: Point, stop: Point, fraction: number) =>
  point(lerp(start.x, stop.x, fraction), lerp(start.y, stop.y, fraction));
const radialToCartesian = (
  radius: number,
  angle: number,
  center = point(0, 0)
) => plus(times(point(Math.cos(angle), Math.sin(angle)), radius), center);
const positiveModulo = (num: number, mod: number) => ((num % mod) + mod) % mod;
const convex = (previous: Point, current: Point, next: Point) => {
  const a = minus(current, previous);
  const b = minus(next, current);
  return a.x * b.y - a.y * b.x > 0;
};

const DistanceEpsilon = 1e-4;
const AngleEpsilon = 1e-6;

type Transform = (p: Point) => Point;

// A cubic Bézier: anchor0, control0, control1, anchor1, as x and y pairs
export class Cubic {
  constructor(readonly points: number[]) {}

  static of(a0: Point, c0: Point, c1: Point, a1: Point) {
    return new Cubic([a0.x, a0.y, c0.x, c0.y, c1.x, c1.y, a1.x, a1.y]);
  }

  static straightLine(x0: number, y0: number, x1: number, y1: number) {
    return new Cubic([
      x0,
      y0,
      lerp(x0, x1, 1 / 3),
      lerp(y0, y1, 1 / 3),
      lerp(x0, x1, 2 / 3),
      lerp(y0, y1, 2 / 3),
      x1,
      y1,
    ]);
  }

  static circularArc(center: Point, p0: Point, p1: Point) {
    const p0d = direction(minus(p0, center));
    const p1d = direction(minus(p1, center));
    const rotatedP0 = rotate90(p0d);
    const rotatedP1 = rotate90(p1d);
    const clockwise = dot(rotatedP0, minus(p1, center)) >= 0;
    const cosa = dot(p0d, p1d);
    if (cosa > 0.999) return Cubic.straightLine(p0.x, p0.y, p1.x, p1.y);
    const k =
      ((((length(minus(p0, center)) * 4) / 3) *
        (Math.sqrt(2 * (1 - cosa)) - Math.sqrt(1 - cosa * cosa))) /
        (1 - cosa)) *
      (clockwise ? 1 : -1);
    return Cubic.of(
      p0,
      plus(p0, times(rotatedP0, k)),
      minus(p1, times(rotatedP1, k)),
      p1
    );
  }

  get anchor0() {
    return point(this.points[0], this.points[1]);
  }
  get control0() {
    return point(this.points[2], this.points[3]);
  }
  get control1() {
    return point(this.points[4], this.points[5]);
  }
  get anchor1() {
    return point(this.points[6], this.points[7]);
  }

  pointOnCurve(t: number) {
    const u = 1 - t;
    const [a0x, a0y, c0x, c0y, c1x, c1y, a1x, a1y] = this.points;
    return point(
      a0x * u * u * u +
        c0x * 3 * t * u * u +
        c1x * 3 * t * t * u +
        a1x * t * t * t,
      a0y * u * u * u +
        c0y * 3 * t * u * u +
        c1y * 3 * t * t * u +
        a1y * t * t * t
    );
  }

  zeroLength() {
    const [a0x, a0y, , , , , a1x, a1y] = this.points;
    return (
      Math.abs(a0x - a1x) < DistanceEpsilon &&
      Math.abs(a0y - a1y) < DistanceEpsilon
    );
  }

  // The control points' bounds: Compose's polygons measure themselves this way
  bounds(): [number, number, number, number] {
    const xs = [0, 2, 4, 6].map((i) => this.points[i]);
    const ys = [1, 3, 5, 7].map((i) => this.points[i]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  split(t: number): [Cubic, Cubic] {
    const u = 1 - t;
    const p = this.pointOnCurve(t);
    const [a0x, a0y, c0x, c0y, c1x, c1y, a1x, a1y] = this.points;
    return [
      new Cubic([
        a0x,
        a0y,
        a0x * u + c0x * t,
        a0y * u + c0y * t,
        a0x * u * u + c0x * 2 * u * t + c1x * t * t,
        a0y * u * u + c0y * 2 * u * t + c1y * t * t,
        p.x,
        p.y,
      ]),
      new Cubic([
        p.x,
        p.y,
        c0x * u * u + c1x * 2 * u * t + a1x * t * t,
        c0y * u * u + c1y * 2 * u * t + a1y * t * t,
        c1x * u + a1x * t,
        c1y * u + a1y * t,
        a1x,
        a1y,
      ]),
    ];
  }

  reverse() {
    const [a0x, a0y, c0x, c0y, c1x, c1y, a1x, a1y] = this.points;
    return new Cubic([a1x, a1y, c1x, c1y, c0x, c0y, a0x, a0y]);
  }

  transformed(f: Transform) {
    return Cubic.of(
      f(this.anchor0),
      f(this.control0),
      f(this.control1),
      f(this.anchor1)
    );
  }
}

type CornerRounding = { radius: number; smoothing: number };
const rounding = (radius = 0, smoothing = 0): CornerRounding => ({
  radius,
  smoothing,
});
const Unrounded = rounding();

// A polygon's outline is a run of features: rounded corners, and the edges between them
class Feature {
  constructor(
    readonly cubics: Cubic[],
    readonly corner: boolean,
    readonly convex = false
  ) {}

  transformed(f: Transform) {
    return new Feature(
      this.cubics.map((c) => c.transformed(f)),
      this.corner,
      this.convex
    );
  }
}

class RoundedCorner {
  readonly d1: Point;
  readonly d2: Point;
  readonly cornerRadius: number;
  readonly smoothing: number;
  readonly expectedRoundCut: number;

  constructor(
    readonly p0: Point,
    readonly p1: Point,
    readonly p2: Point,
    rounding: CornerRounding
  ) {
    const v01 = minus(p0, p1);
    const v21 = minus(p2, p1);
    const d01 = length(v01);
    const d21 = length(v21);
    if (d01 > 0 && d21 > 0) {
      this.d1 = times(v01, 1 / d01);
      this.d2 = times(v21, 1 / d21);
      this.cornerRadius = rounding.radius;
      this.smoothing = rounding.smoothing;
      const cosAngle = dot(this.d1, this.d2);
      const sinAngle = Math.sqrt(1 - cosAngle * cosAngle);
      this.expectedRoundCut =
        sinAngle > 1e-3 ? (this.cornerRadius * (cosAngle + 1)) / sinAngle : 0;
    } else {
      this.d1 = point(0, 0);
      this.d2 = point(0, 0);
      this.cornerRadius = 0;
      this.smoothing = 0;
      this.expectedRoundCut = 0;
    }
  }

  get expectedCut() {
    return (1 + this.smoothing) * this.expectedRoundCut;
  }

  getCubics(allowedCut0: number, allowedCut1: number): Cubic[] {
    const allowedCut = Math.min(allowedCut0, allowedCut1);
    const { p0, p1, p2, d1, d2 } = this;
    if (
      this.expectedRoundCut < DistanceEpsilon ||
      allowedCut < DistanceEpsilon ||
      this.cornerRadius < DistanceEpsilon
    ) {
      return [Cubic.straightLine(p1.x, p1.y, p1.x, p1.y)];
    }
    const actualRoundCut = Math.min(allowedCut, this.expectedRoundCut);
    const actualSmoothing0 = this.actualSmoothing(allowedCut0);
    const actualSmoothing1 = this.actualSmoothing(allowedCut1);
    const actualR =
      (this.cornerRadius * actualRoundCut) / this.expectedRoundCut;
    const centerDistance = Math.sqrt(
      actualR * actualR + actualRoundCut * actualRoundCut
    );
    const center = plus(
      p1,
      times(direction(times(plus(d1, d2), 0.5)), centerDistance)
    );
    const circleIntersection0 = plus(p1, times(d1, actualRoundCut));
    const circleIntersection2 = plus(p1, times(d2, actualRoundCut));
    const flanking0 = this.flankingCurve(
      actualRoundCut,
      actualSmoothing0,
      p1,
      p0,
      circleIntersection0,
      circleIntersection2,
      center,
      actualR
    );
    const flanking2 = this.flankingCurve(
      actualRoundCut,
      actualSmoothing1,
      p1,
      p2,
      circleIntersection2,
      circleIntersection0,
      center,
      actualR
    ).reverse();
    return [
      flanking0,
      Cubic.circularArc(center, flanking0.anchor1, flanking2.anchor0),
      flanking2,
    ];
  }

  private actualSmoothing(allowedCut: number) {
    if (allowedCut > this.expectedCut) return this.smoothing;
    if (allowedCut > this.expectedRoundCut) {
      return (
        (this.smoothing * (allowedCut - this.expectedRoundCut)) /
        (this.expectedCut - this.expectedRoundCut)
      );
    }
    return 0;
  }

  private flankingCurve(
    actualRoundCut: number,
    actualSmoothing: number,
    corner: Point,
    sideStart: Point,
    circleSegmentIntersection: Point,
    otherCircleSegmentIntersection: Point,
    circleCenter: Point,
    actualR: number
  ) {
    const sideDirection = direction(minus(sideStart, corner));
    const curveStart = plus(
      corner,
      times(sideDirection, actualRoundCut * (1 + actualSmoothing))
    );
    const p = lerpPoint(
      circleSegmentIntersection,
      times(
        plus(circleSegmentIntersection, otherCircleSegmentIntersection),
        0.5
      ),
      actualSmoothing
    );
    const curveEnd = plus(
      circleCenter,
      times(direction(minus(p, circleCenter)), actualR)
    );
    const circleTangent = rotate90(minus(curveEnd, circleCenter));
    const anchorEnd =
      lineIntersection(sideStart, sideDirection, curveEnd, circleTangent) ??
      circleSegmentIntersection;
    const anchorStart = times(plus(curveStart, times(anchorEnd, 2)), 1 / 3);
    return Cubic.of(curveStart, anchorStart, anchorEnd, curveEnd);
  }
}

const lineIntersection = (p0: Point, d0: Point, p1: Point, d1: Point) => {
  const rotatedD1 = rotate90(d1);
  const den = dot(d0, rotatedD1);
  if (Math.abs(den) < DistanceEpsilon) return null;
  const num = dot(minus(p1, p0), rotatedD1);
  if (Math.abs(den) < DistanceEpsilon * Math.abs(num)) return null;
  return plus(p0, times(d0, num / den));
};

export class RoundedPolygon {
  readonly cubics: Cubic[];

  constructor(
    readonly features: Feature[],
    readonly center: Point
  ) {
    // The outline starts halfway round the first corner, so a morph doesn't start on one
    const cubics: Cubic[] = [];
    let firstCubic: Cubic | undefined;
    let lastCubic: Cubic | undefined;
    let firstFeatureSplitStart: Cubic[] | undefined;
    let firstFeatureSplitEnd: Cubic[] | undefined;
    if (features.length > 0 && features[0].cubics.length === 3) {
      const [start, end] = features[0].cubics[1].split(0.5);
      firstFeatureSplitStart = [features[0].cubics[0], start];
      firstFeatureSplitEnd = [end, features[0].cubics[2]];
    }
    for (let i = 0; i <= features.length; i++) {
      let featureCubics: Cubic[];
      if (i === 0 && firstFeatureSplitEnd) featureCubics = firstFeatureSplitEnd;
      else if (i === features.length) {
        if (!firstFeatureSplitStart) break;
        featureCubics = firstFeatureSplitStart;
      } else featureCubics = features[i].cubics;
      for (const cubic of featureCubics) {
        if (!cubic.zeroLength()) {
          if (lastCubic) cubics.push(lastCubic);
          lastCubic = cubic;
          firstCubic ??= cubic;
        } else if (lastCubic) {
          const points = [...lastCubic.points];
          points[6] = cubic.points[6];
          points[7] = cubic.points[7];
          lastCubic = new Cubic(points);
        }
      }
    }
    if (lastCubic && firstCubic) {
      cubics.push(
        Cubic.of(
          lastCubic.anchor0,
          lastCubic.control0,
          lastCubic.control1,
          firstCubic.anchor0
        )
      );
    } else {
      cubics.push(Cubic.of(center, center, center, center));
    }
    this.cubics = cubics;
  }

  // From its vertices, each corner rounded as asked, and cut back where two roundings would
  // overlap along a side
  static fromVertices(
    vertices: Point[],
    corner: CornerRounding = Unrounded,
    perVertexRounding?: CornerRounding[],
    center?: Point
  ) {
    const n = vertices.length;
    const roundedCorners = vertices.map(
      (vertex, i) =>
        new RoundedCorner(
          vertices[(i + n - 1) % n],
          vertex,
          vertices[(i + 1) % n],
          perVertexRounding?.[i] ?? corner
        )
    );
    const cutAdjusts = vertices.map((vertex, i): [number, number] => {
      const next = (i + 1) % n;
      const expectedRoundCut =
        roundedCorners[i].expectedRoundCut +
        roundedCorners[next].expectedRoundCut;
      const expectedCut =
        roundedCorners[i].expectedCut + roundedCorners[next].expectedCut;
      const sideSize = length(minus(vertex, vertices[next]));
      if (expectedRoundCut > sideSize) return [sideSize / expectedRoundCut, 0];
      if (expectedCut > sideSize) {
        return [
          1,
          (sideSize - expectedRoundCut) / (expectedCut - expectedRoundCut),
        ];
      }
      return [1, 1];
    });
    const corners = roundedCorners.map((roundedCorner, i) => {
      const [cut0, cut1] = [0, 1].map((delta) => {
        const [roundCutRatio, cutRatio] = cutAdjusts[(i + n - 1 + delta) % n];
        return (
          roundedCorner.expectedRoundCut * roundCutRatio +
          (roundedCorner.expectedCut - roundedCorner.expectedRoundCut) *
            cutRatio
        );
      });
      return roundedCorner.getCubics(cut0, cut1);
    });
    const features: Feature[] = [];
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const from = corners[i].at(-1)!.anchor1;
      const to = corners[next][0].anchor0;
      features.push(
        new Feature(
          corners[i],
          true,
          convex(vertices[(i + n - 1) % n], vertices[i], vertices[next])
        ),
        new Feature([Cubic.straightLine(from.x, from.y, to.x, to.y)], false)
      );
    }
    return new RoundedPolygon(
      features,
      center ??
        point(
          vertices.reduce((sum, v) => sum + v.x, 0) / n,
          vertices.reduce((sum, v) => sum + v.y, 0) / n
        )
    );
  }

  static circle(numVertices = 8, radius = 1) {
    const polygonRadius = radius / Math.cos(Math.PI / numVertices);
    const vertices = Array.from({ length: numVertices }, (_, i) =>
      radialToCartesian(polygonRadius, ((2 * Math.PI) / numVertices) * i)
    );
    return RoundedPolygon.fromVertices(
      vertices,
      rounding(radius),
      undefined,
      point(0, 0)
    );
  }

  static star(
    numVerticesPerRadius: number,
    innerRadius: number,
    corner: CornerRounding
  ) {
    const vertices: Point[] = [];
    for (let i = 0; i < numVerticesPerRadius; i++) {
      vertices.push(
        radialToCartesian(1, (Math.PI / numVerticesPerRadius) * 2 * i)
      );
      vertices.push(
        radialToCartesian(
          innerRadius,
          (Math.PI / numVerticesPerRadius) * (2 * i + 1)
        )
      );
    }
    return RoundedPolygon.fromVertices(
      vertices,
      corner,
      undefined,
      point(0, 0)
    );
  }

  transformed(f: Transform) {
    return new RoundedPolygon(
      this.features.map((feature) => feature.transformed(f)),
      f(this.center)
    );
  }

  // Into a unit square, centered on its longer side
  normalized() {
    const [left, top, right, bottom] = this.bounds();
    const width = right - left;
    const height = bottom - top;
    const side = Math.max(width, height);
    const offsetX = (side - width) / 2 - left;
    const offsetY = (side - height) / 2 - top;
    return this.transformed((p) =>
      point((p.x + offsetX) / side, (p.y + offsetY) / side)
    );
  }

  bounds() {
    return boundsOf(this.cubics);
  }

  // The square that holds the shape however it's turned about its center
  maxBounds(): [number, number, number, number] {
    let maxDistSquared = 0;
    for (const cubic of this.cubics) {
      const anchor = minus(cubic.anchor0, this.center);
      const middle = minus(cubic.pointOnCurve(0.5), this.center);
      maxDistSquared = Math.max(
        maxDistSquared,
        dot(anchor, anchor),
        dot(middle, middle)
      );
    }
    const d = Math.sqrt(maxDistSquared);
    const { x, y } = this.center;
    return [x - d, y - d, x + d, y + d];
  }
}

export const boundsOf = (cubics: Cubic[]): [number, number, number, number] => {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const cubic of cubics) {
    const [l, t, r, b] = cubic.bounds();
    minX = Math.min(minX, l);
    minY = Math.min(minY, t);
    maxX = Math.max(maxX, r);
    maxY = Math.max(maxY, b);
  }
  return [minX, minY, maxX, maxY];
};

// --- Compose's MaterialShapes ----------------------------------------------------------------

type PointNRound = { o: Point; r?: CornerRounding };

const rotateDegrees = (p: Point, angle: number, center: Point) => {
  const a = (angle / 180) * Math.PI;
  const off = minus(p, center);
  return plus(
    point(
      off.x * Math.cos(a) - off.y * Math.sin(a),
      off.x * Math.sin(a) + off.y * Math.cos(a)
    ),
    center
  );
};

const angleDegrees = (p: Point) => (Math.atan2(p.y, p.x) * 180) / Math.PI;

// The points repeated round the center, each repetition mirrored in turn when `mirroring`
const doRepeat = (
  points: PointNRound[],
  reps: number,
  center: Point,
  mirroring: boolean
) => {
  if (!mirroring) {
    return Array.from({ length: points.length * reps }, (_, it) => {
      const p = points[it % points.length];
      return {
        o: rotateDegrees(
          p.o,
          (Math.floor(it / points.length) * 360) / reps,
          center
        ),
        r: p.r,
      };
    });
  }
  const angles = points.map((p) => angleDegrees(minus(p.o, center)));
  const distances = points.map((p) => length(minus(p.o, center)));
  const actualReps = reps * 2;
  const sectionAngle = 360 / actualReps;
  const result: PointNRound[] = [];
  for (let it = 0; it < actualReps; it++) {
    for (let index = 0; index < points.length; index++) {
      const i = it % 2 === 0 ? index : points.length - 1 - index;
      if (i > 0 || it % 2 === 0) {
        const a =
          ((sectionAngle * it +
            (it % 2 === 0
              ? angles[i]
              : sectionAngle - angles[i] + 2 * angles[0])) /
            180) *
          Math.PI;
        result.push({
          o: plus(times(point(Math.cos(a), Math.sin(a)), distances[i]), center),
          r: points[i].r,
        });
      }
    }
  }
  return result;
};

const customPolygon = (pnr: PointNRound[], reps: number, mirroring = false) => {
  const center = point(0.5, 0.5);
  const actualPoints = doRepeat(pnr, reps, center, mirroring);
  return RoundedPolygon.fromVertices(
    actualPoints.map((p) => p.o),
    Unrounded,
    actualPoints.map((p) => p.r ?? Unrounded),
    center
  );
};

const rotation = (degrees: number): Transform => {
  const a = (degrees / 180) * Math.PI;
  return (p) =>
    point(
      p.x * Math.cos(a) - p.y * Math.sin(a),
      p.x * Math.sin(a) + p.y * Math.cos(a)
    );
};

const pn = (x: number, y: number, r?: CornerRounding): PointNRound => ({
  o: point(x, y),
  r,
});

export const MaterialShapes = {
  SoftBurst: () =>
    customPolygon(
      [pn(0.193, 0.277, rounding(0.053)), pn(0.176, 0.055, rounding(0.053))],
      10
    ).normalized(),
  Cookie9Sided: () =>
    RoundedPolygon.star(9, 0.8, rounding(0.5))
      .transformed(rotation(-90))
      .normalized(),
  Pentagon: () =>
    customPolygon(
      [
        pn(0.5, -0.009, rounding(0.172)),
        pn(1.03, 0.365, rounding(0.164)),
        pn(0.828, 0.97, rounding(0.169)),
      ],
      1,
      true
    ).normalized(),
  Pill: () =>
    customPolygon(
      [
        pn(0.961, 0.039, rounding(0.426)),
        pn(1.001, 0.428),
        pn(1.0, 0.609, rounding(1)),
      ],
      2,
      true
    ).normalized(),
  Sunny: () => RoundedPolygon.star(8, 0.8, rounding(0.15)).normalized(),
  Cookie4Sided: () =>
    customPolygon(
      [pn(1.237, 1.236, rounding(0.258)), pn(0.5, 0.918, rounding(0.233))],
      4
    ).normalized(),
  Oval: () =>
    RoundedPolygon.circle()
      .transformed((p) => point(p.x, p.y * 0.64))
      .transformed(rotation(-45))
      .normalized(),
};

// --- Morph -----------------------------------------------------------------------------------

// Where along each cubic the outline is, as a share of its whole length
class MeasuredCubic {
  readonly size: number;

  constructor(
    readonly cubic: Cubic,
    public start: number,
    public end: number
  ) {
    this.size = measureCubic(cubic);
  }

  cutAtProgress(cut: number): [MeasuredCubic, MeasuredCubic] {
    const bounded = Math.min(Math.max(cut, this.start), this.end);
    const relative = (bounded - this.start) / (this.end - this.start);
    const t = findCubicCutPoint(this.cubic, relative * this.size);
    const [c1, c2] = this.cubic.split(t);
    return [
      new MeasuredCubic(c1, this.start, bounded),
      new MeasuredCubic(c2, bounded, this.end),
    ];
  }
}

// A cubic's length, from three straight segments along it, as graphics-shapes measures it
const closestProgressTo = (
  cubic: Cubic,
  threshold: number
): [number, number] => {
  const segments = 3;
  let total = 0;
  let remainder = threshold;
  let prev = cubic.anchor0;
  for (let i = 1; i <= segments; i++) {
    const progress = i / segments;
    const p = cubic.pointOnCurve(progress);
    const segment = length(minus(p, prev));
    if (segment >= remainder) {
      return [progress - (1 - remainder / segment) / segments, threshold];
    }
    remainder -= segment;
    total += segment;
    prev = p;
  }
  return [1, total];
};
const measureCubic = (cubic: Cubic) => closestProgressTo(cubic, Infinity)[1];
const findCubicCutPoint = (cubic: Cubic, m: number) =>
  closestProgressTo(cubic, m)[0];

type ProgressableFeature = { progress: number; feature: Feature };

class MeasuredPolygon {
  readonly cubics: MeasuredCubic[];

  constructor(
    readonly features: ProgressableFeature[],
    cubics: Cubic[],
    outlineProgress: number[]
  ) {
    this.cubics = [];
    let start = 0;
    cubics.forEach((cubic, index) => {
      if (
        outlineProgress[index + 1] - outlineProgress[index] >
        DistanceEpsilon
      ) {
        this.cubics.push(
          new MeasuredCubic(cubic, start, outlineProgress[index + 1])
        );
        start = outlineProgress[index + 1];
      }
    });
    this.cubics.at(-1)!.end = 1;
  }

  static measure(polygon: RoundedPolygon) {
    const cubics: Cubic[] = [];
    const featureToCubic: [Feature, number][] = [];
    for (const feature of polygon.features) {
      feature.cubics.forEach((cubic, cubicIndex) => {
        if (
          feature.corner &&
          cubicIndex === Math.floor(feature.cubics.length / 2)
        ) {
          featureToCubic.push([feature, cubics.length]);
        }
        cubics.push(cubic);
      });
    }
    const measures = [0];
    for (const cubic of cubics)
      measures.push(measures.at(-1)! + measureCubic(cubic));
    const total = measures.at(-1)!;
    const outlineProgress = measures.map((m) => m / total);
    const features = featureToCubic.map(([feature, ix]) => ({
      progress: positiveModulo(
        (outlineProgress[ix] + outlineProgress[ix + 1]) / 2,
        1
      ),
      feature,
    }));
    return new MeasuredPolygon(features, cubics, outlineProgress);
  }

  // The same outline, starting at `cuttingPoint` along it
  cutAndShift(cuttingPoint: number) {
    if (cuttingPoint < DistanceEpsilon) return this;
    const targetIndex = this.cubics.findIndex(
      (c) => cuttingPoint >= c.start && cuttingPoint <= c.end
    );
    const target = this.cubics[targetIndex];
    const [b1, b2] = target.cutAtProgress(cuttingPoint);
    const n = this.cubics.length;
    const retCubics = [b2.cubic];
    for (let i = 1; i < n; i++)
      retCubics.push(this.cubics[(i + targetIndex) % n].cubic);
    retCubics.push(b1.cubic);
    const retOutlineProgress = Array.from({ length: n + 2 }, (_, index) => {
      if (index === 0) return 0;
      if (index === n + 1) return 1;
      return positiveModulo(
        this.cubics[(targetIndex + index - 1) % n].end - cuttingPoint,
        1
      );
    });
    const features = this.features.map((f) => ({
      progress: positiveModulo(f.progress - cuttingPoint, 1),
      feature: f.feature,
    }));
    return new MeasuredPolygon(features, retCubics, retOutlineProgress);
  }
}

const progressInRange = (progress: number, from: number, to: number) =>
  to >= from
    ? progress >= from && progress <= to
    : progress >= from || progress <= to;

const progressDistance = (p1: number, p2: number) => {
  const d = Math.abs(p1 - p2);
  return Math.min(d, 1 - d);
};

const linearMap = (xValues: number[], yValues: number[], x: number) => {
  const n = xValues.length;
  const start = xValues.findIndex((_, i) =>
    progressInRange(x, xValues[i], xValues[(i + 1) % n])
  );
  const end = (start + 1) % n;
  const segmentSizeX = positiveModulo(xValues[end] - xValues[start], 1);
  const segmentSizeY = positiveModulo(yValues[end] - yValues[start], 1);
  const positionInSegment =
    segmentSizeX < 0.001
      ? 0.5
      : positiveModulo(x - xValues[start], 1) / segmentSizeX;
  return positiveModulo(yValues[start] + segmentSizeY * positionInSegment, 1);
};

// Maps progress along one outline to progress along the other, through matched corners
class DoubleMapper {
  private readonly source: number[];
  private readonly target: number[];

  constructor(mappings: [number, number][]) {
    this.source = mappings.map((m) => m[0]);
    this.target = mappings.map((m) => m[1]);
  }

  map(x: number) {
    return linearMap(this.source, this.target, x);
  }

  mapBack(x: number) {
    return linearMap(this.target, this.source, x);
  }
}

const representativePoint = (feature: Feature) =>
  times(plus(feature.cubics[0].anchor0, feature.cubics.at(-1)!.anchor1), 0.5);

// Pairs each corner with the nearest one of the same kind, nearest pairs first, keeping the
// corners in order round both outlines
const featureMapper = (
  features1: ProgressableFeature[],
  features2: ProgressableFeature[]
) => {
  const corners1 = features1.filter((f) => f.feature.corner);
  const corners2 = features2.filter((f) => f.feature.corner);
  const candidates: {
    distance: number;
    f1: ProgressableFeature;
    f2: ProgressableFeature;
  }[] = [];
  for (const f1 of corners1) {
    for (const f2 of corners2) {
      if (f1.feature.convex !== f2.feature.convex) continue;
      const d = minus(
        representativePoint(f1.feature),
        representativePoint(f2.feature)
      );
      candidates.push({ distance: dot(d, d), f1, f2 });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  if (candidates.length === 0)
    return new DoubleMapper([
      [0, 0],
      [0.5, 0.5],
    ]);
  if (candidates.length === 1) {
    const { f1, f2 } = candidates[0];
    return new DoubleMapper([
      [f1.progress, f2.progress],
      [(f1.progress + 0.5) % 1, (f2.progress + 0.5) % 1],
    ]);
  }
  const mapping: [number, number][] = [];
  const used1 = new Set<ProgressableFeature>();
  const used2 = new Set<ProgressableFeature>();
  for (const { f1, f2 } of candidates) {
    if (used1.has(f1) || used2.has(f2)) continue;
    let insertionIndex = mapping.findIndex((m) => m[0] >= f1.progress);
    if (insertionIndex === -1) insertionIndex = mapping.length;
    if (mapping[insertionIndex]?.[0] === f1.progress) {
      throw new Error("There can't be two features with the same progress");
    }
    const n = mapping.length;
    if (n >= 1) {
      const [before1, before2] = mapping[(insertionIndex + n - 1) % n];
      const [after1, after2] = mapping[insertionIndex % n];
      if (
        progressDistance(f1.progress, before1) < DistanceEpsilon ||
        progressDistance(f1.progress, after1) < DistanceEpsilon ||
        progressDistance(f2.progress, before2) < DistanceEpsilon ||
        progressDistance(f2.progress, after2) < DistanceEpsilon
      ) {
        continue;
      }
      if (n > 1 && !progressInRange(f2.progress, before2, after2)) continue;
    }
    mapping.splice(insertionIndex, 0, [f1.progress, f2.progress]);
    used1.add(f1);
    used2.add(f2);
  }
  return new DoubleMapper(mapping);
};

// The two shapes' cubics, cut so each one in the first has a partner in the second
export const morph = (
  start: RoundedPolygon,
  end: RoundedPolygon
): [Cubic, Cubic][] => {
  const measured1 = MeasuredPolygon.measure(start);
  const measured2 = MeasuredPolygon.measure(end);
  const mapper = featureMapper(measured1.features, measured2.features);
  const polygon2CutPoint = mapper.map(0);
  const bs1 = measured1.cubics;
  const bs2 = measured2.cutAndShift(polygon2CutPoint).cubics;
  const ret: [Cubic, Cubic][] = [];
  let i1 = 0;
  let i2 = 0;
  let b1: MeasuredCubic | undefined = bs1[i1++];
  let b2: MeasuredCubic | undefined = bs2[i2++];
  while (b1 && b2) {
    const b1a = i1 === bs1.length ? 1 : b1.end;
    const b2a =
      i2 === bs2.length
        ? 1
        : mapper.mapBack(positiveModulo(b2.end + polygon2CutPoint, 1));
    const minb = Math.min(b1a, b2a);
    let seg1: MeasuredCubic;
    let seg2: MeasuredCubic;
    if (b1a > minb + AngleEpsilon) {
      [seg1, b1] = b1.cutAtProgress(minb);
    } else {
      seg1 = b1;
      b1 = bs1[i1++];
    }
    if (b2a > minb + AngleEpsilon) {
      [seg2, b2] = b2.cutAtProgress(
        positiveModulo(mapper.map(minb) - polygon2CutPoint, 1)
      );
    } else {
      seg2 = b2;
      b2 = bs2[i2++];
    }
    ret.push([seg1.cubic, seg2.cubic]);
  }
  if (b1 || b2)
    throw new Error("Expected both polygons' cubics to be fully matched");
  return ret;
};

// How far a shape is scaled so every shape in the sequence, turned any way, fits the box
export const scaleFactor = (polygons: RoundedPolygon[]) => {
  let factor = 1;
  for (const polygon of polygons) {
    const [l, t, r, b] = polygon.bounds();
    const [ml, mt, mr, mb] = polygon.maxBounds();
    factor = Math.min(
      factor,
      Math.max((r - l) / (mr - ml), (b - t) / (mb - mt))
    );
  }
  return factor;
};

// --- Compose's loading indicator -------------------------------------------------------------

// The shapes it morphs through, in order, looping back to the first
const indeterminateShapes = [
  MaterialShapes.SoftBurst,
  MaterialShapes.Cookie9Sided,
  MaterialShapes.Pentagon,
  MaterialShapes.Pill,
  MaterialShapes.Sunny,
  MaterialShapes.Cookie4Sided,
  MaterialShapes.Oval,
];

let loadingSequence: { morphs: [Cubic, Cubic][][]; scale: number } | undefined;

// Each morph in the loop, and how far the shapes are scaled: to fit any way round, and then to
// M3's 38dp active indicator in its 48dp container
export const loadingIndicatorSequence = () => {
  if (!loadingSequence) {
    const polygons = indeterminateShapes.map((shape) => shape());
    loadingSequence = {
      morphs: polygons.map((polygon, i) =>
        morph(polygon, polygons[(i + 1) % polygons.length])
      ),
      scale: scaleFactor(polygons) * (38 / 48),
    };
  }
  return loadingSequence;
};

// A morph `progress` of the way along, as SVG path data in a 100 × 100 box, centered on its
// bounds as Compose centers it. Past 1, as a spring overshoots, it carries on beyond the end shape.
export const morphPathData = (
  pairs: [Cubic, Cubic][],
  progress: number,
  scale: number
) => {
  const cubics = pairs.map(
    ([a, b]) =>
      new Cubic(a.points.map((v, i) => lerp(v, b.points[i], progress)))
  );
  const [left, top, right, bottom] = boundsOf(cubics);
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const at = (x: number, y: number) =>
    `${(50 + (x - cx) * 100 * scale).toFixed(2)} ${(50 + (y - cy) * 100 * scale).toFixed(2)}`;
  const [x0, y0] = cubics[0].points;
  let d = `M${at(x0, y0)}`;
  for (const [, , c0x, c0y, c1x, c1y, a1x, a1y] of cubics.map(
    (c) => c.points
  )) {
    d += `C${at(c0x, c0y)} ${at(c1x, c1y)} ${at(a1x, a1y)}`;
  }
  return `${d}Z`;
};
