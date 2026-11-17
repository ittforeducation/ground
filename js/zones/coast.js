/* 區域 5c：風與海浪的雕刻 —— 一段同時有岩岸與沙岸的海岸
   西邊：伸進海裡的岩石岬角（海蝕崖、海蝕凹壁、海蝕平臺、豆腐岩、海蝕溝、海蝕洞、海蝕門、海蝕柱），岬角上有蕈狀岩、風稜石、蜂窩岩
   中間：海灣（礫石灘、沙灘、沙丘、防風林、河口的沙嘴）；東邊：聚落前的海堤、消波塊、突堤，外海有一座越來越小的沙洲
   四個節點：風的雕刻、岩岸、沙岸、變動的海岸；本區挑戰 6 題 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, { ss, fbm, clamp, lerp } = U;

/* ---------- 範圍：x 由西到東，z 由後（陸地）到前（海） ---------- */
const X0 = -13, X1 = 13, Z0 = -7, Z1 = 7, YB = -2.6, YT = 4.8, CELL = .1;
const NX = Math.round((X1 - X0) / CELL), NZ = Math.round((Z1 - Z0) / CELL), NV = (NX + 1) * (NZ + 1);

const CAPE = [[-8.9, -3.6, 1.9], [-8.6, -.5, 1.55], [-8.3, 2.3, 1.0]];                       // 岬角的中心線 [x, z, 半寬]
const FIN = { x: -8.15, z0: 2.9, z1: 4.75, hw: .44, top: 1.02 }, HOLE = { z: 3.85, y: .02, rz: .4, ry: .56 };   // 海蝕門
const STACK = { x: -8.0, z: 5.55, r: .36, h: .98 }, STUMP = { x: -7.9, z: 6.4 }, CAVE = { x: -7.5, y: .08, z: 2.15, rx: .85, ry: .58, rz: .42 };
const SANDP = [-9.0, -1.5];                                // 海蝕溝；岬角上的砂地（風稜石）
const WALLZ = -.55, GROINS = [9.3, 11.4];                                                    // 海堤的位置、突堤
const BAR = { x: 8.2, z: 4.0, a: 2.5, b: .42, rot: .1 }, OLD = { x: 7.1, z: 4.6, a: 3.75, b: .98, rot: .1 };   // 外海沙洲：現在與以前的範圍
const RIV_P = [[3.7, -7.2, .14, 1.05], [3.3, -5.9, .18, .6], [3.05, -4.8, .24, .28], [3.0, -3.8, .3, .08], [3.0, -3.0, .36, -.04], [3.0, -2.35, .44, -.1]];

const dSeg = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
function capeD(x, z) {            // 到岬角輪廓的距離（>0 在外面）
  let best = 1e9;
  for (let i = 0; i < 2; i++) { const a = CAPE[i], b = CAPE[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1); best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) - lerp(a[2], b[2], t)); }
  return best;
}
const capeTop = (x, z) => 1.2 + .28 * ss(0, -3, z) + .14 * (fbm(x * .9 + 5, z * .9, 2) - .5) - .25 * ss(1.6, 3.2, z);
const platW = (x, z) => .35 + 1.6 * ss(-8.7, -7.5, x) * ss(1.35, .8, z);       // 海蝕平臺的寬度：岬角東側最寬
const bump = u => Math.abs(u) < 1 ? Math.cos(u * Math.PI / 2) ** 2 : 0;
const shoreB = x => -1.0 - 1.1 * bump((x + 1) / 5) + .45 * ss(4, 5.5, x) - .5 * ss(-10.8, -12.2, x);     // 海岸線原本的走向
const EMB = x => Math.exp(-(((x - 3.0) / .75) ** 2));                                                    // 河口：海岸線在這裡平順地往陸地凹成喇叭口
const shoreZ = x => shoreB(x) - 1.3 * EMB(x);                                                            // 海岸線：z 比它小的是陸地
// 沙嘴：沿岸流由西往東帶沙，到了河口，沙順著原本海岸的走向從西岸往前堆，只伸過河口的一半左右，前端微微彎向河口裡面；河水的出口被擠到東側
const SPITP = (() => { const a = []; for (let x = 1.9; x < 3.05; x += .22) a.push([x, shoreB(x) - .08]); a.push([3.2, shoreB(3.2) - .2]); return a; })();
function spitD(x, z) { let b = 1e9, w = .3; const n = SPITP.length - 1; for (let i = 0; i < n; i++) { const d = dSeg(x, z, SPITP[i][0], SPITP[i][1], SPITP[i + 1][0], SPITP[i + 1][1]); if (d < b) { b = d; w = lerp(.3, .17, i / (n - 1)); } } spitD.w = w; return b; }
function barT(x, z) { const c = Math.cos(BAR.rot), s = Math.sin(BAR.rot), dx = x - BAR.x, dz = z - BAR.z, a = (dx * c + dz * s) / BAR.a, t = clamp(a, -1, 1), b = (-dx * s + dz * c + .5 * Math.max(0, t) ** 2) / (BAR.b * (1.25 - .55 * t)); return ss(1.35, .7, Math.hypot(a, b) * (1 + .35 * (fbm(x * 1.3 + 2, z * 1.3, 2) - .5))); }      // 沿岸流往東：沙洲西端較寬，東端被拉成細細的尾巴、彎向陸地

const RIV = (() => {
  const P = RIV_P, cr = (a, b, c, d, t) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t), out = [];
  for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 14; k++) { const t = k / 14; out.push({ x: cr(p0[0], p1[0], p2[0], p3[0], t), z: cr(p0[1], p1[1], p2[1], p3[1], t), hw: lerp(p1[2], p2[2], t), y: lerp(p1[3], p2[3], t) }); } }
  const l = P[P.length - 1]; out.push({ x: l[0], z: l[1], hw: l[2], y: l[3] });
  out.forEach((o, i) => { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], d = Math.hypot(b.x - a.x, b.z - a.z) || 1; o.tx = (b.x - a.x) / d; o.tz = (b.z - a.z) / d; });
  return out;
})();
function rivNear(x, z) { let b = 0, bd = 1e9; for (let i = 0; i < RIV.length; i++) { const dx = x - RIV[i].x, dz = z - RIV[i].z, d = dx * dx + dz * dz; if (d < bd) { bd = d; b = i; } } rivNear.d = Math.sqrt(bd); return RIV[b]; }

/* ---------- 地形（高度場）：海底、海蝕平臺、沙灘、沙丘、平原與山丘。岬角的岩壁另外用實體岩石做 ---------- */
function fieldH(x, z) {
  const q = shoreZ(x) - z, wE = ss(4.7, 5.5, x), wW = ss(-5.2, -6.4, x), wB = 1 - wE - wW; let h; fieldH.e = 9;
  if (q < 0) { const qb = shoreB(x) - z, E = EMB(x); h = lerp(qb < 0 ? Math.max(-1.7, .3 * qb - .22 * E) : Math.max(.3 * q, -.26), Math.max(-1.7, -.16 + .3 * q), wE); }
  else {
    const n = fbm(x * .3 + 4, z * .3 + 1, 4), dune = 1 - Math.abs(2 * U.vnoise(x * 1.1 + 3, z * 2.3) - 1);
    h = .11 * Math.min(q, 1.3) + .06 * ss(1.3, 3, q);
    h += wB * (.36 * dune * ss(1.1, 1.6, q) * ss(3.0, 2.3, q) * ss(-4.6, -3.6, x) * ss(1.2, .3, x) + (.3 + 2.6 * n) * ss(3.6, 6.2, q));
    h += wW * (.5 + 3.4 * n) * ss(.6, 3.4, q) + wE * (.2 + 2.2 * n) * ss(4.2, 6.6, q);
    h = lerp(h, Math.max(h, .22), wE * ss(0, .06, q));
  }
  const r = Math.hypot((x + 9.1) / 1.15, z + 4.6), hill = (2.5 + .5 * (fbm(x * .8, z * .8, 3) - .5)) * ss(3.4, 1.4, r); h = Math.max(h, hill - 2 * ss(.3, 0, hill));      // 岬角後方的山丘
  const dC = capeD(x, z), pw = platW(x, z);
  h = lerp(h, lerp(Math.max(h, -.14), -.14, ss(-2.15, -1.8, z)), ss(pw + .3, pw, dC));                                                                                // 海蝕平臺的底：細部（豆腐岩、海蝕溝）另外用細網格做
  h = Math.max(h, -.22 - .4 * Math.max(0, dSeg(x, z, -8.25, 3.0, STUMP.x, STUMP.z) - .55));                                            // 岬角前端的淺礁
  if (x > .6 && x < 5.4 && z < -.2) {                                                                                                  // 河流與河口的沙嘴
    const o = rivNear(x, z), e = rivNear.d - o.hw; fieldH.e = e;
    if (e < 0) { const t = 1 + e / o.hw; h = Math.min(h, o.y - .1 * (1 - t * t)); } else if (e < .9) h = Math.min(h, lerp(o.y + .03, h, ss(0, .9, e)));
    const ds = spitD(x, z), sw = spitD.w; if (ds < sw) h = Math.max(h, -.14 + .31 * ss(sw, sw * .25, ds));
  }
  if (x > 4.6) {                                                                                                                       // 突堤西側的積沙、外海的沙洲
    for (const xg of GROINS) { const u = xg - x; if (u > -.1 && u < 1.9 && z > WALLZ - .02) { const zs = WALLZ + 1.05 * (1 - clamp(u, 0, 1.9) / 1.9) ** 1.3, hw = z < zs ? Math.min(.12, .16 * (zs - z)) : Math.max(-1.7, .3 * (zs - z)); h = lerp(h, Math.max(h, hw), ss(1.9, 1.3, u) * ss(-.1, 0, u)); } }
    const t = barT(x, z); if (t > 0) h = Math.max(h, -.35 + .47 * t);
  }
  return h;
}
const H = new Float32Array(NV), SL = new Float32Array(NV), RD = new Float32Array(NV);
(function buildField() {
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const a = j * (NX + 1) + i; H[a] = fieldH(X0 + i * CELL, Z0 + j * CELL); RD[a] = fieldH.e; }
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const a = j * (NX + 1) + i, l = i ? a - 1 : a, r = i < NX ? a + 1 : a, u = j ? a - NX - 1 : a, d = j < NZ ? a + NX + 1 : a;
    SL[a] = Math.hypot((H[r] - H[l]) / ((r - l) * CELL || 1), (H[d] - H[u]) / ((d - u) / (NX + 1) * CELL || 1));
  }
})();
const grid = (A, x, z) => { const fx = clamp((x - X0) / CELL, 0, NX - 1e-3), fz = clamp((z - Z0) / CELL, 0, NZ - 1e-3), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, a = j * (NX + 1) + i; return (A[a] * (1 - u) + A[a + 1] * u) * (1 - v) + (A[a + NX + 1] * (1 - u) + A[a + NX + 2] * u) * v; };
const height = (x, z) => grid(H, x, z);
const P = (x, z, dy = 0) => [x, Math.max(0, height(x, z)) + dy, z];
// 海灣的水線（給沿岸漂移的沙粒用）：從海往陸地找第一個露出水面的地方
const SHORE = (() => { const out = []; for (let x = -5.3; x <= 3.9; x += .12) { let z = 1.5; while (z > -3 && height(x, z) < .012) z -= .03; out.push([x, Math.max(z, shoreB(x) - .2)]); } return out; })();

/* ---------- 海蝕平臺的細部：豆腐岩（一格格凸起的岩塊，中間是積水的裂縫）與海蝕溝（一道道朝海的岩脊和水溝） ---------- */
const PAT = { x0: -7.6, x1: -4.6, z0: -2.0, z1: 1.6, c: .025 }, TC = .955, TS = .296, RIDGES = [-.05, .34, .73];
function platPatch(x, z) {
  const dC = capeD(x, z), pw = platW(x, z), m = ss(pw + .02, pw - .16, dC) * ss(-.36, -.26, dC) * ss(-.04, -.12, height(x, z)); let rel = 0, kind = 0, hc = 0;      // 只蓋在泡著水的平臺上
  const u = (x * TC + z * TS) / .3, v = (-x * TS + z * TC) / .24, iu = Math.round(u), iv = Math.round(v), xc = iu * .3 * TC - iv * .24 * TS, zc = iu * .3 * TS + iv * .24 * TC, dc = capeD(xc, zc);
  if (zc < -.45 && zc > -1.85 && dc > .26 && dc < platW(xc, zc) - .42 && height(xc, zc) < -.1 && U.hash(iu * 3 + 1, iv * 7 + 2) > .1) {       // 豆腐岩：整塊都在平臺裡面的才長出來，不會在邊緣被切掉半塊
    const d = Math.min((.5 - Math.abs(u - iu)) * .3, (.5 - Math.abs(v - iv)) * .24); rel = (.06 + .045 * U.hash(iu, iv)) * ss(.012, .055, d); kind = 1; hc = U.hash(iu + 9, iv);
  } else for (const zk of RIDGES) {                                                                                                          // 海蝕溝：三道從崖腳伸向大海的岩脊，中間是水溝
    const pk = platW(x, zk), al = clamp(dC, .3, pk - .36), rr = Math.hypot(dC - al, z - zk - .04 * Math.sin(dC * 5 + zk * 9));
    if (pk > 1.0 && rr < .15) { rel = .1 * ss(.15, .05, rr) * (.8 + .3 * fbm(x * 3, z * 3, 2)); kind = 2; } }
  platPatch.m = m; platPatch.rel = rel; platPatch.wg = kind === 2 ? 1 : 0; platPatch.hc = hc;
  return lerp(height(x, z), -.045 + rel, m) + .006;
}
function patchTexture() {
  const W = 480, Hh = 576, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  const mix = (a, b, t) => { a[0] += (b[0] - a[0]) * t; a[1] += (b[1] - a[1]) * t; a[2] += (b[2] - a[2]) * t; return a; };
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const x = PAT.x0 + (i + .5) / W * (PAT.x1 - PAT.x0), z = PAT.z0 + (j + .5) / Hh * (PAT.z1 - PAT.z0); platPatch(x, z);
    const rel = platPatch.rel, wg = platPatch.wg, top = clamp(rel / .06, 0, 1), n = fbm(x * 7, z * 7, 2), hs = U.hash(i, j);
    const col = mix([52, 72, 76], [84, 84, 72], ss(-.05, 0, rel));                                           // 水溝底 → 溼溼的平臺面
    mix(col, mix(mix([192, 168, 124], [216, 194, 152], platPatch.hc), [150, 128, 96], wg), top);              // 岩塊、岩脊的頂面
    mix(col, mix([86, 140, 54], [120, 168, 70], n), wg * top * ss(.3, .5, n + .15));                          // 海蝕溝的岩脊上長滿綠色的藻類
    const k = .9 + .2 * hs, o = (j * W + i) * 4; d[o] = col[0] * k; d[o + 1] = col[1] * k; d[o + 2] = col[2] * k; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
}
function patchGeo() {
  const nx = Math.round((PAT.x1 - PAT.x0) / PAT.c), nz = Math.round((PAT.z1 - PAT.z0) / PAT.c), pos = [], uv = [], ms = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = PAT.x0 + i * PAT.c, z = PAT.z0 + j * PAT.c; pos.push(x, platPatch(x, z), z); uv.push(i / nx, j / nz); ms.push(platPatch.m); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; if (ms[a] + ms[b] + ms[c] + ms[d] > .02) idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}

