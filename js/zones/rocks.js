/* 區域 2：三大類岩石與化石 —— 火山與地層的剖面
   五個節點：火成岩、沉積岩、變質岩、化石、岩石與礦物；本區挑戰 6 題 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, { ss, fbm, clamp } = U;

/* ---------- 剖面外形：x∈[-12,12]，y∈[-9,7]，剖面在 z=0，後方是立體地形 ---------- */
const X0 = -12, X1 = 12, YB = -9, YT = 7, VX = -3;
const gnd = x => 0.8 - 1.6 * ss(5, 9, x);
const cone = d => 5.2 * Math.pow(Math.max(0, 1 - d / 6.5), 1.5) - 1.3 * Math.max(0, 1 - d / 0.9);
const top = x => gnd(x) + cone(Math.abs(x - VX));
const height = (x, z) => gnd(x) + cone(Math.hypot(x - VX, z)) + (fbm(x * .6 + 5, z * .6, 3) - .45) * .7 * ss(0, -1.6, z);

/* ---------- 剖面圖（畫在 canvas 上當貼圖） ---------- */
function faceTexture() {
  const W = 2048, s = W / (X1 - X0), H = Math.round((YT - YB) * s), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), r = U.rng(11), X = x => (x - X0) * s, Y = y => (YT - y) * s;
  const bound = (L, i) => x => L + .22 * Math.sin(x * .45 + i * 1.7) + .012 * x * i;
  const B = [0.2, -0.6, -1.4, -2.3, -3.1, -3.9, -5.7, YB - 1].map((L, i) => bound(L, i));
  const fills = ['#d9bf88', '#8d8882', '#cbb184', '#beb9a9', '#a48c66', '#5f6672', '#473f45'];
  // 火山體（歷次噴發堆疊的熔岩與火山灰）
  g.fillStyle = '#7a6d66'; g.fillRect(0, 0, W, H);
  for (let k = 5; k >= 1; k--) {
    g.beginPath(); g.moveTo(X(X0), Y(B[0](X0)));
    for (let x = X0; x <= X1; x += .1) g.lineTo(X(x), Y(B[0](x) + Math.max(0, top(x) - B[0](x)) * k / 5.4));
    g.lineTo(X(X1), Y(B[0](X1))); g.closePath(); g.fillStyle = k % 2 ? '#6b5f5a' : '#85776c'; g.fill();
  }
  // 沉積岩層 → 變質岩 → 深處
  for (let i = 0; i < fills.length; i++) {
    g.beginPath(); for (let x = X0; x <= X1 + .01; x += .2) g.lineTo(X(x), Y(B[i](x)));
    for (let x = X1; x >= X0 - .01; x -= .2) g.lineTo(X(x), Y(B[i + 1](x))); g.closePath(); g.fillStyle = fills[i]; g.fill();
  }
  // 紋理：砂粒、頁岩細紋、變質岩的波狀葉理
  for (let i = 0; i < 26000; i++) { const x = r() * W, y = r() * H; g.fillStyle = r() < .5 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.12)'; g.fillRect(x, y, 1 + r() * 3.5, 1 + r() * 2); }
  g.lineWidth = 1.3;
  for (const i of [1, 3]) for (let k = 1; k < 6; k++) { g.strokeStyle = 'rgba(30,30,35,.22)'; g.beginPath(); for (let x = X0; x <= X1; x += .3) { const y = B[i](x) + (B[i + 1](x) - B[i](x)) * k / 6; g.lineTo(X(x), Y(y)); } g.stroke(); }
  for (let k = 1; k < 14; k++) { g.strokeStyle = 'rgba(210,215,230,.2)'; g.lineWidth = 2; g.beginPath(); for (let x = X0; x <= X1; x += .12) { const y = B[5](x) + (B[6](x) - B[5](x)) * k / 14 + .07 * Math.sin(x * 5 + k * 2); g.lineTo(X(x), Y(y)); } g.stroke(); }
  g.strokeStyle = 'rgba(40,30,25,.4)'; g.lineWidth = 2.5; for (let i = 0; i < 7; i++) { g.beginPath(); for (let x = X0; x <= X1; x += .2) g.lineTo(X(x), Y(B[i](x))); g.stroke(); }
  // 沉積岩層裡的化石（之後「化石」節點使用）
  g.strokeStyle = 'rgba(255,250,235,.85)'; g.lineWidth = 2.2;
  for (const [fx, fy] of [[7.2, -1.0], [9.4, -1.05], [10.8, -1.9], [8.3, -1.85], [6.2, -2.7]]) { g.beginPath(); for (let a = 0; a < 11; a += .25) { const q = .012 * a + .02; g.lineTo(X(fx + Math.cos(a) * q * a * .9), Y(fy + Math.sin(a) * q * a * .9)); } g.stroke(); }
  // 岩漿庫周圍被烤熱的岩石
  const mx = VX, my = -6.9;
  let gr = g.createRadialGradient(X(mx), Y(my), s * 1.5, X(mx), Y(my), s * 6.6); gr.addColorStop(0, 'rgba(255,90,30,.55)'); gr.addColorStop(1, 'rgba(255,90,30,0)');
  g.save(); g.scale(1, .5); g.translate(0, Y(my)); g.fillStyle = gr; g.fillRect(0, -H, W, H * 3); g.restore();
  const hot = (a, b, c2) => { const q = g.createLinearGradient(0, Y(-8), 0, Y(5)); q.addColorStop(0, a); q.addColorStop(.6, b); q.addColorStop(1, c2); return q; };
  // 侵入岩體（在地底慢慢冷卻）與供應的岩脈
  g.strokeStyle = '#f08a2a'; g.lineWidth = s * .2; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(-6.6), Y(-6.4)); g.quadraticCurveTo(X(-8.8), Y(-5.4), X(-8.7), Y(-3.2)); g.stroke();
  g.save(); g.beginPath(); g.ellipse(X(-8.7), Y(-2.5), s * 2.25, s * 1.25, -.12, 0, 7); g.closePath(); g.fillStyle = '#e7c3b3'; g.fill(); g.clip();
  for (let i = 0; i < 520; i++) { const x = X(-11.2 + r() * 5), y = Y(-4 + r() * 3), q = r(); g.fillStyle = q < .34 ? '#f6f1e8' : q < .62 ? '#d99a8e' : q < .82 ? '#b5b0aa' : '#2e2a2b'; g.beginPath(); g.ellipse(x, y, 4 + r() * 9, 3 + r() * 7, r() * 3, 0, 7); g.fill(); }
  gr = g.createRadialGradient(X(-8.7), Y(-2.9), 0, X(-8.7), Y(-2.9), s * 1.6); gr.addColorStop(0, 'rgba(255,140,40,.55)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.restore(); g.strokeStyle = 'rgba(60,30,20,.5)'; g.lineWidth = 3; g.beginPath(); g.ellipse(X(-8.7), Y(-2.5), s * 2.25, s * 1.25, -.12, 0, 7); g.stroke();
  // 岩漿庫與火山通道
  g.fillStyle = hot('#ffd24a', '#ff8a1f', '#e2441a');
  g.beginPath(); g.moveTo(X(VX - .55), Y(-5.6));
  for (let y = -5.6; y <= 4.75; y += .2) g.lineTo(X(VX - (.5 - (y + 5.6) * .028) + .1 * Math.sin(y * 1.1)), Y(y));
  for (let y = 4.75; y >= -5.6; y -= .2) g.lineTo(X(VX + (.5 - (y + 5.6) * .028) + .1 * Math.sin(y * 1.1)), Y(y)); g.closePath(); g.fill();
  gr = g.createRadialGradient(X(mx), Y(my) * 1, 0, X(mx), Y(my), s * 4.7); gr.addColorStop(0, '#fff6b8'); gr.addColorStop(.35, '#ffc233'); gr.addColorStop(.75, '#f0641e'); gr.addColorStop(1, '#a8331c');
  g.save(); g.translate(X(mx), Y(my)); g.scale(1, .38); g.translate(-X(mx), -Y(my)); g.fillStyle = gr; g.beginPath(); g.arc(X(mx), Y(my), s * 4.7, 0, 7); g.fill(); g.restore();
  // 地表的熔岩流：靠近火山口還紅熱，流遠了冷卻變黑
  const flow = (xa, xb, hotEnd) => { for (let x = xa; Math.abs(x - xa) <= Math.abs(xb - xa); x += Math.sign(xb - xa) * .04) { const t = Math.abs(x - xa) / Math.abs(xb - xa); g.fillStyle = hotEnd ? `hsl(${18 - t * 14},${95 - t * 80}%,${52 - t * 34}%)` : '#34363b'; g.fillRect(X(x) - 2, Y(top(x)) - 1, 5, s * (.3 - t * .1)); } };
  flow(VX + .75, 4.2, true); flow(VX - .9, -8.5, false);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ---------- 建立場景 ---------- */
function build() {
  const T = THREE, scene = new T.Scene(); scene.background = U.skyTexture('#6fb4e8', '#efeadf'); scene.fog = new T.Fog(0xe6eef0, 70, 160);
  U.addSun(scene, 18); scene.add(U.groundShadow(46, 26, YB - 1));
  const detail = U.detailTexture(9, 4);
  const anim = [];
  // 剖面
  const sh = new T.Shape(); sh.moveTo(X0, YB); sh.lineTo(X1, YB); for (let x = X1; x >= X0 - 1e-6; x -= .08) sh.lineTo(x, top(x)); sh.closePath();
  const fg = new T.ShapeGeometry(sh), uv = fg.attributes.uv, p = fg.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - X0) / (X1 - X0), (p.getY(i) - YB) / (YT - YB));
  scene.add(new T.Mesh(fg, new T.MeshBasicMaterial({ map: faceTexture(), side: T.DoubleSide, toneMapped: false })));
  // 後方立體地形
  const NX = 110, NZ = 40, pos = [], cols = [], idx = [], col = new T.Color(), hs = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = X0 + i * (X1 - X0) / NX, z = -9 * j / NZ, h = height(x, z), d = Math.hypot(x - VX, z); hs.push(h);
    const ang = Math.atan2(-z, x - VX), onFlow = d > .6 && d < 7.3 && (Math.abs(ang) < .16 + .05 * Math.sin(d * 3) || Math.abs(ang - Math.PI) < .12);
    if (h < 0) col.set('#cdbb8c'); else if (x > 5 && h < .22) col.set('#ead9a6');
    else if (d < 1.5) col.set('#4a3f3d'); else if (onFlow) col.set(Math.abs(ang) < 1 ? '#3a3534' : '#34363b').lerp(new T.Color('#e2531a'), Math.abs(ang) < 1 ? clamp(1 - d / 3.2, 0, 1) * .9 : 0);
    else if (h > 3.3) col.set('#857a70'); else { col.set('#7fb85a').lerp(new T.Color('#3f8a45'), clamp(fbm(x * .7, z * .7, 3) * 1.6 - .3, 0, 1)); if (h > 2.4) col.lerp(new T.Color('#857a70'), ss(2.4, 3.3, h)); }
    col.offsetHSL(0, 0, (U.hash(i, j) - .5) * .06); pos.push(x, h, z); cols.push(col.r, col.g, col.b);
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(Array.from({ length: (NX + 1) * (NZ + 1) * 2 }, (_, k) => k % 2 ? ((k >> 1) / (NX + 1) | 0) / NZ : ((k >> 1) % (NX + 1)) / NX), 2)); tg.setIndex(idx); tg.computeVertexNormals();
  scene.add(U.shadowed(new T.Mesh(tg, new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: T.DoubleSide, bumpMap: detail, bumpScale: 2.2 }))));
  // 側牆與海
  const edge = [], P = (i, j) => [X0 + i * (X1 - X0) / NX, hs[j * (NX + 1) + i], -9 * j / NZ];
  for (let j = 0; j <= NZ; j++) edge.push(P(0, j)); for (let i = 1; i <= NX; i++) edge.push(P(i, NZ)); for (let j = NZ - 1; j >= 0; j--) edge.push(P(NX, j));
  scene.add(new T.Mesh(U.skirt(edge, YB, (x, y, z, d) => [d / 14, 1 - (.9 - y) / 10.2]), new T.MeshStandardMaterial({ map: U.strataTexture(), bumpMap: U.detailTexture(3, 2), bumpScale: 1.5, roughness: 1, side: T.DoubleSide })));
  scene.add(U.buildSea(U.seaMaterials(), 6.2, X1, -9, 0, height, 0, 0, 'ENS'));
  // 樹
  const tr = U.rng(5), trees = [];
  for (let k = 0; k < 2400 && trees.length < 330; k++) { const x = X0 + .3 + tr() * 23.4, z = -.4 - tr() * 8.4, h = height(x, z), d = Math.hypot(x - VX, z); if (h < .3 || h > 2.9 || d < 2 || (Math.abs(Math.atan2(-z, x - VX)) < .25 && d < 7.5)) continue; trees.push([x, h, z, 1 + tr() * .8, tr() < .75 ? 0 : 1]); }
  U.plantTrees(scene, trees, tr, 1.15);

  /* 動態：岩漿庫發光、岩漿上升、熔岩流動、火山口冒煙 */
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gg = gc.getContext('2d'), rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(255,230,140,1)'); rg.addColorStop(.5, 'rgba(255,140,40,.45)'); rg.addColorStop(1, 'rgba(255,90,20,0)'); gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
  const glowTex = new T.CanvasTexture(gc), glowMat = () => new T.MeshBasicMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glow = new T.Mesh(new T.PlaneGeometry(11, 5), glowMat()); glow.position.set(VX, -6.9, .06); scene.add(glow);
  const cg = new T.Mesh(new T.PlaneGeometry(3, 3), glowMat()); cg.position.set(VX, 4.9, .08); scene.add(cg);
  anim.push(t => { glow.material.opacity = .5 + .25 * Math.sin(t * 2.2); cg.material.opacity = .65 + .3 * Math.sin(t * 5); });
  const blobMat = new T.MeshBasicMaterial({ color: 0xfff0a0, toneMapped: false }), blobGeo = new T.SphereGeometry(.12, 10, 8);
  for (let k = 0; k < 16; k++) { const m = new T.Mesh(blobGeo, blobMat); scene.add(m); anim.push(t => { const u = (t * .16 + k / 16) % 1, y = -5.6 + u * 10.2; m.position.set(VX + .1 * Math.sin(y * 1.1) + .12 * Math.sin(k * 2.4), y, .1); m.scale.setScalar(.7 + .6 * Math.sin(k)); }); }
  const dropMat = new T.MeshBasicMaterial({ color: 0xffb347, toneMapped: false });
  for (let k = 0; k < 9; k++) { const m = new T.Mesh(blobGeo, dropMat); scene.add(m); anim.push(t => { const u = (t * .07 + k / 9) % 1, x = VX + .8 + u * 3.3; m.position.set(x, top(x) + .06, .1); m.scale.setScalar(1.1 * (1 - u)); m.material.color.setHSL(.07 - u * .05, 1, .6 - u * .3); }); }
  const sm = new T.MeshStandardMaterial({ color: 0xe9e5df, transparent: true, opacity: .78, roughness: 1 }), sgeo = new T.IcosahedronGeometry(.5, 2);
  for (let k = 0; k < 9; k++) { const m = new T.Mesh(sgeo, sm); scene.add(m); anim.push(t => { const u = (t * .12 + k / 9) % 1; m.position.set(VX + u * u * 2.6 + Math.sin(k * 3) * .2, 4.9 + u * 5.2, -.5 - Math.cos(k) * .3); m.scale.setScalar(.4 + u * 2); m.visible = u < .95; }); }

  /* 節點圓點與解說標籤 */
  const z = G.zones.rocks, def = G.zoneDef('rocks');
  for (const n of z.nodes) G.addLabel(`<b>${n.num}</b><span>${n.title}</span>`, 'node' + (n.ready ? '' : ' soon'), n.at, { color: n.color || def.color, onClick: () => G.openNode(n.id) });
  const tags = { igneous: [
    G.addLabel('岩漿庫<small>地底深處高溫熔化的岩石</small>', 'tag', [VX, -7.2, .2]),
    G.addLabel('火山通道<small>岩漿往上升</small>', 'tag', [VX + 1.9, 1.2, .2]),
    G.addLabel('熔岩流<small>噴出地表，很快冷卻</small>', 'tag', [2.6, top(2.2) + 1.3, .2]),
    G.addLabel('留在地底的岩漿<small>被包住，慢慢冷卻</small>', 'tag', [-8.7, -2.5, .2]),
  ], sedimentary: [
    G.addLabel('泥沙沉到海底<small>碎屑在低處一層層堆積</small>', 'tag', [10.2, .9, .2]),
    G.addLabel('砂岩層<small>砂粒被壓緊、黏結</small>', 'tag', [2.2, -.2, .2]),
    G.addLabel('頁岩層<small>細泥堆成一片片薄層</small>', 'tag', [8.6, -1.05, .2]),
    G.addLabel('層理<small>越下面的岩層越老</small>', 'tag', [1.6, -2.7, .2]),
  ], metamorphic: [
    G.addLabel('變質岩<small>礦物排成波浪般的紋路</small>', 'tag', [7.2, -4.8, .2]),
    G.addLabel('高溫<small>靠近岩漿庫</small>', 'tag', [.6, -5.3, .2]),
    G.addLabel('高壓<small>被上面厚厚的岩層壓著</small>', 'tag', [5.6, -3.3, .2]),
  ], fossil: [
    G.addLabel('化石<small>藏在沉積岩層裡</small>', 'tag', [7.6, -1.45, .2]),
    G.addLabel('比較老的化石<small>在比較下面的岩層</small>', 'tag', [6.2, -3.3, .2]),
  ], minerals: [
    G.addLabel('花岡岩<small>看得到一粒粒不同顏色的礦物</small>', 'tag', [-8.7, -4.2, .2]),
  ] };
  // 海裡慢慢沉到海底的泥沙（沉積岩的來源）
  const sedMat = new T.MeshBasicMaterial({ color: 0xb89a66, toneMapped: false }), sedGeo = new T.SphereGeometry(.05, 6, 5);
  for (let k = 0; k < 16; k++) { const m = new T.Mesh(sedGeo, sedMat), x = 7 + U.hash(k, 3) * 4.6; scene.add(m); anim.push(t => { const u = (t * .09 + U.hash(k, 7)) % 1; m.position.set(x + .08 * Math.sin(t * 2 + k), -.05 + (top(x) + .05) * u, .08); }); }

  return {
    scene, home: { pos: [0, 3.5, 33], target: [0, -1, 0] },
    view: { minDist: 6, maxDist: 70, maxPolar: Math.PI * .52, pan: { x: [-12, 12], y: [-9, 7], z: [-9, 2] } },
    onNode: id => { for (const k in tags) tags[k].forEach(L => L.el.classList.toggle('show', k === id)); },
    update(dt, t) { for (const f of anim) f(t); },
    dispose() { U.dispose(scene); }
  };
}

