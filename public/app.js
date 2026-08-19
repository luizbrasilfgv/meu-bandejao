/* ===========================================================
   MEU BANDEJÃO — app.js
   Vanilla ES6 + Firebase (Auth / Firestore). Sem framework.
   Seções conforme scratch/kit-app/PADRAO.md.
   -----------------------------------------------------------
   O DOM manda: os seletores daqui são os do design do Claude
   (index.html / styles.css). Não invente id novo sem criar o
   elemento — foi exatamente isso que quebrou a versão anterior.
   =========================================================== */

/* ===========================================================
   0. CONFIG
   =========================================================== */

/* Este bloco é PÚBLICO por natureza: ele identifica o projeto,
   não autoriza nada. A segurança está nas Firestore Rules. */
const firebaseConfig = {
  projectId: "meu-vale",
  appId: "1:567187664062:web:6b7df83b6931e01de042ef",
  storageBucket: "meu-vale.firebasestorage.app",
  apiKey: "AIzaSyDWMwgfxXkjr-ATvG-cY0cL0GJEaZWXnFA",
  authDomain: "meu-vale.firebaseapp.com",
  messagingSenderId: "567187664062"
};

/* Falso = MODO LOCAL: entra sem Google e salva só no aparelho.
   NUNCA publique em falso. */
const CONFIGURADO = !String(firebaseConfig.apiKey).startsWith("COLE_");

/* Prefixo das chaves no localStorage. */
const NS = "meu_bandejao";

/* Coleções. Se mudar aqui, mude o firestore.rules junto. */
const COL_LANC = "lancamentos";
const COL_POL  = "politicas";
const DOC_POL  = "vigentes";

/* Regra do RH usada quando o banco ainda não tem política. */
const TETO_PADRAO = 31.59;   // R$ por refeição subsidiada na Sapore
const TAXA_PADRAO = 0.15;    // % do salário base por ida — guardada, NÃO aplicada

const LOCAIS = ["Sapore", "Rei do Mate"];
const CATEGORIAS = ["Refeição — almoço", "Refeição — jantar", "Café / lanche", "Outro"];

/* Donos do app: entram já aprovados e administradores, sem passar pela
   portaria. Sem isto, o primeiro usuário nasce pendente e não existe
   ninguém para liberá-lo — o ovo e a galinha que obrigava a editar o
   documento à mão no console.
   Esta lista é COSMÉTICA: quem garante é a função donos() do
   firestore.rules. Mudou aqui, mude lá. */
const DONOS = ["luiz.brasil@fgv.br", "luizbrasil.rj@gmail.com"];
const ehDono = email => DONOS.includes(String(email || "").trim().toLowerCase());

/* ---------- estado global ---------- */
let usuario     = null;
let papeis      = [];
let situacao    = "pendente";
let lancamentos = [];                       // o estado do app
let politicas   = [];                       // regras do RH, por vigência
let prefs       = { alertaLimite: true, lembreteRecibo: false, tetoMensal: null,
                    matricula: "", cnpjLocal: {} };
let periodo     = { preset: "atual", inicio: "", fim: "" };
let verTudo     = false;
let modoSheet   = "scan";                   // scan | manual | editar
let editandoId  = "";

let db = null, auth = null, salvarDoc = null, salvarPerfil = null;

/* ---------- utilitários ---------- */
const el  = id => document.getElementById(id);
const qs  = s  => document.querySelector(s);
const qsa = s  => [...document.querySelectorAll(s)];
const esc = s  => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const chave = s => String(s ?? "").normalize("NFD")
  .replace(/[̀-ͯ]/g, "").toLowerCase();

const num = n => Number(n) || 0;
const brl = n => num(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad2 = n => String(n).padStart(2, "0");

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
               "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const MES_CURTO = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
                   "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function hojeIso(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function agoraIso(){
  const d = new Date();
  return `${hojeIso()}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
/** "2026-08-19T12:34" -> "19/08/2026 12:34" */
function paraBR(dataHora){
  const [d, h] = String(dataHora || "").split("T");
  if (!d) return "";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}` + (h ? ` ${h.slice(0, 5)}` : "");
}
/** "19/08/2026 12:34" -> "2026-08-19T12:34" (vazio se inválido) */
function paraIso(texto){
  const t = String(texto || "").trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (!m) return "";
  const [, dia, mes, ano, hh, mm] = m;
  if (+mes < 1 || +mes > 12 || +dia < 1 || +dia > 31) return "";
  return `${ano}-${pad2(mes)}-${pad2(dia)}` + (hh ? `T${pad2(hh)}:${mm}` : "T12:00");
}
/** "1.234,56" ou "28,90" ou "28.90" -> Number */
function paraValor(texto){
  const t = String(texto || "").replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const v = parseFloat(t);
  return isFinite(v) ? v : NaN;
}
const dataDe = l => String(l.dataHora || "").slice(0, 10);
const horaDe = l => String(l.dataHora || "").slice(11, 16);


/* ===========================================================
   1. DOMÍNIO
   Lógica pura, SEM tocar no DOM. É o único pedaço que dá para
   testar sem navegador e o único que sobrevive a uma reescrita.
   =========================================================== */

/** A política vigente na data informada. */
function politicaEm(dataIso){
  const ordenadas = [...politicas].sort((a, b) => String(a.vigencia).localeCompare(String(b.vigencia)));
  let ativa = { id: "padrao", vigencia: "2020-01-01", teto: TETO_PADRAO, taxaPct: TAXA_PADRAO };
  for (const p of ordenadas) if (dataIso >= p.vigencia) ativa = p;
  return ativa;
}

/**
 * Quanto deste lançamento cai como desconto em folha.
 * Sapore: a FGV subsidia até o teto; o colaborador é descontado no excedente.
 * Rei do Mate: pago integralmente pelo colaborador.
 * NÃO inclui a taxa de 0,15% do salário base — exigiria o salário, que o app não pede.
 */
function descontoDe(l){
  const valor = num(l.valor);
  if (l.local === "Sapore") return Math.max(0, valor - num(politicaEm(dataDe(l)).teto));
  return valor;
}

/** Consolidado: bruto (o que gastou), desconto (folha) e subsídio (FGV). */
function resumo(lista){
  const r = { n: lista.length, bruto: 0, desconto: 0, subsidio: 0, revisar: 0, porLocal: {} };
  for (const nome of LOCAIS) r.porLocal[nome] = { n: 0, bruto: 0, desconto: 0 };

  for (const l of lista){
    const bruto = num(l.valor);
    const desc  = descontoDe(l);
    r.bruto += bruto;
    r.desconto += desc;
    if (l.status === "revisar") r.revisar++;
    const alvo = r.porLocal[l.local] || (r.porLocal[l.local] = { n: 0, bruto: 0, desconto: 0 });
    alvo.n++; alvo.bruto += bruto; alvo.desconto += desc;
  }
  r.subsidio = r.bruto - r.desconto;
  return r;
}

/** Filtro por intervalo de datas, inclusive nas pontas. */
function noPeriodo(lista, ini, fim){
  return lista.filter(l => { const d = dataDe(l); return d && d >= ini && d <= fim; });
}

/** As lanchonetes enviam por quinzena: 01–15 e 16 ao último dia. */
function quinzenaDe(dataIso){ return Number(dataIso.slice(8, 10)) <= 15 ? 1 : 2; }

function ultimoDia(ano, mes){ return new Date(ano, mes, 0).getDate(); }

function limitesQuinzena(ano, mes, q){
  return q === 1
    ? { ini: `${ano}-${pad2(mes)}-01`, fim: `${ano}-${pad2(mes)}-15` }
    : { ini: `${ano}-${pad2(mes)}-16`, fim: `${ano}-${pad2(mes)}-${pad2(ultimoDia(ano, mes))}` };
}

/** As últimas N quinzenas, da mais antiga para a mais nova. */
function ultimasQuinzenas(refIso, quantas){
  let ano = Number(refIso.slice(0, 4)), mes = Number(refIso.slice(5, 7)), q = quinzenaDe(refIso);
  const saida = [];
  for (let i = 0; i < (quantas || 3); i++){
    const lim = limitesQuinzena(ano, mes, q);
    saida.unshift({
      ano, mes, q, ...lim,
      rotulo: q === 1 ? `01–15 ${MES_CURTO[mes - 1]}` : `16–${ultimoDia(ano, mes)} ${MES_CURTO[mes - 1]}`
    });
    if (q === 1){ q = 2; mes--; if (mes === 0){ mes = 12; ano--; } } else { q = 1; }
  }
  return saida;
}

