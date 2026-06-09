export enum CaseType {
  POLLUTION_ENVIRONMENT = 'pollution_environment',
  ILLEGAL_MINING = 'illegal_mining',
  ILLEGAL_HUNTING = 'illegal_hunting',
  ECOLOGICAL_DAMAGE_COMPENSATION = 'ecological_damage_compensation',
  ILLEGAL_LOGGING = 'illegal_logging',
  ILLEGAL_FISHING = 'illegal_fishing',
  WILDLIFE_PROTECTION = 'wildlife_protection',
  WATER_RESOURCE_PROTECTION = 'water_resource_protection'
}

export enum CaseComplexity {
  SIMPLE = 'simple',
  COMPLEX = 'complex'
}

export enum CaseStage {
  ACCEPTED = 'accepted',
  TRIAL = 'trial',
  JUDGMENT = 'judgment',
  ARCHIVED = 'archived'
}

export enum CaseStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  URGENT = 'urgent'
}

export enum TransferSource {
  LOCAL_COURT = 'local_court',
  PROCURATORATE = 'procuratorate',
  PUBLIC_SECURITY = 'public_security',
  OTHER_CIRCUIT_COURT = 'other_circuit_court',
  PARTY_APPLICATION = 'party_application'
}

export enum JudgeSpecialty {
  POLLUTION_CONTROL = 'pollution_control',
  MINERAL_RESOURCES = 'mineral_resources',
  WILDLIFE = 'wildlife',
  ECOLOGICAL_RESTORATION = 'ecological_restoration',
  WATER_RESOURCES = 'water_resources',
  GENERAL = 'general'
}

export const CaseTypeMap: Record<CaseType, string> = {
  [CaseType.POLLUTION_ENVIRONMENT]: '污染环境',
  [CaseType.ILLEGAL_MINING]: '非法采矿',
  [CaseType.ILLEGAL_HUNTING]: '非法狩猎',
  [CaseType.ECOLOGICAL_DAMAGE_COMPENSATION]: '生态损害赔偿',
  [CaseType.ILLEGAL_LOGGING]: '非法伐木',
  [CaseType.ILLEGAL_FISHING]: '非法捕捞',
  [CaseType.WILDLIFE_PROTECTION]: '野生动植物保护',
  [CaseType.WATER_RESOURCE_PROTECTION]: '水资源保护'
};

export const CaseComplexityMap: Record<CaseComplexity, string> = {
  [CaseComplexity.SIMPLE]: '简案',
  [CaseComplexity.COMPLEX]: '繁案'
};

export const CaseStageMap: Record<CaseStage, string> = {
  [CaseStage.ACCEPTED]: '受理',
  [CaseStage.TRIAL]: '审理',
  [CaseStage.JUDGMENT]: '裁判',
  [CaseStage.ARCHIVED]: '归档'
};

export const CaseStatusMap: Record<CaseStatus, string> = {
  [CaseStatus.PENDING]: '待处理',
  [CaseStatus.PROCESSING]: '处理中',
  [CaseStatus.COMPLETED]: '已完成',
  [CaseStatus.OVERDUE]: '超审限',
  [CaseStatus.URGENT]: '即将到期'
};

export const TransferSourceMap: Record<TransferSource, string> = {
  [TransferSource.LOCAL_COURT]: '地方法院',
  [TransferSource.PROCURATORATE]: '检察院',
  [TransferSource.PUBLIC_SECURITY]: '公安机关',
  [TransferSource.OTHER_CIRCUIT_COURT]: '其他巡回法庭',
  [TransferSource.PARTY_APPLICATION]: '当事人申请'
};

export const JudgeSpecialtyMap: Record<JudgeSpecialty, string> = {
  [JudgeSpecialty.POLLUTION_CONTROL]: '污染防治',
  [JudgeSpecialty.MINERAL_RESOURCES]: '矿产资源',
  [JudgeSpecialty.WILDLIFE]: '野生动植物',
  [JudgeSpecialty.ECOLOGICAL_RESTORATION]: '生态修复',
  [JudgeSpecialty.WATER_RESOURCES]: '水资源',
  [JudgeSpecialty.GENERAL]: '综合'
};
