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
  Modal,
  Form,
  Input,
  List,
  Row,
  Col,
  Card,
  Select,
  message,
  Layout,
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
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [form] = Form.useForm();
  const [chartType, setChartType] = useState("pie");
  const [vendorList, setVendorList] = useState([]);
  const [customPrompt, setCustomPrompt] = useState("");

  const fetchData = async () => {
    const res = await axios.get("http://localhost:5000/api/fields", {
      headers: {
        Authorization: `Bearer ${keycloak.token}`,
      },
    });
    setData(res.data);
  };

  const handleSaveChart = async () => {
    if (!customPrompt.trim() || !chartType) {
      message.warning("Không đủ thông tin để lưu biểu đồ!");
      return;
    }
    try {
      await axios.post(
        "http://localhost:5000/api/charts",
        {
          prompt: customPrompt,
          type: chartType,
        },
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );
      message.success("✅ Đã lưu biểu đồ!");
    } catch (err) {
      console.log(err);
      message.error("❌ Không thể lưu biểu đồ!");
    }
  };

  const fetchVendors = async (fieldCategory) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/fields/${fieldCategory}/vendors`,
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );
      setVendorList(res.data);
    } catch (err) {
      console.log(err);
      message.error("Không thể lấy danh sách Vendor");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModel = () => setIsModelOpen(true);
  const closeModel = () => {
    form.resetFields();
    setIsModelOpen(false);
  };

  const handleAddField = async (values) => {
    try {
      await axios.post("http://localhost:5000/api/fields", values, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      message.success("Thêm thành công!");
      closeModel();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || "Lỗi khi thêm lĩnh vực");
    }
  };

  const handleDelete = async (name) => {
    try {
      await axios.delete(`http://localhost:5000/api/fields/${name}`, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      message.success("Đã xoá");
      fetchData();
    } catch {
      message.error("Không thể xoá lĩnh vực");
    }
  };

  // const interpretPrompt = (prompt) => {
  //   const lower = prompt.toLowerCase();

  //   if (lower.includes("cột") || lower.includes("bar")) return "bar";
  //   if (
  //     lower.includes("tròn") ||
  //     lower.includes("pie") ||
  //     lower.includes("tỉ trọng") ||
  //     lower.includes("phần trăm")
  //   )
  //     return "pie";
  //   if (lower.includes("đường") || lower.includes("line")) return "line";
  //   if (lower.includes("area") || lower.includes("khu vực")) return "area";

  //   return "pie";
  // };

  const handleGenerateChart = async () => {
    if (!customPrompt.trim()) {
      message.warning("Vui Lòng Nhập Mô Tả Trước!");
      return;
    }
    try {
      const res = await axios.post(
        "http://localhost:5000/api/ai/interpret",
        {
          prompt: customPrompt,
        },
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );
      const chartType = res.data.chartType;
      const fieldCategories = res.data.fieldCategories;

      setChartType(chartType);
      setData(fieldCategories);

      message.success(`Đã tạo biểu đồ dạng ${chartType.toUpperCase()}`);
    } catch (error) {
      console.log(error);
      message.error("Ai không thể phân tích propmt");
    }
  };

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={data}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
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
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
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
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Layout>
      <Row gutter={16}>
        <Col span={14}>
          <Card title="Tạo biểu đồ theo ý bạn">
            <Input.TextArea
              rows={2}
              placeholder="Nhập mô tả biểu đồ bạn muốn..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            <Row gutter={8} style={{ marginTop: 8 }}>
              <Col>
                <Button type="primary" onClick={handleGenerateChart}>
                  Tạo biểu đồ
                </Button>
              </Col>
              <Col>
                <Button onClick={handleSaveChart} disabled={!chartType}>
                  💾 Lưu biểu đồ
                </Button>
              </Col>
            </Row>
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
                <span>Thống kê tỉ trọng các lĩnh vực</span>
                <Select
                  value={chartType}
                  onChange={setChartType}
                  style={{ width: 120 }}
                >
                  <Option value="pie">Pie Chart</Option>
                  <Option value="bar">Bar Chart</Option>
                  <Option value="line">Line Chart</Option>
                  <Option value="area">Area Chart</Option>
                </Select>
              </div>
            }
          >
            {renderChart()}
          </Card>
        </Col>

        <Col span={10}>
          <Card title="Cài đặt lĩnh vực">
            <List
              dataSource={data}
              renderItem={(item, index) => (
                <List.Item
                  actions={[
                    <Button
                      key={index}
                      danger
                      type="link"
                      onClick={() => handleDelete(item.name)}
                    >
                      Xoá
                    </Button>,
                  ]}
                >
                  <strong>{item.name}</strong> - {item.value}%
                </List.Item>
              )}
            />
            <Button
              type="primary"
              block
              onClick={openModel}
              style={{ marginTop: 16 }}
            >
              Thêm lĩnh vực
            </Button>
          </Card>

          <Card
            title="Lấy danh sách Vendor theo lĩnh vực"
            style={{ marginTop: 24 }}
          >
            <Form layout="inline">
              <Form.Item label="Chọn lĩnh vực">
                <Select
                  placeholder="Chọn lĩnh vực"
                  style={{ width: 220 }}
                  onChange={(val) => {
                    fetchVendors(val);
                  }}
                >
                  {data.map((item) => (
                    <Option key={item.name} value={item.name}>
                      {item.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Form>

            {vendorList.length > 0 && (
              <List
                header={<strong>Danh sách Vendor</strong>}
                bordered
                dataSource={vendorList}
                style={{ marginTop: 16 }}
                renderItem={(vendor) => <List.Item>{vendor}</List.Item>}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="Thêm lĩnh vực"
        open={isModelOpen}
        onCancel={closeModel}
        onOk={() => form.submit()}
        okText="Thêm"
        cancelText="Hủy"
      >
        <Form form={form} onFinish={handleAddField} layout="vertical">
          <Form.Item
            name="name"
            label="Tên Lĩnh Vực"
            rules={[{ required: true, message: "Vui lòng nhập tên" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="value"
            label="Tỉ trọng (%)"
            rules={[
              { required: true, message: "Nhập tỉ trọng" },
              {
                validator: (_, val) =>
                  val > 0 && val <= 100
                    ? Promise.resolve()
                    : Promise.reject(new Error("Tỉ trọng từ 1% đến 100%")),
              },
            ]}
          >
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default NavbarBody;
