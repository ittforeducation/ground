/* 探索大地變化 — 介面模組：知識面板（認識／圖鑑／探究／挑戰）、POE 探究、檢核、學習紀錄匯出 */
(function () {
'use strict';
const G = window.GROUND, U = G.util, $ = G.$;
const LV = ['', '提取訊息', '推論訊息', '詮釋整合', '比較評估'];   // PIRLS 四層次

/* ---------- 學習紀錄（存在這台裝置的瀏覽器） ---------- */
const KEY = 'ground.record.v1';
const R = G.rec = {
  data: (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })(),
  save() { try { localStorage.setItem(KEY, JSON.stringify(R.data)); } catch (e) {} },
  poe(id) { return (R.data.poe || {})[id]; },
  setPoe(id, v) { (R.data.poe = R.data.poe || {})[id] = v; R.save(); },
  quiz(id) { return (R.data.quiz || {})[id]; },
  setQuiz(id, v) { (R.data.quiz = R.data.quiz || {})[id] = v; R.save(); },
};
const now = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 知識面板 ---------- */
const panel = $('#panel'), body = $('#pBody'), tabs = $('#pTabs');
let cur = null, tab = 'learn';
const ui = G.ui = {};
ui.openPanel = (z, n) => {
  cur = { z, n }; const def = G.zoneDef(z.id);
  panel.style.setProperty('--c', n.color || def.color);
  $('#pNum').textContent = n.num; $('#pEn').textContent = n.en || ''; $('#pTitle').textContent = n.title;
  panel.classList.add('open'); show('learn');
};
ui.closePanel = () => { if (!panel.classList.contains('open')) return; panel.classList.remove('open'); cur = null; if (G.state.mode === 'zone') G.closeNode(); };
$('#pClose').onclick = ui.closePanel;

function show(t) {
  const { z, n } = cur, qs = n.isQuiz ? z.quiz : [];
  if (n.isQuiz) t = 'quiz';
  tab = t;
  const done = { poe: !!R.poe(z.id + '/' + n.id), quiz: qs.length && qs.every(q => R.quiz(q.id)) };
  const list = n.isQuiz ? [] : [['learn', '認識'], ['cards', '圖鑑'], ['poe', '探究']].filter(x => x[0] === 'learn' || (x[0] === 'cards' ? n.cards : n.poe));
  if (list.length && n.overview) list.splice(1, 0, ['overview', n.overview.label || '總覽']);      // 總覽：不切換分頁，改開橫式彈窗
  tabs.style.display = list.length ? '' : 'none';
  tabs.innerHTML = list.map(([k, s]) => `<button data-t="${k}" class="${k === t ? 'on' : ''}">${s}${done[k] ? '<span class="ok">✓</span>' : ''}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => b.dataset.t === 'overview' ? wide(n.overview) : show(b.dataset.t));
  body.scrollTop = 0;
  if (t === 'learn') { body.innerHTML = n.learn + (n.poe ? '<button class="cta" data-go="poe">動手探究 →</button>' : ''); }
  if (t === 'cards') body.innerHTML = (n.cardsIntro || '') + n.cards.map(card).join('');
  if (t === 'poe') {
    const r = R.poe(z.id + '/' + n.id);
    body.innerHTML = `<h3>探究問題</h3><p>${n.poe.question}</p>
      <div class="tip">探究三步驟：先<b>預測</b>，再<b>觀察</b>，最後<b>解釋</b>。猜錯沒關係，重要的是用觀察到的證據來說明！</div>
      ${r ? `<p>✅ 你已經完成探究（${r.time}）。<br>你的預測：${esc(r.predict)}</p>` : ''}
      <button class="cta" data-go="startpoe">${r ? '再探究一次' : '開始探究'}</button>`;
  }
  if (t === 'quiz') return quiz(qs);
  U.tidy(body);
  body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => b.dataset.go === 'startpoe' ? poe() : show(b.dataset.go));
  wirePhotos();
  if (t === 'cards' && n.onCards) n.onCards(body);      // 區域可自訂字卡的呈現（例：minerals 的分頁字卡）
}
ui.show = t => { if (cur) show(t); }; ui.tab = () => tab;

/* 圖鑑卡：預設顯示 SVG 繪圖；若 img/ 資料夾放了同名照片就自動顯示實物照（可切換） */
function card(c) {
  if (c.html) return c.html;      // 自訂內容的字卡（例：總覽表）
  return `<div class="rcard"><div class="pic">${c.svg}<img data-src="${c.photo}" alt="${c.name}實物照片"><button class="sw">看繪圖</button></div>
    <div class="bd"><h4>${c.name}<span class="en">${c.en || ''}</span></h4><dl>${c.facts.map(f => `<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join('')}</dl></div></div>`;
}
function wirePhotos() {
  body.querySelectorAll('.pic img[data-src]').forEach(img => {
    const pic = img.parentNode, sw = pic.querySelector('.sw');
    img.onload = () => pic.classList.add('photo'); img.onerror = () => img.remove();
    img.src = img.dataset.src;
    sw.onclick = () => { const d = pic.classList.toggle('draw'); sw.textContent = d ? '看實物照' : '看繪圖'; };
  });
}

/* ---------- 檢核（挑戰） ---------- */
const shuffle = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function quiz(qs, i = 0, fresh = false) {
  if (!fresh && i === 0) { const k = qs.findIndex(q => !R.quiz(q.id)); if (k < 0) return quizEnd(qs); i = k; }
  const q = qs[i], ord = shuffle(q.opts.length), dots = qs.map((x, k) => { const r = R.quiz(x.id); return `<i class="${k === i ? 'cur ' : ''}${r && (k < i || !fresh) ? (r.ok ? 'ok' : 'no') : ''}"></i>`; }).join('');
  body.innerHTML = `<div class="q-top"><span class="lv lv${q.level}">第 ${q.level} 層　${LV[q.level]}</span><div class="q-dots">${dots}</div></div>
    <p class="q-stem">${i + 1}. ${q.q}</p>${ord.map((k, d) => `<button class="opt" data-k="${k}">${'ABCD'[d]}　${q.opts[k]}</button>`).join('')}<div id="qWhy"></div>`;
  U.tidy(body);
  body.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const k = +b.dataset.k, ok = k === q.ans;
    body.querySelectorAll('.opt').forEach(o => { const j = +o.dataset.k; o.disabled = true; if (j === q.ans) o.classList.add('right'); else if (j === k) o.classList.add('wrong'); });
    R.setQuiz(q.id, { zone: G.zoneDef(cur.z.id).title, node: q.about || '', level: q.level, q: q.q, pick: q.opts[k], right: q.opts[q.ans], ok, time: now() });
    const w = $('#qWhy'); w.innerHTML = `<div class="why"><b class="${ok ? 'ok' : 'no'}">${ok ? '答對了！' : '再想想：'}</b>${q.why}</div><button class="cta">${i < qs.length - 1 ? '下一題 →' : '看結果'}</button>`;
    U.tidy(w); w.querySelector('button').onclick = () => i < qs.length - 1 ? quiz(qs, i + 1, true) : quizEnd(qs);
    w.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}
function quizEnd(qs) {
  const ok = qs.filter(q => (R.quiz(q.id) || {}).ok).length;
  body.innerHTML = `<h3>挑戰完成！</h3><div class="stat"><div><b>${ok} / ${qs.length}</b>答對題數</div></div>
    <p>${ok === qs.length ? '全部答對，太厲害了！' : '答錯的題目可以回到各節點的「認識」和「探究」找線索，再挑戰一次。'}</p>
    <button class="cta" id="qAgain">再挑戰一次</button><button class="cta ghost" id="qRec">看我的學習紀錄</button>`;
  $('#qAgain').onclick = () => quiz(qs, 0, true); $('#qRec').onclick = ui.openRecords;
}
function show_tabs_refresh() { const b = tabs.querySelector('[data-t="quiz"]'); if (b && !b.querySelector('.ok')) b.insertAdjacentHTML('beforeend', '<span class="ok">✓</span>'); }

/* ---------- 彈窗 ---------- */
const modal = $('#modal'), mBody = $('#mBody'); let onClose = null;
const openModal = html => { mBody.innerHTML = html; modal.classList.add('open'); modal.querySelector('.sheet').scrollTop = 0; };
const closeModal = () => { modal.classList.remove('open', 'dark'); modal.querySelector('.sheet').classList.remove('wide'); mBody.innerHTML = ''; if (onClose) { const f = onClose; onClose = null; f(); } };
$('#mClose').onclick = closeModal;
// 橫式大彈窗（背景變暗）：用於各節點的「總覽」比較表
function wide(o) { openModal(o.html); modal.classList.add('dark'); modal.querySelector('.sheet').classList.add('wide'); if (o.onOpen) o.onOpen(mBody, closeModal); }

/* ---------- POE 探究：預測 → 觀察 → 解釋 ---------- */
function poe() {
  const { z, n } = cur, P = n.poe, st = { predict: null };
  const head = s => `<h2>探究：${n.title}</h2><div class="steps">${['① 預測', '② 觀察', '③ 解釋'].map((x, k) => `<span class="${k === s ? 'on' : k < s ? 'done' : ''}">${x}</span>`).join('')}</div>`;
  const step1 = () => {
    openModal(head(0) + `<p class="q-stem">${P.question}</p>${P.options.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join('')}
      <button class="cta" id="pGo" disabled>我預測好了，去觀察 →</button>`); U.tidy(mBody);
    mBody.querySelectorAll('.opt').forEach(b => b.onclick = () => { mBody.querySelectorAll('.opt').forEach(o => o.classList.remove('sel')); b.classList.add('sel'); st.predict = P.options[+b.dataset.k]; $('#pGo').disabled = false; });
    $('#pGo').onclick = step2;
  };
  const step2 = () => {
    openModal(head(1) + `<p>${P.observeIntro}</p><div id="obs"></div><button class="cta" id="oGo" disabled>我觀察完了，來解釋 →</button>`); U.tidy(mBody);
    const stop = P.observe($('#obs'), () => { $('#oGo').disabled = false; });
    onClose = stop || null; $('#oGo').onclick = () => { if (stop) stop(); onClose = null; step3(); };
  };
  const step3 = () => {
    const E = P.explain;
    openModal(head(2) + `<p>你的預測是：<b>${esc(st.predict)}</b></p><p class="q-stem">${E.q}</p>${E.opts.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join('')}<div id="eWhy"></div>`); U.tidy(mBody);
    mBody.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const k = +b.dataset.k, ok = k === E.ans; b.classList.add(ok ? 'right' : 'wrong');
      if (!st.first) st.first = E.opts[k];
      if (!ok) { $('#eWhy').innerHTML = `<div class="why"><b class="no">再想想：</b>${E.hint}</div>`; return; }
      mBody.querySelectorAll('.opt').forEach(o => o.disabled = true);
      R.setPoe(z.id + '/' + n.id, { zone: G.zoneDef(z.id).title, node: n.title, question: P.question, predict: st.predict, explain: st.first, explainOk: st.first === E.opts[E.ans], time: now() });
      $('#eWhy').innerHTML = `<div class="why"><b class="ok">說得好！</b>${E.why}</div><div class="tip"><b>回頭看看你的預測：</b>和觀察到的結果一樣嗎？不一樣也沒關係，科學家就是靠證據來修正想法的。</div>
        <div class="row"><button class="cta ghost" id="eAgain">再觀察一次</button><button class="cta green" id="eDone">完成探究</button></div>`;
      U.tidy($('#eWhy')); $('#eAgain').onclick = step2; $('#eDone').onclick = () => { closeModal(); show('poe'); G.toast('探究完成！逛完各節點後，試試下方的「本區挑戰」', 3200); };
    });
  };
  step1();
}

/* ---------- 圖解放大：面板與彈窗裡的繪圖、照片，點一下就放大到畫面中央（再點一下、按 ✕ 或 Esc 關閉）；圖鑑卡的圖會連同說明文字一起呈現 ---------- */
const zoom = document.createElement('div'); zoom.id = 'zoom'; zoom.innerHTML = '<button id="zClose" aria-label="關閉">✕</button><div id="zBox"></div>'; document.body.appendChild(zoom);
const closeZoom = () => { zoom.classList.remove('open'); $('#zBox').innerHTML = ''; };
/* 找出一張圖對應的說明文字，放大時放在圖的右邊（直式畫面放在下面）：
   ① 圖鑑卡的圖 → 同一張卡的說明；② 表格裡的圖 → 同一欄各列的內容；③ 認識頁的圖解 → 同一個小節（或同一則延伸）的文字 */
function zoomText(el) {
  const strip = n => { n.querySelectorAll('svg, img, canvas, button, details').forEach(x => x.remove()); n.querySelectorAll('[id]').forEach(x => x.removeAttribute('id')); return n; };
  const wrap = (title, parts) => { const d = document.createElement('div'); d.className = 'rcard'; d.innerHTML = `<div class="bd">${title ? `<h4>${esc(title)}</h4>` : ''}</div>`; parts.forEach(x => d.firstChild.appendChild(x)); return d; };
  const card = el.closest('.rcard');
  if (card) { const t = card.cloneNode(true); t.querySelectorAll('.pic').forEach(x => x.remove()); t.removeAttribute('style'); t.className = 'rcard'; return t; }
  const cell = el.closest('td, th'), table = cell && cell.closest('table');
  if (table) {
    const ci = cell.cellIndex, rows = [...table.rows], n = rows[0].cells.length, dl = document.createElement('dl'); if (!ci || rows.length < 2) return null;
    for (const r of rows.slice(1)) { if (r.cells.length !== n) continue; const c = strip(r.cells[ci].cloneNode(true)); if (!c.textContent.trim()) continue; dl.insertAdjacentHTML('beforeend', `<dt>${esc(r.cells[0].textContent.trim())}</dt><dd>${c.innerHTML}</dd>`); }
    return dl.children.length ? wrap(rows[0].cells[ci].textContent.trim(), [dl]) : null;
  }
  const root = el.closest('#pBody, #mBody'), det = el.closest('details'), top = det || root; if (!top) return null;
  let blk = el; while (blk.parentNode && blk.parentNode !== top) blk = blk.parentNode; if (blk.parentNode !== top) return null;
  let title = '', items = [];
  if (det) { title = (det.querySelector('summary') || {}).textContent || ''; items = [...det.children].filter(x => x.tagName !== 'SUMMARY'); }
  else { let a = blk; while (a.previousElementSibling && !/^H[23]$/.test(a.tagName)) a = a.previousElementSibling; if (/^H[23]$/.test(a.tagName)) { title = a.textContent; a = a.nextElementSibling; }
    for (; a && !/^H[23]$/.test(a.tagName); a = a.nextElementSibling) items.push(a); }
  const parts = []; if (el.parentNode !== top) { const cap = strip(el.parentNode.cloneNode(true)); if (cap.textContent.trim()) { const p = document.createElement('p'); p.className = 'zcap'; p.textContent = cap.textContent.trim(); parts.push(p); } }      // 圖自己的圖說
  for (const x of items) { if (x.contains(el)) continue; const c = strip(x.cloneNode(true)); if (c.textContent.trim() && !c.matches('svg, button, details')) parts.push(c); }
  return parts.length ? wrap(title.trim(), parts) : null;
}
ui.zoom = el => {
  const box = $('#zBox'), c = el.cloneNode(true); let r = 1.6; c.removeAttribute('style'); c.removeAttribute('width'); c.removeAttribute('height');
  if (c.tagName.toLowerCase() === 'svg') { const vb = (c.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number); if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) r = vb[2] / vb[3]; } else if (el.naturalWidth) r = el.naturalWidth / el.naturalHeight;
  const pic = document.createElement('div'); pic.className = 'zpic'; pic.appendChild(c);
  box.innerHTML = ''; box.style.setProperty('--r', r); box.appendChild(pic);
  const txt = zoomText(el), has = !!(txt && txt.textContent.trim()); box.classList.toggle('has', has);
  if (has) { txt.classList.add('ztxt'); txt.addEventListener('click', e => e.stopPropagation()); box.appendChild(txt); txt.scrollTop = 0; }
  zoom.classList.add('open');
};
zoom.addEventListener('click', closeZoom);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && zoom.classList.contains('open')) closeZoom(); });
document.addEventListener('click', e => {
  if (!e.target.closest || e.target.closest('button, a, summary, #zoom')) return;
  const t = e.target.closest('#pBody svg, #mBody svg, #pBody .pic img, #mBody .pic img'); if (t) ui.zoom(t);
});

