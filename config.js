require('dotenv').config();

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,

  twitchClientId: process.env.TWITCH_CLIENT_ID,
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET,
  twitchChannels: (process.env.TWITCH_CHANNELS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  twitchLogin: (process.env.TWITCH_LOGIN || '').toLowerCase(),
  twitchChatOAuth: process.env.TWITCH_CHAT_OAUTH || '',

  modRoleId: process.env.MOD_ROLE_ID || '',
  reportChannelId: process.env.REPORT_CHANNEL_ID || '',

  kickChannel: (process.env.KICK_CHANNEL || '').toLowerCase(),

  // Prefix for text commands (e.g. !play)
  prefix: process.env.PREFIX || '!',

  // Presence / status
  activity: process.env.ACTIVITY || 'RoxaTheChief',
  activityType: process.env.ACTIVITY_TYPE || 'Watching',
  // Required for the purple "Streaming" badge: your stream URL (e.g. https://www.twitch.tv/mystream)
  activityUrl: process.env.ACTIVITY_URL || '',
  // Status: online | idle | dnd | invisible
  status: process.env.STATUS || 'dnd',
};
