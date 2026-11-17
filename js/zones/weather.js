/* 區域 5a：從岩石到土壤 —— 一片有岩石、樹與草地的山坡，看風化怎麼把岩石變成砂和土壤
   五個節點：風化是什麼、物理性風化、化學性風化、生物性風化、岩石砂土壤；本區挑戰 5 題 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, { ss, fbm, clamp, lerp } = U;

/* ---------- 山坡外形：x∈[-10,10]，z∈[-6,5]；後方較高，前方 z=Z1 切開看土壤剖面 ---------- */
const X0 = -10, X1 = 10, Z0 = -6, Z1 = 5, YB = -3, YT = 3.4;
// 各觀察點的位置（x, z）
const SP = { what: [0, 1], dome: [-5.5, -2.7], ice: [-2.9, -1.1], chem: [4.7, -2.5], lime: [3.8, -2.2], rust: [6.0, -2.8], bio: [-6.3, 1.6], soil: [5.2, 3.5] };
const PADS = [[...SP.what, 2.2], [...SP.dome, 1.9], [...SP.ice, 1.1], [...SP.chem, 2.2], [...SP.bio, 1.4], [...SP.soil, 2.0]];
function baseH(x, z) {
  let h = .3 + 1.75 * ss(1.2, -5.6, z) * (.8 + .2 * Math.sin(x * .4 + 1));
  h += .8 * Math.exp(-((x + 6) ** 2 / 12 + (z + 4) ** 2 / 5));
  h += (fbm(x * .45 + 3, z * .45 + 1, 4) - .45) * .55;
  h -= .2 * ss(2, 4.6, z) * ss(1, 6, x);
  return h;
}
PADS.forEach(p => p.push(baseH(p[0], p[1])));
function height(x, z) {         // 觀察點附近整平成小平臺
  let h = baseH(x, z);
  for (const [cx, cz, r, hc] of PADS) { const d = Math.hypot(x - cx, z - cz); if (d < r) h = lerp(hc, h, ss(r * .5, r, d)); }
  return h;
}
// 剖面各層厚度：表土、底土、碎石層（低處土壤較厚，高處較薄）
const thA = (x, z) => .1 + .2 * ss(1.4, .3, baseH(x, z));
const thB = (x, z) => .15 + .3 * ss(1.4, .3, baseH(x, z));
const thR = (x, z) => .5 + .12 * Math.sin(x * .7 + z * .5);

