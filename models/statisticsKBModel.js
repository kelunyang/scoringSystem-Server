import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let statisticsSchema = new schema({
      createDate: Number,
      logTick: Number,
      KB: {
        type: ObjectID,
        ref: 'KBModel'
      },
      sourceTag: {
          type: ObjectID,
          ref: "tagModel"
      },
      typeTags: [
          {
              type: ObjectID,
              ref: "tagModel"
          }
      ],
      value: Number
  }, { collection: 'statisticsDB' });
  return mongoose.model('statisticsModel', statisticsSchema);
}