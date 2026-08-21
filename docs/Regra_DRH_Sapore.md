# Regra do desconto do refeitório — Sapore, Sede Botafogo

Documento único da regra. Serve para três coisas: conferir o contracheque, alimentar o cálculo do
app e ser levado ao DRH quando alguma linha estiver em dúvida.

Cada afirmação vem marcada com a **procedência**, porque neste assunto já circulou muita
informação de segunda mão que não se sustentou:

| Marca | Significado |
|---|---|
| **[DRH]** | Está no documento do DRH de 21/08/2026 ou na resposta direta do DRH. É norma. |
| **[APP]** | Decisão do aplicativo onde a norma é silenciosa. Não é regra da FGV. |
| **[?]** | Não confirmado. Está na lista da seção 6 para levar ao DRH. |

---

## 1. Escopo

* Vale para funcionários **alocados na Sede Botafogo**, no regime de **consumo direto**. **[DRH]**
* O consumo na Praça de Alimentação é identificado (matrícula / crachá) e o desconto cai
  **direto na folha de pagamento**. **[DRH]**
* Não cobre outras unidades da FGV, nem outro regime de benefício. **[?]** — o documento fala
  apenas da Sede Botafogo, e nada afirma sobre as demais.

---

## 2. A regra, em uma tela

```
A FGV subsidia até R$ 35,00 POR DIA de consumo na Sapore.
                            (tabela 2026/2027)

Você paga:
    0,15% do seu salário-base, por DIA em que consumiu
  + tudo o que passar dos R$ 35,00 no dia
  + tudo o que não tem direito a subsídio (geladeira e sobremesa elaborada)
  + todo o consumo no Rei do Mate, integral
```

Três pontos que costumam ser lidos errado:

1. **O teto é do DIA, não da nota.** Almoçar e jantar na Sapore no mesmo dia não dá dois tetos:
   as duas notas dividem um único R$ 35,00. **[DRH]**
2. **Sobra não acumula.** Gastou R$ 20,00 hoje? Os R$ 15,00 que faltaram não viram crédito para
   amanhã nem voltam para você. **[DRH]**
3. **A participação de 0,15% não é comida.** É encargo pelo dia de uso. Num dia de R$ 20,00 de
   consumo, a FGV paga os R$ 20,00 e você paga os 0,15% por cima — o que sai do seu bolso não é
   uma fatia do prato, é uma taxa. **[DRH]**

---

## 3. O que entra e o que não entra no subsídio

O critério que o DRH deu, em uma frase: **"nada que é de geladeira ou sobremesa elaborada entra
no subsídio."** **[DRH]**

### Entra no subsídio — confirmado **[DRH]**

| Item | Observação |
|---|---|
| Kilo | self-service por peso |
| Prato básico | |
| Suco de máquina | o do dispenser, não o de garrafa ou caixinha |
| Fruta | a fruta em si |
| Gelatina | |

### NÃO entra no subsídio — confirmado **[DRH]**

Vai **integral** para a folha, mesmo que o seu dia tenha ficado abaixo dos R$ 35,00.

| Item | Por quê |
|---|---|
| Coca-Cola e refrigerante | item de geladeira |
| Qualquer coisa de geladeira | critério explícito do DRH |
| Bolo | sobremesa elaborada |
| Salada de frutas | sobremesa elaborada |

### Consequência prática

O subsídio **não é função do total da nota**, é função da parte subsidiável dela. Duas notas de
R$ 30,00 podem gerar descontos diferentes:

```
Nota A: kilo 30,00                    -> subsídio 30,00 · para a folha  0,00 + participação
Nota B: kilo 22,00 + coca 8,00        -> subsídio 22,00 · para a folha  8,00 + participação
```

É por isso que o app pede a parte sem subsídio **marcada no lançamento** e não tenta adivinhar
pelo texto do cupom: chutar erraria dinheiro em silêncio. **[APP]**

---

## 4. A fórmula

### Por dia

```
base(dia)      = soma dos itens COM subsídio, de todas as notas Sapore do dia
extras(dia)    = soma dos itens SEM subsídio (geladeira, sobremesa elaborada)

subsídio(dia)  = MÍNIMO( base(dia) ; 35,00 )
para a folha   = MÁXIMO( 0 ; base(dia) − 35,00 )  +  extras(dia)
participação   = 0,15% do salário-base            (uma vez, se houve consumo no dia)
```

### No fechamento da folha

```
desconto em folha = soma das participações
                  + soma do que foi para a folha em cada dia
                  + todo o consumo no Rei do Mate

subsídio da FGV   = soma dos subsídios de cada dia
```

### A conferência que fecha

```
consumo = subsídio da FGV + o que foi para a folha + Rei do Mate + pago fora da FGV
```

Repare que **desconto + subsídio passa do consumo** — passa exatamente na participação, porque ela
não paga comida. Isso é o certo, não é erro de conta. **[DRH]**

### Rei do Mate

Todo o consumo é descontado **integral**, sem subsídio e sem teto. **[DRH]** Não consome nada do
R$ 35,00 do dia. **[?]** — o documento diz "sem a aplicação do subsídio", o que se lê como
não participar do teto, mas não afirma isso com essas palavras.

### Fora da FGV

Bar, padaria, restaurante da rua: **0% de subsídio e não passa pela folha** — foi pago na hora, do
bolso. Não é regra do DRH, é um caso que o app controla porque o gasto com comida é um só para quem
paga. **[APP]**

