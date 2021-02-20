const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let globalSettingSchema =  new schema({
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
        robotTag: {
            type: ObjectID,
            ref: "tagModel"
        },
        tick: Number
    }, { collection: 'globalSettings' });
    return mongoose.model('globalModel', globalSettingSchema);
}