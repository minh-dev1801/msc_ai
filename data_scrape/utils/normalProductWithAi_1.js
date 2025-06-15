import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { Bid, Category, Product, ProductBid } from "../models/index.js";
import {
  NETWORK_CATEGORIES as PRODUCT_NORMALIZATION_CATEGORIES,
  NETWORK_COMPANIES as PRODUCT_NORMALIZATION_VENDORS,
} from "../constants/constants.js";
import { findMatches } from "../helpers/commonFunc.js";

// ========================= CONFIGURATION =========================
const CONFIG = {
  VENDORS: [
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
  ],

  PATHS: {
    CATEGORIES_FILE: "categories.json",
    CATEGORIES_PATH: "../configs/categories.json",
    ERROR_LOG: "error.log",
    OUTPUT_FILE: "./processedData.json",
  },

  OPENAI: {
    MODEL: "gpt-4o-mini",
    MAX_TOKENS: 100,
    TEMPERATURE: 0.1,
    RATE_LIMIT_DELAY: 500,
  },

  PROCESSING: {
    BATCH_SIZE: 500,
    MAX_RETRIES: 1,
    RETRY_DELAY: 2000,
    CACHE_TTL: 24 * 60 * 60 * 1000,
  },
};

const CATEGORY_RULES = [
  {
    patterns: [
      /phần mềm.*mạng|bản quyền.*mạng|quản lý.*mạng|license.*mạng/i,
      /dịch vụ.*hỗ trợ.*kỹ thuật|premium support|technical support|support renewal|gia hạn.*hỗ trợ/i,
    ],
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

// ========================= UTILITY CLASSES =========================
class Logger {
  static async logError(context, error, data = null) {
    let errorMessage;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (error === null || error === undefined) {
      errorMessage = "Unknown error occurred";
    } else {
      errorMessage = JSON.stringify(error);
    }

    const logMessage = `[${new Date().toISOString()}][${context}] Error: ${errorMessage}\n${
      data ? `Data: ${JSON.stringify(data, null, 2)}\n` : ""
    }`;

    try {
      await fs.promises.appendFile(CONFIG.PATHS.ERROR_LOG, logMessage);
    } catch (appendError) {
      console.error("Failed to write to error.log:", appendError);
    }
    console.error(logMessage);
  }

  static async logInfo(context, message, data = null) {
    const logMessage = `[${new Date().toISOString()}][${context}] Info: ${message}\n${
      data ? `Data: ${JSON.stringify(data, null, 2)}\n` : ""
    }`;
    console.log(logMessage);
  }
}

class Utils {
  static sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  static isValidString = (str) => str && typeof str === "string" && str.trim();

  static safeParseNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  };

  static normalizeString = (str) => str?.trim().replace(/\s+/g, " ") || null;

  static createRegexPattern = (company) => {
    return company.includes(" ")
      ? new RegExp(company.replace(/\s+/g, "\\s*"), "i")
      : new RegExp(company, "i");
  };

  // static createRegexPattern = (company) => {
  //   const escapedCompany = company.replace(/[-_]/g, "[-_]?");
  //   const pattern = escapedCompany.includes(" ")
  //     ? escapedCompany.replace(/\s+/g, "\\s*")
  //     : escapedCompany;
  //   return new RegExp(`\\b${pattern}\\b`, "i");
  // };
}

class Cache {
  constructor(ttl = CONFIG.PROCESSING.CACHE_TTL) {
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
}

// ========================= CORE SERVICES =========================
class ConfigService {
  static loadCategories() {
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const configPath = path.join(currentDir, CONFIG.PATHS.CATEGORIES_PATH);

      if (!fs.existsSync(configPath)) {
        console.warn(
          `File cấu hình ${CONFIG.PATHS.CATEGORIES_FILE} không tồn tại.`
        );
        return null;
      }

      const data = fs.readFileSync(configPath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Lỗi khi đọc file cấu hình lĩnh vực:", error);
      return null;
    }
  }

  static generateCategoryPrompt(categories) {
    if (!categories) {
      Logger.logError(
        "generateCategoryPrompt",
        new Error("Danh mục không tồn tại hoặc không được tải.")
      );
      throw new Error("Danh mục không tồn tại để tạo prompt phân loại.");
    }

    const flatCategories = Object.values(categories).flat();
    if (flatCategories.length === 0) {
      Logger.logError(
        "generateCategoryPrompt",
        new Error("Danh sách danh mục rỗng sau khi làm phẳng.")
      );
      throw new Error("Không có danh mục hợp lệ để tạo prompt phân loại.");
    }

    return `Dựa vào tiêu đề {title}, trả về CHÍNH XÁC một trong các lĩnh vực sau (chỉ trả về tên lĩnh vực): ${flatCategories.join(
      ", "
    )}`;
  }
}

class OpenAIService {
  constructor() {
    this.cache = new Cache();
    this.client = this._initializeClient();
    this._initializeLangChain();
  }

  _initializeClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      Logger.logError(
        "initializeClient",
        new Error("OPENAI_API_KEY không được tìm thấy.")
      );
      return null;
    }
    try {
      const client = new OpenAI({
        apiKey,
        timeout: CONFIG.OPENAI.TIMEOUT,
      });
      Logger.logInfo("initializeClient", "Client OpenAI khởi tạo thành công.");
      return client;
    } catch (error) {
      Logger.logError("initializeClient", error, {
        message: "API key OpenAI không hợp lệ hoặc hết hạn.",
      });
      return null;
    }
  }

  _initializeLangChain() {
    this.chatModel = new ChatOpenAI({
      modelName: CONFIG.OPENAI.MODEL,
      maxTokens: CONFIG.OPENAI.MAX_TOKENS,
      temperature: CONFIG.OPENAI.TEMPERATURE,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    this.promptTemplate = ChatPromptTemplate.fromTemplate(`
      Bạn là chuyên gia phân loại sản phẩm công nghệ. 
      Hãy phân loại sản phẩm sau vào đúng danh mục.

      DANH SÁCH DANH MỤC:
      {categoryList}

      SẢN PHẨM CẦN PHÂN LOẠI: "{productName}"

      Chỉ trả về TÊN CHÍNH XÁC của danh mục, không giải thích thêm.
    `);

    this.chain = RunnableSequence.from([this.promptTemplate, this.chatModel]);
  }

  async predictCategory(productName, categoryNames, retryCount = 0) {
    if (
      !Utils.isValidString(productName) ||
      !Array.isArray(categoryNames) ||
      categoryNames.length === 0
    ) {
      return null;
    }

    const cacheKey = `${productName}_${categoryNames.join(",")}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      await Utils.sleep(CONFIG.OPENAI.RATE_LIMIT_DELAY);

      const categoryList = categoryNames
        .map((catName, index) => `${index + 1}. ${catName}`)
        .join("\n");

      const response = await this.chain.invoke({
        productName,
        categoryList,
      });

      const result =
        response.content?.trim().replace(/^\d+\.\s*/, "") || "Khác";

      const validResult =
        categoryNames.find(
          (catName) => catName.toLowerCase() === result.toLowerCase()
        ) || "Khác";

      this.cache.set(cacheKey, validResult);
      return validResult;
    } catch (error) {
      Logger.logError("predictCategory", error, { productName, retryCount });

      if (retryCount < CONFIG.PROCESSING.MAX_RETRIES) {
        await Utils.sleep(
          CONFIG.PROCESSING.RETRY_DELAY * Math.pow(2, retryCount)
        );
        return this.predictCategory(productName, categoryNames, retryCount + 1);
      }

      return null;
    }
  }
}

class VendorExtractor {
  static contractorNames = [];

  static extractFromText(text, vendors = new Set()) {
    if (!Utils.isValidString(text)) return;

    CONFIG.VENDORS.forEach((company) => {
      const regexPattern = Utils.createRegexPattern(company);
      if (regexPattern.test(String(text))) {
        vendors.add(company);
      }
    });
  }

  static extractFromTextAdvanced(text, vendors = new Set()) {
    if (!Utils.isValidString(text)) return;

    try {
      const matches = findMatches(text, PRODUCT_NORMALIZATION_VENDORS, {
        returnFirst: false,
        flexibleSpacing: true,
        wholeWord: false,
        useDeviceMapping: false,
      });

      matches.forEach((match) => {
        if (Utils.isValidString(match)) {
          vendors.add(match.trim());
        }
      });
    } catch (error) {
      Logger.logError("extractFromTextAdvanced", error, { text });
    }
  }

  static extractFromBid(bid) {
    const vendors = new Set();
    const goodsInfo = [];

    try {
      const lotResultDTO =
        bid?.details?.bideContractorInputResultDTO?.lotResultDTO;
      const contractorName = bid?.contractorName;

      if (
        contractorName &&
        Array.isArray(contractorName) &&
        contractorName.length > 0
      ) {
        this.contractorNames.push(contractorName[0]);
      }

      if (!Array.isArray(lotResultDTO)) {
        return { vendors, goodsInfo };
      }

      lotResultDTO.forEach((lot) => {
        if (lot?.goodsList) {
          this._processGoodsList(lot.goodsList, vendors, goodsInfo);
        }
      });

      if (vendors.size === 0 && bid.bidName) {
        const bidNameStr = Array.isArray(bid.bidName)
          ? bid.bidName[0]
          : bid.bidName;
        this.extractFromTextAdvanced(bidNameStr, vendors);
      }

      const vendorString =
        vendors.size > 0 ? Array.from(vendors).join(", ") : "N/A";
      goodsInfo.forEach((item) => {
        if (!item.manufacturer || item.manufacturer === "N/A") {
          item.manufacturer = vendorString;
        }
      });

      return { vendors, goodsInfo, contractorNames: this.contractorNames };
    } catch (error) {
      Logger.logError("extractFromBid", error);
      return { vendors, goodsInfo, contractorNames: this.contractorNames };
    }
  }

  static _processGoodsList(goodsListStr, vendors, goodsInfo) {
    if (!Utils.isValidString(goodsListStr)) return;

    try {
      const goodsList = JSON.parse(goodsListStr);

      if (goodsList?.listTG && Array.isArray(goodsList.listTG)) {
        this._processListTG(goodsList.listTG, vendors, goodsInfo);
      } else if (
        Array.isArray(goodsList) &&
        goodsList[0]?.formValue?.lotContent?.Table
      ) {
        this._processTable(
          goodsList[0].formValue.lotContent.Table,
          vendors,
          goodsInfo
        );
      }
    } catch (error) {
      Logger.logError("_processGoodsList", error, {
        goodsListStr: goodsListStr.substring(0, 100) + "...",
      });
    }
  }

  static _processListTG(listTG, vendors, goodsInfo) {
    if (!Array.isArray(listTG) || listTG.length === 0) return;

    //Logger.logInfo("_processListTG", "listTG", listTG);

    try {
      listTG.forEach((good) => {
        if (good?.serviceCategory) {
          this.extractFromTextAdvanced(good.serviceCategory, vendors);
        }

        goodsInfo.push({
          name: Utils.isValidString(good.serviceCategory)
            ? good.serviceCategory.trim()
            : "N/A",
          quantity: Utils.safeParseNumber(good.originQty),
          unitPrice: Utils.safeParseNumber(good.bidPrice),
          totalAmount: Utils.safeParseNumber(good.intoMoney),
          vendor: Utils.isValidString(good.manufacturer)
            ? good.manufacturer.trim()
            : "N/A",
        });
      });
    } catch (error) {
      Logger.logError("_processListTG", error, {
        listTG: listTG.slice(0, 100) + "...",
      });
    }
  }

  static _processTable(table, vendors, goodsInfo) {
    if (!Array.isArray(table) || table.length === 0) return;

    // Logger.logInfo("_processTable", "table", table);

    try {
      table.forEach((item) => {
        if (item?.manufacturer) {
          this.extractFromTextAdvanced(item.manufacturer, vendors);
        }

        goodsInfo.push({
          name: Utils.isValidString(item.name) ? item.name.trim() : "N/A",
          quantity: Utils.safeParseNumber(item.qty),
          unitPrice: Utils.safeParseNumber(item.bidPrice),
          totalAmount: Utils.safeParseNumber(item.amount),
          vendor: Utils.isValidString(item.manufacturer)
            ? item.manufacturer.trim()
            : "N/A",
        });
      });
    } catch (error) {
      Logger.logError("_processTable", error, {
        table: table.slice(0, 100) + "...",
      });
    }
  }
}

class CategoryPredictor {
  static predictByRules(productName, categoryNames) {
    console.log("productName", productName);

    let matches = [];

    console.log("categoryNames", categoryNames);

    for (const rule of CATEGORY_RULES) {
      if (categoryNames.includes(rule.category)) {
        for (const pattern of rule.patterns) {
          if (pattern.test(productName)) {
            matches.push(rule.category);
            break;
          }
        }
      }
    }

    console.log("matches", matches);

    if (matches.includes("Phần mềm và dịch vụ quản lý mạng")) {
      return "Phần mềm và dịch vụ quản lý mạng";
    }

    return matches.length === 1 ? matches[0] : null;
  }
}

class CategoryService {
  async getCategories() {
    try {
      const categoriesFromDb = await Category.findAll({
        attributes: ["name", "id"],
      });

      if (categoriesFromDb.length === 0) {
        throw new Error("No categories found in database.");
      }

      return {
        categoryMap: new Map(
          categoriesFromDb.map((category) => [category.name, category.id])
        ),
        categoryNames: categoriesFromDb.map((category) => category.name),
      };
    } catch (error) {
      Logger.logError("getCategories", error, {
        message: "Lỗi truy vấn bảng Category",
      });
      throw error;
    }
  }

  async saveProducts(bidId, products) {
    try {
      const productRecords = products.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        totalAmount: product.totalAmount,
        vendor: product.vendor,
        categoryId: product.categoryId,
      }));

      await Product.bulkCreate(productRecords);
      Logger.logInfo(
        "saveProducts",
        `Lưu thành công ${productRecords.length} sản phẩm cho bid ${bidId}`
      );
    } catch (error) {
      Logger.logError("saveProducts", error, {
        bidId,
        products,
        errorDetails: error.stack || error.toString(),
      });
      throw error;
    }
  }
}

class ProductService {
  async getProducts() {
    try {
      const productsFromDb = await Product.findAll({
        attributes: ["id", "name"],
      });

      if (productsFromDb.length === 0) {
        throw new Error("No products found in database.");
      }

      return {
        productMap: new Map(
          productsFromDb.map((product) => [product.name, product.id])
        ),
        productIds: productsFromDb.map((product) => product.id),
      };
    } catch (error) {
      Logger.logError("getProducts", error, {
        message: "Lỗi truy vấn bảng Product",
      });
      throw error;
    }
  }
}

class BidService {
  async getBids() {
    try {
      const bidsFromDb = await Bid.findAll({
        attributes: ["id", "bidName"],
      });

      if (bidsFromDb.length === 0) {
        throw new Error("No bids found in database.");
      }

      return {
        bidMap: new Map(bidsFromDb.map((bid) => [bid.bidName, bid.id])),
        bidIds: bidsFromDb.map((bid) => bid.id),
      };
    } catch (error) {
      Logger.logError("getBids", error, {
        message: "Lỗi truy vấn bảng Bid",
      });
      throw error;
    }
  }

  async saveBid(bidId, bid) {
    try {
      const bidRecord = bid;

      await Bid.create(bidRecord);
      Logger.logInfo("saveBid", `Lưu thành công bản ghi cho bid ${bidId}`);
    } catch (error) {
      Logger.logError("saveBid", error, {
        bid,
        errorDetails: error.stack || error.toString(),
      });
      throw error;
    }
  }

  async saveProductBids(bidId, productBids) {
    try {
      await ProductBid.bulkCreate(productBids, { validate: true });
      Logger.logInfo(
        "saveProductBids",
        `Lưu thành công ${productBids.length} sản phẩm cho bid ${bidId}`
      );
    } catch (error) {
      Logger.logError("saveProductBids", error, { productBids });
    }
  }
}

// ========================= MAIN PROCESSOR =========================
class BidProcessor {
  constructor() {
    this.openaiService = new OpenAIService();
    this.categoryService = new CategoryService();
    this.bidService = new BidService();
    this.productService = new ProductService();
    this.fieldCategories = ConfigService.loadCategories();
    this.categoryMap = new Map();
    this.categoryNames = [];
    this.bidMap = new Map();
    this.bidIds = [];
    this.productMap = new Map();
    this.productIds = [];
  }

  async initialize() {
    if (!this.fieldCategories) {
      throw new Error("Không thể tải FIELD_CATEGORIES.");
    }

    try {
      const { categoryMap, categoryNames } =
        await this.categoryService.getCategories();
      this.categoryMap = categoryMap;
      this.categoryNames = categoryNames;

      const categoryPrompt = ConfigService.generateCategoryPrompt(
        this.fieldCategories
      );
      this.chain = RunnableSequence.from([
        ChatPromptTemplate.fromTemplate(categoryPrompt),
        new ChatOpenAI({
          modelName: CONFIG.OPENAI.MODEL,
          maxTokens: 10,
          temperature: 0,
          stop: ["\n"],
          openAIApiKey: process.env.OPENAI_API_KEY,
        }),
      ]);
    } catch (error) {
      Logger.logError("initialize", error, {
        message: "Lỗi truy vấn bảng Category",
      });
      throw error;
    }
  }

  async processBatch(rawData, options = {}) {
    if (rawData.length === 0) {
      Logger.logError("processBatch", "No data to process", {
        rawData,
      });
      return [];
    }
    const closeDateThreshold = new Date();

    const processedData = await Promise.all(
      rawData.map(async (bid) => {
        try {
          return await this._processSingleBid(bid, closeDateThreshold, options);
        } catch (error) {
          Logger.logError("processSingleBid", error, { bidId: bid.id });
          return null;
        }
      })
    );

    const validData = processedData.filter((data) => data !== null);

    try {
      await fs.promises.writeFile(
        CONFIG.PATHS.OUTPUT_FILE,
        JSON.stringify(validData, null, 2)
      );
      console.log(
        `Xử lý thành công: ${validData.length}/${rawData.length} bản ghi`
      );
    } catch (error) {
      console.error("Lỗi khi ghi file processedData.json:", error);
    }

    return validData;
  }

  async _processSingleBid(bid, closeDateThreshold, options) {
    if (!bid) {
      Logger.logError("processSingleBid", "No bid data", {
        bid,
      });
      return null;
    }
    let fieldCategory = "Khác";
    if (options.enableOpenAI) {
      const result = await this.chain.invoke({
        title: bid.bidName?.[0] || "",
      });
      fieldCategory = result.content.toString().trim();
    }

    let fieldGroup = "OTHER";
    for (const [group, fields] of Object.entries(this.fieldCategories)) {
      if (fields.includes(fieldCategory)) {
        fieldGroup = group;
        break;
      }
    }

    const bidCloseDate = new Date(bid.bidCloseDate);
    const year = isNaN(bidCloseDate.getTime())
      ? null
      : bidCloseDate.getFullYear();
    const isClosed = year === null ? false : bidCloseDate <= closeDateThreshold;
    const hasWinner = isClosed && bid.statusForNotify === "CNTTT";
    const bidName = Array.isArray(bid.bidName) ? bid.bidName[0] : bid.bidName;
    const investorName = Utils.normalizeString(bid.investorName);
    const bidPrice = Number(
      Array.isArray(bid.bidPrice) ? bid.bidPrice[0] : bid.bidPrice
    );

    const { vendors, goodsInfo, contractorNames } =
      VendorExtractor.extractFromBid(bid);

    const products = await Promise.all(
      goodsInfo.map(async (product) => {
        // let predictedCategory = CategoryPredictor.predictByRules(
        //   product.name,
        //   this.categoryNames
        // );

        let predictedCategory = null;

        if (
          !predictedCategory &&
          this.openaiService.client &&
          options.enableOpenAI !== false
        ) {
          predictedCategory = await this.openaiService.predictCategory(
            product.name,
            this.categoryNames
          );
        }
        const categoryName = predictedCategory ? predictedCategory : "Khác";

        return {
          ...product,
          // category: predictedCategory,
          categoryId: this.categoryMap.get(categoryName),
        };
      })
    );

    // Logger.logInfo("processSingleBid", "products", products);

    if (products.length === 0) {
      Logger.logError("processSingleBid", "No products found", {
        bidName: bid.bidName,
        products,
      });
      return null;
    }

    await this.categoryService.saveProducts(bid.id, products);
    await this.bidService.saveBid(bid.id, {
      bidName: Array.isArray(bid.bidName) ? bid.bidName[0] : bid.bidName,
      bidCloseDate: bid.bidCloseDate,
      year,
      isClosed,
      hasWinner,
      investorName: Utils.normalizeString(bid.investorName),
      bidPrice: Number(
        Array.isArray(bid.bidPrice) ? bid.bidPrice[0] : bid.bidPrice
      ),
      fieldCategory,
      fieldGroup,
      // vendors: Object.fromEntries(Array.from(vendors).map((v) => [v, 1])),
      // vendors: "Khác",
      // vendors: Object.fromEntries(Array.from(vendors).map((v) => [v, 1])),
    });

    const { bidMap, bidIds } = await this.bidService.getBids();
    this.bidMap = bidMap;
    this.bidIds = bidIds;

    const { productMap, productIds } = await this.productService.getProducts();
    this.productMap = productMap;
    this.productIds = productIds;

    const productBids = products.map((product) => ({
      bidId: this.bidMap.get(bidName),
      productId: this.productMap.get(product.name),
    }));

    await this.bidService.saveProductBids(bid.id, productBids);

    return {
      bidName: Array.isArray(bid.bidName) ? bid.bidName[0] : bid.bidName,
      bidCloseDate: bid.bidCloseDate,
      year,
      isClosed,
      hasWinner,
      investorName: Utils.normalizeString(bid.investorName),
      bidPrice: Number(
        Array.isArray(bid.bidPrice) ? bid.bidPrice[0] : bid.bidPrice
      ),
      fieldCategory,
      fieldGroup,
      vendors: Object.fromEntries(Array.from(vendors).map((v) => [v, 1])),
      products,
    };
  }
}

// ========================= EXPORTED FUNCTION =========================
export const processBidDataWithAi = async (rawData, options = {}) => {
  const processor = new BidProcessor();
  await processor.initialize();
  return processor.processBatch(rawData, options);
};
