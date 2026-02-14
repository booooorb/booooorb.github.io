(() => {
    const canvas = document.getElementById("stroopArena");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    let dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    let W = 0, H = 0;
    let cx = 0, cy = 0, R = 0;

    const balls = [];
    const MAX_BALLS = 100;

    const GRAVITY = 220;        // px/s^2
    const AIR = 1;          // damping
    const RESTITUTION = 1;   // wall bounce
    const BALL_RESTITUTION = 1;

    function resize() {
        const rect = canvas.getBoundingClientRect();
        W = Math.max(1, Math.floor(rect.width));
        H = Math.max(1, Math.floor(rect.height));

        dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        cx = W / 2;
        cy = H / 2;
        R = Math.min(W, H) * 0.43;

        for (const b of balls) {
            const dx = b.x - cx;
            const dy = b.y - cy;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist + b.r > R) {
                const nx = dx / dist;
                const ny = dy / dist;
                b.x = cx + nx * (R - b.r);
                b.y = cy + ny * (R - b.r);
            }
        }
    }

    function rand(a, b) { return a + Math.random() * (b - a); }

    function resetBalls() {
        balls.length = 0;
    }

    function spawnBall(colorHex) {
        while (balls.length >= MAX_BALLS) balls.shift();

        const r = rand(7, 9);
        const angle = rand(0, Math.PI * 2);

        const spawnRadius = rand(0, Math.max(1, R * 0.15));
        const x = cx + Math.cos(angle) * spawnRadius;
        const y = cy + Math.sin(angle) * spawnRadius;

        const speed = rand(100, 140);
        const vx = Math.cos(angle + Math.PI / 2) * speed;
        const vy = Math.sin(angle + Math.PI / 2) * speed - rand(90, 130);

        balls.push({ x, y, vx, vy, r, color: colorHex, lastWallSound: 0 });

    }

    function resolveBallCollisions() {
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const a = balls[i], b = balls[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.hypot(dx, dy) || 1;
                const minDist = a.r + b.r;

                if (dist < minDist) {
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const overlap = (minDist - dist) * 0.5;
                    a.x -= nx * overlap;
                    a.y -= ny * overlap;
                    b.x += nx * overlap;
                    b.y += ny * overlap;

                    const avn = a.vx * nx + a.vy * ny;
                    const bvn = b.vx * nx + b.vy * ny;
                    const impulse = (bvn - avn) * BALL_RESTITUTION;

                    a.vx += impulse * nx;
                    a.vy += impulse * ny;
                    b.vx -= impulse * nx;
                    b.vy -= impulse * ny;
                }
            }
        }
    }

    function collideWithCircle(b) {
        const dx = b.x - cx;
        const dy = b.y - cy;
        const dist = Math.hypot(dx, dy) || 1;

        if (dist + b.r > R) {
            const nx = dx / dist;
            const ny = dy / dist;

            const dot = b.vx * nx + b.vy * ny;

            b.x = cx + nx * (R - b.r);
            b.y = cy + ny * (R - b.r);

            b.vx = (b.vx - 2 * dot * nx) * RESTITUTION;
            b.vy = (b.vy - 2 * dot * ny) * RESTITUTION;

            const now = performance.now();

            if (dot > 40 && now - b.lastWallSound > 60) {
                b.lastWallSound = now;

                window.StroopSound?.wallBounce({
                    cx,
                    cy,
                    hitX: b.x,
                    hitY: b.y,
                    impact: dot
                });
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.stroke();

        // balls
        for (const b of balls) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = b.color;

            ctx.fill();

            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(0,0,0,0.25)";
            ctx.stroke();
        }
    }

    let last = performance.now();
    function tick(now) {
        const dt = Math.min(0.03, (now - last) / 1000);
        last = now;

        // physics
        for (const b of balls) {
            b.vy += GRAVITY * dt;
            b.vx *= AIR;
            b.vy *= AIR;

            b.x += b.vx * dt;
            b.y += b.vy * dt;

            collideWithCircle(b);
        }

        resolveBallCollisions();
        draw();

        requestAnimationFrame(tick);
    }

    // Public API
    window.StroopAnim = { spawnBall, reset: resetBalls };

    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(tick);
})();
