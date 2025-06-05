import { Button, Typography, Card } from 'antd';
import keycloak from './keyCloak';
const { Title } = Typography;

const Auth = () => {
  const handleLogin = () => {
    keycloak.login({
      redirectUri: window.location.origin + '/admin'
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #e0f7fa 0%, #e1bee7 100%)',
    }}>
      <Card
        style={{ width: 400, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
      >
        <Title level={2} style={{ textAlign: 'center', marginBottom: 30 }}>Đăng nhập</Title>
        <Button type="primary" block shape="round" style={{ marginTop: '20px' }} onClick={handleLogin}>Đăng nhập</Button>
      </Card>
    </div>
  );
};

export default Auth;