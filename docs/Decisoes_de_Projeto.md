# Decisões de Projeto e Premissas - Meu Bandejão

## 1. Escopo e Integrações
*   **Zero Integração (Formato POC):** O aplicativo nasce como uma Prova de Conceito com uso focado no controle estritamente pessoal. Não haverá nenhuma integração via API com os sistemas oficiais (Apdata, SAP, etc.).
*   **Conciliação Visual:** Para evitar o tráfego de documentos sensíveis dos usuários (como upload de contracheques), a conciliação será feita visualmente pelo próprio colaborador, confrontando os relatórios gerados pelo "Meu Bandejão" com os dados do seu contracheque.

## 2. Privacidade e Segurança de Dados
*   **Descarte Imediato de Imagens:** O aplicativo não armazenará as fotos das notas fiscais no banco de dados. O fluxo consistirá em: captura da foto, processamento do OCR em memória RAM, exibição dos dados para validação humana na tela e descarte imediato da imagem após o salvamento dos dados em texto.
*   **Criptografia do Salário:** O salário médio ou base imputado pelo usuário será criptografado diretamente no banco de dados. Nem mesmo o perfil Administrador terá acesso à chave de leitura, garantindo total privacidade. O dado será descriptografado apenas em tempo de execução para os cálculos das regras de negócio do RH.
*   **Reautenticação para Edição:** Para que o usuário possa editar o seu próprio salário cadastrado, o sistema exigirá um fluxo de reautenticação (ex: confirmação de senha ou biometria) para garantir que é ele mesmo quem está solicitando a alteração.

## 3. Regras de Negócio e UX
*   **Nomenclatura Profissional:** O aplicativo manterá um nome padrão e sério (como "Meu Bandejão"), descartando sugestões de nomes cômicos ("Saporrê", "Mate do Rei") para preservar a credibilidade da ferramenta em uma eventual expansão de uso.
*   **Tipos de Refeição Flexíveis e Sobremesas:** A base de dados e a interface devem prever as diferentes regras do RH, permitindo lançar não apenas a "Refeição a Quilo" e o "Prato Feito", mas também custos adicionais fixos como: Sobremesa Simples (R$ 2,00) e Sobremesa Especial (R$ 6,00).
