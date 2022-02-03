import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let issueSchema = new schema({
        KB: {
            type: ObjectID,
            ref: 'KBModel'
        },
        version: {
            type: ObjectID,
            ref: 'fileModel'
        },
        objective: {
            type: ObjectID,
            ref: 'objectiveModel'
        },
        tick: Number,
        title: String,
        position: Number,
        body: String,
        user: {
            type: ObjectID,
            ref: "userModel"
        },
        attachments: [
            {
                type: ObjectID,
                ref: 'fileModel'
            }
        ],
        status: Boolean,
        star: Boolean,
        sealed: Boolean,
        parent: {
            type: ObjectID,
            ref: 'issueModel'
        }
    }, { collection: 'issueDB' });
    return mongoose.model('issueModel', issueSchema);
}