/* ---------- 岩石繪圖（SVG）：沒有實物照片時顯示 ---------- */
function rockSVG(kind) {
  const K = { basalt: [21, '#3b3e44', 0], andesite: [34, '#8a8f95', 1], granite: [55, '#e6c9bd', 2], sandstone: [61, '#d2ad74', 1], shale: [67, '#6f6c6b', 3], limestone: [73, '#d3cdbb', 0], slate: [79, '#3d444d', 3], marble: [83, '#f0eee9', 2], gneiss: [89, '#d8d2cc', 1] }[kind];
  const r = U.rng(K[0]), out = [], id = 'rk_' + kind, base = K[1], f = n => n.toFixed(1);
  if (kind === 'sandstone') { for (let i = 0; i < 560; i++) out.push(`<circle cx="${f(r() * 320)}" cy="${f(r() * 200)}" r="${f(.6 + r() * 1.3)}" fill="${['#b98f55', '#e9cf9e', '#a67c48', '#f1dfb6'][i % 4]}"/>`); for (const y of [48, 86, 122, 156]) out.push(`<path d="M0 ${y}Q160 ${y + 10} 320 ${y - 4}" stroke="rgba(120,80,40,.38)" stroke-width="2.2" fill="none"/>`); }
  if (kind === 'shale') { for (let y = 8; y < 200; y += 3.5 + r() * 5) out.push(`<path d="M0 ${f(y)}Q160 ${f(y + (r() - .5) * 7)} 320 ${f(y + (r() - .5) * 5)}" stroke="${r() < .5 ? '#4c4a4a' : '#8d8987'}" stroke-width="${f(.7 + r() * 1.3)}" fill="none"/>`); }
  if (kind === 'limestone') { for (let i = 0; i < 300; i++) out.push(`<circle cx="${f(r() * 320)}" cy="${f(r() * 200)}" r="${f(.6 + r() * 1.5)}" fill="${r() < .5 ? '#b9b29d' : '#ece8da'}"/>`); for (let i = 0; i < 20; i++) { const x = r() * 320, y = r() * 200, a = 4 + r() * 7; out.push(`<path d="M${f(x)} ${f(y)}a${f(a)} ${f(a)} 0 0 1 ${f(a * 2)} 0" stroke="#faf7ee" stroke-width="1.8" fill="none" transform="rotate(${f(r() * 360)} ${f(x)} ${f(y)})"/>`); } }
  if (kind === 'slate') { for (let i = 0; i < 80; i++) { const y = r() * 230; out.push(`<path d="M0 ${f(y)}L320 ${f(y - 22)}" stroke="${r() < .5 ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.3)'}" stroke-width="${f(.6 + r())}"/>`); } }
  if (kind === 'marble') { for (let i = 0; i < 11; i++) { const y = r() * 200; out.push(`<path d="M-10 ${f(y)}C80 ${f(y + (r() - .5) * 90)} 200 ${f(y + (r() - .5) * 90)} 330 ${f(y + (r() - .5) * 60)}" stroke="#8f96a0" stroke-opacity="${f(.2 + r() * .45)}" stroke-width="${f(1 + r() * 4)}" fill="none"/>`); } for (let i = 0; i < 160; i++) out.push(`<circle cx="${f(r() * 320)}" cy="${f(r() * 200)}" r="${f(.5 + r())}" fill="#fff"/>`); }
  if (kind === 'gneiss') { let y = -10, dark = false; while (y < 215) { const h = 5 + r() * 12; out.push(`<path d="M-10 ${f(y)}C80 ${f(y - 16)} 200 ${f(y + 16)} 330 ${f(y - 6)}" stroke="${dark ? '#2f2c2e' : r() < .5 ? '#efe9e2' : '#d9a79b'}" stroke-width="${f(h)}" fill="none"/>`); y += h * .85; dark = !dark; } for (let i = 0; i < 200; i++) out.push(`<circle cx="${f(r() * 320)}" cy="${f(r() * 200)}" r="${f(.5 + r())}" fill="${r() < .5 ? '#fff' : '#333'}" fill-opacity=".5"/>`); }
  if (kind === 'basalt') { for (let i = 0; i < 260; i++) out.push(`<circle cx="${r() * 320}" cy="${r() * 200}" r="${.6 + r() * 1.3}" fill="${r() < .5 ? '#2a2c31' : '#565a62'}"/>`); for (let i = 0; i < 22; i++) { const x = r() * 320, y = r() * 200, a = 2 + r() * 4; out.push(`<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${a * .7}" fill="#1f2125"/><path d="M${x - a} ${y + 1}a${a} ${a * .7} 0 0 0 ${a * 2} 0" stroke="#6a6f78" fill="none" stroke-width=".8"/>`); } }
  if (kind === 'andesite') { for (let i = 0; i < 300; i++) out.push(`<circle cx="${r() * 320}" cy="${r() * 200}" r="${.7 + r() * 1.4}" fill="${r() < .5 ? '#73787f' : '#a3a8ae'}"/>`); for (let i = 0; i < 46; i++) { const x = r() * 320, y = r() * 200, w = 3 + r() * 6; out.push(`<rect x="${x}" y="${y}" width="${w}" height="${w * (.35 + r() * .3)}" fill="${r() < .6 ? '#eef0ee' : '#2b2c30'}" transform="rotate(${r() * 180} ${x} ${y})"/>`); } }
  if (kind === 'granite') { for (let i = 0; i < 330; i++) { const x = r() * 320, y = r() * 200, q = r(), a = 5 + r() * 9; out.push(`<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${a * (.5 + r() * .4)}" fill="${q < .32 ? '#f7f3ea' : q < .6 ? '#dc9d92' : q < .82 ? '#b9b4ad' : '#2d2a2b'}" transform="rotate(${r() * 180} ${x} ${y})"/>`); } }
  const shape = ['M30 150L18 96 60 40 150 18 250 30 300 84 290 150 220 186 90 184Z', 'M22 140L40 70 110 26 220 22 296 70 304 140 240 184 100 186Z', 'M26 132L52 60 130 20 236 28 300 90 286 158 200 188 80 180Z', 'M14 124L44 62 248 36 306 74 300 136 258 170 58 176Z'][K[2]];
  return `<svg viewBox="0 0 320 200" role="img" aria-label="${kind}"><defs><clipPath id="${id}"><path d="${shape}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient></defs>
    <g clip-path="url(#${id})"><rect width="320" height="200" fill="${base}"/>${out.join('')}<rect width="320" height="200" fill="url(#${id}g)"/></g><path d="${shape}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="2"/></svg>`;
}

