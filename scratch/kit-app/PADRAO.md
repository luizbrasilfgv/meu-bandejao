# Padrão de aplicativo — web vanilla + Firebase + PWA

Documento de arquitetura. Serve para três coisas: guiar você, ser colado como **prompt base**
para um assistente que vá construir ou alterar um app, e servir de checklist para trazer um
app que já existe para dentro do padrão.

Nada aqui é específico de um produto. Onde aparecer `<APP>`, troque pelo seu.

---

## 1. O que é este padrão, em uma frase

Um site estático de três arquivos, hospedado no Firebase, autenticado por Google, com estado
no Firestore, que abre no celular como se fosse um aplicativo instalado e funciona sem
internet.

---

## 2. Regras invioláveis

Estas não são preferências. Um app que quebre qualquer uma delas está fora do padrão.

**Vanilla JavaScript.** Sem React, Vue, Svelte, jQuery ou qualquer framework. ES6 modules
nativos.

**Sem passo de build.** Sem bundler, sem transpiler, sem `npm run build`. O que está na pasta
publicada é literalmente o que o navegador baixa. Dependência de desenvolvimento (teste, lint)
é permitida; dependência de produção, não.

**Sem servidor Node.** Sem Express, sem Cloud Functions como parte obrigatória da arquitetura.
Se você precisou de um servidor, ou o problema mudou, ou a solução está errada.

**Firebase como plataforma inteira.** Auth (Google), Firestore (dados), Hosting (o site).
Nada de banco próprio, nada de outra hospedagem.

**Identidade só pelo Google.** O login é exclusivamente OAuth Google. O app **não cria senha
própria**, não guarda senha e não pede CPF, documento, cartão ou endereço para entrar. Quem
confere quem a pessoa é é o Google; o app recebe nome, e-mail e foto, e nada mais.

Isto não é só conveniência. Senha própria significa recuperação de senha, senha provisória,
força bruta e vazamento — quatro problemas que o app não tem obrigação de resolver. E significa
e-mail **não verificado**: regra que identifica administrador por e-mail passa a poder ser
enganada por quem se cadastra com o e-mail do dono. Se um dia um segundo provedor for
inevitável, a regra de dono tem de exigir o provedor verificado
(`request.auth.token.firebase.sign_in_provider == 'google.com'`) — ver `PRIVACIDADE-LGPD.md`,
armadilha ARM-08.

**Privacidade não é opcional.** Todo app deste padrão nasce com as três coisas: aviso na tela de
entrada, aceite registrado no primeiro acesso e botão de saída com pedido de remoção. O que cada
uma exige está na seção 12, e o detalhe em `PRIVACIDADE-LGPD.md`. App sem elas está fora do
padrão, mesmo que funcione.

**Mobile-first de verdade.** Alvo 320px (iPhone SE) a 430px (Pro Max). O container tem largura
máxima e fica centralizado. Zero scroll horizontal. Alvos de toque de no mínimo 44px.

**100% web, 100% smartphone.** Abre em qualquer navegador, mas é desenhado para o polegar, em
pé, com uma mão só. Se abrir bem no desktop, é bônus, não requisito.

**Instalável.** Manifest + ícones + service worker. A pessoa toca no link, adiciona à tela
inicial, e passa a abrir sem barra de navegador, como um app.

**Funciona offline.** O app abre e navega sem rede.

---

## 3. A estrutura de arquivos

```
<APP>/
├── public/                  ← só isto vai pro ar
│   ├── index.html           todas as telas, sem template engine
│   ├── app.js               a aplicação inteira, um módulo ES6
│   ├── styles.css           o design system, tudo por token
│   ├── sw.js                service worker
│   ├── manifest.json
│   ├── icon.svg · icon-192.png · icon-512.png
│   └── data.js              (opcional) dados estáticos
├── firebase.json            hosting, rewrites, cabeçalhos de cache
├── firestore.rules          TODA a segurança mora aqui
├── firestore.indexes.json
├── .firebaserc              aponta pro projeto
├── PUBLICAR.bat / .command  deploy com dois cliques
└── docs/
```

Um arquivo por responsabilidade. Não quebre o `app.js` em dez módulos: sem bundler, cada
`import` é um round-trip de rede. Se ele passar de umas 2.000 linhas, aí sim vale separar — e
separe por domínio, não por tipo.

---

## 4. Como o `app.js` se organiza

