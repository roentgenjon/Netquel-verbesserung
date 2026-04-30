/**
 * Smooth-following camera with zoom support.
 */
class Camera {
  constructor(width, height) {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.width = width;
    this.height = height;
    this.smoothFactor = 0.12;
    this.zoomSmoothFactor = 0.1;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  follow(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  setZoom(z) {
    this.targetZoom = clamp(z, 0.2, 3.0);
  }

  addShake(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt) {
    this.x += (this.targetX - this.x) * this.smoothFactor;
    this.y += (this.targetY - this.y) * this.smoothFactor;
    this.zoom += (this.targetZoom - this.zoom) * this.zoomSmoothFactor;

    if (this.shake > 0) {
      this.shake -= dt * 40;
      if (this.shake < 0) this.shake = 0;
      this.shakeX = (Math.random() - 0.5) * this.shake;
      this.shakeY = (Math.random() - 0.5) * this.shake;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  begin(ctx) {
    ctx.save();
    ctx.translate(this.width / 2 + this.shakeX, this.height / 2 + this.shakeY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  end(ctx) {
    ctx.restore();
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.width / 2) / this.zoom + this.x,
      y: (sy - this.height / 2) / this.zoom + this.y,
    };
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.width / 2,
      y: (wy - this.y) * this.zoom + this.height / 2,
    };
  }

  // Check if world rect is visible
  isVisible(wx, wy, radius) {
    const margin = radius * this.zoom + 100;
    const sx = (wx - this.x) * this.zoom + this.width / 2;
    const sy = (wy - this.y) * this.zoom + this.height / 2;
    return sx > -margin && sx < this.width + margin &&
           sy > -margin && sy < this.height + margin;
  }
}
