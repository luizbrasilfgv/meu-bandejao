/* ===========================================================
   <APP> — app.js
   Vanilla ES6 + Firebase (Auth / Firestore). Sem framework.
   -----------------------------------------------------------
   ESTE ARQUIVO É O ESQUELETO DO PADRÃO. O que já está pronto:
   tema, login, portaria de aprovação, navegação, janelas de
   baixo, toast, persistência com atraso e painel de acessos.
   VOCÊ ESCREVE: a seção 1 (domínio) e as funções pintarX().
   =========================================================== */

/* ===========================================================
   0. CONFIG
   =========================================================== */

/* Cole aqui o firebaseConfig do seu projeto.
   Console Firebase → Configurações do projeto → Seus apps → Web.
   Este bloco é PÚBLICO por natureza: ele identifica o projeto,
   não autoriza nada. A segurança está nas Firestore Rules. */
const firebaseConfig = {
  apiKey:            "COLE_AQUI",
  authDomain:        "SEU-PROJETO.firebaseapp.com",
  projectId:         "SEU-PROJETO",
  storageBucket:     "SEU-PROJETO.firebasestorage.app",
  messagingSenderId: "COLE_AQUI",
  appId:             "COLE_AQUI"
};

/* Falso = MODO LOCAL: entra sem Google e salva só no aparelho.
   Serve para desenvolver e testar. NUNCA publique em falso. */
const CONFIGURADO = !String(firebaseConfig.apiKey).startsWith("COLE_");

/* Prefixo das chaves no localStorage, para não colidir com
   outros apps publicados no mesmo domínio. */
const NS = "meu_vale";

/* Coleção onde cada usuário guarda o estado dele. Se o app tiver
   dois conjuntos independentes, crie DUAS coleções — não dois
   campos no mesmo documento. */
const COLECAO = "despesas";

/* E-mails que enxergam telas restritas. Controle COSMÉTICO:
   quem protege dado são as Rules. Vazio = todo mundo vê tudo. */
const DONOS = [];

/* ---------- estado global ---------- */
let usuario  = null;
let papeis   = [];
let situacao = "pendente";
let despesas = [];         // <<< o estado do SEU app
let sessaoSalario = null;
let db = null, auth = null, salvarDoc = null;

const el   = id => document.getElementById(id);
const esc  = s  => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const chave = s => String(s ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase();


/* ===========================================================
   1. DOMÍNIO  <<< ESCREVA AQUI
   -----------------------------------------------------------
   Lógica pura, SEM tocar no DOM. É o único pedaço que dá para
   testar sem navegador e o único que sobrevive a uma reescrita.
   =========================================================== */

/* ---------- CRIPTOGRAFIA (Web Crypto API) ---------- */
const ENC_ITER = 100000;
async function gerarChave(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(pin), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: ENC_ITER, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function encriptar(texto, pin) {
  if (!texto) return "";
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chave = await gerarChave(pin, salt);
  const enc = new TextEncoder();
  const buffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, chave, enc.encode(texto));
  
  const comp = new Uint8Array(salt.length + iv.length + buffer.byteLength);
  comp.set(salt, 0);
  comp.set(iv, salt.length);
  comp.set(new Uint8Array(buffer), salt.length + iv.length);
  return btoa(String.fromCharCode(...comp));
}

async function desencriptar(cifraB64, pin) {
  if (!cifraB64) return "";
  try {
    const dec = atob(cifraB64);
    const comp = new Uint8Array(dec.length);
    for (let i = 0; i < dec.length; i++) comp[i] = dec.charCodeAt(i);
    
    const salt = comp.slice(0, 16);
    const iv = comp.slice(16, 28);
    const data = comp.slice(28);
    
    const chave = await gerarChave(pin, salt);
    const buffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, chave, data);
    return new TextDecoder().decode(buffer);
  } catch (e) {
    throw new Error("PIN incorreto ou dados corrompidos.");
  }
}

/* ---------- DOMÍNIO: DESPESAS ---------- */
function salvarDespesa(item) {
  if (!item.id) item.id = Date.now().toString(36) + Math.random().toString(36).substring(2);
  const idx = despesas.findIndex(d => d.id === item.id);
  if (idx > -1) despesas[idx] = item;
  else despesas.push(item);
  despesas.sort((a,b) => new Date(b.data) - new Date(a.data));
  pintar();
  agendarSalvar();
}

