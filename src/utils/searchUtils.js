const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
} = require("discord.js");
const GuildConfig = require("../database/models/GuildConfig");
const EphemeralRoom = require("../database/models/EphemeralRoom");

const SHARED_CATEGORY_NAMES = [
  "Faceit Search",
  "CS2 Premier Search",
  "MM Prime Search",
  "Partners Search",
  "Other Search",
];

async function deleteOldSearchCategories(guild) {
  const config = await GuildConfig.findOne({ guildId: guild.id });
  let mainParentId = null;
  if (config?.searchSetupChannels?.faceit) {
    const faceitCh = guild.channels.cache.get(
      config.searchSetupChannels.faceit,
    );
    mainParentId = faceitCh?.parentId;
  }

  const categoriesToDelete = guild.channels.cache.filter(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      (ch.name === "Teammate Search" ||
        (mainParentId && ch.id === mainParentId) ||
        SHARED_CATEGORY_NAMES.includes(ch.name)),
  );

  for (const cat of categoriesToDelete.values()) {
    try {
      const children = guild.channels.cache.filter(
        (c) => c.parentId === cat.id,
      );
      for (const child of children.values()) {
        if (child.type === ChannelType.GuildVoice) {
          const roomData = await EphemeralRoom.findOne({
            guildId: guild.id,
            voiceChannelId: child.id,
          });
          if (roomData) {
            await cleanUpEphemeralRoom(guild, child.id, config, true);
          }
        }
        await child
          .delete(`Cleaning up old search category ${cat.name}`)
          .catch(() => {});
      }
      await cat
        .delete(`Cleaning up old search category ${cat.name}`)
        .catch(() => {});
    } catch (error) {
      console.warn(
        `Could not fully delete old search category ${cat.name} (${cat.id}):`,
        error.message,
      );
    }
  }

  const leftoverRooms = await EphemeralRoom.find({ guildId: guild.id });
  for (const room of leftoverRooms) {
    const vcExists = guild.channels.cache.has(room.voiceChannelId);
    if (!vcExists) {
      await cleanUpEphemeralRoom(guild, room.voiceChannelId, config, true);
    }
  }
}

function getRoomProps(sourceChannelName, creatorName) {
  const baseName =
    creatorName.length > 20
      ? creatorName.substring(0, 17) + "..."
      : creatorName;
  switch (sourceChannelName) {
    case "Create Faceit":
      return {
        sharedCategoryName: "Faceit Search",
        voiceChannelName: `Faceit ${baseName}`,
        maxSlots: 5,
      };
    case "Create CS2 Premier":
      return {
        sharedCategoryName: "CS2 Premier Search",
        voiceChannelName: `CS2 ${baseName}`,
        maxSlots: 5,
      };
    case "Create MM Prime":
      return {
        sharedCategoryName: "MM Prime Search",
        voiceChannelName: `MM ${baseName}`,
        maxSlots: 5,
      };
    case "Create Partners":
      return {
        sharedCategoryName: "Partners Search",
        voiceChannelName: `Partners ${baseName}`,
        maxSlots: 2,
      };
    default:
      return {
        sharedCategoryName: "Other Search",
        voiceChannelName: `Room ${baseName}`,
        maxSlots: 5,
      };
  }
}

