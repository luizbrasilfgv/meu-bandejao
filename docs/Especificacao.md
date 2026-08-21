# Especificação Funcional e Técnica — Meu Bandejão

> Este documento descreve o que o app **faz hoje**. Quando divergir do código, o código é quem
> manda — e o documento é bug. A referência visual é `docs/design/README.md`, e o que o app faz
> diferente dela está em `docs/design/DIVERGENCIAS.md`.

## 1. Autenticação e acesso

* **Login único:** Google OAuth, com `browserLocalPersistence`. Enquanto não há usuário, o app
  inteiro fica atrás do gate de login.
* **Portaria:** todo acesso novo entra com `status: "pendente"` e `roles: ["member"]`, vê a tela
  de espera e **não grava nada**. Um administrador libera pelo painel de acessos (Perfil →
  Gerenciar acessos), com busca, abas por situação, contadores e ação em lote.
* **Donos entram direto.** Uma lista de e-mails declarada em `DONOS` (`app.js`) e em `donos()`
  (`firestore.rules`) nasce aprovada e admin, resolvendo o ovo e a galinha de não haver ninguém
  para aprovar o primeiro acesso. Se o documento de um dono tiver ficado pendente numa versão
  antiga, o app o conserta no login.
* **Ninguém se promove:** as Rules impedem que o cliente altere `roles`, `status` ou `papel` do
  próprio documento. O dono só pode mexer em `prefs`, `nome`, `email` e `foto`.
* **Salário não entra no app.** Não há campo, não há criptografia, não há PIN e não há
  reautenticação — porque não existe dado sensível a proteger.

## 2. Lançamentos

### 2.1 Como entra

Um botão só na tela inicial, **"+ Lançamento"**, que pergunta como registrar:

* **Escanear o cupom** — câmera ou galeria, com leitura automática (seção 3).
* **Digitar à mão** — para cupom ilegível ou lugar sem cupom.

O lançamento é uma **tela cheia** (`#lancamento`), com "‹ Voltar" no topo e a barra inferior
sempre visível. Não é janela de baixo: formulário longo em bottom sheet briga com o teclado do
celular.

### 2.2 Campos

`valor` e `dataHora` são obrigatórios. `local` é obrigatório e, quando é `Outro`, `localNome`
também. O resto é opcional: `categoria`, `itens`, `matricula`, `numeroCupom`, `cnpj`,
`observacao`. O app guarda ainda `origem` (`ocr` | `manual`), `confiancaOCR` e `status`
(`conferido` | `revisar`).

* **Estabelecimentos:** `Sapore`, `Rei do Mate` e `Outro`. Ao escolher `Outro` aparece o campo
  **ONDE FOI** e um aviso de que aquilo é 0% FGV e não vai para a folha.
* **Categorias:** almoço, jantar, café/lanche e outro.
* **`valorSemSubsidio`** — quanto, dentro do `valor`, é item de geladeira ou sobremesa elaborada.
  Só aparece quando o local é `Sapore`; nos outros é sempre zero. Nunca pode passar do `valor`, e
  o formulário recusa. É o campo que separa a base subsidiável do resto da nota.

### 2.3 Editar e excluir

Tocar na linha da transação abre a mesma tela em modo de edição, com todos os campos editáveis; o
rodapé passa a **Excluir** + **Salvar alterações**. A exclusão exige confirmação obrigatória numa
janela de baixo que descreve o lançamento.

## 3. Leitura do cupom

Na ordem, porque a ordem é a decisão:

1. **Pré-processamento.** Amplia para ~1800px na maior dimensão, converte para cinza e estica o
   contraste cortando 2% de cada ponta do histograma. É o passo que mais muda o resultado em
   papel térmico.
2. **QR code da NFC-e.** `BarcodeDetector` nativo quando existe, `jsQR` como reserva. Da **chave
   de acesso de 44 dígitos** saem CNPJ e número do cupom por posição fixa
   (`cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) …`). O QR versão 1 traz ainda `dhEmi` e
   `vNF` — data/hora e valor exatos.