function excluirDespesa(id) {
  despesas = despesas.filter(d => d.id !== id);
  pintar();
  agendarSalvar();
}


/* ===========================================================
   2. PERSISTÊNCIA
   Grava com atraso: marcar cinco coisas seguidas vira UMA
   escrita, não cinco.
   =========================================================== */
let timerSalvar = null;
function agendarSalvar(){
  clearTimeout(timerSalvar);
  timerSalvar = setTimeout(() => {
    if (salvarDoc) salvarDoc(despesas).catch(e => aviso("Falha ao salvar: " + (e.code || e.message)));
    else { try { localStorage.setItem(NS + "_despesas", JSON.stringify(despesas)); } catch(e){} }
  }, 600);
}


/* ===========================================================
   3. TEMA
   Só troca o atributo data-tema no <html>; o resto é CSS.
   Grava nos dois lugares: no aparelho (instantâneo, funciona
   antes do login) e na conta (segue de aparelho para aparelho).
   =========================================================== */
const TEMAS = ["escuro", "claro"];
let tema = "escuro";
let salvarTema = null;

function aplicarTema(t, gravar){
  tema = TEMAS.includes(t) ? t : TEMAS[0];
  document.documentElement.setAttribute("data-tema", tema);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", tema === "claro" ? "#f1f4f8" : "#0a0d12");
  const b = el("btnTema");
  if (b) b.setAttribute("aria-label", "Mudar para o tema " + (tema === "claro" ? "escuro" : "claro"));
  try { localStorage.setItem(NS + "_tema", tema); } catch(e){}
  if (gravar && salvarTema) salvarTema(tema).catch(() => {});
}
try { aplicarTema(localStorage.getItem(NS + "_tema") || "escuro", false); }
catch(e){ aplicarTema("escuro", false); }


/* ===========================================================
   4. RENDER  <<< ESCREVA AQUI
   Funções pintarX() que redesenham a partir do estado.
   Mudou estado, chame a pintura. Nada observa por você.
   =========================================================== */
function pintar(){ pintarLista(); pintarRelatorios(); }

function pintarLista(){
  const alvo = el("listaLancamentos"); if (!alvo) return;
  const q = el("q") ? el("q").value : "";
  const vis = despesas.filter(i => (i.local + i.tipo).toLowerCase().includes(q.toLowerCase()));

  alvo.innerHTML = vis.length ? vis.map(cartao).join("")
    : `<div class="vazio"><b>Nada por aqui</b><span>Cadastre um lançamento.</span></div>`;
}

function cartao(i){
  return `<article class="card" style="margin-bottom:8px; padding:12px; background:var(--glass); border:1px solid var(--stroke);">
    <div style="display:flex; justify-content:space-between;">
      <div><b>${esc(i.local)}</b> <span class="sub">${esc(i.data)}</span></div>
      <b style="color:var(--ok)">R$ ${Number(i.valor).toFixed(2)}</b>
    </div>
    <div class="sub" style="margin-top:4px;">${esc(i.tipo)} ${i.peso ? '- ' + i.peso + 'kg' : ''}</div>
    <button class="btn d" style="margin-top:8px; padding:4px 8px;" data-excluir="${esc(i.id)}">Excluir</button>
  </article>`;
}

