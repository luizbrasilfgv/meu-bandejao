# Onde o app se afasta do handoff, e por quê

O `README.md` desta pasta é o handoff original do Claude Design, **como foi recebido**. Ele não é
editado: um documento de referência que alguém reescreve deixa de servir de referência.

Este arquivo registra as divergências deliberadas do app publicado. Tudo que não está aqui deve
seguir o handoff — e se o app estiver diferente sem constar nesta lista, o app é que está errado.

## Estrutura e navegação

| Handoff | App hoje | Por quê |
|---|---|---|
| FAB fixo de câmera em todas as telas | Removido | Aparecia em todas as telas e tapava conteúdo — na Home, justamente a lista de transações. |
| Dois botões na Home: "Escanear recibo" e "Lançar manual" | Um botão só, **+ Lançamento**, que pergunta como registrar | Duas portas para a mesma coisa dobram a decisão sem dobrar a informação. |
| Modal de lançamento como bottom sheet (`#sheetRecibo`) | Tela cheia (`#lancamento`), com "‹ Voltar" no topo | Formulário de dez campos dentro de bottom sheet briga com o teclado do celular. A barra inferior continua visível, como o handoff pede para o resto do app. |
| — | Telas novas: **Transações** (lista completa com filtro), **Acessos** e **Políticas** | O handoff cobria cinco telas; a portaria de acesso, a manutenção da regra do RH e a busca na lista inteira não estavam previstas. |
| Faixa `DADOS DE EXEMPLO` no topo | Removida | A regra 4 do handoff manda removê-la quando os dados reais entrarem. Entraram. |
| Tela Conciliar com a lista "O que falta decidir" | Removida da tela | É memória de projeto, não informação de aplicativo. Foi para `docs/Decisoes_de_Projeto.md`. |

## Hierarquia da Home

O handoff coloca `DESCONTO PREVISTO EM FOLHA` como o valor de 42px do card herói. **Invertemos.**

Com gasto fora da FGV no app, o desconto em folha deixou de ser o maior número da tela — um mês
com R$ 234,90 de gasto podia mostrar R$ 19,90 em 42px, e a leitura imediata era "gastei pouco".
Hoje:

* número grande = **o que você gastou no período**
* abaixo, em 24px e com uma cor cada: **desconto em folha** (âmbar), **subsídio da FGV** (azul) e
  **pago por fora** (cinza, quando existe)

Consequência que exigiu cuidado: o aviso dos 0,15% tem redação fixa e começa com "Este valor".
Ele estava sob o número grande, apontando para o desconto em folha. Desceu para junto do
desconto — o texto não mudou uma palavra.

## A base da taxa de 0,15%

O handoff se contradiz sobre a base da taxa. A regra 2 dele traz o aviso de redação fixa, texto do
usuário, dizendo **"por refeição"**; mais abaixo, na lista de fatos do refeitório, a mesma página
parafraseia como "por **ida** ao refeitório". Não é a mesma coisa: duas refeições num dia são duas
incidências no primeiro caso e uma no segundo.

O usuário confirmou: é **por refeição**. O app segue isso em todo texto — comentário de código,
tela de Políticas, spec e PRD. O handoff continua como foi recebido, contradição inclusive.

Sem efeito no cálculo: a taxa não é aplicada, porque o app não coleta salário. A distinção entra
em vigor no dia em que alguém decidir aplicá-la — e aí é `0,15% × salário × nº de refeições`, não
× nº de dias com consumo. A primeira versão do app fazia por dia
(`sessaoSalario * 0.0015` uma vez por dia com consumo na Sapore, no commit inicial); é de lá que
vinha o "por ida".

## Componentes acrescentados

Todos usando os tokens do `style.css`, sem cor literal nova fora do que já existia:

* `.destaque` — o desdobramento do card herói (folha / subsídio / fora)
* `.toast` — o handoff não tinha aviso curto; o `scratch/kit-app/PADRAO.md` exige
* `.gate` — telas de login e de espera
* `.lendo` — o passo visual da leitura do cupom: foto grande, linha varrendo, progresso e
  etapas com estado
* `.leg` — legenda da rosca com quantidade, percentual e valor, porque rosca sem número dá
  proporção e não dá valor
* `.ocr-diag` — o texto cru do leitor, para diagnóstico
* `.ac-chk`, `.lote-bar` — seleção e ação em lote no painel de acessos
* `.fill--fora`, `.avatar--fora`, `.stat__dot--fora` — a terceira cor (cinza) do gasto fora da FGV

## Gráficos

O handoff prevê os dois canvas e deixa a plotagem em aberto. Escolhas feitas:

* **Evolução em linha** por padrão, não em coluna: coluna empilhada serve para composição, e o
  que interessa num gasto ao longo do mês é tendência. As duas visualizações ficaram à escolha,
  num par de botões no cabeçalho do card.
* **Rosca com o total no centro**, por um plugin inline de 15 linhas — em vez de trazer o
  `chartjs-plugin-datalabels`, que seria dependência de produção nova.

## Terceiro estabelecimento

O handoff só conhece Sapore e Rei do Mate. O app tem **Outro**, para almoço fora da FGV, com 0%
de subsídio e fora do contracheque. A cor é cinza (`--muted`), deliberadamente neutra: não é
dinheiro da instituição.

## Ícones

A arte é a do handoff (`icone/app-icon-amber-rounded.svg`), com duas mudanças:

* **fundo chapado** em vez de gradiente: o PNG com gradiente dava 194 KB contra 5 KB, sem
  diferença visível no tamanho de um ícone. O próprio `docs/design/icone/ICONE.md` prevê a variante flat.
* **nome de arquivo versionado** (`icon-192-v2.png`): o Android indexa o ícone do app instalado
  pela URL, então trocar o conteúdo mantendo o nome não repinta o atalho de ninguém.

## Tema

O handoff é dark premium e o app ficou só nele — o botão de tema que vinha do kit foi removido em
vez de mantido sem CSS por trás. `color-scheme: dark` foi para o `<html>`, não só para os campos,
senão o navegador desenha a lista do `<select>` com fundo branco do sistema.
