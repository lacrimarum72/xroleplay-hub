const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
    }
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60');

  const login = req.query.login;

  try {
    if (login) {
      // ── Single streamer stats ──
      // Total snapshots where is_live = true (each snapshot = ~1 min)
      const snaps = await sb(
        `stream_snapshots?login=eq.${login}&is_live=eq.true&select=server,viewers,recorded_at&order=recorded_at.desc&limit=10000`
      );

      // Hours per server
      const serverMap = {};
      for (const s of snaps) {
        const srv = s.server || 'Unbekannt';
        serverMap[srv] = (serverMap[srv] || 0) + 1;
      }
      const serverHours = Object.entries(serverMap)
        .map(([server, mins]) => ({ server, hours: Math.round(mins / 60 * 10) / 10 }))
        .sort((a,b) => b.hours - a.hours);

      // Total hours
      const totalHours = Math.round(snaps.length / 60 * 10) / 10;

      // Viewer timeline (last 7 days, hourly avg)
      const viewerTimeline = [];
      const byHour = {};
      for (const s of snaps) {
        const h = s.recorded_at?.substring(0, 13); // "2024-01-15T14"
        if (!byHour[h]) byHour[h] = [];
        byHour[h].push(s.viewers);
      }
      for (const [hour, vals] of Object.entries(byHour).slice(-168)) {
        const avg = Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
        viewerTimeline.push({ hour, avg });
      }

      // Last live
      const lastLive = await sb(
        `stream_snapshots?login=eq.${login}&is_live=eq.true&select=recorded_at&order=recorded_at.desc&limit=1`
      );

      res.status(200).json({
        login,
        totalHours,
        serverHours,
        viewerTimeline,
        lastLive: lastLive[0]?.recorded_at || null,
      });

    } else {
      // ── All streamers overview ──
      const status = await sb('streamer_status?select=*&order=viewers.desc');
      res.status(200).json({ streamers: status });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
