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
    .addIntegerOption((o) => o.setName('level').setDescription('Volume 0-100').setRequired(true))
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
          case 'reset': {
            const g0 = storage.guild(interaction.guildId);
            delete g0.notifChannel;
            delete g0.chatChannel;
            delete g0.kickChannel;
            storage.save();
            return interaction.editReply('Settings reset for this server.');
          }
        }
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
