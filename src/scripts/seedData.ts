import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB, disconnectDB } from "../config/database";
import CircuitCourt from "../models/CircuitCourt";
import Judge from "../models/Judge";
import CaseModel from "../models/Case";
import CaseFlowRecord from "../models/CaseFlowRecord";
import TransferTrail from "../models/TransferTrail";
import {
  CaseType,
  CaseComplexity,
  CaseStage,
  CaseStatus,
  TransferSource,
  JudgeSpecialty,
} from "../types/enums";
import { getTotalTrialDaysLimit } from "../services/caseFlowService";

dotenv.config();

export async function checkAndSeedData(): Promise<boolean> {
  const courtCount = await CircuitCourt.countDocuments();
  if (courtCount > 0) {
    console.log("📊 数据库已存在数据，跳过初始化");
    return false;
  }

  console.log("🚀 检测到空数据库，开始自动初始化示例数据...\n");
  const courtIds = await seedCourts();
  const judgeIdMap = await seedJudges(courtIds);
  await seedCases(courtIds, judgeIdMap);
  console.log("\n🎉 示例数据初始化完成！");
  return true;
}

const courtsData = [
  {
    name: "郑州环境资源巡回法庭",
    code: "ZZ",
    location: "郑州市",
    address: "河南省郑州市金水区金水东路19号",
    phone: "0371-69520000",
    coveredCities: ["郑州市", "开封市", "新乡市"],
    coveredCounties: [
      "郑州市中原区",
      "郑州市二七区",
      "郑州市管城回族区",
      "郑州市金水区",
      "郑州市上街区",
      "郑州市惠济区",
      "中牟县",
      "巩义市",
      "荥阳市",
      "新密市",
      "新郑市",
      "登封市",
      "开封市龙亭区",
      "开封市顺河回族区",
      "开封市鼓楼区",
      "开封市禹王台区",
      "开封市祥符区",
      "杞县",
      "通许县",
      "尉氏县",
      "新乡市红旗区",
      "新乡市卫滨区",
      "新乡市凤泉区",
      "新乡市牧野区",
      "新乡县",
      "获嘉县",
      "原阳县",
      "延津县",
      "封丘县",
      "长垣市",
    ],
    jurisdictionScope: "郑州、开封、新乡三市环境资源案件集中管辖",
  },
  {
    name: "洛阳环境资源巡回法庭",
    code: "LY",
    location: "洛阳市",
    address: "河南省洛阳市洛龙区开元大道262号",
    phone: "0379-63369000",
    coveredCities: ["洛阳市", "三门峡市", "济源市"],
    coveredCounties: [
      "洛阳市老城区",
      "洛阳市西工区",
      "洛阳市瀍河回族区",
      "洛阳市涧西区",
      "洛阳市吉利区",
      "洛阳市洛龙区",
      "孟津区",
      "新安县",
      "栾川县",
      "嵩县",
      "汝阳县",
      "宜阳县",
      "洛宁县",
      "伊川县",
      "偃师区",
      "三门峡市湖滨区",
      "三门峡市陕州区",
      "渑池县",
      "卢氏县",
      "义马市",
      "灵宝市",
      "济源市沁园街道",
      "济源市济水街道",
      "济源市北海街道",
      "济源市天坛街道",
      "济源市玉泉街道",
      "济源市坡头镇",
    ],
    jurisdictionScope: "洛阳、三门峡、济源三市环境资源案件集中管辖",
  },
  {
    name: "安阳环境资源巡回法庭",
    code: "AY",
    location: "安阳市",
    address: "河南省安阳市文峰区文峰大道东段56号",
    phone: "0372-3163000",
    coveredCities: ["安阳市", "鹤壁市", "濮阳市"],
    coveredCounties: [
      "安阳市文峰区",
      "安阳市北关区",
      "安阳市殷都区",
      "安阳市龙安区",
      "安阳县",
      "汤阴县",
      "滑县",
      "内黄县",
      "林州市",
      "鹤壁市鹤山区",
      "鹤壁市山城区",
      "鹤壁市淇滨区",
      "浚县",
      "淇县",
      "濮阳市华龙区",
      "濮阳市清丰县",
      "濮阳市南乐县",
      "濮阳市范县",
      "濮阳市台前县",
      "濮阳市濮阳县",
    ],
    jurisdictionScope: "安阳、鹤壁、濮阳三市环境资源案件集中管辖",
  },
  {
    name: "商丘环境资源巡回法庭",
    code: "SQ",
    location: "商丘市",
    address: "河南省商丘市睢阳区南京路东段1号",
    phone: "0370-2209000",
    coveredCities: ["商丘市", "周口市"],
    coveredCounties: [
      "商丘市梁园区",
      "商丘市睢阳区",
      "民权县",
      "睢县",
      "宁陵县",
      "柘城县",
      "虞城县",
      "夏邑县",
      "永城市",
      "周口市川汇区",
      "周口市淮阳区",
      "扶沟县",
      "西华县",
      "商水县",
      "太康县",
      "鹿邑县",
      "郸城县",
      "沈丘县",
      "项城市",
    ],
    jurisdictionScope: "商丘、周口两市环境资源案件集中管辖",
  },
  {
    name: "信阳环境资源巡回法庭",
    code: "XY",
    location: "信阳市",
    address: "河南省信阳市浉河区107国道旁",
    phone: "0376-6362000",
    coveredCities: ["信阳市", "驻马店市", "漯河市", "许昌市"],
    coveredCounties: [
      "信阳市浉河区",
      "信阳市平桥区",
      "罗山县",
      "光山县",
      "新县",
      "商城县",
      "固始县",
      "潢川县",
      "淮滨县",
      "息县",
      "驻马店市驿城区",
      "西平县",
      "上蔡县",
      "平舆县",
      "正阳县",
      "确山县",
      "泌阳县",
      "汝南县",
      "遂平县",
      "新蔡县",
      "漯河市源汇区",
      "漯河市郾城区",
      "漯河市召陵区",
      "舞阳县",
      "临颍县",
      "许昌市魏都区",
      "许昌市建安区",
      "鄢陵县",
      "襄城县",
      "禹州市",
      "长葛市",
    ],
    jurisdictionScope: "信阳、驻马店、漯河、许昌四市环境资源案件集中管辖",
  },
  {
    name: "焦作环境资源巡回法庭",
    code: "JZ",
    location: "焦作市",
    address: "河南省焦作市解放区站前路86号",
    phone: "0391-3386000",
    coveredCities: ["焦作市", "鹤壁市", "济源市"],
    coveredCounties: [
      "焦作市解放区",
      "焦作市中站区",
      "焦作市马村区",
      "焦作市山阳区",
      "修武县",
      "博爱县",
      "武陟县",
      "温县",
      "沁阳市",
      "孟州市",
      "鹤壁市鹤山区",
      "鹤壁市山城区",
      "鹤壁市淇滨区",
      "浚县",
      "淇县",
      "济源市",
    ],
    jurisdictionScope: "焦作、鹤壁、济源三市环境资源案件集中管辖",
  },
];

