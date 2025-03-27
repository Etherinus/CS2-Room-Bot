const mongoose = require("mongoose");

const ephemeralRoomSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  voiceChannelId: { type: String, required: true, unique: true },
  categoryId: { type: String, required: true },
  messageId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  maxSlots: { type: Number, required: true },
  ownerId: { type: String, required: true },
});

ephemeralRoomSchema.index({ guildId: 1 });

module.exports = mongoose.model("EphemeralRoom", ephemeralRoomSchema);