let chartInstancia = null;
function pintarRelatorios(){
  const ctx = el("graficoDashboard");
  const resumo = el("resumoDashboard");
  const divUnlock = el("unlockDashboard");
  const divContent = el("contentDashboard");
  
  if (!ctx || !resumo) return;

  if (sessaoSalario === null) {
    if (divUnlock) divUnlock.style.display = "block";
    if (divContent) divContent.style.display = "none";
    return;
  }
  
  if (divUnlock) divUnlock.style.display = "none";
  if (divContent) divContent.style.display = "block";

  // Agrupar por data e por local
  const dados = {};
  let totalConsumido = 0;
  let totalDescontado = 0;
  let totalPeso = 0;
  
  despesas.forEach(d => {
    if (!dados[d.data]) dados[d.data] = { sapore: 0, rei: 0, peso: 0 };
    if (d.local === "Sapore") {
      dados[d.data].sapore += Number(d.valor);
    } else if (d.local === "Rei do Mate") {
      dados[d.data].rei += Number(d.valor);
    }
    dados[d.data].peso += Number(d.peso);
    
    totalConsumido += Number(d.valor);
    totalPeso += Number(d.peso);
  });

  const labels = Object.keys(dados).sort();
  const dataConsumido = [];
  const dataDescontado = [];
  const dataPesos = [];

  labels.forEach(l => {
    const dia = dados[l];
    const valorDia = dia.sapore + dia.rei;
    
    let descDia = 0;
    if (dia.rei > 0) descDia += dia.rei; // Integral
    if (dia.sapore > 0) {
      descDia += (sessaoSalario * 0.0015) + Math.max(0, dia.sapore - 31.59);
    }
    
    dataConsumido.push(valorDia);
    dataDescontado.push(descDia);
    dataPesos.push(dia.peso);
    totalDescontado += descDia;
  });

  if (chartInstancia) chartInstancia.destroy();
  
  chartInstancia = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(l => l.split('-').reverse().join('/')),
      datasets: [
        { label: 'Consumido (R$)', data: dataConsumido, borderColor: '#ok', yAxisID: 'y' },
        { label: 'Desconto (R$)', data: dataDescontado, borderColor: '#warn', yAxisID: 'y' },
        { label: 'Consumo (Kg)', data: dataPesos, borderColor: '#ccc', borderDash: [5, 5], yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { type: 'linear', display: true, position: 'left' },
        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
      }
    }
  });

  const dias = labels.length || 1;
  const mediaGastos = (totalConsumido / dias).toFixed(2);
  const mediaDesconto = (totalDescontado / dias).toFixed(2);
  
  resumo.innerHTML = `
    <div class="panel">
      <h4>Resumo do Período</h4>
      <p><b>Total Consumido:</b> R$ ${totalConsumido.toFixed(2)}</p>
      <p><b>Total Descontado em Folha:</b> R$ ${totalDescontado.toFixed(2)}</p>
      <p><b>Economia / Subsídio:</b> R$ ${(totalConsumido - totalDescontado).toFixed(2)}</p>
      <p><b>Média Diária Consumo:</b> R$ ${mediaGastos} | <b>Desconto:</b> R$ ${mediaDesconto}</p>
      <p><b>Total em Quilos:</b> ${totalPeso.toFixed(3)} Kg</p>
    </div>
  `;
}

function badge(){} // vazio por enquanto


/* ===========================================================
   5. JANELA DE BAIXO E TOAST
   =========================================================== */
let idSheet = null;

function abrirSheet(id){
  const s = el(id); if(!s) return;
  el("scrim").classList.add("on");
  s.classList.add("on");
}

function abrirOpcoes(titulo, opcoes, aoEscolher){
  el("opTit").textContent = titulo;
  el("opLista").innerHTML = opcoes.map(o =>
    `<button class="opt" data-op="${esc(o.v)}">${esc(o.r)}</button>`).join("");
  el("opLista").onclick = e => {
    const b = e.target.closest("[data-op]"); if (!b) return;
    fecharSheet(); aoEscolher(b.dataset.op);
  };
  el("scrim").classList.add("on");
  el("opSheet").classList.add("on");
}

function fecharSheet(){
  el("scrim").classList.remove("on");
  document.querySelectorAll(".sheet").forEach(s => s.classList.remove("on"));
  idSheet = null;
}

