/**
 * Particle system for explosions, thrust effects, and impacts.
 */

class Particle {
  constructor(x, y, vx, vy, life, color, size, type = 'spark') {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
    this.type = type;
    this.alpha = 1;
  }

  get alive() { return this.life > 0; }
  get lifeRatio() { return this.life / this.maxLife; }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.97;
    this.vy *= 0.97;
    this.life -= dt;
    this.alpha = Math.max(0, this.lifeRatio);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;

    if (this.type === 'spark') {
      ctx.fillStyle = this.color;
      const s = this.size * this.lifeRatio;
      ctx.fillRect(this.x - s/2, this.y - s/2, s, s);

    } else if (this.type === 'glow') {
      const s = this.size * (2 - this.lifeRatio);
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, s);
      grad.addColorStop(0, this.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, s, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'debris') {
      ctx.fillStyle = this.color;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.life * 5);
      const s = this.size;
      ctx.fillRect(-s/2, -s/2, s, s);
      ctx.restore();

    } else if (this.type === 'smoke') {
      const s = this.size * (1.5 - this.lifeRatio * 0.5);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.alpha * 0.3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, s, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'laser') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size * this.lifeRatio;
      ctx.globalAlpha = this.alpha * 0.8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (!this.particles[i].alive) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      p.draw(ctx);
    }
  }

  emit(x, y, vx, vy, life, color, size, type) {
    if (this.particles.length > 1200) return;
    this.particles.push(new Particle(x, y, vx, vy, life, color, size, type));
  }

  // Thruster exhaust flame
  thrusterExhaust(x, y, angle, intensity = 1) {
    const count = Math.floor(2 + intensity * 3);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      const exhaustAngle = angle + Math.PI + spread;
      const speed = randRange(60, 140) * intensity;
      const vx = Math.cos(exhaustAngle) * speed + randRange(-10, 10);
      const vy = Math.sin(exhaustAngle) * speed + randRange(-10, 10);

      const t = Math.random();
      const color = t < 0.4 ? '#ff8020' : t < 0.7 ? '#ffcc40' : '#ffffff';
      this.emit(x, y, vx, vy, randRange(0.1, 0.25) * intensity, color, randRange(3, 8) * intensity, 'spark');

      if (Math.random() < 0.3) {
        this.emit(x, y, vx * 0.3, vy * 0.3, randRange(0.3, 0.6), '#444', randRange(6, 12), 'smoke');
      }
    }
  }

  // Boost exhaust (larger)
  boostExhaust(x, y, angle, intensity = 1) {
    const count = Math.floor(4 + intensity * 5);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const exhaustAngle = angle + Math.PI + spread;
      const speed = randRange(120, 280) * intensity;
      const vx = Math.cos(exhaustAngle) * speed;
      const vy = Math.sin(exhaustAngle) * speed;

      const t = Math.random();
      const color = t < 0.3 ? '#60a0ff' : t < 0.6 ? '#8040ff' : '#ffffff';
      this.emit(x, y, vx, vy, randRange(0.15, 0.4), color, randRange(4, 10) * intensity, 'glow');
    }
  }

  // Block destruction explosion
  blockExplosion(x, y, blockType) {
    const color = blockType.color;
    const outline = blockType.outline;

    // Debris
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randRange(40, 150);
      this.emit(
        x + randRange(-8, 8), y + randRange(-8, 8),
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.4, 1.2),
        Math.random() < 0.5 ? color : outline,
        randRange(3, 8), 'debris'
      );
    }

    // Sparks
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randRange(80, 200);
      this.emit(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.2, 0.5),
        '#ffaa30', randRange(2, 5), 'spark'
      );
    }

    // Glow
    this.emit(x, y, 0, 0, 0.5, '#ff8020', 30, 'glow');
    this.emit(x, y, 0, 0, 0.3, '#ffffff', 15, 'glow');
  }

  // Ship explosion (many blocks)
  shipExplosion(x, y, radius = 80) {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      const speed = randRange(50, 200);
      const dir = Math.random() * Math.PI * 2;

      this.emit(px, py, Math.cos(dir) * speed, Math.sin(dir) * speed,
        randRange(0.5, 2.0), '#ff6020', randRange(4, 12), 'debris');
    }

    // Big glows
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.5;
      this.emit(
        x + Math.cos(angle) * r,
        y + Math.sin(angle) * r,
        0, 0, randRange(0.3, 0.8),
        Math.random() < 0.5 ? '#ff8020' : '#ffcc40',
        randRange(20, 50), 'glow'
      );
    }

    this.emit(x, y, 0, 0, 1.0, '#ff4010', radius, 'glow');
    this.emit(x, y, 0, 0, 0.5, '#ffffff', radius * 0.5, 'glow');
  }

  // Laser impact
  laserImpact(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randRange(40, 120);
      this.emit(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.1, 0.3), '#ff4466', randRange(2, 4), 'spark');
    }
    this.emit(x, y, 0, 0, 0.2, '#ff2040', 12, 'glow');
  }

  // Cannon impact
  cannonImpact(x, y) {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randRange(60, 180);
      this.emit(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.2, 0.6), '#ffaa30', randRange(3, 7), 'debris');
    }
    this.emit(x, y, 0, 0, 0.35, '#ff8020', 20, 'glow');
  }

  // Drill sparks
  drillSparks(x, y, angle) {
    for (let i = 0; i < 3; i++) {
      const spread = (Math.random() - 0.5) * 1.0;
      const speed = randRange(60, 120);
      const a = angle + spread;
      this.emit(x, y, Math.cos(a) * speed, Math.sin(a) * speed,
        randRange(0.1, 0.25), '#d0a020', randRange(2, 4), 'spark');
    }
  }

  // Shield impact
  shieldImpact(x, y) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randRange(30, 80);
      this.emit(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.15, 0.4), '#4060ff', randRange(2, 5), 'laser');
    }
    this.emit(x, y, 0, 0, 0.3, '#6080ff', 15, 'glow');
  }
}
