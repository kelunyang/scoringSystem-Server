import { ObjectId } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let reportModel = new schema({
    content: String,
    tick: Number,
    sid: {
      type: ObjectId,
      ref: 'schemaModel'
    },
    tid: {
      type: ObjectId,
      ref: 'stageModel'
    },
    gid: {
      type: ObjectId,
      ref: 'groupModel'
    },
    coworkers: [
      {
        type: ObjectId,
        ref: 'userModel'
      }
    ],
    audits: [
      {
        type: ObjectId,
        ref: 'auditModel'
      }
    ],
    value: Number,
    grantedUser: {
      type: ObjectId,
      ref: 'userModel'
    },
    grantedDate: Number,
    grantedValue: Number,
    gained: Number,
    visibility: Boolean,
    revokeTick: Number,
    tag: {
      type: ObjectId,
      ref: 'tagModel'
    },
    locked: Boolean,
    lockedTick: Number,
    totalBalance: Number,
    intervention: [
      {
        type: ObjectId,
        ref: 'interventionModel'
      }
    ]
  }, { collection: 'reportDB' });
  return mongoose.model('reportModel', reportModel);
}