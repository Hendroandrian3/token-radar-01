// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, the filters, one protocol's
// detail view with its farm plan, and the live-token reference table.
// No network: every byte it shows is in data.js. State lives in the URL's
// query string, so a filtered view or a detail view is a link of its own.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var main = document.querySelector('main');
  if (!DATA || !main) return;

  var params = new URLSearchParams(window.location.search);
  var state = {
    q: params.get('q') || '',
    category: params.get('category') || 'all',
    chain: params.get('chain') || 'all',
    sort: params.get('sort') || 'implied',
    watchlistOnly: params.get('watchlist') === '1',
    selected: params.get('select') || null,
  };

  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return money.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  // ---- header facts -------------------------------------------------------
  var meta = DATA.meta;
  document.getElementById('meta-line').textContent =
    'Snapshot ' + meta.as_of + ' · ' + meta.protocols_total + ' protocols at $5M+ TVL · ' +
    meta.watchlist_total + ' on the watchlist · ' + meta.rows_total + ' ranked (' +
    meta.early_total + ' early finds below the $50M floor) · whole-market peer multiple ' +
    meta.global_multiple.toFixed(2) + 'x';

  var stats = document.getElementById('stats');
  var statDefs = [
    [String(meta.rows_total), 'protocols ranked'],
    [String(meta.watchlist_total), 'watchlist covered'],
    [fmtUsd(meta.total_implied_usd), 'total implied value'],
    [fmtUsd(DATA.rows[0] ? DATA.rows[0].implied_value_usd : 0), 'rank 1 implied value'],
    [DATA.rows[0] ? DATA.rows[0].name : '—', 'top of the board'],
  ];
  statDefs.forEach(function (d) {
    var box = el('div', 'stat');
    box.appendChild(el('b', null, d[0]));
    box.appendChild(el('span', null, d[1]));
    stats.appendChild(box);
  });

  // ---- controls -----------------------------------------------------------
  var qInput = document.getElementById('q');
  var catSel = document.getElementById('category');
  var chainSel = document.getElementById('chain');
  var sortSel = document.getElementById('sort');
  var watchBox = document.getElementById('watchlist-only');

  DATA.categories.forEach(function (c) {
    catSel.appendChild(el('option', null, c)).value = c;
  });
  DATA.chains.forEach(function (c) {
    chainSel.appendChild(el('option', null, c)).value = c;
  });
  qInput.value = state.q;
  catSel.value = state.category;
  chainSel.value = state.chain;
  sortSel.value = state.sort;
  watchBox.checked = state.watchlistOnly;

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('category', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.sort !== 'implied') p.set('sort', state.sort);
    if (state.watchlistOnly) p.set('watchlist', '1');
    if (state.selected) p.set('select', state.selected);
    var qs = p.toString();
    window.history.replaceState(null, '', qs ? window.location.pathname + '?' + qs : window.location.pathname);
  }

  // ---- board --------------------------------------------------------------
  var tbody = document.getElementById('board-body');
  var countLine = document.getElementById('count-line');

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watchlistOnly && !r.on_watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1) return false;
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'growth') return (b.change_7d || 0) - (a.change_7d || 0);
      if (key === 'age') return (b.age_days || 0) - (a.age_days || 0);
      if (key === 'multiple') return b.peer_multiple - a.peer_multiple;
      return a.rank - b.rank;
    });
    return rows;
  }

  function renderBoard() {
    var rows = filtered();
    tbody.textContent = '';
    if (rows.length === 0) {
      var tr = el('tr');
      var td = el('td', 'empty', 'No protocol matches this filter. Loosen it to see the board again.');
      td.colSpan = 10;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    rows.forEach(function (r) {
      var tr = el('tr');
      if (r.slug === state.selected) tr.className = 'selected';
      tr.appendChild(el('td', 'num rank', String(r.rank)));
      var nameTd = el('td');
      nameTd.appendChild(el('span', 'name', r.name + ' '));
      if (r.on_watchlist) nameTd.appendChild(el('span', 'watch', 'WATCHLIST'));
      nameTd.appendChild(el('span', 'slug', r.slug));
      tr.appendChild(nameTd);
      tr.appendChild(el('td', null, r.category));
      tr.appendChild(el('td', null, r.chain));
      tr.appendChild(el('td', 'num', fmtUsd(r.tvl_usd)));
      var g = el('td', 'num', fmtPct(r.change_7d));
      if (r.change_7d !== null) g.className += r.change_7d >= 0 ? ' up' : ' down';
      tr.appendChild(g);
      tr.appendChild(el('td', 'num', fmtAge(r.age_days)));
      tr.appendChild(el('td', 'num', r.peer_multiple.toFixed(2) + 'x'));
      tr.appendChild(el('td', 'num', fmtUsd(r.implied_value_usd)));
      var c = el('td');
      c.appendChild(el('span', 'pill ' + r.confidence, r.confidence));
      tr.appendChild(c);
      tr.addEventListener('click', function () {
        state.selected = r.slug;
        syncUrl();
        renderBoard();
        renderDetail();
        document.getElementById('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      tbody.appendChild(tr);
    });
    countLine.textContent = 'Showing ' + rows.length + ' of ' + DATA.rows.length +
      ' ranked protocols' + (state.sort !== 'implied' ? ' · sorted by ' + sortSel.options[sortSel.selectedIndex].text.toLowerCase() : ' · in rank order');
  }

  // ---- detail -------------------------------------------------------------
  function findRow(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return DATA.rows[0];
  }

  function renderDetail() {
    var r = findRow(state.selected);
    if (!r) return;
    state.selected = r.slug;
    var box = document.getElementById('detail');
    box.textContent = '';
    box.appendChild(el('h2', null, '#' + r.rank + ' · ' + r.name));
    box.appendChild(el('p', 'sub',
      r.slug + ' · ' + r.category + ' · ' + r.chains.join(', ') +
      (r.on_watchlist ? ' · on the DefiLlama watchlist' : ' · an early find below the $50M floor') +
      ' · records no token'));
    var kv = el('div', 'kv');
    [
      [fmtUsd(r.implied_value_usd), 'implied launch value'],
      [fmtUsd(r.tvl_usd), 'TVL'],
      [r.peer_multiple.toFixed(2) + 'x · ' + r.peer_count + ' peers', 'category peer multiple'],
      [fmtPct(r.change_7d) + ' · ' + fmtAge(r.age_days), '7-day growth · age tracked'],
    ].forEach(function (d) {
      var cell = el('div');
      cell.appendChild(el('b', null, d[0]));
      cell.appendChild(el('span', null, d[1]));
      kv.appendChild(cell);
    });
    box.appendChild(kv);
    var formula = el('p', 'formula');
    formula.textContent = fmtUsd(r.tvl_usd) + ' TVL × ' + r.peer_multiple.toFixed(2) + 'x peer multiple × growth × patience = ' +
      fmtUsd(r.implied_value_usd) + ' implied value · confidence ' + r.confidence +
      ' (' + r.peer_count + ' live-token peers in ' + r.category + ')';
    box.appendChild(formula);
    box.appendChild(el('h2', null, 'Farm plan'));
    var ol = el('ol', 'steps');
    r.farm_steps.forEach(function (s) { ol.appendChild(el('li', null, s)); });
    box.appendChild(ol);
  }

  // ---- live reference -----------------------------------------------------
  var liveBody = document.getElementById('live-body');
  DATA.live.forEach(function (p) {
    var tr = el('tr');
    tr.appendChild(el('td', 'name', p.name));
    tr.appendChild(el('td', null, p.category));
    tr.appendChild(el('td', null, p.chain));
    tr.appendChild(el('td', 'num', fmtUsd(p.tvl_usd)));
    tr.appendChild(el('td', 'num', fmtUsd(p.mcap_usd)));
    tr.appendChild(el('td', 'num', p.multiple.toFixed(2) + 'x'));
    liveBody.appendChild(tr);
  });

  // ---- events -------------------------------------------------------------
  qInput.addEventListener('input', function () { state.q = qInput.value; syncUrl(); renderBoard(); });
  catSel.addEventListener('change', function () { state.category = catSel.value; syncUrl(); renderBoard(); });
  chainSel.addEventListener('change', function () { state.chain = chainSel.value; syncUrl(); renderBoard(); });
  sortSel.addEventListener('change', function () { state.sort = sortSel.value; syncUrl(); renderBoard(); });
  watchBox.addEventListener('change', function () { state.watchlistOnly = watchBox.checked; syncUrl(); renderBoard(); });

  renderBoard();
  renderDetail();
  // A deep link to one protocol opens on its detail view.
  if (params.get('select')) document.getElementById('detail').scrollIntoView();
})();
