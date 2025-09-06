<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import Divider from 'primevue/divider'
import { computed } from 'vue'
import { REQUIREMENT_TYPES } from '../__data__/constants'

type RunningLast = { id?: string; fragments?: string[] }

type AnalysisItem = {
  id: string
  type: 'technical_skill' | 'soft_skill' | string
  score: number
  status: 'evaluated' | 'unconfirmed' | 'skipped' | string
  weight: number
  description: string
  justification: string
}

type AnalysisData = {
  error?: boolean
  items?: AnalysisItem[]
  chatId?: string
  finalScore?: number
  categoryScores?: Record<string, number>
  status?: 'running'
  last?: RunningLast
}

const props = defineProps<{ analysis: AnalysisData }>()

const requireMentTypesMap = REQUIREMENT_TYPES.reduce((acc, el) => {
  acc[el.value as string] = el.label
  return acc
}, {} as Record<string, string>)

const isRunning = computed(() => props.analysis?.status === 'running')
const hasError = computed(() => props.analysis?.error === true)
const hasResult = computed(() => Array.isArray(props.analysis?.items))
const items = computed(() => (props.analysis?.items ?? []) as AnalysisItem[])
const categoryScores = computed(() => props.analysis?.categoryScores || {})
const finalPercent = computed(() => Math.round(((props.analysis?.finalScore ?? 0) * 100)))

function labelForType(t: string): string {
  return requireMentTypesMap[t]
}

function statusSeverity(s: string): 'success' | 'warning' | 'danger' | 'info' | undefined {
  if (s === 'evaluated') return 'success'
  if (s === 'unconfirmed') return 'warning'
  if (s === 'skipped') return 'info'
  return undefined
}
</script>

<template>
  <div class="analysis-view">
    <!-- Running state -->
    <div v-if="isRunning" class="running">
      <div class="row">
        <div class="left">
          <h4>Анализ выполняется…</h4>
          <p class="muted">Идёт обработка диалога и проверка требований.</p>
          <ProgressBar :value="50" mode="indeterminate" style="height: 8px" />
        </div>
      </div>
      <div v-if="analysis.last" class="last">
        <Divider />
        <h5>Текущий пункт: {{ analysis.last.id }}</h5>
        <Card v-if="analysis.last.fragments && analysis.last.fragments.length" class="mb-8">
          <template #title>Фрагменты диалога</template>
          <template #content>
            <ul class="fragments">
              <li v-for="(f, i) in analysis.last.fragments" :key="i">{{ f }}</li>
            </ul>
          </template>
        </Card>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="error-box">
      <strong>Ошибка анализа.</strong>
      <p class="muted">Можно попробовать пересоздать отчёт.</p>
    </div>

    <!-- Final result -->
    <div v-else-if="hasResult" class="result">
      <div class="row score-row">
        <Card class="score-card">
          <template #title>Итоговый балл</template>
          <template #content>
            <div class="final-score">
              <div class="value">{{ (analysis.finalScore ?? 0).toFixed(2) }}</div>
              <ProgressBar :value="finalPercent" showValue :pt="{ value: { style: 'background-color: var(--p-primary-color)' } }" />
            </div>
          </template>
        </Card>

        <Card class="score-card">
          <template #title>Категории</template>
          <template #content>
            <div class="categories">
              <div class="cat" v-for="(v, k) in categoryScores" :key="k">
                <span class="k">{{ labelForType(k) }}</span>
                <span class="v">{{ (v ?? 0).toFixed(2) }}</span>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <Divider class="my-12" />

      <div class="items">
        <Card v-for="it in items" :key="it.id" class="item">
          <template #title>
            <div class="item-head">
              <span class="desc">{{ it.description }}</span>
              <div class="tags">
                <Tag :value="labelForType(it.type)" severity="info" />
                <Tag :value="`статус: ${it.status}`" :severity="statusSeverity(it.status)" />
                <Tag :value="`вес: ${it.weight}`" />
              </div>
            </div>
          </template>
          <template #content>
            <div class="item-content">
              <div class="score-line">
                <span class="score-label">Оценка:</span>
                <ProgressBar :value="Math.min(100, Math.max(0, Math.round((it.score / 10) * 100)))" style="height: 10px" />
                <span class="score-val">{{ it.score }}/10</span>
              </div>
              <div class="justification">{{ it.justification }}</div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Fallback (unknown shape) -->
    <div v-else class="raw">
      <pre class="json">{{ JSON.stringify(analysis, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
.mb-8 { margin-bottom: 8px; }
.my-12 { margin-top: 12px; margin-bottom: 12px; }

.muted { opacity: 0.7; }

.analysis-view { display: block; }

.row { display: grid; grid-template-columns: 1fr; gap: 12px; }
.score-row { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

.score-card { }
.final-score { display: grid; gap: 8px; align-items: center; }
.final-score .value { font-size: 28px; font-weight: 700; }

.categories { display: grid; gap: 6px; }
.cat { display: flex; justify-content: space-between; font-size: 14px; }
.cat .k { opacity: 0.8; }
.cat .v { font-weight: 600; }

.items { display: grid; gap: 10px; }
.item .item-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.item .desc { font-weight: 600; }
.item .tags { display: flex; gap: 6px; flex-wrap: wrap; }
.item .item-content { display: grid; gap: 8px; }
.score-line { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; }
.score-label { font-size: 14px; opacity: 0.8; }
.score-val { font-size: 14px; font-weight: 600; }

.raw .json {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 8px;
  overflow: auto;
}

.error-box {
  border: 1px solid var(--red-300);
  background: var(--red-50);
  color: var(--red-700);
  padding: 10px;
  border-radius: 8px;
}

@media (max-width: 600px) {
  .score-row { grid-template-columns: 1fr; }
}
</style>


