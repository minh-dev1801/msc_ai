import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, LineChart, Line, AreaChart, Area
} from "recharts";
import { Button, Form, Input, List, Row, Col, Card, Select, message, Layout, Divider, Radio } from "antd";
import axios from "axios";
import keycloak from "../../auth/keyCloak";

const { Option } = Select;
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#B620E0", "#E91E63"];

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
  
  const [examplePrompts] = useState([
    "So sánh tổng đơn giá giữa các danh mục A và B",
    "So sánh tổng giá trị giữa các danh mục X, Y và Z",
    "Chỉ so sánh đơn giá giữa các danh mục",
    "Biểu đồ tổng giá trị của 3 danh mục hàng đầu",
    "So sánh giá giữa vendor A và vendor B",
    "So sánh tổng giá trị của vendor A và B năm 2023"
  ]);

  const fetchData = async (productCategoryId = null) => {
    try {
      const res = await axios.get("http://localhost:5000/api/vendor/summary", {
        params: productCategoryId ? { productCategoryId } : {},
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });

      const resultData = Array.isArray(res.data) ? res.data : res.data.data || [];
      setData(resultData);

      const sum = resultData.reduce((acc, item) => acc + (item.totalAmount || 0), 0);
      setTotalAmountSum(sum);
      
      const uniqueVendors = [...new Set(resultData.map(item => item.name))];
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

  const fetchCategoryComparisonData = async (categoryIds) => {
    try {
      const res = await axios.get("http://localhost:5000/api/categories/summary", {
        params: { categoryIds: categoryIds.join(',') },
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      
      return res.data;
    } catch (err) {
      console.log("Lỗi fetch category comparison:", err);
      return [];
    }
  };

  const generateCategoryComparisonPrompt = async (compareType = "all") => {
    if (selectedCategories.length < 2) {
      message.warning("Vui lòng chọn ít nhất 2 danh mục để so sánh!");
      return;
    }
    
    const data = await fetchCategoryComparisonData(selectedCategories);
    const categoryNames = categories
      .filter(cat => selectedCategories.includes(cat.id))
      .map(cat => cat.name);
    
    let prompt = "";
    switch (compareType) {
      case "unitPrice":
        prompt = `So sánh tổng đơn giá giữa các danh mục ${categoryNames.join(' và ')}`;
        break;
      case "totalAmount":
        prompt = `So sánh tổng giá trị giữa các danh mục ${categoryNames.join(' và ')}`;
        break;
      case "all":
      default:
        prompt = `So sánh giá (tổng đơn giá và tổng giá trị) giữa các danh mục ${categoryNames.join(' và ')}`;
        break;
    }
    
    setCustomPrompt(prompt);
    setIsComparing(true);
    
    setChartType("bar");
    setData(data.map(item => ({
      name: item.categoryName,
      unitPrice: compareType === "totalAmount" ? null : item.totalUnitPrice,
      totalAmount: compareType === "unitPrice" ? null : item.totalAmount
    })));
    setShowChart(true);
  };

  const generateVendorComparisonPrompt = () => {
    if (selectedVendors.length < 2) {
      message.warning("Vui lòng chọn ít nhất 2 vendor để so sánh!");
      return;
    }
    
    let prompt = "";
    switch (compareOption) {
      case "unitPrice":
        prompt = `So sánh đơn giá giữa ${selectedVendors.join(' và ')}`;
        break;
      case "totalAmount":
        prompt = `So sánh tổng giá trị giữa ${selectedVendors.join(' và ')}`;
        break;
      case "all":
      default:
        prompt = `So sánh giá (đơn giá và tổng giá trị) giữa ${selectedVendors.join(' và ')}`;
        break;
    }
    
    setCustomPrompt(prompt);
    setIsComparing(true);
  };

  const handleGenerateChart = async () => {
    if (!customPrompt.trim()) {
      message.warning("Vui Lòng Nhập Mô Tả Trước!");
      return;
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

      if (data && data[0]?.totalAmount) {
        const sum = data.reduce((acc, item) => acc + (item.totalAmount || 0), 0);
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

  const renderPriceComparisonChart = () => {
    const showUnitPrice = data.some(item => item.unitPrice !== null && item.unitPrice !== undefined);
    const showTotalAmount = data.some(item => item.totalAmount !== null && item.totalAmount !== undefined);
    
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
            tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
          />
          <Tooltip 
            formatter={(value, name) => [
              `${value?.toLocaleString()}đ`,
              name === "unitPrice" ? "Tổng đơn giá" : "Tổng giá trị"
            ]}
          />
          <Legend />
          {showUnitPrice && (
            <Bar 
              dataKey="unitPrice" 
              fill="#8884d8" 
              name="Tổng đơn giá" 
            />
          )}
          {showTotalAmount && (
            <Bar 
              dataKey="totalAmount" 
              fill="#82ca9d" 
              name="Tổng giá trị" 
            />
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
              <Bar dataKey="value" fill="#8884d8" name="Tỉ trọng" barSize={30} />
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
              <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
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
              <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.8} />
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
              <Tooltip />
              <Legend />
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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

          <Card title="Công cụ so sánh Danh mục" style={{ marginTop: 16 }}>
            <Form layout="vertical">
              <Form.Item label="Chọn danh mục cần so sánh">
                <Select
                  mode="multiple"
                  placeholder="Chọn 2 hoặc nhiều danh mục"
                  value={selectedCategories}
                  onChange={setSelectedCategories}
                  style={{ width: '100%' }}
                >
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                  ))}
                </Select>
              </Form.Item>
              
              <Form.Item label="Loại so sánh">
                <Radio.Group 
                  value={compareOption}
                  onChange={e => setCompareOption(e.target.value)}
                >
                  <Radio value="all">Tất cả</Radio>
                  <Radio value="unitPrice">Chỉ đơn giá</Radio>
                  <Radio value="totalAmount">Chỉ tổng giá trị</Radio>
                </Radio.Group>
              </Form.Item>
              
              <Form.Item>
                <Row gutter={8}>
                  <Col>
                    <Button
                      onClick={() => generateCategoryComparisonPrompt(compareOption)}
                      disabled={selectedCategories.length < 2}
                    >
                      So sánh danh mục
                    </Button>
                  </Col>
                </Row>
              </Form.Item>
            </Form>
          </Card>

          <Card title="Công cụ so sánh Vendor" style={{ marginTop: 16 }}>
            <Form layout="vertical">
              <Form.Item label="Chọn vendor cần so sánh">
                <Select
                  mode="multiple"
                  placeholder="Chọn 2 hoặc nhiều vendor"
                  value={selectedVendors}
                  onChange={setSelectedVendors}
                  style={{ width: '100%' }}
                >
                  {vendors.map((vendor, index) => (
                    <Option key={index} value={vendor}>{vendor}</Option>
                  ))}
                </Select>
              </Form.Item>
              
              <Form.Item>
                <Row gutter={8}>
                  <Col>
                    <Button
                      onClick={generateVendorComparisonPrompt}
                      disabled={selectedVendors.length < 2}
                    >
                      Tạo prompt so sánh
                    </Button>
                  </Col>
                </Row>
              </Form.Item>
            </Form>
          </Card>

          <Card
            title={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
            <List
              dataSource={data}
              renderItem={(item) => (
                <List.Item>
                  {item.unitPrice !== undefined ? (
                    <Row style={{ width: '100%' }}>
                      <Col span={8}><strong>{item.name}</strong></Col>
                      <Col span={8}>
                        {item.unitPrice !== null && (
                          <>Tổng đơn giá: <strong>{item.unitPrice?.toLocaleString()}đ</strong></>
                        )}
                      </Col>
                      <Col span={8}>
                        {item.totalAmount !== null && (
                          <>Tổng giá trị: <strong>{item.totalAmount?.toLocaleString()}đ</strong></>
                        )}
                      </Col>
                    </Row>
                  ) : (
                    <Row style={{ width: '100%' }}>
                      <Col span={12}><strong>{item.name}</strong></Col>
                      <Col span={12}><strong>{item.value}</strong></Col>
                    </Row>
                  )}
                </List.Item>
              )}
            />

            {data[0]?.totalAmount !== undefined && (
              <div style={{ textAlign: 'right', marginTop: 16 }}>
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