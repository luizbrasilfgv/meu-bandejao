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
  de proteger um dado sensível, decidimos não coletá-lo. Consequência aceita: a taxa de 0,15% do
  salário base por refeição **não é calculada**, e todo valor exibido é uma estimativa
  por baixo, sempre com o aviso literal ao lado.
* **O CPF do cupom é ignorado.** O leitor extrai matrícula, nº do cupom e CNPJ; CPF não. E no
  painel de diagnóstico da leitura, que mostra o texto cru, o CPF é mascarado — é uma tela feita
  para ser copiada e colada.
* **Isolamento por usuário.** Um documento por `uid` em cada coleção, e as Rules só deixam cada
  pessoa ler o próprio. Coleção separada por tipo de dado, não campo dentro do mesmo documento.

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

* **Três casos, três regras.** *(20/08/2026)*
  * **Sapore:** a FGV subsidia até o teto por refeição; o colaborador é descontado no excedente.
  * **Rei do Mate:** valor integral, descontado no contracheque.
  * **Outro:** 0% de subsídio e **fora do contracheque** — foi pago na hora, do bolso.
* **O subsídio é somado, não subtraído.** Era `bruto − desconto`, o que funcionava enquanto tudo
  passava pela folha. Com gasto fora da FGV, essa subtração passaria a contar o bar da esquina
  como coisa subsidiada pela instituição. Agora é `Σ Sapore min(valor, teto)`, e vale a
  identidade `bruto = desconto + subsídio + fora`, que o teste verifica explicitamente.
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
