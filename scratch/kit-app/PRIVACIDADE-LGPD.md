# Especificação LGPD para aplicativos próprios — padrão reutilizável

**Versão 2.0 · 2026-09-02** · Serve para **auditar** um app existente e para **implementar** num app
novo.

Nasceu no **Que Viagem é essa** (o aviso bloqueante, o consentimento e o botão de exclusão foram
escritos ali primeiro), amadureceu no **Meu Peso** e virou este documento ao ser aplicada, no mesmo
dia, ao **Controle Integrantes Blocos**. A v2.0 é o que essa terceira aplicação ensinou — e ela
ensinou muito, porque a triagem achou defeitos reais nos três.

O que está aqui é engenharia, não parecer jurídico: são requisitos testáveis e as armadilhas que
custaram retrabalho de verdade. Onde a LGPD é citada, é para justificar um prazo ou um campo.

> **Fora do escopo de propósito:** entrada por senha compartilhada (usuário e senha únicos para um
> grupo). Aquilo foi decisão pontual de um app, com o custo declarado no PRD dele — não é boa
> prática e não entra neste padrão.

---

## Como usar em 10 minutos, num app que já existe

Responda estas seis perguntas. Cada "não" aponta a seção que resolve.

| # | Pergunta | Se "não" |
|---|---|---|
| 1 | Existe uma lista escrita do que o app guarda de cada pessoa, campo por campo? | §2 |
| 2 | Antes de tocar no botão de login, a pessoa lê o que vai ser guardado e o que **não** é pedido? | §3 |
| 3 | Existe registro de que a pessoa foi avisada — com data do servidor e **versão do texto**? | §4 |
| 4 | A pessoa consegue pedir a remoção dos dados **pelo app**, sem depender de mensagem privada? | §5 |
| 5 | O pedido de remoção **aparece para quem decide**, com prazo definido? | §5 |
| 6 | Cada frase do aviso é **verdade** hoje, conferida contra o código? | §1 |

A pergunta 6 é a que mais falha, e é a mais barata de corrigir.

### O que a triagem achou de verdade, em três apps, num dia

Não são hipóteses. Se você aplicar esta lista num app seu, espere achar algo parecido.

| App | O defeito | Quanto tempo esteve lá |
|---|---|---|
| Gestão de bloco | O botão **"Excluir minha conta" nunca funcionou** para 23 dos 26 integrantes. O campo não estava na lista de permissões, a gravação era recusada e o app mostrava "Erro ao solicitar exclusão. Tente novamente." | desde que o botão foi escrito |
| App de viagens | O admin podia **reescrever o e-mail de um pedido** de exclusão — apagar a identidade sem apagar o documento. Com `delete: false`, dava aparência de trilha sem a substância | desde a criação da coleção |
| Disputa de peso | Uma preferência do usuário (`matiz`) **nunca persistia** para quem não era admin. Recusada em silêncio | semanas |

**Os três são a mesma cegueira.** A regra é `if isAdmin() || (o caminho de quem não é admin)`, e
quem testa é admin — passa pelo primeiro ramo e **nunca avalia o segundo**. É a ARM-02, e ela é a
razão de existir o Anexo A.7.

---

## §0 · Antes de começar (dois passos que não se pulam)

**Passo 1 — O repositório local tem de estar em dia.** Num dos três apps a pasta local estava **21
commits atrás** do remoto, com trabalho real no meio (telas novas, correções de regra). Editar ali
seria escrever em cima de código velho, e o commit viraria conflito ou atropelaria aquilo.

```bash
git status -sb        # "behind N" = pare e atualize antes de tocar em qualquer arquivo
git stash && git pull --ff-only
```

`--ff-only` de propósito: se não der avanço rápido, é porque há divergência de verdade, e aí a
decisão é sua, não do git. E confira o que o stash guardou antes de aplicar de volta: naquele app
ele continha a versão **anterior** das regras, que o pull já tinha corrigido.

**Passo 2 — Backup dos dados antes da primeira edição.** Não do código: dos **dados**. Ver o Anexo
A.8 para fazer isso sem servidor, com a sessão do `firebase` CLI, em leitura pura.

O inventário do §2 sai desse backup — lendo **os nomes dos campos**, nunca os valores. É a forma
mais precisa de saber o que o app guarda, porque é o que ele guarda de fato, não o que o código
sugere.

---

## §1 · O princípio, do qual todo o resto decorre

