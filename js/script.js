/* WORKSHEETS (기본 학습지 목록) 는 js/worksheets.js 에서 옵니다. */

const MARQUEE_SPEED = 30;
const marqueeBoards = [];

/* Cursor glow ------------------------------------------------------------- */

const glow = document.querySelector(".glow");

if (glow && window.matchMedia("(pointer: fine)").matches) {
  window.addEventListener("pointermove", (event) => {
    glow.style.setProperty("--glow-x", `${event.clientX}px`);
    glow.style.setProperty("--glow-y", `${event.clientY}px`);
  });
}

/* Worksheets -------------------------------------------------------------- */
/* 기본 학습지는 파일에서, 사용자가 올린 학습지는 localStorage 에서 온다.
   올린 것은 이 브라우저에만 남는다 — 서버가 없으므로 다른 사람에게는 보이지 않는다. */

const LOCAL_KEY = "worksheets.local.v1";
const UPLOAD_MAX_SIDE = 1100;
const UPLOAD_QUALITY = 0.72;

const worksheetGrid = document.querySelector(".worksheet-grid");
const worksheetFile = document.getElementById("worksheet-file");
const worksheetAdd = document.getElementById("worksheet-add");
const worksheetStatus = document.getElementById("worksheet-status");

let localSheets = readLocal();
let sheets = [];

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(localSheets));
    return true;
  } catch {
    return false; // 대개 용량 초과
  }
}

function buildSheets() {
  sheets = WORKSHEETS.map((sheet) => ({
    thumb: `img/worksheets/thumb/${sheet.file}`,
    full: `img/worksheets/${sheet.file}`,
    title: sheet.title,
    local: false,
  })).concat(
    localSheets.map((sheet) => ({
      thumb: sheet.src,
      full: sheet.src,
      title: sheet.title,
      local: true,
      id: sheet.id,
    }))
  );
}

function say(message) {
  if (worksheetStatus) worksheetStatus.textContent = message || "";
}

function renderWorksheets() {
  if (!worksheetGrid) return;
  buildSheets();

  worksheetGrid.innerHTML = sheets
    .map((sheet, i) => {
      const no = String(i + 1).padStart(2, "0");
      const remove = sheet.local
        ? `<button class="worksheet-remove" type="button" data-id="${sheet.id}" aria-label="${sheet.title} 삭제">✕</button>`
        : "";
      const badge = sheet.local ? '<em class="worksheet-badge">내 기기</em>' : "";
      return `<figure class="worksheet${sheet.local ? " is-local" : ""}">
        <div class="worksheet-frame">
          <button class="worksheet-open" type="button" data-index="${i}">
            <img src="${sheet.thumb}" alt="${sheet.title}" loading="lazy" decoding="async">
          </button>
          ${remove}
        </div>
        <figcaption><b>${no}</b>${sheet.title}${badge}</figcaption>
      </figure>`;
    })
    .join("");

  worksheetGrid.querySelectorAll(".worksheet-open").forEach((button) => {
    button.addEventListener("click", () => openViewer(Number(button.dataset.index)));
  });

  worksheetGrid.querySelectorAll(".worksheet-remove").forEach((button) => {
    button.addEventListener("click", () => removeLocal(button.dataset.id));
  });
}

function removeLocal(id) {
  const target = localSheets.find((sheet) => sheet.id === id);
  if (!target) return;
  if (!window.confirm(`"${target.title}" 을(를) 목록에서 지울까요?`)) return;

  localSheets = localSheets.filter((sheet) => sheet.id !== id);
  writeLocal();
  renderWorksheets();
  say("삭제했습니다.");
}

/* 원본을 그대로 담으면 저장 용량을 금방 넘기므로 캔버스로 줄여서 담는다. */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", UPLOAD_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} 은(는) 이미지로 읽지 못했습니다`));
    };

    img.src = url;
  });
}

async function addFiles(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith("image/"));
  if (!files.length) {
    say("이미지 파일만 추가할 수 있습니다. PDF 는 tools/add-worksheet.py 를 쓰세요.");
    return;
  }

  say(`${files.length}장 처리 중…`);
  const before = localSheets.slice();
  let added = 0;

  for (const file of files) {
    try {
      const src = await shrink(file);
      localSheets.push({
        id: `local-${Date.now()}-${added}`,
        title: file.name.replace(/\.[^.]+$/, ""),
        src,
      });
      added += 1;
    } catch (error) {
      say(error.message);
    }
  }

  if (!added) return;

  if (!writeLocal()) {
    localSheets = before;
    writeLocal();
    renderWorksheets();
    say("저장 공간이 가득 찼습니다. 기존에 올린 학습지를 지우고 다시 시도해 주세요.");
    return;
  }

  renderWorksheets();
  say(`${added}장 추가했습니다. 이 브라우저에만 저장됩니다.`);
}

if (worksheetAdd && worksheetFile) {
  worksheetAdd.addEventListener("click", () => worksheetFile.click());
  worksheetFile.addEventListener("change", () => {
    addFiles(worksheetFile.files);
    worksheetFile.value = "";
  });
}

renderWorksheets();

/* Scroll spy — highlight the nav item for whichever section is in view ----- */

