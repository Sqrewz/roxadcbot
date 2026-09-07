const { EmbedBuilder } = require('discord.js');
const { emojiKey } = require('./reactionroles');

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

const FUN_8BALL = [
  'As I see it, yes.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.',
  'Concentrate and ask again.', "Don't count on it.", 'It is certain.', 'It is decidedly so.',
  'Most likely.', 'My reply is no.', 'My sources say no.', 'Outlook not so good.',
  'Outlook good.', 'Reply hazy, try again.', 'Signs point to yes.', 'Very doubtful.',
  'Without a doubt.', 'Yes.', 'Yes - definitely.', 'You may rely on it.',
];

const RPS = { r: '🪨 Rock', p: '📄 Paper', s: '✂️ Scissors' };

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
  const g = storage.guild(guild.id);

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
      // Also let the reported user know.
      await targetUser.send(`You have been reported in **${message.guild.name}**: *${reason}*`).catch(() => {});
      return message.reply('Report submitted. Thanks!');
    }

    // ------------------- MUSIC -------------------
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

    // ------------------- SETUP -------------------
    case 'setup': {
      if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
      const sub = (args[0] || '').toLowerCase();
      const channel = message.mentions.channels.first();

      if (sub === 'reset') {
        delete g.notifChannel;
        delete g.chatChannel;
        delete g.kickChannel;
        delete g.welcomeChannel;
        delete g.leaveChannel;
        storage.save();
        return message.reply('Settings reset for this server.');
      }
      if (sub === 'welcome' && channel) {
        g.welcomeChannel = channel.id;
        storage.save();
        return message.reply(`Welcome messages channel set to ${channel}.`);
      }
      if (sub === 'leave' && channel) {
        g.leaveChannel = channel.id;
        storage.save();
        return message.reply(`Leave messages channel set to ${channel}.`);
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
      return message.reply('Usage: !setup notifications|chatbridge|kickchat|welcome|leave <#channel>  |  !setup reset');
    }

    case 'setwelcome':
      if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
      if (!args.length) return message.reply('Usage: !setwelcome <message>  (use {user}, {tag}, {guild}, {count})');
      g.welcomeMessage = args.join(' ');
      storage.save();
      return message.reply('Welcome message set.');

    case 'setleave':
      if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
      if (!args.length) return message.reply('Usage: !setleave <message>  (use {tag}, {guild})');
      g.leaveMessage = args.join(' ');
      storage.save();
      return message.reply('Leave message set.');

    // ------------------- POLL -------------------
    case 'poll': {
      const full = args.join(' ');
      if (!full) return message.reply('Usage: !poll <question>  or  !poll <question> option1, option2, ...');
      const commaIdx = full.indexOf(',');
      let question = full;
      let options = ['Yes', 'No'];
      if (commaIdx !== -1) {
        question = full.slice(0, commaIdx).trim();
        options = full
          .slice(commaIdx + 1)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 9);
        if (!options.length) options = ['Yes', 'No'];
      }
      const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
      const yesno = ['✅', '❌'];
      const reactList = options.length === 2 && options[0] === 'Yes' && options[1] === 'No' ? yesno : nums.slice(0, options.length);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 ${question}`)
        .setDescription(options.map((o, i) => `${reactList[i]} ${o}`).join('\n'))
        .setFooter({ text: `Poll by ${message.author.tag}` })
        .setTimestamp();
      const sent = await message.channel.send({ embeds: [embed] });
      for (const r of reactList) {
        try { await sent.react(r); } catch { /* ignore */ }
      }
      return message.delete().catch(() => {});
    }

    // ------------------- XP / LEVELS -------------------
    case 'rank':
    case 'level': {
      const level = require('./level');
      const target = message.mentions.users.first() || message.author;
      const r = level.getRank(guild.id, target.id, storage);
      if (!r) return message.reply(target.id === message.author.id ? 'You have no XP yet. Chat a bit!' : 'That user has no XP yet.');
      const pct = Math.min(100, Math.round((r.currentXp / r.needed) * 100));
      const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(`Level ${r.level}`)
        .setDescription(`${target}\n**${r.xp}** total XP\n${bar} \`${r.currentXp}/${r.needed}\``)
        .setFooter({ text: 'Rank system' });
      return message.reply({ embeds: [embed] });
    }

    case 'lb':
    case 'leaderboard': {
      const level = require('./level');
      const rows = level.getLeaderboard(guild.id, storage);
      if (!rows.length) return message.reply('No XP data yet.');
      const lines = rows
        .map((r, i) => {
          const who = guild.members.cache.get(r.id) || { user: { tag: r.id } };
          return `**#${i + 1}** ${who.user ? who.user.tag : r.id} — Level ${r.level} (${r.xp} XP)`;
        })
        .join('\n');
      const embed = new EmbedBuilder().setColor(0xffa500).setTitle('🏆 Leaderboard').setDescription(lines.slice(0, 4000));
      return message.reply({ embeds: [embed] });
    }

    // ------------------- REACTION ROLES -------------------
    case 'rr': {
      const rr = g.reactionRoles || {};
      const sub = (args[0] || '').toLowerCase();

      if (sub === 'setup') {
        if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
        const channel = message.mentions.channels.first() || message.channel;
        const title = args.slice(1).join(' ') || 'React to get a role!';
        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(title)
          .setDescription('Reaction roles will appear here.');
        const sent = await channel.send({ embeds: [embed] });
        g.reactionRoles = g.reactionRoles || {};
        g.reactionRoles[sent.id] = { channelId: channel.id, roles: {} };
        g.reactionRoles[sent.id].messageId = sent.id;
        storage.save();
        return message.reply(`Reaction-role panel created! Add roles with: !rr add ${sent.id} <emoji> <@role>`);
      }

      if (sub === 'add') {
        if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
        const panelId = args[1];
        const emoji = args[2];
        const role = message.mentions.roles.first() || guild.roles.cache.find((r) => r.name.toLowerCase() === (args[3] || '').toLowerCase());
        if (!panelId || !emoji || !role) {
          return message.reply('Usage: !rr add <panelMessageId> <emoji> <@role>');
        }
        const panel = g.reactionRoles && g.reactionRoles[panelId];
        if (!panel) return message.reply('Panel not found. Create one first with !rr setup.');
        const key = emojiKey(emoji);
        panel.roles = panel.roles || {};
        panel.roles[key] = role.id;
        const channel = guild.channels.cache.get(panel.channelId);
        if (channel) {
          channel.messages.fetch(panelId).then((m) => m.react(key).catch(() => {})).catch(() => {});
        }
        storage.save();
        return message.reply(`Added ${emoji} -> ${role}.`);
      }

      if (sub === 'remove') {
        if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
        const panelId = args[1];
        const emoji = args[2];
        const panel = g.reactionRoles && g.reactionRoles[panelId];
        if (!panel || !emoji) return message.reply('Usage: !rr remove <panelMessageId> <emoji>');
        delete panel.roles[emojiKey(emoji)];
        storage.save();
        return message.reply('Role mapping removed.');
      }

      if (sub === 'list') {
        const entries = Object.entries(g.reactionRoles || {});
        if (!entries.length) return message.reply('No reaction-role panels yet. Create with !rr setup.');
        const lines = entries
          .map(([id, panel]) => {
            const maps = Object.entries(panel.roles || {})
              .map(([emoji, roleId]) => {
                const role = guild.roles.cache.get(roleId);
                return `${emoji} -> ${role ? role.name : roleId}`;
              })
              .join(', ');
            return `\`${id}\`: ${maps || 'no roles'}`;
          })
          .join('\n');
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Reaction-role panels').setDescription(lines.slice(0, 4000))] });
      }

      return message.reply('Usage: !rr setup | !rr add <msgId> <emoji> <@role> | !rr remove <msgId> <emoji> | !rr list');
    }

    // ------------------- CUSTOM COMMANDS -------------------
    case 'cc': {
      if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
      const sub = (args[0] || '').toLowerCase();
      g.customCommands = g.customCommands || {};

      if (sub === 'add') {
        const name = (args[1] || '').toLowerCase();
        const response = args.slice(2).join(' ').trim();
        if (!name || !response) return message.reply('Usage: !cc add <name> <response>');
        g.customCommands[name] = response;
        storage.save();
        return message.reply(`Custom command **!${name}** added.`);
      }

      if (sub === 'remove') {
        const name = (args[1] || '').toLowerCase();
        if (!name || !g.customCommands[name]) return message.reply('Command not found.');
        delete g.customCommands[name];
        storage.save();
        return message.reply(`Custom command **!${name}** removed.`);
      }

      if (sub === 'list') {
        const names = Object.keys(g.customCommands || {});
        if (!names.length) return message.reply('No custom commands yet. Use !cc add <name> <response>');
        return message.reply(`Custom commands: ${names.map((n) => '!' + n).join(', ')}`);
      }

      return message.reply('Usage: !cc add <name> <response> | !cc remove <name> | !cc list');
    }

    // ------------------- SCHEDULED ANNOUNCEMENTS -------------------
    case 'auto':
    case 'announce': {
      if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
      const sub = (args[0] || '').toLowerCase();
      g.announcements = g.announcements || [];

      if (sub === 'add') {
        const channel = message.mentions.channels.first();
        const hours = parseFloat(args[1]);
        const text = args.slice(2).join(' ').trim();
        if (!channel || isNaN(hours) || hours <= 0 || !text) {
          return message.reply('Usage: !auto add <#channel> <hours> <message>');
        }
        const id = Date.now().toString(36);
        g.announcements.push({ id, channelId: channel.id, message: text, intervalMs: hours * 3600 * 1000, nextRun: Date.now() + hours * 3600 * 1000 });
        storage.save();
        return message.reply(`Scheduled announcement created (every ${hours}h, id \`${id}\`).`);
      }

      if (sub === 'remove') {
        const id = args[1];
        const before = g.announcements.length;
        g.announcements = g.announcements.filter((a) => a.id !== id);
        if (g.announcements.length === before) return message.reply('ID not found. Use !auto list');
        storage.save();
        return message.reply('Scheduled announcement removed.');
      }

      if (sub === 'list') {
        if (!g.announcements.length) return message.reply('No scheduled announcements. Use !auto add <#channel> <hours> <message>');
        const lines = g.announcements.map((a) => `\`${a.id}\` — every ${Math.round(a.intervalMs / 3600000)}h → <#${a.channelId}>\n> ${a.message.slice(0, 200)}`).join('\n');
        return message.reply({ embeds: [new EmbedBuilder().setColor(0xeb459e).setTitle('📅 Scheduled announcements').setDescription(lines.slice(0, 4000))] });
      }

      return message.reply('Usage: !auto add <#channel> <hours> <message> | !auto remove <id> | !auto list');
    }

    // ------------------- AUTO-MOD -------------------
    case 'automod': {
      if (!message.member.permissions.has('ManageGuild')) return message.reply('You need Manage Server permission.');
      g.automod = g.automod || { enabled: false, words: [] };
      const sub = (args[0] || '').toLowerCase();

      if (sub === 'on') {
        g.automod.enabled = true;
        storage.save();
        return message.reply('Auto-mod is **on**. blocked words + spam protection are active.');
      }
      if (sub === 'off') {
        g.automod.enabled = false;
        storage.save();
        return message.reply('Auto-mod is **off**.');
      }
      if (sub === 'add') {
        const word = (args[1] || '').toLowerCase();
        if (!word) return message.reply('Usage: !automod add <word>');
        if (!g.automod.words.includes(word)) g.automod.words.push(word);
        storage.save();
        return message.reply(`Blocked word **${word}** added.`);
      }
      if (sub === 'remove') {
        const word = (args[1] || '').toLowerCase();
        g.automod.words = g.automod.words.filter((w) => w !== word);
        storage.save();
        return message.reply(`Blocked word removed (if it existed).`);
      }
      if (sub === 'list') {
        const words = g.automod.words.length ? g.automod.words.join(', ') : '(none)';
        return message.reply(`Auto-mod **${g.automod.enabled ? 'ON' : 'OFF'}** — blocked words: ${words}`);
      }
      return message.reply('Usage: !automod on | off | add <word> | remove <word> | list');
    }

    // ------------------- FUN -------------------
    case '8ball':
    case 'eightball': {
      if (!args.length) return message.reply('Ask a question: !8ball <question>');
      return message.reply(`🎱 ${FUN_8BALL[Math.floor(Math.random() * FUN_8BALL.length)]}`);
    }

    case 'dice':
    case 'roll': {
      const sides = Math.max(2, Math.min(1000000, parseInt(args[0], 10) || 6));
      return message.reply(`🎲 Rolled **${Math.floor(Math.random() * sides) + 1}** (1-${sides}).`);
    }

    case 'coin':
    case 'flip':
      return message.reply(Math.random() < 0.5 ? '🪙 Heads' : '🪙 Tails');

    case 'rps': {
      const choice = (args[0] || '').toLowerCase()[0];
      const comp = ['r', 'p', 's'][Math.floor(Math.random() * 3)];
      if (!RPS[choice]) return message.reply('Choose rock, paper or scissors: !rps rock');
      if (choice === comp) return message.reply(`${RPS[comp]} — It's a tie! 🤝`);
      const beat = { r: 's', p: 'r', s: 'p' };
      if (beat[choice] === comp) return message.reply(`${RPS[comp]} — You win! 🎉`);
      return message.reply(`${RPS[comp]} — I win! 😎`);
    }

    case 'slap': {
      const target = message.mentions.users.first();
      if (!target) return message.reply('Slap someone: !slap @user');
      return message.channel.send(`${message.author} slaps ${target} 🖐️`);
    }

    case 'hug': {
      const target = message.mentions.users.first();
      if (!target) return message.reply('Hug someone: !hug @user');
      return message.channel.send(`${message.author} hugs ${target} 🤗`);
    }

    case 'staff':
    case 'mods': {
      const members = guild.members.cache.filter((m) => {
        if (m.user.bot) return false;
        if (m.permissions.has('Administrator')) return true;
        if (config.modRoleId && m.roles.cache.has(config.modRoleId)) return true;
        return false;
      });
      const list = members.map((m) => `${m.user.tag} — ${m.roles.highest.name}`).join('\n') || '(none)';
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🛡️ Staff')
        .setDescription(list.slice(0, 4000));
      return message.reply({ embeds: [embed] });
    }

    case 'help':
      return message.channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle('Bot commands')
              .setDescription(
                [
                  '**Music:** !play, !skip, !stop, !leave, !volume',
                  '**Community:** !ping, !say, !poll, !report, !rank, !leaderboard',
                  '**Fun:** !8ball, !dice, !coin, !rps, !slap, !hug',
                  '**Setup (admin):** !setup, !setwelcome, !setleave, !rr, !cc, !auto, !automod',
                  'Prefix can be changed in the .env (PREFIX=!).',
                ].join('\n')
              ),
          ],
        })
        .catch(() => {});

    default: {
      // Custom commands
      const cc = g.customCommands && g.customCommands[command];
      if (cc) return message.channel.send(cc.slice(0, 2000));
      return message.reply(`Unknown command. Try ${prefix}help`);
    }
  }
}

module.exports = { handleMessage };