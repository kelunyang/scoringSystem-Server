const express = require('express');
const router = express.Router();
const moment = require('moment');
const { ObjectId } = require('mongodb');
const fs = require('fs-extra');
const TurndownService = require('turndown')
let _ = require('lodash');
const turndownService = new TurndownService();
const enableBroadcast = true;
const disableBroadcast = false;

module.exports = (io, models) => {
  let getReadedIssues = async () => {
    let readedIssues = await models.readedIssueModel.find({
      user: new ObjectId(io.p2p.request.session.passport.user)
    }).exec();
    io.p2p.emit('getReadedIssue', readedIssues);
  };
  let getStage = async (data, mode) => {
    if(data !== "") {
      let stage = await models.stageModel.findOne({
        _id: new ObjectId(data)
      })
      .populate(
        {
          path: 'objectives',
          populate: { 
            path: 'signUser',
            select: '-password -lineToken -lineCode'
          }
        }
      )
      .exec();
      io.p2p.emit('getStage', stage);
      if(mode) {
        io.p2p.to("/" + stage.KB).emit('getStage', stage);
      }
    }
  };
  let getKB = async (data, mode) => {
    if(data !== "") {
      let KB = await models.KBModel.findOne({
        _id: data
      })
      .populate('tag')
      .populate('stages')
      .populate('descAtt')
      .exec();
      io.p2p.emit('getKB', KB);
      if(mode) {
        io.p2p.to("/" + KB._id).emit('getKB', KB);
      }
    }
  };
  let allChapterListed = async (data) => {
    if(data !== "") {
      var chapters = await models.chapterModel.find({
        tag: { $in: _.flatten([new ObjectId(data)]) }
      })
      .populate({
        path: 'KBs',
        populate: [
          {
            path: 'stages'
          }
        ]
      }).sort({
        sort: 1
      }).exec();
      for(let c=0; c<chapters.length; c++) {
        let chapter = chapters[c];
        let KBs = await models.KBModel.find({
          chapter: chapter._id
        }).select({ _id: 1 }).exec();
        await models.chapterModel.updateOne({
          _id: chapter._id
        }, {
          KBs: _.map(KBs, (item) => {
            return item._id;
          })
        });
        for(let k=0; k<chapter.KBs.length; k++) {
          let KB = chapter.KBs[k];
          let stages = await models.stageModel.find({
            KB: KB._id
          }).select({
            _id: 1
          }).exec();
          await models.KBModel.updateOne({
            _id: KB._id
          }, {
            stages: _.map(stages, (item) => {
              return item._id;
            })
          })
        }
      }
      chapters = await models.chapterModel.find({
        tag: { $in: _.flatten([new ObjectId(data)]) }
      })
      .populate({
        path: 'KBs',
        populate: [
          {
            path: 'stages'
          },
          {
            path: 'descAtt'
          }
        ]
      }).sort({
        sort: 1
      }).exec();
      io.p2p.emit('getChapters', chapters);
    }
    return;
  };

  io.p2p.on('getChapters', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      await allChapterListed(data);
    }
    return;
  });

  io.p2p.on('joinKBEditing', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let KBID = new ObjectId(data);
      let KB = await models.KBModel.findOne({
        _id: KBID
      })
      .populate('stages')
      .exec();
      let KBstage = _.find(KB.stages, (stage) => {
        return stage.current;
      });
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.pmTags, KBstage.writerTags, KBstage.reviewerTags, KBstage.vendorTags, KBstage.finalTags,globalSetting.settingTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        if(KB !== undefined) {
          io.p2p.join('/' + KB._id);
        }
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點審查',
          tick: moment().unix(),
          action: '加入知識點審查',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('leaveKBEditing', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let KBID = new ObjectId(data);
      let KB = await models.KBModel.findOne({
        _id: KBID
      })
      .populate('stages')
      .exec();
      let KBstage = _.find(KB.stages, (stage) => {
        return stage.current;
      });
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.pmTags, KBstage.writerTags, KBstage.reviewerTags, KBstage.vendorTags, KBstage.finalTags,globalSetting.settingTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        if(KB !== undefined) {
          io.p2p.leave('/' + KB._id);
        }
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點審查',
          tick: moment().unix(),
          action: '離開知識點審查',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('getKB', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      await getKB(data);
    }
    return;
  });

  io.p2p.on('getReadedIssue', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      await getReadedIssues();
    }
    return;
  });

  io.p2p.on('setReadedIssue', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let user = new ObjectId(io.p2p.request.session.passport.user);
      let issueID = new ObjectId(data);
      let now = moment().unix();
      let issueList = [];
      let childThreads = await models.issueModel.find({
        parent: issueID
      }).exec();
      let mainThread = await models.issueModel.findOne({
        _id: issueID
      }).exec();
      if(mainThread) {
        issueList.push(new ObjectId(mainThread._id));
      }
      for(let i=0; i<childThreads.length; i++) {
        let childThread = childThreads[i];
        issueList.push(new ObjectId(childThread._id));
      }
      let readedList = await models.readedIssueModel.aggregate([
        {
          $match: {
            user: user,
            issue: {
              $in: issueList
            }
          }
        },
        {
          $project: {
            issue: 1
          }
        },
        {
          $group: {
            _id: null,
            issues: {
              $addToSet: '$issue'
            }
          }
        }
      ]);
      let xorList = [];
      if(readedList.length > 0) {
        xorList = _.differenceWith(issueList, readedList[0].issues, (a, b) => {
          return a.equals(b);
        });
      } else {
        xorList = issueList;
      }
      let newReadeds = [];
      for(let i=0; i< xorList.length; i++) {
        let xor = xorList[i];
        newReadeds.push({
          user: user,
          issue: xor,
          tick: now
        });
      }
      await models.readedIssueModel.insertMany(newReadeds);
      await getReadedIssues();
    }
    return;
  });

  io.p2p.on('addChapter', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        let tagID = new ObjectId(data);
        let chapters = await models.chapterModel.find({
          tag: tagID
        }).exec();
        var chapter = await models.chapterModel.create({ 
          createDate: now,
          modDate: now,
          user: new ObjectId(io.p2p.request.session.passport.user),
          KBs: [],
          title: '',
          sort: chapters.length,
          tag: [tagID]
        });
        io.p2p.emit('addChapter', chapter);
        await allChapterListed(data);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '增加知識點章節',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('setChapter', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        var chapter = await models.chapterModel.findOne({
          _id: new ObjectId(data._id)
        }).exec();
        chapter.modDate = moment().unix();
        chapter.title = data.title;
        await chapter.save();
        io.p2p.emit('setChapter', true);
        await allChapterListed(data.tag);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '設定知識點章節',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('saveSort', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        for(let i=0; i<data.DB.length; i++) {
          let ch = data.DB[i];
          var chapter = await models.chapterModel.findOne({
            _id: new ObjectId(ch._id)
          }).exec();
          chapter.sort = i;
          chapter.modDate = now;
          chapter.KBs = ch.KBs;
          await chapter.save();
          for(let k=0; k<ch.KBs.length; k++) {
            let ck = ch.KBs[k];
            let KB = await models.KBModel.findOne({
              _id: new ObjectId(ck._id)
            }).exec();
            KB.sort = k;
            KB.chapter = new ObjectId(ch._id);
            KB.modDate = now;
            let event = await models.eventlogModel.create({
              tick: now,
              type: '知識點操作',
              desc: '儲存知識點順序',
              KB: new ObjectId(ck._id),
              user: new ObjectId(io.p2p.request.session.passport.user)
            });
            KB.eventLog.push(event._id);
            await KB.save();
            for(let c=0; c<ck.stages.length; c++) {
              let st = ck.stages[c];
              let stage = await models.stageModel.findOne({
                _id: new ObjectId(st._id)
              }).exec();
              st.sort = c;
              st.modDate = now;
              await stage.save();
            }
          }
        }
        io.p2p.emit('saveSort', true);
        await allChapterListed(data.tag);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '儲存知識點順序',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('removeChapter', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let chapterID = new ObjectId(data._id);
        let chapter = await models.chapterModel.findOne({ 
          _id: chapterID
        }).exec();
        let chapterTagID = data.tag;
        for(let i=0;i<chapter.KBs.length;i++) {
          let KBID = chapter.KBs[i];
          var KB = await models.KBModel.findOne({
            _id: KBID
          })
          .populate('descAtt')
          .populate({
            path: 'versions',
            populate: { path: 'file' }
          })
          .populate({
            path: 'issues',
            populate: { path: 'attachments' }
          })
          .exec();
          await models.stageModel.deleteMany({ 
            KB: KBID
          }).exec();
          await models.eventlogModel.deleteMany({ 
            KB: KBID
          }).exec();
          for(let k=0; k<KB.descAtt.length; k++) {
            let att = KB.descAtt[k];
            let exist = await fs.access(globalSetting.storageLocation + '/' + att._id.toString());
            if(exist) { await fs.remove(globalSetting.storageLocation + '/' + att._id.toString()); }
            await models.fileModel.deleteOne({ 
              _id: att._id
            }).exec();
          }
          for(let k=0; k<KB.versions.length; k++) {
            let att = KB.versions[k];
            let exist = await fs.access(globalSetting.storageLocation + '/' + att._id.toString());
            if(exist) { await fs.remove(globalSetting.storageLocation + '/' + att._id.toString()); }
            await models.fileModel.deleteOne({ 
              _id: att._id
            }).exec();
          }
          for(let k=0; k<KB.issues.length; k++) {
            let issue = KB.issues[k];
            for(let k=0; k<issue.attachments.length; k++) {
              let att = issue.attachments[k];
              let exist = await fs.access(globalSetting.storageLocation + '/' + att._id.toString());
              if(exist) { await fs.remove(globalSetting.storageLocation + '/' + att._id.toString()); }
              await models.fileModel.deleteOne({ 
                _id: att._id
              }).exec();
            }
            await models.issueModel.deleteOne({ 
              _id: issue._id
            }).exec();
          }
          await models.KBModel.deleteOne({ 
            _id: KBID
          }).exec();
        }
        chapter = await models.chapterModel.deleteOne({
          _id: chapterID
        }).exec();
        io.p2p.emit('removeChapter', {
          _id: chapter._id
        });
        await allChapterListed(chapterTagID);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '移除知識點章節',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('addKB', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        let chapterID = new ObjectId(data.chapter);
        let chapter = await models.chapterModel.findOne({
          _id: chapterID
        }).exec();
        var KB = await models.KBModel.create({ 
          createDate: now,
          modDate: now,
          attachments: [],
          stages: [],
          user: new ObjectId(io.p2p.request.session.passport.user),
          tag: [data.tag],
          chapter: chapterID,
          versions: [],
          issues: [],
          eventLog: [],
          descAtt: [],
          sort: chapter.KBs.length,
          desc: '',
        });
        chapter.KBs.push(KB._id);
        await chapter.save();
        let event = await models.eventlogModel.create({
          tick: now,
          type: '知識點操作',
          desc: '新增知識點',
          KB: new ObjectId(KB._id),
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        await KB.save();
        io.p2p.emit('addKB', {
          _id: KB._id
        });
        io.p2p.emit('editKB', KB);
        await allChapterListed(data.tag);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '增加知識點',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('setKB', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        var KB = await models.KBModel.findOne({ 
          _id: new ObjectId(data.KB._id)
        }).exec();
        KB.modDate = now;
        KB.title = data.KB.title;
        KB.desc = turndownService.turndown(data.KB.desc);
        KB.chapter = data.KB.chapter;
        KB.textbook = data.KB.textbook;
        let event = await models.eventlogModel.create({
          tick: now,
          type: '知識點操作',
          desc: '修改知識點',
          KB: new ObjectId(KB._id),
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        await KB.save();
        io.p2p.emit('setKB', true);
        await getKB(data.KB._id, enableBroadcast);
        await allChapterListed(data.tag);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '設定知識點',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('removeKB', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let KBtag = '';
        for(let i=0;i<data.KBs.length;i++) {
          let KBID = new ObjectId(data.KBs[i]);
          var KB = await models.KBModel.findOne({
            _id: KBID
          })
          .populate('descAtt')
          .populate({
            path: 'versions',
            populate: { path: 'file' }
          })
          .populate({
            path: 'issues',
            populate: { path: 'attachments' }
          })
          .exec();
          KBtag = data.tag;
          await models.stageModel.deleteMany({ 
            KB: KBID
          }).exec();
          await models.eventlogModel.deleteMany({ 
            KB: KBID
          }).exec();
          for(let k=0; k<KB.descAtt.length; k++) {
            let att = KB.descAtt[k];
            let exist = await fs.access(globalSetting.storageLocation + '/' + att._id.toString());
            if(exist) { await fs.remove(globalSetting.storageLocation + '/' + att._id.toString()); }
            await models.fileModel.deleteOne({ 
              _id: att._id
            }).exec();
          }
          for(let k=0; k<KB.versions.length; k++) {
            let att = KB.versions[k];
            let exist = await fs.access(globalSetting.storageLocation + '/' + att._id.toString());
            if(exist) { await fs.remove(globalSetting.storageLocation + '/' + att._id.toString()); }
            await models.fileModel.deleteOne({ 
              _id: att._id
            }).exec();
          }
          for(let k=0; k<KB.issues.length; k++) {
            let issue = KB.issues[k];
            for(let k=0; k<issue.attachments.length; k++) {
              let att = issue.attachments[k];
              let exist = await fs.access(globalSetting.storageLocation + '/' + att._id.toString());
              if(exist) { await fs.remove(globalSetting.storageLocation + '/' + att._id.toString()); }
              await models.fileModel.deleteOne({ 
                _id: att._id
              }).exec();
            }
            await models.issueModel.deleteOne({ 
              _id: issue._id
            }).exec();
          }
          await models.KBModel.deleteOne({ 
            _id: KBID
          }).exec();
        }
        io.p2p.emit('removeKB', {
          _id: KB._id
        });
        await allChapterListed(KBtag);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '移除知識點',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('addStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        let KBID = new ObjectId(data._id);
        let KB = await models.KBModel.findOne({
          _id: KBID
        }).exec();
        var stage = await models.stageModel.create({ 
          createDate: now,
          modDate: now,
          current: false,
          name: '',
          pmTags: [],
          dueTick: now,
          reviewerTags: [],
          vendorTags: [],
          writerTags: [],
          finalTags: [],
          sort: KB.stages.length,
          coolDown: false,
          KB: KBID,
          objectives: []
        });
        KB.stages.push(stage._id);
        let sortedStages = _.orderBy(KB.stages, ['sort'], ['asc']);
        for(let k=0; k<sortedStages.length; k++) {
          let stage = sortedStages[k];
          stage.sort = k;
        }
        KB.stages = sortedStages;
        let event = await models.eventlogModel.create({
          tick: now,
          type: '知識點操作',
          desc: '新增知識點編輯階段',
          KB: KBID,
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        await KB.save();
        io.p2p.emit('addStage', true);
        await allChapterListed(data.tag);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '新增知識點階段',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('getStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      await getStage(data, disableBroadcast);
    }
    return;
  });

  io.p2p.on('setKBTag', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if(data.tag.length > 0) {
        let KBID = new ObjectId(data._id);
        let userID = new ObjectId(io.p2p.request.session.passport.user);
        let globalSetting = await models.settingModel.findOne({}).exec();
        let currentUser = userID;
        let user =  await models.userModel.findOne({
          _id: currentUser
        }).exec();
        let KB = await models.KBModel.findOne({
          _id: KBID
        }).exec();
        let KBstage = await models.stageModel.findOne({
          current: true,
          KB: KBID
        }).exec();
        let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags, KBstage.pmTags]);
        let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
          return uTag.equals(aTag);
        })).length > 0;
        if(tagCheck) {
          let now = moment().unix();
          await models.KBModel.updateOne({
            _id: KBID
          },{
            tag: data.tag
          });
          let event = await models.eventlogModel.create({
            tick: now,
            type: '知識點操作',
            desc: '設定知識點標籤',
            KB: KBID,
            user: userID
          });
          KB.eventLog.push(event._id);
          await KB.save();
          io.p2p.emit('setKBTag', true);
        } else {
          io.p2p.emit('accessViolation', {
            where: '知識點操作',
            tick: moment().unix(),
            action: '設定知識點標籤',
            loginRequire: true
          });
        }
      } else {
        io.p2p.emit('setKBTag', false);
      }
    }
    return;
  });

  io.p2p.on('addObjective', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let KBID = new ObjectId(data.KB);
        let stageID = new ObjectId(data.stage);
        let now = moment().unix();
        let obj = await models.objectiveModel.create({
          tick: now,
          name: data.name,
          KB: KBID,
          stage: stageID
        });
        let stage = await models.stageModel.findOne({
          _id: stageID
        }).exec();
        stage.objectives.push(obj._id);
        await stage.save();
        let KB = await models.KBModel.findOne({
          _id: KBID
        }).exec();
        let event = await models.eventlogModel.create({
          tick: now,
          type: '知識點操作',
          desc: '新增知識點編輯階段目標',
          KB: KBID,
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        await KB.save();
        await getStage(stageID, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '新增知識點階段目標',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('setObjective', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let KBstage = await models.stageModel.findOne({
        current: true,
        KB: new ObjectId(data.KB)
      }).exec();
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.reviewerTags, KBstage.pmTags,globalSetting.settingTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let KBID = new ObjectId(data.KB);
        let stageID = new ObjectId(data.stage);
        let OID = new ObjectId(data.OID);
        let now = moment().unix();
        let userID = new ObjectId(io.p2p.request.session.passport.user);
        let agree = false;
        let obj = await models.objectiveModel.findOne({
          _id: OID
        }).exec();
        if((!('signUser' in obj)) || obj.signUser === undefined) {
          obj.signUser = userID;
          obj.signTick = now;
          await obj.save();
          agree = true;
        } else {
          delete obj.signUser;
          delete obj.signTick;
          await models.objectiveModel.updateOne(
            {_id: OID},
            {
              $unset: {
                signUser: 1,
                signTick: 1
              }
            }
          );
        }
        let objs = await models.objectiveModel.find({
          stage: stageID,
          signUser: { $exists: false }
        }).exec();
        if(objs.length === 0) {
          let stage = await models.stageModel.findOne({
            _id: stageID
          }).exec();
          let nextStage = await models.stageModel.findOne({
            KB: KBID,
            sort: (stage.sort + 1)
          }).exec();
          stage.passTick = now;
          if(nextStage !== null) {
            stage.current = false;
            nextStage.current = true;
            nextStage.startTick = now;
            await nextStage.save();
          }
          await stage.save();
        }
        let KB = await models.KBModel.findOne({
          _id: KBID
        }).exec();
        let event = await models.eventlogModel.create({
          tick: now,
          type: '知識點操作',
          desc: agree ? '知識點階段目標已同意' : '知識點階段目標已否決',
          KB: KBID,
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        await KB.save();
        await getStage(stageID, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點操作',
          tick: moment().unix(),
          action: '核可／駁回知識點階段目標',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('revokeObjective', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let KBstage = await models.stageModel.findOne({
        current: true,
        KB: new ObjectId(data.KB)
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags, KBstage.pmTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        let KBID = new ObjectId(data.KB);
        let stageID = new ObjectId(data.stage);
        let object = await models.objectiveModel.updateOne({
          _id: new ObjectId(data.oid)
        }, {
          $unset: {
            signUser: 1,
            signTick: 1
          }
        });
        let KB = await models.KBModel.findOne({
          _id: KBID
        }).exec();
        let event = await models.eventlogModel.create({
          tick: now,
          type: '知識點操作',
          desc: '撤回知識點編輯階段單一目標許可',
          KB: KBID,
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        await KB.save();
        await getStage(stageID, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '撤回知識點階段單一目標許可',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('revokeObjectives', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let KBstage = await models.stageModel.findOne({
        current: true,
        KB: new ObjectId(data.KB)
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags, KBstage.pmTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        let KBID = new ObjectId(data.KB);
        let stageID = new ObjectId(data.stage);
        await models.objectiveModel.updateMany({
          stage: stageID
        }, {
          $unset: {
            signUser: 1,
            signTick: 1
          }
        });
        let KB = await models.KBModel.findOne({
          _id: KBID
        }).exec();
        let event = await models.eventlogModel.create({
          tick: now,
          type: '知識點操作',
          desc: '撤回知識點編輯階段目標許可',
          KB: KBID,
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        await KB.save();
        await getStage(stageID, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '撤回知識點階段目標許可',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('removeObjective', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        let OID = new ObjectId(data.OID);
        let KBID = new ObjectId(data.KB);
        let stageID = new ObjectId(data.stage);
        await models.objectiveModel.deleteOne({
          _id: OID
        }).exec();;
        let objs = await models.objectiveModel.find({
          KB: KBID,
          stage: stageID
        }).sort({_id: 1}).exec();
        let stage = await models.stageModel.findOne({
          _id: stageID
        }).exec();
        stage.objectives = objs;
        await stage.save();
        let KB = await models.KBModel.findOne({
          _id: KBID
        }).exec();
        let event = await models.eventlogModel.create({
          tick: now,
          type: '知識點操作',
          desc: '刪除知識點編輯階段目標',
          KB: KBID,
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        await KB.save();
        await getStage(stageID, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '移除知識點階段目標',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('setStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        let sid = new ObjectId(data.stage._id);
        let savedStage = await models.stageModel.findOne({
          _id: sid
        }).exec();
        let KBID = savedStage.KB;
        let currentStages = await models.stageModel.find({
          KB: KBID,
          current: true,
          _id: { $ne: sid }
        }).exec();
        if(data.stage.current) {
          if(currentStages.length >= 1) {
            await models.stageModel.updateMany({
              KB: KBID,
              _id: { $ne: sid }
            }, {
              current: false
            });
          }
        }
        if(data.stage.current) {
          savedStage.startTick = now;
        }
        savedStage.current = data.stage.current;
        savedStage.name = data.stage.name;
        savedStage.modDate = now;
        savedStage.coolDown = data.stage.coolDown;
        savedStage.dueTick = data.stage.dueTick;
        savedStage.pmTags = data.stage.pmTags;
        savedStage.reviewerTags = data.stage.reviewerTags;
        savedStage.vendorTags = data.stage.vendorTags;
        savedStage.writerTags = data.stage.writerTags;
        savedStage.finalTags = data.stage.finalTags;
        await savedStage.save();
        let KB = await models.KBModel.findOne({
          _id: KBID
        }).exec();
        let event = await models.eventlogModel.create({
          tick: now,
          type: '知識點操作',
          desc: '修改知識點編輯階段',
          KB: KBID,
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        if(data.stage.coolDown) {
          event = await models.eventlogModel.create({
            tick: now,
            type: '知識點操作',
            desc: '啟動階段冷靜期',
            KB: KBID,
            user: new ObjectId(io.p2p.request.session.passport.user)
          });
          KB.eventLog.push(event._id);
        }
        await KB.save();
        io.p2p.emit('priviTagUsed', {
          pmTags: data.stage.pmTags,
          reviewerTags: data.stage.reviewerTags,
          vendorTags: data.stage.vendorTags,
          writerTags: data.stage.writerTags,
          finalTags: data.stage.finalTags
        });
        await allChapterListed(data.tag);
        await getStage(savedStage._id, enableBroadcast);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '設定知識點階段',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('removeStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if(data.stage._id !== '') {
        let globalSetting = await models.settingModel.findOne({}).exec();
        let currentUser = new ObjectId(io.p2p.request.session.passport.user);
        let user =  await models.userModel.findOne({
          _id: currentUser
        }).exec();
        let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
        let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
          return uTag.equals(aTag);
        })).length > 0;
        if(tagCheck) {
          var stage = await models.stageModel.findOne({
            _id: new ObjectId(data.stage._id)
          }).exec();
          let KBID = stage.KB;
          let KB = await models.KBModel.findOne({
            _id: KBID
          }).exec();
          stage = await models.stageModel.deleteOne({
            _id: new ObjectId(data.stage._id)
          }).exec();
          let stages = await models.stageModel.find({
            KB: KBID
          }).exec();
          let sortedStages = _.orderBy(stages, ['sort'], ['asc']);
          for(let k=0; k<sortedStages.length; k++) {
            let stage = sortedStages[k];
            stage.sort = k;
          }
          KB.stages = sortedStages;
          await KB.save();
          io.p2p.emit('removeStage', true);
          await allChapterListed(data.tag);
        } else {
          io.p2p.emit('accessViolation', {
            where: '知識點編輯',
            tick: moment().unix(),
            action: '移除知識點階段',
            loginRequire: false
          });
        }
      }
    }
    return;
  });

  io.p2p.on('cloneStages', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        var stages = await models.stageModel.find({
          KB: new ObjectId(data.subject._id)
        }).exec();
        let issues = [];
        if(data.setting.issues) {
          issues = await models.issueModel.find({
            KB: new ObjectId(data.subject._id),
            version:  { $exists: false },
            parent:  { $exists: false }
          }).exec();
        }
        for(let k=0; k<data.target.length; k++) {
          var target = await models.KBModel.findOne({
            _id: new ObjectId(data.target[k])
          }).exec();
          if(data.setting.issues) {
            for(let i=0; i<issues.length; i++) {
              let issue = issues[i];
              newIssue = await models.issueModel.create({
                KB: target._id,
                tick: now,
                title: issue.title,
                position: issue.position,
                body: issue.body,
                user: issue.user,
                status: issue.status,
                star: issue.star,
                sealed: issue.sealed,
                parent: issue.parent
              });
            }
          }
          for(let i=0; i<stages.length; i++) {
            if(_.findIndex(data.setting.stages, (item) => {
              return item === i;
            }) > -1) {
              let stage = stages[i];
              var newStage = await models.stageModel.create({ 
                createDate: now,
                modDate: now,
                current: false,
                startTick: stage.startTick,
                name: "[複製，PM處理中]"+stage.name,
                dueTick: stage.dueTick,
                pmTags: data.setting.roles ? stage.pmTags : [],
                reviewerTags: data.setting.roles ? stage.reviewerTags : [],
                vendorTags: data.setting.roles ? stage.vendorTags: [],
                writerTags: data.setting.roles ? stage.writerTags : [],
                finalTags: data.setting.roles ? stage.finalTags : [],
                coolDown: stage.coolDown,
                sort: target.stages.length - 1,
                KB: target._id
              });
              target.stages.push(newStage);
              if(data.setting.objectives) {
                let objectives = await models.objectiveModel.find({
                  stage: stage._id
                }).exec();
                let objs = [];
                for(let j=0;j<objectives.length;j++) {
                  let obj = objectives[j];
                  let newObj = await models.objectiveModel.create({
                    name: obj.name,
                    stage: newStage._id,
                    KB: target._id,
                    tick: moment().unix()
                  });
                  objs.push(newObj._id);
                }
                await models.stageModel.updateOne({ _id: newStage._id }, { objectives: objs });
              }
            }
          }
          let sortedStages = _.orderBy(target.stages, ['sort'], ['asc']);
          for(let k=0; k<sortedStages.length; k++) {
            let stage = sortedStages[k];
            stage.sort = k;
          }
          target.stages = sortedStages;
          let event = await models.eventlogModel.create({
            tick: now,
            type: '知識點操作',
            desc: '複製知識點編輯階段',
            KB: target._id,
            user: new ObjectId(io.p2p.request.session.passport.user)
          });
          target.eventLog.push(event._id);
          await target.save();
        }
        io.p2p.emit('cloneStages', true);
        await allChapterListed(data.tag);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '複製知識點',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('getKBAttachment', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        var collection = await models.KBModel.findOne({
          _id: data
        })
        .populate('descAtt')
        .exec();
        io.p2p.emit('getKBAttachment', collection.descAtt);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點操作',
          tick: moment().unix(),
          action: '取得知識點說明',
          loginRequire: false
        });
      }
    }
    return;
  });

  io.p2p.on('listDashBoard', async () => {
    if(io.p2p.request.session.status.type === 3) {
      let userID = new ObjectId(io.p2p.request.session.passport.user);
      let user = await models.userModel.findOne({
        _id: userID
      }).exec();
      let queryObj = [
        {
          $lookup: {
            from: 'stageDB',
            localField: 'stages',
            foreignField: '_id',
            as: 'stages'
          }
        },
        {
          $lookup: {
            from: 'chapterDB',
            localField: 'chapter',
            foreignField: '_id',
            as: 'chapter'
          },
        },
        {
          $addFields: {
            tempArray: {
              $concatArrays:['$stages.pmTags', '$stages.vendorTags', '$stages.reviewerTags', '$stages.writerTags', '$stages.finalTags']
            }
          }
        },
        {
          $addFields: {
            concactArray: {
              $reduce: {
                input: '$tempArray',
                initialValue: [],
                in: { $concatArrays : ["$$value", "$$this"]}
              }
            }
          }
        },
        {
          $match: {
            concactArray: {
              $in: user.tags
            }
          }
        },
        {
          $group: {
            _id: '$_id',
            descAtt: { $first: '$descAtt'},
            tag: { $first: '$tag'},
            issues: { $first: '$issues'},
            stages: { $first: '$stages'},
            createDate: { $first: '$createDate'},
            modDate: { $first: '$modDate'},
            title: { $first: '$title'},
            sort: { $first: '$sort'},
            user: { $first: '$user'},
            desc: { $first: '$desc'},
            textbook: { $first: '$textbook'},
            chapter: { $first: '$chapter'},
            versions: { $first: '$versions'}
          }
        }
      ];
      var collection = await models.KBModel.aggregate(queryObj);
      io.p2p.emit('listDashBoard', collection);
    }
    return;
  });

  io.p2p.on('pointerStageTags', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([globalSetting.settingTags, globalSetting.projectTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck) {
        let now = moment().unix();
        let pointer = data.stagePointer > 0 ? data.stagePointer - 1 : 0;
        for(let i=0; i<data.KBs.length; i++) {
          let KBID = data.KBs[i];
          let KB = await models.KBModel.findOne({
            _id: new ObjectId(KBID)
          }).exec();
          if(KB.stages.length > 0) {
            let stageID = KB.stages[pointer];
            let savedStage = await models.stageModel.findOne({
              _id: new ObjectId(stageID)
            }).exec();
            savedStage.pmTags = _.unionWith(savedStage.pmTags, data.pmTags, (sTag, dTag) => {
              return (new ObjectId(sTag)).equals(new ObjectId(dTag));
            });
            savedStage.reviewerTags = _.unionWith(savedStage.reviewerTags, data.reviewerTags, (sTag, dTag) => {
              return (new ObjectId(sTag)).equals(new ObjectId(dTag));
            });
            savedStage.vendorTags = _.unionWith(savedStage.vendorTags, data.vendorTags, (sTag, dTag) => {
              return (new ObjectId(sTag)).equals(new ObjectId(dTag));
            });
            savedStage.writerTags = _.unionWith(savedStage.writerTags, data.writerTags, (sTag, dTag) => {
              return (new ObjectId(sTag)).equals(new ObjectId(dTag));
            });
            savedStage.finalTags = _.unionWith(savedStage.finalTags, data.finalTags, (sTag, dTag) => {
              return (new ObjectId(sTag)).equals(new ObjectId(dTag));
            });
            await savedStage.save();
            let event = await models.eventlogModel.create({
              tick: now,
              type: '知識點操作',
              desc: '快速指派用戶權限群組',
              KB: KBID,
              user: currentUser
            });
            KB.eventLog.push(event._id);
            await KB.save();
          }
        }
        io.p2p.emit('priviTagUsed', {
          pmTags: data.pmTags,
          reviewerTags: data.reviewerTags,
          vendorTags: data.vendorTags,
          writerTags: data.writerTags,
          finalTags: data.finalTags
        });
        io.p2p.emit('pointerStageTags');
        await allChapterListed(data.tag);
      } else {
        io.p2p.emit('accessViolation', {
          where: '知識點編輯',
          tick: moment().unix(),
          action: '快速指定知識點用戶權限',
          loginRequire: false
        });
      }
    }
  });

  io.p2p.on('dashBoardEventLog', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let KBs = _.map(data, (item) => {
        return new ObjectId(item);
      });
      var queryObj = [
        {
          $match: {
            KB: {
              $in: KBs
            }
          }
        },
        {
          $lookup: {
            from: 'userDB',
            localField: 'user',
            foreignField: '_id',
            as: 'user'
          },
        },
        { $unwind: { "path": "$user", "preserveNullAndEmptyArrays": true } },
        {
          $sort: {
            tick: -1
          }
        },
        {
          $group: {
            _id: '$KB',
            events: {
              $push:   {
                _id: "$_id",
                tick: "$tick",
                type: "$type",
                desc: "$desc",
                KB: "$KB",
                user: {
                  _id: "$user._id",
                  types: "$user.types",
                  name: "$user.name",
                  unit: "$user.unit",
                  email: "$user.email",
                }
              }
            }
          }
        },
        {
          $project: {
            _id: 1,
            events: { $slice: ["$events", 3] }
          }
        }
      ]
      var eventLogs = await models.eventlogModel.aggregate(queryObj);
      io.p2p.emit('dashBoardEventLog', eventLogs);
    }
    return;
  });

  io.p2p.on('dashBoardUnreaded', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let userID = new ObjectId(io.p2p.request.session.passport.user);
      let KBs = _.map(data, (item) => {
        return new ObjectId(item);
      });
      let readedIssues = await models.readedIssueModel.aggregate([
        {
          $match: {
            user: userID
          }
        },
        {
          $group: {
            _id: null,
            issues: { $push: '$issue' }
          }
        }
      ]);
      let readed = readedIssues.length > 0 ? readedIssues[0].issues : [];
      let unreadedCount = await models.issueModel.aggregate([
        {
          $match: {
            KB: {
              $in: KBs
            },
            _id: {
              $nin: readed
            }
          }
        },
        {
          $group: {
            _id: '$KB',
            numberOfissue: { $push: '$_id' }
          }
        },
        {
          $project: {
            _id: 1,
            numberOfissue: { $size: '$numberOfissue' }
          }
        }
      ]);
      io.p2p.emit('dashBoardUnreaded', unreadedCount);
    }
    return;
  });

  io.p2p.on('participantStatstics', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let statistics = [];
      let acceptedKBs = [];
      let participantsIDs = [];
      let user = await models.userModel.findOne({
        _id: new ObjectId(io.p2p.request.session.passport.user)
      }).exec();
      let requestKBs = _.map(data, (KB) => {
        return new ObjectId(KB);
      });
      let checkedKB = await models.stageModel.aggregate([
        {
          $match: {
            KB: {
              $in: requestKBs
            },
            finalTags: {
              $in: user.tags
            }
          }
        },
        {
          $group: {
            _id: 'x',
            KBs: {
              $push: '$KB'
            }
          }
        }
      ]);
      if(checkedKB.length > 0) {
      acceptedKBs = checkedKB[0].KBs;
      let allParticipants = await models.stageModel.aggregate([
        {
          $match: {
            KB: {
              $in: acceptedKBs
            },
            finalTags: {
              $in: user.tags
            }
          }
        },
        {
          $unwind: {
            path: '$pmTags',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$reviewerTags',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$vendorTags',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$writerTags',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$finalTags',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'userDB',
            let: { reviewerTags: '$reviewerTags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$$reviewerTags", "$tags"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  unit: 1
                }
              }
            ],
            as: 'reviewerUsers'
          }
        },
        {
          $lookup: {
            from: 'userDB',
            let: { pmTags: '$pmTags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$$pmTags", "$tags"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  unit: 1
                }
              }
            ],
            as: 'pmUsers'
          }
        },
        {
          $lookup: {
            from: 'userDB',
            let: { vendorTags: '$vendorTags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$$vendorTags", "$tags"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  unit: 1
                }
              }
            ],
            as: 'vendorUsers'
          }
        },
        {
          $lookup: {
            from: 'userDB',
            let: { writerTags: '$writerTags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$$writerTags", "$tags"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  unit: 1
                }
              }
            ],
            as: 'writerUsers'
          }
        },
        {
          $lookup: {
            from: 'userDB',
            let: { finalTags: '$finalTags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$$finalTags", "$tags"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  unit: 1
                }
              }
            ],
            as: 'finalUsers'
          }
        },
        {
          $project: {
            participants: {
              $setUnion: ['$finalUsers', '$pmUsers', '$writerUsers', '$vendorUsers', '$reviewerUsers']
            }
          }
        },
        {
          $unwind: {
            path: '$participants',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $replaceRoot: {
            newRoot: '$participants'
          }
        }
      ]);
      participantsIDs = _.map(allParticipants, '_id');
      statistics = await models.userModel.aggregate([
        {
          $match: {
            _id: {
              $in: participantsIDs
            }
          }
        },
        {
          $unwind: {
            path: '$tags',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'stageDB',
            let: { tags: '$tags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$KB", acceptedKBs] }
                }
              },
              {
                $match:
                {
                  $expr:
                    { $in: ["$$tags", "$finalTags"] }
                }
              },
              {
                $lookup: {
                  from: 'KBDB',
                  foreignField: '_id',
                  localField: 'KB',
                  as: 'KB'
                }
              },
              {
                $unwind: {
                  path: '$KB',
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $addFields: {
                  KBtitle: '$KB.title'
                }
              },
              {
                $project: {
                  _id: 1,
                  KBtitle: 1,
                  name: 1
                }
              }
            ],
            as: 'finalStages'
          }
        },
        {
          $lookup: {
            from: 'stageDB',
            let: { tags: '$tags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$KB", acceptedKBs] }
                }
              },
              {
                $match:
                {
                  $expr:
                    { $in: ["$$tags", "$vendorTags"] }
                }
              },
              {
                $lookup: {
                  from: 'KBDB',
                  foreignField: '_id',
                  localField: 'KB',
                  as: 'KB'
                }
              },
              {
                $unwind: {
                  path: '$KB',
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $addFields: {
                  KBtitle: '$KB.title'
                }
              },
              {
                $project: {
                  _id: 1,
                  KBtitle: 1,
                  name: 1
                }
              }
            ],
            as: 'vendorStages'
          }
        },
        {
          $lookup: {
            from: 'stageDB',
            let: { tags: '$tags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$KB", acceptedKBs] }
                }
              },
              {
                $match:
                {
                  $expr:
                    { $in: ["$$tags", "$writerTags"] }
                }
              },
              {
                $lookup: {
                  from: 'KBDB',
                  foreignField: '_id',
                  localField: 'KB',
                  as: 'KB'
                }
              },
              {
                $unwind: {
                  path: '$KB',
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $addFields: {
                  KBtitle: '$KB.title'
                }
              },
              {
                $project: {
                  _id: 1,
                  KBtitle: 1,
                  name: 1
                }
              }
            ],
            as: 'writerStages'
          }
        },
        {
          $lookup: {
            from: 'stageDB',
            let: { tags: '$tags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$KB", acceptedKBs] }
                }
              },
              {
                $match:
                {
                  $expr:
                    { $in: ["$$tags", "$reviewerTags"] }
                }
              },
              {
                $lookup: {
                  from: 'KBDB',
                  foreignField: '_id',
                  localField: 'KB',
                  as: 'KB'
                }
              },
              {
                $unwind: {
                  path: '$KB',
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $addFields: {
                  KBtitle: '$KB.title'
                }
              },
              {
                $project: {
                  _id: 1,
                  KBtitle: 1,
                  name: 1
                }
              }
            ],
            as: 'reviewerStages'
          }
        },
        {
          $lookup: {
            from: 'stageDB',
            let: { tags: '$tags' },
            pipeline: [
              {
                $match:
                {
                  $expr:
                    { $in: ["$KB", acceptedKBs] }
                }
              },
              {
                $match:
                {
                  $expr:
                    { $in: ["$$tags", "$pmTags"] }
                }
              },
              {
                $lookup: {
                  from: 'KBDB',
                  foreignField: '_id',
                  localField: 'KB',
                  as: 'KB'
                }
              },
              {
                $unwind: {
                  path: '$KB',
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $addFields: {
                  KBtitle: '$KB.title'
                }
              },
              {
                $project: {
                  _id: 1,
                  KBtitle: 1,
                  name: 1
                }
              }
            ],
            as: 'pmStages'
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            unit: 1,
            finalStages: 1,
            vendorStages: 1,
            writerStages: 1,
            pmStages: 1,
            reviewerStages: 1
          }
        }
      ]);
      }
      io.p2p.emit('participantStatstics', {
        statistics: statistics,
        proceedKBs: acceptedKBs,
        proceedUsers: participantsIDs
      });
    }
    return;
  });

  io.p2p.on('getKBVersions', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let KB = await models.KBModel.aggregate([
        {
          $match: {
            _id: new ObjectId(data)
          }
        },
        {
          $lookup: {
            from: 'fileDB',
            localField: 'versions',
            foreignField: '_id',
            as: 'versions'
          }
        },
        {
          $unwind: {
            path: '$versions',
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $project: {
            versions: 1
          }
        },
        {
          $sort: {
            'versions.tick': -1
          }
        },
        {
          $group: {
            _id: '$_id',
            versions: {
              $push: '$versions'
            }
          }
        }
      ]);
      let returnArr = KB.length > 0 ? KB[0].versions : [];
      io.p2p.emit('getKBVersions', returnArr);
    }
    return;
  });

  io.p2p.on('getlatestVersions', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let user = await models.userModel.findOne({
        _id: new ObjectId(io.p2p.request.session.passport.user)
      }).exec();
      let requestKBs = _.map(data.KBs, (KB) => {
        return new ObjectId(KB);
      });
      let checkedKBs = await models.stageModel.aggregate([
        {
          $match: {
            KB: {
              $in: requestKBs
            },
            $or: [ 
              {
                finalTags:
                {
                  $in: user.tags
                }
              },
              {
                pmTags: 
                {
                  $in: user.tags
                }
              }
            ]
          }
        },
        {
          $group: {
            _id: 'x',
            KBs: {
              $push: '$KB'
            }
          }
        }
      ]);
      let acceptedKBs = checkedKBs[0].KBs;
      let latestVersions = await models.KBModel.aggregate([
        {
          $match: {
            _id: {
              $in: acceptedKBs
            }
          }
        },
        {
          $lookup: {
            from: 'fileDB',
            localField: 'versions',
            foreignField: '_id',
            as: 'versions'
          }
        },
        {
          $unwind: {
            path: '$versions',
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $sort: {
            'versions.tick': -1
          }
        },
        {
          $addFields: {
            'versions.title': '$title'
          }
        },
        {
          $group: {
            _id: '$_id',
            versions: {
              $push: '$versions'
            }
          }
        },
        {
          $project: {
            versions: {
              $slice: [ "$versions", data.limit ]
            }
          }
        },
        {
          $unwind: {
            path: '$versions',
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $replaceRoot: {
            newRoot: '$versions'
          }
        }
      ]);
      io.p2p.emit('getlatestVersions', latestVersions);
    }
    return;
  });

  return router;
}