//載入library
import http from 'http';
import { Server } from 'socket.io';
import express from 'express';
import path from 'path';
import logger from 'morgan';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import passport from 'passport';
import * as passportlocal from 'passport-local';
const LocalStrategy = passportlocal.Strategy;
import session from 'express-session';
import fs from 'fs-extra';
let mongoDBConnector = fs.readJsonSync('./mongoDBConnector.json');
const mongoDB = 'mongodb://' + mongoDBConnector.account + ':' + mongoDBConnector.password + '@' + mongoDBConnector.host + '/' + mongoDBConnector.DBname;
import connectMongo from 'connect-mongo';
const MongoStore = connectMongo(session);
import bcrypt from 'bcryptjs';
import authSocket from './middleware/authSocket.js';
import { ObjectId } from 'mongodb';
let mongoPointer = false;
let aliveTimer = null;
let userAlived = true;
let tempPassport = null;
let sessionInUse = null;
let aliverTimer = null;
let DBexception = null;

//model
import settingMJS from './models/globalModel.js';
import robotMJS from './models/robotModel.js';
import messageMJS from './models/messageModel.js';
import tagMJS from './models/tagModel.js';
import userMJS from './models/userModel.js';
import logMJS from './models/logModel.js';
import lineMJS from './models/lineModel.js';
import broadcastMJS from './models/broadcastModel.js';
import fileMJS from './models/fileModel.js';
import feedbackMJS from './models/feedbackModel.js';
import activeuserMJS from './models/activeuserModel.js';
import sessionMJS from './models/sessionModel.js';
import notifytemplateMJS from './models/notifytemplateModel.js';
import accountingMJS from './models/accountingModel.js';
import auditMJS from './models/auditModel.js';
import groupMJS from './models/groupModel.js';
import reportMJS from './models/reportModel.js';
import schemaMJS from './models/schemaModel.js';
import stageMJS from './models/stageModel.js';
import eventlogMJS from './models/eventlogModel.js';
import interventionMJS from './models/interventionModel.js';
import depositMJS from './models/depositModel.js';
import stageAssetMJS from './models/stageAssetModel.js';
const eventlogModel = eventlogMJS(mongoose);
const settingModel = settingMJS(mongoose);
const robotModel = robotMJS(mongoose);
const systemmessageModel = messageMJS(mongoose);
const tagModel = tagMJS(mongoose);
const userModel = userMJS(mongoose);
const logModel = logMJS(mongoose);
const lineModel = lineMJS(mongoose);
const broadcastModel = broadcastMJS(mongoose);
const fileModel = fileMJS(mongoose);
const feedbackModel = feedbackMJS(mongoose);
const activeuserModel = activeuserMJS(mongoose);
const sessionModel = sessionMJS(mongoose);
const notifytemplateModel = notifytemplateMJS(mongoose);
const stageModel = stageMJS(mongoose);
const schemaModel = schemaMJS(mongoose);
const reportModel = reportMJS(mongoose);
const groupModel = groupMJS(mongoose);
const auditModel = auditMJS(mongoose);
const accountingModel = accountingMJS(mongoose);
const interventionModel = interventionMJS(mongoose);
const depositModel = depositMJS(mongoose);
const stageAssetModel = stageAssetMJS(mongoose);
const modelList = {
  messageModel: systemmessageModel,
  logModel: logModel,
  settingModel: settingModel,
  robotModel: robotModel,
  userModel: userModel,
  tagModel: tagModel,
  lineModel: lineModel,
  fileModel: fileModel,
  broadcastModel: broadcastModel,
  feedbackModel: feedbackModel,
  activeuserModel: activeuserModel,
  sessionModel: sessionModel,
  notifytemplateModel: notifytemplateModel,
  stageModel: stageModel,
  schemaModel: schemaModel,
  reportModel: reportModel,
  groupModel: groupModel,
  auditModel: auditModel,
  accountingModel: accountingModel,
  eventlogModel: eventlogModel,
  interventionModel: interventionModel,
  stageAssetModel: stageAssetModel,
  depositModel: depositModel
};

//controller
import backendController from './routes/backend.js';
import settingsController from './routes/settings.js';
import tagsController from './routes/tags.js';
import messageController from './routes/message.js';
import fileController from './routes/file.js';
import feedbackController from './routes/feedback.js';
import userController from './routes/users.js';
import schemaController from './routes/schema.js';
import accountingController from './routes/accounting.js';
import groupController from './routes/group.js';
import reportController from './routes/report.js';

//掛載socketio, 啟動express
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(passport.initialize());

mongoose.connect(mongoDB, { 
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 20
});

server.listen(3000, function(){
    console.log('WebSocket on 3000');
});

