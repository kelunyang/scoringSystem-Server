const express = require('express');
const router = express.Router();
const moment = require('moment');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const generator = require('generate-password');
const nodemailer = require("nodemailer");
const validator = require('validator');

module.exports = (io, models) => {
  io.p2p.on('getAuthLevel', async (data) => {
    let table = await require('../middleware/frontendAuth')(models);
    io.p2p.emit('getAuthLevel', table);
  });

  io.p2p.on('getConcurrentUsers', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let activeUsers = await models.activeuserModel.aggregate([
        {
          $group:
          {
            _id: '$user',
            where: { $push: '$where' }
          }
        },
        {
          $lookup:
          {
            from: "userDB",
            localField: "_id",
            foreignField: "_id",
            as: "_id"
          }
        },
        {
          $project: {
            '_id': {
              password: 0,
              lineCode: 0,
              lineToken: 0,
              lineDate:0
            }
          }
        }
      ]).exec();
      io.p2p.emit('getConcurrentUsers', activeUsers);
    }
  });

  io.p2p.on('createUsers', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let emailValid = 0;
      let count = 0;
      for(let i=0; i<data.email.length; i++) {
        emailValid += !validator.isEmail(data.email[i]) ? 1 : 0;
      }
      if(emailValid === 0) {
        let robotSetting = await models.robotModel.findOne({}).sort({_id: 1}).exec();
        let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
        let passwords = generator.generateMultiple(data.email.length, {
          length: 10
        });
        let tags = data.tags.map((tag) => {
          return new ObjectId(tag);
        });
        for(let i=0; i<data.email.length; i++) {
          let currentTick = moment().unix();
          var collection = await models.userModel.create({ 
            tags: tags,
            types: 'human',
            name: '請輸入姓名',
            unit: '請輸入你的服務單位',
            email: data.email[i],
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
            let info = await transporter.sendMail({
              from: '"臺北市學科影片審查平台" <kelunyang@outlook.com>',
              to: data.email[i],
              subject: "臺北市學科影片審查平台：帳號開通通知信",
              text: "您好，您的帳號已經開通，您第一次登入的密碼是：" + passwords[i] + "\n請記得在登入後修改密碼並填入相關資訊，最重要的是，登入後，請務必要綁定您LINE，我們才能通知您喔！\n登入網址：" + setting.siteLocation, // plain text body
              html: "<p>您好，您的帳號已經開通，您的暫時密碼是：" + passwords[i] + "</p><p>請記得在登入後修改密碼並填入相關資訊，最重要的是，登入後，請務必要綁定您LINE，我們才能通知您喔！</p><p>登入網址：<a href='" + setting.siteLocation + "' target='_blank' title='登入網址'>" + setting.siteLocation + "</a></p>", // html body
            });
          } catch(err) {
            console.log(err);
          }
          count++;
        }
      }
      io.p2p.emit('createUsers', {
        planned: data.email.length,
        processed: count
      });
    }
  });

  io.p2p.on('passwordClientReset', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    let user = await models.userModel.findOne({
      email: data
    }).sort({_id: 1}).exec();
    if(user === undefined) {
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
          from: '"臺北市學科影片審查平台" <kelunyang@outlook.com>',
          to: user.email,
          subject: "臺北市學科影片審查平台：帳號密碼重置通知信",
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
    let authMapping = await require('../middleware/mapping')(models);
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
          from: '"臺北市學科影片審查平台" <kelunyang@outlook.com>',
          to: user.email,
          subject: "臺北市學科影片審查平台：帳號密碼重置通知信",
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
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let user = await models.userModel.findOne({
        _id: ObjectId(data._id)
      }).sort({_id: 1}).exec();
      user.unit = data.unit;
      user.modDate = moment().unix();
      let tagdeleteTOBE = user.tags.filter((item) => {
        return !data.tags.some((dtag) => {
          return (new ObjectId(dtag)).equals(item);
        })
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
      let users = await models.userModel.find({})
      .sort({_id: 1}).exec();
      io.p2p.emit('getUsers', users);
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
        if(io.p2p.request.session.hasOwnProperty('broadcastLogin')) {
          if(io.p2p.request.session.broadcastLogin) {
            io.p2p.request.session.broadcastLogin = false;
            io.p2p.join('activeUsers');
            let activeUsers = await models.activeuserModel.aggregate([
              {
                $group:
                {
                  _id: '$user',
                  where: { $push: '$where' }
                }
              },
              {
                $lookup:
                {
                  from: "userDB",
                  localField: "_id",
                  foreignField: "_id",
                  as: "_id"
                }
              }
            ]).exec();
            io.p2n.in("activeUsers").emit('getConcurrentUsers', activeUsers);
          }
        }
        return; //直接結束程式
      }
    }
    io.p2p.emit('getCurrentUser', undefined);
  });

  io.p2p.on('getRobotUsers', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let users = await models.userModel.find({
        tags: setting.robotTag
      }).sort({_id: 1}).exec();
      io.p2p.emit('getRobotUsers', users);
    }
  });

  io.p2p.on('getUsers', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let users = await models.userModel.find({})
      .sort({_id: 1}).exec();
      io.p2p.emit('getUsers', users);
    }
  });

  io.p2p.on('setCurrentUser', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let action = authMapping['setCurrentUser'];
      let user = await models.userModel.findOne({
        _id: ObjectId(io.p2p.request.session.passport.user)
      }).sort({_id: 1}).exec();
      user.name = data.name;
      user.types = data.types;
      user.unit = data.unit;
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
    }
  });

  io.p2p.on('modUserTags', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let count = 0;
      let zeroTag = [];
      for(let i=0; i<data.users.length; i++) {
        let userID = data.users[i]._id;
        let user = await models.userModel.findOne({
          _id: ObjectId(userID)
        }).sort({_id: 1}).exec();
        if(data.type == 1) {
          for(let k=0; k<data.tags.length; k++) {
            let tag = new ObjectId(data.tags[k]);
            let userTag = user.tags.some((item) => {
              return item.equals(tag);
            });
            if(!userTag) {
              user.tags.push(tag);
            }
          }
        } else {
          let tagdeleteTOBE = user.tags.filter((item) => {
            return !data.tags.some((dtag) => {
              return (new ObjectId(dtag)).equals(item);
            })
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
      let users = await models.userModel.find({})
      .sort({_id: 1}).exec();
      io.p2p.emit('getUsers', users);
    }
  });

  io.p2p.on('checkEmail', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
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
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let users = await models.userModel.find({
        email: data.email
      }).sort({_id: 1}).exec();
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
    let authMapping = await require('../middleware/mapping')(models);
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
      let users = await models.userModel.find({})
      .sort({_id: 1}).exec();
      io.p2p.emit('getUsers', users);
    }
  });

  return router;
}
