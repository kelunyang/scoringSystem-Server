const { ObjectID } = require("mongodb");

module.exports = function (mongoose) {
    let schema = mongoose.Schema;
    let tagSchema = new schema({
        name: String,
        tick: Number
    }, { collection: 'tagDB' });
    return mongoose.model('tagModel', tagSchema);
}