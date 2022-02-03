import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let readedVersionSchema = new schema({
        user: {
            type: ObjectID,
            ref: "userModel"
        },
        version: {
            type: ObjectID,
            ref: "fileModel"
        },
        KBID: {
            type: ObjectID,
            ref: "KBModel"
        },
        tick: Number
    }, { collection: 'readedVersionDB' });
    return mongoose.model('readedVersionModel', readedVersionSchema);
}