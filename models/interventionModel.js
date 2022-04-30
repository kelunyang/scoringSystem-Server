import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let interventionModel = new schema({
    content: String,
    tick: Number,
    user: {
      type: ObjectID,
      ref: 'userModel'
    },
    value: Number
  }, { collection: 'interventionDB' });
  return mongoose.model('interventionModel', interventionModel);
}