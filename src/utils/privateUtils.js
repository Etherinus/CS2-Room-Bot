const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  PermissionsBitField,
} = require("discord.js");
const GuildConfig = require("../database/models/GuildConfig");
const PrivateRoom = require("../database/models/PrivateRoom");

async function deleteOldPrivateCategories(guild) {
  const config = await GuildConfig.findOne({ guildId: guild.id });
  const categoryId = config?.privateCategoryId;

  const categories = guild.channels.cache.filter(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      (ch.name === "Private Rooms" || (categoryId && ch.id === categoryId)),
  );

  for (const cat of categories.values()) {
    try {
      const children = guild.channels.cache.filter(
        (c) => c.parentId === cat.id,
      );
      for (const child of children.values()) {
        await child
          .delete(`Cleaning up old private category ${cat.name}`)
          .catch(() => {});
      }
      await cat
        .delete(`Cleaning up old private category ${cat.name}`)
        .catch(() => {});
    } catch (error) {
      console.warn(
        `Could not fully delete old category ${cat.name} (${cat.id}):`,
        error.message,
      );
    }
  }
}

async function setupPrivateCategory(guild) {
  await deleteOldPrivateCategories(guild);

  const privateCategory = await guild.channels.create({
    name: "Private Rooms",
    type: ChannelType.GuildCategory,
  });

  const controlPanelChannel = await guild.channels.create({
    name: "control-panel",
    type: ChannelType.GuildText,
    parent: privateCategory.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.SendMessages],
      },
      {
        id: guild.client.user.id,
        allow: [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      },
    ],
  });

  const createChannel = await guild.channels.create({
    name: "➕ Create Room",
    type: ChannelType.GuildVoice,
    parent: privateCategory.id,
  });

  const embed = buildCommonPrivateEmbed();
  const buttons = buildPrivateRoomButtons();
  const msgEmbed = await controlPanelChannel.send({
    embeds: [embed],
    components: buttons,
  });

  await GuildConfig.findOneAndUpdate(
    { guildId: guild.id },
    {
      privateCategoryId: privateCategory.id,
      privateControlChannelId: controlPanelChannel.id,
      privateCreateChannelId: createChannel.id,
      globalPrivateEmbedId: msgEmbed.id,
    },
    { upsert: true, new: true },
  );
}

function buildCommonPrivateEmbed() {
  const description = [
    "✏️ - Rename your room",
    "👥 - Set user limit",
    "🔒 - Lock / Unlock room",
    "🚫 - Deny User Access",
    "✅ - Allow User Access",
    "🎤 - Manage Speak Permissions",
    "🙈 - Hide / Unhide room",
    "🔧 - Manage Moderators",
    "🔇 - Mute/Unmute All",
    "🔞 - Toggle NSFW status",
  ].join("\n");

  return new EmbedBuilder()
    .setTitle("Private Room Controls")
    .setDescription(description)
    .setColor(0x242429)
    .setFooter({
      text: "Use these buttons to manage your current private room.",
    });
}

function buildPrivateRoomButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("pr_rename")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("pr_limit")
      .setEmoji("👥")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("pr_lock_toggle")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("pr_deny")
      .setEmoji("🚫")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("pr_allow")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("pr_speak")
      .setEmoji("🎤")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("pr_visibility_toggle")
      .setEmoji("🙈")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("pr_manage_mods")
      .setEmoji("🔧")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("pr_mute_all_toggle")
      .setEmoji("🔇")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("pr_nsfw_toggle")
      .setEmoji("🔞")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

async function createPrivateRoom(guild, ownerMember, config) {
  if (!config.privateCategoryId) {
    throw new Error("Private category configuration not found for this guild.");
  }

  const existingRoom = await PrivateRoom.findOne({
    guildId: guild.id,
    ownerId: ownerMember.id,
  });
  if (existingRoom) {
    const existingChannel = guild.channels.cache.get(
      existingRoom.voiceChannelId,
    );
    if (existingChannel) {
      await ownerMember.voice.setChannel(existingChannel).catch(console.error);
      throw new Error("User already owns a private room.");
    } else {
      await PrivateRoom.deleteOne({ _id: existingRoom._id });
    }
  }

  const initialName = `${ownerMember.user.username}'s Room`;
  const voiceChannel = await guild.channels.create({
    name: initialName,
    type: ChannelType.GuildVoice,
    parent: config.privateCategoryId,
    permissionOverwrites: [
      {
        id: ownerMember.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.MoveMembers,
        ],
      },
      {
        id: guild.roles.everyone,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
        ],
        deny: [],
      },
    ],
  });

  await PrivateRoom.create({
    guildId: guild.id,
    voiceChannelId: voiceChannel.id,
    ownerId: ownerMember.id,
    isClosed: false,
    isHidden: false,
    isMutedAll: false,
    isNsfw: false,
  });

  return voiceChannel;
}

