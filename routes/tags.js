const express = require('express');
const router = express.Router();
const moment = require('moment');
const { ObjectId } = require('mongodb');

module.exports = (io, schemaObj) => {
  io.p2p.on('getTags', async (data) => {
    let tags = await schemaObj.tagModel.find({}).sort({_id: 1}).populate().exec();
    io.p2p.emit('getTags', tags);
  });

  return router;
}