**RN-LGPD-00 — O texto só promete o que o código faz.**
Promessa que não bate com o fluxo é pior do que promessa nenhuma: cria confiança falsa e, no dia em
que alguém confere, destrói a confiança verdadeira junto.

Três exemplos reais de frases que **pareciam** boas e eram falsas:

| Frase | Por que era falsa |
|---|---|
| *"Não guardamos nenhum dado seu"* | o app gravava nome, e-mail, foto e o conteúdo do usuário. O que não passava pelo app era a **senha** |
| *"Tem um botão que apaga tudo, sem burocracia"* | o botão abria um **pedido** que uma pessoa processava à mão |
| *"Só quem o administrador aprova vê os dados"* | havia uma segunda porta de entrada que não passava por aprovação |

**Como aplicar:** escreva o inventário (§2) **antes** do texto. O texto é uma leitura do inventário,
nunca o contrário. E quando o fluxo mudar, **as frases mudam no mesmo commit** — não depois.

---

## §2 · Inventário de dados (pré-requisito de tudo)

**RF-LGPD-01 — Tabela de inventário no documento do projeto**, com uma linha por lugar onde dado
pessoal encosta:

| Onde | Quais campos | Origem | Quem lê | Quando sai |
|---|---|---|---|---|
| `<coleção>/{id}` | … | login / digitado / calculado | … | … |
| no aparelho | sessão, preferências | … | só a pessoa | ao sair |
| serviço de terceiro | … | … | … | … |

**RF-LGPD-02 — Marque o que é dado sensível.** Saúde, biometria, origem racial, convicção religiosa,
opinião política, filiação sindical, vida sexual (LGPD art. 5º, II). **Peso, altura e IMC são dado de
saúde** — quem tem isso no app não tem um app de listinha, tem um app de dado sensível, e o cuidado
muda de patamar.

**RF-LGPD-03 — Marque o que é dado de criança ou adolescente** (art. 14). Se o app guarda nome ou
data de nascimento de menor, mesmo cadastrado pelo responsável, isso pede aviso próprio no ponto do
cadastro — não basta o aviso geral da entrada.

**RF-LGPD-04 — Marque o que o app *não* pede.** Essa lista vale ouro no texto: é o que tranquiliza.
Exemplo: senha, CPF, documento, cartão, endereço, telefone.

---

## §3 · Aviso na tela de entrada (antes do login)

**RF-LGPD-10** — Na tela de login, **antes** de qualquer botão de autenticação, um aviso visível —
não um link para "termos".

**RF-LGPD-11 — Diga quem confere a identidade e onde a senha é digitada.** Se o login é OAuth
(Google, Apple, Microsoft), a senha é digitada na tela do provedor e o app **nunca a vê**. Isso
costuma ser a dúvida real de quem resiste a entrar — e uma frase resolve.

**RF-LGPD-12 — Diga o que chega do login.** Em OAuth costuma ser nome, e-mail e foto. Diga
exatamente esses três, não "alguns dados".

**RF-LGPD-13 — Um expansível com "o que fica salvo, exatamente"**, em três blocos:
- **no app:** os campos do inventário;
- **no seu aparelho:** sessão e preferências, e o que apaga (sair);
- **nunca:** a lista do RF-LGPD-04.

**RF-LGPD-14 — Se houver dado sensível, diga por que o acesso é fechado.** A frase que funciona é
causal: *"peso é dado de saúde; é por isso que sem conta aprovada ninguém de fora vê nada"*.

**RN-LGPD-15 — Precisão em vez de generalidade.** *"Este app não vê e não guarda **a sua** senha"* é
verdade e é forte. *"Não guardamos senha nenhuma"* pode ser mentira se o app tiver qualquer
autenticação própria.

### Como escrever (padrão validado)

Título curto e concreto, dois parágrafos, um expansível. **Não** use "termos de uso", "política de
privacidade" nem "coletamos dados para melhorar sua experiência". Ver o Anexo B.

### Dois casos que provam que o texto é sempre do app, nunca genérico

**Duas portas de entrada quebram a frase pronta.** Num app com Google **e** e-mail/senha próprios,
*"a senha fica com o Google"* é meia verdade — metade das pessoas digita senha ali mesmo. O texto
tratou as duas: *"Com o Google, a senha é digitada na tela dele e nem passa por aqui. Com e-mail e
senha, quem guarda cifrada é o Firebase — ela não fica no banco e não aparece para ninguém."*