Linear, dividido por comentários de bloco, nesta ordem:

```
0. CONFIG          firebaseConfig, constantes, flag CONFIGURADO
1. DOMÍNIO         a lógica do seu app — pura, sem DOM
2. PERSISTÊNCIA    salvar com atraso, carregar, fallback local
3. TEMA            aplicarTema()
4. RENDER          funções pintarX() que desenham a partir do estado
5. SHEET & TOAST   janelas de baixo e avisos
6. EVENTOS         delegação de clique, um listener para tudo
7. FIREBASE        auth, portaria, snapshots
8. ADMIN           (se houver) aprovação de usuários
```

**A regra que substitui a reatividade:** estado global explícito em `let` no topo de cada
seção, e funções `pintarX()` que redesenham a partir dele. Mudou estado, chame a pintura. Não
existe nada observando por você.

**A regra que substitui componentes:** HTML montado com template literals e injetado com
`innerHTML`. Sempre passe texto vindo de fora por uma função de escape.

**A regra dos eventos:** um `addEventListener` no `document`, e interação identificada por
atributo `data-*`. Ao acrescentar um botão, acrescente um `data-` novo — não um listener novo.
Isso é o que faz conteúdo redesenhado continuar funcionando sem religar nada.

```js
document.addEventListener("click", e => {
  const a = e.target.closest("[data-abrir]");   if (a) return abrirSheet(a.dataset.abrir);
  const b = e.target.closest("[data-marcar]");  if (b) return alternar(b.dataset.marcar);
});
```

**A regra da lógica de domínio:** a seção 1 não pode tocar no DOM. É o único pedaço que
sobrevive a uma reescrita futura, e é o único que dá para testar sem navegador.

---

## 5. Firebase

### Auth

Login com Google, `browserLocalPersistence`, e um **gate**: enquanto não há usuário, o app
inteiro fica escondido atrás de uma tela de login.

### Firestore — modelo de dados

Um documento por usuário, com o `uid` como id. Coleção `users` para perfil e papéis; uma
coleção por tipo de estado que o usuário guarda.

```
users/{uid}          → { nome, email, foto, roles[], status, criadoEm, tema }
<seus_dados>/{uid}   → { ...o que o app guarda..., atualizadoEm }
```

**Se o app tiver dois conjuntos de dados independentes, use duas coleções, não dois campos
no mesmo documento.** Coleção separada é garantia física de isolamento: um bug num módulo não
tem sequer a referência do documento do outro. Vale o código duplicado.

### Portaria — controle de quem entra

O link é público; qualquer um com conta Google consegue abrir. O padrão é:

1. Ao entrar pela primeira vez, o app cria `users/{uid}` com `roles: ["member"]` e
   `status: "pendente"`.
2. Quem está pendente vê uma tela de "aguardando liberação" e **não grava nada**.
3. Um administrador aprova. As Rules é que impedem a auto-promoção.

O primeiro administrador é promovido à mão no console do Firebase. Use um campo **string**
(`papel: "admin"`), não um array — o editor de array do console é pouco confiável — e faça as
Rules aceitarem os dois caminhos.

### Firestore Rules — o modelo

Toda a segurança está aqui. O `firebaseConfig` dentro do `app.js` é **público por natureza**:
ele identifica o projeto, não autoriza nada. Não gaste esforço tentando escondê-lo.

O desenho essencial é: **o cliente não pode se promover**.

```
function ehAdmin() { roles.hasAny(['admin']) || get('papel','') == 'admin' }
function aprovado(){ status == 'aprovado' }

match /users/{uid} {
  allow get:  if eu(uid) || ehAdmin();
  allow list: if ehAdmin();                        // ninguém enumera a base
  allow create: if eu(uid)
                && request.resource.data.roles == ['member']
                && request.resource.data.status == 'pendente'
                && !('papel' in request.resource.data)
                && request.resource.data.keys().hasOnly([...lista fechada...]);
  allow update: if ehAdmin()
                || (eu(uid) && roles, status e papel saem idênticos aos que entraram);
  allow delete: if ehAdmin();
}

match /<seus_dados>/{uid} {
  allow read:  if eu(uid) || ehAdmin();
  allow write: if eu(uid) && aprovado() && <valide forma e tamanho>;
}

match /{document=**} { allow read, write: if false; }   // fecha o resto
```

