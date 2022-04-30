import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';
import fs from 'fs-extra';
import axios from 'axios';
import qs from 'qs';
import _ from 'lodash';
import nodemailer from "nodemailer";
import { marked } from 'marked';

export default function (io, models) {
  
  let getNtemplates = async() => {
    let templates = await models.notifytemplateModel.find()
                    .populate('editor', '-password -lineToken -lineCode')
                    .populate('creator', '-password -lineToken -lineCode').exec();
    io.p2p.emit('listNTemplate', templates);
  };

  io.p2p.on('incommingChat', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let userId = new ObjectId(io.p2p.request.session.passport.user);
      let receiverId = new ObjectId(data.receiver);
      if(!userId.equals(receiverId)) {
        let now = dayjs().unix();
        let user = await models.userModel.findOne({
          _id: userId
        }).exec();
        let receiver = await models.userModel.findOne({
          _id: receiverId
        }).exec();
        let receiveSockets = await models.activeuserModel.find({
          user: receiverId
        }).exec();
        io.p2p.emit('ccChat', {
          from: user,
          to: receiver,
          tick: now,
          body: data.body
        });
        for(let i = 0; i < receiveSockets.length; i++) {
          let connection = receiveSockets[i];
          io.p2n.to(connection.socketio).emit('incommingChat', {
            from: user,
            to: receiver,
            tick: now,
            body: data.body
          });
        }
      }
    }
    return;
  });

  io.p2p.on('getLINElog', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let lineDB = await models.lineModel.find({}).sort({tick: -1}).populate({
        path: 'log',
        populate: { 
          path: 'uid',
          select: '-password -lineToken -lineCode' }
        }).exec();
      io.p2p.emit('getLINElog', lineDB);
    }
    return;
  });

  io.p2p.on('sendLINEnotify', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          if(data.body !== "") {
            let robotSetting = await models.robotModel.findOne({}).exec();
            let setting = await models.settingModel.findOne({}).exec();
            let users = [];
            if(data.type === 0) { 
              users = await models.userModel.find({
                tags: {
                  $nin: [setting.robotTag]
                }
              }).exec();
            }
            if(data.type === 1) {
              let userObj = await models.userModel.findOne({
                _id: new ObjectId(io.p2p.request.session.passport.user)
              }).exec();
              data.body += userObj !== null ? "[來自" + userObj.name + "(" + userObj.email + ")" + "，發送者和管理員們都會得到一份抄本]" : "";
              users = await models.userModel.find({
                tags: {
                  $in: setting.settingTags
                }
              }).exec();
              users = _.unionWith([userObj], users, (uo, us) => {
                return uo._id.equals(us._id);
              });
            }
            let successArray = new Array();
            let success = 0;
            let failed = 0;
            for(let i=0; i< users.length; i++) {
              let user = users[i];
              let useLINE = data.useLINE;
              if(!('lineToken' in user) || user.lineToken !== undefined) {
                useLINE = useLINE ? data.useLINE : false;
              } else {
                useLINE = false;
              }
              if(useLINE) {
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
                      tick: dayjs().unix(),
                      status: 1
                    });
                    success++;
                  } else {
                    successArray.push({
                      name: user.name,
                      uid: user._id,
                      tick: dayjs().unix(),
                      status: 2
                    });
                    failed++;
                  }
                } catch(e) {
                  successArray.push({
                    uid: user._id,
                    tick: dayjs().unix(),
                    status: 0
                  });
                  failed++;
                }
              } else {
                let transporter = nodemailer.createTransport({
                  host: robotSetting.mailSMTP,
                  port: robotSetting.mailPort,
                  secure: robotSetting.mailSSL,
                  auth: {
                    user: robotSetting.mailAccount,
                    pass: robotSetting.mailPassword,
                  },
                });
                try {
                  await transporter.sendMail({
                    from: '"' + setting.systemName + '" <' + robotSetting.mailAccount + '>',
                    to: user.email,
                    subject: setting.systemName + "：訊息通知",
                    text: data.body, // plain text body
                    html: marked(data.body), // html body
                  });
                  successArray.push({
                    name: user.name,
                    uid: user._id,
                    tick: dayjs().unix(),
                    status: 1
                  });
                  success++;
                } catch(err) {
                  successArray.push({
                    uid: user._id,
                    tick: dayjs().unix(),
                    status: 0
                  });
                  failed++;
                }
              }
            }
            await models.lineModel.create({ 
              tick: dayjs().unix(),
              body: data.body,
              log: successArray,
              type: 0
            });
            io.p2p.emit('sendLINEnotify', {
              success: success,
              failed: failed
            });
          }
        }
      }
    }
    return;
  });

  io.p2p.on('sendBroadcast', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      io.p2n.in("/activeUsers").emit('messageBroadcast', {
        title: data.title,
        body: data.body
      });
      await models.broadcastModel.create({ 
        tick: dayjs().unix(),
        title: data.title,
        body: data.body,
        sender: io.p2p.request.session.passport.user,
        recievers: []
      });
      io.p2p.emit('sendBroadcast', true);
    }
    return;
  });

  io.p2p.on('getbroadcastLog', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.broadcastModel.find({}).sort({tick: -1})
      .populate('recievers', '-password -lineToken -lineCode')
      .populate('sender', '-password -lineToken -lineCode').exec();
      io.p2p.emit('getbroadcastLog', collection);
    }
    return;
  });

  io.p2p.on('getMessage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.messageModel.findOne({
        _id: data
      })
      .populate('attachments')
      .populate({
        path: 'user',
        select: '-password -lineToken -lineCode',
        populate: { path: 'tags' }
      }).exec();
      io.p2p.emit('getMessage', collection);
    }
    return;
  });

  io.p2p.on('getMessages', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.messageModel.find({}).sort({tick: -1})
      .populate('attachments')
      .populate({
        path: 'user',
        select: '-password -lineToken -lineCode',
        populate: { path: 'tags' }
      }).sort({
        tick: -1
      }).exec();
      io.p2p.emit('getMessages', collection);
    }
    return;
  });

  io.p2p.on('getIndexMessages', async (data) => {
    var normalMsg = await models.messageModel.findOne({
      type: 0,
      status: true
    }).sort({tick: -1})
    .populate('attachments')
    .populate({
      path: 'user',
      select: '-password -lineToken -lineCode',
      populate: { path: 'tags' }
    }).exec();
    var maintainMsg = await models.messageModel.findOne({
      type: 1,
      status: true
    }).sort({tick: -1})
    .populate('attachments')
    .populate({
      path: 'user',
      select: '-password -lineToken -lineCode',
      populate: { path: 'tags' }
    }).exec();
    var criticalMsg = await models.messageModel.findOne({
      type: 2,
      status: true
    }).sort({tick: -1})
    .populate('attachments')
    .populate({
      path: 'user',
      select: '-password -lineToken -lineCode',
      populate: { path: 'tags' }
    }).exec();
    let returnArr = [];
    if(normalMsg !== null) { returnArr.push(normalMsg); }
    if(maintainMsg !== null) { returnArr.push(maintainMsg); }
    if(criticalMsg !== null) { returnArr.push(criticalMsg); }
    io.p2p.emit('getIndexMessages', returnArr);
  });

  io.p2p.on('getmsgAttachment', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.messageModel.findOne({
        _id: data
      })
      .populate('attachments').exec();
      io.p2p.emit('getmsgAttachment', collection.attachments);
    }
  });

  io.p2p.on('saveMessage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var message = await models.messageModel.findOne({
        _id: data._id
      }).exec();
      message.title = data.title;
      message.type = data.type;
      message.body = data.body;
      message.status = data.status;
      message.tick = dayjs().unix();
      await message.save();
      var collection = await models.messageModel.find({}).sort({tick: -1})
      .populate('attachments')
      .populate({
        path: 'user',
        select: '-password -lineToken -lineCode',
        populate: { path: 'tags' }
      }).sort({
        tick: -1
      }).exec();
      io.p2p.emit('getMessages', collection);
      io.p2p.emit('saveMessage', true);
    }
  });

  io.p2p.on('removeMessage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      var message = await models.messageModel.findOne({
        _id: new ObjectId(data)
      }).exec();
      let errorlog = 0;
      for(let i=0;i<message.attachments.length;i++) {
        try {
          let file = message.attachments[i];
          let exist = await fs.access(globalSetting.storageLocation + '/' + file);
          if(exist) { await fs.remove(globalSetting.storageLocation + '/' + file); }
          fileObj = await models.fileModel.deleteOne({
            _id: new ObjectId(file)
          }).exec();
        } catch (err) {
          errorlog++;
        }
      }
      if(errorlog === 0) {
        var message = await models.messageModel.deleteOne({
          _id: new ObjectId(data)
        }).exec();
        io.p2p.emit('removeMessage', true);
        var collection = await models.messageModel.find({}).sort({tick: -1})
        .populate('attachments')
        .populate({
          path: 'user',
          select: '-password -lineToken -lineCode',
          populate: { path: 'tags' }
        }).sort({
          tick: -1
        }).exec();
        io.p2p.emit('getMessages', collection);
      } else {
        io.p2p.emit('removeMessageError', errorlog);
      }
    }
  });

  io.p2p.on('addMsg', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var msg = await models.messageModel.create({ 
        tick: dayjs().unix(),
        attachments: [],
        user: io.p2p.request.session.passport.user
      });
      io.p2p.emit('addMsg', msg._id);
    }
  });

  io.p2p.on('addNTemplate', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let now = dayjs().unix();
      let user = new ObjectId(io.p2p.request.session.passport.user);
      var template = await models.notifytemplateModel.create({ 
        createTick: now,
        modTick: now,
        title: '',
        body: '',
        sendTick: 0,
        group: [],
        creator: user,
        editor: user,
        setTick: 0,
        durationDay: 1,
        status: false
      });
      io.p2p.emit('addNTemplate', template._id);
      await getNtemplates();
    }
  });

  io.p2p.on('modNTemplate', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let now = dayjs().unix();
      let group = _.map(data.group, (item) => {
        return new ObjectId(item);
      });
      let user = new ObjectId(io.p2p.request.session.passport.user);
      var template = await models.notifytemplateModel.findOne({
                        _id: new ObjectId(data._id)
                      }).exec();
      if(template !== null) {
        template.modTick = now;
        template.title = data.title;
        template.body =  data.body;
        template.group = group;
        template.editor = user;
        template.status = data.status;
        template.durationDay = data.durationDay;
        template.setTick = data.setTick;
        await template.save();
      };
      io.p2p.emit('modNTemplate', template._id);
      await getNtemplates();
    }
  });

  io.p2p.on('removeNTemplate', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var template = await models.notifytemplateModel.deleteOne({
          _id: new ObjectId(data)
        }).exec();
      io.p2p.emit('removeNTemplate');
      await getNtemplates();
    }
  });

  io.p2p.on('listNTemplate', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      await getNtemplates();
    }
  });

  return router;
}
