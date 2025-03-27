require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const connectDB = require("./database/database");
const { registerGuildCommands } = require("./utils/registerCommands");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.GuildMember],
});

client.commands = new Collection();

async function loadCommands() {
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(
          `[WARNING] Command file ${filePath} is missing data or execute property.`,
        );
      }
    } catch (error) {
      console.error(`[ERROR] Failed to load command ${filePath}:`, error);
    }
  }
}

async function loadEvents() {
  const eventsPath = path.join(__dirname, "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);
      if (event.name && event.execute) {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }
      } else {
        console.warn(
          `[WARNING] Event file ${filePath} is missing name or execute property.`,
        );
      }
    } catch (error) {
      console.error(`[ERROR] Failed to load event ${filePath}:`, error);
    }
  }
}

async function startBot() {
  try {
    await connectDB();
    await loadCommands();
    await loadEvents();

    if (!process.env.TOKEN) {
      console.error("[ERROR] Bot token is not defined in .env file.");
      process.exit(1);
    }

    await client.login(process.env.TOKEN);
  } catch (error) {
    console.error("[FATAL] Failed to start the bot:", error);
    process.exit(1);
  }
}

startBot();
