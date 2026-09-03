# Kit de aplicativo — web vanilla + Firebase + PWA

Um padrão e um esqueleto funcionando, para criar apps novos ou trazer apps existentes para
o mesmo formato.

```
kit-app/
├── PADRAO.md               ← o documento de arquitetura (serve de prompt)
├── PRIVACIDADE-LGPD.md     ← aviso, aceite e pedido de saída: o padrão completo
├── ADAPTAR-EXISTENTE.md    ← como trazer um app que já existe
├── LICOES_APRENDIDAS.md    ← o caderno de erros: UI, CSS, número na tela, OCR de cupom
├── README.md               ← este arquivo: como usar o esqueleto
└── template/               ← o esqueleto, rodando de verdade
```

O `template/` não é pseudocódigo. É um app que abre, faz login, tem portaria de aprovação,
aviso de privacidade, aceite registrado, pedido de saída com fila para o administrador, duas
telas mais Perfil, busca, janela de baixo, dois temas, painel de administrador com ação em
lote, e funciona offline. Ele só não sabe **o que** o seu app faz.

> **Duas regras do padrão que valem repetir aqui**, porque são as que mais se esquece ao
> começar um app: o login é **só pelo Google** — sem senha própria, nunca — e as três telas de
> privacidade **não são opcionais**. Detalhe na seção 2 e na 11 do `PADRAO.md`.

---

## O que já vem pronto

| Já funciona | Você não precisa escrever |
|---|---|
| Login com Google + persistência de sessão | `iniciar()`, `onAuthStateChanged` |
| Portaria: pendente → aprovado → nega | tela de espera, criação de `users/{uid}` |
| Papéis e painel de administrador | listar, aprovar, negar, ação em lote |
| Sinalização de pedido novo em tempo real | `sinalizar()`, `vigiarPedidos()` |
| Navegação por abas + sub-tela com voltar | delegação de `[data-scr]` |
| Janela de baixo (detalhe e opções) | `abrirSheet`, `abrirOpcoes`, `fecharSheet` |
| Toast | `aviso()` |
| Dois temas com botão no cabeçalho | `aplicarTema()` e os tokens do CSS |
| Gravação com atraso + fallback local | `agendarSalvar()` |
| Sincronização em tempo real entre aparelhos | `onSnapshot` com guard de eco |
| Instalável e offline | `manifest.json`, `sw.js`, registro no `<head>` |
| Rules com o modelo "não pode se promover" | `firestore.rules` |
| Aviso de privacidade na tela de entrada | o cartão do gate e o expansível |
| Aceite bloqueante no 1º acesso, com versão | `mostrarLgpd()`, `registrarCiencia()` |
| Pedido de saída + fila para o administrador | `pedirExclusao()`, `listarExclusoes()` |
| Rules do consentimento e da trilha imutável | `firestore.rules` |
| Deploy com dois cliques | `PUBLICAR.bat` |

**Você escreve**: a seção 1 do `app.js` (a lógica do seu domínio, sem DOM) e as funções
`pintarX()` que desenham as telas.

**E você adapta um texto**: o do aviso de privacidade. Ele vem preenchido com o que o esqueleto
guarda, e o seu app guarda outra coisa — trocar aquele texto é obrigatório, não cosmético. Ver o
passo 5b.

---

## Criar um app novo, em oito passos

**1 · Copie a pasta.** `cp -r template meu-app && cd meu-app`

**2 · Rode antes de configurar nada.**

```bash
cd public && python3 -m http.server 8080
```

Abra `http://localhost:8080`. Com o `firebaseConfig` ainda em `COLE_AQUI`, o app entra em
**modo local**: login sem Google, tudo salvo no aparelho. Dá para construir o app inteiro
assim e só ligar a nuvem no fim.

> Precisa de servidor. `file://` não permite módulos ES6 nem service worker.

**3 · Crie o projeto no Firebase.** Ative Authentication com provedor Google — **só o Google**,
não habilite Email/Password — e crie o Firestore. Copie o `firebaseConfig` do app Web para o topo
do `app.js`, renomeie `.firebaserc.exemplo` para `.firebaserc` e ponha o id do projeto.

> Habilitar um segundo provedor abre **auto-cadastro** no projeto e traz e-mail **não
> verificado** — e aí a regra que identifica o dono pelo e-mail pode ser enganada por quem se
> cadastrar com o e-mail dele. Se um dia for inevitável, leia a ARM-08 do `PRIVACIDADE-LGPD.md`
> antes.

**4 · Ajuste as constantes** no topo do `app.js`: `NS` (prefixo do localStorage — troque,
senão dois apps seus no mesmo domínio brigam) e `COLECAO` (nome da sua coleção de dados).
Se mudar `COLECAO`, mude também o `match /dados/{uid}` nas Rules.

