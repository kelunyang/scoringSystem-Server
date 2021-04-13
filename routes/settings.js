let express = require('express');
let router = express.Router();
let moment = require('moment');
let axios = require('axios');
let qs = require('qs');
let _ = require('lodash');
const { ObjectId } = require('mongodb');
const { spawn } = require("child_process");
let v2ray = null;

module.exports = (io, models) => {
  io.p2p.on('getsiteSetting', async (data) => {
    let globalSetting = await models.settingModel.findOne({}).exec();
    io.p2p.emit('getsiteSetting', {
      siteLocation: globalSetting.siteLocation,
      versionBackend: globalSetting.versionBackend,
      versionFrontend: globalSetting.versionFrontend,
      userCheckTime: globalSetting.userCheckTime,
      connectionTimeout: globalSetting.connectionTimeout
    });
    return;
  });

  io.p2p.on('startV2ray', async (data) => {
    v2ray = spawn('/usr/bin/v2ray', ['-config','/etc/v2ray/config.json'], {detached:true});
    v2ray.stderr.on('data',function(data) {
      io.p2p.emit('v2rayReport', '發生錯誤：' + data);
    });

    v2ray.stdout.on('data',function(data) {
      let result = data.toString('utf8');
      io.p2p.emit('v2rayReport', result.replace('\n', ''));
    });

    v2ray.on('exit', (code) => {
      io.p2p.emit('v2rayReport', 'v2ray已結束！');
    });
    return;
  });

  io.p2p.on('stopV2ray', async (data) => {
    if(v2ray !== null) {
      v2ray.stdin.pause();
      v2ray.kill();
    }
    return;
  });

  io.p2p.on('checkV2ray', async (data) => {
    var ps = spawn('ps',   ['au']);
    var grep = spawn('grep', ['v2ray']);
    ps.stdout.pipe(grep.stdin);
    grep.stdout.on('data',function(data) {
      let result = data.toString('utf8');
      io.p2p.emit('checkV2ray', result.indexOf('/usr/bin/v2ray'));
    });
    return;
  });

  io.p2p.on('getGithubFrontendCommit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let githubCommits = await axios.get('https://api.github.com/repos/' + globalSetting.frontendRepo + '/commits\?access_token\=' + globalSetting.githubKey);
      let commits = _.map(githubCommits.data, (gCommit) => {
        return {
          id: gCommit.sha,
          message: gCommit.commit.message,
          committerName: gCommit.commit.committer.name,
          committerEmail: gCommit.commit.committer.email,
          commitDate: gCommit.commit.committer.date
        }
      });
      io.p2p.emit('getGithubFrontendCommit', commits);
    }
    return;
  });

  io.p2p.on('getGithubBackendCommit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let githubCommits = await axios.get('https://api.github.com/repos/' + globalSetting.backendRepo + '/commits\?access_token\=' + globalSetting.githubKey);
      let commits = _.map(githubCommits.data, (gCommit) => {
        return {
          id: gCommit.sha,
          message: gCommit.commit.message,
          committerName: gCommit.commit.committer.name,
          committerEmail: gCommit.commit.committer.email,
          commitDate: gCommit.commit.committer.date
        }
      });
      io.p2p.emit('getGithubBackendCommit', commits);
    }
    return;
  });

  io.p2p.on('getGlobalSettings', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      io.p2p.emit('getGlobalSettings', globalSetting);
    }
    return;
  });

  io.p2p.on('getRobotSetting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let robotSetting = await models.robotModel.findOne({}).exec();
      io.p2p.emit('getRobotSetting', robotSetting);
    }
    return;
  });

  io.p2p.on('getProjectSetting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let projectSetting = await models.projectModel.findOne({}).exec();
      io.p2p.emit('getProjectSetting', projectSetting);
    }
    return;
  });
  
  io.p2p.on('setSetting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let gSetting = await models.settingModel.findOne({}).exec();
      gSetting.settingTags = data.selectedSysTags.length > 0 ? data.selectedSysTags : gSetting.settingTags;
      gSetting.userTags = data.selectedUsrTags.length > 0 ? data.selectedUsrTags : gSetting.userTags;
      gSetting.projectTags = data.selectedflowTags.length > 0 ? data.selectedflowTags : gSetting.projectTags;
      gSetting.robotTag = data.selectedrobotTag === '' ? gSetting.robotTag : data.selectedrobotTag;
      gSetting.statisticsTags = data.selectedstatisticsTags.length > 0 ? data.selectedstatisticsTags : gSetting.statisticsTags;
      gSetting.siteLocation = data.siteLocation;
      gSetting.versionBackend = data.versionBackend;
      gSetting.versionFrontend = data.versionFrontend;
      gSetting.userCheckTime = data.userCheckTime;
      gSetting.connectionTimeout = data.connectionTimeout;
      gSetting.githubKey = data.githubKey;
      gSetting.frontendRepo = data.frontendRepo;
      gSetting.backendRepo = data.backendRepo;
      gSetting.tick = moment().unix();
      await gSetting.save();
      let rSetting = await models.robotModel.findOne({}).exec();
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
      let robotSetting = await models.robotModel.findOne({}).exec();
      io.p2p.emit('getRobotSetting', robotSetting);
      let globalSetting = await models.settingModel.findOne({}).exec();
      io.p2p.emit('getGlobalSettings', globalSetting);
    }
    return;
  });
  
  return router;
}