let timerToast = null;
function aviso(msg){
  const t = el("toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove("on"), 3000);
}


/* ===========================================================
   6. EVENTOS
   UM listener no document. Interação identificada por data-*.
   Ao acrescentar um botão, acrescente um data- novo — não um
   addEventListener novo. É isso que faz conteúdo redesenhado
   continuar funcionando sem religar nada.
   =========================================================== */
document.addEventListener("click", e => {
  const tab = e.target.closest("[data-scr]");
  if (tab){
    document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("on", b === tab));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    el("scr-" + tab.dataset.scr)?.classList.add("active");
    el("ctxLabel").textContent =
      { inicio:"Lançamentos", relatorios:"Relatórios", perfil:"Perfil" }[tab.dataset.scr] || "";
    window.scrollTo({ top:0 });
    return;
  }
  
  const exc = e.target.closest("[data-excluir]");
  if (exc){ e.stopPropagation(); return excluirDespesa(exc.dataset.excluir); }

  const ab = e.target.closest("[data-abrir]");
  if (ab) return abrirSheet(ab.dataset.abrir);

  // ---- painel de acessos (admin) ----
  const ap = e.target.closest("[data-aprovar]"); if (ap) return decidir(ap.dataset.aprovar, "aprovado");
  const ng = e.target.closest("[data-negar]");   if (ng) return decidir(ng.dataset.negar, "negado");
  const lt = e.target.closest("[data-lote]");    if (lt) return decidirLote(lt.dataset.lote);
  const sa = e.target.closest("[data-selall]");  if (sa) return marcarTodos(sa.dataset.selall === "1");
  const ps = e.target.closest("[data-selac]");   if (ps) return alternarSel(ps.dataset.selac);
});

// --- Formulário de Lançamento ---
const btnSalvarL = el("btnSalvarL");
if (btnSalvarL) {
  btnSalvarL.addEventListener("click", () => {
    const id = el("f-id").value;
    const data = el("f-data").value;
    const local = el("f-local").value;
    const tipo = el("f-tipo").value;
    const peso = parseFloat(el("f-peso").value) || 0;
    const valor = parseFloat(el("f-valor").value) || 0;
    
    if (!data || !valor) return aviso("Preencha data e valor.");
    
    salvarDespesa({ id, data, local, tipo, peso, valor });
    fecharSheet();
    aviso("Lançamento salvo.");
  });
}

// --- OCR ---
const fileOcr = el("fileOcr");
if (fileOcr) {
  fileOcr.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    el("ocrFeedback").style.display = "block";
    try {
      const worker = await Tesseract.createWorker('por');
      const ret = await worker.recognize(file);
      await worker.terminate();
      
      const texto = ret.data.text;
      const match = texto.match(/\d{1,3}(?:[.,]\d{2})/g);
      let maiorValor = 0;
      if (match) {
        maiorValor = Math.max(...match.map(m => parseFloat(m.replace(',','.'))));
      }
      
      fileOcr.value = "";
      el("ocrFeedback").style.display = "none";
      fecharSheet();
      
      el("f-id").value = "";
      el("f-data").value = new Date().toISOString().split("T")[0];
      el("f-valor").value = maiorValor > 0 ? maiorValor : "";
      el("f-peso").value = "";
      abrirSheet("sheet-lancamento");
      aviso("OCR finalizado. Revise os dados.");
      
    } catch(err) {
      el("ocrFeedback").style.display = "none";
      aviso("Erro no OCR.");
      console.error(err);
    }
  });
}

// --- Criptografia de Salário ---
const btnSalvarSalario = el("btnSalvarSalario");
if (btnSalvarSalario) {
  btnSalvarSalario.addEventListener("click", async () => {
    const pin = el("inputPin").value;
    const salario = el("inputSalario").value;
    if (!pin || !salario) return aviso("Preencha o PIN e o Salário.");
    
    try {
      const cifra = await encriptar(salario, pin);
      localStorage.setItem(NS + "_salario", cifra);
      el("msgSalario").textContent = "Salário criptografado com sucesso!";
      el("msgSalario").style.color = "var(--ok)";
      
      // Se acabou de salvar, já desbloqueia para uso imediato no Dashboard
      sessaoSalario = Number(salario);
    } catch (err) {
      aviso("Erro ao encriptar.");
    }
  });
}

// --- Desbloqueio Dashboard ---
const btnUnlockDashboard = el("btnUnlockDashboard");
if (btnUnlockDashboard) {
  btnUnlockDashboard.addEventListener("click", async () => {
    const pin = el("inputPinDashboard").value;
    const msg = el("msgUnlockDashboard");
    if (!pin) return msg.textContent = "Digite o PIN.";
    
    const cifra = localStorage.getItem(NS + "_salario");
    if (!cifra) return msg.textContent = "Você ainda não salvou o salário no Perfil.";
    
    try {
      msg.textContent = "Descriptografando...";
      const sal = await desencriptar(cifra, pin);
      sessaoSalario = Number(sal);
      el("inputPinDashboard").value = "";
      pintarRelatorios();
    } catch(err) {
      msg.textContent = "PIN incorreto ou dados corrompidos.";
    }
  });
}

