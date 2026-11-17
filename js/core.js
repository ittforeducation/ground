/* 探索大地變化 — 核心引擎：渲染、鏡頭、標籤、區域切換
   區域（zone）以 GROUND.registerZone(id, def) 註冊，規格見專案根目錄 CLAUDE.md */
(function () {
'use strict';
const G = window.GROUND = { zones: {}, state: { mode: 'boot', zoneId: null, nodeId: null, grade: 'e' } };
const $ = s => document.querySelector(s);
G.$ = $;

// 大地圖八個區塊。rect = [西邊 x, 後邊 z, 東西寬, 前後深]（整張大地是 x -20–20、z -10–10）；有 file 的才可進入
G.ZONES = [
  { id: 'spheres',  num: '1',  title: '地表四圈與地層',     short: '四圈與地層', color: '#0284c7', rect: [-20, 0, 10, 10], desc: '岩石圈、水圈、大氣圈、生物圈怎麼分？腳下的地層又是怎麼來的？', file: 'js/zones/spheres.js' },
  { id: 'rocks',    num: '2',  title: '三大類岩石與化石',   short: '岩石與化石', color: '#dc2626', rect: [-20, -10, 10, 10], desc: '火成岩、沉積岩、變質岩各是怎麼形成的？化石藏在哪一種岩石裡？', file: 'js/zones/rocks.js' },
  { id: 'minerals', num: '3',  title: '礦物與硬度',         short: '礦物與硬度', color: '#7c3aed', rect: [-10, 0, 8, 10], desc: '岩石裡一粒粒的是什麼？互相刻劃比比看，誰比較硬？', file: 'js/zones/minerals.js' },
  { id: 'use',      num: '4',  title: '岩石礦物應用', short: '岩石礦物應用', color: '#0f766e', rect: [-2, 0, 7, 10], desc: '生活中哪裡用到岩石和礦物？開採會帶來什麼代價，又該怎麼復原？', file: 'js/zones/use.js' },
  { id: 'weather',  num: '5a', title: '從岩石到土壤',       short: '風化與土壤', color: '#a16207', rect: [1.5, -10, 11.5, 10], desc: '堅硬的岩石怎麼變成砂和土壤？看看風化作用的三種方式。', file: 'js/zones/weather.js' },
  { id: 'river',    num: '5b', title: '河流改變大地',       short: '河流地形',   color: '#2563eb', rect: [5, 0, 8, 10], desc: '侵蝕、搬運、堆積：從上游到出海口，河流怎麼雕刻大地？', file: 'js/zones/river.js' },
  { id: 'coast',    num: '5c', title: '風與海浪的雕刻',     short: '風蝕與海岸', color: '#0891b2', rect: [13, -10, 7, 20], desc: '風稜石、蕈狀岩、海蝕洞、沙洲……風和海浪留下了哪些作品？', file: 'js/zones/coast.js' },
  { id: 'hazard',   num: '6',  title: '災害與因應',     short: '災害與因應', color: '#be123c', rect: [-10, -10, 11.5, 10], desc: '山崩、土石流、淹水、地震怎麼發生？我們可以怎麼避難、守護環境？', file: 'js/zones/hazard.js' },
];
G.zoneDef = id => G.ZONES.find(z => z.id === id);
G.registerZone = (id, def) => { def.id = id; G.zones[id] = def; };

/* ---------- 工具 ---------- */
const U = G.util = {};
U.clamp = (x, a, b) => Math.min(b, Math.max(a, x));
U.lerp = (a, b, t) => a + (b - a) * t;
U.ss = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
U.hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
U.vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return U.lerp(U.lerp(U.hash(xi, yi), U.hash(xi + 1, yi), u), U.lerp(U.hash(xi, yi + 1), U.hash(xi + 1, yi + 1), u), v);
};
U.fbm = (x, y, oct = 4) => { let a = .5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * U.vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; };
U.rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// 天空漸層
U.skyTexture = (top = '#8ec9ee', bottom = '#eaf5ee') => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
// 地層剖面貼圖（區塊側面用）：由上而下 土壤 → 沉積岩層 → 變質岩 → 高溫深處
U.strataTexture = () => {
  if (U._strata) return U._strata;
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = U.rng(7);
  const bands = [[0, '#5b4636'], [.05, '#b9925c'], [.13, '#d8bf8a'], [.2, '#9c8f80'], [.27, '#c7a36b'], [.34, '#7f7b78'], [.42, '#b08e63'], [.5, '#8a7f73'], [.6, '#6f6a6c'], [.72, '#5e5557'], [.86, '#6a4038'], [1, '#8a2f1d']];
  for (let x = 0; x < W; x += 2) {
    const w = Math.sin(x / W * Math.PI * 4) * 9 + Math.sin(x / W * Math.PI * 10 + 1) * 4;
    for (let i = 0; i < bands.length - 1; i++) {
      const y0 = bands[i][0] * H + (i ? w * (1 + i * .12) : 0), y1 = bands[i + 1][0] * H + w * (1 + (i + 1) * .12);
      g.fillStyle = bands[i][1]; g.fillRect(x, y0, 2, y1 - y0 + 2);
    }
  }
  for (let i = 0; i < 5200; i++) { const x = r() * W, y = r() * H; g.fillStyle = r() < .5 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.13)'; g.fillRect(x, y, 1 + r() * 3, 1 + r() * 1.6); }
  g.strokeStyle = 'rgba(40,30,25,.28)'; g.lineWidth = 1.2;
  for (let i = 1; i < bands.length - 1; i++) { g.beginPath(); for (let x = 0; x <= W; x += 8) { const w = (Math.sin(x / W * Math.PI * 4) * 9 + Math.sin(x / W * Math.PI * 10 + 1) * 4) * (1 + i * .12); g.lineTo(x, bands[i][0] * H + w); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return U._strata = t;
};
// 沿一串頂點往下拉出側牆。top: [[x,y,z],…]；uv(x,y,z,沿線距離) → [u,v]
U.skirt = (top, yb, uv) => {
  const pos = [], uvs = []; let s = 0;
  for (let i = 0; i < top.length - 1; i++) {
    const a = top[i], b = top[i + 1], d = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const q = [[a[0], a[1], a[2], s], [b[0], b[1], b[2], s + d], [b[0], yb, b[2], s + d], [a[0], a[1], a[2], s], [b[0], yb, b[2], s + d], [a[0], yb, a[2], s]];
    for (const p of q) { pos.push(p[0], p[1], p[2]); const t = uv(p[0], p[1], p[2], p[3]); uvs.push(t[0], t[1]); }
    s += d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals(); return geo;
};
// 排版：把段落最後幾個字包成不換行，避免行尾只剩 1–2 字或單獨標點
U.tidy = root => {
  root.querySelectorAll('p, li, h3, h4, dd, .opt, .q-stem').forEach(el => {
    let n = el.lastChild; while (n && n.nodeType === 1 && n.lastChild) n = n.lastChild;
    if (!n || n.nodeType !== 3) return; const s = n.nodeValue; if (s.trim().length < 8) return;
    const k = 4, sp = document.createElement('span'); sp.className = 'nw'; sp.textContent = s.slice(-k);
    n.nodeValue = s.slice(0, -k); n.parentNode.insertBefore(sp, n.nextSibling);
  });
};
/* ---------- 擬真元件（各區域共用） ---------- */
U.time = { value: 0 };
// 可無縫拼接的細節雜訊：同時當顏色細節與凹凸貼圖
U.detailTexture = (rx = 6, ry = 6) => {
  if (!U._detail) {
    const size = 256, c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), img = g.createImageData(size, size), r = U.rng(99);
    const oct = [8, 16, 32, 64, 128].map(p => ({ p, g: Array.from({ length: p * p }, () => r()) })), sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let s = 0, a = .5;
      for (const { p, g: gr } of oct) { const fx = x / size * p, fy = y / size * p, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy), i1 = (ix + 1) % p, j1 = (iy + 1) % p;
        s += a * (U.lerp(U.lerp(gr[iy * p + ix], gr[iy * p + i1], tx), U.lerp(gr[j1 * p + ix], gr[j1 * p + i1], tx), ty) - .5); a *= .58; }
      const v = U.clamp(218 + s * 130, 150, 255), k = (y * size + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0); U._detail = c;
  }
  const t = new THREE.CanvasTexture(U._detail); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
};
// 陽光（含陰影）與天空光。half = 陰影涵蓋範圍的一半
U.sunDir = [-0.5, 0.74, 0.45];
U.addSun = (scene, half = 26) => {
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(U.sunDir[0] * 60, U.sunDir[1] * 60, U.sunDir[2] * 60);
  sun.castShadow = true; sun.shadow.mapSize.set(G.coarse ? 1024 : 2048, G.coarse ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 5; sc.far = 140;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xdcecff, 0x9a8a72, 1.35)); return sun;
};
U.shadowed = (o, cast = true, recv = true) => { o.castShadow = cast; o.receiveShadow = recv; return o; };
// 把多個幾何合併成一個（各自上色），供 InstancedMesh 使用
U.merge = parts => {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [geo, hex] of parts) { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); c.set(hex);
    for (const v of g.attributes.position.array) pos.push(v); for (const v of g.attributes.normal.array) nor.push(v); for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return out;
};
U.treeGeos = (s = 1) => {
  const T = THREE, trunk = () => new T.CylinderGeometry(.035 * s, .055 * s, .26 * s, 5).translate(0, .13 * s, 0);
  return {
    conifer: U.merge([[trunk(), '#5a3d26'], [new T.ConeGeometry(.2 * s, .36 * s, 7).translate(0, .36 * s, 0), '#2f5a2a'], [new T.ConeGeometry(.15 * s, .3 * s, 7).translate(0, .56 * s, 0), '#3a6b31'], [new T.ConeGeometry(.09 * s, .22 * s, 7).translate(0, .72 * s, 0), '#44783a']]),
    broad: U.merge([[trunk(), '#5a3d26'], [new T.IcosahedronGeometry(.2 * s, 1).translate(0, .4 * s, 0), '#4f8a36'], [new T.IcosahedronGeometry(.14 * s, 1).translate(.1 * s, .5 * s, .04 * s), '#5d9a40'], [new T.IcosahedronGeometry(.13 * s, 1).translate(-.1 * s, .47 * s, -.05 * s), '#467d31']]),
  };
};
// 把樹種到場景：list = [[x,y,z,大小,種類0針葉/1闊葉],…]
U.plantTrees = (parent, list, rnd, s = 1) => {
  const geos = U.treeGeos(s), mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), c = new THREE.Color();
  [geos.conifer, geos.broad].forEach((geo, kind) => {
    const sub = list.filter(t => (t[4] || 0) === kind); if (!sub.length) return;
    const im = new THREE.InstancedMesh(geo, mat, sub.length);
    sub.forEach((t, i) => { E.set((rnd() - .5) * .14, rnd() * 6.28, (rnd() - .5) * .14); Q.setFromEuler(E); M.compose(V.set(t[0], t[1] - .03, t[2]), Q, S.set(t[3], t[3] * (.9 + rnd() * .35), t[3])); im.setMatrixAt(i, M); im.setColorAt(i, c.setHSL(.28 + (rnd() - .5) * .06, .3 + rnd() * .25, .7 + rnd() * .28)); });
    U.shadowed(im); parent.add(im);
  });
};
U.cloud = (sx, sy, sz, puffs, rnd) => {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: .22 }), geo = new THREE.IcosahedronGeometry(1, 2);
  const base = new THREE.Mesh(geo, mat); base.scale.set(sx * .48, sy * .28, sz * .48); g.add(base);
  for (let i = 0; i < puffs; i++) { const px = (rnd() * 2 - 1) * sx * .42, pz = (rnd() * 2 - 1) * sz * .42, dn = Math.hypot(px / (sx * .5), pz / (sz * .5)), r = sy * (.42 + rnd() * .38) * (1 - .45 * dn), m = new THREE.Mesh(geo, mat); m.position.set(px, sy * .05 + rnd() * sy * .35 * (1 - dn), pz); m.scale.set(r * 1.15, r * .85, r * 1.1); g.add(m); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
};
U.groundShadow = (w, d, y) => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 14, 64, 64, 64); gr.addColorStop(0, 'rgba(20,40,60,.42)'); gr.addColorStop(1, 'rgba(20,40,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
};
/* 海：有波浪、深淺變色、岸邊白沫的水面，加上像水族箱一樣的側面水體 */
const NOISE_GLSL = `float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
  vec3 toLinear(vec3 c){ return pow(c, vec3(2.2)); }`;