/* ---------- 探究的觀察活動：岩漿冷卻快慢與晶體大小（模擬） ---------- */
function observeCooling(el, done) {
  el.innerHTML = `<div class="sim">
      <figure><figcaption>噴出地表<small>接觸空氣或海水，冷得很快</small></figcaption><canvas width="120" height="120" id="simA"></canvas><div class="meter"><i id="mA"></i></div><div class="res" id="rA">　</div></figure>
      <figure><figcaption>留在地底深處<small>被岩石包住，冷得很慢</small></figcaption><canvas width="120" height="120" id="simB"></canvas><div class="meter"><i id="mB"></i></div><div class="res" id="rB">　</div></figure>
    </div><div class="row"><button class="cta" id="simGo">▶ 開始冷卻</button></div>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0">這是把很長的時間縮短的模擬動畫。色條代表溫度，從紅色（高溫）降到藍色（冷卻）。</p>`;
  const SZ = 120, mk = (cv, n, T, pal, seed) => { const r = U.rng(seed), seeds = []; for (let i = 0; i < n; i++) seeds.push({ x: r() * SZ, y: r() * SZ, t0: r() * T * .35, c: pal[Math.floor(r() * pal.length)] }); return { g: cv.getContext('2d'), own: new Int16Array(SZ * SZ).fill(-1), seeds, T, v: (SZ / Math.sqrt(n)) * 1.25 / (T * .65), n }; };
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const palA = ['#2f3238', '#3a3d44', '#44474e', '#33363c', '#4b4e55'].map(hex), palB = ['#f4efe6', '#f4efe6', '#de9f94', '#de9f94', '#bcb7b0', '#2e2a2b'].map(hex);
  let A, B, raf = 0, t0 = 0, runs = 0;
  const draw = (S, t, mEl) => {
    const img = S.g.createImageData(SZ, SZ), d = img.data, k = clamp(t / S.T, 0, 1);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const i = y * SZ + x; let o = S.own[i];
      if (o < 0) { let best = -1, bd = 1e9; for (let s = 0; s < S.n; s++) { const e = S.seeds[s]; if (t < e.t0) continue; const dd = Math.hypot(e.x - x, e.y - y); if (dd < bd) { bd = dd; best = s; } } if (best >= 0 && (bd <= (t - S.seeds[best].t0) * S.v || k >= 1)) o = S.own[i] = best; }
      let c; if (o < 0) { const f = U.vnoise(x * .12, y * .12 + t) * 30; c = [255 - k * 70, 150 - k * 90 + f, 30 + f * .5]; }
      else { c = S.seeds[o].c; const edge = (x && S.own[i - 1] >= 0 && S.own[i - 1] !== o) || (y && S.own[i - SZ] >= 0 && S.own[i - SZ] !== o); if (edge) c = [c[0] * .55, c[1] * .55, c[2] * .55]; }
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    S.g.putImageData(img, 0, 0); mEl.style.transform = `scaleX(${1 - k * .92})`;
  };
  const tick = now => {
    const t = (now - t0) / 1000; draw(A, t, G.$('#mA')); draw(B, t, G.$('#mB'));
    if (t >= A.T && !A.said) { A.said = 1; G.$('#rA').textContent = '冷卻完成：晶體又小又多，幾乎看不出顆粒'; }
    if (t >= B.T) { G.$('#rB').textContent = '冷卻完成：晶體長得很大，一粒粒看得很清楚'; G.$('#simGo').disabled = false; G.$('#simGo').textContent = '↻ 再看一次'; runs++; done(); return; }
    else G.$('#rB').textContent = '還在慢慢冷卻……晶體持續長大';
    raf = requestAnimationFrame(tick);
  };
  G.$('#simGo').onclick = () => {
    A = mk(G.$('#simA'), 150, 2.6, palA, 3 + runs); B = mk(G.$('#simB'), 9, 9, palB, 8 + runs);
    G.$('#rA').textContent = G.$('#rB').textContent = '　'; G.$('#simGo').disabled = true; t0 = performance.now(); raf = requestAnimationFrame(tick);
  };
  return () => cancelAnimationFrame(raf);
}

