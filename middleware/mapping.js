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
    addChapter: {
      action: '新增章節',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    setChapter: {
      action: '設定章節',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    saveSort: {
      action: '儲存知識點順序',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    removeChapter: {
      action: '刪除章節',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    addKB: {
      action: '新增知識點',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    setKB: {
      action: '編輯知識點',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    removeKB: {
      action: '刪除知識點',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    getStage: {
      action: '取得知識點編輯階段',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    addStage: {
      action: '新增知識點編輯階段',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    setStage: {
      action: '設定知識點編輯階段',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    removeStage: {
      action: '刪除知識點編輯階段',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    getChapters: {
      action: '列出知識點',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    sendKBFile: {
      action: '上傳知識點附件檔',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    deleteKBFile: {
      action: '刪除知識點附件檔',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    cloneStages: {
      action: '複製知識點編輯階段',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    importKBZip: {
      action: '匯入知識點ZIP檔',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    getKBAttachment: {
      action: '取得知識點說明附件',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    getissueAttachment: {
      action: '取得Issue附件',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    dashBoardEventLog: {
      action: '取得知識點中處理事件的統計',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    dashBoardUnreaded: {
      action: '取得知識點中未讀取的Issue統計',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    dashboardUnreadedVersions: {
      action: '取得知識點中未讀取的版本檔案統計',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    setreadedVersion: {
      action: '將知識點版本標記為已讀取',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    listDashBoard: {
      action: '取得使用者歸屬的知識點',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    participantStatstics: {
      action: '取得知識點參與者統計',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    sendKBVersion: {
      action: '上傳知識點版本',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    deleteKBVersion: {
      action: '刪除知識點版本',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    getKBVersions: {
      action: '取得知識點版本',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    getlatestVersions: {
      action: '取得最新版本',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    getKB: {
      action: '取得單一知識點',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    getissueList: {
      action: '取得單一知識點Issue清單',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    setIssue: {
      action: '修改Issue',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    getIssue: {
      action: '取得Issue',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    editIssue: {
      action: '取得新增的Issue',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    setissueStar: {
      action: '標記為重要Issue',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    setissueStatus: {
      action: '設定Issue狀態',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    removeIssue: {
      action: '刪除Issue',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    addIssue: {
      action: '新增Issue',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    addObjective: {
      action: '新增目標',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    setObjective: {
      action: '同意或不同意目標',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    removeObjective: {
      action: '刪除目標',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    leaveKBEditing: {
      action: '離開共同編輯',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    joinKBEditing: {
      action: '加入共同編輯',
      where: '知識點模組',
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
    sendissueFile: {
      action: '送出Issue附件',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    deleteissueFile: {
      action: '刪除Issue附件',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    setReadedIssue: {
      action: '設定讀取Issue清單',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    getReadedIssue: {
      action: '取得讀取Issue清單',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    setKBTag: {
      action: '設定知識點標籤',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    importKBstatistics: {
      action: '匯入知識點統計',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    periodKBStatistics: {
      action: '知識點統計',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    periodKBranking: {
      action: '知識點統計',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    getGithubCommit: {
      action: '取得最新Github上的Commit',
      where: '設定模組',
      authRange: [],
      loginRequire: true
    },
    startV2ray: {
      action: '啟動v2ray',
      where: '設定模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    stopV2ray: {
      action: '結束v2ray',
      where: '設定模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    checkV2ray: {
      action: '檢查v2ray',
      where: '設定模組',
      authRange: setting.settingTags,
      loginRequire: true
    },
    revokeObjectives: {
      action: '全數撤回審查目標許可',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    revokeObjective: {
      action: '撤回審查單一目標許可',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
      loginRequire: true
    },
    pointerStageTags: {
      action: '快速指派知識點權限標籤',
      where: '知識點模組',
      authRange: _.flatten([setting.settingTags, setting.projectTags]),
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
    fetchStorage: {
      action: 'iOS裝置專用下載API',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    dashboardObjectives: {
      action: 'dashboard下載當前階段的目標統計',
      where: '知識點模組',
      authRange: [],
      loginRequire: true
    },
    listKBLog: {
      action: 'dashboard下載知識點編輯紀錄',
      where: '知識點模組',
      authRange: [],
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
      authRange: [],
      loginRequire: true
    }
  }
}