try {
    mongoose.Promise = Promise;
    mongoose.connection.on('error', (err) => {
        DBexception = err;
    });
    mongoose.connection.once('open', () => {
        if (!mongoPointer) {
            mongoPointer = true;
            sessionInUse = session({
                secret: 'coocReview',
                store: new MongoStore({ mongooseConnection: mongoose.connection }),
                resave: true,
                saveUninitialized: true
            });
            app.use(sessionInUse);
            io.use(function(socket, next) {
                sessionInUse(socket.request, {}, next);
            });
            app.use(passport.session());
            passport.use(new LocalStrategy({
                usernameField: 'user',
                passwordField: 'pass',
                passReqToCallback: true
            },
            (req, email, password, done) => {
                userModel.findOne({ email: email }, (err, user) => {
                    const isValidPassword = (user, password) => {
                        return bcrypt.compareSync(password, user.password);
                    }
                    if (err) { 
                        return done(err);
                    }
                    if (!user) { 
                        return done(null, false);
                    }
                    if (!isValidPassword(user, password)) { 
                        return done(null, false);
                    }
                        return done(null, user);
                    });
                }
            ));
            passport.serializeUser(function(user, done) {
                done(null, user._id);
            });
            passport.deserializeUser(function(id, done) {
                User.findById(id, function(err, userModel) {
                done(err, userModel)
                })
            })
            
            let backend = backendController(app, passport, modelList);
            app.use('/backend', backend);
        }
        
        io.on('connection', async (socket) => {
            try {
                if(tempPassport !== null) {
                    if(socket.request.sessionID === tempPassport.id) {
                        socket.request.session.passport = tempPassport.passport;
                        socket.request.session.save();
                        tempPassport = null;
                    }
                }
                let globalSetting = await modelList.settingModel.findOne({}).sort({_id: 1}).exec();
                let connectionTimeout = globalSetting === null || globalSetting == undefined ? 2 : globalSetting.connectionTimeout;
                socket.on("disconnect", () => {
                    userAlived = false;
                    socket.emit('userAlived');
                    aliverTimer = setTimeout(async () => {
                        if(!userAlived) {
                            await modelList.activeuserModel.deleteMany({
                                socketio: socket.id,
                                session: socket.request.sessionID
                            }).exec();
                            let connections = modelList.activeuserModel.find({
                                session: socket.request.sessionID
                            }).exec();
                            if(connections.length === 0) {
                                await modelList.sessionModel.deleteOne({
                                    _id: new ObjectId(socket.request.sessionID)
                                }).exec();
                            }
                            socket.emit('userDied');
                            if('passport' in socket.request.session) {
                                tempPassport = {
                                    id:socket.request.sessionID,
                                    passport: socket.request.session.passport
                                }
                                await modelList.logModel.create({ 
                                    tick: dayjs().unix(),
                                    name: ObjectId(socket.request.session.passport.user),
                                    where: '登入模組',
                                    action: '登出成功'
                                });
                                socket.request.logout();
                                delete socket.request.session.passport;
                                socket.request.session.save();
                            }
                            socket.to("/activeUsers").emit('userLeave');
                            socket.leave('/activeUsers');
                            //console.log('socket: ' + socket.id + ' disconnected');
                            clearTimeout(aliveTimer);
                            aliveTimer = null;
                            return; //結束程式
                        }
                    }, connectionTimeout * 1000)
                });
                socket.on("userAlived", async () => {
                    userAlived = true;
                });
                socket.on("clearCurrentUser", async () => {
                    tempPassport = null;
                    delete socket.request.session.passport;
                    socket.emit("clearCurrentUser");
                });
                socket.use(async ([event], next) => {
                    await authSocket(socket, modelList, [event], next);
                });
                socket.emit('socketStatus', mongoose.connection.readyState === 1);
                socket.on('dbStatus', () => {
                    if(mongoose.connection.readyState !== 1) {
                        mongoose.connect(mongoDB, { 
                            useNewUrlParser: true,
                            useUnifiedTopology: true,
                            auto_reconnect: true,
                            poolSize: 10
                        });
                    }
                    socket.emit('dbStatus', mongoose.connection.readyState === 1);
                });
        
                let users = userController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let settings = settingsController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let tags = tagsController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let message = messageController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let file = fileController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let feedback = feedbackController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let report = reportController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let group = groupController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let accounting = accountingController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let schema = schemaController({
                    p2p: socket,
                    p2n: io
                }, modelList);
                app.use('/users', users);
                app.use('/settings', settings);
                app.use('/message', message);
                app.use('/tags', tags);
                app.use('/file', file);
                app.use('/feedback', feedback);
                app.use('/report', report);
                app.use('/accounting', accounting);
                app.use('/group', group);
                app.use('/schema', schema);
            } catch (e) {
                console.dir(e);
                let stack = [];
                let code = '';
                if(e.requireStack !== undefined) {
                    for(let i=0; i<e.requireStack.length; i++) {
                        let filename = /^\/(.+\/)*(.+)\.(.+)$/.exec(e.requireStack[i]);
                        stack.push(filename[filename.length - 2] + "." + filename[filename.length - 1]);
                    }
                    code = e.code;
                } else {
                    code = '無法指明的錯誤';
                }
                socket.emit('fatalError', {
                    code: code,
                    stack: stack,
                    tick: dayjs().unix()
                });
            }
        });        
    });
} catch (e) {
    DBexception = e;
}