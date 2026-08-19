# Trazer um app que já existe para o padrão

Para os apps que você já tem em vanilla e quer padronizar. A ordem importa: cada etapa é
independente e reversível, e as primeiras dão resultado visível sem risco.

Faça uma etapa, publique, veja funcionando, siga. Não tente fazer tudo de uma vez.

---

## Etapa 1 · Instalável no celular (30 minutos, risco zero)

A que dá mais retorno pelo esforço, e não toca em uma linha da lógica.

Copie do `template/public/`: `manifest.json`, `icon.svg` e os dois PNG. Gere os seus ícones
a partir do seu SVG — precisa de **192 e 512 em PNG**, porque o Chrome no Android só oferece
"Instalar" se achar esses dois tamanhos.

No `<head>` do seu `index.html`, acrescente:

```html
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#SUACOR">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon-192.png">
```

No `manifest.json`, ajuste nome, cores e confira que tem `"display": "standalone"` — é essa
linha que faz abrir sem barra de navegador.

Publique e teste no celular: adicione à tela inicial e veja se abre em tela cheia.

---

## Etapa 2 · Funcionar offline (1 hora, risco baixo, mas atenção nos cabeçalhos)

Copie `sw.js` e `sw-desligar.js`. No `sw.js`, edite **duas listas**:

- `CASCO` — os arquivos sem os quais o seu app não abre;
- `SEMPRE_REDE` — os domínios que precisam de rede de verdade: auth, banco, sua API.

Acrescente o bloco de registro do `template/public/index.html` ao seu `<head>` — o que tem o
guard `tinha`, que evita loop de reload na primeira instalação.

**A parte que dá problema é o cabeçalho.** Se o seu `firebase.json` tem uma regra de cache
longo para `**/*.js`, ela pega o `sw.js` junto e você perde o controle do app: publica e
ninguém recebe. Troque o padrão dessa regra para `!(sw).@(js|css)` e acrescente uma regra
separada para `/@(sw.js|manifest.json)` com `no-cache`. Copie do `template/firebase.json`.

A partir daqui você passa a ter uma disciplina nova: **subir o `VERSAO` do `sw.js` a cada
publicação**, junto com o `?v=N` dos assets.

Teste com a rede cortada: DevTools → Network → Offline, e recarregue.

---

## Etapa 3 · Design system por token (algumas horas, risco visual)

Esta é a mais trabalhosa e a que mais muda a cara. Faça num branch.

Copie o bloco `:root` e `html[data-tema="claro"]` do `template/public/styles.css` e troque
`--acento` e `--acento-2` pelas suas cores.

Depois, **caça às cores literais**. Procure todo `#hex` e `rgba()` no corpo do seu CSS e
troque por `var(--token)` ou `color-mix(in srgb, var(--token) N%, transparent)`. Um jeito
rápido de achar o que sobrou:

```bash
grep -oE '#[0-9a-fA-F]{3,8}|rgba?\([0-9., ]+\)' styles.css | sort -u
```

As únicas literais aceitáveis são cores de marca de terceiros — o verde do WhatsApp, o azul
do Google — que não mudam entre temas.

Acrescente o botão de tema no cabeçalho e a função `aplicarTema()` do template, mais o script
inline no `<head>`. **Esse script precisa vir antes do `<link rel="stylesheet">`**, senão a
tela pisca branco ao abrir.

Depois de converter, abra o app nos dois temas, tela por tela. O que estiver ilegível é uma
cor que escapou.

---

## Etapa 4 · Portaria e papéis (meio dia, mexe nas Rules)

Só se o seu app tiver link público e você quiser controlar quem entra.

Copie do template: o `firestore.rules` inteiro, a tela `#espera`, o painel de acessos e a
sub-tela `#scr-acessos` do `index.html`, e as seções 7 e 8 do `app.js`.

Ajuste `match /dados/{uid}` para o nome da sua coleção, e o `keys().hasOnly([...])` para os
campos que o seu `users/{uid}` realmente tem.

Publique as Rules com `firebase deploy --only firestore:rules` e **teste no simulador do
console antes**. Um erro aqui não quebra a tela: ele silenciosamente impede as pessoas de
gravar, e o sintoma chega como "sumiu tudo".

Depois, promova-se a admin à mão: `users/{seu-uid}`, campo de texto `papel` = `admin`.

---

## Etapa 5 · Padrões de interface (contínuo)

Sem prazo. Vá trocando conforme mexer em cada tela.

Troque **modal centralizado e página nova** por **janela de baixo**. É o padrão de "abrir uma
coisa" neste modelo, e é o que dá a sensação de app nativo. Copie o `.scrim`, o `.sheet` e as
funções `abrirSheet`/`fecharSheet`.

Troque `alert()` por `aviso()` — o toast.

Se tiver lista que pode crescer, aplique o conjunto: busca, abas por situação com contador,
linhas compactas e barra de ação em lote.

Troque `addEventListener` espalhado por **delegação com `data-*`**. Além de menos código, é
o que faz conteúdo redesenhado continuar funcionando sem religar nada.

Confira os três estados de cada lista: carregando, vazia e com erro.

---

## Checklist de "está no padrão"

- [ ] Sem framework, sem bundler, sem passo de build
- [ ] Sem servidor Node; Firebase Auth + Firestore + Hosting
- [ ] Abre bem entre 320 e 430px, sem scroll horizontal, alvos de toque ≥ 44px
- [ ] `manifest.json` com `display: standalone` e PNG de 192 e 512
- [ ] `sw.js` na raiz, com `VERSAO` versionada
- [ ] `sw.js` e `manifest.json` fora do cache longo no `firebase.json`
- [ ] Assets versionados na URL; `index.html` com `no-cache`
- [ ] Nenhuma cor literal fora do bloco de tokens
- [ ] Dois temas trocáveis por `data-tema`, com contraste AA calculado
- [ ] Estado nunca comunicado só por cor
- [ ] `prefers-reduced-motion` respeitado
- [ ] Toda a segurança nas Firestore Rules, com limite de tamanho
- [ ] Janela de baixo no lugar de modal
- [ ] Delegação por `data-*` no lugar de listeners espalhados
- [ ] Teste automatizado abrindo o app e navegando por todas as telas

---

## Erros que já custaram caro

Vale ler antes, porque cada um destes já aconteceu.

**Cache longo pegando o `sw.js`.** O app perde a capacidade de se atualizar e você só
descobre quando alguém reclama de estar vendo conteúdo antigo. Conserto exige o botão de
pânico.

**Publicar com a flag de modo local ligada.** O app entra sem Google e salva só no aparelho.
Acontece com facilidade, porque é o que se usa para desenvolver. Ponha na checklist.

**Suspeitar do deploy antes de conferir.** Quando o comportamento não muda depois de publicar,
leia o arquivo direto do servidor (`curl -s https://seu-app.web.app/app.js | grep ...`) em vez
de abrir o site. Já aconteceu de o código estar no ar e a hipótese é que estava errada — e o
tempo foi gasto no lugar errado.

**Uma cor literal esquecida no CSS.** Não aparece no tema em que você desenvolve; aparece no
outro, e só quando alguém troca.

**Contador calculado dentro do laço que desenha a lista.** Se houver filtro ou busca, o número
passa a contar só o visível e mente. Use uma função só, que alimente o número e a lista.
