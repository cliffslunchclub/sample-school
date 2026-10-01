import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import pb from "./pocketbase";
import { SEMESTER_START, SEMESTER_END, DEFAULT_ORDERING_DAYS, type OrderingDay } from "./semester";

export interface SemesterConfig {
  start: string;      // YYYY-MM-DD
  end: string;        // YYYY-MM-DD
  settingsId: string;
  orderingDays: OrderingDay[];
  loading: boolean;
  refresh: () => void;
}

const noop = () => {};

const SemesterContext = createContext<SemesterConfig>({
  start: SEMESTER_START,
  end: SEMESTER_END,
  settingsId: "",
  orderingDays: DEFAULT_ORDERING_DAYS,
  loading: true,
  refresh: noop,
});

export function SemesterProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState({
    start: SEMESTER_START,
    end: SEMESTER_END,
    settingsId: "",
    orderingDays: DEFAULT_ORDERING_DAYS,
    loading: true,
  });

  const load = useCallback(() => {
    pb.send<{id:string; semester_start:string; semester_end:string; ordering_days:OrderingDay[]}>("/api/school-calendar", {method:"GET", requestKey:null})
      .then((rec) => {
        setData(previous => ({
          start:      rec.semester_start ? rec.semester_start.slice(0, 10) : SEMESTER_START,
          end:        rec.semester_end   ? rec.semester_end.slice(0, 10)   : SEMESTER_END,
          settingsId: rec.id,
          orderingDays: JSON.stringify(previous.orderingDays) === JSON.stringify(rec.ordering_days ?? DEFAULT_ORDERING_DAYS) ? previous.orderingDays : rec.ordering_days ?? DEFAULT_ORDERING_DAYS,
          loading:    false,
        }));
      })
      .catch(() => setData((d) => ({ ...d, loading: false })));
  }, []);

  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);

  return (
    <SemesterContext.Provider value={{ ...data, refresh: load }}>
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester(): SemesterConfig {
  return useContext(SemesterContext);
}
