import express from 'express';
const router = express.Router();
import dayjs from 'dayjs';
import fs from 'fs-extra';
import JSZip from "jszip";
import Papa from 'papaparse';
import _ from 'lodash';
import stripBOM from 'strip-bom';
import mime from 'mime-types';
import { ObjectId } from 'bson';
import { marked } from 'marked';
import axios from 'axios';
import qs from 'qs';
import stream from 'stream';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import nodemailer from "nodemailer";
import concat from 'concat-stream';
import generator from 'generate-password';

let files = {}, 
    struct = { 
        name: null, 
        type: null, 
        size: 0, 
        data: [], 
        slice: 0, 
    };

export default function (io, models) {
  io.p2p.on('deleteMsgFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      try {
        let globalSetting = await models.settingModel.findOne({}).exec();
        let exist = await fs.access(globalSetting.storageLocation + '/' + data.fileID);
        if(exist) { await fs.remove(globalSetting.storageLocation + '/' + data.fileID); }
        await models.fileModel.deleteOne({
          _id: data.fileID
        }).populate('attachments').exec();
        let msg = await models.messageModel.findOne({
          _id: data.msgID
        }).exec();
        msg.attachments = msg.attachments.filter((att) => {
          return !att._id.equals(data.fileID);
        });
        await msg.save();
        return io.p2p.emit('getmsgAttachment', msg.attachments);
      } catch(err) {
        console.log(JSON.stringify(err));
        io.p2p.emit('msgFileDeleteError', JSON.stringify(err)); 
      }
    }
    return;
  }); 

  io.p2p.on('sendMsgFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      if (!files[data.uuid]) { 
        files[data.uuid] = Object.assign({}, struct, data); 
        files[data.uuid].data = []; 
      }
      data.data = Buffer.from(new Uint8Array(data.data)); 
      files[data.uuid].data.push(data.data); 
      files[data.uuid].slice++;
      if (files[data.uuid].slice * 100000 >= files[data.uuid].size) { 
        let fileBuffer = Buffer.concat(files[data.uuid].data);
        let file = await models.fileModel.create({ 
          tick: dayjs().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile(globalSetting.storageLocation + '/' + file._id, fileBuffer, "binary");
          delete files[data.uuid]; 
          file.status = 1;
          file.writeConfirm = true;
          await file.save();
          let message = await models.messageModel.findOne({
            _id: data.uid
          }).exec();
          message.attachments.push(file._id);
          message.save();
          io.p2p.emit('msgFileUploadDone', message._id);
        } catch (err) {
          return io.p2p.emit('msgFileUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestMsgSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
    return;
  });

  io.p2p.on('deletefeedbackFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      try {
        let globalSetting = await models.settingModel.findOne({}).exec();
        let exist = await fs.access(globalSetting.storageLocation + '/' + data.fileID);
        if(exist) { await fs.remove(globalSetting.storageLocation + '/' + data.fileID); }
        await models.fileModel.deleteOne({
          _id: data.fileID
        }).exec();
        let feedback = await models.feedbackModel.findOne({
          _id: data.feedbackID
        }).populate('attachments').exec();
        feedback.attachments = feedback.attachments.filter((att) => {
          return !att._id.equals(data.fileID);
        });
        await feedback.save();
        io.p2p.emit('getfeedbackAttachment', feedback.attachments);
      } catch(err) {
        console.log(JSON.stringify(err));
        io.p2p.emit('feedbackFileDeleteError', JSON.stringify(err)); 
      }
    }
    return;
  }); 

  io.p2p.on('sendfeedbackFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      if (!files[data.uuid]) { 
        files[data.uuid] = Object.assign({}, struct, data); 
        files[data.uuid].data = []; 
      }
      data.data = Buffer.from(new Uint8Array(data.data)); 
      files[data.uuid].data.push(data.data); 
      files[data.uuid].slice++;
      if (files[data.uuid].slice * 100000 >= files[data.uuid].size) { 
        let fileBuffer = Buffer.concat(files[data.uuid].data);
        let file = await models.fileModel.create({ 
          tick: dayjs().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile(globalSetting.storageLocation + '/' + file._id, fileBuffer, "binary");
          delete files[data.uuid]; 
          file.status = 1;
          file.writeConfirm = true;
          await file.save();
          let feedback = await models.feedbackModel.findOne({
            _id: data.uid
          }).exec();
          feedback.attachments.push(file._id);
          feedback.save();
          io.p2p.emit('feedbackFileUploadDone', feedback._id);
        } catch (err) {
          return io.p2p.emit('feedbackFileUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestfeedbackSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
    return;
  });

  io.p2p.on('deleteissueFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      let issue = await models.issueModel.findOne({
        _id: data.issueID
      })
      .populate('attachments')
      .populate({
        path: 'KB',
        populate: { path: 'stages' }
      })
      .exec();
      let currentUser = new ObjectId(io.p2p.request.session.passport.user);
      let KBstage = _.find(issue.KB.stages, (stage) => {
          return stage.current;
      });
      let user =  await models.userModel.findOne({
        _id: currentUser
      }).exec();
      let autherizedTags = _.flatten([KBstage.pmTags, globalSetting.settingTags]);
      let tagCheck = (_.intersectionWith(user.tags, autherizedTags, (uTag, aTag) => {
        return uTag.equals(aTag);
      })).length > 0;
      if(tagCheck || (new ObjectId(issue.user)).equals(currentUser)) {
        try {
          let exist = await fs.access(globalSetting.storageLocation + '/' + data.fileID);
          if(exist) { await fs.remove(globalSetting.storageLocation + '/' + data.fileID); }
          await models.fileModel.deleteOne({
            _id: data.fileID
          }).exec();
          issue.attachments = issue.attachments.filter((att) => {
            return !att._id.equals(data.fileID);
          });
          io.p2p.emit('getissueAttachment', issue.attachments);
        } catch(err) {
          console.log(JSON.stringify(err));
          io.p2p.emit('issueFileDeleteError', JSON.stringify(err)); 
        }
      }
    }
    return;
  }); 

  io.p2p.on('sendissueFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      if (!files[data.uuid]) { 
        files[data.uuid] = Object.assign({}, struct, data); 
        files[data.uuid].data = []; 
      }
      data.data = Buffer.from(new Uint8Array(data.data)); 
      files[data.uuid].data.push(data.data); 
      files[data.uuid].slice++;
      if (files[data.uuid].slice * 100000 >= files[data.uuid].size) { 
        let fileBuffer = Buffer.concat(files[data.uuid].data);
        let file = await models.fileModel.create({ 
          tick: dayjs().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile(globalSetting.storageLocation + '/' + file._id, fileBuffer, "binary");
          delete files[data.uuid]; 
          file.status = 1;
          file.writeConfirm = true;
          await file.save();
          let issue = await models.issueModel.findOne({
            _id: data.uid
          }).exec();
          issue.attachments.push(file._id);
          issue.save();
          io.p2p.emit('issueFileUploadDone', issue._id);
        } catch (err) {
          return io.p2p.emit('issueFileUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestissueSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
    return;
  });

  io.p2p.on('deleteKBVersion', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      try {
        let exist = await fs.access(globalSetting.storageLocation + '/' + data.fileID);
        if(exist) { await fs.remove(globalSetting.storageLocation + '/' + data.fileID); }
        let fileObj = await models.fileModel.findOne({
          _id: data.fileID
        }).exec();
        let filename = fileObj.name;
        await models.fileModel.deleteOne({
          _id: data.fileID
        }).exec();
        let KB = await models.KBModel.findOne({
          _id: data.KBID
        }).populate('versions').exec();
        KB.versions = KB.versions.filter((att) => {
          return !att._id.equals(data.fileID);
        });
        let event = await models.eventlogModel.create({
          tick: dayjs().unix(),
          type: '知識點操作',
          desc: '刪除知識點檔案，檔案名' + filename,
          KB: KB._id,
          user: new ObjectId(io.p2p.request.session.passport.user)
        });
        KB.eventLog.push(event._id);
        await KB.save();
        io.p2p.emit('deleteKBVersion', true);
      } catch(err) {
        console.dir(err);
        io.p2p.emit('KBVersionDeleteError', JSON.stringify(err)); 
      }
    }
    return;
  }); 

  io.p2p.on('sendKBVersion', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      if (!files[data.uuid]) { 
        files[data.uuid] = Object.assign({}, struct, data); 
        files[data.uuid].data = []; 
      }
      //convert the ArrayBuffer to Buffer
      data.data = Buffer.from(new Uint8Array(data.data)); 
      //save the data 
      files[data.uuid].data.push(data.data); 
      files[data.uuid].slice++;
      if (files[data.uuid].slice * 100000 >= files[data.uuid].size) { 
        let fileBuffer = Buffer.concat(files[data.uuid].data);
        let file = await models.fileModel.create({ 
          tick: dayjs().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          comment: data.comment.substring(0, 30),
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile(globalSetting.storageLocation + '/' + file._id, fileBuffer, "binary");
          delete files[data.uuid]; 
          file.status = 1;
          file.writeConfirm = true;
          await file.save();
          let KB = await models.KBModel.findOne({
            _id: data.uid
          }).exec();
          KB.versions.push(file._id);
          let event = await models.eventlogModel.create({
            tick: dayjs().unix(),
            type: '知識點操作',
            desc: '上傳知識點檔案，檔案名' + file.name,
            KB: KB._id,
            user: new ObjectId(io.p2p.request.session.passport.user)
          });
          KB.eventLog.push(event._id);
          await KB.save();
          io.p2p.emit('KBVersionUploadDone', KB._id);
        } catch (err) {
          return io.p2p.emit('KBVersionUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestKBVersionSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
    return;
  });

  io.p2p.on('deleteKBFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      try {
        let exist = await fs.access(globalSetting.storageLocation + '/' + data.fileID);
        if(exist) { await fs.remove(globalSetting.storageLocation + '/' + data.fileID); }
        await models.fileModel.deleteOne({
          _id: data.fileID
        }).exec();
        let KB = await models.KBModel.findOne({
          _id: data.KBID
        }).populate('descAtt').exec();
        KB.descAtt = KB.descAtt.filter((att) => {
          return !att._id.equals(data.fileID);
        });
        await KB.save();
        io.p2p.emit('getKBAttachment', KB.descAtt);
      } catch(err) {
        console.dir(err);
        io.p2p.emit('KBFileDeleteError', JSON.stringify(err)); 
      }
    }
    return;
  }); 

  io.p2p.on('sendKBFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      if (!files[data.uuid]) { 
        files[data.uuid] = Object.assign({}, struct, data); 
        files[data.uuid].data = []; 
      }
      //convert the ArrayBuffer to Buffer
      data.data = Buffer.from(new Uint8Array(data.data)); 
      //save the data 
      files[data.uuid].data.push(data.data); 
      files[data.uuid].slice++;
      if (files[data.uuid].slice * 100000 >= files[data.uuid].size) { 
        let fileBuffer = Buffer.concat(files[data.uuid].data);
        let file = await models.fileModel.create({ 
          tick: dayjs().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile(globalSetting.storageLocation + '/' + file._id, fileBuffer, "binary");
          delete files[data.uuid]; 
          file.status = 1;
          file.writeConfirm = true;
          await file.save();
          let KB = await models.KBModel.findOne({
            _id: data.uid
          }).exec();
          KB.descAtt.push(file._id);
          KB.save();
          io.p2p.emit('KBFileUploadDone', KB._id);
        } catch (err) {
          io.p2p.emit('KBFileUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestKBSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
    return;
  });

  io.p2p.on('importKBZip', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      let globalSetting = await models.settingModel.findOne({}).exec();
      if (!files[data.uuid]) { 
        files[data.uuid] = Object.assign({}, struct, data); 
        files[data.uuid].data = [];
        files[data.uuid].tag = data.tag;
      }
      //convert the ArrayBuffer to Buffer
      data.data = Buffer.from(new Uint8Array(data.data)); 
      //save the data 
      files[data.uuid].data.push(data.data); 
      files[data.uuid].slice++;
      if (files[data.uuid].slice * 100000 >= files[data.uuid].size) { 
        let fileBuffer = Buffer.concat(files[data.uuid].data);
        let tag = new ObjectId(files[data.uuid].tag);
        try {
          io.p2p.emit('KBZipUploadDone');
          JSZip.loadAsync(fileBuffer).then(async(zip) => {
            io.p2p.emit('KBZipReport', '一共讀入' + (_.values(zip.files)).length + '個檔案');
            let csvFile = _.find(zip.files, (item) => {
              return /.csv/.test(item.name);
            });
            if(csvFile !== undefined) {
              io.p2p.emit('KBZipReport', '找到CSV檔案：' + csvFile.name + '！開始讀入');
              zip
              .file(csvFile.name)
              .async("text")
              .then(async function success(content) {
                try {
                  content = stripBOM(content);
                  let now = dayjs().unix();
                  let mongoChapter = null;
                  let mongoKB = null;
                  let mongoFile = null;
                  let csvContent = Papa.parse(content, {
                    header: true,
                    skipEmptyLines: true,
                    complete: async function(result) {
                      io.p2p.emit('KBZipReport', 'CSV檔讀入完成，分析結構中');
                      let chapters = _.uniq(_.map(result.data, '大分類名稱'));
                      io.p2p.emit('KBZipReport', 'CSV檔中有' + chapters.length + '個大分類');
                      let tagChapter = await models.chapterModel.find({
                        tag: { $in: tag }
                      }).exec();
                      for(let k=0; k<chapters.length; k++) {
                        let chapter = chapters[k];
                        mongoChapter = await models.chapterModel.create({
                          createDate: now,
                          modDate: now,
                          title: chapter,
                          sort: k + tagChapter.length,
                          user: new ObjectId(io.p2p.request.session.passport.user),
                          tag: [tag],
                          KBs: []
                        })
                        let KBs = _.filter(result.data, {
                          '大分類名稱': chapter
                        });
                        let chapterKB = [];
                        for(let b=0; b<KBs.length; b++) {
                          let KB = KBs[b];
                          let KBname = KB['知識點名稱'] === undefined ? '無' : KB['知識點名稱'];
                          io.p2p.emit('KBZipReport', '匯入：' + chapter + '/' + KBname + '中...');
                          mongoKB= await models.KBModel.create({
                            createDate: now,
                            modDate: now,
                            title: KBname,
                            sort: b,
                            user: new ObjectId(io.p2p.request.session.passport.user),
                            desc: KB['細部內容'] === undefined ? '無' : KB['細部內容'],
                            tag: [tag],
                            textbook: KB['課綱學習內容'] === undefined ? '無' : KB['課綱學習內容'],
                            chapter: mongoChapter._id,
                            stages: [],
                            eventLog: [],
                            issues: [],
                            versions: [],
                            descAtt: []
                          });
                          chapterKB.push(mongoKB._id);
                          let descAtt = _.filter(zip.files, (item) => {
                            return  (new RegExp('^\\[' + KB['序號']+'\\]')).test(item.name);
                          });
                          let KBdescAtt = [];
                          io.p2p.emit('KBZipReport', '匯入' + KBname + '的附件... 共' + descAtt.length + '件');
                          for(let i=0; i<descAtt.length; i++) {
                            let file = descAtt[i];
                            mongoFile = await models.fileModel.create({
                              name: file.name,
                              status: 1,
                              size: file._data.uncompressedSize,
                              type: mime.lookup(file.name),
                              writeConfirm: false
                            });
                            KBdescAtt.push(mongoFile._id);
                            zip
                            .file(file.name)
                            .nodeStream()
                            .pipe(fs.createWriteStream(globalSetting.storageLocation + '/' + mongoFile._id))
                            .on('finish', async function () {
                              await models.fileModel.updateOne({
                                _id: mongoFile._id
                              }, {
                                writeConfirm: true
                              });
                            });
                          }
                          await models.KBModel.updateOne({
                            _id: mongoKB._id
                          }, {
                            descAtt: KBdescAtt
                          });
                          io.p2p.emit('KBZipReport', KB['知識點名稱'] + '匯入完成！');
                        }
                        await models.chapterModel.updateOne({
                          _id: mongoChapter._id
                        }, {
                          KBs: chapterKB
                        });
                        io.p2p.emit('KBZipReport', chapter + '匯入完成！');
                      }
                      io.p2p.emit('KBZipReport', '匯入完成！');
                      io.p2p.emit('refreshKB', true);
                    }
                  });
                } catch (e) {
                  io.p2p.emit('KBZipReport', '匯入知識點發生錯誤（代碼：' + JSON.stringify(e) +'），建議重新下載範例重作，如重複發生，請把代碼複製給管理員');
                }
              }, function error(e) {
                io.p2p.emit('KBZipReport', '匯入：' + chapter + '/' + KB['知識點名稱'] + '中...');
              });
            } else {
              io.p2p.emit('KBZipReport', '壓縮檔開啟失敗，建議重新下載範例重作，重複發生請洽管理員');
            }
          });
          delete files[data.uuid];
        } catch (err) {
          console.dir(err);
          io.p2p.emit('KBZipUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestKBZipSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
    return;
  });

  io.p2p.on('importKBstatistics', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if (!files[data.uuid]) { 
        files[data.uuid] = Object.assign({}, struct, data); 
        files[data.uuid].data = [];
        files[data.uuid].typeTags = data.typeTags;
        files[data.uuid].sourceTag = data.sourceTag;
        files[data.uuid].overwrite = data.overwrite;
      }
      data.data = Buffer.from(new Uint8Array(data.data)); 
      files[data.uuid].data.push(data.data); 
      files[data.uuid].slice++;
      if (files[data.uuid].slice * 100000 >= files[data.uuid].size) {
        let overwrite = files[data.uuid].overwrite;
        let fileBuffer = Buffer.concat(files[data.uuid].data);
        let sourceTag = new ObjectId(files[data.uuid].sourceTag);
        let typeTags = _.map(files[data.uuid].typeTags, (tag) => {
          return new ObjectId(tag);
        });
        try {
          io.p2p.emit('KBstatisticsUploadDone');
          io.p2p.emit('KBstatisticsReport', '讀入csv檔案...');
          let now = dayjs().unix();
          let readStream = new stream.PassThrough();
          readStream.end(fileBuffer);
          Papa.parse(readStream, {
            header: false,
            skipEmptyLines: true,
            complete: async (result) => {
              let fails = new Set();
              try {
                io.p2p.emit('KBstatisticsReport', '分析csv...');
                let dates = [];
                for(let i=1; i< result.data[0].length; i++) {
                  let date = result.data[0][i];
                  dates.push(dayjs(date, "YYYY/MM/DD").unix());
                }
                io.p2p.emit('KBstatisticsReport', '匯入統計資料庫');
                for(let i=1; i< result.data.length; i++) {
                  let data = result.data[i];
                  let KBtitle = data[0].trim();
                  let KB = await models.KBModel.findOne({
                    title: KBtitle
                  }).exec();
                  if(KB !== null) {
                    for(let k=1; k<data.length; k++) {
                      let oldstatistics = await models.statisticsKBModel.findOne({
                        KB: KB._id,
                        logTick: dates[k-1],
                        typeTags: typeTags,
                        sourceTag: sourceTag
                      }).exec();
                      if(oldstatistics === null) {
                        io.p2p.emit('KBstatisticsReport', '匯入' + KB.title + '於' + dayjs.unix(dates[k-1]).format('YYYY/MM/DD') + '的數據中...');
                        await models.statisticsKBModel.create({
                          KB: KB._id,
                          logTick: dates[k-1],
                          sourceTag: sourceTag,
                          typeTags: typeTags,
                          value: data[k] === '' ? 0 : data[k]
                        });
                      } else {
                        if(overwrite) {
                          oldstatistics.value = data[k] === '' ? 0 : data[k];
                          await oldstatistics.save();
                        } else {
                          fails.add(KBtitle + '已有重複資料');
                        }
                      }
                    }
                  } else {
                    fails.add(KBtitle + '找不到知識點');
                  }
                }
                setTimeout(() => {
                  io.p2p.emit('KBstatisticsReport', '匯入完成！');
                }, 10000);
              } catch (e) {
                console.dir(e);
                setTimeout(() => {
                  io.p2p.emit('KBstatisticsReport', '匯入失敗！');
                }, 10000);
              }
              io.p2p.emit('importKBstatistics', Array.from(fails));
            }
          });
          delete files[data.uuid];
        } catch (err) {
          console.dir(err);
          return io.p2p.emit('KBstatisticsUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestKBstatisticsSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
    return;
  });

  io.p2p.on('importUserlist', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if (!files[data.uuid]) { 
        files[data.uuid] = Object.assign({}, struct, data); 
        files[data.uuid].data = [];
      }
      data.data = Buffer.from(new Uint8Array(data.data)); 
      files[data.uuid].data.push(data.data); 
      files[data.uuid].slice++;
      if (files[data.uuid].slice * 100000 >= files[data.uuid].size) {
        let fileBuffer = Buffer.concat(files[data.uuid].data);
        try {
          io.p2p.emit('userlistUploadDone');
          let setting = await models.settingModel.findOne({}).exec();
          let robotSetting = await models.robotModel.findOne({}).exec();
          let now = dayjs().unix();
          let readStream = new stream.PassThrough();
          readStream.end(fileBuffer).pipe(concat((content) => {
            Papa.parse(stripBOM(content.toString()), {
              header: true,
              skipEmptyLines: true,
              complete: async (result) => {
                try {
                  let userDB = [];
                  for(let i=0; i< result.data.length; i++) {
                    let item = result.data[i];
                    let password = '';
                    if(item['密碼'] === '') {
                      if(setting.randomNewbiePass) {
                        password = generator.generate({
                          length: setting.newbiepassLength,
                          numbers: true,
                          symbols: true,
                          excludeSimilarCharacters: true,
                          strict: true
                        });
                      } else {
                        password = setting.defaultPassword
                      }
                    } else {
                      password = item['密碼'];
                    }
                    let user = {
                      count: i,
                      total: result.data.length,
                      valid: false,
                      name: item['姓名'],
                      password: password,
                      unit: item['服務單位'],
                      tags: [],
                      seed: "",
                      email: item['email'],
                      emailExist: false,
                      emailInvalid: !validator.isEmail(item['email'])
                    };
                    io.p2p.emit('usercreateReport', user);
                    if(!user.emailInvalid) {
                      let foundUser = await models.userModel.findOne({ email: user.email }).exec();
                      if(foundUser === null) {
                        user.emailExist = false;
                        let tagnames = _.split(item['群組標籤'], ',');
                        for(let t=0; t<tagnames.length; t++) {
                          let tagname = tagnames[t];
                          let foundTag = await models.tagModel.findOne({ name: tagname }).exec();
                          if(foundTag != null) {
                            user.tags.push(foundTag);
                          } else {
                            let newTag = await models.tagModel.create({ 
                              tick: now,
                              modTick: 0,
                              visibility: true,
                              name: tagname,
                            });
                            user.tags.push(newTag);
                          }
                        }
                        await models.userModel.create({
                          tags: _.map(user.tags, '_id'),
                          types: 'human',
                          name: user.name,
                          unit: user.unit,
                          email: user.email,
                          createDate: now,
                          modDate: now,
                          firstRun: true,
                          password: bcrypt.hashSync(user.password, bcrypt.genSaltSync(10)),
                        });
                        let transporter = nodemailer.createTransport({
                          host: robotSetting.mailSMTP,
                          port: robotSetting.mailPort,
                          secure: robotSetting.mailSSL,
                          auth: {
                            user: robotSetting.mailAccount,
                            pass: robotSetting.mailPassword,
                          },
                        });
                        try {
                          await transporter.sendMail({
                            from: '"' + setting.systemName + '" <' + robotSetting.mailAccount + '>',
                            to: user.email,
                            subject: setting.systemName + "：帳號開通通知信",
                            text: "您好，您的帳號已經開通，你的帳號就是你收到信的Email，系統預設密碼密碼是：" + user.password + "\n請記得在登入後修改密碼並填入相關資訊\n登入網址：" + setting.siteLocation, // plain text body
                            html: "<p>您好，您的帳號已經開通，你的帳號就是你收到信的Email，系統預設密碼是：" + user.password + "</p><p>請記得在登入後修改密碼並填入相關資訊</p><p>登入網址：<a href='" + setting.siteLocation + "' target='_blank' title='登入網址'>" + setting.siteLocation + "</a></p>", // html body
                          });
                          user.valid = true;
                        } catch(err) {
                          console.dir(err);
                        }
                        user.valid = true;
                      } else {
                        user.emailExist = true;
                      }
                    }
                    userDB.push(user);
                  }
                  return io.p2p.emit('userlistParsed', userDB); 
                } catch (e) {
                  console.dir(e);
                }
              }
            });
          }));
          delete files[data.uuid];
        } catch (err) {
          console.dir(err);
          return io.p2p.emit('userlistUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestuserlistSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
    return;
  });

  io.p2p.on('importbulkmsgFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      if (!files[data.uuid]) { 
        files[data.uuid] = Object.assign({}, struct, data); 
        files[data.uuid].data = [];
      }
      data.data = Buffer.from(new Uint8Array(data.data)); 
      files[data.uuid].data.push(data.data); 
      files[data.uuid].slice++;
      if (files[data.uuid].slice * 100000 >= files[data.uuid].size) {
        let fileBuffer = Buffer.concat(files[data.uuid].data);
        try {
          io.p2p.emit('bulkmsgsampleUploadDone');
          let setting = await models.settingModel.findOne({}).exec();
          let robotSetting = await models.robotModel.findOne({}).exec();
          JSZip.loadAsync(fileBuffer).then(async(zip) => {
            io.p2p.emit('bulkmsgsampleReport', '一共讀入' + (_.values(zip.files)).length + '個檔案');
            let csvFile = _.find(zip.files, (item) => {
              return /.csv/.test(item.name);
            });
            if(csvFile !== undefined) {
              io.p2p.emit('bulkmsgsampleReport', '找到CSV檔案：' + csvFile.name + '！開始讀入');
              zip
              .file(csvFile.name)
              .async("text")
              .then(async function success(content) {
                try {
                  content = stripBOM(content);
                  let now = dayjs().unix();
                  let csvContent = Papa.parse(content, {
                    header: true,
                    skipEmptyLines: true,
                    complete: async (result) => {
                      try {
                        let logDB = [];
                        let successArray = [];
                        for(let i=0; i< result.data.length; i++) {
                          let countWord = "(" + (i+1) + "/" + result.data.length + ")";
                          let item = result.data[i];
                          let log = {
                            email: item['Email'],
                            msg: "找不到Email"
                          }
                          let successlog = {
                            uid: "",
                            tick: dayjs().unix(),
                            status: 0
                          };
                          let user = await models.userModel.findOne({
                            email: item['Email']
                          }).exec();
                          if(user !== null) {
                            successlog.uid = user._id;
                            io.p2p.emit('bulkmsgsampleReport', user.name + countWord + "發送中");
                            let useLINE = item['發送方式'] === "L" ? true : false;
                            if(!('lineToken' in user) || user.lineToken !== undefined) {
                              useLINE = useLINE ? useLINE : false;
                            } else {
                              useLINE = false;
                            }
                            useLINE = item['附件'] !== "" ? false : useLINE;
                            if(useLINE) {
                              try {
                                let sendmsg = await axios.post('https://notify-api.line.me/api/notify', qs.stringify({
                                  message: item['訊息內容']
                                }), {
                                  headers: {
                                    Authorization: 'Bearer ' + user.lineToken
                                  },
                                  withCredentials: true
                                });
                                if(sendmsg.data.status === 200) {
                                  log.msg = "LINE已送出";
                                  io.p2p.emit('bulkmsgsampleReport', user.name + countWord + "LINE訊息已送出");
                                  successlog.status = 1;
                                } else {
                                  log.msg = "LINE發生錯誤";
                                  io.p2p.emit('bulkmsgsampleReport', user.name + countWord + "LINE訊息送出失敗");
                                  successlog.status = 0;
                                }
                              } catch(e) {
                                log.msg = "LINE發生錯誤";
                                io.p2p.emit('bulkmsgsampleReport', user.name + countWord + "LINE訊息送出失敗");
                                successlog.status = 0;
                              }
                            } else {
                              let transporter = nodemailer.createTransport({
                                host: robotSetting.mailSMTP,
                                port: robotSetting.mailPort,
                                secure: robotSetting.mailSSL,
                                auth: {
                                  user: robotSetting.mailAccount,
                                  pass: robotSetting.mailPassword,
                                },
                              });
                              try {
                                let mail = {
                                  from: '"' + setting.systemName + '" <' + robotSetting.mailAccount + '>',
                                  to: user.email,
                                  subject: setting.systemName + "：訊息通知",
                                  text: item['訊息內容'], // plain text body
                                  html: marked(item['訊息內容']), // html body
                                }
                                if(item["附件"] !== "") {
                                  let attachment = await zip
                                  .file(item["附件"])
                                  .async("nodebuffer");
                                  mail = {
                                    from: '"' + setting.systemName + '" <' + robotSetting.mailAccount + '>',
                                    to: user.email,
                                    subject: setting.systemName + "：訊息通知",
                                    text: item['訊息內容'], // plain text body
                                    html: marked(item['訊息內容']), // html body,
                                    attachments: [
                                      {
                                        filename: item["附件"],
                                        content: attachment
                                      }
                                    ]
                                  }
                                };
                                await transporter.sendMail(mail);
                                log.msg = "Email已送出";
                                io.p2p.emit('bulkmsgsampleReport', user.name + countWord + "Email已送出");
                                successlog.status = 1;
                              } catch(err) {
                                log.msg = "Email發生錯誤";
                                io.p2p.emit('bulkmsgsampleReport', user.name + countWord + "Email送出失敗");
                                successlog.status = 0;
                              }
                            }
                          }
                          successArray.push(successlog);
                          logDB.push(log);
                        }
                        await models.lineModel.create({ 
                          tick: dayjs().unix(),
                          body: "大量發送訊息不紀錄",
                          log: successArray,
                          type: 2
                        });
                        return io.p2p.emit('bulkmsgSent', logDB); 
                      } catch (e) {
                        console.dir(e);
                      }
                    }
                  });
                } catch (e) {
                  io.p2p.emit('bulkmsgsampleReport', '匯入大量訊息發生錯誤（代碼：' + JSON.stringify(e) +'），建議重新下載範例重作，如重複發生，請把代碼複製給管理員');
                }
              });
            }
          });
          delete files[data.uuid];
        } catch (err) {
          console.dir(err);
          return io.p2p.emit('bulkmsgsampleUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestbulkmsgsampleSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
    return;
  });

  return router;
}
