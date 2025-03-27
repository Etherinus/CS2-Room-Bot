const {
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const { deleteOldSearchCategories } = require("../utils/searchUtils");
const GuildConfig = require("../database/models/GuildConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-search")
    .setDescription(
      "Creates/resets 'Teammate Search' and the necessary channels.",
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: "You need Administrator permissions to use this command.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const config = await GuildConfig.findOne({ guildId: interaction.guildId });

    const searchCategoryChannel = config?.searchSetupChannels?.faceit
      ? interaction.guild.channels.cache.get(config.searchSetupChannels.faceit)
          ?.parent
      : null;

    if (
      searchCategoryChannel &&
      interaction.channel?.parentId === searchCategoryChannel.id
    ) {
      return interaction.reply({
        content:
          "Please exit the 'Teammate Search' setup or search categories and try again.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    try {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      await interaction.editReply(
        "Deleting old 'Teammate Search' categories...",
      );
      await deleteOldSearchCategories(interaction.guild);

      const mainSearchCategory = await interaction.guild.channels.create({
        name: "Teammate Search",
        type: ChannelType.GuildCategory,
      });

      const txtChannel = await interaction.guild.channels.create({
        name: "player-search",
        type: ChannelType.GuildText,
        parent: mainSearchCategory.id,
      });

      const faceitChannel = await interaction.guild.channels.create({
        name: "Create Faceit",
        type: ChannelType.GuildVoice,
        parent: mainSearchCategory.id,
      });
      const cs2Channel = await interaction.guild.channels.create({
        name: "Create CS2 Premier",
        type: ChannelType.GuildVoice,
        parent: mainSearchCategory.id,
      });
      const mmPrimeChannel = await interaction.guild.channels.create({
        name: "Create MM Prime",
        type: ChannelType.GuildVoice,
        parent: mainSearchCategory.id,
      });
      const partnersChannel = await interaction.guild.channels.create({
        name: "Create Partners",
        type: ChannelType.GuildVoice,
        parent: mainSearchCategory.id,
      });

      await GuildConfig.findOneAndUpdate(
        { guildId: interaction.guildId },
        {
          searchTextChannelId: txtChannel.id,
          searchSetupChannels: {
            faceit: faceitChannel.id,
            cs2: cs2Channel.id,
            mmPrime: mmPrimeChannel.id,
            partners: partnersChannel.id,
          },
        },
        { upsert: true, new: true },
      );

      await interaction.editReply(
        "The 'Teammate Search' category was successfully created/reset!",
      );

      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          if (error.code !== 10008) {
            console.error("Failed to delete setup-search reply:", error);
          }
        }
      }, 5000);
    } catch (err) {
      console.error("Error setting up search category:", err);
      if (interaction.replied || interaction.deferred) {
        await interaction
          .editReply("An error occurred while resetting 'Teammate Search'.")
          .catch(() => {});
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch {}
        }, 7000);
      } else {
        await interaction
          .reply({
            content: "An error occurred while resetting 'Teammate Search'.",
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }
    }
  },
};
