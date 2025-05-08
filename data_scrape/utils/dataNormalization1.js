import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const NETWORK_COMPANIES_1 = [
  "Palo Alto",
  "Fortinet",
  "Cisco",
  "Check Point",
  "Sophos",
  "McAfee",
  "Trend Micro",
  "CrowdStrike",
  "Barracuda",
  "SonicWall",
  "Bitdefender",
  "FireEye",
  "Qualys",
  "WatchGuard",
  "Zscaler",
  "A10",
  "Radware",
  "Proofpoint",
  "CyberArk",
  "Elastic Security",
  "Ivanti",
  "Forcepoint",
  "F5",
  "Tanium",
  "SentinelOne",
  "AlienVault",
  "Rapid7",
  "Imperva",
  "LogRhythm",
  "Darktrace",
  "Vormetric",
  "Paessler",
];

const CONFIG = {
  CATEGORIES_FILE: "categories.json",
  CATEGORIES_PATH: "../configs/categories.json",
  TARGET_VENDORS: NETWORK_COMPANIES_1,
};

const configCategories = (categories = null) => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.join(currentDir, CONFIG.CATEGORIES_PATH);
  return {
    configPath,
    flatCategoriesValue: categories ? Object.values(categories).flat() : null,
    flatCategoriesKey: categories ? Object.keys(categories) : null,
    flatCategoriesKeyLength: categories ? Object.keys(categories).length : null,
    flatCategoriesValueLength: categories
      ? Object.values(categories).flat().length
      : null,
  };
};