**Um campo pode conter mais do que o nome diz.** Um app guardava `chave` numa subcoleção
`dados_sigilosos` — a **chave PIX**. Não havia campo `cpf` em lugar nenhum, e o app "não pedia CPF".
Mas no Brasil chave PIX **é, muitas vezes, o próprio CPF**. O aviso passou a dizer isso na cara:
*"se a sua chave PIX for o CPF, é o seu CPF que está guardado ali."*

A moral vale para qualquer app: olhe o que o campo **pode conter**, não só como ele se chama.
`observacoes`, `apelido` e `link` são os suspeitos de sempre.

---

## §4 · Aviso bloqueante no 1º acesso e consentimento auditável

**RF-LGPD-20 — Uma tela bloqueante, uma vez por pessoa**, depois de autenticada (e, se houver
aprovação manual, depois de aprovada) e **antes de qualquer tela com dado dentro**.

**RF-LGPD-21 — Quatro declarações, nessa ordem:**
1. **para que serve o login** — conferir identidade e liberar acesso;
2. **o que o app guarda** — os campos, com o sensível nomeado;
3. **o que o app não faz** — não vende, não compartilha, e quem vê;
4. **como sair** — onde está o botão e o prazo.

**RF-LGPD-22 — Duas saídas, sem terceira.** "Ciente, vamos lá" grava o registro; "Prefiro não
entrar" encerra a sessão e volta ao login. **Sem aceite não há acesso** — e não há "depois".

**RF-LGPD-23 — O registro é auditável**, com três campos e não um:

| Campo | Valor | Por que |
|---|---|---|
| `lgpdCiente` | `true` | só se grava como verdadeiro; não existe "des-consentir" por engano |
| `lgpdCienteEm` | **hora do servidor** | relógio de aparelho errado produziria data errada, e o registro não provaria nada |
| `lgpdVersao` | inteiro | **um booleano sozinho não prova qual texto a pessoa leu** |

**RF-LGPD-24 — Texto novo, versão nova.** Ao mudar o texto, sobe a versão; quem aceitou a antiga vê
o aviso novo uma vez. É uma constante única no código, comparada na entrada — nunca comparação de
string do texto.

**RF-LGPD-25 — O acesso só é liberado depois de a gravação confirmar.** Se ela falhar, a pessoa
continua na tela do aviso e **vê o motivo**. Entrar sem registro é o pior dos dois mundos: sem prova
e com acesso.

**RF-LGPD-26 — O aviso é consultável depois**, numa tela do perfil, mostrando **quando** e **qual
versão** a pessoa aceitou.

**RF-LGPD-27 — A versão dispensa derrubar sessão.** A checagem roda a cada abertura do app, lendo o
documento da pessoa: subir a versão faz o aviso reaparecer **sem** deslogar ninguém. Forçar
re-autenticação é outra coisa, e só se justifica quando você quer trocar de provedor ou invalidar
sessões antigas — não para mostrar um aviso. Se precisar mesmo, use uma marca no `localStorage` e
**troque o nome dela** a cada rodada: reaproveitar a marca antiga não desloga quem já a tem gravada.

**Um detalhe que aparece no primeiro deploy da versão:** quem já tinha aceito o texto antigo tem
`lgpdCiente: true` e **nenhum** `lgpdVersao`. `Number(undefined) !== 1` é verdadeiro, então essas
pessoas veem o aviso de novo. É o comportamento correto — o texto mudou — mas saiba disso antes de
alguém avisar que "voltou aquela tela".

---

## §5 · Remoção a pedido do titular

**RF-LGPD-30 — Botão no perfil**, alcançável sem suporte e sem mensagem privada.

**RN-LGPD-31 — Pedido ou apagamento imediato: decida e escreva na tela.** As duas são legítimas; o
que não é legítimo é o texto dizer uma e o código fazer a outra.

| | Pedido para o administrador | Apagamento imediato |
|---|---|---|
| Quando faz sentido | dado compartilhado, cascata manual, risco de toque acidental | dado isolado do titular, cascata automática viável |
| Exige | fila visível + prazo | transação/função que apaga tudo de uma vez |
| Texto tem de dizer | *"isto abre um pedido; o administrador executa em até N dias"* | *"isto apaga agora e não dá para desfazer"* |

**RF-LGPD-32 — Confirmação em dois passos, dentro da própria tela.** Nunca `confirm()` do sistema:
não cabe o que precisa ser dito, e não combina com o resto do app.

**RN-LGPD-33 — O pedido é imutável para o titular.** Ele cria o próprio pedido, obrigatoriamente com
status inicial e **carimbo do servidor**; nunca altera nem apaga. Listar e decidir é privilégio de
quem administra. **Apagar é proibido para todos, inclusive o administrador** — é a trilha que prova
que a pessoa pediu.

