import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';
import _ from 'lodash';

export default function (io, models) {
  let getGroups = async (sid) => {
    let groups = [];
    if('passport' in io.p2p.request.session) {
      if('user' in io.p2p.request.session.passport) {
        groups = await models.groupModel.find({
          sid: new ObjectId(sid)
        })
        .exec();
      }
    }
    return groups;
  }

  let getGroup = async (gid) => {
    if('passport' in io.p2p.request.session) {
      if('user' in io.p2p.request.session.passport) {
        let group = await models.groupModel.findOne({
          _id: new ObjectId(gid)
        })
        .populate('leaders', '-password -lineToken -lineCode')
        .populate('members', '-password -lineToken -lineCode')
        .exec();
        return group;
      }
    }
  }

  let getPersonalGroup = async (sid, uid) => {
    let groups = [];
    if('passport' in io.p2p.request.session) {
      if('user' in io.p2p.request.session.passport) {
        group = await models.groupModel.findOne({
          sid: new ObjectId(sid),
          members: {
            $in: [new ObjectId(uid)]
          }
        })
        .populate('leaders', '-password -lineToken -lineCode')
        .populate('members', '-password -lineToken -lineCode')
        .exec();
      }
    }
    return group;
  }

  let getGrouped = async (sid, gid) => {
    let groupedUsers = [];
    if('passport' in io.p2p.request.session) {
      if('user' in io.p2p.request.session.passport) {
        let queryCmd = [
          {
            $match: {
              sid: new ObjectId(sid)
            }
          },
        ];
        if(gid !== undefined) {
          queryCmd.push({
            $match: {
              _id: {$ne: new ObjectId(gid) }
            }
          })
        }
        queryCmd.push(
          {
            $project: {
              allMemebers: {
                $setUnion: ['$members', '$leaders']
              }
            }
          },
          {
            $unwind: {
              path: "$allMemebers",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $group: {
              _id: null,
              allMemebers: { $addToSet: "$allMemebers" }
            }
          }
        );
        return await models.groupModel.aggregate(queryCmd);
      }
    }
    return groupedUsers;
  }

  let getLoners = async (sid, keywords, tags) => {
    let availableUsers = [];
    if('passport' in io.p2p.request.session) {
      if('user' in io.p2p.request.session.passport) {
        let groupQ = await getGrouped(sid, undefined);
        let grouped = groupQ.length === 0 ? groupQ : groupQ[0].allMemebers;
        let currentUser = await models.userModel.findOne({
          _id: new ObjectId(io.p2p.request.session.passport.user)
        }).exec();
        let setting = await models.settingModel.findOne({}).exec();
        let settingIncluded = _.intersectionWith(currentUser.tags, setting.settingTags, (uTag, sTag) => {
          return uTag.equals(sTag);
        });
        let projectIncluded = _.intersectionWith(currentUser.tags, setting.projectTags, (uTag, pTag) => {
          return uTag.equals(pTag);
        });
        let queryCmd = [];
        if(settingIncluded.length > 0 || projectIncluded.length > 0) {
          if(tags !== undefined) {
            queryCmd.push(
              {
                $match: {
                  tags: { $in: tags }
                }
              }
            );
          }
        } else {
          let ownGroup = await models.groupModel.findOne({
            sid: new Object(sid),
            $or:[ 
              {leaders: { $in: [currentUser._id] }},
              {members: { $in: [currentUser._id] }}
            ]   
          }).exec();
          if(ownGroup !== null) {
            queryCmd.push({
              $match: {
                tags: { $in: [ownGroup.tag] }
              }
            });
          }
        }
        if(grouped.length > 0) {
          queryCmd.push({
            $match: {
              _id: { $nin: grouped }
            }
          });
        }
        if(keywords !== undefined) {
          queryCmd.push(
            {
              $match: {
                name: new RegExp(keywords, "g")
              }
            }
          );
        }
        queryCmd.push({
          $project: { 
            lineCode: 0,
            lineDate: 0,
            lineToken: 0,
            password: 0
          }
        });
        return await models.userModel.aggregate(queryCmd);
      }
    }
    return availableUsers;
  }

  io.p2p.on('getLeaders', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let leaderNames = [];
      for(let i=0; i<data.length; i++) {
        let group = await getGroup(data[i]);
        leaderNames.push({
          gid: group._id,
          leaders: group.leaders
        })
      }
      io.p2p.emit('getLeaders', leaderNames);
    }
  });

  io.p2p.on('getGroups', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let sid = new ObjectId(data.sid);
          let user = await models.userModel.findOne({
            _id: currentUserID
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          });
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            let groups = await getGroups(data.sid);
            io.p2p.emit('getGroups', groups);
          } else {
            let leaderGroup = await models.groupModel.findOne({
              sid: sid,
              leaders: { $in: [user._id] }
            }).exec();
            if(leaderGroup !== null) {
              io.p2p.emit('getGroups', [leaderGroup]);
            }
          }
          return;
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '群組管理',
      tick: dayjs().unix(),
      action: '查詢群組清單',
      loginRequire: true
    });
    return;
  });

  io.p2p.on('getCoworkers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let group = await models.groupModel.findOne({
        $or:[ 
          {leaders: { $in: [new ObjectId(io.p2p.request.session.passport.user)] }},
          {members: { $in: [new ObjectId(io.p2p.request.session.passport.user)] }}
        ],
        sid: new ObjectId(data.sid)
      })
      .populate('members')
      .populate('leaders')
      .exec();
      if(group !== null) {
        let joinedWorkers = await models.depositModel.find({
          gid: group._id,
          tid: new ObjectId(data.tid),
          confirm: true,
          confirmTick: { $gt: 0 },
          joinTick: { $gt: 0 }
        }).exec();
        let coworkers = group === null ? [] : _.unionWith(group.members, group.leaders, (member, leader) => {
          return member._id.equals(leader._id);
        });
        coworkers = _.intersectionWith(coworkers, joinedWorkers, (listed, joined) => {
          return listed._id.equals(joined.uid);
        });
        io.p2p.emit('getCoworkers', _.filter(coworkers, (user) => { return !user._id.equals(new ObjectId(io.p2p.request.session.passport.user)) }));
      } else {
        io.p2p.emit('getCoworkers', []);
      }
      return;
    }
  });

  io.p2p.on('getGroup', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let group = await getGroup(data.gid);
      io.p2p.emit('getGroup', group);
    }
  });

  io.p2p.on('getPersonalGroup', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let group = await getPersonalGroup(data.sid, io.p2p.request.session.passport.user);
          io.p2p.emit('getPersonalGroup', group);
        }
      }
    }
  });

  io.p2p.on('setMember', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let sid = new ObjectId(data.sid);
          let user = await models.userModel.findOne({
            _id: currentUserID
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: sid
          }).exec();
          let group = await models.groupModel.findOne({
            _id: new ObjectId(data.gid)
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
          });
          let leaderAuthorized = false;
          if(leaderCheck.length > 0) {
            if(!group.locked) {
              leaderAuthorized = true;
            }
          }
          if(leaderAuthorized || supervisorCheck.length > 0 || globalCheck.length > 0) {
            let members = _.map(data.members, (member) => {
              return new ObjectId(member);
            })
            members = _.differenceWith(members, group.leaders, (member, leader) => {
              return member.equals(leader);
            });
            let groupedQ = await getGrouped(data.sid, group._id);
            let groupeds = groupedQ.length === 0 ? groupedQ : groupedQ[0].allMemebers;
            let memberOverlaped = _.intersectionWith(members, groupeds, (member, grouped) => {
              return member.equals(grouped);
            });
            if(memberOverlaped.length === 0) {
              /*let loners = await getLoners(data.sid, undefined, undefined);
              loners = _.differenceWith(loners, group.leaders, (loner, leader) => {
                return leader.equals(loner._id);
              });
              let newbies = _.intersectionWith(members, loners, (member, loner) => {
                return member.equals(loner._id);
              });
              for(let i=0; i<newbies.length; i++) {
                let newbie = newbies[i];
                let deposit = await models.accountingModel.create({
                  tick: now,
                  desc: '活動初始點數',
                  sid: sid,
                  uid: newbie,
                  invalid: 0,
                  value: schema.initCapital
                });
              }*/
              let removeTOBE = _.differenceWith(group.members, members, (oldMember, newMember) => {
                return oldMember._id.equals(newMember._id);
              });
              await models.depositModel.deleteMany({
                uid: { $in: removeTOBE },
                gid: group._id
              });
              group.members = members;
              group.modTick = now;
              await group.save();
              let event = await models.eventlogModel.create({
                tick: now,
                type: '群組管理',
                desc: '設定群組成員',
                sid: sid,
                user: currentUserID
              });
              io.p2p.emit('setMember', true);
              return;
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '群組管理',
      tick: dayjs().unix(),
      action: '設定群組成員',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('setLeader', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let sid = new ObjectId(data.sid);
          let user = await models.userModel.findOne({
            _id: currentUserID
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: sid
          }).exec();
          let group = await models.groupModel.findOne({
            _id: new ObjectId(data.gid)
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
          });
          let leaderAuthorized = false;
          if(leaderCheck.length > 0) {
            if(!group.locked) {
              leaderAuthorized = true;
            }
          }
          if(leaderAuthorized || supervisorCheck.length > 0 || globalCheck.length > 0) {
            let leaders = _.map(data.leaders, (leader) => {
              return new ObjectId(leader);
            })
            leaders = _.differenceWith(leaders, group.members, (leader, member) => {
              return leader.equals(member);
            });
            let groupedQ = await getGrouped(data.sid, group._id);
            let groupeds = groupedQ.length === 0 ? groupedQ : groupedQ[0].allMemebers;
            let leaderOverlaped = _.intersectionWith(leaders, groupeds, (leader, grouped) => {
              return leader.equals(grouped);
            });
            if(leaderOverlaped.length === 0) {
              /*let loners = await getLoners(data.sid, undefined, undefined);
              loners = _.differenceWith(loners, group.members, (loner, member) => {
                return member.equals(loner._id);
              });
              let newbies = _.intersectionWith(leaders, loners, (member, loner) => {
                return member.equals(loner._id);
              });
              for(let i=0; i<newbies.length; i++) {
                let newbie = newbies[i];
                let deposit = await models.accountingModel.create({
                  tick: now,
                  desc: '活動初始點數',
                  sid: sid,
                  uid: newbie,
                  invalid: 0,
                  value: schema.initCapital
                });
              }*/
              group.leaders = leaders;
              group.modTick = now;
              await group.save();
              let event = await models.eventlogModel.create({
                tick: now,
                type: '群組管理',
                desc: '設定組長',
                sid: sid,
                user: currentUserID
              });
              io.p2p.emit('setLeader', true);
              return;
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '群組管理',
      tick: dayjs().unix(),
      action: '設定組長',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('getLoner', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let keywords = data.keywords === "" ? undefined : data.keywords;
          let tags = data.tags.length === 0 ? undefined : _.map(data.tags, (tag) => {
            return new ObjectId(tag);
          });
          let loners = await getLoners(data.sid, keywords, tags);
          io.p2p.emit('getLoner', loners);
        }
      }
    }
    return;
  });

  io.p2p.on('addGroup', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let sid = new ObjectId(data.sid);
          let user = await models.userModel.findOne({
            _id: currentUserID
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          });
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            let tag = data.tag === "" ? undefined : new ObjectId(data.tag);
            for(let i=0; i<data.groupCount; i++) {
              let group = tag === undefined ? 
              await models.groupModel.create({ 
                createTick: now,
                modTick: now,
                members: [],
                leaders: [],
                locked: false,
                sid: sid,
              }) : await models.groupModel.create({ 
                createTick: now,
                modTick: now,
                members: [],
                leaders: [],
                locked: false,
                sid: sid,
                tag:tag
              });
              schema.groups.push(group._id);
            }
            await schema.save();
            let event = await models.eventlogModel.create({
              tick: now,
              type: '群組管理',
              desc: '增加群組',
              sid: sid,
              user: currentUserID
            });
            io.p2p.emit('addGroup', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '群組管理',
      tick: dayjs().unix(),
      action: '增加群組',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('removeGroup', async (data) => {
    if('passport' in io.p2p.request.session) {
      if(io.p2p.request.session.status.type === 3) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let sid = new ObjectId(data.sid);
          let user = await models.userModel.findOne({
            _id: currentUserID
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: sid
          }).exec();
          let group = await models.groupModel.findOne({
            _id: new ObjectId(data.gid)
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          });
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            if(group !== null) {
              schema.groups = _.filter(schema.groups, (sgroup) => {
                return !sgroup._id.equals(group._id);
              });
              await schema.save();
              await models.depositModel.deleteMany({
                gid: group._id
              });
              group = await models.groupModel.deleteOne({
                _id: group._id
              }).exec();
              let event = await models.eventlogModel.create({
                tick: now,
                type: '群組管理',
                desc: '刪除群組',
                sid: sid,
                user: currentUserID
              });
              io.p2p.emit('removeGroup', true);
              return;
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '群組管理',
      tick: dayjs().unix(),
      action: '刪除群組',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('setLocker', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let sid = new ObjectId(data.sid);
          let user = await models.userModel.findOne({
            _id: currentUserID
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: sid
          }).exec();
          let group = await models.groupModel.findOne({
            _id: new ObjectId(data.gid)
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          });
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            group.locked = data.locked;
            group.modTick = now;
            await group.save();
            let event = await models.eventlogModel.create({
              tick: now,
              type: '群組管理',
              desc: '鎖定群組',
              sid: sid,
              user: currentUserID
            });
            io.p2p.emit('setLocker', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '群組管理',
      tick: dayjs().unix(),
      action: '鎖定群組',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('setGroupTag', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let sid = new ObjectId(data.sid);
          let user = await models.userModel.findOne({
            _id: currentUserID
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: sid
          }).exec();
          let group = await models.groupModel.findOne({
            _id: new ObjectId(data.gid)
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          });
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            group.tag = data.tag;
            group.modTick = now;
            await group.save();
            let event = await models.eventlogModel.create({
              tick: now,
              type: '群組管理',
              desc: '調整分組標籤',
              sid: sid,
              user: currentUserID
            });
            io.p2p.emit('setGroupTag', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '群組管理',
      tick: dayjs().unix(),
      action: '調整分組標籤',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('getSchemaUsers', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let currentUserID = new ObjectId(io.p2p.request.session.passport.user);
          let sid = new ObjectId(data);
          let user = await models.userModel.findOne({
            _id: currentUserID
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          });
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            let allGroupped = (await getGrouped(data));
            if(allGroupped.length > 0) {
              let inSchema = allGroupped[0].allMemebers;
              let users = await models.userModel.find({
                _id: { $in:inSchema }
              }).select('-password -lineToken -lineCode').exec();
              io.p2p.emit('getSchemaUsers', users);
              return;
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '取得參與特定活動的使用者清單',
      tick: dayjs().unix(),
      action: '分組模組',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('getOwnGroup', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let group = await models.groupModel.findOne({
            sid: new ObjectId(data),
            $or:[ 
              {leaders: uid },
              {members: uid }
            ]
          }).exec();
          io.p2p.emit('getOwnGroup', group);
          return;
        }
      }
    }
    return;
  });

  io.p2p.on('getGroupTags', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let ids = _.map(data, (id) => {
            return new ObjectId(id);
          })
          let group = await models.groupModel.aggregate([
            {
              $match: {
                _id: {
                  $in: ids
                }
              }
            },
            {
              $project: {
                tag: 1
              }
            },
            {
              $group: {
                _id: undefined,
                tags: {
                  $addToSet: "$tag"
                }
              }
            }
          ]).exec();
          io.p2p.emit('getGroupTags', group.length > 0 ? group[0].tags : []);
          return;
        }
      }
    }
    return;
  });

  io.p2p.on('getTagGroups', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let ids = _.map(data.ids, (id) => {
            return new ObjectId(id);
          });
          let groups = await models.groupModel.find({
            tid: new ObjectId(data.tid),
            tag: { $in: ids }
          }).select('_id').exec();
          io.p2p.emit('getTagGroups', groups);
          return;
        }
      }
    }
    return;
  });

  return router;
}
