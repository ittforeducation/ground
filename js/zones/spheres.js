/* 區域 1：地表四圈與地層 —— 一塊有山、河、湖、海、天空與生物的大地，前方切開看地層
   五個節點：岩石圈、水圈、大氣圈、生物圈、地層怎麼來；本區挑戰 5 題 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, { ss, fbm, clamp } = U;

/* ---------- 大地外形：x∈[-11,11]，z∈[-8,6]；西邊是山與平原，東邊是海；前方 z=Z1 是切開的剖面 ---------- */
const X0 = -11, X1 = 11, Z0 = -8, Z1 = 6, YB = -4.6, YT = 2.4;
const coastX = z => 3.4 + .7 * Math.sin(z * .62 + .4) + .3 * Math.sin(z * 1.7 + 1);
const riverZ = x => -1 + .32 * x + .7 * Math.sin(x * .8);
const riverL = x => .1 + .45 * ss(3, -2.2, x) + 1.6 * ss(-3.5, -8, x);        // 河床的高度：從山上往海邊降低
const riverW = x => .16 + .2 * ss(RX0, 3, x);
const RX0 = -7.8, LAKE = [-2.2, riverZ(-2.2)], LK = .55;                    // 河川源頭、湖泊中心、湖面高度
const WX = -4.4;                                                            // 剖面上的水井
function base(x, z) {
  const d = coastX(z) - x;
  let h = .35 + .5 * ss(0, 6, d) - 2.1 * ss(0, 4.5, -d);
  h += 4.4 * Math.exp(-((x + 7) ** 2 / 9 + (z + 4.6) ** 2 / 6)) + 2.6 * Math.exp(-((x + 2.6) ** 2 / 7 + (z + 6.6) ** 2 / 3)) + 1.3 * Math.exp(-((x + 9) ** 2 / 4 + (z - 1.5) ** 2 / 5));
  h += (fbm(x * .45 + 7, z * .45, 4) - .45) * (.25 + 1.1 * ss(.9, 2.2, h)) * ss(-.5, .5, d);
  h += (fbm(x * .8, z * .8, 3) - .5) * .3 * ss(.5, -1.5, d);
  return h;
}
function height(x, z) {
  let h = base(x, z);
  const cx = coastX(z) + 1.2;
  if (x > RX0 - .5 && x < cx) {
    const dr = Math.abs(z - riverZ(x)), wd = riverW(x), w = (1 - ss(wd, wd + .45, dr)) * ss(RX0 - .3, RX0 + .6, x);
    if (w > 0) h += (Math.min(h, riverL(x) - .16) - h) * w;
  }
  const lr = Math.hypot(x - LAKE[0], z - LAKE[1]);
  if (lr < 1.8) h += (Math.min(h, LK - .5 + .35 * ss(0, 1.3, lr)) - h) * (1 - ss(1.1, 1.75, lr));
  return h;
}
const top = x => height(x, Z1);
const soilT = x => top(x) > .05 ? .26 : .15;
const ceil = x => top(x) - soilT(x);
const inField = (x, z) => x > -1.6 && x < 2 && z > 1.4 && z < 5.2 && Math.abs(z - riverZ(x)) > .75;
const inVillage = (x, z) => x > -1.1 && x < 1.4 && z > -4.9 && z < -2.3;

/* ---------- 地表貼圖：逐像素依高度、坡度與用途上色 ---------- */
function groundTexture(S) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const N = S + 1, H = new Float32Array(N * N), dx = (X1 - X0) / S, dz = (Z1 - Z0) / S;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = height(X0 + i * dx, Z0 + j * dz);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const FC = [[150, 196, 92], [206, 196, 110], [126, 170, 160], [128, 182, 84]];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const h = H[j * N + i], sl = Math.hypot((H[j * N + i + 1] - h) / dx, (H[(j + 1) * N + i] - h) / dz), x = X0 + i * dx, z = Z0 + j * dz;
    const dc = coastX(z) - x, dr = Math.abs(z - riverZ(x)), lr = Math.hypot(x - LAKE[0], z - LAKE[1]), n = fbm(x * 1.3, z * 1.3, 3), hs = U.hash(i, j);
    let col;
    if (h < .08 && dc < 2.5) col = mix([220, 202, 154], [108, 122, 118], ss(0, 1.9, -h));
    else if (dc < 1 && h < .7) col = mix([230, 212, 164], [214, 194, 146], n);
    else if ((x > RX0 && x < coastX(z) + 1.2 && dr < riverW(x) + .14) || lr < 1.42) col = mix([160, 148, 126], [128, 120, 106], n);
    else if (inField(x, z)) { const fx = (x + 1.6) / .72, fz = (z - 1.4) / .62; col = (fx % 1 < .07 || fz % 1 < .08) ? [176, 156, 112] : FC[Math.floor(U.hash(Math.floor(fx), Math.floor(fz)) * 4)].slice(); }
    else if (inVillage(x, z)) col = mix([198, 188, 162], [170, 160, 136], n);
    else {
      const t = clamp(fbm(x * .7, z * .7, 3) * 1.6 - .3, 0, 1);
      col = mix([127, 184, 90], [52, 120, 60], clamp(t + ss(.9, 2.4, h) * .5, 0, 1));
      const k = Math.max(ss(.9, 1.6, sl), ss(3.6, 4.6, h)); if (k > 0) col = mix(col, mix([128, 118, 108], [168, 158, 146], ss(4, 5.2, h)), k);
    }
    const q = .94 + .12 * hs; const o = (j * S + i) * 4; d[o] = col[0] * q; d[o + 1] = col[1] * q; d[o + 2] = col[2] * q; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
}

/* 地層：五條分界線、六層。左邊向上拱起（彎曲）；一道斜的裂縫 x = FAULT(y) 把地層切成兩塊，右塊整塊往下錯開（斷裂）。
   地層只隨 x 變化（沿 z 方向延伸），所以四面側牆畫出來的地層在轉角會接得起來 */
const LV = [-.7, -1.35, -2.0, -2.7, -3.4], DROP = .6;
const fold = x => 1.0 * Math.exp(-((x + 7.5) ** 2) / 6);
const FAULT = y => -1.4 + .45 * (y + 2);
const blockOf = (x, y) => x > FAULT(y) ? 1 : 0;
const bY = (k, x, blk) => LV[k] + fold(x) + .08 * Math.sin(x * .5 + k) - (blk ? DROP : 0);
const LCOL = ['#dcc392', '#8e8a84', '#c9a774', '#a69d8f', '#d1cab6', '#9a8a74'];
const GW = [-6.4, 1.9], gwTop = x => ceil(x) - .14, gwBot = x => bY(0, x, blockOf(x, gwTop(x)));   // 地下水（砂層裡）
const ROOTS = [-6.5, -2.9];
/* 四面側牆。沿牆的距離 s∈[0,len]：x = x0 + dx·s，z = zOf(s)；由外面看過去 s 由左往右 */
const WALLS = [
  { id: 'front', len: X1 - X0, x0: X0, dx: 1, zOf: () => Z1, sc: 80, shade: 1 },
  { id: 'left', len: Z1 - Z0, x0: X0, dx: 0, zOf: s => Z0 + s, sc: 56, shade: .84 },
  { id: 'back', len: X1 - X0, x0: X1, dx: -1, zOf: () => Z0, sc: 56, shade: .78 },
  { id: 'right', len: Z1 - Z0, x0: X1, dx: 0, zOf: s => Z1 - s, sc: 56, shade: .9 },
];

