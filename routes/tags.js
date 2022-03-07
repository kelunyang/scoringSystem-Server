import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';
import _ from 'lodash';

export default function (io, models) {
  let getTags = async () => {
    let tags = [];
    if('passport' in io.p2p.request.session) {
      if('user' in io.p2p.request.session.passport) {
        let setting = await models.settingModel.findOne({}).exec();
        let user =  await models.userModel.findOne({
          _id: new ObjectId(io.p2p.request.session.passport.user)
        }).exec();
        let settingIncluded = _.intersectionWith(user.tags, setting.settingTags, (uTag, sTag) => {
          return uTag.equals(sTag);
        });
        tags = await models.tagModel.find({}).exec();
        if(settingIncluded.length === 0) {
          tags = _.differenceWith(tags, setting.settingTags, (tag, sTag) => {
            return tag._id.equals(sTag);
          });
          let projectIncluded = _.intersectionWith(user.tags, setting.projectTags, (uTag, pTag) => {
            return uTag.equals(pTag);
          });
          if(projectIncluded.length === 0) {
            tags = _.differenceWith(tags, setting.projectTags, (tag, pTag) => {
              return tag._id.equals(pTag);
            });
          }
          let userIncluded = _.intersectionWith(user.tags, setting.userTags, (uTag, sTag) => {
            return uTag.equals(sTag);
          });
          if(userIncluded.length === 0) {
            tags = _.differenceWith(tags, setting.userTags, (tag, uTag) => {
              return tag._id.equals(uTag);
            });
          }
        }
      }
    }
    io.p2p.emit('getTags', tags);
    return;
  }
  io.p2p.on('getTags', async (data) => {
    await getTags();
  });

  io.p2p.on('addTag', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let tag = await models.tagModel.find({
        name: data
      }).exec();
      if(tag.length === 0) {
        await models.tagModel.create({ 
          tick: dayjs().unix(),
          modTick: 0,
          visibility: true,
          name: data,
        });
        io.p2p.emit('addTag', true);
        await getTags();
      } else {
        io.p2p.emit('addTag', false);
        await getTags();
      }
    }
    return;
  });

  io.p2p.on('setTagname', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let now = dayjs().unix();
      let tag = await models.tagModel.findOne({ 
        _id: new ObjectId(data._id)
      }).exec();
      tag.modTick = now;
      tag.name = data.name;
      await tag.save();
      io.p2p.emit('setTag', true);
      await getTags();
    }
    return;
  });

  io.p2p.on('setTagvis', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let now = dayjs().unix();
      let tags = _.map(data.tags, (item) => {
        return new ObjectId(item);
      });
      let tag = await models.tagModel.updateMany({
        _id: { $in: tags }
      }, {
        visibility: data.vis,
        modTick: now
      });
      io.p2p.emit('setTagvis', true);
      await getTags();
    }
    return;
  });

  io.p2p.on('checkTagUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let tags = _.map(data, (item) => {
        return new ObjectId(item);
      });
      let tagCount = await models.userModel.aggregate([
        {
          $match: {
            tags: { $in: tags }
          }
        },
        {
          $group: {
            _id: '$tags',
            count: { $addToSet: '$_id' }
          }
        },
        {
          $unwind: {
            path: '$_id',
            preserveNullAndEmptyArrays: false
          }
        }
      ]).exec();
      io.p2p.emit('checkTagUsers', tagCount);
    }
    return;
  });

  io.p2p.on('getsiteAdminUsers', async (data) => {
    let setting = await models.settingModel.findOne({}).exec();
    if(io.p2p.request.session.status.type === 3) {
      let user =  await models.userModel.findOne({
        _id: new ObjectId(io.p2p.request.session.passport.user)
      }).exec();
      let autherizedTags = _.uniqWith(_.flatten([setting.serviceTags, setting.settingTags]), (aTag, bTag) => {
        return aTag.equals(bTag);
      });
      let adminUsers = await models.userModel.find({
        tags: { $in: autherizedTags }
      }).exec();
      io.p2p.emit('getsiteAdminUsers', adminUsers);
    }
    return;
  });

  return router;
}
