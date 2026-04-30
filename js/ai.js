/**
 * AI controller for enemy ships.
 * States: patrol → chase → attack → retreat
 */

const AI_STATE = { PATROL: 0, CHASE: 1, ATTACK: 2, RETREAT: 3 };

class AIController {
  constructor(ship) {
    this.ship = ship;
    this.state = AI_STATE.PATROL;
    this.target = null;
    this.patrolAngle = Math.random() * Math.PI * 2;
    this.patrolTimer = randRange(2, 5);
    this.patrolRadius = randRange(300, 800);
    this.patrolCenter = new Vec2(ship.body.pos.x, ship.body.pos.y);
    this.stateTimer = 0;
    this.difficulty = 1;
    this.reactionTime = 0.3;
    this.reactionTimer = 0;
    this._virtualInput = {
      thrust: false, reverse: false,
      rotateLeft: false, rotateRight: false,
      boost: false, fire: false,
      _mouseAiming: false,
      mouse: { worldX: 0, worldY: 0 },
    };
  }

  setDifficulty(d) {
    this.difficulty = d;
    this.reactionTime = Math.max(0.05, 0.4 - d * 0.1);
  }

  setTarget(ship) {
    this.target = ship;
    if (ship) this.state = AI_STATE.CHASE;
  }

  update(dt, weapons, particles) {
    const ship = this.ship;
    if (!ship.alive) return;

    this.stateTimer -= dt;
    this.reactionTimer -= dt;

    // State transitions
    if (this.target && this.target.alive) {
      const dist = Vec2.dist(ship.body.pos, this.target.body.pos);

      if (dist < 600) {
        this.state = dist < 200 ? AI_STATE.ATTACK : AI_STATE.CHASE;
        if (ship.hpRatio < 0.25 && this.difficulty < 3) {
          this.state = AI_STATE.RETREAT;
        }
      } else if (this.state !== AI_STATE.PATROL) {
        this.state = AI_STATE.PATROL;
      }
    } else {
      this.state = AI_STATE.PATROL;
    }

    // Only recalculate input at reaction time
    if (this.reactionTimer <= 0) {
      this.reactionTimer = this.reactionTime;
      this._updateInput(dt);
    }

    // Apply virtual input to ship
    ship._lastThrust = this._virtualInput.thrust || this._virtualInput.reverse;
    ship.applyControls(this._virtualInput, dt);

    // Fire weapons
    if (this._virtualInput.fire && this.target && this.target.alive) {
      const drillBlocks = ship.getBlocksByType('DRILL');
      const dist = Vec2.dist(ship.body.pos, this.target.body.pos);

      if (drillBlocks.length > 0 && dist < 80) {
        weapons.drillAttack(ship, this.target, particles);
      }

      if (ship.getBlocksByType('LASER').length > 0) {
        weapons.fire(ship, 'LASER', particles);
      }
      if (ship.getBlocksByType('CANNON').length > 0) {
        weapons.fire(ship, 'CANNON', particles);
      }
    }
  }

