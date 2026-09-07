const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const configRef = require('./config');
const storageRef = require('./storage');

const commands = [];

commands.push(
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up the bot for notifications and chat bridging.')
    .addSubcommand((s) =>
      s
        .setName('notifications')
        .setDescription('Choose the channel for Twitch stream notifications.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel for stream alerts').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('chatbridge')
        .setDescription('Choose the channel where Twitch chat is mirrored.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to bridge Twitch chat').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('kickchat')
        .setDescription('Choose the channel where Kick chat is mirrored.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to bridge Kick chat').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('welcome')
        .setDescription('Choose the channel for welcome messages.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel for welcome messages').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('leave')
        .setDescription('Choose the channel for goodbye messages.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel for goodbye messages').setRequired(true))
    )
    .addSubcommand((s) => s.setName('reset').setDescription('Reset all settings for this server.'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
);

commands.push(
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency.'),
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something.')
    .addStringOption((o) => o.setName('message').setDescription('Message text').setRequired(true)),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of messages in this channel.')
    .addIntegerOption((o) => o.setName('amount').setDescription('1-100 messages').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a user to the moderators.')
    .addUserOption((o) => o.setName('user').setDescription('User to report').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a YouTube video/playlist or search a song in your voice channel.')
    .addStringOption((o) => o.setName('query').setDescription('YouTube URL or a song name to search').setRequired(true)),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music and clear the queue.'),
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track.'),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Make the bot leave the voice channel.'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the music volume (0-100).')
    .addIntegerOption((o) => o.setName('level').setDescription('Volume 0-100').setRequired(true)),
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll.')
    .addStringOption((o) => o.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption((o) => o.setName('choices').setDescription('Comma-separated options (default Yes/No)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('See your (or someone else\'s) level and XP.')
    .addUserOption((o) => o.setName('user').setDescription('User to check (default: you)').setRequired(false)),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 users by XP.'),
  new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball.')
    .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll a dice.')
    .addIntegerOption((o) => o.setName('sides').setDescription('Sides (default 6)').setRequired(false)),
  new SlashCommandBuilder().setName('coin').setDescription('Flip a coin.'),
  new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play rock-paper-scissors against the bot.')
    .addStringOption((o) =>
      o
        .setName('choice')
        .setDescription('Your choice')
        .setRequired(true)
        .addChoices(
          { name: 'Rock', value: 'rock' },
          { name: 'Paper', value: 'paper' },
          { name: 'Scissors', value: 'scissors' }
        )
    ),
  new SlashCommandBuilder().setName('staff').setDescription('Show the server staff (admins + mod role).')
);

async function register(client) {
  const guilds = client.guilds.cache;
  for (const guild of guilds.values()) {
    try {
      await guild.commands.set(commands);
    } catch (err) {
      console.error(`Could not register commands in ${guild.name}:`, err.message);
    }
  }
  console.log(`Registered ${commands.length} commands in ${guilds.size} guild(s).`);
}

function isMod(interaction) {
  const modRoleId = configRef.modRoleId;
  if (!modRoleId) return true;
  return interaction.member.roles.cache.has(modRoleId);
}

const roleMention = (guild, roleRef) => {
  const role = guild.roles.cache.get(roleRef) || guild.roles.cache.find((r) => r.name === roleRef);
  return role ? role.toString() : null;
};

async function handleInteraction(interaction, client, config, storage) {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild } = interaction;

  try {
    switch (commandName) {
      case 'ping':
        await interaction.reply(`Pong! Latency: ${client.ws.ping}ms`);
        break;

      case 'say': {
        const msg = interaction.options.getString('message');
        await interaction.reply({ content: 'Sending...', ephemeral: true });
        await interaction.channel.send(msg.slice(0, 2000));
        break;
      }

      case 'purge': {
        await interaction.deferReply({ ephemeral: true });
        if (!isMod(interaction)) {
          return interaction.editReply('You do not have permission to use this.');
        }
        let amount = interaction.options.getInteger('amount');
        amount = Math.max(1, Math.min(100, amount));
        const messages = await interaction.channel.bulkDelete(amount, true);
        return interaction.editReply(`Deleted ${messages.size} message(s).`);
      }

      case 'report': {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        let target = configRef.reportChannelId
          ? interaction.guild.channels.cache.get(configRef.reportChannelId)
          : null;
        if (!target) target = interaction.channel;

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('New report')
          .setDescription(`**Reporter:** ${interaction.user}\n**Reported:** ${user}\n**Reason:** ${reason}`)
          .setTimestamp();
        await target.send({ embeds: [embed] });
        await user.send(`You have been reported in **${interaction.guild.name}**: *${reason}*`).catch(() => {});
        await interaction.reply({ content: 'Report submitted. Thanks!', ephemeral: true });
        break;
      }

      case 'play': {
        const music = require('./music');
        const query = interaction.options.getString('query');
        const voice = interaction.member.voice.channel;
        if (!voice) {
          return interaction.reply({ content: 'You need to be in a voice channel first.', ephemeral: true });
        }
        await interaction.deferReply();
        try {
          const result = await music.play(guild, voice, query, interaction.channel);
          await interaction.editReply({ content: result.ok ? result.message : 'Could not play: ' + result.message });
        } catch (err) {
          await interaction.editReply({ content: 'Error: ' + err.message });
        }
        break;
      }

      case 'stop': {
        const music = require('./music');
        music.stop(guild);
        await interaction.reply({ content: 'Music stopped and queue cleared.', ephemeral: true });
        break;
      }

      case 'skip': {
        const music = require('./music');
        music.skip(guild);
        await interaction.reply({ content: 'Skipped.', ephemeral: true });
        break;
      }

      case 'leave': {
        const music = require('./music');
        music.leave(guild);
        await interaction.reply({ content: 'Left the voice channel.', ephemeral: true });
        break;
      }

      case 'volume': {
        const music = require('./music');
        const level = Math.max(0, Math.min(100, interaction.options.getInteger('level')));
        const data = music.players.get(guild.id);
        if (data) {
          data.volume = level;
        }
        await interaction.reply({ content: `Volume set to ${level}.`, ephemeral: true });
        break;
      }

      case 'setup': {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.editReply('You need Manage Server permission.');
        }
        const sub = interaction.options.getSubcommand();
        const g = storage.guild(interaction.guildId);

        switch (sub) {
          case 'notifications': {
            const channel = interaction.options.getChannel('channel');
            if (!channel.isTextBased()) {
              return interaction.editReply('Please choose a text channel.');
            }
            g.notifChannel = channel.id;
            storage.save();
            return interaction.editReply(`Stream notifications channel set to ${channel}.`);
          }
          case 'chatbridge': {
            const channel = interaction.options.getChannel('channel');
            if (!channel.isTextBased()) {
              return interaction.editReply('Please choose a text channel.');
            }
            g.chatChannel = channel.id;
            storage.save();
            return interaction.editReply(`Twitch chat bridge set to ${channel}.`);
          }
          case 'kickchat': {
            const channel = interaction.options.getChannel('channel');
            if (!channel.isTextBased()) {
              return interaction.editReply('Please choose a text channel.');
            }
            g.kickChannel = channel.id;
            storage.save();
            return interaction.editReply(`Kick chat bridge set to ${channel}.`);
          }
          case 'welcome': {
            const channel = interaction.options.getChannel('channel');
            if (!channel.isTextBased()) {
              return interaction.editReply('Please choose a text channel.');
            }
            g.welcomeChannel = channel.id;
            storage.save();
            return interaction.editReply(`Welcome messages channel set to ${channel}.`);
          }
          case 'leave': {
            const channel = interaction.options.getChannel('channel');
            if (!channel.isTextBased()) {
              return interaction.editReply('Please choose a text channel.');
            }
            g.leaveChannel = channel.id;
            storage.save();
            return interaction.editReply(`Goodbye messages channel set to ${channel}.`);
          }
          case 'reset': {
            const g0 = storage.guild(interaction.guildId);
            delete g0.notifChannel;
            delete g0.chatChannel;
            delete g0.kickChannel;
            delete g0.welcomeChannel;
            delete g0.leaveChannel;
            storage.save();
            return interaction.editReply('Settings reset for this server.');
          }
        }
        break;
      }

case 'poll': {
        const question = interaction.options.getString('question');
        const rawChoices = interaction.options.getString('choices');
        let options = rawChoices
          ? rawChoices.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 9)
          : ['Yes', 'No'];
        if (!options.length) options = ['Yes', 'No'];
        const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        const yesno = ['✅', '❌'];
        const reactList = options.length === 2 && options[0] === 'Yes' && options[1] === 'No' ? yesno : nums.slice(0, options.length);
        await interaction.deferReply({ ephemeral: false });
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`📊 ${question}`)
          .setDescription(options.map((o, i) => `${reactList[i]} ${o}`).join('\n'))
          .setFooter({ text: `Poll by ${interaction.user.tag}` })
          .setTimestamp();
        const sent = await interaction.channel.send({ embeds: [embed] });
        for (const r of reactList) {
          try { await sent.react(r); } catch { /* ignore */ }
        }
        await interaction.editReply('Poll created.');
        break;
      }

      case 'rank': {
        const levelMod = require('./level');
        const target = interaction.options.getUser('user') || interaction.user;
        const r = levelMod.getRank(guild.id, target.id, storage);
        if (!r) {
          return interaction.reply({ content: 'No XP data yet. Chat a bit!', ephemeral: true });
        }
        const pct = Math.min(100, Math.round((r.currentXp / r.needed) * 100));
        const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
        const embed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle(`Level ${r.level}`)
          .setDescription(`${target}\n**${r.xp}** total XP\n${bar} \`${r.currentXp}/${r.needed}\``)
          .setFooter({ text: 'Rank system' });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'leaderboard': {
        const levelMod = require('./level');
        const rows = levelMod.getLeaderboard(guild.id, storage);
        if (!rows.length) return interaction.reply({ content: 'No XP data yet.', ephemeral: true });
        const lines = rows
          .map((r, i) => {
            const who = guild.members.cache.get(r.id) || { user: { tag: r.id } };
            return `**#${i + 1}** ${who.user ? who.user.tag : r.id} — Level ${r.level} (${r.xp} XP)`;
          })
          .join('\n');
        const embed = new EmbedBuilder().setColor(0xffa500).setTitle('🏆 Leaderboard').setDescription(lines.slice(0, 4000));
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case '8ball': {
        const Q = interaction.options.getString('question');
        const answers = [
          'As I see it, yes.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.',
          'Concentrate and ask again.', "Don't count on it.", 'It is certain.', 'It is decidedly so.',
          'Most likely.', 'My reply is no.', 'My sources say no.', 'Outlook good.', 'Reply hazy, try again.',
          'Signs point to yes.', 'Very doubtful.', 'Without a doubt.', 'Yes.', 'Yes - definitely.',
        ];
        await interaction.reply(`🎱 **${Q}**\n${answers[Math.floor(Math.random() * answers.length)]}`);
        break;
      }

      case 'dice': {
        const sides = Math.max(2, Math.min(1000000, interaction.options.getInteger('sides') || 6));
        await interaction.reply(`🎲 Rolled **${Math.floor(Math.random() * sides) + 1}** (1-${sides}).`);
        break;
      }

      case 'coin': {
        await interaction.reply(Math.random() < 0.5 ? '🪙 Heads' : '🪙 Tails');
        break;
      }

      case 'rps': {
        const choice = interaction.options.getString('choice')[0]; // r, p, s
        const comp = ['r', 'p', 's'][Math.floor(Math.random() * 3)];
        const RPS = { r: '🪨 Rock', p: '📄 Paper', s: '✂️ Scissors' };
        if (choice === comp) return interaction.reply(`${RPS[comp]} — It's a tie! 🤝`);
        const beat = { r: 's', p: 'r', s: 'p' };
        if (beat[choice] === comp) return interaction.reply(`${RPS[comp]} — You win! 🎉`);
        return interaction.reply(`${RPS[comp]} — I win! 😎`);
      }

      case 'staff': {
        const members = guild.members.cache.filter((m) => {
          if (m.user.bot) return false;
          if (m.permissions.has('Administrator')) return true;
          if (config.modRoleId && m.roles.cache.has(config.modRoleId)) return true;
          return false;
        });
        const list = members.map((m) => `${m.user.tag} — ${m.roles.highest.name}`).join('\n') || '(none)';
        const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('🛡️ Staff').setDescription(list.slice(0, 4000));
        await interaction.reply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (err) {
    console.error(`Command ${commandName} error:`, err);
    if (interaction.deferred || interaction.replied) {
      interaction.editReply('An error occurred.').catch(() => {});
    } else {
      interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
}

module.exports = { register, handleInteraction };
