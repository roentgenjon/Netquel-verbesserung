/**
 * Ship — a collection of blocks forming a physics body.
 * The ship's local coordinate origin is at the center of mass.
 */

let _shipIdCounter = 0;

class Ship {
  constructor(blocks = [], name = 'Schiff') {
    this.id = ++_shipIdCounter;
    this.name = name;
    this.blocks = [];
    this.body = new PhysicsBody(0, 0);
    this.energy = 100;
    this.maxEnergy = 100;
    this.energyRegen = 8;
    this.boostFuel = 100;
    this.maxBoostFuel = 100;
    this.boostRechargeRate = 12;
    this.isBoosting = false;
    this.kills = 0;
    this.deaths = 0;
    this.score = 0;
    this.repairTimer = 0;
    this.alive = true;
    this.respawnTimer = 0;
    this.isPlayer = false;

    // Per-block fire cooldown timers stored in block.fireTimer
    if (blocks.length > 0) this.setBlocks(blocks);
  }

  setBlocks(blocks) {
    this.blocks = blocks.map(b => b instanceof Block ? b : Block.deserialize(b));
    this._recalculate();
  }

  addBlock(block) {
    this.blocks.push(block);
    this._recalculate();
  }

  removeBlock(block) {
    const idx = this.blocks.indexOf(block);
    if (idx !== -1) {
      this.blocks.splice(idx, 1);
      this._recalculate();
    }
  }

  _recalculate() {
    if (this.blocks.length === 0) {
      this.body.mass = 1;
      this.body.inertia = 1;
      return;
    }

    // Center of mass
    let totalMass = 0, cx = 0, cy = 0;
    for (const b of this.blocks) {
      const m = b.type.mass;
      cx += (b.gridX + 0.5) * BLOCK_SIZE * m;
      cy += (b.gridY + 0.5) * BLOCK_SIZE * m;
      totalMass += m;
    }
    this._comX = cx / totalMass;
    this._comY = cy / totalMass;

    // Shift block coordinates so COM is at (0,0)
    // (done at draw time to keep grid coords intact)

    this.body.mass = Math.max(1, totalMass);
    this.body.drag = 0.995;
    this.body.angularDrag = 0.94;

    // Moment of inertia
    let inertia = 0;
    for (const b of this.blocks) {
      const lx = (b.gridX + 0.5) * BLOCK_SIZE - this._comX;
      const ly = (b.gridY + 0.5) * BLOCK_SIZE - this._comY;
      inertia += b.type.mass * (lx * lx + ly * ly);
    }
    this.body.inertia = Math.max(100, inertia);

    // Max energy from reactors
    const reactors = this.blocks.filter(b => b.type.isReactor);
    this.maxEnergy = 60 + reactors.length * 60;
    this.energyRegen = 5 + reactors.length * 8;

    // Thruster force
    this._thrusterForce = this.blocks.filter(b => b.type.isThruster).length * 280;
    this._boostForce = this._thrusterForce * 2.5;

    // Cockpit check
    this.hasCockpit = this.blocks.some(b => b.type.isCockpit);
  }

  get totalHp() {
    return this.blocks.reduce((s, b) => s + b.hp, 0);
  }

  get maxHp() {
    return this.blocks.reduce((s, b) => s + b.maxHp, 0);
  }

  get hpRatio() {
    const max = this.maxHp;
    return max > 0 ? this.totalHp / max : 0;
  }

  get radius() {
    let r = 0;
    for (const b of this.blocks) {
      const lx = (b.gridX + 0.5) * BLOCK_SIZE - this._comX;
      const ly = (b.gridY + 0.5) * BLOCK_SIZE - this._comY;
      r = Math.max(r, Math.sqrt(lx*lx + ly*ly) + BLOCK_SIZE * 0.8);
    }
    return Math.max(r, BLOCK_SIZE);
  }

  getBlocksByType(typeId) {
    return this.blocks.filter(b => b.type.id === typeId && !b.isDestroyed);
  }

  // Local offset from body origin to center of mass
  get comOffsetX() { return this._comX || 0; }
  get comOffsetY() { return this._comY || 0; }

