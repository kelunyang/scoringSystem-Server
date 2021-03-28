const express = require('express');
const router = express.Router();
const moment = require('moment');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const generator = require('generate-password');
const nodemailer = require("nodemailer");
const validator = require('validator');
const _ = require('lodash');

module.exports = (io, models) => {
  let getUsers = async() => {
    let users = await models.userModel.find({})
    .sort({_id: 1}).exec();
    io.p2p.emit('getUsers', users);
  };

  io.p2p.on('userInbound', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      io.p2p.join('/activeUsers');
      io.p2p.to("/activeUsers").emit('userInbound');
    }
  });

  io.p2p.on('getAuthLevel', async (data) => {
    let table = await require('../middleware/frontendAuth')(models);
    io.p2p.emit('getAuthLevel', table);
  });

  io.p2p.on('getConcurrentUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let socketioRoom = io.p2n.of('/').adapter.rooms.get("/activeUsers");
      if(socketioRoom === undefined || socketioRoom === null || socketioRoom.length === 0) {
        io.p2p.emit('getConcurrentUsers', []);
      } else {
        let activeSockets = Array.from(socketioRoom);
        let activeUsers = await models.activeuserModel.aggregate([
          { $match : { socketio : { $in: activeSockets }}},
          {
            $lookup:
            {
              from: "userDB",
              localField: "user",
              foreignField: "_id",
              as: "user"
            }
          },
          {
            $unwind: {
              path: '$user',
              preserveNullAndEmptyArrays: false
            }
          },
          {
            $group:
            {
              _id: '$user._id',
              name: { $first: '$user.name' },
              types: { $first: '$user.types' },
              unit: { $first: '$user.unit' },
              email: { $first: '$user.email' },
              createDate: { $first: '$user.createDate' },
              where: { $push: '$where' }
            }
          },
          {
            $project: {
              _id: 1,
              name: 1,
              types: 1,
              unit: 1,
              email: 1,
              createDate: 1,
              where: {
                $reverseArray: "$where"
              }
            }
          }
        ]);
        io.p2p.emit('getConcurrentUsers', activeUsers);
      }
    }
  });

  io.p2p.on('createUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let robotSetting = await models.robotModel.findOne({}).sort({_id: 1}).exec();
      let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let passwords = generator.generateMultiple(data.email.length, {
        length: 10
      });
      let count = 0;
      let emailDB = await models.userModel.aggregate([
        {
          $group: {
            _id: null,
            emails: {
              $addToSet: '$email'
            }
          }
        }
      ]);
      let emails = emailDB[0].emails;
      for(let i=0; i<data.email.length; i++) {
        let emailAwaited = data.email[i];
        if(validator.isEmail(emailAwaited)) {
          if(_.find(emails, (email) => {
            return email === emailAwaited;
          }) === undefined) {
            let tags = data.tags.map((tag) => {
              return new ObjectId(tag);
            });
            let currentTick = moment().unix();
            await models.userModel.create({
              tags: tags,
              types: 'human',
              name: '請輸入姓名',
              unit: '請輸入你的服務單位',
              email: emailAwaited,
              createDate: currentTick,
              modDate: currentTick,
              firstRun: true,
              password: bcrypt.hashSync(passwords[i], bcrypt.genSaltSync(10)),
            });
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
                from: '"臺北市學科影片審查系統" <kelunyang@outlook.com>',
                to: data.email[i],
                subject: "臺北市學科影片審查系統：帳號開通通知信",
                text: "您好，您的帳號已經開通，你的帳號就是你收到信的Email，您第一次登入的密碼是：" + passwords[i] + "\n請記得在登入後修改密碼並填入相關資訊，最重要的是，登入後，請務必要綁定您LINE，我們才能通知您喔！\n登入網址：" + setting.siteLocation, // plain text body
                html: "<p>您好，您的帳號已經開通，你的帳號就是你收到信的Email，您的暫時密碼是：" + passwords[i] + "</p><p>請記得在登入後修改密碼並填入相關資訊，最重要的是，登入後，請務必要綁定您LINE，我們才能通知您喔！</p><p>登入網址：<a href='" + setting.siteLocation + "' target='_blank' title='登入網址'>" + setting.siteLocation + "</a></p>", // html body
              });
            } catch(err) {
              console.log(err);
            }
            count++;
          }
        }
      }
      io.p2p.emit('createUsers', {
        planned: data.email.length,
        processed: count
      });
      getUsers();
    }
  });

  io.p2p.on('passwordClientReset', async (data) => {
    let user = await models.userModel.findOne({
      email: data
    }).sort({_id: 1}).exec();
    if(user === undefined || user === null) {
      io.p2p.emit('passwordClientReset', {
        name: undefined
      });
    } else {
      let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let robotSetting = await models.robotModel.findOne({}).sort({_id: 1}).exec();
      let password = generator.generate({
        length: 10
      });
      user.password = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
      user.firstRun = true;
      await user.save();
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
        let info = await transporter.sendMail({
          from: '"臺北市學科影片審查系統" <kelunyang@outlook.com>',
          to: user.email,
          subject: "臺北市學科影片審查系統：帳號密碼重置通知信",
          text: "您好，您的密碼已經被重置了，您的暫時登入密碼是：" + password + "\n請記得在登入後修改密碼！\n登入網址：" + setting.siteLocation, // plain text body
          html: "<p>您好，您的帳號已經被重置了，您的暫時登入密碼是：" + password + "</p><p>請記得在登入後修改密碼！</p><p>登入網址：<a href='" + setting.siteLocation + "' target='_blank' title='登入網址'>" + setting.siteLocation + "</a></p>", // html body
        });
      } catch(err) {
        console.log(err);
      }
      io.p2p.emit('passwordClientReset', {
        name: user.name
      });
    }
  });

  io.p2p.on('passwordReset', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let robotSetting = await models.robotModel.findOne({}).sort({_id: 1}).exec();
      let password = generator.generate({
        length: 10
      });
      let user = await models.userModel.find({
        _id: ObjectId(data)
      }).sort({_id: 1}).exec();
      user.password = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
      user.firstRun = true;
      await user.save();
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
        let info = await transporter.sendMail({
          from: '"臺北市學科影片審查系統" <kelunyang@outlook.com>',
          to: user.email,
          subject: "臺北市學科影片審查系統：帳號密碼重置通知信",
          text: "您好，您的密碼已經被重置了，您的暫時登入密碼是：" + password + "\n請記得在登入後修改密碼！\n登入網址：" + setting.siteLocation, // plain text body
          html: "<p>您好，您的帳號已經被重置了，您的暫時登入密碼是：" + password + "</p><p>請記得在登入後修改密碼！</p><p>登入網址：<a href='" + setting.siteLocation + "' target='_blank' title='登入網址'>" + setting.siteLocation + "</a></p>", // html body
        });
      } catch(err) {
        console.log(err);
      }
      io.p2p.emit('passwordReset', {
        name: user.name
      });
    }
  });

  io.p2p.on('modUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let user = await models.userModel.findOne({
        _id: ObjectId(data._id)
      }).sort({_id: 1}).exec();
      user.unit = data.unit;
      user.modDate = moment().unix();
      let tagdeleteTOBE = user.tags.filter((item) => {
        return _.find(data.tags, (dtag) => {
          return (new ObjectId(dtag)).equals(item);
        }) !== undefined;
      })
      let zeroTag = [];
      let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let tagsAdd = new Set(data.tags);
      for(let i=0; i<tagdeleteTOBE.length; i++) {
        let tag = tagdeleteTOBE[i];
        let users = await models.userModel.find({
          tags: ObjectId(tag)
        }).exec();
        if(users.length === 1) {
          let tagObj = await models.tagModel.find({
            _id: ObjectId(tag)
          }).exec();
          zeroTag.push(tagObj.name);
          if(setting.settingTags.includes(tag) || setting.userTags.includes(tag) || setting.projectTags.includes(tag)) {
            tagsAdd.add(tag);
          }
        }
      }
      user.tags = Array.from(tagsAdd);
      user.name = data.name;
      user.email = data.email;
      user.types = data.types;
      user.firstRun = false;
      await user.save();
      io.p2p.emit('modUsers', {
        name: user.name,
        zeroTag: zeroTag
      });
      getUsers();
    }
  });

  io.p2p.on('getCurrentUser', async (data) => {
    if(io.p2p.request.session.hasOwnProperty('passport')) {
      if(io.p2p.request.session.passport.hasOwnProperty('user')) {
        let user = await models.userModel.findOne({
          _id: ObjectId(io.p2p.request.session.passport.user)
        })
        .populate('tags').sort({_id: 1}).exec();
        io.p2p.emit('getCurrentUser', user);
        return; //直接結束程式
      } else {
        return {
          _id: '',
          tags: [],
          types: 'bottts',
          name: 'undefined',
          unit: 'undefined',
          email: 'undefined@undefined.com',
          createDate: 0,
          modDate: 0,
          lineDate: 0
        }
      }
    }
    io.p2p.emit('getCurrentUser', undefined);
  });

  io.p2p.on('getRobotUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let users = await models.userModel.find({
        tags: setting.robotTag
      }).sort({_id: 1}).exec();
      io.p2p.emit('getRobotUsers', users);
    }
  });

  io.p2p.on('getUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      getUsers();
    }
  });

  io.p2p.on('setCurrentUser', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let user = await models.userModel.findOne({
        _id: ObjectId(io.p2p.request.session.passport.user)
      }).sort({_id: 1}).exec();
      user.name = data.name;
      user.types = data.types;
      user.unit = data.unit;
      user.firstRun = false;
      user.modDate = moment().unix();
      user.password = bcrypt.hashSync(data.password, bcrypt.genSaltSync(10));
      await user.save();
      io.p2p.emit('setCurrentUser', {
        modify: moment().unix()
      });
      io.p2p.emit('getCurrentUser', user);
    }
  });

  io.p2p.on('modUserTags', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let count = 0;
      let zeroTag = [];
      for(let i=0; i<data.users.length; i++) {
        let userID = data.users[i]._id;
        let user = await models.userModel.findOne({
          _id: ObjectId(userID)
        }).sort({_id: 1}).exec();
        if(data.type == 1) {
          user.tags = _.uniqWith(_.flatten([user.tags, _.map(data.tags, (item) => {
            return new ObjectId(item);
          })]), (a, b) => {
            return a.equals(b);
          });
        } else {
          let tagdeleteTOBE = user.tags.filter((item) => {
            return _.find(data.tags, (dtag) => {
              return (new ObjectId(dtag)).equals(item);
            }) !== undefined;
          })
          let tagsAdd = new Set(data.tags);
          let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
          for(let i=0; i<tagdeleteTOBE.length; i++) {
            let tag = tagdeleteTOBE[i];
            let users = await models.userModel.find({
              tags: ObjectId(tag)
            }).exec();
            if(users.length === 1) {
              let tagObj = await models.tagModel.find({
                _id: ObjectId(tag)
              }).exec();
              zeroTag.push(tagObj.name);
              if(setting.settingTags.includes(tag) || setting.userTags.includes(tag) || setting.projectTags.includes(tag)) {
                tagsAdd.add(tag);
              }
            }
          }
          user.tags = Array.from(tagsAdd);
        }
        user.modDate = moment().unix();
        await user.save();
        count++;
      }
      io.p2p.emit('modUserTags', {
        planned: data.users.length,
        processed: count,
        tags: data.tags.length,
        zeroTag: zeroTag
      });
      getUsers();
    }
  });

  io.p2p.on('checkEmail', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let users = await models.userModel.find({
        email: data
      }).sort({_id: 1}).exec();
      io.p2p.emit('checkEmail', {
        email: data,
        count: users.length
      });
    }
  });

  io.p2p.on('setEmail', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let users = await models.userModel.find({
        email: data.email
      }).exec();
      if(users.length === 0) {
        let user = await models.userModel.find({
          _id: new ObjectId(data.id)
        }).sort({_id: 1}).exec();
        user.email = data.email;
        await user.save();
        io.p2p.emit('setEmail', true);
      } else {
        io.p2p.emit('setEmail', false);
      }
    }
  });

  io.p2p.on('removeUser', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let count = 0;
      let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      for(let i=0; i<data.length; i++) {
        let user = data[i];
        let userObj = await models.userModel.findOne({
          _id: new ObjectId(user._id)
        }).exec();
        if(userObj != undefined) {
          let proceed = true;
          for(let k=0; k<userObj.tags.length; k++) {
            let tag = userObj.tags[k];
            let userinTag = await models.userModel.find({
              tags: ObjectId(tag)
            }).exec();
            if(userinTag.length <= 1) {
              if(setting.settingTags.includes(tag) || setting.userTags.includes(tag) || setting.projectTags.includes(tag)) {
                proceed = false;
              }
            }
          }
          if(proceed) {
            await models.userModel.deleteOne({
              _id: new ObjectId(user._id)
            }).exec();
            count++;
          }
        }
      }
      io.p2p.emit('removeUser', {
        planned: data.length,
        processed: count
      });
      getUsers();
    }
  });

  return router;
}
