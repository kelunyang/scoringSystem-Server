import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';
import _ from 'lodash';
import mapping from './mapping.js';

export default async function (socket, models, [event], next) {
    //console.log("socket event:" + event);
    const authMapping = await mapping(models);
    let action = authMapping[event];
    let ma = undefined;
    try {
        if(action.loginRequire) {
            if(socket.request.session.hasOwnProperty('passport')) {
                if(socket.request.session.passport.hasOwnProperty('user')) {
                    if(action.where !== '同步檢查模組') {
                        let activeuser = await models.activeuserModel.findOne({
                            socketio: socket.id,
                            session: socket.request.sessionID
                        }).exec();
                        if(activeuser === undefined || activeuser === null) {
                            await models.activeuserModel.create({ 
                                tick: dayjs().unix(),
                                socketio: socket.id,
                                session: socket.request.sessionID,
                                where: action.where,
                                action: action.action,
                                user: new ObjectId(socket.request.session.passport.user)
                            });
                        } else {
                            activeuser.tick = dayjs().unix();
                            activeuser.where = action.where;
                            activeuser.action = action.action;
                            await activeuser.save();
                        }
                    }
                    let user = await models.userModel.findOne({
                        _id: ObjectId(socket.request.session.passport.user)
                    }).exec();
                    if(action.authRange.length !== 0) {
                        let found = (_.intersectionWith(action.authRange, user.tags, (aTag, uTag) => {
                            return aTag.equals(uTag);
                        })).length > 0;
                        if(found) {
                            ma = authMapping['authGranted'];
                            delete socket.request.session.status;
                            socket.request.session.save();
                            socket.request.session.status = {
                                title: '確認權限完成',
                                type: 3,
                                tick: dayjs().unix()
                            };
                            socket.request.session.save();
                            await models.logModel.create({ 
                                tick: dayjs().unix(),
                                name: ObjectId(user._id),
                                where: action.where,
                                action: ma.action + '需要權限：' + JSON.stringify(action.authRange) + '，確認權限完成'
                            });
                            next();
                            return;
                        } else {
                            ma = authMapping['authNotGranted'];
                            delete socket.request.session.status;
                            socket.request.session.save();
                            socket.request.session.status = {
                                title: '無權限操作',
                                type: 1,
                                tick: dayjs().unix()
                            };
                            socket.request.session.save();
                            await models.logModel.create({ 
                                tick: dayjs().unix(),
                                name: ObjectId(user._id),
                                where: action.where,
                                action: ma.action + '需要權限：' + JSON.stringify(action.authRange) + '，無權限操作'
                            });
                            next();
                            return;
                        }
                    } else {
                        ma = authMapping['authGranted'];
                        delete socket.request.session.status;
                        socket.request.session.save();
                        socket.request.session.status = {
                            title: '無權限驗證完成',
                            type: 3,
                            tick: dayjs().unix()
                        };
                        socket.request.session.save();
                        await models.logModel.create({ 
                            tick: dayjs().unix(),
                            name: ObjectId(user._id),
                            where: action.where,
                            action: ma.action + '無權限驗證完成'
                        });
                        next();
                        return;
                    }
                }
            }
            ma = authMapping['authNotAccess'];
            delete socket.request.session.status;
            socket.request.session.save();
            socket.request.session.status = {
                title: '尚未登入',
                type: 0,
                tick: dayjs().unix()
            };
            socket.request.session.save();
            await models.logModel.create({ 
                tick: dayjs().unix(),
                name: authMapping.nobodyAccount,
                where: action.where,
                action: ma.action
            });
            next();
            return;
        } else {
            ma = authMapping['authPublicAccess'];
            delete socket.request.session.status;
            socket.request.session.save();
            socket.request.session.status = {
                title: '尚未登入',
                type: 0,
                tick: dayjs().unix()
            };
            socket.request.session.save();
            await models.logModel.create({ 
                tick: dayjs().unix(),
                name: authMapping.nobodyAccount,
                where: action.where,
                action: ma.action
            });
            next();
            return;
        }
    } catch(e) {
        console.log("error:" + event + "/" + e);
        next();
        return;
    }
}