const zlib = require("zlib");
const fs = require("fs");

/* --- CRC32 e escrita de chunk PNG --- */
const TABELA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABELA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const t = Buffer.from(tipo, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
}
function png(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const linhas = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    linhas[y * (1 + w * 3)] = 0;                       // filtro 0
    rgb.copy(linhas, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(linhas, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/* --- o mark do handoff, por distância (dá anti-aliasing limpo) --- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function sdfRetArred(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r), qy = Math.abs(py - cy) - (hh - r);
  const fx = Math.max(qx, 0), fy = Math.max(qy, 0);
  return Math.hypot(fx, fy) + Math.min(Math.max(qx, qy), 0) - r;
}
const sdfCirculo = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;
function sdfSegmento(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(wx - t * vx, wy - t * vy);
}
/** cobertura do traço no ponto local (viewBox 64), meia-espessura 2.5 */
function tinta(lx, ly) {
  const d = Math.min(
    Math.abs(sdfRetArred(lx, ly, 32, 32, 25, 17, 11)),   // bandeja
    Math.abs(sdfCirculo(lx, ly, 23, 32, 7)),             // prato
    sdfSegmento(lx, ly, 37, 40, 37, 34),                 // garfo / barras
    sdfSegmento(lx, ly, 44, 40, 44, 28),
    sdfSegmento(lx, ly, 51, 40, 51, 22)
  );
  return d <= 2.5;
}

const FUNDO = [255, 159, 28];   // --amber #FF9F1C
const MARK  = [6, 16, 31];      // #06101F

function gerar(n) {
  const rgb = Buffer.alloc(n * n * 3);
  const S = 3;                                  // 3x3 supersampling
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let dentro = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          // pixel -> viewBox 64 -> desfaz o translate/scale(0.8) do grupo
          const vx = ((x + (sx + 0.5) / S) / n) * 64;
          const vy = ((y + (sy + 0.5) / S) / n) * 64;
          if (tinta(32 + (vx - 32) / 0.8, 32 + (vy - 32) / 0.8)) dentro++;
        }
      }
      const a = dentro / (S * S);
      const o = (y * n + x) * 3;
      for (let c = 0; c < 3; c++) rgb[o + c] = Math.round(FUNDO[c] * (1 - a) + MARK[c] * a);
    }
  }
  return png(n, n, rgb);
}

for (const n of [192, 512]) {
  const b = gerar(n);
  fs.writeFileSync(`public/icon-${n}.png`, b);
  console.log(`icon-${n}.png  ${b.length} bytes`);
}
