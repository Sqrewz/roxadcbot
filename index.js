const { Client, GatewayIntentBits, Partials, Events, ActivityType, PresenceUpdateStatus } = require('discord.js');
const http = require('http');
const config = require('./config');
const storage = require('./storage');

storage.load();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Presence: visible, activity text, status per config (default Do Not Disturb).
  const typeMap = {
    Watching: ActivityType.Watching,
    Playing: ActivityType.Playing,
    Listening: ActivityType.Listening,
    Streaming: ActivityType.Streaming,
    Competing: ActivityType.Competing,
  };
  const statusMap = {
    online: PresenceUpdateStatus.Online,
    idle: PresenceUpdateStatus.Idle,
    dnd: PresenceUpdateStatus.DoNotDisturb,
    invisible: PresenceUpdateStatus.Invisible,
  };
  const type = typeMap[config.activityType] || ActivityType.Watching;
  const status = statusMap[config.status] || PresenceUpdateStatus.DoNotDisturb;
  try {
    await client.user.setPresence({
      status,
      activities: [{ name: config.activity, type }],
    });
  } catch (e) {
    console.error('Could not set presence:', e.message);
  }

  const commands = require('./commands');
  commands.register(client).catch((e) => console.error('Command register error:', e));

  const notifications = require('./notifications');
  notifications.start(client, config, storage);

  if (config.twitchLogin) {
    const chatbridge = require('./chatbridge');
    chatbridge.start(client, config, storage);
  } else {
    console.warn('TWITCH_LOGIN not set - Twitch chat bridge disabled.');
  }

  if (config.kickChannel) {
    const kickbridge = require('./kickbridge');
    kickbridge.start(client, config, storage);
  } else {
    console.warn('KICK_CHANNEL not set - Kick chat bridge disabled.');
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  require('./commands').handleInteraction(interaction, client, config, storage);
});

client.on(Events.MessageCreate, (message) => {
  require('./prefix').handleMessage(message, client, config, storage);
});

// =========================================================
// Keep-alive HTTP server (for Replit / UptimeRobot and similar)
// Hosting platforms keep the bot alive only while it receives
// requests. Register this URL in UptimeRobot so the bot never sleeps.
// =========================================================
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Stream community bot is running!');
  })
  .listen(PORT, () => {
    console.log(`Keep-alive server listening on port ${PORT}`);
  });

client.login(config.discordToken).catch((err) => {
  console.error('Failed to log in. Check DISCORD_TOKEN in .env:', err.message);
  process.exit(1);
});
