import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let feedbackSchema = new schema({
        tick: Number,
        title: String,
        type: [String],
        body: String,
        users: [
            {
                type: ObjectID,
                ref: "userModel"
            }
        ],
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
        rating:  [
            {
                type: ObjectID,
                ref: "userModel"
            }
        ],
        parent: mongoose.Schema.Types.Mixed
    }, { collection: 'feedbackDB' });
    return mongoose.model('feedbackModel', feedbackSchema);
}