const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let KBSchema = new schema({
        createDate: Number,
        modDate: Number,
        title: String,
        desc: String,
        descAtt: [
            {
                type: ObjectID,
                ref: "fileModel"
            }
        ],
        tag: [{
            type: ObjectID,
            ref: 'tagModel'
        }],
        user: {
            type: ObjectID,
            ref: 'userModel'
        },
        chapter: {
            type: ObjectID,
            ref: 'chapterModel'
        },
        sort: Number,
        textbook: String,
        versions: [{
            type: ObjectID,
            ref: "fileModel"
        }],
        issues: [
            {
                type: ObjectID,
                ref: "issueModel"
            }
        ],
        eventLog: [
            {
                type: ObjectID,
                ref: 'eventlogModel'
            }
        ],
        stages: [
            {
                type: ObjectID,
                ref: 'stageModel'
            }
        ]
    }, { collection: 'KBDB' });
    return mongoose.model('KBModel', KBSchema);
}