import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let tagSchema = new schema({
        name: String,
        tick: Number,
        modTick: Number,
        visibility: Boolean
    }, { collection: 'tagDB' });
    return mongoose.model('tagModel', tagSchema);
}