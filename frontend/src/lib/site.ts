export const isSampleSite = (import.meta.env.VITE_SCHOOL_SLUG || "sample") === "sample";
// Change this flag to reveal Parent Login on CHS when ready.
export const CHS_PARENT_LOGIN_VISIBLE = false;
export const showParentLogin = isSampleSite || CHS_PARENT_LOGIN_VISIBLE;
export const schoolName = isSampleSite ? "Sample Elementary School" : "Cherry Hill Elementary";
export const DEMO_PASSWORD = "ExploreLunch2026!";
export const demoEmail = (role: "parent" | "admin") => `demo-${role}@example.test`;
export const DEMO_MESSAGE = "This is a demo site. Changes cannot be saved.";
