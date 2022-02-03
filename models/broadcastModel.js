import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let broadcastSchema = new schema({
        tick: Number,
        title: String,
        body: String,
        sender: {
            type: ObjectID,
            ref: "userModel"
        },
        recievers: [
            {
                type: ObjectID,
                ref: "userModel"
            }
        ]
    }, { collection: 'broadcastDB' });
    return mongoose.model('broadcastModel', broadcastSchema);
}