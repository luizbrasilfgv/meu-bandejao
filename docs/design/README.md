# Handoff: Meu Bandejão — app de controle e conciliação de refeitório

## Visão geral
App web mobile-first para um colaborador registrar o que consome nas lanchonetes internas
(**Sapore** — refeição, **Rei do Mate** — café/lanche), acompanhar quanto vai cair como desconto
na folha e, futuramente, conferir esse valor contra o contracheque.

Objetivo central do produto: o usuário saber, antes do fechamento, o tamanho do desconto que virá
no contracheque.

## Sobre os arquivos deste pacote
Os arquivos `index.html` e `style.css` são **referência de design feita em HTML/CSS puros** —
protótipo que mostra aparência e comportamento pretendidos, não código de produção para copiar cru.
A tarefa é **recriar estas telas no ambiente do projeto final** (React, Vue, Angular, Flutter,
nativo etc.) seguindo os padrões já existentes lá. Se ainda não existe ambiente, escolher a stack
e implementar o design nela.

O HTML é utilizável como base direta caso a decisão seja seguir sem framework: ele não tem
dependências além das fontes do Google Fonts e do Chart.js (opcional, comentado).

## Fidelidade
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios e estados estão definidos e devem
ser reproduzidos fielmente. Exceção: **todo número monetário é exemplo** — ver "Dados pendentes".

---

## Regras de conteúdo que valem para quem continuar

1. **Não inventar dados.** Nenhum valor, preço, política de RH ou regra de cálculo deve ser suposto.
   Se o dado não existe, o campo aparece vazio (`—`) ou marcado como pendente na interface.
2. **Textos definidos pelo usuário são literais.** O aviso de estimativa (abaixo) tem redação fixa:

   > Este valor é uma estimativa e não inclui o desconto fixo de 0,15% do seu salário base por refeição, omitido por privacidade

3. **O app não pede nem armazena salário** (LGPD). Por isso a taxa de 0,15% por refeição nunca entra
   no cálculo, e todo valor de desconto mostrado é uma estimativa por baixo.
4. A faixa `DADOS DE EXEMPLO · AGUARDANDO SEU RELATÓRIO DE CONSUMO` no topo do app existe justamente
   porque os números das telas são exemplo. **Remover essa faixa somente quando os dados reais
   entrarem.**

---

## Regras de negócio confirmadas

- Identificação na lanchonete: **crachá / matrícula**. O pagamento é **desconto direto em folha**
  (não há cartão nem dinheiro no fluxo principal).
- As lanchonetes enviam o consumo à FGV **por quinzena** (01–15 e 16 ao último dia).
- No contracheque aparece **uma linha de desconto** (rubrica de refeitório/alimentação) que soma
  **a quinzena anterior com a quinzena atual** — por isso a conciliação precisa ser por quinzena, não
  por mês fechado.
- Existe **teto mensal** (valor fixo por mês). **O valor não foi informado.**
- Existe uma taxa de **0,15% do salário base por ida ao refeitório**, cobrada do colaborador.
  O app **não** calcula isso (ver regra 3 acima) — apenas avisa que o valor exibido não a inclui.
- Período padrão do app: **mês civil**, com seleção livre de data início/fim.
- Entrada de lançamento: **obrigatoriamente foto do cupom com OCR**, com revisão dos campos antes de
  salvar. Lançamento manual existe como alternativa (cupom ilegível).

### O que o cupom traz (campos que o OCR deve extrair)
`valor total` · `data e hora` · `itens consumidos` · `nome da lanchonete` ·
`matrícula ou nome do colaborador` · `CNPJ` · `número do cupom`

---

## Dados pendentes — precisam ser recebidos do usuário

