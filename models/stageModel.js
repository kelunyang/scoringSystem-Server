import { ObjectId } from 'mongodb';

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
      type: ObjectId,
      ref: 'schemaModel'
    },
    reports: [
      {
        type: ObjectId,
        ref: 'reportModel'
      }
    ],
    desc: String,
    matchPoint: Boolean,
    closed: Number,
    replyDisabled: Number,
    defaultDeposit: Number,
    depositStep: Number,
  }, { collection: 'stageDB' });
  return mongoose.model('stageModel', stageModel);
}