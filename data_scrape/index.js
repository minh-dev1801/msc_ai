import axios from "axios";
import https from "https";
import { promises as fs } from "fs";
import { setTimeout } from "timers/promises";
import { connectToSQLServer } from "./database/db.js";
import { NETWORK_CATEGORIES } from "./constants/constants.js";
import { processBidDataWithAi } from "./utils/normalProductWithAi_2.js";

const keyword = process.argv[2] || "";
const type = process.argv[3] || "";

const CONFIG = {
  API_URL: process.env.URL_API,
  DETAIL_API_URL:
    "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/expose/contractor-input-result/get?token",
  PAGE_SIZE: 50,
  MAX_PAGE: 20,
  // PAGE_SIZE: 50,
  // MAX_PAGE: 1,
  CONCURRENCY: 5,
  RETRY_LIMIT: 3,
  RETRY_DELAY: 1000,
  REQUEST_DELAY: 200,
  TIMEOUT: 10000,
  TEMP_SAVE_INTERVAL: 10,
};

const agent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: CONFIG.CONCURRENCY,
});

const headers = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

async function fetchAdditionalDetails(inputResultId) {
  for (let attempt = 0; attempt < CONFIG.RETRY_LIMIT; attempt++) {
    try {
      const response = await axios.post(
        CONFIG.DETAIL_API_URL,
        { id: inputResultId },
        {
          headers,
          httpsAgent: agent,
          timeout: CONFIG.TIMEOUT,
        }
      );
      return response.data;
    } catch (error) {
      if (attempt >= CONFIG.RETRY_LIMIT - 1) {
        console.error(
          `❌ Lỗi khi lấy chi tiết cho ID ${inputResultId}:`,
          error.message
        );
        return null;
      }
      await setTimeout(CONFIG.RETRY_DELAY * (attempt + 1));
    }
  }
}

async function enrichDataWithDetails(data) {
  const enrichedData = [];

  for (let i = 0; i < data.length; i += CONFIG.CONCURRENCY) {
    const batch = data.slice(i, i + CONFIG.CONCURRENCY);
    const promises = batch.map(async (item) => {
      if (!item.inputResultId) {
        console.log(`⚠️ Bỏ qua mục không có inputResultId: ${item.notifyNo}`);
        return null;
      }

      const details = await fetchAdditionalDetails(item.inputResultId);
      return { ...item, details };
    });

    const results = await Promise.all(promises);
    const validResults = results.filter((result) => result !== null);
    enrichedData.push(...validResults);
    await setTimeout(CONFIG.REQUEST_DELAY);
  }

  return enrichedData;
}

function buildTypeFilters(type) {
  const currentTime = new Date().toISOString();

  let filters = [
    {
      fieldName: "type",
      searchType: "in",
      fieldValues: ["es-notify-contractor"],
    },
    {
      fieldName: "caseKHKQ",
      searchType: "not_in",
      fieldValues: ["1"],
    },
  ];

  const statusMap = {
    dangXetThau: "DXT",
    coNhaThauTrungThau: "CNTTT",
    khongCoNhaThauTrungThau: "KCNTTT",
    daHuyThau: "DHT",
    chuaMoThau: "",
    tuyenBoVoHieuQuyetDinhVeKqlcnt: "VHH",
    khongCongNhanKqlcnt: "KCN",
    dinhChiCuocThau: "DC",
  };

  if (type === "chuaDongThau") {
    filters.push({
      fieldName: "bidCloseDate",
      searchType: "range",
      from: currentTime,
      to: null,
    });
  } else if (type === "daDongThau" || statusMap[type]) {
    filters.push({
      fieldName: "bidCloseDate",
      searchType: "range",
      from: null,
      to: currentTime,
    });

    if (statusMap[type]) {
      filters.push({
        fieldName: "statusForNotify",
        searchType: "in",
        fieldValues: [statusMap[type]],
      });
    }
  }

  return filters;
}

const createPayload = (page, keyword = "", typeFilter) => ({
  pageSize: CONFIG.PAGE_SIZE,
  pageNumber: page.toString(),
  query: [
    {
      index: "es-contractor-selection",
      keyWord: keyword,
      matchType: "all-1",
      matchFields: ["notifyNo", "bidName"],
      filters: typeFilter,
    },
  ],
});

