# Lições Aprendidas: Padrões de HTML, CSS e Formulários

Este documento consolida as práticas, truques e lições aprendidas durante a construção dos aplicativos que seguem este padrão (Vanilla JS, Firebase, Mobile-first). Ele serve como um complemento prático às regras arquiteturais.

---

## 1. HTML e Estrutura

### Delegação de Eventos via `data-*`
Nunca amarre eventos (`onclick`, `addEventListener`) diretamente aos elementos que são gerados dinamicamente via `innerHTML`. Ao invés disso, use atributos `data-` (ex: `data-abrir="sheet-opcoes"`, `data-salvar`, `data-acao="excluir"`) e capture-os no `document.addEventListener` global. Isso evita "vazamento de memória" e falhas quando componentes são re-renderizados.

### Elementos Nativos e Semântica
- Use `<main class="screen">` para as telas principais (abas).
- Use `nav` para a barra inferior, `header` para cabeçalhos.
- Não crie "div soup" (divs desnecessárias). O Flexbox e o Grid lidam muito bem com os elementos diretamente.

### Reconciliação de Handoff (Design x Lógica)
Quando um protótipo/UI é entregue pronto (seja por um designer ou IA), a marcação dele (IDs, classes) torna-se a nova fonte da verdade. É sempre mais rápido e limpo adaptar o JS para amarrar os novos elementos do que destruir a semântica do HTML/CSS para forçar encaixe com variáveis legadas (ex: forçar um `<div id="toast">` se o design previu outro formato de notificação).

---

## 2. Formulários (Forms) e Inputs

### Experiência de Digitação
- **Teclado correto no celular:** Use `type="email"`, `type="tel"`, `type="number"` para abrir o teclado adequado no mobile. Use `inputmode="numeric"` para números formatados ou senhas numéricas.
- Evite foco automático (`autofocus`) em dispositivos móveis, pois isso pode subir o teclado abruptamente e quebrar a transição de telas ou de Bottom Sheets.

### Estilização de Campos
- O padrão visual para inputs (`<input>`, `<select>`, `<textarea>`) deve sempre ter uma altura fixa para toque (ex: `44px` a `48px`).
- Evite as setinhas nativas dos selects do navegador, que muitas vezes desalinham o texto. Você pode limpar a aparência padrão (`appearance: none; -webkit-appearance: none;`) e adicionar um ícone customizado no fundo via CSS (ex: usando um `background-image` de um SVG chevron).

### Validação e Feedback
- Faça a validação visual. Quando algo estiver errado, adicione uma classe `.erro` ou mude o atributo (ex: `data-valido="false"`) para que as bordas do campo fiquem da cor de aviso (`var(--bad)`).
- Evite `alert()`. Use sempre a função nativa do padrão `aviso("Mensagem")` (o Toast) para dar feedback imediato de ações concluídas ou erros de formulário.

---

## 3. CSS e Design System

### Efeito de Vidro (Glassmorphism / Blurs)
Sempre que usar transparências com desfoque (como em headers flutuantes, navbars e fundos escurecidos de bottom sheets), lembre-se do Safari do iOS. O CSS puro `backdrop-filter: blur(10px)` não funciona sem o prefixo:
```css
-webkit-backdrop-filter: blur(10px);
backdrop-filter: blur(10px);
```

### Espaçamento Seguro do iOS (Safe Area)
Os iPhones sem botão Home possuem um traço preto/branco no rodapé (Home Indicator) e o Notch/Dynamic Island no topo. Sempre garanta que suas barras inferiores e superiores não fiquem sob eles:
```css
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

### Evitando o "Puxão" da Tela (Overscroll)
O "overscroll-behavior" (quando você rola além do topo ou do fim da página e ela revela o fundo cinza/branco do navegador) pode quebrar a imersão de "aplicativo nativo".
No seu container principal (normalmente o `body` ou o `#app`), aplique:
```css
body {
  overscroll-behavior-y: none;
}
```

### Animações Suaves
- Animar `height`, `width`, `top`, `left` ou `box-shadow` derruba a performance no celular.
- Limite-se a animar **`transform`** e **`opacity`**.
- Para a Janela de Baixo (Bottom Sheet), sempre transite o `transform: translateY()`:
  `transform: translateY(102%)` (escondido) para `transform: translateY(0)` (aberto).

---

## 4. Comportamentos do "Vanilla JS" no Mobile

### Debounce em Ações Repetitivas
Se você tem formulários ou botões de favoritar, os usuários podem tocar rapidamente várias vezes. Implemente funções simples de "debounce" (esperar N milissegundos antes de disparar) para evitar múltiplas chamadas seguidas ao Firebase ou erros visuais, ou simplesmente desabilite o botão enquanto o salvamento ocorre.

### Troca de Abas Limpa
Ao navegar entre as abas (`.screen`), garanta que os modais abertos na tela anterior sejam recolhidos (como o Sheet ou opções expandidas). Mudar a propriedade de uma classe para esconder a tela é suficiente.

### Limpeza de Dados Locais
Use o `NS` (Namespace) como prefixo de todo `localStorage` usado para rascunhos, para que diferentes apps deste mesmo formato, mesmo sob a mesma URL (ex: localhost), não apaguem ou baguncem os dados um do outro.