async function handlePrivateRoomButton(interaction, config) {
  const member = interaction.member;
  const guild = interaction.guild;
  const buttonId = interaction.customId;

  if (buttonId === "pr_claim") {
    const potentialChannel = member.voice.channel;
    if (
      !potentialChannel ||
      potentialChannel.parentId !== config.privateCategoryId ||
      potentialChannel.id === config.privateCreateChannelId
    ) {
      return interaction.reply({
        content:
          "You must be in a private voice channel (that is not the create channel) to claim it.",
        ephemeral: true,
      });
    }
    try {
      return interaction.reply({
        content: `You have successfully claimed ownership of <#${potentialChannel.id}>!`,
        ephemeral: true,
      });
    } catch (permError) {
      console.error("Claim Permission Error:", permError);
      return interaction.reply({
        content:
          "Ownership claimed in database, but failed to update channel permissions. Please check bot permissions.",
        ephemeral: true,
      });
    }
  }

  const roomData = await PrivateRoom.findOne({
    guildId: guild.id,
    ownerId: member.id,
  });

  if (!roomData) {
    return interaction.reply({
      content:
        "You do not currently own a private room, or your room data could not be found.",
      ephemeral: true,
    });
  }

  const voiceChannel = guild.channels.cache.get(roomData.voiceChannelId);
  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    await PrivateRoom.deleteOne({ _id: roomData._id });
    return interaction.reply({
      content:
        "Your private room channel seems to be deleted. The database entry has been removed.",
      ephemeral: true,
    });
  }

  if (buttonId === "pr_rename") {
    const modal = new ModalBuilder()
      .setCustomId(`modal_pr_rename_${voiceChannel.id}`)
      .setTitle("Rename Private Room");
    const nameInput = new TextInputBuilder()
      .setCustomId("roomName")
      .setLabel("New Room Name")
      .setStyle(TextInputStyle.Short)
      .setValue(voiceChannel.name)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    return interaction.showModal(modal);
  } else if (buttonId === "pr_limit") {
    const modal = new ModalBuilder()
      .setCustomId(`modal_pr_limit_${voiceChannel.id}`)
      .setTitle("Set User Limit");
    const limitInput = new TextInputBuilder()
      .setCustomId("roomLimit")
      .setLabel("User Limit (0 for unlimited)")
      .setStyle(TextInputStyle.Short)
      .setValue(voiceChannel.userLimit.toString())
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
    return interaction.showModal(modal);
  } else if (buttonId === "pr_speak") {
    const modal = new ModalBuilder()
      .setCustomId(`modal_pr_speak_${voiceChannel.id}`)
      .setTitle("Manage Speak Permissions");
    const userIdInput = new TextInputBuilder()
      .setCustomId("targetUserId")
      .setLabel("User ID (@ not needed)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    const actionInput = new TextInputBuilder()
      .setCustomId("speakAction")
      .setLabel("Action: allow / deny / reset")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("allow")
      .setRequired(true);
    modal.addComponents(
      new ActionRowBuilder().addComponents(userIdInput),
      new ActionRowBuilder().addComponents(actionInput),
    );
    return interaction.showModal(modal);
  } else if (buttonId === "pr_deny") {
    const modal = new ModalBuilder()
      .setCustomId(`modal_pr_deny_${voiceChannel.id}`)
      .setTitle("Deny User Access");
    const userIdInput = new TextInputBuilder()
      .setCustomId("targetUserId")
      .setLabel("User ID (@ not needed)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
    return interaction.showModal(modal);
  } else if (buttonId === "pr_allow") {
    const modal = new ModalBuilder()
      .setCustomId(`modal_pr_allow_${voiceChannel.id}`)
      .setTitle("Allow User Access");
    const userIdInput = new TextInputBuilder()
      .setCustomId("targetUserId")
      .setLabel("User ID (@ not needed)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
    return interaction.showModal(modal);
  } else if (buttonId === "pr_manage_mods") {
    const modal = new ModalBuilder()
      .setCustomId(`modal_pr_manage_mods_${voiceChannel.id}`)
      .setTitle("Manage Moderators");
    const userIdInput = new TextInputBuilder()
      .setCustomId("targetUserId")
      .setLabel("User ID (@ not needed)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    const actionInput = new TextInputBuilder()
      .setCustomId("modAction")
      .setLabel("Action: grant / revoke")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("grant")
      .setRequired(true);
    modal.addComponents(
      new ActionRowBuilder().addComponents(userIdInput),
      new ActionRowBuilder().addComponents(actionInput),
    );
    return interaction.showModal(modal);
  } else if (buttonId === "pr_transfer") {
    const modal = new ModalBuilder()
      .setCustomId(`modal_pr_transfer_${voiceChannel.id}`)
      .setTitle("Transfer Ownership");
    const userIdInput = new TextInputBuilder()
      .setCustomId("targetUserId")
      .setLabel("New Owner User ID (@ not needed)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
    return interaction.showModal(modal);
  } else if (buttonId === "pr_lock_toggle") {
    const isCurrentlyLocked = !voiceChannel
      .permissionsFor(guild.roles.everyone)
      .has(PermissionsBitField.Flags.Connect);
    try {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, {
        Connect: isCurrentlyLocked ? null : false,
      });
      await voiceChannel.permissionOverwrites.edit(member.id, {
        Connect: true,
      });
      await PrivateRoom.updateOne(
        { _id: roomData._id },
        { isClosed: !isCurrentlyLocked },
      );
      await interaction.reply({
        content: `Room is now ${isCurrentlyLocked ? "unlocked" : "locked"}.`,
        ephemeral: true,
      });
    } catch (permError) {
      console.error("Lock Toggle Error:", permError);
      await interaction.reply({
        content: "Failed to toggle lock status. Check bot permissions.",
        ephemeral: true,
      });
    }
  } else if (buttonId === "pr_visibility_toggle") {
    const isCurrentlyHidden = !voiceChannel
      .permissionsFor(guild.roles.everyone)
      .has(PermissionsBitField.Flags.ViewChannel);
    try {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, {
        ViewChannel: isCurrentlyHidden ? null : false,
      });
      await voiceChannel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
      });
      await PrivateRoom.updateOne(
        { _id: roomData._id },
        { isHidden: !isCurrentlyHidden },
      );
      await interaction.reply({
        content: `Room is now ${isCurrentlyHidden ? "visible" : "hidden"}.`,
        ephemeral: true,
      });
    } catch (permError) {
      console.error("Visibility Toggle Error:", permError);
      await interaction.reply({
        content: "Failed to toggle visibility. Check bot permissions.",
        ephemeral: true,
      });
    }
  } else if (buttonId === "pr_mute_all_toggle") {
    const isCurrentlyMuted = roomData.isMutedAll ?? false;
    const shouldMute = !isCurrentlyMuted;
    try {
      for (const [memberId, vcMember] of voiceChannel.members) {
        if (memberId !== roomData.ownerId && !vcMember.user.bot) {
          await voiceChannel.permissionOverwrites
            .edit(memberId, { Speak: shouldMute ? false : null })
            .catch((permErr) =>
              console.error(
                `Failed to set speak perm for ${memberId}:`,
                permErr,
              ),
            );
        }
      }
      await PrivateRoom.updateOne(
        { _id: roomData._id },
        { isMutedAll: shouldMute },
      );
      await interaction.reply({
        content: `All members (except owner) have been ${
          shouldMute ? "muted" : "unmuted"
        }.`,
        ephemeral: true,
      });
    } catch (permError) {
      console.error("Mute All Toggle Error:", permError);
      await interaction.reply({
        content:
          "Failed to toggle mute status for members. Check bot permissions.",
        ephemeral: true,
      });
    }
  } else if (buttonId === "pr_nsfw_toggle") {
    const isCurrentlyNsfw = voiceChannel.nsfw;
    const shouldBeNsfw = !isCurrentlyNsfw;
    try {
      await voiceChannel.edit(
        { nsfw: shouldBeNsfw },
        `NSFW status toggled by ${member.user.tag}`,
      );
      await PrivateRoom.updateOne(
        { _id: roomData._id },
        { isNsfw: shouldBeNsfw },
      );
      await interaction.reply({
        content: `Room NSFW status set to: ${shouldBeNsfw}.`,
        ephemeral: true,
      });
    } catch (editError) {
      console.error("NSFW Toggle Error:", editError);
      await interaction.reply({
        content:
          "Failed to toggle NSFW status for the channel. Check bot permissions.",
        ephemeral: true,
      });
    }
  } else if (buttonId === "pr_delete") {
    try {
      await voiceChannel.delete(`Deleted by owner ${member.user.tag}`);
      await PrivateRoom.deleteOne({ _id: roomData._id });
      await interaction.reply({
        content: "Your private room has been deleted.",
        ephemeral: true,
      });
    } catch (deleteError) {
      console.error("Delete Room Error:", deleteError);
      await interaction.reply({
        content:
          "Failed to delete the room channel. Check bot permissions. The database entry may still exist.",
        ephemeral: true,
      });
    }
  } else {
    await interaction.reply({
      content: "This button action is not recognized or implemented yet.",
      ephemeral: true,
    });
  }
}

