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
