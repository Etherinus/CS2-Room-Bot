const { ChannelType } = require('discord.js');
const { state } = require('../utils/state');
const { createEphemeralRoom, updateRoomMessage, cleanUpEphemeralRoom } = require('../utils/searchUtils');
const { createPrivateRoom, cleanUpPrivateRoom } = require('../utils/privateUtils');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guild = newState.guild || oldState.guild;
    if (!guild) {
      return;
    }

    let member = newState.member;
    if (!member) {
      member = await guild.members.fetch(newState.id).catch(() => null);
    }
    if (!member) {
      return;
    }

    if (oldState.channelId && !oldState.channel) {
      oldState.channel = await guild.channels.fetch(oldState.channelId).catch(() => null);
    }
    if (newState.channelId && !newState.channel) {
      newState.channel = await guild.channels.fetch(newState.channelId).catch(() => null);
    }

    try {
      if (newState.channel && Object.values(state.searchSetupChannels).includes(newState.channel.id)) {
        try {
          const { voice } = await createEphemeralRoom(guild, newState.channel.name, member);
          if (voice) {
            await newState.setChannel(voice);
            await updateRoomMessage(guild, voice.id);
          }
        } catch (err) {}
      } else if (!oldState.channelId && newState.channelId && newState.channel) {
        if (state.ephemeralRooms[newState.channel.id]) {
          await updateRoomMessage(guild, newState.channel.id);
        }
      }

      if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        if (oldState.channel && state.ephemeralRooms[oldState.channel.id]) {
          await updateRoomMessage(guild, oldState.channel.id);
        }
        if (newState.channel && state.ephemeralRooms[newState.channel.id]) {
          await updateRoomMessage(guild, newState.channel.id);
        }
        if (state.ephemeralRooms[oldState.channelId]) {
          const oldCh = oldState.channel;
          if (!oldCh || oldCh.members.size === 0) {
            await cleanUpEphemeralRoom(guild, oldState.channelId);
          }
        }
      }

      if (oldState.channelId && !newState.channelId) {
        if (state.ephemeralRooms[oldState.channelId]) {
          const ch = oldState.channel;
          if (ch && ch.members.size > 0) {
            await updateRoomMessage(guild, oldState.channelId);
          } else {
            await cleanUpEphemeralRoom(guild, oldState.channelId);
          }
        }
        if (state.privateRooms[oldState.channelId]) {
          await cleanUpPrivateRoom(guild, oldState.channelId);
        }
      }

      if (newState.channelId && newState.channel) {
        if (
          newState.channel.name === 'Create Room' &&
          newState.channel.parent?.name === 'Private Rooms'
        ) {
          try {
            const voiceChannel = await createPrivateRoom(guild, member);
            if (voiceChannel) {
              await newState.setChannel(voiceChannel);
            }
          } catch (err) {}
        }
      }
    } catch (globalErr) {}
  },
};
