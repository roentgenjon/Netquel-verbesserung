/**
 * Block type definitions and rendering for the ship system.
 * Each block is a 32x32 cell on the ship grid.
 */

const BLOCK_SIZE = 32;

const BLOCK_TYPES = {
  HULL:     { id: 'HULL',     name: 'Hülle',      hp: 120, mass: 1.0, color: '#4a6080', outline: '#6a90c0', key: '1', energy: 0 },
  COCKPIT:  { id: 'COCKPIT',  name: 'Cockpit',    hp: 80,  mass: 0.8, color: '#1a6090', outline: '#30a0e0', key: '2', energy: 0, isCockpit: true },
  THRUSTER: { id: 'THRUSTER', name: 'Triebwerk',  hp: 60,  mass: 0.6, color: '#804020', outline: '#e07030', key: '3', energy: 2, isThruster: true },
  REACTOR:  { id: 'REACTOR',  name: 'Reaktor',    hp: 100, mass: 1.2, color: '#204020', outline: '#30c040', key: '4', energy: -10, isReactor: true },
  LASER:    { id: 'LASER',    name: 'Laser',      hp: 50,  mass: 0.5, color: '#600020', outline: '#ff2040', key: '5', energy: 5, isWeapon: true, weaponType: 'laser' },
  DRILL:    { id: 'DRILL',    name: 'Bohrer',     hp: 90,  mass: 1.0, color: '#604010', outline: '#d08020', key: '6', energy: 3, isWeapon: true, weaponType: 'drill' },
  SHIELD:   { id: 'SHIELD',   name: 'Schild',     hp: 200, mass: 1.5, color: '#202060', outline: '#4040d0', key: '7', energy: 4, isShield: true },
  CANNON:   { id: 'CANNON',   name: 'Kanone',     hp: 70,  mass: 0.8, color: '#402020', outline: '#c04030', key: '8', energy: 6, isWeapon: true, weaponType: 'cannon' },
  REPAIR:   { id: 'REPAIR',   name: 'Reparatur',  hp: 60,  mass: 0.6, color: '#205040', outline: '#30d080', key: '9', energy: 3, isRepair: true },
};

const BLOCK_LIST = Object.values(BLOCK_TYPES);

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
    ctx.save();
    ctx.globalAlpha = alpha;

    const dmg = 1 - this.hpRatio;
    const s = size;

    // Background fill
    ctx.fillStyle = t.color;
    ctx.fillRect(x, y, s, s);

    // Damage overlay
    if (dmg > 0) {
      ctx.fillStyle = `rgba(255,60,0,${dmg * 0.6})`;
      ctx.fillRect(x, y, s, s);
    }

    // Type-specific detail
    this._drawDetail(ctx, x, y, s);

    // Border
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);

    // Damage cracks
    if (dmg > 0.3) {
      ctx.strokeStyle = `rgba(200,100,0,${(dmg - 0.3) * 0.8})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.2, y + s * 0.3);
      ctx.lineTo(x + s * 0.6, y + s * 0.7);
      ctx.moveTo(x + s * 0.7, y + s * 0.2);
      ctx.lineTo(x + s * 0.4, y + s * 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawDetail(ctx, x, y, s) {
    const id = this.type.id;
    ctx.save();

    if (id === 'COCKPIT') {
      ctx.fillStyle = 'rgba(50,180,255,0.5)';
      ctx.fillRect(x + 6, y + 6, s - 12, s - 12);
      ctx.strokeStyle = 'rgba(80,200,255,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 6, y + 6, s - 12, s - 12);
      // Dot
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + s/2, y + s/2, 3, 0, Math.PI*2);
      ctx.fill();

    } else if (id === 'THRUSTER') {
      ctx.fillStyle = '#e08030';
      ctx.beginPath();
      ctx.moveTo(x + s*0.3, y + 2);
      ctx.lineTo(x + s*0.7, y + 2);
      ctx.lineTo(x + s*0.8, y + s - 4);
      ctx.lineTo(x + s*0.2, y + s - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(x + s/2, y + s*0.35, s*0.12, 0, Math.PI*2);
      ctx.fill();

    } else if (id === 'REACTOR') {
      ctx.strokeStyle = '#60ff80';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const r = 4 + i * 4;
        ctx.globalAlpha = 0.5 - i * 0.1;
        ctx.beginPath();
        ctx.arc(x + s/2, y + s/2, r, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#60ff80';
      ctx.beginPath();
      ctx.arc(x + s/2, y + s/2, 3, 0, Math.PI*2);
      ctx.fill();

    } else if (id === 'LASER') {
      ctx.fillStyle = '#ff2040';
      ctx.fillRect(x + s*0.4, y + 2, s*0.2, s - 4);
      ctx.fillStyle = '#ff8090';
      ctx.fillRect(x + s*0.45, y + 2, s*0.1, s - 4);

    } else if (id === 'DRILL') {
      ctx.fillStyle = '#d08020';
      ctx.beginPath();
      ctx.moveTo(x + s/2, y + 2);
      ctx.lineTo(x + s*0.2, y + s - 4);
      ctx.lineTo(x + s*0.8, y + s - 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffaa40';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + s/2, y + 2);
      ctx.lineTo(x + s/2, y + s - 4);
      ctx.stroke();

    } else if (id === 'SHIELD') {
      ctx.strokeStyle = '#6080ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + s/2, y + s/2, s*0.35, -Math.PI*0.8, Math.PI*0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s/2, y + s/2, s*0.2, -Math.PI*0.8, Math.PI*0.8);
      ctx.stroke();

    } else if (id === 'CANNON') {
      ctx.fillStyle = '#c04030';
      ctx.fillRect(x + s*0.35, y + 4, s*0.3, s - 8);
      ctx.fillStyle = '#ff6050';
      ctx.fillRect(x + s*0.4, y + 2, s*0.2, s*0.4);

    } else if (id === 'REPAIR') {
      ctx.strokeStyle = '#30d080';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + s/2, y + 5); ctx.lineTo(x + s/2, y + s - 5);
      ctx.moveTo(x + 5, y + s/2); ctx.lineTo(x + s - 5, y + s/2);
      ctx.stroke();
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
