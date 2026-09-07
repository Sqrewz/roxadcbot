const { EmbedBuilder } = require('discord.js');

function applyTemplate(text, member) {
  return (text || '')
    .replace(/\{user\}/g, member.toString())
    .replace(/\{tag\}/g, member.user.tag)
    .replace(/\{guild\}/g, member.guild.name)
    .replace(/\{count\}/g, String(member.guild.memberCount));
}

function handleMemberAdd(member, storage) {
  const g = storage.guild(member.guild.id);
  const channelId = g.welcomeChannel;
  if (!channelId) return;
  const ch = member.guild.channels.cache.get(channelId);
  if (!ch || !ch.isTextBased()) return;

  const text = applyTemplate(g.welcomeMessage || 'Welcome {user} to **{guild}**! 🎉', member);
  ch.send(text.slice(0, 2000)).catch((e) => console.error('Welcome send error:', e.message));
}

function handleMemberRemove(member, storage) {
  const g = storage.guild(member.guild.id);
  const channelId = g.leaveChannel;
  if (!channelId) return;
  const ch = member.guild.channels.cache.get(channelId);
  if (!ch || !ch.isTextBased()) return;

  const text = applyTemplate(g.leaveMessage || '{tag} left **{guild}**. 👋', member);
  ch.send(text.slice(0, 2000)).catch((e) => console.error('Leave send error:', e.message));
}

module.exports = { handleMemberAdd, handleMemberRemove };