/** Soma por dia, para o gráfico de evolução. */
function porDia(lista){
  const mapa = new Map();
  for (const l of lista){
    const d = dataDe(l);
    const atual = mapa.get(d) || { data: d, bruto: 0, desconto: 0, n: 0 };
    atual.bruto += num(l.valor); atual.desconto += descontoDe(l); atual.n++;
    mapa.set(d, atual);
  }
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/** Soma por mês (YYYY-MM), para a aba "Por mês" do gráfico. */
function porMes(lista){
  const mapa = new Map();
  for (const l of lista){
    const m = dataDe(l).slice(0, 7);
    const atual = mapa.get(m) || { data: m, bruto: 0, desconto: 0, n: 0 };
    atual.bruto += num(l.valor); atual.desconto += descontoDe(l); atual.n++;
    mapa.set(m, atual);
  }
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/** Dias de segunda a sexta no intervalo. Sem base de feriados: é aproximação. */
function diasUteis(ini, fim){
  if (!ini || !fim || ini > fim) return 0;
  const d = new Date(ini + "T12:00"), f = new Date(fim + "T12:00");
  let n = 0;
  while (d <= f){
    const s = d.getDay();
    if (s >= 1 && s <= 5) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

function estatisticas(lista, ini, fim){
  const r = resumo(lista);
  const dias = porDia(lista);
  const uteisTotal = diasUteis(ini, fim);
  const hoje = hojeIso();
  const uteisCorridos = diasUteis(ini, hoje < fim ? hoje : fim);
  const comConsumo = dias.length;
  const maior = dias.reduce((a, b) => (b.bruto > (a ? a.bruto : -1) ? b : a), null);

  return {
    ...r,
    dias, uteisTotal, uteisCorridos, comConsumo,
    mediaDiaUtil: comConsumo ? r.bruto / comConsumo : 0,
    projetado: uteisCorridos > 0 ? (r.bruto / uteisCorridos) * uteisTotal : 0,
    maiorDia: maior,
    ritmoPct: uteisTotal ? Math.min(100, Math.round((uteisCorridos / uteisTotal) * 100)) : 0,
    uteisRestantes: Math.max(0, uteisTotal - uteisCorridos)
  };
}

/** Limites e rótulo do período selecionado. */
function limitesPeriodo(){
  const hoje = new Date();
  let ano = hoje.getFullYear(), mes = hoje.getMonth() + 1;

  if (periodo.preset === "custom" && periodo.inicio && periodo.fim){
    const [a, b] = periodo.inicio <= periodo.fim
      ? [periodo.inicio, periodo.fim] : [periodo.fim, periodo.inicio];
    return { ini: a, fim: b, rotulo: `${paraBR(a).slice(0, 5)} – ${paraBR(b).slice(0, 5)}` };
  }
  if (periodo.preset === "anterior"){ mes--; if (mes === 0){ mes = 12; ano--; } }

  const fim = ultimoDia(ano, mes);
  return {
    ini: `${ano}-${pad2(mes)}-01`,
    fim: `${ano}-${pad2(mes)}-${pad2(fim)}`,
    rotulo: `01 – ${fim} ${MES_CURTO[mes - 1]} ${ano}`,
    ano, mes
  };
}

/** O período imediatamente anterior, do mesmo tamanho — para a variação. */
function periodoAnterior(ini, fim){
  const d1 = new Date(ini + "T12:00"), d2 = new Date(fim + "T12:00");
  const dias = Math.round((d2 - d1) / 86400000) + 1;
  const f = new Date(d1); f.setDate(f.getDate() - 1);
  const i = new Date(f);  i.setDate(i.getDate() - dias + 1);
  const iso = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return { ini: iso(i), fim: iso(f) };
}

function ordenar(lista){
  return [...lista].sort((a, b) => String(b.dataHora).localeCompare(String(a.dataHora)));
}

function novoId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** CSV do que está filtrado na tela, com a memória de cálculo em cada linha. */
function paraCSV(lista){
  const cab = ["data", "hora", "local", "categoria", "valor", "teto_vigente",
               "desconto_folha", "subsidio_fgv", "itens", "matricula",
               "numero_cupom", "cnpj", "observacao", "origem", "status"];
  const linhas = ordenar(lista).map(l => {
    const teto = num(politicaEm(dataDe(l)).teto);
    const desc = descontoDe(l);
    return [
      dataDe(l), horaDe(l), l.local, l.categoria,
      num(l.valor).toFixed(2), teto.toFixed(2), desc.toFixed(2), (num(l.valor) - desc).toFixed(2),
      l.itens, l.matricula, l.numeroCupom, l.cnpj, l.observacao, l.origem, l.status
    ].map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";");
  });
  return [cab.join(";"), ...linhas].join("\r\n");
}


/* ---------- mutações de estado ---------- */

function salvarLancamento(item){
  if (!item.id) item.id = novoId();
  const i = lancamentos.findIndex(l => l.id === item.id);
  if (i > -1) lancamentos[i] = { ...lancamentos[i], ...item };
  else lancamentos.push({ ...item, criadoEm: new Date().toISOString() });
  lancamentos = ordenar(lancamentos);
  pintar();
  agendarSalvar();
  checarAlerta();
}

function excluirLancamento(id){
  lancamentos = lancamentos.filter(l => l.id !== id);
  pintar();
  agendarSalvar();
}

function salvarPolitica(p){
  if (!p.id) p.id = novoId();
  const i = politicas.findIndex(x => x.id === p.id);
  if (i > -1) politicas[i] = p; else politicas.push(p);
  politicas.sort((a, b) => String(a.vigencia).localeCompare(String(b.vigencia)));
  gravarPoliticas();
  pintar();
}

function excluirPolitica(id){
  politicas = politicas.filter(p => p.id !== id);
  gravarPoliticas();
  pintar();
}


/* ===========================================================
   2. PERSISTÊNCIA
   Grava com atraso: cinco toques seguidos viram UMA escrita.
   =========================================================== */
let timerSalvar = null;

function agendarSalvar(){
  clearTimeout(timerSalvar);
  timerSalvar = setTimeout(gravarAgora, 600);
}

function gravarAgora(){
  try { localStorage.setItem(NS + "_lancamentos", JSON.stringify(lancamentos)); } catch(e){}
  if (salvarDoc){
    salvarDoc(lancamentos).catch(e => aviso("Falha ao salvar na nuvem: " + (e.code || e.message)));
  }
}

function carregarLocal(){
  try {
    const bruto = localStorage.getItem(NS + "_lancamentos");
    if (bruto) lancamentos = ordenar(JSON.parse(bruto) || []);
  } catch(e){}
  try {
    const p = localStorage.getItem(NS + "_prefs");
    if (p) prefs = { ...prefs, ...JSON.parse(p) };
  } catch(e){}
  try {
    const pol = localStorage.getItem(NS + "_politicas");
    if (pol) politicas = JSON.parse(pol) || [];
  } catch(e){}
}

function gravarPrefs(){
  try { localStorage.setItem(NS + "_prefs", JSON.stringify(prefs)); } catch(e){}
  if (salvarPerfil) salvarPerfil({ prefs }).catch(() => {});
}

let gravarPoliticasRemoto = null;
function gravarPoliticas(){
  try { localStorage.setItem(NS + "_politicas", JSON.stringify(politicas)); } catch(e){}
  if (gravarPoliticasRemoto){
    gravarPoliticasRemoto(politicas)
      .catch(e => aviso("Só o administrador altera as políticas: " + (e.code || e.message)));
  }
}


/* ===========================================================
   3. RENDER
   Mudou estado, chame pintar(). Não existe nada observando.
   =========================================================== */
function pintar(){
  const { ini, fim, rotulo } = limitesPeriodo();
  const doPeriodo = noPeriodo(lancamentos, ini, fim);

  pintarHome(doPeriodo, ini, fim);
  pintarLista(doPeriodo);
  pintarEstatisticas(doPeriodo, ini, fim, rotulo);
  pintarConciliar();
  pintarPerfil();
  pintarPoliticas();
  pintarGraficos(doPeriodo);
}

function pintarHome(lista, ini, fim){
  const r = resumo(lista);
  const pol = politicaEm(fim);

  const meta = qs(".brand__meta");
  if (meta){
    const mes = Number(fim.slice(5, 7)), ano = fim.slice(0, 4);
    meta.textContent = `${MESES[mes - 1]} ${ano} · ${r.n} LANÇAMENTO${r.n === 1 ? "" : "S"}`;
  }

  const valor = qs(".hero__amount");
  if (valor) valor.innerHTML = `R$&thinsp;${brl(r.desconto)}`;

  // variação contra o período anterior de igual tamanho
  const alvoDelta = qs(".delta");
  if (alvoDelta){
    const ant = periodoAnterior(ini, fim);
    const rAnt = resumo(noPeriodo(lancamentos, ant.ini, ant.fim));
    if (!rAnt.desconto || !r.n){
      alvoDelta.hidden = true;
    } else {
      const pct = ((r.desconto - rAnt.desconto) / rAnt.desconto) * 100;
      alvoDelta.hidden = false;
      alvoDelta.textContent = `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1).replace(".", ",")}%`;
      alvoDelta.classList.toggle("delta--up", pct > 0);
      alvoDelta.title = `Comparado com ${paraBR(ant.ini).slice(0, 5)} – ${paraBR(ant.fim).slice(0, 5)}`;
    }
  }

  const nota = qs(".hero__note");
  if (nota){
    nota.textContent = r.n
      ? `${paraBR(ini).slice(0, 5)} a ${paraBR(fim).slice(0, 5)} · ${r.n} lançamento${r.n === 1 ? "" : "s"} · excedente acima do teto de R$ ${brl(pol.teto)} na Sapore, mais o integral do Rei do Mate.`
      : `${paraBR(ini).slice(0, 5)} a ${paraBR(fim).slice(0, 5)} · nenhum lançamento no período.`;
  }

  // quanto gastei x quanto a FGV cobriu
  const brutoEl = el("vBruto"), subEl = el("vSubsidio");
  if (brutoEl){
    brutoEl.textContent = r.n ? `R$ ${brl(r.bruto)}` : "—";
    brutoEl.classList.toggle("split__val--pending", !r.n);
  }
  if (subEl){
    subEl.textContent = r.n ? `R$ ${brl(r.subsidio)}` : "—";
    subEl.classList.toggle("split__val--pending", !r.n);
  }

  // quinzenas do mês em tela
  const ano = Number(fim.slice(0, 4)), mes = Number(fim.slice(5, 7));
  [1, 2].forEach(q => {
    const lim = limitesQuinzena(ano, mes, q);
    const rq = resumo(noPeriodo(lancamentos, lim.ini, lim.fim));
    const alvo = el("vQuinz" + q);
    const rot  = el("rQuinz" + q);
    if (rot) rot.textContent = `${q}ª QUINZENA · ${q === 1 ? "01–15" : "16–" + ultimoDia(ano, mes)}`;
    if (alvo){
      alvo.textContent = rq.n ? `R$ ${brl(rq.desconto)}` : "—";
      alvo.classList.toggle("split__val--pending", !rq.n);
    }
  });

  // barra Sapore x Rei do Mate (pelo valor gasto)
  const sap = r.porLocal["Sapore"] || { bruto: 0, n: 0 };
  const rei = r.porLocal["Rei do Mate"] || { bruto: 0, n: 0 };
  const fSap = el("mtSapore"), fRei = el("mtRei"), fVazio = el("mtVazio");
  if (fSap && fRei && fVazio){
    if (r.bruto > 0){
      fSap.style.flex = String((sap.bruto / r.bruto) * 100);
      fRei.style.flex = String((rei.bruto / r.bruto) * 100);
      fVazio.style.flex = "0";
    } else {
      fSap.style.flex = "0"; fRei.style.flex = "0"; fVazio.style.flex = "100";
    }
  }
  poe("lgSapore", `Sapore R$ ${brl(sap.bruto)}`);
  poe("lgRei", `Rei do Mate R$ ${brl(rei.bruto)}`);
}

function pintarLista(lista){
  const alvo = qs(".tx-list");
  if (!alvo) return;

  const ordenada = ordenar(lista);
  const mostradas = verTudo ? ordenada : ordenada.slice(0, 6);

  const btnTudo = el("btnVerTudo");
  if (btnTudo){
    btnTudo.hidden = ordenada.length <= 6;
    btnTudo.textContent = verTudo ? "VER MENOS" : "VER TUDO";
  }

  if (!mostradas.length){
    alvo.innerHTML = `<li class="glass row"><span class="row__body">
      <span class="row__label">Nenhum lançamento no período</span>
      <span class="row__hint">TOQUE EM ESCANEAR RECIBO OU LANÇAR MANUAL</span>
    </span></li>`;
    return;
  }

  alvo.innerHTML = mostradas.map(l => {
    const sapore = l.local === "Sapore";
    const revisar = l.status === "revisar";
    const hora = horaDe(l);
    const quando = dataDe(l) === hojeIso() ? `HOJE${hora ? " " + hora : ""}` : paraBR(l.dataHora);
    const meta = [l.categoria, quando].filter(Boolean).join(" · ").toUpperCase();
    return `<li>
      <button class="glass tx ${revisar ? "tx--pending" : ""}" type="button" data-editar="${esc(l.id)}">
        <span class="avatar ${sapore ? "avatar--blue" : ""}">${sapore ? "SA" : "RM"}</span>
        <span class="tx__body">
          <span class="tx__name">${esc(l.local)}</span>
          <span class="tx__meta">${esc(meta)}</span>
        </span>
        <span class="tx__side">
          <span class="tx__value">${brl(l.valor)}</span>
          <span class="tx__status ${revisar ? "tx__status--pending" : ""}">${revisar ? "REVISAR OCR" : "CONFERIDO"}</span>
        </span>
      </button>
    </li>`;
  }).join("");
}

function pintarEstatisticas(lista, ini, fim, rotulo){
  const e = estatisticas(lista, ini, fim);
  const temDado = e.n > 0;

  poe("periodoLabel", rotulo);

  const sap = e.porLocal["Sapore"] || { bruto: 0, n: 0 };
  const rei = e.porLocal["Rei do Mate"] || { bruto: 0, n: 0 };
  const pctSap = e.bruto ? Math.round((sap.bruto / e.bruto) * 100) : 0;

  poe("stSaporeVal", temDado ? brl(sap.bruto) : "—", !temDado);
  poe("stSaporeMeta", `${sap.n} REFEIÇ${sap.n === 1 ? "ÃO" : "ÕES"} · ${pctSap}%`);
  poe("stReiVal", temDado ? brl(rei.bruto) : "—", !temDado);
  poe("stReiMeta", `${rei.n} LANCHE${rei.n === 1 ? "" : "S"} · ${temDado ? 100 - pctSap : 0}%`);

  poe("stProjetado", temDado ? brl(e.projetado) : "—", !temDado);
  poe("stProjetadoMeta", temDado
    ? `NO RITMO DE ${e.comConsumo} DIA${e.comConsumo === 1 ? "" : "S"}`
    : "SEM DADO NO PERÍODO");

  poe("stMaiorDia", e.maiorDia ? brl(e.maiorDia.bruto) : "—", !e.maiorDia);
  poe("stMaiorDiaMeta", e.maiorDia
    ? `${paraBR(e.maiorDia.data).slice(0, 5)} · ${e.maiorDia.n} LANÇAMENTO${e.maiorDia.n === 1 ? "" : "S"}`
    : "SEM DADO NO PERÍODO");

  poe("stMedia", temDado ? `R$ ${brl(e.mediaDiaUtil)}` : "—", !temDado);
  poe("stLancamentos", String(e.n));
  poe("stRitmoHint", `${e.uteisCorridos} DE ${e.uteisTotal} DIAS ÚTEIS`);

  const f1 = el("mtRitmo"), f2 = el("mtRitmoVazio");
  if (f1 && f2){ f1.style.flex = String(e.ritmoPct); f2.style.flex = String(100 - e.ritmoPct); }
  poe("lgRitmo", `${e.ritmoPct}% do período percorrido`);
  poe("lgRitmoFalta", e.uteisRestantes ? `faltam ${e.uteisRestantes} dias úteis` : "período encerrado");
}

/** Escreve texto num id. Com o 3º argumento, marca como pendência. */
function poe(id, texto, pendente){
  const x = el(id);
  if (!x) return;
  x.textContent = texto;
  if (arguments.length > 2) x.classList.toggle("stat__val--pending", !!pendente);
}

function pintarConciliar(){
  const corpo = el("quinzCorpo");
  if (!corpo) return;
  corpo.innerHTML = ultimasQuinzenas(hojeIso(), 3).map(q => {
    const r = resumo(noPeriodo(lancamentos, q.ini, q.fim));
    return `<div class="quinz__row">
      <span>${esc(q.rotulo)}</span>
      <b class="${r.n ? "" : "quinz__pending"}">${r.n ? brl(r.desconto) : "—"}</b>
      <b class="quinz__pending">—</b>
    </div>`;
  }).join("");
}

function pintarPerfil(){
  if (usuario){
    const nome = usuario.displayName || usuario.email || "—";
    poe("pNome", nome);
    poe("pMail", usuario.email || "—");
    poe("pMatricula", prefs.matricula ? "MATRÍCULA " + prefs.matricula : "MATRÍCULA A INFORMAR");
    poe("pSaida", prefs.matricula || usuario.email || "");
    const av = el("pAvatar");
    if (av){
      if (usuario.photoURL){
        av.innerHTML = `<img src="${esc(usuario.photoURL)}" alt="">`;
      } else {
        av.textContent = nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
      }
    }
  }

  const teto = el("pTetoMensal");
  if (teto){
    teto.textContent = prefs.tetoMensal ? `R$ ${brl(prefs.tetoMensal)}` : "a informar";
    teto.classList.toggle("stat__val--pending", !prefs.tetoMensal);
  }

  const sw1 = el("swAlerta"), sw2 = el("swLembrete");
  if (sw1){
    sw1.classList.toggle("is-on", !!prefs.alertaLimite);
    sw1.setAttribute("aria-checked", prefs.alertaLimite ? "true" : "false");
  }
  if (sw2){
    sw2.classList.toggle("is-on", !!prefs.lembreteRecibo);
    sw2.setAttribute("aria-checked", prefs.lembreteRecibo ? "true" : "false");
  }

  const admin = papeis.includes("admin");
  qsa("[data-somente-admin]").forEach(x => { x.hidden = !admin; });

  const chips = el("pRoles");
  if (chips) chips.innerHTML = papeis.map(p =>
    `<span class="tag ${p === "admin" ? "" : "tag--ghost"}">${esc(p.toUpperCase())}</span>`).join(" ");
}

function pintarPoliticas(){
  const alvo = el("listaPol");
  if (!alvo) return;
  const ordenadas = [...politicas].sort((a, b) => String(b.vigencia).localeCompare(String(a.vigencia)));
  const vigente = politicaEm(hojeIso());

  alvo.innerHTML = ordenadas.length ? ordenadas.map(p => `
    <li class="glass row">
      <span class="row__body">
        <span class="row__label">Teto R$ ${brl(p.teto)} · taxa ${String(p.taxaPct).replace(".", ",")}%</span>
        <span class="row__hint">A PARTIR DE ${esc(paraBR(p.vigencia))}${p.id === vigente.id ? " · VIGENTE" : ""}</span>
      </span>
      <button class="link-btn" type="button" data-excpol="${esc(p.id)}">Remover</button>
    </li>`).join("")
    : `<li class="glass row"><span class="row__body">
        <span class="row__label">Nenhuma política cadastrada</span>
        <span class="row__hint">USANDO O PADRÃO: TETO R$ ${brl(TETO_PADRAO)} · TAXA ${String(TAXA_PADRAO).replace(".", ",")}%</span>
      </span></li>`;

  poe("polVigente", `Teto de R$ ${brl(vigente.teto)} por refeição na Sapore. A taxa de ${String(vigente.taxaPct).replace(".", ",")}% do salário base por ida fica registrada e fora da conta.`);
}

/** Avisa quando o gasto do período passa o teto mensal informado. */
let avisouLimite = false;
function checarAlerta(){
  if (!prefs.alertaLimite || !prefs.tetoMensal || avisouLimite) return;
  const { ini, fim } = limitesPeriodo();
  const r = resumo(noPeriodo(lancamentos, ini, fim));
  if (r.bruto > num(prefs.tetoMensal)){
    avisouLimite = true;
    aviso(`Você passou do teto mensal de R$ ${brl(prefs.tetoMensal)}.`);
  }
}


/* ===========================================================
   4. GRÁFICOS (Chart.js)
   =========================================================== */
let chartGastos = null, chartLocal = null, escalaGrafico = "dia";

function pintarGraficos(lista){
  if (typeof Chart === "undefined") return;

  const cor = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const azul  = cor("--fgv-blue") || "#2E7BD4";
  const ambar = cor("--amber") || "#FFB84D";
  const grade = "rgba(255,255,255,.07)";
  const texto = cor("--muted-2") || "#6B7B92";

  const serie = escalaGrafico === "mes" ? porMes(lista) : porDia(lista);
  const rotulos = serie.map(p => escalaGrafico === "mes"
    ? MES_CURTO[Number(p.data.slice(5, 7)) - 1]
    : p.data.slice(8, 10));

  const cvGastos = el("chartGastos");
  if (cvGastos){
    const box = el("chartBox");
    if (box) box.classList.toggle("has-data", serie.length > 0);
    if (chartGastos){ chartGastos.destroy(); chartGastos = null; }
    if (serie.length){
      chartGastos = new Chart(cvGastos, {
        type: "bar",
        data: {
          labels: rotulos,
          datasets: [
            { label: "Desconto em folha", data: serie.map(p => p.desconto), backgroundColor: ambar, borderRadius: 4 },
            { label: "Subsídio FGV", data: serie.map(p => p.bruto - p.desconto), backgroundColor: azul, borderRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => `${c.dataset.label}: R$ ${brl(c.parsed.y)}` } }
          },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: texto, font: { size: 9 } } },
            y: { stacked: true, grid: { color: grade },
                 ticks: { color: texto, font: { size: 9 }, callback: v => brl(v) } }
          }
        }
      });
    }
  }

  const r = resumo(lista);
  const cvLocal = el("chartPorLocal");
  if (cvLocal){
    const box = el("chartBoxLocal");
    if (box) box.classList.toggle("has-data", r.bruto > 0);
    if (chartLocal){ chartLocal.destroy(); chartLocal = null; }
    if (r.bruto > 0){
      chartLocal = new Chart(cvLocal, {
        type: "doughnut",
        data: {
          labels: LOCAIS,
          datasets: [{
            data: LOCAIS.map(n => (r.porLocal[n] || { bruto: 0 }).bruto),
            backgroundColor: [azul, ambar], borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "62%",
          plugins: {
            legend: { position: "bottom", labels: { color: texto, boxWidth: 10, font: { size: 10 } } },
            tooltip: { callbacks: { label: c => `${c.label}: R$ ${brl(c.parsed)}` } }
          }
        }
      });
    }
  }
}


/* ===========================================================
   5. JANELA DE BAIXO E TOAST
   Um sistema só: as classes do design (.sheet.is-open).
   =========================================================== */
function abrirSheet(id){
  const s = el(id);
  if (s) s.classList.add("is-open");
}
function fecharSheet(id){
  if (id){ const s = el(id); if (s) s.classList.remove("is-open"); return; }
  qsa(".sheet").forEach(s => s.classList.remove("is-open"));
}

let timerToast = null;
function aviso(msg){
  const t = el("toast");
  if (!t){ console.warn("[aviso]", msg); return; }
  t.textContent = msg;
  t.classList.add("is-on");
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove("is-on"), 3200);
}

