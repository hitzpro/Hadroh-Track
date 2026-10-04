import { useCallback, useEffect, useState } from "react";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import Members from "./pages/Members";
import MemberDetail from "./pages/MemberDetail";
import Attendance from "./pages/Attendance";
import Instruments from "./pages/Instruments";
import InstrumentDetail from "./pages/InstrumentDetail";
import Settings from "./pages/Settings";

export default function App() {
  const [view, setView] = useState<{ page: string; id?: number }>({ page: "home" });
  const [theme, setTheme] = useState("light");

  const go = useCallback((page: string, id?: number) => setView({ page, id }), []);

  useEffect(() => {
    function check() {
      const h = new Date().getHours();
      setTheme(h >= 6 && h < 18 ? "light" : "dark");
    }
    check();
    const i = setInterval(check, 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const { page, id } = view;
  const tab = page === "member" ? "members" : page === "instrument" ? "instruments" : page;

  return (
    <div className={"app " + theme}>
      <main className="screen">
        {page === "home" && <Home />}
        {page === "members" && <Members go={go} />}
        {page === "member" && <MemberDetail id={id!} go={go} />}
        {page === "attendance" && <Attendance />}
        {page === "instruments" && <Instruments go={go} />}
        {page === "instrument" && <InstrumentDetail id={id!} go={go} />}
        {page === "settings" && <Settings />}
      </main>

      <BottomNav page={tab} setPage={go} />
    </div>
  );
}