**5 · Escreva o app.** Seção 1 do `app.js` para a lógica, `pintarX()` para as telas, e o
HTML das telas no `index.html`. Renomeie as abas na `<nav>` e no mapa de `ctxLabel`.

**5b · Troque o texto do aviso de privacidade.** Isto é obrigatório. O esqueleto vem com um
texto que descreve **o que o esqueleto guarda**; o seu app guarda outra coisa, e aí o texto passa
a ser mentira. A ordem é sempre esta:

1. Levante o **inventário**: uma linha por lugar onde dado pessoal encosta, com os campos. Se o
   app já tem dado, o jeito confiável é ler os **nomes dos campos** de um backup do Firestore.
2. Marque o que é **sensível** (saúde, biometria, origem, religião, política, sindicato, vida
   sexual — LGPD art. 5º, II) e o que é dado de **criança ou adolescente** (art. 14, pede aviso
   próprio no ponto do cadastro).
3. Marque o que o app **não pede** — essa lista é a que tranquiliza quem lê.
4. Só então escreva. Os textos base estão no anexo B do `PRIVACIDADE-LGPD.md`.

Onde mexer: o cartão `#avisoEntrada` no gate, as quatro declarações do `#gateLgpd`, e os tópicos
da tela de exclusão. Se o texto do aceite mudar depois de o app estar no ar, **suba o
`LGPD_VERSAO`** — senão quem já aceitou não vê o texto novo.

**6 · Marca visual.** No `styles.css`, troque `--acento` e `--acento-2` nos dois temas.
Regenere os ícones a partir do `icon.svg` — o Chrome no Android precisa dos PNG de 192 e 512.
No `index.html` e no `manifest.json`, troque nome e `theme-color`.

**7 · Publique.** `firebase deploy`, ou dois cliques no `PUBLICAR.bat`.

**8 · Promova o primeiro administrador.** Ovo e galinha: quem entra fica `pendente` e só um
admin aprova. Abra o console do Firebase, ache `users/{seu-uid}` e acrescente um campo de
texto `papel` com o valor `admin`. String, não array — o editor de array do console erra.

---

## A disciplina de publicar

Duas versões sobem juntas, sempre:

```
index.html   ...css?v=1  →  ?v=2      (todos os assets)
sw.js        VERSAO = "app-v1" → "app-v2"
```

Esquecer a primeira entrega asset velho. Esquecer a segunda entrega app velho. Não há nada
que avise, e o sintoma é cruel: funciona no seu aparelho, que tem cache limpo, e as outras
pessoas continuam três dias atrás.

Antes de publicar, confira também que `CONFIGURADO` não ficou em `false`.

---

## Se o service worker der problema

Ele consegue prender as pessoas numa versão velha, e não há como alcançá-las. Substitua todo
o conteúdo do `sw.js` pelo do `sw-desligar.js` e publique: no próximo acesso cada pessoa se
limpa sozinha.

---

## Escrita offline (opcional, mas importante)

Por padrão o app **abre** sem internet, mas a escrita no Firestore não tem fila: se alguém
alterar algo sem sinal, perde. Se o seu app for usado em lugar de sinal ruim, ligue o cache
persistente do SDK. Troque a criação do Firestore no `app.js`:

```js
const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager }
  = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
```

no lugar de `db = getFirestore(app)`. Teste com a rede cortada e com duas abas abertas.

---

## Testar

Sem framework no app, mas com teste de verdade: Playwright contra uma cópia do `public/` com
`CONFIGURADO = false`, servida por um HTTP local, em viewport de 390×900. Isso não fere a
regra do "sem build" — é dependência de desenvolvimento.

O mínimo a cobrir em qualquer app deste padrão: abre e navega por todas as abas sem erro de
JavaScript; funciona para usuário comum, sem os painéis de admin; os dois temas em todas as
telas; e o modo offline com a rede cortada.

---

## Perguntas que vão aparecer

**O `firebaseConfig` fica exposto no código. Isso é seguro?** É. Ele identifica o projeto,
não autoriza nada. Quem proíbe é o `firestore.rules`. Não gaste esforço tentando escondê-lo —
gaste nas Rules.

**Posso usar TypeScript / React / um bundler?** Aí você saiu do padrão. Ele existe para que o
que está publicado seja exatamente o que você lê, sem intermediário.

**Posso quebrar o `app.js` em vários módulos?** Sem bundler, cada `import` é um round-trip de
rede. Até ~2.000 linhas, mantenha um arquivo com seções bem marcadas. Depois disso, separe
por domínio, não por tipo.

**Como faço o app ir para a tela inicial do celular?** No iPhone, Compartilhar → Adicionar à
Tela de Início. No Android, o Chrome oferece "Instalar" sozinho, desde que os PNG de 192 e
512 estejam declarados no manifest. Explicado no item 8 do `PADRAO.md`.

