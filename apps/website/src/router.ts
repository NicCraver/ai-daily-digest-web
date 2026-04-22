import type { RouteRecordRaw } from "vue-router";
import { getAllArticleRoutes, getAllDates, getAllWeekIds } from "./data";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("./pages/Home.vue"),
  },
  {
    path: "/archive",
    name: "archive",
    component: () => import("./pages/Archive.vue"),
  },
  {
    path: "/d/:date",
    name: "day",
    component: () => import("./pages/Day.vue"),
    props: true,
  },
  {
    path: "/d/:date/a/:slug",
    name: "article",
    component: () => import("./pages/Article.vue"),
    props: true,
  },
  {
    path: "/w/:weekId",
    name: "week",
    component: () => import("./pages/Week.vue"),
    props: true,
  },
];

// vite-ssg uses this to know which dynamic routes to pre-render
export async function includedRoutes(): Promise<string[]> {
  const dates = getAllDates();
  const weeks = getAllWeekIds();
  return [
    "/",
    "/archive",
    ...dates.map((d) => `/d/${d}`),
    ...getAllArticleRoutes(),
    ...weeks.map((w) => `/w/${w}`),
  ];
}
