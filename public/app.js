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

/* Regra do DRH (Sede Botafogo, consumo direto) usada quando o banco ainda não
   tem política cadastrada. O subsídio é DIÁRIO: duas refeições no mesmo dia
   dividem um teto só, não um teto cada. */
const TETO_PADRAO = 35.00;   // R$ por DIA de consumo subsidiável na Sapore — tabela 2026/2027
const TAXA_PADRAO = 0.15;    // % do salário base por DIA com consumo, somado ao excedente

/* Os três casos, que têm regra de dinheiro DIFERENTE:
   - Sapore: a FGV subsidia até o teto, você é descontado no excedente
   - Rei do Mate: valor integral, descontado no contracheque
   - Outro: bar, padaria, restaurante da rua. Você paga na hora, do seu bolso.
     Zero de subsídio e, principalmente, NÃO ENTRA NA FOLHA. */
const LOCAIS = ["Sapore", "Rei do Mate", "Outro"];
const INTERNOS = ["Sapore", "Rei do Mate"];      // os que caem no contracheque
const ehInterno = local => INTERNOS.indexOf(local) >= 0;

/** O nome que aparece na tela: "Outro" mostra o lugar que você escreveu. */
const nomeDoLocal = l => (l.local === "Outro" && l.localNome) ? l.localNome : (l.local || "");

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
/* ATENÇÃO: prefs SINCRONIZA. Vai para users/{uid}.prefs no Firestore, e lá o
   administrador lê (allow get: eu(uid) || ehAdmin()). Nada sensível aqui. */
let prefs       = { alertaLimite: true, lembreteRecibo: false, tetoMensal: null,
                    matricula: "", cnpjLocal: {} };

/* O que NUNCA sai deste aparelho. Regra de Firestore não protege de quem abre
   o console do projeto — ela vale para o SDK do cliente, não para o dono do
   Firebase. Então a única forma de garantir que ninguém veja o salário de
   ninguém no banco é NÃO COLOCAR o salário no banco. Daqui sai a participação
   de 0,15%, calculada no navegador de cada um.
   Consequência aceita: trocou de aparelho ou limpou o navegador, digita de
   novo. É um número que a pessoa sabe de cabeça. */
let privado     = { salarioBase: null };
let periodo     = { preset: "atual", inicio: "", fim: "" };
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
/**
 * O que vem de um <input type="datetime-local"> -> "AAAA-MM-DDTHH:MM".
 * O navegador já entrega no formato interno do app, então aqui não se
 * interpreta texto: só corta segundos (que alguns navegadores acrescentam) e
 * valida. Vazio quando o campo está vazio ou fora de faixa.
 */
function normalizaDataHora(valor){
  const t = String(valor || "").slice(0, 16);
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : "";
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
 * O que o subsídio cobre neste lançamento. Nem tudo no cupom entra: item de
 * geladeira (refrigerante em lata ou garrafa) e sobremesa elaborada (bolo,
 * salada de frutas) vão integrais para a folha. Kilo, prato básico, suco de
 * máquina, fruta e gelatina entram.
 */
function baseSubsidiavel(l){
  if (l.local !== "Sapore") return 0;
  return Math.max(0, num(l.valor) - num(l.valorSemSubsidio));
}

/* ---------- rateio do teto diário ----------
   O teto do DRH é do DIA, não do cupom: duas refeições no mesmo dia dividem um
   único R$ 35,00. Isso tira o subsídio do domínio de um lançamento isolado — e,
   como a tela mostra o rateio linha por linha, exige uma ordem. A ordem é a
   cronológica: a primeira nota do dia consome o teto e quem vem depois pega o
   que sobrou.
   O mapa é sempre calculado sobre a lista INTEIRA, nunca sobre a lista filtrada
   da tela: senão o mesmo lançamento mostraria subsídios diferentes em telas
   diferentes, conforme o filtro ativo. */
let rateioCache = null;
function invalidarRateio(){ rateioCache = null; }

function rateio(){
  if (!rateioCache) rateioCache = calcularRateio(lancamentos);
  return rateioCache;
}

/** Ordem dentro do dia: hora do cupom, e o empate desempata pela inclusão. */
function cronologico(a, b){
  return String(a.dataHora).localeCompare(String(b.dataHora))
      || String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))
      || String(a.id || "").localeCompare(String(b.id || ""));
}

function calcularRateio(lista){
  const dias = new Map();
  for (const l of lista){
    if (l.local !== "Sapore") continue;
    const d = dataDe(l);
    if (!d) continue;
    if (!dias.has(d)) dias.set(d, []);
    dias.get(d).push(l);
  }
  const mapa = new Map();
  for (const [d, doDia] of dias){
    let resta = num(politicaEm(d).teto);
    for (const l of doDia.sort(cronologico)){
      const sub = Math.min(baseSubsidiavel(l), Math.max(0, resta));
      resta -= sub;
      // excedente = tudo o que a FGV não cobriu, inclusive os itens sem subsídio
      mapa.set(l.id, { subsidio: sub, excedente: num(l.valor) - sub });
    }
  }
  return mapa;
}

/**
 * O rateio deste lançamento. Fora da lista global — pré-visualização de algo
 * que ainda não foi salvo — cai no cálculo solto, com o teto do dia inteiro.
 */
function rateioDe(l){
  const r = rateio().get(l.id);
  if (r) return r;
  const sub = Math.min(baseSubsidiavel(l), num(politicaEm(dataDe(l)).teto));
  return { subsidio: sub, excedente: num(l.valor) - sub };
}

/**
 * Quanto deste lançamento cai como desconto em folha.
 * Sapore: o que passou do teto DIÁRIO, mais os itens que não têm subsídio.
 * Rei do Mate: pago integralmente pelo colaborador.
 * NÃO inclui a participação de 0,15% do salário base: ela é por DIA com
 * consumo, não por lançamento, e entra no resumo do período.
 */
function descontoDe(l){
  if (l.local === "Sapore") return rateioDe(l).excedente;
  if (l.local === "Rei do Mate") return num(l.valor);
  return 0;   // fora da FGV: sai do bolso na hora, não do contracheque
}

/** O que a FGV cobriu. Só a Sapore subsidia, e só até o teto do dia. */
function subsidioDe(l){
  return l.local === "Sapore" ? rateioDe(l).subsidio : 0;
}

