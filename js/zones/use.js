/* 區域 4：岩石礦物應用 —— 山腳下的小鎮、開採中的礦場與復育中的舊礦場
   四個節點：生活中的岩石、生活中的礦物、開採的代價、復原與永續；本區挑戰 5 題
   場景 22×14：左邊是被挖成階梯狀的山（前面是開採中的礦場，右後是復育中的舊礦場），右邊是河兩岸的小鎮 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, { ss, fbm, clamp, lerp } = U;

const X0 = -11, X1 = 11, Z0 = -7, Z1 = 7, YB = -3, YT = 6, CELL = .1, NX = 220, NZ = 140, P = .32, WL = .17;
const HILL = [-7.4, -3.0], PIT = [-6.2, .9, 1.1, 2.6], OLD = [-3.4, -3.0, .75, 1.9];      // 礦場：[中心 x, 中心 z, 坑底半徑, 最外圈半徑]
const RIV = z => 5.6 + .7 * Math.sin(z * .38 + .6), BRX = RIV(1);
const CREEK = [[-5.3, 1.9], [-4.6, 3.2], [-3.7, 4.8], [-3.4, 7]];                          // 從礦場流出來的混濁小溪
const SCAR = [[-8.7, -1.3], [-8.05, -1.0], [-7.65, -.2], [-6.95, .35], [-6.45, 1.05], [-5.5, 1.75]];           // 裸露山坡上的崩塌溝
const ROADS = [[[-5.2, 1], [X1, 1]], [[1.4, Z0], [1.4, Z1]], [[9, -5.6], [9, Z1]]];
const segD = (x, z, Q) => { let m = 1e9; for (let i = 0; i < Q.length - 1; i++) { const ax = Q[i][0], az = Q[i][1], bx = Q[i + 1][0] - ax, bz = Q[i + 1][1] - az, t = clamp(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1); m = Math.min(m, Math.hypot(x - ax - bx * t, z - az - bz * t)); } return m; };
const roadD = (x, z) => Math.min(segD(x, z, ROADS[0]), segD(x, z, ROADS[1]), segD(x, z, ROADS[2]));

/* ---------- 地形 ---------- */
function natural(x, z) {            // 還沒開挖的山與平原
  const d = Math.hypot(x - HILL[0], (z - HILL[1]) * .9), hill = Math.max(0, 4.75 * Math.exp(-d * d / 11) - .15);
  return P + hill + (fbm(x * .6 + 3, z * .6, 3) - .47) * .8 * ss(.25, 1.6, hill);
}
// 階梯狀的開採面：坑底是平的，往外一階一階升高，最外圈是陡峭的殘壁
const benchY = (d, Q, st, bh, y0) => (d < Q[2] ? y0 : y0 + bh * (Math.floor((d - Q[2]) / st) + 1)) + 3 * Math.max(0, d - Q[3]);
const pitY = (x, z) => benchY(Math.hypot(x - PIT[0], z - PIT[1]), PIT, .5, .42, .7), oldY = (x, z) => benchY(Math.hypot(x - OLD[0], z - OLD[1]), OLD, .42, .34, .56);
function height(x, z) {
  const nat = natural(x, z), dp = Math.hypot(x - PIT[0], z - PIT[1]), dq = Math.hypot(x - OLD[0], z - OLD[1]);
  let h = Math.min(nat, pitY(x, z), oldY(x, z));
  if (dq < .62) h = Math.min(h, .56 - .3 * ss(.62, .3, dq));                                // 舊礦坑底積水的池塘
  const ws = ss(.32, .12, segD(x, z, SCAR));                                               // 崩塌溝：把階梯沖成一道斜槽
  if (ws > 0) h = lerp(h, Math.min(nat - .1, .7 + .84 * Math.max(0, dp - PIT[2]) + 3 * Math.max(0, dp - PIT[3])) - .05, ws);
  h -= .42 * ss(.75, .4, Math.abs(x - RIV(z)));                                            // 河
  if (dp > PIT[2]) h -= .1 * ss(.22, .08, segD(x, z, CREEK));                              // 小溪
  return h;
}
const NV = (NX + 1) * (NZ + 1), H = new Float32Array(NV);
for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) H[j * (NX + 1) + i] = height(X0 + i * CELL, Z0 + j * CELL);

