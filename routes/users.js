const express = require('express');
const router = express.Router();
const moment = require('moment');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

module.exports = (io, models) => {
  io.p2p.on('createUser', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    let action = authMapping['createUser'];
    var collection = await models.userModel.create({ 
      tags: [
        ObjectId("60122af48c16c246be4b9ded")
      ],
      types: 'bottts',
      name: data.name,
      unit: '機器人集群',
      email: 'kelunyang@outlook.com',
      createDate: moment().unix(),
      password: bcrypt.hashSync(data.password, bcrypt.genSaltSync(10)),
    });
    await models.logModel.create({ 
      tick: moment().unix(),
      name: io.p2p.request.session.passport.user,
      where: action.where,
      action: action.action + '帳號：' + data.name + '(' + collection._id + ')'
    });
    io.p2p.emit('createUser', collection);
  });

  io.p2p.on('getCurrentUser', async (data) => {
    if(io.p2p.request.session.hasOwnProperty('passport')) {
      if(io.p2p.request.session.passport.hasOwnProperty('user')) {
        let user = await models.userModel.findOne({
          _id: ObjectId(io.p2p.request.session.passport.user)
        }).sort({_id: 1}).exec();
        io.p2p.emit('getCurrentUser', user);
        return;
      }
    }
    io.p2p.emit('getCurrentUser', undefined);
  });

  io.p2p.on('setCurrentUser', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    let action = authMapping['setCurrentUser'];
    let user = await models.userModel.findOne({
      _id: ObjectId(io.p2p.request.session.passport.user)
    }).sort({_id: 1}).exec();
    user.name = data.name;
    user.types = data.types;
    user.unit = data.unit;
    user.email = data.email;
    user.modDate = moment().unix();
    if(data.password === '') {
      user.password = bcrypt.hashSync(data.password, bcrypt.genSaltSync(10));
    }
    await user.save();
    await models.logModel.create({ 
      tick: moment().unix(),
      name: io.p2p.request.session.passport.user,
      where: action.where,
      action: action.action + '帳號：' + data.name + '(' + user._id + ')'
    });
    io.p2p.emit('setCurrentUser', {
      modify: moment().unix()
    });
    io.p2p.emit('getCurrentUser', user);
  });

  io.p2p.on('getUsers', async (data) => {
    if(io.p2p.request.session.hasOwnProperty('passport')) {
      if(io.p2p.request.session.passport.hasOwnProperty('user')) {
        let setting = await models.settingModel.findOne({
          _id: ObjectId(io.p2p.request.session.passport.user)
        }).sort({_id: 1}).exec();
        let users = await models.userModel.find({
          tags: setting.robotTag
        }).sort({_id: 1}).exec();
        io.p2p.emit('getUsers', users);
        return;
      }
    }
    io.p2p.emit('getUsers', undefined);
  });
  return router;
}