**RF-LGPD-34 — Fila visível para quem decide**, com contagem e sinalização de item novo. Sem essa
tela o pedido existe só no console do banco e fica parado sem ninguém saber.

*Como saber se a sua fila existe de verdade:* procure o nome da coleção no código. Num app ele
aparecia **uma vez** no JavaScript (a gravação) e **zero** vezes no HTML. A regra dava `list` ao
admin, o pedido era gravado corretamente — e nenhuma linha do app lia aquilo.

**RN-LGPD-34a — Quem decide só pode escrever o desfecho.** `allow update: if ehAdmin()` **não
basta**: sem lista branca de campos, o administrador reescreve `uid`, `email` e a data do pedido —
apaga a identidade sem apagar o documento. Com `delete: false` do lado, isso dá a **aparência** de
trilha sem a substância. A regra tem de restringir aos campos do desfecho e validar os valores:

```
allow update: if ehAdmin()
              && affectedKeys().hasOnly(['status','resolvidoEm','resolvidoPor'])
              && request.resource.data.status in ['atendida','recusada']
              && request.resource.data.resolvidoEm == request.time;
```

**RF-LGPD-35 — Prazo declarado, de uma constante única.** A LGPD (art. 18, §3º) fala em atendimento
imediato ou em até **15 dias**. O número aparece no aviso e na tela do pedido, e sai de um lugar só
no código — texto e combinado não podem divergir.

**RF-LGPD-36 — Diga o que acontece com o que sobra.** Se o app tem dado do titular misturado em
agregado (placar, histórico, totais do grupo), **anonimizar** costuma ser melhor que apagar: tira a
identificação e preserva o número que o grupo conhece. Escreva qual dos dois será feito.

**RF-LGPD-37 — Diga o que acontece se a pessoa voltar.** Em quase todo app com login social, entrar
de novo **recria** um cadastro novo, a partir do que o provedor manda naquele momento. Não é o dado
antigo voltando — mas, sem aviso, parece que a exclusão não funcionou.

**RF-LGPD-38 — Se o pedido pode ser recusado, diga o que fazer depois.** Como a trilha não pode ser
alterada, um pedido recusado normalmente não é reaberto pelo app: a tela precisa apontar o caminho
(falar com o administrador) em vez de simplesmente esconder o botão.

---

## §6 · As quatro decisões que cada app tem de tomar

Não há resposta universal. Decida **explicitamente** e registre no documento do projeto.

| # | Decisão | Recomendação |
|---|---|---|
| **D1** | Pedido ou apagamento imediato | **Pedido**, se a cascata é manual. Toque sem querer não pode ser irreversível |
| **D2** | Apagar ou anonimizar o que está em agregado | **Anonimizar** o agregado, **apagar** o cadastro |
| **D3** | Prazo de atendimento | **15 dias**, escrito na tela |
| **D4** | Dado de menor no app | Aviso específico **no ponto do cadastro**, não só na entrada |

---

## §7 · Critérios de aceite (a lista para conferir de fato)

Cada item é observável. Marque só o que você **viu acontecer**.

**Aviso de entrada**
- [ ] o aviso aparece sem precisar de rolagem, ou a tela **rola** e nada fica inalcançável
- [ ] cada campo do inventário (§2) aparece no "o que fica salvo"
- [ ] a lista do "nunca" está lá
- [ ] nenhuma frase do aviso é falsa hoje — conferida uma por uma contra o código

**Consentimento**
- [ ] conta nova vê o aviso **antes** de qualquer dado
- [ ] "Prefiro não entrar" volta ao login **deslogado**
- [ ] o registro tem os três campos, e a data é do **servidor**
- [ ] subir a versão faz o aviso reaparecer para quem já aceitou
- [ ] falha de gravação mantém a pessoa no aviso, **com o motivo na tela**
- [ ] a tela de consulta mostra data e versão

**Remoção**
- [ ] o pedido é criado com status inicial e carimbo do servidor
- [ ] o titular **não** consegue alterar nem apagar o próprio pedido — testado, não presumido
- [ ] o pedido aparece na fila de quem decide, com contagem
- [ ] atender remove de verdade o que foi prometido
- [ ] o prazo na tela é o mesmo da constante
- [ ] voltar a entrar depois de excluído se comporta como o texto diz

**Fronteira de acesso**
- [ ] **deslogado, ler dado dá negado** — testado direto no banco, não pela interface
- [ ] uma conta comum **não** consegue o que é de administrador — testado com conta comum

