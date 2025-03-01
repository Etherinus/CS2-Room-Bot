const { REST, Routes } = require('discord.js');
const { clientId, guildId, registerCommands } = require('../utils/registerCommands');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`The bot has logged in as ${client.user.tag}`);

    try {
      await registerCommands();
      console.log('Slash commands have been successfully registered.');
    } catch (error) {
      console.error('Error registering slash commands:', error);
    }
  },
};
