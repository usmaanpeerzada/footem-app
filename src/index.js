const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function handleMatches() {
  try {
    const resp = await fetch('https://www.footem.site', { headers: HEADERS });
    if (!resp.ok) return jsonResponse({ error: `footem.site returned ${resp.status}` }, 502);

    const html = await resp.text();
    if (!html || html.length < 100) return jsonResponse({ error: 'Empty response from footem.site' }, 502);

    const matches = [];
    const seen = new Set();
    const linkRegex = /<a[^>]+href="(https?:\/\/[^"]*footem\.in\/20[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const url = m[1];
      if (!seen.has(url)) {
        seen.add(url);
        const text = m[2]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&nbsp;/g, ' ')
          .replace(/&#\d+;/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 5) matches.push({ title: text, url });
      }
    }
    return jsonResponse(matches);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

async function handleBroadcasts(matchUrl) {
  if (!matchUrl) return jsonResponse({ error: 'Missing url param' }, 400);
  try {
    const matchResp = await fetch(matchUrl, { headers: HEADERS });
    const matchHtml = await matchResp.text();

    const clickMatch = matchHtml.match(/<a[^>]+href="([^"]+)"[^>]*>\s*<img[^>]+src="[^"]*CLICK[^"]*"[^>]*\/?>\s*<\/a>/i);
    if (!clickMatch) return jsonResponse({ error: 'Stream links not available for this match yet.' }, 404);

    const broadcastUrl = new URL(clickMatch[1], matchUrl).href;
    const broadResp = await fetch(broadcastUrl, { headers: HEADERS });
    const broadHtml = await broadResp.text();

    const links = [];
    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>(LINK[\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(broadHtml)) !== null) {
      const text = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.toUpperCase().startsWith('LINK')) links.push({ text, url: m[1] });
    }

    const channels = [];
    const tableMatch = broadHtml.match(/<table[\s\S]*?<\/table>/i);
    if (tableMatch) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowM, first = true;
      while ((rowM = rowRegex.exec(tableMatch[0])) !== null) {
        if (first) { first = false; continue; }
        const cells = [];
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellM;
        while ((cellM = cellRegex.exec(rowM[1])) !== null) {
          cells.push(cellM[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
        }
        if (cells.length >= 2 && cells[0] && cells[1]) channels.push({ country: cells[0], channel: cells[1] });
      }
    }

    return jsonResponse({ links, channels, broadcast_url: broadcastUrl });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Footem Live</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #111; color: #eee; font-family: 'Segoe UI', sans-serif; min-height: 100vh; }
    header { background: #ff0808; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
    header h1 { font-size: 1.4rem; color: #fff; letter-spacing: 1px; }
    header span { font-size: 0.85rem; color: rgba(255,255,255,0.8); }
    .container { max-width: 800px; margin: 0 auto; padding: 24px 16px; }
    #loading, #error-msg { text-align: center; padding: 40px; color: #aaa; }
    #error-msg { color: #ff6b6b; }
    .match-card { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; cursor: pointer; transition: background 0.2s, border-color 0.2s; }
    .match-card:hover { background: #272727; border-color: #ff0808; }
    .match-title { font-size: 1rem; font-weight: 600; }
    #modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 100; align-items: center; justify-content: center; }
    #modal-overlay.open { display: flex; }
    #modal { background: #1a1a1a; border-radius: 10px; width: 100%; max-width: 560px; max-height: 85vh; overflow-y: auto; padding: 24px; position: relative; }
    #modal-close { position: absolute; top: 14px; right: 16px; background: none; border: none; color: #aaa; font-size: 1.4rem; cursor: pointer; }
    #modal-close:hover { color: #fff; }
    #modal h2 { font-size: 1.05rem; margin-bottom: 16px; color: #fff; padding-right: 24px; }
    #modal-loading { text-align: center; color: #aaa; padding: 24px 0; }
    .stream-link { display: block; background: #ff0808; color: #fff; text-decoration: none; padding: 12px 16px; border-radius: 6px; margin-bottom: 10px; font-weight: 600; font-size: 0.9rem; transition: background 0.2s; }
    .stream-link:hover { background: #cc0606; }
    .channels-section { margin-top: 20px; }
    .channels-section h3 { font-size: 0.85rem; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .channel-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #2a2a2a; font-size: 0.85rem; }
    .channel-row .country { color: #aaa; }
    .channel-row .channel { color: #eee; font-weight: 500; }
    .no-matches { text-align: center; color: #666; padding: 40px; }
    .refresh-btn { display: block; margin: 0 auto 24px; background: #222; border: 1px solid #333; color: #eee; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
    .refresh-btn:hover { background: #2a2a2a; }
  </style>
</head>
<body>
  <header>
    <h1>⚽ FOOTEM LIVE</h1>
    <span>Click a match to get stream links</span>
  </header>
  <div class="container">
    <button class="refresh-btn" onclick="loadMatches()">↻ Refresh Matches</button>
    <div id="loading">Loading matches...</div>
    <div id="error-msg" style="display:none"></div>
    <div id="matches-list"></div>
  </div>
  <div id="modal-overlay" onclick="closeModal(event)">
    <div id="modal">
      <button id="modal-close" onclick="closeModal()">✕</button>
      <h2 id="modal-title"></h2>
      <div id="modal-loading">Fetching stream links...</div>
      <div id="modal-content"></div>
    </div>
  </div>
  <script>
    async function loadMatches() {
      document.getElementById('loading').style.display = 'block';
      document.getElementById('error-msg').style.display = 'none';
      document.getElementById('matches-list').innerHTML = '';
      try {
        const res = await fetch('/api/matches');
        const data = await res.json();
        document.getElementById('loading').style.display = 'none';
        if (data.error) { showError(data.error); return; }
        if (!data.length) { document.getElementById('matches-list').innerHTML = '<div class="no-matches">No live or upcoming matches found right now.</div>'; return; }
        const list = document.getElementById('matches-list');
        data.forEach(match => {
          const card = document.createElement('div');
          card.className = 'match-card';
          card.innerHTML = '<div class="match-title">' + match.title + '</div>';
          card.onclick = () => openMatch(match);
          list.appendChild(card);
        });
      } catch (e) {
        document.getElementById('loading').style.display = 'none';
        showError('Failed to load matches: ' + e.message);
      }
    }
    function showError(msg) {
      const el = document.getElementById('error-msg');
      el.textContent = msg;
      el.style.display = 'block';
    }
    async function openMatch(match) {
      document.getElementById('modal-title').textContent = match.title;
      document.getElementById('modal-loading').style.display = 'block';
      document.getElementById('modal-content').innerHTML = '';
      document.getElementById('modal-overlay').classList.add('open');
      try {
        const res = await fetch('/api/broadcasts?url=' + encodeURIComponent(match.url));
        const data = await res.json();
        document.getElementById('modal-loading').style.display = 'none';
        if (data.error) { document.getElementById('modal-content').innerHTML = '<div style="color:#ff6b6b">' + data.error + '</div>'; return; }
        let html = '';
        if (data.links && data.links.length) {
          data.links.forEach(link => { html += '<a class="stream-link" href="' + link.url + '" target="_blank" rel="noopener">' + link.text + '</a>'; });
        } else { html += '<div style="color:#888">No stream links found for this match yet.</div>'; }
        if (data.channels && data.channels.length) {
          html += '<div class="channels-section"><h3>Official Broadcasters</h3>';
          data.channels.forEach(ch => { html += '<div class="channel-row"><span class="country">' + ch.country + '</span><span class="channel">' + ch.channel + '</span></div>'; });
          html += '</div>';
        }
        document.getElementById('modal-content').innerHTML = html;
      } catch (e) {
        document.getElementById('modal-loading').style.display = 'none';
        document.getElementById('modal-content').innerHTML = '<div style="color:#ff6b6b">Error: ' + e.message + '</div>';
      }
    }
    function closeModal(e) {
      if (!e || e.target === document.getElementById('modal-overlay') || e.currentTarget === document.getElementById('modal-close')) {
        document.getElementById('modal-overlay').classList.remove('open');
      }
    }
    loadMatches();
  </script>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (url.pathname === '/api/matches') {
      return handleMatches();
    }

    if (url.pathname === '/api/broadcasts') {
      return handleBroadcasts(url.searchParams.get('url'));
    }

    return new Response('Not found', { status: 404 });
  }
};
