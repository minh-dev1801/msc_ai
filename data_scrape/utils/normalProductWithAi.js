import fs from "fs/promises";
import "dotenv/config";
import { OpenAI } from "openai";
import { Category, Product } from "../models/index.js";
import {
  NETWORK_CATEGORIES,
  NETWORK_COMPANIES,
} from "../constants/constants.js";
import { findMatches } from "../helpers/commonFunc.js";

const CONFIG = {
  BATCH_SIZE: 500,
  MAX_RETRIES: 1,
  RETRY_DELAY: 2000,
  CACHE_TTL: 24 * 60 * 60 * 1000,
  OPENAI_MODEL: "gpt-4o-mini",
  OPENAI_MAX_TOKENS: 100,
  OPENAI_TEMPERATURE: 0.1,
  RATE_LIMIT_DELAY: 500,
};

const initializeOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not found. OpenAI features will be disabled.");
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
  });
};

const openai = initializeOpenAI();

class TTLCache {
  constructor(ttl = CONFIG.CACHE_TTL) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

const categoryPredictionCache = new TTLCache();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isValidString = (str) => str && typeof str === "string" && str.trim();

const safeParseNumber = (value, defaultValue = 0) => {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

const logError = async (context, error, data = null) => {
  const logMessage = `[${context}] Error: ${error.message}\n${
    data ? `Data: ${JSON.stringify(data, null, 2)}\n` : ""
  }`;
  await fs.appendFile("error.log", logMessage);
  console.error(logMessage);
};

const ENHANCED_CATEGORY_RULES = [
  {
    patterns: [/phần mềm.*mạng|bản quyền.*mạng|quản lý.*mạng|license.*mạng/i],
    category: "Phần mềm và dịch vụ quản lý mạng",
  },
  {
    patterns: [/firewall|tường lửa/i],
    category: "Thiết bị bảo mật (Firewall)",
  },
  {
    patterns: [/switch|chuyển mạch/i],
    category: "Thiết bị chuyển mạch (Switch)",
  },
  {
    patterns: [/router|định tuyến/i],
    category: "Thiết bị định tuyến (Router)",
  },
  {
    patterns: [/wifi|access point|điểm truy cập|wireless|ap-ac|wlan/i],
    category: "Thiết bị Wifi",
  },
  {
    patterns: [
      /cáp mạng|network cable|cat6|cat5|patch cord|dây nhảy.*mạng|ethernet cable/i,
      /cáp quang|fiber optic|single mode|multi mode|fo\s*\d+/i,
    ],
    category: "Cáp và dây nhảy",
  },
  {
    patterns: [
      /network connector|đầu nối.*mạng|rj45|patch panel|keystone|jack.*mạng|phụ kiện.*mạng/i,
      /module quang|sfp\s*(\+)?|transceiver.*fiber/i,
    ],
    category: "Phụ kiện đấu nối mạng",
  },
  {
    patterns: [
      /server.*network|máy chủ.*mạng|storage.*network|lưu trữ.*mạng|nas|san/i,
      /ram.*server.*network|mainboard.*server.*network/i,
    ],
    category: "Thiết bị lưu trữ và máy chủ",
  },
  {
    patterns: [
      /media converter|quang.*điện|fiber.*ethernet|optical.*converter/i,
    ],
    category: "Thiết bị chuyển đổi quang-điện",
  },
  {
    patterns: [/rack|tủ mạng|ups|lưu điện|cabinet|enclosure/i],
    category: "Tủ mạng và bộ lưu điện",
  },
];

const checkEnhancedRules = (productName, categoryNames) => {
  if (!isValidString(productName)) return null;

  let match = null;
  let matchCount = 0;

  for (const rule of ENHANCED_CATEGORY_RULES) {
    if (categoryNames.includes(rule.category)) {
      for (const pattern of rule.patterns) {
        if (pattern.test(productName)) {
          matchCount++;
          if (matchCount > 1) return null;
          match = rule.category;
          break;
        }
      }
    }
  }

  return matchCount === 1 ? match : null;
};

const checkAndAddVendor = (
  text,
  vendors,
  customPatterns = NETWORK_COMPANIES
) => {
  if (!isValidString(text)) return;

  try {
    const matches = findMatches(text, customPatterns, {
      returnFirst: false,
      flexibleSpacing: true,
      wholeWord: false,
      useDeviceMapping: false,
    });

    matches.forEach((match) => {
      if (isValidString(match)) {
        vendors.add(match.trim());
      }
    });
  } catch (error) {
    logError("checkAndAddVendor", error, { text });
  }
};

const checkNameCategories = (
  text,
  nameCategories,
  customPatterns = NETWORK_CATEGORIES
) => {
  if (!isValidString(text)) return;

  try {
    const matches = findMatches(text, customPatterns, {
      returnFirst: false,
      flexibleSpacing: true,
      wholeWord: false,
      useDeviceMapping: true,
    });

    matches.forEach((match) => {
      if (isValidString(match)) {
        nameCategories.add(match.trim());
      }
    });
  } catch (error) {
    logError("checkNameCategories", error, { text });
  }
};

async function predictCategory(productName, categoryNames, retryCount = 0) {
  if (!openai) {
    console.warn("OpenAI not initialized. Skipping prediction.");
    return null;
  }

  if (
    !isValidString(productName) ||
    !Array.isArray(categoryNames) ||
    categoryNames.length === 0
  ) {
    return null;
  }

  const cacheKey = `${productName}_${categoryNames.join(",")}`;
  if (categoryPredictionCache.has(cacheKey)) {
    return categoryPredictionCache.get(cacheKey);
  }

  try {
    await sleep(CONFIG.RATE_LIMIT_DELAY);

    const prompt = `Bạn là chuyên gia phân loại sản phẩm công nghệ. Hãy phân loại sản phẩm sau vào đúng danh mục.

    DANH SÁCH DANH MỤC:
    ${categoryNames
      .map((catName, index) => `${index + 1}. ${catName}`)
      .join("\n")}

    SẢN PHẨM CẦN PHÂN LOẠI: "${productName}"

    QUY TắC PHÂN LOẠI:
    - Firewall, tường lửa, FortiGate → "Thiết bị bảo mật (Firewall)"
    - Switch, chuyển mạch → "Thiết bị chuyển mạch (Switch)" 
    - Router, định tuyến → "Thiết bị định tuyến (Router)"
    - WiFi, Access Point, AP → "Thiết bị Wifi"
    - Cáp mạng, cable, CAT6 → "Cáp và dây nhảy"
    - Server, máy chủ, RAM, CPU, SSD → "Thiết bị lưu trữ và máy chủ"
    - Phần mềm, bản quyền, license → "Phần mềm và dịch vụ quản lý mạng"

    Chỉ trả về TÊN CHÍNH XÁC của danh mục, không giải thích thêm.

    DANH MỤC:`;

    const response = await openai.chat.completions.create({
      model: CONFIG.OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: CONFIG.OPENAI_MAX_TOKENS,
      temperature: CONFIG.OPENAI_TEMPERATURE,
    });

    const result = response.choices[0]?.message?.content?.trim();

    if (!result) {
      throw new Error("Empty response from OpenAI");
    }

    const cleanResult =
      typeof result === "string" ? result.replace(/^\d+\.\s*/, "").trim() : "";

    const validResult =
      categoryNames.find(
        (catName) =>
          catName.toLowerCase() === cleanResult.toLowerCase() ||
          cleanResult.toLowerCase().includes(catName.toLowerCase()) ||
          catName.toLowerCase().includes(cleanResult.toLowerCase())
      ) || "Khác";

    categoryPredictionCache.set(cacheKey, validResult);

    return validResult;
  } catch (error) {
    logError("predictCategory", error, { productName, retryCount });

    if (error.status && [401, 403, 400].includes(error.status)) {
      return null;
    }

    if (retryCount < CONFIG.MAX_RETRIES) {
      const delay = CONFIG.RETRY_DELAY * Math.pow(2, retryCount);
      await sleep(delay);
      return predictCategory(productName, categoryNames, retryCount + 1);
    }

    return null;
  }
}

const processTableData = (
  table,
  vendors,
  goodsInfo,
  uniqueIds,
  nameCategories
) => {
  if (!Array.isArray(table)) {
    throw new Error("Table data must be an array");
  }

  const processedItems = [];

  for (const item of table) {
    try {
      if (!item || typeof item !== "object") continue;

      if (item.id && !uniqueIds.has(item.id)) {
        uniqueIds.add(item.id);
      }

      if (item.manufacturer) {
        checkAndAddVendor(item.manufacturer, vendors);
      }

      if (item.name) {
        // checkNameCategories(item.name, nameCategories);
      }

      const goodsItem = {
        name: isValidString(item.name) ? item.name.trim() : "N/A",
        quantity: safeParseNumber(item.qty),
        unitPrice: safeParseNumber(item.bidPrice),
        totalAmount: safeParseNumber(item.amount),
        manufacturer: isValidString(item.manufacturer)
          ? item.manufacturer.trim()
          : "N/A",
        feature: isValidString(item.feature) ? item.feature.trim() : "N/A",
        model: isValidString(item.model) ? item.model.trim() : "N/A",
      };

      processedItems.push(goodsItem);
      goodsInfo.push(goodsItem);
    } catch (error) {
      logError("processTableData", error, { item });
    }
  }

  return processedItems;
};

const processListTGData = (listTG, vendors, goodsInfo, nameCategories) => {
  if (!Array.isArray(listTG)) {
    throw new Error("ListTG data must be an array");
  }

  const processedItems = [];

  for (const good of listTG) {
    try {
      if (!good || typeof good !== "object") continue;

      if (good.serviceCategory) {
        checkAndAddVendor(good.serviceCategory, vendors);
        // checkNameCategories(good.serviceCategory, nameCategories);
      }

      const goodsItem = {
        name: isValidString(good.serviceCategory)
          ? good.serviceCategory.trim()
          : "N/A",
        quantity: safeParseNumber(good.originQty),
        unitPrice: safeParseNumber(good.bidPrice),
        totalAmount: safeParseNumber(good.intoMoney),
        description: isValidString(good.serviceDescription)
          ? good.serviceDescription.trim()
          : "N/A",
        place: isValidString(good.place) ? good.place.trim() : "N/A",
      };

      processedItems.push(goodsItem);
      goodsInfo.push(goodsItem);
    } catch (error) {
      logError("processListTGData", error, { good });
    }
  }

  return processedItems;
};

const processGoodsList = (
  goodsListStr,
  vendors,
  goodsInfo,
  uniqueIds,
  nameCategories
) => {
  if (!isValidString(goodsListStr)) {
    return { success: false, error: "Invalid goodsList string" };
  }

  try {
    const goodsList = JSON.parse(goodsListStr);
    let processedCount = 0;

    if (goodsList?.listTG && Array.isArray(goodsList.listTG)) {
      const items = processListTGData(
        goodsList.listTG,
        vendors,
        goodsInfo,
        nameCategories
      );
      processedCount += items.length;
    }

    if (
      Array.isArray(goodsList) &&
      goodsList[0]?.formValue?.lotContent?.Table
    ) {
      const items = processTableData(
        goodsList[0].formValue.lotContent.Table,
        vendors,
        goodsInfo,
        uniqueIds,
        nameCategories
      );
      processedCount += items.length;
    }

    return { success: true, processedCount };
  } catch (error) {
    logError("processGoodsList", error, {
      goodsListStr: goodsListStr.substring(0, 100) + "...",
    });
    return { success: false, error: error.message };
  }
};

const extractVendorsAndGoods = (bid, bidIndex = 0) => {
  const result = {
    goodsInfo: [],
    stats: { vendors: 0, categories: 0, goods: 0, errors: [] },
  };

  try {
    if (!bid || !bid?.details?.bideContractorInputResultDTO?.lotResultDTO) {
      result.stats.errors.push("Missing bid structure");
      return result;
    }

    const vendors = new Set();
    const nameCategories = new Set();
    const goodsInfo = [];
    const uniqueIds = new Set();
    const bidsInfo = [];

    const { lotResultDTO } = bid.details.bideContractorInputResultDTO;

    if (Array.isArray(lotResultDTO)) {
      for (const [lotIndex, lot] of lotResultDTO.entries()) {
        if (lot?.goodsList) {
          const processResult = processGoodsList(
            lot.goodsList,
            vendors,
            goodsInfo,
            uniqueIds,
            nameCategories
          );

          if (!processResult.success) {
            result.stats.errors.push(`Lot ${lotIndex}: ${processResult.error}`);
          }
        }
      }
    }

    if (vendors.size === 0 && bid.bidName) {
      const bidName = Array.isArray(bid.bidName) ? bid.bidName[0] : bid.bidName;
      checkAndAddVendor(bidName, vendors);
    }

    if ((vendors.size > 0 || nameCategories.size > 0) && goodsInfo.length > 0) {
      const vendorString =
        vendors.size > 0 ? Array.from(vendors).join(", ") : "N/A";
      const categoryString =
        nameCategories.size > 0 ? Array.from(nameCategories).join(", ") : "N/A";

      goodsInfo.forEach((item) => {
        if (!item.vendor || item.vendor === "N/A") {
          item.vendor = vendorString;
        }
        if (!item.category || item.category === "N/A") {
          item.category = categoryString;
        }
      });
    }

    result.bidsInfo = bidsInfo;
    result.goodsInfo = goodsInfo;
    result.stats.vendors = vendors.size;
    result.stats.categories = nameCategories.size;
    result.stats.goods = goodsInfo.length;
  } catch (error) {
    logError("extractVendorsAndGoods", error, { bidIndex });
    result.stats.errors.push(error.message);
  }

  console.log({ result });

  return result;
};

async function processBatch(
  batch,
  categoryMap,
  categoryNames,
  logFile = "predictions.log",
  enableOpenAI
) {
  const stats = { total: batch.length, valid: 0, invalid: 0, errors: [] };
  const validProducts = [];

  for (const [index, product] of batch.entries()) {
    try {
      let predictedCategory = checkEnhancedRules(product.name, categoryNames);

      if (!predictedCategory && openai && enableOpenAI) {
        console.log("Product with OpenAI", product.name);
        predictedCategory = await predictCategory(product.name, categoryNames);
      }

      if (!predictedCategory) {
        predictedCategory = "Khác";
      }

      console.log({ predictedCategory });

      const categoryId = predictedCategory
        ? categoryMap.get(predictedCategory)
        : null;

      if (categoryId) {
        validProducts.push({
          ...product,
          categoryId,
          predictedCategory: predictedCategory || "Unknown",
        });
        stats.valid++;

        console.log(`✓ ${product.name} → ${predictedCategory}`);
      } else {
        stats.invalid++;

        console.log(`✗ ${product.name} → No category found`);
      }
    } catch (error) {
      logError("processBatch", error, { productName: product.name, index });
      stats.errors.push(`Product ${index}: ${error.message}`);
      stats.invalid++;
    }
  }

  if (validProducts.length > 0) {
    try {
      // const query = `
      //   MERGE INTO Products AS target
      //   USING (VALUES ${validProducts
      //     .map(
      //       (_, i) =>
      //         `(:name_${i}, :categoryId_${i}, :predictedCategory_${i}, :quantity_${i}, :unitPrice_${i}, :totalAmount_${i}, :manufacturer_${i}, :feature_${i}, :model_${i})`
      //     )
      //     .join(", ")})
      //   AS source (name, categoryId, predictedCategory, quantity, unitPrice, totalAmount, manufacturer, feature, model)
      //   ON target.name = source.name AND target.categoryId = source.categoryId
      //   WHEN NOT MATCHED THEN
      //     INSERT (name, categoryId, predictedCategory, quantity, unitPrice, totalAmount, manufacturer, feature, model)
      //     VALUES (source.name, source.categoryId, source.predictedCategory, source.quantity, source.unitPrice, source.totalAmount, source.manufacturer, source.feature, source.model);
      // `;

      // await sequelize.query(query, {
      //   replacements: validProducts.reduce((acc, p) => {
      //     acc[`name_${p.name}`] = p.name;
      //     acc[`categoryId_${p.name}`] = p.categoryId;
      //     acc[`predictedCategory_${p.name}`] = p.predictedCategory;
      //     return acc;
      //   }, {}),
      //   type: sequelize.QueryTypes.INSERT,
      // });

      // const logContent =
      //   validProducts
      //     .map(
      //       (p) =>
      //         `${new Date().toISOString()} | ${p.name} → ${
      //           p.predictedCategory
      //         } (ID: ${p.categoryId})`
      //     )
      //     .join("\n") + "\n";

      // await Product.bulkCreate(validProducts);

      const logContent =
        validProducts
          .map(
            (p) =>
              `${new Date().toISOString()} | ${p.name} → ${
                p.predictedCategory
              } (ID: ${p.categoryId})`
          )
          .join("\n") + "\n";

      await fs.appendFile(logFile, logContent);
    } catch (error) {
      logError("processBatch - Database Insert", error);
      stats.errors.push(`Database insert failed: ${error.message}`);
    }
  }

  // console.log({ validProducts });

  return stats;
}

export const normalProductWithAi = async (rawData, options = {}) => {
  const config = {
    batchSize: options.batchSize || CONFIG.BATCH_SIZE,
    outputFile: options.outputFile || "./cleanedVendorsInfo.json",
    logFile: options.logFile || "predictions.log",
    enableDatabase: options.enableDatabase !== false,
    enableOpenAI: options.enableOpenAI !== false && !!openai,
    verbose: options.verbose !== false,
  };

  if (config.verbose) {
    console.log("🚀 Starting enhanced product processing...");
  }

  if (!Array.isArray(rawData)) {
    throw new Error("rawData must be an array");
  }

  let categoryMap = new Map();
  let categoryNames = [];

  if (config.enableDatabase) {
    try {
      const categoriesFromDb = await Category.findAll({
        attributes: ["name", "id"],
      });
      if (categoriesFromDb.length === 0) {
        throw new Error(
          "No categories found in database. Run initCategories.js first."
        );
      }
      categoryMap = new Map(categoriesFromDb.map((cat) => [cat.name, cat.id]));
      categoryNames = categoriesFromDb.map((cat) => cat.name);
    } catch (error) {
      logError("Loading categories from database", error);
      throw error;
    }
  }

  const processingResults = await Promise.allSettled(
    rawData.map(async (bid, index) => {
      try {
        return extractVendorsAndGoods(bid, index);
      } catch (error) {
        logError(`Processing bid ${index}`, error);
        return null;
      }
    })
  );

  // console.log("Oke processingResults", processingResults);

  const allGoodsInfo = [];
  const processingStats = {
    totalBids: rawData.length,
    successfulBids: 0,
    failedBids: 0,
    totalGoods: 0,
    errors: [],
  };

  processingResults.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      const { goodsInfo, stats } = result.value;
      allGoodsInfo.push(...goodsInfo);
      processingStats.successfulBids++;
      processingStats.totalGoods += stats.goods;
      if (stats.errors.length > 0) {
        processingStats.errors.push(`Bid ${index}: ${stats.errors.join(", ")}`);
      }
    } else {
      processingStats.failedBids++;
      processingStats.errors.push(
        `Bid ${index}: ${result.reason?.message || "Error in processing bid"}`
      );
    }
  });

  // console.log("Oke allGoodsInfo", allGoodsInfo);

  if (config.enableDatabase && allGoodsInfo.length > 0) {
    const totalProducts = allGoodsInfo.length;
    const overallStats = { total: 0, valid: 0, invalid: 0, errors: [] };

    // console.log("Oke totalProducts", totalProducts);

    for (let i = 0; i < totalProducts; i += config.batchSize) {
      const batch = allGoodsInfo.slice(i, i + config.batchSize);
      const batchNumber = Math.floor(i / config.batchSize) + 1;
      const totalBatches = Math.ceil(totalProducts / config.batchSize);

      // console.log("Oke batch", batch);

      try {
        const batchStats = await processBatch(
          batch,
          categoryMap,
          categoryNames,
          config.logFile,
          config.enableOpenAI
        );
        overallStats.total += batchStats.total;
        overallStats.valid += batchStats.valid;
        overallStats.invalid += batchStats.invalid;
        overallStats.errors.push(...batchStats.errors);

        if (config.verbose) {
          console.log(
            `📦 Batch ${batchNumber}/${totalBatches}: ${batchStats.valid}/${batchStats.total} valid`
          );
        }
      } catch (error) {
        logError(`Processing batch ${batchNumber}`, error);
        overallStats.errors.push(`Batch ${batchNumber}: ${error.message}`);
      }
    }

    if (config.verbose) {
      console.log("🎯 Final Database Processing Summary:", {
        totalProcessed: overallStats.total,
        validInserted: overallStats.valid,
        successRate: `${(
          (overallStats.valid / overallStats.total) *
          100
        ).toFixed(1)}%`,
      });
    }
  }

  try {
    if (allGoodsInfo.length > 0) {
      const outputData = {
        metadata: {
          processedAt: new Date().toISOString(),
          totalBids: processingStats.totalBids,
          successfulBids: processingStats.successfulBids,
          totalProducts: allGoodsInfo.length,
          model: CONFIG.OPENAI_MODEL,
          config,
        },
        products: allGoodsInfo,
      };

      await fs.writeFile(
        config.outputFile,
        JSON.stringify(outputData, null, 2)
      );
      if (config.verbose) {
        console.log(
          `💾 Saved ${allGoodsInfo.length} products to ${config.outputFile}`
        );
      }
    }
  } catch (error) {
    logError(`Writing to ${config.outputFile}`, error);
  }

  return {
    products: allGoodsInfo,
    stats: processingStats,
  };
};
