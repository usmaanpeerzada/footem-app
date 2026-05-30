export async function onRequest(context) {
  const matchUrl = new URL(context.request.url).searchParams.get('url');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (!matchUrl) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), { status: 400, headers: corsHeaders });
  }

  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  try {
    // Step 1: fetch match page, find the CLICK HERE broadcast link
    const matchResp = await fetch(matchUrl, { headers: HEADERS });
    const matchHtml = await matchResp.text();

    const clickMatch = matchHtml.match(/<a[^>]+href="([^"]+)"[^>]*>\s*<img[^>]+src="[^"]*CLICK[^"]*"[^>]*\/?>\s*<\/a>/i)
      || matchHtml.match(/<a[^>]+href="([^"]+)"[^>]*>[^<]*TV Channel[^<]*<\/a>/i);

    if (!clickMatch) {
      return new Response(JSON.stringify({ error: 'Stream links not available for this match yet.' }), { status: 404, headers: corsHeaders });
    }

    const broadcastUrl = new URL(clickMatch[1], matchUrl).href;

    // Step 2: fetch broadcast page, extract stream links + channels
    const broadResp = await fetch(broadcastUrl, { headers: HEADERS });
    const broadHtml = await broadResp.text();

    // Extract LINK 1, LINK 2...
    const links = [];
    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>(LINK[\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(broadHtml)) !== null) {
      const text = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.toUpperCase().startsWith('LINK')) {
        links.push({ text, url: m[1] });
      }
    }

    // Extract country/channel table
    const channels = [];
    const tableRegex = /<table[\s\S]*?<\/table>/i;
    const tableMatch = broadHtml.match(tableRegex);
    if (tableMatch) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowM;
      let first = true;
      while ((rowM = rowRegex.exec(tableMatch[0])) !== null) {
        if (first) { first = false; continue; }
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

    return new Response(JSON.stringify({ links, channels, broadcast_url: broadcastUrl }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}