/* ---------- 小工具：立體雜訊、岩石幾何、平滑法線 ---------- */
const n3 = (x, y, z) => .5 * (U.vnoise(x + z * 1.7, y - z * .9) + U.vnoise(y * 1.3 + 5.2, z + x * .6));
const f3 = (x, y, z) => n3(x, y, z) * .55 + n3(x * 2.1, y * 2.1, z * 2.1) * .3 + n3(x * 4.3, y * 4.3, z * 4.3) * .15;
function smoothGroups(geo) {      // 位置相同的頂點歸成一組，之後共用法線
  const p = geo.attributes.position, map = new Map(), grp = new Int32Array(p.count); let n = 0;
  for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4); let gi = map.get(k); if (gi === undefined) { gi = n++; map.set(k, gi); } grp[i] = gi; }
  return { grp, n };
}
function smoothNormals(geo, S) {
  const p = geo.attributes.position.array, nr = geo.attributes.normal.array, acc = new Float32Array(S.n * 3);
  for (let f = 0; f < p.length; f += 9) {
    const ax = p[f], ay = p[f + 1], az = p[f + 2], bx = p[f + 3] - ax, by = p[f + 4] - ay, bz = p[f + 5] - az, cx = p[f + 6] - ax, cy = p[f + 7] - ay, cz = p[f + 8] - az;
    const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
    for (let k = 0; k < 3; k++) { const gi = S.grp[f / 3 + k] * 3; acc[gi] += nx; acc[gi + 1] += ny; acc[gi + 2] += nz; }
  }
  for (let i = 0; i < S.grp.length; i++) { const gi = S.grp[i] * 3, l = Math.hypot(acc[gi], acc[gi + 1], acc[gi + 2]) || 1; nr[i * 3] = acc[gi] / l; nr[i * 3 + 1] = acc[gi + 1] / l; nr[i * 3 + 2] = acc[gi + 2] / l; }
  geo.attributes.normal.needsUpdate = true;
}
// 圓滾滾的岩石
function rockGeo(sx, sy, sz, seed, rough = .2, det = 7) {
  const g = new THREE.IcosahedronGeometry(1, det), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = 1 + rough * (f3(x * 1.6 + seed, y * 1.6, z * 1.6) - .5) * 2; p.setXYZ(i, x * r * sx, y * r * sy, z * r * sz); }
  smoothNormals(g, smoothGroups(g)); return g;
}
// 方方的岩塊（box 越大越方）
function blockGeo(sx, sy, sz, seed, det = 3, rough = .07, box = .65) {
  const g = new THREE.IcosahedronGeometry(1, det), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)), r = 1 + rough * (f3(x * 1.8 + seed, y * 1.8, z * 1.8) - .5) * 2;
    p.setXYZ(i, lerp(x, x / m, box) * r * sx, lerp(y, y / m, box) * r * sy, lerp(z, z / m, box) * r * sz);
  }
  return g;
}
// 沿著裂縫切成兩半的岩石：side=-1 左半、+1 右半；原點在裂縫底部（轉動時裂縫由上往下張開）
function halfGeo(sx, sy, sz, seed, side) {
  const g = blockGeo(sx, sy, sz, seed, 7, .08, .6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, side < 0 ? Math.min(p.getX(i), 0) : Math.max(p.getX(i), 0));
  g.translate(0, sy * .5, 0); g.computeVertexNormals(); return g;
}
// 球面上的一片殼（洋蔥狀剝落用）：rf(方向)=半徑；k0、k1 為內外半徑倍數（k0=0 只做外表面）
function shellGeo(rf, k0, k1, pa, pb, ta, tb, np, nt) {
  const pos = [], uv = [], idx = [], P = (p, t, k) => { const d = [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)], r = rf(d) * k; return [d[0] * r, d[1] * r, d[2] * r]; };
  const grid = (k, flip) => {
    const b = pos.length / 3;
    for (let j = 0; j <= nt; j++) for (let i = 0; i <= np; i++) { const p = pa + (pb - pa) * i / np, t = ta + (tb - ta) * j / nt; pos.push(...P(p, t, k)); uv.push(p / 1.6, t * 1.4); }
    for (let j = 0; j < nt; j++) for (let i = 0; i < np; i++) { const a = b + j * (np + 1) + i, c = a + np + 1; if (flip) idx.push(a, c, a + 1, a + 1, c, c + 1); else idx.push(a, a + 1, c, a + 1, c + 1, c); }
  };
  grid(k1, false);
  if (k0 > 0) {
    grid(k0, true);
    const edge = pts => { const b = pos.length / 3; pts.forEach(([p, t], i) => { pos.push(...P(p, t, k1), ...P(p, t, k0)); uv.push(i * .1, 0, i * .1, .05); }); for (let i = 0; i < pts.length - 1; i++) { const a = b + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } };
    const L = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
    edge(L(np, u => [pa + (pb - pa) * u, tb])); edge(L(np, u => [pb - (pb - pa) * u, ta])); edge(L(nt, u => [pa, tb - (tb - ta) * u])); edge(L(nt, u => [pb, ta + (tb - ta) * u]));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ---------- 貼圖 ---------- */
function speckTex(base, cols, n, a = 1, b = 2.5, w = 256, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), r = U.rng(n + cols.length);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(r() * w, r() * h, a + r() * b, (a + r() * b) * .8, r() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
// 裂縫貼圖：越早出現的裂縫越亮，配合 alphaTest 由大到小，裂縫會一條條長出來
function crackTex() {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = U.rng(77);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
  const N = 7, SEG = 16;
  for (let k = 0; k < N; k++) {
    let x = 30 + k * 68 + r() * 30, y = 50 + r() * 40, a = Math.PI / 2 + (r() - .5) * .8;
    for (let s = 0; s < SEG; s++) {
      const o = (s / SEG) * .75 + (k / N) * .25, v = Math.round(255 * (1 - .88 * o)), x2 = x + Math.cos(a) * 9, y2 = y + Math.sin(a) * 9;
      g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 4.2 - s * .12; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      if (s > 3 && r() < .28) { let bx = x2, by = y2, ba = a + (r() < .5 ? 1 : -1) * (.7 + r() * .5); for (let q = 0; q < 5; q++) { const v2 = Math.max(30, v - 20 - q * 14), nx = bx + Math.cos(ba) * 7, ny = by + Math.sin(ba) * 7; g.strokeStyle = `rgb(${v2},${v2},${v2})`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(bx, by); g.lineTo(nx, ny); g.stroke(); bx = nx; by = ny; ba += (r() - .5) * .6; } }
      x = x2; y = y2; a += (r() - .5) * .7; a = clamp(a, .4, 2.7);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}
// 鏽斑貼圖：雲狀雜訊，配合 alphaTest 由大到小，鏽斑會慢慢擴大
function rustTex() {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), img = g.createImageData(W, H);
  const cc = document.createElement('canvas'); cc.width = W; cc.height = H; const gc = cc.getContext('2d'), ci = gc.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = clamp((fbm(x / 20, y / 16, 4) - .28) * 2.1 + (y / H) * .2, 0, 1), o = (y * W + x) * 4, q = fbm(x / 9 + 30, y / 9, 3), h = U.hash(x, y) * .12;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v * 255; img.data[o + 3] = 255;
    ci.data[o] = (88 + 44 * q) * (.88 + h); ci.data[o + 1] = (50 + 28 * q) * (.88 + h); ci.data[o + 2] = (32 + 14 * q) * (.88 + h); ci.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); gc.putImageData(ci, 0, 0);
  const map = new THREE.CanvasTexture(cc); map.colorSpace = THREE.SRGBColorSpace; return { alpha: new THREE.CanvasTexture(c), map };
}

/* ---------- 地表貼圖：逐像素依坡度、裸岩、碎石、泥土上色 ---------- */
const dist = (x, z, p) => Math.hypot(x - p[0], z - p[1]);
function groundMask(x, z) {
  const dD = dist(x, z, SP.dome), dC = dist(x, z, SP.chem);
  return {
    rock: Math.max(ss(2.1, 1.2, dD) * .95, ss(1.1, .65, dist(x, z, SP.ice)), ss(2.3, 1.4, dC) * .85),
    lime: ss(2.3, 1.4, dC),
    scree: ss(2.7, 1.9, dD) * (1 - ss(1.5, 1.15, dD)),
    dirt: Math.max(ss(2.0, 1.0, dist(x, z, SP.what)) * .85, ss(1.3, .8, dist(x, z, SP.bio)) * .7, ss(1.9, 1.1, dist(x, z, SP.soil)) * .75),
  };
}
function groundTexture(S) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const N = S + 1, H = new Float32Array(N * N), dx = (X1 - X0) / S, dz = (Z1 - Z0) / S;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = height(X0 + i * dx, Z0 + j * dz);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const h = H[j * N + i], sl = Math.hypot((H[j * N + i + 1] - h) / dx, (H[(j + 1) * N + i] - h) / dz), x = X0 + i * dx, z = Z0 + j * dz, n = fbm(x * 1.4, z * 1.4, 3), hs = U.hash(i, j), m = groundMask(x, z);
    let col = mix([126, 174, 82], [66, 124, 56], clamp(fbm(x * .6, z * .6, 3) * 1.6 - .3, 0, 1));
    col = mix(col, [158, 160, 98], ss(1.6, 2.8, h) * .5);
    const rk = Math.max(ss(.75, 1.25, sl) * .9, m.rock);
    col = mix(col, mix(mix([132, 127, 120], [168, 162, 152], n), mix([186, 180, 164], [206, 200, 186], n), m.lime), rk);
    col = mix(col, hs < .5 ? [156, 150, 140] : [112, 106, 98], m.scree * .9);
    col = mix(col, mix([146, 120, 88], [118, 92, 66], n), m.dirt);
    if (m.lime > 0) col = mix(col, [col[0] * .82, col[1] * .84, col[2] * .88], m.lime * .6);     // 雨淋濕的地面
    const q = .93 + .14 * hs, o = (j * S + i) * 4; d[o] = col[0] * q; d[o + 1] = col[1] * q; d[o + 2] = col[2] * q; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
}

/* ---------- 四面側牆的土壤剖面：表土 → 底土 → 碎石層 → 基岩。各層只由 (x,z) 決定，轉角會接起來 ---------- */
const WALLS = [
  { id: 'front', len: X1 - X0, x0: X0, dx: 1, zOf: () => Z1, sc: 80, shade: 1 },
  { id: 'left', len: Z1 - Z0, x0: X0, dx: 0, zOf: s => Z0 + s, sc: 50, shade: .84 },
  { id: 'back', len: X1 - X0, x0: X1, dx: -1, zOf: () => Z0, sc: 50, shade: .78 },
  { id: 'right', len: Z1 - Z0, x0: X1, dx: 0, zOf: s => Z1 - s, sc: 50, shade: .9 },
];
function section(w) {
  const sc = Math.round(w.sc * (G.coarse ? .75 : 1)), Wpx = Math.round(w.len * sc), Hpx = Math.round((YT - YB) * sc), k = sc / 80;
  const c = document.createElement('canvas'); c.width = Wpx; c.height = Hpx; const g = c.getContext('2d'), r = U.rng(23 + w.len * 7 + w.x0);
  const S = s => s * sc, Y = y => (YT - y) * sc, st = .04, xOf = s => w.x0 + w.dx * s, zOf = w.zOf;
  const tp = s => height(xOf(s), zOf(s)), l1 = s => tp(s) - thA(xOf(s), zOf(s)), l2 = s => l1(s) - thB(xOf(s), zOf(s)), l3 = s => l2(s) - thR(xOf(s), zOf(s)), bot = () => YB - 1;
  const path = (fU, fL) => { g.beginPath(); for (let s = 0; s <= w.len + 1e-6; s += st) g.lineTo(S(s), Y(fU(s))); for (let s = w.len; s >= -1e-6; s -= st) g.lineTo(S(s), Y(fL(s))); g.closePath(); };
  const dots = (n, cols, a, b) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(r() * Wpx, r() * Hpx, (a + r() * b) * k, (a + r() * b) * k); } };
  const line = f => { g.beginPath(); for (let s = 0; s <= w.len + 1e-6; s += st) g.lineTo(S(s), Y(f(s))); g.stroke(); };
  // 基岩：花岡岩，越往上裂縫（節理）越開
  path(l3, bot); g.fillStyle = '#9a948c'; g.fill(); g.save(); g.clip(); dots(Wpx * Hpx / 40, ['#e9e4dc', '#c79c90', '#6f6a66', '#3a3634', '#b4aea6'], 1, 2.5);
  g.strokeStyle = 'rgba(52,46,42,.75)'; g.lineCap = 'round';
  for (let i = 0; i < w.len * 1.1; i++) {
    const s0 = .4 + r() * (w.len - .8), yTop = l3(s0) + .05, yBot = YB + .2 + r() * 1.2; let s = s0, y = yBot;
    for (let j = 0; j < 10; j++) { const y2 = y + (yTop - yBot) / 10, s2 = s + (r() - .5) * .08; g.lineWidth = (1 + 4 * j / 10) * k; g.beginPath(); g.moveTo(S(s), Y(y)); g.lineTo(S(s2), Y(y2)); g.stroke(); s = s2; y = y2; }
  }
  g.restore();
  // 碎石層：剛從基岩碎裂下來、有稜有角的石塊，越往上越小
  path(l2, l3); g.fillStyle = '#b0a593'; g.fill(); g.save(); g.clip(); dots(Wpx * Hpx / 60, ['#8d8378', '#cfc4b0'], 1, 2);
  for (let i = 0; i < w.len * 30; i++) {
    const s = r() * w.len, u = Math.pow(r(), .8), y = l3(s) + (l2(s) - l3(s)) * u, rad = lerp(.14, .04, u) * (.6 + r() * .6), nv = 5 + (r() * 3 | 0), rot = r() * 6;
    g.beginPath(); for (let v = 0; v < nv; v++) { const a = rot + v / nv * 6.283, rr = rad * (.65 + r() * .5); g.lineTo(S(s) + Math.cos(a) * rr * sc, Y(y) + Math.sin(a) * rr * sc * .75); } g.closePath();
    g.fillStyle = ['#8f8a84', '#a7a199', '#7a7570', '#bcb5ab'][i % 4]; g.fill(); g.strokeStyle = 'rgba(40,35,30,.35)'; g.lineWidth = 1.2 * k; g.stroke();
  }
  g.restore();
  // 底土：黃褐色，夾著小石子
  path(l1, l2); g.fillStyle = '#a5764a'; g.fill(); g.save(); g.clip(); dots(Wpx * Hpx / 45, ['#8a5e38', '#c0915e', '#6e4a2c'], 1, 2.2);
  for (let i = 0; i < w.len * 14; i++) { const s = r() * w.len, y = l2(s) + (l1(s) - l2(s)) * r(); g.fillStyle = ['#8f8a84', '#b5ada2', '#6f6a64'][i % 3]; g.beginPath(); g.ellipse(S(s), Y(y), (1.5 + r() * 3) * k, (1.2 + r() * 2.4) * k, r() * 3, 0, 7); g.fill(); }
  g.restore();
  // 表土：深褐色，含有生物遺骸，有細根
  path(tp, l1); g.fillStyle = '#4c3628'; g.fill(); g.save(); g.clip(); dots(Wpx * Hpx / 30, ['#2e2018', '#6d5038', '#3b2a1e', '#8a6a44'], 1, 2.4);
  g.strokeStyle = 'rgba(176,138,96,.75)'; g.lineWidth = 1.3 * k;
  for (let i = 0; i < w.len * 6; i++) { const s0 = r() * w.len; let s = s0, y = tp(s0); g.beginPath(); g.moveTo(S(s), Y(y)); const n = 5 + (r() * 5 | 0); for (let j = 0; j < n; j++) { s += (r() - .5) * .05; y -= .03 + r() * .03; g.lineTo(S(s), Y(y)); } g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(30,20,15,.2)'; g.lineWidth = 1.6 * k; line(l1); line(l2); line(l3);
  g.strokeStyle = '#5d9a3e'; g.lineWidth = 5 * k; g.beginPath(); for (let s = 0; s <= w.len + 1e-6; s += st) g.lineTo(S(s), Y(tp(s)) + 2 * k); g.stroke();
  if (w.id === 'front') {         // 正面：蚯蚓與牠鑽的通道
    for (const ex of [-7.6, -1.8, 2.6, 8.2]) {
      const s0 = ex - X0, y0 = l1(s0) + thA(ex, Z1) * .45;
      g.strokeStyle = 'rgba(30,20,12,.6)'; g.lineWidth = 7 * k; g.beginPath(); g.moveTo(S(s0 - .45), Y(y0 + .1)); g.quadraticCurveTo(S(s0 - .1), Y(y0 - .06), S(s0 + .45), Y(y0 + .02)); g.stroke();
      g.strokeStyle = '#e39a8a'; g.lineWidth = 5 * k; g.lineCap = 'round'; g.beginPath(); for (let j = 0; j <= 12; j++) { const u = j / 12; g.lineTo(S(s0 + u * .36), Y(y0 + .022 * Math.sin(u * 9))); } g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function wallGeo(w) {
  const pos = [], uv = [], idx = []; let n = 0;
  for (let s = 0; s <= w.len + 1e-6; s += .05) { const x = w.x0 + w.dx * s, z = w.zOf(s), y = height(x, z), u = s / w.len; pos.push(x, y, z, x, YB, z); uv.push(u, (y - YB) / (YT - YB), u, 0); n++; }
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); return geo;
}

/* ---------- 建立場景 ---------- */
function build() {
  const T = THREE, scene = new T.Scene(); scene.background = U.skyTexture('#78b9e6', '#eef0e6'); scene.fog = new T.Fog(0xe8eee8, 60, 140);
  U.addSun(scene, 14); scene.add(U.groundShadow(40, 28, YB - .05));
  const anim = [], picks = [], rnd = U.rng(57), detail = U.detailTexture(10, 6), rockBump = U.detailTexture(3, 2);
  const pick = (o, node) => { o.userData.node = node; picks.push(o); return o; };
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), Qb = new T.Quaternion(), V = new T.Vector3(), V2 = new T.Vector3(), SC = new T.Vector3(), E = new T.Euler(), col = new T.Color();

  // 地形
  const NX = 120, NZ = 66, pos = [], uvs = [], idx = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = X0 + i * (X1 - X0) / NX, z = Z0 + j * (Z1 - Z0) / NZ; pos.push(x, height(x, z), z); uvs.push(i / NX, j / NZ); }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  const terr = new T.Mesh(tg, new T.MeshStandardMaterial({ map: groundTexture(G.coarse ? 256 : 512), bumpMap: detail, bumpScale: 1.6, roughness: .95 }));
  scene.add(U.shadowed(terr, false, true));
  for (const w of WALLS) { const m = new T.Mesh(wallGeo(w), new T.MeshBasicMaterial({ map: section(w), color: new T.Color(w.shade, w.shade, w.shade), toneMapped: false, side: T.DoubleSide })); scene.add(m); if (w.id === 'front') pick(m, 'soil'); }

  // 材質
  const granMap = speckTex('#bdb5ab', ['#f2ede6', '#c9aaa0', '#8f8a85', '#2f2b2a', '#e8e0d4'], 1500), andMap = speckTex('#7d8084', ['#e3e3df', '#56595d', '#9a9da1'], 900, .6, 1.6);
  const limeMap = speckTex('#e2dac8', ['#c9bfa9', '#f4efe2', '#b5ab95'], 900, .8, 2), sandMap = speckTex('#d9c08e', ['#b89a63', '#efdcae', '#a08050', '#fff3d6'], 4000, .5, 1.4);
  const soilMap = speckTex('#5a4030', ['#3a281c', '#7a5a40', '#2a1d14', '#8c6a3a'], 3000, .6, 1.6);
  const mk = (map, o = {}) => new T.MeshStandardMaterial(Object.assign({ map, roughness: .92, bumpMap: rockBump, bumpScale: 2.4 }, o));
  const granMat = mk(granMap);

  /* ① 中央的大岩石：完整 → 裂縫 → 裂成石塊 → 石塊碎成礫石 → 礫石碎成砂 → 混入生物遺骸變成土壤
     石塊＝同一顆岩石沿三個斜切面切開（夾住座標），拼回去和原來一樣；每一代顆粒的落點都互不重疊 */
  const BY = height(...SP.what), BC = new T.Vector3(SP.what[0], BY + .5, SP.what[1]), cr = U.rng(8);
  const bGeo = rockGeo(1.05, .78, .9, 3.1, .14);
  const whole = new T.Mesh(bGeo, granMat); whole.position.copy(BC); scene.add(pick(U.shadowed(whole), 'what'));
  const crackMat = new T.MeshBasicMaterial({ color: 0x2a221c, alphaMap: crackTex(), alphaTest: .99 }), crack = new T.Mesh(bGeo, crackMat); crack.scale.setScalar(1.01); whole.add(crack);
  const core = new T.Mesh(rockGeo(.86, .6, .74, 3.1, .1, 4), new T.MeshBasicMaterial({ color: 0x241c16 })); core.position.copy(BC); core.visible = false; scene.add(core);
  const RM = new T.Matrix4().makeRotationFromEuler(new T.Euler(.35, .8, -.25)), RMi = RM.clone().invert(), CUT = [.1, -.02, -.06], pv = new T.Vector3();
  // 六塊：下半部兩大塊（只切 x），上半部四小塊（切 x 和 z）；[軸, 正負] 表示這塊在切面的哪一側
  const PARTS = [[[1, -1], [0, -1]], [[1, -1], [0, 1]], [[1, 1], [0, -1], [2, -1]], [[1, 1], [0, -1], [2, 1]], [[1, 1], [0, 1], [2, -1]], [[1, 1], [0, 1], [2, 1]]];
  const pieces = [];
  for (const part of PARTS) {
    const g = bGeo.clone(), p = g.attributes.position, nr = g.attributes.normal, cen = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      pv.fromBufferAttribute(p, i).applyMatrix4(RM); const u = [pv.x, pv.y, pv.z], nn = [0, 0, 0]; let hit = false;
      for (const [a, sa] of part) if ((u[a] - CUT[a]) * sa < 0) { u[a] = CUT[a]; nn[a] = -sa; hit = true; }
      pv.set(u[0], u[1], u[2]).applyMatrix4(RMi); p.setXYZ(i, pv.x, pv.y, pv.z); cen.add(pv);
      if (hit) { pv.set(nn[0], nn[1], nn[2]).transformDirection(RMi); nr.setXYZ(i, pv.x, pv.y, pv.z); }
    }
    cen.divideScalar(p.count); g.translate(-cen.x, -cen.y, -cen.z);
    const up = cen.y > .05, out = new T.Vector3(cen.x, 0, cen.z); if (out.lengthSq() < 1e-4) out.set(1, 0, 0); out.normalize();
    const q1 = new T.Quaternion().setFromAxisAngle(new T.Vector3(out.z, 0, -out.x), up ? 1.25 + cr() * .6 : .12 + cr() * .18);
    let minY = 1e9, rad = 0; for (let i = 0; i < p.count; i++) { pv.fromBufferAttribute(p, i).applyQuaternion(q1); minY = Math.min(minY, pv.y); rad = Math.max(rad, Math.hypot(pv.x, pv.z)); }
    const m = new T.Mesh(g, granMat); m.visible = false; scene.add(pick(U.shadowed(m), 'what'));
    const pm = new T.Mesh(new T.IcosahedronGeometry(1, 2), new T.MeshBasicMaterial({ color: 0xd8ccbb, transparent: true, opacity: 0, depthWrite: false })); pm.visible = false; scene.add(pm);
    pieces.push({ m, pm, cen, out, q1, minY, rad, up, dir: cen.clone().normalize(), p0: BC.clone().add(cen) });
  }
  // 落點：先放下層再放上層；和已放好的石塊太近，就換個角度或往外推
  const placed = [];
  [...pieces].sort((a, b) => a.up - b.up).forEach((pc, k) => {
    const th = Math.atan2(pc.out.z, pc.out.x), L0 = Math.hypot(pc.cen.x, pc.cen.z) + (pc.up ? .4 : .14); let x = 0, z = 0;
    search: for (let L = L0; L < L0 + 2.5; L += .05) for (const dt of [0, .2, -.2, .4, -.4, .6, -.6, .85, -.85]) { x = BC.x + Math.cos(th + dt) * L; z = BC.z + Math.sin(th + dt) * L; if (placed.every(o => Math.hypot(o.x - x, o.z - z) > o.rad + pc.rad + .06)) break search; }
    placed.push({ x, z, rad: pc.rad }); pc.rest = { x, z }; pc.p1 = new T.Vector3(x, height(x, z) - pc.minY - .06, z); if (!pc.up) pc.p1.y = Math.min(pc.p1.y, pc.p0.y);   // 下半部不往上浮
    pc.t0 = .25 + (pc.up ? .03 : 0) + k * .008; pc.tb = .44 + k * .024;
  });
  // 礫石：每個石塊碎成 4–6 顆，留在原來石塊的範圍內
  const gravGeo = blockGeo(1, .72, .88, 40, 2, .14, .45), gvl = [];
  gravGeo.computeVertexNormals();
  pieces.forEach((pc, k) => { let n = 0; for (let t = 0; t < 700 && n < (pc.up ? 6 : 10); t++) { const s = .12 + cr() * .08, a = cr() * 6.283, d = Math.sqrt(cr()) * Math.max(0, pc.rad - s * .8), x = pc.rest.x + Math.cos(a) * d, z = pc.rest.z + Math.sin(a) * d; if (gvl.every(o => Math.hypot(o.x - x, o.z - z) > 1.08 * (o.s + s) + .015)) { gvl.push({ x, z, s, k, rx: (cr() - .5) * .8, ry: cr() * 6, y: height(x, z) + s * .45, tg: Math.max(.6 + cr() * .13, pc.tb + .06) }); n++; } } });
  const gravel = new T.InstancedMesh(gravGeo, mk(granMap, { color: 0xcfc7bf }), gvl.length); scene.add(U.shadowed(gravel));
  // 砂粒：每顆礫石崩成一小堆砂（顏色和花岡岩的礦物一樣：白、粉紅、灰、黑）
  const grains = [];
  gvl.forEach((o, gi) => { const R0 = o.s * 1.8; for (let n = 0; n < 26; n++) { const a = cr() * 6.283, d = Math.sqrt(cr()) * R0, x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d, sz = .022 + cr() * .016; grains.push({ gi, sz, x, z, y: height(x, z) + (1 - (d / R0) ** 2) * o.s * .62 + sz * .2, x0: o.x + (cr() - .5) * o.s * 1.4, y0: o.y + (cr() - .2) * o.s * .7, z0: o.z + (cr() - .5) * o.s * 1.4, rx: cr() * 6, ry: cr() * 6, d: cr() * .012 }); } });
  const grainMat = new T.MeshStandardMaterial({ roughness: .9 }), grain = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), grainMat, grains.length);
  grains.forEach((g, k) => grain.setColorAt(k, col.set(['#f2ede6', '#d9a597', '#8f8a85', '#e8e0d4', '#c9b8a6', '#f2ede6', '#b9aa9a', '#d9a597', '#8f8a85', '#3a3533'][k % 10])));
  grain.receiveShadow = true; scene.add(grain);
  // 砂堆與土壤：高度場，每顆礫石崩解時在原地長出一小堆砂；最後整片加厚、變成深色的土壤
  let RX = 0, RZ = 0; for (const o of gvl) { RX = Math.max(RX, Math.abs(o.x - BC.x) + o.s * 2 + .35); RZ = Math.max(RZ, Math.abs(o.z - BC.z) + o.s * 2 + .35); }
  const profAt = (x, z) => { let q = 0; for (const o of gvl) q = Math.max(q, 1 - (Math.hypot(x - o.x, z - o.z) / (o.s * 2 + .32)) ** 2); return q > 0 ? Math.sqrt(q) * (.75 + .5 * U.vnoise(x * 2.3, z * 2.3)) : 0; };   // 只鋪在碎屑散落的範圍
  const bedG = new T.PlaneGeometry(RX * 2, RZ * 2, 56, 52).rotateX(-Math.PI / 2).translate(BC.x, 0, BC.z), bp = bedG.attributes.position;
  const bedGround = new Float32Array(bp.count), bedProf = new Float32Array(bp.count);
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i); bedGround[i] = height(x, z); bedProf[i] = profAt(x, z); }
  const HS = .05, sandPile = (o, x, z) => { const q = 1 - (Math.hypot(x - o.x, z - o.z) / (o.s * 2)) ** 2; return q > 0 ? q * o.s * .62 : 0; };
  const finalH = (x, z, soil) => { let h = 0; for (const o of gvl) h = Math.max(h, sandPile(o, x, z)); return h + soil * HS * profAt(x, z); };
  const bedMat = new T.MeshStandardMaterial({ map: speckTex('#c9bcab', ['#f2ede6', '#d9a597', '#8f8a85', '#2f2b2a', '#e8e0d4'], 2600, .5, 1.2), roughness: 1, bumpMap: detail, bumpScale: 2.2 });
  bedMat.map.repeat.set(RX * 1.4, RZ * 2.8);
  const bed = new T.Mesh(bedG, bedMat); bed.receiveShadow = true; bed.visible = false; scene.add(pick(bed, 'what'));
  const act = new Float32Array(gvl.length); let bedKey = '', grainPhase = -1;
  const wLeafMat = new T.MeshStandardMaterial({ roughness: 1, side: T.DoubleSide }), leaves = new T.InstancedMesh(new T.PlaneGeometry(.11, .06), wLeafMat, 30), lv = [];
  const near = () => { const o = gvl[Math.floor(cr() * gvl.length)], a = cr() * 6.283, d = Math.sqrt(cr()) * (o.s * 2 + .2); return [o.x + Math.cos(a) * d, o.z + Math.sin(a) * d]; };
  for (let k = 0; k < 30; k++) { const [x, z] = near(); lv.push({ x, z, y: height(x, z) + finalH(x, z, .55) + .012, ry: cr() * 6, t0: .8 + cr() * .05 }); leaves.setColorAt(k, col.set(['#9a6a2e', '#c08a3a', '#7a5428', '#a8742c'][k % 4])); }
  scene.add(leaves);
  const leafMat = new T.MeshStandardMaterial({ roughness: 1, side: T.DoubleSide });
  const tuftGeo = U.merge([[new T.ConeGeometry(.022, .17, 3).translate(0, .085, 0).rotateZ(.28), '#5f9a3c'], [new T.ConeGeometry(.02, .15, 3).translate(0, .075, 0).rotateZ(-.32).rotateY(2.1), '#4f8a34'], [new T.ConeGeometry(.02, .19, 3).translate(0, .095, 0).rotateX(.25).rotateY(4.2), '#6aa644']]);
  const tuftMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
  const mTufts = new T.InstancedMesh(tuftGeo, tuftMat, 60), mt = [];
  for (let k = 0; k < 60; k++) { const [x, z] = near(); mt.push({ x, z, y: height(x, z) + finalH(x, z, 1), ry: cr() * 6, s: 1 + cr() * 1.1, t0: .89 + cr() * .07 }); mTufts.setColorAt(k, col.setHSL(.27 + (cr() - .5) * .05, .45, .55 + cr() * .2)); }
  scene.add(mTufts);
  const STAGES = ['① 完整的岩石', '② 日曬雨淋，出現裂縫', '③ 裂成大大小小的石塊', '④ 石塊再碎成礫石', '⑤ 礫石越碎越小，變成砂', '⑥ 混入生物遺骸，變成土壤'];
  const stageL = G.addLabel('', 'tag', [BC.x, BY + 1.85, BC.z]); let stageN = -1;
  const QI = new T.Quaternion(), WHITE = new T.Color(1, 1, 1), SOIL = new T.Color(.44, .31, .22), V3 = new T.Vector3();
  const showWhat = p => {
    whole.visible = p < .19; crack.visible = p > .07 && p < .19; crackMat.alphaTest = lerp(.99, .3, ss(.07, .18, p));
    const gap = ss(.19, .24, p) * .045; core.visible = p >= .19 && p < .3;
    for (const pc of pieces) {
      pc.m.visible = p >= .19 && p < pc.tb;
      if (pc.m.visible) {
        const u = ss(pc.t0, pc.t0 + .1, p), ux = 1 - (1 - u) * (1 - u), uy = u * u;
        V3.copy(pc.p0).addScaledVector(pc.dir, gap);
        pc.m.position.set(lerp(V3.x, pc.p1.x, ux), lerp(V3.y, pc.p1.y, uy) + (pc.up ? Math.sin(Math.PI * u) * .12 : 0), lerp(V3.z, pc.p1.z, ux));
        pc.m.quaternion.slerpQuaternions(QI, pc.q1, u);
      }
      const du = ss(pc.tb - .004, pc.tb + .045, p); pc.pm.visible = du > 0 && du < 1;
      if (pc.pm.visible) { pc.pm.position.set(pc.rest.x, pc.p1.y + .05, pc.rest.z); pc.pm.scale.setScalar(pc.rad * (.35 + du * .55)); pc.pm.material.opacity = .32 * Math.sin(Math.PI * du); }
    }
    gvl.forEach((o, k) => {
      const pc = pieces[o.k], a = ss(pc.tb, pc.tb + .025, p), vis = p >= pc.tb && p < o.tg, ox = o.x - pc.rest.x, oz = o.z - pc.rest.z;
      E.set(o.rx, o.ry, 0); Q.setFromEuler(E);
      M4.compose(V.set(pc.rest.x + ox * lerp(.6, 1, a), o.y + Math.sin(Math.PI * a) * .08, pc.rest.z + oz * lerp(.6, 1, a)), Q, SC.setScalar(vis ? o.s : 1e-4)); gravel.setMatrixAt(k, M4);
    });
    gravel.instanceMatrix.needsUpdate = true;
    const gph = p <= .56 ? 0 : p < .97 ? 1 : 2, soilG = ss(.82, .95, p) * HS * .8;
    if (gph === 1 || gph !== grainPhase) {      // 砂粒只在崩解期間更新（循環重新開始時也要重設）
      grainPhase = gph;
      grains.forEach((g, k) => {
        const o = gvl[g.gi], f = ss(o.tg + g.d, o.tg + g.d + .03, p), vis = p >= o.tg + g.d;
        E.set(g.rx + f * 3, g.ry, 0); Q.setFromEuler(E);
        M4.compose(V.set(lerp(g.x0, g.x, f), lerp(g.y0, g.y, f * f) + soilG * (g.pf ?? (g.pf = profAt(g.x, g.z))), lerp(g.z0, g.z, f)), Q, vis ? SC.set(g.sz, g.sz * .8, g.sz) : SC.setScalar(1e-4)); grain.setMatrixAt(k, M4);
      });
      grain.instanceMatrix.needsUpdate = true;
    }
    // 砂堆／土壤高度場：數值有變才重算
    for (let g = 0; g < gvl.length; g++) act[g] = ss(gvl[g].tg + .005, gvl[g].tg + .045, p);
    const soil = ss(.82, .95, p); let key = Math.round(soil * 60) + '|'; for (let g = 0; g < gvl.length; g++) key += Math.round(act[g] * 40) + ',';
    if (key !== bedKey) {
      bedKey = key; let any = soil > 0;
      for (let i = 0; i < bp.count; i++) {
        const x = bp.getX(i), z = bp.getZ(i); let h = 0;
        for (let g = 0; g < gvl.length; g++) if (act[g] > 0) h = Math.max(h, act[g] * sandPile(gvl[g], x, z));
        h += soil * HS * bedProf[i]; if (h > .003) any = true; bp.setY(i, bedGround[i] + (h > .003 ? h : -.04));
      }
      bed.visible = any; if (any) { bp.needsUpdate = true; bedG.computeVertexNormals(); }
    }
    bedMat.color.lerpColors(WHITE, SOIL, ss(.83, .95, p)); grainMat.color.lerpColors(WHITE, SOIL, ss(.84, .96, p));
    const rot = ss(.87, .95, p); wLeafMat.color.setScalar(lerp(1, .45, rot));
    lv.forEach((o, k) => { const s = ss(o.t0, o.t0 + .01, p) * lerp(1, .35, rot), f = ss(o.t0, o.t0 + .03, p); E.set(-Math.PI / 2 + .2 + (1 - f) * 1.2, 0, o.ry + (1 - f) * 2); Q.setFromEuler(E); M4.compose(V.set(o.x, o.y + (1 - f) * .7, o.z), Q, SC.setScalar(Math.max(s, 1e-4))); leaves.setMatrixAt(k, M4); }); leaves.instanceMatrix.needsUpdate = true;
    mt.forEach((o, k) => { const s = o.s * ss(o.t0, o.t0 + .05, p); Q.setFromAxisAngle(V2.set(0, 1, 0), o.ry); M4.compose(V.set(o.x, o.y - .01, o.z), Q, SC.setScalar(Math.max(s, 1e-4))); mTufts.setMatrixAt(k, M4); }); mTufts.instanceMatrix.needsUpdate = true;
    const n = p < .07 ? 0 : p < .25 ? 1 : p < .43 ? 2 : p < .6 ? 3 : p < .8 ? 4 : 5;
    if (n !== stageN) { stageN = n; stageL.el.innerHTML = STAGES[n] + `<small>時間經過 ${'▮'.repeat(n + 1)}${'▯'.repeat(5 - n)}　很久很久……</small>`; }
  };

  /* ② 物理性風化：日夜溫差讓圓岩一層層剝落（洋蔥狀剝落）；裂縫裡的水結冰撐開岩石 */
  const DY = height(...SP.dome), dome = new T.Group(); dome.position.set(SP.dome[0], DY - .15, SP.dome[1]); dome.scale.set(1, .8, 1); scene.add(pick(dome, 'physical'));
  const R = 1.2, rf = d => R * (1 + .06 * (f3(d[0] * 2 + 4, d[1] * 2, d[2] * 2) - .5) * 2);
  const domeMat = mk(granMap), skinMat = mk(granMap, { color: 0xe3d2bc, side: T.DoubleSide });
  dome.add(U.shadowed(new T.Mesh(shellGeo(rf, 0, .995, 0, 6.2832, 0, 1.66, 40, 18), domeMat)));
  const PT = [[0, 6.2832, 0, .6]];
  for (let k = 0; k < 4; k++) PT.push([k * 1.5708 + .35, (k + 1) * 1.5708 + .35, .6, 1.12]);
  for (let k = 0; k < 5; k++) PT.push([k * 1.2566 + 1.1, (k + 1) * 1.2566 + 1.1, 1.12, 1.66]);
  const patches = PT.map(([pa, pb, ta, tb], k) => {
    const pm = (pa + pb) / 2, tm = k ? (ta + tb) / 2 : 0, d = [Math.sin(tm) * Math.cos(pm), Math.cos(tm), Math.sin(tm) * Math.sin(pm)], c = new T.Vector3(...d).multiplyScalar(rf(d) * 1.05);
    const geo = shellGeo(rf, 1.0, 1.1, pa, pb, ta, tb, k ? 10 : 24, k ? 8 : 6); geo.translate(-c.x, -c.y, -c.z);
    const m = new T.Mesh(geo, skinMat); m.position.copy(c); dome.add(U.shadowed(m));
    const out = k ? new T.Vector3(d[0], 0, d[2]).normalize() : new T.Vector3(.2, 0, 1).normalize(), L = R * (1.5 + .14 * (k % 3));
    return { m, c, dir: c.clone().normalize(), out, land: new T.Vector3(out.x * L, (height(SP.dome[0] + out.x * L, SP.dome[1] + out.z * L) - DY + .15) / .8 + .05, out.z * L), tm, flat: new T.Quaternion().setFromUnitVectors(c.clone().normalize(), new T.Vector3(0, 1, 0)).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), k * 1.3)), ax: new T.Vector3(out.z, 0, -out.x), front: out.z + (k ? 0 : .3) };
  });
  const order = patches.slice().sort((a, b) => b.front - a.front), DAY = 3.2, PCYC = order.length * DAY + 4;
  const tempL = G.addLabel('', 'tag', [SP.dome[0], DY + 1.75, SP.dome[1]]); let tempN = -1;
  const showDome = (lt, gl) => {
    const heat = Math.sin(lt / DAY * 6.2832), fade = ss(PCYC, PCYC - 1.2, lt), grow = ss(0, .8, lt);
    domeMat.emissive.setRGB(Math.max(0, heat) * .12 * gl, Math.max(0, heat) * .03 * gl, Math.max(0, -heat) * .1 * gl); skinMat.emissive.copy(domeMat.emissive);
    order.forEach((P, i) => {
      const t0 = i * DAY, loose = ss(t0 + 1.2, t0 + 2.6, lt), u = ss(t0 + 2.6, t0 + 3.5, lt);
      V.copy(P.c).addScaledVector(P.dir, .04 * loose + (u ? 0 : .012 * heat));
      P.m.position.lerpVectors(V, P.land, u); P.m.position.y += Math.sin(Math.PI * u) * .3;
      P.m.quaternion.identity().slerp(P.flat, u);
      P.m.scale.setScalar(Math.max(1e-4, u > 0 ? fade * lerp(1, .5, ss(t0 + 3.5, t0 + 4.6, lt)) : grow));
    });
    const n = heat >= 0 ? 0 : 1;
    if (n !== tempN) { tempN = n; tempL.el.innerHTML = n ? '🌙 晚上變冷<small>岩石外層收縮</small>' : '☀️ 白天曬熱<small>岩石外層膨脹</small>'; }
  };
  const IY = height(...SP.ice), isy = .55, andMat = mk(andMap, { flatShading: true });
  const iceL = new T.Mesh(halfGeo(.5, isy, .55, 31, -1), andMat), iceR = new T.Mesh(halfGeo(.5, isy, .55, 31, 1), andMat);
  for (const m of [iceL, iceR]) { m.position.set(SP.ice[0], IY - .05, SP.ice[1]); scene.add(pick(U.shadowed(m), 'physical')); }
  const wsh = new T.Shape(); wsh.moveTo(0, 0); wsh.lineTo(.5, 1); wsh.lineTo(-.5, 1); wsh.closePath();
  const wedgeMat = new T.MeshStandardMaterial({ color: 0x4a90d9, roughness: .25, emissive: 0x0b2a55, emissiveIntensity: .3 }), wedge = new T.Mesh(new T.ExtrudeGeometry(wsh, { depth: 1, bevelEnabled: false }).translate(0, 0, -.5), wedgeMat);
  wedge.position.copy(iceL.position); scene.add(wedge);
  const HC = isy * 1.3, ICE = new T.Color(0xe6f8ff), WAT = new T.Color(0x3b82f6), ICYC = 20, ISTEP = ['① 雨水流進裂縫', '② 水結冰，體積變大，把裂縫撐開', '③ 冰融化，水再流進更深的地方', '④ 一再重複，岩石終於裂開了'];
  const iceLb = G.addLabel('', 'tag', [SP.ice[0], IY + 1.45, SP.ice[1]]); let iceN = '';
  const showIce = lt => {
    let a, fill = 0, ice = 0, step, k = Math.min(3, Math.floor(lt / 4)), f = lt - k * 4;
    if (lt < 16) {
      const aK = .03 + .045 * k; a = lerp(aK, aK + .045, ss(1.5, 2.6, f));
      fill = f < 1.4 ? ss(0, 1.4, f) : f < 2.8 ? 1 : lerp(1, .35, ss(2.8, 4, f)); if (k && f < 1.4) fill = Math.max(fill, .35);
      ice = ss(1.4, 2.1, f) * (1 - ss(2.8, 3.4, f)); step = f < 1.4 ? 0 : f < 2.8 ? 1 : 2;
      iceR.rotation.z = -a;
    } else { a = .21; step = 3; iceR.rotation.z = -(a + ss(16, 17.3, lt) * 1.15); }
    iceL.rotation.z = a;
    wedge.visible = fill > .01; const fh = HC * fill * (1 + .06 * ice); wedge.scale.set(Math.max(1e-3, 2 * Math.tan(a) * fh * .92), Math.max(1e-3, fh), .95);
    wedgeMat.color.lerpColors(WAT, ICE, ice); wedgeMat.emissive.setRGB(.02 + ice * .2, .08 + ice * .25, .2 + ice * .25);
    const s = ISTEP[step] + (step < 3 ? `<small>第 ${k + 1} 次結冰</small>` : '<small>水結冰時體積會變大</small>');
    if (s !== iceN) { iceN = s; iceLb.el.innerHTML = s; }
  };

  /* ③ 化學性風化：雨水溶蝕石灰岩、讓含鐵的岩石變色（生鏽） */
  const rainCloud = U.cloud(3.2, .9, 2.0, 14, rnd); rainCloud.position.set(SP.chem[0], 4.5, SP.chem[1]);
  rainCloud.traverse(o => { if (o.isMesh) { o.material.color.set(0xaab3bd); o.material.emissiveIntensity = .06; } }); scene.add(pick(rainCloud, 'chemical'));
  const RAIN = 120, rain = new T.InstancedMesh(new T.BoxGeometry(.012, .24, .012), new T.MeshBasicMaterial({ color: 0x9cc3ea, transparent: true, opacity: .75 }), RAIN), rd = [];
  for (let k = 0; k < RAIN; k++) { const x = SP.chem[0] - 1.5 + rnd() * 3, z = SP.chem[1] - .9 + rnd() * 1.8; rd.push({ x, z, g: height(x, z), ph: rnd() }); }
  scene.add(rain);
  anim.push(t => { rd.forEach((o, k) => { const u = (t * 1.25 + o.ph) % 1, y = lerp(4.1, o.g, u); M4.makeTranslation(o.x, y, o.z); rain.setMatrixAt(k, M4); }); rain.instanceMatrix.needsUpdate = true; });
  const LY = height(...SP.lime), lg = new T.IcosahedronGeometry(1, G.coarse ? 11 : 15), lp = lg.attributes.position, LN = lp.count, L0 = new Float32Array(LN * 3), LDIR = new Float32Array(LN * 3), LD = new Float32Array(LN);
  for (let i = 0; i < LN; i++) {
    const x = lp.getX(i), y = lp.getY(i), z = lp.getZ(i), m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)), n = f3(x * 2 + 7, y * 2, z * 2);
    const bx = lerp(x, x / m, .7), by = lerp(y, y / m, .7), bz = lerp(z, z / m, .7), r = 1 + .05 * (n - .5) * 2;
    L0[i * 3] = bx * r * .78; L0[i * 3 + 1] = by * r * .55; L0[i * 3 + 2] = bz * r * .62; LDIR[i * 3] = x; LDIR[i * 3 + 1] = y; LDIR[i * 3 + 2] = z;
    const topF = ss(.15, .65, y), chanTop = Math.pow(1 - Math.abs(Math.sin(bx * 4.5 + n * 2.5 + bz * 1.5)), 4), chanSide = Math.pow(1 - Math.abs(Math.sin(Math.atan2(bz, bx) * 9 + n * 2)), 4) * ss(-.7, .5, y);
    LD[i] = .1 * (topF * chanTop * .7 + (1 - topF) * chanSide) + .08 * ss(.62, .74, f3(x * 3 + 9, y * 3, z * 3)) + .015;
  }
  lg.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(LN * 3).fill(1), 3));
  const LG = smoothGroups(lg), lime = new T.Mesh(lg, mk(limeMap, { vertexColors: true, bumpScale: 1.6 })); lime.position.set(SP.lime[0], LY + .22, SP.lime[1]); lime.rotation.y = .4;
  scene.add(pick(U.shadowed(lime), 'chemical'));
  let lastL = -1;
  const setLime = pr => {
    if (Math.abs(pr - lastL) < .006) return; lastL = pr; const a = lp.array, ca = lg.attributes.color.array;
    for (let i = 0; i < LN; i++) { const k = LD[i] * pr; a[i * 3] = L0[i * 3] - LDIR[i * 3] * k; a[i * 3 + 1] = L0[i * 3 + 1] - LDIR[i * 3 + 1] * k; a[i * 3 + 2] = L0[i * 3 + 2] - LDIR[i * 3 + 2] * k; const v = 1 - 4 * k; ca[i * 3] = v; ca[i * 3 + 1] = v * .97; ca[i * 3 + 2] = v * .9; }
    lp.needsUpdate = true; lg.attributes.color.needsUpdate = true; smoothNormals(lg, LG); lg.computeBoundingSphere();
  };
  setLime(0);
  const RY = height(...SP.rust), rGeo = rockGeo(.78, .6, .68, 21, .2), rust = new T.Mesh(rGeo, mk(andMap)); rust.position.set(SP.rust[0], RY + .3, SP.rust[1]); scene.add(pick(U.shadowed(rust), 'chemical'));
  const RT = rustTex(), rustMat = new T.MeshStandardMaterial({ map: RT.map, roughness: 1, alphaMap: RT.alpha, alphaTest: .99, bumpMap: rockBump, bumpScale: 3 }), rustSkin = new T.Mesh(rGeo, rustMat); rustSkin.scale.setScalar(1.006); rust.add(rustSkin);
  const CCYC = 24, showChem = lt => { const pr = ss(1, 19, lt) * (1 - ss(21.5, 23.5, lt)); setLime(pr); rustSkin.visible = pr > .02; rustMat.alphaTest = lerp(.99, .56, pr); };

  /* ④ 生物性風化：小樹從裂縫長大，根把岩石撐開；地衣與苔蘚長滿岩石表面 */
  const BiY = height(...SP.bio), bsy = .62, bioMat = mk(granMap, { color: 0xd8d0c4, flatShading: true });
  const bioL = new T.Mesh(halfGeo(.62, bsy, .7, 51, -1), bioMat), bioR = new T.Mesh(halfGeo(.62, bsy, .7, 52, 1), bioMat);
  for (const m of [bioL, bioR]) { m.position.set(SP.bio[0], BiY - .08, SP.bio[1]); scene.add(pick(U.shadowed(m), 'biological')); m.updateMatrixWorld(true); }
  const tree = new T.Mesh(U.treeGeos(1.6).broad, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 })), TB = new T.Vector3(SP.bio[0], BiY - .08 + bsy * 1.38, SP.bio[1]);
  tree.position.copy(TB); scene.add(pick(U.shadowed(tree), 'biological'));
  const rootMat = new T.MeshStandardMaterial({ color: 0x6b4a2e, roughness: .9 }), roots = [];
  const addRoot = (pts, parent, rad) => {
    const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(TB.x + p[0], TB.y + p[1], TB.z + p[2]).sub(parent ? parent.position : V2.set(0, 0, 0)))), geo = new T.TubeGeometry(curve, 28, rad, 6);
    const m = new T.Mesh(geo, rootMat); (parent || scene).add(U.shadowed(m)); roots.push({ geo, n: geo.index.count }); return m;
  };
  addRoot([[0, .05, 0], [.01, -.3, .06], [-.02, -.65, -.04], [0, -1.0, .08]], null, .05);
  addRoot([[0, .02, .05], [0, -.25, .4], [.02, -.6, .62], [0, -1.0, .72]], null, .04);
  addRoot([[0, .04, 0], [-.22, .02, .12], [-.45, -.08, .18], [-.62, -.38, .2], [-.72, -.85, .26]], bioL, .038);
  addRoot([[0, .04, 0], [.2, .02, -.14], [.44, -.06, -.22], [.62, -.36, -.2], [.72, -.85, -.24]], bioR, .038);
  const lichens = [], lr = U.rng(19), ray = new T.Raycaster(), LCOL = ['#5f8f3a', '#c9b44a', '#d6873a', '#9fb3a0', '#4f7a2e', '#e0c060'];
  for (let k = 0; k < 40 && lichens.length < 22; k++) {
    const a = lr() * 6.283, el = .1 + lr() * 1.1, d = V.set(Math.cos(el) * Math.cos(a), Math.sin(el), Math.cos(el) * Math.sin(a));
    ray.set(V2.set(SP.bio[0], BiY + .45, SP.bio[1]).addScaledVector(d, 3), d.clone().negate());
    const h = ray.intersectObjects([bioL, bioR])[0]; if (!h || h.point.y < BiY + .05) continue;
    const m = new T.Mesh(new T.CircleGeometry(.06 + lr() * .07, 12), new T.MeshStandardMaterial({ color: LCOL[k % LCOL.length], roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.copy(h.object.worldToLocal(h.point.clone())).addScaledVector(h.face.normal, .006); m.quaternion.setFromUnitVectors(V2.set(0, 0, 1), h.face.normal);
    h.object.add(m); lichens.push({ m, t0: lr() * .55 });
  }
  const BCYC = 22, showBio = lt => {
    const gr = ss(1, 17, lt) * (1 - ss(20.5, 22, lt)), a = .012 + .12 * gr;
    bioL.rotation.z = a; bioR.rotation.z = -a;
    tree.visible = gr > .01; tree.scale.setScalar(.2 + .95 * gr); tree.position.y = TB.y - .05 * (1 - gr);
    roots.forEach(o => o.geo.setDrawRange(0, Math.floor(o.n * clamp(gr * 1.15, 0, 1) / 6) * 6));
    lichens.forEach(o => o.m.scale.setScalar(Math.max(1e-3, ss(o.t0, o.t0 + .4, gr))));
  };

  /* ⑤ 礫石、砂、土壤三堆，比一比顆粒大小 */
  const SY = height(...SP.soil), pileX = [SP.soil[0] - 1.45, SP.soil[0], SP.soil[0] + 1.45], pz = SP.soil[1];
  const gp = new T.InstancedMesh(rockGeo(1, .8, 1, 61, .3, 1), granMat, 42), gr2 = U.rng(4);
  for (let k = 0; k < 42; k++) { const a = gr2() * 6.283, rr = Math.sqrt(gr2()) * .42, s = .06 + gr2() * .06, x = pileX[0] + Math.cos(a) * rr, z = pz + Math.sin(a) * rr, y = height(x, z) + (.36 - rr * .7) * (.5 + gr2() * .5); E.set(gr2() * 6, gr2() * 6, 0); Q.setFromEuler(E); M4.compose(V.set(x, y, z), Q, SC.setScalar(s)); gp.setMatrixAt(k, M4); gp.setColorAt(k, col.setHSL(.07, .08, .5 + gr2() * .3)); }
  scene.add(pick(U.shadowed(gp), 'soil'));
  const pile = (x, map, h) => { const m = new T.Mesh(new T.SphereGeometry(1, 32, 10, 0, 6.283, 0, Math.PI / 2), new T.MeshStandardMaterial({ map, roughness: 1, bumpMap: detail, bumpScale: 1.4 })); m.position.set(x, height(x, pz) - .02, pz); m.scale.set(.5, h, .5); scene.add(pick(U.shadowed(m), 'soil')); return m; };
  pile(pileX[1], sandMap, .28); pile(pileX[2], soilMap, .3);
  const sl = new T.InstancedMesh(new T.PlaneGeometry(.08, .045), leafMat, 12), sprout = new T.InstancedMesh(tuftGeo, tuftMat, 7);
  for (let k = 0; k < 12; k++) { const a = gr2() * 6.283, rr = Math.sqrt(gr2()) * .4, x = pileX[2] + Math.cos(a) * rr, z = pz + Math.sin(a) * rr, y = height(pileX[2], pz) - .02 + .3 * Math.sqrt(Math.max(0, 1 - (rr / .5) ** 2)) + .01; E.set(-Math.PI / 2 + .25, 0, gr2() * 6); Q.setFromEuler(E); M4.compose(V.set(x, y, z), Q, SC.setScalar(1)); sl.setMatrixAt(k, M4); sl.setColorAt(k, col.set(['#9a6a2e', '#c08a3a', '#7a5428'][k % 3])); }
  for (let k = 0; k < 7; k++) { const a = k * .9, rr = .1 + (k % 3) * .1, x = pileX[2] + Math.cos(a) * rr, z = pz + Math.sin(a) * rr, y = height(pileX[2], pz) - .02 + .3 * Math.sqrt(Math.max(0, 1 - (rr / .5) ** 2)); Q.setFromAxisAngle(V2.set(0, 1, 0), a); M4.compose(V.set(x, y - .01, z), Q, SC.setScalar(1.1)); sprout.setMatrixAt(k, M4); sprout.setColorAt(k, col.setHSL(.28, .5, .6)); }
  scene.add(sl, sprout);

  /* 樹木與草叢 */
  const tr = U.rng(5), trees = [];
  for (let k = 0; k < 3000 && trees.length < 120; k++) {
    const x = X0 + .3 + tr() * 19.4, z = Z0 + .3 + tr() * 10.4, h = height(x, z), m = groundMask(x, z);
    if ((z > -3.9 && Math.abs(x) < 8.4) || m.rock > .2 || PADS.some(p => Math.hypot(x - p[0], z - p[1]) < p[2] + .5)) continue;
    trees.push([x, h, z, .9 + tr() * .7, tr() < .6 ? 0 : 1]);
  }
  U.plantTrees(scene, trees, tr, 1.05);
  const NT = G.coarse ? 260 : 480, tufts = new T.InstancedMesh(tuftGeo, tuftMat, NT); let nt = 0;
  for (let k = 0; k < NT * 6 && nt < NT; k++) {
    const x = X0 + .2 + tr() * 19.6, z = Z0 + .2 + tr() * 10.6, m = groundMask(x, z), h = height(x, z), sl2 = Math.hypot(height(x + .1, z) - h, height(x, z + .1) - h) / .1;
    if (m.rock > .15 || m.dirt > .3 || m.scree > .2 || sl2 > .8 || Math.hypot(x - SP.soil[0], z - SP.soil[1]) < 2.1) continue;
    Q.setFromAxisAngle(V2.set(0, 1, 0), tr() * 6); M4.compose(V.set(x, h - .01, z), Q, SC.setScalar(.8 + tr() * .9)); tufts.setMatrixAt(nt, M4); tufts.setColorAt(nt, col.setHSL(.26 + (tr() - .5) * .06, .4 + tr() * .2, .5 + tr() * .25)); nt++;
  }
  tufts.count = nt; scene.add(U.shadowed(tufts, true, false));

  /* 節點圓點與解說標籤 */
  const z = G.zones.weather, def = G.zoneDef('weather');
  for (const n of z.nodes) G.addLabel(`<b>${n.num}</b><span>${n.title}</span>`, 'node' + (n.ready ? '' : ' soon'), n.at, { color: n.color || def.color, onClick: () => G.openNode(n.id) });
  const F = Z1 + .05, fy = x => height(x, Z1), dep = (x, a) => fy(x) - a;
  const tags = {
    what: [stageL],
    physical: [tempL, iceLb, G.addLabel('洋蔥狀剝落<small>外層一片片剝落下來</small>', 'tag', [SP.dome[0] + .4, DY + .2, SP.dome[1] + 1.9])],
    chemical: [G.addLabel('雨水<small>和空氣一起改變岩石的成分</small>', 'tag', [SP.chem[0], 3.5, SP.chem[1] + .4]),
      G.addLabel('石灰岩被溶蝕<small>出現一道道溝紋和小洞</small>', 'tag', [SP.lime[0] - .3, LY + 1.1, SP.lime[1] + .7]),
      G.addLabel('岩石變色<small>像鐵生鏽一樣變成褐色</small>', 'tag', [SP.rust[0] + .4, RY + 1.05, SP.rust[1] + .5])],
    biological: [G.addLabel('樹根撐開裂縫<small>根越長越粗，裂縫越來越大</small>', 'tag', [SP.bio[0] + .3, BiY + 1.85, SP.bio[1] + .3]),
      G.addLabel('地衣和苔蘚<small>讓岩石表面慢慢分解</small>', 'tag', [SP.bio[0] - .9, BiY + .45, SP.bio[1] + .8])],
    soil: [G.addLabel('礫石<small>顆粒最大</small>', 'tag', [pileX[0], SY + .65, pz]), G.addLabel('砂<small>顆粒小，粗粗的</small>', 'tag', [pileX[1], SY + 1.05, pz]), G.addLabel('土壤<small>細顆粒＋生物遺骸</small>', 'tag', [pileX[2], SY + .65, pz]),
      G.addLabel('表土<small>含有生物遺骸，顏色深</small>', 'tag', [-.6, dep(-.6, thA(-.6, Z1) * .5), F]),
      G.addLabel('底土<small>顏色較淺，夾著小石子</small>', 'tag', [1.5, dep(1.5, thA(1.5, Z1) + thB(1.5, Z1) * .5), F]),
      G.addLabel('碎石層<small>岩石剛碎裂下來的石塊</small>', 'tag', [3.6, dep(3.6, thA(3.6, Z1) + thB(3.6, Z1) + thR(3.6, Z1) * .5), F]),
      G.addLabel('基岩<small>還沒有風化的岩石</small>', 'tag', [5.8, -2.1, F])],
  };

  /* 動態：每個觀察點各自循環播放；開啟節點時從頭播放 */
  const start = { what: 0, dome: 0, ice: 0, chem: 0, bio: 0 }, restart = {}, gl = { physical: 0 };
  const RESTART = { what: ['what'], physical: ['dome', 'ice'], chemical: ['chem'], biological: ['bio'] };
  let cur = null, hot = null;
  const pickAt = rr => { if (!rr) return null; for (const h of rr.intersectObjects(picks, true)) { let o = h.object; while (o && !o.userData.node) o = o.parent; if (o) return o.userData.node; } return null; };
  return {
    scene, home: { pos: [1, 6.8, 18.8], target: [0, .1, -.2] },
    view: { minDist: 3.5, maxDist: 42, maxPolar: Math.PI * .49, pan: { x: [X0, X1], y: [YB, YT], z: [Z0, Z1] } },
    onNode: id => { cur = id; for (const k in tags) tags[k].forEach(L => L.el.classList.toggle('show', k === id)); (RESTART[id] || []).forEach(s => restart[s] = true); },
    onHover: rr => { const n = pickAt(rr); if (n !== hot) { hot = n; G.canvas.style.cursor = n ? 'pointer' : ''; } },
    onTap: rr => { const n = pickAt(rr); if (n && n !== G.state.nodeId) G.openNode(n); },
    update(dt, t) {
      for (const s in restart) { start[s] = t; delete restart[s]; }
      gl.physical += ((cur === 'physical' ? 1 : 0) - gl.physical) * Math.min(1, dt * 4);
      const L = s => t - start[s];
      showWhat(clamp(((L('what') % 20) - 1) / 17, 0, 1));
      showDome(L('dome') % PCYC, gl.physical); showIce(L('ice') % ICYC); showChem(L('chem') % CCYC); showBio(L('bio') % BCYC);
      for (const f of anim) f(t, dt);
    },
    dispose() { G.canvas.style.cursor = ''; U.dispose(scene); }
  };
}

/* ---------- 圖鑑繪圖（SVG）：沒有實景照片時顯示 ---------- */
function wSVG(kind) {
  const r = U.rng(kind.length * 31 + kind.charCodeAt(0) * 7), o = [], f = n => n.toFixed(1), id = 'w_' + kind;
  const sky = (top = '#cfe6f3', ground = '#9cb56c', gy = 160) => o.push(`<rect width="320" height="200" fill="${top}"/><rect y="${gy}" width="320" height="${200 - gy}" fill="${ground}"/>`);
  const specks = (n, cols, x0, y0, w, h, a = .8, b = 2) => { for (let i = 0; i < n; i++) o.push(`<circle cx="${f(x0 + r() * w)}" cy="${f(y0 + r() * h)}" r="${f(a + r() * b)}" fill="${cols[i % cols.length]}"/>`); };
  const blob = (cx, cy, rx, ry, n = 14, j = .12) => { let d = ''; for (let i = 0; i <= n; i++) { const a = i / n * 6.283, k = 1 + (r() - .5) * 2 * j; d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rx * k) + ' ' + f(cy + Math.sin(a) * ry * k); } return d + 'Z'; };
  const shade = `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>`;
  const GRAN = ['#f2ede6', '#d9a597', '#8f8a85', '#2f2b2a'];
  const crackLine = (x, y, a, n, w) => { let d = `M${f(x)} ${f(y)}`; for (let i = 0; i < n; i++) { a += (r() - .5) * .9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; d += `L${f(x)} ${f(y)}`; if (i > 2 && r() < .25) crackLine(x, y, a + (r() < .5 ? 1 : -1), 4, w * .6); } o.push(`<path d="${d}" stroke="#2a221c" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`); };
  if (kind === 'crack') {
    sky(); const d = blob(160, 112, 120, 70, 16, .1);
    o.push(`<defs><clipPath id="${id}c"><path d="${d}"/></clipPath>${shade}</defs><g clip-path="url(#${id}c)"><rect width="320" height="200" fill="#c4b6a8"/>`); specks(420, GRAN, 30, 30, 260, 160, .6, 1.6);
    for (let k = 0; k < 6; k++) crackLine(70 + k * 36, 50 + r() * 20, 1.57 + (r() - .5) * .8, 12, 2.6);
    o.push(`<rect width="320" height="200" fill="url(#${id}g)"/></g><path d="${d}" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="2"/>`);
  }
  if (kind === 'onion') {
    sky(); o.push(`<defs>${shade}</defs>`);
    for (let k = 0; k < 7; k++) { const x = 40 + k * 40 + r() * 10, y = 172 + r() * 12; o.push(`<path d="M${x} ${y}q14 -10 30 -2l-4 6q-12 -6 -24 2z" fill="#c9a88a" stroke="#6b5440" stroke-width="1.2"/>`); }
    o.push(`<clipPath id="${id}c"><path d="M52 170A108 92 0 0 1 268 170Z"/></clipPath><path d="M52 170A108 92 0 0 1 268 170Z" fill="#b9a99a"/><g clip-path="url(#${id}c)">`); specks(320, GRAN, 52, 78, 216, 92, .5, 1.3); o.push('</g>');
    for (const [rx, ry, c] of [[96, 80, '#d9bfa0'], [80, 64, '#c9b29a'], [64, 50, '#bfae9c']]) o.push(`<path d="M${160 - rx} 170A${rx} ${ry} 0 0 1 ${160 + rx} 170" fill="none" stroke="#6b5440" stroke-width="2.4"/><path d="M${160 - rx + 6} 170A${rx - 6} ${ry - 6} 0 0 1 ${160 + rx - 6} 170" fill="none" stroke="${c}" stroke-width="7" opacity=".55"/>`);
    o.push(`<path d="M44 160A116 98 0 0 1 120 76" fill="none" stroke="#c9a88a" stroke-width="10" stroke-linecap="round"/><path d="M44 160A116 98 0 0 1 120 76" fill="none" stroke="#6b5440" stroke-width="1.4" stroke-dasharray="1 0"/><path d="M52 170A108 92 0 0 1 268 170Z" fill="url(#${id}g)"/>`);
  }
  if (kind === 'frost') {
    sky('#dde9f2', '#c9d4dc'); o.push(`<defs>${shade}</defs>`);
    const L = 'M40 175L36 110 58 58 120 40 150 46 157 175Z', Rr = 'M170 175L177 46 210 38 268 56 288 112 282 175Z';
    for (const p of [L, Rr]) { o.push(`<path d="${p}" fill="#858a90"/>`); }
    specks(300, ['#e3e3df', '#56595d', '#a9acb0'], 40, 40, 248, 135, .6, 1.4);
    o.push(`<path d="M150 46L157 175 170 175 177 46Z" fill="#d8f3ff" stroke="#7cc4e8" stroke-width="2"/>`);
    for (const p of [L, Rr]) o.push(`<path d="${p}" fill="url(#${id}g)" stroke="rgba(0,0,0,.4)" stroke-width="2"/>`);
    o.push(`<g stroke="#dc2626" stroke-width="4" stroke-linecap="round" fill="none"><path d="M140 30H100M108 22L100 30 108 38"/><path d="M186 30H226M218 22L226 30 218 38"/></g>`);
    o.push(`<g stroke="#0ea5e9" stroke-width="2.4" stroke-linecap="round"><path d="M163 92V120M151 99L175 113M151 113L175 99"/></g><text x="163" y="146" font-size="14" font-weight="900" text-anchor="middle" fill="#0369a1">冰</text>`);
  }
  if (kind === 'pencil') {
    o.push('<rect width="320" height="200" fill="#9a9ea3"/>'); specks(200, ['#7d8186', '#b3b6ba'], 0, 0, 320, 200, .6, 1.4);
    for (let i = 0; i < 70; i++) { const x = r() * 320, y = r() * 200, L = 30 + r() * 50, w = 4 + r() * 5, a = (r() - .5) * 1.4 + (i % 2 ? .6 : -.5), c = ['#4c545d', '#5d6670', '#6b747e', '#3f464e'][i % 4]; o.push(`<path d="M${f(-L / 2)} 0L${f(-L / 2 + 6)} ${f(-w / 2)}L${f(L / 2)} ${f(-w / 3)}L${f(L / 2 - 4)} ${f(w / 2)}L${f(-L / 2 + 3)} ${f(w / 2)}Z" fill="${c}" stroke="#2d3238" stroke-width=".8" transform="translate(${f(x)} ${f(y)}) rotate(${f(a * 57)})"/>`); }
  }
  if (kind === 'rust') {
    sky(); const d = blob(160, 112, 118, 72, 16, .1);
    o.push(`<defs><clipPath id="${id}c"><path d="${d}"/></clipPath>${shade}</defs><g clip-path="url(#${id}c)"><rect width="320" height="200" fill="#7d8084"/>`); specks(260, ['#e3e3df', '#56595d', '#9a9da1'], 30, 30, 260, 160, .5, 1.3);
    for (let i = 0; i < 16; i++) { const x = 50 + r() * 220, y = 50 + r() * 110; o.push(`<path d="${blob(x, y, 14 + r() * 26, 10 + r() * 18, 12, .3)}" fill="${['#9a5428', '#b4682f', '#7d4322', '#c58a3e'][i % 4]}" opacity=".9"/><path d="M${f(x)} ${f(y)}q${f((r() - .5) * 8)} 20 ${f((r() - .5) * 6)} ${f(26 + r() * 20)}" stroke="#8a4a24" stroke-width="${f(2 + r() * 3)}" opacity=".6" fill="none"/>`); }
    o.push(`<rect width="320" height="200" fill="url(#${id}g)"/></g><path d="${d}" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="2"/>`);
  }
  if (kind === 'karren') {
    sky('#d5dde4', '#a9b39a'); o.push(`<defs>${shade}</defs>`);
    for (let i = 0; i < 40; i++) { const x = r() * 320, y = r() * 60; o.push(`<path d="M${f(x)} ${f(y)}l-3 14" stroke="#7fa7cf" stroke-width="1.6" stroke-linecap="round"/>`); }
    o.push('<path d="M40 172L46 92Q60 70 120 66L220 64Q272 68 282 96L286 172Z" fill="#e2dac8"/>'); specks(240, ['#c9bfa9', '#f4efe2', '#b5ab95'], 46, 70, 236, 100, .6, 1.5);
    for (let i = 0; i < 13; i++) { const x = 58 + i * 17.5 + (r() - .5) * 6; o.push(`<path d="M${f(x)} ${f(72 + r() * 8)}q${f((r() - .5) * 8)} 40 ${f((r() - .5) * 6)} ${f(70 + r() * 25)}" stroke="#9f9480" stroke-width="${f(4 + r() * 3)}" fill="none" stroke-linecap="round"/><path d="M${f(x + 2)} ${f(74 + r() * 8)}q${f((r() - .5) * 8)} 40 ${f((r() - .5) * 6)} ${f(60 + r() * 20)}" stroke="#f6f1e4" stroke-width="1.4" fill="none" opacity=".7"/>`); }
    for (let i = 0; i < 12; i++) { const x = 64 + r() * 200, y = 96 + r() * 66, a = 2.5 + r() * 3.5; o.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(a)}" ry="${f(a * .8)}" fill="#8f846f"/><path d="M${f(x - a)} ${f(y + 1)}a${f(a)} ${f(a * .8)} 0 0 0 ${f(a * 2)} 0" stroke="#f6f1e4" stroke-width="1" fill="none"/>`); }
    o.push('<path d="M40 172L46 92Q60 70 120 66L220 64Q272 68 282 96L286 172Z" fill="url(#' + id + 'g)" stroke="rgba(0,0,0,.35)" stroke-width="2"/>');
  }
  if (kind === 'cave') {
    o.push(`<defs><linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2925"/><stop offset=".7" stop-color="#4a413a"/><stop offset="1" stop-color="#6b5f52"/></linearGradient></defs>`);
    o.push('<rect width="320" height="200" fill="#d8cfbc"/><rect width="320" height="16" fill="#6b4f38"/><rect width="320" height="6" fill="#5d9a3e"/>'); specks(260, ['#c4b9a2', '#ece5d6', '#b5aa92'], 0, 16, 320, 184, .6, 1.6);
    for (const y of [40, 62, 186]) o.push(`<path d="M0 ${y}Q160 ${y + 6} 320 ${y - 3}" stroke="#bfb39a" stroke-width="1.5" fill="none"/>`);
    const cv = 'M18 150Q22 112 58 98Q86 70 132 80Q168 62 218 74Q270 76 296 112Q312 146 286 166Q244 182 170 178Q110 184 66 176Q22 172 18 150Z';
    o.push(`<path d="${cv}" fill="url(#${id}d)"/><path d="${cv}" fill="none" stroke="#a89c84" stroke-width="3"/>`);
    const st = (x, y, L, w, up) => o.push(`<path d="M${f(x - w)} ${f(y)}Q${f(x - w * .3)} ${f(y + (up ? -1 : 1) * L * .7)} ${f(x)} ${f(y + (up ? -1 : 1) * L)}Q${f(x + w * .3)} ${f(y + (up ? -1 : 1) * L * .7)} ${f(x + w)} ${f(y)}Z" fill="${up ? '#c9b994' : '#d9ccb0'}"/>`);
    for (const [x, y, L, w] of [[70, 98, 18, 6], [79, 96, 30, 4], [86, 94, 12, 4], [118, 82, 22, 6], [196, 76, 26, 6], [205, 76, 14, 4], [244, 84, 34, 5], [254, 88, 16, 4], [270, 96, 12, 4]]) st(x, y, L, w, false);
    for (const [x, L, w] of [[92, 14, 7], [200, 18, 8], [246, 12, 7], [262, 20, 8]]) st(x, 176, L, w, true);
    o.push('<path d="M144 74Q150 110 146 140Q140 166 136 178L170 178Q160 160 158 136Q156 104 162 70Z" fill="#cfc0a0"/><path d="M150 80Q154 120 148 176" stroke="#b5a582" stroke-width="2" fill="none"/>');
    o.push('<ellipse cx="216" cy="176" rx="34" ry="4" fill="#5b88b8" opacity=".75"/>');
    for (const [x, y] of [[79, 136], [244, 132]]) o.push(`<path d="M${x} ${y}q-2.5 4 0 6q2.5 -2 0 -6z" fill="#93c5fd"/>`);
  }
  if (kind === 'roots') {
    sky(); o.push(`<defs>${shade}</defs>`);
    const L = 'M30 178L26 120 50 84 110 72 152 80 156 178Z', Rr = 'M168 178L172 78 214 70 270 86 294 124 290 178Z';
    o.push(`<clipPath id="${id}c"><path d="${L}"/><path d="${Rr}"/></clipPath>`); for (const p of [L, Rr]) o.push(`<path d="${p}" fill="#c4b6a8"/>`); o.push(`<g clip-path="url(#${id}c)">`); specks(300, GRAN, 26, 72, 268, 106, .5, 1.3); o.push('</g>');
    for (const p of [L, Rr]) o.push(`<path d="${p}" fill="url(#${id}g)" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`);
    o.push('<path d="M156 178L152 80 168 78 168 178Z" fill="#3a2e26"/>');
    o.push('<g stroke="#6b4a2e" fill="none" stroke-linecap="round"><path d="M162 70V176" stroke-width="12"/><path d="M160 76Q120 70 92 84T52 120" stroke-width="6"/><path d="M164 76Q206 70 232 82T284 124" stroke-width="6"/><path d="M92 84Q78 110 74 150" stroke-width="3.4"/><path d="M232 82Q250 112 252 152" stroke-width="3.4"/></g>');
    o.push('<rect x="155" y="40" width="14" height="38" fill="#6b4a2e"/><circle cx="162" cy="34" r="22" fill="#4f8a36"/><circle cx="143" cy="42" r="15" fill="#5d9a40"/><circle cx="181" cy="40" r="16" fill="#467d31"/>');
  }
  if (kind === 'lichen') {
    sky(); const d = blob(160, 110, 122, 74, 16, .1);
    o.push(`<defs><clipPath id="${id}c"><path d="${d}"/></clipPath>${shade}</defs><g clip-path="url(#${id}c)"><rect width="320" height="200" fill="#a8a29a"/>`); specks(200, ['#8f8a84', '#c2bcb4'], 30, 30, 260, 160, .5, 1.3);
    for (let i = 0; i < 22; i++) { const x = 46 + r() * 228, y = 46 + r() * 120, c = ['#d4b83a', '#d6873a', '#9fb3a0', '#c9c36a', '#e0c060'][i % 5], rr = 8 + r() * 18; o.push(`<path d="${blob(x, y, rr, rr * .8, 16, .25)}" fill="${c}"/><path d="${blob(x, y, rr * .55, rr * .45, 12, .3)}" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1.2"/>`); }
    for (let i = 0; i < 6; i++) { const x = 60 + r() * 200, y = 120 + r() * 50; for (let k = 0; k < 18; k++) o.push(`<circle cx="${f(x + (r() - .5) * 30)}" cy="${f(y + (r() - .5) * 14)}" r="${f(2 + r() * 2.5)}" fill="${k % 2 ? '#4f7a2e' : '#5f8f3a'}"/>`); }
    o.push(`<rect width="320" height="200" fill="url(#${id}g)"/></g><path d="${d}" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="2"/>`);
  }
  if (kind === 'burrow') {
    o.push('<rect width="320" height="200" fill="#5a4030"/><rect width="320" height="26" fill="#cfe6f3"/><rect y="22" width="320" height="8" fill="#5d9a3e"/>'); specks(500, ['#3a281c', '#7a5a40', '#2a1d14', '#8c6a3a'], 0, 30, 320, 170, .6, 1.4);
    for (const [x, y] of [[60, 140], [230, 120], [130, 180]]) o.push(`<path d="${blob(x, y, 12 + r() * 8, 9 + r() * 5, 8, .3)}" fill="#8f8a84"/>`);
    o.push('<g stroke="#8a6a48" stroke-width="10" fill="none" stroke-linecap="round"><path d="M70 30Q76 70 60 96T90 160"/><path d="M220 30Q214 64 240 84T250 150Q252 170 220 176"/><path d="M240 84Q280 92 300 110"/></g>');
    o.push('<path d="M58 112q10 -6 16 4t16 2" stroke="#e39a8a" stroke-width="7" fill="none" stroke-linecap="round"/>');
    for (let i = 0; i < 6; i++) { const x = 228 + i * 6, y = 92 + i * 9; o.push(`<g fill="#111"><circle cx="${x}" cy="${y}" r="2"/><circle cx="${x + 3}" cy="${y + 2}" r="1.6"/><circle cx="${x - 3}" cy="${y - 2}" r="1.5"/></g>`); }
    o.push('<path d="M200 22q20 -14 40 0z" fill="#7a5a40"/>');
  }
  if (kind === 'gravel') {
    o.push('<rect width="320" height="200" fill="#e8e2d6"/>');
    for (let i = 0; i < 46; i++) { const x = 20 + r() * 280, y = 20 + r() * 160, s = 10 + r() * 16; o.push(`<path d="${blob(x, y, s, s * (.6 + r() * .3), 9, .22)}" fill="${['#8f8a84', '#a7a199', '#7a7570', '#bcb5ab', '#6f6a64'][i % 5]}" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>`); }
  }
  if (kind === 'sand') {
    o.push('<rect width="320" height="200" fill="#d9c08e"/>');
    for (let i = 0; i < 520; i++) o.push(`<circle cx="${f(r() * 320)}" cy="${f(r() * 200)}" r="${f(2 + r() * 3)}" fill="${['#b89a63', '#efdcae', '#a08050', '#fff3d6', '#c9a46a'][i % 5]}" stroke="rgba(80,60,30,.25)" stroke-width=".6"/>`);
  }
  if (kind === 'soil') {
    o.push('<rect width="320" height="200" fill="#4c3628"/>'); specks(900, ['#2e2018', '#6d5038', '#3b2a1e', '#8a6a44'], 0, 0, 320, 200, .5, 1.2);
    for (let i = 0; i < 9; i++) o.push(`<path d="${blob(r() * 320, r() * 200, 5 + r() * 6, 4 + r() * 4, 8, .25)}" fill="#9a948c"/>`);
    for (let i = 0; i < 12; i++) { const x = r() * 320, y = r() * 200; o.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(8 + r() * 6)}" ry="${f(4 + r() * 2)}" fill="${['#9a6a2e', '#c08a3a', '#7a5428'][i % 3]}" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`); }
    o.push('<g stroke="#b08a60" stroke-width="1.6" fill="none"><path d="M40 0q6 40 -4 80t8 70"/><path d="M36 80q-14 20 -10 50"/><path d="M250 0q-8 50 6 90"/></g><path d="M120 120q14 -10 26 2t24 0" stroke="#e39a8a" stroke-width="7" fill="none" stroke-linecap="round"/>');
  }
  if (kind === 'profile') {
    const X = 70, Wd = 120, layers = [[18, 54, '#4c3628', '表土'], [54, 96, '#a5764a', '底土'], [96, 140, '#b0a593', '碎石層'], [140, 196, '#9a948c', '基岩']];
    o.push('<rect width="320" height="200" fill="#f8fafc"/>');
    o.push(`<defs><clipPath id="${id}c"><rect x="${X}" y="14" width="${Wd}" height="182" rx="4"/></clipPath></defs><g clip-path="url(#${id}c)">`);
    for (const [a, b, c] of layers) o.push(`<rect x="${X}" y="${a}" width="${Wd}" height="${b - a}" fill="${c}"/>`);
    specks(160, ['#2e2018', '#6d5038'], X, 18, Wd, 36, .5, 1.2); specks(90, ['#8a5e38', '#c0915e', '#8f8a84'], X, 54, Wd, 42, .6, 1.4);
    for (let i = 0; i < 26; i++) o.push(`<path d="${blob(X + r() * Wd, 100 + r() * 38, 4 + r() * 6 * (1 - i / 40), 3 + r() * 4, 6, .3)}" fill="${['#8f8a84', '#a7a199', '#7a7570'][i % 3]}" stroke="rgba(0,0,0,.3)"/>`);
    specks(160, GRAN, X, 140, Wd, 56, .5, 1.2);
    o.push(`<path d="M${X + 30} 196l2 -40M${X + 78} 196l-3 -44M${X + 104} 190l1 -36" stroke="#4a4541" stroke-width="2.2"/><rect x="${X}" y="12" width="${Wd}" height="7" fill="#5d9a3e"/></g>`);
    o.push(`<rect x="${X}" y="14" width="${Wd}" height="182" rx="4" fill="none" stroke="#475569" stroke-width="1.5"/>`);
    for (const [a, b, , name] of layers) { const y = (a + b) / 2; o.push(`<path d="M${X + Wd + 4} ${y}H${X + Wd + 24}" stroke="#64748b" stroke-width="1.5"/><text x="${X + Wd + 30}" y="${y + 5}" font-size="15" font-weight="900" fill="#1f3345">${name}</text>`); }
    o.push(`<path d="M44 30V186M38 176L44 188 50 176" stroke="#94a3b8" stroke-width="2" fill="none"/><text x="30" y="50" font-size="12" font-weight="800" fill="#64748b" writing-mode="tb">越往下越接近岩石</text>`);
  }
  if (kind === 'unload') {                 // 減壓作用：上方岩層被侵蝕後，大片岩石沿著和地表平行的裂縫一層層剝落
    sky('#dbeaf4', '#9cb56c', 190); o.push(`<defs>${shade}</defs>`);
    const arc = (rx, ry, cy = 190) => `M${160 - rx} ${cy}A${rx} ${ry} 0 0 1 ${160 + rx} ${cy}`;
    o.push(`<path d="${arc(158, 172)}" fill="rgba(148,163,184,.18)" stroke="#64748b" stroke-width="2" stroke-dasharray="7 5"/><text x="160" y="36" font-size="12.5" font-weight="900" text-anchor="middle" fill="#475569">原本壓在上面的岩層（已被侵蝕）</text>`);
    o.push(`<clipPath id="${id}c"><path d="${arc(138, 120)}Z"/></clipPath><path d="${arc(138, 120)}Z" fill="#c4b6a8"/><g clip-path="url(#${id}c)">`); specks(380, GRAN, 22, 70, 276, 120, .5, 1.3);
    for (let k = 1; k <= 3; k++) o.push(`<path d="${arc(138 - k * 15, 120 - k * 15)}" fill="none" stroke="#5b4a3c" stroke-width="2.2"/>`);
    o.push(`<rect width="320" height="200" fill="url(#${id}g)"/></g><path d="${arc(138, 120)}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="2"/>`);
    const sector = (dx, dy) => { const P = (rx, ry, a) => `${f(160 + rx * Math.cos(a) + dx)} ${f(190 - ry * Math.sin(a) + dy)}`; let d = ''; for (let i = 0; i <= 10; i++) d += (i ? 'L' : 'M') + P(138, 120, 1.95 + i * .085); for (let i = 10; i >= 0; i--) d += 'L' + P(123, 105, 1.95 + i * .085); return d + 'Z'; };
    o.push(`<path d="${sector(0, 0)}" fill="#4b3f36"/><path d="${sector(-7, -6)}" fill="#cdbfb0" stroke="#5b4a3c" stroke-width="1.6" stroke-linejoin="round"/>`);
    for (const [x, y, a] of [[14, 186, 6], [26, 188, 4], [8, 189, 3.5]]) o.push(`<path d="${blob(x, y, a, a * .7, 7, .3)}" fill="#cdbfb0" stroke="#5b4a3c" stroke-width="1"/>`);
    o.push('<g stroke="#dc2626" stroke-width="3.4" stroke-linecap="round" fill="none"><path d="M160 150V100M150 110L160 100 170 110"/><path d="M110 160L86 124M86 136L86 124 98 128"/><path d="M210 160L234 124M234 136L234 124 222 128"/></g>');
    o.push('<text x="160" y="182" font-size="12.5" font-weight="900" text-anchor="middle" fill="#7f1d1d">壓力變小，向上膨脹</text>');
  }
  if (kind === 'salt') {                   // 鹽結晶作用：海邊岩石的蜂窩狀小洞，放大看是鹽的晶體把小孔撐開
    o.push('<rect width="320" height="200" fill="#cfe6f3"/><rect y="168" width="320" height="32" fill="#3b82c4"/>');
    o.push(`<defs>${shade}<clipPath id="${id}c"><path d="M0 20Q60 8 120 16T210 22L216 172H0Z"/></clipPath></defs><path d="M0 20Q60 8 120 16T210 22L216 172H0Z" fill="#d8b98a"/><g clip-path="url(#${id}c)">`);
    specks(260, ['#c4a274', '#e9d3ab', '#b08d5e'], 0, 10, 216, 162, .5, 1.2);
    const pits = [];                       // 大大小小、擠在一起的蜂窩狀小洞（不重疊、位置隨機）
    for (let t = 0; t < 900 && pits.length < 70; t++) { const a = 4 + r() * r() * 9, x = 6 + r() * 200, y = 28 + r() * 122; if (pits.every(([px, py, pa]) => Math.hypot(px - x, (py - y) * 1.2) > pa + a + 1.4)) pits.push([x, y, a]); }
    for (const [x, y, a] of pits) { o.push(`<path d="${blob(x, y, a, a * .8, 9, .18)}" fill="${a > 7 ? '#6e5030' : '#7f6040'}"/><path d="M${f(x - a)} ${f(y + 1)}a${f(a)} ${f(a * .8)} 0 0 0 ${f(a * 2)} 0" stroke="#f1dfbd" stroke-width="1.3" fill="none"/>`); if (a > 8) o.push(`<ellipse cx="${f(x + a * .2)}" cy="${f(y - a * .1)}" rx="${f(a * .35)}" ry="${f(a * .28)}" fill="#4f3920"/>`); }
    o.push(`<rect width="320" height="200" fill="url(#${id}g)"/></g>`);
    for (let i = 0; i < 26; i++) o.push(`<circle cx="${f(20 + r() * 200)}" cy="${f(150 + r() * 20)}" r="${f(1.5 + r() * 2.5)}" fill="#fff" opacity=".85"/>`);
    o.push('<path d="M0 172q20 -8 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/>');
    o.push(`<path d="M150 70L222 52" stroke="#334155" stroke-width="2" stroke-dasharray="4 3"/><circle cx="262" cy="78" r="50" fill="#e9d3ab" stroke="#334155" stroke-width="3"/><clipPath id="${id}m"><circle cx="262" cy="78" r="48"/></clipPath><g clip-path="url(#${id}m)">`);
    for (const [x, y, rr] of [[230, 50, 17], [262, 38, 15], [296, 52, 17], [222, 86, 16], [302, 92, 17], [240, 120, 17], [282, 122, 17], [262, 60, 4]]) o.push(`<circle cx="${x}" cy="${y}" r="${rr}" fill="#c9a46a" stroke="#8a6a3a" stroke-width="1.4"/>`);
    o.push('<path d="M246 66L278 66 288 86 276 106 248 104 238 86Z" fill="#7a5a36"/>');
    for (const [x, y, s] of [[250, 74, 11], [264, 80, 13], [254, 90, 10], [270, 94, 8]]) o.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#fff" stroke="#94a3b8" stroke-width="1" transform="rotate(${f((r() - .5) * 30)} ${x + s / 2} ${y + s / 2})"/>`);
    o.push('<g stroke="#dc2626" stroke-width="3" stroke-linecap="round" fill="none"><path d="M262 72V58M256 63L262 57 268 63"/><path d="M282 88H296M291 82L297 88 291 94"/><path d="M244 88H230M235 82L229 88 235 94"/></g></g>');
    o.push('<text x="262" y="148" font-size="13" font-weight="900" text-anchor="middle" fill="#1f3345">鹽的晶體撐開小孔</text>');
  }
  if (kind === 'clay') {                   // 水解：花岡岩裡的長石和水起反應變成黏土，石英留下來成為砂
    o.push(`<rect width="320" height="200" fill="#eef2f6"/><rect y="164" width="320" height="36" fill="#cbd5e1"/><defs>${shade}</defs>`);
    const d = blob(80, 112, 62, 50, 14, .1);
    o.push(`<clipPath id="${id}c"><path d="${d}"/></clipPath><path d="${d}" fill="#d9c8b8"/><g clip-path="url(#${id}c)">`); specks(260, GRAN, 18, 60, 124, 104, .7, 1.8);
    for (let i = 0; i < 8; i++) { const x = 40 + r() * 80, y = 74 + r() * 70; o.push(`<path d="${blob(x, y, 7 + r() * 6, 5 + r() * 4, 8, .3)}" fill="#efe6da" opacity=".9"/>`); }
    o.push(`<rect width="320" height="200" fill="url(#${id}g)"/></g><path d="${d}" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="2"/>`);
    o.push('<g stroke="#5b4a3c" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M52 72L62 96 56 118 66 140"/><path d="M104 70L96 92 108 112"/><path d="M62 96L82 102 96 92"/></g>');
    for (let i = 0; i < 12; i++) o.push(`<path d="${blob(30 + r() * 110, 160 + r() * 6, 2 + r() * 4, 1.5 + r() * 3, 7, .3)}" fill="${['#d9c8b8', '#efe6da', '#b8a898'][i % 3]}" stroke="rgba(0,0,0,.3)" stroke-width=".8"/>`);
    for (const [x, y] of [[54, 40], [86, 30], [114, 44]]) o.push(`<path d="M${x} ${y}q-5 8 0 11q5 -3 0 -11z" fill="#3b82f6"/>`);
    o.push('<path d="M152 112H186M178 104L188 112 178 120" stroke="#64748b" stroke-width="4" fill="none" stroke-linecap="round"/><text x="170" y="98" font-size="13" font-weight="900" text-anchor="middle" fill="#0369a1">＋水</text>');
    o.push('<path d="M196 164Q206 104 254 100Q302 104 312 164Z" fill="#ece3d6"/>'); specks(90, ['#d8ccbb', '#f7f2ea', '#c9bca8'], 204, 110, 104, 52, .6, 1.4);
    for (let i = 0; i < 16; i++) { const x = 212 + r() * 86, y = 124 + r() * 36; o.push(`<path d="${blob(x, y, 3 + r() * 3, 2.5 + r() * 2.5, 6, .25)}" fill="#a9b0b8" stroke="#6b7280" stroke-width=".8"/><circle cx="${f(x - 1)}" cy="${f(y - 1)}" r="1" fill="#fff"/>`); }
    o.push('<text x="80" y="186" font-size="13.5" font-weight="900" text-anchor="middle" fill="#1f3345">花岡岩變得鬆軟</text><text x="254" y="186" font-size="13.5" font-weight="900" text-anchor="middle" fill="#1f3345">黏土＋石英砂</text>');
  }
  return `<svg viewBox="0 0 320 200" role="img" aria-label="${kind}">${o.join('')}</svg>`;
}

/* 切小塊、表面積變大：一大塊（邊長 2）表面積 24，切成 8 小塊（邊長 1）共 48 */
function cubeSVG() {
  const o = [], f = n => n.toFixed(1);
  const cube = (x, y, s) => { const dx = s * .87, dy = s * .5;
    o.push(`<path d="M${f(x)} ${f(y - s)}L${f(x + dx)} ${f(y - dy - s)}L${f(x)} ${f(y - 2 * dy - s)}L${f(x - dx)} ${f(y - dy - s)}Z" fill="#d9cabb"/>`,
      `<path d="M${f(x)} ${f(y)}L${f(x - dx)} ${f(y - dy)}L${f(x - dx)} ${f(y - dy - s)}L${f(x)} ${f(y - s)}Z" fill="#a8968a"/>`,
      `<path d="M${f(x)} ${f(y)}L${f(x + dx)} ${f(y - dy)}L${f(x + dx)} ${f(y - dy - s)}L${f(x)} ${f(y - s)}Z" fill="#8c7c6e"/>`);
    o.push(`<path d="M${f(x)} ${f(y)}L${f(x - dx)} ${f(y - dy)}L${f(x - dx)} ${f(y - dy - s)}L${f(x)} ${f(y - 2 * dy - s)}L${f(x + dx)} ${f(y - dy - s)}L${f(x + dx)} ${f(y - dy)}ZM${f(x)} ${f(y)}V${f(y - s)}L${f(x - dx)} ${f(y - dy - s)}M${f(x)} ${f(y - s)}L${f(x + dx)} ${f(y - dy - s)}" fill="none" stroke="#4b3f36" stroke-width="1.3" stroke-linejoin="round"/>`); };
  cube(70, 104, 48);
  const sp = 30, list = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) list.push([i, j, k]);
  list.sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]) || a[2] - b[2]);
  for (const [i, j, k] of list) cube(240 + (i - j) * sp * .87, 108 - (i + j) * sp * .5 - k * sp, 21);
  o.push('<path d="M128 64H160M152 56L162 64 152 72" stroke="#64748b" stroke-width="3.5" fill="none" stroke-linecap="round"/><text x="145" y="48" font-size="12" font-weight="900" text-anchor="middle" fill="#475569">切開</text>');
  o.push('<text x="70" y="128" font-size="13" font-weight="900" text-anchor="middle" fill="#1f3345">一大塊：表面積 24</text><text x="240" y="128" font-size="13" font-weight="900" text-anchor="middle" fill="#1f3345">8 小塊：表面積 48</text>');
  return `<svg viewBox="0 0 320 136" role="img" aria-label="切小塊後表面積變大">${o.join('')}</svg>`;
}

