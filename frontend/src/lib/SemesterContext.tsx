import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import pb from "./pocketbase";
import { SEMESTER_START, SEMESTER_END } from "./semester";

export interface SemesterConfig {
  start: string;      // YYYY-MM-DD
  end: string;        // YYYY-MM-DD
  settingsId: string;
  loading: boolean;
  refresh: () => void;
}

const noop = () => {};

const SemesterContext = createContext<SemesterConfig>({
  start: SEMESTER_START,
  end: SEMESTER_END,
  settingsId: "",
  loading: true,
  refresh: noop,
});

export function SemesterProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState({
    start: SEMESTER_START,
    end: SEMESTER_END,
    settingsId: "",
    loading: true,
  });

  const load = useCallback(() => {
    pb.collection("settings")
      .getFirstListItem("id != ''", { requestKey: null })
      .then((rec) => {
        setData({
          start:      rec.semester_start ? rec.semester_start.slice(0, 10) : SEMESTER_START,
          end:        rec.semester_end   ? rec.semester_end.slice(0, 10)   : SEMESTER_END,
          settingsId: rec.id,
          loading:    false,
        });
      })
      .catch(() => setData((d) => ({ ...d, loading: false })));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SemesterContext.Provider value={{ ...data, refresh: load }}>
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester(): SemesterConfig {
  return useContext(SemesterContext);
}