async function fetchWithRetry(page, keyword, typeFilter) {
  for (let attempt = 0; attempt < CONFIG.RETRY_LIMIT; attempt++) {
    try {
      await setTimeout(CONFIG.REQUEST_DELAY);

      const response = await axios.post(
        CONFIG.API_URL,
        [createPayload(page, keyword, typeFilter)],
        {
          headers,
          httpsAgent: agent,
          timeout: CONFIG.TIMEOUT,
        }
      );

      if (!response.data?.page?.content) {
        throw new Error("Cấu trúc phản hồi không hợp lệ");
      }

      return {
        success: true,
        data: response.data.page.content,
        page,
      };
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 400) {
        console.log("🚫 Lỗi vĩnh viễn, dừng ngay");
        return {
          success: false,
          error: `Lỗi vĩnh viễn: ${error.message}`,
          page,
        };
      }

      if (attempt >= CONFIG.RETRY_LIMIT - 1) {
        return {
          success: false,
          error: `❌ Thất bại sau ${CONFIG.RETRY_LIMIT} lần thử`,
          page,
        };
      }

      const delay = CONFIG.RETRY_DELAY * (attempt + 1);
      await setTimeout(delay);
      console.log(
        `🔄 Thử lại lần ${attempt + 1} cho trang ${page} sau ${delay}ms`
      );
    }
  }
}

async function* dataGenerator(keyword, typeFilter) {
  let page = 0;
  let hasMore = true;
  let consecutiveErrors = 0;

  while (hasMore && page < CONFIG.MAX_PAGE) {
    const result = await fetchWithRetry(page, keyword, typeFilter);

    if (!result.success) {
      console.error(`❌ Lỗi khi lấy trang ${page}:`, result.error);
      consecutiveErrors++;

      if (consecutiveErrors >= 3) {
        console.error("⚠️ Quá nhiều lỗi liên tiếp, dừng lại...");
        break;
      }

      page++;
      continue;
    }

    consecutiveErrors = 0;

    if (result.data.length === 0) {
      hasMore = false;
    } else {
      yield {
        data: result.data,
        page: result.page,
        isLast: false,
      };
      page++;
    }
  }

  yield { isLast: true };
}

async function processDataStream(keyword, typeFilter) {
  let allData = [];
  let processedPages = 0;
  const generator = dataGenerator(keyword, typeFilter);
  const outputFile = `data-${keyword || "all"}-${type || "tatCa"}.json`;

  for await (const result of generator) {
    if (result.isLast) {
      console.log("🏁 Đã lấy hết dữ liệu");
      break;
    }

    allData.push(...result.data);
    processedPages++;
    console.log(
      `📊 Trang ${result.page}: +${result.data.length} mục (Tổng cộng: ${allData.length})`
    );

    if (processedPages % CONFIG.TEMP_SAVE_INTERVAL === 0) {
      await fs.writeFile(
        `temp-${outputFile}`,
        JSON.stringify(allData, null, 2)
      );
      console.log(`💾 Đã lưu tạm thời (${allData.length} mục)`);
    }
  }

  return allData;
}

function extractNameCategories() {
  const categoriesToInsert = NETWORK_CATEGORIES.map((category) => ({
    name: category,
  }));

  return categoriesToInsert;
}

async function main() {
  try {
    console.time("⏳ Quá trình thu thập dữ liệu");
    await connectToSQLServer();

    const typeFilter = buildTypeFilters(type);
    const finalData = await processDataStream(keyword, typeFilter);

    if (finalData.length > 0) {
      console.log("🔄 Đang lấy thông tin chi tiết từ API...");

      const enrichedData = await enrichDataWithDetails(finalData);

      await processBidDataWithAi(enrichedData, {
        batchSize: 50,
        enableDatabase: true,
        enableOpenAI: true,
        verbose: false,
      });

      // const outputFile = `data-${keyword || "all"}-${type || "tatCa"}.json`;
      // await fs.writeFile(outputFile, JSON.stringify(productsInfo, null, 2));
      console.log("✅ Quá trình thu thập dữ liệu hoàn tất");
    }

    console.timeEnd("⏳ Quá trình thu thập dữ liệu");
  } catch (error) {
    console.error("❌ Lỗi nghiêm trọng:", error);
    console.error("❌ Message của lỗi:", error.message);
  } finally {
    agent.destroy();
  }
}

main();
