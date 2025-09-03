import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

const PRIMARY_COLOR = 'blue'

const LightPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: `{${PRIMARY_COLOR}.50}`,
      100: `{${PRIMARY_COLOR}.100}`,
      200: `{${PRIMARY_COLOR}.200}`,
      300: `{${PRIMARY_COLOR}.300}`,
      400: `{${PRIMARY_COLOR}.400}`,
      500: `{${PRIMARY_COLOR}.500}`,
      600: `{${PRIMARY_COLOR}.600}`,
      700: `{${PRIMARY_COLOR}.700}`,
      800: `{${PRIMARY_COLOR}.800}`,
      900: `{${PRIMARY_COLOR}.900}`,
      950: `{${PRIMARY_COLOR}.950}`,
    },
  },
})

// Вместо импорта AuraDark создаем темную версию на основе светлой
const DarkPreset = definePreset(Aura, {
  name: 'dark',
  dark: true,
  semantic: {
    primary: {
      50: `{${PRIMARY_COLOR}.50}`,
      100: `{${PRIMARY_COLOR}.100}`,
      200: `{${PRIMARY_COLOR}.200}`,
      300: `{${PRIMARY_COLOR}.300}`,
      400: `{${PRIMARY_COLOR}.400}`,
      500: `{${PRIMARY_COLOR}.500}`,
      600: `{${PRIMARY_COLOR}.600}`,
      700: `{${PRIMARY_COLOR}.700}`,
      800: `{${PRIMARY_COLOR}.800}`,
      900: `{${PRIMARY_COLOR}.900}`,
      950: `{${PRIMARY_COLOR}.950}`,
    },
  },
})

const theme = {
  light: LightPreset,
  dark: DarkPreset,
  preset: LightPreset,
  options: {
    darkModeSelector: '[data-theme="dark"]',
  },
}

export default theme
