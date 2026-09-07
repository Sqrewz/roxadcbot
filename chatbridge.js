const tmi = require('tmi.js');
const { Events, EmbedBuilder } = require('discord.js');

const state = { client: null, discord: null };

function twitchOpts(config) {
  const opts = {
    identity: {},
    channels: [config.twitchLogin],
  };
  if (config.twitchChatOAuth) {
    const token = config.twitchChatOAuth.startsWith('oauth:')
      ? config.twitchChatOAuth
      : `oauth:${config.twitchChatOAuth}`;
    opts.identity = { username: config.twitchLogin, password: token };
  }
  return opts;
}

function discordChannel(client, storage, guildId) {
  const g = storage.guild(guildId);
  if (!g.chatChannel) return null;
  return client.channels.cache.get(g.chatChannel) || null;
}

function findDiscordChannel(discord, storage) {
  for (const guild of discord.guilds.cache.values()) {
    const ch = discordChannel(discord, storage, guild.id);
    if (ch) return ch;
  }
  return null;
}

function start(discord, config, storage) {
  state.discord = discord;

  const client = new tmi.client(twitchOpts(config));

  client.on('connected', () => {
    console.log(`Twitch chat connected: #${config.twitchLogin}`);
  });

  client.on('message', (channel, tags, message, self) => {
    if (self) return;
    const dc = findDiscordChannel(discord, storage);
    if (!dc) return;

    const badges = (tags.badges ? Object.keys(tags.badges) : [])
      .map((b) => b.charAt(0).toUpperCase() + b.slice(1))
      .join(', ');

    const embed = new EmbedBuilder()
      .setColor(0x9146ff)
      .setAuthor({ name: `${tags['display-name'] || tags.username} (Twitch)` })
      .setDescription(message.length ? message : '(message deleted)')
      .setFooter({ text: badges ? `Badges: ${badges}` : 'Twitch chat' })
      .setTimestamp();

    dc.send({ embeds: [embed] }).catch((e) => console.error('DC send error:', e.message));
  });

  // Bridge Discord -> Twitch
  discord.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) return;
    if (msg.channel.type !== 0) return; // text channel only

    const g = storage.guild(msg.guildId);
    if (!g || msg.channel.id !== g.chatChannel) return;

    if (!config.twitchChatOAuth || !client.readyState || client.readyState !== 'OPEN') {
      msg.reply('Twitch chat sending is not configured (need TWITCH_CHAT_OAUTH).').catch(() => {});
      return;
    }

    try {
      const text = (msg.content || '').slice(0, 450);
      await client.say(config.twitchLogin, `[Discord ${msg.author.username}] ${text}`);
    } catch (err) {
      console.error('Twitch say error:', err.message);
    }
  });

  client.connect().catch((err) => {
    console.error('Twitch chat connect error:', err.message);
    console.error('Make sure TWITCH_LOGIN is a valid account and TWITCH_CHAT_OAUTH is valid.');
  });

  state.client = client;
}

module.exports = { start };
