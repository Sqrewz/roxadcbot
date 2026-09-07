const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  StreamType,
} = require('@discordjs/voice');
const { PermissionsBitField } = require('discord.js');
const pdl = require('play-dl');

const players = new Map(); // guildId -> player state

const VOLUME = 25;

function setupPlayer(guild, connection) {
  const player = createAudioPlayer();
  const data = {
    connection,
    player,
    queue: [], // [{ url, title }]
    currentTitle: null,
    textChannel: null,
    volume: VOLUME,
  };

  player.on(AudioPlayerStatus.Idle, () => playNext(guild, data));
  player.on('error', (err) => {
    console.error('Audio player error:', err.message);
    // Try to keep the queue moving past a bad track.
    if (data.player.state.status !== AudioPlayerStatus.Playing) playNext(guild, data);
  });

  connection.on('error', (err) => console.error('Voice connection error:', err.message));
  connection.subscribe(player);
  players.set(guild.id, data);
  return data;
}

async function ensureConnection(voiceChannel) {
  const guild = voiceChannel.guild;
  const me = guild.members.me;
  if (me) {
    const perms = voiceChannel.permissionsFor(me);
    if (perms && !perms.has(PermissionsBitField.Flags.Connect)) {
      throw new Error('I do not have **Connect** permission in that voice channel.');
    }
    if (perms && !perms.has(PermissionsBitField.Flags.Speak)) {
      throw new Error('I do not have **Speak** permission in that voice channel.');
    }
  }

  let data = players.get(guild.id);
  if (data && data.connection) {
    const st = data.connection.state.status;
    if (st === VoiceConnectionStatus.Ready) return data;
    if (st === VoiceConnectionStatus.Signalling) {
      try {
        await entersState(data.connection, VoiceConnectionStatus.Ready, 30000);
        return data;
      } catch {
        // fall through and rejoin
      }
    }
    data.connection.destroy();
    players.delete(guild.id);
  }
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    selfDeaf: true,
    adapterCreator: guild.voiceAdapterCreator,
  });
  return setupPlayer(guild, connection);
}

async function playNext(guild, data) {
  const item = data.queue.shift();
  if (!item) return;
  try {
    const stream = await pdl.stream(item.url);
    const resource = createAudioResource(stream.stream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume.setVolume(data.volume / 100);
    data.currentTitle = item.title;
    data.player.play(resource);
    if (data.textChannel) {
      data.textChannel.send(`Now playing: **${item.title}**`).catch(() => {});
    }
  } catch (err) {
    console.error('Playback error:', err.message);
    return playNext(guild, data);
  }
}

// Resolve a user query into a list of { url, title } items.
// query can be: YouTube URL (video or playlist) or a free-text search.
async function resolveQuery(query) {
  if (/^(https?:\/\/)?(www\.)?youtube\.com\/playlist/.test(query) || /^https?:\/\/(www\.)?youtube\.com\/playlist/.test(query)) {
    const list = await pdl.playlist_info(query, { incomplete: true });
    const tracks = await list.all_videos();
    return tracks
      .filter((v) => v && v.id)
      .map((v) => ({ url: v.url, title: v.title }));
  }
  if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(query)) {
    const info = await pdl.video_basic_info(query);
    return [{ url: info.video_details.url, title: info.video_details.title }];
  }
  // Free-text search
  const results = await pdl.search(query, { limit: 1 });
  if (!results.length) throw new Error('No results found for: ' + query);
  return [{ url: results[0].url, title: results[0].title }];
}

// Play a query in the given voice channel. If something is already playing,
// it is added to the queue.
async function play(guild, voiceChannel, query, textChannel) {
  let data;
  try {
    data = await ensureConnection(voiceChannel);
  } catch (e) {
    return { ok: false, message: e.message };
  }
  data.textChannel = textChannel;
  try {
    await entersState(data.connection, VoiceConnectionStatus.Ready, 30000);
  } catch (e) {
    console.error('Could not join voice in time:', e.message);
    if (data.connection) data.connection.destroy();
    players.delete(guild.id);
    return { ok: false, message: 'Could not join the voice channel in time. Make sure the bot has Connect/Speak permission, and note that voice may be blocked on some free hosts (Replit).' };
  }

  let items;
  try {
    items = await resolveQuery(query);
  } catch (err) {
    return { ok: false, message: err.message };
  }
  if (!items.length) return { ok: false, message: 'Nothing found to play.' };

  const isIdle = data.player.state.status !== 'playing';
  for (const it of items) {
    data.queue.push(it);
  }
  if (isIdle) {
    await playNext(guild, data);
  }
  const first = items[0];
  return { ok: true, message: isIdle ? `Playing: **${first.title}**` : `Queued: **${first.title}**${items.length > 1 ? ` (+${items.length - 1} more)` : ''}` };
}

function skip(guild) {
  const data = players.get(guild.id);
  if (!data) return;
  data.player.stop();
}

function stop(guild) {
  const data = players.get(guild.id);
  if (!data) return;
  data.player.stop();
  data.queue = [];
}

function leave(guild) {
  const data = players.get(guild.id);
  if (!data) return;
  data.player.stop();
  data.queue = [];
  if (data.connection) data.connection.destroy();
  players.delete(guild.id);
}

module.exports = {
  play,
  skip,
  stop,
  leave,
  players,
};
