var express = require('express');
var router = express.Router();

module.exports = (io, schemaObj) => {
  
  /*await settingModel.create({ 
    settingTags: [],
    userTags: [],
    projectTags: [],
    tick: 1611124281
  });*/
  io.p2p.on('getMessages', async (data) => {
    var collection = await schemaObj.messageModel.findOne({}).populate({
      path: 'user',
      populate: { path: 'tags' }
    }).exec();
    io.p2p.emit('getMessages', collection);
  });
  return router;
}
