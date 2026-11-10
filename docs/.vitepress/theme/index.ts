import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import '@fontsource-variable/source-serif-4/wght.css'
import '@fontsource-variable/source-serif-4/wght-italic.css'
import '@fontsource/barlow-semi-condensed/500.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'
import './style.css'
import Layout from './Layout.vue'
import ExerciseStudio from './components/ExerciseStudio.vue'
import DiaText from './components/DiaText.vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ExerciseStudio', ExerciseStudio)
    app.component('DiaText', DiaText)
  },
} satisfies Theme
