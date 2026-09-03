# Decisões de Projeto e Premissas — Meu Bandejão

Registro do que foi decidido e **por quê**. Decisão revista fica marcada como revista: saber que
uma ideia foi abandonada vale tanto quanto a ideia que ficou.

## 1. Escopo e integrações

* **Zero integração (POC).** Uso pessoal de controle. Nenhuma integração via API com sistemas
  oficiais (Apdata, SAP).
* **Conciliação visual.** Para não fazer documento sensível trafegar, o app gera o relatório e o
  próprio colaborador confronta com o contracheque. Sem upload de holerite.
* **Sem servidor, sem build.** Segue o `scratch/kit-app/PADRAO.md`: vanilla ES6, Firebase como
  plataforma inteira, o que está publicado é o que o navegador baixa.
* **O escopo cresceu para fora da FGV.** *(decisão de 20/08/2026)* O app passou a aceitar
  lançamento em lugar de fora — bar, padaria, restaurante da rua. Motivo: o gasto com comida é um
  só para quem paga, e um controle que ignora metade dele não controla nada. Consequência
  registrada abaixo, em "Regra de negócio".

## 2. Privacidade

* **Descarte imediato das imagens.** Foto do cupom → leitura no próprio navegador → revisão
  humana → descarte com `revokeObjectURL`. Nenhuma foto vai para o banco. É o que permite
  escanear cupom sem criar um acervo de documentos.
* **O salário não entra no app.** *(revisão de uma decisão anterior)* A primeira versão previa
  guardar o salário criptografado, com PIN e reautenticação para editar. Foi abandonado: em vez
  de proteger um dado sensível, decidimos não coletá-lo.
* **O salário entra no app, e não sai do aparelho.** *(decisão de 21/08/2026, revendo a decisão
  acima)* Com a regra do DRH confirmada, a participação de 0,15% é a maior parcela do desconto —
  com salário de R$ 10.000 e 20 dias de consumo são R$ 300,00 no mês, contra R$ 37,00 de excedente
  do teto num mês típico. Ignorá-la deixava o número principal do app errado por larga margem.
  A primeira tentativa foi pedir **a participação em reais** em vez do salário
  (`prefs.participacaoDia`). Foi um erro por dois motivos, e os dois valem registro:
  1. `participação ÷ 0,15%` devolve o salário. Não protegia nada.
  2. Pior: `prefs` **sincroniza** para `users/{uid}.prefs`, cuja regra é
     `allow get: if eu(uid) || ehAdmin()`. Ou seja, o valor foi para o banco, onde o administrador
     lê. O dado sensível vazou pela porta que ninguém olhou.
  A forma correta é o objeto `privado`, só no `localStorage`, gravado por `gravarPrivado()` — que
  não chama `salvarPerfil`. Existe migração: quem tinha `participacaoDia` tem o salário
  reconstruído localmente e o campo apagado das prefs, e como a gravação usa `updateDoc` com o mapa
  `prefs` inteiro, o campo deixa de existir no servidor também.
* **Sem criptografia, de propósito.** *(21/08/2026)* A alternativa a guardar local seria cifrar no
  cliente e sincronizar o texto cifrado. Recusada: salário é um número curto e previsível, e com o
  texto cifrado em mãos um atacante testa senhas offline com o AES-GCM confirmando o acerto. Ficar
  seguro exigiria senha forte, digitada em cada aparelho e perdida para sempre se esquecida —
  muito custo e muito risco para proteger um número que o dono redigita em cinco segundos.
  Consequência aceita: **não sincroniza entre aparelhos.** Trocou de celular, digita de novo.
  O que não está no banco não precisa ser protegido no banco.
* **O aviso de estimativa sai de tela em vez de ser reescrito.** *(decisão de 21/08/2026)* O texto
  dos 0,15% é de redação fixa e afirma que a participação está fora da conta. Informado o valor,
  ela entra — e o texto passaria a mentir. Reescrever texto que não é nosso está proibido pelo
  handoff; então ele é escondido enquanto a participação estiver valendo, e volta quando o campo
  é limpo.
