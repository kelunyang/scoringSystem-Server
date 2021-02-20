let express = require('express');
let router = express.Router();
let moment = require('moment');
let axios = require('axios');
let qs = require('qs');
const { ObjectId } = require('mongodb');

module.exports = (io, models) => {
  io.p2p.on('getGlobalSettings', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    let auth = authMapping['getGlobalSettings'];
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
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
  
  io.p2p.on('setSetting', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      let gSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      gSetting.settingTags = data.selectedSysTags.length > 0 ? data.selectedSysTags : gSetting.settingTags;
      gSetting.userTags = data.selectedUsrTags.length > 0 ? data.selectedUsrTags : gSetting.userTags;
      gSetting.projectTags = data.selectedflowTags.length > 0 ? data.selectedflowTags : gSetting.projectTags;
      gSetting.robotTag = data.selectedrobotTag === '' ? gSetting.robotTag : data.selectedrobotTag;
      gSetting.tick = moment().unix();
      await gSetting.save();
      let rSetting = await models.robotModel.findOne({}).sort({_id: 1}).exec();
      rSetting.mailAccount = data.mailAccount;
      rSetting.mailPassword = data.mailPassword;
      rSetting.nobodyAccount = data.nobodyAccount === '' ? rSetting.nobodyAccount : data.nobodyAccount;
      rSetting.PatrolAccount = data.PatrolAccount === '' ? rSetting.PatrolAccount : data.PatrolAccount;
      rSetting.LINENotifyKey = data.LINENotifyKey;
      rSetting.LINESecretKey = data.LINESecretKey;
      rSetting.robotDeadLine = data.robotDeadLine;
      rSetting.reportDuration = data.reportDuration;
      rSetting.patrolHour = data.patrolHour;
      await rSetting.save();
      io.p2p.emit('setSetting', true);
      let robotSetting = await models.robotModel.findOne({}).sort({_id: 1}).exec();
      io.p2p.emit('getRobotSetting', robotSetting);
      let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      io.p2p.emit('getGlobalSettings', globalSetting);
    }
  });
  return router;
}
