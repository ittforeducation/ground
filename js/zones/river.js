/* 區域 5b：河流改變大地 —— 一條從山上流到海的河
   上游：又窄又深的 V 型谷、瀑布、大石頭；中游：河道變寬、鵝卵石、河階、曲流開始；下游：又寬又淺、曲流、牛軛湖、出海口三角洲
   六個節點：流量流速與坡度、侵蝕搬運堆積、上游、中游、下游、河川特徵總覽；本區挑戰 6 題 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, { ss, fbm, clamp, lerp } = U;

/* ---------- 範圍：x 由西（山）到東（海），z 由後到前 ---------- */
const X0 = -13, X1 = 14, Z0 = -7, Z1 = 7, YB = -2.6, YT = 9.8, CELL = .1, STEP = .1;
const NX = Math.round((X1 - X0) / CELL), NZ = Math.round((Z1 - Z0) / CELL), NV = (NX + 1) * (NZ + 1);

/* ---------- 河道控制點 [x, z, 半寬, 河面高度]：上游窄、中游變寬、下游最寬 ---------- */
const MAIN_P = [
  [-12.3, -2.6, .08, 3.9], [-11.2, -1.6, .14, 3.4], [-10.0, -2.0, .18, 2.95], [-9.2, -1.2, .20, 2.7], [-8.85, -.95, .22, 1.95],     // 源頭 → 瀑布
  [-7.8, -.2, .24, 1.78], [-6.6, -.9, .28, 1.58],                                                                                 // 上游
  [-5.4, -.1, .36, 1.4], [-4.2, .9, .44, 1.2], [-3.1, .3, .52, 1.02], [-2.4, -1.1, .58, .9],                                       // 中游
  [-1.7, -2.5, .66, .82], [-.5, -3.0, .74, .76], [.5, -2.4, .80, .7], [1.0, -1.0, .84, .62], [1.05, .6, .86, .54], [1.5, 2.4, .88, .48], [2.8, 3.3, .90, .42], [4.1, 2.7, .90, .36], [4.6, 1.5, .90, .3],    // 下游的曲流
  [5.5, .5, .90, .24], [6.8, .4, .92, .17], [8.0, .2, .95, .09], [9.0, -.2, .95, .03],                                              // 截彎取直的河段
  [9.8, -.2, .72, -.04], [10.45, -.2, .5, -.08]];                                                                                // 出海口：到三角洲頂點分成兩條分流
const TRIB_P = [      // 支流（最後一點的高度會自動對齊主流）
  [[-9.6, -5.6, .05, 3.9], [-8.6, -3.6, .08, 3.1], [-8.0, -1.6, .11, 2.4], [-7.75, -.3, .13, 2.0]],
  [[-8.4, 5.2, .05, 3.6], [-7.2, 3.4, .08, 2.7], [-6.7, 1.2, .11, 2.0], [-6.55, -.75, .13, 1.66]],
  [[-5.2, -5.6, .06, 2.4], [-4.0, -3.4, .1, 1.6], [-3.3, -1.4, .14, 1.15], [-3.05, .1, .16, 1.0]]];
const OX = { x: 5.7, z: -2.0, R: 1.4, a0: 2.531, a1: 6.894, hw: .4 };      // 牛軛湖：一段開口朝向河道的圓弧
// 出海口的三角洲：以河口為頂點、向海張開的扇形陸地；河水分成三條分流穿過它
const FAN = { x: 9.7, z: -.2, R: 3.0, th: 1.2 };
const DIST_P = [[[10.3, -.2, .34, -.08], [11.0, .29, .3, -.11], [11.91, .7, .3, -.14], [13.0, 1.19, .32, -.2]], [[10.3, -.2, .34, -.08], [11.0, -.69, .3, -.11], [11.91, -1.1, .3, -.14], [13.0, -1.59, .32, -.2]]];
// 三角洲外緣的沙洲 [x, z, 沿長軸半徑, 短軸半徑, 轉角, 是否長了草]
const DBARS = [[13.25, -.3, .24, .85, 0, 0], [12.7, 2.5, .24, .8, .5, 0], [12.6, -2.9, .24, .8, -.5, 0]];
const VILL = [[2.9, -3.9], [6.9, 3.3]];

function sampleLine(pts) {
  const cr = (a, b, c, d, t) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t), dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 20; k++) { const t = k / 20; dense.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t), lerp(p1[2], p2[2], t), lerp(p1[3], p2[3], t)]); }
  }
  dense.push(pts[pts.length - 1].slice());
  const out = []; let acc = 0, next = 0;
  for (let i = 0; i < dense.length - 1; i++) {
    const a = dense[i], b = dense[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next <= acc + d) { const t = d ? (next - acc) / d : 0; out.push({ x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), hw: lerp(a[2], b[2], t), y: lerp(a[3], b[3], t), s: next }); next += STEP; }
    acc += d;
  }
  return out;
}
function finishLine(pts, main) {
  if (main) for (let pass = 0; pass < 6; pass++) {      // 主流的中心線再修圓，彎道內側才不會出現尖角
    const xs = pts.map(o => o.x), zs = pts.map(o => o.z), m = pts.length;
    for (let i = 6; i < m - 6; i++) { let sx = 0, sz = 0; for (let k = -6; k <= 6; k++) { sx += xs[i + k]; sz += zs[i + k]; } const w = ss(-5.5, -4, xs[i]); pts[i].x = lerp(xs[i], sx / 13, w); pts[i].z = lerp(zs[i], sz / 13, w); }
  }
  const n = pts.length, ys = pts.map(o => o.y), hs = pts.map(o => o.hw);
  pts.forEach((o, i) => { let s = 0, h = 0; for (let k = -2; k <= 2; k++) { const j = clamp(i + k, 0, n - 1); s += ys[j]; h += hs[j]; } o.y = s / 5; o.hw = h / 5; });
  pts.forEach((o, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; o.tx = (b.x - a.x) / l; o.tz = (b.z - a.z) / l; });
  const ks = pts.map((o, i) => { const a = pts[Math.max(0, i - 5)], b = pts[Math.min(n - 1, i + 5)]; return (a.tx * b.tz - a.tz * b.tx) / ((b.s - a.s) || 1) * 1.3; });
  pts.forEach((o, i) => { let s = 0, c = 0; for (let k = -8; k <= 8; k++) { const j = i + k; if (j < 0 || j >= n) continue; const w = 9 - Math.abs(k); s += ks[j] * w; c += w; } o.k = clamp(s / c, -1, 1); let km = 0; for (let k = -4; k <= 4; k++) km = Math.max(km, Math.abs(ks[clamp(i + k, 0, n - 1)])); o.kr = Math.max(Math.abs(s / c), km) / 1.3; if (main) o.hw = Math.min(o.hw, .7 / Math.max(o.kr, .01)); });   // 曲率：平滑過，彎道的標示才不會斷斷續續
  return { pts, main: !!main, xs: Float32Array.from(pts, o => o.x), zs: Float32Array.from(pts, o => o.z) };
}

/* ---------- 地形：每一格取「各條河谷剖面」中最低的一個，河谷自然會接在一起 ---------- */
const BEDX = x => { const P = MAIN_P; if (x <= P[0][0]) return P[0][3]; for (let i = 1; i < P.length; i++) if (x <= P[i][0]) return lerp(P[i - 1][3], P[i][3], (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0])); return P[P.length - 1][3]; };
const ridge = (x, z) => fbm(x * .28 + 3.1, z * .28 - 1.7, 4);
const wUp = x => ss(-5.6, -7.2, x), wLow = x => ss(-2.4, -1.0, x);       // 上游、下游的比重；兩者之外就是中游
function nearest(L, x, z) { let b = 0, bd = 1e9; const xs = L.xs, zs = L.zs, n = xs.length; for (let i = 0; i < n; i++) { const dx = x - xs[i], dz = z - zs[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; b = i; } } nearest.d = Math.sqrt(bd); return b; }
function candH(L, x, z) {       // 這條河在 (x,z) 造成的地表高度；順便回報離岸距離 e（負值＝在河道裡）與凹岸係數 co
  const o = L.pts[nearest(L, x, z)], e = nearest.d - o.hw, wU = wUp(x), wL = wLow(x), wM = 1 - wU - wL;
  const co = L.main ? -Math.sign(o.tx * (z - o.z) - o.tz * (x - o.x)) * o.k : 0; candH.e = e; candH.co = co;
  if (e < 0) { const t = 1 + e / o.hw; return o.y - (.13 * wU + .14 * wM + .09 * wL) * (1 - t * t); }      // 河床：下游最淺
  let h = 0;
  if (wU > 0) { const Hm = 2.0 + 3.2 * ridge(x, z) + .9 * (1 - Math.abs(2 * U.vnoise(x * .8 + 7, z * .8) - 1)); h += wU * (o.y + Hm * Math.tanh(1.7 * e / Hm) + .3 * (fbm(x * 1.3, z * 1.3, 3) - .5) * ss(.2, 1.2, e)); }   // 上游：又陡又深的 V 型谷
  if (wM > 0) h += wM * (o.y + .05 * ss(0, .12, e) + .2 * ss(.85, 1.0, e) + .22 * ss(1.75, 1.9, e) + (.4 + 1.8 * ridge(x, z)) * ss(2.4, 4.6, e));                                // 中游：河灘 → 兩階河階 → 丘陵
  if (wL > 0) { const inner = clamp(-co, 0, 1), outer = clamp(co, 0, 1), PL = Math.max(BEDX(x) + .1, .07, o.y + .06);                                                          // 下游：只比河面高一點的平原
    h += wL * (lerp(o.y, PL, ss(0, .22 + 1.1 * inner - .14 * outer, e)) + 1.5 * ridge(x, z) * ss(4.6, 7, Math.abs(z)) * ss(5, 2, x) * ss(1.2, 3, e)); }
  return h;
}
const coastX = z => 9.7 + .18 * Math.sin(z * .7 + 1) + .2 * (fbm(z * .9, 3.3, 2) - .5);
function fanF(x, z) {            // 三角洲的範圍：>0 在扇形裡面（數值約等於離邊緣的距離），邊角用平滑的最小值修圓
  const dx = x - FAN.x, dz = z - FAN.z, r = Math.hypot(dx, dz), th = Math.atan2(dz, dx), q = Math.abs(th) / FAN.th;
  const a = FAN.R * (1 - .1 * q * q) * (1 + .05 * Math.sin(th * 5 + 1)) - r, b = (FAN.th - Math.abs(th)) * Math.max(r, .6) + .25, k = .35;
  return -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
}
const coastQ = (x, z) => coastX(z) - x;      // >0 在陸地這一側
function barT(x, z) {            // 出海口沙洲的高度比例 0–1（輪廓用雜訊弄得不規則、圓滑）
  let t = 0, veg = 0;
  for (const b of DBARS) { const c = Math.cos(b[4]), s = Math.sin(b[4]), dx = x - b[0], dz = z - b[1], u = Math.hypot((dx * c + dz * s) / b[2], (-dx * s + dz * c) / b[3]) * (1 + .4 * (fbm(x * 1.7 + b[0], z * 1.7, 2) - .5)), q = ss(1.35, .75, u); if (q > t) { t = q; veg = b[5] * ss(.75, .4, u); } }
  barT.veg = veg; return t;
}
const OXT = [[OX.x + OX.R * Math.cos(OX.a0), OX.z + OX.R * Math.sin(OX.a0)], [OX.x + OX.R * Math.cos(OX.a1), OX.z + OX.R * Math.sin(OX.a1)]];
function oxDist(x, z) {
  const dx = x - OX.x, dz = z - OX.z; let a = Math.atan2(dz, dx); if (a < OX.a0) a += 6.28319;
  if (a <= OX.a1) return Math.abs(Math.hypot(dx, dz) - OX.R);
  return Math.min(Math.hypot(x - OXT[0][0], z - OXT[0][1]), Math.hypot(x - OXT[1][0], z - OXT[1][1]));
}

const main = finishLine(sampleLine(MAIN_P), true);
const tribs = TRIB_P.map(P => {
  const pts = sampleLine(P), n = pts.length, end = main.pts[nearest(main, pts[n - 1].x, pts[n - 1].z)].y;
  pts.forEach((o, i) => { o.y = Math.min(o.y, candH(main, o.x, o.z) - .14, i ? pts[i - 1].y : 99); if (i > n - 4) o.y = Math.max(o.y, end); });
  return finishLine(pts);
});
const dists = DIST_P.map(P => finishLine(sampleLine(P)));
const LINES = [main, ...tribs];
const H = new Float32Array(NV), E = new Float32Array(NV), CO = new Float32Array(NV), SL = new Float32Array(NV);
let LAKE = 0;
(function buildField() {
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = X0 + i * CELL, z = Z0 + j * CELL, a = j * (NX + 1) + i; let h = 1e9, e = 1e9, co = 0;
    for (const L of LINES) { const c = candH(L, x, z); if (c < h) h = c; if (candH.e < e) { e = candH.e; co = candH.co; } }
    const q = coastQ(x, z), seaFloor = Math.max(-1.7, .4 * q); let lim = q > 0 ? .5 * q : seaFloor;
    if (x > 9) {            // 出海口：扇形的三角洲、周圍一圈淺灘、三條分流、外緣的沙洲
      const f = fanF(x, z); if (f > -1.4) lim = Math.max(lim, f > 0 ? lerp(-.1, .07, ss(0, .25, f)) : lerp(Math.min(seaFloor, -.1), -.1, ss(-1.4, -.4, f)));
      h = Math.min(h, lim);
      for (const L of dists) { const o = L.pts[nearest(L, x, z)], d = nearest.d; if (d < o.hw + .3) { h = Math.min(h, lerp(-.13, h, ss(o.hw - .05, o.hw + .22, d))); e = Math.min(e, d - o.hw); } }
      const t = barT(x, z); if (t > 0) h = Math.max(h, -.14 + .225 * t);
    } else h = Math.min(h, lim);
    H[a] = h; E[a] = e; CO[a] = co;
  }
  const at = (x, z) => H[Math.round((z - Z0) / CELL) * (NX + 1) + Math.round((x - X0) / CELL)];
  LAKE = 1e9; for (let k = 0; k <= 12; k++) { const a = lerp(OX.a0, OX.a1, k / 12); LAKE = Math.min(LAKE, at(OX.x + OX.R * Math.cos(a), OX.z + OX.R * Math.sin(a))); } LAKE -= .06;
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = X0 + i * CELL, z = Z0 + j * CELL, a = j * (NX + 1) + i, od = oxDist(x, z);
    if (od < OX.hw + .12) { const tgt = od < OX.hw ? LAKE - .12 * (1 - (od / OX.hw) ** 2) - .02 : LAKE; H[a] = Math.min(H[a], lerp(tgt, H[a], ss(OX.hw, OX.hw + .12, od))); }
  }
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const a = j * (NX + 1) + i, l = i ? a - 1 : a, r = i < NX ? a + 1 : a, u = j ? a - NX - 1 : a, d = j < NZ ? a + NX + 1 : a;
    SL[a] = Math.hypot((H[r] - H[l]) / ((r - l) * CELL || 1), (H[d] - H[u]) / ((d - u) / (NX + 1) * CELL || 1));
  }
})();
const grid = (A, x, z) => { const fx = clamp((x - X0) / CELL, 0, NX - 1e-3), fz = clamp((z - Z0) / CELL, 0, NZ - 1e-3), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, a = j * (NX + 1) + i; return (A[a] * (1 - u) + A[a + 1] * u) * (1 - v) + (A[a + NX + 1] * (1 - u) + A[a + NX + 2] * u) * v; };
const height = (x, z) => grid(H, x, z);
const waterY = o => Math.max(o.y - .02, .004);
const flowSpeed = x => lerp(lerp(.95, 1.9, wUp(x)), .42, ss(-2.4, 2.5, x));
const mainAt = x => { let b = 0, bd = 1e9; main.pts.forEach((o, i) => { const d = Math.abs(o.x - x); if (d < bd) { bd = d; b = i; } }); return b; };
const P = (x, z, dy = 0) => [x, Math.max(0, height(x, z)) + dy, z];
const frontSide = o => (o.tx > 0 ? 1 : -1);                    // 河道靠鏡頭那一側是法線的正向還是負向
// 壺穴：在上游與中游交界的河床上，一塊貼著水面的岩盤
const POT = (() => { const o = main.pts[mainAt(-5.05)], s = frontSide(o), d = o.hw * .5; return { o, x: o.x - o.tz * s * d, z: o.z + o.tx * s * d, y: waterY(o) + .03, rot: Math.atan2(-o.tz, o.tx) }; })();
// 彎頂（曲率最大的地方）：中游一個、下游一個，供標籤、護岸使用
const apexIn = (xa, xb) => { let b = null; main.pts.forEach((o, i) => { if (o.x > xa && o.x < xb && (!b || Math.abs(o.k) > Math.abs(b.o.k))) b = { o, i }; }); return b; };
const APM = apexIn(-3.5, -1.9), APL = apexIn(1.4, 3.8), APS = apexIn(-1.6, .6);
const bankPt = (o, outer, d) => { const s = (outer ? -1 : 1) * Math.sign(o.k) * (o.hw + d); return [o.x - o.tz * s, o.z + o.tx * s]; };