---

## §8 · Armadilhas — todas custaram retrabalho de verdade

**ARM-01 · Campo novo exige mexer nas duas listas de permissão.**
Regras que validam `create` por lista de chaves **e** `update` por chaves afetadas recusam campo
novo **em silêncio**: a gravação falha, nada muda na tela, nenhum erro aparece. Foi assim que uma
preferência de tema nunca persistiu, por semanas, para todos os usuários comuns.

**ARM-02 · Testar com a conta de dono/admin não prova nada sobre o resto.**
Se a regra é `if ehAdmin() || (condições do usuário comum)`, o teste com a sua conta passa pelo
primeiro ramo e **nunca avalia o segundo**. Toda regra nova precisa de um teste com **conta comum**.
Foi o que esconderam a ARM-01 por semanas.

**ARM-03 · A ordem dos `ou` decide se a tela abre vazia.**
Função que lê documento (`get()`) **erra** quando o documento não existe — e regra que erra **nega**.
Coloque as condições que **não dependem de documento** primeiro. Com a ordem trocada, a pessoa entra
e vê tela vazia, sem erro no console.

**ARM-04 · Não valide tipo de valor em campo que não é fronteira de segurança.**
Um `is int` na versão do consentimento passa na compilação e pode **trancar** a pessoa em tempo de
execução, se o SDK serializar o número de outro jeito. Valide o que protege (`== true`,
`== hora do servidor`); não valide o resto.

**ARM-05 · O elemento que aparece por classe deve ser escondido por classe.**
Misturar `style.display` com CSS por classe produz **tela em branco sem erro nenhum**. Para
expansíveis, prefira `<details>` nativo: sem JS, não há estado para divergir.

**ARM-06 · `innerText` e `getComputedStyle` funcionam dentro de `display:none`.**
Os dois respondem normalmente em elemento invisível, e `.click()` dispara. Verificação de tela só
vale com `getBoundingClientRect()` com altura > 0, `offsetParent !== null`,
`document.elementFromPoint()` no meio do elemento — **e uma captura de tela olhada de verdade**.

**ARM-07 · O login recria o cadastro apagado.**
O fluxo padrão "não existe documento? cria" desfaz visualmente a exclusão no próximo login. Ou o
texto avisa (RF-LGPD-37), ou o fluxo trata o caso.

**ARM-08 · Habilitar um segundo provedor de autenticação abre auto-cadastro.**
E se alguma regra identifica administrador por **e-mail**, cuidado: e-mail de conta com senha
própria **não é verificado**. Sem exigir o provedor verificado, alguém se cadastra com o **seu**
e-mail e nasce administrador. Exija o provedor na regra de dono.

**ARM-09 · Cascata automática não existe sem servidor.**
Em app estático (só banco + hospedagem), apagar em cascata é manual por definição. Não prometa
"apaga tudo" se quem apaga é uma pessoa.

**ARM-10 · Auditar a regra não é exercitar a regra.**
Ler o arquivo e confirmar que a permissão está no lugar certo é mais fraco do que parece. A regra
pode compilar e ainda recusar (ou permitir) em execução. Registre a diferença entre *auditado* e
*testado* — e feche a diferença. **Dá para fechar sem conta de teste e sem emulador:** ver A.7.

**ARM-11 · `delete: false` sem lista branca no `update` é trilha de mentira.**
Ver RN-LGPD-34a. Proibir apagar e permitir reescrever dá no mesmo, com a diferença de que parece
seguro. Quando você impede uma via, confira se a outra não faz o mesmo estrago.

**ARM-12 · `git add .` bota dado pessoal no histórico.**
Aconteceu nesta própria sessão: um `git add .` amplo varreu, junto com o arquivo que eu queria, uma
pasta com **export de conversa de WhatsApp do grupo**. Pegou antes do push, mas o histórico do git é
para sempre. Some `git add <caminho>` explícito, e `git show --stat HEAD` depois de commitar.

No mesmo repositório havia um **service account key** commitado no passado — já rotacionado e já
retirado do rastreamento, mas a chave morta continua no histórico. Duas regras que saem disso:
`.gitignore` para credencial **antes** do primeiro commit, e credencial que vaza **se rotaciona**,
porque limpar histórico é caro e raramente completo.

