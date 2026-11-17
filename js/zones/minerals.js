/* 區域 3：礦物與硬度 —— 採石坑與晶洞（定格場景）
   五個節點：礦物是什麼、礦物圖鑑、硬度比一比、莫氏硬度表、辨認礦物；本區挑戰 6 題 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, { ss, fbm, clamp } = U;

/* ---------- 採石坑外形：中央是坑底（y=0），向外是三層階梯狀的岩壁，前方留一個缺口 ---------- */
const X0 = -11, X1 = 11, Z0 = -8, Z1 = 7.5, YB = -3.2, PZ = 1;
const dist = (x, z) => Math.pow(Math.pow(Math.abs(x) / 1.3, 4) + Math.pow(Math.abs(z - PZ), 4), .25);
function height(x, z) {
  const L = Math.max(0, (dist(x, z) - 4.2) / 1.3), k = Math.floor(L);
  let h = Math.min(3, k + ss(0, .22, L - k));
  h *= 1 - ss(4.2, 6.2, z) * ss(5.2, 3.2, Math.abs(x));
  return h + (fbm(x * .5 + 3, z * .5, 3) - .5) * .5 * ss(2.6, 3, h) + (fbm(x * 2, z * 2, 2) - .5) * .06;
}
const SX0 = -2.4, SW = .72, SZ = -2.4, SH = .32;                   // 莫氏硬度階梯
const TX = 1.2, TZ = 2.2;                                           // 標本桌
const GEO = [-4.2, 1.25, 1.6];                                      // 晶洞
const ATLAS = [['quartz', '石英'], ['feldspar', '長石'], ['biotite', '黑雲母'], ['muscovite', '白雲母'], ['calcite', '方解石'], ['graphite', '石墨'], ['talc', '滑石'], ['sulfur', '硫磺'], ['gypsum', '石膏'], ['pyrite', '黃鐵礦']];
const MOHS = [['talc', '滑石'], ['gypsum', '石膏'], ['calcite', '方解石'], ['fluorite', '螢石'], ['apatite', '磷灰石'], ['orthoclase', '正長石'], ['quartz', '石英'], ['topaz', '黃玉'], ['corundum', '剛玉'], ['diamond', '金剛石']];
const MOHS_PICS = { fluorite: [['fluorite', '白色（立方體）'], ['fluorite-green', '綠色'], ['fluorite-octa', '八面體'], ['fluorite-octa-group', '八面體（一群）']], corundum: [['corundum-rough', '原礦（藍寶石）'], ['corundum', '切磨後的寶石']] };
const ATLAS_PICS = { biotite: [['biotite', '一片薄片'], ['mica-mixed', '和白雲母長在一起']], pyrite: [['pyrite', '立方體'], ['pyrite-group', '一群小晶體'], ['pyrite-striated', '晶面上的條紋']], muscovite: [['muscovite', '一片薄片'], ['muscovite-rose', '原礦'], ['muscovite-cluster', '原礦']] };

/* 地表貼圖：逐像素依高度與坡度上色（坑底、平臺、岩壁的層狀紋、坑緣草地） */
function groundTexture(S) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const N = S + 1, H = new Float32Array(N * N), dx = (X1 - X0) / S, dz = (Z1 - Z0) / S;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = height(X0 + i * dx, Z0 + j * dz);
  const ST = [[185, 164, 142], [160, 146, 136], [196, 174, 147], [150, 138, 130]];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const h = H[j * N + i], sl = Math.hypot((H[j * N + i + 1] - h) / dx, (H[(j + 1) * N + i] - h) / dz), x = X0 + i * dx, z = Z0 + j * dz;
    let r, gg, b; const hs = U.hash(i, j);
    if (h > 2.7) { const t = clamp(fbm(x * .7, z * .7, 3) * 1.6 - .3, 0, 1); r = 127 - 64 * t; gg = 184 - 46 * t; b = 90 - 21 * t; }
    else { const q = (.88 + .24 * fbm(x * 1.5, z * 1.5, 3)) * (hs > .93 ? .72 : hs < .05 ? 1.1 : 1), w = h < .4 ? 1 : 0; r = (205 + 9 * w) * q; gg = (198 + 5 * w) * q; b = (188 - 2 * w) * q; }
    const k = ss(.5, 1.6, sl); if (k > 0) { const s = ST[Math.floor(h * 3.2 + fbm(x * .8, z * .8, 2) * 2) % 4], q = .76 + .3 * U.vnoise(x * 9, h * 14); r += (s[0] * q - r) * k; gg += (s[1] * q - gg) * k; b += (s[2] * q - b) * k; }
    const o = (j * S + i) * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
}
function graniteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = U.rng(55);
  g.fillStyle = '#e2cabd'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const q = r(); g.fillStyle = q < .32 ? '#f7f3ea' : q < .6 ? '#dc9d92' : q < .82 ? '#b9b4ad' : '#2d2a2b'; g.beginPath(); g.ellipse(r() * 256, r() * 256, 2 + r() * 5, 1.5 + r() * 4, r() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* 礦物的小模型（標本桌、硬度階梯共用） */
function mineralModel(k) {
  const T = THREE, g = new T.Group();
  const mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .3, flatShading: true }, o || {}));
  const add = (geo, m, p, r, s) => { const x = new T.Mesh(geo, m); if (p) x.position.set(p[0], p[1], p[2]); if (r) x.rotation.set(r[0], r[1], r[2]); if (s) x.scale.set(s[0], s[1], s[2]); x.castShadow = true; g.add(x); return x; };
  const prism = (m, r, h, n, p, rot) => { const q = new T.Group(), a = new T.Mesh(new T.CylinderGeometry(r, r * 1.12, h, n).translate(0, h / 2, 0), m), b = new T.Mesh(new T.ConeGeometry(r, r * 1.5, n).translate(0, h + r * .75, 0), m); a.castShadow = b.castShadow = true; q.add(a, b); q.position.set(p[0], p[1], p[2]); if (rot) q.rotation.set(rot[0], rot[1], rot[2]); g.add(q); };
  const sheets = m => { for (let i = 0; i < 6; i++) add(new T.CylinderGeometry(.24, .24, .022, 6), m, [Math.sin(i * 2) * .02, .02 + i * .03, Math.cos(i * 3) * .02], [0, i * .22, 0]); };
  const clear = (c, o) => mat(c, Object.assign({ transparent: true, opacity: .86, roughness: .1 }, o || {}));
  if (k === 'quartz') { const m = clear('#f4f8fc', { emissive: '#8fa6c0', emissiveIntensity: .12 }); prism(m, .085, .36, 6, [0, 0, 0]); prism(m, .06, .26, 6, [-.12, 0, .04], [0, .3, .35]); prism(m, .055, .22, 6, [.12, 0, -.02], [.1, 0, -.4]); }
  if (k === 'feldspar') add(new T.BoxGeometry(.42, .28, .3), mat('#e7a797', { roughness: .45 }), [0, .15, 0], [0, .35, .06]);
  if (k === 'biotite') sheets(mat('#2a272c', { roughness: .22, metalness: .25 }));
  if (k === 'muscovite') sheets(mat('#dcd6c6', { roughness: .18, metalness: .3, emissive: '#6b6654', emissiveIntensity: .2 }));
  if (k === 'calcite') { const geo = new T.BoxGeometry(.34, .3, .3); geo.applyMatrix4(new T.Matrix4().set(1, .38, 0, 0, 0, 1, 0, 0, 0, .2, 1, 0, 0, 0, 0, 1)); add(geo, clear('#fbf6dc'), [0, .15, 0], [0, .4, 0]); }
  if (k === 'graphite') add(new T.IcosahedronGeometry(.22, 0), mat('#474b54', { roughness: .32, metalness: .45 }), [0, .13, 0], [.3, .5, 0], [1.2, .6, 1]);
  if (k === 'talc') add(new T.IcosahedronGeometry(.22, 2), mat('#d5e6d3', { roughness: .75, flatShading: false }), [0, .14, 0], null, [1.2, .65, 1]);
  if (k === 'sulfur') { const m = mat('#f2d21f', { roughness: .5, emissive: '#6b5a00', emissiveIntensity: .25 }); add(new T.OctahedronGeometry(.16), m, [0, .17, 0], [0, .4, 0], [1, 1.25, 1]); add(new T.OctahedronGeometry(.11), m, [.17, .1, .05], [.3, 0, .4]); add(new T.OctahedronGeometry(.1), m, [-.16, .09, -.03], [0, 1, -.4]); }
  if (k === 'gypsum') { const m = clear('#f6f2ea', { opacity: .9 }); for (const a of [-.5, -.15, .2, .55]) add(new T.BoxGeometry(.11, .42, .04), m, [Math.sin(a) * .18, .19, a * .05], [0, a, -a]); }
  if (k === 'pyrite') { const m = mat('#e2bd4e', { roughness: .28, metalness: .35, emissive: '#5a4310', emissiveIntensity: .35 }); add(new T.BoxGeometry(.24, .24, .24), m, [0, .12, 0], [0, .5, 0]); add(new T.BoxGeometry(.16, .16, .16), m, [.2, .08, .06], [0, .1, 0]); add(new T.BoxGeometry(.13, .13, .13), m, [-.16, .1, -.08], [.4, .8, .2]); }
  if (k === 'fluorite') add(new T.OctahedronGeometry(.2), clear('#9b7fe0', { emissive: '#3b2a80', emissiveIntensity: .3 }), [0, .2, 0], [0, .5, 0]);
  if (k === 'apatite') add(new T.CylinderGeometry(.12, .12, .34, 6), clear('#3fb6a8'), [0, .17, 0], [0, .3, 0]);
  if (k === 'topaz') prism(clear('#f0b24a', { emissive: '#7a4a00', emissiveIntensity: .2 }), .12, .26, 4, [0, 0, 0], [0, .6, 0]);
  if (k === 'corundum') add(new T.CylinderGeometry(.09, .14, .34, 6), mat('#c8325a', { roughness: .2, emissive: '#5a0a20', emissiveIntensity: .3 }), [0, .17, 0]);
  if (k === 'orthoclase') add(new T.BoxGeometry(.42, .28, .3), mat('#e7a797', { roughness: .45 }), [0, .15, 0], [0, .35, .06]);
  if (k === 'diamond') add(new T.OctahedronGeometry(.18), clear('#eef8ff', { roughness: .02, emissive: '#9cc8ff', emissiveIntensity: .35 }), [0, .2, 0], [0, .4, 0]);
  add(new T.SphereGeometry(.3, 8, 6), new T.MeshBasicMaterial({ visible: false }), [0, .2, 0]).castShadow = false;      // 方便游標指到的範圍
  return g;
}

