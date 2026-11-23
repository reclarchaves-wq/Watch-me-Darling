import type { GeneratedChatVisual, GeneratedTeaseVideo, TeasingVideoScene } from '../types.ts';

export interface VisualBlueprintInput {
  title: string;
  caption: string;
  motif: 'silk' | 'candle' | 'rain' | 'silhouette' | 'eclipse';
  palette: [string, string, string, string];
  lightingMood: string;
}

export function renderChatVisualToDataUrl(blueprint: VisualBlueprintInput): GeneratedChatVisual {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return {
      id: `vis-${Date.now()}`,
      ...blueprint,
      dataUrl: '',
      createdAt: Date.now(),
    };
  }

  const [bgDark, midGlow, accentRose, highlightWarm] = blueprint.palette;

  // 1. Deep ambient canvas base
  const bgGrad = ctx.createRadialGradient(
    size * 0.52,
    size * 0.42,
    40,
    size * 0.5,
    size * 0.5,
    size * 0.78
  );
  bgGrad.addColorStop(0, midGlow);
  bgGrad.addColorStop(0.55, bgDark);
  bgGrad.addColorStop(1, '#09080B');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // 2. Motif-specific sensual atmospheric composition
  if (blueprint.motif === 'silk') {
    for (let i = 0; i < 16; i++) {
      const yOffset = 140 + i * 52;
      const waveGrad = ctx.createLinearGradient(0, yOffset - 80, size, yOffset + 80);
      waveGrad.addColorStop(0, 'rgba(0,0,0,0)');
      waveGrad.addColorStop(0.35, `${accentRose}33`);
      waveGrad.addColorStop(0.65, `${highlightWarm}44`);
      waveGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = waveGrad;
      ctx.beginPath();
      ctx.moveTo(0, yOffset);
      for (let x = 0; x <= size; x += 64) {
        const y =
          yOffset +
          Math.sin(x * 0.005 + i * 0.65) * 48 +
          Math.cos(x * 0.009 - i * 0.4) * 24;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(size, size);
      ctx.lineTo(0, size);
      ctx.closePath();
      ctx.fill();
    }
  } else if (blueprint.motif === 'candle') {
    for (let i = 0; i < 6; i++) {
      const cx = size * (0.3 + (i % 3) * 0.2);
      const cy = size * (0.36 + Math.floor(i / 3) * 0.18);
      const r = 180 + i * 48;
      const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, r);
      halo.addColorStop(0, `${highlightWarm}99`);
      halo.addColorStop(0.35, `${accentRose}44`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (blueprint.motif === 'rain') {
    // Warm bokeh reflections behind rain-kissed glass
    for (let i = 0; i < 24; i++) {
      const bx = ((i * 193) % 860) + 80;
      const by = ((i * 271) % 720) + 100;
      const br = 24 + (i % 5) * 18;
      const bGrad = ctx.createRadialGradient(bx, by, 2, bx, by, br);
      bGrad.addColorStop(0, i % 2 === 0 ? `${highlightWarm}77` : `${accentRose}66`);
      bGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 90; i++) {
      const rx = (i * 137) % size;
      const ry = (i * 211) % (size - 160);
      const len = 18 + (i % 4) * 14;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + len);
      ctx.stroke();
    }
  } else if (blueprint.motif === 'eclipse') {
    const cx = size * 0.5;
    const cy = size * 0.44;
    const corona = ctx.createRadialGradient(cx, cy, 130, cx, cy, 380);
    corona.addColorStop(0, highlightWarm);
    corona.addColorStop(0.28, `${accentRose}CC`);
    corona.addColorStop(0.65, `${midGlow}44`);
    corona.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(cx, cy, 380, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#09080B';
    ctx.beginPath();
    ctx.arc(cx - 10, cy + 8, 152, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 'silhouette' — twin warm abstract profiles bathed in dusk light
    const aura = ctx.createRadialGradient(size * 0.5, size * 0.46, 20, size * 0.5, size * 0.46, 360);
    aura.addColorStop(0, `${highlightWarm}88`);
    aura.addColorStop(0.5, `${accentRose}55`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.46, 360, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(13, 12, 15, 0.88)';
    ctx.beginPath();
    ctx.ellipse(size * 0.38, size * 0.66, 175, 290, -0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.64, size * 0.62, 165, 280, 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Soft vignette & editorial framing
  const vignette = ctx.createLinearGradient(0, size * 0.55, 0, size);
  vignette.addColorStop(0, 'rgba(13, 12, 15, 0)');
  vignette.addColorStop(1, 'rgba(9, 8, 11, 0.94)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  // Subtle top-left editorial hairline + mood label
  ctx.fillStyle = 'rgba(232, 197, 165, 0.78)';
  ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(blueprint.lightingMood.toUpperCase(), 56, 68);

  // Title & chat-referenced caption at bottom
  ctx.fillStyle = '#F5F2EE';
  ctx.font = '500 44px "Fraunces", Georgia, serif';
  ctx.fillText(blueprint.title.slice(0, 38), 56, size - 138);

  ctx.fillStyle = 'rgba(245, 242, 238, 0.78)';
  ctx.font = '400 24px "Plus Jakarta Sans", sans-serif';
  const words = blueprint.caption.split(' ');
  let line1 = '';
  let line2 = '';
  for (const w of words) {
    if ((line1 + ' ' + w).trim().length <= 54 && !line2) {
      line1 = (line1 + ' ' + w).trim();
    } else if ((line2 + ' ' + w).trim().length <= 56) {
      line2 = (line2 + ' ' + w).trim();
    }
  }
  ctx.fillText(line1, 56, size - 90);
  if (line2) {
    ctx.fillText(line2, 56, size - 56);
  }

  return {
    id: `vis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...blueprint,
    dataUrl: canvas.toDataURL('image/png'),
    createdAt: Date.now(),
  };
}

export function getActiveTeaseScene(
  video: GeneratedTeaseVideo,
  elapsedSeconds: number
): TeasingVideoScene {
  const clamped = Math.max(0, Math.min(video.durationSeconds, elapsedSeconds));
  const match = video.scenes.find(
    (s) => clamped >= s.secondStart && clamped <= s.secondEnd
  );
  return match || video.scenes[video.scenes.length - 1];
}

export function drawTeaseVideoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  video: GeneratedTeaseVideo,
  elapsedSeconds: number
) {
  const scene = getActiveTeaseScene(video, elapsedSeconds);
  const progress = Math.max(0, Math.min(1, elapsedSeconds / video.durationSeconds));
  const [c1, c2, c3] = video.palette;
  const t = elapsedSeconds * 1.4;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0D0C0F');
  bg.addColorStop(0.5, c1);
  bg.addColorStop(1, '#09080B');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const pulseFactor = (scene.intensity / 100) * (0.75 + 0.25 * Math.sin(t * 2.4));

  if (scene.motionStyle === 'ripple') {
    for (let i = 0; i < 6; i++) {
      const r = ((t * 45 + i * 55) % 340) + 30;
      ctx.strokeStyle = i % 2 === 0 ? `${c2}66` : `${c3}55`;
      ctx.lineWidth = 2 + pulseFactor * 3;
      ctx.beginPath();
      ctx.ellipse(width * 0.5, height * 0.48, r * 1.4, r * 0.85, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (scene.motionStyle === 'ember') {
    for (let i = 0; i < 18; i++) {
      const px = ((i * 97 + Math.sin(t + i) * 38) % (width - 60)) + 30;
      const py = height - (((t * 42 + i * 67) % (height - 40)) + 20);
      const pr = 12 + (i % 4) * 10 + pulseFactor * 16;
      const glow = ctx.createRadialGradient(px, py, 2, px, py, pr);
      glow.addColorStop(0, `${c3}AA`);
      glow.addColorStop(0.5, `${c2}44`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (scene.motionStyle === 'shimmer') {
    for (let i = 0; i < 7; i++) {
      const x = width * (0.2 + i * 0.1) + Math.sin(t + i) * 28;
      const grad = ctx.createRadialGradient(x, height * 0.46, 12, x, height * 0.46, 170);
      grad.addColorStop(0, `${c3}66`);
      grad.addColorStop(0.5, `${c2}33`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, height * 0.46, 170, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 'swell'
    for (let i = 0; i < 4; i++) {
      const rad = 75 + i * 48 + pulseFactor * 72 + Math.sin(t + i) * 14;
      const cx = width * 0.5 + Math.cos(t * 0.7 + i) * 44;
      const cy = height * 0.46 + Math.sin(t * 0.5 + i) * 22;
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, rad);
      g.addColorStop(0, `${c2}77`);
      g.addColorStop(0.6, `${c3}33`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bottom vignette for legible teasing caption overlay
  const shade = ctx.createLinearGradient(0, height * 0.48, 0, height);
  shade.addColorStop(0, 'rgba(13,12,15,0)');
  shade.addColorStop(1, 'rgba(9,8,11,0.92)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  // Header metadata
  ctx.fillStyle = 'rgba(232,197,165,0.88)';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillText(
    `WEEK ${String(video.weekNumber).padStart(2, '0')} TEASE · ${elapsedSeconds.toFixed(1)}s / ${video.durationSeconds}s`,
    28,
    34
  );
  ctx.fillText(`${scene.frequencyHz} HZ · ${scene.intensity}% PULSE`, width - 210, 34);

  // Teasing caption
  ctx.fillStyle = '#F5F2EE';
  ctx.font = '500 26px "Fraunces", Georgia, serif';
  ctx.fillText(scene.caption.slice(0, 56), 28, height - 48);

  // Thin progress bar along bottom edge
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(28, height - 22, width - 56, 4);
  ctx.fillStyle = '#E85D75';
  ctx.fillRect(28, height - 22, (width - 56) * progress, 4);
}
