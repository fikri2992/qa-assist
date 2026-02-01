import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/",
    name: "sessions",
    component: () => import("../pages/SessionsPage.vue"),
  },
  {
    path: "/sessions/:id",
    name: "session-detail",
    component: () => import("../pages/SessionDetailPage.vue"),
  },
  {
    path: "/session/:id",
    name: "session-detail-legacy",
    redirect: (to) => `/sessions/${to.params.id}`,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