/** Confirmação obrigatória — a spec exige para exclusão. */
let aoConfirmar = null;
function confirmar(titulo, texto, rotulo, acao){
  poe("cfTit", titulo);
  poe("cfTxt", texto);
  poe("cfOk", rotulo);
  aoConfirmar = acao;
  abrirSheet("sheetConfirma");
}

/** Sheet de um campo só (teto mensal, matrícula). */
let aoSalvarCampo = null;
function pedirCampo(titulo, rotulo, valor, tipo, acao){
  poe("cpTit", titulo);
  poe("cpLabel", rotulo);
  const inp = el("cpValor");
  if (inp){
    inp.value = valor ?? "";
    inp.setAttribute("inputmode", tipo === "numero" ? "decimal" : "text");
  }
  aoSalvarCampo = acao;
  abrirSheet("sheetCampo");
  setTimeout(() => inp && inp.focus(), 150);
}


/* ===========================================================
   6. NAVEGAÇÃO E MODAL DE LANÇAMENTO
   =========================================================== */
/** Só troca a tela. A barra de baixo fica sempre visível. */
function mostrarTela(nome){
  const alvo = qs(`.screen[data-screen="${nome}"]`);
  if (!alvo) return false;
  qsa(".screen").forEach(s => s.classList.toggle("is-active", s === alvo));
  window.scrollTo(0, 0);
  return true;
}

