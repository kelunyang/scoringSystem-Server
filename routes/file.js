const express = require('express');
const router = express.Router();
const moment = require('moment');
const fs = require('fs-extra');
const JSZip = require("jszip");
const Papa = require('papaparse');
const _ = require('lodash');
const stripBOM = require('strip-bom');
const mime = require('mime-types');
const { ObjectId } = require('bson');

let files = {}, 
    struct = { 
        name: null, 
        type: null, 
        size: 0, 
        data: [], 
        slice: 0, 
    };

module.exports = (io, models) => {
  io.p2p.on('deleteMsgFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      try {
        let exist = await fs.access('/var/www/frontend/storages/' + data.fileID);
        if(exist) { await fs.remove('/var/www/frontend/storages/' + data.fileID); }
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
        return io.p2p.emit('msgFileDeleteError', JSON.stringify(err)); 
      }
    }
  }); 

  io.p2p.on('sendMsgFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
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
          tick: moment().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile('/var/www/frontend/storages/' + file._id, fileBuffer, "binary");
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
  });

  io.p2p.on('deletefeedbackFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      try {
        let exist = await fs.access('/var/www/frontend/storages/' + data.fileID);
        if(exist) { await fs.remove('/var/www/frontend/storages/' + data.fileID); }
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
        return io.p2p.emit('getfeedbackAttachment', feedback.attachments);
      } catch(err) {
        console.log(JSON.stringify(err));
        return io.p2p.emit('feedbackFileDeleteError', JSON.stringify(err)); 
      }
    }
  }); 

  io.p2p.on('sendfeedbackFile', async (data) => {
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
        let file = await models.fileModel.create({ 
          tick: moment().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile('/var/www/frontend/storages/' + file._id, fileBuffer, "binary");
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
  });

  io.p2p.on('deleteissueFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      try {
        let exist = await fs.access('/var/www/frontend/storages/' + data.fileID);
        if(exist) { await fs.remove('/var/www/frontend/storages/' + data.fileID); }
        await models.fileModel.deleteOne({
          _id: data.fileID
        }).exec();
        let issue = await models.issuebackModel.findOne({
          _id: data.issueID
        }).populate('attachments').exec();
        issue.attachments = issue.attachments.filter((att) => {
          return !att._id.equals(data.fileID);
        });
        return io.p2p.emit('getissueAttachment', issue.attachments);
      } catch(err) {
        console.log(JSON.stringify(err));
        return io.p2p.emit('issueFileDeleteError', JSON.stringify(err)); 
      }
    }
  }); 

  io.p2p.on('sendissueFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
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
          tick: moment().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile('/var/www/frontend/storages/' + file._id, fileBuffer, "binary");
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
  });

  io.p2p.on('deleteKBVersion', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      try {
        let exist = await fs.access('/var/www/frontend/storages/' + data.fileID);
        if(exist) { await fs.remove('/var/www/frontend/storages/' + data.fileID); }
        await models.fileModel.deleteOne({
          _id: data.fileID
        }).exec();
        let KB = await models.KBModel.findOne({
          _id: data.KBID
        }).populate('versions').exec();
        KB.versions = KB.versions.filter((att) => {
          return !att._id.equals(data.fileID);
        });
        await KB.save();
        return io.p2p.emit('getKBVersions', KB.versions);
      } catch(err) {
        console.dir(err);
        return io.p2p.emit('KBVersionDeleteError', JSON.stringify(err)); 
      }
    }
  }); 

  io.p2p.on('sendKBVersion', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
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
          tick: moment().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          comment: data.comment.substring(0, 30),
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile('/var/www/frontend/storages/' + file._id, fileBuffer, "binary");
          delete files[data.uuid]; 
          file.status = 1;
          file.writeConfirm = true;
          await file.save();
          let KB = await models.KBModel.findOne({
            _id: data.uid
          }).exec();
          KB.versions.push(file._id);
          KB.save();
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
  });

  io.p2p.on('deleteKBFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
      try {
        let exist = await fs.access('/var/www/frontend/storages/' + data.fileID);
        if(exist) { await fs.remove('/var/www/frontend/storages/' + data.fileID); }
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
        return io.p2p.emit('getKBAttachment', KB.descAtt);
      } catch(err) {
        console.dir(err);
        return io.p2p.emit('KBFileDeleteError', JSON.stringify(err)); 
      }
    }
  }); 

  io.p2p.on('sendKBFile', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
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
          tick: moment().unix(),
          name: data.name,
          type: data.type,
          size: data.size,
          status: 0,
          writeConfirm: false
        });
        try {
          await fs.outputFile('/var/www/frontend/storages/' + file._id, fileBuffer, "binary");
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
          return io.p2p.emit('KBFileUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestKBSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
  });

  io.p2p.on('importKBZip', async (data) => {
    if(io.p2p.request.session.status.type === 3) {
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
                  let now = moment().unix();
                  let mongoChapter = null;
                  let mongoKB = null;
                  let mongoFile = null;
                  let csvContent = Papa.parse(content, {
                    header: true,
                    skipEmptyLines: true
                  });
                  io.p2p.emit('KBZipReport', 'CSV檔讀入完成，分析結構中');
                  let chapters = _.uniq(_.map(csvContent.data, '大分類名稱'));
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
                    let KBs = _.filter(csvContent.data, {
                      '大分類名稱': chapter
                    });
                    let chapterKB = [];
                    for(let b=0; b<KBs.length; b++) {
                      let KB = KBs[b];
                      io.p2p.emit('KBZipReport', '匯入：' + chapter + '/' + KB['知識點名稱'] + '中...');
                      mongoKB= await models.KBModel.create({
                        createDate: now,
                        modDate: now,
                        title: KB['知識點名稱'],
                        sort: b,
                        user: new ObjectId(io.p2p.request.session.passport.user),
                        desc: KB['細部內容'],
                        tag: [tag],
                        textbook: KB['課綱學習內容'],
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
                      io.p2p.emit('KBZipReport', '匯入' + KB['知識點名稱'] + '的附件... 共' + descAtt.length + '件');
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
                        .pipe(fs.createWriteStream('/var/www/frontend/storages/' + mongoFile._id))
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
          io.p2p.emit('refreshKB', true);
        } catch (err) {
          console.dir(err);
          return io.p2p.emit('KBZipUploadError', JSON.stringify(err)); 
        };
      } else { 
        io.p2p.emit('requestKBZipSlice', { 
            currentSlice: files[data.uuid].slice,
            uuid: data.uuid
        }); 
      } 
    }
  });

  return router;
}