/* ---------- 側牆剖面圖：地層、土壤、地下水（正面另加水井、樹根、蚯蚓）。idx 是給發光用的「分層編號圖」 ---------- */
function section(w) {
  const sc = w.sc, Wpx = Math.round(w.len * sc), Hpx = Math.round((YT - YB) * sc), front = w.id === 'front';
  const mk = () => { const c = document.createElement('canvas'); c.width = Wpx; c.height = Hpx; return c; };
  const c = mk(), g = c.getContext('2d'), ic = front ? mk() : null, q = ic && ic.getContext('2d'), r = U.rng(17 + w.len * 3 + w.x0);
  const S = s => s * sc, Y = y => (YT - y) * sc, st = .04, xOf = s => w.x0 + w.dx * s, k80 = sc / 80;
  const tp = s => height(xOf(s), w.zOf(s)), cl = s => { const t = tp(s); return t - (t > .05 ? .26 : .15); };
  const path = (ctx, fU, fL, sa = 0, sb = w.len) => { ctx.beginPath(); for (let s = sa; s <= sb + 1e-6; s += st) ctx.lineTo(S(s), Y(fU(s))); for (let s = sb; s >= sa - 1e-6; s -= st) ctx.lineTo(S(s), Y(Math.min(fL(s), fU(s)))); ctx.closePath(); };
  // 只畫在斷層的某一側（側牆若整面都在同一側，就整面畫或不畫）
  const sl = y => (FAULT(y) - w.x0) / w.dx;
  const clip = (ctx, blk) => {
    if (!w.dx) return blockOf(w.x0, 0) === blk;
    const e = ((w.dx > 0) === (blk === 0)) ? -5 : w.len + 5;
    ctx.beginPath(); ctx.moveTo(S(sl(YT + 1)), Y(YT + 1)); ctx.lineTo(S(sl(YB - 1)), Y(YB - 1)); ctx.lineTo(S(e), Y(YB - 1)); ctx.lineTo(S(e), Y(YT + 1)); ctx.closePath(); ctx.clip(); return true;
  };
  const by = (k, blk) => s => k < 0 ? YT + 1 : k > 4 ? YB - 1 : bY(k, xOf(s), blk);
  const ga = w.dx ? clamp(Math.min((GW[0] - w.x0) / w.dx, (GW[1] - w.x0) / w.dx), 0, w.len) : 0, gb = w.dx ? clamp(Math.max((GW[0] - w.x0) / w.dx, (GW[1] - w.x0) / w.dx), 0, w.len) : 0;
  for (const blk of [0, 1]) for (const ctx of [g, q]) {
    if (!ctx) continue; ctx.save();
    if (clip(ctx, blk)) {
      for (let k = 0; k < 6; k++) { path(ctx, by(k - 1, blk), by(k, blk)); ctx.fillStyle = ctx === g ? LCOL[k] : 'rgb(' + k * 51 + ',0,0)'; ctx.fill(); }
      if (ctx === g) {
        for (let i = 0; i < Wpx * Hpx / 50; i++) { g.fillStyle = r() < .5 ? 'rgba(255,255,255,.11)' : 'rgba(0,0,0,.12)'; g.fillRect(r() * Wpx, r() * Hpx, 1 + r() * 3, 1 + r() * 2); }
        g.lineWidth = 1.1; g.strokeStyle = 'rgba(40,40,45,.25)';                       // 頁岩的細紋
        for (let m = 1; m < 6; m++) { g.beginPath(); for (let s = 0; s <= w.len + 1e-6; s += .1) { const x = xOf(s); g.lineTo(S(s), Y(bY(0, x, blk) + (bY(1, x, blk) - bY(0, x, blk)) * m / 6)); } g.stroke(); }
        for (let i = 0; i < w.len * 12; i++) { const s = r() * w.len, x = xOf(s), y = bY(2, x, blk) + (bY(3, x, blk) - bY(2, x, blk)) * (.15 + .7 * r()); g.fillStyle = ['#6f6a64', '#857f77', '#c2b8a8'][i % 3]; g.beginPath(); g.ellipse(S(s), Y(y), (3 + r() * 6) * k80, (2 + r() * 4) * k80, r() * 3, 0, 7); g.fill(); }
        g.strokeStyle = 'rgba(40,30,25,.45)'; g.lineWidth = 2.4 * k80;
        for (let k = 0; k < 5; k++) { g.beginPath(); for (let s = 0; s <= w.len + 1e-6; s += st) g.lineTo(S(s), Y(bY(k, xOf(s), blk))); g.stroke(); }
      }
      if (gb > ga) {                                   // 地下水：砂層裡的縫隙充滿了水
        ctx.save(); path(ctx, s => cl(s) - .14, by(0, blk), ga, gb); ctx.clip();
        if (ctx === g) { g.fillStyle = 'rgba(60,150,235,.3)'; g.fillRect(0, 0, Wpx, Hpx); for (let i = 0; i < (gb - ga) * 110; i++) { g.fillStyle = r() < .75 ? 'rgba(30,110,220,.7)' : 'rgba(210,235,255,.85)'; g.beginPath(); g.arc(S(ga + r() * (gb - ga)), Y(.9 - r() * 2.4), (1.5 + r() * 2.2) * k80, 0, 7); g.fill(); } }
        else { q.globalCompositeOperation = 'lighter'; q.fillStyle = '#00ff00'; q.fillRect(0, 0, Wpx, Hpx); q.globalCompositeOperation = 'source-over'; }
        ctx.restore();
      }
    }
    ctx.restore();
  }
  if (gb > ga) { g.strokeStyle = 'rgba(20,90,200,.85)'; g.lineWidth = 2.5 * k80; g.setLineDash([10, 6]); g.beginPath(); for (let s = ga; s <= gb; s += st) g.lineTo(S(s), Y(cl(s) - .14)); g.stroke(); g.setLineDash([]); }
  // 斷層線：一條直直的斜線，兩邊的地層都剛好接在線上
  if (w.dx) { g.strokeStyle = 'rgba(35,20,15,.85)'; g.lineWidth = 3.6 * k80; g.setLineDash([14 * k80, 7 * k80]); g.beginPath(); g.moveTo(S(sl(YB)), Y(YB)); g.lineTo(S(sl(1.4)), Y(1.4)); g.stroke(); g.setLineDash([]); }
  // 土壤（陸地）與新堆積的泥（海底）
  path(g, tp, cl); g.fillStyle = '#6b4f38'; g.fill(); if (q) { path(q, tp, cl); q.fillStyle = '#0000ff'; q.fill(); }
  g.save(); path(g, tp, cl); g.clip(); for (let i = 0; i < w.len * 400; i++) { g.fillStyle = r() < .5 ? 'rgba(30,20,10,.25)' : 'rgba(190,160,120,.22)'; g.fillRect(r() * Wpx, r() * Hpx, 1 + r() * 3, 1 + r() * 2); } g.restore();
  for (let s = 0; s < w.len; s += st) { const t = tp(s); if (t < .05) { g.fillStyle = '#a79f91'; g.fillRect(S(s) - 1, Y(t), sc * st + 2, sc * .15); } }
  g.strokeStyle = '#4f8a36'; g.lineWidth = 5 * k80; g.beginPath(); for (let s = 0; s <= w.len; s += st) { const t = tp(s); if (t > .05) g.lineTo(S(s), Y(t) + 2); else g.moveTo(S(s), Y(t)); } g.stroke();
  if (front) {
    const X = x => S(x - X0);
    g.strokeStyle = '#5a3a22'; g.lineCap = 'round';                                     // 樹根
    for (const rx of ROOTS) { const y0 = top(rx); const root = (x, y, a, L, lw, d) => { const x2 = x + Math.cos(a) * L, y2 = y - Math.sin(a) * L; g.lineWidth = lw; g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x2), Y(y2)); g.stroke(); if (d > 0) { root(x2, y2, a - .45 - r() * .3, L * .7, lw * .65, d - 1); root(x2, y2, a + .45 + r() * .3, L * .7, lw * .65, d - 1); } }; root(rx, y0, Math.PI / 2 + .1, .14, 6, 3); root(rx, y0, Math.PI / 2 + .9, .12, 4.5, 2); root(rx, y0, Math.PI / 2 - .8, .12, 4.5, 2); }
    for (const wx of [-8.6, -5.2, .6]) { const y0 = top(wx) - .14; g.strokeStyle = 'rgba(40,25,15,.55)'; g.lineWidth = 8; g.beginPath(); g.moveTo(X(wx - .5), Y(y0 + .09)); g.quadraticCurveTo(X(wx - .1), Y(y0 - .08), X(wx + .35), Y(y0 + .02)); g.stroke();     // 蚯蚓
      g.strokeStyle = '#e59a8c'; g.lineWidth = 5.5; g.beginPath(); for (let k = 0; k <= 12; k++) { const u = k / 12; g.lineTo(X(wx - .1 + u * .38), Y(y0 + .025 * Math.sin(u * 9))); } g.stroke(); }
    const wt = top(WX), wb = (gwTop(WX) + gwBot(WX)) / 2 - .05;                            // 水井：挖到地下水
    g.fillStyle = '#7d7a75'; g.fillRect(X(WX - .14), Y(wt + .1), sc * .28, Y(wb) - Y(wt + .1));
    g.fillStyle = '#2e2b29'; g.fillRect(X(WX - .09), Y(wt + .1), sc * .18, Y(wb) - Y(wt + .1));
    g.fillStyle = '#3b82f6'; g.fillRect(X(WX - .09), Y(gwTop(WX)), sc * .18, Y(wb) - Y(gwTop(WX)));
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  let it = null; if (ic) { it = new THREE.CanvasTexture(ic); it.magFilter = it.minFilter = THREE.NearestFilter; it.generateMipmaps = false; }
  return { tex: t, idx: it };
}
function wallGeo(w) {
  const pos = [], uv = [], idx = []; let n = 0;
  for (let s = 0; s <= w.len + 1e-6; s += .05) { const x = w.x0 + w.dx * s, z = w.zOf(s), y = height(x, z), u = s / w.len; pos.push(x, y, z, x, YB, z); uv.push(u, (y - YB) / (YT - YB), u, 0); n++; }
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); return geo;
}