el("scrim").addEventListener("click", fecharSheet);
el("btnTema").addEventListener("click", () => aplicarTema(tema === "claro" ? "escuro" : "claro", true));
el("shBtn").addEventListener("click", () => { if (idSheet){ alternar(idSheet); abrirSheet(idSheet); } });
el("q").addEventListener("input", pintarLista);
el("qLimpa").addEventListener("click", () => { el("q").value = ""; pintarLista(); el("q").focus(); });
el("btnAcessos")?.addEventListener("click", () => {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  el("scr-acessos").classList.add("active");
  el("ctxLabel").textContent = "Gerenciar acessos";
  window.scrollTo({ top:0 });
  listarPedidos();
});
el("acVoltar")?.addEventListener("click", () => document.querySelector('#nav [data-scr="perfil"]')?.click());
el("segAc")?.addEventListener("click", e => {
  const b = e.target.closest("button[data-st]"); if (!b) return;
  stAc = b.dataset.st; selAc.clear();
  [...el("segAc").children].forEach(x => x.classList.toggle("on", x === b));
  pintarAc();
});
el("q-ac")?.addEventListener("input", e => { qAc = e.target.value; pintarAc(); });
el("espRecarregar").addEventListener("click", () => location.reload());
el("espSair").addEventListener("click", () => auth ? auth.signOut().then(() => location.reload()) : location.reload());


/* ===========================================================
   7. FIREBASE — auth, portaria e sincronização
   =========================================================== */
async function iniciar(){
  if (!CONFIGURADO){
    el("gateLoad").style.display = "none";
    el("gateBtn").style.display = "block";
    el("offMsg").style.display = "block";
    el("offMsg").innerHTML = "Firebase ainda não configurado — o botão abre em <b>modo local</b>.";
    el("btnLogin").addEventListener("click", () => {
      try { SEL = new Set(JSON.parse(localStorage.getItem(NS + "_sel") || "[]")); } catch(e){}
      entrar({ displayName:"Modo local", email:"salvo neste aparelho", photoURL:"", uid:"local" }, ["member"]);
    });
    return;
  }

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
          setPersistence, browserLocalPersistence }
    = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
  const { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp,
          collection, query, where, getDocs, writeBatch }
    = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app); db = getFirestore(app);
  await setPersistence(auth, browserLocalPersistence);

  el("btnLogin").addEventListener("click", async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch(e){ aviso("Não deu pra entrar: " + e.code); }
  });
  el("btnLogout").addEventListener("click", () => signOut(auth).then(() => location.reload()));

  onAuthStateChanged(auth, async u => {
    if (!u){
      el("gateLoad").style.display = "none";
      el("gateBtn").style.display = "block";
      el("gate").classList.add("on"); el("app").style.display = "none";
      return;
    }

    // perfil, papéis e situação
    const refU = doc(db, "users", u.uid);
    let snap = await getDoc(refU);
    if (!snap.exists()){
      await setDoc(refU, {
        nome: u.displayName || "", email: u.email || "", foto: u.photoURL || "",
        roles: ["member"], status: "pendente", criadoEm: serverTimestamp()
      });
      snap = await getDoc(refU);
    }
    const dados = snap.data() || {};

    salvarTema = t => updateDoc(refU, { tema: t });
    if (dados.tema && !localStorage.getItem(NS + "_tema")) aplicarTema(dados.tema, false);

    papeis = dados.roles || ["member"];
    if (dados.papel === "admin" && !papeis.includes("admin")) papeis = [...papeis, "admin"];
    situacao = dados.status || "pendente";

    // PORTARIA: só quem foi aprovado passa
    if (situacao !== "aprovado") return mostrarEspera(u, situacao);

    // estado do usuário, em tempo real
    const refD = doc(db, COLECAO, u.uid);
    salvarDoc = ids => setDoc(refD, { ids, atualizadoEm: serverTimestamp() }, { merge:true });
    onSnapshot(refD, s => {
      const ids = (s.exists() && s.data().ids) || [];
      // guard contra o eco da própria escrita
      if (JSON.stringify([...SEL].sort()) !== JSON.stringify([...ids].sort())){
        SEL = new Set(ids); pintar();
      }
    });

    apiAdmin = { db, doc, updateDoc, collection, query, where, getDocs, writeBatch, onSnapshot };
    entrar(u, papeis);
    listarPedidos();
    vigiarPedidos();
  });
}

