<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getLists, createList } from '../api/client';
import type { ContactList } from '../types';

const lists = ref<ContactList[]>([]);
const loading = ref(true);
const error = ref('');
const submitting = ref(false);

const form = ref({ name: '', description: '' });

async function load() {
  loading.value = true;
  error.value = '';
  try {
    lists.value = await getLists();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load lists';
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  if (!form.value.name) return;
  submitting.value = true;
  error.value = '';
  try {
    await createList({ name: form.value.name, description: form.value.description || undefined });
    form.value = { name: '', description: '' };
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create list';
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
        <h1>Lists</h1>
        <p class="subtitle">Audiences you can target with a campaign.</p>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="card">
      <h2>Create list</h2>
      <form @submit.prevent="handleCreate">
        <div class="form-row">
          <div class="field" style="flex: 1">
            <label for="name">Name</label>
            <input id="name" v-model="form.name" type="text" required placeholder="Newsletter subscribers" />
          </div>
          <div class="field" style="flex: 2">
            <label for="description">Description</label>
            <input id="description" v-model="form.description" type="text" />
          </div>
          <div class="field">
            <button type="submit" class="primary" :disabled="submitting">
              {{ submitting ? 'Creating...' : 'Create list' }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <div class="card" style="padding: 0">
      <div v-if="loading" class="empty-state">Loading...</div>
      <div v-else-if="lists.length === 0" class="empty-state">
        No lists yet. Create one above.
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Contacts</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="list in lists" :key="list.id">
            <td>{{ list.name }}</td>
            <td class="subtitle">{{ list.description || '—' }}</td>
            <td class="mono">{{ list.contact_count }}</td>
            <td>
              <router-link :to="`/lists/${list.id}`" class="btn">Manage</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
