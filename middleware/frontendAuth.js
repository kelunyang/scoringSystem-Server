module.exports = async (models) => {
    let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
    let authTable = {
        '/userDashBoard': true,
        '/createKB': setting.projectTags,
        '/setting': setting.settingTags,
        '/messageMgnt': setting.settingTags,
        '/Chart': setting.projectTags,
        '/userMgnt': setting.userTags,
        '/Info': true
    }
    return authTable;
}