  // Apply thrust from WASD/arrow controls
  applyControls(input, dt) {
    if (!this.alive) return;

    const force = this._thrusterForce || 200;
    const angle = this.body.angle;

    let thrustX = 0, thrustY = 0;
    let torque = 0;
    let energyCost = 0;

    if (input.thrust) {
      thrustX += Math.cos(angle) * force;
      thrustY += Math.sin(angle) * force;
      energyCost += 2;
    }
    if (input.reverse) {
      thrustX -= Math.cos(angle) * force * 0.6;
      thrustY -= Math.sin(angle) * force * 0.6;
      energyCost += 1.5;
    }

    if (input.rotateLeft) torque -= 60000;
    if (input.rotateRight) torque += 60000;

    // Boost (E key)
    this.isBoosting = false;
    if (input.boost && this.boostFuel > 0 && (input.thrust || input.reverse)) {
      const boostForce = this._boostForce || 500;
      if (input.thrust) {
        thrustX = Math.cos(angle) * boostForce;
        thrustY = Math.sin(angle) * boostForce;
      }
      this.boostFuel = Math.max(0, this.boostFuel - dt * 35);
      energyCost += 5;
      this.isBoosting = true;
    }

    if (this.energy >= energyCost * dt) {
      this.body.applyForce(thrustX * dt, thrustY * dt);
      if (torque !== 0) this.body.applyTorque(torque * dt);
      this.energy -= energyCost * dt;
    } else if (energyCost === 0) {
      if (torque !== 0) this.body.applyTorque(torque * dt);
    }

    // Mouse aiming — rotate toward mouse world position
    if (input._mouseAiming && !input.rotateLeft && !input.rotateRight) {
      const dx = input.mouse.worldX - this.body.pos.x;
      const dy = input.mouse.worldY - this.body.pos.y;
      const targetAngle = Math.atan2(dy, dx);
      const diff = angleDiff(this.body.angle, targetAngle);
      const rotSpeed = 3.5;
      if (Math.abs(diff) > 0.02) {
        this.body.angularVel += Math.sign(diff) * rotSpeed * dt;
      }
    }
  }

