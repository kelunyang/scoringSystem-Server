const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let systemmessageSchema = new schema({
        type: Number,
        tick: Number,
        title: String,
        body: String,
        status: Boolean,
        user: {
            type: ObjectID,
            ref: "userModel"
        }
    }, { collection: 'systemMessages' });
    return mongoose.model('systemmessageModel', systemmessageSchema);
}