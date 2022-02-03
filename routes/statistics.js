import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import _ from 'lodash';
import { ObjectId } from 'bson';

export default function (io, models) {
  io.p2p.on('periodKBStatistics', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let range = data.type === 0 ? '%Y-%m-%d' : data.type === 1 ? '%Y-%m' : '%Y';
      let tempCriteria = [];
      if(data.starttick > 0) {
        tempCriteria.push({
          $match: {
            logTick: { $gte: data.starttick }
          }
        })
      }
      if(data.endtick > 0) {
        tempCriteria.push({
          $match: {
            logTick: { $lte: data.endtick }
          }
        })
      }
      if(data.KB !== undefined) {
        tempCriteria.push({
          $match: {
            KB: new ObjectId(data.KB)
          }
        })
      }
      if(data.querytypeTag !== '') {
        tempCriteria.push({
          $match: {
            typeTags: {
              $in: [new ObjectId(data.querytypeTag)]
            }
          }
        });
      }
      if(data.querysourceTags.length > 0) {
        tempCriteria.push({
          $match: {
            sourceTag: {
              $in: _.map(data.querysourceTags, (tag) => {
                return new ObjectId(tag);
              })
            }
          }
        });
      }
      if(data.queryKBTags.length > 0) {
        tempCriteria.push(
        {
          $lookup: {
            from: 'KBDB',
            localField: 'KB',
            foreignField: '_id',
            as: 'KB'
          }
        },
        {
          $unwind: {
            path: '$KB'
          }
        },
        {
          $match: {
            'KB.tag': {
              $in: _.map(data.queryKBTags, (tag) => {
                return new ObjectId(tag);
              })
            }
          }
        });
      }
      let queryCriteria = _.flatten([tempCriteria,[
        {
          $project: {
            logTick: {
              $add: ['$logTick', 8 * 3600]
            },
            value: 1
          }
        },
        {
          $addFields: {
            dateTick: { 
              $toDate: {
                $multiply: 
                  [
                    '$logTick' , 1000
                  ]
                }
            }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: range, date: "$dateTick" } },
            peroidlySum: {
              $sum: "$value"
            }
          }
        },
        {
          $sort: {
            _id: 1
          }
        }
      ]]);
      let result = await models.statisticsKBModel.aggregate(queryCriteria);
      io.p2p.emit('periodKBStatistics', result);
    }
    return;
  });

  io.p2p.on('periodKBranking', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let tempCriteria = [];
      if(data.starttick > 0) {
        tempCriteria.push({
          $match: {
            logTick: { $gte: data.starttick }
          }
        })
      }
      if(data.endtick > 0) {
        tempCriteria.push({
          $match: {
            logTick: { $lte: data.endtick }
          }
        })
      }
      if(data.KB !== undefined) {
        tempCriteria.push({
          $match: {
            KB: new ObjectId(data.KB)
          }
        })
      }
      if(data.querytypeTag !== '') {
        tempCriteria.push({
          $match: {
            typeTags: {
              $in: [new ObjectId(data.querytypeTag)]
            }
          }
        });
      }
      if(data.querysourceTags.length > 0) {
        tempCriteria.push({
          $match: {
            sourceTag: {
              $in: _.map(data.querysourceTags, (tag) => {
                return new ObjectId(tag);
              })
            }
          }
        });
      }
      tempCriteria.push(
        {
          $group: {
            _id: "$KB",
            KBSum: {
              $sum: "$value"
            }
          }
        },
        {
          $lookup: {
            from: 'KBDB',
            localField: '_id',
            foreignField: '_id',
            as: '_id'
          }
        },
        {
          $unwind: {
            path: '$_id'
          }
        },
      );
      if(data.queryKBTags.length > 0) {
        tempCriteria.push({
          $match: {
            '_id.tag': {
              $in: _.map(data.queryKBTags, (tag) => {
                return new ObjectId(tag);
              })
            }
          }
        });
      }
      let queryCriteria = _.flatten([tempCriteria,[
        {
          $sort: {
            KBSum: -1
          }
        }
      ]]);
      let result = await models.statisticsKBModel.aggregate(queryCriteria);
      io.p2p.emit('periodKBranking', result);
    }
    return;
  });


  return router;
}