async function createEphemeralRoom(
  guild,
  sourceChannelName,
  creatorMember,
  config,
) {
  const { sharedCategoryName, voiceChannelName, maxSlots } = getRoomProps(
    sourceChannelName,
    creatorMember.displayName,
  );

  const existingOwnedRoom = await EphemeralRoom.findOne({
    guildId: guild.id,
    ownerId: creatorMember.id,
  });

  if (existingOwnedRoom) {
    console.warn(
      `User ${creatorMember.id} (owner) attempted to create a new room while old room data (VC: ${existingOwnedRoom.voiceChannelId}) still existed in DB. Forcing cleanup of old entry.`,
    );
    await cleanUpEphemeralRoom(
      guild,
      existingOwnedRoom.voiceChannelId,
      config,
      true,
    );
  }

  let targetCategory = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory && ch.name === sharedCategoryName,
  );

  if (!targetCategory) {
    try {
      targetCategory = await guild.channels.create({
        name: sharedCategoryName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            allow: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: guild.client.user.id,
            allow: [
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageRoles,
              PermissionsBitField.Flags.ViewChannel,
            ],
          },
        ],
      });
      console.log(`Created shared category: ${sharedCategoryName}`);
    } catch (error) {
      console.error(
        `Failed to create shared category ${sharedCategoryName}:`,
        error,
      );
      throw new Error(
        `Could not find or create the category: ${sharedCategoryName}`,
      );
    }
  }

  const newVoiceChannel = await guild.channels.create({
    name: voiceChannelName,
    type: ChannelType.GuildVoice,
    parent: targetCategory.id,
    userLimit: maxSlots > 0 ? maxSlots : undefined,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        allow: [PermissionsBitField.Flags.Connect],
      },
      {
        id: creatorMember.id,
        allow: [PermissionsBitField.Flags.MoveMembers],
      },
    ],
  });

  const roomData = await EphemeralRoom.create({
    guildId: guild.id,
    voiceChannelId: newVoiceChannel.id,
    categoryId: targetCategory.id,
    messageId: "pending",
    maxSlots: maxSlots,
    ownerId: creatorMember.id,
    createdAt: new Date(),
  });

  await updateRoomMessage(guild, newVoiceChannel.id, config);

  return { voiceChannel: newVoiceChannel, roomData };
}

function buildRoomEmbed(voiceChannel, roomData) {
  const { createdAt, maxSlots, ownerId } = roomData;
  const allMembers = [...voiceChannel.members.values()];

  const occupantCount = allMembers.length;
  const freeCount = Math.max(0, maxSlots - occupantCount);

  const slotLines = [];
  for (let i = 0; i < maxSlots; i++) {
    if (i < occupantCount) {
      const occupant = allMembers[i];
      const isOwner = occupant.id === ownerId;
      slotLines.push(`🔴 <@${occupant.id}>${isOwner ? " (👑 Owner)" : ""}`);
    } else {
      slotLines.push("🟢 Available Slot");
    }
  }

  const statusLine =
    freeCount > 0 ? `Looking for ${freeCount} more player(s)` : "Room Full";
  const color = freeCount > 0 ? 0x57f287 : 0xed4245;

  const timeString = `<t:${Math.floor(createdAt.getTime() / 1000)}:R>`;

  const description = `Owner: <@${ownerId}>\nCreated: ${timeString}\n\n**Slots:**\n${slotLines.join(
    "\n",
  )}`;
  const footerText = `${statusLine} | ${occupantCount}/${maxSlots}`;

  return new EmbedBuilder()
    .setTitle(`Team Search: ${voiceChannel.name}`)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: footerText })
    .setTimestamp();
}

function buildActionButtons(isFull) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("join_room")
        .setLabel("Join Voice Channel")
        .setStyle(ButtonStyle.Success)
        .setDisabled(isFull),
      new ButtonBuilder()
        .setCustomId("kick_player_btn")
        .setLabel("Kick Player")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

async function updateRoomMessage(guild, voiceChannelId, config) {
  const roomData = await EphemeralRoom.findOne({
    guildId: guild.id,
    voiceChannelId: voiceChannelId,
  });
  if (!roomData) return;

  const voiceChannel = guild.channels.cache.get(voiceChannelId);
  if (!voiceChannel) {
    await cleanUpEphemeralRoom(guild, voiceChannelId, config, true);
    return;
  }

  const textChannel = guild.channels.cache.get(config.searchTextChannelId);
  if (!textChannel || textChannel.type !== ChannelType.GuildText) return;

  const embed = buildRoomEmbed(voiceChannel, roomData);
  const isFull = voiceChannel.members.size >= roomData.maxSlots;
  const components = buildActionButtons(isFull);

  try {
    if (roomData.messageId && roomData.messageId !== "pending") {
      const message = await textChannel.messages
        .fetch(roomData.messageId)
        .catch(() => null);
      if (message) {
        await message.edit({ embeds: [embed], components });
        return;
      } else {
        await EphemeralRoom.updateOne(
          { _id: roomData._id },
          { messageId: "pending" },
        );
        roomData.messageId = "pending";
      }
    }

    if (roomData.messageId === "pending") {
      const newMessage = await textChannel.send({
        embeds: [embed],
        components,
      });
      await EphemeralRoom.updateOne(
        { _id: roomData._id },
        { messageId: newMessage.id },
      );
    }
  } catch (error) {
    console.error(
      `Error updating room message for VC ${voiceChannelId}:`,
      error,
    );
    if (error.code === 10008 && roomData.messageId !== "pending") {
      console.log(
        `Message ${roomData.messageId} likely deleted, attempting to resend.`,
      );
      await EphemeralRoom.updateOne(
        { _id: roomData._id },
        { messageId: "pending" },
      );
    }
  }
}

