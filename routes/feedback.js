const express = require('express');
const router = express.Router();
const moment = require('moment');
const { ObjectId } = require('mongodb');
const fs = require('fs-extra');
const TurndownService = require('turndown')

const turndownService = new TurndownService();

module.exports = (io, models) => {
  io.p2p.on('getfeedbackList', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var collection = await models.feedbackModel.find({
        parent: undefined
      }).sort({
        status: -1,
        rating: -1,
        tick: -1
      })
      .populate('users', '-password -lineToken -lineCode')
      .populate('rating')
      .populate('attachments')
      .exec();
      io.p2p.emit('getfeedbackList', collection);
    }
  });

  io.p2p.on('getFeedback', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var main = await models.feedbackModel.findOne({
        _id: new ObjectId(data)
      }).sort({tick: -1})
      .populate('users', '-password -lineToken -lineCode')
      .populate('rating')
      .populate('attachments')
      .exec();
      var collection = await models.feedbackModel.find({
        parent: new ObjectId(data)
      }).sort({tick: 1})
      .populate('users', '-password -lineToken -lineCode')
      .populate('rating')
      .populate('attachments')
      .exec();
      io.p2p.emit('getFeedback', {
        main: main,
        collections: collection
      });
    }
  });

  io.p2p.on('editFeedback', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var feedback = await models.feedbackModel.findOne({
        _id: data
      }).sort({tick: -1})
      .exec();
      io.p2p.emit('editFeedback', feedback);
    }
  });

  io.p2p.on('setFeedback', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      var feedback = await models.feedbackModel.findOne({
        _id: new ObjectId(data._id)
      }).exec();
      if(feedback.users.some((item) => {
        return (new ObjectId(io.p2p.request.session.passport.user)).equals(new ObjectId(item));
      })) {
        if(data.title !== null) { feedback.title = data.title; }
        feedback.parent = data.parent === undefined || data.parent === null ? undefined : new ObjectId(data.parent);
        feedback.body = turndownService.turndown(data.body);
        feedback.type = data.type;
        feedback.tick = moment().unix();
        await feedback.save();
        io.p2p.emit('setFeedback', true);
        let mainThread = feedback.parent === undefined ? new ObjectId(data._id) : new ObjectId(feedback.parent)
        var main = await models.feedbackModel.findOne({
          _id: new ObjectId(mainThread)
        })
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        var collection = await models.feedbackModel.find({
          parent: new ObjectId(mainThread)
        }).sort({tick: 1})
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        io.p2p.emit('getFeedback', {
          main: main,
          collections: collection
        });
        collection = await models.feedbackModel.find({
          parent: undefined
        }).sort({
          status: -1,
          rating: -1,
          tick: -1
        })
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        io.p2p.emit('getfeedbackList', collection);
      }
    }
  });

  io.p2p.on('setAgree', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      if(globalSetting.settingTags.some((item) => {
        return (new ObjectId(io.p2p.request.session.passport.user)).equals(new ObjectId(item));
      })) {
        var feedback = await models.feedbackModel.findOne({
          _id: new ObjectId(data._id)
        }).exec();
        let users = new Set(feedback.users);
        users.add(new ObjectId(io.p2p.request.session.passport.user));
        feedback.users = Array.from(users);
        await feedback.save();
        io.p2p.emit('setAgree', true);
        var main = await models.feedbackModel.findOne({
          _id: new ObjectId(data._id)
        })
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        var collection = await models.feedbackModel.find({
          parent: new ObjectId(data._id)
        }).sort({tick: 1})
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        io.p2p.emit('getFeedback', {
          main: main,
          collections: collection
        });
        collection = await models.feedbackModel.find({
          parent: undefined
        }).sort({
          status: -1,
          rating: -1,
          tick: -1
        })
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        io.p2p.emit('getfeedbackList', collection);
      }
    }
  });

  io.p2p.on('setRating', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var feedback = await models.feedbackModel.findOne({
        _id: new ObjectId(data._id)
      }).exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      if(data.status) {
        let users = new Set(feedback.rating);
        users.add(currentUser);
        feedback.rating = Array.from(users);
      } else {
        feedback.rating = feedback.rating.filter((item) => {
          return !currentUser.equals(item);
        })
      }
      await feedback.save();
      io.p2p.emit('setRating', true);
      var main = await models.feedbackModel.findOne({
        _id: new ObjectId(data._id)
      })
      .populate('users', '-password -lineToken -lineCode')
      .populate('rating')
      .populate('attachments')
      .exec();
      var collection = await models.feedbackModel.find({
        parent: new ObjectId(data._id)
      }).sort({tick: 1})
      .populate('users', '-password -lineToken -lineCode')
      .populate('rating')
      .populate('attachments')
      .exec();
      io.p2p.emit('getFeedback', {
        main: main,
        collections: collection
      });
      collection = await models.feedbackModel.find({
        parent: undefined
      }).sort({
        status: -1,
        rating: -1,
        tick: -1
      })
      .populate('users', '-password -lineToken -lineCode')
      .populate('rating')
      .populate('attachments')
      .exec();
      io.p2p.emit('getfeedbackList', collection);
    }
  });

  io.p2p.on('setStatus', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var feedback = await models.feedbackModel.findOne({
        _id: new ObjectId(data)
      }).exec();
      if(feedback.users.some((item) => {
        return (new ObjectId(io.p2p.request.session.passport.user)).equals(new ObjectId(item));
      })) {
        feedback.status = !feedback.status;
        await feedback.save();
        io.p2p.emit('setStatus', true);
        var main = await models.feedbackModel.findOne({
          _id: new ObjectId(data)
        })
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        var collection = await models.feedbackModel.find({
          parent: new ObjectId(data)
        }).sort({tick: 1})
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        io.p2p.emit('getFeedback', {
          main: main,
          collections: collection
        });
        collection = await models.feedbackModel.find({
          parent: undefined
        }).sort({
          status: -1,
          rating: -1,
          tick: -1
        })
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        io.p2p.emit('getfeedbackList', collection);
      }
    }
  });

  io.p2p.on('removeFeedback', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let errorlog = 0;
      var collections = await models.feedbackModel.find({
        parent: new ObjectId(data)
      }).exec();
      for(let i = 0; i < collections.length; i++) {
        let feedback = collections[i];
        for(let i=0;i<feedback.attachments.length;i++) {
          try {
            let file = feedback.attachments[i];
            await fs.remove('/var/www/frontend/storages/' + file);
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
          await fs.remove('/var/www/frontend/storages/' + file);
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
        var collection = await models.feedbackModel.find({
          parent: undefined
        }).sort({
          status: -1,
          rating: -1,
          tick: -1
        })
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        io.p2p.emit('getfeedbackList', collection);
      } else {
        io.p2p.emit('removeFeedbackError', errorlog);
      }
    }
  });

  io.p2p.on('addFeedback', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      var feedback = await models.feedbackModel.create({ 
        tick: moment().unix(),
        attachments: [],
        users: [
          new ObjectId(io.p2p.request.session.passport.user)
        ],
        parent: data === undefined || data === null ? undefined : new ObjectId(data),
        status: true
      });
      io.p2p.emit('addFeedback', {
        _id: feedback._id,
        parent: feedback.parent
      });
    }
  });

  return router;
}