/* ---------- 化石與礦物繪圖（SVG） ---------- */
function picSVG(kind) {
  const r = U.rng(kind.length * 17 + kind.charCodeAt(0)), o = [], f = n => n.toFixed(1);
  const bg = (c, n, cs) => { o.push(`<rect width="320" height="200" fill="${c}"/>`); for (let i = 0; i < n; i++) o.push(`<circle cx="${f(r() * 320)}" cy="${f(r() * 200)}" r="${f(.6 + r() * 1.6)}" fill="${cs[i % cs.length]}"/>`); };
  const fan = (cx, cy, R, rot) => { const P = a => `${f(cx + Math.cos(a) * R)} ${f(cy + Math.sin(a) * R)}`, a0 = Math.PI * 1.1, a1 = Math.PI * 1.9; let s = `<g transform="rotate(${rot} ${cx} ${cy})"><path d="M${cx} ${cy + R * .3}L${P(a0)}A${R} ${R} 0 0 1 ${P(a1)}Z" fill="#f3ead8" stroke="#6b5332" stroke-width="2.5"/>`; for (let k = 1; k < 8; k++) s += `<path d="M${cx} ${cy + R * .3}L${P(a0 + (a1 - a0) * k / 8)}" stroke="#a48a5e" stroke-width="2"/>`; o.push(s + '</g>'); };
  if (kind === 'shell') { bg('#c8ab78', 280, ['#b08f5c', '#dcc79a']); fan(130, 130, 82, -12); fan(238, 150, 44, 24); }
  if (kind === 'ammonite') { bg('#8f8a80', 260, ['#7b766d', '#a7a297']); let d = '', sp = ''; for (let a = 0; a <= 17.4; a += .12) { const q = 5 + a * 4.6; d += (a ? 'L' : 'M') + f(160 + Math.cos(a) * q) + ' ' + f(100 + Math.sin(a) * q); } for (let a = 3; a <= 17.4; a += .32) { const q = 5 + a * 4.6, w = 2 + a * .62; sp += `<path d="M${f(160 + Math.cos(a) * (q - w))} ${f(100 + Math.sin(a) * (q - w))}L${f(160 + Math.cos(a + .1) * (q + w))} ${f(100 + Math.sin(a + .1) * (q + w))}" stroke="#7a6a4c" stroke-width="1.6"/>`; } o.push(`<path d="${d}" fill="none" stroke="#5e5036" stroke-width="27" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#eadfc4" stroke-width="22" stroke-linecap="round"/>${sp}`); }
  if (kind === 'track') { bg('#a98f6e', 240, ['#96795a', '#bfa784']); for (const [x, y] of [[70, 150], [150, 96], [236, 52]]) { let s = `<g transform="rotate(58 ${x} ${y})" fill="#63503a">`; for (const a of [-32, 0, 32]) s += `<ellipse cx="${x}" cy="${y - 24}" rx="7" ry="22" transform="rotate(${a} ${x} ${y})"/>`; o.push(s + `<circle cx="${x}" cy="${y + 2}" r="10"/></g>`); } o.push('<path d="M20 60Q60 30 90 62T160 170T300 150" fill="none" stroke="#63503a" stroke-width="5" stroke-dasharray="3 7" stroke-linecap="round"/>'); }
  if (kind === 'quartz') { bg('#566170', 0, []); for (const [x, w, h, a] of [[92, 40, 120, -14], [160, 52, 150, 2], [226, 36, 104, 16]]) { const t = 186 - h; o.push(`<g transform="rotate(${a} ${x} 186)" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"><path d="M${x - w / 2} 186V${t + w * .5}L${x} ${t}V186Z" fill="rgba(255,255,255,.82)"/><path d="M${x + w / 2} 186V${t + w * .5}L${x} ${t}V186Z" fill="rgba(220,232,245,.6)"/><path d="M${x - w / 6} 186V${t + w * .34}" stroke-opacity=".6"/></g>`); } o.push('<rect y="180" width="320" height="20" fill="#3d4652"/>'); }
  if (kind === 'feldspar') { bg('#636a73', 0, []); o.push('<path d="M70 70L190 44 262 76 142 104Z" fill="#f6d9cf"/><path d="M70 70L142 104 142 172 70 134Z" fill="#dfa596"/><path d="M142 104L262 76 262 142 142 172Z" fill="#ecbcae"/><g stroke="#b97f71" stroke-width="1.3" fill="none"><path d="M94 82L94 146M118 93L118 159M172 97L172 164M204 90L204 156M236 82L236 148M70 102L142 138 262 110"/></g><path d="M70 70L190 44 262 76 262 142 142 172 70 134Z" fill="none" stroke="#7d5248" stroke-width="2.5" stroke-linejoin="round"/>'); }
  if (kind === 'mica') { bg('#70757d', 0, []); for (let i = 0; i < 8; i++) { const y = 150 - i * 12, x = 46 + i * 5; o.push(`<path d="M${x} ${y}L${x + 70} ${y - 34} ${x + 216} ${y - 22} ${x + 150} ${y + 16}Z" fill="${i % 2 ? '#2a292d' : '#3a373c'}" stroke="#a5a2ab" stroke-width="1.2" stroke-linejoin="round"/>`); } o.push('<path d="M110 52L170 40 240 46" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>'); }
  return `<svg viewBox="0 0 320 200" role="img" aria-label="${kind}">${o.join('')}</svg>`;
}
/* 把花岡岩「拆開」的示意圖 */
function splitSVG() {
  const r = U.rng(55), o = [], f = n => n.toFixed(1), C = ['#f7f3ea', '#dc9d92', '#b9b4ad', '#2d2a2b'];
  for (let i = 0; i < 150; i++) { const a = 5 + r() * 8, q = r(); o.push(`<ellipse cx="${f(r() * 130)}" cy="${f(15 + r() * 130)}" rx="${f(a)}" ry="${f(a * (.5 + r() * .4))}" fill="${C[q < .32 ? 0 : q < .6 ? 1 : q < .82 ? 2 : 3]}" transform="rotate(${f(r() * 180)} 65 80)"/>`); }
  const row = (y, c, name, note, s) => `<path d="M132 80L176 ${y}" stroke="#64748b" stroke-width="2" stroke-dasharray="4 4"/><circle cx="196" cy="${y}" r="19" fill="${c}" stroke="${s}" stroke-width="2"/><text x="224" y="${y - 2}" font-size="16" font-weight="900" fill="#1f3345">${name}</text><text x="224" y="${y + 16}" font-size="12.5" fill="#55687a">${note}</text>`;
  return `<svg viewBox="0 0 340 160" role="img" aria-label="花岡岩由石英、長石、雲母組成" style="width:100%;height:auto;display:block;margin:8px 0;background:#fff;border:1px solid var(--line);border-radius:12px">
    <defs><clipPath id="spc"><circle cx="65" cy="80" r="58"/></clipPath></defs><g clip-path="url(#spc)"><rect width="130" height="160" fill="#e6c9bd"/>${o.join('')}</g><circle cx="65" cy="80" r="58" fill="none" stroke="#7d5248" stroke-width="2.5"/>
    <text x="65" y="156" font-size="13" font-weight="900" text-anchor="middle" fill="#1f3345">花岡岩</text>
    ${row(30, '#eef1f2', '石英', '灰白、半透明', '#94a3b8')}${row(80, '#e9aa9c', '長石', '白色或粉紅色', '#b97f71')}${row(130, '#2d2a2b', '雲母', '黑色、亮亮的薄片', '#111')}</svg>`;
}

