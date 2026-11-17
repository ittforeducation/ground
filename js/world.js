/* 大地圖：一塊 40×20 的 3D 大地，切成 8 個可浮起的區塊（西邊高山 → 東邊海洋；最右邊一整條是海岸區）
   擬真手法比照水循環教具：高解析地形、逐像素地表貼圖、凹凸細節、陰影、波浪海面、分層樹木 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, { ss, fbm, vnoise, clamp, lerp } = U;
const BOTTOM = -4.5, CE = 1 / 8, QX = -6.3;      // CE：地形格子大小；QX：採石坑（礦物區）的 x

/* ---- 地形高度 ---- */
const riverZ = x => 5.3 + 2.3 * Math.sin(x * 0.62 + 0.5) * ss(-9, 0, x) * (1 - ss(11, 15, x)) + 0.6 * Math.sin(x * 0.25);
const riverW = x => 0.26 + 0.6 * ss(-14, 8, x) + 1.5 * ss(11, 16.5, x);
const ridge = (x, z) => { let s = 0, a = .5, f = 1; for (let i = 0; i < 3; i++) { s += a * (1 - Math.abs(2 * vnoise(x * f, z * f) - 1)); f *= 2.1; a *= .5; } return s; };
function g0(x, z) {           // 不含河道下切的地面
  let h = 3.0 - 2.75 * ss(-20, 6, x) - 1.35 * ss(14, 19.5, x);
  const mt = clamp((4 - x) / 22, 0, 1);
  h += (fbm(x * 0.33 + 3, z * 0.33 + 7) - 0.47) * (0.25 + 1.5 * mt) * 2;
  h += (ridge(x * 0.55 + 1, z * 0.55 + 4) - 0.55) * 1.5 * mt * mt;               // 山區的稜線與溝谷
  h += (fbm(x * 2.2, z * 2.2, 3) - 0.45) * (0.06 + 0.22 * mt);                   // 小起伏
  let d = Math.hypot(x + 15, z + 5);                                            // 火山（岩石區）
  h += 5.4 * Math.pow(Math.max(0, 1 - d / 6.2), 1.6) - 1.2 * Math.max(0, 1 - d / 0.95);
  h += 2.4 * Math.exp(-((x + 15) ** 2 / 16 + (z - 8.6) ** 2 / 2.2));             // 前排山稜（四圈區），河谷夾在中間
  h += 1.5 * Math.exp(-((x + 14) ** 2 / 20 + (z - 2.0) ** 2 / 2.0));
  h += 1.3 * fbm(x * 0.9 + 9, z * 0.9, 3) * ss(1.5, 4, x) * ss(12.6, 10.4, x) * ss(0, -3, z);       // 風化區的岩丘
  h += 2.9 * ss(-3.5, -9.5, z) * ss(-9.5, -6.5, x) * ss(0, -3, x);               // 災害區後方的陡坡
  d = Math.hypot(x - 16.6, z + 6.2); h += 1.7 * ss(3.0, 1.9, d);                 // 海岸區的岬角
  d = Math.hypot(x - QX, z - 8.3); h += 1.3 * Math.exp(-d * d / 5) - Math.round(1.25 * ss(1.7, 0.6, d) * 4) / 4;   // 礦物區的小丘與階梯狀採石坑
  return h;
}
// 河床的高度：從上游往下游只降不升（遇到隆起的地方就把河谷切深），水才不會忽高忽低
const BED = (() => { const a = []; let m = 1e9; for (let i = 0; i <= 780; i++) { const x = -19 + i * .05; m = Math.min(m, g0(x, riverZ(x)) - 0.6); a.push(m); }
  for (let k = 0; k < 3; k++) for (let i = a.length - 2; i > 0; i--) a[i] = Math.min(a[i], (a[i - 1] + a[i] * 2 + a[i + 1]) / 4);      // 把一階一階的落差抹成緩坡（仍然只降不升）
  return a; })();
const bedY = x => { const f = clamp((x + 19) / .05, 0, 779.999), i = f | 0; return lerp(BED[i], BED[i + 1], f - i); };
function H(x, z) {
  let h = g0(x, z);
  if (x > -19) { const dz = (z - riverZ(x)) / riverW(x); h -= Math.max(0.6, h - bedY(x)) * Math.exp(-dz * dz * 1.3) * ss(-19, -17, x); }
  return h;
}
const riverY = x => Math.max(bedY(x) + 0.24, 0.03);