/** O que você pagou por fora, sem passar pela folha. */
function foraDaFolhaDe(l){
  return ehInterno(l.local) ? 0 : num(l.valor);
}

/**
 * A participação de UM dia: o percentual da política vigente naquela data,
 * aplicado ao salário base que está guardado só neste aparelho, arredondado ao
 * centavo. Zero enquanto ninguém informar o salário — o app não inventa número.
 */
function participacaoDoDia(dataIso){
  const s = num(privado.salarioBase);
  if (s <= 0) return 0;
  const pct = num(politicaEm(dataIso || hojeIso()).taxaPct);
  return Math.round(s * pct) / 100;      // pct vem em %, daí o /100 embutido
}

/**
 * A participação do período: uma incidência por DIA com consumo na Sapore.
 * Dia em que você só passou no Rei do Mate não conta — o benefício subsidiado é
 * o do refeitório. Soma dia a dia em vez de multiplicar pela contagem, porque o
 * percentual tem vigência e pode ser diferente em dias diferentes.
 */
function participacaoDe(diasSapore){
  let total = 0;
  for (const d of diasSapore) total += participacaoDoDia(d);
  return total;
}

/**
 * Consolidado do período. A soma fecha assim, por construção:
 *   bruto = subsidio (FGV) + excedente + rei + fora
 *   desconto (folha) = excedente + rei + participacao
 * Ou seja: desconto + subsidio = bruto + participacao. A participação NÃO é
 * parcela do consumo — é encargo por dia de uso, e não paga comida. Por isso
 * ela sobra na conta, e é isso que a tela precisa deixar claro.
 * Calcular o subsídio como "bruto − desconto" daria errado por dois motivos: o
 * gasto fora da FGV entraria como coisa subsidiada, e a participação viraria
 * subsídio negativo.
 */
function resumo(lista){
  const r = { n: lista.length, bruto: 0, desconto: 0, subsidio: 0, fora: 0,
              excedente: 0, rei: 0, participacao: 0, diasSapore: new Set(),
              nFora: 0, revisar: 0, porLocal: {} };
  for (const nome of LOCAIS) r.porLocal[nome] = { n: 0, bruto: 0, desconto: 0 };

  for (const l of lista){
    const bruto = num(l.valor);
    const desc  = descontoDe(l);
    const fora  = foraDaFolhaDe(l);
    r.bruto    += bruto;
    r.subsidio += subsidioDe(l);
    r.fora     += fora;
    if (l.local === "Sapore"){
      r.excedente += desc;
      if (dataDe(l)) r.diasSapore.add(dataDe(l));
    } else if (l.local === "Rei do Mate"){
      r.rei += desc;
    }
    if (fora) r.nFora++;
    if (l.status === "revisar") r.revisar++;
    const alvo = r.porLocal[l.local] || (r.porLocal[l.local] = { n: 0, bruto: 0, desconto: 0 });
    alvo.n++; alvo.bruto += bruto; alvo.desconto += desc;
  }
  r.participacao = participacaoDe(r.diasSapore);
  r.desconto = r.excedente + r.rei + r.participacao;
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
    const atual = mapa.get(d) || { data: d, bruto: 0, desconto: 0, n: 0, sapore: false };
    atual.bruto += num(l.valor); atual.desconto += descontoDe(l); atual.n++;
    if (l.local === "Sapore") atual.sapore = true;
    mapa.set(d, atual);
  }
  // a participação é por dia com consumo na Sapore, uma vez em cada
  for (const d of mapa.values()) if (d.sapore) d.desconto += participacaoDoDia(d.data);
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/** Soma por mês (YYYY-MM), para a aba "Por mês" do gráfico. */
function porMes(lista){
  const mapa = new Map();
  for (const l of lista){
    const m = dataDe(l).slice(0, 7);
    const atual = mapa.get(m) || { data: m, bruto: 0, desconto: 0, n: 0, dias: new Set() };
    atual.bruto += num(l.valor); atual.desconto += descontoDe(l); atual.n++;
    if (l.local === "Sapore" && dataDe(l)) atual.dias.add(dataDe(l));
    mapa.set(m, atual);
  }
  // tantas participações quantos dias com consumo na Sapore o mês tiver
  for (const m of mapa.values()) m.desconto += participacaoDe(m.dias);
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

function ordenar(lista, modo){
  const l = [...lista];
  if (modo === "valor") return l.sort((a, b) => num(b.valor) - num(a.valor));
  if (modo === "antigo") return l.sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)));
  return l.sort((a, b) => String(b.dataHora).localeCompare(String(a.dataHora)));
}

/** Tudo que dá para procurar num lançamento, sem acento e em minúsculas. */
function textoDoLancamento(l){
  return chave([l.local, l.localNome, l.categoria, l.itens, l.matricula, l.numeroCupom,
                l.cnpj, l.observacao, paraBR(l.dataHora), brl(l.valor),
                ehInterno(l.local) ? "em folha" : "fora da folha fgv"]
    .filter(Boolean).join(" "));
}

/**
 * Filtro da tela de transações. Cada critério é independente: texto casa em
 * qualquer campo, e todas as palavras precisam bater — senão buscar "sapore
 * almoço" não acharia nada.
 */
function aplicarFiltro(lista, f){
  const palavras = chave(f.texto || "").split(/\s+/).filter(Boolean);
  return lista.filter(l => {
    if (f.local && l.local !== f.local) return false;
    if (f.categoria && l.categoria !== f.categoria) return false;
    if (f.situacao && (l.status || "conferido") !== f.situacao) return false;
    const v = num(l.valor);
    if (f.min != null && v < f.min) return false;
    if (f.max != null && v > f.max) return false;
    const d = dataDe(l);
    if (f.ini && d < f.ini) return false;
    if (f.fim && d > f.fim) return false;
    if (palavras.length){
      const alvo = textoDoLancamento(l);
      if (!palavras.every(p => alvo.includes(p))) return false;
    }
    return true;
  });
}

function novoId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * CSV do que está filtrado na tela, com a memória de cálculo em cada linha.
 * A participação de 0,15% NÃO tem coluna: ela é por dia com consumo, não por
 * lançamento, e rateá-la entre as notas do dia inventaria um número que a folha
 * não tem. Ela aparece no resumo do período, na tela.
 */