| Pendência | Impacto na implementação |
|---|---|
| Relatório de consumo detalhado (Sapore / Rei do Mate) | Substitui todos os números de exemplo; alimenta lista, estatísticas e quinzenas |
| Valor do teto mensal | Card "Teto mensal" no Perfil e alerta de limite |
| Origem do valor da folha (digitado, PDF do holerite, relatório das lanchonetes, integração RH) | Coluna "NA FOLHA" da tela Conciliar |
| Nível da comparação (só o total da quinzena ou item a item) | Modelo de dados da conciliação |
| Tratamento da divergência (registrar, contestar no RH, apenas sinalizar) | Ações da tela Conciliar |
| Serviço de OCR a ser usado | Contrato do passo 1 → 2 do modal |
| Cores oficiais da FGV (hex do manual) | Tokens `--fgv-navy`, `--fgv-blue`, `--fgv-blue-2` |

---

## Telas

Cinco telas em um único documento, alternadas por classe (`.screen.is-active`) e barra inferior fixa.
Uma sexta superfície é o modal de lançamento.

### 1. Home (`#home`)
**Propósito:** resumo do período e atalhos de lançamento.

Ordem dos blocos:
1. `.topbar` — marca (ícone 40×40 + "Meu Bandejão" + meta `AGOSTO 2026 · 18 LANÇAMENTOS`) e botão
   de notificações 44×44 com ponto âmbar.
2. `.hero` (card de vidro, padding 22px) — label `DESCONTO PREVISTO EM FOLHA *`, badge de variação,
   valor em mono 42px (`R$ 412,80`, exemplo), nota do período, **aviso de estimativa** (`.disclaimer`),
   split 1ª/2ª quinzena com valores `—`, barra Sapore/Rei do Mate e legenda.
3. `.quick` — dois botões lado a lado: **Escanear recibo** (ícone câmera, gradiente âmbar) e
   **Lançar manual** (ícone +, gradiente azul). Abrem o modal nos modos `scan` e `manual`.
4. `Transações recentes` — 4 linhas `.tx`; estados: normal (`CONFERIDO`, verde) e
   `.tx--pending` (`REVISAR OCR`, âmbar).
5. `.wip` — card explicando as duas linhas na folha (envio quinzenal).

### 2. Estatísticas (`#estatisticas`)
**Propósito:** gráficos e números do período.

1. `.page-title` — "Estatísticas" + rótulo do período (atualizado por JS).
2. Seletor de período: chips `Mês atual` / `Mês anterior` / `Escolher datas`; o terceiro revela
   `.range` com dois `input[type=date]` (`#dataInicio`, `#dataFim`).
3. Card `Evolução do gasto` com abas `Por dia` / `Por mês` e `canvas#chartGastos`.
4. Card `Onde o crédito foi` com `canvas#chartPorLocal` (rosca).
5. Dois pares de KPIs: Sapore / Rei do Mate; Gasto projetado / Maior dia.
6. Card `Ritmo do período`: média por dia útil, nº de lançamentos, barra de progresso do período.

### 3. Conciliar (`#conciliar`) — **em construção**
Selo `EM CONSTRUÇÃO`. Tabela `.quinz` de 3 colunas (`QUINZENA` / `NO APP` / `NA FOLHA`) com três
quinzenas e todos os valores `—`. Abaixo, lista das três decisões pendentes (origem do valor da
folha, quebra das duas linhas do mês, tratamento da divergência).

### 4. Perfil (`#perfil`)
Card da pessoa (avatar 58px, nome, matrícula, e-mail), dois KPIs (`TETO MENSAL` = "a informar",
`ENVIO À FOLHA` = 2× por quinzena) e lista de preferências: alerta de limite (switch),
lembrete de recibo (switch), identificação na lanchonete, exportar lançamentos, sair.

### 5. Dúvidas (`#duvidas`)
1. Card `Memória de cálculo` — tabela `.formula` com 4 linhas; a última (destacada em âmbar) diz
   que o desconto é estimativa sem os 0,15%. Abaixo, o aviso literal.
2. Card LGPD — salário não entra no app.
3. Acordeão `<details>` com 7 perguntas (estimativa, duas linhas na folha, salário, número da Home,
   origem dos lançamentos, período, status conferido/revisar OCR, conciliação, privacidade).

