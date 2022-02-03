import { ObjectID } from 'mongodb';

export default function (mongoose) {
    let schema = mongoose.Schema;
    let objectiveSchema = new schema({
        signUser: {
            type: ObjectID,
            ref: 'userModel'
        },
        signTick: Number,
        KB: {
            type: ObjectID,
            ref: 'KBModel'
        },
        stage: {
            type: ObjectID,
            ref: 'stageModel'
        },
        name: String,
        tick: Number
    }, { collection: 'objectiveDB' });
    return mongoose.model('objectiveModel', objectiveSchema);
}