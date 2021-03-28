let express = require('express');
let router = express.Router();
let moment = require('moment');
let axios = require('axios');
let qs = require('qs');
const { ObjectId } = require('mongodb');

module.exports = (io, models) => {
  io.p2p.on('getsiteSetting', async (data) => {
    let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
    io.p2p.emit('getsiteSetting', {
      siteLocation: globalSetting.siteLocation,
      version: globalSetting.version,
      changeLog: globalSetting.changeLog,
      userCheckTime: globalSetting.userCheckTime,
      connectionTimeout: globalSetting.connectionTimeout
    });
  });

  io.p2p.on('getGlobalSettings', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      io.p2p.emit('getGlobalSettings', globalSetting);
    }
  });

  io.p2p.on('getRobotSetting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let robotSetting = await models.robotModel.findOne({}).sort({_id: 1}).exec();
      io.p2p.emit('getRobotSetting', robotSetting);
    }
  });

  io.p2p.on('getProjectSetting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let projectSetting = await models.projectModel.findOne({}).sort({_id: 1}).exec();
      io.p2p.emit('getProjectSetting', projectSetting);
    }
  });
  
  io.p2p.on('setSetting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let gSetting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
      gSetting.settingTags = data.selectedSysTags.length > 0 ? data.selectedSysTags : gSetting.settingTags;
      gSetting.userTags = data.selectedUsrTags.length > 0 ? data.selectedUsrTags : gSetting.userTags;
      gSetting.projectTags = data.selectedflowTags.length > 0 ? data.selectedflowTags : gSetting.projectTags;
      gSetting.robotTag = data.selectedrobotTag === '' ? gSetting.robotTag : data.selectedrobotTag;
      gSetting.siteLocation = data.siteLocation;
      gSetting.version = data.version;
      gSetting.changeLog = data.changeLog;
      gSetting.userCheckTime = data.userCheckTime;
      gSetting.connectionTimeout = data.connectionTimeout;
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
      rSetting.mailSMTP = data.mailSMTP;
      rSetting.mailPort = data.mailPort;
      rSetting.patrolHour = data.patrolHour;
      rSetting.mailSSL = data.mailSSL;
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
