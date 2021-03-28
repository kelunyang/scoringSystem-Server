const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let stageSchema = new schema({
        createDate: Number,
        modDate: Number,
        current: Boolean,
        name: String,
        dueTick: Number,
        passTick: Number,
        startTick: Number,
        sort: Number,
        objectives: [
            {
                type: ObjectID,
                ref: 'objectiveModel'
            }
        ],
        KB: {
            type: ObjectID,
            ref: 'KBModel'
        },
        pmTags: [
            {
                type: ObjectID,
                ref: "tagModel"
            }
        ],
        reviewerTags: [
            {
                type: ObjectID,
                ref: "tagModel"
            }
        ],
        vendorTags: [
            {
                type: ObjectID,
                ref: "tagModel"
            }
        ],
        writerTags: [
            {
                type: ObjectID,
                ref: "tagModel"
            }
        ],
        finalTags: [
            {
                type: ObjectID,
                ref: "tagModel"
            }
        ]
    }, { collection: 'stageDB' });
    return mongoose.model('stageModel', stageSchema);
}