const express = require('express');
const router = express.Router();
const moment = require('moment');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

module.exports = (io, schemaObj) => {
  io.p2p.on('createUser', async (data) => {
    var collection = await schemaObj.userModel.create({ 
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
    io.p2p.emit('createUser', collection);
  });

  io.p2p.on('checkLogin', async (data) => {
    console.log('socketio1:' + io.p2p.request.session.passport);
    io.p2p.request.session.reload(() => {
      console.log('socketio2:' + io.p2p.request.session.passport);
      io.p2p.emit('checkLogin', io.p2p.request.session.passport);
    });
  });
  return router;
}