/* ---------- 建立場景 ---------- */
function build() {
  const T = THREE, scene = new T.Scene(); scene.background = U.skyTexture('#6fb4e8', '#eef2ea'); scene.fog = new T.Fog(0xe6eef0, 70, 160);
  U.addSun(scene, 17); scene.add(U.groundShadow(46, 32, YB - .05));
  const anim = [], picks = [], rnd = U.rng(31), detail = U.detailTexture(9, 6);
  const pick = (o, node) => { o.userData.node = node; picks.push(o); return o; };

  // 地形（陸地與海底）
  const NX = 132, NZ = 84, pos = [], uvs = [], idx = [], hs = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = X0 + i * (X1 - X0) / NX, z = Z0 + j * (Z1 - Z0) / NZ, h = height(x, z); hs.push(h); pos.push(x, h, z); uvs.push(i / NX, j / NZ); }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  const terrMat = new T.MeshStandardMaterial({ map: groundTexture(G.coarse ? 256 : 512), roughness: .95, bumpMap: detail, bumpScale: 2, emissive: 0xff8a3d, emissiveIntensity: 0 });
  scene.add(pick(U.shadowed(new T.Mesh(tg, terrMat)), 'litho'));
  // 四面側牆（同一套地層）。發光用自訂著色器：岩石圈整面泛橘、地層由下往上亮、地下水變藍
  const WU = { uLitho: { value: 0 }, uStep: { value: 0 }, uStrata: { value: 0 }, uHydro: { value: 0 } }, blank = new T.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
  for (const w of WALLS) {
    const { tex, idx: it } = section(w);
    const mat = new T.ShaderMaterial({ side: T.DoubleSide, uniforms: Object.assign({ map: { value: tex }, idx: { value: it || blank }, uShade: { value: w.shade }, uIdx: { value: it ? 1 : 0 } }, WU),
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform sampler2D idx; uniform float uShade, uIdx, uLitho, uStep, uStrata, uHydro; varying vec2 vUv;
        void main(){ vec3 c = texture2D(map, vUv).rgb * uShade; vec4 q = texture2D(idx, vUv);
          float band = floor(q.r * 5.0 + 0.5), lit = step(5.0 - band, uStep) * (1.0 - q.b) * uStrata * uIdx;
          c += vec3(1.0, 0.92, 0.7) * lit * 0.32 + vec3(0.2, 0.6, 1.0) * q.g * uHydro * 0.55 * uIdx + vec3(1.0, 0.45, 0.12) * uLitho * 0.38;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }` });
    scene.add(pick(new T.Mesh(wallGeo(w), mat), w.id === 'front' ? 'strata' : 'litho'));
  }

  // 海（加上「發光」參數，水圈節點時會亮起來）
  const sea = U.seaMaterials(), seaGlow = { value: 0 }, seaClear = { value: 0 };      // seaClear：岩石圈節點時海水變透明，看得到海底
  sea.top.uniforms.uClear = seaClear; sea.wall.uniforms.uClear = seaClear;
  for (const m of [sea.top, sea.wall]) m.fragmentShader = 'uniform float uClear;\n' + m.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.a *= 1.0 - 0.65 * uClear;\n        #include <tonemapping_fragment>');
  sea.top.uniforms.uGlow = seaGlow; sea.top.fragmentShader = 'uniform float uGlow;\n' + sea.top.fragmentShader.replace('gl_FragColor = vec4(toLinear(col), max(', 'col = mix(col, vec3(0.55, 0.92, 1.0), uGlow * 0.6); gl_FragColor = vec4(toLinear(col), max(');
  sea.wall.uniforms.uGlow = seaGlow; sea.wall.fragmentShader = 'uniform float uGlow;\n' + sea.wall.fragmentShader.replace('gl_FragColor = vec4(toLinear(col), 0.8);', 'col = mix(col, vec3(0.5, 0.9, 1.0), uGlow * 0.5); gl_FragColor = vec4(toLinear(col), 0.8);');
  const seaG = U.buildSea(sea, 1.5, X1, Z0, Z1, height, 0, 0, 'ESN'); seaG.children.forEach(m => pick(m, 'hydro')); scene.add(seaG);
  // 河川與湖泊
  const flow = U.detailTexture(1, 6), waterMat = new T.MeshStandardMaterial({ color: 0x3f95d6, roughness: .12, metalness: .15, transparent: true, opacity: .9, bumpMap: flow, bumpScale: 1.2, emissive: 0x7dd3fc, emissiveIntensity: 0 });
  { const pp = [], uu = [], ii = []; let n = 0, len = 0, px = null, pz = null;
    for (let x = RX0; x <= coastX(riverZ(x)) + .9; x += .08) {
      const z = riverZ(x), dz = (riverZ(x + .01) - z) / .01, k = 1 / Math.hypot(1, dz), nx = -dz * k, nz = k, w = riverW(x) * ss(RX0, RX0 + .5, x) + .02, y = Math.max(height(x, z) + .1, .02);
      if (px !== null) len += Math.hypot(x - px, z - pz); px = x; pz = z;
      pp.push(x - nx * w, y, z - nz * w, x + nx * w, y, z + nz * w); uu.push(0, len / 2, 1, len / 2); n++; }
    for (let i = 0; i < n - 1; i++) { const a = i * 2; ii.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(pp, 3)); rg.setAttribute('uv', new T.Float32BufferAttribute(uu, 2)); rg.setIndex(ii); rg.computeVertexNormals();
    const river = new T.Mesh(rg, waterMat); river.receiveShadow = true; scene.add(pick(river, 'hydro')); }
  const lake = new T.Mesh(new T.CircleGeometry(1.36, 40), waterMat); lake.rotation.x = -Math.PI / 2; lake.position.set(LAKE[0], LK, LAKE[1]); lake.receiveShadow = true; scene.add(pick(lake, 'hydro'));
  anim.push((t, dt) => { flow.offset.y -= dt * .5; });

  // 樹（剖面邊上的兩棵，樹根畫在剖面上）
  const trees = ROOTS.map(x => [x, top(x), Z1 - .32, 1.5, 1]);
  for (let k = 0; k < 3000 && trees.length < 175; k++) {
    const x = X0 + .3 + rnd() * 21.4, z = Z0 + .3 + rnd() * 13.3, h = height(x, z), dc = coastX(z) - x;
    if (h < .55 || h > 3.7 || dc < 2.1 || inField(x, z) || inVillage(x, z) || Math.hypot(x - LAKE[0], z - LAKE[1]) < 2.1 || (x > RX0 - .6 && Math.abs(z - riverZ(x)) < riverW(x) + .7) || z > Z1 - .25) continue;
    if (h < 1.6 && fbm(x * .5 + 2, z * .5, 2) < .5) continue;          // 平原上留些空地，樹林成片
    trees.push([x, h, z, .8 + rnd() * .6, h > 2 ? (rnd() < .8 ? 0 : 1) : (rnd() < .35 ? 0 : 1)]);
  }
  const treeG = new T.Group(); U.plantTrees(treeG, trees, rnd, 1); scene.add(treeG);
  const treeMat = treeG.children[0].material; treeMat.emissive = new T.Color(0x4ade80); treeMat.emissiveIntensity = 0; treeG.children.forEach(m => pick(m, 'bio'));
  // 村莊
  const houseGeo = U.merge([[new T.BoxGeometry(.34, .24, .28).translate(0, .12, 0), '#ece6da'], [new T.ConeGeometry(.27, .2, 4).rotateY(Math.PI / 4).translate(0, .34, 0), '#b5523b']]);
  const bioMat = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: .7, emissive: 0x4ade80, emissiveIntensity: 0 }, o));
  const houseMat = bioMat({ vertexColors: true, flatShading: true }), houses = new T.InstancedMesh(houseGeo, houseMat, 9);
  { const M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(1, 1, 1); let k = 0;
    for (const x of [-.6, .1, .8]) for (const z of [-4.4, -3.6, -2.8]) { const xx = x + (rnd() - .5) * .2, zz = z + (rnd() - .5) * .2; Q.setFromAxisAngle(V.set(0, 1, 0), rnd() < .5 ? 0 : Math.PI / 2); M.compose(V.set(xx, height(xx, zz) - .02, zz), Q, S); houses.setMatrixAt(k++, M); } }
  scene.add(pick(U.shadowed(houses), 'bio'));
  // 水井
  { const wz = Z1 - .22, wy = height(WX, wz), stone = new T.MeshStandardMaterial({ color: 0x9a958d, roughness: .9, bumpMap: U.detailTexture(2, 1), bumpScale: 2 });
    const ring = new T.Mesh(new T.CylinderGeometry(.16, .18, .24, 16, 1, true), stone); ring.material.side = T.DoubleSide; ring.position.set(WX, wy + .1, wz); scene.add(U.shadowed(ring));
    const wtr = new T.Mesh(new T.CircleGeometry(.15, 16), waterMat); wtr.rotation.x = -Math.PI / 2; wtr.position.set(WX, wy + .04, wz); scene.add(wtr); }

  // 魚（游在海裡，從前方的水族箱側面看得到）
  const fishGeo = U.merge([[new T.SphereGeometry(.1, 10, 8).scale(1.7, .8, .55), '#ffffff'], [new T.ConeGeometry(.08, .14, 4).rotateZ(Math.PI / 2).scale(1, 1, .3).translate(-.22, 0, 0), '#ffffff']]);
  const fish = new T.InstancedMesh(fishGeo, bioMat({ vertexColors: true, roughness: .4 }), 16), FISH = [];
  { const c = new T.Color(); for (let k = 0; k < 16; k++) { const near = k < 9, cx = 6.6 + rnd() * 3.6, cz = near ? 4.4 + rnd() * .9 : -5 + rnd() * 8; FISH.push({ cx, cz, r: .4 + rnd() * .7, y: -.45 - rnd() * .7, w: (.25 + rnd() * .3) * (rnd() < .5 ? 1 : -1), a: rnd() * 6.3 }); fish.setColorAt(k, c.set(['#f59e0b', '#fde047', '#60a5fa', '#f97316', '#e2e8f0'][k % 5])); } }
  scene.add(pick(fish, 'bio'));
  { const M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(1, 1, 1), up = new T.Vector3(0, 1, 0);
    anim.push(t => { FISH.forEach((f, k) => { const a = f.a + t * f.w, vx = -Math.sin(a) * f.w, vz = Math.cos(a) * f.w; Q.setFromAxisAngle(up, -Math.atan2(vz, vx) + Math.sin(t * 9 + k) * .12); M.compose(V.set(f.cx + Math.cos(a) * f.r, f.y + Math.sin(t * 1.3 + k) * .05, f.cz + Math.sin(a) * f.r * .6), Q, S); fish.setMatrixAt(k, M); }); fish.instanceMatrix.needsUpdate = true; }); }
  // 鳥（在空中盤旋）
  const birdMat = bioMat({ color: 0x3b3f46, side: T.DoubleSide }), wingGeo = new T.BufferGeometry();
  wingGeo.setAttribute('position', new T.Float32BufferAttribute([.07, 0, 0, -.07, 0, 0, -.03, 0, .34], 3)); wingGeo.computeVertexNormals();
  const bodyGeo = new T.SphereGeometry(.05, 8, 6).scale(2.2, .8, .8);
  [[-4, 6.4, -2, 2.2, .35], [-3.2, 6.9, -1.4, 1.4, .45], [3.5, 6.2, 0, 2.6, -.3], [4.4, 6.7, .6, 1.7, -.4], [8, 5.8, -3, 1.9, .38], [-8.4, 7.4, 1, 1.5, -.33]].forEach(([cx, cy, cz, r, w], k) => {
    const b = new T.Group(), R = new T.Mesh(wingGeo, birdMat), L = new T.Mesh(wingGeo, birdMat); L.scale.z = -1; b.add(R, L, new T.Mesh(bodyGeo, birdMat)); b.scale.setScalar(1.25); scene.add(pick(b, 'bio'));
    anim.push(t => { const a = t * w + k * 1.7, vx = -Math.sin(a) * w, vz = Math.cos(a) * w; b.position.set(cx + Math.cos(a) * r, cy + Math.sin(t * .8 + k) * .2, cz + Math.sin(a) * r); b.rotation.set(0, -Math.atan2(vz, vx), -Math.sign(w) * .25); const f = Math.sin(t * 8 + k * 2) * .55 + .1; R.rotation.x = -f; L.rotation.x = f; });
  });

  // 雲與雨
  const clouds = [[-7, 6.6, -4.2, 4.2, true], [2.4, 7.6, -5, 3.4], [7.6, 6.9, -.8, 3]].map(([x, y, z, s, rain], i) => {
    const c = U.cloud(s, s * .36, s * .62, 9, rnd); c.position.set(x, y, z); scene.add(pick(c, 'atmo'));
    if (rain) c.traverse(o => { if (o.isMesh) o.material.color.set(0xc9d1db); });
    anim.push(t => { c.position.x = x + Math.sin(t * .06 + i * 2) * (rain ? .4 : 1.6); }); return c;
  });
  { const N = 80, rp = new Float32Array(N * 6), D = []; for (let k = 0; k < N; k++) { const x = -7 + (rnd() - .5) * 3.2, z = -4.2 + (rnd() - .5) * 2, g0 = height(x, z); D.push([x, z, g0, rnd()]); }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3));
    const rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0xa8d4ff, transparent: true, opacity: .7 })); rain.frustumCulled = false; scene.add(rain);
    anim.push(t => { D.forEach(([x, z, g0, ph], k) => { const H0 = 6, y = g0 + ((H0 - g0) * (1 - ((t * .55 + ph) % 1))); rp.set([x, y, z, x - .03, y + .32, z], k * 6); }); rg.attributes.position.needsUpdate = true; }); }

  // 大氣圈：包住整塊大地的透明罩，加上「越高越稀疏」的空氣小點
  const domeU = { value: 0 }, dome = new T.Mesh(new T.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uA: domeU },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(vec3(0.35, 0.68, 1.0) * (0.2 + 1.1 * f) * uA, 1.0); }' }));
  dome.scale.set(15.5, 10.5, 11.5); dome.position.set(0, YB + 4.4, -1); dome.renderOrder = 8; scene.add(dome);
  const NA = G.coarse ? 500 : 800, ap = new Float32Array(NA * 3);
  for (let k = 0, n = 0; n < NA && k < 20000; k++) { const x = X0 + rnd() * 22, z = Z0 + rnd() * 14, y = -Math.log(1 - rnd() * .985) * 2.1; if (y > 10.5 || y < Math.max(0, height(x, z)) + .15) continue; ap.set([x, y, z], n * 3); n++; }
  const airMat = new T.PointsMaterial({ color: 0x2f7fe0, size: .13, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), air = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(ap, 3)), airMat); scene.add(air);
  anim.push(t => { air.position.set(Math.sin(t * .4) * .12, Math.sin(t * .7) * .05, Math.cos(t * .3) * .1); });
  // 生物圈的範圍：從海底到鳥飛的高空
  const bc = document.createElement('canvas'); bc.width = 64; bc.height = 512; { const g = bc.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, 'rgba(74,222,128,.15)'); gr.addColorStop(.5, 'rgba(34,197,94,.95)'); gr.addColorStop(1, 'rgba(74,222,128,.15)'); g.fillStyle = gr; g.fillRect(18, 22, 28, 468);
    g.fillStyle = '#16a34a'; g.beginPath(); g.moveTo(32, 0); g.lineTo(60, 30); g.lineTo(4, 30); g.fill(); g.beginPath(); g.moveTo(32, 512); g.lineTo(60, 482); g.lineTo(4, 482); g.fill(); }
  const barMat = new T.MeshBasicMaterial({ map: new T.CanvasTexture(bc), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), bar = new T.Mesh(new T.PlaneGeometry(.5, 9.6), barMat); bar.position.set(X0 - .45, 2.9, Z1); scene.add(bar);
  // 海底慢慢堆積的泥沙
  const sedMat = new T.MeshBasicMaterial({ color: 0xb89a66, toneMapped: false }), sedGeo = new T.SphereGeometry(.045, 6, 5);
  for (let k = 0; k < 18; k++) { const m = new T.Mesh(sedGeo, sedMat), x = 4.6 + U.hash(k, 3) * 5.8, b = top(x); scene.add(m); anim.push(t => { const u = (t * .08 + U.hash(k, 7)) % 1; m.position.set(x + .08 * Math.sin(t * 2 + k), -.05 + (b + .05) * u, Z1 - .08); }); }

  /* 節點圓點與解說標籤 */
  const z = G.zones.spheres, def = G.zoneDef('spheres');
  for (const n of z.nodes) G.addLabel(`<b>${n.num}</b><span>${n.title}</span>`, 'node' + (n.ready ? '' : ' soon'), n.at, { color: n.color || def.color, onClick: () => G.openNode(n.id) });
  const F = Z1 + .05, tags = { litho: [
    G.addLabel('陸地<small>高山、平原都是岩石圈</small>', 'tag', [-9.4, 3.6, -2.4]),
    G.addLabel('海底<small>被海水蓋住的，也是岩石圈</small>', 'tag', [8.8, -1.45, F]),
    G.addLabel('地表下的岩石<small>堅硬的岩層一層疊一層</small>', 'tag', [3.2, -2.8, F]),
    G.addLabel('土壤<small>岩石碎屑加上生物遺骸</small>', 'tag', [-1.6, .45, F]),
  ], hydro: [
    G.addLabel('海洋<small>地球上大部分的水</small>', 'tag', [8, .6, -3.4]),
    G.addLabel('河川<small>從山上流向大海</small>', 'tag', [1.7, height(1.7, riverZ(1.7)) + .5, riverZ(1.7)]),
    G.addLabel('湖泊<small>陸地上積水的地方</small>', 'tag', [LAKE[0], LK + .5, LAKE[1]]),
    G.addLabel('地下水<small>藏在土壤和岩石的縫隙裡</small>', 'tag', [-1.6, gwTop(-1.6) - .3, F]),
    G.addLabel('雲和雨<small>空氣中也有水</small>', 'tag', [-7, 5.3, -2.3]),
  ], atmo: [
    G.addLabel('大氣圈<small>空氣包圍著整個地球</small>', 'tag', [0, 10.4, -1]),
    G.addLabel('越往高處<small>空氣越稀薄</small>', 'tag', [-9.6, 7.6, 1]),
    G.addLabel('天氣<small>雲、風、雨都在這裡發生</small>', 'tag', [7.6, 8.3, -.8]),
  ], bio: [
    G.addLabel('鳥<small>在空中飛</small>', 'tag', [4.2, 7.4, .6]),
    G.addLabel('魚<small>在海裡游</small>', 'tag', [8.2, -1, F]),
    G.addLabel('森林<small>根在土裡、枝葉在空氣中</small>', 'tag', [-8.3, height(-8.3, -1.2) + 1.2, -1.2]),
    G.addLabel('蚯蚓<small>住在土壤裡</small>', 'tag', [-5.2, top(-5.2) - .45, F]),
    G.addLabel('人類<small>也是生物圈的一員</small>', 'tag', [.1, height(.1, -3.6) + .95, -3.6]),
    G.addLabel('生物圈的範圍<small>從海底到高空</small>', 'tag', [X0 - .45, 8.1, Z1]),
  ], strata: [
    G.addLabel('最上面<small>最晚堆積，最新</small>', 'tag', [1.1, -.75, F]),
    G.addLabel('最下面<small>最早堆積，最老</small>', 'tag', [4.2, -4.1, F]),
    G.addLabel('彎曲的地層<small>受到擠壓而拱起</small>', 'tag', [-7.5, -1.5, F]),
    G.addLabel('斷裂的地層<small>裂開後兩邊錯開</small>', 'tag', [-.6, -2.35, F]),
    G.addLabel('海底<small>泥沙正一層層堆積</small>', 'tag', [7, -.75, F]),
  ] };

  /* 點亮各圈：節點開啟時，那一圈會發光 */
  const gl = { litho: 0, hydro: 0, atmo: 0, bio: 0, strata: 0 }; let cur = null, hot = null;
  const pickAt = ray => { if (!ray) return null; for (const h of ray.intersectObjects(picks, true)) { let o = h.object; while (o && !o.userData.node) o = o.parent; if (o) return o.userData.node; } return null; };
  return {
    scene, home: { pos: [3, 10.5, 27], target: [0, .6, -.5] },
    view: { minDist: 6, maxDist: 60, maxPolar: Math.PI * .5, pan: { x: [-11, 11], y: [YB, 8], z: [Z0, Z1] } },
    onNode: id => { cur = id; for (const k in tags) tags[k].forEach(L => L.el.classList.toggle('show', k === id)); },
    onHover: ray => { const n = pickAt(ray); if (n !== hot) { hot = n; G.canvas.style.cursor = n ? 'pointer' : ''; } },
    onTap: ray => { const n = pickAt(ray); if (n && n !== G.state.nodeId) G.openNode(n); },
    update(dt, t) {
      for (const k in gl) gl[k] += ((cur === k ? 1 : 0) - gl[k]) * Math.min(1, dt * 4);
      const p = .6 + .4 * Math.sin(t * 3);
      terrMat.emissiveIntensity = gl.litho * .4 * p; WU.uLitho.value = gl.litho * p; seaClear.value = gl.litho;
      seaGlow.value = gl.hydro * p; waterMat.emissiveIntensity = gl.hydro * .7 * p; WU.uHydro.value = gl.hydro * p;
      domeU.value = gl.atmo; dome.visible = gl.atmo > .01; airMat.opacity = gl.atmo * .9; air.visible = gl.atmo > .01;
      treeMat.emissiveIntensity = gl.bio * .35 * p; houseMat.emissiveIntensity = fish.material.emissiveIntensity = birdMat.emissiveIntensity = gl.bio * .5 * p; barMat.opacity = gl.bio;
      const step = Math.floor(t * 1.2) % 9;                       // 地層由下往上一層層亮起
      WU.uStep.value = step; WU.uStrata.value = gl.strata * (step > 6 ? .5 : 1);
      for (const f of anim) f(t, dt);
    },
    dispose() { U.dispose(scene); G.canvas.style.cursor = ''; }
  };
}

/* ---------- 小插圖（SVG）：沒有實景照片時顯示 ---------- */
function picSVG(kind) {
  const r = U.rng(kind.length * 13 + kind.charCodeAt(0)), o = [], f = n => n.toFixed(1);
  const sky = (a = '#9fd3f3', b = '#e9f5fb') => o.push(`<defs><linearGradient id="sk_${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="200" fill="url(#sk_${kind})"/>`);
  const cloud = (x, y, s, c = '#fff') => o.push(`<g fill="${c}"><ellipse cx="${x}" cy="${y}" rx="${34 * s}" ry="${13 * s}"/><circle cx="${x - 12 * s}" cy="${y - 8 * s}" r="${14 * s}"/><circle cx="${x + 10 * s}" cy="${y - 12 * s}" r="${17 * s}"/></g>`);
  const hills = (y, c) => { let d = `M0 200V${y}`; for (let x = 0; x <= 320; x += 20) d += `L${x} ${f(y - 18 * Math.sin(x * .02 + 1) - 8 * Math.sin(x * .07))}`; o.push(`<path d="${d}V200Z" fill="${c}"/>`); };
  const bandsSVG = (fy, cols) => { for (let k = 0; k < cols.length; k++) { let d = 'M0 ' + f(fy(0, k)); for (let x = 10; x <= 320; x += 10) d += `L${x} ${f(fy(x, k))}`; o.push(`<path d="${d}V220H0Z" fill="${cols[k]}" stroke="rgba(40,30,25,.4)" stroke-width="1.5"/>`); } };
  const SOIL = ['#dcc392', '#8e8a84', '#c9a774', '#a69d8f', '#d1cab6', '#9a8a74'];
  if (kind === 'ocean') { sky(); o.push('<circle cx="262" cy="44" r="20" fill="#ffe08a"/>'); cloud(90, 50, 1); o.push('<rect y="100" width="320" height="100" fill="#2f7fc1"/>'); for (let i = 0; i < 26; i++) { const x = r() * 300, y = 108 + r() * 88; o.push(`<path d="M${f(x)} ${f(y)}q8 -5 16 0t16 0" stroke="#bfe3ff" stroke-width="2" fill="none" opacity=".8"/>`); } }
  if (kind === 'river') { sky(); hills(92, '#8cc06a'); hills(122, '#6faa52'); o.push('<path d="M150 104C120 120 196 132 150 150S60 172 110 200" stroke="#3f95d6" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M150 104C120 120 196 132 150 150S60 172 110 200" stroke="#bfe3ff" stroke-width="3" fill="none" stroke-dasharray="6 10" opacity=".8"/>'); }
  if (kind === 'lake') { sky(); o.push('<path d="M0 120L70 52 120 96 170 40 240 104 280 70 320 110V200H0Z" fill="#6d8f6a"/><path d="M0 132L320 128V200H0Z" fill="#7fb85a"/><ellipse cx="160" cy="156" rx="118" ry="30" fill="#3f95d6"/><ellipse cx="160" cy="152" rx="80" ry="12" fill="#8fc8f0" opacity=".5"/>'); }
  if (kind === 'ground') { o.push('<rect width="320" height="60" fill="#bfe3f5"/>'); for (let i = 0; i < 9; i++) o.push(`<path d="M${30 + i * 34} 8l-6 22" stroke="#4f9ad8" stroke-width="3" stroke-linecap="round"/>`); o.push('<rect y="56" width="320" height="30" fill="#6b4f38"/><rect y="52" width="320" height="6" fill="#4f8a36"/><rect y="86" width="320" height="60" fill="#dcc392"/><rect y="146" width="320" height="54" fill="#8e8a84"/>'); for (let i = 0; i < 160; i++) o.push(`<circle cx="${f(r() * 320)}" cy="${f(100 + r() * 44)}" r="${f(1.5 + r() * 2)}" fill="${r() < .6 ? '#2f7fd6' : '#dbeeff'}"/>`); o.push('<rect x="226" y="40" width="22" height="88" fill="#7d7a75"/><rect x="231" y="40" width="12" height="88" fill="#2e2b29"/><rect x="231" y="98" width="12" height="30" fill="#3b82f6"/><path d="M0 98H320" stroke="#1d6fd1" stroke-width="2" stroke-dasharray="8 5"/>'); }
  if (kind === 'cloud') { sky('#8fb4d6', '#dfeaf3'); cloud(150, 70, 2.1, '#e7ecf1'); for (let i = 0; i < 26; i++) { const x = 70 + r() * 160, y = 100 + r() * 70; o.push(`<path d="M${f(x)} ${f(y)}l-4 14" stroke="#4f9ad8" stroke-width="2.5" stroke-linecap="round"/>`); } hills(182, '#7fb85a'); }
  if (kind === 'bird') { sky(); cloud(240, 60, 1.2); for (const [x, y, s] of [[90, 80, 1.4], [150, 60, 1], [126, 116, .8], [200, 100, 1.1]]) o.push(`<path d="M${x - 24 * s} ${y - 6 * s}Q${x - 10 * s} ${y - 16 * s} ${x} ${y}Q${x + 10 * s} ${y - 16 * s} ${x + 24 * s} ${y - 6 * s}Q${x + 10 * s} ${y - 8 * s} ${x} ${y + 4 * s}Q${x - 10 * s} ${y - 8 * s} ${x - 24 * s} ${y - 6 * s}Z" fill="#3b3f46"/>`); hills(190, '#7fb85a'); }
  if (kind === 'fish') { o.push('<defs><linearGradient id="fw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb4e6"/><stop offset="1" stop-color="#14527f"/></linearGradient></defs><rect width="320" height="200" fill="url(#fw)"/><path d="M0 186Q160 170 320 188V200H0Z" fill="#cdb98a"/>'); for (const x of [40, 64, 276]) o.push(`<path d="M${x} 190Q${x - 12} 150 ${x + 4} 120Q${x + 14} 96 ${x} 70" stroke="#3f8a45" stroke-width="5" fill="none"/>`); for (const [x, y, s, c] of [[120, 80, 1.3, '#f59e0b'], [200, 120, 1, '#fde047'], [170, 56, .8, '#f97316'], [236, 70, .9, '#e2e8f0']]) o.push(`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-30 0L-44 -12V12Z" fill="${c}"/><ellipse rx="30" ry="14" fill="${c}"/><circle cx="16" cy="-3" r="3" fill="#1f2937"/></g>`); for (let i = 0; i < 10; i++) o.push(`<circle cx="${f(100 + r() * 160)}" cy="${f(20 + r() * 60)}" r="${f(2 + r() * 3)}" fill="none" stroke="#dbeeff" stroke-width="1.5"/>`); }
  if (kind === 'worm') { o.push('<rect width="320" height="40" fill="#bfe3f5"/><rect y="34" width="320" height="10" fill="#4f8a36"/><rect y="42" width="320" height="158" fill="#6b4f38"/>'); for (let i = 0; i < 300; i++) o.push(`<circle cx="${f(r() * 320)}" cy="${f(46 + r() * 152)}" r="${f(.8 + r() * 1.6)}" fill="${r() < .5 ? '#4e3826' : '#8a6a4d'}"/>`); o.push('<path d="M60 60Q120 90 100 130T170 180" stroke="#3e2b1c" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M110 120Q140 150 190 142Q240 134 262 160" stroke="#e59a8c" stroke-width="12" fill="none" stroke-linecap="round"/>'); for (let k = 0; k < 8; k++) o.push(`<path d="M${132 + k * 16} ${f(140 + 6 * Math.sin(k))}v8" stroke="#c97a6d" stroke-width="2"/>`); }
  if (kind === 'tree') { o.push('<rect width="320" height="112" fill="#bfe3f5"/><rect y="108" width="320" height="8" fill="#4f8a36"/><rect y="114" width="320" height="86" fill="#6b4f38"/><rect x="152" y="62" width="16" height="54" fill="#6b4426"/><circle cx="160" cy="48" r="38" fill="#4f8a36"/><circle cx="132" cy="62" r="24" fill="#5d9a40"/><circle cx="188" cy="62" r="24" fill="#467d31"/><g stroke="#5a3a22" stroke-linecap="round" fill="none"><path d="M160 114V170M160 130L126 162M160 130L196 160M160 150L140 186M160 150L184 188" stroke-width="5"/></g><text x="12" y="24" font-size="15" font-weight="900" fill="#1f3345">空氣中：葉子</text><text x="12" y="190" font-size="15" font-weight="900" fill="#fff">土壤中：根</text>'); }
  if (kind === 'layers') bandsSVG((x, k) => 20 + k * 32 + 3 * Math.sin(x * .03 + k), SOIL);
  if (kind === 'fold') bandsSVG((x, k) => 26 + k * 30 - 46 * Math.exp(-((x - 160) ** 2) / 5000), SOIL);
  if (kind === 'fault') { o.push('<defs><clipPath id="fcL"><path d="M0 0H216L150 220H0Z"/></clipPath><clipPath id="fcR"><path d="M216 0H320V220H150Z"/></clipPath></defs><g clip-path="url(#fcL)">'); bandsSVG((x, k) => 20 + k * 32, SOIL); o.push('</g><g clip-path="url(#fcR)">'); bandsSVG((x, k) => 46 + k * 32, SOIL); o.push('</g><path d="M210 20L150 220" stroke="#2b1a12" stroke-width="4" stroke-dasharray="12 6"/><g stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"><path d="M160 150L172 110M172 110l-8 6M172 110l5 9"/><path d="M198 90L186 130M186 130l8 -6M186 130l-5 -9"/></g>'); }
  return `<svg viewBox="0 0 320 200" role="img" aria-label="${kind}">${o.join('')}</svg>`;
}
/* 比例長條圖：[名稱, 百分比, 顏色]… */
function barSVG(title, parts, note) {
  let x = 10; const W = 320;
  const seg = parts.map(([name, pct, c]) => { const w = Math.max(W * pct / 100, 3), s = `<rect x="${x.toFixed(1)}" y="30" width="${w.toFixed(1)}" height="30" fill="${c}"/>` + (pct > 15 ? `<text x="${(x + w / 2).toFixed(1)}" y="51" font-size="${pct < 30 ? 12 : 14}" font-weight="900" text-anchor="middle" fill="#1f3345">${name}${pct < 30 ? ' ' : ' 約 '}${pct}%</text>` : ''); x += w; return s; }).join('');
  const small = parts.filter(p => p[1] <= 15).map(([name, pct], i) => `<text x="330" y="${82 + i * 18}" font-size="13" font-weight="800" text-anchor="end" fill="#334155">${name} 約 ${pct}%</text>`).join('');
  return `<svg viewBox="0 0 340 ${88 + 18 * parts.filter(p => p[1] <= 15).length}" role="img" aria-label="${title}" style="width:100%;height:auto;display:block;margin:8px 0;background:#fff;border:1px solid var(--line);border-radius:12px">
    <text x="10" y="20" font-size="14" font-weight="900" fill="#1f3345">${title}</text>${seg}<rect x="10" y="30" width="${W}" height="30" fill="none" stroke="#64748b" stroke-width="1.5"/>${small}${note ? `<text x="10" y="82" font-size="12" fill="#55687a">${note}</text>` : ''}</svg>`;
}

/* ---------- 探究的觀察活動：沉積瓶（大小顆粒混合後靜置） ---------- */
function observeJar(el, done) {
  el.innerHTML = `<div class="sim" style="grid-template-columns:1fr"><figure><figcaption>沉積瓶<small>礫石（灰色大顆）、砂（黃色）、泥（褐色小顆）加水混合</small></figcaption>
      <canvas width="360" height="260" id="jC" style="aspect-ratio:36/26;max-width:440px;background:#f4f8fb"></canvas><div class="res" id="jT">按「搖一搖」，再靜置觀察</div></figure></div>
    <div class="row"><button class="cta" id="jGo">🫙 搖一搖，靜置</button><button class="cta ghost" id="jMore" disabled>➕ 再倒入一次泥沙</button></div>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0">真實的細泥要很久才會沉完，這裡把時間縮短了。看完一次後，也可以再倒入一次泥沙，看看新的一層會在哪裡。</p>`;
  const cv = G.$('#jC'), g = cv.getContext('2d'), W = 360, H = 260, JX0 = 112, JX1 = 248, JB = 236, WT = 52, BW = 2, NB = (JX1 - JX0) / BW;
  const KIND = { gravel: { r: [5.5, 7.5], c: ['#7d7f86', '#9a9ca3', '#6b6d74'], n: 26, name: '礫石' }, sand: { r: [2.2, 2.9], c: ['#e0c27a', '#d4b066', '#ecd59a'], n: 230, name: '砂' }, mud: { r: [1.3, 1.6], c: ['#8a6a4a', '#9c7b58', '#7a5c40'], n: 720, name: '泥' } };
  let P = [], floor, raf = 0, last = 0, phase = 'idle', shake = 0, pours = 0, told = false, rnd = U.rng(5), marks = [];
  const reset = () => { P = []; floor = new Float32Array(NB).fill(JB); marks = []; pours = 0; B.length = 0; };
  const pour = (scale, y0, y1) => { pours++; B[pours] = { s: avg() }; for (const k in KIND) { const K = KIND[k]; for (let i = 0; i < Math.round(K.n * scale); i++) { const r = K.r[0] + rnd() * (K.r[1] - K.r[0]); P.push({ k, r, c: K.c[i % 3], x: JX0 + r + rnd() * (JX1 - JX0 - 2 * r), y: y0 + rnd() * (y1 - y0), v: (10 + 6.5 * r * r) * (k === 'mud' ? 1.4 : 1), s: false, pour: pours }); } } };
    const draw = () => {
    g.clearRect(0, 0, W, H); g.save(); g.translate(Math.sin(shake * 40) * 6 * Math.min(1, shake * 3), 0);
    const susp = P.filter(p => !p.s && p.k === 'mud').length / Math.max(1, P.filter(p => p.k === 'mud').length);
    g.fillStyle = '#d9eef9'; g.fillRect(JX0, WT, JX1 - JX0, JB - WT); g.fillStyle = `rgba(150,112,72,${(.6 * susp).toFixed(3)})`; g.fillRect(JX0, WT, JX1 - JX0, JB - WT);
    for (const p of P) { g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(80,120,150,.9)'; g.lineWidth = 4; g.beginPath(); g.moveTo(JX0 - 2, 26); g.lineTo(JX0 - 2, JB + 2); g.lineTo(JX1 + 2, JB + 2); g.lineTo(JX1 + 2, 26); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(JX0 + 6, WT + 6, 8, JB - WT - 14); g.strokeStyle = 'rgba(40,110,180,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(JX0, WT); g.lineTo(JX1, WT); g.stroke();
    g.restore();
    g.font = '900 13px sans-serif'; g.textBaseline = 'middle';
    for (const m of marks) { g.fillStyle = m.c; g.strokeStyle = m.c; g.lineWidth = 2; g.textAlign = m.side > 0 ? 'left' : 'right'; const x = m.side > 0 ? JX1 + 10 : JX0 - 10;
      g.beginPath(); g.moveTo(x, m.y0); g.lineTo(x + 5 * m.side, m.y0); g.lineTo(x + 5 * m.side, m.y1); g.lineTo(x, m.y1); g.stroke(); g.fillText(m.t, x + 10 * m.side, (m.y0 + m.y1) / 2); }
  };
  const avg = () => floor.reduce((q, v) => q + v, 0) / NB, B = [];
  const label = () => {      // 沉完後，在瓶子旁標出每一層（依每種顆粒沉完時的底面高度）
    marks = [];
    B.forEach((b, i) => { if (!b || b.m == null) return;
      if (i === 1) [['礫石', b.s, b.g], ['砂', b.g, b.sa], ['泥', b.sa, b.m]].forEach(([t, y0, y1]) => marks.push({ side: 1, y0: y0 - 1, y1: y1 + 1, t, c: '#334155' }));
      marks.push({ side: -1, y0: b.s - 1, y1: b.m + 1, t: `第 ${i} 次`, c: i === 1 ? '#2563eb' : '#dc2626' }); });
  };
  const tick = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (phase === 'shake') { shake += dt; for (const p of P) { p.x = clamp(p.x + (rnd() - .5) * 6, JX0 + p.r, JX1 - p.r); p.y = clamp(p.y + (rnd() - .5) * 6, WT + p.r, JB - p.r - 4); } if (shake > .8) { phase = 'settle'; shake = 0; } }
    else if (phase === 'settle') {
      const gDone = !P.some(p => !p.s && p.k === 'gravel'), sDone = gDone && !P.some(p => !p.s && p.k === 'sand'), bb = B[pours];
      if (gDone && bb.g == null) bb.g = avg(); if (sDone && bb.sa == null) bb.sa = avg();
      for (const p of P) { if (p.s) continue;
        const go = p.k === 'gravel' || (p.k === 'sand' ? gDone : sDone);           // 細的顆粒在水中飄比較久
        p.y += p.v * dt * (go ? 1 : .12); if (p.k === 'mud') p.x = clamp(p.x + (rnd() - .5) * 1.2, JX0 + p.r, JX1 - p.r);
        const b0 = Math.max(0, Math.floor((p.x - p.r - JX0) / BW)), b1 = Math.min(NB - 1, Math.floor((p.x + p.r - JX0) / BW)); let sf = 0;
        for (let b = b0; b <= b1; b++) sf += floor[b]; sf /= b1 - b0 + 1;
        if (!go) { p.y = Math.min(p.y, sf - p.r - 1); continue; }                  // 還輪不到它沉：停在底面上方繼續飄
        if (p.y + p.r * .6 >= sf) {                                                  // 落到底：依顆粒面積墊高底面，層的厚度才會合理
          p.y = sf - p.r * .6; p.s = true; const nf = sf - Math.PI * p.r * p.r * .8 / ((b1 - b0 + 1) * BW);
          for (let b = b0; b <= b1; b++) floor[b] = Math.min(floor[b], nf);
        } }
      const left = k => P.some(p => !p.s && p.k === k), cur = P.filter(p => p.pour === pours);
      const lf = k => cur.some(p => !p.s && p.k === k);
      G.$('#jT').textContent = lf('gravel') ? '礫石一下子就沉下去了……' : lf('sand') ? '礫石已經沉到底，砂接著沉下來……' : lf('mud') ? '細泥還飄在水中，水很混濁，要等比較久……' : '';
      if (!left('gravel') && !left('sand') && !left('mud')) {
        phase = 'idle'; bb.m = avg(); label();
        G.$('#jT').textContent = pours === 1 ? '全部沉完：由下往上是礫石、砂、泥，水也變清了' : '新倒入的泥沙，一層層堆在原來那層的上面：越下面的越早沉積';
        G.$('#jGo').disabled = false; G.$('#jGo').textContent = '↻ 重新搖一搖'; G.$('#jMore').disabled = pours >= 2;
        if (!told) { told = true; done(); }
      }
    }
    draw(); if (phase !== 'idle') raf = requestAnimationFrame(tick);
  };
  const run = () => { G.$('#jGo').disabled = G.$('#jMore').disabled = true; marks = []; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
  G.$('#jGo').onclick = () => { reset(); pour(1, WT + 8, JB - 8); phase = 'shake'; shake = 0; G.$('#jT').textContent = '搖一搖，讓泥沙和水混在一起……'; run(); };
  G.$('#jMore').onclick = () => { pour(.45, WT + 6, WT + 50); phase = 'settle'; G.$('#jT').textContent = '倒入新的泥沙……'; run(); };
  reset(); draw();
  return () => cancelAnimationFrame(raf);
}

/* ---------- 區域定義 ---------- */
G.registerZone('spheres', {
  hint: '這塊大地有山、河、湖、海和天空，前方還切開看得到地層。點發光的圓點，或直接點模型的各部分！',
  build,
  nodes: [
    { id: 'litho', num: '1', title: '岩石圈', en: 'Lithosphere', color: '#b45309', ready: true, at: [-7, height(-7, -4.6) + .9, -4.6],
      cam: { pos: [3, 10.5, 24], target: [1, .4, -1] },
      learn: `
        <h3>腳下的大地：岩石圈</h3>
        <p>地球最外層堅硬的部分，是由岩石構成的，稱為<em>岩石圈</em>。高山、平原、海岸，都是岩石圈的一部分。</p>
        <p>海洋的底部也是岩石。如果把海水移走，海底一樣有山也有平原，所以<em>海底也屬於岩石圈</em>。</p>
        <div class="two"><div><b>⛰️ 陸地</b>高山、丘陵、平原，表面常蓋著一層土壤。</div><div><b>🌊 海底</b>被海水蓋住的岩石，上面堆著泥沙。</div></div>
        <h3>表面的土壤</h3>
        <p>岩石經過很長時間的風化，碎成砂和泥，再混合生物的遺骸，就成了<em>土壤</em>。植物就長在土壤裡。</p>
        <div class="tip"><b>看看模型：</b>發光的部分就是岩石圈。前方切開的剖面，看得到地表下一層層堅硬的岩石。</div>
        <p>岩石圈上有水，外面包著空氣，還住著許多生物。到其他節點認識另外三圈。</p>` },
    { id: 'hydro', num: '2', title: '水圈', en: 'Hydrosphere', color: '#0284c7', ready: true, at: [7.4, .9, 1.2],
      cam: { pos: [5.5, 9, 22], target: [3.5, 0, -.5] },
      learn: `
        <h3>地球上的水：水圈</h3>
        <p>地球上所有的水合起來，稱為<em>水圈</em>。水存在於海洋、河川、湖泊、地底下，還有空氣中。</p>
        <div class="two"><div><b>🌊 海洋</b>地球表面大約十分之七是海洋，海水是鹹的。</div><div><b>🏞️ 河川與湖泊</b>陸地上流動或聚集的水，大多是淡水。</div>
          <div><b>💧 地下水</b>雨水滲進土壤和岩石的縫隙，存在地底下。</div><div><b>☁️ 空氣中的水</b>看不見的水蒸氣，和雲裡的小水滴。</div></div>
        <h3>大部分的水在海洋</h3>
        ${barSVG('地球上的水', [['海水', 97, '#3b82f6'], ['淡水', 3, '#a5f3fc']], '')}
        <p>淡水只占大約百分之三，其中大部分是冰河和地下水。我們能直接取用的河水、湖水非常少，要好好珍惜。</p>
        <div class="tip"><b>看看模型：</b>山上的雲正在下雨。雨水流進河川、湖泊，最後流到海洋；也有一部分滲到地下，可以挖井取用。</div>
        <p>到「圖鑑」看看水在不同地方的樣子。</p>`,
      cardsIntro: '<p>水在地球上的五個「住處」。下面都是繪圖，看看你住的地方附近找得到哪幾種。</p>',
      cards: [
        { name: '海洋', en: 'Ocean', photo: 'img/spheres/ocean.jpg', svg: picSVG('ocean'), facts: [
          ['在哪裡', '覆蓋地球表面大約十分之七。'], ['特色', '海水是鹹的，不能直接喝。'], ['臺灣的海', '臺灣四面環海，東邊是太平洋，西邊是臺灣海峽。']] },
        { name: '河川', en: 'River', photo: 'img/spheres/river.jpg', svg: picSVG('river'), facts: [
          ['在哪裡', '從高處往低處流，最後大多流進海洋。'], ['特色', '大多是淡水，會搬運泥沙、改變地形。'], ['臺灣的河川', '濁水溪是臺灣最長的河川。']] },
        { name: '湖泊', en: 'Lake', photo: 'img/spheres/lake.jpg', svg: picSVG('lake'), facts: [
          ['在哪裡', '陸地上低窪、積水的地方。'], ['特色', '水流很慢，大多是淡水。'], ['臺灣的湖泊', '南投縣日月潭是臺灣最大的天然湖泊。']] },
        { name: '地下水', en: 'Groundwater', photo: 'img/spheres/groundwater.jpg', svg: picSVG('ground'), facts: [
          ['在哪裡', '雨水滲進土壤和岩石的縫隙，存在地底下。'], ['怎麼取用', '挖井或打抽水井，把地下水抽上來使用。'], ['要注意', '抽太多地下水，地面可能會慢慢下陷。臺灣西南沿海就曾發生。']] },
        { name: '雲和水蒸氣', en: 'Water in the air', photo: 'img/spheres/cloud.jpg', svg: picSVG('cloud'), facts: [
          ['在哪裡', '空氣中。水蒸發成看不見的水蒸氣。'], ['怎麼變成雲', '水蒸氣在高空遇冷，凝結成小水滴，聚在一起就是雲。'], ['和其他水的關係', '雲裡的水滴變大落下成雨，又回到河川、湖泊和海洋。']] },
      ] },
    { id: 'atmo', num: '3', title: '大氣圈', en: 'Atmosphere', color: '#0ea5e9', ready: true, at: [.4, 9.2, -3],
      cam: { pos: [6, 8, 37], target: [6, 3.4, -1] },
      learn: `
        <h3>包圍地球的空氣：大氣圈</h3>
        <p>地球被一層厚厚的空氣包圍著，這層空氣稱為<em>大氣圈</em>。我們看不見空氣，但是能感覺到風。</p>
        <p>越往高處，空氣越稀薄。爬高山時會覺得呼吸比較費力，就是這個原因。</p>
        <h3>空氣裡有什麼？</h3>
        ${barSVG('空氣的成分', [['氮氣', 78, '#93c5fd'], ['氧氣', 21, '#86efac'], ['其他氣體', 1, '#fcd34d']], '')}
        <p>其他氣體包含二氧化碳等。空氣中還有水蒸氣，多寡會隨天氣改變。</p>
        <div class="two"><div><b>🫁 讓生物呼吸</b>動物需要氧氣，植物需要二氧化碳。</div><div><b>🌦️ 天氣變化</b>雲、風、雨都發生在大氣圈裡。</div>
          <div><b>🌡️ 保持溫暖</b>像一條棉被，讓地球不會太冷。</div><div><b>🛡️ 保護地表</b>擋住部分有害的紫外線，小隕石也會燒掉。</div></div>
        <div class="tip"><b>看看模型：</b>淺藍色的罩子代表大氣圈，白色小點代表空氣。比比看，低處和高處的小點，哪裡比較密？</div>` },
    { id: 'bio', num: '4', title: '生物圈', en: 'Biosphere', color: '#16a34a', ready: true, at: [-5.4, height(-5.4, 2.2) + 1.2, 2.2],
      cam: { pos: [2, 9, 28], target: [1, 2.6, 0] },
      learn: `
        <h3>有生物的地方：生物圈</h3>
        <p>地球上所有的生物，以及牠們生活的範圍，稱為<em>生物圈</em>。人類也是生物圈的一員。</p>
        <p>生物圈沒有自己的「一塊地」：鳥在空中飛、魚在海裡游、蚯蚓住在土裡。生物圈<em>跨越了其他三圈</em>。</p>
        <div class="two"><div><b>☁️ 大氣圈</b>鳥和昆蟲在空中飛，生物都要呼吸空氣。</div><div><b>🌊 水圈</b>魚、海藻、珊瑚生活在水裡。</div>
          <div><b>⛰️ 岩石圈</b>植物在土壤裡扎根，蚯蚓在土裡鑽洞。</div><div><b>🌳 一棵樹</b>根在土裡吸水，葉子在空氣中，一次跨越三圈。</div></div>
        <h3>四圈互相影響</h3>
        <p>海水蒸發到空氣中，變成雨落到陸地，再流回海洋。生物需要水、空氣和土壤才能生存，四圈缺一不可。</p>
        <div class="tip"><b>看看模型：</b>左邊綠色的長條是生物圈的範圍，從海底一直到鳥飛行的高空。</div>
        <p>到「圖鑑」看看，不同的生物分別生活在哪一圈。</p>`,
      cardsIntro: '<p>這些生物住在哪一圈？有沒有哪一種同時跨越好幾圈？下面都是繪圖。</p>',
      cards: [
        { name: '鳥', en: 'Bird', photo: 'img/spheres/bird.jpg', svg: picSVG('bird'), facts: [
          ['生活在', '大氣圈：在空中飛翔。'], ['也需要', '在樹上或地面築巢、喝水，所以也會用到岩石圈和水圈。']] },
        { name: '魚', en: 'Fish', photo: 'img/spheres/fish.jpg', svg: picSVG('fish'), facts: [
          ['生活在', '水圈：海洋、河川或湖泊。'], ['特別的地方', '用鰓呼吸溶在水裡的氧氣，氧氣原本來自空氣和水中植物。']] },
        { name: '蚯蚓', en: 'Earthworm', photo: 'img/spheres/earthworm.jpg', svg: picSVG('worm'), facts: [
          ['生活在', '岩石圈表面的土壤裡。'], ['對大地的影響', '在土裡鑽洞，讓空氣和水更容易進到土壤，也幫忙分解落葉。']] },
        { name: '一棵大樹', en: 'Tree', photo: 'img/spheres/tree.jpg', svg: picSVG('tree'), facts: [
          ['生活在', '一次跨越三圈：根在土壤（岩石圈），葉子在空氣中（大氣圈）。'], ['也需要', '根從土裡吸收水分（水圈），葉子吸收空氣中的二氧化碳。']] },
      ] },
    { id: 'strata', num: '5', title: '地層怎麼來', en: 'Strata', color: '#7c3aed', ready: true, at: [-3.4, -3.2, Z1 + .05],
      cam: { pos: [1.5, -.2, 24.5], target: [1.5, -1.5, Z1] },
      learn: `
        <h3>一層一層的地層</h3>
        <p>河水把礫石、砂和泥帶到湖泊或海洋，水流變慢，泥沙就沉到水底。一次又一次堆積，形成一層層的<em>地層</em>。</p>
        <div class="two"><div><b>⬇️ 下面的比較老</b>先堆積的在下面，後堆積的蓋在上面。</div><div><b>🎨 每層不一樣</b>每次堆積的顆粒大小和顏色不同，形成層層紋路。</div></div>
        <p>地層經過很長很長的時間，被上面的泥沙壓緊，才會變成堅硬的沉積岩。</p>
        <h3>地層會彎曲，也會斷裂</h3>
        <p>地層原本大多是平平的。受到大地的力量擠壓後，可能<em>彎曲</em>，也可能<em>斷裂</em>而錯開。</p>
        <div class="tip"><b>看看剖面：</b>左邊的地層向上拱起，是被擠壓而彎曲的；中間有一道斜斜的裂縫，兩邊的地層錯開了。</div>
        <p>泥沙沉到水底時，大顆粒和小顆粒誰先沉下去？用探究活動「沉積瓶」找答案。</p>`,
      cardsIntro: '<p>野外常見的三種地層樣子。下面都是繪圖，對照剖面找找看。</p>',
      cards: [
        { name: '一層層的地層', en: 'Layers', photo: 'img/spheres/strata-layers.jpg', svg: picSVG('layers'), facts: [
          ['外觀', '紋路一層一層，每層的顏色、顆粒粗細不同。'], ['怎麼形成', '泥沙在水中一次次堆積，越下面的越早堆積。'], ['臺灣哪裡看', '新北市瑞芳南雅的海岸，岩石有一層層的紋路。']] },
        { name: '彎曲的地層', en: 'Folded layers', photo: 'img/spheres/strata-fold.jpg', svg: picSVG('fold'), facts: [
          ['外觀', '原本平平的地層，變成拱起或凹下的波浪形。'], ['怎麼形成', '受到大地的擠壓力量，經過很長的時間慢慢彎曲。'], ['延伸', '到了國中，會學到它叫做「褶皺」。']] },
        { name: '斷裂的地層', en: 'Faulted layers', photo: 'img/spheres/strata-fault.jpg', svg: picSVG('fault'), facts: [
          ['外觀', '地層出現裂縫，兩邊的地層上下錯開。'], ['怎麼形成', '受到的力量太大，地層斷開、錯動，常常引發地震。'], ['臺灣哪裡看', '臺中市霧峰的九二一地震教育園區，保存了地震時斷裂錯開的地面。'], ['延伸', '到了國中，會學到它叫做「斷層」。']] },
      ],
      poe: {
        question: '把礫石、砂和細泥放進裝了水的瓶子裡，搖一搖混在一起，再靜置不動。哪一種顆粒會最先沉到瓶底？',
        options: ['礫石（顆粒最大）', '砂（顆粒中等）', '泥（顆粒最小）', '三種會同時沉到瓶底'],
        observeIntro: '按「搖一搖」後靜置，注意<b>哪一種顆粒先沉到底</b>，以及最後瓶子裡<b>由下往上的排列</b>。',
        observe: observeJar,
        explain: {
          q: '根據剛才的觀察，哪一個說法最能解釋泥沙沉積的順序？',
          opts: ['顆粒越大、越重的沉得越快，所以礫石在最下面，泥在最上面。', '顆粒越小越重，所以細泥最先沉到瓶底。', '顏色越深的沉得越快，和顆粒大小沒有關係。'],
          ans: 0,
          hint: '回想動畫：哪一種顆粒一下子就到底了？哪一種讓水混濁了很久？比較它們的大小。',
          why: '大顆粒沉得快，先到底；細泥沉得最慢，最後才鋪在最上面。河水把泥沙帶進湖泊和海洋，一次次堆積，就形成一層層的地層，後來堆的蓋在上面。'
        }
      } },
  ],
  // 檢核題：level 為 PIRLS 層次（1 提取訊息／2 推論訊息／3 詮釋整合／4 比較評估）
  quiz: [
    { id: 'spheres.litho.1', about: '岩石圈', level: 1, q: '根據「岩石圈」的認識，下列哪一個屬於岩石圈？',
      opts: ['被海水蓋住的海底岩石', '飄在天上的雲', '在河裡流動的水', '在空中飛的鳥'], ans: 0, why: '說明中提到：地球最外層堅硬的岩石部分是岩石圈，海洋的底部也是岩石，所以海底也屬於岩石圈。' },
    { id: 'spheres.hydro.1', about: '水圈', level: 1, q: '根據「水圈」的認識，地球上大部分的水在哪裡？',
      opts: ['海洋', '河川', '湖泊', '地下水'], ans: 0, why: '長條圖顯示：海水大約占地球上的水的百分之九十七，淡水只占大約百分之三。' },
    { id: 'spheres.bio.1', about: '生物圈', level: 2, q: '老師說：「生物圈跨越了其他三圈。」根據「生物圈」的認識與圖鑑，哪一個例子最能說明這句話？',
      opts: ['大樹的根在土裡吸水，葉子在空氣中', '高山上的岩石很堅硬', '海水是鹹的，不能直接喝', '越往高處，空氣越稀薄'], ans: 0, why: '一棵樹的根在土壤（岩石圈）裡吸收水分（水圈），葉子在空氣（大氣圈）中，可以推論生物同時用到了其他三圈。' },
    { id: 'spheres.strata.1', about: '地層怎麼來', level: 2, q: '根據「地層怎麼來」的探究，沉積瓶靜置後，水要等很久才會變清。這是因為哪一種顆粒最後才沉下去？',
      opts: ['礫石，因為它最大顆', '砂，因為它顏色最淺', '泥，因為它顆粒最小，沉得最慢', '三種顆粒都浮在水面上'], ans: 2, why: '探究中看到：礫石最先到底，砂接著沉下，細泥飄在水中最久。水是被細泥弄混濁的，所以要等泥沉完才變清。' },
    { id: 'spheres.hydro.2', about: '水圈、大氣圈', level: 3, q: '把「水圈」和「大氣圈」的認識放在一起想：雨從雲裡落下，流進河川，有些滲到地下。這個過程最能說明什麼？',
      opts: ['水會在空氣、陸地和地底之間移動，四圈互相關連', '水只存在海洋裡，其他地方都沒有', '空氣和水完全沒有關係', '雨水落到地面後就消失了'], ans: 0, why: '水圈的認識說水存在於空氣、河川、地底等地方；大氣圈的認識說雲和雨在大氣圈發生。合起來看，水會在各圈之間移動，四圈是互相關連的。' },
  ]
});
})();
