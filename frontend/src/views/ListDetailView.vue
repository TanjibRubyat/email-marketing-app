<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { getListContacts, getContacts, addContactToList, removeContactFromList } from '../api/client';
import type { Contact } from '../types';

const route = useRoute();
const listId = Number(route.params.id);

const listContacts = ref<Contact[]>([]);
const allContacts = ref<Contact[]>([]);
const loading = ref(true);
const error = ref('');
const selectedContactId = ref<number | ''>('');

const availableToAdd = computed(() => {
  const existingIds = new Set(listContacts.value.map((c) => c.id));
  return allContacts.value.filter((c) => !existingIds.has(c.id));
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    [listContacts.value, allContacts.value] = await Promise.all([
      getListContacts(listId),
      getContacts(),
    ]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load list';
  } finally {
    loading.value = false;
  }
}

async function handleAdd() {
  if (!selectedContactId.value) return;
  try {
    await addContactToList(listId, Number(selectedContactId.value));
    selectedContactId.value = '';
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to add contact';
  }
}

async function handleRemove(contactId: number) {
  try {
    await removeContactFromList(listId, contactId);
    listContacts.value = listContacts.value.filter((c) => c.id !== contactId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to remove contact';
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <router-link to="/lists" class="subtitle">&larr; Lists</router-link>
        <h1>List #{{ listId }}</h1>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="card">
      <h2>Add a contact to this list</h2>
      <div class="form-row">
        <div class="field" style="flex: 1">
          <select v-model="selectedContactId">
            <option value="" disabled>Select a contact...</option>
            <option v-for="c in availableToAdd" :key="c.id" :value="c.id">{{ c.email }}</option>
          </select>
        </div>
        <div class="field">
          <button class="primary" :disabled="!selectedContactId" @click="handleAdd">Add</button>
        </div>
      </div>
    </div>

    <div class="card" style="padding: 0">
      <div v-if="loading" class="empty-state">Loading...</div>
      <div v-else-if="listContacts.length === 0" class="empty-state">
        No contacts on this list yet.
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="contact in listContacts" :key="contact.id">
            <td class="mono">{{ contact.email }}</td>
            <td>{{ [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—' }}</td>
            <td><button @click="handleRemove(contact.id)">Remove</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
