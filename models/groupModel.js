import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let groupModel = new schema({
    createTick: Number,
    modTick: Number,
    locked: Boolean,
    sid: {
      type: ObjectID,
      ref: 'schemaModel'
    },
    leaders: [
      {
        type: ObjectID,
        ref: 'userModel'
      }
    ],
    members: [
      {
        type: ObjectID,
        ref: 'userModel'
      }
    ],
    tag: {
      type: ObjectID,
      ref: 'tagModel'
    }
  }, { collection: 'groupDB' });
  return mongoose.model('groupModel', groupModel);
}