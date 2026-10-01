import type { Weekday } from "./semester";
export type Role = "parent" | "admin";

export interface UserRecord {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  active: boolean;
  school?: string;
  created: string;
  updated: string;
}

export interface School {
  id: string;
  name: string;
  active: boolean;
}

export interface Grade {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface Teacher {
  id: string;
  name: string;
  grade: string;
  active: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  active: boolean;
  days: Weekday[];
}

export interface DeliveryTime {
  id: string;
  label: string;
  sort_order: number;
  active: boolean;
}

export interface DeliveryRule {
  id: string;
  grade: string;
  teacher: string;
  delivery_time: string;
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  teacher: string;
  parent: string;
  active: boolean;
  created: string;
  expand?: {
    grade?: Grade;
    teacher?: Teacher;
    parent?: UserRecord;
  };
}

export interface MealSelection {
  id: string;
  student: string;
  lunch_date: string;
  menu_item: string;
  delivery_time: string;
  parent: string;
  created: string;
  updated: string;
  expand?: {
    student?: Student & { expand?: { grade?: Grade; teacher?: Teacher } };
    menu_item?: MenuItem;
    delivery_time?: DeliveryTime;
    parent?: UserRecord;
  };
}

export interface AuditEntry {
  id: string;
  student: string;
  lunch_date: string;
  previous_meal: string;
  new_meal: string;
  admin: string;
  action: string;
  reason: string;
  created: string;
  expand?: {
    student?: Student;
    previous_meal?: MenuItem;
    new_meal?: MenuItem;
    admin?: UserRecord;
  };
}

export interface Settings {
  id: string;
  verification_code: string;
  school: string;
  semester_start: string;
  semester_end: string;
}
