<script setup lang="ts">
</script>

<template>
  <div class="app-shell">
    <nav class="nav">
      <span class="nav-brand">email-marketing-app</span>
      <div class="nav-links">
        <router-link to="/contacts">Contacts</router-link>
        <router-link to="/lists">Lists</router-link>
        <router-link to="/campaigns">Campaigns</router-link>
      </div>
    </nav>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>