const navLinks = [...document.querySelectorAll(".nav-link")];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function updateActiveNav() {
  // The section whose top has passed 30% down the viewport is the current one.
  const mark = window.scrollY + window.innerHeight * 0.3;
  let currentId = sections[0].id;

  sections.forEach((section) => {
    if (section.getBoundingClientRect().top + window.scrollY <= mark) {
      currentId = section.id;
    }
  });

  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${currentId}`);
  });
}

if (sections.length) {
  window.addEventListener("scroll", updateActiveNav, { passive: true });
  updateActiveNav();
}

/* Project marquee --------------------------------------------------------- */

function buildRow(row, filter) {
  const track = row.querySelector(".marquee-track");
  const source = row.sourceCards.filter(
    (card) => filter === "all" || card.dataset.group === filter
  );

  track.classList.remove("is-running");
  row.hidden = source.length === 0;
  if (row.hidden || row.clientWidth === 0) return;

  track.replaceChildren(...source.map((card) => card.cloneNode(true)));

  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;

  // Repeat the set until one pass is at least as wide as the row, so the
  // second copy always covers the gap the first one leaves behind.
  let guard = 0;
  while (track.scrollWidth < row.clientWidth + gap && guard < 20) {
    source.forEach((card) => track.append(card.cloneNode(true)));
    guard += 1;
  }

  const shift = track.scrollWidth + gap;

  [...track.children].forEach((card) => {
    const copy = card.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    track.append(copy);
  });

  track.style.setProperty("--shift", `${shift}px`);
  track.style.setProperty("--duration", `${(shift / MARQUEE_SPEED).toFixed(2)}s`);
  void track.offsetWidth;
  track.classList.add("is-running");
}

function buildMarquee(board, filter) {
  board.filter = filter;
  board.querySelectorAll(".marquee").forEach((row) => buildRow(row, filter));
}

document.querySelectorAll(".project-marquee").forEach((board) => {
  board.querySelectorAll(".marquee").forEach((row) => {
    row.sourceCards = [...row.querySelector(".marquee-track").children].map((card) =>
      card.cloneNode(true)
    );
  });

  marqueeBoards.push(board);
  buildMarquee(board, "all");
});

/* Filters ----------------------------------------------------------------- */

document.querySelectorAll(".section-switch").forEach((group) => {
  const pills = group.querySelectorAll(".switch-pill");
  const rows = group.dataset.target ? document.querySelectorAll(group.dataset.target) : [];
  const board = group.dataset.marquee ? document.querySelector(group.dataset.marquee) : null;

  function applyFilter(pill) {
    const selectedGroup = pill.dataset.filter;

    pills.forEach((item) => item.classList.toggle("is-selected", item === pill));

    rows.forEach((row) => {
      const hidden = selectedGroup !== "all" && row.dataset.group !== selectedGroup;
      row.classList.toggle("is-hidden", hidden);
    });

    if (board) buildMarquee(board, selectedGroup);
  }

  pills.forEach((pill) => {
    pill.addEventListener("click", () => applyFilter(pill));
  });

  // Match the markup's pre-selected pill instead of showing every row at load.
  const preselected = group.querySelector(".switch-pill.is-selected");
  if (preselected && rows.length) applyFilter(preselected);
});

/* Worksheet viewer -------------------------------------------------------- */

const viewer = document.getElementById("worksheet-viewer");
const viewerImage = document.getElementById("viewer-image");
const viewerCaption = document.getElementById("viewer-caption");

let viewerIndex = 0;
let viewerOpener = null;

function renderViewer() {
  const sheet = sheets[viewerIndex];
  if (!sheet) return;

  viewerImage.src = sheet.full;
  viewerImage.alt = sheet.title;
  viewerCaption.textContent = `${viewerIndex + 1} / ${sheets.length} · ${sheet.title}`;
}

function openViewer(index) {
  viewerIndex = index;
  viewerOpener = worksheetGrid.querySelector(`.worksheet-open[data-index="${index}"]`);
  renderViewer();
  viewer.hidden = false;
  document.body.style.overflow = "hidden";
  viewer.querySelector(".viewer-close").focus();
}

function closeViewer() {
  viewer.hidden = true;
  viewerImage.src = "";
  document.body.style.overflow = "";
  if (viewerOpener && document.contains(viewerOpener)) viewerOpener.focus();
}

function stepViewer(offset) {
  viewerIndex = (viewerIndex + offset + sheets.length) % sheets.length;
  viewerOpener = worksheetGrid.querySelector(`.worksheet-open[data-index="${viewerIndex}"]`);
  renderViewer();
}

if (viewer) {
  viewer.querySelector(".viewer-close").addEventListener("click", closeViewer);
  viewer.querySelector(".viewer-prev").addEventListener("click", () => stepViewer(-1));
  viewer.querySelector(".viewer-next").addEventListener("click", () => stepViewer(1));

  // Clicking the dark backdrop closes; clicking the image or a control does not.
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
  });

  document.addEventListener("keydown", (event) => {
    if (viewer.hidden) return;
    if (event.key === "Escape") closeViewer();
    if (event.key === "ArrowLeft") stepViewer(-1);
    if (event.key === "ArrowRight") stepViewer(1);
  });
}

/* Back to top + resize ---------------------------------------------------- */

const topButton = document.querySelector(".top-button");

window.addEventListener("scroll", () => {
  topButton.classList.toggle("is-visible", window.scrollY > 400);
});

topButton.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    marqueeBoards.forEach((board) => buildMarquee(board, board.filter));
  }, 200);
});
