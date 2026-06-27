<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getContacts, createContact, deleteContact } from '../api/client';
import type { Contact } from '../types';

const contacts = ref<Contact[]>([]);
const loading = ref(true);
const error = ref('');
const submitting = ref(false);

const form = ref({ email: '', first_name: '', last_name: '' });

async function load() {
  loading.value = true;
  error.value = '';
  try {
    contacts.value = await getContacts();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load contacts';
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  if (!form.value.email) return;
  submitting.value = true;
  error.value = '';
  try {
    await createContact({
      email: form.value.email,
      first_name: form.value.first_name || undefined,
      last_name: form.value.last_name || undefined,
    });
    form.value = { email: '', first_name: '', last_name: '' };
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create contact';
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(id: number) {
  try {
    await deleteContact(id);
    contacts.value = contacts.value.filter((c) => c.id !== id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to delete contact';
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Contacts</h1>
        <p class="subtitle">Everyone you can send a campaign to.</p>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="card">
      <h2>Add contact</h2>
      <form @submit.prevent="handleCreate">
        <div class="form-row">
          <div class="field" style="flex: 2">
            <label for="email">Email</label>
            <input id="email" v-model="form.email" type="email" required placeholder="name@example.com" />
          </div>
          <div class="field" style="flex: 1">
            <label for="first_name">First name</label>
            <input id="first_name" v-model="form.first_name" type="text" />
          </div>
          <div class="field" style="flex: 1">
            <label for="last_name">Last name</label>
            <input id="last_name" v-model="form.last_name" type="text" />
          </div>
          <div class="field">
            <button type="submit" class="primary" :disabled="submitting">
              {{ submitting ? 'Adding...' : 'Add contact' }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <div class="card" style="padding: 0">
      <div v-if="loading" class="empty-state">Loading...</div>
      <div v-else-if="contacts.length === 0" class="empty-state">
        No contacts yet. Add your first one above.
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Status</th>
            <th>Added</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="contact in contacts" :key="contact.id">
            <td class="mono">{{ contact.email }}</td>
            <td>{{ [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—' }}</td>
            <td><span class="badge" :class="contact.status">{{ contact.status }}</span></td>
            <td class="subtitle">{{ new Date(contact.created_at).toLocaleDateString() }}</td>
            <td>
              <button @click="handleDelete(contact.id)">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
