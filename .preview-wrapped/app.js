/* =========================================================================
   ❤️  NOSSO WRAPPED — configuração
   Pedro: ajuste só as linhas abaixo. Os textos podem mudar à vontade.
   ========================================================================= */
const CONFIG = {
  // 👉 DATA EM QUE VOCÊS COMEÇARAM A NAMORAR (ano-mês-dia)
  startDate: "2018-10-21",

  // 👉 a música de vocês (salve o mp3 como "musica.mp3" nesta pasta)
  song: { title: "Eu Amo Você", artist: "Tim Maia", emoji: "🎵" },

  // 👉 nome de quem assina
  signature: "Pedro",

  // 👉 os slides, na ordem. type: intro | counter | photo | stat | song | finale
  slides: [
    { type: "intro", bg: "bg-green",
      kicker: "edição especial · dia dos namorados",
      title: "O Wrapped<br>de nós dois",
      lead: "Maria, preparei uma retrospectiva da gente. Bora?" },

    { type: "counter", bg: "bg-purple",
      kicker: "desde o primeiro dia",
      pre: "a gente já está junto há",
      unit: "dias", post: "…e contando 💚" },

    { type: "photo", img: "fotos/10-curinga-shopping.jpg",
      kicker: "descoberta do ano", label: "seu sorriso virou meu lugar favorito" },

    { type: "photo", img: "fotos/04-rir.jpg",
      kicker: "", label: "minha criança interior ama a sua criança interior" },

    { type: "photo", img: "fotos/04b-rir-festajunina.jpg",
      kicker: "", label: "minha criança interior se sente acolhida por você" },

    { type: "photo", img: "fotos/05-orgulho.jpg",
      kicker: "modo aventura", label: "topar tudo, desde que seja com você" },

    { type: "stat", bg: "bg-pink",
      kicker: "estatística oficial", huge: "∞", label: "beijos trocados (e contando)" },

    { type: "photo", img: "fotos/06-forca.jpg",
      kicker: "momento mais tocado", label: "esse beijo aqui eu guardo pra sempre" },

    { type: "song", bg: "bg-green",
      kicker: "a trilha sonora de vocês" },

    { type: "photo", img: "fotos/09-um-ano.jpg",
      kicker: "em toda estação", label: "do Natal à festa junina, eu te escolho" },

    { type: "photo", img: "fotos/01-saudade.jpg",
      kicker: "fato curioso", label: "até a chuva fica boa do seu lado" },

    { type: "finale", img: "fotos/07-abraco.jpg",
      title: "Feliz Dia dos<br>Namorados, Maria",
      lead: "obrigado por ser o melhor de todos os meus dias.",
      script: "eu amo você." },
  ],
};

/* ========================================================================= */

const app = document.getElementById("app");
const audio = document.getElementById("audio");
let idx = 0, timer = null, rafId = null, started = false;
const slidesData = CONFIG.slides;

function daysTogether() {
  const start = new Date(CONFIG.startDate + "T00:00:00");
  const now = new Date();
  return Math.max(0, Math.floor((now - start) / 86400000));
}

/* ---------- construção do DOM ---------- */
function build() {
  // barra de progresso topo
  const bars = document.createElement("div");
  bars.id = "bars-top";
  slidesData.forEach(() => {
    const seg = document.createElement("div");
    seg.className = "seg";
    seg.innerHTML = '<span class="fill"></span>';
    bars.appendChild(seg);
  });
  app.appendChild(bars);

  // botão de mudo
  const mute = document.createElement("button");
  mute.id = "mute"; mute.textContent = "🔊";
  mute.onclick = (e) => { e.stopPropagation(); audio.muted = !audio.muted; mute.textContent = audio.muted ? "🔇" : "🔊"; };
  app.appendChild(mute);

  // slides
  slidesData.forEach((s, i) => app.appendChild(renderSlide(s, i)));

  // zonas de navegação
  const prev = document.createElement("div"); prev.className = "nav-zone prev"; prev.onclick = () => go(idx - 1);
  const next = document.createElement("div"); next.className = "nav-zone next"; next.onclick = () => go(idx + 1);
  app.appendChild(prev); app.appendChild(next);

  // segurar para pausar
  app.addEventListener("pointerdown", () => pauseTimer());
  app.addEventListener("pointerup", () => { if (started) resumeTimer(); });
  // swipe
  let sx = 0;
  app.addEventListener("touchstart", e => sx = e.touches[0].clientX, { passive: true });
  app.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) go(dx < 0 ? idx + 1 : idx - 1);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") go(idx + 1);
    if (e.key === "ArrowLeft") go(idx - 1);
  });
}

