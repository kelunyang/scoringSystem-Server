import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';
import _ from 'lodash';

export default function (io, models) {
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
  let sameTaggedGroup = async(uid, sid) => {
    let tagGroup = await models.groupModel.findOne({
      sid: new ObjectId(sid),
      $or:[ 
        {leaders: new ObjectId(uid)},
        {members: new ObjectId(uid)}
      ]   
    }).exec();
    let groups = await models.groupModel.find({
      tag: tagGroup.tag
    }).exec();
    let members = _.flatten(_.map(groups, (group) => {
      return _.unionWith(group.members, group.leaders, (a, b) => {
        return a === b;
      });
    }));
    return members;
  }
  let getAccounting = async (uid, sid, startTick, endTick, keyword, logNum) => {
    let queryCmd = [];
    queryCmd.push({
      $match: {
        invalid: 0
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
    if(uid !== undefined) {
      queryCmd.push({
        $match: {
          uid: new ObjectId(uid)
        }
      });
    }
    if(sid !== undefined) {
      queryCmd.push({
        $match: {
          sid: new ObjectId(sid)
        }
      });
    }
    if(keyword !== undefined) {
      queryCmd.push(
        {
          $match: {
            desc: new RegExp(keyword, "g")
          }
        }
      );
    }
    queryCmd.push({
      $lookup: {
        from: 'userDB',
        as: '_id',
        let: { assetUID: "$uid" },
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
        as: 'uid'
      },
    });
    queryCmd.push({
      $lookup: {
        from: 'schemaDB',
        localField: 'sid',
        foreignField: '_id',
        as: 'sid'
      },
    });
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
    return await models.accountingModel.aggregate(queryCmd);
  }

  let updateTotalDeposit = async(tid, userGroup) => {
    if(userGroup === undefined) {
      return false;
    } else {
      let groupMembers = await models.depositModel.find({
        gid: userGroup._id,
        tid: tid
      }).exec();
      let joined = _.filter(groupMembers, (member) => {
        return member.joinTick > 0;
      });
      if(joined.length === groupMembers.length) {
        let accepted = _.filter(joined, (member) => {
          return member.confirm;
        });
        return _.sumBy(accepted, (member) => {
          return member.value;
        })
      }
      return false;
    }
  }

  let getDeposited = async(tid, userGroup) => {
    if(userGroup === undefined) {
      return true;
    } else {
      let stage = await models.stageModel.findOne({
        _id: tid
      }).exec();
      let deposits = await models.depositModel.find({
        tid: tid,
        gid: userGroup._id
      }).exec();
      let now = dayjs().unix();
      let members = _.unionWith(userGroup.members, userGroup.leaders, (userM, userL) => {
        return (new ObjectId(userM)).equals(new ObjectId(userL));
      });
      let notDeposited = _.differenceWith(members, deposits, (member, deposited) => {
        return member._id.equals(deposited.uid);
      });
      if(notDeposited.length > 0) {
        let depositRequests = [];
        for(let i=0; i<notDeposited.length; i++) {
          depositRequests.push({
            tid: tid,
            uid: notDeposited[i],
            gid: userGroup._id,
            value: 0,
            confirmTick: 0,
            confirm: false,
            requestTick: now,
            totalDeposit: 0,
            joinTick: 0
          });
        }
        await models.depositModel.insertMany(depositRequests);
      };
      let notConfimed = await models.depositModel.find({
        tid: tid,
        gid: userGroup._id,
        confirmTick: 0,
        confirm: false,
        joinTick: 0
      }).exec();
      let proceed = notConfimed.length === 0;
      if(notConfimed.length > 0) {
        if(stage.endTick < now) {
          await models.depositModel.updateMany({
            tid: stage._id,
            gid: userGroup._id,
            confirm: false,
            confirmTick: 0,
            joinTick: 0
          }, {
            confirmTick: now,
            joinTick: now,
            value: 0,
            totalDeposit: 0
          });
          let totalDeposit = await updateTotalDeposit(stage._id, userGroup);
          if(totalDeposit !== false) {
            await models.depositModel.updateMany({
              tid: stage._id,
              gid: userGroup._id,
              confirm: true,
              confirmTick: { $gt: 0 },
              joinTick: { $gt: 0 }
            }, {
              totalDeposit: totalDeposit
            });
          }
          proceed = true;
        }
      }
      return proceed;
    }
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
  
  let getBalance = async (uid, sid, type) => {
    uid = _.map(uid, (u) => {
      if(typeof(u) === 'string') {
        return new ObjectId(u);
      } else {
        return new ObjectId(u._id);
      }
    });
    let queryCmd = [];
    queryCmd.push({
      $match: {
        invalid: 0
      }
    });
    if(uid !== undefined) {
      queryCmd.push({
        $match: {
          uid: { $in: uid }
        }
      });
    }
    if(sid !== undefined) {
      queryCmd.push({
        $match: {
          sid: new ObjectId(sid)
        }
      });
    }
    if(type === 0) {
      queryCmd.push(
        {
          $group: {
            _id: "$sid",
            balance: {
              $sum: "$value"
            }
          }
        }
      );
      queryCmd.push({
        $lookup: {
          from: 'schemaDB',
          localField: 'sid',
          foreignField: '_id',
          as: 'sid'
        },
      });
    } else {
      queryCmd.push(
        {
          $group: {
            _id: "$uid",
            balance: {
              $sum: "$value"
            }
          }
        }
      );
      queryCmd.push({
        $lookup: {
          from: 'userDB',
          as: '_id',
          let: { assetUID: "$_id" },
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
          as: 'uid'
        },
      },  {
        $unwind: '$uid'
      });
    }
    return await models.accountingModel.aggregate(queryCmd);
  }

  io.p2p.on('getPersonalBalance', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('user' in io.p2p.request.session.passport) {
        let uid = data.uid === undefined ? io.p2p.request.session.passport.user : data.uid;
        let balance = await getBalance([uid], data.sid, 0);
        io.p2p.emit('getPersonalBalance', balance);
      }
    }
    return;
  });

  io.p2p.on('getPersonalAccounting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('user' in io.p2p.request.session.passport) {
        let uid = data.uid === undefined ? io.p2p.request.session.passport.user : data.uid
        let startTick = undefined;
        let endTick = undefined;
        if(data.assetDates[0] !== data.assetDates[1]) {
          startTick = dayjs(data.assetDates[0]).unix() > dayjs(data.assetDates[1]).unix() ? dayjs(data.assetDates[1]).unix() : dayjs(data.assetDates[0]).unix();
          endTick = dayjs(data.assetDates[0]).unix() > dayjs(data.assetDates[1]).unix() ? dayjs(data.assetDates[0]).unix() : dayjs(data.assetDates[1]).unix();
        }
        let accounting = await getAccounting(uid, data.sid, startTick, endTick, data.assetKeyword, data.assetNum);
        io.p2p.emit('getPersonalAccounting', accounting);
      }
    }
    return;
  });

  io.p2p.on('getSchemaBalance', async (data) => {
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
          let queryData = [];
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            if(data.uids === undefined) {
              queryData = (await getGrouped(sid))[0].allMemebers
            } else if(data.uids.length === 0) {
              queryData = [currentUserID];
            } else {
              queryData = data.uids;
            }
          } else {
            let groupMembers = [];
            if(schema.tagGroupped) {
              groupMembers = await sameTaggedGroup(io.p2p.request.session.passport.user, data.sid);
            } else {
              groupMembers = (await getGrouped(data.sid))[0].allMemebers;
            }
            if(data.uids === undefined) {
              queryData = groupMembers;
            } else if(data.uids.length === 0) {
              queryData = [currentUserID];
            } else {
              queryData = _.intersectionWith(data.uids, groupMembers, (uid, member) => {
                if(typeof(uid) !== 'string') {
                  uid = uid._id;
                }
                return (new ObjectId(uid)).equals(member);
              })
            }
          }
          if(queryData.length > 0) {
            let balance = await getBalance(queryData, data.sid, 1);
            io.p2p.emit('getSchemaBalance', {
              data: balance,
              usage: data.usage
            });
          }
        }
      }
    }
    return;
  });

  io.p2p.on('setBonus', async (data) => {
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
            let gids = _.map(data.gid, (id) => {
              return new ObjectId(id);
            })
            let queryResult = await models.groupModel.aggregate([
              {
                $match: {
                  _id: { $in: gids },
                  sid: sid
                }
              },
              {
                $project: {
                  combinedIds: { $concatArrays: ["$leaders", "$members"] }
                }
              },
              {
                $unwind: "$combinedIds"
              },
              {
                $group: {
                  _id: null,
                  combinedIds: { $addToSet: "$combinedIds" }
                }
              },
              {
                $unwind: "$combinedIds"
              },
              {
                $replaceRoot: { newRoot: { combinedId: "$combinedIds" } }
              },
              {
                $group: {
                  _id: null,
                  combinedIds: { $push: "$combinedId" }
                }
              },
              {
                $project: {
                  _id: 0,
                  combinedIds: 1
                }
              }
            ]);
            var flatCombinedIds = _.flatten(queryResult.map(item => item.combinedIds));
            let accountingDocuments = flatCombinedIds.map(user => ({
              tick: now,
              desc: data.desc,
              sid: sid,
              uid: user,
              invalid: 0,
              value: Number(data.value)
            }));
            
            await models.accountingModel.insertMany(accountingDocuments);            
            await models.eventlogModel.create({
              tick: now,
              type: '記帳系統',
              desc: '發送獎金給' + flatCombinedIds.length + "人，每個人拿" + Number(data.value) + "，名義為" + data.desc,
              sid: sid,
              user: user._id
            });
            io.p2p.emit('setBonus', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '記帳系統',
      tick: dayjs().unix(),
      action: '設定用戶特殊點數',
      loginRequire: true
    });
    return;
  });

  io.p2p.on('queryBonus', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
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
            let gids = _.map(data.gid, (id) => {
              return new ObjectId(id);
            })
            let queryResult = await models.groupModel.aggregate([
              {
                $match: {
                  _id: { $in: gids },
                  sid: sid
                }
              },
              {
                $project: {
                  combinedIds: {
                    $concatArrays: ["$leaders", "$members"]
                  }
                }
              },
              {
                $unwind: "$combinedIds"
              },
              {
                $group: {
                  _id: null,
                  combinedIds: { $addToSet: "$combinedIds" }
                }
              },
              {
                $project: {
                  _id: 0,
                  combinedIds: 1
                }
              },
              {
                $lookup: {
                  from: "accountingDB",
                  let: { uids: "$combinedIds" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $in: ["$uid", "$$uids"] },
                            { $eq: ["$invalid", 0] },
                            { $regexMatch: { input: "$desc", regex: data.desc, options: "i" } }
                          ]
                        },
                        sid: sid
                      }
                    },
                    {
                      $lookup: {
                        from: "userDB",
                        localField: "uid",
                        foreignField: "_id",
                        as: "user"
                      }
                    },
                    {
                      $project: {
                        _id: 1,
                        tick: 1,
                        sid: 1,
                        uid: 1,
                        value: 1,
                        desc: 1,
                        invalid: 1,
                        __v: 1,
                        user: { $arrayElemAt: ["$user", 0] } // 將 user 陣列轉換為物件
                      }
                    }
                  ],
                  as: "accountingResults"
                }
              },
              {
                $project: {
                  accountingResults: 1
                }
              }
            ]);
            var flatAccountingResults = _.flatten(queryResult.map(item => item.accountingResults));
            io.p2p.emit('queryBonus', flatAccountingResults);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '記帳系統',
      tick: dayjs().unix(),
      action: '查詢用戶特殊點數',
      loginRequire: true
    });
    return;
  });

  io.p2p.on('rejectBonusAccounting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let sid = new ObjectId(data.sid);
          let user = await models.userModel.findOne({
            _id: uid
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
          })
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            let aids = _.map(data.aids, (aid) => {
              return new ObjectId(aid);
            })
            await models.accountingModel.updateMany(
              { 
                _id: { $in: aids },
                desc: { $regex: data.desc, $options: "i" },
                sid: sid
              },
              { $set: { invalid: now } }
            )
            await models.eventlogModel.create({
              tick: now,
              type: '記帳系統',
              desc: '撤銷特殊獎金紀錄，關鍵字為：' + data.desc,
              sid: sid,
              user: user._id
            });
            io.p2p.emit('rejectBonusAccounting', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '記帳系統',
      tick: dayjs().unix(),
      action: '撤銷特殊獎金紀錄',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('rejectAccounting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let accounting = await models.accountingModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: accounting.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            accounting.invalid = accounting.invalid === 0 ? now : 0;
            await accounting.save();
            await models.eventlogModel.create({
              tick: now,
              type: '記帳系統',
              desc: '撤銷記帳紀錄',
              sid: schema._id,
              user: user._id
            });
            io.p2p.emit('rejectAccounting', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '記帳系統',
      tick: dayjs().unix(),
      action: '退回記帳紀錄',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('rejectDeposit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('passport' in io.p2p.request.session) {
        if('user' in io.p2p.request.session.passport) {
          let now = dayjs().unix();
          let globalSetting = await models.settingModel.findOne({}).exec();
          let uid = new ObjectId(io.p2p.request.session.passport.user);
          let user = await models.userModel.findOne({
            _id: uid
          }).exec();
          let accounting = await models.stageAssetModel.findOne({
            _id: new ObjectId(data._id)
          }).exec();
          let schema = await models.schemaModel.findOne({
            _id: accounting.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          if(supervisorCheck.length > 0 || globalCheck.length > 0) {
            accounting.invalid = accounting.invalid === 0 ? now : 0;
            await accounting.save();
            await models.eventlogModel.create({
              tick: now,
              type: '押金系統',
              desc: '撤銷押金紀錄',
              sid: schema._id,
              user: user
            });
            io.p2p.emit('rejectDeposit', true);
            return;
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '記帳系統',
      tick: dayjs().unix(),
      action: '退回記帳紀錄',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('getDeposit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('user' in io.p2p.request.session.passport) {
        let globalSetting = await models.settingModel.findOne({}).exec();
        let uid = new ObjectId(io.p2p.request.session.passport.user);
        let user = await models.userModel.findOne({
          _id: uid
        }).exec();
        let stage = await models.stageModel.findOne({
          _id: new ObjectId(data.tid)
        }).exec();
        let schema = await models.schemaModel.findOne({
          _id: stage.sid
        }).exec();
        let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
          return supervisor.equals(user._id);
        });
        let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
        let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
          return sTag.equals(uTag);
        })
        let queryUser = user._id;
        let isSupervisor = false;
        if(supervisorCheck.length > 0 || globalCheck.length > 0) {
          queryUser = data.qUser === undefined ? undefined : new ObjectId(data.qUser);
          isSupervisor = true;
        }
        let userGroup = queryUser !== undefined ? await models.groupModel.findOne({
          sid: schema._id,
          $or: [
            { members: queryUser },
            { leaders: queryUser }
          ]
        }).exec() : undefined;
        await getDeposited(stage._id, userGroup);
        let queryCmd = [];
        if(userGroup === undefined) {
          queryCmd.push({
            $match: {
              tid: stage._id
            }
          });
        } else {
          if(!isSupervisor) {
            let leaderCheck = await models.groupModel.find({
              _id: userGroup._id,
              sid: schema._id,
              leaders: queryUser
            }).exec();
            isSupervisor = leaderCheck.length > 0;
          }
          queryCmd.push({
            $match: {
              tid: stage._id,
              gid: userGroup._id
            }
          });
        }
        queryCmd.push({
          $lookup: {
            from: 'userDB',
            as: '_id',
            let: { assetUID: "$uid" },
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
            as: 'uid'
          },
        });
        queryCmd.push({
          $unwind: '$uid'
        });
        queryCmd.push({
          $group: {
            _id: "$_id",
            tid: { $first: "$tid" },
            uid: { $first: "$uid" },
            gid: { $first: "$gid"},
            value: { $first: "$value"},
            confirmTick: { $first: "$confirmTick"},
            confirm: { $first: "$confirm"},
            joinTick: { $first: "$joinTick"},
            requestTick: { $first: "$requestTick"},
            totalDeposit: { $first: "$totalDeposit"},
          }
        });
        let deposits = await models.depositModel.aggregate(queryCmd);
        io.p2p.emit('getDeposit', {
          deposits: deposits,
          isSupervisor: isSupervisor
        });
        return;
      }
    }
    io.p2p.emit('accessViolation', {
      where: '記帳系統',
      tick: dayjs().unix(),
      action: '確認押金狀態',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('getDepositBalance', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('user' in io.p2p.request.session.passport) {
        let globalSetting = await models.settingModel.findOne({}).exec();
        let uid = new ObjectId(io.p2p.request.session.passport.user);
        let user = await models.userModel.findOne({
          _id: uid
        }).exec();
        let stage = await models.stageModel.findOne({
          _id: new ObjectId(data.tid)
        }).exec();
        let schema = await models.schemaModel.findOne({
          _id: stage.sid
        }).exec();
        let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
          return supervisor.equals(user._id);
        });
        let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
        let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
          return sTag.equals(uTag);
        })
        let queryUser = user._id;
        let proceed = false;
        if(supervisorCheck.length > 0 || globalCheck.length > 0) {
          queryUser = data.qUser === undefined ? undefined : new ObjectId(data.qUser);
          proceed = true;
        }
        let userGroup = queryUser !== undefined ? await models.groupModel.findOne({
          sid: schema._id,
          $or: [
            { members: queryUser },
            { leaders: queryUser }
          ]
        }).exec() : undefined;
        if(await getDeposited(stage._id, userGroup)) {
          if(!proceed) {
            let depositCheck = await models.depositModel.findOne({
              uid: queryUser,
              tid: stage._id
            }).exec();
            if(depositCheck === null || !depositCheck.confirm ) userGroup = undefined;
          }
          let balance = userGroup === undefined ? 0 : (await getDepositBalance(stage._id, userGroup._id))[0].balance;
          io.p2p.emit('getDepositBalance', balance);
          return;
        }
      }
    }
    return;
  });

  io.p2p.on('getDepositAccounting', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('user' in io.p2p.request.session.passport) {
        let globalSetting = await models.settingModel.findOne({}).exec();
        let uid = new ObjectId(io.p2p.request.session.passport.user);
        let user = await models.userModel.findOne({
          _id: uid
        }).exec();
        let stage = await models.stageModel.findOne({
          _id: new ObjectId(data.tid)
        }).exec();
        let schema = await models.schemaModel.findOne({
          _id: stage.sid
        }).exec();
        let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
          return supervisor.equals(user._id);
        });
        let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
        let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
          return sTag.equals(uTag);
        })
        let userGroup = undefined;
        if(supervisorCheck.length > 0 || globalCheck.length > 0) {
          userGroup = new ObjectId(data.gid);
        } else {
          let group = await models.groupModel.findOne({
            sid: schema._id,
            $or: [
              { members: uid },
              { leaders: uid }
            ]
          }).exec();
          if(group._id.equals(new ObjectId(data.gid))) {
            userGroup = new ObjectId(data.gid);
          }
        }
        if(await getDeposited(stage._id, userGroup)) {
          let accounting = userGroup === undefined ? [] : await models.stageAssetModel.find({
            tid: stage._id,
            gid: userGroup,
            invalid: 0
          }).exec();
          io.p2p.emit('getDepositAccounting', accounting);
          return;
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '記帳系統',
      tick: dayjs().unix(),
      action: '取得回合押金明細',
      loginRequire: false
    });
    return;
  });

  io.p2p.on('joinStage', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('user' in io.p2p.request.session.passport) {
        let globalSetting = await models.settingModel.findOne({}).exec();
        let uid = new ObjectId(io.p2p.request.session.passport.user);
        let user = await models.userModel.findOne({
          _id: uid
        }).exec();
        let stage = await models.stageModel.findOne({
          _id: new ObjectId(data.tid)
        }).exec();
        let schema = await models.schemaModel.findOne({
          _id: stage.sid
        }).exec();
        let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
          return supervisor.equals(user._id);
        });
        let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
        let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
          return sTag.equals(uTag);
        })
        let queryUser = user._id;
        if(supervisorCheck.length > 0 || globalCheck.length > 0) {
          queryUser = data.queryUser === undefined ? undefined : new ObjectId(data.queryUser);
        } else {
          if(data.queryUser !== undefined) {
            let user = new ObjectId(data.queryUser);
            if(!user.equals(uid)) {
              let leaderCheck = await models.groupModel.find({
                sid: schema._id,
                leaders: uid,
                members: user
              }).exec();
              if(leaderCheck.length > 0) {
                queryUser = user;
              }
            }
          }
        }
        queryUser = await models.userModel.findOne({
          _id: queryUser
        }).exec();
        let userGroup = queryUser !== undefined ? await models.groupModel.findOne({
          sid: schema._id,
          $or: [
            { members: queryUser._id },
            { leaders: queryUser._id }
          ]
        }).exec() : undefined;
        if(!await getDeposited(stage._id, userGroup)) {
          if(userGroup !== undefined) {
            let now = dayjs().unix();
            let deposit = await models.depositModel.findOne({
              tid: stage._id,
              uid: queryUser._id
            }).exec();
            if(deposit.joinTick === 0) {
              if(now <= stage.endTick) {
                if(deposit.confirmTick === 0) {
                  if(!deposit.confirm) {
                    let userBalance = await getBalance([queryUser], stage.sid, 0);
                    if(userBalance[0].balance >= stage.defaultDeposit) {
                      deposit.confirmTick = now;
                      deposit.confirm = data.confirm;
                      deposit.value = data.confirm ? stage.defaultDeposit : 0;
                      deposit.totalDeposit = 0;
                      deposit.joinTick = now;
                      await deposit.save();
                      if(data.confirm) {
                        await models.stageAssetModel.create({
                          tid: stage._id,
                          value: stage.defaultDeposit,
                          gid: userGroup._id,
                          sid: schema._id,
                          invalid: 0,
                          comment: queryUser.name + "加入回合",
                          tick: now
                        });
                        await models.accountingModel.create({
                          uid: queryUser._id,
                          value: stage.defaultDeposit * -1,
                          gid: userGroup._id,
                          sid: schema._id,
                          invalid: 0,
                          desc: queryUser.name + "加入回合",
                          tick: now
                        });
                        await models.eventlogModel.create({
                          tick: now,
                          type: '記帳系統',
                          desc: queryUser.name + "加入回合",
                          sid: schema._id,
                          user: queryUser._id
                        });
                      }
                      let totalDeposit = await updateTotalDeposit(stage._id, userGroup);
                      if(totalDeposit !== false) {
                        await models.depositModel.updateMany({
                          tid: stage._id,
                          gid: userGroup._id,
                          confirm: true,
                          confirmTick: { $gt: 0 },
                          joinTick: { $gt: 0 }
                        }, {
                          totalDeposit: totalDeposit
                        });
                      }
                      io.p2p.emit('joinStage', true);
                      return
                    }
                  }
                }
              }
            }
          }
          io.p2p.emit('joinStage', false);
          return;
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '記帳系統',
      tick: dayjs().unix(),
      action: '加入回合',
      loginRequire: false
    });
    return;
  });
  io.p2p.on('revokeDeposit', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if('user' in io.p2p.request.session.passport) {
        let now = dayjs().unix();
        let globalSetting = await models.settingModel.findOne({}).exec();
        let uid = new ObjectId(io.p2p.request.session.passport.user);
        let user = await models.userModel.findOne({
          _id: uid
        }).exec();
        let stage = await models.stageModel.findOne({
          _id: new ObjectId(data.tid)
        }).exec();
        if(stage.endTick > now) {
          let schema = await models.schemaModel.findOne({
            _id: stage.sid
          }).exec();
          let supervisorCheck = _.filter(schema.supervisors, (supervisor) => {
            return supervisor.equals(user._id);
          });
          let authorizedTags = _.flatten(globalSetting.settingTags, globalSetting.projectTags)
          let globalCheck = _.intersectionWith(authorizedTags, user.tags, (sTag, uTag) => {
            return sTag.equals(uTag);
          })
          let leaderCheck = await models.groupModel.find({
            sid: schema._id,
            leaders: uid
          }).exec();
          let queryUser = await models.userModel.findOne({
            _id: new ObjectId(data.user)
          }).exec();
          if(queryUser !== null) {
            if(supervisorCheck.length > 0 || leaderCheck.length > 0 || globalCheck.length > 0) {
              let deposit = await models.depositModel.findOne({
                tid: stage._id,
                uid: queryUser._id
              }).exec();
              if(deposit !== null) {
                deposit.joinTick = 0;
                deposit.confirm = false;
                deposit.confirmTick = 0;
                await deposit.save();
                await models.eventlogModel.create({
                  tick: now,
                  type: '記帳系統',
                  desc: queryUser.name + "回合狀態被重置（原本不加入回合）",
                  sid: schema._id,
                  user: queryUser._id
                });
                io.p2p.emit('revokeDeposit', true);
                io.p2p.emit('joinStage', true);
                return;
              }
            }
          }
        }
      }
    }
    io.p2p.emit('accessViolation', {
      where: '記帳系統',
      tick: dayjs().unix(),
      action: '重設未押注者',
      loginRequire: false
    });
    return;
  });

  return router;
}
