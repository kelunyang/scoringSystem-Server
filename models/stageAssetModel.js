import { ObjectId } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let stageAssetModel = new schema({
    tick: Number,
    tid: {
      type: ObjectId,
      ref: 'stageModel'
    },
    value: Number,
    gid: {
      type: ObjectId,
      ref: 'groupModel'
    },
    sid: {
      type: ObjectId,
      ref: 'schemaModel'
    },
    comment: String,
    invalid: Number
  }, { collection: 'stageAssetDB' });
  return mongoose.model('stageAssetModel', stageAssetModel);
}