/* ---- 地表分類與上色 ---- */
const riverProx = (x, z) => x > -18.6 ? Math.abs(z - riverZ(x)) / riverW(x) : 9;
const inTown = (x, z) => x > -1.5 && x < 4.5 && ((z > 0.4 && z < 3.0) || (z > 8.0 && z < 9.7));      // 應用區的城鎮（河的兩岸）
const inVillage = (x, z) => x > -8.5 && x < -1.5 && z > -3.4 && z < -0.6;                                     // 災害區山腳下的聚落
const bareCape = (x, z) => ss(2.3, 1.9, Math.hypot(x - 16.6, z + 6.2)) * ss(16.3, 16.8, x);      // 岬角靠海的一半是裸露的砂岩（放蕈狀岩）
const forestMask = (x, z, h) => ss(.4, .58, fbm(x * .8 + 2, z * .8, 3)) * ss(.5, 1.3, h);
const isFarm = (x, z, h, sl, pr) => h > .3 && h < 1.25 && sl < .32 && x > -1.5 && x < 14.6 && pr > 2.3 && !inTown(x, z) && !inVillage(x, z) && Math.hypot(x - 16.6, z + 6.2) > 3.4;
const FARM = ['#a9c96b', '#c9cf7a', '#8fbf5f', '#d8c47c', '#b9a56c', '#7fb86a', '#c2d68a'];
const C = h => new THREE.Color(h);
let K;                                 // 常用顏色（THREE 載入後建立）
function shade(x, z, h, sl, c) {
  const n = fbm(x * .9 + 2, z * .9, 3), pr = riverProx(x, z);
  if (h < 0) { c.copy(K.wet).lerp(K.seabed, ss(0, -1.1, h)); return; }
  c.copy(K.grass).lerp(K.grassL, clamp(n * 1.2, 0, 1)).lerp(K.forest, forestMask(x, z, h) * .8);
  if (isFarm(x, z, h, sl, pr) && forestMask(x, z, h) < .5) {                    // 平原上的田地
    const u = x * .955 + z * .296, v = -x * .296 + z * .955, fu = u / .95, fv = v / .62, iu = Math.floor(fu), iv = Math.floor(fv);
    c.set(FARM[Math.floor(U.hash(iu, iv) * FARM.length)]); const e = Math.min(fu - iu, 1 - fu + iu, fv - iv, 1 - fv + iv);
    if (e < .07) c.lerp(K.hedge, .75); else if (((v * 14) | 0) % 2) c.offsetHSL(0, 0, -.025);
  }
  if (inTown(x, z) && h > .35) { const fu = x / .62, fv = z / .62, e = Math.min(fu - Math.floor(fu), fv - Math.floor(fv)); c.copy(e < .16 ? K.road : K.pave); }
  if (inVillage(x, z)) c.lerp(K.pave, .35);
  c.lerp(K.rock.clone().lerp(K.rockD, n), clamp(ss(.6, 1.0, sl) + ss(4.4, 5.6, h) * .7, 0, 1));
  const w = ss(1.5, 3.5, x) * ss(12.4, 10.4, x) * ss(-.3, -2.5, z) * ss(.45, .6, fbm(x * 1.3, z * 1.3, 2)); if (w > 0) c.lerp(K.bare, w * .85);   // 風化區裸岩
  const sc = (x + 4.4) ** 2 / 2.2 + (z + 6.4) ** 2 / 5; if (sc < 1 && z < -3.6) c.lerp(K.scar.clone().lerp(K.scarL, vnoise(x * 5, z * 1.1)), ss(1, .75, sc));   // 崩塌地
  const dh = Math.hypot(x - 16.6, z + 6.2); if (dh < 3.2 && (sl > .5 || h > 1.0)) c.lerp(((h * 5 + n) % 1) < .5 ? K.cliff : K.cliffD, ss(3.2, 2.8, dh));         // 岬角的層狀岩石
  const bc = bareCape(x, z); if (bc > 0) c.lerp(K.cliff.clone().lerp(K.cliffD, n), bc * .8);
  const dq = Math.hypot(x - QX, z - 8.3); if (dq < 1.95) c.lerp(sl > .5 ? K.quarryD : K.quarry, ss(1.95, 1.7, dq));
  const dv = Math.hypot(x + 15, z + 5);
  if (dv < 5.4) { const t = vnoise(Math.atan2(z + 5, x + 15) * 3.2 + 9, 1.5); if (t > .66) c.lerp(K.lavaOld, .75 * ss(5.4, 4.2, dv)); c.lerp(K.lava, ss(2.7, 1.5, dv)); if (dv < 1.0) c.lerp(K.glow, ss(1.0, .5, dv)); }
  if (pr < 2) { c.lerp(K.bank, (1 - ss(1, 2, pr)) * .8); if (pr < 1.05) c.copy(K.bed); }
  if (x > 12.5 && h < .3) c.lerp(K.sand.clone().lerp(K.wet, ss(.14, 0, h)), ss(.3, .17, h));
  c.offsetHSL(0, 0, (vnoise(x * 9, z * 9) - .5) * .07);
}

