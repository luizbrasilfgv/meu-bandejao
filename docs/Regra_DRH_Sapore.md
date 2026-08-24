# Regra do desconto do refeitório — Sapore, Sede Botafogo

Documento único da regra. Serve para três coisas: conferir o contracheque, alimentar o cálculo do
app e ser levado ao DRH quando alguma linha estiver em dúvida.

Para circular entre colegas há duas versões desta mesma regra, e **as três mudam juntas**:
`Regra_Refeitorio_Infografico.html`, uma folha A4 em linguagem de chão de fábrica com os exemplos
por faixa de salário, e `Bot_DRH_Refeitorio.md`, que alimenta o bot do DRH.

Cada afirmação vem marcada com a **procedência**, porque neste assunto já circulou muita
informação de segunda mão que não se sustentou:

| Marca | Significado |
|---|---|
| **[DRH]** | Está no documento do DRH de 21/08/2026 ou na resposta direta do DRH. É norma. |
| **[APP]** | Decisão do aplicativo onde a norma é silenciosa. Não é regra da FGV. |
| **[?]** | Não confirmado — e, hoje, sem efeito no cálculo. Estão listados no fim da seção 6. |

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
    ATÉ 0,15% do seu salário-base, por DIA em que consumiu
      — nunca mais do que o prato subsidiável daquele dia custou
  + tudo o que passar dos R$ 35,00 no dia
  + tudo o que não é do balcão das comidas (geladeira, sorvete, café, salgado)
  + todo o consumo no Rei do Mate, integral
```

Três pontos que costumam ser lidos errado:

1. **O teto é do DIA, não da nota.** Almoçar e jantar na Sapore no mesmo dia não dá dois tetos:
   as duas notas dividem um único R$ 35,00. **[DRH]**
2. **Sobra não acumula.** Gastou R$ 20,00 hoje? Os R$ 15,00 que faltaram não viram crédito para
   amanhã nem voltam para você. **[DRH]**
3. **A participação é ATÉ 0,15%, não 0,15% cheio.** É o limite do que sai do seu bolso pelo prato,
   não uma taxa fixa. Num dia em que o prato custou menos que os 0,15%, **você paga o valor do
   prato e nada além**. Nas palavras do DRH, em 24/08/2026: *"não 0,15% cheio para toda vez que for
   comer — se seu prato deu 5 reais, você vai pagar 5 reais na folha, mesmo seu 0,15% for 22,50."*
   **[DRH]** Consequência: **o desconto nunca passa do que você consumiu.**
   Cuidado com a outra ponta, também corrigida pelo DRH: **nunca escreva "a FGV cobre o prato
   inteiro" abaixo do teto.** Lê como refeição de graça, e não é — você paga a sua parte em todo dia
   de uso. **[DRH]**

---

## 3. O que entra e o que não entra no subsídio

O critério, na frase do DRH: **"somente o que está no balcão das comidas."** **[DRH]**

> **Mudou em 21/08/2026.** Até então valia *"nada que é de geladeira ou sobremesa elaborada entra
> no subsídio"*, e a sobremesa elaborada ficava fora. O Fernando pediu a inclusão, e **sobremesa
> elaborada passou a entrar**. O critério em vigor é o do balcão das comidas. **[DRH]**

### Entra no subsídio — confirmado **[DRH]**

| Item | Observação |
|---|---|
| Kilo | self-service por peso |
| Prato básico | |
| Suco de máquina | o do dispenser, não o de garrafa ou caixinha |
| Fruta | a fruta em si |
| Gelatina | |
| Sobremesa do balcão | **elaborada inclusive**: bolo, torta, pudim, salada de frutas |

### NÃO entra no subsídio — confirmado **[DRH]**

Vai **integral** para a folha, mesmo que o seu dia tenha ficado abaixo dos R$ 35,00.

| Item | Por quê |
|---|---|
| Coca-Cola e refrigerante | bebida de geladeira |
| Água de garrafa, suco de caixinha, iogurte | bebida de geladeira |
| Qualquer coisa de geladeira | critério explícito do DRH |
| Sorvete, picolé, açaí | vem do freezer, não do balcão das comidas **[APP]** |
| Café, salgado | não é do balcão das comidas **[APP]** |

### Na dúvida, não entra

O DRH nomeou o balcão das comidas como o que entra, e a geladeira como o que não entra. Não disse o
que fazer com o que não está em nenhum dos dois — café, salgado, sopa, sorvete. A regra adotada é a
**restritiva: o que não é do balcão das comidas fica de fora.** Dois motivos, e os
dois apontam para o mesmo lado:

1. Instituição lê benefício pelo lado que gasta menos, e é essa leitura que chega ao contracheque.
2. Este app **prevê** desconto. Prever desconto maior do que vem é susto que não acontece; prever
   menor é susto no contracheque. O erro tem que cair no lado que não machuca.

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
extras(dia)    = soma dos itens SEM subsídio (geladeira, sorvete, café, salgado)

subsídio bruto = MÍNIMO( base(dia) ; 35,00 )
participação   = MÍNIMO( 0,15% do salário-base ; subsídio bruto )   <- é ATÉ 0,15%
subsídio(dia)  = subsídio bruto − participação                      <- o que a FGV bancou
para a folha   = participação + MÁXIMO( 0 ; base(dia) − 35,00 ) + extras(dia)
```

