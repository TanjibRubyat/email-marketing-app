import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/contacts' },
    { path: '/contacts', name: 'contacts', component: () => import('../views/ContactsView.vue') },
    { path: '/lists', name: 'lists', component: () => import('../views/ListsView.vue') },
    { path: '/lists/:id', name: 'list-detail', component: () => import('../views/ListDetailView.vue') },
    { path: '/campaigns', name: 'campaigns', component: () => import('../views/CampaignsView.vue') },
    {
      path: '/campaigns/:id',
      name: 'campaign-detail',
      component: () => import('../views/CampaignDetailView.vue'),
    },
  ],
});

export default router;
