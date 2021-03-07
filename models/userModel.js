const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let userSchema = new schema({
        tags: [{
            type: ObjectID,
            ref: "tagModel"
        }],
        types: String,
        name: String,
        unit: String,
        email: String,
        createDate: Number,
        modDate: Number,
        lineCode: String,
        lineDate: Number,
        lineToken: String,
        password: String,
        firstRun: Boolean
    }, { collection: 'userDB' });
    return mongoose.model('userModel', userSchema);
}