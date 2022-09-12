import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import nodemailer from "nodemailer";
import _ from 'lodash';
import frontTable from '../middleware/frontendAuth.js';
import generator from 'generate-password';

const APPENDMODE = false;

export default function (io, models) {
  let getUsers = async() => {
    let queryCriteria = [];
    let visibilityTags = _.map(await models.tagModel.find({
      visibility: true
    }).exec(), (item) => {
      return item._id;
    });
    let setting = await models.settingModel.findOne({}).exec();
    let currentUser =  await models.userModel.findOne({
      _id: new ObjectId(io.p2p.request.session.passport.user)
    }).exec();
    let settingIncluded = _.intersectionWith(currentUser.tags, setting.settingTags, (uTag, sTag) => {
      return uTag.equals(sTag);
    });
    queryCriteria.push({
      $match: {
        tags: {
          $in: visibilityTags
        }
      }
    });
    if(settingIncluded.length === 0) {
      queryCriteria.push(
      {
        $match: {
          tags: {
            $nin: setting.settingTags
          }
        }
      });
      let projectIncluded = _.intersectionWith(currentUser.tags, setting.projectTags, (uTag, pTag) => {
        return uTag.equals(pTag);
      });
      if(projectIncluded.length === 0) {
        queryCriteria.push(
        {
          $match: {
            tags: {
              $nin: setting.projectTags
            }
          }
        });
      }
      let userIncluded = _.intersectionWith(currentUser.tags, setting.userTags, (uTag, sTag) => {
        return uTag.equals(sTag);
      });
      if(userIncluded.length === 0) {
        queryCriteria.push(
        {
          $match: {
            tags: {
              $nin: setting.userTags
            }
          }
        });
      }
    }
    queryCriteria.push(
      {
        $project: {
          password: 0,
        }
      }
    );
    queryCriteria.push(
      {
        $sort: {
          firstRun: -1,
          lineDate: -1,
          createDate: 1
        }
      }
    );
    let users = await models.userModel.aggregate(queryCriteria);
    io.p2p.emit('getUsers', users);
  };

  let availableTags = async(tags) => {
    let currentUser =  await models.userModel.findOne({
      _id: new ObjectId(io.p2p.request.session.passport.user)
    }).exec();
    let setting = await models.settingModel.findOne({}).exec();
    let settingIncluded = _.intersectionWith(currentUser.tags, setting.settingTags, (uTag, sTag) => {
      return uTag.equals(sTag);
    });
    if(settingIncluded.length === 0) {
      tags = _.differenceWith(tags, setting.settingTags, (tag, sTag) => {
        return tag.equals(sTag);
      });
      let projectIncluded = _.intersectionWith(currentUser.tags, setting.projectTags, (uTag, pTag) => {
        return uTag.equals(pTag);
      });
      if(projectIncluded.length === 0) {
        tags = _.differenceWith(tags, setting.projectTags, (tag, pTag) => {
          return tag.equals(pTag);
        });
      }
      let userIncluded = _.intersectionWith(currentUser.tags, setting.userTags, (uTag, sTag) => {
        return uTag.equals(sTag);
      });
      if(userIncluded.length === 0) {
        tags = _.differenceWith(tags, setting.userTags, (tag, uTag) => {
          return tag.equals(uTag);
        });
      }
    }
    return tags;
  }

  io.p2p.on('userInbound', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      io.p2p.join('/activeUsers');
      io.p2p.to("/activeUsers").emit('userInbound');
    }
    return;
  });

  io.p2p.on('getAuthLevel', async (data) => {
    let table = await frontTable(models);
    io.p2p.emit('getAuthLevel', table);
    return;
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
    return;
  });

  io.p2p.on('passwordClientReset', async (data) => {
    let user = await models.userModel.findOne({
      email: data
    }).exec();
    if(user === undefined || user === null) {
      io.p2p.emit('passwordClientReset', {
        name: undefined
      });
    } else {
      let setting = await models.settingModel.findOne({}).exec();
      let robotSetting = await models.robotModel.findOne({}).exec();
      let password = '';
      if(setting.randomNewbiePass) {
        password = generator.generate({
          length: setting.newbiepassLength,
          numbers: true,
          symbols: true,
          excludeSimilarCharacters: true,
          strict: true
        });
      } else {
        password = setting.defaultPassword
      }
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
          from: '"' + setting.systemName + '" <' + robotSetting.mailAccount + '>',
          to: user.email,
          subject: setting.systemName + "：帳號密碼重置通知信",
          text: "您好，您的密碼已經被重置了，系統預設密碼是：" + password + "\n請記得在登入後修改密碼！\n登入網址：" + setting.siteLocation, // plain text body
          html: "<p>您好，您的帳號已經被重置了，系統預設密碼是：" + password + "</p><p>請記得在登入後修改密碼！</p><p>登入網址：<a href='" + setting.siteLocation + "' target='_blank' title='登入網址'>" + setting.siteLocation + "</a></p>", // html body
        });
      } catch(err) {
        console.log(err);
      }
      io.p2p.emit('passwordClientReset', {
        name: user.name
      });
    }
    return;
  });

  io.p2p.on('passwordReset', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let setting = await models.settingModel.findOne({}).exec();
      let robotSetting = await models.robotModel.findOne({}).exec();
      let user = await models.userModel.findOne({
        _id: new ObjectId(data)
      }).exec();
      let password = '';
      if(setting.randomNewbiePass) {
        password = generator.generate({
          length: setting.newbiepassLength,
          numbers: true,
          symbols: true,
          excludeSimilarCharacters: true,
          strict: true
        });
      } else {
        password = setting.defaultPassword
      }
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
          from: '"' + setting.systemName + '" <' + robotSetting.mailAccount + '>',
          to: user.email,
          subject: setting.systemName + "：帳號密碼重置通知信",
          text: "您好，您的密碼已經被重置了，系統預設密碼是：" + password + "\n請記得在登入後修改密碼！\n登入網址：" + setting.siteLocation, // plain text body
          html: "<p>您好，您的帳號已經被重置了，系統預設密碼是：" + password + "</p><p>請記得在登入後修改密碼！</p><p>登入網址：<a href='" + setting.siteLocation + "' target='_blank' title='登入網址'>" + setting.siteLocation + "</a></p>", // html body
        });
      } catch(err) {
        console.log(err);
      }
      io.p2p.emit('passwordReset', {
        name: user.name
      });
    }
    return;
  });

  io.p2p.on('modUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let zeroTag = [];
      let setting = await models.settingModel.findOne({}).exec();
      let user = await models.userModel.findOne({
        _id: new ObjectId(data._id)
      }).exec();
      let newTags = await availableTags(_.map(data.tags, (item) => {
        return new ObjectId(item);
      }));
      let tagdeleteTOBE = _.differenceWith(user.tags, newTags, (uTag, nTag) => {
        return uTag.equals(nTag);
      });
      for(let i=0; i< tagdeleteTOBE.length; i++) {
        let tag = tagdeleteTOBE[i];
        let settingTags = _.intersectionWith(setting.settingTags, [tag], (sTag, dTag) => {
          return sTag.equals(dTag);
        });
        if(settingTags.length > 0) {
          let settingTagUsers = await models.userModel.find({
            tags: { $in: setting.settingTags},
            _id: { $ne: user._id }
          }).exec();
          if(settingTagUsers.length === 0) { 
            zeroTag.push(tag);
            newTags.push(tag);
          }
        }
      }
      user.tags = newTags;
      let restricted = _.intersectionWith(setting.restrictTags, user.tags, (sTag, dTag) => {
        return sTag.equals(dTag);
      });
      let currentUser =  await models.userModel.findOne({
        _id: new ObjectId(io.p2p.request.session.passport.user)
      }).exec();
      let authorized = _.intersectionWith(setting.settingTags, currentUser.tags, (sTag, dTag) => {
        return sTag.equals(dTag);
      });
      user.modDate = dayjs().unix();
      if(io.p2p.request.session.passport.user === data._id) {
        if(restricted.length === 0 ) { 
          user.name = data.name;
          user.unit = data.unit;
        }
      } else {
        if(authorized.length > 0) {
          user.name = data.name;
          user.unit = data.unit;
        }
      }
      user.seed = data.seed;
      user.types = data.types;
      user.firstRun = false;
      await user.save();
      io.p2p.emit('modUsers', {
        name: user.name,
        zeroTag: zeroTag.length
      });
      getUsers();
    }
    return;
  });

  io.p2p.on('getCurrentUser', async (data) => {
    if(io.p2p.request.session.hasOwnProperty('passport')) {
      if(io.p2p.request.session.passport.hasOwnProperty('user')) {
        let user = await models.userModel.findOne({
          _id: new ObjectId(io.p2p.request.session.passport.user)
        })
        .populate('tags').exec();
        if(user === null) {
          return io.p2p.emit('getCurrentUser', {
            _id: '',
            tags: [],
            types: 'bottts',
            name: 'undefined',
            unit: 'undefined',
            email: 'undefined@undefined.com',
            createDate: 0,
            modDate: 0,
            lineDate: 0,
            seed: "",
            restricted: true
          });
        } else {
          let setting = await models.settingModel.findOne({}).exec();
          let restricted = _.intersectionWith(setting.restrictTags, user.tags, (sTag, dTag) => {
            return sTag.equals(dTag);
          });
          return io.p2p.emit('getCurrentUser', {
            _id: user._id,
            tags: user.tags,
            types: user.types,
            name: user.name,
            unit: user.unit,
            email: user.email,
            createDate: user.createDate,
            modDate: user.modDate,
            lineDate: user.lineDate,
            seed: user.seed,
            restricted: restricted.length > 0
          });
        }
      }
    }
    io.p2p.emit('getCurrentUser', {
      _id: '',
      tags: [],
      types: 'bottts',
      name: 'undefined',
      unit: 'undefined',
      email: 'undefined@undefined.com',
      createDate: 0,
      modDate: 0,
      lineDate: 0,
      seed: "",
      restricted: true
    });
    return;
  });

  io.p2p.on('getSelectedUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if(data.users.length > 0) {
        let users = await models.userModel.find({
          _id: { $in: data.users }
        }).select('-password -lineToken -lineCode').exec();
        io.p2p.emit('getSelectedUsers', {
          users: users,
          type: data.type
        });
      }
    }
    return;
  });

  io.p2p.on('getTagUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let tags = undefined;
      if(data === undefined) {
        let setting = await models.settingModel.findOne({}).exec();
        tags = setting.robotTag;
      } else {
        tags = _.map(data, (tag) => {
          return new ObjectId(tag);
        });
      }
      if(tags !== undefined) {
        let users = await models.userModel.find({
          tags: { $in: tags }
        }).select('-password -lineToken -lineCode').exec();
        io.p2p.emit('getTagUsers', {
          result: users,
          query: data
        });
      }
    }
    return;
  });

  io.p2p.on('getUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      getUsers();
    }
    return;
  });

  io.p2p.on('setCurrentUser', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let setting = await models.settingModel.findOne({}).exec();
          let user = await models.userModel.findOne({
            _id: new ObjectId(io.p2p.request.session.passport.user)
          }).exec();
          let restricted = _.intersectionWith(setting.restrictTags, user.tags, (sTag, dTag) => {
            return sTag.equals(dTag);
          });
          if(restricted.length === 0) { 
            user.name = data.name;
            user.unit = data.unit;
          }
          user.seed = data.seed;
          user.types = data.types;
          user.firstRun = false;
          user.modDate = dayjs().unix();
          if(data.password !== '') {
            user.password = bcrypt.hashSync(data.password, bcrypt.genSaltSync(10));
          }
          await user.save();
          io.p2p.emit('setCurrentUser', {
            modify: dayjs().unix()
          });
          io.p2p.emit('getCurrentUser', user);
        }
      }
    }
    return;
  });

  io.p2p.on('modUserTags', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let count = 0;
      let zeroTag = [];
      if(data.mode === APPENDMODE) {
        for(let i=0; i<data.users.length; i++) {
          let newtags = _.map(data.tags, (item) => {
            return new ObjectId(item);
          })
          let userID = data.users[i]._id;
          let user = await models.userModel.findOne({
            _id: new ObjectId(userID)
          }).exec();
          user.tags = _.unionWith(user.tags, newtags, (uTag, dTag) => {
            return uTag.equals(dTag);
          });
          user.modDate = dayjs().unix();
          await user.save();
          count++;
        }
      } else {
        let setting = await models.settingModel.findOne({}).exec();
        let newTags = await availableTags(_.map(data.tags, (item) => {
          return new ObjectId(item);
        }));
        for(let i=0; i<data.users.length; i++) {
          let userID = data.users[i]._id;
          let user = await models.userModel.findOne({
            _id: new ObjectId(userID)
          }).exec();
          let usernewTags = newTags;
          let tagdeleteTOBE = _.differenceWith(user.tags, usernewTags, (uTag, nTag) => {
            return uTag.equals(nTag);
          });
          for(let i=0; i< tagdeleteTOBE.length; i++) {
            let tag = tagdeleteTOBE[i];
            let settingTags = _.intersectionWith(setting.settingTags, [tag], (sTag, dTag) => {
              return sTag.equals(dTag);
            });
            if(settingTags.length > 0) {
              let settingTagUsers = await models.userModel.find({
                tags: { $in: setting.settingTags},
                _id: { $ne: user._id }
              }).exec();
              if(settingTagUsers.length === 0) { 
                zeroTag.push(tag);
                usernewTags.push(tag);
              }
            }
          }
          user.tags = usernewTags;
          user.modDate = dayjs().unix();
          await user.save();
          count++;
        }
        zeroTag = _.uniqWith(zeroTag, (aTag, bTag) => {
          return aTag.equals(bTag);
        });
      }
      io.p2p.emit('modUserTags', {
        planned: data.users.length,
        processed: count,
        tags: data.tags.length,
        zeroTag: zeroTag
      });
      getUsers();
    }
    return;
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
    return;
  });

  io.p2p.on('setEmail', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let users = await models.userModel.find({
        email: data.email
      }).exec();
      if(users.length === 0) {
        let user = await models.userModel.findOne({
          _id: new ObjectId(data.id)
        }).exec();
        if(user !== undefined) {
          user.email = data.email;
          await user.save();
          io.p2p.emit('setEmail', true);
        } else {
          io.p2p.emit('setEmail', false);
        }
      } else {
        io.p2p.emit('setEmail', false);
      }
    }
    return;
  });

  io.p2p.on('removeUser', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let count = 0;
      let setting = await models.settingModel.findOne({}).exec();
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
            let uid = new ObjectId(user._id);
            await models.accountingModel.deleteMany({
              uid: uid
            }).exec();
            let memberGroups = await models.groupModel.find({
              $or:[ 
                {leaders: uid},
                {members: uid}
              ]
            }).exec();
            let leaderGroups = await models.groupModel.find({
              leaders: uid
            }).exec();
            for(let i=0; i<memberGroups.length; i++) {
              let group = memberGroups[i];
              group.members = _.filter(group.members, (member) => {
                return !member._id.equals(uid);
              })
              await group.save();
            }
            for(let i=0; i<leaderGroups.length; i++) {
              let group = leaderGroups[i];
              group.leaders = _.filter(group.leaders, (leaders) => {
                return !leaders._id.equals(uid);
              })
              await group.save();
            }
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
    return;
  });

  return router;
}