const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let logSchema = new schema({
        tick: Number,
        name: {
            type: ObjectID,
            ref: "userModel"
        },
        where: String,
        action: String
    }, { collection: 'logDB' });
    return mongoose.model('logModel', logSchema);
}