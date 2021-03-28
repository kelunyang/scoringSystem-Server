const express = require('express');
const router = express.Router();
const moment = require('moment');
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
      getissueList(data, disableBroadcast);
    }
  });

  io.p2p.on('editIssue', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var issue = await models.issueModel.findOne({
        _id: data
      }).exec();
      io.p2p.emit('editIssue', issue);
    }
  });

  io.p2p.on('setIssue', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var issue = await models.issueModel.findOne({
        _id: new ObjectId(data._id)
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
      let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.pmTags, KBstage.writerTags, KBstage.reviewerTags, KBstage.vendorTags, globalSetting.settingTags]);
      let tagCheck = false;
      for(let i=0; i< user.tags.length; i++) {
        let tag = user.tags[i];
        if(!tagCheck) {
          tagCheck = _.find(autherizedTags, (aTag) => {
            return aTag.equals(tag);
          }) !== undefined ? true : false;
        }
      }
      if(tagCheck || (new ObjectId(issue.user)).equals(currentUser)) {
        if(data.title !== null) { issue.title = data.title; }
        issue.parent = data.parent === undefined || data.parent === null ? undefined : new ObjectId(data.parent);
        issue.body = turndownService.turndown(data.body);
        issue.type = data.type;
        issue.tick = moment().unix();
        await issue.save();
        io.p2p.emit('setIssue', true);
        getissueList(issue.KB._id, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點審查',
          tick: moment().unix(),
          action: '設定Issue',
          loginRequire: false
        });
      }
    }
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
      let tagCheck = false;
      for(let i=0; i< user.tags.length; i++) {
        let tag = user.tags[i];
        if(!tagCheck) {
          tagCheck = _.find(autherizedTags, (aTag) => {
            return aTag.equals(tag);
          }) !== undefined ? true : false;
        }
      }
      if(tagCheck) {
        issue.star = !issue.star;
        await issue.save();
        io.p2p.emit('setissueStar', true);
        getissueList(issue.KB._id, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點審查',
          tick: moment().unix(),
          action: '關注／取消關注Issue',
          loginRequire: false
        });
      }
    }
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
      let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.pmTags, KBstage.reviewerTags, globalSetting.settingTags]);
      let tagCheck = false;
      for(let i=0; i< user.tags.length; i++) {
        let tag = user.tags[i];
        if(!tagCheck) {
          tagCheck = _.find(autherizedTags, (aTag) => {
            return aTag.equals(tag);
          }) !== undefined ? true : false;
        }
      }
      if(tagCheck || (new ObjectId(issue.user._id)).equals(currentUser)) {
        issue.status = !issue.status;
        await issue.save();
        io.p2p.emit('setStatus', true);
        getissueList(issue.KB._id, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點審查',
          tick: moment().unix(),
          action: '關閉／開放Issue',
          loginRequire: false
        });
      }
    }
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
      let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.pmTags, globalSetting.settingTags]);
      let tagCheck = false;
      for(let i=0; i< user.tags.length; i++) {
        let tag = user.tags[i];
        if(!tagCheck) {
          tagCheck = _.find(autherizedTags, (aTag) => {
            return aTag.equals(tag);
          }) !== undefined ? true : false;
        }
      }
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
              let exist = await fs.access('/var/www/frontend/storages/' + file);
              if(exist) { await fs.remove('/var/www/frontend/storages/' + file); }
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
            let exist = await fs.access('/var/www/frontend/storages/' + file);
            if(exist) { await fs.remove('/var/www/frontend/storages/' + file); }
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
          io.p2p.emit('removeIssue', true);
          getissueList(issue.KB._id, enableBroadcast);
        } else {
          io.p2p.emit('removeIssueError', errorlog);
        }
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點審查',
          tick: moment().unix(),
          action: '移除Issue',
          loginRequire: false
        });
      }
    }
  });

  io.p2p.on('addIssue', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let KBstage = await models.stageModel.findOne({
        KB: data.KB,
        current: true
      }).exec();
      if(KBstage !== undefined) {
        let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
        let user =  await models.userModel.findOne({
          _id: currentUser
        }).exec();
        let autherizedTags = _.flatten([KBstage.pmTags, KBstage.reviewerTags, KBstage.writerTags, KBstage.vendorTags, globalSetting.settingTags]);
        let tagCheck = false;
        for(let i=0; i< user.tags.length; i++) {
          let tag = user.tags[i];
          if(!tagCheck) {
            tagCheck = _.find(autherizedTags, (aTag) => {
              return aTag.equals(tag);
            }) !== undefined ? true : false;
          }
        }
        if(tagCheck) {
          var issue = await models.issueModel.create({ 
            tick: moment().unix(),
            attachments: [],
            user: new ObjectId(io.p2p.request.session.passport.user),
            KB: data.KB,
            version: data.version,
            parent: data.parent === undefined || data.parent === null ? undefined : new ObjectId(data.parent),
            status: false,
            star: false,
            objective: data.objective,
            position: data.position
          });
          io.p2p.emit('addIssue', {
            _id: issue._id,
            parent: issue.parent
          });
        } else {
          io.p2p.emit('accessViolation', {
            where: '知識點審查',
            tick: moment().unix(),
            action: '新增Issue',
            loginRequire: false
          });
        }
      }
    }
  });

  return router;
}
