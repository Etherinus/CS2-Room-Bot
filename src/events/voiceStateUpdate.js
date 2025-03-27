const { ChannelType } = require("discord.js");
const {
  createEphemeralRoom,
  updateRoomMessage,
  cleanUpEphemeralRoom,
} = require("../utils/searchUtils");
const {
  createPrivateRoom,
  cleanUpPrivateRoom,
} = require("../utils/privateUtils");
const GuildConfig = require("../database/models/GuildConfig");
const EphemeralRoom = require("../database/models/EphemeralRoom");
const PrivateRoom = require("../database/models/PrivateRoom");

module.exports = {
  name: "voiceStateUpdate",
  async execute(oldState, newState, client) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const member =
      newState.member ??
      (await guild.members.fetch(newState.id).catch(() => null));
    if (!member || member.user.bot) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    const guildId = guild.id;

    const config = await GuildConfig.findOne({ guildId });
    if (!config) return;

    try {
      if (
        newChannelId &&
        !oldChannelId &&
        config.searchSetupChannels &&
        Object.values(config.searchSetupChannels).includes(newChannelId)
      ) {
        try {
          const { voiceChannel } = await createEphemeralRoom(
            guild,
            newChannel.name,
            member,
            config,
          );
          if (voiceChannel) {
            await newState.setChannel(voiceChannel);
          }
        } catch (err) {
          console.error(
            `Error creating ephemeral room from ${newChannel.name}:`,
            err,
          );
        }
      }

      if (newChannelId && newChannelId !== oldChannelId) {
        const joinedRoom = await EphemeralRoom.findOne({
          guildId,
          voiceChannelId: newChannelId,
        });
        if (joinedRoom) {
          await updateRoomMessage(guild, newChannelId, config);
        }
      }

      if (oldChannelId && oldChannelId !== newChannelId) {
        const leftRoomData = await EphemeralRoom.findOne({
          guildId,
          voiceChannelId: oldChannelId,
        });
        if (leftRoomData) {
          const leftChannel =
            oldChannel ??
            (await guild.channels.fetch(oldChannelId).catch(() => null));
          if (leftChannel && leftChannel.members.size === 0) {
            await cleanUpEphemeralRoom(guild, oldChannelId, config);
          } else if (leftChannel) {
            await updateRoomMessage(guild, oldChannelId, config);
          }
        }
      }

      if (
        newChannelId &&
        newChannelId === config.privateCreateChannelId &&
        newChannel?.parentId === config.privateCategoryId
      ) {
        try {
          const voiceChannel = await createPrivateRoom(guild, member, config);
          if (voiceChannel) {
            await newState.setChannel(voiceChannel);
          }
        } catch (err) {
          console.error(
            `Error creating private room for ${member.user.tag}:`,
            err,
          );
        }
      }

      if (oldChannelId && oldChannelId !== newChannelId) {
        const leftPrivateRoom = await PrivateRoom.findOne({
          guildId,
          voiceChannelId: oldChannelId,
        });
        if (leftPrivateRoom) {
          const leftChannel =
            oldChannel ??
            (await guild.channels.fetch(oldChannelId).catch(() => null));
          if (leftChannel && leftChannel.members.size === 0) {
            await cleanUpPrivateRoom(guild, oldChannelId);
          }
        }
      }
    } catch (error) {
      console.error(
        `Error during voiceStateUpdate for guild ${guildId}:`,
        error,
      );
    }
  },
};