/* ---------- 地表貼圖：逐像素依河段、離岸距離、坡度上色 ---------- */
const FARM = [[150, 190, 92], [198, 190, 106], [112, 160, 78], [172, 142, 98], [134, 182, 112], [176, 200, 110]];
function groundTexture(W, Hh) {
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  const mix = (a, b, t) => { a[0] += (b[0] - a[0]) * t; a[1] += (b[1] - a[1]) * t; a[2] += (b[2] - a[2]) * t; return a; };
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const x = X0 + (i + .5) / W * (X1 - X0), z = Z0 + (j + .5) / Hh * (Z1 - Z0), h = height(x, z), e = grid(E, x, z), co = grid(CO, x, z), sl = grid(SL, x, z);
    const wU = wUp(x), wL = wLow(x), wM = 1 - wU - wL, n = fbm(x * 1.6, z * 1.6, 3), hs = U.hash(i, j), q = coastQ(x, z), od = oxDist(x, z);
    const col = mix([122, 172, 84], [58, 116, 58], clamp(fbm(x * .55 + 2, z * .55, 3) * 1.7 - .35, 0, 1)); mix(col, [50, 100, 58], wU * .45); mix(col, [150, 150, 126], ss(5.4, 7.4, h) * .45);
    const farm = Math.max(wL * ss(.22, .08, h - Math.max(BEDX(x) + .1, .07)), wM * ss(2.6, 2.2, e)) * ss(.95, 1.3, e) * ss(.2, .08, sl) * ss(.5, .9, q) * ss(OX.hw + .25, OX.hw + .5, od);
    if (farm > 0) {       // 平原與河階上的農田：斜斜的棋盤格，每塊田顏色不同
      const ru = x * .955 + z * .296, rv = -x * .296 + z * .955, fu = ru / 1.15, fv = rv / .8, iu = Math.floor(fu), iv = Math.floor(fv), k = U.hash(iu * 7 + 3, iv * 13 + 1);
      const fc = FARM[(k * FARM.length) | 0].slice(), b = 1 + .05 * Math.sin((k < .5 ? rv : ru) * 46), edge = Math.min((fu - iu) * 1.15, (1 - fu + iu) * 1.15, (fv - iv) * .8, (1 - fv + iv) * .8);
      fc[0] *= b; fc[1] *= b; fc[2] *= b; if (edge < .045) mix(fc, [186, 172, 134], .85); mix(col, fc, farm);
    }
    mix(col, mix([128, 124, 118], [164, 160, 152], n), ss(1.75, 2.3, sl) * .85);                         // 陡坡露出岩石
    mix(col, [158, 130, 94], wM * ss(.5, 1.1, sl) * ss(.7, .85, e) * ss(2.3, 1.95, e) * .85);            // 中游：河階的階崖
    mix(col, mix([126, 122, 116], [170, 166, 158], n), wU * ss(.38, .12, e));                            // 上游：河邊都是岩石
    mix(col, hs < .33 ? [198, 192, 180] : hs < .66 ? [170, 164, 152] : [146, 140, 130], wM * ss(.82, .66, e));   // 中游：鵝卵石灘
    const inner = clamp(-co, 0, 1), outer = clamp(co, 0, 1);
    mix(col, [152, 140, 100], wL * ss(.16, .06, e) * .8);
    mix(col, hs < .5 ? [220, 202, 154] : [206, 188, 142], (wL + wM * .8) * ss(.25 + 1.1 * inner, .1 + .8 * inner, e) * ss(.1, .45, inner));   // 凸岸堆積的沙洲
    mix(col, [130, 96, 64], wL * ss(.15, .04, e) * ss(.1, .45, outer));                                   // 被侵蝕的凹岸
    if (e < .02) mix(col, [118 * wU + 150 * wM + 158 * wL, 116 * wU + 146 * wM + 136 * wL, 110 * wU + 136 * wM + 98 * wL], ss(.02, -.06, e));
    mix(col, [70, 118, 70], ss(OX.hw + .32, OX.hw + .14, od) * .8); mix(col, [70, 104, 96], ss(OX.hw + .1, OX.hw + .04, od));     // 牛軛湖：湖岸與湖底顏色一致
    if (h > -.12) mix(col, [228, 212, 166], ss(.4, .12, q));                                              // 沙灘
    if (h < .02) { mix(col, [208, 194, 156], ss(.02, -.05, h)); mix(col, [118, 150, 150], ss(-.3, -1.5, h) * .7); }
    if (x > 9.2) { const f = fanF(x, z), t = barT(x, z); if (f > .06 && q < .5) mix(col, mix([132, 172, 90], [106, 150, 80], n), ss(.06, .32, f) * ss(.06, .3, e)); if (t > .3) mix(col, hs < .5 ? [230, 214, 168] : [218, 200, 152], ss(.3, .55, t)); }   // 三角洲：外圈是沙，裡面長了草
    for (const v of VILL) mix(col, [190, 182, 164], ss(1.15, .5, Math.hypot(x - v[0], (z - v[1]) * 1.4)) * .55);
    const k = .92 + .16 * hs, o = (j * W + i) * 4; d[o] = col[0] * k; d[o + 1] = col[1] * k; d[o + 2] = col[2] * k; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
}

/* ---------- 四面側牆的剖面：表土 → 河流堆積的砂礫泥 → 傾斜的岩層。顏色只由 (x,y,z) 決定，轉角會接起來 ---------- */
const WALLS = [
  { len: X1 - X0, at: s => [X0 + s, Z1], sc: 44, shade: 1 },
  { len: Z1 - Z0, at: s => [X0, Z0 + s], sc: 36, shade: .84 },
  { len: X1 - X0, at: s => [X1 - s, Z0], sc: 36, shade: .78 },
  { len: Z1 - Z0, at: s => [X1, Z1 - s], sc: 36, shade: .9 }];