function paraCSV(lista){
  const cab = ["data", "hora", "local", "nome_do_local", "entra_na_folha", "categoria",
               "valor", "valor_sem_subsidio", "base_subsidiavel", "teto_diario",
               "desconto_folha", "subsidio_fgv", "fora_da_folha",
               "itens", "matricula", "numero_cupom", "cnpj", "observacao", "origem", "status"];
  const linhas = ordenar(lista).map(l => {
    const sapore = l.local === "Sapore";
    return [
      dataDe(l), horaDe(l), l.local, nomeDoLocal(l), ehInterno(l.local) ? "sim" : "nao",
      l.categoria, num(l.valor).toFixed(2), num(l.valorSemSubsidio).toFixed(2),
      baseSubsidiavel(l).toFixed(2),
      sapore ? num(politicaEm(dataDe(l)).teto).toFixed(2) : "0.00",
      descontoDe(l).toFixed(2), subsidioDe(l).toFixed(2), foraDaFolhaDe(l).toFixed(2),
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
    const s = localStorage.getItem(NS + "_privado");
    if (s) privado = { ...privado, ...JSON.parse(s) };
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

/**
 * Grava o que é privado. Note a AUSÊNCIA de salvarPerfil aqui: é o ponto todo
 * desta função existir separada de gravarPrefs. Se alguém um dia acrescentar
 * uma chamada de rede nesta função, o salário vai para o banco.
 */
function gravarPrivado(){
  try { localStorage.setItem(NS + "_privado", JSON.stringify(privado)); } catch(e){}
}

/**
 * Migração de uma versão anterior deste mesmo app, que guardava a participação
 * em reais dentro de `prefs` — e `prefs` sincroniza, ou seja: o valor foi para
 * o Firestore, onde o administrador lê, e dividir por 0,15% devolve o salário.
 *
 * Aqui ele é convertido de volta para salário no armazenamento local e APAGADO
 * das prefs. A gravação seguinte usa updateDoc com o mapa `prefs` inteiro, que
 * substitui o mapa no servidor — então o campo deixa de existir lá, não fica
 * órfão. Roda depois de carregar o local e depois de ler o perfil remoto.
 */
function migrarParticipacao(){
  if (!("participacaoDia" in prefs)) return;
  const v = num(prefs.participacaoDia);
  const pct = num(politicaEm(hojeIso()).taxaPct);
  if (v > 0 && pct > 0 && !num(privado.salarioBase)){
    privado.salarioBase = Math.round((v / pct) * 100 * 100) / 100;
    gravarPrivado();
  }
  delete prefs.participacaoDia;
  gravarPrefs();
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
  /* O rateio do teto diário é jogado fora aqui, num lugar só. Toda mutação de
     lançamento ou de política termina chamando pintar(), então este é o único
     ponto por onde o cache pode envelhecer — e esquecer de invalidar em algum
     outro lugar seria dinheiro errado na tela, sem erro no console. */
  invalidarRateio();

  const { ini, fim, rotulo } = limitesPeriodo();
  const doPeriodo = noPeriodo(lancamentos, ini, fim);

  pintarHome(doPeriodo, ini, fim);
  pintarLista(doPeriodo);
  pintarTransacoes();
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

  // O número grande é o SEU gasto. O resto do card diz para onde ele foi.
  const valor = qs(".hero__amount");
  if (valor) valor.innerHTML = `R$&thinsp;${brl(r.bruto)}`;

  // variação do gasto contra o período anterior de igual tamanho
  const alvoDelta = qs(".delta");
  if (alvoDelta){
    const ant = periodoAnterior(ini, fim);
    const rAnt = resumo(noPeriodo(lancamentos, ant.ini, ant.fim));
    if (!rAnt.bruto || !r.n){
      alvoDelta.hidden = true;
    } else {
      const pct = ((r.bruto - rAnt.bruto) / rAnt.bruto) * 100;
      alvoDelta.hidden = false;
      alvoDelta.textContent = `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1).replace(".", ",")}%`;
      alvoDelta.classList.toggle("delta--up", pct > 0);
      alvoDelta.title = `Comparado com ${paraBR(ant.ini).slice(0, 5)} – ${paraBR(ant.fim).slice(0, 5)}`;
    }
  }

  const nota = qs(".hero__note");
  if (nota){
    nota.textContent = r.n
      ? `${paraBR(ini).slice(0, 5)} a ${paraBR(fim).slice(0, 5)} · ${r.n} lançamento${r.n === 1 ? "" : "s"} · tudo que você registrou no período.`
      : `${paraBR(ini).slice(0, 5)} a ${paraBR(fim).slice(0, 5)} · nenhum lançamento no período.`;
  }

  // para onde o gasto foi: folha, subsídio da FGV e o seu bolso
  const põeDestaque = (id, hintId, v, hint) => {
    const x = el(id);
    if (x){
      x.textContent = r.n ? `R$ ${brl(v)}` : "—";
      x.classList.toggle("destaque__val--zero", r.n && !v);
    }
    poe(hintId, r.n ? hint : "");
  };
  /* A composição da folha, escrita por extenso. Com a participação valendo, os
     números do card deixam de somar o gasto — a participação é encargo por dia
     de uso, não comida — e a única forma de isso não parecer defeito é mostrar
     de onde vem cada parcela. */
  const partes = [];
  if (r.participacao) partes.push(`PARTICIPAÇÃO R$ ${brl(r.participacao)}`);
  if (r.excedente)    partes.push(`EXCEDENTE R$ ${brl(r.excedente)}`);
  if (r.rei)          partes.push(`REI DO MATE R$ ${brl(r.rei)}`);
  põeDestaque("vFolha", "hFolha", r.desconto,
    partes.length ? partes.join(" + ") : "NADA PASSOU DO TETO DIÁRIO");
  põeDestaque("vSubsidio", "hSubsidio", r.subsidio,
    `A FGV COBRE ATÉ R$ ${brl(pol.teto)} POR DIA NA SAPORE`);

  /* O aviso de estimativa tem redação fixa e diz que a participação está fora
     da conta. Informado o valor, ela entra — e o aviso passaria a mentir. Em
     vez de reescrever um texto que não é meu, ele sai de tela. */
  const avisoEst = el("avisoEstimativa");
  if (avisoEst) avisoEst.hidden = participacaoDoDia(fim) > 0;

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

  // o que você pagou por fora da FGV: só aparece quando existe
  const foraLinha = el("linhaFora");
  if (foraLinha) foraLinha.hidden = !r.fora;
  poe("vFora", `R$ ${brl(r.fora)}`);
  poe("hFora", r.nFora
    ? `${r.nFora} LANÇAMENTO${r.nFora === 1 ? "" : "S"} FORA DA FGV · 0% DE SUBSÍDIO · NÃO VAI PARA A FOLHA`
    : "");

  // barra por local (pelo valor gasto)
  const sap = r.porLocal["Sapore"] || { bruto: 0, n: 0 };
  const rei = r.porLocal["Rei do Mate"] || { bruto: 0, n: 0 };
  const fSap = el("mtSapore"), fRei = el("mtRei"), fFora = el("mtFora"), fVazio = el("mtVazio");
  if (fSap && fRei && fFora && fVazio){
    if (r.bruto > 0){
      fSap.style.flex  = String((sap.bruto / r.bruto) * 100);
      fRei.style.flex  = String((rei.bruto / r.bruto) * 100);
      fFora.style.flex = String((r.fora / r.bruto) * 100);
      fVazio.style.flex = "0";
    } else {
      fSap.style.flex = "0"; fRei.style.flex = "0"; fFora.style.flex = "0"; fVazio.style.flex = "100";
    }
  }
  poe("lgSapore", `Sapore R$ ${brl(sap.bruto)}`);
  poe("lgRei", `Rei R$ ${brl(rei.bruto)}`);
  const lgF = el("lgFora");
  if (lgF){
    lgF.hidden = !r.fora;
    lgF.textContent = `Fora R$ ${brl(r.fora)}`;
  }
}

/** A linha de transação, usada na Home e na tela de todas. */
/** Duas letras para o avatar: SA, RM ou as iniciais do lugar que você escreveu. */
function siglaDoLocal(l){
  if (l.local === "Sapore") return "SA";
  if (l.local === "Rei do Mate") return "RM";
  const p = String(l.localNome || "Outro").trim().split(/\s+/)
    .filter(w => w.length > 2 || /^[A-ZÀ-Ú]/.test(w));
  const base = p.length ? p : [String(l.localNome || "Outro")];
  return ((base[0][0] || "") + (base[1] ? base[1][0] : (base[0][1] || ""))).toUpperCase();
}

/**
 * Quanto a FGV cobriu e quanto sobrou para a folha, nesta nota. O rateio é do
 * DIA: numa segunda nota do mesmo dia o subsídio aparece menor, porque a
 * primeira já consumiu parte do teto. Não inclui a participação de 0,15%, que
 * é do dia e não da nota.
 */
function rotuloFolha(l){
  const s = subsidioDe(l), d = descontoDe(l);
  if (s && d) return `FGV ${brl(s)} · FOLHA ${brl(d)}`;
  if (s) return `FGV ${brl(s)} · SEM DESCONTO`;
  return `FOLHA ${brl(d)}`;
}

function linhaTx(l){
  const revisar = l.status === "revisar";
  const fora = !ehInterno(l.local);
  const classeAvatar = l.local === "Sapore" ? "avatar--blue" : fora ? "avatar--fora" : "";
  const hora = horaDe(l);
  const quando = dataDe(l) === hojeIso() ? `HOJE${hora ? " " + hora : ""}` : paraBR(l.dataHora);
  const meta = [l.categoria, quando].filter(Boolean).join(" · ").toUpperCase();
  const situacao = revisar ? "REVISAR OCR" : fora ? "FORA DA FOLHA" : rotuloFolha(l);
  const classeSit = revisar ? "tx__status--pending" : fora ? "tx__status--fora" : "";
  return `<li>
    <button class="glass tx ${revisar ? "tx--pending" : ""}" type="button" data-editar="${esc(l.id)}">
      <span class="avatar ${classeAvatar}">${esc(siglaDoLocal(l))}</span>
      <span class="tx__body">
        <span class="tx__name">${esc(nomeDoLocal(l))}</span>
        <span class="tx__meta">${esc(meta)}</span>
      </span>
      <span class="tx__side">
        <span class="tx__value">${brl(l.valor)}</span>
        <span class="tx__status ${classeSit}">${situacao}</span>
      </span>
    </button>
  </li>`;
}

const VAZIO_TX = `<li class="glass row"><span class="row__body">
  <span class="row__label">Nenhum lançamento no período</span>
  <span class="row__hint">TOQUE EM + LANÇAMENTO PARA COMEÇAR</span>
</span></li>`;

function pintarLista(lista){
  const alvo = qs("#home .tx-list");
  if (!alvo) return;
  const ordenada = ordenar(lista);
  const btnTudo = el("btnVerTudo");
  if (btnTudo) btnTudo.hidden = lancamentos.length === 0;
  alvo.innerHTML = ordenada.length ? ordenada.slice(0, 6).map(linhaTx).join("") : VAZIO_TX;
}

function pintarEstatisticas(lista, ini, fim, rotulo){
  const e = estatisticas(lista, ini, fim);
  const temDado = e.n > 0;

  poe("periodoLabel", rotulo);

  const sap = e.porLocal["Sapore"] || { bruto: 0, n: 0 };
  const rei = e.porLocal["Rei do Mate"] || { bruto: 0, n: 0 };
  const out = e.porLocal["Outro"] || { bruto: 0, n: 0 };
  const pct = v => e.bruto ? Math.round((v / e.bruto) * 100) : 0;

  poe("stSaporeVal", temDado ? brl(sap.bruto) : "—", !temDado);
  poe("stSaporeMeta", `${sap.n} REFEIÇ${sap.n === 1 ? "ÃO" : "ÕES"} · ${pct(sap.bruto)}%`);
  poe("stReiVal", temDado ? brl(rei.bruto) : "—", !temDado);
  poe("stReiMeta", `${rei.n} LANCHE${rei.n === 1 ? "" : "S"} · ${pct(rei.bruto)}%`);

  const cardFora = el("stForaCard");
  if (cardFora) cardFora.hidden = !out.n;
  poe("stForaVal", out.n ? brl(out.bruto) : "—", !out.n);
  poe("stForaMeta", `${out.n} LANÇAMENTO${out.n === 1 ? "" : "S"} · ${pct(out.bruto)}% · 0% DA FGV`);

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

/* ---------- tela de todas as transações ---------- */
let filtro = { texto: "", local: "", categoria: "", situacao: "",
               min: null, max: null, ini: "", fim: "", ordem: "recente" };

function transacoesFiltradas(){
  return ordenar(aplicarFiltro(lancamentos, filtro), filtro.ordem);
}

function pintarTransacoes(){
  const alvo = el("listaTodas");
  if (!alvo) return;

  const vis = transacoesFiltradas();
  const r = resumo(vis);
  const temFiltro = !!(filtro.texto || filtro.local || filtro.categoria || filtro.situacao
                       || filtro.min != null || filtro.max != null || filtro.ini || filtro.fim);

  poe("txPlacar", vis.length
    ? `${vis.length} de ${lancamentos.length} lançamento${lancamentos.length === 1 ? "" : "s"} · `
      + `R$ ${brl(r.bruto)} gastos · R$ ${brl(r.desconto)} em folha`
      + (r.fora ? ` · R$ ${brl(r.fora)} fora da FGV` : "")
    : lancamentos.length ? "Nada casou com esse filtro" : "Você ainda não lançou nada");

  const limpar = el("btnLimparFiltro");
  if (limpar) limpar.hidden = !temFiltro;

  alvo.innerHTML = vis.length ? vis.map(linhaTx).join("")
    : `<li class="glass row"><span class="row__body">
        <span class="row__label">${temFiltro ? "Nenhum lançamento com esses critérios" : "Nenhum lançamento ainda"}</span>
        <span class="row__hint">${temFiltro ? "TOQUE EM LIMPAR PARA VER TUDO" : "TOQUE EM + LANÇAMENTO NA TELA INICIAL"}</span>
      </span></li>`;
}

function lerFiltroDaTela(){
  filtro.texto = el("fTexto")?.value || "";
  filtro.categoria = el("fCategoria")?.value || "";
  filtro.situacao = el("fSituacao")?.value || "";
  const mn = paraValor(el("fMin")?.value), mx = paraValor(el("fMax")?.value);
  filtro.min = isFinite(mn) ? mn : null;
  filtro.max = isFinite(mx) ? mx : null;
  filtro.ini = el("fIni")?.value || "";
  filtro.fim = el("fFim")?.value || "";
  pintarTransacoes();
}

function limparFiltro(){
  filtro = { texto: "", local: "", categoria: "", situacao: "",
             min: null, max: null, ini: "", fim: "", ordem: filtro.ordem };
  ["fTexto", "fMin", "fMax", "fIni", "fFim"].forEach(id => { const x = el(id); if (x) x.value = ""; });
  ["fCategoria", "fSituacao"].forEach(id => { const x = el(id); if (x) x.value = ""; });
  qsa("#fLocais .chip").forEach(c => c.classList.toggle("is-active", !c.dataset.flocal));
  pintarTransacoes();
  aviso("Filtro limpo.");
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

  const hPart = el("hParticipacao");
  if (hPart){
    const s = num(privado.salarioBase);
    const pct = String(politicaEm(hojeIso()).taxaPct).replace(".", ",");
    hPart.textContent = s > 0
      ? `${pct}% = R$ ${brl(participacaoDoDia())} POR DIA · SÓ NESTE APARELHO, NUNCA VAI PARA A NUVEM`
      : `A INFORMAR · SEM ELE A PARTICIPAÇÃO DE ${pct}% FICA FORA DA CONTA`;
  }
  const vPart = el("pSalario");
  if (vPart){
    const s = num(privado.salarioBase);
    vPart.textContent = s > 0 ? `R$ ${brl(s)}` : "a informar";
    vPart.classList.toggle("stat__val--pending", !s);
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
        <span class="row__label">Subsídio R$ ${brl(p.teto)}/dia · participação ${String(p.taxaPct).replace(".", ",")}%</span>
        <span class="row__hint">A PARTIR DE ${esc(paraBR(p.vigencia))}${p.id === vigente.id ? " · VIGENTE" : ""}</span>
      </span>
      <button class="link-btn" type="button" data-excpol="${esc(p.id)}">Remover</button>
    </li>`).join("")
    : `<li class="glass row"><span class="row__body">
        <span class="row__label">Nenhuma política cadastrada</span>
        <span class="row__hint">USANDO O PADRÃO: SUBSÍDIO R$ ${brl(TETO_PADRAO)}/DIA · PARTICIPAÇÃO ${String(TAXA_PADRAO).replace(".", ",")}%</span>
      </span></li>`;

  poe("polVigente", `Subsídio de R$ ${brl(vigente.teto)} por DIA de consumo na Sapore — duas refeições no mesmo dia dividem um teto só. A participação é de ${String(vigente.taxaPct).replace(".", ",")}% do salário base por dia com consumo; o valor em reais fica no Perfil de cada um, porque o app não pede o salário.`);
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
let chartGastos = null, chartLocal = null;
let escalaGrafico = "dia";      // dia | mes
let tipoGrafico = "linha";      // linha | barra

/** Escreve o total no buraco da rosca. Plugin de 15 linhas em vez de dependência. */
const centroDaRosca = {
  id: "centroDaRosca",
  afterDatasetsDraw(chart, _a, opts){
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data[0]) return;
    const { x, y } = meta.data[0];
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = opts.corRotulo || "#8C9CB2";
    ctx.font = "400 9px 'IBM Plex Mono', monospace";
    ctx.fillText("TOTAL", x, y - 12);
    ctx.fillStyle = opts.corValor || "#F3F7FC";
    ctx.font = "500 20px 'IBM Plex Mono', monospace";
    ctx.fillText("R$ " + brl(opts.total || 0), x, y + 11);
    ctx.restore();
  }
};

function pintarGraficos(lista){
  if (typeof Chart === "undefined") return;

  const cor = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const azul  = cor("--fgv-blue") || "#2E7BD4";
  const ambar = cor("--amber") || "#FFB84D";
  const grade = "rgba(255,255,255,.07)";
  const texto = cor("--muted-2") || "#6B7B92";
  const claro = cor("--text-2") || "#C3D0E0";

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
      const linha = tipoGrafico === "linha";
      chartGastos = new Chart(cvGastos, {
        type: linha ? "line" : "bar",
        data: {
          labels: rotulos,
          datasets: linha
            ? [
                { label: "Consumo bruto", data: serie.map(p => p.bruto),
                  borderColor: azul, backgroundColor: "rgba(46,123,212,.18)",
                  borderWidth: 2, tension: .35, fill: true,
                  pointRadius: 2.5, pointBackgroundColor: azul },
                { label: "Desconto em folha", data: serie.map(p => p.desconto),
                  borderColor: ambar, backgroundColor: "rgba(255,184,77,.14)",
                  borderWidth: 2, tension: .35, fill: true,
                  pointRadius: 2.5, pointBackgroundColor: ambar }
              ]
            : [
                { label: "Desconto em folha", data: serie.map(p => p.desconto),
                  backgroundColor: ambar, borderRadius: 4 },
                { label: "Subsídio FGV", data: serie.map(p => p.bruto - p.desconto),
                  backgroundColor: azul, borderRadius: 4 }
              ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { position: "bottom",
                      labels: { color: claro, boxWidth: 9, boxHeight: 9,
                                usePointStyle: true, pointStyle: "circle",
                                font: { size: 10 } } },
            tooltip: { callbacks: { label: c => `${c.dataset.label}: R$ ${brl(c.parsed.y)}` } }
          },
          scales: {
            x: { stacked: !linha, grid: { display: false },
                 ticks: { color: texto, font: { size: 9 } } },
            y: { stacked: !linha, beginAtZero: true, grid: { color: grade },
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
      const cinza = cor("--muted") || "#8C9CB2";
      const visiveis = LOCAIS.filter(n => (r.porLocal[n] || { bruto: 0 }).bruto > 0);
      const corDoLocal = { "Sapore": azul, "Rei do Mate": ambar, "Outro": cinza };
      chartLocal = new Chart(cvLocal, {
        type: "doughnut",
        data: {
          labels: visiveis.map(n => n === "Outro" ? "Fora da FGV" : n),
          datasets: [{
            data: visiveis.map(n => r.porLocal[n].bruto),
            backgroundColor: visiveis.map(n => corDoLocal[n]), borderWidth: 0, hoverOffset: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "66%",
          plugins: {
            legend: { display: false },   // a legenda com valor e % está no HTML
            centroDaRosca: { total: r.bruto, corRotulo: texto, corValor: cor("--text") || "#F3F7FC" },
            tooltip: { callbacks: {
              label: c => {
                const pct = r.bruto ? (c.parsed / r.bruto) * 100 : 0;
                return `${c.label}: R$ ${brl(c.parsed)} · ${pct.toFixed(1).replace(".", ",")}%`;
              }
            } }
          }
        },
        plugins: [centroDaRosca]
      });
    }
  }

  // legenda da rosca: nome, valor e percentual, que o gráfico sozinho não diz
  const leg = el("legendaLocal");
  if (leg){
    const cinza = cor("--muted") || "#8C9CB2";
    const cores = { "Sapore": azul, "Rei do Mate": ambar, "Outro": cinza };
    const rotulo = { "Sapore": "Sapore", "Rei do Mate": "Rei do Mate", "Outro": "Fora da FGV" };
    leg.innerHTML = LOCAIS
      .filter(nome => nome !== "Outro" || (r.porLocal[nome] || {}).n)
      .map(nome => {
        const d = r.porLocal[nome] || { bruto: 0, n: 0, desconto: 0 };
        const pct = r.bruto ? (d.bruto / r.bruto) * 100 : 0;
        return `<li>
          <span class="leg__dot" style="background:${cores[nome]}"></span>
          <span class="leg__nome">${esc(rotulo[nome])}</span>
          <span class="leg__meta">${d.n} lanç.</span>
          <span class="leg__pct">${pct.toFixed(1).replace(".", ",")}%</span>
          <b class="leg__val">R$ ${brl(d.bruto)}</b>
        </li>`;
      }).join("");
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
  põe("campoSemSubsidio", l && num(l.valorSemSubsidio) ? brl(l.valorSemSubsidio) : "");
  põe("campoData",      l ? l.dataHora : (manual ? agoraIso() : ""));
  põe("campoItens",     l ? l.itens : "");
  põe("campoMatricula", l ? l.matricula : prefs.matricula);
  põe("campoCupom",     l ? l.numeroCupom : "");
  põe("campoCnpj",      l ? l.cnpj : "");
  põe("campoObs",       l ? l.observacao : "");
  põe("campoLocalNome", l ? l.localNome : "");

  const cat = el("campoCategoria");
  if (cat) cat.value = (l && l.categoria) || CATEGORIAS[0];

  marcarLocal((l && l.local) || "Sapore");

  /* Zera o palpite do leitor anterior: nota e selo de CONFIRA são de UMA leitura,
     e ficar na tela do lançamento seguinte apontaria para item que não existe. */
  const notaSS = el("notaSemSubsidioOCR");
  if (notaSS){ notaSS.hidden = true; notaSS.textContent = ""; }
  const wrapSS = el("campoSemSubsidioWrap");
  if (wrapSS){
    wrapSS.classList.remove("field--check");
    const emSS = wrapSS.querySelector("em"); if (emSS) emSS.hidden = true;
  }

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
  // o nome do lugar só faz sentido quando não é Sapore nem Rei do Mate
  const wrap = el("campoLocalNomeWrap");
  if (wrap) wrap.hidden = local !== "Outro";
  const aviso0 = el("avisoSemSubsidio");
  if (aviso0) aviso0.hidden = local !== "Outro";
  /* Item sem subsídio só existe na Sapore: no Rei do Mate tudo é integral e o
     "Outro" nem passa pela folha. */
  const semSub = el("campoSemSubsidioWrap");
  if (semSub) semSub.hidden = local !== "Sapore";
}

function lerFormulario(){
  const dataIso = normalizaDataHora(el("campoData")?.value);
  const valor = paraValor(el("campoValor")?.value);
  if (!dataIso) return { erro: "Escolha a data e a hora." };
  if (!isFinite(valor) || valor <= 0) return { erro: "Informe um valor maior que zero." };

  const ativo = qs("#grupoLocal button.is-active");
  const anterior = editandoId ? lancamentos.find(l => l.id === editandoId) : null;
  const local = ativo ? ativo.dataset.local : "Sapore";
  const localNome = (el("campoLocalNome")?.value || "").trim();
  if (local === "Outro" && !localNome) return { erro: "Escreva onde foi — ex: Bar do Bigode." };

  /* Quanto desta nota não tem subsídio (geladeira, sobremesa elaborada). Só
     faz sentido na Sapore, e nunca pode passar do total da nota — senão o
     subsídio viraria negativo. */
  const semSub = paraValor(el("campoSemSubsidio")?.value);
  const valorSemSubsidio = local === "Sapore" && isFinite(semSub) && semSub > 0 ? semSub : 0;
  if (valorSemSubsidio > valor){
    return { erro: "O valor sem subsídio não pode ser maior que o total da nota." };
  }

  return { item: {
    id: editandoId || "",
    dataHora: dataIso,
    local,
    localNome: local === "Outro" ? localNome : "",
    categoria: el("campoCategoria")?.value || CATEGORIAS[0],
    valor,
    valorSemSubsidio,
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

/** Devolve { local, nome } aprendido para um CNPJ. Aceita o formato antigo (string). */
function conhecidoPorCnpj(cnpj){
  const d = String(cnpj || "").replace(/\D/g, "");
  if (d.length !== 14) return null;
  const g = (prefs.cnpjLocal && prefs.cnpjLocal[d]) || CNPJ_LOCAL[d];
  if (!g) return null;
  return typeof g === "string" ? { local: g, nome: "" } : g;
}
function localPorCnpj(cnpj){
  const c = conhecidoPorCnpj(cnpj);
  return c ? c.local : "";
}

/** Você corrigiu a lanchonete de um CNPJ? O app aprende e não erra de novo. */
function aprenderCnpj(cnpj, local, nome){
  const d = String(cnpj || "").replace(/\D/g, "");
  if (d.length !== 14 || !local) return;
  const novo = { local, nome: local === "Outro" ? String(nome || "").trim() : "" };
  const atual = conhecidoPorCnpj(d);
  if (atual && atual.local === novo.local && (atual.nome || "") === novo.nome) return;
  prefs.cnpjLocal = prefs.cnpjLocal || {};
  prefs.cnpjLocal[d] = novo;
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
    põe("campoData", campos.dataHora || agoraIso());
    põe("campoItens", campos.itens);
    põe("campoMatricula", campos.matricula || prefs.matricula);

    /* O que o leitor achou de geladeira e sobremesa elaborada. Vai como
       SUGESTÃO: o valor entra no campo e os itens reconhecidos aparecem escritos
       do lado, para você conferir antes de salvar. Se ele errou, é só corrigir o
       número — a lista de palavras não decide dinheiro sozinha. */
    const notaSS = el("notaSemSubsidioOCR");
    const wrapSS = el("campoSemSubsidioWrap");
    const achouSS = campos.semSubsidio > 0;
    if (achouSS){
      põe("campoSemSubsidio", brl(campos.semSubsidio));
      if (notaSS){
        notaSS.hidden = false;
        /* Cupom em que nada foi reconhecido como subsidiável quase sempre é
           falha de leitura, não refeição inteira sem subsídio. Dizer isso é
           mais honesto que apresentar o número como se fosse conclusão. */
        notaSS.textContent = campos.achouSubsidiavel
          ? `O leitor achou ${brl(campos.semSubsidio)} sem subsídio: `
            + campos.itensSemSubsidio.join(", ").toLowerCase() + ". Confira."
          : `O leitor não reconheceu nenhum item com subsídio neste cupom e jogou `
            + `${brl(campos.semSubsidio)} para a folha. Pode ser falha de leitura — confira.`;
      }
    } else if (notaSS){
      notaSS.hidden = true;
      notaSS.textContent = "";
    }
    if (wrapSS){
      wrapSS.classList.toggle("field--check", achouSS);
      const emSS = wrapSS.querySelector("em"); if (emSS) emSS.hidden = !achouSS;
    }
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
    if (d && !d.value) d.value = agoraIso();
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
/* ---------- o que do cupom tem subsídio, e o que não tem ----------
   A ordem da decisão é DELIBERADA e o padrão é restritivo:

     1. casou em SEM_SUBSIDIO  -> não tem subsídio
     2. casou em COM_SUBSIDIO  -> tem subsídio
     3. não casou em nada      -> NÃO TEM SUBSÍDIO

   O passo 3 é a escolha que importa. O DRH nomeou o que entra (kilo, básico,
   suco de máquina, fruta, gelatina) e o que não entra (geladeira, sobremesa
   elaborada), e não disse o que fazer com o resto. Duas razões para o resto
   ficar de fora:
   — a instituição lê benefício pelo lado que gasta menos, e é essa leitura que
     aparece no contracheque;
   — este app PREVÊ desconto. Prever desconto maior do que vem é susto que não
     acontece; prever menor é susto no contracheque.
   Os padrões são sem acento e em minúsculas porque a comparação passa por
   chave(), que normaliza. */
const SEM_SUBSIDIO = [
  // de geladeira
  /refrig/, /coca/, /guaran/, /fanta/, /sprite/, /pepsi/, /schwepp/, /tonica/,
  /agua com gas/, /agua c\/ gas/, /agua mineral/, /agua sem gas/, /agua s\/ gas/,
  /suco.*(lata|garrafa|cx|caixa|long neck)/, /del valle/, /cha gelado/, /mate leao/,
  /cerveja/, /energetic/, /red bull/, /gatorade/, /isoton/, /h2oh/,
  /iogurte/, /danone/, /leite ferment/, /yakult/, /chocolate ao leite/,
  // sobremesa elaborada
  /\bbolo/, /torta/, /pudim/, /mousse/, /brigadeir/, /doce de leite/, /beijinho/,
  /salada de frut/, /sorvete/, /picole/, /acai/, /petit gateau/, /cheesecake/,
  /brownie/, /pave/, /churros/, /cannoli/, /tiramisu/, /banoffee/,
];

/* O que tem subsídio: o basicão e mais nada. É a lista fechada que o DRH
   nomeou — kilo, prato básico, suco de máquina, fruta e gelatina — com as
   variações de escrita que o cupom e o OCR produzem para a MESMA coisa
   (self-service, por peso, refeição, quilo com q). Não acrescente item aqui
   sem o DRH ter dito que entra: cada palavra a mais é dinheiro que o app
   deixa de prever como desconto. */
const COM_SUBSIDIO = [
  /\bkilo\b/, /\bquilo\b/, /\bkg\b/, /self.?serv/, /por peso/, /a peso/,
  /\bbasic/, /prato basic/, /refeic/, /\bbufe\b/, /buffet/,
  /suco/, /\bfruta/, /gelatina/,
];

/**
 * Uma linha do cupom tem subsídio? A ordem decide, e o padrão é NÃO.
 * O que não está nomeado pelo DRH como incluído fica de fora: na dúvida, vai
 * integral para a folha. Ver o comentário de SEM_SUBSIDIO para o porquê.
 */
function temSubsidio(linha){
  const t = chave(linha);
  if (SEM_SUBSIDIO.some(re => re.test(t))) return false;   // geladeira, sobremesa elaborada
  return COM_SUBSIDIO.some(re => re.test(t));              // não nomeado = não entra
}

/** O contrário, que é o que o formulário precisa somar. */
const naoTemSubsidio = linha => !temSubsidio(linha);

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
                matricula: "", numeroCupom: "", cnpj: "",
                semSubsidio: 0, itensSemSubsidio: [], achouSubsidiavel: false };

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
  /* --- a parte do cupom sem subsídio, para o formulário já abrir sugerindo ---
     Percorre as linhas que têm valor e soma as que NÃO têm subsídio — incluindo
     as que o leitor não reconheceu, porque na dúvida não entra. De cada linha
     vale o MAIOR valor: numa linha "2 x 4,50   9,00" o total da linha é o 9,00,
     e é ele que vai para a folha; o 4,50 é o unitário. */
  for (const l of linhas){
    if (!util(l) || RE_TOTAL.test(l) || RE_SUBTOTAL.test(l) || RE_APAGAR.test(l)) continue;
    const vals = valoresDe(l);
    if (!vals.length) continue;
    if (temSubsidio(l)){ out.achouSubsidiavel = true; continue; }
    out.semSubsidio += Math.max(...vals);
    const nome = l.replace(/(?:R\$\s*)?\b[\d.]*\d[.,]\d{2,}\b/g, "")
                  .replace(/^\s*\d{1,3}\s*[-.)]?\s+/, "").replace(/^\s*\d{5,}\s*/, "")
                  .replace(/\s{2,}/g, " ").trim();
    if (nome) out.itensSemSubsidio.push(nome.slice(0, 24));
  }
  /* Nunca pode passar do total do cupom: a soma por linha erra para cima quando
     o OCR duplica um valor, e semSubsidio maior que valor daria subsídio
     negativo. O formulário já recusa, mas melhor não sugerir o impossível. */
  out.semSubsidio = Math.min(Math.round(out.semSubsidio * 100) / 100, num(out.valor) || Infinity);

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

  const tipoG = achar("data-tipo-grafico");
  if (tipoG){
    tipoGrafico = tipoG.dataset.tipoGrafico;
    qsa("#chartTipos button").forEach(b => b.classList.toggle("is-active", b === tipoG));
    const { ini, fim } = limitesPeriodo();
    return pintarGraficos(noPeriodo(lancamentos, ini, fim));
  }

  const chipLocal = achar("data-flocal");
  if (chipLocal){
    filtro.local = chipLocal.dataset.flocal || "";
    qsa("#fLocais .chip").forEach(c => c.classList.toggle("is-active", c === chipLocal));
    return pintarTransacoes();
  }

  const ordem = achar("data-ordem");
  if (ordem){
    filtro.ordem = ordem.dataset.ordem;
    qsa("#fOrdem button").forEach(b => b.classList.toggle("is-active", b === ordem));
    return pintarTransacoes();
  }

  if (achar("data-limpar-filtro")) return limparFiltro();

  if (achar("data-exportar-filtrado")){
    const vis = transacoesFiltradas();
    if (!vis.length) return aviso("Nada para exportar com esse filtro.");
    return baixarCSV(vis, "filtrado");
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

  if (achar("data-salario")){
    return pedirCampo("Meu salário-base", "FICA SÓ NESTE APARELHO — NUNCA VAI PARA A NUVEM",
      privado.salarioBase ? brl(privado.salarioBase) : "", "numero", v => {
        const n = paraValor(v);
        privado.salarioBase = isFinite(n) && n > 0 ? n : null;
        gravarPrivado();   // de propósito: NÃO é gravarPrefs, que sincroniza
        pintar();          // muda o desconto em todas as telas, não só no Perfil
        aviso(privado.salarioBase
          ? `Salário salvo neste aparelho. Participação de R$ ${brl(participacaoDoDia())} por dia.`
          : "Salário removido. O desconto volta a ser estimativa por baixo.");
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
    if (!isFinite(teto) || teto < 0) return aviso("Informe o subsídio por dia.");
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
  aprenderCnpj(item.cnpj, item.local, item.localNome);   // corrigiu o local? não erra de novo
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

/* filtro da tela de transações: digitar já filtra, sem botão de "buscar" */
["fTexto", "fMin", "fMax"].forEach(id => el(id)?.addEventListener("input", lerFiltroDaTela));
["fCategoria", "fSituacao", "fIni", "fFim"].forEach(id => el(id)?.addEventListener("change", lerFiltroDaTela));

function baixarCSV(lista, sufixo){
  const csv = "﻿" + paraCSV(lista);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `meu-bandejao-${sufixo}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  aviso(`${lista.length} lançamento${lista.length === 1 ? "" : "s"} no arquivo.`);
}

function exportarCSV(){
  const { ini, fim } = limitesPeriodo();
  const lista = noPeriodo(lancamentos, ini, fim);
  if (!lista.length) return aviso("Nada para exportar neste período.");
  baixarCSV(lista, `${ini}-a-${fim}`);
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
  migrarParticipacao();   // tira do prefs local o que era sensível
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

    /* O perfil remoto acabou de ser mesclado: se ele trouxe a participação em
       reais de uma versão anterior, ela volta a estar em prefs. Migra agora —
       e só agora salvarPerfil existe, então é esta chamada que apaga o campo
       no Firestore. */
    migrarParticipacao();

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
