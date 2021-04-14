const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let robotSchema = new schema({
        mailAccount: String,
        mailPassword: String,
        mailSMTP: String,
        mailPort: Number,
        mailSSL: Boolean,
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
        LastDBbackup: Number,
        LastBackup: Number,
        backupLocation: String,
        dbbackupLocation: String,
        backupDuration: Number,
        dbbackupDuration: Number,
        dbbackupCopies: Number,
        tick: Number
    }, { collection: 'robotSettings' });
    return mongoose.model('robotModel', robotSchema);
}