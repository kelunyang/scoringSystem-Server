const express = require('express');
const router = express.Router();
const moment = require('moment');
const { ObjectId } = require('mongodb');
const fs = require('fs-extra');

module.exports = (io, models) => {
  io.p2p.on('getLINElog', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    let auth = authMapping['getLINElog'];
    if(io.p2p.request.session.status.type === 3) {
      let lineDB = await models.lineModel.find({}).sort({_id: 1}).populate({
        path: 'log',
        populate: { path: 'uid' }
      }).exec();
      io.p2p.emit('getLINElog', lineDB);
    } else {
      io.p2p.emit('accessViolation', {
        where: auth.where,
        action: auth.action,
        tick: moment().unix(),
        loginRequire: auth.loginRequire
      });
    }
  });

  io.p2p.on('sendLINEnotify', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    let auth = authMapping['sendLINEnotify'];
    if(io.p2p.request.session.status.type === 3) {
      let users = await models.userModel.find({}).sort({_id: 1}).exec();
      let successArray = new Array();
      let success = 0;
      let failed = 0;
      for(let i=0; i< users.length; i++) {
        let user = users[i];
        if(user.lineToken !== undefined) {
          try {
            let sendmsg = await axios.post('https://notify-api.line.me/api/notify', qs.stringify({
              message: data.body
            }), {
              headers: {
                Authorization: 'Bearer ' + user.lineToken
              },
              withCredentials: true
            });
            if(sendmsg.data.status === 200) {
              successArray.push({
                name: user.name,
                uid: user._id,
                tick: moment().unix(),
                status: 1
              });
              success++;
            } else {
              successArray.push({
                name: user.name,
                uid: user._id,
                tick: moment().unix(),
                status: 2
              });
              failed++;
            }
          } catch(e) {
            successArray.push({
              uid: user._id,
              tick: moment().unix(),
              status: 0
            });
            failed++;
          }
        }
      }
      await models.lineModel.create({ 
        tick: moment().unix(),
        body: data.body,
        log: successArray
      });
      io.p2p.emit('sendLINEnotify', {
        success: success,
        failed: failed
      });
    } else {
      io.p2p.emit('accessViolation', {
        where: auth.where,
        action: auth.action,
        tick: moment().unix(),
        loginRequire: auth.loginRequire
      });
    }
  });

  io.p2p.on('sendBroadcast', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      io.p2n.emit('messageBroadcast', {
        title: data.title,
        body: data.body
      });
      await models.broadcastModel.create({ 
        tick: moment().unix(),
        title: data.title,
        body: data.body,
        sender: io.p2p.request.session.passport.user,
        recievers: []
      });
      io.p2p.emit('sendBroadcast', true);
    }
  });

  io.p2p.on('getbroadcastLog', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.broadcastModel.find({}).sort({tick: -1})
      .populate('recievers')
      .populate('sender').exec();
      io.p2p.emit('getbroadcastLog', collection);
    }
  });

  io.p2p.on('getMessage', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.messageModel.findOne({
        _id: data
      })
      .populate('attachments')
      .populate({
        path: 'user',
        populate: { path: 'tags' }
      }).exec();
      io.p2p.emit('getMessage', collection);
    }
  });

  io.p2p.on('getMessages', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.messageModel.find({}).sort({tick: -1})
      .populate('attachments')
      .populate({
        path: 'user',
        populate: { path: 'tags' }
      }).exec();
      io.p2p.emit('getMessages', collection);
    }
  });

  io.p2p.on('getIndexMessages', async (data) => {
    var normalMsg = await models.messageModel.findOne({
      type: 0,
      status: true
    }).sort({tick: -1})
    .populate('attachments')
    .populate({
      path: 'user',
      populate: { path: 'tags' }
    }).exec();
    var maintainMsg = await models.messageModel.findOne({
      type: 1,
      status: true
    }).sort({tick: -1})
    .populate('attachments')
    .populate({
      path: 'user',
      populate: { path: 'tags' }
    }).exec();
    var criticalMsg = await models.messageModel.findOne({
      type: 2,
      status: true
    }).sort({tick: -1})
    .populate('attachments')
    .populate({
      path: 'user',
      populate: { path: 'tags' }
    }).exec();
    let returnArr = [];
    if(normalMsg !== null) { returnArr.push(normalMsg); }
    if(maintainMsg !== null) { returnArr.push(maintainMsg); }
    if(criticalMsg !== null) { returnArr.push(criticalMsg); }
    io.p2p.emit('getIndexMessages', returnArr);
  });

  io.p2p.on('getAttachment', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.messageModel.findOne({
        _id: data
      })
      .populate('attachments')
      .populate({
        path: 'user',
        populate: { path: 'tags' }
      }).exec();
      io.p2p.emit('getAttachment', collection.attachments);
    }
  });

  io.p2p.on('saveMessage', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var message = await models.messageModel.findOne({
        _id: data._id
      }).exec();
      message.title = data.title;
      message.type = data.type;
      message.body = data.body;
      message.status = data.status;
      message.tick = moment().unix();
      await message.save();
      var collection = await models.messageModel.find({}).sort({tick: -1})
      .populate('attachments')
      .populate({
        path: 'user',
        populate: { path: 'tags' }
      }).exec();
      io.p2p.emit('getMessages', collection);
      io.p2p.emit('saveMessage', true);
    }
  });

  io.p2p.on('removeMessage', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var message = await models.messageModel.findOne({
        _id: data
      }).exec();
      let errorlog = 0;
      for(let i=0;i<message.attachments.length;i++) {
        try {
          let file = message.attachments[i].toString();
          await fs.remove('/var/www/frontend/storages/' + file);
          fileObj = await models.fileModel.deleteOne({
            _id: file
          }).exec();
        } catch (err) {
          errorlog++;
        }
      }
      if(errorlog === 0) {
        var message = await models.messageModel.deleteOne({
          _id: data
        }).exec();
        io.p2p.emit('removeMessage', true);
        var collection = await models.messageModel.find({}).sort({tick: -1})
        .populate('attachments')
        .populate({
          path: 'user',
          populate: { path: 'tags' }
        }).exec();
        io.p2p.emit('getMessages', collection);
      } else {
        io.p2p.emit('removeMessageError', errorlog);
      }
    }
  });

  io.p2p.on('addMsg', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var msg = await models.messageModel.create({ 
        tick: moment().unix(),
        attachments: [],
        user: io.p2p.request.session.passport.user
      });
      io.p2p.emit('addMsg', msg._id);
    }
  });

  return router;
}