const judgesData = [
  {
    name: "张明华",
    judgeId: "J001",
    specialties: [
      JudgeSpecialty.POLLUTION_CONTROL,
      JudgeSpecialty.WATER_RESOURCES,
    ],
  },
  {
    name: "李秀英",
    judgeId: "J002",
    specialties: [
      JudgeSpecialty.ECOLOGICAL_RESTORATION,
      JudgeSpecialty.POLLUTION_CONTROL,
    ],
  },
  {
    name: "王建国",
    judgeId: "J003",
    specialties: [JudgeSpecialty.MINERAL_RESOURCES, JudgeSpecialty.GENERAL],
  },
  {
    name: "赵晓燕",
    judgeId: "J004",
    specialties: [JudgeSpecialty.WILDLIFE, JudgeSpecialty.WATER_RESOURCES],
  },
  {
    name: "刘志强",
    judgeId: "J005",
    specialties: [JudgeSpecialty.GENERAL, JudgeSpecialty.POLLUTION_CONTROL],
  },
  {
    name: "陈美玲",
    judgeId: "J006",
    specialties: [
      JudgeSpecialty.WATER_RESOURCES,
      JudgeSpecialty.ECOLOGICAL_RESTORATION,
    ],
  },
  {
    name: "周明辉",
    judgeId: "J007",
    specialties: [JudgeSpecialty.MINERAL_RESOURCES, JudgeSpecialty.WILDLIFE],
  },
  {
    name: "吴雅芳",
    judgeId: "J008",
    specialties: [JudgeSpecialty.POLLUTION_CONTROL, JudgeSpecialty.GENERAL],
  },
  {
    name: "郑海涛",
    judgeId: "J009",
    specialties: [
      JudgeSpecialty.ECOLOGICAL_RESTORATION,
      JudgeSpecialty.MINERAL_RESOURCES,
    ],
  },
  {
    name: "孙丽娟",
    judgeId: "J010",
    specialties: [JudgeSpecialty.WILDLIFE, JudgeSpecialty.GENERAL],
  },
  {
    name: "钱伟强",
    judgeId: "J011",
    specialties: [
      JudgeSpecialty.WATER_RESOURCES,
      JudgeSpecialty.POLLUTION_CONTROL,
    ],
  },
  {
    name: "冯晓东",
    judgeId: "J012",
    specialties: [
      JudgeSpecialty.GENERAL,
      JudgeSpecialty.ECOLOGICAL_RESTORATION,
    ],
  },
  {
    name: "董玉婷",
    judgeId: "J013",
    specialties: [
      JudgeSpecialty.MINERAL_RESOURCES,
      JudgeSpecialty.POLLUTION_CONTROL,
    ],
  },
  {
    name: "许文博",
    judgeId: "J014",
    specialties: [
      JudgeSpecialty.WILDLIFE,
      JudgeSpecialty.ECOLOGICAL_RESTORATION,
    ],
  },
  {
    name: "何丽萍",
    judgeId: "J015",
    specialties: [JudgeSpecialty.WATER_RESOURCES, JudgeSpecialty.GENERAL],
  },
  {
    name: "罗向东",
    judgeId: "J016",
    specialties: [
      JudgeSpecialty.POLLUTION_CONTROL,
      JudgeSpecialty.WATER_RESOURCES,
    ],
  },
  {
    name: "梁春梅",
    judgeId: "J017",
    specialties: [
      JudgeSpecialty.ECOLOGICAL_RESTORATION,
      JudgeSpecialty.WILDLIFE,
    ],
  },
  {
    name: "宋志远",
    judgeId: "J018",
    specialties: [JudgeSpecialty.MINERAL_RESOURCES, JudgeSpecialty.GENERAL],
  },
  {
    name: "唐慧敏",
    judgeId: "J019",
    specialties: [JudgeSpecialty.WATER_RESOURCES, JudgeSpecialty.WILDLIFE],
  },
  {
    name: "韩冰",
    judgeId: "J020",
    specialties: [JudgeSpecialty.GENERAL, JudgeSpecialty.POLLUTION_CONTROL],
  },
  {
    name: "曹国华",
    judgeId: "J021",
    specialties: [
      JudgeSpecialty.ECOLOGICAL_RESTORATION,
      JudgeSpecialty.MINERAL_RESOURCES,
    ],
  },
  {
    name: "邓晓红",
    judgeId: "J022",
    specialties: [JudgeSpecialty.WILDLIFE, JudgeSpecialty.WATER_RESOURCES],
  },
  {
    name: "彭俊杰",
    judgeId: "J023",
    specialties: [JudgeSpecialty.POLLUTION_CONTROL, JudgeSpecialty.GENERAL],
  },
  {
    name: "曾雪峰",
    judgeId: "J024",
    specialties: [
      JudgeSpecialty.MINERAL_RESOURCES,
      JudgeSpecialty.ECOLOGICAL_RESTORATION,
    ],
  },
];

