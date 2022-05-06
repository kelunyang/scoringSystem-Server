import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let auditModel = new schema({
    content: String,
    tick: Number,
    gained: Number,
    confirm: Number,
    gid: {
      type: ObjectID,
      ref: 'groupModel'
    },
    intervention: [
      {
        type: ObjectID,
        ref: 'interventionModel'
      }
    ],
    coworkers: [
      {
        type: ObjectID,
        ref: 'userModel'
      }
    ],
    rid: {
      type: ObjectID,
      ref: 'reportModel'
    },
    sid: {
      type: ObjectID,
      ref: 'schemaModel'
    },
    tid: {
      type: ObjectID,
      ref: 'stageModel'
    },
    value: Number,
    feedback: Number,
    feedbackTick: Number,
    feedbackUser: {
      type: ObjectID,
      ref: 'userModel'
    },
    short: Boolean,
    totalBalance: Number,
    visibility: Boolean,
    revokeTick: Number
  }, { collection: 'auditDB' });
  return mongoose.model('auditModel', auditModel);
}