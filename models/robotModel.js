import { ObjectID } from 'mongodb';

export default function (mongoose) {
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
        patrolTimes: Number,
        backupLocation: String,
        backupCopies: Number,
        dbbackupLocation: String,
        backupDuration: Number,
        dbbackupDuration: Number,
        dbbackupCopies: Number,
        tick: Number,
        converisionLocation: String,
        backupHour: Number,
        notifyHour: Number,
        converisionDropzoneA: String,
        converisionDropzoneB: String,
        originalVideos: String,
        converisionFailTag: [
            {
                type: ObjectID,
                ref: "tagModel"
            }
        ],
        converisionHeight: Number,
        converisionWidth: Number,
        converisionAudio: Boolean,
        converisionDuration: Number,
        converisionDurationLimit: [
            Number
        ],
        enableConverision: Boolean,
        failedRecheck: Boolean,
        parallelRAM: Number,
        vmStatus: {
            ffmpegStatus: Boolean,
            ramStatus: Number,
            reportTick: Number,
            cpuStatus: Number,
            totalStorage: Number,
            totalRAM: Number,
            storageStatus: Number
        }
    }, { collection: 'robotSettings' });
    return mongoose.model('robotModel', robotSchema);
}