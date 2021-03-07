const express = require('express');
const router = express.Router();
const moment = require('moment');
const fs = require('fs-extra');
const { ObjectId } = require('mongodb');
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
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      try {
        await fs.remove('/var/www/frontend/storages/' + data.fileID);
        await models.fileModel.deleteOne({
          _id: data.fileID
        }).exec();
        let msg = await models.messageModel.findOne({
          _id: data.msgID
        }).exec();
        msg.attachments = msg.attachments.filter((att) => {
          return !att.equals(data.fileID);
        });
        await msg.save();
        var collection = await models.messageModel.findOne({
          _id: data.msgID
        })
        .populate('attachments')
        .populate({
          path: 'user',
          populate: { path: 'tags' }
        }).exec();
        return io.p2p.emit('getmsgAttachment', collection.attachments);
      } catch(err) {
        console.log(JSON.stringify(err));
        return io.p2p.emit('msgFileDeleteError', JSON.stringify(err)); 
      }
    }
  }); 

  io.p2p.on('sendMsgFile', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
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
    let authMapping = await require('../middleware/mapping')(models);
    if(io.p2p.request.session.status.type === 3) {
      try {
        await fs.remove('/var/www/frontend/storages/' + data.fileID);
        await models.fileModel.deleteOne({
          _id: data.fileID
        }).exec();
        let feedback = await models.feeedbackModel.findOne({
          _id: data.feedbackID
        }).exec();
        feedback.attachments = feedback.attachments.filter((att) => {
          return !att.equals(data.fileID);
        });
        await feedback.save();
        var collection = await models.feedbackModel.findOne({
          _id: data.feedbackID
        })
        .populate('users', '-password -lineToken -lineCode')
        .populate('rating')
        .populate('attachments')
        .exec();
        return io.p2p.emit('getfeedbackAttachment', collection.attachments);
      } catch(err) {
        console.log(JSON.stringify(err));
        return io.p2p.emit('feedbackFileDeleteError', JSON.stringify(err)); 
      }
    }
  }); 

  io.p2p.on('sendfeedbackFile', async (data) => {
    let authMapping = await require('../middleware/mapping')(models);
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

  return router;
}