/* ---------- 建立場景 ---------- */
function build() {
  const T = THREE, scene = new T.Scene(); scene.background = U.skyTexture('#74b8ea', '#f1ecdf'); scene.fog = new T.Fog(0xe8eef0, 60, 150);
  U.addSun(scene, 16); scene.add(U.groundShadow(40, 30, YB - .05));
  const anim = [], picks = [], rnd = U.rng(23), detail = U.detailTexture(8, 6);
  // 地形
  const NX = 132, NZ = 94, pos = [], uvs = [], idx = [], hs = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = X0 + i * (X1 - X0) / NX, z = Z0 + j * (Z1 - Z0) / NZ, h = height(x, z); hs.push(h); pos.push(x, h, z); uvs.push(i / NX, j / NZ); }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  scene.add(U.shadowed(new T.Mesh(tg, new T.MeshStandardMaterial({ map: groundTexture(G.coarse ? 256 : 512), roughness: .95, bumpMap: detail, bumpScale: 2 }))));
  const P = (i, j) => [X0 + i * (X1 - X0) / NX, hs[j * (NX + 1) + i], Z0 + j * (Z1 - Z0) / NZ], edge = [];
  for (let i = 0; i <= NX; i++) edge.push(P(i, 0)); for (let j = 1; j <= NZ; j++) edge.push(P(NX, j)); for (let i = NX - 1; i >= 0; i--) edge.push(P(i, NZ)); for (let j = NZ - 1; j >= 0; j--) edge.push(P(0, j));
  scene.add(new T.Mesh(U.skirt(edge, YB, (x, y, z, d) => [d / 14, 1 - (3.2 - y) / 6.4 * .62]), new T.MeshStandardMaterial({ map: U.strataTexture(), bumpMap: U.detailTexture(3, 2), bumpScale: 1.5, roughness: 1, side: T.DoubleSide })));
  // 坑緣的樹與天上的雲
  const trees = []; for (let k = 0; k < 2000 && trees.length < 150; k++) { const x = X0 + .3 + rnd() * (X1 - X0 - .6), z = Z0 + .3 + rnd() * (Z1 - Z0 - .6), h = height(x, z); if (h > 2.82) trees.push([x, h, z, 1 + rnd() * .8, rnd() < .5 ? 0 : 1]); }
  U.plantTrees(scene, trees, rnd, 1.1);
  [[-7, 9.5, -6, 4.2], [6, 10.5, -4, 3.4]].forEach(([x, y, z, s], i) => { const c = U.cloud(s, s * .36, s * .6, 7, rnd); c.position.set(x, y, z); scene.add(c); anim.push(t => { c.position.x = x + Math.sin(t * .05 + i * 2) * 2.5; }); });

  // 晶洞：切開的空心岩球，內壁長滿石英晶體
  const granite = graniteTexture(), geo = new T.Group(); geo.position.set(...GEO); geo.rotation.set(-.32, .5, 0);
  const half = r => new T.SphereGeometry(r, 36, 22, Math.PI, Math.PI);
  geo.add(U.shadowed(new T.Mesh(half(1.6), new T.MeshStandardMaterial({ color: 0x8a7b6c, roughness: 1, bumpMap: U.detailTexture(4, 3), bumpScale: 3 }))));
  geo.add(new T.Mesh(half(1.46), new T.MeshStandardMaterial({ color: 0x6b4fa8, emissive: 0x3a2470, emissiveIntensity: .55, roughness: .6, side: T.BackSide })));
  geo.add(new T.Mesh(new T.RingGeometry(1.46, 1.6, 44), new T.MeshStandardMaterial({ color: 0xe8e2d8, roughness: .5 })));
  geo.add(new T.Mesh(new T.RingGeometry(1.34, 1.46, 44), new T.MeshStandardMaterial({ color: 0xa9b4c8, roughness: .35 })));
  const cgeo = U.merge([[new T.CylinderGeometry(.07, .085, .5, 6).translate(0, .25, 0), '#ffffff'], [new T.ConeGeometry(.07, .16, 6).translate(0, .58, 0), '#ffffff']]);
  const cry = new T.InstancedMesh(cgeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .12, flatShading: true, emissive: 0x3a1c78, emissiveIntensity: .4 }), 240);
  { const M = new T.Matrix4(), Q = new T.Quaternion(), Q2 = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), D = new T.Vector3(), S = new T.Vector3(), up = new T.Vector3(0, 1, 0), c = new T.Color(), c2 = new T.Color('#9b6de0');
    for (let i = 0; i < 240; i++) { const th = Math.acos(1 - rnd()), ph = rnd() * 6.283; D.set(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), -Math.cos(th)); V.copy(D).multiplyScalar(1.42);
      Q.setFromUnitVectors(up, D.clone().negate()); Q.multiply(Q2.setFromEuler(E.set((rnd() - .5) * .7, 0, (rnd() - .5) * .7))); const s = .55 + rnd() * .8; M.compose(V, Q, S.set(s, s * (.5 + rnd() * .8), s)); cry.setMatrixAt(i, M); cry.setColorAt(i, c.set('#ffffff').lerp(c2, rnd())); } }
  geo.add(cry); const gl = new T.PointLight(0xb48cff, 5, 6); gl.position.set(0, 0, -.2); geo.add(gl); scene.add(geo);
  anim.push(t => { gl.intensity = 5 + 2 * Math.sin(t * 1.3); });

  // 莫氏硬度階梯：十級，一級比一級高
  const stepMat = new T.MeshStandardMaterial({ color: 0xd9d2c8, roughness: .9, bumpMap: U.detailTexture(1, 1), bumpScale: 1.5 });
  MOHS.forEach(([key], k) => { const i = k + 1, h = SH * i, x = SX0 + (i - .5) * SW;
    const b = U.shadowed(new T.Mesh(new T.BoxGeometry(SW - .03, h, 1.2), stepMat)); b.position.set(x, h / 2, SZ); scene.add(b);
    const nc = document.createElement('canvas'); nc.width = nc.height = 64; const ng = nc.getContext('2d'); ng.fillStyle = '#7c3aed'; ng.beginPath(); ng.arc(32, 32, 30, 0, 7); ng.fill(); ng.fillStyle = '#fff'; ng.font = '900 38px sans-serif'; ng.textAlign = 'center'; ng.textBaseline = 'middle'; ng.fillText(i, 32, 35);
    const nt = new T.CanvasTexture(nc); nt.colorSpace = T.SRGBColorSpace; const np = new T.Mesh(new T.PlaneGeometry(.3, .3), new T.MeshBasicMaterial({ map: nt, transparent: true, toneMapped: false })); np.position.set(x, Math.max(.15, h - .2), SZ + .61); scene.add(np);
    const m = mineralModel(key); m.position.set(x, h, SZ + .05); m.scale.setScalar(1.15); m.userData = { s: 1.15, pick: { node: 'mohs', idx: k } }; picks.push(m); scene.add(m); });

  // 標本桌：十種礦物
  const wood = new T.MeshStandardMaterial({ color: 0x8a6a48, roughness: .8, bumpMap: U.detailTexture(2, 1), bumpScale: 1 });
  const slab = U.shadowed(new T.Mesh(new T.BoxGeometry(5, .16, 1.7), wood)); slab.position.set(TX, .9, TZ); scene.add(slab);
  for (const sx of [-2.1, 2.1]) { const leg = U.shadowed(new T.Mesh(new T.BoxGeometry(.22, .84, 1.4), wood)); leg.position.set(TX + sx, .42, TZ); scene.add(leg); }
  const specAt = i => [TX + (i % 5 - 2) * .95, .98, TZ + (i < 5 ? -.4 : .4)];
  ATLAS.forEach(([key], i) => { const m = mineralModel(key), p = specAt(i); m.position.set(...p); m.scale.setScalar(1.45); m.userData = { s: 1.45, pick: { node: 'atlas', idx: i } }; picks.push(m); scene.add(m); });

  // 刻劃臺、花岡岩塊、神祕礦物箱
  const ped = U.shadowed(new T.Mesh(new T.CylinderGeometry(.62, .74, .8, 7), new T.MeshStandardMaterial({ color: 0x9a9088, roughness: 1, flatShading: true }))); ped.position.set(-2, .4, 4); scene.add(ped);
  [['calcite', -.22], ['quartz', .24]].forEach(([k, dx]) => { const m = mineralModel(k); m.position.set(-2 + dx, .8, 4); m.scale.setScalar(1.3); scene.add(m); });
  const bg = new T.IcosahedronGeometry(.85, 1), bp = bg.attributes.position; for (let i = 0; i < bp.count; i++) { const q = .85 + U.hash(Math.round(bp.getX(i) * 9), Math.round(bp.getY(i) * 9 + bp.getZ(i) * 5)) * .3; bp.setXYZ(i, bp.getX(i) * q, bp.getY(i) * q * .8, bp.getZ(i) * q); } bg.computeVertexNormals();
  const boulder = U.shadowed(new T.Mesh(bg, new T.MeshStandardMaterial({ map: granite, roughness: .85, flatShading: true }))); boulder.position.set(-3.9, .5, 4.5); scene.add(boulder);
  const crate = U.shadowed(new T.Mesh(new T.BoxGeometry(1, .7, 1), wood)); crate.position.set(4.6, .35, .6); crate.rotation.y = .3; scene.add(crate);
  const mys = mineralModel('pyrite'); mys.position.set(4.5, .7, .6); mys.scale.setScalar(1.5); scene.add(mys);
  const mag = new T.Group(), mm = new T.MeshStandardMaterial({ color: 0x2f3640, roughness: .4 }); mag.add(new T.Mesh(new T.TorusGeometry(.2, .03, 8, 24), mm), new T.Mesh(new T.CylinderGeometry(.03, .03, .3, 8).translate(0, -.35, 0), mm), new T.Mesh(new T.CircleGeometry(.2, 24), new T.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: .35, roughness: .05, side: T.DoubleSide })));
  mag.position.set(5, 1.05, .75); mag.rotation.set(-.5, -.3, -.5); mag.traverse(o => { o.castShadow = true; }); scene.add(mag);

  // 晶體的閃光
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sg = sc.getContext('2d'), rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.25, 'rgba(255,255,255,.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = rg; sg.fillRect(0, 0, 64, 64);
  sg.strokeStyle = 'rgba(255,255,255,.9)'; sg.lineWidth = 2; sg.beginPath(); sg.moveTo(32, 2); sg.lineTo(32, 62); sg.moveTo(2, 32); sg.lineTo(62, 32); sg.stroke();
  const stex = new T.CanvasTexture(sc), spots = [];
  for (let i = 0; i < 9; i++) spots.push([GEO[0] + (rnd() - .5) * 1.9, GEO[1] + .1 + (rnd() - .3) * 1.3, GEO[2] - .3 + rnd() * .5]);
  spots.push(specAt(0), specAt(9), specAt(4), [SX0 + 9.5 * SW, SH * 10 + .25, SZ + .1], [SX0 + 6.5 * SW, SH * 7 + .4, SZ + .1], [4.5, 1.1, .6]);
  spots.forEach((p, i) => { const s = new T.Sprite(new T.SpriteMaterial({ map: stex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); s.position.set(p[0], p[1] + (i >= 9 ? .25 : 0), p[2] + .15); scene.add(s);
    anim.push(t => { const k = Math.pow(Math.max(0, Math.sin(t * (1.1 + U.hash(i, 2)) + i * 1.9)), 6); s.scale.setScalar(.05 + .55 * k); s.material.opacity = k; }); });

  /* 節點圓點與解說標籤 */
  const z = G.zones.minerals, def = G.zoneDef('minerals');
  for (const n of z.nodes) G.addLabel(`<b>${n.num}</b><span>${n.title}</span>`, 'node' + (n.ready ? '' : ' soon'), n.at, { color: n.color || def.color, onClick: () => G.openNode(n.id) });
  const tags = { what: [
    G.addLabel('晶洞<small>岩石的空洞裡，長出一根根石英晶體</small>', 'tag', [GEO[0], .25, GEO[2] + 1.5]),
    G.addLabel('花岡岩<small>由石英、長石、雲母等礦物組成</small>', 'tag', [-3.9, -.1, 5.3]),
    G.addLabel('採石坑<small>人們在這裡開採岩石和礦物</small>', 'tag', [-7.6, 1.5, -1.5]),
  ], atlas: ATLAS.map(([, name], i) => { const p = specAt(i); return G.addLabel(name, 'tag', i < 5 ? [p[0], 1.95, p[2]] : [p[0], .52, TZ + 1]); }),
    scratch: [G.addLabel('互相刻劃<small>較軟的礦物會留下凹痕</small>', 'tag', [-2, .1, 4.8])],
    mohs: MOHS.map(([, name], k) => G.addLabel(`${k + 1}<small>${name}</small>`, 'tag', [SX0 + (k + .5) * SW, SH * (k + 1) + .95, SZ])),
    identify: [G.addLabel('神祕礦物<small>用顏色、光澤、觸感、晶形、硬度來判斷</small>', 'tag', [4.6, -.05, 1.3])] };

  let hot = null;
  const pickAt = ray => { if (!ray) return null; const hit = ray.intersectObjects(picks, true)[0]; let o = hit && hit.object; while (o && !o.userData.pick) o = o.parent; return o || null; };
  const setHot = o => { if (o === hot) return false; if (hot) hot.scale.setScalar(hot.userData.s); hot = o; if (o) o.scale.setScalar(o.userData.s * 1.25); G.canvas.style.cursor = o ? 'pointer' : ''; return true; };
  const jump = (o, open) => { const q = o.userData.pick; if (G.state.nodeId !== q.node) { if (!open) return; G.openNode(q.node); } if (G.ui.tab() !== 'cards') G.ui.show('cards'); if (pg) pg.go(q.idx); };
  return {
    scene, home: { pos: [0, 11, 21], target: [0, 1, 0] },
    view: { minDist: 5, maxDist: 55, maxPolar: Math.PI * .47, pan: { x: [-9, 9], y: [0, 4], z: [-6, 6] } },
    onNode: id => { for (const k in tags) tags[k].forEach(L => L.el.classList.toggle('show', k === id)); },
    update(dt, t) { for (const f of anim) f(t); },
    onHover: ray => { const o = pickAt(ray); if (setHot(o) && o) jump(o, false); },      // 游標移到礦物：節點已開啟時，字卡跳到那一種
    onTap: ray => { const o = pickAt(ray); if (o) jump(o, true); },                       // 點一下（平板）：開啟節點並跳到那一張字卡
    dispose() { G.canvas.style.cursor = ''; pg = null; U.dispose(scene); }
  };
}

/* ---------- 礦物繪圖（SVG）：沒有實物照片時顯示 ---------- */
function minSVG(k) {
  const o = [], P = (d, f, s = '#55606e', w = 2) => o.push(`<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`);
  const cube = (x, y, s, c, st) => { const a = s * .87, b = s * .5; P(`M${x} ${y}l${a} ${-b} ${a} ${b} ${-a} ${b}Z`, c[0], st); P(`M${x} ${y}l${a} ${b}v${s}l${-a} ${-b}Z`, c[1], st); P(`M${x + a} ${y + b}l${a} ${-b}v${s}l${-a} ${b}Z`, c[2], st); };
  const sheets = (c1, c2, st, hl) => { for (let i = 0; i < 8; i++) { const y = 160 - i * 12, x = 46 + i * 5; P(`M${x} ${y}L${x + 70} ${y - 34} ${x + 216} ${y - 22} ${x + 150} ${y + 16}Z`, i % 2 ? c1 : c2, st, 1.2); } P('M118 54L176 42 244 48', 'none', hl, 3); };
  if (k === 'quartz') { P('M40 186Q160 150 280 186Z', '#8b8f98', '#5d626b'); for (const [x, w, h, a] of [[96, 40, 118, -15], [160, 52, 150, 2], [226, 36, 102, 17]]) { const t = 180 - h; o.push(`<g transform="rotate(${a} ${x} 180)">`); P(`M${x - w / 2} 180V${t + w * .5}L${x} ${t}V180Z`, '#f6fafe', '#7b8ba0', 1.6); P(`M${x + w / 2} 180V${t + w * .5}L${x} ${t}V180Z`, '#cddbeb', '#7b8ba0', 1.6); o.push('</g>'); } }
  if (k === 'feldspar') { P('M70 70L190 44 262 76 142 104Z', '#f6d9cf', '#7d5248'); P('M70 70L142 104 142 172 70 134Z', '#dfa596', '#7d5248'); P('M142 104L262 76 262 142 142 172Z', '#ecbcae', '#7d5248'); P('M94 82V146M118 93V159M172 97V164M204 90V156M236 82V148', 'none', '#b97f71', 1.3); }
  if (k === 'biotite') sheets('#2a292d', '#3d3a40', '#a5a2ab', 'rgba(255,255,255,.75)');
  if (k === 'muscovite') sheets('#e9e4d3', '#cfc9b6', '#8c8674', '#fff');
  if (k === 'calcite') { o.push('<g transform="translate(86 0) skewX(-18)">'); cube(70, 78, 82, ['#fffdf2', '#e6e0c6', '#f3eed8'], '#9d9574'); P('M112 102v82M183 102v82M70 119l71 41 71-41', 'none', '#c9c2a2', 1.2); o.push('</g>'); }
  if (k === 'graphite') { P('M60 150L40 100 90 50 190 36 270 70 286 130 220 164 110 168Z', '#3d4149', '#1f2226'); P('M40 100L150 92 286 130M90 50L150 92 110 168M190 36L150 92 220 164', 'none', '#5d636e', 1.5); P('M70 96L150 84 190 50M160 100L262 122', 'none', '#aab2be', 3); P('M196 188q9-12 18 0t18 0t18 0t18 0t18 0', 'none', '#3a3a3a', 3.5); }
  if (k === 'talc') { P('M50 130C40 80 100 40 170 44S290 80 276 130 200 176 140 172 60 168 50 130Z', '#d9e8d6', '#8fa58c'); P('M92 100C122 70 190 62 240 86', 'none', '#ffffff', 6); P('M100 142C150 152 210 148 250 126', 'none', '#b7cbb4', 3); }
  if (k === 'sulfur') { P('M36 184L58 142 262 136 288 184Z', '#7b7468', '#544e44'); for (const [x, y, s] of [[110, 112, 50], [190, 96, 66], [246, 132, 36], [62, 138, 30]]) { P(`M${x} ${y - s}L${x + s * .7} ${y} ${x} ${y + s} ${x - s * .7} ${y}Z`, '#efcb12', '#a78a08'); P(`M${x} ${y - s}L${x - s * .7} ${y} ${x} ${y + s} ${x + s * .2} ${y}Z`, '#fbe45a', '#a78a08', 1.3); } }
  if (k === 'gypsum') { for (const a of [-38, -14, 10, 34]) { o.push(`<g transform="rotate(${a} 160 186)">`); P('M144 186L148 54 162 30 176 60 174 186Z', '#fbf8f0', '#a59f90', 1.6); P('M160 40V180', 'none', '#d4cebf', 1.2); o.push('</g>'); } P('M70 190Q160 168 250 190Z', '#b9b2a4', '#8a8376'); }
  if (k === 'pyrite') { const c = ['#f6e08c', '#b8963a', '#d9b955'], st = '#6e5a1c'; cube(142, 66, 70, c, st); cube(52, 98, 54, c, st); cube(118, 128, 36, c, st); P('M160 84l40 -23M176 93l40 -23M66 112l30 -17', 'none', '#fff7c8', 1.6); }
  const oct = (cx, cy, w, h, c, st) => { const fx = cx - w * .22, fy = cy + h * .16; P(`M${cx} ${cy - h}L${cx - w} ${cy} ${fx} ${fy}Z`, c[0], st, 1.6); P(`M${cx} ${cy - h}L${fx} ${fy} ${cx + w} ${cy}Z`, c[1], st, 1.6); P(`M${cx - w} ${cy}L${cx} ${cy + h} ${fx} ${fy}Z`, c[2], st, 1.6); P(`M${fx} ${fy}L${cx} ${cy + h} ${cx + w} ${cy}Z`, c[3], st, 1.6); };
  const hexp = (x, y, w, h, c, st) => { const d = w * .3; P(`M${x - w} ${y}L${x - w / 2} ${y - d} ${x + w / 2} ${y - d} ${x + w} ${y} ${x + w / 2} ${y + d} ${x - w / 2} ${y + d}Z`, c[0], st, 1.6); P(`M${x - w} ${y}L${x - w / 2} ${y + d}v${h}l${-w / 2} ${-d}Z`, c[1], st, 1.6); P(`M${x - w / 2} ${y + d}h${w}v${h}h${-w}Z`, c[2], st, 1.6); P(`M${x + w / 2} ${y + d}L${x + w} ${y}v${h}l${-w / 2} ${d}Z`, c[3], st, 1.6); };
  if (k === 'fluorite') oct(160, 102, 88, 84, ['#cdbcf7', '#a98bea', '#8a6bd6', '#6f51bd'], '#4a3590');
  if (k === 'diamond') { oct(160, 102, 80, 84, ['#ffffff', '#dcefff', '#bcdcf8', '#9cc4ea'], '#5b7fa6'); P('M250 36v28M236 50h28M72 150v20M62 160h20', 'none', '#7fa8d0', 2.5); }
  if (k === 'apatite') hexp(160, 46, 50, 120, ['#9be6da', '#4fbfb0', '#35a596', '#2a8a7d'], '#1c6159');
  if (k === 'corundum') hexp(160, 60, 72, 92, ['#f39ab3', '#d64a72', '#c0325c', '#9c2247'], '#6d1230');
  if (k === 'topaz') { P('M108 74L150 36 170 36 212 74 160 92Z', '#fbe0a6', '#9a6a14', 1.6); P('M108 74L160 92V188L108 172Z', '#f0b24a', '#9a6a14', 1.6); P('M160 92L212 74V172L160 188Z', '#d9952a', '#9a6a14', 1.6); P('M124 84V176M142 90V182M178 90V182M196 84V176', 'none', '#b87d1c', 1.2); }
  if (k === 'orthoclase') return minSVG('feldspar');
  return `<svg viewBox="0 0 320 200" role="img" aria-label="${k}">${o.join('')}</svg>`;
}

/* 岩石與礦物的關係：像「集合」一樣，大圈是岩石，裡面的小圈是組成它的礦物 */
function setSVG() {
  const big = (cx, name, note) => `<ellipse cx="${cx}" cy="78" rx="80" ry="58" fill="#fff" stroke="#1f3345" stroke-width="2"/><text x="${cx}" y="14" font-size="14" font-weight="900" text-anchor="middle" fill="#1f3345">${name}</text><text x="${cx}" y="154" font-size="12" text-anchor="middle" fill="#55687a">${note}</text>`;
  const m = (cx, cy, rx, ry, c, name, tc) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" stroke="#1f3345" stroke-width="1.5"/><text x="${cx}" y="${cy + 4.5}" font-size="13" font-weight="900" text-anchor="middle" fill="${tc}">${name}</text>`;
  return `<svg viewBox="0 0 340 160" role="img" aria-label="岩石由礦物組成：大理岩主要含方解石，花岡岩含石英、長石、雲母" style="width:100%;height:auto;display:block;margin:8px 0;background:#f8fafc;border:1px solid var(--line);border-radius:12px">
    ${big(86, '岩石：大理岩', '主要由一種礦物組成')}${m(90, 80, 46, 36, '#d9d9d9', '方解石', '#1f3345')}
    ${big(254, '岩石：花岡岩', '由好幾種礦物組成')}${m(228, 64, 27, 24, '#dbe6f2', '石英', '#1f3345')}${m(290, 74, 24, 22, '#e9aa9c', '長石', '#1f3345')}${m(250, 106, 26, 20, '#2d2a2b', '雲母', '#fff')}</svg>`;
}

/* 莫氏硬度表（HTML）：十種標準礦物，中間插入常見物品 */
function mohsTable() {
  const C = ['#cfe3cf', '#f1ece2', '#f3ecc4', '#9b7fe0', '#3fb6a8', '#e9aa9c', '#dbe6f2', '#f0b24a', '#c8325a', '#eef8ff'], OBJ = { 2: ['💅 指甲', '約 2.5'], 3: ['🪙 硬幣（銅）', '約 3.5'], 5: ['🪟 玻璃', '約 5.5'] };
  let s = '<div style="margin:10px 0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff;font-size:15px">';
  MOHS.forEach(([, name], k) => { const n = k + 1;
    s += `<div style="display:flex;align-items:center;gap:10px;padding:5px 10px;border-top:${k ? '1px solid var(--line)' : '0'}"><b style="display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#7c3aed;color:#fff;flex:none">${n}</b><i style="width:18px;height:18px;border-radius:5px;background:${C[k]};border:1.5px solid #64748b;flex:none"></i><b style="flex:1">${name}</b><span style="color:var(--sub);font-size:13px">${n === 1 ? '最軟' : n === 10 ? '最硬' : ''}</span></div>`;
    if (OBJ[n]) s += `<div style="display:flex;justify-content:space-between;padding:4px 10px 4px 48px;background:#fff7e6;border-top:1px dashed #f59e0b;font-weight:800;font-size:14px"><span>${OBJ[n][0]}</span><span>硬度${OBJ[n][1]}</span></div>`; });
  return s + '</div>';
}

/* ---------- 探究的觀察活動：兩種礦物互相刻劃（模擬） ---------- */
function observeScratch(el, done) {
  const M = [['滑石', 1, '#cfe3cf'], ['石膏', 2, '#f3efe6'], ['方解石', 3, '#f3ecc4'], ['長石', 6, '#e9aa9c'], ['石英', 7, '#dbe6f2']];
  el.innerHTML = `<div class="row">${M.map((m, i) => `<button class="cta ghost" data-i="${i}" style="flex:1 1 56px;padding:9px 4px">${m[0]}</button>`).join('')}</div>
    <div class="sim" style="grid-template-columns:1fr"><figure><figcaption id="scCap">先選兩種礦物</figcaption>
      <canvas width="360" height="200" id="scC" style="aspect-ratio:9/5;max-width:460px;background:#eef2f5"></canvas><div class="res" id="scT">　</div></figure></div>
    <div class="row"><button class="cta" id="scGo" disabled>⚒ 互相刻劃</button></div>
    <table id="scTb" style="width:100%;border-collapse:collapse;margin-top:10px;font-size:14.5px;text-align:center;background:#fff"><tr style="background:#f1f5f9"><th style="padding:5px;border:1px solid var(--line)">比一比</th><th style="padding:5px;border:1px solid var(--line)">誰留下凹痕</th><th style="padding:5px;border:1px solid var(--line)">誰比較硬</th></tr></table>
    <p style="font-size:14px;color:var(--sub);margin:8px 0 0" id="scN">至少比三組，其中一組要是「方解石和石英」。結果會記在上面的硬度比較表。</p>`;
  const g = G.$('#scC').getContext('2d'), W = 360, H = 200, sel = [], pairs = {}, btns = [...el.querySelectorAll('[data-i]')];
  let raf = 0, t0 = 0, told = false, A, B;
  const mark = () => { btns.forEach((b, i) => { b.style.boxShadow = sel.includes(i) ? 'inset 0 0 0 3px #7c3aed' : ''; b.style.background = sel.includes(i) ? '#ede9fe' : ''; });
    G.$('#scGo').disabled = sel.length < 2; G.$('#scCap').textContent = sel.length < 2 ? '先選兩種礦物' : `${M[sel[0]][0]} 和 ${M[sel[1]][0]}，誰會留下凹痕？`; };
  const half = (x0, a, b, t) => {         // 用 a 刻 b
    const u = clamp(t / 1.7, 0, 1), xa = x0 + 28, xb = x0 + 142, x = xa + (xb - xa) * u, y = 112, hard = a[1] > b[1];
    g.fillStyle = '#1f3345'; g.font = '900 14px sans-serif'; g.textAlign = 'center'; g.fillText(`用${a[0]}刻${b[0]}`, x0 + 85, 20);
    g.fillStyle = b[2]; g.strokeStyle = '#64748b'; g.lineWidth = 2; g.fillRect(x0 + 10, 78, 150, 82); g.strokeRect(x0 + 10, 78, 150, 82);
    g.font = '800 12px sans-serif'; g.fillStyle = 'rgba(31,51,69,.6)'; g.fillText(b[0], x0 + 85, 152);
    if (hard) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 4; g.beginPath(); g.moveTo(xa, y); g.lineTo(x, y); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(xa, y + 3); g.lineTo(x, y + 3); g.stroke(); }
    else { const al = 1 - ss(2, 2.8, t); g.fillStyle = `rgba(255,255,255,${al})`; g.strokeStyle = `rgba(0,0,0,${.3 * al})`; g.lineWidth = 1; for (let px = xa; px < x; px += 7) { g.beginPath(); g.arc(px, y + Math.sin(px) * 1.5, 2.2, 0, 7); g.fill(); g.stroke(); } }
    if (t < 3) { const lift = ss(1.8, 2.4, t) * 26; g.fillStyle = a[2]; g.strokeStyle = '#475569'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - lift); g.lineTo(x + 20, y - 34 - lift); g.lineTo(x + 14, y - 62 - lift); g.lineTo(x - 14, y - 60 - lift); g.lineTo(x - 18, y - 30 - lift); g.closePath(); g.fill(); g.stroke(); }
    if (t > 2.9) { g.font = '900 14px sans-serif'; g.fillStyle = hard ? '#b91c1c' : '#15803d'; g.fillText(hard ? `${b[0]}留下凹痕` : `粉末擦掉後，沒有痕跡`, x0 + 85, 184); }
  };
  const frame = now => {
    const t = (now - t0) / 1000; g.clearRect(0, 0, W, H); half(5, A, B, t); half(185, B, A, t);
    g.strokeStyle = '#cbd5e1'; g.lineWidth = 1; g.beginPath(); g.moveTo(180, 8); g.lineTo(180, 192); g.stroke();
    if (t < 3.4) { raf = requestAnimationFrame(frame); return; }
    const hard = A[1] > B[1] ? A : B, soft = hard === A ? B : A, key = [hard[0], soft[0]].join('>');
    G.$('#scT').textContent = `${soft[0]}被刻出凹痕，${hard[0]}沒有，所以${hard[0]}比較硬`; G.$('#scGo').disabled = false; btns.forEach(b => b.disabled = false);
    if (!pairs[key]) { pairs[key] = 1; const td = 'style="padding:5px;border:1px solid var(--line)"'; G.$('#scTb').insertAdjacentHTML('beforeend', `<tr><td ${td}>${hard[0]}、${soft[0]}</td><td ${td}>${soft[0]}</td><td ${td}><b>${hard[0]}</b></td></tr>`); }
    const n = Object.keys(pairs).length, need = pairs['石英>方解石'];
    if (n >= 3 && need && !told) { told = true; done(); }
    G.$('#scN').textContent = told ? '已經比完三組了！可以再多比幾組，或是按下面的按鈕去解釋。' : `已比 ${n} 組。${need ? '' : '記得要比「方解石和石英」。'}至少要比三組。`;
  };
  btns.forEach((b, i) => b.onclick = () => { const k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else { if (sel.length === 2) sel.shift(); sel.push(i); } mark(); });
  G.$('#scGo').onclick = () => { A = M[sel[0]]; B = M[sel[1]]; G.$('#scGo').disabled = true; btns.forEach(b => b.disabled = true); G.$('#scT').textContent = '刻劃中……'; t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
  g.fillStyle = '#64748b'; g.font = '800 15px sans-serif'; g.textAlign = 'center'; g.fillText('選兩種礦物，再按「互相刻劃」', W / 2, H / 2);
  return () => cancelAnimationFrame(raf);
}

