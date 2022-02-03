import { ObjectID } from 'mongodb';

export default function (mongoose) {
  let schema = mongoose.Schema;
  let fileSchema = new schema({
    type: String,
    name: String,
    size: Number,
    tick: Number,
    status: Number,
    writeConfirm: Boolean,
    comment: String,
    fileInfo: {
      videoCodec: String,
      width: Number,
      height: Number,
      duration: Number,
      hasAudio: Boolean,
      formatCheck: Boolean,
      checkTick: Number,
      converisionDate: Number,
      converisionDuration: Number,
      queueDate: Number
    }
  }, { collection: 'fileDB' });
  return mongoose.model('fileModel', fileSchema);
}