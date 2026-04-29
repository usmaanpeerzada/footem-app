export async function onRequest() {
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const resp = await fetch('https://www.footem.site', { headers: HEADERS });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `footem.site returned ${resp.status}` }), { status: 502, headers: corsHeaders });
    }

    const html = await resp.text();

    if (!html || html.length < 100) {
      return new Response(JSON.stringify({ error: 'Empty response from footem.site' }), { status: 502, headers: corsHeaders });
    }

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
        if (text.length > 5) {
          matches.push({ title: text, url });
        }
      }
    }

    return new Response(JSON.stringify(matches), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}
