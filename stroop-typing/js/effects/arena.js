const MAX_BALLS = 100;
const GRAVITY = 220;
const AIR = 1;
const SHAPE_AIR = 1;
const RESTITUTION = 1;
const BALL_RESTITUTION = 1;
const SHATTER_CRACK_MS = 450;
const SHATTER_FADE_MS = 900;
const SHAPES = ["circle", "square", "diamond", "triangle", "star", "hexagon", "semicircle"];
const MORPH_MIN_MS = 10000;
const MORPH_MAX_MS = 25000;
const AUTO_SHAPE_SLOWDOWN = 0.76;
const SHAPE_ROTATION_MIN = 0.22;
const SHAPE_ROTATION_MAX = 0.48;
const VIEWPORT_GROWTH_MIN = 4.4;
const VIEWPORT_GROWTH_MAX = 12.8;
const MAX_BALL_RADIUS = 84;
const MIN_BALL_SPEED = 68;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomShape(exclude = "") {
  const candidates = SHAPES.filter((shape) => shape !== exclude);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function randomRotation() {
  return randomBetween(0, Math.PI * 2);
}

function randomRotationSpeed() {
  const direction = Math.random() < 0.5 ? -1 : 1;
  return direction * randomBetween(SHAPE_ROTATION_MIN, SHAPE_ROTATION_MAX);
}

function ensureMinimumSpeed(ball) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed >= MIN_BALL_SPEED) return;

  const angle = speed > 0.001
    ? Math.atan2(ball.vy, ball.vx)
    : randomBetween(0, Math.PI * 2);

  ball.vx = Math.cos(angle) * MIN_BALL_SPEED;
  ball.vy = Math.sin(angle) * MIN_BALL_SPEED;
}

function nextMorphTime(now = performance.now()) {
  return now + randomBetween(MORPH_MIN_MS, MORPH_MAX_MS);
}

function makeCracks() {
  return Array.from({ length: 9 }, (_, index) => {
    const angle = (-Math.PI * 0.92) + (index / 8) * (Math.PI * 1.84) + randomBetween(-0.06, 0.06);
    return {
      angle,
      length: randomBetween(0.6, 0.94),
      branch: randomBetween(0.18, 0.34),
      branchAngle: randomBetween(-0.9, -0.28),
      width: randomBetween(1.2, 2.2),
    };
  });
}