  _updateInput(dt) {
    const inp = this._virtualInput;
    inp.thrust = false;
    inp.reverse = false;
    inp.rotateLeft = false;
    inp.rotateRight = false;
    inp.boost = false;
    inp.fire = false;

    const ship = this.ship;

    if (this.state === AI_STATE.PATROL) {
      this._doPatrol(inp);

    } else if (this.state === AI_STATE.CHASE || this.state === AI_STATE.ATTACK) {
      if (!this.target) return;
      const tx = this.target.body.pos.x;
      const ty = this.target.body.pos.y;
      const dx = tx - ship.body.pos.x;
      const dy = ty - ship.body.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const targetAngle = Math.atan2(dy, dx);

      // Rotate toward target
      const angleDelta = angleDiff(ship.body.angle, targetAngle);
      const rotThreshold = 0.08;
      if (angleDelta > rotThreshold) inp.rotateRight = true;
      else if (angleDelta < -rotThreshold) inp.rotateLeft = true;

      const aligned = Math.abs(angleDelta) < 0.3;

      if (this.state === AI_STATE.CHASE) {
        if (dist > 280) {
          if (aligned) inp.thrust = true;
          if (dist > 600 && this.difficulty >= 2 && ship.boostFuel > 30) inp.boost = true;
        } else if (dist < 180) {
          inp.reverse = true;
        }
      } else { // ATTACK
        // Orbit around target
        const orbitDist = 150 + this.difficulty * 30;
        if (dist > orbitDist + 40) inp.thrust = true;
        else if (dist < orbitDist - 40) inp.reverse = true;

        if (aligned) inp.fire = true;
      }

    } else if (this.state === AI_STATE.RETREAT) {
      if (!this.target) return;
      const dx = this.target.body.pos.x - ship.body.pos.x;
      const dy = this.target.body.pos.y - ship.body.pos.y;
      const awayAngle = Math.atan2(-dy, -dx);
      const delta = angleDiff(ship.body.angle, awayAngle);
      if (delta > 0.1) inp.rotateRight = true;
      else if (delta < -0.1) inp.rotateLeft = true;
      else { inp.thrust = true; inp.boost = ship.boostFuel > 20; }
    }
  }

  _doPatrol(inp) {
    const ship = this.ship;
    this.patrolTimer -= 0.05;

    if (this.patrolTimer <= 0) {
      this.patrolTimer = randRange(3, 7);
      this.patrolAngle = Math.random() * Math.PI * 2;
    }

    const targetX = this.patrolCenter.x + Math.cos(this.patrolAngle) * this.patrolRadius;
    const targetY = this.patrolCenter.y + Math.sin(this.patrolAngle) * this.patrolRadius;

    const dx = targetX - ship.body.pos.x;
    const dy = targetY - ship.body.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 60) {
      const target = Math.atan2(dy, dx);
      const delta = angleDiff(ship.body.angle, target);
      if (delta > 0.1) inp.rotateRight = true;
      else if (delta < -0.1) inp.rotateLeft = true;
      else inp.thrust = true;
    } else {
      this.patrolTimer = 0;
    }
  }
}

// Asteroid obstacle — rocky with mineral veins and neon glow on damage
class Asteroid {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = randRange(22, 75);
    this.vx = randRange(-15, 15);
    this.vy = randRange(-15, 15);
    this.angle = Math.random() * Math.PI * 2;
    this.angularVel = randRange(-0.25, 0.25);
    this.hp = this.radius * 3;
    this.maxHp = this.hp;
    this.alive = true;

    // Rock type: 0=grey, 1=brownish, 2=ice-blue (rare mineral)
    this._type = Math.random() < 0.15 ? 2 : Math.random() < 0.4 ? 1 : 0;
    this._colors = [
      { base: '#2a2830', mid: '#3a3845', edge: '#524f66', vein: '#5566aa', glow: '#4466cc' },
      { base: '#2e1e10', mid: '#3e2c18', edge: '#5a4228', vein: '#aa7733', glow: '#dd9933' },
      { base: '#0e1e2e', mid: '#162840', edge: '#1e3c5a', vein: '#22aadd', glow: '#44ccff' },
    ][this._type];

