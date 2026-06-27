<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getCampaign, getCampaignStats, getCampaignSends, sendCampaign } from '../api/client';
import type { Campaign, CampaignStats, SendRecord } from '../types';

const route = useRoute();
const campaignId = Number(route.params.id);

const campaign = ref<Campaign | null>(null);
const stats = ref<CampaignStats | null>(null);
const sends = ref<SendRecord[]>([]);
const loading = ref(true);
const sending = ref(false);
const error = ref('');

async function load() {
  error.value = '';
  try {
    [campaign.value, stats.value, sends.value] = await Promise.all([
      getCampaign(campaignId),
      getCampaignStats(campaignId),
      getCampaignSends(campaignId),
    ]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load campaign';
  } finally {
    loading.value = false;
  }
}

async function handleSend() {
  sending.value = true;
  error.value = '';
  try {
    const result = await sendCampaign(campaignId);
    if (result.queued === 0) {
      error.value = 'No eligible recipients - add contacts to a targeted list first.';
    }
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to send campaign';
  } finally {
    sending.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <router-link to="/campaigns" class="subtitle">&larr; Campaigns</router-link>
        <h1>{{ campaign?.name ?? 'Loading...' }}</h1>
        <p class="subtitle" v-if="campaign">{{ campaign.subject }}</p>
      </div>
      <div style="display: flex; gap: 8px">
        <button @click="load">Refresh</button>
        <button class="primary" :disabled="sending" @click="handleSend">
          {{ sending ? 'Queuing...' : 'Send campaign' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div v-if="stats" class="stat-grid">
      <div class="stat">
        <div class="stat-value">{{ stats.sent }}</div>
        <div class="stat-label">Sent</div>
      </div>
      <div class="stat">
        <div class="stat-value">{{ stats.bounced }}</div>
        <div class="stat-label">Bounced</div>
      </div>
      <div class="stat">
        <div class="stat-value">{{ stats.unique_opens }}</div>
        <div class="stat-label">Unique opens ({{ stats.total_opens }} total)</div>
      </div>
      <div class="stat">
        <div class="stat-value">{{ stats.unique_clicks }}</div>
        <div class="stat-label">Unique clicks ({{ stats.total_clicks }} total)</div>
      </div>
    </div>

    <div class="card" style="padding: 0">
      <div v-if="loading" class="empty-state">Loading...</div>
      <div v-else-if="sends.length === 0" class="empty-state">
        No sends yet. Click "Send campaign" to queue this for its target list.
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Recipient</th>
            <th>Status</th>
            <th>Detail</th>
            <th>Sent at</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="send in sends" :key="send.id">
            <td class="mono">{{ send.email }}</td>
            <td><span class="badge" :class="send.status">{{ send.status }}</span></td>
            <td class="subtitle">{{ send.smtp_response ?? '—' }}</td>
            <td class="subtitle">{{ send.sent_at ? new Date(send.sent_at).toLocaleString() : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
