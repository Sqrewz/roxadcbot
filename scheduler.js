// Scheduled announcements: runs every minute, sends due messages.
function start(client, storage) {
  setInterval(() => {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
      const g = storage.guild(guild.id);
      if (!g.announcements || !g.announcements.length) continue;
      let changed = false;
      for (const a of g.announcements) {
        if (a.nextRun && now >= a.nextRun) {
          const ch = guild.channels.cache.get(a.channelId);
          if (ch && ch.isTextBased()) {
            ch.send((a.message || '').slice(0, 2000)).catch((e) => console.error('Scheduled send error:', e.message));
          }
          a.nextRun = now + a.intervalMs;
          changed = true;
        }
      }
      if (changed) storage.save();
    }
  }, 60 * 1000);
}

module.exports = { start };