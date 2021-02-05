let express = require('express');
let router = express.Router();
let moment = require('moment');
const { ObjectId } = require('mongodb');

module.exports = (io, models) => {
  io.p2p.on('getGlobalSettings', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    let auth = authMapping['getGlobalSettings'];
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).populate({
        path: 'settingTags',
        path: 'userTags',
        path: 'projectTags'
      }).exec();
      io.p2p.emit('getGlobalSettings', globalSetting);
    } else {
      io.p2p.emit('accessViolation', {
        where: auth.where,
        action: auth.action,
        tick: moment().unix(),
        loginRequire: auth.loginRequire
      });
    }
  });

  io.p2p.on('getRobotSetting', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let robotSetting = await models.robotModel.findOne({}).sort({_id: 1}).exec();
      io.p2p.emit('getRobotSetting', robotSetting);
    }
  });

  io.p2p.on('getProjectSetting', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let projectSetting = await models.projectModel.findOne({}).sort({_id: 1}).exec();
      io.p2p.emit('getProjectSetting', projectSetting);
    }
  });
  io.p2p.on('setsettingTags', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    let tagidArray = new Array();
    for (let i=0; i<data.length; i++) {
      let tag = await models.tagModel.findOne({
        name: data[i]
      }).sort({_id: 1}).exec();
      tagidArray.push(ObjectId(tag._id));
      if(tag === null) {
        tag = await models.tagModel.create({ 
          name: data[i],
          tick: moment().unix()
        });
        tagidArray.push(ObjectId(tag._id));
      }
    }
    let globalSetting = await schemaObj.settingModel.findOne({}).sort({_id: 1}).exec();
    globalSetting.settingTags = tagidArray;
    globalSetting.save();
    io.p2p.emit('refreshGlobalSetting');
  });
  return router;
}
