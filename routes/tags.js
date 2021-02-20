const express = require('express');
const router = express.Router();
const moment = require('moment');
const { ObjectId } = require('mongodb');

module.exports = (io, models) => {
  io.p2p.on('getTags', async (data) => {
    let tags = await models.tagModel.find({}).sort({_id: 1}).populate().exec();
    io.p2p.emit('getTags', tags);
  });

  io.p2p.on('addTag', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      await models.tagModel.create({ 
        tick: moment().unix(),
        name: data,
      });
      let tags = await models.tagModel.find({}).sort({_id: 1}).populate().exec();
      io.p2p.emit('getTags', tags);
    }
  });

  return router;
}