/* 本區認識頁用的小樣式（名詞表、物理／化學小標籤、插圖） */
(function weaCSS() {
  if (document.getElementById('weaCss')) return; const st = document.createElement('style'); st.id = 'weaCss';
  st.textContent = `dl.wterm{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:15px;line-height:1.6}
    dl.wterm dt{font-weight:900;color:#0e7490;white-space:nowrap} dl.wterm dd{margin:0}
    .wbad{display:inline-block;font-size:12.5px;font-weight:800;border-radius:999px;padding:0 8px;margin-left:6px;vertical-align:2px;line-height:1.7}
    .wbad.p{background:#fde7d3;color:#9a3412} .wbad.c{background:#d5f1f5;color:#0e7490}
    .wjust p,.wjust dd,.wjust .tip{text-align:justify;text-justify:inter-character}
    .wfig{margin:6px 0 10px;text-align:center;font-size:14px;color:var(--sub)} .wfig svg{width:100%;max-width:320px;display:block;margin:0 auto 2px}`;
  document.head.appendChild(st);
})();

/* ---------- 探究的觀察活動：砂和土壤，哪一種讓水流得比較快（模擬） ---------- */
function observeSoil(el, done) {
  el.innerHTML = `<div class="sim" style="grid-template-columns:1fr"><figure><figcaption>砂和土壤的透水比較<small>左邊漏斗裝砂，右邊漏斗裝土壤，下面用杯子接水</small></figcaption>
      <canvas width="360" height="250" id="soC" style="aspect-ratio:36/25;max-width:440px;background:#f1f5f9"></canvas><div class="res" id="soT">　</div></figure></div>
    <div class="row"><button class="cta" id="soGo">💧 同時倒水</button></div>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0">兩邊倒入一樣多的水。這是把實驗簡化的模擬動畫。</p>`;
  const g = G.$('#soC').getContext('2d'), W = 360, H = 250, r = U.rng(9), FT = 30, MT = 76, MB = 116, NK = 140, CT = 172, CB = 236;
  const sideOf = (x, name, T, keep, delay, cols, big) => ({ x, name, T, keep, delay, cols, grains: Array.from({ length: big ? 70 : 260 }, () => [x + (r() - .5) * 110, MT + r() * (MB - MT), big ? 2.6 + r() * 2.2 : .8 + r() * 1.3, cols[1 + Math.floor(r() * (cols.length - 1))]]) });
  const S = [sideOf(95, '砂', 3.2, .1, .3, ['#d9c08e', '#b89a63', '#efdcae', '#a08050', '#fff3d6'], true), sideOf(265, '土壤', 10, .4, 1.6, ['#5a4030', '#3a281c', '#7a5a40', '#2a1d14', '#8c6a3a'], false)];
  let raf = 0, t0 = 0, last = 0, told = false;
  const funnel = x => { g.beginPath(); g.moveTo(x - 62, FT); g.lineTo(x + 62, FT); g.lineTo(x + 9, MB + 4); g.lineTo(x + 5, NK); g.lineTo(x - 5, NK); g.lineTo(x - 9, MB + 4); g.closePath(); };
  const reset = () => S.forEach(s => Object.assign(s, { level: 0, wet: 0, cup: 0, out: 0, fin: 0 }));
  const draw = t => {
    g.clearRect(0, 0, W, H); g.fillStyle = '#e2e8f0'; g.fillRect(0, CB, W, H - CB);
    for (const s of S) {
      const x = s.x;
      g.save(); funnel(x); g.clip();
      g.fillStyle = 'rgba(148,163,184,.18)'; g.fillRect(0, 0, W, H);
      g.fillStyle = s.cols[0]; g.fillRect(x - 70, MT, 140, NK - MT);
      for (const [gx, gy, gr, gc] of s.grains) { g.fillStyle = gc; g.beginPath(); g.arc(gx, gy, gr, 0, 7); g.fill(); }
      if (s.wet > 0) { g.fillStyle = `rgba(20,40,90,${.32 * s.wet})`; g.fillRect(x - 70, MT, 140, (NK - MT) * Math.min(1, s.wet * 1.4)); }
      if (s.level > 0) { const top = MT - (MT - FT - 6) * s.level; g.fillStyle = 'rgba(59,130,246,.55)'; g.fillRect(x - 70, top, 140, MT - top); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - 70, top, 140, 2); }
      g.restore();
      funnel(x); g.strokeStyle = '#64748b'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.strokeStyle = '#64748b'; g.beginPath(); g.moveTo(x - 38, CT); g.lineTo(x - 33, CB); g.lineTo(x + 33, CB); g.lineTo(x + 38, CT); g.stroke();
      if (s.cup > 0) { const h = (CB - CT - 8) * s.cup; g.fillStyle = 'rgba(59,130,246,.6)'; g.beginPath(); g.moveTo(x - 33 - 5 * h / (CB - CT), CB - h); g.lineTo(x + 33 + 5 * h / (CB - CT), CB - h); g.lineTo(x + 33, CB); g.lineTo(x - 33, CB); g.closePath(); g.fill(); }
      if (s.out > 0) {                     // 從漏斗流下來的水：砂是一道水柱，土壤是一滴一滴
        g.fillStyle = 'rgba(59,130,246,.8)';
        if (s.out > .5) g.fillRect(x - 2, NK, 4, CB - (CB - CT - 8) * s.cup - NK);
        else for (let k = 0; k < 3; k++) { const y = NK + ((t * 1.1 + k / 3) % 1) * (CB - NK - (CB - CT - 8) * s.cup); g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
      }
      g.fillStyle = '#1f3345'; g.font = '900 16px sans-serif'; g.textAlign = 'center'; g.fillText(s.name, x, 20);
      g.font = '800 12px sans-serif'; g.fillStyle = '#475569'; g.fillText(s.fin ? `流完了（約 ${s.fin.toFixed(0)} 秒）` : '接到的水', x, CB + 13);
    }
    if (t < .9 && t > 0) { g.fillStyle = 'rgba(59,130,246,.7)'; for (const s of S) g.fillRect(s.x - 3, 0, 6, MT - (MT - FT - 6) * Math.min(1, t / .8)); }
  };
  const tick = now => {
    const t = (now - t0) / 1000, dt = Math.min(.05, t - last); last = t;
    for (const s of S) {
      if (t < .8) { s.level = t / .8; continue; }
      const tt = t - .8;
      s.wet = Math.min(1, tt / (s.delay + .6));
      if (tt > s.delay && s.level > 0) { const d = Math.min(s.level, dt / s.T); s.level -= d; s.cup += d * (1 - s.keep); s.out = s.T < 5 ? 1 : .3; }
      if (s.level <= 0 && !s.fin) { s.fin = t; s.out = 0; s.level = 0; }
    }
    draw(t);
    const a = S[0].fin, b = S[1].fin;
    G.$('#soT').textContent = !a ? '倒水了！注意看哪一邊的水先流下來……' : !b ? '砂已經流完了，土壤還在慢慢滴……' : '兩邊都流完了：砂流得快，土壤流得慢，而且土壤留住了比較多的水';
    if (a && b) { G.$('#soGo').disabled = false; G.$('#soGo').textContent = '↻ 再做一次'; if (!told) { told = true; done(); } return; }
    raf = requestAnimationFrame(tick);
  };
  G.$('#soGo').onclick = () => { cancelAnimationFrame(raf); reset(); G.$('#soGo').disabled = true; t0 = performance.now(); last = 0; raf = requestAnimationFrame(tick); };
  reset(); draw(0);
  return () => cancelAnimationFrame(raf);
}