* **O CPF do cupom é ignorado.** O leitor extrai matrícula, nº do cupom e CNPJ; CPF não. E no
  painel de diagnóstico da leitura, que mostra o texto cru, o CPF é mascarado — é uma tela feita
  para ser copiada e colada.
* **Isolamento por usuário.** Um documento por `uid` em cada coleção, e as Rules só deixam cada
  pessoa ler o próprio. Coleção separada por tipo de dado, não campo dentro do mesmo documento.
* **Falta aqui o que o padrão passou a exigir.** *(registrado em 03/09/2026)* O
  `scratch/kit-app/PRIVACIDADE-LGPD.md` virou parte do padrão e pede três coisas que **este app
  ainda não tem**: o aviso de privacidade na tela de entrada, o aceite bloqueante e versionado no
  primeiro acesso, e o pedido de saída com fila para o administrador. O que existe hoje é a
  substância — imagem descartada, salário fora do banco, CPF ignorado, isolamento por `uid` — sem a
  parte que a pessoa vê e sem o caminho para ela pedir para sair. Não é urgente como era nos apps
  de grupo (aqui cada um só vê o próprio dado), mas está em aberto de propósito, e não por
  esquecimento: fica registrado para não parecer decisão.

## 3. Acesso

* **Portaria em vez de link fechado.** O link é público; quem entra fica pendente até um
  administrador liberar. Um bypass temporário chegou a ser publicado (commit `6f595ce`, criando
  todo usuário como aprovado) e foi revertido: além do risco, ele contradizia as Rules, que
  exigem `pendente` na criação — o efeito real era **impedir qualquer login novo**.
* **Lista de donos no código, não no console.** *(decisão de 19/08/2026)* A portaria tinha um ovo
  e uma galinha: o primeiro usuário nasce pendente e não existe ninguém para aprová-lo. A saída
  do kit era editar o documento à mão no console do Firebase. Trocamos por uma lista de e-mails
  de dono, declarada no `app.js` **e** no `firestore.rules`: quem está nela nasce aprovado e
  admin. O e-mail na lista não é segredo — quem protege é a comparação com o token verificado do
  Google, não o sigilo da lista.
* **Admin também por string no console.** Mantido como saída de emergência: campo texto
  `papel` = `admin`. As Rules aceitam os três caminhos (dono, `roles[]`, `papel`).

## 4. Regra de negócio

* **Três casos, três regras.** *(20/08/2026, atualizado em 21/08/2026 com a regra do DRH)*
  * **Sapore:** a FGV subsidia até R$ 35,00 **por dia**; o colaborador é descontado no excedente,
    nos itens sem subsídio e na participação de 0,15% por dia com consumo.
  * **Rei do Mate:** valor integral, descontado no contracheque, sem subsídio.
  * **Outro:** 0% de subsídio e **fora do contracheque** — foi pago na hora, do bolso.
* **O teto é do dia, não da nota.** *(21/08/2026, do documento do DRH)* Antes o app aplicava o teto
  em cada lançamento, o que dava dois tetos a quem almoça e janta na Sapore no mesmo dia — subsídio
  de R$ 50,00 onde a regra dá R$ 35,00. Consequência arquitetural: `descontoDe(l)` deixou de ser
  função só de `l`. O rateio é calculado por dia sobre a lista inteira, em **ordem cronológica**
  (a primeira nota do dia consome o teto), e memoizado num cache invalidado num ponto único, no
  topo de `pintar()`. Cache com invalidação espalhada aqui seria dinheiro errado na tela sem erro
  no console.
* **Ordem cronológica, e não rateio proporcional.** Qualquer convenção fecha a soma do dia; a
  cronológica é a única que corresponde ao que acontece na catraca — quando você almoçou, o
  subsídio do dia ainda estava inteiro. Proporcional distribuiria para trás um teto que já tinha
  sido consumido.
* **A base subsidiável é marcada, não inferida.** *(21/08/2026)* Geladeira e sobremesa elaborada
  não têm subsídio, e dois cupons de mesmo total com composição diferente geram descontos
  diferentes. Adivinhar pelo texto do cupom erraria dinheiro em silêncio, então existe o campo
  `valorSemSubsidio` no lançamento, visível só na Sapore, com a lista do que entra e do que não
  entra ao lado.