U.seaMaterials = (rot = 0, amp = 1, calm = [0, 1, 0], boost = [0, 1, 0]) => {      // calm／boost = [中心 x, 半寬, 比例]：這一段海面的浪比較小／比較大 //      // rot：把波浪前進的方向繞 y 軸旋轉（預設朝 -x；-Math.PI/2 時朝 -z）；amp：浪高倍率
  const sun = new THREE.Vector3(...U.sunDir).normalize(), uRot = { value: new THREE.Vector2(Math.cos(rot), Math.sin(rot)) }, uAmp = { value: amp }, uCalm = { value: new THREE.Vector3(...calm) }, uBoost = { value: new THREE.Vector3(...boost) };
  const top = new THREE.ShaderMaterial({ transparent: true, uniforms: { uTime: U.time, uSun: { value: sun }, uRot, uAmp, uCalm, uBoost },
    vertexShader: `uniform float uTime; uniform float uAmp; uniform vec3 uCalm; uniform vec3 uBoost; uniform vec2 uRot; attribute float aDepth; varying vec3 vW; varying vec3 vN; varying float vD;
      void wave(vec2 p, vec2 d, float L, float A, float ph, inout float h, inout vec2 g){ float k = 6.2831853 / L, th = k * dot(d, p) - sqrt(9.8 * k) * uTime * .45 + ph; h += A * sin(th); g += A * k * cos(th) * d; }
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); float amp = smoothstep(0.0, 0.5, aDepth) * uAmp * (1.0 - uCalm.z * exp(-pow((wp.x - uCalm.x) / uCalm.y, 2.0))) * (1.0 + uBoost.z * exp(-pow((wp.x - uBoost.x) / uBoost.y, 2.0))); float h = 0.0; vec2 g = vec2(0.0), q = vec2(uRot.x * wp.x - uRot.y * wp.z, uRot.y * wp.x + uRot.x * wp.z);
        wave(q, normalize(vec2(-1.0, 0.25)), 3.2, 0.045 * amp, 0.0, h, g); wave(q, normalize(vec2(-1.0, -0.4)), 1.9, 0.028 * amp, 1.7, h, g); wave(q, normalize(vec2(-0.6, 0.8)), 1.1, 0.014 * amp, 3.1, h, g);
        g = vec2(uRot.x * g.x + uRot.y * g.y, -uRot.y * g.x + uRot.x * g.y); wp.y += h; vN = normalize(vec3(-g.x, 1.0, -g.y)); vW = wp.xyz; vD = aDepth; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; uniform vec2 uRot; varying vec3 vW; varying vec3 vN; varying float vD; ${NOISE_GLSL}
      void main(){ if (vD < -0.04) discard;
        vec2 rp = vec2(uRot.x * vW.x - uRot.y * vW.z, uRot.y * vW.x + uRot.x * vW.z) * 5.0, mv = uTime * vec2(-0.35, 0.12); float e = 0.15, n0 = vnoise(rp + mv), nx = vnoise(rp + vec2(e, 0.0) + mv), nz = vnoise(rp + vec2(0.0, e) + mv);
        vec3 N = normalize(vN + vec3(n0 - nx, 0.0, n0 - nz) * 0.9), V = normalize(cameraPosition - vW);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 col = mix(vec3(0.32, 0.80, 0.80), vec3(0.04, 0.27, 0.53), smoothstep(0.0, 1.1, vD));
        col *= 0.78 + 0.22 * max(dot(N, uSun), 0.0); col = mix(col, vec3(0.72, 0.86, 0.97), fres * 0.7);
        col += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, normalize(uSun + V)), 0.0), 200.0) * 1.8;
        float shore = 1.0 - smoothstep(0.0, 0.2, vD), fn = vnoise(vW.xz * 7.0 + vec2(uTime * 0.5, 0.0)), band = 0.5 + 0.5 * sin(vD * 42.0 + uTime * 2.2);
        float foam = shore * smoothstep(0.45, 0.8, fn * 0.6 + band * 0.6); col = mix(col, vec3(0.97, 0.99, 1.0), foam * 0.9);
        gl_FragColor = vec4(toLinear(col), max(mix(0.55, 0.93, smoothstep(0.0, 0.7, vD)), foam));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const wall = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: U.time, uRot, uAmp, uCalm, uBoost },
    vertexShader: `uniform float uTime; uniform float uAmp; uniform vec3 uCalm; uniform vec3 uBoost; uniform vec2 uRot; attribute float aD; attribute float aDep; varying float vD; varying vec3 vW;
      float wv(vec2 p, vec2 d, float L, float A, float ph){ float k = 6.2831853 / L; return A * sin(k * dot(d, p) - sqrt(9.8 * k) * uTime * .45 + ph); }
      void main(){ vD = aD; vec4 w = modelMatrix * vec4(position, 1.0);
        if (aD < 0.0005) { float amp = smoothstep(0.0, 0.5, aDep) * uAmp * (1.0 - uCalm.z * exp(-pow((w.x - uCalm.x) / uCalm.y, 2.0))) * (1.0 + uBoost.z * exp(-pow((w.x - uBoost.x) / uBoost.y, 2.0))); vec2 q = vec2(uRot.x * w.x - uRot.y * w.z, uRot.y * w.x + uRot.x * w.z); w.y += wv(q, normalize(vec2(-1.0, 0.25)), 3.2, 0.045 * amp, 0.0) + wv(q, normalize(vec2(-1.0, -0.4)), 1.9, 0.028 * amp, 1.7) + wv(q, normalize(vec2(-0.6, 0.8)), 1.1, 0.014 * amp, 3.1); }   // 頂端跟著海面的波浪起伏，邊緣才不會露出縫
        vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; varying float vD; varying vec3 vW; ${NOISE_GLSL}
      void main(){ float a = vW.x + vW.z; vec3 col = mix(vec3(0.26, 0.74, 0.80), vec3(0.03, 0.20, 0.45), smoothstep(0.0, 1.3, vD));
        float c = vnoise(vec2(a * 4.0 + uTime * 0.4, vD * 6.0 - uTime * 0.3)) * vnoise(vec2(a * 7.0 - uTime * 0.3, vD * 9.0));
        col += vec3(0.5, 0.8, 0.9) * smoothstep(0.35, 0.6, c) * (1.0 - smoothstep(0.0, 1.0, vD)) * 0.35; col = mix(col, vec3(0.85, 0.97, 1.0), 1.0 - smoothstep(0.0, 0.035, vD));
        gl_FragColor = vec4(toLinear(col), 0.8);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  return { top, wall };
};
// 在 [x0,x1]×[z0,z1] 建一片海。hFn(x,z)=海床高度；ox,oz=父群組原點；sides=要畫側面水體的邊（W、E、N=z0、S=z1）
U.buildSea = (mats, x0, x1, z0, z1, hFn, ox = 0, oz = 0, sides = 'ESN', step = .16) => {
  const g = new THREE.Group(), nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step), pos = [], dep = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz; pos.push(x - ox, 0, z - oz); dep.push(-hFn(x, z)); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); sg.setIndex(idx);
  const top = new THREE.Mesh(sg, mats.top); top.renderOrder = 2; top.frustumCulled = false; g.add(top);
  const wp = [], wd = [], we = [], seg = (xa, za, xb, zb) => { const n = Math.ceil(Math.hypot(xb - xa, zb - za) / step); let ph = 0, px = xa, pz = za;
    for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n, z = za + (zb - za) * i / n, h = Math.min(0, hFn(x, z));
      if (i && (h < 0 || ph < 0)) { wp.push(px - ox, 0, pz - oz, x - ox, 0, z - oz, x - ox, h, z - oz, px - ox, 0, pz - oz, x - ox, h, z - oz, px - ox, ph, pz - oz); wd.push(0, 0, -h, 0, -h, -ph); we.push(-ph, -h, -h, -ph, -h, -ph); }
      ph = h; px = x; pz = z; } };
  if (sides.includes('E')) seg(x1, z0, x1, z1); if (sides.includes('W')) seg(x0, z0, x0, z1); if (sides.includes('N')) seg(x0, z0, x1, z0); if (sides.includes('S')) seg(x0, z1, x1, z1);
  if (wp.length) { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setAttribute('aD', new THREE.Float32BufferAttribute(wd, 1)); wg.setAttribute('aDep', new THREE.Float32BufferAttribute(we, 1)); const w = new THREE.Mesh(wg, mats.wall); w.renderOrder = 3; w.frustumCulled = false; g.add(w); }
  return g;
};

U.dispose = root => root.traverse(o => {
  if (o.geometry) o.geometry.dispose();
  if (o.material) for (const m of [].concat(o.material)) { for (const k in m) { const v = m[k]; if (v && v.isTexture && v !== U._strata) v.dispose(); } m.dispose(); }
});

/* ---------- 標籤（HTML 疊在 3D 上） ---------- */
const labels = [];
G.addLabel = (html, cls, pos, opt = {}) => {
  const el = document.createElement('div'); el.className = 'lb ' + cls; el.innerHTML = html;
  if (opt.color) el.style.setProperty('--c', opt.color);
  if (opt.onClick) el.addEventListener('click', e => { e.stopPropagation(); opt.onClick(); });
  if (opt.onEnter) el.addEventListener('mouseenter', opt.onEnter);
  $('#labels').appendChild(el);
  const L = { el, pos: new THREE.Vector3(...pos), dy: opt.dy || null }; labels.push(L); return L;
};
G.clearLabels = () => { labels.length = 0; $('#labels').innerHTML = ''; };
const _v = { v: null };
function updateLabels() {
  const w = G.canvas.clientWidth, h = G.canvas.clientHeight; _v.v = _v.v || new THREE.Vector3();
  for (const L of labels) {
    const v = _v.v.copy(L.pos); if (L.dy) v.y += L.dy(); v.project(G.camera);
    if (v.z > 1 || v.z < -1) { L.el.style.display = 'none'; continue; }
    L.el.style.display = ''; L.el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2 * w).toFixed(1)}px,${((1 - v.y) / 2 * h).toFixed(1)}px)`;
  }
}

/* ---------- 鏡頭 ---------- */
G.setView = v => {
  const c = G.controls;
  c.minDistance = v.minDist ?? 6; c.maxDistance = v.maxDist ?? 90;
  c.minAzimuthAngle = v.minAz ?? -Infinity; c.maxAzimuthAngle = v.maxAz ?? Infinity;
  G._pan = v.pan || { x: [-20, 20], y: [-5, 8], z: [-12, 12] };     // 平移範圍：畫面中心不會離開模型
  c.minPolarAngle = v.minPolar ?? 0.15; c.maxPolarAngle = v.maxPolar ?? Math.PI * 0.47;
};
// 窄畫面時自動拉遠，讓主體完整入鏡
G.fit = pos => { const a = G.camera.aspect > 0 ? G.camera.aspect : 1.6, k = Math.max(1, 1.45 / a); return k === 1 ? pos : pos.map((p, i) => G._fitT[i] + (p - G._fitT[i]) * k); };
G.flyTo = (pos, target, dur = 1.2) => {
  G._fitT = target; pos = G.fit(pos);
  gsap.to(G.camera.position, { x: pos[0], y: pos[1], z: pos[2], duration: dur, ease: 'power2.inOut', overwrite: true });
  gsap.to(G.controls.target, { x: target[0], y: target[1], z: target[2], duration: dur, ease: 'power2.inOut', overwrite: true });
};
G.jumpTo = (pos, target) => { G._fitT = target; pos = G.fit(pos); G.camera.position.set(...pos); G.controls.target.set(...target); G.controls.update(); };

G.toast = (msg, ms = 2200) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(G._tt); G._tt = setTimeout(() => t.classList.remove('show'), ms); };
const fade = on => new Promise(r => { $('#fade').classList.toggle('on', on); setTimeout(r, 470); });

/* ---------- 場景切換 ---------- */
function setActive(make) {      // 先清掉舊場景與標籤，再建立新場景（新場景會加自己的標籤）
  if (G.active && G.active.dispose) G.active.dispose();
  G.active = null; G.clearLabels(); G.active = make();
}
G.showWorld = async (first) => {
  if (!first) await fade(true);
  G.ui.closePanel(); setActive(() => G._world || (G._world = G.buildWorld())); G.active.mount();
  G.state.mode = 'world'; G.state.zoneId = G.state.nodeId = null;
  $('#btnBack').hidden = true; $('#stations').classList.remove('show');
  $('#hTitle').textContent = '探索大地變化'; $('#hSub').textContent = '把游標移到（或點一下）地圖上的區塊，選一個地方出發！';
  $('#grades').style.display = '';
  G.setView(G.active.view); G.jumpTo(G.active.home.pos, G.active.home.target);
  if (!first) fade(false);
};
G.enterZone = async id => {
  const def = G.zoneDef(id);
  if (!def.file) { G.toast('「' + def.title + '」會在後續階段開放'); return; }
  await fade(true);
  try { if (!G.zones[id]) await G.loadScript(def.file); } catch (e) { fade(false); G.toast('載入失敗，請檢查網路後再試一次'); return; }
  const z = G.zones[id]; $('#zoneCard').classList.remove('show');
  setActive(() => z.build(G)); G.state.mode = 'zone'; G.state.zoneId = id; G.state.nodeId = null;
  $('#btnBack').hidden = false; $('#grades').style.display = 'none';
  $('#hTitle').textContent = def.num + '　' + def.title; $('#hSub').textContent = z.hint || '點發光的圓點或下方按鈕，開始探索！';
  // 節點列
  const st = $('#stations'); st.innerHTML = ''; st.classList.add('show');
  for (const n of z.nodes) {
    const b = document.createElement('button'); b.dataset.id = n.id; b.style.setProperty('--c', n.color || def.color);
    b.innerHTML = `<b>${n.num}</b>${n.title}`; if (!n.ready) b.classList.add('soon');
    b.onclick = () => G.openNode(n.id); st.appendChild(b);
  }
  if (z.quiz && z.quiz.length) {      // 本區挑戰（檢核題以區域為單位）
    const b = document.createElement('button'); b.dataset.id = '_quiz'; b.style.setProperty('--c', '#15803d'); b.innerHTML = '<b>★</b>本區挑戰';
    b.onclick = () => G.openNode('_quiz'); st.appendChild(b);
  }
  G.setView(G.active.view); G.jumpTo(G.active.home.pos, G.active.home.target);
  fade(false);
};
G.openNode = id => {
  const z = G.zones[G.state.zoneId], n = id === '_quiz' ? { id, num: '★', title: '本區挑戰', en: 'Challenge', color: '#15803d', ready: true, isQuiz: true } : z.nodes.find(x => x.id === id);
  if (!n.ready) { G.toast('「' + n.title + '」會在後續階段製作'); return; }
  G.state.nodeId = id;
  document.querySelectorAll('#stations button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  if (n.cam) G.flyTo(n.cam.pos, n.cam.target);
  if (G.active.onNode) G.active.onNode(n.isQuiz ? null : id);
  G.ui.openPanel(z, n);
};
G.closeNode = () => {
  G.state.nodeId = null; document.querySelectorAll('#stations button').forEach(b => b.classList.remove('on'));
  if (G.active.onNode) G.active.onNode(null);
};

/* ---------- 啟動 ---------- */
G.start = () => {
  const T = THREE, canvas = G.canvas = $('#gl');
  const coarse = G.coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = G.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));   // iPad 9 效能考量
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.28;
  const camera = G.camera = new T.PerspectiveCamera(40, 1, 0.1, 500);
  const controls = G.controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.rotateSpeed = .6; controls.zoomSpeed = .8;
  // 平移：滑鼠右鍵拖曳（或 Shift＋左鍵拖曳）、方向鍵；觸控為雙指拖曳（同時可縮放）
  controls.enablePan = true; controls.screenSpacePanning = true; controls.panSpeed = 1; controls.keyPanSpeed = 16;
  controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
  controls.listenToKeyEvents(window);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const resize = () => { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();

  // 指標：滑鼠移動 = 懸停；點一下（沒有拖曳）= 選取
  const ray = new T.Raycaster(), ndc = new T.Vector2(); let down = null;
  const cast = e => { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray; };
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !e.buttons && G.active && G.active.onHover) G.active.onHover(cast(e)); });
  canvas.addEventListener('pointerdown', e => { down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved < 7 && G.active && G.active.onTap) G.active.onTap(cast(e), e.pointerType);
  });
  canvas.addEventListener('pointerleave', () => { if (G.active && G.active.onHover) G.active.onHover(null); });

  // 工具列
  $('#toolbar').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const act = b.dataset.act;
    if (act === 'back') G.showWorld();
    if (act === 'home') { G.ui.closePanel(); G.flyTo(G.active.home.pos, G.active.home.target); G.showHint(); }
    if (act === 'record') G.ui.openRecords();
    if (act === 'fullscreen') { const d = document; if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen(); else G.toast('這台裝置請用「加入主畫面」取得全螢幕'); }
  });

  // 操作提示：開始時與按「全景」時顯示幾秒
  G.showHint = () => { const h = $('#hint'); h.innerHTML = coarse
      ? '<b>單指拖曳</b>旋轉　<b>雙指開合</b>縮放　<b>雙指拖曳</b>平移'
      : '<b>左鍵拖曳</b>旋轉　<b>滾輪</b>縮放　<b>右鍵拖曳</b>或<b>方向鍵</b>平移';
    h.classList.add('show'); clearTimeout(G._ht); G._ht = setTimeout(() => h.classList.remove('show'), 9000); };
  let last = performance.now();
  const loop = now => {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    controls.update();
    if (G._pan && !gsap.isTweening(controls.target)) {        // 把畫面中心限制在模型範圍內
      const t = controls.target, b = G._pan, x = U.clamp(t.x, b.x[0], b.x[1]), y = U.clamp(t.y, b.y[0], b.y[1]), z = U.clamp(t.z, b.z[0], b.z[1]);
      if (x !== t.x || y !== t.y || z !== t.z) { camera.position.x += x - t.x; camera.position.y += y - t.y; camera.position.z += z - t.z; t.set(x, y, z); }
    }
    U.time.value = now / 1000;
    if (G.active) { G.active.update(dt, now / 1000); renderer.render(G.active.scene, camera); updateLabels(); }
  };
  G.showWorld(true).then(() => { requestAnimationFrame(loop); setTimeout(() => { $('#loader').classList.add('hide'); G.showHint(); }, 250); });
};
})();
