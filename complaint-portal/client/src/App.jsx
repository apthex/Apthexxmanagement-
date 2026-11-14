import { Routes, Route } from "react-router-dom";
import Welcome from "./pages/Welcome.jsx";
import Category from "./pages/Category.jsx";
import Details from "./pages/Details.jsx";
import ThankYou from "./pages/ThankYou.jsx";
import StatusCheck from "./pages/StatusCheck.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import DeskDashboard from "./pages/DeskDashboard.jsx";
import DeskComplaint from "./pages/DeskComplaint.jsx";
import DeskStats from "./pages/DeskStats.jsx";
import Protected from "./components/Protected.jsx";

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/category" element={<Category />} />
        <Route path="/details" element={<Details />} />
        <Route path="/thanks" element={<ThankYou />} />
        <Route path="/status" element={<StatusCheck />} />
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route path="/desk" element={<Protected><DeskDashboard /></Protected>} />
        <Route path="/desk/complaint/:ref" element={<Protected><DeskComplaint /></Protected>} />
        <Route path="/desk/stats" element={<Protected><DeskStats /></Protected>} />
      </Routes>
    </div>
  );
}