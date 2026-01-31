import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/",
    name: "sessions",
    component: () => import("../pages/SessionsPage.vue"),
  },
  {
    path: "/session/:id",
    name: "session-detail",
    component: () => import("../pages/SessionDetailPage.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
