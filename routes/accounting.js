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
        {leaders: { $in: [new ObjectId(uid)] }},
        {members: { $in: [new ObjectId(uid)] }}
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
          if(supervisorCheck.length > 0 || globalCheck > 0) {
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
          if(supervisorCheck.length > 0 || globalCheck > 0) {
            accounting.invalid = accounting.invalid === 0 ? now : 0;
            await accounting.save();
            await models.eventlogModel.create({
              tick: now,
              type: '記帳系統',
              desc: '撤銷記帳紀錄',
              sid: schema._id,
              user: user
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

  return router;
}
