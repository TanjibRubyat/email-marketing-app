<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getCampaigns, createCampaign, getLists } from '../api/client';
import type { Campaign, ContactList } from '../types';

const campaigns = ref<Campaign[]>([]);
const lists = ref<ContactList[]>([]);
const loading = ref(true);
const error = ref('');
const submitting = ref(false);

const form = ref({
  name: '',
  subject: '',
  from_name: '',
  from_email: '',
  html_body: '',
  list_id: '' as number | '',
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    [campaigns.value, lists.value] = await Promise.all([getCampaigns(), getLists()]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load campaigns';
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  if (!form.value.name || !form.value.subject || !form.value.from_email) return;
  submitting.value = true;
  error.value = '';
  try {
    await createCampaign({
      name: form.value.name,
      subject: form.value.subject,
      from_name: form.value.from_name || form.value.name,
      from_email: form.value.from_email,
      html_body: form.value.html_body || undefined,
      list_ids: form.value.list_id ? [Number(form.value.list_id)] : undefined,
    });
    form.value = { name: '', subject: '', from_name: '', from_email: '', html_body: '', list_id: '' };
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create campaign';
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Campaigns</h1>
        <p class="subtitle">Compose and track sends.</p>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="card">
      <h2>New campaign</h2>
      <form @submit.prevent="handleCreate">
        <div class="form-row">
          <div class="field" style="flex: 1">
            <label for="name">Campaign name</label>
            <input id="name" v-model="form.name" type="text" required placeholder="June newsletter" />
          </div>
          <div class="field" style="flex: 1">
            <label for="subject">Subject line</label>
            <input id="subject" v-model="form.subject" type="text" required />
          </div>
        </div>
        <div class="form-row">
          <div class="field" style="flex: 1">
            <label for="from_name">From name</label>
            <input id="from_name" v-model="form.from_name" type="text" placeholder="Your name" />
          </div>
          <div class="field" style="flex: 1">
            <label for="from_email">From email</label>
            <input id="from_email" v-model="form.from_email" type="email" required />
          </div>
          <div class="field" style="flex: 1">
            <label for="list_id">Target list</label>
            <select id="list_id" v-model="form.list_id">
              <option value="">No list (add later)</option>
              <option v-for="l in lists" :key="l.id" :value="l.id">{{ l.name }}</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="html_body">Email body (HTML)</label>
          <textarea id="html_body" v-model="form.html_body" rows="4" placeholder="<p>Hi there!</p>"></textarea>
        </div>
        <button type="submit" class="primary" :disabled="submitting">
          {{ submitting ? 'Creating...' : 'Create campaign' }}
        </button>
      </form>
    </div>

    <div class="card" style="padding: 0">
      <div v-if="loading" class="empty-state">Loading...</div>
      <div v-else-if="campaigns.length === 0" class="empty-state">
        No campaigns yet. Create one above.
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Name</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="campaign in campaigns" :key="campaign.id">
            <td>{{ campaign.name }}</td>
            <td class="subtitle">{{ campaign.subject }}</td>
            <td><span class="badge" :class="campaign.status">{{ campaign.status }}</span></td>
            <td class="subtitle">{{ new Date(campaign.created_at).toLocaleDateString() }}</td>
            <td>
              <router-link :to="`/campaigns/${campaign.id}`" class="btn">View</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
