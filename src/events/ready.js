const { registerGuildCommands } = require("../utils/registerCommands");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(
      `Bot is ready and running on ${client.guilds.cache.size} server(s).`,
    );

    try {
      if (process.env.NODE_ENV !== "production" && process.env.GUILD_ID) {
        await registerGuildCommands();
        console.log("Development guild commands registered/updated.");
      } else {
        console.log(
          "Skipping automatic command registration in production or without GUILD_ID.",
        );
      }
    } catch (error) {
      console.error("Error registering slash commands on ready:", error);
    }
  },
};
