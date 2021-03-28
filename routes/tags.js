const express = require('express');
const router = express.Router();
const moment = require('moment');
const { ObjectId } = require('mongodb');
const _ = require('lodash');
const { forIn } = require('lodash');

module.exports = (io, models) => {
  io.p2p.on('getTags', async (data) => {
    let tags = await models.tagModel.find({}).sort({_id: 1}).exec();
    io.p2p.emit('getTags', tags);
  });

  io.p2p.on('addTag', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      await models.tagModel.create({ 
        tick: moment().unix(),
        name: data,
      });
      let tags = await models.tagModel.find({}).sort({_id: 1}).exec();
      io.p2p.emit('getTags', tags);
    }
  });

  io.p2p.on('checkTagUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let tags = _.map(data, (item) => {
        return new ObjectId(item);
      });
      let tagCount = await models.userModel.aggregate([
        {
          $match: {
            tags: { $in: tags }
          }
        },
        {
          $group: {
            _id: '$tags',
            count: { $addToSet: '$_id' }
          }
        },
        {
          $unwind: {
            path: '$_id',
            preserveNullAndEmptyArrays: false
          }
        }
      ]).exec();
      io.p2p.emit('checkTagUsers', tagCount);
    }
  });

  io.p2p.on('getsiteAdminUsers', async (data) => {
    let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
    if(io.p2p.request.session.status.type === 3) {
      let adminUsers = [];
      for(let t = 0; t < data.length; t++) {
        let queryTag = data[t];
        for(let i = 0; i < setting[queryTag].length; i++) {
          let tag = (setting[queryTag])[i];
          let users = await models.userModel.find({
            tags: tag
          }).exec();
          for(let k = 0; k < users.length; k++) {
            let user = users[k];
            adminUsers.push(user);
          }
        }
      }
      io.p2p.emit('getsiteAdminUsers', adminUsers);
    }
  });

  return router;
}