### 6. Modal de lançamento (`#sheetRecibo`)
Bottom sheet no mobile, card centralizado a partir de 700px. Dois passos:

- **Passo 1 — captura** (`#stepScan`): moldura tracejada 210px com 4 cantos âmbar e instrução;
  botão primário `Escanear recibo` (abre `input[type=file][accept=image/*][capture=environment]`),
  botão fantasma `Escolher da galeria`, link `Preencher manualmente`.
- **Passo 2 — revisão** (`#stepReview`): barra verde `Cupom lido`, miniatura do arquivo com nome e
  confiança, e campos editáveis: valor, data e hora (com marcador `CONFIRA` quando a confiança é
  baixa), estabelecimento (toggle Sapore / Rei do Mate), categoria (select), itens consumidos,
  matrícula no cupom, nº do cupom, CNPJ, observação. Rodapé: `Descartar` (fantasma) e
  `Salvar lançamento` (primário).

No modo **manual** o app: troca o título para "Lançamento manual", esconde a barra de OCR e a
miniatura, limpa todos os campos e remove o marcador `CONFIRA`.

---

## Interações e comportamento

| Gatilho | Comportamento |
|---|---|
| Botão da tabbar (`[data-nav]`) | Ativa a `.screen` correspondente, marca a aba, `scrollTo(0,0)` |
| FAB / `Escanear recibo` (`[data-open="scan"]`) | Abre o modal no passo de captura |
| `Lançar manual` (`[data-open="manual"]`) | Abre o modal no passo de revisão, campos vazios |
| Arquivo escolhido | Gera preview com `URL.createObjectURL`, mostra nome do arquivo, vai ao passo 2. **Aqui entra a chamada ao OCR** |
| `Trocar foto` (`[data-step="scan"]`) | Volta ao passo 1 |
| Clique no fundo do modal, `[data-close]` ou `Esc` | Fecha o modal |
| Chip de período | Ativa o chip, abre/fecha `.range`, atualiza o rótulo do período |
| `change` nos inputs de data | Rótulo passa a `dd/mm – dd/mm` |
| Abas do gráfico / toggle de estabelecimento | Troca `.is-active` e `aria-checked` |
| Switch do Perfil | Alterna `.is-on` e `aria-checked` |

Animações: `sheet-up` 280ms `cubic-bezier(.22,.9,.3,1)` na entrada do modal (respeita
`prefers-reduced-motion`); switch 180ms; chevron do acordeão 180ms; `:active` do botão translada 1px.

---

## Estado necessário

- `telaAtiva`: `home | estatisticas | conciliar | perfil | duvidas`
- `modal`: `{ aberto: bool, modo: 'scan' | 'manual', passo: 'scan' | 'review' }`
- `periodo`: `{ preset: 'atual' | 'anterior' | 'custom', inicio: Date, fim: Date }`
- `lancamento` (rascunho do modal): `{ arquivo, valor, dataHora, estabelecimento, categoria, itens, matricula, numeroCupom, cnpj, observacao, confiancaOCR }`
- `lancamentos[]`: lista persistida, cada item com `status: 'conferido' | 'revisar'`
- `preferencias`: `{ alertaLimite: bool, lembreteRecibo: bool, tetoMensal: number | null }`
- Derivados: total do período, total por lanchonete, total por quinzena, média por dia útil,
  gasto projetado, maior dia.

Persistência: os recibos ficam no dispositivo (o rodapé do login do protótipo anterior dizia
"seus recibos ficam no seu dispositivo"). Nada é enviado ao RH sem ação do usuário.

---

## Gráficos (Chart.js)

Os dois `canvas` já existem, com estilo responsivo pronto e **sem dados**:

```
#chartGastos     dentro de .chart-box#chartBox        altura 168px — evolução no período
#chartPorLocal   dentro de .chart-box--donut#chartBoxLocal  altura 200px — Sapore × Rei do Mate
```