* **O subsídio é somado, não subtraído.** Era `bruto − desconto`, o que funcionava enquanto tudo
  passava pela folha. Com gasto fora da FGV, essa subtração passaria a contar o bar da esquina
  como coisa subsidiada pela instituição — e com a participação, ela viraria subsídio negativo.
  Cada parcela é somada pela sua regra, e vale
  `bruto = subsídio + (desconto − participação) + fora`, que o teste verifica explicitamente.
* **Um ponto a confirmar no contracheque.** A periodicidade dos 0,15% foi informada como
  **por dia com consumo**. O documento do DRH escreve "diário" no teto e não marca periodicidade no
  percentual, então o app segue o que foi informado e trata a participação como uma incidência por
  dia com consumo na Sapore. Dia só de Rei do Mate não conta. Se o contracheque mostrar uma única
  incidência no mês, muda `participacaoDe` — é uma função de três linhas.
* **O nome do lugar é obrigatório quando é "Outro".** Sem ele, todo gasto de fora vira um
  "Outro" indistinguível na lista e nos gráficos.
* **O número grande é o gasto, não o desconto.** *(revisão de 20/08/2026)* A primeira versão
  colocava o desconto previsto em folha em 42px e o gasto real num rodapé de 19px. Olhando a
  tela, parecia que o mês tinha custado R$ 19,90 quando tinham sido R$ 234,90. Invertido: o gasto
  é o número grande, e folha / subsídio / pago por fora vêm abaixo com peso próprio e uma cor
  cada. O aviso dos 0,15%, cuja redação é fixa e começa com "Este valor", desceu junto do
  desconto em folha — deixá-lo sob o número grande faria a frase apontar para a coisa errada.
* **Política com vigência, não constante no código.** O teto e a taxa mudam por decisão do RH.
  Ficam em `politicas/vigentes` com data de vigência, editáveis pelo administrador, e cada
  lançamento é calculado pela regra que valia na data dele. Sem isso, uma mudança de teto
  reescreveria o histórico.
* **Quinzena é a unidade real.** As lanchonetes enviam por quinzena e a folha soma duas. Qualquer
  conciliação por mês fechado dá diferença por construção.

## 5. Leitura do cupom

* **QR antes de OCR.** *(19/08/2026)* O cupom é uma NFC-e e traz QR code. Da chave de acesso de
  44 dígitos saem CNPJ e número do cupom por posição fixa, e o QR versão 1 traz também valor e
  data/hora. Isso é dado; OCR em papel térmico é palpite. O OCR ficou como complemento, para o
  que o QR não dá (itens, matrícula) e para quando o QR não é legível.
* **A chave impressa como reserva.** Ela vem em grupos de 4 dígitos, que o OCR acerta bem melhor
  que texto corrido — inclusive quando o cupom estreito a quebra em duas linhas.
* **Pré-processar a imagem é o passo que mais rende.** Ampliar para ~1800px, converter para cinza
  e esticar o contraste cortando 2% de cada ponta do histograma. Sem isso o Tesseract lia a data
  (dígitos grandes e espaçados) e errava o resto.
* **O CNPJ é a identidade do estabelecimento, e o app aprende.** Ao salvar, guarda o par
  CNPJ → lugar nas preferências. Do segundo cupom em diante o reconhecimento não depende de
  acertar o nome no OCR.
* **Mostrar o texto cru na tela.** O painel "Ver o que o leitor entendeu" existe para que
  "não reconheceu nada" deixe de ser palpite e passe a ser evidência.

## 6. Interface

* **O design do Claude é a referência, e ele manda.** `docs/design/` guarda o handoff original.
  Quando o comportamento e o design divergirem, quem se adapta é o código — foi o contrário disso
  que produziu a versão que não funcionava: dois sistemas de UI no mesmo DOM, um deles apontando
  para elementos que não existiam. As divergências deliberadas estão listadas em
  `docs/design/DIVERGENCIAS.md`.
* **Uma porta de entrada para lançar.** *(revisão de 20/08/2026)* Havia dois botões na Home e um
  FAB flutuante que aparecia em todas as telas, tapando a lista de transações. Ficou um botão
  só — "+ Lançamento" — que pergunta se é escanear ou digitar.
