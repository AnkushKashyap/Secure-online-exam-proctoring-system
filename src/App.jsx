import { useAppContext } from "./state/AppContext";
import AdminPortal from "./components/AdminPortal";
import FacultyPortal from "./components/FacultyPortalV2";
import LoginPortal from "./components/LoginPortal";
import Shell from "./components/Shell";
import StudentPortal from "./components/StudentPortalV2";
import SummaryCards from "./components/SummaryCards";
import TopBar from "./components/TopBarV2";

export default function App() {
  const { currentUser } = useAppContext();

  if (!currentUser) {
    return <LoginPortal />;
  }

  return (
    <Shell>
      <TopBar />
      <SummaryCards />
      {currentUser.role === "student" && <StudentPortal />}
      {currentUser.role === "faculty" && <FacultyPortal />}
      {currentUser.role === "admin" && <AdminPortal />}
    </Shell>
  );
}