Sempre limite tamanho (`size() <= N`) e valide tipo. Sem isso, qualquer pessoa aprovada pode
inflar seu banco.

### Leitura e escrita

Leia com **`onSnapshot`**, não `getDoc` — o app passa a atualizar sozinho entre celular e
computador. Guarde-se contra o eco da própria escrita comparando o que chegou com o que já
está em memória antes de repintar.

Escreva com **atraso** (debounce de ~600 ms). A pessoa marca cinco coisas seguidas e isso vira
uma escrita, não cinco.

### Controle de acesso na interface

Três camadas, e é importante não confundir:

1. **Cosmética** — uma lista de e-mails no `app.js` decide quais abas aparecem.
2. **Papel** — `roles` decide se um painel é renderizado.
3. **Rules** — decide o que pode ser lido e escrito de verdade.

Nunca confie em 1 e 2 para proteger dado. Elas existem para não poluir a tela de quem não
precisa.

---

## 6. Design system

### O princípio

**Nenhuma cor literal fora do bloco de tokens.** Todo `#hex` e `rgba()` no corpo do CSS vira
`var(--token)` ou `color-mix(in srgb, var(--token) N%, transparent)`. Uma cor solta quebra um
dos temas — sempre.

### Dois temas, um atributo

```html
<html data-tema="escuro">   <!-- ou "claro" -->
```

`:root` carrega o tema padrão; `html[data-tema="claro"]` sobrescreve os mesmos nomes. Nada
mais no CSS sabe qual tema está ativo. Trocar de tema é trocar um atributo.

O tema **claro** não é o escuro invertido: é a versão que continua legível sob luz direta.
Superfícies sólidas, alto contraste, zero vidro translúcido, nada de cinza claro sobre branco.

### Os tokens obrigatórios

```
--bg --bg2                fundos
--glass --glass-2         superfícies de card
--stroke --stroke-2       bordas: sutil e funcional
--ink --mut --dim         texto: principal, secundário, terciário
--acento --acento-2       cores de marca
--ok --warn --bad --gold  semântica
--*-ink                   texto SOBRE cada preenchimento colorido
--r --r-s --r-pill        raios
--fs-0…--fs-5             escala tipográfica
--sp-1…--sp-6             escala de espaçamento
--t-1 --t-2 --t-3         durações
--ease --ease-pop         curvas
--shadow-1 --shadow-2 --scrim
```

Os `--*-ink` são o detalhe que quase todo mundo esquece: a cor do texto sobre um botão verde
não pode ser a mesma nos dois temas, ou um deles reprova em contraste.

### Tipografia sem download

Três famílias, nenhum arquivo baixado: a do sistema para texto; **monoespaçada para todo
número** (horários, contadores, valores) com `font-variant-numeric: tabular-nums`, que dá
largura fixa aos dígitos e impede colunas de dançar; e uma condensada opcional para títulos
(`Avenir Next Condensed` já vem no iOS, `Roboto Condensed` no Android).

### Contraste

Todo par texto/fundo dos dois temas precisa passar em WCAG AA: 4,5:1 para texto normal, 3:1
para texto grande e bordas funcionais. **Calcule, não estime.**

### Estado nunca só por cor

Quem não distingue vermelho de verde precisa enxergar o estado — e no sol aberto a cor lava
para todo mundo. Todo estado precisa de uma segunda pista: forma, ícone, prefixo textual,
borda tracejada, hachura.

### Movimento

Durações por token. Um bloco `@media (prefers-reduced-motion: reduce)` que zera transforms e
limita transições a opacidade e cor. Só o spinner sobrevive, porque é indicador de progresso.

---

## 7. Padrões de interface

Estes são os componentes que se repetem em todo app deste padrão. Reaproveite o comportamento,
não só a aparência.

### Navegação inferior

Barra fixa no rodapé, 3 a 5 abas, ícone e rótulo. Cada aba é uma `<main class="screen">` no
mesmo HTML; trocar de aba é trocar a classe `.active`. **Não há roteador e não há
navegação de URL** — é uma página só.

Contador numérico na aba quando houver algo a notar. Bolinha vermelha pulsando quando houver
algo esperando ação, no mesmo espírito de "mensagem não lida".

### Sub-tela

Uma tela alcançada por um botão dentro de outra tela, e não pela barra inferior. Ela tem um
botão "‹ voltar" no topo esquerdo, e a aba de origem continua acesa na barra. Serve para
listas longas que não merecem uma aba própria.