function mostrarEspera(u, st){
  el("gate").classList.remove("on");
  el("app").style.display = "none";
  el("espera").classList.add("on");
  el("espMail").textContent = u.email || "";
  el("espTit").textContent  = st === "negado" ? "Acesso não liberado" : "Aguardando liberação";
  el("espTxt").textContent  = st === "negado"
    ? "O administrador não liberou este e-mail."
    : "Seu pedido chegou. Assim que liberarem, toque em “Já fui liberado”.";
}

function entrar(u, roles){
  usuario = u; papeis = roles;
  el("gate").classList.remove("on");
  el("espera").classList.remove("on");
  el("app").style.display = "block";

  const foto = u.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  el("avatar").src = foto; el("pAvatar").src = foto;
  el("pNome").textContent = u.displayName || "—";
  el("pMail").textContent = u.email || "—";
  el("pRoles").innerHTML = roles.map(r =>
    `<span class="role ${r === "admin" ? "admin" : ""}">${esc(r)}</span>`).join("");

  // hub por papéis: a ferramenta nem é renderizada para quem não tem o papel
  el("painelAcesso").style.display = roles.includes("admin") ? "block" : "none";
  el("syncMsg").textContent = CONFIGURADO
    ? "Ligado à nuvem. O que você marcar aparece igual em qualquer aparelho."
    : "Modo local: salvo só neste navegador.";
  aplicarTema(tema, false);
  pintar();
}


/* ===========================================================
   8. PAINEL DE ACESSOS (só admin)
   Busca, abas por situação, ação em lote e sinalização de
   pedido novo em tempo real.
   =========================================================== */
let apiAdmin = null, vigia = null;
let USERS = [], stAc = "pendente", qAc = "", selAc = new Set();
const VAZIO_AC = { pendente:"Nenhum pedido no momento.",
                   aprovado:"Ninguém liberado ainda além de você.",
                   negado:"Nenhum acesso negado." };
const sit = u => u.status || "pendente";

async function listarPedidos(){
  if (!apiAdmin || !papeis.includes("admin")) return;
  const { db, collection, getDocs } = apiAdmin;
  try {
    const qs = await getDocs(collection(db, "users"));
    USERS = [];
    qs.forEach(d => { if (d.id !== usuario.uid) USERS.push({ id:d.id, ...d.data() }); });
  } catch(e){ return aviso("Não deu pra ler a lista: " + (e.code || e.message)); }
  contarAc(); pintarAc();
}

function contarAc(){
  const n = st => USERS.filter(u => sit(u) === st).length;
  const p = n("pendente"), l = n("aprovado"), g = n("negado");
  const põe = (id, v) => { const x = el(id); if (x) x.textContent = v; };
  põe("cPend", p); põe("cLib", l); põe("cNeg", g);
  põe("acPlacar", `${p} pedidos · ${l} liberados · ${g} negados`);
  sinalizar(p);
}

/** aviso de "tem gente esperando", no espírito de mensagem não lida */
function sinalizar(n){
  const nb = el("navBadgePerfil");
  if (nb){ nb.style.display = n ? "grid" : "none"; nb.textContent = n > 9 ? "9+" : n; }
  const pb = el("pendBadge");
  if (pb){ pb.style.display = n ? "inline-block" : "none"; pb.textContent = n; }
  const bt = el("btnAcessosTxt");
  if (bt) bt.textContent = n ? (n === 1 ? "Ver o pedido" : "Ver os " + n + " pedidos")
                             : "Gerenciar acessos";
}

/** se alguém pedir acesso com o app aberto, a bolinha aparece sozinha */
function vigiarPedidos(){
  if (!apiAdmin || !papeis.includes("admin") || vigia) return;
  const { db, collection, query, where, onSnapshot } = apiAdmin;
  try {
    vigia = onSnapshot(query(collection(db, "users"), where("status", "==", "pendente")),
      s => { let n = 0; s.forEach(d => { if (d.id !== usuario.uid) n++; });
             sinalizar(n); listarPedidos(); },
      () => {});
  } catch(e){}
}

