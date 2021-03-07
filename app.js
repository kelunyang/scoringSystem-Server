//載入library
const express = require('express');
const path = require('path');
const logger = require('morgan');
const mongoose = require('mongoose');
const moment = require('moment');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
let session = require('express-session');
const mongoDB = 'mongodb://vrAdmin:cooc1234@localhost/videoReview';
const MongoStore = require('connect-mongo')(session);
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const authSocket = require('./middleware/authSocket');
const { ObjectId } = require('mongodb');
let mongoPointer = false;
let userAlived = false;
let oriobj = this;

//model
const settingModel = require('./models/globalModel')(mongoose);
const projectModel = require('./models/projectModel')(mongoose);
const robotModel = require('./models/robotModel')(mongoose);
const systemmessageModel = require('./models/messageModel')(mongoose);
const tagModel = require('./models/tagModel')(mongoose);
const userModel = require('./models/userModel')(mongoose);
const logModel = require('./models/logModel')(mongoose);
const lineModel = require('./models/lineModel')(mongoose);
const broadcastModel = require('./models/broadcastModel')(mongoose);
const fileModel = require('./models/fileModel')(mongoose);
const feedbackModel = require('./models/feedbackModel')(mongoose);
const activeuserModel = require('./models/activeuserModel')(mongoose);
const sessionModel = require('./models/sessionModel')(mongoose);
const modelList = {
    messageModel: systemmessageModel,
    logModel: logModel,
    settingModel: settingModel,
    projectModel: projectModel,
    robotModel: robotModel,
    userModel: userModel,
    tagModel: tagModel,
    lineModel: lineModel,
    fileModel: fileModel,
    broadcastModel: broadcastModel,
    feedbackModel: feedbackModel,
    activeuserModel: activeuserModel,
    sessionModel: sessionModel
};

//掛載socketio, 啟動express
const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());
app.use(passport.initialize());

mongoose.connect(mongoDB, { 
    useNewUrlParser: true,
    useUnifiedTopology: true,
    auto_reconnect: true,
    poolSize: 20
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
            session = session({
                secret: 'coocReview',
                store: new MongoStore({ mongooseConnection: mongoose.connection }),
                resave: true,
                saveUninitialized: true
            });
            app.use(session);
            io.use(function(socket, next) {
                session(socket.request, {}, next);
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
            
            let backend = require('./routes/backend')(app, passport, modelList);
            app.use('/backend', backend);
        }
        
        io.on('connection', async (socket) => {
            try {
                let globalSetting = await modelList.settingModel.findOne({}).sort({_id: 1}).exec();
                let connectionTimeout = globalSetting === null || globalSetting == undefined ? 2 : globalSetting.connectionTimeout;
                let userAlived = true;
                socket.on("disconnect", () => {
                    userAlived = false;
                    socket.emit('userAlived');
                    setTimeout(async () => {
                        if(!userAlived) {
                            await modelList.activeuserModel.deleteOne({
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
                            return; //結束程式
                        }
                    }, connectionTimeout * 1000)
                });
                socket.on("userAlived", () => {
                    userAlived = true;
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
        
                let index = require('./routes/index');
                let users = require('./routes/users')({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let settings = require('./routes/settings')({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let tags = require('./routes/tags')({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let message = require('./routes/message')({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let file = require('./routes/file')({
                    p2p: socket,
                    p2n: io
                }, modelList);
                let feedback = require('./routes/feedback')({
                    p2p: socket,
                    p2n: io
                }, modelList);
                app.use('/', index);
                app.use('/users', users);
                app.use('/settings', settings);
                app.use('/message', message);
                app.use('/tags', tags);
                app.use('/file', file);
                app.use('/feedback', feedback);
            } catch (e) {
                socket.emit('error', {
                    title: e.title,
                    text: e.errObj
                });
            }
        });        
    });
} catch (e) {
    DBexception = e;
}