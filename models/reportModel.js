import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let reportModel = new schema({
    content: String,
    tick: Number,
    sid: {
      type: ObjectID,
      ref: 'schemaModel'
    },
    tid: {
      type: ObjectID,
      ref: 'stageModel'
    },
    gid: {
      type: ObjectID,
      ref: 'groupModel'
    },
    coworkers: [
      {
        type: ObjectID,
        ref: 'userModel'
      }
    ],
    audits: [
      {
        type: ObjectID,
        ref: 'auditModel'
      }
    ],
    value: Number,
    grantedUser: {
      type: ObjectID,
      ref: 'userModel'
    },
    grantedDate: Number,
    grantedValue: Number,
    gained: Number,
    visibility: Boolean,
    revokeTick: Number,
    tag: {
      type: ObjectID,
      ref: 'tagModel'
    },
    locked: Boolean,
    lockedTick: Number,
    totalBalance: Number,
    intervention: [
      {
        type: ObjectID,
        ref: 'interventionModel'
      }
    ]
  }, { collection: 'reportDB' });
  return mongoose.model('reportModel', reportModel);
}