const loadCategories = () => {
  try {
    const configPath = configCategories().configPath;
    if (!fs.existsSync(configPath)) {
      console.warn(
        "File cấu hình categories.json không tồn tại, sử dụng cấu hình mặc định"
      );
    }
    const data = fs.readFileSync(configPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi khi đọc file cấu hình lĩnh vực:", error);
  }
};

const generateCategoryPrompt = (categories) => {
  const flatCategories = configCategories(categories).flatCategoriesValue;
  return `Dựa vào tiêu đề {title}, trả về CHÍNH XÁC một trong các lĩnh vực sau (chỉ trả về tên lĩnh vực, không thêm bất kỳ từ nào khác): ${flatCategories.join(
    ", "
  )}`;
};

const NETWORK_COMPANIES = CONFIG.TARGET_VENDORS;

// Hàm kiểm tra tính liên quan của bid với các công ty mạng
const checkNetworkCompanyRelevance = (details) => {
  if (!details || !details.bideContractorInputResultDTO) {
    return false;
  }

  const { bidName, lotResultDTO } = details.bideContractorInputResultDTO;

  if (
    bidName &&
    NETWORK_COMPANIES.some((company) =>
      bidName.toLowerCase().includes(company.toLowerCase())
    )
  ) {
    return true;
  }

  if (lotResultDTO && Array.isArray(lotResultDTO)) {
    for (const lot of lotResultDTO) {
      // Kiểm tra lotName
      if (
        lot.lotName &&
        NETWORK_COMPANIES.some((company) =>
          lot.lotName.toLowerCase().includes(company.toLowerCase())
        )
      ) {
        return true;
      }

      // Kiểm tra goodsList
      if (lot.goodsList) {
        try {
          const goodsList = JSON.parse(lot.goodsList);
          for (const good of goodsList) {
            const fieldsToCheck = [
              good.name,
              good.origin,
              good.manufacturer,
              good.feature,
            ];
            for (const field of fieldsToCheck) {
              if (
                field &&
                NETWORK_COMPANIES.some((company) =>
                  field.toLowerCase().includes(company.toLowerCase())
                )
              ) {
                return true;
              }
            }
          }
        } catch (error) {
          console.error("Lỗi khi parse goodsList:", error);
        }
      }
    }
  }

  return false;
};

// Hàm trích xuất danh sách nhà cung cấp từ bid (bao gồm cả tên bid và details)
const extractVendors = (bid) => {
  try {
    if (!bid.details) return;

    // Object để lưu tên công ty và số lượng
    const vendors = {};

    // Hàm tăng số lượng cho công ty trong vendors
    const incrementVendorCount = (company) => {
      vendors[company] = (vendors[company] || 0) + 1;
    };

    // Biến để đếm số lượng good.id
    let idCount = 0;
    // Set để theo dõi các good.id duy nhất
    const uniqueIds = new Set();

    // Xử lý goodsList trước
    const { lotResultDTO } = bid.details.bideContractorInputResultDTO;

    if (lotResultDTO && Array.isArray(lotResultDTO)) {
      lotResultDTO.forEach((lot) => {
        // Kiểm tra goodsList
        if (lot.goodsList) {
          // Kiểm tra nếu goodsList là chuỗi JSON
          if (typeof lot.goodsList === "string") {
            const goodsList = JSON.parse(lot.goodsList).listTG;

            // Kiểm tra nếu goodsList sau khi parse là một mảng
            if (Array.isArray(goodsList)) {
              goodsList.forEach((good) => {
                const fieldsToCheck = [good.serviceCategory, good.id];

                fieldsToCheck.forEach((field) => {
                  if (field) {
                    // Đếm good.id
                    if (field === good.id) {
                      idCount++;
                    }
                    NETWORK_COMPANIES_1.forEach((company) => {
                      const regexPattern = company.includes(" ")
                        ? new RegExp(company.replace(/\s+/g, "\\s*"), "i")
                        : new RegExp(company, "i");

                      if (regexPattern.test(field)) {
                        incrementVendorCount(company);
                      }
                    });
                  }
                });
              });
            }
          }
        }
      });
    }

    if (
      Object.keys(vendors).length === 0 &&
      lotResultDTO &&
      Array.isArray(lotResultDTO)
    ) {
      lotResultDTO.forEach((lot) => {
        // Kiểm tra goodsList
        if (lot.goodsList) {
          // Kiểm tra nếu goodsList là chuỗi JSON
          if (typeof lot.goodsList === "string") {
            try {
              const goodsList = JSON.parse(lot.goodsList);
              // Kiểm tra goodsList là mảng và không rỗng
              if (!Array.isArray(goodsList) || !goodsList.length) return;
              // Kiểm tra cấu trúc của goodsList[0]
              if (
                !goodsList[0].formValue ||
                !goodsList[0].formValue.lotContent ||
                !Array.isArray(goodsList[0].formValue.lotContent.Table)
              )
                return;

              goodsList[0].formValue.lotContent.Table.forEach((table) => {
                if (table && table.id) {
                  // Chỉ đếm nếu id chưa tồn tại trong uniqueIds
                  if (!uniqueIds.has(table.id)) {
                    uniqueIds.add(table.id);
                    idCount++;
                  }

                  NETWORK_COMPANIES_1.forEach((company) => {
                    const regexPattern = company.includes(" ")
                      ? new RegExp(company.replace(/\s+/g, "\\s*"), "i")
                      : new RegExp(company, "i");

                    if (
                      table.manufacturer &&
                      regexPattern.test(table.manufacturer)
                    ) {
                      incrementVendorCount(company);
                    }
                  });
                }
              });
            } catch (e) {
              console.error("JSON parsing error: ", e);
            }
          }
        }
      });
    }

    // Nếu goodsList không có vendor, mới kiểm tra bidName
    if (Object.keys(vendors).length === 0 && bid.bidName) {
      const bidName = Array.isArray(bid.bidName) ? bid.bidName[0] : bid.bidName;
      NETWORK_COMPANIES_1.forEach((company) => {
        const regexPattern = company.includes(" ")
          ? new RegExp(company.replace(/\s+/g, "\\s*"), "i")
          : new RegExp(company, "i");

        // Chỉ thêm công ty nếu chưa tồn tại trong vendors từ bidName
        if (regexPattern.test(bidName) && !(company in vendors)) {
          incrementVendorCount(company);
        }
      });
    }
    // Trả về object vendors chứa tên công ty và số lượng
    return vendors;
  } catch (error) {
    console.error("Lỗi khi get vendor:", error);
  }
};

export const cleanAndNormalizeBidData = async (rawData) => {
  const FIELD_CATEGORIES = loadCategories();
  const {
    flatCategoriesKeyLength: groupLength,
    flatCategoriesValueLength: fieldLength,
  } = configCategories(FIELD_CATEGORIES);
  const categoryPrompt = generateCategoryPrompt(FIELD_CATEGORIES);

  console.log(
    `Đã tải ${groupLength} nhóm lĩnh vực với tổng cộng ${fieldLength} lĩnh vực`
  );

  const chain = RunnableSequence.from([
    ChatPromptTemplate.fromTemplate(categoryPrompt),
    new ChatOpenAI({
      modelName: "gpt-4o-mini",
      maxTokens: 10,
      temperature: 0,
      stop: ["\n"],
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
  ]);

  try {
    await chain.invoke({ title: "Test API Key" });
  } catch (error) {
    switch (error?.code || error?.response?.status) {
      case "invalid_api_key":
      case 401:
        throw new Error(
          "🔑 OpenAI API Key không hợp lệ. Kiểm tra key tại: https://platform.openai.com/api-keys"
        );
      case "insufficient_quota":
      case 429:
        throw new Error(
          "⚠️ Hết hạn ngạch (quota). Kiểm tra tại: https://platform.openai.com/usage"
        );
      case 402:
        throw new Error(
          "💳 Hết credit. Nạp tiền tại: https://platform.openai.com/billing"
        );
      default:
        console.error("Lỗi từ OpenAI API:", error.message);
        throw new Error(`🚨 Lỗi khi gọi OpenAI: ${error.message}`);
    }
  }

  const closeDateThreshold = new Date();

  const cleanedData = await Promise.all(
    rawData.map(async (bid) => {
      try {
        const result = await chain.invoke({
          title: bid.bidName[0] || "",
        });

        const fieldCategory = result.content.trim();

        let fieldGroup = "OTHER";
        for (const [group, fields] of Object.entries(FIELD_CATEGORIES)) {
          if (fields.includes(fieldCategory)) {
            fieldGroup = group;
            break;
          }
        }

        const bidCloseDate = new Date(bid.bidCloseDate);

        const year = isNaN(bidCloseDate.getTime())
          ? null
          : bidCloseDate.getFullYear();

        const isClosed =
          year === null ? false : bidCloseDate <= closeDateThreshold;

        const hasWinner = isClosed && bid.statusForNotify === "CNTTT";

        let vendors = extractVendors(bid) || {};

        return {
          bidName: Array.isArray(bid.bidName) ? bid.bidName[0] : bid.bidName,
          bidCloseDate: bid.bidCloseDate,
          year,
          isClosed,
          hasWinner,
          investorName: bid.investorName?.trim().replace(/\s+/g, " ") || null,
          bidPrice: Number(
            Array.isArray(bid.bidPrice) ? bid.bidPrice[0] : bid.bidPrice
          ),
          fieldCategory,
          fieldGroup,
          vendors,
        };
      } catch (error) {
        console.error(`Lỗi xử lý bid ${bid.id}:`, error);
        return null;
      }
    })
  );

  const validData = cleanedData.filter((result) => result !== null);

  if (validData.length > 0) {
    try {
      await fs.promises.writeFile(
        "./cleanedData.json",
        JSON.stringify(validData, null, 2)
      );
      console.log(
        `Xử lý thành công: ${validData.length}/${rawData.length} bản ghi`
      );
    } catch (error) {
      console.error("Lỗi khi ghi file:", error);
    }
  } else {
    console.log("Không có dữ liệu để lưu");
  }

  return validData;
};
