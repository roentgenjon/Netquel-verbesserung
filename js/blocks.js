/**
 * Block type definitions and rendering — Neon Sci-Fi / Toon-Shading style.
 * Each block is a 32x32 cell on the ship grid.
 */

const BLOCK_SIZE = 32;

const BLOCK_TYPES = {
  HULL:     { id: 'HULL',     name: 'Hülle',      hp: 120, mass: 1.0, color: '#1e3a5a', outline: '#4ab0ff', glow: '#1a6aaa', key: '1', energy: 0 },
  COCKPIT:  { id: 'COCKPIT',  name: 'Cockpit',    hp: 80,  mass: 0.8, color: '#0d2540', outline: '#00d4ff', glow: '#00aaff', key: '2', energy: 0, isCockpit: true },
  THRUSTER: { id: 'THRUSTER', name: 'Triebwerk',  hp: 60,  mass: 0.6, color: '#2a1800', outline: '#ff6a00', glow: '#ff8800', key: '3', energy: 2, isThruster: true },
  REACTOR:  { id: 'REACTOR',  name: 'Reaktor',    hp: 100, mass: 1.2, color: '#0a2010', outline: '#00ff88', glow: '#00cc66', key: '4', energy: -10, isReactor: true },
  LASER:    { id: 'LASER',    name: 'Laser',      hp: 50,  mass: 0.5, color: '#300010', outline: '#ff1040', glow: '#ff0030', key: '5', energy: 5, isWeapon: true, weaponType: 'laser' },
  DRILL:    { id: 'DRILL',    name: 'Bohrer',     hp: 90,  mass: 1.0, color: '#261400', outline: '#ffaa00', glow: '#dd8800', key: '6', energy: 3, isWeapon: true, weaponType: 'drill' },
  SHIELD:   { id: 'SHIELD',   name: 'Schild',     hp: 200, mass: 1.5, color: '#080020', outline: '#6644ff', glow: '#4422cc', key: '7', energy: 4, isShield: true },
  CANNON:   { id: 'CANNON',   name: 'Kanone',     hp: 70,  mass: 0.8, color: '#200800', outline: '#ff4400', glow: '#cc3300', key: '8', energy: 6, isWeapon: true, weaponType: 'cannon' },
  REPAIR:   { id: 'REPAIR',   name: 'Reparatur',  hp: 60,  mass: 0.6, color: '#041a12', outline: '#00ffaa', glow: '#00cc88', key: '9', energy: 3, isRepair: true },
};

const BLOCK_LIST = Object.values(BLOCK_TYPES);

// Rounded rect helper
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

class Block {
  constructor(type, gridX, gridY) {
    this.type = typeof type === 'string' ? BLOCK_TYPES[type] : type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.hp = this.type.hp;
    this.maxHp = this.type.hp;
    this.damaged = false;
    this.fireTimer = 0;
    this.active = true;
    this._glowPhase = Math.random() * Math.PI * 2;
  }

  get isDestroyed() { return this.hp <= 0; }
  get hpRatio() { return Math.max(0, this.hp / this.maxHp); }

