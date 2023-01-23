import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';
import _ from 'lodash';
import TurndownService from 'turndown';
const turndownService = new TurndownService();

export default function (io, models) {
  let depositStatus = async(gid,tid,uid) => {
    let groupStatus = await models.depositModel.find({
      tid: tid,
      gid: gid,
      joinTick: 0
    }).exec();
    if(groupStatus.length > 0) {
      return false;
    } else {
      let userStatus = await models.depositModel.find({
        tid: tid,
        uid: uid,
        gid: gid,
        confirm: true
      }).exec();
      return userStatus.length > 0;
    }
  }
  let sameTaggedGroup = async(gid, tid) => {
    let stage = await models.stageModel.findOne({
      _id: new ObjectId(tid)
    }).exec();
    let tagGroup = await models.groupModel.findOne({
      _id: new ObjectId(gid)
    }).exec();
    let sameGroup = await models.groupModel.find({
      tag: tagGroup.tag,
      sid: stage.sid
    }).exec();
    let queryGroup = _.map(sameGroup, (group) => {
      return group._id;
    });
    let reports = await models.reportModel.find({
      gid: { $in: queryGroup },
      tid: new ObjectId(tid),
      visibility: true
    }).exec();
    return reports;
  }
  let getDepositBalance = async(tid, gid) => {
    let queryCmd = [];
    queryCmd.push({
      $match: {
        gid: gid,
        tid: tid,
        invalid: 0
      }
    });
    queryCmd.push({
      $group: {
        _id: "$gid",
        balance: { $sum: "$value"}
      }
    });
    return await models.stageAssetModel.aggregate(queryCmd);
  }
  let getBalance = async (user, tid) => {
    let depositConfirm = await models.depositModel.findOne({
      uid: new ObjectId(user),
      joinTick: { $gt: 0 },
      confirm: true,
      confirmTick: { $gt: 0 },
      tid: new ObjectId(tid)
    }).exec();
    if(depositConfirm === undefined) {
      return 0;
    } else {
      let queryCmd = [];
      queryCmd.push({
        $match: {
          gid: depositConfirm.gid,
          tid: new ObjectId(tid),
          invalid: 0
        }
      },{
        $project: {
          balance: {
            $sum: "$value"
          }
        }
      })
      return await models.stageAssetModel.aggregate(queryCmd);
    }
  }
  let getAudits = async (rid) => {
    let audits = await models.auditModel.find({
      rid: new ObjectId(rid),
      visibility: true
    })
    .populate('coworkers', '-password -lineToken -lineCode')
    .exec();
    return audits;
  }

  let getAudit = async (aid) => {
    let audit = await models.auditModel.findOne({
      _id: new ObjectId(aid)
    })
    .populate('coworkers', '-password -lineToken -lineCode')
    .exec();
    return audit;
  }

  let getReports = async (sid, uid, rids, tagged) => {
    let hiddenTags = _.map(await models.tagModel.find({
      visibility: false
    }).exec(), (item) => {
      return item._id;
    });
    let user = await models.userModel.findOne({
      _id: new ObjectId(uid)
    }).exec();
    let ownGroup = await models.groupModel.findOne({
      sid: sid,
      $or:[ 
        {leaders: user._id},
        {members: user._id}
      ]
    }).exec();
    let reports = _.map(rids, (rid) => {
      return new ObjectId(rid);
    });
    let queryCmd = [];
    queryCmd.push({
      $match: {
        _id: { $in: reports},
        visibility: true
      }
    });
    if(tagged) {
      if(ownGroup !== null) {
        queryCmd.push({
          $match: {
            tag: ownGroup.tag
          }
        });
      }
    }
    queryCmd.push({
      $match: {
        tag: { $nin: hiddenTags}
      }
    },
    {
      $unwind: "$coworkers"
    },
    {
      $lookup: {
        from: 'userDB',
        as: '_id',
        let: { reportUID: "$coworkers" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$$reportUID", "$_id"]
              }
            }
          },
          { 
            $project: { 
              lineCode: 0,
              lineDate: 0,
              lineToken: 0,
              password: 0
            }
          }
        ],
        as: 'coworkers'
      }
    },
    {
      $unwind: "$coworkers"
    },
    {
      $group: {
        _id: "$_id",
        coworkers: { $push: "$coworkers" },
        audits: { $first: "$audits" },
        content: { $first: "$content"},
        gained: { $first: "$gained"},
        gid: { $first: "$gid"},
        grantedDate: { $first: "$grantedDate"},
        grantedValue: { $first: "$grantedValue"},
        sid: { $first: "$sid"},
        tick: { $first: "$tick"},
        tid: { $first: "$tid"},
        value: { $first: "$value"},
        locked: { $first: "$locked"},
        visibility: { $first: "$visibility"},
        intervention: { $first: "$intervention"}
      }
    });
    return await models.reportModel.aggregate(queryCmd);
  }

  let getInterventions = async (iids) => {
    let iid = _.map(iids, (id) => {
      return new ObjectId(id);
    });
    let interventions = await models.interventionModel.find({
      _id: { $in: iid }
    })
    .populate('user', '-password -lineToken -lineCode')
    .sort({ tick: -1 })
    .exec();
    return interventions;
  }

  let calcIntervention = async(value, object) => {
    if(object.intervention.length > 0) {
      let interventions = await getInterventions(object.intervention);
      let finalIntervention = _.meanBy(interventions, (intervent) => {
        return intervent.value;
      });
      return Math.ceil(value * (finalIntervention / 100));
    } else {
      return Math.ceil(value);
    }
  }

  let getReport = async (rid) => {
    let report = await models.reportModel.findOne({
      _id: new ObjectId(rid)
    })
    .populate('coworkers', '-password -lineToken -lineCode')
    .populate('grantedUser', '-password -lineToken -lineCode')
    .populate('audits')
    .exec();
    return report;
  }

  let depositAudit = async(stage, audits, schema, report) => {
    let now = dayjs().unix();
    audits = _.orderBy(audits, ['tick'], ['asc']);
    for(let i=0; i< audits.length; i++) {
      let audit = audits[i];
      let rankRate = audits.length - i;
      let shortTip = audit.short ? "[負評]" : "";
      let group = await models.groupModel.findOne({
        _id: audit.gid
      }).exec();
      let members = _.unionWith(group.members, group.leaders, (a, b) => {
        return a.equals(b);
      });
      let auditScore = 0;
      if(audit.feedbackTick > 0) {
        if(audit.short) {
          auditScore = Math.abs(Math.ceil(Math.abs(audit.value - (audit.value - audit.feedback)) / 2) + (audit.value * -1));
        } else {
          auditScore = Math.ceil(Math.abs((audit.value - audit.feedback) / 2)) + audit.feedback;
        }
      } else {
        auditScore = audit.value
      }
      auditScore = auditScore * stage.value;
      if(audit.short) {
        auditScore = auditScore * schema.shortBonus;
      }
      let totalBalance = audit.totalBalance;
      let maxBet = totalBalance > report.value ? report.value : totalBalance;
      maxBet = maxBet <= 0 ? 1 : maxBet;
      let timeValue = Math.abs(Math.ceil((stage.endTick - report.tick) / 60 / 60));
      timeValue = Math.ceil((audit.value / maxBet) * timeValue);
      let valueAudit = auditScore + Math.ceil(timeValue * (rankRate / audits.length));
      if(audit.gained === 0) {
        for(let u=0; u< audit.coworkers.length; u++) {
          let user = audit.coworkers[u];
          let deposit = await models.depositModel.findOne({
            tid: stage._id,
            joinTick: { $gt: 0 },
            confirm: true,
            confirmTick: { $gt: 0 },
            uid: user
          }).exec();
          if(user !== null) {
            let depositPercentage = deposit.value / deposit.totalDeposit;
            await models.accountingModel.create({
              tick: now,
              sid: schema._id,
              uid: user,
              invalid: 0,
              desc: "評分前(" + (i+1) + "/" + audits.length + ")名得點（負責人），按照押金占比可實拿[" + Math.ceil(depositPercentage * 100) + "%]" + shortTip,
              value: await calcIntervention((valueAudit * schema.workerRate) * depositPercentage, audit)
            });
            await models.eventlogModel.create({
              tick: now,
              type: '評分系統',
              desc: '發點數',
              sid: schema._id,
              user: user
            });
          }
        }
        let normalMembers = _.differenceWith(members, audit.coworkers, (member, coworker) => {
          return member.equals(coworker);
        });
        normalMembers = _.differenceWith(normalMembers, group.leaders, (member, leader) => {
          return member.equals(leader);
        });
        for(let i=0; i<normalMembers.length; i++) {
          let member = normalMembers[i];
          let deposit = await models.depositModel.findOne({
            tid: stage._id,
            joinTick: { $gt: 0 },
            confirm: true,
            confirmTick: { $gt: 0 },
            uid: member
          }).exec();
          if(deposit !== null) {
            let depositPercentage = deposit.value / deposit.totalDeposit;
            await models.accountingModel.create({
              tick: now,
              sid: schema._id,
              uid: member,
              invalid: 0,
              desc: "評分前(" + (i+1) + "/" + audits.length + ")名得點（組員），按照押金占比可實拿[" + Math.ceil(depositPercentage * 100) + "%]",
              value: await calcIntervention(valueAudit * schema.memberRate * depositPercentage, audit)
            });
            await models.eventlogModel.create({
              tick: now,
              type: '評分系統',
              desc: '發點數',
              sid: schema._id,
              user: member
            });
          }
        }
        let leaders = _.differenceWith(members, audit.coworkers, (member, coworker) => {
          return member.equals(coworker);
        });
        leaders = _.differenceWith(leaders, group.members, (member, gmember) => {
          return member.equals(gmember);
        });
        for(let i=0; i<leaders.length; i++) {
          let member = leaders[i];
          let deposit = await models.depositModel.findOne({
            tid: stage._id,
            joinTick: { $gt: 0 },
            confirm: true,
            confirmTick: { $gt: 0 },
            uid: member
          }).exec();
          if(deposit !== null) {
            let depositPercentage = deposit.value / deposit.totalDeposit;
            await models.accountingModel.create({
              tick: now,
              sid: schema._id,
              uid: member,
              invalid: 0,
              desc: "評分前(" + (i+1) + "/" + audits.length + ")名得點（組長），按照押金占比可實拿[" + Math.ceil(depositPercentage * 100) + "%]",
              value: await calcIntervention(valueAudit * schema.leaderRate * depositPercentage, audit)
            });
            await models.eventlogModel.create({
              tick: now,
              type: '評分系統',
              desc: '發點數',
              sid: schema._id,
              user: member
            });
          }
        }
        audit.confirm = now;
        audit.gained = now;
        await audit.save();
      }
    }
  }

  let depositReport = async(stage, schema, report, group, score, ignoreTime) => {
    let now = dayjs().unix();
    let valueWorker = 0;
    let valueMember = 0;
    let valueLeader = 0;
    let calc = false;
    let ignoreTip = ignoreTime ? "[不發時間點數]" : "";
    if(report.gained === 0) {
      let members = _.unionWith(group.members, group.leaders, (a, b) => {
        return a.equals(b);
      });
      let totalBalance = report.totalBalance;
      let timeValue = Math.ceil((stage.endTick - report.tick) / 60 / 60);
      timeValue = ignoreTime ? 0 : timeValue;
      timeValue = timeValue > 0 ? timeValue : 0;
      let expired = timeValue > 0 ? 1 : 0;
      timeValue = score === 0 ? 0 : timeValue;
      let rankWord = "";
      let proceedDeposit = true;
      if(stage.matchPoint) {
        let groupedReports = [];
        if(schema.tagGroupped) {
          groupedReports = await sameTaggedGroup(group._id, stage._id);
        } else {
          groupedReports = await models.reportModel.find({
            tid: stage._id,
            visibility: true
          }).exec();
        }
        proceedDeposit = _.filter(groupedReports, (report) => {
          return report.grantedDate === 0;
        }).length === 0;
        if(proceedDeposit) {
          let sortedReports = _.orderBy(groupedReports, ['grantedValue'], ['desc']);
          let rank = sortedReports.length;
          let realRank = 1;
          for(let i=0; i<sortedReports.length; i++) {
            if(sortedReports[i]._id.equals(report._id)) {
              break;
            }
            realRank++;
            rank--;
          }
          rankWord = "[第" + realRank +"名]";
          valueWorker = await calcIntervention(((score * schema.workerRate) * expired * rank) + timeValue + report.grantedValue, report);
          valueMember = await calcIntervention(((score * schema.memberRate) * expired * rank) + timeValue + report.grantedValue, report);
          valueLeader = await calcIntervention(((score * schema.leaderRate) * expired * rank) + timeValue + report.grantedValue, report);
        }
      } else {
        valueWorker = await calcIntervention(((score * schema.workerRate) * expired) + timeValue + report.grantedValue, report);
        valueMember = await calcIntervention(((score * schema.memberRate) * expired) + timeValue + report.grantedValue, report);
        valueLeader = await calcIntervention(((score * schema.leaderRate) * expired) + timeValue + report.grantedValue, report);
      }
      if(proceedDeposit) {
        for(let u=0; u< report.coworkers.length; u++) {
          let user = report.coworkers[u];
          let deposit = await models.depositModel.findOne({
            tid: stage._id,
            joinTick: { $gt: 0 },
            confirm: true,
            confirmTick: { $gt: 0 },
            uid: user
          }).exec();
          let depositPercentage = deposit.value / deposit.totalDeposit;
          await models.accountingModel.create({
            tick: now,
            sid: schema._id,
            uid: user,
            invalid: 0,
            desc: "報告得點（負責人）" + rankWord + ignoreTip + "，可得" + valueWorker + "點，實拿點數為回合押金占比的" + Math.ceil(depositPercentage * 100) + "%",
            value: Math.ceil(valueWorker * depositPercentage)
          });
          await models.eventlogModel.create({
            tick: now,
            type: '報告系統',
            desc: '發點數',
            sid: schema._id,
            user: user
          });
        }
        let audits = await models.auditModel.find({
          rid: report._id,
          gained: { $gt: 0 },
          visibility: true
        }).exec();
        let feedbackers = [];
        for(let i=0; i<audits.length; i++) {
          if(audits[i].feedbackTick > 0) {
            let user = audits[i].feedbackUser;
            let deposit = await models.depositModel.findOne({
              tid: stage._id,
              joinTick: { $gt: 0 },
              confirm: true,
              confirmTick: { $gt: 0 },
              uid: user
            }).exec();
            let depositPercentage = deposit.value / deposit.totalDeposit;
            feedbackers.push(user);
            let feedbackRate = (audits[i].feedback / report.grantedValue).toFixed(2);
            await models.accountingModel.create({
              tick: now,
              sid: schema._id,
              uid: user,
              invalid: 0,
              desc: "報告得點（確認評分者）" + rankWord + ignoreTip + "，可得" + Math.ceil(valueWorker * feedbackRate) + "點，實拿點數為回合押金占比的" + Math.ceil(depositPercentage * 100) + "%",
              value: Math.ceil(valueWorker * feedbackRate * depositPercentage)
            });
            await models.eventlogModel.create({
              tick: now,
              type: '報告系統',
              desc: '發點數',
              sid: schema._id,
              user: user
            });
          }
        }
        let coworkers = _.unionWith(report.coworkers, feedbackers, (coworker, feedbacker) => {
          return coworker.equals(feedbacker);
        });
        let normalMembers = _.differenceWith(members, coworkers, (member, coworker) => {
          return member.equals(coworker);
        });
        normalMembers = _.differenceWith(normalMembers, group.leaders, (member, leader) => {
          return member.equals(leader);
        });
        for(let i=0; i<normalMembers.length; i++) {
          let member = normalMembers[i];
          let deposit = await models.depositModel.findOne({
            tid: stage._id,
            joinTick: { $gt: 0 },
            confirm: true,
            confirmTick: { $gt: 0 },
            uid: member
          }).exec();
          if(deposit !== null) {
            let depositPercentage = deposit.value / deposit.totalDeposit;
            await models.accountingModel.create({
              tick: now,
              sid: schema._id,
              uid: member,
              invalid: 0,
              desc: "報告得點（組員）" + rankWord + ignoreTip + "，可得" + valueMember + "點，實拿點數為回合押金占比的" + Math.ceil(depositPercentage * 100) + "%",
              value: Math.ceil(valueMember * depositPercentage)
            });
            await models.eventlogModel.create({
              tick: now,
              type: '報告系統',
              desc: '發點數',
              sid: schema._id,
              user: member
            });
          }
        }
        let leaders = _.differenceWith(members, coworkers, (member, coworker) => {
          return member.equals(coworker);
        });
        leaders = _.differenceWith(leaders, group.members, (leader, gmember) => {
          return leader.equals(gmember);
        });
        for(let i=0; i<leaders.length; i++) {
          let leader = leaders[i];
          let deposit = await models.depositModel.findOne({
            tid: stage._id,
            joinTick: { $gt: 0 },
            confirm: true,
            confirmTick: { $gt: 0 },
            uid: leader
          }).exec();
          if(deposit !== null) {
            let depositPercentage = deposit.value / deposit.totalDeposit;
            await models.accountingModel.create({
              tick: now,
              sid: schema._id,
              uid: leader,
              invalid: 0,
              desc: "報告得點（組長）" + rankWord + ignoreTip + "，可得" + valueLeader + "點，實拿點數為回合押金占比的" + depositPercentage + "%",
              value: Math.ceil(valueLeader * depositPercentage)
            });
            await models.eventlogModel.create({
              tick: now,
              type: '報告系統',
              desc: '發點數',
              sid: schema._id,
              user: leader
            });
          }
        }
        report.gained = now;
        await report.save();
      }
    }
  }

  let evaluatedAudit = async (rid, uid) => {
    let now = dayjs().unix();
    let robotSettings = await models.robotModel.findOne({}).exec();
    let signUser = uid === undefined ? robotSettings.nobodyAccount : new ObjectId(uid);
    let report = await models.reportModel.findOne({
      _id: new ObjectId(rid)
    }).exec();
    let stage = await models.stageModel.findOne({
      _id: report.tid
    }).exec();
    let schema = await models.schemaModel.findOne({
      _id: report.sid
    }).exec();
    let audits = await models.auditModel.find({
      _id: { $in: report.audits },
      visibility: true
    }).sort({
      tick: -1
    }).exec();
    if(audits.length > 0) {
      let falseCheck = _.filter(audits, (audit) => {
        return audit.short;
      });
      if(falseCheck.length === 0) { //正分自動發點
        await depositAudit(stage, audits, schema, report);
      } else { //負分依照手動評分
        let confirms = _.filter(audits, (audit) => {
          return audit.confirm > 0;
        });
        await depositAudit(stage, confirms, schema, report);
      }
      if(report.grantedDate === 0) {
        let audits = await models.auditModel.find({
          gained: { $gt: 0 },
          rid: report._id,
          visibility: true
        }).exec();
        let auditValues = _.meanBy(audits, (audit) => {
          let score = 0;
          if(audit.feedbackTick > 0) {
            if(audit.short) {
              score = Math.ceil(Math.abs(audit.value - (audit.value - audit.feedback)) / 2) + (audit.value * -1);
            } else {
              score = Math.ceil(Math.abs((audit.value - audit.feedback) / 2)) + audit.feedback;
            }
          } else {
            score = audit.value
          }
          return score;
        });
        report.grantedUser = signUser;
        report.grantedDate = now;
        report.grantedValue = Math.ceil(auditValues);
        await report.save();
      }
    }
  }

  let evaluatedReport = async(rid, ignoreTime) => {
    let report = await models.reportModel.findOne({
      _id: new ObjectId(rid)
    }).exec();
    if(report.gained === 0) {
      let stage = await models.stageModel.findOne({
        _id: report.tid
      }).exec();
      let schema = await models.schemaModel.findOne({
        _id: report.sid
      }).exec();
      let group = await models.groupModel.findOne({
        _id: report.gid
      }).exec();
      let audits = await models.auditModel.find({
        rid: report._id
      }).exec();
      let falseCheck = _.filter(audits, (audit) => {
        return audit.short;
      })
      if(falseCheck.length === 0) {   //正分
        let score = report.grantedValue * stage.value;
        await depositReport(stage, schema, report, group, score, ignoreTime);
      } else {  //負分
        let falseConfirmed = _.filter(audits, (audit) => {
          if(audit.confirm > 0) {
            return audit.short;
          }
          return false;
        });
        if(falseConfirmed.length === 0) { //負分沒有被確認
          let score = report.grantedValue * stage.value;
          await depositReport(stage, schema, report, group, score, ignoreTime);
        } else {  //被確認的還是負分
          let score = 0;
          await depositReport(stage, schema, report, group, score, ignoreTime);
        }
      }
    }
  }

  io.p2p.on('getGranted', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let audits = await models.auditModel.find({
        rid: new ObjectId(data.rid)
      }).exec();
      let pos = _.sumBy(audits, (audit) => {
        return audit.value > 0 ? audit.value : 0;
      });
      let neg = _.sumBy(audits, (audit) => {
        return audit.value < 0 ? audit.value : 0;
      });
      return {
        pos: pos,
        neg: neg
      }
    }
    return;
  });

  io.p2p.on('getReporthistory', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('user' in io.p2p.request.session.passport) {
        let globalSetting = await models.settingModel.findOne({}).exec();
        let uid = new ObjectId(io.p2p.request.session.passport.user);
        let user = await models.userModel.findOne({
          _id: uid
        }).exec();
        let report = await models.reportModel.findOne({
          _id: new ObjectId(data.rid)
        }).exec();
        let schema = await models.schemaModel.findOne({
          _id: report.sid
        }).exec();
        let group = await models.groupModel.findOne({
          _id: report.gid
        }).exec();
        let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
          return supervisor.equals(user._id);
        });
        let memberCheck = _.filter(group.members, (member) => {
          return member.equals(user._id);
        });
        let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
        let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
          return sTag.equals(uTag);
        })
        if(leaderCheck.length > 0 || supervisorCheck.length > 0 || globalCheck.length > 0) {
          let reports = models.reportModel.find({
            sid: report.sid
          }).exec();
          io.p2p.emit('getAudit', reports);
          return;
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '報告系統',
      tick: dayjs().unix(),
      action: '查詢報告紀錄',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('getAudit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let audit = await getAudit(data.aid);
      io.p2p.emit('getAudit', audit);
    }
    return;
  });

  io.p2p.on('getInterventions', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let obj = data.type === 0 ?
        await models.reportModel.findOne({
          _id: data._id
        }).exec() :
        await models.auditModel.findOne({
          _id: data._id
        }).exec();
      let interventions = await getInterventions(obj.intervention);
      io.p2p.emit('getInterventions', {
        _id: data._id,
        interventions: interventions
      });
    }
    return;
  });

  io.p2p.on('getAudits', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let audits = await getAudits(data.rid);
      io.p2p.emit('getAudits', audits);
    }
    return;
  });

  io.p2p.on('getReport', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let report = await getReport(data._id);
          let group = await models.groupModel.findOne({
            _id: report.gid,
            $or:[ 
              {leaders: new ObjectId(io.p2p.request.session.passport.user)},
              {members: new ObjectId(io.p2p.request.session.passport.user)}
            ]
          }).exec();
          let falseAudit = _.filter(report.audits, (audit) => {
            return audit.short;
          });
          let auditValues = report.audits.length > 0 ? _.meanBy(report.audits, (audit) => {
            let score = 0;
            let countControl = falseAudit.length > 0 ? audit.confirm > 0 : true;
            if(countControl) {
              if(audit.feedbackTick > 0) {
                if(audit.short) {
                  score = Math.ceil(Math.abs(audit.value - (audit.value - audit.feedback)) / 2) + (audit.value * -1);
                } else {
                  score = Math.ceil(Math.abs((audit.value - audit.feedback) / 2)) + audit.feedback;
                }
              } else {
                score = audit.value
              }
            }
            return score;
          }) : 0;
          let auditLeaders = [];
          for(let i=0; i<report.audits.length; i++) {
            let leaderCheck = await models.groupModel.findOne({
              _id: report.audits[i].gid,
              leaders: { $in: [user._id] }
            }).exec();
            if(leaderCheck !== null) {
              auditLeaders.push(report.audits[i]._id);
            }
          }
          io.p2p.emit('getReport', {
            report: report,
            isAuthor: group !== null,
            falseAudit: falseAudit.length > 0,
            auditValues: Math.ceil(auditValues),
            auditLeaders: auditLeaders
          });
        }
      }
    }
    return;
  });

  io.p2p.on('getReports', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: new ObjectId(data.sid)
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user);
          });
          let globalCheck = _.intersectionWith(globalSetting.settingTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let tagged = supervisorCheck.length > 0 || globalCheck ? false : schema.tagGroupped;
          let reports = await getReports(schema._id, user._id, data.rids, tagged);
          let leaderReport = [];
          let isSupervisor = false;
          for(let i=0; i<reports.length; i++) {
            let leaderCheck = await models.groupModel.findOne({
              _id: reports[i].gid,
              leaders: user._id
            }).exec();
            if(leaderCheck !== null) {
              leaderReport.push(reports[i]._id);
            }
          }
          io.p2p.emit('getReports', {
            reports: reports,
            isSupervisor: (supervisorCheck.length > 0 || globalCheck.length > 0),
            leaders: leaderReport
          });
        }
      }
    }
  });

  io.p2p.on('addReport', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let now = dayjs().unix();
          let coworkers = _.map(data.coworkers, (coworker) => {
            return new ObjectId(coworker);
          });
          coworkers.push(uid);
          let stage = await models.stageModel.findOne({
            _id: new Object(data.tid)
          }).exec();
          if(stage.closed === 0) {
            let schema = await models.schemaModel.findOne({
              _id: new ObjectId(stage.sid)
            }).exec();
            let overlapedCheck = [];
            let group = await models.groupModel.findOne({
              sid: stage.sid,
              $or:[ 
                {leaders: uid},
                {members: uid}
              ]            
            }).exec();
            if(stage.reports.length > 0) {
              let reports = await models.reportModel.find({
                _id: { $in: stage.reports }
              }).exec();
              overlapedCheck = _.filter(reports, (report) => {
                return report.gid.equals(group._id);
              });
            }
            if(overlapedCheck.length === 0) {
              let userGroup = await models.groupModel.findOne({
                sid: schema._id,
                $or: [
                  { members: uid },
                  { leaders: uid }
                ]
              }).exec();
              if(await depositStatus(userGroup._id, stage._id, uid)) {
                let totalBalance = await getDepositBalance(stage._id ,userGroup._id);
                if(_.inRange(data.value, stage.depositStep, totalBalance[0].balance+0.1)) {
                  let report = await models.reportModel.create({
                    tick: now,
                    sid: stage.sid,
                    tid: stage._id,
                    coworkers: coworkers,
                    content: turndownService.turndown(data.content),
                    audit: [],
                    value: data.value,
                    grantedUser: undefined,
                    grantedDate: 0,
                    grantedValue: 0,
                    gained: 0,
                    gid: group._id,
                    visibility: true,
                    tag: group.tag,
                    locked: false,
                    lockedTick: 0,
                    totalBalance: Math.floor(totalBalance[0].balance),
                    intervention: []
                  });
                  stage.reports.push(report._id);
                  await stage.save();
                  await models.stageAssetModel.create({
                    tick: now,
                    sid: stage.sid,
                    tid: stage._id,
                    gid: group._id,
                    invalid: 0,
                    comment: "投入報告信心點數",
                    value: data.value * -1
                  });
                  await models.eventlogModel.create({
                    tick: now,
                    type: '報告系統',
                    desc: '發布報告',
                    sid: schema._id,
                    user: uid
                  });
                  io.p2p.emit('addReport', true);
                  return;
                }
              }
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '報告系統',
      tick: dayjs().unix(),
      action: '發布報告',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('addAudit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let now = dayjs().unix();
          let coworkers = _.map(data.coworkers, (coworker) => {
            return new ObjectId(coworker);
          });
          coworkers.push(uid);
          let report = await models.reportModel.findOne({
            _id: new Object(data.rid)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: new ObjectId(report.sid)
          }).exec();
          let stage = await models.stageModel.findOne({
            _id: new ObjectId(report.tid)
          }).exec();
          let group = await models.groupModel.findOne({
            sid: report.sid,
            $or:[ 
              {leaders: uid},
              {members: uid}
            ]
          }).exec();
          if(!report.gid.equals(group._id)) {
            if(stage.replyDisabled === 0 || stage.closed === 0) {
              let audits = await models.auditModel.find({
                _id: { $in: report.audits },
                visibility: true
              }).exec();
              let overlapedCheck = _.filter(audits, (audit) => {
                return audit.gid.equals(group._id);
              });
              if(overlapedCheck.length === 0) {
                let totalGroups = schema.groups.length;
                if(schema.tagGroupped) {
                  let sameGroup = await models.groupModel.find({
                    tag: group.tag,
                    sid: schema._id
                  }).exec();
                  totalGroups = sameGroup.length;
                }
                let evaluationGap = Math.ceil(totalGroups * schema.gapRate);
                if(evaluationGap > report.audits.length) {
                  let userGroup = await models.groupModel.findOne({
                    sid: schema._id,
                    $or: [
                      { members: uid },
                      { leaders: uid }
                    ]
                  }).exec();
                  if(await depositStatus(userGroup._id, stage._id, uid)) {
                    let totalBalance = await getDepositBalance(stage._id, userGroup._id);
                    if(_.inRange(data.value, stage.depositStep, totalBalance[0].balance+0.1)) {
                      let auditLimit = Math.floor(totalBalance[0].balance) > report.value ? report.value : Math.floor(totalBalance[0].balance);
                      auditLimit = report.value > auditLimit ? auditLimit : report.value;
                      if(data.value <= auditLimit) {
                        let audit = await models.auditModel.create({
                          tick: now,
                          sid: report.sid,
                          tid: report.tid,
                          rid: report._id,
                          coworkers: coworkers,
                          content: turndownService.turndown(data.content),
                          confirm: false,
                          value: data.value,
                          feedback: 0,
                          feedbackUser: undefined,
                          feedbackTick: 0,
                          gained: 0,
                          gid: group._id,
                          short: data.short,
                          totalBalance: Math.floor(totalBalance[0].balance),
                          intervention: [],
                          visibility: true,
                          revokeTick: 0
                        });
                        report.audits.push(audit._id);
                        await report.save();
                        await models.stageAssetModel.create({
                          tick: now,
                          sid: report.sid,
                          tid: report.tid,
                          gid: group._id,
                          invalid: 0,
                          comment: "投入評分信心點數",
                          value: data.value * -1
                        });
                        await models.eventlogModel.create({
                          tick: now,
                          type: '評分系統',
                          desc: '發布評分',
                          sid: schema._id,
                          user: uid
                        });
                        io.p2p.emit('addAudit', true);
                        return;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '評分系統',
      tick: dayjs().unix(),
      action: '發布評分',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('calcReport', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let report = await models.reportModel.findOne({
            _id: new ObjectId(data.report._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: report.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let globalCheck = _.intersectionWith(globalSetting.settingTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            let now = dayjs().unix();
            await models.eventlogModel.create({
              tick: now,
              type: '報告系統',
              desc: '手動要求系統計算報告評分',
              sid: report.sid,
              user: user
            });
            await evaluatedAudit(data.report._id, io.p2p.request.session.passport.user);
            await evaluatedReport(data.report._id, data.ignoreTime);
            io.p2p.emit('calcReport', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '評分系統',
      tick: dayjs().unix(),
      action: '計算評分',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('setGrant', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let report = await models.reportModel.findOne({
            _id: new ObjectId(data.report._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: report.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let globalCheck = _.intersectionWith(globalSetting.settingTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            report.grantedValue = data.report.grantedValue;
            report.grantedUser = uid;
            report.grantedDate = now;
            await report.save();
            await evaluatedAudit(data.report._id, io.p2p.request.session.passport.user);
            await evaluatedReport(data.report._id, data.ignoreTime);
            io.p2p.emit('setGrant', true);
            await models.eventlogModel.create({
              tick: now,
              type: '報告系統',
              desc: '手動設定報告評分',
              sid: report.sid,
              user: user
            });
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '評分系統',
      tick: dayjs().unix(),
      action: '計算評分',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('confirmAudit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let audit = await models.auditModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let report = await models.reportModel.findOne({
            _id: audit.rid
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: report.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let globalCheck = _.intersectionWith(globalSetting.settingTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            audit.confirm = audit.confirm > 0 ? 0 : now;
            await audit.save();
            io.p2p.emit('confirmAudit', true);
            await models.eventlogModel.create({
              tick: now,
              type: '報告系統',
              desc: '確認評分有效',
              sid: report.sid,
              user: user
            });
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '評分系統',
      tick: dayjs().unix(),
      action: '計算評分',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('auditFeedback', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let audit = await models.auditModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let report = await models.reportModel.findOne({
            _id: audit.rid
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: report.sid
          }).exec();
          let stage = await models.stageModel.findOne({
            _id: report.tid
          }).exec();
          let group = await models.groupModel.findOne({
            _id: report.gid
          }).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let ownerCheck = _.filter(_.unionWith(group.members, group.leaders, (a, b) => {
            return a.equals(b);
          }), (member) => {
            return member.equals(uid);
          });
          if(audit.visibility) {
            if(audit.feedbackTick === 0) {
              if(ownerCheck.length > 0) {
                let userGroup = await models.groupModel.findOne({
                  sid: schema._id,
                  $or: [
                    { members: uid },
                    { leaders: uid }
                  ]
                }).exec();
                if(await depositStatus(userGroup._id, stage._id, uid)) {
                  let totalBalance = await getDepositBalance(stage._id, userGroup._id);
                  if(totalBalance[0].balance >= stage.depositStep) {
                    if(totalBalance[0].balance >= stage.depositStep) {
                      if(_.inRange(data.feedback, stage.depositStep, totalBalance[0].balance+0.1)) {
                        let now = dayjs().unix();
                        audit.feedback = data.feedback;
                        audit.feedbackUser = uid;
                        audit.feedbackTick = now;
                        await report.save();
                        await audit.save();
                        await models.stageAssetModel.create({
                          tick: now,
                          sid: report.sid,
                          tid: stage._id,
                          gid: group._id,
                          invalid: 0,
                          comment: "確認評分結果",
                          value: (data.feedback * -1)
                        });
                        let feedbacked = await models.auditModel.find({
                          rid: audit.rid,
                          feedbackTick: { $gt: 0 },
                          visibility: true
                        });
                        if(!stage.matchPoint) {
                          if(!report.locked) {
                            let totalGroups = schema.groups.length;
                            if(schema.tagGroupped) {
                              let sameGroup = await models.groupModel.find({
                                tag: group.tag,
                                sid: schema._id
                              }).exec();
                              totalGroups = sameGroup.length;
                            }
                            let evaluationGap = Math.ceil(totalGroups * schema.gapRate);
                            evaluationGap = report.audits.length > evaluationGap ? report.audits.length : evaluationGap;
                            if(feedbacked.length >= evaluationGap) {
                              if(report.gained === 0) {
                                let falseCheck = _.filter(feedbacked, (audit) => {
                                  return audit.short;
                                });
                                if(falseCheck.length === 0) {
                                  await evaluatedAudit(report._id, undefined);
                                  await evaluatedReport(report._id, undefined);
                                }
                              }
                            }
                          }
                        }
                        await models.eventlogModel.create({
                          tick: now,
                          type: '報告系統',
                          desc: '確認評分結果',
                          sid: report.sid,
                          user: uid
                        });
                        io.p2p.emit('auditFeedback', true);
                        return;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '報告系統',
      tick: dayjs().unix(),
      action: '確認評分結果',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('getAuditionGap', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let schema = await models.schemaModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let group = await models.groupModel.findOne({
            sid: schema._id,
            $or:[ 
              {leaders: uid},
              {members: uid}
            ]
          }).exec();
          let totalGroups = schema.groups.length;
          if(group !== null) {
            if(schema.tagGroupped) {
              let sameGroup = await models.groupModel.find({
                tag: group.tag,
                sid: schema._id
              }).exec();
              totalGroups = sameGroup.length;
            }
          }
          let gapCount = Math.ceil(totalGroups * schema.gapRate);
          io.p2p.emit('getAuditionGap', gapCount);
        }
      }
    }
    return;
  });

  io.p2p.on('rejectAudit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let audition = await models.auditModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let report = await models.reportModel.findOne({
            _id: audition.rid
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: report.sid
          }).exec();
          let group = await models.groupModel.findOne({
            _id: audition.gid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let leaderCheck = _.filter(group.leaders, (leader) => {
            return leader.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          if(audition.visibility) {
            if(audition.feedbackTick === 0) {
              if(supervisorCheck.length > 0 || globalCheck.length > 0 || leaderCheck.length > 0) {
                report.locked = true;
                await report.save();
                audition.visibility = false;
                audition.revokeTick = now;
                await audition.save();
                report.audits = _.filter(report.audits, (audit) => {
                  return !audit.equals(audition._id);
                });
                report.locked = false;
                await report.save();
                await models.eventlogModel.create({
                  tick: now,
                  type: '報告系統',
                  desc: '撤銷互評',
                  sid: report.sid,
                  user: user
                });
                io.p2p.emit('rejectAudit', true);
                return;
              }
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '報告系統',
      tick: dayjs().unix(),
      action: '撤銷互評',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('rejectReport', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let report = await models.reportModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: report.sid
          }).exec();
          let group = await models.groupModel.findOne({
            _id: report.gid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let leaderCheck = _.filter(group.leaders, (leader) => {
            return leader.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let lockedReport = false;
          if(leaderCheck.length > 0) {
            lockedReport = !report.locked;
          }
          if(lockedReport || supervisorCheck.length > 0 || globalCheck.length > 0) {
            if(report.gained === 0) {
              if(report.visibility) {
                let stage = await models.stageModel.findOne({
                  _id: report.tid
                }).exec();
                let audits = await models.auditModel.find({
                  _id: { $in: report.audits },
                  visibility: true
                }).exec();
                for(let i=0; i<audits.length; i++) {
                  let audit = audits[i];
                  await models.stageAssetModel.create({
                    tick: now,
                    sid: report.sid,
                    tid: report.tid,
                    gid: group._id,
                    invalid: 0,
                    comment: "撤回報告歸還評分信心點數",
                    value: audit.value
                  });
                  await models.eventlogModel.create({
                    tick: now,
                    type: '報告系統',
                    desc: '歸還評分點數',
                    sid: report.sid,
                    user: uid
                  });
                }
                report.visibility = false;
                report.revokeTick = now;
                stage.reports = _.filter(stage.reports, (queued) => {
                  return !queued.equals(report._id);
                });
                await stage.save();
                await report.save();
                await models.eventlogModel.create({
                  tick: now,
                  type: '報告系統',
                  desc: '撤銷階段成果',
                  sid: report.sid,
                  user: user
                });
                io.p2p.emit('rejectReport', true);
                return;
              }
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '報告系統',
      tick: dayjs().unix(),
      action: '退回報告',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('addIntervention', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          if(data.content !== "") {
            let now = dayjs().unix();
            let globalSetting = await models.settingModel.findOne({}).exec();
            let uid = new ObjectId(io.p2p.request.session.passport.user);
            let user = await models.userModel.findOne({
              _id: uid
            }).exec();
            let report = undefined;
            let audit = undefined;
            let schema = undefined;
            if(data.type === 0) {
              report = await models.reportModel.findOne({
                _id: new ObjectId(data._id)
              }).exec();
              schema = await models.schemaModel.findOne({
                _id: report.sid
              }).exec();
            } else {
              audit = await models.auditModel.findOne({
                _id: new ObjectId(data._id)
              }).exec();
              report = await models.reportModel.findOne({
                _id: new ObjectId(data.rid)
              }).exec();
              schema = await models.schemaModel.findOne({
                _id: audit.sid
              }).exec();
            }
            let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
              return supervisor.equals(user._id);
            });
            let globalCheck = _.intersectionWith(globalSetting.settingTags, user.tags, (sTag, uTag) => {
              return sTag.equals(uTag);
            })
            if(supervisorCheck.length > 0 || globalCheck.length > 0) {
              let intervention = await models.interventionModel.create({
                tick: now,
                content: data.content,
                value: parseInt(Math.floor(data.value)),
                user: uid
              });
              if(data.type === 0) {
                report.intervention.push(intervention);
                await report.save();
              } else {
                audit.intervention.push(intervention);
                await audit.save();
              }
              let type = data.type === 0 ? "[成果]" : "[評分]";
              await models.eventlogModel.create({
                tick: now,
                type: '報告系統',
                desc: '人為干預評分' + type,
                sid: audit === undefined ? report.sid : audit.sid,
                user: uid
              });
              io.p2p.emit('addIntervention', {
                _id: audit === undefined ? report._id : audit._id,
                type: data.type
              });
              return;
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '評分系統',
      tick: dayjs().unix(),
      action: '鎖定報告',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('lockReport', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let report = await models.reportModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: report.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let globalCheck = _.intersectionWith(globalSetting.settingTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            report.locked = data.locked;
            report.lockedTick = now;
            await report.save();
            await models.eventlogModel.create({
              tick: now,
              type: '報告系統',
              desc: data.locked ? '鎖住報告關閉自動評分' : '解除報告鎖定',
              sid: report.sid,
              user: uid
            });
            io.p2p.emit('lockReport', report.locked);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '評分系統',
      tick: dayjs().unix(),
      action: '鎖定報告',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('previewReport', async (data) => {
    if(data.stage !== undefined) {
      if(io.p2p.request.session.status.type === 3) {
        if('passport' in io.p2p.request.session) {
          if('user' in io.p2p.request.session.passport) {
            let now = dayjs().unix();
            let stage = await models.stageModel.findOne({
              _id: new ObjectId(data.stage._id)
            }).exec();
            let schema = await models.schemaModel.findOne({
              _id: stage.sid
            }).exec();
            let uid = new ObjectId(io.p2p.request.session.passport.user);
            let userGroup = await models.groupModel.findOne({
              sid: schema._id,
              $or: [
                { members: uid },
                { leaders: uid }
              ]
            }).exec();
            if(userGroup !== null) {
              if(await depositStatus(userGroup._id, stage._id, uid)) {
                let totalBalance = await getDepositBalance(stage._id, userGroup._id);
                if(_.inRange(data.value, stage.depositStep, totalBalance[0].balance+0.1)) {
                  let timeValue = Math.ceil((stage.endTick - now) / 60 / 60);
                  timeValue = timeValue > 0 ? timeValue : 0;
                  let expired = timeValue > 0 ? 1 : 0;
                  timeValue = data.value === 0 ? 0 : timeValue;
                  let deposit = await models.depositModel.findOne({
                    tid: stage._id,
                    joinTick: { $gt: 0 },
                    confirm: true,
                    confirmTick: { $gt: 0 },
                    uid: uid
                  }).exec();
                  let depositPercentage = deposit.value / deposit.totalDeposit;
                  let previewScore = Math.ceil((((data.value * schema.workerRate) * stage.value * expired) + timeValue + data.value) * depositPercentage);
                  io.p2p.emit('previewReport', {
                    query: data.value,
                    score: previewScore
                  });
                }
              }
            }
            return;
          }
        }
      }
      io.p2p.emit('accessViolation', {
        where: '評分系統',
        tick: dayjs().unix(),
        action: '預覽報告點數',
        loginRequire: false
      });
    }
    return;
  });

  io.p2p.on('previewFeedback', async (data) => {
    if(data._id !== undefined) {
      if(io.p2p.request.session.status.type === 3) {
        if('passport' in io.p2p.request.session) {
          if('user' in io.p2p.request.session.passport) {
            let now = dayjs().unix();
            let uid = new ObjectId(io.p2p.request.session.passport.user);
            let audit = await models.auditModel.findOne({
              _id: new ObjectId(data._id)
            }).exec();
            let stage = await models.stageModel.findOne({
              _id: audit.tid
            }).exec();
            let schema = await models.schemaModel.findOne({
              _id: audit.sid
            }).exec();
            let report = await models.reportModel.findOne({
              _id: audit.rid
            }).exec();
            let userGroup = await models.groupModel.findOne({
              sid: schema._id,
              $or: [
                { members: uid },
                { leaders: uid }
              ]
            }).exec();
            if(await depositStatus(userGroup._id, stage._id, uid)) {
              let totalBalance = await getDepositBalance(stage._id, userGroup._id);
              if(_.inRange(data.value, stage.depositStep, totalBalance[0].balance+0.1)) {
                let timeValue = Math.ceil((stage.endTick - now) / 60 / 60);
                timeValue = Math.ceil((data.feedback / data.value) * timeValue);
                timeValue = timeValue > 0 ? timeValue : 0;
                let expired = timeValue > 0 ? 1 : 0;
                timeValue = data.value === 0 ? 0 : timeValue;
                let deposit = await models.depositModel.findOne({
                  tid: stage._id,
                  joinTick: { $gt: 0 },
                  confirm: true,
                  confirmTick: { $gt: 0 },
                  uid: uid
                }).exec();
                let depositPercentage = deposit.value / deposit.totalDeposit;
                let previewScore = Math.ceil((((report.value * schema.workerRate) * stage.value * expired) + timeValue + data.value) * (data.feedback / report.value).toFixed(2) * depositPercentage);
                io.p2p.emit('previewFeedback', {
                  query: data.feedback,
                  score: previewScore
                });
              }
            }
            return;
          }
        }
      }
      io.p2p.emit('accessViolation', {
        where: '評分系統',
        tick: dayjs().unix(),
        action: '預覽評分確認點數',
        loginRequire: false
      });
    }
    return;
  });

  io.p2p.on('previewAudit', async (data) => {
    if(data.report !== undefined) {
      if(io.p2p.request.session.status.type === 3) {
        if('passport' in io.p2p.request.session) {
          if('user' in io.p2p.request.session.passport) {
            let now = dayjs().unix();
            let uid = new ObjectId(io.p2p.request.session.passport.user);
            let report = await models.reportModel.findOne({
              _id: new ObjectId(data.report._id)
            }).exec();
            let schema = await models.schemaModel.findOne({
              _id: report.sid
            }).exec();
            let stage = await models.stageModel.findOne({
              _id: report.tid
            }).exec();
            let auditScore = data.value * stage.value;
            if(data.short) {
              auditScore = auditScore * schema.shortBonus;
            }
            let userGroup = await models.groupModel.findOne({
              sid: schema._id,
              $or: [
                { members: uid },
                { leaders: uid }
              ]
            }).exec();
            if(await depositStatus(userGroup._id, stage._id, uid)) {
              let totalBalance = await getDepositBalance(stage._id, userGroup._id);
              if(_.inRange(data.value, stage.depositStep, totalBalance[0].balance+0.1)) {
                let maxBet = Math.floor(totalBalance[0].balance) > report.value ? report.value : Math.floor(totalBalance[0].balance);
                let timeValue = Math.abs(Math.ceil((stage.endTick - report.tick) / 60 / 60));
                timeValue = Math.ceil((data.value / maxBet) * timeValue);
                let group = await models.groupModel.findOne({
                  sid: report.sid,
                  $or:[ 
                    {leaders: uid},
                    {members: uid}
                  ]
                }).exec();
                let totalGroups = schema.groups.length;
                if(schema.tagGroupped) {
                  let sameGroup = await models.groupModel.find({
                    tag: group.tag,
                    sid: schema._id
                  }).exec();
                  totalGroups = sameGroup.length;
                }
                let evaluationGap = Math.ceil(totalGroups * schema.gapRate);
                evaluationGap = report.audits.length > evaluationGap ? report.audits.length : evaluationGap;
                let rank = evaluationGap - report.audits.length;
                if(rank <= 0) {
                  io.p2p.emit('previewAudit', {
                    query: data.value,
                    score: 0
                  });
                } else {
                  let deposit = await models.depositModel.findOne({
                    tid: stage._id,
                    joinTick: { $gt: 0 },
                    confirm: true,
                    confirmTick: { $gt: 0 },
                    uid: uid
                  }).exec();
                  let depositPercentage = deposit.value / deposit.totalDeposit;
                  let valueAudit = Math.ceil((auditScore + Math.ceil(timeValue * ( rank / evaluationGap))) * schema.workerRate * depositPercentage);
                  io.p2p.emit('previewAudit', {
                    query: data.value,
                    score: valueAudit
                  });
                }
              }
            }
            return;
          }
        }
      }
      io.p2p.emit('accessViolation', {
        where: '評分系統',
        tick: dayjs().unix(),
        action: '預覽評分點數',
        loginRequire: false
      });
    }
    return;
  });

  return router;
}
