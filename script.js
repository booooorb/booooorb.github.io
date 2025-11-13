const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let lastTime = 0;
let player = { x: 50, y: 300, vy: 0, onGround: false };
let keys = { left: false, right: false, jump: false };
let running = false;

// placeholders
const level = {
  groundY: 380,
  obstacles: [
    { x: 300, width: 40, height: 40 },
    { x: 480, width: 60, height: 80 },
    { x: 670, width: 30, height: 60 },
  ],
};

function resetGame() {
  player.x = 50;
  player.y = 300;
  player.vy = 0;
  player.onGround = false;
}

function update(dt) {
  const speed = 160; // px/s
  const gravity = 900; // px/s^2
  const jumpSpeed = -380;

  if (keys.left) player.x -= speed * dt;
  if (keys.right) player.x += speed * dt;

  // gravity
  player.vy += gravity * dt;
  player.y += player.vy * dt;

  // simple ground collision
  if (player.y + 24 >= level.groundY) {
    player.y = level.groundY - 24;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  // jump
  if (keys.jump && player.onGround) {
    player.vy = jumpSpeed;
    player.onGround = false;
  }
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;

  // background
  ctx.clearRect(0, 0, w, h);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1b2140");
  grad.addColorStop(1, "#050714");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // ground
  ctx.fillStyle = "#141b2d";
  ctx.fillRect(0, level.groundY, w, h - level.groundY);

  // obstacles
  ctx.fillStyle = "#ffcc4d";
  for (const obs of level.obstacles) {
    ctx.fillRect(obs.x, level.groundY - obs.height, obs.width, obs.height);
  }

  // player
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(player.x, player.y, 24, 24);
}

function loop(timestamp) {
  if (!running) return;

  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// Input
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  if (e.key === " " || e.key === "ArrowUp") {
    keys.jump = true;
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
  if (e.key === " " || e.key === "ArrowUp") keys.jump = false;
});

const startButton = document.getElementById("start-button");
startButton.addEventListener("click", () => {
  resetGame();
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
});

// Draw once before starting so the canvas isn't empty
draw();