### Janela de baixo (bottom sheet)

**É o padrão de "abrir uma coisa" neste modelo — não use modal centralizado, não use página
nova.** Um painel que sobe do rodapé, com uma alça no topo, sobre um fundo escurecido que
fecha ao toque.

```
.scrim  → fixed inset:0, opacity 0, pointer-events none; .on liga
.sheet  → fixed bottom:0, translateY(102%); .on traz para 0
```

Transição de ~320ms com curva `cubic-bezier(.32,.72,0,1)`, que é o que dá a sensação de peso.
`max-height: 86dvh` e rolagem interna. Um sheet por finalidade: detalhe, filtro, confirmação.

### Busca contextual

Uma lupa que expande num campo, **por tela**, pesquisando só o conteúdo daquela tela. Cada tela
guarda o próprio termo, então trocar de aba não apaga a busca da outra. Abaixo do campo, uma
linha "N de M nesta tela".

Normalize com NFD para ignorar acento. A regra de casamento: todas as palavras precisam bater;
se não achar nada, cai para alguma palavra.

Em listas, a busca filtra. Em visões espaciais (calendário, mapa, grade), a busca **não filtra**
— ela acende o que casou e apaga o resto, para não destruir o contexto.

### Ação em lote

Quando uma lista pode crescer, ela precisa de: busca, abas por situação com contador, linhas
compactas e seleção múltipla com uma barra de ação flutuante acima da navegação. Enquanto
houver seleção, os botões de cada linha somem — quem age é a barra.

### Toast

Aviso curto acima da barra inferior, 3 segundos, sem botão de fechar. Nunca use `alert()`.

### Estados de tela

Toda lista precisa de três estados desenhados: carregando, vazia e com erro. Vazia não é uma
tela em branco: é um ícone, uma frase e, quando fizer sentido, um botão.

---

## 8. O app instalável (PWA)

Três arquivos e uma regra de servidor. Detalhes de implementação estão em
`template/public/sw.js` e no `README.md` do kit.

**`manifest.json`** — nome, ícones, cores, e a linha que faz o truque:
`"display": "standalone"`, que manda abrir sem barra de endereço quando aberto pelo atalho.

**Ícones PNG de 192 e 512** — o Chrome no Android só oferece "Instalar" se achar PNG nesses
dois tamanhos. Declare o 512 duas vezes, `"purpose": "any"` e `"purpose": "maskable"`. Para o
iPhone, que ignora o manifest nisso, acrescente `apple-touch-icon` e as duas metas
`apple-mobile-web-app-*`.

**`sw.js` na raiz** — numa subpasta, controlaria só a subpasta. Guarda o casco no `install`,
apaga cache de outra versão no `activate`, e no `fetch` responde do cache e atualiza por trás.
Deixa passar direto os domínios que precisam de rede de verdade (auth, banco, sua API).

**Cabeçalhos** — `sw.js` e `manifest.json` **nunca em cache**. Se houver regra de cache longo
para `**/*.js`, ela pega o `sw.js` junto e você perde o controle do app. Use
`!(sw).@(js|css)`.

**Requisitos** — HTTPS (o Hosting já é), `sw.js` na raiz, e não funciona por `file://`.

**Disciplina obrigatória** — subir a versão em dois lugares a cada publicação: o `?v=N` dos
assets no `index.html` e o `VERSAO` dentro do `sw.js`. Esquecer é o erro clássico: você testa
no seu aparelho, que tem cache limpo, funciona, e as outras pessoas continuam na versão de
três dias atrás.

**Botão de pânico** — um service worker ruim prende as pessoas numa versão velha e não há
como alcançá-las. Guarde o `sw-desligar.js` do kit: substitui o `sw.js`, se desregistra
sozinho, apaga o cache e recarrega limpo.

**O que o offline não cobre por padrão:** a escrita no Firestore não tem fila. Se isso importa
no seu caso, ligue o cache persistente do SDK — está no `README.md` do kit.

---

## 9. Publicar

Assets versionados na URL (`app.js?v=7`) com cache de um ano; `index.html` com `no-cache`,
porque é ele que aponta para a versão nova. Deploy com `firebase deploy`, embrulhado num
`PUBLICAR.bat` para virar dois cliques.

Checklist antes de cada publicação:

