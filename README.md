# Meu Bandejão

App web para controlar o gasto com comida no trabalho e prever o desconto que vai cair no
contracheque. Uso pessoal. **Não é uma aplicação oficial da FGV.**

**No ar:** https://meu-bandejao.web.app

```
Sapore        a FGV subsidia até R$ 35,00 POR DIA — duas refeições no mesmo dia
              dividem um teto só. Geladeira e sobremesa elaborada não entram.
Participação  0,15% do salário base por dia com consumo na Sapore
Rei do Mate   valor integral, descontado no contracheque, sem subsídio
Outro         bar, padaria, restaurante da rua: 0% de subsídio e fora da folha
```

Regra do DRH para a Sede Botafogo, tabela 2026/2027. O app **não pede o seu salário**: o valor da
participação em reais é opcional, informado no Perfil. Sem ele, o desconto mostrado é uma
estimativa por baixo e a tela diz isso.

## Como é feito

Site estático de três arquivos, sem framework e sem passo de build, seguindo o padrão do
`scratch/kit-app/PADRAO.md`. O que está publicado é literalmente o que o navegador baixa.

```
public/
  index.html     todas as telas
  app.js         a aplicação inteira, em seções numeradas
  styles.css     o design system, todo por token
  sw.js          service worker (offline + instalação)
  manifest.json
  icon-*-v2.*    ícones — o sufixo é versionado de propósito (ver abaixo)
firestore.rules  TODA a segurança mora aqui
firebase.json    hosting, rewrites e cabeçalhos de cache
docs/            PRD, especificação, decisões e o handoff do design
```

* **Vanilla ES6 + Firebase** (Auth Google, Firestore, Hosting). Sem servidor Node.
* **Chart.js** e **Tesseract.js** por CDN, carregados só quando precisam.
* **Mobile-first**, 320–430px, tema escuro único.

## Rodar na sua máquina

Precisa de um servidor HTTP: `file://` não permite módulos ES6 nem service worker.

```bash
cd public && python3 -m http.server 8080
```

Para desenvolver **sem** tocar no Firebase de verdade, copie `public/` e troque a `apiKey` por
algo que comece com `COLE_`. A flag `CONFIGURADO` cai para falso e o app entra em **modo local**:
login sem Google, tudo no `localStorage`. É assim que se testa o app inteiro.

## Publicar

Automático em push no `main`, pelo `.github/workflows/deploy.yml`. Exige o segredo
`FIREBASE_SERVICE_ACCOUNT` no repositório; sem ele o workflow termina em verde com um aviso, em
vez de falhar.

Manual:

```bash
firebase deploy --only firestore:rules,hosting --project meu-vale
```

**Rules e hosting no mesmo deploy.** Publicar uma sem a outra é o que produz o sintoma
"sumiu tudo".

### As duas versões que sobem juntas, sempre

```
index.html   ...css?v=N  e  ...js?v=N     →  N+1
sw.js        VERSAO = "app-vN"            →  N+1
```

Esquecer a primeira entrega asset velho; esquecer a segunda entrega app velho. O workflow falha o
deploy se os assets mudaram e uma das duas não subiu — mas confira antes, é mais rápido.

### Trocar o ícone

O Android indexa o ícone do app instalado **pela URL**. Substituir o conteúdo de `icon-192-v2.png`
não repinta o atalho de ninguém. Suba o sufixo do nome (`-v3`) em quatro lugares: os arquivos em
`public/`, o `manifest.json`, as tags `<link>` do `index.html` e o `CASCO` do `sw.js`.

O gerador não depende de nada: `node docs/ferramentas/gera-icone.js` a partir da raiz.

## Antes de mexer, leia

| Arquivo | Para quê |
|---|---|
| `docs/Especificacao.md` | o que o app faz hoje, campo por campo |
| `docs/Decisoes_de_Projeto.md` | **por quê** — inclusive o que foi tentado e abandonado |
| `docs/PRD.md` | o problema e a hierarquia da informação |
| `docs/design/README.md` | o handoff de design; é a referência visual |
| `docs/design/DIVERGENCIAS.md` | onde o app se afasta do handoff, e por quê |
| `scratch/kit-app/PADRAO.md` | as regras de arquitetura que não se negociam |
| `scratch/kit-app/LICOES_APRENDIDAS.md` | os erros que já custaram caro |

Três coisas que economizam horas:

1. **O design manda.** Se o HTML usa `.is-open` e o seu script espera `.on`, conserte o script.
   Foi o contrário disso — dois sistemas de UI no mesmo DOM — que produziu uma versão em que
   nada funcionava.
2. **As Rules e o código andam juntos.** Uma coleção com nome diferente nos dois lados não dá
   erro na tela: dá `PERMISSION_DENIED` silencioso, e o sintoma chega como "não salva".
3. **Rode o app.** Suba uma cópia em modo local e clique. Inspeção estática não pega botão que
   não responde.

## Primeiro administrador

Quem está na lista `DONOS` (em `app.js` e em `donos()` no `firestore.rules`) entra já aprovado e
admin. Para promover alguém de fora da lista, no console do Firebase: `users/{uid}`, campo
**texto** `papel` = `admin`.