/* ---------- 岬角的岩石：用距離函數描述（可以有凹壁、洞、拱門），再轉成網格 ---------- */
function rockF(x, y, z) {         // <0 在岩石裡面
  const cd = capeD(x, z), mz = (FIN.z0 + FIN.z1) / 2, qx = Math.abs(x - FIN.x - .1 * Math.sin(z * 1.3)) - FIN.hw + .2, qz = Math.abs(z - mz) - (FIN.z1 - FIN.z0) / 2 + .2;
  const fd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - .2, sr = Math.hypot(x - STACK.x, z - STACK.z), pr = Math.hypot(x - STUMP.x, z - STUMP.z);
  if (cd > .45 && fd > .45 && sr > STACK.r + .45 && pr > .8) return .4;
  const n = .2 * (fbm(x * 1.7 + y * .8, z * 1.7 - y * .6, 3) - .5) + .035 * Math.sin(y * 14 + x * 1.3 + z * .8), notch = .2 * Math.exp(-(((y - .13) / .15) ** 2));      // 岩面的凹凸；海面附近的海蝕凹壁
  let f = Math.max(cd + n + notch, y - capeTop(x, z));
  f = Math.max(f, (1 - Math.hypot((x - CAVE.x) / CAVE.rx, (y - CAVE.y) / CAVE.ry, (z - CAVE.z) / CAVE.rz)) * .35);                                                          // 海蝕洞
  let a = Math.max(fd + n * .8 + notch * .6, y - (FIN.top - .1 * (z - FIN.z0) + .1 * (fbm(x * 2, z * 2, 2) - .5)));
  a = Math.max(a, (1 - Math.hypot((z - HOLE.z) / HOLE.rz, (y - HOLE.y) / HOLE.ry)) * .4);                                                                                   // 海蝕門
  f = Math.min(f, a);
  f = Math.min(f, Math.max(sr - STACK.r * (1.08 - .2 * y) + n * .7 + notch * .5, y - STACK.h + 1.6 * sr * sr));                                                             // 海蝕柱
  return Math.min(f, (Math.hypot((x - STUMP.x) / .36, (y + .06) / .2, (z - STUMP.z) / .3) - 1) * .22 + n * .3);                                                             // 礁石
}
function surfaceNets(f, x0, y0, z0, nx, ny, nz, c) {
  const sx = nx + 1, sy = ny + 1, V = new Float32Array(sx * sy * (nz + 1)), I = (i, j, k) => (k * sy + j) * sx + i, C = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[I(i, j, k)] = f(x0 + i * c, y0 + j * c, z0 + k * c);
  const vid = new Int32Array(nx * ny * nz).fill(-1), pos = [], idx = [], v = new Float32Array(8), ED = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let m = 0; for (let q = 0; q < 8; q++) { v[q] = V[I(i + (q & 1), j + ((q >> 1) & 1), k + (q >> 2))]; if (v[q] < 0) m |= 1 << q; }
    if (m === 0 || m === 255) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (const [a, b] of ED) { if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]); px += (a & 1) + t * ((b & 1) - (a & 1)); py += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1)); pz += (a >> 2) + t * ((b >> 2) - (a >> 2)); n++; }
    vid[C(i, j, k)] = pos.length / 3; pos.push(x0 + (i + px / n) * c, y0 + (j + py / n) * c, z0 + (k + pz / n) * c);
  }
  const quad = (a, b, cc, d, flip) => { if (a < 0 || b < 0 || cc < 0 || d < 0) return; if (flip) idx.push(a, cc, b, a, d, cc); else idx.push(a, b, cc, a, cc, d); };
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const s = V[I(i, j, k)] < 0;
    if (i < nx && j > 0 && k > 0 && j < ny && k < nz && s !== (V[I(i + 1, j, k)] < 0)) quad(vid[C(i, j - 1, k - 1)], vid[C(i, j, k - 1)], vid[C(i, j, k)], vid[C(i, j - 1, k)], !s);
    if (j < ny && i > 0 && k > 0 && i < nx && k < nz && s !== (V[I(i, j + 1, k)] < 0)) quad(vid[C(i - 1, j, k - 1)], vid[C(i, j, k - 1)], vid[C(i, j, k)], vid[C(i - 1, j, k)], s);
    if (k < nz && i > 0 && j > 0 && i < nx && j < ny && s !== (V[I(i, j, k + 1)] < 0)) quad(vid[C(i - 1, j - 1, k)], vid[C(i, j - 1, k)], vid[C(i, j, k)], vid[C(i - 1, j, k)], !s);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
const GLSL_N = `float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }`;
function rockMaterial() {         // 逐像素上色：傾斜的砂岩層理、頂面較淺、海面附近溼而深、岬角根部長草、風稜石旁的砂地
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vWn = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;\n' + GLSL_N)
      .replace('#include <color_fragment>', `vec3 p = vWp; float nn = vnoise(p.xz * 3.0 + p.y * 2.0), fine = vnoise(p.xz * 14.0 + p.y * 11.0);
        float v = (p.y + 0.11 * p.x - 0.06 * p.z + 0.25 * vnoise(p.xz * 0.6)) / 0.3, b = floor(v), fr = v - b, hsel = hsh(vec2(b, 5.0));
        vec3 rc = mix(vec3(0.74, 0.61, 0.43), vec3(0.60, 0.48, 0.33), hsel); rc = mix(rc, vec3(0.82, 0.71, 0.52), step(0.66, hsel));
        rc *= 1.0 - 0.24 * smoothstep(0.14, 0.0, fr); rc *= 0.86 + 0.18 * nn + 0.1 * fine;
        float topw = smoothstep(0.55, 0.85, vWn.y);
        rc = mix(rc, vec3(0.76, 0.67, 0.50) * (0.9 + 0.2 * nn), topw * 0.75);
        rc = mix(rc, rc * vec3(0.46, 0.48, 0.44), smoothstep(0.42, 0.05, p.y) * 0.8); rc = mix(rc, vec3(0.20, 0.30, 0.18), smoothstep(0.2, 0.0, p.y) * 0.35);
        rc = mix(rc, vec3(0.86, 0.78, 0.58) * (0.94 + 0.12 * fine), topw * smoothstep(1.0, 0.55, length((p.xz - vec2(${SANDP[0].toFixed(2)}, ${SANDP[1].toFixed(2)})) / vec2(0.95, 0.7))));
        rc = mix(rc, vec3(0.40, 0.58, 0.27) * (0.85 + 0.3 * nn), topw * smoothstep(-2.3, -3.1, p.z));
        diffuseColor.rgb = pow(rc, vec3(2.2));`);
  };
  return m;
}

/* ---------- 地表貼圖：逐像素依海岸類型、離岸距離、坡度上色 ---------- */
const FARM = [[150, 190, 92], [198, 190, 106], [112, 160, 78], [172, 142, 98], [134, 182, 112], [176, 200, 110]];
function groundTexture(W, Hh) {
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  const mix = (a, b, t) => { a[0] += (b[0] - a[0]) * t; a[1] += (b[1] - a[1]) * t; a[2] += (b[2] - a[2]) * t; return a; };
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const x = X0 + (i + .5) / W * (X1 - X0), z = Z0 + (j + .5) / Hh * (Z1 - Z0), h = height(x, z), sl = grid(SL, x, z), rd = grid(RD, x, z), q = shoreZ(x) - z, dC = capeD(x, z), pw = platW(x, z);
    const wE = ss(4.7, 5.5, x), wW = ss(-5.2, -6.4, x), wB = 1 - wE - wW, n = fbm(x * 1.6, z * 1.6, 3), hs = U.hash(i, j);
    const col = mix([126, 174, 86], [62, 118, 60], clamp(fbm(x * .5 + 2, z * .5, 3) * 1.7 - .35, 0, 1));
    const farm = wB * ss(3.25, 3.6, q) * ss(.25, .1, sl) * ss(1.0, .6, h) * ss(.5, .9, rd);
    if (farm > 0) {       // 海灣後方的農田
      const ru = x * .955 + z * .296, rv = -x * .296 + z * .955, fu = ru / 1.1, fv = rv / .75, iu = Math.floor(fu), iv = Math.floor(fv), k = U.hash(iu * 7 + 3, iv * 13 + 1);
      const fc = FARM[(k * FARM.length) | 0].slice(), b = 1 + .05 * Math.sin((k < .5 ? rv : ru) * 46), edge = Math.min((fu - iu) * 1.1, (1 - fu + iu) * 1.1, (fv - iv) * .75, (1 - fv + iv) * .75);
      fc[0] *= b; fc[1] *= b; fc[2] *= b; if (edge < .045) mix(fc, [186, 172, 134], .85); mix(col, fc, farm);
    }
    mix(col, [196, 188, 170], wE * ss(3.9, 3.3, q) * ss(0, .1, q) * .6);                                                 // 聚落的地面
    if (wE > .5 && z > WALLZ - .56 && z < WALLZ - .32) mix(col, [124, 124, 128], .9);                                    // 海堤後面的道路
    mix(col, mix([150, 128, 96], [182, 158, 120], n), Math.max(ss(1.3, 2.1, sl), wW * ss(.9, .3, q) * ss(-.2, .1, q)) * .9);   // 陡坡與西段海邊露出岩石
    const sandy = wB * ss(3.15, 2.7, q);                                                                                 // 沙灘、沙丘、沙嘴
    mix(col, hs < .5 ? [236, 220, 174] : [226, 208, 160], sandy);
    if (sandy > 0 && q > 1.2) mix(col, [118, 158, 84], ss(.5, .6, fbm(x * 4.5, z * 4.5, 2)) * ss(1.2, 1.7, q) * .75 * sandy);   // 沙丘上一叢叢的草
    if (h >= 0) mix(col, [202, 184, 140], ss(.05, 0, h) * sandy);                                                        // 水邊溼溼的沙
    mix(col, hs < .33 ? [176, 172, 164] : hs < .66 ? [140, 136, 128] : [204, 200, 190], ss(-5.5, -5.2, x) * ss(-2.3, -2.9, x) * ss(1.6, 1.2, q) * ss(pw + .15, pw + .45, dC));   // 礫石灘
    const pm = ss(pw + .28, pw + .05, dC) * ss(.04, -.04, h);
    if (pm > 0) {         // 海蝕平臺的底（泡在淺水裡）
      const rock = mix([96, 90, 76], [124, 112, 90], n); mix(rock, [84, 108, 70], ss(pw - .5, pw, dC) * .5); mix(col, rock, pm);
    }
    mix(col, [150, 146, 128], ss(.06, -.02, rd));                                                                        // 河床
    if (x > 4.6 && z > WALLZ && h > -.3) mix(col, [232, 216, 170], ss(-.3, -.05, h));                                    // 突堤旁的積沙、外海沙洲
    if (h < .02) { mix(col, [208, 194, 156], ss(.02, -.05, h) * (1 - pm)); mix(col, [112, 146, 150], ss(-.3, -1.5, h) * .7); mix(col, [96, 90, 80], ss(2.2, 1.2, dC) * ss(0, -.1, h) * .7); }
    const k = .92 + .16 * hs, o = (j * W + i) * 4; d[o] = col[0] * k; d[o + 1] = col[1] * k; d[o + 2] = col[2] * k; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
}

/* ---------- 四面側牆的剖面：表土 → 沙層 → 傾斜的砂岩層（傾斜方向與岬角的岩層相同）。顏色只由 (x,y,z) 決定，轉角會接起來 ---------- */
const WALLS = [
  { len: X1 - X0, at: s => [X0 + s, Z1], sc: 44, shade: 1 },
  { len: Z1 - Z0, at: s => [X0, Z0 + s], sc: 36, shade: .84 },
  { len: X1 - X0, at: s => [X1 - s, Z0], sc: 36, shade: .78 },
  { len: Z1 - Z0, at: s => [X1, Z1 - s], sc: 36, shade: .9 }];
