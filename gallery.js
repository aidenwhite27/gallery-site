(() => {
  "use strict";

  // Newest first. Swap a and b to show oldest first.
  const items = (window.GALLERY || []).slice().sort((a, b) => b.date.localeCompare(a.date));

  const grid = document.getElementById("grid");
  const dialog = document.getElementById("lightbox");
  const stage = dialog.querySelector(".lb-stage");
  const caption = dialog.querySelector(".lb-caption");
  const prevBtn = dialog.querySelector(".lb-prev");
  const nextBtn = dialog.querySelector(".lb-next");

  if (!items.length) {
    const empty = document.getElementById("empty");
    if (empty) empty.hidden = false;
    return;
  }

  // Dates are stored as local time ("2024-05-03T14:22:33"), which Date parses as local.
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" });
  const shortDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
  const ratio = (item) => (item.width && item.height ? item.height / item.width : 1);

  // ---------- Grid ----------

  const tiles = items.map((item, i) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    if (item.width && item.height) tile.style.aspectRatio = `${item.width} / ${item.height}`;
    const when = new Date(item.date);
    tile.setAttribute("aria-label", `${item.type === "video" ? "Video" : "Photo"}, ${dateFormat.format(when)}`);

    let media;
    if (item.type === "video" && !item.poster) {
      media = document.createElement("video");
      media.src = item.src + "#t=0.1";
      media.preload = "metadata";
      media.muted = true;
      media.playsInline = true;
    } else {
      media = document.createElement("img");
      media.src = item.type === "video" ? item.poster : item.src;
      media.loading = "lazy";
      media.decoding = "async";
      media.alt = "";
      // Size unknown ahead of time: take it from the image once loaded.
      if (!item.width || !item.height) {
        media.addEventListener("load", () => {
          tile.style.aspectRatio = `${media.naturalWidth} / ${media.naturalHeight}`;
        }, { once: true });
      }
    }
    tile.append(media);

    if (item.type === "video") {
      const badge = document.createElement("span");
      badge.className = "play";
      tile.append(badge);
    }

    const label = document.createElement("span");
    label.className = "date";
    label.textContent = shortDate.format(when);
    tile.append(label);

    tile.addEventListener("click", () => openViewer(i));
    return tile;
  });

  // Roughly one column per 260px of width, between 2 (phones) and 6 (wide screens).
  const columnsFor = (width) => Math.min(6, Math.max(2, Math.floor(width / 260)));

  let columnCount = 0;
  function layout() {
    const count = columnsFor(grid.clientWidth);
    if (count === columnCount) return;
    columnCount = count;

    // Pinterest-style: each item goes into whichever column is currently shortest,
    // so the order reads left-to-right, top-to-bottom. The same tile elements are
    // moved (not recreated), so already loaded images don't reload on resize.
    const columns = Array.from({ length: count }, () => {
      const col = document.createElement("div");
      col.className = "col";
      return col;
    });
    const heights = new Array(count).fill(0);
    tiles.forEach((tile, i) => {
      const shortest = heights.indexOf(Math.min(...heights));
      columns[shortest].append(tile);
      heights[shortest] += ratio(items[i]) + 0.05;
    });
    grid.replaceChildren(...columns);
  }

  new ResizeObserver(layout).observe(grid);
  layout();

  // ---------- Viewer ----------

  let current = -1;

  function show(i) {
    current = i;
    const item = items[i];
    let media;
    if (item.type === "video") {
      media = document.createElement("video");
      media.src = item.src;
      if (item.poster) media.poster = item.poster;
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
    } else {
      media = document.createElement("img");
      media.src = item.src;
      media.alt = "";
    }
    stage.replaceChildren(media);
    caption.textContent = dateFormat.format(new Date(item.date));
    prevBtn.hidden = i === 0;
    nextBtn.hidden = i === items.length - 1;

    // Preload neighbouring photos so stepping through feels instant.
    for (const j of [i - 1, i + 1]) {
      if (items[j] && items[j].type === "image") new Image().src = items[j].src;
    }
  }

  function step(delta) {
    const i = current + delta;
    if (i >= 0 && i < items.length) show(i);
  }

  function openViewer(i) {
    show(i);
    if (!dialog.open) {
      dialog.showModal();
      // Lets the phone's back button / gesture close the viewer instead of leaving the page.
      history.pushState({ lightbox: true }, "");
    }
  }

  dialog.addEventListener("close", () => {
    stage.replaceChildren(); // also stops any playing video
    if (history.state && history.state.lightbox) history.back();
  });
  window.addEventListener("popstate", () => {
    if (dialog.open) dialog.close();
  });

  dialog.querySelector(".lb-close").addEventListener("click", () => dialog.close());
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));

  // Clicking the dark area around the photo closes the viewer.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target === stage) dialog.close();
  });

  dialog.addEventListener("keydown", (e) => {
    if (e.target.tagName === "VIDEO") return; // arrow keys seek the video
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  // Swipe left/right on touch screens (one finger only, so pinch-zoom still works).
  let touchStart = null;
  stage.addEventListener("touchstart", (e) => {
    touchStart = e.touches.length === 1 && e.target.tagName !== "VIDEO"
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : null;
  }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (!touchStart || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  });
})();
