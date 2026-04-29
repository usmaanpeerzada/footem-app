export async function onRequest(context) {
  const matchUrl = new URL(context.request.url).searchParams.get('url');
  if (!matchUrl) {
    return Response.json({ error: 'Missing url param' }, { status: 400 });
  }

  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  try {
    // Step 1: fetch match page, find the CLICK HERE broadcast link
    const matchResp = await fetch(matchUrl, { headers: HEADERS });
    const matchHtml = await matchResp.text();

    // The CLICK HERE image src contains "CLICK_HERE"
    const clickHereRegex = /<a[^>]+href="([^"]+)"[^>]*>\s*<img[^>]+src="[^"]*CLICK[^"]*"[^>]*\/?>\s*<\/a>/i;
    const clickMatch = matchHtml.match(clickHereRegex);

    if (!clickMatch) {
      return Response.json({ error: 'Broadcast link not found on this match page yet.' }, { status: 404 });
    }

    const broadcastUrl = new URL(clickMatch[1], matchUrl).href;

    // Step 2: fetch broadcast page, extract stream links + channels table
    const broadResp = await fetch(broadcastUrl, { headers: HEADERS });
    const broadHtml = await broadResp.text();

    // Extract LINK 1, LINK 2... anchors
    const links = [];
    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>(LINK[\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(broadHtml)) !== null) {
      const text = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.toUpperCase().startsWith('LINK')) {
        links.push({ text, url: m[1] });
      }
    }

    // Extract country/channel table rows
    const channels = [];
    const tableRegex = /<table[\s\S]*?<\/table>/i;
    const tableMatch = broadHtml.match(tableRegex);
    if (tableMatch) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowM;
      let first = true;
      while ((rowM = rowRegex.exec(tableMatch[0])) !== null) {
        if (first) { first = false; continue; } // skip header
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells = [];
        let cellM;
        while ((cellM = cellRegex.exec(rowM[1])) !== null) {
          const txt = cellM[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
          cells.push(txt);
        }
        if (cells.length >= 2 && cells[0] && cells[1]) {
          channels.push({ country: cells[0], channel: cells[1] });
        }
      }
    }

    return Response.json({ links, channels, broadcast_url: broadcastUrl }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
