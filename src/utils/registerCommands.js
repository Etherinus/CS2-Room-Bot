require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const registerGuildCommands = async () => {
  const commands = [];
  const commandsPath = path.join(__dirname, "..", "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;
  const token = process.env.TOKEN;

  if (!clientId || !guildId || !token) {
    console.error(
      "[ERROR] CLIENT_ID, GUILD_ID, or TOKEN missing in .env for command registration.",
    );
    process.exit(1);
  }

  console.log("Loading commands for registration...");
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (command.data) {
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`);
      } else {
        console.warn(
          `[WARNING] Command file ${filePath} is missing data property.`,
        );
      }
    } catch (error) {
      console.error(
        `[ERROR] Failed to load command ${filePath} for registration:`,
        error,
      );
    }
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands for guild ${guildId}.`,
    );

    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands for guild ${guildId}.`,
    );
  } catch (error) {
    console.error("Error during command registration:", error);
  }
};

if (require.main === module) {
  console.log("Running command registration script directly...");
  registerGuildCommands().catch(console.error);
}

module.exports = {
  registerGuildCommands,
};
