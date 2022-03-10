import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let userSchema = new schema({
        tags: [{
            type: ObjectID,
            ref: "tagModel"
        }],
        types: String,
        name: String,
        unit: String,
        email: String,
        createDate: Number,
        modDate: Number,
        lineCode: String,
        lineDate: Number,
        lineToken: String,
        password: String,
        firstRun: Boolean,
        seed: String
    }, { collection: 'userDB' });
    return mongoose.model('userModel', userSchema);
}