const ROCKC = [[184, 155, 110], [158, 132, 94], [200, 172, 128], [142, 118, 86], [170, 146, 108], [206, 184, 142]];
const ALLU = [[226, 208, 162], [208, 190, 146], [236, 220, 176], [196, 180, 140]];
function section(w) {
  const sc = Math.round(w.sc * (G.coarse ? .7 : 1)), W = Math.round(w.len * sc), Hh = Math.round((YT - YB) * sc);
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  for (let i = 0; i < W; i++) {
    const [x, z] = w.at((i + .5) / W * w.len), hT = height(x, z), q = shoreZ(x) - z, wE = ss(4.7, 5.5, x), wW = ss(-5.2, -6.4, x);
    const A = (.6 * (1 - wW) * ss(3.6, 2.2, q) + .2 * wE) * ss(1.2, .5, hT), sandTop = (1 - wW - wE) * ss(3.15, 2.7, q) > .5, ts = hT > .04 && !sandTop ? .1 : 0;
    const wob = .3 * fbm(x * .25 + 9, z * .25, 2), wob2 = .12 * fbm(x * .8, z * .8, 2);
    for (let j = Math.max(0, Math.floor((YT - hT - .15) / (YT - YB) * Hh)); j < Hh; j++) {
      const y = YT - (j + .5) / Hh * (YT - YB), dp = hT - y, hs = U.hash(i, j); let col;
      if (dp < .04) col = hT < .03 || sandTop ? [222, 206, 164] : [93, 154, 62];
      else if (dp < ts) col = [84, 62, 44];
      else if (dp < ts + A) col = ALLU[(U.hash(Math.floor((y + wob2) / .14), 3) * 4) | 0];
      else { const v = (y + .11 * x - .06 * z + wob) / .42, b = Math.floor(v); col = ROCKC[(U.hash(b, 5) * 6) | 0]; if (v - b < .08) col = [col[0] * .72, col[1] * .72, col[2] * .72]; }
      const k = (.93 + .14 * hs) * (1 - .14 * ss(0, YB, y)), o = (j * W + i) * 4; d[o] = col[0] * k; d[o + 1] = col[1] * k; d[o + 2] = col[2] * k; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function wallGeo(w) {
  const pos = [], uv = [], idx = [], n = Math.round(w.len / CELL);
  for (let i = 0; i <= n; i++) { const [x, z] = w.at(i * w.len / n), y = height(x, z), u = i / n; pos.push(x, y, z, x, YB, z); uv.push(u, (y - YB) / (YT - YB), u, 0); }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); return geo;
}

/* ---------- 建立場景 ---------- */
function build() {
  const T = THREE, scene = new T.Scene(); scene.background = U.skyTexture('#6fb4e8', '#eef3ea'); scene.fog = new T.Fog(0xe6eef0, 70, 170);
  const SUN = [.5, .74, .45], sun = U.addSun(scene, 17); sun.position.set(SUN[0] * 60, SUN[1] * 60, SUN[2] * 60);       // 這一區的陽光從東南方來，面向海灣的岩壁才照得到
  scene.add(U.groundShadow(46, 30, YB - .05));
  const anim = [], rnd = U.rng(57), detail = U.detailTexture(14, 7);
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SC = new T.Vector3(), E3 = new T.Euler(), col = new T.Color(), UP = new T.Vector3(0, 1, 0);
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };

  // 地形與側牆
  const pos = new Float32Array(NV * 3), uvs = new Float32Array(NV * 2), idx = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const a = j * (NX + 1) + i; pos[a * 3] = X0 + i * CELL; pos[a * 3 + 1] = H[a]; pos[a * 3 + 2] = Z0 + j * CELL; uvs[a * 2] = i / NX; uvs[a * 2 + 1] = j / NZ; }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.BufferAttribute(uvs, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  scene.add(U.shadowed(new T.Mesh(tg, new T.MeshStandardMaterial({ map: G.coarse ? groundTexture(512, 256) : groundTexture(1024, 512), bumpMap: detail, bumpScale: 1.5, roughness: .95 })), false, true));
  for (const w of WALLS) scene.add(new T.Mesh(wallGeo(w), new T.MeshBasicMaterial({ map: section(w), color: new T.Color(w.shade, w.shade, w.shade), toneMapped: false, side: T.DoubleSide })));

  // 岬角的岩石（海蝕崖、凹壁、洞、門、柱）
  const RC = G.coarse ? .11 : .09, rx0 = -11.3, ry0 = -.75, rz0 = -3.7;
  scene.add(U.shadowed(new T.Mesh(surfaceNets(rockF, rx0, ry0, rz0, Math.ceil(5.2 / RC), Math.ceil(2.75 / RC), Math.ceil(10.8 / RC), RC), rockMaterial())));

  // 海：波浪朝陸地（-z）前進
  const seaM = U.seaMaterials(-Math.PI / 2, 1.6, [-.9, 3.4, .88], [-8.2, 2.8, .95]);      // 岬角與消波塊前浪大；海灣（x≈-0.9 一帶）的浪只剩兩成 seaM.top.uniforms.uSun.value.set(...SUN).normalize();
  scene.add(U.buildSea(seaM, X0, X1, -3.1, Z1, height, 0, 0, 'EWS'));

  // 河：從後方的山丘流到河口
  const rp = [], rU = [], rT = [], rF = [], ri = []; let tau = 0, nr = 0;
  RIV.forEach((o, i) => { if (o.y < -.11) return; if (i) tau += .12; const yw = Math.max(o.y - .02, .006), fade = ss(-.1, -.07, o.y) * ss(0, 3, i);
    for (let k = 0; k <= 4; k++) { const u = (k / 4 * 2 - 1) * 1.1; rp.push(o.x - o.tz * u * o.hw, yw, o.z + o.tx * u * o.hw); rU.push(u); rT.push(tau); rF.push(fade); }
    if (nr) for (let k = 0; k < 4; k++) { const a = (nr - 1) * 5 + k, b = a + 1, c = a + 5, d = c + 1; ri.push(a, c, b, b, c, d); } nr++; });
  const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rp, 3)); rg.setAttribute('aU', new T.Float32BufferAttribute(rU, 1)); rg.setAttribute('aTau', new T.Float32BufferAttribute(rT, 1)); rg.setAttribute('aFade', new T.Float32BufferAttribute(rF, 1)); rg.setIndex(ri);
  const river = new T.Mesh(rg, new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { uTime: U.time },
    vertexShader: `attribute float aU, aTau, aFade; varying float vU, vTau, vFade; void main(){ vU = aU; vTau = aTau; vFade = aFade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying float vU, vTau, vFade; ${GLSL_N}
      void main(){ vec2 p = vec2(vU * 1.3, (vTau - uTime * .9) * 1.7); float st = vnoise(p * vec2(2.2, 1.0)) * .62 + vnoise(p * vec2(4.6, 2.6) + 7.3) * .38;
        vec3 col = mix(vec3(.24, .62, .78), vec3(.4, .62, .6), .35); col += .1 * smoothstep(.52, .78, st);
        gl_FragColor = vec4(pow(col, vec3(2.2)), .82 * vFade * smoothstep(1.1, .95, abs(vU)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` }));
  river.renderOrder = 4; river.frustumCulled = false; scene.add(river);

  /* ----- 岬角上：蕈狀岩、蜂窩岩、風稜石、被風吹著跑的砂粒 ----- */
  const pits = (g, r, n, w, h, a, b) => { for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, q = a + r() * b; g.fillStyle = 'rgba(214,180,128,.55)'; g.beginPath(); g.arc(x, y, q + 1, 0, 7); g.fill(); g.fillStyle = '#3a2916'; g.beginPath(); g.arc(x + .4, y + .6, q, 0, 7); g.fill(); } };
  // 頭部：含許多生物碎屑的砂岩，顏色深、質地硬，表面布滿風化的小洞；頸部：土黃色的砂岩，有一層層的紋理
  const headTex = tex(256, 256, g => { const r = U.rng(12); g.fillStyle = '#7b5c3c'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 500; i++) { g.fillStyle = r() < .5 ? 'rgba(96,72,46,.5)' : 'rgba(140,108,72,.45)'; g.fillRect(r() * 256, r() * 256, 3 + r() * 9, 2 + r() * 5); } pits(g, r, 520, 256, 256, 1.6, 3.2); });
  headTex.wrapS = headTex.wrapT = T.RepeatWrapping;
  const neckTex = tex(128, 128, g => { const r = U.rng(5); g.fillStyle = '#dcbf7e'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 400; i++) { g.fillStyle = r() < .5 ? 'rgba(196,160,96,.5)' : 'rgba(236,212,156,.5)'; g.fillRect(r() * 128, r() * 128, 2 + r() * 8, 1 + r() * 2); }
    g.strokeStyle = 'rgba(150,112,60,.45)'; g.lineWidth = 1.2; for (let y = 6; y < 128; y += 9) { g.beginPath(); g.moveTo(0, y + r() * 3); g.lineTo(128, y + r() * 3); g.stroke(); } });
  neckTex.wrapS = neckTex.wrapT = T.RepeatWrapping;
  const headMat = new T.MeshStandardMaterial({ map: headTex, bumpMap: headTex, bumpScale: 2.5, roughness: .95 }), neckMat = new T.MeshStandardMaterial({ map: neckTex, bumpMap: U.detailTexture(2, 2), bumpScale: 1.5, roughness: .9 });
  const lathe = (pr, seg) => new T.LatheGeometry(new T.SplineCurve(pr.map(q => new T.Vector2(q[0], q[1]))).getPoints(26).map(v => (v.x = Math.max(v.x, 0), v)), seg);
  const rough = (geo, seed, amp, fn) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + amp * (fbm(x * 5 + seed, z * 5 + y * 4, 3) - .5); x *= k; z *= k; if (fn) [x, y, z] = fn(x, y * (1 + (k - 1) * .6), z); p.setXYZ(i, x, y, z); } geo.computeVertexNormals(); return geo; };
  // 蕈狀岩：頸部（基座）加上頭部。頸越細，表示被侵蝕得越久
  const mushroom = (x, z, neck, sc, seed) => { const g = new T.Group(), y = capeTop(x, z) - .05;
    g.add(U.shadowed(new T.Mesh(rough(lathe([[.3, 0], [.24, .05], [neck + .05, .16], [neck, .3], [neck + .02, .4], [neck + .07, .46]], 14), seed, .25), neckMat)));
    const hd = U.shadowed(new T.Mesh(rough(new T.SphereGeometry(.27, 20, 14), seed + 3, .5, (a, b, c) => [a, b * .62 + .04 * Math.sin(a * 9 + seed), c]), headMat)); hd.position.y = .56; hd.rotation.y = seed; g.add(hd);
    g.position.set(x, y, z); g.scale.setScalar(sc); g.rotation.y = seed * 1.7; scene.add(g); };
  [[-8.85, .15, .13, 1.05], [-8.4, .9, .1, .95], [-9.3, -.4, .16, .9], [-8.45, -.65, .19, .78]].forEach((m, k) => mushroom(m[0], m[1], m[2], m[3], k * 2.3 + 1));
  { // 斷頭的蕈狀岩：只剩一截頸部，頭掉在旁邊
    const x = -9.05, z = 1.0, y = capeTop(x, z) - .05, st = U.shadowed(new T.Mesh(rough(lathe([[.28, 0], [.2, .06], [.12, .2], [.09, .3], [0, .31]], 12), 8, .25), neckMat)); st.position.set(x, y, z); scene.add(st);
    const hd = U.shadowed(new T.Mesh(rough(new T.SphereGeometry(.25, 18, 12), 9, .5, (a, b, c) => [a, b * .62, c]), headMat)); hd.position.set(x - .42, capeTop(x - .42, z + .12) + .1, z + .12); hd.rotation.z = .5; scene.add(hd); }
  // 女王頭：寬大的基座往上收成細長的頸部，頂著一顆斜斜的頭（頭頂寬、下巴尖）。整顆是一體成形的岩石，頭和頸只是砂岩的成分不同
  const QN = [-7.95, .25];
  { const HC = [.1, 1.07], ca = Math.cos(-.6), sa = Math.sin(-.6), smin = (a, b, k) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
    const headD = (x, y, z) => { const dx = x - HC[0], dy = y - HC[1], u = dx * ca + dy * sa, v = -dx * sa + dy * ca, tp = 1 - .3 * clamp(u / .37, -1, 1); return (Math.hypot(u / .37, v / (.2 * tp), z / (.19 * tp)) - 1) * .19; };
    const qf = (x, y, z) => { const r = .085 + (y < .62 ? .34 * (1 - Math.max(y, 0) / .62) ** 2.2 : 0), lean = .1 * (y / .95) ** 2, nk = Math.max(Math.hypot(x - lean, z) - r, y - 1.0);
      return smin(nk + .012 * (fbm(x * 8 + y * 5, z * 8, 2) - .5), headD(x, y, z) + .03 * (fbm(x * 9 + y * 7, z * 9 - y * 5, 2) - .5), .045); };
    const geo = surfaceNets(qf, -.62, -.03, -.5, 46, 53, 34, .03), pp = geo.attributes.position, ah = new Float32Array(pp.count);
    for (let i = 0; i < pp.count; i++) ah[i] = ss(.06, .02, headD(pp.getX(i), pp.getY(i), pp.getZ(i))); geo.setAttribute('aHead', new T.BufferAttribute(ah, 1));
    const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .93 });
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aHead; varying float vHd; varying vec3 vLp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHd = aHead; vLp = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHd; varying vec3 vLp;\n' + GLSL_N)
        .replace('#include <color_fragment>', `float pn = vnoise(vLp.xy * 46.0) * vnoise(vLp.zy * 46.0 + 7.0) * vnoise(vLp.xz * 46.0 + 3.0);
          vec3 neck = vec3(0.87, 0.74, 0.46) * (0.9 + 0.14 * vnoise(vLp.xz * 9.0 + vLp.y * 3.0)); neck *= 1.0 - 0.17 * smoothstep(0.72, 1.0, fract(vLp.y * 13.0 + 0.6 * vnoise(vLp.xz * 4.0)));
          vec3 hd = vec3(0.47, 0.34, 0.21) * (0.82 + 0.34 * vnoise(vLp.xz * 7.0 + vLp.y * 5.0)); hd = mix(hd, vec3(0.15, 0.10, 0.06), smoothstep(0.17, 0.24, pn)); hd = mix(hd, vec3(0.66, 0.52, 0.36), smoothstep(0.12, 0.16, pn) * (1.0 - smoothstep(0.16, 0.2, pn)) * 0.6);
          diffuseColor.rgb = pow(mix(neck, hd, smoothstep(0.3, 0.7, vHd)), vec3(2.2));`); };
    const queen = U.shadowed(new T.Mesh(geo, mat)); queen.position.set(QN[0], capeTop(...QN) - .04, QN[1]); queen.scale.setScalar(1.25); queen.rotation.y = .69; scene.add(queen); }
  // 蜂窩岩：一塊不規則的砂岩，表面布滿大大小小的洞
  const honeyTex = tex(256, 256, g => { const r = U.rng(31); g.fillStyle = '#c6a873'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 300; i++) { g.fillStyle = r() < .5 ? 'rgba(170,138,90,.5)' : 'rgba(222,196,146,.5)'; g.fillRect(r() * 256, r() * 256, 3 + r() * 8, 2 + r() * 4); } pits(g, r, 420, 256, 256, 2.5, 5.5); });
  honeyTex.wrapS = honeyTex.wrapT = T.RepeatWrapping; honeyTex.repeat.set(2, 1);
  const HN = [-7.75, 1.45], honey = U.shadowed(new T.Mesh(rough(new T.SphereGeometry(.34, 26, 18), 6, .55, (a, b, c) => [a * 1.25, b * .8, c]), new T.MeshStandardMaterial({ map: honeyTex, bumpMap: honeyTex, bumpScale: 3.5, roughness: .95 })));
  honey.position.set(HN[0], capeTop(...HN) + .16, HN[1]); honey.rotation.set(-1.1, .4, 0); scene.add(honey);
  const ventMat = new T.MeshStandardMaterial({ color: 0x827c73, roughness: .32, flatShading: true });
  const VENT = [[SANDP[0] - .25, SANDP[1] + .1, 1.15, .4], [SANDP[0] + .35, SANDP[1] - .2, .9, 1.6], [SANDP[0] + .15, SANDP[1] + .4, .7, 2.9]];
  for (const v of VENT) { const m = U.shadowed(new T.Mesh(new T.ConeGeometry(.2, .2, 3), ventMat)); m.scale.set(1.3 * v[2], .85 * v[2], .9 * v[2]); m.position.set(v[0], capeTop(v[0], v[1]) + .06 * v[2], v[1]); m.rotation.y = v[3]; scene.add(m); }
  const NW = G.coarse ? 50 : 84, wind = new T.InstancedMesh(new T.PlaneGeometry(.42, .018).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: .8, depthWrite: false, side: T.DoubleSide }), NW);
  const WD = [.6, -.8], wps = Array.from({ length: NW }, () => ({ s: rnd() * 5.4, l: (rnd() * 2 - 1) * 1.9, y: .05 + rnd() * rnd() * .5, v: 1.3 + rnd() * 1.1 }));      // 風向：從海上斜斜吹向陸地
  wind.frustumCulled = false; scene.add(wind); const QW = new T.Quaternion().setFromAxisAngle(UP, Math.atan2(-WD[1], WD[0]));                              // 砂粒的細線順著風向排，也順著風向飛
  anim.push(t => { wps.forEach((p, k) => { const sv = ((p.s + t * p.v) % 5.4) - 2.7, x = -8.6 + WD[0] * sv - WD[1] * p.l, z = -.4 + WD[1] * sv + WD[0] * p.l, on = capeD(x, z) < -.15 ? ss(-2.7, -2.0, sv) * ss(2.7, 2.0, sv) : 0;
    M4.compose(V.set(x, capeTop(x, z) + p.y, z), QW, SC.setScalar(on)); wind.setMatrixAt(k, M4); }); wind.instanceMatrix.needsUpdate = true; });

  /* ----- 海蝕平臺的細部（豆腐岩、海蝕溝）與礫石灘的礫石 ----- */
  scene.add(U.shadowed(new T.Mesh(patchGeo(), new T.MeshStandardMaterial({ map: patchTexture(), roughness: .8, bumpMap: U.detailTexture(10, 20), bumpScale: 1.2 })), true, true));
  const NC = G.coarse ? 380 : 620, cobbles = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .65 }), NC); let nc = 0;
  for (let k = 0; k < 9000 && nc < NC; k++) { const x = -5.45 + rnd() * 3.0, z = shoreZ(x) + .3 - rnd() * 1.75, s = (.024 + rnd() * .034) * ss(-2.3, -2.9, x); if (s < .012 || capeD(x, z) < platW(x, z) + .3) continue;
    Q.setFromAxisAngle(UP, rnd() * 6); M4.compose(V.set(x, height(x, z) + s * .2, z), Q, SC.set(s * (1 + rnd() * .6), s * .55, s * (1 + rnd() * .3))); cobbles.setMatrixAt(nc, M4); cobbles.setColorAt(nc, col.setHSL(.09 + rnd() * .04, .04 + rnd() * .08, .5 + rnd() * .3)); nc++; }
  cobbles.count = nc; scene.add(U.shadowed(cobbles, true, true));

  /* ----- 海流看得見：海面上會流動的箭頭（黃＝沿岸流，白＝海浪前進的方向），沿岸流裡還有被帶著走的沙 ----- */
  const resample = (pts, st) => { const out = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { let a = pts[i - 1]; const b = pts[i]; let d = Math.hypot(b[0] - a[0], b[1] - a[1]); while (acc + d >= st) { const t = (st - acc) / d; a = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; out.push(a); d = Math.hypot(b[0] - a[0], b[1] - a[1]); acc = 0; } acc += d; } return out; };
  const flow = (pts, w, color, speed) => { const p = [], uv = [], ix = [], n = pts.length, ul = w * 2.6;
    pts.forEach((q, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, e = w * ss(0, 6, i) * ss(n - 1, n - 7, i);
      p.push(q[0] + nx * e, .3, q[1] + nz * e, q[0] - nx * e, .3, q[1] - nz * e); uv.push(i * .12 / ul, 0, i * .12 / ul, 1); if (i) { const k = i * 2; ix.push(k - 2, k - 1, k, k - 1, k + 1, k); } });
    const map = tex(64, 64, g => { g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(14, 12); g.lineTo(44, 32); g.lineTo(14, 52); g.stroke(); }); map.wrapS = T.RepeatWrapping;
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(ix);
    const mat = new T.MeshBasicMaterial({ map, color, transparent: true, opacity: .35, depthWrite: false, side: T.DoubleSide, toneMapped: false }), m = new T.Mesh(geo, mat); m.renderOrder = 5; m.frustumCulled = false; scene.add(m);
    anim.push((t, dt) => { map.offset.x -= dt * speed / ul; }); return mat; };
  const sm = SHORE.map((q, i) => { let z = 0, c = 0; for (let k = -4; k <= 4; k++) { const o = SHORE[i + k]; if (o) { z += o[1]; c++; } } return [q[0], z / c + .6]; });
  const LS = resample([...sm, [4.5, -.3], [5.2, .55], [6.2, 1.15], [7.5, 1.3], [12.9, 1.3]], .12);
  const drift = flow(LS, .12, 0xffd84a, .75);
  const swell = [[-9.75, 3.9], [-6.2, 1.7], [-1.5, .2], [7.3, 1.9]].map((a, k) => flow(resample([[a[0], 6.9], [a[0], a[1]]], .12), .1, 0xffffff, k === 2 ? .55 : 1.3));
  const barFlow = flow(resample([[3.6, 5.75], [5.6, 5.85], [8, 5.5], [10.6, 4.85], [12.8, 3.9]], .12), .12, 0xffd84a, .75);      // 沙洲外側的沿岸流
  const mig = flow(resample([[5.6, 4.95], [7.6, 4.35]], .12), .17, 0xff4a3a, .45); mig.opacity = 0;                              // 沙洲移動的方向（開「變動的海岸」時顯示）
  const NS = G.coarse ? 70 : 110, sandG = new T.InstancedMesh(new T.SphereGeometry(.024, 6, 5), new T.MeshBasicMaterial({ color: 0xa87838 }), NS), sps = Array.from({ length: NS }, () => ({ s: rnd() * (LS.length - 1), u: (rnd() * 2 - 1) * .22, v: .7 + rnd() * .5 }));
  sandG.frustumCulled = false; scene.add(sandG); const QI = new T.Quaternion();
  anim.push((t, dt) => { sps.forEach((q, k) => { q.s += dt * q.v * .75 / .12; if (q.s >= LS.length - 1) q.s = 0; const i = q.s | 0, a = LS[i], b = LS[i + 1], e = ss(0, 8, q.s) * ss(LS.length - 1, LS.length - 9, q.s);
    M4.compose(V.set(a[0] - (b[1] - a[1]) / .12 * q.u, .06, a[1] + (b[0] - a[0]) / .12 * q.u - .12), QI, SC.setScalar(e)); sandG.setMatrixAt(k, M4); }); sandG.instanceMatrix.needsUpdate = true; });

  /* ----- 海岸工程：海堤、消波塊、突堤 ----- */
  const prism = (xa, xb, pf) => { const p = [], n = pf.length;
    for (let i = 0; i < n; i++) { const a = pf[i], b = pf[(i + 1) % n]; p.push(xa, a[1], a[0], xb, a[1], a[0], xb, b[1], b[0], xa, a[1], a[0], xb, b[1], b[0], xa, b[1], b[0]); }
    for (let i = 1; i < n - 1; i++) for (const xx of [xa, xb]) p.push(xx, pf[0][1], pf[0][0], xx, pf[i][1], pf[i][0], xx, pf[i + 1][1], pf[i + 1][0]);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.computeVertexNormals(); return geo; };
  const conc = new T.MeshStandardMaterial({ color: 0xc4c0b6, roughness: .9, side: T.DoubleSide, bumpMap: U.detailTexture(8, 1), bumpScale: 1 });
  scene.add(U.shadowed(new T.Mesh(prism(4.95, X1, [[WALLZ - .29, .2], [WALLZ - .23, .58], [WALLZ - .11, .58], [WALLZ + .09, -.3], [WALLZ - .29, -.3]]), conc), true, false));
  for (const xg of GROINS) { const m = U.shadowed(new T.Mesh(new T.BoxGeometry(.2, .62, 1.36), conc)); m.position.set(xg, -.1, WALLZ + .62); scene.add(m); }
  const leg = () => new T.CylinderGeometry(.03, .05, .17, 6).translate(0, .085, 0);
  const tpGeo = U.merge([[leg(), '#bcb8ae'], ...[0, 1, 2].map(k => [leg().rotateZ(1.911).rotateY(k * 2.094), '#aeaaa0'])]);
  const NTP = 150, tps = new T.InstancedMesh(tpGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .9 }), NTP);
  for (let k = 0; k < NTP; k++) { let x, y, z;
    if (k < 118) { const f = rnd(); x = 5.15 + rnd() * 3.5; z = WALLZ + .12 + f * .46; y = lerp(.3, -.06, f) + (rnd() - .5) * .1; } else { const xg = GROINS[k % 2], a = rnd() * Math.PI; x = xg + Math.cos(a) * .24 * (.6 + rnd() * .6); z = WALLZ + 1.3 + Math.sin(a) * .22 * rnd(); y = -.04 + rnd() * .2; }
    E3.set(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3); Q.setFromEuler(E3); M4.compose(V.set(x, y, z), Q, SC.setScalar(1.15 + rnd() * .25)); tps.setMatrixAt(k, M4); }
  scene.add(U.shadowed(tps));

  /* ----- 一波波打向海岸的浪：岬角的浪大，海灣裡的浪小；浪頭打到岩石和消波塊時濺起浪花 ----- */
  const waveData = (() => { const W = 520, Hh = 280, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;      // R：這裡可不可以有浪頭（岩石、陸地、太淺的地方不行）；G：水深造成的浪高比例
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const x = X0 + (i + .5) / W * (X1 - X0), z = Z0 + (j + .5) / Hh * (Z1 - Z0), h = height(x, z), o = (j * W + i) * 4;
      d[o] = 255 * ss(.06, .22, rockF(x, .12, z)) * ss(-.03, -.12, h); d[o + 1] = 255 * ss(0, .5, -h); d[o + 3] = 255; }
    g.putImageData(img, 0, 0); const t = new T.CanvasTexture(c); t.flipY = false; t.colorSpace = T.NoColorSpace; return t; })();
  const SU = seaM.top.uniforms, waveMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide,
    uniforms: { uTime: U.time, uAmp: SU.uAmp, uRot: SU.uRot, uCalm: SU.uCalm, uBoost: SU.uBoost, uData: { value: waveData }, uBox: { value: new T.Vector4(X0, Z0, 1 / (X1 - X0), 1 / (Z1 - Z0)) } },
    vertexShader: `uniform float uTime, uAmp; uniform vec2 uRot; uniform vec3 uCalm, uBoost; uniform sampler2D uData; uniform vec4 uBox; attribute float aA; varying float vA; varying vec2 vUv;
      float wv(vec2 p, vec2 d, float L, float A, float ph){ float k = 6.2831853 / L; return A * sin(k * dot(d, p) - sqrt(9.8 * k) * uTime * .45 + ph); }
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vUv = (w.xz - uBox.xy) * uBox.zw; vA = aA;
        float amp = texture2D(uData, vUv).g * uAmp * (1.0 - uCalm.z * exp(-pow((w.x - uCalm.x) / uCalm.y, 2.0))) * (1.0 + uBoost.z * exp(-pow((w.x - uBoost.x) / uBoost.y, 2.0)));
        vec2 q = vec2(uRot.x * w.x - uRot.y * w.z, uRot.y * w.x + uRot.x * w.z);
        w.y += wv(q, normalize(vec2(-1.0, 0.25)), 3.2, 0.045 * amp, 0.0) + wv(q, normalize(vec2(-1.0, -0.4)), 1.9, 0.028 * amp, 1.7) + wv(q, normalize(vec2(-0.6, 0.8)), 1.1, 0.014 * amp, 3.1);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uData; varying float vA; varying vec2 vUv; void main(){ gl_FragColor = vec4(1.0, 1.0, 1.0, vA * texture2D(uData, vUv).r); }` }), dropGeo = new T.SphereGeometry(.036, 5, 4), foamGeo = new T.CircleGeometry(.3, 18).rotateX(-Math.PI / 2), dropMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .92 });
  const waveGeo = hl => { const p = [], c = [], ix = [], n = Math.round(hl * 2 / .15), prof = [[.46, .02, 0], [.18, .5, .4], [0, 1, .95], [-.14, .1, 0]];
    for (let i = 0; i <= n; i++) { const x = -hl + i * .15, e = ss(hl, hl * .55, Math.abs(x)) * (.75 + .25 * Math.sin(x * 2.1 + hl)), zo = .12 * Math.sin(x * 1.3 + hl * 3);
      for (const q of prof) { p.push(x, q[1] * e, q[0] + zo); c.push(q[2] * e); }
      if (i) { const a = (i - 1) * 4; for (let k = 0; k < 3; k++) ix.push(a + k, a + k + 1, a + 4 + k, a + k + 1, a + 5 + k, a + 4 + k); } }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.setAttribute('aA', new T.Float32BufferAttribute(c, 1)); geo.setIndex(ix); return geo; };
  [ { x: -8.6, hl: 2.3, z0: 7, z1: 3.0, amp: .56, T: 6.4, n: 2, big: 1.7, hits: [[STUMP.x, STUMP.z + .25], [STACK.x, STACK.z + .42], [FIN.x, FIN.z1 + .12], [-9.25, 3.2], [-7.4, 3.25]] },
    { x: -6.1, hl: 1.15, z0: 7, z1: 1.35, amp: .46, T: 9, n: 3, big: 1.3, hits: [[-7.12, CAVE.z + .05], [-6.5, 1.45], [-5.8, 1.4]] },
    { x: -1.3, hl: 3.3, z0: 6.2, z1: -1.2, amp: .022, T: 13, n: 2, big: 0, hits: [] },
    { x: 8.7, hl: 3.7, z0: 3.2, z1: -.15, amp: .15, T: 5.6, n: 2, big: .85, hits: [[5.7, .05], [6.9, .08], [8.1, .05], [GROINS[0] + .1, .8], [GROINS[1] + .1, .8], [12.2, -.2]] } ].forEach(W => {
    const geo = waveGeo(W.hl), ND = 28, drops = new T.InstancedMesh(dropGeo, dropMat, Math.max(1, W.hits.length * ND)); drops.frustumCulled = false; scene.add(drops);
    const dd = Array.from({ length: W.hits.length * ND }, () => ({ a: rnd() * Math.PI, vh: .25 + rnd() * .75, vy: (1.0 + rnd() * 1.1) * Math.sqrt(W.big || 1), d: rnd() * .18, s: .7 + rnd() * .9 }));
    const foams = W.hits.map(() => { const m = new T.Mesh(foamGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.renderOrder = 5; scene.add(m); return m; });
    for (let c = 0; c < W.n; c++) { const m = new T.Mesh(geo, waveMat); m.renderOrder = 5; m.frustumCulled = false; scene.add(m);
      anim.push(t => { const u = (t / W.T + c / W.n) % 1; m.position.set(W.x, .03, lerp(W.z0, W.z1, u)); m.scale.y = W.amp * ss(0, .22, u) * (.55 + .45 * u) * ss(1, .93, u); }); }
    if (W.hits.length) anim.push(t => { W.hits.forEach((h, k) => { const uh = (W.z0 - h[1]) / (W.z0 - W.z1); let age = 9; for (let c = 0; c < W.n; c++) { const a = (((t / W.T + c / W.n) % 1) - uh) * W.T; if (a > 0 && a < age) age = a; }
      for (let j = 0; j < ND; j++) { const q = dd[k * ND + j], a = age - q.d, y = .05 + q.vy * a - 2.3 * a * a, on = a > 0 && y > 0;       // 水珠：拋物線，往上噴再落回海面
        M4.compose(V.set(h[0] + Math.cos(q.a) * q.vh * (on ? a : 0), on ? y : -1, h[1] + Math.sin(q.a) * q.vh * .6 * (on ? a : 0)), QI, SC.setScalar(on ? q.s * (1 - a * .4) : 0)); drops.setMatrixAt(k * ND + j, M4); }
      const f = age / .9, fm = foams[k]; fm.visible = f < 1; fm.position.set(h[0], .05, h[1]); fm.scale.setScalar(.35 + 1.4 * f); fm.material.opacity = .75 * (1 - f) * ss(0, .08, f); });
      drops.instanceMatrix.needsUpdate = true; });
  });

  /* ----- 樹（山丘上與沙丘後面的防風林）、房子、雲 ----- */
  const tr = U.rng(23), trees = [], NTR = G.coarse ? 340 : 540;
  for (let x = -4.5; x < 1.1; x += .2) for (let rr = 0; rr < 2; rr++) { const xx = x + (tr() - .5) * .1, z = shoreZ(xx) - 3.05 - rr * .24 + (tr() - .5) * .08; trees.push([xx, height(xx, z), z, .85 + tr() * .3, 0]); }
  for (let k = 0; k < 14000 && trees.length < NTR; k++) {
    const x = X0 + .25 + tr() * (X1 - X0 - .5), z = Z0 + .25 + tr() * 6.4, h = height(x, z), q = shoreZ(x) - z, wE = ss(4.7, 5.5, x), wW = ss(-5.2, -6.4, x), wB = 1 - wE - wW;
    if (h < .3 || grid(SL, x, z) > 1.7 || capeD(x, z) < .5 || grid(RD, x, z) < .45 || q < 1.2 + 2.4 * wB + 3.2 * wE) continue;
    if (wB > .5 && h < .9 && tr() > .06) continue;        // 農田裡只留零星的樹
    trees.push([x, h, z, .8 + tr() * .7, tr() < .45 ? 0 : 1]);
  }
  U.plantTrees(scene, trees, tr, .62);
  const hg = U.merge([[new T.BoxGeometry(1, .7, 1.3).translate(0, .35, 0), '#efe9dc'], [new T.CylinderGeometry(0, .95, .5, 4).rotateY(Math.PI / 4).scale(1, 1, 1.25).translate(0, .95, 0), '#b4553c']]);
  const houses = new T.InstancedMesh(hg, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 }), 44); let nh = 0;
  for (let a = 0; a < 11; a++) for (let b = 0; b < 4; b++) { if (rnd() < .22 || nh >= 44) continue; const x = 5.9 + a * .62 + (rnd() - .5) * .2, z = WALLZ - 1.05 - b * .62 + (rnd() - .5) * .16, s = .15 + rnd() * .05;
    Q.setFromAxisAngle(UP, (rnd() < .5 ? 0 : Math.PI / 2) + (rnd() - .5) * .16); M4.compose(V.set(x, height(x, z) - .01, z), Q, SC.setScalar(s)); houses.setMatrixAt(nh, M4); houses.setColorAt(nh, col.setHSL(.07, .1, .8 + rnd() * .2)); nh++; }
  houses.count = nh; scene.add(U.shadowed(houses));
  [[-9.5, 8.6, -4.5, 3.2], [-1.5, 9.2, -5.6, 2.6], [7.5, 8.8, -5, 3]].forEach((c, k) => { const cl = U.cloud(c[3], c[3] * .42, c[3] * .6, 7, rnd); cl.position.set(c[0], c[1], c[2]); scene.add(cl); anim.push(t => { cl.position.x = c[0] + Math.sin(t * .05 + k * 2) * 1.4; }); });

  /* ----- 外海沙洲以前的範圍（虛線），開「變動的海岸」時顯示 ----- */
  const op = [], oi = [], oc = Math.cos(OLD.rot), os = Math.sin(OLD.rot);
  for (let k = 0; k < 64; k += 2) { const b = op.length / 3; for (const a of [k / 64 * 6.2832, (k + 1.1) / 64 * 6.2832]) for (const rr of [.955, 1.045]) { const u = Math.cos(a) * OLD.a * rr, v = Math.sin(a) * OLD.b * rr; op.push(OLD.x + u * oc - v * os, .12, OLD.z + u * os + v * oc); } oi.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  const og = new T.BufferGeometry(); og.setAttribute('position', new T.Float32BufferAttribute(op, 3)); og.setIndex(oi);
  const oldBar = new T.Mesh(og, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: T.DoubleSide, toneMapped: false })); oldBar.renderOrder = 6; scene.add(oldBar);

  /* 節點圓點與解說標籤 */
  const zn = G.zones.coast, def = G.zoneDef('coast'), dots = {};
  for (const n of zn.nodes) dots[n.id] = G.addLabel(`<b>${n.num}</b><span>${n.title}</span>`, 'node' + (n.ready ? '' : ' soon'), n.at, { color: n.color || def.color, onClick: () => G.openNode(n.id) });
  const tag = (html, p) => G.addLabel(html, 'tag', p), ct = (x, z, dy) => [x, capeTop(x, z) + dy, z];
  const tags = {
    wind: [tag('女王頭<small>頭：含生物碎屑的砂岩，較硬<br>頸：土黃色砂岩，較軟</small>', ct(QN[0], QN[1], 2.15)), tag('蕈狀岩<small>頸部越細，被侵蝕得越久</small>', ct(-8.85, .15, 1.0)), tag('斷頭的蕈狀岩', ct(-9.15, 1.05, .6)), tag('蜂窩岩<small>鹽的結晶把砂粒撐開</small>', ct(HN[0], HN[1], .8)),
      tag('風稜石<small>被風沙磨出平面和稜線</small>', ct(SANDP[0], SANDP[1], .62)), tag('強風挾帶砂粒', ct(-9.9, -.6, .95))],
    cliff: [tag('海蝕崖<small>陡直的岩壁</small>', [-7.0, 1.75, .3]), tag('海蝕凹壁<small>海浪在崖腳挖出的凹槽</small>', [-7.0, .5, -.9]), tag('海蝕平臺<small>崖後退留下的平坦岩面</small>', [-5.6, .5, -.35]), tag('豆腐岩<small>被交叉的裂縫切成一塊塊</small>', [-6.4, .35, -1.1]),
      tag('海蝕溝<small>海浪沿著裂縫挖出一道道水溝</small>', [-5.9, .4, .5]),
      tag('① 海蝕洞<small>海浪直接打進洞裡</small>', [-7.15, 1.05, CAVE.z]), tag('② 海蝕門', [FIN.x, 1.45, HOLE.z]), tag('③ 海蝕柱', [STACK.x, 1.4, STACK.z]), tag('礁石<small>海蝕柱再被侵蝕後剩下的</small>', [STUMP.x, .45, STUMP.z])],
    sand: [tag('沙灘<small>海灣深處浪小，細沙堆積</small>', P(-.5, -2.7, .4)), tag('礫石灘<small>靠近岬角浪大，只留下礫石</small>', P(-4.0, -2.2, .4)), tag('沙丘<small>海風把沙吹成小丘</small>', P(-2.3, -4.1, .75)), tag('防風林', P(-.6, -5.3, .95)),
      tag('沿岸流<small>黃色箭頭：帶著沙往東移動</small>', [-1.6, .45, -.75]), tag('沙嘴<small>從河口西岸長出來，一端連著陸地</small>', [2.4, .5, -1.3]), tag('河口<small>出口被沙嘴擠向東側</small>', [3.7, .4, -1.75]), tag('沙洲<small>和海岸平行的長條形沙地</small>', [BAR.x - 1.2, .5, BAR.z])],
    change: [tag('海堤<small>擋住大浪</small>', [6.9, 1.0, WALLZ - .2]), tag('消波塊<small>讓海浪先碎開</small>', [6.0, .6, WALLZ + .5]), tag('突堤<small>攔住沿岸流帶來的沙</small>', [GROINS[0], .75, WALLZ + 1.25]),
      tag('西側：積沙', [GROINS[0] - .85, .4, WALLZ + .3]), tag('東側：被侵蝕', [GROINS[0] + .8, .4, WALLZ + .25]), tag('沙洲<small>白色虛線是以前的範圍<br>紅色箭頭是它移動的方向</small>', [BAR.x + .6, .7, BAR.z])],
  };

  /* 點模型：依點到的位置開啟對應的節點 */
  const surf = (x, z) => Math.max(0, height(x, z), capeD(x, z) < 0 ? capeTop(x, z) : 0);
  const hitAt = rr => { if (!rr) return null; const o = rr.ray.origin, d = rr.ray.direction; for (let t = 2; t < 110; t += .12) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < YB) break; if (x < X0 || x > X1 || z < Z0 || z > Z1) continue; if (y < surf(x, z)) return [x, z]; } return null; };
  const nodeAt = p => { if (!p) return null; const [x, z] = p, dC = capeD(x, z), q = shoreZ(x) - z;
    if (dSeg(x, z, -8.2, 2.7, STUMP.x, STUMP.z) < .9 || Math.hypot(x + 7.2, z - CAVE.z) < .6) return 'cliff';
    if (dC < -.05 && z > -2.6) return 'wind'; if (dC < platW(x, z) + .2 && z > -2.2) return 'cliff';
    if (barT(x, z) > .2 || (x > 4.9 && q < 1 && z < 1.4)) return 'change'; if (x > -5.6 && x < 4.9 && q > -.9 && q < 3.3) return 'sand'; return null; };
  let cur = null, hot = null, glow = 0;
  return {
    scene, home: { pos: [.3, 11.5, 22.5], target: [.3, .2, .2] },
    view: { minDist: 1.2, maxDist: 60, maxPolar: Math.PI * .49, pan: { x: [X0, X1], y: [YB, 4], z: [Z0, Z1] } },
    onNode: id => { cur = id; for (const k in tags) tags[k].forEach(L => L.el.classList.toggle('show', k === id)); for (const k in dots) dots[k].el.classList.toggle('cur', k === id); },
    onHover: rr => { const n = nodeAt(hitAt(rr)); if (n !== hot) { hot = n; G.canvas.style.cursor = n ? 'pointer' : ''; } },
    onTap: rr => { const n = nodeAt(hitAt(rr)); if (n && n !== G.state.nodeId) G.openNode(n); },
    update(dt, t) { const k = Math.min(1, dt * 4); glow += ((cur === 'change' ? 1 : 0) - glow) * k; oldBar.material.opacity = glow * .9; oldBar.visible = glow > .01;
      const dr = cur === 'sand' || cur === 'change' ? .62 : cur ? .2 : .36, sw = cur === 'cliff' ? .5 : cur ? .14 : .28; drift.opacity += (dr - drift.opacity) * k; barFlow.opacity = drift.opacity; mig.opacity = glow * .8; for (const m of swell) m.opacity += (sw - m.opacity) * k;      // 沿岸流、海浪的箭頭：開到相關節點時最明顯
      for (const f of anim) f(t, dt); },
    dispose() { G.canvas.style.cursor = ''; U.dispose(scene); }
  };
}