/* ---------- 區域定義 ---------- */
const H0 = (p, dy) => [p[0], height(p[0], p[1]) + dy, p[1]];
const nwEnd = h => h.replace(/([^<>\s]{4})<\/div>/g, '<span class="nw">$1</span></div>');   // 方框最後幾個字不拆行，避免行尾只剩一兩字
const card = (name, en, kind, facts, svg) => ({ name, en, photo: 'img/weather/' + kind + '.jpg', svg: svg || wSVG(kind), facts });
G.registerZone('weather', {
  hint: '這片山坡上的岩石正在慢慢「變碎」。點發光的圓點，看看岩石怎麼變成砂和土壤！',
  build,
  nodes: [
    { id: 'what', num: '1', title: '風化是什麼', en: 'Weathering', color: '#a16207', ready: true, at: H0(SP.what, 2.6),
      cam: { pos: [1.3, 4.9, 8.8], target: [0, height(...SP.what) + .3, 1.3] },
      learn: `
        <h3>堅硬的岩石也會變碎</h3>
        <p>岩石長時間受到日曬、雨淋、溫度改變、風吹和生物的作用，會在<em>原地</em>慢慢碎裂、分解，這種現象叫做<em>風化</em>。</p>
        <p>風化時，碎屑留在原來的地方，沒有被搬走，所以風化是一種<em>靜態</em>的作用。</p>
        <p>看看中間的大岩石：日子一天天過去，它先出現裂縫，裂成石塊，再碎成礫石和砂，最後混入生物遺骸，變成土壤。</p>
        <h3>風化的三種方式</h3>
        <div class="two"><div><b>🌡️ 物理性風化</b>岩石裂開、剝落成小碎塊，成分沒有改變。</div><div><b>🌧️ 化學性風化</b>雨水和空氣讓岩石的成分改變，變成新的物質。</div></div>
        <div class="two"><div><b>🌱 生物性風化</b>樹根、地衣、動物等生物讓岩石碎裂、分解。</div><div><b>🤝 常常一起發生</b>同一塊岩石，常同時受到好幾種風化作用。</div></div>
        <h3>靜態的風化，動態的侵蝕</h3>
        <div class="two"><div><b>🪨 靜態的作用</b>風化：岩石在原地碎裂、分解，碎屑還留在原處。</div><div><b>🌊 動態的作用</b>侵蝕、搬運、堆積：流水、風、海浪把碎屑帶走，搬到別處堆積。</div></div>
        <div class="tip"><b>先風化，再侵蝕：</b>岩石先被風化變碎，碎屑才容易被帶走。動態的作用，到第 5b、5c 區看看。</div>
        <p>風化非常緩慢，常要經過很長很長的時間。這裡的動畫把時間縮短了，到下面各節點看看每一種風化。</p>` },
    { id: 'physical', num: '2', title: '物理性風化', en: 'Physical Weathering', color: '#c2410c', ready: true, at: H0([-4.2, -1.9], 2.4),
      cam: { pos: [-2.4, 3.8, 4.6], target: [-4.3, height(-4.3, -2) + .6, -2] },
      learn: `
        <h3>岩石變小，成分沒有改變</h3>
        <p>物理性風化（也叫機械性風化）只讓岩石裂開、碎成小塊，<em>成分沒有改變</em>，碎片和原來的岩石還是同一種東西。</p>
        <p>岩石會裂開，是因為一再被「撐開」或「拉開」。常見的原理有下面四種。</p>
        <h3>① 熱脹冷縮：洋蔥狀剝落</h3>
        <p>岩石受熱會膨脹、變冷會收縮，叫做<em>熱脹冷縮</em>。岩石不容易傳熱，白天表面熱、裡面還涼，表層漲縮得比內部多。</p>
        <p>日復一日，外層和內部慢慢分開，一片片剝落，像剝洋蔥一樣，叫做洋蔥狀剝落。</p>
        <h3>② 凍融作用（冰楔）</h3>
        <p>雨水流進岩石的裂縫，天冷時結成冰。水結冰後<em>體積會變大</em>，像一根楔子塞進裂縫，把裂縫撐開。</p>
        <p>冰融化後，水又流得更深。這樣一再結冰、融化，叫做<em>凍融作用</em>，裂縫越撐越大，岩石就裂開了。</p>
        <h3>③ 壓力釋放（減壓作用）</h3>
        <p>埋在地底深處的岩石，被上面厚厚的岩層壓著。上面的岩層被侵蝕掉以後，壓力變小，岩石就向上微微膨脹。</p>
        <p>膨脹的岩石會裂出一層層和地表平行的裂縫，再一大片、一大片剝落下來。</p>
        <h3>④ 鹽結晶作用</h3>
        <p>含鹽的水滲進岩石的小孔，水蒸發後，鹽留下來結成晶體。晶體越長越大，把小孔撐開，岩石表面就一粒粒掉落。</p>
        <p>海邊岩石上常見蜂窩狀的小洞，例如野柳的蜂窩岩，鹽結晶作用就是原因之一。</p>
        <div class="tip"><b>看看左後方：</b>圓圓的大岩石隨著日夜冷熱一層層剝落（熱脹冷縮）；旁邊那塊岩石，裂縫裡的水一再結冰，把裂縫越撐越大（凍融作用）。</div>
        <h3>常見特徵與分布</h3>
        <div class="two"><div><b>🏔️ 哪裡最常見</b>寒冷、乾燥，或日夜溫差很大的地方，例如高山和沙漠。</div><div><b>🔗 加快化學性風化</b>岩石碎得越小，碰到空氣和水的表面就越多，化學性風化也進行得越快。</div></div>
        <div class="wfig">${cubeSVG()}同樣大小的岩石，切成 8 小塊，表面積變成 2 倍。</div>
        <p>岩石碎裂的樣子有很多種，到「圖鑑」看看。</p>`,
      cardsIntro: '<p>物理性風化讓岩石碎裂的六種樣子。注意每一張的「原理」：熱脹冷縮、凍融作用、壓力釋放，還是鹽結晶？</p>',
      cards: [
        card('不規則裂痕', 'Cracking', 'crack', [['樣子', '岩石表面出現許多方向不一的裂縫。'], ['原理', '熱脹冷縮：白天變熱膨脹、晚上變冷收縮，一再重複，岩石慢慢裂開。'], ['接下來', '裂縫越來越多、越來越大，岩石碎成大小石塊。']]),
        card('洋蔥狀剝落', 'Exfoliation', 'onion', [['樣子', '岩石外層像洋蔥皮一樣一層層剝落，留下圓圓的岩石。'], ['原理', '熱脹冷縮：岩石不容易傳熱，外層漲縮得比內部多，外層就和內部分開。'], ['常見在', '日夜溫差大的地方；花岡岩等顆粒較粗、整塊的岩石。']]),
        card('結冰撐開裂縫', 'Frost Wedging', 'frost', [['樣子', '岩石沿著裂縫裂成兩半或好幾塊。'], ['原理', '凍融作用（冰楔）：水結冰後體積變大，撐開裂縫；冰融化後水流得更深，一再重複。'], ['常見在', '冬天會結冰的高山或寒冷地區。']]),
        card('層狀剝落', 'Sheeting', 'unload', [['樣子', '大片岩石沿著和地表平行的裂縫，一層層剝落，山頂常變得圓圓的。'], ['原理', '壓力釋放（減壓作用）：上面的岩層被侵蝕後，岩石受到的壓力變小，向上膨脹而裂開。'], ['常見在', '原本在地底深處形成、後來露出地面的大片花岡岩。']]),
        card('蜂窩狀小洞', 'Salt Weathering', 'salt', [['樣子', '岩石表面有許多像蜂窩的小洞，摸起來會掉下細砂。'], ['原理', '鹽結晶作用：鹽水滲進小孔，水蒸發後鹽結成晶體，越長越大，把小孔撐開。'], ['常見在', '常被浪花噴到的海邊岩石，以及乾燥的沙漠。'], ['臺灣哪裡看', '新北市萬里區野柳的海岸，岩石上布滿蜂窩狀的小洞，叫做蜂窩岩。']]),
        card('碎裂成鉛筆狀', 'Pencil Weathering', 'pencil', [['樣子', '岩石碎成一根根細長的碎片，像一枝枝鉛筆。'], ['原理', '頁岩、板岩有一層層的薄層，經過冷熱、乾濕一再變化，就沿著薄層和裂縫碎開。'], ['常見在', '頁岩或板岩分布的山區。']]),
      ] },
    { id: 'chemical', num: '3', title: '化學性風化', en: 'Chemical Weathering', color: '#0e7490', ready: true, at: [SP.chem[0], 5.6, SP.chem[1]],
      cam: { pos: [3.6, 3.9, 4.6], target: [4.8, height(...SP.chem) + 1, -2.4] },
      learn: `
        <h3>岩石的成分改變了</h3>
        <p>雨水和空氣會和岩石裡的成分起變化，變成<em>新的物質</em>，使岩石變色、變得鬆軟，或被溶蝕，這叫做化學性風化。</p>
        <p>和物理性風化最大的不同：物理性風化只讓岩石變小，化學性風化連岩石的<em>成分</em>都改變了。</p>
        <h3>五個化學性風化的名詞</h3>
        <p>依照岩石「怎麼變」，科學家取了五個名字。先聽過就好，重點是看懂岩石發生了什麼變化。</p>
        <dl class="wterm">
          <dt>溶解</dt><dd>岩石裡的成分溶進水裡、被水帶走，就像鹽溶在水裡一樣。</dd>
          <dt>碳酸化</dt><dd>雨水吸收空氣中的二氧化碳，變成帶點酸的水（像汽水），能溶蝕石灰岩。</dd>
          <dt>氧化</dt><dd>含鐵的成分和空氣中的氧結合，就像鐵釘生鏽，岩石變成黃褐、紅褐色。</dd>
          <dt>水合</dt><dd>礦物把水吸進自己裡面，體積變大，岩石變得鬆軟。</dd>
          <dt>水解</dt><dd>礦物和水起變化，變成新的礦物，例如花岡岩裡的長石變成黏土。</dd>
        </dl>
        <h3>岩石變色：氧化</h3>
        <p>有些岩石含有鐵的成分，碰到水和空氣後，表面變成黃褐色或紅褐色，也變得容易碎裂。</p>
        <h3>石灰岩被溶蝕：碳酸化</h3>
        <p>帶點酸的雨水慢慢溶解石灰岩，在表面溶出一道道溝紋和小洞；時間更久，地下還會溶出大洞穴。</p>
        <div class="tip"><b>看看右後方：</b>雨一直下，白色的石灰岩出現了溝紋和小洞（碳酸化）；旁邊灰色的岩石，慢慢長出褐色的「鏽斑」（氧化）。</div>
        <p>溫暖又多雨的地方，化學性風化特別明顯。臺灣就是這樣的地方喔！</p>`,
      cardsIntro: '<p>化學性風化讓岩石改變的四個例子。注意每一張的「原理」是哪一種化學作用。</p>',
      cards: [
        card('岩石變色', 'Rusting', 'rust', [['樣子', '岩石表面出現黃褐色、紅褐色的斑塊。'], ['原理', '氧化：岩石裡含鐵的成分和水、空氣中的氧起變化，就像鐵釘生鏽。'], ['接下來', '變色的部分變得鬆軟，容易剝落、碎裂。']]),
        card('溶溝', 'Karren', 'karren', [['樣子', '石灰岩表面有一道道溝紋和小坑洞。'], ['原理', '碳酸化：雨水吸收二氧化碳，變成帶點酸的水，沿著岩石表面流下，慢慢溶解石灰岩。'], ['臺灣哪裡看', '屏東縣墾丁的石灰岩地區。']]),
        card('石灰岩洞穴', 'Limestone Cave', 'cave', [['樣子', '地下有大大小小的洞穴，洞頂垂下鐘乳石，地上長出石筍。'], ['原理', '碳酸化：帶點酸的雨水和地下水長時間溶蝕石灰岩，形成空洞。'], ['鐘乳石和石筍', '溶在水裡的成分隨著水滴留下來，慢慢堆成鐘乳石和石筍。'], ['臺灣哪裡看', '屏東縣墾丁國家森林遊樂區的石灰岩洞。']]),
        card('長石變成黏土', 'Feldspar to Clay', 'clay', [['樣子', '花岡岩變得鬆鬆軟軟，一捏就碎，露出白色的黏土和亮亮的石英顆粒。'], ['原理', '水解：長石和水起變化，變成黏土；石英不容易起變化，留下來成為砂。'], ['接下來', '黏土和砂成為土壤的一部分。']]),
      ] },
    { id: 'biological', num: '4', title: '生物性風化', en: 'Biological Weathering', color: '#15803d', ready: true, at: H0(SP.bio, 2.9),
      cam: { pos: [-4.6, 2.9, 6.6], target: [-6.2, height(...SP.bio) + .8, 1.6] },
      learn: `
        <h3>生物也會讓岩石變碎</h3>
        <p>生物在岩石上生長、活動，也會讓岩石碎裂或分解，這叫做生物性風化。</p>
        <p>生物破壞岩石有兩種方式：一種是把岩石<em>撐開、弄碎</em>，另一種是讓岩石的<em>成分改變</em>。</p>
        <div class="two"><div><b>🔨 物理性破壞</b>也叫機械性破壞，只把岩石撐開、弄碎，成分不變，例如樹根、動物鑽洞。</div><div><b>🧪 化學性分解</b>生物分泌酸性物質，讓岩石的成分改變，例如地衣、苔蘚和植物的根。</div></div>
        <h3>樹根撐開岩石<span class="wbad p">🔨 物理</span><span class="wbad c">🧪 化學</span></h3>
        <p>種子落進岩石的裂縫，發芽長大。樹根越長越粗，像楔子一樣把裂縫越撐越大；根的尖端還會分泌酸性物質，慢慢分解岩石。</p>
        <h3>地衣和苔蘚<span class="wbad c">🧪 化學</span><span class="wbad p">🔨 物理</span></h3>
        <p>地衣和苔蘚能長在光禿禿的岩石上。它們主要靠分泌酸性物質，讓岩石表面慢慢分解；細細的假根也會鑽進小縫，把岩石撬鬆。</p>
        <h3>動物翻動土壤<span class="wbad p">🔨 物理</span></h3>
        <p>蚯蚓、螞蟻等動物在地下鑽洞，把碎屑翻動、混合，讓空氣和水更容易進入，也間接加快了化學性風化。</p>
        <div class="tip"><b>看看左前方：</b>小樹從岩石的裂縫長出來，根把岩石撐開；岩石表面也慢慢長出一片片地衣和苔蘚。</div>`,
      cardsIntro: '<p>生物讓岩石碎裂、分解的三種方式。注意每一張的「破壞方式」是物理性、化學性，還是兩種都有。</p>',
      cards: [
        card('樹根撐開岩石', 'Root Wedging', 'roots', [['樣子', '樹木從岩石的裂縫長出來，根緊緊抓住岩石。'], ['怎麼發生', '根越長越粗，像楔子一樣把裂縫撐大，最後岩石裂開。'], ['破壞方式', '🔨 物理（機械）性破壞為主；根分泌的酸性物質也會造成 🧪 化學性分解。'], ['常見在', '山坡、岩壁、老舊的石牆和人行道。']]),
        card('地衣與苔蘚', 'Lichens & Mosses', 'lichen', [['樣子', '岩石表面長著一片片黃色、橘色、灰綠色或綠色的斑塊。'], ['怎麼發生', '地衣和苔蘚附著在岩石上，分泌酸性物質，讓岩石表面慢慢分解、鬆動。'], ['破壞方式', '🧪 化學性分解為主；假根鑽進小縫，也有 🔨 物理性破壞。'], ['特別的地方', '它們常是最早長在光禿禿岩石上的生物，留下的遺骸也會變成土壤的一部分。']]),
        card('動物鑽洞', 'Burrowing Animals', 'burrow', [['樣子', '土裡有許多小通道，地面上翻出一堆堆的土。'], ['怎麼發生', '蚯蚓、螞蟻等動物鑽洞，把碎屑翻動、混合，讓水和空氣更容易進入。'], ['破壞方式', '🔨 物理（機械）性破壞；水和空氣進得去，也加快了化學性風化。'], ['特別的地方', '蚯蚓吃進落葉和泥土，排出的糞便讓土壤更肥沃。']]),
      ] },
    { id: 'soil', num: '5', title: '岩石、砂、土壤', en: 'Rock, Sand & Soil', color: '#7c4a1e', ready: true, at: H0(SP.soil, 1.5),
      cam: { pos: [2.6, 1.6, 12], target: [3.2, -.5, 4.4] },
      learn: `
        <h3>越碎越小</h3>
        <p>岩石經過風化，碎成礫石，再碎成更細小的砂和泥。顆粒大小不同，名稱也不同。</p>
        <div class="two"><div><b>🪨 礫石</b>顆粒大，一顆顆看得很清楚。</div><div><b>⏳ 砂</b>顆粒小，摸起來粗粗的。</div></div>
        <div class="two"><div><b>🟫 泥</b>顆粒非常細，摸起來滑滑的，濕了黏黏的。</div><div><b>🌱 土壤</b>岩石碎屑加上生物遺骸，能讓植物生長。</div></div>
        <h3>土壤是怎麼來的？</h3>
        <p>土壤是由岩石風化成的碎屑，加上動植物死後留下的<em>遺骸</em>組成的。土壤裡還有水和空氣。</p>
        <p>生物遺骸被分解後，讓土壤顏色變深、更肥沃；植物長得好，落葉又回到土壤裡。</p>
        <div class="tip"><b>看看模型的正面：</b>由上往下依序是表土、底土、碎石層和基岩。越往下，越接近原來的岩石。</div>
        <p>砂和土壤，哪一種讓水流得比較快？先預測，再用探究活動試試看。</p>`,
      cardsIntro: '<p>比較礫石、砂和土壤的顆粒大小，再看看土壤剖面的四層。</p>',
      cards: [
        card('礫石', 'Gravel', 'gravel', [['顆粒大小', '最大，一顆顆用手就拿得起來。'], ['摸起來', '硬硬的，表面有的粗糙、有的光滑。'], ['水流過', '顆粒間的空隙最大，水一下子就流過去。']]),
        card('砂', 'Sand', 'sand', [['顆粒大小', '小，像砂糖一樣一粒粒的。'], ['摸起來', '粗粗的，乾的時候會從指縫流下去。'], ['水流過', '顆粒間的空隙較大，水很快就流過去，不容易保存水分。']]),
        card('土壤', 'Soil', 'soil', [['組成', '岩石風化成的細小碎屑，加上生物遺骸，還有水和空氣。'], ['摸起來', '細細的，濕的時候能捏成團。'], ['水流過', '顆粒細、空隙小，水流得慢，能保存水分，適合植物生長。']]),
        card('土壤剖面', 'Soil Profile', 'profile', [['表土', '最上層，含有很多生物遺骸，顏色最深。'], ['底土', '顏色較淺，岩石碎屑較多。'], ['碎石層', '岩石剛碎裂成的石塊。'], ['基岩', '最下面，還沒有風化的岩石。']]),
      ],
      poe: {
        question: '把同樣多的水，分別倒進裝了「砂」和「土壤」的漏斗。哪一個漏斗的水會比較快流完？',
        options: ['裝砂的漏斗比較快流完', '裝土壤的漏斗比較快流完', '兩個一樣快'],
        observeIntro: '按下「同時倒水」，觀察兩個漏斗的水<b>流下來的快慢</b>，以及最後杯子裡<b>接到的水量</b>。',
        observe: observeSoil,
        explain: {
          q: '根據剛才的觀察，哪一個說法最能解釋你看到的結果？',
          opts: ['土壤比較重，把水壓住了，所以水流得慢。', '砂的顆粒比較大，顆粒間的空隙大，水容易流過去；土壤的顆粒細，又含有生物遺骸，能把水留住。', '砂的顏色比較淺，所以水流得比較快。'],
          ans: 1,
          hint: '回想兩個漏斗：哪一種的顆粒比較大？顆粒之間「空隙」的大小，會影響水流過的快慢。',
          why: '砂的顆粒大、空隙大，水很快就流過去，留不住水；土壤的顆粒細、空隙小，又有生物遺骸能吸水，所以水流得慢、保留的水分多，適合植物生長。'
        }
      } },
  ].map(n => Object.assign(n, { learn: `<div class="wjust">${nwEnd(n.learn)}</div>` }, n.cards ? { onCards: b => b.querySelectorAll('.rcard').forEach(c => c.classList.add('wjust')) } : {})),
  // 檢核題：level 為 PIRLS 層次（1 提取訊息／2 推論訊息／3 詮釋整合／4 比較評估）
  quiz: [
    { id: 'weather.what.1', about: '風化是什麼', level: 1, q: '根據「風化是什麼」的認識，下列哪一個說法描述的是「風化」？',
      opts: ['岩漿冷卻、凝固變成岩石', '岩石在原地慢慢碎裂、分解', '岩石的碎屑被河水帶到很遠的地方', '泥沙一層層堆積，壓緊變成岩石'], ans: 1,
      why: '風化是岩石受到日曬、雨淋、溫度改變、風和生物的作用，在原地慢慢碎裂、分解，是靜態的作用。碎屑被河水帶走，是動態的侵蝕和搬運。' },
    { id: 'weather.soil.1', about: '岩石、砂、土壤', level: 1, q: '根據「岩石、砂、土壤」的認識和圖鑑，土壤是由哪些東西組成的？',
      opts: ['只有很細的砂', '岩漿冷卻後形成的晶體', '岩石風化成的碎屑，加上生物的遺骸', '海水蒸發後留下的鹽'], ans: 2,
      why: '土壤是由岩石風化成的碎屑，加上動植物死後留下的遺骸組成的，裡面還有水和空氣。' },
    { id: 'weather.physical.1', about: '物理性風化', level: 2, q: '高山上的岩石，冬天裂開的情形常比夏天明顯。根據物理性風化的「認識」，最可能的原因是什麼？',
      opts: ['冬天裂縫裡的水結冰，體積變大，把裂縫撐開', '冬天雨水比較多，把岩石溶解了', '冬天植物長得特別快，樹根撐開岩石', '冬天的岩石比較軟，容易被壓碎'], ans: 0,
      why: '冬天高山氣溫低，流進裂縫的水會結冰。水結冰後體積變大，把裂縫撐開；一再結冰、融化，叫做凍融作用，岩石就裂開了。' },
    { id: 'weather.chemical.1', about: '化學性風化、生物性風化', level: 3, q: '把化學性風化和生物性風化的「認識」放在一起想：墾丁有一塊石灰岩，表面有一道道溝紋，裂縫裡還長出了小樹。哪一個說法最正確？',
      opts: ['溝紋和小樹都是熱脹冷縮造成的', '溝紋是樹根刻出來的，和雨水無關', '這塊岩石已經停止風化，以後不會再改變', '溝紋是雨水溶蝕造成的，樹根會撐開裂縫，兩種風化同時在發生'], ans: 3,
      why: '雨水溶解石灰岩，溶出溝紋，是化學性風化；樹根越長越粗、撐開裂縫，是生物性風化。同一塊岩石，常同時受到好幾種風化作用。' },
    { id: 'weather.soil.2', about: '岩石、砂、土壤', level: 3, q: '小明想在花圃種菜，打算把花圃的土壤全部換成砂。把「岩石、砂、土壤」的探究結果和認識放在一起想，最可能發生什麼事？',
      opts: ['砂比土壤更能保存水分，菜會長得更好', '澆的水很快就流走、留不住，砂裡也缺少生物遺骸，菜比較長不好', '砂和土壤完全一樣，不會有差別', '砂會讓水一直停在表面，花圃整天積水'], ans: 1,
      why: '探究中看到：砂的顆粒大、空隙大，水很快就流過去，留不住水。認識中提到：土壤含有生物遺骸，比較肥沃。所以全部換成砂，菜容易缺水、缺養分。' },
  ]
});
})();
