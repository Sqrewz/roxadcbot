const lastXp = new Map();

const XP_PER_LEVEL = 50; // level N requires 50*N^2 total XP
const XP_COOLDOWN = 60 * 1000; // one XP award per minute per user

function levelFromXp(xp) {
  return Math.floor(Math.sqrt(xp / XP_PER_LEVEL));
}

function xpForLevel(level) {
  return XP_PER_LEVEL * level * level;
}

function handleMessage(message, storage) {
  if (message.author.bot || !message.guild) return;

  const key = `${message.guild.id}-${message.author.id}`;
  const now = Date.now();
  if (now - (lastXp.get(key) || 0) < XP_COOLDOWN) return;
  lastXp.set(key, now);
  if (lastXp.size > 3000) lastXp.clear();

  const g = storage.guild(message.guild.id);
  g.xp = g.xp || {};
  const user = (g.xp[message.author.id] = g.xp[message.author.id] || { xp: 0, announcedLevel: 0 });

  user.xp += Math.floor(Math.random() * 10) + 5;
  const level = levelFromXp(user.xp);
  if (level > user.announcedLevel) {
    user.announcedLevel = level;
    message.channel.send(`🎉 ${message.author} reached level **${level}**!`).catch(() => {});
  }
  storage.save();
}

function getRank(guildId, userId, storage) {
  const g = storage.guild(guildId);
  if (!g.xp || !g.xp[userId]) return null;
  const u = g.xp[userId];
  const level = levelFromXp(u.xp);
  return {
    xp: u.xp,
    level,
    currentXp: u.xp - xpForLevel(level),
    needed: xpForLevel(level + 1) - xpForLevel(level),
  };
}

function getLeaderboard(guildId, storage) {
  const g = storage.guild(guildId);
  if (!g.xp) return [];
  return Object.entries(g.xp)
    .map(([id, u]) => ({ id, xp: u.xp, level: levelFromXp(u.xp) }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);
}

module.exports = { handleMessage, getRank, getLeaderboard, levelFromXp, xpForLevel };