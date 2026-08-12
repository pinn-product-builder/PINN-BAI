/* =========================================================================
   🎫  CONVITE — configuração
   Pedro: edite só os valores abaixo. Use trocadilhos à vontade.
   ========================================================================= */
const CONFIG = {
  airline: "PEDRO ✈ MARIA",
  passageira: "MARIA",

  // origem → destino (pode ser real ou brincadeira)
  de:   { code: "ROTINA", place: "o dia a dia" },
  para: { code: "JANTAR", place: "a dois, só nosso" },

  // detalhes do "voo" (date). deixe 'surpresa' onde quiser segredo
  voo: "PH 2110",            // 21/10 — data de vocês
  data: "12 JUN",
  embarque: "à noite 🌙",     // horário (ou surpresa)
  portao: "♥",
  assento: "do meu lado",
  classe: "1ª (você merece)",
  bagagem: "seu sorriso",

  // textos
  mensagem: "Maria, esse é o meu convite pra um jantar só nosso no dia dos namorados. Topa? 💛",
  fechamento: "Mal posso esperar pra te ver. Te amo. 💛",
  assinatura: "— Pedro",

  // fotos
  passageiraFoto: "fotos/10-curinga-shopping.jpg",
  fotos: [
    "fotos/01-saudade.jpg", "fotos/06-forca.jpg", "fotos/04-rir.jpg",
    "fotos/05-orgulho.jpg", "fotos/07-abraco.jpg", "fotos/04b-rir-festajunina.jpg",
    "fotos/09-um-ano.jpg", "fotos/10-curinga-shopping.jpg",
  ],
};

/* ========================================================================= */

const app = document.getElementById("app");
const C = CONFIG;

function screen(id, html, extra="") {
  const s = document.createElement("section");
  s.className = "screen " + extra; s.id = id; s.innerHTML = html;
  app.appendChild(s); return s;
}

/* ---- tela 1: intro ---- */
screen("intro", `
  <div class="plane">✈️</div>
  <div class="kicker" style="margin-top:18px">você recebeu</div>
  <h1 class="h1">Um convite<br>especial</h1>
  <p class="sub">Maria, fiz o check-in pra você. Bora ver pra onde a gente vai?</p>
  <button class="btn" id="open">abrir meu convite ▸</button>
`);

/* ---- tela 2: cartão de embarque ---- */
screen("pass", `
  <div class="pass-wrap">
    <div class="pass">
      <div class="stamp" id="stamp">embarque<br>confirmado</div>
      <div class="pass-top">
        <div class="airline">✈ ${C.airline}</div>
        <div class="type">cartão de embarque</div>
      </div>
      <div class="pass-body">
        <div class="route">
          <div class="pt"><div class="code">${C.de.code}</div><div class="place">${C.de.place}</div></div>
          <div class="mid">✈</div>
          <div class="pt r"><div class="code">${C.para.code}</div><div class="place">${C.para.place}</div></div>
        </div>
        <div class="passenger">
          <div class="photo" style="background-image:url('${C.passageiraFoto}')"></div>
          <div class="who"><div class="lbl">passageira</div><div class="nm">${C.passageira}</div></div>
        </div>
        <div class="grid">
          <div class="cell"><div class="lbl">voo</div><div class="val">${C.voo}</div></div>
          <div class="cell"><div class="lbl">data</div><div class="val">${C.data}</div></div>
          <div class="cell"><div class="lbl">embarque</div><div class="val">${C.embarque}</div></div>
          <div class="cell"><div class="lbl">portão</div><div class="val">${C.portao}</div></div>
          <div class="cell"><div class="lbl">assento</div><div class="val">${C.assento}</div></div>
          <div class="cell"><div class="lbl">classe</div><div class="val">${C.classe}</div></div>
          <div class="cell wide"><div class="lbl">bagagem permitida</div><div class="val">${C.bagagem}</div></div>
        </div>
      </div>
      <div class="perf"><span class="notch l"></span><span class="notch r"></span></div>
      <div class="stub">
        <div class="info">
          <div class="lbl">passageira</div><div class="val">${C.passageira}</div>
          <div class="lbl" style="margin-top:6px">voo</div><div class="val">${C.voo}</div>
        </div>
        <div class="barcode"></div>
      </div>
    </div>
  </div>
  <div class="note"><div class="script">${C.mensagem}</div></div>
  <button class="btn" id="confirm">confirmar embarque ♥</button>
  <div class="spacer"></div>
`, "tall");

/* ---- tela 3: confirmado + galeria ---- */
screen("done", `
  <div class="hearts" id="hearts2"></div>
  <div class="kicker">embarque confirmado ✓</div>
  <div class="note" style="margin-top:14px">
    <div class="script">${C.fechamento}</div>
    <div class="sign">${C.assinatura}</div>
  </div>
  <div class="gallery">
    ${C.fotos.map(f => `<div class="g" style="background-image:url('${f}')"></div>`).join("")}
  </div>
  <div class="spacer"></div>
  <button class="btn ghost" id="restart">↺ ver o convite de novo</button>
  <div class="spacer"></div>
`, "tall");

/* ---------- navegação + ações ---------- */
function show(id) {
  app.querySelectorAll(".screen").forEach(s => {
    const on = s.id === id;
    s.classList.toggle("active", on);
    if (on) s.scrollTop = 0;
  });
}

document.getElementById("open").onclick = () => show("pass");

document.getElementById("confirm").onclick = (e) => {
  document.getElementById("stamp").classList.add("show");
  spawnHearts(document.createElement("div"));            // corações na tela do pass
  e.target.textContent = "confirmado ♥";
  e.target.disabled = true; e.target.style.opacity = ".7";
  setTimeout(() => { show("done"); spawnHearts(document.getElementById("hearts2")); }, 1500);
};

document.getElementById("restart").onclick = () => {
  const stamp = document.getElementById("stamp"); stamp.classList.remove("show");
  const c = document.getElementById("confirm"); c.textContent = "confirmar embarque ♥"; c.disabled = false; c.style.opacity = "1";
  show("intro");
};

function spawnHearts(box) {
  if (!box) return;
  if (!box.parentElement) { box.className = "hearts"; box.style.zIndex = "60"; document.getElementById("phone").appendChild(box);
    setTimeout(() => box.remove(), 7000); }
  const emojis = ["💛", "❤️", "✈️", "✨"];
  for (let i = 0; i < 16; i++) {
    const h = document.createElement("i");
    h.textContent = emojis[i % emojis.length];
    h.style.left = Math.random() * 100 + "%";
    h.style.animationDelay = (Math.random() * 5) + "s";
    h.style.animationDuration = (4 + Math.random() * 4) + "s";
    h.style.fontSize = (16 + Math.random() * 20) + "px";
    box.appendChild(h);
  }
}

show("intro");
