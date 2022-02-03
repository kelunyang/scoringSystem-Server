import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let notifytemplateSchema = new schema({
        createTick: Number,
        modTick: Number,
        title: String,
        body: String,
        sendTick: Number,
        setTick: Number,
        durationDay: Number,
        group: [
            {
                type: ObjectID,
                ref: "tagModel"
            }
        ],
        creator: {
            type: ObjectID,
            ref: "userModel"
        },
        editor: {
            type: ObjectID,
            ref: "userModel"
        },
        status: Boolean
    }, { collection: 'notifytemplateDB' });
    return mongoose.model('notifytemplateModel', notifytemplateSchema);
}