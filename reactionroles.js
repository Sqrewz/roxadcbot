// Extracts a stable emoji key (custom or unicode) from a reaction string.
function emojiKey(raw) {
  const custom = (raw || '').match(/<a?:.+?:(\d+)>/);
  if (custom) return custom[0];
  const uni = (raw || '').trim().match(/\p{Extended_Pictographic}+/u);
  if (uni) return uni[0];
  return (raw || '').trim();
}

async function handleReaction(reaction, user, storage, isAdd) {
  if (!user || user.bot) return;
  const message = reaction.message;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  if (message.partial) {
    try { await message.fetch(); } catch { return; }
  }
  const guild = message.guild;
  if (!guild) return;

  const g = storage.guild(guild.id);
  const rr = g.reactionRoles && g.reactionRoles[message.id];
  if (!rr || !rr.roles) return;

  const key = emojiKey(reaction.emoji.toString());
  const roleId = rr.roles[key];
  if (!roleId) return;

  const role = guild.roles.cache.get(roleId);
  if (!role) return;

  let member = guild.members.cache.get(user.id);
  if (!member) {
    try { member = await guild.members.fetch(user.id); } catch { return; }
  }
  if (isAdd) {
    member.roles.add(role).catch((e) => console.error('RR add error:', e.message));
  } else {
    member.roles.remove(role).catch((e) => console.error('RR remove error:', e.message));
  }
}

module.exports = { handleReaction, emojiKey };