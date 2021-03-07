const express = require('express');
const router = express.Router();
const moment = require('moment');
const { ObjectId } = require('mongodb');
const _ = require('lodash');
const { forIn } = require('lodash');

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

  io.p2p.on('checkTagUsers', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let tags = _.flatMap(data, (item) => {
        return new ObjectId(item.id);
      });
      let tagCount = await models.userModel.aggregate([
        {
          $match: {
            tags: { $in: tags }
          }
        },
        {
          $group:
          {
            _id: '$tags',
            count: { $sum: 1 }
          }
        }
      ]).exec();
      io.p2p.emit('checkTagUsers', tagCount);
    }
  });

  /*io.p2p.on('getTagUsers', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let users = await models.userModel.find({
        tags: ObjectId(data)
      }).exec();
      io.p2p.emit('getTagUsers', users);
    }
  });*/

  io.p2p.on('getsiteAdminUsers', async (data) => {
    let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
    let authMapping = await require('../middleware/mapping')(models);
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
