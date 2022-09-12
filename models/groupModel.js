import { ObjectId } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let groupModel = new schema({
    createTick: Number,
    modTick: Number,
    locked: Boolean,
    sid: {
      type: ObjectId,
      ref: 'schemaModel'
    },
    leaders: [
      {
        type: ObjectId,
        ref: 'userModel'
      }
    ],
    members: [
      {
        type: ObjectId,
        ref: 'userModel'
      }
    ],
    tag: {
      type: ObjectId,
      ref: 'tagModel'
    }
  }, { collection: 'groupDB' });
  return mongoose.model('groupModel', groupModel);
}