/* ---------- 圖鑑與認識頁的繪圖（SVG）：沒有實景照片時顯示 ---------- */
function cSVG(kind) {
  const r = U.rng(kind.length * 31 + kind.charCodeAt(0) * 7 + kind.charCodeAt(1)), o = [], f = n => (+n).toFixed(1), id = 'cs_' + kind; let vb = '0 0 320 200';
  const SKY = '#cfe6f3', SEA = '#5aa7d6', DEEP = '#3f8fcf', ROCK = '#b89b6e', ROCKD = '#93794f', SAND = '#ead9a6', SANDD = '#cdb882', LAND = '#9ccc74', INK = '#1f3345', GREY = ['#bdb7ad', '#8d877f', '#a59f95', '#d0cabf'];
  const R = (x, y, w, h, c, ex = '') => o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${ex}/>`);
  const Pt = (d, fill, stroke = 'none', sw = 0, ex = '') => o.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${ex}/>`);
  const Tx = (x, y, s, c = INK, size = 13, anchor = 'middle') => o.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="900" text-anchor="${anchor}" fill="${c}" paint-order="stroke" stroke="${c === '#fff' ? 'rgba(20,40,60,.75)' : '#fff'}" stroke-width="3.5" stroke-linejoin="round">${s}</text>`);
  const El = (cx, cy, rx, ry, c, ex = '') => o.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}" ${ex}/>`);
  const specks = (n, cols, x0, y0, w, h, a = .8, b = 2) => { for (let i = 0; i < n; i++) o.push(`<circle cx="${f(x0 + r() * w)}" cy="${f(y0 + r() * h)}" r="${f(a + r() * b)}" fill="${cols[i % cols.length]}"/>`); };
  const head = (x, y, dx, dy, c, w) => { const h = w * 2.6, bx = x - dx * h * .5, by = y - dy * h * .5; Pt(`M${f(x + dx * h * .5)} ${f(y + dy * h * .5)}L${f(bx - dy * h * .6)} ${f(by + dx * h * .6)}L${f(bx + dy * h * .6)} ${f(by - dx * h * .6)}Z`, c); };
  const arrow = (x1, y1, x2, y2, c = '#fff', w = 4) => { const l = Math.hypot(x2 - x1, y2 - y1), dx = (x2 - x1) / l, dy = (y2 - y1) / l; Pt(`M${f(x1)} ${f(y1)}L${f(x2 - dx * w * 2)} ${f(y2 - dy * w * 2)}`, 'none', c, w); head(x2 - dx * w * 1.3, y2 - dy * w * 1.3, dx, dy, c, w); };
  const wave = (x0, x1, y, c = '#fff', w = 2) => { let d = `M${x0} ${y}`; for (let x = x0; x < x1; x += 20) d += 'q5 -5 10 0t10 0'; Pt(d, 'none', c, w); };
  const lead = (x1, y1, x2, y2, c = INK) => Pt(`M${x1} ${y1}L${x2} ${y2}`, 'none', c, 1.5);
  const tp = (x, y, s) => { const d = `M${x} ${y}l0 ${f(-14 * s)}M${x} ${y}l${f(-12 * s)} ${f(9 * s)}M${x} ${y}l${f(12 * s)} ${f(9 * s)}`; Pt(d, 'none', '#5f5a54', 9 * s); Pt(d, 'none', '#b9b4aa', 6 * s); };       // 消波塊
  const S = (d, fill, ex = '') => `<path d="${d}" fill="${fill}" ${ex}/>`;
  // 從側面看的岬角：1 海蝕洞、2 海蝕門、3 海蝕柱（畫在 160×100 的框裡）
  const hl = st => { const xe = st < 3 ? 110 : 62, main = `M0 100V28H${xe}Q${xe + 10} 29 ${xe + 10} 40V100Z`;
    let s = `<rect width="160" height="100" fill="${SKY}"/>` + S(main, ROCK) + [40, 52, 64].map(y => `<path d="M0 ${y}L${xe + 9} ${y + 4}" stroke="${ROCKD}" stroke-width="1.2" fill="none"/>`).join('') + `<path d="M0 28H${xe}" stroke="#5d9a3e" stroke-width="4" fill="none"/>`;
    if (st === 1) s += S('M80 76V60Q91 44 102 60V76Z', '#3a2f24');
    if (st === 2) s += S('M70 76V58Q87 34 104 58V76Z', SKY, `stroke="${ROCKD}" stroke-width="1"`);
    if (st === 3) s += S('M100 100V44Q101 31 110 30Q119 31 120 44V100Z', ROCK) + `<path d="M101 46l18 2M101 58l18 2" stroke="${ROCKD}" stroke-width="1.2" fill="none"/><path d="M72 30H104" stroke="${ROCKD}" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>` + S('M78 74l6-5 6 3 2 6zM90 76l5-4 4 4z', ROCKD);
    return s + `<rect y="70" width="160" height="30" fill="${SEA}"/><path d="M0 70${'q5 -4 10 0t10 0'.repeat(8)}" stroke="#fff" stroke-width="1.5" fill="none"/>`; };
  // 從側面切開的岩岸：海蝕崖、崖腳的凹壁、崖前的平臺
  const sec = () => { const rock = 'M0 200V52H120V112Q98 121 100 130Q102 139 126 141L296 151L320 178V200Z';
    R(0, 0, 320, 200, SKY); o.push(`<defs><clipPath id="${id}"><path d="${rock}"/></clipPath></defs>`); Pt(rock, ROCK);
    o.push(`<g clip-path="url(#${id})">`); for (let y = 68; y < 200; y += 17) Pt(`M0 ${y}L320 ${y + 14}`, 'none', ROCKD, 1.5); o.push('</g>');
    Pt('M0 52H120', 'none', '#5d9a3e', 6, 'stroke-linecap="butt"'); R(100, 130, 220, 70, SEA, 'opacity=".62"'); wave(102, 320, 130); };
  const dash = 'stroke-dasharray="6 4"';

  if (kind === 'ventifact') {
    R(0, 0, 320, 200, '#f3ead2'); R(0, 150, 320, 50, '#e2cf9c'); specks(70, ['#cbb47c', '#f0e2b8'], 0, 152, 320, 46, .8, 1.6);
    Pt('M96 152L170 66L190 152Z', '#a8a39a', '#5f5a54', 1.5); Pt('M170 66L246 152L190 152Z', '#716c65', '#5f5a54', 1.5); Pt('M170 66L190 152', 'none', '#fff', 2.5);
    arrow(14, 98, 96, 98, '#3b82f6', 4.5); arrow(14, 128, 82, 128, '#3b82f6', 4.5); specks(18, ['#c9a24e', '#b88a3a'], 20, 86, 80, 50, 1.2, 1.2);
    Tx(160, 26, '強風挾帶砂粒，把石頭迎風的一面磨平'); Tx(40, 84, '風', '#1d4ed8', 13); Tx(254, 92, '稜線', INK, 12.5); lead(238, 96, 184, 108); Tx(120, 186, '迎風面：又平又光滑', INK, 12.5);
  }
  if (kind === 'mushroom') {
    R(0, 0, 320, 200, SKY); R(0, 160, 320, 40, '#cdb78a');
    [[58, 30, 32], [160, 18, 32], [262, 7.5, 30]].forEach(([cx, nk, hw]) => { Pt(`M${cx - 30} 160Q${f(cx - nk - 3)} 152 ${f(cx - nk)} 110H${f(cx + nk)}Q${f(cx + nk + 3)} 152 ${cx + 30} 160Z`, '#dcc694', '#a48a5a', 1.5); El(cx, 96, hw, 22, '#8f6d47', 'stroke="#5f4428" stroke-width="1.5"'); for (let i = 0; i < 9; i++) El(cx - hw * .7 + r() * hw * 1.4, 86 + r() * 16, 1.6, 1.4, '#6b4c2c'); });
    arrow(100, 124, 120, 124, '#dc2626', 3); arrow(202, 124, 222, 124, '#dc2626', 3);
    Tx(160, 26, '都是砂岩：上層較硬，下層較軟、被侵蝕得快'); Tx(58, 101, '硬', '#fff', 12.5); Tx(58, 142, '軟', '#7a5a14', 12.5); Tx(262, 62, '含生物碎屑', INK, 10.5); Tx(292, 146, '土黃色', INK, 10.5, 'end'); Tx(292, 158, '砂岩', INK, 10.5, 'end');
    Tx(58, 186, '① 岩層露出', INK, 12); Tx(160, 186, '② 下層變細', INK, 12); Tx(262, 186, '③ 蕈狀岩', INK, 12);
  }
  if (kind === 'honeycomb') {
    R(0, 0, 320, 200, '#c9ab78'); specks(120, ['#b8996a', '#d8be8e'], 0, 0, 320, 160, 1, 2);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 12; i++) { const x = 16 + i * 26 + (j % 2) * 13 + (r() - .5) * 6, y = 18 + j * 24 + (r() - .5) * 5, a = 8 + r() * 3.5, b = 7 + r() * 3; El(x, y, a + 1.5, b + 1.5, '#e2cc9e'); El(x, y + 1, a, b, '#5a4126'); El(x - 2, y + 3, a * .6, b * .5, '#3d2b18'); }
    R(0, 164, 320, 36, '#fff', 'opacity=".88"'); Tx(160, 187, '鹽的結晶把砂粒撐開，岩石表面布滿小洞', INK, 12.5);
  }
  if (kind === 'headbay') {
    R(0, 0, 320, 200, DEEP); Pt('M0 0H320V70Q300 76 286 110Q262 128 240 108Q226 74 160 64Q94 74 80 108Q58 128 34 110Q20 76 0 70Z', LAND); specks(40, ['#8dbd66', '#aad684'], 0, 0, 320, 56, 2, 4);
    Pt('M286 110Q262 128 240 108Q246 90 264 90Q282 92 286 110Z', ROCK, ROCKD, 1.2); Pt('M34 110Q58 128 80 108Q74 90 56 90Q38 92 34 110Z', ROCK, ROCKD, 1.2); Pt('M213 80Q186 65 160 64Q134 65 107 80Q160 94 213 80Z', SAND, SANDD, 1.2);
    wave(100, 220, 150, 'rgba(255,255,255,.6)', 2);
    arrow(36, 178, 50, 134, '#fff', 4); arrow(78, 178, 64, 134, '#fff', 4); arrow(242, 178, 256, 134, '#fff', 4); arrow(284, 178, 270, 134, '#fff', 4); arrow(140, 170, 134, 110, '#eaf6fc', 2); arrow(180, 170, 186, 110, '#eaf6fc', 2);
    Tx(57, 58, '岬角'); Tx(263, 58, '岬角'); Tx(160, 40, '海灣'); Tx(160, 84, '沙灘', '#7a5a14', 12); Tx(160, 194, '岬角浪大，侵蝕作用強；海灣浪小，容易堆積', '#fff', 12);
  }
  if (kind === 'retreat') {
    vb = '0 0 320 190'; R(0, 0, 320, 190, '#f8fafc'); o.push(`<defs><clipPath id="${id}"><rect width="100" height="150" rx="8"/></clipPath></defs>`);
    const sea = `<rect y="104" width="100" height="46" fill="${SEA}" opacity=".62"/><path d="M0 104${'q5 -4 10 0t10 0'.repeat(5)}" stroke="#fff" stroke-width="1.5" fill="none"/>`, lab = (x, y, s, c = INK) => `<text x="${x}" y="${y}" font-size="10.5" font-weight="900" text-anchor="middle" fill="${c}" paint-order="stroke" stroke="#fff" stroke-width="3">${s}</text>`;
    const old = d => `<path d="${d}" fill="none" stroke="${ROCKD}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    const pan = (k, title, body) => o.push(`<g transform="translate(${4 + k * 106} 34)"><rect width="100" height="150" rx="8" fill="${SKY}"/><g clip-path="url(#${id})">${body}</g></g><text x="${54 + k * 106}" y="22" font-size="12" font-weight="900" text-anchor="middle" fill="${INK}">${title}</text>`);
    pan(0, '① 挖出海蝕凹壁', S('M0 150V38H64V90Q48 97 50 104Q52 111 66 113L100 120V150Z', ROCK) + sea + lab(80, 92, '凹壁', '#b91c1c'));
    pan(1, '② 上方岩石崩落', S('M0 150V38H50L47 72L50 104Q52 111 66 113L100 120V150Z', ROCK) + old('M50 38H64V90') + S('M56 112l7-7 8 3 2 8zM72 116l6-5 6 5z', ROCKD) + sea + lab(78, 76, '崩落', '#b91c1c'));
    pan(2, '③ 海蝕崖後退', S('M0 150V38H30V90Q14 97 16 104Q18 111 32 113L100 120V150Z', ROCK) + old('M30 38H64V90') + sea + lab(66, 98, '海蝕平臺') + lab(48, 60, '← 後退', '#b91c1c'));
    arrow(104, 109, 111, 109, '#dc2626', 2.4); arrow(210, 109, 217, 109, '#dc2626', 2.4);
  }
  if (kind === 'notch') { sec(); El(108, 128, 26, 22, 'none', `stroke="#dc2626" stroke-width="2.5" ${dash}`); arrow(206, 124, 142, 127, '#fff', 4); Tx(226, 86, '海蝕凹壁', '#b91c1c', 14); Tx(226, 104, '崖腳被海浪挖出凹槽', INK, 11.5); Tx(60, 92, '岩壁', '#fff', 12.5); Tx(214, 30, '海浪集中拍打靠近海面的地方'); }
  if (kind === 'cliff') { sec(); Pt('M128 50V110', 'none', '#dc2626', 2.5, dash); Pt('M140 139l8-8 9 3 3 9zM160 143l6-6 7 6z', ROCKD, '#6f5a3a', 1); Tx(206, 78, '海蝕崖', '#b91c1c', 14); Tx(206, 96, '陡直的岩壁', INK, 11.5); Tx(226, 122, '崩落的岩塊', INK, 11); lead(196, 126, 164, 136); Tx(60, 92, '岩壁', '#fff', 12.5); Tx(214, 30, '凹壁上方的岩石崩落，留下陡崖'); }
  if (kind === 'platform') { sec(); Pt('M130 135L296 145', 'none', '#dc2626', 2.5, dash); Tx(214, 100, '海蝕平臺', '#b91c1c', 14); Tx(214, 118, '崖腳前平坦的岩石面', INK, 11.5); Tx(60, 92, '海蝕崖', '#fff', 12.5); Tx(214, 30, '海蝕崖後退，留下被削平的岩石'); Tx(232, 178, '漲潮時常被海水淹沒', '#fff', 11.5); }
  if (kind === 'tofu') {
    R(0, 0, 320, 200, '#3e6f8a'); o.push('<g transform="rotate(-8 160 90)">');
    for (let j = 0; j < 5; j++) for (let i = -1; i < 9; i++) { const x = -18 + i * 42, y = 30 + j * 27; R(x, y, 36, 21, ['#cdb486', '#bfa678', '#d6be92'][(i + j * 2 + 9) % 3], 'rx="5" stroke="#8a744c" stroke-width="1"'); R(x + 4, y + 3, 28, 4, '#fff', 'rx="2" opacity=".28"'); }
    o.push('</g>'); R(0, 164, 320, 36, '#fff', 'opacity=".88"'); Tx(160, 187, '海水沿著兩組交叉的裂縫侵蝕，把岩石切成一塊塊', INK, 12);
    arrow(24, 20, 70, 14, '#fde68a', 3); arrow(300, 58, 306, 104, '#fde68a', 3);
  }
  if (kind === 'groove') {
    R(0, 0, 320, 200, ROCK); specks(140, ['#a88c5f', '#c9ad7e'], 0, 0, 320, 200, 1, 2.2);
    for (const y of [58, 104, 150]) Pt(`M252 ${y - 9}Q150 ${y - 6} 60 ${y}Q150 ${y + 7} 252 ${y + 9}Z`, '#2f6f8c', '#7a6240', 1.5);
    Pt('M236 0Q222 60 240 110Q250 160 232 200H320V0Z', DEEP); Pt('M236 0Q222 60 240 110Q250 160 232 200', 'none', '#fff', 3);
    for (const y of [58, 104, 150]) arrow(306, y, 262, y, '#fff', 3.5);
    Tx(120, 26, '海浪沿著岩石的裂縫沖刷'); Tx(140, 85, '海蝕溝', INK, 13); Tx(120, 190, '挖出一條條長條形的溝'); Tx(288, 26, '大海', '#fff', 12);
  }
  if (kind === 'cave' || kind === 'arch' || kind === 'stack') {
    o.push('<g transform="scale(2)">' + hl(kind === 'cave' ? 1 : kind === 'arch' ? 2 : 3) + '</g>');
    if (kind === 'cave') { Tx(96, 112, '海蝕洞', '#fff', 14); arrow(306, 124, 218, 124, '#fff', 4); Tx(160, 188, '岩壁脆弱的地方，被海浪挖出洞穴', '#fff', 12.5); }
    if (kind === 'arch') { Tx(84, 108, '海蝕門', '#fff', 14); Tx(160, 188, '海蝕洞被打穿，變成像拱門的海蝕門', '#fff', 12.5); }
    if (kind === 'stack') { Tx(276, 84, '海蝕柱', INK, 14); Tx(176, 48, '崩落的門頂', INK, 11.5); Tx(160, 188, '門頂崩落後，外側留下孤立的岩柱', '#fff', 12.5); }
  }
  if (kind === 'seq') {
    vb = '0 0 320 100'; R(0, 0, 320, 100, '#f8fafc');
    ['① 海蝕洞', '② 海蝕門', '③ 海蝕柱'].forEach((s, k) => { o.push(`<g transform="translate(${4 + k * 106} 30) scale(.625)">${hl(k + 1)}</g><text x="${54 + k * 106}" y="20" font-size="12" font-weight="900" text-anchor="middle" fill="${INK}">${s}</text>`); });
    arrow(104, 61, 111, 61, '#dc2626', 2.4); arrow(210, 61, 217, 61, '#dc2626', 2.4);
  }
  if (kind === 'beach' || kind === 'gravel') {
    const gv = kind === 'gravel'; R(0, 0, 320, 200, SKY); R(0, 40, 320, 66, '#4d9fd4'); wave(0, 320, 58, 'rgba(255,255,255,.6)', 1.5); wave(10, 320, 78, 'rgba(255,255,255,.7)', 1.5);
    Pt('M0 100Q160 82 320 104V200H0Z', gv ? '#a9a59c' : SAND); Pt('M0 100Q160 82 320 104', 'none', '#fff', 4);
    if (gv) Array.from({ length: 190 }, () => [r() * 320, 108 + r() * 92, r(), r()]).sort((a, b) => a[1] - b[1]).forEach((q, i) => { const s = .55 + (q[1] - 100) / 90; El(q[0], q[1], (4 + q[2] * 4) * s, (2.6 + q[3] * 2) * s, GREY[i % 4], 'stroke="rgba(60,55,50,.45)" stroke-width=".8"'); });
    else specks(170, ['#d9c68e', '#f4e8c0'], 0, 108, 320, 90, .7, 1.3);
    Tx(160, 26, gv ? '浪大的海岸，細沙被帶走，留下礫石' : '浪小的海灣，細沙慢慢堆積成沙灘'); Tx(160, 188, gv ? '礫石被海浪磨得又圓又扁，坡度比較陡' : '沙粒細小，坡度平緩', INK, 12.5);
  }
  if (kind === 'dune') {
    R(0, 0, 320, 200, SKY); R(0, 140, 60, 60, SEA); wave(0, 44, 140);
    Pt('M30 200L44 140Q80 136 100 134C118 132 128 100 146 100C164 100 168 130 184 130C200 130 206 92 226 92C246 92 252 126 270 126L320 126V200Z', SAND, SANDD, 1.5); specks(90, ['#d9c68e', '#f4e8c0'], 50, 140, 270, 56, .7, 1.2);
    for (const [x, y] of [[138, 104], [150, 101], [218, 96], [230, 93], [242, 100]]) Pt(`M${x} ${y}l-3 -9M${x} ${y}l0 -11M${x} ${y}l3 -9`, 'none', '#4d8a3a', 1.6);
    for (const x of [284, 300, 314]) { R(x - 1.5, 116, 3, 12, '#6b4a2c'); Pt(`M${x - 9} 120L${x} 92L${x + 9} 120Z`, '#3a7a3a'); }
    arrow(56, 84, 118, 76, '#3b82f6', 4); arrow(150, 64, 204, 60, '#3b82f6', 4); specks(16, ['#c9a24e', '#b88a3a'], 60, 70, 150, 16, 1.1, 1);
    Tx(160, 26, '海風把乾的沙吹向內陸，堆成沙丘'); Tx(40, 70, '海風', '#1d4ed8', 12.5); Tx(84, 160, '沙灘', '#7a5a14', 12.5); Tx(186, 160, '沙丘', '#7a5a14', 13); Tx(292, 150, '防風林', INK, 11.5);
  }
  if (kind === 'bar') {
    R(0, 0, 320, 200, DEEP); Pt('M0 0H320V52Q160 66 0 52Z', LAND); Pt('M0 52Q160 66 320 52', 'none', SAND, 7); Pt('M40 66Q160 80 280 66L270 100Q160 112 50 100Z', '#7fbfd8');
    Pt('M52 108Q160 92 268 106Q284 113 268 120Q160 132 52 122Q36 115 52 108Z', SAND, SANDD, 1.5); specks(40, ['#d9c68e', '#f4e8c0'], 70, 106, 180, 14, .8, 1.2);
    wave(20, 300, 152, 'rgba(255,255,255,.7)', 2); wave(40, 300, 170, 'rgba(255,255,255,.7)', 2); arrow(100, 168, 100, 138, '#fff', 3.5); arrow(220, 168, 220, 138, '#fff', 3.5);
    Tx(160, 30, '陸地'); Tx(160, 117, '沙洲', '#7a5a14', 13); Tx(160, 88, '平靜的淺水', '#fff', 11.5); Tx(160, 193, '泥沙在離岸不遠的海裡堆積，露出海面', '#fff', 12);
  }
  if (kind === 'spit') {
    R(0, 0, 320, 200, DEEP); Pt('M0 0H222L216 44Q210 66 196 68H0Z', LAND); Pt('M320 0H250L256 44Q262 66 276 68H320Z', LAND); specks(30, ['#8dbd66', '#aad684'], 0, 0, 190, 56, 2, 4);
    Pt('M222 0L216 44Q210 66 196 68H276Q262 66 256 44L250 0Z', '#62b3da'); Pt('M0 68H196M276 68H320', 'none', SAND, 7, 'stroke-linecap="butt"');
    Pt('M150 68H212Q236 68 240 57', 'none', SANDD, 13); Pt('M150 68H212Q236 68 240 57', 'none', SAND, 10);
    Pt('M236 10Q236 40 252 56Q264 68 268 88', 'none', '#fff', 3); head(268.5, 91, .1, 1, '#fff', 3);
    arrow(20, 128, 96, 128, '#fde68a', 4.5); arrow(126, 128, 202, 128, '#fde68a', 4.5); Tx(112, 152, '沿岸流帶著沙往前堆', '#fff', 12);
    Tx(60, 40, '陸地'); Tx(206, 30, '河流', '#1e40af', 12, 'end'); Tx(196, 94, '沙嘴', '#7a5a14', 13); Tx(290, 112, '河水的出口', '#fff', 11); Tx(160, 192, '沙嘴從河口的一側長出來，把出口擠向另一側', '#fff', 12);
  }
  if (kind === 'drift') {
    R(0, 0, 320, 200, DEEP); R(0, 0, 320, 56, SAND); specks(60, ['#d9c68e', '#f4e8c0'], 0, 0, 320, 52, .7, 1.2); Pt('M0 56H320', 'none', '#fff', 3);
    for (let k = 0; k < 6; k++) Pt(`M${k * 62 - 30} 196L${k * 62 + 40} 120`, 'none', 'rgba(255,255,255,.4)', 2);
    let d = 'M30 56'; for (let k = 0; k < 5; k++) d += `L${30 + k * 54 + 34} 28L${30 + (k + 1) * 54} 56`; Pt(d, 'none', '#c2410c', 2.5, 'stroke-dasharray="5 3"'); o.push('<circle cx="300" cy="56" r="5" fill="#d9741f" stroke="#7c2d12"/>');
    arrow(60, 84, 270, 84, '#fde68a', 5); Tx(164, 108, '沿岸流', '#fff', 13); arrow(70, 186, 104, 126, '#fff', 3.5); arrow(210, 186, 244, 126, '#fff', 3.5); Tx(156, 150, '海浪斜斜打上岸', '#fff', 12);
    Tx(22, 20, '沙灘', '#7a5a14', 12, 'start'); Tx(160, 194, '沙粒斜斜上岸、直直退回，一步步沿著海岸移動', '#fff', 11.5);
  }
  if (kind === 'seawall') {
    R(0, 0, 320, 200, SKY); R(150, 118, 170, 82, SEA); Pt('M176 150L320 168V200H176Z', '#cdb78a'); Pt('M0 200V120H120V200Z', '#b79c72'); Pt('M0 120H120', 'none', '#5d9a3e', 5, 'stroke-linecap="butt"');
    R(26, 92, 40, 28, '#f3ede0', 'stroke="#7c5a45"'); Pt('M20 92L46 72L72 92Z', '#b4553c'); Pt('M112 200V86H134L176 150V200Z', '#c9c5bc', '#77736b', 1.5);
    tp(190, 142, .8); tp(210, 152, .8); tp(200, 128, .75); tp(226, 160, .75); tp(180, 124, .7); wave(160, 320, 118); arrow(304, 96, 232, 110, '#fff', 4);
    Tx(122, 76, '海堤', INK, 13); Tx(262, 150, '消波塊', '#fff', 12.5); Tx(52, 150, '陸地', '#fff', 12.5); Tx(190, 26, '海堤擋住大浪，消波塊讓浪先碎開');
  }
  if (kind === 'tetrapod') {
    R(0, 0, 320, 200, SKY); R(0, 124, 320, 76, SEA); wave(0, 320, 124);
    for (const [x, y] of [[100, 108], [160, 114], [220, 106], [70, 148], [130, 158], [190, 148], [250, 158]]) tp(x, y, 2.1);
    Pt('M262 92q12 -30 30 -8M276 84q10 -22 26 -2', 'none', '#fff', 3); arrow(312, 60, 270, 92, '#fff', 4);
    Tx(160, 26, '四隻腳互相卡住，不容易被浪捲走'); Tx(160, 190, '海浪打進縫隙，力量就被分散', '#fff', 12.5);
  }
  if (kind === 'groin') {
    R(0, 0, 320, 200, DEEP); R(0, 0, 320, 50, LAND); specks(30, ['#8dbd66', '#aad684'], 0, 0, 320, 44, 2, 4);
    Pt('M0 50V60H36Q84 66 117 100V52H124Q134 53 150 60Q190 66 221 100V52H228Q250 53 290 60H320V50Z', SAND, SANDD, 1.2); Pt('M124 60H150M228 60H290', 'none', '#dc2626', 2.5, 'stroke-dasharray="5 4"');
    R(117, 46, 7, 64, '#8d877f', 'stroke="#5f5a54"'); R(221, 46, 7, 64, '#8d877f', 'stroke="#5f5a54"');
    arrow(14, 134, 92, 134, '#fde68a', 4.5); arrow(150, 134, 206, 134, '#fde68a', 4.5); Tx(54, 154, '沿岸流', '#fff', 12.5);
    Tx(66, 100, '沙越積越多', '#fff', 11.5); Tx(274, 84, '沙被帶走', '#fff', 11.5); Tx(274, 99, '海岸後退', '#fff', 11.5); Tx(120, 126, '突堤', '#fff', 12.5); Tx(160, 30, '陸地'); Tx(160, 190, '突堤攔住一側的沙，另一側反而被侵蝕', '#fff', 12.5);
  }
  if (kind === 'breakwater') {
    R(0, 0, 320, 200, DEEP); R(0, 0, 320, 44, LAND); Pt('M0 44V56Q40 56 62 72Q80 84 98 72Q120 56 160 56Q200 56 222 72Q240 84 258 72Q280 56 320 56V44Z', SAND, SANDD, 1.2);
    R(50, 110, 60, 10, '#8d877f', 'stroke="#5f5a54" rx="3"'); R(210, 110, 60, 10, '#8d877f', 'stroke="#5f5a54" rx="3"');
    wave(20, 300, 150, 'rgba(255,255,255,.75)', 2); wave(30, 300, 168, 'rgba(255,255,255,.75)', 2); arrow(80, 166, 80, 128, '#fff', 3.5); arrow(240, 166, 240, 128, '#fff', 3.5);
    Tx(80, 100, '浪變小', '#fff', 11.5); Tx(240, 100, '浪變小', '#fff', 11.5); Tx(160, 119, '離岸堤', '#fff', 12.5); Tx(160, 30, '陸地'); Tx(160, 193, '浪先在堤外破碎，堤後的沙慢慢堆積', '#fff', 12.5);
  }
  if (kind === 'shrink') {
    R(0, 0, 320, 200, DEEP); R(0, 0, 320, 34, LAND); Pt('M0 34H320', 'none', SAND, 6, 'stroke-linecap="butt"');
    Pt('M40 118Q46 92 120 88Q214 84 262 96Q286 104 282 122Q276 142 190 146Q70 150 40 118Z', 'rgba(234,217,166,.25)', '#fff', 2, 'stroke-dasharray="6 5"');
    Pt('M150 106Q200 96 250 98Q274 98 284 88Q282 108 252 114Q196 122 156 118Q144 112 150 106Z', SAND, SANDD, 1.5);
    arrow(84, 132, 140, 116, '#dc2626', 4.5); arrow(30, 170, 110, 170, '#fde68a', 4.5); arrow(140, 170, 220, 170, '#fde68a', 4.5); Tx(266, 174, '沿岸流', '#fff', 12.5);
    Tx(160, 22, '陸地'); Tx(90, 108, '以前的範圍', '#fff', 11.5); Tx(206, 112, '現在', '#7a5a14', 12.5); Tx(160, 62, '河流帶來的沙變少，海流和海浪又不斷把沙帶走', '#fff', 11.5); Tx(160, 195, '沙洲越來越小，還順著沿岸流的方向移動', '#fff', 12.5);
  }
  return `<svg viewBox="${vb}" role="img" aria-label="${kind}">${o.join('')}</svg>`;
}

/* 本區用的小樣式（插圖、名詞表、比較表、延伸、探究的階段列） */
(function coaCSS() {
  if (document.getElementById('coaCss')) return; const st = document.createElement('style'); st.id = 'coaCss';
  st.textContent = `.cfig{margin:6px 0 10px} .cfig svg{width:100%;height:auto;display:block;border-radius:12px;border:1px solid var(--line)}
    dl.cterm{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:15px;line-height:1.6} dl.cterm dt{font-weight:900;color:#075985;white-space:nowrap} dl.cterm dd{margin:0}
    table.ctab{width:100%;border-collapse:separate;border-spacing:0;margin:10px 0 4px;font-size:14.5px;line-height:1.5;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
    table.ctab th,table.ctab td{padding:7px 8px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:center;vertical-align:middle}
    table.ctab tr:last-child>*{border-bottom:0} table.ctab tr>*:last-child{border-right:0} table.ctab th{background:#ecfeff;color:#155e75;font-weight:900;white-space:nowrap}
    details.cext{border:2px dashed #94a3b8;border-radius:12px;padding:8px 12px;margin:12px 0;background:#f8fafc} details.cext summary{font-weight:900;color:#475569;cursor:pointer} details.cext[open] summary{margin-bottom:6px}
    .lb.node.cur{opacity:0;pointer-events:none}
    .cstage{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin:10px 0 0;font-weight:900;font-size:14.5px;color:var(--sub)} .cstage span{border:2px solid var(--line);background:#fff;border-radius:999px;padding:3px 12px} .cstage span.on{border-color:#0891b2;background:#cffafe;color:#155e75} .cstage span.was{color:var(--ink)}`;
  document.head.appendChild(st);
})();

/* ---------- 探究的觀察活動：海蝕洞繼續被侵蝕，會變成什麼？（模擬） ---------- */
function observeArch(el, done) {
  el.innerHTML = `<div class="sim" style="grid-template-columns:1fr"><figure><figcaption>從側面看一個伸進海裡的岬角<small>海浪從右邊不停拍打岩壁</small></figcaption>
      <canvas width="380" height="240" id="acC" style="aspect-ratio:38/24;max-width:480px;background:#cfe6f3"></canvas><div class="res" id="acT">岩壁上已經有一個海蝕洞。按下面的按鈕，讓海浪繼續侵蝕</div></figure></div>
    <div class="cstage" id="acS"><span>海蝕洞</span>→<span>海蝕門</span>→<span>海蝕柱</span>→<span>礁石</span></div>
    <div class="row"><button class="cta" id="acGo">🌊 讓海浪再侵蝕很多年</button><button class="cta ghost" id="acRe">↻ 從頭再看</button></div>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0">這是把很長的時間縮短的模擬動畫。真實的海岸要經過幾千、幾萬年才會有這些變化。</p>`;
  const g = G.$('#acC').getContext('2d'), W = 380, Hh = 240, YS = 170, TOP = 62, XF = 304, XC = 238, P0 = .08;
  const MSG = ['海浪不斷拍打，海蝕洞越挖越深', '洞被打穿了！海水可以通過，變成海蝕門。門洞越來越大，門頂越來越薄', '門頂崩落了！外側留下一根孤立的海蝕柱', '海蝕柱也越來越矮，最後只剩下海面上的礁石'];
  const stageOf = q => q < .34 ? 0 : q < .68 ? 1 : q < .9 ? 2 : 3;
  let p = P0, target = P0, raf = 0, last = performance.now(), told = false, shown = -1;
  const sky = () => { const gr = g.createLinearGradient(0, 0, 0, YS); gr.addColorStop(0, '#bfe0f5'); gr.addColorStop(1, '#eaf5fb'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh); };
  const erase = path => { g.save(); g.beginPath(); path(); g.clip(); sky(); g.restore(); };
  const topLine = () => { g.moveTo(0, TOP + 4); g.quadraticCurveTo(80, TOP - 6, 160, TOP); g.quadraticCurveTo(240, TOP + 4, XF - 12, TOP + 2); };
  const holePath = (a, b) => { g.moveTo(XC - a, YS + 12); g.lineTo(XC - a, YS - b * .45); g.bezierCurveTo(XC - a, YS - b * 1.05, XC + a, YS - b * 1.05, XC + a, YS - b * .45); g.lineTo(XC + a, YS + 12); g.closePath(); };
  const text = (s, x, y) => { g.font = '900 14px sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.strokeText(s, x, y); g.fillStyle = '#1f3345'; g.fillText(s, x, y); };
  const draw = t => {
    const st = stageOf(p); sky();
    g.save(); g.beginPath(); g.moveTo(0, Hh); g.lineTo(0, TOP + 4); g.quadraticCurveTo(80, TOP - 6, 160, TOP); g.quadraticCurveTo(240, TOP + 4, XF - 12, TOP + 2); g.quadraticCurveTo(XF, TOP + 6, XF, TOP + 22); g.lineTo(XF + 3, Hh); g.closePath(); g.clip();
    g.fillStyle = '#b89b6e'; g.fillRect(0, 0, W, Hh); g.strokeStyle = '#93794f'; g.lineWidth = 1.5; for (let y = TOP + 14; y < Hh; y += 17) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 12); g.stroke(); } g.restore();
    g.strokeStyle = '#5d9a3e'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); topLine(); g.stroke();
    let lx = XC, ly = 0;
    if (st === 0) { const k = p / .34, a = 10 + 12 * k, b = 24 + 18 * k; g.beginPath(); holePath(a, b); g.fillStyle = '#35291d'; g.fill(); ly = YS - b - 12; }
    else if (st === 1) { const k = (p - .34) / .34, a = 22 + 12 * k, b = 42 + 34 * k; erase(() => holePath(a, b)); g.strokeStyle = '#7a6240'; g.lineWidth = 1.5; g.beginPath(); holePath(a, b); g.stroke(); ly = YS - b - 12; }
    else { const k = clamp((p - .68) / .22, 0, 1), k3 = st === 3 ? (p - .9) / .1 : 0, a = 34 + 5 * k, fall = clamp((p - .68) / .05, 0, 1), topY = TOP + 2 + 16 * k + (YS - 16 - TOP - 18) * k3, xr = XF + 4 - 8 * k - 12 * k3;
      erase(() => g.rect(XC - a, 0, 2 * a, YS + 12)); erase(() => g.rect(XC + a - 1, 0, W, topY)); erase(() => g.rect(xr, 0, W, Hh));
      g.fillStyle = '#93794f'; if (fall < 1) for (let i = 0; i < 3; i++) g.fillRect(XC - 26 + i * 19, TOP + 6 + fall * fall * (YS - TOP - 16), 15, 12); else for (let i = 0; i < 3; i++) { const s = 9 * (1 - k * .5 - k3 * .4); g.fillRect(XC - 20 + i * 15, YS - s * .6, s * 1.3, s); }
      lx = (XC + a + xr) / 2; ly = topY - 10; }
    g.fillStyle = 'rgba(74,156,214,.92)'; g.fillRect(0, YS, W, Hh - YS);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= W; x += 6) g.lineTo(x, YS + 2.4 * Math.sin(x * .07 + t * 2.4)); g.stroke();
    const u = (t * .45) % 1, sx = st >= 2 ? XF - 4 : XF + 6; g.fillStyle = `rgba(255,255,255,${.9 * (1 - u)})`; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(sx + i * 3 * u + Math.sin(i * 2.1) * 4, YS - u * (16 + i * 5), 3.2 - i * .3, 0, 7); g.fill(); }
    text(['海蝕洞', '海蝕門', '海蝕柱', '礁石'][st], lx, ly);
    if (st !== shown) { shown = st; el.querySelectorAll('#acS span').forEach((s, i) => { s.classList.toggle('on', i === st); s.classList.toggle('was', i < st); }); }
  };
  const tick = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (p < target) { p = Math.min(target, p + dt * .075); if (p >= target) { G.$('#acT').textContent = MSG[stageOf(p)]; G.$('#acGo').disabled = p >= 1; } if (p >= .74 && !told) { told = true; done(); } }
    draw(now / 1000); raf = requestAnimationFrame(tick);
  };
  G.$('#acGo').onclick = () => { target = Math.min(1, +(target + .17).toFixed(2) > .96 ? 1 : target + .17); G.$('#acGo').disabled = true; G.$('#acT').textContent = '海浪侵蝕中……注意岩石哪裡改變了'; };
  G.$('#acRe').onclick = () => { p = target = P0; shown = -1; G.$('#acGo').disabled = false; G.$('#acT').textContent = '岩壁上有一個海蝕洞。按按鈕，讓海浪繼續侵蝕'; };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/* ---------- 區域定義 ---------- */