const ROCKC = [[150, 138, 124], [128, 122, 116], [166, 150, 128], [112, 110, 112], [142, 128, 112], [176, 164, 140]];
const ALLU = [[202, 178, 130], [178, 162, 132], [216, 198, 152], [162, 152, 136]];
function section(w) {
  const sc = Math.round(w.sc * (G.coarse ? .7 : 1)), W = Math.round(w.len * sc), Hh = Math.round((YT - YB) * sc);
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  for (let i = 0; i < W; i++) {
    const [x, z] = w.at((i + .5) / W * w.len), hT = height(x, z), wU = wUp(x), ts = .09 + .08 * (1 - wU);
    const A = (.25 * ss(-7, -4.5, x) + 1.0 * ss(-3.2, 3, x) + .5 * ss(8.5, 11, x)) * ss(1.0, .35, hT - BEDX(x) - .16);
    const wob = .35 * fbm(x * .25 + 9, z * .25, 2), wob2 = .15 * fbm(x * .8, z * .8, 2), peb = .07 * (1 - ss(2, 8, x));
    for (let j = Math.max(0, Math.floor((YT - hT - .15) / (YT - YB) * Hh)); j < Hh; j++) {
      const y = YT - (j + .5) / Hh * (YT - YB), dp = hT - y, hs = U.hash(i, j); let col;
      if (dp < .04) col = hT < .03 ? [214, 200, 160] : [93, 154, 62];
      else if (dp < ts) col = [84, 62, 44];
      else if (dp < ts + A) { col = ALLU[(U.hash(Math.floor((y + wob2) / .16), 3) * 4) | 0]; if (U.hash(i >> 1, j >> 1) < peb) col = [140, 136, 128]; }
      else { const v = (y + .11 * x - .06 * z + wob) / .45, b = Math.floor(v); col = ROCKC[(U.hash(b, 5) * 6) | 0]; if (v - b < .07) col = [col[0] * .72, col[1] * .72, col[2] * .72]; }
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

/* ---------- 河水：沿著河道的水面，紋路以當地流速往下游移動（上游快、下游慢），陡的地方有白色水花 ---------- */
const GLSL_N = `float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }`;
function riverMaterial() {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: U.time },
    vertexShader: `attribute float aU, aTau, aFoam, aMud, aFade; varying float vU, vTau, vFoam, vMud, vFade;
      void main(){ vU = aU; vTau = aTau; vFoam = aFoam; vMud = aMud; vFade = aFade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying float vU, vTau, vFoam, vMud, vFade; ${GLSL_N}
      void main(){ float t = vTau - uTime; vec2 p = vec2(vU * 1.3, t * 1.7);
        float st = vnoise(p * vec2(2.2, 1.0)) * .62 + vnoise(p * vec2(4.6, 2.6) + 7.3) * .38;
        vec3 col = mix(vec3(.22, .62, .80), vec3(.42, .62, .58), vMud * .7); col *= mix(.86, 1.0, vU * vU); col += .07 * smoothstep(.52, .78, st);
        float f = clamp(smoothstep(.66 - vFoam * .42, .86 - vFoam * .3, st + .18 * abs(vU) * vFoam) * (.02 + vFoam), 0.0, 1.0);
        col = mix(col, vec3(.97, .99, 1.0), f);
        gl_FragColor = vec4(pow(col, vec3(2.2)), (.8 + .15 * f) * vFade * smoothstep(1.14, 1.0, abs(vU)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
}
function ribbonGeo(L, K = 6) {
  const pos = [], aU = [], aTau = [], aFoam = [], aMud = [], aFade = [], idx = [], n = L.pts.length; let tau = 0;
  L.pts.forEach((o, i) => {
    o.v = flowSpeed(o.x); if (i) tau += STEP / o.v; o.tau = tau;
    const a = L.pts[Math.max(0, i - 1)], b = L.pts[Math.min(n - 1, i + 1)], slope = (a.y - b.y) / ((b.s - a.s) || 1);
    o.foam = clamp(wUp(o.x) * .45 + slope * .9, 0, 1); const fade = ss(-.05, .03, o.y) * ss(0, 3, i), yw = waterY(o);
    for (let k = 0; k <= K; k++) { const u = (k / K * 2 - 1) * 1.14, lim = .92 / Math.max(o.kr || 0, .01), w = u * o.k > 0 ? Math.sign(u) * Math.min(Math.abs(u * o.hw), lim) : u * o.hw; pos.push(o.x - o.tz * w, yw, o.z + o.tx * w); aU.push(u); aTau.push(tau); aFoam.push(o.foam); aMud.push(ss(-7, 6, o.x)); aFade.push(fade); }
  });
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < K; k++) { const a = i * (K + 1) + k, b = a + 1, c = a + K + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(), F = (name, arr, s) => geo.setAttribute(name, new THREE.Float32BufferAttribute(arr, s));
  F('position', pos, 3); F('aU', aU, 1); F('aTau', aTau, 1); F('aFoam', aFoam, 1); F('aMud', aMud, 1); F('aFade', aFade, 1); geo.setIndex(idx); return geo;
}

/* ---------- 建立場景 ---------- */
function build() {
  const T = THREE, scene = new T.Scene(); scene.background = U.skyTexture('#74b6e6', '#eef1e6'); scene.fog = new T.Fog(0xe8eee8, 70, 170);
  U.addSun(scene, 18); scene.add(U.groundShadow(48, 30, YB - .05));
  const anim = [], rnd = U.rng(71), detail = U.detailTexture(14, 7);
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SC = new T.Vector3(), E3 = new T.Euler(), col = new T.Color(), UP = new T.Vector3(0, 1, 0);
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };

  // 地形
  const pos = new Float32Array(NV * 3), uvs = new Float32Array(NV * 2), idx = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const a = j * (NX + 1) + i; pos[a * 3] = X0 + i * CELL; pos[a * 3 + 1] = H[a]; pos[a * 3 + 2] = Z0 + j * CELL; uvs[a * 2] = i / NX; uvs[a * 2 + 1] = j / NZ; }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.BufferAttribute(uvs, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  scene.add(U.shadowed(new T.Mesh(tg, new T.MeshStandardMaterial({ map: G.coarse ? groundTexture(512, 256) : groundTexture(1024, 512), bumpMap: detail, bumpScale: 1.5, roughness: .95 })), false, true));
  for (const w of WALLS) scene.add(new T.Mesh(wallGeo(w), new T.MeshBasicMaterial({ map: section(w), color: new T.Color(w.shade, w.shade, w.shade), toneMapped: false, side: T.DoubleSide })));

  // 水：河、支流、牛軛湖、海
  const rivMat = riverMaterial();
  for (const L of [main, ...tribs]) { const m = new T.Mesh(ribbonGeo(L, L.main ? 8 : 3), rivMat); m.renderOrder = 4; m.frustumCulled = false; scene.add(m); }
  const lw = OX.hw + .07, lp = [], li = [];      // 牛軛湖的水面：沿著圓弧的一條等寬水帶，兩端是圓頭
  for (let k = 0; k <= 48; k++) { const a = lerp(OX.a0, OX.a1, k / 48), c = Math.cos(a), s = Math.sin(a); lp.push(OX.x + (OX.R - lw) * c, LAKE, OX.z + (OX.R - lw) * s, OX.x + (OX.R + lw) * c, LAKE, OX.z + (OX.R + lw) * s); if (k) { const n = k * 2; li.push(n - 2, n - 1, n, n - 1, n + 1, n); } }
  for (const [tx, tz] of OXT) { const b = lp.length / 3; lp.push(tx, LAKE, tz); for (let k = 0; k <= 16; k++) { const a = k / 16 * 6.2832; lp.push(tx + Math.cos(a) * lw, LAKE, tz + Math.sin(a) * lw); if (k) li.push(b, b + k, b + k + 1); } }
  const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); lg.setIndex(li); lg.computeVertexNormals();
  scene.add(new T.Mesh(lg, new T.MeshStandardMaterial({ color: 0x3f8f8c, roughness: .18, metalness: .1, side: T.DoubleSide })));
  scene.add(U.buildSea(U.seaMaterials(), 8.4, X1, Z0, Z1, height, 0, 0, 'ENS'));
  // 出海口外漂散的泥沙：一片淡淡的黃褐色
  const plume = new T.Mesh(new T.PlaneGeometry(5.2, 8.6), new T.MeshBasicMaterial({ map: tex(128, 128, g => { const r = g.createRadialGradient(40, 64, 4, 56, 64, 62); r.addColorStop(0, 'rgba(190,170,110,.55)'); r.addColorStop(1, 'rgba(190,170,110,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }), transparent: true, depthWrite: false }));
  plume.rotation.x = -Math.PI / 2; plume.position.set(12.4, .05, -.3); plume.renderOrder = 5; scene.add(plume);
  anim.push(t => { plume.material.opacity = .75 + .2 * Math.sin(t * .7); });

  // 石頭：上游是有稜有角的大石頭，中游是圓圓的鵝卵石
  const side = o => [-o.tz, o.tx];
  const boulders = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .95, flatShading: true }), 150); let nb = 0;
  const upPts = [...main.pts.filter(o => o.x < -5.7 && o.x > -12), ...tribs[0].pts.slice(8), ...tribs[1].pts.slice(8)];
  while (nb < 150) { const o = upPts[(rnd() * upPts.length) | 0], [nx, nz] = side(o), u = (rnd() * 2 - 1) * (o.hw + .26), x = o.x + nx * u, z = o.z + nz * u, s = (.05 + rnd() * rnd() * .15) * (Math.abs(u) < o.hw * .6 ? .6 : 1);
    E3.set(rnd() * 6, rnd() * 6, rnd() * 6); Q.setFromEuler(E3); M4.compose(V.set(x, Math.max(height(x, z), waterY(o) - .03) + s * .3, z), Q, SC.set(s * (1 + rnd() * .5), s * (.7 + rnd() * .4), s * (.9 + rnd() * .5))); boulders.setMatrixAt(nb, M4); boulders.setColorAt(nb, col.setHSL(.08, .04 + rnd() * .05, .36 + rnd() * .2)); nb++; }
  scene.add(U.shadowed(boulders));
  const NC = G.coarse ? 260 : 420, cobbles = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .7 }), NC); let nc = 0;
  const midPts = main.pts.filter(o => o.x > -5.6 && o.x < -1.6);
  while (nc < NC) { const o = midPts[(rnd() * midPts.length) | 0], [nx, nz] = side(o), u = (rnd() < .5 ? -1 : 1) * (o.hw * .8 + rnd() * .6), x = o.x + nx * u, z = o.z + nz * u, s = .02 + rnd() * .03;
    if (Math.hypot(x - POT.x, z - POT.z) < .55) continue;
    if (Math.abs(main.pts.indexOf(o) - APM.i) <= 14 && Math.sign(u) === -Math.sign(APM.o.k)) continue;      // 護岸那一側不放鵝卵石
    Q.setFromAxisAngle(UP, rnd() * 6); M4.compose(V.set(x, Math.max(height(x, z), waterY(o) - .04) + s * .25, z), Q, SC.set(s * (1 + rnd() * .6), s * .6, s * (1 + rnd() * .3))); cobbles.setMatrixAt(nc, M4); cobbles.setColorAt(nc, col.setHSL(.09 + rnd() * .04, .05 + rnd() * .1, .5 + rnd() * .28)); nc++; }
  scene.add(U.shadowed(cobbles, true, true));

  // 會動的東西：水面的水花、滾動的小石頭、漂向出海口的泥沙（都跟著當地流速走，彎道外側比較快）
  function drift(geo, mat, n, xa, xb, o) {
    const im = new T.InstancedMesh(geo, mat, n), i0 = mainAt(xa), i1 = mainAt(xb), ps = [];
    for (let k = 0; k < n; k++) ps.push({ s: lerp(i0, i1, rnd()), u: (rnd() * 2 - 1) * o.spread, sz: .6 + rnd() * .8, ph: rnd() * 6 });
    im.frustumCulled = false; if (o.shadow) im.castShadow = true; scene.add(im);
    anim.push((t, dt) => {
      ps.forEach((p, k) => {
        const i = Math.min(p.s | 0, main.pts.length - 2), f = p.s - i, a = main.pts[i], b = main.pts[i + 1];
        p.s += a.v * (1 + .55 * -p.u * a.k) * o.speed * dt / STEP; if (p.s >= i1) { p.s = i0 + rnd() * 2; p.u = (rnd() * 2 - 1) * o.spread; }
        const x = lerp(a.x, b.x, f), z = lerp(a.z, b.z, f), hw = lerp(a.hw, b.hw, f), sc = p.sz * ss(i0, i0 + 5, p.s) * ss(i1, i1 - 8, p.s);
        if (o.roll) { E3.set(p.s * STEP / .05 * a.tx + p.ph, p.ph, -p.s * STEP / .05 * a.tz); Q.setFromEuler(E3); } else Q.identity();
        M4.compose(V.set(x - a.tz * p.u * hw, lerp(waterY(a), waterY(b), f) + o.dy, z + a.tx * p.u * hw), Q, SC.set(sc, sc * (o.roll ? .75 : 1), sc)); im.setMatrixAt(k, M4);
      });
      im.instanceMatrix.needsUpdate = true;
    });
  }
  drift(new T.CircleGeometry(.035, 6).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, depthWrite: false }), G.coarse ? 100 : 160, -11.8, 9, { spread: .8, speed: 1, dy: .012 });
  drift(new T.SphereGeometry(.04, 7, 5), new T.MeshStandardMaterial({ color: 0xc9c4b8, roughness: .7 }), 26, -6.2, -1.8, { spread: .6, speed: .3, dy: -.012, roll: true, shadow: true });
  drift(new T.SphereGeometry(.024, 5, 4), new T.MeshBasicMaterial({ color: 0x8a6a3c }), G.coarse ? 90 : 150, -1.6, 10.6, { spread: .88, speed: .9, dy: .002 });

  // 瀑布的水霧
  const wf = main.pts.reduce((a, o) => o.foam > a.foam ? o : a), mistMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false }), mistGeo = new T.IcosahedronGeometry(.16, 2);
  for (let k = 0; k < 6; k++) { const m = new T.Mesh(mistGeo, mistMat); scene.add(m); anim.push(t => { const u = (t * .45 + k / 6) % 1; m.position.set(wf.x + .25 + Math.sin(k * 2.4) * .12, waterY(wf) - .3 + u * .5, wf.z + .15 + Math.cos(k * 1.7) * .12); m.scale.setScalar((.5 + u * 1.2) * (1 - u)); }); }

  // 壺穴：河床上貼著水面的岩盤，圓洞裡積著水，水流帶著幾顆小石頭慢慢繞圈
  const HOLES = [[.44, .46, .2], [.72, .66, .11], [.3, .76, .09], [.7, .28, .08]], LR = .36;
  const stex = tex(256, 256, g => { const r = U.rng(3); g.fillStyle = '#8f8a82'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { g.fillStyle = ['#a59f95', '#78736c', '#99938a', '#67625c'][i % 4]; g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 2); }
    g.strokeStyle = 'rgba(190,225,240,.35)'; g.lineWidth = 5; g.lineCap = 'round'; for (let i = 0; i < 9; i++) { const y = 20 + i * 27; g.beginPath(); g.moveTo(10 + r() * 40, y); g.quadraticCurveTo(128, y + (r() - .5) * 26, 246 - r() * 40, y + (r() - .5) * 14); g.stroke(); }     // 被水沖得溼亮
    for (const [hx, hy, hr] of HOLES) { const q = g.createRadialGradient(hx * 256, hy * 256, 0, hx * 256, hy * 256, hr * 256); q.addColorStop(0, '#2c6078'); q.addColorStop(.7, '#3f8098'); q.addColorStop(.82, '#332e29'); q.addColorStop(.93, '#5a544c'); q.addColorStop(1, '#b3ada3'); g.fillStyle = q; g.beginPath(); g.arc(hx * 256, hy * 256, hr * 256, 0, 7); g.fill(); } });
  const rockMat = new T.MeshStandardMaterial({ color: 0x8a847b, roughness: .9, bumpMap: U.detailTexture(2, 1), bumpScale: 2 });
  const ledge = U.shadowed(new T.Mesh(new T.CylinderGeometry(LR, LR + .07, .3, 22), [rockMat, new T.MeshStandardMaterial({ map: stex, roughness: .55 }), rockMat]), false, true);
  ledge.position.set(POT.x, POT.y - .15, POT.z); ledge.rotation.y = POT.rot; ledge.scale.set(1.25, 1, .95); scene.add(ledge);
  const hx0 = (.5 - HOLES[0][1]) * 2 * LR, hz0 = (HOLES[0][0] - .5) * 2 * LR, hr0 = HOLES[0][2] * 2 * LR;
  const swirl = new T.Mesh(new T.CircleGeometry(hr0 * .72, 24).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, map: tex(64, 64, g => { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.lineCap = 'round'; for (const [rr, a0] of [[11, 0], [11, 3.14], [20, 1.2], [20, 4.3], [27, 2.4], [27, 5.5]]) { g.beginPath(); g.arc(32, 32, rr, a0, a0 + 1.5); g.stroke(); } }) }));
  swirl.position.set(hx0, .153, hz0); ledge.add(swirl);
  const pebs = [0, 1, 2].map(k => { const m = new T.Mesh(new T.SphereGeometry(.016 + k * .003, 7, 5), new T.MeshStandardMaterial({ color: 0xd8d2c6, roughness: .6 })); ledge.add(m); return m; });
  anim.push(t => { swirl.rotation.y = -t * 1.5; pebs.forEach((m, k) => { const a = t * 1.5 + k * 2.1; m.position.set(hx0 + Math.cos(a) * hr0 * (.42 + k * .08), .15, hz0 + Math.sin(a) * hr0 * (.42 + k * .08)); }); });

  // 河川整治工程：固床工（橫跨河床的一階階矮壩）與護岸（凹岸鋪石塊）
  const conc = new T.MeshStandardMaterial({ color: 0xb9b4aa, roughness: .9 }), SILLX = [-6.35, -6.05, -5.75];
  for (const sx of SILLX) { const o = main.pts[mainAt(sx)], m = U.shadowed(new T.Mesh(new T.BoxGeometry(2 * o.hw + .3, .12, .1), conc)); m.position.set(o.x, waterY(o) - .015, o.z); m.rotation.y = Math.atan2(-o.tx, -o.tz); scene.add(m); }
  const stoneTex = tex(120, 64, g => { const r = U.rng(8); g.fillStyle = '#6f6a63'; g.fillRect(0, 0, 120, 64); for (let j = 0; j < 4; j++) for (let i = 0; i < 9; i++) { g.fillStyle = ['#b7b1a6', '#a39d92', '#c6c0b4', '#958f85'][(r() * 4) | 0]; g.beginPath(); g.ellipse((i * 15 + (j % 2) * 7.5) % 120, j * 16 + 8, 6.4, 6.6, 0, 0, 7); g.fill(); if (i === 0 && j % 2 === 0) { g.beginPath(); g.ellipse(120, j * 16 + 8, 6.4, 6.6, 0, 0, 7); g.fill(); } } }); stoneTex.wrapS = stoneTex.wrapT = T.RepeatWrapping;
  // 護岸是一道實心的矮堤：臨水的斜面、堤頂、背水的斜面，兩端慢慢降到地面（不會留下懸空的斷面）
  const rv = [], ruv = [], ri = [], RV0 = APM.i - 13, RV1 = APM.i + 13, rs = -Math.sign(APM.o.k);
  for (let i = RV0; i <= RV1; i++) { const o = main.pts[i], wy = waterY(o), t = ss(RV0, RV0 + 4, i) * ss(RV1, RV1 - 4, i), top = wy + .02 + .16 * t, k = i - RV0, uu = k * .13;
    const at = d => [o.x - o.tz * rs * d, o.z + o.tx * rs * d], q0 = at(o.hw - .08), q1 = at(o.hw + .1), q2 = at(o.hw + .22), q3 = at(o.hw + .4);
    rv.push(q0[0], wy - .06, q0[1], q1[0], top, q1[1], q2[0], top, q2[1], q3[0], Math.min(top, height(q3[0], q3[1]) - .02), q3[1]); ruv.push(uu, 0, uu, .45, uu, .62, uu, 1);
    if (k) { const n = k * 4; for (let j = 0; j < 3; j++) ri.push(n - 4 + j, n - 3 + j, n + j, n - 3 + j, n + 1 + j, n + j); } }
  const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rv, 3)); rg.setAttribute('uv', new T.Float32BufferAttribute(ruv, 2)); rg.setIndex(ri); rg.computeVertexNormals();
  scene.add(U.shadowed(new T.Mesh(rg, new T.MeshStandardMaterial({ map: stoneTex, roughness: .9, side: T.DoubleSide }))));

  // 樹、房子、雲
  const tr = U.rng(15), trees = [], NTR = G.coarse ? 520 : 820;
  for (let k = 0; k < 14000 && trees.length < NTR; k++) {
    const x = X0 + .25 + tr() * (X1 - X0 - .5), z = Z0 + .25 + tr() * (Z1 - Z0 - .5), h = height(x, z), e = grid(E, x, z), sl = grid(SL, x, z), wL = wLow(x), wU = wUp(x), wM = 1 - wU - wL;
    if (e < .42 + .3 * wU || sl > 2.1 || coastQ(x, z) < .7 || oxDist(x, z) < OX.hw + .35 || (wM > .4 && e < .95) || VILL.some(v => Math.hypot(x - v[0], z - v[1]) < 1.3)) continue;
    if ((wL > .5 || (wM > .4 && e < 2.5)) && sl < .3 && tr() > .045) continue;        // 農田裡只留零星的樹
    trees.push([x, h, z, .8 + tr() * .7, (h > 3.2 || tr() < .55) ? 0 : 1]);
  }
  U.plantTrees(scene, trees, tr, .62);
  const hg = U.merge([[new T.BoxGeometry(1, .7, 1.3).translate(0, .35, 0), '#efe9dc'], [new T.CylinderGeometry(0, .95, .5, 4).rotateY(Math.PI / 4).scale(1, 1, 1.25).translate(0, .95, 0), '#b4553c']]);
  const houses = new T.InstancedMesh(hg, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 }), 22); let nh = 0;
  VILL.forEach((v, vi) => { for (let k = 0; k < (vi ? 8 : 14); k++) { const x = v[0] + ((k % 5) - 2) * .42 + (rnd() - .5) * .16, z = v[1] + (((k / 5) | 0) - 1) * .5 + (rnd() - .5) * .14, s = .15 + rnd() * .05;
    Q.setFromAxisAngle(UP, .3 + (rnd() < .5 ? 0 : Math.PI / 2) + (rnd() - .5) * .2); M4.compose(V.set(x, height(x, z) - .01, z), Q, SC.setScalar(s)); houses.setMatrixAt(nh, M4); houses.setColorAt(nh, col.setHSL(.07, .1, .8 + rnd() * .2)); nh++; } });
  scene.add(U.shadowed(houses));
  [[-9.5, 10.6, -3.5, 3.4], [-4.5, 11, -5.2, 2.6], [2.5, 11, -4.8, 3]].forEach((c, k) => { const cl = U.cloud(c[3], c[3] * .42, c[3] * .6, 7, rnd); cl.position.set(c[0], c[1], c[2]); scene.add(cl); anim.push(t => { cl.position.x = c[0] + Math.sin(t * .05 + k * 2) * 1.4; }); });

  // 凹岸（侵蝕，紅）與凸岸（堆積，黃）的標示帶：左右岸各一條連續的帶子，顏色與透明度隨彎曲程度平順變化
  const bankBand = sd => {
    const bp = [], bc = [], bi = []; let n = 0;
    main.pts.forEach((o, i) => {
      if (o.x < -5 || o.y < .04) return;
      const outer = -sd * Math.sign(o.k) > 0, ak = Math.abs(o.k), a = ss(.1, .55, ak) * ss(-5, -4.4, o.x) * ss(.04, .1, o.y);
      const dmax = .9 / Math.max(o.kr, .05), d1 = outer ? o.hw + .22 * a : Math.min(o.hw + .16 * a, dmax), d0 = outer ? o.hw - .04 : Math.min(o.hw * .84, d1 - .14), c = outer ? [.94, .27, .27] : [.98, .8, .08];      // 帶子越靠近彎頂越寬，兩端收成尖細的月牙
      const pp = [d0, d1].map(dd => [o.x - o.tz * sd * dd, o.z + o.tx * sd * dd]), yy = Math.max(height(pp[0][0], pp[0][1]), height(pp[1][0], pp[1][1]), waterY(o)) + .06;      // 內側不超過彎道的圓心（不會摺成尖角）；同一段兩個頂點等高（不會被河岸切成鋸齒）
      for (const q of pp) { bp.push(q[0], yy, q[1]); bc.push(c[0], c[1], c[2], a); }
      if (n) bi.push(n - 2, n - 1, n, n - 1, n + 1, n); n += 2;
    });
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(bp, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(bc, 4)); geo.setIndex(bi);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, toneMapped: false })); m.renderOrder = 6; scene.add(m); return m;
  };
  const bands = [bankBand(1), bankBand(-1)];

  /* 節點圓點與解說標籤 */
  const zn = G.zones.river, def = G.zoneDef('river'), dots = {};
  for (const n of zn.nodes) dots[n.id] = G.addLabel(`<b>${n.num}</b><span>${n.title}</span>`, 'node' + (n.ready ? '' : ' soon'), n.at, { color: n.color || def.color, onClick: () => G.openNode(n.id) });
  const tag = (html, p) => G.addLabel(html, 'tag', p), mp = (x, dy = .5, off = 0) => { const o = main.pts[mainAt(x)]; return [o.x - o.tz * off, waterY(o) + dy, o.z + o.tx * off]; };
  const hp = (p, dy) => [p[0], Math.max(height(p[0], p[1]), .05) + dy, p[1]], src = main.pts[0], t1 = tribs[1].pts[8], rvO = main.pts[APM.i + 6];
  const tags = {
    flow: [tag('坡度陡<small>水流得又快又急</small>', mp(-8.2, 1.2, 1)), tag('瀑布<small>河床突然下降</small>', [wf.x - .6, waterY(wf) + 1.3, wf.z]), tag('坡度緩<small>水流變慢</small>', mp(-3.6, .7, 1))],
    work: [tag('侵蝕<small>水流把河床、河岸的岩石和泥沙挖走</small>', mp(-6.9, .8, -.4)), tag('搬運<small>水流帶著石頭和泥沙往下游走</small>', mp(-4.0, .55, -.9)),
      tag('堆積<small>水流變慢，石頭和泥沙停下來</small>', mp(-3.0, .4, .95)), tag('壺穴<small>河床岩石上被磨出的圓洞</small>', [POT.x + .15, POT.y + .32, POT.z + .75])],
    upper: [tag('V 型谷<small>河水向下侵蝕，兩岸又陡又窄</small>', mp(-10.3, 1.7, .2)), tag('向源侵蝕<small>源頭不斷崩落，河流往上游延長</small>', [src.x + .2, waterY(src) + 1.1, src.z + .4]),
      tag('瀑布<small>會慢慢往上游後退</small>', [wf.x - .7, waterY(wf) + 1.3, wf.z - .2]), tag('大石頭<small>有稜有角</small>', mp(-6.5, .45, -.8)), tag('支流', [t1.x, waterY(t1) + .6, t1.z])],
    middle: [tag('凹岸<small>流速快，侵蝕作用強</small>', hp(bankPt(APM.o, true, .75), .6)), tag('凸岸<small>流速慢，堆積作用強</small>', hp(bankPt(APM.o, false, .75), .5)),
      tag('河階<small>一階一階的平臺</small>', mp(-4.2, .65, -1.9)), tag('護岸<small>保護凹岸不被沖刷</small>', hp(bankPt(rvO, true, .55), .5)), tag('固床工<small>把陡坡變成階梯</small>', mp(SILLX[1], .75, -.7))],
    lower: [tag('凹岸<small>侵蝕作用強</small>', hp(bankPt(APL.o, true, .6), .5)), tag('凸岸<small>堆積作用強</small>', hp(bankPt(APL.o, false, .9), .45)), tag('曲流', hp(bankPt(APS.o, false, 1.1), .5)),
      tag('牛軛湖<small>被截斷的舊河道</small>', [OX.x, LAKE + .5, OX.z - OX.R]), tag('截彎取直後的新河道', mp(5.9, .4)),
      tag('出海口<small>河水流進大海，流速變慢</small>', mp(9.2, .9, 1.9)), tag('三角洲<small>泥沙在河口堆出的扇形陸地</small>', [11.7, .7, -.2]), tag('分流', [11.4, .4, .65]), tag('沙洲', [DBARS[0][0], .45, DBARS[0][1]])],
    overview: [tag('上游<small>又窄又深，水流急，大石頭多</small>', mp(-9.8, 2.4)), tag('中游<small>河道變寬，鵝卵石多，開始彎曲</small>', mp(-3.6, .5, -1.9)), tag('下游<small>又寬又淺，水流慢，泥沙多</small>', mp(5.4, 1.1, -1.6))],
  };

  /* 點模型：依點到的位置開啟對應的節點 */
  const hitAt = rr => { if (!rr) return null; const o = rr.ray.origin, d = rr.ray.direction; for (let t = 2; t < 110; t += .12) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < YB) break; if (x < X0 || x > X1 || z < Z0 || z > Z1) continue; if (y < Math.max(0, height(x, z))) return [x, z]; } return null; };
  const nodeAt = p => { if (!p) return null; const [x, z] = p, e = grid(E, x, z);
    if (Math.hypot(x - POT.x, z - POT.z) < .6) return 'work'; if (x > 9.2 || oxDist(x, z) < OX.hw + .3) return 'lower';
    if (e > 2.4) return null; return x < -5.6 ? 'upper' : x < -1.7 ? 'middle' : 'lower'; };
  let cur = null, hot = null, glow = 0;
  return {
    scene, home: { pos: [.5, 11, 24.5], target: [.5, .4, 0] },
    view: { minDist: 3, maxDist: 62, maxPolar: Math.PI * .49, pan: { x: [X0, X1], y: [YB, 6], z: [Z0, Z1] } },
    onNode: id => { cur = id; for (const k in tags) tags[k].forEach(L => L.el.classList.toggle('show', k === id)); for (const k in dots) dots[k].el.classList.toggle('cur', k === id); },   // 開著的節點把自己的圓點藏起來，免得擋住解說標籤
    onHover: rr => { const n = nodeAt(hitAt(rr)); if (n !== hot) { hot = n; G.canvas.style.cursor = n ? 'pointer' : ''; } },
    onTap: rr => { const n = nodeAt(hitAt(rr)); if (n && n !== G.state.nodeId) G.openNode(n); },
    update(dt, t) {
      glow += ((cur === 'middle' || cur === 'lower' ? 1 : 0) - glow) * Math.min(1, dt * 4);
      bands.forEach((m, k) => { m.material.opacity = glow * (.62 + .2 * Math.sin(t * 3 + k)); m.visible = glow > .01; });
      for (const f of anim) f(t, dt);
    },
    dispose() { G.canvas.style.cursor = ''; U.dispose(scene); }
  };
}

/* ---------- 圖鑑與認識頁的繪圖（SVG）：沒有實景照片時顯示 ---------- */
function rSVG(kind) {
  const r = U.rng(kind.length * 29 + kind.charCodeAt(1) * 5), o = [], f = n => n.toFixed(1), id = 'rv_' + kind;
  const R = (x, y, w, h, c, ex = '') => o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${ex}/>`);
  const Pt = (d, fill, stroke = 'none', sw = 0, ex = '') => o.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${ex}/>`);
  const Tx = (x, y, s, c = '#1f3345', size = 13, anchor = 'middle') => o.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="900" text-anchor="${anchor}" fill="${c}" paint-order="stroke" stroke="${c === '#fff' ? 'rgba(20,40,60,.75)' : '#fff'}" stroke-width="3.5" stroke-linejoin="round">${s}</text>`);
  const El = (cx, cy, rx, ry, c, ex = '') => o.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}" ${ex}/>`);
  const specks = (n, cols, x0, y0, w, h, a = .8, b = 2) => { for (let i = 0; i < n; i++) o.push(`<circle cx="${f(x0 + r() * w)}" cy="${f(y0 + r() * h)}" r="${f(a + r() * b)}" fill="${cols[i % cols.length]}"/>`); };
  const stone = (cx, cy, rx, ry, n, j, fill, stroke = 'rgba(40,35,30,.45)') => { let d = ''; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + .3, k = 1 + (r() - .5) * 2 * j; d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rx * k) + ' ' + f(cy + Math.sin(a) * ry * k); } Pt(d + 'Z', fill, stroke, 1.5); };
  const head = (x, y, dx, dy, c, w) => { const h = w * 2.6, bx = x - dx * h * .5, by = y - dy * h * .5; Pt(`M${f(x + dx * h * .5)} ${f(y + dy * h * .5)}L${f(bx - dy * h * .6)} ${f(by + dx * h * .6)}L${f(bx + dy * h * .6)} ${f(by - dx * h * .6)}Z`, c); };
  const arrow = (x1, y1, x2, y2, c = '#fff', w = 4) => { const l = Math.hypot(x2 - x1, y2 - y1), dx = (x2 - x1) / l, dy = (y2 - y1) / l; Pt(`M${f(x1)} ${f(y1)}L${f(x2 - dx * w * 2)} ${f(y2 - dy * w * 2)}`, 'none', c, w); head(x2 - dx * w * 1.3, y2 - dy * w * 1.3, dx, dy, c, w); };
  // 河道：由遠到近、有寬度變化的一條平滑水帶
  const band = (cx, w, y0, y1, n = 30) => { let L = '', Rr = ''; for (let i = 0; i <= n; i++) { const t = i / n, y = lerp(y0, y1, t); L += (i ? 'L' : 'M') + f(cx(t) - w(t)) + ' ' + f(y); Rr = 'L' + f(cx(t) + w(t)) + ' ' + f(y) + Rr; } return L + Rr + 'Z'; };
  const inner = (cx, t) => Math.sign(cx(t + .05) + cx(t - .05) - 2 * cx(t)) || 1;
  // 圓弧（角度制，90 度朝下）
  const pol = (cx, cy, rr, a) => [cx + rr * Math.cos(a * Math.PI / 180), cy + rr * Math.sin(a * Math.PI / 180)];
  const arcD = (cx, cy, rr, a0, a1) => { const p = pol(cx, cy, rr, a0), q = pol(cx, cy, rr, a1); return `M${f(p[0])} ${f(p[1])}A${rr} ${rr} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f(q[0])} ${f(q[1])}`; };
  const arcArrow = (cx, cy, rr, a0, a1, c, w) => { const s = Math.sign(a1 - a0), q = pol(cx, cy, rr, a1), ar = a1 * Math.PI / 180; Pt(arcD(cx, cy, rr, a0, a1 - s * w * 1.1), 'none', c, w); head(q[0], q[1], -Math.sin(ar) * s, Math.cos(ar) * s, c, w); };
  const GREY = ['#bdb7ad', '#8d877f', '#a59f95', '#d0cabf'], BC = [160, 16, 118, 50];      // 俯視彎道共用的圓心、半徑、河寬
  const bend = (land = '#9ccc74') => { R(0, 0, 320, 200, land); specks(40, ['#8dbd66', '#aad684'], 0, 0, 320, 200, 2, 4); Pt(arcD(BC[0], BC[1], BC[2], -10, 190), 'none', '#5fb0d8', BC[3], 'stroke-linecap="butt"'); };
  if (kind === 'pothole') {
    R(0, 0, 320, 200, '#a8a299'); specks(260, ['#bdb7ad', '#8d877f', '#99938a'], 0, 0, 320, 200, 1, 2.5);
    R(0, 0, 320, 200, '#58a9cf', 'opacity=".4"'); for (let i = 0; i < 9; i++) { const y = 14 + i * 21; Pt(`M${f(r() * 60)} ${y}q60 ${f((r() - .5) * 16)} 120 0t${f(90 + r() * 40)} 0`, 'none', 'rgba(255,255,255,.5)', 2); }
    for (const [x, y, a, b] of [[98, 118, 46, 31], [216, 104, 30, 20], [262, 152, 20, 13], [160, 62, 15, 10]]) { El(x, y, a + 4, b + 3, '#d3cdc3'); El(x, y, a, b, '#4a443d'); El(x, y + b * .16, a * .86, b * .78, '#2f6f8c'); Pt(`M${f(x - a * .6)} ${f(y - b * .1)}Q${x} ${f(y - b * .55)} ${f(x + a * .5)} ${f(y - b * .2)}`, 'none', 'rgba(255,255,255,.45)', 2); }
    for (const [x, y] of [[82, 126], [112, 130], [100, 112]]) El(x, y, 5, 4, '#e6e0d4', 'stroke="#6b655d"');
    Pt('M68 122A31 17 0 1 0 128 118', 'none', '#fff', 2.5, 'stroke-dasharray="5 4"'); head(128, 117, .1, -1, '#fff', 2.5); arrow(14, 30, 70, 30, '#fff', 3.5); Tx(100, 26, '水流', '#fff', 12);
    Tx(160, 190, '河床上：小石頭在洞裡打轉，把洞磨圓、磨深');
  }
  if (kind === 'round') {
    R(0, 0, 320, 200, '#d7ecf6'); Pt('M0 132Q160 112 320 138V200H0Z', '#7cc0e2'); Pt('M0 150Q160 132 320 156V200H0Z', '#cbb994'); specks(90, ['#b9a57c', '#ddcda6'], 0, 156, 320, 44);
    stone(56, 112, 34, 28, 7, .28, '#8f8a84'); stone(160, 114, 28, 22, 11, .1, '#a39d94'); El(262, 116, 24, 16, '#bdb7ac', 'stroke="rgba(40,35,30,.45)" stroke-width="1.5"'); Pt('M246 110Q258 102 274 108', 'none', 'rgba(255,255,255,.6)', 2.5);
    arrow(98, 112, 124, 112, '#1d4ed8', 4); arrow(196, 114, 230, 114, '#1d4ed8', 4); Tx(160, 28, '被流水搬運，一路碰撞、摩擦');
    Tx(56, 172, '有稜有角', '#1f3345', 12.5); Tx(160, 172, '稜角磨掉了', '#1f3345', 12.5); Tx(262, 172, '又圓又光滑', '#1f3345', 12.5);
  }
  if (kind === 'bar') {
    R(0, 0, 320, 200, '#9ccc74'); specks(60, ['#8dbd66', '#aad684'], 0, 0, 320, 36, 2, 4); specks(60, ['#8dbd66', '#aad684'], 0, 164, 320, 36, 2, 4); Pt('M0 46C90 34 220 34 320 50V152C230 166 90 166 0 150Z', '#62b3da');
    Pt('M96 100C120 76 210 76 240 98C214 124 126 126 96 100Z', '#dfd0a4', '#c2b186', 1.5); for (let i = 0; i < 40; i++) El(124 + r() * 88, 90 + r() * 20, 2.5 + r() * 3, 2 + r() * 2, GREY[i % 4]);
    arrow(14, 98, 70, 98); arrow(110, 60, 190, 56); arrow(110, 142, 190, 146); arrow(256, 100, 306, 102); Tx(168, 104, '沙洲', '#7a5a14'); Tx(160, 190, '水流變慢的地方，石頭和泥沙停下來');
  }
  if (kind === 'upper') {
    const cx = t => 160 + 9 * Math.sin(t * 5.2 + .6) * (.4 + .6 * t), w = t => 4 + 22 * t * t;
    R(0, 0, 320, 200, '#cfe6f3'); Pt('M96 200L160 62 224 200Z', '#7fae78'); Pt('M0 200V64L52 26 100 70 152 160V200Z', '#4b8a4d'); Pt('M0 200V64L52 26 70 80 40 140 56 200Z', '#3e7743');
    Pt('M168 200V160L224 62 272 18 320 58V200Z', '#356c3d'); Pt('M272 18L320 58V200H286L300 110Z', '#2c5c34'); Pt('M124 200L160 104 196 200Z', '#8a8f80');
    Pt(band(cx, w, 110, 200), '#8fd0ee'); for (const t of [.25, .45, .62, .78, .92]) { const y = 110 + 90 * t; Pt(`M${f(cx(t) - w(t) * .6)} ${f(y)}l${f(w(t) * 1.1)} 2.5`, 'none', '#fff', 2.5); }
    for (const [x, y, s] of [[126, 188, 13], [198, 186, 12], [180, 154, 8], [140, 150, 7], [212, 198, 9], [112, 198, 8]]) stone(x, y, s, s * .8, 6, .3, GREY[(x | 0) % 3]);
    Tx(160, 26, '河谷又深又窄，水流很急'); Tx(72, 192, '大石頭', '#fff', 12);
  }
  if (kind === 'middle') {
    const cx = t => 176 + (12 + 46 * t) * Math.sin(t * 5.4 + .4) - 26 * t, w = t => 9 + 44 * t * t;
    R(0, 0, 320, 200, '#cfe6f3'); Pt('M0 108Q60 62 120 94T240 78T320 96V200H0Z', '#5c9a52'); Pt('M0 124Q160 104 320 118V200H0Z', '#86b765');
    const bars = [.22, .78].map(t => { const s = inner(cx, t), x = cx(t) + s * (w(t) + 8 + 12 * t), y = 116 + 84 * t, a = 16 + 20 * t, b = 5 + 7 * t; El(x, y, a, b, '#cfc8b8'); return [x, y, a, b]; });
    Pt(band(cx, w, 116, 200), '#6fbde0');
    for (const [x, y, a, b] of bars) for (let i = 0; i < 16; i++) { const q = r() * 6.28, d = Math.sqrt(r()) * .8; El(x + Math.cos(q) * a * d, y + Math.sin(q) * b * d, 2.6 + r() * 2.6, 1.8 + r() * 1.6, GREY[i % 4], 'stroke="rgba(60,55,50,.4)" stroke-width=".8"'); }
    Tx(160, 26, '河道變寬，開始彎曲'); Tx(bars[1][0], bars[1][1] - bars[1][3] - 6, '鵝卵石', '#1f3345', 12);
  }
  if (kind === 'lower') {
    const cx = t => 166 + (10 + 60 * t) * Math.sin(t * 6.2 + .3), w = t => 10 + 62 * t * t;
    R(0, 0, 320, 200, '#cfe6f3'); R(0, 64, 320, 18, '#5aa7d6'); R(0, 80, 320, 120, '#9ccc74');
    for (const [x, y, ww, c] of [[8, 94, 46, '#c6be6a'], [262, 96, 50, '#86bd62'], [4, 128, 52, '#b9d77a'], [2, 166, 44, '#caa86e'], [270, 134, 46, '#b0d47c']]) Pt(`M${x} ${y}h${ww}l6 22h${-ww - 12}Z`, c, 'rgba(90,110,60,.5)', 1);
    const bars = [.2, .71].map(t => { const s = inner(cx, t), x = cx(t) + s * (w(t) + 4 + 8 * t), y = 80 + 120 * t; El(x, y, 10 + 26 * t, 4 + 9 * t, '#e2d2a4'); return [x, y]; });
    Pt(band(cx, w, 80, 200), '#8fbfc6');
    Tx(160, 26, '平坦的平原，河道又寬又彎'); Tx(160, 60, '大海', '#1e40af', 12); Tx(bars[1][0], bars[1][1] + 4, '泥沙', '#7a5a14', 12);
  }
  if (kind === 'meander') {
    bend(); Pt(arcD(BC[0], BC[1], 86, 30, 150), 'none', '#e6d6a6', 15); Pt(arcD(BC[0], BC[1], 146, -10, 190), 'none', '#dc2626', 5, 'stroke-dasharray="9 6" stroke-linecap="butt"');
    for (const a of [168, 110, 52]) arcArrow(BC[0], BC[1], 130, a, a - 40, '#fff', 4.5); for (const a of [160, 102, 44]) arcArrow(BC[0], BC[1], 104, a, a - 20, '#eaf6fc', 2.6);
    Tx(160, 44, '凸岸：流速慢', '#7a5a14', 12.5); Tx(160, 62, '堆積作用強', '#7a5a14', 12.5); Tx(160, 190, '凹岸：流速快，侵蝕作用強', '#b91c1c', 12.5);
  }
  if (kind === 'bankuse') {
    bend(); Pt(arcD(BC[0], BC[1], 86, 30, 150), 'none', '#e6d6a6', 15); Pt(arcD(BC[0], BC[1], 72, 24, 156), 'none', '#60a5fa', 2.5, 'stroke-dasharray="5 4"');
    for (const [x, c] of [[122, '#c6be6a'], [150, '#86bd62'], [178, '#b9d77a']]) R(x, 62, 22, 14, c, 'stroke="rgba(90,110,60,.6)"'); Tx(160, 30, '凸岸：不容易被沖走', '#3f5a14', 12); Tx(160, 48, '但大水時會淹到虛線', '#1d4ed8', 11.5);
    const hs = (x, y, rot) => o.push(`<g transform="rotate(${rot} ${x} ${y})"><rect x="${x - 10}" y="${y - 7}" width="20" height="14" fill="#f3ede0" stroke="#7c5a45"/><path d="M${x - 13} ${y - 7}L${x} ${y - 18}L${x + 13} ${y - 7}Z" fill="#b4553c"/></g>`);
    hs(52, 146, -14); hs(262, 150, 10); Pt('M66 132l8 10-6 8 10 8', 'none', '#7f1d1d', 2.5); Pt('M250 134l-8 9 7 8-9 9', 'none', '#7f1d1d', 2.5);
    for (const a of [150, 90, 34]) arcArrow(BC[0], BC[1], 128, a, a - 34, '#fff', 4); Tx(160, 190, '凹岸：河岸被掏空，緊鄰的建築有危險', '#b91c1c', 12.5);
  }
  if (kind === 'revet') {
    bend(); Pt(arcD(BC[0], BC[1], 86, 30, 150), 'none', '#e6d6a6', 15); Pt(arcD(BC[0], BC[1], 148, 8, 172), 'none', '#6f6a63', 11, 'stroke-linecap="butt"'); Pt(arcD(BC[0], BC[1], 148, 8, 172), 'none', '#cfc9bd', 8, 'stroke-dasharray="9 3" stroke-linecap="butt"');
    for (const a of [150, 96, 42]) arcArrow(BC[0], BC[1], 126, a, a - 32, '#fff', 4); Tx(160, 52, '凸岸', '#7a5a14', 12.5); Tx(160, 188, '護岸：在凹岸鋪石塊或混凝土，擋住沖刷', '#1f3345', 12.5);
  }
  if (kind === 'groin') {
    R(0, 0, 320, 200, '#9ccc74'); R(0, 36, 320, 112, '#62b3da');
    for (const x of [64, 148, 232]) { Pt(`M${x + 12} 148Q${x + 30} 122 ${x + 78} 148Z`, '#e6d6a6'); R(x, 100, 12, 50, '#8d877f', 'stroke="#5f5a54" stroke-width="1.2"'); arcArrow(x + 44, 118, 9, 150, 400, '#eaf6fc', 2); }
    Pt('M10 126Q44 124 56 96', 'none', '#fff', 4); head(57, 93, .35, -.94, '#fff', 4);
    Pt('M60 84Q106 62 150 84T240 84T312 76', 'none', '#fff', 4.5); head(313, 76, 1, -.1, '#fff', 4.5);
    Tx(160, 58, '主要的水流被推到河中央', '#fff', 12); Tx(34, 168, '丁壩', '#1f3345', 13); Pt('M46 158L66 146', 'none', '#1f3345', 1.5); Tx(200, 168, '丁壩之間：水流變慢，泥沙淤積', '#1f3345', 11.5);
    Tx(160, 190, '從岸邊伸進河裡的短堤，保護河岸', '#1f3345', 12.5);
  }
  if (kind === 'sill') {
    const cx = () => 160, w = t => 26 + 54 * t, Y = t => 48 + 152 * t;
    R(0, 0, 320, 200, '#cfe6f3'); Pt('M0 70Q80 30 160 50T320 40V200H0Z', '#5c9a52');
    o.push(`<defs><clipPath id="${id}"><path d="M0 200V96L134 48H186L320 96V200Z"/></clipPath></defs>`); Pt('M0 200V96L134 48H186L320 96V200Z', '#9a948a'); o.push(`<g clip-path="url(#${id})">`);
    for (let i = 0; i < 150; i++) El(r() * 320, 50 + r() * 150, 5 + r() * 5, 3.5 + r() * 3, GREY[i % 4], 'stroke="rgba(60,55,50,.45)" stroke-width=".8"'); o.push('</g>');
    Pt(band(cx, w, 48, 200), '#6fbde0');
    for (const t of [.26, .55, .86]) { const y = Y(t), ww = w(t); R(f(160 - ww), f(y - 5), f(ww * 2), 7, '#6d6862'); R(f(160 - ww + 3), f(y + 2), f(ww * 2 - 6), f(7 + 6 * t), '#fff', 'opacity=".88"'); for (let k = 0; k < 6; k++) Pt(`M${f(160 - ww + 8 + k * (ww * 2 - 16) / 5)} ${f(y + 3)}v${f(6 + 5 * t)}`, 'none', '#bfe3f5', 1.6); }
    Tx(160, 24, '固床工：把陡坡變成一階一階'); Tx(40, 150, '護岸', '#fff', 12.5); Tx(280, 150, '護岸', '#fff', 12.5);
  }
  if (kind === 'oxbow') {
    R(0, 0, 320, 200, '#f8fafc'); o.push('<defs><clipPath id="' + id + '"><rect width="100" height="150" rx="8"/></clipPath></defs>');
    const pan = (k, title, body) => o.push(`<g transform="translate(${4 + k * 106} 34)"><rect width="100" height="150" rx="8" fill="#9ccc74"/><g clip-path="url(#${id})">${body}</g></g><text x="${54 + k * 106}" y="22" font-size="12" font-weight="900" text-anchor="middle" fill="#1f3345">${title}</text>`);
    const S = (d, c = '#5fb0d8', w = 13) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`, lab = (x, y, s, c = '#1f3345') => `<text x="${x}" y="${y}" font-size="10.5" font-weight="900" text-anchor="middle" fill="${c}">${s}</text>`;
    pan(0, '① 曲流越來越彎', S('M72 -10V30C72 52 30 46 30 75C30 104 72 98 72 120V160'));
    pan(1, '② 曲流頸被切穿', S('M72 -10V40C72 58 54 56 42 47C24 34 12 56 12 75C12 94 24 116 42 103C54 94 72 92 72 110V160') + '<path d="M62 58H84M62 92H84" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="4 3"/>' + lab(45, 79, '曲流頸', '#b91c1c'));
    pan(2, '③ 留下牛軛湖', S('M72 -10V160') + S('M54 50C28 30 12 56 12 75C12 94 28 120 54 100', '#3f8f8c', 12) + lab(36, 79, '牛軛湖', '#fff') + lab(84, 140, '新河道'));
    arrow(104, 109, 111, 109, '#dc2626', 2.4); arrow(210, 109, 217, 109, '#dc2626', 2.4);
  }
  if (kind === 'delta') {
    R(0, 0, 320, 200, '#3f8fcf'); Pt('M118 100Q150 50 222 8Q296 50 298 100Q296 150 222 192Q150 150 118 100Z', '#7fbfd8');
    R(0, 0, 120, 200, '#9ccc74'); specks(36, ['#8dbd66', '#b7d98a', '#c6be6a'], 0, 0, 116, 200, 2, 4); R(118, 0, 6, 200, '#e6d6a6'); R(0, 89, 126, 22, '#62b3da');
    Pt('M118 100Q150 72 216 30Q262 60 264 100Q262 140 216 170Q150 128 118 100Z', '#bfd58c', '#e8dab0', 5);
    Pt('M122 100Q180 92 246 62', 'none', '#62b3da', 10); Pt('M122 100Q180 108 246 138', 'none', '#62b3da', 10);
    El(288, 100, 5.5, 22, '#e8dab0', 'stroke="#cdbb8a"'); o.push('<g transform="rotate(32 258 26)">'); El(258, 26, 5, 18, '#e8dab0', 'stroke="#cdbb8a"'); o.push('</g><g transform="rotate(-32 258 174)">'); El(258, 174, 5, 18, '#e8dab0', 'stroke="#cdbb8a"'); o.push('</g>');
    arrow(12, 100, 78, 100); Tx(226, 104, '三角洲', '#3f5a14', 13); Tx(172, 82, '分流', '#fff', 11); Tx(172, 126, '分流', '#fff', 11); Tx(60, 132, '河流', '#1e40af', 12); Tx(300, 186, '大海', '#fff', 12); Tx(300, 66, '沙洲', '#fff', 11.5);
    Tx(84, 190, '泥沙在河口堆成扇形的陸地', '#1f3345', 12);
  }
  if (kind === 'sandbar') {
    R(0, 0, 320, 200, '#3f8fcf'); R(0, 0, 150, 200, '#9ccc74'); specks(30, ['#8dbd66', '#aad684'], 0, 0, 146, 200, 2, 4); R(148, 0, 7, 200, '#e6d6a6'); R(0, 86, 156, 30, '#5fb0d8');
    Pt('M154 44Q176 60 180 96Q181 126 170 142Q164 118 160 100Q158 82 154 70Z', '#e6d6a6', '#cbb886', 1.5); specks(34, ['#d2c08c', '#f2e6bc'], 160, 60, 16, 70, .8, 1.3);
    arrow(18, 101, 110, 101); Pt('M150 106Q166 150 196 166', 'none', '#fff', 3, 'stroke-dasharray="6 5"'); head(199, 168, .85, .5, '#fff', 3);
    arrow(204, 16, 204, 70, '#fde68a', 4.5); arrow(204, 96, 204, 150, '#fde68a', 4.5); Tx(250, 40, '海流', '#fff', 13); Tx(250, 56, '沿著海岸流動', '#fff', 11);
    for (const y of [92, 122, 152]) Pt(`M306 ${y}q-10 -8 -20 0t-20 0`, 'none', '#eaf6fc', 2.5); arrow(262, 108, 228, 108, '#eaf6fc', 2.5); Tx(286, 80, '海浪', '#fff', 12);
    Tx(108, 54, '沙洲', '#7a5a14'); Pt('M124 56L158 72', 'none', '#7a5a14', 1.5); Tx(60, 80, '河流', '#1e40af', 12); Tx(160, 192, '河流帶來的泥沙，被海流和海浪推成長條形', '#1f3345', 12);
  }
  if (kind === 'vvalley') {
    R(0, 0, 320, 200, '#cfe6f3'); Pt('M0 200V52L64 40 160 172 256 40 320 52V200Z', '#9a8b76'); for (let y = 66; y < 200; y += 20) Pt(`M0 ${y}L${f(64 + (y - 40) * .727)} ${y}M320 ${y}L${f(256 - (y - 40) * .727)} ${y}`, 'none', 'rgba(60,45,30,.3)', 1.5);
    Pt('M0 52L64 40 160 172 256 40 320 52', 'none', '#4b8a4d', 7); Pt('M146 153L160 172 174 153Z', '#5fb0d8'); arrow(160, 96, 160, 146, '#dc2626', 5);
    Tx(160, 30, 'V 型谷'); Tx(160, 88, '向下侵蝕', '#b91c1c', 12.5); Tx(70, 150, '兩岸又陡又窄', '#fff', 12);
  }
  if (kind === 'waterfall') {
    R(0, 0, 320, 200, '#cfe6f3');
    Pt('M0 200V98H178C162 108 152 124 156 146C160 162 170 172 184 176C198 197 252 197 268 176H320V200Z', '#bfa983'); specks(50, ['#ad9772', '#d2be98'], 0, 104, 140, 92, 1, 2);
    R(0, 72, 182, 26, '#6b6660'); specks(60, ['#5a5550', '#7d7872'], 0, 74, 180, 22, 1, 2);
    Pt('M182 72H250V98M250 98V176', 'none', '#6b6660', 1.6, 'stroke-dasharray="5 4"'); Tx(284, 92, '以前的位置', '#4b5563', 10.5);
    Pt('M184 176C198 197 252 197 268 176Z', '#62b3da'); R(266, 172, 54, 5, '#62b3da');
    Pt('M0 60H180Q194 60 194 76V180H183V80Q183 72 176 72H0Z', '#7cc4e6'); Pt('M186 82V172M191 90V176', 'none', '#fff', 2, 'stroke-dasharray="9 7"'); El(190, 178, 20, 7, '#fff', 'opacity=".85"');
    stone(214, 189, 7, 5, 6, .25, '#6b6660'); stone(232, 190, 6, 4, 6, .25, '#6b6660');
    arcArrow(226, 180, 12, 200, 330, '#fff', 2.2);
    arrow(246, 44, 150, 44, '#dc2626', 4.5); Tx(160, 30, '瀑布慢慢往上游後退（向源侵蝕）', '#b91c1c', 12.5);
    Tx(70, 90, '堅硬的岩層', '#fff', 12); Tx(64, 170, '較軟的岩層', '#5a4a2a', 12);
    Tx(86, 132, '① 下面被水掏空', '#1f3345', 11.5); arrow(134, 128, 154, 128, '#1f3345', 2.2);
    Tx(262, 122, '② 上面的岩層', '#1f3345', 11.5); Tx(262, 137, '失去支撐而崩落', '#1f3345', 11.5); Pt('M232 142L220 180', 'none', '#1f3345', 1.3);
    Tx(262, 162, '③ 水流沖出深潭', '#1e40af', 11.5);
  }
  if (kind === 'uvalley') {
    R(0, 0, 320, 200, '#cfe6f3'); Pt('M0 200V56L26 48 80 150 134 48 160 56V200Z', '#9a8b76'); Pt('M0 56L26 48 80 150 134 48 160 56', 'none', '#4b8a4d', 6); Pt('M70 136L80 150 90 136Z', '#5fb0d8');
    Pt('M160 200V56L186 48C196 150 208 152 240 152S284 150 294 48L320 56V200Z', '#8f8a84'); Pt('M186 48C196 150 208 152 240 152S284 150 294 48', 'none', '#e8eef2', 6); Pt('M196 96C202 150 212 152 240 152S278 150 284 96Q240 108 196 96Z', '#dff1fb', '#a9cfe6', 1.5);
    Pt('M160 40V200', 'none', '#fff', 3); Tx(80, 28, '河流：V 型谷'); Tx(240, 28, '冰河：U 型谷'); Tx(240, 130, '冰河', '#1e40af', 12); Tx(80, 186, '谷底窄', '#fff', 12); Tx(240, 186, '谷底又寬又平', '#fff', 12);
  }
  if (kind === 'terrace') {
    const prof = 'M0 200V58H52L64 88H104L116 118H138L150 156H170L182 118H204L216 88H256L268 58H320V200Z';
    R(0, 0, 320, 200, '#cfe6f3'); Pt(prof, '#cdb88c'); Pt('M0 200V150H148L150 156H170L172 150H320V200Z', '#b39c72'); specks(70, ['#b8a274', '#e0cea2', '#a08a60'], 0, 96, 320, 100, 1, 2);
    Pt('M0 58H52M268 58H320M64 88H104M216 88H256M116 118H138M182 118H204', 'none', '#5d9a3e', 5, 'stroke-linecap="butt"'); Pt('M151 145H169L170 156H150Z', '#5fb0d8');
    Pt('M104 88H216M138 118H182', 'none', '#7c5a2a', 1.6, 'stroke-dasharray="5 4"'); arrow(160, 60, 160, 138, '#dc2626', 4);
    Tx(160, 26, '河階：河流一次次向下侵蝕留下的平臺'); Tx(84, 82, '較早的河階', '#1f3345', 11.5); Tx(236, 82, '較早的河階', '#1f3345', 11.5); Tx(160, 104, '以前的河床', '#7c5a2a', 11); Tx(160, 176, '現在的河床', '#1e40af', 11.5); Tx(112, 138, '較新的河階', '#1f3345', 10.5, 'end');
  }
  return `<svg viewBox="0 0 320 200" role="img" aria-label="${kind}">${o.join('')}</svg>`;
}
/* 河谷橫切面的小圖：1 上游、2 中游、3 下游 */
function xsSVG(k) {
  const g = ['M0 110V20L16 16 75 98 134 16 150 20V110Z', 'M0 110V44L28 42 50 84H100L122 42 150 44V110Z', 'M0 110V68L14 67 30 82H120L136 67 150 68V110Z'][k - 1], w = ['M67 87L75 98 83 87Z', 'M45 74H105L100 84H50Z', 'M22 74.5H128L120 82H30Z'][k - 1];
  const st = k === 1 ? '<path d="M66 90l6-5 5 4-2 6zM80 92l5-4 3 5z" fill="#8d877f" stroke="#5f5a54" stroke-width=".8"/>' : k === 2 ? [56, 66, 77, 88, 96].map(x => `<ellipse cx="${x}" cy="82.5" rx="4" ry="2.4" fill="#cfc8b8" stroke="#8d877f" stroke-width=".7"/>`).join('') : '<path d="M30 82H120" stroke="#d8c690" stroke-width="3" stroke-dasharray="1.5 2.5"/>';
  return `<svg viewBox="0 0 150 110" role="img" aria-label="河谷橫切面"><rect width="150" height="110" fill="#e6f2fa"/><path d="${g}" fill="#a39378"/><path d="${g.replace(/V110Z$/, '').replace(/^M0 110V/, 'M0 ')}" fill="none" stroke="#5d9a3e" stroke-width="4" stroke-linejoin="round"/><path d="${w}" fill="#5fb0d8"/>${st}</svg>`;
}

/* 本區用的小樣式（插圖、比較表、延伸、名詞表、實驗的選項按鈕） */
(function rivCSS() {
  if (document.getElementById('rivCss')) return; const st = document.createElement('style'); st.id = 'rivCss';
  st.textContent = `.rfig{margin:6px 0 10px} .rfig svg{width:100%;height:auto;display:block;border-radius:12px;border:1px solid var(--line)}
    .rxs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0;text-align:center;font-size:13.5px;font-weight:800;line-height:1.4} .rxs svg{width:100%;height:auto;display:block;border-radius:8px;border:1px solid var(--line);margin-bottom:3px} .rxs small{display:block;font-weight:700;color:var(--sub)}
    table.rtab{width:100%;border-collapse:separate;border-spacing:0;margin:10px 0 4px;font-size:15px;line-height:1.5;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
    table.rtab th,table.rtab td{padding:7px 9px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:center;vertical-align:middle}
    table.rtab tr:last-child>*{border-bottom:0} table.rtab tr>*:last-child{border-right:0} table.rtab th{background:#eff6ff;color:#1e3a8a;font-weight:900;white-space:nowrap}
    table.rtab td.bar{color:#7a5a3c;font-weight:900;letter-spacing:1px}
    table.rtab.big td{font-size:15.5px;padding:5px 9px} table.rtab.big td svg{width:100%;max-width:196px;height:auto;display:block;margin:0 auto;border-radius:10px} table.rtab.big tr.xs td svg{max-width:150px} table.rtab.big small{color:var(--sub);font-weight:700}
    dl.rterm{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:15px;line-height:1.6} dl.rterm dt{font-weight:900;color:#075985;white-space:nowrap} dl.rterm dd{margin:0}
    details.rext{border:2px dashed #94a3b8;border-radius:12px;padding:8px 12px;margin:12px 0;background:#f8fafc} details.rext summary{font-weight:900;color:#475569;cursor:pointer} details.rext[open] summary{margin-bottom:6px}
    .lb.node.cur{opacity:0;pointer-events:none}
    .rsel{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 0;font-weight:900} .rsel span{color:var(--sub);margin-left:6px}
    .rsel button{border:2px solid var(--line);background:#fff;border-radius:999px;padding:5px 16px;font-weight:900} .rsel button.on{border-color:var(--accent2);background:#e0f2fe;color:#075985} .rsel button:disabled{opacity:.55}`;
  document.head.appendChild(st);
})();

/* ---------- 探究的觀察活動：坡度、水量與沖走的泥沙（模擬） ---------- */
function observeSlope(el, done) {
  el.innerHTML = `<div class="sim" style="grid-template-columns:1fr"><figure><figcaption>土堆淋水實驗<small>水從坡頂淋下，右邊的盤子接住被沖下來的泥沙</small></figcaption>
      <canvas width="380" height="230" id="slC" style="aspect-ratio:38/23;max-width:460px;background:#eef4f8"></canvas><div class="res" id="slT">選好坡度和水量，按「開始淋水」</div></figure></div>
    <div class="rsel"><span>坡度</span><button data-k="s" data-v="0" class="on">平緩</button><button data-k="s" data-v="1">陡</button><span>水量</span><button data-k="w" data-v="0" class="on">少</button><button data-k="w" data-v="1">多</button></div>
    <div class="row"><button class="cta" id="slGo">💧 開始淋水</button></div>
    <table class="rtab"><tr><th>沖下來的泥沙</th><th>水量少</th><th>水量多</th></tr><tr><th>坡度平緩</th><td class="bar" data-c="00">—</td><td class="bar" data-c="01">—</td></tr><tr><th>坡度陡</th><td class="bar" data-c="10">—</td><td class="bar" data-c="11">—</td></tr></table>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0">這是把實驗簡化的模擬。一次只改變一個條件，才能公平比較。</p>`;
  const g = G.$('#slC').getContext('2d'), W = 380, T = 6.5, AMT = [[1, 2], [3, 5]], st = { s: 0, w: 0 }, tried = {}, r = U.rng(21);
  const grains = Array.from({ length: 150 }, () => [r(), r(), r()]);
  let raf = 0, t0 = 0, run = null, told = false;
  const draw = t => {
    const y0 = st.s ? 50 : 116, y1 = 178, x0 = 46, x1 = 286, amt = AMT[st.s][st.w], k = run ? clamp(t / T, 0, 1) : 0;
    const surf = u => lerp(y0, y1, u) + (run ? amt * 2.3 * k * Math.sin(Math.PI * clamp(u * 1.12, 0, 1)) * (.65 + .35 * Math.sin(u * 23)) : 0), X = u => lerp(x0, x1, u);
    g.clearRect(0, 0, W, 230); g.fillStyle = '#7aa7c7'; g.fillRect(28, 200, 334, 8); g.fillRect(28, 168, 6, 40); g.fillRect(356, 168, 6, 40);
    g.beginPath(); g.moveTo(x0, 200); for (let u = 0; u <= 1.001; u += .02) g.lineTo(X(u), surf(u)); g.lineTo(x1, 200); g.closePath(); g.fillStyle = '#7a5a3c'; g.fill();
    for (const [a, b, c] of grains) { const y = lerp(surf(a) + 3, 198, b); g.fillStyle = c < .5 ? '#5d4129' : '#9a7650'; g.fillRect(X(a), y, 2.2, 2.2); }
    g.fillStyle = '#1f3345'; g.font = '900 13px sans-serif'; g.textAlign = 'left'; g.fillText(st.s ? '坡度陡' : '坡度平緩', 150, st.s ? 70 : 100); g.fillText('接泥沙的盤子', 268, 224);
    // 澆水器
    const cx = x0 - 6, cy = y0 - 46; g.fillStyle = '#64748b'; g.fillRect(cx - 14, cy - 8, 26, 20); g.strokeStyle = '#64748b'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + 10, cy + 6); g.lineTo(cx + 30, cy - 6); g.stroke();
    if (run && k < .86) {
      g.fillStyle = 'rgba(59,130,246,.85)'; const n = st.w ? 10 : 4; for (let i = 0; i < n; i++) { const yy = cy - 4 + ((t * 2.2 + i / n) % 1) * (y0 - cy + 4); g.beginPath(); g.arc(cx + 30 + (i % 3) * 5, yy, 2.4, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(59,130,246,.8)'; g.lineWidth = st.w ? 5.5 : 2.6; g.setLineDash([11, 7]); g.lineDashOffset = -t * (st.s ? 250 : 105); g.beginPath(); for (let u = .04; u <= 1.001; u += .02) g.lineTo(X(u), surf(u) - 2); g.stroke(); g.setLineDash([]);
    }
    let arrived = run && run.done ? run.parts.length : 0;
    if (run && !run.done) for (const p of run.parts) { const u = p.u0 + Math.max(0, t - p.t) * (st.s ? .55 : .26) * p.v; if (u >= 1) { arrived++; continue; } if (t < p.t) continue; g.fillStyle = '#4a321e'; g.beginPath(); g.arc(X(u), surf(u) - 3, 2.6, 0, 7); g.fill(); }
    if (arrived) { const h = 1.05 * arrived; g.fillStyle = '#6b4a2c'; g.beginPath(); g.moveTo(290, 200); g.quadraticCurveTo(322, 200 - h * 2, 354, 200); g.closePath(); g.fill(); }
  };
  const tick = now => {
    const t = (now - t0) / 1000; draw(t);
    if (t >= T) {
      const key = '' + st.s + st.w, amt = AMT[st.s][st.w]; run.done = true; draw(T); tried[key] = 1; el.querySelector(`[data-c="${key}"]`).textContent = '▮'.repeat(amt) + ' ' + amt + ' 份';
      const n = Object.keys(tried).length; G.$('#slT').textContent = `坡度${st.s ? '陡' : '平緩'}、水量${st.w ? '多' : '少'}：沖下來 ${amt} 份泥沙` + (n < 3 ? `（再試 ${3 - n} 種組合）` : '');
      el.querySelectorAll('.rsel button, #slGo').forEach(b => b.disabled = false); if (n >= 3 && !told) { told = true; done(); } return;
    }
    raf = requestAnimationFrame(tick);
  };
  el.querySelectorAll('.rsel button').forEach(b => b.onclick = () => { st[b.dataset.k] = +b.dataset.v; el.querySelectorAll(`.rsel [data-k="${b.dataset.k}"]`).forEach(o => o.classList.toggle('on', o === b)); run = null; draw(0); G.$('#slT').textContent = '按「開始淋水」看看結果'; });
  G.$('#slGo').onclick = () => {
    const amt = AMT[st.s][st.w]; run = { parts: Array.from({ length: amt * 8 }, () => ({ u0: .1 + r() * .65, t: .4 + r() * 2, v: .9 + r() * .3 })) };
    el.querySelectorAll('.rsel button, #slGo').forEach(b => b.disabled = true); G.$('#slT').textContent = '淋水中……注意水流的快慢和被帶走的泥沙'; t0 = performance.now(); raf = requestAnimationFrame(tick);
  };
  draw(0);
  return () => cancelAnimationFrame(raf);
}

/* ---------- 探究的觀察活動：彎道兩岸的流速，以及曲流怎麼變成牛軛湖（模擬） ---------- */
function observeBend(el, done) {
  el.innerHTML = `<div class="sim" style="grid-template-columns:1fr"><figure><figcaption>從空中往下看一條彎彎的河<small>河水由左邊流向右邊</small></figcaption>
      <canvas width="360" height="270" id="bdC" style="aspect-ratio:4/3;max-width:460px;background:#a7d37f"></canvas><div class="res" id="bdT">先放樹葉，比比看靠哪一岸的水流得快</div></figure></div>
    <div class="row"><button class="cta" id="bdLeaf">🍃 放樹葉</button><button class="cta ghost" id="bdFast" disabled>⏩ 快轉很多年</button></div>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0">這是把很長的時間縮短的模擬動畫。</p>`;
  const g = G.$('#bdC').getContext('2d'), W = 360, Hh = 270, N = 160, LAM = 120, RW = 16, OM0 = 1.3, MID = 80;
  // 中間那個彎最明顯，頭尾兩段只有一點點彎
  const path = om => { const p = []; let x = 0, y = 0, ya = 1e9, yb = -1e9;
    for (let i = 0; i <= N; i++) { const a = 6.2832 * ((i - MID) / LAM + 1), m = .25 + .75 * Math.exp(-(((i - MID) / 55) ** 2)), th = -om * m * Math.sin(a); p.push([x, y, th, -Math.cos(a)]); ya = Math.min(ya, y); yb = Math.max(yb, y); x += Math.cos(th); y += Math.sin(th); }
    const k = 300 / p[N][0], oy = Hh / 2 - (ya + yb) / 2 * k; return p.map(q => ({ x: 30 + q[0] * k, y: oy + q[1] * k, tx: Math.cos(q[2]), ty: Math.sin(q[2]), nx: -Math.sin(q[2]), ny: Math.cos(q[2]), c: q[3] })); };
  const neck = p => { let b = 20, bd = 1e9; for (let d = 20; d <= 48; d++) { const q = Math.hypot(p[MID - d].x - p[MID + d].x, p[MID - d].y - p[MID + d].y); if (q < bd) { bd = q; b = d; } } return [bd, b]; };
  const pen = (color, w) => { g.strokeStyle = color; g.lineWidth = w; g.lineJoin = g.lineCap = 'round'; };
  const line = (p, a, b, off, color, w) => { pen(color, w); g.beginPath(); for (let i = a; i <= b; i++) g.lineTo(p[i].x + p[i].nx * off(p[i]), p[i].y + p[i].ny * off(p[i])); g.stroke(); };
  const text = (s, x, y, c = '#1f3345') => { g.font = '900 13px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3.5; g.strokeStyle = '#fff'; g.strokeText(s, x, y); g.fillStyle = c; g.fillText(s, x, y); };
  const bendOf = q => Math.abs(q.c) > .5;
  let om = OM0, pts = path(om), leaves = null, cut = null, marks = 0, raf = 0, last = 0, mode = '', told = false;
  const draw = () => {
    g.fillStyle = '#a7d37f'; g.fillRect(0, 0, W, Hh);
    if (cut) {
      const A = pts[cut[0] - 9], B = pts[cut[1] + 9], L = Math.hypot(B.x - A.x, B.y - A.y) * .4;
      line(pts, cut[0] + 8, cut[1] - 8, () => 0, '#3f8f8c', RW * .85);                                             // 牛軛湖
      pen('#4fa3d6', RW); g.beginPath(); for (let i = 0; i <= cut[0] - 9; i++) g.lineTo(pts[i].x, pts[i].y);
      g.bezierCurveTo(A.x + A.tx * L, A.y + A.ty * L, B.x - B.tx * L, B.y - B.ty * L, B.x, B.y); for (let i = cut[1] + 9; i <= N; i++) g.lineTo(pts[i].x, pts[i].y); g.stroke();   // 新河道：平順地接起來
      const far = pts[MID], up = far.y < A.y; text('牛軛湖', far.x, far.y + (up ? -14 : 24), '#0f5c58'); text('新河道', (A.x + B.x) / 2, (A.y + B.y) / 2 + (up ? 26 : -16));
      return;
    }
    line(pts, 0, N, () => 0, '#4fa3d6', RW);
    if (marks > 0) { g.globalAlpha = marks;        // 中間彎道的凹岸（紅）與凸岸（黃）：各畫成一條連續的帶子
      let a = MID; while (a > 0 && bendOf(pts[a - 1])) a--; let b = MID; while (b < N && bendOf(pts[b + 1])) b++;
      line(pts, a, b, q => -Math.sign(q.c) * (RW / 2 + 1.5), '#dc2626', 3.4); line(pts, a, b, q => Math.sign(q.c) * (RW / 2 - 1.5), '#f2d675', 5); g.globalAlpha = 1; }
    if (mode !== 'fast') { const q = pts[MID], s = Math.sign(q.c); text('凹岸', q.x - q.nx * s * 28, q.y - q.ny * s * 28 + 5, '#b91c1c'); text('凸岸', q.x + q.nx * s * 26, q.y + q.ny * s * 26 + 5, '#7a5a14'); }
    if (leaves) for (const L of leaves) { const i = Math.min(N - 1, L.i | 0), f = L.i - i, a = pts[i], b = pts[i + 1], x = lerp(a.x, b.x, f) + a.nx * L.u * RW * .4, y = lerp(a.y, b.y, f) + a.ny * L.u * RW * .4;
      g.fillStyle = '#facc15'; g.strokeStyle = '#713f12'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, 4.2, 2.6, .5, 0, 7); g.fill(); g.stroke(); }
    if (mode === 'leaf') { const a = pts[MID + 30]; g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(a.x - a.nx * 13, a.y - a.ny * 13); g.lineTo(a.x + a.nx * 13, a.y + a.ny * 13); g.stroke(); g.setLineDash([]); }
  };
  const tick = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (mode === 'leaf') {
      let all = true; for (const L of leaves) { const q = pts[Math.min(N, L.i | 0)]; if (L.i < MID + 30) { L.i += 24 * (1 + .55 * -L.u * Math.sign(q.c)) * dt; all = false; } }
      draw();
      if (all) { mode = ''; G.$('#bdT').textContent = '靠凹岸（彎道外側）的樹葉最先到終點，靠凸岸（內側）的最慢'; G.$('#bdLeaf').disabled = false; G.$('#bdLeaf').textContent = '↻ 再放一次'; G.$('#bdFast').disabled = false; G.$('#bdFast').classList.remove('ghost'); return; }
    } else if (mode === 'fast') {
      om += .15 * dt; marks = Math.min(1, marks + dt * 2); pts = path(om); const [gap, d] = neck(pts);
      if (gap < RW * 1.25 || om > 2.7) { cut = [MID - d, MID + d]; draw(); mode = ''; G.$('#bdLeaf').disabled = false; G.$('#bdT').textContent = '曲流頸被切穿了！河水改走新河道，舊河道變成牛軛湖'; G.$('#bdFast').disabled = false; G.$('#bdFast').textContent = '↻ 再看一次'; if (!told) { told = true; done(); } return; }
      draw();
    }
    raf = requestAnimationFrame(tick);
  };
  const reset = () => { cancelAnimationFrame(raf); om = OM0; pts = path(om); cut = null; marks = 0; leaves = null; };
  G.$('#bdLeaf').onclick = () => { reset(); leaves = [-.85, -.42, 0, .42, .85].map(u => ({ u, i: MID - 30 })); mode = 'leaf'; G.$('#bdLeaf').disabled = true; G.$('#bdT').textContent = '五片樹葉同時出發，看誰先到白色虛線……'; last = performance.now(); raf = requestAnimationFrame(tick); };
  G.$('#bdFast').onclick = () => { reset(); mode = 'fast'; G.$('#bdFast').disabled = true; G.$('#bdLeaf').disabled = true; G.$('#bdT').textContent = '時間快轉中……凹岸被侵蝕（紅），凸岸泥沙堆積（黃），河道越來越彎'; last = performance.now(); raf = requestAnimationFrame(tick); };
  draw();
  return () => cancelAnimationFrame(raf);
}

/* ---------- 區域定義 ---------- */
const card = (name, en, kind, facts) => ({ name, en, photo: 'img/river/' + kind + '.jpg', svg: rSVG(kind), facts });
const fig = kind => `<div class="rfig">${rSVG(kind)}</div>`;
const xsRow = `<div class="rxs"><div>${xsSVG(1)}上游<small>又窄又深</small></div><div>${xsSVG(2)}中游<small>變寬、稍淺</small></div><div>${xsSVG(3)}下游<small>更寬、更淺</small></div></div>`;
const riverOverview = { label: '總覽', html: `<h2>上游、中游、下游比一比</h2>
  <table class="rtab big"><tr><th></th><th>上游</th><th>中游</th><th>下游</th></tr>
  <tr><th>樣子</th><td>${rSVG('upper')}</td><td>${rSVG('middle')}</td><td>${rSVG('lower')}</td></tr>
  <tr class="xs"><th>河谷橫切面</th><td>${xsSVG(1)}</td><td>${xsSVG(2)}</td><td>${xsSVG(3)}</td></tr>
  <tr><th>河谷與河道</th><td>地勢陡峭，又窄又深</td><td>坡度漸緩，變寬、稍淺</td><td>地勢平坦，更寬、更淺</td></tr>
  <tr><th>水流</th><td>湍急</td><td>速度變慢</td><td>緩慢</td></tr>
  <tr><th>河床上</th><td>形狀不規則的大石頭</td><td>圓圓的鵝卵石</td><td>泥沙和小石頭</td></tr>
  <tr><th>主要作用</th><td>侵蝕為主（向下侵蝕）</td><td>搬運明顯，向側侵蝕</td><td>堆積為主</td></tr>
  <tr><th>常見地形</th><td>V 型谷、瀑布、峽谷、壺穴</td><td>曲流、鵝卵石灘、河階<small>（延伸）</small></td><td>曲流、牛軛湖、三角洲、沙洲</td></tr></table>` };

G.registerZone('river', {
  hint: '這條河從高山一路流到大海。點發光的圓點，看看河流怎麼改變大地！',
  build,
  nodes: [
    { id: 'flow', num: '1', title: '流量、流速與坡度', en: 'Flow & Slope', color: '#0891b2', ready: true, at: P(-7.3, -.5, 1.5),
      cam: { pos: [-4.4, 6.4, 8.6], target: [-5.2, 1.9, -.6] },
      learn: `
        <h3>流量和流速</h3>
        <p><em>流量</em>是河水的多寡，<em>流速</em>是河水流動的快慢。流量越大、流速越快，流水的力量就越大。</p>
        <h3>坡度會影響流速</h3>
        <p>河床越陡，水往下衝得越快；河床越平緩，水流得越慢。所以坡度陡的上游水流湍急，平緩的下游水流緩慢。</p>
        <h3>力量越大，帶走越多</h3>
        <div class="two"><div><b>🌧️ 水多或流得快</b>侵蝕和搬運的能力強，能沖走大量泥沙，甚至推動大石頭。</div><div><b>☀️ 水少或流得慢</b>侵蝕和搬運的能力弱，泥沙容易堆積下來。</div></div>
        <p>颱風或豪雨時，河水暴漲、流速變快，會帶走大量泥沙，所以河水常變得又黃又濁。</p>
        <div class="tip"><b>看看模型：</b>瀑布和上游河段的白色水花跑得很快；流到平緩的地方，水花就慢了下來。</div>
        <p>坡度和水量真的會影響被沖走的泥沙多寡嗎？先預測，再用土堆淋水的實驗找答案。</p>`,
      poe: {
        question: '兩個一樣的土堆，一個坡度陡、一個坡度平緩，淋上一樣多的水。哪一個土堆被沖走的泥沙比較多？',
        options: ['坡度陡的，被沖走的泥沙比較多', '坡度平緩的，被沖走的泥沙比較多', '一樣多，坡度沒有影響'],
        observeIntro: '選好<b>坡度</b>和<b>水量</b>，再按「開始淋水」。至少完成三種組合，比較盤子裡接到的泥沙。',
        observe: observeSlope,
        explain: {
          q: '根據實驗結果，哪一個說法最能解釋你看到的現象？',
          opts: ['坡度越陡、水量越多，水流越快、力量越大，沖走的泥沙就越多。', '坡度陡的土堆泥沙比較鬆，所以才被沖走比較多。', '水量越多，泥沙吸飽水變重，所以沖走的泥沙越少。'],
          ans: 0,
          hint: '回想結果表：水量相同時，陡坡和緩坡差在哪裡？坡度相同時，水多和水少又差在哪裡？關鍵是水流的「快慢」和「多寡」。',
          why: '坡度越陡，水流得越快；水量越多，水流的力量越大。流水的侵蝕和搬運能力變強，沖走的泥沙就越多。河流上游坡度陡，所以侵蝕特別旺盛。'
        }
      } },
    { id: 'work', num: '2', title: '侵蝕、搬運、堆積', en: 'Erosion · Transport · Deposition', color: '#2563eb', ready: true, at: [POT.x, POT.y + 1.0, POT.z],
      cam: { pos: [POT.x + 1.3, POT.y + 2.6, POT.z + 3.4], target: [POT.x + .9, POT.y + .1, POT.z] },
      learn: `
        <h3>流水有三種本領</h3>
        <p>雨水匯集成河流，從高處往低處流。流動的水會慢慢改變地表的樣子，靠的是<em>侵蝕</em>、<em>搬運</em>、<em>堆積</em>三種作用。</p>
        <div class="two"><div><b>⛏️ 侵蝕</b>水流把河床、河岸的岩石和泥沙沖刷、挖走。</div><div><b>🚚 搬運</b>水流帶著石頭和泥沙往下游移動。</div></div>
        <div class="two"><div><b>🏝️ 堆積</b>水流變慢，帶不動的石頭和泥沙停下來。</div><div><b>🔁 同時進行</b>三種作用一起發生，只是每一段河的強弱不同。</div></div>
        <h3>水流快慢是關鍵</h3>
        <p>水流得越快，力量越大，侵蝕和搬運的能力就越強；水流慢下來，力量變小，石頭和泥沙就會堆積。</p>
        <p>比較重的大石頭最先停下來，細小的泥沙可以被帶到很遠的地方。</p>
        <h3>侵蝕有三個方向</h3>
        <div class="two"><div><b>⬇️ 向下侵蝕</b>水流往河床下方挖，河谷越切越深。上游最明顯。</div><div><b>↔️ 向側侵蝕</b>水流沖刷兩側河岸，河谷越來越寬。中、下游最明顯。</div></div>
        <div class="two"><div><b>⬆️ 向源侵蝕</b>源頭和瀑布的岩石不斷崩落，河流往上游延長。</div><div><b>🧭 接下來</b>到節點 3、4、5，看三段河各自以哪一種作用為主。</div></div>
        <h3>水蝕的小地形：壺穴</h3>
        <p>河床的岩石上如果有小凹洞，水流會帶著小石頭在洞裡不停打轉，把凹洞越磨越深、越磨越圓，形成<em>壺穴</em>。</p>
        <div class="tip"><b>看看模型：</b>河床上有一塊貼著水面的岩盤，上面有幾個積水的圓洞。水流正帶著小石頭在最大的洞裡繞圈。</div>
        <div class="tip"><b>和風化的關係：</b>岩石先被風化變碎（第 5a 區），碎屑再被流水帶走。風化是靜態的，侵蝕、搬運、堆積是動態的。</div>`,
      cardsIntro: '<p>三種作用各留下什麼痕跡？下面三張都是繪圖，一種作用一張。</p>',
      cards: [
        card('壺穴', 'Pothole', 'pothole', [['流水的作用', '侵蝕。'], ['在哪裡', '河床的岩石上，平常泡在水裡或被水流沖刷。'], ['怎麼形成', '水流帶著小石頭在凹洞裡打轉，把凹洞磨深、磨圓。'], ['特徵', '洞口圓圓的，洞壁光滑，洞底常留著磨圓的小石頭。'], ['臺灣哪裡看', '基隆河的河床：基隆市暖暖、新北市平溪大華。']]),
        card('越滾越圓的石頭', 'Rounded stones', 'round', [['流水的作用', '搬運。'], ['怎麼改變', '石頭被水帶著滾動，一路互相碰撞、摩擦，稜角慢慢被磨掉。'], ['觀察重點', '越往下游，石頭越小、越圓、越光滑。']]),
        card('河裡的沙洲', 'River bar', 'bar', [['流水的作用', '堆積。'], ['怎麼形成', '河道變寬、坡度變緩或轉彎內側的地方水流變慢，石頭和泥沙就停下來。'], ['特徵', '大的石頭先停下，細小的泥沙被帶得比較遠。']]),
      ] },
    { id: 'upper', num: '3', title: '上游', en: 'Upper Course', color: '#7c3aed', ready: true, at: P(-10.7, -1.9, 1.7),
      cam: { pos: [-4.4, 6.8, 7.2], target: [-7.6, 2.5, -1.2] },
      learn: `
        <h3>上游的樣子</h3>
        <p>地勢陡峭、河道狹窄、水流湍急。流水的力量很大，以<em>侵蝕</em>為主，也把石頭往下游搬運。</p>
        <h3>V 型谷</h3>
        <p>上游的河水主要<em>向下侵蝕</em>，把河谷切得又深又窄；兩岸的岩石崩落成斜坡，橫切面像英文字母 V，叫做<em>V 型谷</em>。</p>
        ${fig('vvalley')}
        <h3>瀑布和向源侵蝕</h3>
        <p>河床遇到堅硬的岩層，高度突然下降，就形成<em>瀑布</em>。下方較軟的岩層被沖空後，上方的岩層崩落，瀑布會慢慢往上游後退。</p>
        <p>河流的源頭也一樣不斷崩落，讓河流往上游延長，這就是<em>向源侵蝕</em>。</p>
        <h3>河床上的大石頭</h3>
        <p>兩岸崩落的岩石掉進河裡，還沒有被搬運多遠，所以上游的石頭又大、形狀又不規則。</p>
        <div class="tip"><b>看看模型：</b>把模型轉到左邊的側面，可以看到山被河流切出一個 V 字。再找找瀑布、支流和河裡的大石頭。</div>
        <details class="rext"><summary>延伸：冰河切出來的 U 型谷</summary>
          <p>在很寒冷的高山，厚重的冰河緩慢往下滑動，把谷底和兩側一起刮寬，形成谷底寬平、谷壁陡直的<em>U 型谷</em>。</p>
          ${fig('uvalley')}
          <p>V 型谷是河流切的，谷底窄；U 型谷是冰河刮的，谷底寬。世界著名的例子有美國優勝美地谷、挪威的峽灣。</p></details>`,
      cardsIntro: '<p>上游常見的景觀。三張都是繪圖。</p>',
      cards: [
        card('上游的景觀', 'Upper course', 'upper', [['地勢與河道', '地勢陡峭，河道又窄又深。'], ['水流', '湍急。'], ['河床上', '形狀不規則的大石頭。'], ['主要作用', '侵蝕為主（向下侵蝕），也有搬運。'], ['臺灣哪裡看', '花蓮縣立霧溪的太魯閣峽谷。']]),
        card('V 型谷', 'V-shaped valley', 'vvalley', [['怎麼形成', '河水向下侵蝕，把河谷越切越深。'], ['特徵', '河谷又深又窄，兩岸陡峭，橫切面像 V 字。'], ['峽谷', '兩岸特別陡、特別深的 V 型谷，例如太魯閣峽谷：立霧溪切穿堅硬的大理岩。']]),
        card('瀑布', 'Waterfall', 'waterfall', [['怎麼形成', '河床的高度突然下降，河水直接往下衝。'], ['特徵', '下方較軟的岩層被沖出深潭，上方的岩層失去支撐後崩落。'], ['會移動嗎', '會。岩層不斷崩落，瀑布慢慢往上游後退，這就是向源侵蝕。'], ['臺灣哪裡看', '新北市平溪的十分瀑布。']]),
      ] },
    { id: 'middle', num: '4', title: '中游', en: 'Middle Course', color: '#15803d', ready: true, at: P(-3.7, 3.0, 1.5),
      cam: { pos: [-2.0, 7.2, 9.4], target: [-2.5, .9, -.4] },
      learn: `
        <h3>中游的樣子</h3>
        <p>地勢漸漸變緩、河道變寬，水流速度變慢。<em>搬運</em>作用明顯，有侵蝕也有堆積；河床上堆著許多圓圓的<em>鵝卵石</em>。</p>
        <h3>河道開始彎曲</h3>
        <p>坡度變緩後，向下侵蝕減弱，河水改以<em>向側侵蝕</em>為主，沖刷兩岸。河道越來越彎，彎曲的河段叫做<em>曲流</em>。</p>
        <h3>凹岸和凸岸</h3>
        <div class="two"><div><b>🔴 凹岸</b>彎道的外側。水流較急，<em>侵蝕作用強</em>，河岸不斷後退，岸邊又陡又深。</div><div><b>🟡 凸岸</b>彎道的內側。水流較緩，<em>堆積作用強</em>，砂石堆成平緩、凸出的河岸。</div></div>
        ${fig('meander')}
        <p>凹岸一直被挖、凸岸一直堆，久而久之，河道就越來越彎。</p>
        <h3>哪一岸適合蓋房子？</h3>
        <div class="two"><div><b>⚠️ 凹岸：風險高</b>河岸不斷被掏空、後退，緊鄰的房屋和道路可能塌陷，不適合建設。</div><div><b>🌾 凸岸：會淹水</b>土地不易被沖走，還會慢慢增加；但地勢低，大水時容易淹沒。</div></div>
        ${fig('bankuse')}
        <p>凸岸的河灘地適合當農田或公園，不適合蓋房子。不論哪一岸，颱風豪雨時都要遠離河邊。</p>
        <h3>河川整治工程</h3>
        <p>為了保護河岸和河床，人們會在河流上做工程，用不同的方法減弱流水的侵蝕。</p>
        <dl class="rterm"><dt>護岸</dt><dd>在河岸鋪上石塊或混凝土，擋住水流的沖刷，最常做在凹岸。</dd>
          <dt>丁壩</dt><dd>從岸邊伸進河裡的短堤，把急流推向河中央，讓岸邊的水流變慢。</dd>
          <dt>固床工</dt><dd>橫跨河床的一階階矮壩，把陡坡變成階梯，減慢流速，防止河床越挖越深。</dd></dl>
        ${fig('sill')}
        <div class="tip"><b>工程也有代價：</b>河岸水泥化、落差太高，會讓魚蝦難以棲息和洄游，也改變原來的景觀。所以現在常改用石塊堆砌等接近自然的做法。</div>
        <div class="tip"><b>看看模型：</b>紅色標出凹岸，黃色標出凸岸。彎道外側鋪了石塊護岸，上游一點的河床上有三道固床工。</div>
        <details class="rext"><summary>延伸：河階是怎麼來的？</summary>
          <p>河流如果再一次向下侵蝕（例如地面慢慢抬升），河床就會變低，原來的河床和河灘被留在高處，成為階梯狀的平臺，叫做<em>河階</em>。</p>
          ${fig('terrace')}
          <p>越高的河階形成得越早。河階地面平坦，又不容易淹水，常成為農田和聚落，例如桃園市大溪（大漢溪旁）。模型中游河谷兩側也有兩階河階。</p></details>
        <p>彎道的哪一岸會被侵蝕？先預測，再放樹葉比流速、快轉時間看河道的變化。</p>`,
      cardsIntro: '<p>中游常見的景觀，以及保護河岸、河床的三種工程。都是繪圖。</p>',
      cards: [
        card('中游的景觀', 'Middle course', 'middle', [['地勢與河道', '坡度漸緩，河道變寬、稍淺，開始彎曲。'], ['水流', '速度變慢。'], ['河床上', '圓圓的鵝卵石。'], ['主要作用', '搬運明顯，向側侵蝕，有侵蝕也有堆積。'], ['臺灣哪裡看', '桃園市大漢溪的中游河段。']]),
        card('曲流', 'Meander', 'meander', [['是什麼', '河道彎曲的河段，常出現在地勢平緩的中、下游。'], ['凹岸', '彎道外側，流速快，侵蝕作用強，岸邊較陡。'], ['凸岸', '彎道內側，流速慢，堆積作用強，形成平緩的沙洲。'], ['臺灣哪裡看', '花蓮縣秀姑巒溪、新北市新店溪。']]),
        card('護岸', 'Revetment', 'revet', [['做法', '在河岸鋪上石塊、混凝土或裝滿石頭的鐵絲籠。'], ['原理', '用堅硬的材料擋住水流，河岸的泥土就不會被沖走。'], ['常做在', '侵蝕作用強的凹岸。'], ['缺點', '水泥化的河岸不利生物棲息，也改變自然景觀。']]),
        card('丁壩', 'Groyne', 'groin', [['做法', '從岸邊向河中央伸出一道道短堤。'], ['原理', '把急流推離河岸，丁壩之間的水流變慢，泥沙還會慢慢淤積。'], ['常做在', '需要保護的凹岸前方。']]),
        card('固床工', 'Groundsill', 'sill', [['做法', '在河床上做一道道橫跨河道的矮壩。'], ['原理', '把陡坡變成一階一階，減慢流速，防止河床被向下侵蝕。'], ['常做在', '坡度陡、河床容易被掏深的河段。'], ['缺點', '落差太高時，魚類不容易往上游洄游，需要另外做魚道。']]),
      ],
      poe: {
        question: '河流轉彎的地方，哪一側的河岸比較容易被水流侵蝕？',
        options: ['凹岸（彎道的外側）', '凸岸（彎道的內側）', '兩岸一樣，轉彎不會造成差別'],
        observeIntro: '先按「放樹葉」，比較靠兩岸的樹葉誰漂得快；再按「快轉很多年」，看中間這個彎道怎麼改變。',
        observe: observeBend,
        explain: {
          q: '根據剛才的觀察，為什麼曲流會越來越彎？',
          opts: ['凹岸流速快，侵蝕作用強，河岸後退；凸岸流速慢，堆積作用強，所以河道越來越彎。', '凸岸流速快，侵蝕作用強，河岸後退；凹岸流速慢，堆積作用強，所以河道越來越彎。', '兩岸的流速一樣，河道是被風慢慢吹彎的。'],
          ans: 0,
          hint: '回想樹葉比賽：靠哪一岸的樹葉漂得最快？流速快的地方，侵蝕的力量比較強還是比較弱？',
          why: '彎道外側的凹岸流速快，侵蝕作用強，河岸不斷後退；內側的凸岸流速慢，堆積作用強。一邊挖、一邊堆，曲流越來越彎，最後被截斷，留下牛軛湖。牛軛湖在下游最常見，到節點 5 看看。'
        }
      } },
    { id: 'lower', num: '5', title: '下游', en: 'Lower Course', color: '#c2410c', ready: true, at: P(3.4, -.9, 1.5),
      cam: { pos: [9.6, 14, 14.5], target: [9.4, .1, -.4] },
      learn: `
        <h3>下游的樣子</h3>
        <p>地勢平坦、河道又寬又淺、水流緩慢。流水的搬運能力變小，以<em>堆積</em>為主，河床和兩岸堆積很多泥沙。</p>
        <h3>更彎的曲流和牛軛湖</h3>
        <p>下游的河流在平原上左右擺動，曲流越來越彎。彎道最窄的地方（曲流頸）最後會被切穿，河水改走比較直的新河道。</p>
        <p>被留下的舊河道兩端慢慢淤塞，變成彎月形的湖，形狀像套在牛脖子上的「牛軛」，所以叫做<em>牛軛湖</em>。牛軛湖在下游的平原最常見。</p>
        ${fig('oxbow')}
        <h3>出海口：三角洲和沙洲</h3>
        <p>河水流進大海時被海水擋住，流速變得很慢，一路帶來的泥沙就在<em>出海口</em>大量沉積。</p>
        <div class="two"><div><b>🔺 三角洲</b>泥沙在河口堆成一大片淺灘和新的陸地，形狀常像三角形或扇子。</div><div><b>🏝️ 沙洲</b>泥沙堆成一座座圓滑的沙地，會隨水流和海浪改變形狀。</div></div>
        <p>河水在三角洲上常分成好幾條<em>分流</em>，從沙洲之間入海。三角洲地勢平坦、土壤肥沃，常成為農田和聚落。</p>
        <div class="tip"><b>看看模型：</b>找找新河道旁彎月形的牛軛湖。河面上褐色的小點是泥沙，它們漂到出海口後，堆成了淺灘和沙洲。</div>
        <div class="tip"><b>接下來：</b>河流帶來的泥沙，也是海邊沙灘的來源。到第 5c 區「風與海浪的雕刻」看看海岸的故事。</div>`,
      cardsIntro: '<p>下游常見的景觀，都是繪圖。後三張是從空中往下看的樣子。</p>',
      cards: [
        card('下游的景觀', 'Lower course', 'lower', [['地勢與河道', '地勢平坦，河道又寬又淺、彎彎曲曲。'], ['水流', '緩慢。'], ['河床上', '泥沙和小石頭。'], ['主要作用', '堆積為主。'], ['臺灣哪裡看', '臺北市、新北市的淡水河下游。']]),
        card('牛軛湖', 'Oxbow lake', 'oxbow', [['是什麼', '曲流被截斷後，留下來的彎月形湖泊。'], ['怎麼形成', '曲流頸被切穿，河水改走新河道，舊河道兩端淤塞。'], ['名字的由來', '形狀像套在牛脖子上拉車的「牛軛」。'], ['臺灣哪裡看', '臺北市景美一帶的舊河道。']]),
        card('三角洲', 'Delta', 'delta', [['是什麼', '河流帶來的泥沙在河口堆積成的淺灘和陸地。'], ['怎麼形成', '河水入海後流速變慢，泥沙沉積，越堆越多、露出水面。'], ['特徵', '地勢低平，有許多沙洲，河水常分成好幾條分流。'], ['臺灣哪裡看', '濁水溪出海口（彰化縣、雲林縣交界）、宜蘭縣蘭陽溪口。'], ['世界景點', '埃及尼羅河三角洲。']]),
        card('河口的沙洲', 'Sandbar', 'sandbar', [['是什麼', '泥沙在河口或岸邊堆成的沙地。'], ['怎麼形成', '河流帶來泥沙，再被海浪和海流推送、堆積。'], ['特徵', '形狀和位置會隨季節、颱風而改變。'], ['臺灣哪裡看', '新北市福隆：雙溪出海口的沙洲。']]),
      ] },
    { id: 'overview', num: '6', title: '河川特徵總覽', en: 'River Overview', color: '#a16207', ready: true, at: P(.4, -5.6, 2),
      cam: { pos: [4.5, 12.5, 27], target: [4.5, .4, 0] },
      learn: `
        <h3>同一條河，三種面貌</h3>
        <p>河流從山上流到海，沿途的坡度和流速一直在改變，所以上游、中游、下游的河谷、石頭和地形都不一樣。</p>
        <h3>把河谷切開來看</h3>
        ${xsRow}
        <p>上游的河谷又窄又深，像 V 字；中游的河谷變寬、稍淺；下游的河谷更寬、更淺，河水幾乎和平原一樣高。</p>
        <h3>三段河的重點</h3>
        <dl class="rterm"><dt>上游</dt><dd>侵蝕為主（向下侵蝕）：V 型谷、瀑布、大石頭。</dd>
          <dt>中游</dt><dd>搬運明顯、向側侵蝕：曲流開始出現，河床多鵝卵石。</dd>
          <dt>下游</dt><dd>堆積為主：曲流、牛軛湖，出海口有三角洲和沙洲。</dd></dl>
        <h3>石頭為什麼越來越小、越來越圓？</h3>
        <p>石頭被流水搬運時一路滾動、互相碰撞，稜角被磨掉，也越磨越小。看石頭的樣子，就能猜出它在哪一段河。</p>
        <div class="tip"><b>比一比：</b>按上方的「總覽」，用一張大表比較上游、中游、下游。再轉動模型，找出三段河的寬度、深度和石頭有什麼不同。</div>`,
      overview: riverOverview },
  ],
  // 檢核題：level 為 PIRLS 層次（1 提取訊息／2 推論訊息／3 詮釋整合／4 比較評估）
  quiz: [
    { id: 'river.upper.1', about: '上游', level: 1, q: '根據「上游」的認識，下面哪一項是河流上游的特徵？',
      opts: ['地勢陡峭、河道狹窄、水流湍急，有很多大石頭', '地勢平坦、河道寬廣、水流緩慢，堆積很多泥沙', '河道寬闊彎曲，河床上都是圓圓的鵝卵石', '河水分成好幾條分流，流進大海'], ans: 0, why: '說明中提到：上游地勢陡峭、河道狹窄、水流湍急，河床上的石頭又大、形狀又不規則。' },
    { id: 'river.middle.1', about: '中游', level: 2, q: '小安家想在河流大轉彎的地方蓋房子。根據「中游」的認識和探究，緊鄰哪一側的河岸最危險？',
      opts: ['彎道外側的凹岸，因為流速快、侵蝕作用強，河岸會被掏空後退', '彎道內側的凸岸，因為流速慢，河岸會被掏空後退', '兩岸一樣，因為同一條河的流速到處都相同', '都很安全，因為泥沙會平均堆積在兩岸'], ans: 0, why: '探究中看到：靠凹岸的樹葉漂得最快。流速快的凹岸侵蝕作用強，河岸會不斷後退；凸岸雖然堆積泥沙，但地勢低，大水時也會淹沒。' },
    { id: 'river.work.1', about: '侵蝕、搬運、堆積', level: 2, q: '小美在河邊撿到一顆又圓又光滑的鵝卵石。根據「侵蝕、搬運、堆積」的圖鑑，可以推論這顆石頭經歷過什麼？',
      opts: ['剛從山壁崩落下來，還沒有被水搬運過', '被流水搬運了一段路，一路碰撞、摩擦，稜角被磨掉了', '在海底由泥沙堆積、壓緊而成', '被岩漿熔化後，重新凝固成圓形'], ans: 1, why: '圖鑑提到：石頭被水帶著滾動，互相碰撞、摩擦，稜角慢慢被磨掉。又圓又光滑，表示它已經被搬運了一段路。' },
    { id: 'river.lower.1', about: '下游', level: 3, q: '把「流量、流速與坡度」和「下游」的說明放在一起想：為什麼三角洲出現在出海口，而不是出現在上游？',
      opts: ['上游沒有泥沙，出海口的泥沙都是海浪帶來的', '出海口地勢平坦、河水又被海水擋住，流速變慢，搬運能力變弱，泥沙大量堆積', '出海口的水量最少，所以泥沙沉了下來', '上游的水比較冷，泥沙沒辦法沉澱'], ans: 1, why: '流速越慢，搬運能力越弱。出海口地勢平坦，河水又被海水擋住，流速變得很慢，一路帶來的泥沙就在這裡堆積成三角洲。' },
    { id: 'river.upper.2', about: '上游', level: 3, q: '把「流量、流速與坡度」的探究和「上游」的說明放在一起想：為什麼 V 型谷大多出現在河流的上游？',
      opts: ['上游的岩石比較軟，一碰到水就裂開', '上游的河道比較寬，水可以往兩旁流', '上游坡度陡、流速快，向下侵蝕的力量強，把河谷切得又深又窄', '上游的泥沙堆積成兩面斜坡'], ans: 2, why: '探究發現坡度越陡，水流越快、侵蝕力越強。上游坡度陡，河水主要向下侵蝕，就把河谷切成又深又窄的 V 型谷。' },
    { id: 'river.overview.1', about: '河川特徵總覽', level: 4, q: '小明說：「下游的河水比上游多，所以下游河床上的石頭一定比上游大。」根據「流量、流速與坡度」和「河川特徵總覽」的內容，哪一個評論最合理？',
      opts: ['合理，水越多的地方，石頭就越大', '不合理，下游坡度平緩、流速慢，只搬得動細小的泥沙；大石頭留在流速快的上游', '合理，因為石頭在搬運途中會越滾越大', '不合理，因為上游和下游的石頭其實一樣大'], ans: 1, why: '能搬動多大的石頭，要看水流的力量。下游坡度平緩、流速慢，只帶得動細小的泥沙；而且石頭一路碰撞，只會越磨越小，不會變大。' },
  ]
});
})();
