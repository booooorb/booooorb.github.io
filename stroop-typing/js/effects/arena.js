const MAX_BALLS = 100;
const GRAVITY = 220;
const AIR = 1;
const RESTITUTION = 1;
const BALL_RESTITUTION = 1;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function createArena(canvas, sound) {
  if (!canvas) {
    return {
      spawnBall() {},
      reset() {},
    };
  }

  const ctx = canvas.getContext("2d");
  const balls = [];

  let dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  let width = 0;
  let height = 0;
  let centerX = 0;
  let centerY = 0;
  let radius = 0;
  let lastFrame = performance.now();

  function constrainBall(ball) {
    const dx = ball.x - centerX;
    const dy = ball.y - centerY;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance + ball.r <= radius) return;

    const nx = dx / distance;
    const ny = dy / distance;
    ball.x = centerX + nx * (radius - ball.r);
    ball.y = centerY + ny * (radius - ball.r);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));

    dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    centerX = width / 2;
    centerY = height / 2;
    radius = Math.min(width, height) * 0.42;

    balls.forEach(constrainBall);
  }

  function reset() {
    balls.length = 0;
  }

  function spawnBall(colorHex) {
    while (balls.length >= MAX_BALLS) {
      balls.shift();
    }

    const r = randomBetween(7, 9);
    const angle = randomBetween(0, Math.PI * 2);
    const spawnRadius = randomBetween(0, Math.max(1, radius * 0.15));

    const x = centerX + Math.cos(angle) * spawnRadius;
    const y = centerY + Math.sin(angle) * spawnRadius;
    const speed = randomBetween(100, 140);
    const vx = Math.cos(angle + Math.PI / 2) * speed;
    const vy = Math.sin(angle + Math.PI / 2) * speed - randomBetween(90, 130);

    balls.push({ x, y, vx, vy, r, color: colorHex, lastWallSound: 0 });
  }

  function resolveBallCollisions() {
    for (let i = 0; i < balls.length; i += 1) {
      for (let j = i + 1; j < balls.length; j += 1) {
        const a = balls[i];
        const b = balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1;
        const minDistance = a.r + b.r;

        if (distance >= minDistance) continue;

        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = (minDistance - distance) * 0.5;

        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const aNormalVelocity = a.vx * nx + a.vy * ny;
        const bNormalVelocity = b.vx * nx + b.vy * ny;
        const impulse = (bNormalVelocity - aNormalVelocity) * BALL_RESTITUTION;

        a.vx += impulse * nx;
        a.vy += impulse * ny;
        b.vx -= impulse * nx;
        b.vy -= impulse * ny;
      }
    }
  }

  function collideWithBounds(ball) {
    const dx = ball.x - centerX;
    const dy = ball.y - centerY;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance + ball.r <= radius) return;

    const nx = dx / distance;
    const ny = dy / distance;
    const dot = ball.vx * nx + ball.vy * ny;

    ball.x = centerX + nx * (radius - ball.r);
    ball.y = centerY + ny * (radius - ball.r);
    ball.vx = (ball.vx - 2 * dot * nx) * RESTITUTION;
    ball.vy = (ball.vy - 2 * dot * ny) * RESTITUTION;

    const now = performance.now();
    if (dot > 40 && now - ball.lastWallSound > 60) {
      ball.lastWallSound = now;
      sound.wallBounce({
        impact: dot,
        cx: centerX,
        cy: centerY,
        hitX: ball.x,
        hitY: ball.y,
      });
    }
  }

  function drawArena() {
    ctx.clearRect(0, 0, width, height);

    const aura = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius * 1.25);
    aura.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    aura.addColorStop(0.55, "rgba(255, 250, 238, 0.82)");
    aura.addColorStop(1, "rgba(232, 223, 204, 0.15)");

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = aura;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(93, 65, 37, 0.22)";
    ctx.stroke();

    for (const ball of balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = ball.color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(67, 44, 22, 0.18)";
      ctx.stroke();
    }
  }

  function tick(now) {
    const dt = Math.min(0.03, (now - lastFrame) / 1000);
    lastFrame = now;

    for (const ball of balls) {
      ball.vy += GRAVITY * dt;
      ball.vx *= AIR;
      ball.vy *= AIR;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      collideWithBounds(ball);
    }

    resolveBallCollisions();
    drawArena();
    requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(tick);

  return {
    spawnBall,
    reset,
  };
}
