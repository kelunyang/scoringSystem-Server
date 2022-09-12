import { ObjectId } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let depositModel = new schema({
    tid: {
      type: ObjectId,
      ref: 'stageModel'
    },
    uid: {
      type: ObjectId,
      ref: 'userModel'
    },
    gid: {
      type: ObjectId,
      ref: 'groupModel'
    },
    value: Number,
    confirmTick: Number,
    confirm: Boolean,
    joinTick: Number,
    requestTick: Number,
    totalDeposit: Number
  }, { collection: 'depositDB' });
  return mongoose.model('depositModel', depositModel);
}