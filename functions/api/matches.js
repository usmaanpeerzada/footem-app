export async function onRequest() {
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  try {
    const resp = await fetch('https://www.footem.site', { headers: HEADERS });
    const html = await resp.text();

    const matches = [];
    const seen = new Set();

    const linkRegex = /<a[^>]+href="(https?:\/\/[^"]*footem\.in\/20[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const url = m[1];
      if (!seen.has(url)) {
        seen.add(url);
        const text = m[2].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
        if (text.length > 5) {
          matches.push({ title: text, url });
        }
      }
    }

    return Response.json(matches, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
