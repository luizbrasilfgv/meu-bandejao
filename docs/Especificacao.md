# Especificação Funcional e Técnica — Meu Bandejão

> Este documento descreve o que o app **faz hoje**. Quando divergir do código, o código é
> quem manda — e o documento é bug. A referência visual é `docs/design/README.md`.

## 1. Autenticação e acesso

* **Login único:** Google OAuth, com `browserLocalPersistence`. Enquanto não há usuário, o app
  inteiro fica atrás do gate de login.
* **Portaria:** todo acesso novo entra com `status: "pendente"` e `roles: ["member"]`, vê a tela
  de espera e **não grava nada**. Um administrador libera pelo painel de acessos (Perfil →
  Gerenciar acessos), com busca, abas por situação e ação em lote.
* **Ninguém se promove:** as Firestore Rules impedem que o cliente altere `roles`, `status` ou
  `papel` do próprio documento. O primeiro administrador é promovido à mão no console do
  Firebase, com um campo **texto** `papel` = `admin` em `users/{uid}`.
* **Salário não entra no app.** Não há campo, não há criptografia, não há PIN e não há
  reautenticação — porque não existe dado sensível a proteger. Foi a forma de resolver a
  privacidade: em vez de guardar o salário com cuidado, não guardar.

## 2. Gestão de lançamentos (CRUD)

* **Captura e OCR em memória:** o lançamento entra por foto do cupom (câmera ou galeria). O
  Tesseract.js processa a imagem **no navegador**, o resultado vai para uma tela de revisão
  humana e a imagem é descartada com `revokeObjectURL` — nenhuma foto é enviada ou armazenada.
* **Campos extraídos do cupom:** valor total, data e hora, lanchonete, itens, matrícula, CNPJ e
  número do cupom. Confiança abaixo de 75% (ou valor não encontrado) marca o campo de data com
  `CONFIRA` e avisa que a leitura é fraca.
* **Lançamento manual:** alternativa completa, para cupom ilegível. Mesmos campos.
* **Edição:** toque na linha da transação abre o mesmo modal em modo de edição.
* **Exclusão:** exige confirmação obrigatória numa janela de baixo, com o lançamento descrito.
* **Estabelecimentos:** Sapore e Rei do Mate. Categorias: almoço, jantar, café/lanche e outro.

## 3. Regra de negócio do desconto

Confirmada com o usuário e implementada em funções puras (`descontoDe`, `resumo`):

```
consumo bruto  = soma de tudo que foi registrado no período
desconto folha = Σ Sapore max(0, valor − teto vigente) + Σ Rei do Mate valor integral
subsídio FGV   = consumo bruto − desconto folha
```

* **Sapore:** a FGV subsidia até o teto por refeição; o colaborador é descontado no excedente.
* **Rei do Mate:** pago integralmente pelo colaborador.
* **Teto e taxa são política, não constante.** Ficam em `politicas/vigentes`, com **data de
  vigência**: o administrador cadastra a nova regra e os lançamentos antigos continuam
  calculados pela regra que valia na data deles. O padrão, quando não há nada cadastrado, é
  teto de R$ 31,59 e taxa de 0,15%.
* **A taxa de 0,15% do salário base por ida fica registrada e FORA da conta**, porque aplicá-la
  exigiria o salário. Por isso todo valor exibido é uma estimativa por baixo, com este aviso de
  redação fixa (não reescrever):

  > Este valor é uma estimativa e não inclui o desconto fixo de 0,15% do seu salário base por refeição, omitido por privacidade

## 4. Conciliação

* **Conciliação visual.** Não há importação de arquivo do Apdata nem upload de holerite: nenhum
  documento sigiloso transita no app.
* **Por quinzena, não por mês.** As lanchonetes enviam o consumo por quinzena (01–15 e 16 ao
  último dia) e a folha soma a quinzena anterior com a atual. A tela Conciliar mostra as três
  últimas quinzenas com o valor do app; a coluna da folha está pendente.
* **Falta decidir:** de onde vem o valor da folha, o nível da comparação (total ou item a item)
  e o que fazer com a divergência.

## 5. Estatísticas e relatórios

* **Período:** mês civil por padrão, com mês anterior e intervalo livre. Todo número da tela
  respeita o período selecionado.
* **Métricas:** total por lanchonete com percentual, gasto projetado no ritmo atual, maior dia,
  média por dia com consumo e ritmo do período em dias úteis (sem base de feriados — é
  aproximação declarada).
* **Gráficos (Chart.js):** barra empilhada por dia ou por mês, separando desconto e subsídio; e
  rosca da divisão por lanchonete.
* **Exportação:** CSV do período filtrado, com a memória de cálculo em cada linha (valor, teto
  vigente na data, desconto e subsídio).

## 6. Dados

```
users/{uid}          → { nome, email, foto, roles[], status, criadoEm, prefs }
lancamentos/{uid}    → { itens: [ ...lançamentos... ], atualizadoEm }
politicas/vigentes   → { lista: [ { id, vigencia, teto, taxaPct } ], atualizadoEm }
```

Leitura com `onSnapshot` (sincroniza entre aparelhos, com guard contra o eco da própria
escrita) e escrita com atraso de 600 ms. Uma cópia fica no `localStorage` para o app abrir sem
internet e para não perder nada em modo local.

`prefs` guarda alerta de limite, lembrete de recibo, teto mensal e matrícula. O lembrete de
recibo registra a preferência mas **ainda não dispara notificação** — está declarado na tela.

## 7. Infraestrutura

* **PWA:** manifest com `display: standalone`, ícones PNG de 192 e 512 declarados e service
  worker registrado — o app instala na tela inicial e abre sem rede.
* **Backend:** Firebase Auth (Google), Firestore e Hosting do projeto `meu-vale`. Sem servidor
  Node, sem bundler, sem passo de build.
* **Publicação:** subir o `?v=N` dos assets no `index.html` **e** o `VERSAO` do `sw.js` a cada
  deploy. Esquecer um dos dois prende as pessoas numa versão antiga.

## 8. Aviso legal

O app exibe, no login e nas Dúvidas, que **não é uma aplicação oficial da FGV** e que a
instituição não responde pelos lançamentos nem pelos descontos em contracheque — a conferência
é do colaborador.