/* ---------- 學習紀錄與匯出 ---------- */
ui.openRecords = () => {
  const qz = Object.values(R.data.quiz || {}), pe = Object.values(R.data.poe || {}), who = R.data.who || {};
  const by = [1, 2, 3, 4].map(l => { const a = qz.filter(q => q.level === l); return `<div><b>${a.filter(q => q.ok).length} / ${a.length}</b>第 ${l} 層 ${LV[l]}</div>`; }).join('');
  openModal(`<h2>我的學習紀錄</h2>
    <div class="rec-form"><input id="wClass" placeholder="班級" value="${esc(who.cls || '')}"><input id="wNo" placeholder="座號" value="${esc(who.no || '')}"><input id="wName" placeholder="姓名" value="${esc(who.name || '')}"></div>
    <div class="stat"><div><b>${pe.length}</b>完成的探究</div><div><b>${qz.filter(q => q.ok).length} / ${qz.length}</b>答對 / 已作答</div></div>
    <div class="stat">${by}</div>
    ${pe.length ? `<h3>探究</h3><table class="rec"><tr><th>節點</th><th>我的預測</th><th>我的解釋</th></tr>${pe.map(p => `<tr><td>${esc(p.node)}</td><td>${esc(p.predict)}</td><td>${p.explainOk ? '✅' : '🔁'} ${esc(p.explain)}</td></tr>`).join('')}</table>` : ''}
    ${qz.length ? `<h3>挑戰題</h3><table class="rec"><tr><th>區域</th><th>層次</th><th>題目</th><th>我的答案</th></tr>${qz.map(q => `<tr><td>${esc(q.zone)}</td><td>${q.level}</td><td>${esc(q.q)}</td><td>${q.ok ? '✅' : '❌'} ${esc(q.pick)}</td></tr>`).join('')}</table>` : '<p>還沒有作答紀錄，先去探索吧！</p>'}
    <div class="row" style="margin-top:14px"><button class="cta" id="rDown">下載紀錄檔（.csv）</button><button class="cta ghost" id="rShare">分享／寄出</button><button class="cta ghost" id="rCopy">複製成文字</button></div>
    <p style="font-size:13px;color:var(--sub);margin:10px 0 0">紀錄只存在這台裝置的瀏覽器裡。<button id="rClear" style="border:0;background:none;color:var(--bad);font-weight:800;text-decoration:underline;padding:0">清除全部紀錄</button></p>`);
  const who2 = () => { R.data.who = { cls: $('#wClass').value.trim(), no: $('#wNo').value.trim(), name: $('#wName').value.trim() }; R.save(); return R.data.who; };
  const rows = () => { const w = who2(), a = [['班級', w.cls, '座號', w.no, '姓名', w.name, '匯出時間', now()], [], ['類型', '區域', '節點', 'PIRLS層次', '題目', '作答', '正確答案', '是否正確', '時間']];
    pe.forEach(p => a.push(['探究-預測', p.zone, p.node, '', p.question, p.predict, '', '', p.time], ['探究-解釋', p.zone, p.node, '', p.question, p.explain, '', p.explainOk ? '是' : '否', p.time]));
    qz.forEach(q => a.push(['挑戰題', q.zone, q.node, q.level + ' ' + LV[q.level], q.q, q.pick, q.right, q.ok ? '是' : '否', q.time])); return a; };
  const csv = () => '﻿' + rows().map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const fname = () => { const w = who2(); return '大地變化_學習紀錄_' + [w.cls, w.no, w.name].filter(Boolean).join('_') + '.csv'; };
  const text = () => rows().map(r => r.filter(c => c !== '' && c != null).join('｜')).join('\n');
  $('#rDown').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv()], { type: 'text/csv' })); a.download = fname(); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
  $('#rShare').onclick = async () => {
    try { const f = new File([csv()], fname(), { type: 'text/csv' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: '大地變化學習紀錄' });
      else if (navigator.share) await navigator.share({ title: '大地變化學習紀錄', text: text() });
      else G.toast('這台裝置不支援分享，請改用「下載」或「複製」');
    } catch (e) {}
  };
  $('#rCopy').onclick = async () => { try { await navigator.clipboard.writeText(text()); G.toast('已複製，可以貼到 Email 或訊息裡'); } catch (e) { G.toast('複製失敗，請改用「下載紀錄檔」'); } };
  $('#rClear').onclick = () => { if (confirm('確定要清除這台裝置上的全部學習紀錄嗎？')) { R.data = {}; R.save(); closeModal(); G.toast('已清除'); } };
};
})();
