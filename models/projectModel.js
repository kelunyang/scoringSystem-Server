import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let projectSchema = new schema({
      knowledgeEdit: {
          tag: [{
            type: ObjectID,
            ref: "tagModel"
          }],
          deadline: Number
        },
        scriptEdit: {
          tag: [{
            type: ObjectID,
            ref: "tagModel"
          }],
          deadline: Number
        },
        videoEdit: {
          tag: [{
            type: ObjectID,
            ref: "tagModel"
          }],
          deadline: Number
        },
        finialApprove: {
          tag: [{
            type: ObjectID,
            ref: "tagModel"
          }],
          deadline: Number
        },
        tick: Number
  }, { collection: 'projectSettings' });
  return mongoose.model('projectModel', projectSchema);
}