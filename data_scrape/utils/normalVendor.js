import fs from "fs/promises";
import "dotenv/config";

// Network company list with pre-compiled regex patterns for better performance
const NETWORK_COMPANIES = [
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

// Pre-compile regex patterns once for better performance
const COMPANY_PATTERNS = NETWORK_COMPANIES.map((company) => ({
  name: company,
  // Improve regex pattern to handle case variations more efficiently
  regex: new RegExp(`\\b${company.replace(/\s+/g, "\\s*")}\\b`, "i"),
}));

/**
 * Check if text contains any network company name and add matches to vendors set
 * @param {string} text - Text to check for company names
 * @param {Set} vendors - Set to add found company names
 */
const checkAndAddVendor = (text, vendors) => {
  if (!text || typeof text !== "string") return;

  for (const { name, regex } of COMPANY_PATTERNS) {
    if (regex.test(text)) {
      vendors.add(name);
    }
  }
};

/**
 * Process table data from bid information
 * @param {Array} table - Table data from bid
 * @param {Set} vendors - Set to collect vendor names
 * @param {Array} goodsInfo - Array to collect goods information
 * @param {Set} uniqueIds - Set to track unique IDs
 */
const processTableData = (table, vendors, goodsInfo, uniqueIds) => {
  if (!Array.isArray(table)) return;

  for (const item of table) {
    // Track unique IDs
    if (item?.id && !uniqueIds.has(item.id)) {
      uniqueIds.add(item.id);
    }

    // Extract vendor from manufacturer field
    if (item?.manufacturer) {
      checkAndAddVendor(item.manufacturer, vendors);
    }

    // Collect goods information
    goodsInfo.push({
      name: item?.manufacturer || "N/A",
      feature: item?.feature || "N/A",
      quantity: Number(item?.qty) || 0,
      unitPrice: Number(item?.bidPrice) || 0,
      totalAmount: Number(item?.amount) || 0,
    });
  }
};

/**
 * Process listTG data from bid information
 * @param {Array} listTG - List data from bid
 * @param {Set} vendors - Set to collect vendor names
 */
const processListTGData = (listTG, vendors) => {
  if (!Array.isArray(listTG)) return;

  for (const good of listTG) {
    // Check both serviceCategory and id fields for vendor names
    if (good?.serviceCategory) checkAndAddVendor(good.serviceCategory, vendors);
    if (good?.id) checkAndAddVendor(good.id, vendors);
  }
};

/**
 * Parse and process goods list data
 * @param {string} goodsListStr - JSON string of goods list
 * @param {Set} vendors - Set to collect vendor names
 * @param {Array} goodsInfo - Array to collect goods information
 * @param {Set} uniqueIds - Set to track unique IDs
 * @returns {boolean} - Success indicator
 */
const processGoodsList = (goodsListStr, vendors, goodsInfo, uniqueIds) => {
  if (!goodsListStr || typeof goodsListStr !== "string") return false;

  try {
    const goodsList = JSON.parse(goodsListStr);

    // Process listTG format
    if (goodsList?.listTG) {
      processListTGData(goodsList.listTG, vendors);
    }

    // Process Table format
    if (
      Array.isArray(goodsList) &&
      goodsList[0]?.formValue?.lotContent?.Table
    ) {
      processTableData(
        goodsList[0].formValue.lotContent.Table,
        vendors,
        goodsInfo,
        uniqueIds
      );
    }

    return true;
  } catch (e) {
    console.warn("Error parsing goodsList:", e.message);
    return false;
  }
};

/**
 * Extract vendor names and goods information from bid data
 * @param {Object} bid - Bid data object
 * @returns {Object} - Object containing vendor names and goods info
 */
const extractVendorsAndGoods = (bid) => {
  const result = {
    goodsInfo: [],
  };

  if (!bid?.details?.bideContractorInputResultDTO?.lotResultDTO) {
    return result;
  }

  const vendors = new Set();
  const goodsInfo = [];
  const uniqueIds = new Set();
  const { lotResultDTO } = bid.details.bideContractorInputResultDTO;

  // Process lot results if available
  if (Array.isArray(lotResultDTO)) {
    for (const lot of lotResultDTO) {
      if (lot?.goodsList) {
        processGoodsList(lot.goodsList, vendors, goodsInfo, uniqueIds);
      }
    }
  }

  // Fall back to bid name if no vendors found
  if (vendors.size === 0 && bid.bidName) {
    const bidName = Array.isArray(bid.bidName) ? bid.bidName[0] : bid.bidName;
    checkAndAddVendor(bidName, vendors);
  }

  // Update vendor names in goods info if they exist
  if (vendors.size > 0 && goodsInfo.length > 0) {
    const vendorString = Array.from(vendors).join(", ");
    goodsInfo.forEach((item) => {
      if (item.name === "N/A") {
        item.name = vendorString;
      }
    });
  }

  // Since we only need goodsInfo in the final output
  result.goodsInfo = goodsInfo;
  return result;
};

/**
 * Normalize vendor information from raw bid data
 * @param {Array} rawData - Array of raw bid data objects
 * @returns {Promise<Array>} - Promise resolving to processed data
 */
export const normalVendorsInfo = async (rawData) => {
  if (!Array.isArray(rawData)) {
    console.error("Error: rawData is not an array");
    return [];
  }

  const OUTPUT_FILE = "./cleanedVendorsInfo.json";

  // Process all bids concurrently for better performance
  const cleanedData = await Promise.all(
    rawData.map(async (bid, index) => {
      try {
        const { goodsInfo } = extractVendorsAndGoods(bid);

        // Just return the goods info array directly
        return { vendorsInfo: goodsInfo };
      } catch (error) {
        console.error(`Error processing bid at index ${index}:`, error.message);
        return null;
      }
    })
  );

  // Flatten the data structure to match requested output format
  const allGoodsInfo = cleanedData
    .filter(Boolean)
    .flatMap((item) => item.vendorsInfo)
    .filter(Boolean);

  try {
    if (allGoodsInfo.length > 0) {
      await fs.writeFile(OUTPUT_FILE, JSON.stringify(allGoodsInfo, null, 2));
      console.log(
        `Successfully processed: ${allGoodsInfo.length} goods records from ${rawData.length} bids. Saved to ${OUTPUT_FILE}`
      );
    } else {
      console.log("No valid data to save.");
    }
  } catch (error) {
    console.error(`Error writing to ${OUTPUT_FILE}:`, error.message);
  }

  return allGoodsInfo;
};
