const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TWITCH_CLIENT_ID     = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const STREAMERS = [
'dero_tv_','d3viigirl','alessio_guzman','keanuzien','reda__7272','harryyyys','tayo_rulo','dayiasena','taypacino','bladinostv','realneotv_nrw','xCihad61','xCihad61','rachidbounouar','denob07','ausrastenistmeinhobby','palmenspringer'
];

async function getTwitchToken() {
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const d = await r.json();
  return d.access_token;
}

async function getStreams(token) {
  const q = STREAMERS.map(s => 'user_login=' + s).join('&');
  const r = await fetch(`https://api.twitch.tv/helix/streams?${q}&first=100`, {
    headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': 'Bearer ' + token }
  });
  const d = await r.json();
  return d.data || [];
}

async function supabase(method, path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (method === 'GET') return r.json();
  return r;
}

// Extract server name from stream title
// e.g. "🔴 CityRP | Folge 42" → "CityRP"
function extractServer(title) {
  if (!title) return 'Unbekannt';
  // Common patterns: "ServerName |", "[ServerName]", "Server: Name"
  const patterns = [
    /\|\s*([^|]+?)(?:\s*\||$)/i,
    /\[([^\]]+)\]/i,
    /server[:\s]+([^\s|]+)/i,
    /^[^|[\]]+?([A-Z][a-zA-Z0-9]+RP[a-zA-Z0-9]*)/,
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m && m[1] && m[1].trim().length > 1) return m[1].trim().substring(0, 40);
  }
  // fallback: first meaningful word group
  const clean = title.replace(/[🔴🟢⚫🎮]/g, '').trim();
  return clean.split(/[\s|[\]]/)[0]?.substring(0, 40) || 'Unbekannt';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const token   = await getTwitchToken();
    const streams = await getStreams(token);
    const now     = new Date().toISOString();

    // Build a map of who is currently live
    const liveMap = {};
    for (const s of streams) liveMap[s.user_login.toLowerCase()] = s;

    // For each streamer, upsert a "sessions" record
    const records = [];
    for (const login of STREAMERS) {
      const s = liveMap[login];
      if (s) {
        records.push({
          login:        login,
          is_live:      true,
          title:        s.title || '',
          game:         s.game_name || '',
          server:       extractServer(s.title),
          viewers:      s.viewer_count || 0,
          started_at:   s.started_at,
          recorded_at:  now,
        });
      } else {
        records.push({
          login:       login,
          is_live:     false,
          viewers:     0,
          recorded_at: now,
        });
      }
    }

    // Insert snapshot row for each streamer
    await supabase('POST', 'stream_snapshots', records);

    // Upsert current status
    for (const rec of records) {
      await supabase('POST', 'streamer_status?on_conflict=login', {
        login:      rec.login,
        is_live:    rec.is_live,
        title:      rec.title || null,
        game:       rec.game  || null,
        server:     rec.server || null,
        viewers:    rec.viewers,
        started_at: rec.started_at || null,
        updated_at: now,
      });
    }

    res.status(200).json({ ok: true, live: streams.length, recorded: now });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