O `MÍNIMO` da participação é a regra inteira do "até": sem ele, um prato de R$ 5,00 cobraria os
0,15% cheios e o desconto passaria do consumo. **[DRH]**

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

A soma **fecha sempre**, sem exceção, porque a participação é limitada ao subsídio bruto do dia:
ela nunca cobra mais do que havia de comida subsidiada para cobrar. **[DRH]**

### Rei do Mate

Todo o consumo é descontado **integral**, sem subsídio e sem teto. **[DRH]** Não consome nada do
R$ 35,00 do dia — se não há subsídio aplicado, não há subsídio consumido. **[DRH]**

### Fora da FGV

Bar, padaria, restaurante da rua: **0% de subsídio e não passa pela folha** — foi pago na hora, do
bolso. Não é regra do DRH, é um caso que o app controla porque o gasto com comida é um só para quem
paga. **[APP]**

---

## 5. Exemplo conferido

Salário-base R$ 10.000,00 → participação de **até R$ 15,00 por dia** com consumo. A coluna do
subsídio é o que a FGV bancou de fato, já descontada a participação.

| Dia | Consumo | Subsídio FGV | Vai para a folha |
|---|---|---|---|
| Kilo 30,00 | 30,00 | 15,00 | 15,00 *(só a participação)* |
| Kilo 42,00 | 42,00 | 20,00 | 22,00 = 15,00 + 7,00 |
| Kilo 28,00 + coca 8,00 | 36,00 | 13,00 | 23,00 = 15,00 + 8,00 |
| Almoço 25,00 + jantar 25,00 | 50,00 | 20,00 | 30,00 = 15,00 + 15,00 |
| Só Rei do Mate 12,00 | 12,00 | 0,00 | 12,00 *(sem participação)* |
| **Kilo 10,00** | 10,00 | 0,00 | **10,00** *(a participação para no prato)* |

A última linha é a regra do "até": os 0,15% dariam R$ 15,00, mas o prato custou R$ 10,00 e é isso
que sai. Confira em toda linha: **consumo = subsídio + folha**.

Mês de agosto/2026, 14 dias de consumo, conferido contra planilha:

```
consumo ................ R$ 429,00
subsídio da FGV ........ R$ 173,00   (líquido: já sem a participação)

desconto em folha ...... R$ 256,00
   participação (14 × 15) ... 210,00
   excedente do teto .........  46,00
```

Repare que 173,00 + 256,00 = 429,00: a soma fecha.

---

## 6. Pontos que já estavam em dúvida e foram fechados

Estão aqui porque cada um deles já provocou cálculo errado neste projeto. Não são perguntas
abertas — são respostas.