export function createArena(canvas, sound) {
  if (!canvas) {
    return {
      spawnBall() {},
      reset() {},
      breakArena() {},
      handlePointerDown() {
        return false;
      },
    };
  }

  const ctx = canvas.getContext("2d");
  const balls = [];

  const shatter = {
    active: false,
    released: false,
    startedAt: 0,
    cracks: [],
  };

  let dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  let width = 0;
  let height = 0;
  let centerX = 0;
  let centerY = 0;
  let radius = 0;
  let lastFrame = performance.now();

  function useWindowBounds() {
    return shatter.active && shatter.released;
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
    centerY = height * 0.73;
    radius = Math.min(138, Math.min(width, height) * 0.18);
  }

  function reset() {
    balls.length = 0;
    shatter.active = false;
    shatter.released = false;
    shatter.startedAt = 0;
    shatter.cracks = [];
  }

  function spawnBall(colorHex) {
    while (balls.length >= MAX_BALLS) {
      balls.shift();
    }

    const angle = randomBetween(0, Math.PI * 2);
    const spawnRadius = randomBetween(0, Math.max(1, radius * 0.16));
    const speed = randomBetween(100, 140);

    balls.push({
      x: centerX + Math.cos(angle) * spawnRadius,
      y: centerY + Math.sin(angle) * spawnRadius,
      vx: Math.cos(angle + Math.PI / 2) * speed,
      vy: Math.sin(angle + Math.PI / 2) * speed - randomBetween(90, 130),
      r: randomBetween(9, 12),
      baseR: 0,
      color: colorHex,
      shape: "circle",
      releasedFromArena: false,
      rotation: randomRotation(),
      rotationSpeed: 0,
      transformed: false,
      nextMorphAt: Infinity,
      lastWallSound: 0,
    });

    balls[balls.length - 1].baseR = balls[balls.length - 1].r;
  }

  function mutateBallShape(ball) {
    if (ball.transformed) return;

    ball.shape = randomShape(ball.shape);
    ball.rotation = randomRotation();
    ball.rotationSpeed = randomRotationSpeed();
    ball.transformed = true;
    ball.nextMorphAt = Infinity;

    ball.vx *= AUTO_SHAPE_SLOWDOWN;
    ball.vy *= AUTO_SHAPE_SLOWDOWN;
  }

  function updateReleasedState(ball, now) {
    if (ball.releasedFromArena || !shatter.released) return;

    const dx = ball.x - centerX;
    const dy = ball.y - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance - ball.r >= radius) {
      ball.releasedFromArena = true;
      ball.nextMorphAt = nextMorphTime(now);
    }
  }

  function growBallFromViewportImpact(ball, impact) {
    const growth = clamp(impact / 180, VIEWPORT_GROWTH_MIN, VIEWPORT_GROWTH_MAX);
    ball.r = Math.min(MAX_BALL_RADIUS, ball.r + growth);
  }

  function playBounce(ball, impact, hitX, hitY) {
    const now = performance.now();
    if (impact <= 40 || now - ball.lastWallSound <= 60) return;

    ball.lastWallSound = now;
    sound.wallBounce({
      impact,
      cx: centerX,
      cy: centerY,
      hitX,
      hitY,
    });
  }

  function collideWithCircle(ball) {
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

    playBounce(ball, dot, ball.x, ball.y);
  }

  function collideWithViewport(ball) {
    if (ball.x - ball.r <= 0) {
      const impact = Math.abs(ball.vx);
      growBallFromViewportImpact(ball, impact);
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx) * RESTITUTION;
      playBounce(ball, impact, ball.x, ball.y);
    } else if (ball.x + ball.r >= width) {
      const impact = Math.abs(ball.vx);
      growBallFromViewportImpact(ball, impact);
      ball.x = width - ball.r;
      ball.vx = -Math.abs(ball.vx) * RESTITUTION;
      playBounce(ball, impact, ball.x, ball.y);
    }

    if (ball.y - ball.r <= 0) {
      const impact = Math.abs(ball.vy);
      growBallFromViewportImpact(ball, impact);
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy) * RESTITUTION;
      playBounce(ball, impact, ball.x, ball.y);
    } else if (ball.y + ball.r >= height) {
      const impact = Math.abs(ball.vy);
      growBallFromViewportImpact(ball, impact);
      ball.y = height - ball.r;
      ball.vy = -Math.abs(ball.vy) * RESTITUTION;
      playBounce(ball, impact, ball.x, ball.y);
    }
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

        ensureMinimumSpeed(a);
        ensureMinimumSpeed(b);
      }
    }
  }

  function crackProgress(now) {
    if (!shatter.active) return 0;
    return clamp((now - shatter.startedAt) / SHATTER_CRACK_MS, 0, 1);
  }

  function fadeProgress(now) {
    if (!shatter.active) return 0;
    return clamp((now - shatter.startedAt) / SHATTER_FADE_MS, 0, 1);
  }

  function releaseToViewport() {
    if (shatter.released) return;

    shatter.released = true;

    for (const ball of balls) {
      const dx = ball.x - centerX;
      const dy = ball.y - centerY;
      const distance = Math.hypot(dx, dy) || 1;
      const nx = dx / distance;
      const ny = dy / distance;
      const burst = randomBetween(260, 460);

      ball.vx += nx * burst + randomBetween(-120, 120);
      ball.vy += ny * burst + randomBetween(-120, 120);
    }
  }

  function breakArena() {
    if (shatter.active) return;

    shatter.active = true;
    shatter.released = false;
    shatter.startedAt = performance.now();
    shatter.cracks = makeCracks();
  }

  function drawPolygon(sides, radiusValue) {
    for (let index = 0; index < sides; index += 1) {
      const angle = (-Math.PI / 2) + (index / sides) * Math.PI * 2;
      const x = Math.cos(angle) * radiusValue;
      const y = Math.sin(angle) * radiusValue;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  }

  function drawStar(radiusValue) {
    const inner = radiusValue * 0.48;

    for (let index = 0; index < 10; index += 1) {
      const angle = (-Math.PI / 2) + (index / 10) * Math.PI * 2;
      const pointRadius = index % 2 === 0 ? radiusValue : inner;
      const x = Math.cos(angle) * pointRadius;
      const y = Math.sin(angle) * pointRadius;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  }

  function drawBallShape(ball) {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);
    ctx.beginPath();

    switch (ball.shape) {
      case "square":
        ctx.rect(-ball.r, -ball.r, ball.r * 2, ball.r * 2);
        break;
      case "diamond":
        drawPolygon(4, ball.r);
        break;
      case "triangle":
        drawPolygon(3, ball.r * 1.08);
        break;
      case "star":
        drawStar(ball.r * 1.08);
        break;
      case "hexagon":
        drawPolygon(6, ball.r);
        break;
      case "semicircle":
        ctx.arc(0, 0, ball.r, Math.PI, 0, false);
        ctx.lineTo(ball.r, 0);
        ctx.lineTo(-ball.r, 0);
        break;
      default:
        ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
        break;
    }

    ctx.closePath();
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(67, 44, 22, 0.18)";
    ctx.stroke();
    ctx.restore();
  }

  function drawCircle(now) {
    const crack = crackProgress(now);
    const fade = 1 - fadeProgress(now);
    if (fade <= 0.001) return;

    const aura = ctx.createRadialGradient(centerX, centerY, radius * 0.12, centerX, centerY, radius * 1.26);
    aura.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`);
    aura.addColorStop(0.56, `rgba(255, 250, 238, ${0.78 * fade})`);
    aura.addColorStop(1, `rgba(232, 223, 204, ${0.12 * fade})`);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = aura;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(93, 65, 37, ${0.22 * fade})`;
    ctx.stroke();

    if (!shatter.active) return;

    ctx.save();
    ctx.lineCap = "round";

    for (const line of shatter.cracks) {
      const reach = radius * (0.18 + line.length * crack);
      const branch = reach * line.branch;
      const startX = centerX + Math.cos(line.angle) * radius * 0.08;
      const startY = centerY + Math.sin(line.angle) * radius * 0.08;
      const endX = centerX + Math.cos(line.angle) * reach;
      const endY = centerY + Math.sin(line.angle) * reach;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.lineWidth = line.width;
      ctx.strokeStyle = `rgba(120, 95, 66, ${(0.14 + crack * 0.44) * fade})`;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX + Math.cos(line.angle + line.branchAngle) * branch,
        endY + Math.sin(line.angle + line.branchAngle) * branch,
      );
      ctx.lineWidth = Math.max(1, line.width - 0.4);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBalls() {
    for (const ball of balls) {
      drawBallShape(ball);
    }
  }

  function drawArena(now) {
    ctx.clearRect(0, 0, width, height);
    drawCircle(now);
    drawBalls();
  }

  function tick(now) {
    const dt = Math.min(0.03, (now - lastFrame) / 1000);
    lastFrame = now;

    if (shatter.active && !shatter.released && now - shatter.startedAt >= SHATTER_CRACK_MS) {
      releaseToViewport();
    }

    for (const ball of balls) {
      if (!useWindowBounds()) {
        ball.vy += GRAVITY * dt;
      }

      const drag = ball.transformed ? SHAPE_AIR : AIR;
      ball.vx *= drag;
      ball.vy *= drag;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.transformed) {
        ball.rotation += ball.rotationSpeed * dt;
      }

      if (useWindowBounds()) {
        collideWithViewport(ball);
      } else {
        collideWithCircle(ball);
      }

      ensureMinimumSpeed(ball);
      updateReleasedState(ball, now);

      if (ball.releasedFromArena && !ball.transformed && now >= ball.nextMorphAt) {
        mutateBallShape(ball);
      }
    }

    resolveBallCollisions();
    drawArena(now);
    requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);
  function handlePointerDown(event) {
    void event;
    return false;
  }

  canvas.addEventListener("pointerdown", handlePointerDown);
  requestAnimationFrame(tick);

  return {
    spawnBall,
    reset,
    breakArena,
    handlePointerDown,
  };
}
