const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60');
  const { login, summary, chart, heatmap } = req.query;

  try {
    if (summary) {
      const since7 = new Date(Date.now() - 7*24*60*60*1000).toISOString();
      const snaps = await sb(`stream_snapshots?is_live=eq.true&recorded_at=gte.${since7}&select=login,recorded_at`);
      const byLogin = {};
      for (const s of snaps) { if (!byLogin[s.login]) byLogin[s.login] = []; byLogin[s.login].push(s.recorded_at); }
      let streamsThisWeek = 0;
      for (const times of Object.values(byLogin)) {
        times.sort(); let sessions = 1;
        for (let i = 1; i < times.length; i++) { if ((new Date(times[i]) - new Date(times[i-1])) / 60000 > 30) sessions++; }
        streamsThisWeek += sessions;
      }
      return res.status(200).json({ streamsThisWeek });
    }

    if (chart === 'weekly') {
      const since7 = new Date(Date.now() - 7*24*60*60*1000).toISOString();
      const snaps = await sb(`stream_snapshots?is_live=eq.true&recorded_at=gte.${since7}&select=viewers,recorded_at&order=recorded_at.asc&limit=50000`);
      const dayNames = ['So','Mo','Di','Mi','Do','Fr','Sa'];
      const byDay = {};
      for (const s of snaps) { const k = s.recorded_at?.substring(0,10); if (!byDay[k]) byDay[k] = []; byDay[k].push(s.viewers||0); }
      const weeklyChart = Object.entries(byDay).slice(-7).map(([date, vals]) => {
        return { label: dayNames[new Date(date).getDay()], value: Math.round(vals.reduce((a,b)=>a+b,0)/vals.length), date };
      });
      return res.status(200).json({ weeklyChart });
    }

    if (heatmap) {
      const since35 = new Date(Date.now() - 35*24*60*60*1000).toISOString();
      const snaps = await sb(`stream_snapshots?is_live=eq.true&recorded_at=gte.${since35}&select=login,recorded_at`);
      const byDay = {};
      for (const s of snaps) { const k = s.recorded_at?.substring(0,10); if (!byDay[k]) byDay[k] = new Set(); byDay[k].add(s.login); }
      const result = [];
      for (let i = 34; i >= 0; i--) {
        const d = new Date(Date.now() - i*24*60*60*1000);
        const k = d.toISOString().substring(0,10);
        result.push({ date: k, count: byDay[k]?.size || 0 });
      }
      return res.status(200).json({ heatmap: result });
    }

    if (login) {
      const snaps = await sb(`stream_snapshots?login=eq.${login}&is_live=eq.true&select=server,viewers,recorded_at&order=recorded_at.desc&limit=10000`);
      const serverMap = {};
      for (const s of snaps) { const srv = s.server||'Unbekannt'; serverMap[srv] = (serverMap[srv]||0)+1; }
      const serverHours = Object.entries(serverMap).map(([server,mins])=>({server,hours:Math.round(mins/60*10)/10})).sort((a,b)=>b.hours-a.hours);
      const totalHours = Math.round(snaps.length/60*10)/10;
      const byHour = {};
      for (const s of snaps) { const h = s.recorded_at?.substring(0,13); if (!byHour[h]) byHour[h]=[]; byHour[h].push(s.viewers); }
      const viewerTimeline = Object.entries(byHour).slice(-168).map(([hour,vals])=>({hour,avg:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)}));
      const lastLive = await sb(`stream_snapshots?login=eq.${login}&is_live=eq.true&select=recorded_at&order=recorded_at.desc&limit=1`);
      return res.status(200).json({ login, totalHours, serverHours, viewerTimeline, lastLive: lastLive[0]?.recorded_at||null });
    }

    const status = await sb('streamer_status?select=*&order=viewers.desc');
    res.status(200).json({ streamers: status });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