function renderSlide(s, i) {
  const el = document.createElement("div");
  el.className = "slide " + (s.type === "photo" ? "photo " : "") + (s.bg || "");
  el.dataset.i = i;

  if (s.type === "intro") {
    el.innerHTML = `
      <div class="kicker anim">${s.kicker}</div>
      <h1 class="big anim d1 mt">${s.title}</h1>
      <p class="lead anim d2 mt">${s.lead}</p>
      <button class="start-btn">toque para começar ▸</button>`;
    el.querySelector(".start-btn").onclick = (e) => { e.stopPropagation(); start(); };
  }

  else if (s.type === "counter") {
    el.innerHTML = `
      <div class="kicker anim">${s.kicker}</div>
      <p class="lead anim d1 mt">${s.pre}</p>
      <div class="huge anim d1 mt-s" data-count>0</div>
      <p class="title anim d2 mt-s">${s.unit}</p>
      <p class="lead anim d3 mt">${s.post}</p>`;
  }

  else if (s.type === "photo") {
    const kickerHtml = s.kicker ? `<div class="kicker anim">${s.kicker}</div>` : "";
    el.innerHTML = `
      <div class="img" style="background-image:url('${s.img}')"></div>
      <div class="scrim"></div>
      <div class="cap">
        ${kickerHtml}
        <div class="label anim ${s.kicker ? "d1" : ""}">${s.label}</div>
      </div>`;
  }

  else if (s.type === "stat") {
    el.innerHTML = `
      <div class="kicker anim">${s.kicker}</div>
      <div class="huge anim d1 mt">${s.huge}</div>
      <p class="title anim d2 mt-s">${s.label}</p>`;
  }

  else if (s.type === "song") {
    el.innerHTML = `
      <div class="kicker anim">${s.kicker}</div>
      <div class="song-card anim d1 mt-l">
        <div class="song-cover">${CONFIG.song.emoji}</div>
        <div class="song-title">${CONFIG.song.title}</div>
        <div class="song-artist">${CONFIG.song.artist}</div>
        <div class="bars"><span></span><span></span><span></span><span></span><span></span></div>
      </div>
      <p class="lead anim d2 mt-l">a nossa, pra sempre.</p>`;
  }

  else if (s.type === "finale") {
    el.classList.add("photo");
    el.innerHTML = `
      <div class="img" style="background-image:url('${s.img}')"></div>
      <div class="scrim"></div>
      <div class="hearts"></div>
      <div class="cap" style="text-align:center">
        <h1 class="title anim">${s.title}</h1>
        <p class="lead anim d1 mt">${s.lead}</p>
        <p class="script anim d2 mt-s">${s.script}</p>
        <p class="kicker anim d2 mt">— ${CONFIG.signature}</p>
        <div style="display:flex;justify-content:center"><button class="replay anim d3">↺ ver de novo</button></div>
      </div>`;
    el.querySelector(".replay").onclick = (e) => { e.stopPropagation(); go(0, true); };
  }
  return el;
}

/* ---------- navegação + timer (stories) ---------- */
const DUR = { intro: 99999, counter: 5200, photo: 4800, stat: 4200, song: 5200, finale: 99999 };

function start() {
  started = true;
  document.getElementById("mute").style.display = "block";
  audio.play().catch(() => {}); // se o musica.mp3 ainda não estiver na pasta, segue sem som
  go(1);
}

function go(n, replay) {
  if (n < 0) n = 0;
  if (n >= slidesData.length) n = slidesData.length - 1;
  if (replay) { started = false; audio.pause(); audio.currentTime = 0; document.getElementById("mute").style.display = "none"; }
  setActive(n);
}

function setActive(n) {
  idx = n;
  const slides = app.querySelectorAll(".slide");
  slides.forEach((sl, i) => sl.classList.toggle("active", i === n));

  // barras
  const segs = app.querySelectorAll("#bars-top .seg");
  segs.forEach((seg, i) => {
    const fill = seg.querySelector(".fill");
    seg.classList.toggle("done", i < n);
    if (i !== n) fill.style.width = i < n ? "100%" : "0%";
  });

  // contador animado
  const counter = slides[n].querySelector("[data-count]");
  if (counter) animateCount(counter, daysTogether());

  // corações no finale
  if (slidesData[n].type === "finale") spawnHearts(slides[n].querySelector(".hearts"));

  clearTimer();
  if (started) startTimer();
}

function startTimer() {
  const type = slidesData[idx].type;
  const dur = DUR[type] || 4800;
  if (dur > 90000) return; // intro/finale não avançam sozinhos
  const seg = app.querySelectorAll("#bars-top .seg")[idx];
  const fill = seg.querySelector(".fill");
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    fill.style.width = (p * 100) + "%";
    if (p < 1) { rafId = requestAnimationFrame(tick); }
    else { go(idx + 1); }
  };
  rafId = requestAnimationFrame(tick);
}
let pausedAt = null;
function pauseTimer() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; pausedAt = true; } }
function resumeTimer() { if (pausedAt && started) { pausedAt = null; /* reinicia o segmento atual */ startTimer(); } }
function clearTimer() { if (rafId) cancelAnimationFrame(rafId); rafId = null; if (timer) clearTimeout(timer); }

function animateCount(el, target) {
  const dur = 1500, t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(eased * target).toLocaleString("pt-BR");
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function spawnHearts(box) {
  if (!box || box.child_done) return; box.child_done = true;
  const emojis = ["💚", "❤️", "💛", "✨"];
  for (let i = 0; i < 18; i++) {
    const h = document.createElement("i");
    h.textContent = emojis[i % emojis.length];
    h.style.left = Math.random() * 100 + "%";
    h.style.animationDelay = (Math.random() * 5) + "s";
    h.style.animationDuration = (4 + Math.random() * 4) + "s";
    h.style.fontSize = (16 + Math.random() * 20) + "px";
    box.appendChild(h);
  }
}

build();
setActive(0);