3. **OCR (Tesseract.js), só para o que faltou.** PSM 4 e, se não achar valor, segunda tentativa
   com PSM 6. Extração tolerante: "VALOR A PAGAR" tem prioridade sobre "TOTAL"; linhas de
   pagamento (troco, débito, valor pago) e de ruído (tributo aproximado, lei, PROCON, CEP) são
   descartadas; o nome do estabelecimento aceita erro de OCR; a chave impressa é remontada mesmo
   quebrada em duas linhas.
4. **Preenche e mostra o que faltou.** O aviso diz o que entrou e o que não veio, campo por campo.
   Confiança baixa ou valor não encontrado marca a data com `CONFIRA`.

Durante a leitura existe um **passo visual próprio**: a foto grande com uma linha varrendo, barra
de progresso com porcentagem, e três etapas com estado (procurando o QR / lendo o texto /
preenchendo os campos), cada uma com giro, tique verde ou traço quando não deu.

**A imagem é processada na memória e descartada** com `revokeObjectURL`. Nada de foto no banco.

O painel **"Ver o que o leitor entendeu"** mostra o conteúdo do QR e o texto cru do OCR, com CPF
mascarado. Serve de diagnóstico quando algum campo não vem.

**O app aprende:** ao salvar, guarda o par CNPJ → local (e o nome, quando é `Outro`) em
`prefs.cnpjLocal`. O cupom seguinte do mesmo CNPJ já vem identificado.

## 4. Regra de negócio do desconto

A regra é do DRH, para funcionários da **Sede Botafogo** em sistema de consumo direto. Está
implementada em funções puras — `baseSubsidiavel`, `calcularRateio`, `descontoDe`, `subsidioDe`,
`foraDaFolhaDe`, `participacaoDe`, `resumo`:

```
POR DIA d com consumo na Sapore
  base(d)      = Σ (valor − valorSemSubsidio) das notas Sapore do dia
  extras(d)    = Σ valorSemSubsidio
  subsídio(d)  = min( base(d), teto )            teto = R$ 35,00/DIA (tabela 2026/2027)
  excedente(d) = max( 0, base(d) − teto ) + extras(d)

NO PERÍODO
  gasto          = soma de tudo que foi registrado
  subsídio FGV   = Σ subsídio(d)
  participação   = 0,15% do salário base × nº de dias com consumo na Sapore
  desconto folha = participação + Σ excedente(d) + Σ Rei do Mate integral
  pago por fora  = Σ Outro valor integral

e valem as identidades:
  gasto = subsídio FGV + Σ excedente + Rei do Mate + pago por fora
  gasto = subsídio FGV + (desconto folha − participação) + pago por fora
```

* **O teto é DIÁRIO, não por nota.** Duas refeições no mesmo dia dividem um único R$ 35,00. Isso
  tira o subsídio do domínio de um lançamento isolado: `calcularRateio` agrupa por dia e distribui
  o teto em **ordem cronológica** — a primeira nota do dia consome o teto, a seguinte pega o que
  sobrou. O rateio é sempre calculado sobre a lista inteira, nunca sobre a lista filtrada da tela,
  senão o mesmo lançamento mostraria subsídios diferentes em telas diferentes.
* **Nem tudo no cupom tem subsídio.** Item de geladeira (refrigerante, garrafa) e sobremesa
  elaborada (bolo, salada de frutas) vão integrais para a folha. Kilo, prato básico, suco de
  máquina, fruta e gelatina entram. O valor da parcela sem subsídio é **marcado no lançamento**
  (`valorSemSubsidio`), não inferido do texto do cupom: dois cupons de mesmo total e composição
  diferente produzem descontos diferentes, então adivinhar seria errar dinheiro em silêncio.
* **A participação não é comida.** É encargo por dia de uso, então `desconto + subsídio` passa do
  gasto exatamente nela. A tela mostra as parcelas separadas no rodapé do número da folha; nunca
  apresente os três valores como se somassem o gasto.
* **Sapore:** a FGV subsidia até o teto do dia; o colaborador é descontado no excedente.
* **Rei do Mate:** pago integralmente pelo colaborador, via contracheque, sem subsídio e sem teto.
* **Outro** (bar, padaria, restaurante da rua): **0% de subsídio e fora do contracheque** — foi
  pago na hora, do bolso. Entra no controle do período (gasto, gráficos, estatísticas,
  exportação) e **não** entra na previsão de desconto em folha.

