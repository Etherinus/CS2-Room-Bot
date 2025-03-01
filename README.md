# FlexRoom Bot: Discord Voice Channels Manager

This project is a Discord bot that allows you to quickly create temporary voice channels for finding teammates (Faceit, CS2 Premier, etc.) and manage private rooms (closing access, setting user limits, granting/revoking moderator privileges, and much more). It can easily be adapted for any gaming community or server—not limited to CS2.

## Screenshots

1. **Created Voice Channel and “Teammate Search” Card**  
   ![Teammate Search Example](https://media.discordapp.net/attachments/1176926263911395441/1345322076734619688/Discord_9nUIv5PAYc.png?ex=67c42051&is=67c2ced1&hm=a2e91d25fb03dc323351d0da7a22d92046fd5bc6b4714cc6d396a2468855d1ba&=&format=webp&quality=lossless&width=797&height=506)

2. **Categories and Channels Structure (Teammate Search / Private Rooms)**  
   ![Channel Structure](https://media.discordapp.net/attachments/1176926263911395441/1345322077065838703/Discord_oNghMccnDk.png?ex=67c42052&is=67c2ced2&hm=551239345d7d0d674428fad016c1226d7bb41b9e153ada0b86683670ff252912&=&format=webp&quality=lossless&width=518&height=698)

3. **Private Room Management Panel**  
   ![Private Room Management](https://media.discordapp.net/attachments/1176926263911395441/1345322077393256509/Discord_lLD9ZWCTE9.png?ex=67c42052&is=67c2ced2&hm=7a848657da5da858279679900fdb8b37cd59d4c27ae038167900ceddd1f5adaf&=&format=webp&quality=lossless&width=842&height=800)

## Installation and Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/etherinus/flexroom-bot.git
   cd flexroom-bot
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Create a `.env` file** in the root directory (next to `package.json`) and add:
   ```
   TOKEN=YOUR_BOT_TOKEN
   ```

4. **Specify Identifiers** in `utils/state.js`:
   ```js
   // Example
   exports.state = {
     ...
     clientId: 'CLIENT_ID',  // Specify your Application ID
     guildId: 'GUILD_ID',    // Specify the ID of the server where slash commands will be available
     ...
   };
   ```

5. **Run the Bot**:
   ```bash
   node src/index.js
   ```
   Alternatively, use `nodemon index.js` for automatic reloading upon file changes.

## Project Structure

- **index.js** — Entry point; initializes the Discord client and loads commands/events.
- **commands/** — Folder containing slash commands (e.g., `setupSearch.js`, `setupPrivate.js`).
- **events/** — Folder with event handlers (e.g., `ready.js`, `interactionCreate.js`, `voiceStateUpdate.js`).
- **utils/** — Utility functions and storage for global variables:
  - **state.js** — Stores variables (IDs for categories, text/voice channels, etc.).
  - **searchUtils.js** — Logic for “Teammate Search”.
  - **privateUtils.js** — Logic for “Private Rooms”.
  - **registerCommands.js** — Registers slash commands on the selected server.

## Key Features

1. **Command `/setup-search`**  
   Creates or re-creates the “Teammate Search” category, its corresponding channels, and the text channel “player-search”.

2. **Command `/setup-private`**  
   Creates or re-creates the “Private Rooms” category, the management panel, and the voice channel “Create Room”.

3. **Automatic Deletion of Temporary Channels**  
   When a channel becomes empty, the bot deletes the voice channel and its category (if it is a “Teammate Search” channel), as well as the associated room message.

4. **Management Panel**  
   - Close/open the room.
   - Set user limits.
   - Hide the room.
   - Grant/revoke moderator privileges.
   - Deny/allow user access.
   - Change the private room name.
   - Mark as 18+ (NSFW).
   - Mute all microphones at once, etc.

## How to Add New Commands

- Create a new file in the `commands/` folder (e.g., `ping.js`).
- Use `SlashCommandBuilder` from discord.js.
- Export `data` and `execute`:
  ```js
  const { SlashCommandBuilder } = require('discord.js');

  module.exports = {
    data: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Replies with Pong!'),
    async execute(interaction) {
      await interaction.reply('Pong!');
    },
  };
  ```
- The bot will automatically load the new command on startup.

## License

This project is provided under the FlexRoom Bot License, which allows you to modify and distribute the software. However, you are **not permitted** to sell or commercially exploit this bot without explicit permission from the original author(s).

```
--- FlexRoom Bot License ---

Copyright (c) 2025 Thomas Rendes (aka Etherinus)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to use, modify, and distribute the Software, subject to the following conditions:

1. The Software may be modified and redistributed in its original or modified forms.
2. The Software may NOT be sold or otherwise commercially exploited without the explicit, written consent of the original author(s).
3. Redistributions of the Software must retain the above copyright notice, this license, and the following disclaimer.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
