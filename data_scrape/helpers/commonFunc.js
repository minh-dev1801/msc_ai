import { deviceToCategoryMap } from "../constants/constants.js";

/**
 * Tạo các mẫu regex từ mảng các chuỗi cần tìm kiếm
 * @param {string[]} patterns - Mảng các chuỗi dùng để tạo regex
 * @param {Object} options - Các tùy chọn cho việc tạo regex
 * @param {boolean} options.caseSensitive - Có phân biệt chữ hoa/thường hay không (mặc định: false)
 * @param {boolean} options.wholeWord - Chỉ khớp từ hoàn chỉnh (mặc định: true)
 * @param {boolean} options.flexibleSpacing - Cho phép khớp với các khoảng trắng linh hoạt (mặc định: true)
 * @param {boolean} options.matchPartial - Tìm kiếm cả các từ con trong ngoặc đơn (mặc định: true)
 * @returns {Array<{name: string, regex: RegExp}>}
 */
export const createPatterns = (patterns, options = {}) => {
  const {
    caseSensitive = false,
    wholeWord = true,
    flexibleSpacing = true,
    matchPartial = true,
  } = options;

  const result = [];

  patterns.forEach((pattern) => {
    // Tạo mảng các mẫu cần tìm kiếm từ pattern gốc
    const patternsToSearch = [pattern];

    // Tìm kiếm cả từ trong ngoặc đơn nếu được bật
    if (matchPartial) {
      // Tìm các từ trong ngoặc đơn: (word)
      const match = pattern.match(/\((.*?)\)/);
      if (match && match[1]) {
        patternsToSearch.push(match[1]);
      }
    }

    // Xử lý từng mẫu tìm kiếm
    patternsToSearch.forEach((searchPattern) => {
      let regexPattern = searchPattern;

      // Escape các ký tự đặc biệt trong regex, trừ khoảng trắng
      regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Xử lý khoảng trắng linh hoạt nếu được bật
      if (flexibleSpacing) {
        regexPattern = regexPattern.replace(/\s+/g, "\\s*");
      }

      // Thêm ràng buộc từ hoàn chỉnh nếu được bật
      if (wholeWord) {
        regexPattern = `\\b${regexPattern}\\b`;
      }

      // Tạo regex với cờ không phân biệt chữ hoa/thường nếu cần
      const flags = caseSensitive ? "" : "i";

      result.push({
        name: pattern, // Luôn trả về tên pattern gốc
        regex: new RegExp(regexPattern, flags),
      });
    });
  });

  return result;
};

/**
 * Kiểm tra văn bản có chứa các mẫu được cung cấp hay không
 * @param {string} text
 * @param {string[]} customPatterns
 * @param {Object} options
 * @param {boolean} options.caseSensitive
 * @param {boolean} options.wholeWord
 * @param {boolean} options.flexibleSpacing
 * @param {boolean} options.matchPartial
 * @param {boolean} options.returnFirst
 * @param {boolean} options.useDeviceMapping - Sử dụng ánh xạ thiết bị (mặc định: true)
 * @returns {Set<string> | string | null}
 */
export const findMatches = (text, customPatterns, options = {}) => {
  if (!text || typeof text !== "string") {
    return options.returnFirst ? null : new Set();
  }
  if (!Array.isArray(customPatterns) || customPatterns.length === 0) {
    return options.returnFirst ? null : new Set();
  }
  const {
    returnFirst = false,
    useDeviceMapping = true,
    ...regexOptions
  } = options;
  const compiledPatterns = createPatterns(customPatterns, regexOptions);
  const matches = new Set();

  // Kiểm tra regex từ customPatterns
  for (const { name, regex } of compiledPatterns) {
    if (regex.test(text)) {
      if (returnFirst) return name;
      matches.add(name);
    }
  }

  // Kiểm tra ánh xạ thiết bị nếu được bật
  if (useDeviceMapping) {
    for (const [device, category] of Object.entries(deviceToCategoryMap)) {
      if (text.includes(device)) {
        if (returnFirst) return category;
        matches.add(category);
      }
    }
  }

  return returnFirst ? null : matches;
};
