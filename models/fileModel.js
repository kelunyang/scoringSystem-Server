const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let fileSchema = new schema({
        type: String,
        name: String,
        size: Number,
        tick: Number,
        status: Number,
        writeConfirm: Boolean,
        comment: String
    }, { collection: 'fileDB' });
    return mongoose.model('fileModel', fileSchema);
}