const moment = require('moment');
const { ObjectId } = require('mongodb');

module.exports = async (socket, models, [event], next) => {
    console.log("socket event:" + event);
    const authMapping = await require('./mapping')(models);
    let action = authMapping[event];
    let ma = undefined;
    if(action.loginRequire) {
        if(socket.request.session.hasOwnProperty('passport')) {
            if(socket.request.session.passport.hasOwnProperty('user')) {
                let user = await models.userModel.findOne({
                    _id: ObjectId(socket.request.session.passport.user)
                }).sort({_id: 1}).exec();
                if(action.authRange.length !== 0) {
                    let found = false;
                    action.authRange.forEach((tag) => {
                        found = user.tags.find(tag);
                    });
                    if(found) {
                        ma = authMapping['authGranted'];
                        delete socket.request.session.status;
                        socket.request.session.save();
                        socket.request.session.status = {
                            title: '確認權限完成',
                            type: 3,
                            tick: moment().unix()
                        };
                        socket.request.session.save();
                        await models.logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: ma.where,
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
                            tick: moment().unix()
                        };
                        socket.request.session.save();
                        await models.logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: ma.where,
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
                        tick: moment().unix()
                    };
                    socket.request.session.save();
                    await models.logModel.create({ 
                        tick: moment().unix(),
                        name: ObjectId(user._id),
                        where: ma.where,
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
            tick: moment().unix()
        };
        socket.request.session.save();
        await models.logModel.create({ 
            tick: moment().unix(),
            name: authMapping.nobodyAccount,
            where: ma.where,
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
            tick: moment().unix()
        };
        socket.request.session.save();
        await models.logModel.create({ 
            tick: moment().unix(),
            name: authMapping.nobodyAccount,
            where: ma.where,
            action: ma.action
        });
        next();
        return;
    }
}