import express from 'express';
let router = express.Router();
import dayjs from 'dayjs';
import axios from 'axios';
import qs from 'qs';
import os from 'os';
import _ from 'lodash';
import { ObjectId } from 'mongodb';
import { spawn } from "child_process";

export default function (io, models) {
  io.p2p.on('getsiteSetting', async (data) => {
    let globalSetting = await models.settingModel.findOne({}).exec();
    let robotSettings = await models.robotModel.findOne({}).exec();
    io.p2p.emit('getsiteSetting', {
      siteLocation: globalSetting.siteLocation,
      version: {
        backend: globalSetting.versionBackend,
        frontend: globalSetting.versionFrontend,
        bot: globalSetting.versionBot
      },
      repos: {
        backend: globalSetting.backendRepo,
        frontend: globalSetting.frontendRepo,
        bot: globalSetting.botRepo
      },
      userCheckTime: globalSetting.userCheckTime,
      connectionTimeout: globalSetting.connectionTimeout,
      validFormat: {
        validWidth: robotSettings.converisionWidth,
        validHeight: robotSettings.converisionHeight,
        withAudio: robotSettings.converisionAudio,
        validRange: robotSettings.converisionDurationLimit
      },
      systemName: globalSetting.systemName,
      restrictTags: globalSetting.restrictTags
    });
    return;
  });

  io.p2p.on('getGithubCommit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let commits = [];
      let globalSetting = await models.settingModel.findOne({}).exec();
      let githubCommits = await axios.get('https://api.github.com/repos/' + data + '/commits',{
        headers: {
          'Authorization': `token ${globalSetting.githubKey}`
        }
      });
      if('data' in githubCommits) {
        commits = _.map(githubCommits.data.slice(0, 5), (gCommit) => {
          return {
            id: gCommit.sha,
            message: gCommit.commit.message,
            committerName: gCommit.commit.committer.name,
            committerEmail: gCommit.commit.committer.email,
            commitDate: gCommit.commit.committer.date
          }
        });
      }
      io.p2p.emit('getGithubCommit', {
        repo: data,
        commits: commits
      });
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

  io.p2p.on('checkbotVM', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let now = dayjs().unix();
      let robotSetting = await models.robotModel.findOne({}).exec();
      let ffmpegbotOn = false;
      let ffmpegbotOff = false;
      if(robotSetting.vmStatus.ffmpegStatus) {
        let lastConverision = await models.logModel.findOne({
          where: "轉檔機器人",
          action: '啟動'
        }).sort({ tick: -1 }).exec();
        lastConverision =  lastConverision === null ? 0 : lastConverision.tick;
        ffmpegbotOn = _.inRange(now, lastConverision, lastConverision + 120);
      }
      if(!robotSetting.vmStatus.ffmpegStatus) {
        let lastConverision = await models.logModel.findOne({
          where: "轉檔機器人",
          action: '結束'
        }).sort({ tick: -1 }).exec();
        lastConverision =  lastConverision === null ? 0 : lastConverision.tick;
        ffmpegbotOff = _.inRange(now, lastConverision, lastConverision + 120);
      }
      io.p2p.emit('checkbotVM', {
        ffmpegOn: ffmpegbotOn,
        ffmpegOff: ffmpegbotOff,
        ffmpegStatus: robotSetting.vmStatus.ffmpegStatus,
        ramStatus: robotSetting.vmStatus.ramStatus,
        reportTick: robotSetting.vmStatus.reportTick,
        cpuStatus: robotSetting.vmStatus.cpuStatus,
        totalStorage: robotSetting.vmStatus.totalStorage,
        totalRAM: robotSetting.vmStatus.totalRAM,
        storageStatus: robotSetting.vmStatus.storageStatus
      });
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

  io.p2p.on('listRobotLog', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let logs = await models.logModel.find({
        where: new RegExp(data.botName, "g"),
        action: new RegExp(data.action, "g"),
        $or: [ { comment: { $exists: false} }, {comment: new RegExp(data.comment, "g") }]
      }).sort({
        tick: -1
      }).limit(data.logNum).exec();
      io.p2p.emit('listRobotLog', logs);
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
      gSetting.defaultPassword = data.defaultPassword;
      gSetting.restrictTags = data.restrictTags.length > 0 ? data.restrictTags : gSetting.restrictTags;
      gSetting.settingTags = data.selectedSysTags.length > 0 ? data.selectedSysTags : gSetting.settingTags;
      gSetting.userTags = data.selectedUsrTags.length > 0 ? data.selectedUsrTags : gSetting.userTags;
      gSetting.projectTags = data.selectedflowTags.length > 0 ? data.selectedflowTags : gSetting.projectTags;
      gSetting.robotTag = data.selectedrobotTag === '' ? gSetting.robotTag : data.selectedrobotTag;
      gSetting.statisticsTags = data.selectedstatisticsTags.length > 0 ? data.selectedstatisticsTags : gSetting.statisticsTags;
      gSetting.serviceTags = data.serviceTags.length > 0 ? data.serviceTags : gSetting.serviceTags;
      gSetting.siteLocation = data.siteLocation;
      gSetting.versionBackend = data.versionBackend;
      gSetting.versionFrontend = data.versionFrontend;
      gSetting.versionBot = data.versionBot;
      gSetting.userCheckTime = data.userCheckTime;
      gSetting.connectionTimeout = data.connectionTimeout;
      gSetting.githubKey = data.githubKey;
      gSetting.frontendRepo = data.frontendRepo;
      gSetting.backendRepo = data.backendRepo;
      gSetting.botRepo = data.botRepo;
      gSetting.storageLocation = data.storageLocation;
      gSetting.randomNewbiePass = data.randomNewbiePass;
      gSetting.tick = dayjs().unix();
      gSetting.systemName = data.systemName;
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
      rSetting.parallelRAM = data.parallelRAM;
      rSetting.patrolHour = data.patrolHour;
      rSetting.patrolTimes = data.patrolTimes;
      rSetting.mailSSL = data.mailSSL;
      rSetting.backupLocation = data.backupLocation;
      rSetting.dbbackupLocation = data.dbbackupLocation;
      rSetting.backupDuration = data.backupDuration;
      rSetting.dbbackupDuration = data.dbbackupDuration;
      rSetting.dbbackupCopies = data.dbbackupCopies;
      rSetting.backupCopies = data.backupCopies;
      rSetting.backupHour = data.backupHour;
      rSetting.notifyHour = data.notifyHour;
      rSetting.converisionDropzoneA = data.converisionDropzoneA;
      rSetting.converisionDropzoneB = data.converisionDropzoneB;
      rSetting.originalVideos = data.originalVideos;
      rSetting.converisionLocation = data.converisionLocation;
      rSetting.converisionFailTag = data.converisionFailTag;
      rSetting.converisionHeight = data.converisionHeight;
      rSetting.converisionWidth = data.converisionWidth;
      rSetting.converisionAudio = data.converisionAudio;
      rSetting.converisionDuration = data.converisionDuration;
      rSetting.enableConverision = data.enableConverision;
      rSetting.converisionDurationLimit = data.converisionDurationLimit;
      rSetting.failedRecheck = data.failedRecheck;
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
