const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
  let schema = mongoose.Schema;
  let globalSettingSchema =  new schema({
    defaultPassword: String,
    settingTags: [
      {
        type: ObjectID,
        ref: "tagModel"
      }
    ],
    userTags: [
      {
        type: ObjectID,
        ref: "tagModel"
      }
    ],
    projectTags: [
      {
        type: ObjectID,
        ref: "tagModel"
      }
    ],
    statisticsTags: [
      {
        type: ObjectID,
        ref: "tagModel"
      }
    ],
    serviceTags: [
      {
        type: ObjectID,
        ref: "tagModel"
      }
    ],
    robotTag: {
      type: ObjectID,
      ref: "tagModel"
    },
    githubKey: String,
    backendRepo: String,
    frontendRepo: String,
    botRepo: String,
    siteLocation: String,
    versionBackend: String,
    versionFrontend: String,
    versionBot: String,
    storageLocation: String,
    userCheckTime: Number,
    tick: Number,
    connectionTimeout: Number,
    systemName: String
  }, { collection: 'globalSettings' });
  return mongoose.model('globalModel', globalSettingSchema);
}