---

## 5. Exemplo conferido

Salário-base R$ 10.000,00 → participação de **R$ 15,00 por dia** com consumo.

| Dia | Consumo | Subsídio FGV | Vai para a folha |
|---|---|---|---|
| Kilo 30,00 | 30,00 | 30,00 | 15,00 *(só a participação)* |
| Kilo 42,00 | 42,00 | 35,00 | 22,00 = 15,00 + 7,00 |
| Kilo 28,00 + coca 8,00 | 36,00 | 28,00 | 23,00 = 15,00 + 8,00 |
| Almoço 25,00 + jantar 25,00 | 50,00 | 35,00 | 30,00 = 15,00 + 15,00 |
| Só Rei do Mate 12,00 | 12,00 | 0,00 | 12,00 *(sem participação)* |

Mês de agosto/2026, 14 dias de consumo, conferido contra planilha:

```
consumo ................ R$ 429,00
subsídio da FGV ........ R$ 383,00

desconto em folha ...... R$ 256,00
   participação (14 × 15) ... 210,00
   excedente do teto .........  46,00
```

---

## 6. O que falta confirmar com o DRH

Lista para levar pronta. Nenhuma delas está respondida no documento recebido.

**Sobre a participação de 0,15%**

1. A periodicidade é **por dia com consumo**? Foi assim que veio a informação, mas o documento
   escreve "diário" só no subsídio e não marca periodicidade no percentual. Com salário de
   R$ 10.000 e 20 dias, a diferença é **R$ 300,00 contra R$ 15,00** no mês — é a maior incerteza
   que resta.
2. Num dia em que só houve item **sem** subsídio (só uma coca, por exemplo), incide a
   participação? Houve uso do refeitório, mas não houve subsídio.
3. A base é o **salário-base puro** ou inclui adicionais, gratificação, função?
4. Existe **teto mensal** para a participação, ou para o benefício como um todo? O handoff antigo
   do projeto mencionava um teto mensal "cujo valor não foi informado", e o documento novo não
   fala nada.
5. Dia de férias, falta, feriado ou home office: se não houve consumo, não há participação —
   correto?

**Sobre a classificação dos itens**

6. **Café e chá** da máquina: entram, como o suco de máquina?
7. **Água mineral em garrafa**: é "de geladeira"? Entra ou não?
8. **Suco de caixinha ou lata, iogurte, leite fermentado**: geladeira, logo fora?
9. **Sorvete e picolé**: fora, por freezer?
10. **Pudim, mousse, doce de leite**: contam como "sobremesa elaborada"?
11. **Salgado, pão de queijo, sanduíche do balcão, sopa, açaí**: não são geladeira nem sobremesa —
    entram no subsídio?
12. Existe **prato além de "kilo" e "básico"** (executivo, grelhado, massa) e ele tem tratamento
    diferente?
13. O **cupom da Sapore separa** o que tem e o que não tem subsídio, ou a conferência tem de ser
    feita item por item pelo funcionário?

**Sobre o fechamento**

14. A rubrica do contracheque soma **quinzena anterior + quinzena atual**? É o que o app assume.
15. Quando muda a tabela (hoje 2026/2027, R$ 35,00), a **data de virada** é qual? O valor anterior
    era R$ 31,59 — desde quando vale R$ 35,00?

---

## 7. Onde o app assume algo

Tudo aqui é **[APP]** — decisão de implementação, não regra da FGV. Está listado para não se
confundir com norma.

| Assunto | O que o app faz | Por quê |
|---|---|---|
| Duas notas no mesmo dia | Distribui o teto em **ordem cronológica**: a primeira nota consome, a seguinte pega o resto | É o que acontece na catraca — quando você almoçou, o teto do dia estava inteiro |
| Dia com consumo só de item sem subsídio | **Cobra** a participação | Houve uso do refeitório. É a pergunta 2 da seção 6; se o DRH disser o contrário, muda uma linha |
| Salário | **Não pede e não guarda** | O usuário informa a participação já em reais, lida do contracheque, e o campo é opcional |
| Participação vazia | Fica **fora da conta**, e a tela declara que o número está incompleto | Nenhum número inventado |
| Vigência do teto | R$ 35,00 valendo **desde o início dos lançamentos** | Escolha do usuário, na falta da data de virada (pergunta 15) |
| Gasto fora da FGV | Entra no controle do período, **fora** da folha e com 0% de subsídio | O gasto com comida é um só para quem paga |

---

## 8. Histórico da regra neste projeto

Registro do que já foi acreditado e caiu, porque saber o que foi descartado evita repetir:

| Versão | O que se acreditava | Como caiu |
|---|---|---|
| Commit inicial | teto R$ 31,59 e 0,15% por dia, aplicado sobre o total do dia | O salário saiu do app por decisão de privacidade e a participação parou de ser calculada |
| Até 21/08/2026 | teto de **R$ 31,59 por refeição**, 0,15% "por ida" e depois "por refeição", fora da conta | Documento do DRH: é **R$ 35,00 por dia**, e a participação entra na conta |
| Resumos de conversas internas | "a FGV paga até R$ 20,00" | Era a visão **líquida** (35,00 − 15,00 de participação), não o subsídio bruto |
| Fórmula de terceiros | `0,15% + máx(0; total − 31,59)` | Usava o **total** da nota em vez da base subsidiável, e não tratava consumo abaixo do teto |