/* ---------- 探究的觀察活動：加壓後片狀礦物的排列（模擬） ---------- */
function observeSqueeze(el, done) {
  el.innerHTML = `<div class="sim" style="grid-template-columns:1fr"><figure><figcaption>岩石裡的礦物顆粒<small>黑色短線是片狀的礦物，淺色圓點是粒狀的礦物</small></figcaption>
      <canvas width="360" height="240" id="sqC" style="aspect-ratio:3/2;max-width:420px;background:#2f2b33"></canvas>
      <input type="range" id="sqR" min="0" max="100" value="0" aria-label="壓力大小" style="display:block;width:100%;max-width:420px;margin:10px auto 4px;accent-color:#475569">
      <div class="res" id="sqT">　</div></figure></div>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0">把滑桿往右拖，從上下兩邊慢慢加壓，一直加到最大。這是把很長的時間縮短的模擬。</p>`;
  const g = G.$('#sqC').getContext('2d'), W = 360, H = 240, r = U.rng(31), fl = [], gr = [];
  for (let i = 0; i < 95; i++) fl.push([r(), r(), (r() - .5) * Math.PI, 9 + r() * 9]);
  for (let i = 0; i < 46; i++) gr.push([r(), r(), 4 + r() * 4, r() < .5 ? '#eeeae2' : '#d8a99c']);
  let told = false;
  const draw = k => {
    const top = 14 + 44 * k, hh = H - top * 2;
    g.fillStyle = '#2f2b33'; g.fillRect(0, 0, W, H); g.fillStyle = '#8b9099'; g.fillRect(0, top, W, hh);
    g.fillStyle = `rgba(255,110,40,${.22 * k})`; g.fillRect(0, top, W, hh);
    for (const [x, y, q, c] of gr) { g.fillStyle = c; g.beginPath(); g.ellipse(x * W, top + y * hh, q * (1 + .7 * k), q * (1 - .5 * k), 0, 0, 7); g.fill(); }
    g.strokeStyle = '#1c1d22'; g.lineWidth = 3.4; g.lineCap = 'round';
    for (const [x, y, a, L] of fl) { const b = a * Math.pow(1 - k, 1.6) + .12 * Math.sin(x * 9) * k, cx = x * W, cy = top + y * hh, l = L * (1 + .25 * k); g.beginPath(); g.moveTo(cx - Math.cos(b) * l, cy - Math.sin(b) * l); g.lineTo(cx + Math.cos(b) * l, cy + Math.sin(b) * l); g.stroke(); }
    g.fillStyle = '#fff'; g.font = '900 13px sans-serif'; g.textAlign = 'center'; g.globalAlpha = .35 + .65 * k;
    g.fillText('▼　壓　力　▼', W / 2, top - 4 > 12 ? top / 2 + 5 : 11); g.fillText('▲　壓　力　▲', W / 2, H - top / 2 + 5); g.globalAlpha = 1;
    G.$('#sqT').textContent = k < .04 ? '還沒加壓：片狀礦物的方向亂亂的' : k < .5 ? '壓力變大：岩石被壓扁，片狀礦物開始轉向……' : k < .96 ? '壓力更大：大部分的片狀礦物都快要躺平了' : '壓力最大：片狀礦物都躺平，排成一條條平行的紋路';
    if (k >= .96 && !told) { told = true; done(); }
  };
  G.$('#sqR').oninput = e => draw(e.target.value / 100); draw(0);
  return () => {};
}

