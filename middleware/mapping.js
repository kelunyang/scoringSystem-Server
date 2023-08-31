import _ from 'lodash';

export default async function (models) {
  let robotSettings = await models.robotModel.findOne({}).sort({_id: 1}).exec();
  let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
  return  {
    nobodyAccount: robotSettings.nobodyAccount,
    dbStatus: {
      action: '資料庫檢查',
      where: '同步檢查模組',
      authRange: [],
      loginRequire: false
    },
    login: {
      action: '登入',
      where: '登入模組',
      authRange: [],
      loginRequire: false
    },
    loginSuccess: {
      action: '登入成功',
      where: '登入模組',
      authRange: [],
      loginRequire: true
    },
    loginFail: {
      action: '登入失敗',
      where: '登入模組',
      authRange: [],
      loginRequire: true
    },
    logout: {
      action: '登出成功',
      where: '登入模組',
      authRange: [],
      loginRequire: true
    },
    authGranted: {
      action: '',
      where: '驗證模組',
      authRange: [],
      loginRequire: true
    },
    authNotGranted: {
      action: '需要權限：',
      where: '驗證模組',
      authRange: [],
      loginRequire: true
    },
    authNotAccess: {
      action: '尚未登入',
      where: '驗證模組',
      authRange: [],
      loginRequire: true
    },
    authPublicAccess: { //無登入需求就會得到這個
      action: '公開權限',
      where: '驗證模組',
      authRange: [],
      loginRequire: true
    },
    getGlobalSettings: {
      action: '取得全域設定',
      where: '設定模組',
      authRange: [],
      loginRequire: true
    },
    getRobotSetting: {
      action: '取得機器人巡查設定',
      where: '設定模組',
      authRange: [],
      loginRequire: true
    },
    getProjectSetting: {
      action: '取得專案設定',
      where: '設定模組',
      authRange: [],
      loginRequire: true
    },
    getTags: {
      action: '取得標籤名單',
      where: '標籤模組',
      authRange: [],
      loginRequire: false
    },
    createUser: {
      action: '建立帳號',
      where: '帳號模組',
      authRange: [],
      loginRequire: true
    },
    getCurrentUser: {
      action: '查詢當前使用者',
      where: '同步檢查模組',
      authRange: [],
      loginRequire: false
    },
    setCurrentUser: {
      action: '設定當前使用者',
      where: '帳號模組',
      authRange: [],
      loginRequire: true
    },
    lineNotify: {
      action: 'LINE Notify綁定',
      where: '帳號模組',
      authRange: [],
      loginRequire: false
    },
    sendLINEnotify: {
      action: 'LINE Notify發送',
      where: 'LINE模組',
      authRange: [],
      loginRequire: true
    },
    getLINElog: {
      action: 'LINE Notify紀錄',
      where: 'LINE模組',
      authRange: [],
      loginRequire: true
    },
    addTag: {
      action: '新增標籤',
      where: '標籤模組',
      authRange: [],
      loginRequire: true
    },
    setSetting: {
      action: '修改系統設定',
      where: '設定模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    getTagUsers: {
      action: '取得特定群組使用者',
      where: '使用者模組',
      authRange: [],
      loginRequire: true
    },
    sendMsgFile: {
      action: '新增公告附件檔案',
      where: '檔案模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    deleteMsgFile: {
      action: '刪除公告附件檔案',
      where: '檔案模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    addMsg: {
      action: '新增訊息',
      where: '訊息模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    getMessage: {
      action: '取得訊息',
      where: '訊息模組',
      authRange: [],
      loginRequire: true
    },
    saveMessage: {
      action: '儲存訊息',
      where: '訊息模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    removeMessage: {
      action: '刪除訊息',
      where: '訊息模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    getmsgAttachment: {
      action: '取得附件列表',
      where: '訊息模組',
      authRange: [],
      loginRequire: true
    },
    getMessages: {
      action: '取得訊息列表',
      where: '訊息模組',
      authRange: [],
      loginRequire: true
    },
    getbroadcastLog: {
      action: '取得全域廣播列表',
      where: '訊息模組',
      authRange: [],
      loginRequire: true
    },
    sendBroadcast: {
      action: '發送全域廣播',
      where: '訊息模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    getIndexMessages: {
      action: '取得首頁三公告',
      where: '訊息模組',
      authRange: [],
      loginRequire: false
    },
    getUsers: {
      action: '取得使用者列表',
      where: '使用者模組',
      authRange: _.flatten([setting.settingTags, setting.userTags, setting.projectTags]),
      loginRequire: true
    },
    modUserTags: {
      action: '修改使用者的用戶標籤',
      where: '使用者模組',
      authRange: _.flatten([setting.settingTags, setting.userTags, setting.projectTags]),
      loginRequire: true
    },
    removeUser: {
      action: '刪除使用者',
      where: '使用者模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    createUsers: {
      action: '新增使用者',
      where: '使用者模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    passwordReset: {
      action: '重置用戶密碼',
      where: '使用者模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    modUsers: {
      action: '修改用戶',
      where: '使用者模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    checkTagUsers: {
      action: '標籤內的用戶數量',
      where: '標籤模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    passwordClientReset: {
      action: '用戶端重置密碼',
      where: '使用者模組',
      authRange: [],
      loginRequire: false
    },
    getsiteSetting: {
      action: '用戶端取得全站設定',
      where: '同步檢查模組',
      authRange: [],
      loginRequire: false
    },
    checkEmail: {
      action: '檢查Email是否重複',
      where: '使用者模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    setEmail: {
      action: '設定用戶的新Email',
      where: '使用者模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    getAuthLevel: {
      action: '查詢用戶權限',
      where: '同步檢查模組',
      authRange: [],
      loginRequire: false
    },
    getsiteAdminUsers: {
      action: '查詢系統管理群',
      where: '標籤模組',
      authRange: [],
      loginRequire: true
    },
    getfeedbackList: {
      action: '取得用戶回饋列表',
      where: '用戶回饋模組',
      authRange: [],
      loginRequire: true
    },
    getFeedback: {
      action: '取得用戶回饋',
      where: '用戶回饋模組',
      authRange: [],
      loginRequire: true
    },
    userAlived: {
      action: '確認用戶狀態',
      where: '登入模組',
      authRange: [],
      loginRequire: true
    },
    deletefeedbackFile: {
      action: '刪除用戶回饋附件',
      where: '檔案模組',
      authRange: [],
      loginRequire: true
    },
    sendfeedbackFile: {
      action: '新增用戶回饋附件',
      where: '檔案模組',
      authRange: [],
      loginRequire: true
    },
    addFeedback: {
      action: '新增用戶回饋',
      where: '用戶回饋模組',
      authRange: [],
      loginRequire: true
    },
    editFeedback: {
      action: '新增用戶回饋',
      where: '用戶回饋模組',
      authRange: [],
      loginRequire: true
    },
    setFeedback: {
      action: '修改用戶回饋',
      where: '用戶回饋模組',
      authRange: [],
      loginRequire: true
    },
    setStatus: {
      action: '修改用戶回饋狀態',
      where: '用戶回饋模組',
      authRange: [],
      loginRequire: true
    },
    setRating: {
      action: '修改用戶回饋評分',
      where: '用戶回饋模組',
      authRange: [],
      loginRequire: true
    },
    setAgree: {
      action: '用戶回饋加入同意',
      where: '用戶回饋模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    removeFeedback: {
      action: '刪除用戶回饋',
      where: '用戶回饋模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    getfeedbackAttachment: {
      action: '取得用戶回饋附件',
      where: '用戶回饋模組',
      authRange: [],
      loginRequire: true
    },
    getConcurrentUsers: {
      action: '取得同時線上用戶',
      where: '同步檢查模組',
      authRange: [],
      loginRequire: true
    },
    incommingChat: {
      action: '發送聊天訊息',
      where: '同步檢查模組',
      authRange: [],
      loginRequire: true
    },
    userInbound: {
      action: '用戶登入',
      where: '登入模組',
      authRange: [],
      loginRequire: true
    },
    userRestored: {
      action: '用戶資料復原',
      where: '登入模組',
      authRange: [],
      loginRequire: true
    },
    clearCurrentUser: {
      action: '清除用戶資料',
      where: '登入模組',
      authRange: [],
      loginRequire: true
    },
    getGithubCommit: {
      action: '取得最新Github上的Commit',
      where: '設定模組',
      authRange: [],
      loginRequire: true
    },
    checkbotVM: {
      action: '檢查機器人機狀態',
      where: '設定模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    addNTemplate: {
      action: '新增通知機器人文字範本',
      where: '訊息模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    modNTemplate: {
      action: '修改通知機器人文字範本',
      where: '訊息模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    removeNTemplate: {
      action: '刪除通知機器人文字範本',
      where: '訊息模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    listNTemplate: {
      action: '列出通知機器人文字範本',
      where: '訊息模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    listRobotLog: {
      action: '列出通知機器人執行紀錄',
      where: '設定模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    setTagname: {
      action: '修改標籤名稱',
      where: '標籤模組',
      authRange: [],
      loginRequire: true
    },
    setTagvis: {
      action: '修改標籤狀態',
      where: '標籤模組',
      authRange: [],
      loginRequire: true
    },
    importUserlist: {
      action: '匯入使用者清單',
      where: '使用者模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    importbulkmsgFile: {
      action: '匯入大量訊息發送清單',
      where: '訊息模組',
      authRange: _.flatten([setting.settingTags, setting.userTags]),
      loginRequire: true
    },
    getPersonalBalance: {
      action: '查詢個人存款',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    getPersonalAccounting: {
      action: '查詢個人帳本',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    getSchemaBalance: {
      action: '查詢活動參與者存款',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    getGroups: {
      action: '查詢活動分組',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    getGroup: {
      action: '查詢各組細項',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    getPersonalGroup: {
      action: '查詢個人分組',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    setMember: {
      action: '設定分組成員',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    setLeader: {
      action: '設定分組組長',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    getLoner: {
      action: '查詢沒有組別的人',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    addGroup: {
      action: '增加分組',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    removeGroup: {
      action: '移除分組',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    setLocker: {
      action: '鎖定分組',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    getEventLog: {
      action: '取得活動紀錄',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    getSchemas: {
      action: '取得活動列表',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    getJoined: {
      action: '取得參與的活動列表',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    getSchema: {
      action: '取得活動細項',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    getStage: {
      action: '取得活動階段',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    getStages: {
      action: '取得活動階段列表',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    addSchema: {
      action: '增加活動',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    addStage: {
      action: '增加階段',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    modSchema: {
      action: '修改活動',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    modStage: {
      action: '修改階段',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    removeStage: {
      action: '移除階段',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    removeSchema: {
      action: '刪除活動',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    getGranted: {
      action: '取得評分概算',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    getReporthistory: {
      action: '取得報告紀錄',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    getAudit: {
      action: '取得評分',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    getAudits: {
      action: '取得評分列表',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    getReport: {
      action: '取得報告細項',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    addReport: {
      action: '增加報告',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    addAudit: {
      action: '增加評分',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    calcReport: {
      action: '計算報告評分',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    auditFeedback: {
      action: '確認報告評分',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    rejectReport: {
      action: '退回報告',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    statusSchema: {
      action: '調整活動狀態',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    getReports: {
      action: '查詢報告',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    getStageLists: {
      action: '查詢活動列表',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    orderStages: {
      action: '儲存活動列表',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    getLeaders: {
      action: '取得分組組長名單',
      where: '分組模組',
      authRange: [],
      loginRequire: true
    },
    setGroupTag: {
      action: '調整分組標籤',
      where: '分組模組',
      authRange: [],
      loginRequire: true
    },
    getCoworkers: {
      action: '取得同組成員',
      where: '分組模組',
      authRange: [],
      loginRequire: true
    },
    setGrant: {
      action: '設定報告分數',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    confirmAudit: {
      action: '確認評分',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    getSelectedUsers: {
      action: '取得指定的使用者清單',
      where: '分組模組',
      authRange: [],
      loginRequire: true
    },
    getSchemaUsers: {
      action: '取得參與特定活動的使用者清單',
      where: '分組模組',
      authRange: [],
      loginRequire: true
    },
    lockReport: {
      action: '鎖住報告',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    previewReport: {
      action: '報告成績概算',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    previewAudit: {
      action: '評分成績概算',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    previewFeedback: {
      action: '確認評分成績概算',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    getAuditionGap: {
      action: '報告已回答組別概算',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    closeStage: {
      action: '關閉活動階段',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    rejectAccounting: {
      action: '撤銷記帳紀錄',
      where: '記帳模組',
      authRange: [],
      loginRequire: true
    },
    getOwnGroup: {
      action: '取得自己的編組',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    getGroupTags: {
      action: '取得群組清單的標籤',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    getTagGroups: {
      action: '依照標籤取得群組清單',
      where: '群組模組',
      authRange: [],
      loginRequire: true
    },
    noreplyStage: {
      action: '關閉該階段的評分',
      where: '活動模組',
      authRange: [],
      loginRequire: true
    },
    addIntervention: {
      action: '給予人為評分調整',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    getInterventions: {
      action: '查詢人為評分調整',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    rejectAudit: {
      action: '撤回互評',
      where: '評分模組',
      authRange: [],
      loginRequire: true
    },
    getDeposit: {
      action: '檢查押金',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    getDepositBalance: {
      action: '取得押金',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    getDepositAccounting: {
      action: '取得押金使用狀況',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    joinStage: {
      action: '加入回合',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    getDeposited: {
      action: '取得押金狀態',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    rejectDeposit: {
      action: '退回押金',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    revokeDeposit: {
      action: '重設未押注者',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    setBonus: {
      action: '發放獎勵點數',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    queryBonus: {
      action: '查詢獎勵點數',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
    rejectBonusAccounting: {
      action: '取消獎勵點數',
      where: '帳本模組',
      authRange: [],
      loginRequire: true
    },
  }
}