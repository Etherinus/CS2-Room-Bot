# Discord Bot: Team Search & Private Rooms (MongoDB Version)

This project is a Discord bot designed to quickly create temporary voice channels for finding teammates (e.g., for Faceit, CS2 Premier) and manage persistent private rooms (controlling access, setting user limits, granting/revoking moderator privileges, and much more). The bot uses **MongoDB** to store settings and room data. It can be easily adapted for any gaming community or server.

## Screenshots (Functionality Showcase)

1. **Created Voice Channel and “Teammate Search” embed**  
   ![Teammate Search Example](https://i.imgur.com/LMso7LL.png)

2. **Categories and Channels Structure (Teammate Search / Private Rooms)**  
   ![Channel Structure](https://i.imgur.com/ldE6Klm.png)

3. **Private Room Management Panel**  
   ![Private Room Management](https://i.imgur.com/BjrSWZh.png)

## Installation and Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/etherinus/cs2-room-bot.git
    cd cs2-room-bot
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```
    Ensure `discord.js`, `mongoose`, and `dotenv` are installed.

3.  **Create a `.env` file** in the project's root directory and add the following variables:
    ```dotenv
    TOKEN=YOUR_BOT_TOKEN
    MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
    CLIENT_ID=YOUR_APPLICATION_CLIENT_ID
    GUILD_ID=YOUR_DEVELOPMENT_GUILD_ID
    ```
    - `TOKEN`: Your Discord bot token.
    - `MONGODB_URI`: Your MongoDB connection string (e.g., from MongoDB Atlas).
    - `CLIENT_ID`: Your Discord application's Client ID.
    - `GUILD_ID`: The ID of the Discord server where you want to immediately register and test slash commands (your development server).

4.  **Register Slash Commands**:
    - Run the registration script once (or whenever commands change):
      ```bash
      node src/utils/registerCommands.js
      ```
      _Or, if configured in `package.json`:_
      ```bash
      npm run register
      ```
    - This script registers commands **only** to the server specified by `GUILD_ID` in the `.env` file.

5.  **Run the bot**:
    - For development (with automatic restarts on changes using `nodemon`):
      ```bash
      npm run dev
      ```
    - For production:
      ```bash
      npm start
      ```
      _Or directly (if `start`/`dev` scripts are not configured):_
      ```bash
      node src/index.js
      ```

## Initial Bot Setup in Discord

1.  Invite the bot to your server with the necessary permissions (Manage Channels, Manage Roles, View Channels, Send Messages, Embed Links, Connect, Speak, Move Members, Read Message History).
2.  After starting the bot, run the `/setup-search` command on your server (requires Administrator permissions).
3.  Run the `/setup-private` command on your server (requires Administrator permissions).

## Project Structure

-   **src/index.js** — Entry point; initializes the Discord client, connects to the DB, loads commands and events.
-   **src/commands/** — Folder containing slash commands (e.g., `setupSearch.js`, `setupPrivate.js`).
-   **src/events/** — Folder with Discord event handlers (e.g., `ready.js`, `interactionCreate.js`, `voiceStateUpdate.js`).
-   **src/utils/** — Utility functions:
    -   **searchUtils.js** — Logic for "Team Search".
    *   **privateUtils.js** — Logic for "Private Rooms".
    *   **registerCommands.js** — Script for registering slash commands on the development server.
-   **src/database/** — Database connection settings and MongoDB models:
    -   **database.js** — Function for connecting to MongoDB.
    -   **models/** — Mongoose schemas for collections (GuildConfig, EphemeralRoom, PrivateRoom).
-   **.env** — File for storing secret keys and configuration (Token, DB URI, Client/Guild IDs).
-   **package.json** — List of project dependencies and scripts.

## Key Features

1.  **`/setup-search` Command**
    *   Creates or recreates the "Team Search" category, the necessary creator channels, and the text channel for displaying rooms (`player-search`).

2.  **`/setup-private` Command**
    *   Creates or recreates the "Private Rooms" category, the control panel text channel, and the "Create Room" voice channel.

3.  **Automatic Room Management**
    *   **Temporary (Search):** Joining a "Create..." channel (e.g., "Create Faceit") creates a temporary category and voice channel. A message about the room is posted in the text channel. The category, channel, and message are automatically deleted when the room becomes empty. The owner can kick members.
    *   **Private:** Joining "Create Room" creates a persistent voice channel owned by the user. Data is stored in MongoDB. The owner manages the room via the control panel. The channel is deleted when it becomes empty. A **`Claim`** feature has been added for users to take ownership if the owner leaves.

4.  **Private Room Control Panel**
    *   Rename the room.
    *   Set the user limit.
    *   Lock/unlock (deny/allow entry for everyone).
    *   Hide/unhide (deny/allow viewing for everyone).
    *   Manage speak permissions for specific users (Modal).
    *   Deny/allow access for specific users (Modal).
    *   Transfer ownership of the room (Modal).
    *   Delete the room.
    *   _Other features (e.g., mute all, NSFW) can be added._

## How to Add New Commands

-   Create a new file in the `src/commands/` folder (e.g., `ping.js`).
-   Use `SlashCommandBuilder` from `discord.js`.
-   Export `data` (command definition) and `execute` (execution logic):
    ```javascript
    const { SlashCommandBuilder } = require("discord.js");

    module.exports = {
      data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!"),
      async execute(interaction) {
        await interaction.reply("Pong!");
      },
    };
    ```
-   The bot will automatically load the new command on the next start (or `nodemon` restart). Don't forget to re-run the command registration script (`node src/utils/registerCommands.js`) if you want to test it immediately.

## Dependencies

-   **discord.js** (^14.x.x) - Main library for interacting with the Discord API.
-   **mongoose** (^7.x.x or ^8.x.x) - ODM for working with MongoDB.
-   **dotenv** - For loading environment variables from a `.env` file.

## License

This project is provided under the CS2 Room Bot License, which allows you to modify and distribute the software. However, you are **prohibited** from selling or otherwise commercially exploiting this bot without explicit permission from the original author(s).

```text
--- CS2 Room Bot License ---

Copyright (c) 2025 Thomas Rendes (aka Etherinus)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to use, modify, and distribute the Software, subject to the following conditions:

1. The Software may be modified and redistributed in its original or modified forms.
2. The Software may NOT be sold or otherwise commercially exploited without the explicit, written consent of the original author(s).
3. Redistributions of the Software must retain the above copyright notice, this license, and the following disclaimer.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.