let tokenCache = null;

async function getAppToken(config) {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const url = 'https://id.twitch.tv/oauth2/token';
  const params = new URLSearchParams({
    client_id: config.twitchClientId,
    client_secret: config.twitchClientSecret,
    grant_type: 'client_credentials',
    scope: 'user:read:follows',
  });

  const res = await fetch(url, { method: 'POST', body: params });
  if (!res.ok) {
    throw new Error(`Twitch token request failed: ${res.status}`);
  }
  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

async function api(config, path) {
  const token = await getAppToken(config);
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      'Client-Id': config.twitchClientId,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Twitch API ${path} failed: ${res.status}`);
  }
  const data = await res.json();
  return data.data || [];
}

module.exports = { getAppToken, api };