| Dúvida | Resposta | Procedência |
|---|---|---|
| Periodicidade dos 0,15% | **Por dia.** Uma vez por dia com consumo, não por nota e não por mês | **[DRH]** confirmado pelo usuário e pela planilha de conferência, cuja coluna de participação tem uma incidência por dia |
| Os 0,15% são piso ou teto? | **Teto.** É *até* 0,15% — prato de R$ 5,00 com 0,15% de R$ 22,50 dá R$ 5,00 de folha. Ver abaixo | **[DRH]** 24/08/2026 |
| Existe teto mensal? | **Não existe.** | **[DRH]** |
| Dia sem consumo | Não paga nada. Sem consumo, sem participação | **[DRH]** |
| Dia com consumo só de item sem subsídio (uma coca e nada mais) | Paga a coca integral. A participação é **zero**: sendo "até 0,15% do prato", sem prato subsidiável não há do que tirar. Antes daqui estava anotado "paga os 0,15% se passou na roleta", pela leitura de piso que caiu em 24/08 | **[?]** — a resposta do "até" resolve o caso por construção, mas este sub-caso não foi perguntado ao DRH com estas palavras |
| Consumo exatamente igual a R$ 35,00 | Paga os 0,15% (que cabem inteiros nos 35,00). O excedente é zero | **[DRH]** |
| Itens que o DRH não citou pelo nome | **Não entram.** O subsídio cobre o balcão das comidas e nada além. Café, salgado, sopa: fora | **[DRH]** — leitura restritiva, ver abaixo |
| Rei do Mate consome o teto do dia? | **Não.** É integral, sem subsídio aplicado, e não toca nos R$ 35,00 | **[DRH]** |
| Vigência do R$ 35,00 | **Sempre foi 35,00** no período que o app cobre. O R$ 31,59 é valor antigo, de tabela anterior aos lançamentos | **[DRH]** |
| Base dos 0,15%: salário-base ou bruto? | **É o mesmo número.** O documento escreve "Salário Base" e o DRH o entende como o **bruto** do contracheque — o valor antes dos descontos, não o líquido | **[DRH]** |

### A pergunta do prato barato, respondida em 24/08/2026

Nenhum exemplo do documento do DRH tem consumo **abaixo** da participação, então por um tempo o app
tratou os 0,15% como **piso** — cobrava-os inteiros e o desconto passava do consumo. Pergunta feita
ao DRH, textual: *"quando os 0,15% do salário passam do valor que eu consumi de comida subsidiada
no dia, a FGV cobra os 0,15% inteiros mesmo assim, ou cobra no máximo o que eu consumi?"*

Resposta do Pedro Henrique, do DRH, também textual: **[DRH]**

> Não. É **até 0,15%**. Não 0,15% cheio para toda vez que for comer. Se seu prato deu 5 reais, você
> vai pagar 5 reais na folha, mesmo seu 0,15% for 22,50.

E o enquadramento geral, na mesma conversa: *"eu pago até 0,15% do meu salário e a FGV paga o
restante até o teto de R$ 35,00; se passar desse valor tem a diferença que a FGV paga e o que eu
pago depois."*

Ou seja: **a participação é teto, não piso**, e o desconto nunca passa do consumo. Onde isso mora no
código é o `Math.min` de `calcularRateio`, que limita o corte à soma do subsídio bruto do dia.

Ficam de fora duas coisas, e nenhuma afeta o cálculo:

* Se a regra é a mesma nas outras unidades da FGV. **[?]** O documento fala só da Sede Botafogo, e
  o uso é na Sede.
* Como a rubrica do contracheque agrupa o envio do consumo — se soma a quinzena anterior com a
  atual, como o app assume. **[?]** **Isso não é pergunta para o DRH: quem sabe é a Sapore**, que é
  quem envia o consumo. Enquanto não houver resposta, a tela mostra as duas quinzenas separadas,
  que é a forma que não erra em nenhuma das hipóteses.

---

## 7. Onde o app assume algo

Tudo aqui é **[APP]** — decisão de implementação, não regra da FGV. Está listado para não se
confundir com norma.

| Assunto | O que o app faz | Por quê |
|---|---|---|
| Duas notas no mesmo dia | Distribui o teto em **ordem cronológica**: a primeira nota consome, a seguinte pega o resto | O teto é do dia, e a tela mostra o rateio linha por linha — precisa de uma ordem. A cronológica é a que corresponde à roleta: quando você almoçou, o teto do dia estava inteiro |
| Salário | **Guardado só no aparelho**, nunca enviado ao Firestore | Regra de banco não protege de quem abre o console do projeto. O que não está lá não pode ser visto. Custo aceito: não sincroniza entre aparelhos |
| Salário vazio | A participação fica **fora da conta**, e a tela declara que o número está incompleto | Nenhum número inventado |
| Vigência do teto | R$ 35,00 valendo **desde o início dos lançamentos**, sem política de vigência cadastrada | Não é suposição: o R$ 35,00 é o valor de toda a janela que o app cobre. O R$ 31,59 é de tabela anterior a ela |
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
| Até 24/08/2026 | os 0,15% como **piso**: saíam inteiros, e num dia de prato barato o desconto passava do consumo | Resposta do DRH: é **até** 0,15%. Prato de R$ 5,00 paga R$ 5,00, mesmo com os 0,15% em R$ 22,50. A soma voltou a fechar sempre |
