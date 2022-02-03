import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';
import fs from 'fs-extra';
import TurndownService from 'turndown';
const turndownService = new TurndownService();
import _ from 'lodash';
export default function (io, models) {

  let getfeedbackList = async() => {
    var collection = await models.feedbackModel.find({
      parent: undefined
    }).sort({
      status: 1,
      tick: -1,
      rating: -1
    })
    .populate('users', '-password -lineToken -lineCode')
    .populate('user', '-password -lineToken -lineCode')
    .populate('rating')
    .populate('attachments')
    .exec();
    io.p2p.emit('getfeedbackList', collection);
  }

  let getFeedback = async(data) => {
    var main = await models.feedbackModel.findOne({
      _id: new ObjectId(data)
    }).sort({tick: -1})
    .populate('users', '-password -lineToken -lineCode')
    .populate('user', '-password -lineToken -lineCode')
    .populate('rating')
    .populate('attachments')
    .exec();
    var collection = await models.feedbackModel.find({
      parent: new ObjectId(data)
    }).sort({tick: 1})
    .populate('users', '-password -lineToken -lineCode')
    .populate('user', '-password -lineToken -lineCode')
    .populate('rating')
    .populate('attachments')
    .exec();
    io.p2p.emit('getFeedback', {
      main: main,
      collections: collection
    });
  }

  io.p2p.on('getfeedbackList', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      await getfeedbackList();
    }
    return;
  });

  io.p2p.on('getFeedback', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      await getFeedback(data);
    }
    return;
  });

  io.p2p.on('editFeedback', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var feedback = await models.feedbackModel.findOne({
        _id: data
      }).sort({tick: -1})
      .exec();
      io.p2p.emit('editFeedback', feedback);
    }
    return;
  });

  io.p2p.on('setFeedback', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var feedback = await models.feedbackModel.findOne({
        _id: new ObjectId(data._id)
      }).exec();
      let currentUser = await models.userModel.findOne({
        _id: new ObjectId(io.p2p.request.session.passport.user)
      }).exec();
      if((_.intersectionWith(feedback.users, [currentUser._id], (fUser, cUser) => {
          return fUser.equals(cUser);
      })).length > 0) {
        if(data.title !== null) { feedback.title = data.title; }
        feedback.parent = data.parent === undefined || data.parent === null ? undefined : new ObjectId(data.parent);
        feedback.body = turndownService.turndown(data.body);
        feedback.type = data.type;
        feedback.tick = dayjs().unix();
        await feedback.save();
        io.p2p.emit('setFeedback', true);
        let mainThread = feedback.parent === undefined ? new ObjectId(data._id) : new ObjectId(feedback.parent);
        await getFeedback(mainThread);
        await getfeedbackList();
      }
    }
    return;
  });

  io.p2p.on('setAgree', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      let currentUser = await models.userModel.findOne({
        _id: new ObjectId(io.p2p.request.session.passport.user)
      }).exec();
      if((_.intersectionWith(globalSetting.settingTags, currentUser.tags, (gUser, cUser) => {
          return gUser.equals(cUser);
      })).length > 0) {
        let userID = new ObjectId(io.p2p.request.session.passport.user);
        var feedback = await models.feedbackModel.findOne({
          _id: new ObjectId(data)
        })
        .populate('users', '-password -lineToken -lineCode')
        .populate('user', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        if(_.find(feedback.users, (user) => {
          return (user._id).equals(userID);
        }) === undefined) {
          feedback.users = _.uniqWith(_.flatten([feedback.users, [userID]]), (aTag, bTag) => {
            return aTag.equals(bTag);
          });
        } else {
          if(feedback.users.length > 1) {
            feedback.users = _.differenceWith(feedback.users, [userID], (aTag, bTag) => {
              return aTag.equals(bTag);
            });
          }
        }
        await feedback.save();
        io.p2p.emit('setAgree', true);
        await getFeedback(data);
        await getfeedbackList();
      }
    }
    return;
  });

  io.p2p.on('setRating', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var feedback = await models.feedbackModel.findOne({
        _id: new ObjectId(data._id)
      })
      .populate('users', '-password -lineToken -lineCode')
      .populate('user', '-password -lineToken -lineCode')
      .populate('rating')
      .populate('attachments')
      .exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      if(data.status) {
        feedback.rating = _.uniqWith(_.flatten([feedback.rating, [currentUser]]), (aTag, bTag) => {
          return aTag.equals(bTag);
        });
      } else {
        feedback.rating = _.differenceWith(feedback.rating, [currentUser], (aTag, bTag) => {
            return aTag.equals(bTag);
          });
      }
      await feedback.save();
      io.p2p.emit('setRating', true);
      await getFeedback(data._id);
      await getfeedbackList();
    }
    return;
  });

  io.p2p.on('setStatus', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var feedback = await models.feedbackModel.findOne({
        _id: new ObjectId(data)
      })
      .populate('users', '-password -lineToken -lineCode')
      .populate('user', '-password -lineToken -lineCode')
      .populate('rating')
      .populate('attachments')
      .exec();
      let currentUser = await models.userModel.findOne({
        _id: new ObjectId(io.p2p.request.session.passport.user)
      }).exec();
      if((_.intersectionWith(feedback.users, [currentUser._id], (fUser, cUser) => {
          return fUser.equals(cUser);
      })).length > 0) {
        feedback.status = !feedback.status;
        await feedback.save();
        io.p2p.emit('setStatus', true);
        await getFeedback(data);
        await getfeedbackList();
      }
    }
    return;
  });

  io.p2p.on('removeFeedback', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let errorlog = 0;
      var collections = await models.feedbackModel.find({
        parent: new ObjectId(data)
      }).exec();
      let globalSetting = await models.settingModel.findOne({}).exec();
      for(let i = 0; i < collections.length; i++) {
        let feedback = collections[i];
        for(let i=0;i<feedback.attachments.length;i++) {
          try {
            let file = feedback.attachments[i];
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
      var feedback = await models.feedbackModel.findOne({
        _id: new ObjectId(data)
      }).exec();
      for(let i=0;i<feedback.attachments.length;i++) {
        try {
          let file = feedback.attachments[i];
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
        await models.feedbackModel.deleteMany({
          parent: new ObjectId(data)
        }).exec();
        await models.feedbackModel.deleteOne({
          _id: new ObjectId(data)
        }).exec();
        io.p2p.emit('removeFeedback', true);
        await getfeedbackList();
      } else {
        io.p2p.emit('removeFeedbackError', errorlog);
      }
    }
    return;
  });

  io.p2p.on('addFeedback', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let userID = new ObjectId(io.p2p.request.session.passport.user);
      var feedback = await models.feedbackModel.create({ 
        tick: dayjs().unix(),
        attachments: [],
        user: userID,
        users: [
          userID
        ],
        parent: data === undefined || data === null ? undefined : new ObjectId(data),
        status: false
      });
      io.p2p.emit('addFeedback', {
        _id: feedback._id,
        parent: feedback.parent
      });
    }
    return;
  });

  io.p2p.on('getfeedbackAttachment', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.feedbackModel.findOne({
        _id: data
      })
      .populate('attachments')
      .exec();
      io.p2p.emit('getfeedbackAttachment', collection.attachments);
    }
    return;
  });

  return router;
}
