const { EmbedBuilder } = require('discord.js');

// Extracts quoted args, e.g. !say hello world -> args = ["hello world"]
function parseArgs(content) {
  const tokens = [];
  const parts = content.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  for (const p of parts) {
    if (p.startsWith('"') && p.endsWith('"')) tokens.push(p.slice(1, -1));
    else tokens.push(p);
  }
  return tokens;
}

async function handleMessage(message, client, config, storage) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefix = config.prefix || '!';
  if (!message.content.startsWith(prefix)) return;

  const content = message.content.slice(prefix.length).trim();
  if (!content) return;

  const argIndex = content.search(/\s/);
  const rawArgs = argIndex === -1 ? content : content.slice(argIndex).trim();
  const args = parseArgs(rawArgs);
  const command = (argIndex === -1 ? content : content.slice(0, argIndex)).toLowerCase();

  const guild = message.guild;
  const userId = message.author.id;

  const isMod = () => {
    const modRoleId = config.modRoleId;
    if (!modRoleId) return true;
    return message.member.roles.cache.has(modRoleId);
  };

  const music = () => require('./music');

  switch (command) {
    case 'ping':
      return message.reply(`Pong! Latency: ${client.ws.ping}ms`);

    case 'say':
      if (!args.length) return message.reply('Usage: !say <message>');
      return message.channel.send(args.join(' ').slice(0, 2000)).then(() => message.delete().catch(() => {}));

    case 'purge': {
      if (!isMod()) return message.reply('You do not have permission to use this.');
      const amount = Math.max(1, Math.min(100, parseInt(args[0], 10) || 5));
      const deleted = await message.channel.bulkDelete(amount, true);
      return message.reply(`Deleted ${deleted.size} message(s).`).then((m) => setTimeout(() => m.delete().catch(() => {}), 3000));
    }

    case 'report': {
      const targetUser = message.mentions.users.first();
      if (!targetUser) return message.reply('Usage: !report @user [reason]');
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('New report')
        .setDescription(`**Reporter:** ${message.author}\n**Reported:** ${targetUser}\n**Reason:** ${reason}`)
        .setTimestamp();
      const target = config.reportChannelId ? guild.channels.cache.get(config.reportChannelId) : null;
      if (target) {
        await target.send({ embeds: [embed] });
      } else {
        await message.channel.send({ embeds: [embed] });
      }
      return message.reply('Report submitted. Thanks!');
    }

    case 'play': {
      const query = args.join(' ');
      if (!query) return message.reply('Usage: !play <YouTube URL / song name>');
      const voice = message.member.voice.channel;
      if (!voice) return message.reply('You need to be in a voice channel first.');
      const result = await music().play(guild, voice, query, message.channel);
      return message.reply(result.ok ? result.message : 'Could not play: ' + result.message);
    }

    case 'stop':
      music().stop(guild);
      return message.reply('Music stopped and queue cleared.');

    case 'skip':
      music().skip(guild);
      return message.reply('Skipped.');

    case 'leave':
      music().leave(guild);
      return message.reply('Left the voice channel.');

    case 'volume': {
      const level = Math.max(0, Math.min(100, parseInt(args[0], 10)));
      if (isNaN(level)) return message.reply('Usage: !volume <0-100>');
      const data = music().players.get(guild.id);
      if (data) data.volume = level;
      return message.reply(`Volume set to ${level}.`);
    }

    case 'setup': {
      // !setup notifications #channel | !setup chatbridge #channel | !setup kickchat #channel | !setup reset
      if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
      const sub = (args[0] || '').toLowerCase();
      const g = storage.guild(guild.id);
      const channel = message.mentions.channels.first();

      if (sub === 'reset') {
        delete g.notifChannel;
        delete g.chatChannel;
        delete g.kickChannel;
        storage.save();
        return message.reply('Settings reset for this server.');
      }
      if (sub === 'notifications' && channel) {
        g.notifChannel = channel.id;
        storage.save();
        return message.reply(`Stream notifications channel set to ${channel}`);
      }
      if (sub === 'chatbridge' && channel) {
        g.chatChannel = channel.id;
        storage.save();
        return message.reply(`Twitch chat bridge set to ${channel}`);
      }
      if (sub === 'kickchat' && channel) {
        g.kickChannel = channel.id;
        storage.save();
        return message.reply(`Kick chat bridge set to ${channel}`);
      }
      return message.reply('Usage: !setup notifications|chatbridge|kickchat <#channel>  |  !setup reset');
    }

    default:
      return message.reply(`Unknown command. Try ${prefix}help`);
  }
}

module.exports = { handleMessage };