> **Não calcule o subsídio como `gasto − desconto`.** Funcionava enquanto tudo passava pela folha;
> desde que existe gasto fora da FGV, essa subtração contaria o bar da esquina como coisa
> subsidiada pela instituição — e desde que existe a participação, ela viraria subsídio negativo.
> Some cada parcela pela sua regra, e pronto.

* **Subsídio e participação são política, não constante.** Ficam em `politicas/vigentes`, com
  **data de vigência**: o administrador cadastra a nova regra e os lançamentos antigos continuam
  calculados pela regra que valia na data deles. O padrão, quando não há nada cadastrado, é
  subsídio de R$ 35,00 por dia e participação de 0,15%.
* **O salário entra, e não sai do aparelho.** Fica em `privado.salarioBase`, informado no Perfil,
  gravado só no `localStorage` por `gravarPrivado()` — que **não chama `salvarPerfil`**. Nunca vai
  para o Firestore: `prefs` sincroniza e é lido pelo administrador, `privado` não existe no
  servidor. Daí sai `participacaoDoDia()`, que aplica o `taxaPct` da política vigente na data.
  Vazio é o padrão: aí a participação vale zero, o desconto é estimativa por
  baixo, e aparece este aviso de **redação fixa** (não reescrever), posicionado junto do número de
  **desconto em folha**:

  > Este valor é uma estimativa e não inclui o desconto fixo de 0,15% do seu salário base por refeição, omitido por privacidade

  Informado o salário, a participação entra na conta e **o aviso sai de tela** — em vez de
  reescrever um texto que passaria a mentir. Consequência aceita de não sincronizar: trocou de
  aparelho ou limpou o navegador, digita de novo.

## 5. Telas

### 5.1 Início

Hierarquia deliberada, de cima para baixo:

1. **O QUE VOCÊ GASTOU NO PERÍODO** — o número grande (42px), com a variação percentual contra o
   período anterior de igual tamanho.
2. **DESCONTO EM FOLHA** (âmbar) e **SUBSÍDIO DA FGV** (azul), em 24px, cada um com uma linha
   explicando de onde vem. Logo abaixo, o aviso dos 0,15%.
3. **PAGO POR FORA** (cinza), só quando existe.
4. Quinzenas 01–15 e 16–fim, como a folha recebe.
5. Barra e legenda por local: Sapore, Rei, e Fora quando houver.
6. **+ Lançamento** e as transações recentes (6), com **VER TUDO**.

### 5.2 Transações

Lista tudo que já foi lançado, com filtro no topo:

* **busca em texto livre**, casando em local, nome do lugar, categoria, itens, matrícula, nº do
  cupom, CNPJ, observação, data, valor e situação de folha. Todas as palavras precisam bater.
* chips de local (Todos / Sapore / Rei do Mate / Fora da FGV)
* selects de categoria e de situação (conferido / revisar OCR)
* faixa de valor (de / até) e faixa de data (de / até)
* ordenação: mais recentes, mais antigos, maior valor
* linha de placar: quantos casaram de quantos, quanto foi gasto, quanto em folha e quanto fora
* **exportar em CSV exatamente o que está filtrado**

### 5.3 Estatísticas

* **Período:** mês civil por padrão, mês anterior, ou intervalo livre. Todo número respeita o
  período selecionado.
* **Evolução do gasto:** **linha** por padrão (gasto e desconto em folha), com botão para ver em
  **coluna** empilhada (desconto + subsídio). Escala por dia ou por mês, independente do tipo.
* **Onde o crédito foi:** rosca por local, com o total escrito no centro por um plugin inline e
  legenda própria com quantidade, percentual e valor de cada um.
* **Cartões:** Sapore, Rei do Mate e — quando existe — Fora da FGV. Mais gasto projetado no
  ritmo atual, maior dia, média por dia com consumo e ritmo do período em dias úteis (sem base de
  feriados; é aproximação declarada).

### 5.4 Conciliação

Em construção. Mostra as três últimas quinzenas com o valor do app; a coluna da folha entra
quando o app souber ler o contracheque. Não há importação de arquivo nem upload de holerite:
nenhum documento sigiloso transita no app.

### 5.5 Perfil

Conta Google (nome, e-mail, foto), matrícula, teto mensal, alerta de limite, exportação do
período e sair. Para administrador, mais: **Gerenciar acessos** e **Políticas de desconto**.

