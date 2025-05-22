// Nhập module 'fs/promises' để làm việc với hệ thống tệp một cách bất đồng bộ (sử dụng Promise).
import fs from "fs/promises";
// Nhập và cấu hình dotenv để tải các biến môi trường từ tệp .env.
import "dotenv/config";
import {
  NETWORK_CATEGORIES,
  NETWORK_COMPANIES,
} from "../constants/constants.js";
import { findMatches } from "../helpers/commonFunc.js";

/**
 * Kiểm tra xem văn bản có chứa tên công ty mạng nào không và thêm các kết quả khớp vào tập hợp vendors.
 * @param {string} text - Văn bản cần kiểm tra tên công ty.
 * @param {Set} vendors - Tập hợp (Set) để thêm tên công ty tìm thấy.
 */
const checkAndAddVendor = (
  text,
  vendors,
  customPatterns = NETWORK_COMPANIES
) => {
  if (!text || typeof text !== "string") return;

  const matches = findMatches(text, customPatterns, {
    returnFirst: false, // Chỉ tìm từ đầu tiên khớp
    flexibleSpacing: true, // Cho phép khớp "Paloalto" với "Palo Alto"
    wholeWord: false, // Không yêu cầu từ hoàn chỉnh để khớp "Paloalto"
    useDeviceMapping: false,
  });

  // Thêm tất cả kết quả khớp vào tập hợp vendors
  for (const match of matches) {
    vendors.add(match);
  }
};

const CheckNameCategories = (
  text,
  nameCategories,
  customPatterns = NETWORK_CATEGORIES
) => {
  if (!text || typeof text !== "string") return;

  const matches = findMatches(text, customPatterns, {
    returnFirst: false, // Chỉ tìm từ đầu tiên khớp
    flexibleSpacing: true, // Cho phép khớp "Paloalto" với "Palo Alto"
    wholeWord: false, // Không yêu cầu từ hoàn chỉnh để khớp "Paloalto"
    useDeviceMapping: true,
  });

  // Thêm tất cả kết quả khớp vào tập hợp vendors
  for (const match of matches) {
    nameCategories.add(match);
  }
};

/**
 * Xử lý dữ liệu bảng từ thông tin thầu.
 * @param {Array} table - Dữ liệu bảng từ gói thầu.
 * @param {Set} vendors - Tập hợp (Set) để thu thập tên nhà cung cấp.
 * @param {Array} goodsInfo - Mảng để thu thập thông tin hàng hóa.
 * @param {Set} uniqueIds - Tập hợp (Set) để theo dõi các ID duy nhất.
 */
const processTableData = (
  table,
  vendors,
  goodsInfo,
  uniqueIds,
  nameCategories
) => {
  // Nếu 'table' không phải là một mảng, thoát khỏi hàm.
  if (!Array.isArray(table)) return;

  // Lặp qua từng mục trong bảng.
  for (const item of table) {
    // Theo dõi các ID duy nhất.
    // Nếu mục có ID và ID đó chưa có trong tập hợp uniqueIds.
    if (item?.id && !uniqueIds.has(item.id)) {
      // Thêm ID vào tập hợp uniqueIds.
      uniqueIds.add(item.id);
    }

    // Trích xuất nhà cung cấp từ trường 'manufacturer' (nhà sản xuất).
    if (item?.manufacturer) {
      checkAndAddVendor(item.manufacturer, vendors);

      CheckNameCategories(item.name, nameCategories);
    }

    // Thu thập thông tin hàng hóa.
    goodsInfo.push({
      nameCategories: "N/A", // Tên sản phẩm, nếu không có thì là "N/A".
      code: item?.codeGood || "N/A", // Mã sản phẩm, nếu không có thì là "N/A".
      vendor: "N/A", // Tên nhà sản xuất, nếu không có thì là "N/A".
      feature: item?.feature || "N/A", // Tính năng, nếu không có thì là "N/A".
      quantity: Number(item?.qty) || 0, // Số lượng, chuyển đổi sang số, nếu không có hoặc lỗi thì là 0.
      unitPrice: Number(item?.bidPrice) || 0, // Đơn giá thầu, chuyển đổi sang số, nếu không có hoặc lỗi thì là 0.
      totalAmount: Number(item?.amount) || 0, // Tổng tiền, chuyển đổi sang số, nếu không có hoặc lỗi thì là 0.
    });
  }
};

