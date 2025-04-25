import Navbar from "./NavBar/Navbar";
import { Layout } from "antd";
import NavbarBody from "./NavBarBody/NavbarBody";
const { Content } = Layout;

const AdminPage = () => {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Navbar />
      <Content style={{ padding: "24px" }}>
        <NavbarBody />
      </Content>
    </Layout>
  );
};

export default AdminPage;
