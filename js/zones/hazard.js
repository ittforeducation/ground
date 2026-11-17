/* 區域 6：災害與因應 —— 山坡、溪谷與山腳下的聚落，可以切換晴天與豪雨
   五個節點：山崩與土石流、溪水暴漲與淹水、地震與地表變動、防災避難、守護大地；本區挑戰 5 題
   場景 22×14：後方是山（左邊山坡有崩塌地，兩座山之間是溪谷，谷口是聚落），前方是河與低窪的聚落，右後方的平地被斷層抬高 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, { ss, fbm, clamp, lerp } = U;

const X0 = -11, X1 = 11, Z0 = -7, Z1 = 7, YB = -3, YT = 6.6, CELL = .1, NX = 220, NZ = 140, WL = .1, FL = .66;
const mkLine = p => { const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return { p, L, len: L[L.length - 1] }; };
let _s = 0, _hill = 0;
const nearD = (x, z, Q) => { let m = 1e9; const p = Q.p; for (let i = 0; i < p.length - 1; i++) { const ax = p[i][0], az = p[i][1], bx = p[i + 1][0] - ax, bz = p[i + 1][1] - az, t = clamp(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1), d = Math.hypot(x - ax - bx * t, z - az - bz * t); if (d < m) { m = d; _s = Q.L[i] + t * (Q.L[i + 1] - Q.L[i]); } } return m; };
const atS = (Q, s) => { s = clamp(s, 0, Q.len); let i = 0; while (i < Q.p.length - 2 && Q.L[i + 1] < s) i++; const t = (s - Q.L[i]) / (Q.L[i + 1] - Q.L[i]); return [lerp(Q.p[i][0], Q.p[i + 1][0], t), lerp(Q.p[i][1], Q.p[i + 1][1], t)]; };

const RZ = x => 4.5 + .45 * Math.sin(x * .33 + 2.2);                                              // 河（由西往東流）
const CRK = mkLine([[-4.3, -7], [-4.0, -5.4], [-3.4, -3.8], [-2.9, -2.4], [-2.6, -1.0], [-2.3, .4], [-1.8, 2.0], [-1.3, 3.3], [-1.15, 4.3], [-1.1, 4.95]]), SM = CRK.L[4];   // 溪谷的野溪；SM = 谷口
const SC = mkLine([[-8.35, -2.3], [-8.2, -1.2], [-8.0, -.1]]), TOE = [-7.95, .6];                 // 崩塌地與崩下來的土石堆
const scarN = (x, z) => { const d = nearD(x, z, SC); return d / (.42 + .36 * (1 - _s / SC.len)); };      // 崩塌地：上面寬、下面窄
const DEV = [-5.3, -3.3, 1.0], POND = [9.3, 2.3], TRACK = [7.4, -2.65, 1.0, .55], CAMP = [5.9, 8.95, -3.85, -1.2];      // CAMP = 有操場的校園
const roadZ = x => x < -8 ? 1.3 - .05 * (x + 11) : 1.15 + .0833 * (x + 8);                         // 山腳道路的位置（x < -5.6）
const CUTM = x => ss(-10.95, -10.7, x) * ss(-5.05, -5.4, x) * (1 - ss(-9.0, -8.75, x) * ss(-6.98, -7.2, x));      // 道路上邊坡（開路時切出來的陡坡）；崩塌地那一段除外
const SHE = [2.4, -1.75], SHW = [-5.6, 2.3];                                                      // 兩處避難收容處所
const ROADS = [mkLine([[-11, 1.3], [-8, 1.15], [-5.6, 1.35], [-2.9, 1.6], [-1.2, 1.5], [1, 1.25], [2.4, 1.2], [4.5, .75], [8, .7], [11, .8]]),
  mkLine([[9.3, .72], [9.3, -5.2]]), mkLine([[2.4, 1.2], [2.4, -.9]]), mkLine([[4.5, .75], [3.4, -.1], [2.9, -1.1]]), mkLine([[-5.6, 1.35], [-5.6, 1.85]])];
const roadD = (x, z) => { let m = 1e9; for (const R of ROADS) m = Math.min(m, nearD(x, z, R)); return m; };
const bed0 = s => s < SM ? 1.3 + 2.2 * Math.pow(1 - s / SM, 1.3) : lerp(1.3, -.1, (s - SM) / (CRK.len - SM));
const DAMS = [SM - 2.3, SM - .9], DAMH = .34;                                                       // 攔砂壩：壩後被土石填平到壩頂，水從壩頂的缺口溢流
const bedC = s => { let b = bed0(s); for (const d of DAMS) if (s < d) b = Math.max(b, bed0(d) + DAMH + .02 * (d - s)); return b; };
const damTop = s => { for (const d of DAMS) if (s >= d - .05 && s <= d + .19) return bed0(d) + DAMH; return -9; };
// 斷層：地表的斷層線在 z = FZ（東西向）；斷層面往後方（-z）傾斜。後方那一塊沿著斷層面被往上、往前推（逆向錯動）
const FZ = -2.6, faultS = (x, z) => FZ - z, faultD = x => .42 * ss(4.4, 6.4, x), DIP = .55;
const uplift = (x, z) => faultD(x) * ss(-.03, .1, faultS(x, z));

/* ---------- 地形 ---------- */
function natural(x, z) {
  const base = .8 + .06 * Math.max(0, 3.5 - z);
  const hill = _hill = 5.2 * Math.exp(-((x + 7.5) ** 2 / 16 + (z + 4.2) ** 2 / 9)) + 3.9 * Math.exp(-((x + 1.2) ** 2 / 8 + (z + 6.6) ** 2 / 8)) + 2.6 * Math.exp(-((x - 7.5) ** 2 / 14 + (z + 8) ** 2 / 5));
  return base + hill + (fbm(x * .6 + 3, z * .6, 3) - .47) * .9 * ss(.3, 1.8, hill) + .45 * Math.exp(-((x - SHE[0]) ** 2 + (z - SHE[1]) ** 2) / 2.5) + .34 * Math.exp(-((x - SHW[0]) ** 2 + (z - SHW[1]) ** 2) / 1.2) + .8 * CUTM(x) * ss(.95, .3, z) * ss(-2.0, -.4, z);
}
const PADS = [[SHE[0], SHE[1] + .3, 1.25, .85], [SHW[0], SHW[1], .7, .5], [1.3, .5, .62, .42], [0, 2.2, .45, .35], [6.5, -1.5, .95, .4]];      // 建築的整地範圍（整平，房子才不會懸空）
PADS.forEach(q => { q[4] = natural(q[0], q[1]); });
function height(x, z) {
  let h = natural(x, z); const dr = z - RZ(x), ad = Math.abs(dr);
  for (const q of PADS) h = lerp(h, q[4], ss(1.25, .9, Math.max(Math.abs(x - q[0]) / q[2], Math.abs(z - q[1]) / q[3])));
  if (dr < 0) h = lerp(h, .44, ss(3.4, 4.8, x) * ss(10.8, 9.6, x) * ss(1.0, 1.8, z));               // 河邊低窪的地方
  const pr = Math.hypot(x - POND[0], z - POND[1]); if (pr < .7) h = Math.min(h, .44 - .3 * ss(.62, .36, pr));     // 滯洪池
  h += .3 * Math.max(0, 1 - Math.hypot(x + 2.6, z + 1.0) / 2.8) * ss(-1.4, -.8, z);                 // 谷口的沖積扇
  h -= .3 * ss(1, .35, scarN(x, z));                                                            // 崩塌地：被挖走一塊
  h += .38 * Math.exp(-((x - TOE[0]) ** 2 + (z - TOE[1]) ** 2) / .45);                              // 崩下來的土石堆在坡腳
  const dc = nearD(x, z, CRK), s = _s; h = Math.min(h, bedC(s) + Math.max(0, dc - .1) * (s < SM ? 1.1 : .9));     // 溪谷
  h = Math.min(h, -.28 + Math.max(0, ad - .45)); if (dr > 0) h += .34 * Math.exp(-(((ad - 1.75) / .24) ** 2));    // 河與前岸的堤防
  return h + uplift(x, z);
}
const NV = (NX + 1) * (NZ + 1), H = new Float32Array(NV);
for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) H[j * (NX + 1) + i] = height(X0 + i * CELL, Z0 + j * CELL);
const hAt = (x, z) => { const fx = clamp((x - X0) / CELL, 0, NX - .001), fz = clamp((z - Z0) / CELL, 0, NZ - .001), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, a = j * (NX + 1) + i; return lerp(lerp(H[a], H[a + 1], u), lerp(H[a + NX + 1], H[a + NX + 2], u), v); };
const hillOf = (x, z) => 5.2 * Math.exp(-((x + 7.5) ** 2 / 16 + (z + 4.2) ** 2 / 9)) + 3.9 * Math.exp(-((x + 1.2) ** 2 / 8 + (z + 6.6) ** 2 / 8)) + 2.6 * Math.exp(-((x - 7.5) ** 2 / 14 + (z + 8) ** 2 / 5));

/* 危險範圍（地表貼圖、疏散避難圖、點選判定共用） */
const debZone = (x, z) => { const dc = nearD(x, z, CRK), s = _s; if (s < .8) return 0; if (s < SM) return ss(.36, .2, dc); const w = .34 + (s - SM) * .3; return ss(w, w * .55, dc) * ss(SM + 3.7, SM + 2.7, s); };
const slideZone = (x, z) => Math.max(ss(1.15, .9, scarN(x, z)), ss(.95, .7, Math.hypot(x - TOE[0], z - TOE[1])));
const floodZone = (x, z) => z > .8 && hAt(x, z) < FL + .02 ? 1 : 0;

/* ---------- 地表貼圖：逐像素上色 ---------- */
const mix = (a, b, t) => { a[0] += (b[0] - a[0]) * t; a[1] += (b[1] - a[1]) * t; a[2] += (b[2] - a[2]) * t; return a; };
const inR = (x, z, x0, x1, z0, z1) => ss(x0 - .04, x0 + .04, x) * ss(x1 + .04, x1 - .04, x) * ss(z0 - .04, z0 + .04, z) * ss(z1 + .04, z1 - .04, z);
const FARM = [[150, 190, 92], [176, 150, 98], [112, 160, 78], [198, 190, 106], [134, 176, 84]];
const YARDS = [[-.55, .1, 1.35], [-3.9, .4, .95], [-8.1, 1.95, 1.3], [1.6, 1.9, 1.5], [SHW[0], SHW[1], .8]];
function groundColor(x, z) {
  const h = hAt(x, z), hill = hillOf(x, z), n = fbm(x * 1.7, z * 1.7, 3), dr = z - RZ(x), ad = Math.abs(dr);
  const col = mix([128, 178, 90], [80, 138, 68], clamp(fbm(x * .5 + 2, z * .5, 3) * 1.7 - .35, 0, 1)); mix(col, [52, 104, 56], ss(.3, 1.5, hill) * .65);
  const dv = Math.hypot(x - DEV[0], z - DEV[1]); if (dv < DEV[2]) { const f = h * 7; mix(col, f - Math.floor(f) < .5 ? [168, 184, 104] : [176, 146, 100], ss(DEV[2], DEV[2] - .2, dv)); }      // 開墾成梯田狀的山坡
  if (hill < .5) {
    for (const y of YARDS) mix(col, [196, 192, 180], .55 * ss(y[2], y[2] - .35, Math.hypot(x - y[0], z - y[1])));
    const cp = inR(x, z, CAMP[0], CAMP[1], CAMP[2], CAMP[3]), fm = Math.max(inR(x, z, 4.1, 8.95, -4.7, .35), inR(x, z, 9.65, 10.8, -4.7, .4)) * (1 - cp); mix(col, mix([218, 200, 164], [204, 186, 150], n), cp);
    if (fm > 0) { const k = Math.floor((z + 4.7) / 1.02), q = Math.floor(x / 1.7), fc = FARM[(k * 3 + q * 2 + 50) % 5].slice(), b = 1 + .07 * Math.sin(x * 44); fc[0] *= b; fc[1] *= b; fc[2] *= b; if ((z + 4.7) / 1.02 - k < .05 || x / 1.7 - q < .03) mix(fc, [186, 172, 134], .9); mix(col, fc, fm); }
    mix(col, [150, 186, 96], .5 * ss(3.4, 4.8, x) * ss(10.8, 9.6, x) * ss(1.0, 1.8, z) * (dr < 0 ? 1 : 0));
    mix(col, [198, 194, 182], .6 * inR(x, z, 4.5, 8.95, 1.7, 3.0));                                        // 低窪聚落的鋪面
    mix(col, [214, 196, 160], inR(x, z, SHE[0] - 1.1, SHE[0] + 1.1, SHE[1] + .4, SHE[1] + 1.0));           // 學校的操場
    const e = Math.hypot((x - TRACK[0]) / TRACK[2], (z - TRACK[1]) / TRACK[3]); if (e < 1) { mix(col, e > .66 ? [198, 86, 62] : [112, 172, 86], ss(1, .95, e)); if (Math.abs(e - .83) < .012) mix(col, [245, 240, 232], 1); }
  }
  const cm = CUTM(x) * ss(1.0, .9, z) * ss(-.62, -.36, z); if (cm > 0) { mix(col, mix([158, 148, 134], [120, 112, 102], fbm(x * 5, h * 6, 2)), cm); if (x > -7.02 && x < -5.98) mix(col, [112, 186, 92], cm * .92); }      // 道路上邊坡：裸露的岩壁；格框護坡的格子裡種了草
  const dc = nearD(x, z, CRK), s = _s, rd = roadD(x, z); if (rd < .22 && dc > .55) { mix(col, [198, 194, 186], ss(.22, .19, rd)); mix(col, [94, 97, 104], ss(.165, .14, rd)); const u = (x + z) * 1.6; if (rd < .014 && u - Math.floor(u) < .5) mix(col, [238, 228, 150], 1); }
  const ds = scarN(x, z); if (ds < 1.1) { const st = fbm(x * 7, z * 1.2, 2); mix(col, mix([176, 136, 94], [126, 94, 64], st), ss(1.1, .82, ds)); }         // 崩塌地：裸露的土石
  const tr = Math.hypot(x - TOE[0], z - TOE[1]); if (tr < 1.05) mix(col, U.hash(Math.floor(x * 14), Math.floor(z * 14)) < .3 ? [112, 104, 96] : mix([150, 118, 86], [124, 96, 70], n), ss(1.05, .7, tr));
  if (s > SM) { const w = .3 + (s - SM) * .16; mix(col, mix([182, 174, 156], [160, 152, 136], n), .45 * ss(w, w * .5, dc) * ss(SM + 3.6, SM + 2.4, s)); }
  mix(col, U.hash(Math.floor(x * 16), Math.floor(z * 16)) < .35 ? [120, 118, 112] : [166, 160, 148], ss(.2, .12, dc));                                        // 溪床的石頭
  for (const d of DAMS) if (s < d && s > d - 1.25) mix(col, U.hash(Math.floor(x * 18), Math.floor(z * 18)) < .25 ? [112, 106, 98] : mix([160, 138, 108], [134, 114, 90], n), ss(.45, .28, dc) * ss(d - 1.25, d - .85, s));      // 攔砂壩攔下來的土石
  if (ad < 1.6) { mix(col, [192, 184, 156], ss(1.6, 1.3, ad) * .8); mix(col, mix([132, 136, 126], [108, 114, 108], n), ss(1.1, .95, ad)); }
  if (dr > 0 && ad > 1.42 && ad < 2.1) mix(col, ((x * 3) % 1 + 1) % 1 < .06 ? [150, 152, 150] : [184, 186, 182], ss(1.42, 1.5, ad) * ss(2.1, 2.0, ad));            // 堤防
  const pr = Math.hypot(x - POND[0], z - POND[1]); if (pr < .75) mix(col, [170, 172, 162], ss(.75, .62, pr));
  return col;
}
function groundTexture(W, Hh) {
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const col = groundColor(X0 + (i + .5) / W * (X1 - X0), Z0 + (j + .5) / Hh * (Z1 - Z0)), k = .93 + .14 * U.hash(i, j), o = (j * W + i) * 4;
    d[o] = col[0] * k; d[o + 1] = col[1] * k; d[o + 2] = col[2] * k; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
}
// 蓋在地表上的半透明圖層（疏散避難圖的危險範圍、土石流留下的土石、淹水留下的泥沙）；fn(x,z) → [r,g,b,a] 或 null
function overlayTexture(fn) {
  const W = 440, Hh = 280, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const q = fn(X0 + (i + .5) / W * (X1 - X0), Z0 + (j + .5) / Hh * (Z1 - Z0), i, j); if (!q) continue; const o = (j * W + i) * 4; d[o] = q[0]; d[o + 1] = q[1]; d[o + 2] = q[2]; d[o + 3] = q[3] * 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; return t;
}

/* ---------- 四面側牆的剖面：表土 → 平原的砂礫 → 一層層的岩層。斷層是一條直的斜線，後方那一塊整塊往上錯動 ---------- */
const WALLS = [
  { len: X1 - X0, at: s => [X0 + s, Z1], sc: 44, shade: 1 },
  { len: Z1 - Z0, at: s => [X0, Z0 + s], sc: 36, shade: .84 },
  { len: X1 - X0, at: s => [X1 - s, Z0], sc: 36, shade: .78, fault: 1 },
  { len: Z1 - Z0, at: s => [X1, Z1 - s], sc: 44, shade: .92, fault: 1 }];
