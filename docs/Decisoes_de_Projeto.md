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

## 2. Privacidade

* **Descarte imediato das imagens.** Foto do cupom → OCR no próprio navegador → revisão humana →
  descarte da imagem. Nenhuma foto vai para o banco. É o que permite escanear cupom sem criar um
  acervo de documentos.
* **O salário não entra no app.** *(revisão de uma decisão anterior)* A primeira versão previa
  guardar o salário criptografado, com PIN e reautenticação para editar. Foi abandonado: em vez
  de proteger um dado sensível, decidimos não coletá-lo. Consequência aceita: a taxa de 0,15% do
  salário base por ida ao refeitório **não é calculada**, e todo valor exibido é uma estimativa
  por baixo, sempre acompanhada do aviso literal.
* **Isolamento por usuário.** Um documento por `uid` em cada coleção, e as Rules só deixam cada
  pessoa ler o próprio. Coleção separada por tipo de dado, não campo dentro do mesmo documento.

## 3. Acesso

* **Portaria em vez de link fechado.** O link é público; quem entra fica pendente até um
  administrador liberar. Um bypass temporário chegou a ser publicado (commit `6f595ce`, criando
  todo usuário como aprovado) e foi revertido: além do risco, ele contradizia as Rules, que
  exigem `pendente` na criação — o efeito real era **impedir qualquer login novo**.
* **Admin por string no console.** O primeiro administrador é promovido à mão com um campo texto
  `papel` = `admin`, porque o editor de array do console do Firebase é pouco confiável. As Rules
  aceitam os dois caminhos (`roles[]` e `papel`).

## 4. Regra de negócio

* **Teto por refeição, não teto de gasto.** Na Sapore a FGV subsidia até o teto e o colaborador
  é descontado no excedente; no Rei do Mate o valor é integral. Confirmado com o usuário.
* **Os três números juntos.** A tela mostra consumo bruto, desconto previsto em folha e subsídio
  estimado da FGV. Mostrar só o desconto esconderia o quanto a FGV cobre; mostrar só o bruto
  daria a impressão errada do que cai na folha.
* **Política com vigência, não constante no código.** O teto e a taxa mudam por decisão do RH.
  Ficam em `politicas/vigentes` com data de vigência, editáveis pelo administrador a qualquer
  momento, e cada lançamento é calculado pela regra que valia na data dele. Sem isso, uma
  mudança de teto reescreveria o histórico.
* **Quinzena é a unidade real.** As lanchonetes enviam por quinzena e a folha soma duas. Qualquer
  conciliação por mês fechado dá diferença por construção.

## 5. Interface

* **O design do Claude é a referência, e ele manda.** `docs/design/` guarda o handoff original.
  Quando o comportamento e o design divergirem, quem se adapta é o código — foi o contrário
  disso que produziu a versão que não funcionava: dois sistemas de UI no mesmo DOM, um deles
  apontando para elementos que não existiam.
* **Números de exemplo são declarados.** A faixa `DADOS DE EXEMPLO` só sai quando existe
  lançamento real. Onde falta dado, a tela mostra `—`, nunca um número inventado.
* **Nada de tema claro.** O design é dark premium por decisão; o botão de tema do kit foi
  removido em vez de mantido sem CSS por trás.
* **Um switch que não faz nada é mentira.** O lembrete de recibo guarda a preferência, mas a
  tela declara que a notificação ainda não existe.

## 6. Nomenclatura

O app se chama **Meu Bandejão**. Nomes cômicos foram descartados para preservar a credibilidade
numa eventual expansão de uso. O projeto no Firebase tem ID `meu-vale` — herdado e **imutável**;
só o nome de exibição e o endereço do Hosting podem mudar.
