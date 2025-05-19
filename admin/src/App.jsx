import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Auth from "./auth/auth";
import AdminPage from "./adminPage/adminPage";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
};

export default App;
