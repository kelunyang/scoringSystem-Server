const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { ObjectId } = require('mongodb');
const fs = require('fs-extra');
const TurndownService = require('turndown')
let _ = require('lodash');
const e = require('express');
const turndownService = new TurndownService();
const enableBroadcast = true;
const disableBroadcast = false;

module.exports = (io, models) => {

  let getissueList = async (data, mode) => {
    var collection = await models.issueModel.find({
      KB: new ObjectId(data)
    }).sort({
      position: 1,
      status: -1,
      star: -1
    })
    .populate('user', '-password -lineToken -lineCode')
    .populate('attachments')
    .populate('version')
    .exec();
    io.p2p.emit('getissueList', collection);
    if(mode) {
      io.p2p.to("/" + data).emit('getissueList', collection);
    }
  };

  io.p2p.on('getissueList', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      await getissueList(data, disableBroadcast);
    }
    return;
  });

  io.p2p.on('editIssue', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var issue = await models.issueModel.findOne({
        _id: data
      }).exec();
      io.p2p.emit('editIssue', issue);
    }
    return;
  });

  io.p2p.on('setIssue', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let now = dayjs().unix();
      var issue = await models.issueModel.findOne({
        _id: new ObjectId(data._id)
      })
      .populate({
        path: 'KB',
        populate: { path: 'stages' }
      })
      .exec();
      if(!issue.sealed) {
        let currentUser = new ObjectId(io.p2p.request.session.passport.user);
        let KBstage = _.find(issue.KB.stages, (stage) => {
            return stage.current;
        });
        let globalSetting = await models.settingModel.findOne({}).exec();
        let user =  await models.userModel.findOne({
          _id: currentUser
        }).exec();
        let autherizedTags = _.flatten([KBstage.pmTags, KBstage.writerTags, KBstage.reviewerTags, KBstage.vendorTags, globalSetting.settingTags]);
        let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
          return uTag.equals(aTag);
        })).length > 0;
        if(tagCheck || (new ObjectId(issue.user)).equals(currentUser)) {
          if(data.title !== null) { issue.title = data.title; }
          issue.parent = data.parent === undefined || data.parent === null ? undefined : new ObjectId(data.parent);
          issue.body = turndownService.turndown(data.body);
          issue.type = data.type;
          issue.sealed = true;
          issue.tick = now;
          await issue.save();
          let KB = await models.KBModel.findOne({
            _id: issue.KB
          }).exec();
          let event = await models.eventlogModel.create({
            tick: now,
            type: '知識點審查',
            desc: '編輯Issue',
            KB: KB._id,
            user: new ObjectId(io.p2p.request.session.passport.user)
          });
          KB.eventLog.push(event._id);
          await KB.save();
          io.p2p.emit('setIssue', true);
          await getissueList(issue.KB._id, enableBroadcast);
        } else {
          io.p2p.emit('accessViolation', {
            where: '知識點審查',
            tick: now,
            action: '設定Issue',
            loginRequire: false
          });
        }
      }
    }
    return;
  });

  io.p2p.on('setissueStar', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var issue = await models.issueModel.findOne({
        _id: new ObjectId(data)
      })
      .populate({
        path: 'KB',
        populate: { path: 'stages' }
      })
      .populate('user', '-password -lineToken -lineCode')
      .populate('attachments')
      .exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let KBstage = _.find(issue.KB.stages, (stage) => {
          return stage.current;
      });
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.pmTags, KBstage.reviewerTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        issue.star = !issue.star;
        await issue.save();
        io.p2p.emit('setissueStar', true);
        await getissueList(issue.KB._id, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點審查',
          tick: dayjs().unix(),
          action: '關注／取消關注Issue',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('setissueStatus', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var issue = await models.issueModel.findOne({
        _id: new ObjectId(data)
      })
      .populate({
        path: 'KB',
        populate: { path: 'stages' }
      })
      .populate('user', '-password -lineToken -lineCode')
      .populate('attachments')
      .exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let KBstage = _.find(issue.KB.stages, (stage) => {
          return stage.current;
      });
      let globalSetting = await models.settingModel.findOne({}).exec();
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.pmTags, KBstage.reviewerTags, globalSetting.settingTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck || (new ObjectId(issue.user._id)).equals(currentUser)) {
        issue.status = !issue.status;
        await issue.save();
        io.p2p.emit('setStatus', true);
        await getissueList(issue.KB._id, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點審查',
          tick: dayjs().unix(),
          action: '關閉／開放Issue',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('getissueAttachment', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.issueModel.findOne({
        _id: data
      })
      .populate('attachments')
      .exec();
      io.p2p.emit('getissueAttachment', collection.attachments);
    }
    return;
  });

  io.p2p.on('removeIssue', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var issue = await models.issueModel.findOne({
        _id: new ObjectId(data)
      })
      .populate({
        path: 'KB',
        populate: { path: 'stages' }
      })
      .exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let KBstage = _.find(issue.KB.stages, (stage) => {
          return stage.current;
      });
      let globalSetting = await models.settingModel.findOne({}).exec();
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.pmTags, globalSetting.settingTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck || (new ObjectId(issue.user)).equals(currentUser)) {
        let errorlog = 0;
        var collections = await models.issueModel.find({
          parent: new ObjectId(data)
        }).exec();
        for(let i = 0; i < collections.length; i++) {
          let issue = collections[i];
          for(let i=0;i<issue.attachments.length;i++) {
            try {
              let file = issue.attachments[i];
              let exist = await fs.access(globalSetting.storageLocation + '/' + file);
              if(exist) { await fs.remove(globalSetting.storageLocation + '/' + file); }
              fileObj = await models.fileModel.deleteOne({
                _id: new ObjectId(file)
              }).exec();
            } catch (err) {
              errorlog++;
            }
          }
        }
        var issue = await models.issueModel.findOne({
          _id: new ObjectId(data)
        }).exec();
        for(let i=0;i<issue.attachments.length;i++) {
          try {
            let file = issue.attachments[i];
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
          await models.issueModel.deleteMany({
            parent: new ObjectId(data)
          }).exec();
          await models.issueModel.deleteOne({
            _id: new ObjectId(data)
          }).exec();
          let KB = await models.KBModel.findOne({
            _id: issue.KB
          }).exec();
          let event = await models.eventlogModel.create({
            tick: dayjs().unix(),
            type: '知識點審查',
            desc: '刪除Issue',
            KB: KB._id,
            user: new ObjectId(io.p2p.request.session.passport.user)
          });
          KB.eventLog.push(event._id);
          await KB.save();
          io.p2p.emit('removeIssue', true);
          await getissueList(issue.KB._id, enableBroadcast);
        } else {
          io.p2p.emit('removeIssueError', errorlog);
        }
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點審查',
          tick: dayjs().unix(),
          action: '移除Issue',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('addIssue', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let now = dayjs().unix();
      let KBstage = await models.stageModel.findOne({
        KB: data.KB,
        current: true
      }).exec();
      let coolDown = false;
      if(KBstage !== undefined) {
        if(data.parent == undefined) {
          if(KBstage.coolDown) {
            coolDown = true;
          }
        }
        if(!coolDown) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let user =  await models.userModel.findOne({
            _id: currentUser
          }).exec();
          let autherizedTags = _.flatten([KBstage.pmTags, KBstage.reviewerTags, KBstage.writerTags, KBstage.vendorTags, globalSetting.settingTags]);
          let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
            return uTag.equals(aTag);
          })).length > 0;
          if(tagCheck) {
            let KB = await models.KBModel.findOne({
              _id: data.KB
            }).exec();
            let issue = null;
            if(data.parent === undefined || data.parent === null) {
              issue = await models.issueModel.create({ 
                tick: now,
                attachments: [],
                user: currentUser,
                KB: KB._id,
                version: data.version,
                parent: undefined,
                status: false,
                star: false,
                sealed: false,
                objective: data.objective,
                position: data.position
              });
              await models.readedIssueModel.create({
                user: currentUser,
                issue: issue._id,
                tick: now
              });
              let event = await models.eventlogModel.create({
                tick: now,
                type: '知識點審查',
                desc: '增加Issue',
                KB: KB._id,
                user: new ObjectId(io.p2p.request.session.passport.user)
              });
              KB.eventLog.push(event._id);
              await KB.save();
              io.p2p.emit('addIssue', {
                _id: issue._id,
                parent: issue.parent
              });
            } else {
              let parentID = new ObjectId(data.parent);
              let parentIssue = await models.issueModel.findOne({
                _id: parentID
              }).exec();
              if(!parentIssue.status) {
                issue = await models.issueModel.create({ 
                  tick: now,
                  attachments: [],
                  user: currentUser,
                  KB: KB._id,
                  version: data.version,
                  parent: parentID,
                  status: false,
                  star: false,
                  sealed: false,
                  objective: data.objective,
                  position: data.position
                });
                await models.readedIssueModel.create({
                  user: currentUser,
                  issue: issue._id,
                  tick: now
                });
                let event = await models.eventlogModel.create({
                  tick: now,
                  type: '知識點審查',
                  desc: '增加Issue',
                  KB: KB._id,
                  user: new ObjectId(io.p2p.request.session.passport.user)
                });
                KB.eventLog.push(event._id);
                await KB.save();
                io.p2p.emit('addIssue', {
                  _id: issue._id,
                  parent: issue.parent
                });
              } else {
                io.p2p.emit('accessViolation', {
                  where: '知識點審查',
                  tick: dayjs().unix(),
                  action: 'Issue已關閉，無法新增',
                  loginRequire: false
                });
              }
            }
          } else {
            io.p2p.emit('accessViolation', {
              where: '知識點審查',
              tick: dayjs().unix(),
              action: '新增Issue',
              loginRequire: false
            });
          }
        } else {
          io.p2p.emit('accessViolation', {
            where: '知識點審查',
            tick: dayjs().unix(),
            action: '新增Issue',
            loginRequire: false
          });
        }
      }
    }
    return;
  });

  return router;
}
