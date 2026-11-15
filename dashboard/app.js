// Token Launch Radar — board, Shortlist, charts, filters, detail view, live table, model sandbox.
// Static page: every number comes from window.RADAR (data.js, written by
// main.ts from the sealed snapshot). No fetch, no network, no framework.
// ?shot=board (default) | ?shot=detail&slug=<slug> | ?shot=filtered
// sets window.__shotReady when the view is painted, for screenshots.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.body.textContent = 'No radar data (data.js missing).'; return; }
  var MODEL = D.model;
  var STRIKE = D.strike;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
  function strikeMult(g) {
    if (g == null) return STRIKE.steady_mult;
    if (g >= STRIKE.surging_min) return STRIKE.surging_mult;
    if (g >= STRIKE.warming_min) return STRIKE.warming_mult;
    if (g <= STRIKE.cooling_max) return STRIKE.cooling_mult;
    return STRIKE.steady_mult;
  }

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
  var sandbox = null; // {base, weight, floor} once a slider moves off radar-3
  var maxImplied = Math.max.apply(null, D.rows.map(function (r) { return r.implied_value_usd; }));
  var maxStrike = Math.max.apply(null, D.rows.map(function (r) { return r.strike_score_usd; }));

  // The Shortlist: the board's ten highest strike scores. Value times momentum.
  var shortlist = D.rows.slice().sort(function (a, b) {
    return b.strike_score_usd - a.strike_score_usd || a.rank - b.rank;
  }).slice(0, 10);

  function shownValue(r) {
    return sandbox ? score(r, sandbox.base, sandbox.weight, sandbox.floor).implied : r.implied_value_usd;
  }
  function shownStrike(r) {
    return Math.max(1, Math.round(shownValue(r) * strikeMult(r.change_7d)));
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
      if (by === 'strike') return shownStrike(b) - shownStrike(a);
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
    var st = shownStrike(r);
    var w = Math.max(2, Math.round((v / maxImplied) * 100));
    var sw = Math.max(2, Math.round((st / maxStrike) * 100));
    return '<tr tabindex="0" data-slug="' + esc(r.slug) + '">' +
      '<td class="num rank' + (r.rank <= 3 ? ' top' : '') + '">' + r.rank + '</td>' +
      '<td><span class="pname">' + esc(r.name) + '</span>' +
      (r.on_watchlist ? '<span class="badge">WATCHLIST</span>' : '') +
      (shortlist.some(function (x) { return x.slug === r.slug; }) ? '<span class="badge strike">SHORTLIST</span>' : '') +
      '<br><span class="pslug">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num ' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + ageFmt(r.age_days) + '</td>' +
      '<td class="num"><b>' + money(v) + '</b><span class="vbar"><i style="width:' + w + '%"></i></span></td>' +
      '<td class="num"><span class="strikeval">' + money(st) + '</span><span class="vbar strike"><i style="width:' + sw + '%"></i></span></td>' +
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

  function renderFarmFirst() {
    var top = shortlist[0];
    if (!top) return;
    var s = signal(top);
    $('farmFirst').innerHTML = 'Farm first: <b>' + esc(top.name) + '</b> — <span class="ff-val">' + money(top.strike_score_usd) + ' strike</span> · ' +
      money(top.implied_value_usd) + ' implied · TVL ' + money(top.tvl_usd) + ' · ' + s.label.toLowerCase() + ' ' + pct(top.change_7d) +
      ' in 7 days · $' + top.capital_usd + ' to farm. <span style="color:var(--muted)">The Shortlist below says why.</span>';
  }

  function renderShortlist() {
    var totalCap = 0, maxHold = 0;
    shortlist.forEach(function (r) { totalCap += r.capital_usd; if (r.hold_days > maxHold) maxHold = r.hold_days; });
    $('farmAll').innerHTML = 'Farm all ten: <b>$' + totalCap + '</b> capital · up to <b>' + maxHold + ' days</b> hold';
    $('shortlist').innerHTML = shortlist.map(function (r, i) {
      var s = signal(r);
      var w = Math.max(4, Math.round((r.strike_score_usd / maxStrike) * 100));
      return '<div class="card' + (i === 0 ? ' first' : '') + '" tabindex="0" data-slug="' + esc(r.slug) + '">' +
        '<span class="crank">STRIKE #' + (i + 1) + ' · board #' + r.rank + '</span>' +
        '<span class="cname">' + esc(r.name) + '</span>' +
        '<span class="ccat">' + esc(r.category || '—') + ' · ' + esc(r.chains.slice(0, 1).join(', ') || '—') + '</span>' +
        '<div class="cvals"><span class="strike"><span class="lbl">Strike</span> <b>' + money(r.strike_score_usd) + '</b></span>' +
        '<span><span class="lbl">Implied</span> <b>' + money(r.implied_value_usd) + '</b></span></div>' +
        '<span class="cbar"><i style="width:' + w + '%"></i></span>' +
        '<span class="csig sig ' + s.cls + '">' + s.label + ' ' + pct(r.change_7d) + ' <span class="ccost">· $' + r.capital_usd + ' · ' + r.hold_days + 'd</span></span></div>';
    }).join('');
  }

  function renderGrowthMix() {
    var counts = { hot: 0, warm: 0, steady: 0, cool: 0 };
    D.rows.forEach(function (r) {
      var g = r.change_7d;
      if (g == null || (g > -5 && g < 5)) counts.steady++;
      else if (g >= 15) counts.hot++;
      else if (g >= 5) counts.warm++;
      else counts.cool++;
    });
    var total = D.rows.length;
    function seg(n, color) {
      var w = Math.max(2, Math.round((n / total) * 100));
      return '<span class="mseg" style="width:' + w + 'px;background:' + color + '" title="' + n + '"></span>';
    }
    $('growthMix').innerHTML = 'Growth mix: ' +
      seg(counts.hot, '#34d399') + seg(counts.warm, '#2dd4bf') + seg(counts.steady, '#5c6b7a') + seg(counts.cool, '#f87171') +
      '<span class="mlab">' + counts.hot + ' surging · ' + counts.warm + ' warming · ' + counts.steady + ' steady · ' + counts.cool + ' cooling</span>';
  }

  function renderCharts() {
    var top = D.rows.slice(0, 10);
    var maxV = top[0].implied_value_usd;
    $('chartTop').innerHTML = top.map(function (r, i) {
      var w = Math.max(2, Math.round((r.implied_value_usd / maxV) * 100));
      return '<div class="brow"><span class="bname">#' + r.rank + ' ' + esc(r.name) + '</span>' +
        '<span class="btrack"><i class="' + (i === 0 ? 'amber' : '') + '" style="width:' + w + '%"></i></span>' +
        '<span class="bval"><b>' + money(r.implied_value_usd) + '</b></span></div>';
    }).join('');
    var cats = {};
    D.rows.forEach(function (r) {
      var c = r.category || 'Uncategorised';
      if (!cats[c]) cats[c] = { n: 0, v: 0 };
      cats[c].n++;
      cats[c].v += r.implied_value_usd;
    });
    var list = Object.keys(cats).map(function (c) { return { c: c, n: cats[c].n, v: cats[c].v }; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    var maxCat = list[0].v;
    $('chartCat').innerHTML = list.map(function (x) {
      var w = Math.max(2, Math.round((x.v / maxCat) * 100));
      return '<div class="brow"><span class="bname">' + esc(x.c) + ' · ' + x.n + ' rows</span>' +
        '<span class="btrack"><i style="width:' + w + '%"></i></span>' +
        '<span class="bval"><b>' + money(x.v) + '</b></span></div>';
    }).join('');
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
  function whyNow(r) {
    var parts = [];
    var g = r.change_7d;
    if (g != null && g >= 15) parts.push('surging ' + pct(g) + ' in 7 days — the window is open now, not next month');
    else if (g != null && g >= 5) parts.push('warming ' + pct(g) + ' in 7 days — attention is arriving');
    else if (g != null && g <= -5) parts.push('cooling ' + pct(g) + ' in 7 days — cheap to enter, but the moment is not now');
    else parts.push('steady in 7 days — no rush, and no crowd yet');
    if (r.on_watchlist) parts.push('on the house watchlist — the $50M floor already flags it');
    if (r.age_days != null && r.age_days >= 1095) parts.push('running ' + ageFmt(r.age_days) + ' with no token — the launch is long overdue');
    else if (r.age_days != null && r.age_days < 180) parts.push('only ' + ageFmt(r.age_days) + ' old — early, and the qualifying window is long');
    return parts.join('; ') + '.';
  }
  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) { r = D.rows[i]; break; }
    if (!r) return;
    var s = signal(r);
    var sc = score(r, MODEL.base_multiple, MODEL.growth_weight, MODEL.maturity_floor);
    var strike = Math.max(1, Math.round(r.implied_value_usd * strikeMult(r.change_7d)));
    var strikeRank = shortlist.findIndex(function (x) { return x.slug === r.slug; });
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
      (strikeRank >= 0 ? '<span class="badge strike">SHORTLIST #' + (strikeRank + 1) + '</span>' : '') +
      ' <span class="sig ' + s.cls + '">' + s.label + '</span></div>' +
      '<p class="d-why"><b>Why now:</b> ' + esc(whyNow(r)) + '</p>' +
      '<div class="d-stats">' +
      '<div><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b class="' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</b><span>7-day growth</span></div>' +
      '<div><b>' + ageFmt(r.age_days) + '</b><span>Age' + (r.listed_at ? ' · since ' + esc(r.listed_at) : ' · listed date unknown') + '</span></div>' +
      '<div><b>' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '</b><span>' + esc(r.chains.slice(0, 2).join(', ') || '—') + '</span></div>' +
      '<div><b>' + money(strike) + '</b><span>Strike score' + (strikeRank >= 0 ? ' · Shortlist #' + (strikeRank + 1) : '') + '</span></div>' +
      '<div><b>$' + r.capital_usd + '</b><span>Capital to farm · hold ' + r.hold_days + 'd</span></div>' +
      '</div>' +
      '<h4>Model breakdown — radar-3</h4>' +
      '<div class="d-model">' +
      '<div class="mrow"><span>Base · TVL × 0.30</span><b>' + money(sc.implied / (sc.gm * sc.mm * sc.bm)) + '</b></div>' +
      '<div class="mrow"><span>Growth × · 7d ' + pct(r.change_7d) + '</span><b>×' + sc.gm.toFixed(2) + '</b></div>' +
      '<div class="mrow"><span>Maturity × · ' + ageFmt(r.age_days) + ' with no token</span><b>×' + sc.mm.toFixed(2) + '</b></div>' +
      '<div class="mrow"><span>Breadth × · ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '</span><b>×' + sc.bm.toFixed(2) + '</b></div>' +
      '<div class="mrow"><span>Implied value</span><b>' + money(r.implied_value_usd) + '</b></div>' +
      '<div class="mrow"><span>Strike × · momentum ' + pct(r.change_7d) + '</span><b>×' + strikeMult(r.change_7d).toFixed(2) + '</b></div>' +
      '<div class="mrow"><span>Strike score</span><b>' + money(strike) + '</b></div>' +
      '<p class="eq">implied = base × growth × maturity × breadth · strike = implied × momentum</p></div>' +
      '<h4>Farm plan — 7 steps</h4>' +
      '<ol class="d-farm">' + steps + '</ol>' +
      '<p class="d-risk"><b>What can go wrong:</b> ' + esc(r.risk) + '</p>' +
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
  $('shortlist').addEventListener('click', function (e) {
    var card = e.target.closest('[data-slug]');
    if (card) openDetail(card.getAttribute('data-slug'));
  });
  $('shortlist').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var card = e.target.closest('[data-slug]');
    if (card) openDetail(card.getAttribute('data-slug'));
  });
  $('close').addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
  ['sBase', 'sGrowth', 'sMat'].forEach(function (id) { $(id).addEventListener('input', readSandbox); });
  $('sReset').addEventListener('click', resetSandbox);

  // --- Boot ---
  renderStats();
  renderFarmFirst();
  renderShortlist();
  renderGrowthMix();
  renderFilters();
  renderLive();
  renderCharts();
  var params = new URLSearchParams(location.search);
  var shot = params.get('shot') || 'board';
  if (shot === 'filtered') {
    state.cat = 'Lending';
    $('cat').value = 'Lending';
  }
  renderRows();
  if (shot === 'detail') {
    var slug = params.get('slug') || (shortlist[0] && shortlist[0].slug) || (D.rows[0] && D.rows[0].slug);
    if (slug) openDetail(slug);
  }
  window.__shotReady = true;
})();