  // Update block timers and repair
  update(dt) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      return;
    }

    // Energy regen
    this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen * dt);

    // Boost regen
    if (!this.isBoosting) {
      this.boostFuel = Math.min(this.maxBoostFuel, this.boostFuel + this.boostRechargeRate * dt);
    }

    // Block fire timers
    for (const b of this.blocks) {
      if (b.fireTimer > 0) b.fireTimer -= dt;
      if (b.fireTimer < 0) b.fireTimer = 0;
    }

    // Repair blocks with repair modules
    const repairBlocks = this.getBlocksByType('REPAIR');
    if (repairBlocks.length > 0) {
      this.repairTimer -= dt;
      if (this.repairTimer <= 0) {
        this.repairTimer = 1.5;
        const repairAmount = repairBlocks.length * 4;
        for (const b of this.blocks) {
          if (b.hp < b.maxHp) {
            b.repair(repairAmount);
            this.energy -= 2;
          }
        }
      }
    }

    // Check destruction
    const hasCockpit = this.blocks.some(b => b.type.isCockpit && !b.isDestroyed);
    const hasBlocks = this.blocks.some(b => !b.isDestroyed);
    if (!hasCockpit || !hasBlocks) {
      this.destroy();
    }

    // Remove destroyed blocks
    this.blocks = this.blocks.filter(b => !b.isDestroyed);
    if (this.blocks.length > 0 && this.alive) {
      this._recalculate();
    }

    this.body.update(dt);
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.deaths++;
    this.respawnTimer = 5;
  }

  respawn(x, y) {
    this.alive = true;
    this.body.pos.x = x;
    this.body.pos.y = y;
    this.body.vel.x = 0;
    this.body.vel.y = 0;
    this.body.angularVel = 0;
    this.energy = this.maxEnergy;
    this.boostFuel = this.maxBoostFuel;
    // Reset block health
    for (const b of this.blocks) {
      b.hp = b.maxHp;
      b.active = true;
    }
  }

  draw(ctx, particles, isPlayer = false) {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.body.pos.x, this.body.pos.y);
    ctx.rotate(this.body.angle);
    ctx.translate(-this.comOffsetX, -this.comOffsetY);

    // Draw each block
    for (const block of this.blocks) {
      if (block.isDestroyed) continue;
      const bx = block.gridX * BLOCK_SIZE;
      const by = block.gridY * BLOCK_SIZE;
      block.draw(ctx, bx, by, BLOCK_SIZE);
    }

    ctx.restore();

    // Draw thruster exhaust particles
    if (particles) {
      const thrusters = this.getBlocksByType('THRUSTER');
      const hasThrust = this._lastThrust;

      if (hasThrust) {
        for (const t of thrusters) {
          const wp = this.body.localToWorld(
            t.gridX * BLOCK_SIZE + BLOCK_SIZE / 2 - this.comOffsetX,
            t.gridY * BLOCK_SIZE + BLOCK_SIZE / 2 - this.comOffsetY
          );
          if (this.isBoosting) {
            particles.boostExhaust(wp.x, wp.y, this.body.angle, 1.5);
          } else {
            particles.thrusterExhaust(wp.x, wp.y, this.body.angle, 0.8);
          }
        }
      }
    }

    // Name label
    if (!isPlayer) {
      ctx.save();
      ctx.font = '12px Courier New';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(180,200,255,0.7)';
      ctx.fillText(this.name, this.body.pos.x, this.body.pos.y - this.radius - 8);
      ctx.restore();
    }

    // HP bar (for non-player enemies)
    if (!isPlayer) {
      const bw = 50;
      const bx = this.body.pos.x - bw / 2;
      const by2 = this.body.pos.y - this.radius - 22;
      ctx.fillStyle = '#200';
      ctx.fillRect(bx, by2, bw, 5);
      ctx.fillStyle = `hsl(${this.hpRatio * 120},80%,45%)`;
      ctx.fillRect(bx, by2, bw * this.hpRatio, 5);
    }
  }

  serialize() {
    return {
      name: this.name,
      blocks: this.blocks.map(b => b.serialize()),
      x: this.body.pos.x,
      y: this.body.pos.y,
      angle: this.body.angle,
    };
  }

  static deserialize(data) {
    const blocks = data.blocks.map(b => Block.deserialize(b));
    const ship = new Ship(blocks, data.name || 'Schiff');
    ship.body.pos.x = data.x || 0;
    ship.body.pos.y = data.y || 0;
    ship.body.angle = data.angle || 0;
    return ship;
  }

  // Create a default starter ship
  static createDefault(name = 'Spieler') {
    const blocks = [];

    // Cockpit center
    blocks.push(new Block('COCKPIT', 0, 0));

    // Hull surround
    blocks.push(new Block('HULL', -1, -1));
    blocks.push(new Block('HULL', 0, -1));
    blocks.push(new Block('HULL', 1, -1));
    blocks.push(new Block('HULL', -1, 0));
    blocks.push(new Block('HULL', 1, 0));
    blocks.push(new Block('HULL', -1, 1));
    blocks.push(new Block('HULL', 0, 1));
    blocks.push(new Block('HULL', 1, 1));

    // Thrusters (back)
    blocks.push(new Block('THRUSTER', -1, 2));
    blocks.push(new Block('THRUSTER', 0, 2));
    blocks.push(new Block('THRUSTER', 1, 2));

    // Reactors
    blocks.push(new Block('REACTOR', -2, 0));
    blocks.push(new Block('REACTOR', 2, 0));

    // Weapons (front)
    blocks.push(new Block('LASER', -1, -2));
    blocks.push(new Block('LASER', 1, -2));

    return new Ship(blocks, name);
  }

  // Create a small enemy ship
  static createEnemy(name = 'Feind', difficulty = 1) {
    const blocks = [];
    blocks.push(new Block('COCKPIT', 0, 0));

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        blocks.push(new Block('HULL', i, j));
      }
    }
    blocks.push(new Block('THRUSTER', -1, 2));
    blocks.push(new Block('THRUSTER', 0, 2));
    blocks.push(new Block('THRUSTER', 1, 2));
    blocks.push(new Block('REACTOR', 0, -2));
    blocks.push(new Block('LASER', 0, -1));

    if (difficulty >= 2) {
      blocks.push(new Block('CANNON', -1, -2));
      blocks.push(new Block('CANNON', 1, -2));
      blocks.push(new Block('SHIELD', -2, 0));
      blocks.push(new Block('SHIELD', 2, 0));
    }
    if (difficulty >= 3) {
      blocks.push(new Block('REACTOR', -2, 1));
      blocks.push(new Block('REACTOR', 2, 1));
      blocks.push(new Block('LASER', -2, -1));
      blocks.push(new Block('LASER', 2, -1));
    }

    return new Ship(blocks, name);
  }
}