function generateCaseNumber(
  courtCode: string,
  year: number,
  index: number,
): string {
  return `豫${courtCode}环资初字第${year}${String(index).padStart(4, "0")}号`;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function clearDatabase() {
  console.log("🧹 清空现有数据...");
  await CaseModel.deleteMany({});
  await CaseFlowRecord.deleteMany({});
  await TransferTrail.deleteMany({});
  await Judge.deleteMany({});
  await CircuitCourt.deleteMany({});
  console.log("✅ 数据库已清空");
}

async function seedCourts(): Promise<mongoose.Types.ObjectId[]> {
  console.log("🏛️  创建巡回法庭数据...");
  const courts = await CircuitCourt.insertMany(courtsData);
  console.log(`✅ 已创建 ${courts.length} 个巡回法庭`);
  return courts.map((c) => c._id);
}

async function seedJudges(
  courtIds: mongoose.Types.ObjectId[],
): Promise<Map<string, mongoose.Types.ObjectId>> {
  console.log("👨‍⚖️  创建法官数据...");
  const judgeIdMap = new Map<string, mongoose.Types.ObjectId>();

  for (let i = 0; i < judgesData.length; i++) {
    const judge = judgesData[i];
    const courtIndex = i % courtIds.length;
    const createdJudge = await Judge.create({
      ...judge,
      circuitCourtId: courtIds[courtIndex],
      currentCaseCount: Math.floor(Math.random() * 5) + 2,
    });
    judgeIdMap.set(judge.judgeId, createdJudge._id);
  }

  console.log(`✅ 已创建 ${judgesData.length} 名法官`);
  return judgeIdMap;
}

async function seedCases(
  courtIds: mongoose.Types.ObjectId[],
  judgeIdMap: Map<string, mongoose.Types.ObjectId>,
) {
  console.log("📋 创建案件数据...");

  const caseTypes = Object.values(CaseType);
  const transferSources = Object.values(TransferSource);
  const stages = Object.values(CaseStage);
  const statuses = Object.values(CaseStatus);

  let caseIndex = 1;
  const years = [2023, 2024, 2025, 2026];

  const caseTemplates = [
    {
      type: CaseType.POLLUTION_ENVIRONMENT,
      title: "工业废水污染黄河支流案",
      desc: "某化工厂未经处理直接排放工业废水，造成黄河支流严重污染，影响沿岸居民饮水安全。",
    },
    {
      type: CaseType.ILLEGAL_MINING,
      title: "非法开采黄河滩区砂石资源案",
      desc: "犯罪分子在黄河滩区非法开采砂石资源，破坏河道生态环境，危及堤防安全。",
    },
    {
      type: CaseType.ILLEGAL_HUNTING,
      title: "非法狩猎黄河湿地候鸟案",
      desc: "当事人在黄河湿地国家级自然保护区内非法狩猎候鸟，涉嫌破坏野生动物资源。",
    },
    {
      type: CaseType.ECOLOGICAL_DAMAGE_COMPENSATION,
      title: "生态环境损害赔偿诉讼案",
      desc: "某企业违规排污造成严重生态环境污染，检察机关提起生态环境损害赔偿诉讼。",
    },
    {
      type: CaseType.ILLEGAL_LOGGING,
      title: "非法砍伐黄河防护林案",
      desc: "村民未经林业部门批准，擅自砍伐黄河护岸林木，破坏防护林体系。",
    },
    {
      type: CaseType.ILLEGAL_FISHING,
      title: "禁渔期非法捕捞水产品案",
      desc: "当事人在黄河禁渔期内使用禁用渔具非法捕捞水产品，破坏渔业资源。",
    },
    {
      type: CaseType.WILDLIFE_PROTECTION,
      title: "非法交易珍稀野生动物案",
      desc: "犯罪分子非法收购、运输、出售国家重点保护野生动物及其制品。",
    },
    {
      type: CaseType.WATER_RESOURCE_PROTECTION,
      title: "擅自取水破坏水资源案",
      desc: "企业未经批准擅自从黄河取水用于工业生产，违反水资源保护规定。",
    },
  ];

  const createdCases: any[] = [];

  for (const courtId of courtIds) {
    const courtIndex = courtIds.indexOf(courtId);
    const courtCode = courtsData[courtIndex].code;
    const courtName = courtsData[courtIndex].name;
    const coveredCounties = courtsData[courtIndex].coveredCounties;
    const coveredCities = courtsData[courtIndex].coveredCities;

    for (const stage of stages) {
      const casesPerStage = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < casesPerStage; i++) {
        const year = randomItem(years);
        const template = randomItem(caseTemplates);
        const complexity =
          Math.random() > 0.4 ? CaseComplexity.SIMPLE : CaseComplexity.COMPLEX;
        const isCrossRegional = Math.random() > 0.7;
        const county = randomItem(coveredCounties);
        const city =
          coveredCities.find((c) => county.includes(c)) ||
          randomItem(coveredCities);

        const judgeIds = Array.from(judgeIdMap.values()).filter(
          (_, idx) => idx % courtIds.length === courtIndex,
        );
        const assignedJudgeId = randomItem(judgeIds);

        const acceptedDate = randomDate(
          new Date(year, 0, 1),
          new Date(year, 11, 31),
        );

        const trialDaysLimit = getTotalTrialDaysLimit(complexity);
        const deadline = new Date(acceptedDate);
        deadline.setDate(deadline.getDate() + trialDaysLimit);

        const now = new Date();
        let status: CaseStatus;
        if (stage === CaseStage.ARCHIVED) {
          status = CaseStatus.COMPLETED;
        } else if (deadline < now) {
          status = CaseStatus.OVERDUE;
        } else if (
          deadline.getTime() - now.getTime() <
          7 * 24 * 60 * 60 * 1000
        ) {
          status = CaseStatus.URGENT;
        } else if (stage === CaseStage.ACCEPTED && !assignedJudgeId) {
          status = CaseStatus.PENDING;
        } else {
          status = CaseStatus.PROCESSING;
        }

        const trialStartDate =
          stage !== CaseStage.ACCEPTED
            ? randomDate(
                acceptedDate,
                new Date(acceptedDate.getTime() + 14 * 24 * 60 * 60 * 1000),
              )
            : undefined;

        const judgmentDate =
          stage === CaseStage.JUDGMENT || stage === CaseStage.ARCHIVED
            ? trialStartDate
              ? randomDate(
                  trialStartDate,
                  new Date(trialStartDate.getTime() + 30 * 24 * 60 * 60 * 1000),
                )
              : undefined
            : undefined;

        const archivedDate =
          stage === CaseStage.ARCHIVED
            ? judgmentDate
              ? randomDate(
                  judgmentDate,
                  new Date(judgmentDate.getTime() + 7 * 24 * 60 * 60 * 1000),
                )
              : undefined
            : undefined;

        const caseData: any = {
          caseNumber: generateCaseNumber(courtCode, year, caseIndex++),
          caseType: template.type,
          title: template.title,
          description: template.desc,
          occurrenceLocation: {
            province: "河南省",
            city,
            county,
            detail: `${county}某乡镇`,
          },
          occurrenceDate: randomDate(
            new Date(acceptedDate.getTime() - 90 * 24 * 60 * 60 * 1000),
            acceptedDate,
          ),
          transferSource: randomItem(transferSources),
          sourceCourt: isCrossRegional ? `${city}中级人民法院` : undefined,
          complexity,
          isCrossRegional,
          circuitCourtId: courtId,
          originalJurisdiction: `${city}${county}`,
          judgeId: assignedJudgeId,
          panelJudges:
            complexity === CaseComplexity.COMPLEX
              ? [assignedJudgeId, randomItem(judgeIds), randomItem(judgeIds)]
              : undefined,
          stage,
          status,
          acceptedDate,
          trialStartDate,
          judgmentDate,
          archivedDate,
          deadline,
          trialDaysLimit,
          isUrgent: status === CaseStatus.URGENT,
          isOverdue: status === CaseStatus.OVERDUE,
        };

        const createdCase = await CaseModel.create(caseData);
        createdCases.push(createdCase);

        await CaseFlowRecord.create({
          caseId: createdCase._id,
          stage: CaseStage.ACCEPTED,
          status: CaseStatus.PROCESSING,
          operatorName: "立案庭",
          remark: "案件登记立案，已完成繁简分流评估",
          operatedAt: acceptedDate,
        });

        if (stage !== CaseStage.ACCEPTED && trialStartDate) {
          await CaseFlowRecord.create({
            caseId: createdCase._id,
            stage: CaseStage.TRIAL,
            previousStage: CaseStage.ACCEPTED,
            status: CaseStatus.PROCESSING,
            previousStatus: CaseStatus.PROCESSING,
            operatorName: "承办法官",
            remark:
              complexity === CaseComplexity.SIMPLE
                ? "适用简易程序，独任审理"
                : "组成合议庭，公开开庭审理",
            operatedAt: trialStartDate,
          });
        }

        if (
          (stage === CaseStage.JUDGMENT || stage === CaseStage.ARCHIVED) &&
          judgmentDate
        ) {
          await CaseFlowRecord.create({
            caseId: createdCase._id,
            stage: CaseStage.JUDGMENT,
            previousStage: CaseStage.TRIAL,
            status: CaseStatus.PROCESSING,
            previousStatus: CaseStatus.PROCESSING,
            operatorName: "合议庭",
            remark: "案件审理终结，依法作出裁判",
            operatedAt: judgmentDate,
          });
        }

        if (stage === CaseStage.ARCHIVED && archivedDate) {
          await CaseFlowRecord.create({
            caseId: createdCase._id,
            stage: CaseStage.ARCHIVED,
            previousStage: CaseStage.JUDGMENT,
            status: CaseStatus.COMPLETED,
            previousStatus: CaseStatus.PROCESSING,
            operatorName: "书记员",
            remark: "案件已归档，案卷材料已入库存放",
            operatedAt: archivedDate,
          });
        }

        if (isCrossRegional && caseData.sourceCourt) {
          await TransferTrail.create({
            caseId: createdCase._id,
            fromCourt: caseData.sourceCourt,
            toCourt: courtName,
            toCourtId: courtId,
            transferSource: caseData.transferSource,
            transferReason: "跨行政区划环境资源案件集中管辖移送",
            transferDate: randomDate(
              new Date(acceptedDate.getTime() - 14 * 24 * 60 * 60 * 1000),
              acceptedDate,
            ),
            receivedDate: acceptedDate,
            transferDocuments: [
              "案件移送函",
              "立案审批表",
              "证据材料清单",
              "当事人身份证明",
            ],
            operatorName: "立案庭",
          });
        }
      }
    }
  }

  console.log(`✅ 已创建 ${createdCases.length} 个案件及相关流转记录`);
  return createdCases;
}

