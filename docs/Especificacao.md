# Especificação Funcional e Técnica - Meu Bandejão

## 1. Autenticação e Segurança
*   **Login Único:** Acesso realizado exclusivamente via Google OAuth (e-mail do Google).
*   **Módulo de Aprovação:** Todo novo acesso deve ficar bloqueado por padrão até que o Usuário Admin aprove manualmente a entrada do novo usuário na base do Firebase.
*   **Criptografia do Salário:** O salário médio ou base imputado pelo usuário será criptografado diretamente no banco de dados. Nem o perfil Admin terá acesso à chave de leitura.
*   **Reautenticação para Edição:** Para editar o salário cadastrado, o sistema exigirá um fluxo de reautenticação para garantir a identidade do usuário.

## 2. Gestão de Despesas (CRUD)
*   **Captura e OCR em Memória:** Inclusão de lançamentos através de fotografia da nota fiscal. O sistema processa a imagem em memória RAM via OCR, extrai os dados, joga para uma tela de validação humana e **descarta a imagem imediatamente** após o salvamento, sem armazenar fotos no banco de dados.
*   **Tipos de Refeição:** A interface permitirá selecionar "Refeição a Quilo", "Prato Feito" (valor único sem peso) e inclusão de itens com custo zero (como a sobremesa/fruta inclusa).
*   **Edição e Inserção Manual:** O usuário pode corrigir as informações ou realizar um lançamento 100% manual.
*   **Validação de Exclusão:** A exclusão de um lançamento exige uma confirmação obrigatória na interface.

## 3. Módulo de Conciliação
*   **Conciliação Visual:** Não haverá importação de arquivos do Apdata. O sistema funcionará como um gerador de relatórios fidedignos para que o usuário confronte visualmente com o seu contracheque, garantindo que nenhum documento sigiloso transite no app.

## 4. Dashboard e Relatórios Interativos
*   **Comportamento Power BI:** Todos os gráficos e painéis são interativos. Ao clicar em uma linha, categoria ou período, toda a tela é re-renderizada exibindo apenas os dados daquele filtro.
*   **Visões e Métricas:**
    *   Média diária de gastos e de consumo.
    *   Gráfico de linhas demonstrando a evolução de quilos consumidos e valores pagos ao longo dos dias.
    *   Divisão financeira: Custo total do consumo vs. Valor desembolsado (baseado na regra hardcoded do RH).
    *   Análise de inflação/aumento do preço do quilo ao longo do período e separação por tipo de item.
*   **Exportação Dinâmica:** O botão de exportar gerará um arquivo refletindo os filtros exatos aplicados no painel naquele momento.

## 5. Requisitos de Infraestrutura
*   **Tecnologia PWA (Progressive Web App):** A interface web deve se comportar como um aplicativo nativo de smartphone, permitindo "instalar" a URL na tela inicial do celular.
*   **Backend:** Banco de dados e autenticação estruturados em um projeto particular do Firebase.

## 6. Regras de Negócio (RH/Desconto)
*   **Refeição Interna (Sapore e Rei do Mate):**
    *   **Sapore:** O desconto é realizado por dia consumido, diretamente na folha de pagamento.
    *   **Rei do Mate:** As compras realizadas no Rei do Mate são pagas integralmente pelo colaborador (também descontadas no contracheque).
    *   **Exclusividade:** O benefício de refeição interna é exclusivo para consumo em serviço e não é acumulativo com o vale-refeição externo.
    *   *(Aguardando mais informações...)*
