export type Translations = {
  nav: {
    dashboard: string;
    workspaces: string;
    inbox: string;
    reports: string;
    daily: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    serverStatus: string;
    apiLatency: string;
    workerQueue: string;
    authSessions: string;
    webhooks: string;
    recentActivity: string;
    quickActions: string;
    online: string;
    offline: string;
    connectServer: string;
    stats: {
      workspaces: string;
      projects: string;
      openTasks: string;
      members: string;
    };
  };
  workspace: {
    title: string;
    noWorkspaces: string;
    projects: string;
    members: string;
    created: string;
  };
  project: {
    title: string;
    tasks: string;
    milestones: string;
    risks: string;
    documents: string;
    summary: string;
    status: string;
    owner: string;
    startDate: string;
    dueDate: string;
    noProjects: string;
  };
  task: {
    title: string;
    importance: string;
    stage: string;
    assignees: string;
    comments: string;
    timeEntries: string;
    dependencies: string;
    description: string;
    noTasks: string;
    noComments: string;
    predecessor: string;
    successor: string;
  };
  milestone: {
    title: string;
    open: string;
    completed: string;
    missed: string;
    noMilestones: string;
  };
  risk: {
    title: string;
    probability: string;
    impact: string;
    status: string;
    mitigation: string;
    noRisks: string;
  };
  inbox: {
    title: string;
    unread: string;
    all: string;
    noMessages: string;
    markAllRead: string;
    types: {
      MENTION: string;
      ASSIGNMENT: string;
      STATUS_CHANGE: string;
      COMMENT: string;
      REMINDER: string;
      DIRECT_MESSAGE: string;
      SYSTEM: string;
    };
  };
  report: {
    title: string;
    summary: string;
    workload: string;
    timeReport: string;
    totalTasks: string;
    overdue: string;
    byCategory: string;
    byImportance: string;
    noData: string;
  };
  daily: {
    title: string;
    achievements: string;
    plans: string;
    issues: string;
    noDailyReports: string;
    reportDate: string;
  };
  common: {
    loading: string;
    error: string;
    retry: string;
    noData: string;
    back: string;
    search: string;
    filter: string;
    total: string;
    createdAt: string;
    updatedAt: string;
    dueAt: string;
    language: string;
  };
  importance: {
    LOW: string;
    NORMAL: string;
    HIGH: string;
    CRITICAL: string;
  };
  status: {
    ACTIVE: string;
    ON_HOLD: string;
    COMPLETED: string;
    CANCELLED: string;
  };
  riskStatus: {
    IDENTIFIED: string;
    MITIGATING: string;
    MITIGATED: string;
    OCCURRED: string;
    ACCEPTED: string;
  };
  riskProb: {
    LOW: string;
    MEDIUM: string;
    HIGH: string;
  };
  riskImpact: {
    LOW: string;
    MEDIUM: string;
    HIGH: string;
    CRITICAL: string;
  };
};

export const ja: Translations = {
  nav: {
    dashboard: "ダッシュボード",
    workspaces: "ワークスペース",
    inbox: "受信トレイ",
    reports: "レポート",
    daily: "日報",
  },
  dashboard: {
    title: "コントロールサーフェス",
    subtitle: "pmpm サーバーコンソール",
    serverStatus: "サーバーステータス",
    apiLatency: "APIレイテンシ",
    workerQueue: "ワーカーキュー",
    authSessions: "認証セッション",
    webhooks: "Webhook",
    recentActivity: "最近のアクティビティ",
    quickActions: "クイックアクション",
    online: "オンライン",
    offline: "オフライン",
    connectServer: "サーバー接続",
    stats: {
      workspaces: "ワークスペース",
      projects: "プロジェクト",
      openTasks: "未完了タスク",
      members: "メンバー",
    },
  },
  workspace: {
    title: "ワークスペース",
    noWorkspaces: "ワークスペースがありません",
    projects: "プロジェクト",
    members: "メンバー",
    created: "作成日",
  },
  project: {
    title: "プロジェクト",
    tasks: "タスク",
    milestones: "マイルストーン",
    risks: "リスク",
    documents: "ドキュメント",
    summary: "サマリー",
    status: "ステータス",
    owner: "オーナー",
    startDate: "開始日",
    dueDate: "期限",
    noProjects: "プロジェクトがありません",
  },
  task: {
    title: "タスク",
    importance: "重要度",
    stage: "ステージ",
    assignees: "担当者",
    comments: "コメント",
    timeEntries: "作業時間",
    dependencies: "依存関係",
    description: "説明",
    noTasks: "タスクがありません",
    noComments: "コメントがありません",
    predecessor: "前提タスク",
    successor: "後続タスク",
  },
  milestone: {
    title: "マイルストーン",
    open: "未完了",
    completed: "完了",
    missed: "未達",
    noMilestones: "マイルストーンがありません",
  },
  risk: {
    title: "リスク",
    probability: "発生確率",
    impact: "影響度",
    status: "ステータス",
    mitigation: "軽減策",
    noRisks: "リスクがありません",
  },
  inbox: {
    title: "受信トレイ",
    unread: "未読",
    all: "すべて",
    noMessages: "メッセージがありません",
    markAllRead: "すべて既読にする",
    types: {
      MENTION: "メンション",
      ASSIGNMENT: "アサイン",
      STATUS_CHANGE: "ステータス変更",
      COMMENT: "コメント",
      REMINDER: "リマインダー",
      DIRECT_MESSAGE: "ダイレクトメッセージ",
      SYSTEM: "システム",
    },
  },
  report: {
    title: "レポート",
    summary: "サマリー",
    workload: "ワークロード",
    timeReport: "作業時間",
    totalTasks: "タスク総数",
    overdue: "期限超過",
    byCategory: "カテゴリ別",
    byImportance: "重要度別",
    noData: "データがありません",
  },
  daily: {
    title: "日報",
    achievements: "実績",
    plans: "計画",
    issues: "課題",
    noDailyReports: "日報がありません",
    reportDate: "日付",
  },
  common: {
    loading: "読み込み中...",
    error: "エラーが発生しました",
    retry: "再試行",
    noData: "データがありません",
    back: "戻る",
    search: "検索",
    filter: "フィルター",
    total: "合計",
    createdAt: "作成日時",
    updatedAt: "更新日時",
    dueAt: "期限",
    language: "言語",
  },
  importance: {
    LOW: "低",
    NORMAL: "通常",
    HIGH: "高",
    CRITICAL: "緊急",
  },
  status: {
    ACTIVE: "アクティブ",
    ON_HOLD: "保留",
    COMPLETED: "完了",
    CANCELLED: "キャンセル",
  },
  riskStatus: {
    IDENTIFIED: "識別済み",
    MITIGATING: "軽減中",
    MITIGATED: "軽減済み",
    OCCURRED: "発生済み",
    ACCEPTED: "受容",
  },
  riskProb: {
    LOW: "低",
    MEDIUM: "中",
    HIGH: "高",
  },
  riskImpact: {
    LOW: "低",
    MEDIUM: "中",
    HIGH: "高",
    CRITICAL: "致命的",
  },
};
