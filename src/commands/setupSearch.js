const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { deleteOldSearchCategories } = require('../utils/searchUtils');
const { state } = require('../utils/state');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-search')
    .setDescription("Creates/resets 'Teammate Search' and the necessary channels."),
    
  async execute(interaction) {
    if (interaction.channel?.parent?.name === 'Teammate Search') {
      return interaction.reply({
        content: "Please exit the 'Teammate Search' category and try again.",
        ephemeral: true
      });
    }

    try {
      await interaction.reply("Deleting the old 'Teammate Search' category...");
      const msg1 = await interaction.fetchReply();

      await deleteOldSearchCategories(interaction.guild);

      const searchCategory = await interaction.guild.channels.create({
        name: 'Teammate Search',
        type: ChannelType.GuildCategory
      });

      const txt = await interaction.guild.channels.create({
        name: 'player-search',
        type: ChannelType.GuildText,
        parent: searchCategory.id
      });
      state.searchTextChannelId = txt.id;

      const faceitChannel = await interaction.guild.channels.create({
        name: 'Create Faceit',
        type: ChannelType.GuildVoice,
        parent: searchCategory.id
      });
      const cs2Channel = await interaction.guild.channels.create({
        name: 'Create CS2 Premier',
        type: ChannelType.GuildVoice,
        parent: searchCategory.id
      });
      const mmPrimeChannel = await interaction.guild.channels.create({
        name: 'Create MM Prime',
        type: ChannelType.GuildVoice,
        parent: searchCategory.id
      });
      const partnersChannel = await interaction.guild.channels.create({
        name: 'Create Partners',
        type: ChannelType.GuildVoice,
        parent: searchCategory.id
      });

      state.searchSetupChannels = {
        faceit: faceitChannel.id,
        cs2: cs2Channel.id,
        mmPrime: mmPrimeChannel.id,
        partners: partnersChannel.id
      };

      const msg2 = await interaction.followUp("The 'Teammate Search' category was successfully created!");
      setTimeout(async () => {
        await msg1.delete().catch(() => {});
        await msg2.delete().catch(() => {});
      }, 3000);

    } catch (err) {
      await interaction.followUp("An error occurred while resetting 'Teammate Search'.");
    }
  },
};