---

## 5. Infraestrutura e PWA

### Cuidado Extremo com Manifest e PWA
O prompt de "Instalar Aplicativo" no Android (Chrome) não funciona se o `manifest.json` apontar apenas para ícones `.svg`. Ele exige estritamente a declaração de PNGs nos tamanhos `192x192` e `512x512` (sendo o 512 `maskable`). E o Service Worker não é lido por telepatia: ele **deve** ser registrado na `<head>` do `index.html`. Sem essas regras estritas, a regra invariável de PWA do `PADRAO.md` falhará silenciosamente e o usuário nunca verá a opção de instalar o app nativo.

### Contraste do `<select>`: o menu não é seu
`color-scheme: dark` nos campos não basta. Quem desenha a lista aberta do `<select>` é o
navegador, e ele usa o esquema de cor do **documento** — sem a declaração no `<html>`, ele monta o
menu com fundo branco do sistema enquanto as `option` herdam a cor clara do app: texto invisível.
Declare `color-scheme: dark` no `<html>` (isso também escurece seletor de data e barra de rolagem)
e dê cor e fundo explícitos em `option, optgroup`, para os navegadores que renderizam a lista
dentro da página. E se você usou `appearance: none` no select, reponha uma setinha por
`background-image` — sem ela nada indica que o campo abre.

---

## 6. Números na tela

### A hierarquia visual é uma afirmação sobre o dado
O valor de 42px é lido como "o total". Se ele não for o total, a tela mente sem uma linha de código
errada. No Meu Bandejão o número grande era o desconto em folha e o gasto real ficava num rodapé
de 19px: um mês de R$ 234,90 aparecia como R$ 19,90. Escolha o número grande pelo que a pessoa
pergunta primeiro, e desdobre o resto abaixo dele com peso suficiente para ninguém ignorar.

### Cuidado com número derivado por subtração
`subsidio = bruto - desconto` funcionava enquanto todo gasto passava pela mesma regra. No dia em
que entrou um gasto que não passa (almoço fora, 0% de subsídio), a subtração passou a atribuir à
instituição um dinheiro que ela nunca pagou — e nada quebrou, o número só ficou errado. Some cada
parcela pela sua própria regra e **teste a identidade**: `total = parcela1 + parcela2 + parcela3`.
Um teste que confere a soma pega esse erro; um teste que confere valores fixos não.

### Texto de redação fixa tem lugar fixo
Um aviso legal que começa com "Este valor..." está amarrado ao número que está acima dele. Se você
reordenar a tela e deixar o aviso onde estava, ele passa a se referir a outra coisa — sem que
ninguém tenha editado uma palavra. Ao mover números, mova as notas que falam deles.

---

## 7. Leitura de cupom fiscal (OCR)

### No Brasil, leia o QR code antes de tentar OCR
Cupom de NFC-e traz um QR com a chave de acesso de 44 dígitos, e a chave tem **posição fixa**:
`cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)`. Dela saem CNPJ e número
do cupom sem chute nenhum. Na versão 1 do QR, o conteúdo separado por `|` traz ainda `dhEmi` e
`vNF` — data/hora e valor exatos. Use `BarcodeDetector` quando o navegador tiver, `jsQR` como
reserva. OCR entra depois, só para o que o QR não dá (itens, matrícula).

Reserva boa: a chave **impressa**, em grupos de 4 dígitos. O OCR acerta dígito espaçado muito
melhor que texto corrido — inclusive quando o cupom estreito quebra a chave em duas linhas.

### Pré-processar a imagem rende mais que ajustar regex
Papel térmico é o pior caso do OCR. Antes de reconhecer: amplie para ~1800px na maior dimensão,
converta para cinza e estique o contraste jogando fora 2% de cada ponta do histograma. Sem isso,
o Tesseract lê a data (dígitos grandes e espaçados) e erra todo o resto. Use `tessedit_pageseg_mode`
4 (coluna de texto de tamanhos variados) e tente 6 se não achar o valor.

### O valor não é o maior número do cupom
Tributo aproximado, número de lei, CEP e chave de acesso viram candidatos e ganham. Priorize a
linha do "VALOR A PAGAR", depois "TOTAL", e **descarte** linhas de pagamento (troco, débito, valor
pago) e de ruído (trib, aprox, federal, estadual, lei, PROCON, CEP). No primeiro teste real o app
leu R$ 2,09 num cupom de R$ 10,50 — o 2,09 veio do rodapé jurídico.

### Mostre o texto cru na tela
Um painel recolhível com o que o leitor entendeu transforma "não reconheceu nada" em evidência, e
é a diferença entre ajustar a extração e adivinhar. Mascare CPF ali: é uma tela feita para ser
copiada e colada.

### Identifique o estabelecimento por CNPJ, e aprenda
Nome de loja no OCR sai com erro. CNPJ, vindo do QR ou da chave, não. Guarde o par CNPJ → local
nas preferências do usuário na primeira vez que ele confirmar, e do segundo cupom em diante o
reconhecimento não depende mais de ler o nome.