/* ---------- 地表貼圖：逐像素上色（草地、森林、礦場的岩石、道路、鋪面、農田） ---------- */
const mix = (a, b, t) => { a[0] += (b[0] - a[0]) * t; a[1] += (b[1] - a[1]) * t; a[2] += (b[2] - a[2]) * t; return a; };
const inR = (x, z, x0, x1, z0, z1) => ss(x0 - .04, x0 + .04, x) * ss(x1 + .04, x1 - .04, x) * ss(z0 - .04, z0 + .04, z) * ss(z1 + .04, z1 - .04, z);
const FARM = [[150, 190, 92], [176, 142, 98], [112, 160, 78], [198, 190, 106]];
function groundColor(x, z) {
  const nat = natural(x, z), hill = nat - P, dp = Math.hypot(x - PIT[0], z - PIT[1]), dq = Math.hypot(x - OLD[0], z - OLD[1]), n = fbm(x * 1.7, z * 1.7, 3);
  const col = mix([128, 178, 90], [72, 130, 66], clamp(fbm(x * .5 + 2, z * .5, 3) * 1.7 - .35, 0, 1)); mix(col, [54, 106, 58], ss(.3, 1.5, hill) * .6);
  if (nat - oldY(x, z) > .02) {                      // 舊礦場：階梯上已經鋪土、長草（還沒長好的樣子由另一層蓋在上面）
    const f = (dq - OLD[2]) / .42, riser = dq > OLD[2] && f - Math.floor(f) < .16;
    mix(col, mix([124, 168, 86], [96, 144, 72], n), 1); mix(col, [150, 146, 128], dq > OLD[3] ? .6 : riser ? .5 : .1);
    if (dq < .66) mix(col, [86, 116, 98], ss(.66, .5, dq));
  }
  if (nat - pitY(x, z) > .02) {                      // 開採中的礦場：灰白色的岩石，階梯的立面較暗
    const f = (dp - PIT[2]) / .5, fr = f - Math.floor(f), a = Math.atan2(z - PIT[1], x - PIT[0]);
    const c = dp < PIT[2] ? mix([204, 194, 174], [180, 170, 152], n) : dp > PIT[3] ? mix([176, 168, 156], [138, 132, 122], U.hash(Math.floor(a * 46), 1) * .8 + n * .2) : fr < .15 ? mix([150, 144, 134], [128, 122, 114], U.hash(Math.floor(a * 60), 2)) : mix([224, 218, 206], [200, 194, 182], n);
    mix(col, c, 1);
  }
  mix(col, mix([154, 116, 80], [118, 88, 62], n), ss(.36, .16, segD(x, z, SCAR)));          // 崩塌溝：裸露的土石
  if (hill < .3) {                                   // 小鎮裡的鋪面與田
    const chk = ((Math.floor(x * 5) + Math.floor(z * 5)) & 1);
    mix(col, chk ? [158, 160, 166] : [142, 144, 150], inR(x, z, -1.35, 1.1, -2.5, -1.5));                         // 廟埕：安山岩石板
    mix(col, chk ? [236, 232, 224] : [222, 218, 210], inR(x, z, 1.9, 4.1, -2.5, -1.6));                           // 美術館前：大理岩地磚
    mix(col, chk ? [214, 188, 176] : [196, 172, 162], inR(x, z, 8.3, 8.75, -5.2, -3.5) + inR(x, z, 8.75, 10.3, -4.0, -3.5));   // 石板屋前的石板
    mix(col, [216, 198, 162], inR(x, z, 1.75, 4.25, 3.55, 6.5));                                                  // 學校的操場
    const e = Math.hypot((x - 2.95) / 1.05, (z - 5.6) / .6); if (e < 1) mix(col, e > .7 ? [198, 86, 62] : [112, 172, 86], ss(1, .96, e));
    mix(col, mix([200, 176, 136], [178, 154, 118], n), inR(x, z, 7.0, 8.7, 3.0, 6.4));                            // 工地
    mix(col, mix([182, 180, 174], [166, 164, 158], n), inR(x, z, -3.3, -1.2, 3.1, 5.0));                          // 水泥廠
    mix(col, chk ? [206, 182, 170] : [190, 168, 158], inR(x, z, -.75, .75, 3.2, 3.75));                           // 文具店前的花岡岩地磚
    const fm = inR(x, z, 9.45, 10.85, 2.5, 6.7); if (fm > 0) { const k = clamp(Math.floor((z - 2.5) / 1.05), 0, 3), fc = FARM[k % 4].slice(), b = 1 + .07 * Math.sin(x * 44); fc[0] *= b; fc[1] *= b; fc[2] *= b; if ((z - 2.5) / 1.05 - k < .05) mix(fc, [186, 172, 134], .9); mix(col, fc, fm); }
  }
  const rd = roadD(x, z);
  if (rd < .34) { if (x < -3.5) mix(col, mix([182, 156, 118], [164, 140, 106], n), ss(.3, .2, rd)); else { mix(col, [198, 194, 186], ss(.34, .3, rd)); mix(col, [94, 97, 104], ss(.25, .22, rd)); const u = (x + z) * 1.6; if (rd < .016 && u - Math.floor(u) < .5) mix(col, [238, 228, 150], 1); } }
  const dr = Math.abs(x - RIV(z)); if (dr < .95) { mix(col, [190, 182, 154], ss(.95, .72, dr) * .85); mix(col, mix([128, 134, 124], [104, 112, 106], n), ss(.66, .56, dr)); }
  if (dp > PIT[2]) mix(col, [150, 110, 72], ss(.36, .12, segD(x, z, CREEK)));
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

/* ---------- 四面側牆的剖面：表土 → 平原的砂礫 → 灰白色的石灰岩 → 更老的岩層。顏色只由 (x,y,z) 決定，轉角會接起來 ---------- */
const WALLS = [
  { len: X1 - X0, at: s => [X0 + s, Z1], sc: 44, shade: 1 },
  { len: Z1 - Z0, at: s => [X0, Z0 + s], sc: 36, shade: .84 },
  { len: X1 - X0, at: s => [X1 - s, Z0], sc: 36, shade: .78 },
  { len: Z1 - Z0, at: s => [X1, Z1 - s], sc: 36, shade: .9 }];
const ROCKC = [[150, 138, 124], [128, 122, 116], [166, 150, 128], [112, 110, 112], [142, 128, 112]], ALLU = [[202, 178, 130], [178, 162, 132], [216, 198, 152], [162, 152, 136]];
function section(w) {
  const sc = Math.round(w.sc * (G.coarse ? .7 : 1)), W = Math.round(w.len * sc), Hh = Math.round((YT - YB) * sc);
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  for (let i = 0; i < W; i++) {
    const [x, z] = w.at((i + .5) / W * w.len), hT = height(x, z), hill = natural(x, z) - P, road = x > -3.4 && roadD(x, z) < .24, bed = Math.abs(x - RIV(z)) < .6;
    const ts = road ? .2 : .1, A = .5 * ss(.6, .1, hill) + .25 * ss(1.6, .5, Math.abs(x - RIV(z))), wob = .3 * fbm(x * .25 + 9, z * .25, 2), wob2 = .12 * fbm(x * .8, z * .8, 2);
    for (let j = Math.max(0, Math.floor((YT - hT - .15) / (YT - YB) * Hh)); j < Hh; j++) {
      const y = YT - (j + .5) / Hh * (YT - YB), dp = hT - y, hs = U.hash(i, j); let col;
      if (dp < 0) continue;
      if (road) col = dp < .05 ? [78, 80, 88] : dp < ts ? (U.hash(i >> 1, j >> 1) < .5 ? [168, 164, 156] : [124, 120, 114]) : null;       // 柏油路面與下面的碎石路基
      else col = dp < .04 ? (bed ? [150, 150, 138] : [93, 154, 62]) : dp < ts ? [84, 62, 44] : null;
      if (!col) {
        if (dp < ts + A) { col = ALLU[(U.hash(Math.floor((y + wob2) / .16), 3) * 4) | 0]; if (U.hash(i >> 1, j >> 1) < .05) col = [140, 136, 128]; }
        else { const s = y + .12 * x - .05 * z + wob;
          if (s > -.9) { const v = s / .24; col = v - Math.floor(v) < .09 ? [178, 172, 160] : (U.hash(Math.floor(v), 9) < .5 ? [216, 211, 198] : [204, 199, 188]); }      // 石灰岩：灰白色，有一層層的層理
          else { const v = s / .45, b = Math.floor(v); col = ROCKC[(U.hash(b, 5) * 5) | 0]; if (v - b < .07) col = [col[0] * .72, col[1] * .72, col[2] * .72]; } }
      }
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

/* ---------- 流動的水：河（清澈）與礦場流出來的小溪（混濁） ---------- */
const GLSL_N = `float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }`;
function flowMat(mud) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: U.time, uMud: { value: mud } },
    vertexShader: `attribute float aU; attribute float aS; varying float vU; varying float vS;
      void main(){ vU = aU; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uMud; varying float vU; varying float vS; ${GLSL_N}
      void main(){ vec2 p = vec2(vU * 1.4, (vS - uTime * .55) * 1.6);
        float st = vnoise(p * vec2(2.2, 1.0)) * .62 + vnoise(p * vec2(4.6, 2.6) + 7.3) * .38;
        vec3 col = mix(vec3(.22, .60, .78), vec3(.66, .47, .27), uMud); col *= mix(.86, 1.0, vU * vU); col += .08 * smoothstep(.52, .78, st);
        gl_FragColor = vec4(pow(col, vec3(2.2)), .88 * smoothstep(1.0, .86, abs(vU)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
}
function ribbon(pts, hw, yOf) {       // 沿著一串點拉出等寬的水帶
  const pos = [], aU = [], aS = [], idx = []; let s = 0;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L, y = yOf(p[0], p[1]);
    if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    for (let k = 0; k <= 4; k++) { const u = k / 2 - 1; pos.push(p[0] - tz * u * hw, y, p[1] + tx * u * hw); aU.push(u); aS.push(s); }
    if (i) for (let k = 0; k < 4; k++) { const n = i * 5 + k; idx.push(n - 5, n, n - 4, n - 4, n, n + 1); }
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1)); geo.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); geo.setIndex(idx); return geo;
}
const along = (Q, step) => { const out = []; for (let i = 0; i < Q.length - 1; i++) { const n = Math.ceil(Math.hypot(Q[i + 1][0] - Q[i][0], Q[i + 1][1] - Q[i][1]) / step); for (let k = i ? 1 : 0; k <= n; k++) out.push([lerp(Q[i][0], Q[i + 1][0], k / n), lerp(Q[i][1], Q[i + 1][1], k / n)]); } return out; };

/* ---------- 建立場景 ---------- */
function build() {
  const T = THREE, scene = new T.Scene(); scene.background = U.skyTexture('#74b6e6', '#eef1e6'); scene.fog = new T.Fog(0xe8eee8, 70, 170);
  U.addSun(scene, 16); scene.add(U.groundShadow(40, 28, YB - .05));
  const anim = [], rnd = U.rng(47), detail = U.detailTexture(12, 8);
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SC = new T.Vector3(), E3 = new T.Euler(), col = new T.Color(), UP = new T.Vector3(0, 1, 0);

  // 地形與側牆
  const pos = new Float32Array(NV * 3), uvs = new Float32Array(NV * 2), idx = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const a = j * (NX + 1) + i; pos[a * 3] = X0 + i * CELL; pos[a * 3 + 1] = H[a]; pos[a * 3 + 2] = Z0 + j * CELL; uvs[a * 2] = i / NX; uvs[a * 2 + 1] = j / NZ; }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(pos, 3)); tg.setAttribute('uv', new T.BufferAttribute(uvs, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  scene.add(U.shadowed(new T.Mesh(tg, new T.MeshStandardMaterial({ map: G.coarse ? groundTexture(704, 448) : groundTexture(1408, 896), bumpMap: detail, bumpScale: 1.5, roughness: .95 })), false, true));
  for (const w of WALLS) scene.add(new T.Mesh(wallGeo(w), new T.MeshBasicMaterial({ map: section(w), color: new T.Color(w.shade, w.shade, w.shade), toneMapped: false, side: T.DoubleSide })));

  // 舊礦場「還沒復育」的樣子：一層光禿的岩石蓋在上面，復育時慢慢淡出
  const bp = [], bi = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = X0 + (i + .5) * CELL, z = Z0 + (j + .5) * CELL; if (Math.hypot(x - OLD[0], z - OLD[1]) > 3 || natural(x, z) - oldY(x, z) < .02) continue;
    const n = bp.length / 3; for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) bp.push(X0 + (i + di) * CELL, H[(j + dj) * (NX + 1) + i + di] + .015, Z0 + (j + dj) * CELL); bi.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); bg.computeVertexNormals();
  const bare = new T.Mesh(bg, new T.MeshStandardMaterial({ color: 0xd2ccbe, roughness: 1, transparent: true, opacity: 0, depthWrite: false })); bare.renderOrder = 1; bare.visible = false; scene.add(bare);

  // 水：河、小溪、池塘，以及河在模型邊緣露出的水體
  const rivPts = []; for (let z = Z0; z <= Z1 + 1e-6; z += .2) rivPts.push([RIV(z), z]);
  const rm = new T.Mesh(ribbon(rivPts, .68, () => WL), flowMat(0)); rm.renderOrder = 4; rm.frustumCulled = false; scene.add(rm);
  const cm = new T.Mesh(ribbon(along(CREEK, .15), .15, (x, z) => height(x, z) + .05), flowMat(1)); cm.renderOrder = 4; cm.frustumCulled = false; scene.add(cm);
  const pond = new T.Mesh(new T.CircleGeometry(.6, 28).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x3f8f8c, roughness: .18, metalness: .1 })); pond.position.set(OLD[0], .5, OLD[1]); scene.add(pond);
  const capMat = new T.MeshBasicMaterial({ color: 0x3f93b8, transparent: true, opacity: .8, side: T.DoubleSide, toneMapped: false });
  for (const zz of [Z0, Z1]) { const cp = [], ci = []; for (let k = 0; k <= 14; k++) { const x = RIV(zz) - .7 + k * .1; cp.push(x, WL, zz, x, Math.min(WL, height(x, zz)), zz); if (k) { const n = k * 2; ci.push(n - 2, n - 1, n, n - 1, n + 1, n); } }
    const cg = new T.BufferGeometry(); cg.setAttribute('position', new T.Float32BufferAttribute(cp, 3)); cg.setIndex(ci); const m = new T.Mesh(cg, capMat); m.position.z = zz > 0 ? .004 : -.004; scene.add(m); }

  /* ----- 建築與物品：用色塊拼出來，合併成一個網格 ----- */
  const kit = () => { const parts = [], put = (geo, hex, x, y, z, ry) => { if (ry) geo.rotateY(ry); geo.translate(x, y, z); parts.push([geo, hex]); };
    return { parts, put, bx: (w, h, d, hex, x, y, z, ry) => put(new T.BoxGeometry(w, h, d), hex, x, y + h / 2, z, ry), cy: (r0, r1, h, hex, x, y, z, seg = 10) => put(new T.CylinderGeometry(r0, r1, h, seg), hex, x, y + h / 2, z),
      roof: (w, h, d, hex, x, y, z) => { const s = new T.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath(); const g = new T.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); put(g, hex, x, y, z); },
      mesh: () => U.shadowed(new T.Mesh(U.merge(parts), new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }))) }; };
  const K = kit(), { bx, cy, put, roof } = K, GLASS = '#86c8ec', gy = height;

  // 廟：安山岩的臺基、石階、龍柱和石獅
  bx(2.5, .22, 1.9, '#9a9da3', 0, P, -3.4); [[.165, -2.39], [.11, -2.27], [.055, -2.15]].forEach(s => bx(1.1, s[0], .12, '#868990', 0, P, s[1]));
  bx(1.9, .62, 1.1, '#b8482f', 0, P + .22, -3.55); for (const x of [-.8, -.3, .3, .8]) cy(.045, .05, .62, '#8d9096', x, P + .22, -2.9);
  bx(2.5, .05, 1.8, '#a84a1c', 0, P + .84, -3.4); roof(2.4, .42, 1.7, '#d2691e', 0, P + .89, -3.4); for (const x of [-1.2, 1.2]) bx(.1, .16, .08, '#2f7d5b', x, P + 1.25, -3.4);
  bx(.3, .3, .02, '#3a2a22', 0, P + .22, -2.99);
  for (const x of [-.75, .75]) { bx(.16, .12, .16, '#868990', x, P, -2.0); put(new T.IcosahedronGeometry(.085, 1), '#a3a6ac', x, P + .2, -2.0); put(new T.IcosahedronGeometry(.05, 1), '#a3a6ac', x, P + .3, -1.95); }
  // 美術館：大理岩的牆面、圓柱和雕像
  bx(2.1, .16, 1.5, '#e6e3dc', 3.0, P, -3.3); bx(1.8, .75, 1.0, '#f5f3ee', 3.0, P + .16, -3.45); for (let k = 0; k < 6; k++) cy(.05, .056, .75, '#ffffff', 3.0 + (k - 2.5) * .33, P + .16, -2.75, 12);
  bx(2.0, .1, 1.45, '#efece6', 3.0, P + .91, -3.3); roof(2.0, .3, 1.45, '#f4f1eb', 3.0, P + 1.01, -3.3); bx(.3, .4, .02, '#6b5a4a', 3.0, P + .16, -2.94);
  bx(.18, .2, .18, '#d9d6cf', 3.0, P, -1.95); cy(.045, .06, .24, '#fafafa', 3.0, P + .2, -1.95); put(new T.IcosahedronGeometry(.055, 1), '#fafafa', 3.0, P + .5, -1.95);
  // 石板屋：板岩的牆、屋頂和圍牆
  bx(1.3, .36, .85, '#555b64', 9.5, P, -4.6); roof(1.5, .26, 1.15, '#3b4048', 9.5, P + .36, -4.6); bx(.16, .24, .02, '#2a2420', 9.5, P, -4.17); bx(1.9, .1, .06, '#4a4f57', 9.5, P, -3.45);
  for (let k = 0; k < 4; k++) bx(.34, .035, .22, k % 2 ? '#4a4f57' : '#5d636c', 10.55, P + k * .035, -3.9, k * .2);
  // 石橋：花岡岩砌的橋面、欄杆、橋墩和拱
  bx(1.9, .1, .66, '#cdb9ae', BRX, P - .08, 1); for (const s of [-1, 1]) { bx(1.9, .1, .05, '#b9a59a', BRX, P + .02, 1 + s * .33); for (const dx of [-.3, .3]) bx(.14, .52, .1, '#b9a59a', BRX + dx, -.14, 1 + s * .28); for (const dx of [-.6, 0, .6]) put(new T.TorusGeometry(.25, .04, 5, 10, Math.PI), '#a8958a', BRX + dx, .1, 1 + s * .335); }
  // 學校：整排的玻璃窗
  bx(2.6, .8, .7, '#efe2c6', 2.95, P, 4.1); bx(2.7, .06, .8, '#b0643f', 2.95, P + .8, 4.1);
  for (let k = 0; k < 7; k++) for (const y of [.14, .5]) for (const s of [-1, 1]) bx(.24, .2, .02, GLASS, 2.95 + (k - 3) * .36, P + y, 4.1 + s * .355);
  cy(.012, .012, .9, '#d0d3d8', 1.95, P, 5.0, 6); bx(.2, .12, .01, '#d33a3a', 2.06, P + .76, 5.0);
  // 文具店：屋頂上的大鉛筆（黑色的筆芯是石墨）
  bx(.95, .5, .75, '#f3cf7a', 0, P, 4.2); bx(.95, .04, .22, '#d2452f', 0, P + .32, 4.68); bx(.6, .2, .02, GLASS, 0, P + .08, 4.58); for (const x of [-.25, .25]) bx(.04, .08, .04, '#8a8d93', x, P + .5, 4.2);
  put(new T.CylinderGeometry(.06, .06, .8, 6).rotateZ(Math.PI / 2), '#f2b705', 0, P + .64, 4.2); put(new T.CylinderGeometry(.061, .061, .1, 6).rotateZ(Math.PI / 2), '#e8789a', -.45, P + .64, 4.2);
  put(new T.ConeGeometry(.06, .16, 6).rotateZ(-Math.PI / 2), '#e8c9a0', .48, P + .64, 4.2); put(new T.ConeGeometry(.026, .07, 6).rotateZ(-Math.PI / 2), '#2b2b2e', .535, P + .64, 4.2);
  // 資源回收站
  [['#2f6fb5', -.2], ['#3a9a5c', 0], ['#e0a526', .2]].forEach(c => bx(.16, .2, .16, c[0], .6 + c[1], P, 2.85)); bx(.7, .03, .26, '#6b7078', .6, P + .34, 2.85); for (const x of [.28, .92]) bx(.03, .34, .03, '#6b7078', x, P, 2.85);
  // 住家
  const HOUSES = [[-.5, .25], [.3, .25], [2.3, .25], [3.1, .25], [3.9, .25], [7.4, .25], [8.2, .25], [9.8, .25], [10.5, .25], [-.9, 1.8], [-.1, 1.8], [2.3, 1.8], [3.1, 1.8], [3.9, 1.8], [7.4, 1.8], [8.2, 1.8], [9.8, 1.8], [10.5, 1.8],
    [-.5, -.95], [.3, -.95], [2.3, -.95], [3.1, -.95], [3.9, -.95], [7.4, -1], [8.2, -1], [9.8, -1], [10.5, -1], [7.4, -2.3], [9.9, -2.3], [-.4, 5.9], [.5, 5.9]];
  HOUSES.forEach(([x, z], k) => { const q = U.hash(k, 4), wall = ['#f3ede0', '#efe2c6', '#e8dccb', '#f6eedd'][k % 4], rf = ['#b4513a', '#a8563c', '#7d6a5c', '#c06a45'][(q * 4) | 0];
    bx(.5, .34, .42, wall, x, P, z); roof(.58, .2, .52, rf, x, P + .34, z); for (const dx of [-.13, .13]) bx(.11, .12, .02, GLASS, x + dx, P + .13, z + .215); bx(.08, .16, .02, '#6b4a34', x, P, z + .216); });
  // 工地：混凝土的柱子與樓板、碎石堆、砂堆、水泥袋、攪拌車
  for (let f = 0; f < 3; f++) { for (const x of [7.5, 7.9, 8.3]) for (const z of [3.7, 4.3]) bx(.07, .34, .07, '#b3afa6', x, P + f * .34, z); bx(1.0, .04, .8, '#c2beb5', 7.9, P + (f + 1) * .34 - .04, 4.0); }
  for (const x of [7.5, 7.9, 8.3]) for (const z of [3.7, 4.3]) bx(.012, .16, .012, '#7a4a32', x, P + 1.02, z);
  put(new T.ConeGeometry(.42, .32, 14), '#8f8b85', 7.45, P + .16, 5.65); put(new T.ConeGeometry(.38, .26, 14), '#dcc58f', 8.3, P + .13, 5.6);
  for (let k = 0; k < 5; k++) bx(.2, .06, .13, '#c9c6be', 8.45 + (k % 2) * .03, P + ((k / 2) | 0) * .06, 4.95 + (k % 2) * .15);
  bx(.3, .06, .16, '#3a3d44', 7.75, P + .04, 5.0); bx(.1, .14, .16, '#e9e9e9', 7.92, P + .1, 5.0); put(new T.CylinderGeometry(.075, .095, .2, 10).rotateZ(Math.PI / 2 - .25), '#d95b2b', 7.7, P + .2, 5.0);
  bx(.09, 2.0, .09, '#f2b21a', 7.2, P, 4.9); bx(.2, .06, .2, '#f2b21a', 7.2, P + 2.0, 4.9);
  // 溫室與農舍
  for (const x of [9.65, 10.55]) for (const z of [2.95, 3.45]) bx(.03, .3, .03, '#e8ecef', x, P, z); bx(.96, .03, .56, '#e8ecef', 10.1, P + .3, 3.2);
  // 水泥廠：儲存槽、高塔、旋轉窯、煙囪、倉庫
  for (let k = 0; k < 3; k++) { cy(.2, .2, .9, '#cfcbc1', -2.95 + k * .45, P, 3.5, 14); put(new T.ConeGeometry(.2, .12, 14), '#b9b5ab', -2.95 + k * .45, P + .96, 3.5); }
  bx(.36, 1.2, .36, '#aeb1b6', -1.6, P, 3.55); bx(.42, .05, .42, '#8f9298', -1.6, P + .6, 3.55); put(new T.CylinderGeometry(.09, .09, 1.1, 10).rotateZ(Math.PI / 2 - .06), '#8a7a6c', -2.3, P + .26, 4.15);
  cy(.05, .07, 1.5, '#c8c4ba', -3.0, P, 4.2); bx(.9, .35, .5, '#d9d4c8', -2.1, P, 4.7); roof(.96, .16, .56, '#7b8089', -2.1, P + .35, 4.7);
  // 礦業博物館、舊坑道口與展示的礦車
  const mg = gy(-1.9, -.6), tg0 = gy(-2.9, -1.0);
  bx(1.2, .44, .7, '#b55a3e', -1.9, mg - .03, -.6); roof(1.3, .24, .8, '#5b6470', -1.9, mg + .41, -.6); for (const dx of [-.36, .36]) bx(.2, .16, .02, GLASS, -1.9 + dx, mg + .14, -.245); bx(.14, .24, .02, '#4a3426', -1.9, mg - .02, -.245); bx(.5, .14, .03, '#fff3c4', -1.9, mg + .46, -.22);
  bx(.3, .62, .78, '#9a958a', -3.02, tg0 - .12, -1.0); bx(.3, .42, .46, '#17161a', -2.99, tg0 - .12, -1.0);
  const cg0 = gy(-2.45, -1.0); bx(.24, .12, .17, '#3d4a56', -2.45, cg0 + .05, -1.0); put(new T.IcosahedronGeometry(.08, 0), '#26262a', -2.45, cg0 + .2, -1.0); for (const dz of [-.07, .07]) bx(.5, .015, .02, '#6b5a4a', -2.5, cg0 + .02, -1.0 + dz);
  // 舊礦場的涼亭
  const pv = gy(-2.75, -2.35); for (const dx of [-.14, .14]) for (const dz of [-.14, .14]) bx(.03, .26, .03, '#7a5a40', -2.75 + dx, pv, -2.35 + dz); put(new T.ConeGeometry(.3, .16, 4).rotateY(Math.PI / 4), '#b0563c', -2.75, pv + .34, -2.35);
  // 礦場：挖土機、鑽孔機、切下來的石材
  bx(.34, .06, .28, '#2b2b2e', -6.7, .7, 1.5); bx(.3, .13, .22, '#f2b21a', -6.7, .76, 1.5); bx(.12, .12, .12, '#f7c948', -6.76, .89, 1.44);
  put(new T.BoxGeometry(.5, .05, .05).rotateZ(.7), '#f2b21a', -6.42, 1.05, 1.5); put(new T.BoxGeometry(.36, .04, .04).rotateZ(-1.0), '#f2b21a', -6.14, 1.07, 1.5); bx(.1, .09, .1, '#3a3d44', -6.05, .86, 1.5);
  for (let k = 0; k < 7; k++) bx(.26, .16, .2, k % 2 ? '#efebe2' : '#e2ddd2', -5.75 + (k % 3) * .29, .7 + ((k / 3) | 0) * .16, .35 + ((k % 2) * .04));
  const b1 = pitY(-7.6, 1.2); bx(.2, .1, .16, '#e0a526', -7.6, b1, 1.2); bx(.03, .5, .03, '#8a8d93', -7.52, b1, 1.2);
  scene.add(K.mesh());
  const gh = new T.Mesh(new T.BoxGeometry(.9, .3, .5), new T.MeshStandardMaterial({ color: 0xcdeaf7, transparent: true, opacity: .45, roughness: .1 })); gh.position.set(10.1, P + .15, 3.2); scene.add(gh);

  // 起重機的吊臂（慢慢轉）
  const J = kit(); J.bx(1.7, .05, .06, '#f2b21a', .55, 0, 0); J.bx(.26, .14, .14, '#8a8d93', -.32, -.05, 0); J.bx(.012, .5, .012, '#44474e', 1.1, -.5, 0); J.bx(.07, .06, .07, '#d33a3a', 1.1, -.56, 0);
  const jib = J.mesh(); jib.position.set(7.2, P + 2.08, 4.9); scene.add(jib); anim.push(t => { jib.rotation.y = .9 + Math.sin(t * .22) * .9; });

  // 砂石車：在礦場和小鎮之間來回（往東載著石材）
  const TK = kit(); TK.bx(.26, .09, .17, '#d8d2c2', -.05, .05, 0); TK.bx(.2, .05, .13, '#f4f1ea', -.05, .14, 0); TK.bx(.11, .14, .16, '#2f6fb5', .15, .05, 0); for (const x of [-.12, .13]) for (const z of [-.09, .09]) TK.put(new T.CylinderGeometry(.036, .036, .03, 8).rotateX(Math.PI / 2), '#222226', x, .036, z);
  const trucks = new T.InstancedMesh(U.merge(TK.parts), new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }), 4); trucks.castShadow = true; trucks.frustumCulled = false; scene.add(trucks);
  const roadY = (x, z) => Math.abs(x - BRX) < 1 ? P + .02 : Math.max(height(x, z), P);
  anim.push(t => { for (let k = 0; k < 4; k++) { const u = (t * .028 + k / 4) % 1 * 2, east = u < 1, x = east ? lerp(-4.9, 8.6, u) : lerp(8.6, -4.9, u - 1), z = east ? 1.12 : .88;
    Q.setFromAxisAngle(UP, east ? 0 : Math.PI); M4.compose(V.set(x, roadY(x, z), z), Q, SC.set(1, 1, 1)); trucks.setMatrixAt(k, M4); } trucks.instanceMatrix.needsUpdate = true; });

  // 樹：山上的森林、小鎮裡零星的樹
  const tr = U.rng(15), trees = [], NTR = G.coarse ? 300 : 460;
  for (let k = 0; k < 9000 && trees.length < NTR; k++) { const x = X0 + .25 + tr() * 10.5, z = Z0 + .25 + tr() * (Z1 - Z0 - .5), nat = natural(x, z), h = height(x, z);
    if (nat - P < .28 || nat - h > .03 || segD(x, z, SCAR) < .5 || roadD(x, z) < .5 || segD(x, z, CREEK) < .4 || Math.hypot(x + 2.4, z + .8) < 1.1) continue; trees.push([x, h, z, .8 + tr() * .7, tr() < .6 ? 0 : 1]); }
  for (const [x, z, k] of [[4.5, -1.8, 1], [4.55, 2.7, 1], [7.05, -3.6, 1], [7.0, 2.6, 1], [4.4, 6.3, 1], [7.1, 6.7, 1], [-1.5, -4.3, 1], [-1.6, -2.6, 1], [1.0, -5.2, 1], [10.6, -5.3, 0], [8.5, -5.6, 0], [10.7, -3.0, 0], [4.3, -4.4, 1], [2.1, -5.0, 1], [.2, 6.6, 1], [-1.3, 6.2, 1], [-1.0, 2.9, 1], [9.5, 6.9, 1], [4.6, .1, 1], [7.0, .3, 1], [-.9, -5.6, 0], [3.6, -5.6, 0], [8.1, -6.2, 0], [1.9, 2.6, 1], [4.3, 3.2, 1]]) trees.push([x, P, z, .9 + tr() * .5, k]);
  U.plantTrees(scene, trees, tr, .62);
  // 舊礦場階梯上種回去的樹：可以從小苗長到大樹
  const og = U.treeGeos(.62), young = [], NY = 80, treeMat = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 });
  for (let k = 0; k < 6000 && young.length < NY; k++) { const a = tr() * 6.283, d = OLD[2] + .12 + tr() * 2.0, x = OLD[0] + Math.cos(a) * d, z = OLD[1] + Math.sin(a) * d, f = (d - OLD[2]) / .42;
    if (natural(x, z) - oldY(x, z) < .1 || d > OLD[3] + .05 || f - Math.floor(f) < .3 || f - Math.floor(f) > .85 || Math.hypot(x + 2.75, z + 2.35) < .35) continue; young.push({ x, y: height(x, z), z, s: .55 + tr() * .5, d: tr() * .55, r: tr() * 6.283 }); }
  const yim = new T.InstancedMesh(og.broad, treeMat, young.length); yim.castShadow = true; yim.frustumCulled = false; scene.add(yim);
  let grow = 1; const setGrow = () => { young.forEach((o, k) => { const s = Math.max(.001, o.s * ss(o.d, o.d + .4, grow)); Q.setFromAxisAngle(UP, o.r); M4.compose(V.set(o.x, o.y - .02, o.z), Q, SC.set(s, s, s)); yim.setMatrixAt(k, M4); }); yim.instanceMatrix.needsUpdate = true; bare.material.opacity = 1 - ss(0, .55, grow); bare.visible = grow < .56; };
  young.forEach((o, k) => yim.setColorAt(k, col.setHSL(.27 + (tr() - .5) * .05, .4, .75 + tr() * .2))); setGrow();

  // 雲、煙、粉塵
  [[2.5, 9.6, -4.2, 3.2], [8.5, 10.2, -1.5, 2.6]].forEach((c, k) => { const cl = U.cloud(c[3], c[3] * .42, c[3] * .6, 7, rnd); cl.position.set(c[0], c[1], c[2]); scene.add(cl); anim.push(t => { cl.position.x = c[0] + Math.sin(t * .05 + k * 2) * 1.4; }); });
  const puffGeo = new T.IcosahedronGeometry(.16, 2), smokeMat = new T.MeshBasicMaterial({ color: 0xe8e6e0, transparent: true, opacity: .55, depthWrite: false }), dustMat = new T.MeshBasicMaterial({ color: 0xd9cfb8, transparent: true, opacity: .4, depthWrite: false });
  for (let k = 0; k < 5; k++) { const m = new T.Mesh(puffGeo, smokeMat); scene.add(m); anim.push(t => { const u = (t * .13 + k / 5) % 1; m.position.set(-3.0 + u * u * 1.1, P + 1.55 + u * 1.5, 4.2 - u * .3); m.scale.setScalar((.4 + u * 1.5) * (1 - u * u)); }); }
  [[-6.3, .95, 1.5], [-5.6, .95, .5], [-7.5, 1.7, 1.2], [-5.0, 1.0, 1.0]].forEach((d, k) => { for (let q = 0; q < 2; q++) { const m = new T.Mesh(puffGeo, dustMat); scene.add(m); anim.push(t => { const u = (t * .2 + k * .27 + q * .5) % 1; m.position.set(d[0] + Math.sin(k * 3 + q) * .12 + u * .25, d[1] + u * .5, d[2] + Math.cos(k * 2 + q) * .12); m.scale.setScalar((.5 + u * 1.3) * (1 - u)); }); } });

  // 「開採的代價」：烏雲、雨、沿著崩塌溝衝下來的土石（開這個節點時才出現）
  const storm = U.cloud(4.2, 1.5, 2.8, 8, rnd); storm.traverse(o => { if (o.isMesh) { o.material.color.set(0x8a929c); o.material.emissiveIntensity = .04; } }); storm.position.set(-7.3, 6.7, -.1); scene.add(storm);
  const NR = G.coarse ? 60 : 110, rain = new T.InstancedMesh(new T.BoxGeometry(.012, .26, .012), new T.MeshBasicMaterial({ color: 0xd6e8f7, transparent: true, opacity: .75, depthWrite: false }), NR), drops = Array.from({ length: NR }, () => [-9.2 + rnd() * 4.2, -1.7 + rnd() * 3.6, rnd(), .8 + rnd() * .5]); rain.frustumCulled = false; scene.add(rain);
  const scarPts = along(SCAR, .1), ND = 34, debris = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: 0x8a6846, roughness: 1, flatShading: true }), ND), dq0 = Array.from({ length: ND }, () => [rnd(), (rnd() - .5) * .26, .035 + rnd() * .045, rnd() * 6]); debris.castShadow = true; debris.frustumCulled = false; scene.add(debris);
  let kc = 0;
  const stormStep = t => {
    storm.visible = kc > .02; rain.visible = debris.visible = kc > .05; if (!storm.visible) return; storm.scale.setScalar(Math.max(.01, kc));
    Q.identity(); drops.forEach((d, k) => { const u = (t * .9 * d[3] + d[2]) % 1, y = 6.2 - u * 6.2, gh2 = height(d[0], d[1]); M4.compose(V.set(d[0] + u * .15, Math.max(y, gh2), d[1]), Q, SC.setScalar(y > gh2 ? kc : .001)); rain.setMatrixAt(k, M4); }); rain.instanceMatrix.needsUpdate = true;
    dq0.forEach((d, k) => { const u = (t * .16 + d[0]) % 1, f = u * (scarPts.length - 1), i = Math.min(f | 0, scarPts.length - 2), a = scarPts[i], b = scarPts[i + 1], x = lerp(a[0], b[0], f - i) + d[1] * .7, z = lerp(a[1], b[1], f - i) + d[1], s = d[2] * kc * ss(0, .06, u) * ss(1, .92, u);
      E3.set(u * 30 + d[3], d[3], u * 22); Q.setFromEuler(E3); M4.compose(V.set(x, height(x, z) + d[2] * .6, z), Q, SC.set(s, s * .8, s)); debris.setMatrixAt(k, M4); }); debris.instanceMatrix.needsUpdate = true;
  };

  /* 節點圓點、解說標籤與可以點的物品 */
  const zn = G.zones.use, def = G.zoneDef('use'), dots = {}, tags = {}, picks = [];
  for (const n of zn.nodes) dots[n.id] = G.addLabel(`<b>${n.num}</b><span>${n.title}</span>`, 'node' + (n.ready ? '' : ' soon'), n.at, { color: n.color || def.color, onClick: () => G.openNode(n.id) });
  // pk(節點, 圖鑑第幾張, 物品中心, 可點的半徑, 標籤高度, 標籤文字)
  const pk = (node, card, p, r, dy, html) => { (tags[node] = tags[node] || []).push(G.addLabel(html, 'tag', [p[0], p[1] + dy, p[2]])); if (r) picks.push({ p: new T.Vector3(...p), r, node, card }); };
  pk('rock', 1, [0, P + .5, -3.2], 1.2, 1.8, '廟的石階、龍柱和石獅<small>安山岩：堅硬、耐磨</small>');
  pk('rock', 0, [BRX, P, 1], .9, .75, '石橋<small>花岡岩：堅硬，不怕風吹雨打</small>');
  pk('rock', 3, [3.3, P + .5, -3.2], 1.1, 1.15, '美術館的牆面和雕像<small>大理岩：花紋漂亮、容易雕刻</small>');
  pk('rock', 4, [9.5, P + .3, -4.5], .9, .85, '石板屋<small>板岩：能劈成平整的薄板</small>');
  pk('rock', 2, [-2.3, P + .6, 3.9], 1.2, 1.7, '水泥廠<small>石灰岩是水泥的主要原料</small>');
  pk('rock', 5, [7.9, P + .15, 5.6], .75, .7, '碎石和砂<small>和水泥、水拌成混凝土</small>');
  pk('rock', 5, [1.4, P, 6.6], .45, .55, '馬路下面<small>鋪了碎石當路基（看前面的剖面）</small>');
  pk('mineral', 0, [2.2, P + .4, 4.2], .75, 1.9, '教室的玻璃窗<small>石英：製造玻璃的原料</small>');
  pk('mineral', 6, [4.3, P + .4, 4.2], .75, .7, '黑板上的粉筆字<small>石膏：可以做粉筆</small>');
  pk('mineral', 3, [0, P + .6, 4.2], .6, .5, '文具店的大鉛筆<small>石墨：很軟，可以做鉛筆芯</small>');
  pk('mineral', 1, [8.2, P + .2, .25], .4, .65, '碗盤和磁磚<small>長石：製作陶瓷的原料</small>');
  pk('mineral', 2, [7.4, P + .2, -2.3], .4, .65, '吹風機裡的絕緣片<small>白雲母：不容易導電、耐高溫</small>');
  pk('mineral', 4, [.3, P + .2, -.95], .4, .65, '爽身粉<small>滑石：磨成滑滑的細粉</small>');
  pk('mineral', 5, [10.1, P + .1, 4.8], .9, .55, '農田的肥料<small>硫磺：製造肥料的原料</small>');
  pk('mineral', 7, [7.9, P + .5, 4.0], .75, 1.45, '切割混凝土的鋸片和鑽頭<small>金剛石：最硬的礦物</small>');
  pk('cost', 0, [-6.5, 1.5, .2], 1.5, 1.7, '露天礦場<small>把山一階一階往下挖</small>');
  pk('cost', 2, [-8.0, 2.4, -.6], .8, 1.1, '裸露的山坡<small>沒有植物抓住土石，大雨時就崩落</small>');
  pk('cost', 3, [-4.2, .5, 3.9], .6, .55, '混濁的溪水<small>泥沙被雨水沖進溪裡</small>');
  pk('cost', 0, [-7.1, 3.4, -1.9], 0, .3, '被挖掉的山<small>再也長不回來</small>');
  pk('cost', 3, [-5.6, .9, .5], 0, .75, '粉塵<small>開採和搬運時揚起</small>');
  pk('renew', 0, [-4.5, 1.6, -3.3], 1.1, 1.0, '植生復育<small>在階梯上鋪土、種回樹木</small>');
  pk('renew', 2, [OLD[0], .6, OLD[1]], .6, .5, '池塘<small>舊礦坑積水，成為生物的新家</small>');
  pk('renew', 1, [-1.9, mg + .3, -.6], .75, .85, '礦業博物館<small>保存開採的歷史</small>');
  pk('renew', 1, [-3.0, tg0 + .3, -1.0], 0, .6, '舊坑道口');
  pk('renew', 3, [.6, P + .15, 2.85], .45, .6, '資源回收站<small>玻璃、金屬回收再利用</small>');
  const growTag = G.addLabel('', 'tag', [-2.4, 3.3, -4.8]);

  /* 點模型：點到物品就開節點並跳到對應的圖鑑卡；點到礦場就開對應的節點 */
  const pickAt = rr => { if (!rr) return null; let best = null, bd = 1e9; for (const q of picks) { if (rr.ray.distanceToPoint(q.p) > q.r) continue; const d = rr.ray.origin.distanceTo(q.p) - (q.node === cur ? 100 : 0); if (d < bd) { bd = d; best = q; } } return best; };
  const hitAt = rr => { if (!rr) return null; const o = rr.ray.origin, d = rr.ray.direction; for (let t = 2; t < 110; t += .12) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < YB) break; if (x < X0 || x > X1 || z < Z0 || z > Z1) continue; if (y < height(x, z)) return [x, z]; } return null; };
  const areaAt = p => { if (!p) return null; const [x, z] = p, nat = natural(x, z); return nat - pitY(x, z) > .02 || segD(x, z, SCAR) < .4 ? 'cost' : nat - oldY(x, z) > .02 ? 'renew' : null; };
  const jump = q => { if (G.state.nodeId !== q.node) G.openNode(q.node); if (q.card == null || !zn.nodes.find(n => n.id === q.node).cards) return; if (G.ui.tab() !== 'cards') G.ui.show('cards');
    const el = document.querySelectorAll('#pBody .rcard')[q.card]; if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('uhit'); setTimeout(() => el.classList.remove('uhit'), 1800); } };
  let cur = null, hot = null;
  return {
    scene, home: { pos: [.6, 11.5, 22.5], target: [.6, .3, 0] },
    view: { minDist: 3, maxDist: 60, maxPolar: Math.PI * .49, pan: { x: [X0, X1], y: [YB, 5], z: [Z0, Z1] } },
    onNode: id => { if (id === 'renew' && cur !== 'renew') grow = 0; if (id !== 'renew') grow = 1; cur = id; setGrow();
      for (const k in tags) tags[k].forEach(L => L.el.classList.toggle('show', k === id)); for (const k in dots) dots[k].el.classList.toggle('cur', k === id); growTag.el.classList.toggle('show', id === 'renew'); },
    onHover: rr => { const n = pickAt(rr) || areaAt(hitAt(rr)); if (n !== hot) { hot = n; G.canvas.style.cursor = n ? 'pointer' : ''; } },
    onTap: rr => { const q = pickAt(rr); if (q) return jump(q); const a = areaAt(hitAt(rr)); if (a && a !== G.state.nodeId) G.openNode(a); },
    update(dt, t) {
      kc += ((cur === 'cost' ? 1 : 0) - kc) * Math.min(1, dt * 2.5); stormStep(t);
      if (cur === 'renew' && grow < 1) { grow = Math.min(1, grow + dt / 10); setGrow(); const s = grow < .3 ? '① 鋪上土壤、種下小苗' : grow < 1 ? '② 很多年過去，小苗慢慢長大……' : '③ 樹林長回來了（關掉面板再打開，可以重看）'; if (growTag.el.textContent !== s) growTag.el.textContent = s; }
      for (const f of anim) f(t, dt);
    },
    dispose() { G.canvas.style.cursor = ''; U.dispose(scene); }
  };
}

/* ---------- 圖鑑與認識頁的繪圖（SVG）：沒有實景照片時顯示 ---------- */
const f1 = n => n.toFixed(1);
const lab = (x, y, s, c = '#1f3345') => { const w = s.length * 12.5 + 12; return `<rect x="${f1(x - w / 2)}" y="${y - 14}" width="${f1(w)}" height="19" rx="6" fill="rgba(255,255,255,.93)"/><text x="${x}" y="${y}" font-size="12.5" font-weight="900" text-anchor="middle" fill="${c}">${s}</text>`; };
const arrow = (x0, y0, x1, y1, c = '#b45309') => `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><path d="M3 0L-8 -6L-8 6Z" fill="${c}" transform="translate(${x1} ${y1}) rotate(${f1(Math.atan2(y1 - y0, x1 - x0) * 57.3)})"/>`;
const speck = (r, n, x, y, w, h, cs, s = 1.3) => { let o = ''; for (let i = 0; i < n; i++) o += `<circle cx="${f1(x + r() * w)}" cy="${f1(y + r() * h)}" r="${f1(.5 + r() * s)}" fill="${cs[i % cs.length]}"/>`; return o; };
const tree = (x, y, s = 1, c = '#4f8a36') => `<rect x="${f1(x - 1.5 * s)}" y="${f1(y - 8 * s)}" width="${f1(3 * s)}" height="${f1(8 * s)}" fill="#6b4a34"/><circle cx="${x}" cy="${f1(y - 13 * s)}" r="${f1(8 * s)}" fill="${c}"/>`;
const house = (x, y, w, h, wall, rf) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${wall}"/><path d="M${x - 4} ${y}L${x + w / 2} ${y - h * .6}L${x + w + 4} ${y}Z" fill="${rf}"/>`;
const SKY = '#dceefb';
// 礦場的側面圖：mode 0 開採中、1 種回樹木、2 變成公園和池塘
function pitSVG(mode) {
  const hill = 'M0 180V110Q60 40 150 34Q230 30 320 90V180Z', st = 'M96 0V50H116V70H136V90H156V110H176V130H236V110H256V90H276V70H296V0Z';
  let o = `<defs><clipPath id="up${mode}"><path d="${hill}"/></clipPath></defs><path d="${hill}" fill="#6fa35a"/><path d="${st}" clip-path="url(#up${mode})" fill="${mode ? '#b9d39a' : '#e6e1d5'}" stroke="${mode ? '#7d9a5e' : '#a8a294'}" stroke-width="2"/>`;
  for (const [x, y] of [[116, 70], [136, 90], [156, 110], [236, 110], [256, 90], [276, 70]]) o += `<path d="M${x} ${y - 20}V${y}" stroke="${mode ? '#8a7458' : '#8f897c'}" stroke-width="3"/>`;
  for (const [x, y, s] of [[28, 132, 1.1], [52, 108, 1], [74, 90, .9], [40, 160, 1.2], [84, 140, 1]]) o += tree(x, y, s);
  if (!mode) o += `<rect x="188" y="118" width="26" height="9" fill="#2b2b2e"/><rect x="190" y="106" width="22" height="12" fill="#f2b21a"/><path d="M210 108L228 92L236 108" stroke="#f2b21a" stroke-width="4" fill="none"/><rect x="230" y="106" width="9" height="8" fill="#3a3d44"/>${lab(206, 22, '一階一階往下挖')}`;
  else { const big = mode === 2 ? 1 : .55;
    for (const [x, y] of [[106, 70], [126, 90], [146, 110], [166, 130], [246, 110], [266, 90], [286, 70], [222, 130]]) o += tree(x, y, big, '#3f9a4c') + (mode === 1 ? `<path d="M${x - 9} ${y}h18" stroke="#8a6a48" stroke-width="3"/>` : '');
    if (mode === 2) o += `<ellipse cx="204" cy="131" rx="24" ry="5" fill="#5fb3d9"/><path d="M196 130q4 -5 8 0" stroke="#fff" stroke-width="2" fill="none"/><ellipse cx="212" cy="129" rx="4" ry="2.5" fill="#fff"/>${lab(196, 22, '礦場變成公園和池塘')}`;
    else o += lab(206, 22, '鋪上土壤、種回樹木'); }
  return o;
}
function uSVG(kind) {
  const r = U.rng(kind.length * 31 + kind.charCodeAt(0) * 7), id = 'us_' + kind; let o = '', bg = SKY;
  if (kind === 'granite') {
    const br = 'M20 78H300V96H280V150H250V128a30 30 0 0 0 -60 0V150H130V128a30 30 0 0 0 -60 0V150H40V96H20Z';
    o = `<rect y="118" width="320" height="62" fill="#7fbfe0"/><path d="M0 96H40V180H0ZM280 96H320V180H280Z" fill="#8dbb6a"/><defs><clipPath id="${id}"><path d="${br}"/></clipPath></defs>
      <g clip-path="url(#${id})"><rect width="320" height="180" fill="#d3bdb1"/>${speck(r, 420, 20, 78, 280, 72, ['#f3e9e2', '#a98f84', '#3a3432', '#e2a79b'], 1.5)}<path d="M20 96H300M40 112H280M40 128H280" stroke="rgba(90,60,50,.35)" stroke-width="1.5"/></g>
      <path d="${br}" fill="none" stroke="#7d6257" stroke-width="2"/><rect x="20" y="64" width="280" height="14" fill="#bfa89c" stroke="#7d6257" stroke-width="1.5"/>${lab(160, 28, '花岡岩砌成的石橋')}`; }
  if (kind === 'andesite') { bg = '#e9eef2';
    o = `<rect width="320" height="58" fill="#b8482f"/><rect x="96" y="14" width="44" height="44" fill="#3a2a22"/><rect x="232" y="0" width="20" height="58" fill="#8d9096"/><path d="M232 10l20 8M232 26l20 8M232 42l20 8" stroke="#5d6066" stroke-width="3"/>`;
    for (let k = 0; k < 5; k++) o += `<rect x="${24 - k * 5}" y="${58 + k * 22}" width="${200 + k * 10}" height="22" fill="${k % 2 ? '#8b8e95' : '#9a9da3'}"/><path d="M${24 - k * 5} ${59 + k * 22}h${200 + k * 10}" stroke="#c3c6cc" stroke-width="2"/>`;
    let mane = ''; for (let k = 0; k < 11; k++) { const a = (k / 11) * 6.283; mane += `<circle cx="${f1(285 + Math.cos(a) * 14)}" cy="${f1(90 + Math.sin(a) * 14)}" r="5.5" fill="#8f9299" stroke="#5d6066" stroke-width="1"/>`; }
    o += `<defs><clipPath id="${id}"><path d="M24 58H224L244 168H4Z"/></clipPath></defs><g clip-path="url(#${id})">${speck(r, 260, 4, 58, 240, 110, ['#eef0ee', '#2b2c30', '#73787f'], .9)}</g><rect x="262" y="132" width="46" height="38" fill="#868990" stroke="#5d6066" stroke-width="1.5"/><path d="M268 132V112Q268 100 285 100Q302 100 302 112V132Z" fill="#a3a6ac" stroke="#5d6066" stroke-width="1.5"/><path d="M276 132v-14M294 132v-14" stroke="#5d6066" stroke-width="1.5"/>${mane}<path d="M275 80l-3 -9l9 4ZM295 80l3 -9l-9 4Z" fill="#a3a6ac" stroke="#5d6066" stroke-width="1.2"/><circle cx="285" cy="90" r="12" fill="#a3a6ac" stroke="#5d6066" stroke-width="1.5"/>
      <circle cx="280" cy="88" r="1.8" fill="#333"/><circle cx="290" cy="88" r="1.8" fill="#333"/><path d="M280 95q5 4 10 0" stroke="#333" stroke-width="1.5" fill="none"/>${lab(122, 26, '安山岩的石階、龍柱和石獅')}`; }
  if (kind === 'limestone') { bg = '#eef2f5';
    o = `<defs><clipPath id="${id}"><path d="M16 110L30 74 62 62 90 80 94 116 66 132 30 130Z"/></clipPath></defs><g clip-path="url(#${id})"><rect width="110" height="180" fill="#d6d0be"/>${speck(r, 150, 14, 60, 84, 74, ['#b9b29d', '#ece8da'], 1.5)}</g><path d="M16 110L30 74 62 62 90 80 94 116 66 132 30 130Z" fill="none" stroke="#8f8974" stroke-width="2"/>
      ${arrow(98, 96, 118, 96)}<rect x="126" y="62" width="58" height="70" rx="8" fill="#c9c6be" stroke="#8a877f" stroke-width="2"/><path d="M126 76h58M126 118h58" stroke="#8a877f" stroke-width="1.5"/><text x="155" y="102" font-size="15" font-weight="900" text-anchor="middle" fill="#3a3d44">水泥</text>
      ${arrow(190, 96, 214, 96)}<rect x="224" y="60" width="80" height="74" fill="#b9b6ae" stroke="#7a776f" stroke-width="2"/>${speck(r, 90, 226, 62, 76, 70, ['#8f8b85', '#d9d5cc', '#6f6b65'], 2.2)}
      <text x="108" y="50" font-size="10.5" font-weight="800" text-anchor="middle" fill="#55687a">磨碎、高溫燒製</text><text x="206" y="50" font-size="10.5" font-weight="800" text-anchor="middle" fill="#55687a">加砂、碎石和水</text>${lab(55, 160, '石灰岩')}${lab(155, 160, '水泥')}${lab(264, 160, '混凝土')}`; }
  if (kind === 'marble') { bg = '#e8e4f0';
    const vein = (x, y, w, h) => { let s = ''; for (let i = 0; i < 5; i++) { const yy = y + r() * h; s += `<path d="M${x} ${f1(yy)}C${f1(x + w * .3)} ${f1(yy + (r() - .5) * 30)} ${f1(x + w * .7)} ${f1(yy + (r() - .5) * 30)} ${x + w} ${f1(yy + (r() - .5) * 20)}" stroke="#9aa0ac" stroke-opacity="${f1(.3 + r() * .4)}" stroke-width="${f1(.8 + r() * 1.6)}" fill="none"/>`; } return s; };
    o = `<rect y="156" width="320" height="24" fill="#d9d5cf"/><path d="M0 156h320M60 156l-14 24M140 156l-6 24M220 156l6 24M290 156l14 24" stroke="#b9b5ae" stroke-width="1.5"/>
      <rect x="36" y="24" width="56" height="11" fill="#eeebe5" stroke="#b9b6c4"/><rect x="42" y="35" width="44" height="112" fill="#f6f4f0" stroke="#b9b6c4"/><path d="M52 35v112M64 35v112M76 35v112" stroke="#d5d2cc" stroke-width="2"/><rect x="34" y="147" width="60" height="10" fill="#eeebe5" stroke="#b9b6c4"/>${vein(42, 40, 44, 100)}
      <rect x="170" y="120" width="76" height="37" fill="#e6e3dd" stroke="#b9b6c4"/><path d="M172 120Q174 88 208 86Q242 88 244 120Z" fill="#fbfaf8" stroke="#b9b6c4" stroke-width="1.5"/><circle cx="208" cy="64" r="19" fill="#fbfaf8" stroke="#b9b6c4" stroke-width="1.5"/>${vein(170, 124, 76, 30)}${lab(186, 24, '大理岩的圓柱和雕像')}`; }
  if (kind === 'slate') {
    o = `<path d="M0 110Q80 50 170 84T320 70V180H0Z" fill="#9dbf8f"/><rect y="150" width="320" height="30" fill="#7a7f88"/><path d="M0 160h320M40 150l-10 30M110 150l-4 30M200 150l6 30M270 150l12 30M70 160l-6 20M150 160v20M240 160l8 20" stroke="#5a5f68" stroke-width="1.5"/>
      <rect x="60" y="92" width="200" height="58" fill="#5a6069"/>`;
    for (let y = 98; y < 150; y += 6) { o += `<path d="M60 ${y}h200" stroke="#3e434b" stroke-width="1.2"/>`; for (let x = 66 + r() * 16; x < 258; x += 14 + r() * 18) o += `<path d="M${f1(x)} ${y - 6}v6" stroke="#3e434b" stroke-width="1"/>`; }
    o += `<path d="M40 94L70 60H250L280 94Z" fill="#474c55" stroke="#2f3339" stroke-width="1.5"/><path d="M62 70h196M54 78h212M47 86h226" stroke="#2f3339" stroke-width="1.3"/>`;
    for (let k = 0; k < 9; k++) o += `<path d="M${78 + k * 21} 60l${f1(k * .9 - 4)} 10M${70 + k * 23} 70l${f1(k * 1.1 - 5)} 8M${62 + k * 25} 78l${f1(k * 1.2 - 5)} 8" stroke="#2f3339" stroke-width="1"/>`;
    o += `<rect x="145" y="110" width="30" height="40" fill="#2a2420"/>${lab(160, 26, '板岩疊成的石板屋')}`; }
  if (kind === 'gravel') {
    o = `<rect y="70" width="320" height="14" fill="#4a4d55"/><path d="M10 77h36M70 77h36M130 77h36M190 77h36" stroke="#eee6a6" stroke-width="2"/><rect y="84" width="320" height="46" fill="#8f8b85"/>`;
    for (let i = 0; i < 150; i++) { const x = r() * 320, y = 86 + r() * 40, s = 4 + r() * 6; o += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(s)}" height="${f1(s * .7)}" fill="${['#b9b5ad', '#6f6b65', '#a39f97', '#d0ccc4'][i % 4]}" transform="rotate(${f1(r() * 90)} ${f1(x)} ${f1(y)})"/>`; }
    o += `<rect y="130" width="320" height="50" fill="#8a6a48"/>${speck(r, 120, 0, 132, 320, 46, ['#74573a', '#a3835c'], 1.6)}<rect x="60" y="44" width="78" height="20" rx="7" fill="#2f6fb5"/><rect x="76" y="31" width="44" height="16" rx="6" fill="#2f6fb5"/><rect x="82" y="35" width="32" height="10" rx="3" fill="#bfe3f5"/><circle cx="80" cy="64" r="7.5" fill="#222"/><circle cx="120" cy="64" r="7.5" fill="#222"/>
      ${lab(262, 60, '柏油路面')}${lab(262, 112, '碎石路基')}${lab(262, 162, '土壤')}`; }
  if (kind === 'glass') { bg = '#eaf3f8';
    o = `<rect x="28" y="22" width="134" height="124" fill="#8a6a48"/>`;
    for (const [x, y] of [[36, 30], [99, 30], [36, 88], [99, 88]]) o += `<rect x="${x}" y="${y}" width="55" height="50" fill="#bfe3f5"/><path d="M${x + 8} ${y + 40}l26 -32M${x + 22} ${y + 44}l20 -24" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round"/>`;
    o += `<path d="M204 56H276L266 148H214Z" fill="rgba(160,215,240,.5)" stroke="#6aa9c9" stroke-width="2.5"/><path d="M209 98H271L266 148H214Z" fill="rgba(110,185,225,.6)"/><path d="M218 66l5 70" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-opacity=".85"/>${lab(95, 168, '玻璃窗')}${lab(240, 168, '玻璃杯')}`; }
  if (kind === 'ceramic') { bg = '#f3ece4';
    o = `<path d="M34 70Q34 138 100 138Q166 138 166 70Z" fill="#fdfdfb" stroke="#9db0c4" stroke-width="2.5"/><ellipse cx="100" cy="70" rx="66" ry="10" fill="#f1f3f4" stroke="#9db0c4" stroke-width="2.5"/><path d="M40 92q10 -10 20 0t20 0t20 0t20 0t20 0t20 0" stroke="#3b6fb5" stroke-width="3" fill="none"/><rect x="80" y="136" width="40" height="8" rx="3" fill="#e6e9ec" stroke="#9db0c4" stroke-width="2"/>
      <ellipse cx="238" cy="112" rx="68" ry="20" fill="#fdfdfb" stroke="#9db0c4" stroke-width="2.5"/><ellipse cx="238" cy="110" rx="44" ry="12" fill="#f1f3f4" stroke="#3b6fb5" stroke-width="2"/>${lab(100, 168, '陶瓷碗')}${lab(238, 168, '瓷盤')}`; }
  if (kind === 'mica') { bg = '#eef0f3';
    o = `<rect x="64" y="50" width="192" height="104" rx="14" fill="#d9dde2" stroke="#8a8f98" stroke-width="2.5"/><rect x="92" y="64" width="136" height="76" rx="6" fill="#33363d"/>`;
    for (const x of [106, 152, 198]) o += `<rect x="${x}" y="70" width="16" height="64" fill="#e9dcc0" stroke="#b89f6a" stroke-width="1.5"/><path d="M${x} 76l16 6l-16 6l16 6l-16 6l16 6l-16 6l16 6l-16 6l16 6" stroke="#e2452b" stroke-width="2" fill="none"/>`;
    o += `<rect x="256" y="96" width="14" height="22" rx="4" fill="#3a3d44"/><path d="M263 90L222 96" stroke="#1f3345" stroke-width="1.5"/><path d="M52 112L106 106" stroke="#1f3345" stroke-width="1.5"/>${lab(160, 28, '烤麵包機的內部')}${lab(288, 86, '雲母片')}${lab(30, 118, '電熱絲')}`; }
  if (kind === 'pencil') { bg = '#fdf6e3';
    o = `<path d="M0 40h320M0 80h320M0 120h320M0 160h320" stroke="#e8dcc0" stroke-width="1.5"/><path d="M30 150q12 -16 22 0t22 0t22 0t20 -2" stroke="#3a3a3e" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <g transform="rotate(155 160 80)"><rect x="60" y="68" width="170" height="24" fill="#f2b705"/><path d="M60 76h170M60 84h170" stroke="#d99a00" stroke-width="1.5"/><rect x="44" y="68" width="16" height="24" fill="#b9bcc2"/><rect x="24" y="68" width="22" height="24" rx="6" fill="#e8789a"/><path d="M230 68L268 80L230 92Z" fill="#e8c9a0"/><path d="M254 75.6L268 80L254 84.4Z" fill="#2b2b2e"/></g>${lab(224, 150, '筆芯是石墨')}`; }
  if (kind === 'talc') { bg = '#f1eef7';
    o = `<rect x="120" y="62" width="80" height="100" rx="14" fill="#fff" stroke="#b9a9d6" stroke-width="2.5"/><rect x="134" y="40" width="52" height="24" rx="7" fill="#b9a9d6"/><circle cx="150" cy="50" r="2.2" fill="#fff"/><circle cx="160" cy="50" r="2.2" fill="#fff"/><circle cx="170" cy="50" r="2.2" fill="#fff"/>
      <rect x="130" y="92" width="60" height="36" rx="7" fill="#efe7fb"/><text x="160" y="115" font-size="14" font-weight="900" text-anchor="middle" fill="#6b4fa8">爽身粉</text>`;
    for (const [x, y, s] of [[86, 44, 16], [66, 58, 12], [98, 66, 11], [236, 50, 14], [256, 68, 11], [224, 72, 9]]) o += `<circle cx="${x}" cy="${y}" r="${s}" fill="#fff" fill-opacity=".85" stroke="#d6cdea"/>`;
    o += speck(r, 40, 50, 30, 230, 60, ['#fff', '#d6cdea'], 1.2) + lab(160, 22, '滑石磨成的細粉'); }
  if (kind === 'sulfur') { bg = '#fbf5e6';
    o = `<rect x="44" y="84" width="96" height="14" fill="#e8dcc0" stroke="#b9a986"/><rect x="30" y="96" width="112" height="50" rx="6" fill="#2f6fb5"/><rect x="30" y="130" width="112" height="16" fill="#5a3a2a"/>`;
    for (const [x0, x1, y1] of [[62, 48, 34], [84, 86, 26], [108, 124, 36]]) o += `<path d="M${x0} 88L${x1} ${y1}" stroke="#e8c9a0" stroke-width="5" stroke-linecap="round"/><ellipse cx="${x1}" cy="${y1}" rx="6" ry="7.5" fill="#d33a3a"/>`;
    o += `<rect x="190" y="44" width="104" height="104" rx="10" fill="#8cc152" stroke="#5a8f2e" stroke-width="2.5"/><path d="M190 62h104M190 130h104" stroke="#5a8f2e" stroke-width="1.5"/><text x="242" y="106" font-size="22" font-weight="900" text-anchor="middle" fill="#fff">肥料</text>${speck(r, 26, 196, 150, 92, 8, ['#e8d36a', '#d9c04a'], 2.2)}${lab(86, 168, '火柴')}${lab(242, 172, '肥料')}`; }
  if (kind === 'chalk') { bg = '#f3ece4';
    o = `<rect x="14" y="16" width="292" height="122" rx="6" fill="#2f5d46" stroke="#8a6a48" stroke-width="6"/><text x="120" y="76" font-size="30" font-weight="900" text-anchor="middle" fill="#f4f4ee" fill-opacity=".92">大地變化</text><path d="M210 112l24 -40l16 22l12 -14l22 32Z" fill="none" stroke="#f6e58d" stroke-width="3" stroke-linejoin="round"/><path d="M40 100h130" stroke="#f4b6c2" stroke-width="3" stroke-dasharray="14 8"/>
      <rect x="11" y="138" width="298" height="9" fill="#8a6a48"/><rect x="150" y="129" width="30" height="9" rx="2" fill="#fff"/><rect x="188" y="129" width="34" height="9" rx="2" fill="#f6e58d"/><rect x="230" y="129" width="28" height="9" rx="2" fill="#f4b6c2"/>${lab(204, 168, '石膏做的粉筆')}`; }
  if (kind === 'saw') { bg = '#e9edf1';
    let teeth = ''; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; teeth += `<rect x="-4" y="-57" width="8" height="9" fill="#f2c94c" stroke="#b9902a" stroke-width=".8" transform="translate(150 86) rotate(${f1(a * 57.3)})"/>`; }
    o = `<rect x="16" y="100" width="288" height="62" fill="#c9c2b6" stroke="#8f887c" stroke-width="2"/>${speck(r, 200, 18, 102, 284, 58, ['#a8a195', '#e6e0d5', '#7d766a'], 1.6)}<rect x="147" y="100" width="6" height="40" fill="#4a453d"/>
      <circle cx="150" cy="86" r="50" fill="#b9bec6" stroke="#6b7078" stroke-width="2.5"/>${teeth}<circle cx="150" cy="86" r="12" fill="#6b7078"/><path d="M118 62a40 40 0 0 1 30 -16" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-opacity=".7"/>${speck(r, 30, 120, 86, 60, 14, ['#f4f1ea'], 2)}${lab(244, 30, '鑲著金剛石的鋸片')}${lab(60, 150, '堅硬的岩石')}`; }
  if (kind === 'openpit') o = pitSVG(0);
  if (kind === 'replant') o = pitSVG(1);
  if (kind === 'park') o = pitSVG(2);
  if (kind === 'tunnel') {
    o = `<path d="M0 60H126Q176 86 226 60H320V180H0Z" fill="#b39a78"/><path d="M0 84H320M0 104H320" stroke="#96805f" stroke-width="2"/><rect y="150" width="320" height="30" fill="#8a7458"/><rect x="40" y="112" width="250" height="38" fill="#1c1a1c"/>`;
    for (let x = 52; x < 290; x += 34) if (x < 140 || x > 215) o += `<path d="M${x} 150V116M${x - 10} 116h20" stroke="#c99a5b" stroke-width="4.5"/>`;
    o += `<path d="M146 150L158 126 176 120 196 128 206 150Z" fill="#8a7458" stroke="#5a4a36" stroke-width="1.5"/><path d="M160 112l-6 -14l8 -10M190 112l8 -16l-6 -10M176 112l2 -26" stroke="#3a2a1e" stroke-width="2.2" fill="none"/>
      <g transform="rotate(-9 176 70)">${house(160, 50, 34, 22, '#f3ede0', '#b4513a')}</g>${tree(60, 60, 1)}${tree(280, 60, 1.1)}${lab(246, 36, '地面下陷')}${lab(84, 172, '坑道坍塌')}`; }
  if (kind === 'landslide') { bg = '#cfd8e0';
    o = `<ellipse cx="110" cy="14" rx="90" ry="20" fill="#8a929c"/><ellipse cx="200" cy="10" rx="70" ry="16" fill="#9aa2ac"/>`;
    for (let i = 0; i < 40; i++) { const x = 20 + r() * 280, y = 30 + r() * 100; o += `<path d="M${f1(x)} ${f1(y)}l-4 12" stroke="#7fa6c9" stroke-width="1.6"/>`; }
    o += `<path d="M0 34L60 34L300 150H320V180H0Z" fill="#6fa35a"/><path d="M56 36L120 60L268 134L300 150H200L84 76L40 40Z" fill="#a8794f"/>`;
    for (let i = 0; i < 16; i++) { const t = r(), x = 70 + t * 200, y = 48 + t * 96 + (r() - .3) * 14; o += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(3 + r() * 5)}" fill="${i % 2 ? '#6b5a48' : '#8a7458'}"/>`; }
    o += `<ellipse cx="256" cy="156" rx="62" ry="16" fill="#8a6846"/>${house(266, 134, 34, 22, '#f3ede0', '#b4513a')}<path d="M258 156q26 -14 50 0Z" fill="#8a6846"/>${tree(20, 60, 1)}${tree(36, 96, 1.1)}${tree(70, 130, 1)}${tree(110, 160, 1.1)}${lab(232, 66, '裸露的山坡')}${lab(116, 172, '土石衝向山下', '#9f1239')}`; }
  if (kind === 'muddy') {
    o = `<rect y="84" width="320" height="96" fill="#8dbb6a"/><path d="M0 84V40L46 30L70 52V84Z" fill="#e6e1d5" stroke="#a8a294" stroke-width="1.5"/><path d="M0 62h58M0 74h66" stroke="#a8a294" stroke-width="1.5"/>
      <path d="M320 92C262 94 232 106 204 126" stroke="#6db8e0" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M40 104C100 96 140 146 320 138V172C150 178 100 128 40 122Z" fill="#a87848"/><path d="M70 110q20 4 36 16M150 142q40 12 90 12" stroke="#c99a6b" stroke-width="2.5" fill="none"/>
      <rect x="112" y="64" width="34" height="14" fill="#d8d2c2"/><rect x="146" y="60" width="16" height="18" fill="#2f6fb5"/><circle cx="122" cy="80" r="5" fill="#222"/><circle cx="152" cy="80" r="5" fill="#222"/>`;
    for (const [x, y, s] of [[98, 66, 12], [80, 58, 15], [60, 62, 12], [88, 46, 10]]) o += `<circle cx="${x}" cy="${y}" r="${s}" fill="#d9cfb8" fill-opacity=".8"/>`;
    o += `${lab(262, 76, '清澈的溪水')}${lab(206, 164, '混濁的溪水', '#7a4a1e')}${lab(70, 26, '粉塵')}`; }
  if (kind === 'museum') {
    o = `<path d="M0 150V70Q50 20 130 60L150 150Z" fill="#6fa35a"/><rect y="150" width="320" height="30" fill="#b9a98a"/><path d="M40 150V104a30 30 0 0 1 60 0V150Z" fill="#1c1a1c" stroke="#9a958a" stroke-width="9"/><path d="M52 150L150 150M60 144l94 0" stroke="#6b5a4a" stroke-width="2.5"/>
      <rect x="126" y="118" width="46" height="24" fill="#3d4a56"/><path d="M130 118q10 -14 20 -4q8 -8 18 4Z" fill="#26262a"/><circle cx="136" cy="145" r="6" fill="#222"/><circle cx="162" cy="145" r="6" fill="#222"/>
      <rect x="198" y="84" width="106" height="66" fill="#b55a3e"/><path d="M190 86L251 56L312 86Z" fill="#5b6470"/><rect x="214" y="92" width="74" height="22" rx="3" fill="#fff3c4"/><text x="251" y="108" font-size="13.5" font-weight="900" text-anchor="middle" fill="#7a4a1e">礦業博物館</text><rect x="240" y="122" width="22" height="28" fill="#4a3426"/><rect x="210" y="124" width="20" height="16" fill="#bfe3f5"/><rect x="272" y="124" width="20" height="16" fill="#bfe3f5"/>${tree(20, 110, 1.1)}${tree(120, 82, .9)}${lab(70, 60, '舊坑道口')}${lab(150, 106, '礦車')}`; }
  if (kind === 'recycle') { bg = '#eef7ee';
    const bottle = (x, c) => `<path d="M${x - 6} 52h12v16q10 6 10 18v40q0 6 -6 6h-20q-6 0 -6 -6v-40q0 -12 10 -18Z" fill="${c}" fill-opacity=".8" stroke="#3a5a48" stroke-width="1.5"/>`;
    o = bottle(40, '#5aa86a') + bottle(78, '#a8794f') + arrow(104, 96, 124, 96, '#2f9e5a') + arrow(196, 96, 216, 96, '#2f9e5a');
    for (let k = 0; k < 3; k++) { const a0 = (k * 120 - 80) / 57.3, a1 = (k * 120 + 10) / 57.3, R = 24; o += `<path d="M${f1(160 + R * Math.cos(a0))} ${f1(96 + R * Math.sin(a0))}A${R} ${R} 0 0 1 ${f1(160 + R * Math.cos(a1))} ${f1(96 + R * Math.sin(a1))}" stroke="#2f9e5a" stroke-width="7" fill="none"/><path d="M5 0L-7 -8L-7 8Z" fill="#2f9e5a" transform="translate(${f1(160 + R * Math.cos(a1))} ${f1(96 + R * Math.sin(a1))}) rotate(${f1(a1 * 57.3 + 90)})"/>`; }
    o += `<path d="M236 64H296L288 138H244Z" fill="rgba(160,215,240,.55)" stroke="#6aa9c9" stroke-width="2.5"/><path d="M246 72l4 56" stroke="#fff" stroke-width="5" stroke-linecap="round"/>${lab(58, 162, '舊玻璃瓶')}${lab(160, 162, '回收、熔化')}${lab(266, 162, '新的玻璃杯')}`; }
  return `<svg class="ufull" viewBox="0 0 320 180" role="img" aria-label="${kind}" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill="${bg}"/>${o}</svg>`;
}
// 認識頁的流程圖：石灰岩 → 水泥 → 混凝土 → 房屋橋梁
function flowSVG() {
  const B = [[4, 54, '石灰岩', '#d6d0be'], [76, 46, '水泥', '#c9c6be'], [140, 72, '加砂、碎石', '#f1e3bd', '和水拌勻'], [230, 50, '混凝土', '#b9b6ae'], [298, 58, '房屋橋梁', '#f3cf7a']]; let o = '';
  B.forEach((b, i) => { o += `<rect x="${b[0]}" y="14" width="${b[1]}" height="40" rx="9" fill="${b[3]}" stroke="#7a776f" stroke-width="1.5"/>` + (b[4] ? `<text x="${b[0] + b[1] / 2}" y="31" font-size="11.5" font-weight="900" text-anchor="middle" fill="#1f3345">${b[2]}</text><text x="${b[0] + b[1] / 2}" y="46" font-size="11.5" font-weight="900" text-anchor="middle" fill="#1f3345">${b[4]}</text>` : `<text x="${b[0] + b[1] / 2}" y="39" font-size="12.5" font-weight="900" text-anchor="middle" fill="#1f3345">${b[2]}</text>`); if (i) o += arrow(b[0] - 15, 34, b[0] - 6, 34); });
  return `<div class="ufig"><svg viewBox="0 0 360 68" role="img" aria-label="石灰岩做成水泥，再和砂、碎石、水拌成混凝土，用來蓋房屋和橋梁">${o}</svg></div>`;
}

/* 本區用的小樣式（滿版的圖鑑插圖、特徵與用途表、代價清單、延伸、配對活動） */
(function useCSS() {
  if (document.getElementById('useCss')) return; const st = document.createElement('style'); st.id = 'useCss';
  st.textContent = `.rcard .pic svg.ufull{width:100%;height:100%;filter:none;display:block} .rcard.uhit{outline:3px solid #f59e0b;outline-offset:1px}
    .lb.node.cur{opacity:0;pointer-events:none}
    .ufig{margin:6px 0 10px} .ufig svg{width:100%;height:auto;display:block;border-radius:12px;border:1px solid var(--line);background:#fff}
    table.utab{width:100%;border-collapse:separate;border-spacing:0;margin:8px 0 10px;font-size:14.5px;line-height:1.5;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
    table.utab th,table.utab td{padding:6px 8px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:left;vertical-align:middle} table.utab tr:last-child>*{border-bottom:0} table.utab tr>*:last-child{border-right:0}
    table.utab th{background:#fff7e6;color:#92400e;font-weight:900;white-space:nowrap} table.utab td:nth-child(2){font-weight:900;white-space:nowrap}
    ul.ulist{list-style:none;padding:0;margin:8px 0;display:grid;gap:6px} ul.ulist li{background:#fff;border:1px solid var(--line);border-left:4px solid var(--c,#be123c);border-radius:10px;padding:7px 10px;font-size:15px;line-height:1.6} ul.ulist b{display:block}
    details.rext{border:2px dashed #94a3b8;border-radius:12px;padding:8px 12px;margin:12px 0;background:#f8fafc} details.rext summary{font-weight:900;color:#475569;cursor:pointer} details.rext[open] summary{margin-bottom:6px}
    .umatch{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:12px 0} .umatch h3{margin:0 0 8px;font-size:17px;font-weight:900;color:var(--accent)} .umatch .col{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start}
    .umatch button{border:2px solid var(--line);background:#fff;border-radius:12px;padding:9px 8px;font-weight:900;font-size:16px;line-height:1.35;min-height:54px}
    .umatch button.sel{border-color:var(--accent);background:#fff7e6} .umatch button.ok{border-color:var(--go);background:#e8f7ec;color:#14532d;cursor:default} .umatch button.no{border-color:var(--bad);background:#fdecec}
    .umsg{min-height:3.4em;border-radius:12px;padding:9px 12px;background:#eef6ff;font-size:16px} .umsg b.ok{color:var(--go)} .umsg b.no{color:var(--bad)}
    @media (max-width:760px){.umatch{grid-template-columns:1fr}}`;
  document.head.appendChild(st);
})();

/* ---------- 配對活動（放在「配對」分頁，開橫式彈窗）：pairs = [物品, 岩石或礦物, 答對後的說明] ---------- */
function matchGame(title, intro, lt, rt, pairs) {
  return { label: '配對', html: `<h2>${title}</h2><p>${intro}</p><div class="umatch"><div><h3>${lt}</h3><div class="col" data-s="L"></div></div><div><h3>${rt}</h3><div class="col" data-s="R"></div></div></div><div class="umsg" id="uMsg">先點左邊的一樣東西，再點右邊的答案。</div>`,
    onOpen(el) {
      const mk = s => { const box = el.querySelector(`[data-s="${s}"]`), ord = pairs.map((_, k) => k); for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
        return ord.map(k => { const b = document.createElement('button'); b.dataset.k = k; b.textContent = pairs[k][s === 'L' ? 0 : 1]; box.appendChild(b); return b; }); };
      const Ls = mk('L'), Rs = mk('R'), msg = s => { el.querySelector('#uMsg').innerHTML = s; }; let sel = null, left = pairs.length, miss = 0;
      Ls.forEach(b => b.onclick = () => { if (b.classList.contains('ok')) return; Ls.forEach(o => o.classList.remove('sel')); b.classList.add('sel'); sel = b; msg(`「${b.textContent}」是用什麼做的？點右邊的答案。`); });
      Rs.forEach(b => b.onclick = () => {
        if (b.classList.contains('ok')) return; if (!sel) return msg('先點左邊的一樣東西，再點右邊的答案。');
        if (b.dataset.k !== sel.dataset.k) { miss++; b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 700); return msg(`<b class="no">再想想：</b>「${sel.textContent}」需要什麼特徵？哪一個最符合？`); }
        const k = +b.dataset.k; sel.classList.remove('sel'); sel.classList.add('ok'); b.classList.add('ok'); sel = null; left--;
        msg(`<b class="ok">答對了！</b>${pairs[k][2]}` + (left ? '' : `<br><b class="ok">全部配對成功！</b>${miss ? '中間猜錯了 ' + miss + ' 次，可以關掉再挑戰一次。' : '一次都沒有錯，太厲害了！'}`));
      });
    } };
}
const card = (name, en, key, facts) => ({ name, en, photo: 'img/use/' + key + '.jpg', svg: uSVG(key), facts });
// 礦物 → 產品：左邊是礦物照片（第 3 區同一張），右邊是產品（有 img/use/ 照片就用照片，否則用繪圖）。礦物還沒有照片時左格自動拿掉
const MIN = { glass: ['quartz', '石英'], ceramic: ['feldspar', '長石'], mica: ['muscovite', '白雲母'], pencil: ['graphite', '石墨'], talc: ['talc', '滑石'], sulfur: ['sulfur', '硫磺'], chalk: ['gypsum', '石膏'], saw: ['diamond', '金剛石'] };
const mcard = (name, en, key, facts) => { const c = card(name, en, key, facts), [m, mn] = MIN[key];
  return { ...c, pics: [{ photo: 'img/minerals/' + m + '.jpg', cap: mn }, { svg: c.svg, photo: c.photo, cap: name.split('→')[1].trim() }] }; };

/* ---------- 區域定義 ---------- */
G.registerZone('use', {
  hint: '山腳下的小鎮和礦場。點發光的圓點，或直接點場景裡的建築和物品！',
  build,
  nodes: [
    { id: 'rock', num: '1', title: '生活中的岩石', en: 'Rocks in Daily Life', color: '#b45309', ready: true, at: [.5, 2.0, -3.4],
      cam: { pos: [6.6, 12, 16.5], target: [6.6, .3, .2] },
      learn: `
        <h3>岩石就在我們身邊</h3>
        <p>蓋房子、鋪路、造橋、雕刻，都用得到岩石。不同的岩石有不同的<em>特徵</em>，適合的<em>用途</em>也不一樣。</p>
        <h3>看特徵，選用途</h3>
        <table class="utab"><tr><th>特徵</th><th>岩石</th><th>用途</th></tr>
          <tr><td>堅硬、耐磨</td><td>花岡岩<br>安山岩</td><td>石階、地磚、橋、石雕</td></tr>
          <tr><td>花紋漂亮、容易雕刻</td><td>大理岩</td><td>牆面、桌面、雕像</td></tr>
          <tr><td>能劈成平整的薄板</td><td>板岩</td><td>石板屋的屋頂和牆</td></tr>
          <tr><td>磨碎燒製後，加水會變硬</td><td>石灰岩</td><td>水泥的原料</td></tr>
          <tr><td>大小不同的碎塊</td><td>碎石、砂</td><td>混凝土、路基</td></tr></table>
        <h3>從礦場到工地</h3>
        ${flowSVG()}
        <p>水泥加水後會慢慢變硬，把砂和碎石牢牢黏在一起，就成為堅固的<em>混凝土</em>。</p>
        <p>現代的房屋、橋梁和道路，幾乎都少不了混凝土。</p>
        <div class="tip"><b>看看場景：</b>點一下廟、石橋、美術館、石板屋、水泥廠和工地，看看它們用了哪一種岩石。</div>
        <p>都記住了嗎？到上面的「配對」分頁考考自己。</p>
        <details class="rext"><summary>延伸：臺灣的水泥原料從哪裡來？</summary>
          <p>臺灣東部宜蘭、花蓮的山區有大量的大理岩。它和石灰岩一樣，主要成分是碳酸鈣（CaCO₃）。</p>
          <p>所以臺灣的水泥，大多是用東部開採的大理岩做的。</p></details>`,
      overview: matchGame('配對：哪一種岩石最適合？', '每一樣東西需要的特徵不同。幫它們找到最適合的岩石！', '要做的東西', '岩石', [
        ['廟前每天被踩的石階', '安山岩', '安山岩堅硬、耐磨，每天被踩也不容易壞。'], ['風吹雨打的石橋', '花岡岩', '花岡岩很堅硬，不怕風吹雨打。'],
        ['美術館的雕像', '大理岩', '大理岩花紋漂亮，硬度不高，容易雕刻。'], ['石板屋的屋頂', '板岩', '板岩能劈成平整的薄板，一片片疊起來就能遮風擋雨。'],
        ['蓋房子用的水泥', '石灰岩', '石灰岩磨碎後高溫燒製，就成為水泥。'], ['馬路下面的路基', '碎石', '碎石堆在一起很穩固，雨水也容易從縫隙排掉。']]),
      cardsIntro: '<p>先看火成岩、沉積岩、變質岩各有什麼用途，最後是碎石和砂。想一想：為什麼選這種岩石？</p>',
      cards: [
        card('花岡岩', 'Granite（火成岩）', 'granite', [['特徵', '堅硬、耐磨，不容易被風雨破壞，磨光後很美觀。'], ['用途', '建築的外牆、地磚、石階、橋和石碑。'], ['臺灣哪裡看', '金門、馬祖的傳統石屋，用花岡岩砌牆。']]),
        card('安山岩', 'Andesite（火成岩）', 'andesite', [['特徵', '堅硬、耐磨，質地細緻。'], ['用途', '石階、石板路，廟宇的龍柱和石獅。'], ['臺灣哪裡看', '陽明山一帶的石階步道。']]),
        card('石灰岩', 'Limestone（沉積岩）', 'limestone', [['特徵', '主要成分是碳酸鈣（CaCO₃）。'], ['用途', '磨碎後高溫燒製，就是水泥；水泥是蓋房子最重要的材料之一。'], ['小知識', '水泥、砂、碎石加水拌勻，凝固後就是混凝土。']]),
        card('大理岩', 'Marble（變質岩）', 'marble', [['特徵', '磨光後有漂亮的花紋；硬度不高，容易切割和雕刻。'], ['用途', '牆面、地板、桌面和雕像。'], ['臺灣哪裡看', '花蓮盛產大理岩，有許多石雕作品。']]),
        card('板岩', 'Slate（變質岩）', 'slate', [['特徵', '容易沿著平行的紋路，劈成平整的薄板。'], ['用途', '石板屋的屋頂、牆和地板，也用來鋪庭園步道。'], ['臺灣哪裡看', '屏東縣霧臺的石板屋。']]),
        card('碎石與砂', 'Gravel &amp; Sand', 'gravel', [['來源', '把大塊的岩石打碎就是碎石；砂多半來自河床。'], ['用途', '和水泥拌成混凝土；鋪在馬路和鐵軌下面當路基。'], ['為什麼適合', '碎石堆在一起很穩固，雨水也容易從縫隙排掉。']]),
      ] },
    { id: 'mineral', num: '2', title: '生活中的礦物', en: 'Minerals in Daily Life', color: '#7c3aed', ready: true, at: [2.95, 1.75, 4.1],
      cam: { pos: [8.6, 10, 18.5], target: [8.6, .3, 3.2] },
      learn: `
        <h3>礦物變成生活用品</h3>
        <p>岩石是由礦物組成的。把有用的礦物從岩石裡取出來，經過加工，就變成各種生活用品。</p>
        <h3>特徵決定用途</h3>
        <div class="two"><div><b>✏️ 石墨</b>很軟、黑色，劃過紙會留下痕跡，所以做成<em>鉛筆芯</em>。</div><div><b>🪟 石英</b>熔化再冷卻後，變得透明又堅硬，所以做成<em>玻璃</em>。</div>
          <div><b>🧴 滑石</b>最軟的礦物，磨成的細粉滑滑的，所以做成<em>爽身粉</em>。</div><div><b>🖍️ 石膏</b>又軟又白，磨成粉加水會凝固，所以做成<em>粉筆</em>。</div></div>
        <p>硬的礦物也很有用：金剛石是最硬的礦物，鑲在鋸片和鑽頭上，可以切開堅硬的岩石。</p>
        <h3>找找看</h3>
        <p>學校、文具店、住家、農田和工地裡，藏著哪些礦物做的東西？點場景找找看，再到「配對」分頁考考自己。</p>
        <div class="tip"><b>想知道這些礦物長什麼樣子？</b>回到大地圖，前往第 3 區「礦物與硬度」，看看它們的顏色、光澤和硬度。</div>
        <details class="rext"><summary>延伸：金屬也來自礦物</summary>
          <p>鐵、銅、鋁等金屬，是從含有金屬的礦物裡提煉出來的。</p>
          <p>鍋子、電線、鋁罐，還有手機裡的許多零件，都要用到從礦物提煉的金屬。</p></details>`,
      overview: matchGame('配對：這是用哪一種礦物做的？', '每一種礦物有自己的特徵。想想這些東西需要什麼特徵，幫它們找到原料！', '生活用品', '礦物', [
        ['鉛筆芯', '石墨', '石墨很軟、黑色，劃過紙就留下痕跡。'], ['粉筆', '石膏', '石膏又軟又白，磨成粉加水後會凝固成形。'], ['玻璃窗', '石英', '石英熔化再冷卻後，變成透明又堅硬的玻璃。'], ['陶瓷碗盤', '長石', '長石是製作陶瓷的原料，高溫燒過後堅硬又光滑。'],
        ['爽身粉', '滑石', '滑石是最軟的礦物，磨成的細粉摸起來滑滑的。'], ['火柴和肥料', '硫磺', '硫磺容易燃燒，可以做火柴；也是製造肥料的原料。'], ['電器裡的絕緣片', '白雲母', '白雲母能剝成薄片，不容易導電又耐高溫。'], ['切割岩石的鋸片', '金剛石', '金剛石是最硬的礦物，可以切開其他岩石和礦物。']]),
      cardsIntro: '<p>八種礦物和它們做成的東西。順序和第 3 區「礦物與硬度」的圖鑑一樣，可以對照著看。</p>',
      cards: [
        mcard('石英 → 玻璃', 'Quartz', 'glass', [['做成什麼', '玻璃窗、玻璃杯、鏡片。'], ['為什麼適合', '石英熔化再冷卻後，會變成透明又堅硬的玻璃。'], ['場景哪裡找', '學校教室的整排窗戶、農田旁的溫室。']]),
        mcard('長石 → 陶瓷', 'Feldspar', 'ceramic', [['做成什麼', '碗盤、杯子、磁磚、馬桶。'], ['為什麼適合', '長石和黏土一起高溫燒過後，變得堅硬、光滑、不透水。'], ['場景哪裡找', '住家裡的碗盤和磁磚。']]),
        mcard('白雲母 → 絕緣片', 'Muscovite', 'mica', [['做成什麼', '吹風機、烤麵包機等電器裡的絕緣片。'], ['為什麼適合', '能剝成很薄的薄片，不容易導電，又耐高溫。'], ['場景哪裡找', '住家裡的電器。']]),
        mcard('石墨 → 鉛筆芯', 'Graphite', 'pencil', [['做成什麼', '鉛筆芯。'], ['為什麼適合', '石墨很軟、黑色，劃過紙就留下痕跡。'], ['小知識', '筆芯是石墨粉加黏土做的。黏土加得越多，筆芯越硬、顏色越淡。']]),
        mcard('滑石 → 爽身粉', 'Talc', 'talc', [['做成什麼', '爽身粉。'], ['為什麼適合', '滑石是最軟的礦物，磨成的細粉摸起來滑滑的。'], ['場景哪裡找', '住家的浴室裡。']]),
        mcard('硫磺 → 火柴、肥料', 'Sulfur', 'sulfur', [['做成什麼', '火柴、肥料。'], ['為什麼適合', '硫磺容易燃燒，可以做火柴；也是製造肥料的原料。'], ['場景哪裡找', '河東邊的農田。']]),
        mcard('石膏 → 粉筆', 'Gypsum', 'chalk', [['做成什麼', '粉筆、石膏板、石膏模型。'], ['為什麼適合', '又軟又白；磨成粉加水後會凝固，可以做成各種形狀。'], ['場景哪裡找', '學校教室的黑板。']]),
        mcard('金剛石 → 鋸片、鑽頭', 'Diamond', 'saw', [['做成什麼', '切割岩石和混凝土的鋸片、鑽頭；琢磨後就是鑽石。'], ['為什麼適合', '金剛石是最硬的礦物，能切開其他岩石和礦物。'], ['場景哪裡找', '工地和礦場的切割工具。']]),
      ] },
    { id: 'cost', num: '3', title: '開採的代價', en: 'The Cost of Mining', color: '#be123c', ready: true, at: [-6.2, 2.9, 1.0],
      cam: { pos: [-.4, 7.5, 11], target: [-3.6, 1.5, .4] },
      learn: `
        <h3>岩石和礦物從哪裡來？</h3>
        <p>我們用的岩石和礦物，都要從大地<em>開採</em>出來。開採的方法主要有兩種：</p>
        <div class="two"><div><b>⛏️ 露天開採</b>把地表的樹木和土壤移走，一階一階往下挖。</div><div><b>🕳️ 坑道開採</b>挖出通往地底的坑道，把礦物運出來。</div></div>
        <h3>開採要付出什麼代價？</h3>
        <ul class="ulist"><li><b>🌳 森林消失</b>樹木和土壤被移走，動物失去了家。</li>
          <li><b>⛰️ 山崩和土石流</b>山坡沒有植物抓住土石，下大雨時容易崩落。</li>
          <li><b>🕳️ 坑道坍塌、地面下陷</b>地底被挖空，上面的地層可能塌下來。</li>
          <li><b>💧 溪水和空氣變髒</b>泥沙流進溪裡，溪水變混濁；開採和搬運會揚起粉塵。</li></ul>
        <p><em>自然景觀和環境一旦被改變或破壞，就很難恢復。</em>一座山要經過非常久的時間才形成，挖掉了就回不來。</p>
        <p>岩石和礦物的形成也需要很長的時間，用掉就沒有了。</p>
        <div class="tip"><b>看看場景：</b>左邊的山被挖成一階一階的礦場。下大雨時，裸露的山坡發生了什麼事？流出來的溪水是什麼顏色？</div>
        <details class="rext"><summary>延伸：生活需要岩石和礦物，怎麼辦？</summary>
          <p>我們不可能完全不開採。所以開採前要先評估對環境的影響，開採時做好水土保持。</p>
          <p>開採結束後還要把環境復原。到下一個節點「復原與永續」看看可以怎麼做。</p></details>`,
      cardsIntro: '<p>開採的兩種方法，和它們可能帶來的災害與汙染。</p>',
      cards: [
        card('露天礦場', 'Open-pit mine', 'openpit', [['樣子', '把山挖成一階一階的大階梯，機具在階梯上開採和搬運。'], ['代價', '整片森林和土壤被移走，山的樣子永遠改變了。'], ['場景哪裡找', '左邊灰白色的階梯狀山坡。']]),
        card('坑道', 'Mine tunnel', 'tunnel', [['樣子', '在地底挖出一條條通道，用支架撐住。'], ['代價', '坑道可能坍塌；地底被挖空後，地面可能下陷，房屋跟著傾斜。'], ['場景哪裡找', '山腳的舊坑道口（現在在博物館旁邊）。']]),
        card('山崩與土石流', 'Landslide', 'landslide', [['原因', '山坡的植物被移除，土石失去保護；下大雨時，雨水帶著土石一起往下衝。'], ['代價', '掩埋道路和房屋，危害山下的居民。'], ['場景哪裡找', '礦場上方那一道褐色的崩塌溝。']]),
        card('混濁的溪水與粉塵', 'Muddy water &amp; dust', 'muddy', [['原因', '裸露的泥沙被雨水沖進溪裡；開採和砂石車會揚起粉塵。'], ['代價', '溪水變混濁，水裡的生物不容易生存；空氣也變髒。'], ['場景哪裡找', '從礦場流出來的褐色小溪，和右邊清澈的河比比看。']]),
      ] },
    { id: 'renew', num: '4', title: '復原與永續', en: 'Restoration & Sustainability', color: '#15803d', ready: true, at: [-4.5, 3.3, -3.5],
      cam: { pos: [4.1, 6.6, 4.1], target: [-.9, 1.6, -3.3] },
      learn: `
        <h3>把大地照顧回來</h3>
        <p>開採結束後，不能把光禿禿的礦場丟著不管。人們用幾種方法，讓它慢慢恢復生機：</p>
        <div class="two"><div><b>🌱 植生復育</b>在階梯狀的坡面鋪上土壤，種回當地的植物，抓住土石。</div><div><b>🏛️ 礦場轉型</b>把舊礦場整理成博物館、公園或池塘，讓大家認識開採的歷史。</div></div>
        <p>不過，種回去的樹林和原本的森林不一樣，被挖掉的山也不會長回來。復原只能<em>減少傷害</em>。</p>
        <h3>永續：讓資源用得久</h3>
        <ul class="ulist" style="--c:#15803d"><li><b>♻️ 回收再利用</b>玻璃瓶、金屬罐回收後可以做成新的產品；拆房子的混凝土塊打碎後可以再鋪路。</li>
          <li><b>🔧 珍惜使用</b>東西壞了先修理，不買用不到的東西。</li>
          <li><b>📏 適量開採</b>只開採需要的量，並且選擇對環境影響比較小的地點和方法。</li></ul>
        <p><em>永續</em>的意思是：滿足我們現在的需要，也讓以後的人有資源可以用、有美麗的大地可以看。</p>
        <div class="tip"><b>看看場景：</b>舊礦場的階梯正在種回樹木，坑底積水成了池塘，舊坑道口旁蓋了博物館。小鎮裡還有資源回收站。</div>
        <details class="rext"><summary>延伸：臺灣的礦場轉型</summary>
          <p>新北市的金瓜石過去開採金礦和銅礦，現在有黃金博物館。</p>
          <p>新北市的平溪和猴硐過去開採煤礦，現在都有煤礦博物園區，可以看到以前的坑道和礦車。</p></details>`,
      cardsIntro: '<p>讓礦場恢復生機的方法，和我們每個人都做得到的事。</p>',
      cards: [
        card('植生復育', 'Revegetation', 'replant', [['做法', '在開採完的階梯上鋪回土壤，種下當地的草和樹苗。'], ['作用', '植物的根抓住土石，減少山崩和土石流；動物也慢慢回來。'], ['要注意', '樹要很多年才會長大，而且和原本的森林不一樣。']]),
        card('礦坑變博物館', 'Mine museum', 'museum', [['做法', '把停止開採的坑道和設備保存下來，整理成博物館或園區。'], ['作用', '讓大家認識礦物、開採的歷史，和開採付出的代價。'], ['臺灣哪裡看', '新北市金瓜石的黃金博物館。']]),
        card('礦場變公園', 'Quarry park', 'park', [['做法', '把舊礦場整理成公園；坑底積水的地方成為池塘。'], ['作用', '成為水鳥和其他生物的新家，也是居民休閒的地方。'], ['要注意', '被挖掉的山不會長回來，地形已經永遠改變。']]),
        card('回收再利用', 'Recycling', 'recycle', [['做法', '把玻璃瓶、金屬罐分類回收，熔化後做成新的產品。'], ['作用', '少開採一些新的岩石和礦物，資源可以用得更久。'], ['我可以做', '做好資源回收；東西壞了先修理，不浪費。']]),
      ] },
  ],
  // 檢核題：level 為 PIRLS 層次（1 提取訊息／2 推論訊息／3 詮釋整合／4 比較評估）
  quiz: [
    { id: 'use.mineral.1', about: '生活中的礦物', level: 1, q: '根據「生活中的礦物」的認識和圖鑑，鉛筆芯主要是用哪一種礦物做的？',
      opts: ['石墨', '石膏', '滑石', '石英'], ans: 0, why: '說明中提到：石墨很軟、黑色，劃過紙會留下痕跡，所以做成鉛筆芯。' },
    { id: 'use.rock.1', about: '生活中的岩石', level: 2, q: '公園要鋪一條每天有很多人走的步道，需要不容易磨損的石材。根據「生活中的岩石」的特徵與用途表，選哪一種最合適？',
      opts: ['花岡岩，因為它堅硬、耐磨', '大理岩，因為它硬度不高、容易雕刻', '石灰岩，因為它可以燒製成水泥', '板岩，因為它的顏色比較深'], ans: 0, why: '步道每天被踩，需要「堅硬、耐磨」的特徵。表中符合這個特徵的是花岡岩和安山岩。' },
    { id: 'use.cost.1', about: '開採的代價', level: 2, q: '一座礦場把山坡上的樹木和土壤都移走了。根據「開採的代價」的認識，連續下大雨時，最可能發生什麼事？',
      opts: ['山坡的土石崩落，泥沙流進溪裡', '被挖掉的岩石很快長回來', '溪水變得比以前更清澈', '地底的礦物變得更多'], ans: 0, why: '山坡沒有植物抓住土石，大雨時容易發生山崩和土石流；泥沙流進溪裡，溪水就變混濁。' },
    { id: 'use.renew.1', about: '復原與永續', level: 3, q: '把「開採的代價」和「復原與永續」放在一起想：礦場種回樹木之後，為什麼我們還是要珍惜、回收岩石和礦物做的東西？',
      opts: ['因為復原只能減少傷害，被挖掉的山和用掉的礦物都回不來', '因為種樹之後，礦物會從樹根裡長出來', '因為回收做成的東西比新的漂亮', '因為礦場復原之後，就永遠不能再開採'], ans: 0, why: '「開採的代價」說環境被破壞後很難恢復、礦物用掉就沒有；「復原與永續」說復原只能減少傷害。兩者合起來，就知道要從源頭少用、回收。' },
    { id: 'use.renew.2', about: '復原與永續', level: 4, q: '鎮上要蓋活動中心。甲方案：到附近的山開一座新礦場，取得全新的石材。乙方案：先用拆除舊建築回收的碎石，不夠的再向現有的礦場購買。根據「開採的代價」和「復原與永續」，哪一個判斷最合理？',
      opts: ['乙方案比較好，因為減少新的開採，對山林的破壞比較小', '甲方案比較好，因為新礦場開採後，山會自己恢復原狀', '兩個方案對環境的影響完全一樣', '甲方案比較好，因為岩石用不完，多開採也沒關係'], ans: 0, why: '新開一座礦場會讓森林消失、山的樣子永遠改變；回收再利用可以少開採。比較兩個方案對環境的影響，乙方案比較符合永續。' },
  ]
});
})();