async function seed() {
  try {
    console.log("🚀 开始数据初始化...\n");

    await connectDB();
    await clearDatabase();

    const courtIds = await seedCourts();
    const judgeIdMap = await seedJudges(courtIds);
    await seedCases(courtIds, judgeIdMap);

    console.log("\n🎉 数据初始化完成！");
    console.log("\n📊 数据统计:");
    console.log(`  巡回法庭: ${courtsData.length} 个`);
    console.log(`  法官: ${judgesData.length} 名`);

    for (const court of courtsData) {
      const courtDoc = await CircuitCourt.findOne({ code: court.code });
      if (courtDoc) {
        const caseCount = await CaseModel.countDocuments({
          circuitCourtId: courtDoc._id,
        });
        const crossRegionalCount = await CaseModel.countDocuments({
          circuitCourtId: courtDoc._id,
          isCrossRegional: true,
        });
        console.log(
          `  ${court.name}: ${caseCount} 件（跨区划: ${crossRegionalCount} 件）`,
        );

        for (const stage of Object.values(CaseStage)) {
          const count = await CaseModel.countDocuments({
            circuitCourtId: courtDoc._id,
            stage,
          });
          if (count > 0) {
            console.log(`    - ${stage}: ${count} 件`);
          }
        }
      }
    }

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error("❌ 数据初始化失败:", error);
    await disconnectDB();
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}
