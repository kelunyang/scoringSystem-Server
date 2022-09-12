import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let schemaModel = new schema({
    name: String,
    createTick: Number,
    modTick: Number,
    supervisors: [
      {
        type: ObjectID,
        ref: 'userModel'
      }
    ],
    groups: [
      {
        type: ObjectID,
        ref: 'groupModel'
      }
    ],
    stages: [
      {
        type: ObjectID,
        ref: 'stageModel'
      }
    ],
    initCapital: Number,
    gapRate: Number,
    status: Number,
    memberRate: Number,
    workerRate: Number,
    leaderRate: Number,
    tagGroupped: Boolean,
    shortBonus: Number
  }, { collection: 'schemaDB' });
  return mongoose.model('schemaModel', schemaModel);
}