1. subir o `?v=N` no `index.html`;
2. subir o `VERSAO` no `sw.js`;
3. conferir que a flag de modo local está em produção;
4. se mexeu nas Rules, publicar `firestore` também.

Para conferir o que **de fato** subiu, sem depender do cache do seu navegador, leia o arquivo
direto do servidor em vez de abrir o site.

---

## 10. Testes

Sem framework de teste no app, mas com teste de verdade: Playwright rodando contra uma cópia
do `public/` com a flag de modo local ligada e um Firestore falso em memória, servida por um
HTTP local, em viewport de 390×900.

O mínimo que precisa estar coberto: o app abre e navega por todas as abas sem erro de
JavaScript; funciona para usuário comum, sem os painéis de admin; os dois temas em todas as
telas; e o modo offline com a rede cortada.

Isso não fere a regra do "sem build" — o app continua sem bundler; a dependência é só de
desenvolvimento.

---

## 11. Privacidade e LGPD

Isto é parte do padrão, não um extra. O documento completo é o **`PRIVACIDADE-LGPD.md`** desta
pasta: triagem de 10 minutos, requisitos com ID, critérios de aceite, 13 armadilhas reais e os
textos prontos para copiar. Aqui fica só o que não se negocia.

### O princípio

**O texto só promete o que o código faz.** Promessa que não bate com o fluxo é pior do que
promessa nenhuma. Três frases que já foram escritas em apps deste padrão e eram falsas:

| Frase | Por que era falsa |
|---|---|
| *"Não guardamos nenhum dado seu"* | o app gravava nome, e-mail, foto e o conteúdo do usuário |
| *"Um botão apaga tudo. Sem burocracia"* | o botão abria um **pedido**, processado à mão |
| *"Só quem o administrador aprova vê"* | havia uma segunda porta de entrada sem aprovação |

Escreva o **inventário** antes do texto: uma tabela com cada lugar onde dado pessoal encosta e
quais campos. O texto é uma leitura do inventário, nunca o contrário. Jeito mais confiável de
levantar: ler os **nomes dos campos** de um backup do Firestore, não o que o código sugere.

E olhe o que o campo **pode conter**, não só o nome dele: num app, a chave PIX guardada em
`dados_sigilosos` é, muitas vezes, o próprio CPF — mesmo sem existir campo `cpf` em lugar nenhum.

### As três coisas, na ordem em que a pessoa encontra

**1 · Aviso na tela de entrada**, antes de qualquer botão de login — não um link para "termos".
Diga que a identidade é conferida pelo Google, que a senha nunca passa pelo app, e o que chega
do login (nome, e-mail e foto). Um expansível com "o que fica salvo, exatamente" em três blocos:
no app, no aparelho, e **nunca** (a lista do que não é pedido, que é o que tranquiliza).

**2 · Aceite bloqueante no primeiro acesso**, depois da portaria e antes de qualquer tela com
dado dentro. Quatro declarações: para que serve o login; o que o app guarda; o que o app não faz
e quem vê; como sair, com o prazo. **Duas saídas, sem terceira** — "Ciente, vamos lá" grava, e
"Prefiro não entrar" desloga. Sem aceite não há acesso, e não há "depois".

O registro tem **três campos, não um**:

| Campo | Valor | Por que |
|---|---|---|
| `lgpdCiente` | `true` | só se grava como verdadeiro; não existe "des-consentir" por engano |
| `lgpdCienteEm` | hora do **servidor** | data de aparelho errado não provaria nada |
| `lgpdVersao` | inteiro | **booleano sozinho não prova qual texto a pessoa leu** |

Texto novo ⇒ versão nova ⇒ o aviso volta uma vez. **Não precisa derrubar sessão**: a checagem
roda a cada abertura, lendo o documento da pessoa.

**3 · Botão de saída no Perfil**, alcançável sem suporte e sem mensagem privada. Decida e
**escreva na tela** qual dos dois é:

| | Pedido para o administrador | Apagamento imediato |
|---|---|---|
| Quando | cascata manual, risco de toque acidental | dado isolado, cascata automática viável |
| Exige | fila visível + prazo | transação que apaga tudo de uma vez |
| Texto diz | *"abre um pedido; o admin executa em até N dias"* | *"apaga agora e não dá para desfazer"* |

Neste padrão, sem servidor, a cascata é manual — então é **pedido**. E aí:

