const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let robotSchema = new schema({
        mailAccount: String,
        mailPassword: String,
        robotDeadLine: Number,
        reportDuration: Number,
        tick: Number
    }, { collection: 'robotSettings' });
    return mongoose.model('robotModel', robotSchema);
}