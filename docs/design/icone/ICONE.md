# Ícone do app — Meu Bandejão

## Conceito
Monograma geométrico onde a **bandeja** é o container e o **garfo** é um gráfico de barras.
Três elementos, em traço uniforme:

1. retângulo arredondado horizontal → bandeja de refeitório
2. círculo à esquerda → prato visto de cima / xícara de café
3. três hastes de altura crescente à direita → dentes do garfo e, ao mesmo tempo, barras de gasto

É o mesmo mark usado dentro do app (cabeçalho, tela de login, FAB), então ícone e interface falam
a mesma língua. Sem detalhe figurativo: legível a 24px.

## Arquivos
| Arquivo | Uso |
|---|---|
| `app-icon-amber-1024.svg` | principal — fundo quadrado, gradiente âmbar, mark grafite. Para lojas (iOS/Android aplicam a máscara) |
| `app-icon-amber-rounded.svg` | mesma arte com cantos arredondados, para web, PWA e apresentações |
| `app-icon-navy-1024.svg` | variante sóbria — fundo azul FGV, mark âmbar |
| `app-icon-navy-rounded.svg` | idem, cantos arredondados |
| `mark-mono.svg` | só o símbolo, fundo transparente, `stroke="currentColor"` — para uso dentro da UI |

Todos em `viewBox="0 0 64 64"`, exportáveis em qualquer resolução. Para PNG, renderizar em
1024×1024, 512, 192, 180 e 120.

## Especificação
- Traço `5` no viewBox de 64 (≈7,8% da largura), cantos e pontas arredondados.
- Mark a 80% da área, centralizado — a folga cobre a máscara arredondada das plataformas.
- Fundo âmbar: gradiente 145° `#FFD07A → #FF9F1C`; mark `#06101F`.
- Fundo azul: gradiente 145° `#0F3670 → #0B2B5C`; mark `#FFB84D`.
- Cantos arredondados das variantes `rounded`: `rx` 14/64 ≈ 22% da largura.
- Sem sombra, sem brilho, sem texto.

Substitua o azul pelos hex oficiais do manual FGV quando tiver acesso a eles.

## Prompt de geração de imagem
Caso queira testar variações em uma ferramenta de imagem:

> Ícone de aplicativo minimalista e geométrico, squircle iOS, fundo laranja queimado sólido
> (#FF9F1C) [ou azul-marinho #0B2B5C], símbolo centralizado em traço uniforme cor grafite (#06101F)
> [ou creme #FFF6EC]: um retângulo arredondado horizontal representando uma bandeja de refeitório,
> com um círculo à esquerda (prato visto de cima / xícara de café) e três hastes verticais de altura
> crescente à direita, que leem simultaneamente como dentes de garfo e como barras de gráfico
> financeiro. Vetorial, traço uniforme, cantos arredondados, sem sombra, sem gradiente, sem texto,
> grid ótico simétrico, flat, alto contraste, 1024x1024.

Variações que valem testar: mark preenchido em vez de contorno; moeda no lugar do prato;
bandeja em perspectiva isométrica.
