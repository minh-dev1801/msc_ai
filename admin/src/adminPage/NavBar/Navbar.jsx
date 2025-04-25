import React from 'react'
import keycloak from '../../auth/keyCloak';
import { Button, Layout, Typography } from 'antd';
const { Header } = Layout;
const { Title } = Typography;

const Navbar = () => {
  const handleLogout = () => {
    keycloak.logout({ redirectUri: window.location.origin + '/' });
  };

  return (
    <Header style={{
      background: "#fff",
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    }}>
      <Title title={2} style={{ margin: 0 }}>Trang Admin</Title>
      <Button type='primary' danger onClick={handleLogout}>Đăng Xuất</Button>
    </Header>
  )
}

export default Navbar