/** Tela de aba: acende a aba correspondente. */
function irPara(nome){
  if (!mostrarTela(nome)) return;
  qsa(".tabbar [data-nav]").forEach(t => t.classList.toggle("is-active", t.dataset.nav === nome));
  if (nome === "estatisticas"){
    const { ini, fim } = limitesPeriodo();
    pintarGraficos(noPeriodo(lancamentos, ini, fim));
  }
}

/** Sub-tela (acessos, políticas, lançamento): alcançada de dentro de uma aba,
    com "voltar" no topo. A aba de origem continua acesa na barra de baixo. */
let telaAnterior = "home";
function irParaSub(nome){
  const atual = qs(".screen.is-active");
  if (atual && atual.dataset.screen !== nome) telaAnterior = atual.dataset.screen;
  mostrarTela(nome);
}
function voltar(){
  const destino = telaAnterior && qs(`.screen[data-screen="${telaAnterior}"]`) ? telaAnterior : "home";
  if (qs(`.tabbar [data-nav="${destino}"]`)) irPara(destino);
  else mostrarTela(destino);
}

function mostrarPasso(passo){
  el("stepScan")?.classList.toggle("is-active", passo === "scan");
  el("stepLendo")?.classList.toggle("is-active", passo === "lendo");
  el("stepReview")?.classList.toggle("is-active", passo === "review");
}

/* ---------- estado visual da leitura do cupom ---------- */
function leituraProgresso(pct, fase){
  const f = el("lendoFill");
  if (f) f.style.width = clamp0a100(pct) + "%";
  poe("lendoPct", clamp0a100(pct) + "%");
  if (fase) poe("lendoFase", fase);
}
const clamp0a100 = n => Math.max(0, Math.min(100, Math.round(n)));

function leituraPasso(id, estado, texto){
  const li = el(id);
  if (!li) return;
  li.classList.remove("is-doing", "is-done", "is-fail");
  if (estado) li.classList.add("is-" + estado);
  if (texto){
    const t = li.querySelector(".txt");
    if (t) t.textContent = texto;
  }
}

function leituraReset(url){
  const img = el("lendoImg");
  if (img && url) img.src = url;
  leituraProgresso(0, "Preparando a imagem");
  leituraPasso("pQR", "", "Procurando o QR code da nota");
  leituraPasso("pOCR", "", "Lendo o texto do cupom");
  leituraPasso("pCampos", "", "Preenchendo os campos");
}

const espera = ms => new Promise(r => setTimeout(r, ms));

function abrirLancamento(modo, id){
  modoSheet = modo;
  editandoId = id || "";
  rascunhoOCR = { confianca: null };
  fecharSheet("sheetNovo");

  const manual  = modo === "manual";
  const editar  = modo === "editar";
  const revisao = manual || editar;

  poe("lancTitulo", editar ? "Editar lançamento" : manual ? "Lançar à mão" : "Escanear cupom");
  poe("lancSub", editar ? "Mude o que precisar e salve. O botão de excluir está no fim."
                : manual ? "Preencha valor e data. O resto é opcional."
                : "Tire a foto do cupom com o QR code visível.");

  const ocrBar = el("ocrBar"), thumb = el("thumbRow");
  if (ocrBar) ocrBar.hidden = revisao;
  if (thumb)  thumb.hidden  = revisao;
  mostrarDiagnostico("", "");

  const wrap = el("campoDataWrap");
  if (wrap){
    wrap.classList.toggle("field--check", !revisao);
    const em = wrap.querySelector("em");
    if (em) em.hidden = revisao;
  }

  const rodape = el("lancFooter");
  if (rodape){
    rodape.innerHTML = editar
      ? `<button class="btn btn--ghost" type="button" data-excluir="${esc(editandoId)}">Excluir</button>
         <button class="btn" type="button" data-salvar="lancamento">Salvar alterações</button>`
      : `<button class="btn btn--ghost" type="button" data-voltar>Descartar</button>
         <button class="btn" type="button" data-salvar="lancamento">Salvar lançamento</button>`;
  }

  preencherFormulario(editar ? lancamentos.find(l => l.id === id) : null, manual);
  irParaSub("lancamento");
  mostrarPasso(revisao ? "review" : "scan");
}

function preencherFormulario(l, manual){
  const põe = (id, v) => { const x = el(id); if (x) x.value = v ?? ""; };
  põe("campoValor",     l ? brl(l.valor) : "");
  põe("campoData",      l ? paraBR(l.dataHora) : (manual ? paraBR(agoraIso()) : ""));
  põe("campoItens",     l ? l.itens : "");
  põe("campoMatricula", l ? l.matricula : prefs.matricula);
  põe("campoCupom",     l ? l.numeroCupom : "");
  põe("campoCnpj",      l ? l.cnpj : "");
  põe("campoObs",       l ? l.observacao : "");

  const cat = el("campoCategoria");
  if (cat) cat.value = (l && l.categoria) || CATEGORIAS[0];

  marcarLocal((l && l.local) || "Sapore");

  const img = el("thumbImg");
  if (img){ img.hidden = true; img.removeAttribute("src"); }
  const icone = el("thumbIcone");
  if (icone) icone.hidden = false;
  poe("thumbNome", l ? "lançamento salvo" : "nenhum arquivo");
  poe("thumbMeta", l ? `ORIGEM ${String(l.origem || "manual").toUpperCase()}` : "");
}

function marcarLocal(local){
  qsa("#grupoLocal button").forEach(b => {
    const on = b.dataset.local === local;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
  });
}

function lerFormulario(){
  const dataIso = paraIso(el("campoData")?.value);
  const valor = paraValor(el("campoValor")?.value);
  if (!dataIso) return { erro: "Data inválida. Use dd/mm/aaaa." };
  if (!isFinite(valor) || valor <= 0) return { erro: "Informe um valor maior que zero." };

  const ativo = qs("#grupoLocal button.is-active");
  const anterior = editandoId ? lancamentos.find(l => l.id === editandoId) : null;

  return { item: {
    id: editandoId || "",
    dataHora: dataIso,
    local: ativo ? ativo.dataset.local : "Sapore",
    categoria: el("campoCategoria")?.value || CATEGORIAS[0],
    valor,
    itens: (el("campoItens")?.value || "").trim(),
    matricula: (el("campoMatricula")?.value || "").trim(),
    numeroCupom: (el("campoCupom")?.value || "").trim(),
    cnpj: (el("campoCnpj")?.value || "").trim(),
    observacao: (el("campoObs")?.value || "").trim(),
    confiancaOCR: rascunhoOCR.confianca != null ? rascunhoOCR.confianca
                : (anterior ? (anterior.confiancaOCR ?? null) : null),
    origem: modoSheet === "scan" ? "ocr" : (anterior ? (anterior.origem || "manual") : "manual"),
    status: "conferido"
  } };
}


/* ===========================================================
   7. LEITURA DO CUPOM — QR da NFC-e primeiro, OCR depois
   A imagem é processada em memória e descartada. Nada de foto
   no banco: é requisito de privacidade da spec.
   -----------------------------------------------------------
   Por que o QR vem antes: o cupom é uma NFC-e e traz um QR com
   a chave de acesso de 44 dígitos. Dela saem CNPJ e número do
   cupom com CERTEZA, e na versão 1 do QR vêm também valor e
   data/hora. OCR em papel térmico é palpite; QR é dado.
   Reserva: a chave impressa em grupos de 4 dígitos, que o OCR
   acerta muito melhor do que texto corrido.
   =========================================================== */
