<script setup lang="ts">
import DefaultTheme from 'vitepress/theme-without-fonts'
import TutorDrawer from './components/TutorDrawer.vue'
import TutorToggle from './components/TutorToggle.vue'
import PlateHero from './components/PlateHero.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #nav-bar-content-after><TutorToggle variant="nav" /></template>
    <template #home-hero-image><PlateHero /></template>
    <template #layout-bottom><TutorDrawer /></template>
  </Layout>
</template>
