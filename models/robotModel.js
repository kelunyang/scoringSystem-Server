const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let robotSchema = new schema({
        mailAccount: String,
        mailPassword: String,
        nobodyAccount: {
            type: ObjectID,
            ref: "userModel"
        },
        PatrolAccount: {
            type: ObjectID,
            ref: "userModel"
        },
        LINENotifyKey: String,
        LINESecretKey: String,
        robotDeadLine: Number,
        reportDuration: Number,
        patrolHour: Number,
        LastPatrol: Number,
        tick: Number
    }, { collection: 'robotSettings' });
    return mongoose.model('robotModel', robotSchema);
}