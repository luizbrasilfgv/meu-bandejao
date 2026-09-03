# Meu Bandejão — contexto para o assistente

App web pessoal de controle do gasto com comida no trabalho, com previsão do desconto em folha.
No ar em **https://meu-bandejao.web.app**. Leia `README.md` para a visão geral e
`docs/Especificacao.md` para o que o app faz hoje.

**A regra do desconto mora em `docs/Regra_DRH_Sapore.md`** — é o documento único, com a
procedência de cada afirmação marcada ([DRH] = norma, [APP] = decisão de implementação,
[?] = não confirmado). Antes de mexer em qualquer cálculo de dinheiro, leia esse arquivo. Se você
descobrir algo novo sobre a regra, ele é o lugar de registrar — não o comentário do código.

`docs/Bot_DRH_Refeitorio.md` é a mesma regra em linguagem de colaborador, para o bot do DRH. Ele
tem outro dono e outro público: **mudou a regra, mude os dois**, e mantenha os blocos dele
autossuficientes, porque um bot recupera um trecho por vez.

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

Cada uma destas já custou caro aqui — a maioria quebrou o app, e uma travou a entrega. As de
código estão detalhadas em `scratch/kit-app/LICOES_APRENDIDAS.md` e em
`scratch/kit-app/ADAPTAR-EXISTENTE.md`.

1. **O design manda.** `docs/design/` é o handoff do Claude Design. Se o HTML usa `.is-open` e o
   script espera `.on`, conserte o **script**. A versão em que "nada funcionava" era exatamente
   isto: dois sistemas de UI no mesmo DOM, um deles apontando para elementos inexistentes. As
   divergências deliberadas estão em `docs/design/DIVERGENCIAS.md` — se você criar outra,
   registre lá.
2. **Rules e código andam juntos.** Coleção com nome diferente nos dois lados não dá erro de
   tela: dá `PERMISSION_DENIED` silencioso, e o sintoma chega como "não salva". Mexeu em
   `COL_LANC`/`COL_POL`, mexa no `firestore.rules` no mesmo commit, e publique os dois juntos.
3. **Nunca calcule parcela por subtração.** `subsidio = bruto − desconto` passou a atribuir à FGV
   um dinheiro que ela não pagou no dia em que entrou gasto fora da instituição. Some cada parcela
   pela sua regra e, ao mexer no cálculo, confira no navegador a identidade
   `bruto = subsídio + desconto + fora`, que fecha **sempre**, sem exceção. **O subsídio é
   LÍQUIDO:** a participação sai dele no rateio, porque subsídio da FGV é o que ela bancou de fato,
   não o que ela paga à Sapore e depois cobra de você. E a participação é **ATÉ 0,15%, não 0,15%
   cheio** — no dia de prato mais barato que ela, sai o valor do prato. Se a soma parar de fechar,
   provavelmente esse limite foi removido de `calcularRateio`.
   Não existe suíte automatizada neste projeto: a verificação é rodar o app (abaixo).
4. **Versione as duas coisas ao publicar:** `?v=N` dos assets no `index.html` **e** `VERSAO` no
   `sw.js`. O workflow do Actions falha o deploy se os assets mudaram e um dos dois ficou para
   trás.
5. **Ícone é indexado pela URL.** Trocar a arte exige subir o sufixo do **nome do arquivo**
   (`icon-192-v3.png`) em quatro lugares: `public/`, `manifest.json`, tags `<link>` e `CASCO` do
   `sw.js`. Gerador: `node docs/ferramentas/gera-icone.js`.
6. **Texto de redação fixa.** O aviso dos 0,15% ("Este valor é uma estimativa...") é literal, não
   reescreva. E ele fica **junto do desconto em folha** — se você reordenar o card herói, mova o
   aviso também, senão a frase passa a apontar para outro número. Quando a participação está
   informada ele é **escondido**, não reescrito: o texto afirma que os 0,15% estão fora da conta e
   ali eles estão dentro.
7. **O teto do subsídio é do DIA, não do lançamento.** R$ 35,00 por dia na Sapore: duas refeições
   no mesmo dia dividem um teto só. Por isso `descontoDe(l)` não é função só de `l` — depende do
   dia inteiro, via `calcularRateio`, que distribui o teto em ordem cronológica e é memoizado num
   cache invalidado **num ponto único**, no topo de `pintar()`. Se você precisar invalidar em outro
   lugar, pare e repense: cache de dinheiro com invalidação espalhada erra na tela sem erro no
   console. E o rateio é sempre sobre a lista inteira, nunca sobre a filtrada, senão o mesmo
   lançamento mostra subsídios diferentes em telas diferentes.
8. **Nem todo item do cupom tem subsídio, e na dúvida NÃO tem.** Entra o que vem do balcão das
   comidas: prato, suco de máquina, fruta, gelatina e sobremesa — **elaborada inclusive**, desde
   agosto de 2026. Bebida de geladeira, sorvete e o que não é do balcão vão integrais para a folha,
   inclusive o que o leitor não reconheceu. O padrão restritivo é deliberado: o app **prevê**
   desconto, e prever desconto maior do que vem é susto que não acontece, enquanto prever menor é
   susto no contracheque. Está em `COM_SUBSIDIO` / `SEM_SUBSIDIO` / `temSubsidio()`, com a ordem da
   decisão comentada. O valor final é do campo `valorSemSubsidio` do lançamento: o leitor **sugere
   e avisa**, a pessoa confirma. Dois cupons de mesmo total e composição diferente dão descontos
   diferentes, e decidir sozinho erraria dinheiro em silêncio.
9. **`git fetch` antes de ramificar.** A pasta local pode estar muito atrás do GitHub: em
   03/09/2026 estava **28 commits** atrás, e o `git log` parecia coerente — só olhando o histórico
   local não dá para desconfiar. Ramificar de um `main` velho **garante** conflito, porque todo
   commit publicável sobe os dois selos de versão (armadilha 4), e o `main` de verdade já subiu os
   dele. Rotina: `git fetch origin` e ramifique de `origin/main`. Se o conflito já aconteceu,
   `git merge origin/main` na branch (não `rebase`, não `--force`), resolva os selos para o maior
   número **+ 1** nos dois arquivos juntos, e **rode o app de novo** — o `app.js` do `main` pode ter
   mudado muito debaixo do seu código. Depois, `git branch -f main origin/main`, para o clone não
   repetir amanhã.
10. **`prefs` sincroniza; `privado` não.** `prefs` vai para `users/{uid}.prefs` no Firestore, e a
   regra é `allow get: if eu(uid) || ehAdmin()` — o administrador lê. **O salário mora em
   `privado`**, um objeto separado que só existe no `localStorage`, gravado por `gravarPrivado()`,
   que de propósito **não chama `salvarPerfil`**. Nunca ponha dado sensível em `prefs`, e nunca
   acrescente chamada de rede em `gravarPrivado()`. Já vazou uma vez: a participação em reais
   ficou em `prefs`, e `participação ÷ 0,15%` devolve o salário. Regra de Firestore não protege de
   quem abre o console do projeto — a única garantia é o dado não estar lá.

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
