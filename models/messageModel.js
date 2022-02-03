import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let systemmessageSchema = new schema({
        type: Number,
        tick: Number,
        title: String,
        body: String,
        status: Boolean,
        user: {
            type: ObjectID,
            ref: "userModel"
        },
        attachments: [
            {
                type: ObjectID,
                ref: "fileModel"
            }
        ]
    }, { collection: 'systemMessages' });
    return mongoose.model('systemmessageModel', systemmessageSchema);
}