    this.points = this._generatePoints();
    this.craters = this._generateCraters();
    this.veins = this._generateVeins();
  }

  _generatePoints() {
    const pts = [];
    const count = randInt(9, 14);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + randRange(-0.2, 0.2);
      const r = this.radius * randRange(0.72, 1.08);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }

  _generateCraters() {
    const c = [];
    const count = randInt(2, 5);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * this.radius * 0.55;
      c.push({
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
        r: randRange(this.radius * 0.07, this.radius * 0.22),
      });
    }
    return c;
  }

  _generateVeins() {
    const v = [];
    const count = randInt(1, 4);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const len = randRange(this.radius * 0.3, this.radius * 0.7);
      v.push({
        x1: Math.cos(a) * randRange(0, this.radius * 0.3),
        y1: Math.sin(a) * randRange(0, this.radius * 0.3),
        x2: Math.cos(a) * len,
        y2: Math.sin(a) * len,
      });
    }
    return v;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.angularVel * dt;
    this.vx *= 0.9998;
    this.vy *= 0.9998;
  }

  takeDamage(amount, particles) {
    this.hp -= amount;
    if (particles) particles.cannonImpact(this.x, this.y);
    if (this.hp <= 0) {
      this.alive = false;
      if (particles) particles.shipExplosion(this.x, this.y, this.radius * 0.5);
    }
  }

  checkCollision(px, py) {
    const dx = px - this.x, dy = py - this.y;
    return dx * dx + dy * dy < this.radius * this.radius;
  }

  draw(ctx) {
    if (!this.alive) return;
    const c = this._colors;
    const dmgRatio = 1 - this.hp / this.maxHp;
    const r = this.radius;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // ── Outer shadow / glow ───────────────────────────────────────────
    if (this._type === 2 || dmgRatio > 0.3) {
      ctx.shadowColor = dmgRatio > 0.3 ? '#ff4400' : c.glow;
      ctx.shadowBlur = 12 * (this._type === 2 ? 1 : dmgRatio);
    }

    // ── Main body ─────────────────────────────────────────────────────
    const pts = this.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();

    // Radial gradient fill — lighter center, dark rocky edge
    const grad = ctx.createRadialGradient(r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 1.1);
    grad.addColorStop(0,   c.mid);
    grad.addColorStop(0.5, c.base);
    grad.addColorStop(1,   this._darken(c.base, 0.4));
    ctx.fillStyle = grad;
    ctx.fill();

    // ── Edge highlight (top-left lit rim) ────────────────────────────
    ctx.save();
    ctx.clip();
    const rimGrad = ctx.createLinearGradient(-r, -r, r * 0.4, r * 0.4);
    rimGrad.addColorStop(0, `rgba(255,255,255,0.10)`);
    rimGrad.addColorStop(0.4, `rgba(255,255,255,0.03)`);
    rimGrad.addColorStop(1, `rgba(0,0,0,0.25)`);
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.restore();

    // ── Outline ───────────────────────────────────────────────────────
    ctx.shadowBlur = 0;
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();

    // ── Mineral veins ─────────────────────────────────────────────────
    ctx.strokeStyle = c.vein;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    if (this._type === 2) {
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 4;
    }
    for (const v of this.veins) {
      ctx.beginPath();
      ctx.moveTo(v.x1, v.y1);
      ctx.lineTo(v.x2, v.y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // ── Craters ───────────────────────────────────────────────────────
    for (const cr of this.craters) {
      const cg = ctx.createRadialGradient(cr.x - cr.r * 0.3, cr.y - cr.r * 0.3, 0, cr.x, cr.y, cr.r);
      cg.addColorStop(0, 'rgba(0,0,0,0.5)');
      cg.addColorStop(0.7, 'rgba(0,0,0,0.3)');
      cg.addColorStop(1, 'rgba(120,120,140,0.15)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cr.x, cr.y, cr.r, 0, Math.PI * 2);
      ctx.fill();
      // Crater rim highlight
      ctx.strokeStyle = 'rgba(200,200,220,0.15)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // ── Damage glow ───────────────────────────────────────────────────
    if (dmgRatio > 0.2) {
      ctx.globalAlpha = (dmgRatio - 0.2) * 0.6;
      ctx.fillStyle = '#ff4400';
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _darken(hex, amt) {
    try {
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      const d = v => Math.max(0, Math.round(v * (1 - amt)));
      return `rgb(${d(r)},${d(g)},${d(b)})`;
    } catch { return hex; }
  }
}