/* ---------- 探究的觀察活動：貝殼在三種環境的遭遇（模擬動畫） ---------- */
function observeFossil(el, done) {
  el.innerHTML = `<div class="sim" style="grid-template-columns:1fr"><figure><figcaption id="fsCap">選一個環境，看看貝殼的遭遇</figcaption>
      <canvas width="360" height="240" id="fsC" style="aspect-ratio:3/2;max-width:420px;background:#cfe6f2"></canvas><div class="res" id="fsT">三個環境都要看過喔！</div></figure></div>
    <div class="row"><button class="cta ghost" data-s="ign">🌋 掉進岩漿</button><button class="cta ghost" data-s="sed">🌊 沉到海底</button><button class="cta ghost" data-s="met">⛰️ 受高溫高壓</button></div>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0">這是把很長的時間縮短的模擬動畫。</p>`;
  const g = G.$('#fsC').getContext('2d'), W = 360, H = 240, r0 = U.rng(4), seen = {}, LC = ['#cdb486', '#9a948c', '#c4a878', '#b9b3a2', '#a89270'];
  const dots = Array.from({ length: 70 }, () => [r0(), r0(), r0()]), ssm = (a, b, x) => ss(a, b, x);
  const INFO = { ign: ['火成岩的環境：紅熱的岩漿', '岩漿溫度太高，貝殼被熔掉了，沒有留下化石'], sed: ['沉積岩的環境：海底的泥沙', '泥沙把貝殼蓋住保存下來，壓緊成岩石後，貝殼就變成化石'], met: ['變質岩的環境：地底的高溫高壓', '岩石被擠壓變了樣，裡面的化石被壓扁、變模糊，很難辨認'] };
  let raf = 0, t0 = 0, mode = null, told = false;
  const shell = (x, y, s, a, sx, sy) => {
    g.save(); g.translate(x, y); g.scale(sx || 1, sy || 1); g.globalAlpha = a; g.fillStyle = '#fff6e0'; g.strokeStyle = '#5b4526'; g.lineWidth = 1.6; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, s * .35); g.arc(0, 0, s, Math.PI * 1.08, Math.PI * 1.92); g.closePath(); g.fill(); g.stroke();
    for (let k = 1; k < 6; k++) { const an = Math.PI * (1.08 + .84 * k / 6); g.beginPath(); g.moveTo(0, s * .35); g.lineTo(Math.cos(an) * s, Math.sin(an) * s); g.stroke(); } g.restore();
  };
  const frame = now => {
    const t = (now - t0) / 1000, u = Math.min(1, t / 5.5);
    if (mode === 'sed') {
      g.fillStyle = '#bfe3f5'; g.fillRect(0, 0, W, H); g.fillStyle = '#8f7d60'; g.fillRect(0, 218, W, 22);
      for (let i = 0; i < 4; i++) { const p = ssm(.2 + .15 * i, .35 + .15 * i, u); if (p > 0) { g.fillStyle = LC[i]; g.fillRect(0, 218 - 30 * i - 30 * p, W, 30 * p + .5); g.fillStyle = 'rgba(60,40,20,.35)'; g.fillRect(0, 218 - 30 * i - 30 * p, W, 1.5); } }
      if (u > .15 && u < .82) { g.fillStyle = '#a08455'; for (const d of dots) g.fillRect(d[0] * W, ((d[1] + t * .25 * (.5 + d[2])) % 1) * (218 - 120 * ssm(.2, .8, u)), 2.5, 2.5); }
      shell(180, 30 + 176 * ssm(0, .18, u), 20, 1);
    } else if (mode === 'ign') {
      g.fillStyle = '#40302c'; g.fillRect(0, 0, W, H); const q = g.createLinearGradient(0, 96, 0, H); q.addColorStop(0, '#ffd24a'); q.addColorStop(.5, '#ff8a1f'); q.addColorStop(1, '#d43d17'); g.fillStyle = q;
      g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 12) g.lineTo(x, 100 + 5 * Math.sin(x * .05 + t * 2)); g.lineTo(W, H); g.fill();
      g.fillStyle = 'rgba(255,245,180,.8)'; for (let i = 0; i < 16; i++) { const d = dots[i], y = H - ((d[1] + t * .12 * (.6 + d[2])) % 1) * 130; g.beginPath(); g.arc(d[0] * W, y, 2 + d[2] * 4, 0, 7); g.fill(); }
      const a = 1 - ssm(.34, .78, u); if (a > 0) shell(180, 24 + 130 * ssm(0, .3, u), 20 * (.6 + .4 * a), a);
    } else {
      const k = ssm(.15, .82, u), top = 30 + 38 * k;
      g.fillStyle = '#2f2b33'; g.fillRect(0, 0, W, H); g.save(); g.beginPath(); g.rect(0, top, W, H - top * 2); g.clip();
      for (let i = 0; i < 5; i++) { g.fillStyle = LC[i]; g.beginPath(); const y0 = top + (H - top * 2) * i / 5; g.moveTo(0, H); for (let x = 0; x <= W; x += 10) g.lineTo(x, y0 + 12 * k * Math.sin(x * .035 + i)); g.lineTo(W, H); g.fill(); }
      g.fillStyle = `rgba(255,90,30,${.32 * k})`; g.fillRect(0, 0, W, H); g.restore();
      shell(180, 128, 20, 1 - .82 * k, 1 + 1.1 * k, 1 - .72 * k);
      g.fillStyle = '#fff'; g.font = '900 13px sans-serif'; g.textAlign = 'center'; g.fillText('▼　高溫高壓　▼', W / 2, top / 2 + 5); g.fillText('▲　高溫高壓　▲', W / 2, H - top / 2 + 5);
    }
    if (u >= 1) {
      G.$('#fsT').textContent = INFO[mode][1]; seen[mode] = 1;
      const b = el.querySelector(`[data-s="${mode}"]`); if (!/✓/.test(b.textContent)) b.textContent += ' ✓';
      if (seen.ign && seen.sed && seen.met && !told) { told = true; done(); } return;
    }
    raf = requestAnimationFrame(frame);
  };
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { cancelAnimationFrame(raf); mode = b.dataset.s; G.$('#fsCap').textContent = INFO[mode][0]; G.$('#fsT').textContent = '觀察中……'; t0 = performance.now(); raf = requestAnimationFrame(frame); });
  return () => cancelAnimationFrame(raf);
}