* **Lançamento é tela, não janela de baixo.** Tela cheia, "‹ Voltar" no topo, barra inferior
  sempre visível. Formulário longo dentro de bottom sheet no celular é briga com o teclado.
* **Números de exemplo são declarados.** Onde falta dado, `—`, nunca um número inventado. A faixa
  "DADOS DE EXEMPLO" saiu quando o último número mockado saiu da tela.
* **Nada de tema claro.** O design é dark premium por decisão; o botão de tema do kit foi
  removido em vez de mantido sem CSS por trás. E `color-scheme: dark` vai no `<html>`, não só nos
  campos, senão o navegador desenha a lista do `<select>` com fundo branco do sistema e o texto
  herda a cor clara do app.
* **Um switch que não faz nada é mentira.** O lembrete de recibo guarda a preferência, mas a tela
  declara que a notificação ainda não existe.
* **"Período completo" no lugar de "Mês anterior".** *(decisão de 03/09/2026)* Os dois presets
  custam o mesmo espaço na tela e não valem o mesmo: o mês passado se resolve em "Escolher datas"
  com dois toques, enquanto ver o histórico inteiro exigia escolher datas **e** saber de cabeça a
  data do primeiro lançamento — que é justamente o que ninguém sabe. O preset novo resolve isso
  lendo o primeiro e o último lançamento que existem.
  Duas consequências foram consertadas junto, porque o preset fez virar rotina um caso que antes
  só aparecia em intervalo escolhido à mão:
  1. **O cabeçalho passou a acompanhar o período.** Ele imprimia o mês do fim do intervalo, e
     dizia "SETEMBRO 2026 · 8 LANÇAMENTOS" para lançamentos que começavam em junho — contagem
     certa, rótulo errado, contradizendo a nota do próprio card de Início.
  2. **O bloco das quinzenas passou a dizer de que mês fala.** Ele continua sendo o do mês que
     fecha o período, porque a folha é mensal e não acompanha intervalo de vários meses; o que
     faltava era o rótulo admitir isso (`1ª QUINZENA SET · 01–15`).
  A variação percentual **sai de tela** neste preset: não existe período anterior de igual tamanho
  antes do primeiro lançamento, e "+100%" só diria que antes não havia registro.

## 7. Publicação e PWA

* **Um endereço só.** *(20/08/2026)* Ficou `meu-bandejao.web.app`. O site `meu-vale` foi
  desativado — não dá para apagá-lo, é o site padrão do projeto, e o Project ID `meu-vale` é
  imutável. O que havia sido trocado no console era só o **nome de exibição** do projeto, que não
  muda URL nenhuma.
* **O nome do arquivo do ícone é versionado.** O Android indexa o ícone do WebAPK pela URL:
  trocar o conteúdo de `icon-192.png` não repinta o atalho já instalado. Ao trocar a arte, sobe o
  sufixo (`-v2`, `-v3`) nos arquivos, no `manifest.json`, nas tags `<link>` e no `CASCO` do
  `sw.js`. No iOS o `apple-touch-icon` é congelado no momento em que se adiciona à tela de
  início, então lá o renome é a única saída.
* **O app se atualiza sozinho.** A página ouve `controllerchange` e recarrega uma vez quando o
  service worker novo assume. Sem isso a primeira abertura depois de publicar entrega HTML novo
  com JavaScript velho — a tela abre e os botões não respondem.
* **Cache com casamento exato.** O kit usava `ignoreSearch: true`, que faz o `?v=N` não invalidar
  nada e anula o versionamento. Mantido `ignoreSearch` só no fallback de navegação offline.
* **Disciplina de cada publicação:** subir o `?v=N` dos assets no `index.html` **e** o `VERSAO`
  do `sw.js`. O workflow do GitHub Actions falha o deploy se um dos dois for esquecido quando os
  assets mudaram.

## 8. Nomenclatura

O app se chama **Meu Bandejão**. Nomes cômicos foram descartados para preservar a credibilidade
numa eventual expansão de uso. O projeto no Firebase tem ID `meu-vale` — herdado e **imutável**;
só o nome de exibição e o endereço do Hosting podem mudar.
