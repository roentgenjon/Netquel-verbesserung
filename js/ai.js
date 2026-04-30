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

// Asteroid obstacle
class Asteroid {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = randRange(20, 80);
    this.vx = randRange(-15, 15);
    this.vy = randRange(-15, 15);
    this.angle = Math.random() * Math.PI * 2;
    this.angularVel = randRange(-0.3, 0.3);
    this.hp = this.radius * 3;
    this.maxHp = this.hp;
    this.alive = true;
    this.points = this._generatePoints();
    this.color = `hsl(${randInt(20, 40)},${randInt(10,25)}%,${randInt(25,45)}%)`;
    this.outline = `hsl(${randInt(20, 40)},${randInt(15,30)}%,${randInt(40,60)}%)`;
  }

  _generatePoints() {
    const pts = [];
    const count = randInt(7, 12);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = this.radius * randRange(0.7, 1.1);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
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
    if (particles) {
      particles.cannonImpact(this.x, this.y);
    }
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
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.outline;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Craters
    if (this.hp < this.maxHp * 0.7) {
      const dmgRatio = 1 - this.hp / this.maxHp;
      ctx.fillStyle = `rgba(0,0,0,${dmgRatio * 0.4})`;
      ctx.beginPath();
      ctx.arc(this.radius * 0.2, this.radius * 0.1, this.radius * 0.15, 0, Math.PI * 2);
      ctx.arc(-this.radius * 0.3, -this.radius * 0.2, this.radius * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