const ROCKC = [[156, 140, 120], [126, 120, 116], [176, 156, 126], [110, 108, 112], [146, 126, 106], [190, 172, 140]], ALLU = [[202, 178, 130], [178, 162, 132], [216, 198, 152], [162, 152, 136]];
function section(w) {
  const sc = Math.round(w.sc * (G.coarse ? .7 : 1)), W = Math.round(w.len * sc), Hh = Math.round((YT - YB) * sc);
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  for (let i = 0; i < W; i++) {
    const [x, z] = w.at((i + .5) / W * w.len), hT = height(x, z), hill = _hill, bed = Math.abs(z - RZ(x)) < .7 || nearD(x, z, CRK) < .15, road = roadD(x, z) < .15;
    const fd = faultD(x), fs = faultS(x, z), yref = hT - uplift(x, z), A = .55 * ss(.8, .1, hill);
    for (let j = Math.max(0, Math.floor((YT - hT - .15) / (YT - YB) * Hh)); j < Hh; j++) {
      const y = YT - (j + .5) / Hh * (YT - YB), dp = hT - y; if (dp < 0) continue; let col;
      const fl = fs - (yref - y) * DIP, hang = fd > 0 && fl > 0;
      if (dp < .04) col = road ? [86, 88, 96] : bed ? [150, 150, 138] : [93, 154, 62]; else if (dp < .12) col = [84, 62, 44];
      else if (dp < .12 + A) { col = ALLU[(U.hash(Math.floor((dp + .1 * fbm(x * .8, z * .8, 2)) / .16), 3) * 4) | 0]; if (U.hash(i >> 1, j >> 1) < .05) col = [140, 136, 128]; }
      else { const v = (y - (hang ? fd : 0) + .035 * x + 20) / .42, b = Math.floor(v); col = ROCKC[(U.hash(b, 5) * 6) | 0]; if (v - b < .07) col = [col[0] * .72, col[1] * .72, col[2] * .72]; }
      if (fd > .05 && Math.abs(fl) < .03 && dp > .02) col = [124, 34, 28];                              // 斷層線
      const k = (.93 + .14 * U.hash(i, j)) * (1 - .14 * ss(0, YB, y)), o = (j * W + i) * 4; d[o] = col[0] * k; d[o + 1] = col[1] * k; d[o + 2] = col[2] * k; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function wallGeo(w, R) {      // 有斷層的兩面做成網格：斷層後方那一塊可以沿著斷層面整塊移動
  const pos = [], uv = [], up = [], idx = [], n = Math.round(w.len / CELL);
  for (let i = 0; i <= n; i++) { const [x, z] = w.at(i * w.len / n), hT = height(x, z), u = i / n, fd = faultD(x), fs = faultS(x, z), yref = hT - uplift(x, z);
    for (let j = 0; j <= R; j++) { const y = YB + (hT - YB) * j / R; pos.push(x, y, z); uv.push(u, (y - YB) / (YT - YB)); up.push(j === R ? uplift(x, z) : fd * (fs - (yref - y) * DIP > 0 ? 1 : 0)); } }
  for (let i = 0; i < n; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('aUp', new THREE.Float32BufferAttribute(up, 1)); geo.setIndex(idx); return geo;
}

/* ---------- 流動的水 ---------- */
const GLSL_N = `float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }`;
function flowMat(mud, alpha) {          // 溪水（沿著水帶流）
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: U.time, uMud: { value: mud }, uA: { value: alpha } },
    vertexShader: `attribute float aU; attribute float aS; varying float vU; varying float vS;
      void main(){ vU = aU; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uMud; uniform float uA; varying float vU; varying float vS; ${GLSL_N}
      void main(){ vec2 p = vec2(vU * 1.4, (vS - uTime * mix(.6, 1.7, uMud)) * 1.6);
        float st = vnoise(p * vec2(2.2, 1.0)) * .62 + vnoise(p * vec2(4.6, 2.6) + 7.3) * .38;
        vec3 col = mix(vec3(.22, .60, .78), vec3(.56, .40, .24), uMud); col *= mix(.86, 1.0, vU * vU); col += .09 * smoothstep(.52, .78, st);
        gl_FragColor = vec4(pow(col, vec3(2.2)), uA * .9 * smoothstep(1.0, .8, abs(vU)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
}
function waterMat() {                   // 河水與淹水（一整片水平的水面，水位升高就淹進低窪的地方）
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPh: { value: 0 }, uMud: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uPh; uniform float uMud; varying vec3 vW; ${GLSL_N}
      void main(){ vec2 p = vec2((vW.x - uPh) * 1.5, vW.z * 3.2);
        float st = vnoise(p * vec2(1.0, 2.2)) * .62 + vnoise(p * vec2(2.6, 4.6) + 7.3) * .38;
        vec3 col = mix(vec3(.22, .60, .78), vec3(.60, .43, .25), uMud); col += mix(.08, .13, uMud) * smoothstep(.5, .78, st);
        gl_FragColor = vec4(pow(col, vec3(2.2)), mix(.86, .95, uMud));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
}
function ribbon(pts, hw, yOf) {
  const pos = [], aU = [], aS = [], idx = []; let s = 0;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L, y = yOf(p[0], p[1], i);
    if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    for (let k = 0; k <= 4; k++) { const u = k / 2 - 1; pos.push(p[0] - tz * u * hw, y, p[1] + tx * u * hw); aU.push(u); aS.push(s); }
    if (i) for (let k = 0; k < 4; k++) { const n = i * 5 + k; idx.push(n - 5, n, n - 4, n - 4, n, n + 1); }
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1)); geo.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); geo.setIndex(idx); return geo;
}
const sample = (Q, s0, s1, step) => { const out = []; for (let s = s0; s <= s1 + 1e-6; s += step) out.push(atS(Q, s)); return out; };

/* ---------- 建立場景 ---------- */
function build() {
  const T = THREE, scene = new T.Scene(), root = new T.Group(), upG = new T.Group(); scene.add(root); root.add(upG);
  const skyA = U.skyTexture('#74b6e6', '#eef1e6'), skyB = U.skyTexture('#566170', '#a4adb4'); scene.background = skyA; scene.fog = new T.Fog(0xe8eee8, 70, 170);
  const sun = U.addSun(scene, 16), hemi = scene.children.find(o => o.isHemisphereLight); scene.add(U.groundShadow(40, 28, YB - .05));
  const anim = [], rnd = U.rng(61), detail = U.detailTexture(12, 8), uUp = { value: 0 };
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SC3 = new T.Vector3(), E3 = new T.Euler(), UP = new T.Vector3(0, 1, 0);
  const lift = m => { m.onBeforeCompile = sh => { sh.uniforms.uUp = uUp; sh.vertexShader = 'attribute float aUp; uniform float uUp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y -= aUp * (1.0 - uUp); transformed.z -= aUp * ' + DIP.toFixed(3) + ' * (1.0 - uUp);'); }; return m; };      // 地震前：把斷層後方那一塊沿著斷層面退回原位

  // 地形與側牆
  const pos = new Float32Array(NV * 3), uvs = new Float32Array(NV * 2), ups = new Float32Array(NV), idx = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const a = j * (NX + 1) + i, x = X0 + i * CELL, z = Z0 + j * CELL; pos[a * 3] = x; pos[a * 3 + 1] = H[a]; pos[a * 3 + 2] = z; uvs[a * 2] = i / NX; uvs[a * 2 + 1] = j / NZ; ups[a] = uplift(x, z); }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.BufferAttribute(uvs, 2)); tg.setAttribute('aUp', new T.BufferAttribute(ups, 1)); tg.setIndex(idx); tg.computeVertexNormals();
  root.add(U.shadowed(new T.Mesh(tg, lift(new T.MeshStandardMaterial({ map: G.coarse ? groundTexture(704, 448) : groundTexture(1232, 784), bumpMap: detail, bumpScale: 1.5, roughness: .95 }))), false, true));
  for (const w of WALLS) root.add(new T.Mesh(wallGeo(w, w.fault ? 64 : 1), lift(new T.MeshBasicMaterial({ map: section(w), color: new T.Color(w.shade, w.shade, w.shade), toneMapped: false, side: T.DoubleSide }))));

  // 蓋在地表上的圖層
  const layer = (fn, lf) => { const m = new T.Mesh(tg, (lf ? lift : q => q)(new T.MeshBasicMaterial({ map: overlayTexture(fn), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))); m.visible = false; m.renderOrder = 1; root.add(m); return m; };
  const setLayer = (m, a) => { m.material.opacity = a; m.visible = a > .01; };
  const ovDeb = layer((x, z, i, j) => { const a = Math.max(debZone(x, z), .8 * ss(.85, .5, scarN(x, z)), .9 * ss(.9, .6, Math.hypot(x - TOE[0], z - TOE[1]))); if (a < .05) return null; const r = U.hash(i >> 1, j >> 1); return r < .16 ? [96, 90, 84, a] : [lerp(132, 108, r), lerp(100, 80, r), lerp(70, 56, r), a * .92]; });
  const ovSilt = layer((x, z, i, j) => { const h = hAt(x, z); if (!floodZone(x, z) || h < WL + .12) return null; const r = U.hash(i, j); return [lerp(160, 138, r), lerp(126, 108, r), lerp(88, 76, r), .88 * ss(FL + .02, FL - .06, h)]; });
  const ovHaz = layer((x, z, i, j) => { const hat = ((i + j) % 9) < 3 ? .2 : 0, d = debZone(x, z), s = slideZone(x, z);
    if (d > .3) return [220, 38, 38, .5 + hat]; if (s > .3) return [245, 140, 11, .55 + hat]; if (floodZone(x, z)) return [37, 99, 235, .42 + hat]; return null; });

  // 地震後才出現的地表破裂：斷層崖露出的土壤、斷掉的路面、兩側的裂縫
  const ovRup = layer((x, z, i, j) => { const fd = faultD(x); if (fd < .05) return null; const fs = faultS(x, z), m = ss(-.03, .1, fs), road = roadD(x, z) < .17, r = U.hash(i, j);
    if (m > .03 && m < .97) return road ? (r < .45 ? [58, 60, 66, 1] : [118, 96, 74, 1]) : [lerp(156, 122, r), lerp(116, 90, r), lerp(80, 62, r), 1];
    const w = Math.abs(fs - .03); if (w < .5 && Math.abs(fbm(x * 7 + 3, z * 7, 2) - .5) < .02 * (1 - w / .5)) return [46, 40, 36, road ? .95 : .7]; return null; }, true);
  // 水：河與淹水（水平面）、模型邊緣的水體、溪水（平常清澈；豪雨時又寬又濁）、滯洪池
  const wp = [], wi = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i; if (Math.min(H[a], H[a + 1], H[a + NX + 1], H[a + NX + 2]) > FL + .03) continue; const n = wp.length / 3, x = X0 + i * CELL, z = Z0 + j * CELL; wp.push(x, 0, z, x + CELL, 0, z, x, 0, z + CELL, x + CELL, 0, z + CELL); wi.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); wg.setIndex(wi);
  const water = new T.Mesh(wg, waterMat()); water.renderOrder = 4; water.frustumCulled = false; water.position.y = WL; root.add(water);
  const capMat = new T.MeshBasicMaterial({ color: 0x3f93b8, transparent: true, opacity: .85, side: T.DoubleSide, toneMapped: false }), caps = [];
  for (const [x, z0, z1] of [[X0 + .004, 2, Z1 - .2], [X1 - .004, .9, Z1 - .2]]) { const m = new T.Mesh(new T.PlaneGeometry(z1 - z0, 1).rotateY(Math.PI / 2), capMat); m.position.set(x, 0, (z0 + z1) / 2); root.add(m); caps.push(m); }
  const cS = []; for (let q = .2; q <= CRK.len - .5; q += .14) cS.push(q); for (const d of DAMS) cS.push(d + .19, d + .21); cS.sort((a, b) => a - b);
  const cPts = cS.map(q => atS(CRK, q)), cY = dy => (x, z, i) => { const t = damTop(cS[i]); return Math.max(hAt(x, z), t) + (t > 0 ? .03 : dy); };      // 水流過壩頂，在壩的下游面落下
  const creek = new T.Mesh(ribbon(cPts, .11, cY(.04)), flowMat(0, 1)), creekMud = new T.Mesh(ribbon(cPts, .3, cY(.16)), flowMat(1, 0));
  creek.renderOrder = 4; creekMud.renderOrder = 5; creek.frustumCulled = creekMud.frustumCulled = false; root.add(creek, creekMud);
  const pond = new T.Mesh(new T.CircleGeometry(.56, 28).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x4a93a8, roughness: .18, metalness: .1 })); pond.position.set(POND[0], .33, POND[1]); root.add(pond);

  /* ----- 建築與設施：用色塊拼出來，合併成一個網格 ----- */
  const kit = () => { const parts = [], put = (geo, hex, x, y, z, ry) => { if (ry) geo.rotateY(ry); geo.translate(x, y, z); parts.push([geo, hex]); };
    return { parts, put, bx: (w, h, d, hex, x, y, z, ry) => put(new T.BoxGeometry(w, h, d), hex, x, y + h / 2, z, ry), cy: (r0, r1, h, hex, x, y, z, seg = 10) => put(new T.CylinderGeometry(r0, r1, h, seg), hex, x, y + h / 2, z),
      roof: (w, h, d, hex, x, y, z) => { const s = new T.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath(); const g = new T.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); put(g, hex, x, y, z); },
      mesh: () => U.shadowed(new T.Mesh(U.merge(parts), new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }))) }; };
  const K = kit(), { bx, cy, put, roof } = K, GLASS = '#86c8ec';
  const gyMax = (x, z, a, b) => Math.max(hAt(x - a, z - b), hAt(x + a, z - b), hAt(x - a, z + b), hAt(x + a, z + b), hAt(x, z));
  const house = (x, z, k) => { const y = gyMax(x, z, .25, .21); bx(.54, .34, .46, '#b3afa6', x, y - .32, z); const q = U.hash(k, 4), wall = ['#f3ede0', '#efe2c6', '#e8dccb', '#f6eedd'][k % 4], rf = ['#b4513a', '#a8563c', '#7d6a5c', '#c06a45'][(q * 4) | 0];
    bx(.5, .38, .42, wall, x, y, z); roof(.58, .2, .52, rf, x, y + .38, z); for (const dx of [-.13, .13]) bx(.11, .12, .02, GLASS, x + dx, y + .17, z + .215); bx(.08, .18, .02, '#6b4a34', x, y + .04, z + .216); };
  const HOUSES = [[-1.5, -.5], [-1.05, .35], [-.35, -.25], [-.45, .75], [.35, .3], [.3, -.6], [-3.6, .25], [-3.45, .95], [-4.25, .6], [-4.35, -.15], [-9.3, 1.75], [-6.6, 1.8], [-7.9, 2.05], [-8.8, 2.25],
    [5.0, 2.0], [5.8, 2.2], [6.6, 2.0], [7.4, 2.3], [5.4, 2.7], [6.3, 2.75], [7.1, 2.7], [8.1, 2.1], [8.4, 2.65], [1.0, 1.95], [1.8, 2.0], [3.1, 1.75], [2.6, 2.4]];
  HOUSES.forEach((p, k) => house(p[0], p[1], k));
  // 避難收容處所：東邊的學校、西邊的活動中心（屋頂有綠色的避難標誌）
  const ye = hAt(SHE[0], SHE[1]) - .04; bx(2.0, .7, .62, '#efe2c6', SHE[0], ye, SHE[1]); bx(2.1, .06, .72, '#b0643f', SHE[0], ye + .7, SHE[1]);
  for (let k = 0; k < 5; k++) for (const y of [.12, .44]) bx(.24, .18, .02, GLASS, SHE[0] + (k - 2) * .38, ye + y, SHE[1] + .315);
  bx(.36, .24, .04, '#16a34a', SHE[0], ye + .78, SHE[1] + .2); cy(.012, .012, .8, '#d0d3d8', SHE[0] - .95, hAt(SHE[0] - .95, SHE[1] + .9), SHE[1] + .9, 6); bx(.2, .12, .01, '#d33a3a', SHE[0] - .84, hAt(SHE[0] - .95, SHE[1] + .9) + .66, SHE[1] + .9);
  const yw = hAt(SHW[0], SHW[1]) - .04; bx(1.0, .46, .6, '#e9e2d2', SHW[0], yw, SHW[1]); roof(1.1, .22, .7, '#5b6470', SHW[0], yw + .46, SHW[1]); bx(.3, .2, .04, '#16a34a', SHW[0], yw + .5, SHW[1] + .33); bx(.16, .24, .02, '#6b4a34', SHW[0], yw + .02, SHW[1] + .305);
  // 消防隊、衛生所
  const yf = hAt(1.25, .5) - .04; bx(.8, .44, .5, '#d8452f', 1.25, yf, .5); bx(.84, .05, .54, '#8a2a1c', 1.25, yf + .44, .5); for (const dx of [-.2, .2]) bx(.26, .28, .02, '#e9e9e9', 1.25 + dx, yf + .02, .755); bx(.1, .5, .1, '#d8452f', 1.72, yf, .35); bx(.14, .05, .14, '#f2f2f2', 1.72, yf + .5, .35);
  const yh = hAt(0, 2.2) - .04; bx(.66, .4, .46, '#f7f7f4', 0, yh, 2.2); bx(.7, .05, .5, '#9ab8c8', 0, yh + .4, 2.2); bx(.16, .05, .02, '#16a34a', 0, yh + .27, 2.435); bx(.05, .16, .02, '#16a34a', 0, yh + .215, 2.435);
  // 溪上的橋：橋面和兩端的路面一樣高，兩端有橋臺、中間有橋墩
  { const cx = -1.96, cz = 1.55, ry = .06, yr = Math.max(hAt(cx - .95, cz + .06), hAt(cx + .95, cz - .06)), yb = hAt(cx, cz);
    bx(1.9, .08, .46, '#b9b5ad', cx, yr - .07, cz, ry); for (const e of [-1, 1]) { bx(1.9, .09, .03, '#8f8b85', cx + Math.sin(ry) * e * .215, yr + .01, cz + Math.cos(ry) * e * .215, ry);
      const ax = cx + e * .66, ay = hAt(ax, cz) - .25; bx(.2, yr - .07 - ay, .5, '#a39f97', ax, ay, cz, ry); }
    bx(.12, yr - .07 - (yb - .15), .34, '#a39f97', cx, yb - .15, cz, ry); }
  // 攔砂壩：兩道橫跨溪谷的壩。兩側的翼牆嵌進山壁，中間的缺口比較低，水和土石從缺口溢過去
  const dams = DAMS.map(d => { const [x, z] = atS(CRK, d + .07), [x2, z2] = atS(CRK, d + .17), ry = Math.atan2(-(z2 - z), x2 - x) + Math.PI / 2, yf = bed0(d) + DAMH, y0 = bed0(d + .2) - .2, cx = Math.cos(ry), cz = -Math.sin(ry);
    bx(.5, yf - .015 - y0, .17, '#bdbab2', x, y0, z, ry); for (const e of [-1, 1]) bx(.62, yf + .16 - y0, .17, e > 0 ? '#b3b0a8' : '#aaa79f', x + cx * e * .56, y0, z + cz * e * .56, ry);
    return [x, yf + .16, z]; });
  /* 道路上邊坡的防護設施（由西到東）：明隧道 → 落石防護網 →（崩塌地）→ 格框植生護坡、擋土牆、防落石柵 → 石籠 */
  const beam = (a, b, th, hex) => { const d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(), g = new T.BoxGeometry(th, th, L + th * .6); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d.normalize())); put(g, hex, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); };
  const CON = '#cfccc4', CON2 = '#b3b0a8', FR = '#e6e3da', GRN = '#2f7d4a';
  // ① 明隧道：靠山的一側是牆，外側是一根根柱子，屋頂往外傾斜，落石從屋頂上滑過
  const SHED = [-10.9, -9.9], sxm = (SHED[0] + SHED[1]) / 2, sL = SHED[1] - SHED[0], szc = roadZ(sxm), syr = hAt(sxm, szc);
  bx(sL, .52, .08, CON2, sxm, syr - .02, szc - .31); bx(sL, .07, .1, CON2, sxm, syr + .44, szc + .31);
  for (let x = SHED[0] + .05; x <= SHED[1] + .001; x += .18) bx(.055, .46, .07, CON, x, syr - .02, szc + .31);
  for (const x of SHED) { bx(.09, .56, .09, CON2, x, syr - .02, szc + .31); bx(.09, .62, .1, CON2, x, syr - .02, szc - .31); }
  put(new T.BoxGeometry(sL + .12, .07, 1.16).rotateX(.2), CON, sxm, syr + .635, szc - .18); put(new T.BoxGeometry(sL + .12, .1, .09).rotateX(.2), CON2, sxm, syr + .56, szc + .4);
  for (let k = 0; k < 9; k++) { const u = U.hash(k, 71), v = U.hash(k, 72), dz = -.35 + v * .6; put(new T.IcosahedronGeometry(.035 + u * .035, 0), k % 2 ? '#7d766c' : '#948b7e', SHED[0] + .1 + u * (sL - .2), syr + .69 - dz * .2, szc - .06 + dz); }
  // ② 落石防護網：鋼索和錨樁（網子本身是另一個半透明的網格）
  const NET = [-9.8, -9.05];
  for (const z of [.9, .45, 0, -.45]) for (let x = NET[0]; x < NET[1] - .01; x += .25) beam([x, hAt(x, z) + .06, z], [x + .25, hAt(x + .25, z) + .06, z], .016, '#eef1f4');
  for (let x = NET[0]; x <= NET[1] + .01; x += .25) bx(.03, .12, .03, '#6b7078', x, hAt(x, -.5), -.5);
  // ③ 格框植生護坡：混凝土格框固定坡面；坡腳是有排水孔的擋土牆，牆頂有防落石柵
  const WKX = [-6.95, -6.0], NB = 4, wdx = (WKX[1] - WKX[0]) / NB;
  for (let c = 0; c <= NB; c++) { const x = WKX[0] + c * wdx; for (let z = .93; z > -.36; z -= .12) beam([x, hAt(x, z) + .015, z], [x, hAt(x, z - .12) + .015, z - .12], .04, FR); }
  for (let z = .69; z > -.5; z -= .24) for (let c = 0; c < NB; c++) { const x = WKX[0] + c * wdx; beam([x, hAt(x, z) + .015, z], [x + wdx, hAt(x + wdx, z) + .015, z], .04, FR); }
  const wallY = x => hAt(x, roadZ(x) - .1) - .02, fence = [];
  for (let x = WKX[0] - .05; x < WKX[1] + .04; x += .2) { const zw = roadZ(x + .1) - .29, y = wallY(x + .1); bx(.195, .36, .11, Math.round(x * 5) % 2 ? CON : '#c4c1b9', x + .1, y, zw); bx(.2, .03, .14, CON2, x + .1, y + .36, zw);
    bx(.03, .03, .02, '#33363c', x + .1, y + .12, zw + .056); bx(.028, .34, .028, GRN, x + .1, y + .39, zw); beam([x + .1, y + .73, zw], [x + .1, y + .8, zw - .07], .028, GRN); fence.push([x + .1, y + .39, zw]); }
  for (const dy of [.12, .3]) beam([fence[0][0], fence[0][1] + dy, fence[0][2] + .016], [fence[fence.length - 1][0], fence[fence.length - 1][1] + dy, fence[fence.length - 1][2] + .016], .012, '#f1f3f5');
  // 崩塌地邊緣歪斜的樹和電線桿（山崩的徵兆）
  for (const [x, z, a] of [[-8.95, -1.9, .5], [-7.6, -1.6, -.45], [-8.85, -.9, .4], [-7.45, -.7, -.5]]) { const y = hAt(x, z); put(new T.CylinderGeometry(.03, .045, .34, 5).translate(0, .17, 0).rotateZ(a), '#5a3d26', x, y - .02, z); put(new T.ConeGeometry(.17, .42, 7).translate(0, .5, 0).rotateZ(a), '#3a6b31', x, y - .02, z); }
  put(new T.CylinderGeometry(.018, .018, .7, 6).translate(0, .35, 0).rotateZ(.4), '#6b6f76', -7.2, hAt(-7.2, .75) - .02, .75);
  // 土石流警戒的告示牌與雨量筒
  const ys = hAt(-1.7, -1.0); bx(.03, .5, .03, '#6b6f76', -1.7, ys, -1.0); bx(.34, .22, .03, '#f2c21a', -1.7, ys + .42, -1.0); bx(.2, .05, .035, '#d8452f', -1.7, ys + .5, -1.0);
  // 山坡開墾地上的工寮
  const yd = hAt(DEV[0], DEV[1]); bx(.34, .2, .26, '#c9b79a', DEV[0], yd - .03, DEV[1]); bx(.4, .03, .32, '#7d8a94', DEV[0], yd + .17, DEV[1]);
  // 低窪聚落旁的抽水站
  const yp = hAt(8.6, 1.55) - .04; bx(.4, .3, .32, '#9fb4c2', 8.6, yp, 1.55); bx(.44, .04, .36, '#6b8494', 8.6, yp + .3, 1.55);
  // 有操場的學校（斷層從操場中間通過）
  const yc = hAt(6.5, -1.5) - .03; bx(1.6, .52, .46, '#e6dcc6', 6.5, yc, -1.5); bx(1.7, .05, .56, '#8a6a5a', 6.5, yc + .52, -1.5); for (let k = 0; k < 4; k++) for (const e of [-1, 1]) bx(.22, .17, .02, GLASS, 6.5 + (k - 1.5) * .38, yc + .2, -1.5 + e * .235);
  cy(.012, .012, .7, '#d0d3d8', 7.55, hAt(7.55, -1.5), -1.5, 6); bx(.18, .11, .01, '#2f6fb5', 7.65, hAt(7.55, -1.5) + .58, -1.5);
  root.add(K.mesh());
  // 落石防護網與防落石柵的網子（半透明的菱形網）、石籠（鐵絲籠裝石頭）
  const netTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = 'rgba(236,240,244,1)'; g.lineWidth = 3.2; for (let k = -64; k <= 64; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke(); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; })();
  { const nx = 10, nz = 16, np = [], nu = [], ni = []; for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = lerp(NET[0], NET[1], i / nx), z = lerp(.95, -.5, j / nz); np.push(x, hAt(x, z) + .055, z); nu.push(i / nx * 7, j / nz * 14); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; ni.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
    const ng = new T.BufferGeometry(); ng.setAttribute('position', new T.Float32BufferAttribute(np, 3)); ng.setAttribute('uv', new T.Float32BufferAttribute(nu, 2)); ng.setIndex(ni);
    root.add(new T.Mesh(ng, new T.MeshBasicMaterial({ map: netTex, transparent: true, alphaTest: .35, side: T.DoubleSide, color: 0xdfe5ea })));
    const f0 = fence[0], f1 = fence[fence.length - 1], ft = netTex.clone(); ft.needsUpdate = true; ft.repeat.set(9, 3); const fp = [f0[0], f0[1], f0[2], f1[0], f1[1], f1[2], f0[0], f0[1] + .36, f0[2], f1[0], f1[1] + .36, f1[2]];
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(fp, 3)); fg.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)); fg.setIndex([0, 1, 2, 2, 1, 3]);
    root.add(new T.Mesh(fg, new T.MeshBasicMaterial({ map: ft, transparent: true, alphaTest: .35, side: T.DoubleSide, color: 0x3fa860 }))); }
  { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = U.rng(5); g.fillStyle = '#6f6a62'; g.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 70; k++) { g.fillStyle = ['#a39c90', '#8d877c', '#b9b2a6', '#7d776d'][k % 4]; g.beginPath(); g.ellipse(gr() * 64, gr() * 64, 3 + gr() * 4, 2.5 + gr() * 3, gr() * 3, 0, 7); g.fill(); }
    g.strokeStyle = '#2f3237'; g.lineWidth = 1.2; for (let k = 0; k <= 64; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 64); g.moveTo(0, k); g.lineTo(64, k); g.stroke(); } g.lineWidth = 3; g.strokeRect(0, 0, 64, 64);
    const gt = new T.CanvasTexture(c); gt.colorSpace = T.SRGBColorSpace; const gab = new T.InstancedMesh(new T.BoxGeometry(.235, .2, .2), new T.MeshStandardMaterial({ map: gt, roughness: 1 }), 9); let n = 0; Q.identity();
    for (let t = 0; t < 3; t++) for (let k = 0; k < 3; k++) { const x = -5.82 + k * .24, zw = roadZ(x) - .3 - t * .15; M4.compose(V.set(x, hAt(x, roadZ(x) - .1) + .1 + t * .2, zw), Q, SC3.set(1, 1, 1)); gab.setMatrixAt(n++, M4); }
    U.shadowed(gab); root.add(gab); }
  // 被斷層抬高的那一塊上面的東西（地震時跟著地面一起動）
  const KU = kit(), yb = hAt(8.3, -4.1) - .04; KU.bx(.5, .34, .4, '#e8dccb', 8.3, yb, -4.1); KU.roof(.58, .2, .5, '#a8563c', 8.3, yb + .34, -4.1); KU.bx(.3, .22, .3, '#c9b79a', 6.2, hAt(6.2, -4.9) - .04, -4.9);
  upG.add(KU.mesh());

  // 樹：山上的森林（崩塌地、溪谷、開墾地沒有樹），平地零星的樹
  const tr = U.rng(23), trees = [], upTrees = [], NTR = G.coarse ? 340 : 540;
  for (let k = 0; k < 12000 && trees.length + upTrees.length < NTR; k++) { const x = X0 + .25 + tr() * (X1 - X0 - .5), z = Z0 + .25 + tr() * 9.2, hill = hillOf(x, z);
    if (hill < .45 || scarN(x, z) < 1.3 || Math.hypot(x - TOE[0], z - TOE[1]) < 1.0 || nearD(x, z, CRK) < .42 || Math.hypot(x - DEV[0], z - DEV[1]) < DEV[2] + .1 || roadD(x, z) < .4 || (z > -.55 && x < -5)) continue;
    (uplift(x, z) > .2 ? upTrees : trees).push([x, hAt(x, z), z, .8 + tr() * .7, tr() < .55 ? 0 : 1]); }
  for (const [x, z, k] of [[-.9, 1.05, 1], [.9, -.2, 1], [-2.9, .6, 1], [-4.9, .3, 1], [3.6, 1.6, 1], [1.4, 2.6, 1], [-6.5, 2.6, 1], [-4.6, 2.6, 1], [-9.9, 2.4, 1], [-3.3, 2.5, 1], [4.4, 2.3, 1], [9.0, 1.4, 1], [3.7, -1.9, 1], [1.1, -2.2, 1], [1.3, -1.0, 0], [3.5, -.9, 0], [10.3, .95, 1], [-10.3, 1.9, 1], [-.2, 3.0, 1], [2.2, 3.1, 1], [-6.9, 6.6, 1], [-2.5, 6.8, 1], [3.5, 6.7, 1], [8.5, 6.6, 1], [5.9, 6.75, 1], [-9.6, 6.7, 1], [.6, 6.8, 1]]) trees.push([x, hAt(x, z), z, .9 + tr() * .5, k]);
  for (const [x, z] of [[6.0, -3.9], [9.9, -3.6], [10.4, -5.4], [7.2, -5.2], [5.4, -5.6]]) upTrees.push([x, hAt(x, z), z, .9 + tr() * .5, 1]);
  U.plantTrees(root, trees, tr, .62); U.plantTrees(upG, upTrees, tr, .62);

  // 晴天的雲
  const fair = [[-3, 10.4, -4.6, 3.2], [6.5, 10.9, -2.5, 2.7]].map((c, k) => { const cl = U.cloud(c[3], c[3] * .42, c[3] * .6, 7, rnd); cl.position.set(c[0], c[1], c[2]); scene.add(cl); anim.push(t => { cl.position.x = c[0] + Math.sin(t * .05 + k * 2) * 1.4; }); return cl; });

  /* ----- 豪雨：烏雲、雨、山崩的落石、土石流、暴漲的溪水 ----- */
  const storms = [[-7, 8.6, -2.5, 6.5], [-.5, 9.0, -4, 6.8], [6.5, 8.7, -1, 6.6], [1, 8.4, 3.5, 6.2]].map(c => { const cl = U.cloud(c[3], 1.5, c[3] * .6, 9, rnd); cl.traverse(o => { if (o.isMesh) { o.castShadow = false; o.material.color.set(0x7c858f); o.material.emissiveIntensity = .03; } }); cl.position.set(c[0], c[1], c[2]); cl.visible = false; scene.add(cl); return cl; });
  const NR = G.coarse ? 150 : 280, rain = new T.InstancedMesh(new T.BoxGeometry(.012, .3, .012), new T.MeshBasicMaterial({ color: 0xd6e8f7, transparent: true, opacity: .7, depthWrite: false }), NR), drops = Array.from({ length: NR }, () => [X0 + rnd() * 22, Z0 + rnd() * 14, rnd(), .8 + rnd() * .5]); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const rockMat = new T.MeshStandardMaterial({ color: 0x86684a, roughness: 1, flatShading: true }), rockGeo = new T.IcosahedronGeometry(1, 0);
  const NS = 22, slideRocks = new T.InstancedMesh(rockGeo, rockMat, NS), sq = Array.from({ length: NS }, () => [rnd(), (rnd() - .5) * .5, .04 + rnd() * .05, rnd() * 6]);
  const ND = 46, debris = new T.InstancedMesh(rockGeo, new T.MeshStandardMaterial({ color: 0x6f6156, roughness: 1, flatShading: true }), ND), dq = Array.from({ length: ND }, () => [rnd(), rnd() - .5, .04 + rnd() * .075, rnd() * 6]);
  // 豪雨時道路上邊坡的落石：從明隧道的屋頂滑過、被防護網壓在岩壁上、被防落石柵攔下
  const NW = 26, wRocks = new T.InstancedMesh(rockGeo, new T.MeshStandardMaterial({ color: 0x7d766c, roughness: 1, flatShading: true }), NW), wq = Array.from({ length: NW }, (_, k) => [rnd(), rnd(), .04 + rnd() * .03, rnd() * 6, k < 11 ? 0 : k < 19 ? 1 : 2]);
  const roofY = z => syr + .67 - (z - (szc - .18)) * .203;
  for (const m of [slideRocks, debris, wRocks]) { m.castShadow = true; m.frustumCulled = false; m.visible = false; root.add(m); }
  let rainOn = false, kr = 0, kf = 0, wet = 0, deb = 0, level = WL;
  const fogA = new T.Color(0xe8eee8), fogB = new T.Color(0x9aa3aa);
  const stormStep = (t, dt) => {
    kr += ((rainOn ? 1 : 0) - kr) * Math.min(1, dt * 1.3); kf += ((rainOn ? 1 : 0) - kf) * Math.min(1, dt * (rainOn ? .28 : .4));
    if (kf > .85) wet = 1; else if (!rainOn && kf < .04) wet = Math.max(0, wet - dt / 50);
    if (rainOn) deb = Math.min(1, deb + dt * .09 * kr); else if (kr < .04) deb = Math.max(0, deb - dt / 50);
    level = lerp(WL, FL, kf); water.position.y = level; water.material.uniforms.uMud.value = Math.max(kr, kf); water.material.uniforms.uPh.value += dt * lerp(.5, 1.6, Math.max(kr, kf)); capMat.color.setRGB(lerp(.25, .6, kf), lerp(.58, .43, kf), lerp(.72, .25, kf), T.SRGBColorSpace);
    for (const c of caps) { c.scale.y = level + 1.2; c.position.y = (level - 1.2) / 2; }
    creekMud.material.uniforms.uA.value = kr; creekMud.visible = kr > .02; setLayer(ovSilt, wet * ss(.8, .25, kf)); setLayer(ovDeb, deb);
    sun.intensity = lerp(2.6, .85, kr); if (hemi) hemi.intensity = lerp(1.35, .95, kr); scene.background = kr > .5 ? skyB : skyA; scene.fog.color.copy(fogA).lerp(fogB, kr);
    const on = kr > .03; rain.visible = slideRocks.visible = debris.visible = wRocks.visible = on; for (const c of storms) { c.visible = on; c.scale.setScalar(Math.max(.01, kr)); } for (const c of fair) c.visible = kr < .6;
    if (!on) return;
    Q.identity(); drops.forEach((d, k) => { const u = (t * 1.1 * d[3] + d[2]) % 1, y = 8 - u * 8.4, gh = Math.max(hAt(d[0], d[1]), level); M4.compose(V.set(d[0] + u * .2, y, d[1]), Q, SC3.setScalar(y > gh ? kr : .001)); rain.setMatrixAt(k, M4); }); rain.instanceMatrix.needsUpdate = true;
    sq.forEach((d, k) => { const u = (t * .2 + d[0]) % 1, [x0, z0] = atS(SC, u * u * SC.len * 1.25), x = x0 + d[1] * (.5 + u), z = z0 + u * .35, s = d[2] * kr * ss(0, .08, u) * ss(1, .9, u);
      E3.set(u * 34 + d[3], d[3], u * 25); Q.setFromEuler(E3); M4.compose(V.set(x, hAt(x, z) + d[2] * .7 + .12 * Math.abs(Math.sin(u * 30 + d[3])), z), Q, SC3.set(s, s * .8, s)); slideRocks.setMatrixAt(k, M4); }); slideRocks.instanceMatrix.needsUpdate = true;
    dq.forEach((d, k) => { const u = (t * .12 + d[0]) % 1, s0 = lerp(1.2, SM + 3.1, u), [x0, z0] = atS(CRK, s0), [x1, z1] = atS(CRK, s0 + .15), L = Math.hypot(x1 - x0, z1 - z0) || 1, off = d[1] * (s0 < SM ? .3 : .3 + (s0 - SM) * .5), x = x0 - (z1 - z0) / L * off, z = z0 + (x1 - x0) / L * off, s = d[2] * kr * ss(0, .06, u) * ss(1, .9, u);
      E3.set(u * 40 + d[3], d[3], u * 28); Q.setFromEuler(E3); M4.compose(V.set(x, Math.max(hAt(x, z), damTop(s0)) + .16 + d[2] * .5, z), Q, SC3.set(s, s * .8, s)); debris.setMatrixAt(k, M4); }); debris.instanceMatrix.needsUpdate = true;
    wq.forEach((d, k) => { const u = (t * (d[4] ? .09 : .14) + d[0]) % 1; let x, y, z, s = d[2] * kr * ss(0, .06, u) * ss(1, .93, u);
      if (d[4] === 0) { x = SHED[0] + .1 + d[1] * (sL - .2); z = lerp(szc - 1.5, szc + .78, u); const g = hAt(x, z), e = szc + .39; y = (z < szc - .75 ? g : z < e ? Math.max(g, roofY(z)) : Math.max(g, roofY(e) - 4.5 * (z - e) * (z - e))) + d[2] * .7; }      // 滑過屋頂，從外側掉下去
      else if (d[4] === 1) { x = NET[0] + .06 + d[1] * (NET[1] - NET[0] - .12); z = lerp(-.5, .86, u * u); y = hAt(x, z) + .02; s *= .8; }                                  // 被網子壓著，貼著岩壁慢慢滑到坡腳
      else { x = WKX[0] + .05 + d[1] * (WKX[1] - WKX[0] - .1); z = lerp(-.6, roadZ(x) - .42, Math.min(1, u * 1.25)); y = hAt(x, z) + d[2] * .7 + (u < .8 ? .05 * Math.abs(Math.sin(u * 40 + d[3])) : 0); }      // 滾到牆後，被柵欄攔住
      E3.set(u * 30 + d[3], d[3], u * 20); Q.setFromEuler(E3); M4.compose(V.set(x, y, z), Q, SC3.set(s, s * .8, s)); wRocks.setMatrixAt(k, M4); }); wRocks.instanceMatrix.needsUpdate = true;
  };

  /* ----- 疏散避難：沿著避難路線往避難收容處所移動的綠色箭頭 ----- */
  const ROUTES = [mkLine([[-.9, .45], [-.3, 1.3], [1, 1.25], [2.4, 1.2], [2.4, -.85]]), mkLine([[6.4, 2.45], [5.3, 1.5], [4.5, .75], [3.4, -.1], [2.95, -1.0]]), mkLine([[-3.8, .5], [-4.5, 1.3], [-5.6, 1.35], [-5.6, 1.85]]), mkLine([[-8.2, 1.75], [-7.4, 1.25], [-5.6, 1.35], [-5.6, 1.85]])];
  const ash = new T.Shape(); ash.moveTo(.13, 0); ash.lineTo(-.07, .11); ash.lineTo(-.02, 0); ash.lineTo(-.07, -.11); ash.closePath();
  const arrows = []; ROUTES.forEach(R => { const n = Math.max(3, Math.round(R.len / .55)); for (let k = 0; k < n; k++) arrows.push([R, k / n]); });
  const arr = new T.InstancedMesh(new T.ShapeGeometry(ash).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x16e06a, toneMapped: false, side: T.DoubleSide, transparent: true, depthTest: false }), arrows.length); arr.frustumCulled = false; arr.visible = false; arr.renderOrder = 6; root.add(arr);
  const arrowStep = t => { arrows.forEach(([R, o], k) => { const u = (t * .16 / R.len * 3 + o) % 1, [x, z] = atS(R, u * R.len), [x2, z2] = atS(R, u * R.len + .08), s = 1.25 * ss(0, .08, u) * ss(1, .92, u);
    Q.setFromAxisAngle(UP, Math.atan2(-(z2 - z), x2 - x)); M4.compose(V.set(x, hAt(x, z) + .1, z), Q, SC3.setScalar(Math.max(.001, s))); arr.setMatrixAt(k, M4); }); arr.instanceMatrix.needsUpdate = true; };

  /* ----- 晴天／豪雨的切換鈕 ----- */
  const wx = document.createElement('div'); wx.id = 'hazWx'; wx.className = 'glass'; wx.innerHTML = '<button data-r="0" class="on">☀️ 晴天</button><button data-r="1">🌧️ 豪雨</button><button data-a="quake">📳 地震</button><button data-a="reset" class="rs">↺ 復原</button>'; document.getElementById('app').appendChild(wx);
  const setRain = on => { rainOn = on; wx.querySelectorAll('button[data-r]').forEach(b => b.classList.toggle('on', (b.dataset.r === '1') === on)); };
  let qt = -1, quaked = false;
  const reset = () => { setRain(false); kr = kf = wet = deb = 0; qt = -1; quaked = false; G.toast('已復原：晴天、地震前的樣子'); };      // 回到一開始的樣子，每個現象都可以重看
  wx.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'quake') qt = 0; else if (b.dataset.a === 'reset') reset(); else setRain(b.dataset.r === '1'); });

  // 東側剖面上的兩個箭頭：斷層兩側的岩層沿著斷層面，往相反的方向錯動
  const aSh = new T.Shape(); [[-.07, -.42], [.07, -.42], [.07, .12], [.19, .12], [0, .44], [-.19, .12], [-.07, .12]].forEach((q, i) => i ? aSh.lineTo(q[0], q[1]) : aSh.moveTo(q[0], q[1]));
  const aMat = new T.MeshBasicMaterial({ color: 0xffe14a, toneMapped: false, side: T.DoubleSide }), mkA = flip => new T.Mesh(new T.ShapeGeometry(aSh).rotateZ(Math.atan(DIP) + (flip ? Math.PI : 0)).rotateY(Math.PI / 2), aMat);
  const yE = natural(X1, FZ), pd = 1.75, nn = Math.hypot(1, DIP), aH = mkA(false), aF = mkA(true);
  aH.position.set(X1 + .03, yE - pd + .5 * DIP / nn, FZ - pd * DIP - .5 / nn); upG.add(aH); aF.position.set(X1 + .03, yE - pd - .5 * DIP / nn, FZ - pd * DIP + .5 / nn); root.add(aF);

  /* 節點圓點與解說標籤 */
  const zn = G.zones.hazard, def = G.zoneDef('hazard'), dots = {}, tags = {};
  for (const n of zn.nodes) dots[n.id] = G.addLabel(`<b>${n.num}</b><span>${n.title}</span>`, 'node' + (n.ready ? '' : ' soon'), n.at, { color: n.color || def.color, onClick: () => G.openNode(n.id) });
  const tag = (node, x, z, dy, html) => { const L = G.addLabel(html, 'tag', [x, hAt(x, z) + dy, z]); (tags[node] = tags[node] || []).push(L); return L; };
  tag('slide', -8.3, -1.4, .9, '山崩<small>山坡上的土石突然崩落</small>'); tag('slide', -8.9, -2.5, .75, '徵兆<small>樹木歪斜、山坡出現裂縫</small>'); tag('slide', -7.6, .75, .55, '崩落的土石<small>堆在坡腳，掩埋道路</small>');
  tag('slide', -3.6, -3.6, 1.5, '土石流<small>豪雨時，土石和水沿著溪谷衝下來</small>'); tag('slide', -1.9, .2, .95, '谷口的聚落<small>土石流衝出谷口後散開、堆積</small>');
  tag('flood', 1.6, 4.75, .8, '溪水暴漲<small>水變多、變急、變混濁</small>'); tag('flood', 6.6, 2.1, 1.05, '低窪的聚落<small>地勢低，河水漫過來就淹水</small>'); tag('flood', 5.5, 6.05, .5, '堤防<small>擋住河水，保護這一側</small>'); tag('flood', -4.4, 3.35, .5, '河岸<small>被急流沖刷、掏空</small>');
  const siltTag = tag('flood', 7.6, 3.0, .45, '');
  tag('quake', 11, -3.2, -1.25, '斷層<small>岩層斷裂、錯開的面</small>'); tag('quake', 11, -5.3, -2.3, '後方這一塊<small>沿著斷層面被推上來</small>'); tag('quake', TRACK[0] - .5, TRACK[1] - .1, .95, '操場的跑道<small>被抬高、斷成兩截</small>'); tag('quake', 9.3, -2.6, .6, '路面斷裂，出現落差'); tag('quake', 8.3, -4.6, 1.0, '被抬高的這一側');
  const quakeTag = tag('quake', 7.2, -.6, 1.6, '');
  tag('evac', SHE[0], SHE[1], 1.55, '避難收容處所（學校）<small>地勢較高，遠離溪流和陡坡</small>'); tag('evac', SHW[0], SHW[1], 1.15, '避難收容處所（活動中心）'); tag('evac', .9, 1.3, .5, '避難路線<small>跟著綠色箭頭走</small>');
  tag('evac', -2.3, -.4, .6, '紅色：土石流可能影響的範圍'); tag('evac', -8.1, -1.0, .6, '橘色：可能山崩的範圍'); tag('evac', 7.6, 3.2, .5, '藍色：容易淹水的範圍'); tag('evac', 1.25, .5, .85, '消防隊'); tag('evac', 0, 2.2, .75, '衛生所');
  tag('guard', -6.0, -5.2, 1.3, '森林<small>樹根抓住土石，枝葉擋住雨水</small>'); tag('guard', DEV[0], DEV[1], .75, '開墾的山坡<small>樹木被砍掉，土石容易被沖走</small>'); tag('guard', dams[1][0], dams[1][2], .75, '攔砂壩<small>攔住土石；水從壩頂的缺口溢流</small>');
  tag('guard', sxm, szc, 1.25, '明隧道<small>落石從屋頂上滑過，保護人車</small>'); tag('guard', -9.4, .1, .75, '落石防護網<small>罩住岩壁，落石不會彈到路上</small>'); tag('guard', -6.5, -.15, .8, '格框植生護坡<small>格框固定坡面，格子裡種草</small>'); tag('guard', -6.5, 1.0, .25, '擋土牆和防落石柵'); tag('guard', -5.55, 1.0, .95, '石籠<small>鐵絲籠裝滿石頭，會透水</small>'); tag('guard', -3.5, 6.2, .55, '堤防'); tag('guard', POND[0], POND[1], .6, '滯洪池<small>大雨時暫時存水</small>'); tag('guard', 8.6, 1.55, .7, '抽水站');

  /* 點模型：點到哪一種地方，就開對應的節點 */
  const hitAt = rr => { if (!rr) return null; const o = rr.ray.origin, d = rr.ray.direction; for (let t = 2; t < 110; t += .12) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < YB) break; if (x < X0 || x > X1 || z < Z0 || z > Z1) continue; if (y < hAt(x, z)) return [x, z]; } return null; };
  const areaAt = p => { if (!p) return null; const [x, z] = p;
    if (Math.hypot(x - SHE[0], z - SHE[1]) < 1.1 || Math.hypot(x - SHW[0], z - SHW[1]) < .8) return 'evac';
    if ((x > 5.4 && Math.abs(faultS(x, z)) < .4) || Math.hypot((x - TRACK[0]) / TRACK[2], (z - TRACK[1]) / TRACK[3]) < 1.1) return 'quake';
    if (Math.hypot(x - DEV[0], z - DEV[1]) < DEV[2] || Math.hypot(x - POND[0], z - POND[1]) < .7) return 'guard';
    if (slideZone(x, z) > .3 || debZone(x, z) > .3) return 'slide';
    return floodZone(x, z) ? 'flood' : null; };
  let cur = null, hot = null;
  return {
    scene, home: { pos: [0, 12.5, 23.5], target: [0, .6, 0] },
    view: { minDist: 3, maxDist: 60, maxPolar: Math.PI * .49, pan: { x: [X0, X1], y: [YB, 5], z: [Z0, Z1] } },
    onNode: id => { if (id === 'quake' && cur !== 'quake') qt = 0; if (id === 'slide' || id === 'flood') setRain(true); else if (id) setRain(false); cur = id; arr.visible = id === 'evac';
      for (const k in tags) tags[k].forEach(L => L.el.classList.toggle('show', k === id)); for (const k in dots) dots[k].el.classList.toggle('cur', k === id); },
    onHover: rr => { const n = areaAt(hitAt(rr)); if (n !== hot) { hot = n; G.canvas.style.cursor = n ? 'pointer' : ''; } },
    onTap: rr => { const a = areaAt(hitAt(rr)); if (a && a !== G.state.nodeId) G.openNode(a); },
    update(dt, t) {
      stormStep(t, dt);
      const ks = cur === 'flood' ? (kf > .85 ? '河水漫進低窪的聚落（切回晴天，看水退後留下什麼）' : !rainOn && wet > .5 && kf < .3 ? '水退了，留下一層厚厚的泥沙' : '') : ''; if (siltTag.el.textContent !== ks) siltTag.el.textContent = ks; siltTag.el.style.visibility = ks ? '' : 'hidden';
      let up = quaked ? 1 : 0, a = 0, qs = quaked ? '③ 地表隆起、斷裂（按「地震」重看，按「復原」回到地震前）' : '';
      if (qt >= 0) { qt += dt; up = ss(1.6, 5.6, qt); a = .032 * ss(1.4, 2.0, qt) * ss(6.3, 5.2, qt); qs = qt < 1.6 ? '① 地震前：地面是平的，地層連續' : '② 地震！岩層沿著斷層面錯動'; if (qt > 6.5) { qt = -1; quaked = true; } }
      uUp.value = up; upG.position.set(0, -(1 - up) * .42, -(1 - up) * .42 * DIP); root.position.set(Math.sin(t * 47) * a, 0, Math.cos(t * 39) * a * .7); setLayer(ovRup, up); aH.visible = aF.visible = cur === 'quake' || qt >= 0;
      if (quakeTag.el.textContent !== qs) quakeTag.el.textContent = qs; quakeTag.el.style.visibility = qs ? '' : 'hidden';
      const ha = ovHaz.material.opacity + ((cur === 'evac' ? 1 : 0) - ovHaz.material.opacity) * Math.min(1, dt * 3); setLayer(ovHaz, ha); if (arr.visible) arrowStep(t);
      for (const f of anim) f(t, dt);
    },
    dispose() { G.canvas.style.cursor = ''; wx.remove(); skyA.dispose(); skyB.dispose(); U.dispose(scene); }
  };
}

/* 本區用的小樣式 */
(function hazCSS() {
  if (document.getElementById('hazCss')) return; const st = document.createElement('style'); st.id = 'hazCss';
  st.textContent = `#hazWx{position:absolute;left:14px;top:96px;z-index:10;display:flex;gap:4px;padding:5px;border-radius:999px}
    #hazWx button{border:0;background:transparent;border-radius:999px;padding:6px 13px;font-weight:900;font-size:14.5px;white-space:nowrap} #hazWx button.on{background:#be123c;color:#fff} #hazWx button[data-a]{border-left:1px solid var(--line);border-radius:0;padding:6px 11px} #hazWx button.rs{border-radius:0 999px 999px 0;color:#0369a1} #hazWx button[data-a]:active{background:#e2e8f0}
    .lb.node.cur{opacity:0;pointer-events:none}
    .rcard .pic svg.hfull{width:100%;height:100%;filter:none;display:block}
    .hfig{margin:6px 0 10px} .hfig svg{width:100%;height:auto;display:block;border-radius:12px;border:1px solid var(--line);background:#fff}
    ul.hlist{list-style:none;padding:0;margin:8px 0;display:grid;gap:6px} ul.hlist li{background:#fff;border:1px solid var(--line);border-left:4px solid var(--c,#be123c);border-radius:10px;padding:7px 10px;font-size:15px;line-height:1.6} ul.hlist b{display:block}
    table.htab{width:100%;border-collapse:separate;border-spacing:0;margin:8px 0 10px;font-size:14.5px;line-height:1.5;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
    table.htab th,table.htab td{padding:6px 8px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:left;vertical-align:middle} table.htab tr:last-child>*{border-bottom:0} table.htab tr>*:last-child{border-right:0}
    table.htab th{background:#fff1f2;color:#9f1239;font-weight:900;white-space:nowrap} table.htab td:first-child{font-weight:900;white-space:nowrap}
    .hleg{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0} .hleg div{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px 8px;font-size:14.5px;font-weight:800;line-height:1.35} .hleg svg{flex:none;width:34px;height:34px}
    details.rext{border:2px dashed #94a3b8;border-radius:12px;padding:8px 12px;margin:12px 0;background:#f8fafc} details.rext summary{font-weight:900;color:#475569;cursor:pointer} details.rext[open] summary{margin-bottom:6px}
    .hsel{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0;font-weight:900} .hsel button{border:2px solid var(--line);background:#fff;border-radius:999px;padding:6px 14px;font-weight:900} .hsel button.on{border-color:var(--accent);background:#fff7e6}
    @media (max-width:760px){#hazWx{top:auto;bottom:70px}}`;
  document.head.appendChild(st);
})();

/* ---------- 圖鑑與認識頁的繪圖（SVG）：沒有實景照片時顯示 ---------- */
const f1 = n => n.toFixed(1);
const lab = (x, y, s, c = '#1f3345') => { const w = s.length * 12.5 + 12; return `<rect x="${f1(x - w / 2)}" y="${y - 14}" width="${f1(w)}" height="19" rx="6" fill="rgba(255,255,255,.93)"/><text x="${x}" y="${y}" font-size="12.5" font-weight="900" text-anchor="middle" fill="${c}">${s}</text>`; };
const arrow = (x0, y0, x1, y1, c = '#b45309') => `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><path d="M3 0L-8 -6L-8 6Z" fill="${c}" transform="translate(${x1} ${y1}) rotate(${f1(Math.atan2(y1 - y0, x1 - x0) * 57.3)})"/>`;
const tree = (x, y, s = 1, c = '#4f8a36', a = 0) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="${f1(-1.5 * s)}" y="${f1(-8 * s)}" width="${f1(3 * s)}" height="${f1(8 * s)}" fill="#6b4a34"/><circle cy="${f1(-13 * s)}" r="${f1(8 * s)}" fill="${c}"/></g>`;
const hs = (x, y, w, h, wall = '#f3ede0', rf = '#b4513a') => `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${wall}"/><path d="M${x - 4} ${y - h}L${x + w / 2} ${f1(y - h * 1.6)}L${x + w + 4} ${y - h}Z" fill="${rf}"/><rect x="${f1(x + w * .38)}" y="${f1(y - h * .55)}" width="${f1(w * .24)}" height="${f1(h * .55)}" fill="#6b4a34"/>`;
const rainS = (r, n, x, y, w, h, c = '#7aa7d9') => { let o = ''; for (let i = 0; i < n; i++) { const px = x + r() * w, py = y + r() * h; o += `<path d="M${f1(px)} ${f1(py)}l-3 9" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`; } return o; };
const rocks = (r, n, x, y, w, h, s = 4, cs = ['#8f8b85', '#6f6b65', '#a39f97']) => { let o = ''; for (let i = 0; i < n; i++) o += `<circle cx="${f1(x + r() * w)}" cy="${f1(y + r() * h)}" r="${f1(s * (.5 + r() * .8))}" fill="${cs[i % cs.length]}"/>`; return o; };
const num = (x, y, n) => `<circle cx="${x}" cy="${y}" r="9" fill="#b91c1c"/><text x="${x}" y="${y + 4.5}" font-size="12.5" font-weight="900" text-anchor="middle" fill="#fff">${n}</text>`;
const txt = (x, y, s, c = '#fff', a = 'middle', z = 11.5) => `<text x="${x}" y="${y}" font-size="${z}" font-weight="800" text-anchor="${a}" fill="${c}">${s}</text>`;
const RAINY = '#dbe5ee', SKY = '#dceefb', SOIL = '#a98a66';
const HILL = 'M0 180V146H60L250 36L320 30V180Z', HTOP = 'M0 146H60L250 36L320 30';
function hSVG(kind) {
  const r = U.rng(kind.length * 37 + kind.charCodeAt(0) * 11), id = 'hz_' + kind; let o = '', bg = SKY;
  if (kind === 'slide') { bg = RAINY;
    o = rainS(r, 24, 0, 0, 320, 56) + `<path d="${HILL}" fill="${SOIL}"/><path d="${HTOP}" fill="none" stroke="#4f8a36" stroke-width="7"/><path d="M228 44L104 116L114 132L228 68Z" fill="#7d5c3c"/><path d="M234 48Q176 104 102 130" fill="none" stroke="#b91c1c" stroke-width="2" stroke-dasharray="6 4"/>
      ${tree(270, 30, 1)}${tree(296, 28, .9)}${tree(246, 38, .9, '#4f8a36', -30)}${hs(20, 146, 30, 20)}<path d="M30 146Q58 108 104 114Q130 120 140 146Z" fill="#8a6846"/>${rocks(r, 14, 46, 122, 76, 20, 4)}${arrow(196, 50, 142, 81, '#b91c1c')}
      ${lab(232, 118, '土石、岩塊突然崩落', '#b91c1c')}${lab(92, 170, '崩落的土石堆在坡腳')}`; }
  if (kind === 'debris') { bg = RAINY;
    o = rainS(r, 22, 120, 0, 200, 40) + `<path d="M0 180V26Q120 52 204 136L320 148V180Z" fill="#6f9460"/><path d="M8 36Q116 60 198 132L246 141" fill="none" stroke="#7a5a3c" stroke-width="21" stroke-linecap="round"/>`;
    [[40, 44, 6], [72, 54, 8], [102, 70, 5], [128, 84, 9], [152, 101, 6], [172, 116, 8], [192, 129, 5], [216, 136, 9], [240, 140, 6]].forEach((q, k) => { o += `<circle cx="${q[0]}" cy="${q[1]}" r="${q[2]}" fill="${k % 2 ? '#8f8b85' : '#6f6b65'}"/>`; });
    o += `${arrow(118, 46, 180, 90, '#b91c1c')}${hs(264, 147, 24, 17)}${hs(294, 149, 22, 16, '#efe2c6', '#a8563c')}${lab(226, 26, '土石和水混在一起')}${lab(232, 50, '沿著溪谷快速往下衝', '#b91c1c')}`; }
  if (kind === 'fan') { bg = '#cfe0b8';
    o = `<path d="M0 0H146Q152 44 124 80Q60 70 0 90Z" fill="#4f8a4a"/><path d="M320 0H174Q168 44 196 80Q260 70 320 90Z" fill="#4f8a4a"/><path d="M160 0V70" stroke="#7a5a3c" stroke-width="12"/>
      <rect x="126" y="112" width="18" height="13" fill="#b4513a" stroke="#fff" stroke-width="1.5"/><rect x="180" y="126" width="18" height="13" fill="#a8563c" stroke="#fff" stroke-width="1.5"/>
      <path d="M160 62Q100 110 70 156Q160 180 250 156Q220 110 160 62Z" fill="#a58763" fill-opacity=".93"/>`;
    for (let i = 0; i < 46; i++) { const a = (r() - .5) * 1.05, d = 14 + r() * 84; o += `<circle cx="${f1(160 + Math.sin(a) * d * .95)}" cy="${f1(64 + Math.cos(a) * d)}" r="${f1(1.5 + r() * 3.4)}" fill="${['#8f8b85', '#6f6b65', '#7d5c3c'][i % 3]}"/>`; }
    for (const [x, y] of [[36, 118], [58, 142], [270, 122], [288, 146], [22, 150]]) o += `<rect x="${x}" y="${y}" width="18" height="13" fill="#b4513a" stroke="#fff" stroke-width="1.5"/>`;
    o += `<path d="M160 68Q140 110 106 148M160 68V162M160 68Q180 110 214 148" stroke="#5d4129" stroke-width="2" fill="none" stroke-dasharray="5 4"/>${lab(62, 30, '山')}${lab(258, 30, '山')}${lab(160, 48, '谷口')}${lab(160, 174, '土石散開、堆積成扇形')}`; }
  if (kind === 'signs') {
    o = `<path d="${HILL}" fill="${SOIL}"/><path d="${HTOP}" fill="none" stroke="#4f8a36" stroke-width="7"/><path d="M240 46l6 7l-5 6l7 7M258 36l5 8l-6 5l6 8" stroke="#3b2a1c" stroke-width="2.5" fill="none"/>
      ${tree(200, 65, 1, '#4f8a36', -30)}${tree(290, 30, .9)}<path d="M120 111l-14 -32M99 85l14 -6" stroke="#555b64" stroke-width="3.5" stroke-linecap="round"/><path d="M172 83L134 105" stroke="#8a5a2c" stroke-width="4.5" stroke-linecap="round"/>
      ${rocks(r, 9, 58, 134, 36, 9, 3)}<circle cx="100" cy="118" r="3" fill="#6f6b65"/><circle cx="88" cy="126" r="2.4" fill="#8f8b85"/>
      ${num(250, 20, 1)}${num(176, 36, 2)}${num(96, 68, 2)}${num(52, 122, 3)}${num(148, 76, 4)}
      ${txt(190, 114, '① 山坡出現裂縫', '#fff', 'start')}${txt(190, 131, '② 樹木、電線桿歪斜', '#fff', 'start')}${txt(190, 148, '③ 小石頭不斷掉落', '#fff', 'start')}${txt(190, 165, '④ 山坡冒出混濁的水', '#fff', 'start')}`; }
  if (kind === 'flood') { bg = RAINY;
    o = rainS(r, 24, 0, 0, 320, 44) + `<rect x="66" y="84" width="190" height="60" fill="#b08a5a"/><path d="M70 84q8 -4 16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0" stroke="#d9c3a0" stroke-width="2" fill="none"/><path d="M106 118H214" stroke="#fff" stroke-width="2" stroke-dasharray="6 4"/>
      <path d="M0 180V72H66Q100 74 118 136H202Q220 74 254 72H320V180Z" fill="${SOIL}"/><path d="M0 72H66M254 72H320" stroke="#4f8a36" stroke-width="6"/>${hs(14, 69, 26, 18)}${tree(292, 69, 1)}
      <rect x="92" y="80" width="26" height="6" rx="3" fill="#6b4a34" transform="rotate(-8 105 83)"/>${arrow(160, 113, 160, 94, '#fff')}${txt(160, 131, '平常的水位')}${lab(160, 60, '暴漲：水變多、變急、變濁', '#b91c1c')}`; }
  if (kind === 'scour') { bg = RAINY;
    o = `<rect y="92" width="210" height="88" fill="#b08a5a"/><path d="M10 108h40M70 132h46M20 156h36M96 112h30" stroke="#d9c3a0" stroke-width="2.5" stroke-linecap="round"/><path d="M186 72H146Q132 120 126 180" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 4"/>
      <path d="M320 180V72H186Q178 100 200 112Q178 130 172 180Z" fill="${SOIL}"/><path d="M188 72H320" stroke="#4f8a36" stroke-width="6"/>${hs(204, 69, 30, 20)}${tree(284, 69, 1)}
      <path d="M150 150l14 -6l8 10l-12 8ZM130 164l10 -4l6 8l-9 6Z" fill="#8a6846"/>${arrow(34, 122, 158, 116, '#fff')}${lab(86, 60, '急流沖刷、掏空河岸', '#b91c1c')}${lab(262, 132, '河岸崩塌')}${txt(108, 86, '原本的河岸', '#55687a')}`; }
  if (kind === 'inund') { bg = RAINY;
    o = rainS(r, 20, 0, 0, 320, 40) + `${hs(232, 112, 30, 22)}${hs(280, 112, 26, 20, '#efe2c6', '#a8563c')}<rect x="94" y="96" width="226" height="60" fill="#b08a5a" opacity=".9"/>
      <path d="M0 180V118H66L84 82H98L118 152H196L212 112H320V180Z" fill="${SOIL}"/><path d="M66 118L84 82H98L118 152" fill="none" stroke="#a9acb2" stroke-width="5" stroke-linejoin="round"/><path d="M0 118H64" stroke="#4f8a36" stroke-width="6"/>
      ${hs(12, 115, 30, 22)}${tree(54, 115, .9)}${lab(62, 60, '有堤防：沒淹水', '#15803d')}${lab(246, 60, '低窪：河水漫進來', '#b91c1c')}${txt(157, 172, '河')}${txt(91, 76, '堤防', '#3a3d44')}`; }
  if (kind === 'silt') {
    o = `<circle cx="284" cy="30" r="16" fill="#fbbf24"/><rect x="190" y="138" width="110" height="14" fill="#5fb3d9"/><path d="M0 180V120H184L200 152H280L296 120H320V180Z" fill="${SOIL}"/><path d="M298 120H320" stroke="#4f8a36" stroke-width="6"/>
      ${hs(30, 120, 34, 26)}${hs(104, 120, 30, 24, '#efe2c6', '#a8563c')}<rect x="30" y="103" width="34" height="17" fill="#8a6846" opacity=".35"/><rect x="104" y="103" width="30" height="17" fill="#8a6846" opacity=".35"/><path d="M30 103h34M104 103h30" stroke="#8a6846" stroke-width="2.5"/>
      <path d="M0 112Q40 107 90 112T184 113L188 124H0Z" fill="#7d5c3c"/><ellipse cx="80" cy="116" rx="12" ry="2.6" fill="#a8c4cf"/><ellipse cx="158" cy="117" rx="9" ry="2.2" fill="#a8c4cf"/>
      ${lab(100, 60, '水退了，留下厚厚的泥沙')}${lab(166, 96, '水痕')}${txt(60, 160, '泥沙')}`; }
  if (kind === 'fault') {
    const st = `<rect x="-20" y="66" width="380" height="5" fill="#5d9a40"/><rect x="-20" y="71" width="380" height="8" fill="#84623e"/><rect x="-20" y="79" width="380" height="26" fill="#c9a36b"/><rect x="-20" y="105" width="380" height="26" fill="#9c8f80"/><rect x="-20" y="131" width="380" height="26" fill="#d8bf8a"/><rect x="-20" y="157" width="380" height="60" fill="#7f7b78"/><path d="M-20 79h380M-20 105h380M-20 131h380M-20 157h380" stroke="rgba(40,30,25,.3)" stroke-width="1.2"/><rect x="40" y="62" width="250" height="5" fill="#5a5f68"/>`;
    o = `<defs><clipPath id="${id}L"><path d="M0 0H117.5L215 180H0Z"/></clipPath><clipPath id="${id}R"><path d="M117.5 0H320V180H215Z"/></clipPath></defs><g clip-path="url(#${id}L)">${st}${hs(62, 62, 24, 16)}</g><g clip-path="url(#${id}R)"><g transform="translate(-13 -24)">${st}</g></g>
      <path d="M139 40L215 180" stroke="#b91c1c" stroke-width="3"/><path d="M158 66H320" stroke="#fff" stroke-width="2" stroke-dasharray="6 4"/>${txt(316, 78, '原本的地面', '#3a2a1c', 'end')}${arrow(242, 154, 224, 121, '#b91c1c')}${arrow(150, 108, 168, 141, '#55687a')}
      ${lab(240, 22, '沿著斷層面被推上來', '#b91c1c')}${lab(120, 166, '斷層', '#b91c1c')}`; }
  if (kind === 'track') { bg = '#9cc77a';
    const oval = `<ellipse cx="160" cy="100" rx="112" ry="58" fill="#7fb86a" stroke="#c8553d" stroke-width="20"/><ellipse cx="160" cy="100" rx="112" ry="58" fill="none" stroke="#fff" stroke-width="1.2"/>`;
    o = `<defs><clipPath id="${id}U"><path d="M0 0H320V64L0 116Z"/></clipPath><clipPath id="${id}D"><path d="M0 140L320 88V180H0Z"/></clipPath></defs><g clip-path="url(#${id}U)"><g transform="translate(0 -12)">${oval}</g></g><g clip-path="url(#${id}D)">${oval}</g><path d="M0 116L320 64V88L0 140Z" fill="#8a6846"/>`;
    for (let x = 8; x < 320; x += 13) o += `<path d="M${x} ${f1(116 - x * .1625 + 2)}l-2 20" stroke="#5d4129" stroke-width="1.6"/>`;
    o += `<path d="M0 140L320 88" stroke="rgba(0,0,0,.25)" stroke-width="3"/>${lab(160, 22, '跑道被抬高、斷成兩截')}${lab(60, 166, '斷層崖', '#b91c1c')}${arrow(60, 150, 60, 134, '#b91c1c')}`; }
  if (kind === 'uplift') {
    o = `<rect x="156" y="86" width="164" height="12" fill="#5fb3d9"/><rect y="120" width="150" height="14" fill="#5fb3d9"/><path d="M0 180V132H146L158 96H320V180Z" fill="#8f8b85"/><path d="M0 150H140M166 116H320M172 140H320M0 166H150M180 164H320" stroke="rgba(40,30,25,.25)" stroke-width="1.2"/>
      <path d="M156 88Q149 104 144 126" stroke="#bfe3f5" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="138" cy="126" r="5" fill="#fff"/><circle cx="128" cy="124" r="4" fill="#fff"/><circle cx="148" cy="128" r="4" fill="#fff"/>
      <path d="M152 100L196 180" stroke="#b91c1c" stroke-width="2.5" stroke-dasharray="6 4"/>${arrow(296, 74, 208, 74, '#2563eb')}${arrow(256, 164, 256, 124, '#b91c1c')}${lab(238, 50, '河床被抬高', '#b91c1c')}${lab(70, 104, '形成瀑布')}`; }
  if (kind === 'qslide') {
    o = `<path d="M0 180V150H70L170 30L270 150H320V180Z" fill="#5d9050"/><path d="M176 38L262 142H206Q188 96 176 38Z" fill="#b08a5e"/><path d="M192 150Q232 114 290 150Z" fill="#8a6846"/>${rocks(r, 12, 208, 132, 60, 14, 4)}
      ${tree(110, 102, 1)}${tree(138, 68, .9)}${tree(88, 128, 1)}${tree(152, 52, .8)}<path d="M24 60l8 8l-8 8l8 8l-8 8M302 46l-8 8l8 8l-8 8l8 8M44 96l6 6l-6 6l6 6" stroke="#b91c1c" stroke-width="3" fill="none" stroke-linejoin="round"/>
      ${arrow(214, 76, 240, 116, '#fff')}${lab(84, 24, '地震搖鬆了山坡', '#b91c1c')}${lab(240, 172, '大量土石崩落')}`; }
  if (kind === 'dch') { bg = '#f3ece4';
    o = `<rect y="150" width="320" height="30" fill="#d9c9b0"/><path d="M276 0L288 34" stroke="#64748b" stroke-width="2"/><path d="M276 34h24l-5 14h-14Z" fill="#fbbf24"/><rect x="52" y="30" width="24" height="16" fill="#3b82f6" transform="rotate(24 64 38)"/>
      <path d="M22 70l6 6l-6 6l6 6M300 84l-6 6l6 6l-6 6" stroke="#b91c1c" stroke-width="2.5" fill="none"/>
      <rect x="110" y="72" width="130" height="10" rx="3" fill="#8a5a34"/><rect x="118" y="82" width="8" height="68" fill="#8a5a34"/><rect x="224" y="82" width="8" height="68" fill="#8a5a34"/>
      <path d="M158 138L150 150H174" stroke="#1e3a8a" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="176" cy="128" rx="26" ry="15" fill="#3b82f6"/><circle cx="204" cy="114" r="12" fill="#f2c9a0"/><path d="M193 110Q204 96 215 110" fill="#3a2a22"/>
      <path d="M186 122Q194 98 214 104" stroke="#f2c9a0" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M196 132L225 124" stroke="#f2c9a0" stroke-width="6" stroke-linecap="round"/>
      ${lab(54, 140, '① 趴下')}${lab(176, 58, '② 掩護：躲到桌下，保護頭頸')}${lab(222, 172, '③ 穩住：抓住桌腳')}`; }
  if (kind === 'escape') { bg = '#cfe0b8';
    o = `<path d="M0 0H70Q50 90 80 180H0Z" fill="#8fbf74"/><path d="M320 0H250Q270 90 240 180H320Z" fill="#8fbf74"/><path d="M160 0V180" stroke="#8a6846" stroke-width="44"/>${rocks(r, 26, 142, 4, 36, 172, 4)}${arrow(160, 16, 160, 60, '#fff')}
      <circle cx="126" cy="92" r="6" fill="#f2c9a0"/><rect x="121" y="98" width="10" height="14" rx="3" fill="#3b82f6"/><circle cx="196" cy="92" r="6" fill="#f2c9a0"/><rect x="191" y="98" width="10" height="14" rx="3" fill="#f97316"/>
      ${arrow(114, 100, 50, 88, '#15803d')}${arrow(208, 100, 272, 88, '#15803d')}${arrow(126, 118, 126, 158, '#b91c1c')}
      ${lab(160, 82, '土石流')}${lab(56, 64, '✔ 往兩側高處', '#15803d')}${lab(264, 64, '✔ 往兩側高處', '#15803d')}${lab(74, 174, '✘ 不順著溪流跑', '#b91c1c')}`; }
  if (kind === 'map') { bg = '#eef3e6';
    o = `<rect y="150" width="320" height="30" fill="#9fd0ea"/><rect x="170" y="116" width="150" height="36" fill="rgba(37,99,235,.33)"/><path d="M98 0H124Q118 60 150 150H92Q96 70 98 0Z" fill="rgba(220,38,38,.36)"/><path d="M110 0Q104 70 120 150" stroke="#6bb5dc" stroke-width="5" fill="none"/>
      <path d="M0 100H320M236 100V46M30 100V62" stroke="#fff" stroke-width="8"/><path d="M0 100H320M236 100V46M30 100V62" stroke="#a3acb5" stroke-width="5"/>`;
    for (const [x, y] of [[44, 78], [62, 112], [150, 112], [176, 112], [196, 128], [226, 130], [270, 126], [66, 78]]) o += `<rect x="${x}" y="${y}" width="13" height="10" fill="#b4513a" stroke="#fff" stroke-width="1.2"/>`;
    for (const [x, y] of [[221, 22], [15, 38]]) o += `<rect x="${x}" y="${y}" width="30" height="24" rx="4" fill="#16a34a"/><path d="M${x + 7} ${y + 13}L${x + 15} ${y + 6}L${x + 23} ${y + 13}V${y + 19}H${x + 7}Z" fill="#fff"/>`;
    o += `${arrow(160, 100, 222, 100, '#15803d')}${arrow(236, 92, 236, 54, '#15803d')}${arrow(204, 124, 222, 108, '#15803d')}${arrow(56, 100, 36, 100, '#15803d')}${arrow(30, 92, 30, 70, '#15803d')}
      ${lab(272, 14, '避難收容處所', '#15803d')}${lab(150, 34, '危險範圍', '#b91c1c')}${lab(262, 168, '容易淹水', '#1d4ed8')}${lab(172, 82, '避難路線', '#15803d')}`; }
  if (kind === 'shelter') {
    o = `<path d="M0 180V152Q80 120 160 118T320 152V180Z" fill="#8fbf74"/><rect x="100" y="62" width="120" height="58" fill="#efe2c6"/><rect x="96" y="56" width="128" height="8" fill="#b0643f"/><rect x="150" y="96" width="20" height="24" fill="#6b4a34"/>`;
    for (let k = 0; k < 4; k++) for (const y of [70, 92]) if (!(y === 92 && (k === 1 || k === 2))) o += `<rect x="${108 + k * 28}" y="${y}" width="18" height="14" fill="#86c8ec"/>`;
    o += `<rect x="234" y="62" width="4" height="62" fill="#64748b"/><rect x="214" y="58" width="44" height="30" rx="5" fill="#16a34a"/><path d="M236 66L248 76V84H240V78H236Z" fill="#fff"/><circle cx="225" cy="68" r="3" fill="#fff"/><path d="M225 71v8l-4 6M225 79l4 6M220 75h9" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    for (const [x, c] of [[40, '#3b82f6'], [58, '#f97316'], [76, '#a855f7']]) o += `<circle cx="${x}" cy="${f1(124 - (x - 40) * .08)}" r="5" fill="#f2c9a0"/><rect x="${x - 4}" y="${f1(129 - (x - 40) * .08)}" width="8" height="13" rx="3" fill="${c}"/><rect x="${x - 8}" y="${f1(130 - (x - 40) * .08)}" width="4" height="9" rx="2" fill="#d8452f"/>`;
    o += `${arrow(40, 108, 86, 104, '#15803d')}${lab(250, 44, '避難收容處所', '#15803d')}${lab(160, 172, '地勢較高、遠離溪流和陡坡')}`; }
  if (kind === 'kit') { bg = '#f3ece4';
    o = `<path d="M46 48Q66 14 86 48" stroke="#b83a26" stroke-width="7" fill="none"/><rect x="24" y="46" width="84" height="104" rx="18" fill="#d8452f"/><rect x="40" y="92" width="52" height="40" rx="8" fill="#b83a26"/><path d="M40 106h52" stroke="#f2b21a" stroke-width="3"/>${lab(66, 172, '緊急避難包')}
      <rect x="142" y="30" width="16" height="32" rx="4" fill="#7ec8f0"/><rect x="146" y="24" width="8" height="7" fill="#2563eb"/><rect x="196" y="38" width="30" height="24" rx="3" fill="#e0a526"/><path d="M196 46h30" stroke="#b47a12" stroke-width="2"/>
      <rect x="252" y="42" width="24" height="12" rx="2" fill="#475569"/><path d="M276 40l12 -4v24l-12 -4Z" fill="#f2b21a"/>
      <circle cx="146" cy="112" r="9" fill="#f97316"/><rect x="152" y="104" width="14" height="7" rx="2" fill="#f97316"/><circle cx="146" cy="112" r="3" fill="#7c2d12"/>
      <rect x="194" y="100" width="34" height="24" rx="3" fill="#64748b"/><circle cx="204" cy="112" r="6" fill="#cbd5e1"/><path d="M214 106h10M214 112h10M214 118h10M222 100l8 -12" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="252" y="100" width="30" height="24" rx="3" fill="#fff" stroke="#94a3b8" stroke-width="1.5"/><path d="M267 105v14M260 112h14" stroke="#dc2626" stroke-width="4"/>
      ${txt(150, 80, '飲用水', '#1f3345')}${txt(211, 80, '乾糧', '#1f3345')}${txt(268, 80, '手電筒', '#1f3345')}${txt(152, 142, '哨子', '#1f3345')}${txt(211, 142, '收音機', '#1f3345')}${txt(267, 142, '常用藥品', '#1f3345')}`; }
  if (kind === 'veg') { bg = RAINY;
    o = rainS(r, 30, 0, 0, 320, 50) + `<rect y="150" width="320" height="30" fill="#84623e"/><path d="M6 58L128 150H6Z" fill="${SOIL}"/><path d="M6 58L128 150" stroke="#4f8a36" stroke-width="8" stroke-linecap="round"/>${tree(30, 74, .9)}${tree(60, 97, .9)}${tree(92, 121, .9)}
      <path d="M30 78l-4 16M30 78l6 14M60 101l-4 16M60 101l6 14M92 125l-4 14M92 125l6 12" stroke="#6b4a34" stroke-width="1.8"/><ellipse cx="141" cy="150" rx="12" ry="3.5" fill="#7ec0dc"/>
      <path d="M166 58L288 150H166Z" fill="${SOIL}"/><path d="M186 76L262 133M202 84L250 120M176 70L226 108" stroke="#6b4a2c" stroke-width="3.5" stroke-linecap="round"/><path d="M276 150Q298 128 318 150Z" fill="#7d5c3c"/>${rocks(r, 8, 284, 140, 26, 8, 2.4, ['#5d4129', '#8a6846'])}
      <path d="M160 6V146" stroke="#fff" stroke-width="2" stroke-dasharray="5 5"/>${lab(74, 172, '有植物：泥沙少', '#15803d')}${lab(246, 172, '光禿禿：泥沙多', '#b91c1c')}`; }
  if (kind === 'forest') { bg = RAINY;
    o = rainS(r, 26, 0, 0, 320, 34) + `<path d="M0 180V70L320 150V180Z" fill="${SOIL}"/><path d="M0 70L320 150" stroke="#7a8a3c" stroke-width="7"/>`;
    for (const x of [56, 150, 244]) { const y = 70 + x * .25; o += `<path d="M${x} ${y}l-14 26M${x} ${y}l4 30M${x} ${y}l18 22M${x - 6} ${y + 12}l-10 6M${x + 8} ${y + 12}l10 10" stroke="#6b4a34" stroke-width="2.2" fill="none"/><rect x="${x - 4}" y="${y - 36}" width="8" height="38" fill="#6b4a34"/><circle cx="${x}" cy="${y - 48}" r="25" fill="#3f8a44"/><circle cx="${x - 16}" cy="${y - 38}" r="15" fill="#4f9a50"/><circle cx="${x + 17}" cy="${y - 40}" r="14" fill="#357a3c"/>${rocks(r, 5, x - 18, y - 70, 36, 10, 1.6, ['#7aa7d9'])}`; }
    o += `${arrow(104, 104, 104, 126, '#2563eb')}${arrow(198, 128, 198, 150, '#2563eb')}${lab(150, 22, '枝葉擋住雨水')}${lab(60, 166, '根抓住土壤')}${lab(250, 170, '落葉和土壤吸水', '#1d4ed8')}`; }
  if (kind === 'slope') {
    o = `<path d="M0 180V30L170 110V150H320V180Z" fill="${SOIL}"/><path d="M0 30L164 107" stroke="#5d9a40" stroke-width="8"/>`;
    for (let k = 0; k < 6; k++) { const x = 14 + k * 27, y = 30 + x * .4706; o += `<path d="M${x} ${f1(y - 5)}l-5 11" stroke="#ecebe4" stroke-width="3"/>`; }
    o += `<path d="M2 36L162 111" stroke="#ecebe4" stroke-width="2.5"/><rect x="160" y="102" width="18" height="48" fill="#b3b0a8" stroke="#7d7a72" stroke-width="1.5"/><path d="M160 118h18M160 134h18" stroke="#7d7a72" stroke-width="1.2"/><circle cx="178" cy="126" r="2.5" fill="#3a3d44"/><circle cx="178" cy="142" r="2.5" fill="#3a3d44"/><path d="M180 127q5 3 5 10M180 143q4 2 4 6" stroke="#5fb3d9" stroke-width="1.8" fill="none"/>
      <rect x="178" y="150" width="142" height="8" fill="#5a5f68"/><rect x="232" y="132" width="44" height="13" rx="5" fill="#2f6fb5"/><rect x="242" y="123" width="24" height="11" rx="4" fill="#2f6fb5"/><circle cx="242" cy="146" r="5" fill="#222"/><circle cx="266" cy="146" r="5" fill="#222"/>
      ${lab(248, 96, '擋土牆：擋住土石')}${lab(80, 150, '植生護坡：種草抓住土壤', '#15803d')}${txt(196, 176, '排水孔：把水排掉', '#fff', 'start')}`; }
  if (kind === 'net') {
    o = `<defs><pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H9M0 0V9" stroke="#f1f4f7" stroke-width="1.7"/></pattern></defs>
      <path d="M0 180V8H44L172 150H320V180Z" fill="#9a8f82"/><path d="M8 50l26 14M6 96l44 18M40 132l44 8M14 160l70 6" stroke="#7d7368" stroke-width="2"/><circle cx="118" cy="104" r="5" fill="#6f6b65"/><circle cx="150" cy="138" r="5.5" fill="#7d766c"/><circle cx="140" cy="127" r="4" fill="#6f6b65"/>
      <path d="M44 8L172 150H146L18 8Z" fill="url(#${id})" stroke="#dfe5ea" stroke-width="2"/><rect x="172" y="150" width="148" height="8" fill="#5a5f68"/>
      <path d="M188 150V112l-9 -9" stroke="#2f7d4a" stroke-width="4.5" fill="none" stroke-linejoin="round"/><path d="M188 120h0M188 134h0" stroke="#fff" stroke-width="2"/><circle cx="180" cy="145" r="4.5" fill="#7d766c"/>
      <rect x="240" y="132" width="44" height="13" rx="5" fill="#2f6fb5"/><rect x="250" y="123" width="24" height="11" rx="4" fill="#2f6fb5"/><circle cx="250" cy="146" r="5" fill="#222"/><circle cx="274" cy="146" r="5" fill="#222"/>
      ${lab(238, 40, '落石防護網：罩住岩壁')}${lab(252, 96, '防落石柵：攔住落石', '#15803d')}`; }
  if (kind === 'gabion') {
    o = `<path d="M0 180V58H110V94H132V122H154V150H320V180Z" fill="${SOIL}"/><path d="M0 58H108" stroke="#4f8a36" stroke-width="6"/>${tree(40, 56, 1)}${tree(78, 56, .9)}<rect x="226" y="150" width="94" height="8" fill="#5a5f68"/>`;
    for (const [x, y] of [[106, 66], [128, 94], [150, 122]]) for (const k of [0, 1]) { const bx0 = x + k * 38; o += `<rect x="${bx0}" y="${y}" width="38" height="28" fill="#8d877c"/>${rocks(r, 16, bx0 + 3, y + 3, 32, 22, 3.4, ['#a39c90', '#77716a', '#b9b2a6'])}<path d="M${bx0} ${y + 14}h38M${bx0 + 13} ${y}v28M${bx0 + 26} ${y}v28" stroke="#3d4046" stroke-width="1"/><rect x="${bx0}" y="${y}" width="38" height="28" fill="none" stroke="#2f3237" stroke-width="2"/>`; }
    o += `<path d="M228 136q6 4 6 12M206 108q6 4 6 12" stroke="#2563eb" stroke-width="2.2" fill="none"/>${lab(252, 40, '石籠：鐵絲籠裝石頭')}${lab(262, 96, '水從縫隙排掉', '#1d4ed8')}${txt(52, 120, '邊坡的土石')}`; }
  if (kind === 'shed') {
    o = `<path d="M0 180V6H56L130 96V150H320V180Z" fill="#9a8f82"/><path d="M10 60l30 20M8 110l60 24M60 150l50 6" stroke="#7d7368" stroke-width="2"/><rect x="130" y="150" width="190" height="8" fill="#5a5f68"/>
      <rect x="128" y="92" width="9" height="58" fill="#b3b0a8"/><rect x="238" y="106" width="9" height="44" fill="#cfccc4"/><path d="M112 78L254 98V108L112 88Z" fill="#cfccc4" stroke="#8f8c85" stroke-width="1.5"/>
      <circle cx="150" cy="78" r="5" fill="#6f6b65"/><circle cx="196" cy="85" r="6" fill="#7d766c"/><circle cx="268" cy="118" r="5" fill="#6f6b65"/><circle cx="86" cy="42" r="5" fill="#7d766c"/>
      <path d="M92 48Q150 66 240 86Q262 92 270 110" stroke="#b91c1c" stroke-width="2.5" fill="none" stroke-dasharray="6 4"/><rect x="162" y="132" width="44" height="13" rx="5" fill="#2f6fb5"/><rect x="172" y="123" width="24" height="11" rx="4" fill="#2f6fb5"/><circle cx="172" cy="146" r="5" fill="#222"/><circle cx="196" cy="146" r="5" fill="#222"/>
      ${lab(232, 30, '明隧道')}${lab(226, 56, '落石從屋頂上滑過', '#b91c1c')}${txt(186, 174, '人和車在裡面很安全', '#fff')}`; }
  if (kind === 'dam') {
    o = `<path d="M0 180V50L130 120H146L320 150V180Z" fill="#8f8b85"/><path d="M34 68L126 84V118Z" fill="#8a6846"/>`;
    [[70, 82, 4], [92, 90, 5], [110, 96, 4], [104, 86, 3], [84, 86, 3], [116, 106, 4], [58, 76, 3]].forEach((q, k) => { o += `<circle cx="${q[0]}" cy="${q[1]}" r="${q[2]}" fill="${k % 2 ? '#6f6b65' : '#5d4129'}"/>`; });
    o += `<path d="M126 122V82H142L152 122Z" fill="#c2bfb6" stroke="#7d7a72" stroke-width="1.5"/><path d="M0 46L34 65L126 80H142Q150 100 154 120L320 147" stroke="#5fb3d9" stroke-width="4" fill="none" stroke-linejoin="round"/>
      ${lab(150, 60, '攔砂壩')}${txt(176, 146, '水從壩頂溢流', '#fff', 'start')}${lab(70, 150, '攔下來的土石')}${lab(246, 108, '流到下游的土石變少')}`; }
  if (kind === 'pond') { bg = RAINY;
    o = rainS(r, 18, 0, 0, 320, 40) + `<rect x="200" y="116" width="88" height="36" fill="#b08a5a"/><rect x="70" y="120" width="94" height="22" fill="#7ec0dc"/><path d="M0 180V110H70L84 140H150L164 110H200L212 150H276L288 110H320V180Z" fill="${SOIL}"/><path d="M0 110H68M166 110H198M290 110H320" stroke="#4f8a36" stroke-width="6"/>
      ${hs(14, 107, 30, 20)}${tree(56, 107, .8)}${arrow(198, 102, 154, 102, '#2563eb')}${lab(117, 84, '滯洪池：暫時存水', '#1d4ed8')}${lab(254, 84, '暴漲的河', '#b91c1c')}${lab(160, 172, '雨停後，再慢慢把水放回河裡')}`; }
  return `<svg class="hfull" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="180" fill="${bg}"/>${o}</svg>`;
}
const fig = k => `<div class="hfig">${hSVG(k)}</div>`;
const card = (name, en, key, facts) => ({ name, en, photo: 'img/hazard/' + key + '.jpg', svg: hSVG(key), facts });
// 疏散避難圖的圖例小圖示（自己重畫的示意圖）
const LEG = {
  zone: '<rect x="3" y="3" width="28" height="28" rx="4" fill="rgba(220,38,38,.35)" stroke="#dc2626" stroke-width="2"/><path d="M6 20L20 6M10 28L28 10M20 30L30 20" stroke="#dc2626" stroke-width="2"/>',
  shelter: '<rect x="2" y="2" width="30" height="30" rx="6" fill="#16a34a"/><path d="M8 18L17 9L26 18V26H8Z" fill="#fff"/><rect x="14.5" y="19" width="5" height="7" fill="#16a34a"/>',
  way: '<path d="M4 17H24" stroke="#16a34a" stroke-width="5" stroke-linecap="round"/><path d="M20 8L31 17L20 26Z" fill="#16a34a"/>',
  fire: '<rect x="2" y="2" width="30" height="30" rx="6" fill="#dc2626"/><text x="17" y="23" font-size="17" font-weight="900" text-anchor="middle" fill="#fff">消</text>',
  police: '<rect x="2" y="2" width="30" height="30" rx="6" fill="#1d4ed8"/><text x="17" y="23" font-size="17" font-weight="900" text-anchor="middle" fill="#fff">警</text>',
  medic: '<rect x="2" y="2" width="30" height="30" rx="6" fill="#fff" stroke="#16a34a" stroke-width="2"/><path d="M17 8v18M8 17h18" stroke="#16a34a" stroke-width="6"/>' };
const leg = (k, s) => `<div><svg viewBox="0 0 34 34">${LEG[k]}</svg>${s}</div>`;

/* ---------- 探究：有植物與沒有植物的土坡淋水 ---------- */
function observeVeg(el, done) {
  el.innerHTML = `<div class="sim" style="grid-template-columns:1fr"><figure><figcaption>土坡淋水實驗<small>兩個土坡一樣陡、淋一樣多的水；杯子接住流下來的水和泥沙</small></figcaption>
      <canvas width="460" height="250" id="hvC" style="aspect-ratio:46/25;max-width:560px;background:#eef4f8"></canvas><div class="res" id="hvT">選好雨量，按「開始淋水」</div></figure></div>
    <div class="hsel"><span>雨量</span><button data-v="0" class="on">小雨</button><button data-v="1">大雨</button></div>
    <div class="row"><button class="cta" id="hvGo">💧 開始淋水</button></div>
    <table class="htab"><tr><th>沖下來的泥沙</th><th>有植物的土坡</th><th>光禿禿的土坡</th></tr><tr><td>小雨</td><td data-c="00">—</td><td data-c="01">—</td></tr><tr><td>大雨</td><td data-c="10">—</td><td data-c="11">—</td></tr></table>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0">這是把實驗簡化的模擬。兩個土坡只有「有沒有植物」不一樣，才能公平比較。</p>`;
  const g = G.$('#hvC').getContext('2d'), T = 6, SED = [[.4, 2], [1, 5]], WAT = [[8, 15], [16, 30]], tried = {}, r = U.rng(33);
  const blades = Array.from({ length: 46 }, () => [r(), r()]), drops = Array.from({ length: 40 }, () => [r(), r(), r()]), grains = Array.from({ length: 40 }, () => [r(), r(), r()]);
  let rainK = 0, raf = 0, t0 = 0, run = false, told = false;
  const draw = (t, fin) => {
    const k = run || fin ? clamp(t / T, 0, 1) : 0; g.clearRect(0, 0, 460, 250);
    for (let p = 0; p < 2; p++) {
      const ox = p * 232 + 6, sy = u => lerp(74, 180, u), sx = u => ox + lerp(14, 160, u), sed = SED[rainK][p], wat = WAT[rainK][p];
      g.fillStyle = '#7aa7c7'; g.fillRect(ox, 196, 218, 6);
      g.beginPath(); g.moveTo(sx(0), sy(0)); g.lineTo(sx(1), sy(1)); g.lineTo(sx(1), 196); g.lineTo(sx(0), 196); g.closePath(); g.fillStyle = '#8a6846'; g.fill();
      if (p === 0) { g.strokeStyle = '#4f8a36'; g.lineWidth = 7; g.beginPath(); g.moveTo(sx(0), sy(0)); g.lineTo(sx(1), sy(1)); g.stroke(); g.lineWidth = 2; g.strokeStyle = '#3f7a2c';
        for (const [a, b] of blades) { const u = a; g.beginPath(); g.moveTo(sx(u), sy(u) - 2); g.lineTo(sx(u) + (b - .5) * 6, sy(u) - 9 - b * 6); g.stroke(); }
        g.strokeStyle = '#6b4a34'; g.lineWidth = 1.2; for (const [a, b] of blades.slice(0, 20)) { g.beginPath(); g.moveTo(sx(a), sy(a) + 3); g.lineTo(sx(a) + (b - .5) * 8, sy(a) + 10 + b * 8); g.stroke(); } }
      else if (k > 0) { g.strokeStyle = '#5d4129'; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.lineWidth = (1 + sed * .7) * k * (.6 + .15 * i); g.beginPath(); for (let u = .1; u <= 1.001; u += .06) g.lineTo(sx(u), sy(u) + 2 + Math.sin(u * 14 + i * 2) * 1.2 + i * .8); g.stroke(); } }
      // 灑水器
      g.fillStyle = '#64748b'; g.fillRect(ox + 10, 26, 156, 8); g.fillRect(ox + 84, 14, 8, 12);
      if (run && k < .86) { g.fillStyle = 'rgba(59,130,246,.85)'; const n = rainK ? 40 : 16; for (let i = 0; i < n; i++) { const d = drops[i], u = d[0], yy = 36 + ((t * 1.8 + d[1]) % 1) * (sy(u) - 40); g.beginPath(); g.arc(sx(u), yy, 2.1, 0, 7); g.fill(); }
        const n2 = Math.round(sed * 7); g.fillStyle = '#4a321e'; for (let i = 0; i < n2; i++) { const q = grains[i], u = (q[0] + t * (.3 + q[1] * .3)) % 1; g.beginPath(); g.arc(sx(u), sy(u) - 3, 2.4, 0, 7); g.fill(); }
        g.strokeStyle = p ? 'rgba(138,104,70,.9)' : 'rgba(59,130,246,.7)'; g.lineWidth = wat / 7; g.setLineDash([9, 7]); g.lineDashOffset = -t * 140; g.beginPath(); g.moveTo(sx(.05), sy(.05) - (p ? 2 : 10)); g.lineTo(sx(1), sy(1) - (p ? 2 : 10)); g.lineTo(sx(1) + 14, 190); g.stroke(); g.setLineDash([]); }
      // 杯子：水和沉在底部的泥沙
      const cx = ox + 172, cw = 40, wh = wat * k, sh = Math.max(sed * 3.6 * k, k > 0 ? 1 : 0);
      g.fillStyle = p ? '#c9a878' : '#bfe3f5'; g.fillRect(cx, 196 - wh - sh, cw, wh); g.fillStyle = '#5d4129'; g.fillRect(cx, 196 - sh, cw, sh);
      g.strokeStyle = '#475569'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, 146); g.lineTo(cx, 196); g.lineTo(cx + cw, 196); g.lineTo(cx + cw, 146); g.stroke();
      g.fillStyle = '#1f3345'; g.font = '900 14px sans-serif'; g.textAlign = 'center'; g.fillText(p ? '光禿禿的土坡' : '有植物的土坡', ox + 96, 222);
      if (fin) { g.font = '800 12.5px sans-serif'; g.fillStyle = p ? '#b91c1c' : '#15803d'; g.fillText(p ? '水很混濁，泥沙多' : '水比較清，泥沙少', ox + 110, 242); }
    }
  };
  const tick = now => { const t = (now - t0) / 1000;
    if (t >= T) { run = false; draw(T, true); for (let p = 0; p < 2; p++) { const s = SED[rainK][p]; el.querySelector(`[data-c="${rainK}${p}"]`).textContent = s < 1 ? '很少（不到 1 份）' : '▮'.repeat(s) + ' ' + s + ' 份'; }
      tried[rainK] = 1; const n = Object.keys(tried).length; G.$('#hvT').textContent = (rainK ? '大雨' : '小雨') + '：光禿禿的土坡沖下來的泥沙比較多' + (n < 2 ? '（再試另一種雨量）' : '');
      el.querySelectorAll('.hsel button, #hvGo').forEach(b => b.disabled = false); if (n >= 2 && !told) { told = true; done(); } return; }
    draw(t); raf = requestAnimationFrame(tick); };
  el.querySelectorAll('.hsel button').forEach(b => b.onclick = () => { if (run) return; rainK = +b.dataset.v; el.querySelectorAll('.hsel button').forEach(o => o.classList.toggle('on', o === b)); G.$('#hvT').textContent = '按「開始淋水」'; draw(0); });
  G.$('#hvGo').onclick = () => { if (run) return; run = true; t0 = performance.now(); el.querySelectorAll('.hsel button, #hvGo').forEach(b => b.disabled = true); G.$('#hvT').textContent = '淋水中……仔細看兩個土坡有什麼不同'; raf = requestAnimationFrame(tick); };
  draw(0);
  return () => cancelAnimationFrame(raf);
}

/* ---------- 區域定義 ---------- */
G.registerZone('hazard', {
  hint: '用左上角的按鈕切換晴天、豪雨、地震，看看大地發生什麼事；按「復原」可以重來。',
  build,
  nodes: [
    { id: 'slide', num: '1', title: '山崩與土石流', en: 'Landslide & Debris Flow', color: '#b45309', ready: true, at: [-8.2, 4.3, -1.3],
      cam: { pos: [-3.6, 8.5, 11.5], target: [-5.4, 1.6, -1.4] },
      learn: `
        <h3>侵蝕和堆積，也會變成災害</h3>
        <p>流水平常慢慢地侵蝕、搬運、堆積，一點一點改變大地。</p>
        <p>颱風或豪雨時，短時間內有<em>大量</em>的土石被沖走、堆積，就可能造成災害。</p>
        <h3>山崩</h3>
        <p>陡峭山坡上的土石或岩塊，突然往下崩落或滑動，叫做<em>山崩</em>。</p>
        <ul class="hlist" style="--c:#b45309"><li><b>🌧️ 豪雨</b>土石吸飽了水，變得又重又滑。</li><li><b>📳 地震</b>強烈的搖晃把山坡搖鬆。</li><li><b>🚜 人的活動</b>開路、開墾時挖掉坡腳，或砍掉抓住土石的樹木。</li></ul>
        <h3>土石流</h3>
        <p>大量的泥沙、石頭和水混在一起，沿著溪谷快速往下衝，叫做<em>土石流</em>。</p>
        <p>土石流的力量很大，連比汽車還大的石頭都推得動。</p>
        <p>衝出谷口後，地勢變平、速度變慢，土石就<em>散開、堆積</em>，掩埋房屋和道路。</p>
        <table class="htab"><tr><th>比一比</th><th>山崩</th><th>土石流</th></tr>
          <tr><td>發生的地方</td><td>陡峭的山坡</td><td>溪谷</td></tr>
          <tr><td>移動的東西</td><td>土石、岩塊</td><td>土石和水混在一起</td></tr>
          <tr><td>常見的原因</td><td>豪雨或地震；坡腳被挖</td><td>豪雨，加上溪谷裡堆了很多鬆動的土石</td></tr></table>
        <h3>發生前的徵兆</h3>
        ${fig('signs')}
        <p>土石流來之前，溪水會突然變混濁，或水量突然改變；還可能聽到石頭互相碰撞的轟隆聲。</p>
        <p>發現這些徵兆，要<em>立刻離開</em>，並且告訴大人。</p>
        <div class="tip"><b>看看場景：</b>現在是豪雨。左邊的山坡有石頭滾落；溪谷裡的土石衝出谷口後，往兩邊散開。</div>
        <details class="rext"><summary>延伸：臺灣的例子</summary>
          <p>1999 年 921 地震時，南投縣的九份二山發生大規模山崩。</p>
          <p>2009 年莫拉克颱風帶來驚人的雨量，高雄市小林村後方的山坡大規模崩塌，掩埋了村落。</p></details>`,
      cardsIntro: '<p>山崩和土石流的樣子，以及土石最後堆在哪裡。</p>',
      cards: [
        card('山崩', 'Landslide', 'slide', [['樣子', '山坡上的土石、岩塊突然崩落，留下一片裸露的崩塌地。'], ['危害', '掩埋坡腳的道路和房屋；落石可能砸傷人車。'], ['場景哪裡找', '左邊山坡上那一片褐色的崩塌地，和坡腳的土石堆。']]),
        card('土石流', 'Debris flow', 'debris', [['樣子', '泥沙、石頭和水混在一起，像泥漿一樣沿著溪谷往下衝。'], ['危害', '速度快、力量大，能沖毀橋梁和房屋。'], ['場景哪裡找', '兩座山之間的溪谷。按「豪雨」看土石衝下來。']]),
        card('谷口的堆積', 'Debris fan', 'fan', [['樣子', '土石流衝出谷口後散開，堆成一片扇形。'], ['為什麼', '谷口外地勢變平，流速變慢，水帶不動的土石就停下來。'], ['要注意', '谷口平坦，常有聚落，卻正是土石流最容易掩埋的地方。']]),
      ] },
    { id: 'flood', num: '2', title: '溪水暴漲與淹水', en: 'Flash Flood', color: '#2563eb', ready: true, at: [6.6, 1.9, 2.4],
      cam: { pos: [8.2, 8, 13.5], target: [8.0, .4, 2.8] },
      learn: `
        <h3>溪水為什麼會暴漲？</h3>
        <p>颱風或豪雨時，大量的雨水在短時間內流進溪裡。溪水<em>水量變多、流速變快</em>，水位很快升高，這就是溪水暴漲。</p>
        ${fig('flood')}
        <p>臺灣的河流又短又陡，山上的雨水很快就流到下游。</p>
        <p>所以就算你在的地方沒下雨，上游下大雨，溪水也可能突然暴漲。</p>
        <h3>暴漲的溪水做了什麼？</h3>
        <div class="two"><div><b>🌊 沖刷河岸</b>水多又流得快，侵蝕和搬運的力量變強，河岸被掏空、崩塌。</div><div><b>🏠 淹水</b>河水漫過河岸，流進地勢<em>低窪</em>的地方，房屋和農田泡在水裡。</div></div>
        <p>暴漲的溪水帶著大量泥沙，所以看起來又黃又濁。</p>
        <h3>水退了以後</h3>
        <p>水退的時候流速變慢，水帶不動的泥沙就<em>堆積</em>下來。</p>
        <p>房屋、道路和農田都蓋上一層厚厚的泥沙，要花很多力氣才能清乾淨。</p>
        <h3>我們可以怎麼做？</h3>
        <ul class="hlist" style="--c:#2563eb"><li><b>⛔ 颱風、豪雨時不去溪邊</b>不戲水、不釣魚、不露營。</li><li><b>👀 發現異狀立刻離開</b>溪水變濁、水位上升，或上游烏雲密布，馬上往高處走。</li><li><b>📻 住在低窪地區</b>注意颱風警報和豪雨特報，必要時提早撤離。</li></ul>
        <div class="tip"><b>看看場景：</b>現在是豪雨，河水漫進低窪的聚落；對岸有堤防，沒有淹水。再按左上角的「晴天」，看水退後留下什麼；按「復原」可以從頭再看一次。</div>
        <details class="rext"><summary>延伸：堤防不是萬能的</summary>
          <p>堤防只能擋住一定高度的河水。雨下得太大時，河水還是可能漫過堤防。</p>
          <p>所以還要有滯洪池、抽水站，加上每個人的防災準備，才能減少災害。</p></details>`,
      cardsIntro: '<p>暴漲的溪水帶來的三種改變：沖刷、淹水，和水退後的泥沙。</p>',
      cards: [
        card('沖刷河岸', 'Bank erosion', 'scour', [['樣子', '急流把河岸下方的土石掏空，上面的河岸跟著崩塌。'], ['危害', '河邊的道路、橋墩和房屋的地基可能被沖毀。'], ['和河流區的關係', '這就是「侵蝕」和「搬運」，只是又快又猛。']]),
        card('淹水', 'Flooding', 'inund', [['樣子', '河水漫過河岸，流進地勢低窪的地方。'], ['哪裡容易淹', '河邊的低地，以及排水不良的地方。'], ['場景哪裡找', '河邊低窪的聚落。對岸有堤防保護，沒有淹水。']]),
        card('水退後的泥沙', 'Flood deposit', 'silt', [['樣子', '水退了，地面和屋裡留下一層厚厚的泥沙，牆上有水痕。'], ['為什麼', '水退時流速變慢，水帶不動的泥沙就堆積下來。'], ['和河流區的關係', '這就是「堆積」。河流下游的平原也是這樣慢慢堆出來的。']]),
      ] },
    { id: 'quake', num: '3', title: '地震與地表變動', en: 'Earthquake', color: '#7c3aed', ready: true, at: [7.4, 2.7, -2.9],
      cam: { pos: [17.5, 6.5, 5.5], target: [8.4, .3, -2.2] },
      learn: `
        <h3>地震是什麼？</h3>
        <p>地球內部的力量不斷推擠岩層。岩層承受不住而突然<em>斷裂、錯動</em>時，大地就會搖晃，這就是<em>地震</em>。</p>
        <p>岩層斷裂、錯開的那個面，叫做<em>斷層</em>。斷層兩側的岩層會<em>沿著斷層面</em>，往相反的方向移動。</p>
        ${fig('fault')}
        <h3>地震怎麼改變地表？</h3>
        <ul class="hlist" style="--c:#7c3aed"><li><b>⬆️ 地表隆起</b>斷層一側的岩層沿著斷層面被推上來，地面出現落差。</li><li><b>⚡ 地面斷裂</b>道路、橋梁、操場斷成兩截。</li><li><b>⛰️ 山崩</b>山坡被搖鬆，土石崩落。</li></ul>
        <p>流水和風要很久才能改變地表；地震卻能在<em>幾十秒內</em>讓地表隆起、斷裂。</p>
        <h3>地震時怎麼保護自己？</h3>
        <ul class="hlist" style="--c:#15803d"><li><b>🙇 趴下、掩護、穩住</b>躲到桌子下，保護頭和脖子，抓住桌腳。</li><li><b>🚪 搖晃停止後再疏散</b>走樓梯，不搭電梯；不推、不跑。</li><li><b>🏞️ 在戶外</b>遠離建築物、電線桿和山坡。</li></ul>
        <div class="tip"><b>看看場景：</b>看右邊的剖面：後方那一塊岩層沿著斜斜的斷層面被推上來。操場的跑道和馬路都斷成兩截。按左上角的「復原」和「地震」可以重看。</div>
        <details class="rext"><summary>延伸：921 地震</summary>
          <p>1999 年 9 月 21 日，臺灣中部發生大地震。車籠埔斷層錯動，地表出現很長的破裂。</p>
          <p>臺中市霧峰區一所國中的操場跑道被抬高、斷開，現在保存在 921 地震教育園區。</p></details>
        <details class="rext"><summary>延伸：臺灣為什麼常有地震？</summary>
          <p>地球表面是由好幾塊「板塊」拼成的。臺灣剛好在兩塊板塊互相推擠的地方。</p>
          <p>岩層受到很大的力量，所以地震特別多。板塊的內容，國中會學到。</p></details>`,
      cardsIntro: '<p>地震留下的痕跡，以及地震時保護自己的方法。</p>',
      cards: [
        card('地面斷裂', 'Surface rupture', 'track', [['樣子', '地面沿著斷層錯開，出現像階梯一樣的落差，叫做斷層崖。'], ['危害', '跨過斷層的道路、橋梁、房屋會被扯斷。'], ['場景哪裡找', '右後方學校的操場，紅色跑道斷成高低兩截；旁邊的馬路也斷了。']]),
        card('河床被抬高', 'Uplift', 'uplift', [['樣子', '斷層一側的河床被抬高，河水從高處落下，形成瀑布。'], ['說明', '地震可以在很短的時間內，造出新的地形。'], ['臺灣的例子', '921 地震時，大甲溪的河床被抬高，出現了瀑布。']]),
        card('地震引發山崩', 'Earthquake landslide', 'qslide', [['樣子', '強烈的搖晃把山坡搖鬆，大量土石崩落。'], ['危害', '掩埋道路和聚落；鬆動的土石在之後的豪雨中，還可能變成土石流。'], ['臺灣的例子', '921 地震時，南投縣九份二山的山崩。']]),
        card('趴下、掩護、穩住', 'Drop, Cover, Hold on', 'dch', [['趴下', '壓低身體，避免跌倒。'], ['掩護', '躲到堅固的桌子下；沒有桌子時，用書包或手臂保護頭和脖子。'], ['穩住', '抓住桌腳，跟著桌子移動，直到搖晃停止。']]),
      ] },
    { id: 'evac', num: '4', title: '防災避難', en: 'Evacuation', color: '#15803d', ready: true, at: [2.4, 2.9, -1.75],
      cam: { pos: [-.5, 17, 12.5], target: [-.5, .6, .2] },
      learn: `
        <h3>災害擋不住，但可以先準備</h3>
        <p>颱風、豪雨和地震都無法阻止。不過只要<em>事先準備</em>、知道怎麼避難，就能大大減少傷害。</p>
        <h3>認識疏散避難圖</h3>
        <p>各地的村里都有<em>疏散避難圖</em>，標出危險的範圍、避難的路線和避難的地點。常見的圖例有：</p>
        <div class="hleg">${leg('zone', '危險範圍<br>（土石流、淹水）')}${leg('shelter', '避難收容處所')}${leg('way', '避難方向')}${leg('fire', '消防單位')}${leg('police', '警察單位')}${leg('medic', '醫療院所')}</div>
        <p>看圖時先找三件事：我家在不在危險範圍？最近的避難收容處所在哪裡？走哪一條路最安全？</p>
        <h3>避難的原則</h3>
        <ul class="hlist" style="--c:#15803d"><li><b>⏰ 提早離開</b>聽到警報或撤離通知就立刻行動，不要等災害發生。</li><li><b>🚫 遠離危險</b>不靠近溪流和陡坡，不過橋、不涉水。</li><li><b>🏫 往安全的地方</b>到避難收容處所，或地勢高、堅固的建築。</li><li><b>🤝 一起行動</b>跟著家人或老師，不單獨行動，不回頭拿東西。</li></ul>
        ${fig('escape')}
        <p>遇到土石流，要往溪谷<em>兩側的高處</em>跑。順著溪流往下跑，跑不贏土石流。</p>
        <h3>平時的準備</h3>
        <div class="two"><div><b>🎒 緊急避難包</b>放在門口附近，定期檢查裡面的東西。</div><div><b>👨‍👩‍👧 和家人約定</b>災害時在哪裡集合、怎麼聯絡。</div></div>
        <div class="two"><div><b>🏃 參加防災演練</b>練習過，遇到災害才不慌張。</div><div><b>📻 注意警報</b>颱風警報、豪雨特報、土石流警戒。</div></div>
        <div class="tip"><b>看看場景：</b>地面變成一張疏散避難圖：紅、橘、藍色是危險範圍，綠色箭頭是避難路線。兩邊的居民為什麼不過橋？</div>
        <details class="rext"><summary>延伸：土石流的黃色、紅色警戒</summary>
          <p>政府會依照雨量，對容易發生土石流的溪流發布警戒。</p>
          <p>黃色警戒：勸告居民撤離。紅色警戒：可以強制居民撤離。</p></details>`,
      cardsIntro: '<p>三樣防災的好幫手：一張圖、一個地方、一個包。</p>',
      cards: [
        card('疏散避難圖', 'Evacuation map', 'map', [['內容', '標出危險範圍、避難路線、避難收容處所，還有消防、警察和醫療單位。'], ['哪裡看', '村里的公布欄、活動中心，或上網查詢。'], ['我可以做', '和家人一起找出自己家的位置，實際走一次避難路線。']]),
        card('避難收容處所', 'Shelter', 'shelter', [['是什麼', '災害時讓居民暫時安置的地方，通常是學校或活動中心。'], ['條件', '地勢較高，遠離溪流和陡坡，建築堅固。'], ['場景哪裡找', '東邊小山丘上的學校、西邊的活動中心（屋頂有綠色標誌）。']]),
        card('緊急避難包', 'Emergency kit', 'kit', [['裝什麼', '飲用水、乾糧、手電筒、哨子、收音機、常用藥品等。'], ['放哪裡', '門口附近，隨手拿得到的地方。'], ['要注意', '定期檢查，更換過期的食物和沒電的電池。']]),
      ] },
    { id: 'guard', num: '5', title: '守護大地', en: 'Protecting the Land', color: '#0f766e', ready: true, at: [-3.3, 4.2, -3.6],
      cam: { pos: [-6.0, 7.5, 12], target: [-7.0, 1.4, -.4] },
      learn: `
        <h3>人的活動會讓災害更嚴重</h3>
        <p>在山坡地砍伐森林、開墾、開路、蓋房子，土石失去保護，下大雨時更容易發生山崩和土石流。</p>
        <p>把地面都鋪上水泥和柏油，雨水滲不進土裡，全部流進水溝和河裡，也更容易淹水。</p>
        <h3>植物是山坡的守護者</h3>
        ${fig('veg')}
        <div class="two"><div><b>🌿 枝葉擋雨</b>雨水先打在枝葉上，落到地面的力量變小。</div><div><b>🌱 根抓住土壤</b>根像一張網，把土石牢牢抓住。</div></div>
        <div class="two"><div><b>🍂 落葉和土壤吸水</b>像海綿一樣，讓雨水慢慢滲進地下。</div><div><b>💧 結果</b>被沖走的泥沙變少，溪水也比較清。</div></div>
        <h3>守護大地的做法</h3>
        <ul class="hlist" style="--c:#0f766e"><li><b>🌳 保育森林、減少開發</b>不過度開墾山坡地；危險的地方不蓋房子。</li><li><b>🧱 穩住邊坡</b>格框植生護坡、擋土牆、石籠，把坡面的土石穩住。</li><li><b>🥅 擋住落石</b>落石防護網、防落石柵攔住落石；明隧道讓落石從屋頂滑過。</li><li><b>🏞️ 整治溪流</b>在溪谷蓋攔砂壩，攔住土石。</li><li><b>🌊 防洪</b>河邊蓋堤防，低窪地區設滯洪池和抽水站。</li></ul>
        <h3>工程也有極限</h3>
        <p>攔砂壩遲早會被土石填滿，還會擋住魚往上游的路；堤防也擋不住超過設計的大水。</p>
        <p>所以最根本的做法是<em>保護環境、減少開發</em>，再加上做好防災準備。</p>
        <div class="tip"><b>看看場景：</b>沿著山腳的馬路，由左到右有明隧道、落石防護網、格框植生護坡、擋土牆和石籠。再找找攔砂壩、堤防和滯洪池。</div>
        <p>按左上角的「豪雨」，看落石怎麼從明隧道的屋頂滑過，又怎麼被防護網和柵欄攔下。</p>
        <p>植物真的能減少被沖走的泥沙嗎？先預測，再用土坡淋水的實驗找答案。</p>
        <details class="rext"><summary>延伸：讓雨水滲進地下</summary>
          <p>公園綠地、透水的鋪面可以讓雨水滲進地下，減少流進水溝的水。</p>
          <p>有些城市用這種方法減少淹水，讓城市像海綿一樣會吸水。</p></details>`,
      cardsIntro: '<p>先看大自然本來的保護，再看道路邊坡、溪流和河邊的工程。每一種工程都有它的限制。</p>',
      cards: [
        card('森林與綠地', 'Forest', 'forest', [['作用', '枝葉擋住雨水，根抓住土壤，落葉和土壤吸水。'], ['好處', '減少被沖走的泥沙，也減少一下子流進溪裡的水。'], ['場景哪裡找', '山上的森林。旁邊開墾過的山坡沒有樹，比比看。']]),
        card('格框植生護坡與擋土牆', 'Slope protection', 'slope', [['做法', '坡面上做混凝土格框，格子裡種草；坡腳蓋擋土牆，牆上留排水孔。'], ['作用', '格框固定坡面，植物抓住表面的土壤，擋土牆擋住坡腳的土石。'], ['限制', '只能保護一小段邊坡；排水孔堵住時，牆可能被水壓推倒。']]),
        card('落石防護網與防落石柵', 'Rockfall net', 'net', [['做法', '用鋼索和鐵絲網罩住岩壁；路邊再立一排堅固的柵欄。'], ['作用', '落石被網子壓住或被柵欄攔下，不會彈到路上。'], ['限制', '擋不住大規模的山崩；網子和柵欄後面的落石要定期清理。']]),
        card('石籠', 'Gabion', 'gabion', [['做法', '鐵絲編成的籠子裝滿石頭，一層一層往後退著疊。'], ['作用', '靠重量擋住邊坡的土石；石頭之間有縫隙，水可以排掉。'], ['限制', '鐵絲生鏽、斷裂後石頭會散開，要定期檢查。']]),
        card('明隧道', 'Rock shed', 'shed', [['做法', '在常有落石的路段，蓋一個有屋頂的通道；靠山是牆，外側是柱子。'], ['作用', '落石和土石從屋頂上滑過，底下的人和車不會被砸到。'], ['限制', '造價高；只保護有屋頂的那一段，屋頂上的土石也要清理。']]),
        card('攔砂壩', 'Check dam', 'dam', [['做法', '在溪谷裡蓋一道橫跨溪床的壩；水從壩頂中間的缺口溢流。'], ['作用', '攔住土石，減緩水流，保護下游的聚落。'], ['限制', '土石填滿後就失去作用，要清理；也會擋住魚類往上游的路。']]),
        card('滯洪池', 'Detention pond', 'pond', [['做法', '在河邊或低窪的地方挖一個大池子。'], ['作用', '大雨時把水暫時存起來，雨停後再慢慢放回河裡，減少淹水。'], ['限制', '容量有限，雨太大時還是會滿；平時可以當公園或濕地。']]),
      ],
      poe: {
        question: '兩個一樣陡的土坡，一個長滿了草，一個是光禿禿的泥土。淋上一樣多的水，哪一個土坡被沖下來的泥沙比較多？',
        options: ['光禿禿的土坡，被沖下來的泥沙比較多', '長滿草的土坡，被沖下來的泥沙比較多', '一樣多，有沒有植物沒有影響'],
        observeIntro: '選好<b>雨量</b>，按「開始淋水」，比較兩個杯子接到的水和泥沙。<b>小雨和大雨都要試一次。</b>',
        observe: observeVeg,
        explain: {
          q: '根據實驗結果，哪一個說法最能解釋你看到的現象？',
          opts: ['植物的枝葉擋住雨水、根抓住土壤，所以有植物的土坡被沖走的泥沙比較少。', '草把泥沙吃掉了，所以流下來的泥沙比較少。', '光禿禿的土坡比較輕，所以整個被水沖走。'],
          ans: 0,
          hint: '回想實驗：兩個土坡一樣陡、淋一樣多的水，只差在「有沒有植物」。植物的枝葉和根，各做了什麼事？',
          why: '枝葉減弱雨水打在地面的力量，根把土壤抓住，所以有植物的土坡被沖走的泥沙少、流下來的水也比較清。山坡上的森林被砍掉後，大雨就會沖下大量土石。'
        }
      } },
  ],
  // 檢核題：level 為 PIRLS 層次（1 提取訊息／2 推論訊息／3 詮釋整合／4 比較評估）
  quiz: [
    { id: 'hazard.evac.1', about: '防災避難', level: 1, q: '根據「防災避難」的認識，遇到土石流時，應該往哪裡跑？',
      opts: ['往溪谷兩側的高處跑', '順著溪流往下游跑', '過橋到溪的對岸', '躲在溪邊的大石頭後面'], ans: 0, why: '說明中提到：遇到土石流，要往溪谷兩側的高處跑。順著溪流往下跑，跑不贏土石流；也不可以過橋、涉水。' },
    { id: 'hazard.slide.1', about: '山崩與土石流', level: 2, q: '連續下了幾天大雨，小安發現家後面的山坡出現新的裂縫，樹也歪了。根據「山崩與土石流」的徵兆，最合理的判斷是什麼？',
      opts: ['山坡的土石已經鬆動，可能山崩，要立刻離開並告訴大人', '樹木吸飽了水，正在快速長大，不用擔心', '裂縫可以讓雨水排掉，山坡會變得更穩固', '這是地震造成的，和下雨沒有關係'], ans: 0, why: '山坡出現裂縫、樹木歪斜，都是山崩的徵兆。豪雨讓土石吸飽水、又重又滑，隨時可能崩落，所以要立刻離開並告訴大人。' },
    { id: 'hazard.flood.1', about: '溪水暴漲與淹水', level: 2, q: '颱風過後，河邊低窪的農田蓋上一層厚厚的泥沙。根據「溪水暴漲與淹水」的認識，這些泥沙最可能是怎麼來的？',
      opts: ['暴漲的河水帶著泥沙漫進農田，水退時流速變慢，泥沙就堆積下來', '颱風的強風把遠方的泥沙吹過來', '農田裡的土壤泡水後膨脹、變多了', '地震把地下的泥沙擠到地面上'], ans: 0, why: '暴漲的溪水帶著大量泥沙漫進低窪的地方。水退時流速變慢，水帶不動的泥沙就堆積下來，留下一層厚厚的泥沙。' },
    { id: 'hazard.guard.1', about: '守護大地', level: 3, q: '把「守護大地」的探究結果，和「山崩與土石流」的認識放在一起想：山坡上的森林被大量砍伐後，為什麼下游谷口的聚落更容易遇到土石流？',
      opts: ['沒有植物擋雨和抓住土壤，大雨沖下更多土石，堆在溪谷裡成為土石流的材料', '樹被砍掉後雨下得比較少，溪谷變得乾燥、容易裂開', '沒有樹根吸水，溪水變得比較清澈、流得比較慢', '砍樹會讓岩層斷裂、錯動，引發地震'], ans: 0, why: '探究發現：沒有植物的土坡，被沖下來的泥沙比較多。這些土石堆在溪谷裡，豪雨時和水混在一起往下衝，就是土石流，衝出谷口後掩埋聚落。' },
    { id: 'hazard.quake.1', about: '地震與地表變動', level: 3, q: '比較「地震與地表變動」和「溪水暴漲與淹水」兩個節點：這兩種災害改變地表的方式，哪一個說法最正確？',
      opts: ['地震是岩層突然斷裂、錯動，使地表隆起或斷開；淹水是流水的侵蝕、搬運和堆積在短時間內大量發生', '兩種都是流水造成的，只是水量不一樣', '地震只會讓大地搖晃，不會改變地表的樣子；淹水才會', '兩種都是地球內部的力量推擠岩層造成的'], ans: 0, why: '地震來自地球內部的力量：岩層斷裂、錯動，幾十秒內就讓地表隆起、斷裂。溪水暴漲則是流水的作用：沖刷河岸（侵蝕、搬運），水退後留下泥沙（堆積）。' },
  ]
});
})();