/**
 * Xử lý dữ liệu listTG từ thông tin thầu.
 * @param {Array} listTG - Dữ liệu danh sách từ gói thầu.
 * @param {Set} vendors - Tập hợp (Set) để thu thập tên nhà cung cấp.
 */
const processListTGData = (listTG, vendors, goodsInfo, nameCategories) => {
  // Nếu 'listTG' không phải là một mảng, thoát khỏi hàm.
  if (!Array.isArray(listTG)) return;

  // Lặp qua từng mục hàng hóa trong listTG.
  for (const good of listTG) {
    // Kiểm tra cả trường 'serviceCategory' (loại dịch vụ) và 'id' để tìm tên nhà cung cấp.
    if (good?.serviceCategory) {
      checkAndAddVendor(good.serviceCategory, vendors);

      CheckNameCategories(good.serviceCategory, nameCategories);
    }

    goodsInfo.push({
      nameCategories: "N/A", // Tên sản phẩm, nếu không có thì là "N/A".
      code: good?.codeGood || "N/A", // Mã sản phẩm, nếu không có thì là "N/A".
      vendor: "N/A", // Tên nhà sản xuất, nếu không có thì là "N/A".
      feature: good?.feature || "N/A", // Tính năng, nếu không có thì là "N/A".
      quantity: Number(good?.originQty) || 0, // Số lượng, chuyển đổi sang số, nếu không có hoặc lỗi thì là 0.
      unitPrice: Number(good?.bidPrice) || 0, // Đơn giá thầu, chuyển đổi sang số, nếu không có hoặc lỗi thì là 0.
      totalAmount: Number(good?.intoMoney) || 0, // Tổng tiền, chuyển đổi sang số, nếu không có hoặc lỗi thì là 0.
    });
  }
};

/**
 * Phân tích cú pháp và xử lý dữ liệu danh sách hàng hóa.
 * @param {string} goodsListStr - Chuỗi JSON của danh sách hàng hóa.
 * @param {Set} vendors - Tập hợp (Set) để thu thập tên nhà cung cấp.
 * @param {Array} goodsInfo - Mảng để thu thập thông tin hàng hóa.
 * @param {Set} uniqueIds - Tập hợp (Set) để theo dõi các ID duy nhất.
 * @param {Set} nameCategories - Tập hợp (Set) để thu thập tên danh mục.
 * @returns {boolean} - Chỉ báo thành công (true nếu thành công, false nếu thất bại).
 */
const processGoodsList = (
  goodsListStr,
  vendors,
  goodsInfo,
  uniqueIds,
  nameCategories
) => {
  // Nếu chuỗi goodsListStr không tồn tại hoặc không phải là chuỗi, trả về false.
  if (!goodsListStr || typeof goodsListStr !== "string") return false;

  try {
    // Chuyển đổi chuỗi JSON thành đối tượng JavaScript.
    const goodsList = JSON.parse(goodsListStr);

    // Xử lý định dạng listTG.
    // Nếu goodsList có thuộc tính listTG.
    if (goodsList?.listTG) {
      processListTGData(goodsList.listTG, vendors, goodsInfo, nameCategories);
    }

    // Xử lý định dạng Table.
    // Nếu goodsList là một mảng VÀ phần tử đầu tiên có cấu trúc formValue.lotContent.Table.
    if (
      Array.isArray(goodsList) &&
      goodsList[0]?.formValue?.lotContent?.Table
    ) {
      processTableData(
        goodsList[0].formValue.lotContent.Table,
        vendors,
        goodsInfo,
        uniqueIds,
        nameCategories
      );
    }

    // Trả về true nếu xử lý thành công.
    return true;
  } catch (e) {
    // Ghi lại cảnh báo nếu có lỗi khi phân tích cú pháp goodsList.
    console.warn("Lỗi phân tích cú pháp goodsList:", e.message);
    // Trả về false nếu có lỗi.
    return false;
  }
};

