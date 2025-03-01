const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { state } = require('./state');

const commandsData = [
  new SlashCommandBuilder()
    .setName('setup-search')
    .setDescription("Creates (or recreates) 'Teammate Search' and the required channels."),
  new SlashCommandBuilder()
    .setName('setup-private')
    .setDescription("Creates the 'Private Rooms' category (control panel, 'Create Room').")
].map(cmd => cmd.toJSON());

const { clientId, guildId } = state;

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandsData });
  } catch (err) {
  }
}

module.exports = {
  clientId,
  guildId,
  registerCommands
};
