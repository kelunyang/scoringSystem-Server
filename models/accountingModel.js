import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let accountingModel = new schema({
    tick: Number,
    sid: {
      type: ObjectID,
      ref: 'schemaModel'
    },
    uid: {
      type: ObjectID,
      ref: 'userModel'
    },
    value: Number,
    desc: String,
    invalid: Number
  }, { collection: 'accountingDB' });
  return mongoose.model('accountingModel', accountingModel);
}