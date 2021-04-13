const _ = require('lodash');

module.exports = async (models) => {
    let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
    let authTable = {
        '/userDashBoard': [],
        '/createKB': _.flatten([setting.projectTags, setting.settingTags]),
        '/setting': setting.settingTags,
        '/messageMgnt': setting.settingTags,
        '/Chart': _.flatten([setting.statisticsTags, setting.settingTags]),
        '/userMgnt': _.flatten([setting.userTags, setting.settingTags]),
        '/Info': []
    }
    return authTable;
}