  takeDamage(amount) {
    this.hp -= amount;
    this.damaged = true;
    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
    }
  }

  repair(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  draw(ctx, x, y, size, alpha = 1) {
    const t = this.type;
    const s = size;
    const pad = 1;
    const r = Math.max(2, s * 0.18); // corner radius
    const dmg = 1 - this.hpRatio;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003 + this._glowPhase);

    ctx.save();
    ctx.globalAlpha = alpha;

    // ── Outer glow (neon outline effect) ──────────────────────────────
    ctx.save();
    ctx.globalAlpha = alpha * (0.25 + pulse * 0.12);
    ctx.shadowColor = t.glow;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 3;
    roundRect(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r);
    ctx.stroke();
    ctx.restore();

    // ── Background fill with top-light gradient ───────────────────────
    const grad = ctx.createLinearGradient(x, y, x, y + s);
    // Parse hex to slightly lighter/darker
    grad.addColorStop(0,   this._lighten(t.color, 0.25));
    grad.addColorStop(0.5, t.color);
    grad.addColorStop(1,   this._darken(t.color, 0.3));
    roundRect(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r);
    ctx.fillStyle = grad;
    ctx.fill();

    // ── Inner bevel highlight (top-left edge) ─────────────────────────
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    const bevel = ctx.createLinearGradient(x, y, x + s * 0.5, y + s * 0.5);
    bevel.addColorStop(0, 'rgba(255,255,255,0.5)');
    bevel.addColorStop(1, 'transparent');
    ctx.fillStyle = bevel;
    roundRect(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r);
    ctx.fill();
    ctx.restore();

    // ── Damage overlay ────────────────────────────────────────────────
    if (dmg > 0) {
      ctx.globalAlpha = alpha * dmg * 0.55;
      ctx.fillStyle = '#ff2200';
      roundRect(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    // ── Type-specific icon ────────────────────────────────────────────
    ctx.globalAlpha = alpha;
    this._drawDetail(ctx, x, y, s, pulse);

    // ── Neon border ───────────────────────────────────────────────────
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = alpha * (0.8 + pulse * 0.2);
    roundRect(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r);
    ctx.stroke();

    // ── Damage cracks ─────────────────────────────────────────────────
    if (dmg > 0.3) {
      ctx.globalAlpha = alpha * (dmg - 0.3) * 1.2;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.15, y + s * 0.25);
      ctx.lineTo(x + s * 0.45, y + s * 0.55);
      ctx.lineTo(x + s * 0.35, y + s * 0.75);
      ctx.moveTo(x + s * 0.65, y + s * 0.15);
      ctx.lineTo(x + s * 0.50, y + s * 0.45);
      ctx.moveTo(x + s * 0.70, y + s * 0.60);
      ctx.lineTo(x + s * 0.85, y + s * 0.80);
      ctx.stroke();
    }

    ctx.restore();
  }

  _lighten(hex, amt) {
    return this._adjustHex(hex, amt);
  }
  _darken(hex, amt) {
    return this._adjustHex(hex, -amt);
  }
  _adjustHex(hex, amt) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
    const adjust = v => clamp(v + v * amt + 255 * Math.max(0, amt));
    return `rgb(${adjust(r)},${adjust(g)},${adjust(b)})`;
  }

  _drawDetail(ctx, x, y, s, pulse) {
    const id = this.type.id;
    const cx = x + s / 2, cy = y + s / 2;
    const col = this.type.outline;
    ctx.save();

    if (id === 'COCKPIT') {
      // Hexagonal cockpit window with glow
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(0,180,255,${0.25 + pulse * 0.15})`;
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 1.5;
      const hw = s * 0.28;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const px = cx + Math.cos(a) * hw;
        const py = cy + Math.sin(a) * hw;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Center dot
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (id === 'THRUSTER') {
      // Nozzle shape
      ctx.fillStyle = '#ff6a00';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.25, y + s * 0.12);
      ctx.lineTo(x + s * 0.75, y + s * 0.12);
      ctx.lineTo(x + s * 0.85, y + s * 0.72);
      ctx.lineTo(x + s * 0.15, y + s * 0.72);
      ctx.closePath();
      ctx.fill();
      // Flame core
      ctx.fillStyle = `rgba(255,220,60,${0.7 + pulse * 0.3})`;
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(cx, y + s * 0.55, s * 0.14, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // Nozzle ring
      ctx.strokeStyle = '#ffaa44';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.18, y + s * 0.72);
      ctx.lineTo(x + s * 0.82, y + s * 0.72);
      ctx.stroke();

    } else if (id === 'REACTOR') {
      // Pulsing rings
      ctx.shadowColor = '#00ff88';
      ctx.strokeStyle = '#00ff88';
      for (let i = 2; i >= 0; i--) {
        const r2 = (s * 0.12) + i * (s * 0.07);
        ctx.globalAlpha = (0.3 + pulse * 0.4) * (1 - i * 0.2);
        ctx.shadowBlur = 8 - i * 2;
        ctx.lineWidth = 1.5 - i * 0.3;
        ctx.beginPath();
        ctx.arc(cx, cy, r2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Hot core
      ctx.fillStyle = `rgb(${Math.round(100 + pulse * 100)},255,${Math.round(100 + pulse * 50)})`;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.1, 0, Math.PI * 2);
      ctx.fill();

    } else if (id === 'LASER') {
      // Barrel + energy core
      ctx.shadowColor = '#ff1040';
      ctx.shadowBlur = 8;
      // Side rails
      ctx.fillStyle = '#550010';
      ctx.fillRect(x + s * 0.28, y + s * 0.1, s * 0.12, s * 0.8);
      ctx.fillRect(x + s * 0.60, y + s * 0.1, s * 0.12, s * 0.8);
      // Energy beam glow in center
      ctx.fillStyle = `rgba(255,10,50,${0.5 + pulse * 0.4})`;
      ctx.shadowBlur = 10;
      ctx.fillRect(x + s * 0.40, y + s * 0.1, s * 0.20, s * 0.8);
      // Bright core
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 4;
      ctx.fillRect(x + s * 0.46, y + s * 0.12, s * 0.08, s * 0.76);

    } else if (id === 'DRILL') {
      // Spinning-tip drill
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 8;
      // Body
      ctx.fillStyle = '#886600';
      ctx.fillRect(x + s * 0.38, y + s * 0.35, s * 0.24, s * 0.5);
      // Tip triangle
      ctx.fillStyle = '#ffcc22';
      ctx.beginPath();
      ctx.moveTo(cx, y + s * 0.08);
      ctx.lineTo(x + s * 0.28, y + s * 0.38);
      ctx.lineTo(x + s * 0.72, y + s * 0.38);
      ctx.closePath();
      ctx.fill();
      // Drill grooves
      ctx.strokeStyle = '#cc8800';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const gy2 = y + s * (0.42 + i * 0.14);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.38, gy2);
        ctx.lineTo(x + s * 0.62, gy2);
        ctx.stroke();
      }

    } else if (id === 'SHIELD') {
      // Hexagonal shield
      ctx.shadowColor = '#6644ff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = `rgba(100,80,255,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      const sr = s * 0.32;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = cx + Math.cos(a) * sr;
        const py = cy + Math.sin(a) * sr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner fill
      ctx.fillStyle = `rgba(80,60,200,${0.1 + pulse * 0.15})`;
      ctx.fill();
      // Center bolt
      ctx.strokeStyle = '#9988ff';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.14);
      ctx.lineTo(cx - s * 0.08, cy);
      ctx.lineTo(cx + s * 0.04, cy);
      ctx.lineTo(cx - s * 0.04, cy + s * 0.14);
      ctx.stroke();

    } else if (id === 'CANNON') {
      // Wide barrel
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 8;
      // Barrel housing
      ctx.fillStyle = '#441100';
      ctx.fillRect(x + s * 0.25, y + s * 0.18, s * 0.5, s * 0.65);
      // Front ring
      ctx.strokeStyle = '#ff5500';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + s * 0.25, y + s * 0.15, s * 0.5, s * 0.15);
      // Barrel hole
      ctx.fillStyle = `rgba(255,80,0,${0.4 + pulse * 0.4})`;
      ctx.shadowBlur = 10;
      ctx.fillRect(x + s * 0.36, y + s * 0.17, s * 0.28, s * 0.11);
      // Side reinforcements
      ctx.strokeStyle = '#883300';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.25, y + s * 0.38);
      ctx.lineTo(x + s * 0.75, y + s * 0.38);
      ctx.moveTo(x + s * 0.25, y + s * 0.56);
      ctx.lineTo(x + s * 0.75, y + s * 0.56);
      ctx.stroke();

    } else if (id === 'REPAIR') {
      // Medical cross with glow
      ctx.shadowColor = '#00ffaa';
      ctx.shadowBlur = 10;
      ctx.fillStyle = `rgba(0,255,150,${0.7 + pulse * 0.3})`;
      const t2 = s * 0.12, arm = s * 0.3;
      ctx.fillRect(cx - t2, cy - arm, t2 * 2, arm * 2);
      ctx.fillRect(cx - arm, cy - t2, arm * 2, t2 * 2);
      // White center
      ctx.fillStyle = `rgba(200,255,230,${0.5 + pulse * 0.3})`;
      ctx.fillRect(cx - t2 * 0.6, cy - t2 * 0.6, t2 * 1.2, t2 * 1.2);

    } else if (id === 'HULL') {
      // Rivets / panel lines
      ctx.strokeStyle = `rgba(80,160,255,0.35)`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.3, y + s * 0.18);
      ctx.lineTo(x + s * 0.3, y + s * 0.82);
      ctx.moveTo(x + s * 0.7, y + s * 0.18);
      ctx.lineTo(x + s * 0.7, y + s * 0.82);
      ctx.moveTo(x + s * 0.18, y + s * 0.5);
      ctx.lineTo(x + s * 0.82, y + s * 0.5);
      ctx.stroke();
      // Corner rivets
      ctx.fillStyle = 'rgba(100,170,255,0.5)';
      for (const [rx, ry] of [[0.22,0.22],[0.78,0.22],[0.22,0.78],[0.78,0.78]]) {
        ctx.beginPath();
        ctx.arc(x + s * rx, y + s * ry, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  serialize() {
    return { type: this.type.id, gx: this.gridX, gy: this.gridY };
  }

  static deserialize(data) {
    return new Block(data.type, data.gx, data.gy);
  }
}