function visiveisAc(){
  const t = chave(qAc).trim();
  return USERS.filter(u => sit(u) === stAc)
    .filter(u => !t || chave((u.nome || "") + " " + (u.email || "")).includes(t))
    .sort((a,b) => String(a.nome||"").localeCompare(String(b.nome||""), "pt"));
}

function pintarAc(){
  const lista = el("listaAc"); if (!lista) return;
  const vis = visiveisAc();
  const total = USERS.filter(u => sit(u) === stAc).length;
  const modoLote = selAc.size > 0;

  lista.innerHTML = vis.length ? vis.map(u => {
    const on = selAc.has(u.id);
    const ini = String(u.nome || u.email || "?").trim()[0].toUpperCase();
    return `<div class="linha ${on ? "sel" : ""}" data-selac="${u.id}">
      <div class="chk ${on ? "on" : ""}">✓</div>
      ${u.foto ? `<img src="${esc(u.foto)}" alt="">` : `<div class="ini">${esc(ini)}</div>`}
      <div class="qm"><b>${esc(u.nome || "sem nome")}</b><span>${esc(u.email || "")}</span></div>
      ${modoLote ? "" : `<div class="acoes">${acoesDe(stAc, u.id)}</div>`}
    </div>`;
  }).join("") : `<div class="vazio"><b>${total && qAc ? "Ninguém com esse nome" : VAZIO_AC[stAc]}</b></div>`;

  const bar = el("loteBar");
  bar.style.display = selAc.size ? "flex" : "none";
  el("loteN").textContent = selAc.size + (selAc.size === 1 ? " selecionado" : " selecionados");
  el("loteAcoes").innerHTML = acoesLote(stAc);
}

function acoesDe(st, id){
  if (st === "pendente") return `<button class="mini ok" data-aprovar="${id}">Liberar</button>
                                 <button class="mini no" data-negar="${id}">Negar</button>`;
  if (st === "aprovado") return `<button class="mini no" data-negar="${id}">Remover</button>`;
  return `<button class="mini" data-aprovar="${id}">Liberar</button>`;
}
function acoesLote(st){
  if (st === "pendente") return `<button class="mini ok" data-lote="aprovado">Liberar</button>
                                 <button class="mini no" data-lote="negado">Negar</button>`;
  if (st === "aprovado") return `<button class="mini no" data-lote="negado">Remover</button>`;
  return `<button class="mini" data-lote="aprovado">Liberar</button>`;
}

function alternarSel(id){ selAc.has(id) ? selAc.delete(id) : selAc.add(id); pintarAc(); }
function marcarTodos(ligar){
  visiveisAc().forEach(u => ligar ? selAc.add(u.id) : selAc.delete(u.id));
  pintarAc();
}

async function decidir(uid, novo){
  if (!apiAdmin) return;
  const { db, doc, updateDoc } = apiAdmin;
  try {
    await updateDoc(doc(db, "users", uid), { status: novo });
    const u = USERS.find(x => x.id === uid); if (u) u.status = novo;
    selAc.delete(uid);
    aviso(novo === "aprovado" ? "Liberado." : "Acesso removido.");
    contarAc(); pintarAc();
  } catch(e){ aviso("Não deu: " + (e.code || e.message)); }
}

/** blocos de 400 porque um lote do Firestore aceita no máximo 500 */
async function decidirLote(novo){
  if (!apiAdmin || !selAc.size) return;
  const { db, doc, writeBatch } = apiAdmin;
  const ids = [...selAc];
  try {
    for (let i = 0; i < ids.length; i += 400){
      const b = writeBatch(db);
      ids.slice(i, i + 400).forEach(id => b.update(doc(db, "users", id), { status: novo }));
      await b.commit();
    }
    ids.forEach(id => { const u = USERS.find(x => x.id === id); if (u) u.status = novo; });
    selAc.clear();
    aviso(ids.length + (ids.length === 1 ? " pessoa atualizada." : " pessoas atualizadas."));
    contarAc(); pintarAc();
  } catch(e){ aviso("Não deu: " + (e.code || e.message)); }
}


iniciar();
