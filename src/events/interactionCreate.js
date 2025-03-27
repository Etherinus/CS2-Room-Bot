const { InteractionType, ChannelType } = require("discord.js");
const { buildKickSelectMenu } = require("../utils/searchUtils");
const {
  handlePrivateRoomButton,
  handleModalSubmit,
} = require("../utils/privateUtils");
const EphemeralRoom = require("../database/models/EphemeralRoom");
const GuildConfig = require("../database/models/GuildConfig");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (!interaction.inGuild()) return;

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(
          `Error executing command ${interaction.commandName}:`,
          err,
        );
        if (interaction.replied || interaction.deferred) {
          await interaction
            .followUp({
              content: "An error occurred while executing the command!",
              ephemeral: true,
            })
            .catch(console.error);
        } else {
          await interaction
            .reply({
              content: "An error occurred while executing the command!",
              ephemeral: true,
            })
            .catch(console.error);
        }
      }
    } else if (interaction.isButton()) {
      try {
        if (interaction.customId === "join_room") {
          return interaction.reply({
            content:
              "To connect, please join the appropriate voice channel manually!",
            ephemeral: true,
          });
        } else if (interaction.customId === "kick_player_btn") {
          if (!interaction.message) {
            return interaction.reply({
              content: "Message not found.",
              ephemeral: true,
            });
          }
          const room = await EphemeralRoom.findOne({
            guildId: interaction.guildId,
            messageId: interaction.message.id,
          });
          if (!room?.voiceChannelId) {
            return interaction.reply({
              content: "Room data not found or invalid.",
              ephemeral: true,
            });
          }
          const voiceCh = interaction.guild.channels.cache.get(
            room.voiceChannelId,
          );
          if (!voiceCh || voiceCh.type !== ChannelType.GuildVoice) {
            return interaction.reply({
              content: "The voice channel for this room no longer exists!",
              ephemeral: true,
            });
          }
          if (interaction.user.id !== room.ownerId) {
            return interaction.reply({
              content: "Only the room owner can kick members.",
              ephemeral: true,
            });
          }

          const menu = buildKickSelectMenu(voiceCh, room.ownerId);
          return interaction.reply({
            content: "Select who to kick:",
            components: [menu],
            ephemeral: true,
          });
        } else if (interaction.customId.startsWith("pr_")) {
          const config = await GuildConfig.findOne({
            guildId: interaction.guildId,
          });
          if (interaction.message.id !== config?.globalPrivateEmbedId) {
            return interaction.reply({
              content:
                "This button is not associated with the active control panel.",
              ephemeral: true,
            });
          }
          return handlePrivateRoomButton(interaction, config);
        }
      } catch (error) {
        console.error("Error handling button interaction:", error);
        await interaction
          .reply({
            content: "An error occurred while processing the button click.",
            ephemeral: true,
          })
          .catch(console.error);
      }
    } else if (interaction.isStringSelectMenu()) {
      try {
        if (interaction.customId === "kick_select") {
          await interaction.deferReply({ ephemeral: true });
          const [userId] = interaction.values;

          if (userId === "no_members") {
            return interaction.editReply({
              content: "There are no eligible members in the channel to kick.",
            });
          }

          const room = await EphemeralRoom.findOne({
            guildId: interaction.guildId,
          }).sort({ createdAt: -1 });
          if (!room || interaction.user.id !== room.ownerId) {
            return interaction.editReply({
              content: "Could not verify ownership or find room data.",
            });
          }

          const voiceCh = interaction.guild.channels.cache.get(
            room.voiceChannelId,
          );
          if (!voiceCh) {
            return interaction.editReply({
              content: "The voice channel seems to be deleted.",
            });
          }

          const member = await interaction.guild.members
            .fetch(userId)
            .catch(() => null);
          if (!member) {
            return interaction.editReply({
              content: "Could not find the selected member.",
            });
          }

          if (member.voice?.channelId === voiceCh.id) {
            await member.voice.disconnect(
              `Kicked by room owner ${interaction.user.tag}`,
            );
            await interaction.editReply({
              content: `User <@${userId}> was kicked.`,
            });
          } else {
            await interaction.editReply({
              content: "This user is no longer in the voice channel.",
            });
          }
        }
      } catch (err) {
        console.error("Error handling select menu interaction:", err);
        await interaction
          .editReply({
            content: "An error occurred while trying to kick the user.",
          })
          .catch(console.error);
      }
    } else if (interaction.type === InteractionType.ModalSubmit) {
      try {
        if (interaction.customId.startsWith("modal_pr_")) {
          return handleModalSubmit(interaction);
        }
      } catch (error) {
        console.error("Error handling modal submission:", error);
        await interaction
          .reply({
            content: "An error occurred while processing the form.",
            ephemeral: true,
          })
          .catch(console.error);
      }
    }
  },
};
