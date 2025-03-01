const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { state } = require('./state');
  
  async function deleteOldPrivateCategories(guild) {
    const oldCats = guild.channels.cache.filter(
      ch => ch.type === ChannelType.GuildCategory && ch.name === 'Private Rooms'
    );
    for (const cat of oldCats.values()) {
      for (const child of cat.children.cache.values()) {
        await child.delete().catch(() => {});
      }
      await cat.delete().catch(() => {});
    }
  }
  
  async function setupPrivateCategory(interaction) {
    await interaction.reply('Creating "Private Rooms" category...');
    const msg1 = await interaction.fetchReply();
  
    await deleteOldPrivateCategories(interaction.guild);
  
    const privateCategory = await interaction.guild.channels.create({
      name: 'Private Rooms',
      type: ChannelType.GuildCategory
    });
    state.privateCategoryId = privateCategory.id;
  
    const controlPanelChannel = await interaction.guild.channels.create({
      name: 'control-panel',
      type: ChannelType.GuildText,
      parent: privateCategory.id
    });
    state.privateControlChannelId = controlPanelChannel.id;
  
    await interaction.guild.channels.create({
      name: 'Create Room',
      type: ChannelType.GuildVoice,
      parent: privateCategory.id
    });
  
    const embed = buildCommonPrivateEmbed();
    const buttons = buildPrivateRoomButtons();
    const msgEmbed = await controlPanelChannel.send({ embeds: [embed], components: buttons });
    state.globalPrivateEmbedId = msgEmbed.id;
  
    const msg2 = await interaction.followUp('The "Private Rooms" category was created successfully!');
    setTimeout(async () => {
      await msg1.delete().catch(() => {});
      await msg2.delete().catch(() => {});
    }, 3000);
  }
  
  function buildCommonPrivateEmbed() {
    const description = [
      '✏ - Change the private room name',
      '👥 - Set user limit',
      '🔒 - Close the room',
      '🚫 - Deny access to a user',
      '✅ - Grant access to a user',
      '🎤 - Configure microphone permissions',
      '🙈 - Hide the room',
      '🔧 - Grant/Revoke moderator',
      '🔇 - Mute everyone',
      '🔞 - Set room to 18+'
    ].join('\n');
  
    return new EmbedBuilder()
      .setTitle('Private Room Management')
      .setDescription(description)
      .setColor(0x2b2d31)
      .setTimestamp();
  }
  
  function buildPrivateRoomButtons() {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pr_rename').setLabel('✏').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_limit').setLabel('👥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_close').setLabel('🔒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_deny').setLabel('🚫').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_allow').setLabel('✅').setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pr_mic').setLabel('🎤').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_hide').setLabel('🙈').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_mod').setLabel('🔧').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_muteall').setLabel('🔇').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_18plus').setLabel('🔞').setStyle(ButtonStyle.Secondary)
    );
    return [row1, row2];
  }
  
  async function createPrivateRoom(guild, ownerMember) {
    if (!state.privateCategoryId) {
      const cat = guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildCategory && ch.name === 'Private Rooms'
      );
      if (!cat) {
        throw new Error('Private Rooms category not found! Please call /setup-private first.');
      }
      state.privateCategoryId = cat.id;
    }
  
    const existingRooms = Object.keys(state.privateRooms).filter(
      roomId => state.privateRooms[roomId].ownerId === ownerMember.id
    );
  
    for (const roomId of existingRooms) {
      const existingChannel = guild.channels.cache.get(roomId);
      if (!existingChannel) {
        delete state.privateRooms[roomId];
        if (state.ownerToRoomId[ownerMember.id]) {
          state.ownerToRoomId[ownerMember.id] = state.ownerToRoomId[ownerMember.id].filter(id => id !== roomId);
          if (state.ownerToRoomId[ownerMember.id].length === 0) {
            delete state.ownerToRoomId[ownerMember.id];
          }
        }
        continue;
      }
  
      const occupantCount = existingChannel.members.size;
      if (occupantCount === 0) {
        await existingChannel.delete().catch(() => {});
        delete state.privateRooms[roomId];
        if (state.ownerToRoomId[ownerMember.id]) {
          state.ownerToRoomId[ownerMember.id] = state.ownerToRoomId[ownerMember.id].filter(id => id !== roomId);
          if (state.ownerToRoomId[ownerMember.id].length === 0) {
            delete state.ownerToRoomId[ownerMember.id];
          }
        }
      } else if (occupantCount === 1) {
        const [theOnlyMember] = existingChannel.members.values();
        if (theOnlyMember && theOnlyMember.id === ownerMember.id) {
          await existingChannel.delete().catch(() => {});
          delete state.privateRooms[roomId];
          if (state.ownerToRoomId[ownerMember.id]) {
            state.ownerToRoomId[ownerMember.id] = state.ownerToRoomId[ownerMember.id].filter(id => id !== roomId);
            if (state.ownerToRoomId[ownerMember.id].length === 0) {
              delete state.ownerToRoomId[ownerMember.id];
            }
          }
        }
      }
    }
  
    const voiceChannel = await guild.channels.create({
      name: `${ownerMember.user.username}`,
      type: ChannelType.GuildVoice,
      parent: state.privateCategoryId,
      permissionOverwrites: [
        {
          id: ownerMember.id,
          allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect]
        },
        {
          id: guild.id,
          allow: [PermissionFlagsBits.Connect]
        }
      ]
    });
  
    state.privateRooms[voiceChannel.id] = {
      ownerId: ownerMember.id,
      disabledFunctions: {
        pr_close: false,
        pr_hide: false,
        pr_muteall: false,
        pr_18plus: false,
        pr_rename: false,
        pr_limit: false,
        pr_deny: false,
        pr_allow: false,
        pr_mic: false,
        pr_mod: false
      }
    };
    if (!state.ownerToRoomId[ownerMember.id]) {
      state.ownerToRoomId[ownerMember.id] = [];
    }
    state.ownerToRoomId[ownerMember.id].push(voiceChannel.id);
  
    return voiceChannel;
  }
  
  async function handlePrivateRoomButton(interaction) {
    if (interaction.message.id !== state.globalPrivateEmbedId) {
      return interaction.reply({ content: 'This is not the management panel!', ephemeral: true });
    }
  
    const ownerRooms = state.ownerToRoomId[interaction.user.id];
    if (!ownerRooms || ownerRooms.length === 0) {
      return interaction.reply({ content: 'You do not have a private room!', ephemeral: true });
    }
  
    const voiceChannelId = ownerRooms[ownerRooms.length - 1];
    const voiceCh = interaction.guild.channels.cache.get(voiceChannelId);
    if (!voiceCh) {
      state.ownerToRoomId[interaction.user.id] = ownerRooms.filter(id => interaction.guild.channels.cache.has(id));
      return interaction.reply({ content: 'Your room has already been deleted!', ephemeral: true });
    }
  
    const roomData = state.privateRooms[voiceChannelId];
    if (!roomData) {
      return interaction.reply({ content: 'Error: Room data not found.', ephemeral: true });
    }
  
    if (
      interaction.user.id !== roomData.ownerId &&
      !voiceCh.permissionsFor(interaction.user).has(PermissionFlagsBits.ManageChannels)
    ) {
      return interaction.reply({
        content: 'Only the owner or a moderator can manage the room!',
        ephemeral: true
      });
    }
  
    const customId = interaction.customId;
    switch (customId) {
      case 'pr_close': {
        const currentlyClosed = roomData.disabledFunctions.pr_close;
        if (!currentlyClosed) {
          await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
          await voiceCh.permissionOverwrites.edit(roomData.ownerId, { Connect: true });
          roomData.disabledFunctions.pr_close = true;
          await interaction.reply({ content: 'Room closed!', ephemeral: true });
        } else {
          await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null });
          roomData.disabledFunctions.pr_close = false;
          await interaction.reply({ content: 'Room reopened!', ephemeral: true });
        }
        break;
      }
      case 'pr_hide': {
        const currentlyHidden = roomData.disabledFunctions.pr_hide;
        if (!currentlyHidden) {
          await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
          roomData.disabledFunctions.pr_hide = true;
          await interaction.reply({ content: 'Room hidden!', ephemeral: true });
        } else {
          await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null });
          roomData.disabledFunctions.pr_hide = false;
          await interaction.reply({ content: 'Room is now visible to everyone!', ephemeral: true });
        }
        break;
      }
      case 'pr_muteall': {
        const currentlyMutedAll = roomData.disabledFunctions.pr_muteall;
        if (!currentlyMutedAll) {
          await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { Speak: false });
          roomData.disabledFunctions.pr_muteall = true;
          await interaction.reply({ content: 'Everyone is muted!', ephemeral: true });
        } else {
          await voiceCh.permissionOverwrites.edit(interaction.guild.roles.everyone, { Speak: null });
          roomData.disabledFunctions.pr_muteall = false;
          await interaction.reply({ content: 'Everyone is unmuted!', ephemeral: true });
        }
        break;
      }
      case 'pr_18plus': {
        const currently18plus = roomData.disabledFunctions.pr_18plus;
        try {
          if (!currently18plus) {
            await voiceCh.edit({ nsfw: true });
            roomData.disabledFunctions.pr_18plus = true;
            await interaction.reply({ content: 'Room marked as 18+!', ephemeral: true });
          } else {
            await voiceCh.edit({ nsfw: false });
            roomData.disabledFunctions.pr_18plus = false;
            await interaction.reply({ content: '18+ status removed!', ephemeral: true });
          }
        } catch (err) {
          await interaction.reply({ content: 'Failed to change 18+ (NSFW) status for this channel.', ephemeral: true });
        }
        break;
      }
      case 'pr_mod': {
        const modal = new ModalBuilder()
          .setCustomId(`modal_mod_${voiceChannelId}`)
          .setTitle('Grant/Revoke Moderator');
        const userInput = new TextInputBuilder()
          .setCustomId('modUserId')
          .setLabel('User ID (without @)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
        break;
      }
      case 'pr_rename': {
        const modal = new ModalBuilder()
          .setCustomId(`modal_rename_${voiceChannelId}`)
          .setTitle('Rename Room');
        const nameInput = new TextInputBuilder()
          .setCustomId('roomName')
          .setLabel('New name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        await interaction.showModal(modal);
        break;
      }
      case 'pr_limit': {
        const modal = new ModalBuilder()
          .setCustomId(`modal_limit_${voiceChannelId}`)
          .setTitle('Set User Limit');
        const limitInput = new TextInputBuilder()
          .setCustomId('roomLimit')
          .setLabel('Number, 0 = unlimited')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
        await interaction.showModal(modal);
        break;
      }
      case 'pr_deny': {
        const modal = new ModalBuilder()
          .setCustomId(`modal_deny_${voiceChannelId}`)
          .setTitle('Deny User Access');
        const userInput = new TextInputBuilder()
          .setCustomId('denyUserId')
          .setLabel('User ID (without @)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
        break;
      }
      case 'pr_allow': {
        const modal = new ModalBuilder()
          .setCustomId(`modal_allow_${voiceChannelId}`)
          .setTitle('Grant User Access');
        const userInput = new TextInputBuilder()
          .setCustomId('allowUserId')
          .setLabel('User ID (without @)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
        break;
      }
      case 'pr_mic': {
        const modal = new ModalBuilder()
          .setCustomId(`modal_mic_${voiceChannelId}`)
          .setTitle('Configure Microphone Permission');
        const userInput = new TextInputBuilder()
          .setCustomId('micUserId')
          .setLabel('User ID (without @)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        const choiceInput = new TextInputBuilder()
          .setCustomId('micChoice')
          .setLabel('"allow" or "deny"')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(
          new ActionRowBuilder().addComponents(userInput),
          new ActionRowBuilder().addComponents(choiceInput)
        );
        await interaction.showModal(modal);
        break;
      }
    }
  }
  
  async function handleModalSubmit(interaction) {
    const { customId } = interaction;
    if (!customId.startsWith('modal_')) return;
  
    const voiceChannelId = customId.split('_').pop();
    const voiceCh = interaction.guild.channels.cache.get(voiceChannelId);
    if (!voiceCh) {
      return interaction.reply({ content: 'Voice channel not found.', ephemeral: true });
    }
  
    if (customId.startsWith('modal_rename_')) {
      const newName = interaction.fields.getTextInputValue('roomName');
      await voiceCh.edit({ name: newName });
      return interaction.reply({ content: `Room name changed to "${newName}"`, ephemeral: true });
    } else if (customId.startsWith('modal_limit_')) {
      const limitStr = interaction.fields.getTextInputValue('roomLimit');
      const limit = parseInt(limitStr, 10);
      if (isNaN(limit) || limit < 0) {
        return interaction.reply({ content: 'Invalid number!', ephemeral: true });
      }
      await voiceCh.edit({ userLimit: limit });
      return interaction.reply({ content: `User limit set to: ${limit}`, ephemeral: true });
    } else if (customId.startsWith('modal_deny_')) {
      const userId = interaction.fields.getTextInputValue('denyUserId');
      await voiceCh.permissionOverwrites.edit(userId, { Connect: false });
      return interaction.reply({ content: `Access denied for user ${userId}.`, ephemeral: true });
    } else if (customId.startsWith('modal_allow_')) {
      const userId = interaction.fields.getTextInputValue('allowUserId');
      await voiceCh.permissionOverwrites.edit(userId, { Connect: true });
      return interaction.reply({ content: `User ${userId} granted access!`, ephemeral: true });
    } else if (customId.startsWith('modal_mic_')) {
      const userId = interaction.fields.getTextInputValue('micUserId');
      const choice = interaction.fields.getTextInputValue('micChoice').toLowerCase();
      if (choice === 'allow') {
        await voiceCh.permissionOverwrites.edit(userId, { Speak: true });
        return interaction.reply({ content: `Microphone allowed for user ${userId}.`, ephemeral: true });
      } else if (choice === 'deny') {
        await voiceCh.permissionOverwrites.edit(userId, { Speak: false });
        return interaction.reply({ content: `Microphone denied for user ${userId}.`, ephemeral: true });
      } else {
        return interaction.reply({ content: 'Invalid input (enter "allow" or "deny").', ephemeral: true });
      }
    } else if (customId.startsWith('modal_mod_')) {
      const userId = interaction.fields.getTextInputValue('modUserId');
      const hasManageChannels = voiceCh.permissionsFor(userId)?.has(PermissionFlagsBits.ManageChannels);
      if (hasManageChannels) {
        await voiceCh.permissionOverwrites.edit(userId, { ManageChannels: null });
        return interaction.reply({ content: `Moderator rights revoked for user ${userId}.`, ephemeral: true });
      } else {
        await voiceCh.permissionOverwrites.edit(userId, { ManageChannels: true });
        return interaction.reply({ content: `Moderator rights granted to user ${userId}.`, ephemeral: true });
      }
    }
  }
  
  async function cleanUpPrivateRoom(guild, channelId) {
    const roomData = state.privateRooms[channelId];
    if (!roomData) return;
  
    const voiceChannel = guild.channels.cache.get(channelId);
    if (!voiceChannel) {
      delete state.privateRooms[channelId];
      return;
    }
    if (voiceChannel.members.size === 0) {
      await voiceChannel.delete().catch(() => {});
      delete state.privateRooms[channelId];
  
      if (roomData.ownerId && state.ownerToRoomId[roomData.ownerId]) {
        state.ownerToRoomId[roomData.ownerId] = state.ownerToRoomId[roomData.ownerId].filter(
          id => id !== channelId
        );
        if (state.ownerToRoomId[roomData.ownerId].length === 0) {
          delete state.ownerToRoomId[roomData.ownerId];
        }
      }
    }
  }
  
  module.exports = {
    setupPrivateCategory,
    createPrivateRoom,
    handlePrivateRoomButton,
    handleModalSubmit,
    cleanUpPrivateRoom
};
  