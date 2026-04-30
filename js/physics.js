/**
 * 2D vector math and physics utilities.
 */

class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }

  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s) { return new Vec2(this.x * s, this.y * s); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  cross(v) { return this.x * v.y - this.y * v.x; }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  normalize() {
    const l = this.length();
    return l > 0 ? this.scale(1 / l) : new Vec2(0, 0);
  }
  rotate(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
  }
  clone() { return new Vec2(this.x, this.y); }

  addMut(v) { this.x += v.x; this.y += v.y; return this; }
  scaleMut(s) { this.x *= s; this.y *= s; return this; }

  static fromAngle(angle) { return new Vec2(Math.cos(angle), Math.sin(angle)); }
  static dist(a, b) { return a.sub(b).length(); }
  static distSq(a, b) { return a.sub(b).lengthSq(); }
}

class PhysicsBody {
  constructor(x = 0, y = 0) {
    this.pos = new Vec2(x, y);
    this.vel = new Vec2(0, 0);
    this.angle = 0;
    this.angularVel = 0;
    this.mass = 1;
    this.inertia = 1;
    this.drag = 0.98;
    this.angularDrag = 0.92;
  }

  applyForce(fx, fy) {
    this.vel.x += fx / this.mass;
    this.vel.y += fy / this.mass;
  }

  applyImpulse(ix, iy) {
    this.vel.x += ix / this.mass;
    this.vel.y += iy / this.mass;
  }

  applyTorque(t) {
    this.angularVel += t / this.inertia;
  }

  applyForceAtPoint(fx, fy, px, py) {
    this.applyForce(fx, fy);
    const torque = px * fy - py * fx;
    this.applyTorque(torque);
  }

  update(dt) {
    this.vel.x *= this.drag;
    this.vel.y *= this.drag;
    this.angularVel *= this.angularDrag;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.angle += this.angularVel * dt;

    // Normalize angle
    while (this.angle > Math.PI) this.angle -= Math.PI * 2;
    while (this.angle < -Math.PI) this.angle += Math.PI * 2;
  }

  get speed() { return this.vel.length(); }

  worldToLocal(wx, wy) {
    const dx = wx - this.pos.x;
    const dy = wy - this.pos.y;
    const c = Math.cos(-this.angle), s = Math.sin(-this.angle);
    return new Vec2(dx * c - dy * s, dx * s + dy * c);
  }

  localToWorld(lx, ly) {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return new Vec2(
      this.pos.x + lx * c - ly * s,
      this.pos.y + lx * s + ly * c
    );
  }
}

// Circle vs circle collision
function circleCircle(ax, ay, ar, bx, by, br) {
  const dx = bx - ax, dy = by - ay;
  const dist = Math.sqrt(dx*dx + dy*dy);
  return dist < ar + br;
}

// Point in circle
function pointInCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx*dx + dy*dy <= r*r;
}

// AABB overlap
function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Angle difference (shortest path)
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Lerp
function lerp(a, b, t) { return a + (b - a) * t; }

// Clamp
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Random in range
function randRange(min, max) { return min + Math.random() * (max - min); }

// Random integer
function randInt(min, max) { return Math.floor(randRange(min, max + 1)); }