const OCR_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const QR_CDN  = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

let rascunhoOCR = { confianca: null };
const scriptsPedidos = {};

function carregarScript(src, global){
  if (self[global]) return Promise.resolve();
  if (scriptsPedidos[src]) return scriptsPedidos[src];
  scriptsPedidos[src] = new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => ok();
    s.onerror = () => { delete scriptsPedidos[src]; falha(new Error("sem rede para baixar " + global)); };
    document.head.appendChild(s);
  });
  return scriptsPedidos[src];
}
const carregarTesseract = () => carregarScript(OCR_CDN, "Tesseract");
const carregarJsQR = () => carregarScript(QR_CDN, "jsQR");


/* ---------- CNPJ é a identidade confiável da lanchonete ----------
   Começa vazio de propósito: eu não vou chutar um CNPJ lido de foto.
   O nome impresso resolve o primeiro cupom, e ao salvar o app grava o
   par CNPJ→lanchonete nas suas preferências. Do segundo em diante o
   reconhecimento é por CNPJ, que não tem erro de leitura. */
const CNPJ_LOCAL = {};

function localPorCnpj(cnpj){
  const d = String(cnpj || "").replace(/\D/g, "");
  if (d.length !== 14) return "";
  return (prefs.cnpjLocal && prefs.cnpjLocal[d]) || CNPJ_LOCAL[d] || "";
}

/** Você corrigiu a lanchonete de um CNPJ? O app aprende e não erra de novo. */
function aprenderCnpj(cnpj, local){
  const d = String(cnpj || "").replace(/\D/g, "");
  if (d.length !== 14 || !local || CNPJ_LOCAL[d] === local) return;
  prefs.cnpjLocal = prefs.cnpjLocal || {};
  if (prefs.cnpjLocal[d] === local) return;
  prefs.cnpjLocal[d] = local;
  gravarPrefs();
}


/**
 * Pré-processamento. É o passo que mais muda o resultado: cupom térmico é o
 * pior caso do OCR — contraste baixo, papel curvo, letra pequena. Amplia para
 * ~1800px na maior dimensão, converte para cinza e estica o contraste jogando
 * fora 2% de cada ponta do histograma.
 */
async function prepararImagem(file){
  let fonte;
  if (self.createImageBitmap){
    fonte = await createImageBitmap(file);
  } else {
    const urlTmp = URL.createObjectURL(file);
    try {
      fonte = await new Promise((ok, falha) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => falha(new Error("não deu para abrir a imagem"));
        i.src = urlTmp;
      });
    } finally { URL.revokeObjectURL(urlTmp); }
  }

  const maior = Math.max(fonte.width, fonte.height) || 1;
  const escala = Math.min(2.5, Math.max(1, 1800 / maior));
  const w = Math.round(fonte.width * escala), h = Math.round(fonte.height * escala);

  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingQuality = "high";
  g.drawImage(fonte, 0, 0, w, h);
  if (fonte.close) fonte.close();

  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4){
    const y = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = y;
    hist[y]++;
  }
  const corte = (w * h) * 0.02;
  let acc = 0, min = 0, max = 255;
  for (let v = 0; v < 256; v++){ acc += hist[v]; if (acc > corte){ min = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--){ acc += hist[v]; if (acc > corte){ max = v; break; } }
  const faixa = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4){
    let y = ((d[i] - min) / faixa) * 255;
    d[i] = d[i + 1] = d[i + 2] = y < 0 ? 0 : y > 255 ? 255 : y;
  }
  g.putImageData(img, 0, 0);
  return cv;
}


/* ---------- QR code ---------- */

async function lerQR(cv){
  // 1) detector nativo, quando o navegador tem (Chrome no Android tem)
  try {
    if (self.BarcodeDetector){
      const det = new BarcodeDetector({ formats: ["qr_code"] });
      const achados = await det.detect(cv);
      if (achados && achados.length) return achados[0].rawValue || "";
    }
  } catch(e){}
  // 2) jsQR, que roda em qualquer navegador
  try {
    await carregarJsQR();
    const g = cv.getContext("2d", { willReadFrequently: true });
    const img = g.getImageData(0, 0, cv.width, cv.height);
    const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
    return (r && r.data) || "";
  } catch(e){ return ""; }
}

/**
 * A chave de acesso da NFC-e tem 44 dígitos com posição fixa:
 * cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
 * Ou seja: CNPJ e número do cupom saem daqui sem chute nenhum.
 */
function camposDaChave(chave){
  const d = String(chave || "").replace(/\D/g, "");
  if (d.length !== 44) return {};
  const cnpj = d.slice(6, 20);
  return {
    cnpj: formataCnpj(cnpj),
    numeroCupom: d.slice(25, 34),
    local: localPorCnpj(cnpj)
  };
}

/**
 * QR da NFC-e. Versão 1 traz o conteúdo separado por "|":
 * chNFe | nVersao | tpAmb | cDest | dhEmi | vNF | vICMS | digVal | cIdToken | cHash
 * Versão 2 traz só chave, versão, ambiente e token — daí valor e data ficam
 * para o OCR.
 */
function camposDoQR(texto){
  const t = String(texto || "");
  if (!t) return {};
  const out = {};

  const mch = t.match(/\d{44}/);
  if (mch) Object.assign(out, camposDaChave(mch[0]));

  const mp = t.match(/[?&]p=([^&\s]+)/i);
  let bruto = t;
  if (mp){ try { bruto = decodeURIComponent(mp[1]); } catch(e){ bruto = mp[1]; } }
  const partes = bruto.split("|");
  if (partes.length >= 7){
    const v = parseFloat(String(partes[5]).replace(",", "."));
    if (isFinite(v) && v > 0 && v < 5000) out.valor = v;
    const md = String(partes[4]).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (md) out.dataHora = `${md[1]}-${md[2]}-${md[3]}T${md[4]}:${md[5]}`;
  }
  return out;
}


/* ---------- o fluxo ---------- */

async function lerCupom(file){
  const url = URL.createObjectURL(file);
  const img = el("thumbImg");
  if (img){ img.src = url; img.hidden = false; }
  const icone = el("thumbIcone");
  if (icone) icone.hidden = true;

  poe("thumbNome", file.name || "cupom.jpg");
  poe("thumbMeta", "");
  leituraReset(url);
  mostrarPasso("lendo");
  const ocrBar = el("ocrBar"), thumb = el("thumbRow");
  if (ocrBar) ocrBar.hidden = false;
  if (thumb)  thumb.hidden  = false;
  mostrarDiagnostico("", "");

  const t0 = Date.now();
  let worker = null, fonteQR = "", textoOCR = "", conf = 0;
  let campos = { valor: null, dataHora: "", local: "", itens: "",
                 matricula: "", numeroCupom: "", cnpj: "" };
  try {
    leituraProgresso(8, "Preparando a imagem");
    const tela = await prepararImagem(file);
    leituraProgresso(16, "Preparando a imagem");

    // ---- 1. QR: rápido e exato ----
    leituraPasso("pQR", "doing");
    leituraProgresso(22, "Procurando o QR code");
    fonteQR = await lerQR(tela);
    const doQR = camposDoQR(fonteQR);
    campos = mesclarCampos(campos, doQR);
    leituraPasso("pQR", fonteQR ? "done" : "fail",
      fonteQR ? "QR code lido — dados exatos da nota" : "Sem QR legível nesta foto");
    leituraProgresso(30, fonteQR ? "QR code lido" : "Vamos pelo texto");

    // ---- 2. OCR: preenche o que o QR não deu ----
    const faltaAlgo = campos.valor == null || !campos.dataHora || !campos.itens
                      || !campos.matricula || !campos.local;
    if (faltaAlgo){
      leituraPasso("pOCR", "doing", "Baixando o leitor (só na primeira vez)");
      leituraProgresso(34, "Preparando o leitor de texto");
      await carregarTesseract();
      leituraPasso("pOCR", "doing", "Lendo o texto do cupom");
      worker = await Tesseract.createWorker("por", 1, {
        logger: m => {
          if (m.status === "recognizing text"){
            leituraProgresso(38 + (m.progress || 0) * 52, "Lendo o texto do cupom");
          }
        }
      });
      // PSM 4 = uma coluna de texto com tamanhos variados: o formato do cupom.
      await worker.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1" });
      let ret = await worker.recognize(tela);
      textoOCR = ret.data.text || "";
      conf = Math.round(ret.data.confidence || 0);
      let doOCR = extrairCampos(textoOCR);

      // Não achou o valor? Segunda tentativa tratando o cupom como bloco único.
      if (doOCR.valor == null && campos.valor == null){
        leituraPasso("pOCR", "doing", "Segunda tentativa de leitura");
        await worker.setParameters({ tessedit_pageseg_mode: "6" });
        const ret2 = await worker.recognize(tela);
        const doOCR2 = extrairCampos(ret2.data.text || "");
        if (doOCR2.valor != null){
          textoOCR = ret2.data.text || "";
          conf = Math.round(ret2.data.confidence || 0);
          doOCR = doOCR2;
        } else {
          textoOCR += "\n----- segunda tentativa -----\n" + (ret2.data.text || "");
        }
      }
      // o QR ganha de qualquer coisa que o OCR ache
      campos = mesclarCampos(doOCR, campos);
      leituraPasso("pOCR", "done", `Texto lido — confiança ${conf}%`);
    } else {
      leituraPasso("pOCR", "done", "O QR já trouxe tudo — nem precisou do texto");
    }
    leituraProgresso(92, "Preenchendo os campos");
    leituraPasso("pCampos", "doing");

    if (!campos.local) campos.local = localPorCnpj(campos.cnpj);

    rascunhoOCR = { confianca: fonteQR ? 100 : conf };
    mostrarDiagnostico(fonteQR, textoOCR);

    const põe = (id, v) => { const x = el(id); if (x && v) x.value = v; };
    põe("campoValor", campos.valor != null ? brl(campos.valor) : "");
    põe("campoData", paraBR(campos.dataHora || agoraIso()));
    põe("campoItens", campos.itens);
    põe("campoMatricula", campos.matricula || prefs.matricula);
    põe("campoCupom", campos.numeroCupom);
    põe("campoCnpj", campos.cnpj);
    if (campos.local) marcarLocal(campos.local);

    // Dizer o que entrou e o que faltou é mais útil que "confiança 62%".
    const rotulos = { valor: "valor", dataHora: "data", local: "lanchonete",
                      itens: "itens", matricula: "matrícula",
                      numeroCupom: "nº do cupom", cnpj: "CNPJ" };
    const chaves = Object.keys(rotulos);
    const achou = chaves.filter(k => campos[k] !== "" && campos[k] != null);
    const faltou = chaves.filter(k => achou.indexOf(k) < 0);
    const baixa = campos.valor == null || (!fonteQR && conf < 75);

    poe("thumbMeta", `${((Date.now() - t0) / 1000).toFixed(1).replace(".", ",")} S · `
      + (fonteQR ? "QR CODE LIDO" : `OCR ${conf}%`) + ` · ${achou.length} DE 7 CAMPOS`);

    const wrap = el("campoDataWrap");
    if (wrap){
      wrap.classList.toggle("field--check", baixa);
      const em = wrap.querySelector("em"); if (em) em.hidden = !baixa;
    }

    leituraPasso("pCampos", "done", `${achou.length} de 7 campos preenchidos`);
    leituraProgresso(100, faltou.length ? "Confira o que faltou" : "Cupom lido inteiro");
    await espera(650);            // deixa o 100% aparecer antes de trocar de tela
    mostrarPasso("review");

    aviso(faltou.length
      ? `Leu ${achou.length ? achou.map(k => rotulos[k]).join(", ") : "quase nada"}. Faltou ${faltou.map(k => rotulos[k]).join(", ")} — preencha à mão.`
      : "Cupom lido inteiro. Confira e salve.");
  } catch(err){
    console.error(err);
    poe("thumbMeta", "LEITURA FALHOU · PREENCHA À MÃO");
    leituraPasso("pCampos", "fail", "Não deu para ler — preencha à mão");
    leituraProgresso(100, "Leitura falhou");
    mostrarDiagnostico(fonteQR, textoOCR);
    await espera(500);
    mostrarPasso("review");
    aviso("Não deu para ler o cupom (" + (err.message || "erro no leitor") + "). Preencha à mão.");
    const d = el("campoData");
    if (d && !d.value) d.value = paraBR(agoraIso());
  } finally {
    if (worker){ try { await worker.terminate(); } catch(e){} }
    URL.revokeObjectURL(url);   // a imagem morre aqui
  }
}

