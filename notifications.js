const { EmbedBuilder } = require('discord.js');
const { api } = require('./twitch-api');

function liveState() {
  return { seenOnline: new Set() };
}

function findNotificationChannel(client, storage, guildId) {
  const g = storage.guild(guildId);
  const channelId = g.notifChannel;
  if (!channelId) return null;
  return client.channels.cache.get(channelId) || null;
}

function makeEmbed(user, stream) {
  const color = stream ? 0x9146ff : 0xff0000;
  if (stream) {
    return new EmbedBuilder()
      .setColor(color)
      .setTitle(stream.title || `${user.display_name} is live!`)
      .setURL(`https://twitch.tv/${user.login}`)
      .setAuthor({ name: `${user.display_name} is now live!`, iconURL: user.profile_image_url })
      .setThumbnail(user.profile_image_url)
      .setImage(stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'))
      .addFields(
        { name: 'Game', value: stream.game_name || 'Just Chatting', inline: true },
        { name: 'Viewers', value: String(stream.viewer_count), inline: true },
        { name: 'Category', value: stream.type === 'live' ? 'Live' : 'Other', inline: true }
      )
      .setTimestamp();
  }
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${user.display_name} went offline`)
    .setURL(`https://twitch.tv/${user.login}`)
    .setThumbnail(user.profile_image_url)
    .setTimestamp();
}

async function checkStreams(client, config, storage, state) {
  if (config.twitchChannels.length === 0) return;

  let users;
  let streams;
  try {
    const query = config.twitchChannels.map((c) => `login=${encodeURIComponent(c)}`).join('&');
    const [u, s] = await Promise.all([
      api(config, `/users?${query}`),
      api(config, `/streams?user_login=${config.twitchChannels.map((c) => encodeURIComponent(c)).join('&user_login=')}`),
    ]);
    users = u;
    streams = s;
  } catch (err) {
    console.error('Twitch stream check error:', err.message);
    return;
  }

  const liveLogins = new Set(streams.map((s) => s.user_login.toLowerCase()));
  const userByLogin = new Map(users.map((u) => [u.login.toLowerCase(), u]));

  for (const login of config.twitchChannels) {
    const user = userByLogin.get(login);
    if (!user) continue;

    const stream = streams.find((s) => s.user_login.toLowerCase() === login);

    if (stream && !state.seenOnline.has(login)) {
      state.seenOnline.add(login);
      broadcast(client, storage, makeEmbed(user, stream));
    } else if (!stream && state.seenOnline.has(login)) {
      state.seenOnline.delete(login);
      broadcast(client, storage, makeEmbed(user, null));
    }
  }
}

function broadcast(client, storage, embed) {
  for (const guild of client.guilds.cache.values()) {
    const channel = findNotificationChannel(client, storage, guild.id);
    if (channel) {
      channel.send({ embeds: [embed] }).catch((e) => console.error('Notif send error:', e.message));
    }
  }
}

async function start(client, config, storage) {
  const state = liveState();
  console.log(`Tracking streams: ${config.twitchChannels.join(', ') || '(none)'}`);

  // Initial state: only remember who is live without posting history
  const check = async () => {
    try {
      const query = config.twitchChannels.map((c) => `login=${encodeURIComponent(c)}`).join('&');
      const streams = await api(config, `/streams?user_login=${config.twitchChannels.map((c) => encodeURIComponent(c)).join('&user_login=')}`);
      streams.forEach((s) => state.seenOnline.add(s.user_login.toLowerCase()));
    } catch (e) {
      /* ignore initial errors */
    }
  };
  await check();

  // Wait ~10s then loop so we don't double-post at startup
  setInterval(() => checkStreams(client, config, storage, state), 60000);
  setTimeout(() => checkStreams(client, config, storage, state), 10000);
}

module.exports = { start };
