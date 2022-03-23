import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let lineDBSchema = new schema({
        tick: Number,
        body: String,
        log: [{
            uid: {
                type: ObjectID,
                ref: "userModel"
            },
            tick: Number,
            status: Number
        }],
        type: Number
    }, { collection: 'lineDB' });
    return mongoose.model('lineDBModel', lineDBSchema);
}