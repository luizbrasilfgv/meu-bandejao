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

## A regra do desconto, contra o handoff

O handoff descreve a regra do refeitório de segunda mão e erra em três pontos. O documento do DRH,
de 21/08/2026, é a fonte normativa e vence:

| Handoff | Regra do DRH | O app segue |
|---|---|---|
| "teto mensal (valor fixo por mês). **O valor não foi informado**" | subsídio de **R$ 35,00 por dia** de consumo, tabela 2026/2027 | o DRH |
| taxa de 0,15% "por **ida** ao refeitório" numa página, "por **refeição**" no aviso literal da outra | 0,15% do salário base **por dia com consumo** | o DRH |
| nada sobre composição do cupom | **só o basicão tem subsídio** — kilo, básico, suco de máquina, fruta e gelatina. Todo o resto vai integral, inclusive café e salgado | o DRH, na leitura restritiva |
| a taxa "**nunca entra no cálculo**" e o valor é sempre estimativa | a participação é a **maior parcela** do desconto | o DRH: ela entra, quando o usuário informa o salário |

## O salário, que o handoff proibia

A regra 3 do handoff é categórica: *"O app não pede nem armazena salário (LGPD). Por isso a taxa de
0,15% por refeição nunca entra no cálculo."* **O app hoje pede.**

O que mudou: com a regra do DRH confirmada, a participação deixou de ser detalhe e passou a ser a
maior parcela do desconto — com salário de R$ 10.000 e 20 dias de consumo são R$ 300,00 no mês,
contra R$ 37,00 de excedente do teto num mês típico. Um app que se propõe a prever o desconto e
ignora 89% dele não cumpre o que promete.

O que **não** mudou é o motivo da regra 3, e é por isso que ela foi contornada em vez de revogada:
o salário fica em `privado`, só no `localStorage`, gravado por uma função que de propósito não
chama `salvarPerfil`. Não vai para o Firestore, não sincroniza, e o administrador não tem como ver
o de ninguém. Regra de banco não protegeria — ela vale para o SDK do cliente, não para quem abre o
console do projeto. A única garantia é o dado não estar lá.

Consequências aceitas: **não sincroniza entre aparelhos** (trocou de celular, digita de novo), e o
campo é **opcional** — vazio, o app calcula como antes e o aviso de estimativa continua em tela.
Informado, o aviso é escondido, porque ele afirma que os 0,15% estão fora da conta e passaria a
mentir. O texto em si não foi tocado: é de redação fixa.

O `README.md` desta pasta continua como foi recebido, contradição interna inclusive — é handoff, não
documentação viva. A regra em vigor está em `docs/Especificacao.md`, seção 4.

Duas consequências de tela que divergem do handoff:

* **O card herói ganhou a composição da folha escrita por extenso.** O handoff prevê dois números e
  ponto. Com a participação valendo, os números do card deixam de somar o gasto — a participação é
  encargo por dia de uso, não comida — e três valores que aparentam somar e não somam leem como
  defeito. O rodapé do número da folha mostra
  `PARTICIPAÇÃO + PASSOU DO TETO + SEM SUBSÍDIO + REI DO MATE`, e as parcelas somam exatamente o
  número acima delas. A primeira versão listava `PARTICIPAÇÃO + EXCEDENTE`, o que **contava a
  participação duas vezes** — o excedente já a contém desde que o subsídio passou a ser líquido — e
  a legenda exibia R$ 63,40 embaixo de um total de R$ 41,65. As parcelas vêm do rateio, e não de
  uma conta própria da tela, justamente para não poderem divergir do total outra vez.
* **O aviso de estimativa é escondido quando a participação está informada.** O texto é de redação
  fixa e afirma que os 0,15% estão fora da conta; informado o valor, ele passaria a mentir.
  Esconder respeita as duas regras do handoff ao mesmo tempo: não reescrever o texto do usuário e
  não mostrar informação falsa. Ele volta assim que o campo é limpo.

Nota histórica, porque explica a confusão: o commit inicial do app já calculava
`(sessaoSalario * 0.0015) + max(0, dia.sapore - 31.59)` uma vez **por dia** com consumo na Sapore.
A periodicidade estava certa desde o começo e se perdeu quando o salário saiu do app.

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
