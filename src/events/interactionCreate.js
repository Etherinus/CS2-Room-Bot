const { InteractionType } = require('discord.js');
const { state } = require('../utils/state');
const { buildKickSelectMenu } = require('../utils/searchUtils');
const { createPrivateRoom, handlePrivateRoomButton, handleModalSubmit } = require('../utils/privateUtils');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        await interaction.reply({ content: 'An error occurred while executing the command!', ephemeral: true });
      }
    } else if (interaction.isButton()) {
      if (interaction.customId === 'join_room') {
        return interaction.reply({
          content: 'To connect, please join the appropriate voice channel manually!',
          ephemeral: true
        });
      } else if (interaction.customId === 'kick_player_btn') {
        if (!interaction.message) {
          return interaction.reply({ content: 'Message not found. It might have been deleted.', ephemeral: true });
        }
        const [vcId, roomData] = Object.entries(state.ephemeralRooms)
          .find(([_, v]) => v.messageId === interaction.message.id) || [null, null];
        if (!vcId || !roomData) {
          return interaction.reply({ content: 'Room not found.', ephemeral: true });
        }
        const voiceCh = interaction.guild.channels.cache.get(vcId);
        if (!voiceCh) {
          return interaction.reply({ content: 'The room no longer exists!', ephemeral: true });
        }
        const menu = buildKickSelectMenu(voiceCh);
        return interaction.reply({ content: 'Select who to kick:', components: [menu], ephemeral: true });
      }
      if (interaction.customId.startsWith('pr_')) {
        return handlePrivateRoomButton(interaction);
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'kick_select') {
        await interaction.deferReply({ ephemeral: true });
        const [userId] = interaction.values;
        if (userId === 'no_members') {
          return interaction.editReply({ content: 'There are no members in the channel to kick.' });
        }
        try {
          const member = await interaction.guild.members.fetch(userId);
          if (member.voice?.channel) {
            await member.voice.setChannel(null);
            await interaction.editReply({ content: `User <@${userId}> was kicked.` });
          } else {
            await interaction.editReply({ content: 'This user is not in a voice channel.' });
          }
        } catch (err) {
          await interaction.editReply({ content: 'Unable to kick (channel may already be deleted?).' });
        }
      }
    } else if (interaction.type === InteractionType.ModalSubmit) {
      return handleModalSubmit(interaction);
    }
  },
};
