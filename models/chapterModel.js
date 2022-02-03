import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let chapterSchema = new schema({
        createDate: Number,
        modDate: Number,
        title: String,
        sort: Number,
        user: {
            type: ObjectID,
            ref: 'userModel'
        },
        KBs: [
            {
                type: ObjectID,
                ref: "KBModel"
            }
        ],
        tag: [{
            type: ObjectID,
            ref: "tagModel"
        }]
    }, { collection: 'chapterDB' });
    return mongoose.model('chapterModel', chapterSchema);
}