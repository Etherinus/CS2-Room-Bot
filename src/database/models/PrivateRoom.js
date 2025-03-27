const mongoose = require("mongoose");

const privateRoomSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  voiceChannelId: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  isClosed: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  isMutedAll: { type: Boolean, default: false },
  isNsfw: { type: Boolean, default: false },
});

privateRoomSchema.index({ guildId: 1, ownerId: 1 });
privateRoomSchema.index({ guildId: 1, voiceChannelId: 1 });

module.exports = mongoose.model("PrivateRoom", privateRoomSchema);