/* ---------- 區域定義 ---------- */
G.registerZone('rocks', {
  hint: '這是把火山和地層「切開」的剖面。點發光的圓點，看看岩石是怎麼形成的！',
  build,
  nodes: [
    { id: 'igneous', num: '1', title: '火成岩', en: 'Igneous Rock', color: '#dc2626', ready: true, at: [VX, 6.3, 0],
      cam: { pos: [4.5, 1.5, 27], target: [4.5, -1.2, 0] },
      learn: `
        <h3>火成岩是怎麼來的？</h3>
        <p>地底深處溫度很高，岩石會熔化成紅熱、會流動的<em>岩漿</em>。岩漿冷卻、凝固後形成的岩石，就叫做<em>火成岩</em>。</p>
        <h3>在哪裡冷卻，差很多！</h3>
        <div class="two"><div><b>🌋 噴出地表</b>岩漿從火山噴出來變成熔岩，碰到空氣或海水，很快就冷卻。</div><div><b>⛰️ 留在地底</b>岩漿沒有噴出來，被周圍的岩石包住，要很久很久才冷卻。</div></div>
        <p>看看左邊的剖面：哪些地方的岩漿冷卻得快？哪些地方冷卻得慢？</p>
        <div class="tip"><b>岩石和礦物：</b>岩漿冷卻時，裡面的成分會結成一粒粒的<b>礦物</b>晶體。許多礦物晶體聚在一起，就組成了岩石。</div>
        <p>冷卻的快慢，會讓岩石長得不一樣嗎？先猜猜看，再用探究活動找答案。</p>`,
      cardsIntro: '<p>三種常見的火成岩。仔細比較它們的顏色和顆粒大小，想想它們是在哪裡冷卻的。</p>',
      cards: [
        { name: '玄武岩', en: 'Basalt', photo: 'img/rocks/basalt.jpg', svg: rockSVG('basalt'), facts: [
          ['外觀', '黑色或深灰色，顆粒非常細，常有氣體留下的小孔洞。'], ['成因', '熔岩流出地表後很快冷卻。'],
          ['特別的地方', '冷卻收縮時會裂成一根根多角形的石柱，稱為柱狀節理。'], ['臺灣哪裡看', '澎湖縣西吉嶼、西嶼鯨魚洞。'], ['世界景點', '北愛爾蘭巨人堤道。']] },
        { name: '安山岩', en: 'Andesite', photo: 'img/rocks/andesite.jpg', svg: rockSVG('andesite'), facts: [
          ['外觀', '灰色，細緻的底色中散布著白色或黑色的小斑點。'], ['成因', '岩漿噴出地表或接近地表時，較快冷卻。'],
          ['特別的地方', '質地堅硬耐用，常做成石階、石板和廟宇的石材。'], ['臺灣哪裡看', '陽明山的大屯火山群、新北市富貴角。'], ['世界景點', '南美洲安地斯山脈。']] },
        { name: '花岡岩', en: 'Granite', photo: 'img/rocks/granite.jpg', svg: rockSVG('granite'), facts: [
          ['外觀', '顏色較淺，白、粉紅、灰、黑的顆粒又大又清楚。'], ['成因', '岩漿留在地底深處，慢慢冷卻。'],
          ['組成礦物', '主要有石英、長石和雲母。'], ['臺灣哪裡看', '連江縣（馬祖）龜島、金門。'], ['世界景點', '美國優勝美地國家公園。']] },
      ],
      poe: {
        question: '同樣的岩漿，一份噴出地表「很快冷卻」，一份留在地底「慢慢冷卻」。哪一份形成的岩石，礦物晶體的顆粒會比較大？',
        options: ['很快冷卻的，顆粒比較大', '慢慢冷卻的，顆粒比較大', '顆粒一樣大，冷卻快慢沒有影響'],
        observeIntro: '按下「開始冷卻」，同時觀察兩份岩漿。注意晶體出現的<b>數量</b>和最後長成的<b>大小</b>。',
        observe: observeCooling,
        explain: {
          q: '根據剛才的觀察，哪一個說法最能解釋你看到的結果？',
          opts: ['慢慢冷卻時，晶體有足夠的時間長大，所以顆粒比較大。', '很快冷卻時，岩漿溫度比較高，所以晶體比較大。', '地底比較擠，所以晶體被壓得比較大。'],
          ans: 0,
          hint: '回想兩邊的畫面：冷卻快的那一邊，晶體來得及長大嗎？影響顆粒大小的關鍵是「時間」。',
          why: '冷卻得慢，晶體有很長的時間慢慢長大，顆粒就大（像花岡岩）；冷卻得快，晶體還來不及長大就凝固了，顆粒就細小（像玄武岩）。'
        }
      }
    },
    { id: 'sedimentary', num: '2', title: '沉積岩', en: 'Sedimentary Rock', color: '#b45309', ready: true, at: [5.2, -1.8, .2],
      cam: { pos: [10.5, .6, 19], target: [10.5, -1.6, 0] },
      learn: `
        <h3>沉積岩是怎麼來的？</h3>
        <p>地表的岩石會慢慢碎裂成礫石、砂和泥。這些<em>碎屑</em>被流水帶到湖泊或海洋等低處，一層一層堆積起來。</p>
        <div class="two"><div><b>① 搬運</b>流水把礫石、砂和泥帶往低處。</div><div><b>② 堆積</b>水流變慢，碎屑沉到水底，越堆越厚。</div>
          <div><b>③ 壓緊</b>下面的碎屑被上面的重量壓得很緊密。</div><div><b>④ 變成岩石</b>經過很長的時間，碎屑黏結成堅硬的沉積岩。</div></div>
        <h3>一層一層的「層理」</h3>
        <p>不同時期堆積的碎屑，顆粒大小和顏色不一樣，所以沉積岩常有一層層的紋路，稱為<em>層理</em>。</p>
        <p>如果岩層沒有被翻動過，越下面的岩層越早堆積，年代也越老。</p>
        <div class="tip"><b>看看剖面：</b>右邊的海底正有泥沙慢慢沉下來。火山右側地底那些一層層不同顏色的岩層，就是沉積岩。</div>
        <p>依照碎屑的種類和顆粒大小，沉積岩有不同的名字。到「圖鑑」認識砂岩、頁岩和石灰岩。</p>`,
      cardsIntro: '<p>三種常見的沉積岩。比較它們的顆粒大小，想想它們是由什麼堆積而成的。</p>',
      cards: [
        { name: '砂岩', en: 'Sandstone', photo: 'img/rocks/sandstone.jpg', svg: rockSVG('sandstone'), facts: [
          ['外觀', '黃褐色或灰色，摸起來粗粗的，看得到一粒粒的砂。'], ['成因', '砂粒堆積後被壓緊、黏結而成。'],
          ['特別的地方', '軟硬不同的砂岩層受到風和海浪侵蝕，會變成奇特的造型。'], ['臺灣哪裡看', '新北市野柳（女王頭）、瑞芳南雅奇岩。']] },
        { name: '頁岩', en: 'Shale', photo: 'img/rocks/shale.jpg', svg: rockSVG('shale'), facts: [
          ['外觀', '灰色或黑色，顆粒細到看不出來，有像書頁一樣的薄層。'], ['成因', '很細的泥堆積、壓緊而成。'],
          ['特別的地方', '容易沿著薄層一片片剝開，遇到水容易變軟、被沖蝕。'], ['臺灣哪裡看', '高雄市田寮月世界：由細泥組成的泥岩和頁岩很像，被雨水沖蝕成光禿的惡地。']] },
        { name: '石灰岩', en: 'Limestone', photo: 'img/rocks/limestone.jpg', svg: rockSVG('limestone'), facts: [
          ['外觀', '白色、灰白色或淡黃色，有時看得到貝殼或珊瑚的碎片。'], ['成因', '珊瑚、貝殼等生物的遺骸堆積、黏結而成。'],
          ['特別的地方', '是製造水泥的重要原料；會被雨水慢慢溶蝕，形成洞穴。'], ['臺灣哪裡看', '屏東縣墾丁、高雄市壽山。']] },
      ] },
    { id: 'metamorphic', num: '3', title: '變質岩', en: 'Metamorphic Rock', color: '#475569', ready: true, at: [3.2, -4.8, .2],
      cam: { pos: [8.5, -2.6, 20], target: [8.5, -4.4, 0] },
      learn: `
        <h3>變質岩是怎麼來的？</h3>
        <p>岩石被埋到地底深處，或是靠近高溫的岩漿時，會受到<em>高溫</em>和<em>高壓</em>的作用。</p>
        <p>岩石沒有熔化，但是裡面礦物的排列和樣子改變了，變成另一種岩石，就叫做<em>變質岩</em>。</p>
        <h3>誰變成誰？</h3>
        <div class="two"><div><b>頁岩 → 板岩</b>變得更堅硬，可以劈成平整的薄板。</div><div><b>石灰岩 → 大理岩</b>顆粒變大、變得亮晶晶。</div></div>
        <div class="two"><div><b>花岡岩 → 片麻岩</b>礦物排成深淺相間的條紋。</div><div><b>原來的岩石</b>火成岩、沉積岩，甚至變質岩，都可能再變質。</div></div>
        <div class="tip"><b>看看剖面：</b>沉積岩層下面顏色較深、有波浪紋路的就是變質岩。它靠近岩漿庫，又被上面厚厚的岩層壓著。</div>
        <p>岩石受到強大的壓力時，裡面的礦物顆粒會怎麼排列？先猜猜看，再用探究活動「擠」給你看。</p>`,
      cardsIntro: '<p>三種常見的變質岩。想想它們原本是哪一種岩石，變質後多了什麼特徵。</p>',
      cards: [
        { name: '板岩', en: 'Slate', photo: 'img/rocks/slate.jpg', svg: rockSVG('slate'), facts: [
          ['外觀', '深灰色或黑色，顆粒很細，表面平整。'], ['成因', '頁岩受到高溫高壓變質而成。'],
          ['特別的地方', '容易劈成平整的薄板，原住民族用它來蓋石板屋。'], ['臺灣哪裡看', '中央山脈、屏東縣霧臺的石板屋。']] },
        { name: '大理岩', en: 'Marble', photo: 'img/rocks/marble.jpg', svg: rockSVG('marble'), facts: [
          ['外觀', '白色或灰白色，常有灰黑色的彎曲花紋，顆粒亮晶晶。'], ['成因', '石灰岩受到高溫高壓變質而成。'],
          ['特別的地方', '磨光後花紋很漂亮，常用來做建材和雕刻。'], ['臺灣哪裡看', '花蓮縣太魯閣峽谷。']] },
        { name: '片麻岩', en: 'Gneiss', photo: 'img/rocks/gneiss.jpg', svg: rockSVG('gneiss'), facts: [
          ['外觀', '深色和淺色的礦物排成一條條相間的條紋。'], ['成因', '花岡岩等岩石受到很高的溫度和壓力變質而成。'],
          ['特別的地方', '條紋是礦物受到擠壓後重新排列的結果。'], ['臺灣哪裡看', '花蓮縣太魯閣、宜蘭縣南澳一帶。']] },
      ],
      poe: {
        question: '岩石裡有許多片狀的礦物，原本方向亂亂的。如果岩石在地底受到「上下方向」的強大壓力，這些片狀礦物會變成怎樣？',
        options: ['還是亂亂的，壓力不會改變礦物的方向', '都立起來，變成和壓力相同的上下方向', '都躺平，排成和壓力方向垂直的一條條紋路'],
        observeIntro: '拖動滑桿慢慢加壓，注意黑色<b>片狀礦物的方向</b>和淺色<b>粒狀礦物的形狀</b>有什麼改變。',
        observe: observeSqueeze,
        explain: {
          q: '根據剛才的觀察，哪一個說法最能解釋你看到的結果？',
          opts: ['礦物被壓力推著轉向、壓扁，最後排成和壓力方向垂直的平行紋路。', '礦物熔化成岩漿，重新冷卻後排成一條一條的。', '壓力讓礦物消失不見，只剩下原本就排整齊的礦物。'],
          ans: 0,
          hint: '回想畫面：礦物有熔化或消失嗎？還是同樣的礦物慢慢「轉了方向」？注意紋路和壓力方向的關係。',
          why: '岩石沒有熔化，但強大的壓力會讓礦物轉向、變扁，排成和壓力方向垂直的平行紋路。板岩能劈成薄板、片麻岩有條紋，都是這樣來的。'
        }
      }
    },
    { id: 'fossil', num: '4', title: '化石', en: 'Fossil', color: '#0f766e', ready: true, at: [9.6, -2.6, .2],
      cam: { pos: [11.6, -.4, 13], target: [11.6, -1.9, 0] },
      learn: `
        <h3>化石是什麼？</h3>
        <p>古代生物死後，<em>遺骸</em>或<em>活動的痕跡</em>被泥沙掩埋，經過很長的時間保存在岩層裡，就成為<em>化石</em>。</p>
        <div class="two"><div><b>🐚 實體化石</b>生物身體的一部分，例如貝殼、骨頭、牙齒、葉子。</div><div><b>👣 生痕化石</b>生物活動留下的痕跡，例如腳印、爬痕、住過的洞穴。</div></div>
        <h3>化石告訴我們什麼？</h3>
        <p>化石就像大地的日記。如果在高山的岩層裡找到貝類化石，表示那裡很久以前曾經是海底。</p>
        <p>岩層沒有被翻動時，越下面的岩層越老，裡面的化石也是越古老的生物留下的。</p>
        <div class="tip"><b>看看剖面：</b>找找看白色的螺旋形化石。它們藏在哪一類岩石的岩層裡？</div>
        <p>火成岩、沉積岩、變質岩，哪一類最容易找到化石？先預測，再看看貝殼在三種環境裡的遭遇。</p>`,
      cardsIntro: '<p>化石分成實體化石和生痕化石。下面三張都是繪圖，看看它們各屬於哪一種。</p>',
      cards: [
        { name: '貝類化石', en: 'Shell fossil', photo: 'img/rocks/fossil-shell.jpg', svg: picSVG('shell'), facts: [
          ['種類', '實體化石。'], ['怎麼形成', '貝類死後，堅硬的外殼被泥沙掩埋，保存在岩層裡。'],
          ['告訴我們', '發現貝類化石的地方，以前可能是海洋或湖泊。'], ['臺灣哪裡看', '新北市野柳的岩層裡，可以找到貝類和海膽的化石。']] },
        { name: '菊石化石', en: 'Ammonite', photo: 'img/rocks/fossil-ammonite.jpg', svg: picSVG('ammonite'), facts: [
          ['種類', '實體化石。'], ['外觀', '螺旋形的外殼，殼上有一道道的紋路。'],
          ['告訴我們', '菊石是住在海裡的古代生物，現在已經滅絕，只能從化石認識牠。']] },
        { name: '腳印與爬痕', en: 'Trace fossil', photo: 'img/rocks/fossil-trace.jpg', svg: picSVG('track'), facts: [
          ['種類', '生痕化石。'], ['怎麼形成', '生物在軟泥上留下腳印、爬痕或洞穴，被泥沙蓋住後保存下來。'],
          ['告訴我們', '可以推測古代生物怎麼走路、怎麼生活。'], ['臺灣哪裡看', '新北市野柳的岩層上，有古代生物鑽洞留下的管狀痕跡。']] },
      ],
      poe: {
        question: '如果要尋找化石，在火成岩、沉積岩、變質岩這三大類岩石中，哪一類最容易找到？',
        options: ['火成岩：岩漿冷卻時把生物包在裡面', '沉積岩：泥沙堆積時把生物的遺骸掩埋起來', '變質岩：高溫高壓把生物壓成化石'],
        observeIntro: '同樣的貝殼，分別遇到三種岩石形成的環境。<b>三個按鈕都按按看</b>，比較貝殼最後有沒有保存下來。',
        observe: observeFossil,
        explain: {
          q: '根據剛才的觀察，為什麼化石最常在沉積岩裡找到？',
          opts: ['沉積岩的顏色比較淺，化石比較容易被看見。', '泥沙堆積時會把遺骸掩埋起來，沒有高溫高壓破壞，遺骸才能保存下來。', '生物只喜歡住在沉積岩附近，不會靠近其他岩石。'],
          ans: 1,
          hint: '回想三段動畫：貝殼在岩漿裡、在高溫高壓下各變成怎樣？只有哪一個環境把貝殼完整「蓋」起來？',
          why: '沉積岩是碎屑一層層堆積而成，過程中能把遺骸掩埋、保存。岩漿的高溫會把遺骸熔掉；變質的高溫高壓會把化石壓扁、破壞，所以很難找到。'
        }
      }
    },
    { id: 'minerals', num: '5', title: '岩石與礦物', en: 'Rocks & Minerals', color: '#7c3aed', ready: true, at: [-8.7, -.8, .2],
      cam: { pos: [-5.2, -1, 14], target: [-5.2, -2.4, 0] },
      learn: `
        <h3>岩石裡一粒粒的是什麼？</h3>
        <p>仔細看花岡岩，上面有灰白、粉紅和黑色的顆粒。這些顆粒是不同的<em>礦物</em>。</p>
        <p><em>岩石是由礦物組成的。</em>把花岡岩「拆開」來看，主要有石英、長石和雲母三種礦物：</p>
        ${splitSVG()}
        <p>有的岩石由好幾種礦物組成，像花岡岩；有的岩石主要只有一種礦物，像大理岩主要是方解石。</p>
        <h3>岩石上的裂縫：節理</h3>
        <p>岩石冷卻收縮或受到外力時，會裂出一道道規則的裂縫，稱為<em>節理</em>。玄武岩一根根的多角形石柱，就是柱狀節理。</p>
        <div class="tip"><b>想認識更多礦物？</b>回到大地圖，前往第 3 區「礦物與硬度」，比比看哪一種礦物比較硬。</div>`,
      cardsIntro: '<p>組成花岡岩的三種礦物。比較它們的顏色、光澤和形狀。</p>',
      cards: [
        { name: '石英', en: 'Quartz', photo: 'img/minerals/quartz.jpg', svg: picSVG('quartz'), facts: [
          ['外觀', '透明或白色，像玻璃一樣有光澤。'], ['特徵', '很堅硬，結晶完整時是六角形的柱子。'], ['生活應用', '製造玻璃的原料。']] },
        { name: '長石', en: 'Feldspar', photo: 'img/minerals/feldspar.jpg', svg: picSVG('feldspar'), facts: [
          ['外觀', '白色或粉紅色，不透明，有平整的面。'], ['特徵', '花岡岩裡數量最多的礦物。'], ['生活應用', '製作陶瓷的原料。']] },
        { name: '黑雲母', en: 'Biotite', photo: 'img/minerals/biotite.jpg', svg: picSVG('mica'), facts: [
          ['外觀', '黑色或深褐色，表面亮亮的。'], ['特徵', '可以剝成一片片很薄的薄片。'], ['同一家族', '白雲母顏色淺、也能剝成薄片，都屬於雲母。']] },
      ] },
  ],
  // 檢核題：level 為 PIRLS 層次（1 提取訊息／2 推論訊息／3 詮釋整合／4 比較評估）
  quiz: [
    { id: 'rocks.sedimentary.1', about: '沉積岩', level: 1, q: '根據沉積岩「認識」的說明，沉積岩是怎麼形成的？',
      opts: ['碎屑被流水帶到低處，堆積、壓緊後形成', '岩漿冷卻、凝固後形成', '岩石受到高溫高壓而改變', '海水蒸發後留下的鹽結成'], ans: 0, why: '說明中提到：碎屑被流水帶到低處一層層堆積，再被壓緊、黏結，就變成沉積岩。' },
    { id: 'rocks.minerals.1', about: '岩石與礦物', level: 1, q: '根據「岩石與礦物」的認識和圖鑑，花岡岩主要是由哪三種礦物組成的？',
      opts: ['石英、長石、雲母', '石墨、滑石、石膏', '砂、泥、礫石', '貝殼、珊瑚、骨頭'], ans: 0, why: '把花岡岩「拆開」來看，主要有石英、長石和雲母三種礦物。岩石是由礦物組成的。' },
    { id: 'rocks.igneous.1', about: '火成岩', level: 2, q: '小安在澎湖海邊看到一種黑色的火成岩，表面很細緻，幾乎看不出顆粒。根據火成岩的「探究」，這種岩石最可能是怎麼形成的？',
      opts: ['岩漿在地底深處慢慢冷卻', '熔岩流出地表後很快冷卻', '泥沙在海底一層層堆積', '岩石受到高溫高壓而改變'], ans: 1, why: '顆粒很細，表示晶體來不及長大，可以推論它冷卻得很快，是熔岩流出地表後形成的（玄武岩）。' },
    { id: 'rocks.sedimentary.2', about: '沉積岩', level: 2, q: '小美在山壁上看到一層層整齊相疊的沉積岩，岩層沒有被翻動過。根據沉積岩的「認識」，哪一層最早堆積？',
      opts: ['最上面的一層', '中間的一層', '最下面的一層', '每一層都是同時堆積的'], ans: 2, why: '碎屑是一層一層往上堆的，先堆積的在下面。所以岩層沒有被翻動時，最下面的一層最早堆積、年代最老。' },
    { id: 'rocks.metamorphic.1', about: '變質岩', level: 3, q: '把變質岩的探究結果和圖鑑放在一起想：片麻岩有深淺相間的條紋，最合理的解釋是什麼？',
      opts: ['不同顏色的泥沙一層層堆積出來的', '岩漿流動時留下的痕跡', '被河水沖刷磨出來的紋路', '岩石受到高壓，礦物轉向、重新排列成平行的條紋'], ans: 3, why: '探究中看到：加壓後礦物會轉向、排成平行紋路；圖鑑說片麻岩是受到高溫高壓變質而成。兩者合起來就能解釋條紋的由來。' },
    { id: 'rocks.fossil.1', about: '化石', level: 4, q: '小華想找化石，有兩個地點可以選：甲是熔岩冷卻形成的玄武岩海岸；乙是砂岩和頁岩層層相疊的海岸。根據化石的「探究」，哪一個判斷最合理？',
      opts: ['選甲，岩漿會把生物完整包起來變成化石', '選乙，沉積岩形成時能把遺骸掩埋、保存下來', '兩個地點一樣，化石在每一類岩石裡都一樣多', '都不用去，化石只會出現在變質岩裡'], ans: 1, why: '沉積岩是碎屑堆積而成，能把遺骸掩埋保存；岩漿的高溫會把遺骸熔掉。比較兩地的岩石成因，乙比較可能找到化石。' },
  ]
});
})();
