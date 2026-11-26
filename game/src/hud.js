// hud.js — Canvas 2D instrument overlay for IRON GASSER. Always lit, always legible.
// Left: altitude + vertical speed. Right: airspeed + fuel. Bottom: heading tape.
// Top: mission timer, waypoint bearing/range, objective. Centre: crosshair + pitch ladder.

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  draw(s) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (s.phase !== 'flying' && s.phase !== 'paused') return;
    ctx.textBaseline = 'alphabetic';
    const font = (px, bold) => `${bold ? '700 ' : ''}${px}px "Segoe UI", system-ui, sans-serif`;

    // --- Left: altitude + vertical speed ---
    ctx.fillStyle = 'rgba(6,20,30,0.55)';
    ctx.fillRect(14, 14, 190, 86);
    ctx.strokeStyle = '#2e6f8e'; ctx.strokeRect(14, 14, 190, 86);
    ctx.fillStyle = '#7fd4e8'; ctx.font = font(11); ctx.fillText('ALTITUDE', 24, 34);
    ctx.fillStyle = '#ffffff'; ctx.font = font(30, true);
    ctx.fillText(String(Math.round(s.altFt)).padStart(5, '0'), 24, 66);
    ctx.font = font(12); ctx.fillStyle = '#c8dde8';
    ctx.fillText('FT', 158, 66);
    ctx.fillStyle = s.vspeed >= 0 ? '#8fe388' : '#ffb347';
    ctx.font = font(14, true);
    ctx.fillText(`${s.vspeed >= 0 ? '+' : ''}${Math.round(s.vspeed * 196.85)} FPM`, 24, 90);

    // --- Right: airspeed + fuel ---
    ctx.fillStyle = 'rgba(6,20,30,0.55)';
    ctx.fillRect(W - 204, 14, 190, 86);
    ctx.strokeStyle = '#2e6f8e'; ctx.strokeRect(W - 204, 14, 190, 86);
    ctx.fillStyle = '#7fd4e8'; ctx.font = font(11); ctx.fillText('AIRSPEED', W - 194, 34);
    ctx.fillStyle = '#ffffff'; ctx.font = font(30, true);
    ctx.fillText(String(Math.round(s.speedKts)), W - 194, 66);
    ctx.font = font(12); ctx.fillStyle = '#c8dde8';
    ctx.fillText('KTS', W - 66, 66);
    // Fuel bar.
    const fuelW = 150;
    ctx.fillStyle = '#12303f'; ctx.fillRect(W - 194, 76, fuelW, 10);
    const fuelLow = s.fuel < 20;
    ctx.fillStyle = fuelLow && Math.floor(s.time * 3) % 2 === 0 ? '#ff4444' : (s.fuel < 35 ? '#ffb347' : '#8fe388');
    ctx.fillRect(W - 194, 76, fuelW * s.fuel / 100, 10);
    ctx.fillStyle = '#c8dde8'; ctx.font = font(11);
    ctx.fillText(`FUEL ${Math.round(s.fuel)}%${s.flameout ? ' — FLAMEOUT' : ''}`, W - 194, 98);

    // --- Damage bar (under fuel) ---
    ctx.fillStyle = 'rgba(6,20,30,0.55)';
    ctx.fillRect(W - 204, 108, 190, 30);
    ctx.fillStyle = '#7fd4e8'; ctx.font = font(11);
    ctx.fillText('DAMAGE', W - 194, 122);
    ctx.fillStyle = '#12303f'; ctx.fillRect(W - 194, 126, 150, 8);
    ctx.fillStyle = s.damage > 50 ? '#ff4444' : '#ff8a3d';
    ctx.fillRect(W - 194, 126, 150 * s.damage / 100, 8);
    ctx.fillStyle = '#c8dde8';
    ctx.fillText(`${Math.round(s.damage)}%`, W - 40, 134);

    // --- Top centre: timer, objective, waypoint ---
    ctx.fillStyle = 'rgba(6,20,30,0.55)';
    const topW = 460;
    ctx.fillRect((W - topW) / 2, 14, topW, 62);
    ctx.strokeStyle = '#2e6f8e'; ctx.strokeRect((W - topW) / 2, 14, topW, 62);
    ctx.fillStyle = '#ffb347'; ctx.font = font(20, true);
    ctx.textAlign = 'center';
    ctx.fillText(s.timerText, W / 2, 40);
    ctx.fillStyle = '#e8f2f7'; ctx.font = font(13);
    ctx.fillText(s.objective, W / 2, 60);
    if (s.waypointText) {
      ctx.fillStyle = '#7fd4e8'; ctx.font = font(12, true);
      ctx.fillText(s.waypointText, W / 2, 74);
    }
    ctx.textAlign = 'left';

    // --- Bottom: heading tape ---
    const tapeY = H - 34;
    ctx.fillStyle = 'rgba(6,20,30,0.55)';
    ctx.fillRect(0, tapeY - 22, W, 56);
    ctx.strokeStyle = '#2e6f8e';
    ctx.beginPath(); ctx.moveTo(0, tapeY - 22); ctx.lineTo(W, tapeY - 22); ctx.stroke();
    const pxPerDeg = 3.2;
    const hdg = s.headingDeg;
    ctx.font = font(13, true);
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round(((hdg + d) % 360 + 360) % 360);
      const x = W / 2 + d * pxPerDeg;
      const major = deg % 30 === 0;
      ctx.strokeStyle = major ? '#e8f2f7' : '#5a7a8a';
      ctx.beginPath(); ctx.moveTo(x, tapeY - (major ? 14 : 8)); ctx.lineTo(x, tapeY + 2); ctx.stroke();
      if (major) {
        ctx.fillStyle = '#e8f2f7'; ctx.textAlign = 'center';
        ctx.fillText(String(deg).padStart(3, '0'), x, tapeY + 16);
        ctx.textAlign = 'left';
      }
    }
    // Heading caret.
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 8, tapeY - 24); ctx.lineTo(W / 2 + 8, tapeY - 24); ctx.lineTo(W / 2, tapeY - 12); ctx.closePath();
    ctx.fill();
    ctx.font = font(13, true); ctx.textAlign = 'center';
    ctx.fillText(`HDG ${String(Math.round(hdg)).padStart(3, '0')}`, W / 2, tapeY - 30);
    ctx.textAlign = 'left';

    // --- Centre: crosshair + pitch ladder ---
    const cx = W / 2, cy = H / 2 - 10;
    ctx.strokeStyle = '#8fe388'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 16, cy);
    ctx.moveTo(cx + 16, cy); ctx.lineTo(cx + 26, cy);
    ctx.moveTo(cx, cy - 26); ctx.lineTo(cx, cy - 16);
    ctx.moveTo(cx, cy + 16); ctx.lineTo(cx, cy + 26);
    ctx.stroke();
    // Pitch ladder rungs for +-10/20 degrees, shifted by pitch.
    ctx.strokeStyle = 'rgba(232,242,247,0.75)'; ctx.lineWidth = 1.5;
    ctx.font = font(11);
    for (const deg of [-20, -10, 10, 20]) {
      const y = cy - (deg - s.pitchDeg) * 3.4;
      const w = deg % 20 === 0 ? 60 : 40;
      ctx.beginPath(); ctx.moveTo(cx - w, y); ctx.lineTo(cx + w, y); ctx.stroke();
      ctx.fillStyle = 'rgba(232,242,247,0.85)';
      ctx.fillText(String(Math.abs(deg)), cx + w + 6, y + 4);
    }

    // --- Throttle + gear/flaps strip, bottom-left ---
    ctx.fillStyle = 'rgba(6,20,30,0.55)';
    ctx.fillRect(14, H - 96, 210, 52);
    ctx.strokeStyle = '#2e6f8e'; ctx.strokeRect(14, H - 96, 210, 52);
    ctx.fillStyle = '#7fd4e8'; ctx.font = font(11);
    ctx.fillText('THR', 24, H - 76);
    ctx.fillStyle = '#12303f'; ctx.fillRect(70, H - 86, 130, 10);
    ctx.fillStyle = s.afterburner ? '#ff9a2a' : '#8fe388';
    ctx.fillRect(70, H - 86, 130 * s.throttle, 10);
    if (s.afterburner) {
      ctx.fillStyle = '#ff9a2a'; ctx.font = font(11, true);
      ctx.fillText('AB', 204, H - 76);
    }
    ctx.fillStyle = s.gearDown ? '#8fe388' : '#ffb347';
    ctx.font = font(12, true);
    ctx.fillText(`GEAR ${s.gearDown ? 'DOWN' : 'UP'}`, 24, H - 56);
    ctx.fillStyle = s.flaps ? '#8fe388' : '#c8dde8';
    ctx.fillText(`FLAPS ${s.flaps ? 'DOWN' : 'UP'}`, 120, H - 56);

    // --- Warnings ---
    let warnY = H - 150;
    ctx.font = font(16, true); ctx.textAlign = 'center';
    if (s.flameout) {
      ctx.fillStyle = Math.floor(s.time * 3) % 2 ? '#ff4444' : '#ffb347';
      ctx.fillText('FLAMEOUT — GLIDE TO A STRIP', W / 2, warnY); warnY += 24;
    } else if (s.fuel < 20) {
      ctx.fillStyle = '#ff4444';
      ctx.fillText('LOW FUEL', W / 2, warnY); warnY += 24;
    }
    if (s.damage >= 50 && s.damage < 100) {
      ctx.fillStyle = '#ff8a3d';
      ctx.fillText('AIRFRAME DAMAGED — HANDLING DEGRADED', W / 2, warnY); warnY += 24;
    }
    if (s.terrainWarning) {
      ctx.fillStyle = '#ff4444';
      ctx.fillText('PULL UP — TERRAIN', W / 2, warnY);
    }
    ctx.textAlign = 'left';

    // --- Centre flash message (ring cleared, lock acquired...) ---
    if (s.flashText && s.flashUntil > s.time) {
      ctx.font = font(26, true); ctx.textAlign = 'center';
      ctx.fillStyle = s.flashColor || '#8fe388';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
      ctx.fillText(s.flashText, W / 2, H * 0.28);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }
  }
}