/**
 * Trích xuất tên nhà cung cấp và thông tin hàng hóa từ dữ liệu thầu.
 * @param {Object} bid - Đối tượng dữ liệu thầu.
 * @returns {Object} - Đối tượng chứa tên nhà cung cấp và thông tin hàng hóa.
 */
const extractVendorsAndGoods = (bid) => {
  // Khởi tạo đối tượng kết quả với mảng goodsInfo rỗng.
  const result = {
    goodsInfo: [],
  };

  // Nếu đường dẫn đến lotResultDTO không tồn tại trong đối tượng bid, trả về kết quả rỗng.
  if (!bid?.details?.bideContractorInputResultDTO?.lotResultDTO) {
    return result;
  }

  // Khởi tạo một Set để lưu trữ các nhà cung cấp (đảm bảo không có trùng lặp).
  const vendors = new Set();

  // Khởi tạo một Set để lưu trữ các tên danh mục (đảm bảo không có trùng lặp).
  const nameCategories = new Set();

  // Khởi tạo một mảng để lưu trữ thông tin hàng hóa.
  const goodsInfo = [];
  // Khởi tạo một Set để lưu trữ các ID duy nhất.
  const uniqueIds = new Set();

  // Lấy ra lotResultDTO từ đối tượng bid để dễ truy cập.
  const { lotResultDTO } = bid.details.bideContractorInputResultDTO;

  // Xử lý kết quả lô thầu nếu có.
  // Nếu lotResultDTO là một mảng.
  if (Array.isArray(lotResultDTO)) {
    // Lặp qua từng lô trong lotResultDTO.
    for (const lot of lotResultDTO) {
      // Code kiểm tra data của listTG

      // const test = JSON.parse(lot?.goodsList);
      // if (test?.listTG) {
      //   console.log({ lotResultDTO });
      // }

      if (lot?.goodsList) {
        // Xử lý danh sách hàng hóa của lô đó.
        processGoodsList(
          lot.goodsList,
          vendors,
          goodsInfo,
          uniqueIds,
          nameCategories
        );
      }
    }
  }

  // Dự phòng sử dụng tên gói thầu (bidName) nếu không tìm thấy nhà cung cấp nào.
  // Nếu không có nhà cung cấp nào được tìm thấy (vendors rỗng) VÀ bid có thuộc tính bidName.
  if (vendors.size === 0 && bid.bidName) {
    // Lấy tên gói thầu. Nếu bidName là mảng, lấy phần tử đầu tiên, ngược lại lấy chính nó.
    const bidName = Array.isArray(bid.bidName) ? bid.bidName[0] : bid.bidName;
    // Kiểm tra và thêm nhà cung cấp từ tên gói thầu.
    checkAndAddVendor(bidName, vendors);
  }

  console.log({ nameCategories });

  // Cập nhật tên nhà cung cấp và danh mục trong thông tin hàng hóa nếu chúng tồn tại.
  if ((vendors.size > 0 || nameCategories.size > 0) && goodsInfo.length > 0) {
    // Chuyển đổi Set thành chuỗi nếu có dữ liệu
    const vendorString =
      vendors.size > 0 ? Array.from(vendors).join(", ") : "N/A";
    const nameCategoriesString =
      nameCategories.size > 0 ? Array.from(nameCategories).join(", ") : "N/A";

    // Lặp qua từng mục hàng hóa một lần duy nhất
    goodsInfo.forEach((item) => {
      // Cập nhật vendor nếu là "N/A" và có vendorString
      if (item.vendor === "N/A" && vendorString) {
        item.vendor = vendorString;
      }
      // Cập nhật nameCategories nếu là "N/A" và có nameCategoriesString
      if (item.nameCategories === "N/A" && nameCategoriesString) {
        item.nameCategories = nameCategoriesString;
      }
    });
  }

  // Vì chúng ta chỉ cần goodsInfo trong kết quả cuối cùng.
  result.goodsInfo = goodsInfo;
  // Trả về đối tượng kết quả.
  return result;
};

