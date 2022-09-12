import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';
import _ from 'lodash';
import TurndownService from 'turndown';
const turndownService = new TurndownService();

export default function (io, models) {
  let sameTaggedGroup = async(uid, tid) => {
    let stage = await models.stageModel.findOne({
      _id: new ObjectId(tid)
    }).exec();
    let tagGroup = await models.groupModel.findOne({
      sid: stage.sid,
      $or:[ 
        {leaders: { $in: [new ObjectId(uid)] }},
        {members: { $in: [new ObjectId(uid)] }}
      ]
    }).exec();
    let reports = await models.reportModel.find({
      tag: tagGroup.tag,
      tid: stage._id,
      visibility: true
    }).exec();
    return reports;
  }
  let getEventLog = async (sid, keyword, logNum, startTick ,endTick) => {
    let queryCmd = [];
    queryCmd.push({
      $match: {
        sid: new ObjectId(sid)
      }
    });
    if(startTick !== undefined) {
      queryCmd.push({
        $match: {
          tick: {
            $gte: startTick,
            $lte: endTick
          }
        }
      });
    }
    queryCmd.push({
      $lookup: {
        from: 'userDB',
        as: '_id',
        let: { assetUID: "$user" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$$assetUID", "$_id"]
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
        as: 'user'
      }
    });
    queryCmd.push({ $unwind: { "path": "$user", "preserveNullAndEmptyArrays": true } });
    queryCmd.push({
      $addFields: 
        { 
          queryWords: { $concat: [ "$user.name", "$desc", "$type" ] }
        }
      }
    );
    queryCmd.push(
      {
        $match: {
          queryWords: new RegExp(keyword, "g")
        }
      }
    );
    queryCmd.push(
      {
        $sort: {
          tick: -1
        }
      },
      {
        $limit: logNum
      }
    );
    return await models.eventlogModel.aggregate(queryCmd);
  }

  let getSchemas = async(status) => {
    let schemaList = [];
    if(status !== undefined) {
      schemaList = await models.schemaModel.find({
        status: status
      }).exec()
    } else {
      schemaList = await models.schemaModel.find().exec()
    }
    return schemaList;
  }

  let getJoined = async(uid) => {
    let groups = await models.groupModel.find({
      $or:[ 
        {leaders: { $in: [new ObjectId(uid)] }},
        {members: { $in: [new ObjectId(uid)] }}
      ]
    }).exec();
    return await models.schemaModel.find({
      $or:[ 
        { groups: { $in: _.map(groups, (group) => { return group._id }) } },
        { supervisors: { $in: [new ObjectId(uid)] } }
      ]
    }).populate('stages').populate('groups').exec();
  }

  let getSchema = async(sid) => {
    return await models.schemaModel.findOne({
      _id: new ObjectId(sid)
    })
    .populate('stages')
    .populate('groups')
    .populate('supervisors', '-password -lineToken -lineCode')
    .exec();
  }

  io.p2p.on('getEventLog', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let startTick = undefined;
      let endTick = undefined;
      if(data.logRange[0] !== data.logRange[1]) {
        startTick = dayjs(data.logRange[0]).unix() > dayjs(data.logRange[1]).unix() ? dayjs(data.logRange[1]).unix() : dayjs(data.logRange[0]).unix();
        endTick = dayjs(data.logRange[0]).unix() > dayjs(data.logRange[1]).unix() ? dayjs(data.logRange[0]).unix() : dayjs(data.logRange[1]).unix();
      }
      let returnLog = await getEventLog(data.sid, data.keyword, data.logNum, startTick, endTick);
      io.p2p.emit('getEventLog', returnLog);
    }
    return;
  });
  
  io.p2p.on('getSchemas', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          if(globalCheck.length > 0) {
            let schemas = await getSchemas(data.status);
            io.p2p.emit('getSchemas', schemas);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '載入活動清單',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('getJoined', async () => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('passport' in io.p2p.request.session) {
          if('user' in io.p2p.request.session.passport) {
            let supervisSchemas = [];
            let leadSchemas = [];
            let globalSetting = await models.settingModel.findOne({}).exec();
            let uid = new ObjectId(io.p2p.request.session.passport.user);
            let user = await models.userModel.findOne({
              _id: uid
            }).exec();
            let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
            let schemas = await getJoined(io.p2p.request.session.passport.user);
            for(let i=0; i<schemas.length; i++) {
              let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
                return sTag.equals(uTag);
              })
              let schema = await models.schemaModel.findOne({
                _id: schemas[i]._id
              }).exec();
              let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
                return supervisor.equals(user._id);
              });
              let leaderCheck = await models.groupModel.findOne({
                sid: schema._id,
                leaders: { $in: [user._id] }
              }).exec();
              if(globalCheck.length > 0 || supervisorCheck.length > 0) {
                supervisSchemas.push(schema._id);
              } else if(leaderCheck !== null) {
                leadSchemas.push({
                  sid: schema._id,
                  group: leaderCheck
                });
              }
            }
            io.p2p.emit('getJoined', {
              schemas: schemas,
              supervisorList: supervisSchemas,
              leaderList: leadSchemas
            });
          }
        }
      }
    }
    return;
  });

  io.p2p.on('getSchema', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('passport' in io.p2p.request.session) {
          if('user' in io.p2p.request.session.passport) {
            let schema = await getSchema(data);
            io.p2p.emit('getSchema', schema);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '查詢活動',
      loginRequire: true
    });
    return;
  });

  io.p2p.on('getStages', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('passport' in io.p2p.request.session) {
          if('user' in io.p2p.request.session.passport) {
            let globalSetting = await models.settingModel.findOne({}).exec();
            let uid = new ObjectId(io.p2p.request.session.passport.user);
            let user = await models.userModel.findOne({
              _id: uid
            }).exec();
            let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
            let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
              return sTag.equals(uTag);
            })
            let schema = await models.schemaModel.findOne({
              _id: new ObjectId(data)
            }).exec();
            let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
              return supervisor.equals(user._id);
            });
            if(globalCheck.length > 0 || supervisorCheck.length > 0) {
              let stages = await models.stageModel.find({
                sid: schema._id
              }).sort('order').exec();
              io.p2p.emit('getStages', stages);
              return;
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '查詢活動階段列表',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('getStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('passport' in io.p2p.request.session) {
          if('user' in io.p2p.request.session.passport) {
            let globalSetting = await models.settingModel.findOne({}).exec();
            let uid = new ObjectId(io.p2p.request.session.passport.user);
            let user = await models.userModel.findOne({
              _id: uid
            }).exec();
            let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
            let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
              return sTag.equals(uTag);
            })
            let stage = await models.stageModel.findOne({
              _id: new ObjectId(data._id)
            })
            .exec();
            let schema = await models.schemaModel.findOne({
              _id: stage.sid
            }).exec();
            let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
              return supervisor.equals(user._id);
            });
            if(globalCheck.length > 0 || supervisorCheck.length > 0) {
              io.p2p.emit('getStage', stage);
            } else {
              let reports = await sameTaggedGroup(user._id, stage._id);
              io.p2p.emit('getStage', {
                _id: stage._id,
                name: stage.name,
                createTick: stage.createTick,
                modTick: stage.modTick,
                endTick: stage.endTick,
                startTick: stage.startTick,
                order: stage.order,
                value: stage.value,
                sid: stage.sid,
                closed: stage.closed,
                depositStep: stage.depositStep,
                replyDisabled: stage.replyDisabled,
                reports: _.map(reports, (report) => {
                  return report._id;
                }),
                desc: stage.desc,
                matchPoint: stage.matchPoint
              });
            }
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '查詢活動階段',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('addSchema', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          if(globalCheck.length > 0) {
            let now = dayjs().unix();
            let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
            let supervisors = _.map(data.supervisors, (supervisor) => {
              return new ObjectId(supervisor);
            })
            let schema = await models.schemaModel.create({
              createTick: now,
              modTick: now,
              name: data.name,
              supervisors: supervisors,
              groups: [],
              stages: [],
              gapRate: data.gapRate,
              initCapital: data.initCapital,
              status: data.status,
              leaderRate: data.leaderRate,
              workerRate: data.workerRate,
              memberRate: data.memberRate,
              tagGroupped: data.tagGroupped,
              shortBonus: data.shortBonus
            });
            let event = await models.eventlogModel.create({
              tick: now,
              type: '活動管理',
              desc: '增加活動',
              sid: schema._id,
              user: currentUserID
            });
            io.p2p.emit('addSchema', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '增加活動',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('addStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let schema = await models.schemaModel.findOne({
            _id: new ObjectId(data.sid)
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          if(globalCheck.length > 0 || supervisorCheck.length > 0) {
            let now = dayjs().unix();
            let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
            let startTick = now;
            let endTick = now;
            let stage = await models.stageModel.create({
              createTick: now,
              modTick: now,
              name: "",
              desc: "",
              startTick: now,
              endTick: now,
              order: data.order,
              value: 0,
              reports: [],
              sid: schema._id,
              matchPoint: false,
              closed: 0,
              replyDisabled: 0
            });
            schema.stages.push(stage._id);
            await schema.save();
            let event = await models.eventlogModel.create({
              tick: now,
              type: '活動管理',
              desc: '增加活動階段',
              sid: schema._id,
              user: currentUserID
            });
            io.p2p.emit('addStage', stage._id);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '增加活動階段',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('modSchema', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let schema = await models.schemaModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          if(globalCheck.length > 0 || supervisorCheck.length > 0) {
            let now = dayjs().unix();
            let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
            let supervisors = _.map(data.supervisors, (supervisor) => {
              return new ObjectId(supervisor);
            })
            schema.modTick = now;
            schema.name = data.name;
            schema.supervisors = supervisors;
            schema.initCapital = data.initCapital;
            schema.status = data.status;
            schema.gapRate = data.gapRate;
            schema.leaderCapital = data.leaderCapital;
            schema.workerCapital = data.workerCapital;
            schema.memberCapital = data.memberCapital;
            schema.tagGroupped = data.tagGroupped;
            schema.shortBonus = data.shortBonus;
            await schema.save();
            let event = await models.eventlogModel.create({
              tick: now,
              type: '活動管理',
              desc: '修改活動',
              sid: schema._id,
              user: currentUserID
            });
            io.p2p.emit('modSchema', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '修改活動',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('orderStages', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let schema = await models.schemaModel.findOne({
            _id: new ObjectId(data.sid)
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          if(globalCheck.length > 0 || supervisorCheck.length > 0) {
            for(let i=0; i<data.stageList.length; i++) {
              let stage = await models.stageModel.findOne({
                _id: new ObjectId(data.stageList[i]._id)
              }).exec();
              stage.order = data.stageList[i].order;
              await stage.save();
            }
            io.p2p.emit('orderStages', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '修改活動階段列表',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('modStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let stage = await models.stageModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: stage.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          if(globalCheck.length > 0 || supervisorCheck.length > 0) {
            let now = dayjs().unix();
            let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
            stage.modTick = now;
            stage.name = data.name;
            stage.desc = turndownService.turndown(data.desc);
            stage.defaultDeposit = data.defaultDeposit;
            stage.depositStep = data.depositStep;
            stage.startTick = data.startTick;
            stage.endTick = data.endTick;
            stage.order = data.order;
            stage.value = data.value;
            stage.matchPoint = data.matchPoint;
            await stage.save();
            await models.eventlogModel.create({
              tick: now,
              type: '活動管理',
              desc: '修改活動階段',
              sid: stage.sid,
              user: currentUserID
            });
            io.p2p.emit('modStage', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '修改活動階段',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('closeStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let stage = await models.stageModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: stage.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          if(globalCheck.length > 0 || supervisorCheck.length > 0) {
            stage.closed = stage.closed > 0 ? 0 : now;
            await stage.save();
            let event = await models.eventlogModel.create({
              tick: now,
              type: '活動管理',
              desc: '關閉活動階段',
              sid: schema._id,
              user: currentUserID
            });
            io.p2p.emit('closeStage', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '關閉活動階段',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('noreplyStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let stage = await models.stageModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: stage.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          if(globalCheck.length > 0 || supervisorCheck.length > 0) {
            stage.replyDisabled = stage.replyDisabled > 0 ? 0 : now;
            await stage.save();
            let event = await models.eventlogModel.create({
              tick: now,
              type: '活動管理',
              desc: '禁止活動階段評分',
              sid: schema._id,
              user: currentUserID
            });
            io.p2p.emit('noreplyStage', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '關閉活動階段',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('removeStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let stage = await models.stageModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: stage.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          if(globalCheck.length > 0 || supervisorCheck.length > 0) {
            await models.auditModel.deleteMany({
              tid: stage._id
            }).exec();
            await models.reportModel.deleteMany({
              tid: stage._id
            }).exec();
            await models.stageModel.deleteOne({
              _id: stage._id
            }).exec();
            schema.stages = _.filter(schema.stages, (stageQ) => {
              return !stageQ._id.equals(stage._id);
            });
            await schema.save();
            let event = await models.eventlogModel.create({
              tick: now,
              type: '活動管理',
              desc: '刪除活動階段',
              sid: schema._id,
              user: currentUserID
            });
            io.p2p.emit('removeStage', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '刪除活動階段',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('removeSchema', async (data) => {
    if('passport' in io.p2p.request.session) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let schema = await models.schemaModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          if(globalCheck.length > 0 || supervisorCheck.length > 0) {
            let stage = await models.stageModel.findOne({
              _id: new ObjectId(data.tid)
            }).exec();
            await models.auditModel.deleteMany({
              sid: schema._id
            }).exec();
            await models.reportModel.deleteMany({
              sid: schema._id
            }).exec();
            await models.stageModel.deleteMany({
              sid: schema._id
            }).exec();
            await models.eventlogModel.deleteMany({
              sid: schema._id
            }).exec();
            await models.groupModel.deleteMany({
              sid: schema._id
            }).exec();
            await models.accountingModel.deleteMany({
              sid: schema._id
            }).exec();
            await models.schemaModel.deleteOne({
              _id: schema._id
            }).exec();
            io.p2p.emit('removeSchema', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '刪除活動',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('statusSchema', async (data) => {
    if('passport' in io.p2p.request.session) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let schema = await models.schemaModel.findOne({
            _id: new ObjectId(data.sid)
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          if(globalCheck.length > 0 || supervisorCheck.length > 0) {
            schema.status = data.status;
            await schema.save();
            io.p2p.emit('statusSchema', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '活動管理',
      tick: dayjs().unix(),
      action: '調整活動狀態',
      loginRequire: false
    });
    return;
  });

  return router;
}