G.buildWorld = function () {
  const T = THREE, scene = new T.Scene(), TEX = G.coarse ? 256 : 400;
  K = { grass: C('#7da84a'), grassL: C('#a6c565'), forest: C('#3f6f33'), rock: C('#857c6f'), rockD: C('#5f584f'), bare: C('#b09f84'), scar: C('#8a5d3b'), scarL: C('#b08257'), cliff: C('#c0a67c'), cliffD: C('#9c8460'),
    quarry: C('#c4c1b8'), quarryD: C('#8f8c85'), lava: C('#3b3331'), lavaOld: C('#4a403c'), glow: C('#b8461c'), bank: C('#b3a88f'), bed: C('#9a927f'), sand: C('#e6d6a3'), wet: C('#cbb98a'), seabed: C('#8f8a66'), hedge: C('#5f8a45'), pave: C('#cfcabb'), road: C('#8e8e8c') };
  scene.background = U.skyTexture('#6fb4e8', '#e6f2f4'); scene.fog = new T.Fog(0xd6eaf3, 80, 190);
  U.addSun(scene, 27); scene.add(U.groundShadow(72, 44, BOTTOM - 1.2));

  const skirtMat = new T.MeshStandardMaterial({ map: U.strataTexture(), bumpMap: U.detailTexture(3, 2), bumpScale: 1.5, roughness: 1, side: T.DoubleSide });
  const detail = U.detailTexture(5, 5), seaMats = U.seaMaterials();
  // 河水：流動的水紋
  const rc = document.createElement('canvas'); rc.width = 128; rc.height = 32; const rg = rc.getContext('2d'), rr = U.rng(3);
  const gr = rg.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, '#6fb6dc'); gr.addColorStop(.3, '#2f86c8'); gr.addColorStop(.7, '#2f86c8'); gr.addColorStop(1, '#6fb6dc'); rg.fillStyle = gr; rg.fillRect(0, 0, 128, 32);
  for (let i = 0; i < 34; i++) { rg.fillStyle = `rgba(255,255,255,${.12 + rr() * .3})`; rg.fillRect(rr() * 128, 3 + rr() * 26, 8 + rr() * 24, 1.2); }
  const riverTex = new T.CanvasTexture(rc); riverTex.colorSpace = T.SRGBColorSpace; riverTex.wrapS = riverTex.wrapT = T.RepeatWrapping;
  const riverMat = new T.MeshStandardMaterial({ map: riverTex, roughness: .12, metalness: .1, side: T.DoubleSide });
  // 房屋與樓房
  const roof = new T.CylinderGeometry(.27, .27, .46, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, .6, 1).translate(0, .3 + .081, 0);
  const houseGeo = U.merge([[new T.BoxGeometry(.42, .3, .36).translate(0, .15, 0), '#f3ede0'], [roof, '#b4513a'], [new T.BoxGeometry(.08, .16, .01).translate(.08, .08, .185), '#6b4a34']]);
  const towerGeo = U.merge([[new T.BoxGeometry(.4, 1, .4).translate(0, .5, 0), '#e4e8ee'], [new T.BoxGeometry(.44, .04, .44).translate(0, 1.0, 0), '#8c949e'], [new T.BoxGeometry(.41, .06, .3).translate(0, .3, 0), '#7f95ad'], [new T.BoxGeometry(.41, .06, .3).translate(0, .55, 0), '#7f95ad'], [new T.BoxGeometry(.41, .06, .3).translate(0, .8, 0), '#7f95ad']]);
  const propMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
  const rockMat = new T.MeshStandardMaterial({ color: 0xa3978a, roughness: 1, flatShading: true, bumpMap: detail, bumpScale: 2 });
  const col = new T.Color(), M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3();
  const tiles = [], anim = [];

  for (const def of G.ZONES) {
    const [x0, z0, TW, TD] = def.rect, cx = x0 + TW / 2, cz = z0 + TD / 2, NX = Math.round(TW / CE), NZ = Math.round(TD / CE), area = TW * TD / 100;
    const grp = new T.Group(); grp.position.set(cx, 0, cz); grp.userData.zoneId = def.id; scene.add(grp);
    const rnd = U.rng(Math.round(x0 * 7 + z0 * 13 + 401)), W1 = NX + 1;
    // 高度格網
    const hs = new Float32Array(W1 * (NZ + 1)); let top = -9;
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const h = H(x0 + i * CE, z0 + j * CE); hs[j * W1 + i] = h; if (h > top) top = h; }
    const hAt = (x, z) => { const fx = clamp((x - x0) / CE, 0, NX - 1e-4), fz = clamp((z - z0) / CE, 0, NZ - 1e-4), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * W1 + i; return lerp(lerp(hs[k], hs[k + 1], u), lerp(hs[k + W1], hs[k + W1 + 1], u), v); };
    const slAt = (x, z) => Math.hypot(hAt(x + CE, z) - hAt(x - CE, z), hAt(x, z + CE) - hAt(x, z - CE)) / (2 * CE);
    // 地表：網格 + 逐像素上色的貼圖
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { pos.push(i * CE - TW / 2, hs[j * W1 + i], j * CE - TD / 2); uv.push(i / NX, j / NZ); }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * W1 + i, b = a + 1, c = a + W1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const TX = Math.round(TEX * TW / 10), TZ = Math.round(TEX * TD / 10), cv = document.createElement('canvas'); cv.width = TX; cv.height = TZ; const cg = cv.getContext('2d'), img = cg.createImageData(TX, TZ), px = img.data;
    for (let j = 0; j < TZ; j++) for (let i = 0; i < TX; i++) {
      const x = x0 + (i + .5) / TX * TW, z = z0 + (j + .5) / TZ * TD; shade(x, z, hAt(x, z), slAt(x, z), col);
      const k = (j * TX + i) * 4; px[k] = clamp(col.r, 0, 1) * 255; px[k + 1] = clamp(col.g, 0, 1) * 255; px[k + 2] = clamp(col.b, 0, 1) * 255; px[k + 3] = 255;
    }
    cg.putImageData(img, 0, 0); const tex = new T.CanvasTexture(cv); tex.flipY = false; tex.anisotropy = 4;      // 顏色以線性值寫入，不再轉換
    grp.add(U.shadowed(new T.Mesh(geo, new T.MeshStandardMaterial({ map: tex, bumpMap: detail, bumpScale: 2.2, roughness: .94 }))));
    // 四面地層側牆與底面
    const edge = [], P = (i, j) => [i * CE - TW / 2, hs[j * W1 + i], j * CE - TD / 2];
    for (let i = 0; i <= NX; i++) edge.push(P(i, NZ)); for (let j = NZ - 1; j >= 0; j--) edge.push(P(NX, j));
    for (let i = NX - 1; i >= 0; i--) edge.push(P(i, 0)); for (let j = 1; j <= NZ; j++) edge.push(P(0, j));
    grp.add(U.shadowed(new T.Mesh(U.skirt(edge, BOTTOM, (x, y, z) => [(x + cx + (z + cz) * .6) / 14, 1 - (3.2 - y) / 8.2]), skirtMat), true, true));
    const base = new T.Mesh(new T.PlaneGeometry(TW, TD), new T.MeshBasicMaterial({ color: 0x3a2622 })); base.rotation.x = Math.PI / 2; base.position.y = BOTTOM; grp.add(base);
    // 海（最右邊的海岸區）
    if (def.id === 'coast') grp.add(U.buildSea(seaMats, 13.6, x0 + TW, z0, z0 + TD, hAt, cx, cz, 'ENS'));
    // 河（流過前排各區，在海岸區入海）
    if (z0 + TD > 5) {
      const xa = Math.max(x0, -18), xb = Math.min(x0 + TW, 14.9), rp = [], ru = [], ri = [];
      for (let x = xa, k = 0; x <= xb + 1e-6; x += 0.1, k++) {
        const z = riverZ(x), dzdx = (riverZ(x + .05) - riverZ(x - .05)) / .1, l = Math.hypot(1, dzdx), nx = -dzdx / l, nz = 1 / l, w = riverW(x) * .95 * ss(-18, -16.5, x), y = riverY(x);
        rp.push(x + nx * w - cx, y, z + nz * w - cz, x - nx * w - cx, y, z - nz * w - cz); ru.push(x * .45, 0, x * .45, 1);
        if (k) { const a = (k - 1) * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const rgeo = new T.BufferGeometry(); rgeo.setAttribute('position', new T.Float32BufferAttribute(rp, 3)); rgeo.setAttribute('uv', new T.Float32BufferAttribute(ru, 2)); rgeo.setIndex(ri); rgeo.computeVertexNormals();
      grp.add(U.shadowed(new T.Mesh(rgeo, riverMat), false, true));
    }
    // 樹：森林多為針葉、平地零星闊葉
    const trees = [];
    for (let k = 0; k < 2600 * area && trees.length < 230 * area; k++) {
      const x = x0 + .25 + rnd() * (TW - .5), z = z0 + .25 + rnd() * (TD - .5), h = hAt(x, z), sl = slAt(x, z), pr = riverProx(x, z);
      if (h < .28 || h > 5 || sl > .95 || pr < 1.9 || inTown(x, z) || bareCape(x, z) > .05 || (Math.abs(z + 5.6) < .7 && x > 4.2 && x < 6.7) || Math.hypot(x - 8.2, z + 3.2) < .8) continue;
      if (Math.hypot(x + 15, z + 5) < 2.9 || Math.hypot(x - QX, z - 8.3) < 2 || ((x + 4.4) ** 2 / 2.2 + (z + 6.4) ** 2 / 5 < 1.1 && z < -3.6)) continue;
      const f = forestMask(x, z, h), farm = isFarm(x, z, h, sl, pr) && f < .5, r = rnd();
      if (r < f * .95) trees.push([x - cx, h, z - cz, .65 + rnd() * .55, rnd() < .82 ? 0 : 1]);
      else if (!farm && r > .955) trees.push([x - cx, h, z - cz, .8 + rnd() * .5, 1]);
      else if (inVillage(x, z) && r > .9) trees.push([x - cx, h, z - cz, .7 + rnd() * .3, 1]);
    }
    U.plantTrees(grp, trees, rnd);
    // 房屋、樓房
    const houses = [], towers = [];
    for (let k = 0; k < 900 && houses.length + towers.length < (def.id === 'use' ? 80 : 14); k++) {
      const x = x0 + .5 + rnd() * (TW - 1), z = z0 + .5 + rnd() * (TD - 1), h = hAt(x, z), town = inTown(x, z);
      if (!(town || inVillage(x, z)) || h < .4 || riverProx(x, z) < 2.3) continue;
      const gx = town ? (Math.floor(x / .62) + .58) * .62 : x, gz = town ? (Math.floor(z / .62) + .58) * .62 : z;     // 城鎮的房子排在街廓裡
      if ([...houses, ...towers].some(o => Math.hypot(o[0] - gx, o[2] - gz) < .5)) continue;
      (town && rnd() < .28 ? towers : houses).push([gx, hAt(gx, gz), gz, rnd()]);
    }
    const place = (geo, list, f) => { if (!list.length) return; const im = new T.InstancedMesh(geo, propMat, list.length); list.forEach((o, k) => { f(o, k); im.setMatrixAt(k, M); im.setColorAt(k, col); }); grp.add(U.shadowed(im)); };
    place(houseGeo, houses, o => { Q.setFromAxisAngle(V.set(0, 1, 0), inTown(o[0], o[2]) ? (o[3] < .5 ? 0 : Math.PI / 2) : o[3] * 6.28); M.compose(V.set(o[0] - cx, o[1] - .04, o[2] - cz), Q, S.setScalar(.82 + o[3] * .25)); col.setHSL(.08, .15, .86 + o[3] * .14); });
    place(towerGeo, towers, o => { M.compose(V.set(o[0] - cx, o[1] - .04, o[2] - cz), Q.identity(), S.set(1, .7 + o[3] * .9, 1)); col.setHSL(.58, .1, .85 + o[3] * .15); });

    // 各區的小地標（會動的放進 anim）
    const put = (mesh, x, z, dy = 0) => { mesh.position.set(x - cx, hAt(x, z) + dy, z - cz); grp.add(U.shadowed(mesh)); return mesh; };
    if (def.id === 'rocks') {       // 火山口的熔岩光與煙
      const glow = put(new T.Mesh(new T.CircleGeometry(.72, 24), new T.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false })), -15, -5, .1); glow.rotation.x = -Math.PI / 2; glow.castShadow = false;
      anim.push(t => glow.material.color.setHSL(.06, 1, .52 + Math.sin(t * 3) * .08));
      const sm = new T.MeshStandardMaterial({ color: 0xd9d4cc, transparent: true, opacity: .82, roughness: 1 }), sg = new T.IcosahedronGeometry(.45, 2);
      for (let k = 0; k < 9; k++) { const p = put(new T.Mesh(sg, sm), -15, -5); p.castShadow = false; const y0 = p.position.y; anim.push(t => { const u = ((t * .2 + k / 9) % 1); p.position.y = y0 + .3 + u * 4; p.position.x = -15 - cx + u * u * 1.6 + Math.sin(k * 2.1) * .18; p.position.z = -5 - cz + Math.cos(k * 1.7) * .15; p.scale.setScalar(.3 + u * 1.7); p.visible = u < .96; }); }
    }
    if (def.id === 'minerals') {    // 採石坑裡的晶體
      const cm = [0xb388ff, 0xfff3b0, 0x9be7ff, 0xffb3c7];
      for (let k = 0; k < 9; k++) { const a = k * 2.4, r = .2 + (k % 3) * .26, m = put(new T.Mesh(new T.OctahedronGeometry(.16 + (k % 3) * .07), new T.MeshStandardMaterial({ color: cm[k % 4], roughness: .1, metalness: .25, emissive: cm[k % 4], emissiveIntensity: .25, flatShading: true })), QX + Math.cos(a) * r, 8.3 + Math.sin(a) * r, .2); m.scale.y = 1.9; m.rotation.set(Math.sin(k) * .4, k, Math.cos(k) * .4); anim.push(t => m.material.emissiveIntensity = .25 + .2 * Math.sin(t * 2 + k)); }
    }
    if (def.id === 'weather') {     // 風化的圓石、裂成兩半的岩石，以及礫石、砂、土壤三堆（與區內場景呼應）
      for (let k = 0; k < 22; k++) { const x = 2.4 + rnd() * 9.6, z = -9.3 + rnd() * 7.8, m = put(new T.Mesh(new T.IcosahedronGeometry(.14 + rnd() * .28, 1), rockMat), x, z, .04); m.rotation.set(rnd() * 3, rnd() * 3, 0); m.scale.set(1, .7, .85 + rnd() * .3); }
      { const g = new T.Group(); for (const s of [-1, 1]) { const m = new T.Mesh(new T.IcosahedronGeometry(.34, 1), rockMat); m.scale.set(.46, .8, .9); m.position.set(s * .2, .2, 0); m.rotation.set(0, s * .25, -s * .22); g.add(U.shadowed(m)); } put(g, 8.2, -3.2); }
      [[0x8f8a83, .26, .13], [0xd9c48f, .23, .1], [0x6b4a34, .25, .09]].forEach(([c, r, hh], k) => { const m = put(new T.Mesh(new T.ConeGeometry(r, hh * 2, 12), new T.MeshStandardMaterial({ color: c, roughness: 1, bumpMap: detail, bumpScale: 3 })), 4.8 + k * .62, -5.6, hh * .8); m.castShadow = false; });
    }
    if (def.id === 'coast') {       // 海蝕柱、海蝕門、岬角上的蕈狀岩、燈塔、海上的小船
      const cm = new T.MeshStandardMaterial({ color: 0xbfa57a, roughness: 1, flatShading: true, bumpMap: detail, bumpScale: 2 });
      for (const [x, z, s] of [[18.7, -3.1, 1], [19.2, -2.4, .65], [18.9, -9.1, .8]]) for (let k = 0; k < 4; k++) { const m = new T.Mesh(new T.CylinderGeometry((.3 - k * .04) * s, (.36 - k * .04) * s, .36 * s, 8), cm); m.position.set(x - cx + Math.sin(k * 2) * .04, -.45 + (k + .5) * .36 * s, z - cz); m.rotation.y = k; grp.add(U.shadowed(m)); }
      const arch = new T.Mesh(new T.TorusGeometry(.5, .17, 7, 12, Math.PI), cm); arch.position.set(18.9 - cx, -.1, -7.6 - cz); arch.rotation.y = .5; arch.scale.set(1, 1.15, 1.4); grp.add(U.shadowed(arch));
      for (const [x, z, s] of [[17.3, -5.5, 1], [17.6, -6.7, .8], [16.9, -7.4, .65]]) { const g = new T.Group(), stem = new T.Mesh(new T.CylinderGeometry(.08, .15, .4, 8), cm), cap = new T.Mesh(new T.IcosahedronGeometry(.25, 1), new T.MeshStandardMaterial({ color: 0x8c7355, roughness: 1, flatShading: true })); stem.position.y = .2; cap.position.y = .48; cap.scale.y = .68; g.add(U.shadowed(stem), U.shadowed(cap)); g.scale.setScalar(s); put(g, x, z); }
      const lh = new T.Group(), wm = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .7 }), rm = new T.MeshStandardMaterial({ color: 0xc8372d, roughness: .7 });
      const a = new T.Mesh(new T.CylinderGeometry(.07, .11, .6, 10), wm), b = new T.Mesh(new T.CylinderGeometry(.09, .09, .1, 10), rm), c = new T.Mesh(new T.ConeGeometry(.1, .12, 10), rm); a.position.y = .3; b.position.y = .64; c.position.y = .75; lh.add(U.shadowed(a), U.shadowed(b), U.shadowed(c)); put(lh, 16.4, -6.3);
      const boat = new T.Group(), hull = new T.Mesh(new T.BoxGeometry(.34, .08, .13), new T.MeshStandardMaterial({ color: 0x8a4b2a })), sail = new T.Mesh(new T.ConeGeometry(.11, .3, 3), new T.MeshStandardMaterial({ color: 0xffffff })); sail.position.y = .2; boat.add(hull, sail); boat.position.set(18.3 - cx, .03, 2.2 - cz); grp.add(boat);
      anim.push(t => { boat.position.y = .03 + Math.sin(t * 1.6) * .025; boat.rotation.z = Math.sin(t * 1.3) * .08; });
    }
    if (def.id === 'hazard') {      // 崩落的石塊
      for (let k = 0; k < 20; k++) { const x = -5.5 + rnd() * 2.4, z = -5.6 + rnd() * 2.3, m = put(new T.Mesh(new T.IcosahedronGeometry(.08 + rnd() * .2, 0), rockMat), x, z, .04); m.rotation.set(rnd() * 3, rnd() * 3, 0); }
    }
    if (def.id === 'use') {         // 城鎮裡跨河的橋
      const bx = 1.5, bz = riverZ(bx), bw = riverW(bx) * 2 + .9, y = hAt(bx, bz - bw / 2) + .1, bm = new T.MeshStandardMaterial({ color: 0xd9d6cf, roughness: .8 });
      const deck = new T.Mesh(new T.BoxGeometry(.34, .06, bw), bm); deck.position.set(bx - cx, y, bz - cz); grp.add(U.shadowed(deck));
      for (const s of [-.3, 0, .3]) { const p = new T.Mesh(new T.BoxGeometry(.1, .5, .1), bm); p.position.set(bx - cx, y - .26, bz - cz + s * bw); grp.add(U.shadowed(p)); }
    }
    if (def.id === 'spheres') {     // 雲（大氣圈）
      for (let k = 0; k < 2; k++) { const c = U.cloud(3.2 - k * .8, 1.1, 2.2, 14, rnd); c.position.set(-1.5 + k * 3.2, 7.4 + k * .9, 1.2 - k * 3.4); grp.add(c); anim.push(t => c.position.x = -1.5 + k * 3.2 + Math.sin(t * .22 + k * 2) * 1.2); }
    }
    tiles.push({ def, grp, lift: 0, want: 0, top });
  }
  // 高空飄過的雲
  const crnd = U.rng(42);
  for (let k = 0; k < 3; k++) { const c = U.cloud(4.5, 1.3, 3, 16, crnd); c.position.set(-8 + k * 13, 11 + k * .8, -7 + k * 4.5); scene.add(c); anim.push(t => c.position.x = ((-8 + k * 13 + t * .35 + 30) % 60) - 30); }

  /* ---- 懸停／選取 ---- */
  let sel = null; const card = G.$('#zoneCard');
  const select = id => {
    if (sel === id) return; sel = id;
    for (const t of tiles) { t.want = t.def.id === id ? 1 : 0; if (t.label) t.label.el.classList.toggle('hi', t.def.id === id); }
    if (!id) { card.classList.remove('show'); return; }
    const d = G.zoneDef(id); card.style.setProperty('--c', d.color);
    card.innerHTML = `<div class="n">${d.num}</div><h3>${d.title}</h3><p>${d.desc}</p><button ${d.file ? '' : 'disabled'}>${d.file ? '進入 →' : '製作中'}</button>`;
    U.tidy(card); card.querySelector('button').onclick = () => G.enterZone(id); card.classList.add('show');
  };
  const hit = ray => { if (!ray) return null; const h = ray.intersectObjects(tiles.map(t => t.grp), true)[0]; if (!h) return null; let o = h.object; while (o && !o.userData.zoneId) o = o.parent; return o ? o.userData.zoneId : null; };

  return {
    scene, home: { pos: [0, 28, 41], target: [0, 2.2, 1] },
    view: { minDist: 8, maxDist: 95, maxPolar: Math.PI * .46, pan: { x: [-20, 20], y: [-4, 7], z: [-10, 10] } },
    mount() {                        // 每次回到大地圖時重新掛上標籤（地形只建立一次）
      sel = null;
      for (const t of tiles) { const d = t.def; t.want = t.lift = 0;
        t.label = G.addLabel(`<b>${d.num}</b>${d.short}`, 'zone' + (d.file ? '' : ' soon'), [t.grp.position.x, t.top + 1.0, t.grp.position.z], {
          color: d.color, dy: () => t.grp.position.y, onEnter: () => select(d.id),
          onClick: () => { if (sel === d.id && d.file) G.enterZone(d.id); else select(d.id); } }); }
    },
    onHover: ray => { const id = hit(ray); if (ray) select(id); G.canvas.style.cursor = id ? 'pointer' : ''; },
    onTap: (ray, type) => { const id = hit(ray); if (!id) return select(null); if (type === 'mouse' || sel === id) { select(id); if (G.zoneDef(id).file) G.enterZone(id); else G.toast('「' + G.zoneDef(id).title + '」會在後續階段開放'); } else select(id); },
    update(dt, t) {
      riverTex.offset.x -= dt * .35;
      for (const f of anim) f(t);
      for (const o of tiles) {          // 被選到的區塊：浮起、輕輕晃動
        o.lift += (o.want - o.lift) * Math.min(1, dt * 7); const l = o.lift;
        o.grp.position.y = l * (1.7 + Math.sin(t * 2.6) * .14);
        o.grp.rotation.z = Math.sin(t * 1.9) * .014 * l; o.grp.rotation.x = Math.cos(t * 1.5) * .012 * l;
        o.grp.scale.setScalar(1 + .025 * l);
      }
    },
    dispose() { G.canvas.style.cursor = ''; card.classList.remove('show'); }      // 大地圖保留在記憶體，不釋放
  };
};
})();
