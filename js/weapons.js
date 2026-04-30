/**
 * Projectile types and weapon firing logic.
 */

const WEAPON_CONFIGS = {
  laser: {
    speed: 600,
    damage: 18,
    energyCost: 6,
    cooldown: 0.18,
    color: '#ff2040',
    glowColor: '#ff4060',
    size: 6,
    lifetime: 2.0,
    type: 'laser',
  },
  cannon: {
    speed: 420,
    damage: 45,
    energyCost: 14,
    cooldown: 0.55,
    color: '#ffaa30',
    glowColor: '#ff8020',
    size: 10,
    lifetime: 2.5,
    type: 'cannon',
  },
  drill: {
    speed: 0,
    damage: 8,
    energyCost: 3,
    cooldown: 0.08,
    range: 48,
    type: 'drill',
  },
};

class Projectile {
  constructor(x, y, angle, ownerId, config) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * config.speed;
    this.vy = Math.sin(angle) * config.speed;
    this.ownerId = ownerId;
    this.config = config;
    this.lifetime = config.lifetime;
    this.alive = true;
    this.hitX = x;
    this.hitY = y;
  }

  update(dt) {
    if (!this.alive) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifetime -= dt;
    if (this.lifetime <= 0) this.alive = false;
  }

  draw(ctx) {
    if (!this.alive) return;
    const cfg = this.config;
    ctx.save();

    if (cfg.type === 'laser') {
      // Glow
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = cfg.glowColor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, cfg.size * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = 1;
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, cfg.size * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Trail
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03);
      ctx.stroke();

    } else if (cfg.type === 'cannon') {
      // Outer glow
      ctx.globalAlpha = 0.3;
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, cfg.size * 1.5);
      grad.addColorStop(0, cfg.glowColor);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, cfg.size * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = 1;
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, cfg.size * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Shell shape
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = cfg.color;
      ctx.fillRect(-cfg.size * 0.7, -cfg.size * 0.25, cfg.size * 1.4, cfg.size * 0.5);
      ctx.restore();
    }

    ctx.restore();
  }

  kill() { this.alive = false; }
}

class WeaponSystem {
  constructor() {
    this.projectiles = [];
  }

  update(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(dt);
      if (!this.projectiles[i].alive) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.projectiles) {
      p.draw(ctx);
    }
  }

  // Fire from a block on a ship
  fire(ship, blockType, particles) {
    const cfg = WEAPON_CONFIGS[blockType];
    if (!cfg) return false;

    // Find weapon blocks of this type
    const blocks = ship.getBlocksByType(blockType.toUpperCase() === blockType ? blockType : blockType.toUpperCase());
    if (blocks.length === 0) return false;

    let fired = false;
    for (const block of blocks) {
      if (block.fireTimer > 0) continue;

      const worldPos = ship.body.localToWorld(
        block.gridX * BLOCK_SIZE + BLOCK_SIZE / 2,
        block.gridY * BLOCK_SIZE + BLOCK_SIZE / 2
      );

      const proj = new Projectile(
        worldPos.x, worldPos.y,
        ship.body.angle,
        ship.id,
        cfg
      );

      // Inherit ship velocity
      proj.vx += ship.body.vel.x * 0.5;
      proj.vy += ship.body.vel.y * 0.5;

      this.projectiles.push(proj);
      block.fireTimer = cfg.cooldown;

      if (particles) {
        if (cfg.type === 'laser') {
          particles.laserImpact(worldPos.x, worldPos.y);
        } else if (cfg.type === 'cannon') {
          for (let i = 0; i < 4; i++) {
            const a = ship.body.angle + (Math.random() - 0.5) * 0.3;
            const speed = randRange(30, 80);
            particles.emit(worldPos.x, worldPos.y,
              Math.cos(a) * speed, Math.sin(a) * speed,
              0.2, '#ffaa30', 3, 'spark');
          }
        }
      }

      fired = true;
    }
    return fired;
  }

  // Check projectile hits against a ship, returns {hit, damage, proj}
  checkHits(ship, particles) {
    const hits = [];
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;
      if (proj.ownerId === ship.id) continue;

      // Check against each block
      for (const block of ship.blocks) {
        if (block.isDestroyed) continue;

        const worldPos = ship.body.localToWorld(
          block.gridX * BLOCK_SIZE + BLOCK_SIZE / 2,
          block.gridY * BLOCK_SIZE + BLOCK_SIZE / 2
        );

        const dx = proj.x - worldPos.x;
        const dy = proj.y - worldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < BLOCK_SIZE * 0.6) {
          const isShield = block.type.isShield;
          const dmg = isShield ? proj.config.damage * 0.4 : proj.config.damage;
          block.takeDamage(dmg);

          if (particles) {
            if (isShield) {
              particles.shieldImpact(worldPos.x, worldPos.y);
            } else if (proj.config.type === 'laser') {
              particles.laserImpact(worldPos.x, worldPos.y);
            } else {
              particles.cannonImpact(worldPos.x, worldPos.y);
            }

            if (block.isDestroyed) {
              particles.blockExplosion(worldPos.x, worldPos.y, block.type);
            }
          }

          proj.kill();
          hits.push({ block, damage: dmg, proj, worldPos });
          break;
        }
      }
    }
    return hits;
  }

  // Drill attack: close-range beam damage
  drillAttack(sourceShip, targetShip, particles) {
    const cfg = WEAPON_CONFIGS.drill;
    const drillBlocks = sourceShip.getBlocksByType('DRILL');
    if (drillBlocks.length === 0) return 0;

    let totalDamage = 0;
    for (const db of drillBlocks) {
      if (db.fireTimer > 0) continue;

      const dwp = sourceShip.body.localToWorld(
        db.gridX * BLOCK_SIZE + BLOCK_SIZE / 2,
        db.gridY * BLOCK_SIZE + BLOCK_SIZE / 2
      );

      // Find the closest target block in drill range
      for (const tb of targetShip.blocks) {
        if (tb.isDestroyed) continue;
        const twp = targetShip.body.localToWorld(
          tb.gridX * BLOCK_SIZE + BLOCK_SIZE / 2,
          tb.gridY * BLOCK_SIZE + BLOCK_SIZE / 2
        );

        const dist = Vec2.dist(dwp, twp);
        if (dist < cfg.range + BLOCK_SIZE) {
          tb.takeDamage(cfg.damage);
          totalDamage += cfg.damage;
          db.fireTimer = cfg.cooldown;
          if (particles) {
            particles.drillSparks(twp.x, twp.y,
              Math.atan2(twp.y - dwp.y, twp.x - dwp.x));
            if (tb.isDestroyed) {
              particles.blockExplosion(twp.x, twp.y, tb.type);
            }
          }
          break;
        }
      }
    }
    return totalDamage;
  }
}