/** O que veio de cada fonte, na tela. Sem isto, "não reconheceu nada" é palpite. */
function mostrarDiagnostico(qr, ocr){
  const bloco = el("ocrDiag");
  const pre = el("ocrTexto");
  if (!bloco || !pre) return;
  const partes = [];
  if (qr)  partes.push("=== QR CODE ===\n" + qr);
  if (ocr) partes.push("=== TEXTO LIDO PELO OCR ===\n" + ocr);
  if (!qr && !ocr) partes.push("");
  // CPF do cupom não interessa a ninguém, muito menos numa tela que você copia
  const texto = partes.join("\n\n").replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "***.***.***-**");
  bloco.hidden = !texto.trim();
  pre.textContent = texto;
  if (!texto.trim()) bloco.removeAttribute("open");
}

/** Junta duas leituras: o que já existe em `base` só é sobrescrito por `extra`. */
function mesclarCampos(base, extra){
  const out = { ...base };
  for (const k of Object.keys(extra || {})){
    const v = extra[k];
    if (v === "" || v == null) continue;
    out[k] = v;
  }
  return out;
}


/* ---------- extração a partir do texto ---------- */

/** OCR de cupom quebra número em pedaços. Junta antes de tentar casar. */
function normalizarOCR(t){
  return String(t)
    .replace(/[   ]/g, " ")
    .replace(/[|¦]/g, " ")
    .replace(/R\s*[$Ss5]\s*(?=[\d.,])/gi, "R$ ")           // R$, RS, R5 -> R$
    .replace(/(\d)\s+([.,])\s*(\d{2})(?!\d)/g, "$1$2$3")   // "44 ,40" -> "44,40"
    .replace(/(\d)[oO](?=\d)/g, "$10")                     // "1o,50" -> "10,50"
    .replace(/(\d)\s+(\d{3})(?!\d)/g, "$1$2");             // "1 234,00" -> "1234,00"
}

const RE_APAGAR    = /a\s*p\s*a\s*g\s*a\s*r/i;
const RE_TOTAL     = /t\s*[o0]\s*t\s*[a4]\s*[li1]/i;          // TOTAL, T0TAL, TOTAI
const RE_SUBTOTAL  = /s\s*u\s*b\s*-?\s*t\s*[o0]/i;
const RE_PAGAMENTO = /troco|dinheiro|cart[ãa]o|cr[eé]dito|d[eé]bito|\bpix\b|recebido|valor\s*pago|entregue|forma\s*(de\s*)?pag/i;
// linhas com número que NUNCA são o valor da compra
const RE_RUIDO = /trib|aprox|federal|estadual|\blei\b\s*\d|procon|fone|icms|pis|cofins|\bcep\b|chave|acesso|aut\s*[:.]|consulte|nfc\s*-?\s*e|cpf|cnpj|\bqtde\b|aliq/i;

/** Todos os valores monetários de um texto. */
function valoresDe(s){
  const out = [];
  const re = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)\s*[.,](\d{2})(?!\d)/g;
  let m;
  while ((m = re.exec(String(s)))){
    const v = parseFloat(m[1].replace(/\./g, "") + "." + m[2]);
    if (isFinite(v) && v > 0 && v < 5000) out.push(v);
  }
  return out;
}

function formataCnpj(d){
  const s = String(d || "").replace(/\D/g, "");
  return s.length === 14
    ? `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`
    : String(d || "");
}

/** Extrai do texto do cupom os 7 campos que o handoff pede. Tolerante de propósito. */
function extrairCampos(texto){
  const t = normalizarOCR(texto);
  const linhas = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const plano = chave(t);
  const out = { valor: null, dataHora: "", local: "", itens: "",
                matricula: "", numeroCupom: "", cnpj: "" };

  /* --- a chave de acesso impressa vale mais que tudo: 44 dígitos em grupos
         de 4, que o OCR acerta bem. Dela saem CNPJ e nº do cupom.
         O cupom quebra a chave em duas linhas quando é estreito, então
         procuramos primeiro na região depois do rótulo, sem os separadores. --- */
  const iCh = t.search(/chave\s*de\s*acesso|chave/i);
  if (iCh >= 0){
    const d = t.slice(iCh, iCh + 260).replace(/\D/g, "");
    if (d.length >= 44) Object.assign(out, camposDaChave(d.slice(0, 44)));
  }
  if (!out.cnpj){
    for (const bloco of (t.match(/\d[\d\s.]{48,74}\d/g) || [])){
      const d = bloco.replace(/\D/g, "");
      if (d.length === 44){ Object.assign(out, camposDaChave(d)); break; }
    }
  }

  /* --- valor: "A PAGAR" manda, depois "TOTAL", depois o maior valor limpo --- */
  const util = l => !RE_PAGAMENTO.test(l) && !RE_RUIDO.test(l);
  const primeiro = (filtro) => {
    const cands = linhas.filter(l => filtro(l) && util(l)).flatMap(valoresDe);
    return cands.length ? Math.max(...cands) : null;
  };
  out.valor = primeiro(l => RE_APAGAR.test(l));
  if (out.valor == null) out.valor = primeiro(l => RE_TOTAL.test(l) && !RE_SUBTOTAL.test(l));
  if (out.valor == null) out.valor = primeiro(l => RE_SUBTOTAL.test(l));
  if (out.valor == null) out.valor = primeiro(() => true);

  /* --- data e hora --- */
  const md = t.match(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{2,4})(?:[^\d\n]{0,8}(\d{1,2})\s*[:.h]\s*(\d{2}))?/);
  if (md){
    const ano = md[3].length === 2 ? "20" + md[3] : md[3];
    const cand = `${ano}-${pad2(md[2])}-${pad2(md[1])}`
               + (md[4] ? `T${pad2(md[4])}:${md[5]}` : "T12:00");
    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/.test(cand)) out.dataHora = cand;
  }

  /* --- CNPJ: junta os dígitos depois do rótulo; senão qualquer bloco de 14 --- */
  if (!out.cnpj){
    const iCnpj = t.search(/c\s*n\s*p\s*j/i);
    if (iCnpj >= 0){
      const digitos = t.slice(iCnpj, iCnpj + 45).replace(/\D/g, "");
      if (digitos.length >= 14) out.cnpj = formataCnpj(digitos.slice(0, 14));
    }
  }
  if (!out.cnpj){
    const m = t.match(/(\d{2})[.\s]?(\d{3})[.\s]?(\d{3})\s*[\/\s]\s*(\d{4})\s*[-\s]\s*(\d{2})/);
    if (m) out.cnpj = formataCnpj(m.slice(1).join(""));
  }

  /* --- lanchonete: pelo CNPJ; se não der, pelo nome, tolerando erro de OCR --- */
  out.local = localPorCnpj(out.cnpj);
  if (!out.local){
    if (/sap[o0]r|s4p[o0]r|apore/.test(plano)) out.local = "Sapore";
    else if (/rei\s*d[o0]\s*mate|reid[o0]mate/.test(plano)) out.local = "Rei do Mate";
    else if (/\brei\b/.test(plano) && /mate/.test(plano)) out.local = "Rei do Mate";
    else if (/mate/.test(plano) && !/tomate/.test(plano)) out.local = "Rei do Mate";
  }

  /* --- matrícula: exige rótulo com dois-pontos, para não pegar valor solto.
         O CPF do cupom é ignorado de propósito. --- */
  const mMat = t.match(/(?:matr[íi]?cula|cracha|crach[áa]|chapa|consumidor|cliente|colaborador)\s*:?\s*n?[ºo°]?\s*([0-9][0-9.\-]{2,11}[0-9])/i);
  if (mMat && !/^\d{3}\.\d{3}\.\d{3}/.test(mMat[1])) out.matricula = mMat[1].replace(/[-.]+$/, "");

  /* --- número do cupom: preferir o da chave; senão COO/CCF/NFC-e/CUPOM --- */
  if (!out.numeroCupom){
    const iCup = t.search(/c\s*o\s*o\b|c\s*c\s*f\b|cupom|extrato|nfc\s*-?\s*e|n[ºo°]\s*fisc/i);
    if (iCup >= 0){
      const m = t.slice(iCup, iCup + 35).match(/(\d{3,9})/);
      if (m) out.numeroCupom = m[1];
    }
  }

  /* --- itens: linhas com valor que não são total, pagamento nem ruído --- */
  out.itens = linhas
    .filter(l => valoresDe(l).length)
    .filter(l => !RE_TOTAL.test(l) && !RE_SUBTOTAL.test(l) && !RE_APAGAR.test(l))
    .filter(util)
    .map(l => l
      .replace(/^\s*\d{1,3}\s*[-.)]?\s+/, "")               // nº do item
      .replace(/^\s*\d{5,}\s*/, "")                          // código do produto
      .replace(/(?:R\$\s*)?\b[\d.]*\d[.,]\d{2,}\b/g, "")     // valores (com dígito extra do OCR)
      .replace(/\b(un|kg|g|ml|l|pc|cx|dz)\b/gi, "")          // unidades soltas
      .replace(/[\s\d.,]+$/, "")                             // sobra numérica no fim
      .replace(/\s{2,}/g, " ").trim())
    .filter(l => l.length > 2 && /[a-zà-ú]{3}/i.test(l))
    .slice(0, 6)
    .join(", ");

  return out;
}