**ARM-13 · Quando o teste reprova, a primeira hipótese inclui "o teste está errado".**
Um arnês de teste silenciosamente errado não acusa erro: ele acusa **a coisa certa como defeito**, e
leva você a estragar código que funcionava. Aconteceu: um formato de valor errado nos casos de teste
reprovou uma guarda de segurança correta, e a correção já estava sendo escrita quando um bloqueio
externo forçou o diagnóstico. Antes de mexer no código, prove que o arnês mede o que você pensa —
com um caso de sanidade que **tem** de passar (ver A.7).

---

## §9 · O que esta especificação NÃO cobre

Diga isso no documento do app, para ninguém supor que está pronto:

- **Portabilidade** — exportar os próprios dados em formato legível (art. 18, V).
- **Revogação sem exclusão** — retirar o consentimento e continuar com a conta.
- **Cascata automática** — depende de servidor/função.
- **Retenção e descarte** — por quanto tempo o dado fica depois da conta morrer.
- **Encarregado (DPO) e canal formal de titular** — quem responde, em quanto tempo, por onde.
- **Base legal declarada** — consentimento, execução de contrato ou legítimo interesse.

Nenhum desses é opcional para um app com uso sério; todos foram deixados fora do escopo do primeiro
ciclo, de propósito e por escrito.

---

## Anexo A · Padrão de implementação em Firebase + Firestore

Vale para app estático (Hosting + Firestore + Auth), sem servidor.

**A.1 — Toda a autorização vive nas regras.** Comparação no navegador não protege nada: o cliente é
público. Se a regra exige identidade autenticada, uma "senha" conferida no JavaScript não produz
identidade — e o banco recusa tudo.

**A.2 — Campos do consentimento no documento do usuário**, com as duas listas atualizadas:

```
// create — lista de chaves permitidas
keys().hasOnly(['nome','email','foto', /* … */ ])

// update de quem não é admin — chaves que podem mudar
diff(resource.data).affectedKeys()
  .hasOnly(['nome','foto','tema','lgpdCiente','lgpdCienteEm','lgpdVersao'])

// e as guardas que fazem o registro valer
&& (!('lgpdCiente' in affectedKeys())
    || (request.resource.data.lgpdCiente == true
        && request.resource.data.lgpdCienteEm == request.time))
```

`== request.time` é o que amarra o carimbo ao servidor: o cliente manda `serverTimestamp()` e a regra
confere que foi isso mesmo.

**A.3 — Coleção do pedido de remoção**, com o id sendo o uid do titular:

```
match /solicitacoesExclusao/{uid} {
  allow get:    if eu(uid) || ehAdmin();
  allow list:   if ehAdmin();
  allow create: if eu(uid)
                && keys().hasOnly(['uid','email','nome','status','pedidoEm'])
                && request.resource.data.status == 'aberta'
                && request.resource.data.email == request.auth.token.get('email','')
                && request.resource.data.pedidoEm == request.time;
  allow update: if ehAdmin()
                && affectedKeys().hasOnly(['status','resolvidoEm','resolvidoPor'])
                && request.resource.data.status in ['atendida','recusada'];
  allow delete: if false;      // a trilha não some, nem para o admin
}
```

O id ser o uid dá "um pedido por pessoa" de graça. O preço é que pedido recusado não reabre — ver
RF-LGPD-38.

**A.4 — Identificar dono/admin sem depender de documento**, e nessa ordem:

```
function porGoogle() { return request.auth.token.firebase.sign_in_provider == 'google.com'; }
function ehDono()    { return porGoogle() && request.auth.token.get('email','') in donos(); }
function ehAdmin()   { return ehDono() || (logado() && meuDoc().roles.hasAny(['admin'])); }
```

`ehDono()` primeiro por causa da ARM-03; `porGoogle()` por causa da ARM-08.

**A.5 — Regras e aplicação sobem no mesmo deploy.** Publicar a tela sem a regra (ou o contrário)
produz o sintoma "sumiu tudo". No CI, um comando só.

**Confira se o seu CI publica as regras.** O workflow que o próprio Firebase CLI gera
(`action-hosting-deploy`) publica **só o Hosting**. Num app assim, `git push` sobe a tela nova e
**deixa a regra atrás** — o botão novo vai ao ar já quebrado. Ou você acrescenta o passo no
workflow, ou as regras são um comando manual, e ele vem **primeiro**:

```bash
firebase deploy --only firestore:rules --project <projeto>
```

Regra primeiro é a ordem segura: a regra nova costuma ser mais permissiva, então o código antigo
continua funcionando durante a janela entre os dois deploys. Na ordem inversa, existe um intervalo
em que a tela nova pede uma permissão que ainda não existe.

