const moment = require('moment');
const { ObjectId } = require('mongodb');
const authMapping = require('./mapping')();

module.exports = async (socket, logModel, [event], next) => {
    console.log(event);
    let action = authMapping[event];
    let ma = undefined;
    if(action.loginRequire) {
        if(socket.request.session.hasOwnProperty('passport')) {
            if(socket.request.session.hasOwnProperty('user')) {
                let user = await userModel.findOne({
                    _id: ObjectId(socket.request.session.passport.user)
                }).sort({_id: 1}).exec();
                if(action.authRange.length !== 0) {
                    let found = false;
                    action.authRange.forEach((tag) => {
                        found = user.tags.find(tag);
                    });
                    if(found) {
                        ma = authMapping['authGranted'];
                        socket.request.session.status = {
                            title: '確認權限完成',
                            type: 3,
                            tick: moment().unix()
                        };
                        socket.request.session.save();
                        await logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: ma.where,
                            action: ma.action + '需要權限：' + JSON.stringify(action.authRange) + '，確認權限完成'
                        });
                        await logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: action.where,
                            action: action.action + '完成'
                        });
                        next();
                    } else {
                        ma = authMapping['authNotGranted'];
                        socket.request.session.status = {
                            title: '無權限操作',
                            type: 1,
                            tick: moment().unix()
                        };
                        socket.request.session.save();
                        await logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: ma.where,
                            action: ma.action + '需要權限：' + JSON.stringify(action.authRange) + '，無權限操作'
                        });
                        await logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: action.where,
                            action: action.action + '失敗'
                        });
                        next();
                    }
                } else {
                    ma = authMapping['authGranted'];
                    socket.request.session.status = {
                        title: '無權限驗證完成',
                        type: 3,
                        tick: moment().unix()
                    };
                    socket.request.session.save();
                    await logModel.create({ 
                        tick: moment().unix(),
                        name: ObjectId(user._id),
                        where: ma.where,
                        action: ma.action + '無權限驗證完成'
                    });
                    await logModel.create({ 
                        tick: moment().unix(),
                        name: ObjectId(user._id),
                        where: action.where,
                        action: action.action + '完成'
                    });
                    next();
                }
            }
        }
        ma = authMapping['authNotAccess'];
        socket.request.session.status = {
            title: '尚未登入',
            type: 0,
            tick: moment().unix()
        };
        socket.request.session.save();
        await logModel.create({ 
            tick: moment().unix(),
            name: ObjectId("60122c1fd1308739d0991523"),
            where: ma.where,
            action: ma.action
        });
        await logModel.create({ 
            tick: moment().unix(),
            name: ObjectId("60122c1fd1308739d0991523"),
            where: action.where,
            action: action.action + '(未登入模式)'
        });
        next();
    } else {
        ma = authMapping['authNotAccess'];
        socket.request.session.status = {
            title: '尚未登入',
            type: 0,
            tick: moment().unix()
        };
        socket.request.session.save();
        await logModel.create({ 
            tick: moment().unix(),
            name: ObjectId("60122c1fd1308739d0991523"),
            where: ma.where,
            action: ma.action
        });
        await logModel.create({ 
            tick: moment().unix(),
            name: ObjectId("60122c1fd1308739d0991523"),
            where: action.where,
            action: action.action + '(未登入模式)'
        });
        next();
    }
}