/* ---------- 分頁字卡：上方一排名稱可以切換；往下滑一次換一張；場景裡的礦物也能叫出對應的字卡 ---------- */
let pg = null;
function pagerCSS() {
  if (document.getElementById('minCss')) return; const st = document.createElement('style'); st.id = 'minCss';
  st.textContent = `.mchips{position:relative;display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:thin}
    .mchips button{flex:none;border:2px solid var(--line);background:#fff;border-radius:999px;padding:3px 11px;font-weight:800;font-size:14px;line-height:1.5}
    .mchips button.on{background:var(--c,#7c3aed);border-color:var(--c,#7c3aed);color:#fff}
    .mpg{position:relative;overflow-y:auto;scroll-snap-type:y mandatory;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-right:4px}
    .mpg>.rcard{min-height:100%;box-sizing:border-box;scroll-snap-align:start;scroll-snap-stop:always;margin-bottom:10px}
    .mpg .rcard .pic{aspect-ratio:auto;height:132px} .mpg .rcard .pic svg{width:auto;height:86%}
    .mpg .rcard dl{font-size:14px;line-height:1.5} .mpg .rcard p{font-size:14px;margin:0 0 6px}
    .mscroll{overflow-x:auto;margin:8px 0;border:1px solid var(--line);border-radius:10px}
    .mtb{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;font-size:14px;line-height:1.45}
    @media (max-width:900px){.mtb{min-width:820px;font-size:13px}}
    .mtb th,.mtb td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top;background:#fff}
    .mtb th{background:#f1f5f9;font-weight:900;white-space:nowrap}
    .mtb .st{background:#f5f3ff;font-weight:900}
    .mtb button{border:0;background:none;font:inherit;font-weight:900;color:#6d28d9;text-decoration:underline;padding:0;cursor:pointer}
    .mext{border:2px dashed #7c3aed;background:#f5f3ff;border-radius:14px;padding:10px 12px;margin:12px 0 4px;font-size:15px}
    .mext>b{display:block;color:#6d28d9;margin-bottom:4px}`;
  document.head.appendChild(st);
}
function pager(body, names) {
  const cards = [...body.querySelectorAll('.rcard')], bar = document.createElement('div'), wrap = document.createElement('div');
  bar.className = 'mchips'; wrap.className = 'mpg'; bar.innerHTML = names.map(s => `<button>${s}</button>`).join('');
  cards.forEach(c => wrap.appendChild(c)); body.innerHTML = ''; body.append(bar, wrap);
  const chips = [...bar.children]; let cur = -1;
  const mark = i => { if (i === cur) return; cur = i; chips.forEach((c, k) => c.classList.toggle('on', k === i)); const c = chips[i]; bar.scrollTo({ left: c.offsetLeft - (bar.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' }); };
  const go = (i, smooth = true) => { wrap.scrollTo({ top: cards[i].offsetTop, behavior: smooth ? 'smooth' : 'auto' }); mark(i); };
  const fit = () => { if (!wrap.isConnected) { removeEventListener('resize', fit); return; } const cs = getComputedStyle(body); wrap.style.height = Math.max(220, body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - bar.offsetHeight) + 'px'; };
  addEventListener('resize', fit); fit();
  wrap.addEventListener('scroll', () => { let b = 0, bd = 1e9; cards.forEach((c, i) => { const d = Math.abs(c.offsetTop - wrap.scrollTop); if (d < bd) { bd = d; b = i; } }); mark(b); });
  chips.forEach((c, i) => c.onclick = () => go(i));   mark(0); pg = { go };
}
pagerCSS();

/* ---------- 字卡資料 ---------- */
const FACTS = {
  quartz: [['硬度', '7，比玻璃還硬。'], ['顏色與光澤', '無色透明或白色，有像玻璃一樣的光澤。'], ['觸感', '堅硬、光滑。'], ['主要成分', '二氧化矽（SiO<sub>2</sub>）。'], ['晶體型態', '六角形的柱子，頂端尖尖的。'], ['生活應用', '製造玻璃的原料。']],
  feldspar: [['硬度', '6。'], ['顏色與光澤', '白色、粉紅色或灰色，不透明，有玻璃光澤。'], ['觸感', '堅硬，有平整的面。'], ['主要成分', '含有鉀（K）、鋁（Al）、矽（Si）等元素的化合物，例如正長石（KAlSi<sub>3</sub>O<sub>8</sub>）。'], ['晶體型態', '短短的柱狀或板狀。'], ['生活應用', '製作陶瓷的原料。']],
  biotite: [['硬度', '2.5～3。'], ['顏色與光澤', '黑色或深褐色，薄片表面有珍珠般的光澤。'], ['觸感', '光滑，可以剝成一片片有彈性的薄片。'], ['主要成分', '含有鉀（K）、鐵（Fe）、鎂（Mg）、鋁（Al）、矽（Si）的化合物。'], ['晶體型態', '一層一層疊起來的薄片。']],
  muscovite: [['硬度', '2～2.5。'], ['顏色與光澤', '無色或銀白色，薄片透明，有珍珠般的光澤。'], ['觸感', '光滑，可以剝成一片片有彈性的薄片。'], ['主要成分', '含有鉀（K）、鋁（Al）、矽（Si）的化合物。'], ['晶體型態', '一層一層疊起來的薄片。'], ['生活應用', '不容易導電、耐高溫，可以做電器的絕緣材料。']],
  calcite: [['硬度', '3。'], ['顏色與光澤', '無色或白色，透明到半透明，有玻璃光澤。'], ['觸感', '光滑，敲開後是斜斜的方塊。'], ['主要成分', '碳酸鈣（CaCO<sub>3</sub>）。'], ['晶體型態', '像被推歪的方塊（菱面體）。'], ['特別的地方', '石灰岩和大理岩主要由方解石組成。']],
  graphite: [['硬度', '1～2。'], ['顏色與光澤', '黑色或鋼灰色，有像金屬一樣的光澤。'], ['觸感', '滑滑的，摸了手會變黑。'], ['主要成分', '碳（C）。'], ['晶體型態', '片狀或塊狀。'], ['生活應用', '很軟，能在紙上留下黑色的痕跡，可以做鉛筆芯。']],
  talc: [['硬度', '1，用指甲就能刻出痕跡。'], ['顏色與光澤', '白色或淡綠色，有珍珠或油脂般的光澤。'], ['觸感', '非常滑膩，像摸肥皂一樣。'], ['主要成分', '含有鎂（Mg）、矽（Si）的化合物。'], ['晶體型態', '片狀或塊狀。'], ['生活應用', '磨成細粉可以做爽身粉。']],
  sulfur: [['硬度', '1.5～2.5。'], ['顏色與光澤', '黃色，有像樹脂或油脂的光澤。'], ['觸感', '很輕，容易碎。'], ['主要成分', '硫（S）。'], ['晶體型態', '尖錐狀或塊狀。'], ['臺灣哪裡看', '陽明山小油坑的噴氣孔旁，有黃色的硫磺結晶。'], ['生活應用', '製造火柴和肥料的原料。']],
  gypsum: [['硬度', '2，用指甲就能刻出痕跡。'], ['顏色與光澤', '無色或白色，有玻璃或絲絹般的光澤。'], ['觸感', '有點滑，質地軟。'], ['主要成分', '含水的硫酸鈣（CaSO<sub>4</sub>·2H<sub>2</sub>O）。'], ['晶體型態', '板狀或像纖維的細絲狀。'], ['生活應用', '可以做粉筆、石膏板和石膏模型。']],
  pyrite: [['硬度', '6～6.5。'], ['顏色與光澤', '淺黃銅色，有閃亮的金屬光澤。'], ['觸感', '堅硬，拿起來沉沉的。'], ['主要成分', '二硫化鐵（FeS<sub>2</sub>），由鐵（Fe）和硫（S）組成。'], ['晶體型態', '常常是整齊的立方體。'], ['特別的地方', '看起來很像黃金，所以又叫「愚人金」。']],
  fluorite: [['硬度', '4。'], ['顏色與光澤', '紫、綠、黃等多種顏色，透明到半透明，有玻璃光澤。'], ['觸感', '光滑。硬幣刻不動它，玻璃刻得動它。'], ['主要成分', '氟化鈣（CaF<sub>2</sub>）。'], ['晶體型態', '立方體或八面體。'], ['特別的地方', '有些螢石照到紫外線會發出螢光。']],
  apatite: [['硬度', '5，比玻璃軟一點。'], ['顏色與光澤', '綠、藍、黃等顏色，有玻璃光澤。'], ['觸感', '光滑。'], ['主要成分', '含有鈣（Ca）和磷（P）的化合物。'], ['晶體型態', '六角形的柱子。'], ['特別的地方', '牙齒和骨頭裡堅硬的成分，和磷灰石很像。']],
  orthoclase: [['硬度', '6，可以刻傷玻璃。'], ['顏色與光澤', '白色、粉紅色或淡黃色，有玻璃光澤。'], ['觸感', '堅硬，有平整的面。'], ['主要成分', '含有鉀（K）、鋁（Al）、矽（Si）的化合物（KAlSi<sub>3</sub>O<sub>8</sub>）。'], ['晶體型態', '短短的柱狀。'], ['特別的地方', '長石家族的一員。花岡岩裡粉紅色的顆粒常常是它。']],
  topaz: [['硬度', '8，可以刻傷石英。'], ['顏色與光澤', '無色、黃色或藍色（藍色的多半經過處理），透明，有玻璃光澤。'], ['觸感', '非常堅硬、光滑。'], ['主要成分', '含有鋁（Al）、矽（Si）、氟（F）的化合物。'], ['晶體型態', '柱狀，柱面上有直直的條紋。'], ['生活應用', '漂亮的黃玉可以做成寶石，商業名稱叫「托帕石」。'], ['特別的地方', '市面上的藍色托帕石，大多是無色黃玉經過輻照和熱處理後變成藍色的。']],
  corundum: [['硬度', '9。'], ['顏色與光澤', '有紅、藍等多種顏色，光澤很亮。'], ['觸感', '非常堅硬。'], ['主要成分', '氧化鋁（Al<sub>2</sub>O<sub>3</sub>）。'], ['晶體型態', '六角形的桶狀或柱狀。'], ['生活應用', '紅色的是紅寶石，藍色的是藍寶石；也可以做磨東西的材料。']],
  diamond: [['硬度', '10，自然界最硬的礦物。'], ['顏色與光澤', '無色透明，光澤非常閃亮（金剛光澤）。'], ['觸感', '極為堅硬，其他礦物都刻不動它。'], ['主要成分', '碳（C）。'], ['晶體型態', '八面體。'], ['特別的地方', '成分和石墨一樣是碳，但原子排列的方式不同，硬度差很多。'], ['生活應用', '琢磨後就是鑽石；也用來做切割和鑽孔的工具。']],
};
const EN = { quartz: 'Quartz', feldspar: 'Feldspar', biotite: 'Biotite', muscovite: 'Muscovite', calcite: 'Calcite', graphite: 'Graphite', talc: 'Talc', sulfur: 'Sulfur', gypsum: 'Gypsum', pyrite: 'Pyrite', fluorite: 'Fluorite', apatite: 'Apatite', orthoclase: 'Orthoclase', topaz: 'Topaz', corundum: 'Corundum', diamond: 'Diamond' };
const card = (name, key) => ({ name, en: EN[key], photo: `img/minerals/${key}.jpg`, svg: minSVG(key), facts: FACTS[key] });
const jumpBtn = (i, s) => `<button data-card="${i}">${s}</button>`;
// 圖鑑總覽：一列一種礦物
const ATLAS_T = [['7', '無色、白；玻璃光澤', '堅硬、光滑', '二氧化矽（SiO<sub>2</sub>）', '六角柱'], ['6', '白、粉紅；玻璃光澤', '堅硬，有平整的面', '含鉀（K）、鋁（Al）、矽（Si）的化合物', '短柱狀、板狀'], ['2.5～3', '黑、深褐；珍珠光澤', '可剝成薄片', '含鉀（K）、鐵（Fe）、鎂（Mg）的化合物', '薄片'], ['2～2.5', '無色、銀白；珍珠光澤', '可剝成薄片', '含鉀（K）、鋁（Al）、矽（Si）的化合物', '薄片'], ['3', '無色、白；玻璃光澤', '光滑', '碳酸鈣（CaCO<sub>3</sub>）', '菱面體'], ['1～2', '黑、鋼灰；金屬光澤', '滑，手會變黑', '碳（C）', '片狀、塊狀'], ['1', '白、淡綠；珍珠光澤', '非常滑膩', '含鎂（Mg）、矽（Si）的化合物', '片狀、塊狀'], ['1.5～2.5', '黃；樹脂光澤', '輕，容易碎', '硫（S）', '尖錐狀、塊狀'], ['2', '無色、白；玻璃或絲絹光澤', '軟，有點滑', '含水的硫酸鈣（CaSO<sub>4</sub>·2H<sub>2</sub>O）', '板狀、纖維狀'], ['6～6.5', '淺黃銅色；金屬光澤', '堅硬、沉重', '二硫化鐵（FeS<sub>2</sub>）', '立方體']];
const ATLAS_R = ['硬度', '顏色與光澤', '觸感', '主要成分', '晶體型態'];
// 總覽彈窗裡點礦物名稱：關掉彈窗，跳到圖鑑裡那一張字卡
const ovOpen = (el, close) => el.querySelectorAll('[data-card]').forEach(b => b.onclick = () => { close(); G.ui.show('cards'); if (pg) pg.go(+b.dataset.card, false); });
const atlasOverview = { onOpen: ovOpen, html: `<h2>礦物總覽</h2><p style="margin:0">十種礦物比一比。點礦物名稱，可以看那一種的字卡。</p>
  <div class="mscroll"><table class="mtb"><tr><th class="st" style="width:9.5%">礦物</th>${ATLAS.map(([, name], i) => `<th style="text-align:center">${jumpBtn(i, name)}</th>`).join('')}</tr>
  ${ATLAS_R.map((r, k) => `<tr><td class="st">${r}</td>${ATLAS_T.map(m => `<td>${m[k]}</td>`).join('')}</tr>`).join('')}</table></div>
  <p style="color:var(--sub);font-size:14px;margin:0">成分後面括號裡的英文字母，是科學家用來表示這種物質的化學式。</p>` };
// 莫氏硬度總表：從左到右 1 排到 10
const MOHS_T = [['顏色與光澤', '白、淡綠；珍珠光澤', '無色、白；玻璃或絲絹光澤', '無色、白；玻璃光澤', '紫、綠、黃；玻璃光澤', '綠、藍、黃；玻璃光澤', '白、粉紅；玻璃光澤', '無色、白；玻璃光澤', '無色、黃、藍；玻璃光澤', '紅、藍等；光澤很亮', '無色；金剛光澤'],
  ['觸感', '非常滑膩', '軟，有點滑', '光滑', '光滑', '光滑', '堅硬，有平整的面', '堅硬、光滑', '非常堅硬', '非常堅硬', '極為堅硬'],
  ['主要成分', '含鎂（Mg）、矽（Si）的化合物', '含水的硫酸鈣（CaSO<sub>4</sub>·2H<sub>2</sub>O）', '碳酸鈣（CaCO<sub>3</sub>）', '氟化鈣（CaF<sub>2</sub>）', '含鈣（Ca）、磷（P）的化合物', '含鉀（K）、鋁（Al）、矽（Si）的化合物', '二氧化矽（SiO<sub>2</sub>）', '含鋁（Al）、矽（Si）、氟（F）的化合物', '氧化鋁（Al<sub>2</sub>O<sub>3</sub>）', '碳（C）'],
  ['晶體型態', '片狀、塊狀', '板狀、纖維狀', '菱面體', '立方體、八面體', '六角柱', '短柱狀', '六角柱', '柱狀', '六角桶狀', '八面體'],
  ['用物品比一比', '指甲刻得動', '指甲刻得動', '指甲刻不動，硬幣刻得動', '硬幣刻不動，玻璃刻得動', '玻璃刻得動', '能刻傷玻璃', '能刻傷玻璃', '能刻傷玻璃和石英', '能刻傷黃玉', '什麼都刻不動它']];
const mohsOverview = { onOpen: ovOpen, html: `<h2>莫氏硬度總表</h2><p style="margin:0">從左到右，硬度由 1 排到 10。點礦物名稱，可以看那一種的字卡。</p>
  <div class="mscroll"><table class="mtb"><tr><th class="st" style="width:9.5%">硬度</th>${MOHS.map((m, k) => `<th style="text-align:center"><b style="display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#7c3aed;color:#fff">${k + 1}</b></th>`).join('')}</tr>
  <tr><td class="st">標準礦物</td>${MOHS.map(([, name], k) => `<td style="text-align:center">${jumpBtn(k, name)}</td>`).join('')}</tr>
  ${MOHS_T.map(r => `<tr><td class="st">${r[0]}</td>${r.slice(1).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>
  <p style="color:var(--sub);font-size:14px;margin:0">常見物品的硬度：指甲約 2.5、硬幣（銅）約 3.5、玻璃約 5.5。硬度大的可以刻傷硬度小的。</p>` };

/* ---------- 區域定義 ---------- */
G.registerZone('minerals', {
  hint: '這是一座採石坑，岩壁裡藏著晶洞。點發光的圓點，認識礦物，比比看誰比較硬！',
  build,
  nodes: [
    { id: 'what', num: '1', title: '礦物是什麼', en: 'What is a Mineral', color: '#7c3aed', ready: true, at: [GEO[0], 3.5, GEO[2]],
      cam: { pos: [-1.6, 5.2, 11.5], target: [-1.6, 1.2, 1.4] },
      learn: `
        <h3>礦物是什麼？</h3>
        <p>在地質學上，要<em>同時符合下面五個條件</em>的物質，才叫做<em>礦物</em>。</p>
        <div class="two"><div><b>① 天然形成</b>由大自然的作用產生，不是人工製造的。</div><div><b>② 無機物</b>不是由動物或植物的身體構成的物質。</div></div>
        <div class="two"><div><b>③ 固體</b>在一般的溫度下是固體。</div><div><b>④ 成分固定</b>有固定的化學成分，可以寫成化學式，例如石英是 SiO<sub>2</sub>。</div></div>
        <div class="two"><div><b>⑤ 原子排列規則</b>內部的原子排得很整齊，所以能長成形狀規則的晶體。</div><div><b>想一想</b>人造鑽石、煤、玻璃都不是礦物。它們各少了哪一個條件？</div></div>
        <p>因為成分和原子的排列都固定，每一種礦物都有固定的特徵：顏色、光澤、觸感、晶體的形狀和硬度。</p>
        <h3>礦物和岩石的關係</h3>
        <p><em>岩石是由一種或好幾種礦物組成的。</em>把岩石想成一個大圈，組成它的礦物就是圈裡的小圈。</p>
        ${setSVG()}
        <p>大理岩主要只有方解石一種礦物；花岡岩裡有石英、長石和雲母，所以看起來花花的。</p>
        <h3>晶洞裡的晶體</h3>
        <p>岩石裡有空洞時，含有礦物成分的水流進去，經過很長的時間，慢慢結出一根根晶體，就成為<em>晶洞</em>。</p>
        <div class="tip"><b>看看場景：</b>切開的晶洞裡長滿了石英晶體。晶洞前面那塊花岡岩，找得到幾種顏色的顆粒？</div>
        <div class="mext"><b>延伸補充｜汞算不算礦物？</b>
          <p>汞（Hg，俗稱水銀）是天然形成的無機物，但在一般溫度下是液體，大約零下 39 ℃ 才會凝固成晶體。</p>
          <p>照定義，它不符合「固體」這個條件。不過人們很早就把天然汞當成礦物，國際礦物學協會（IMA）也把它當作特例保留下來。</p>
          <p>也有學者認為它只能算「準礦物」。用同樣的條件想一想：冰是礦物，液態的水就不是。</p></div>`
    },
    { id: 'atlas', num: '2', title: '礦物圖鑑', en: 'Mineral Guide', color: '#0f766e', ready: true, at: [TX, 2.5, TZ],
      cam: { pos: [3, 5.6, 10.6], target: [3, 1, 2] },
      learn: `
        <h3>桌上的十種礦物</h3>
        <p>標本桌上擺了十種常見的礦物。每一種的顏色、光澤、形狀都不一樣。</p>
        <h3>圖鑑怎麼用？</h3>
        <div class="two"><div><b>先看總覽</b>按上方的「總覽」，會跳出十種礦物的比較表。</div><div><b>一次一張</b>往下滑一次換一張字卡，也可以點上方的礦物名稱。</div></div>
        <div class="tip"><b>指指看：</b>把游標移到場景裡的礦物上（平板用手指點一下），右邊就會跳到那一種礦物的字卡。</div>
        <h3>字卡上寫什麼？</h3>
        <div class="two"><div><b>硬度</b>數字越大越硬。怎麼比出來的？到「硬度比一比」試試看。</div><div><b>顏色與光澤</b>光澤是表面反光的樣子，例如像玻璃、像金屬、像珍珠。</div></div>
        <div class="two"><div><b>觸感</b>摸起來是滑滑的、粗粗的，還是可以剝成薄片？</div><div><b>晶體型態</b>晶體長成的形狀，例如六角柱、立方體、薄片。</div></div>
        <p>「主要成分」寫的是礦物由什麼物質組成，後面的英文字母是化學式，例如碳酸鈣寫成 CaCO<sub>3</sub>。</p>
        <div class="tip"><b>提醒：</b>觀察礦物時不可以用嘴巴嘗。聞氣味時，要用手輕輕把氣味搧向鼻子。</div>
        <button class="cta" data-go="cards">打開圖鑑 →</button>`,
      overview: atlasOverview,
      cards: ATLAS.map(([key, name]) => key !== 'quartz' ? (ATLAS_PICS[key] ? { ...card(name, key), pics: ATLAS_PICS[key].map(([f, cap]) => ({ svg: minSVG(key), photo: `img/minerals/${f}.jpg`, cap })) } : card(name, key)) : { ...card('石英與水晶', key),
        pics: [{ svg: minSVG('quartz'), photo: 'img/minerals/quartz.jpg', cap: '石英' }, { svg: minSVG('quartz'), photo: 'img/minerals/rock-crystal.jpg', cap: '水晶（白水晶）' }],
        facts: [...FACTS.quartz, ['石英和水晶', '<em>水晶就是純淨、結晶良好（大而透明）的石英</em>，兩者成分相同，都是二氧化矽（SiO<sub>2</sub>）。'],
          ['比一比', '一般的石英常含雜質，又擠在岩石裡長不大，多半是白色、半透明。有空間慢慢長大的才會變成透明的水晶。']] }),
      onCards: b => pager(b, ATLAS.map(m => m[1])) },
    { id: 'scratch', num: '3', title: '硬度比一比', en: 'Scratch Test', color: '#b45309', ready: true, at: [-2, 2, 4],
      cam: { pos: [-.2, 3.8, 10.6], target: [-.2, .9, 4] },
      learn: `
        <h3>硬度是什麼？</h3>
        <p><em>硬度</em>是礦物抵抗刻劃的能力。越硬的礦物，越不容易被刻出痕跡。</p>
        <h3>怎麼比硬度？</h3>
        <p>把兩種礦物<em>互相刻劃</em>，再看看表面有沒有留下凹痕。</p>
        <div class="two"><div><b>① 互相刻劃</b>拿甲的尖角用力刻乙，再換乙刻甲。</div><div><b>② 擦掉粉末</b>表面的粉末不算，要擦掉以後再看。</div></div>
        <div class="two"><div><b>③ 找凹痕</b>用手指摸摸看，哪一塊有凹下去的刻痕？</div><div><b>④ 做紀錄</b>把每一組的結果整理成硬度比較表。</div></div>
        <div class="tip"><b>注意：</b>硬度和「容不容易敲碎」不一樣。有的礦物很硬，卻一敲就裂開。</div>
        <p>兩種礦物互相刻劃時，是哪一種會留下凹痕？先預測，再到探究活動動手刻刻看。</p>`,
      poe: {
        question: '拿「方解石」和「石英」互相用力刻劃，把粉末擦掉後，哪一種礦物的表面會留下凹痕？',
        options: ['方解石會留下凹痕', '石英會留下凹痕', '兩種都會留下一樣深的凹痕'],
        observeIntro: '選兩種礦物，按「互相刻劃」。注意<b>哪一塊留下凹痕</b>，哪一塊只有擦得掉的粉末。',
        observe: observeScratch,
        explain: {
          q: '根據你整理的硬度比較表，哪一個說法最能解釋刻劃的結果？',
          opts: ['顏色比較深的礦物比較硬，所以能刻傷顏色淺的礦物。', '兩種礦物互相刻劃時，比較硬的能在比較軟的上面刻出凹痕，自己不會被刻傷。', '先動手刻的礦物比較用力，所以另一塊會留下凹痕。'],
          ans: 1,
          hint: '回想畫面：兩塊礦物輪流刻對方，結果一樣嗎？留下凹痕的總是哪一種？這和顏色、誰先刻有關係嗎？',
          why: '比較硬的礦物能刻傷比較軟的礦物；比較軟的刻不動比較硬的，只會留下自己的粉末。石英比方解石硬，所以是方解石留下凹痕。'
        }
      }
    },
    { id: 'mohs', num: '4', title: '莫氏硬度表', en: 'Mohs Scale', color: '#be123c', ready: true, at: [SX0 + 5 * SW, 4.3, SZ],
      cam: { pos: [3.2, 6.6, 11.5], target: [3.2, 1.6, -2] },
      learn: `
        <h3>莫氏硬度表</h3>
        <p>德國礦物學家莫斯挑了十種礦物當標準，用互相刻劃的方法，從最軟排到最硬，分成 1 到 10 級。</p>
        ${mohsTable()}
        <p>數字大的礦物，可以在數字小的礦物上刻出凹痕。場景裡的階梯，一級比一級硬。</p>
        <div class="tip"><b>指指看：</b>把游標移到階梯上的礦物（平板用手指點一下），右邊會跳到它的字卡。按上方的「總覽」，可以看 1 到 10 的總表。</div>
        <h3>用身邊的物品比一比</h3>
        <p>手邊沒有標準礦物時，可以用指甲、硬幣和玻璃來估計硬度。</p>
        <div class="two"><div><b>指甲刻得動</b>硬度比 2.5 小，例如滑石、石膏。</div><div><b>能刻傷玻璃</b>硬度比 5.5 大，例如正長石、石英。</div></div>
        <div class="tip"><b>注意：</b>硬度的數字只代表「順序」。金剛石是 10、滑石是 1，但金剛石不只比滑石硬 10 倍。</div>
        <button class="cta" data-go="cards">打開十種標準礦物的圖鑑 →</button>`,
      overview: mohsOverview,
      cards: MOHS.map(([key, name], k) => !MOHS_PICS[key] ? card(`${k + 1}　${name}`, key)
        : { ...card(`${k + 1}　${name}`, key), pics: MOHS_PICS[key].map(([f, cap]) => ({ svg: minSVG(key), photo: `img/minerals/${f}.jpg`, cap })) }),
      onCards: b => pager(b, MOHS.map((m, k) => `${k + 1} ${m[1]}`)) },
    { id: 'identify', num: '5', title: '辨認礦物', en: 'Identify Minerals', color: '#0369a1', ready: true, at: [4.6, 2.1, .6],
      cam: { pos: [6.2, 4, 8.6], target: [6.2, .9, .8] },
      learn: `
        <h3>當一位礦物偵探</h3>
        <p>有些礦物長得很像。只看一種特徵容易認錯，要把好幾個線索合起來判斷。</p>
        <div class="two"><div><b>① 顏色</b>先看是什麼顏色、透不透明。</div><div><b>② 光澤</b>反光像玻璃、像金屬，還是像珍珠？</div></div>
        <div class="two"><div><b>③ 觸感</b>滑滑的？粗粗的？能不能剝成薄片？</div><div><b>④ 晶體型態</b>六角柱、立方體、薄片，還是不規則？</div></div>
        <div class="two"><div><b>⑤ 硬度</b>用指甲、硬幣、玻璃刻刻看，估計硬度。</div><div><b>合起來想</b>每多一個線索，就能刪掉幾個不對的答案。</div></div>
        <h3>偵探筆記：兩塊黃色的礦物</h3>
        <p>甲有金屬光澤、是立方體，指甲和硬幣都刻不動。乙沒有金屬光澤、很輕，指甲就刻得動。</p>
        <p>對照圖鑑：甲是<em>黃鐵礦</em>，乙是<em>硫磺</em>。顏色一樣，光澤和硬度卻差很多。</p>
        <div class="tip"><b>再試一組：</b>石英和方解石都是透明或白色的。用硬幣刻刻看，刻得動的是方解石，刻不動的是石英。</div>`
    },
  ],
  // 檢核題：level 為 PIRLS 層次（1 提取訊息／2 推論訊息／3 詮釋整合／4 比較評估）
  quiz: [
    { id: 'minerals.what.1', about: '礦物是什麼', level: 1, q: '根據「礦物是什麼」的認識，岩石和礦物是什麼關係？',
      opts: ['岩石是由礦物組成的', '礦物是由岩石組成的', '岩石和礦物是同一種東西', '岩石和礦物沒有關係'], ans: 0, why: '說明中提到：岩石是由礦物組成的。有的岩石有好幾種礦物（花岡岩），有的主要只有一種（大理岩）。' },
    { id: 'minerals.mohs.1', about: '莫氏硬度表', level: 1, q: '根據「莫氏硬度表」的認識，十種標準礦物中，硬度 1、最軟的是哪一種？',
      opts: ['金剛石', '石英', '方解石', '滑石'], ans: 3, why: '莫氏硬度表從最軟排到最硬：滑石是 1，金剛石是 10。' },
    { id: 'minerals.scratch.1', about: '硬度比一比', level: 2, q: '小安拿甲、乙兩塊礦物互相刻劃，擦掉粉末後，甲的表面有凹痕，乙沒有。根據「硬度比一比」的探究，可以推論出什麼？',
      opts: ['甲比乙硬', '乙比甲硬', '甲和乙一樣硬', '只做一次，什麼都看不出來'], ans: 1, why: '比較硬的礦物能在比較軟的礦物上刻出凹痕。甲留下凹痕、乙沒有，表示乙比甲硬。' },
    { id: 'minerals.mohs.2', about: '莫氏硬度表', level: 2, q: '指甲的硬度大約是 2.5。根據「莫氏硬度表」，下面哪一種礦物可以用指甲刻出痕跡？',
      opts: ['石膏（硬度 2）', '方解石（硬度 3）', '正長石（硬度 6）', '石英（硬度 7）'], ans: 0, why: '硬度大的可以刻傷硬度小的。指甲約 2.5，只比石膏（2）硬，所以刻得動石膏，刻不動另外三種。' },
    { id: 'minerals.identify.1', about: '辨認礦物', level: 3, q: '小美撿到一塊礦物：淺黃銅色、有金屬光澤、是整齊的立方體，指甲和硬幣都刻不動。把「礦物圖鑑」和「辨認礦物」的說明合起來想，它最可能是什麼？',
      opts: ['硫磺', '白雲母', '黃鐵礦', '石墨'], ans: 2, why: '把線索合起來：金屬光澤、立方體、硬度比硬幣大（圖鑑寫 6～6.5），都符合黃鐵礦。硫磺雖然也是黃色，但沒有金屬光澤，而且很軟。' },
    { id: 'minerals.identify.2', about: '辨認礦物', level: 4, q: '小華說：「辨認礦物只要看顏色就夠了，黃色的一定是硫磺。」根據「辨認礦物」的說明，哪一個評論最合理？',
      opts: ['說得對，每一種礦物的顏色都不一樣', '說得對，顏色是礦物唯一的特徵', '不夠好，應該只比硬度，其他特徵都不用看', '不夠好，黃鐵礦也是黃色的，要把光澤、觸感、晶形、硬度合起來判斷'], ans: 3, why: '不同的礦物可能顏色相近，例如黃鐵礦和硫磺。只靠一種特徵容易認錯，把好幾個線索合起來判斷才可靠。' },
  ]
});
})();
