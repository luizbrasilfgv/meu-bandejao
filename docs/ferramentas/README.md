# Ferramentas

Scripts de apoio. Nenhum é dependência do app: rodam à mão, quando preciso.

## `gera-icone.js`

Gera `public/icon-192-v2.png` e `public/icon-512-v2.png` a partir do mark do handoff
(bandeja + prato + garfo-que-é-gráfico). Sem dependência: rasteriza por distância, com
supersampling 3×3 para anti-aliasing, e escreve o PNG com o `zlib` do próprio node.

```bash
node docs/ferramentas/gera-icone.js   # a partir da raiz do repositório
```

**Ao trocar a arte, mude o nome dos arquivos.** O Android indexa o ícone do app instalado pela
URL: substituir o conteúdo mantendo o nome não repinta o atalho de ninguém. Suba o sufixo
(`-v3`) no próprio script, nos arquivos gerados, no `manifest.json`, nas tags `<link>` do
`index.html` e no `CASCO` do `sw.js`.

Duas escolhas registradas:

* **fundo chapado, não gradiente** — o PNG de 512 com gradiente dava 194 KB contra 5 KB, sem
  diferença visível no tamanho de um ícone. O `docs/design/icone/ICONE.md` prevê a variante flat.
* **quadrado cheio, sem cantos arredondados** — iOS e Android aplicam a própria máscara. Arredondar
  aqui produziria canto duplo.
