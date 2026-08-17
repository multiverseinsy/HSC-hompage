(() => {
  "use strict";

  /* ---------------------------------------------------------
     HSC — infinite drifting character field
     3D layered parallax: scroll = travel through depth (z),
     mouse = look around (rotate/pan the whole scene).
  --------------------------------------------------------- */

  const IMAGES = [
    "mirror.jpg",
    "bubble-bath.jpg",
    "theater-muted.jpg",
    "like-meeting-you.jpg",
    "clover.jpg",
    "noise-cancelling.jpg",
    "laptop.jpg",
    "reading.jpg",
    "decaf.jpg",
    "warm-heart.jpg",
    "contradiction.jpg",
    "mood-lamp.jpg",
    "sensitive-cat.jpg",
    "thinking.jpg",
    "misanthropy.jpg",
    "afraid-of-mice.jpg",
    "notes.jpg",
    "theater-cat.jpg",
    "handle-with-care.jpg",
  ].map((f) => `./assets/img/${f}`);

  const stage = document.getElementById("stage");
  const sceneRoot = document.getElementById("scene-root");

  // ---- tunables -------------------------------------------------
  const CARD_COUNT = 26;         // concurrent cards on stage
  const Z_NEAR = 60;             // closest a card is allowed to spawn/be
  const Z_FAR = 3400;            // farthest spawn depth
  const Z_RECYCLE = -260;        // once a card passes this (behind camera), respawn far away
  const BASE_W = 260;            // base card width in px (before individual scale variance)
  const ASPECT = 1200 / 960;     // height / width from source art (4:5-ish)
  const SPREAD_X = 1600;         // lateral spread range
  const SPREAD_Y = 900;          // vertical spread range
  const SCROLL_TO_Z = 1.15;      // scroll px -> depth units
  const AUTO_DRIFT = 14;         // constant forward drift (units/sec) so it's never fully static

  const cards = [];
  let scrollVelocityZ = 0;   // accumulated depth travel from wheel/touch
  let smoothScrollZ = 0;     // eased version actually applied
  let mouseX = 0, mouseY = 0;      // normalized -1..1
  let smoothMouseX = 0, smoothMouseY = 0;
  let lastTime = performance.now();

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function makeCard(spawnFar) {
    const el = document.createElement("div");
    el.className = "card";
    const img = document.createElement("img");
    img.src = pick(IMAGES);
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    el.appendChild(img);
    stage.appendChild(el);

    const scale = rand(0.7, 1.5);
    const w = BASE_W * scale;
    const h = w * ASPECT;

    const card = {
      el,
      x: rand(-SPREAD_X, SPREAD_X),
      y: rand(-SPREAD_Y, SPREAD_Y),
      z: spawnFar ? rand(Z_NEAR, Z_FAR) : rand(Z_NEAR, Z_FAR),
      w, h,
      rot: rand(-6, 6),
      spinSpeed: rand(-0.4, 0.4),
      driftX: rand(-4, 4),
      driftY: rand(-3, 3),
    };
    el.style.width = w + "px";
    el.style.height = h + "px";
    return card;
  }

  function respawnFar(card) {
    card.x = rand(-SPREAD_X, SPREAD_X);
    card.y = rand(-SPREAD_Y, SPREAD_Y);
    card.z = rand(Z_FAR * 0.75, Z_FAR);
    const scale = rand(0.7, 1.5);
    card.w = BASE_W * scale;
    card.h = card.w * ASPECT;
    card.el.style.width = card.w + "px";
    card.el.style.height = card.h + "px";
    card.rot = rand(-6, 6);
    card.spinSpeed = rand(-0.4, 0.4);
    card.driftX = rand(-4, 4);
    card.driftY = rand(-3, 3);
    // swap image occasionally so repeats feel less predictable
    if (Math.random() < 0.6) {
      const img = card.el.querySelector("img");
      img.src = pick(IMAGES);
    }
  }

  for (let i = 0; i < CARD_COUNT; i++) {
    cards.push(makeCard(true));
  }

  // ---- input: scroll (wheel + touch) -----------------------------
  window.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      scrollVelocityZ += e.deltaY * SCROLL_TO_Z;
    },
    { passive: false }
  );

  let touchStartY = null;
  window.addEventListener(
    "touchstart",
    (e) => {
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (touchStartY === null) return;
      const y = e.touches[0].clientY;
      const dy = touchStartY - y;
      scrollVelocityZ += dy * SCROLL_TO_Z * 1.4;
      touchStartY = y;
    },
    { passive: true }
  );

  // ---- input: mouse / pointer for left-right (and slight up-down) look
  window.addEventListener("pointermove", (e) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    mouseX = (e.clientX / w) * 2 - 1;   // -1 .. 1
    mouseY = (e.clientY / h) * 2 - 1;   // -1 .. 1
  });

  // fallback drift for touch devices without pointer move: gentle idle sway
  let idleT = 0;

  function frame(now) {
    const dt = Math.min(64, now - lastTime) / 1000; // seconds, clamped
    lastTime = now;
    idleT += dt;

    // ease mouse
    smoothMouseX += (mouseX - smoothMouseX) * Math.min(1, dt * 3.2);
    smoothMouseY += (mouseY - smoothMouseY) * Math.min(1, dt * 3.2);

    // ease scroll velocity into smoothScrollZ (adds up over time -> continuous depth travel)
    smoothScrollZ += (scrollVelocityZ - smoothScrollZ) * Math.min(1, dt * 6);
    scrollVelocityZ *= 0.82; // friction so wheel impulses decay

    const zTravel = (smoothScrollZ + AUTO_DRIFT) * dt;

    // rotate/pan whole stage based on mouse for left-right / up-down navigation feel
    const rotY = smoothMouseX * 10;   // deg
    const rotX = -smoothMouseY * 5;   // deg
    const panX = -smoothMouseX * 60;  // px
    const panY = -smoothMouseY * 30;  // px
    stage.style.transform =
      `translate3d(${panX}px, ${panY}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg)`;

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const card of cards) {
      card.z -= zTravel;
      card.x += card.driftX * dt;
      card.y += card.driftY * dt;
      card.rot += card.spinSpeed * dt;

      if (card.z < Z_RECYCLE) {
        respawnFar(card);
        continue;
      }
      if (card.z > Z_FAR + 200) {
        // pushed back too far (fast reverse scroll) — bring back near
        card.z = Z_FAR + 200;
      }

      const z = Math.max(1, card.z);
      const scaleProj = Z_NEAR === 0 ? 1 : (600 / (z + 600));
      const px = w / 2 + card.x * scaleProj;
      const py = h / 2 + card.y * scaleProj;

      // depth-based fade: fade in from far, fade out near camera cut
      let opacity = 1;
      if (z > Z_FAR * 0.72) {
        opacity = 1 - (z - Z_FAR * 0.72) / (Z_FAR * 0.28);
      } else if (z < 220) {
        opacity = z / 220;
      }
      opacity = Math.max(0, Math.min(1, opacity));

      card.el.style.opacity = opacity.toFixed(3);
      card.el.style.transform =
        `translate3d(${(px - card.w / 2).toFixed(1)}px, ${(py - card.h / 2).toFixed(1)}px, ${(-z).toFixed(1)}px) rotate(${card.rot.toFixed(2)}deg)`;
      card.el.style.zIndex = String(10000 - Math.round(z));
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // keep things sane on resize
  window.addEventListener("resize", () => {
    // no-op: projection uses live innerWidth/innerHeight each frame
  });
})();