const card = (name, en, kind, facts) => ({ name, en, photo: 'img/coast/' + kind + '.jpg', svg: cSVG(kind), facts });
const fig = kind => `<div class="cfig">${cSVG(kind)}</div>`;

G.registerZone('coast', {
  hint: '這段海岸有岩石岬角，也有沙灘。點發光的圓點，看看風和海浪留下了哪些作品！',
  build,
  nodes: [
    { id: 'wind', num: '1', title: '風的雕刻', en: 'Sculpted by Wind', color: '#b45309', ready: true, at: [-8.6, capeTop(-8.6, .3) + 1.5, .3],
      cam: { pos: [-4.9, 3.9, 4.2], target: [-8.5, 1.5, -.2] },
      learn: `
        <h3>風也會改變大地</h3>
        <p>風吹過地表時，會把細小的砂粒吹起來帶走。砂粒打在岩石上，就像砂紙一樣，一點一點把岩石磨掉。</p>
        <div class="two"><div><b>🌬️ 風的侵蝕</b>風挾帶砂粒磨蝕岩石，留下平滑的面或奇特的形狀。</div><div><b>🏜️ 風的堆積</b>風變小，砂粒落下來，堆成沙丘（到節點 3 看看）。</div></div>
        <p>風力強、砂粒多、植物少的地方，風的作用最明顯，例如沙漠，還有冬天吹東北季風的海邊。</p>
        <h3>風稜石</h3>
        <p>強風長期從固定的方向吹來，砂粒把石頭迎風的一面磨得又平又光滑。磨出兩、三個面後，面和面之間出現明顯的稜線，叫做<em>風稜石</em>。</p>
        ${fig('ventifact')}
        <h3>蕈狀岩</h3>
        <p>岩層如果上層較硬、下層較軟，軟的部分被侵蝕得快，就變成頭大、脖子細，像香菇一樣的<em>蕈狀岩</em>。</p>
        ${fig('mushroom')}
        <h3>女王頭：頭和脖子都是砂岩</h3>
        <p>新北市野柳的「女王頭」是最有名的蕈狀岩。它的頭和脖子都是<em>砂岩</em>，但是成分不一樣，所以軟硬不同。</p>
        <div class="two"><div><b>👑 頭部：較硬</b>含有許多生物碎屑的砂岩，顏色比較深，質地比較堅硬。</div><div><b>🦒 頸部：較軟</b>土黃色的砂岩，砂粒和砂粒黏結得不緊密，容易一粒粒剝落。</div></div>
        <p>經年累月受到風、雨、海浪侵蝕，脖子凹陷得比頭部快，才變成上粗下細的樣子。它不是只靠風雕出來的。</p>
        <h3>蜂窩岩</h3>
        <p>浪花濺到岩石上，水分蒸發後留下鹽的結晶。結晶長大時把砂粒撐開，砂粒再被風和雨水帶走，岩石表面就布滿小洞，像蜂窩一樣。</p>
        <div class="tip"><b>看看模型：</b>岬角上最高的那一顆是女王頭，比比看它的頭和脖子顏色有什麼不同。旁邊的蕈狀岩脖子粗細都不一樣，還有一顆已經斷頭。後面的砂地上有風稜石，淡黃色的細線是被風吹著跑的砂粒。</div>
        <div class="tip"><b>和風化的關係：</b>蜂窩岩的鹽結晶作用，在第 5a 區的「物理性風化」也出現過。</div>
        <details class="cext"><summary>延伸：女王頭的脖子會斷嗎？</summary>
          <p>會。比較 1969 年到現在的照片，女王頭的脖子一年比一年細。頸部的砂岩不斷剝落，總有一天會撐不住頭部而斷落。</p>
          <p>這是自然的過程。我們能做的是不觸摸、不攀爬，別讓它斷得更快。</p></details>`,
      cardsIntro: '<p>風和海邊的鹽分留下的三種作品。都是繪圖。</p>',
      cards: [
        card('風稜石', 'Ventifact', 'ventifact', [['是什麼', '被風沙磨出平滑的面和明顯稜線的石頭。'], ['怎麼形成', '強風挾帶砂粒，長期磨蝕石頭迎風的一面。'], ['特徵', '表面光滑，有兩、三個平面，面和面之間有稜線。'], ['臺灣哪裡看', '新北市石門區的麟山鼻、富貴角，冬天的東北季風很強。']]),
        card('蕈狀岩（女王頭）', 'Mushroom rock', 'mushroom', [['是什麼', '頭大、頸細，形狀像香菇的岩石。'], ['是什麼岩石', '整顆都是砂岩，屬於沉積岩（第 2 區）。'], ['頭部', '含有許多生物碎屑的砂岩，顏色較深，質地較堅硬。'], ['頸部', '土黃色的砂岩，砂粒黏結得不緊密，容易從表面剝落。'], ['怎麼形成', '兩層砂岩軟硬不同，受風、雨、海浪侵蝕後，頸部凹陷得比頭部快。'], ['會改變嗎', '會。頸部越來越細，最後頭部會斷落。'], ['臺灣哪裡看', '新北市萬里區野柳地質公園的女王頭。']]),
        card('蜂窩岩', 'Honeycomb rock', 'honeycomb', [['是什麼', '表面布滿小洞，像蜂窩的岩石。'], ['怎麼形成', '海水蒸發留下鹽的結晶，結晶把砂粒撐開、剝落。'], ['原理', '鹽結晶作用，屬於物理性風化（第 5a 區）。'], ['臺灣哪裡看', '新北市萬里區野柳。']]),
      ] },
    { id: 'cliff', num: '2', title: '岩岸', en: 'Rocky Coast', color: '#0e7490', ready: true, at: [-6.5, 1.7, 1.3],
      cam: { pos: [-1.9, 3.6, 6.2], target: [-7.3, .4, 1.9] },
      learn: `
        <h3>海浪也會侵蝕、搬運、堆積</h3>
        <p>海浪日夜不停拍打海岸，把岩石打碎、帶走，這是<em>侵蝕</em>。碎屑被海水<em>搬運</em>，到浪比較小的地方<em>堆積</em>下來。</p>
        ${fig('headbay')}
        <div class="two"><div><b>🪨 岩岸</b>突出的岬角浪大，<em>侵蝕作用強</em>，岩石裸露，有許多海蝕地形。</div><div><b>🏖️ 沙岸</b>凹入的海灣浪小，<em>堆積作用強</em>，常有沙灘（到節點 3）。</div></div>
        <h3>海蝕凹壁和海蝕崖</h3>
        <p>海浪集中拍打岩壁靠近海面的地方，挖出一道凹槽，叫做<em>海蝕凹壁</em>。</p>
        <p>凹壁越挖越深，上方的岩石失去支撐而崩落，留下陡直的岩壁，就是<em>海蝕崖</em>。</p>
        ${fig('retreat')}
        <h3>海蝕平臺</h3>
        <p>同樣的過程一再發生，海蝕崖不斷往陸地後退，崖腳前留下一片平坦的岩石面，叫做<em>海蝕平臺</em>。漲潮時它常被海水淹沒。</p>
        <h3>豆腐岩</h3>
        <p>平臺的岩層如果有兩組交叉的裂縫（節理），海水沿著裂縫侵蝕，就把岩石切成一塊一塊，像排好的豆腐，叫做<em>豆腐岩</em>。</p>
        <h3>海蝕溝</h3>
        <p>海浪也會沿著平臺上同一個方向的裂縫來回沖刷，把裂縫越挖越寬、越挖越深，形成一道道朝向大海的<em>海蝕溝</em>。</p>
        <p>新北市老梅的海蝕溝之間留下長條形的岩脊，春天時長滿綠色的藻類，稱為「綠石槽」。</p>
        <h3>海蝕洞</h3>
        <p>海浪直接拍打的岩壁上，裂縫或比較軟的地方被越掏越深，就挖出了<em>海蝕洞</em>。洞口通常在海面附近，海水可以灌進去。</p>
        <h3>洞 → 門 → 柱</h3>
        ${fig('seq')}
        <dl class="cterm"><dt>海蝕洞</dt><dd>岩壁脆弱的地方被海浪挖出洞穴。</dd>
          <dt>海蝕門</dt><dd>海蝕洞被打穿，海水可以通過，像一座拱門。</dd>
          <dt>海蝕柱</dt><dd>海蝕門的頂部崩落，外側留下孤立的岩柱。</dd></dl>
        <p>海蝕柱還會繼續被侵蝕，越來越矮，最後只剩下海面上的礁石。</p>
        <div class="tip"><b>看看模型：</b>岬角這一帶的浪特別大。岩壁就是海蝕崖，靠近海面的地方凹了進去；崖前的海蝕平臺上有豆腐岩和一道道海蝕溝。</div>
        <div class="tip"><b>再往岬角前端看：</b>岩壁上有海蝕洞，浪直接打進洞裡；往外海依序是海蝕門、海蝕柱和礁石。越往外海，被海浪侵蝕得越久。</div>
        <div class="tip"><b>注意安全：</b>海蝕平臺又溼又滑，還可能突然打上大浪。到岩岸要留意漲潮時間，不要太靠近海邊。</div>
        <p>海蝕洞繼續被侵蝕，會變成什麼樣子？先預測，再讓海浪替你雕刻。</p>`,
      cardsIntro: '<p>海浪侵蝕岩岸留下的八種地形。前三張是從側面切開來看的繪圖；最後三張是洞、門、柱的演變。</p>',
      cards: [
        card('海蝕凹壁', 'Wave-cut notch', 'notch', [['是什麼', '岩壁靠近海面的地方，被海浪挖出的凹槽。'], ['怎麼形成', '海浪和它挾帶的砂石，集中拍打、磨蝕崖腳。'], ['接下來', '凹壁越來越深，上方的岩石會崩落。']]),
        card('海蝕崖', 'Sea cliff', 'cliff', [['是什麼', '被海浪侵蝕形成的陡直岩壁。'], ['怎麼形成', '海蝕凹壁上方的岩石失去支撐而崩落。'], ['會改變嗎', '會。崖腳不斷被侵蝕，海蝕崖慢慢往陸地後退。'], ['臺灣哪裡看', '新北市瑞芳區的鼻頭角、南雅海岸。']]),
        card('海蝕平臺', 'Wave-cut platform', 'platform', [['是什麼', '海蝕崖前方平坦的岩石面。'], ['怎麼形成', '海蝕崖不斷後退，崖腳前留下被海浪削平的岩石。'], ['特徵', '大致和海面一樣高，漲潮時常被淹沒，退潮時露出。'], ['臺灣哪裡看', '新北市野柳、基隆市和平島。']]),
        card('豆腐岩', 'Tofu rocks', 'tofu', [['是什麼', '海蝕平臺上排列整齊、像豆腐的方形岩塊。'], ['怎麼形成', '海水沿著兩組交叉的裂縫（節理）侵蝕，把岩石切開。'], ['臺灣哪裡看', '新北市野柳、基隆市和平島。']]),
        card('海蝕溝', 'Sea gully', 'groove', [['是什麼', '海蝕平臺上一道道長條形的凹溝，溝和溝之間是長條形的岩脊。'], ['怎麼形成', '海浪沿著同一個方向的裂縫來回沖刷，把裂縫挖寬、挖深。'], ['和豆腐岩比', '豆腐岩是兩組交叉的裂縫；海蝕溝主要沿著一組裂縫發展。'], ['臺灣哪裡看', '新北市石門區老梅：岩脊上長滿綠色的藻類，稱為綠石槽。']]),
        card('海蝕洞', 'Sea cave', 'cave', [['是什麼', '岩壁上被海浪挖出的洞穴。'], ['怎麼形成', '海浪集中侵蝕岩壁上有裂縫或較軟的地方。'], ['臺灣哪裡看', '宜蘭縣南澳的海蝕洞。']]),
        card('海蝕門', 'Sea arch', 'arch', [['是什麼', '被海浪打穿、像拱門的岩石，又叫海拱。'], ['怎麼形成', '海蝕洞越挖越深，把突出的岩壁打穿。'], ['臺灣哪裡看', '澎湖縣西嶼鄉小門嶼的鯨魚洞。']]),
        card('海蝕柱', 'Sea stack', 'stack', [['是什麼', '孤立在海中的岩柱。'], ['怎麼形成', '海蝕門的頂部崩落，外側的岩石和陸地分開。'], ['會改變嗎', '會。繼續被侵蝕後越來越矮，最後變成礁石。'], ['臺灣哪裡看', '新北市金山區的燭臺嶼（燭臺雙嶼）。']]),
      ],
      poe: {
        question: '伸進海裡的岬角，岩壁上有一個海蝕洞。海浪繼續侵蝕很多、很多年以後，這裡最可能變成什麼樣子？',
        options: ['洞被打穿變成海蝕門，後來門頂崩落，外側留下一根海蝕柱', '洞口被泥沙填滿，岩壁變回原來的樣子', '洞只會越來越深，岬角的外形不會改變'],
        observeIntro: '按「讓海浪再侵蝕很多年」，一次一次觀察岩石的變化，至少看到<b>海蝕柱</b>出現。',
        observe: observeArch,
        explain: {
          q: '根據剛才的觀察，海蝕門為什麼會變成海蝕柱？',
          opts: ['海浪不斷侵蝕，門洞越來越大，門頂的岩石失去支撐而崩落，外側就剩下孤立的岩柱。', '海蝕柱是從海底新長出來的岩石，和海蝕門沒有關係。', '海浪把泥沙堆在岬角外側，慢慢堆成一根柱子。'],
          ans: 0,
          hint: '回想動畫：門洞越來越大時，門頂變厚還是變薄？門頂掉下來以後，外側那一塊岩石還和陸地連在一起嗎？',
          why: '海浪的侵蝕讓門洞越來越大、門頂越來越薄，最後失去支撐而崩落。外側的岩石和陸地分開，成為孤立的海蝕柱；它還會繼續被侵蝕，最後只剩礁石。'
        }
      } },
    { id: 'sand', num: '3', title: '沙岸', en: 'Sandy Coast', color: '#ca8a04', ready: true, at: P(-1.6, -2.9, 1.5),
      cam: { pos: [2.6, 9.6, 10.6], target: [2.2, 0, .2] },
      learn: `
        <h3>沙子從哪裡來？</h3>
        <p>沙灘上的沙，大部分是河流從山上帶來的泥沙（第 5b 區）。另外還有海浪打碎的岩石碎屑，以及貝殼、珊瑚的碎片。</p>
        <p>海浪和海流把這些沙搬運到浪比較小的地方堆積，就形成各種<em>海積地形</em>。</p>
        <h3>沙灘和礫石灘</h3>
        <p>海浪的力量不同，留下來的東西也不同。浪越大，能帶走的顆粒越大，留在岸邊的就只剩下大顆的石頭。</p>
        <div class="two"><div><b>🏖️ 沙灘</b>浪小、坡度平緩的海灣，連細沙都留得住，堆積成沙灘。例如屏東縣墾丁。</div><div><b>🪨 礫石灘</b>浪大的海岸，細沙被帶走，只留下礫石。例如花蓮縣七星潭。</div></div>
        <p>礫石在浪裡不停翻滾、互相碰撞，被磨得又圓又扁。礫石灘的坡度比沙灘陡，浪退的時候會聽到石頭滾動的聲音。</p>
        <h3>沙洲和沙嘴</h3>
        <p>沿著海岸流動的海流叫<em>沿岸流</em>。它帶著沙一路前進，流速變慢的地方，沙就停下來，堆成長條形。</p>
        <div class="two"><div><b>🏝️ 沙洲</b>在離岸不遠的海中堆積、露出海面的長條形沙地，大致和海岸平行。例如新北市福隆。</div><div><b>👉 沙嘴</b>一端連著陸地，另一端伸進海裡的沙地，像鳥的嘴巴。</div></div>
        <p>沙嘴出現在海岸突然往內凹的地方，例如河口或海灣的入口。沿岸流來不及轉彎，沙就順著原來海岸的方向繼續往前堆。</p>
        ${fig('spit')}
        <p>沙嘴會把河口的出口擠向另一側。但是河水不斷往外流，所以出口通常不會被完全封住。</p>
        <h3>沙丘</h3>
        <p>沙灘上乾燥的沙被海風吹向內陸，遇到植物或障礙物就停下來，越堆越高，形成<em>沙丘</em>。這是風的堆積作用。</p>
        <p>人們在沙丘後方種<em>防風林</em>，擋住風沙，保護農田和房屋。</p>
        <h3>岩岸和沙岸比一比</h3>
        <table class="ctab"><tr><th></th><th>岩岸</th><th>沙岸</th></tr>
          <tr><th>常見位置</th><td>突出的岬角</td><td>凹入的海灣、河口附近</td></tr>
          <tr><th>海浪</th><td>較大</td><td>較小</td></tr>
          <tr><th>主要作用</th><td>侵蝕</td><td>堆積</td></tr>
          <tr><th>常見地形</th><td>海蝕崖、海蝕平臺、豆腐岩、海蝕溝、海蝕洞、海蝕門、海蝕柱</td><td>沙灘、礫石灘、沙丘、沙洲、沙嘴</td></tr></table>
        <div class="tip"><b>看看模型：</b>靠近岬角的一段浪比較大，是礫石灘；海灣深處浪小，才是沙灘。海面上黃色的箭頭是沿岸流，褐色的小點是被它帶著走的沙。沙到了河口，從西岸堆出一條沙嘴，把河水的出口擠向東側；外海還有一座和海岸平行的沙洲。</div>
        <details class="cext"><summary>延伸：沙子怎麼沿著海岸「搬家」？</summary>
          <p>海浪常常斜斜地打上沙灘，把沙粒斜著推上岸；海水退回去時，卻是順著斜坡直直流下。</p>
          ${fig('drift')}
          <p>一上一下之間，沙粒就往旁邊移動了一小步。日積月累，整片沙灘的沙都順著同一個方向慢慢移動。</p></details>`,
      cardsIntro: '<p>海浪、海流和風堆積出來的地形。都是繪圖；後兩張是從空中往下看。</p>',
      cards: [
        card('沙灘', 'Sandy beach', 'beach', [['是什麼', '細沙堆積成的平緩海岸。'], ['怎麼形成', '海浪把沙搬運到浪小的海灣堆積。'], ['沙的來源', '河流帶來的泥沙、岩石碎屑、貝殼和珊瑚的碎片。'], ['臺灣哪裡看', '屏東縣墾丁的沙灘，沙裡有很多貝殼和珊瑚的碎片。']]),
        card('礫石灘', 'Gravel beach', 'gravel', [['是什麼', '布滿礫石（鵝卵石）的海灘。'], ['怎麼形成', '海浪力量大，細沙被帶走，只留下比較大的礫石。'], ['特徵', '坡度比沙灘陡；礫石被海浪磨得又圓又光滑。'], ['臺灣哪裡看', '花蓮縣新城鄉的七星潭。']]),
        card('沙丘', 'Sand dune', 'dune', [['是什麼', '風把沙吹到一處，堆成的小丘。'], ['怎麼形成', '海風把沙灘上乾燥的沙吹向內陸，遇到障礙物後堆積。'], ['會移動嗎', '會。風大時沙丘會移動，所以要種植物把沙固定住。'], ['臺灣哪裡看', '桃園市的草漯沙丘。']]),
        card('沙洲', 'Sandbar', 'bar', [['是什麼', '泥沙在海中堆積，露出海面的沙地。'], ['怎麼形成', '河流帶來泥沙，再被海浪和沿岸流推送、堆積。'], ['特徵', '大多是長條形，和海岸大致平行；形狀和位置會改變。'], ['臺灣哪裡看', '新北市貢寮區福隆：雙溪出海口的沙洲。']]),
        card('沙嘴', 'Sand spit', 'spit', [['是什麼', '一端連著陸地，另一端伸進海裡的長條形沙地。'], ['怎麼形成', '沿岸流帶著沙前進，到了河口或海灣入口，沙順著原來海岸的方向繼續往前堆。'], ['特徵', '前端常微微彎向陸地；河口的出口被擠到另一側，但不會完全封住。'], ['臺灣哪裡看', '新北市八里區的挖子尾（淡水河口）。']]),
      ] },
    { id: 'change', num: '4', title: '變動的海岸', en: 'Changing Coast', color: '#be123c', ready: true, at: [7.6, 1.6, WALLZ - .9],
      cam: { pos: [9.8, 7.6, 10.2], target: [8.4, .1, 1.0] },
      learn: `
        <h3>沙灘像一個存錢筒</h3>
        <p>沙灘的沙一直被海浪和沿岸流帶走，也一直有新的沙補進來。補進來的和被帶走的差不多，沙灘才能維持原來的樣子。</p>
        <div class="two"><div><b>➕ 補進來</b>河流從上游帶來的泥沙，是海岸最重要的沙源。</div><div><b>➖ 被帶走</b>颱風大浪、冬天的季風和沿岸流，都會把沙帶離海岸。</div></div>
        <h3>沙源減少，海岸後退</h3>
        <p>河流上游蓋了水庫、攔砂壩，或是在河床大量採砂石，流到海邊的泥沙就變少。港口的長堤也會攔住沿岸流帶來的沙。</p>
        <p>補進來的沙少了，海浪照樣把沙帶走，沙灘和沙洲就越來越小，<em>海岸線往陸地後退</em>。</p>
        ${fig('shrink')}
        <p>雲林縣、嘉義縣外海的<em>外傘頂洲</em>是臺灣最大的沙洲。它的面積越來越小，位置也慢慢移動，將來可能沉到海面下。</p>
        <h3>海岸工程</h3>
        <p>為了保護海邊的房屋和農田，人們在海岸做了各種工程，用不同的方法減弱海浪的力量。</p>
        <dl class="cterm"><dt>海堤</dt><dd>沿著海岸築的堤防，擋住大浪和暴漲的海水。</dd>
          <dt>消波塊</dt><dd>堆在岸邊的大型混凝土塊，讓海浪打上來時先碎開。</dd>
          <dt>突堤</dt><dd>從岸邊伸進海裡的短堤，攔住沿岸流帶來的沙。</dd>
          <dt>離岸堤</dt><dd>蓋在外海、和海岸平行的堤，讓海浪先在外面破碎。</dd></dl>
        ${fig('seawall')}
        <h3>工程也有代價</h3>
        <div class="two"><div><b>🏞️ 破壞景觀</b>自然的沙灘變成水泥和消波塊，看不到海，也不容易親近海邊。</div><div><b>🦀 影響生態</b>螃蟹、貝類和海龜失去棲息、產卵的沙灘。</div></div>
        <div class="two"><div><b>↔️ 顧此失彼</b>突堤的一側積沙，另一側得不到沙，反而侵蝕得更嚴重。</div><div><b>🔁 治標不治本</b>沙源沒有恢復，消波塊會下陷、流失，必須一直補。</div></div>
        ${fig('groin')}
        <h3>更好的做法</h3>
        <p>現在會盡量少蓋堤防，改用接近自然的方法：補沙讓沙灘變寬、種植物固定沙丘、讓河流的泥沙能順利流到海邊。</p>
        <p>最重要的是不在容易被侵蝕的海岸過度開發，把空間留給海浪。</p>
        <div class="tip"><b>看看模型：</b>聚落前面有海堤和消波塊，沙灘已經不見了，浪直接打在消波塊上。跟著黃色的沿岸流箭頭看：兩道突堤的西側積了沙，東側卻被侵蝕。外海的沙洲被沿岸流拉出一條細細的尾巴；白色虛線是它以前的範圍，紅色箭頭是它移動的方向。</div>`,
      cardsIntro: '<p>四種海岸工程的做法、原理和缺點，以及一座正在變小的沙洲。都是繪圖。</p>',
      cards: [
        card('海堤', 'Seawall', 'seawall', [['做法', '沿著海岸築一道混凝土或石塊的堤防。'], ['原理', '用堅固的牆擋住大浪和暴漲的海水，保護後方的房屋、農田。'], ['缺點', '擋住視線和通道，破壞自然景觀；堤前的沙灘容易被反彈的海浪帶走。']]),
        card('消波塊', 'Wave-dissipating blocks', 'tetrapod', [['做法', '把大型混凝土塊堆在海堤前或岸邊。'], ['原理', '海浪打進塊體之間的縫隙，力量被分散，浪就變小。'], ['缺點', '破壞景觀，生物失去沙灘棲地；會下陷、流失，要不斷補充。']]),
        card('突堤', 'Groyne', 'groin', [['做法', '從岸邊向海裡伸出一道短堤。'], ['原理', '攔住沿岸流帶來的沙，讓沙堆積在堤的一側。'], ['缺點', '另一側得不到沙，反而侵蝕得更嚴重，叫做突堤效應。']]),
        card('離岸堤', 'Offshore breakwater', 'breakwater', [['做法', '在離岸不遠的海中，築一道和海岸平行的堤。'], ['原理', '海浪先在堤外破碎，堤後的浪變小，沙容易堆積。'], ['缺點', '改變海流，鄰近的海岸可能被侵蝕；也影響景觀。']]),
        card('變小的沙洲', 'Shrinking sandbar', 'shrink', [['例子', '雲林縣、嘉義縣外海的外傘頂洲，臺灣最大的沙洲。'], ['發生什麼事', '面積越來越小，位置也順著海流的方向慢慢移動。'], ['原因', '河流帶來的泥沙減少，加上海浪和東北季風不斷侵蝕。'], ['影響', '沙洲是海岸的天然屏障；沙洲消失，海浪會直接打向海岸。']]),
      ] },
  ],
  // 檢核題：level 為 PIRLS 層次（1 提取訊息／2 推論訊息／3 詮釋整合／4 比較評估）
  quiz: [
    { id: 'coast.wind.1', about: '風的雕刻', level: 1, q: '根據「風的雕刻」的認識，風稜石是怎麼形成的？',
      opts: ['強風挾帶砂粒，長期把石頭迎風的一面磨平，面和面之間出現稜線', '河水帶著石頭滾動，把稜角磨圓', '岩漿噴出地表後快速冷卻', '樹根鑽進裂縫，把石頭撐開'], ans: 0, why: '說明中提到：強風長期從固定的方向吹來，砂粒把石頭迎風的一面磨得又平又光滑，面和面之間出現稜線，就是風稜石。' },
    { id: 'coast.arch.1', about: '岩岸', level: 1, q: '根據「岩岸」的圖鑑，新北市金山區的燭臺嶼屬於哪一種海蝕地形？',
      opts: ['海蝕平臺', '海蝕溝', '海蝕門', '海蝕柱'], ans: 3, why: '圖鑑提到：海蝕柱是孤立在海中的岩柱，臺灣可以在新北市金山區的燭臺嶼（燭臺雙嶼）看到。' },
    { id: 'coast.cliff.1', about: '岩岸', level: 2, q: '小華在海邊看到一面陡直的海蝕崖，崖腳有一道很深的海蝕凹壁。根據「岩岸」的認識，接下來最可能發生什麼事？',
      opts: ['凹壁被泥沙填平，海蝕崖不再改變', '凹壁上方的岩石失去支撐而崩落，海蝕崖往陸地後退', '海蝕崖越長越高，往海的方向延伸', '凹壁裡長出一根海蝕柱'], ans: 1, why: '說明中提到：凹壁越挖越深，上方的岩石會失去支撐而崩落。同樣的過程一再發生，海蝕崖就不斷往陸地後退，崖前留下海蝕平臺。' },
    { id: 'coast.change.1', about: '變動的海岸', level: 2, q: '某條河的上游蓋了水庫。幾年後，出海口附近的沙灘越來越窄。根據「沙岸」和「變動的海岸」的認識，最可能的原因是什麼？',
      opts: ['水庫讓海浪變大，把沙灘打碎了', '泥沙被攔在水庫裡，補進沙灘的沙變少，被海浪帶走的卻沒有減少', '水庫放出的水太乾淨，把沙溶解了', '沙灘上的沙都被風吹回水庫'], ans: 1, why: '沙灘的沙主要來自河流。水庫把泥沙攔在上游，補進來的沙變少，海浪和沿岸流卻照樣把沙帶走，沙灘就越來越窄。' },
    { id: 'coast.sand.1', about: '沙岸', level: 3, q: '把「岩岸」和「沙岸」的說明放在一起想：為什麼海蝕地形多半出現在突出的岬角，沙灘卻常出現在凹入的海灣？',
      opts: ['岬角的岩石比較軟，海灣的岩石比較硬', '岬角浪大，侵蝕作用強；海灣浪小，海浪帶來的沙容易堆積', '岬角離河流比較近，所以沙比較多', '海灣的風比較大，把岩石都吹走了'], ans: 1, why: '突出的岬角首當其衝，浪大、侵蝕作用強，所以有海蝕崖、海蝕洞等地形；凹入的海灣浪小、堆積作用強，沙子留得住，就形成沙灘。' },
    { id: 'coast.change.2', about: '變動的海岸', level: 4, q: '村長說：「只要在整條海岸堆滿消波塊，沙灘就不會再流失了。」根據「變動的海岸」的認識和圖鑑，哪一個評論最合理？',
      opts: ['合理，消波塊越多，沙子就會越多', '合理，消波塊可以把海浪完全擋住', '不夠周全，消波塊只能減弱海浪，不能補充沙源，還會破壞景觀和生物的棲地', '不合理，因為消波塊會把河流的泥沙吸走'], ans: 2, why: '消波塊能分散海浪的力量，但沙灘流失的根本原因是沙源減少。只堆消波塊不能把沙補回來，還會破壞景觀和生態，所以要同時想辦法恢復沙源。' },
  ]
});
})();
