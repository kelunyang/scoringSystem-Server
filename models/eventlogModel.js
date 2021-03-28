const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let eventlogSchema = new schema({
        tick: Number,
        desc: String,
        type: String,
        KB: {
            type: ObjectID,
            ref: 'KBModel'
        },
        user: {
            type: ObjectID,
            ref: "userModel"
        }
    }, { collection: 'eventlogDB' });
    return mongoose.model('eventlogModel', eventlogSchema);
}