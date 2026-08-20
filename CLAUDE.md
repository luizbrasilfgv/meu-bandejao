# Meu Bandejão — contexto para o assistente

App web pessoal de controle do gasto com comida no trabalho, com previsão do desconto em folha.
No ar em **https://meu-bandejao.web.app**. Leia `README.md` para a visão geral e
`docs/Especificacao.md` para o que o app faz hoje.

## Arquitetura: o que não se negocia

Vem de `scratch/kit-app/PADRAO.md`, e vale como regra:

* **Vanilla ES6. Sem framework, sem bundler, sem passo de build.** O que está em `public/` é
  literalmente o que o navegador baixa. Dependência de desenvolvimento é permitida; de produção,
  não. Chart.js e Tesseract.js vêm por CDN, carregados só quando precisam.
* **Sem servidor Node.** Firebase é a plataforma inteira: Auth (Google), Firestore, Hosting.
* **Um arquivo por responsabilidade.** Não quebre o `app.js` em módulos: sem bundler, cada
  `import` é um round-trip. Ele é linear, em seções numeradas — mantenha a numeração.
* **Estado global explícito + funções `pintarX()`.** Não existe reatividade. Mudou estado, chame
  `pintar()`.
* **Um `addEventListener` no `document`**, interação por atributo `data-*`. Botão novo = `data-`
  novo, nunca um listener novo.
* **A seção 1 do `app.js` (domínio) não toca no DOM.** É o único pedaço testável sem navegador.
* **Mobile-first**, 320–430px, tema escuro único. Nenhuma cor literal nova fora dos tokens.

## As armadilhas deste projeto

Cada uma destas já quebrou o app aqui. Estão detalhadas em
`scratch/kit-app/LICOES_APRENDIDAS.md` e em `scratch/kit-app/ADAPTAR-EXISTENTE.md`.

1. **O design manda.** `docs/design/` é o handoff do Claude Design. Se o HTML usa `.is-open` e o
   script espera `.on`, conserte o **script**. A versão em que "nada funcionava" era exatamente
   isto: dois sistemas de UI no mesmo DOM, um deles apontando para elementos inexistentes. As
   divergências deliberadas estão em `docs/design/DIVERGENCIAS.md` — se você criar outra,
   registre lá.
2. **Rules e código andam juntos.** Coleção com nome diferente nos dois lados não dá erro de
   tela: dá `PERMISSION_DENIED` silencioso, e o sintoma chega como "não salva". Mexeu em
   `COL_LANC`/`COL_POL`, mexa no `firestore.rules` no mesmo commit, e publique os dois juntos.
3. **Nunca calcule parcela por subtração.** `subsidio = bruto − desconto` passou a atribuir à FGV
   um dinheiro que ela não pagou no dia em que entrou gasto fora da instituição. Some cada
   parcela pela sua regra e, ao mexer no cálculo, confira no navegador a identidade
   `bruto = desconto + subsídio + fora`. Não existe suíte automatizada neste projeto: a
   verificação é rodar o app (abaixo).
4. **Versione as duas coisas ao publicar:** `?v=N` dos assets no `index.html` **e** `VERSAO` no
   `sw.js`. O workflow do Actions falha o deploy se os assets mudaram e um dos dois ficou para
   trás.
5. **Ícone é indexado pela URL.** Trocar a arte exige subir o sufixo do **nome do arquivo**
   (`icon-192-v3.png`) em quatro lugares: `public/`, `manifest.json`, tags `<link>` e `CASCO` do
   `sw.js`. Gerador: `node docs/ferramentas/gera-icone.js`.
6. **Texto de redação fixa.** O aviso dos 0,15% ("Este valor é uma estimativa...") é literal, não
   reescreva. E ele fica **junto do desconto em folha** — se você reordenar o card herói, mova o
   aviso também, senão a frase passa a apontar para outro número.

## Verificação: rode o app

Inspeção estática não pega botão que não responde. Antes de dizer que está pronto:

```bash
# cópia em modo local: sem Google, tudo no localStorage
cp -r public /tmp/teste && sed -i 's/apiKey: "AIzaSy[^"]*"/apiKey: "COLE_AQUI"/' /tmp/teste/app.js
cd /tmp/teste && python3 -m http.server 8123
```

Com `CONFIGURADO` falso o app entra em modo local e dá para exercitar tudo: lançar, editar,
excluir, filtrar, trocar período, ver gráficos. O mínimo a conferir: as cinco abas sem erro no
console, lançar e recarregar (o dado tem que voltar), e a identidade da soma.

Nunca publique com `CONFIGURADO` falso.

## Publicar

Automático em push no `main` (`.github/workflows/deploy.yml`, exige o segredo
`FIREBASE_SERVICE_ACCOUNT`). Manual:

```bash
firebase deploy --only firestore:rules,hosting --project meu-vale
```

Depois, confira lendo **do servidor** (`curl`), não pelo navegador — cache local mente.

## Limites do ambiente

* O Project ID do Firebase é **`meu-vale`** e é imutável, apesar do app se chamar meu-bandejao.
  O site `meu-vale` do Hosting está desativado; publica-se só em `meu-bandejao`.
* `firebase-tools` v15 **removeu** o `login:print-access-token`, e não há `gcloud` na máquina.
  Ou seja: dá para publicar (Hosting e Rules), mas **não** dá para escrever no Firestore nem
  mexer no Authentication por linha de comando. Precisa disso? É passo manual do usuário no
  console — ou resolva no código, como foi feito com a lista `DONOS`.
* `gh` não está instalado. Para PR: `git push` e entregue o link de "compare" do GitHub.
* O git deste repositório precisa de `user.name`/`user.email` configurados localmente; sem isso
  `git commit` falha.

## Preferências de trabalho

* Entregue o ciclo completo: commit, push, PR e deploy. Não pare em "código no disco".
* Português do Brasil em tudo: interface, comentários e mensagens de commit.
* Comentário de código explica **por quê**, não o que a linha faz.
