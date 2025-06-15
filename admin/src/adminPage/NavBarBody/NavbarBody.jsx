import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  Button,
  Form,
  Input,
  List,
  Row,
  Col,
  Card,
  Select,
  message,
  Layout,
  Divider,
  Radio,
  Pagination,
} from "antd";
import axios from "axios";
import keycloak from "../../auth/keyCloak";

const { Option } = Select;
const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#B620E0",
  "#E91E63",
];

const NavbarBody = () => {
  const [data, setData] = useState([]);
  const [form] = Form.useForm();
  const [chartType, setChartType] = useState("pie");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showChart, setShowChart] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [totalAmountSum, setTotalAmountSum] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [compareOption, setCompareOption] = useState("all");
  const [isComparing, setIsComparing] = useState(false);

  // Thêm state cho phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [vendorStats, setVendorStats] = useState([]);
  const [showVendorStats, setShowVendorStats] = useState(false);
  const [yearFilter, setYearFilter] = useState(null);
  const [topVendors, setTopVendors] = useState(10);
  const [examplePrompts] = useState([
    "So sánh tổng đơn giá giữa các danh mục A và B",
    "So sánh tổng giá trị giữa các danh mục X, Y và Z",
    "Chỉ so sánh đơn giá giữa các danh mục",
    "Biểu đồ tổng giá trị của 3 danh mục hàng đầu",
    "So sánh giá giữa vendor A và vendor B",
    "So sánh tổng giá trị của vendor A và B năm 2023",
  ]);

  const fetchData = async (id = null) => {
    try {
      const res = await axios.get("http://localhost:5000/api/vendor/summary", {
        params: id ? { id } : {},
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });

      const resultData = Array.isArray(res.data)
        ? res.data
        : res.data.data || [];
      setData(resultData);

      // Reset về trang đầu khi có dữ liệu mới
      setCurrentPage(1);

      const sum = resultData.reduce(
        (acc, item) => acc + (item.totalAmount || 0),
        0
      );
      setTotalAmountSum(sum);

      const uniqueVendors = [...new Set(resultData.map((item) => item.name))];
      setVendors(uniqueVendors);
    } catch (err) {
      console.log("Lỗi fetch fields:", err);
      setData([]);
      setTotalAmountSum(0);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/categories", {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      setCategories(res.data);
    } catch (error) {
      console.error("Lỗi khi lấy danh mục:", error);
    }
  };

  //Hàm fetch thống kê vendors
  const fetchVendorStatistics = async (year = null, top = null) => {
    try {
      const params = {};
      if (year) params.year = year;
      if (top) params.top = top;

      const res = await axios.get(
        "http://localhost:5000/api/ai/vendor-statistics",
        {
          params,
          headers: { Authorization: `Bearer ${keycloak.token}` },
        }
      );
      setVendorStats(res.data);
      setShowVendorStats(true);
      setChartType("pie");
      setData(
        res.data.map((item) => ({
          name: item.name,
          value: item.frequency,
          percentage: parseFloat(item.percentage),
        }))
      );
      setShowChart(true);
      // Reset về trang đầu khi có dữ liệu thống kê mới
      setCurrentPage(1);
      message.success("Đã tạo thống kê vendor thành công!");
    } catch (error) {
      console.error("Lỗi fetch vendor statistics:", error);
      message.error("Không thể tải thống kê vendor");
    }
  };

  const handleGenerateChart = async () => {
    if (!customPrompt.trim()) {
      message.warning("Vui Lòng Nhập Mô Tả Trước!");
      return;
    }

    // Kiểm tra nếu là prompt thống kê vendor
    const isVendorStatsPrompt =
      customPrompt.toLowerCase().includes("thống kê") &&
      (customPrompt.toLowerCase().includes("vendor") ||
        customPrompt.toLowerCase().includes("xuất hiện") ||
        customPrompt.toLowerCase().includes("tần suất"));

    if (isVendorStatsPrompt) {
      try {
        const res = await axios.post(
          "http://localhost:5000/api/ai/interpret-vendor-stats",
          { prompt: customPrompt },
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );

        const { year, top } = res.data;
        await fetchVendorStatistics(year, top);
        return;
      } catch (error) {
        console.error("Lỗi xử lý vendor stats prompt:", error);
      }
    }

    try {
      const res = await axios.post(
        "http://localhost:5000/api/ai/interpret",
        { prompt: customPrompt },
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );

      const { chartType, data, comparisonType } = res.data;

      setChartType(chartType);
      setData(Array.isArray(data) ? data : []);
      setShowChart(true);
      setShowVendorStats(false);
      // Reset về trang đầu khi có dữ liệu mới
      setCurrentPage(1);

      if (data && data[0]?.totalAmount) {
        const sum = data.reduce(
          (acc, item) => acc + (item.totalAmount || 0),
          0
        );
        setTotalAmountSum(sum);
      }

      message.success(
        comparisonType === "price"
          ? "Đã tạo biểu đồ so sánh giá"
          : `Đã tạo biểu đồ dạng ${chartType.toUpperCase()}`
      );
    } catch (error) {
      console.log(error);
      message.error("AI không thể phân tích prompt");
    }
  };

  const handleSaveChart = async () => {
    if (!customPrompt.trim() || !chartType) {
      message.warning("Không đủ thông tin để lưu biểu đồ!");
      return;
    }
    try {
      await axios.post(
        "http://localhost:5000/api/charts",
        { prompt: customPrompt, type: chartType },
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      message.success("✅ Đã lưu biểu đồ!");
    } catch (err) {
      console.log(err);
      message.error("❌ Không thể lưu biểu đồ!");
    }
  };

  const handleSelectExamplePrompt = (prompt) => {
    setCustomPrompt(prompt);
  };

  // Tính toán dữ liệu cho trang hiện tại
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  };

  // Xử lý thay đổi trang
  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    if (size !== pageSize) {
      setPageSize(size);
      setCurrentPage(1); // Reset về trang đầu khi thay đổi số items per page
    }
  };

  const renderPriceComparisonChart = () => {
    const showUnitPrice = data.some(
      (item) => item.unitPrice !== null && item.unitPrice !== undefined
    );
    const showTotalAmount = data.some(
      (item) => item.totalAmount !== null && item.totalAmount !== undefined
    );

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis type="number" />
          <YAxis
            dataKey="name"
            type="category"
            width={150}
            tickFormatter={(value) =>
              value.length > 15 ? `${value.substring(0, 15)}...` : value
            }
          />
          <Tooltip
            formatter={(value, name) => [
              `${value?.toLocaleString()}đ`,
              name === "unitPrice" ? "Tổng đơn giá" : "Tổng giá trị",
            ]}
          />
          <Legend />
          {showUnitPrice && (
            <Bar dataKey="unitPrice" fill="#8884d8" name="Tổng đơn giá" />
          )}
          {showTotalAmount && (
            <Bar dataKey="totalAmount" fill="#82ca9d" name="Tổng giá trị" />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderChart = () => {
    if (!showChart || !data.length)
      return <p>Không có dữ liệu để hiển thị biểu đồ.</p>;

    if (data[0]?.unitPrice !== undefined) {
      return renderPriceComparisonChart();
    }

    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={data}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="value"
                fill="#8884d8"
                name="Tỉ trọng"
                barSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={data}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#8884d8"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={data}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.8}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "pie":
      default:
        return (
          <ResponsiveContainer width="100%" height={360}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value}`, name]}
                labelFormatter={(label) => `${label}`}
              />
              <Legend
                formatter={(value, entry) => {
                  const total = data.reduce((sum, item) => sum + item.value, 0);
                  const percentage = (
                    (entry.payload.value / total) *
                    100
                  ).toFixed(1);
                  return `${value} (${percentage}%)`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );
    }
  };

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, []);

  return (
    <Layout>
      <Row gutter={16}>
        <Col span={14}>
          <Card title="Tạo biểu đồ theo ý bạn">
            <Input.TextArea
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Nhập yêu cầu của bạn, ví dụ: 'So sánh tổng đơn giá giữa các danh mục A và B'"
            />
            <Row gutter={8} style={{ marginTop: 8 }}>
              <Col>
                <Button type="primary" onClick={handleGenerateChart}>
                  Tạo biểu đồ
                </Button>
              </Col>
              <Col>
                <Button onClick={handleSaveChart} disabled={!showChart}>
                  💾 Lưu biểu đồ
                </Button>
              </Col>
            </Row>

            <div style={{ marginTop: 16 }}>
              <p style={{ marginBottom: 8 }}>Ví dụ câu hỏi:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {examplePrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    size="small"
                    onClick={() => handleSelectExamplePrompt(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          <Card
            title={
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Kết quả biểu đồ</span>
                {data[0]?.unitPrice === undefined && (
                  <Select
                    value={chartType}
                    onChange={(value) => {
                      setChartType(value);
                      if (data.length) setShowChart(true);
                    }}
                    style={{ width: 120 }}
                  >
                    <Option value="pie">Pie Chart</Option>
                    <Option value="bar">Bar Chart</Option>
                    <Option value="line">Line Chart</Option>
                    <Option value="area">Area Chart</Option>
                  </Select>
                )}
              </div>
            }
            style={{ marginTop: 16 }}
          >
            {renderChart()}
          </Card>
        </Col>

        <Col span={10}>
          <Card
            title={
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Danh Sách Dữ Liệu</span>
                <Select
                  style={{ width: 160 }}
                  placeholder="Chọn danh mục"
                  value={selectedCategoryId}
                  onChange={(value) => {
                    setSelectedCategoryId(value);
                    fetchData(value);
                  }}
                  allowClear
                >
                  {categories.map((cat) => (
                    <Option key={cat.id} value={cat.id}>
                      {cat.name}
                    </Option>
                  ))}
                </Select>
              </div>
            }
          >
            {/* Hiển thị thông tin tổng số items */}
            <div style={{ marginBottom: 16, color: "#666", fontSize: "14px" }}>
              Tổng số: <strong>{data.length}</strong> items
              {data.length > pageSize && (
                <>
                  {" "}
                  • Hiển thị: <strong>
                    {getCurrentPageData().length}
                  </strong>{" "}
                  items
                </>
              )}
            </div>

            {/* Danh sách dữ liệu với phân trang */}
            <List
              dataSource={getCurrentPageData()}
              renderItem={(item) => (
                <List.Item>
                  {/* === Hiển thị dữ liệu vendor statistics === */}
                  {showVendorStats ? (
                    <Row style={{ width: "100%" }}>
                      <Col span={12}>
                        <strong>{item.name}</strong>
                      </Col>
                      <Col span={6}>
                        <strong>{item.value} lần</strong>
                      </Col>
                      <Col span={6}>
                        <strong>{item.percentage}%</strong>
                      </Col>
                    </Row>
                  ) : item.unitPrice !== undefined ? (
                    <Row style={{ width: "100%" }}>
                      <Col span={8}>
                        <strong>{item.name}</strong>
                      </Col>
                      <Col span={8}>
                        {item.unitPrice !== null && (
                          <>
                            Tổng đơn giá:{" "}
                            <strong>{item.unitPrice?.toLocaleString()}đ</strong>
                          </>
                        )}
                      </Col>
                      <Col span={8}>
                        {item.totalAmount !== null && (
                          <>
                            Tổng giá trị:{" "}
                            <strong>
                              {item.totalAmount?.toLocaleString()}đ
                            </strong>
                          </>
                        )}
                      </Col>
                    </Row>
                  ) : (
                    <Row style={{ width: "100%" }}>
                      <Col span={12}>
                        <strong>{item.name}</strong>
                      </Col>
                      <Col span={12}>
                        <strong>{item.value}</strong>
                      </Col>
                    </Row>
                  )}
                </List.Item>
              )}
            />

            {/* Component phân trang */}
            {data.length > 0 && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <Pagination
                  current={currentPage}
                  total={data.length}
                  pageSize={pageSize}
                  onChange={handlePageChange}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(total, range) =>
                    `${range[0]}-${range[1]} của ${total} items`
                  }
                  pageSizeOptions={["5", "10", "20", "50", "100"]}
                  size="small"
                />
              </div>
            )}

            {/* === Hiển thị tổng cho vendor statistics === */}
            {showVendorStats && vendorStats.length > 0 && (
              <div style={{ textAlign: "right", marginTop: 16 }}>
                <strong>Tổng vendor: </strong>
                {vendorStats.length}
                <br />
                <strong>Tổng lần xuất hiện: </strong>
                {vendorStats.reduce((sum, item) => sum + item.frequency, 0)}
              </div>
            )}

            {data[0]?.totalAmount !== undefined && !showVendorStats && (
              <div style={{ textAlign: "right", marginTop: 16 }}>
                <strong>Tổng tất cả: </strong>
                {totalAmountSum.toLocaleString()}đ
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Layout>
  );
};

export default NavbarBody;