**A.6 — Confira o que subiu lendo do servidor**, não abrindo o site: carimbe uma versão nos assets e
procure por ela na resposta do servidor. HTTP 200 sozinho não prova nada.

**A.7 — Teste as regras com identidade simulada. Sem conta de teste, sem emulador.**

Existe um endpoint oficial que avalia as regras com um `request.auth` inventado, **sem tocar no
banco**:

```
POST https://firebaserules.googleapis.com/v1/projects/<projeto>:test
{ "source": { "files": [{ "name": "f.rules", "content": "<as regras>" }] },
  "testSuite": { "testCases": [ { "expectation": "ALLOW", "request": {...}, "functionMocks": [...] } ] } }
```

Vale ouro por um motivo: é o único jeito prático de exercitar **o caminho de quem não é admin**.
Toda regra costuma começar com `isAdmin() || (…)`, e a sua conta passa pelo primeiro ramo — o
segundo nunca é avaliado. Exemplos prontos: `meu-peso/scripts/testa-rules.mjs` (25 casos) e
`Controle Integrantes Blocos/qa_rules_lgpd.mjs` (15 casos).

Quatro coisas que custam tempo se você não souber antes:

1. **Valores em JSON PURO.** Os invólucros do Firestore REST (`{stringValue}`, `{booleanValue}`,
   `{timestampValue}`) chegam como **mapa** — e aí `campo == true` é falso, sem erro. **Timestamp é
   string ISO crua**; a API converte. Este foi o erro da ARM-13.
2. **`request.time` é o `time` do caso de teste.** Então `data.x == request.time` é testável: passe
   o mesmo valor nos dois. Se você **não** passar `time`, nada de timestamp funciona.
3. **Toda função que lê documento precisa de mock** (`functionMocks`), senão a regra erra e nega — e
   você vai depurar a regra errada. Confira **quais**: num app eram duas, `get()` e `exists()`,
   porque um helper usava cada uma. Para simular documento inexistente,
   `result: { "undefined": {} }` — e é esse o caso que reproduz a ARM-03.
4. **Comece por um caso de sanidade** que tem de passar (um update trivial que você sabe permitido).
   Se ele reprovar, o arnês está errado, não a regra.

**Teste o que está PUBLICADO, não o do seu disco.** É o que vale para as pessoas agora. Busque o
release e a fonte do ruleset, e rode os mesmos casos contra ela:

```
GET /v1/projects/<projeto>/releases/cloud.firestore   →  { rulesetName }
GET /v1/<rulesetName>                                 →  { source: { files: [{ content }] } }
```

Nos três apps isso virou a opção `--no-ar` do script. Vale como verificação pós-deploy: em vez de
"subiu sem erro", você tem "as 19 garantias continuam valendo em produção".

Autenticação: o token do `firebase` CLI serve. Qualquer comando autenticado do CLI o renova quando
expira (ele dura ~1h).

**A.8 — Backup dos dados sem servidor, em leitura pura.**

Antes da primeira edição. Não precisa de service account: a API REST do Firestore aceita o token da
sessão do `firebase` CLI, e `:listCollectionIds` + `GET` por coleção descem recursivamente nas
subcoleções.

O que importa no script: recursão (senão subcoleção fica de fora — num app eram 21 subcoleções
`dados_sigilosos`, uma por pessoa), **sha256** ao lado do arquivo, e contagem por coleção impressa no
fim, para você comparar com o que o app mostra na tela. Exemplo funcionando:
`Controle Integrantes Blocos/backup_firestore_cli.js`.

Se o token estiver expirado a API devolve **401**; rodar qualquer comando autenticado do CLI o
renova.

---

## Anexo B · Textos base, para adaptar

Substitua `{{…}}`. Mantenha o tom: frase curta, sujeito claro, zero jurídico.

### B.1 — Cartão na tela de entrada

> **A sua senha do {{provedor}} não passa por aqui.**
>
> Quem confere quem você é é o {{provedor}}. A senha é digitada na tela dele — este app não vê e não
> guarda a sua senha.
>
> Do login chegam {{três}} coisas: **{{nome, e-mail e foto}}**. É {{o que o administrador lê para
> liberar a sua entrada}}.
>
> **▸ O que fica salvo, exatamente**
> · **No app:** {{campos do inventário}}.
> · **No seu aparelho:** {{sessão e preferências}}. {{Sair}} apaga.
> · **Nunca:** {{senha, CPF, documento, cartão, endereço, telefone}}. O app não pede nada disso.
> · {{Frase causal do dado sensível, se houver: "X é dado de saúde. É por isso que …"}}