/* ===========================================================
   8. EVENTOS
   UM listener no document. Interação identificada por data-*.
   Ao acrescentar um botão, acrescente um data- novo.
   =========================================================== */
document.addEventListener("click", e => {
  const achar = attr => e.target.closest(`[${attr}]`);

  const nav = achar("data-nav");
  if (nav) return irPara(nav.dataset.nav);

  const sub = achar("data-sub");
  if (sub){
    irParaSub(sub.dataset.sub);
    if (sub.dataset.sub === "acessos"){
      contarAc(); pintarAc();   // desenha o estado vazio antes da consulta chegar
      listarPedidos();
    }
    return;
  }

  if (achar("data-novo")) return abrirSheet("sheetNovo");

  const abrir = achar("data-open");
  if (abrir) return abrirLancamento(abrir.dataset.open);

  const editar = achar("data-editar");
  if (editar) return abrirLancamento("editar", editar.dataset.editar);

  if (achar("data-voltar")) return voltar();

  const excluir = achar("data-excluir");
  if (excluir){
    const id = excluir.dataset.excluir;
    const l = lancamentos.find(x => x.id === id);
    return confirmar("Excluir lançamento",
      l ? `${l.local} · ${paraBR(l.dataHora)} · R$ ${brl(l.valor)}. Isso não volta.` : "Isso não volta.",
      "Excluir", () => { excluirLancamento(id); voltar(); aviso("Lançamento excluído."); });
  }

  const okConf = achar("data-confirmar");
  if (okConf){
    fecharSheet("sheetConfirma");
    const acao = aoConfirmar; aoConfirmar = null;
    if (acao) acao();
    return;
  }

  const campoOk = achar("data-salvar-campo");
  if (campoOk){
    const v = el("cpValor")?.value;
    fecharSheet("sheetCampo");
    const acao = aoSalvarCampo; aoSalvarCampo = null;
    if (acao) acao(v);
    return;
  }

  const salvar = achar("data-salvar");
  if (salvar) return acaoSalvar(salvar.dataset.salvar);

  const fechar = achar("data-close");
  if (fechar) return fecharSheet(fechar.closest(".sheet")?.id);

  const passo = achar("data-step");
  if (passo) return mostrarPasso(passo.dataset.step);

  const localBtn = achar("data-local");
  if (localBtn) return marcarLocal(localBtn.dataset.local);

  const per = achar("data-period");
  if (per){
    periodo.preset = per.dataset.period;
    qsa("#periodChips .chip").forEach(c => c.classList.toggle("is-active", c === per));
    const range = el("rangeFields");
    if (range) range.classList.toggle("is-open", periodo.preset === "custom");
    if (periodo.preset === "custom"){
      periodo.inicio = el("dataInicio")?.value || "";
      periodo.fim    = el("dataFim")?.value || "";
    }
    return pintar();
  }

  const grafico = achar("data-chart");
  if (grafico){
    escalaGrafico = grafico.dataset.chart;
    qsa("#chartTabs button").forEach(b => b.classList.toggle("is-active", b === grafico));
    const { ini, fim } = limitesPeriodo();
    return pintarGraficos(noPeriodo(lancamentos, ini, fim));
  }

  if (achar("data-vertudo")){
    verTudo = !verTudo;
    const { ini, fim } = limitesPeriodo();
    return pintarLista(noPeriodo(lancamentos, ini, fim));
  }

  const pref = achar("data-pref");
  if (pref){
    const k = pref.dataset.pref;
    prefs[k] = !prefs[k];
    if (k === "alertaLimite") avisouLimite = false;
    gravarPrefs();
    pintarPerfil();
    if (k === "lembreteRecibo" && prefs[k]) aviso("Preferência anotada. A notificação em si ainda não está pronta.");
    return;
  }

  if (achar("data-teto")){
    return pedirCampo("Teto mensal", "VALOR MÁXIMO POR MÊS (R$)",
      prefs.tetoMensal ? brl(prefs.tetoMensal) : "", "numero", v => {
        const n = paraValor(v);
        prefs.tetoMensal = isFinite(n) && n > 0 ? n : null;
        avisouLimite = false;
        gravarPrefs(); pintarPerfil();
        aviso(prefs.tetoMensal ? "Teto mensal salvo." : "Teto mensal removido.");
      });
  }

  if (achar("data-matricula")){
    return pedirCampo("Matrícula", "SUA MATRÍCULA NA FGV", prefs.matricula, "texto", v => {
      prefs.matricula = String(v || "").trim();
      gravarPrefs(); pintarPerfil();
      aviso("Matrícula salva.");
    });
  }

  if (achar("data-exportar")) return exportarCSV();
  if (achar("data-sair")) return sair();

  if (achar("data-copiar-ocr")){
    const txt = el("ocrTexto")?.textContent || "";
    if (!txt) return aviso("Nada lido ainda.");
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt)
        .then(() => aviso("Texto da leitura copiado."))
        .catch(() => aviso("Não deu para copiar. Selecione o texto à mão."));
    } else {
      aviso("Seu navegador não deixa copiar daqui. Selecione o texto à mão.");
    }
    return;
  }

  if (achar("data-nova-politica")){
    const d = el("polVigencia"); if (d) d.value = hojeIso();
    const t = el("polTeto"); if (t) t.value = brl(politicaEm(hojeIso()).teto);
    const x = el("polTaxa"); if (x) x.value = String(politicaEm(hojeIso()).taxaPct).replace(".", ",");
    return abrirSheet("sheetPolitica");
  }

  if (achar("data-salvar-politica")){
    const vig = el("polVigencia")?.value;
    const teto = paraValor(el("polTeto")?.value);
    const taxa = paraValor(el("polTaxa")?.value);
    if (!vig) return aviso("Informe a data de vigência.");
    if (!isFinite(teto) || teto < 0) return aviso("Informe o teto por refeição.");
    salvarPolitica({ id: "", vigencia: vig, teto, taxaPct: isFinite(taxa) ? taxa : TAXA_PADRAO });
    fecharSheet("sheetPolitica");
    return aviso("Política salva.");
  }

  const excPol = achar("data-excpol");
  if (excPol){
    const id = excPol.dataset.excpol;
    return confirmar("Remover política", "As datas passam a usar a política anterior.", "Remover",
      () => { excluirPolitica(id); aviso("Política removida."); });
  }

  // ---- painel de acessos (admin) ----
  const ap = achar("data-aprovar"); if (ap) return decidir(ap.dataset.aprovar, "aprovado");
  const ng = achar("data-negar");   if (ng) return decidir(ng.dataset.negar, "negado");
  const lt = achar("data-lote");    if (lt) return decidirLote(lt.dataset.lote);
  const sa = achar("data-selall");  if (sa) return marcarTodos(sa.dataset.selall === "1");
  const st = achar("data-st");
  if (st){
    stAc = st.dataset.st; selAc.clear();
    qsa("#segAc .chip").forEach(x => x.classList.toggle("is-active", x === st));
    return pintarAc();
  }
  const ps = achar("data-selac");   if (ps) return alternarSel(ps.dataset.selac);
});

function acaoSalvar(qual){
  if (qual !== "lancamento") return;
  const { item, erro } = lerFormulario();
  if (erro) return aviso(erro);
  const editando = !!editandoId;
  aprenderCnpj(item.cnpj, item.local);   // corrigiu a lanchonete? não erra de novo
  salvarLancamento(item);
  rascunhoOCR = { confianca: null };
  editandoId = "";
  voltar();
  aviso(editando ? "Lançamento atualizado." : "Lançamento salvo.");
}

/* fecha o sheet clicando no fundo escurecido */
qsa(".sheet").forEach(s => s.addEventListener("click", e => {
  if (e.target === s) fecharSheet(s.id);
}));
document.addEventListener("keydown", e => { if (e.key === "Escape") fecharSheet(); });

/* período livre */
["dataInicio", "dataFim"].forEach(id => el(id)?.addEventListener("change", () => {
  periodo.preset = "custom";
  periodo.inicio = el("dataInicio")?.value || "";
  periodo.fim    = el("dataFim")?.value || "";
  qsa("#periodChips .chip").forEach(c => c.classList.toggle("is-active", c.dataset.period === "custom"));
  const range = el("rangeFields");
  if (range) range.classList.add("is-open");
  pintar();
}));

/* câmera e galeria */
["inputCamera", "inputGaleria"].forEach(id => el(id)?.addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!el("lancamento")?.classList.contains("is-active")) abrirLancamento("scan");
  modoSheet = "scan";
  editandoId = "";
  preencherFormulario(null, false);
  await lerCupom(file);
}));

/* busca do painel de acessos */
el("q-ac")?.addEventListener("input", e => { qAc = e.target.value; pintarAc(); });