/**
 * Chuẩn hóa thông tin nhà cung cấp từ dữ liệu thầu thô.
 * @param {Array} rawData - Mảng các đối tượng dữ liệu thầu thô.
 * @returns {Promise<Array>} - Promise trả về một mảng dữ liệu đã được xử lý.
 */
export const normalProductsInfo = async (rawData) => {
  // Nếu rawData không phải là một mảng, ghi lỗi và trả về mảng rỗng.
  if (!Array.isArray(rawData)) {
    console.error("Lỗi: rawData không phải là một mảng");
    return [];
  }

  // Định nghĩa tên tệp đầu ra.
  const OUTPUT_FILE = "./cleanedVendorsInfo.json";

  // Xử lý tất cả các gói thầu đồng thời để cải thiện hiệu suất bằng Promise.all.
  const cleanedData = await Promise.all(
    // Ánh xạ qua từng gói thầu trong rawData.
    rawData.map(async (bid, index) => {
      try {
        // Trích xuất thông tin hàng hóa từ gói thầu.
        const { goodsInfo } = extractVendorsAndGoods(bid);

        // Chỉ trả về trực tiếp mảng thông tin hàng hóa.
        return { vendorsInfo: goodsInfo };
      } catch (error) {
        // Ghi lỗi nếu có vấn đề khi xử lý một gói thầu cụ thể.
        console.error(
          `Lỗi xử lý gói thầu tại chỉ mục ${index}:`,
          error.message
        );
        // Trả về null nếu có lỗi để có thể lọc ra sau này.
        return null;
      }
    })
  );

  // Làm phẳng cấu trúc dữ liệu để khớp với định dạng đầu ra yêu cầu.
  const allGoodsInfo = cleanedData
    .filter(Boolean) // Loại bỏ các giá trị null (các gói thầu bị lỗi).
    .flatMap((item) => item.vendorsInfo) // Làm phẳng mảng các vendorsInfo thành một mảng duy nhất chứa tất cả thông tin hàng hóa.
    .filter(Boolean); // Loại bỏ các giá trị null hoặc undefined có thể có trong mảng goodsInfo.

  try {
    // Nếu có dữ liệu hàng hóa hợp lệ để lưu.
    if (allGoodsInfo.length > 0) {
      // Ghi dữ liệu đã xử lý vào tệp JSON.
      // JSON.stringify(allGoodsInfo, null, 2) chuyển đổi đối tượng JavaScript thành chuỗi JSON với định dạng đẹp ( thụt lề 2 dấu cách).
      await fs.writeFile(OUTPUT_FILE, JSON.stringify(allGoodsInfo, null, 2));
      // Ghi log thông báo thành công.
      console.log(
        `Xử lý thành công: ${allGoodsInfo.length} bản ghi hàng hóa từ ${rawData.length} gói thầu. Đã lưu vào ${OUTPUT_FILE}`
      );
    } else {
      // Ghi log nếu không có dữ liệu hợp lệ để lưu.
      console.log("Không có dữ liệu hợp lệ để lưu.");
    }
  } catch (error) {
    // Ghi lỗi nếu có vấn đề khi ghi tệp.
    console.error(`Lỗi ghi vào ${OUTPUT_FILE}:`, error.message);
  }

  // Trả về mảng chứa tất cả thông tin hàng hóa đã được xử lý.
  return allGoodsInfo;
};