async function handleModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const { customId, fields, guild, member } = interaction;
  const parts = customId.split("_");
  if (parts.length < 4 || parts[0] !== "modal" || parts[1] !== "pr") {
    return interaction.editReply("Invalid modal ID format.");
  }

  const action = parts[2];
  const voiceChannelId = parts[3];

  const voiceChannel = guild.channels.cache.get(voiceChannelId);
  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    return interaction.editReply(
      "The associated voice channel could not be found.",
    );
  }

  const roomData = await PrivateRoom.findOne({
    guildId: guild.id,
    voiceChannelId: voiceChannelId,
  });
  if (!roomData) {
    return interaction.editReply(
      "Could not find the data for this private room.",
    );
  }
  const isOwner = roomData.ownerId === member.id;
  const hasManagePerms = voiceChannel
    .permissionsFor(member)
    .has(PermissionsBitField.Flags.ManageChannels);

  if (!isOwner && !hasManagePerms && action !== "claim") {
    return interaction.editReply(
      "You do not have permission to manage this room.",
    );
  }
  try {
    if (action === "rename") {
      const newName = fields.getTextInputValue("roomName");
      if (!newName || newName.length > 100) {
        return interaction.editReply(
          "Invalid name provided (1-100 characters).",
        );
      }
      await voiceChannel.edit(
        { name: newName },
        `Renamed by ${member.user.tag}`,
      );
      await interaction.editReply(`Room renamed to "${newName}".`);
    } else if (action === "limit") {
      const limitStr = fields.getTextInputValue("roomLimit");
      const limit = parseInt(limitStr, 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.editReply(
          "Invalid user limit. Please enter a number between 0 (unlimited) and 99.",
        );
      }
      await voiceChannel.edit(
        { userLimit: limit },
        `Limit set by ${member.user.tag}`,
      );
      await interaction.editReply(
        `User limit set to ${limit === 0 ? "unlimited" : limit}.`,
      );
    } else if (action === "speak") {
      const targetUserId = fields.getTextInputValue("targetUserId").trim();
      const speakAction = fields
        .getTextInputValue("speakAction")
        .toLowerCase()
        .trim();
      const targetMember = await guild.members
        .fetch(targetUserId)
        .catch(() => null);
      if (!targetMember)
        return interaction.editReply("Invalid User ID provided.");

      let permissionValue;
      if (speakAction === "allow") permissionValue = true;
      else if (speakAction === "deny") permissionValue = false;
      else if (speakAction === "reset") permissionValue = null;
      else
        return interaction.editReply(
          'Invalid action. Use "allow", "deny", or "reset".',
        );

      await voiceChannel.permissionOverwrites.edit(targetMember.id, {
        Speak: permissionValue,
      });
      await interaction.editReply(
        `Speak permission for <@${targetUserId}> set to: ${speakAction}.`,
      );
    } else if (action === "deny") {
      const targetUserId = fields.getTextInputValue("targetUserId").trim();
      const targetMember = await guild.members
        .fetch(targetUserId)
        .catch(() => null);
      if (!targetMember)
        return interaction.editReply("Invalid User ID provided.");

      await voiceChannel.permissionOverwrites.edit(targetMember.id, {
        Connect: false,
      });
      if (targetMember.voice.channelId === voiceChannel.id) {
        await targetMember.voice
          .disconnect(`Denied access by room owner ${member.user.tag}`)
          .catch(() => {});
      }
      await interaction.editReply(
        `Access denied for <@${targetUserId}>. They cannot join this room.`,
      );
    } else if (action === "allow") {
      const targetUserId = fields.getTextInputValue("targetUserId").trim();
      const targetMember = await guild.members
        .fetch(targetUserId)
        .catch(() => null);
      if (!targetMember)
        return interaction.editReply("Invalid User ID provided.");

      await voiceChannel.permissionOverwrites.edit(targetMember.id, {
        Connect: true,
      });
      await interaction.editReply(
        `Access explicitly granted for <@${targetUserId}>.`,
      );
    } else if (action === "manage_mods") {
      const targetUserId = fields.getTextInputValue("targetUserId").trim();
      const modAction = fields
        .getTextInputValue("modAction")
        .toLowerCase()
        .trim();
      const targetMember = await guild.members
        .fetch(targetUserId)
        .catch(() => null);

      if (!targetMember)
        return interaction.editReply("Invalid User ID provided.");
      if (targetUserId === roomData.ownerId)
        return interaction.editReply(
          "You cannot change moderator status for the owner.",
        );

      let permissionValue;
      let replyMessage;

      if (modAction === "grant") {
        permissionValue = true;
        replyMessage = `Moderator privileges granted to <@${targetUserId}>.`;
      } else if (modAction === "revoke") {
        permissionValue = null;
        replyMessage = `Moderator privileges revoked from <@${targetUserId}>.`;
      } else {
        return interaction.editReply(
          'Invalid action. Use "grant" or "revoke".',
        );
      }

      await voiceChannel.permissionOverwrites.edit(targetMember.id, {
        ManageChannels: permissionValue,
        MoveMembers: permissionValue,
      });
      await interaction.editReply(replyMessage);
    } else if (action === "transfer") {
      const targetUserId = fields.getTextInputValue("targetUserId").trim();
      if (targetUserId === member.id)
        return interaction.editReply(
          "You cannot transfer ownership to yourself.",
        );

      const targetMember = await guild.members
        .fetch(targetUserId)
        .catch(() => null);
      if (!targetMember)
        return interaction.editReply(
          "Invalid User ID provided for the new owner.",
        );

      const targetOwnedRoom = await PrivateRoom.findOne({
        guildId: guild.id,
        ownerId: targetMember.id,
      });
      if (targetOwnedRoom) {
        return interaction.editReply(
          `<@${targetUserId}> already owns another private room (<#${targetOwnedRoom.voiceChannelId}>). They must delete it first.`,
        );
      }

      await PrivateRoom.updateOne(
        { _id: roomData._id },
        { ownerId: targetMember.id },
      );

      await voiceChannel.permissionOverwrites.edit(member.id, {
        ManageChannels: null,
        MoveMembers: null,
      });
      await voiceChannel.permissionOverwrites.edit(targetMember.id, {
        ManageChannels: true,
        MoveMembers: true,
        ViewChannel: true,
        Connect: true,
        Speak: true,
      });

      await interaction.editReply(
        `Ownership transferred to <@${targetUserId}>!`,
      );
    } else {
      await interaction.editReply("This modal action is not recognized.");
    }
  } catch (error) {
    console.error(`Error processing modal ${customId}:`, error);
    await interaction
      .editReply(
        "An error occurred while processing your request. Check bot permissions and user IDs.",
      )
      .catch(() => {});
  }
}

async function cleanUpPrivateRoom(guild, channelId) {
  const roomData = await PrivateRoom.findOne({
    guildId: guild.id,
    voiceChannelId: channelId,
  });
  if (!roomData) return;

  const voiceChannel = guild.channels.cache.get(channelId);

  if (!voiceChannel) {
    await PrivateRoom.deleteOne({ _id: roomData._id });
    console.log(
      `Cleaned up DB entry for missing private room channel ${channelId}`,
    );
    return;
  }

  if (voiceChannel.members.size === 0) {
    try {
      await voiceChannel.delete(`Private room empty`);
      await PrivateRoom.deleteOne({ _id: roomData._id });
      console.log(
        `Deleted empty private room ${voiceChannel.name} (${channelId}) and DB entry.`,
      );
    } catch (error) {
      console.error(`Failed to delete empty private room ${channelId}:`, error);
    }
  }
}

module.exports = {
  setupPrivateCategory,
  createPrivateRoom,
  handlePrivateRoomButton,
  handleModalSubmit,
  cleanUpPrivateRoom,
  buildCommonPrivateEmbed,
  buildPrivateRoomButtons,
};
