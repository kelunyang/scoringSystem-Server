import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let readedIssueSchema = new schema({
        user: {
            type: ObjectID,
            ref: "userModel"
        },
        issue: {
            type: ObjectID,
            ref: "issueModel"
        },
        tick: Number
    }, { collection: 'readedIssueDB' });
    return mongoose.model('readedIssueModel', readedIssueSchema);
}