const { EmbedBuilder } = require('discord.js');

let discordRef = null;

function findDiscordChannel(storage) {
  if (!discordRef) return null;
  for (const guild of discordRef.guilds.cache.values()) {
    const g = storage.guild(guild.id);
    if (!g || !g.kickChannel) continue;
    const ch = discordRef.channels.cache.get(g.kickChannel);
    if (ch) return ch;
  }
  return null;
}

// Read-only Kick chat mirror. No account, no developer app, no client id needed.
function start(client, config, storage) {
  discordRef = client;

  if (!config.kickChannel) {
    console.warn('KICK_CHANNEL not set - Kick chat bridge disabled.');
    return;
  }

  let kickClient;
  try {
    const { createClient } = require('@retconned/kick-js');
    kickClient = createClient(config.kickChannel, { logger: false, readOnly: true });
  } catch (err) {
    console.error('Could not load @retconned/kick-js. Run "npm install".', err.message);
    return;
  }

  kickClient.on('ready', () => {
    console.log(`Kick chat connected (read-only): ${config.kickChannel}`);
  });

  kickClient.on('ChatMessage', (message) => {
    try {
      const dc = findDiscordChannel(storage);
      if (!dc) return;
      const author = (message.sender && message.sender.username) || 'unknown';
      const content = message.content || '';
      const embed = new EmbedBuilder()
        .setColor(0x53fc18)
        .setAuthor({ name: `${author} (Kick)` })
        .setDescription(content.length ? content : '(message removed)')
        .setFooter({ text: 'Kick chat' })
        .setTimestamp();
      dc.send({ embeds: [embed] }).catch((e) => console.error('Kick->DC send error:', e.message));
    } catch (err) {
      console.error('Kick ChatMessage handler error:', err.message);
    }
  });

  kickClient.on('error', (err) => {
    console.error('Kick client error:', err && err.message ? err.message : err);
  });
}

module.exports = { start };
