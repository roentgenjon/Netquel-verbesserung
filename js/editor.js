/**
 * Ship editor — block-based grid builder.
 * No size limit on the grid (as per plan step 3).
 */

class ShipEditor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.blocks = new Map(); // key: "x,y" -> Block
    this.selectedType = BLOCK_TYPES.HULL;
    this.camX = 0;
    this.camY = 0;
    this.zoom = 1.2;
    this.minZoom = 0.15;
    this.maxZoom = 5;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartCamX = 0;
    this.dragStartCamY = 0;
    this.painting = false;
    this.erasing = false;
    this.showGrid = true;
    this.mouseGridX = 0;
    this.mouseGridY = 0;
    this.active = false;

    this._buildPalette();
    this._bindEvents();
  }

  _buildPalette() {
    const list = document.getElementById('block-list');
    list.innerHTML = '';
    for (const type of BLOCK_LIST) {
      const btn = document.createElement('button');
      btn.className = 'block-btn' + (type === this.selectedType ? ' selected' : '');
      btn.dataset.typeId = type.id;

      const icon = document.createElement('div');
      icon.className = 'block-icon';
      icon.style.background = type.color;
      icon.style.border = `1px solid ${type.outline}`;

      const label = document.createElement('span');
      label.textContent = type.name;

      const key = document.createElement('span');
      key.className = 'block-key';
      key.textContent = type.key;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(key);
      btn.addEventListener('click', () => this.selectType(type));
      list.appendChild(btn);
    }
  }

  selectType(type) {
    this.selectedType = type;
    document.querySelectorAll('.block-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.typeId === type.id);
    });
  }

  _bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('mousedown', e => {
      if (!this.active) return;
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartCamX = this.camX;
        this.dragStartCamY = this.camY;
        e.preventDefault();
      } else if (e.button === 0) {
        this.painting = true;
        this._paintAt(e);
      } else if (e.button === 2) {
        this.erasing = true;
        this._eraseAt(e);
      }
    });

    window.addEventListener('mousemove', e => {
      if (!this.active) return;
      if (this.isDragging) {
        const dx = (e.clientX - this.dragStartX) / this.zoom;
        const dy = (e.clientY - this.dragStartY) / this.zoom;
        this.camX = this.dragStartCamX - dx;
        this.camY = this.dragStartCamY - dy;
      }
      if (this.painting) this._paintAt(e);
      if (this.erasing) this._eraseAt(e);
      this._updateMouseGrid(e);
    });

    window.addEventListener('mouseup', e => {
      this.isDragging = false;
      this.painting = false;
      this.erasing = false;
    });

    canvas.addEventListener('wheel', e => {
      if (!this.active) return;
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', e => {
      if (!this.active) return;
      // Number keys to select blocks
      for (const type of BLOCK_LIST) {
        if (e.key === type.key) {
          this.selectType(type);
          return;
        }
      }
      if (e.key === 'g' || e.key === 'G') {
        this.showGrid = !this.showGrid;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const key = `${this.mouseGridX},${this.mouseGridY}`;
        this.blocks.delete(key);
        this._updateStatus();
      }
    });
  }

  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  _canvasToGrid(cx, cy) {
    const wx = (cx - this.canvas.width / 2) / this.zoom + this.camX;
    const wy = (cy - this.canvas.height / 2) / this.zoom + this.camY;
    return {
      gx: Math.floor(wx / BLOCK_SIZE),
      gy: Math.floor(wy / BLOCK_SIZE),
    };
  }

  _updateMouseGrid(e) {
    const cp = this._getCanvasPos(e);
    const { gx, gy } = this._canvasToGrid(cp.x, cp.y);
    this.mouseGridX = gx;
    this.mouseGridY = gy;
    const coordEl = document.getElementById('editor-coords');
    if (coordEl) coordEl.textContent = `X: ${gx}, Y: ${gy}`;
  }

  _paintAt(e) {
    const cp = this._getCanvasPos(e);
    const { gx, gy } = this._canvasToGrid(cp.x, cp.y);
    const key = `${gx},${gy}`;
    if (!this.blocks.has(key)) {
      this.blocks.set(key, new Block(this.selectedType, gx, gy));
      this._updateStatus();
    }
  }

  _eraseAt(e) {
    const cp = this._getCanvasPos(e);
    const { gx, gy } = this._canvasToGrid(cp.x, cp.y);
    const key = `${gx},${gy}`;
    if (this.blocks.has(key)) {
      this.blocks.delete(key);
      this._updateStatus();
    }
  }

  _updateStatus() {
    const el = document.getElementById('editor-block-count');
    if (el) el.textContent = `Blöcke: ${this.blocks.size}`;
  }

  clear() {
    this.blocks.clear();
    this._updateStatus();
  }

  getShipBlocks() {
    return Array.from(this.blocks.values()).map(b => new Block(b.type, b.gridX, b.gridY));
  }

  buildShip(name = 'Mein Schiff') {
    const blocks = this.getShipBlocks();
    if (blocks.length === 0) return null;
    // Ensure cockpit
    if (!blocks.some(b => b.type.isCockpit)) {
      return null;
    }
    return new Ship(blocks, name);
  }

  loadFromShip(ship) {
    this.blocks.clear();
    for (const b of ship.blocks) {
      const key = `${b.gridX},${b.gridY}`;
      this.blocks.set(key, new Block(b.type, b.gridX, b.gridY));
    }
    this._updateStatus();
    this._centerView();
  }

  loadDefault() {
    const ship = Ship.createDefault();
    this.loadFromShip(ship);
  }

  _centerView() {
    if (this.blocks.size === 0) { this.camX = 0; this.camY = 0; return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of this.blocks.values()) {
      minX = Math.min(minX, b.gridX); maxX = Math.max(maxX, b.gridX);
      minY = Math.min(minY, b.gridY); maxY = Math.max(maxY, b.gridY);
    }
    this.camX = (minX + maxX + 1) / 2 * BLOCK_SIZE;
    this.camY = (minY + maxY + 1) / 2 * BLOCK_SIZE;
  }

  save() {
    const data = {
      blocks: Array.from(this.blocks.values()).map(b => b.serialize()),
    };
    try {
      localStorage.setItem('netquel_ship', JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  load() {
    try {
      const raw = localStorage.getItem('netquel_ship');
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.blocks.clear();
      for (const bd of data.blocks) {
        const b = Block.deserialize(bd);
        this.blocks.set(`${b.gridX},${b.gridY}`, b);
      }
      this._updateStatus();
      this._centerView();
      return true;
    } catch (e) { return false; }
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  activate() {
    this.active = true;
    this.canvas.style.cursor = 'crosshair';
  }

  deactivate() {
    this.active = false;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    // Infinite grid (only draw visible portion)
    if (this.showGrid) {
      this._drawGrid(ctx, w, h);
    }

    // Draw origin cross
    ctx.strokeStyle = 'rgba(100,150,255,0.3)';
    ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();
    ctx.moveTo(-BLOCK_SIZE * 50, 0); ctx.lineTo(BLOCK_SIZE * 50, 0);
    ctx.moveTo(0, -BLOCK_SIZE * 50); ctx.lineTo(0, BLOCK_SIZE * 50);
    ctx.stroke();

    // Draw placed blocks
    for (const block of this.blocks.values()) {
      block.draw(ctx, block.gridX * BLOCK_SIZE, block.gridY * BLOCK_SIZE, BLOCK_SIZE);
    }

    // Hover highlight
    const hx = this.mouseGridX * BLOCK_SIZE;
    const hy = this.mouseGridY * BLOCK_SIZE;
    const existing = this.blocks.has(`${this.mouseGridX},${this.mouseGridY}`);

    if (!existing) {
      ctx.globalAlpha = 0.35;
      // Preview the block
      const previewBlock = new Block(this.selectedType, this.mouseGridX, this.mouseGridY);
      previewBlock.draw(ctx, hx, hy, BLOCK_SIZE);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = existing ? 'rgba(255,100,100,0.7)' : 'rgba(100,200,255,0.7)';
    ctx.lineWidth = 2 / this.zoom;
    ctx.strokeRect(hx, hy, BLOCK_SIZE, BLOCK_SIZE);

    ctx.restore();

    // UI overlay — selected block info
    this._drawOverlay(ctx, w, h);
  }

  _drawGrid(ctx, w, h) {
    // Calculate visible grid range
    const halfW = w / 2 / this.zoom;
    const halfH = h / 2 / this.zoom;
    const startX = Math.floor((this.camX - halfW) / BLOCK_SIZE) - 1;
    const endX = Math.ceil((this.camX + halfW) / BLOCK_SIZE) + 1;
    const startY = Math.floor((this.camY - halfH) / BLOCK_SIZE) - 1;
    const endY = Math.ceil((this.camY + halfH) / BLOCK_SIZE) + 1;

    const gridAlpha = Math.min(0.15, 0.15 * this.zoom);
    ctx.strokeStyle = `rgba(40,80,140,${gridAlpha})`;
    ctx.lineWidth = 0.5 / this.zoom;
    ctx.beginPath();

    for (let gx = startX; gx <= endX; gx++) {
      ctx.moveTo(gx * BLOCK_SIZE, startY * BLOCK_SIZE);
      ctx.lineTo(gx * BLOCK_SIZE, endY * BLOCK_SIZE);
    }
    for (let gy = startY; gy <= endY; gy++) {
      ctx.moveTo(startX * BLOCK_SIZE, gy * BLOCK_SIZE);
      ctx.lineTo(endX * BLOCK_SIZE, gy * BLOCK_SIZE);
    }
    ctx.stroke();
  }

  _drawOverlay(ctx, w, h) {
    const t = this.selectedType;
    const pad = 8;
    const bw = 120;
    const bh = 52;
    const x = 130; // offset from palette
    const y = 50;

    ctx.fillStyle = 'rgba(5,10,20,0.85)';
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = t.color;
    ctx.fillRect(x + pad, y + pad, 24, 24);
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + pad, y + pad, 24, 24);

    ctx.fillStyle = '#ccc';
    ctx.font = '12px Courier New';
    ctx.fillText(t.name, x + pad + 30, y + pad + 10);
    ctx.fillStyle = '#668';
    ctx.font = '10px Courier New';
    ctx.fillText(`HP: ${t.hp}  Masse: ${t.mass}`, x + pad + 30, y + pad + 24);

    // Hint
    ctx.fillStyle = 'rgba(60,90,140,0.7)';
    ctx.font = '10px Courier New';
    ctx.fillText('LMB: Platz  RMB: Löschen  Scroll: Zoom  [G]: Gitter', 130, h - 10);
    ctx.fillText('Kein Größenlimit! Bau so groß du willst.', 130, h - 24);
  }
}
