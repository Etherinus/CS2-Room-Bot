# CS2 Room Bot: Discord Voice Channels Manager

This project is a Discord bot that allows you to quickly create temporary voice channels for finding teammates (Faceit, CS2 Premier, etc.) and manage private rooms (closing access, setting user limits, granting/revoking moderator privileges, and much more). It can easily be adapted for any gaming community or server—not limited to CS2.

## Screenshots

1. **Created Voice Channel and “Teammate Search” embed**  
   ![Teammate Search Example](https://media.discordapp.net/attachments/1085796300185935912/1349184934920716380/Discord_9nUIv5PAYc.png?ex=67d22de3&is=67d0dc63&hm=b8b3c3beea73cce4adeac869c302ec3f14e9133ee75a351320afd9aa92744c4d&=&format=webp&quality=lossless&width=797&height=506)

2. **Categories and Channels Structure (Teammate Search / Private Rooms)**  
   ![Channel Structure](https://media.discordapp.net/attachments/1085796300185935912/1349184935478558832/Discord_oNghMccnDk.png?ex=67d22de3&is=67d0dc63&hm=e18e20cd018bfec7b8622ad2e592cda488923d960547f6fb5ce5bc35d84e3089&=&format=webp&quality=lossless&width=518&height=698)

3. **Private Room Management Panel**  
   ![Private Room Management](https://media.discordapp.net/attachments/1085796300185935912/1349184935235162153/Discord_lLD9ZWCTE9.png?ex=67d22de3&is=67d0dc63&hm=8d93755bc30067e10dfd913dce91e602c2719c2c6dc3bd057d847d49f46c5a66&=&format=webp&quality=lossless&width=842&height=800)

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

This project is provided under the CS2 Room Bot License, which allows you to modify and distribute the software. However, you are **not permitted** to sell or commercially exploit this bot without explicit permission from the original author(s).

```
--- FlexRoom Bot License ---

Copyright (c) 2025 Thomas Rendes (aka Etherinus)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to use, modify, and distribute the Software, subject to the following conditions:

1. The Software may be modified and redistributed in its original or modified forms.
2. The Software may NOT be sold or otherwise commercially exploited without the explicit, written consent of the original author(s).
3. Redistributions of the Software must retain the above copyright notice, this license, and the following disclaimer.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