* confirmação em **dois passos na própria tela**, nunca `confirm()` do sistema;
* o pedido é **imutável para o titular**: ele cria o próprio, obrigatoriamente com status
  inicial e carimbo do servidor, e nunca altera nem apaga;
* **`delete` é `false` para todos, inclusive o administrador** — é a trilha que prova o pedido;
* quem decide só pode escrever o **desfecho**. `allow update: if ehAdmin()` **não basta**: sem
  lista branca de campos o admin reescreve `uid`, `email` e a data, ou seja, apaga a identidade
  do pedido sem apagar o documento;
* **fila visível** para quem decide, com contagem. Sem tela, o pedido só existe no console do
  Firebase e fica parado sem ninguém saber;
* **prazo declarado**, de uma constante única (LGPD art. 18, §3º: 15 dias);
* diga o que **sobra**: nome em registro de auditoria, em histórico fechado, em lista de
  presença. Apagar aquilo mudaria conta que já aconteceu — então não prometa;
* diga o que acontece **se a pessoa voltar**: o login recria um cadastro novo, do zero.

### As Rules

Campos do consentimento no documento do usuário, e a coleção do pedido:

```
match /users/{uid} {
  allow update: if ehAdmin()
                || (eu(uid)
                    && diff(resource.data).affectedKeys()
                         .hasOnly(['nome','foto','tema','lgpdCiente','lgpdCienteEm','lgpdVersao'])
                    && (!('lgpdCiente' in diff(resource.data).affectedKeys())
                        || request.resource.data.lgpdCiente == true));
}

match /solicitacoesExclusao/{uid} {
  allow get:    if eu(uid) || ehAdmin();
  allow list:   if ehAdmin();
  allow create: if eu(uid)
                && keys().hasOnly(['uid','email','nome','status','pedidoEm'])
                && request.resource.data.status == 'aberta'
                && request.resource.data.email == request.auth.token.get('email','')
                && request.resource.data.pedidoEm == request.time;
  allow update: if ehAdmin()
                && diff(resource.data).affectedKeys()
                     .hasOnly(['status','resolvidoEm','resolvidoPor'])
                && request.resource.data.status in ['atendida','recusada'];
  allow delete: if false;
}
```

### As três armadilhas que mais custaram

**Campo novo exige mexer nas duas listas.** `create` valida por `keys().hasOnly`, `update` por
`affectedKeys().hasOnly`. Campo fora delas é recusado **em silêncio** — e se o campo é o do
consentimento, a pessoa fica **presa na tela do aviso**. Quem acrescenta campo mexe na regra no
mesmo commit.

**Testar com a sua conta não prova nada.** A regra é `if ehAdmin() || (o caminho de quem não é
admin)`, e você passa pelo primeiro ramo — o segundo nunca é avaliado. Num app deste padrão isso
deixou o botão de excluir conta quebrado para **23 de 26 pessoas**, e em outro deixou uma
preferência sendo recusada calada por semanas. Teste com identidade simulada: `PRIVACIDADE-LGPD.md`,
anexo A.7.

**A ordem dos `ou` decide se a tela abre vazia.** Função que faz `get()` **erra** quando o
documento não existe, e regra que erra **nega**. Condição que não depende de documento vem
primeiro.

### Antes de publicar

* **Regras e código sobem juntos.** O workflow que o Firebase CLI gera publica **só o Hosting** —
  as Rules são um comando manual, e vêm **primeiro**, porque a regra nova é mais permissiva e o
  código antigo sobrevive à janela entre os dois deploys.
* **Confira lendo do servidor**, não pelo navegador.
* Rode a bateria de Rules com identidade simulada, inclusive contra o que está **publicado**.

---

## 12. Como usar este documento como prompt

Cole o texto acima e acrescente algo assim:

> Siga estritamente o padrão acima. Vou construir `<APP>`, que serve para `<propósito>`.
> As telas são: `<lista>`. Os dados que cada usuário guarda são: `<descrição>`.
> Use o esqueleto em `template/` como ponto de partida: não recrie o gate de login, a
> portaria, a navegação, os sheets, o tema, o service worker **nem as três telas de
> privacidade** — eles já estão prontos e testados. Escreva apenas a seção 1 (domínio) e as
> telas.
> Antes de escrever qualquer código, confirme comigo o modelo de dados e as telas — e monte o
> **inventário de dados** da seção 11, porque é dele que sai o texto do aviso.

