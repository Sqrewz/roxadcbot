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
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
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
  const activity = { name: config.activity, type };
  if (type === ActivityType.Streaming && config.activityUrl) activity.url = config.activityUrl;
  try {
    await client.user.setPresence({
      status,
      activities: [activity],
    });
  } catch (e) {
    console.error('Could not set presence:', e.message);
  }

  const commands = require('./commands');
  commands.register(client).catch((e) => console.error('Command register error:', e));

  require('./scheduler').start(client, storage);

  const notifications = require('./notifications');
  try {
    notifications.start(client, config, storage);
  } catch (e) {
    console.error('Notifications error:', e.message);
  }

  if (config.twitchLogin) {
    try {
      const chatbridge = require('./chatbridge');
      chatbridge.start(client, config, storage);
    } catch (e) {
      console.error('Twitch chat bridge error:', e.message);
    }
  } else {
    console.warn('TWITCH_LOGIN not set - Twitch chat bridge disabled.');
  }

  if (config.kickChannel) {
    try {
      const kickbridge = require('./kickbridge');
      kickbridge.start(client, config, storage);
    } catch (e) {
      console.error('Kick chat bridge error:', e.message);
    }
  } else {
    console.warn('KICK_CHANNEL not set - Kick chat bridge disabled.');
  }
});

// Prevent a single async error from killing the whole bot.
// Hosting platforms (Replit) often fail to launch helper browsers
// (e.g. puppeteer for Kick); log it instead of crashing.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.message ? err.message : err);
});

client.on(Events.InteractionCreate, (interaction) => {
  require('./commands').handleInteraction(interaction, client, config, storage);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    const blocked = await require('./automod').handleMessage(message, config, storage);
    if (blocked) return;
  } catch { /* never let automod crash a command */ }
  require('./level').handleMessage(message, storage);
  require('./prefix').handleMessage(message, client, config, storage);
});

client.on(Events.GuildMemberAdd, (member) => {
  require('./welcome').handleMemberAdd(member, storage);
});

client.on(Events.GuildMemberRemove, (member) => {
  require('./welcome').handleMemberRemove(member, storage);
});

client.on(Events.MessageReactionAdd, (reaction, user) => {
  require('./reactionroles').handleReaction(reaction, user, storage, true);
});

client.on(Events.MessageReactionRemove, (reaction, user) => {
  require('./reactionroles').handleReaction(reaction, user, storage, false);
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
