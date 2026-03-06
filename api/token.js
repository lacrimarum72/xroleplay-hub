export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const clientId     = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Env vars missing' });
  }

  try {
    const r = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: 'POST' }
    );
    const data = await r.json();
    if (!data.access_token) throw new Error('No token');
    res.status(200).json({ access_token: data.access_token, client_id: clientId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
