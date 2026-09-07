const spam = new Map();

function isSpam(authorId) {
  const now = Date.now();
  const arr = spam.get(authorId) || [];
  arr.push(now);
  const recent = arr.filter((t) => now - t < 8000);
  if (recent.length > 50) recent.length = 50;
  spam.set(authorId, recent);
  if (spam.size > 5000) spam.clear();
  return recent.length > 5;
}

async function handleMessage(message, config, storage) {
  if (message.author.bot || !message.guild) return false;

  const g = storage.guild(message.guild.id);
  if (!g.automod || !g.automod.enabled) return false;

  // Moderators are exempt.
  const modRoleId = config.modRoleId;
  if (modRoleId && message.member && message.member.roles.cache.has(modRoleId)) return false;

  const words = (g.automod.words || []).filter(Boolean);
  const firstWord = words.find((w) => message.content.toLowerCase().includes(w.toLowerCase()));
  const spamHit = isSpam(message.author.id);

  if (firstWord || spamHit) {
    try {
      await message.delete();
    } catch { /* already gone */ }
    const reason = firstWord ? `it contained a blocked word (${firstWord})` : 'you are sending too many messages too fast';
    message.author.send(`Your message in **${message.guild.name}** was removed automatically: ${reason}.`).catch(() => {});
    return true;
  }
  return false;
}

module.exports = { handleMessage };