/* 어항 — 물고기가 헤엄치고, 밥을 주면 먹이 쪽으로 몰려든다.
   섹션 열기는 script.js 가 맡는다. 여기서는 움직임만 다룬다. */

(() => {
  const school = document.getElementById("school");
  const feedButton = document.getElementById("feed");
  const feedCount = document.getElementById("feed-count");
  if (!school) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const FISH_W = 124;
  const FISH_H = 89;
  const SENSE = 300;       // 먹이를 알아채는 거리
  const BITE = 38;         // 먹는 거리 — 바닥 먹이에 입이 닿아야 한다
  const PELLET_LIFE = 14000;
  const WATER_TOP = 0.15;  // 수면 (어항 높이 비율)
  const FLOOR = 0.85;      // 자갈 윗면

  let W = 0, H = 0;        // 물고기가 돌아다닐 수 있는 상자
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  const fish = [...school.querySelectorAll(".fish")].map((el, i) => ({
    el,
    fx: parseFloat(el.style.getPropertyValue("--fish-x")) || 0.5,
    fy: parseFloat(el.style.getPropertyValue("--fish-y")) || 0.5,
    x: 0, y: 0,            // 중심 좌표
    vx: (i % 2 ? 1 : -1) * (22 + Math.random() * 20),
    vy: (Math.random() - 0.5) * 12,
    // 개체마다 순항 속도와 흔들림이 달라야 무리가 한 덩어리로 뭉치지 않는다.
    bob: 9 + Math.random() * 13,
    bobRate: 0.9 + Math.random() * 1.0,
    // 가로도 제 구역을 왕복한다. 벽에만 튕기게 두면 속도가 비슷해져 한쪽에 뭉친다.
    roamRate: 0.16 + Math.random() * 0.14,
    roamSpan: 0.1 + Math.random() * 0.08,
    roamPhase: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    facing: 1,
    chaseSince: 0,     // 언제부터 먹이를 쫓고 있는지
    ignoreUntil: 0,    // 이때까지는 먹이를 못 본 척한다
  }));

  const pellets = [];
  let eaten = 0;

  function measure() {
    const rect = school.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    minX = FISH_W / 2;
    maxX = Math.max(W - FISH_W / 2, minX);
    minY = FISH_H / 2;
    maxY = Math.max(H - FISH_H / 2, minY);
    fish.forEach((f) => {
      f.homeY = Math.min(Math.max(f.fy * H, minY + 10), maxY - 10);
      f.span = W * f.roamSpan;
      f.homeX = Math.min(Math.max(f.fx * W, minX + f.span), maxX - f.span);
    });
  }

  /* 유리 벽에 닿으면 튕긴다. */
  function constrain(f) {
    if (f.x < minX) { f.x = minX; f.vx = Math.abs(f.vx); }
    if (f.x > maxX) { f.x = maxX; f.vx = -Math.abs(f.vx); }
    if (f.y < minY) { f.y = minY; f.vy = Math.abs(f.vy); }
    if (f.y > maxY) { f.y = maxY; f.vy = -Math.abs(f.vy); }
  }

  function place(f) {
    const left = f.x - FISH_W / 2;
    const top = f.y - FISH_H / 2;
    f.el.style.transform =
      `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) scaleX(${f.facing})`;
    // 몸통이 뒤집혀도 이름표 글자는 바로 서 있어야 한다.
    f.el.style.setProperty("--flip", f.facing);
  }

  /* 먹이가 가라앉는 바닥 높이 — 자갈 바로 위. */
  function floorAt() {
    // 물고기 중심이 내려갈 수 있는 한계보다 위에 놓여야 먹을 수 있다.
    return Math.min(H - 20, maxY + BITE - 12);
  }

  function spawnPellets() {
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i += 1) {
      const dot = document.createElement("span");
      dot.className = "pellet";
      school.append(dot);
      pellets.push({
        el: dot,
        x: W * (0.1 + Math.random() * 0.8),
        y: -8 - Math.random() * 30,
        vy: 24 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 10,
        born: performance.now(),
      });
    }
    if (feedCount) {
      feedCount.textContent = eaten ? `${eaten}개 먹었어요` : "먹이를 뿌렸어요";
    }
  }

  function removePellet(index) {
    pellets[index].el.remove();
    pellets.splice(index, 1);
  }

  function nearestPellet(f) {
    let best = null;
    let bestDist = SENSE;
    pellets.forEach((p, i) => {
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if (d < bestDist) {
        bestDist = d;
        best = { p, i, d };
      }
    });
    return best;
  }

  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    for (let i = pellets.length - 1; i >= 0; i -= 1) {
      const p = pellets[i];
      const rest = floorAt();
      if (p.y < rest) {
        p.vy += 38 * dt;
        p.y += p.vy * dt;
        p.x += p.vx * dt;
      } else {
        p.y = rest;
      }
      if (now - p.born > PELLET_LIFE) {
        removePellet(i);
        continue;
      }
      p.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    }

    fish.forEach((f) => {
      const hit = now < f.ignoreUntil ? null : nearestPellet(f);

      // 오래 쫓았는데 못 먹었으면 잠시 포기한다 — 바닥에 붙어 사는 걸 막는다.
      if (hit) {
        if (!f.chaseSince) f.chaseSince = now;
        if (now - f.chaseSince > 7000) {
          f.ignoreUntil = now + 5000;
          f.chaseSince = 0;
        }
      } else {
        f.chaseSince = 0;
      }

      if (hit && now >= f.ignoreUntil) {
        f.vx += ((hit.p.x - f.x) * 1.6 - f.vx) * 2.2 * dt;
        f.vy += ((hit.p.y - f.y) * 1.6 - f.vy) * 2.2 * dt;

        if (hit.d < BITE) {
          removePellet(hit.i);
          eaten += 1;
          f.chaseSince = 0;
          f.el.classList.add("is-eating");
          setTimeout(() => f.el.classList.remove("is-eating"), 380);
          if (feedCount) feedCount.textContent = `${eaten}개 먹었어요`;
        }
      } else {
        // 평소에는 느긋하게 돌아다닌다.
        f.phase += dt * f.bobRate;
        f.roamPhase += dt * f.roamRate * Math.PI * 2;

        // 제 구역을 좌우로 천천히 왕복하고, 제 수심 근처에서 오르내린다.
        const wantX = f.homeX + Math.sin(f.roamPhase) * f.span;
        const wantY = f.homeY + Math.sin(f.phase) * f.bob * 2.2;
        f.vx += ((wantX - f.x) * 1.4 - f.vx) * 2.4 * dt;
        f.vy += ((wantY - f.y) * 1.9 - f.vy) * 3 * dt;
      }

      const speed = Math.hypot(f.vx, f.vy);
      const cap = hit ? 145 : 44;
      if (speed > cap) {
        f.vx = (f.vx / speed) * cap;
        f.vy = (f.vy / speed) * cap;
      }

      // 겹쳐 다니지 않도록 가까운 개체끼리 살짝 밀어낸다.
      fish.forEach((other) => {
        if (other === f) return;
        const dx = f.x - other.x;
        const dy = f.y - other.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 96) {
          const push = (96 - d) / 96;
          f.vx += (dx / d) * push * 46 * dt;
          f.vy += (dy / d) * push * 34 * dt;
        }
      });

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      constrain(f);

      if (Math.abs(f.vx) > 4) f.facing = f.vx > 0 ? 1 : -1;
      place(f);
    });

    requestAnimationFrame(frame);
  }

  measure();
  fish.forEach((f) => {
    f.x = f.fx * W;
    f.y = f.fy * H;
    constrain(f);
    place(f);
  });

  window.addEventListener("resize", () => {
    const oldW = W || 1;
    const oldH = H || 1;
    const ratios = fish.map((f) => [f.x / oldW, f.y / oldH]);
    measure();
    fish.forEach((f, i) => {
      f.x = ratios[i][0] * W;
      f.y = ratios[i][1] * H;
      constrain(f);
      place(f);
    });
  });

  if (feedButton) {
    feedButton.addEventListener("click", () => {
      if (pellets.length > 40) return;
      spawnPellets();
    });
  }

  if (!reduced) requestAnimationFrame(frame);
})();
