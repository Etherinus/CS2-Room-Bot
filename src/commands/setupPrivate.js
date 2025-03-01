const { SlashCommandBuilder } = require('discord.js');
const { setupPrivateCategory } = require('../utils/privateUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-private')
    .setDescription("Creates the 'Private Rooms' category (control panel and 'Create Room')."),

  async execute(interaction) {
    if (interaction.channel?.parent?.name === 'Private Rooms') {
      return interaction.reply({
        content: "Please exit the 'Private Rooms' category and try again.",
        ephemeral: true
      });
    }

    try {
      await setupPrivateCategory(interaction);
    } catch (err) {
      await interaction.reply({
        content: "An error occurred while creating private rooms.",
        ephemeral: true
      });
    }
  },
};