function buildKickSelectMenu(voiceChannel, ownerId) {
  const members = [...voiceChannel.members.values()].filter(
    (m) => m.id !== ownerId,
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("kick_select")
    .setPlaceholder("Select a member to kick...")
    .setMinValues(1)
    .setMaxValues(1);

  if (members.length === 0) {
    selectMenu.addOptions({
      label: "No one to kick",
      description: "Only the owner is in the channel, or it is empty.",
      value: "no_members",
    });
    selectMenu.setDisabled(true);
  } else {
    selectMenu.addOptions(
      members.map((m) => ({
        label: m.displayName,
        description: `ID: ${m.id}`,
        value: m.id,
      })),
    );
  }
  return new ActionRowBuilder().addComponents(selectMenu);
}

async function cleanUpEphemeralRoom(
  guild,
  voiceChannelId,
  config,
  force = false,
) {
  const roomData = await EphemeralRoom.findOne({
    guildId: guild.id,
    voiceChannelId: voiceChannelId,
  });
  if (!roomData) return;

  const voiceChannel = guild.channels.cache.get(voiceChannelId);

  if (force || !voiceChannel || voiceChannel.members.size === 0) {
    console.log(
      `Cleaning up ephemeral room (VC: ${voiceChannelId}, Force: ${force})`,
    );

    if (
      roomData.messageId &&
      roomData.messageId !== "pending" &&
      config?.searchTextChannelId
    ) {
      const textCh = guild.channels.cache.get(config.searchTextChannelId);
      if (textCh) {
        await textCh.messages.delete(roomData.messageId).catch((err) => {
          if (err.code !== 10008)
            console.warn(
              `Could not delete ephemeral room message ${roomData.messageId}:`,
              err.message,
            );
        });
      }
    }

    if (voiceChannel) {
      await voiceChannel
        .delete("Ephemeral room cleanup")
        .catch((err) =>
          console.warn(
            `Could not delete ephemeral voice channel ${voiceChannelId}:`,
            err.message,
          ),
        );
    }

    const categoryIdToDeleteCheck = roomData.categoryId;
    try {
      await EphemeralRoom.deleteOne({ _id: roomData._id });
      console.log(`Ephemeral room VC ${voiceChannelId} and DB entry removed.`);
    } catch (dbError) {
      console.error(
        `Failed to delete EphemeralRoom DB entry for VC ${voiceChannelId}:`,
        dbError,
      );
      return;
    }

    if (categoryIdToDeleteCheck) {
      const category = guild.channels.cache.get(categoryIdToDeleteCheck);

      if (
        category &&
        category.type === ChannelType.GuildCategory &&
        SHARED_CATEGORY_NAMES.includes(category.name)
      ) {
        const remainingVoiceChannels = category.children.cache.filter(
          (ch) =>
            ch.type === ChannelType.GuildVoice && ch.id !== voiceChannelId,
        );

        if (remainingVoiceChannels.size === 0) {
          console.log(
            `Shared category ${category.name} (${categoryIdToDeleteCheck}) is now empty. Deleting...`,
          );
          await category
            .delete(`Shared search category empty`)
            .catch((err) =>
              console.warn(
                `Could not delete shared category ${categoryIdToDeleteCheck}:`,
                err.message,
              ),
            );
        } else {
          console.log(
            `Shared category ${category.name} still has ${remainingVoiceChannels.size} voice channel(s).`,
          );
        }
      }
    }
  }
}

module.exports = {
  deleteOldSearchCategories,
  createEphemeralRoom,
  updateRoomMessage,
  buildKickSelectMenu,
  cleanUpEphemeralRoom,
  getRoomProps,
  SHARED_CATEGORY_NAMES,
};
