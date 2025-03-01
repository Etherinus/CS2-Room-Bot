const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { state } = require('./state');
  
  async function deleteOldSearchCategories(guild) {
    const oldCats = guild.channels.cache.filter(
      ch => ch.type === ChannelType.GuildCategory && ch.name === 'Teammate Search'
    );
    for (const cat of oldCats.values()) {
      for (const child of cat.children.cache.values()) {
        await child.delete().catch(() => {});
      }
      await cat.delete().catch(() => {});
    }
  }
  
  function getRoomProps(channelName, creatorName) {
    switch (channelName) {
      case 'Create Faceit':
        return { categoryName: 'Faceit', voiceChannelName: `Faceit ${creatorName}`, maxSlots: 5 };
      case 'Create CS2 Premier':
        return { categoryName: 'CS2 Premier', voiceChannelName: `CS2 ${creatorName}`, maxSlots: 5 };
      case 'Create MM Prime':
        return { categoryName: 'MM Prime', voiceChannelName: `MM Prime ${creatorName}`, maxSlots: 5 };
      case 'Create Partners':
        return { categoryName: 'Partners', voiceChannelName: `Partners ${creatorName}`, maxSlots: 2 };
      default:
        return { categoryName: 'Other', voiceChannelName: `Room ${creatorName}`, maxSlots: 5 };
    }
  }
  
  async function createEphemeralRoom(guild, channelName, creatorMember) {
    const { categoryName, voiceChannelName, maxSlots } = getRoomProps(channelName, creatorMember.user.username);
  
    const newCategory = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory
    });
    if (!newCategory) throw new Error('newCategory not created!');
  
    const newVoice = await guild.channels.create({
      name: voiceChannelName,
      type: ChannelType.GuildVoice,
      parent: newCategory.id
    });
    if (!newVoice) throw new Error('newVoice not created!');
  
    if (maxSlots === 2) {
      await newVoice.edit({ userLimit: 2 });
    }
  
    state.ephemeralRooms[newVoice.id] = {
      messageId: null,
      categoryId: newCategory.id,
      createdAt: new Date(),
      maxSlots,
      ownerId: creatorMember.id
    };
  
    return { voice: newVoice };
  }
  
  function buildRoomEmbed(voiceChannel, data) {
    const { createdAt, maxSlots, ownerId } = data;
    const allMembers = [...voiceChannel.members.values()].filter(m => m && m.id);
  
    const occupantCount = allMembers.length;
    const freeCount = maxSlots - occupantCount;
  
    const slotLines = [];
    for (let i = 0; i < maxSlots; i++) {
      if (i < occupantCount) {
        const occupant = allMembers[i];
        if (!occupant) {
          slotLines.push('❌ Unknown participant');
          continue;
        }
        const isOwner = occupant.id === ownerId;
        slotLines.push(`❌ <@${occupant.id}>${isOwner ? ' | 👑' : ''}`);
      } else {
        slotLines.push('✅ Available');
      }
    }
  
    const statusLine = freeCount > 0 ? `Looking for team +${freeCount}` : 'FULL';
    let color = 0x57F287;
    if (freeCount === 0) color = 0xED4245;
  
    const dateOptions = { hour: '2-digit', minute: '2-digit' };
    const timeString = createdAt
      ? createdAt.toLocaleString('en-US', dateOptions)
      : new Date().toLocaleString('en-US', dateOptions);
  
    const description = `\n${slotLines.join('\n')}`;
    const footerText = `${statusLine} • Today at ${timeString}`;
  
    return new EmbedBuilder()
      .setTitle(voiceChannel.name)
      .setDescription(description)
      .setColor(color)
      .setFooter({ text: footerText })
      .setTimestamp();
  }
  
  function buildActionButtons() {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('join_room')
          .setLabel('Join')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('kick_player_btn')
          .setLabel('Kick Player')
          .setStyle(ButtonStyle.Danger)
      )
    ];
  }
  
  async function updateRoomMessage(guild, voiceChannelId) {
    const data = state.ephemeralRooms[voiceChannelId];
    if (!data) return;
    const voiceChannel = guild.channels.cache.get(voiceChannelId);
    if (!voiceChannel) return;
  
    const textChannel = guild.channels.cache.get(state.searchTextChannelId);
    if (!textChannel) return;
  
    const embed = buildRoomEmbed(voiceChannel, data);
    const components = buildActionButtons();
  
    try {
      if (data.messageId === 'pending') return;
  
      if (typeof data.messageId === 'string' && data.messageId !== null) {
        const oldMsg = await textChannel.messages.fetch(data.messageId).catch(() => null);
        if (oldMsg) {
          await oldMsg.edit({ embeds: [embed], components });
          return;
        }
      }
  
      state.ephemeralRooms[voiceChannelId].messageId = 'pending';
      const newMsg = await textChannel.send({ embeds: [embed], components });
      state.ephemeralRooms[voiceChannelId].messageId = newMsg.id;
    } catch (err) {}
  }
  
  function buildKickSelectMenu(voiceChannel) {
    const members = [...voiceChannel.members.values()].filter(m => m && m.id);
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('kick_select')
      .setPlaceholder('Select a member to kick...')
      .setMinValues(1)
      .setMaxValues(1);
  
    if (members.length === 0) {
      selectMenu.addOptions({
        label: 'Empty',
        description: 'No members in the channel',
        value: 'no_members'
      });
    } else {
      selectMenu.addOptions(
        members.map(m => ({
          label: m.user.username,
          description: 'Kick from voice channel',
          value: m.id
        }))
      );
    }
    return new ActionRowBuilder().addComponents(selectMenu);
  }
  
  async function cleanUpEphemeralRoom(guild, voiceChannelId) {
    const data = state.ephemeralRooms[voiceChannelId];
    if (!data) return;
  
    if (data.messageId && data.messageId !== 'pending') {
      const textCh = guild.channels.cache.get(state.searchTextChannelId);
      if (textCh) {
        const oldMsg = await textCh.messages.fetch(data.messageId).catch(() => null);
        if (oldMsg) {
          await oldMsg.delete().catch(() => {});
        }
      }
    }
  
    const cat = guild.channels.cache.get(data.categoryId);
    if (cat && cat.children) {
      for (const ch of cat.children.cache.values()) {
        await ch.delete().catch(() => {});
      }
      await cat.delete().catch(() => {});
    }
  
    delete state.ephemeralRooms[voiceChannelId];
  }
  
  module.exports = {
    deleteOldSearchCategories,
    createEphemeralRoom,
    updateRoomMessage,
    buildKickSelectMenu,
    cleanUpEphemeralRoom
};
  