### B.2 — Aviso bloqueante do 1º acesso

> **Antes de começar**
>
> **1 · O login é só a portaria.** Serve para {{conferir o seu e-mail e liberar o acesso}}. A senha
> fica com o {{provedor}}; o app nunca a vê.
>
> **2 · O que o app guarda.** {{Campos}}. {{Sensível}} é dado de {{saúde}} — é por isso que o acesso
> é fechado. Não se pede {{lista do nunca}}.
>
> **3 · Nada é vendido nem compartilhado.** Quem vê {{o quê}} é {{quem}}, e mais ninguém.
>
> **4 · Dá para sair.** No Perfil há **Excluir minha conta**. {{O pedido vai para o administrador,
> que apaga o seu cadastro em até 15 dias}}.
>
> `[ Prefiro não entrar ]` `[ Ciente, vamos lá ]`

### B.3 — Tela de exclusão

> Isto **abre um pedido** para o administrador — não apaga na hora. É de propósito: um toque sem
> querer não pode ser irreversível.
>
> · O seu cadastro ({{campos}}) é apagado em até **{{15}}** dias.
> · {{O que está em agregado}} é **anonimizado**: {{o número continua, o seu nome sai}}.
> · O pedido fica registrado e **não pode ser apagado** — nem por você, nem pelo administrador. É a
>   trilha que prova que você pediu.
> · Se você entrar de novo com a mesma conta, começa do zero: {{novo pedido de entrada}}. Os dados
>   antigos não voltam.

### B.4 — Nota na fila do administrador

> **Atender** apaga {{o cadastro da pessoa}} agora. O pedido em si nunca é apagado, nem por você: é
> a trilha. E {{o agregado}} **não muda sozinho**: {{o que fazer à mão}}.

---

## Onde estão os exemplos que funcionam

| O que | Onde |
|---|---|
| Teste de Rules com identidade simulada | `meu-peso/scripts/testa-rules.mjs` (25 casos) · `Que Viagem é essa/scripts/testa-rules.mjs` (19) · `Controle Integrantes Blocos/qa_rules_lgpd.mjs` (15) |
| Backup em leitura pura, recursivo, com sha256 | `Controle Integrantes Blocos/backup_firestore_cli.js` |
| Aviso no portão + expansível | `meu-peso/public/index.html`, o `.cartao.privacidade` do `#gate` |
| Aviso bloqueante com 4 declarações | `meu-peso/public/index.html`, `#lgpd` |
| Fila de exclusão para quem decide | `Que Viagem é essa/public/index.html`, `#scr-exclusoes` |
| Regras endurecidas do pedido | `Que Viagem é essa/firestore.rules`, `match /solicitacoesExclusao/{uid}` |

Rodar os três testes contra produção, de uma vez, é o jeito mais rápido de saber se algo regrediu:

```bash
node scripts/testa-rules.mjs --no-ar
```

---

## Procedência

Cada requisito daqui saiu de código escrito, publicado e — onde indicado — verificado em produção.
Nada é hipótese.

**As armadilhas do §8 são defeitos que aconteceram.** ARM-01 e ARM-02 juntas esconderam dois bugs
(um por semanas, outro desde que o botão nasceu); ARM-03 foi pega antes de publicar, e teria dado
tela vazia sem erro; ARM-05 e ARM-06 já causaram tela em branco em produção; ARM-13 quase me fez
remover uma regra de segurança **correta**, e o que impediu foi um bloqueio externo que forçou o
diagnóstico; ARM-12 aconteceu na sessão em que este documento nasceu, com o `git add .`.

**Em 02/09/2026 as regras dos três apps foram testadas contra produção** — 25, 19 e 15 casos, todos
passando, com identidade simulada de membro comum e de administrador.

**O que continua não provado, nos três:** as telas com sessão e dados reais — a fila com um pedido
de gente de verdade, o modo visita. Isso só um login prova. O que está provado é a caixa e o texto
(com captura de tela) e as permissões (com identidade simulada).

Documentos de origem, para o detalhe: `meu-peso/PRD.md` §5.9 · `meu-peso/SPEC.md` §3.2 e §8.11 ·
`meu-peso/README.md` §13 (armadilhas A11 a A14) e §14 (diários de 01 e 02/09/2026) ·
`Controle Integrantes Blocos/PROJECT_MEMORY.md` (02/09) ·
`Que Viagem é essa/MEMORIA_PROJETO.md` (02/09).
