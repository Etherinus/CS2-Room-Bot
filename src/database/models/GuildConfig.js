const mongoose = require("mongoose");

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  searchTextChannelId: { type: String, default: null },
  searchSetupChannels: {
    faceit: { type: String, default: null },
    cs2: { type: String, default: null },
    mmPrime: { type: String, default: null },
    partners: { type: String, default: null },
  },
  privateCategoryId: { type: String, default: null },
  privateControlChannelId: { type: String, default: null },
  privateCreateChannelId: { type: String, default: null },
  globalPrivateEmbedId: { type: String, default: null },
});

module.exports = mongoose.model("GuildConfig", guildConfigSchema);
