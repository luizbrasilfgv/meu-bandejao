# PRD — Meu Bandejão

## 1. Visão geral e objetivo

O **Meu Bandejão** é um assistente digital para controle, gestão e conciliação dos gastos com
alimentação no trabalho. Nasceu para mapear o consumo nas duas lanchonetes internas da FGV —
**Sapore** (refeição) e **Rei do Mate** (café e lanche) — e responder uma pergunta concreta:
*quanto vai cair de desconto no meu contracheque no fim do mês?*

O escopo cresceu numa direção só: o app também registra **almoço fora da FGV** (bar, padaria,
restaurante da rua). Não porque a instituição tenha algo a ver com isso, mas porque o gasto com
comida é um só do ponto de vista de quem paga. Esse lançamento entra no controle do período com
**0% de subsídio** e **fora do contracheque**.

O aplicativo é uma **Prova de Conceito de uso pessoal**, sem integração via API com sistemas da
instituição (Apdata, SAP).

## 2. O que o usuário precisa ver

Em ordem de importância, porque é isso que define a hierarquia da tela inicial:

1. **Quanto eu gastei** no período. É o número grande.
2. **Quanto disso vira desconto em folha** — o que a FGV vai cobrar no contracheque.
3. **Quanto a FGV cobriu** — o subsídio, que só existe na Sapore e só até o teto.
4. **Quanto saiu do bolso na hora** — o que foi pago fora da FGV, quando houver.

Os quatro têm que fechar: o item 1 é a soma dos outros três. Uma tela em que o desconto em folha
apareça maior que o gasto total dá a impressão errada de que se gastou pouco — foi o que
aconteceu na primeira versão e o que motivou inverter a hierarquia.

## 3. Perfis de usuário

* **Usuário comum:** lança por foto do cupom ou à mão, edita e exclui os próprios lançamentos,
  vê os painéis, filtra a lista completa e exporta em CSV.
* **Administrador:** tudo do comum, mais o painel de aprovação de novos acessos e a manutenção
  das políticas de desconto (teto por refeição e taxa, com data de vigência).

## 4. Princípios que não se negociam

* **O salário não entra no app.** Sem campo, sem criptografia, sem PIN. A consequência aceita é
  que a taxa de 0,15% do salário base por ida ao refeitório não é calculada, e todo valor
  exibido é uma estimativa por baixo, sempre declarada como tal.
* **A foto do cupom não é armazenada.** É lida na memória do aparelho e descartada.
* **Nenhum número inventado.** Onde falta dado, a tela mostra `—`. Onde o valor é estimativa,
  está escrito que é.

## 5. Aviso legal

O app informa, no login e na tela de Dúvidas, que **não é uma aplicação oficial da FGV** e que a
instituição não responde pelos lançamentos aqui registrados nem pelos descontos que aparecem no
contracheque — a conferência é do colaborador.
