const { SlashCommandBuilder, ChannelType } = require("discord.js");
const { setupPrivateCategory } = require("../utils/privateUtils");
const GuildConfig = require("../database/models/GuildConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-private")
    .setDescription("Creates/resets the 'Private Rooms' category & channels."),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
    }
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: "You need Administrator permissions to use this command.",
        ephemeral: true,
      });
    }

    const config = await GuildConfig.findOne({ guildId: interaction.guildId });
    if (
      config?.privateCategoryId &&
      interaction.channel?.parentId === config.privateCategoryId
    ) {
      return interaction.reply({
        content: "Please exit the 'Private Rooms' category and try again.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      await setupPrivateCategory(interaction.guild);

      await interaction.editReply({
        content: "The 'Private Rooms' category was created/reset successfully!",
      });

      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          if (error.code !== 10008) {
            console.error("Failed to delete setup-private reply:", error);
          }
        }
      }, 5000);
    } catch (err) {
      console.error("Error setting up private category:", err);
      if (interaction.replied || interaction.deferred) {
        await interaction
          .editReply({
            content: "An error occurred while setting up private rooms.",
          })
          .catch(() => {});
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch {}
        }, 7000);
      } else {
        await interaction
          .reply({
            content: "An error occurred while setting up private rooms.",
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  },
};