Regras: `responsive: true`, `maintainAspectRatio: false`; o wrapper `.chart-box` define a altura e o
canvas ocupa 100%. Enquanto não há dados, `.chart-empty` mostra o aviso; ao plotar, adicionar a
classe `.has-data` no wrapper para escondê-lo. O `<script>` do CDN e um exemplo de init estão
comentados no fim do `index.html`.

---

## Design tokens

Todos declarados em `:root` no `style.css`.

### Marca (substituir pelos hex oficiais da FGV)
| Token | Valor atual | Uso |
|---|---|---|
| `--fgv-navy` | `#0B2B5C` | azul institucional escuro |
| `--fgv-blue` | `#2E7BD4` | destaque, gradiente azul |
| `--fgv-blue-2` | `#5AA7F0` | links, valores secundários |

### Acentos funcionais
`--amber #FFB84D` (alimentação/atenção) · `--green #4ADE9E` (conferido) · `--red #FF7A7A` (divergência)

### Base escura
`--bg #070E19` · `--bg-2 #0A1424` · `--ink #08111F`

Atmosfera: dois halos radiais fixos em `body::before` (azul, topo) e `body::after` (âmbar, base).

### Vidro (glassmorphism)
| Token | Valor |
|---|---|
| `--glass` | `rgba(255,255,255,.055)` |
| `--glass-2` | `rgba(255,255,255,.085)` |
| `--glass-line` | `rgba(255,255,255,.10)` |
| `--glass-line-2` | `rgba(255,255,255,.16)` |
| `--blur` | `blur(18px) saturate(140%)` |

Sombra dos cards: `inset 0 1px 0 rgba(255,255,255,.07), 0 12px 30px rgba(3,8,16,.45)`.
Há fallback `@supports not (backdrop-filter)` que troca o vidro por superfícies opacas.

### Texto
`--text #F3F7FC` · `--text-2 #C3D0E0` · `--muted #8C9CB2` · `--muted-2 #6B7B92`

### Tipografia
- `--sans`: **Archivo** (400/500/600/700) — títulos, rótulos, botões
- `--mono`: **IBM Plex Mono** (400/500/600) — todos os números e metadados em caixa alta

Escala aplicada: hero 42px/500 mono `letter-spacing -.035em` · título de tela 22px/600 ·
título de card 13.5px/600 · nome de linha 13.5px/500 · valor de linha 14px/500 mono ·
rótulo 10px/400 mono `letter-spacing .14em` uppercase · meta 10.5px/400 mono ·
rótulo de aba 8.5px/400 mono.

### Forma e espaçamento
`--r-sm 10px` · `--r-md 14px` · `--r-lg 20px` · `--r-xl 26px` · `--pad 18px` (gutter lateral) ·
`--app-w 460px` (largura máxima do app).
Gradientes: `--grad-blue linear-gradient(145deg,#2E7BD4,#1B57A8)` ·
`--grad-amber linear-gradient(145deg,#FFD07A,#FF9F1C)`.
Brilho do botão primário: `0 14px 34px rgba(255,159,28,.38)`.

### Acessibilidade e responsivo
- Alvos de toque com `min-height` 44px (botões de ícone, linhas, switches) e 52–58px nos primários.
- Mobile-first sem breakpoints de layout; a partir de 700px o modal vira card centralizado.
- `env(safe-area-inset-bottom)` na tabbar; `color-scheme: dark` nos inputs de data.
- FAB fixo à direita abaixo de 480px; centralizado em relação ao app acima disso.

---

## Assets
Nenhuma imagem. Todos os ícones são SVG inline com `stroke="currentColor"` (traço 1.8–2.2, cantos
arredondados). O ícone do app é o mesmo mark em todos os lugares: retângulo arredondado (bandeja),
círculo à esquerda (prato/xícara) e três hastes crescentes à direita (garfo = barras de gasto).
Fontes: Google Fonts (Archivo, IBM Plex Mono).

---

## Arquivos deste pacote
- `index.html` — as 5 telas + modal, com o JS de interface (sem framework, sem dados falsos)
- `style.css` — tokens e todos os componentes
- `README.md` — este documento
