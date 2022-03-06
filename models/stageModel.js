import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let stageModel = new schema({
    name: String,
    createTick: Number,
    modTick: Number,
    endTick: Number,
    startTick: Number,
    order: Number,
    value: Number,
    sid: {
      type: ObjectID,
      ref: 'schemaModel'
    },
    reports: [
      {
        type: ObjectID,
        ref: 'reportModel'
      }
    ],
    desc: String,
    matchPoint: Boolean,
    closed: Number
  }, { collection: 'stageDB' });
  return mongoose.model('stageModel', stageModel);
}