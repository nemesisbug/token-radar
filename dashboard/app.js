// Token Launch Radar — board, filters, detail view, live table, model sandbox.
// Static page: every number comes from window.RADAR (data.js, written by
// main.ts from the sealed snapshot). No fetch, no network, no framework.
// ?shot=board (default) | ?shot=detail&slug=<slug> | ?shot=filtered
// sets window.__shotReady when the view is painted, for screenshots.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.body.textContent = 'No radar data (data.js missing).'; return; }
  var MODEL = D.model;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(v) {
    if (v == null || !isFinite(v)) return '—';
    var s = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return s;
  }
  function pctCls(v) {
    if (v == null) return 'flat';
    return v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  }
  function ageFmt(a) {
    if (a == null) return '—';
    if (a >= 365) return (a / 365).toFixed(1) + 'y';
    return a + 'd';
  }
  function signal(r) {
    var g = r.change_7d;
    if (g == null) return { cls: 'steady', label: '—' };
    if (g >= 15) return { cls: 'hot', label: '▲ Surging' };
    if (g >= 5) return { cls: 'warm', label: '▲ Warming' };
    if (g > -5) return { cls: 'steady', label: '● Steady' };
    return { cls: 'cool', label: '▼ Cooling' };
  }
  function clampGrowth(g) { return Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, g == null ? 0 : g)); }

  // The model, in the page, so the sandbox runs the same formula as main.ts:
  // implied = TVL x base x (1 + growth x weight) x maturity x breadth.
  function score(r, base, weight, floor) {
    var growth = clampGrowth(r.change_7d);
    var gm = 1 + (growth / 100) * weight;
    var age = r.age_days == null ? MODEL.unknown_age_days : r.age_days;
    var mm = floor + (Math.min(Math.max(age, 0), MODEL.maturity_days) / MODEL.maturity_days) * (1 - floor);
    var extra = Math.min(Math.max(r.chains.length - 1, 0), MODEL.breadth_max_extra_chains);
    var bm = 1 + extra * MODEL.breadth_step;
    return { implied: Math.max(1, Math.round(r.tvl_usd * base * gm * mm * bm)), gm: gm, mm: mm, bm: bm };
  }

  var state = { q: '', scope: 'all', cat: '', chain: '', mintvl: 0, sort: 'implied' };
  var sandbox = null; // {base, weight, floor} once a slider moves off radar-2
  var maxImplied = Math.max.apply(null, D.rows.map(function (r) { return r.implied_value_usd; }));

  function shownValue(r) {
    return sandbox ? score(r, sandbox.base, sandbox.weight, sandbox.floor).implied : r.implied_value_usd;
  }
  function filtered() {
    var q = state.q.toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
      if (state.scope === 'watchlist' && !r.on_watchlist) return false;
      if (state.scope === 'early' && r.on_watchlist) return false;
      if (state.cat && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (r.tvl_usd < state.mintvl) return false;
      return true;
    });
    var by = state.sort;
    rows.sort(function (a, b) {
      if (by === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (by === 'growth') return (b.change_7d == null ? -1e9 : b.change_7d) - (a.change_7d == null ? -1e9 : a.change_7d);
      if (by === 'age') return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days);
      if (by === 'name') return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      return shownValue(b) - shownValue(a);
    });
    return rows;
  }

  function rowHtml(r) {
    var s = signal(r);
    var v = shownValue(r);
    var w = Math.max(2, Math.round((v / maxImplied) * 100));
    return '<tr tabindex="0" data-slug="' + esc(r.slug) + '">' +
      '<td class="num rank' + (r.rank <= 3 ? ' top' : '') + '">' + r.rank + '</td>' +
      '<td><span class="pname">' + esc(r.name) + '</span>' +
      (r.on_watchlist ? '<span class="badge">WATCHLIST</span>' : '') +
      '<br><span class="pslug">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num ' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + ageFmt(r.age_days) + '</td>' +
      '<td class="num"><b>' + money(v) + '</b><span class="vbar"><i style="width:' + w + '%"></i></span></td>' +
      '<td class="sig ' + s.cls + '">' + s.label + '</td></tr>';
  }

  function renderRows() {
    var rows = filtered();
    $('rows').innerHTML = rows.map(rowHtml).join('');
    $('empty').hidden = rows.length > 0;
    $('count').textContent = 'Showing ' + rows.length + ' of ' + D.rows.length + ' rows' + (sandbox ? ' · sandbox values' : '');
  }

  function renderStats() {
    var gs = D.rows.map(function (r) { return r.change_7d; }).filter(function (g) { return g != null; }).sort(function (a, b) { return a - b; });
    var med = gs.length ? gs[Math.floor(gs.length / 2)] : null;
    var cells = [
      [D.protocols_total, 'Protocols scanned'],
      [D.watchlist_size, 'On the watchlist'],
      [D.board_size, 'Rows on the board'],
      [money(D.total_implied_usd), 'Total implied value'],
      [med == null ? '—' : pct(med), 'Median 7-day growth'],
      [D.live_total, 'Live tokens set aside'],
    ];
    $('stats').innerHTML = cells.map(function (c, i) {
      return '<div class="stat' + (i === 3 ? ' hot' : '') + '"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>';
    }).join('');
    $('asof').textContent = 'snapshot ' + D.as_of;
    $('src').textContent = 'Source: ' + D.source + '.';
  }

  function renderFilters() {
    var cats = {};
    D.rows.forEach(function (r) { cats[r.category || 'Uncategorised'] = (cats[r.category || 'Uncategorised'] || 0) + 1; });
    $('cat').innerHTML = '<option value="">All categories</option>' + Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + ' (' + cats[c] + ')</option>';
    }).join('');
    var ch = {};
    D.rows.forEach(function (r) { r.chains.forEach(function (c) { ch[c] = (ch[c] || 0) + 1; }); });
    $('chain').innerHTML = '<option value="">All chains</option>' + Object.keys(ch).filter(function (c) { return ch[c] >= 2; }).sort(function (a, b) { return ch[b] - ch[a]; }).slice(0, 24).map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + ' (' + ch[c] + ')</option>';
    }).join('');
  }

  function renderLive() {
    $('liveRows').innerHTML = D.live.map(function (p) {
      return '<tr><td><span class="pname">' + esc(p.name) + '</span><br><span class="pslug">' + esc(p.slug) + '</span></td>' +
        '<td>' + esc(p.category || '—') + '</td>' +
        '<td class="chains">' + esc(p.chains.slice(0, 3).join(', ')) + '</td>' +
        '<td class="num">' + money(p.tvl_usd) + '</td>' +
        '<td class="num"><b>' + money(p.mcap_usd) + '</b></td>' +
        '<td class="num ' + pctCls(p.change_7d) + '">' + pct(p.change_7d) + '</td></tr>';
    }).join('');
  }

  // --- Detail drawer ---
  function parseStep(s) {
    var m = s.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
    if (!m) return { text: s, cost: '', time: '' };
    return { text: m[1], cost: m[2], time: m[3] };
  }
  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) { r = D.rows[i]; break; }
    if (!r) return;
    var s = signal(r);
    var sc = score(r, MODEL.base_multiple, MODEL.growth_weight, MODEL.maturity_floor);
    var steps = r.farm_steps.map(function (st) {
      var p = parseStep(st);
      return '<li>' + esc(p.text) +
        '<span class="chips"><span class="chip">Cost: <b>' + esc(p.cost) + '</b></span>' +
        '<span class="chip">Time: <b>' + esc(p.time) + '</b></span></span></li>';
    }).join('');
    $('detail').innerHTML =
      '<div class="d-head"><h3>#' + r.rank + ' · ' + esc(r.name) + '</h3>' +
      '<span class="pslug">' + esc(r.slug) + '</span>' +
      (r.on_watchlist ? '<span class="badge">WATCHLIST</span>' : '<span class="badge" style="background:rgba(45,212,191,.12);color:var(--teal)">EARLY FIND</span>') +
      ' <span class="sig ' + s.cls + '">' + s.label + '</span></div>' +
      '<div class="d-stats">' +
      '<div><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b class="' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</b><span>7-day growth</span></div>' +
      '<div><b>' + ageFmt(r.age_days) + '</b><span>Age' + (r.listed_at ? ' · since ' + esc(r.listed_at) : ' · listed date unknown') + '</span></div>' +
      '<div><b>' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '</b><span>' + esc(r.chains.slice(0, 2).join(', ') || '—') + '</span></div>' +
      '</div>' +
      '<h4>Model breakdown — radar-2</h4>' +
      '<div class="d-model">' +
      '<div class="mrow"><span>Base · TVL × 0.30</span><b>' + money(sc.implied / (sc.gm * sc.mm * sc.bm)) + '</b></div>' +
      '<div class="mrow"><span>Growth × · 7d ' + pct(r.change_7d) + '</span><b>×' + sc.gm.toFixed(2) + '</b></div>' +
      '<div class="mrow"><span>Maturity × · ' + ageFmt(r.age_days) + ' with no token</span><b>×' + sc.mm.toFixed(2) + '</b></div>' +
      '<div class="mrow"><span>Breadth × · ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '</span><b>×' + sc.bm.toFixed(2) + '</b></div>' +
      '<div class="mrow"><span>Implied value</span><b>' + money(r.implied_value_usd) + '</b></div>' +
      '<p class="eq">implied = base × growth × maturity × breadth</p></div>' +
      '<h4>Farm plan — 7 steps</h4>' +
      '<ol class="d-farm">' + steps + '</ol>' +
      '<p class="d-note">This protocol records no token in the snapshot. That is what DefiLlama’s record says — not proof it has none, and not a prediction that it will issue one. Farm only what you can afford to leave in place.</p>';
    $('drawer').hidden = false;
  }
  function closeDetail() { $('drawer').hidden = true; }

  // --- Sandbox ---
  function readSandbox() {
    var b = parseFloat($('sBase').value), g = parseFloat($('sGrowth').value), m = parseFloat($('sMat').value);
    $('oBase').textContent = b.toFixed(2) + '× TVL';
    $('oGrowth').textContent = g.toFixed(2);
    $('oMat').textContent = m.toFixed(2);
    if (b === MODEL.base_multiple && g === MODEL.growth_weight && m === MODEL.maturity_floor) {
      sandbox = null;
      $('sandboxNote').hidden = true;
    } else {
      sandbox = { base: b, weight: g, floor: m };
      $('sandboxNote').hidden = false;
    }
    renderRows();
  }
  function resetSandbox() {
    $('sBase').value = MODEL.base_multiple; $('sGrowth').value = MODEL.growth_weight; $('sMat').value = MODEL.maturity_floor;
    readSandbox();
  }

  // --- Wiring ---
  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderRows(); });
  $('scope').addEventListener('change', function (e) { state.scope = e.target.value; renderRows(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderRows(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderRows(); });
  $('mintvl').addEventListener('change', function (e) { state.mintvl = parseInt(e.target.value, 10); renderRows(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderRows(); });
  $('reset').addEventListener('click', function () {
    state = { q: '', scope: 'all', cat: '', chain: '', mintvl: 0, sort: 'implied' };
    $('q').value = ''; $('scope').value = 'all'; $('cat').value = ''; $('chain').value = ''; $('mintvl').value = '0'; $('sort').value = 'implied';
    renderRows();
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  $('rows').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  $('close').addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
  ['sBase', 'sGrowth', 'sMat'].forEach(function (id) { $(id).addEventListener('input', readSandbox); });
  $('sReset').addEventListener('click', resetSandbox);

  // --- Boot ---
  renderStats();
  renderFilters();
  renderLive();
  var params = new URLSearchParams(location.search);
  var shot = params.get('shot') || 'board';
  if (shot === 'filtered') {
    state.cat = 'Lending';
    $('cat').value = 'Lending';
  }
  renderRows();
  if (shot === 'detail') {
    var slug = params.get('slug') || (D.rows[0] && D.rows[0].slug);
    if (slug) openDetail(slug);
  }
  window.__shotReady = true;
})();
