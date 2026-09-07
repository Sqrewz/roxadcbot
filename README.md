# Stream Community Bot

A community Discord bot for your streaming server. Built with JavaScript (discord.js + tmi.js).

## Features

- **Stream notifications** - Posts a nice embed when you (or other tracked channels) go live, and when they go offline.
- **Twitch chat bridge** - Mirrors your Twitch chat into a Discord channel, and lets you send messages back to Twitch from Discord (so you can moderate chat from your server).
- **Kick chat bridge** - Mirrors your Kick chat into a Discord channel. Read-only, no account/client-id needed.
- **Presence / status** - Shows as online with a "Watching RoxaTheChief" activity (configurable).
- **Voice music** - Play YouTube music with `/play` (video, playlist, or a song search). No API keys or Spotify account needed.
- **Moderation & community** - Purge, report, say, ping, and per-server setup.

## Requirements

- Node.js 18 or newer (https://nodejs.org)
- A Discord bot (https://discord.com/developers/applications) with the **Voice States** intent enabled
- A Twitch app (https://dev.twitch.tv/console/apps)
## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create your `.env` file:
   ```
   copy .env.example .env
   ```
   Then fill in the values (see below).

3. Start the bot:
   ```
   npm start
   ```

> Note: `npm install` also pulls `ffmpeg-static`, `@discordjs/opus` and `libsodium-wrappers`, so no manual FFmpeg install is needed.

### Getting a Discord bot token

1. Go to https://discord.com/developers/applications and click **New Application**.
2. Go to **Bot** > **Add Bot**.
3. Under **TOKEN** click **Reset** and copy it into `DISCORD_TOKEN`.
4. On the **Bot** page, enable the **Server Members** and **Message Content** and **Presence** intents if asked.
5. Under the **OAuth2 > URL Generator** tab, select scopes `bot` and `applications.commands`.
6. Under **Bot Permissions** select: **Send Messages**, **Embed Links**, **Manage Messages**, **Read Message History**, **Connect**, **Speak**, **Manage Server** (or just pick **Administrator**).
7. Copy the generated invite URL and open it in a browser to add the bot to your server.

### Getting Twitch credentials

1. Go to https://dev.twitch.tv/console/apps and click **Register Your Application**.
2. Set OAuth Redirect URL to `http://localhost`.
3. Copy the **Client ID** into `TWITCH_CLIENT_ID`.
4. Click **New Secret** and copy it into `TWITCH_CLIENT_SECRET`.

### Enabling the Twitch chat bridge

- Set `TWITCH_LOGIN` to a lowercase Twitch username that can join your channel's chat (your own account or a bot account).
- To send messages from Discord into Twitch chat, generate a chat OAuth token at https://twitchapps.com/tmi/ (while logged in as that account) and paste it into `TWITCH_CHAT_OAUTH`. Without it, only Twitch->Discord relaying works.

### Enabling the Kick chat bridge

- Set `KICK_CHANNEL` to your Kick channel name (lowercase). **Reading Kick chat requires no credentials** - just this name.
- Run `/setup kickchat #channel` in Discord to pick where Kick chat appears.
- The bridge is read-only (Kick → Discord). Kick has no public API for sending chat, so Discord→Kick isn't supported.

### Voice music

The bot plays music over YouTube (no API key needed). You choose what plays on the fly with commands:

- Join a voice channel, then use `/play` — it accepts a YouTube **video URL**, a **playlist URL**, or just a **song name to search**.
- Control with `/play`, `/skip`, `/stop`, `/leave`, `/volume`.

Example:
```
/play lofi beats to relax      -> searches and plays the top result
/play https://youtube.com/watch?v=abc123
/play https://youtube.com/playlist?list=XYZ
```

The bot joins the voice channel you are in when you run `/play`. There is no Spotify account setup needed.

### Hosting 24/7 on Replit + UptimeRobot

The bot includes a built-in keep-alive HTTP server (default port 3000) so hosting platforms keep it alive.

1. In Replit, create a new **Node.js** repl and upload this project's files (or push the folder to a GitHub repo and import it).
2. Put your `.env` values into **Secrets** tab instead of the file (still works).
3. Run it — the console will show `Keep-alive server listening on port 3000`.
4. In the Replit "Webview" or the URL under the repl (e.g. `https://yourbot.repl.co`), copy that URL.
5. Create a free monitor at https://uptimerobot.com with that URL — it pings your repl so the bot never sleeps.

Note: Replit stops free repls when the tab is closed for a while; UptimeRobot's pings keep it awake. Voice/music can be unstable on free Replit because audio streaming is bandwidth-heavy — it works best when run on a real machine or a paid host.

## Commands

| Command | Description |
| --- | --- |
| `/setup notifications #channel` | Pick the channel for stream alerts. |
| `/setup chatbridge #channel` | Pick the channel where Twitch chat is mirrored. |
| `/setup kickchat #channel` | Pick the channel where Kick chat is mirrored. |
| `/setup reset` | Clear this server's settings. |
| `/ping` | Bot latency. |
| `/say <message>` | Bot repeats a message. |
| `/purge <amount>` | Delete messages (1-100). Requires Manage Messages. |
| `/report @user [reason]` | Send a report to the report channel (or current channel). |
| `/play <query>` | Play a YouTube video/playlist URL or a song search in your voice channel. |
| `/stop` | Stop music and clear the queue. |
| `/skip` | Skip the current track. |
| `/leave` | Bot leaves the voice channel. |
| `/volume <0-100>` | Change the music volume. |

`/setup` requires **Manage Server** permission.

## Configuration reference (.env)

| Variable | Description |
| --- | --- |
| `DISCORD_TOKEN` | Discord bot token (required). |
| `ACTIVITY` | Status text (default `RoxaTheChief`). |
| `ACTIVITY_TYPE` | `Watching` (default) \| `Playing` \| `Listening` \| `Streaming` \| `Competing`. |
| `TWITCH_CLIENT_ID` | Twitch app client ID (required for notifications). |
| `TWITCH_CLIENT_SECRET` | Twitch app client secret (required for notifications). |
| `TWITCH_CHANNELS` | Comma-separated Twitch logins to track for alerts. |
| `TWITCH_LOGIN` | Twitch account used for the chat bridge. |
| `TWITCH_CHAT_OAUTH` | Chat OAuth token to enable Discord->Twitch messaging. |
| `MOD_ROLE_ID` | Role ID allowed to use moderation commands (empty = everyone). |
| `REPORT_CHANNEL_ID` | Channel where `/report` messages go. |
| `KICK_CHANNEL` | Your Kick channel name (lowercase) whose chat to mirror. Reading needs no credentials. |
| `PORT` | Port for the keep-alive server (default 3000; Replit sets this automatically). |

## Project structure

```
index.js         - Bot entry point (presence, module startup, keep-alive server)
config.js        - .env config loader
storage.js       - Per-server settings (data.json)
twitch-api.js    - Twitch API helper (auth + requests)
notifications.js - Stream online/offline alerts
chatbridge.js    - Twitch <-> Discord chat relay
kickbridge.js    - Kick -> Discord chat relay (read-only)
music.js         - Voice connection + YouTube playback (via /play)
commands.js      - Slash commands
```