### 5.6 Dúvidas

Memória de cálculo linha por linha e FAQ, incluindo o que o número grande mostra, de onde vem o
teto, por que aparecem duas linhas no contracheque e como tratar gasto fora da FGV.

## 6. Dados

```
users/{uid}          → { nome, email, foto, roles[], status, papel?, criadoEm, prefs }
lancamentos/{uid}    → { itens: [ ...lançamentos... ], atualizadoEm }
politicas/vigentes   → { lista: [ { id, vigencia, teto, taxaPct } ], atualizadoEm }
```

Um lançamento:

```
{ id, dataHora, local, localNome, categoria, valor, valorSemSubsidio, itens,
  matricula, numeroCupom, cnpj, observacao, confiancaOCR, origem, status, criadoEm }
```

`prefs`: `{ alertaLimite, lembreteRecibo, tetoMensal, matricula, cnpjLocal }` — sendo `cnpjLocal` o
mapa CNPJ → `{ local, nome }` que o app aprende sozinho. **`prefs` sincroniza** e é lido pelo
administrador: nada sensível aqui. O lembrete de recibo registra a preferência mas **ainda não
dispara notificação**, e a tela declara isso.

Fora do Firestore, só no `localStorage` da chave `meu_bandejao_privado`:

```
privado → { salarioBase }
```

É o único dado do app que **não existe no servidor**, e é deliberado — ver seção 4. Uma versão
anterior guardava a participação em reais dentro de `prefs`, o que a mandava para o banco;
`migrarParticipacao()` desfaz isso na primeira abertura, reconstruindo o salário localmente e
apagando o campo das prefs, inclusive no servidor.

Lançamento antigo, gravado antes deste campo existir, não tem `valorSemSubsidio` — `num()` resolve
para zero, então o cálculo trata como nota inteiramente subsidiável. É o comportamento anterior,
que é o certo para quem não marcou nada.

Leitura com `onSnapshot` (sincroniza entre aparelhos, com guard contra o eco da própria escrita) e
escrita com atraso de 600 ms. Uma cópia fica no `localStorage` para o app abrir sem internet.

## 7. Infraestrutura e publicação

* **Backend:** Firebase Auth (Google), Firestore e Hosting do projeto `meu-vale`. Sem servidor
  Node, sem bundler, sem passo de build.
* **Endereço:** `https://meu-bandejao.web.app`. O site `meu-vale` está desativado — é o site
  padrão do projeto e não pode ser apagado, porque o Project ID é imutável.
* **PWA:** manifest com `display: standalone` e `id` explícito, PNG de 192 e 512 declarados,
  service worker registrado. Instala na tela inicial e abre sem rede.
* **Ícone com nome versionado** (`icon-192-v2.png`): o Android indexa o ícone do WebAPK pela URL,
  então trocar o conteúdo mantendo o nome não repinta o atalho instalado. Ao trocar a arte, sobe o
  sufixo nos arquivos, no manifest, nas tags `<link>` e no `CASCO` do `sw.js`.
  O gerador está em `docs/ferramentas/gera-icone.js`.
* **Auto-atualização:** a página ouve `controllerchange` e recarrega uma vez quando o service
  worker novo assume, o que evita a combinação HTML novo + JavaScript velho.
* **Cache:** `**` fecha tudo em `no-cache`; só os assets versionados por URL ganham um ano de
  `immutable`; `sw.js` e `manifest.json` nunca em cache. A ordem importa — vale a última regra
  que casa.
* **Disciplina obrigatória a cada publicação:** subir o `?v=N` dos assets no `index.html` **e** o
  `VERSAO` do `sw.js`. O workflow do GitHub Actions falha o deploy se os assets mudaram e um dos
  dois não subiu.
* **Deploy:** automático em push no `main` (`.github/workflows/deploy.yml`, exige o segredo
  `FIREBASE_SERVICE_ACCOUNT`), ou manual com
  `firebase deploy --only firestore:rules,hosting --project meu-vale`.

## 8. Aviso legal

O app exibe, no login e nas Dúvidas, que **não é uma aplicação oficial da FGV** e que a
instituição não responde pelos lançamentos nem pelos descontos em contracheque — a conferência é
do colaborador.