function exportarCSV(){
  const { ini, fim } = limitesPeriodo();
  const lista = noPeriodo(lancamentos, ini, fim);
  if (!lista.length) return aviso("Nada para exportar neste período.");
  const csv = "﻿" + paraCSV(lista);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `meu-bandejao-${ini}-a-${fim}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  aviso(`${lista.length} lançamento${lista.length === 1 ? "" : "s"} no arquivo.`);
}

function sair(){
  confirmar("Sair da conta", "Você volta para a tela de login.", "Sair", () => {
    if (auth) auth.signOut().then(() => location.reload());
    else location.reload();
  });
}


/* ===========================================================
   9. FIREBASE — auth, portaria e sincronização
   =========================================================== */
async function iniciar(){
  carregarLocal();
  pintar();

  if (!CONFIGURADO){
    mostrarGate(true);
    poe("gateMsg", "Firebase não configurado — o botão abre em modo local, salvo só neste aparelho.");
    const m = el("gateMsg"); if (m) m.hidden = false;
    el("btnLogin")?.addEventListener("click", () => {
      entrar({ displayName: "Modo local", email: "salvo neste aparelho", photoURL: "", uid: "local" },
             ["member", "admin"]);
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

  el("btnLogin")?.addEventListener("click", async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch(err){ aviso("Não deu pra entrar: " + (err.code || err.message)); }
  });
  el("espSair")?.addEventListener("click", () => signOut(auth).then(() => location.reload()));
  el("espRecarregar")?.addEventListener("click", () => location.reload());

  onAuthStateChanged(auth, async u => {
    if (!u) return mostrarGate(true);

    const refU = doc(db, "users", u.uid);
    const dono = ehDono(u.email);
    let snap;
    try {
      snap = await getDoc(refU);
      if (!snap.exists()){
        // PORTARIA: quem não é dono entra pendente. Só o admin promove — as
        // Rules garantem que ninguém se promove sozinho.
        await setDoc(refU, {
          nome: u.displayName || "", email: u.email || "", foto: u.photoURL || "",
          roles: dono ? ["member", "admin"] : ["member"],
          status: dono ? "aprovado" : "pendente",
          criadoEm: serverTimestamp(),
          ...(dono ? { papel: "admin" } : {})
        });
        snap = await getDoc(refU);
      } else if (dono){
        // conserta um documento de dono que ficou pendente numa versão antiga
        const d = snap.data() || {};
        if (d.status !== "aprovado" || d.papel !== "admin"){
          await updateDoc(refU, { status: "aprovado", papel: "admin" });
          snap = await getDoc(refU);
        }
      }
    } catch(err){
      mostrarGate(true);
      poe("gateMsg", "Não deu para registrar o seu acesso: " + (err.code || err.message));
      const m = el("gateMsg"); if (m) m.hidden = false;
      return;
    }

    const dados = snap.data() || {};
    papeis = dados.roles || ["member"];
    if (dados.papel === "admin" && !papeis.includes("admin")) papeis = [...papeis, "admin"];
    situacao = dados.status || "pendente";
    if (dados.prefs) prefs = { ...prefs, ...dados.prefs };

    salvarPerfil = campos => updateDoc(refU, campos);

    // PORTARIA: só quem foi aprovado passa
    if (situacao !== "aprovado") return mostrarEspera(u, situacao);

    // lançamentos do usuário, em tempo real
    const refD = doc(db, COL_LANC, u.uid);
    salvarDoc = itens => setDoc(refD, { itens, atualizadoEm: serverTimestamp() }, { merge: true });
    onSnapshot(refD, s => {
      const itens = (s.exists() && s.data().itens) || [];
      // guard contra o eco da própria escrita
      if (JSON.stringify(itens) !== JSON.stringify(lancamentos)){
        lancamentos = ordenar(itens);
        try { localStorage.setItem(NS + "_lancamentos", JSON.stringify(lancamentos)); } catch(e){}
        pintar();
      }
    }, err => aviso("Sem sincronizar: " + (err.code || err.message)));

    // políticas do RH, compartilhadas
    const refP = doc(db, COL_POL, DOC_POL);
    gravarPoliticasRemoto = lista => setDoc(refP, { lista, atualizadoEm: serverTimestamp() }, { merge: true });
    onSnapshot(refP, s => {
      const lista = (s.exists() && s.data().lista) || [];
      if (JSON.stringify(lista) !== JSON.stringify(politicas)){
        politicas = lista;
        try { localStorage.setItem(NS + "_politicas", JSON.stringify(politicas)); } catch(e){}
        pintar();
      }
    }, () => {});

    apiAdmin = { db, doc, updateDoc, collection, query, where, getDocs, writeBatch, onSnapshot };
    entrar(u, papeis);
    listarPedidos();
    vigiarPedidos();
  });
}

function mostrarGate(mostrar){
  const gate = el("gate"), espera = el("espera"), app = el("app");
  if (gate)   gate.hidden = !mostrar;
  if (espera) espera.hidden = true;
  if (app)    app.hidden = mostrar;
  const load = el("gateLoad"); if (load) load.hidden = mostrar;
  const btn = el("gateBtn");   if (btn)  btn.hidden = !mostrar;
}

function mostrarEspera(u, st){
  const gate = el("gate"), espera = el("espera"), app = el("app");
  if (gate)   gate.hidden = true;
  if (app)    app.hidden = true;
  if (espera) espera.hidden = false;
  poe("espMail", u.email || "");
  poe("espTit", st === "negado" ? "Acesso não liberado" : "Aguardando liberação");
  poe("espTxt", st === "negado"
    ? "O administrador não liberou este e-mail."
    : "Seu pedido chegou. Assim que liberarem, toque em “Já fui liberado”.");
}

function entrar(u, roles){
  usuario = u; papeis = roles;
  const gate = el("gate"), espera = el("espera"), app = el("app");
  if (gate)   gate.hidden = true;
  if (espera) espera.hidden = true;
  if (app)    app.hidden = false;

  poe("syncMsg", CONFIGURADO
    ? "LIGADO À NUVEM · APARECE EM QUALQUER APARELHO"
    : "MODO LOCAL · SALVO SÓ NESTE NAVEGADOR");

  irPara("home");
  pintar();
  checarAlerta();
}


/* ===========================================================
   10. PAINEL DE ACESSOS (só admin)
   =========================================================== */
let apiAdmin = null, vigia = null;
let USERS = [], stAc = "pendente", qAc = "", selAc = new Set();
const VAZIO_AC = { pendente: "Nenhum pedido no momento.",
                   aprovado: "Ninguém liberado ainda além de você.",
                   negado: "Nenhum acesso negado." };
const sit = u => u.status || "pendente";

async function listarPedidos(){
  if (!apiAdmin || !papeis.includes("admin")) return;
  const { db, collection, getDocs } = apiAdmin;
  try {
    const lista = await getDocs(collection(db, "users"));
    USERS = [];
    lista.forEach(d => { if (d.id !== usuario.uid) USERS.push({ id: d.id, ...d.data() }); });
  } catch(err){ return aviso("Não deu pra ler a lista: " + (err.code || err.message)); }
  contarAc(); pintarAc();
}

function contarAc(){
  const n = st => USERS.filter(u => sit(u) === st).length;
  const p = n("pendente"), l = n("aprovado"), g = n("negado");
  poe("cPend", String(p)); poe("cLib", String(l)); poe("cNeg", String(g));
  poe("acPlacar", `${p} pedidos · ${l} liberados · ${g} negados`);
  sinalizar(p);
}

/** aviso de "tem gente esperando", no espírito de mensagem não lida */
function sinalizar(n){
  const nb = el("navBadgePerfil");
  if (nb){ nb.hidden = !n; nb.textContent = n > 9 ? "9+" : String(n); }
  poe("btnAcessosTxt", n ? (n === 1 ? "1 PEDIDO ESPERANDO" : `${n} PEDIDOS ESPERANDO`)
                         : "LIBERAR OU NEGAR ACESSOS");
}

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
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt"));
}

function pintarAc(){
  const lista = el("listaAc");
  if (!lista) return;
  const vis = visiveisAc();
  const total = USERS.filter(u => sit(u) === stAc).length;
  const modoLote = selAc.size > 0;

  lista.innerHTML = vis.length ? vis.map(u => {
    const on = selAc.has(u.id);
    const ini = String(u.nome || u.email || "?").trim()[0].toUpperCase();
    return `<li class="glass row">
      <button class="ac-chk ${on ? "is-on" : ""}" type="button" data-selac="${esc(u.id)}"
              aria-label="Selecionar ${esc(u.nome || u.email || "")}">${on ? "✓" : ""}</button>
      <span class="avatar">${esc(ini)}</span>
      <span class="row__body">
        <span class="row__label">${esc(u.nome || "sem nome")}</span>
        <span class="row__hint">${esc(u.email || "")}</span>
      </span>
      ${modoLote ? "" : `<span class="ac-acoes">${acoesDe(stAc, u.id)}</span>`}
    </li>`;
  }).join("") : `<li class="glass row"><span class="row__body">
      <span class="row__label">${esc(total && qAc ? "Ninguém com esse nome" : VAZIO_AC[stAc])}</span>
    </span></li>`;

  const bar = el("loteBar");
  if (bar) bar.hidden = !selAc.size;
  poe("loteN", selAc.size + (selAc.size === 1 ? " selecionado" : " selecionados"));
  const acoes = el("loteAcoes");
  if (acoes) acoes.innerHTML = acoesLote(stAc);
}

function acoesDe(st, id){
  if (st === "pendente") return `<button class="btn btn--sm" type="button" data-aprovar="${esc(id)}">Liberar</button>
                                 <button class="btn btn--sm btn--ghost" type="button" data-negar="${esc(id)}">Negar</button>`;
  if (st === "aprovado") return `<button class="btn btn--sm btn--ghost" type="button" data-negar="${esc(id)}">Remover</button>`;
  return `<button class="btn btn--sm" type="button" data-aprovar="${esc(id)}">Liberar</button>`;
}
function acoesLote(st){
  if (st === "pendente") return `<button class="btn btn--sm" type="button" data-lote="aprovado">Liberar</button>
                                 <button class="btn btn--sm btn--ghost" type="button" data-lote="negado">Negar</button>`;
  if (st === "aprovado") return `<button class="btn btn--sm btn--ghost" type="button" data-lote="negado">Remover</button>`;
  return `<button class="btn btn--sm" type="button" data-lote="aprovado">Liberar</button>`;
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
  } catch(err){ aviso("Não deu: " + (err.code || err.message)); }
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
  } catch(err){ aviso("Não deu: " + (err.code || err.message)); }
}


iniciar();
