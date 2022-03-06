import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let eventlogSchema = new schema({
    tick: Number,
    desc: String,
    type: String,
    sid: {
      type: ObjectID,
      ref: 'schemaModel'
    },
    user: {
      type: ObjectID,
      ref: "userModel"
    }
  }, { collection: 'eventlogDB' });
  return mongoose.model('eventlogModel', eventlogSchema);
}